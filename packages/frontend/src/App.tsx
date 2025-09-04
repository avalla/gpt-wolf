import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { TrendingUp, TrendingDown, Activity, DollarSign, Target, AlertTriangle } from 'lucide-react'
import { formatCurrency, formatPercentage, formatNumber } from '@/lib/utils'
import type { TradingStats, Position, MarketData, TradingSignal } from '@/types/trading'

// Real API calls to the backend
const fetchTradingStats = async (): Promise<TradingStats> => {
  const response = await fetch('http://localhost:8080/api/stats')
  if (!response.ok) throw new Error('Failed to fetch stats')
  return response.json()
}

const fetchPositions = async (): Promise<Position[]> => {
  const response = await fetch('http://localhost:8080/api/positions')
  if (!response.ok) throw new Error('Failed to fetch positions')
  return response.json()
}

const fetchSignals = async (): Promise<TradingSignal[]> => {
  const response = await fetch('http://localhost:8080/api/signals')
  if (!response.ok) throw new Error('Failed to fetch signals')
  return response.json()
}

function App() {
  const [selectedTab, setSelectedTab] = useState<'overview' | 'positions' | 'signals'>('overview')

  const { data: stats, isLoading: statsLoading, error: statsError } = useQuery({
    queryKey: ['trading-stats'],
    queryFn: fetchTradingStats,
  })

  const { data: positions, isLoading: positionsLoading, error: positionsError } = useQuery({
    queryKey: ['positions'],
    queryFn: fetchPositions,
  })

  const { data: signals, isLoading: signalsLoading, error: signalsError } = useQuery({
    queryKey: ['signals'],
    queryFn: fetchSignals,
  })

  const executeSignal = async (signal: TradingSignal) => {
    try {
      // Parametri ottimizzati per evitare falsi breakout
      const tradeParams = {
        symbol: signal.symbol,
        side: signal.type === 'buy' ? 'long' : 'short',
        leverage: signal.leverage,
        size: 0.6, // Ridotto a 60% per gestire meglio il rischio
        entryPrice: signal.targetPrice,
        stopLoss: signal.stopLoss,
        takeProfit1: signal.targetPrice * (signal.type === 'buy' ? 1.015 : 0.985), // TP1 a 1.5% - più conservativo
        takeProfit2: signal.targetPrice * (signal.type === 'buy' ? 1.035 : 0.965), // TP2 a 3.5%
        reason: signal.strategy
      }

      const response = await fetch('http://localhost:8080/api/execute-trade', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(tradeParams)
      })

      if (!response.ok) throw new Error('Failed to execute trade')

      const result = await response.json()
      console.log('Trade eseguito con successo:', result)

      // Refresh delle posizioni dopo l'esecuzione
      window.location.reload()
    } catch (error) {
      console.error('Errore nell\'esecuzione del trade:', error)
    }
  }

  return (
    <div className="min-h-screen bg-background p-4">
      <div className="mx-auto max-w-7xl space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">GPT Wolf Dashboard</h1>
            <p className="text-muted-foreground">Trading aggressivo con leva alta</p>
          </div>
          <div className="flex space-x-2">
            <Badge variant={selectedTab === 'overview' ? 'default' : 'outline'}
                   className="cursor-pointer"
                   onClick={() => setSelectedTab('overview')}>
              Overview
            </Badge>
            <Badge variant={selectedTab === 'positions' ? 'default' : 'outline'}
                   className="cursor-pointer"
                   onClick={() => setSelectedTab('positions')}>
              Posizioni
            </Badge>
            <Badge variant={selectedTab === 'signals' ? 'default' : 'outline'}
                   className="cursor-pointer"
                   onClick={() => setSelectedTab('signals')}>
              Segnali
            </Badge>
          </div>
        </div>

        {/* Stats Overview */}
        {selectedTab === 'overview' && (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">P&L Totale</CardTitle>
                <DollarSign className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                {statsLoading ? (
                  <div className="text-2xl font-bold">Loading...</div>
                ) : statsError ? (
                  <div className="text-2xl font-bold text-red-600">Error</div>
                ) : stats ? (
                  <>
                    <div className={`text-2xl font-bold ${stats.totalPnl >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {formatCurrency(stats.totalPnl)}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {formatPercentage(stats.totalPnlPercentage)}
                    </p>
                  </>
                ) : null}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Win Rate</CardTitle>
                <Target className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                {statsLoading ? (
                  <div className="text-2xl font-bold">Loading...</div>
                ) : stats ? (
                  <>
                    <div className="text-2xl font-bold">{formatPercentage(stats.winRate)}</div>
                    <p className="text-xs text-muted-foreground">
                      {stats.totalTrades} trades totali
                    </p>
                  </>
                ) : null}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Balance</CardTitle>
                <Activity className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                {statsLoading ? (
                  <div className="text-2xl font-bold">Loading...</div>
                ) : stats ? (
                  <>
                    <div className="text-2xl font-bold">{formatCurrency(stats.balance)}</div>
                    <p className="text-xs text-muted-foreground">
                      {formatCurrency(stats.availableBalance)} disponibile
                    </p>
                  </>
                ) : null}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Posizioni Attive</CardTitle>
                <AlertTriangle className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                {statsLoading ? (
                  <div className="text-2xl font-bold">Loading...</div>
                ) : stats ? (
                  <>
                    <div className="text-2xl font-bold">{stats.activePositions}</div>
                    <p className="text-xs text-muted-foreground">
                      {formatCurrency(stats.totalMargin)} margine
                    </p>
                  </>
                ) : null}
              </CardContent>
            </Card>
          </div>
        )}

        {/* Positions */}
        {selectedTab === 'positions' && (
          <div className="space-y-4">
            <h2 className="text-2xl font-bold">Posizioni Attive</h2>
            {positionsLoading ? (
              <Card>
                <CardContent className="p-6">
                  <div className="text-center">Loading positions...</div>
                </CardContent>
              </Card>
            ) : positionsError ? (
              <Card>
                <CardContent className="p-6">
                  <div className="text-center text-red-600">Error loading positions</div>
                </CardContent>
              </Card>
            ) : positions && positions.length > 0 ? (
              <div className="grid gap-4">
                {positions.map((position) => (
                  <Card key={position.id}>
                    <CardHeader>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-3">
                          <CardTitle className="text-lg">{position.symbol}</CardTitle>
                          <div className="flex items-center space-x-1">
                            <Badge variant={position.side === 'long' ? 'success' : 'destructive'}>
                              {position.side.toUpperCase()}
                            </Badge>
                          </div>
                        </div>
                        <div className="flex items-center space-x-2">
                          <Badge variant="outline">{position.leverage}x</Badge>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <div>
                          <p className="text-sm text-muted-foreground">Size</p>
                          <p className="font-semibold">{formatNumber(position.size, 4)}</p>
                        </div>
                        <div>
                          <p className="text-sm text-muted-foreground">Entry Price</p>
                          <p className="font-semibold">{formatCurrency(position.entryPrice)}</p>
                        </div>
                        <div>
                          <p className="text-sm text-muted-foreground">Current Price</p>
                          <p className="font-semibold">{formatCurrency(position.currentPrice)}</p>
                        </div>
                        <div>
                          <p className="text-sm text-muted-foreground">P&L</p>
                          <p className={`font-semibold ${position.pnl >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                            {formatCurrency(position.pnl)} ({formatPercentage(position.pnlPercentage)})
                          </p>
                        </div>
                        <div>
                          <p className="text-sm text-muted-foreground">Margin</p>
                          <p className="font-semibold">{formatCurrency(position.margin)}</p>
                        </div>
                        <div>
                          <p className="text-sm text-muted-foreground">Liquidation</p>
                          <p className="font-semibold text-red-600">{formatCurrency(position.liquidationPrice)}</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : (
              <Card>
                <CardContent className="p-6">
                  <div className="text-center text-muted-foreground">Nessuna posizione attiva</div>
                </CardContent>
              </Card>
            )}
          </div>
        )}

        {/* Signals */}
        {selectedTab === 'signals' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-2xl font-bold">Segnali di Trading</h2>
              <Badge variant="outline" className="text-xs">
                Aggiornamento automatico ogni 30s
              </Badge>
            </div>
            {signalsLoading ? (
              <Card>
                <CardContent className="p-6">
                  <div className="text-center">Loading signals...</div>
                </CardContent>
              </Card>
            ) : signalsError ? (
              <Card>
                <CardContent className="p-6">
                  <div className="text-center text-red-600">Error loading signals</div>
                </CardContent>
              </Card>
            ) : signals && signals.length > 0 ? (
              <div className="grid gap-4">
                {signals.map((signal, index) => (
                  <Card key={`${signal.symbol}-${signal.timestamp}-${index}`} className="border-l-4 border-l-blue-500">
                    <CardHeader>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-3">
                          <CardTitle className="text-lg">{signal.symbol}</CardTitle>
                          <div className="flex items-center space-x-1">
                            {signal.type === 'buy' ? (
                              <TrendingUp className="h-4 w-4 text-green-600" />
                            ) : (
                              <TrendingDown className="h-4 w-4 text-red-600" />
                            )}
                          </div>
                        </div>
                        <div className="flex items-center space-x-2">
                          <Badge variant={signal.type === 'buy' ? 'default' : 'destructive'}>
                            {signal.type === 'buy' ? 'LONG' : 'SHORT'}
                          </Badge>
                          <Badge variant="outline">{signal.leverage}x</Badge>
                          <Badge variant="secondary" className="bg-yellow-100 text-yellow-800">
                            ATTIVO
                          </Badge>
                        </div>
                      </div>
                      <CardDescription className="text-sm">
                        <span className="font-medium">Strategia:</span> {signal.strategy}
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                        <div>
                          <p className="text-sm text-muted-foreground">Entry Price</p>
                          <p className="font-semibold text-blue-600">{formatCurrency(signal.targetPrice)}</p>
                        </div>
                        <div>
                          <p className="text-sm text-muted-foreground">Target Price</p>
                          <p className="font-semibold text-green-600">{formatCurrency(signal.targetPrice)}</p>
                        </div>
                        <div>
                          <p className="text-sm text-muted-foreground">Stop Loss</p>
                          <p className="font-semibold text-red-600">{formatCurrency(signal.stopLoss)}</p>
                        </div>
                        <div>
                          <p className="text-sm text-muted-foreground">Risk/Reward</p>
                          <p className="font-semibold">
                            {((signal.targetPrice - signal.targetPrice) / (signal.targetPrice - signal.stopLoss)).toFixed(1)}:1
                          </p>
                        </div>
                        <div>
                          <p className="text-sm text-muted-foreground">Generato</p>
                          <p className="font-semibold text-xs">
                            {new Date(signal.timestamp).toLocaleString('it-IT', {
                              hour: '2-digit',
                              minute: '2-digit',
                              second: '2-digit'
                            })}
                          </p>
                        </div>
                      </div>

                      {/* Progress bar per potenziale profitto */}
                      <div className="mt-4 space-y-2">
                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground">Potenziale Profitto</span>
                          <span className="font-medium text-green-600">
                            +{formatPercentage(((signal.targetPrice - signal.targetPrice) / signal.targetPrice) * signal.leverage)}
                          </span>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-2">
                          <div
                            className="bg-green-600 h-2 rounded-full transition-all duration-300"
                            style={{
                              width: `${Math.min(((signal.targetPrice - signal.targetPrice) / signal.targetPrice) * signal.leverage * 100, 100)}%`
                            }}
                          ></div>
                        </div>
                      </div>

                      {/* Azioni rapide */}
                      <div className="mt-4 flex space-x-2">
                        <button
                          className="px-3 py-1 bg-green-600 text-white text-xs rounded hover:bg-green-700 transition-colors"
                          onClick={() => executeSignal(signal)}
                        >
                          Esegui Trade
                        </button>
                        <button className="px-3 py-1 bg-gray-500 text-white text-xs rounded hover:bg-gray-600 transition-colors">
                          Ignora
                        </button>
                        <button className="px-3 py-1 bg-blue-600 text-white text-xs rounded hover:bg-blue-700 transition-colors">
                          Modifica
                        </button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : (
              <Card>
                <CardContent className="p-6">
                  <div className="text-center space-y-2">
                    <AlertTriangle className="h-12 w-12 text-muted-foreground mx-auto" />
                    <div className="text-muted-foreground">Nessun segnale attivo</div>
                    <p className="text-sm text-muted-foreground">
                      Il sistema sta scansionando il mercato per nuove opportunità...
                    </p>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

export default App
