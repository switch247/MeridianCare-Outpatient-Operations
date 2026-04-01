import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../services/api.service';

@Component({
  selector: 'app-invoices-page',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <section class="bill-wrap">
      <header>
        <h3>Billing Checkout Center</h3>
        <p>Manual invoice lifecycle only. No external payment gateway integration.</p>
      </header>

      <!-- Create invoice is now a modal opened from the Invoices toolbar -->

      <article class="panel">
        <div class="toolbar">
          <h4>Invoices</h4>
          <div>
            <button (click)="openCreate()">New Invoice</button>
            <button (click)="loadInvoices()" [disabled]="busy">Refresh</button>
          </div>
        </div>
        <table>
          <thead><tr><th>ID</th><th>Patient</th><th>Total</th><th>State</th><th>Actions</th></tr></thead>
          <tbody>
            <tr *ngFor="let inv of invoices">
              <td>{{ inv.id }}</td>
              <td>{{ inv.patient_name }}</td>
              <td>{{ inv.total }}</td>
              <td><span class="badge">{{ inv.state }}</span></td>
              <td class="actions-row">
                <ng-container [ngSwitch]="inv.state">
                  <button *ngSwitchCase="'unpaid'" (click)="pay(inv)">Record Manual Payment</button>
                  <button *ngSwitchCase="'unpaid'" class="warn" (click)="cancel(inv)">Cancel</button>

                  <button *ngSwitchCase="'paid'" class="ghost" (click)="view(inv)">View Receipt</button>

                  <button *ngSwitchCase="'cancelled'" class="ghost" disabled>Cancelled</button>

                  <button *ngSwitchDefault class="ghost" disabled>{{ inv.state }}</button>
                </ng-container>
              </td>
            </tr>
            <tr *ngIf="invoices.length===0"><td colspan="5">No invoices</td></tr>
          </tbody>
        </table>
      </article>
      <p class="msg">{{ message }}</p>
      <p *ngIf="patientAccessDenied" class="deny">Permission denied: patient directory is unavailable for your account.</p>
      <!-- Modal for creating invoice -->
      <div *ngIf="modalOpen" class="modal-wrap">
        <div class="modal-backdrop" (click)="closeModal()"></div>
        <div class="modal-panel">
          <h4>{{ modalMode === 'create' ? 'Create Invoice' : 'Edit Invoice' }}</h4>
          <div class="grid4">
            <label>
              Patient
              <input placeholder="Search patients by name or id" [(ngModel)]="patientFilter" />
              <select [(ngModel)]="modalModel.patientId">
                <option value="">-- select patient --</option>
                <option *ngFor="let p of filteredPatients()" [value]="p.id">{{ p.displayName || p.name || p.full_name || p.patient_name }}</option>
              </select>
            </label>
            <label>Plan Discount %<input type="number" min="0" [(ngModel)]="modalModel.planPercent" /></label>
            <label>Coupon Amount<input type="number" min="0" [(ngModel)]="modalModel.couponAmount" /></label>
            <label>Threshold Rule<input type="number" min="0" [(ngModel)]="modalModel.thresholdOff" /></label>
          </div>
          <div class="grid4">
            <label>Threshold Min<input type="number" min="0" [(ngModel)]="modalModel.thresholdMin" /></label>
            <label>Delivery Type
              <select [(ngModel)]="modalModel.deliveryType">
                <option value="pickup">pickup</option>
                <option value="home_delivery">home_delivery</option>
              </select>
            </label>
            <label *ngIf="modalModel.deliveryType==='home_delivery'">Shipping Zone<input [(ngModel)]="modalModel.zone" /></label>
            <label *ngIf="modalModel.deliveryType==='home_delivery'">ZIP<input [(ngModel)]="modalModel.zip" /></label>
          </div>
          <div class="grid4" *ngIf="modalModel.deliveryType==='home_delivery'">
            <label>Address Line 1<input [(ngModel)]="modalModel.addressLine1" /></label>
            <label>City<input [(ngModel)]="modalModel.city" /></label>
            <label>State<input [(ngModel)]="modalModel.state" /></label>
            <label>Carrier<input [(ngModel)]="modalModel.carrier" /></label>
          </div>

          <div class="line-editor">
            <h5>Cart Lines</h5>
            <table>
              <thead><tr><th>Type</th><th>Description</th><th>Qty</th><th>Unit Price</th><th></th></tr></thead>
              <tbody>
                <tr *ngFor="let line of modalModel.lines; let i = index">
                  <td>
                    <select [(ngModel)]="line.chargeType" [ngModelOptions]="{standalone:true}">
                      <option value="visit_code">visit_code</option>
                      <option value="procedure">procedure</option>
                      <option value="dispense_fee">dispense_fee</option>
                      <option value="retail">retail</option>
                    </select>
                  </td>
                  <td><input [(ngModel)]="line.description" [ngModelOptions]="{standalone:true}" /></td>
                  <td><input type="number" min="1" [(ngModel)]="line.quantity" [ngModelOptions]="{standalone:true}" /></td>
                  <td><input type="number" min="0" [(ngModel)]="line.unitPrice" [ngModelOptions]="{standalone:true}" /></td>
                  <td><button class="ghost" (click)="removeModalLine(i)">Remove</button></td>
                </tr>
              </tbody>
            </table>
            <button class="ghost" (click)="addModalLine()">Add Line</button>
          </div>

          <div class="actions">
            <button (click)="previewPriceModal()" [disabled]="busy">Preview Price</button>
            <button (click)="saveModal()" [disabled]="busy">Create Invoice</button>
            <button (click)="closeModal()" class="ghost">Cancel</button>
          </div>
          <pre *ngIf="quote">{{ quote | json }}</pre>
        </div>
      </div>
      <!-- Receipt modal -->
      <div *ngIf="receiptOpen" class="modal-wrap">
        <div class="modal-backdrop" (click)="closeReceipt()"></div>
        <div class="modal-panel">
          <h4>Invoice Receipt</h4>
          <div class="grid4">
            <div><strong>ID</strong><div>{{ receiptModel?.id }}</div></div>
            <div><strong>Patient</strong><div>{{ receiptModel?.patient_name || receiptModel?.patientId }}</div></div>
            <div><strong>Status</strong><div>{{ receiptModel?.state }}</div></div>
            <div><strong>Total</strong><div>{{ receiptModel?.total }}</div></div>
          </div>
          <h5 style="margin-top:.6rem">Lines</h5>
          <table class="receipt-lines">
            <thead><tr><th>Description</th><th>Qty</th><th>Unit</th><th>Total</th></tr></thead>
            <tbody>
              <tr *ngFor="let l of (receiptModel?.lines || [])">
                <td>{{ l.description }}</td>
                <td>{{ l.quantity }}</td>
                <td>{{ l.unitPrice }}</td>
                <td>{{ (l.quantity||0) * (l.unitPrice||0) }}</td>
              </tr>
              <tr *ngIf="!(receiptModel?.lines || []).length"><td colspan="4">No lines</td></tr>
            </tbody>
          </table>
          <div class="actions" style="margin-top:.6rem">
            <button (click)="closeReceipt()" class="ghost">Close</button>
          </div>
        </div>
      </div>
    </section>
  `,
  styles: [`
    .bill-wrap { display: grid; gap: .9rem; }
    header h3 { margin: 0; }
    header p { margin: .3rem 0 0; color: #5f7469; }
    .panel { border: 1px solid #d4ded6; background: #fbfcf8; padding: 1rem; }
    .grid4 { display: grid; grid-template-columns: repeat(4, 1fr); gap: .55rem; }
    label { display: grid; gap: .2rem; font-size: .82rem; color: #5f7469; }
    input, select { width: 100%; border: 1px solid #d4ded6; padding: .45rem; }
    table { width: 100%; border-collapse: collapse; margin-top: .5rem; }
    th, td { border-bottom: 1px solid #e5ece7; padding: .45rem; text-align: left; font-size: .83rem; }
    .actions { display: flex; gap: .55rem; margin-top: .6rem; }
    .actions-row { display: flex; gap: .4rem; }
    button { border: 1px solid #0a4f38; background: #0f6a4b; color: #fff; padding: .35rem .65rem; }
    .ghost { background: transparent; border-color: #c7d7cd; color: #10231b; }
    .warn { background: #9f2b2b; border-color: #7f1f1f; }
    .badge { padding: .2rem .45rem; border: 1px solid #c9d8cf; border-radius: 999px; text-transform: capitalize; }
    .toolbar { display: flex; justify-content: space-between; align-items: center; }
    /* Modal styles */
    .modal-wrap { position: fixed; inset: 0; display: flex; align-items: center; justify-content: center; z-index: 1200; }
    .modal-backdrop { position: absolute; inset: 0; background: rgba(10,10,10,0.45); }
    .modal-panel { position: relative; background: #fff; border-radius: 8px; padding: 1rem; max-width: 920px; width: 96%; max-height: 86vh; overflow: auto; box-shadow: 0 10px 30px rgba(8,18,12,0.35); z-index: 1210; }
    .modal-panel h4 { margin: 0 0 .6rem 0; }
    .modal-panel .actions { justify-content: flex-end; }
    .receipt-lines { width: 100%; border-collapse: collapse; margin-top: .4rem; }
    .receipt-lines th, .receipt-lines td { padding: .3rem .45rem; border-bottom: 1px solid #eef5ef; font-size: .86rem; }
    .msg { margin: 0; color: #8b2a2a; }
    .deny { margin: 0; color: #8b2a2a; font-weight: 600; }
    @media (max-width: 1100px) { .grid4 { grid-template-columns: 1fr; } }
  `],
})
export class InvoicesPageComponent {
  busy = false;
  message = '';
  quote: any = null;
  invoices: any[] = [];
  draft: any = {
    patientId: '',
    planPercent: 0,
    couponAmount: 0,
    thresholdMin: 200,
    thresholdOff: 25,
    deliveryType: 'pickup',
    zone: '',
    zip: '',
    city: '',
    state: '',
    addressLine1: '',
    carrier: '',
    lines: [{ chargeType: 'visit_code', description: 'Visit', quantity: 1, unitPrice: 100 }],
  };
  modalOpen = false;
  modalMode: 'create'|'edit' = 'create';
  modalModel: any = JSON.parse(JSON.stringify(this.draft));
  receiptOpen = false;
  receiptModel: any = null;
  patients: any[] = [];
  patientFilter = '';
  patientAccessDenied = false;

  constructor(private api: ApiService) {
    this.loadInvoices();
    this.loadPatients();
  }

  addLine() {
    this.draft.lines.push({ chargeType: 'procedure', description: '', quantity: 1, unitPrice: 0 });
  }

  addModalLine() { this.modalModel.lines.push({ chargeType: 'procedure', description: '', quantity: 1, unitPrice: 0 }); }

  removeModalLine(index: number) { this.modalModel.lines.splice(index,1); }

  removeLine(index: number) {
    this.draft.lines.splice(index, 1);
  }

  buildPayload() {
    const payload: any = {
      patientId: this.draft.patientId,
      lines: this.draft.lines.map((l: any) => ({
        chargeType: l.chargeType,
        description: l.description,
        quantity: Number(l.quantity),
        unitPrice: Number(l.unitPrice),
      })),
      planPercent: Number(this.draft.planPercent),
      couponAmount: Number(this.draft.couponAmount),
      thresholdRule: { threshold: Number(this.draft.thresholdMin), off: Number(this.draft.thresholdOff) },
    };
    if (this.draft.deliveryType === 'home_delivery') {
      payload.shipping = {
        deliveryType: 'home_delivery',
        zone: this.draft.zone,
        zip: this.draft.zip,
        city: this.draft.city,
        state: this.draft.state,
        addressLine1: this.draft.addressLine1,
        carrier: this.draft.carrier || null,
      };
    }
    return payload;
  }

  previewPrice() {
    this.busy = true;
    this.api.billPrice(this.buildPayload()).subscribe({
      next: (res: any) => {
        this.quote = res;
        this.busy = false;
      },
      error: (err: any) => {
        this.message = err?.error?.msg || 'Price preview failed';
        this.busy = false;
      },
    });
  }

  previewPriceModal() {
    this.busy = true;
    this.api.billPrice(this.buildPayloadFrom(this.modalModel)).subscribe({
      next: (res: any) => { this.quote = res; this.busy = false; },
      error: (err: any) => { this.message = err?.error?.msg || 'Price preview failed'; this.busy = false; }
    });
  }

  createInvoice() {
    this.busy = true;
    this.api.createInvoice(this.buildPayload()).subscribe({
      next: () => {
        this.message = 'Invoice generated.';
        this.quote = null;
        this.busy = false;
        this.loadInvoices();
      },
      error: (err: any) => {
        this.message = err?.error?.msg || 'Invoice create failed';
        this.busy = false;
      },
    });
  }

  // modal helpers
  openCreate() { this.modalMode = 'create'; this.modalModel = JSON.parse(JSON.stringify(this.draft)); this.modalOpen = true; }
  closeModal() { this.modalOpen = false; this.quote = null; }

  saveModal() {
    this.busy = true;
    this.api.createInvoice(this.buildPayloadFrom(this.modalModel)).subscribe({
      next: () => { this.message = 'Invoice generated.'; this.quote = null; this.busy = false; this.closeModal(); this.loadInvoices(); },
      error: (err: any) => { this.message = err?.error?.msg || 'Invoice create failed'; this.busy = false; }
    });
  }

  closeReceipt() { this.receiptOpen = false; this.receiptModel = null; }

  buildPayloadFrom(src: any) {
    const payload: any = {
      patientId: src.patientId,
      lines: (src.lines || []).map((l: any) => ({ chargeType: l.chargeType, description: l.description, quantity: Number(l.quantity), unitPrice: Number(l.unitPrice) })),
      planPercent: Number(src.planPercent || 0),
      couponAmount: Number(src.couponAmount || 0),
      thresholdRule: { threshold: Number(src.thresholdMin || 0), off: Number(src.thresholdOff || 0) }
    };
    if (src.deliveryType === 'home_delivery') {
      payload.shipping = { deliveryType: 'home_delivery', zone: src.zone, zip: src.zip, city: src.city, state: src.state, addressLine1: src.addressLine1, carrier: src.carrier || null };
    }
    return payload;
  }

  loadInvoices() {
    this.api.getInvoices().subscribe({
      next: (res: any) => { this.invoices = res || []; },
      error: () => { this.invoices = []; },
    });
  }

  loadPatients() {
    this.api.getPatients().subscribe({
      next: (res: any) => {
        this.patients = res || [];
        this.patientAccessDenied = false;
      },
      error: (err: any) => {
        this.patients = [];
        this.patientAccessDenied = err?.status === 401 || err?.status === 403;
      },
    });
  }

  filteredPatients() {
    const q = (this.patientFilter || '').toLowerCase();
    if (!q) return this.patients;
    return this.patients.filter((p: any) => {
      const name = (p.displayName || p.name || p.full_name || p.patient_name || '').toString().toLowerCase();
      const id = (p.id || '').toString().toLowerCase();
      return name.includes(q) || id.includes(q);
    });
  }

  pay(inv: any) {
    this.busy = true;
    this.api.payInvoice(inv.id, { expectedVersion: inv.version, tenderType: 'cash', reference: `manual-${Date.now()}` }).subscribe({
      next: () => {
        this.message = 'Manual payment recorded.';
        this.busy = false;
        this.loadInvoices();
      },
      error: (err: any) => {
        this.message = err?.error?.msg || 'Payment update failed';
        this.busy = false;
      },
    });
  }

  cancel(inv: any) {
    this.busy = true;
    this.api.cancelInvoice(inv.id, { expectedVersion: inv.version }).subscribe({
      next: () => {
        this.message = 'Invoice cancelled.';
        this.busy = false;
        this.loadInvoices();
      },
      error: (err: any) => {
        this.message = err?.error?.msg || 'Cancel failed';
        this.busy = false;
      },
    });
  }

  view(inv: any) {
    this.busy = true;
    if (!inv || !inv.id) { this.message = 'Missing invoice id'; this.busy = false; return; }
    this.api.getInvoice(inv.id).subscribe({
      next: (res: any) => { this.receiptModel = res; this.receiptOpen = true; this.busy = false; },
      error: (err: any) => { this.message = err?.error?.msg || 'Failed to load invoice'; this.busy = false; }
    });
  }
}
