import { getOptimalTimeframe, calculateSignalValidity, getOptimalOrderType, createTimeFields } from './strategy-utils';

interface MarketSummary {
  symbol: string;
  price: number;
  volume24h: number;
  change24h: number;
  fundingRate: number;
  nextFundingTime: number;
  openInterest: number;
  liquidations24h?: {
    buyQty: number;
    sellQty: number;
    total: number;
  };
}

interface TradeSignal {
  symbol: string;
  direction: 'LONG' | 'SHORT';
  entryPrice: number;
  targetPrice: number;
  stopLoss: number;
  leverage: number;
  orderType: 'Market' | 'Limit' | 'Conditional' | 'TWAP' | 'Iceberg';
  reason: string;
  timestamp: number;
  timeframe: string;
  validUntil: number;
  createdAt: string;
  expiresAt: string;
}

interface StrategyConfig {
  defaultLeverage: number;
  maxLeverage: number;
  riskPercentage: number;
}

/**
 * Strategia di momentum aggressiva
 * Cerca movimenti di prezzo significativi e apre posizioni nella direzione del trend
 * con leva alta (25x-100x)
 */
export function momentumStrategy(
  markets: MarketSummary[],
  config: StrategyConfig
): TradeSignal[] {
  const signals: TradeSignal[] = [];
  const timeframe = getOptimalTimeframe('momentum');
  const validUntil = calculateSignalValidity(timeframe);

  // Filtra per movimenti di prezzo significativi (>5%)
  const significantMoves = markets
    .filter(m => Math.abs(m.change24h) > 5 && m.volume24h > 5000000) // >5% nelle 24h e volume >$5M
    .sort((a, b) => Math.abs(b.change24h) - Math.abs(a.change24h));

  // Genera segnali per i top 3 movimenti
  significantMoves.slice(0, 3).forEach(market => {
    // Determina la direzione del trend
    const direction = market.change24h > 0 ? 'LONG' : 'SHORT';

    // Calcola la leva in base alla volatilità
    // Più bassa è la variazione %, più alta è la leva (fino al massimo)
    const baseLeverage = Math.min(Math.round(50 / Math.abs(market.change24h) * 10), config.maxLeverage);
    // Assicurati che la leva sia almeno 25x come richiesto
    const leverage = Math.max(25, baseLeverage);

    const orderType = getOptimalOrderType('momentum', leverage, 'MEDIUM');
    const timeFields = createTimeFields(timeframe, validUntil);

    // Calcola target e stop loss aggressivi
    const entryPrice = market.price;
    const stopLossPercentage = 100 / leverage * 0.8; // 80% del margine disponibile
    const takeProfitPercentage = stopLossPercentage * 3; // Rapporto rischio/rendimento 1:3

    // Calcola prezzi target e stop loss
    const targetPrice = direction === 'LONG'
      ? entryPrice * (1 + takeProfitPercentage / 100)
      : entryPrice * (1 - takeProfitPercentage / 100);

    const stopLoss = direction === 'LONG'
      ? entryPrice * (1 - stopLossPercentage / 100)
      : entryPrice * (1 + stopLossPercentage / 100);

    signals.push({
      symbol: market.symbol,
      direction,
      entryPrice,
      targetPrice,
      stopLoss,
      leverage,
      orderType,
      reason: `Momentum ${direction} - Variazione 24h: ${market.change24h.toFixed(2)}%`,
      ...timeFields
    });
  });

  return signals;
}
