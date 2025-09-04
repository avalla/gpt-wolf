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
 * Calcola leva basata su intensità liquidazioni
 */
function calculateLiquidationLeverage(liquidationRatio: number, symbol: string): number {
  const leverageLimits: Record<string, number> = {
    'BTCUSDT': 50, 'ETHUSDT': 50, 'SOLUSDT': 40, 'ADAUSDT': 40,
    'AVAXUSDT': 30, 'LINKUSDT': 30, 'DOGEUSDT': 30,
  };

  const maxLeverage = leverageLimits[symbol] || 25;
  
  // Leva più alta per liquidation ratio estremi
  const baseLeverage = 15;
  const liquidationBonus = Math.floor(liquidationRatio * 5); // Max +25x
  
  return Math.max(baseLeverage, Math.min(baseLeverage + liquidationBonus, maxLeverage));
}

/**
 * Determina direzione trade per anticipare cascade
 */
function getCascadeDirection(buyLiq: number, sellLiq: number, priceChange: number): 'LONG' | 'SHORT' {
  const liquidationImbalance = (sellLiq - buyLiq) / (sellLiq + buyLiq);
  
  // Se più liquidazioni short che long = prezzo potrebbe salire (squeeze short)
  if (liquidationImbalance > 0.3) {
    return 'LONG'; // Anticipa short squeeze
  }
  
  // Se più liquidazioni long che short = prezzo potrebbe scendere (dump long)
  if (liquidationImbalance < -0.3) {
    return 'SHORT'; // Anticipa long dump
  }
  
  // Se equilibrato, segui momentum prezzo
  return priceChange > 0 ? 'LONG' : 'SHORT';
}

/**
 * Calcola TP/SL per liquidation cascade
 */
function calculateCascadeTPSL(liquidationIntensity: number, direction: 'LONG' | 'SHORT') {
  // TP più aggressivo per cascade intensi
  const baseTp = 0.8; // 0.8% base
  const tpPercent = baseTp + (liquidationIntensity * 0.3); // Max 2.3%
  
  // SL moderato per dare spazio al cascade
  const baseSl = 0.4; // 0.4% base
  const slPercent = baseSl + (liquidationIntensity * 0.1); // Max 0.9%
  
  return {
    takeProfitPercent: Math.min(tpPercent, 2.5),
    stopLossPercent: Math.min(slPercent, 1.0)
  };
}

/**
 * Liquidation Cascade Strategy
 * Anticipa cascade di liquidazioni basandosi su squilibri nelle liquidazioni
 */
export function liquidationCascadeStrategy(
  markets: MarketSummary[],
  config: StrategyConfig
): TradeSignal[] {
  const signals: TradeSignal[] = [];
  const now = Date.now();

  // Filtra mercati con dati liquidazioni disponibili
  const liquidationMarkets = markets.filter(m => 
    m.liquidations24h && 
    m.liquidations24h.total > 1000000 && // Min $1M liquidazioni
    m.volume24h > 10000000 // Min $10M volume
  );

  for (const market of liquidationMarkets) {
    if (!market.liquidations24h) continue;

    const { buyQty, sellQty, total } = market.liquidations24h;
    
    // Calcola intensità liquidazioni (liquidazioni/volume)
    const liquidationIntensity = total / market.volume24h;
    
    // Soglia minima: liquidazioni devono essere almeno 5% del volume
    if (liquidationIntensity < 0.05) continue;

    // Calcola squilibrio liquidazioni
    const liquidationImbalance = Math.abs(sellQty - buyQty) / total;
    
    // Serve squilibrio significativo per cascade
    if (liquidationImbalance < 0.4) continue; // Min 40% squilibrio

    const direction = getCascadeDirection(buyQty, sellQty, market.change24h);
    const leverage = calculateLiquidationLeverage(liquidationIntensity * 10, market.symbol);
    const { takeProfitPercent, stopLossPercent } = calculateCascadeTPSL(liquidationIntensity * 10, direction);

    // Entry price strategico
    let entryPrice = market.price;
    if (direction === 'LONG') {
      // Per LONG, aspetta pullback prima del squeeze
      entryPrice = market.price * 0.998; // -0.2%
    } else {
      // Per SHORT, aspetta bounce prima del dump
      entryPrice = market.price * 1.002; // +0.2%
    }

    const timeframe = '5m'; // Cascade si sviluppano in 5-15 minuti
    const validUntil = now + (30 * 60 * 1000); // 30 minuti validità
    const orderType: 'Conditional' | 'Market' = liquidationIntensity > 0.1 ? 'Market' : 'Conditional';

    const liquidationRatio = (liquidationIntensity * 100).toFixed(1);
    const imbalancePercent = (liquidationImbalance * 100).toFixed(0);
    const cascadeType = direction === 'LONG' ? 'Short Squeeze' : 'Long Dump';

    signals.push({
      symbol: market.symbol,
      direction,
      entryPrice,
      takeProfitPercent,
      stopLossPercent,
      leverage,
      reason: `Liquidation ${cascadeType} | Liq: ${liquidationRatio}% | Imbalance: ${imbalancePercent}% | TP: ${takeProfitPercent.toFixed(1)}% | SL: ${stopLossPercent.toFixed(1)}%`,
      timestamp: now,
      timeframe,
      validUntil,
      orderType,
      createdAt: new Date(now).toISOString(),
      expiresAt: new Date(validUntil).toISOString()
    });
  }

  // Ordina per intensità liquidazioni (più intensi prima)
  return signals.sort((a, b) => {
    const aIntensity = parseFloat(a.reason.split('Liq: ')[1].split('%')[0]);
    const bIntensity = parseFloat(b.reason.split('Liq: ')[1].split('%')[0]);
    return bIntensity - aIntensity;
  }).slice(0, 3); // Max 3 segnali per evitare overexposure
}
