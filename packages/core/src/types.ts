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
 * Tipologie di ordine disponibili
 */
export type OrderType = 'Market' | 'Limit' | 'Conditional' | 'TWAP' | 'Iceberg';

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
  orderType: OrderType;
  reason: string;
  timestamp: number;
  timeframe: string; // Timeframe di riferimento (1m, 5m, 15m, 1h, 4h, 1d)
  validUntil: number; // Timestamp fino a quando il segnale è valido
  createdAt: string; // Data/ora leggibile di creazione
  expiresAt: string; // Data/ora leggibile di scadenza
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
