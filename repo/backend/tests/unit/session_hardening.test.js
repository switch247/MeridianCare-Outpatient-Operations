vi.mock('../../src/db', () => ({ pool: { query: vi.fn() }, initDb: vi.fn() }));
const { pool } = require('../../src/db');
const { buildApp } = require('../../src/app');

describe('session and auth hardening', () => {
  let app;
  beforeAll(async () => {
    process.env.NODE_ENV = 'test';
    app = await buildApp();
  });
  afterAll(async () => { try { await app.close(); } catch (e) {} });

  it('revokes session on logout', async () => {
    // make decode return a jti so logout can revoke
    app.jwt = app.jwt || {};
    app.jwt.decode = () => ({ jti: 'jti-logout' });
    pool.query = vi.fn().mockImplementation(async (sql, params) => {
      if (/UPDATE sessions SET revoked=true/.test(sql)) {
        return { rows: [{ id: params[0] || 'jti-logout' }] };
      }
      return { rows: [] };
    });

    const res = await app.inject({ method: 'POST', url: '/api/auth/logout', headers: { authorization: 'Bearer faketoken' } });
    expect(res.statusCode).toBe(200);
    // ensure we called update to revoke session
    const found = pool.query.mock.calls.find((c) => /UPDATE sessions SET revoked=true/.test(c[0]));
    expect(found).toBeTruthy();
  });

  it('rejects requests when session expired by inactivity', async () => {
    // prepare jwt.verify to return payload with sub
    app.jwt.verify = async () => ({ sub: 'user-1' });
    // mock DB responses: first call returns user, second returns fallback session with old last_active_at
    pool.query = vi.fn().mockImplementationOnce(async (sql) => ({ rows: [{ id: 'user-1', username: 'u', role: 'physician' }] }));
    const oldDate = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    pool.query.mockImplementationOnce(async (sql) => ({ rows: [{ id: 's-1', user_id: 'user-1', revoked: false, last_active_at: oldDate }] }));

    const res = await app.inject({ method: 'GET', url: '/api/patients', headers: { authorization: 'Bearer token' } });
    expect(res.statusCode).toBe(401);
  });
});
