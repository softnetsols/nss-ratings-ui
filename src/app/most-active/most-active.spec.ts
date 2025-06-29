import { ComponentFixture, TestBed } from '@angular/core/testing';

import { MostActive } from './most-active';

describe('MostActive', () => {
  let component: MostActive;
  let fixture: ComponentFixture<MostActive>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [MostActive]
    })
    .compileComponents();

    fixture = TestBed.createComponent(MostActive);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
