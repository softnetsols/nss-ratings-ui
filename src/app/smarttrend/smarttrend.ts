import { Component, OnInit, OnDestroy, ChangeDetectorRef } from '@angular/core';
import { CommonModule, DecimalPipe, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { Subject, takeUntil, interval, Observable, from } from 'rxjs';
import { SupabaseService } from '../../services/supabase.service';
import { MarketDataService, MarketQuote } from '../../services/market-data.service';

export interface NormalizedSignal {
  signal_id: string;
  symbol: string;
  group_name: string;
  strategy_name: string;
  direction: string;
  timeframe: string;
  signal_bar_time: string;
  alert_received_at: string;
  created_at: string;
  trigger_price: number;
  current_price: number;
  vwap_at_signal: number;
  ema9_at_signal: number;
  ema21_at_signal: number;
  atr_at_signal: number;
  stop_price: number | null;
  target1_price: number | null;
  target2_price: number | null;
  target3_price: number | null;
  close_price_est: number | null;
  risk_per_share: number | null;
  trade_plan_quality: string;
  trade_plan_reason: string;
  invalidation_reason: string;
  entry_price_est: number | null;
  entry_zone_low: number | null;
  entry_zone_high: number | null;
  reward_to_risk_t1: number | null;
  reward_to_risk_t2: number | null;
  reward_to_risk_t3: number | null;
  recent_swing_high: number | null;
  recent_swing_low: number | null;
  signal_candle_high: number | null;
  signal_candle_low: number | null;
  alphatrend_at_signal: number | null;
  signal_score: number;
  signal_quality: string;
  status: string;
  score_reasons: string[];
  action: string;
  lifecycle: string;
  tradeId: string;
  entrySource: string;
  primaryReason: string;
  positionBefore: string;
  positionAfter: string;
  raw_alert_payload: any;
  exitPrice: number | null;
}

export interface SmartTrendTrade {
  tradeId: string;
  open?: NormalizedSignal;
  close?: NormalizedSignal;
  type: 'ACTIVE' | 'CLOSED' | 'ORPHAN';
  side: 'LONG' | 'SHORT';
  symbol: string;
  openedTime?: string;
  closedTime?: string;
  ageText?: string;
  holdTimeText?: string;
  resultPct?: number;
  movePct: number;
  quantity?: number;
  plPerShare?: number;
  paperPl?: number;
  unrealizedPaperPl?: number;
  tradeCapital?: number;
  modeledExitPrice?: number | null;
  fillBasis?: 'TARGET_LEVEL' | 'STOP_LEVEL' | 'EVENT_PRICE' | 'UNKNOWN';
  livePrice?: number;
  livePriceUpdatedAt?: number;
  quoteStatus?: 'LIVE' | 'STALE' | 'UNAVAILABLE' | 'ERROR';
  touchState?: 'NONE' | 'TARGET_TOUCHED' | 'STOP_TOUCHED';
}

@Component({
  selector: 'app-smarttrend',
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
        <div style="display: flex; flex-direction: column; gap: 4px;">
          <h2 style="display: flex; align-items: center; gap: 10px; margin: 0; font-size: 1.35rem; color: #fff;">
            SmartTrend Core — Experimental Paper Test
            <span class="warning-badge">PAPER TEST ONLY — Backtest Not Yet Profitable</span>
          </h2>
          
          <!-- Authoritative Allocation Control -->
          <div class="allocation-control" style="display: flex; align-items: center; gap: 8px; margin-top: 6px;">
            <label style="font-size: 0.75rem; color: #9ca3af;">Paper Allocation / Trade:</label>
            <span style="color: #9ca3af; font-size: 0.75rem;">$</span>
            <input type="number" [(ngModel)]="paperAllocation" min="100" class="alloc-input" 
                   style="width: 80px; background: #0f1115; border: 1px solid #27272a; color: #e5e7eb; border-radius: 4px; padding: 2px 6px; font-size: 0.75rem;" 
                   [disabled]="allocationLocked" />
            
            <ng-container *ngIf="!allocationLocked">
              <input type="password" [(ngModel)]="webhookSecret" placeholder="Secret Key" 
                     style="width: 90px; background: #0f1115; border: 1px solid #27272a; color: #e5e7eb; border-radius: 4px; padding: 2px 6px; font-size: 0.65rem;" />
              <button (click)="savePaperAllocation()" 
                      style="background: #2563eb; color: white; border: none; border-radius: 4px; padding: 2px 8px; font-size: 0.65rem; cursor: pointer;">
                Save
              </button>
            </ng-container>

            <span *ngIf="allocationLocked" style="font-size: 0.7rem; color: #fbbf24; background: rgba(245,158,11,0.06); padding: 2px 8px; border-radius: 4px; border: 1px solid rgba(245,158,11,0.15);">
              ⚠️ Today's allocation is locked at \${{ lockedAllocation | number: '1.2-2' }}. Changes apply next trading day.
            </span>
          </div>
        </div>

        <div style="display: flex; align-items: center; gap: 12px;">
          <button class="manual-refresh-btn" (click)="fetchData(true)" [disabled]="loading">
            🔄 {{ loading ? 'Refreshing...' : 'Refresh' }}
          </button>
          <span class="refresh-indicator" [class.syncing]="loading">
            {{ loading ? 'Updating...' : 'Ready' }}
          </span>
          <span class="last-updated" *ngIf="lastUpdated">
            Last updated: {{ lastUpdated }}
          </span>
        </div>
      </div>

      <!-- Capital & Performance Summary Dashboard (Section 15 UI Addition) -->
      <div class="metrics-dashboard" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 12px; margin-bottom: 16px;">
        <div class="metric-box" style="background: #111317; border: 1px solid #1f2229; border-radius: 6px; padding: 12px; display: flex; flex-direction: column;">
          <span style="font-size: 0.7rem; color: #9ca3af; text-transform: uppercase; letter-spacing: 0.05em;">Active Capital Now</span>
          <span style="font-size: 1.25rem; font-weight: bold; color: #e5e7eb; margin-top: 4px;">\${{ activeCapitalNow | number: '1.2-2' }}</span>
        </div>
        <div class="metric-box" style="background: #111317; border: 1px solid #1f2229; border-radius: 6px; padding: 12px; display: flex; flex-direction: column;">
          <span style="font-size: 0.7rem; color: #9ca3af; text-transform: uppercase; letter-spacing: 0.05em;">Gross Deployed Today</span>
          <span style="font-size: 1.25rem; font-weight: bold; color: #e5e7eb; margin-top: 4px;">\${{ grossCapitalDeployedToday | number: '1.2-2' }}</span>
        </div>
        <div class="metric-box" style="background: #111317; border: 1px solid #1f2229; border-radius: 6px; padding: 12px; display: flex; flex-direction: column; border-left: 3px solid #f59e0b;">
          <span style="font-size: 0.7rem; color: #fbbf24; text-transform: uppercase; letter-spacing: 0.05em;">Capital Needed Today (Peak)</span>
          <span style="font-size: 1.25rem; font-weight: bold; color: #fbbf24; margin-top: 4px;">\${{ peakConcurrentCapitalToday | number: '1.2-2' }}</span>
        </div>
        <div class="metric-box" style="background: #111317; border: 1px solid #1f2229; border-radius: 6px; padding: 12px; display: flex; flex-direction: column;">
          <span style="font-size: 0.7rem; color: #9ca3af; text-transform: uppercase; letter-spacing: 0.05em;">Max Concurrent Trades</span>
          <span style="font-size: 1.25rem; font-weight: bold; color: #e5e7eb; margin-top: 4px;">{{ maxConcurrentTradesToday }}</span>
        </div>
        <div class="metric-box" style="background: #111317; border: 1px solid #1f2229; border-radius: 6px; padding: 12px; display: flex; flex-direction: column;">
          <span style="font-size: 0.7rem; color: #9ca3af; text-transform: uppercase; letter-spacing: 0.05em;">Unrealized P/L Now</span>
          <span style="font-size: 1.25rem; font-weight: bold; margin-top: 4px;" [class.positive]="unrealizedPaperPlNow > 0" [class.negative]="unrealizedPaperPlNow < 0">
            \${{ unrealizedPaperPlNow | number: '1.2-2' }}
          </span>
        </div>
        <div class="metric-box" style="background: #111317; border: 1px solid #1f2229; border-radius: 6px; padding: 12px; display: flex; flex-direction: column; border-left: 3px solid #2563eb;">
          <span style="font-size: 0.7rem; color: #60a5fa; text-transform: uppercase; letter-spacing: 0.05em;">Net Paper P/L Today</span>
          <span style="font-size: 1.25rem; font-weight: bold; margin-top: 4px;" [class.positive]="netPaperPlToday > 0" [class.negative]="netPaperPlToday < 0">
            \${{ netPaperPlToday | number: '1.2-2' }}
          </span>
        </div>
      </div>

      <!-- Summary Strip -->
      <div class="summary-strip">
        <div class="summary-card">
          <span class="card-val">{{ activeLongsCount }}</span>
          <span class="card-lbl">Active Longs</span>
        </div>
        <div class="summary-card">
          <span class="card-val">{{ activeShortsCount }}</span>
          <span class="card-lbl">Active Shorts</span>
        </div>
        <div class="summary-card">
          <span class="card-val">{{ exitsTodayCount }}</span>
          <span class="card-lbl">Exits Today</span>
        </div>
        <div class="summary-card">
          <span class="card-val" [class.positive]="paperPlToday > 0" [class.negative]="paperPlToday < 0">
            \${{ paperPlToday | number: '1.2-2' }}
          </span>
          <span class="card-lbl">Realized P/L Today</span>
        </div>
        <div class="summary-card">
          <span class="card-val" style="color: #4ade80;">{{ winningTradesToday }}</span>
          <span class="card-lbl">Wins Today</span>
        </div>
        <div class="summary-card">
          <span class="card-val" style="color: #f87171;">{{ losingTradesToday }}</span>
          <span class="card-lbl">Losses Today</span>
        </div>
        <div class="summary-card">
          <span class="card-val">{{ targetsTodayCount }}</span>
          <span class="card-lbl">Targets Today</span>
        </div>
        <div class="summary-card">
          <span class="card-val">{{ stopsTodayCount }}</span>
          <span class="card-lbl">Stops Today</span>
        </div>
        <div class="summary-card">
          <span class="card-val">{{ structureExitsTodayCount }}</span>
          <span class="card-lbl">Structure Exits</span>
        </div>
        <div class="summary-card">
          <span class="card-val">{{ eodExitsTodayCount }}</span>
          <span class="card-lbl">EOD Exits</span>
        </div>
      </div>

      <div class="disclaimer-bar" style="font-size: 0.65rem; color: #6b7280; margin-bottom: 12px; font-style: italic;">
        * Paper P/L excludes commission, slippage, borrow fees, and actual execution. This is modeled paper trading only, not actual realized brokerage profit.
      </div>

      <!-- Filter Panel (Matte Charcoal style) -->
      <div class="filter-panel">
        <div class="search-box">
          <input type="text" [(ngModel)]="searchQuery" (ngModelChange)="applyFilters()" placeholder="Search symbols, actions, trade IDs, sources, reasons..." class="search-input" />
        </div>
        
        <div style="display: flex; justify-content: space-between; align-items: center; width: 100%; flex-wrap: wrap; gap: 12px;">
          <div class="filters-row" style="flex: 1; min-width: 300px; border-bottom: none; margin: 0; padding: 0;">
            <!-- Views -->
            <div class="filter-group">
              <span class="group-label">View:</span>
              <label class="checkbox-label">
                <input type="checkbox" [(ngModel)]="viewActive" (change)="applyFilters()" /> Active
              </label>
              <label class="checkbox-label">
                <input type="checkbox" [(ngModel)]="viewClosedToday" (change)="applyFilters()" /> Closed Today
              </label>
              <label class="checkbox-label">
                <input type="checkbox" [(ngModel)]="viewOlderHistory" (change)="applyFilters()" /> Older History
              </label>
              <label class="checkbox-label">
                <input type="checkbox" [(ngModel)]="viewOrphanExits" (change)="applyFilters()" /> Orphan Exits
              </label>
            </div>

            <!-- Actions -->
            <div class="filter-group">
              <span class="group-label">Action:</span>
              <label class="checkbox-label">
                <input type="checkbox" [(ngModel)]="actionBuy" (change)="applyFilters()" /> BUY
              </label>
              <label class="checkbox-label">
                <input type="checkbox" [(ngModel)]="actionShort" (change)="applyFilters()" /> SHORT
              </label>
              <label class="checkbox-label">
                <input type="checkbox" [(ngModel)]="actionExitLong" (change)="applyFilters()" /> EXIT LONG
              </label>
              <label class="checkbox-label">
                <input type="checkbox" [(ngModel)]="actionExitShort" (change)="applyFilters()" /> EXIT SHORT
              </label>
            </div>
          </div>

          <!-- Test Data Filter Toggles (Section 15 requirement) -->
          <div class="filter-group" style="margin: 0; border: 1px dashed #27272a; padding: 4px 10px; border-radius: 4px; background: rgba(0,0,0,0.15);">
            <label class="checkbox-label" style="font-weight: bold; color: #a1a1aa; cursor: pointer;">
              <input type="checkbox" [(ngModel)]="showTestData" (change)="onShowTestDataChange()" /> Show Test Data (STDEMO)
            </label>
          </div>
        </div>

        <div class="filters-row" style="margin-top: 8px;">
          <!-- Entry Source -->
          <div class="filter-group">
            <span class="group-label">Entry Source:</span>
            <label class="checkbox-label">
              <input type="checkbox" [(ngModel)]="sourceFresh" (change)="applyFilters()" /> Fresh
            </label>
            <label class="checkbox-label">
              <input type="checkbox" [(ngModel)]="sourcePending" (change)="applyFilters()" /> Pending
            </label>
          </div>

          <!-- Exit Reason -->
          <div class="filter-group">
            <span class="group-label">Exit Reason:</span>
            <label class="checkbox-label">
              <input type="checkbox" [(ngModel)]="reasonTarget" (change)="applyFilters()" /> Target
            </label>
            <label class="checkbox-label">
              <input type="checkbox" [(ngModel)]="reasonStop" (change)="applyFilters()" /> Stop
            </label>
            <label class="checkbox-label">
              <input type="checkbox" [(ngModel)]="reasonStructure" (change)="applyFilters()" /> Structure
            </label>
            <label class="checkbox-label">
              <input type="checkbox" [(ngModel)]="reasonEod" (change)="applyFilters()" /> End of Day
            </label>
            <label class="checkbox-label">
              <input type="checkbox" [(ngModel)]="reasonUnknown" (change)="applyFilters()" /> Unknown
            </label>
          </div>

          <!-- Status -->
          <div class="filter-group toggles">
            <span class="group-label">Status:</span>
            <label class="checkbox-label toggle-label">
              <input type="checkbox" [(ngModel)]="statusFresh" (change)="applyFilters()" /> Fresh
            </label>
            <label class="checkbox-label toggle-label">
              <input type="checkbox" [(ngModel)]="statusStale" (change)="applyFilters()" /> Stale/Expired
            </label>
          </div>
        </div>
      </div>

      <!-- Loading / Error states -->
      <div *ngIf="loading && allTrades.length === 0" class="spinner-container">
        <mat-spinner diameter="35"></mat-spinner>
        <p>Loading SmartTrend paper-test signals...</p>
      </div>

      <div *ngIf="errorMessage" class="error-container">
        <p class="error-text">{{ errorMessage }}</p>
        <button class="manual-refresh-btn" (click)="fetchData(true)">Try Again</button>
      </div>

      <div *ngIf="!loading && !errorMessage && allTrades.length === 0" class="no-data">
        No SmartTrend signals found yet. Confirm the TradingView SmartTrend alert is active and Webhook Test Mode is OFF.
      </div>

      <div *ngIf="!loading && !errorMessage && allTrades.length > 0 && filteredActiveLongs.length === 0 && filteredActiveShorts.length === 0 && filteredClosedTrades.length === 0" class="no-data">
        No active SmartTrend trades.
      </div>

      <!-- Tables Grid -->
      <div *ngIf="allTrades.length > 0 && !errorMessage" class="tables-grid">
        
        <!-- Active Longs Table -->
        <div class="active-table-wrapper bullish-wrapper" *ngIf="viewActive">
          <div class="table-title bullish-title">
            🟢 ACTIVE LONGS ({{ totalActiveLongs }} positions)
          </div>
          <div class="table-scroll">
            <table class="screener-table">
              <thead>
                <tr>
                  <th (click)="toggleSort('symbol')" class="sortable-th">Symbol <span *ngIf="sortKey === 'symbol'">{{ sortAsc ? '▲' : '▼' }}</span></th>
                  <th (click)="toggleSort('source')" class="sortable-th" style="text-align: center;">Src <span *ngIf="sortKey === 'source'">{{ sortAsc ? '▲' : '▼' }}</span></th>
                  <th (click)="toggleSort('entry')" class="sortable-th">Entry <span *ngIf="sortKey === 'entry'">{{ sortAsc ? '▲' : '▼' }}</span></th>
                  <th (click)="toggleSort('current')" class="sortable-th">Current <span *ngIf="sortKey === 'current'">{{ sortAsc ? '▲' : '▼' }}</span></th>
                  <th (click)="toggleSort('move_pct')" class="sortable-th">Move % <span *ngIf="sortKey === 'move_pct'">{{ sortAsc ? '▲' : '▼' }}</span></th>
                  <th (click)="toggleSort('stop')" class="sortable-th">Stop <span *ngIf="sortKey === 'stop'">{{ sortAsc ? '▲' : '▼' }}</span></th>
                  <th (click)="toggleSort('target')" class="sortable-th">Target <span *ngIf="sortKey === 'target'">{{ sortAsc ? '▲' : '▼' }}</span></th>
                  <th (click)="toggleSort('opened')" class="sortable-th">Opened <span *ngIf="sortKey === 'opened'">{{ sortAsc ? '▲' : '▼' }}</span></th>
                  <th>Age</th>
                  <th (click)="toggleSort('status')" class="sortable-th" style="text-align: center;">Status <span *ngIf="sortKey === 'status'">{{ sortAsc ? '▲' : '▼' }}</span></th>
                  <th style="text-align: center;">Links</th>
                </tr>
              </thead>
              <tbody>
                <tr *ngFor="let t of filteredActiveLongs" (click)="openModal(t)" style="cursor: pointer;">
                  <td class="sym-cell">
                    <a [href]="'https://www.tradingview.com/chart/?symbol=' + t.symbol" target="_blank" class="symbol-link" (click)="$event.stopPropagation()">{{ t.symbol }}</a>
                  </td>
                  <td style="text-align: center;">
                    <span class="source-tag" [class.pending]="t.open?.entrySource === 'PENDING'" [title]="getSourceExplanation(t.open?.entrySource)">
                      {{ t.open?.entrySource === 'PENDING' ? 'P' : 'F' }}
                    </span>
                  </td>
                  <td class="price-col">\${{ getEntryPrice(t) | number: '1.2-2' }}</td>
                  <td class="price-col">{{ getCurrentPriceDisplay(t) }}</td>
                  <td class="pct-col" [class.positive]="t.movePct >= 0" [class.negative]="t.movePct < 0">
                    {{ t.movePct | number: '1.2-2' }}%
                  </td>
                  <td class="price-col stop-col" style="color: #f87171;">\${{ t.open?.stop_price | number: '1.2-2' }}</td>
                  <td class="price-col target-col" style="color: #34d399; font-weight: 500;">\${{ getTargetPrice(t.open) | number: '1.2-2' }}</td>
                  <td class="time-col">{{ t.openedTime | date: 'MM/dd hh:mm a' }}</td>
                  <td class="time-col">{{ t.ageText }}</td>
                  <td style="text-align: center;">
                    <span class="status-lbl" [class]="getDerivedStatus(t).toLowerCase().replace(' ', '-')">{{ getStatusDisplay(getDerivedStatus(t)) }}</span>
                  </td>
                  <td class="actions-cell">
                    <button class="mini-btn info" type="button" (click)="openModal(t); $event.stopPropagation()" aria-label="Details">ℹ️</button>
                    <a [href]="'https://www.tradingview.com/chart/?symbol=' + t.symbol" target="_blank" class="mini-btn tv" title="TradingView" (click)="$event.stopPropagation()">TV</a>
                    <a [href]="'https://finviz.com/quote.ashx?t=' + t.symbol" target="_blank" class="mini-btn fz" title="Finviz" (click)="$event.stopPropagation()">FZ</a>
                  </td>
                </tr>
                <tr *ngIf="filteredActiveLongs.length === 0">
                  <td colspan="11" class="empty-row">No active longs match filters.</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <!-- Active Shorts Table -->
        <div class="active-table-wrapper bearish-wrapper" *ngIf="viewActive">
          <div class="table-title bearish-title">
            🔴 ACTIVE SHORTS ({{ totalActiveShorts }} positions)
          </div>
          <div class="table-scroll">
            <table class="screener-table">
              <thead>
                <tr>
                  <th (click)="toggleSort('symbol')" class="sortable-th">Symbol <span *ngIf="sortKey === 'symbol'">{{ sortAsc ? '▲' : '▼' }}</span></th>
                  <th (click)="toggleSort('source')" class="sortable-th" style="text-align: center;">Src <span *ngIf="sortKey === 'source'">{{ sortAsc ? '▲' : '▼' }}</span></th>
                  <th (click)="toggleSort('entry')" class="sortable-th">Entry <span *ngIf="sortKey === 'entry'">{{ sortAsc ? '▲' : '▼' }}</span></th>
                  <th (click)="toggleSort('current')" class="sortable-th">Current <span *ngIf="sortKey === 'current'">{{ sortAsc ? '▲' : '▼' }}</span></th>
                  <th (click)="toggleSort('move_pct')" class="sortable-th">Move % <span *ngIf="sortKey === 'move_pct'">{{ sortAsc ? '▲' : '▼' }}</span></th>
                  <th (click)="toggleSort('stop')" class="sortable-th">Stop <span *ngIf="sortKey === 'stop'">{{ sortAsc ? '▲' : '▼' }}</span></th>
                  <th (click)="toggleSort('target')" class="sortable-th">Target <span *ngIf="sortKey === 'target'">{{ sortAsc ? '▲' : '▼' }}</span></th>
                  <th (click)="toggleSort('opened')" class="sortable-th">Opened <span *ngIf="sortKey === 'opened'">{{ sortAsc ? '▲' : '▼' }}</span></th>
                  <th>Age</th>
                  <th (click)="toggleSort('status')" class="sortable-th" style="text-align: center;">Status <span *ngIf="sortKey === 'status'">{{ sortAsc ? '▲' : '▼' }}</span></th>
                  <th style="text-align: center;">Links</th>
                </tr>
              </thead>
              <tbody>
                <tr *ngFor="let t of filteredActiveShorts" (click)="openModal(t)" style="cursor: pointer;">
                  <td class="sym-cell">
                    <a [href]="'https://www.tradingview.com/chart/?symbol=' + t.symbol" target="_blank" class="symbol-link" (click)="$event.stopPropagation()">{{ t.symbol }}</a>
                  </td>
                  <td style="text-align: center;">
                    <span class="source-tag" [class.pending]="t.open?.entrySource === 'PENDING'" [title]="getSourceExplanation(t.open?.entrySource)">
                      {{ t.open?.entrySource === 'PENDING' ? 'P' : 'F' }}
                    </span>
                  </td>
                  <td class="price-col">\${{ getEntryPrice(t) | number: '1.2-2' }}</td>
                  <td class="price-col">{{ getCurrentPriceDisplay(t) }}</td>
                  <td class="pct-col" [class.positive]="t.movePct >= 0" [class.negative]="t.movePct < 0">
                    {{ t.movePct | number: '1.2-2' }}%
                  </td>
                  <td class="price-col stop-col" style="color: #f87171;">\${{ t.open?.stop_price | number: '1.2-2' }}</td>
                  <td class="price-col target-col" style="color: #34d399; font-weight: 500;">\${{ getTargetPrice(t.open) | number: '1.2-2' }}</td>
                  <td class="time-col">{{ t.openedTime | date: 'MM/dd hh:mm a' }}</td>
                  <td class="time-col">{{ t.ageText }}</td>
                  <td style="text-align: center;">
                    <span class="status-lbl" [class]="getDerivedStatus(t).toLowerCase().replace(' ', '-')">{{ getStatusDisplay(getDerivedStatus(t)) }}</span>
                  </td>
                  <td class="actions-cell">
                    <button class="mini-btn info" type="button" (click)="openModal(t); $event.stopPropagation()" aria-label="Details">ℹ️</button>
                    <a [href]="'https://www.tradingview.com/chart/?symbol=' + t.symbol" target="_blank" class="mini-btn tv" title="TradingView" (click)="$event.stopPropagation()">TV</a>
                    <a [href]="'https://finviz.com/quote.ashx?t=' + t.symbol" target="_blank" class="mini-btn fz" title="Finviz" (click)="$event.stopPropagation()">FZ</a>
                  </td>
                </tr>
                <tr *ngIf="filteredActiveShorts.length === 0">
                  <td colspan="11" class="empty-row">No active shorts match filters.</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <!-- Recent Exits full width table -->
        <div class="exits-table-wrapper" *ngIf="viewClosedToday || viewOlderHistory">
          <div class="table-title exits-title">
            Recent Closed Trades / Exits
          </div>
          <div class="table-scroll">
            <table class="screener-table">
              <thead>
                <tr>
                  <th (click)="toggleSort('symbol')" class="sortable-th">Symbol <span *ngIf="sortKey === 'symbol'">{{ sortAsc ? '▲' : '▼' }}</span></th>
                  <th>Side</th>
                  <th (click)="toggleSort('source')" class="sortable-th">Entry Src <span *ngIf="sortKey === 'source'">{{ sortAsc ? '▲' : '▼' }}</span></th>
                  <th>Qty</th>
                  <th (click)="toggleSort('entry')" class="sortable-th">Entry <span *ngIf="sortKey === 'entry'">{{ sortAsc ? '▲' : '▼' }}</span></th>
                  <th>Exit Price</th>
                  <th>P/L / Share</th>
                  <th>Paper P/L $</th>
                  <th (click)="toggleSort('result')" class="sortable-th">Result % <span *ngIf="sortKey === 'result'">{{ sortAsc ? '▲' : '▼' }}</span></th>
                  <th>Exit Reason</th>
                  <th (click)="toggleSort('opened')" class="sortable-th">Opened <span *ngIf="sortKey === 'opened'">{{ sortAsc ? '▲' : '▼' }}</span></th>
                  <th (click)="toggleSort('closed')" class="sortable-th">Closed <span *ngIf="sortKey === 'closed'">{{ sortAsc ? '▲' : '▼' }}</span></th>
                  <th>Hold Time</th>
                  <th (click)="toggleSort('status')" class="sortable-th" style="text-align: center;">Status <span *ngIf="sortKey === 'status'">{{ sortAsc ? '▲' : '▼' }}</span></th>
                  <th style="text-align: center;">Links</th>
                </tr>
              </thead>
              <tbody>
                <tr *ngFor="let t of filteredClosedTrades" (click)="openModal(t)" style="cursor: pointer;">
                  <td class="sym-cell">
                    <a [href]="'https://www.tradingview.com/chart/?symbol=' + t.symbol" target="_blank" class="symbol-link" (click)="$event.stopPropagation()">{{ t.symbol }}</a>
                  </td>
                  <td>
                    <span class="side-tag" [class.long]="t.side === 'LONG'" [class.short]="t.side === 'SHORT'">
                      {{ t.side }}
                    </span>
                  </td>
                  <td>{{ t.open?.entrySource || 'ORPHAN' }}</td>
                  <td class="price-col">{{ t.quantity }}</td>
                  <td class="price-col">\${{ getEntryPrice(t) | number: '1.2-2' }}</td>
                  <td class="price-col">\${{ t.modeledExitPrice | number: '1.2-2' }}</td>
                  <td class="price-col" [class.positive]="t.plPerShare !== undefined && t.plPerShare > 0" [class.negative]="t.plPerShare !== undefined && t.plPerShare < 0">
                    \${{ t.plPerShare | number: '1.2-2' }}
                  </td>
                  <td class="price-col" [class.positive]="t.paperPl !== undefined && t.paperPl > 0" [class.negative]="t.paperPl !== undefined && t.paperPl < 0">
                    \${{ t.paperPl | number: '1.2-2' }}
                  </td>
                  <td class="pct-col" [class.positive]="t.resultPct !== undefined && t.resultPct >= 0" [class.negative]="t.resultPct !== undefined && t.resultPct < 0">
                    {{ t.resultPct !== undefined ? (t.resultPct | number: '1.2-2') + '%' : 'N/A' }}
                  </td>
                  <td>
                    <span class="exit-reason-badge" [class]="resolveReasonCategory(t.close?.primaryReason).toLowerCase()" [title]="getReasonExplanation(t.close?.primaryReason) + ' (' + t.fillBasis + ')'">
                      {{ getExitReasonShortCode(t.close?.primaryReason) }}
                    </span>
                  </td>
                  <td class="time-col">{{ t.openedTime | date: 'MM/dd hh:mm a' }}</td>
                  <td class="time-col">{{ t.closedTime | date: 'MM/dd hh:mm a' }}</td>
                  <td class="time-col">{{ t.holdTimeText || 'N/A' }}</td>
                  <td style="text-align: center;">
                    <span class="status-lbl" [class]="t.close?.status">{{ getStatusDisplay(getDerivedStatus(t)) }}</span>
                  </td>
                  <td class="actions-cell">
                    <button class="mini-btn info" type="button" (click)="openModal(t); $event.stopPropagation()" aria-label="Details">ℹ️</button>
                    <a [href]="'https://www.tradingview.com/chart/?symbol=' + t.symbol" target="_blank" class="mini-btn tv" title="TradingView" (click)="$event.stopPropagation()">TV</a>
                    <a [href]="'https://finviz.com/quote.ashx?t=' + t.symbol" target="_blank" class="mini-btn fz" title="Finviz" (click)="$event.stopPropagation()">FZ</a>
                  </td>
                </tr>
                <tr *ngIf="filteredClosedTrades.length === 0">
                  <td colspan="15" class="empty-row">No closed trades match filters.</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

      </div>

      <!-- Historical Performance Section (Section 15 requirement) -->
      <div class="historical-section" style="margin-top: 24px; background: #161a22; border: 1px solid #27272a; border-radius: 8px; padding: 16px;">
        <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #2d3139; padding-bottom: 10px; margin-bottom: 16px;">
          <h3 style="margin: 0; font-size: 1rem; color: #e5e7eb; display: flex; align-items: center; gap: 8px;">
            📊 Daily Performance History
          </h3>
          <div style="display: flex; align-items: center; gap: 12px;">
            <select [(ngModel)]="selectedDays" (change)="fetchHistoricalPerformance()" style="background: #0f1115; border: 1px solid #27272a; color: #e5e7eb; padding: 4px 8px; border-radius: 4px; font-size: 0.75rem;">
              <option [value]="7">Last 7 Days</option>
              <option [value]="30">Last 30 Days</option>
              <option [value]="90">Last 90 Days</option>
              <option [value]="365">Last 365 Days</option>
            </select>
            <button (click)="exportHistoryCSV()" style="background: #1e293b; color: #cbd5e1; border: 1px solid #334155; padding: 4px 10px; border-radius: 4px; font-size: 0.75rem; cursor: pointer; display: flex; align-items: center; gap: 4px;">
              📥 Export CSV
            </button>
          </div>
        </div>

        <!-- Historical Summary Cards -->
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(130px, 1fr)); gap: 10px; margin-bottom: 16px;">
          <div style="background: #0f1115; border: 1px solid #1f2229; border-radius: 4px; padding: 10px; text-align: center;">
            <span style="font-size: 0.65rem; color: #9ca3af; display: block;">Total Realized P/L</span>
            <span style="font-size: 1rem; font-weight: bold; display: block; margin-top: 2px;" [class.positive]="historySummary.totalRealized > 0" [class.negative]="historySummary.totalRealized < 0">
              \${{ historySummary.totalRealized | number: '1.2-2' }}
            </span>
          </div>
          <div style="background: #0f1115; border: 1px solid #1f2229; border-radius: 4px; padding: 10px; text-align: center;">
            <span style="font-size: 0.65rem; color: #9ca3af; display: block;">Overall Win Rate</span>
            <span style="font-size: 1rem; font-weight: bold; color: #e5e7eb; display: block; margin-top: 2px;">
              {{ historySummary.winRate | number: '1.1-1' }}%
            </span>
          </div>
          <div style="background: #0f1115; border: 1px solid #1f2229; border-radius: 4px; padding: 10px; text-align: center;">
            <span style="font-size: 0.65rem; color: #9ca3af; display: block;">Profit Factor</span>
            <span style="font-size: 1rem; font-weight: bold; color: #e5e7eb; display: block; margin-top: 2px;">
              {{ historySummary.profitFactor !== null ? (historySummary.profitFactor | number: '1.2-2') : 'N/A' }}
            </span>
          </div>
          <div style="background: #0f1115; border: 1px solid #1f2229; border-radius: 4px; padding: 10px; text-align: center;">
            <span style="font-size: 0.65rem; color: #9ca3af; display: block;">Closed Trades</span>
            <span style="font-size: 1rem; font-weight: bold; color: #e5e7eb; display: block; margin-top: 2px;">
              {{ historySummary.totalClosed }}
            </span>
          </div>
          <div style="background: #0f1115; border: 1px solid #1f2229; border-radius: 4px; padding: 10px; text-align: center;">
            <span style="font-size: 0.65rem; color: #9ca3af; display: block;">Avg Daily P/L</span>
            <span style="font-size: 1rem; font-weight: bold; display: block; margin-top: 2px;" [class.positive]="historySummary.avgDailyPl > 0" [class.negative]="historySummary.avgDailyPl < 0">
              \${{ historySummary.avgDailyPl | number: '1.2-2' }}
            </span>
          </div>
          <div style="background: #0f1115; border: 1px solid #1f2229; border-radius: 4px; padding: 10px; text-align: center;">
            <span style="font-size: 0.65rem; color: #9ca3af; display: block;">Best / Worst Day</span>
            <span style="font-size: 0.75rem; font-weight: bold; display: block; margin-top: 2px;">
              <span class="positive">\${{ historySummary.bestDay | number: '1.0-0' }}</span> / 
              <span class="negative">\${{ historySummary.worstDay | number: '1.0-0' }}</span>
            </span>
          </div>
        </div>

        <!-- History Table -->
        <div style="overflow-x: auto;">
          <table class="screener-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Ver</th>
                <th style="text-align: center;">Trades</th>
                <th style="text-align: center;">W / L</th>
                <th style="text-align: center;">Win %</th>
                <th style="text-align: center;">T / S / X / E</th>
                <th style="text-align: right;">Gross Deployed</th>
                <th style="text-align: right;">Peak Capital</th>
                <th style="text-align: right;">Realized P/L</th>
                <th style="text-align: right;">Return %</th>
                <th style="text-align: center;">Status</th>
              </tr>
            </thead>
            <tbody>
              <tr *ngFor="let row of historicalHistory">
                <td style="font-family: monospace; font-weight: bold;">{{ row.trade_date }}</td>
                <td style="font-size: 0.7rem; color: #9ca3af;">{{ row.strategy_version }}</td>
                <td style="text-align: center;">{{ row.opened_trades }}</td>
                <td style="text-align: center; color: #9ca3af;">
                  {{ row.winning_trades }}W - {{ row.losing_trades }}L
                </td>
                <td style="text-align: center; font-weight: 500;">
                  {{ row.win_rate_pct !== null ? (row.win_rate_pct | number: '1.1-1') + '%' : '--' }}
                </td>
                <td style="text-align: center; font-size: 0.7rem; color: #9ca3af;">
                  {{ row.target_exits }}T / {{ row.stop_exits }}S / {{ row.structure_exits }}X / {{ row.eod_exits }}E
                </td>
                <td style="text-align: right; font-family: monospace;">\${{ row.gross_deployed_capital | number: '1.2-2' }}</td>
                <td style="text-align: right; font-family: monospace;">\${{ row.peak_concurrent_capital | number: '1.2-2' }}</td>
                <td style="text-align: right; font-family: monospace; font-weight: 500;" [class.positive]="row.realized_paper_pl > 0" [class.negative]="row.realized_paper_pl < 0">
                  \${{ row.realized_paper_pl | number: '1.2-2' }}
                </td>
                <td style="text-align: right; font-family: monospace;" [class.positive]="row.return_on_peak_capital_pct > 0" [class.negative]="row.return_on_peak_capital_pct < 0">
                  {{ row.return_on_peak_capital_pct !== null ? (row.return_on_peak_capital_pct | number: '1.2-2') + '%' : '--' }}
                </td>
                <td style="text-align: center;">
                  <span style="font-size: 0.65rem; font-weight: bold; padding: 2px 6px; border-radius: 4px;" 
                        [style.background]="row.is_final ? 'rgba(74, 222, 128, 0.08)' : 'rgba(245, 158, 11, 0.08)'"
                        [style.color]="row.is_final ? '#4ade80' : '#fbbf24'">
                    {{ row.is_final ? 'FINAL' : 'UNFINALIZED' }}
                  </span>
                </td>
              </tr>
              <tr *ngIf="historicalHistory.length === 0">
                <td colspan="11" class="empty-row">No historical daily performance records found.</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <!-- Trade Plan Details Modal Overlay -->
      <div class="modal-overlay" *ngIf="selectedTrade" (click)="closeModal()">
        <div class="modal-card" (click)="$event.stopPropagation()">
          <div class="modal-header">
            <span class="modal-title">
              <span class="modal-symbol">{{ selectedTrade.symbol }}</span>
              <span class="modal-strategy">(SmartTrend Core)</span>
              <span class="modal-direction" [class.bullish]="selectedTrade.side === 'LONG'" [class.bearish]="selectedTrade.side === 'SHORT'">
                {{ selectedTrade.side }}
              </span>
            </span>
            <button class="close-btn" (click)="closeModal()">✖</button>
          </div>
          
          <div class="modal-body">
            <div class="alert-box warning-alert" *ngIf="selectedTrade.open && selectedTrade.open.trade_plan_quality === 'wide_risk'">
              ⚠️ <strong>Wide Risk Warning:</strong> Stop loss is more than 2% away from entry. Reduce size.
            </div>
            <div class="alert-box danger-alert" *ngIf="selectedTrade.open && selectedTrade.open.trade_plan_quality === 'invalid'">
              🚨 <strong>Invalid Trade Plan:</strong> Plan is invalid. {{ selectedTrade.open.invalidation_reason || 'Stop is not positioned correctly.' }}
            </div>

            <div class="details-grid">
              <div class="detail-row">
                <span class="detail-label">Trade ID:</span>
                <span class="detail-val">{{ selectedTrade.tradeId }}</span>
              </div>
              <div class="detail-row">
                <span class="detail-label">State/Type:</span>
                <span class="detail-val">{{ selectedTrade.type }}</span>
              </div>
              <div class="detail-row" *ngIf="selectedTrade.open">
                <span class="detail-label">Entry Source:</span>
                <span class="detail-val">{{ selectedTrade.open.entrySource }}</span>
              </div>
              <div class="detail-row">
                <span class="detail-label">Quantity (Paper):</span>
                <span class="detail-val">{{ selectedTrade.quantity }} shares</span>
              </div>
              <div class="detail-row">
                <span class="detail-label">Notional Value:</span>
                <span class="detail-val">\${{ selectedTrade.tradeCapital | number: '1.2-2' }}</span>
              </div>
              <div class="detail-row">
                <span class="detail-label">Estimated Entry:</span>
                <span class="detail-val">\${{ getEntryPrice(selectedTrade) | number: '1.2-2' }}</span>
              </div>
              <div class="detail-row" *ngIf="selectedTrade.open?.stop_price">
                <span class="detail-label">Stop Loss:</span>
                <span class="detail-val" style="color: #f87171;">\${{ selectedTrade.open?.stop_price | number: '1.2-2' }}</span>
              </div>
              <div class="detail-row" *ngIf="selectedTrade.open">
                <span class="detail-label">Target Level (T1):</span>
                <span class="detail-val" style="color: #34d399;">\${{ getTargetPrice(selectedTrade.open) | number: '1.2-2' }}</span>
              </div>
              <div class="detail-row" *ngIf="selectedTrade.type === 'ACTIVE'">
                <span class="detail-label">FMP Live Price:</span>
                <span class="detail-val">{{ getCurrentPriceDisplay(selectedTrade) }}</span>
              </div>
              <div class="detail-row" *ngIf="selectedTrade.type === 'CLOSED'">
                <span class="detail-label">Exit Price:</span>
                <span class="detail-val" style="font-weight: bold;">\${{ selectedTrade.modeledExitPrice | number: '1.2-2' }}</span>
              </div>
              <div class="detail-row" *ngIf="selectedTrade.type === 'CLOSED'">
                <span class="detail-label">Exit Reason:</span>
                <span class="detail-val">{{ selectedTrade.close?.primaryReason || 'Unknown' }}</span>
              </div>
              <div class="detail-row" *ngIf="selectedTrade.type === 'CLOSED'">
                <span class="detail-label">Fill Basis:</span>
                <span class="detail-val">{{ selectedTrade.fillBasis }}</span>
              </div>
              <div class="detail-row" *ngIf="selectedTrade.type === 'CLOSED'">
                <span class="detail-label">Realized P/L:</span>
                <span class="detail-val" [class.positive]="selectedTrade.paperPl !== undefined && selectedTrade.paperPl > 0" [class.negative]="selectedTrade.paperPl !== undefined && selectedTrade.paperPl < 0">
                  \${{ selectedTrade.paperPl | number: '1.2-2' }} ({{ selectedTrade.resultPct | number: '1.2-2' }}%)
                </span>
              </div>
              <div class="detail-row" *ngIf="selectedTrade.type === 'ACTIVE' && selectedTrade.unrealizedPaperPl !== undefined">
                <span class="detail-label">Unrealized P/L:</span>
                <span class="detail-val" [class.positive]="selectedTrade.unrealizedPaperPl > 0" [class.negative]="selectedTrade.unrealizedPaperPl < 0">
                  \${{ selectedTrade.unrealizedPaperPl | number: '1.2-2' }} ({{ selectedTrade.movePct | number: '1.2-2' }}%)
                </span>
              </div>
              <div class="detail-row" *ngIf="selectedTrade.openedTime">
                <span class="detail-label">Opened At:</span>
                <span class="detail-val">{{ selectedTrade.openedTime | date: 'yyyy-MM-dd HH:mm:ss z' }}</span>
              </div>
              <div class="detail-row" *ngIf="selectedTrade.closedTime">
                <span class="detail-label">Closed At:</span>
                <span class="detail-val">{{ selectedTrade.closedTime | date: 'yyyy-MM-dd HH:mm:ss z' }}</span>
              </div>
            </div>

            <div style="margin-top: 14px; border-top: 1px solid #22252a; padding-top: 10px; font-size: 0.65rem; color: #6b7280;">
              <span *ngIf="selectedTrade.type === 'CLOSED'">{{ getFillBasisExplanation(selectedTrade.fillBasis) }}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .screener-container {
      background: #090b0e;
      color: #e5e7eb;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
      padding: 16px;
      min-height: 100%;
    }
    
    .screener-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 16px;
      border-bottom: 1px solid #1a1e27;
      padding-bottom: 12px;
    }
    
    .warning-badge {
      background: rgba(239, 68, 68, 0.08);
      color: #ef4444;
      font-size: 0.65rem;
      font-weight: 600;
      padding: 2px 8px;
      border-radius: 4px;
      border: 1px solid rgba(239, 68, 68, 0.2);
    }
    
    .manual-refresh-btn {
      background: #1e293b;
      color: #f1f5f9;
      border: 1px solid #334155;
      padding: 6px 12px;
      border-radius: 4px;
      font-size: 0.75rem;
      cursor: pointer;
      font-weight: 500;
    }
    
    .manual-refresh-btn:hover:not(:disabled) {
      background: #334155;
    }
    
    .manual-refresh-btn:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }
    
    .refresh-indicator {
      font-size: 0.7rem;
      color: #10b981;
    }
    
    .refresh-indicator.syncing {
      color: #3b82f6;
    }
    
    .last-updated {
      font-size: 0.7rem;
      color: #6b7280;
    }
    
    /* Summary strip */
    .summary-strip {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(110px, 1fr));
      gap: 10px;
      margin-bottom: 16px;
    }
    
    .summary-card {
      background: #111317;
      border: 1px solid #1f2229;
      border-radius: 6px;
      padding: 10px;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
    }
    
    .card-val {
      font-size: 1.1rem;
      font-weight: bold;
      color: #f3f4f6;
    }
    
    .card-val.positive {
      color: #34d399;
    }
    
    .card-val.negative {
      color: #f87171;
    }
    
    .card-lbl {
      font-size: 0.62rem;
      color: #9ca3af;
      margin-top: 4px;
      text-transform: uppercase;
      letter-spacing: 0.02em;
    }
    
    /* Filter Panel */
    .filter-panel {
      background: #111317;
      border: 1px solid #1f2229;
      border-radius: 6px;
      padding: 12px;
      margin-bottom: 16px;
    }
    
    .search-box {
      margin-bottom: 10px;
    }
    
    .search-input {
      width: 100%;
      background: #080a0c;
      border: 1px solid #27272a;
      color: #e5e7eb;
      padding: 6px 12px;
      border-radius: 4px;
      font-size: 0.75rem;
      box-sizing: border-box;
    }
    
    .search-input:focus {
      outline: none;
      border-color: #3b82f6;
    }
    
    .filters-row {
      display: flex;
      flex-wrap: wrap;
      gap: 16px;
      border-bottom: 1px solid #1f2229;
      padding-bottom: 8px;
      margin-bottom: 8px;
    }
    
    .filters-row:last-child {
      border-bottom: none;
      padding-bottom: 0;
      margin-bottom: 0;
    }
    
    .filter-group {
      display: flex;
      align-items: center;
      gap: 10px;
      flex-wrap: wrap;
    }
    
    .group-label {
      font-size: 0.7rem;
      font-weight: 600;
      color: #6b7280;
      text-transform: uppercase;
    }
    
    .checkbox-label {
      font-size: 0.72rem;
      display: flex;
      align-items: center;
      gap: 4px;
      color: #d1d5db;
    }
    
    .checkbox-label input {
      margin: 0;
      accent-color: #3b82f6;
    }
    
    /* Spinner / Empty states */
    .spinner-container {
      display: flex;
      flex-direction: column;
      align-items: center;
      padding: 40px;
      color: #9ca3af;
      font-size: 0.8rem;
    }
    .spinner-container p {
      margin-top: 10px;
    }
    
    .error-container {
      padding: 16px;
      background: rgba(239, 68, 68, 0.05);
      border: 1px solid rgba(239, 68, 68, 0.15);
      border-radius: 6px;
      margin-bottom: 16px;
      text-align: center;
    }
    .error-text {
      color: #f87171;
      font-size: 0.8rem;
      margin-bottom: 10px;
    }
    
    .no-data {
      padding: 30px;
      background: #111317;
      border: 1px dashed #27272a;
      border-radius: 6px;
      text-align: center;
      color: #9ca3af;
      font-size: 0.78rem;
    }
    
    /* Tables Grid */
    .tables-grid {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 16px;
    }
    
    .active-table-wrapper {
      background: #111317;
      border: 1px solid #1f2229;
      border-radius: 6px;
      overflow: hidden;
    }
    
    .exits-table-wrapper {
      grid-column: span 2;
      background: #111317;
      border: 1px solid #1f2229;
      border-radius: 6px;
      overflow: hidden;
    }
    
    .table-title {
      padding: 8px 12px;
      font-size: 0.78rem;
      font-weight: 600;
      letter-spacing: 0.02em;
    }
    
    .bullish-title {
      background: rgba(16, 185, 129, 0.08);
      color: #34d399;
      border-bottom: 1px solid rgba(16, 185, 129, 0.15);
    }
    
    .bearish-title {
      background: rgba(239, 68, 68, 0.08);
      color: #f87171;
      border-bottom: 1px solid rgba(239, 68, 68, 0.15);
    }
    
    .exits-title {
      background: #1e293b;
      color: #e2e8f0;
      border-bottom: 1px solid #334155;
    }
    
    .table-scroll {
      overflow-x: auto;
      max-height: 400px;
      overflow-y: auto;
    }
    
    .screener-table {
      width: 100%;
      border-collapse: collapse;
      font-size: 0.72rem;
      text-align: left;
    }
    
    .screener-table th {
      background: #090b0e;
      color: #9ca3af;
      font-weight: 500;
      padding: 6px 10px;
      border-bottom: 1px solid #1f2229;
      position: sticky;
      top: 0;
      z-index: 10;
    }
    
    .sortable-th {
      cursor: pointer;
    }
    .sortable-th:hover {
      color: #fff;
      background: #111317;
    }
    
    .screener-table td {
      padding: 6px 10px;
      border-bottom: 1px solid #16181f;
      color: #cbd5e1;
    }
    
    .screener-table tbody tr:hover {
      background: #14171f;
    }
    
    .sym-cell a {
      color: #60a5fa;
      text-decoration: none;
      font-weight: 600;
    }
    .sym-cell a:hover {
      text-decoration: underline;
    }
    
    .source-tag {
      font-size: 0.55rem;
      background: rgba(59, 130, 246, 0.1);
      color: #60a5fa;
      padding: 1px 4px;
      border-radius: 3px;
      border: 1px solid rgba(59, 130, 246, 0.2);
    }
    
    .source-tag.pending {
      background: rgba(245, 158, 11, 0.1);
      color: #fbbf24;
      border-color: rgba(245, 158, 11, 0.2);
    }
    
    .side-tag {
      font-size: 0.6rem;
      font-weight: 600;
      padding: 1px 4px;
      border-radius: 3px;
    }
    .side-tag.long {
      color: #34d399;
      background: rgba(52, 211, 153, 0.08);
    }
    .side-tag.short {
      color: #f87171;
      background: rgba(248, 113, 113, 0.08);
    }
    
    .price-col {
      font-family: monospace;
      text-align: right;
    }
    
    .pct-col {
      font-family: monospace;
      font-weight: 500;
      text-align: right;
    }
    
    .positive {
      color: #34d399 !important;
    }
    
    .negative {
      color: #f87171 !important;
    }
    
    .time-col {
      color: #6b7280;
      font-size: 0.68rem;
    }
    
    .status-lbl {
      font-size: 0.58rem;
      font-weight: 600;
      padding: 2px 6px;
      border-radius: 4px;
      display: inline-block;
      text-transform: uppercase;
    }
    
    .status-lbl.fresh {
      background: rgba(16, 185, 129, 0.08);
      color: #10b981;
    }
    
    .status-lbl.target-touched {
      background: rgba(16, 185, 129, 0.08);
      color: #10b981;
      border: 1px dashed #10b981;
    }
    
    .status-lbl.stop-touched {
      background: rgba(239, 68, 68, 0.08);
      color: #ef4444;
      border: 1px dashed #ef4444;
    }
    
    .status-lbl.exit-alert-missing {
      background: rgba(245, 158, 11, 0.08);
      color: #fbbf24;
      border: 1px solid rgba(245, 158, 11, 0.2);
    }
    
    .status-lbl.stale {
      background: rgba(107, 114, 128, 0.1);
      color: #9ca3af;
    }
    
    .exit-reason-badge {
      font-size: 0.65rem;
      font-weight: bold;
      padding: 2px 6px;
      border-radius: 4px;
      color: #fff;
    }
    
    .exit-reason-badge.target {
      background: #10b981;
    }
    
    .exit-reason-badge.stop {
      background: #ef4444;
    }
    
    .exit-reason-badge.ema_vwap_loss {
      background: #3b82f6;
    }
    
    .exit-reason-badge.end_of_day {
      background: #eab308;
      color: #0f172a;
    }
    
    .exit-reason-badge.unknown {
      background: #6b7280;
    }
    
    .empty-row {
      text-align: center;
      padding: 20px;
      color: #6b7280;
      font-style: italic;
    }
    
    .actions-cell {
      display: flex;
      gap: 4px;
      justify-content: center;
    }
    .mini-btn {
      background: #1a1e27;
      color: #d1d5db;
      border: 1px solid #27272a;
      font-size: 0.6rem;
      padding: 1px 4px;
      border-radius: 3px;
      cursor: pointer;
      text-decoration: none;
      display: inline-flex;
      align-items: center;
    }
    .mini-btn:hover {
      background: #27272a;
      color: #fff;
    }
    
    /* Modal */
    .modal-overlay {
      position: fixed;
      top: 0;
      left: 0;
      width: 100vw;
      height: 100vh;
      background: rgba(0,0,0,0.6);
      backdrop-filter: blur(4px);
      display: flex;
      justify-content: center;
      align-items: center;
      z-index: 1000;
    }
    .modal-card {
      background: #161a22;
      border: 1px solid #2d3139;
      border-radius: 8px;
      width: 90%;
      max-width: 500px;
      overflow: hidden;
      box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.5);
    }
    .modal-header {
      padding: 10px 14px;
      border-bottom: 1px solid #22252a;
      display: flex;
      justify-content: space-between;
      align-items: center;
      background: #1c212c;
    }
    .modal-title {
      font-weight: 500;
      font-size: 0.85rem;
      display: flex;
      align-items: center;
      gap: 6px;
    }
    .modal-symbol {
      color: #fff;
      font-weight: bold;
    }
    .modal-strategy {
      color: #9ca3af;
      font-size: 0.72rem;
    }
    .modal-direction {
      font-size: 0.65rem;
      font-weight: bold;
      padding: 1px 5px;
      border-radius: 3px;
    }
    .modal-direction.bullish {
      color: #4ade80;
      background: rgba(74, 222, 128, 0.08);
    }
    .modal-direction.bearish {
      color: #f87171;
      background: rgba(248, 113, 113, 0.08);
    }
    .close-btn {
      background: transparent;
      border: none;
      color: #9ca3af;
      font-size: 0.9rem;
      cursor: pointer;
    }
    .close-btn:hover {
      color: #fff;
    }
    .modal-body {
      padding: 14px;
      max-height: 80vh;
      overflow-y: auto;
    }
    
    .alert-box {
      padding: 8px 12px;
      border-radius: 4px;
      font-size: 0.75rem;
      margin-bottom: 12px;
    }
    .warning-alert {
      background: rgba(245, 158, 11, 0.08);
      color: #fbbf24;
      border: 1px solid rgba(245, 158, 11, 0.2);
    }
    .danger-alert {
      background: rgba(239, 68, 68, 0.08);
      color: #f87171;
      border: 1px solid rgba(239, 68, 68, 0.2);
    }
    
    .details-grid {
      display: grid;
      grid-template-columns: auto 1fr;
      row-gap: 6px;
      column-gap: 16px;
      font-size: 0.75rem;
    }
    .detail-row {
      display: contents;
    }
    .detail-label {
      color: #9ca3af;
      padding: 2px 0;
    }
    .detail-val {
      color: #e5e7eb;
      font-family: monospace;
      padding: 2px 0;
      text-align: right;
    }
    
    @media (max-width: 1024px) {
      .tables-grid {
        grid-template-columns: minmax(0, 1fr);
      }
      .exits-table-wrapper {
        grid-column: span 1;
      }
    }
  `]
})
export class SmartTrend implements OnInit, OnDestroy {
  allTrades: SmartTrendTrade[] = [];
  filteredActiveLongs: SmartTrendTrade[] = [];
  filteredActiveShorts: SmartTrendTrade[] = [];
  filteredClosedTrades: SmartTrendTrade[] = [];

  totalActiveLongs: number = 0;
  totalActiveShorts: number = 0;

  // Summary Strip Counts
  activeLongsCount = 0;
  activeShortsCount = 0;
  exitsTodayCount = 0;
  targetsTodayCount = 0;
  stopsTodayCount = 0;
  structureExitsTodayCount = 0;
  eodExitsTodayCount = 0;
  unknownExitsTodayCount = 0;

  // Realized Paper P/L Today
  paperPlToday: number = 0;
  winningTradesToday: number = 0;
  losingTradesToday: number = 0;

  // Extended Capital Dashboard Metrics
  activeCapitalNow = 0;
  grossCapitalDeployedToday = 0;
  peakConcurrentCapitalToday = 0;
  unrealizedPaperPlNow = 0;
  netPaperPlToday = 0;
  maxConcurrentTradesToday = 0;

  // Paper Settings
  paperAllocation: number = 10000;
  allocationLocked: boolean = false;
  lockedAllocation: number | null = null;
  webhookSecret: string = '';

  // Test Data Toggle
  showTestData: boolean = false;

  // Live prices mapping
  livePrices: { [symbol: string]: { price: number; time: number } } = {};
  isPollingQuotes = false;

  // Filter States
  searchQuery: string = '';

  viewActive: boolean = true;
  viewClosedToday: boolean = true;
  viewOlderHistory: boolean = false;
  viewOrphanExits: boolean = false;

  actionBuy: boolean = true;
  actionShort: boolean = true;
  actionExitLong: boolean = true;
  actionExitShort: boolean = true;

  sourceFresh: boolean = true;
  sourcePending: boolean = true;

  reasonTarget: boolean = true;
  reasonStop: boolean = true;
  reasonStructure: boolean = true;
  reasonEod: boolean = true;
  reasonUnknown: boolean = true;

  statusFresh: boolean = true;
  statusStale: boolean = true;

  // Sort State
  sortKey: string = 'opened';
  sortAsc: boolean = false;

  // UI State
  loading: boolean = false;
  errorMessage: string = '';
  lastUpdated: string = '';
  selectedTrade: SmartTrendTrade | null = null;

  // Historical Daily Performance History Properties
  historicalHistory: any[] = [];
  selectedDays: number = 30;
  selectedGroup: string = 'ALL';
  historySummary: any = {
    totalRealized: 0,
    totalClosed: 0,
    winRate: 0,
    grossProfit: 0,
    grossLoss: 0,
    profitFactor: null,
    bestDay: 0,
    worstDay: 0,
    avgDailyPl: 0
  };

  private destroy$ = new Subject<void>();

  constructor(
    private supabaseService: SupabaseService,
    private marketDataService: MarketDataService,
    private http: HttpClient,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit() {
    // 1. Fetch paper settings
    this.fetchPaperSettings();

    // 2. Fetch signals
    this.fetchData(false);

    // 3. Fetch historical performance
    this.fetchHistoricalPerformance();

    // Auto-refresh signals every 30 seconds
    interval(30000)
      .pipe(takeUntil(this.destroy$))
      .subscribe(() => {
        this.fetchData(false);
      });

    // Auto-poll active quotes every 30 seconds
    interval(30000)
      .pipe(takeUntil(this.destroy$))
      .subscribe(() => {
        this.pollActiveQuotes();
      });
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }

  fetchPaperSettings() {
    this.http.get<any>('/.netlify/functions/smarttrend-paper-settings').subscribe({
      next: (res) => {
        if (res && res.success && res.setting) {
          this.paperAllocation = res.setting.allocation_per_trade;
          this.allocationLocked = res.isLocked;
          this.lockedAllocation = res.lockedAllocation;
          
          this.updateDynamicFields();
          this.calculateSummary();
          this.applyFilters();
          this.cdr.detectChanges();
        }
      },
      error: (err) => {
        console.error('Failed to load paper settings:', err);
      }
    });
  }

  savePaperAllocation() {
    if (this.paperAllocation < 100) {
      alert('Allocation must be >= 100.');
      return;
    }

    const headers = { 'Authorization': this.webhookSecret };
    this.http.post<any>('/.netlify/functions/smarttrend-paper-settings', 
      { allocation: this.paperAllocation }, 
      { headers }
    ).subscribe({
      next: (res) => {
        if (res && res.success) {
          alert('Allocation setting saved successfully!');
          this.webhookSecret = '';
          this.fetchPaperSettings();
        } else {
          alert('Failed to save allocation: ' + (res.error || 'Unknown error'));
        }
      },
      error: (err) => {
        console.error('Save allocation error:', err);
        alert('Unauthorized or request failed. Make sure your Webhook Secret is correct.');
      }
    });
  }

  onAllocationChange() {
    if (this.paperAllocation < 100) this.paperAllocation = 100;
    localStorage.setItem('nss_smarttrend_allocation', String(this.paperAllocation));
    this.updateDynamicFields();
    this.calculateSummary();
    this.applyFilters();
  }

  fetchData(isManual: boolean = false) {
    if (this.loading) return;
    this.loading = true;
    if (isManual) {
      this.errorMessage = '';
    }

    this.supabaseService.getSmartTrendSignals()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (data) => {
          try {
            this.processSignals(data || []);
            const now = new Date();
            this.lastUpdated = now.toLocaleTimeString();
            this.errorMessage = '';
            
            // Re-fetch historical performance on manual refresh to sync up database entries
            if (isManual) {
              this.fetchHistoricalPerformance();
              this.fetchPaperSettings();
            }
          } catch (e) {
            console.error('Error processing SmartTrend signals:', e);
            this.errorMessage = 'Could not load SmartTrend signals.';
          } finally {
            this.loading = false;
            this.cdr.detectChanges();
          }
        },
        error: (err) => {
          console.error('Error fetching SmartTrend signals:', err);
          this.errorMessage = 'Could not load SmartTrend signals.';
          this.loading = false;
          this.cdr.detectChanges();
        }
      });
  }

  normalizeSignal(row: any): NormalizedSignal | null {
    if (!row) return null;
    let payload: any = {};
    if (row.raw_alert_payload) {
      if (typeof row.raw_alert_payload === 'string') {
        try {
          payload = JSON.parse(row.raw_alert_payload);
        } catch (e) {
          // ignore
        }
      } else if (typeof row.raw_alert_payload === 'object') {
        payload = row.raw_alert_payload;
      }
    }
    if (!payload) payload = {};

    let action = row.action || payload.event || '';
    if (typeof action === 'string') {
      action = action.toUpperCase();
    }

    if (action !== 'BUY' && action !== 'SHORT' && action !== 'EXIT_LONG' && action !== 'EXIT_SHORT') {
      return null;
    }

    const lifecycle = row.lifecycle || (action === 'EXIT_LONG' || action === 'EXIT_SHORT' ? 'CLOSE' : 'OPEN');
    const tradeId = row.trade_id || payload.tradeId || row.signal_id || '';
    const entrySource = row.entry_source || payload.entrySource || 'FRESH';
    const primaryReason = row.primary_reason || payload.primaryReason || '';
    const positionBefore = row.position_before !== undefined && row.position_before !== null ? row.position_before : (payload.positionBefore !== undefined ? payload.positionBefore : '');
    const positionAfter = row.position_after !== undefined && row.position_after !== null ? row.position_after : (payload.positionAfter !== undefined ? payload.positionAfter : '');
    const exitPrice = row.exit_price !== undefined && row.exit_price !== null
      ? Number(row.exit_price)
      : (payload.exitPrice !== undefined && payload.exitPrice !== null ? Number(payload.exitPrice) : null);

    return {
      ...row,
      action,
      lifecycle,
      tradeId,
      entrySource,
      primaryReason,
      positionBefore,
      positionAfter,
      raw_alert_payload: payload,
      exitPrice
    };
  }

  processSignals(rawSignals: any[]) {
    // 1. Normalize and filter
    let normalized = rawSignals
      .map(r => this.normalizeSignal(r))
      .filter(r => r !== null) as NormalizedSignal[];

    // Test Data toggle filters
    if (!this.showTestData) {
      normalized = normalized.filter(r => r.symbol !== 'STDEMO' && r.group_name !== 'NSS-SmartTrend-Dummy-Test');
    }

    // 2. Remove duplicate signal_id
    const seenSignalIds = new Set<string>();
    const unique: NormalizedSignal[] = [];
    for (const r of normalized) {
      if (!seenSignalIds.has(r.signal_id)) {
        seenSignalIds.add(r.signal_id);
        unique.push(r);
      }
    }

    // Helper to find newest row
    const getNewest = (a: NormalizedSignal, b: NormalizedSignal) => {
      const timeA = new Date(a.signal_bar_time).getTime();
      const timeB = new Date(b.signal_bar_time).getTime();
      if (timeA !== timeB) return timeA > timeB ? a : b;

      const alertA = new Date(a.alert_received_at || a.created_at || 0).getTime();
      const alertB = new Date(b.alert_received_at || b.created_at || 0).getTime();
      return alertA > alertB ? a : b;
    };

    // 3. Group by tradeId
    const groups = new Map<string, { open?: NormalizedSignal; close?: NormalizedSignal }>();
    for (const r of unique) {
      const tId = r.tradeId;
      if (!tId) continue;
      if (!groups.has(tId)) {
        groups.set(tId, {});
      }
      const g = groups.get(tId)!;
      if (r.lifecycle === 'OPEN') {
        g.open = g.open ? getNewest(g.open, r) : r;
      } else if (r.lifecycle === 'CLOSE') {
        g.close = g.close ? getNewest(g.close, r) : r;
      }
    }

    // 4. Construct trades
    const trades: SmartTrendTrade[] = [];
    for (const [tradeId, g] of groups.entries()) {
      let type: 'ACTIVE' | 'CLOSED' | 'ORPHAN' = 'ACTIVE';
      let side: 'LONG' | 'SHORT' = 'LONG';
      let symbol = '';
      let openedTime = '';
      let closedTime = '';
      let resultPct: number | undefined;
      let holdTimeText = '';
      
      let modeledExitPrice: number | null = null;
      let fillBasis: any = 'UNKNOWN';

      if (g.open && g.close) {
        type = 'CLOSED';
        side = g.open.action === 'BUY' ? 'LONG' : 'SHORT';
        symbol = g.open.symbol;
        openedTime = g.open.signal_bar_time;
        closedTime = g.close.signal_bar_time;

        const dummyTrade: SmartTrendTrade = {
          tradeId, open: g.open, close: g.close, type, side, symbol
        } as any;
        modeledExitPrice = this.getModeledExitPrice(dummyTrade);
        fillBasis = this.getFillBasis(dummyTrade);

        const entry = this.getEntryPrice(dummyTrade) || 1;
        const exit = modeledExitPrice || entry;
        if (side === 'LONG') {
          resultPct = ((exit - entry) / entry) * 100;
        } else {
          resultPct = ((entry - exit) / entry) * 100;
        }

        const ms = new Date(closedTime).getTime() - new Date(openedTime).getTime();
        holdTimeText = this.formatDuration(ms);
      } else if (g.open) {
        type = 'ACTIVE';
        side = g.open.action === 'BUY' ? 'LONG' : 'SHORT';
        symbol = g.open.symbol;
        openedTime = g.open.signal_bar_time;
      } else if (g.close) {
        type = 'ORPHAN';
        side = g.close.action === 'EXIT_LONG' ? 'LONG' : 'SHORT';
        symbol = g.close.symbol;
        closedTime = g.close.signal_bar_time;

        const dummyTrade: SmartTrendTrade = {
          tradeId, open: g.open, close: g.close, type, side, symbol
        } as any;
        modeledExitPrice = this.getModeledExitPrice(dummyTrade);
        fillBasis = this.getFillBasis(dummyTrade);

        const entry = this.getEntryPrice(dummyTrade) || 1;
        const exit = modeledExitPrice || entry;
        if (side === 'LONG') {
          resultPct = ((exit - entry) / entry) * 100;
        } else {
          resultPct = ((entry - exit) / entry) * 100;
        }
      }

      trades.push({
        tradeId,
        open: g.open,
        close: g.close,
        type,
        side,
        symbol,
        openedTime,
        closedTime,
        resultPct,
        holdTimeText,
        movePct: 0,
        ageText: '',
        modeledExitPrice,
        fillBasis
      });
    }

    this.allTrades = trades;
    
    // Poll quotes immediately to load FMP live prices
    this.pollActiveQuotes();
    
    this.updateDynamicFields();
    this.calculateSummary();
    this.applyFilters();
  }

  updateDynamicFields() {
    const now = Date.now();
    for (const t of this.allTrades) {
      const entry = this.getEntryPrice(t);
      if (t.type === 'ACTIVE' && t.open) {
        const livePrice = t.livePrice || t.open.current_price || entry;
        if (t.side === 'LONG') {
          t.movePct = entry > 0 ? ((livePrice - entry) / entry) * 100 : 0;
        } else {
          t.movePct = entry > 0 ? ((entry - livePrice) / entry) * 100 : 0;
        }

        const openedMs = new Date(t.openedTime!).getTime();
        t.ageText = this.formatDuration(now - openedMs);

        // Calculate dynamic TouchState
        const target = this.getTargetPrice(t.open);
        const stop = t.open.stop_price || 0;
        if (livePrice > 0) {
          if (t.side === 'LONG') {
            if (target > 0 && livePrice >= target) t.touchState = 'TARGET_TOUCHED';
            else if (stop > 0 && livePrice <= stop) t.touchState = 'STOP_TOUCHED';
            else t.touchState = 'NONE';
          } else {
            if (target > 0 && livePrice <= target) t.touchState = 'TARGET_TOUCHED';
            else if (stop > 0 && livePrice >= stop) t.touchState = 'STOP_TOUCHED';
            else t.touchState = 'NONE';
          }
        } else {
          t.touchState = 'NONE';
        }

        // Unrealized P/L calculation
        t.quantity = entry > 0 ? Math.floor(this.paperAllocation / entry) : 0;
        const plShare = t.side === 'LONG' ? (livePrice - entry) : (entry - livePrice);
        t.plPerShare = plShare;
        t.unrealizedPaperPl = t.quantity * plShare;
        t.tradeCapital = t.quantity * entry;

      } else if (t.type === 'CLOSED') {
        const exit = t.modeledExitPrice !== undefined && t.modeledExitPrice !== null ? t.modeledExitPrice : entry;
        t.quantity = entry > 0 ? Math.floor(this.paperAllocation / entry) : 0;
        t.plPerShare = t.side === 'LONG' ? (exit - entry) : (entry - exit);
        t.paperPl = t.quantity * t.plPerShare;
        t.tradeCapital = t.quantity * entry;
      }
    }
  }

  calculateSummary() {
    this.activeLongsCount = 0;
    this.activeShortsCount = 0;
    this.exitsTodayCount = 0;
    this.targetsTodayCount = 0;
    this.stopsTodayCount = 0;
    this.structureExitsTodayCount = 0;
    this.eodExitsTodayCount = 0;
    this.unknownExitsTodayCount = 0;

    this.paperPlToday = 0; // Realized P/L Today
    this.winningTradesToday = 0;
    this.losingTradesToday = 0;

    this.activeCapitalNow = 0;
    this.grossCapitalDeployedToday = 0;
    this.unrealizedPaperPlNow = 0;
    this.netPaperPlToday = 0;

    const todayET = this.getETDateString(new Date());

    for (const t of this.allTrades) {
      const entry = this.getEntryPrice(t);
      const qty = entry > 0 ? Math.floor(this.paperAllocation / entry) : 0;
      t.quantity = qty;
      const tradeCapital = qty * entry;
      t.tradeCapital = tradeCapital;

      if (t.type === 'ACTIVE') {
        if (t.side === 'LONG') this.activeLongsCount++;
        else if (t.side === 'SHORT') this.activeShortsCount++;
        
        this.activeCapitalNow += tradeCapital;

        // Unrealized calculation
        const livePrice = t.livePrice || (t.open ? t.open.current_price : entry) || entry;
        const plShare = t.side === 'LONG' ? (livePrice - entry) : (entry - livePrice);
        t.plPerShare = plShare;
        t.unrealizedPaperPl = qty * plShare;
        this.unrealizedPaperPlNow += t.unrealizedPaperPl || 0;

      } else if (t.type === 'CLOSED') {
        const openedDateStr = this.getETDateString(t.openedTime);
        if (openedDateStr === todayET) {
          this.grossCapitalDeployedToday += tradeCapital;
        }

        const isClosedToday = t.closedTime && this.isTodayInET(t.closedTime);
        if (isClosedToday) {
          this.exitsTodayCount++;
          const reason = t.close?.primaryReason || '';
          const cat = this.resolveReasonCategory(reason);
          if (cat === 'TARGET') this.targetsTodayCount++;
          else if (cat === 'STOP') this.stopsTodayCount++;
          else if (cat === 'EMA_VWAP_LOSS') this.structureExitsTodayCount++;
          else if (cat === 'END_OF_DAY') this.eodExitsTodayCount++;
          else this.unknownExitsTodayCount++;

          const exit = t.modeledExitPrice !== undefined && t.modeledExitPrice !== null ? t.modeledExitPrice : entry;
          const plShare = t.side === 'LONG' ? (exit - entry) : (entry - exit);
          t.plPerShare = plShare;
          t.paperPl = qty * plShare;
          this.paperPlToday += t.paperPl || 0; // Realized P/L Today

          if (t.paperPl > 0) this.winningTradesToday++;
          else if (t.paperPl < 0) this.losingTradesToday++;
        }
      }
    }

    this.netPaperPlToday = this.paperPlToday + this.unrealizedPaperPlNow;

    // Timeline calculation for peak concurrent capital & max concurrent trades today
    const events: { time: number; capChange: number; tradeChange: number; type: string }[] = [];
    for (const t of this.allTrades) {
      const openedDateStr = this.getETDateString(t.openedTime);
      if (openedDateStr === todayET && t.tradeCapital) {
        events.push({
          time: new Date(t.openedTime!).getTime(),
          capChange: t.tradeCapital,
          tradeChange: 1,
          type: 'OPEN'
        });
        if (t.closedTime && this.getETDateString(t.closedTime) === todayET) {
          events.push({
            time: new Date(t.closedTime).getTime(),
            capChange: -t.tradeCapital,
            tradeChange: -1,
            type: 'CLOSE'
          });
        }
      }
    }

    events.sort((a, b) => {
      if (a.time !== b.time) return a.time - b.time;
      return a.type === 'OPEN' ? -1 : 1; // Process OPEN before CLOSE
    });

    let runningCapital = 0;
    let peakCapital = 0;
    let runningTrades = 0;
    let maxTrades = 0;

    for (const ev of events) {
      runningCapital += ev.capChange;
      if (runningCapital > peakCapital) {
        peakCapital = runningCapital;
      }
      runningTrades += ev.tradeChange;
      if (runningTrades > maxTrades) {
        maxTrades = runningTrades;
      }
    }

    this.peakConcurrentCapitalToday = peakCapital;
    this.maxConcurrentTradesToday = maxTrades;
  }

  isTodayInET(dateStr: string): boolean {
    if (!dateStr) return false;
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return false;
    const etString = date.toLocaleDateString('en-US', { timeZone: 'America/New_York' });
    const todayString = new Date().toLocaleDateString('en-US', { timeZone: 'America/New_York' });
    return etString === todayString;
  }

  getETDateString(dateInput: string | Date | undefined): string {
    if (!dateInput) return '';
    const date = new Date(dateInput);
    if (isNaN(date.getTime())) return '';
    const formatter = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'America/New_York',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    });
    return formatter.format(date);
  }

  resolveReasonCategory(reason: string | undefined): 'TARGET' | 'STOP' | 'EMA_VWAP_LOSS' | 'END_OF_DAY' | 'UNKNOWN' {
    if (!reason) return 'UNKNOWN';
    const r = reason.toUpperCase();
    if (r.includes('TARGET') || r.includes('PROFIT')) return 'TARGET';
    if (r.includes('EMA') || r.includes('VWAP') || r.includes('STRUCTURE')) return 'EMA_VWAP_LOSS';
    if (r.includes('STOP') || r.includes('LOSS')) return 'STOP';
    if (r.includes('DAY') || r.includes('EOD') || r.includes('SESSION')) return 'END_OF_DAY';
    return 'UNKNOWN';
  }

  formatDuration(ms: number): string {
    if (isNaN(ms) || ms < 0) return '0m';
    const secs = Math.floor(ms / 1000);
    const mins = Math.floor(secs / 60);
    const hours = Math.floor(mins / 60);
    const days = Math.floor(hours / 24);

    if (days > 0) return `${days}d ${hours % 24}h`;
    if (hours > 0) return `${hours}h ${mins % 60}m`;
    return `${mins}m`;
  }

  getSourceExplanation(source: string | undefined): string {
    if (!source) return '';
    const s = source.toUpperCase();
    if (s.includes('PENDING')) {
      return 'Signal was detected while another trade or cooldown was active and was revalidated before entry.';
    }
    return 'Signal was actionable when first detected.';
  }

  getReasonExplanation(reason: string | undefined): string {
    if (!reason) return '';
    const cat = this.resolveReasonCategory(reason);
    if (cat === 'TARGET') return 'Configured profit target was reached.';
    if (cat === 'STOP') return 'ATR protective stop was reached.';
    if (cat === 'EMA_VWAP_LOSS') return 'Price lost the EMA9 and VWAP trade structure after the minimum hold period.';
    if (cat === 'END_OF_DAY') return 'Position was closed at the end of the regular trading session.';
    return 'Unknown or custom exit condition.';
  }

  getExitReasonShortCode(reason: string | undefined): string {
    if (!reason) return '?';
    const cat = this.resolveReasonCategory(reason);
    if (cat === 'TARGET') return 'T';
    if (cat === 'STOP') return 'S';
    if (cat === 'EMA_VWAP_LOSS') return 'X';
    if (cat === 'END_OF_DAY') return 'E';
    return '?';
  }

  getEntryPrice(t: SmartTrendTrade): number {
    if (t.open) {
      return t.open.trigger_price || t.open.entry_price_est || 0;
    }
    if (t.close) {
      return t.close.trigger_price || 0;
    }
    return 0;
  }

  getTargetPrice(open: NormalizedSignal | undefined): number {
    if (!open) return 0;
    return open.target1_price !== null && open.target1_price > 0 
      ? open.target1_price 
      : (open.target2_price || 0);
  }

  getModeledExitPrice(trade: SmartTrendTrade): number | null {
    const open = trade.open;
    const close = trade.close;

    if (close && close.raw_alert_payload?.fillBasis && close.exitPrice !== null && close.exitPrice > 0) {
      return close.exitPrice;
    }

    const reason = close?.primaryReason || '';
    const cat = this.resolveReasonCategory(reason);

    if (cat === 'TARGET') {
      if (open) {
        if (open.target1_price !== null && open.target1_price > 0) return open.target1_price;
        if (open.target2_price !== null && open.target2_price > 0) return open.target2_price;
      }
      return null;
    }

    if (cat === 'STOP') {
      if (open && open.stop_price !== null && open.stop_price > 0) return open.stop_price;
      return null;
    }

    if (cat === 'EMA_VWAP_LOSS' || cat === 'END_OF_DAY' || cat === 'UNKNOWN') {
      if (close) {
        if (close.exitPrice !== null && close.exitPrice > 0) return close.exitPrice;
        if (close.trigger_price !== null && close.trigger_price > 0) return close.trigger_price;
      }
      return null;
    }

    return null;
  }

  getFillBasis(trade: SmartTrendTrade): 'TARGET_LEVEL' | 'STOP_LEVEL' | 'EVENT_PRICE' | 'UNKNOWN' {
    const close = trade.close;
    if (close && close.raw_alert_payload?.fillBasis) {
      const fb = close.raw_alert_payload.fillBasis.toUpperCase();
      if (fb === 'TARGET_LEVEL' || fb === 'STOP_LEVEL' || fb === 'EVENT_PRICE') {
        return fb as any;
      }
    }
    const reason = close?.primaryReason || '';
    const cat = this.resolveReasonCategory(reason);
    if (cat === 'TARGET') return 'TARGET_LEVEL';
    if (cat === 'STOP') return 'STOP_LEVEL';
    if (cat === 'EMA_VWAP_LOSS' || cat === 'END_OF_DAY' || cat === 'UNKNOWN') {
      if (close && (close.exitPrice !== null || close.trigger_price !== null)) {
        return 'EVENT_PRICE';
      }
    }
    return 'UNKNOWN';
  }

  getDerivedStatus(t: SmartTrendTrade): string {
    if (t.type === 'CLOSED') return 'CLOSED';
    if (t.type === 'ORPHAN') return 'ORPHAN';
    
    const open = t.open;
    if (!open) return 'ORPHAN';

    const entry = this.getEntryPrice(t);
    const current = t.livePrice || open.current_price || entry;
    const target = this.getTargetPrice(open);
    const stop = open.stop_price || 0;

    if (current && entry > 0) {
      if (t.side === 'LONG') {
        if (target > 0 && current >= target) return 'TARGET TOUCHED';
        if (stop > 0 && current <= stop) return 'STOP TOUCHED';
      } else {
        if (target > 0 && current <= target) return 'TARGET TOUCHED';
        if (stop > 0 && current >= stop) return 'STOP TOUCHED';
      }
    }

    const openTimeStr = open.signal_bar_time;
    if (openTimeStr) {
      const openTime = new Date(openTimeStr);
      if (!isNaN(openTime.getTime())) {
        const nowET = new Date().toLocaleString("en-US", { timeZone: "America/New_York" });
        const openET = openTime.toLocaleString("en-US", { timeZone: "America/New_York" });
        
        const nowDateStr = new Date(nowET).toLocaleDateString();
        const openDateStr = new Date(openET).toLocaleDateString();
        
        const nowTimeStr = new Date(nowET).toTimeString().substring(0, 5); // "HH:MM"
        
        if (nowDateStr !== openDateStr || nowTimeStr > '16:00') {
          return 'EXIT ALERT MISSING';
        }
      }
    }

    const openTime = new Date(open.signal_bar_time);
    if (!isNaN(openTime.getTime())) {
      const ageMs = Date.now() - openTime.getTime();
      if (ageMs < 120 * 60 * 1000) {
        return 'FRESH';
      }
    }

    return 'STALE';
  }

  getStatusDisplay(status: string): string {
    if (status === 'TARGET TOUCHED') return 'TARGET TOUCHED — Awaiting Pine Exit';
    if (status === 'STOP TOUCHED') return 'STOP TOUCHED — Awaiting Pine Exit';
    return status;
  }

  getFillBasisExplanation(basis: string | undefined): string {
    if (basis === 'TARGET_LEVEL') return 'TARGET_LEVEL: Modeled paper fill at configured profit target (Not actual broker execution).';
    if (basis === 'STOP_LEVEL') return 'STOP_LEVEL: Modeled paper fill at configured protective stop loss (Not actual broker execution).';
    if (basis === 'EVENT_PRICE') return 'EVENT_PRICE: Exit filled at the event-specified transaction price.';
    return 'UNKNOWN: Unknown fill basis.';
  }

  pollActiveQuotes() {
    if (this.isPollingQuotes) return;
    
    // Find unique active symbols
    const activeSymbols = this.allTrades
      .filter(t => t.type === 'ACTIVE' && t.symbol)
      .map(t => t.symbol);

    if (activeSymbols.length === 0) {
      return;
    }

    this.isPollingQuotes = true;
    
    this.marketDataService.getBatchQuotes(activeSymbols, this.showTestData)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (quoteMap) => {
          for (const [sym, quote] of quoteMap.entries()) {
            if (quote.status === 'LIVE' || quote.status === 'STALE') {
              this.livePrices[sym] = {
                price: quote.price,
                time: quote.timestamp || Date.now()
              };
            }
            
            for (const t of this.allTrades) {
              if (t.type === 'ACTIVE' && t.symbol.toUpperCase() === sym) {
                t.livePrice = quote.price;
                t.livePriceUpdatedAt = quote.timestamp;
                t.quoteStatus = quote.status;
              }
            }
          }
          this.isPollingQuotes = false;
          this.updateDynamicFields();
          this.calculateSummary();
          this.applyFilters();
          this.cdr.detectChanges();
        },
        error: (err) => {
          console.error('[SmartTrend] Error fetching quotes:', err);
          this.isPollingQuotes = false;
        }
      });
  }

  getCurrentPriceDisplay(t: SmartTrendTrade): string {
    if (t.livePrice !== undefined && t.livePrice !== null && t.livePrice > 0) {
      const suffix = t.quoteStatus === 'STALE' ? ' (stale)' : 
                     t.quoteStatus === 'UNAVAILABLE' ? ' (unavail)' : 
                     t.quoteStatus === 'ERROR' ? ' (error)' : '';
      return '$' + t.livePrice.toFixed(2) + suffix;
    }
    if (t.open && t.open.current_price) {
      return '$' + t.open.current_price.toFixed(2) + ' (stale)';
    }
    return '--';
  }

  onShowTestDataChange() {
    // Re-process signals to apply test data filters
    this.fetchData(false);
  }

  fetchHistoricalPerformance() {
    this.supabaseService.getSmartTrendDailyPerformance(this.selectedDays, this.selectedGroup)
      .subscribe({
        next: (data) => {
          this.historicalHistory = data || [];
          this.calculateHistorySummary();
          this.cdr.detectChanges();
        },
        error: (err) => {
          console.error('Failed to load performance history:', err);
        }
      });
  }

  calculateHistorySummary() {
    let totalRealized = 0;
    let totalClosed = 0;
    let winningTrades = 0;
    let grossProfit = 0;
    let grossLoss = 0;
    let bestDayPl = -Infinity;
    let worstDayPl = Infinity;

    for (const row of this.historicalHistory) {
      const pl = Number(row.realized_paper_pl) || 0;
      totalRealized += pl;
      totalClosed += Number(row.closed_trades) || 0;
      winningTrades += Number(row.winning_trades) || 0;
      grossProfit += Number(row.gross_profit) || 0;
      grossLoss += Number(row.gross_loss) || 0;

      if (pl > bestDayPl) bestDayPl = pl;
      if (pl < worstDayPl) worstDayPl = pl;
    }

    const count = this.historicalHistory.length;
    this.historySummary = {
      totalRealized,
      totalClosed,
      winRate: totalClosed > 0 ? (winningTrades / totalClosed) * 100 : 0,
      grossProfit,
      grossLoss,
      profitFactor: Math.abs(grossLoss) > 0 ? grossProfit / Math.abs(grossLoss) : null,
      bestDay: count > 0 ? bestDayPl : 0,
      worstDay: count > 0 ? worstDayPl : 0,
      avgDailyPl: count > 0 ? totalRealized / count : 0
    };
  }

  exportHistoryCSV() {
    if (this.historicalHistory.length === 0) {
      alert('No data to export.');
      return;
    }
    const headers = [
      'Trade Date', 'Version', 'Group', 'Allocation / Trade', 
      'Opened Trades', 'Closed Trades', 'Active Trades', 'Winning Trades', 'Losing Trades', 
      'Target Exits', 'Stop Exits', 'Structure Exits', 'EOD Exits', 
      'Gross Deployed Capital', 'Peak Concurrent Capital', 'Realized Paper P/L', 
      'Win Rate %', 'Profit Factor', 'Average Daily Return %', 'Return on Peak Capital %'
    ];

    const rows = this.historicalHistory.map(r => [
      r.trade_date,
      r.strategy_version,
      r.group_name,
      r.allocation_per_trade,
      r.opened_trades,
      r.closed_trades,
      r.active_trades_at_snapshot,
      r.winning_trades,
      r.losing_trades,
      r.target_exits,
      r.stop_exits,
      r.structure_exits,
      r.eod_exits,
      r.gross_deployed_capital,
      r.peak_concurrent_capital,
      r.realized_paper_pl,
      r.win_rate_pct,
      r.profit_factor,
      r.average_trade_return_pct,
      r.return_on_peak_capital_pct
    ]);

    const csvContent = "data:text/csv;charset=utf-8," 
      + [headers.join(','), ...rows.map(e => e.map(val => {
          if (val === null || val === undefined) return '';
          return typeof val === 'string' && val.includes(',') ? `"${val}"` : val;
        }).join(','))].join('\n');

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `smarttrend_history_${this.selectedDays}d.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  applyFilters() {
    this.updateDynamicFields();

    const activeLongs: SmartTrendTrade[] = [];
    const activeShorts: SmartTrendTrade[] = [];
    const closedTrades: SmartTrendTrade[] = [];

    const query = this.searchQuery.toLowerCase().trim();

    for (const t of this.allTrades) {
      // 1. Search Query filter
      const matchesSearch = !query ||
        t.symbol.toLowerCase().includes(query) ||
        t.tradeId.toLowerCase().includes(query) ||
        t.side.toLowerCase().includes(query) ||
        (t.open?.entrySource && t.open.entrySource.toLowerCase().includes(query)) ||
        (t.close?.primaryReason && t.close.primaryReason.toLowerCase().includes(query));

      if (!matchesSearch) continue;

      // 2. View type filter
      if (t.type === 'ACTIVE') {
        if (!this.viewActive) continue;
      } else if (t.type === 'CLOSED') {
        const isToday = t.closedTime && this.isTodayInET(t.closedTime);
        if (isToday && !this.viewClosedToday) continue;
        if (!isToday && !this.viewOlderHistory) continue;
      } else if (t.type === 'ORPHAN') {
        if (!this.viewOrphanExits) continue;
      }

      // 3. Action type filter
      if (t.open) {
        if (t.open.action === 'BUY' && !this.actionBuy) continue;
        if (t.open.action === 'SHORT' && !this.actionShort) continue;
      }
      if (t.close) {
        if (t.close.action === 'EXIT_LONG' && !this.actionExitLong) continue;
        if (t.close.action === 'EXIT_SHORT' && !this.actionExitShort) continue;
      }

      // 4. Entry Source filter
      if (t.open) {
        const isFresh = t.open.entrySource === 'FRESH';
        const isPending = t.open.entrySource === 'PENDING';
        if (isFresh && !this.sourceFresh) continue;
        if (isPending && !this.sourcePending) continue;
      }

      // 5. Exit Reason filter
      if (t.close) {
        const cat = this.resolveReasonCategory(t.close.primaryReason);
        if (cat === 'TARGET' && !this.reasonTarget) continue;
        if (cat === 'STOP' && !this.reasonStop) continue;
        if (cat === 'EMA_VWAP_LOSS' && !this.reasonStructure) continue;
        if (cat === 'END_OF_DAY' && !this.reasonEod) continue;
        if (cat === 'UNKNOWN' && !this.reasonUnknown) continue;
      }

      // 6. Status filter
      if (t.open) {
        const derived = this.getDerivedStatus(t);
        const isFresh = derived === 'FRESH' || derived === 'TARGET TOUCHED' || derived === 'STOP TOUCHED' || derived === 'EXIT ALERT MISSING';
        const isStale = derived === 'STALE';
        if (isFresh && !this.statusFresh) continue;
        if (isStale && !this.statusStale) continue;
      }

      // Split into columns
      if (t.type === 'ACTIVE') {
        if (t.side === 'LONG') {
          activeLongs.push(t);
        } else {
          activeShorts.push(t);
        }
      } else {
        closedTrades.push(t);
      }
    }

    // Sort active list
    activeLongs.sort((a, b) => this.sortCompare(a, b));
    activeShorts.sort((a, b) => this.sortCompare(a, b));
    
    // Closed trades sorted closed descending
    closedTrades.sort((a, b) => {
      const timeA = a.closedTime ? new Date(a.closedTime).getTime() : 0;
      const timeB = b.closedTime ? new Date(b.closedTime).getTime() : 0;
      return timeB - timeA;
    });

    this.filteredActiveLongs = activeLongs;
    this.filteredActiveShorts = activeShorts;
    this.filteredClosedTrades = closedTrades;

    this.totalActiveLongs = activeLongs.length;
    this.totalActiveShorts = activeShorts.length;
  }

  toggleSort(key: string) {
    if (this.sortKey === key) {
      this.sortAsc = !this.sortAsc;
    } else {
      this.sortKey = key;
      this.sortAsc = true;
    }
    this.applyFilters();
  }

  sortCompare(a: SmartTrendTrade, b: SmartTrendTrade): number {
    let valA: any = '';
    let valB: any = '';

    if (this.sortKey === 'symbol') {
      valA = a.symbol;
      valB = b.symbol;
    } else if (this.sortKey === 'source') {
      valA = a.open?.entrySource || '';
      valB = b.open?.entrySource || '';
    } else if (this.sortKey === 'entry') {
      valA = this.getEntryPrice(a);
      valB = this.getEntryPrice(b);
    } else if (this.sortKey === 'current') {
      valA = a.livePrice || (a.open ? a.open.current_price : 0) || 0;
      valB = b.livePrice || (b.open ? b.open.current_price : 0) || 0;
    } else if (this.sortKey === 'move_pct') {
      valA = a.movePct || 0;
      valB = b.movePct || 0;
    } else if (this.sortKey === 'opened') {
      valA = a.openedTime ? new Date(a.openedTime).getTime() : 0;
      valB = b.openedTime ? new Date(b.openedTime).getTime() : 0;
    } else if (this.sortKey === 'status') {
      valA = this.getDerivedStatus(a);
      valB = this.getDerivedStatus(b);
    } else if (this.sortKey === 'result') {
      valA = a.resultPct || 0;
      valB = b.resultPct || 0;
    }

    if (valA < valB) return this.sortAsc ? -1 : 1;
    if (valA > valB) return this.sortAsc ? 1 : -1;
    return 0;
  }

  openModal(t: SmartTrendTrade) {
    this.selectedTrade = t;
  }

  closeModal() {
    this.selectedTrade = null;
  }
}
