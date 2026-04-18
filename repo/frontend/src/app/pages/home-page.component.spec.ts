import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { provideRouter } from '@angular/router';
import { HomePageComponent } from './home-page.component';
import { ApiService } from '../services/api.service';
import { AuthService } from '../services/auth.service';

describe('HomePageComponent', () => {
  let fixture: ComponentFixture<HomePageComponent>;
  let component: HomePageComponent;
  let apiSpy: jasmine.SpyObj<ApiService>;
  let authSpy: jasmine.SpyObj<AuthService>;

  const mockKpis = {
    orderVolume: 42,
    acceptanceRate: 0.85,
    fulfillmentTimeMinutes: 30,
    cancellationRate: 0.05,
    totalEncounters: 10,
    totalPatients: 8,
    totalPrescriptions: 20,
    lowStockItems: 2,
  };

  const mockOverview = {
    kpis: mockKpis,
    recentOperations: [
      { type: 'encounter', id: 'e1', summary: 'Encounter created' },
      { type: 'invoice', id: 'i1', summary: 'Invoice ****' },
    ],
  };

  beforeEach(async () => {
    apiSpy = jasmine.createSpyObj<ApiService>('ApiService', ['getKpis', 'getOverview']);
    authSpy = jasmine.createSpyObj<AuthService>('AuthService', ['getRole', 'isAuthenticated']);
    apiSpy.getKpis.and.returnValue(of(mockKpis));
    apiSpy.getOverview.and.returnValue(of(mockOverview));
    authSpy.getRole.and.returnValue('admin');
    authSpy.isAuthenticated.and.returnValue(true);

    await TestBed.configureTestingModule({
      imports: [HomePageComponent],
      providers: [
        provideRouter([]),
        { provide: ApiService, useValue: apiSpy },
        { provide: AuthService, useValue: authSpy },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(HomePageComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('loads KPIs on init', () => {
    expect(apiSpy.getKpis).toHaveBeenCalled();
    expect(component.kpis()).toEqual(mockKpis);
  });

  it('loads overview on init', () => {
    expect(apiSpy.getOverview).toHaveBeenCalled();
    expect(component.overview()).toEqual(mockOverview);
  });

  it('getCurrentDate returns a non-empty string', () => {
    const d = component.getCurrentDate();
    expect(typeof d).toBe('string');
    expect(d.length).toBeGreaterThan(0);
  });

  it('formatDate returns a readable string', () => {
    const formatted = component.formatDate('2024-01-15T12:00:00Z');
    expect(typeof formatted).toBe('string');
    expect(formatted.length).toBeGreaterThan(0);
  });

  it('handles KPI load error gracefully without throwing', () => {
    apiSpy.getKpis.and.returnValue(throwError(() => ({ status: 500 })));
    apiSpy.getOverview.and.returnValue(of(mockOverview));
    // should not throw
    expect(() => component.loadData()).not.toThrow();
  });

  it('handles overview load error gracefully without throwing', () => {
    apiSpy.getKpis.and.returnValue(of(mockKpis));
    apiSpy.getOverview.and.returnValue(throwError(() => ({ status: 403 })));
    expect(() => component.loadData()).not.toThrow();
  });

  it('kpis signal starts null before load', () => {
    // Create a fresh component with error-returning api to verify null start
    apiSpy.getKpis.and.returnValue(throwError(() => ({ status: 500 })));
    apiSpy.getOverview.and.returnValue(throwError(() => ({ status: 500 })));
    const newFixture = TestBed.createComponent(HomePageComponent);
    const newComponent = newFixture.componentInstance;
    // Before detectChanges, kpis should be null (signal initial value)
    expect(newComponent.kpis()).toBeNull();
    expect(newComponent.overview()).toBeNull();
    // detectChanges triggers ngOnInit, errors fire, signals stay null
    newFixture.detectChanges();
    expect(newComponent.kpis()).toBeNull();
    expect(newComponent.overview()).toBeNull();
  });
});
