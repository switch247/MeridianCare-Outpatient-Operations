import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../services/api.service';

@Component({
  selector: 'app-my-clinic',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <section>
      <div class="flex items-center justify-between mb-4">
        <h2 class="text-lg font-semibold">My Clinic</h2>
        <div>
          <button *ngIf="currentUser?.role === 'admin'" (click)="openEdit()" class="px-3 py-1 bg-black text-white rounded">Edit Clinic</button>
        </div>
      </div>

      <div class="bg-white p-4 rounded shadow max-w-3xl">
        <h3 class="font-semibold">{{ clinic?.name || 'No clinic configured' }}</h3>
        <p class="text-sm text-gray-600">{{ clinic?.type }}</p>
        <div class="mt-3">
          <p><strong>Address</strong></p>
          <div class="p-2 bg-gray-50 rounded">{{ clinic?.address || '—' }}</div>
        </div>
        <div class="mt-3">
            <p><strong>Contact</strong></p>
            <div class="p-2 bg-gray-50 rounded">
              <div *ngIf="clinic?.contactInfo">
                <div><strong>Email:</strong> {{ clinic.contactInfo.email || '—' }}</div>
                <div><strong>Phone:</strong> {{ clinic.contactInfo.phone || '—' }}</div>
              </div>
              <div *ngIf="!clinic?.contactInfo">—</div>
            </div>
          </div>
      </div>

      <div class="mt-6 grid grid-cols-1 md:grid-cols-2 gap-4">
        <div class="bg-white p-4 rounded shadow">
          <strong>Order Volume</strong>
          <div>{{ kpis?.orderVolume ?? 0 }}</div>
        </div>
        <div class="bg-white p-4 rounded shadow">
          <strong>Acceptance Rate</strong>
          <div>{{ kpis?.acceptanceRate ?? 0 }}</div>
        </div>
      </div>

      <!-- Edit modal -->
      <div *ngIf="modalOpen" class="fixed inset-0 flex items-center justify-center" style="z-index:40;">
        <div class="absolute inset-0 bg-black opacity-40" (click)="closeModal()"></div>
        <div class="bg-white rounded shadow p-6 z-50 w-full max-w-md">
          <h3 class="text-lg font-semibold mb-3">Edit Clinic</h3>
          <form (ngSubmit)="save()" class="space-y-3">
            <div>
              <label class="text-sm">Name</label>
              <input [(ngModel)]="edit.name" name="cname" required class="w-full mt-1" />
            </div>
            <div>
              <label class="text-sm">Type</label>
              <input [(ngModel)]="edit.type" name="ctype" class="w-full mt-1" />
            </div>
            <div>
              <label class="text-sm">Address</label>
              <textarea [(ngModel)]="edit.address" name="caddr" class="w-full mt-1"></textarea>
            </div>
            <div>
              <label class="text-sm">Contact Email</label>
              <input [(ngModel)]="edit.contactInfo.email" name="cemail" class="w-full mt-1" />
            </div>
            <div>
              <label class="text-sm">Contact Phone</label>
              <input [(ngModel)]="edit.contactInfo.phone" name="cphone" class="w-full mt-1" />
            </div>
            <div class="flex gap-2 justify-end mt-4">
              <button type="button" style="background:#eef2f7;color:#111;padding:0.5rem 0.75rem;border-radius:6px" (click)="closeModal()">Cancel</button>
              <button type="submit" class="px-3 py-1 bg-black text-white rounded">Save</button>
            </div>
          </form>
        </div>
      </div>
    </section>
  `
})
export class MyClinicComponent {
  clinic: any = null;
  currentUser: any = null;
  modalOpen = false;
  edit: any = { name: '', type: '', address: '', contactInfo: { email: '', phone: '' } };
  kpis: any = null;

  constructor(private api: ApiService) { this.load(); this.loadMe(); this.loadKpis(); }

  load() {
    this.api.getClinic().subscribe({ next: (res: any) => {
      this.clinic = res || {};
      const ci = (res && (res.contactInfo || res.contact_info)) || {};
      this.clinic.contactInfo = ci;
    }, error: () => { this.clinic = null; } });
  }

  loadMe() { this.api.getMe().subscribe({ next: (u: any) => { this.currentUser = u; }, error: () => { this.currentUser = null; } }); }
  loadKpis() { this.api.getKpis().subscribe({ next: (k: any) => { this.kpis = k; }, error: () => { this.kpis = null; } }); }

  openEdit() {
    if (!this.clinic) return;
    const ci = this.clinic.contactInfo || this.clinic.contact_info || {};
    this.edit = { name: this.clinic.name || '', type: this.clinic.type || '', address: this.clinic.address || '', contactInfo: { email: ci.email || '', phone: ci.phone || '' } };
    this.modalOpen = true;
  }

  closeModal() { this.modalOpen = false; }

  save() {
    if (!this.clinic || !this.clinic.id) return this.closeModal();
    const payload = { name: this.edit.name, type: this.edit.type, address: this.edit.address, contactInfo: this.edit.contactInfo };
    this.api.updateClinic(this.clinic.id, payload).subscribe({ next: (res: any) => { this.clinic = res || {}; this.clinic.contactInfo = (res && (res.contactInfo || res.contact_info)) || {}; this.closeModal(); }, error: () => { this.closeModal(); } });
  }
}
