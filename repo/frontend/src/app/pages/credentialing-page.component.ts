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
        <h3>Credentialing</h3>
        <p>Manage provider and organization onboarding with license checks and import error feedback.</p>
      </header>

      <div class="cred-grid">
        <article class="panel">
          <h4>Single Onboard</h4>
          <div class="grid">
            <label>Entity Type
              <select [(ngModel)]="single.entityType">
                <option value="candidate">candidate</option>
                <option value="organization">organization</option>
              </select>
            </label>
            <label>Full Name
              <input [(ngModel)]="single.fullName" />
            </label>
            <label>License Number
              <input [(ngModel)]="single.licenseNumber" />
            </label>
            <label>License Expiry
              <input [(ngModel)]="single.licenseExpiry" type="date" />
            </label>
            <button (click)="onboard()" [disabled]="busy">Onboard</button>
          </div>
        </article>

        <article class="panel">
          <h4>Batch Import (JSON rows)</h4>
          <textarea [(ngModel)]="batchJson" rows="8"></textarea>
          <button (click)="importBatch()" [disabled]="busy">Run Import</button>
          <div *ngIf="importSummary" class="summary">
            Accepted: {{ importSummary.accepted }} | Rejected: {{ importSummary.rejected }}
          </div>
          <table *ngIf="importSummary?.errors?.length" class="errors">
            <thead><tr><th>Row</th><th>Field</th><th>Message</th></tr></thead>
            <tbody>
              <tr *ngFor="let e of importSummary.errors"><td>{{ e.row }}</td><td>{{ e.field }}</td><td>{{ e.message }}</td></tr>
            </tbody>
          </table>
        </article>
      </div>

      <article class="panel">
        <h4>Profiles</h4>
        <table class="profiles">
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

      <p class="msg">{{ message }}</p>
    </section>
  `,
  styles: [`
    .cred-wrap { display: grid; gap: 1rem; }
    header h3 { margin: 0; }
    header p { margin: .35rem 0 0; color: #5f7469; }
    .cred-grid { display: grid; gap: 1rem; grid-template-columns: 1fr 1fr; }
    .panel { border: 1px solid #d4ded6; background: #fbfcf8; padding: 1rem; }
    .grid { display: grid; gap: .5rem; }
    label { display: grid; gap: .3rem; font-size: .85rem; color: #5f7469; }
    input, select, textarea { border: 1px solid #d4ded6; padding: .55rem; }
    button { width: fit-content; border: 1px solid #0a4f38; background: #0f6a4b; color: #fff; padding: .45rem .8rem; }
    .summary { margin-top: .5rem; font-size: .88rem; }
    table { width: 100%; border-collapse: collapse; margin-top: .6rem; }
    th, td { border-bottom: 1px solid #e5ece7; text-align: left; padding: .45rem; font-size: .85rem; }
    .msg { color: #8b2a2a; margin: 0; }
    @media (max-width: 980px) { .cred-grid { grid-template-columns: 1fr; } }
  `]
})
export class CredentialingPageComponent {
  busy = false;
  message = '';
  profiles: any[] = [];
  importSummary: any = null;
  single = {
    entityType: 'candidate',
    fullName: '',
    licenseNumber: '',
    licenseExpiry: '',
  };
  batchJson = `[
  { "entityType": "candidate", "fullName": "Dr Jane", "licenseNumber": "LIC-01", "licenseExpiry": "2030-01-01" },
  { "entityType": "candidate", "fullName": "Dr Mark", "licenseNumber": "LIC-02", "licenseExpiry": "2026-04-10" }
]`;

  constructor(private api: ApiService) {
    this.load();
  }

  load() {
    this.api.getCredentialingProfiles().subscribe({
      next: (rows: any) => { this.profiles = rows || []; },
      error: () => { this.profiles = []; },
    });
  }

  onboard() {
    this.busy = true;
    const payload = {
      entityType: this.single.entityType,
      fullName: this.single.fullName,
      licenseNumber: this.single.licenseNumber,
      licenseExpiry: this.single.licenseExpiry,
    };
    this.api.onboardCredentialing(payload).subscribe({
      next: () => {
        this.message = 'Profile onboarded.';
        this.busy = false;
        this.load();
      },
      error: (err: any) => {
        this.message = err?.error?.msg || 'Onboarding failed.';
        this.busy = false;
      },
    });
  }

  importBatch() {
    this.busy = true;
    this.importSummary = null;
    let rows: any[] = [];
    try {
      rows = JSON.parse(this.batchJson);
    } catch {
      this.message = 'Invalid JSON payload for batch import.';
      this.busy = false;
      return;
    }
    this.api.importCredentialing(rows).subscribe({
      next: (res: any) => {
        this.importSummary = res;
        this.message = 'Import complete.';
        this.busy = false;
        this.load();
      },
      error: (err: any) => {
        this.message = err?.error?.msg || 'Import failed.';
        this.busy = false;
      },
    });
  }
}
