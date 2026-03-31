import { Injectable, signal } from '@angular/core';
import { Router } from '@angular/router';
import { ApiService } from './api.service';

@Injectable({ providedIn: 'root' })
export class AuthService {
  readonly currentUser = signal<any>(null);

  constructor(private api: ApiService, private router: Router) {}

  bootstrap() {
    this.api.loadTokenFromStorage();
    // Restore user from sessionStorage first, then localStorage (remembered)
    const user = sessionStorage.getItem('user') || localStorage.getItem('user');
    if (user) {
      const parsed = JSON.parse(user);
      this.currentUser.set(parsed);
      if (parsed?.role) this.api.setRole(parsed.role);
      return;
    }
    if (this.api.getToken()) {
      this.api.getMe().subscribe({
        next: (u: any) => {
          this.currentUser.set(u);
          localStorage.setItem('user', JSON.stringify(u));
          if (u?.role) this.api.setRole(u.role);
        },
        error: () => {
          // Clear invalid persisted auth state to avoid router redirect loops.
          this.logout();
        },
      });
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
}
