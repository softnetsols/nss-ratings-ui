import { Component, OnInit, OnDestroy, ChangeDetectorRef } from '@angular/core';
import { CommonModule, DecimalPipe, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { Subject, takeUntil } from 'rxjs';
import { SupabaseService } from '../../services/supabase.service';

@Component({
  selector: 'app-screener',
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
        <h2>Golden/Death Cross Screener</h2>
        <div style="display: flex; align-items: center; gap: 8px;">
          <button class="manual-refresh-btn" (click)="fetchData(true)" [disabled]="loading">
            🔄 {{ loading ? 'Refreshing...' : 'Refresh' }}
          </button>
          <span class="refresh-indicator" [class.syncing]="loading">
            {{ loading ? 'Updating...' : 'Ready' }}
          </span>
        </div>
      </div>

      <!-- Advanced Filter Panel (Matte style) -->
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
        No active setups found. Make sure your TradingView GoldenCross alerts are active.
      </div>

      <!-- Side-by-Side Compact Tables -->
      <div *ngIf="allSetups.length > 0" class="tables-grid">
        
        <!-- Bullish Table -->
        <div class="table-wrapper bullish-wrapper">
          <div class="table-title bullish-title">
            🟢 BULLISH SETUPS ({{ totalBullish }} active)
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
                  <th (click)="toggleSort('stop_price')" class="sortable-th">Stop <span *ngIf="sortKey === 'stop_price'">{{ sortAsc ? '▲' : '▼' }}</span></th>
                  <th (click)="toggleSort('target2_price')" class="sortable-th">Target 2 <span *ngIf="sortKey === 'target2_price'">{{ sortAsc ? '▲' : '▼' }}</span></th>
                  <th (click)="toggleSort('signal_bar_time')" class="sortable-th">Time <span *ngIf="sortKey === 'signal_bar_time'">{{ sortAsc ? '▲' : '▼' }}</span></th>
                  <th (click)="toggleSort('status')" class="sortable-th" style="text-align: center;">St <span *ngIf="sortKey === 'status'">{{ sortAsc ? '▲' : '▼' }}</span></th>
                  
                  <th style="text-align: center;">Links</th>
                </tr>
              </thead>
              <tbody>
                <tr *ngFor="let s of filteredBullish" (click)="openTradePlan(s)" [class.stale-row]="s.status === 'stale' || s.status === 'expired' || s.status === 'duplicate'" style="cursor: pointer;">
                  <td class="sym-cell">
                    <a [href]="'https://www.tradingview.com/chart/?symbol=' + s.symbol" target="_blank" class="symbol-link" (click)="$event.stopPropagation()">{{ s.symbol }}</a>
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
                  <td class="price-col">\${{ formatPrice(s.trigger_price, s.symbol) }}</td>
                  <td class="price-col">\${{ formatPrice(s.current_price, s.symbol) }}</td>
                  <td class="pct-col" [class.positive]="getMovePct(s) >= 0" [class.negative]="getMovePct(s) < 0">
                    {{ getMovePct(s) | number: '1.2-2' }}%
                  </td>
                  <td class="price-col stop-col" style="color: #f87171;">\${{ formatPrice(s.stop_price, s.symbol) }}</td>
                  <td class="price-col target-col" style="color: #34d399; font-weight: 500;">\${{ formatPrice(s.target2_price, s.symbol) }}</td>
                  <td class="time-col">{{ s.signal_bar_time | date: 'MM/dd hh:mm a' }}</td>
                  <td style="text-align: center;">
                    <span class="status-lbl" [class]="s.status" [title]="s.status | uppercase">{{ getStatusShortCode(s.status) }}</span>
                  </td>
                  <td class="reasons-cell">
                    <div class="reasons-list">-</div>
                  </td>
                  <td class="actions-cell">
                    <button class="mini-btn info" type="button" (click)="toggleReasons(s, $event)" aria-label="Reasons">ℹ️</button>
                    <a [href]="'https://www.tradingview.com/chart/?symbol=' + s.symbol" target="_blank" class="mini-btn tv" title="TradingView" (click)="$event.stopPropagation()">TV</a>
                    <a [href]="'https://finviz.com/quote.ashx?t=' + s.symbol" target="_blank" class="mini-btn fz" title="Finviz" (click)="$event.stopPropagation()">FZ</a>

                    <div *ngIf="openReasonsFor === s.symbol" class="reasons-popover" (click)="$event.stopPropagation()">
                      <div class="popover-content">
                        <pre>{{ s.score_reasons?.join('\n') || '-' }}</pre>
                      </div>
                    </div>
                  </td>
                </tr>
                <tr *ngIf="filteredBullish.length === 0">
                  <td colspan="12" class="empty-row">No bullish setups match active filters.</td>
                </tr>
              </tbody>
            </table>
          </div>
          <div class="pagination-bar" *ngIf="totalBullishPages > 1">
            <button class="pag-btn" (click)="prevBullishPage()" [disabled]="bullishPage === 1">◀ Prev</button>
            <span class="pag-info">Page {{ bullishPage }} of {{ totalBullishPages }}</span>
            <button class="pag-btn" (click)="nextBullishPage()" [disabled]="bullishPage === totalBullishPages">Next ▶</button>
          </div>
        </div>

        <!-- Bearish Table -->
        <div class="table-wrapper bearish-wrapper">
          <div class="table-title bearish-title">
            🔴 BEARISH SETUPS ({{ totalBearish }} active)
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
                  <th (click)="toggleSort('stop_price')" class="sortable-th">Stop <span *ngIf="sortKey === 'stop_price'">{{ sortAsc ? '▲' : '▼' }}</span></th>
                  <th (click)="toggleSort('target2_price')" class="sortable-th">Target 2 <span *ngIf="sortKey === 'target2_price'">{{ sortAsc ? '▲' : '▼' }}</span></th>
                  <th (click)="toggleSort('signal_bar_time')" class="sortable-th">Time <span *ngIf="sortKey === 'signal_bar_time'">{{ sortAsc ? '▲' : '▼' }}</span></th>
                  <th (click)="toggleSort('status')" class="sortable-th" style="text-align: center;">St <span *ngIf="sortKey === 'status'">{{ sortAsc ? '▲' : '▼' }}</span></th>
                  
                  <th style="text-align: center;">Links</th>
                </tr>
              </thead>
              <tbody>
                <tr *ngFor="let s of filteredBearish" (click)="openTradePlan(s)" [class.stale-row]="s.status === 'stale' || s.status === 'expired' || s.status === 'duplicate'" style="cursor: pointer;">
                  <td class="sym-cell">
                    <a [href]="'https://www.tradingview.com/chart/?symbol=' + s.symbol" target="_blank" class="symbol-link" (click)="$event.stopPropagation()">{{ s.symbol }}</a>
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
                  <td class="price-col">\${{ formatPrice(s.trigger_price, s.symbol) }}</td>
                  <td class="price-col">\${{ formatPrice(s.current_price, s.symbol) }}</td>
                  <td class="pct-col" [class.positive]="getMovePct(s) >= 0" [class.negative]="getMovePct(s) < 0">
                    {{ getMovePct(s) | number: '1.2-2' }}%
                  </td>
                  <td class="price-col stop-col" style="color: #f87171;">\${{ formatPrice(s.stop_price, s.symbol) }}</td>
                  <td class="price-col target-col" style="color: #34d399; font-weight: 500;">\${{ formatPrice(s.target2_price, s.symbol) }}</td>
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
                    <a [href]="'https://www.tradingview.com/chart/?symbol=' + s.symbol" target="_blank" class="mini-btn tv" title="TradingView" (click)="$event.stopPropagation()">TV</a>
                    <a [href]="'https://finviz.com/quote.ashx?t=' + s.symbol" target="_blank" class="mini-btn fz" title="Finviz" (click)="$event.stopPropagation()">FZ</a>
                  </td>
                </tr>
                <tr *ngIf="filteredBearish.length === 0">
                  <td colspan="12" class="empty-row">No bearish setups match active filters.</td>
                </tr>
              </tbody>
            </table>
          </div>
          <!-- Pagination Control -->
          <div class="pagination-bar" *ngIf="totalBearishPages > 1">
            <button class="pag-btn" (click)="prevBearishPage()" [disabled]="bearishPage === 1">◀ Prev</button>
            <span class="pag-info">Page {{ bearishPage }} of {{ totalBearishPages }}</span>
            <button class="pag-btn" (click)="nextBearishPage()" [disabled]="bearishPage === totalBearishPages">Next ▶</button>
          </div>
        </div>

      </div>

      <!-- Trade Plan Modal Overlay -->
      <div class="modal-overlay" *ngIf="selectedSignal" (click)="closeTradePlan()">
        <div class="modal-card" (click)="$event.stopPropagation()">
          <div class="modal-header">
            <span class="modal-title">
              <span class="modal-symbol">{{ selectedSignal.symbol }}</span>
              <span class="modal-strategy">({{ selectedSignal.strategy_name === 'alphatrend_reversal' ? 'AlphaTrend' : 'Golden Cross' }})</span>
              <span class="modal-direction" [class.bullish]="selectedSignal.direction === 'bullish'" [class.bearish]="selectedSignal.direction === 'bearish'">
                {{ selectedSignal.direction | uppercase }}
              </span>
            </span>
            <button class="close-btn" (click)="closeTradePlan()">✖</button>
          </div>
          
          <div class="modal-body">
            <!-- Alert for wide risk / invalid plans -->
            <div class="alert-box warning-alert" *ngIf="selectedSignal.trade_plan_quality === 'wide_risk'">
              ⚠️ <strong>Wide Risk Warning:</strong> Stop loss is more than 2% away from entry ({{ getRiskPct(selectedSignal) | number: '1.1-2' }}%). Reduce size.
            </div>
            <div class="alert-box danger-alert" *ngIf="selectedSignal.trade_plan_quality === 'invalid'">
              🚨 <strong>Invalid Trade Plan:</strong> Plan is invalid. {{ selectedSignal.invalidation_reason || 'Stop is not positioned correctly.' }}
            </div>

            <div class="plan-section">
              <div class="plan-desc">
                {{ selectedSignal.direction === 'bullish' 
                   ? 'Entry is based on trigger price. Stop is below recent support (lows / swing lows). Target 2 is the main exit price.' 
                   : 'Entry is based on trigger price. Stop is above recent resistance (highs / swing highs). Target 2 is the main cover price.' 
                }}
              </div>
              
              <div class="plan-metrics">
                <div class="metric-row">
                  <span class="metric-label">Estimated Entry:</span>
                  <span class="metric-value font-mono">\${{ formatPrice(selectedSignal.entry_price_est, selectedSignal.symbol) }}</span>
                </div>
                <div class="metric-row">
                  <span class="metric-label">Stop Loss:</span>
                  <span class="metric-value font-mono stop-text">\${{ formatPrice(selectedSignal.stop_price, selectedSignal.symbol) }}</span>
                </div>
                <div class="metric-row highlight-target">
                  <span class="metric-label">Target 1 (Scalp / 1R):</span>
                  <span class="metric-value font-mono target-text">\${{ formatPrice(selectedSignal.target1_price, selectedSignal.symbol) }}</span>
                </div>
                <div class="metric-row highlight-target active-target">
                  <span class="metric-label">Target 2 (Main Exit / 2R):</span>
                  <span class="metric-value font-mono target-text font-bold">\${{ formatPrice(selectedSignal.target2_price, selectedSignal.symbol) }}</span>
                </div>
                <div class="metric-row highlight-target">
                  <span class="metric-label">Target 3 (Runner / 3R):</span>
                  <span class="metric-value font-mono target-text">\${{ formatPrice(selectedSignal.target3_price, selectedSignal.symbol) }}</span>
                </div>
                <div class="metric-row" *ngIf="selectedSignal.risk_per_share">
                  <span class="metric-label">Risk Per Share:</span>
                  <span class="metric-value font-mono">\${{ formatPrice(selectedSignal.risk_per_share, selectedSignal.symbol) }}</span>
                </div>
              </div>

              <!-- Embed reasons inside row click modal as requested -->
              <div class="reasons-box">
                <h4 style="margin: 0 0 8px 0; font-size: 0.9rem; color: #ffffff;">Signal Reasons & Parameters:</h4>
                <div class="modal-reasons-list" style="display: flex; flex-wrap: wrap; gap: 6px;">
                  <span *ngFor="let r of selectedSignal.score_reasons" class="reason-pill" [class.penalty-pill]="isPenalty(r)" style="background: rgba(255,255,255,0.05); color: #9ca3af; padding: 3px 8px; border-radius: 4px; font-size: 0.75rem;">
                    {{ r }}
                  </span>
                  <span *ngIf="!selectedSignal.score_reasons || selectedSignal.score_reasons.length === 0" class="no-reasons">-</span>
                </div>
                <div style="font-size: 0.75rem; color: #6b7280; margin-top: 8px;" *ngIf="selectedSignal.atr_at_signal">
                  ATR at signal: {{ selectedSignal.atr_at_signal | number: '1.2-4' }}
                </div>
              </div>

              <div class="plan-rules" style="margin-top: 16px;">
                <h4 style="margin: 0 0 8px 0; font-size: 0.9rem; color: #ffffff;">Execution Rules:</h4>
                <ul style="margin: 0; padding-left: 18px; font-size: 0.8rem; color: #9ca3af; line-height: 1.45;">
                  <li *ngIf="selectedSignal.direction === 'bullish'">Take partial profit at Target 1 (1:1 Reward to Risk).</li>
                  <li *ngIf="selectedSignal.direction === 'bullish'">Exit main position at Target 2 (2:1 Reward to Risk).</li>
                  <li *ngIf="selectedSignal.direction === 'bullish'">Trail remaining shares using swing levels. Exit remaining if opposite crossover triggers or stop is hit.</li>
                  
                  <li *ngIf="selectedSignal.direction === 'bearish'">Cover partial profit at Target 1 (1:1 Reward to Risk).</li>
                  <li *ngIf="selectedSignal.direction === 'bearish'">Cover main position at Target 2 (2:1 Reward to Risk).</li>
                  <li *ngIf="selectedSignal.direction === 'bearish'">Trail remaining shares using swing levels. Exit remaining if opposite crossover triggers or stop is hit.</li>
                </ul>
              </div>
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
      display: flex;
      flex-direction: column;
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
      opacity: 0.45;
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
      position: relative;
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

    .reasons-popover {
      position: absolute;
      top: 28px;
      right: 0px;
      z-index: 40;
      background: #0b1220;
      border: 1px solid #23303a;
      border-radius: 6px;
      padding: 8px;
      min-width: 200px;
      max-width: 360px;
      box-shadow: 0 6px 18px rgba(2,6,23,0.6);
    }
    .reasons-popover pre {
      margin: 0;
      white-space: pre-wrap;
      color: #cbd5e1;
      font-size: 0.72rem;
    }

    /* Pagination CSS */
    .pagination-bar {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 6px 12px;
      background: #1a1e27;
      border-top: 1px solid #22252a;
    }
    .pag-btn {
      background: #27272a;
      border: 1px solid #3f3f46;
      color: #d1d5db;
      font-size: 0.65rem;
      padding: 2px 8px;
      border-radius: 3px;
      cursor: pointer;
      user-select: none;
    }
    .pag-btn:hover:not([disabled]) {
      background: #3f3f46;
      color: #fff;
    }
    .pag-btn[disabled] {
      opacity: 0.4;
      cursor: not-allowed;
    }
    .pag-info {
      font-size: 0.65rem;
      color: #9ca3af;
    }

    @media (max-width: 1024px) {
      .tables-grid {
        grid-template-columns: 1fr;
        gap: 12px;
      }
    }

    /* Modal styles */
    .modal-overlay {
      position: fixed;
      top: 0;
      left: 0;
      width: 100vw;
      height: 100vh;
      background: rgba(0, 0, 0, 0.7);
      backdrop-filter: blur(4px);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 1000;
    }
    .modal-card {
      background: #15181f;
      border: 1px solid #2a2e39;
      border-radius: 8px;
      width: 95%;
      max-width: 500px;
      padding: 20px;
      box-shadow: 0 10px 25px rgba(0,0,0,0.5);
    }
    .modal-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      border-bottom: 1px solid #2a2e39;
      padding-bottom: 12px;
      margin-bottom: 16px;
    }
    .modal-title {
      font-size: 1.15rem;
      font-weight: 600;
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .modal-symbol {
      color: #ffffff;
    }
    .modal-strategy {
      color: #9ca3af;
      font-size: 0.85rem;
    }
    .modal-direction {
      font-size: 0.8rem;
      padding: 2px 6px;
      border-radius: 4px;
      font-weight: bold;
    }
    .modal-direction.bullish {
      background: rgba(0, 255, 136, 0.1);
      color: #00ff88;
    }
    .modal-direction.bearish {
      background: rgba(255, 74, 74, 0.1);
      color: #ff4a4a;
    }
    .close-btn {
      background: transparent;
      border: none;
      color: #9ca3af;
      font-size: 1.2rem;
      cursor: pointer;
    }
    .close-btn:hover {
      color: #ffffff;
    }
    .alert-box {
      border-radius: 4px;
      padding: 10px 14px;
      font-size: 0.85rem;
      margin-bottom: 16px;
      line-height: 1.4;
    }
    .warning-alert {
      background: rgba(245, 158, 11, 0.1);
      color: #fbbf24;
      border: 1px solid rgba(245, 158, 11, 0.2);
    }
    .danger-alert {
      background: rgba(239, 68, 68, 0.1);
      color: #f87171;
      border: 1px solid rgba(239, 68, 68, 0.2);
    }
    .plan-desc {
      font-size: 0.9rem;
      color: #9ca3af;
      margin-bottom: 16px;
      line-height: 1.45;
    }
    .plan-metrics {
      display: flex;
      flex-direction: column;
      gap: 10px;
      background: #0f1115;
      padding: 14px;
      border-radius: 6px;
      border: 1px solid #2a2e39;
      margin-bottom: 16px;
    }
    .metric-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      font-size: 0.9rem;
    }
    .metric-label {
      color: #9ca3af;
    }
    .metric-value {
      color: #ffffff;
    }
    .metric-value.stop-text {
      color: #f87171;
    }
    .metric-value.target-text {
      color: #34d399;
    }
    .active-target {
      background: rgba(52, 211, 153, 0.05);
      padding: 6px;
      border-radius: 4px;
      border: 1px dashed rgba(52, 211, 153, 0.3);
    }
  `]
})
export class Screener implements OnInit, OnDestroy {
  allSetups: any[] = [];
  filteredBullish: any[] = [];
  filteredBearish: any[] = [];
  totalBullish = 0;
  totalBearish = 0;
  loading = true;
  selectedSignal: any = null;
  openReasonsFor: string | null = null;

  // Pagination parameters
  bullishPage = 1;
  bearishPage = 1;
  pageSize = 20;

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

  constructor(
    private supabaseService: SupabaseService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.fetchData(true);
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
            s.strategy_name === 'golden_death_cross' || 
            s.strategy_name === 'goldencross' ||
            s.group_name.startsWith('GoldenCross -') ||
            (!s.strategy_name && !s.group_name.startsWith('AlphaTrend -'))
          );
          
          this.applyFilters(true);
          this.loading = false;
          this.cdr.detectChanges();
        },
        error: (err) => {
          console.error('Error loading GoldenCross setups:', err);
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
    this.applyFilters(true);
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

  // Getters for Pagination bounds
  get totalBullishPages(): number {
    return Math.ceil(this.totalBullish / this.pageSize) || 1;
  }

  get totalBearishPages(): number {
    return Math.ceil(this.totalBearish / this.pageSize) || 1;
  }

  prevBullishPage(): void {
    if (this.bullishPage > 1) {
      this.bullishPage--;
      this.applyFilters(false);
    }
  }

  nextBullishPage(): void {
    if (this.bullishPage < this.totalBullishPages) {
      this.bullishPage++;
      this.applyFilters(false);
    }
  }

  prevBearishPage(): void {
    if (this.bearishPage > 1) {
      this.bearishPage--;
      this.applyFilters(false);
    }
  }

  nextBearishPage(): void {
    if (this.bearishPage < this.totalBearishPages) {
      this.bearishPage++;
      this.applyFilters(false);
    }
  }

  toggleReasons(s: any, event: Event): void {
    event.stopPropagation();
    if (this.openReasonsFor === s.symbol) {
      this.openReasonsFor = null;
    } else {
      this.openReasonsFor = s.symbol;
    }
  }

  closeReasons(): void {
    this.openReasonsFor = null;
  }

  applyFilters(resetPages = true): void {
    if (resetPages) {
      this.bullishPage = 1;
      this.bearishPage = 1;
    }

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
      } else if (this.sortKey === 'stop_price') {
        valA = Number(a.stop_price) || 0;
        valB = Number(b.stop_price) || 0;
      } else if (this.sortKey === 'target2_price') {
        valA = Number(a.target2_price) || 0;
        valB = Number(b.target2_price) || 0;
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

    // Apply Client-Side Pagination Slicing (20 rows per page)
    const startBull = (this.bullishPage - 1) * this.pageSize;
    this.filteredBullish = bullishList.slice(startBull, startBull + this.pageSize);

    const startBear = (this.bearishPage - 1) * this.pageSize;
    this.filteredBearish = bearishList.slice(startBear, startBear + this.pageSize);
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

  openTradePlan(signal: any): void {
    this.selectedSignal = signal;
  }

  closeTradePlan(): void {
    this.selectedSignal = null;
  }

  getRiskPct(signal: any): number {
    if (!signal || !signal.risk_per_share || !signal.entry_price_est) return 0;
    return (Number(signal.risk_per_share) / Number(signal.entry_price_est)) * 100;
  }

  formatPrice(price: any, symbol: string): string {
    if (price === undefined || price === null || isNaN(Number(price))) return '-';
    const p = Number(price);
    const isCryptoOrFutures = symbol.includes('1!') || symbol.includes('BTC') || symbol.includes('GC') || symbol.includes('SI') || symbol.includes('CL') || symbol.includes('USOIL') || p < 5.0;
    if (isCryptoOrFutures) {
      if (p === 0) return '0.00';
      if (p < 0.1) return p.toFixed(5);
      if (p < 2.0) return p.toFixed(4);
      return p.toString();
    }
    return p.toFixed(2);
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }
}
