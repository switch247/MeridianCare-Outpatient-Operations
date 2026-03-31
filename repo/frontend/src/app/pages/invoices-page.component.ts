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

      <article class="panel">
        <h4>Create Invoice</h4>
        <div class="grid4">
          <label>Patient ID<input [(ngModel)]="draft.patientId" /></label>
          <label>Plan Discount %<input type="number" min="0" [(ngModel)]="draft.planPercent" /></label>
          <label>Coupon Amount<input type="number" min="0" [(ngModel)]="draft.couponAmount" /></label>
          <label>Threshold Rule<input type="number" min="0" [(ngModel)]="draft.thresholdOff" /></label>
        </div>
        <div class="grid4">
          <label>Threshold Min<input type="number" min="0" [(ngModel)]="draft.thresholdMin" /></label>
          <label>Delivery Type
            <select [(ngModel)]="draft.deliveryType">
              <option value="pickup">pickup</option>
              <option value="home_delivery">home_delivery</option>
            </select>
          </label>
          <label *ngIf="draft.deliveryType==='home_delivery'">Shipping Zone<input [(ngModel)]="draft.zone" /></label>
          <label *ngIf="draft.deliveryType==='home_delivery'">ZIP<input [(ngModel)]="draft.zip" /></label>
        </div>
        <div class="grid4" *ngIf="draft.deliveryType==='home_delivery'">
          <label>Address Line 1<input [(ngModel)]="draft.addressLine1" /></label>
          <label>City<input [(ngModel)]="draft.city" /></label>
          <label>State<input [(ngModel)]="draft.state" /></label>
          <label>Carrier<input [(ngModel)]="draft.carrier" /></label>
        </div>

        <div class="line-editor">
          <h5>Cart Lines</h5>
          <table>
            <thead><tr><th>Type</th><th>Description</th><th>Qty</th><th>Unit Price</th><th></th></tr></thead>
            <tbody>
              <tr *ngFor="let line of draft.lines; let i = index">
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
                <td><button class="ghost" (click)="removeLine(i)">Remove</button></td>
              </tr>
            </tbody>
          </table>
          <button class="ghost" (click)="addLine()">Add Line</button>
        </div>

        <div class="actions">
          <button (click)="previewPrice()" [disabled]="busy">Preview Price</button>
          <button (click)="createInvoice()" [disabled]="busy">Generate Invoice</button>
        </div>
        <pre *ngIf="quote">{{ quote | json }}</pre>
      </article>

      <article class="panel">
        <div class="toolbar">
          <h4>Invoices</h4>
          <button (click)="loadInvoices()" [disabled]="busy">Refresh</button>
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
                <button (click)="pay(inv)" [disabled]="inv.state !== 'unpaid'">Record Manual Payment</button>
                <button class="warn" (click)="cancel(inv)" [disabled]="inv.state !== 'unpaid'">Cancel</button>
              </td>
            </tr>
            <tr *ngIf="invoices.length===0"><td colspan="5">No invoices</td></tr>
          </tbody>
        </table>
      </article>
      <p class="msg">{{ message }}</p>
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
    .msg { margin: 0; color: #8b2a2a; }
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

  constructor(private api: ApiService) {
    this.loadInvoices();
  }

  addLine() {
    this.draft.lines.push({ chargeType: 'procedure', description: '', quantity: 1, unitPrice: 0 });
  }

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

  loadInvoices() {
    this.api.getInvoices().subscribe({
      next: (res: any) => { this.invoices = res || []; },
      error: () => { this.invoices = []; },
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
}
