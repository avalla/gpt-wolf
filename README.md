# GPT-Wolf Trading Bot

Un bot di trading aggressivo per il mercato dei futures su Bybit, progettato per massimizzare i guadagni utilizzando strategie ad alta leva (25x-100x).

## Caratteristiche

- 🔍 **Scanner di mercato**: analizza tutti i contratti perpetui su Bybit per identificare opportunità di trading
- 💰 **Strategie aggressive**: utilizza leve alte (25x-100x) per massimizzare i profitti
- 📊 **Analisi tecnica avanzata**: monitora funding rate, liquidazioni, CVD e anomalie di volume
- 🤖 **Trading automatizzato**: genera segnali di trading basati su strategie multiple
- 📈 **Dashboard**: salva tutti i dati in Supabase per analisi e monitoraggio

## Struttura del Progetto

Il progetto è strutturato come un monorepo Bun con i seguenti pacchetti:

- `@gpt-wolf/worker`: componente principale che utilizza l'API Bybit
- `@gpt-wolf/core`: tipi e funzionalità condivise
- `@gpt-wolf/db`: integrazione con Supabase per il salvataggio dei dati
- `@gpt-wolf/strategies`: implementazione di strategie di trading aggressive

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
# Avvia il bot di trading
bun run dev

# Esegui una scansione del mercato
bun run scan

# Genera segnali di trading
bun run trade
```

## Strategie di Trading

Il bot implementa diverse strategie di trading aggressive:

1. **Momentum Strategy**: cerca movimenti di prezzo significativi e apre posizioni nella direzione del trend con leva 25x-100x
2. **Funding Rate Strategy**: cerca contratti con funding rate estremi e apre posizioni contro il mercato con leva 50x-100x
3. **Liquidation Hunting**: cerca aree con alta concentrazione di liquidazioni e apre posizioni per innescare un effetto cascata
4. **Volume Anomaly**: identifica manipolazioni di mercato attraverso anomalie di volume e ne approfitta

## Integrazione con Supabase

Il bot salva tutti i dati di scansione e i segnali di trading in Supabase per analisi e monitoraggio. Per configurare il database Supabase:

1. Crea un nuovo progetto su [Supabase](https://supabase.com)
2. Crea le seguenti tabelle:
   - `market_scans`: per salvare i risultati delle scansioni
   - `trade_signals`: per salvare i segnali di trading generati

## ⚠️ Avvertenze

- **RISCHIO ELEVATO**: Le strategie implementate sono estremamente aggressive e comportano un alto rischio di perdita del capitale
- **SOLO PER TRADER ESPERTI**: L'utilizzo di leve 25x-100x è adatto solo a trader molto esperti
- **TESTARE IN TESTNET**: Si consiglia vivamente di testare il bot in modalità testnet prima di utilizzarlo con fondi reali

## Roadmap

- [ ] Implementare backtesting delle strategie
- [ ] Aggiungere supporto per trading automatico con API Bybit
- [ ] Creare dashboard per monitoraggio in tempo reale
- [ ] Implementare notifiche Telegram per segnali di trading
- [ ] Aggiungere supporto per altre exchange
