#!/usr/bin/env bun
import { runMarketScan } from './scanner.js';

// Esegui la scansione dei mercati
console.log("🐺 GPT-Wolf Market Scanner");
console.log("==========================");

runMarketScan()
  .then(() => {
    console.log("\n✅ Scansione completata");
  })
  .catch(err => {
    console.error("❌ Errore:", err);
    process.exit(1);
  });
