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
 * Strategia di liquidation hunting
 * Cerca aree con alta concentrazione di liquidazioni e apre posizioni
 * nella direzione che potrebbe innescare un effetto cascata di liquidazioni
 */
export function liquidationHuntingStrategy(
  markets: MarketSummary[],
  config: StrategyConfig
): TradeSignal[] {
  const signals: TradeSignal[] = [];
  const now = Date.now();
  
  // Filtra per mercati con dati di liquidazione disponibili
  const marketsWithLiquidations = markets.filter(m => m.liquidations24h && m.volume24h > 20000000);
  
  if (marketsWithLiquidations.length === 0) {
    return [];
  }
  
  // Ordina per volume totale di liquidazioni
  const sortedMarkets = marketsWithLiquidations
    .sort((a, b) => {
      const aTotal = a.liquidations24h?.total || 0;
      const bTotal = b.liquidations24h?.total || 0;
      return bTotal - aTotal;
    });
  
  // Genera segnali per i top 2 mercati con più liquidazioni
  sortedMarkets.slice(0, 2).forEach(market => {
    if (!market.liquidations24h) return;
    
    // Determina la direzione in base allo squilibrio nelle liquidazioni
    // Se ci sono più liquidazioni short, andiamo long (per innescare più liquidazioni short)
    const buyQty = market.liquidations24h.buyQty || 0;
    const sellQty = market.liquidations24h.sellQty || 0;
    
    // Solo se c'è uno squilibrio significativo (>30%)
    if (Math.abs(buyQty - sellQty) / (buyQty + sellQty) < 0.3) {
      return;
    }
    
    const direction = buyQty > sellQty ? 'LONG' : 'SHORT';
    
    // Leverage basato su intensità delle liquidazioni
    const totalLiquidations = buyQty + sellQty;
    const liquidationIntensity = Math.min(totalLiquidations / market.volume24h * 100, 5);
    const leverage = Math.min(75 + Math.floor(liquidationIntensity * 5), config.maxLeverage);
    
    // Calcola target e stop loss estremamente aggressivi
    const entryPrice = market.price;
    const stopLossPercentage = 100 / leverage * 0.6; // 60% del margine disponibile
    const takeProfitPercentage = stopLossPercentage * 5; // Rapporto rischio/rendimento 1:5
    
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
      leverage: Math.round(leverage),
      reason: `Liquidation hunting - Squilibrio liquidazioni ${direction}`,
      timestamp: now
    });
  });
  
  return signals;
}
