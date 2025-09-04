import { MarketAnalyzer, MarketAnalysis, StrategyOpportunity } from '@gpt-wolf/strategies/src/market-analyzer';
import { MarketSummary, StrategyConfig } from '@gpt-wolf/db';
import { runMarketScan } from './scanner';

/**
 * Scanner avanzato che analizza le condizioni di mercato e identifica opportunità
 */
export class AdvancedMarketScanner {
  private analyzer: MarketAnalyzer;
  private config: StrategyConfig;

  constructor(config: StrategyConfig) {
    this.analyzer = new MarketAnalyzer();
    this.config = config;
  }

  /**
   * Esegue una scansione completa del mercato e analizza le opportunità
   */
  async performMarketAnalysis(): Promise<MarketAnalysis> {
    console.log('\n🔍 === ANALISI AVANZATA DEL MERCATO ===');
    console.log('📊 Scansione in corso...');

    // Ottieni dati di mercato
    const markets = await runMarketScan();
    
    // Analizza opportunità
    const analysis = this.analyzer.analyzeMarkets(markets, this.config);
    
    // Stampa report
    this.printAnalysisReport(analysis);
    
    return analysis;
  }

  /**
   * Stampa un report dettagliato dell'analisi
   */
  private printAnalysisReport(analysis: MarketAnalysis): void {
    console.log('\n📈 === REPORT ANALISI MERCATO ===');
    console.log(`⏰ Timestamp: ${new Date(analysis.timestamp).toLocaleString()}`);
    console.log(`📊 Simboli analizzati: ${analysis.totalSymbols}`);
    console.log(`🎯 Opportunità trovate: ${analysis.activeOpportunities.length}`);
    console.log(`📈 Sentiment: ${this.getSentimentEmoji(analysis.marketSentiment)} ${analysis.marketSentiment}`);
    console.log(`⚡ Volatilità: ${this.getVolatilityEmoji(analysis.volatilityLevel)} ${analysis.volatilityLevel}`);

    // Strategie raccomandate
    console.log('\n🎯 === STRATEGIE RACCOMANDATE ===');
    if (analysis.recommendedStrategies.length > 0) {
      analysis.recommendedStrategies.forEach((strategy, index) => {
        console.log(`${index + 1}. ${strategy}`);
      });
    } else {
      console.log('❌ Nessuna strategia raccomandata al momento');
    }

    // Top opportunità
    console.log('\n🚀 === TOP OPPORTUNITÀ ===');
    const topOpportunities = analysis.activeOpportunities.slice(0, 10);
    
    if (topOpportunities.length > 0) {
      topOpportunities.forEach((opp, index) => {
        console.log(`\n${index + 1}. ${opp.symbol} - ${opp.strategyName}`);
        console.log(`   🎯 Confidence: ${opp.confidence}%`);
        console.log(`   📊 Leva consigliata: ${opp.recommendedLeverage}x`);
        console.log(`   ⚠️  Rischio: ${opp.riskLevel}`);
        console.log(`   ⏱️  Timeframe: ${opp.timeframe}`);
        console.log(`   💡 Motivo: ${opp.reason}`);
        console.log(`   🔍 Condizioni: ${opp.marketConditions.join(', ')}`);
      });
    } else {
      console.log('❌ Nessuna opportunità ad alta confidence trovata');
    }

    // Statistiche per strategia
    console.log('\n📊 === STATISTICHE PER STRATEGIA ===');
    const strategyStats = this.calculateStrategyStats(analysis.activeOpportunities);
    Object.entries(strategyStats).forEach(([strategy, stats]) => {
      console.log(`${strategy}: ${stats.count} opportunità (avg confidence: ${stats.avgConfidence.toFixed(1)}%)`);
    });

    // Consigli operativi
    console.log('\n💡 === CONSIGLI OPERATIVI ===');
    this.printOperationalAdvice(analysis);
  }

  /**
   * Calcola statistiche per strategia
   */
  private calculateStrategyStats(opportunities: StrategyOpportunity[]): Record<string, {count: number, avgConfidence: number}> {
    const stats: Record<string, {count: number, totalConfidence: number}> = {};
    
    opportunities.forEach(opp => {
      if (!stats[opp.strategyName]) {
        stats[opp.strategyName] = { count: 0, totalConfidence: 0 };
      }
      stats[opp.strategyName].count++;
      stats[opp.strategyName].totalConfidence += opp.confidence;
    });

    return Object.fromEntries(
      Object.entries(stats).map(([strategy, data]) => [
        strategy,
        {
          count: data.count,
          avgConfidence: data.totalConfidence / data.count
        }
      ])
    );
  }

  /**
   * Fornisce consigli operativi basati sull'analisi
   */
  private printOperationalAdvice(analysis: MarketAnalysis): void {
    const highConfidenceOpps = analysis.activeOpportunities.filter(opp => opp.confidence > 80);
    const mediumRiskOpps = analysis.activeOpportunities.filter(opp => opp.riskLevel === 'MEDIUM');

    if (analysis.volatilityLevel === 'HIGH') {
      console.log('⚡ Alta volatilità rilevata - Considera scalping ultrarapido con SL stretti');
    }

    if (analysis.marketSentiment === 'BULLISH') {
      console.log('📈 Mercato bullish - Favorisci posizioni LONG su breakout');
    } else if (analysis.marketSentiment === 'BEARISH') {
      console.log('📉 Mercato bearish - Considera posizioni SHORT su breakdown');
    }

    if (highConfidenceOpps.length > 0) {
      console.log(`🎯 ${highConfidenceOpps.length} opportunità ad alta confidence (>80%) disponibili`);
    }

    if (mediumRiskOpps.length > 0) {
      console.log(`⚖️  ${mediumRiskOpps.length} opportunità a rischio medio per trader conservativi`);
    }

    if (analysis.activeOpportunities.length === 0) {
      console.log('⏳ Mercato laterale - Attendi setup migliori o considera funding arbitrage');
    }
  }

  private getSentimentEmoji(sentiment: string): string {
    switch (sentiment) {
      case 'BULLISH': return '🟢';
      case 'BEARISH': return '🔴';
      default: return '🟡';
    }
  }

  private getVolatilityEmoji(volatility: string): string {
    switch (volatility) {
      case 'HIGH': return '🔥';
      case 'MEDIUM': return '⚡';
      default: return '😴';
    }
  }
}

/**
 * Funzione helper per eseguire una scansione rapida
 */
export async function performQuickScan(): Promise<MarketAnalysis> {
  const config: StrategyConfig = {
    defaultLeverage: parseInt(process.env.DEFAULT_LEVERAGE || '50'),
    maxLeverage: parseInt(process.env.MAX_LEVERAGE || '100'),
    riskPercentage: parseFloat(process.env.RISK_PERCENTAGE || '5'),
    maxConcurrentPositions: parseInt(process.env.MAX_CONCURRENT_POSITIONS || '5'),
    liquidationVolumeThreshold: 1000000,
    newsMomentumThreshold: 3,
    priceChangeThreshold: 2,
    fundingExtremeThreshold: 0.001,
    priceMomentumThreshold: 2,
    volumeDivergenceThreshold: 0.5
  };

  const scanner = new AdvancedMarketScanner(config);
  return await scanner.performMarketAnalysis();
}
