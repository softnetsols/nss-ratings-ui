import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../environment';

@Injectable({ providedIn: 'root' })
export class FinnhubService {
    private finnhubProxyBase = `${environment.NETLIFY_FUNCTION_BASE}/finnhub-proxy`;
    private fmpProxyBase = `${environment.NETLIFY_FUNCTION_BASE}/fmp-proxy`;

    constructor(private http: HttpClient) { }

    getRecommendation(symbol: string) {
        console.log('Fetching recommendation for symbol:', symbol);
        return this.http.get<any>(
            `${this.finnhubProxyBase}?path=stock/recommendation&symbol=${encodeURIComponent(symbol)}`
        );
    }

    getUpgradesDowngrades() {
        return this.http.get<any>(
            `${this.fmpProxyBase}?path=stable/grades-latest-news&page=0&limit=10`
        );
    }

    getMostActive() {
        return this.http.get<any>(
            `${this.fmpProxyBase}?path=stable/most-actives`
        );
    }
}
