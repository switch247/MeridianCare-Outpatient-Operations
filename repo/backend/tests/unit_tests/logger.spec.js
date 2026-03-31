describe('logger sanitize', () => {
  let logger;
  beforeEach(() => {
    // ensure fresh module load
    delete require.cache[require.resolve('../../src/lib/logger')];
    logger = require('../../src/lib/logger');
  });

  afterEach(() => {
    // clear module cache so tests are isolated
    try { delete require.cache[require.resolve('../../src/lib/logger')]; } catch (e) {}
  });

  it('sanitizes sensitive keys in objects', () => {
    const input = { username: 'alice', password: 'secret', nested: { ssn: '123-45-6789', note: 'ok' }, token: 'abcd' };
    const out = logger.sanitize(input);
    expect(out.username).toBe('alice');
    expect(out.password).toBe('***REDACTED***');
    expect(out.token).toBe('***REDACTED***');
    expect(out.nested.note).toBe('ok');
    expect(out.nested.ssn).toBe('***REDACTED***');
  });

  it('passes sanitized meta to pino.info', () => {
    const mod = require('../../src/lib/logger');
    const spy = vi.spyOn(mod.pino, 'info').mockImplementation(() => {});
    const meta = { username: 'bob', password: 'p', secret: 's', details: { ssn_encrypted: 'x' } };
    mod.info(['test','unit'], 'message here', meta);
    expect(spy).toHaveBeenCalled();
    const callArg = spy.mock.calls[0][0];
    expect(callArg.meta.password).toBe('***REDACTED***');
    expect(callArg.meta.secret).toBe('***REDACTED***');
    expect(callArg.meta.details.ssn_encrypted).toBe('***REDACTED***');
    spy.mockRestore();
  });

  it('plugin registers hooks and sets X-Request-Id', async () => {
    const mod = require('../../src/lib/logger');
    const hooks = {};
    const mockFastify = { decorate: vi.fn(), addHook: (name, fn) => { hooks[name] = fn; } };
    await mod.plugin(mockFastify, {});
    expect(typeof hooks.onRequest).toBe('function');
    expect(typeof hooks.onResponse).toBe('function');

    const spy = vi.spyOn(mod.pino, 'info').mockImplementation(() => {});
    const req = { raw: { url: '/x' }, method: 'GET', socket: { remoteAddress: '1.2.3.4' } };
    const res = { header: vi.fn(), statusCode: 200 };
    await hooks.onRequest(req, res);
    expect(req.requestId).toBeTruthy();
    expect(res.header).toHaveBeenCalledWith('X-Request-Id', req.requestId);
    // simulate response hook
    await hooks.onResponse(req, res);
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });
});
