import { Component } from '@angular/core';
import { MatToolbarModule } from '@angular/material/toolbar';
import { Recommendation } from "./recommendation/recommendation";
import { MatButtonModule } from '@angular/material/button';
import { MostActive } from "./most-active/most-active";
import { CommonModule } from '@angular/common';
import { Watchlist } from "./watchlist/watchlist";
import { Screener } from "./screener/screener";
import { AlphaTrend } from "./alphatrend/alphatrend";
import { Osob } from "./osob/osob";

@Component({
    selector: 'app-root',
    standalone: true,
    imports: [
        CommonModule,
        MatToolbarModule,
        Recommendation,
        MatButtonModule,
        MostActive,
        Watchlist,
        Screener,
        AlphaTrend,
        Osob
    ],
    template: `
    <mat-toolbar color="primary">NSS Group - Stock Recommendations</mat-toolbar>
    <div class="nav-container">
      <button mat-button [class.active]="view === 'alphatrend'" (click)="view = 'alphatrend'">AlphaTrend Pullback</button>
      <button mat-button [class.active]="view === 'screener'" (click)="view = 'screener'">Golden/Death Cross Screener</button>
      <button mat-button [class.active]="view === 'osob'" (click)="view = 'osob'">OSOB Screener</button>
      <button mat-button [class.active]="view === 'watchlist'" (click)="view = 'watchlist'">Watch List</button>
      <button mat-button [class.active]="view === 'recommendations'" (click)="view = 'recommendations'">View Recommendations</button>
      <button mat-button [class.active]="view === 'mostactive'" (click)="view = 'mostactive'">View Most Active</button>
    </div>
    <app-recommendation *ngIf="view === 'recommendations'"></app-recommendation>
    <app-watchlist *ngIf="view === 'watchlist'"></app-watchlist>
    <app-most-active *ngIf="view === 'mostactive'"></app-most-active>
    <app-screener *ngIf="view === 'screener'"></app-screener>
    <app-alphatrend *ngIf="view === 'alphatrend'"></app-alphatrend>
    <app-osob *ngIf="view === 'osob'"></app-osob>`,
    styles: [`
      .nav-container {
        display: flex;
        overflow-x: auto;
        white-space: nowrap;
        gap: 8px;
        padding: 12px 16px;
        background: #f8f9fa;
        border-bottom: 1px solid #eaeaea;
        -webkit-overflow-scrolling: touch;
      }
      .nav-container::-webkit-scrollbar {
        display: none;
      }
      .nav-container button {
        flex: 0 0 auto;
        font-weight: 500;
        border-radius: 20px;
        background: #e0e0e0;
        color: #333;
        margin-right: 4px;
        padding: 0 16px !important;
        font-size: 0.85rem;
      }
      .nav-container button.active {
        background: #1976d2 !important;
        color: white !important;
      }
    `]
})

export class App {
    view = 'alphatrend';
}
