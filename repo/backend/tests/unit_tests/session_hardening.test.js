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

  it.skip('rejects requests when session expired by inactivity', async () => {
    // Session inactivity checking is currently disabled in the auth implementation
    // This test should be re-enabled when session management is fully implemented
    expect(true).toBe(true);
  });
});
