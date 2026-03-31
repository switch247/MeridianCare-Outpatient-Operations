import { Injectable, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class ApiService {
  readonly syncState = signal<'online'|'offline'|'syncing'>('online');
  private token = signal<string>('');
  private role = signal<string>('');
  private baseUrl = '';
  constructor(private http: HttpClient) {
    const win = (window as any) || {};
    this.baseUrl = (win.__env && win.__env.API_BASE_URL) || win.API_BASE_URL || 'http://localhost:13000';
    if (this.baseUrl && this.baseUrl.endsWith('/')) this.baseUrl = this.baseUrl.slice(0, -1);
  }
  setToken(token: string) { this.token.set(token); }
  getToken() { return this.token(); }
  setRole(role: string) { this.role.set(role); localStorage.setItem('role', role); }
  getRole() { return this.role() || (localStorage.getItem('role') || ''); }
  persistToken(token: string, remember = false) {
    this.token.set(token);
    if (remember) localStorage.setItem('token', token);
  }
  loadTokenFromStorage() {
    const t = localStorage.getItem('token');
    if (t) this.token.set(t);
  }
  private authHeaders(): Record<string, string> {
    return this.token() ? { authorization: `Bearer ${this.token()}` } : {};
  }
  private url(path: string) { return `${this.baseUrl}${path}`; }
  login(username: string, password: string): Observable<{ token: string; role: string; user?: any }> {
    return this.http.post<{ token: string; role: string; user?: any }>(this.url('/api/auth/login'), { username, password });
  }
  getMe() { return this.http.get(this.url('/api/auth/me'), { headers: this.authHeaders() }); }
  register(username: string, password: string) {
    return this.http.post(this.url('/api/auth/register'), { username, password });
  }
  getUsers() { return this.http.get(this.url('/api/users'), { headers: this.authHeaders() }); }
  getClinic() { return this.http.get(this.url('/api/clinics'), { headers: this.authHeaders() }); }
  updateClinic(id: string, payload: unknown) { return this.http.put(this.url(`/api/clinics/${id}`), payload, { headers: this.authHeaders() }); }
  createUser(payload: { username: string; password: string; role: string }) {
    return this.http.post(this.url('/api/users'), payload, { headers: this.authHeaders() });
  }
  updateUser(id: string, payload: unknown) { return this.http.put(this.url(`/api/users/${id}`), payload, { headers: this.authHeaders() }); }
  deleteUser(id: string, reason = 'admin_delete') {
    return this.http.delete(this.url(`/api/users/${id}`), { headers: this.authHeaders(), body: { confirmed: true, reason } });
  }
  unlockUser(id: string) { return this.http.post(this.url(`/api/auth/unlock/${id}`), {}, { headers: this.authHeaders() }); }
  getCredentialingProfiles() { return this.http.get(this.url('/api/credentialing'), { headers: this.authHeaders() }); }
  onboardCredentialing(payload: unknown) { return this.http.post(this.url('/api/credentialing/onboard'), payload, { headers: this.authHeaders() }); }
  importCredentialing(rows: unknown[], mapping: Record<string, string> = {}) { return this.http.post(this.url('/api/credentialing/import'), { rows, mapping }, { headers: this.authHeaders() }); }
  exportCredentialing() { return this.http.get(this.url('/api/credentialing/export'), { headers: this.authHeaders() }); }
  getOrganizations() { return this.http.get(this.url('/api/organizations'), { headers: this.authHeaders() }); }
  createOrganization(payload: unknown) { return this.http.post(this.url('/api/organizations'), payload, { headers: this.authHeaders() }); }
  updateOrganization(id: string, payload: unknown) { return this.http.put(this.url(`/api/organizations/${id}`), payload, { headers: this.authHeaders() }); }
  deleteOrganization(id: string) { return this.http.delete(this.url(`/api/organizations/${id}`), { headers: this.authHeaders() }); }
  getKpis() { return this.http.get(this.url('/api/observability/kpis')); }
  getOverview() { return this.http.get(this.url('/api/overview'), { headers: this.authHeaders() }); }
  searchIcd(q: string) { return this.http.get(this.url('/api/icd'), { params: { q }, headers: this.authHeaders() }); }
  getPharmacyQueue() { return this.http.get(this.url('/api/pharmacy/queue'), { headers: this.authHeaders() }); }
  pharmacyAction(id: string, payload: unknown) { return this.http.post(this.url(`/api/pharmacy/${id}/action`), payload, { headers: this.authHeaders() }); }
  getPharmacyMovements(id: string) { return this.http.get(this.url(`/api/pharmacy/${id}/movements`), { headers: this.authHeaders() }); }
  createPharmacyReturn(id: string, payload: unknown) { return this.http.post(this.url(`/api/pharmacy/${id}/return`), payload, { headers: this.authHeaders() }); }
  getShippingTemplates() { return this.http.get(this.url('/api/shipping/templates'), { headers: this.authHeaders() }); }
  getSyncStatus() { return this.http.get(this.url('/api/sync/status'), { headers: this.authHeaders() }); }
  enqueueSync(payload: unknown) { return this.http.post(this.url('/api/sync/enqueue'), payload, { headers: this.authHeaders() }); }
  createPatient(payload: unknown) { return this.http.post(this.url('/api/patients'), payload, { headers: this.authHeaders() }); }
  getPatients() { return this.http.get(this.url('/api/patients'), { headers: this.authHeaders() }); }
  createEncounter(payload: unknown) { return this.http.post(this.url('/api/encounters'), payload, { headers: this.authHeaders() }); }
  getEncounters(patientId?: string) {
    const params: any = {};
    if (patientId) params.patientId = patientId;
    return this.http.get(this.url('/api/encounters'), { headers: this.authHeaders(), params });
  }
  signEncounter(id: string, expectedVersion: number) {
    return this.http.post(this.url(`/api/encounters/${id}/sign`), { expectedVersion }, { headers: this.authHeaders() });
  }
  createPrescription(payload: unknown) { return this.http.post(this.url('/api/prescriptions'), payload, { headers: this.authHeaders() }); }
  billPrice(payload: unknown) { return this.http.post(this.url('/api/billing/price'), payload, { headers: this.authHeaders() }); }
  runCrawler(payload: unknown) { return this.http.post(this.url('/api/crawler/run'), payload, { headers: this.authHeaders() }); }
  registerModel(payload: unknown) { return this.http.post(this.url('/api/models/register'), payload, { headers: this.authHeaders() }); }
  // Inventory & Invoices (simple placeholders)
  getInventory() { return this.http.get(this.url('/api/inventory/items'), { headers: this.authHeaders() }); }
  createInventoryItem(payload: unknown) { return this.http.post(this.url('/api/inventory/items'), payload, { headers: this.authHeaders() }); }
  createInventoryMovement(payload: unknown) { return this.http.post(this.url('/api/inventory/movements'), payload, { headers: this.authHeaders() }); }
  getLowStockAlerts() { return this.http.get(this.url('/api/inventory/alerts/low-stock'), { headers: this.authHeaders() }); }
  getInventoryVariance() { return this.http.get(this.url('/api/inventory/reports/variance'), { headers: this.authHeaders() }); }

  getInvoices() { return this.http.get(this.url('/api/invoices'), { headers: this.authHeaders() }); }
  getInvoice(id: string) { return this.http.get(this.url(`/api/invoices/${id}`), { headers: this.authHeaders() }); }
  createInvoice(payload: unknown) { return this.http.post(this.url('/api/invoices'), payload, { headers: this.authHeaders() }); }
  payInvoice(id: string, payload: unknown) { return this.http.post(this.url(`/api/invoices/${id}/payment`), payload, { headers: this.authHeaders() }); }
  cancelInvoice(id: string, payload: unknown) { return this.http.post(this.url(`/api/invoices/${id}/cancel`), payload, { headers: this.authHeaders() }); }

  getCrawlerQueue(params?: any) { return this.http.get(this.url('/api/crawler/queue'), { headers: this.authHeaders(), params }); }
  processCrawlerNext(payload: unknown) { return this.http.post(this.url('/api/crawler/process-next'), payload, { headers: this.authHeaders() }); }
  getModelDrift() { return this.http.get(this.url('/api/models/drift'), { headers: this.authHeaders() }); }
  getForecasts() { return this.http.get(this.url('/api/admin/forecasts'), { headers: this.authHeaders() }); }
  getRecommendations() { return this.http.get(this.url('/api/admin/recommendations'), { headers: this.authHeaders() }); }
  getExceptions(params?: any) { return this.http.get(this.url('/api/observability/exceptions'), { headers: this.authHeaders(), params }); }
  createException(payload: unknown) { return this.http.post(this.url('/api/observability/exceptions'), payload, { headers: this.authHeaders() }); }
  runNightlyBackup(payload: unknown = {}) { return this.http.post(this.url('/api/admin/backups/nightly'), payload, { headers: this.authHeaders() }); }
  getNightlyBackups() { return this.http.get(this.url('/api/admin/backups/nightly'), { headers: this.authHeaders() }); }
  createRestoreDrill(payload: unknown) { return this.http.post(this.url('/api/admin/backups/restore-drill'), payload, { headers: this.authHeaders() }); }
  getRestoreDrills() { return this.http.get(this.url('/api/admin/backups/restore-drill'), { headers: this.authHeaders() }); }
}
