// Re-export from db package
export * from '@gpt-wolf/db';

export interface TradeSignal {
  symbol: string;
  direction: 'LONG' | 'SHORT';
  entryPrice: number;
  targetPrice: number;
  stopLoss: number;
  leverage: number;
  orderType: 'Market' | 'Limit' | 'Conditional' | 'TWAP' | 'Iceberg';
  reason: string;
  timestamp: number;
  timeframe: string; // Timeframe di riferimento (1m, 5m, 15m, 1h, 4h, 1d)
  validUntil: number; // Timestamp fino a quando il segnale è valido
  createdAt: string; // Data/ora leggibile di creazione
  expiresAt: string; // Data/ora leggibile di scadenza
  confidence: number; // 0-100%
  urgency: 'LOW' | 'MEDIUM' | 'HIGH';
}

export interface StrategyConfig {
  defaultLeverage: number;
  maxLeverage: number;
  riskPercentage: number;
}

export interface LiquidationData {
  symbol: string;
  side: 'Buy' | 'Sell';
  price: number;
  qty: number;
  timestamp: number;
}

export interface FundingAnalysis {
  symbol: string;
  currentRate: number;
  avgRate: number;
  isExtreme: boolean;
  direction: 'BULLISH' | 'BEARISH';
  nextFunding: number;
}
