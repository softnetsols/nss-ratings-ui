import { Component, OnInit, OnDestroy, ChangeDetectorRef } from '@angular/core';
import { CommonModule, DecimalPipe, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { Subject, takeUntil } from 'rxjs';
import { SupabaseService } from '../../services/supabase.service';

@Component({
  selector: 'app-alphatrend',
  standalone: true,
  imports: [
    CommonModule,
    MatProgressSpinnerModule,
    DecimalPipe,
    DatePipe,
    FormsModule
  ],
  template: `
    <div class="screener-container">
      <div class="screener-header">
        <h2>AlphaTrend Pullback Reversal</h2>
        <span class="refresh-indicator" [class.syncing]="loading">
          {{ loading ? 'Updating...' : 'Auto-refreshing in 15s' }}
        </span>
      </div>

      <!-- Advanced Filter Panel (Matte Compact style) -->
      <div class="filter-panel">
        <div class="search-box">
          <input type="text" [(ngModel)]="searchQuery" (ngModelChange)="applyFilters()" placeholder="Search symbols, grades, reasons..." class="search-input" />
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
        No active setups found. Make sure your TradingView AlphaTrend alerts are active.
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
                  <th (click)="toggleSort('symbol')" class="sortable-th">Symbol <span *ngIf="sortKey === 'symbol'">{{ sortAsc ? '▲' : '▼' }}</span></th>
                  <th (click)="toggleSort('signal_mode')" class="sortable-th" style="text-align: center;">M <span *ngIf="sortKey === 'signal_mode'">{{ sortAsc ? '▲' : '▼' }}</span></th>
                  <th (click)="toggleSort('signal_score')" class="sortable-th">Score <span *ngIf="sortKey === 'signal_score'">{{ sortAsc ? '▲' : '▼' }}</span></th>
                  <th (click)="toggleSort('trigger_price')" class="sortable-th">Trigger <span *ngIf="sortKey === 'trigger_price'">{{ sortAsc ? '▲' : '▼' }}</span></th>
                  <th (click)="toggleSort('current_price')" class="sortable-th">Current <span *ngIf="sortKey === 'current_price'">{{ sortAsc ? '▲' : '▼' }}</span></th>
                  <th (click)="toggleSort('move_pct')" class="sortable-th">Move % <span *ngIf="sortKey === 'move_pct'">{{ sortAsc ? '▲' : '▼' }}</span></th>
                  <th (click)="toggleSort('signal_bar_time')" class="sortable-th">Time <span *ngIf="sortKey === 'signal_bar_time'">{{ sortAsc ? '▲' : '▼' }}</span></th>
                  <th (click)="toggleSort('status')" class="sortable-th" style="text-align: center;">St <span *ngIf="sortKey === 'status'">{{ sortAsc ? '▲' : '▼' }}</span></th>
                  <th>Reasons</th>
                  <th style="text-align: center;">Links</th>
                </tr>
              </thead>
              <tbody>
                <tr *ngFor="let s of filteredBullish" [class.stale-row]="s.status === 'stale' || s.status === 'expired' || s.status === 'duplicate'">
                  <td class="sym-cell">
                    <a [href]="'https://www.tradingview.com/chart/?symbol=' + s.symbol" target="_blank" class="symbol-link">{{ s.symbol }}</a>
                  </td>
                  <td style="text-align: center;">
                    <span class="mode-tag" [class.ew]="s.signal_mode === 'early_warning'" [title]="s.signal_mode === 'early_warning' ? 'Early Warning' : 'Confirmed'">
                      {{ s.signal_mode === 'early_warning' ? 'E' : 'C' }}
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
                  <td class="time-col">{{ s.signal_bar_time | date: 'MM/dd hh:mm a' }}</td>
                  <td style="text-align: center;">
                    <span class="status-lbl" [class]="s.status" [title]="s.status | uppercase">{{ getStatusShortCode(s.status) }}</span>
                  </td>
                  <td class="reasons-cell">
                    <div class="reasons-list">
                      <span *ngFor="let r of s.score_reasons" class="reason-pill" [class.penalty-pill]="isPenalty(r)">
                        {{ r }}
                      </span>
                      <span *ngIf="!s.score_reasons || s.score_reasons.length === 0" class="no-reasons">-</span>
                    </div>
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
                  <th (click)="toggleSort('symbol')" class="sortable-th">Symbol <span *ngIf="sortKey === 'symbol'">{{ sortAsc ? '▲' : '▼' }}</span></th>
                  <th (click)="toggleSort('signal_mode')" class="sortable-th" style="text-align: center;">M <span *ngIf="sortKey === 'signal_mode'">{{ sortAsc ? '▲' : '▼' }}</span></th>
                  <th (click)="toggleSort('signal_score')" class="sortable-th">Score <span *ngIf="sortKey === 'signal_score'">{{ sortAsc ? '▲' : '▼' }}</span></th>
                  <th (click)="toggleSort('trigger_price')" class="sortable-th">Trigger <span *ngIf="sortKey === 'trigger_price'">{{ sortAsc ? '▲' : '▼' }}</span></th>
                  <th (click)="toggleSort('current_price')" class="sortable-th">Current <span *ngIf="sortKey === 'current_price'">{{ sortAsc ? '▲' : '▼' }}</span></th>
                  <th (click)="toggleSort('move_pct')" class="sortable-th">Move % <span *ngIf="sortKey === 'move_pct'">{{ sortAsc ? '▲' : '▼' }}</span></th>
                  <th (click)="toggleSort('signal_bar_time')" class="sortable-th">Time <span *ngIf="sortKey === 'signal_bar_time'">{{ sortAsc ? '▲' : '▼' }}</span></th>
                  <th (click)="toggleSort('status')" class="sortable-th" style="text-align: center;">St <span *ngIf="sortKey === 'status'">{{ sortAsc ? '▲' : '▼' }}</span></th>
                  <th>Reasons</th>
                  <th style="text-align: center;">Links</th>
                </tr>
              </thead>
              <tbody>
                <tr *ngFor="let s of filteredBearish" [class.stale-row]="s.status === 'stale' || s.status === 'expired' || s.status === 'duplicate'">
                  <td class="sym-cell">
                    <a [href]="'https://www.tradingview.com/chart/?symbol=' + s.symbol" target="_blank" class="symbol-link">{{ s.symbol }}</a>
                  </td>
                  <td style="text-align: center;">
                    <span class="mode-tag" [class.ew]="s.signal_mode === 'early_warning'" [title]="s.signal_mode === 'early_warning' ? 'Early Warning' : 'Confirmed'">
                      {{ s.signal_mode === 'early_warning' ? 'E' : 'C' }}
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
                  <td class="time-col">{{ s.signal_bar_time | date: 'MM/dd hh:mm a' }}</td>
                  <td style="text-align: center;">
                    <span class="status-lbl" [class]="s.status" [title]="s.status | uppercase">{{ getStatusShortCode(s.status) }}</span>
                  </td>
                  <td class="reasons-cell">
                    <div class="reasons-list">
                      <span *ngFor="let r of s.score_reasons" class="reason-pill" [class.penalty-pill]="isPenalty(r)">
                        {{ r }}
                      </span>
                      <span *ngIf="!s.score_reasons || s.score_reasons.length === 0" class="no-reasons">-</span>
                    </div>
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
    /* Eye-friendly Matte Charcoal Design System */
    .screener-container {
      padding: 12px 18px;
      color: #d1d5db; /* Warm soft gray text */
      background-color: #0f1115; /* Matte near-black background */
      min-height: 100vh;
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
      font-size: 1.2rem;
      font-weight: 500;
      color: #e5e7eb;
    }
    .refresh-indicator {
      font-size: 0.72rem;
      color: #6b7280;
      background: #161a22;
      padding: 3px 8px;
      border-radius: 4px;
      border: 1px solid #27272a;
    }
    .refresh-indicator.syncing {
      color: #4ade80;
      border-color: rgba(74, 222, 128, 0.4);
    }
    
    /* Matte Filter Panel */
    .filter-panel {
      background: #161a22;
      border-radius: 6px;
      border: 1px solid #22252a;
      padding: 10px 14px;
      margin-bottom: 14px;
      display: flex;
      flex-direction: column;
      gap: 8px;
    }
    .search-box {
      width: 100%;
    }
    .search-input {
      width: 100%;
      background: #0f1115;
      border: 1px solid #27272a;
      border-radius: 4px;
      padding: 6px 10px;
      color: #e5e7eb;
      font-size: 0.82rem;
      box-sizing: border-box;
      transition: border-color 0.2s ease;
    }
    .search-input:focus {
      outline: none;
      border-color: #3b82f6;
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
      color: #6b7280;
      font-size: 0.75rem;
      font-weight: 500;
    }
    .checkbox-label {
      font-size: 0.78rem;
      color: #9ca3af;
      cursor: pointer;
      display: flex;
      align-items: center;
      gap: 4px;
      user-select: none;
    }
    .toggles .checkbox-label {
      background: #0f1115;
      padding: 2px 6px;
      border-radius: 4px;
      border: 1px solid #27272a;
    }

    .spinner-container {
      display: flex;
      flex-direction: column;
      align-items: center;
      padding: 30px 0;
      color: #6b7280;
    }
    .spinner-container p {
      margin-top: 8px;
      font-size: 0.8rem;
    }
    .no-data {
      padding: 30px;
      text-align: center;
      background: #161a22;
      border-radius: 6px;
      color: #6b7280;
      border: 1px solid #22252a;
      font-size: 0.8rem;
    }

    /* Side-by-Side Tables Layout */
    .tables-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 14px;
    }
    .table-wrapper {
      background: #161a22;
      border-radius: 6px;
      border: 1px solid #22252a;
      overflow: hidden;
    }
    .table-title {
      padding: 8px 12px;
      font-weight: 500;
      font-size: 0.8rem;
      border-bottom: 1px solid #22252a;
      letter-spacing: 0.5px;
    }
    .bullish-title {
      background: rgba(74, 222, 128, 0.08);
      color: #4ade80; /* Pastel mint green */
    }
    .bearish-title {
      background: rgba(248, 113, 113, 0.08);
      color: #f87171; /* Pastel rose red */
    }
    .table-scroll {
      overflow-x: auto;
    }

    /* Compact Dark Table styling */
    .screener-table {
      width: 100%;
      border-collapse: collapse;
      font-size: 0.72rem;
      text-align: left;
    }
    .screener-table th {
      background: #1a1e27;
      color: #9ca3af;
      font-weight: 500;
      padding: 6px 8px;
      border-bottom: 1px solid #22252a;
      white-space: nowrap;
      text-transform: uppercase;
      font-size: 0.68rem;
      letter-spacing: 0.2px;
    }
    .sortable-th {
      cursor: pointer;
      user-select: none;
    }
    .sortable-th:hover {
      color: #fff;
      background: #22252a;
    }
    .screener-table td {
      padding: 6px 8px;
      border-bottom: 1px solid #1a1e27;
      white-space: nowrap;
      vertical-align: middle;
    }
    .screener-table tr:hover {
      background: rgba(255, 255, 255, 0.015);
    }
    .stale-row {
      opacity: 0.45; /* Increased opacity fade for easier eye tracking */
    }
    .empty-row {
      text-align: center;
      color: #4b5563;
      padding: 16px !important;
      font-style: italic;
    }

    /* Cell Components */
    .sym-cell {
      font-weight: bold;
    }
    .symbol-link {
      color: #e5e7eb;
      text-decoration: none;
      border-bottom: 1px dashed rgba(255,255,255,0.15);
    }
    .symbol-link:hover {
      color: #3b82f6;
      border-bottom-color: #3b82f6;
    }
    
    .mode-tag {
      font-size: 0.6rem;
      font-weight: bold;
      background: #2563eb;
      color: #e0f2fe;
      padding: 1px 5px;
      border-radius: 3px;
    }
    .mode-tag.ew {
      background: #d97706; /* Soft gold */
    }

    .grade-text {
      font-weight: bold;
    }
    .quality-a {
      color: #4ade80;
    }
    .quality-b {
      color: #60a5fa;
    }
    .quality-c {
      color: #fbbf24;
    }
    .quality-reject,
    .quality-r {
      color: #f87171;
    }

    .price-col {
      font-family: monospace;
      color: #d1d5db;
    }
    .pct-col {
      font-family: monospace;
      font-weight: bold;
    }
    .pct-col.positive {
      color: #4ade80;
    }
    .pct-col.negative {
      color: #f87171;
    }
    .time-col {
      font-family: monospace;
      color: #9ca3af;
    }

    /* Status Badges */
    .status-lbl {
      font-size: 0.62rem;
      font-weight: bold;
      padding: 1px 4px;
      border-radius: 3px;
      background: #27272a;
      color: #a1a1aa;
    }
    .status-lbl.fresh {
      color: #4ade80;
      background: rgba(74, 222, 128, 0.08);
      border: 1px solid rgba(74, 222, 128, 0.2);
    }
    .status-lbl.watch {
      color: #60a5fa;
      background: rgba(96, 165, 250, 0.08);
      border: 1px solid rgba(96, 165, 250, 0.2);
    }
    .status-lbl.stale {
      color: #9ca3af;
      background: rgba(156, 163, 175, 0.06);
    }
    .status-lbl.expired {
      color: #4b5563;
      background: transparent;
    }
    .status-lbl.duplicate {
      color: #fbbf24;
      background: rgba(251, 191, 36, 0.05);
    }
    .status-lbl.conflict {
      color: #f87171;
      background: rgba(248, 113, 113, 0.08);
      border: 1px solid rgba(248, 113, 113, 0.2);
    }

    /* Modern Muted Reason Pills */
    .reasons-cell {
      max-width: 200px;
      overflow-x: auto;
    }
    .reasons-list {
      display: flex;
      gap: 3px;
      flex-wrap: wrap;
    }
    .reason-pill {
      font-size: 0.58rem;
      font-weight: 500;
      background: rgba(96, 165, 250, 0.06);
      color: #93c5fd; /* Soft blue */
      border: 1px solid rgba(96, 165, 250, 0.15);
      padding: 1px 4px;
      border-radius: 3px;
      white-space: nowrap;
    }
    .reason-pill.penalty-pill {
      background: rgba(248, 113, 113, 0.04);
      color: #fca5a5; /* Soft rose */
      border: 1px solid rgba(248, 113, 113, 0.12);
    }
    .no-reasons {
      color: #4b5563;
    }

    .actions-cell {
      display: flex;
      gap: 4px;
      justify-content: center;
    }
    .mini-btn {
      font-size: 0.58rem;
      font-weight: 500;
      color: #d1d5db;
      text-decoration: none;
      padding: 2px 4px;
      border-radius: 3px;
      transition: background-color 0.2s ease;
      background: #27272a;
      border: 1px solid #3f3f46;
    }
    .mini-btn:hover {
      background: #3f3f46;
    }
    .mini-btn.tv {
      color: #93c5fd;
    }
    .mini-btn.fz {
      color: #86efac;
    }

    @media (max-width: 1024px) {
      .tables-grid {
        grid-template-columns: 1fr;
        gap: 12px;
      }
    }
  `]
})
export class AlphaTrend implements OnInit, OnDestroy {
  allSetups: any[] = [];
  filteredBullish: any[] = [];
  filteredBearish: any[] = [];
  totalBullish = 0;
  totalBearish = 0;
  loading = true;

  // Sorting: Default to time bar descending (latest first)
  sortKey = 'signal_bar_time';
  sortAsc = false;

  // Filters
  searchQuery = '';
  filterQualityA = true;
  filterQualityB = true;
  filterQualityC = false;
  showDuplicates = false;
  showRejected = false;
  showStale = true;

  private destroy$ = new Subject<void>();
  private pollInterval: any;

  constructor(
    private supabaseService: SupabaseService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.fetchData();

    this.pollInterval = setInterval(() => {
      if (document.visibilityState === 'visible') {
        this.fetchData(false);
      }
    }, 15000);
  }

  fetchData(showSpinner = true): void {
    if (showSpinner) {
      this.loading = true;
    }
    this.supabaseService.getScreenerSetups()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (data) => {
          this.allSetups = data.filter(s => 
            s.strategy_name === 'alphatrend_reversal' || 
            s.group_name.startsWith('AlphaTrend -')
          );
          
          this.applyFilters();
          this.loading = false;
          this.cdr.detectChanges();
        },
        error: (err) => {
          console.error('Error loading AlphaTrend setups:', err);
          this.loading = false;
          this.cdr.detectChanges();
        }
      });
  }

  toggleSort(key: string): void {
    if (this.sortKey === key) {
      this.sortAsc = !this.sortAsc;
    } else {
      this.sortKey = key;
      this.sortAsc = false;
    }
    this.applyFilters();
  }

  isPenalty(reason: string): boolean {
    const r = reason.toLowerCase();
    return r.includes('penalty') || r.includes('chop') || r.includes('extended') || r.includes('low volume');
  }

  getStatusShortCode(status: string): string {
    switch (status?.toLowerCase()) {
      case 'fresh': return 'F';
      case 'watch': return 'W';
      case 'stale': return 'S';
      case 'expired': return 'X';
      case 'rejected': return 'R';
      case 'duplicate': return 'D';
      case 'conflict': return 'C';
      default: return status ? status[0].toUpperCase() : '-';
    }
  }

  applyFilters(): void {
    let filtered = this.allSetups;

    // Advanced search filter (checks symbol, grade, quality, reasons, mode, status)
    if (this.searchQuery) {
      const q = this.searchQuery.toLowerCase().trim();
      filtered = filtered.filter(s => {
        const symbolMatch = s.symbol.toLowerCase().includes(q);
        const qualityMatch = s.signal_quality.toLowerCase().includes(q);
        const statusMatch = s.status.toLowerCase().includes(q);
        const modeMatch = s.signal_mode.toLowerCase().includes(q);
        const reasonsMatch = s.score_reasons?.some((r: string) => r.toLowerCase().includes(q)) || false;
        
        // Single letter codes matches
        const statusLetterMatch = q.length === 1 && this.getStatusShortCode(s.status).toLowerCase() === q;
        const modeLetterMatch = q.length === 1 && (s.signal_mode === 'early_warning' ? 'e' : 'c') === q;
        
        return symbolMatch || qualityMatch || statusMatch || modeMatch || reasonsMatch || statusLetterMatch || modeLetterMatch;
      });
    }

    // Quality filter
    filtered = filtered.filter(s => {
      if (s.signal_quality === 'A' && !this.filterQualityA) return false;
      if (s.signal_quality === 'B' && !this.filterQualityB) return false;
      if (s.signal_quality === 'C' && !this.filterQualityC) return false;
      if ((s.signal_quality === 'R' || s.signal_quality === 'Reject') && !this.showRejected) return false;
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

    // Dynamic Column Sorting
    filtered.sort((a, b) => {
      let valA = a[this.sortKey];
      let valB = b[this.sortKey];

      // Custom fields resolution
      if (this.sortKey === 'move_pct') {
        valA = this.getMovePct(a);
        valB = this.getMovePct(b);
      } else if (this.sortKey === 'signal_bar_time') {
        valA = a.signal_bar_time ? new Date(a.signal_bar_time).getTime() : 0;
        valB = b.signal_bar_time ? new Date(b.signal_bar_time).getTime() : 0;
      }

      if (valA == null) return this.sortAsc ? -1 : 1;
      if (valB == null) return this.sortAsc ? 1 : -1;

      if (typeof valA === 'string') {
        return this.sortAsc ? valA.localeCompare(valB) : valB.localeCompare(valA);
      } else {
        return this.sortAsc ? valA - valB : valB - valA;
      }
    });

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

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
    if (this.pollInterval) {
      clearInterval(this.pollInterval);
    }
  }
}
