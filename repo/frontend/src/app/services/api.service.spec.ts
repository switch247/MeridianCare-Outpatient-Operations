import { TestBed } from '@angular/core/testing';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { ApiService } from './api.service';

describe('ApiService', () => {
  let service: ApiService;
  let http: HttpTestingController;

  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [ApiService],
    });
    service = TestBed.inject(ApiService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    http.verify();
    localStorage.clear();
    sessionStorage.clear();
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  // ── Token management ──────────────────────────────────────────────────────

  it('setToken/getToken round-trips the token', () => {
    service.setToken('tok-abc');
    expect(service.getToken()).toBe('tok-abc');
  });

  it('persistToken stores in sessionStorage by default (remember=false)', () => {
    service.persistToken('session-tok', false);
    expect(sessionStorage.getItem('token')).toBe('session-tok');
    expect(localStorage.getItem('token')).toBeNull();
  });

  it('persistToken stores in localStorage when remember=true', () => {
    service.persistToken('local-tok', true);
    expect(localStorage.getItem('token')).toBe('local-tok');
    expect(sessionStorage.getItem('token')).toBeNull();
  });

  it('loadTokenFromStorage prefers sessionStorage', () => {
    sessionStorage.setItem('token', 'sess');
    localStorage.setItem('token', 'local');
    service.loadTokenFromStorage();
    expect(service.getToken()).toBe('sess');
  });

  it('loadTokenFromStorage falls back to localStorage', () => {
    localStorage.setItem('token', 'from-local');
    service.loadTokenFromStorage();
    expect(service.getToken()).toBe('from-local');
  });

  // ── Role management ───────────────────────────────────────────────────────

  it('setRole/getRole round-trips the role', () => {
    sessionStorage.setItem('token', 'tok');
    service.setRole('admin');
    expect(service.getRole()).toBe('admin');
  });

  it('setRole clears storage when role is empty', () => {
    service.setRole('admin');
    service.setRole('');
    expect(localStorage.getItem('role')).toBeNull();
    expect(sessionStorage.getItem('role')).toBeNull();
  });

  // ── HTTP calls include auth header ────────────────────────────────────────

  it('getMe sends Authorization header when token is set', () => {
    service.setToken('test-token');
    service.getMe().subscribe();
    const req = http.expectOne((r) => r.url.includes('/api/auth/me'));
    expect(req.request.headers.get('authorization')).toBe('Bearer test-token');
    req.flush({ id: 'u1', role: 'admin' });
  });

  it('login posts credentials without auth header', () => {
    service.login('user@local', 'pass').subscribe();
    const req = http.expectOne((r) => r.url.includes('/api/auth/login'));
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ username: 'user@local', password: 'pass' });
    req.flush({ token: 't1', role: 'physician' });
  });

  it('getPatients sends GET request with auth header', () => {
    service.setToken('tok');
    service.getPatients().subscribe();
    const req = http.expectOne((r) => r.url.includes('/api/patients'));
    expect(req.request.method).toBe('GET');
    expect(req.request.headers.get('authorization')).toBe('Bearer tok');
    req.flush([]);
  });

  it('createPatient sends POST with payload', () => {
    service.setToken('tok');
    const payload = { name: 'Test', ssn: '123', allergies: [] };
    service.createPatient(payload).subscribe();
    const req = http.expectOne((r) => r.url.includes('/api/patients'));
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual(payload);
    req.flush({ id: 'p1' });
  });

  it('createEncounter sends POST with payload', () => {
    service.setToken('tok');
    const payload = { patientId: 'p1', chiefComplaint: 'cough' };
    service.createEncounter(payload).subscribe();
    const req = http.expectOne((r) => r.url.includes('/api/encounters'));
    expect(req.request.method).toBe('POST');
    req.flush({ id: 'e1' });
  });

  it('signEncounter posts to correct path with version', () => {
    service.setToken('tok');
    service.signEncounter('enc-1', 3).subscribe();
    const req = http.expectOne((r) => r.url.includes('/api/encounters/enc-1/sign'));
    expect(req.request.body).toEqual({ expectedVersion: 3 });
    req.flush({ id: 'enc-1', state: 'signed' });
  });

  it('pharmacyAction posts to correct path', () => {
    service.setToken('tok');
    service.pharmacyAction('rx-1', { action: 'approve', expectedVersion: 1 }).subscribe();
    const req = http.expectOne((r) => r.url.includes('/api/pharmacy/rx-1/action'));
    expect(req.request.method).toBe('POST');
    req.flush({ state: 'approved' });
  });

  it('billPrice posts to billing/price', () => {
    service.setToken('tok');
    service.billPrice({ lines: [], planPercent: 0 }).subscribe();
    const req = http.expectOne((r) => r.url.includes('/api/billing/price'));
    expect(req.request.method).toBe('POST');
    req.flush({ total: 100 });
  });

  it('getInvoices issues GET /api/invoices', () => {
    service.setToken('tok');
    service.getInvoices().subscribe();
    const req = http.expectOne((r) => r.url.includes('/api/invoices'));
    expect(req.request.method).toBe('GET');
    req.flush([]);
  });

  it('payInvoice posts to /api/invoices/:id/payment', () => {
    service.setToken('tok');
    service.payInvoice('inv-1', { tenderType: 'cash' }).subscribe();
    const req = http.expectOne((r) => r.url.includes('/api/invoices/inv-1/payment'));
    expect(req.request.method).toBe('POST');
    req.flush({ state: 'paid' });
  });

  it('cancelInvoice posts to /api/invoices/:id/cancel', () => {
    service.setToken('tok');
    service.cancelInvoice('inv-1', {}).subscribe();
    const req = http.expectOne((r) => r.url.includes('/api/invoices/inv-1/cancel'));
    expect(req.request.method).toBe('POST');
    req.flush({ state: 'cancelled' });
  });

  it('getInventory issues GET /api/inventory/items', () => {
    service.setToken('tok');
    service.getInventory().subscribe();
    const req = http.expectOne((r) => r.url.includes('/api/inventory/items'));
    expect(req.request.method).toBe('GET');
    req.flush([]);
  });

  it('deleteUser sends DELETE with body', () => {
    service.setToken('tok');
    service.deleteUser('u1', 'test_reason').subscribe();
    const req = http.expectOne((r) => r.url.includes('/api/users/u1'));
    expect(req.request.method).toBe('DELETE');
    req.flush({});
  });

  it('unlockUser posts to /api/auth/unlock/:id', () => {
    service.setToken('tok');
    service.unlockUser('u1').subscribe();
    const req = http.expectOne((r) => r.url.includes('/api/auth/unlock/u1'));
    expect(req.request.method).toBe('POST');
    req.flush({});
  });

  it('getKpis issues GET /api/observability/kpis', () => {
    service.setToken('tok');
    service.getKpis().subscribe();
    const req = http.expectOne((r) => r.url.includes('/api/observability/kpis'));
    expect(req.request.method).toBe('GET');
    req.flush({ orderVolume: 10 });
  });

  it('runCrawler posts to /api/crawler/run', () => {
    service.setToken('tok');
    service.runCrawler({ sourceName: 'icd', priority: 1 }).subscribe();
    const req = http.expectOne((r) => r.url.includes('/api/crawler/run'));
    expect(req.request.method).toBe('POST');
    req.flush({ id: 'job-1' });
  });
});
