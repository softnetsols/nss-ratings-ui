import { Component, ViewChild } from '@angular/core';
import { FinnhubService } from '../../services/finnhub.service';
import { CommonModule } from '@angular/common';
import { MatTableDataSource, MatTableModule } from '@angular/material/table';
import { MatSort, MatSortModule } from '@angular/material/sort';

@Component({
  selector: 'app-most-active',
  imports: [CommonModule, MatTableModule, MatSortModule],
  templateUrl: './most-active.html',
  styleUrl: './most-active.scss'
})
export class MostActive {

  dataSource = new MatTableDataSource<any>([]);
  displayedColumns: string[] = ['symbol', 'name', 'price', 'change', 'changesPercentage'];
  hasError = false;
  loading = true;
  emptyMessage = 'No active stocks available right now.';

  @ViewChild(MatSort, { static: true }) sort!: MatSort;

  constructor(private finnhub: FinnhubService) { }

  ngOnInit(): void {
    this.finnhub.getMostActive().subscribe({
      next: (res) => {
        const filtered = Array.isArray(res) ? res.filter((item: any) => item?.price > 1) : [];
        this.dataSource.data = filtered;
        this.dataSource.sort = this.sort;
        this.hasError = false;
        this.loading = false;
      },
      error: () => {
        this.hasError = true;
        this.loading = false;
        this.dataSource.data = [];
      }
    });
  }
}
