import { MarketSummary, TradeSignal, StrategyConfig } from '@gpt-wolf/db';

export function newsMomentumScalpingStrategy(markets: MarketSummary[], config: StrategyConfig): TradeSignal[] {
  const signals: TradeSignal[] = [];
  const now = Date.now();
  
  for (const market of markets) {
    // News spike: entra su breakout da news con momentum
    if (market.newsSpike && market.priceChange && config.newsMomentumThreshold && Math.abs(market.priceChange) > config.newsMomentumThreshold) {
      const direction = market.priceChange > 0 ? 'LONG' : 'SHORT';
      const entryPrice = market.price;
      const leverage = 75;
      const targetPrice = direction === 'LONG'
        ? entryPrice * 1.012
        : entryPrice * 0.988;
      const stopLoss = direction === 'LONG'
        ? entryPrice * 0.994
        : entryPrice * 1.006;

      signals.push({
        symbol: market.symbol,
        direction,
        entryPrice,
        targetPrice,
        stopLoss,
        leverage,
        reason: `News momentum ${direction}`,
        timestamp: now
      });
    }
  }
  
  return signals;
}
