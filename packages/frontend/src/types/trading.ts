export interface Position {
  id: string
  symbol: string
  side: 'long' | 'short'
  size: number
  entryPrice: number
  currentPrice: number
  pnl: number
  pnlPercentage: number
  leverage: number
  margin: number
  liquidationPrice: number
  timestamp: string
}

export interface TradingStats {
  totalPnl: number
  totalPnlPercentage: number
  winRate: number
  totalTrades: number
  activePositions: number
  balance: number
  availableBalance: number
  totalMargin: number
}

export interface MarketData {
  symbol: string
  price: number
  change24h: number
  volume24h: number
  fundingRate: number
  openInterest: number
  liquidations: {
    long: number
    short: number
  }
}

export interface LiquidationData {
  price: number
  amount: number
  side: 'long' | 'short'
  timestamp: string
}

export interface TradingSignal {
  id: string
  symbol: string
  type: 'buy' | 'sell'
  strategy: string
  confidence: number
  targetPrice: number
  stopLoss: number
  leverage: number
  timestamp: string
  status: 'pending' | 'executed' | 'cancelled'
}
