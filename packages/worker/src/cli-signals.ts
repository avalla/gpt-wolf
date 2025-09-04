import { getActiveTradeSignals } from '@gpt-wolf/db';

(async () => {
  const signals = await getActiveTradeSignals();
  if (!signals.length) {
    console.log('Nessun segnale attivo trovato.');
    process.exit(0);
  }
  console.log(`\n=== SEGNALI ATTIVI (${signals.length}) ===`);
  for (const s of signals) {
    console.log(`- [${s.symbol}] ${s.direction} | Entry: ${s.entryPrice} | TP: ${s.targetPrice} | SL: ${s.stopLoss} | Leva: ${s.leverage} | Stato: ${s.status || 'PENDING'} | ${s.reason}`);
  }
  console.log('===============================\n');
  process.exit(0);
})();
