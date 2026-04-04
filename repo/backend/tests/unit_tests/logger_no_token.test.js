const { buildApp } = require('../../src/app');

describe('auth logging sanitization', () => {
  let app;

  beforeAll(async () => {
    process.env.NODE_ENV = 'test';
    app = await buildApp();
  });

  afterAll(async () => {
    try { await app.close(); } catch (e) {}
  });

  it('does not log token fragments on auth verification failure', async () => {
    const token = 'very-sensitive-token-fragment-abc123';
    const errSpy = vi.spyOn(app.log, 'error').mockImplementation(() => {});

    const res = await app.inject({
      method: 'GET',
      url: '/api/auth/me',
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res.statusCode).toBe(401);
    expect(errSpy).toHaveBeenCalled();

    const serializedCalls = JSON.stringify(errSpy.mock.calls);
    expect(serializedCalls).not.toContain(token);
    expect(serializedCalls).not.toContain('tokenPreview');
    expect(serializedCalls).not.toContain('authorization');

    errSpy.mockRestore();
  });
});
