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

interface Ticker {
  lastPrice: string;
  priceChangePercent: string;
}

/**
 * Leve realistiche basate sui limiti Bybit
 */
function getRealisticLeverage(symbol: string, fundingRate: number): number {
  const leverageLimits: Record<string, number> = {
    'BTCUSDT': 100, 'ETHUSDT': 100, 'SOLUSDT': 50, 'ADAUSDT': 50,
    'AVAXUSDT': 25, 'LINKUSDT': 25, 'DOGEUSDT': 25,
    'RADUSDT': 12.5, // Limite reale per RADUSDT
  };

  const maxLeverage = leverageLimits[symbol] || 20; // Default conservativo
  const fundingBasedLeverage = Math.abs(fundingRate) * 20000; // Scala ridotta

  return Math.max(5, Math.min(Math.floor(fundingBasedLeverage), maxLeverage));
}

/**
 * Determina il tipo di ordine ottimale per funding rate
 */
function getOptimalOrderType(fundingRate: number, leverage: number): 'Market' | 'Limit' | 'Conditional' | 'TWAP' | 'Iceberg' {
  // Per funding rate estremi usiamo ordini aggressivi
  if (Math.abs(fundingRate) > 0.002) {
    return leverage > 25 ? 'Conditional' : 'Market'; // Conditional per leve alte
  }

  // Per funding moderati usiamo limit orders
  if (Math.abs(fundingRate) > 0.001) {
    return 'Limit';
  }

  return 'TWAP'; // Per funding bassi, accumula gradualmente
}

/**
 * Strategia basata sui funding rate
 * Cerca contratti con funding rate estremi e apre posizioni contro il mercato
 * con leve realistiche disponibili su Bybit
 */
export function fundingRateStrategy(
  markets: MarketSummary[],
  config: StrategyConfig,
  tickers: Ticker[]
): TradeSignal[] {
  const signals: TradeSignal[] = [];
  const now = Date.now();

  // Filtra per funding rate estremi (>0.1% è considerato alto)
  const extremeFunding = markets
    .filter(m => Math.abs(m.fundingRate) > 0.001 && m.volume24h > 1000000) // >0.1% e volume >$1M
    .sort((a, b) => Math.abs(b.fundingRate) - Math.abs(a.fundingRate));

  // Genera segnali per i top 3 funding rate estremi
  extremeFunding.slice(0, 3).forEach(market => {
    const ticker = tickers.find(t => t.symbol === market.symbol);
    if (!ticker) return;

    // Calcola entry price ottimale basato su funding rate e volatilità
    const currentPrice = parseFloat(ticker.lastPrice);
    const volatility = parseFloat(ticker.priceChangePercent) / 100;

    // Per funding rate negativo (short squeeze), entry leggermente sopra prezzo corrente
    // Per funding rate positivo (long squeeze), entry leggermente sotto prezzo corrente
    let optimalEntry: number;
    if (market.fundingRate < 0) {
      // Short squeeze - aspetta breakout sopra resistenza
      optimalEntry = currentPrice * (1 + Math.abs(volatility) * 0.3);
    } else {
      // Long squeeze - aspetta pullback sotto supporto
      optimalEntry = currentPrice * (1 - Math.abs(volatility) * 0.3);
    }

    const direction = market.fundingRate < 0 ? 'LONG' : 'SHORT';
    const leverage = getRealisticLeverage(market.symbol, market.fundingRate);

    // Calcola TP e SL basati su entry ottimale
    const targetPrice = direction === 'LONG'
      ? optimalEntry * (1 + (Math.abs(market.fundingRate) * leverage * 0.8))
      : optimalEntry * (1 - (Math.abs(market.fundingRate) * leverage * 0.8));

    const stopLoss = direction === 'LONG'
      ? optimalEntry * (1 - (Math.abs(market.fundingRate) * 2))
      : optimalEntry * (1 + (Math.abs(market.fundingRate) * 2));

    const timeframe = '1h'; // Timeframe di riferimento per funding rate
    const validUntil = now + (8 * 60 * 60 * 1000); // Funding rate si aggiorna ogni 8h
    const orderType = getOptimalOrderType(market.fundingRate, leverage);
    const timeFields = {
      createdAt: new Date(now).toLocaleString('it-IT'),
      expiresAt: new Date(validUntil).toLocaleString('it-IT')
    };

    signals.push({
      symbol: market.symbol,
      direction,
      entryPrice: optimalEntry,
      targetPrice,
      stopLoss,
      leverage,
      reason: `Funding rate ${(market.fundingRate * 100).toFixed(4)}% - ${direction === 'LONG' ? 'Short squeeze' : 'Long squeeze'} previsto`,
      timestamp: now,
      timeframe,
      validUntil,
      orderType,
      ...timeFields
    });
  });

  return signals;
}
