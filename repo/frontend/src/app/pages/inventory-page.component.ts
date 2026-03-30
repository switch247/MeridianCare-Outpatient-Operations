import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../services/api.service';

@Component({
  selector: 'app-inventory-page',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <section class="panel">
      <div class="flex items-center justify-between mb-4">
        <h2 class="text-lg font-semibold">Inventory</h2>
        <div>
          <button (click)="openCreate()" class="px-3 py-1 bg-black text-white rounded">New Item</button>
        </div>
      </div>

      <div class="overflow-auto bg-white rounded shadow">
        <table class="w-full table-auto">
          <thead class="border-b">
            <tr class="text-left">
              <th class="px-4 py-2">SKU</th>
              <th class="px-4 py-2">Name</th>
              <th class="px-4 py-2">On Hand</th>
              <th class="px-4 py-2">Location</th>
              <th class="px-4 py-2">Actions</th>
            </tr>
          </thead>
          <tbody>
            <tr *ngFor="let i of items" class="border-b">
              <td class="px-4 py-3">{{ i.sku }}</td>
              <td class="px-4 py-3">{{ i.name }}</td>
              <td class="px-4 py-3">{{ i.on_hand }}</td>
              <td class="px-4 py-3">{{ i.location || '-' }}</td>
              <td class="px-4 py-3">
                <button (click)="openEdit(i)" class="px-2 py-1 mr-2">Edit</button>
                <button (click)="deleteItem(i.id)" class="px-2 py-1 text-red-600">Delete</button>
              </td>
            </tr>
            <tr *ngIf="items.length === 0">
              <td class="px-4 py-6" colspan="5">No inventory items.</td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- Modal -->
      <div *ngIf="modalOpen" class="fixed inset-0 flex items-center justify-center" style="z-index:40;">
        <div class="absolute inset-0 bg-black opacity-40" (click)="closeModal()"></div>
        <div class="bg-white rounded shadow p-6 z-50 w-full max-w-md">
          <h3 class="text-lg font-semibold mb-3">{{ modalMode === 'create' ? 'New Item' : 'Edit Item' }}</h3>
          <form (ngSubmit)="saveModal()" class="space-y-3">
            <div>
              <label class="text-sm">SKU</label>
              <input [(ngModel)]="modalModel.sku" name="sku" required class="w-full mt-1" />
            </div>
            <div>
              <label class="text-sm">Name</label>
              <input [(ngModel)]="modalModel.name" name="name" required class="w-full mt-1" />
            </div>
            <div>
              <label class="text-sm">On hand</label>
              <input type="number" [(ngModel)]="modalModel.on_hand" name="on_hand" class="w-full mt-1" />
            </div>
            <div>
              <label class="text-sm">Location</label>
              <input [(ngModel)]="modalModel.location" name="location" class="w-full mt-1" />
            </div>
            <div class="flex gap-2 justify-end mt-4">
              <button type="button" (click)="closeModal()" class="px-3 py-1">Cancel</button>
              <button type="submit" class="px-3 py-1 bg-black text-white rounded">{{ modalMode === 'create' ? 'Create' : 'Save' }}</button>
            </div>
          </form>
        </div>
      </div>
    </section>
  `
})
export class InventoryPageComponent {
  items: any[] = [];
  modalOpen = false;
  modalMode: 'create'|'edit' = 'create';
  editingId: string | null = null;
  modalModel: any = { sku: '', name: '', on_hand: 0, location: '' };

  constructor(private api: ApiService) { this.load(); }

  load() { this.api.getInventory().subscribe({ next: (res: any) => this.items = res || [], error: () => this.items = [] }); }

  openCreate() { this.modalMode = 'create'; this.modalModel = { sku: '', name: '', on_hand: 0, location: '' }; this.modalOpen = true; }
  openEdit(i: any) { this.modalMode = 'edit'; this.editingId = i.id; this.modalModel = { sku: i.sku, name: i.name, on_hand: i.on_hand, location: i.location }; this.modalOpen = true; }
  closeModal() { this.modalOpen = false; this.editingId = null; }

  saveModal() {
    if (this.modalMode === 'create') {
      this.api.createInventoryItem(this.modalModel).subscribe({ next: () => { this.closeModal(); this.load(); } });
      return;
    }
    if (!this.editingId) return this.closeModal();
    this.api.updateInventoryItem(this.editingId, this.modalModel).subscribe({ next: () => { this.closeModal(); this.load(); } });
  }

  deleteItem(id: string) { if (!confirm('Delete item?')) return; this.api.deleteInventoryItem(id).subscribe({ next: () => this.load() }); }
}
