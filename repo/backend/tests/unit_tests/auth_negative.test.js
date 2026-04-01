vi.mock('../../src/db', () => ({ pool: { query: vi.fn() }, initDb: vi.fn() }));
const { pool } = require('../../src/db');
const { buildApp } = require('../../src/app');

describe('auth negative cases', () => {
  let app;
  beforeAll(async () => {
    process.env.NODE_ENV = 'test';
    app = await buildApp();
  });
  afterAll(async () => { try { await app.close(); } catch (e) {} });

  it('does not expose public registration endpoint', async () => {
    const res = await app.inject({ method: 'POST', url: '/api/auth/register', payload: { username: 'x', password: 'p' } });
    expect(res.statusCode).toBe(404);
  });

  it('forbids non-admin from creating admin user', async () => {
    // simulate jwt verify and DB responses for a non-admin user
    app.jwt = app.jwt || {};
    app.jwt.verify = async () => ({ sub: 'user-1', jti: 'jti-1' });
    pool.query = vi.fn().mockImplementation(async (sql, params) => {
      console.log('SQL_CALL:', String(sql || ''));
      const s = String(sql || '').toLowerCase();
      if (s.includes('from users')) return { rows: [{ id: 'user-1', username: 'doc@local', role: 'physician' }] };
      if (s.includes('from sessions')) return { rows: [{ id: 's1', user_id: 'user-1', revoked: false, last_active_at: new Date().toISOString() }] };
      return { rows: [] };
    });
    const res = await app.inject({ method: 'POST', url: '/api/admin/users', headers: { authorization: 'Bearer token' }, payload: { username: 'bad', password: 'pw', role: 'admin' } });
    expect([401, 403]).toContain(res.statusCode);
  });
});
