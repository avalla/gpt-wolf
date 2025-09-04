import { MarketSummary, TradeSignal, StrategyConfig } from '@gpt-wolf/db';
import { LiquidationAnalyzer } from './liquidation-analyzer';
import { getOptimalTimeframe, calculateSignalValidity, getOptimalOrderType, createTimeFields } from './strategy-utils';

/**
 * Strategia di scalping basata su liquidation maps
 * - Identifica cluster di liquidazioni vicine al prezzo
 * - Entra prima che il prezzo raggiunga i cluster per cavalcare lo squeeze
 * - TP rapidi su liquidation cascades, SL dinamici
 * - Leva alta 75-100x per massimizzare i guadagni sui micro-movimenti
 */
export function liquidationScalpingStrategy(
  markets: MarketSummary[],
  config: StrategyConfig
): TradeSignal[] {
  const signals: TradeSignal[] = [];
  const timeframe = getOptimalTimeframe('scalping');
  const validUntil = calculateSignalValidity(timeframe);

  // Analizza liquidazioni per tutti i mercati
  const liquidationAnalysis = LiquidationAnalyzer.analyzeLiquidations(markets);

  for (const market of markets) {
    const analysis = liquidationAnalysis.get(market.symbol);
    if (!analysis || !analysis.isSignificant) continue;

    // Calcola livelli di liquidazione probabili
    const liquidationLevels = calculateProbableLiquidationLevels(market);

    // Trova cluster di liquidazioni
    const clusters = LiquidationAnalyzer.findLiquidationClusters(
      market.price,
      liquidationLevels,
      0.015 // 1.5% tolerance per scalping
    );

    if (clusters.length === 0) continue;

    // Seleziona il cluster più vicino e forte
    const targetCluster = clusters
      .filter(c => c.strength >= 3) // Almeno 3 livelli nel cluster
      .sort((a, b) => b.strength - a.strength)[0];

    if (!targetCluster) continue;

    // Determina direzione basata su liquidation analysis e cluster position
    const direction = determineScalpingDirection(market, analysis, targetCluster);
    if (!direction) continue;

    // Calcola entry, TP e SL per scalping aggressivo
    const { entryPrice, targetPrice, stopLoss, leverage } = calculateScalpingLevels(
      market,
      direction,
      targetCluster,
      analysis
    );

    const orderType = getOptimalOrderType('scalping', leverage, 'HIGH');
    const timeFields = createTimeFields(timeframe, validUntil);

    signals.push({
      symbol: market.symbol,
      direction,
      entryPrice,
      targetPrice,
      stopLoss,
      leverage,
      orderType,
      reason: `Liquidation Scalping ${direction} | Cluster @${targetCluster.center.toFixed(2)} (${targetCluster.strength} levels) | Net Liq: $${(analysis.netLiquidations/1000).toFixed(0)}K`,
      ...timeFields
    });
  }

  console.log(`[LiquidationScalping] Analizzati ${markets.length} mercati, generati ${signals.length} segnali`);
  return signals;
}

/**
 * Calcola livelli di liquidazione probabili basati su leverage comuni
 */
function calculateProbableLiquidationLevels(market: MarketSummary): number[] {
  const levels: number[] = [];
  const commonLeverages = [10, 20, 25, 50, 75, 100, 125];
  const directions: ('LONG' | 'SHORT')[] = ['LONG', 'SHORT'];

  // Simula liquidation levels per diversi leverage e direzioni
  for (const leverage of commonLeverages) {
    for (const direction of directions) {
      const liquidationLevel = LiquidationAnalyzer.calculateLiquidationLevel(
        market.price,
        leverage,
        direction,
        0.005 // 0.5% maintenance margin
      );

      // Solo livelli ragionevoli (entro ±10% dal prezzo attuale)
      const distancePercent = Math.abs(liquidationLevel - market.price) / market.price;
      if (distancePercent <= 0.1) {
        levels.push(liquidationLevel);
      }
    }
  }

  return levels;
}

/**
 * Determina direzione di scalping basata su analisi liquidazioni e posizione cluster
 */
function determineScalpingDirection(
  market: MarketSummary,
  analysis: any,
  cluster: any
): 'LONG' | 'SHORT' | null {
  const priceToCluster = (cluster.center - market.price) / market.price;

  // Se cluster è sopra il prezzo e ci sono molti short da liquidare -> LONG
  if (priceToCluster > 0 && analysis.dominantSide === 'SHORT') {
    return 'LONG'; // Squeeze degli short
  }

  // Se cluster è sotto il prezzo e ci sono molti long da liquidare -> SHORT
  if (priceToCluster < 0 && analysis.dominantSide === 'LONG') {
    return 'SHORT'; // Squeeze dei long
  }

  // Momentum scalping: segue la direzione delle liquidazioni massive
  if (analysis.isMassive) {
    if (analysis.expectedDirection === 'BULLISH') return 'LONG';
    if (analysis.expectedDirection === 'BEARISH') return 'SHORT';
  }

  return null;
}

/**
 * Calcola livelli di entry, TP e SL ottimali per scalping su liquidazioni
 */
function calculateScalpingLevels(
  market: MarketSummary,
  direction: 'LONG' | 'SHORT',
  cluster: any,
  analysis: any
) {
  const entryPrice = market.price;

  // Leverage basato su forza del cluster e volume liquidazioni
  let leverage = 75; // Base
  if (cluster.strength >= 5) leverage += 10; // Cluster forte
  if (analysis.isMassive) leverage += 15; // Liquidazioni massive
  leverage = Math.min(leverage, 100); // Cap a 100x

  // TP aggressivo: mira al cluster di liquidazioni
  const distanceToCluster = Math.abs(cluster.center - entryPrice) / entryPrice;
  const tpDistance = Math.min(distanceToCluster * 0.8, 0.004); // Max 0.4% per scalping

  // SL stretto ma dinamico basato su volatilità
  const volatility = Math.abs(market.change1h || 0.5) / 100;
  const slDistance = Math.max(volatility * 0.5, 0.002); // Min 0.2%, max basato su volatilità

  const targetPrice = direction === 'LONG'
    ? entryPrice * (1 + tpDistance)
    : entryPrice * (1 - tpDistance);

  const stopLoss = direction === 'LONG'
    ? entryPrice * (1 - slDistance)
    : entryPrice * (1 + slDistance);

  return { entryPrice, targetPrice, stopLoss, leverage };
}
