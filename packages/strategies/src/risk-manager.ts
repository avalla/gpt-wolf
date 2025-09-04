import { SignalExecutor } from './signal-executor';

/**
 * Gestione avanzata del rischio per trading aggressivo
 * Ottimizzato per leve alte (25-100x) e massimizzazione profitti
 */
export class RiskManager {

  /**
   * Calcola la leva ottimale basata sul segnale e volatilità
   */
  static calculateOptimalLeverage(
    signal: any,
    marketVolatility: number,
    maxLeverage: number = 100
  ): number {
    let baseLeverage = 50; // Leva base aggressiva

    // Aggiusta leva basata sul tipo di segnale
    if (signal.reason.includes('liquidation')) {
      baseLeverage = 75; // Liquidation hunting = leva alta
    } else if (signal.reason.includes('volume')) {
      baseLeverage = 60; // Volume spike = leva medio-alta
    } else if (signal.reason.includes('funding')) {
      baseLeverage = 40; // Funding rate = leva più conservativa
    }

    // Riduci leva se volatilità alta
    if (marketVolatility > 0.05) { // >5% volatilità
      baseLeverage *= 0.7;
    } else if (marketVolatility > 0.03) { // >3% volatilità
      baseLeverage *= 0.85;
    }

    return Math.min(Math.floor(baseLeverage), maxLeverage);
  }

  /**
   * Gestione portfolio con multiple posizioni
   */
  static calculatePortfolioRisk(
    activePositions: any[],
    newPosition: any,
    maxPortfolioRisk: number = 15 // 15% max rischio totale
  ): PortfolioRisk {
    let totalRisk = 0;
    let correlatedRisk = 0;

    // Calcola rischio attuale
    for (const position of activePositions) {
      const positionRisk = (position.size * position.leverage) / 100;
      totalRisk += positionRisk;

      // Controlla correlazione (stesso asset o settore)
      if (this.areCorrelated(position.symbol, newPosition.symbol)) {
        correlatedRisk += positionRisk;
      }
    }

    // Calcola rischio della nuova posizione
    const newPositionRisk = (newPosition.size * newPosition.leverage) / 100;
    const projectedTotalRisk = totalRisk + newPositionRisk;

    return {
      currentRisk: totalRisk,
      projectedRisk: projectedTotalRisk,
      correlatedRisk,
      isAcceptable: projectedTotalRisk <= maxPortfolioRisk,
      recommendedSize: this.calculateSafePositionSize(
        newPosition,
        maxPortfolioRisk - totalRisk
      )
    };
  }

  /**
   * Hedging automatico per posizioni correlate
   */
  static calculateHedgePosition(
    mainPosition: any,
    correlationFactor: number = 0.7
  ): HedgePosition | null {
    // Solo hedge per posizioni grandi (>$10k exposure)
    const exposure = mainPosition.size * mainPosition.entryPrice * mainPosition.leverage;
    if (exposure < 10000) return null;

    // Trova asset correlato per hedge
    const hedgeSymbol = this.findHedgeAsset(mainPosition.symbol);
    if (!hedgeSymbol) return null;

    // Calcola dimensione hedge (parziale, non 100%)
    const hedgeSize = mainPosition.size * correlationFactor * 0.3; // 30% hedge
    const hedgeDirection = mainPosition.side === 'LONG' ? 'SHORT' : 'LONG';

    return {
      symbol: hedgeSymbol,
      direction: hedgeDirection,
      size: hedgeSize,
      leverage: Math.min(mainPosition.leverage * 0.5, 25), // Leva ridotta per hedge
      purpose: 'CORRELATION_HEDGE',
      mainPositionId: mainPosition.id
    };
  }

  /**
   * Stop loss dinamico basato su volatilità
   */
  static calculateDynamicStopLoss(
    entryPrice: number,
    direction: string,
    marketVolatility: number,
    atr: number // Average True Range
  ): DynamicStopLoss {
    const isLong = direction === 'LONG';
    let stopDistance: number;

    // Base stop loss aggressivo
    if (marketVolatility < 0.02) { // Bassa volatilità
      stopDistance = 0.008; // 0.8%
    } else if (marketVolatility < 0.04) { // Media volatilità
      stopDistance = 0.012; // 1.2%
    } else { // Alta volatilità
      stopDistance = 0.018; // 1.8%
    }

    // Aggiusta con ATR per precisione
    const atrBasedStop = atr * 1.5; // 1.5x ATR
    stopDistance = Math.max(stopDistance, atrBasedStop / entryPrice);

    const stopPrice = isLong
      ? entryPrice * (1 - stopDistance)
      : entryPrice * (1 + stopDistance);

    return {
      initialStop: stopPrice,
      dynamicStop: stopPrice,
      maxDrawdown: stopDistance,
      atrMultiplier: 1.5,
      volatilityAdjusted: true
    };
  }

  /**
   * Gestione take profit scalati
   */
  static calculateScaledTakeProfit(
    entryPrice: number,
    direction: string,
    signalStrength: number, // 1-10
    marketMomentum: number
  ): ScaledTakeProfit[] {
    const isLong = direction === 'LONG';
    const baseTargets: ScaledTakeProfit[] = [];

    // TP1: Rapido (alta probabilità)
    const tp1Distance = 0.015 * signalStrength; // 1.5% base * forza segnale
    baseTargets.push({
      price: isLong
        ? entryPrice * (1 + tp1Distance)
        : entryPrice * (1 - tp1Distance),
      percentage: 30,
      priority: 'HIGH',
      timeTarget: 15 * 60 * 1000 // 15 minuti
    });

    // TP2: Medio (momentum)
    const tp2Distance = tp1Distance * 2.2;
    baseTargets.push({
      price: isLong
        ? entryPrice * (1 + tp2Distance)
        : entryPrice * (1 - tp2Distance),
      percentage: 40,
      priority: 'MEDIUM',
      timeTarget: 45 * 60 * 1000 // 45 minuti
    });

    // TP3: Esteso (solo con momentum forte)
    if (marketMomentum > 0.7) {
      const tp3Distance = tp1Distance * 4;
      baseTargets.push({
        price: isLong
          ? entryPrice * (1 + tp3Distance)
          : entryPrice * (1 - tp3Distance),
        percentage: 30,
        priority: 'LOW',
        timeTarget: 2 * 60 * 60 * 1000 // 2 ore
      });
    }

    return baseTargets;
  }

  /**
   * Controllo correlazione tra asset
   */
  private static areCorrelated(symbol1: string, symbol2: string): boolean {
    const crypto1 = symbol1.replace('USDT', '').replace('USD', '');
    const crypto2 = symbol2.replace('USDT', '').replace('USD', '');

    // Correlazioni note
    const correlationGroups = [
      ['BTC', 'ETH'], // Crypto majors
      ['ADA', 'DOT', 'ATOM'], // Layer 1s
      ['UNI', 'SUSHI', 'CAKE'], // DeFi
      ['SOL', 'AVAX', 'NEAR'], // Smart contracts
      ['DOGE', 'SHIB'] // Meme coins
    ];

    return correlationGroups.some(group =>
      group.includes(crypto1) && group.includes(crypto2)
    );
  }

  /**
   * Trova asset per hedging
   */
  private static findHedgeAsset(symbol: string): string | null {
    const crypto = symbol.replace('USDT', '').replace('USD', '');

    // Hedge mapping
    const hedgeMap: Record<string, string> = {
      'BTC': 'ETHUSDT',
      'ETH': 'BTCUSDT',
      'SOL': 'AVAXUSDT',
      'AVAX': 'SOLUSDT',
      'ADA': 'DOTUSDT',
      'DOT': 'ADAUSDT'
    };

    return hedgeMap[crypto] || null;
  }

  /**
   * Calcola dimensione posizione sicura
   */
  private static calculateSafePositionSize(
    position: any,
    availableRisk: number
  ): number {
    const maxSize = (availableRisk * 100) / position.leverage;
    return Math.min(position.size, maxSize);
  }
}

interface PortfolioRisk {
  currentRisk: number;
  projectedRisk: number;
  correlatedRisk: number;
  isAcceptable: boolean;
  recommendedSize: number;
}

interface HedgePosition {
  symbol: string;
  direction: string;
  size: number;
  leverage: number;
  purpose: string;
  mainPositionId: string;
}

interface DynamicStopLoss {
  initialStop: number;
  dynamicStop: number;
  maxDrawdown: number;
  atrMultiplier: number;
  volatilityAdjusted: boolean;
}

interface ScaledTakeProfit {
  price: number;
  percentage: number;
  priority: 'HIGH' | 'MEDIUM' | 'LOW';
  timeTarget: number; // milliseconds
}
