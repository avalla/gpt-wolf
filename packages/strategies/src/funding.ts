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
}

/**
 * Strategia basata sui funding rate
 * Cerca contratti con funding rate estremi e apre posizioni contro il mercato
 * con leva molto alta (50x-100x)
 */
export function fundingRateStrategy(
  markets: MarketSummary[],
  config: StrategyConfig
): TradeSignal[] {
  const signals: TradeSignal[] = [];
  const now = Date.now();
  
  // Filtra per funding rate estremi (>0.1% è considerato alto)
  const extremeFunding = markets
    .filter(m => Math.abs(m.fundingRate) > 0.001 && m.volume24h > 10000000) // >0.1% e volume >$10M
    .sort((a, b) => Math.abs(b.fundingRate) - Math.abs(a.fundingRate));
  
  // Genera segnali per i top 3 funding rate estremi
  extremeFunding.slice(0, 3).forEach(market => {
    // Determina la direzione (opposta al sentiment del mercato)
    // Se funding rate è positivo, il mercato è long-biased, quindi andiamo short
    const direction = market.fundingRate > 0 ? 'SHORT' : 'LONG';
    
    // Per funding rate estremi usiamo leve molto alte (50x-100x)
    // Più alto è il funding rate, più alta è la leva
    const leverage = Math.min(
      Math.round(Math.abs(market.fundingRate) * 50000), 
      config.maxLeverage
    );
    
    // Calcola target e stop loss aggressivi
    const entryPrice = market.price;
    const stopLossPercentage = 100 / leverage * 0.7; // 70% del margine disponibile
    const takeProfitPercentage = stopLossPercentage * 4; // Rapporto rischio/rendimento 1:4
    
    // Calcola prezzi target e stop loss
    const targetPrice = direction === 'LONG' 
      ? entryPrice * (1 + takeProfitPercentage / 100)
      : entryPrice * (1 - takeProfitPercentage / 100);
    
    const stopLoss = direction === 'LONG'
      ? entryPrice * (1 - stopLossPercentage / 100)
      : entryPrice * (1 + stopLossPercentage / 100);
    
    signals.push({
      symbol: market.symbol,
      direction,
      entryPrice,
      targetPrice,
      stopLoss,
      leverage,
      reason: `Funding rate ${(market.fundingRate * 100).toFixed(4)}% - Strategia di arbitraggio`,
      timestamp: now
    });
  });
  
  return signals;
}
