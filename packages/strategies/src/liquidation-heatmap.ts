import { MarketSummary } from '@gpt-wolf/db';
import { LiquidationAnalyzer } from './liquidation-analyzer';

/**
 * Sistema di heatmap per liquidation clusters
 * Genera dati per visualizzare zone di liquidazione ad alta densità
 */
export class LiquidationHeatmap {

  /**
   * Genera heatmap dei livelli di liquidazione per un simbolo
   */
  static generateHeatmap(
    market: MarketSummary,
    priceRange: { min: number; max: number },
    resolution: number = 100
  ): HeatmapData {
    const step = (priceRange.max - priceRange.min) / resolution;
    const levels: HeatmapLevel[] = [];

    // Calcola densità di liquidazioni per ogni livello di prezzo
    for (let i = 0; i <= resolution; i++) {
      const price = priceRange.min + (step * i);
      const density = this.calculateLiquidationDensity(market, price);

      levels.push({
        price,
        longLiquidations: density.longLiquidations,
        shortLiquidations: density.shortLiquidations,
        totalDensity: density.total,
        distanceFromCurrent: Math.abs(price - market.price) / market.price
      });
    }

    // Identifica zone ad alta densità (hotspots)
    const hotspots = this.findHotspots(levels);

    return {
      symbol: market.symbol,
      currentPrice: market.price,
      levels,
      hotspots,
      timestamp: Date.now()
    };
  }

  /**
   * Calcola densità di liquidazioni stimata per un livello di prezzo
   */
  private static calculateLiquidationDensity(
    market: MarketSummary,
    targetPrice: number
  ): LiquidationDensity {
    let longLiquidations = 0;
    let shortLiquidations = 0;

    const commonLeverages = [10, 20, 25, 50, 75, 100, 125];
    const tolerance = 0.005; // 0.5% tolerance

    for (const leverage of commonLeverages) {
      // Calcola dove sarebbero le liquidazioni per questo leverage
      const longLiqLevel = LiquidationAnalyzer.calculateLiquidationLevel(
        market.price, leverage, 'LONG'
      );
      const shortLiqLevel = LiquidationAnalyzer.calculateLiquidationLevel(
        market.price, leverage, 'SHORT'
      );

      // Se il target price è vicino a un livello di liquidazione, aumenta la densità
      const longDistance = Math.abs(targetPrice - longLiqLevel) / longLiqLevel;
      const shortDistance = Math.abs(targetPrice - shortLiqLevel) / shortLiqLevel;

      if (longDistance <= tolerance) {
        // Peso basato su popolarità del leverage e vicinanza al prezzo attuale
        const weight = this.calculateLeverageWeight(leverage, market.price, targetPrice);
        longLiquidations += weight;
      }

      if (shortDistance <= tolerance) {
        const weight = this.calculateLeverageWeight(leverage, market.price, targetPrice);
        shortLiquidations += weight;
      }
    }

    return {
      longLiquidations,
      shortLiquidations,
      total: longLiquidations + shortLiquidations
    };
  }

  /**
   * Calcola peso di un leverage basato su popolarità e distanza dal prezzo
   */
  private static calculateLeverageWeight(
    leverage: number,
    currentPrice: number,
    targetPrice: number
  ): number {
    // Leverage più popolari hanno peso maggiore
    const popularityWeights: { [key: number]: number } = {
      10: 0.8, 20: 1.2, 25: 1.5, 50: 2.0, 75: 1.8, 100: 1.5, 125: 1.0
    };

    const popularityWeight = popularityWeights[leverage] || 1.0;

    // Distanza dal prezzo attuale (più vicino = più peso)
    const distance = Math.abs(targetPrice - currentPrice) / currentPrice;
    const distanceWeight = Math.max(0.1, 1 - distance * 10); // Decade con la distanza

    return popularityWeight * distanceWeight;
  }

  /**
   * Identifica hotspots (zone ad alta densità di liquidazioni)
   */
  private static findHotspots(levels: HeatmapLevel[]): Hotspot[] {
    const hotspots: Hotspot[] = [];
    const threshold = this.calculateDensityThreshold(levels);

    let currentHotspot: HeatmapLevel[] = [];

    for (const level of levels) {
      if (level.totalDensity >= threshold) {
        currentHotspot.push(level);
      } else {
        if (currentHotspot.length >= 3) { // Almeno 3 livelli consecutivi
          const hotspot = this.createHotspot(currentHotspot);
          hotspots.push(hotspot);
        }
        currentHotspot = [];
      }
    }

    // Aggiungi l'ultimo hotspot se valido
    if (currentHotspot.length >= 3) {
      hotspots.push(this.createHotspot(currentHotspot));
    }

    return hotspots.sort((a, b) => b.intensity - a.intensity);
  }

  /**
   * Calcola soglia per identificare hotspots
   */
  private static calculateDensityThreshold(levels: HeatmapLevel[]): number {
    const densities = levels.map(l => l.totalDensity);
    const avgDensity = densities.reduce((a, b) => a + b, 0) / densities.length;
    const maxDensity = Math.max(...densities);

    // Soglia dinamica: 70% tra media e massimo
    return avgDensity + (maxDensity - avgDensity) * 0.7;
  }

  /**
   * Crea hotspot da un gruppo di livelli ad alta densità
   */
  private static createHotspot(levels: HeatmapLevel[]): Hotspot {
    const centerIndex = Math.floor(levels.length / 2);
    const center = levels[centerIndex];

    const totalIntensity = levels.reduce((sum, l) => sum + l.totalDensity, 0);
    const avgLongLiq = levels.reduce((sum, l) => sum + l.longLiquidations, 0) / levels.length;
    const avgShortLiq = levels.reduce((sum, l) => sum + l.shortLiquidations, 0) / levels.length;

    return {
      centerPrice: center.price,
      priceRange: {
        min: levels[0].price,
        max: levels[levels.length - 1].price
      },
      intensity: totalIntensity,
      dominantSide: avgLongLiq > avgShortLiq ? 'LONG' : 'SHORT',
      liquidationPotential: this.calculateLiquidationPotential(totalIntensity, center.distanceFromCurrent),
      distanceFromCurrent: center.distanceFromCurrent
    };
  }

  /**
   * Calcola potenziale di liquidazione (quanto probabile è che si verifichi)
   */
  private static calculateLiquidationPotential(
    intensity: number,
    distanceFromCurrent: number
  ): 'HIGH' | 'MEDIUM' | 'LOW' {
    const score = intensity * (1 - distanceFromCurrent * 5); // Penalizza distanza

    if (score > 10) return 'HIGH';
    if (score > 5) return 'MEDIUM';
    return 'LOW';
  }
}

// Interfaces
interface HeatmapData {
  symbol: string;
  currentPrice: number;
  levels: HeatmapLevel[];
  hotspots: Hotspot[];
  timestamp: number;
}

interface HeatmapLevel {
  price: number;
  longLiquidations: number;
  shortLiquidations: number;
  totalDensity: number;
  distanceFromCurrent: number;
}

interface LiquidationDensity {
  longLiquidations: number;
  shortLiquidations: number;
  total: number;
}

interface Hotspot {
  centerPrice: number;
  priceRange: { min: number; max: number };
  intensity: number;
  dominantSide: 'LONG' | 'SHORT';
  liquidationPotential: 'HIGH' | 'MEDIUM' | 'LOW';
  distanceFromCurrent: number;
}

export type { HeatmapData, HeatmapLevel, Hotspot };
