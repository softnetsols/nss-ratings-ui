import { Component } from '@angular/core';
import { MatToolbarModule } from '@angular/material/toolbar';
import { Recommendation } from "./recommendation/recommendation";
import { MatButtonModule } from '@angular/material/button';
import { MostActive } from "./most-active/most-active";
import { CommonModule } from '@angular/common';
import { Watchlist } from "./watchlist/watchlist";
import { Screener } from "./screener/screener";

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
        Screener
    ],
    template: `
    <mat-toolbar color="primary">NSS Group - Stock Recommendations</mat-toolbar>
    <div class="m-2">
      <button mat-button (click)="view = 'recommendations'">View Recommendations</button>
      <button mat-button (click)="view = 'mostactive'">View Most Active</button>
      <button mat-button (click)="view = 'watchlist'">Watch List</button>
      <button mat-button (click)="view = 'screener'">Golden/Death Cross Screener</button>
    </div>
    <app-recommendation *ngIf="view === 'recommendations'"></app-recommendation>
    <app-watchlist *ngIf="view === 'watchlist'"></app-watchlist>
    <app-most-active *ngIf="view === 'mostactive'"></app-most-active>
    <app-screener *ngIf="view === 'screener'"></app-screener>`
})

export class App {
    view = 'recommendations';
}
