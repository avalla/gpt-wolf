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
  // Dati per volume spike detection
  change1m?: number;
  volume1m?: number;
  avgVolume5m?: number;
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
 * Calcola leva ottimale basata su intensità spike
 */
function calculateSpikeLeverage(spikeIntensity: number, symbol: string): number {
  const leverageLimits: Record<string, number> = {
    'BTCUSDT': 75, 'ETHUSDT': 75, 'SOLUSDT': 50, 'ADAUSDT': 50,
    'AVAXUSDT': 40, 'LINKUSDT': 40, 'DOGEUSDT': 40,
  };

  const maxLeverage = leverageLimits[symbol] || 30;
  
  // Leva basata su intensità spike (2x-10x = leva 20x-75x)
  const spikeLeverage = Math.floor(spikeIntensity * 10);
  
  return Math.max(20, Math.min(spikeLeverage, maxLeverage));
}

/**
 * Determina direzione trade basata su momentum
 */
function getTradeDirection(priceChange1m: number, volumeSpike: number): 'LONG' | 'SHORT' {
  // Se prezzo sale con volume spike = LONG
  // Se prezzo scende con volume spike = SHORT
  if (Math.abs(priceChange1m) < 0.1) {
    // Se prezzo flat, segui il volume spike più forte
    return volumeSpike > 0 ? 'LONG' : 'SHORT';
  }
  
  return priceChange1m > 0 ? 'LONG' : 'SHORT';
}

/**
 * Calcola TP/SL dinamici basati su volatilità
 */
function calculateDynamicTPSL(spikeIntensity: number, volatility: number) {
  // TP più aggressivo per spike intensi
  const baseTp = 0.3; // 0.3% base
  const tpPercent = baseTp + (spikeIntensity * 0.1); // Max 1.3%
  
  // SL più stretto per spike intensi (exit rapido se sbagliato)
  const baseSl = 0.2; // 0.2% base  
  const slPercent = baseSl + (volatility * 0.05); // Max 0.4%
  
  return {
    takeProfitPercent: Math.min(tpPercent, 1.5),
    stopLossPercent: Math.min(slPercent, 0.5)
  };
}

/**
 * Volume Spike Detection Strategy
 * Rileva spike di volume anomali e cavalca il momentum
 */
export function volumeSpikeStrategy(
  markets: MarketSummary[],
  config: StrategyConfig
): TradeSignal[] {
  const signals: TradeSignal[] = [];
  const now = Date.now();

  // Filtra mercati con dati volume disponibili
  const validMarkets = markets.filter(m => 
    m.volume1m && m.avgVolume5m && m.volume24h > 5000000 // Min $5M volume 24h
  );

  for (const market of validMarkets) {
    if (!market.volume1m || !market.avgVolume5m) continue;

    // Calcola intensità spike volume
    const volumeRatio = market.volume1m / market.avgVolume5m;
    const spikeIntensity = volumeRatio; // 2x = spike moderato, 5x+ = spike estremo
    
    // Soglia spike: volume 1m deve essere almeno 3x la media 5m
    if (spikeIntensity < 3) continue;

    // Verifica momentum prezzo
    const priceChange1m = market.change1m || 0;
    const volatility = Math.abs(priceChange1m);
    
    // Skip se prezzo non si muove nonostante volume spike
    if (volatility < 0.05) continue; // Min 0.05% movimento

    const direction = getTradeDirection(priceChange1m, spikeIntensity);
    const leverage = calculateSpikeLeverage(spikeIntensity, market.symbol);
    const { takeProfitPercent, stopLossPercent } = calculateDynamicTPSL(spikeIntensity, volatility);

    // Entry price ottimizzato
    let entryPrice = market.price;
    if (direction === 'LONG') {
      // Per LONG, entry leggermente sopra prezzo corrente per conferma breakout
      entryPrice = market.price * 1.0005; // +0.05%
    } else {
      // Per SHORT, entry leggermente sotto per conferma breakdown
      entryPrice = market.price * 0.9995; // -0.05%
    }

    const timeframe = '1m'; // Scalping ultra-rapido
    const validUntil = now + (15 * 60 * 1000); // 15 minuti validità
    const orderType: 'Market' | 'Conditional' = spikeIntensity > 5 ? 'Market' : 'Conditional';

    signals.push({
      symbol: market.symbol,
      direction,
      entryPrice,
      takeProfitPercent,
      stopLossPercent,
      leverage,
      reason: `Volume Spike ${spikeIntensity.toFixed(1)}x | Price ${direction === 'LONG' ? '+' : ''}${priceChange1m.toFixed(3)}% | TP: ${takeProfitPercent.toFixed(2)}% | SL: ${stopLossPercent.toFixed(2)}%`,
      timestamp: now,
      timeframe,
      validUntil,
      orderType,
      createdAt: new Date(now).toISOString(),
      expiresAt: new Date(validUntil).toISOString()
    });
  }

  // Ordina per intensità spike (più intensi prima)
  return signals.sort((a, b) => {
    const aIntensity = parseFloat(a.reason.split('Spike ')[1].split('x')[0]);
    const bIntensity = parseFloat(b.reason.split('Spike ')[1].split('x')[0]);
    return bIntensity - aIntensity;
  }).slice(0, 5); // Max 5 segnali per evitare overtrading
}
