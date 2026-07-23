import { ComponentFixture, TestBed } from '@angular/core/testing';

import { Watchlist } from './watchlist';
import { Firestore } from '@angular/fire/firestore';

describe('Watchlist', () => {
  let component: Watchlist;
  let fixture: ComponentFixture<Watchlist>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Watchlist],
      providers: [
        { provide: Firestore, useValue: {} }
      ]
    })
    .compileComponents();

    fixture = TestBed.createComponent(Watchlist);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
