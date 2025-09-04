interface MarketSummary {
  symbol: string;
  price: number;
  volume24h: number;
  change24h: number;
  fundingRate: number;
  nextFundingTime: number;
  openInterest: number;
  // Orderbook data (simulated)
  bidVolume?: number;
  askVolume?: number;
  bidAskRatio?: number;
  spreadPercent?: number;
}

interface TradeSignal {
  symbol: string;
  direction: 'LONG' | 'SHORT';
  entryPrice: number;
  takeProfitPercent?: number;
  stopLossPercent?: number;
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
 * Simula dati orderbook basati su volume e volatilità
 */
function simulateOrderbookData(market: MarketSummary) {
  const baseVolume = market.volume24h / 24 / 60; // Volume per minuto
  const volatilityFactor = Math.abs(market.change24h) / 10;
  
  // Simula squilibrio basato su price change
  const imbalanceFactor = market.change24h > 0 ? 1.3 : 0.7;
  
  const bidVolume = baseVolume * imbalanceFactor * (1 + Math.random() * 0.3);
  const askVolume = baseVolume * (2 - imbalanceFactor) * (1 + Math.random() * 0.3);
  const bidAskRatio = bidVolume / (askVolume || 1);
  const spreadPercent = 0.01 + (volatilityFactor * 0.02); // 0.01-0.03%
  
  return { bidVolume, askVolume, bidAskRatio, spreadPercent };
}

/**
 * Calcola leva per orderbook imbalance
 */
function calculateImbalanceLeverage(imbalanceStrength: number, symbol: string): number {
  const leverageLimits: Record<string, number> = {
    'BTCUSDT': 100, 'ETHUSDT': 100, 'SOLUSDT': 75, 'ADAUSDT': 75,
    'AVAXUSDT': 60, 'LINKUSDT': 60, 'DOGEUSDT': 60,
  };

  const maxLeverage = leverageLimits[symbol] || 50;
  
  // Leva alta per imbalance forti (micro-scalping)
  const baseLeverage = 30;
  const imbalanceBonus = Math.floor(imbalanceStrength * 40); // Max +40x
  
  return Math.max(baseLeverage, Math.min(baseLeverage + imbalanceBonus, maxLeverage));
}

/**
 * Determina direzione per orderbook imbalance
 */
function getImbalanceDirection(bidAskRatio: number, spreadPercent: number): 'LONG' | 'SHORT' {
  // Bid/Ask ratio > 2 = più compratori, probabile pump
  if (bidAskRatio > 2 && spreadPercent < 0.02) {
    return 'LONG';
  }
  
  // Bid/Ask ratio < 0.5 = più venditori, probabile dump
  if (bidAskRatio < 0.5 && spreadPercent < 0.02) {
    return 'SHORT';
  }
  
  // Default basato su ratio
  return bidAskRatio > 1 ? 'LONG' : 'SHORT';
}

/**
 * Calcola TP/SL per micro-scalping
 */
function calculateScalpingTPSL(imbalanceStrength: number, spreadPercent: number) {
  // TP molto piccoli per scalping (0.1-0.5%)
  const baseTp = 0.15; // 0.15% base
  const tpPercent = baseTp + (imbalanceStrength * 0.2); // Max 0.35%
  
  // SL ancora più piccoli (0.05-0.2%)
  const baseSl = 0.08; // 0.08% base
  const slPercent = baseSl + (spreadPercent * 5); // Adatta a spread
  
  return {
    takeProfitPercent: Math.min(tpPercent, 0.5),
    stopLossPercent: Math.min(slPercent, 0.25)
  };
}

/**
 * Orderbook Imbalance Strategy
 * Micro-scalping basato su squilibri bid/ask
 */
export function orderbookImbalanceStrategy(
  markets: MarketSummary[],
  config: StrategyConfig
): TradeSignal[] {
  const signals: TradeSignal[] = [];
  const now = Date.now();

  // Filtra mercati liquidi per scalping
  const liquidMarkets = markets.filter(m => 
    m.volume24h > 50000000 // Min $50M volume per liquidità
  );

  for (const market of liquidMarkets) {
    // Simula dati orderbook
    const { bidVolume, askVolume, bidAskRatio, spreadPercent } = simulateOrderbookData(market);
    
    // Calcola forza squilibrio
    const imbalanceStrength = Math.abs(Math.log(bidAskRatio)) / 2; // Normalizza
    
    // Soglia minima: squilibrio deve essere significativo
    if (imbalanceStrength < 0.3 || spreadPercent > 0.03) continue;

    const direction = getImbalanceDirection(bidAskRatio, spreadPercent);
    const leverage = calculateImbalanceLeverage(imbalanceStrength, market.symbol);
    const { takeProfitPercent, stopLossPercent } = calculateScalpingTPSL(imbalanceStrength, spreadPercent);

    // Entry price ottimizzato per scalping
    let entryPrice = market.price;
    if (direction === 'LONG') {
      // Per LONG, entry leggermente sotto per migliore fill
      entryPrice = market.price * (1 - spreadPercent / 2);
    } else {
      // Per SHORT, entry leggermente sopra
      entryPrice = market.price * (1 + spreadPercent / 2);
    }

    const timeframe = '30s'; // Scalping ultra-veloce
    const validUntil = now + (2 * 60 * 1000); // 2 minuti validità
    const orderType = 'Limit'; // Limit per migliori entry

    const ratioText = bidAskRatio.toFixed(2);
    const spreadBps = (spreadPercent * 10000).toFixed(0);
    const imbalancePercent = (imbalanceStrength * 100).toFixed(0);

    signals.push({
      symbol: market.symbol,
      direction,
      entryPrice,
      takeProfitPercent,
      stopLossPercent,
      leverage,
      reason: `Orderbook Imbalance ${imbalancePercent}% | Ratio: ${ratioText} | Spread: ${spreadBps}bps | TP: ${takeProfitPercent.toFixed(2)}% | SL: ${stopLossPercent.toFixed(2)}%`,
      timestamp: now,
      timeframe,
      validUntil,
      orderType,
      createdAt: new Date(now).toISOString(),
      expiresAt: new Date(validUntil).toISOString()
    });
  }

  // Ordina per forza imbalance
  return signals.sort((a, b) => {
    const aImbalance = parseFloat(a.reason.split('Imbalance ')[1].split('%')[0]);
    const bImbalance = parseFloat(b.reason.split('Imbalance ')[1].split('%')[0]);
    return bImbalance - aImbalance;
  }).slice(0, 5); // Max 5 segnali scalping
}
