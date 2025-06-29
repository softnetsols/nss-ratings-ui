import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { FinnhubService } from '../../services/finnhub.service';
import { MatTableModule } from '@angular/material/table';
import { MatTableDataSource } from '@angular/material/table';

// @Component({
//   selector: 'app-recommendation',
//   imports: [],
//   templateUrl: './recommendation.html',
//   styleUrl: './recommendation.scss'
// })
// export class Recommendation {

// }

@Component({
  selector: 'app-recommendation',
  standalone: true,
  imports: [CommonModule, MatCardModule, MatTableModule],
  templateUrl: './recommendation.html'
})
export class Recommendation implements OnInit {
  dataSource = new MatTableDataSource<any>([]);
  symbols = ['AAPL', 'TSLA', 'MSFT'];
   displayedColumns: string[] = ['date', 'symbol', 'company', 'action', 'newGrade', 'previousGrade', 'price', 'source'];

  constructor(private finnhub: FinnhubService) {}

  ngOnInit(): void {
    // this.symbols.forEach(symbol => {
      // this.finnhub.getRecommendation(symbol).subscribe(res => {
      this.finnhub.getUpgradesDowngrades().subscribe(res => {
        console.log('1 recommendation', res);
        this.dataSource.data = res;
      });
    // });
  }
}