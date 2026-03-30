import { Component, computed, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService } from './services/api.service';
import { UserManagementComponent } from './pages/user-management.component';
import { MyClinicComponent } from './pages/my-clinic.component';
import { InventoryPageComponent } from './pages/inventory-page.component';
import { BillingPageComponent } from './pages/billing-page.component';
import { InvoicesPageComponent } from './pages/invoices-page.component';

type Role = 'physician'|'pharmacist'|'billing'|'inventory'|'admin'|'auditor';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, FormsModule, UserManagementComponent, MyClinicComponent, InventoryPageComponent, BillingPageComponent, InvoicesPageComponent],
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss'
})
export class AppComponent {
  roles: Role[] = ['physician','pharmacist','billing','inventory','admin','auditor'];
  role = signal<Role>('physician');
  readonly flows: Record<Role, string[]> = {
    physician: ['Create encounter note','Select ICD via typeahead','Sign encounter (>=1 diagnosis)','Draft eRx','Resolve high severity conflicts via override + password'],
    pharmacist: ['Open review queue','Approve prescription','Dispense and decrement stock','Void with reason before dispense'],
    billing: ['Build cart','Validate positive quantities','Apply plan->coupon->threshold discounts','Generate unpaid invoice','Record manual payment'],
    inventory: ['Receive shipment','Putaway on-hand','Dispense/ship movements','Returns + stock count + variance'],
    admin: ['Credentialing onboarding','Batch import with mapping errors','Run crawler collect->parse->store','Manage backups, KPIs, and audits'],
    auditor: ['Read immutable audits','Export audit report']
  };
  activeSteps = computed(() => this.flows[this.role()]);
  username = '';
  password = '';
  remember = false;
  kiosk = false;
  message = signal('Ready');
  busy = signal(false);
  apiResult = signal<unknown>(null);
  currentUser = signal<any>(null);
  selectedView = signal<string>('home');

  constructor(public api: ApiService) {}

  ngOnInit() {
    // restore token and user if persisted
    this.api.loadTokenFromStorage();
    const su = localStorage.getItem('user');
    if (su) {
      this.currentUser.set(JSON.parse(su));
    } else if (this.api.getToken()) {
      // fetch profile from backend when token exists but no cached user
      this.api.getMe().subscribe({ next: (u: any) => { this.currentUser.set(u); localStorage.setItem('user', JSON.stringify(u)); }, error: () => {} });
    }
  }

  setRole(role: Role) { this.role.set(role); }
  login() {
    this.busy.set(true);
    this.api.login(this.username, this.password).subscribe({
      next: (res) => {
        this.api.persistToken(res.token, this.remember);
        // store user info for profile and layout
        if (res.user) {
          this.currentUser.set(res.user);
          localStorage.setItem('user', JSON.stringify(res.user));
        }
        // set app role and api role
        this.role.set((res.role as Role) || 'physician');
        this.api.setRole(res.role || 'physician');
        // default landing per role
        if (res.role === 'admin') this.selectedView.set('users');
        else if (res.role === 'physician') this.selectedView.set('home');
        else this.selectedView.set('home');
        this.message.set(`Logged in as ${res.role}`);
        this.busy.set(false);
      },
      error: (err) => {
        this.message.set(err?.error?.msg || 'Login failed');
        this.busy.set(false);
      },
    });
  }

  logout() {
    this.api.setToken('');
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    this.currentUser.set(null);
    this.api.setRole('physician');
    this.message.set('Signed out');
  }

  runRoleAction() {
    this.busy.set(true);
    const finish = (label: string) => (data: unknown) => {
      this.apiResult.set(data);
      this.message.set(label);
      this.busy.set(false);
    };
    const fail = (err: any) => {
      this.message.set(err?.error?.msg || 'Request failed');
      this.busy.set(false);
    };
    if (this.role() === 'physician') {
      this.api.searchIcd('J06').subscribe({ next: finish('Fetched ICD suggestions'), error: fail });
      return;
    }
    if (this.role() === 'pharmacist') {
      this.api.getPharmacyQueue().subscribe({ next: finish('Loaded pharmacy queue'), error: fail });
      return;
    }
    if (this.role() === 'billing') {
      this.api.billPrice({ lines: [{ quantity: 2, unitPrice: 120 }], planPercent: 10, couponAmount: 20, thresholdRule: { threshold: 200, off: 25 } })
        .subscribe({ next: finish('Calculated billing total'), error: fail });
      return;
    }
    if (this.role() === 'inventory') {
      this.api.getSyncStatus().subscribe({ next: finish('Fetched sync status'), error: fail });
      return;
    }
    if (this.role() === 'admin') {
      this.api.runCrawler({ sourceName: 'manual-ui', priority: 3 }).subscribe({ next: finish('Queued crawler job'), error: fail });
      return;
    }
    this.api.getKpis().subscribe({ next: finish('Loaded KPI dashboard data'), error: fail });
  }
}
