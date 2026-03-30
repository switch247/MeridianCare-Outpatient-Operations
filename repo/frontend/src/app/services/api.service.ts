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
  register(username: string, password: string, role: string) {
    return this.http.post(this.url('/api/auth/register'), { username, password, role });
  }
  getUsers() { return this.http.get(this.url('/api/users'), { headers: this.authHeaders() }); }
  createUser(payload: { username: string; password: string; role: string }) {
    return this.http.post(this.url('/api/users'), payload, { headers: this.authHeaders() });
  }
  updateUser(id: string, payload: unknown) { return this.http.put(this.url(`/api/users/${id}`), payload, { headers: this.authHeaders() }); }
  deleteUser(id: string) { return this.http.delete(this.url(`/api/users/${id}`), { headers: this.authHeaders() }); }
  getKpis() { return this.http.get(this.url('/api/observability/kpis')); }
  searchIcd(q: string) { return this.http.get(this.url('/api/icd'), { params: { q }, headers: this.authHeaders() }); }
  getPharmacyQueue() { return this.http.get(this.url('/api/pharmacy/queue'), { headers: this.authHeaders() }); }
  getShippingTemplates() { return this.http.get(this.url('/api/shipping/templates'), { headers: this.authHeaders() }); }
  getSyncStatus() { return this.http.get(this.url('/api/sync/status'), { headers: this.authHeaders() }); }
  enqueueSync(payload: unknown) { return this.http.post(this.url('/api/sync/enqueue'), payload, { headers: this.authHeaders() }); }
  createPatient(payload: unknown) { return this.http.post(this.url('/api/patients'), payload, { headers: this.authHeaders() }); }
  createEncounter(payload: unknown) { return this.http.post(this.url('/api/encounters'), payload, { headers: this.authHeaders() }); }
  signEncounter(id: string, expectedVersion: number) {
    return this.http.post(this.url(`/api/encounters/${id}/sign`), { expectedVersion }, { headers: this.authHeaders() });
  }
  createPrescription(payload: unknown) { return this.http.post(this.url('/api/prescriptions'), payload, { headers: this.authHeaders() }); }
  billPrice(payload: unknown) { return this.http.post(this.url('/api/billing/price'), payload, { headers: this.authHeaders() }); }
  runCrawler(payload: unknown) { return this.http.post(this.url('/api/crawler/run'), payload, { headers: this.authHeaders() }); }
  registerModel(payload: unknown) { return this.http.post(this.url('/api/models/register'), payload, { headers: this.authHeaders() }); }
}
