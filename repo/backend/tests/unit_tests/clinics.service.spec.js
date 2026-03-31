vi.mock('../../src/db', () => ({ pool: { query: vi.fn() }, initDb: vi.fn() }));

const { pool } = require('../../src/db');
const audit = require('../../src/lib/audit');
audit.writeAudit = vi.fn();
const { createClinic, updateClinic, deleteClinic } = require('../../src/services/clinics');

describe('clinics service audit correlation', () => {
  beforeEach(() => { pool.query = vi.fn(); audit.writeAudit.mockClear(); });

  it('passes correlationId when creating clinic', async () => {
    pool.query.mockResolvedValueOnce({ rows: [{ id: 'c1', name: 'Clinic' }] });
    await createClinic({ name: 'Clinic', address: 'a', contactInfo: {}, type: 'clinical', actorId: 'a1', actorRole: 'admin', correlationId: 'ccid' });
    expect(audit.writeAudit).toHaveBeenCalled();
    const args = audit.writeAudit.mock.calls[0][0];
    expect(args.correlationId).toBe('ccid');
  });

  it('passes correlationId on update and delete', async () => {
    pool.query.mockResolvedValueOnce({ rows: [{ id: 'c2', name: 'Clinic2' }] });
    await updateClinic('c2', { name: 'Clinic2', address: 'a', contactInfo: {}, type: 'clinical', correlationId: 'ucid' }, 'a1', 'admin');
    const upArgs = audit.writeAudit.mock.calls[0][0];
    expect(upArgs.correlationId).toBe('ucid');

    pool.query.mockResolvedValueOnce({ rows: [{ id: 'c2', name: 'Clinic2' }] });
    pool.query.mockResolvedValueOnce({ rows: [{ id: 'c2', name: 'Clinic2' }] });
    await deleteClinic('c2', { reason: 'rm', confirmed: true, correlationId: 'dcid' }, 'a1', 'admin');
    const delArgs = audit.writeAudit.mock.calls[audit.writeAudit.mock.calls.length - 1][0];
    expect(delArgs.correlationId).toBe('dcid');
  });
});
