import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of } from 'rxjs';

import { FinnhubService } from '../../services/finnhub.service';
import { MostActive } from './most-active';

describe('MostActive', () => {
  let fixture: ComponentFixture<MostActive>;
  let mockFinnhubService: jasmine.SpyObj<FinnhubService>;

  beforeEach(async () => {
    const finnhubSpy = jasmine.createSpyObj('FinnhubService', ['getMostActive']);

    await TestBed.configureTestingModule({
      imports: [MostActive],
      providers: [{ provide: FinnhubService, useValue: finnhubSpy }]
    }).compileComponents();

    mockFinnhubService = TestBed.inject(FinnhubService) as jasmine.SpyObj<FinnhubService>;
  });

  it('should show a friendly empty state when no stocks are returned', () => {
    mockFinnhubService.getMostActive.and.returnValue(of([]));

    fixture = TestBed.createComponent(MostActive);
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('No active stocks available right now.');
  });
});
