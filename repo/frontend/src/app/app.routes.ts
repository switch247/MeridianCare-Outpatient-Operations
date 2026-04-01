import { Routes } from '@angular/router';
import { RoleGuard } from './services/role-guard.service';
import { HomePageComponent } from './pages/home-page.component';
import { PhysicianEncounterPageComponent } from './pages/physician-encounter-page.component';
import { PharmacistQueuePageComponent } from './pages/pharmacist-queue-page.component';
import { InvoicesPageComponent } from './pages/invoices-page.component';
import { InventoryPageComponent } from './pages/inventory-page.component';
import { CredentialingPageComponent } from './pages/credentialing-page.component';
import { UserManagementComponent } from './pages/user-management.component';
import { AdminOpsPageComponent } from './pages/admin-ops-page.component';
import { MyClinicComponent } from './pages/my-clinic.component';

export const routes: Routes = [
  { path: 'home', component: HomePageComponent },
  { path: 'encounters', component: PhysicianEncounterPageComponent, canActivate: [RoleGuard(['physician'])] },
  { path: 'pharmacy', component: PharmacistQueuePageComponent, canActivate: [RoleGuard(['pharmacist'])] },
  { path: 'billing', component: InvoicesPageComponent, canActivate: [RoleGuard(['billing', 'admin'])] },
  { path: 'inventory', component: InventoryPageComponent, canActivate: [RoleGuard(['inventory', 'pharmacist', 'admin'])] },
  { path: 'credentialing', component: CredentialingPageComponent, canActivate: [RoleGuard(['admin'])] },
  { path: 'users', component: UserManagementComponent, canActivate: [RoleGuard(['admin'])] },
  { path: 'admin-ops', component: AdminOpsPageComponent, canActivate: [RoleGuard(['admin'])] },
  { path: 'my-clinic', component: MyClinicComponent, canActivate: [RoleGuard(['physician', 'pharmacist', 'billing', 'inventory', 'admin', 'auditor'])] },
  { path: '', pathMatch: 'full', redirectTo: 'home' },
  { path: '**', redirectTo: 'home' },
];
