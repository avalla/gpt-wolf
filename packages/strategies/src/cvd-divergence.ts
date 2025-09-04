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
  // Dati per CVD analysis
  futuresDelta?: number;
  spotVolumeSpike?: boolean;
  spotDelta?: number;
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
 * Calcola leva basata su intensità divergenza CVD
 */
function calculateCVDLeverage(divergenceStrength: number, symbol: string): number {
  const leverageLimits: Record<string, number> = {
    'BTCUSDT': 60, 'ETHUSDT': 60, 'SOLUSDT': 45, 'ADAUSDT': 45,
    'AVAXUSDT': 35, 'LINKUSDT': 35, 'DOGEUSDT': 35,
  };

  const maxLeverage = leverageLimits[symbol] || 30;
  
  // Leva più alta per divergenze forti
  const baseLeverage = 20;
  const divergenceBonus = Math.floor(divergenceStrength * 15); // Max +30x
  
  return Math.max(baseLeverage, Math.min(baseLeverage + divergenceBonus, maxLeverage));
}

/**
 * Determina direzione trade basata su divergenza CVD
 */
function getCVDDirection(futuresDelta: number, spotDelta: number, priceChange: number): 'LONG' | 'SHORT' {
  // CVD Divergence Logic:
  // Se futures comprano ma spot vende = manipolazione, probabile reversal
  // Se spot compra ma futures vendono = smart money exit, probabile dump
  
  const deltaRatio = futuresDelta / (spotDelta || 1);
  
  // Futures molto più bullish di spot = possibile trap
  if (deltaRatio > 2 && priceChange > 0) {
    return 'SHORT'; // Anticipa reversal da bull trap
  }
  
  // Spot molto più bullish di futures = accumulo smart money
  if (deltaRatio < 0.5 && spotDelta > 0) {
    return 'LONG'; // Segui smart money
  }
  
  // Futures e spot allineati nella stessa direzione = momentum forte
  if (Math.sign(futuresDelta) === Math.sign(spotDelta)) {
    return futuresDelta > 0 ? 'LONG' : 'SHORT';
  }
  
  // Default: segui il delta più forte
  return Math.abs(futuresDelta) > Math.abs(spotDelta) ? 
    (futuresDelta > 0 ? 'LONG' : 'SHORT') : 
    (spotDelta > 0 ? 'LONG' : 'SHORT');
}

/**
 * Calcola TP/SL per CVD divergence
 */
function calculateCVDTPSL(divergenceStrength: number, confidence: number) {
  // TP più aggressivo per divergenze forti e alta confidenza
  const baseTp = 0.6; // 0.6% base
  const tpPercent = baseTp + (divergenceStrength * confidence * 0.4); // Max 1.4%
  
  // SL basato su confidenza (più confidenti = SL più stretto)
  const baseSl = 0.5; // 0.5% base
  const slPercent = baseSl - (confidence * 0.2); // Min 0.3%
  
  return {
    takeProfitPercent: Math.min(tpPercent, 1.8),
    stopLossPercent: Math.max(slPercent, 0.25)
  };
}

/**
 * Calcola confidenza del segnale CVD
 */
function calculateCVDConfidence(
  futuresDelta: number, 
  spotDelta: number, 
  volumeSpike: boolean,
  priceChange: number
): number {
  let confidence = 0.5; // Base confidence
  
  // Boost per volume spike
  if (volumeSpike) confidence += 0.2;
  
  // Boost per divergenza forte
  const divergenceRatio = Math.abs(futuresDelta - spotDelta) / (Math.abs(futuresDelta) + Math.abs(spotDelta) + 1);
  confidence += divergenceRatio * 0.3;
  
  // Boost se prezzo si muove contro il delta dominante (possibile reversal)
  const dominantDelta = Math.abs(futuresDelta) > Math.abs(spotDelta) ? futuresDelta : spotDelta;
  if (Math.sign(dominantDelta) !== Math.sign(priceChange)) {
    confidence += 0.2;
  }
  
  return Math.min(confidence, 1.0);
}

/**
 * CVD Divergence Strategy
 * Analizza divergenze tra Cumulative Volume Delta di futures e spot
 */
export function cvdDivergenceStrategy(
  markets: MarketSummary[],
  config: StrategyConfig
): TradeSignal[] {
  const signals: TradeSignal[] = [];
  const now = Date.now();

  // Filtra mercati con dati CVD disponibili
  const cvdMarkets = markets.filter(m => 
    m.futuresDelta !== undefined && 
    m.spotDelta !== undefined &&
    m.volume24h > 8000000 // Min $8M volume
  );

  for (const market of cvdMarkets) {
    if (market.futuresDelta === undefined || market.spotDelta === undefined) continue;

    const futuresDelta = market.futuresDelta;
    const spotDelta = market.spotDelta;
    
    // Calcola intensità divergenza
    const totalDelta = Math.abs(futuresDelta) + Math.abs(spotDelta);
    if (totalDelta < 100000) continue; // Min $100k delta totale
    
    const divergenceStrength = Math.abs(futuresDelta - spotDelta) / totalDelta;
    
    // Soglia minima: divergenza deve essere almeno 30%
    if (divergenceStrength < 0.3) continue;

    const direction = getCVDDirection(futuresDelta, spotDelta, market.change24h);
    const confidence = calculateCVDConfidence(
      futuresDelta, 
      spotDelta, 
      market.spotVolumeSpike || false,
      market.change24h
    );
    
    // Skip segnali a bassa confidenza
    if (confidence < 0.6) continue;

    const leverage = calculateCVDLeverage(divergenceStrength, market.symbol);
    const { takeProfitPercent, stopLossPercent } = calculateCVDTPSL(divergenceStrength, confidence);

    // Entry price ottimizzato per CVD
    let entryPrice = market.price;
    if (direction === 'LONG') {
      // Per LONG, entry su dip per migliore R/R
      entryPrice = market.price * 0.9985; // -0.15%
    } else {
      // Per SHORT, entry su pump per migliore R/R
      entryPrice = market.price * 1.0015; // +0.15%
    }

    const timeframe = '15m'; // CVD divergenze si sviluppano in 15-45 minuti
    const validUntil = now + (45 * 60 * 1000); // 45 minuti validità
    const orderType: 'Conditional' | 'Limit' = confidence > 0.8 ? 'Conditional' : 'Limit';

    const divergencePercent = (divergenceStrength * 100).toFixed(0);
    const confidencePercent = (confidence * 100).toFixed(0);
    const futuresFlow = futuresDelta > 0 ? 'Buy' : 'Sell';
    const spotFlow = spotDelta > 0 ? 'Buy' : 'Sell';

    signals.push({
      symbol: market.symbol,
      direction,
      entryPrice,
      takeProfitPercent,
      stopLossPercent,
      leverage,
      reason: `CVD Divergence ${divergencePercent}% | Futures: ${futuresFlow} | Spot: ${spotFlow} | Conf: ${confidencePercent}% | TP: ${takeProfitPercent.toFixed(1)}% | SL: ${stopLossPercent.toFixed(1)}%`,
      timestamp: now,
      timeframe,
      validUntil,
      orderType,
      createdAt: new Date(now).toISOString(),
      expiresAt: new Date(validUntil).toISOString()
    });
  }

  // Ordina per confidenza (più confidenti prima)
  return signals.sort((a, b) => {
    const aConfidence = parseFloat(a.reason.split('Conf: ')[1].split('%')[0]);
    const bConfidence = parseFloat(b.reason.split('Conf: ')[1].split('%')[0]);
    return bConfidence - aConfidence;
  }).slice(0, 4); // Max 4 segnali per diversificazione
}
