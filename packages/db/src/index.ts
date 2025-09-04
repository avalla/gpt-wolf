import { Database } from 'bun:sqlite';
import type { TradeSignal } from './types';

export * from './types';

import { join } from 'path';

/**
 * Formatta una data in formato ISO 8601 standardizzato
 */
function formatDateISO(date?: Date | number | string): string {
  if (!date) {
    return new Date().toISOString();
  }
  
  if (typeof date === 'number') {
    return new Date(date).toISOString();
  }
  
  if (typeof date === 'string') {
    const parsed = new Date(date);
    return isNaN(parsed.getTime()) ? new Date().toISOString() : parsed.toISOString();
  }
  
  return date.toISOString();
}

// Database centralizzato nella root del progetto
const dbPath = join(process.cwd().includes('packages') 
  ? process.cwd().split('packages')[0] 
  : process.cwd(), 'gpt-wolf.sqlite');

const db = new Database(dbPath, { create: true });

function initializeSchema() {
  const schema = `
    CREATE TABLE IF NOT EXISTS trade_signals (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      symbol TEXT NOT NULL,
      direction TEXT NOT NULL,
      entryPrice REAL NOT NULL,
      targetPrice REAL NOT NULL,
      stopLoss REAL NOT NULL,
      leverage INTEGER NOT NULL,
      orderType TEXT DEFAULT 'Market',
      reason TEXT NOT NULL,
      timestamp INTEGER NOT NULL,
      timeframe TEXT DEFAULT '15m',
      validUntil INTEGER,
      createdAt TEXT,
      expiresAt TEXT,
      status TEXT DEFAULT 'ACTIVE',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS active_positions (
      id TEXT PRIMARY KEY,
      symbol TEXT NOT NULL,
      side TEXT NOT NULL,
      size REAL NOT NULL,
      entry_price REAL NOT NULL,
      leverage INTEGER NOT NULL,
      take_profit REAL,
      stop_loss REAL,
      pnl REAL DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'OPEN',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      closed_at DATETIME
    );
  `;
  db.exec(schema);

}

initializeSchema();

export const database = db;

export function saveTradeSignal(signal: TradeSignal) {
  try {
    const now = Date.now();
    const currentTime = formatDateISO();
    const expirationTime = formatDateISO(now + 3600000); // 1 hour from now
    
    const query = db.prepare(
      'INSERT INTO trade_signals (symbol, direction, entryPrice, targetPrice, stopLoss, leverage, orderType, reason, timestamp, timeframe, validUntil, createdAt, expiresAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
    );
    query.run(
      signal.symbol,
      signal.direction,
      signal.entryPrice,
      signal.targetPrice,
      signal.stopLoss,
      signal.leverage,
      signal.orderType || 'Market',
      signal.reason,
      signal.timestamp || now,
      signal.timeframe || '15m',
      signal.validUntil || (now + 3600000),
      formatDateISO(signal.createdAt) || currentTime,
      formatDateISO(signal.expiresAt) || expirationTime
    );
  } catch (error) {
    console.error('[DB] Errore nel salvataggio del segnale:', error);
    throw error;
  }
}

export function getActiveTradeSignals(): TradeSignal[] {
  try {
    const query = db.prepare("SELECT * FROM trade_signals WHERE status = 'ACTIVE' ORDER BY timestamp DESC LIMIT 50");
    const rows = query.all() as any[];
    return rows.map(row => ({
      symbol: row.symbol,
      direction: row.direction,
      entryPrice: row.entryPrice,
      targetPrice: row.targetPrice,
      stopLoss: row.stopLoss,
      leverage: row.leverage,
      orderType: row.orderType,
      reason: row.reason,
      timestamp: row.timestamp,
      timeframe: row.timeframe,
      validUntil: row.validUntil,
      createdAt: row.createdAt,
      expiresAt: row.expiresAt,
      status: row.status
    }));
  } catch (error) {
    console.error('[DB] Errore nel recupero dei segnali:', error);
    return [];
  }
}

export function updateSignalStatus(symbol: string, direction: string, status: 'COMPLETED' | 'FAILED' | 'EXPIRED'): void {
  try {
    const query = db.prepare("UPDATE trade_signals SET status = ? WHERE symbol = ? AND direction = ? AND status = 'ACTIVE'");
    query.run(status, symbol, direction);
    console.log(`[DB] Segnale ${symbol} ${direction} aggiornato a ${status}`);
  } catch (error) {
    console.error('[DB] Errore aggiornamento stato segnale:', error);
  }
}

export function getAllSignals(): TradeSignal[] {
  try {
    const query = db.prepare('SELECT * FROM trade_signals ORDER BY timestamp DESC LIMIT 100');
    const rows = query.all() as any[];
    return rows.map(row => ({
      symbol: row.symbol,
      direction: row.direction,
      entryPrice: row.entryPrice,
      targetPrice: row.targetPrice,
      stopLoss: row.stopLoss,
      leverage: row.leverage,
      orderType: row.orderType,
      reason: row.reason,
      timestamp: row.timestamp,
      timeframe: row.timeframe,
      validUntil: row.validUntil,
      createdAt: row.createdAt,
      expiresAt: row.expiresAt,
      status: row.status || 'ACTIVE'
    }));
  } catch (error) {
    console.error('[DB] Errore nel recupero di tutti i segnali:', error);
    return [];
  }
}

export function cleanupInvalidDates() {
  try {
    // Aggiorna date invalide con formato ISO corretto
    const currentTime = formatDateISO();
    
    db.prepare(`
      UPDATE trade_signals 
      SET createdAt = ?, expiresAt = ? 
      WHERE createdAt = 'invalid date' OR expiresAt = 'invalid date' OR createdAt IS NULL OR expiresAt IS NULL
    `).run(currentTime, currentTime);
    
    console.log('[DB] Date invalide pulite e standardizzate');
  } catch (error) {
    console.error('[DB] Errore pulizia date:', error);
  }
}

export function populateTestSignals() {
  try {
    // Cancella segnali vecchi
    db.prepare('DELETE FROM trade_signals').run();

    console.log(`[DB] Inizializzato`);
  } catch (error) {
    console.error('[DB] Errore nel popolare segnali di test:', error);
  }
}
