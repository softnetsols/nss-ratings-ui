import { Component, OnInit, OnDestroy, ChangeDetectorRef } from '@angular/core';
import { CommonModule, DecimalPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { Subject, takeUntil } from 'rxjs';
import { SupabaseService } from '../../services/supabase.service';

@Component({
  selector: 'app-custom-group',
  standalone: true,
  imports: [
    CommonModule,
    MatProgressSpinnerModule,
    DecimalPipe,
    FormsModule
  ],
  template: `
    <div class="screener-container">
      <div class="screener-header">
        <h2>Custom List Screener</h2>
        <div style="display: flex; align-items: center; gap: 8px;">
          <button class="manual-refresh-btn" (click)="fetchData(true)" [disabled]="loading">
            🔄 {{ loading ? 'Refreshing...' : 'Refresh' }}
          </button>
          <span class="refresh-indicator" [class.syncing]="loading">
            {{ loading ? 'Updating...' : 'Ready' }}
          </span>
        </div>
      </div>

      <!-- Advanced Filter Panel (Compact inline) -->
      <div class="filter-panel">
        <div class="search-box">
          <input type="text" [(ngModel)]="searchQuery" (ngModelChange)="applyFilters()" placeholder="Search symbols..." class="search-input" />
        </div>
        <div class="filters-row">
          <div class="filter-group">
            <span class="group-label">Quality:</span>
            <label class="checkbox-label">
              <input type="checkbox" [(ngModel)]="filterQualityA" (change)="applyFilters()" /> A Grade
            </label>
            <label class="checkbox-label">
              <input type="checkbox" [(ngModel)]="filterQualityB" (change)="applyFilters()" /> B Grade
            </label>
            <label class="checkbox-label">
              <input type="checkbox" [(ngModel)]="filterQualityC" (change)="applyFilters()" /> C Grade
            </label>
          </div>
          <div class="filter-group toggles">
            <label class="checkbox-label toggle-label">
              <input type="checkbox" [(ngModel)]="showDuplicates" (change)="applyFilters()" /> Duplicates
            </label>
            <label class="checkbox-label toggle-label">
              <input type="checkbox" [(ngModel)]="showRejected" (change)="applyFilters()" /> Rejects
            </label>
            <label class="checkbox-label toggle-label">
              <input type="checkbox" [(ngModel)]="showStale" (change)="applyFilters()" /> Stale/Expired
            </label>
          </div>
        </div>
      </div>

      <div *ngIf="loading && allSetups.length === 0" class="spinner-container">
        <mat-spinner diameter="35"></mat-spinner>
        <p>Loading active setups...</p>
      </div>

      <div *ngIf="!loading && allSetups.length === 0" class="no-data">
        No active setups found. Make sure your TradingView Custom List alerts are active.
      </div>

      <!-- Side-by-Side Compact Tables -->
      <div *ngIf="allSetups.length > 0" class="tables-grid">
        
        <!-- Bullish Table -->
        <div class="table-wrapper bullish-wrapper">
          <div class="table-title bullish-title">
            🟢 BULLISH SETUPS ({{ filteredBullish.length }} of {{ totalBullish }})
          </div>
          <div class="table-scroll">
            <table class="screener-table">
              <thead>
                <tr>
                  <th>Symbol</th>
                  <th>Mode</th>
                  <th>Score</th>
                  <th>Trigger</th>
                  <th>Current</th>
                  <th>Move %</th>
                  <th>Age</th>
                  <th>Status</th>
                  <th>Reasons</th>
                  <th style="text-align: center;">Links</th>
                </tr>
              </thead>
              <tbody>
                <tr *ngFor="let s of filteredBullish" [class.stale-row]="s.status === 'stale' || s.status === 'expired'">
                  <td class="sym-cell">
                    <a [href]="'https://www.tradingview.com/chart/?symbol=' + s.symbol" target="_blank" class="symbol-link">{{ s.symbol }}</a>
                  </td>
                  <td>
                    <span class="mode-tag" [class.ew]="s.signal_mode === 'early_warning'">
                      {{ s.signal_mode === 'early_warning' ? 'EW' : 'Conf' }}
                    </span>
                  </td>
                  <td>
                    <span class="grade-text" [class]="'quality-' + s.signal_quality.toLowerCase()">
                      {{ s.signal_score }} ({{ s.signal_quality }})
                    </span>
                  </td>
                  <td class="price-col">\${{ s.trigger_price | number: '1.2-2' }}</td>
                  <td class="price-col">\${{ s.current_price | number: '1.2-2' }}</td>
                  <td class="pct-col" [class.positive]="getMovePct(s) >= 0" [class.negative]="getMovePct(s) < 0">
                    {{ getMovePct(s) | number: '1.2-2' }}%
                  </td>
                  <td>{{ getSignalAge(s) }}m</td>
                  <td>
                    <span class="status-lbl" [class]="s.status">{{ s.status | uppercase }}</span>
                  </td>
                  <td class="reasons-cell" [title]="s.score_reasons?.join(', ') || ''">
                    {{ s.score_reasons?.join(', ') || '-' }}
                  </td>
                  <td class="actions-cell">
                    <a [href]="'https://www.tradingview.com/chart/?symbol=' + s.symbol" target="_blank" class="mini-btn tv" title="TradingView">TV</a>
                    <a [href]="'https://finviz.com/quote.ashx?t=' + s.symbol" target="_blank" class="mini-btn fz" title="Finviz">FZ</a>
                  </td>
                </tr>
                <tr *ngIf="filteredBullish.length === 0">
                  <td colspan="10" class="empty-row">No bullish setups match active filters.</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <!-- Bearish Table -->
        <div class="table-wrapper bearish-wrapper">
          <div class="table-title bearish-title">
            🔴 BEARISH SETUPS ({{ filteredBearish.length }} of {{ totalBearish }})
          </div>
          <div class="table-scroll">
            <table class="screener-table">
              <thead>
                <tr>
                  <th>Symbol</th>
                  <th>Mode</th>
                  <th>Score</th>
                  <th>Trigger</th>
                  <th>Current</th>
                  <th>Move %</th>
                  <th>Age</th>
                  <th>Status</th>
                  <th>Reasons</th>
                  <th style="text-align: center;">Links</th>
                </tr>
              </thead>
              <tbody>
                <tr *ngFor="let s of filteredBearish" [class.stale-row]="s.status === 'stale' || s.status === 'expired'">
                  <td class="sym-cell">
                    <a [href]="'https://www.tradingview.com/chart/?symbol=' + s.symbol" target="_blank" class="symbol-link">{{ s.symbol }}</a>
                  </td>
                  <td>
                    <span class="mode-tag" [class.ew]="s.signal_mode === 'early_warning'">
                      {{ s.signal_mode === 'early_warning' ? 'EW' : 'Conf' }}
                    </span>
                  </td>
                  <td>
                    <span class="grade-text" [class]="'quality-' + s.signal_quality.toLowerCase()">
                      {{ s.signal_score }} ({{ s.signal_quality }})
                    </span>
                  </td>
                  <td class="price-col">\${{ s.trigger_price | number: '1.2-2' }}</td>
                  <td class="price-col">\${{ s.current_price | number: '1.2-2' }}</td>
                  <td class="pct-col" [class.positive]="getMovePct(s) >= 0" [class.negative]="getMovePct(s) < 0">
                    {{ getMovePct(s) | number: '1.2-2' }}%
                  </td>
                  <td>{{ getSignalAge(s) }}m</td>
                  <td>
                    <span class="status-lbl" [class]="s.status">{{ s.status | uppercase }}</span>
                  </td>
                  <td class="reasons-cell" [title]="s.score_reasons?.join(', ') || ''">
                    {{ s.score_reasons?.join(', ') || '-' }}
                  </td>
                  <td class="actions-cell">
                    <a [href]="'https://www.tradingview.com/chart/?symbol=' + s.symbol" target="_blank" class="mini-btn tv" title="TradingView">TV</a>
                    <a [href]="'https://finviz.com/quote.ashx?t=' + s.symbol" target="_blank" class="mini-btn fz" title="Finviz">FZ</a>
                  </td>
                </tr>
                <tr *ngIf="filteredBearish.length === 0">
                  <td colspan="10" class="empty-row">No bearish setups match active filters.</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

      </div>
    </div>
  `,
  styles: [`
    .screener-container {
      padding: 12px 18px;
      color: #fff;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
    }
    .screener-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 12px;
    }
    h2 {
      margin: 0;
      font-size: 1.25rem;
      font-weight: 500;
      color: #fff;
    }
    .manual-refresh-btn {
      background: #2a2e39;
      color: #fff;
      border: 1px solid #363c4e;
      padding: 3px 8px;
      border-radius: 4px;
      cursor: pointer;
      font-size: 0.75rem;
    }
    .manual-refresh-btn:hover {
      background: #363c4e;
    }
    .refresh-indicator {
      font-size: 0.75rem;
      color: #888;
      background: #1e222d;
      padding: 3px 8px;
      border-radius: 4px;
      border: 1px solid #2a2e39;
    }
    .refresh-indicator.syncing {
      color: #00ff88;
      border-color: #00ff88;
    }
    
    /* Compact Filter Panel */
    .filter-panel {
      background: #1c2030;
      border-radius: 6px;
      border: 1px solid #2a2e39;
      padding: 10px 14px;
      margin-bottom: 16px;
      display: flex;
      flex-direction: column;
      gap: 8px;
    }
    .search-box {
      width: 100%;
    }
    .search-input {
      width: 100%;
      background: #131722;
      border: 1px solid #2a2e39;
      border-radius: 4px;
      padding: 6px 10px;
      color: #fff;
      font-size: 0.85rem;
      box-sizing: border-box;
    }
    .search-input:focus {
      outline: none;
      border-color: #2962ff;
    }
    .filters-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      flex-wrap: wrap;
      gap: 12px;
    }
    .filter-group {
      display: flex;
      align-items: center;
      gap: 12px;
    }
    .group-label {
      color: #888;
      font-size: 0.8rem;
      font-weight: 500;
    }
    .checkbox-label {
      font-size: 0.8rem;
      color: #ddd;
      cursor: pointer;
      display: flex;
      align-items: center;
      gap: 4px;
    }
    .toggles .checkbox-label {
      background: #131722;
      padding: 2px 6px;
      border-radius: 4px;
      border: 1px solid #2a2e39;
    }

    .spinner-container {
      display: flex;
      flex-direction: column;
      align-items: center;
      padding: 30px 0;
      color: #888;
    }
    .spinner-container p {
      margin-top: 8px;
      font-size: 0.85rem;
    }
    .no-data {
      padding: 30px;
      text-align: center;
      background: #1c2030;
      border-radius: 6px;
      color: #888;
      border: 1px solid #2a2e39;
      font-size: 0.85rem;
    }

    /* Side-by-Side Tables Layout */
    .tables-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 16px;
    }
    .table-wrapper {
      background: #131722;
      border-radius: 6px;
      border: 1px solid #2a2e39;
      overflow: hidden;
    }
    .table-title {
      padding: 8px 12px;
      font-weight: bold;
      font-size: 0.85rem;
      border-bottom: 1px solid #2a2e39;
    }
    .bullish-title {
      background: rgba(13, 44, 29, 0.4);
      color: #00ff88;
    }
    .bearish-title {
      background: rgba(59, 18, 18, 0.4);
      color: #ff4a4a;
    }
    .table-scroll {
      overflow-x: auto;
    }

    /* Compact Dark Table styling */
    .screener-table {
      width: 100%;
      border-collapse: collapse;
      font-size: 0.75rem;
      text-align: left;
    }
    .screener-table th {
      background: #1c2030;
      color: #888;
      font-weight: 500;
      padding: 6px 8px;
      border-bottom: 1px solid #2a2e39;
      white-space: nowrap;
      text-transform: uppercase;
      font-size: 0.7rem;
    }
    .screener-table td {
      padding: 6px 8px;
      border-bottom: 1px solid #1e222d;
      white-space: nowrap;
      vertical-align: middle;
    }
    .screener-table tr:hover {
      background: rgba(255, 255, 255, 0.02);
    }
    .stale-row {
      opacity: 0.55;
    }
    .empty-row {
      text-align: center;
      color: #666;
      padding: 16px !important;
      font-style: italic;
    }

    /* Cell Components */
    .sym-cell {
      font-weight: bold;
    }
    .symbol-link {
      color: #fff;
      text-decoration: none;
    }
    .symbol-link:hover {
      color: #2962ff;
      text-decoration: underline;
    }
    
    .mode-tag {
      font-size: 0.6rem;
      font-weight: bold;
      background: #2962ff;
      color: #fff;
      padding: 1px 4px;
      border-radius: 3px;
    }
    .mode-tag.ew {
      background: #e65100;
    }

    .grade-text {
      font-weight: bold;
    }
    .quality-a {
      color: #00ff88;
    }
    .quality-b {
      color: #29b6f6;
    }
    .quality-c {
      color: #ffca28;
    }
    .quality-reject {
      color: #ff4a4a;
    }

    .price-col {
      font-family: monospace;
      color: #ddd;
    }
    .pct-col {
      font-family: monospace;
      font-weight: bold;
    }
    .pct-col.positive {
      color: #00ff88;
    }
    .pct-col.negative {
      color: #ff4a4a;
    }

    .status-lbl {
      font-size: 0.6rem;
      font-weight: bold;
      padding: 1px 4px;
      border-radius: 3px;
      background: #2a2e39;
      color: #ccc;
    }
    .status-lbl.fresh {
      color: #00ff88;
      background: rgba(13, 44, 29, 0.3);
    }
    .status-lbl.watch {
      color: #29b6f6;
      background: rgba(41, 182, 246, 0.1);
    }
    .status-lbl.stale {
      color: #aaa;
    }
    .status-lbl.expired {
      color: #666;
    }
    .status-lbl.conflict {
      color: #ff4a4a;
      background: rgba(255, 74, 74, 0.15);
    }

    .reasons-cell {
      max-width: 150px;
      overflow: hidden;
      text-overflow: ellipsis;
      color: #888;
      font-size: 0.7rem;
    }

    .actions-cell {
      display: flex;
      gap: 4px;
      justify-content: center;
    }
    .mini-btn {
      font-size: 0.6rem;
      font-weight: 500;
      color: #fff;
      text-decoration: none;
      padding: 2px 4px;
      border-radius: 3px;
      transition: opacity 0.2s ease;
    }
    .mini-btn:hover {
      opacity: 0.8;
    }
    .mini-btn.tv {
      background: #2962ff;
    }
    .mini-btn.fz {
      background: #388e3c;
    }

    @media (max-width: 1024px) {
      .tables-grid {
        grid-template-columns: 1fr;
        gap: 12px;
      }
    }
  `]
})
export class CustomGroup implements OnInit, OnDestroy {
  allSetups: any[] = [];
  filteredBullish: any[] = [];
  filteredBearish: any[] = [];
  totalBullish = 0;
  totalBearish = 0;
  loading = true;

  // Filters
  searchQuery = '';
  filterQualityA = true;
  filterQualityB = true;
  filterQualityC = false;
  showDuplicates = false;
  showRejected = false;
  showStale = false;

  private destroy$ = new Subject<void>();
  private pollInterval: any;

  constructor(
    private supabaseService: SupabaseService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.fetchData();
  }

  fetchData(showSpinner = true): void {
    if (showSpinner) {
      this.loading = true;
    }
    this.supabaseService.getScreenerSetups()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (data) => {
          this.allSetups = data.filter(s => s.group_name.startsWith('Custom'));
          
          this.applyFilters();
          this.loading = false;
          this.cdr.detectChanges();
        },
        error: (err) => {
          console.error('Error loading Custom setups:', err);
          this.loading = false;
          this.cdr.detectChanges();
        }
      });
  }

  applyFilters(): void {
    let filtered = this.allSetups;

    // Search filter
    if (this.searchQuery) {
      const q = this.searchQuery.toLowerCase().trim();
      filtered = filtered.filter(s => s.symbol.toLowerCase().includes(q));
    }

    // Quality filter
    filtered = filtered.filter(s => {
      if (s.signal_quality === 'A' && !this.filterQualityA) return false;
      if (s.signal_quality === 'B' && !this.filterQualityB) return false;
      if (s.signal_quality === 'C' && !this.filterQualityC) return false;
      if (s.signal_quality === 'Reject' && !this.showRejected) return false;
      return true;
    });

    // Duplicates filter
    if (!this.showDuplicates) {
      filtered = filtered.filter(s => s.status !== 'duplicate');
    }

    // Rejected status filter
    if (!this.showRejected) {
      filtered = filtered.filter(s => s.status !== 'rejected');
    }

    // Stale/Expired status filter
    if (!this.showStale) {
      filtered = filtered.filter(s => s.status !== 'stale' && s.status !== 'expired');
    }

    // Sort by signal_score descending
    filtered.sort((a, b) => (b.signal_score || 0) - (a.signal_score || 0));

    // Distribute into Bullish / Bearish
    const bullishList = filtered.filter(s => s.direction === 'bullish');
    const bearishList = filtered.filter(s => s.direction === 'bearish');

    this.totalBullish = bullishList.length;
    this.totalBearish = bearishList.length;

    // Limit to top 20 rows each
    this.filteredBullish = bullishList.slice(0, 20);
    this.filteredBearish = bearishList.slice(0, 20);
  }

  getMovePct(card: any): number {
    const trigger = Number(card.trigger_price) || Number(card.price) || 1.0;
    const current = Number(card.current_price) || Number(card.price) || 0.0;
    if (card.direction === 'bullish') {
      return ((current - trigger) / trigger) * 100;
    } else {
      return ((trigger - current) / trigger) * 100;
    }
  }

  getSignalAge(card: any): number {
    const timeVal = card.signal_bar_time ? new Date(card.signal_bar_time).getTime() : new Date().getTime();
    const ageMins = Math.round((Date.now() - timeVal) / 60000);
    return ageMins >= 0 ? ageMins : 0;
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
    if (this.pollInterval) {
      clearInterval(this.pollInterval);
    }
  }
}
