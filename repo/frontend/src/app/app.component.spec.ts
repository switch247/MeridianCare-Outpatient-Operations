import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { AppComponent } from './app.component';
import { ApiService } from './services/api.service';
import { AuthService } from './services/auth.service';

describe('AppComponent', () => {
  const apiMock: any = {
    getKpis: () => of({}),
    getToken: () => '',
  };
  const authMock: any = {
    isAuthenticated: () => false,
    bootstrap: () => {},
    login: () => of({ role: 'guest', token: 't', user: { username: 'u', role: 'guest' } }),
    onLoginSuccess: () => {},
    logout: () => {},
    hasRole: () => false,
    getRole: () => 'guest',
    currentUser: () => null,
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AppComponent],
      providers: [
        provideRouter([]),
        { provide: ApiService, useValue: apiMock },
        { provide: AuthService, useValue: authMock },
      ],
    }).compileComponents();
  });

  it('should create the app', () => {
    const fixture = TestBed.createComponent(AppComponent);
    const app = fixture.componentInstance;
    expect(app).toBeTruthy();
  });

  it('shows login view when unauthenticated', () => {
    const fixture = TestBed.createComponent(AppComponent);
    fixture.detectChanges();
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('h1')?.textContent).toContain('Outpatient Operations');
  });
});
