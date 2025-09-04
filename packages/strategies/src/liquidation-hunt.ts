import { MarketSummary, TradeSignal, StrategyConfig } from "@gpt-wolf/db";

export function liquidationHuntingStrategy(
  markets: MarketSummary[],
  config: StrategyConfig
): TradeSignal[] {
  const signals: TradeSignal[] = [];
  const now = Date.now();

  for (const market of markets) {
    // Cluster liquidazioni: entra su spike
    if (
      market.liquidationCluster &&
      market.liquidationVolume &&
      config.liquidationVolumeThreshold &&
      market.liquidationVolume > config.liquidationVolumeThreshold
    ) {
      const direction = market.liquidationDirection || 'LONG';
      const entryPrice = market.price;
      const leverage = 100;
      const targetPrice = direction === 'LONG'
        ? entryPrice * 1.007
        : entryPrice * 0.993;
      const stopLoss = direction === 'LONG'
        ? entryPrice * 0.997
        : entryPrice * 1.003;

      signals.push({
        symbol: market.symbol,
        direction,
        entryPrice,
        targetPrice,
        stopLoss,
        leverage,
        reason: "Spike liquidazioni (cluster)",
        timestamp: now
      });
    }
  }
  
  return signals;
}
