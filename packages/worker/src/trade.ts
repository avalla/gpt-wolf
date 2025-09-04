import { runMarketScan } from './scanner';
import * as dotenv from 'dotenv';
import { RestClientV5 } from 'bybit-api';
import path from 'path';
import fs from 'fs';
import { saveTradeSignal, getActiveTradeSignals } from '@gpt-wolf/db';
import { createTelegramNotifier } from '@gpt-wolf/core';

// Carica variabili d'ambiente
dotenv.config();

// Configurazione API Bybit
const API_KEY = process.env.BYBIT_API_KEY || '';
const API_SECRET = process.env.BYBIT_API_SECRET || '';
const USE_TESTNET = process.env.TESTNET === 'true';

// Crea client Bybit
const client = new RestClientV5({
  key: API_KEY,
  secret: API_SECRET,
  testnet: USE_TESTNET,
});

/**
 * Mostra tutti i segnali attivi dal database
 */
function showActiveSignals(): void {
  try {
    const activeSignals = getActiveTradeSignals();

    if (activeSignals.length === 0) {
      console.log('\n📊 Nessun segnale attivo nel database');
      return;
    }

    console.log(`\n📊 Segnali attivi nel database (${activeSignals.length}):`);
    console.log('='.repeat(100));
    console.log('SIMBOLO'.padEnd(12) + 'DIREZIONE'.padEnd(10) + 'PREZZO'.padEnd(12) +
      'TARGET'.padEnd(12) + 'STOP'.padEnd(12) + 'LEVA'.padEnd(8) + 'ORDINE'.padEnd(12) + 'TIMEFRAME'.padEnd(10) + 'MOTIVO');
    console.log('-'.repeat(100));

    for (const signal of activeSignals) {
      console.log(
        signal.symbol.padEnd(12) +
        signal.direction.padEnd(10) +
        signal.entryPrice.toFixed(4).padEnd(12) +
        signal.targetPrice.toFixed(4).padEnd(12) +
        signal.stopLoss.toFixed(4).padEnd(12) +
        `${signal.leverage}x`.padEnd(8) +
        (signal.orderType || 'Market').padEnd(12) +
        (signal.timeframe || '15m').padEnd(10) +
        signal.reason
      );
    }
    console.log('='.repeat(100));
  } catch (error) {
    console.error('❌ Errore nel recupero segnali attivi:', error);
  }
}

/**
 * Esegue una scansione completa del mercato, genera segnali di trading
 * e li salva in SQLite
 */
async function runTradingSystem() {
  console.log('🐺 GPT-Wolf Trading System');
  console.log('==========================');

  // Mostra segnali attivi esistenti
  showActiveSignals();

  try {
    // 1. Esegui scansione del mercato
    console.log('🔍 Scansione mercato in corso...');
    const markets = await runMarketScan();

    // 2. Importa dinamicamente i moduli delle strategie
    const strategiesPath = path.resolve(__dirname, '../../strategies/src');

    // Verifica che i percorsi esistano
    if (!fs.existsSync(strategiesPath)) {
      console.error(`❌ Percorso strategie non trovato: ${strategiesPath}`);
      return;
    }

    // --- IMPORT DINAMICO DI TUTTE LE STRATEGIE ---
    async function importAllStrategies(strategiesPath: string) {
      const files = fs.readdirSync(strategiesPath)
        .filter(f => f.endsWith('.ts') && !f.startsWith('index') && !f.includes('test') && !f.includes('demo')); // Esclude file di test
      const strategies = [];
      for (const file of files) {
        const mod = await import(path.join(strategiesPath, file));
        Object.entries(mod).forEach(([name, fn]) => {
          if (typeof fn === 'function' && name.endsWith('Strategy')) {
            strategies.push(fn);
          }
        });
      }
      return strategies;
    }

    const allStrategies = await importAllStrategies(strategiesPath);

    // Configurazione delle strategie
    const config = {
      defaultLeverage: parseInt(process.env.DEFAULT_LEVERAGE || '50'),
      maxLeverage: parseInt(process.env.MAX_LEVERAGE || '100'),
      riskPercentage: parseFloat(process.env.RISK_PERCENTAGE || '5'),
    };

    // 3. Genera segnali di trading
    console.log('\n💰 Generazione segnali di trading...');

    const enabledStrategies = (process.env.STRATEGIES || '').split(',').map(s => s.trim().toLowerCase()).filter(Boolean);
    if (enabledStrategies.length > 0) {
      console.log(`⚙️  Eseguo solo strategie: ${enabledStrategies.join(', ')}`);
    }

    let signals: any[] = [];
    for (const strategy of allStrategies) {
      const strategyName = strategy.name.replace(/Strategy$/, '').toLowerCase();
      if (enabledStrategies.length > 0 && !enabledStrategies.includes(strategyName)) continue;
      try {
        const s = strategy(markets, config);
        if (Array.isArray(s)) signals.push(...s);
        else if (s) signals.push(s);
      } catch (err) {
        console.error(`Errore nella strategia ${strategy.name}:`, err);
      }
    }

    if (signals.length > 0) {
      console.log('\n==================== SEGNALI GENERATI ====================');

      // Inizializza Telegram notifier
      const telegramNotifier = createTelegramNotifier();

      for (const signal of signals) {
        console.log(`📊 Segnale: ${signal.symbol} ${signal.direction} - Entry: $${signal.entryPrice} - Target: $${signal.targetPrice} - SL: $${signal.stopLoss} - Leva: ${signal.leverage}x`);
        console.log(`💡 Motivo: ${signal.reason}`);

        // Salva su SQLite (storage primario)
        saveTradeSignal(signal);
        console.log(`💾 Segnale ${signal.symbol} salvato su database`);

        // Invia notifica Telegram (solo notifica, non storage)
        if (telegramNotifier) {
          const sent = await telegramNotifier.sendTradingSignal(signal);
          if (sent) {
            console.log(`📱 Notifica ${signal.symbol} inviata su Telegram`);
          } else {
            console.error(`❌ Errore notifica ${signal.symbol} su Telegram`);
          }
        }
      }

      console.log('==========================================================\n');
      console.log(`🟢 Salvati ${signals.length} segnali su SQLite`);
    } else {
      console.log('\n[Nessun segnale generato in questa scansione]\n');
    }

    // Rimuovi duplicati (stesso simbolo e direzione)
    const uniqueSignals = signals.reduce((acc, signal) => {
      const exists = acc.some(s =>
        s.symbol === signal.symbol && s.direction === signal.direction
      );

      if (!exists) {
        acc.push(signal);
      } else {
        // Se esiste già, mantieni quello con la leva più alta
        const index = acc.findIndex(s =>
          s.symbol === signal.symbol && s.direction === signal.direction
        );

        if (index >= 0 && acc[index].leverage < signal.leverage) {
          acc[index] = signal;
        }
      }

      return acc;
    }, []);

    // 4. Mostra TUTTI i segnali generati
    console.log(`\n✅ Generati ${uniqueSignals.length} segnali di trading:`);
    console.log('='.repeat(100));
    console.log('SIMBOLO'.padEnd(12) + 'DIREZIONE'.padEnd(10) + 'PREZZO'.padEnd(12) +
      'TARGET'.padEnd(12) + 'STOP'.padEnd(12) + 'LEVA'.padEnd(8) + 'ORDINE'.padEnd(12) + 'TIMEFRAME'.padEnd(10) + 'MOTIVO');
    console.log('-'.repeat(100));

    // Mostra tutti i segnali generati
    for (const signal of uniqueSignals) {
      console.log(
        signal.symbol.padEnd(12) +
        signal.direction.padEnd(10) +
        signal.entryPrice.toFixed(4).padEnd(12) +
        signal.targetPrice.toFixed(4).padEnd(12) +
        signal.stopLoss.toFixed(4).padEnd(12) +
        `${signal.leverage}x`.padEnd(8) +
        (signal.orderType || 'Market').padEnd(12) +
        (signal.timeframe || '15m').padEnd(10) +
        signal.reason
      );
    }

    console.log('='.repeat(100));
    console.log('\n✅ Sistema di trading completato');

    // Calcola il potenziale profitto se tutti i segnali raggiungono il target
    const potentialProfit = uniqueSignals.reduce((total, signal) => {
      const profitPercentage = signal.direction === 'LONG'
        ? (signal.targetPrice - signal.entryPrice) / signal.entryPrice * 100 * signal.leverage
        : (signal.entryPrice - signal.targetPrice) / signal.entryPrice * 100 * signal.leverage;
      return total + profitPercentage;
    }, 0);

    console.log(`\n💸 Profitto potenziale: ${potentialProfit.toFixed(2)}%`);

    // Calcola il rischio massimo se tutti i segnali raggiungono lo stop loss
    const maxRisk = uniqueSignals.reduce((total, signal) => {
      const riskPercentage = signal.direction === 'LONG'
        ? (signal.entryPrice - signal.stopLoss) / signal.entryPrice * 100 * signal.leverage
        : (signal.stopLoss - signal.entryPrice) / signal.entryPrice * 100 * signal.leverage;
      return total + riskPercentage;
    }, 0);

    console.log(`\n⚠️ Rischio massimo: ${maxRisk.toFixed(2)}%`);

    // Fix: controllo NaN e divisione per zero
    let riskReward;
    if (!isFinite(potentialProfit) || !isFinite(maxRisk) || maxRisk === 0) {
      console.warn("⚠️ Valori non validi per rischio/rendimento. Debug:", { potentialProfit, maxRisk });
      riskReward = 'N/A';
    } else {
      riskReward = (potentialProfit / maxRisk).toFixed(2);
    }
    console.log(`\n📊 Rapporto rischio/rendimento: ${riskReward}`);
  } catch (error) {
    console.error('❌ Errore nel sistema di trading:', error);
  }
}

/**
 * Recupera informazioni sui simboli da Bybit per validare leve disponibili
 */
async function getSymbolInfo(symbol: string): Promise<any> {
  try {
    const instrumentInfo = await client.getInstrumentsInfo({
      category: 'linear',
      symbol: symbol
    });

    return instrumentInfo.result?.list?.[0] || null;
  } catch (error) {
    console.error(`❌ Errore recupero info simbolo ${symbol}:`, error);
    return null;
  }
}

/**
 * Valida e corregge la leva per un simbolo specifico
 */
async function validateAndAdjustLeverage(symbol: string, requestedLeverage: number): Promise<number> {
  try {
    const symbolInfo = await getSymbolInfo(symbol);

    if (!symbolInfo) {
      console.warn(`⚠️ Info simbolo ${symbol} non disponibili, uso leva ${requestedLeverage}x`);
      return requestedLeverage;
    }

    const maxLeverage = parseFloat(symbolInfo.leverageFilter?.maxLeverage || '100');
    const minLeverage = parseFloat(symbolInfo.leverageFilter?.minLeverage || '1');

    if (requestedLeverage > maxLeverage) {
      console.warn(`⚠️ Leva ${requestedLeverage}x troppo alta per ${symbol}, uso max ${maxLeverage}x`);
      return maxLeverage;
    }

    if (requestedLeverage < minLeverage) {
      console.warn(`⚠️ Leva ${requestedLeverage}x troppo bassa per ${symbol}, uso min ${minLeverage}x`);
      return minLeverage;
    }

    console.log(`✅ Leva ${requestedLeverage}x valida per ${symbol} (range: ${minLeverage}x-${maxLeverage}x)`);
    return requestedLeverage;
  } catch (error) {
    console.error(`❌ Errore validazione leva per ${symbol}:`, error);
    return requestedLeverage;
  }
}

/**
 * Apre una posizione su Bybit
 */
async function openBybitPosition(signal: any): Promise<boolean> {
  try {
    // Controlla se esiste già una posizione
    const hasPosition = await hasExistingPosition(signal.symbol);
    if (hasPosition) {
      console.log(`⚠️ Posizione già esistente per ${signal.symbol}, skip apertura`);
      return false;
    }

    // Valida e correggi la leva per questo simbolo
    const validatedLeverage = await validateAndAdjustLeverage(signal.symbol, signal.leverage);

    const capital = parseFloat(process.env.TRADING_CAPITAL || '1000');
    const orderSize = calculateOrderSize(capital, validatedLeverage, signal.entryPrice);

    // Imposta leva validata
    await client.setLeverage({
      category: 'linear',
      symbol: signal.symbol,
      buyLeverage: validatedLeverage.toString(),
      sellLeverage: validatedLeverage.toString()
    });

    // Apri posizione market
    const orderResult = await client.submitOrder({
      category: 'linear',
      symbol: signal.symbol,
      side: signal.direction === 'LONG' ? 'Buy' : 'Sell',
      orderType: 'Market',
      qty: orderSize.toString(),
      timeInForce: 'IOC'
    });

    if (orderResult.retCode === 0) {
      console.log(`✅ Posizione aperta: ${signal.symbol} ${signal.direction} - Size: ${orderSize} - Leva: ${validatedLeverage}x`);

      // Imposta stop loss e take profit
      await setStopLossAndTakeProfit(signal, orderResult.result?.orderId);

      return true;
    } else {
      console.error(`❌ Errore apertura posizione ${signal.symbol}:`, orderResult.retMsg);
      return false;
    }
  } catch (error) {
    console.error(`❌ Errore critico apertura ${signal.symbol}:`, error);
    return false;
  }
}

/**
 * Calcola la size dell'ordine basata sul capitale e leva
 */
function calculateOrderSize(capital: number, leverage: number, entryPrice: number, riskPercentage: number = 5): number {
  const riskAmount = capital * (riskPercentage / 100);
  const positionValue = riskAmount * leverage;
  return Number((positionValue / entryPrice).toFixed(6));
}

/**
 * Verifica se esiste già una posizione aperta per il simbolo
 */
async function hasExistingPosition(symbol: string): Promise<boolean> {
  try {
    const positions = await client.getPositionInfo({
      category: 'linear',
      symbol: symbol
    });
    
    return positions.result?.list?.some(pos => 
      parseFloat(pos.size) > 0
    ) || false;
  } catch (error) {
    console.error(`❌ Errore controllo posizione ${symbol}:`, error);
    return false;
  }
}

/**
 * Avvia il sistema di trading con scansioni automatiche continue
 */
async function startTradingBot(): Promise<void> {
  console.log('🚀 Avvio GPT Wolf Trading Bot...');
  console.log('⏰ Scansioni automatiche ogni 5 minuti');

  // Prima scansione immediata
  await runTradingSystem();

  // Scansioni automatiche ogni 5 minuti
  const SCAN_INTERVAL = 5 * 60 * 1000; // 5 minuti in millisecondi

  setInterval(async () => {
    console.log('\n🔄 Avvio nuova scansione automatica...');
    console.log(`⏰ ${new Date().toLocaleString('it-IT')}`);
    await runTradingSystem();
  }, SCAN_INTERVAL);

  // Mantieni il processo attivo
  process.on('SIGINT', () => {
    console.log('\n🛑 Arresto GPT Wolf Trading Bot...');
    process.exit(0);
  });
}

/**
 * Imposta stop loss e take profit
 */
async function setStopLossAndTakeProfit(signal: any, orderId?: string): Promise<void> {
  try {
    // Attendi un momento per assicurarsi che la posizione sia aperta
    await new Promise(resolve => setTimeout(resolve, 1000));

    await client.setTradingStop({
      category: 'linear',
      symbol: signal.symbol,
      stopLoss: signal.stopLoss.toString(),
      takeProfit: signal.targetPrice.toString(),
      tpTriggerBy: 'LastPrice',
      slTriggerBy: 'LastPrice'
    });

    console.log(`🎯 SL/TP impostati per ${signal.symbol}: SL=${signal.stopLoss} TP=${signal.targetPrice}`);
  } catch (error) {
    console.error(`❌ Errore impostazione SL/TP per ${signal.symbol}:`, error);
  }
}

// Avvia il bot con scansioni automatiche
startTradingBot();
