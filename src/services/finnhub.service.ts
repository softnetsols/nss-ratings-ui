import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../environment';

@Injectable({ providedIn: 'root' })
export class FinnhubService {
    private baseUrl = 'https://finnhub.io/api/v1';

    constructor(private http: HttpClient) { }

    getRecommendation(symbol: string) {
        console.log('Fetching recommendation for symbol:', symbol);
        return this.http.get<any>(`${this.baseUrl}/stock/recommendation?symbol=${symbol}&token=${environment.finnhubApiKey}`);
    }

    getUpgradesDowngrades() {
        return this.http.get<any>(
            // `${this.baseUrl}/upgrades-downgrades?symbol=${symbol}&apikey=${environment.finnhubApiKey}`
            `https://financialmodelingprep.com/stable/grades-latest-news?page=0&limit=10&apikey=rHlW97iBhI0rVjKsoKS5pYLxyVaPQ5UB`
        );
    }

    getMostActive() {
        return this.http.get<any>(
            `https://financialmodelingprep.com/stable/most-actives?apikey=rHlW97iBhI0rVjKsoKS5pYLxyVaPQ5UB`
        );
    }
}
