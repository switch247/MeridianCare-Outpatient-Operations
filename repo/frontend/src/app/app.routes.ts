import { Routes } from '@angular/router';
import { AppComponent } from './app.component';
import { AdminPageComponent } from './pages/admin-page.component';
import { UserManagementComponent } from './pages/user-management.component';
import { RoleGuard } from './services/role-guard.service';
import { ProviderPageComponent } from './pages/provider-page.component';
import { BillingPageComponent } from './pages/billing-page.component';
import { InventoryPageComponent } from './pages/inventory-page.component';
import { AuditorPageComponent } from './pages/auditor-page.component';
import { KioskPageComponent } from './pages/kiosk-page.component';

export const routes: Routes = [
	{ path: '', component: AppComponent },
	{ path: 'admin', component: AdminPageComponent, canActivate: [RoleGuard(['admin'])] },
	{ path: 'users', component: UserManagementComponent, canActivate: [RoleGuard(['admin'])] },
	{ path: 'provider', component: ProviderPageComponent, canActivate: [RoleGuard(['physician'])] },
	{ path: 'billing', component: BillingPageComponent, canActivate: [RoleGuard(['billing'])] },
	{ path: 'inventory', component: InventoryPageComponent, canActivate: [RoleGuard(['inventory'])] },
	{ path: 'auditor', component: AuditorPageComponent, canActivate: [RoleGuard(['auditor'])] },
	{ path: 'kiosk', component: KioskPageComponent },
];
