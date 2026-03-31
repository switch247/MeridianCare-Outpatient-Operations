import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../services/api.service';

@Component({
  selector: 'app-inventory-page',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <section class="inv-wrap">
      <header>
        <h3>Inventory Operations</h3>
        <button (click)="openCreate = !openCreate">{{ openCreate ? 'Close' : 'New Item' }}</button>
      </header>

      <article class="panel" *ngIf="openCreate">
        <h4>Create Item</h4>
        <div class="grid">
          <label>SKU<input [(ngModel)]="createModel.sku" /></label>
          <label>Name<input [(ngModel)]="createModel.name" /></label>
          <label>Low Stock Threshold<input type="number" [(ngModel)]="createModel.lowStockThreshold" /></label>
          <label>Lot Tracking<input type="checkbox" [(ngModel)]="createModel.lotTracking" /></label>
          <label>Serial Tracking<input type="checkbox" [(ngModel)]="createModel.serialTracking" /></label>
        </div>
        <button (click)="createItem()">Create</button>
      </article>

      <article class="panel">
        <h4>Inventory Items</h4>
        <table>
          <thead><tr><th>SKU</th><th>Name</th><th>On Hand</th><th>Low Threshold</th><th>Actions</th></tr></thead>
          <tbody>
            <tr *ngFor="let i of items">
              <td>{{ i.sku }}</td>
              <td>{{ i.name }}</td>
              <td>{{ i.on_hand }}</td>
              <td>{{ i.low_stock_threshold }}</td>
              <td><button class="ghost" (click)="selectForMove(i)">Move</button></td>
            </tr>
            <tr *ngIf="!items.length"><td colspan="5">No inventory items.</td></tr>
          </tbody>
        </table>
      </article>

      <article class="panel" *ngIf="selectedItem">
        <h4>Stock Movement - {{ selectedItem.name }}</h4>
        <div class="grid">
          <label>Type
            <select [(ngModel)]="moveModel.movementType">
              <option value="receive">receive</option>
              <option value="dispense">dispense</option>
              <option value="return">return</option>
              <option value="count_adjust_up">count_adjust_up</option>
              <option value="count_adjust_down">count_adjust_down</option>
            </select>
          </label>
          <label>Quantity<input type="number" min="1" [(ngModel)]="moveModel.quantity" /></label>
          <label>Lot<input [(ngModel)]="moveModel.lot" /></label>
          <label>Serial<input [(ngModel)]="moveModel.serial" /></label>
          <label>Reason<input [(ngModel)]="moveModel.reason" /></label>
        </div>
        <button (click)="applyMovement()">Apply Movement</button>
      </article>

      <article class="panel">
        <h4>Low Stock Alerts</h4>
        <ul>
          <li *ngFor="let a of alerts">{{ a.sku }} - {{ a.name }} ({{ a.on_hand }}/{{ a.low_stock_threshold }})</li>
          <li *ngIf="!alerts.length">No low stock alerts.</li>
        </ul>
      </article>

      <article class="panel">
        <h4>Variance Report</h4>
        <table>
          <thead><tr><th>Item ID</th><th>Positive Adjustments</th><th>Negative Adjustments</th></tr></thead>
          <tbody>
            <tr *ngFor="let v of variance">
              <td>{{ v.item_id }}</td>
              <td>{{ v.positive_adjustments }}</td>
              <td>{{ v.negative_adjustments }}</td>
            </tr>
            <tr *ngIf="!variance.length"><td colspan="3">No variance records.</td></tr>
          </tbody>
        </table>
      </article>

      <p class="msg">{{ message }}</p>
    </section>
  `,
  styles: [`
    .inv-wrap { display: grid; gap: .9rem; }
    header { display:flex; justify-content:space-between; align-items:center; }
    h3,h4 { margin: 0; }
    .panel { border:1px solid #d4ded6; background:#fbfcf8; padding:1rem; }
    .grid { display:grid; gap:.5rem; grid-template-columns: repeat(5, minmax(120px,1fr)); margin:.5rem 0; }
    label { display:grid; gap:.2rem; font-size:.82rem; color:#5f7469; }
    input, select { border:1px solid #d4ded6; padding:.45rem; }
    button { border:1px solid #0a4f38; background:#0f6a4b; color:#fff; padding:.4rem .7rem; }
    .ghost { background:transparent; color:#10231b; border-color:#c8d7cd; }
    table { width:100%; border-collapse:collapse; }
    th,td { border-bottom:1px solid #e5ece7; text-align:left; padding:.45rem; font-size:.84rem; }
    .msg { margin:0; color:#8b2a2a; }
    @media (max-width: 1080px) { .grid { grid-template-columns: 1fr; } }
  `]
})
export class InventoryPageComponent {
  items: any[] = [];
  alerts: any[] = [];
  variance: any[] = [];
  message = '';
  openCreate = false;
  selectedItem: any = null;

  createModel: any = {
    sku: '',
    name: '',
    lowStockThreshold: 10,
    lotTracking: false,
    serialTracking: false,
  };

  moveModel: any = {
    movementType: 'receive',
    quantity: 1,
    lot: '',
    serial: '',
    reason: '',
  };

  constructor(private api: ApiService) {
    this.load();
  }

  load() {
    this.api.getInventory().subscribe({ next: (res: any) => { this.items = res || []; }, error: () => { this.items = []; } });
    this.api.getLowStockAlerts().subscribe({ next: (res: any) => { this.alerts = res || []; }, error: () => { this.alerts = []; } });
    this.api.getInventoryVariance().subscribe({ next: (res: any) => { this.variance = res || []; }, error: () => { this.variance = []; } });
  }

  createItem() {
    this.api.createInventoryItem(this.createModel).subscribe({
      next: () => {
        this.message = 'Inventory item created.';
        this.openCreate = false;
        this.createModel = { sku: '', name: '', lowStockThreshold: 10, lotTracking: false, serialTracking: false };
        this.load();
      },
      error: (err: any) => { this.message = err?.error?.msg || 'Create item failed.'; },
    });
  }

  selectForMove(item: any) {
    this.selectedItem = item;
    this.moveModel = { movementType: 'receive', quantity: 1, lot: '', serial: '', reason: '' };
  }

  applyMovement() {
    if (!this.selectedItem) return;
    const payload = {
      itemId: this.selectedItem.id,
      movementType: this.moveModel.movementType,
      quantity: Number(this.moveModel.quantity),
      lot: this.moveModel.lot || undefined,
      serial: this.moveModel.serial || undefined,
      reason: this.moveModel.reason || undefined,
    };
    this.api.createInventoryMovement(payload).subscribe({
      next: () => {
        this.message = 'Movement applied.';
        this.load();
      },
      error: (err: any) => { this.message = err?.error?.msg || 'Movement failed.'; },
    });
  }
}
