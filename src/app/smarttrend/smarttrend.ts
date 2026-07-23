import { Component, OnInit, OnDestroy, ChangeDetectorRef } from '@angular/core';
import { CommonModule, DecimalPipe, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { Subject, takeUntil, interval } from 'rxjs';
import { SupabaseService } from '../../services/supabase.service';

interface NormalizedSignal {
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
}

interface SmartTrendTrade {
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
          <h2 style="display: flex; align-items: center; gap: 10px;">
            SmartTrend Core — Experimental Paper Test
            <span class="warning-badge">PAPER TEST ONLY — Backtest Not Yet Profitable</span>
          </h2>
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
        <div class="summary-card" *ngIf="unknownExitsTodayCount > 0">
          <span class="card-val" style="color: #c084fc;">{{ unknownExitsTodayCount }}</span>
          <span class="card-lbl">Unknown Exits</span>
        </div>
      </div>

      <!-- Filter Panel (Matte Charcoal style) -->
      <div class="filter-panel">
        <div class="search-box">
          <input type="text" [(ngModel)]="searchQuery" (ngModelChange)="applyFilters()" placeholder="Search symbols, actions, trade IDs, sources, reasons..." class="search-input" />
        </div>
        <div class="filters-row">
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
        <div class="table-wrapper bullish-wrapper" *ngIf="viewActive">
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
                  <td class="price-col">\${{ t.open?.current_price | number: '1.2-2' }}</td>
                  <td class="pct-col" [class.positive]="t.movePct >= 0" [class.negative]="t.movePct < 0">
                    {{ t.movePct | number: '1.2-2' }}%
                  </td>
                  <td class="price-col stop-col" style="color: #f87171;">\${{ t.open?.stop_price | number: '1.2-2' }}</td>
                  <td class="price-col target-col" style="color: #34d399; font-weight: 500;">\${{ getTargetPrice(t.open) | number: '1.2-2' }}</td>
                  <td class="time-col">{{ t.openedTime | date: 'MM/dd hh:mm a' }}</td>
                  <td class="time-col">{{ t.ageText }}</td>
                  <td style="text-align: center;">
                    <span class="status-lbl" [class]="t.open?.status">{{ t.open?.status | uppercase }}</span>
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
        <div class="table-wrapper bearish-wrapper" *ngIf="viewActive">
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
                  <td class="price-col">\${{ t.open?.current_price | number: '1.2-2' }}</td>
                  <td class="pct-col" [class.positive]="t.movePct >= 0" [class.negative]="t.movePct < 0">
                    {{ t.movePct | number: '1.2-2' }}%
                  </td>
                  <td class="price-col stop-col" style="color: #f87171;">\${{ t.open?.stop_price | number: '1.2-2' }}</td>
                  <td class="price-col target-col" style="color: #34d399; font-weight: 500;">\${{ getTargetPrice(t.open) | number: '1.2-2' }}</td>
                  <td class="time-col">{{ t.openedTime | date: 'MM/dd hh:mm a' }}</td>
                  <td class="time-col">{{ t.ageText }}</td>
                  <td style="text-align: center;">
                    <span class="status-lbl" [class]="t.open?.status">{{ t.open?.status | uppercase }}</span>
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
        <div class="table-wrapper full-width-wrapper" style="grid-column: span 2;">
          <div class="table-title exits-title">
            Recent Closed Trades / Exits
          </div>
          <div class="table-scroll" style="max-height: 400px;">
            <table class="screener-table">
              <thead>
                <tr>
                  <th (click)="toggleSort('symbol')" class="sortable-th">Symbol <span *ngIf="sortKey === 'symbol'">{{ sortAsc ? '▲' : '▼' }}</span></th>
                  <th>Side</th>
                  <th (click)="toggleSort('source')" class="sortable-th">Entry Src <span *ngIf="sortKey === 'source'">{{ sortAsc ? '▲' : '▼' }}</span></th>
                  <th (click)="toggleSort('entry')" class="sortable-th">Entry <span *ngIf="sortKey === 'entry'">{{ sortAsc ? '▲' : '▼' }}</span></th>
                  <th>Exit</th>
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
                  <td class="price-col">\${{ getEntryPrice(t) | number: '1.2-2' }}</td>
                  <td class="price-col">\${{ t.close?.trigger_price | number: '1.2-2' }}</td>
                  <td class="pct-col" [class.positive]="t.resultPct !== undefined && t.resultPct >= 0" [class.negative]="t.resultPct !== undefined && t.resultPct < 0">
                    {{ t.resultPct !== undefined ? (t.resultPct | number: '1.2-2') + '%' : 'N/A' }}
                  </td>
                  <td>
                    <span class="exit-reason-badge" [class]="resolveReasonCategory(t.close?.primaryReason).toLowerCase()" [title]="getReasonExplanation(t.close?.primaryReason)">
                      {{ getExitReasonShortCode(t.close?.primaryReason) }}
                    </span>
                  </td>
                  <td class="time-col">{{ t.openedTime | date: 'MM/dd hh:mm a' }}</td>
                  <td class="time-col">{{ t.closedTime | date: 'MM/dd hh:mm a' }}</td>
                  <td class="time-col">{{ t.holdTimeText || 'N/A' }}</td>
                  <td style="text-align: center;">
                    <span class="status-lbl" [class]="t.close?.status">{{ t.close?.status | uppercase }}</span>
                  </td>
                  <td class="actions-cell">
                    <button class="mini-btn info" type="button" (click)="openModal(t); $event.stopPropagation()" aria-label="Details">ℹ️</button>
                    <a [href]="'https://www.tradingview.com/chart/?symbol=' + t.symbol" target="_blank" class="mini-btn tv" title="TradingView" (click)="$event.stopPropagation()">TV</a>
                    <a [href]="'https://finviz.com/quote.ashx?t=' + t.symbol" target="_blank" class="mini-btn fz" title="Finviz" (click)="$event.stopPropagation()">FZ</a>
                  </td>
                </tr>
                <tr *ngIf="filteredClosedTrades.length === 0">
                  <td colspan="12" class="empty-row">No closed trades match filters.</td>
                </tr>
              </tbody>
            </table>
          </div>
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
                <span class="detail-label">Entry Source:</span>
                <span class="detail-val" [title]="getSourceExplanation(selectedTrade.open?.entrySource)">
                  {{ selectedTrade.open?.entrySource || 'N/A' }}
                </span>
              </div>
              <div class="detail-row">
                <span class="detail-label">Opened Time:</span>
                <span class="detail-val">{{ selectedTrade.openedTime | date: 'yyyy-MM-dd hh:mm:ss a' }}</span>
              </div>
              <div class="detail-row">
                <span class="detail-label">Entry Price:</span>
                <span class="detail-val">\${{ getEntryPrice(selectedTrade) | number: '1.2-2' }}</span>
              </div>
              <div class="detail-row" *ngIf="selectedTrade.type === 'ACTIVE'">
                <span class="detail-label">Current Price:</span>
                <span class="detail-val">\${{ selectedTrade.open?.current_price | number: '1.2-2' }}</span>
              </div>
              <div class="detail-row" *ngIf="selectedTrade.type === 'ACTIVE'">
                <span class="detail-label">Unrealized Move:</span>
                <span class="detail-val pct-col" [class.positive]="selectedTrade.movePct >= 0" [class.negative]="selectedTrade.movePct < 0">
                  {{ selectedTrade.movePct | number: '1.2-2' }}%
                </span>
              </div>
              <div class="detail-row" *ngIf="selectedTrade.open">
                <span class="detail-label">Stop Price:</span>
                <span class="detail-val" style="color: #f87171;">\${{ selectedTrade.open.stop_price | number: '1.2-2' }}</span>
              </div>
              <div class="detail-row" *ngIf="selectedTrade.open">
                <span class="detail-label">Target Price:</span>
                <span class="detail-val" style="color: #34d399;">\${{ getTargetPrice(selectedTrade.open) | number: '1.2-2' }}</span>
              </div>
              <div class="detail-row" *ngIf="selectedTrade.open">
                <span class="detail-label">EMA 9:</span>
                <span class="detail-val">\${{ selectedTrade.open.ema9_at_signal | number: '1.2-2' }}</span>
              </div>
              <div class="detail-row" *ngIf="selectedTrade.open">
                <span class="detail-label">EMA 21:</span>
                <span class="detail-val">\${{ selectedTrade.open.ema21_at_signal | number: '1.2-2' }}</span>
              </div>
              <div class="detail-row" *ngIf="selectedTrade.open">
                <span class="detail-label">VWAP:</span>
                <span class="detail-val">\${{ selectedTrade.open.vwap_at_signal | number: '1.2-2' }}</span>
              </div>
              <div class="detail-row" *ngIf="selectedTrade.open">
                <span class="detail-label">Position Before:</span>
                <span class="detail-val">{{ selectedTrade.open.positionBefore }}</span>
              </div>
              <div class="detail-row" *ngIf="selectedTrade.open">
                <span class="detail-label">Position After:</span>
                <span class="detail-val">{{ selectedTrade.open.positionAfter }}</span>
              </div>
              <div class="detail-row" *ngIf="selectedTrade.open">
                <span class="detail-label">Signal ID:</span>
                <span class="detail-val">{{ selectedTrade.open.signal_id }}</span>
              </div>

              <!-- Closed trade specific fields -->
              <ng-container *ngIf="selectedTrade.type === 'CLOSED' || selectedTrade.type === 'ORPHAN'">
                <div class="detail-row" *ngIf="selectedTrade.close">
                  <span class="detail-label">Exit Action:</span>
                  <span class="detail-val">{{ selectedTrade.close.action }}</span>
                </div>
                <div class="detail-row" *ngIf="selectedTrade.close">
                  <span class="detail-label">Exit Price:</span>
                  <span class="detail-val">\${{ selectedTrade.close.trigger_price | number: '1.2-2' }}</span>
                </div>
                <div class="detail-row" *ngIf="selectedTrade.close">
                  <span class="detail-label">Exit Reason:</span>
                  <span class="detail-val" [title]="getReasonExplanation(selectedTrade.close.primaryReason)">
                    {{ selectedTrade.close.primaryReason }}
                  </span>
                </div>
                <div class="detail-row" *ngIf="selectedTrade.closedTime">
                  <span class="detail-label">Closed Time:</span>
                  <span class="detail-val">{{ selectedTrade.closedTime | date: 'yyyy-MM-dd hh:mm:ss a' }}</span>
                </div>
                <div class="detail-row" *ngIf="selectedTrade.holdTimeText">
                  <span class="detail-label">Hold Time:</span>
                  <span class="detail-val">{{ selectedTrade.holdTimeText }}</span>
                </div>
                <div class="detail-row" *ngIf="selectedTrade.resultPct !== undefined">
                  <span class="detail-label">Realized Result:</span>
                  <span class="detail-val pct-col" [class.positive]="selectedTrade.resultPct >= 0" [class.negative]="selectedTrade.resultPct < 0">
                    {{ selectedTrade.resultPct | number: '1.2-2' }}%
                  </span>
                </div>
              </ng-container>
            </div>

            <div class="modal-footer-notes" style="margin-top: 14px; padding-top: 10px; border-top: 1px solid #27272a; font-size: 0.72rem; color: #9ca3af;">
              <p *ngIf="selectedTrade.open?.entrySource">
                <strong>Source:</strong> {{ getSourceExplanation(selectedTrade.open?.entrySource) }}
              </p>
              <p *ngIf="selectedTrade.close?.primaryReason">
                <strong>Exit Reason:</strong> {{ getReasonExplanation(selectedTrade.close?.primaryReason) }}
              </p>
            </div>
          </div>
        </div>
      </div>

    </div>
  `,
  styles: [`
    /* Eye-friendly Matte Charcoal Design System */
    .screener-container {
      padding: 12px 18px;
      color: #d1d5db;
      background-color: #0f1115;
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
      font-size: 1.15rem;
      font-weight: 500;
      color: #e5e7eb;
    }
    .warning-badge {
      font-size: 0.65rem;
      font-weight: bold;
      background: rgba(239, 68, 68, 0.15);
      color: #ef4444;
      border: 1px solid rgba(239, 68, 68, 0.3);
      padding: 2px 8px;
      border-radius: 4px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    .manual-refresh-btn {
      background: #1a1e27;
      color: #e5e7eb;
      border: 1px solid #27272a;
      padding: 3px 8px;
      border-radius: 4px;
      cursor: pointer;
      font-size: 0.72rem;
      transition: background-color 0.2s ease;
    }
    .manual-refresh-btn:hover {
      background: #22252a;
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
    .last-updated {
      font-size: 0.72rem;
      color: #9ca3af;
      font-family: monospace;
    }

    /* Summary Strip */
    .summary-strip {
      display: flex;
      flex-wrap: wrap;
      gap: 10px;
      margin-bottom: 14px;
    }
    .summary-card {
      background: #161a22;
      border: 1px solid #22252a;
      border-radius: 6px;
      padding: 8px 12px;
      display: flex;
      flex-direction: column;
      align-items: center;
      min-width: 90px;
      flex: 1;
    }
    .card-val {
      font-size: 1.1rem;
      font-weight: bold;
      color: #e5e7eb;
      font-family: monospace;
    }
    .card-lbl {
      font-size: 0.65rem;
      color: #9ca3af;
      margin-top: 2px;
      text-transform: uppercase;
      letter-spacing: 0.2px;
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
      font-size: 0.8rem;
      box-sizing: border-box;
      transition: border-color 0.2s ease;
    }
    .search-input:focus {
      outline: none;
      border-color: #3b82f6;
    }
    .filters-row {
      display: flex;
      align-items: center;
      flex-wrap: wrap;
      gap: 16px;
    }
    .filter-group {
      display: flex;
      align-items: center;
      gap: 10px;
      flex-wrap: wrap;
    }
    .group-label {
      color: #6b7280;
      font-size: 0.72rem;
      font-weight: 500;
      text-transform: uppercase;
      letter-spacing: 0.3px;
    }
    .checkbox-label {
      font-size: 0.75rem;
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
    .error-container {
      padding: 20px;
      text-align: center;
      background: rgba(239, 68, 68, 0.08);
      border: 1px solid rgba(239, 68, 68, 0.2);
      border-radius: 6px;
      margin-bottom: 14px;
    }
    .error-text {
      color: #f87171;
      font-size: 0.82rem;
      margin-bottom: 10px;
    }
    .no-data {
      padding: 30px;
      text-align: center;
      background: #161a22;
      border-radius: 6px;
      color: #6b7280;
      border: 1px solid #22252a;
      font-size: 0.8rem;
      margin-bottom: 14px;
    }

    /* Tables Layout */
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
      display: flex;
      flex-direction: column;
    }
    .table-title {
      padding: 8px 12px;
      font-weight: 500;
      font-size: 0.78rem;
      border-bottom: 1px solid #22252a;
      letter-spacing: 0.5px;
    }
    .bullish-title {
      background: rgba(74, 222, 128, 0.08);
      color: #4ade80;
    }
    .bearish-title {
      background: rgba(248, 113, 113, 0.08);
      color: #f87171;
    }
    .exits-title {
      background: rgba(156, 163, 175, 0.08);
      color: #e5e7eb;
    }
    .table-scroll {
      overflow-x: auto;
      overflow-y: auto;
      flex-grow: 1;
      max-height: 400px;
      background: rgba(30, 41, 59, 0.15);
    }
    .table-scroll::-webkit-scrollbar {
      width: 6px;
      height: 6px;
    }
    .table-scroll::-webkit-scrollbar-thumb {
      background-color: rgba(255,255,255,0.15);
      border-radius: 3px;
    }

    /* Table styling */
    .screener-table {
      width: 100%;
      border-collapse: collapse;
      font-size: 0.7rem;
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
      font-size: 0.65rem;
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
    .empty-row {
      text-align: center;
      color: #4b5563;
      padding: 16px !important;
      font-style: italic;
    }

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
    
    .source-tag {
      font-size: 0.58rem;
      font-weight: bold;
      background: #2563eb;
      color: #e0f2fe;
      padding: 1px 4px;
      border-radius: 3px;
    }
    .source-tag.pending {
      background: #d97706;
    }

    .side-tag {
      font-size: 0.6rem;
      font-weight: bold;
      padding: 1px 4px;
      border-radius: 3px;
    }
    .side-tag.long {
      color: #4ade80;
      background: rgba(74, 222, 128, 0.08);
    }
    .side-tag.short {
      color: #f87171;
      background: rgba(248, 113, 113, 0.08);
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

    .status-lbl {
      font-size: 0.6rem;
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
    .status-lbl.stale {
      color: #9ca3af;
      background: rgba(156, 163, 175, 0.06);
    }

    .exit-reason-badge {
      font-size: 0.62rem;
      font-weight: bold;
      padding: 1px 4px;
      border-radius: 3px;
    }
    .exit-reason-badge.target {
      color: #4ade80;
      background: rgba(74, 222, 128, 0.08);
      border: 1px solid rgba(74, 222, 128, 0.2);
    }
    .exit-reason-badge.stop {
      color: #f87171;
      background: rgba(248, 113, 113, 0.08);
      border: 1px solid rgba(248, 113, 113, 0.2);
    }
    .exit-reason-badge.ema_vwap_loss {
      color: #fb923c;
      background: rgba(251, 146, 60, 0.08);
      border: 1px solid rgba(251, 146, 60, 0.2);
    }
    .exit-reason-badge.end_of_day {
      color: #9ca3af;
      background: rgba(156, 163, 175, 0.08);
      border: 1px solid rgba(156, 163, 175, 0.2);
    }
    .exit-reason-badge.unknown {
      color: #c084fc;
      background: rgba(192, 132, 252, 0.08);
      border: 1px solid rgba(192, 132, 252, 0.2);
    }

    .actions-cell {
      display: flex;
      gap: 3px;
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
        grid-template-columns: 1fr;
      }
      .table-wrapper.full-width-wrapper {
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

  private destroy$ = new Subject<void>();

  constructor(
    private supabaseService: SupabaseService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit() {
    this.fetchData(false);

    // Auto-refresh every 30 seconds
    interval(30000)
      .pipe(takeUntil(this.destroy$))
      .subscribe(() => {
        this.fetchData(false);
      });
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
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
          // ignore parsing error, fallback to empty object
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

    // Ignore rows with another action
    if (action !== 'BUY' && action !== 'SHORT' && action !== 'EXIT_LONG' && action !== 'EXIT_SHORT') {
      return null;
    }

    const lifecycle = row.lifecycle || (action === 'EXIT_LONG' || action === 'EXIT_SHORT' ? 'CLOSE' : 'OPEN');
    const tradeId = row.trade_id || payload.tradeId || row.signal_id || '';
    const entrySource = row.entry_source || payload.entrySource || 'FRESH';
    const primaryReason = row.primary_reason || payload.primaryReason || '';
    const positionBefore = row.position_before !== undefined && row.position_before !== null ? row.position_before : (payload.positionBefore !== undefined ? payload.positionBefore : '');
    const positionAfter = row.position_after !== undefined && row.position_after !== null ? row.position_after : (payload.positionAfter !== undefined ? payload.positionAfter : '');

    return {
      ...row,
      action,
      lifecycle,
      tradeId,
      entrySource,
      primaryReason,
      positionBefore,
      positionAfter,
      raw_alert_payload: payload
    };
  }

  processSignals(rawSignals: any[]) {
    // 1. Normalize and filter
    const normalized = rawSignals
      .map(r => this.normalizeSignal(r))
      .filter(r => r !== null) as NormalizedSignal[];

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
      
      if (g.open && g.close) {
        type = 'CLOSED';
        side = g.open.action === 'BUY' ? 'LONG' : 'SHORT';
        symbol = g.open.symbol;
        openedTime = g.open.signal_bar_time;
        closedTime = g.close.signal_bar_time;
        
        // Calculate result percent
        const entry = g.open.trigger_price || g.open.entry_price_est || 1;
        const exit = g.close.trigger_price || 0;
        if (side === 'LONG') {
          resultPct = ((exit - entry) / entry) * 100;
        } else {
          resultPct = ((entry - exit) / entry) * 100;
        }

        // Hold time
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
        ageText: ''
      });
    }

    this.allTrades = trades;
    this.updateDynamicFields();
    this.calculateSummary();
    this.applyFilters();
  }

  updateDynamicFields() {
    const now = Date.now();
    for (const t of this.allTrades) {
      if (t.type === 'ACTIVE' && t.open) {
        const entry = t.open.trigger_price || t.open.entry_price_est || 1;
        const current = t.open.current_price || entry;
        if (t.side === 'LONG') {
          t.movePct = ((current - entry) / entry) * 100;
        } else {
          t.movePct = ((entry - current) / entry) * 100;
        }

        const openedMs = new Date(t.openedTime!).getTime();
        t.ageText = this.formatDuration(now - openedMs);
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

    for (const t of this.allTrades) {
      if (t.type === 'ACTIVE') {
        if (t.side === 'LONG') this.activeLongsCount++;
        else if (t.side === 'SHORT') this.activeShortsCount++;
      } else if (t.type === 'CLOSED') {
        if (t.closedTime && this.isTodayInET(t.closedTime)) {
          this.exitsTodayCount++;
          const reason = t.close?.primaryReason || '';
          const cat = this.resolveReasonCategory(reason);
          if (cat === 'TARGET') this.targetsTodayCount++;
          else if (cat === 'STOP') this.stopsTodayCount++;
          else if (cat === 'EMA_VWAP_LOSS') this.structureExitsTodayCount++;
          else if (cat === 'END_OF_DAY') this.eodExitsTodayCount++;
          else this.unknownExitsTodayCount++;
        }
      }
    }
  }

  isTodayInET(dateStr: string): boolean {
    if (!dateStr) return false;
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return false;
    const etString = date.toLocaleDateString('en-US', { timeZone: 'America/New_York' });
    const todayString = new Date().toLocaleDateString('en-US', { timeZone: 'America/New_York' });
    return etString === todayString;
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
      // fallback for orphans
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
        const isFresh = t.open.status === 'fresh';
        const isStale = t.open.status === 'stale' || t.open.status === 'expired';
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

    // Sort active long list
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
      valA = a.open?.current_price || 0;
      valB = b.open?.current_price || 0;
    } else if (this.sortKey === 'move_pct') {
      valA = a.movePct || 0;
      valB = b.movePct || 0;
    } else if (this.sortKey === 'opened') {
      valA = a.openedTime ? new Date(a.openedTime).getTime() : 0;
      valB = b.openedTime ? new Date(b.openedTime).getTime() : 0;
    } else if (this.sortKey === 'status') {
      valA = a.open?.status || '';
      valB = b.open?.status || '';
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
