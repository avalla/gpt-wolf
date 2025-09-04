import type { TradeSignal } from './types';

/**
 * Sistema di notifiche Telegram per segnali di trading
 */
export class TelegramNotifier {
  private botToken: string;
  private chatId: string;
  private baseUrl: string;

  constructor(botToken: string, chatId: string) {
    this.botToken = botToken;
    this.chatId = chatId;
    this.baseUrl = `https://api.telegram.org/bot${botToken}`;
  }

  /**
   * Invia segnale di trading su Telegram
   */
  async sendTradingSignal(signal: TradeSignal): Promise<boolean> {
    try {
      const message = this.formatSignalMessage(signal);
      const response = await fetch(`${this.baseUrl}/sendMessage`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          chat_id: this.chatId,
          text: message,
          parse_mode: 'Markdown',
          disable_web_page_preview: true
        })
      });

      if (!response.ok) {
        const error = await response.text();
        console.error('[TELEGRAM] Errore invio messaggio:', error);
        return false;
      }

      console.log(`[TELEGRAM] ✅ Segnale ${signal.symbol} ${signal.direction} inviato`);
      return true;
    } catch (error) {
      console.error('[TELEGRAM] Errore:', error);
      return false;
    }
  }

  /**
   * Invia messaggio generico su Telegram
   */
  async sendMessage(message: string): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseUrl}/sendMessage`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          chat_id: this.chatId,
          text: message,
          parse_mode: 'Markdown',
          disable_web_page_preview: true
        })
      });

      if (!response.ok) {
        const error = await response.text();
        console.error('[TELEGRAM] Errore invio messaggio:', error);
        return false;
      }

      return true;
    } catch (error) {
      console.error('[TELEGRAM] Errore:', error);
      return false;
    }
  }

  /**
   * Formatta segnale per messaggio Telegram
   */
  private formatSignalMessage(signal: TradeSignal): string {
    const direction = signal.direction === 'LONG' ? '🟢 LONG' : '🔴 SHORT';
    const leverage = `${signal.leverage}x`;
    const riskReward = this.calculateRiskReward(signal);
    const potentialProfit = this.calculatePotentialProfit(signal);
    const orderTypeIcon = this.getOrderTypeIcon(signal.orderType);

    // Genera link Bybit per trading diretto
    const bybitUrl = this.generateBybitTradingLink(signal.symbol);

    // Determina se è un ordine condizionale basato su entry vs current price
    const orderInstructions = this.getOrderInstructions(signal);

    return `🐺 *GPT WOLF SIGNAL*

${direction} *${signal.symbol}*
💰 Entry: \`$${signal.entryPrice.toFixed(4)}\`
🎯 Target: \`$${signal.targetPrice.toFixed(4)}\`
🛡️ Stop Loss: \`$${signal.stopLoss.toFixed(4)}\`
⚡ Leverage: \`${leverage}\`
${orderTypeIcon} Order: \`${signal.orderType || 'Market'}\`
📊 R/R: \`${riskReward}\`
💸 Potential: \`+${potentialProfit}%\`

${orderInstructions}

⏰ *Creato:* ${signal.createdAt || new Date(signal.timestamp).toLocaleString('it-IT')}
📅 *Timeframe:* ${signal.timeframe || '1h'}
⌛ *Valido fino:* ${signal.expiresAt || 'N/A'}

📝 *Reason:*
\`${signal.reason}\`

🔗 [Apri su Bybit](${bybitUrl})

_Usa sempre gestione del rischio appropriata_`;
  }

  /**
   * Genera istruzioni per l'ordine basate sul tipo
   */
  private getOrderInstructions(signal: TradeSignal): string {
    if (signal.orderType === 'Conditional') {
      if (signal.direction === 'LONG') {
        return `⚠️ *ORDINE CONDIZIONALE*
📈 Attendi breakout sopra $${signal.entryPrice.toFixed(4)}
🎯 Entry automatico al trigger`;
      } else {
        return `⚠️ *ORDINE CONDIZIONALE*
📉 Attendi breakdown sotto $${signal.entryPrice.toFixed(4)}
🎯 Entry automatico al trigger`;
      }
    } else if (signal.orderType === 'Limit') {
      return `📋 *ORDINE LIMIT*
⏳ Entry a $${signal.entryPrice.toFixed(4)} quando disponibile`;
    } else if (signal.orderType === 'Market') {
      return `🚀 *ORDINE MARKET*
⚡ Entry immediato al prezzo corrente`;
    }

    return '';
  }

  /**
   * Calcola risk/reward ratio
   */
  private calculateRiskReward(signal: TradeSignal): string {
    const risk = Math.abs(signal.entryPrice - signal.stopLoss);
    const reward = Math.abs(signal.targetPrice - signal.entryPrice);
    const ratio = reward / risk;
    return `1:${ratio.toFixed(1)}`;
  }

  /**
   * Calcola potenziale profitto percentuale
   */
  private calculatePotentialProfit(signal: TradeSignal): string {
    const priceChange = signal.direction === 'LONG'
      ? (signal.targetPrice - signal.entryPrice) / signal.entryPrice
      : (signal.entryPrice - signal.targetPrice) / signal.entryPrice;

    const leveragedProfit = priceChange * signal.leverage * 100;
    return leveragedProfit.toFixed(1);
  }

  /**
   * Ottiene icona per tipo di ordine
   */
  private getOrderTypeIcon(orderType?: string): string {
    switch (orderType) {
      case 'Market': return '⚡';
      case 'Limit': return '🎯';
      case 'Conditional': return '🔄';
      case 'TWAP': return '📊';
      case 'Iceberg': return '🧊';
      default: return '⚡';
    }
  }

  /**
   * Genera link Bybit per trading diretto
   */
  private generateBybitTradingLink(symbol: string): string {
    return `https://www.bybit.com/trade/spot/${symbol}`;
  }

  /**
   * Testa connessione Telegram
   */
  async testConnection(): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseUrl}/getMe`);
      const data = await response.json();

      if (data.ok) {
        console.log(`[TELEGRAM] ✅ Bot connesso: ${data.result.username}`);
        return true;
      } else {
        console.error('[TELEGRAM] ❌ Errore connessione bot:', data.description);
        return false;
      }
    } catch (error) {
      console.error('[TELEGRAM] ❌ Errore test connessione:', error);
      return false;
    }
  }
}

/**
 * Factory per creare notifier Telegram
 */
export function createTelegramNotifier(): TelegramNotifier | null {
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;

  if (!botToken || !chatId) {
    console.warn('[TELEGRAM] ⚠️ Token o Chat ID mancanti. Notifiche disabilitate.');
    return null;
  }

  return new TelegramNotifier(botToken, chatId);
}
