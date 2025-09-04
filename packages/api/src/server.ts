import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { database, getActiveTradeSignals, populateTestSignals } from '@gpt-wolf/db'
import { rankAndSelectBestSignals, getSignalStats } from '@gpt-wolf/core/src/signal-ranker'

const app = new Hono()

app.use('*', cors({
  origin: ['http://localhost:3000'],
  allowHeaders: ['Content-Type'],
  allowMethods: ['GET', 'POST', 'PUT', 'DELETE'],
}))

// Get trading statistics
app.get('/api/stats', async (c) => {
  try {
    // Query real data from database
    const positionsQuery = database.prepare(`
      SELECT COUNT(*) as count,
             COALESCE(SUM(pnl), 0) as totalPnl
      FROM active_positions
      WHERE status = 'OPEN'
    `)

    const positionsResult = positionsQuery.get() as any

    const tradesQuery = database.prepare(`
      SELECT COUNT(*) as total,
             COUNT(CASE WHEN status = 'CLOSED' AND pnl > 0 THEN 1 END) as wins
      FROM active_positions
    `)
    const tradesResult = tradesQuery.get() as any

    const balanceQuery = database.prepare(`
      SELECT 10000 + COALESCE(SUM(pnl), 0) as balance
      FROM active_positions
      WHERE status = 'CLOSED'
    `)
    const balanceResult = balanceQuery.get() as any

    const stats = {
      totalPnl: positionsResult?.totalPnl || 0,
      totalPnlPercentage: ((positionsResult?.totalPnl || 0) / 10000) * 100,
      winRate: tradesResult?.total > 0 ? (tradesResult.wins / tradesResult.total) * 100 : 0,
      totalTrades: tradesResult?.total || 0,
      activePositions: positionsResult?.count || 0,
      balance: balanceResult?.balance || 10000,
      availableBalance: (balanceResult?.balance || 10000) * 0.8,
      totalMargin: (positionsResult?.count || 0) * 500
    }

    return c.json(stats)
  } catch (error) {
    console.error('Error fetching stats:', error)
    return c.json({ error: 'Failed to fetch stats' }, 500)
  }
})

// Get active positions
app.get('/api/positions', async (c) => {
  try {
    const query = database.prepare(`
      SELECT id, symbol, side, size, entry_price, leverage,
             take_profit, stop_loss, created_at
      FROM active_positions
      WHERE status = 'OPEN'
      ORDER BY created_at DESC
    `)

    const rows = query.all() as any[]

    const positions = rows.map(row => {
      const currentPrice = row.symbol === 'BTCUSDT' ? 44100 : 2620 // Mock current prices
      const pnl = row.side === 'long'
        ? row.size * (currentPrice - row.entry_price)
        : row.size * (row.entry_price - currentPrice)

      const liquidationPrice = row.side === 'long'
        ? row.entry_price * (1 - 1/row.leverage * 0.9)
        : row.entry_price * (1 + 1/row.leverage * 0.9)

      return {
        id: row.id,
        symbol: row.symbol,
        side: row.side,
        size: row.size,
        entryPrice: row.entry_price,
        currentPrice,
        pnl,
        pnlPercentage: (pnl / (row.size * row.entry_price)) * 100,
        leverage: row.leverage,
        margin: (row.size * row.entry_price) / row.leverage,
        liquidationPrice,
        timestamp: new Date(row.created_at).toISOString()
      }
    })

    return c.json(positions)
  } catch (error) {
    console.error('Error fetching positions:', error)
    return c.json({ error: 'Failed to fetch positions' }, 500)
  }
})

// Get trading signals (only best ones)
app.get('/api/signals', async (c) => {
  try {
    const dbSignals = getActiveTradeSignals()
    
    // Seleziona solo i migliori 5 segnali
    const bestSignals = rankAndSelectBestSignals(dbSignals, 5)
    
    const signals = bestSignals.map(signal => ({
      id: `${signal.symbol}-${signal.timestamp}`,
      symbol: signal.symbol,
      type: signal.direction === 'LONG' ? 'buy' : 'sell',
      strategy: signal.reason.includes('liquidation') ? 'liquidation-hunt' : 'momentum',
      confidence: signal.confidence,
      targetPrice: signal.entryPrice * (1 + (signal.takeProfitPercent || 0) / 100 * (signal.direction === 'LONG' ? 1 : -1)),
      stopLoss: signal.entryPrice * (1 - (signal.stopLossPercent || 0) / 100 * (signal.direction === 'LONG' ? 1 : -1)),
      leverage: signal.leverage,
      timestamp: new Date(signal.timestamp || Date.now()).toISOString(),
      status: 'pending'
    }))

    return c.json(signals)
  } catch (error) {
    console.error('Error fetching signals:', error)
    return c.json({ error: 'Failed to fetch signals' }, 500)
  }
})

// Get signal statistics
app.get('/api/signal-stats', async (c) => {
  try {
    const dbSignals = getActiveTradeSignals()
    const bestSignals = rankAndSelectBestSignals(dbSignals, 5)
    const stats = getSignalStats(bestSignals)
    
    return c.json(stats)
  } catch (error) {
    console.error('Error fetching signal stats:', error)
    return c.json({ error: 'Failed to fetch signal stats' }, 500)
  }
})

// Populate test signals
app.get('/api/populate-signals', async (c) => {
  try {
    await populateTestSignals()
    return c.json({ message: 'Test signals populated successfully' })
  } catch (error) {
    console.error('Error populating test signals:', error)
    return c.json({ error: 'Failed to populate test signals' }, 500)
  }
})

// Health check
app.get('/api/health', (c) => {
  return c.json({ status: 'ok', timestamp: new Date().toISOString() })
})

const port = process.env.PORT || 8080
console.log(`🚀 API Server running on port ${port}`)

// Populate test signals on server startup
populateTestSignals()

export default {
  port,
  fetch: app.fetch,
}
