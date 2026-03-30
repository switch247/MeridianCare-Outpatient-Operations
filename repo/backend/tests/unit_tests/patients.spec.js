const Fastify = require('fastify');

// mock db and crypto
vi.mock('../src/db', () => ({ pool: { query: vi.fn() }, initDb: vi.fn() }));
vi.mock('../src/utils/crypto', () => ({ encrypt: (s) => `enc:${s}` }));

const { pool } = require('../src/db');

describe('patients routes', () => {
  let app;
  beforeEach(async () => {
    // reset/mock pool.query
    pool.query = vi.fn();
    app = Fastify({ logger: false });
    const patientsRoutes = require('../src/routes/patients');
    // permit that allows through
    await app.register(patientsRoutes, { permit: (p) => async (req, reply) => {} });
    await app.ready();
  });

  afterEach(async () => { if (app && typeof app.close === 'function') await app.close(); });

  it('lists patients and scrubs PHI', async () => {
    pool.query.mockResolvedValueOnce({ rows: [{ id: '1', name: 'Alice', ssn_encrypted: 'x', allergies: '[]', contraindications: '[]' }] });
    const res = await app.inject({ method: 'GET', url: '/api/patients' });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(Array.isArray(body)).toBe(true);
    expect(body[0].name).toBe('Alice');
    expect(body[0].has_ssn).toBe(true);
    expect(body[0].ssn_encrypted).toBeUndefined();
  });

  it('creates a patient', async () => {
    const created = { id: 'p1', name: 'Bob', ssn_encrypted: 'enc:123', allergies: '[]', contraindications: '[]' };
    pool.query.mockResolvedValueOnce({ rows: [created] });
    const res = await app.inject({ method: 'POST', url: '/api/patients', payload: { name: 'Bob', ssn: '123' } });
    expect(res.statusCode).toBe(201);
    const body = JSON.parse(res.payload);
    expect(body.id).toBe('p1');
    expect(body.has_ssn).toBe(true);
  });

  it('updates a patient', async () => {
    // first call is the update query returning the updated row
    const updated = { id: 'p2', name: 'Charlie', ssn_encrypted: 'enc:999', allergies: '[]', contraindications: '[]' };
    pool.query.mockResolvedValueOnce({ rows: [updated] });
    const res = await app.inject({ method: 'PUT', url: '/api/patients/p2', payload: { name: 'Charlie', ssn: '999' } });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(body.name).toBe('Charlie');
    expect(body.has_ssn).toBe(true);
  });

  it('deletes a patient', async () => {
    pool.query.mockResolvedValueOnce({ rows: [{ id: 'p3' }] });
    const res = await app.inject({ method: 'DELETE', url: '/api/patients/p3' });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(body.deleted).toBe(true);
  });
});
