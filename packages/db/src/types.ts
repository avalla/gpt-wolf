/**
 * Configurazione della strategia di trading
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
  // Dati per scalping ultrarapido
  change1m?: number;
  volume1m?: number;
  avgVolume5m?: number;
  // Dati per liquidation hunting
  liquidationCluster?: boolean;
  liquidationVolume?: number;
  liquidationDirection?: 'LONG' | 'SHORT';
  // Dati per hedging volumetrico
  futuresDelta?: number;
  spotVolumeSpike?: boolean;
  spotDelta?: number;
  // Dati per news momentum
  newsSpike?: boolean;
  priceChange?: number;
}

export interface TradeSignal {
  symbol: string;
  direction: 'LONG' | 'SHORT';
  entryPrice: number;
  targetPrice: number;
  stopLoss: number;
  leverage: number;
  reason: string;
  timestamp?: number;
  orderType?: string;
  timeframe?: string;
  validUntil?: number;
  createdAt?: string;
  expiresAt?: string;
  status?: 'ACTIVE' | 'COMPLETED' | 'FAILED' | 'EXPIRED';
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
  liquidationVolumeThreshold?: number;
  newsMomentumThreshold?: number;
}

export interface StrategyConfig {
  defaultLeverage: number;
  maxLeverage: number;
  riskPercentage: number;
  maxConcurrentPositions: number;
  liquidationVolumeThreshold?: number;
  newsMomentumThreshold?: number;
  priceChangeThreshold?: number;
  fundingExtremeThreshold?: number;
  priceMomentumThreshold?: number;
  volumeDivergenceThreshold?: number;
}
