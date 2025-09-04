// Core types for the application

/**
 * Dati di mercato in tempo reale
 */
export interface MarketData {
  symbol: string;
  price: number;
  timestamp: number;
}

/**
 * Dati di funding rate
 */
export interface FundingRate {
  symbol: string;
  rate: number;
  nextFundingTime: number;
}

/**
 * Dati di liquidazione
 */
export interface LiquidationData {
  symbol: string;
  side: string;
  price: number;
  quantity: number;
  timestamp: number;
}

/**
 * Dati CVD (Cumulative Volume Delta)
 */
export interface CVDData {
  symbol: string;
  delta: number;
  timestamp: number;
}

/**
 * Segnale di trading
 */
export interface TradeSignal {
  symbol: string;
  direction: 'LONG' | 'SHORT';
  entryPrice: number;
  targetPrice: number;
  stopLoss: number;
  leverage: number;
  reason: string;
  timestamp: number;
}

/**
 * Riepilogo dei dati di mercato per un contratto perpetuo
 */
export interface MarketSummary {
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

/**
 * Configurazione della strategia di trading
 */
export interface TradingStrategy {
  name: string;
  description: string;
  enabled: boolean;
  maxPositions: number;
  maxLeverage: number;
  minVolume: number;
  minFundingRate: number;
  minPriceChange: number;
  stopLossPercentage: number;
  takeProfitPercentage: number;
  riskPercentage: number;
}
