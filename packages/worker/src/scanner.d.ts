interface MarketSummary {
    symbol: string;
    price: number;
    volume24h: number;
    change24h: number;
    fundingRate: number;
    nextFundingTime: number;
    openInterest: number;
    change1m?: number;
    volume1m?: number;
    avgVolume5m?: number;
    liquidations24h?: {
        buyQty: number;
        sellQty: number;
        total: number;
    };
}
export declare function runMarketScan(): Promise<MarketSummary[]>;
export {};
