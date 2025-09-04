import { 
  ultraAggressiveStrategy, 
  calculatePositionSize, 
  calculatePotentialProfit,
  evaluateSignalRisk,
  MarketSummary,
  StrategyConfig 
} from './index';

// Genera dati di mercato realistici con più volatilità
function generateVolatileMarketData(): MarketSummary[] {
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
    // Simula variazioni di prezzo più volatili
    const priceVariation = (Math.random() - 0.5) * 0.25; // ±25%
    const currentPrice = data.basePrice * (1 + priceVariation);
    
    // Simula volume con più variazioni
    const volumeVariation = 0.3 + Math.random() * 2.5; // 0.3x - 2.8x
    const volume24h = data.baseVolume * volumeVariation;
    
    // Calcola change24h basato sulla variazione di prezzo
    const change24h = priceVariation * 100;
    
    // Simula funding rate più estremi
    const fundingBase = Math.abs(change24h) > 8 ? 
      (Math.random() - 0.5) * 0.004 : // ±0.4% per mercati molto volatili
      Math.abs(change24h) > 3 ?
      (Math.random() - 0.5) * 0.002 : // ±0.2% per mercati volatili
      (Math.random() - 0.5) * 0.0008; // ±0.08% per mercati normali
    
    // Simula liquidazioni più significative
    const volatilityFactor = Math.max(1, Math.abs(change24h) / 5);
    const baseLiquidations = volume24h * 0.05 * volatilityFactor; // 5% del volume base
    
    const buyLiquidations = baseLiquidations * (0.2 + Math.random() * 0.6); // 20-80%
    const sellLiquidations = baseLiquidations - buyLiquidations;
    
    return {
      symbol: data.symbol,
      price: currentPrice,
      volume24h,
      change24h,
      fundingRate: fundingBase,
      nextFundingTime: Date.now() + (Math.random() * 8 * 60 * 60 * 1000), // 0-8 ore
      openInterest: volume24h * (1.5 + Math.random() * 4), // 1.5-5.5x del volume
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

async function runContinuousTest() {
  console.log('🔄 CONTINUOUS TEST: Ultra Aggressive Strategy\n');
  console.log('⏰ Running 10 market scans with 3-second intervals...\n');
  
  let totalSignals = 0;
  let totalProfitPotential = 0;
  let bestSignal: any = null;
  let worstSignal: any = null;
  
  for (let i = 1; i <= 10; i++) {
    console.log(`📊 Scan ${i}/10 - ${new Date().toLocaleTimeString()}`);
    
    // Genera dati di mercato volatili
    const markets = generateVolatileMarketData();
    
    // Genera segnali
    const signals = ultraAggressiveStrategy(markets, config);
    totalSignals += signals.length;
    
    if (signals.length > 0) {
      console.log(`   🎯 Found ${signals.length} signals:`);
      
      signals.forEach((signal, index) => {
        const positionSize = calculatePositionSize(signal, 10000, 5);
        const potentialProfit = calculatePotentialProfit(signal, positionSize);
        totalProfitPotential += potentialProfit;
        
        // Traccia il miglior e peggior segnale
        if (!bestSignal || potentialProfit > bestSignal.profit) {
          bestSignal = { ...signal, profit: potentialProfit, scan: i };
        }
        if (!worstSignal || potentialProfit < worstSignal.profit) {
          worstSignal = { ...signal, profit: potentialProfit, scan: i };
        }
        
        const riskAssessment = evaluateSignalRisk(signal);
        console.log(`     ${index + 1}. ${signal.symbol} ${signal.direction} | ${signal.leverage}x | ${signal.confidence}% | $${potentialProfit.toFixed(0)} | ${riskAssessment.level}`);
      });
    } else {
      console.log('   ❌ No signals generated');
    }
    
    // Mostra mercati più interessanti
    const topMarkets = markets
      .sort((a, b) => {
        const aScore = Math.abs(a.fundingRate) * 1000 + Math.abs(a.change24h) + (a.liquidations24h?.total || 0) / 1000000;
        const bScore = Math.abs(b.fundingRate) * 1000 + Math.abs(b.change24h) + (b.liquidations24h?.total || 0) / 1000000;
        return bScore - aScore;
      })
      .slice(0, 3);
    
    console.log('   🔥 Top markets:');
    topMarkets.forEach(market => {
      console.log(`     ${market.symbol}: ${market.change24h.toFixed(1)}% | Fund: ${(market.fundingRate*100).toFixed(3)}% | Liq: $${((market.liquidations24h?.total || 0)/1000000).toFixed(1)}M`);
    });
    
    console.log('');
    
    // Attendi 3 secondi prima del prossimo scan
    if (i < 10) {
      await new Promise(resolve => setTimeout(resolve, 3000));
    }
  }
  
  // Statistiche finali
  console.log('📈 CONTINUOUS TEST RESULTS:');
  console.log(`   🎯 Total Signals Generated: ${totalSignals}`);
  console.log(`   💰 Total Profit Potential: $${totalProfitPotential.toFixed(2)}`);
  console.log(`   📊 Average Signals per Scan: ${(totalSignals/10).toFixed(1)}`);
  console.log(`   💵 Average Profit per Scan: $${(totalProfitPotential/10).toFixed(2)}`);
  
  if (bestSignal) {
    console.log(`\n🏆 BEST SIGNAL (Scan ${bestSignal.scan}):`);
    console.log(`   ${bestSignal.symbol} ${bestSignal.direction} | ${bestSignal.leverage}x | ${bestSignal.confidence}% | $${bestSignal.profit.toFixed(2)}`);
    console.log(`   Reason: ${bestSignal.reason}`);
  }
  
  if (worstSignal && worstSignal !== bestSignal) {
    console.log(`\n📉 WORST SIGNAL (Scan ${worstSignal.scan}):`);
    console.log(`   ${worstSignal.symbol} ${worstSignal.direction} | ${worstSignal.leverage}x | ${worstSignal.confidence}% | $${worstSignal.profit.toFixed(2)}`);
    console.log(`   Reason: ${worstSignal.reason}`);
  }
  
  console.log('\n⚠️  DISCLAIMER: This is simulated data for testing purposes only!');
  console.log('🔴 Real trading involves significant risk of loss!');
}

// Esegui il test continuo
runContinuousTest();
