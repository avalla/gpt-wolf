import { 
  ultraAggressiveStrategy, 
  calculatePositionSize, 
  calculatePotentialProfit,
  evaluateSignalRisk,
  MarketSummary,
  StrategyConfig 
} from './index';

// Genera dati di mercato realistici basati su condizioni attuali
function generateRealisticMarketData(): MarketSummary[] {
  const baseData = [
    { symbol: 'BTCUSDT', basePrice: 43200, baseVolume: 1500000000 },
    { symbol: 'ETHUSDT', basePrice: 2580, baseVolume: 800000000 },
    { symbol: 'SOLUSDT', basePrice: 102.5, baseVolume: 200000000 },
    { symbol: 'AVAXUSDT', basePrice: 38.2, baseVolume: 150000000 },
    { symbol: 'BNBUSDT', basePrice: 315, baseVolume: 120000000 },
    { symbol: 'ADAUSDT', basePrice: 0.52, baseVolume: 80000000 },
    { symbol: 'DOTUSDT', basePrice: 7.8, baseVolume: 60000000 },
    { symbol: 'LINKUSDT', basePrice: 15.2, baseVolume: 90000000 },
    { symbol: 'MATICUSDT', basePrice: 0.89, baseVolume: 70000000 },
    { symbol: 'ATOMUSDT', basePrice: 8.5, baseVolume: 45000000 }
  ];

  return baseData.map(data => {
    // Simula variazioni di prezzo realistiche
    const priceVariation = (Math.random() - 0.5) * 0.15; // ±15%
    const currentPrice = data.basePrice * (1 + priceVariation);
    
    // Simula volume con variazioni
    const volumeVariation = 0.5 + Math.random() * 1.5; // 0.5x - 2x
    const volume24h = data.baseVolume * volumeVariation;
    
    // Calcola change24h basato sulla variazione di prezzo
    const change24h = priceVariation * 100;
    
    // Simula funding rate realistico
    // Funding rate più estremi quando c'è più movimento
    const fundingBase = Math.abs(change24h) > 5 ? 
      (Math.random() - 0.5) * 0.002 : // ±0.2% per mercati volatili
      (Math.random() - 0.5) * 0.0005; // ±0.05% per mercati normali
    
    // Simula liquidazioni basate su volatilità
    const volatilityFactor = Math.abs(change24h) / 10;
    const baseLiquidations = volume24h * 0.02 * volatilityFactor; // 2% del volume base
    
    const buyLiquidations = baseLiquidations * (0.3 + Math.random() * 0.4); // 30-70%
    const sellLiquidations = baseLiquidations - buyLiquidations;
    
    return {
      symbol: data.symbol,
      price: currentPrice,
      volume24h,
      change24h,
      fundingRate: fundingBase,
      nextFundingTime: Date.now() + (Math.random() * 8 * 60 * 60 * 1000), // 0-8 ore
      openInterest: volume24h * (2 + Math.random() * 3), // 2-5x del volume
      liquidations24h: {
        buyQty: buyLiquidations,
        sellQty: sellLiquidations,
        total: buyLiquidations + sellLiquidations
      }
    };
  });
}

const config: StrategyConfig = {
  defaultLeverage: 50,
  maxLeverage: 100,
  riskPercentage: 5
};

async function runDemoTest() {
  console.log('🚀 DEMO: Ultra Aggressive Strategy with Realistic Market Data\n');
  
  // Genera dati di mercato realistici
  const markets = generateRealisticMarketData();
  
  console.log('📊 Current Market Conditions:');
  markets.forEach(market => {
    const fundingAnnual = (market.fundingRate * 3 * 365 * 100).toFixed(1);
    const liquidationTotal = market.liquidations24h?.total || 0;
    console.log(`   ${market.symbol}: $${market.price.toFixed(4)} | ${market.change24h.toFixed(2)}% | Vol: $${(market.volume24h/1000000).toFixed(0)}M | Fund: ${(market.fundingRate*100).toFixed(4)}% | Liq: $${(liquidationTotal/1000000).toFixed(1)}M`);
  });
  
  console.log('\n🎯 Generating Trading Signals...\n');
  
  // Genera segnali
  const signals = ultraAggressiveStrategy(markets, config);
  
  if (signals.length === 0) {
    console.log('❌ No signals generated with current market conditions');
    console.log('💡 Try again - market conditions change constantly!');
    return;
  }
  
  console.log(`🔥 Generated ${signals.length} AGGRESSIVE signals:\n`);
  
  // Capitale di test
  const testCapital = 10000; // $10,000
  
  signals.forEach((signal, index) => {
    console.log(`${index + 1}. 🎯 ${signal.symbol} - ${signal.direction}`);
    console.log(`   💰 Entry: $${signal.entryPrice.toFixed(4)}`);
    console.log(`   🎯 Target: $${signal.targetPrice.toFixed(4)}`);
    console.log(`   🛑 Stop Loss: $${signal.stopLoss.toFixed(4)}`);
    console.log(`   ⚡ Leverage: ${signal.leverage}x`);
    console.log(`   📈 Confidence: ${signal.confidence}%`);
    console.log(`   🚨 Urgency: ${signal.urgency}`);
    console.log(`   💡 Reason: ${signal.reason}`);
    
    // Calcola metriche di trading
    const positionSize = calculatePositionSize(signal, testCapital, 5);
    const potentialProfit = calculatePotentialProfit(signal, positionSize);
    const riskAssessment = evaluateSignalRisk(signal);
    
    // Calcola percentuali
    const targetPercent = ((signal.targetPrice - signal.entryPrice) / signal.entryPrice * 100).toFixed(2);
    const stopPercent = ((signal.stopLoss - signal.entryPrice) / signal.entryPrice * 100).toFixed(2);
    const profitPercent = (potentialProfit / testCapital * 100).toFixed(2);
    
    console.log(`   📊 Position Size: ${positionSize.toFixed(4)} ${signal.symbol.replace('USDT', '')}`);
    console.log(`   💵 Potential Profit: $${potentialProfit.toFixed(2)} (${profitPercent}%)`);
    console.log(`   📈 Target Move: ${targetPercent}%`);
    console.log(`   📉 Stop Move: ${stopPercent}%`);
    console.log(`   ⚠️  Risk Level: ${riskAssessment.level}`);
    console.log(`   💬 Recommendation: ${riskAssessment.recommendation}`);
    
    // Calcola risk/reward ratio
    const riskAmount = Math.abs(signal.entryPrice - signal.stopLoss) * positionSize * signal.leverage;
    const rewardAmount = Math.abs(signal.targetPrice - signal.entryPrice) * positionSize * signal.leverage;
    const rrRatio = (rewardAmount / riskAmount).toFixed(2);
    console.log(`   ⚖️  Risk/Reward: 1:${rrRatio}`);
    
    console.log('');
  });
  
  // Statistiche generali
  const totalPotentialProfit = signals.reduce((sum, signal) => {
    const positionSize = calculatePositionSize(signal, testCapital, 5);
    return sum + calculatePotentialProfit(signal, positionSize);
  }, 0);
  
  const avgConfidence = signals.reduce((sum, s) => sum + s.confidence, 0) / signals.length;
  const avgLeverage = signals.reduce((sum, s) => sum + s.leverage, 0) / signals.length;
  const highUrgencyCount = signals.filter(s => s.urgency === 'HIGH').length;
  const extremeRiskCount = signals.filter(s => evaluateSignalRisk(s).level === 'EXTREME').length;
  
  console.log('📈 STRATEGY PERFORMANCE:');
  console.log(`   💰 Total Potential Profit: $${totalPotentialProfit.toFixed(2)} (${(totalPotentialProfit/testCapital*100).toFixed(1)}%)`);
  console.log(`   📊 Average Confidence: ${avgConfidence.toFixed(1)}%`);
  console.log(`   ⚡ Average Leverage: ${avgLeverage.toFixed(1)}x`);
  console.log(`   🚨 High Urgency Signals: ${highUrgencyCount}/${signals.length}`);
  console.log(`   ⚠️  Extreme Risk Signals: ${extremeRiskCount}/${signals.length}`);
  console.log(`   🎯 Total Signals: ${signals.length}`);
  
  // Mostra i mercati più interessanti
  console.log('\n🔥 Most Interesting Markets:');
  const sortedMarkets = markets
    .sort((a, b) => {
      const aScore = Math.abs(a.fundingRate) * 1000 + Math.abs(a.change24h) + (a.liquidations24h?.total || 0) / 1000000;
      const bScore = Math.abs(b.fundingRate) * 1000 + Math.abs(b.change24h) + (b.liquidations24h?.total || 0) / 1000000;
      return bScore - aScore;
    })
    .slice(0, 5);
  
  sortedMarkets.forEach((market, index) => {
    const fundingAnnual = (market.fundingRate * 3 * 365 * 100).toFixed(1);
    const liquidationTotal = market.liquidations24h?.total || 0;
    console.log(`   ${index + 1}. ${market.symbol}: ${market.change24h.toFixed(2)}% | Funding: ${(market.fundingRate*100).toFixed(4)}% (${fundingAnnual}% annual) | Liq: $${(liquidationTotal/1000000).toFixed(1)}M`);
  });
  
  console.log('\n💡 This is a DEMO with simulated realistic data');
  console.log('🔴 NEVER trade with real money without proper risk management!');
  console.log('⚡ High leverage = High risk = Potential total loss');
}

// Esegui il test
runDemoTest();
