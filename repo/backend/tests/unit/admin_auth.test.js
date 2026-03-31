vi.mock('../../src/db', () => ({ pool: { query: vi.fn() }, initDb: vi.fn() }));

const { buildApp } = require('../../src/app');

describe('admin routes auth', () => {
  let app;
  beforeAll(async () => {
    process.env.NODE_ENV = 'test';
    app = await buildApp();
  });
  afterAll(async () => {
    try { await app.close(); } catch (e) {}
  });

  it('blocks POST /api/admin/users when unauthenticated', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/admin/users',
      payload: { username: 'badactor', password: 'pw', role: 'admin' },
    });
    expect(res.statusCode).toBe(401);
  });
});
