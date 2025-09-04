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
 * Strategia basata sulle anomalie di volume
 * Cerca mercati con volume anomalo rispetto alla capitalizzazione
 * che potrebbero indicare manipolazione o pump and dump
 */
export function volumeAnomalyStrategy(
  markets: MarketSummary[],
  config: StrategyConfig
): TradeSignal[] {
  const signals: TradeSignal[] = [];
  const now = Date.now();
  
  // Ignora i top 5 per volume (sono sempre ad alto volume)
  const highVolumeMarkets = [...markets]
    .sort((a, b) => b.volume24h - a.volume24h)
    .slice(5);
  
  // Cerca mercati con volume anomalo rispetto alla loro capitalizzazione
  const anomalies = highVolumeMarkets.filter(m => {
    // Calcola un rapporto approssimativo tra volume e capitalizzazione
    const volumeToCapRatio = m.volume24h / (m.price * m.openInterest);
    return volumeToCapRatio > 0.3 && m.volume24h > 5000000; // Volume > $5M
  });
  
  // Ordina per rapporto volume/cap più alto
  const sortedAnomalies = anomalies.sort((a, b) => {
    const aRatio = a.volume24h / (a.price * a.openInterest);
    const bRatio = b.volume24h / (b.price * b.openInterest);
    return bRatio - aRatio;
  });
  
  // Genera segnali per i top 2 mercati con anomalie di volume
  sortedAnomalies.slice(0, 2).forEach(market => {
    // Per le anomalie di volume, la direzione dipende dalla tendenza recente
    // Se il prezzo è salito, è probabile che ci sia un pump, quindi SHORT
    // Se il prezzo è sceso, è probabile che ci sia un dump, quindi LONG
    const direction = market.change24h > 0 ? 'SHORT' : 'LONG';
    
    // Leverage basato su intensità del volume anomalo
    const volumeToCapRatio = market.volume24h / (market.price * market.openInterest);
    const leverage = Math.min(50 + Math.floor(volumeToCapRatio * 100), config.maxLeverage);
    
    // Calcola target e stop loss estremamente aggressivi
    const entryPrice = market.price;
    const stopLossPercentage = 100 / leverage * 0.65; // 65% del margine disponibile
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
      leverage: Math.round(leverage),
      reason: `Anomalia di volume - Possibile manipolazione, volume 24h: $${(market.volume24h/1000000).toFixed(2)}M`,
      timestamp: now
    });
  });
  
  return signals;
}
