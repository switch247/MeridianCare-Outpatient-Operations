vi.mock('../../src/db', () => ({ pool: { query: vi.fn() }, initDb: vi.fn() }));
vi.mock('../../src/services/security', () => ({ hashPassword: async (p) => `h:${p}` }));

const { pool } = require('../../src/db');
const audit = require('../../src/lib/audit');
audit.writeAudit = vi.fn();
const { createUser, updateUser, deleteUser } = require('../../src/services/users');

describe('users service audit correlation', () => {
  beforeEach(() => { pool.query = vi.fn(); audit.writeAudit.mockClear(); });

  it('passes correlationId when creating user', async () => {
    pool.query.mockResolvedValueOnce({ rows: [{ id: 'u1', username: 'x', role: 'admin' }] });
    await createUser({ username: 'x', password: 'StrongPass123', role: 'admin', clinicId: null, actorId: 'a1', actorRole: 'admin', correlationId: 'cid' });
    expect(audit.writeAudit).toHaveBeenCalled();
    const args = audit.writeAudit.mock.calls[0][0];
    expect(args.correlationId).toBe('cid');
  });

  it('passes correlationId on update and delete', async () => {
    pool.query.mockResolvedValueOnce({ rows: [{ id: 'u2', username: 'y', role: 'physician' }] });
    await updateUser('u2', { username: 'y', role: 'physician', clinicId: null, correlationId: 'ucid' }, 'a1', 'admin');
    const upArgs = audit.writeAudit.mock.calls[0][0];
    expect(upArgs.correlationId).toBe('ucid');

    pool.query.mockResolvedValueOnce({ rows: [{ id: 'u2', username: 'y', role: 'physician' }] });
    pool.query.mockResolvedValueOnce({ rows: [{ id: 'u2', username: 'y', role: 'physician' }] });
    await deleteUser('u2', { confirmed: true, reason: 'rm', correlationId: 'dcid' }, 'a1', 'admin');
    const delArgs = audit.writeAudit.mock.calls[audit.writeAudit.mock.calls.length - 1][0];
    expect(delArgs.correlationId).toBe('dcid');
  });
});
