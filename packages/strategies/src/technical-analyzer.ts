import { MarketSummary } from './types';

/**
 * Analisi tecnica per identificare setup di trading ad alta probabilità
 */
export class TechnicalAnalyzer {
  private static readonly VOLATILITY_THRESHOLD = 0.05; // 5%
  private static readonly VOLUME_SPIKE_MULTIPLIER = 2.0;

  /**
   * Analizza la volatilità e identifica squeeze
   */
  static analyzeVolatility(markets: MarketSummary[]): VolatilityAnalysis[] {
    return markets.map(market => this.analyzeSingleMarketVolatility(market));
  }

  /**
   * Analizza la volatilità di un singolo mercato
   */
  private static analyzeSingleMarketVolatility(market: MarketSummary): VolatilityAnalysis {
    const { symbol, change24h, volume24h, price } = market;
    
    // Calcola volatilità basata sul cambio percentuale
    const volatility = Math.abs(change24h) / 100;
    
    // Determina se c'è un squeeze di volatilità (bassa volatilità prima di un breakout)
    const isLowVolatility = volatility < this.VOLATILITY_THRESHOLD / 2;
    const isHighVolatility = volatility > this.VOLATILITY_THRESHOLD;
    
    // Simula volume medio (in implementazione reale useresti dati storici)
    const avgVolume = this.getAverageVolume(symbol);
    const volumeRatio = volume24h / avgVolume;
    const isVolumeSpike = volumeRatio > this.VOLUME_SPIKE_MULTIPLIER;
    
    // Determina il tipo di setup
    let setupType: VolatilitySetup = 'NORMAL';
    if (isLowVolatility && isVolumeSpike) {
      setupType = 'SQUEEZE_BREAKOUT';
    } else if (isHighVolatility && isVolumeSpike) {
      setupType = 'MOMENTUM_CONTINUATION';
    } else if (isLowVolatility) {
      setupType = 'CONSOLIDATION';
    } else if (isHighVolatility) {
      setupType = 'HIGH_VOLATILITY';
    }

    return {
      symbol,
      volatility,
      volumeRatio,
      isVolumeSpike,
      setupType,
      breakoutPotential: this.calculateBreakoutPotential(volatility, volumeRatio, change24h)
    };
  }

  /**
   * Calcola il potenziale di breakout
   */
  private static calculateBreakoutPotential(
    volatility: number,
    volumeRatio: number,
    change24h: number
  ): number {
    let potential = 0;
    
    // Bassa volatilità + alto volume = alto potenziale di breakout
    if (volatility < this.VOLATILITY_THRESHOLD / 2 && volumeRatio > 1.5) {
      potential += 40;
    }
    
    // Volume spike aumenta il potenziale
    if (volumeRatio > this.VOLUME_SPIKE_MULTIPLIER) {
      potential += 30;
    }
    
    // Movimento direzionale forte
    if (Math.abs(change24h) > 3) {
      potential += 20;
    }
    
    // Momentum positivo
    if (change24h > 0) {
      potential += 10;
    }
    
    return Math.min(100, potential);
  }

  /**
   * Ottiene volume medio simulato
   */
  private static getAverageVolume(symbol: string): number {
    const baseVolumes: Record<string, number> = {
      'BTCUSDT': 1000000000, // 1B
      'ETHUSDT': 500000000,  // 500M
      'SOLUSDT': 100000000,  // 100M
      'ADAUSDT': 50000000,   // 50M
      'DOTUSDT': 30000000    // 30M
    };
    
    return baseVolumes[symbol] || 50000000;
  }

  /**
   * Identifica pattern di prezzo aggressivi
   */
  static identifyAggressivePatterns(markets: MarketSummary[]): AggressivePattern[] {
    const patterns: AggressivePattern[] = [];
    
    for (const market of markets) {
      const pattern = this.analyzeMarketPattern(market);
      if (pattern) {
        patterns.push(pattern);
      }
    }
    
    return patterns.sort((a, b) => b.confidence - a.confidence);
  }

  /**
   * Analizza pattern di un singolo mercato
   */
  private static analyzeMarketPattern(market: MarketSummary): AggressivePattern | null {
    const { symbol, change24h, volume24h, price, fundingRate } = market;
    
    // Pattern 1: Funding Rate Reversal
    if (Math.abs(fundingRate) > 0.005) {
      const direction = fundingRate > 0 ? 'SHORT' : 'LONG';
      return {
        symbol,
        type: 'FUNDING_REVERSAL',
        direction,
        confidence: 75,
        entryPrice: price,
        reason: `Funding rate estremo: ${(fundingRate * 100).toFixed(3)}%`
      };
    }
    
    // Pattern 2: Volume Breakout
    const avgVolume = this.getAverageVolume(symbol);
    if (volume24h > avgVolume * 3 && Math.abs(change24h) > 5) {
      const direction = change24h > 0 ? 'LONG' : 'SHORT';
      return {
        symbol,
        type: 'VOLUME_BREAKOUT',
        direction,
        confidence: 80,
        entryPrice: price,
        reason: `Volume breakout: ${(volume24h / avgVolume).toFixed(1)}x volume normale`
      };
    }
    
    // Pattern 3: Momentum Spike
    if (Math.abs(change24h) > 10) {
      const direction = change24h > 0 ? 'LONG' : 'SHORT';
      return {
        symbol,
        type: 'MOMENTUM_SPIKE',
        direction,
        confidence: 70,
        entryPrice: price,
        reason: `Momentum spike: ${change24h.toFixed(1)}% in 24h`
      };
    }
    
    return null;
  }

  /**
   * Calcola livelli di supporto e resistenza dinamici
   */
  static calculateDynamicLevels(
    currentPrice: number,
    volatility: number,
    volume: number
  ): DynamicLevels {
    const volatilityMultiplier = Math.max(1, volatility * 20);
    const volumeMultiplier = Math.max(1, Math.log10(volume / 1000000));
    
    const baseRange = currentPrice * 0.02; // 2% base
    const adjustedRange = baseRange * volatilityMultiplier * volumeMultiplier;
    
    return {
      resistance1: currentPrice + adjustedRange * 0.5,
      resistance2: currentPrice + adjustedRange,
      resistance3: currentPrice + adjustedRange * 1.5,
      support1: currentPrice - adjustedRange * 0.5,
      support2: currentPrice - adjustedRange,
      support3: currentPrice - adjustedRange * 1.5,
      pivot: currentPrice
    };
  }
}

type VolatilitySetup = 'SQUEEZE_BREAKOUT' | 'MOMENTUM_CONTINUATION' | 'CONSOLIDATION' | 'HIGH_VOLATILITY' | 'NORMAL';

interface VolatilityAnalysis {
  symbol: string;
  volatility: number;
  volumeRatio: number;
  isVolumeSpike: boolean;
  setupType: VolatilitySetup;
  breakoutPotential: number;
}

interface AggressivePattern {
  symbol: string;
  type: 'FUNDING_REVERSAL' | 'VOLUME_BREAKOUT' | 'MOMENTUM_SPIKE';
  direction: 'LONG' | 'SHORT';
  confidence: number;
  entryPrice: number;
  reason: string;
}

interface DynamicLevels {
  resistance1: number;
  resistance2: number;
  resistance3: number;
  support1: number;
  support2: number;
  support3: number;
  pivot: number;
}
