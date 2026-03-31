import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../services/api.service';

@Component({
  selector: 'app-user-management',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <section class="um-wrap">
      <header>
        <h3>User Management</h3>
        <button (click)="openCreate()">Create User</button>
      </header>

      <table>
        <thead>
          <tr>
            <th>Username</th>
            <th>Role</th>
            <th>Lockout</th>
            <th>Clinic</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          <tr *ngFor="let u of users">
            <td>{{ u.username }}</td>
            <td>{{ u.role }}</td>
            <td>{{ u.lockout_until ? 'Locked' : 'Active' }}</td>
            <td>{{ u.clinic_id || '-' }}</td>
            <td class="actions">
              <button class="ghost" (click)="openEdit(u)">Edit</button>
              <button class="ghost" *ngIf="u.lockout_until" (click)="unlock(u.id)">Unlock</button>
              <button class="danger" (click)="confirmDelete(u.id)">Delete</button>
            </td>
          </tr>
          <tr *ngIf="users.length === 0"><td colspan="5">No users.</td></tr>
        </tbody>
      </table>

      <div *ngIf="modalOpen" class="modal-mask">
        <div class="modal">
          <h4>{{ modalMode === 'create' ? 'Create User' : 'Edit User' }}</h4>
          <label>Username<input [(ngModel)]="modalModel.username" /></label>
          <label *ngIf="modalMode === 'create'">Password<input type="password" [(ngModel)]="modalModel.password" /></label>
          <label>Role
            <select [(ngModel)]="modalModel.role">
              <option *ngFor="let r of roles" [value]="r">{{ r }}</option>
            </select>
          </label>
          <div class="modal-actions">
            <button class="ghost" (click)="closeModal()">Cancel</button>
            <button (click)="saveModal()">{{ modalMode === 'create' ? 'Create' : 'Save' }}</button>
          </div>
        </div>
      </div>

      <p class="msg">{{ message }}</p>
    </section>
  `,
  styles: [`
    .um-wrap { display: grid; gap: .8rem; }
    header { display: flex; justify-content: space-between; align-items: center; }
    h3 { margin: 0; }
    button { border: 1px solid #0a4f38; background: #0f6a4b; color: #fff; padding: .38rem .65rem; }
    .ghost { background: transparent; color: #10231b; border-color: #c6d5cc; }
    .danger { background: transparent; color: #8b2a2a; border-color: #d7c4c4; }
    table { width: 100%; border-collapse: collapse; background: #fbfcf8; border: 1px solid #d4ded6; }
    th, td { border-bottom: 1px solid #e5ece7; padding: .5rem; text-align: left; font-size: .85rem; }
    .actions { display: flex; gap: .35rem; }
    .modal-mask { position: fixed; inset: 0; background: rgba(0,0,0,.35); display: grid; place-items: center; }
    .modal { background: #fff; border: 1px solid #d4ded6; padding: 1rem; width: min(460px, 95vw); display: grid; gap: .55rem; }
    label { display: grid; gap: .2rem; font-size: .85rem; }
    input, select { border: 1px solid #d4ded6; padding: .45rem; }
    .modal-actions { display: flex; justify-content: flex-end; gap: .45rem; }
    .msg { margin: 0; color: #8b2a2a; }
  `]
})
export class UserManagementComponent {
  users: any[] = [];
  roles = ['physician', 'pharmacist', 'billing', 'inventory', 'admin', 'auditor'];
  modalOpen = false;
  modalMode: 'create' | 'edit' = 'create';
  editingId: string | null = null;
  modalModel: any = { username: '', password: '', role: 'physician' };
  message = '';

  constructor(private api: ApiService) {
    this.load();
  }

  load() {
    this.api.getUsers().subscribe({ next: (res: any) => (this.users = res || []), error: () => (this.users = []) });
  }

  openCreate() {
    this.modalMode = 'create';
    this.editingId = null;
    this.modalModel = { username: '', password: '', role: this.roles[0] };
    this.modalOpen = true;
  }

  openEdit(u: any) {
    this.modalMode = 'edit';
    this.editingId = u.id;
    this.modalModel = { username: u.username, password: '', role: u.role };
    this.modalOpen = true;
  }

  closeModal() {
    this.modalOpen = false;
    this.editingId = null;
  }

  saveModal() {
    if (this.modalMode === 'create') {
      this.api.createUser(this.modalModel).subscribe({
        next: () => {
          this.message = 'User created.';
          this.closeModal();
          this.load();
        },
        error: (err: any) => { this.message = err?.error?.msg || 'Create failed.'; },
      });
      return;
    }

    if (!this.editingId) return;
    const payload: any = { username: this.modalModel.username, role: this.modalModel.role };
    if (this.modalModel.password) payload.password = this.modalModel.password;
    this.api.updateUser(this.editingId, payload).subscribe({
      next: () => {
        this.message = 'User updated.';
        this.closeModal();
        this.load();
      },
      error: (err: any) => { this.message = err?.error?.msg || 'Update failed.'; },
    });
  }

  confirmDelete(id: string) {
    if (!confirm('Delete user?')) return;
    this.api.deleteUser(id, 'admin_delete').subscribe({
      next: () => { this.message = 'User deleted.'; this.load(); },
      error: (err: any) => { this.message = err?.error?.msg || 'Delete failed.'; },
    });
  }

  unlock(id: string) {
    this.api.unlockUser(id).subscribe({
      next: () => { this.message = 'User unlocked.'; this.load(); },
      error: (err: any) => { this.message = err?.error?.msg || 'Unlock failed.'; },
    });
  }
}
