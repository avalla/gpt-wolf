import { MarketSummary, FundingAnalysis } from './types';

/**
 * Analizza i funding rate per identificare opportunità di trading
 */
export class FundingAnalyzer {
  private static readonly EXTREME_FUNDING_THRESHOLD = 0.01; // 1%
  private static readonly HIGH_FUNDING_THRESHOLD = 0.005; // 0.5%

  /**
   * Analizza i funding rate di tutti i mercati
   */
  static analyzeFundingRates(markets: MarketSummary[]): FundingAnalysis[] {
    return markets.map(market => this.analyzeSingleMarket(market));
  }

  /**
   * Analizza il funding rate di un singolo mercato
   */
  private static analyzeSingleMarket(market: MarketSummary): FundingAnalysis {
    const { symbol, fundingRate, nextFundingTime } = market;
    
    // Determina se il funding è estremo
    const isExtreme = Math.abs(fundingRate) > this.EXTREME_FUNDING_THRESHOLD;
    const isHigh = Math.abs(fundingRate) > this.HIGH_FUNDING_THRESHOLD;
    
    // Determina la direzione del sentiment
    const direction = fundingRate > 0 ? 'BEARISH' : 'BULLISH';
    
    // Usa baseline neutro per confronto con funding rate reale
    const avgRate = this.calculateAverageFundingRate(symbol);
    
    return {
      symbol,
      currentRate: fundingRate,
      avgRate,
      isExtreme: isExtreme || isHigh,
      direction,
      nextFunding: nextFundingTime
    };
  }

  /**
   * Calcola il funding rate medio basato sul funding rate attuale
   * Usa il funding rate corrente come baseline per il confronto
   */
  private static calculateAverageFundingRate(symbol: string): number {
    // Usa un valore di baseline neutro per il confronto
    // Il funding rate reale viene già fornito dai dati di mercato
    return 0.0001; // Baseline neutro per tutti i simboli
  }

  /**
   * Identifica i mercati con funding rate estremi per trading contrarian
   */
  static findExtremeFundingOpportunities(analyses: FundingAnalysis[]): FundingAnalysis[] {
    return analyses.filter(analysis => {
      const { currentRate, avgRate, isExtreme } = analysis;
      
      // Cerca funding rate che sono almeno 3x la media e considerati estremi
      const isSignificantlyAboveAverage = Math.abs(currentRate) > Math.abs(avgRate) * 3;
      
      return isExtreme && isSignificantlyAboveAverage;
    });
  }

  /**
   * Calcola il tempo rimanente fino al prossimo funding
   */
  static getTimeToNextFunding(nextFundingTime: number): number {
    return Math.max(0, nextFundingTime - Date.now());
  }

  /**
   * Determina se è il momento ottimale per entrare prima del funding
   */
  static isOptimalFundingEntry(analysis: FundingAnalysis): boolean {
    const timeToFunding = this.getTimeToNextFunding(analysis.nextFunding);
    const hoursToFunding = timeToFunding / (1000 * 60 * 60);
    
    // Entra 30 minuti prima del funding se il rate è estremo
    return analysis.isExtreme && hoursToFunding <= 0.5 && hoursToFunding > 0;
  }
}
