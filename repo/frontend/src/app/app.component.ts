import { Component, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { ApiService } from './services/api.service';
import { AuthService } from './services/auth.service';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterOutlet, RouterLink, RouterLinkActive],
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss',
})
export class AppComponent {
  username = '';
  password = '';
  remember = false;
  message = signal('Ready');
  busy = signal(false);
  kpis = signal<any>({});

  constructor(public api: ApiService, public auth: AuthService, private router: Router) {}

  ngOnInit() {
    this.auth.bootstrap();
    this.api.getKpis().subscribe({ next: (k: any) => this.kpis.set(k), error: () => {} });
  }

  login() {
    this.busy.set(true);
    this.auth.login(this.username, this.password, this.remember).subscribe({
      next: (res: any) => {
        this.auth.onLoginSuccess(res, this.remember);
        this.message.set(`Logged in as ${res.role}`);
        this.busy.set(false);
        const role = res.role;
        if (role === 'physician') this.router.navigateByUrl('/encounters');
        else if (role === 'pharmacist') this.router.navigateByUrl('/pharmacy');
        else if (role === 'billing') this.router.navigateByUrl('/billing');
        else if (role === 'inventory') this.router.navigateByUrl('/inventory');
        else if (role === 'admin') this.router.navigateByUrl('/admin-ops');
        else this.router.navigateByUrl('/home');
      },
      error: (err: any) => {
        this.message.set(err?.error?.msg || 'Login failed');
        this.busy.set(false);
      },
    });
  }

  logout() {
    this.auth.logout();
    this.message.set('Signed out');
  }

  hasRole(roles: string[]) {
    return this.auth.hasRole(roles);
  }
}
