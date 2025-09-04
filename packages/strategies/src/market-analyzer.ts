import { MarketSummary, StrategyConfig } from '@gpt-wolf/db';

export interface StrategyOpportunity {
  strategyName: string;
  symbol: string;
  confidence: number; // 0-100
  reason: string;
  marketConditions: string[];
  recommendedLeverage: number;
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH';
  timeframe: string;
}

export interface MarketAnalysis {
  timestamp: number;
  totalSymbols: number;
  activeOpportunities: StrategyOpportunity[];
  marketSentiment: 'BULLISH' | 'BEARISH' | 'NEUTRAL';
  volatilityLevel: 'LOW' | 'MEDIUM' | 'HIGH';
  recommendedStrategies: string[];
}

/**
 * Analizza le condizioni di mercato e identifica le strategie applicabili
 */
export class MarketAnalyzer {
  
  /**
   * Analizza tutti i mercati e identifica le opportunità di trading
   */
  analyzeMarkets(markets: MarketSummary[], config: StrategyConfig): MarketAnalysis {
    const opportunities: StrategyOpportunity[] = [];
    const now = Date.now();

    // Analizza ogni mercato per opportunità
    for (const market of markets) {
      opportunities.push(...this.analyzeMarketForOpportunities(market, config));
    }

    // Calcola sentiment generale
    const sentiment = this.calculateMarketSentiment(markets);
    const volatility = this.calculateVolatilityLevel(markets);
    
    // Raccomanda strategie basate sulle condizioni
    const recommendedStrategies = this.getRecommendedStrategies(opportunities, sentiment, volatility);

    return {
      timestamp: now,
      totalSymbols: markets.length,
      activeOpportunities: opportunities.sort((a, b) => b.confidence - a.confidence),
      marketSentiment: sentiment,
      volatilityLevel: volatility,
      recommendedStrategies
    };
  }

  /**
   * Analizza un singolo mercato per identificare opportunità
   */
  private analyzeMarketForOpportunities(market: MarketSummary, config: StrategyConfig): StrategyOpportunity[] {
    const opportunities: StrategyOpportunity[] = [];

    // 1. Scalping Ultrarapido
    if (this.isScalpingOpportunity(market)) {
      opportunities.push({
        strategyName: 'Scalping Ultrarapido',
        symbol: market.symbol,
        confidence: this.calculateScalpingConfidence(market),
        reason: `Spike ${market.change1m?.toFixed(2)}% in 1m con volume elevato`,
        marketConditions: ['Volume spike', 'Micro-breakout', 'Low funding'],
        recommendedLeverage: 85,
        riskLevel: 'HIGH',
        timeframe: '1m-5m'
      });
    }

    // 2. Liquidation Hunt
    if (this.isLiquidationOpportunity(market, config)) {
      opportunities.push({
        strategyName: 'Liquidation Hunt',
        symbol: market.symbol,
        confidence: this.calculateLiquidationConfidence(market),
        reason: 'Cluster di liquidazioni rilevato',
        marketConditions: ['Liquidation cluster', 'High volume', 'Price spike'],
        recommendedLeverage: 100,
        riskLevel: 'HIGH',
        timeframe: '1m-3m'
      });
    }

    // 3. Funding Rate Arbitrage
    if (this.isFundingOpportunity(market)) {
      opportunities.push({
        strategyName: 'Funding Arbitrage',
        symbol: market.symbol,
        confidence: this.calculateFundingConfidence(market),
        reason: `Funding rate estremo: ${(market.fundingRate * 100).toFixed(3)}%`,
        marketConditions: ['Extreme funding', 'Market imbalance'],
        recommendedLeverage: 50,
        riskLevel: 'MEDIUM',
        timeframe: '8h'
      });
    }

    // 4. Volume Anomaly
    if (this.isVolumeAnomalyOpportunity(market)) {
      opportunities.push({
        strategyName: 'Volume Anomaly',
        symbol: market.symbol,
        confidence: this.calculateVolumeConfidence(market),
        reason: `Volume 24h: $${(market.volume24h / 1000000).toFixed(1)}M (anomalia)`,
        marketConditions: ['Volume anomaly', 'Price momentum'],
        recommendedLeverage: 75,
        riskLevel: 'MEDIUM',
        timeframe: '5m-15m'
      });
    }

    // 5. News Momentum
    if (this.isNewsOpportunity(market)) {
      opportunities.push({
        strategyName: 'News Momentum',
        symbol: market.symbol,
        confidence: this.calculateNewsConfidence(market),
        reason: 'Breakout da news con momentum forte',
        marketConditions: ['News spike', 'Strong momentum'],
        recommendedLeverage: 75,
        riskLevel: 'HIGH',
        timeframe: '1m-10m'
      });
    }

    return opportunities;
  }

  // Metodi di valutazione delle opportunità
  private isScalpingOpportunity(market: MarketSummary): boolean {
    return !!(
      market.change1m !== undefined && 
      market.volume1m !== undefined && 
      market.avgVolume5m !== undefined &&
      Math.abs(market.change1m) > 0.25 &&
      market.volume1m > market.avgVolume5m * 2 &&
      Math.abs(market.fundingRate) < 0.001
    );
  }

  private isLiquidationOpportunity(market: MarketSummary, config: StrategyConfig): boolean {
    return !!(
      market.liquidationCluster &&
      market.liquidationVolume &&
      config.liquidationVolumeThreshold &&
      market.liquidationVolume > config.liquidationVolumeThreshold
    );
  }

  private isFundingOpportunity(market: MarketSummary): boolean {
    return Math.abs(market.fundingRate) > 0.001; // >0.1%
  }

  private isVolumeAnomalyOpportunity(market: MarketSummary): boolean {
    return market.volume24h > 50000000 && Math.abs(market.change24h) > 3;
  }

  private isNewsOpportunity(market: MarketSummary): boolean {
    return !!(market.newsSpike && market.priceChange && Math.abs(market.priceChange) > 2);
  }

  // Calcolo confidence scores
  private calculateScalpingConfidence(market: MarketSummary): number {
    let confidence = 60;
    if (market.change1m && Math.abs(market.change1m) > 0.5) confidence += 20;
    if (market.volume1m && market.avgVolume5m && market.volume1m > market.avgVolume5m * 3) confidence += 15;
    if (Math.abs(market.fundingRate) < 0.0005) confidence += 5;
    return Math.min(confidence, 95);
  }

  private calculateLiquidationConfidence(market: MarketSummary): number {
    let confidence = 75;
    if (market.liquidationVolume && market.liquidationVolume > 1000000) confidence += 15;
    if (Math.abs(market.change24h) > 5) confidence += 10;
    return Math.min(confidence, 95);
  }

  private calculateFundingConfidence(market: MarketSummary): number {
    const fundingAbs = Math.abs(market.fundingRate);
    if (fundingAbs > 0.002) return 85; // >0.2%
    if (fundingAbs > 0.0015) return 70; // >0.15%
    if (fundingAbs > 0.001) return 55; // >0.1%
    return 30;
  }

  private calculateVolumeConfidence(market: MarketSummary): number {
    let confidence = 50;
    if (market.volume24h > 100000000) confidence += 20; // >100M
    if (Math.abs(market.change24h) > 5) confidence += 15;
    if (Math.abs(market.change24h) > 10) confidence += 10;
    return Math.min(confidence, 90);
  }

  private calculateNewsConfidence(market: MarketSummary): number {
    let confidence = 70;
    if (market.priceChange && Math.abs(market.priceChange) > 5) confidence += 15;
    if (market.volume24h > 50000000) confidence += 10;
    return Math.min(confidence, 90);
  }

  // Analisi sentiment e volatilità
  private calculateMarketSentiment(markets: MarketSummary[]): 'BULLISH' | 'BEARISH' | 'NEUTRAL' {
    const changes = markets.map(m => m.change24h).filter(c => !isNaN(c));
    const avgChange = changes.reduce((sum, c) => sum + c, 0) / changes.length;
    
    if (avgChange > 2) return 'BULLISH';
    if (avgChange < -2) return 'BEARISH';
    return 'NEUTRAL';
  }

  private calculateVolatilityLevel(markets: MarketSummary[]): 'LOW' | 'MEDIUM' | 'HIGH' {
    const changes = markets.map(m => Math.abs(m.change24h)).filter(c => !isNaN(c));
    const avgVolatility = changes.reduce((sum, c) => sum + c, 0) / changes.length;
    
    if (avgVolatility > 8) return 'HIGH';
    if (avgVolatility > 4) return 'MEDIUM';
    return 'LOW';
  }

  private getRecommendedStrategies(
    opportunities: StrategyOpportunity[], 
    sentiment: string, 
    volatility: string
  ): string[] {
    const strategies: string[] = [];
    
    // Conta opportunità per strategia
    const strategyCounts = opportunities.reduce((acc, opp) => {
      acc[opp.strategyName] = (acc[opp.strategyName] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    // Raccomanda strategie con più opportunità
    Object.entries(strategyCounts)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 3)
      .forEach(([strategy]) => strategies.push(strategy));

    // Aggiungi raccomandazioni basate su condizioni di mercato
    if (volatility === 'HIGH') {
      if (!strategies.includes('Scalping Ultrarapido')) {
        strategies.push('Scalping Ultrarapido');
      }
    }

    if (sentiment === 'BULLISH' || sentiment === 'BEARISH') {
      if (!strategies.includes('News Momentum')) {
        strategies.push('News Momentum');
      }
    }

    return strategies.slice(0, 4);
  }
}
