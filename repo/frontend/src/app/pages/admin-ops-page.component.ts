import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../services/api.service';

@Component({
  selector: 'app-admin-ops-page',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <section class="ops-wrap">
      <header>
        <h3>Admin Operations</h3>
        <p>Crawler orchestration, model drift, exception alerts, and local backup drills.</p>
      </header>

      <article class="panel">
        <h4>Crawler</h4>
        <div class="row">
          <input [(ngModel)]="crawlSource" placeholder="sourceName" />
          <input type="number" [(ngModel)]="crawlPriority" min="1" max="10" />
          <button (click)="queueCrawler()">Queue Job</button>
          <button (click)="processCrawler()">Process Next</button>
          <button class="ghost" (click)="loadCrawler()">Refresh</button>
        </div>
        <pre>{{ crawlerJobs | json }}</pre>
      </article>

      <article class="panel">
        <h4>Models</h4>
        <div class="row">
          <input [(ngModel)]="modelType" placeholder="model type" />
          <input [(ngModel)]="modelVersion" placeholder="version tag" />
          <button (click)="registerModel()">Register + Deploy</button>
          <button class="ghost" (click)="loadDrift()">Refresh Drift</button>
        </div>
        <pre>{{ modelDrift | json }}</pre>
      </article>

      <article class="panel">
        <h4>Exception Alerts</h4>
        <div class="row">
          <input [(ngModel)]="exceptionMessage" placeholder="message" />
          <button (click)="createException()">Create Alert</button>
          <button class="ghost" (click)="loadExceptions()">Refresh</button>
        </div>
        <pre>{{ exceptions | json }}</pre>
      </article>

      <article class="panel">
        <h4>Backups and Restore Drills</h4>
        <div class="row">
          <button (click)="runBackup()">Run Nightly Backup</button>
          <button (click)="runDrill()">Record Restore Drill</button>
          <button class="ghost" (click)="loadBackups()">Refresh</button>
        </div>
        <pre>{{ backups | json }}</pre>
      </article>

      <p class="msg">{{ message }}</p>
    </section>
  `,
  styles: [`
    .ops-wrap { display: grid; gap: .9rem; }
    header h3 { margin: 0; }
    header p { margin: .3rem 0 0; color: #5f7469; }
    .panel { border: 1px solid #d4ded6; background: #fbfcf8; padding: 1rem; }
    .row { display: flex; gap: .55rem; flex-wrap: wrap; margin-bottom: .5rem; }
    input { border: 1px solid #d4ded6; padding: .45rem; min-width: 150px; }
    button { border: 1px solid #0a4f38; background: #0f6a4b; color: #fff; padding: .35rem .65rem; }
    .ghost { background: transparent; color: #10231b; border-color: #c7d7cd; }
    pre { margin: 0; max-height: 190px; overflow: auto; background: #f5faf7; border: 1px solid #e0e9e2; padding: .6rem; }
    .msg { margin: 0; color: #8b2a2a; }
  `],
})
export class AdminOpsPageComponent {
  message = '';
  crawlSource = 'icd-update';
  crawlPriority = 2;
  crawlerJobs: any[] = [];

  modelType = 'visit_volume';
  modelVersion = `v${Date.now()}`;
  modelDrift: any[] = [];

  exceptionMessage = 'Sample exception alert';
  exceptions: any[] = [];
  backups: any[] = [];

  constructor(private api: ApiService) {
    this.loadCrawler();
    this.loadDrift();
    this.loadExceptions();
    this.loadBackups();
  }

  queueCrawler() {
    this.api.runCrawler({ sourceName: this.crawlSource, priority: Number(this.crawlPriority) }).subscribe({
      next: () => { this.message = 'Crawler job queued'; this.loadCrawler(); },
      error: (err: any) => { this.message = err?.error?.msg || 'Queue failed'; },
    });
  }

  processCrawler() {
    this.api.processCrawlerNext({ nodeId: 'admin-node-1' }).subscribe({
      next: () => { this.message = 'Crawler processed'; this.loadCrawler(); },
      error: (err: any) => { this.message = err?.error?.msg || 'No ready jobs'; },
    });
  }

  loadCrawler() {
    this.api.getCrawlerQueue().subscribe({ next: (res: any) => { this.crawlerJobs = res || []; } });
  }

  registerModel() {
    this.api.registerModel({
      modelType: this.modelType,
      versionTag: this.modelVersion,
      algorithm: 'baseline_regression',
      baselineScore: 0.7,
      currentScore: 0.82,
      deploy: true,
    }).subscribe({
      next: () => { this.message = 'Model registered'; this.loadDrift(); },
      error: (err: any) => { this.message = err?.error?.msg || 'Model register failed'; },
    });
  }

  loadDrift() {
    this.api.getModelDrift().subscribe({ next: (res: any) => { this.modelDrift = res || []; } });
  }

  createException() {
    this.api.createException({ level: 'error', source: 'admin_console', message: this.exceptionMessage, details: { test: true } }).subscribe({
      next: () => { this.message = 'Exception alert recorded'; this.loadExceptions(); },
      error: (err: any) => { this.message = err?.error?.msg || 'Exception create failed'; },
    });
  }

  loadExceptions() {
    this.api.getExceptions().subscribe({ next: (res: any) => { this.exceptions = res || []; } });
  }

  runBackup() {
    this.api.runNightlyBackup({}).subscribe({
      next: () => { this.message = 'Nightly backup completed'; this.loadBackups(); },
      error: (err: any) => { this.message = err?.error?.msg || 'Backup failed'; },
    });
  }

  runDrill() {
    this.api.createRestoreDrill({ status: 'completed', notes: 'monthly drill via UI' }).subscribe({
      next: () => { this.message = 'Restore drill recorded'; this.loadBackups(); },
      error: (err: any) => { this.message = err?.error?.msg || 'Drill failed'; },
    });
  }

  loadBackups() {
    this.api.getNightlyBackups().subscribe({
      next: (res: any) => {
        this.backups = res || [];
      },
    });
  }
}
