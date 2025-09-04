import { MarketSummary, LiquidationData } from './types';

/**
 * Analizza le liquidazioni per identificare opportunità di trading
 */
export class LiquidationAnalyzer {
  private static readonly SIGNIFICANT_LIQUIDATION_THRESHOLD = 100000; // $100k
  private static readonly MASSIVE_LIQUIDATION_THRESHOLD = 1000000; // $1M

  /**
   * Analizza le liquidazioni per identificare zone di supporto/resistenza
   */
  static analyzeLiquidations(markets: MarketSummary[]): Map<string, LiquidationAnalysis> {
    const analysisMap = new Map<string, LiquidationAnalysis>();

    for (const market of markets) {
      if (market.liquidations24h) {
        const analysis = this.analyzeSingleMarket(market);
        analysisMap.set(market.symbol, analysis);
      }
    }

    return analysisMap;
  }

  /**
   * Analizza le liquidazioni di un singolo mercato
   */
  private static analyzeSingleMarket(market: MarketSummary): LiquidationAnalysis {
    const { symbol, price, liquidations24h } = market;
    
    if (!liquidations24h) {
      return {
        symbol,
        totalLiquidations: 0,
        buyLiquidations: 0,
        sellLiquidations: 0,
        netLiquidations: 0,
        liquidationRatio: 0,
        isSignificant: false,
        isMassive: false,
        dominantSide: 'NEUTRAL',
        expectedDirection: 'NEUTRAL'
      };
    }

    const { buyQty, sellQty, total } = liquidations24h;
    const netLiquidations = sellQty - buyQty; // Positive = more shorts liquidated
    const liquidationRatio = buyQty > 0 ? sellQty / buyQty : sellQty > 0 ? Infinity : 0;
    
    const isSignificant = total > this.SIGNIFICANT_LIQUIDATION_THRESHOLD;
    const isMassive = total > this.MASSIVE_LIQUIDATION_THRESHOLD;
    
    // Determina il lato dominante delle liquidazioni
    let dominantSide: 'LONG' | 'SHORT' | 'NEUTRAL' = 'NEUTRAL';
    let expectedDirection: 'BULLISH' | 'BEARISH' | 'NEUTRAL' = 'NEUTRAL';
    
    if (Math.abs(netLiquidations) > total * 0.3) { // Almeno 30% di differenza
      if (netLiquidations > 0) {
        dominantSide = 'SHORT'; // Più short liquidati
        expectedDirection = 'BULLISH'; // Pressione di acquisto
      } else {
        dominantSide = 'LONG'; // Più long liquidati
        expectedDirection = 'BEARISH'; // Pressione di vendita
      }
    }

    return {
      symbol,
      totalLiquidations: total,
      buyLiquidations: buyQty,
      sellLiquidations: sellQty,
      netLiquidations,
      liquidationRatio,
      isSignificant,
      isMassive,
      dominantSide,
      expectedDirection
    };
  }

  /**
   * Trova i mercati con liquidazioni massive per trading di momentum
   */
  static findMassiveLiquidationOpportunities(
    analysisMap: Map<string, LiquidationAnalysis>
  ): LiquidationAnalysis[] {
    const opportunities: LiquidationAnalysis[] = [];

    for (const analysis of analysisMap.values()) {
      if (analysis.isMassive && analysis.expectedDirection !== 'NEUTRAL') {
        opportunities.push(analysis);
      }
    }

    // Ordina per volume di liquidazioni (più alto = più opportunità)
    return opportunities.sort((a, b) => b.totalLiquidations - a.totalLiquidations);
  }

  /**
   * Calcola il livello di liquidazione stimato per una posizione
   */
  static calculateLiquidationLevel(
    entryPrice: number,
    leverage: number,
    direction: 'LONG' | 'SHORT',
    maintenanceMargin: number = 0.005 // 0.5% default
  ): number {
    if (direction === 'LONG') {
      // Per long: liquidazione quando prezzo scende
      return entryPrice * (1 - (1 / leverage) + maintenanceMargin);
    } else {
      // Per short: liquidazione quando prezzo sale
      return entryPrice * (1 + (1 / leverage) - maintenanceMargin);
    }
  }

  /**
   * Identifica cluster di liquidazioni vicine al prezzo attuale
   */
  static findLiquidationClusters(
    currentPrice: number,
    liquidationLevels: number[],
    tolerance: number = 0.02 // 2%
  ): LiquidationCluster[] {
    const clusters: LiquidationCluster[] = [];
    const sortedLevels = [...liquidationLevels].sort((a, b) => a - b);
    
    let currentCluster: number[] = [];
    let clusterCenter = 0;
    
    for (const level of sortedLevels) {
      const distanceFromPrice = Math.abs(level - currentPrice) / currentPrice;
      
      if (distanceFromPrice <= tolerance) {
        if (currentCluster.length === 0) {
          clusterCenter = level;
          currentCluster = [level];
        } else {
          const distanceFromCenter = Math.abs(level - clusterCenter) / clusterCenter;
          if (distanceFromCenter <= tolerance) {
            currentCluster.push(level);
          } else {
            // Salva il cluster corrente e inizia uno nuovo
            if (currentCluster.length >= 2) {
              clusters.push({
                center: clusterCenter,
                levels: [...currentCluster],
                strength: currentCluster.length,
                distanceFromPrice: Math.abs(clusterCenter - currentPrice) / currentPrice
              });
            }
            clusterCenter = level;
            currentCluster = [level];
          }
        }
      }
    }
    
    // Aggiungi l'ultimo cluster se valido
    if (currentCluster.length >= 2) {
      clusters.push({
        center: clusterCenter,
        levels: currentCluster,
        strength: currentCluster.length,
        distanceFromPrice: Math.abs(clusterCenter - currentPrice) / currentPrice
      });
    }
    
    return clusters.sort((a, b) => a.distanceFromPrice - b.distanceFromPrice);
  }
}

interface LiquidationAnalysis {
  symbol: string;
  totalLiquidations: number;
  buyLiquidations: number;
  sellLiquidations: number;
  netLiquidations: number;
  liquidationRatio: number;
  isSignificant: boolean;
  isMassive: boolean;
  dominantSide: 'LONG' | 'SHORT' | 'NEUTRAL';
  expectedDirection: 'BULLISH' | 'BEARISH' | 'NEUTRAL';
}

interface LiquidationCluster {
  center: number;
  levels: number[];
  strength: number;
  distanceFromPrice: number;
}
