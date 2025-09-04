import { MarketSummary, TradeSignal, StrategyConfig } from '@gpt-wolf/db';

/**
 * Strategia di scalping ultrarapido: entra su micro-breakout 1m con TP/SL strettissimi e trailing dinamico.
 * - Entra solo su spike improvvisi di prezzo e volume (micro-pump o dump)
 * - TP: 0.15-0.25%, SL: 0.08-0.12%, trailing dinamico
 * - Leva: 50x-100x
 * - Solo se spread e funding sono favorevoli
 */
export function scalpingUltrarapidoStrategy(
  markets: MarketSummary[],
  config: StrategyConfig
): TradeSignal[] {
  const signals: TradeSignal[] = [];
  const now = Date.now();
  let validMarkets = 0;

  for (const market of markets) {
    // Micro-breakout: spike improvviso >0.25% in 1m e volume almeno doppio della media 5m
    if (
      market.change1m !== undefined && market.volume1m !== undefined && market.avgVolume5m !== undefined
    ) {
      validMarkets++;
      if (
        Math.abs(market.change1m) > 0.25 &&
        market.volume1m > market.avgVolume5m * 2 &&
        Math.abs(market.fundingRate) < 0.001 // evita funding troppo alto
      ) {
        const direction = market.change1m > 0 ? 'LONG' : 'SHORT';
        const entryPrice = market.price;
        // Leverage basato su volatilità del mercato
        const volatility = Math.abs(market.change1m || 0);
        const leverage = Math.min(75 + Math.floor(volatility * 10), config.maxLeverage);
        
        // TP/SL basati su volatilità e volume
        const volumeMultiplier = Math.min(market.volume1m / market.avgVolume5m || 1, 3);
        const tpPerc = 0.15 + (volatility * 0.5); // Dinamico su volatilità
        const slPerc = 0.08 + (volatility * 0.2); // Dinamico su volatilità
        const targetPrice = direction === 'LONG'
          ? entryPrice * (1 + tpPerc / 100)
          : entryPrice * (1 - tpPerc / 100);
        const stopLoss = direction === 'LONG'
          ? entryPrice * (1 - slPerc / 100)
          : entryPrice * (1 + slPerc / 100);
        signals.push({
          symbol: market.symbol,
          direction,
          entryPrice,
          targetPrice,
          stopLoss,
          leverage,
          reason: `Scalping ultrarapido ${direction} | Spike 1m: ${market.change1m.toFixed(2)}% | Vol: $${market.volume1m?.toLocaleString()}`,
          timestamp: now
        });
      }
    }
  }
  console.log(`\n[ScalpingUltrarapido] Mercati con dati 1m disponibili: ${validMarkets} su ${markets.length}`);
  console.log(`[ScalpingUltrarapido] Segnali generati: ${signals.length}`);
  if (signals.length === 0) {
    if (validMarkets === 0) {
      console.warn('[ScalpingUltrarapido] Nessun mercato con dati 1m disponibili (change1m, volume1m, avgVolume5m)');
    } else {
      console.log('[ScalpingUltrarapido] Nessun setup di scalping trovato in questa scansione.');
    }
  }
  return signals;
}
