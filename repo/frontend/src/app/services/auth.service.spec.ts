import { TestBed } from '@angular/core/testing';
import { throwError } from 'rxjs';
import { Router } from '@angular/router';
import { ApiService } from './api.service';
import { AuthService } from './auth.service';

describe('AuthService', () => {
  let service: AuthService;
  let apiSpy: jasmine.SpyObj<ApiService>;
  let routerSpy: jasmine.SpyObj<Router>;

  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    apiSpy = jasmine.createSpyObj<ApiService>('ApiService', [
      'loadTokenFromStorage',
      'getToken',
      'getMe',
      'setRole',
      'persistToken',
      'setToken',
      'getRole',
    ]);
    routerSpy = jasmine.createSpyObj<Router>('Router', ['navigateByUrl']);
    apiSpy.getToken.and.returnValue('');
    apiSpy.getRole.and.returnValue('');
    TestBed.configureTestingModule({
      providers: [
        AuthService,
        { provide: ApiService, useValue: apiSpy },
        { provide: Router, useValue: routerSpy },
      ],
    });
    service = TestBed.inject(AuthService);
  });

  it('stores user in sessionStorage when remember is false', () => {
    service.onLoginSuccess({ token: 't1', user: { id: 'u1', role: 'billing' }, role: 'billing' }, false);
    expect(apiSpy.persistToken).toHaveBeenCalledWith('t1', false);
    expect(sessionStorage.getItem('user')).toContain('"id":"u1"');
    expect(localStorage.getItem('user')).toBeNull();
  });

  it('keeps session on transient validate failures when cached user exists', async () => {
    apiSpy.getToken.and.returnValue('token-1');
    service.currentUser.set({ id: 'u1', role: 'admin' } as any);
    apiSpy.getMe.and.returnValue(throwError(() => ({ status: 502 })));
    const valid = await service.validateSession({ logoutOnUnauthorized: false, allowCachedOnError: true });
    expect(valid).toBeTrue();
    expect(routerSpy.navigateByUrl).not.toHaveBeenCalled();
  });

  it('fails closed on unauthorized validate response', async () => {
    apiSpy.getToken.and.returnValue('token-1');
    apiSpy.getMe.and.returnValue(throwError(() => ({ status: 401 })));
    const valid = await service.validateSession({ logoutOnUnauthorized: true, allowCachedOnError: true });
    expect(valid).toBeFalse();
    expect(routerSpy.navigateByUrl).toHaveBeenCalledWith('/');
  });
});
