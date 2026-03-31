import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../services/api.service';

@Component({
  selector: 'app-physician-encounter-page',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <section class="enc-wrap">
      <header>
        <h3>Encounter Workbench</h3>
        <p>Create and sign encounters with ICD validation and quick patient selection.</p>
      </header>

      <article class="panel grid2">
        <div>
          <h4>Patient</h4>
          <select [(ngModel)]="selectedPatientId">
            <option [ngValue]="''">Select patient</option>
            <option *ngFor="let p of patients" [ngValue]="p.id">{{ p.name }}</option>
          </select>
          <button (click)="loadPatientEncounters()" [disabled]="busy || !selectedPatientId">Load Encounters</button>
        </div>

        <div>
          <h4>ICD Typeahead</h4>
          <input [(ngModel)]="icdQuery" (input)="searchIcd()" placeholder="Search ICD code or label" />
          <ul class="icd-list">
            <li *ngFor="let i of icdResults" (click)="addDiagnosis(i)">
              <strong>{{ i.code }}</strong> - {{ i.label }}
            </li>
          </ul>
        </div>
      </article>

      <article class="panel">
        <h4>New Encounter</h4>
        <div class="form-grid">
          <label>Chief Complaint<input [(ngModel)]="encounter.chiefComplaint" /></label>
          <label>Treatment<input [(ngModel)]="encounter.treatment" /></label>
          <label>Follow Up<input [(ngModel)]="encounter.followUp" /></label>
        </div>

        <div class="diagnoses">
          <p>Selected Diagnoses</p>
          <ul>
            <li *ngFor="let d of encounter.diagnoses; let idx = index">
              {{ d.code }} - {{ d.label }}
              <button class="ghost" (click)="removeDiagnosis(idx)">Remove</button>
            </li>
            <li *ngIf="encounter.diagnoses.length === 0">No diagnosis selected.</li>
          </ul>
        </div>

        <div class="actions">
          <button (click)="createEncounter()" [disabled]="busy || !selectedPatientId">Create Encounter</button>
          <button (click)="signLatest()" [disabled]="busy || !latestEncounter">Sign Latest</button>
        </div>
      </article>

      <article class="panel">
        <h4>Recent Encounters</h4>
        <table>
          <thead><tr><th>ID</th><th>State</th><th>Version</th><th>Diagnoses</th></tr></thead>
          <tbody>
            <tr *ngFor="let e of encounters">
              <td>{{ e.id }}</td><td>{{ e.state }}</td><td>{{ e.version }}</td><td>{{ e.diagnoses?.length || 0 }}</td>
            </tr>
            <tr *ngIf="encounters.length === 0"><td colspan="4">No encounters.</td></tr>
          </tbody>
        </table>
      </article>

      <article class="panel">
        <h4>Prescription Draft (from latest encounter)</h4>
        <div class="form-grid">
          <label>Drug<input [(ngModel)]="prescription.drugName" /></label>
          <label>Dose<input [(ngModel)]="prescription.dose" /></label>
          <label>Route<input [(ngModel)]="prescription.route" /></label>
          <label>Quantity<input type="number" min="1" [(ngModel)]="prescription.quantity" /></label>
          <label>Instructions<input [(ngModel)]="prescription.instructions" /></label>
        </div>
        <div class="form-grid">
          <label>Override Reason (if conflict)<input [(ngModel)]="prescription.overrideReason" /></label>
          <label>Re-auth Password (if conflict)<input type="password" [(ngModel)]="prescription.reauthPassword" /></label>
        </div>
        <div class="actions">
          <button (click)="submitPrescription()" [disabled]="busy || !latestEncounter">Submit Prescription</button>
        </div>
      </article>

      <p class="msg">{{ message }}</p>
    </section>
  `,
  styles: [`
    .enc-wrap { display: grid; gap: .9rem; }
    header h3 { margin: 0; }
    header p { margin: .3rem 0 0; color: #5f7469; }
    .panel { border: 1px solid #d4ded6; background: #fbfcf8; padding: 1rem; }
    .grid2 { display: grid; grid-template-columns: 1fr 1fr; gap: .9rem; }
    h4 { margin: 0 0 .5rem; }
    select, input { width: 100%; border: 1px solid #d4ded6; padding: .5rem; margin-bottom: .4rem; }
    button { border: 1px solid #0a4f38; background: #0f6a4b; color: #fff; padding: .4rem .7rem; }
    .ghost { background: transparent; border-color: #c7d7cd; color: #10231b; margin-left: .5rem; }
    .icd-list { list-style: none; padding: 0; margin: .4rem 0 0; max-height: 170px; overflow: auto; border: 1px solid #e3ece6; }
    .icd-list li { padding: .45rem; border-bottom: 1px solid #e8efeb; cursor: pointer; }
    .icd-list li:hover { background: #edf5ef; }
    .form-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: .5rem; }
    label { display: grid; gap: .2rem; font-size: .85rem; color: #5f7469; }
    .diagnoses ul { margin: .3rem 0 0; padding-left: 1rem; }
    .actions { display: flex; gap: .55rem; margin-top: .55rem; }
    table { width: 100%; border-collapse: collapse; }
    th, td { border-bottom: 1px solid #e5ece7; text-align: left; padding: .45rem; font-size: .84rem; }
    .msg { margin: 0; color: #8b2a2a; }
    @media (max-width: 1020px) { .grid2, .form-grid { grid-template-columns: 1fr; } }
  `]
})
export class PhysicianEncounterPageComponent {
  busy = false;
  message = '';
  patients: any[] = [];
  encounters: any[] = [];
  icdResults: any[] = [];
  icdQuery = '';
  selectedPatientId = '';
  latestEncounter: any = null;

  encounter = {
    chiefComplaint: '',
    treatment: '',
    followUp: '',
    diagnoses: [] as any[],
  };
  prescription = {
    drugName: '',
    dose: '',
    route: 'oral',
    quantity: 1,
    instructions: '',
    overrideReason: '',
    reauthPassword: '',
  };

  constructor(private api: ApiService) {
    this.loadPatients();
  }

  loadPatients() {
    this.api.getPatients().subscribe({
      next: (res: any) => { this.patients = res || []; },
      error: () => { this.patients = []; },
    });
  }

  searchIcd() {
    if (!this.icdQuery || this.icdQuery.length < 2) {
      this.icdResults = [];
      return;
    }
    this.api.searchIcd(this.icdQuery).subscribe({
      next: (res: any) => { this.icdResults = res || []; },
      error: () => { this.icdResults = []; },
    });
  }

  addDiagnosis(item: any) {
    if (this.encounter.diagnoses.some((d) => d.code === item.code)) return;
    this.encounter.diagnoses.push(item);
  }

  removeDiagnosis(index: number) {
    this.encounter.diagnoses.splice(index, 1);
  }

  createEncounter() {
    this.busy = true;
    const payload = {
      patientId: this.selectedPatientId,
      chiefComplaint: this.encounter.chiefComplaint,
      treatment: this.encounter.treatment,
      followUp: this.encounter.followUp,
      diagnoses: this.encounter.diagnoses.map((d) => ({ code: d.code, label: d.label })),
    };
    this.api.createEncounter(payload).subscribe({
      next: (res: any) => {
        this.latestEncounter = res;
        this.message = 'Encounter created.';
        this.busy = false;
        this.loadPatientEncounters();
      },
      error: (err: any) => {
        this.message = err?.error?.msg || 'Encounter create failed.';
        this.busy = false;
      },
    });
  }

  loadPatientEncounters() {
    if (!this.selectedPatientId) return;
    this.api.getEncounters(this.selectedPatientId).subscribe({
      next: (res: any) => {
        this.encounters = res || [];
        this.latestEncounter = this.encounters[0] || this.latestEncounter;
      },
      error: () => { this.encounters = []; },
    });
  }

  signLatest() {
    if (!this.latestEncounter) return;
    this.busy = true;
    this.api.signEncounter(this.latestEncounter.id, this.latestEncounter.version).subscribe({
      next: (res: any) => {
        this.message = 'Encounter signed.';
        this.latestEncounter = res;
        this.busy = false;
        this.loadPatientEncounters();
      },
      error: (err: any) => {
        this.message = err?.error?.msg || 'Sign failed.';
        this.busy = false;
      },
    });
  }

  submitPrescription() {
    if (!this.latestEncounter || !this.selectedPatientId) {
      this.message = 'Create/sign an encounter first.';
      return;
    }
    this.busy = true;
    const payload: any = {
      encounterId: this.latestEncounter.id,
      patientId: this.selectedPatientId,
      drugName: this.prescription.drugName,
      dose: this.prescription.dose,
      route: this.prescription.route,
      quantity: Number(this.prescription.quantity),
      instructions: this.prescription.instructions,
    };
    if (this.prescription.overrideReason) payload.overrideReason = this.prescription.overrideReason;
    if (this.prescription.reauthPassword) payload.reauthPassword = this.prescription.reauthPassword;

    this.api.createPrescription(payload).subscribe({
      next: () => {
        this.message = 'Prescription submitted.';
        this.busy = false;
      },
      error: (err: any) => {
        this.message = err?.error?.msg || 'Prescription submit failed.';
        this.busy = false;
      },
    });
  }
}
