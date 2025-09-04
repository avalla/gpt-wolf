// Tipi condivisi
export * from './types';

// Analyzer modules
export * from './funding-analyzer';
export * from './liquidation-analyzer';
export * from './technical-analyzer';

// Strategie
export * from './aggressive';
export * from './volume';

import * as dotenv from 'dotenv';

// Carica variabili d'ambiente
dotenv.config();

// Definizione dei tipi
interface MarketSummary {
  symbol: string;
  price: number;
  volume24h: number;
  change24h: number;
  fundingRate: number;
  nextFundingTime: number;
  openInterest: number;
  liquidations24h?: {
    buyQty: number;
    sellQty: number;
    total: number;
  };
}

interface TradeSignal {
  symbol: string;
  direction: 'LONG' | 'SHORT';
  entryPrice: number;
  targetPrice: number;
  stopLoss: number;
  leverage: number;
  reason: string;
  timestamp: number;
}

interface StrategyConfig {
  defaultLeverage: number;
  maxLeverage: number;
  riskPercentage: number;
  maxConcurrentPositions: number;
}

// Configurazione generale delle strategie
const config: StrategyConfig = {
  defaultLeverage: parseInt(process.env.DEFAULT_LEVERAGE || '50'),
  maxLeverage: parseInt(process.env.MAX_LEVERAGE || '100'),
  riskPercentage: parseFloat(process.env.RISK_PERCENTAGE || '5'),
  maxConcurrentPositions: parseInt(process.env.MAX_CONCURRENT_POSITIONS || '5'),
};

/**
 * Genera segnali di trading applicando tutte le strategie disponibili
 */
export function generateTradeSignals(
  markets: MarketSummary[], 
): TradeSignal[] {
  // Importa le strategie
  const { momentumStrategy } = require('./momentum');
  const { fundingRateStrategy } = require('./funding');
  const { liquidationHuntingStrategy } = require('./liquidation');
  const { volumeAnomalyStrategy } = require('./volume');
  const { ultraAggressiveStrategy } = require('./aggressive');
  
  // Applica tutte le strategie
  const signals = [
    ...momentumStrategy(markets, config),
    ...fundingRateStrategy(markets, config),
    ...liquidationHuntingStrategy(markets, config),
    ...volumeAnomalyStrategy(markets, config),
    ...ultraAggressiveStrategy(markets, config)
  ];
  
  // Rimuovi duplicati (stesso simbolo e direzione)
  const uniqueSignals = signals.reduce((acc, signal) => {
    const exists = acc.some((s: TradeSignal) => 
      s.symbol === signal.symbol && s.direction === signal.direction
    );
    
    if (!exists) {
      acc.push(signal);
    } else {
      // Se esiste già, mantieni quello con la leva più alta
      const index = acc.findIndex((s: TradeSignal) => 
        s.symbol === signal.symbol && s.direction === signal.direction
      );
      
      if (index >= 0 && acc[index].leverage < signal.leverage) {
        acc[index] = signal;
      }
    }
    
    return acc;
  }, [] as TradeSignal[]);
  
  // Limita il numero di segnali al massimo consentito
  return uniqueSignals.slice(0, config.maxConcurrentPositions);
}
