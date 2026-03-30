vi.mock('../src/db', () => ({ pool: { query: vi.fn() }, initDb: vi.fn() }));
vi.mock('../src/lib/audit', () => ({ writeAudit: vi.fn() }));
vi.mock('../src/services/security', () => ({ hashPassword: async (p) => `h:${p}` }));

const { pool } = require('../src/db');
const { writeAudit } = require('../src/lib/audit');
const { createUser, updateUser, deleteUser } = require('../src/services/users');

describe('users service audit correlation', () => {
  beforeEach(() => { pool.query = vi.fn(); writeAudit.mockClear(); });

  it('passes correlationId when creating user', async () => {
    pool.query.mockResolvedValueOnce({ rows: [{ id: 'u1', username: 'x', role: 'admin' }] });
    await createUser({ username: 'x', password: 'p', role: 'admin', clinicId: null, actorId: 'a1', actorRole: 'admin', correlationId: 'cid' });
    expect(writeAudit).toHaveBeenCalled();
    const args = writeAudit.mock.calls[0][0];
    expect(args.correlationId).toBe('cid');
  });

  it('passes correlationId on update and delete', async () => {
    pool.query.mockResolvedValueOnce({ rows: [{ id: 'u2', username: 'y', role: 'physician' }] });
    await updateUser('u2', { username: 'y', role: 'physician', clinicId: null, correlationId: 'ucid' }, 'a1', 'admin');
    expect(writeAudit).toHaveBeenCalled();
    const upArgs = writeAudit.mock.calls[0][0];
    expect(upArgs.correlationId).toBe('ucid');

    pool.query.mockResolvedValueOnce({ rows: [{ id: 'u2', username: 'y', role: 'physician' }] });
    pool.query.mockResolvedValueOnce({ rows: [{ id: 'u2', username: 'y', role: 'physician' }] });
    await deleteUser('u2', { confirmed: true, reason: 'rm', correlationId: 'dcid' }, 'a1', 'admin');
    const delArgs = writeAudit.mock.calls[writeAudit.mock.calls.length - 1][0];
    expect(delArgs.correlationId).toBe('dcid');
  });
});
