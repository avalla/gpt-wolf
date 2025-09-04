import * as dotenv from 'dotenv';
import { RestClientV5 } from 'bybit-api';
dotenv.config();
const API_KEY = process.env.BYBIT_API_KEY || '';
const API_SECRET = process.env.BYBIT_API_SECRET || '';
const USE_TESTNET = process.env.TESTNET === 'true';
// Se la variabile d'ambiente SYMBOLS è vuota o non definita verranno scansionati **tutti** i simboli derivati
const SYMBOLS = (process.env.SYMBOLS || '').split(',').filter(Boolean);
const MIN_VOLUME = parseInt(process.env.MIN_VOLUME || '1000000');
console.log(`🔑 Usando API Bybit in modalità ${USE_TESTNET ? 'TESTNET' : 'PRODUZIONE'}`);
const client = new RestClientV5({
    key: API_KEY,
    secret: API_SECRET,
    testnet: USE_TESTNET,
    recv_window: 5000,
    enable_time_sync: true,
    strict_param_validation: false,
});
export async function runMarketScan() {
    console.log('🔍 Iniziando scansione del mercato...');
    try {
        // 1. Ottieni tutti i contratti perpetui disponibili (linear + inverse)
        const perpetuals = await getPerpetualContracts();
        console.log(`📊 Trovati ${perpetuals.length} contratti perpetui`);
        // Filtra per i simboli configurati se forniti, altrimenti usa tutti
        let filteredSymbols = perpetuals;
        if (SYMBOLS.length > 0) {
            filteredSymbols = perpetuals.filter(symbol => SYMBOLS.includes(symbol));
            console.log(`🔍 Filtrati ${filteredSymbols.length} simboli da monitorare: ${filteredSymbols.join(', ')}`);
        }
        else {
            console.log(`🔍 Monitoreremo tutti i ${filteredSymbols.length} simboli derivati disponibili`);
        }
        // 2. Ottieni i ticker per tutti i simboli (linear + inverse)
        const tickers = await getTickersForSymbols(filteredSymbols);
        // 3. Ottieni i funding rate per tutti i simboli (linear + inverse)
        const fundingRates = await getFundingRatesForSymbols(filteredSymbols);
        // 4. Ottieni l'open interest per tutti i simboli (linear + inverse)
        const openInterest = await getOpenInterestForSymbols(filteredSymbols);
        // 5. Ottieni candele 1m per ogni simbolo (FETCH PARALLELO)
        const candlesEntries = await Promise.all(filteredSymbols.map(async (symbol) => [symbol, await getCandles1m(symbol, 5)]));
        const candlesMap = Object.fromEntries(candlesEntries);
        // 6. Combina tutti i dati
        const markets = filteredSymbols.map(symbol => {
            const ticker = tickers[symbol];
            const funding = fundingRates[symbol];
            const interest = openInterest[symbol];
            const candles = candlesMap[symbol] || [];
            let change1m, volume1m, avgVolume5m;
            if (candles.length >= 1) {
                change1m = ((candles[0].close - candles[0].open) / candles[0].open) * 100;
                volume1m = candles[0].volume;
            }
            if (candles.length >= 5) {
                avgVolume5m = candles.slice(0, 5).reduce((sum, c) => sum + c.volume, 0) / 5;
            }
            else if (candles.length > 0) {
                avgVolume5m = candles.reduce((sum, c) => sum + c.volume, 0) / candles.length;
            }
            if (!ticker)
                return null;
            return {
                symbol,
                price: parseFloat(ticker.lastPrice),
                volume24h: parseFloat(ticker.volume24h),
                change24h: parseFloat(ticker.price24hPcnt) * 100,
                fundingRate: funding ? parseFloat(funding.fundingRate) : 0,
                nextFundingTime: funding ? parseInt(funding.nextFundingTime) : 0,
                openInterest: interest ? parseFloat(interest.openInterest) : 0,
                change1m,
                volume1m,
                avgVolume5m,
                liquidations24h: ticker.liquidations24h
            };
        }).filter(Boolean);
        // 7. Filtra per volume minimo
        const highVolumeMarkets = markets.filter(m => m.volume24h >= MIN_VOLUME);
        console.log(`💰 ${highVolumeMarkets.length} mercati con volume > $${MIN_VOLUME.toLocaleString()}`);
        // 8. Trova mercati con funding rate estremi
        const extremeFundingMarkets = highVolumeMarkets.filter(m => Math.abs(m.fundingRate) >= 0.0005);
        console.log(`💸 ${extremeFundingMarkets.length} mercati con funding rate estremo (>=0.05%)`);
        // 9. Trova anomalie di volume
        const volumeAnomalies = detectVolumeAnomalies(highVolumeMarkets);
        console.log(`🚨 ${volumeAnomalies.length} anomalie di volume rilevate`);
        // 10. Mostra i risultati
        console.log('\n📈 TOP MERCATI PER VOLUME:');
        highVolumeMarkets
            .sort((a, b) => b.volume24h - a.volume24h)
            .slice(0, 10)
            .forEach((market, index) => {
            const changeIcon = market.change24h >= 0 ? '📈' : '📉';
            const fundingIcon = Math.abs(market.fundingRate) >= 0.0005 ? '💸' : '💰';
            console.log(`${index + 1}. ${market.symbol} ${changeIcon}`);
            console.log(`   💰 Prezzo: $${market.price.toFixed(4)}`);
            console.log(`   📊 Volume 24h: $${market.volume24h.toLocaleString()}`);
            console.log(`   📈 Cambio 24h: ${market.change24h.toFixed(2)}%`);
            console.log(`   ${fundingIcon} Funding Rate: ${(market.fundingRate * 100).toFixed(4)}%`);
            console.log(`   🔒 Open Interest: $${market.openInterest.toLocaleString()}`);
            console.log('');
        });
        if (extremeFundingMarkets.length > 0) {
            console.log('\n💸 MERCATI CON FUNDING RATE ESTREMO:');
            extremeFundingMarkets
                .sort((a, b) => Math.abs(b.fundingRate) - Math.abs(a.fundingRate))
                .forEach((market, index) => {
                const fundingPercentage = (market.fundingRate * 100).toFixed(4);
                const nextFunding = new Date(market.nextFundingTime).toLocaleString();
                console.log(`${index + 1}. ${market.symbol}`);
                console.log(`   💸 Funding Rate: ${fundingPercentage}%`);
                console.log(`   ⏰ Prossimo funding: ${nextFunding}`);
                console.log(`   💰 Volume 24h: $${market.volume24h.toLocaleString()}`);
                console.log('');
            });
        }
        if (volumeAnomalies.length > 0) {
            console.log('\n🚨 ANOMALIE DI VOLUME:');
            volumeAnomalies.forEach((market, index) => {
                console.log(`${index + 1}. ${market.symbol}`);
                console.log(`   📊 Volume 24h: $${market.volume24h.toLocaleString()}`);
                console.log(`   📈 Cambio 24h: ${market.change24h.toFixed(2)}%`);
                console.log('');
            });
        }
        return highVolumeMarkets;
    }
    catch (error) {
        console.error('❌ Errore durante la scansione del mercato:', error);
        throw error;
    }
}
// Recupera tutti i simboli derivati (linear + inverse)
async function getPerpetualContracts() {
    try {
        console.log('📡 Recupero contratti perpetui (linear + inverse)...');
        const categories = ['linear', 'inverse'];
        const allContracts = [];
        for (const category of categories) {
            const response = await client.getInstrumentsInfo({ category });
            if (response.retCode !== 0) {
                console.warn(`⚠️ Errore API (${category}): ${response.retMsg}`);
                continue;
            }
            const contracts = response.result.list
                .filter(item => item.contractType?.includes('Perpetual'))
                .map(item => item.symbol);
            allContracts.push(...contracts);
        }
        return [...new Set(allContracts)];
    }
    catch (error) {
        console.error('❌ Errore nel recupero dei contratti perpetui:', error);
        if (USE_TESTNET) {
            console.log('⚠️ Usando simboli di fallback per testnet');
            return ['BTCUSDT', 'ETHUSDT', 'SOLUSDT'];
        }
        return [];
    }
}
// Ottiene i ticker per i simboli specificati (linear + inverse)
async function getTickersForSymbols(symbols) {
    const categories = ['linear', 'inverse'];
    const tickers = {};
    for (const category of categories) {
        try {
            const response = await client.getTickers({ category });
            if (response.retCode !== 0)
                continue;
            response.result.list.forEach(ticker => {
                if (symbols.includes(ticker.symbol)) {
                    tickers[ticker.symbol] = ticker;
                }
            });
        }
        catch { }
    }
    return tickers;
}
// Ottiene i funding rate per i simboli specificati (linear + inverse)
async function getFundingRatesForSymbols(symbols) {
    const categories = ['linear', 'inverse'];
    const fundingRates = {};
    for (const category of categories) {
        for (const symbol of symbols) {
            try {
                const response = await client.getFundingRateHistory({ category, symbol, limit: 1 });
                if (response.retCode === 0 && response.result.list.length > 0) {
                    fundingRates[symbol] = response.result.list[0];
                }
            }
            catch { }
        }
    }
    return fundingRates;
}
// Ottiene l'open interest per i simboli specificati (linear + inverse)
async function getOpenInterestForSymbols(symbols) {
    const categories = ['linear', 'inverse'];
    const openInterest = {};
    for (const category of categories) {
        try {
            const response = await client.getOpenInterest({ category, intervalTime: '5min', limit: 1 });
            if (response.retCode !== 0)
                continue;
            response.result.list.forEach(item => {
                if (symbols.includes(item.symbol)) {
                    openInterest[item.symbol] = item;
                }
            });
        }
        catch { }
    }
    return openInterest;
}
// Utility per candele 1m
async function getCandles1m(symbol, limit = 5) {
    try {
        const response = await client.getKline({
            symbol,
            interval: '1', // 1m timeframe
            limit
        });
        if (response.retCode !== 0 || !response.result.list)
            return [];
        // Bybit restituisce candele in ordine decrescente (più recente prima)
        return response.result.list.map((c) => ({
            open: parseFloat(c.open),
            close: parseFloat(c.close),
            volume: parseFloat(c.volume)
        }));
    }
    catch (e) {
        return [];
    }
}
function detectVolumeAnomalies(markets) {
    if (markets.length === 0)
        return [];
    const volumes = markets.map(m => m.volume24h);
    const avgVolume = volumes.reduce((sum, vol) => sum + vol, 0) / volumes.length;
    const stdDev = Math.sqrt(volumes.reduce((sum, vol) => sum + Math.pow(vol - avgVolume, 2), 0) / volumes.length);
    const threshold = avgVolume + (2 * stdDev);
    return markets.filter(m => m.volume24h > threshold);
}
if (require.main === module) {
    const SCAN_INTERVAL = 5 * 60 * 1000;
    function updateCountdown(nextScanTime) {
        const now = Date.now();
        const remainingMs = nextScanTime - now;
        if (remainingMs <= 0)
            return;
        const minutes = Math.floor(remainingMs / 60000);
        const seconds = Math.floor((remainingMs % 60000) / 1000);
        process.stdout.write(`\r⏱️ Prossima scansione tra: ${minutes}m ${seconds}s     `);
    }
    (async () => {
        try {
            await runMarketScan();
            console.log("\n✅ Scansione completata con successo");
        }
        catch (error) {
            console.error(error);
        }
    })();
    let nextScanTime = Date.now() + SCAN_INTERVAL;
    const countdownInterval = setInterval(() => {
        updateCountdown(nextScanTime);
    }, 1000);
    const scanInterval = setInterval(async () => {
        console.log("\n\n--- Nuova scansione ---");
        nextScanTime = Date.now() + SCAN_INTERVAL;
        try {
            await runMarketScan();
            console.log("\n✅ Scansione completata con successo");
        }
        catch (error) {
            console.error(error);
        }
    }, SCAN_INTERVAL);
    console.log(`\n⏱️ Scanner avviato in modalità continua, scansione ogni ${SCAN_INTERVAL / 60000} minuti`);
    process.on('SIGINT', () => {
        clearInterval(countdownInterval);
        clearInterval(scanInterval);
        console.log("\n\n🛑 Scanner terminato dall'utente");
        process.exit(0);
    });
}
