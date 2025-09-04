import { WebsocketClient } from 'bybit-api';
import { CVDData, FundingRate, LiquidationData, MarketData } from "@gpt-wolf/core";
import * as dotenv from "dotenv";
import { MarketSummary, TradeSignal, StrategyConfig } from "@gpt-wolf/db";
import { generateTradeSignals } from "@gpt-wolf/strategies";

// Carica variabili d'ambiente
dotenv.config();

// Controllo sicurezza variabili ambiente
if (!process.env.BYBIT_API_KEY || !process.env.BYBIT_API_SECRET) {
  throw new Error('Bybit API KEY o SECRET mancanti: controlla il file .env');
}

// Placeholder per la configurazione
const config = {
  mainSymbols: ["BTCUSDT", "ETHUSDT", "SOLUSDT"],
  apiKey: process.env.BYBIT_API_KEY || "",
  apiSecret: process.env.BYBIT_API_SECRET || "",
  testnet: process.env.TESTNET === "true"
};

// Client Bybit
const wsClient = new WebSocketClient({
  key: config.apiKey,
  secret: config.apiSecret,
  testnet: config.testnet,
  market: "v5"
});

const restClient = new RestClientV5({
  key: config.apiKey,
  secret: config.apiSecret,
  testnet: config.testnet,
  recv_window: 5000
});

// Configurazione strategie (puoi parametrizzare via .env)
const strategyEngineConfig: EngineConfig = {
  enabledStrategies: [
    "cvd-reversal",
    "hedging-volumetrico",
    "liquidation-hunt",
    "funding-momentum",
    "news-momentum-scalping"
  ],
  strategyConfig: {
    defaultLeverage: Number(process.env.DEFAULT_LEVERAGE) || 50,
    maxLeverage: 100,
    riskPercentage: Number(process.env.RISK_PERCENTAGE) || 2,
    // aggiungi qui altri parametri custom per le strategie se necessario
  }
};
const strategyEngine = new StrategyEngine(strategyEngineConfig);

// Stato di mercato aggregato per simbolo
const marketState: Record<string, Partial<MarketSummary>> = {};

// In-memory gestione posizioni attive
interface AdvancedPosition {
  direction: 'LONG' | 'SHORT';
  orderId: string;
  entryPrice: number;
  targetPrice?: number;
  stopLoss?: number;
  trailingStop?: number;
  openTime: number;
  maxFavorablePrice?: number;
  liquidationPrice?: number;
  inactivityTimeoutMs?: number;
  leverage: number;
}

const activePositions: Record<string, AdvancedPosition[]> = {};

// Variabile temporanea per segnale opposto
let lastSignals: Record<string, 'LONG' | 'SHORT' | undefined> = {};

// Utility per calcolo liquidazione Bybit (approssimato, va raffinato per cross/isolated)
function calcLiquidationPrice(entry: number, leverage: number, direction: 'LONG' | 'SHORT', mmr = 0.005): number {
  // mmr: maintenance margin ratio (Bybit default 0.5%)
  if (direction === 'LONG') return entry * (1 - 1 / leverage + mmr);
  return entry * (1 + 1 / leverage - mmr);
}

// Funzione di monitoraggio posizioni attive e chiusura automatica
async function monitorActivePositions(marketUpdates: Record<string, Partial<MarketSummary>>) {
  const now = Date.now();
  for (const symbol of Object.keys(activePositions)) {
    for (const pos of [...activePositions[symbol]]) {
      const mkt = marketUpdates[symbol];
      if (!mkt || !mkt.price) continue;
      // Trailing stop
      updateTrailingStop(pos, mkt, 0.003);
      // Take profit
      if (pos.direction === 'LONG' && mkt.price >= (pos.targetPrice || 0)) {
        await closePosition(symbol, 'LONG', 'take_profit', mkt.price);
        continue;
      } else if (pos.direction === 'SHORT' && mkt.price <= (pos.targetPrice || 0)) {
        await closePosition(symbol, 'SHORT', 'take_profit', mkt.price);
        continue;
      }
      // Stop loss (statico o trailing)
      if (pos.direction === 'LONG' && mkt.price <= (pos.stopLoss || 0)) {
        await closePosition(symbol, 'LONG', 'stop_loss', mkt.price);
        continue;
      } else if (pos.direction === 'SHORT' && mkt.price >= (pos.stopLoss || 0)) {
        await closePosition(symbol, 'SHORT', 'stop_loss', mkt.price);
        continue;
      }
      // Chiusura su segnale opposto
      if (lastSignals[symbol] && lastSignals[symbol] !== pos.direction) {
        await closePosition(symbol, pos.direction, 'opposite_signal', mkt.price);
        continue;
      }
      // Liquidazione imminente (pre-liquidation)
      pos.liquidationPrice = calcLiquidationPrice(pos.entryPrice, pos.leverage, pos.direction);
      const liquidationBuffer = 0.003; // 0.3% sopra la liquidazione
      if (
        (pos.direction === 'LONG' && mkt.price <= (pos.liquidationPrice! * (1 + liquidationBuffer))) ||
        (pos.direction === 'SHORT' && mkt.price >= (pos.liquidationPrice! * (1 - liquidationBuffer)))
      ) {
        await closePosition(symbol, pos.direction, 'pre_liquidation', mkt.price);
        continue;
      }
      // News spike/volatilità anomala (esempio: variazione > 2% in 1 min)
      if (mkt.change1m && Math.abs(mkt.change1m) > 0.02) {
        await closePosition(symbol, pos.direction, 'volatility_spike', mkt.price);
        continue;
      }
      // Cluster liquidazioni improvvisi (mock: liquidations24h.total > soglia)
      if (mkt.liquidations24h && mkt.liquidations24h.total > 5000000) {
        await closePosition(symbol, pos.direction, 'liquidation_cluster', mkt.price);
        continue;
      }
      // Inattività/timeout
      pos.openTime = pos.openTime || now;
      const timeout = pos.inactivityTimeoutMs || 30 * 60 * 1000; // default 30 min
      if (now - pos.openTime > timeout) {
        await closePosition(symbol, pos.direction, 'timeout', mkt.price);
        continue;
      }
      // Aggiorna max favorevole
      if (
        (pos.direction === 'LONG' && (!pos.maxFavorablePrice || mkt.price > pos.maxFavorablePrice)) ||
        (pos.direction === 'SHORT' && (!pos.maxFavorablePrice || mkt.price < pos.maxFavorablePrice))
      ) {
        pos.maxFavorablePrice = mkt.price;
      }
      // TODO: trailing stop dinamico avanzato su maxFavorablePrice
    }
  }
}

// Trailing stop: aggiorna dinamicamente lo SL se il prezzo va a favore
function updateTrailingStop(pos: AdvancedPosition, mkt: Partial<MarketSummary>, trailingPerc = 0.003) {
  if (!mkt.price || !pos.entryPrice) return;
  if (pos.direction === 'LONG') {
    const newSL = mkt.price * (1 - trailingPerc);
    if (!pos.trailingStop || newSL > pos.trailingStop) {
      pos.trailingStop = newSL;
      pos.stopLoss = Math.max(pos.stopLoss || 0, newSL);
    }
  } else if (pos.direction === 'SHORT') {
    const newSL = mkt.price * (1 + trailingPerc);
    if (!pos.trailingStop || newSL < pos.trailingStop) {
      pos.trailingStop = newSL;
      pos.stopLoss = Math.min(pos.stopLoss || Infinity, newSL);
    }
  }
}

// Inizializzazione
async function main() {
  console.log("🐺 GPT-Wolf trading bot avviato");
  console.log(`📊 Monitoraggio simboli: ${config.mainSymbols.join(", ")}`);
  
  // Sottoscrizione ai websocket
  wsClient.subscribe(config.mainSymbols.map(symbol => `tickers.${symbol}`));
  wsClient.subscribe(config.mainSymbols.map(symbol => `liquidation.${symbol}`));
  
  // Event handlers
  wsClient.on("update", handleWebSocketUpdate);
  wsClient.on("response", (response) => console.log("WS response:", response));
  wsClient.on("error", (err) => console.error("WS error:", err));
  
  // Polling per funding rate (non disponibile via websocket)
  setInterval(fetchFundingRates, 60000); // ogni minuto
}

// Handler per aggiornamenti WebSocket
function handleWebSocketUpdate(update: any) {
  if (update.topic?.startsWith("tickers.")) {
    const symbol = update.topic.split(".")[1];
    const data = update.data;
    marketState[symbol] = {
      ...marketState[symbol],
      symbol,
      price: parseFloat(data.lastPrice),
      // aggiungi qui altri dati se disponibili
    };
    console.log(`💹 ${symbol}: ${data.lastPrice}`);
  } else if (update.topic?.startsWith("liquidation.")) {
    const symbol = update.topic.split(".")[1];
    const data = update.data;
    marketState[symbol] = {
      ...marketState[symbol],
      symbol,
      // puoi aggiungere liquidazioni24h o altri campi custom
    };
    console.log(`💥 Liquidazione ${data.side} su ${symbol}: ${data.size} @ ${data.price}`);
  }

  // Quando hai dati sufficienti, valuta le strategie
  for (const symbol of config.mainSymbols) {
    const mkt = marketState[symbol];
    if (mkt && mkt.price) {
      // Arricchisci con dati reali o mock per test
      const summary: MarketSummary = {
        symbol,
        price: mkt.price!,
        volume24h: mkt.volume24h || 0,
        change24h: mkt.change24h || 0,
        fundingRate: mkt.fundingRate || 0,
        nextFundingTime: mkt.nextFundingTime || 0,
        openInterest: mkt.openInterest || 0,
        liquidations24h: mkt.liquidations24h,
      };
      const signals = strategyEngine.evaluate(summary);
      for (const [strategy, signal] of Object.entries(signals)) {
        if (signal) {
          const sig = signal as TradeSignal;
          activePositions[symbol] = activePositions[symbol] || [];
          const alreadyActive = activePositions[symbol].some(p => p.direction === sig.direction);
          if (alreadyActive) {
            console.log(`⚠️ Posizione già attiva ${sig.direction} su ${symbol}, skip segnale ${strategy}`);
            continue;
          }
          lastSignals[symbol] = sig.direction;
          // Esegui ordine reale
          const orderResult = executeTrade(sig);
          orderResult.then(result => {
            if (result.success && result.orderId) {
              activePositions[symbol].push({ 
                direction: sig.direction, 
                orderId: result.orderId, 
                entryPrice: sig.entryPrice, 
                targetPrice: sig.targetPrice, 
                stopLoss: sig.stopLoss, 
                leverage: sig.leverage,
                openTime: Date.now()
              });
            } else {
              console.error(`❌ Errore ordine ${sig.symbol}:`, result.error || 'unknown');
            }
          });
        }
      }
    }
  }
  // Monitora posizioni attive
  monitorActivePositions(marketState);
}

// Funzione per eseguire ordini reali su Bybit
async function executeTrade(signal: TradeSignal): Promise<{ success: boolean, orderId?: string, error?: string }> {
  try {
    const side = signal.direction === 'LONG' ? 'Buy' : 'Sell';
    const order = await restClient.submitOrder({
      category: 'linear',
      symbol: signal.symbol,
      side,
      orderType: 'Market',
      qty: calculateOrderQty(signal),
      leverage: signal.leverage,
      reduceOnly: false,
      takeProfit: signal.targetPrice,
      stopLoss: signal.stopLoss,
      timeInForce: 'GoodTillCancel',
    });
    if (order.retCode === 0) {
      console.log(`✅ Ordine ${side} ${signal.symbol} eseguito. ID: ${order.result.orderId}`);
      return { success: true, orderId: order.result.orderId };
    } else {
      console.error(`❌ Errore ordine ${side} ${signal.symbol}:`, order.retMsg);
      return { success: false, error: order.retMsg };
    }
  } catch (err) {
    console.error(`❌ Exception ordine ${signal.symbol}:`, err);
    return { success: false, error: String(err) };
  }
}

// Funzione per calcolare la size dell'ordine
function calculateOrderQty(signal: TradeSignal): number {
  // Calcola la size in base al rischio e capitale (mock: usa size fissa per ora)
  // Puoi migliorare con equity reale e risk management
  return Number(process.env.DEFAULT_QTY) || 0.01;
}

// Funzione per chiusura posizione
async function closePosition(symbol: string, direction: 'LONG' | 'SHORT', closeReason: string, closePrice?: number) {
  activePositions[symbol] = activePositions[symbol] || [];
  const idx = activePositions[symbol].findIndex(p => p.direction === direction);
  if (idx === -1) {
    console.log(`Nessuna posizione attiva ${direction} su ${symbol} da chiudere.`);
    return;
  }
  const position = activePositions[symbol][idx];
  // Calcolo PnL (mock, da migliorare con size reale)
  const pnl = closePrice && position.entryPrice ? (direction === 'LONG'
    ? (closePrice - position.entryPrice)
    : (position.entryPrice - closePrice)) : null;
  // Rimuovi da in-memory
  activePositions[symbol].splice(idx, 1);
  console.log(`🚪 Posizione ${direction} su ${symbol} chiusa. Motivo: ${closeReason}${pnl !== null ? ` | PnL: ${pnl}` : ''}`);
}

// Fetch funding rates
async function fetchFundingRates() {
  try {
    const response = await restClient.getFundingRateHistory({
      category: "linear",
      symbol: config.mainSymbols[0] // Uno alla volta
    });
    
    if (response.retCode === 0 && response.result.list?.length > 0) {
      const data = response.result.list[0];
      const fundingRate: FundingRate = {
        symbol: config.mainSymbols[0],
        rate: parseFloat(data.fundingRate),
        nextFundingTime: parseInt(data.fundingTime)
      };
      
      console.log(`💰 Funding rate ${fundingRate.symbol}: ${(fundingRate.rate * 100).toFixed(4)}%`);
    }
  } catch (error) {
    console.error("Errore nel fetch funding rate:", error);
  }
}

// Avvio applicazione
main().catch(console.error);

// Esempio di utilizzo per chiusura automatica (puoi chiamare dove vuoi):
// await closePosition('BTCUSDT', 'LONG', 'take_profit', 70000);
