import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../services/api.service';

@Component({
  selector: 'app-pharmacist-queue-page',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <section class="queue-wrap">
      <header>
        <h3>Pharmacy Review Queue</h3>
        <p>Approve, partially dispense, or void prescriptions with inventory checks and return linkage.</p>
      </header>

      <article class="panel">
        <div class="toolbar">
          <button (click)="loadQueue()" [disabled]="busy">{{ busy ? 'Refreshing...' : 'Refresh Queue' }}</button>
          <span class="msg">{{ message }}</span>
        </div>
        <table>
          <thead>
            <tr>
              <th>Drug</th>
              <th>State</th>
              <th>Qty</th>
              <th>Dispensed</th>
              <th>Available</th>
              <th>Tracking</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            <tr *ngFor="let rx of queue" [class.active]="selectedRx?.id === rx.id" (click)="selectRx(rx)">
              <td>{{ rx.drug_name }}</td>
              <td><span class="badge">{{ rx.state }}</span></td>
              <td>{{ rx.quantity }}</td>
              <td>{{ rx.dispensed_quantity || 0 }}</td>
              <td>{{ rx.inventory_available }}</td>
              <td>{{ trackLabel(rx) }}</td>
              <td>
                <button class="ghost" (click)="approve(rx); $event.stopPropagation();" [disabled]="rx.state !== 'pending'">Approve</button>
              </td>
            </tr>
            <tr *ngIf="queue.length === 0"><td colspan="7">No prescriptions in queue.</td></tr>
          </tbody>
        </table>
      </article>

      <article class="panel" *ngIf="selectedRx">
        <h4>Selected Rx: {{ selectedRx.drug_name }}</h4>
        <div class="grid3">
          <label>Inventory Item Id<input [(ngModel)]="dispense.inventoryItemId" /></label>
          <label>Dispense Quantity<input type="number" min="1" [(ngModel)]="dispense.quantity" /></label>
          <label>Void Reason<input [(ngModel)]="voidReason" placeholder="Required for void" /></label>
          <label *ngIf="selectedRx.lot_tracking">Lot<input [(ngModel)]="dispense.lot" /></label>
          <label *ngIf="selectedRx.serial_tracking">Serial<input [(ngModel)]="dispense.serial" /></label>
          <label>Return Quantity<input type="number" min="1" [(ngModel)]="returnQuantity" /></label>
          <label>Return Reason<input [(ngModel)]="returnReason" /></label>
        </div>

        <div class="actions">
          <button (click)="dispenseSelected()" [disabled]="busy || !canDispense()">Dispense</button>
          <button class="warn" (click)="voidSelected()" [disabled]="busy || selectedRx.dispensed_quantity > 0 || selectedRx.state === 'dispensed'">Void</button>
          <button class="ghost" (click)="loadMovements()" [disabled]="busy">Load Movements</button>
        </div>

        <div class="notice" *ngIf="needsLot() && !dispense.lot">Lot is required for this inventory item.</div>
        <div class="notice" *ngIf="needsSerial() && !dispense.serial">Serial is required for this inventory item.</div>
      </article>

      <article class="panel" *ngIf="selectedRx">
        <h4>Dispense/Return History</h4>
        <table>
          <thead><tr><th>Type</th><th>Qty</th><th>Lot</th><th>Serial</th><th>Reason</th><th>Action</th></tr></thead>
          <tbody>
            <tr *ngFor="let m of movements">
              <td>{{ m.movement_type }}</td>
              <td>{{ m.quantity }}</td>
              <td>{{ m.lot || '-' }}</td>
              <td>{{ m.serial || '-' }}</td>
              <td>{{ m.reason || '-' }}</td>
              <td>
                <button class="ghost" *ngIf="m.movement_type === 'dispense'" (click)="returnFromMovement(m)">Return</button>
              </td>
            </tr>
            <tr *ngIf="movements.length === 0"><td colspan="6">No inventory linkage yet.</td></tr>
          </tbody>
        </table>
      </article>
    </section>
  `,
  styles: [`
    .queue-wrap { display: grid; gap: .9rem; }
    header h3 { margin: 0; }
    header p { margin: .3rem 0 0; color: #5f7469; }
    .panel { border: 1px solid #d4ded6; background: #fbfcf8; padding: 1rem; }
    .toolbar { display: flex; align-items: center; gap: .7rem; margin-bottom: .6rem; }
    table { width: 100%; border-collapse: collapse; }
    th, td { border-bottom: 1px solid #e5ece7; padding: .45rem; font-size: .84rem; text-align: left; }
    tr.active { background: #edf5ef; }
    .badge { padding: .2rem .45rem; border-radius: 999px; border: 1px solid #c9d8cf; background: #f4f9f5; font-size: .76rem; text-transform: capitalize; }
    .grid3 { display: grid; grid-template-columns: repeat(3, 1fr); gap: .55rem; margin-top: .55rem; }
    label { display: grid; gap: .2rem; font-size: .83rem; color: #5f7469; }
    input { width: 100%; border: 1px solid #d4ded6; padding: .45rem; }
    .actions { display: flex; gap: .55rem; margin-top: .6rem; }
    button { border: 1px solid #0a4f38; background: #0f6a4b; color: #fff; padding: .4rem .7rem; }
    .ghost { background: transparent; border-color: #c7d7cd; color: #10231b; }
    .warn { background: #9f2b2b; border-color: #7f1f1f; }
    .msg { color: #8b2a2a; }
    .notice { margin-top: .45rem; color: #8b2a2a; font-size: .8rem; }
    @media (max-width: 1100px) { .grid3 { grid-template-columns: 1fr; } }
  `],
})
export class PharmacistQueuePageComponent {
  queue: any[] = [];
  movements: any[] = [];
  selectedRx: any = null;
  message = '';
  busy = false;
  voidReason = '';
  returnQuantity = 1;
  returnReason = '';
  dispense = {
    inventoryItemId: '',
    quantity: 1,
    lot: '',
    serial: '',
  };

  constructor(private api: ApiService) {
    this.loadQueue();
  }

  loadQueue() {
    this.busy = true;
    this.api.getPharmacyQueue().subscribe({
      next: (res: any) => {
        this.queue = res || [];
        if (this.selectedRx) {
          const found = this.queue.find((q) => q.id === this.selectedRx.id);
          if (found) this.selectRx(found);
        }
        this.busy = false;
      },
      error: (err: any) => {
        this.message = err?.error?.msg || 'Failed to load queue';
        this.busy = false;
      },
    });
  }

  selectRx(rx: any) {
    this.selectedRx = rx;
    this.voidReason = '';
    this.returnReason = '';
    this.returnQuantity = 1;
    const remaining = Number(rx.quantity) - Number(rx.dispensed_quantity || 0);
    this.dispense = {
      inventoryItemId: rx.inventory_item_id || '',
      quantity: remaining > 0 ? remaining : 1,
      lot: '',
      serial: '',
    };
    this.loadMovements();
  }

  approve(rx: any) {
    this.busy = true;
    this.api.pharmacyAction(rx.id, { action: 'approve', expectedVersion: rx.version }).subscribe({
      next: () => {
        this.message = 'Prescription approved.';
        this.loadQueue();
      },
      error: (err: any) => {
        this.message = err?.error?.msg || 'Approve failed.';
        this.busy = false;
      },
    });
  }

  canDispense() {
    if (!this.selectedRx) return false;
    if (!this.dispense.inventoryItemId) return false;
    if (!Number.isInteger(Number(this.dispense.quantity)) || Number(this.dispense.quantity) < 1) return false;
    if (this.needsLot() && !this.dispense.lot) return false;
    if (this.needsSerial() && !this.dispense.serial) return false;
    return true;
  }

  needsLot() {
    return !!this.selectedRx?.lot_tracking;
  }

  needsSerial() {
    return !!this.selectedRx?.serial_tracking;
  }

  dispenseSelected() {
    if (!this.selectedRx || !this.canDispense()) return;
    this.busy = true;
    this.api.pharmacyAction(this.selectedRx.id, {
      action: 'dispense',
      expectedVersion: this.selectedRx.version,
      inventoryItemId: this.dispense.inventoryItemId,
      dispenseQuantity: Number(this.dispense.quantity),
      lot: this.dispense.lot || undefined,
      serial: this.dispense.serial || undefined,
    }).subscribe({
      next: () => {
        this.message = 'Dispense recorded.';
        this.loadQueue();
      },
      error: (err: any) => {
        this.message = err?.error?.msg || 'Dispense failed.';
        this.busy = false;
      },
    });
  }

  voidSelected() {
    if (!this.selectedRx || !this.voidReason) {
      this.message = 'Void reason is required.';
      return;
    }
    this.busy = true;
    this.api.pharmacyAction(this.selectedRx.id, {
      action: 'void',
      expectedVersion: this.selectedRx.version,
      reason: this.voidReason,
    }).subscribe({
      next: () => {
        this.message = 'Prescription voided.';
        this.loadQueue();
      },
      error: (err: any) => {
        this.message = err?.error?.msg || 'Void failed.';
        this.busy = false;
      },
    });
  }

  loadMovements() {
    if (!this.selectedRx) return;
    this.api.getPharmacyMovements(this.selectedRx.id).subscribe({
      next: (res: any) => { this.movements = res || []; },
      error: () => { this.movements = []; },
    });
  }

  returnFromMovement(movement: any) {
    if (!this.selectedRx) return;
    if (!this.returnReason) {
      this.message = 'Return reason is required.';
      return;
    }
    this.busy = true;
    this.api.createPharmacyReturn(this.selectedRx.id, {
      originalMovementId: movement.id,
      quantity: Number(this.returnQuantity || 1),
      reason: this.returnReason,
    }).subscribe({
      next: () => {
        this.message = 'Return movement recorded.';
        this.loadMovements();
        this.loadQueue();
      },
      error: (err: any) => {
        this.message = err?.error?.msg || 'Return failed.';
        this.busy = false;
      },
    });
  }

  trackLabel(rx: any) {
    const flags = [];
    if (rx.lot_tracking) flags.push('lot');
    if (rx.serial_tracking) flags.push('serial');
    return flags.length ? flags.join(' + ') : 'none';
  }
}
