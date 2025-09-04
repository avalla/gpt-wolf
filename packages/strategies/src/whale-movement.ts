interface MarketSummary {
  symbol: string;
  price: number;
  volume24h: number;
  change24h: number;
  fundingRate: number;
  nextFundingTime: number;
  openInterest: number;
  // Whale movement data (simulated)
  largeTransactions?: number;
  whaleVolume?: number;
  exchangeInflow?: number;
  exchangeOutflow?: number;
}

interface TradeSignal {
  symbol: string;
  direction: 'LONG' | 'SHORT';
  entryPrice: number;
  takeProfitPercent?: number;
  stopLossPercent?: number;
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
 * Simula movimenti whale basati su volume e OI
 */
function simulateWhaleMovements(market: MarketSummary) {
  const baseVolume = market.volume24h;
  const volatility = Math.abs(market.change24h);
  
  // Simula transazioni large (>$1M)
  const largeTransactions = Math.floor((baseVolume / 100000000) * (1 + volatility / 10));
  
  // Simula volume whale (10-30% del volume totale)
  const whaleVolume = baseVolume * (0.1 + Math.random() * 0.2);
  
  // Simula flussi exchange
  const flowFactor = market.change24h > 0 ? 0.7 : 1.3; // Outflow su pump, inflow su dump
  const exchangeInflow = whaleVolume * flowFactor * Math.random();
  const exchangeOutflow = whaleVolume * (2 - flowFactor) * Math.random();
  
  return { largeTransactions, whaleVolume, exchangeInflow, exchangeOutflow };
}

/**
 * Calcola leva per whale movements
 */
function calculateWhaleLeverage(whaleIntensity: number, symbol: string): number {
  const leverageLimits: Record<string, number> = {
    'BTCUSDT': 60, 'ETHUSDT': 60, 'SOLUSDT': 50, 'ADAUSDT': 50,
    'AVAXUSDT': 40, 'LINKUSDT': 40, 'DOGEUSDT': 40,
  };

  const maxLeverage = leverageLimits[symbol] || 35;
  
  // Leva moderata-alta per whale movements
  const baseLeverage = 20;
  const whaleBonus = Math.floor(whaleIntensity * 20); // Max +20x
  
  return Math.max(baseLeverage, Math.min(baseLeverage + whaleBonus, maxLeverage));
}

/**
 * Determina direzione basata su whale activity
 */
function getWhaleDirection(
  exchangeInflow: number, 
  exchangeOutflow: number, 
  priceChange: number
): 'LONG' | 'SHORT' {
  const netFlow = exchangeOutflow - exchangeInflow; // Positive = outflow (bullish)
  
  // Outflow significativo = whale accumulation off-exchange (bullish)
  if (netFlow > exchangeInflow * 0.5) {
    return 'LONG';
  }
  
  // Inflow significativo = whale distribution (bearish)
  if (netFlow < -exchangeOutflow * 0.5) {
    return 'SHORT';
  }
  
  // Se flussi equilibrati, segui price action
  return priceChange > 0 ? 'LONG' : 'SHORT';
}

/**
 * Calcola TP/SL per whale movements
 */
function calculateWhaleTPSL(whaleIntensity: number, flowRatio: number) {
  // TP basato su intensità whale activity
  const baseTp = 0.8; // 0.8% base
  const tpPercent = baseTp + (whaleIntensity * 0.6); // Max 1.4%
  
  // SL basato su flow ratio (più flow = SL più largo)
  const baseSl = 0.4; // 0.4% base
  const slPercent = baseSl + (Math.abs(flowRatio) * 0.3); // Max 0.7%
  
  return {
    takeProfitPercent: Math.min(tpPercent, 2.0),
    stopLossPercent: Math.min(slPercent, 0.8)
  };
}

/**
 * Whale Movement Detection Strategy
 * Segue movimenti di grosse balene e smart money
 */
export function whaleMovementStrategy(
  markets: MarketSummary[],
  config: StrategyConfig
): TradeSignal[] {
  const signals: TradeSignal[] = [];
  const now = Date.now();

  // Filtra mercati con volume sufficiente per whale activity
  const whaleMarkets = markets.filter(m => 
    m.volume24h > 25000000 // Min $25M volume
  );

  for (const market of whaleMarkets) {
    // Simula whale movements
    const { largeTransactions, whaleVolume, exchangeInflow, exchangeOutflow } = simulateWhaleMovements(market);
    
    // Calcola intensità whale activity
    const whaleIntensity = Math.min(whaleVolume / market.volume24h, 0.5) * 2; // Normalizza 0-1
    const flowRatio = (exchangeOutflow - exchangeInflow) / (exchangeInflow + exchangeOutflow);
    
    // Soglia minima: whale activity deve essere significativa
    if (whaleIntensity < 0.15 || largeTransactions < 3) continue;

    const direction = getWhaleDirection(exchangeInflow, exchangeOutflow, market.change24h);
    const leverage = calculateWhaleLeverage(whaleIntensity, market.symbol);
    const { takeProfitPercent, stopLossPercent } = calculateWhaleTPSL(whaleIntensity, flowRatio);

    // Entry price per whale following
    let entryPrice = market.price;
    if (direction === 'LONG') {
      // Per LONG, entry su dip per seguire accumulation
      entryPrice = market.price * 0.997; // -0.3%
    } else {
      // Per SHORT, entry su bounce per seguire distribution
      entryPrice = market.price * 1.003; // +0.3%
    }

    const timeframe = '30m'; // Whale movements si sviluppano in 30-60 minuti
    const validUntil = now + (60 * 60 * 1000); // 60 minuti validità
    const orderType = 'Conditional'; // Conditional per entry ottimale

    const whalePercent = (whaleIntensity * 100).toFixed(0);
    const flowText = flowRatio > 0.2 ? 'Outflow' : flowRatio < -0.2 ? 'Inflow' : 'Balanced';
    const txCount = largeTransactions.toString();

    signals.push({
      symbol: market.symbol,
      direction,
      entryPrice,
      takeProfitPercent,
      stopLossPercent,
      leverage,
      reason: `Whale Movement ${whalePercent}% | ${flowText} | ${txCount} Large TX | TP: ${takeProfitPercent.toFixed(1)}% | SL: ${stopLossPercent.toFixed(1)}%`,
      timestamp: now,
      timeframe,
      validUntil,
      orderType,
      createdAt: new Date(now).toISOString(),
      expiresAt: new Date(validUntil).toISOString()
    });
  }

  // Ordina per intensità whale activity
  return signals.sort((a, b) => {
    const aIntensity = parseFloat(a.reason.split('Whale Movement ')[1].split('%')[0]);
    const bIntensity = parseFloat(b.reason.split('Whale Movement ')[1].split('%')[0]);
    return bIntensity - aIntensity;
  }).slice(0, 3); // Max 3 whale signals
}
