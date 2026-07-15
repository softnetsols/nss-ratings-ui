import { Component, OnInit, OnDestroy, ChangeDetectorRef } from '@angular/core';
import { CommonModule, DecimalPipe } from '@angular/common';
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

      <!-- Advanced Filter Panel -->
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
        <mat-spinner diameter="40"></mat-spinner>
        <p>Loading active setups...</p>
      </div>

      <div *ngIf="!loading && allSetups.length === 0" class="no-data">
        No active setups found. Make sure your TradingView AlphaTrend alerts are active.
      </div>

      <!-- Side-by-Side Symbol Card Columns -->
      <div *ngIf="allSetups.length > 0" class="tables-grid">
        
        <!-- Bullish Column -->
        <div class="column-wrapper bullish-col">
          <div class="column-header bullish-header">
            🟢 BULLISH SETUPS ({{ filteredBullish.length }} of {{ totalBullish }})
          </div>
          <div class="cards-list">
            <div *ngFor="let card of filteredBullish" class="symbol-card bullish-card" [class.stale]="card.status === 'stale' || card.status === 'expired'">
              
              <!-- Card Top Header -->
              <div class="card-top">
                <div class="sym-group">
                  <a [href]="'https://www.tradingview.com/chart/?symbol=' + card.symbol" target="_blank" class="sym-link">
                    {{ card.symbol }}
                  </a>
                  <span class="mode-badge" [class.ew]="card.signal_mode === 'early_warning'">
                    {{ card.signal_mode === 'early_warning' ? 'EW' : 'CONFIRMED' }}
                  </span>
                </div>
                <div class="score-badge" [class]="'quality-' + card.signal_quality.toLowerCase()">
                  Score: {{ card.signal_score }} ({{ card.signal_quality }})
                </div>
              </div>

              <!-- Price Move Grid -->
              <div class="price-grid">
                <div class="price-item">
                  <span class="price-lbl">Trigger Price</span>
                  <span class="price-val">\${{ card.trigger_price | number: '1.2-2' }}</span>
                </div>
                <div class="price-item">
                  <span class="price-lbl">Current Price</span>
                  <span class="price-val">\${{ card.current_price | number: '1.2-2' }}</span>
                </div>
                <div class="price-item performance">
                  <span class="price-lbl">Move %</span>
                  <span class="price-val pct-move" [class.positive]="getMovePct(card) >= 0" [class.negative]="getMovePct(card) < 0">
                    {{ getMovePct(card) | number: '1.2-2' }}%
                  </span>
                </div>
              </div>

              <!-- Age & Lifecycle Status -->
              <div class="card-details">
                <div class="detail-row">
                  <span class="detail-lbl">Age:</span>
                  <span class="detail-val">{{ getSignalAge(card) }}m ago</span>
                </div>
                <div class="detail-row">
                  <span class="detail-lbl">Status:</span>
                  <span class="detail-val status-tag" [class]="card.status">
                    {{ card.status | uppercase }}
                  </span>
                </div>
                <div class="detail-row" *ngIf="card.confirmation_count > 1">
                  <span class="detail-lbl">Confirmations:</span>
                  <span class="detail-val conf-tag">
                    {{ getConfirmationsList(card) }}
                  </span>
                </div>
              </div>

              <!-- Badges reasons -->
              <div class="reasons-list" *ngIf="card.score_reasons?.length > 0">
                <span *ngFor="let reason of card.score_reasons" class="reason-badge" [class.penalty]="reason.startsWith('-')">
                  {{ reason }}
                </span>
              </div>

              <!-- Conflict Indicator -->
              <div class="conflict-banner" *ngIf="card.status === 'conflict'">
                ⚠️ CONFLICTING DIRECTION DETECTED
              </div>

              <!-- Card Bottom Actions -->
              <div class="card-actions">
                <a [href]="'https://www.tradingview.com/chart/?symbol=' + card.symbol" target="_blank" class="action-btn tv-btn">TradingView</a>
                <a [href]="'https://finviz.com/quote.ashx?t=' + card.symbol" target="_blank" class="action-btn fz-btn">Finviz</a>
              </div>

            </div>
            <div *ngIf="filteredBullish.length === 0" class="empty-list">No bullish setups match active filters.</div>
          </div>
        </div>

        <!-- Bearish Column -->
        <div class="column-wrapper bearish-col">
          <div class="column-header bearish-header">
            🔴 BEARISH SETUPS ({{ filteredBearish.length }} of {{ totalBearish }})
          </div>
          <div class="cards-list">
            <div *ngFor="let card of filteredBearish" class="symbol-card bearish-card" [class.stale]="card.status === 'stale' || card.status === 'expired'">
              
              <!-- Card Top Header -->
              <div class="card-top">
                <div class="sym-group">
                  <a [href]="'https://www.tradingview.com/chart/?symbol=' + card.symbol" target="_blank" class="sym-link">
                    {{ card.symbol }}
                  </a>
                  <span class="mode-badge" [class.ew]="card.signal_mode === 'early_warning'">
                    {{ card.signal_mode === 'early_warning' ? 'EW' : 'CONFIRMED' }}
                  </span>
                </div>
                <div class="score-badge" [class]="'quality-' + card.signal_quality.toLowerCase()">
                  Score: {{ card.signal_score }} ({{ card.signal_quality }})
                </div>
              </div>

              <!-- Price Move Grid -->
              <div class="price-grid">
                <div class="price-item">
                  <span class="price-lbl">Trigger Price</span>
                  <span class="price-val">\${{ card.trigger_price | number: '1.2-2' }}</span>
                </div>
                <div class="price-item">
                  <span class="price-lbl">Current Price</span>
                  <span class="price-val">\${{ card.current_price | number: '1.2-2' }}</span>
                </div>
                <div class="price-item performance">
                  <span class="price-lbl">Move %</span>
                  <span class="price-val pct-move" [class.positive]="getMovePct(card) >= 0" [class.negative]="getMovePct(card) < 0">
                    {{ getMovePct(card) | number: '1.2-2' }}%
                  </span>
                </div>
              </div>

              <!-- Age & Lifecycle Status -->
              <div class="card-details">
                <div class="detail-row">
                  <span class="detail-lbl">Age:</span>
                  <span class="detail-val">{{ getSignalAge(card) }}m ago</span>
                </div>
                <div class="detail-row">
                  <span class="detail-lbl">Status:</span>
                  <span class="detail-val status-tag" [class]="card.status">
                    {{ card.status | uppercase }}
                  </span>
                </div>
                <div class="detail-row" *ngIf="card.confirmation_count > 1">
                  <span class="detail-lbl">Confirmations:</span>
                  <span class="detail-val conf-tag">
                    {{ getConfirmationsList(card) }}
                  </span>
                </div>
              </div>

              <!-- Badges reasons -->
              <div class="reasons-list" *ngIf="card.score_reasons?.length > 0">
                <span *ngFor="let reason of card.score_reasons" class="reason-badge" [class.penalty]="reason.startsWith('-')">
                  {{ reason }}
                </span>
              </div>

              <!-- Conflict Indicator -->
              <div class="conflict-banner" *ngIf="card.status === 'conflict'">
                ⚠️ CONFLICTING DIRECTION DETECTED
              </div>

              <!-- Card Bottom Actions -->
              <div class="card-actions">
                <a [href]="'https://www.tradingview.com/chart/?symbol=' + card.symbol" target="_blank" class="action-btn tv-btn">TradingView</a>
                <a [href]="'https://finviz.com/quote.ashx?t=' + card.symbol" target="_blank" class="action-btn fz-btn">Finviz</a>
              </div>

            </div>
            <div *ngIf="filteredBearish.length === 0" class="empty-list">No bearish setups match active filters.</div>
          </div>
        </div>

      </div>
    </div>
  `,
  styles: [`
    .screener-container {
      padding: 16px 24px;
      color: #fff;
    }
    .screener-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 20px;
    }
    h2 {
      margin: 0;
      font-size: 1.5rem;
      font-weight: 500;
      color: #fff;
    }
    .refresh-indicator {
      font-size: 0.8rem;
      color: #888;
      background: #1e222d;
      padding: 4px 10px;
      border-radius: 4px;
      border: 1px solid #2a2e39;
    }
    .refresh-indicator.syncing {
      color: #00ff88;
      border-color: #00ff88;
    }
    
    /* Advanced Filter Panel */
    .filter-panel {
      background: #1c2030;
      border-radius: 8px;
      border: 1px solid #2a2e39;
      padding: 16px;
      margin-bottom: 24px;
    }
    .search-box {
      margin-bottom: 12px;
    }
    .search-input {
      width: 100%;
      background: #131722;
      border: 1px solid #2a2e39;
      border-radius: 4px;
      padding: 8px 12px;
      color: #fff;
      font-size: 0.9rem;
    }
    .search-input:focus {
      outline: none;
      border-color: #2962ff;
    }
    .filters-row {
      display: flex;
      justify-content: space-between;
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
      font-size: 0.85rem;
      font-weight: 500;
    }
    .checkbox-label {
      font-size: 0.85rem;
      color: #ddd;
      cursor: pointer;
      display: flex;
      align-items: center;
      gap: 4px;
    }
    .toggles .checkbox-label {
      background: #131722;
      padding: 4px 8px;
      border-radius: 4px;
      border: 1px solid #2a2e39;
    }

    .spinner-container {
      display: flex;
      flex-direction: column;
      align-items: center;
      padding: 40px 0;
      color: #888;
    }
    .spinner-container p {
      margin-top: 12px;
    }
    .no-data {
      padding: 40px;
      text-align: center;
      background: #1c2030;
      border-radius: 8px;
      color: #888;
      border: 1px solid #2a2e39;
    }

    /* Side-by-Side Card Columns */
    .tables-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 24px;
    }
    .column-wrapper {
      background: #131722;
      border-radius: 8px;
      overflow: hidden;
    }
    .column-header {
      padding: 12px 16px;
      font-weight: bold;
      font-size: 0.95rem;
      border-bottom: 1px solid #2a2e39;
    }
    .bullish-header {
      background: rgba(13, 44, 29, 0.5);
      color: #00ff88;
    }
    .bearish-header {
      background: rgba(59, 18, 18, 0.5);
      color: #ff4a4a;
    }
    .cards-list {
      display: flex;
      flex-direction: column;
      gap: 16px;
      padding: 16px;
    }

    /* Symbol Card styling */
    .symbol-card {
      background: #1c2030;
      border-radius: 8px;
      border: 1px solid #2a2e39;
      padding: 16px;
      display: flex;
      flex-direction: column;
      gap: 12px;
      transition: transform 0.2s ease, box-shadow 0.2s ease;
    }
    .symbol-card:hover {
      transform: translateY(-2px);
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
    }
    .bullish-card {
      border-left: 4px solid #00ff88;
    }
    .bearish-card {
      border-left: 4px solid #ff4a4a;
    }
    .symbol-card.stale {
      opacity: 0.65;
    }

    /* Card Components */
    .card-top {
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    .sym-group {
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .sym-link {
      color: #fff;
      text-decoration: none;
      font-size: 1.15rem;
      font-weight: bold;
    }
    .sym-link:hover {
      color: #2962ff;
    }
    .mode-badge {
      font-size: 0.65rem;
      font-weight: bold;
      background: #2962ff;
      color: #fff;
      padding: 2px 6px;
      border-radius: 4px;
    }
    .mode-badge.ew {
      background: #f57c00;
    }
    .score-badge {
      font-size: 0.75rem;
      font-weight: bold;
      padding: 4px 8px;
      border-radius: 4px;
      background: #2a2e39;
    }
    .quality-a {
      color: #00ff88;
      background: rgba(13, 44, 29, 0.3);
    }
    .quality-b {
      color: #29b6f6;
      background: rgba(41, 182, 246, 0.15);
    }
    .quality-c {
      color: #ffca28;
      background: rgba(255, 202, 40, 0.15);
    }
    .quality-reject {
      color: #ff4a4a;
      background: rgba(255, 74, 74, 0.15);
    }

    .price-grid {
      display: grid;
      grid-template-columns: 1fr 1fr 1fr;
      background: #131722;
      border-radius: 6px;
      padding: 10px;
      border: 1px solid #2a2e39;
    }
    .price-item {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 4px;
    }
    .price-lbl {
      font-size: 0.7rem;
      color: #888;
      text-transform: uppercase;
    }
    .price-val {
      font-size: 0.85rem;
      font-weight: 500;
      color: #fff;
    }
    .pct-move.positive {
      color: #00ff88;
    }
    .pct-move.negative {
      color: #ff4a4a;
    }

    .card-details {
      display: flex;
      flex-direction: column;
      gap: 6px;
      font-size: 0.8rem;
      border-bottom: 1px solid #2a2e39;
      padding-bottom: 10px;
    }
    .detail-row {
      display: flex;
      justify-content: space-between;
    }
    .detail-lbl {
      color: #888;
    }
    .detail-val {
      color: #fff;
      font-weight: 500;
    }
    .status-tag {
      font-size: 0.7rem;
      font-weight: bold;
      padding: 1px 6px;
      border-radius: 4px;
      background: #2a2e39;
    }
    .status-tag.fresh {
      color: #00ff88;
      background: rgba(13, 44, 29, 0.3);
    }
    .status-tag.watch {
      color: #29b6f6;
    }
    .status-tag.stale {
      color: #aaa;
    }
    .status-tag.expired {
      color: #888;
    }
    .status-tag.conflict {
      color: #ff4a4a;
      background: rgba(255, 74, 74, 0.15);
    }
    .conf-tag {
      color: #29b6f6;
      background: rgba(41, 182, 246, 0.1);
      padding: 1px 6px;
      border-radius: 4px;
    }

    .reasons-list {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
    }
    .reason-badge {
      font-size: 0.7rem;
      padding: 2px 6px;
      border-radius: 4px;
      background: rgba(0, 255, 136, 0.1);
      color: #00ff88;
    }
    .reason-badge.penalty {
      background: rgba(255, 74, 74, 0.1);
      color: #ff4a4a;
    }

    .conflict-banner {
      background: rgba(255, 74, 74, 0.15);
      border: 1px solid #ff4a4a;
      color: #ff4a4a;
      padding: 6px;
      border-radius: 4px;
      font-size: 0.75rem;
      text-align: center;
      font-weight: bold;
    }

    .card-actions {
      display: flex;
      gap: 8px;
    }
    .action-btn {
      flex: 1;
      text-align: center;
      padding: 6px 12px;
      border-radius: 4px;
      font-size: 0.8rem;
      font-weight: 500;
      text-decoration: none;
      transition: background 0.2s ease;
    }
    .tv-btn {
      background: #2962ff;
      color: #fff;
    }
    .tv-btn:hover {
      background: #1565c0;
    }
    .fz-btn {
      background: #388e3c;
      color: #fff;
    }
    .fz-btn:hover {
      background: #2e7d32;
    }
    .empty-list {
      text-align: center;
      color: #888;
      padding: 24px;
      font-size: 0.85rem;
    }

    @media (max-width: 1024px) {
      .tables-grid {
        grid-template-columns: 1fr;
        gap: 16px;
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
          // Filter specifically for AlphaTrend setups
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

    // Limit to top 20 cards each
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

  getConfirmationsList(card: any): string {
    if (card.confirmations && Array.isArray(card.confirmations)) {
      return card.confirmations.map((c: string) => c === 'alphatrend_reversal' ? 'AT' : 'Cross').join(', ');
    }
    return card.strategy_name === 'alphatrend_reversal' ? 'AT' : 'Cross';
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
    if (this.pollInterval) {
      clearInterval(this.pollInterval);
    }
  }
}
