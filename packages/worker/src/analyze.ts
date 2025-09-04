#!/usr/bin/env bun
import * as dotenv from 'dotenv';
import { performQuickScan } from './market-scanner';

// Carica variabili d'ambiente
dotenv.config();

/**
 * Script per eseguire analisi di mercato on-demand
 */
async function main() {
  try {
    console.log('🐺 GPT-Wolf Market Analyzer');
    console.log('============================\n');
    
    // Esegui scansione e analisi
    const analysis = await performQuickScan();
    
    // Salva risultati (opzionale)
    if (process.env.SAVE_ANALYSIS === 'true') {
      const fs = require('fs');
      const filename = `analysis_${Date.now()}.json`;
      fs.writeFileSync(filename, JSON.stringify(analysis, null, 2));
      console.log(`\n💾 Analisi salvata in: ${filename}`);
    }
    
    console.log('\n✅ Analisi completata!');
    
  } catch (error) {
    console.error('❌ Errore durante l\'analisi:', error);
    process.exit(1);
  }
}

// Esegui solo se chiamato direttamente
if (process.argv[1] === import.meta.url.replace('file://', '')) {
  main();
}
