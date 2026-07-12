import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule, DecimalPipe } from '@angular/common';
import { MatTableModule } from '@angular/material/table';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { Subject, takeUntil } from 'rxjs';
import { SupabaseService } from '../../services/supabase.service';

@Component({
  selector: 'app-screener',
  standalone: true,
  imports: [
    CommonModule,
    MatTableModule,
    MatButtonModule,
    MatProgressSpinnerModule,
    DecimalPipe
  ],
  template: `
    <div class="screener-container">
      <h2>Golden/Death Cross Screener</h2>
      
      <!-- Group Selection Tabs -->
      <div class="tabs-bar">
        <button 
          mat-stroked-button 
          *ngFor="let grp of groups" 
          [color]="selectedGroup === grp ? 'primary' : ''" 
          [class.active-tab]="selectedGroup === grp"
          (click)="selectedGroup = grp">
          {{ grp }}
        </button>
      </div>

      <div *ngIf="loading" class="spinner-container">
        <mat-spinner diameter="40"></mat-spinner>
        <p>Loading setups from database...</p>
      </div>

      <div *ngIf="!loading && allSetups.length === 0" class="no-data">
        No active setups found. Make sure your TradingView alerts are active and pushing data.
      </div>

      <!-- Side-by-Side Tables Layout -->
      <div *ngIf="!loading && allSetups.length > 0" class="tables-grid">
        
        <!-- Bullish Table -->
        <div class="table-wrapper bullish-wrapper">
          <div class="table-header bullish-header">
            🟢 BULLISH SETUPS
          </div>
          <table mat-table [dataSource]="bullishData" class="mat-elevation-z2">
            <!-- Symbol -->
            <ng-container matColumnDef="symbol">
              <th mat-header-cell *matHeaderCellDef> Symbol </th>
              <td mat-cell *matCellDef="let element">
                <a [href]="'https://finviz.com/quote.ashx?t=' + element.symbol" target="_blank" class="sym-link">
                  {{ element.symbol }}
                </a>
              </td>
            </ng-container>

            <!-- Price -->
            <ng-container matColumnDef="price">
              <th mat-header-cell *matHeaderCellDef> Price </th>
              <td mat-cell *matCellDef="let element">
                \${{ element.price | number: '1.2-2' }}
              </td>
            </ng-container>

            <!-- Chg % -->
            <ng-container matColumnDef="change_pct">
              <th mat-header-cell *matHeaderCellDef> Chg % </th>
              <td mat-cell *matCellDef="let element" [ngStyle]="{'color': element.change_pct >= 0 ? '#00ff88' : '#ff4a4a'}">
                {{ element.change_pct | number: '1.2-2' }}%
              </td>
            </ng-container>

            <!-- RVOL -->
            <ng-container matColumnDef="rvol">
              <th mat-header-cell *matHeaderCellDef> RVOL </th>
              <td mat-cell *matCellDef="let element">
                {{ element.rvol | number: '1.2-2' }}x
              </td>
            </ng-container>

            <!-- VWAP Dist -->
            <ng-container matColumnDef="vwap_dist">
              <th mat-header-cell *matHeaderCellDef> VWAP % </th>
              <td mat-cell *matCellDef="let element" [ngStyle]="{'color': element.vwap_dist >= 0 ? '#00ff88' : '#ff4a4a'}">
                {{ element.vwap_dist | number: '1.2-2' }}%
              </td>
            </ng-container>

            <!-- Score -->
            <ng-container matColumnDef="score">
              <th mat-header-cell *matHeaderCellDef> Score </th>
              <td mat-cell *matCellDef="let element" style="font-weight: bold; color: #00ff88;">
                {{ element.score }}/5
              </td>
            </ng-container>

            <!-- Age -->
            <ng-container matColumnDef="age">
              <th mat-header-cell *matHeaderCellDef> Age </th>
              <td mat-cell *matCellDef="let element" style="color: #888;">
                {{ element.age || '-' }}
              </td>
            </ng-container>

            <tr mat-header-row *matHeaderRowDef="displayedColumns"></tr>
            <tr mat-row *matRowDef="let row; columns: displayedColumns;"></tr>
          </table>
          <div *ngIf="bullishData.length === 0" class="empty-list-msg">
            No bullish setups active for this group.
          </div>
        </div>

        <!-- Bearish Table -->
        <div class="table-wrapper bearish-wrapper">
          <div class="table-header bearish-header">
            🔴 BEARISH SETUPS
          </div>
          <table mat-table [dataSource]="bearishData" class="mat-elevation-z2">
            <!-- Symbol -->
            <ng-container matColumnDef="symbol">
              <th mat-header-cell *matHeaderCellDef> Symbol </th>
              <td mat-cell *matCellDef="let element">
                <a [href]="'https://finviz.com/quote.ashx?t=' + element.symbol" target="_blank" class="sym-link">
                  {{ element.symbol }}
                </a>
              </td>
            </ng-container>

            <!-- Price -->
            <ng-container matColumnDef="price">
              <th mat-header-cell *matHeaderCellDef> Price </th>
              <td mat-cell *matCellDef="let element">
                \${{ element.price | number: '1.2-2' }}
              </td>
            </ng-container>

            <!-- Chg % -->
            <ng-container matColumnDef="change_pct">
              <th mat-header-cell *matHeaderCellDef> Chg % </th>
              <td mat-cell *matCellDef="let element" [ngStyle]="{'color': element.change_pct >= 0 ? '#00ff88' : '#ff4a4a'}">
                {{ element.change_pct | number: '1.2-2' }}%
              </td>
            </ng-container>

            <!-- RVOL -->
            <ng-container matColumnDef="rvol">
              <th mat-header-cell *matHeaderCellDef> RVOL </th>
              <td mat-cell *matCellDef="let element">
                {{ element.rvol | number: '1.2-2' }}x
              </td>
            </ng-container>

            <!-- VWAP Dist -->
            <ng-container matColumnDef="vwap_dist">
              <th mat-header-cell *matHeaderCellDef> VWAP % </th>
              <td mat-cell *matCellDef="let element" [ngStyle]="{'color': element.vwap_dist >= 0 ? '#00ff88' : '#ff4a4a'}">
                {{ element.vwap_dist | number: '1.2-2' }}%
              </td>
            </ng-container>

            <!-- Score -->
            <ng-container matColumnDef="score">
              <th mat-header-cell *matHeaderCellDef> Score </th>
              <td mat-cell *matCellDef="let element" style="font-weight: bold; color: #ff4a4a;">
                {{ element.score }}/5
              </td>
            </ng-container>

            <!-- Age -->
            <ng-container matColumnDef="age">
              <th mat-header-cell *matHeaderCellDef> Age </th>
              <td mat-cell *matCellDef="let element" style="color: #888;">
                {{ element.age || '-' }}
              </td>
            </ng-container>

            <tr mat-header-row *matHeaderRowDef="displayedColumns"></tr>
            <tr mat-row *matRowDef="let row; columns: displayedColumns;"></tr>
          </table>
          <div *ngIf="bearishData.length === 0" class="empty-list-msg">
            No bearish setups active for this group.
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
      margin-bottom: 16px;
      color: #333;
    }
    .tabs-bar {
      margin-bottom: 20px;
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
    }
    .active-tab {
      background-color: #3f51b5 !important;
      color: white !important;
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
      color: #e0e3eb !important;
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
    .empty-list-msg {
      padding: 16px;
      text-align: center;
      color: #888;
      background-color: #131722;
      font-size: 0.85rem;
    }
  `]
})
export class Screener implements OnInit, OnDestroy {
  displayedColumns = ['symbol', 'price', 'change_pct', 'rvol', 'vwap_dist', 'score', 'age'];
  allSetups: any[] = [];
  loading = true;
  selectedGroup = 'Nasdaq 100 - Group 1';
  
  groups = [
    'Nasdaq 100 - Group 1',
    'Nasdaq 100 - Group 2',
    'Nasdaq 100 - Group 3',
    'S&P 500 - Group 1',
    'S&P 500 - Group 2',
    'S&P 500 - Group 3'
  ];

  private destroy$ = new Subject<void>();

  constructor(private supabaseService: SupabaseService) {}

  ngOnInit(): void {
    this.fetchData();
  }

  fetchData(): void {
    this.loading = true;
    this.supabaseService.getScreenerSetups()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (data) => {
          this.allSetups = data;
          this.loading = false;
        },
        error: (err) => {
          console.error('Error loading screener setups:', err);
          this.loading = false;
        }
      });
  }

  get bullishData() {
    return this.allSetups.filter(
      s => s.group_name === this.selectedGroup && s.direction === 'bullish'
    );
  }

  get bearishData() {
    return this.allSetups.filter(
      s => s.group_name === this.selectedGroup && s.direction === 'bearish'
    );
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }
}
