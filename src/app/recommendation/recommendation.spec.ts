import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HttpClient } from '@angular/common/http';
import { of } from 'rxjs';

import { Recommendation } from './recommendation';

describe('Recommendation', () => {
  let component: Recommendation;
  let fixture: ComponentFixture<Recommendation>;

  beforeEach(async () => {
    const mockHttpClient = {
      get: () => of([])
    };

    await TestBed.configureTestingModule({
      imports: [Recommendation],
      providers: [
        { provide: HttpClient, useValue: mockHttpClient }
      ]
    })
    .compileComponents();

    fixture = TestBed.createComponent(Recommendation);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
