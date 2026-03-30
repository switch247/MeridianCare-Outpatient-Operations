import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../services/api.service';

@Component({
  selector: 'app-user-management',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <section class="panel">
      <div class="flex items-center justify-between mb-4">
        <h2 class="text-lg font-semibold">User Management</h2>
        <div>
          <button (click)="openCreate()" class="px-3 py-1 bg-black text-white rounded">Create User</button>
        </div>
      </div>

      <div class="overflow-auto bg-white rounded shadow">
        <table class="w-full table-auto">
          <thead class="border-b">
            <tr class="text-left">
              <th class="px-4 py-2">Username</th>
              <th class="px-4 py-2">Role</th>
              <th class="px-4 py-2">Clinic</th>
              <th class="px-4 py-2">Actions</th>
            </tr>
          </thead>
          <tbody>
            <tr *ngFor="let u of users" class="border-b">
              <td class="px-4 py-3">{{ u.username }}</td>
              <td class="px-4 py-3">{{ u.role }}</td>
              <td class="px-4 py-3">{{ u.clinic_id || '-' }}</td>
              <td class="px-4 py-3">
                <div style="position:relative; display:inline-block">
                  <button (click)="toggleRowMenu(u.id)" class="px-2 py-1 bg-gray-100 rounded">Actions ▾</button>
                  <div *ngIf="rowMenuOpen === u.id" class="bg-white border shadow rounded mt-1" style="position:absolute; right:0; z-index:20; min-width:140px;">
                    <button class="w-full text-left px-3 py-2" (click)="openEdit(u)">Edit</button>
                    <button class="w-full text-left px-3 py-2 text-red-600" (click)="confirmDelete(u.id)">Delete</button>
                  </div>
                </div>
              </td>
            </tr>
            <tr *ngIf="users.length === 0">
              <td class="px-4 py-6" colspan="4">No users found.</td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- Modal -->
      <div *ngIf="modalOpen" class="fixed inset-0 flex items-center justify-center" style="z-index:40;">
        <div class="absolute inset-0 bg-black opacity-40" (click)="closeModal()"></div>
        <div class="bg-white rounded shadow p-6 z-50 w-full max-w-md">
          <h3 class="text-lg font-semibold mb-3">{{ modalMode === 'create' ? 'Create User' : 'Edit User' }}</h3>
          <form (ngSubmit)="saveModal()" class="space-y-3">
            <div>
              <label class="text-sm">Username</label>
              <input [(ngModel)]="modalModel.username" name="musername" required class="w-full mt-1" />
            </div>
            <div *ngIf="modalMode === 'create'">
              <label class="text-sm">Password</label>
              <input [(ngModel)]="modalModel.password" name="mpassword" type="password" required class="w-full mt-1" />
            </div>
            <div>
              <label class="text-sm">Role</label>
              <select [(ngModel)]="modalModel.role" name="mrole" class="w-full mt-1">
                <option *ngFor="let r of roles" [value]="r">{{ r }}</option>
              </select>
            </div>
            <div>
              <label class="text-sm">Clinic ID (optional)</label>
              <input [(ngModel)]="modalModel.clinic_id" name="mclinic" class="w-full mt-1" />
            </div>
            <div class="flex gap-2 justify-end mt-4">
              <button type="button" class="px-3 py-1 bg-gray-100 rounded" (click)="closeModal()">Cancel</button>
              <button type="submit" class="px-3 py-1 bg-black text-white rounded">{{ modalMode === 'create' ? 'Create' : 'Save' }}</button>
            </div>
          </form>
        </div>
      </div>
    </section>
  `
})
export class UserManagementComponent {
  users: any[] = [];
  roles = ['physician','pharmacist','billing','inventory','admin','auditor'];
  newUser = { username: '', password: '', role: 'physician' };
  editingId: string | null = null;
  editModel: any = { username: '', role: '' };
  rowMenuOpen: string | null = null;
  modalOpen = false;
  modalMode: 'create' | 'edit' = 'create';
  modalModel: any = { username: '', password: '', role: 'physician', clinic_id: '' };

  constructor(private api: ApiService) { this.load(); }

  load() { this.api.getUsers().subscribe({ next: (res: any) => (this.users = res || []), error: () => (this.users = []) }); }

  create() {
    const payload = { username: this.newUser.username, password: this.newUser.password, role: this.newUser.role };
    this.api.createUser(payload).subscribe({ next: () => { this.newUser = { username: '', password: '', role: 'physician' }; this.load(); } });
  }

  startEdit(u: any) {
    this.openEdit(u);
  }

  cancelEdit() { this.editingId = null; this.editModel = { username: '', role: '' }; }

  saveEdit(id: string) {
    const payload = { username: this.editModel.username, role: this.editModel.role };
    this.api.updateUser(id, payload).subscribe({ next: () => { this.cancelEdit(); this.load(); } });
  }

  delete(id: string) {
    if (!confirm('Delete user?')) return;
    this.api.deleteUser(id).subscribe({ next: () => this.load() });
  }

  toggleRowMenu(id: string) {
    this.rowMenuOpen = this.rowMenuOpen === id ? null : id;
  }

  openCreate() {
    this.modalMode = 'create';
    this.modalModel = { username: '', password: '', role: this.roles[0], clinic_id: '' };
    this.modalOpen = true;
  }

  openEdit(u: any) {
    this.modalMode = 'edit';
    this.modalModel = { username: u.username, password: '', role: u.role, clinic_id: u.clinic_id };
    this.editingId = u.id;
    this.modalOpen = true;
    this.rowMenuOpen = null;
  }

  closeModal() {
    this.modalOpen = false;
    this.editingId = null;
  }

  saveModal() {
    if (this.modalMode === 'create') {
      const payload: any = { username: this.modalModel.username, password: this.modalModel.password, role: this.modalModel.role };
      if (this.modalModel.clinic_id) payload.clinic_id = this.modalModel.clinic_id;
      this.api.createUser(payload).subscribe({ next: () => { this.closeModal(); this.load(); } });
    } else {
      const payload: any = { username: this.modalModel.username, role: this.modalModel.role };
      if (this.modalModel.password) payload.password = this.modalModel.password;
      if (this.modalModel.clinic_id) payload.clinic_id = this.modalModel.clinic_id;
      if (!this.editingId) return this.closeModal();
      this.api.updateUser(this.editingId, payload).subscribe({ next: () => { this.closeModal(); this.load(); } });
    }
  }

  confirmDelete(id: string) {
    if (!confirm('Delete user?')) return;
    this.api.deleteUser(id).subscribe({ next: () => this.load() });
  }
}
