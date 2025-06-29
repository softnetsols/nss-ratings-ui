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

  @ViewChild(MatSort, { static: true }) sort!: MatSort;

  constructor(private finnhub: FinnhubService) { }

  ngOnInit(): void {
    this.finnhub.getMostActive().subscribe(res => {
      res = res.filter((item: any) => item.price > 1); // Filter out items with price 0
      console.log('Most Active Data:', res);
      this.dataSource.data = res;
      this.dataSource.sort = this.sort;
    });
  }
}
