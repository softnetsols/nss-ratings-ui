import { Component, OnInit, OnDestroy, ChangeDetectorRef, ViewChild } from '@angular/core';
import { CommonModule, DecimalPipe } from '@angular/common';
import { MatTableModule, MatTableDataSource } from '@angular/material/table';
import { MatSort, MatSortModule } from '@angular/material/sort';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { Subject, takeUntil } from 'rxjs';
import { SupabaseService } from '../../services/supabase.service';

@Component({
  selector: 'app-alphatrend',
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
        <h2>AlphaTrend Pullback Reversal</h2>
        <span class="refresh-indicator" [class.syncing]="loading">
          {{ loading ? 'Updating...' : 'Auto-refreshing in 15s' }}
        </span>
      </div>

      <div *ngIf="loading && allSetups.length === 0" class="spinner-container">
        <mat-spinner diameter="40"></mat-spinner>
        <p>Loading setups from database...</p>
      </div>

      <div *ngIf="!loading && allSetups.length === 0" class="no-data">
        No active setups found. Make sure your TradingView AlphaTrend alerts are active and pushing data.
      </div>

      <!-- Side-by-Side Tables Layout -->
      <div *ngIf="allSetups.length > 0" class="tables-grid">
        
        <!-- Bullish Table -->
        <div class="table-wrapper bullish-wrapper">
          <div class="table-header bullish-header">
            🟢 ALL BULLISH SETUPS ({{ bullishDataSource.data.length }})
          </div>
          <table mat-table [dataSource]="bullishDataSource" matSort #bullishSort="matSort" matSortActive="score" matSortDirection="desc" class="mat-elevation-z2">
            <!-- Symbol -->
            <ng-container matColumnDef="symbol">
              <th mat-header-cell *matHeaderCellDef mat-sort-header> Symbol </th>
              <td mat-cell *matCellDef="let element">
                <a [href]="'https://www.tradingview.com/chart/?symbol=' + element.symbol" target="_blank" class="sym-link" title="Open TradingView Chart">
                  {{ element.symbol }}
                </a>
              </td>
            </ng-container>

            <!-- Price -->
            <ng-container matColumnDef="price">
              <th mat-header-cell *matHeaderCellDef mat-sort-header> Price </th>
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

            <!-- Age -->
            <ng-container matColumnDef="age">
              <th mat-header-cell *matHeaderCellDef mat-sort-header> Age </th>
              <td mat-cell *matCellDef="let element" style="color: #888;">
                {{ element.age || '-' }}
              </td>
            </ng-container>

            <!-- Group Name -->
            <ng-container matColumnDef="group_name">
              <th mat-header-cell *matHeaderCellDef mat-sort-header> Group </th>
              <td mat-cell *matCellDef="let element" class="group-cell">
                {{ element.group_name }}
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
            🔴 ALL BEARISH SETUPS ({{ bearishDataSource.data.length }})
          </div>
          <table mat-table [dataSource]="bearishDataSource" matSort #bearishSort="matSort" matSortActive="score" matSortDirection="desc" class="mat-elevation-z2">
            <!-- Symbol -->
            <ng-container matColumnDef="symbol">
              <th mat-header-cell *matHeaderCellDef mat-sort-header> Symbol </th>
              <td mat-cell *matCellDef="let element">
                <a [href]="'https://www.tradingview.com/chart/?symbol=' + element.symbol" target="_blank" class="sym-link" title="Open TradingView Chart">
                  {{ element.symbol }}
                </a>
              </td>
            </ng-container>

            <!-- Price -->
            <ng-container matColumnDef="price">
              <th mat-header-cell *matHeaderCellDef mat-sort-header> Price </th>
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

            <!-- Age -->
            <ng-container matColumnDef="age">
              <th mat-header-cell *matHeaderCellDef mat-sort-header> Age </th>
              <td mat-cell *matCellDef="let element" style="color: #888;">
                {{ element.age || '-' }}
              </td>
            </ng-container>

            <!-- Group Name -->
            <ng-container matColumnDef="group_name">
              <th mat-header-cell *matHeaderCellDef mat-sort-header> Group </th>
              <td mat-cell *matCellDef="let element" class="group-cell">
                {{ element.group_name }}
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
      padding: 16px 24px;
      color: #fff;
    }
    h2 {
      margin: 0 0 16px 0;
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
    .tables-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 24px;
    }
    .table-wrapper {
      background: #1c2030;
      border-radius: 8px;
      border: 1px solid #2a2e39;
      overflow: hidden;
    }
    .table-header {
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
    table {
      width: 100%;
      background: transparent !important;
      border-collapse: collapse;
    }
    th {
      color: #888 !important;
      font-weight: 500 !important;
      font-size: 0.8rem !important;
      background: #171b26 !important;
      border-bottom: 1px solid #2a2e39 !important;
    }
    td {
      color: #fff !important;
      border-bottom: 1px solid #1e222d !important;
      font-size: 0.85rem !important;
    }
    tr:hover td {
      background: #2a2e39 !important;
    }
    .sym-link {
      color: #2962ff;
      text-decoration: none;
      font-weight: 500;
    }
    .sym-link:hover {
      text-decoration: underline;
    }
    .group-cell {
      color: #aaa !important;
      font-size: 0.8rem !important;
    }
    .actions-container {
      display: flex;
      gap: 8px;
      align-items: center;
    }
    .action-btn {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      transition: transform 0.1s ease;
    }
    .action-btn:hover {
      transform: scale(1.1);
    }
    .empty-list-msg {
      padding: 24px;
      text-align: center;
      color: #888;
      font-size: 0.85rem;
    }
    ::ng-deep .mat-sort-header-container {
      display: flex;
      align-items: center;
    }
    ::ng-deep .mat-sort-header-arrow {
      color: #888 !important;
    }

    /* Mobile Responsive Tables Swipe-Scroll */
    @media (max-width: 1024px) {
      .tables-grid {
        grid-template-columns: 1fr;
        gap: 16px;
      }
    }
    @media (max-width: 768px) {
      .screener-container {
        padding: 12px 10px;
      }
      .table-wrapper {
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
export class AlphaTrend implements OnInit, OnDestroy {
  displayedColumns = ['symbol', 'price', 'change_pct', 'rvol', 'vwap_dist', 'score', 'age', 'group_name', 'actions'];
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
    if (property === 'age') {
      if (!item.age || item.age === '-') return 999999;
      const match = item.age.match(/^(\d+(?:\.\d+)?)(m|h|d)?$/);
      if (!match) return 999999;
      const value = parseFloat(match[1]);
      const unit = match[2];
      if (unit === 'm') return value;
      if (unit === 'h') return value * 60;
      if (unit === 'd') return value * 1440;
      return value;
    }
    return item[property];
  }

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
          const alphaSetups = data
            .filter(s => s.group_name.startsWith('AlphaTrend -'))
            .map(s => ({
              ...s,
              // Strip "AlphaTrend - " prefix for cleaner display on the page
              group_name: s.group_name.replace('AlphaTrend - ', '')
            }));
          
          // Filter duplicates per symbol-group combination
          const uniqueSetups = Array.from(
            new Map(alphaSetups.map(item => [item.symbol + '_' + item.group_name, item])).values()
          );

          this.allSetups = uniqueSetups;
          this.bullishDataSource.data = uniqueSetups.filter(s => s.direction === 'bullish');
          this.bearishDataSource.data = uniqueSetups.filter(s => s.direction === 'bearish');
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

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
    if (this.pollInterval) {
      clearInterval(this.pollInterval);
    }
  }
}
