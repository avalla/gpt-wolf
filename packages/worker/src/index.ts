import { WebsocketClient, RestClientV5 } from 'bybit-api';
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
const wsClient = new WebsocketClient({
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

// Heartbeat per mostrare che il bot è attivo
let heartbeatCount = 0;
function showHeartbeat() {
  heartbeatCount++;
  const timestamp = new Date().toLocaleTimeString('it-IT');
  const activePositionsCount = Object.values(activePositions).flat().length;
  process.stdout.write(`\r💓 [${timestamp}] Bot attivo | Posizioni: ${activePositionsCount} | Heartbeat: ${heartbeatCount}`);
}

// Inizializzazione
async function main() {
  console.log("🐺 GPT-Wolf trading bot avviato");
  console.log(`📊 Monitoraggio simboli: ${config.mainSymbols.join(", ")}`);
  console.log(`🔗 Modalità: ${config.testnet ? 'TESTNET' : 'PRODUZIONE'}`);
  console.log(`⚡ Leverage default: ${strategyEngineConfig.strategyConfig.defaultLeverage}x`);
  console.log(`🎯 Risk per trade: ${strategyEngineConfig.strategyConfig.riskPercentage}%\n`);
  
  // Test connessione API
  console.log('🔍 Test connessione API...');
  try {
    const serverTime = await restClient.getServerTime();
    console.log(`✅ Connessione API OK - Server time: ${new Date(Number(serverTime.result.timeNow)).toLocaleString('it-IT')}`);
  } catch (error) {
    console.error('❌ Errore connessione API:', error);
    process.exit(1);
  }
  
  // Sottoscrizione ai websocket
  console.log('📡 Connessione WebSocket...');
  wsClient.subscribe(config.mainSymbols.map(symbol => `tickers.${symbol}`));
  wsClient.subscribe(config.mainSymbols.map(symbol => `liquidation.${symbol}`));
  
  // Event handlers
  wsClient.on("update", handleWebSocketUpdate);
  wsClient.on("response", (response) => {
    console.log(`\n📨 WS Response: ${JSON.stringify(response)}`);
  });
  wsClient.on("error", (err) => {
    console.error(`\n❌ WS Error: ${err}`);
  });
  wsClient.on('open', () => {
    console.log('✅ WebSocket connesso\n');
  });
  
  // Heartbeat ogni 10 secondi
  setInterval(showHeartbeat, 10000);
  
  // Polling per funding rate (non disponibile via websocket)
  setInterval(fetchFundingRates, 60000); // ogni minuto
  
  // Status report ogni 5 minuti
  setInterval(showStatusReport, 5 * 60 * 1000);
}

// Handler per aggiornamenti WebSocket
function handleWebSocketUpdate(update: any) {
  const timestamp = new Date().toLocaleTimeString('it-IT');
  
  if (update.topic?.startsWith("tickers.")) {
    const symbol = update.topic.split(".")[1];
    const data = update.data;
    const oldPrice = marketState[symbol]?.price || 0;
    const newPrice = parseFloat(data.lastPrice);
    const priceChange = oldPrice > 0 ? ((newPrice - oldPrice) / oldPrice * 100) : 0;
    
    marketState[symbol] = {
      ...marketState[symbol],
      symbol,
      price: newPrice,
      volume24h: parseFloat(data.volume24h || '0'),
      change24h: parseFloat(data.price24hPcnt || '0') * 100,
    };
    
    const changeIcon = priceChange > 0 ? '📈' : priceChange < 0 ? '📉' : '➡️';
    const priceChangeStr = Math.abs(priceChange) > 0.01 ? ` (${priceChange > 0 ? '+' : ''}${priceChange.toFixed(2)}%)` : '';
    console.log(`\n💹 [${timestamp}] ${symbol}: $${newPrice}${priceChangeStr} ${changeIcon}`);
    
  } else if (update.topic?.startsWith("liquidation.")) {
    const symbol = update.topic.split(".")[1];
    const data = update.data;
    marketState[symbol] = {
      ...marketState[symbol],
      symbol,
    };
    
    const sideIcon = data.side === 'Buy' ? '🟢' : '🔴';
    const size = parseFloat(data.size);
    const sizeFormatted = size > 1000000 ? `${(size/1000000).toFixed(1)}M` : size > 1000 ? `${(size/1000).toFixed(1)}K` : size.toFixed(0);
    console.log(`\n💥 [${timestamp}] Liquidazione ${sideIcon} ${data.side} su ${symbol}: $${sizeFormatted} @ $${data.price}`);
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
            console.log(`\n⚠️ [${timestamp}] Posizione già attiva ${sig.direction} su ${symbol}, skip segnale ${strategy}`);
            continue;
          }
          
          console.log(`\n🎯 [${timestamp}] NUOVO SEGNALE ${strategy.toUpperCase()}`);
          console.log(`   📊 ${symbol} ${sig.direction} @ $${sig.entryPrice}`);
          console.log(`   🎯 Target: $${sig.targetPrice} | 🛡️ SL: $${sig.stopLoss}`);
          console.log(`   ⚡ Leverage: ${sig.leverage}x | 📝 ${sig.reason}`);
          
          lastSignals[symbol] = sig.direction;
          // Esegui ordine reale
          console.log(`   🔄 Esecuzione ordine in corso...`);
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
              console.log(`   ✅ Ordine eseguito! ID: ${result.orderId}`);
            } else {
              console.error(`   ❌ Errore ordine ${sig.symbol}:`, result.error || 'unknown');
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
    console.log(`\n⚠️ Nessuna posizione attiva ${direction} su ${symbol} da chiudere.`);
    return;
  }
  
  const position = activePositions[symbol][idx];
  const timestamp = new Date().toLocaleTimeString('it-IT');
  
  // Calcolo PnL dettagliato
  let pnlPercent = 0;
  let pnlIcon = '⚪';
  if (closePrice && position.entryPrice) {
    pnlPercent = direction === 'LONG'
      ? ((closePrice - position.entryPrice) / position.entryPrice * 100)
      : ((position.entryPrice - closePrice) / position.entryPrice * 100);
    pnlIcon = pnlPercent > 0 ? '🟢' : pnlPercent < 0 ? '🔴' : '⚪';
  }
  
  const duration = Math.round((Date.now() - position.openTime) / 60000);
  
  // Rimuovi da in-memory
  activePositions[symbol].splice(idx, 1);
  
  console.log(`\n🚪 [${timestamp}] POSIZIONE CHIUSA`);
  console.log(`   📊 ${symbol} ${direction} | Entry: $${position.entryPrice} | Exit: $${closePrice?.toFixed(4) || 'N/A'}`);
  console.log(`   💰 PnL: ${pnlIcon}${pnlPercent.toFixed(2)}% | ⏱️ Durata: ${duration}m`);
  console.log(`   📝 Motivo: ${closeReason}`);
}

// Status report periodico
function showStatusReport() {
  const timestamp = new Date().toLocaleString('it-IT');
  const totalPositions = Object.values(activePositions).flat().length;
  const symbolsWithPositions = Object.keys(activePositions).filter(s => activePositions[s].length > 0);
  
  console.log(`\n\n📋 === STATUS REPORT [${timestamp}] ===`);
  console.log(`🎯 Posizioni attive: ${totalPositions}`);
  console.log(`📊 Simboli monitorati: ${config.mainSymbols.length}`);
  console.log(`💹 Prezzi aggiornati: ${Object.keys(marketState).length}`);
  
  if (symbolsWithPositions.length > 0) {
    console.log(`\n🔥 POSIZIONI ATTIVE:`);
    symbolsWithPositions.forEach(symbol => {
      activePositions[symbol].forEach(pos => {
        const duration = Math.round((Date.now() - pos.openTime) / 60000);
        const currentPrice = marketState[symbol]?.price || 0;
        const pnl = currentPrice > 0 ? (pos.direction === 'LONG' 
          ? ((currentPrice - pos.entryPrice) / pos.entryPrice * 100)
          : ((pos.entryPrice - currentPrice) / pos.entryPrice * 100)) : 0;
        const pnlIcon = pnl > 0 ? '🟢' : pnl < 0 ? '🔴' : '⚪';
        
        console.log(`   ${symbol} ${pos.direction} | Entry: $${pos.entryPrice} | Current: $${currentPrice.toFixed(4)} | PnL: ${pnlIcon}${pnl.toFixed(2)}% | ${duration}m`);
      });
    });
  }
  console.log(`=======================================\n`);
}

// Fetch funding rates
async function fetchFundingRates() {
  try {
    for (const symbol of config.mainSymbols) {
      const response = await restClient.getFundingRateHistory({
        category: "linear",
        symbol
      });
      
      if (response.retCode === 0 && response.result.list?.length > 0) {
        const data = response.result.list[0];
        const rate = parseFloat(data.fundingRate);
        marketState[symbol] = {
          ...marketState[symbol],
          fundingRate: rate,
          nextFundingTime: parseInt(data.fundingTime)
        };
        
        if (Math.abs(rate) >= 0.0005) { // Solo se significativo
          const ratePercent = (rate * 100).toFixed(4);
          const nextFunding = new Date(parseInt(data.fundingTime)).toLocaleTimeString('it-IT');
          console.log(`\n💰 ${symbol} Funding: ${ratePercent}% (prossimo: ${nextFunding})`);
        }
      }
    }
  } catch (error) {
    console.error("\n❌ Errore nel fetch funding rate:", error);
  }
}

// Gestione graceful shutdown
process.on('SIGINT', () => {
  console.log('\n\n🛑 Shutdown richiesto dall\'utente...');
  console.log('📊 Chiusura posizioni attive...');
  
  const totalPositions = Object.values(activePositions).flat().length;
  if (totalPositions > 0) {
    console.log(`⚠️ ATTENZIONE: ${totalPositions} posizioni ancora aperte!`);
    Object.keys(activePositions).forEach(symbol => {
      activePositions[symbol].forEach(pos => {
        console.log(`   ${symbol} ${pos.direction} @ $${pos.entryPrice}`);
      });
    });
  }
  
  console.log('✅ GPT-Wolf terminato.');
  process.exit(0);
});

// Avvio applicazione
console.log('🚀 Avvio GPT-Wolf...');
main().catch((error) => {
  console.error('💥 Errore fatale:', error);
  process.exit(1);
});

// Esempio di utilizzo per chiusura automatica (puoi chiamare dove vuoi):
// await closePosition('BTCUSDT', 'LONG', 'take_profit', 70000);
