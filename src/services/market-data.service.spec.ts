import { TestBed } from '@angular/core/testing';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { MarketDataService, MarketQuote } from './market-data.service';
import { environment } from '../environment';

describe('MarketDataService', () => {
  let service: MarketDataService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [MarketDataService]
    });
    service = TestBed.inject(MarketDataService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('2. should deduplicate and uppercase symbols', () => {
    service.getBatchQuotes(['aapl', 'AAPL', 'tsla']).subscribe(res => {
      expect(res.has('AAPL')).toBe(true);
      expect(res.has('TSLA')).toBe(true);
      expect(res.size).toBe(2);
    });

    const req = httpMock.expectOne(r => r.url.includes('fmp-proxy') && r.url.includes('AAPL%2CTSLA'));
    expect(req.request.method).toBe('GET');
    req.flush([
      { symbol: 'AAPL', price: 150 },
      { symbol: 'TSLA', price: 200 }
    ]);
  });

  it('3. should exclude STDEMO by default', () => {
    service.getBatchQuotes(['AAPL', 'STDEMO']).subscribe(res => {
      expect(res.has('AAPL')).toBe(true);
      expect(res.has('STDEMO')).toBe(false);
      expect(res.size).toBe(1);
    });

    const req = httpMock.expectOne(r => r.url.includes('symbols=AAPL'));
    req.flush([{ symbol: 'AAPL', price: 150 }]);
  });

  it('should include STDEMO when includeTest is true', () => {
    service.getBatchQuotes(['AAPL', 'STDEMO'], true).subscribe(res => {
      expect(res.has('AAPL')).toBe(true);
      expect(res.has('STDEMO')).toBe(true);
      expect(res.size).toBe(2);
    });

    const req = httpMock.expectOne(r => r.url.includes('symbols=AAPL%2CSTDEMO'));
    req.flush([
      { symbol: 'AAPL', price: 150 },
      { symbol: 'STDEMO', price: 1 }
    ]);
  });

  it('5. should handle one unavailable symbol without failing others', () => {
    service.getBatchQuotes(['AAPL', 'INVALID']).subscribe(res => {
      expect(res.get('AAPL')?.status).toBe('LIVE');
      expect(res.get('AAPL')?.price).toBe(150);
      expect(res.get('INVALID')?.status).toBe('UNAVAILABLE');
      expect(res.get('INVALID')?.price).toBe(0);
    });

    const req = httpMock.expectOne(r => r.url.includes('symbols=AAPL%2CINVALID'));
    req.flush([{ symbol: 'AAPL', price: 150 }]); // FMP only returns AAPL
  });

  it('4. should preserve last valid quote when a request fails or is unavailable', () => {
    // 1. Initial successful quote
    service.getBatchQuotes(['AAPL']).subscribe();
    let req = httpMock.expectOne(r => r.url.includes('symbols=AAPL'));
    req.flush([{ symbol: 'AAPL', price: 150 }]);

    // 2. Next request fails (mocking HTTP error)
    service.getBatchQuotes(['AAPL']).subscribe(res => {
      const q = res.get('AAPL');
      expect(q).toBeTruthy();
      expect(q?.status).toBe('LIVE'); // preserves status (under 120s)
      expect(q?.price).toBe(150); // preserves last valid price
    });
    req = httpMock.expectOne(r => r.url.includes('symbols=AAPL'));
    req.error(new ErrorEvent('Network error'));
  });

  it('6. should mark cached quote STALE after 120 seconds', () => {
    const baseTime = Date.now();
    spyOn(Date, 'now').and.callFake(() => baseTime);

    // Initial load
    service.getBatchQuotes(['AAPL']).subscribe();
    let req = httpMock.expectOne(r => r.url.includes('symbols=AAPL'));
    req.flush([{ symbol: 'AAPL', price: 150 }]);

    // Move clock 130s forward
    (Date.now as jasmine.Spy).and.callFake(() => baseTime + 130000);

    // Request failed
    service.getBatchQuotes(['AAPL']).subscribe(res => {
      const q = res.get('AAPL');
      expect(q).toBeTruthy();
      expect(q?.status).toBe('STALE');
      expect(q?.price).toBe(150);
    });

    req = httpMock.expectOne(r => r.url.includes('symbols=AAPL'));
    req.error(new ErrorEvent('Network error'));
  });
});
