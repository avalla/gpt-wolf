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
  orderType: 'Market' | 'Limit' | 'Conditional' | 'TWAP' | 'Iceberg';
  reason: string;
  timestamp: number;
  timeframe: string;
  validUntil: number;
  createdAt: string;
  expiresAt: string;
}

interface StrategyConfig {
  defaultLeverage: number;
  maxLeverage: number;
  riskPercentage: number;
}

/**
 * Leve realistiche basate sui limiti Bybit
 */
function getRealisticLeverage(symbol: string, fundingRate: number): number {
  const leverageLimits: Record<string, number> = {
    'BTCUSDT': 100, 'ETHUSDT': 100, 'SOLUSDT': 50, 'ADAUSDT': 50,
    'AVAXUSDT': 25, 'LINKUSDT': 25, 'DOGEUSDT': 25,
    'RADUSDT': 12.5, // Limite reale per RADUSDT
  };
  
  const maxLeverage = leverageLimits[symbol] || 20; // Default conservativo
  const fundingBasedLeverage = Math.abs(fundingRate) * 20000; // Scala ridotta
  
  return Math.max(5, Math.min(Math.floor(fundingBasedLeverage), maxLeverage));
}

/**
 * Determina il tipo di ordine ottimale per funding rate
 */
function getOptimalOrderType(fundingRate: number, leverage: number): 'Market' | 'Limit' | 'Conditional' | 'TWAP' | 'Iceberg' {
  // Per funding rate estremi usiamo ordini aggressivi
  if (Math.abs(fundingRate) > 0.002) {
    return leverage > 25 ? 'Conditional' : 'Market'; // Conditional per leve alte
  }
  
  // Per funding moderati usiamo limit orders
  if (Math.abs(fundingRate) > 0.001) {
    return 'Limit';
  }
  
  return 'TWAP'; // Per funding bassi, accumula gradualmente
}

/**
 * Strategia basata sui funding rate
 * Cerca contratti con funding rate estremi e apre posizioni contro il mercato
 * con leve realistiche disponibili su Bybit
 */
export function fundingRateStrategy(
  markets: MarketSummary[],
  config: StrategyConfig
): TradeSignal[] {
  const signals: TradeSignal[] = [];
  const now = Date.now();
  
  // Filtra per funding rate estremi (>0.1% è considerato alto)
  const extremeFunding = markets
    .filter(m => Math.abs(m.fundingRate) > 0.001 && m.volume24h > 1000000) // >0.1% e volume >$1M
    .sort((a, b) => Math.abs(b.fundingRate) - Math.abs(a.fundingRate));
  
  // Genera segnali per i top 3 funding rate estremi
  extremeFunding.slice(0, 3).forEach(market => {
    // Determina la direzione (opposta al sentiment del mercato)
    // Se funding rate è positivo, il mercato è long-biased, quindi andiamo short
    const direction = market.fundingRate > 0 ? 'SHORT' : 'LONG';
    
    // Usa leve realistiche basate sui limiti Bybit
    const leverage = getRealisticLeverage(market.symbol, market.fundingRate);
    
    // Determina il tipo di ordine ottimale
    const orderType = getOptimalOrderType(market.fundingRate, leverage);
    
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
    
    // Calcola validità del segnale basata sul prossimo funding (8h max)
    const validityHours = 8; // Funding rate si aggiorna ogni 8h
    const validUntil = now + (validityHours * 60 * 60 * 1000);
    
    signals.push({
      symbol: market.symbol,
      direction,
      entryPrice,
      targetPrice,
      stopLoss,
      leverage,
      orderType,
      reason: `Funding rate ${(market.fundingRate * 100).toFixed(4)}% - Strategia di arbitraggio`,
      timestamp: now,
      timeframe: '1h', // Timeframe di riferimento per funding rate
      validUntil,
      createdAt: new Date(now).toLocaleString('it-IT'),
      expiresAt: new Date(validUntil).toLocaleString('it-IT')
    });
  });
  
  return signals;
}
