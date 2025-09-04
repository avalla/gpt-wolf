interface MarketSummary {
  symbol: string;
  price: number;
  volume24h: number;
  change24h: number;
  fundingRate: number;
  nextFundingTime: number;
  openInterest: number;
  // News momentum data
  newsScore?: number;
  sentimentScore?: number;
  volumeSpike?: boolean;
  priceVelocity?: number;
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
 * Simula score news basato su volatilità e volume
 */
function simulateNewsScore(market: MarketSummary): number {
  const volatility = Math.abs(market.change24h);
  const volumeRatio = market.volume24h / 50000000; // Normalizza su $50M
  
  // Score più alto per alta volatilità + alto volume
  return Math.min((volatility * 2 + volumeRatio) / 3, 1.0);
}

/**
 * Calcola sentiment score basato su price action
 */
function calculateSentimentScore(market: MarketSummary): number {
  const priceChange = market.change24h;
  const fundingBias = market.fundingRate > 0.01 ? -0.2 : market.fundingRate < -0.01 ? 0.2 : 0;
  
  // Sentiment positivo per pump, negativo per dump
  const baseSentiment = Math.tanh(priceChange / 10); // Normalizza tra -1 e 1
  return Math.max(-1, Math.min(1, baseSentiment + fundingBias));
}

/**
 * Calcola velocità prezzo (momentum)
 */
function calculatePriceVelocity(market: MarketSummary): number {
  // Simula velocità basata su change24h e volume
  const velocity = (Math.abs(market.change24h) * market.volume24h) / 100000000;
  return Math.min(velocity, 10); // Cap a 10
}

/**
 * Calcola leva basata su intensità news
 */
function calculateNewsLeverage(newsIntensity: number, symbol: string): number {
  const leverageLimits: Record<string, number> = {
    'BTCUSDT': 75, 'ETHUSDT': 75, 'SOLUSDT': 60, 'ADAUSDT': 60,
    'AVAXUSDT': 50, 'LINKUSDT': 50, 'DOGEUSDT': 50,
  };

  const maxLeverage = leverageLimits[symbol] || 40;
  
  // Leva più alta per news intense
  const baseLeverage = 25;
  const newsBonus = Math.floor(newsIntensity * 25); // Max +25x
  
  return Math.max(baseLeverage, Math.min(baseLeverage + newsBonus, maxLeverage));
}

/**
 * Determina direzione trade per news momentum
 */
function getNewsMomentumDirection(
  sentimentScore: number, 
  priceChange: number, 
  volumeSpike: boolean
): 'LONG' | 'SHORT' {
  // Se sentiment e prezzo allineati + volume spike = segui momentum
  if (Math.sign(sentimentScore) === Math.sign(priceChange) && volumeSpike) {
    return sentimentScore > 0 ? 'LONG' : 'SHORT';
  }
  
  // Se sentiment opposto al prezzo = possibile reversal
  if (Math.sign(sentimentScore) !== Math.sign(priceChange)) {
    return sentimentScore > 0 ? 'LONG' : 'SHORT';
  }
  
  // Default: segui sentiment dominante
  return sentimentScore > 0 ? 'LONG' : 'SHORT';
}

/**
 * Calcola TP/SL per news momentum
 */
function calculateNewsMomentumTPSL(newsIntensity: number, velocity: number) {
  // TP più aggressivo per news intense e alta velocità
  const baseTp = 1.0; // 1.0% base
  const tpPercent = baseTp + (newsIntensity * velocity * 0.3); // Max 4.0%
  
  // SL più stretto per news (movimenti rapidi)
  const baseSl = 0.6; // 0.6% base
  const slPercent = baseSl + (newsIntensity * 0.2); // Max 0.8%
  
  return {
    takeProfitPercent: Math.min(tpPercent, 4.0),
    stopLossPercent: Math.min(slPercent, 1.0)
  };
}

/**
 * News Momentum Strategy
 * React rapidamente a eventi/news che causano movimenti di prezzo
 */
export function newsMomentumStrategy(
  markets: MarketSummary[],
  config: StrategyConfig
): TradeSignal[] {
  const signals: TradeSignal[] = [];
  const now = Date.now();

  // Filtra mercati con potenziale news momentum
  const newsMarkets = markets.filter(m => 
    m.volume24h > 15000000 && // Min $15M volume
    Math.abs(m.change24h) > 2 // Min 2% price change
  );

  for (const market of newsMarkets) {
    // Simula dati news (in produzione verrebbero da feed esterni)
    const newsScore = simulateNewsScore(market);
    const sentimentScore = calculateSentimentScore(market);
    const priceVelocity = calculatePriceVelocity(market);
    const volumeSpike = market.volume24h > 30000000; // $30M+ = spike

    // Calcola intensità news complessiva
    const newsIntensity = (newsScore + Math.abs(sentimentScore) + Math.min(priceVelocity / 5, 1)) / 3;
    
    // Soglia minima: news deve essere significativa
    if (newsIntensity < 0.4) continue;

    const direction = getNewsMomentumDirection(sentimentScore, market.change24h, volumeSpike);
    const leverage = calculateNewsLeverage(newsIntensity, market.symbol);
    const { takeProfitPercent, stopLossPercent } = calculateNewsMomentumTPSL(newsIntensity, priceVelocity);

    // Entry price per news momentum (entry immediato)
    const entryPrice = market.price; // Market order per velocità

    const timeframe = '1m'; // News momentum si sviluppa in 1-5 minuti
    const validUntil = now + (10 * 60 * 1000); // 10 minuti validità (news si esaurisce)
    const orderType = 'Market'; // Sempre market per velocità

    const newsPercent = (newsIntensity * 100).toFixed(0);
    const sentimentText = sentimentScore > 0.3 ? 'Bullish' : sentimentScore < -0.3 ? 'Bearish' : 'Neutral';
    const velocityText = priceVelocity > 3 ? 'High' : priceVelocity > 1 ? 'Medium' : 'Low';

    signals.push({
      symbol: market.symbol,
      direction,
      entryPrice,
      takeProfitPercent,
      stopLossPercent,
      leverage,
      reason: `News Momentum ${newsPercent}% | ${sentimentText} | Velocity: ${velocityText} | TP: ${takeProfitPercent.toFixed(1)}% | SL: ${stopLossPercent.toFixed(1)}%`,
      timestamp: now,
      timeframe,
      validUntil,
      orderType,
      createdAt: new Date(now).toISOString(),
      expiresAt: new Date(validUntil).toISOString()
    });
  }

  // Ordina per intensità news (più intense prime)
  return signals.sort((a, b) => {
    const aIntensity = parseFloat(a.reason.split('News Momentum ')[1].split('%')[0]);
    const bIntensity = parseFloat(b.reason.split('News Momentum ')[1].split('%')[0]);
    return bIntensity - aIntensity;
  }).slice(0, 2); // Max 2 segnali per evitare overexposure su news
}
