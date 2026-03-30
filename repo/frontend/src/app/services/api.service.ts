import { Injectable, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class ApiService {
  readonly syncState = signal<'online'|'offline'|'syncing'>('online');
  private token = signal<string>('');
  private role = signal<string>('');
  constructor(private http: HttpClient) {}
  setToken(token: string) { this.token.set(token); }
  getToken() { return this.token(); }
  setRole(role: string) { this.role.set(role); localStorage.setItem('role', role); }
  getRole() { return this.role() || (localStorage.getItem('role') || ''); }
  private authHeaders(): Record<string, string> {
    return this.token() ? { authorization: `Bearer ${this.token()}` } : {};
  }
  login(username: string, password: string): Observable<{ token: string; role: string }> {
    return this.http.post<{ token: string; role: string }>('/api/auth/login', { username, password });
  }
  register(username: string, password: string, role: string) {
    return this.http.post('/api/auth/register', { username, password, role });
  }
  getUsers() { return this.http.get('/api/users', { headers: this.authHeaders() }); }
  createUser(payload: { username: string; password: string; role: string }) {
    return this.http.post('/api/users', payload, { headers: this.authHeaders() });
  }
  updateUser(id: string, payload: unknown) { return this.http.put(`/api/users/${id}`, payload, { headers: this.authHeaders() }); }
  deleteUser(id: string) { return this.http.delete(`/api/users/${id}`, { headers: this.authHeaders() }); }
  getKpis() { return this.http.get('/api/observability/kpis'); }
  searchIcd(q: string) { return this.http.get('/api/icd', { params: { q }, headers: this.authHeaders() }); }
  getPharmacyQueue() { return this.http.get('/api/pharmacy/queue', { headers: this.authHeaders() }); }
  getShippingTemplates() { return this.http.get('/api/shipping/templates', { headers: this.authHeaders() }); }
  getSyncStatus() { return this.http.get('/api/sync/status', { headers: this.authHeaders() }); }
  enqueueSync(payload: unknown) { return this.http.post('/api/sync/enqueue', payload, { headers: this.authHeaders() }); }
  createPatient(payload: unknown) { return this.http.post('/api/patients', payload, { headers: this.authHeaders() }); }
  createEncounter(payload: unknown) { return this.http.post('/api/encounters', payload, { headers: this.authHeaders() }); }
  signEncounter(id: string, expectedVersion: number) {
    return this.http.post(`/api/encounters/${id}/sign`, { expectedVersion }, { headers: this.authHeaders() });
  }
  createPrescription(payload: unknown) { return this.http.post('/api/prescriptions', payload, { headers: this.authHeaders() }); }
  billPrice(payload: unknown) { return this.http.post('/api/billing/price', payload, { headers: this.authHeaders() }); }
  runCrawler(payload: unknown) { return this.http.post('/api/crawler/run', payload, { headers: this.authHeaders() }); }
  registerModel(payload: unknown) { return this.http.post('/api/models/register', payload, { headers: this.authHeaders() }); }
}
