import { MarketSummary, TradeSignal, StrategyConfig } from './types';
import { FundingAnalyzer } from './funding-analyzer';
import { LiquidationAnalyzer } from './liquidation-analyzer';
import { TechnicalAnalyzer } from './technical-analyzer';
import { getOptimalTimeframe, calculateSignalValidity, getOptimalOrderType, createTimeFields } from './strategy-utils';

/**
 * Strategia ultra-aggressiva con leva massima
 * Combina analisi di funding rate, liquidazioni e analisi tecnica
 * Usa leve 75x-100x con gestione del rischio avanzata
 */
export function ultraAggressiveStrategy(
  markets: MarketSummary[],
  config: StrategyConfig
): TradeSignal[] {
  const signals: TradeSignal[] = [];
  const timeframe = getOptimalTimeframe('aggressive');
  const validUntil = calculateSignalValidity(timeframe);

  // 1. Analisi Funding Rate
  const fundingAnalyses = FundingAnalyzer.analyzeFundingRates(markets);
  const extremeFundingOps = FundingAnalyzer.findExtremeFundingOpportunities(fundingAnalyses);

  // 2. Analisi Liquidazioni
  const liquidationAnalyses = LiquidationAnalyzer.analyzeLiquidations(markets);
  const massiveLiquidationOps = LiquidationAnalyzer.findMassiveLiquidationOpportunities(liquidationAnalyses);

  // 3. Analisi Tecnica
  const volatilityAnalyses = TechnicalAnalyzer.analyzeVolatility(markets);
  const aggressivePatterns = TechnicalAnalyzer.identifyAggressivePatterns(markets);

  // 4. Genera segnali da funding rate estremi
  for (const fundingOp of extremeFundingOps) {
    if (FundingAnalyzer.isOptimalFundingEntry(fundingOp)) {
      const market = markets.find(m => m.symbol === fundingOp.symbol);
      if (!market) continue;

      const direction = fundingOp.direction === 'BEARISH' ? 'SHORT' : 'LONG';
      const leverage = Math.min(config.maxLeverage, 100);
      const orderType = getOptimalOrderType('aggressive', leverage, 'HIGH');
      const timeFields = createTimeFields(timeframe, validUntil);

      const levels = TechnicalAnalyzer.calculateDynamicLevels(
        market.price,
        Math.abs(market.change24h) / 100,
        market.volume24h
      );

      const signal: TradeSignal = {
        symbol: fundingOp.symbol,
        direction,
        entryPrice: market.price,
        targetPrice: direction === 'LONG' ? levels.resistance2 : levels.support2,
        stopLoss: direction === 'LONG' ? levels.support1 : levels.resistance1,
        leverage,
        orderType,
        reason: `Funding rate estremo: ${(fundingOp.currentRate * 100).toFixed(3)}%`,
        ...timeFields,
        confidence: 85,
        urgency: 'HIGH'
      };

      signals.push(signal);
    }
  }

  // 5. Genera segnali da liquidazioni massive
  for (const liqOp of massiveLiquidationOps.slice(0, 3)) { // Top 3
    const market = markets.find(m => m.symbol === liqOp.symbol);
    if (!market) continue;

    const direction = liqOp.expectedDirection === 'BULLISH' ? 'LONG' : 'SHORT';
    const leverage = Math.min(config.maxLeverage, 75);
    const orderType = getOptimalOrderType('liquidation', leverage, 'HIGH');
    const timeFields = createTimeFields(timeframe, validUntil);

    const levels = TechnicalAnalyzer.calculateDynamicLevels(
      market.price,
      Math.abs(market.change24h) / 100,
      market.volume24h
    );

    const signal: TradeSignal = {
      symbol: liqOp.symbol,
      direction,
      entryPrice: market.price,
      targetPrice: direction === 'LONG' ? levels.resistance1 : levels.support1,
      stopLoss: direction === 'LONG' ? levels.support2 : levels.resistance2,
      leverage,
      orderType,
      reason: `Liquidazioni massive: $${(liqOp.totalLiquidations / 1000000).toFixed(1)}M`,
      ...timeFields,
      confidence: 80,
      urgency: 'HIGH'
    };

    signals.push(signal);
  }

  // 6. Genera segnali da pattern aggressivi
  for (const pattern of aggressivePatterns.slice(0, 5)) { // Top 5
    const market = markets.find(m => m.symbol === pattern.symbol);
    if (!market) continue;

    const leverage = Math.min(config.maxLeverage,
      pattern.type === 'FUNDING_REVERSAL' ? 100 :
      pattern.type === 'VOLUME_BREAKOUT' ? 75 : 50
    );
    const orderType = getOptimalOrderType('aggressive', leverage, pattern.confidence > 80 ? 'HIGH' : 'MEDIUM');
    const timeFields = createTimeFields(timeframe, validUntil);

    const levels = TechnicalAnalyzer.calculateDynamicLevels(
      market.price,
      Math.abs(market.change24h) / 100,
      market.volume24h
    );

    const signal: TradeSignal = {
      symbol: pattern.symbol,
      direction: pattern.direction,
      entryPrice: pattern.entryPrice,
      targetPrice: pattern.direction === 'LONG' ? levels.resistance1 : levels.support1,
      stopLoss: pattern.direction === 'LONG' ? levels.support1 : levels.resistance1,
      leverage,
      orderType,
      reason: pattern.reason,
      ...timeFields,
      confidence: pattern.confidence,
      urgency: pattern.confidence > 80 ? 'HIGH' : 'MEDIUM'
    };

    signals.push(signal);
  }

  // 7. Filtra e ordina segnali per qualità
  return filterAndRankSignals(signals, config);
}

/**
 * Filtra e ordina i segnali per qualità e potenziale profitto
 */
function filterAndRankSignals(signals: TradeSignal[], config: StrategyConfig): TradeSignal[] {
  // Rimuovi duplicati per lo stesso simbolo
  const uniqueSignals = new Map<string, TradeSignal>();

  for (const signal of signals) {
    const existing = uniqueSignals.get(signal.symbol);
    if (!existing || signal.confidence > existing.confidence) {
      uniqueSignals.set(signal.symbol, signal);
    }
  }

  // Converti in array e ordina per qualità
  const filteredSignals = Array.from(uniqueSignals.values());

  return filteredSignals
    .filter(signal => signal.confidence >= 70) // Solo segnali ad alta confidenza
    .sort((a, b) => {
      // Ordina per urgenza, poi confidenza, poi leverage
      if (a.urgency !== b.urgency) {
        const urgencyOrder = { 'HIGH': 3, 'MEDIUM': 2, 'LOW': 1 };
        return urgencyOrder[b.urgency] - urgencyOrder[a.urgency];
      }
      if (a.confidence !== b.confidence) {
        return b.confidence - a.confidence;
      }
      return b.leverage - a.leverage;
    })
    .slice(0, 10); // Massimo 10 segnali
}

/**
 * Calcola la dimensione ottimale della posizione
 */
export function calculatePositionSize(
  signal: TradeSignal,
  availableCapital: number,
  maxRiskPerTrade: number = 5
): number {
  const riskAmount = (availableCapital * maxRiskPerTrade) / 100;
  const entryPrice = signal.entryPrice;
  const stopLoss = signal.stopLoss;

  // Calcola il rischio per unità
  const riskPerUnit = Math.abs(entryPrice - stopLoss);

  // Calcola la quantità base senza leva
  const baseQuantity = riskAmount / riskPerUnit;

  // Con la leva, possiamo aprire una posizione più grande
  const leveragedQuantity = baseQuantity * signal.leverage;

  // Assicurati che non superi il capitale disponibile
  const maxQuantity = availableCapital / entryPrice;

  return Math.min(leveragedQuantity, maxQuantity);
}

/**
 * Calcola il potenziale profitto di un segnale
 */
export function calculatePotentialProfit(
  signal: TradeSignal,
  positionSize: number
): number {
  const entryPrice = signal.entryPrice;
  const targetPrice = signal.targetPrice;

  const priceChange = Math.abs(targetPrice - entryPrice);
  const profitPerUnit = priceChange;

  return profitPerUnit * positionSize * signal.leverage;
}

/**
 * Valuta il rischio di un segnale
 */
export function evaluateSignalRisk(signal: TradeSignal): RiskAssessment {
  const leverage = signal.leverage;
  const confidence = signal.confidence;

  // Calcola il rischio base sulla leva
  let riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'EXTREME' = 'LOW';
  if (leverage > 75) riskLevel = 'EXTREME';
  else if (leverage > 50) riskLevel = 'HIGH';
  else if (leverage > 25) riskLevel = 'MEDIUM';

  // Aggiusta per la confidenza
  const adjustedRisk = confidence > 85 ?
    (riskLevel === 'EXTREME' ? 'HIGH' :
      riskLevel === 'HIGH' ? 'MEDIUM' :
     riskLevel === 'MEDIUM' ? 'LOW' : 'LOW') : riskLevel;

  return {
    level: adjustedRisk,
    leverage,
    confidence,
    recommendation: adjustedRisk === 'EXTREME' ? 'Riduci leva o capitale' :
                   adjustedRisk === 'HIGH' ? 'Usa stop loss stretto' :
                   adjustedRisk === 'MEDIUM' ? 'Monitora attentamente' :
                   'Rischio accettabile'
  };
}

interface RiskAssessment {
  level: 'LOW' | 'MEDIUM' | 'HIGH' | 'EXTREME';
  leverage: number;
  confidence: number;
  recommendation: string;
}
