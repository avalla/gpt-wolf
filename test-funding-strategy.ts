import { fundingRateStrategy } from './packages/strategies/src/funding';

// Test con dati RADUSDT reali
const testMarkets = [
  {
    symbol: 'RADUSDT',
    price: 1.2345, // Prezzo esempio
    volume24h: 2692959.7, // Volume dal tuo log
    change24h: -2.5,
    fundingRate: -0.001713, // -0.1713% convertito in decimale
    nextFundingTime: Date.now() + 8 * 60 * 60 * 1000, // 8 ore da ora
    openInterest: 1000000,
  },
  {
    symbol: 'BTCUSDT',
    price: 58000,
    volume24h: 50000000,
    change24h: 1.2,
    fundingRate: 0.0005, // 0.05% - sotto la soglia
    nextFundingTime: Date.now() + 8 * 60 * 60 * 1000,
    openInterest: 2000000000,
  }
];

const config = {
  defaultLeverage: 50,
  maxLeverage: 100,
  riskPercentage: 5
};

console.log('🧪 Test Strategia Funding Rate\n');

console.log('📊 Mercati di test:');
testMarkets.forEach(market => {
  console.log(`${market.symbol}:`);
  console.log(`  💸 Funding Rate: ${(market.fundingRate * 100).toFixed(4)}%`);
  console.log(`  💰 Volume 24h: $${market.volume24h.toLocaleString()}`);
  console.log(`  ✅ Qualifica per strategia: ${Math.abs(market.fundingRate) > 0.001 && market.volume24h > 10000000 ? 'SÌ' : 'NO'}`);
  console.log('');
});

const mockTickers = testMarkets.map(m => ({
  symbol: m.symbol,
  lastPrice: m.price.toString(),
  priceChangePercent: m.change24h.toString()
}));

const signals = fundingRateStrategy(testMarkets, config, mockTickers);

console.log(`🎯 Segnali generati: ${signals.length}\n`);

signals.forEach((signal, index) => {
  console.log(`${index + 1}. ${signal.symbol} ${signal.direction}`);
  console.log(`   💰 Entry: $${signal.entryPrice.toFixed(4)}`);
  console.log(`   🎯 Target: $${signal.targetPrice.toFixed(4)}`);
  console.log(`   🛡️ Stop Loss: $${signal.stopLoss.toFixed(4)}`);
  console.log(`   ⚡ Leverage: ${signal.leverage}x`);
  console.log(`   📊 R/R: 1:${((signal.targetPrice - signal.entryPrice) / Math.abs(signal.stopLoss - signal.entryPrice)).toFixed(2)}`);
  console.log(`   ⏰ Creato: ${signal.createdAt}`);
  console.log(`   📅 Timeframe: ${signal.timeframe}`);
  console.log(`   ⌛ Valido fino: ${signal.expiresAt}`);
  console.log(`   🔄 Tipo Ordine: ${signal.orderType}`);
  console.log(`   📝 Motivo: ${signal.reason}`);
  console.log('');
});

// Test specifico per RADUSDT
const radSignal = signals.find(s => s.symbol === 'RADUSDT');
if (radSignal) {
  console.log('✅ RADUSDT genera segnale correttamente');
  console.log(`   Direzione: ${radSignal.direction} (dovrebbe essere LONG per funding negativo)`);
  console.log(`   Leverage: ${radSignal.leverage}x (calcolato da funding rate)`);
} else {
  console.log('❌ RADUSDT NON genera segnale - possibile problema');
  
  // Debug
  const rad = testMarkets[0];
  console.log('\n🔍 Debug RADUSDT:');
  console.log(`   Funding rate assoluto: ${Math.abs(rad.fundingRate)} (soglia: 0.001)`);
  console.log(`   Volume: ${rad.volume24h} (soglia: 1,000,000)`);
  console.log(`   Passa filtro funding: ${Math.abs(rad.fundingRate) > 0.001}`);
  console.log(`   Passa filtro volume: ${rad.volume24h > 1000000}`);
}
