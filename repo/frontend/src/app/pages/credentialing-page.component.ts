import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../services/api.service';

@Component({
  selector: 'app-credentialing-page',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <section class="cred-wrap">
      <header>
        <h3>Credentialing and Organizations</h3>
        <p>Batch onboarding with field mapping, organization profiles, and export summaries.</p>
      </header>

      <article class="panel">
        <h4>Organization Profiles</h4>
        <div class="grid3">
          <label>Name<input [(ngModel)]="organization.name" /></label>
          <label>Type<input [(ngModel)]="organization.organizationType" /></label>
          <label>Contact Email<input [(ngModel)]="organization.contactEmail" /></label>
          <label>Contact Phone<input [(ngModel)]="organization.contactPhone" /></label>
          <label>Address<input [(ngModel)]="organization.address" /></label>
          <label>Status
            <select [(ngModel)]="organization.status">
              <option value="active">active</option>
              <option value="inactive">inactive</option>
            </select>
          </label>
        </div>
        <div class="actions">
          <button (click)="saveOrganization()" [disabled]="busy">Save Organization</button>
          <button class="ghost" (click)="loadOrganizations()">Refresh</button>
        </div>
        <table>
          <thead><tr><th>Name</th><th>Type</th><th>Status</th><th>Actions</th></tr></thead>
          <tbody>
            <tr *ngFor="let org of organizations">
              <td>{{ org.name }}</td>
              <td>{{ org.organization_type }}</td>
              <td>{{ org.status }}</td>
              <td>
                <button class="ghost" (click)="editOrganization(org)">Edit</button>
                <button class="warn" (click)="deleteOrganization(org.id)">Delete</button>
              </td>
            </tr>
            <tr *ngIf="!organizations.length"><td colspan="4">No organizations.</td></tr>
          </tbody>
        </table>
      </article>

      <article class="panel">
        <h4>Batch Import with Field Mapping</h4>
        <table>
          <thead><tr><th>Internal Field</th><th>Source Field</th></tr></thead>
          <tbody>
            <tr *ngFor="let key of mappingKeys">
              <td>{{ key }}</td>
              <td><input [(ngModel)]="fieldMapping[key]" /></td>
            </tr>
          </tbody>
        </table>
        <div class="grid4">
          <label>Entity Type<input [(ngModel)]="batchRow.entityType" /></label>
          <label>Full Name<input [(ngModel)]="batchRow.fullName" /></label>
          <label>License Number<input [(ngModel)]="batchRow.licenseNumber" /></label>
          <label>License Expiry<input [(ngModel)]="batchRow.licenseExpiry" type="date" /></label>
        </div>
        <div class="actions">
          <button class="ghost" (click)="addBatchRow()">Add Row</button>
          <button (click)="importBatch()" [disabled]="busy">Run Import</button>
          <button (click)="exportData()" [disabled]="busy">Export</button>
        </div>
        <pre>{{ batchRows | json }}</pre>
        <div *ngIf="importSummary">Accepted: {{ importSummary.accepted }} Rejected: {{ importSummary.rejected }}</div>
        <table *ngIf="importSummary?.errors?.length">
          <thead><tr><th>Row</th><th>Field</th><th>Message</th></tr></thead>
          <tbody>
            <tr *ngFor="let e of importSummary.errors"><td>{{ e.row }}</td><td>{{ e.field }}</td><td>{{ e.message }}</td></tr>
          </tbody>
        </table>
      </article>

      <article class="panel">
        <h4>Credentialing Profiles</h4>
        <table>
          <thead><tr><th>Name</th><th>Type</th><th>License</th><th>Expiry</th><th>Status</th></tr></thead>
          <tbody>
            <tr *ngFor="let p of profiles">
              <td>{{ p.full_name }}</td>
              <td>{{ p.entity_type }}</td>
              <td>{{ p.license_number || '-' }}</td>
              <td>{{ p.license_expiry || '-' }}</td>
              <td>{{ p.status }}</td>
            </tr>
            <tr *ngIf="!profiles.length"><td colspan="5">No profiles yet.</td></tr>
          </tbody>
        </table>
      </article>

      <article class="panel" *ngIf="exportSummary">
        <h4>Export Summary</h4>
        <pre>{{ exportSummary | json }}</pre>
      </article>

      <p class="msg">{{ message }}</p>
    </section>
  `,
  styles: [`
    .cred-wrap { display: grid; gap: 1rem; }
    .panel { border: 1px solid #d4ded6; background: #fbfcf8; padding: 1rem; }
    .grid3 { display: grid; grid-template-columns: repeat(3, 1fr); gap: .5rem; }
    .grid4 { display: grid; grid-template-columns: repeat(4, 1fr); gap: .5rem; }
    label { display: grid; gap: .2rem; font-size: .82rem; color: #5f7469; }
    input, select { border: 1px solid #d4ded6; padding: .45rem; }
    .actions { display: flex; gap: .45rem; margin: .5rem 0; }
    table { width: 100%; border-collapse: collapse; margin-top: .5rem; }
    th, td { border-bottom: 1px solid #e5ece7; text-align: left; padding: .4rem; font-size: .84rem; }
    button { border: 1px solid #0a4f38; background: #0f6a4b; color: #fff; padding: .4rem .7rem; }
    .ghost { background: transparent; color: #10231b; border-color: #c7d7cd; }
    .warn { background: #9f2b2b; border-color: #7f1f1f; }
    .msg { margin: 0; color: #8b2a2a; }
    @media (max-width: 980px) { .grid3, .grid4 { grid-template-columns: 1fr; } }
  `],
})
export class CredentialingPageComponent {
  busy = false;
  message = '';
  profiles: any[] = [];
  organizations: any[] = [];
  importSummary: any = null;
  exportSummary: any = null;
  mappingKeys = ['entityType', 'fullName', 'licenseNumber', 'licenseExpiry'];
  fieldMapping: Record<string, string> = {
    entityType: 'entityType',
    fullName: 'fullName',
    licenseNumber: 'licenseNumber',
    licenseExpiry: 'licenseExpiry',
  };
  batchRows: any[] = [];
  batchRow: any = { entityType: 'candidate', fullName: '', licenseNumber: '', licenseExpiry: '' };
  organization: any = {
    id: '',
    name: '',
    organizationType: 'clinic',
    contactEmail: '',
    contactPhone: '',
    address: '',
    status: 'active',
  };

  constructor(private api: ApiService) {
    this.loadProfiles();
    this.loadOrganizations();
  }

  loadProfiles() {
    this.api.getCredentialingProfiles().subscribe({ next: (rows: any) => { this.profiles = rows || []; }, error: () => { this.profiles = []; } });
  }

  loadOrganizations() {
    this.api.getOrganizations().subscribe({ next: (rows: any) => { this.organizations = rows || []; }, error: () => { this.organizations = []; } });
  }

  editOrganization(org: any) {
    this.organization = {
      id: org.id,
      name: org.name,
      organizationType: org.organization_type,
      contactEmail: '',
      contactPhone: org.contact_phone || '',
      address: org.address || '',
      status: org.status || 'active',
    };
  }

  saveOrganization() {
    this.busy = true;
    const payload = {
      name: this.organization.name,
      organizationType: this.organization.organizationType,
      contactEmail: this.organization.contactEmail,
      contactPhone: this.organization.contactPhone,
      address: this.organization.address,
      status: this.organization.status,
    };
    const req$ = this.organization.id ? this.api.updateOrganization(this.organization.id, payload) : this.api.createOrganization(payload);
    req$.subscribe({
      next: () => {
        this.busy = false;
        this.message = 'Organization saved';
        this.organization = { id: '', name: '', organizationType: 'clinic', contactEmail: '', contactPhone: '', address: '', status: 'active' };
        this.loadOrganizations();
      },
      error: (err: any) => {
        this.busy = false;
        this.message = err?.error?.msg || 'Organization save failed';
      },
    });
  }

  deleteOrganization(id: string) {
    this.api.deleteOrganization(id).subscribe({
      next: () => { this.message = 'Organization deleted'; this.loadOrganizations(); },
      error: (err: any) => { this.message = err?.error?.msg || 'Delete failed'; },
    });
  }

  addBatchRow() {
    this.batchRows.push({ ...this.batchRow });
    this.batchRow = { entityType: 'candidate', fullName: '', licenseNumber: '', licenseExpiry: '' };
  }

  importBatch() {
    this.busy = true;
    this.importSummary = null;
    this.api.importCredentialing(this.batchRows, this.fieldMapping).subscribe({
      next: (res: any) => {
        this.importSummary = res;
        this.busy = false;
        this.message = 'Import complete';
        this.loadProfiles();
      },
      error: (err: any) => {
        this.busy = false;
        this.message = err?.error?.msg || 'Import failed';
      },
    });
  }

  exportData() {
    this.busy = true;
    this.api.exportCredentialing().subscribe({
      next: (res: any) => {
        this.exportSummary = res;
        this.busy = false;
        this.message = 'Export ready';
      },
      error: (err: any) => {
        this.busy = false;
        this.message = err?.error?.msg || 'Export failed';
      },
    });
  }
}
