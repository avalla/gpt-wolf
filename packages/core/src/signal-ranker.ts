interface TradeSignal {
  symbol: string;
  direction: 'LONG' | 'SHORT';
  entryPrice: number;
  targetPrice?: number;
  stopLoss?: number;
  takeProfitPercent?: number;
  stopLossPercent?: number;
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

interface RankedSignal extends TradeSignal {
  score: number;
  confidence: number;
  riskRewardRatio: number;
  strategyWeight: number;
}

/**
 * Pesi delle strategie basati su performance storica
 */
const STRATEGY_WEIGHTS: Record<string, number> = {
  'News Momentum': 1.0,      // Migliore ROI
  'Orderbook Imbalance': 0.9, // Migliore Win Rate
  'Volume Spike': 0.85,      // Più consistente
  'Whale Movement': 0.7,     // Trend following
  'CVD Divergence': 0.65,    // Contrarian
  'Liquidation Cascade': 0.6, // Anticipa liquidazioni
  'Cross-Exchange Arbitrage': 0.5 // Arbitraggio
};

/**
 * Calcola confidence basato su parametri del segnale
 */
function calculateConfidence(signal: TradeSignal): number {
  let confidence = 50; // Base 50%
  
  // Bonus per leva ottimale (25-50x = +20%, >50x = +10%)
  if (signal.leverage >= 25 && signal.leverage <= 50) {
    confidence += 20;
  } else if (signal.leverage > 50) {
    confidence += 10;
  }
  
  // Bonus per TP/SL ratio ottimale (>2:1 = +15%)
  const tpPercent = signal.takeProfitPercent || 0;
  const slPercent = signal.stopLossPercent || 0;
  if (slPercent > 0 && (tpPercent / slPercent) >= 2) {
    confidence += 15;
  }
  
  // Bonus per timeframe aggressivo
  if (signal.timeframe === '1m' || signal.timeframe === '30s') {
    confidence += 10;
  }
  
  // Bonus per order type ottimale
  if (signal.orderType === 'Market') {
    confidence += 5; // Esecuzione immediata
  }
  
  return Math.min(confidence, 95); // Max 95%
}

/**
 * Calcola risk/reward ratio
 */
function calculateRiskRewardRatio(signal: TradeSignal): number {
  const tpPercent = signal.takeProfitPercent || 0;
  const slPercent = signal.stopLossPercent || 0;
  
  if (slPercent === 0) return 0;
  return tpPercent / slPercent;
}

/**
 * Estrae nome strategia dal reason
 */
function extractStrategyName(reason: string): string {
  if (reason.includes('News Momentum')) return 'News Momentum';
  if (reason.includes('Orderbook Imbalance')) return 'Orderbook Imbalance';
  if (reason.includes('Volume Spike')) return 'Volume Spike';
  if (reason.includes('Whale Movement')) return 'Whale Movement';
  if (reason.includes('CVD Divergence')) return 'CVD Divergence';
  if (reason.includes('Liquidation Cascade')) return 'Liquidation Cascade';
  if (reason.includes('Cross-Exchange')) return 'Cross-Exchange Arbitrage';
  return 'Unknown';
}

/**
 * Calcola score complessivo del segnale
 */
function calculateSignalScore(signal: TradeSignal): number {
  const strategyName = extractStrategyName(signal.reason);
  const strategyWeight = STRATEGY_WEIGHTS[strategyName] || 0.3;
  const confidence = calculateConfidence(signal);
  const riskReward = calculateRiskRewardRatio(signal);
  
  // Formula scoring: (Confidence * 0.4) + (RiskReward * 20 * 0.3) + (StrategyWeight * 100 * 0.3)
  const score = (confidence * 0.4) + (riskReward * 20 * 0.3) + (strategyWeight * 100 * 0.3);
  
  return Math.round(score * 100) / 100; // Arrotonda a 2 decimali
}

/**
 * Filtra segnali conflittuali sullo stesso symbol
 */
function filterConflictingSignals(signals: RankedSignal[]): RankedSignal[] {
  const symbolMap = new Map<string, RankedSignal>();
  
  for (const signal of signals) {
    const existing = symbolMap.get(signal.symbol);
    
    if (!existing || signal.score > existing.score) {
      symbolMap.set(signal.symbol, signal);
    }
  }
  
  return Array.from(symbolMap.values());
}

/**
 * Seleziona e rankizza i migliori segnali di trading
 */
export function rankAndSelectBestSignals(
  allSignals: TradeSignal[],
  maxSignals: number = 5
): RankedSignal[] {
  // Calcola score per ogni segnale
  const rankedSignals: RankedSignal[] = allSignals.map(signal => {
    const confidence = calculateConfidence(signal);
    const riskRewardRatio = calculateRiskRewardRatio(signal);
    const strategyWeight = STRATEGY_WEIGHTS[extractStrategyName(signal.reason)] || 0.3;
    const score = calculateSignalScore(signal);
    
    return {
      ...signal,
      score,
      confidence,
      riskRewardRatio,
      strategyWeight
    };
  });
  
  // Filtra segnali scaduti
  const now = Date.now();
  const validSignals = rankedSignals.filter(signal => 
    signal.validUntil && signal.validUntil > now
  );
  
  // Filtra conflitti sullo stesso symbol
  const nonConflictingSignals = filterConflictingSignals(validSignals);
  
  // Ordina per score decrescente
  const sortedSignals = nonConflictingSignals.sort((a, b) => b.score - a.score);
  
  // Restituisce solo i migliori N segnali
  return sortedSignals.slice(0, maxSignals);
}

/**
 * Filtra segnali per strategia specifica
 */
export function getBestSignalsByStrategy(
  allSignals: TradeSignal[],
  strategyName: string,
  maxSignals: number = 2
): RankedSignal[] {
  const strategySignals = allSignals.filter(signal => 
    extractStrategyName(signal.reason) === strategyName
  );
  
  return rankAndSelectBestSignals(strategySignals, maxSignals);
}

/**
 * Ottieni statistiche sui segnali
 */
export function getSignalStats(signals: RankedSignal[]) {
  if (signals.length === 0) {
    return {
      totalSignals: 0,
      avgScore: 0,
      avgConfidence: 0,
      avgRiskReward: 0,
      strategiesUsed: []
    };
  }
  
  const avgScore = signals.reduce((sum, s) => sum + s.score, 0) / signals.length;
  const avgConfidence = signals.reduce((sum, s) => sum + s.confidence, 0) / signals.length;
  const avgRiskReward = signals.reduce((sum, s) => sum + s.riskRewardRatio, 0) / signals.length;
  
  const strategiesUsed = [...new Set(signals.map(s => extractStrategyName(s.reason)))];
  
  return {
    totalSignals: signals.length,
    avgScore: Math.round(avgScore * 100) / 100,
    avgConfidence: Math.round(avgConfidence * 100) / 100,
    avgRiskReward: Math.round(avgRiskReward * 100) / 100,
    strategiesUsed
  };
}
