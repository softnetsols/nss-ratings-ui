import { Component, OnInit, OnDestroy, ChangeDetectorRef, ViewChild } from '@angular/core';
import { CommonModule, DecimalPipe } from '@angular/common';
import { MatTableModule, MatTableDataSource } from '@angular/material/table';
import { MatSort, MatSortModule } from '@angular/material/sort';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { Subject, takeUntil } from 'rxjs';
import { SupabaseService } from '../../services/supabase.service';

@Component({
  selector: 'app-custom-group',
  standalone: true,
  imports: [
    CommonModule,
    MatTableModule,
    MatSortModule,
    MatProgressSpinnerModule,
    DecimalPipe
  ],
  template: `
    <div class="screener-container">
      <div style="display: flex; justify-content: space-between; align-items: center;">
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

      <div *ngIf="loading && allSetups.length === 0" class="spinner-container">
        <mat-spinner diameter="40"></mat-spinner>
        <p>Loading custom setups from database...</p>
      </div>

      <div *ngIf="!loading && allSetups.length === 0" class="no-data">
        No active setups found for Custom List. Make sure your "Custom List" alert is running in TradingView.
      </div>

      <!-- Side-by-Side Tables Layout -->
      <div *ngIf="allSetups.length > 0" class="tables-grid">
        
        <!-- Bullish Table -->
        <div class="table-wrapper bullish-wrapper">
          <div class="table-header bullish-header">
            🟢 BULLISH CUSTOM SETUPS ({{ bullishDataSource.data.length }})
          </div>
          <table mat-table [dataSource]="bullishDataSource" matSort #bullishSort="matSort" matSortActive="updated_at" matSortDirection="desc" class="mat-elevation-z2">
            <!-- Symbol -->
            <ng-container matColumnDef="symbol">
              <th mat-header-cell *matHeaderCellDef mat-sort-header> Symbol </th>
              <td mat-cell *matCellDef="let element">
                <a [href]="'https://www.tradingview.com/chart/?symbol=' + element.symbol" target="_blank" class="sym-link" title="Open TradingView Chart">
                  {{ element.symbol }}
                </a>
              </td>
            </ng-container>

            <!-- Trigger Price -->
            <ng-container matColumnDef="trigger_price">
              <th mat-header-cell *matHeaderCellDef mat-sort-header> Trigger Price </th>
              <td mat-cell *matCellDef="let element">
                \${{ (element.trigger_price || element.price) | number: '1.2-2' }}
              </td>
            </ng-container>

            <!-- Price -->
            <ng-container matColumnDef="price">
              <th mat-header-cell *matHeaderCellDef mat-sort-header> Current Price </th>
              <td mat-cell *matCellDef="let element">
                \${{ element.price | number: '1.2-2' }}
              </td>
            </ng-container>

            <!-- Chg % -->
            <ng-container matColumnDef="change_pct">
              <th mat-header-cell *matHeaderCellDef mat-sort-header> Chg % </th>
              <td mat-cell *matCellDef="let element" [ngStyle]="{'color': element.change_pct >= 0 ? '#00ff88' : '#ff4a4a'}">
                {{ element.change_pct | number: '1.2-2' }}%
              </td>
            </ng-container>

            <!-- RVOL -->
            <ng-container matColumnDef="rvol">
              <th mat-header-cell *matHeaderCellDef mat-sort-header> RVOL </th>
              <td mat-cell *matCellDef="let element">
                {{ element.rvol | number: '1.2-2' }}x
              </td>
            </ng-container>

            <!-- VWAP Dist -->
            <ng-container matColumnDef="vwap_dist">
              <th mat-header-cell *matHeaderCellDef mat-sort-header> VWAP % </th>
              <td mat-cell *matCellDef="let element" [ngStyle]="{'color': element.vwap_dist >= 0 ? '#00ff88' : '#ff4a4a'}">
                {{ element.vwap_dist | number: '1.2-2' }}%
              </td>
            </ng-container>

            <!-- Score -->
            <ng-container matColumnDef="score">
              <th mat-header-cell *matHeaderCellDef mat-sort-header> Score </th>
              <td mat-cell *matCellDef="let element" style="font-weight: bold; color: #00ff88;">
                {{ element.score }}/5
              </td>
            </ng-container>

            <!-- Trigger Time (updated_at) -->
            <ng-container matColumnDef="updated_at">
              <th mat-header-cell *matHeaderCellDef mat-sort-header> Trigger Time </th>
              <td mat-cell *matCellDef="let element" style="color: #bbb;">
                {{ element.updated_at ? (element.updated_at | date: 'MM/dd HH:mm') : '-' }}
              </td>
            </ng-container>

            <!-- Actions -->
            <ng-container matColumnDef="actions">
              <th mat-header-cell *matHeaderCellDef> Actions </th>
              <td mat-cell *matCellDef="let element">
                <div class="actions-container">
                  <a [href]="'https://www.tradingview.com/chart/?symbol=' + element.symbol" target="_blank" title="Open TradingView Chart" class="action-btn">
                    <svg viewBox="0 0 36 36" width="22" height="22" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <circle cx="18" cy="18" r="16" fill="#131722" stroke="#2962ff" stroke-width="1.5"/>
                      <path d="M12 24V16H15V24H12ZM17 24V10H20V24H17ZM22 24V14H25V24H22Z" fill="#2962ff"/>
                    </svg>
                  </a>
                  <a [href]="'https://finviz.com/quote.ashx?t=' + element.symbol" target="_blank" title="Open Finviz Analysis" class="action-btn">
                    <svg viewBox="0 0 36 36" width="22" height="22" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <circle cx="18" cy="18" r="16" fill="#131722" stroke="#388e3c" stroke-width="1.5"/>
                      <path d="M14 22V14H16V22H14ZM14 18H10V16H14V18ZM20 26V10H22V26H20ZM26 20V12H28V20H26ZM26 16H22V14H26V16Z" fill="#388e3c"/>
                    </svg>
                  </a>
                </div>
              </td>
            </ng-container>

            <tr mat-header-row *matHeaderRowDef="displayedColumns"></tr>
            <tr mat-row *matRowDef="let row; columns: displayedColumns;"></tr>
          </table>
          <div *ngIf="bullishDataSource.data.length === 0" class="empty-list-msg">
            No bullish setups active.
          </div>
        </div>

        <!-- Bearish Table -->
        <div class="table-wrapper bearish-wrapper">
          <div class="table-header bearish-header">
            🔴 BEARISH CUSTOM SETUPS ({{ bearishDataSource.data.length }})
          </div>
          <table mat-table [dataSource]="bearishDataSource" matSort #bearishSort="matSort" matSortActive="updated_at" matSortDirection="desc" class="mat-elevation-z2">
            <!-- Symbol -->
            <ng-container matColumnDef="symbol">
              <th mat-header-cell *matHeaderCellDef mat-sort-header> Symbol </th>
              <td mat-cell *matCellDef="let element">
                <a [href]="'https://www.tradingview.com/chart/?symbol=' + element.symbol" target="_blank" class="sym-link" title="Open TradingView Chart">
                  {{ element.symbol }}
                </a>
              </td>
            </ng-container>

            <!-- Trigger Price -->
            <ng-container matColumnDef="trigger_price">
              <th mat-header-cell *matHeaderCellDef mat-sort-header> Trigger Price </th>
              <td mat-cell *matCellDef="let element">
                \${{ (element.trigger_price || element.price) | number: '1.2-2' }}
              </td>
            </ng-container>

            <!-- Price -->
            <ng-container matColumnDef="price">
              <th mat-header-cell *matHeaderCellDef mat-sort-header> Current Price </th>
              <td mat-cell *matCellDef="let element">
                \${{ element.price | number: '1.2-2' }}
              </td>
            </ng-container>

            <!-- Chg % -->
            <ng-container matColumnDef="change_pct">
              <th mat-header-cell *matHeaderCellDef mat-sort-header> Chg % </th>
              <td mat-cell *matCellDef="let element" [ngStyle]="{'color': element.change_pct >= 0 ? '#00ff88' : '#ff4a4a'}">
                {{ element.change_pct | number: '1.2-2' }}%
              </td>
            </ng-container>

            <!-- RVOL -->
            <ng-container matColumnDef="rvol">
              <th mat-header-cell *matHeaderCellDef mat-sort-header> RVOL </th>
              <td mat-cell *matCellDef="let element">
                {{ element.rvol | number: '1.2-2' }}x
              </td>
            </ng-container>

            <!-- VWAP Dist -->
            <ng-container matColumnDef="vwap_dist">
              <th mat-header-cell *matHeaderCellDef mat-sort-header> VWAP % </th>
              <td mat-cell *matCellDef="let element" [ngStyle]="{'color': element.vwap_dist >= 0 ? '#00ff88' : '#ff4a4a'}">
                {{ element.vwap_dist | number: '1.2-2' }}%
              </td>
            </ng-container>

            <!-- Score -->
            <ng-container matColumnDef="score">
              <th mat-header-cell *matHeaderCellDef mat-sort-header> Score </th>
              <td mat-cell *matCellDef="let element" style="font-weight: bold; color: #ff4a4a;">
                {{ element.score }}/5
              </td>
            </ng-container>

            <!-- Trigger Time (updated_at) -->
            <ng-container matColumnDef="updated_at">
              <th mat-header-cell *matHeaderCellDef mat-sort-header> Trigger Time </th>
              <td mat-cell *matCellDef="let element" style="color: #bbb;">
                {{ element.updated_at ? (element.updated_at | date: 'MM/dd HH:mm') : '-' }}
              </td>
            </ng-container>

            <!-- Actions -->
            <ng-container matColumnDef="actions">
              <th mat-header-cell *matHeaderCellDef> Actions </th>
              <td mat-cell *matCellDef="let element">
                <div class="actions-container">
                  <a [href]="'https://www.tradingview.com/chart/?symbol=' + element.symbol" target="_blank" title="Open TradingView Chart" class="action-btn">
                    <svg viewBox="0 0 36 36" width="22" height="22" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <circle cx="18" cy="18" r="16" fill="#131722" stroke="#2962ff" stroke-width="1.5"/>
                      <path d="M12 24V16H15V24H12ZM17 24V10H20V24H17ZM22 24V14H25V24H22Z" fill="#2962ff"/>
                    </svg>
                  </a>
                  <a [href]="'https://finviz.com/quote.ashx?t=' + element.symbol" target="_blank" title="Open Finviz Analysis" class="action-btn">
                    <svg viewBox="0 0 36 36" width="22" height="22" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <circle cx="18" cy="18" r="16" fill="#131722" stroke="#388e3c" stroke-width="1.5"/>
                      <path d="M14 22V14H16V22H14ZM14 18H10V16H14V18ZM20 26V10H22V26H20ZM26 20V12H28V20H26ZM26 16H22V14H26V16Z" fill="#388e3c"/>
                    </svg>
                  </a>
                </div>
              </td>
            </ng-container>

            <tr mat-header-row *matHeaderRowDef="displayedColumns"></tr>
            <tr mat-row *matRowDef="let row; columns: displayedColumns;"></tr>
          </table>
          <div *ngIf="bearishDataSource.data.length === 0" class="empty-list-msg">
            No bearish setups active.
          </div>
        </div>

      </div>
    </div>
  `,
  styles: [`
    .screener-container {
      padding: 16px;
      font-family: Roboto, "Helvetica Neue", sans-serif;
    }
    h2 {
      margin: 0;
      color: #333;
    }
    .manual-refresh-btn {
      background: #1976d2;
      color: white;
      border: none;
      padding: 6px 12px;
      font-size: 0.8rem;
      font-weight: 500;
      border-radius: 4px;
      cursor: pointer;
      display: inline-flex;
      align-items: center;
      gap: 6px;
      transition: background 0.2s;
    }
    .manual-refresh-btn:hover {
      background: #1565c0;
    }
    .manual-refresh-btn:disabled {
      background: #ccc;
      color: #666;
      cursor: not-allowed;
    }
    .refresh-indicator {
      font-size: 0.75rem;
      color: #777;
      background: #f0f2f5;
      padding: 4px 8px;
      border-radius: 12px;
      transition: all 0.3s ease;
    }
    .syncing {
      background: #e3f2fd;
      color: #1976d2;
    }
    .spinner-container {
      display: flex;
      flex-direction: column;
      align-items: center;
      margin-top: 40px;
      gap: 12px;
      color: #666;
    }
    .no-data {
      padding: 24px;
      text-align: center;
      background: #f5f5f5;
      border-radius: 4px;
      color: #666;
    }
    .tables-grid {
      display: flex;
      flex-wrap: wrap;
      gap: 24px;
      margin-top: 16px;
      align-items: flex-start;
    }
    .table-wrapper {
      flex: 1;
      min-width: 340px;
      background: #1e1e1e;
      border-radius: 6px;
      overflow: hidden;
      box-shadow: 0 4px 10px rgba(0,0,0,0.15);
    }
    .table-header {
      padding: 10px 16px;
      font-weight: bold;
      color: white;
      font-size: 0.95rem;
    }
    .bullish-header {
      background-color: #0d2c1d;
    }
    .bearish-header {
      background-color: #3b1212;
    }
    table {
      width: 100%;
      background: #131722 !important;
    }
    th {
      color: #888 !important;
      font-weight: bold;
      font-size: 0.8rem;
    }
    td {
      color: #e0e3eb;
      font-size: 0.85rem;
      border-bottom-color: #2a2e39 !important;
    }
    tr:hover td {
      background-color: #1c2030 !important;
    }
    .sym-link {
      color: #29b6f6;
      text-decoration: none;
      font-weight: bold;
    }
    .sym-link:hover {
      text-decoration: underline;
    }
    .actions-container {
      display: flex;
      gap: 8px;
      align-items: center;
    }
    .action-btn {
      display: inline-flex;
      cursor: pointer;
      transition: transform 0.15s ease;
    }
    .action-btn:hover {
      transform: scale(1.15);
    }
    .empty-list-msg {
      padding: 16px;
      text-align: center;
      color: #888;
      background-color: #131722;
      font-size: 0.85rem;
    }
    ::ng-deep .mat-sort-header-container {
      justify-content: flex-start;
    }
    ::ng-deep .mat-sort-header-arrow {
      color: #888 !important;
    }
    @media (max-width: 768px) {
      .tables-grid {
        flex-direction: column;
        gap: 16px;
      }
      .table-wrapper {
        min-width: 100% !important;
        overflow-x: auto !important;
        -webkit-overflow-scrolling: touch;
      }
      table {
        min-width: 650px !important;
      }
      th, td {
        padding: 8px 4px !important;
        font-size: 0.78rem !important;
      }
    }
  `]
})
export class CustomGroup implements OnInit, OnDestroy {
  displayedColumns = ['symbol', 'trigger_price', 'price', 'change_pct', 'rvol', 'vwap_dist', 'score', 'updated_at', 'actions'];
  allSetups: any[] = [];
  loading = true;
  
  bullishDataSource = new MatTableDataSource<any>([]);
  bearishDataSource = new MatTableDataSource<any>([]);

  private destroy$ = new Subject<void>();
  private pollInterval: any;

  @ViewChild('bullishSort', { static: false }) set bullishSort(sort: MatSort) {
    this.bullishDataSource.sortingDataAccessor = (item, property) => this.customSortAccessor(item, property);
    this.bullishDataSource.sort = sort;
  }
  @ViewChild('bearishSort', { static: false }) set bearishSort(sort: MatSort) {
    this.bearishDataSource.sortingDataAccessor = (item, property) => this.customSortAccessor(item, property);
    this.bearishDataSource.sort = sort;
  }

  customSortAccessor(item: any, property: string): string | number {
    if (property === 'updated_at') {
      return item.updated_at ? new Date(item.updated_at).getTime() : 0;
    }
    return item[property];
  }

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
          const customSetups = data.filter(s => s.group_name.startsWith('Custom'));
          
          const uniqueCustom = Array.from(
            new Map(customSetups.map(item => [item.symbol, item])).values()
          );

          this.allSetups = uniqueCustom;
          this.bullishDataSource.data = uniqueCustom.filter(s => s.direction === 'bullish');
          this.bearishDataSource.data = uniqueCustom.filter(s => s.direction === 'bearish');
          this.loading = false;
          this.cdr.detectChanges();
        },
        error: (err) => {
          console.error('Error loading screener setups:', err);
          this.loading = false;
          this.cdr.detectChanges();
        }
      });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
    if (this.pollInterval) {
      clearInterval(this.pollInterval);
    }
  }
}
