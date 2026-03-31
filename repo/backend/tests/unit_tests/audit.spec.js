// verify writeAudit persists correlation id into event_data
vi.mock('../../src/db', () => ({ pool: { query: vi.fn() }, initDb: vi.fn() }));

const { pool } = require('../../src/db');
const { writeAudit } = require('../../src/lib/audit');

describe('audit writeCorrelation', () => {
  beforeEach(() => { pool.query = vi.fn().mockResolvedValue({}); });

  it('stores _correlationId in event_data when provided', async () => {
    const cid = 'test-cid-123';
    await writeAudit({ entityType: 'patient', entityId: 'p1', action: 'create', actorId: 'u1', actorRole: 'physician', eventData: { foo: 'bar' }, snapshot: { id: 'p1' }, correlationId: cid });
    expect(pool.query).toHaveBeenCalled();
    const params = pool.query.mock.calls[0][1];
    // event_data is the 6th parameter (index 5) and is a JSON string
    const eventDataJson = params[5];
    const parsed = JSON.parse(eventDataJson);
    expect(parsed._correlationId).toBe(cid);
    expect(parsed.foo).toBe('bar');
  });
});
