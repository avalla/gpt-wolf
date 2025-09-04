import { TradeSignal } from '@gpt-wolf/db';

/**
 * Strategia aggressiva per l'esecuzione dei segnali di trading
 * Ottimizzata per massimizzare profitti con leve alte e gestione del rischio
 */
export class SignalExecutor {

  /**
   * Calcola SL, TP e parametri di trading per un segnale
   */
  static calculateTradeParams(signal: TradeSignal, riskPercentage: number = 2): TradeParams {
    const { symbol, direction, entryPrice, leverage, reason } = signal;

    // Calcola dimensione posizione basata sul rischio
    const positionSize = this.calculatePositionSize(entryPrice, leverage, riskPercentage);

    // Strategia basata sul tipo di segnale
    let strategy: TradeStrategy;

    if (reason.includes('liquidation') || reason.includes('Liquidation')) {
      strategy = this.getLiquidationHuntingStrategy(direction, entryPrice, leverage);
    } else if (reason.includes('volume') || reason.includes('spike')) {
      strategy = this.getVolumeSpikeStrategy(direction, entryPrice, leverage);
    } else if (reason.includes('funding') || reason.includes('Funding')) {
      strategy = this.getFundingRateStrategy(direction, entryPrice, leverage);
    } else {
      strategy = this.getDefaultAggressiveStrategy(direction, entryPrice, leverage);
    }

    return {
      symbol,
      direction,
      entryPrice,
      leverage,
      positionSize,
      stopLoss: strategy.stopLoss,
      takeProfits: strategy.takeProfits,
      trailingStop: strategy.trailingStop,
      maxHoldTime: strategy.maxHoldTime,
      riskReward: strategy.riskReward
    };
  }

  /**
   * Strategia per liquidation hunting - alta aggressività
   */
  private static getLiquidationHuntingStrategy(
    direction: string,
    entryPrice: number,
    leverage: number
  ): TradeStrategy {
    const riskDistance = 0.008; // 0.8% di rischio
    const isLong = direction === 'LONG';

    const stopLoss = isLong
      ? entryPrice * (1 - riskDistance)
      : entryPrice * (1 + riskDistance);

    // TP multipli per liquidation hunting
    const takeProfits = [
      {
        price: isLong
          ? entryPrice * (1 + 0.015) // +1.5%
          : entryPrice * (1 - 0.015), // -1.5%
        percentage: 40 // Chiudi 40% della posizione
      },
      {
        price: isLong
          ? entryPrice * (1 + 0.025) // +2.5%
          : entryPrice * (1 - 0.025), // -2.5%
        percentage: 35 // Chiudi altri 35%
      },
      {
        price: isLong
          ? entryPrice * (1 + 0.04) // +4%
          : entryPrice * (1 - 0.04), // -4%
        percentage: 25 // Chiudi il resto
      }
    ];

    return {
      stopLoss,
      takeProfits,
      trailingStop: {
        activationDistance: 0.02, // Attiva trailing a +2%
        trailDistance: 0.008 // Trail a 0.8%
      },
      maxHoldTime: 30 * 60 * 1000, // 30 minuti max
      riskReward: 3.1 // Target 3.1:1
    };
  }

  /**
   * Strategia per volume spike - momentum trading
   */
  private static getVolumeSpikeStrategy(
    direction: string,
    entryPrice: number,
    leverage: number
  ): TradeStrategy {
    const riskDistance = 0.012; // 1.2% di rischio per momentum
    const isLong = direction === 'LONG';

    const stopLoss = isLong
      ? entryPrice * (1 - riskDistance)
      : entryPrice * (1 + riskDistance);

    const takeProfits = [
      {
        price: isLong
          ? entryPrice * (1 + 0.02) // +2%
          : entryPrice * (1 - 0.02), // -2%
        percentage: 50 // Chiudi metà posizione
      },
      {
        price: isLong
          ? entryPrice * (1 + 0.035) // +3.5%
          : entryPrice * (1 - 0.035), // -3.5%
        percentage: 50 // Chiudi il resto
      }
    ];

    return {
      stopLoss,
      takeProfits,
      trailingStop: {
        activationDistance: 0.025, // Attiva trailing a +2.5%
        trailDistance: 0.01 // Trail a 1%
      },
      maxHoldTime: 45 * 60 * 1000, // 45 minuti max
      riskReward: 2.9
    };
  }

  /**
   * Strategia per funding rate arbitrage
   */
  private static getFundingRateStrategy(
    direction: string,
    entryPrice: number,
    leverage: number
  ): TradeStrategy {
    const riskDistance = 0.015; // 1.5% di rischio
    const isLong = direction === 'LONG';

    const stopLoss = isLong
      ? entryPrice * (1 - riskDistance)
      : entryPrice * (1 + riskDistance);

    const takeProfits = [
      {
        price: isLong
          ? entryPrice * (1 + 0.025) // +2.5%
          : entryPrice * (1 - 0.025), // -2.5%
        percentage: 60 // Chiudi 60%
      },
      {
        price: isLong
          ? entryPrice * (1 + 0.045) // +4.5%
          : entryPrice * (1 - 0.045), // -4.5%
        percentage: 40 // Chiudi il resto
      }
    ];

    return {
      stopLoss,
      takeProfits,
      trailingStop: {
        activationDistance: 0.03, // Attiva trailing a +3%
        trailDistance: 0.012 // Trail a 1.2%
      },
      maxHoldTime: 8 * 60 * 60 * 1000, // 8 ore max (per funding)
      riskReward: 3.0
    };
  }

  /**
   * Strategia aggressiva di default
   */
  private static getDefaultAggressiveStrategy(
    direction: string,
    entryPrice: number,
    leverage: number
  ): TradeStrategy {
    const riskDistance = 0.01; // 1% di rischio
    const isLong = direction === 'LONG';

    const stopLoss = isLong
      ? entryPrice * (1 - riskDistance)
      : entryPrice * (1 + riskDistance);

    const takeProfits = [
      {
        price: isLong
          ? entryPrice * (1 + 0.02) // +2%
          : entryPrice * (1 - 0.02), // -2%
        percentage: 50
      },
      {
        price: isLong
          ? entryPrice * (1 + 0.035) // +3.5%
          : entryPrice * (1 - 0.035), // -3.5%
        percentage: 50
      }
    ];

    return {
      stopLoss,
      takeProfits,
      trailingStop: {
        activationDistance: 0.025,
        trailDistance: 0.01
      },
      maxHoldTime: 60 * 60 * 1000, // 1 ora max
      riskReward: 3.5
    };
  }

  /**
   * Calcola la dimensione della posizione basata sul rischio
   */
  private static calculatePositionSize(
    entryPrice: number,
    leverage: number,
    riskPercentage: number
  ): number {
    // Calcola quanto capitale rischiare (es. 2% del portafoglio)
    const accountBalance = 1000; // TODO: Prendere da configurazione
    const riskAmount = accountBalance * (riskPercentage / 100);

    // Calcola la dimensione della posizione
    const stopDistance = 0.01; // 1% di stop loss medio
    const positionValue = riskAmount / stopDistance;

    return positionValue / entryPrice;
  }

  /**
   * Gestione dinamica del trailing stop
   */
  static updateTrailingStop(
    currentPrice: number,
    entryPrice: number,
    direction: string,
    currentStopLoss: number,
    trailingConfig: TrailingStopConfig
  ): number {
    const isLong = direction === 'LONG';
    const { activationDistance, trailDistance } = trailingConfig;

    // Calcola il profitto attuale
    const currentProfit = isLong
      ? (currentPrice - entryPrice) / entryPrice
      : (entryPrice - currentPrice) / entryPrice;

    // Attiva trailing solo se in profitto sufficiente
    if (currentProfit < activationDistance) {
      return currentStopLoss;
    }

    // Calcola nuovo trailing stop
    const newStopLoss = isLong
      ? currentPrice * (1 - trailDistance)
      : currentPrice * (1 + trailDistance);

    // Aggiorna solo se migliora lo stop loss
    if (isLong) {
      return Math.max(currentStopLoss, newStopLoss);
    } else {
      return Math.min(currentStopLoss, newStopLoss);
    }
  }
}

interface TradeParams {
  symbol: string;
  direction: string;
  entryPrice: number;
  leverage: number;
  positionSize: number;
  stopLoss: number;
  takeProfits: TakeProfit[];
  trailingStop: TrailingStopConfig;
  maxHoldTime: number;
  riskReward: number;
}

interface TradeStrategy {
  stopLoss: number;
  takeProfits: TakeProfit[];
  trailingStop: TrailingStopConfig;
  maxHoldTime: number;
  riskReward: number;
}

interface TakeProfit {
  price: number;
  percentage: number; // Percentuale della posizione da chiudere
}

interface TrailingStopConfig {
  activationDistance: number; // Distanza minima per attivare trailing
  trailDistance: number; // Distanza del trailing stop
}
