import { Injectable, signal } from '@angular/core';
import { Router } from '@angular/router';
import { ApiService } from './api.service';
import { firstValueFrom } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class AuthService {
  readonly currentUser = signal<any>(null);

  constructor(private api: ApiService, private router: Router) {}

  bootstrap() {
    this.api.loadTokenFromStorage();
    try {
      const user = sessionStorage.getItem('user') || localStorage.getItem('user');
      if (user) {
        const parsed = JSON.parse(user);
        this.currentUser.set(parsed);
        if (parsed?.role) this.api.setRole(parsed.role);
      }
    } catch {
      localStorage.removeItem('user');
      sessionStorage.removeItem('user');
      this.currentUser.set(null);
    }
    if (this.api.getToken() && !this.currentUser()) {
      this.validateSession({ logoutOnUnauthorized: true, allowCachedOnError: true }).catch(() => {
        // avoid hard logout on transient bootstrap failures
      });
    }
  }

  async validateSession(options?: { logoutOnUnauthorized?: boolean; allowCachedOnError?: boolean }): Promise<boolean> {
    const logoutOnUnauthorized = options?.logoutOnUnauthorized ?? false;
    const allowCachedOnError = options?.allowCachedOnError ?? true;
    if (!this.api.getToken()) return false;
    try {
      const user = (await firstValueFrom(this.api.getMe())) as any;
      if (!user?.id || !user?.role) {
        if (logoutOnUnauthorized) this.logout();
        return false;
      }
      this.currentUser.set(user);
      if (sessionStorage.getItem('token')) sessionStorage.setItem('user', JSON.stringify(user));
      else localStorage.setItem('user', JSON.stringify(user));
      this.api.setRole(user.role);
      return true;
    } catch (err: any) {
      const status = Number(err?.status || err?.error?.code || 0);
      if (status === 401 || status === 403) {
        if (logoutOnUnauthorized) this.logout();
        return false;
      }
      if (allowCachedOnError && !!this.currentUser() && !!this.api.getToken()) {
        return true;
      }
      return false;
    }
  }

  login(username: string, password: string, remember = false) {
    return this.api.login(username, password);
  }

  onLoginSuccess(res: any, remember = false) {
    this.api.persistToken(res.token, remember);
    if (res.user) {
      this.currentUser.set(res.user);
      // Store user profile in sessionStorage by default; persist in localStorage only when requested
      if (remember) localStorage.setItem('user', JSON.stringify(res.user));
      else sessionStorage.setItem('user', JSON.stringify(res.user));
    }
    if (res.role) this.api.setRole(res.role);
  }

  logout() {
    this.api.setToken('');
    // Remove auth artifacts without wiping unrelated localStorage keys
    localStorage.removeItem('token');
    sessionStorage.removeItem('token');
    localStorage.removeItem('user');
    sessionStorage.removeItem('user');
    localStorage.removeItem('role');
    sessionStorage.removeItem('role');
    this.currentUser.set(null);
    this.api.setRole('');
    this.router.navigateByUrl('/');
  }

  getRole() {
    return this.currentUser()?.role || this.api.getRole();
  }

  hasRole(roles: string[]) {
    const role = this.getRole();
    return !!role && roles.includes(role);
  }

  isAuthenticated() {
    const hasToken = !!this.api.getToken();
    const hasRole = !!this.getRole();
    return hasToken && hasRole;
  }

  user() {
    return this.currentUser();
  }

  can(permission: string): boolean {
    const role = this.getRole();
    if (!role) return false;

    const rolePermissions: Record<string, string[]> = {
      physician: ['encounter:write','encounter:sign','prescription:write','prescription:override','audit:self','patient:read','patient:write'],
      pharmacist: ['prescription:review','prescription:approve','prescription:dispense','prescription:void','inventory:write'],
      billing: ['billing:write','invoice:payment','patient:read'],
      inventory: ['inventory:write','inventory:count','product:configure'],
      admin: ['*','admin:unlock','patient:read','patient:write','patient:delete'],
      auditor: ['audit:read','audit:export','patient:read'],
      guest: []
    };

    const perms = rolePermissions[role] || [];
    return perms.includes('*') || perms.includes(permission);
  }
}
