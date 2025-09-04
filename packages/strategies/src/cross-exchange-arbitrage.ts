interface MarketSummary {
  symbol: string;
  price: number;
  volume24h: number;
  change24h: number;
  fundingRate: number;
  nextFundingTime: number;
  openInterest: number;
  // Cross-exchange data (simulated)
  binancePrice?: number;
  okxPrice?: number;
  bybitPrice?: number;
  maxPriceDiff?: number;
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
 * Simula prezzi su diversi exchange
 */
function simulateCrossExchangePrices(market: MarketSummary) {
  const basePrice = market.price;
  const volatility = Math.abs(market.change24h) / 100;
  
  // Simula spread tra exchange (0.01-0.1%)
  const binanceSpread = (Math.random() - 0.5) * volatility * 0.5;
  const okxSpread = (Math.random() - 0.5) * volatility * 0.4;
  const bybitSpread = (Math.random() - 0.5) * volatility * 0.3;
  
  const binancePrice = basePrice * (1 + binanceSpread);
  const okxPrice = basePrice * (1 + okxSpread);
  const bybitPrice = basePrice * (1 + bybitSpread);
  
  const prices = [binancePrice, okxPrice, bybitPrice];
  const maxPriceDiff = (Math.max(...prices) - Math.min(...prices)) / Math.min(...prices) * 100;
  
  return { binancePrice, okxPrice, bybitPrice, maxPriceDiff };
}

/**
 * Calcola leva per arbitrage
 */
function calculateArbitrageLeverage(priceDiffPercent: number, symbol: string): number {
  const leverageLimits: Record<string, number> = {
    'BTCUSDT': 50, 'ETHUSDT': 50, 'SOLUSDT': 40, 'ADAUSDT': 40,
    'AVAXUSDT': 30, 'LINKUSDT': 30, 'DOGEUSDT': 30,
  };

  const maxLeverage = leverageLimits[symbol] || 25;
  
  // Leva moderata per arbitrage (rischio più basso)
  const baseLeverage = 10;
  const diffBonus = Math.floor(priceDiffPercent * 100); // +10x per 0.1% diff
  
  return Math.max(baseLeverage, Math.min(baseLeverage + diffBonus, maxLeverage));
}

/**
 * Determina direzione arbitrage
 */
function getArbitrageDirection(
  binancePrice: number, 
  okxPrice: number, 
  bybitPrice: number
): { direction: 'LONG' | 'SHORT', exchange: string, targetPrice: number } {
  const prices = [
    { exchange: 'Binance', price: binancePrice },
    { exchange: 'OKX', price: okxPrice },
    { exchange: 'Bybit', price: bybitPrice }
  ];
  
  prices.sort((a, b) => a.price - b.price);
  
  const lowest = prices[0];
  const highest = prices[2];
  
  // Compra sul più basso, vendi sul più alto
  return {
    direction: 'LONG', // Sempre long sul prezzo più basso
    exchange: lowest.exchange,
    targetPrice: highest.price
  };
}

/**
 * Calcola TP/SL per arbitrage
 */
function calculateArbitrageTPSL(priceDiffPercent: number) {
  // TP basato su convergenza prezzi (80% della differenza)
  const tpPercent = priceDiffPercent * 0.8;
  
  // SL conservativo (se divergenza aumenta)
  const slPercent = priceDiffPercent * 0.3;
  
  return {
    takeProfitPercent: Math.min(tpPercent, 0.5),
    stopLossPercent: Math.min(slPercent, 0.2)
  };
}

/**
 * Cross-Exchange Arbitrage Strategy
 * Sfrutta differenze di prezzo tra exchange
 */
export function crossExchangeArbitrageStrategy(
  markets: MarketSummary[],
  config: StrategyConfig
): TradeSignal[] {
  const signals: TradeSignal[] = [];
  const now = Date.now();

  // Filtra mercati con alta liquidità per arbitrage
  const arbitrageMarkets = markets.filter(m => 
    m.volume24h > 20000000 // Min $20M volume
  );

  for (const market of arbitrageMarkets) {
    // Simula prezzi cross-exchange
    const { binancePrice, okxPrice, bybitPrice, maxPriceDiff } = simulateCrossExchangePrices(market);
    
    // Soglia minima: differenza deve essere > 0.05%
    if (maxPriceDiff < 0.05) continue;

    const { direction, exchange, targetPrice } = getArbitrageDirection(
      binancePrice, okxPrice, bybitPrice
    );
    
    const leverage = calculateArbitrageLeverage(maxPriceDiff, market.symbol);
    const { takeProfitPercent, stopLossPercent } = calculateArbitrageTPSL(maxPriceDiff);

    // Entry price = prezzo più basso
    const entryPrice = Math.min(binancePrice, okxPrice, bybitPrice);

    const timeframe = '5m'; // Arbitrage si chiude velocemente
    const validUntil = now + (15 * 60 * 1000); // 15 minuti validità
    const orderType = 'Limit'; // Limit per entry preciso

    const diffBps = (maxPriceDiff * 100).toFixed(0);
    const targetExchange = exchange === 'Binance' ? 'BIN' : exchange === 'OKX' ? 'OKX' : 'BYB';

    signals.push({
      symbol: market.symbol,
      direction,
      entryPrice,
      takeProfitPercent,
      stopLossPercent,
      leverage,
      reason: `Cross-Exchange Arbitrage ${diffBps}bps | Buy: ${targetExchange} | Target: $${targetPrice.toFixed(4)} | TP: ${takeProfitPercent.toFixed(2)}% | SL: ${stopLossPercent.toFixed(2)}%`,
      timestamp: now,
      timeframe,
      validUntil,
      orderType,
      createdAt: new Date(now).toISOString(),
      expiresAt: new Date(validUntil).toISOString()
    });
  }

  // Ordina per differenza prezzo (più grandi prime)
  return signals.sort((a, b) => {
    const aDiff = parseFloat(a.reason.split('Arbitrage ')[1].split('bps')[0]);
    const bDiff = parseFloat(b.reason.split('Arbitrage ')[1].split('bps')[0]);
    return bDiff - aDiff;
  }).slice(0, 3); // Max 3 arbitrage simultanei
}
