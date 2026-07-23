import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, forkJoin, of } from 'rxjs';
import { map, catchError } from 'rxjs/operators';
import { environment } from '../environment';

export interface MarketQuote {
  symbol: string;
  price: number;
  volume?: number;
  timestamp?: number;
  provider: 'FMP';
  status: 'LIVE' | 'STALE' | 'UNAVAILABLE' | 'ERROR';
}

@Injectable({
  providedIn: 'root'
})
export class MarketDataService {
  private cache = new Map<string, MarketQuote>();

  constructor(private http: HttpClient) {}

  getBatchQuotes(symbols: string[], includeTest = false): Observable<Map<string, MarketQuote>> {
    let processed = symbols
      .map(s => s.trim().toUpperCase())
      .filter(Boolean);

    processed = Array.from(new Set(processed));

    if (!includeTest) {
      processed = processed.filter(s => s !== 'STDEMO');
    }

    if (processed.length === 0) {
      return of(new Map<string, MarketQuote>());
    }

    const chunks = this.chunkArray(processed, 20);
    const requests = chunks.map(chunkSymbols => {
      const symbolsStr = chunkSymbols.join(',');
      const url = `${environment.NETLIFY_FUNCTION_BASE}/fmp-proxy?path=stable/batch-quote-short&symbols=${encodeURIComponent(symbolsStr)}`;
      
      return this.http.get<any[]>(url).pipe(
        map(res => {
          const resultsMap = new Map<string, any>();
          if (Array.isArray(res)) {
            for (const item of res) {
              if (item && item.symbol) {
                resultsMap.set(item.symbol.toUpperCase(), item);
              }
            }
          }
          return { chunkSymbols, results: resultsMap, error: false };
        }),
        catchError(err => {
          console.warn('[MarketDataService] Chunk fetch failed:', chunkSymbols, err);
          return of({ chunkSymbols, results: new Map<string, any>(), error: true });
        })
      );
    });

    return forkJoin(requests).pipe(
      map(chunkResults => {
        const now = Date.now();
        const outputMap = new Map<string, MarketQuote>();

        for (const { chunkSymbols, results, error } of chunkResults) {
          for (const sym of chunkSymbols) {
            const cached = this.cache.get(sym);
            if (error) {
              if (cached) {
                const age = now - (cached.timestamp || 0);
                if (age > 120000) {
                  cached.status = 'STALE';
                }
                outputMap.set(sym, cached);
              } else {
                const errQuote: MarketQuote = {
                  symbol: sym,
                  price: 0,
                  provider: 'FMP',
                  status: 'ERROR',
                  timestamp: now
                };
                outputMap.set(sym, errQuote);
              }
            } else {
              const item = results.get(sym);
              if (item && typeof item.price === 'number' && isFinite(item.price) && item.price > 0) {
                const quote: MarketQuote = {
                  symbol: sym,
                  price: item.price,
                  volume: typeof item.volume === 'number' ? item.volume : undefined,
                  timestamp: now,
                  provider: 'FMP',
                  status: 'LIVE'
                };
                this.cache.set(sym, quote);
                outputMap.set(sym, quote);
              } else {
                if (cached) {
                  const age = now - (cached.timestamp || 0);
                  if (age > 120000) {
                    cached.status = 'STALE';
                  }
                  outputMap.set(sym, cached);
                } else {
                  const unavailQuote: MarketQuote = {
                    symbol: sym,
                    price: 0,
                    provider: 'FMP',
                    status: 'UNAVAILABLE',
                    timestamp: now
                  };
                  outputMap.set(sym, unavailQuote);
                }
              }
            }
          }
        }
        return outputMap;
      })
    );
  }

  private chunkArray<T>(arr: T[], size: number): T[][] {
    const results: T[][] = [];
    for (let i = 0; i < arr.length; i += size) {
      results.push(arr.slice(i, i + size));
    }
    return results;
  }
}
