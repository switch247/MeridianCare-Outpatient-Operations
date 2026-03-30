import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../services/api.service';

@Component({
  selector: 'app-invoices-page',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <section class="panel">
      <div class="flex items-center justify-between mb-4">
        <h2 class="text-lg font-semibold">Invoices</h2>
        <div>
          <button (click)="openCreate()" class="px-3 py-1 bg-black text-white rounded">New Invoice</button>
        </div>
      </div>

      <div class="overflow-auto bg-white rounded shadow">
        <table class="w-full table-auto">
          <thead class="border-b">
            <tr class="text-left">
              <th class="px-4 py-2">Invoice #</th>
              <th class="px-4 py-2">Patient</th>
              <th class="px-4 py-2">Total</th>
              <th class="px-4 py-2">Status</th>
              <th class="px-4 py-2">Actions</th>
            </tr>
          </thead>
          <tbody>
            <tr *ngFor="let inv of invoices" class="border-b">
              <td class="px-4 py-3">{{ inv.id }}</td>
              <td class="px-4 py-3">{{ inv.patient_name || '-' }}</td>
              <td class="px-4 py-3">{{ inv.total || 0 }}</td>
              <td class="px-4 py-3">{{ inv.status || 'open' }}</td>
              <td class="px-4 py-3">
                <button (click)="openEdit(inv)" class="px-2 py-1 mr-2">Edit</button>
                <button (click)="deleteInvoice(inv.id)" class="px-2 py-1 text-red-600">Delete</button>
              </td>
            </tr>
            <tr *ngIf="invoices.length === 0">
              <td class="px-4 py-6" colspan="5">No invoices.</td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- Modal -->
      <div *ngIf="modalOpen" class="fixed inset-0 flex items-center justify-center" style="z-index:40;">
        <div class="absolute inset-0 bg-black opacity-40" (click)="closeModal()"></div>
        <div class="bg-white rounded shadow p-6 z-50 w-full max-w-md">
          <h3 class="text-lg font-semibold mb-3">{{ modalMode === 'create' ? 'New Invoice' : 'Edit Invoice' }}</h3>
          <form (ngSubmit)="saveModal()" class="space-y-3">
            <div>
              <label class="text-sm">Patient</label>
              <input [(ngModel)]="modalModel.patient_name" name="patient_name" required class="w-full mt-1" />
            </div>
            <div>
              <label class="text-sm">Total</label>
              <input type="number" [(ngModel)]="modalModel.total" name="total" class="w-full mt-1" />
            </div>
            <div>
              <label class="text-sm">Status</label>
              <select [(ngModel)]="modalModel.status" name="status" class="w-full mt-1">
                <option value="open">open</option>
                <option value="paid">paid</option>
                <option value="void">void</option>
              </select>
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
export class InvoicesPageComponent {
  invoices: any[] = [];
  modalOpen = false;
  modalMode: 'create'|'edit' = 'create';
  editingId: string | null = null;
  modalModel: any = { patient_name: '', total: 0, status: 'open' };

  constructor(private api: ApiService) { this.load(); }

  load() { this.api.getInvoices().subscribe({ next: (res: any) => this.invoices = res || [], error: () => this.invoices = [] }); }

  openCreate() { this.modalMode = 'create'; this.modalModel = { patient_name: '', total: 0, status: 'open' }; this.modalOpen = true; }
  openEdit(inv: any) { this.modalMode = 'edit'; this.editingId = inv.id; this.modalModel = { patient_name: inv.patient_name, total: inv.total, status: inv.status || 'open' }; this.modalOpen = true; }
  closeModal() { this.modalOpen = false; this.editingId = null; }

  saveModal() {
    if (this.modalMode === 'create') {
      this.api.createInvoice(this.modalModel).subscribe({ next: () => { this.closeModal(); this.load(); } });
      return;
    }
    if (!this.editingId) return this.closeModal();
    this.api.createInvoice(this.modalModel).subscribe({ next: () => { this.closeModal(); this.load(); } });
  }

  deleteInvoice(id: string) { if (!confirm('Delete invoice?')) return; this.api.deleteInvoice(id).subscribe({ next: () => this.load() }); }
}
