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
    const userId = '11111111-1111-4111-8111-111111111111';
    const nowMinus21 = new Date(Date.now() - 21 * 60 * 1000).toISOString();
    const token = await app.jwt.sign({ sub: userId, role: 'physician' }, { jwtid: 'jti-expired', expiresIn: '30m' });

    pool.query = vi.fn().mockImplementation(async (sql) => {
      if (/SELECT \* FROM users WHERE id=\$1/.test(sql)) {
        return { rows: [{ id: userId, role: 'physician', clinic_id: 'clinic-1' }] };
      }
      if (/SELECT \* FROM sessions WHERE jti=\$1/.test(sql)) {
        return { rows: [{ id: 'sess-1', jti: 'jti-expired', user_id: userId, revoked: false, kiosk: false, last_active_at: nowMinus21, expires_at: null }] };
      }
      if (/UPDATE sessions SET revoked=true WHERE id=\$1/.test(sql)) {
        return { rows: [] };
      }
      return { rows: [] };
    });

    const res = await app.inject({
      method: 'GET',
      url: '/api/patients',
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res.statusCode).toBe(401);
  });
});
