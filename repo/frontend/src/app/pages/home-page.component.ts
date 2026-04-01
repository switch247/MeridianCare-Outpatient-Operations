import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { ApiService } from '../services/api.service';
import { AuthService } from '../services/auth.service';

@Component({
  selector: 'app-home-page',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './home-page.component.html',
  styles: [],
})
export class HomePageComponent implements OnInit {
  kpis = signal<any>(null);
  overview = signal<any>(null);

  constructor(private api: ApiService, public auth: AuthService) {}

  ngOnInit() {
    this.loadData();
  }

  loadData() {
    // Load KPIs
    this.api.getKpis().subscribe({
      next: (kpis: any) => this.kpis.set(kpis),
      error: (err) => console.error('Failed to load KPIs:', err)
    });

    // Load overview data
    this.api.getOverview().subscribe({
      next: (overview: any) => this.overview.set(overview),
      error: (err) => console.error('Failed to load overview:', err)
    });
  }

  getCurrentDate(): string {
    return new Date().toLocaleDateString();
  }

  formatDate(dateString: string): string {
    return new Date(dateString).toLocaleString();
  }
}
