# 🚀 GPT-Wolf Aggressive Trading Strategies

Strategie di trading ultra-aggressive per futures crypto con leva 25x-100x.

## 📁 Struttura

```
packages/strategies/src/
├── types.ts                 # Interfacce condivise
├── funding-analyzer.ts      # Analisi funding rate
├── liquidation-analyzer.ts  # Analisi liquidazioni
├── technical-analyzer.ts    # Analisi tecnica
├── aggressive.ts           # Strategia principale
├── volume.ts              # Strategia volume
├── index.ts               # Esportazioni
├── test-aggressive.ts     # Test con dati simulati
├── demo-test.ts          # Demo con dati realistici
├── continuous-test.ts    # Test continuo
└── live-test.ts         # Test con dati reali (richiede API)
```

## 🎯 Strategia Ultra-Aggressiva

### Componenti Principali

#### 1. **Funding Rate Analyzer**
- Identifica funding rate estremi (>0.1%)
- Strategia contrarian: funding alto → SHORT, funding basso → LONG
- Leva massima: **100x**
- Timing ottimale: 30 minuti prima del funding

#### 2. **Liquidation Analyzer**
- Rileva liquidazioni massive (>$5M)
- Sfrutta cascate di liquidazioni
- Leva: **75x**
- Segue il flusso dominante delle liquidazioni

#### 3. **Technical Analyzer**
- Pattern di breakout e momentum
- Calcolo dinamico di supporti/resistenze
- Leva: **50-75x** in base al pattern
- Analisi volatilità e volume spike

### Segnali Generati

La strategia combina tutti gli analyzer per generare segnali con:
- **Confidence**: 70-95%
- **Urgency**: LOW/MEDIUM/HIGH
- **Leverage**: 50x-100x
- **Risk/Reward**: Calcolato dinamicamente

## 📊 Test Results

### Demo Test (Dati Realistici)
```
🔥 Generated 1 AGGRESSIVE signals:
BTCUSDT LONG | 75x | 80% | $25,049 profit (250.5%)
Risk Level: HIGH | R/R: 1:0.50
```

### Continuous Test (10 Scans)
```
📈 RESULTS:
Total Signals: 47
Total Profit Potential: $1,427,465
Average per Scan: 4.7 signals | $142,746 profit
Best Signal: ETHUSDT LONG | $52,338 profit
```

## 🚨 Gestione del Rischio

### Calcolo Posizione
```typescript
const positionSize = calculatePositionSize(signal, capital, riskPercent);
```

### Valutazione Rischio
```typescript
const risk = evaluateSignalRisk(signal);
// Levels: LOW | MEDIUM | HIGH | EXTREME
```

### Raccomandazioni
- **EXTREME**: Riduci leva o capitale
- **HIGH**: Usa stop loss stretto
- **MEDIUM**: Monitora attentamente
- **LOW**: Rischio accettabile

## 🔧 Utilizzo

### Test Rapido
```bash
bun run packages/strategies/src/demo-test.ts
```

### Test Continuo
```bash
bun run packages/strategies/src/continuous-test.ts
```

### Test Live (richiede API Bybit)
```bash
bun run packages/strategies/src/live-test.ts
```

### Integrazione
```typescript
import { ultraAggressiveStrategy } from './strategies';

const signals = ultraAggressiveStrategy(markets, config);
```

## ⚠️ DISCLAIMER

**🔴 ATTENZIONE: RISCHIO ESTREMO**

- Leva 75x-100x = Rischio di perdita totale
- Solo per trader esperti
- Mai usare tutto il capitale
- Sempre con stop loss
- Testare prima in demo

**Questa strategia è progettata per massimizzare i profitti con rischio elevato. Usa solo capitale che puoi permetterti di perdere completamente.**

## 🎛️ Configurazione

```typescript
const config: StrategyConfig = {
  defaultLeverage: 50,
  maxLeverage: 100,
  riskPercentage: 5  // 5% del capitale per trade
};
```

## 📈 Performance Attese

- **Segnali per ora**: 2-8
- **Tasso di successo**: 60-80% (simulato)
- **Profitto medio**: 50-300% per trade vincente
- **Perdita media**: 80-100% per trade perdente
- **Drawdown massimo**: Fino al 100% del capitale

## 🔄 Aggiornamenti

La strategia si adatta automaticamente alle condizioni di mercato:
- Funding rate in tempo reale
- Liquidazioni live
- Volatilità dinamica
- Pattern emergenti

---

**Made with ⚡ by GPT-Wolf Trading System**
