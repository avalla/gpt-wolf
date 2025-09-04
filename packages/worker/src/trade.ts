import { runMarketScan } from './scanner';
import * as dotenv from 'dotenv';
import { RestClientV5 } from 'bybit-api';
import path from 'path';
import fs from 'fs';
import { saveTradeSignal } from '@gpt-wolf/db';
import { createTelegramNotifier } from '@gpt-wolf/core';

// Carica variabili d'ambiente
dotenv.config();

// Configurazione API Bybit
const API_KEY = process.env.BYBIT_API_KEY || '';
const API_SECRET = process.env.BYBIT_API_SECRET || '';
const USE_TESTNET = process.env.TESTNET === 'true';
const MAX_CONCURRENT_POSITIONS = parseInt(process.env.MAX_CONCURRENT_POSITIONS || '5');

// Crea client Bybit
const client = new RestClientV5({
  key: API_KEY,
  secret: API_SECRET,
  testnet: USE_TESTNET,
});

/**
 * Esegue una scansione completa del mercato, genera segnali di trading
 * e li salva in SQLite
 */
async function runTradingSystem() {
  console.log('🐺 GPT-Wolf Trading System');
  console.log('==========================');

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

    // Limita il numero di segnali al massimo consentito
    const limitedSignals = uniqueSignals.slice(0, MAX_CONCURRENT_POSITIONS);

    // 4. Mostra e salva i segnali
    console.log(`\n✅ Generati ${limitedSignals.length} segnali di trading:`);
    console.log('='.repeat(80));
    console.log('SIMBOLO'.padEnd(12) + 'DIREZIONE'.padEnd(10) + 'PREZZO'.padEnd(12) +
                'TARGET'.padEnd(12) + 'STOP'.padEnd(12) + 'LEVA'.padEnd(8) + 'MOTIVO');
    console.log('-'.repeat(80));

    for (const signal of limitedSignals) {
      console.log(
        signal.symbol.padEnd(12) +
        signal.direction.padEnd(10) +
        signal.entryPrice.toFixed(4).padEnd(12) +
        signal.targetPrice.toFixed(4).padEnd(12) +
        signal.stopLoss.toFixed(4).padEnd(12) +
        `${signal.leverage}x`.padEnd(8) +
        signal.reason
      );

    }

    console.log('='.repeat(80));
    console.log('\n✅ Sistema di trading completato');

    // Calcola il potenziale profitto se tutti i segnali raggiungono il target
    const potentialProfit = limitedSignals.reduce((total, signal) => {
      const profitPercentage = signal.direction === 'LONG'
        ? (signal.targetPrice - signal.entryPrice) / signal.entryPrice * 100 * signal.leverage
        : (signal.entryPrice - signal.targetPrice) / signal.entryPrice * 100 * signal.leverage;
      return total + profitPercentage;
    }, 0);

    console.log(`\n💸 Profitto potenziale: ${potentialProfit.toFixed(2)}%`);

    // Calcola il rischio massimo se tutti i segnali raggiungono lo stop loss
    const maxRisk = limitedSignals.reduce((total, signal) => {
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

runTradingSystem();
