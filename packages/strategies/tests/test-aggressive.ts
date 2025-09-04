import { 
  ultraAggressiveStrategy, 
  calculatePositionSize, 
  calculatePotentialProfit,
  evaluateSignalRisk,
  MarketSummary, 
  StrategyConfig 
} from './index';

// Dati di test simulati
const mockMarkets: MarketSummary[] = [
  {
    symbol: 'BTCUSDT',
    price: 43500,
    volume24h: 1200000000,
    change24h: -3.2,
    fundingRate: 0.0012, // 0.12% - funding rate alto
    nextFundingTime: Date.now() + 1800000, // 30 minuti
    openInterest: 5000000000,
    liquidations24h: {
      buyQty: 15000000,
      sellQty: 45000000, // Più short liquidati
      total: 60000000
    }
  },
  {
    symbol: 'ETHUSDT',
    price: 2650,
    volume24h: 800000000,
    change24h: 8.5, // Forte movimento positivo
    fundingRate: -0.0008, // Funding negativo
    nextFundingTime: Date.now() + 1800000,
    openInterest: 2000000000,
    liquidations24h: {
      buyQty: 25000000, // Più long liquidati
      sellQty: 8000000,
      total: 33000000
    }
  },
  {
    symbol: 'SOLUSDT',
    price: 98.5,
    volume24h: 150000000,
    change24h: -12.3, // Forte movimento negativo
    fundingRate: 0.0015, // Funding molto alto
    nextFundingTime: Date.now() + 1800000,
    openInterest: 500000000,
    liquidations24h: {
      buyQty: 8000000,
      sellQty: 2000000,
      total: 10000000
    }
  }
];

const config: StrategyConfig = {
  defaultLeverage: 50,
  maxLeverage: 100,
  riskPercentage: 5
};

// Test della strategia
console.log('🚀 Testing Ultra Aggressive Strategy...\n');

const signals = ultraAggressiveStrategy(mockMarkets, config);

console.log(`📊 Generated ${signals.length} signals:\n`);

signals.forEach((signal, index) => {
  console.log(`${index + 1}. ${signal.symbol} - ${signal.direction}`);
  console.log(`   Entry: $${signal.entryPrice.toFixed(2)}`);
  console.log(`   Target: $${signal.targetPrice.toFixed(2)}`);
  console.log(`   Stop Loss: $${signal.stopLoss.toFixed(2)}`);
  console.log(`   Leverage: ${signal.leverage}x`);
  console.log(`   Confidence: ${signal.confidence}%`);
  console.log(`   Urgency: ${signal.urgency}`);
  console.log(`   Reason: ${signal.reason}`);
  
  // Calcola dimensione posizione per $10,000 di capitale
  const positionSize = calculatePositionSize(signal, 10000, 5);
  console.log(`   Position Size: ${positionSize.toFixed(4)} ${signal.symbol.replace('USDT', '')}`);
  
  // Calcola potenziale profitto
  const potentialProfit = calculatePotentialProfit(signal, positionSize);
  console.log(`   Potential Profit: $${potentialProfit.toFixed(2)}`);
  
  // Valuta rischio
  const riskAssessment = evaluateSignalRisk(signal);
  console.log(`   Risk Level: ${riskAssessment.level}`);
  console.log(`   Recommendation: ${riskAssessment.recommendation}`);
  
  console.log('');
});

// Statistiche generali
const avgConfidence = signals.reduce((sum, s) => sum + s.confidence, 0) / signals.length;
const avgLeverage = signals.reduce((sum, s) => sum + s.leverage, 0) / signals.length;
const highUrgencyCount = signals.filter(s => s.urgency === 'HIGH').length;

console.log('📈 Strategy Statistics:');
console.log(`   Average Confidence: ${avgConfidence.toFixed(1)}%`);
console.log(`   Average Leverage: ${avgLeverage.toFixed(1)}x`);
console.log(`   High Urgency Signals: ${highUrgencyCount}/${signals.length}`);
console.log(`   Total Potential Signals: ${signals.length}`);
