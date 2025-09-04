# GPT-Wolf Trading Bot

Un bot di trading aggressivo per il mercato dei futures su Bybit, progettato per massimizzare i guadagni utilizzando strategie ad alta leva (25x-100x).

## Caratteristiche

- 🔍 **Scanner di mercato**: analizza tutti i contratti perpetui su Bybit per identificare opportunità di trading
- 💰 **Strategie aggressive**: utilizza leve alte (25x-100x) per massimizzare i profitti
- 📊 **Analisi tecnica avanzata**: monitora funding rate, liquidazioni, CVD e anomalie di volume
- 🤖 **Trading automatizzato**: genera segnali di trading basati su strategie multiple
- 📱 **Notifiche Telegram**: ricevi segnali di trading in tempo reale sul tuo telefono
- 💾 **Database SQLite**: storage locale per storico segnali e analisi

## Struttura del Progetto

Il progetto è strutturato come un monorepo Bun con i seguenti pacchetti:

- `@gpt-wolf/worker`: componente principale che utilizza l'API Bybit
- `@gpt-wolf/core`: tipi, funzionalità condivise e notifiche Telegram
- `@gpt-wolf/db`: database SQLite per storage locale
- `@gpt-wolf/strategies`: implementazione di strategie di trading aggressive
- `@gpt-wolf/frontend`: dashboard React per monitoraggio segnali
- `@gpt-wolf/api`: server API per interfaccia web

## Installazione

```bash
# Clona il repository
git clone https://github.com/yourusername/gpt-wolf.git
cd gpt-wolf

# Installa le dipendenze
bun install

# Copia il file di esempio .env e configuralo
cp .env.example .env
# Modifica il file .env con le tue chiavi API
```

## Configurazione

Modifica il file `.env` con le tue chiavi API Bybit e Telegram:

```
# Bybit API Keys
BYBIT_API_KEY=your_api_key_here
BYBIT_API_SECRET=your_api_secret_here
TESTNET=false

# Telegram Bot Configuration
TELEGRAM_BOT_TOKEN=your_telegram_bot_token
TELEGRAM_CHAT_ID=your_chat_id

# Trading Config
DEFAULT_LEVERAGE=50
MAX_LEVERAGE=100
RISK_PERCENTAGE=5
MAX_CONCURRENT_POSITIONS=5
```

## Utilizzo

```bash
# Avvia il sistema completo (API + Frontend + Trading Bot)
bun run dev:full

# Solo bot di trading
bun run trade

# Solo frontend
bun run frontend:dev

# Solo API server
bun run api:dev
```

## Strategie di Trading

Il bot implementa diverse strategie di trading aggressive:

1. **Scalping Ultra-Rapido**: movimenti micro con leva 75x-100x basati su volatilità
2. **Funding Rate Contrarian**: posizioni contro funding rate estremi (>0.1%)
3. **Liquidation Cluster Scalping**: sfrutta cluster di liquidazioni per cascate
4. **Volume Anomaly**: identifica manipolazioni tramite anomalie di volume
5. **Liquidation Heatmap**: mappa densità liquidazioni per entry precise

## Sistema di Notifiche e Storage

### **SQLite Database** (Storage Primario)
- 💾 **Salvataggio persistente** di tutti i segnali di trading
- 📊 **Storico completo** per analisi e backtesting
- 🔍 **Query locali** per performance tracking
- 📈 **Integrazione con dashboard** per visualizzazione

### **Telegram Bot** (Notifiche Real-Time)
- 📱 **Alert immediati** su mobile per ogni segnale
- ⚡ **Formato ottimizzato** con R/R ratio e profit potenziale
- 🚨 **Solo notifiche** - non storage alternativo
- 💬 **Messaggi professionali** con emoji e Markdown

### Configurazione Telegram Bot:
1. Crea bot con [@BotFather](https://t.me/BotFather)
2. Ottieni `TELEGRAM_BOT_TOKEN`
3. Trova il tuo `TELEGRAM_CHAT_ID`
4. Aggiungi le variabili al file `.env`

## ⚠️ Avvertenze

- **RISCHIO ELEVATO**: Le strategie implementate sono estremamente aggressive e comportano un alto rischio di perdita del capitale
- **SOLO PER TRADER ESPERTI**: L'utilizzo di leve 25x-100x è adatto solo a trader molto esperti
- **TESTARE IN TESTNET**: Si consiglia vivamente di testare il bot in modalità testnet prima di utilizzarlo con fondi reali

## Funzionalità Implementate

- [x] **Dashboard React** con monitoraggio real-time
- [x] **Notifiche Telegram** per tutti i segnali
- [x] **Database SQLite** per storage locale
- [x] **5+ Strategie** aggressive ad alta leva
- [x] **Liquidation Heatmap** per visualizzazione cluster
- [x] **API REST** per integrazione frontend
- [x] **Monorepo Bun** con TypeScript

## Roadmap Future

- [ ] Trading automatico con esecuzione ordini
- [ ] Backtesting engine per strategie
- [ ] Supporto exchange multipli
- [ ] Mobile app nativa
- [ ] Machine learning per pattern recognition
