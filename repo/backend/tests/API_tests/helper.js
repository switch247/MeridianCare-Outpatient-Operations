const assert = require('assert');
const supertest = require('supertest');

const seedPassword = process.env.SEED_PASSWORD || 'Password!123';

const seededUsers = {
  physician: 'physician@local',
  pharmacist: 'pharmacist@local',
  billing: 'billing@local',
  inventory: 'inventory@local',
  admin: 'admin@local',
  auditor: 'auditor@local',
};

async function createApiContext() {
  process.env.NODE_ENV = 'test';
  if (!process.env.JWT_SECRET) process.env.JWT_SECRET = 'meridian-local-jwt-secret';
  if (!process.env.PHI_KEY) process.env.PHI_KEY = 'meridian-local-phi-key';
  if (!process.env.DATABASE_URL) {
    process.env.DATABASE_URL = 'postgres://postgres:postgres@localhost:5432/meridiancare-clinic';
  }
  if (!process.env.PORT) process.env.PORT = '13000';

  const { buildApp } = require('../../src/app');
  const { run: seedRun } = require('../../src/db/seed');
  const app = await buildApp();
  await app.ready();
  await seedRun();
  const api = supertest(app.server);
  return { app, api };
}

async function loginAs(api, role) {
  const username = seededUsers[role];
  assert.ok(username, `Unknown seeded role: ${role}`);
  const res = await api.post('/api/auth/login').send({ username, password: seedPassword });
  assert.equal(res.status, 200, `${role} login should succeed`);
  assert.ok(res.body && res.body.token, `${role} login should return token`);
  return { token: res.body.token, user: res.body.user || null };
}

function withToken(api, token) {
  return {
    get: (path) => api.get(path).set('authorization', `Bearer ${token}`),
    post: (path) => api.post(path).set('authorization', `Bearer ${token}`),
    put: (path) => api.put(path).set('authorization', `Bearer ${token}`),
    patch: (path) => api.patch(path).set('authorization', `Bearer ${token}`),
    delete: (path) => api.delete(path).set('authorization', `Bearer ${token}`),
  };
}

async function bootstrapAuth(api) {
  const sessions = {};
  for (const role of Object.keys(seededUsers)) {
    sessions[role] = await loginAs(api, role);
  }
  return sessions;
}

module.exports = {
  createApiContext,
  loginAs,
  withToken,
  bootstrapAuth,
};
