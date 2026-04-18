import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { AuthService } from './auth.service';
import { RoleGuard } from './role-guard.service';

describe('RoleGuard', () => {
  let authSpy: jasmine.SpyObj<AuthService>;
  let routerSpy: jasmine.SpyObj<Router>;

  const fakeTree: any = { toString: () => '/' };

  beforeEach(() => {
    authSpy = jasmine.createSpyObj<AuthService>('AuthService', [
      'validateSession',
      'isAuthenticated',
      'getRole',
    ]);
    routerSpy = jasmine.createSpyObj<Router>('Router', ['parseUrl']);
    routerSpy.parseUrl.and.returnValue(fakeTree);

    TestBed.configureTestingModule({
      providers: [
        { provide: AuthService, useValue: authSpy },
        { provide: Router, useValue: routerSpy },
      ],
    });
  });

  async function runGuard(allowed: string[]): Promise<boolean | any> {
    const guard = RoleGuard(allowed);
    return TestBed.runInInjectionContext(() => (guard as any)());
  }

  it('redirects to / when session is invalid', async () => {
    authSpy.validateSession.and.returnValue(Promise.resolve(false));
    authSpy.isAuthenticated.and.returnValue(false);
    authSpy.getRole.and.returnValue('');
    const result = await runGuard(['admin']);
    expect(result).toBe(fakeTree);
    expect(routerSpy.parseUrl).toHaveBeenCalledWith('/');
  });

  it('redirects to / when authenticated but role not allowed', async () => {
    authSpy.validateSession.and.returnValue(Promise.resolve(true));
    authSpy.isAuthenticated.and.returnValue(true);
    authSpy.getRole.and.returnValue('billing');
    const result = await runGuard(['admin', 'physician']);
    expect(result).toBe(fakeTree);
  });

  it('returns true when role is in allowed list', async () => {
    authSpy.validateSession.and.returnValue(Promise.resolve(true));
    authSpy.isAuthenticated.and.returnValue(true);
    authSpy.getRole.and.returnValue('admin');
    const result = await runGuard(['admin', 'physician']);
    expect(result).toBeTrue();
  });

  it('returns true when allowed list is empty (any authenticated role)', async () => {
    authSpy.validateSession.and.returnValue(Promise.resolve(true));
    authSpy.isAuthenticated.and.returnValue(true);
    authSpy.getRole.and.returnValue('auditor');
    const result = await runGuard([]);
    expect(result).toBeTrue();
  });

  it('redirects when authenticated but role is empty string', async () => {
    authSpy.validateSession.and.returnValue(Promise.resolve(true));
    authSpy.isAuthenticated.and.returnValue(true);
    authSpy.getRole.and.returnValue('');
    const result = await runGuard(['admin']);
    expect(result).toBe(fakeTree);
  });
});
