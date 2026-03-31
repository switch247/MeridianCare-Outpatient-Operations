import { Injectable, signal } from '@angular/core';
import { Router } from '@angular/router';
import { ApiService } from './api.service';

@Injectable({ providedIn: 'root' })
export class AuthService {
  readonly currentUser = signal<any>(null);

  constructor(private api: ApiService, private router: Router) {}

  bootstrap() {
    this.api.loadTokenFromStorage();
    const user = localStorage.getItem('user');
    if (user) {
      this.currentUser.set(JSON.parse(user));
      return;
    }
    if (this.api.getToken()) {
      this.api.getMe().subscribe({
        next: (u: any) => {
          this.currentUser.set(u);
          localStorage.setItem('user', JSON.stringify(u));
          if (u?.role) this.api.setRole(u.role);
        },
        error: () => {},
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
      localStorage.setItem('user', JSON.stringify(res.user));
    }
    if (res.role) this.api.setRole(res.role);
  }

  logout() {
    this.api.setToken('');
    localStorage.clear();
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
    return !!this.api.getToken();
  }
}
