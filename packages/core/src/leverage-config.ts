/**
 * Configurazione leve massime per asset su Bybit
 * Basato sui limiti reali della piattaforma
 */

export interface LeverageConfig {
  symbol: string;
  maxLeverage: number;
  category: 'major' | 'alt' | 'meme' | 'new';
}

/**
 * Leve massime reali disponibili su Bybit per categoria
 */
export const BYBIT_LEVERAGE_LIMITS: Record<string, LeverageConfig> = {
  // Major coins - Leva alta
  'BTCUSDT': { symbol: 'BTCUSDT', maxLeverage: 100, category: 'major' },
  'ETHUSDT': { symbol: 'ETHUSDT', maxLeverage: 100, category: 'major' },
  'SOLUSDT': { symbol: 'SOLUSDT', maxLeverage: 50, category: 'major' },
  'ADAUSDT': { symbol: 'ADAUSDT', maxLeverage: 50, category: 'major' },
  'DOTUSDT': { symbol: 'DOTUSDT', maxLeverage: 50, category: 'major' },
  
  // Alt coins - Leva media
  'AVAXUSDT': { symbol: 'AVAXUSDT', maxLeverage: 25, category: 'alt' },
  'LINKUSDT': { symbol: 'LINKUSDT', maxLeverage: 25, category: 'alt' },
  'UNIUSDT': { symbol: 'UNIUSDT', maxLeverage: 25, category: 'alt' },
  'AAVEUSDT': { symbol: 'AAVEUSDT', maxLeverage: 25, category: 'alt' },
  
  // Meme coins - Leva bassa
  'DOGEUSDT': { symbol: 'DOGEUSDT', maxLeverage: 25, category: 'meme' },
  'SHIBUSDT': { symbol: 'SHIBUSDT', maxLeverage: 25, category: 'meme' },
  
  // New/Small coins - Leva molto bassa
  'RADUSDT': { symbol: 'RADUSDT', maxLeverage: 12.5, category: 'new' },
};

/**
 * Leve di default per categoria quando simbolo non trovato
 */
export const DEFAULT_LEVERAGE_BY_CATEGORY = {
  major: 50,
  alt: 25,
  meme: 20,
  new: 12.5
};

/**
 * Ottiene la leva massima disponibile per un simbolo
 */
export function getMaxLeverage(symbol: string): number {
  const config = BYBIT_LEVERAGE_LIMITS[symbol];
  if (config) {
    return config.maxLeverage;
  }
  
  // Fallback basato sul pattern del simbolo
  if (symbol.includes('BTC') || symbol.includes('ETH')) {
    return DEFAULT_LEVERAGE_BY_CATEGORY.major;
  }
  
  if (symbol.includes('USDT') && symbol.length <= 8) {
    return DEFAULT_LEVERAGE_BY_CATEGORY.alt;
  }
  
  // Default conservativo per simboli sconosciuti
  return DEFAULT_LEVERAGE_BY_CATEGORY.new;
}

/**
 * Calcola leva ottimale basata su funding rate e volatilità
 */
export function calculateOptimalLeverage(
  symbol: string, 
  fundingRate: number, 
  volatility?: number
): number {
  const maxLeverage = getMaxLeverage(symbol);
  
  // Base leverage dal funding rate (più alto = più leva)
  const fundingBasedLeverage = Math.min(
    Math.abs(fundingRate) * 30000, // Scala il funding rate
    maxLeverage
  );
  
  // Riduci leva se alta volatilità
  const volatilityMultiplier = volatility ? Math.max(0.5, 1 - volatility / 10) : 1;
  
  const optimalLeverage = Math.floor(fundingBasedLeverage * volatilityMultiplier);
  
  // Assicurati che sia almeno 5x e massimo quello disponibile
  return Math.max(5, Math.min(optimalLeverage, maxLeverage));
}
