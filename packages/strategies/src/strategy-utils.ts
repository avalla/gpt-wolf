/**
 * Determina tipo di ordine ottimale
 */
export function getOptimalOrderType(
  strategyType: string,
  leverage: number,
  urgency: 'LOW' | 'MEDIUM' | 'HIGH',
  entryPrice?: number,
  currentPrice?: number
): 'Market' | 'Limit' | 'Conditional' | 'TWAP' | 'Iceberg' {

  // Se entry price è diverso dal prezzo corrente, usa ordine condizionale
  if (entryPrice && currentPrice && Math.abs(entryPrice - currentPrice) / currentPrice > 0.001) {
    // Se entry è sopra prezzo corrente (breakout) -> Conditional
    // Se entry è sotto prezzo corrente (pullback) -> Limit o Conditional
    if (entryPrice > currentPrice) {
      return 'Conditional'; // Stop order per breakout
    } else {
      return leverage > 25 ? 'Conditional' : 'Limit'; // Limit order per pullback
    }
  }

  // Ordini aggressivi per alta urgenza e leva
  if (urgency === 'HIGH' && leverage > 50) {
    return 'Conditional';
  }

  if (urgency === 'HIGH') {
    return 'Market';
  }

  // Scalping usa ordini rapidi
  if (strategyType === 'scalping' || strategyType === 'liquidation') {
    return leverage > 25 ? 'Conditional' : 'Market';
  }

  // Funding rate usa accumulo graduale
  if (strategyType === 'funding') {
    return 'Limit';
  }

  // Volume anomalies usano TWAP per non impattare il mercato
  if (strategyType === 'volume') {
    return 'TWAP';
  }

  // Default per strategie medie
  return 'Limit';
}

/**
 * Calcola validità del segnale basata sulla strategia
 */
export function calculateSignalValidity(strategyType: string): number {
  const now = Date.now();
  
  switch (strategyType) {
    case 'funding':
      return now + (8 * 60 * 60 * 1000); // 8 ore (prossimo funding)
    case 'scalping':
    case 'liquidation':
      return now + (5 * 60 * 1000); // 5 minuti
    case 'momentum':
    case 'aggressive':
      return now + (45 * 60 * 1000); // 45 minuti
    case 'volume':
      return now + (2 * 60 * 60 * 1000); // 2 ore
    default:
      return now + (60 * 60 * 1000); // 1 ora default
  }
}

/**
 * Determina timeframe ottimale per la strategia
 */
export function getOptimalTimeframe(strategyType: string): string {
  switch (strategyType) {
    case 'scalping':
    case 'liquidation':
      return '1m';
    case 'funding':
      return '1h';
    case 'momentum':
    case 'aggressive':
      return '15m';
    case 'volume':
      return '5m';
    default:
      return '15m';
  }
}

/**
 * Crea campi temporali per il segnale
 */
export function createTimeFields(validUntil: number) {
  const now = Date.now();
  return {
    createdAt: new Date(now).toLocaleString('it-IT'),
    expiresAt: new Date(validUntil).toLocaleString('it-IT')
  };
}

/**
 * Calcola leva ottimale basata su volatilità e funding rate
 */
export function getOptimalLeverage(symbol: string, fundingRate: number): number {
  const baseMultiplier = Math.abs(fundingRate) * 1000;
  
  // Leve conservative per BTC/ETH
  if (symbol.includes('BTC')) {
    return Math.min(Math.max(Math.floor(baseMultiplier * 20), 10), 50);
  }
  if (symbol.includes('ETH')) {
    return Math.min(Math.max(Math.floor(baseMultiplier * 25), 15), 75);
  }
  
  // Leve più aggressive per altcoin
  return Math.min(Math.max(Math.floor(baseMultiplier * 30), 20), 100);
}
