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
            <input placeholder="Search jobs" [(ngModel)]="crawlerQ" />
            <button class="ghost" (click)="crawlerPage=1; loadCrawler(crawlerQ, crawlerPage)">Search</button>
        </div>
          <table class="ops-table">
          <thead><tr><th>ID</th><th>Source</th><th>Priority</th><th>State</th><th>Worker</th></tr></thead>
          <tbody>
            <tr *ngFor="let j of crawlerJobs">
              <td>{{ j.id || j.jobId || j._id || '-' }}</td>
              <td>{{ j.sourceName || j.source || '-' }}</td>
              <td>{{ j.priority || '-' }}</td>
              <td>{{ j.state || j.status || '-' }}</td>
              <td>{{ j.nodeId || j.worker || '-' }}</td>
            </tr>
            <tr *ngIf="crawlerJobs.length===0"><td colspan="5">No jobs</td></tr>
          </tbody>
        </table>
        <div style="display:flex; justify-content:space-between; align-items:center; margin-top:.45rem">
          <div>Showing {{ ((crawlerPage-1)*crawlerPageSize)+1 }} - {{ min(crawlerPage*crawlerPageSize, crawlerTotal) }} of {{ crawlerTotal }}</div>
          <div>
            <button class="ghost" (click)="crawlerPrev()" [disabled]="crawlerPage===1">Prev</button>
            <button class="ghost" (click)="crawlerNext()" [disabled]="(crawlerPage*crawlerPageSize) >= crawlerTotal">Next</button>
          </div>
        </div>
      </article>

      <article class="panel">
        <h4>Models</h4>
        <div class="row">
          <input [(ngModel)]="modelType" placeholder="model type" />
          <input [(ngModel)]="modelVersion" placeholder="version tag" />
          <button (click)="registerModel()">Register + Deploy</button>
          <button class="ghost" (click)="loadDrift()">Refresh Drift</button>
          <input placeholder="Filter drift" [(ngModel)]="modelQ" />
          <button class="ghost" (click)="loadDrift()">Filter</button>
        </div>
        <table class="ops-table">
          <thead><tr><th>Model</th><th>Version</th><th>Baseline</th><th>Current</th><th>Drift</th></tr></thead>
          <tbody>
            <tr *ngFor="let m of modelDriftDisplayed">
              <td>{{ m.modelType || m.name || '-' }}</td>
              <td>{{ m.versionTag || m.version || '-' }}</td>
              <td>{{ m.baselineScore !== null && m.baselineScore !== undefined ? (m.baselineScore | number:'1.4-4') : '-' }}</td>
              <td>{{ m.currentScore !== null && m.currentScore !== undefined ? (m.currentScore | number:'1.4-4') : '-' }}</td>
              <td>{{ (m.driftScore !== null && m.driftScore !== undefined) ? (m.driftScore | number:'1.4-4') : (m.currentScore != null && m.baselineScore != null ? ((m.currentScore - m.baselineScore) | number:'1.4-4') : '-') }}</td>
            </tr>
            <tr *ngIf="modelTotal===0"><td colspan="5">No drift records</td></tr>
          </tbody>
        </table>
        <div style="display:flex; justify-content:space-between; align-items:center; margin-top:.45rem">
          <div>Showing {{ ((modelPage-1)*modelPageSize)+1 }} - {{ min(modelPage*modelPageSize, modelTotal) }} of {{ modelTotal }}</div>
          <div>
            <button class="ghost" (click)="modelPrev()" [disabled]="modelPage===1">Prev</button>
            <button class="ghost" (click)="modelNext()" [disabled]="(modelPage*modelPageSize) >= modelTotal">Next</button>
          </div>
        </div>
      </article>

      <article class="panel">
        <h4>Forecasts and Recommendations</h4>
        <div class="row">
          <button (click)="loadForecasts()">Refresh Forecasts</button>
          <button (click)="loadRecommendations()">Refresh Recommendations</button>
        </div>
        <pre>{{ forecasts | json }}</pre>
        <pre>{{ recommendations | json }}</pre>
      </article>

      <article class="panel">
        <h4>Exception Alerts</h4>
        <div class="row">
          <input [(ngModel)]="exceptionMessage" placeholder="message" />
          <button (click)="createException()">Create Alert</button>
          <button class="ghost" (click)="loadExceptions()">Refresh</button>
          <input placeholder="Search exceptions" [(ngModel)]="exceptionQ" />
          <button class="ghost" (click)="exceptionPage=1; loadExceptions(exceptionQ, exceptionPage)">Search</button>
        </div>
        <table class="ops-table">
          <thead><tr><th>ID</th><th>Level</th><th>Source</th><th>Message</th><th></th></tr></thead>
          <tbody>
            <tr *ngFor="let e of exceptions">
              <td>{{ e.id || e._id || '-' }}</td>
              <td>{{ e.level || '-' }}</td>
              <td>{{ e.source || '-' }}</td>
              <td>{{ e.message || '-' }}</td>
              <td><button class="ghost" (click)="openDetail(e)">Details</button></td>
            </tr>
            <tr *ngIf="exceptions.length===0"><td colspan="5">No exceptions</td></tr>
          </tbody>
        </table>
        <div style="display:flex; justify-content:space-between; align-items:center; margin-top:.45rem">
          <div>Showing {{ ((exceptionPage-1)*exceptionPageSize)+1 }} - {{ min(exceptionPage*exceptionPageSize, exceptionTotal) }} of {{ exceptionTotal }}</div>
          <div>
            <button class="ghost" (click)="exceptionPrev()" [disabled]="exceptionPage===1">Prev</button>
            <button class="ghost" (click)="exceptionNext()" [disabled]="(exceptionPage*exceptionPageSize) >= exceptionTotal">Next</button>
          </div>
        </div>
      </article>

      <article class="panel">
        <h4>Backups and Restore Drills</h4>
        <div class="row">
          <button (click)="runBackup()">Run Nightly Backup</button>
          <button (click)="runDrill()">Record Restore Drill</button>
          <button class="ghost" (click)="loadBackups()">Refresh</button>
        </div>
        <table class="ops-table">
          <thead><tr><th>ID</th><th>Status</th><th>Started</th><th>Notes</th></tr></thead>
          <tbody>
            <tr *ngFor="let b of backups">
              <td>{{ b.id || b._id || '-' }}</td>
              <td>{{ b.status || b.state || '-' }}</td>
              <td>{{ b.startedAt || b.createdAt || '-' }}</td>
              <td>{{ b.notes || b.message || '-' }}</td>
            </tr>
            <tr *ngIf="backups.length===0"><td colspan="4">No backups</td></tr>
          </tbody>
        </table>
      </article>

      <!-- Details modal -->
      <div *ngIf="detailOpen" class="modal-wrap">
        <div class="modal-backdrop" (click)="closeDetail()"></div>
        <div class="modal-panel">
          <h4>Details</h4>
          <div *ngIf="detailModel">
            <table class="ops-table">
              <tbody>
                <tr *ngFor="let k of objectKeys(detailModel)">
                  <td style="width:30%; font-weight:600">{{ k }}</td>
                  <td>{{ detailModel[k] }}</td>
                </tr>
              </tbody>
            </table>
          </div>
          <div class="actions" style="margin-top:.6rem">
            <button class="ghost" (click)="closeDetail()">Close</button>
          </div>
        </div>
      </div>

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
    .ops-table { width: 100%; border-collapse: collapse; margin-top: .5rem; }
    .ops-table th, .ops-table td { text-align: left; padding: .45rem; border-bottom: 1px solid #e9f2ec; font-size: .9rem; }
    .ops-table thead th { font-weight: 600; color: #11402e; }
    /* modal */
    .modal-wrap { position: fixed; inset: 0; display: flex; align-items: center; justify-content: center; z-index: 1200; }
    .modal-backdrop { position: absolute; inset: 0; background: rgba(10,10,10,0.45); }
    .modal-panel { position: relative; background: #fff; border-radius: 8px; padding: 1rem; max-width: 820px; width: 94%; max-height: 86vh; overflow: auto; box-shadow: 0 10px 30px rgba(8,18,12,0.35); z-index: 1210; }
    .msg { margin: 0; color: #8b2a2a; }
  `],
})
export class AdminOpsPageComponent {
  message = '';
  crawlSource = 'icd-update';
  crawlPriority = 2;
  crawlerJobs: any[] = [];
  crawlerQ = '';
  crawlerPage = 1;
  crawlerPageSize = 10;
  crawlerTotal = 0;

  modelType = 'visit_volume';
  modelVersion = `v${Date.now()}`;
  modelDrift: any[] = [];
  modelDriftFull: any[] = [];
  modelDriftDisplayed: any[] = [];
  modelPage = 1;
  modelPageSize = 10;
  modelTotal = 0;
  modelQ = '';

  exceptionMessage = 'Sample exception alert';
  exceptions: any[] = [];
  exceptionQ = '';
  exceptionPage = 1;
  exceptionPageSize = 10;
  exceptionTotal = 0;
  backups: any[] = [];
  forecasts: any = null;
  recommendations: any = null;
  detailOpen = false;
  detailModel: any = null;

  constructor(private api: ApiService) {
    this.loadCrawler();
    this.loadDrift();
    this.loadExceptions();
    this.loadBackups();
    this.loadForecasts();
    this.loadRecommendations();
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

  loadCrawler(q?: string, page = 1) {
    const params: any = { page, pageSize: this.crawlerPageSize };
    if (q) params.q = q;
    this.api.getCrawlerQueue(params).subscribe({ next: (res: any) => {
        // support either { items, total } or plain array; when plain array, slice for page
        if (res && Array.isArray(res)) { this.crawlerTotal = res.length; this.crawlerJobs = res.slice((page-1)*this.crawlerPageSize, page*this.crawlerPageSize); }
        else { this.crawlerJobs = res?.items || []; this.crawlerTotal = res?.total || (this.crawlerJobs.length || 0); }
      }, error: () => { this.crawlerJobs = []; this.crawlerTotal = 0; }
    });
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
    // normalize backend shapes (snake_case or camelCase) and apply simple client-side filter
    this.api.getModelDrift().subscribe({ next: (res: any) => {
      const list: any[] = Array.isArray(res) ? res : (res?.items || []);
      const normalized = (list || []).map((m: any) => {
        const baselineRaw = m.baseline_score ?? m.baselineScore ?? m.baseline;
        const currentRaw = m.current_score ?? m.currentScore ?? m.current;
        const driftRaw = m.drift_score ?? m.driftScore ?? m.drift_score;
        return {
          id: m.id || m._id,
          modelType: m.model_type || m.modelType || m.name || '',
          versionTag: m.version_tag || m.versionTag || m.version || '',
          baselineScore: baselineRaw != null && baselineRaw !== '' ? Number(baselineRaw) : null,
          currentScore: currentRaw != null && currentRaw !== '' ? Number(currentRaw) : null,
          driftScore: driftRaw != null && driftRaw !== '' ? Number(driftRaw) : null,
          isDeployed: m.is_deployed ?? m.isDeployed ?? false,
          raw: m,
        };
      });
      const q = (this.modelQ||'').toLowerCase();
      const filtered = normalized.filter((m: any) => {
        if (!q) return true;
        return (m.modelType||'').toLowerCase().includes(q) || (m.versionTag||'').toLowerCase().includes(q);
      });
      this.modelDriftFull = filtered;
      this.modelTotal = this.modelDriftFull.length;
      this.modelPage = 1;
      this.modelDriftDisplayed = this.modelDriftFull.slice(0, this.modelPageSize);
    }, error: () => { this.modelDrift = []; } });
  }

  loadForecasts() {
    this.api.getForecasts().subscribe({ next: (res: any) => { this.forecasts = res || null; } });
  }

  loadRecommendations() {
    this.api.getRecommendations().subscribe({ next: (res: any) => { this.recommendations = res || null; } });
  }

  createException() {
    this.api.createException({ level: 'error', source: 'admin_console', message: this.exceptionMessage, details: { test: true } }).subscribe({
      next: () => { this.message = 'Exception alert recorded'; this.loadExceptions(); },
      error: (err: any) => { this.message = err?.error?.msg || 'Exception create failed'; },
    });
  }

  loadExceptions(q?: string, page = 1) {
    const params: any = { page, pageSize: this.exceptionPageSize };
    if (q) params.q = q;
    this.api.getExceptions(params).subscribe({ next: (res: any) => {
        if (res && Array.isArray(res)) { this.exceptionTotal = res.length; this.exceptions = res.slice((page-1)*this.exceptionPageSize, page*this.exceptionPageSize); }
        else { this.exceptions = res?.items || []; this.exceptionTotal = res?.total || (this.exceptions.length || 0); }
      }, error: () => { this.exceptions = []; this.exceptionTotal = 0; }
    });
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

  // pagination helpers
  crawlerNext() { if ((this.crawlerPage * this.crawlerPageSize) < this.crawlerTotal) { this.crawlerPage++; this.loadCrawler(this.crawlerQ, this.crawlerPage); } }
  crawlerPrev() { if (this.crawlerPage > 1) { this.crawlerPage--; this.loadCrawler(this.crawlerQ, this.crawlerPage); } }
  exceptionNext() { if ((this.exceptionPage * this.exceptionPageSize) < this.exceptionTotal) { this.exceptionPage++; this.loadExceptions(this.exceptionQ, this.exceptionPage); } }
  exceptionPrev() { if (this.exceptionPage > 1) { this.exceptionPage--; this.loadExceptions(this.exceptionQ, this.exceptionPage); } }
  modelNext() { if ((this.modelPage * this.modelPageSize) < this.modelTotal) { this.modelPage++; const start = (this.modelPage-1)*this.modelPageSize; this.modelDriftDisplayed = this.modelDriftFull.slice(start, start+this.modelPageSize); } }
  modelPrev() { if (this.modelPage > 1) { this.modelPage--; const start = (this.modelPage-1)*this.modelPageSize; this.modelDriftDisplayed = this.modelDriftFull.slice(start, start+this.modelPageSize); } }

  openDetail(obj: any) { this.detailModel = obj || null; this.detailOpen = true; }
  closeDetail() { this.detailOpen = false; this.detailModel = null; }

  objectKeys(o: any) { if (!o) return []; return Object.keys(o); }

  min(a: number, b: number) { return Math.min(a, b); }
}
