# 🐺 GPT-Wolf Trading Bot

An aggressive futures trading bot for Bybit, designed to maximize profits using high-leverage strategies (25x-100x) with advanced market analysis and automated position management.

## ✨ Features

- 🔍 **Market Scanner**: Analyzes all Bybit perpetual contracts to identify trading opportunities
- 💰 **Aggressive Strategies**: 7 high-leverage strategies (25x-100x) for maximum profit potential
- 📊 **Advanced Technical Analysis**: Monitors funding rates, liquidations, CVD, and volume anomalies
- 🤖 **Automated Trading**: Generates and executes trading signals with automatic position management
- 📱 **Telegram Notifications**: Real-time trading signals delivered to your phone
- 💾 **SQLite Database**: Local storage for signal history and performance analysis
- 🎯 **Risk Management**: Built-in stop-loss, take-profit, and position sizing

## 🏗️ Project Structure

This project is structured as a Bun monorepo with the following packages:

- `@gpt-wolf/worker`: Main trading engine using Bybit API
- `@gpt-wolf/core`: Shared types, utilities, and Telegram notifications
- `@gpt-wolf/db`: SQLite database for local storage
- `@gpt-wolf/strategies`: Implementation of 7 aggressive trading strategies
- `@gpt-wolf/frontend`: React dashboard for signal monitoring
- `@gpt-wolf/api`: REST API server for web interface

## 🚀 Installation

```bash
# Clone the repository
git clone https://github.com/avalla/gpt-wolf.git
cd gpt-wolf

# Install dependencies
bun install

# Copy environment file and configure
cp env.example .env
# Edit .env with your API keys
```

## ⚙️ Configuration

Edit the `.env` file with your Bybit and Telegram API keys:

```env
# Bybit API Configuration
BYBIT_API_KEY=your_bybit_api_key_here
BYBIT_API_SECRET=your_bybit_api_secret_here
TESTNET=true

# Trading Configuration
TRADING_CAPITAL=100
DEFAULT_LEVERAGE=25
MAX_LEVERAGE=100
RISK_PERCENTAGE=2

# Strategy Configuration (comma-separated, leave empty for all)
STRATEGIES=

# Telegram Notifications (optional)
TELEGRAM_BOT_TOKEN=your_telegram_bot_token
TELEGRAM_CHAT_ID=your_telegram_chat_id
```

## 🎮 Usage

### Quick Start (Recommended for Testing)
```bash
# 1. Set up testnet environment
cp env.example .env
# Edit .env: set TESTNET=true, TRADING_CAPITAL=100

# 2. Start trading bot
bun run packages/worker/src/trade.ts

# 3. Monitor signals in terminal or Telegram
```

### Full System
```bash
# Start complete system (API + Frontend + Trading Bot)
bun run dev:full

# Individual components
bun run trade                 # Trading bot only
bun run frontend:dev         # Frontend dashboard
bun run api:dev             # API server only

# Run specific strategies
STRATEGIES=liquidationcascade,cvddivergence bun run trade
```

## 📈 Trading Strategies

The bot implements 7 aggressive trading strategies:

### 🎯 **Volume Spike Detection**
- **Leverage**: 25-75x
- **Target**: 0.5-2.0%
- **Timeframe**: 5-15m
- **Logic**: Detects unusual volume spikes indicating potential breakouts

### ⚡ **Liquidation Cascade**
- **Leverage**: 15-50x
- **Target**: 0.8-2.3%
- **Timeframe**: 5m
- **Logic**: Anticipates liquidation cascades from liquidation map imbalances

### 📊 **CVD Divergence**
- **Leverage**: 20-60x
- **Target**: 0.6-1.4%
- **Timeframe**: 15m
- **Logic**: Analyzes Cumulative Volume Delta divergences between futures and spot

### 📰 **News Momentum**
- **Leverage**: 25-75x
- **Target**: 1.0-4.0%
- **Timeframe**: 1m
- **Logic**: Reacts to market events and news within 5 seconds

### 📋 **Orderbook Imbalance**
- **Leverage**: 30-100x
- **Target**: 0.15-0.5%
- **Timeframe**: 30s
- **Logic**: Micro-scalping based on bid/ask ratio extremes

### 🔄 **Cross-Exchange Arbitrage**
- **Leverage**: 10-50x
- **Target**: Based on price convergence
- **Timeframe**: 5m
- **Logic**: Exploits price differences between exchanges

### 🐋 **Whale Movement Detection**
- **Leverage**: 20-60x
- **Target**: 0.8-2.0%
- **Timeframe**: 30m
- **Logic**: Follows large transactions and smart money flows

## 🔔 Notifications & Storage System

### **SQLite Database** (Primary Storage)
- 💾 **Persistent storage** of all trading signals
- 📊 **Complete history** for analysis and backtesting
- 🔍 **Local queries** for performance tracking
- 📈 **Dashboard integration** for visualization

### **Telegram Bot** (Real-Time Notifications)
- 📱 **Instant mobile alerts** for every signal
- ⚡ **Optimized format** with R/R ratio and profit potential
- 🚨 **Notifications only** - not alternative storage
- 💬 **Professional messages** with emojis and Markdown

### Telegram Bot Setup:
1. Create bot with [@BotFather](https://t.me/BotFather)
2. Get your `TELEGRAM_BOT_TOKEN`
3. Find your `TELEGRAM_CHAT_ID`
4. Add variables to `.env` file

## ⚠️ Risk Warning

- **HIGH RISK**: The implemented strategies are extremely aggressive and carry high risk of capital loss
- **EXPERT TRADERS ONLY**: Using 25x-100x leverage is suitable only for very experienced traders
- **TEST IN TESTNET**: Strongly recommended to test the bot in testnet mode before using real funds
- **START SMALL**: Begin with minimal capital ($50-100) to test strategy performance
- **MONITOR CLOSELY**: High-frequency trading requires constant monitoring

## ✅ Implemented Features

- [x] **React Dashboard** with real-time monitoring
- [x] **Telegram Notifications** for all signals
- [x] **SQLite Database** for local storage
- [x] **7 Aggressive Strategies** with high leverage
- [x] **Automatic Position Management** with SL/TP
- [x] **REST API** for frontend integration
- [x] **Bun Monorepo** with TypeScript
- [x] **Risk Management** with position sizing
- [x] **Strategy Filtering** and configuration

## 🗺️ Future Roadmap

- [ ] Advanced backtesting engine
- [ ] Multi-exchange support (Binance, OKX)
- [ ] Mobile app for iOS/Android
- [ ] Machine learning pattern recognition
- [ ] Portfolio optimization algorithms
- [ ] Social trading features

## 🤝 Contributing

Contributions are welcome! Please read our contributing guidelines and submit pull requests for any improvements.

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 📞 Support

For support and questions, please open an issue on GitHub or contact the development team.
