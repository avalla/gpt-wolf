// Re-export from db package
export * from '@gpt-wolf/db';

export interface TradeSignal {
  symbol: string;
  direction: 'LONG' | 'SHORT';
  entryPrice: number;
  targetPrice: number;
  stopLoss: number;
  leverage: number;
  reason: string;
  timestamp: number;
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
