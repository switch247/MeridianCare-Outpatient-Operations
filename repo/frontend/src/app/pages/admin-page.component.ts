import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';

@Component({
  selector: 'app-admin-page',
  standalone: true,
  imports: [CommonModule, RouterModule],
  template: `<section class="panel"><h2>Admin</h2><ul><li><a routerLink="/users">User Management</a></li><li>KPIs (placeholder)</li><li>Backups (placeholder)</li></ul></section>`
})
export class AdminPageComponent {}
