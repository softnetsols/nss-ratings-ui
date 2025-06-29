import { Component, ViewChild, AfterViewInit, inject, OnInit } from '@angular/core';
import { CommonModule, DecimalPipe } from '@angular/common';
import { MatTableModule, MatTableDataSource } from '@angular/material/table';
import { MatSort, MatSortModule } from '@angular/material/sort';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { Firestore, doc, docData } from '@angular/fire/firestore';
import { firstValueFrom, take } from 'rxjs';

@Component({
  selector: 'app-watchlist',
  standalone: true,
  imports: [
    CommonModule,
    MatTableModule,
    MatSortModule,
    MatProgressSpinnerModule,
    DecimalPipe
  ],
  templateUrl: './watchlist.html',
  styleUrls: ['./watchlist.scss']
})
export class Watchlist implements AfterViewInit {
  displayedColumns: string[] = ['symbol', 'price', 'volume', 'marketCap', 'percentChange'];
  dataSource = new MatTableDataSource<any>([]);
  loading = true;
  constructor() {
    // No need to initialize dataSource here, it will be set in ngOnInit
    // All async logic moved to ngOnInit
  }
  // No need to initialize dataSource here, it will be set in ngOnInit


  @ViewChild(MatSort) sort!: MatSort;
  private firestore = inject(Firestore);

  // async ngOnInit() {
  //   this.loading = true; // explicitly set to true on entry

  //   try {
  //     const docRef = doc(this.firestore, 'dailyWatchlist/today');
  //     const data = await firstValueFrom(docData(docRef));

  //     if (data && (data as any).stocks?.length) {
  //       const stocks = (data as any).stocks;
  //       console.log('Watchlist Data:', stocks);
  //       this.dataSource.data = stocks;
  //       this.dataSource.sort = this.sort;
  //     } else {
  //       console.log('No stocks found in watchlist.');
  //       this.dataSource.data = []; // clear if empty
  //     }
  //   } catch (error) {
  //     console.error('Error fetching watchlist:', error);
  //     this.dataSource.data = []; // ensure table clears on error
  //   } finally {
  //     console.log('Watchlist loading complete');
  //     // No need to call reload(); updating dataSource.data is sufficient
  //     this.loading = false;
  //   }
  // }

  ngAfterViewInit() {
    this.loading = true; // start spinner

    const docRef = doc(this.firestore, 'dailyWatchlist/today');

    docData(docRef)
      .pipe(take(1))
      .subscribe({
        next: (data: any) => {
          if (data?.stocks?.length) {
            this.dataSource.data = [...data.stocks];
            // this.dataSource.sort = this.sort;
            this.loading = false; // stop spinner
            console.log('72 Watchlist Data:', data.stocks);

          } else {
            console.log('No stocks found in watchlist.');
            this.dataSource.data = [];
          }
        },
        error: (error) => {
          console.error('Error fetching watchlist:', error);
          this.dataSource.data = [];
        },
        // complete: () => {
        //   this.loading = false; // stop spinner reliably
        //   console.log('86 Watchlist loading complete', this.dataSource.data);
        // }
      });
  }
}
