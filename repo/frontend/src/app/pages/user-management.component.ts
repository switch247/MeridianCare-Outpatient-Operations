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
      <h2>User Management</h2>

      <form (ngSubmit)="create()" class="row">
        <input [(ngModel)]="newUser.username" name="username" placeholder="username" required />
        <input [(ngModel)]="newUser.password" name="password" placeholder="password" type="password" required />
        <select [(ngModel)]="newUser.role" name="role">
          <option *ngFor="let r of roles" [value]="r">{{ r }}</option>
        </select>
        <button type="submit">Create</button>
      </form>

      <ul>
        <li *ngFor="let u of users">
          <ng-container *ngIf="editingId !== u.id; else editTpl">
            <strong>{{ u.username }}</strong> — {{ u.role }}
            <button (click)="startEdit(u)">Edit</button>
            <button (click)="delete(u.id)">Delete</button>
          </ng-container>
          <ng-template #editTpl>
            <input [(ngModel)]="editModel.username" placeholder="username" />
            <select [(ngModel)]="editModel.role">
              <option *ngFor="let r of roles" [value]="r">{{ r }}</option>
            </select>
            <button (click)="saveEdit(u.id)">Save</button>
            <button (click)="cancelEdit()">Cancel</button>
          </ng-template>
        </li>
      </ul>
    </section>
  `
})
export class UserManagementComponent {
  users: any[] = [];
  roles = ['physician','pharmacist','billing','inventory','admin','auditor'];
  newUser = { username: '', password: '', role: 'physician' };
  editingId: string | null = null;
  editModel: any = { username: '', role: '' };

  constructor(private api: ApiService) { this.load(); }

  load() { this.api.getUsers().subscribe({ next: (res: any) => (this.users = res || []), error: () => (this.users = []) }); }

  create() {
    const payload = { username: this.newUser.username, password: this.newUser.password, role: this.newUser.role };
    this.api.createUser(payload).subscribe({ next: () => { this.newUser = { username: '', password: '', role: 'physician' }; this.load(); } });
  }

  startEdit(u: any) {
    this.editingId = u.id;
    this.editModel = { username: u.username, role: u.role };
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
}
