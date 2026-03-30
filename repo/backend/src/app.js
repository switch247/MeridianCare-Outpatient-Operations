const Fastify = require('fastify');
const cors = require('@fastify/cors');
const cookie = require('@fastify/cookie');
const jwt = require('@fastify/jwt');
const { env } = require('./config');
const { pool, initDb } = require('./db');
const { encrypt } = require('./utils/crypto');
const { hashPassword, verifyPassword, isLocked } = require('./services/security');
const { applyDiscounts } = require('./services/discounts');
const { writeAudit } = require('./lib/audit');
const { can } = require('./lib/rbac');

async function buildApp() {
  const { pino, plugin: loggerPlugin } = require('./lib/logger');
  const app = Fastify({ logger: false });
  // attach our pino logger instance so code can use `app.log`
  try { app.log = pino; } catch (e) { /* ignore if immutable */ }
  await app.register(cors, { origin: true, credentials: true });
  await app.register(cookie);
  await app.register(jwt, { secret: env.JWT_SECRET });

  // register our request/response logger plugin
  await app.register(loggerPlugin);

  app.decorate('auth', async (request, reply) => {
    try {
      const token = (request.headers.authorization || '').replace('Bearer ', '') || request.cookies.session;
      if (!token) return reply.code(401).send({ code: 401, msg: 'Unauthorized' });
      const payload = await request.jwtVerify({ token });
      const decoded = app.jwt.decode(token) || {};
      const jti = decoded.jti || decoded.jwd || null;
      const userRes = await pool.query('SELECT * FROM users WHERE id=$1', [payload.sub]);
      const user = userRes.rows[0];
      if (!user) return reply.code(401).send({ code: 401, msg: 'Unauthorized' });

      if (!jti) return reply.code(401).send({ code: 401, msg: 'Unauthorized' });
      const sessRes = await pool.query('SELECT * FROM sessions WHERE jti=$1', [jti]);
      const session = sessRes.rows[0];
      if (!session || session.revoked) return reply.code(401).send({ code: 401, msg: 'Session revoked or not found' });
      if (session.expires_at && new Date(session.expires_at) < new Date()) return reply.code(401).send({ code: 401, msg: 'Token expired' });

      const inactivityMin = session.kiosk ? env.KIOSK_INACTIVITY_MIN : env.INACTIVITY_MIN;
      const { isSessionExpiredByInactivity } = require('./services/security');
      if (isSessionExpiredByInactivity(session.last_active_at, inactivityMin)) return reply.code(401).send({ code: 401, msg: 'Session expired' });

      await pool.query('UPDATE sessions SET last_active_at=NOW() WHERE id=$1', [session.id]);
      await pool.query('UPDATE users SET last_active_at=NOW() WHERE id=$1', [user.id]);
      request.user = user;
      request.session = session;
    } catch (e) {
      return reply.code(401).send({ code: 401, msg: 'Unauthorized' });
    }
  });

  const permit = (permission) => async (request, reply) => {
    await app.auth(request, reply);
    if (!request.user) return;
    if (!can(request.user.role, permission)) {
      return reply.code(403).send({ code: 403, msg: 'Forbidden' });
    }
  };

  app.get('/health', async () => ({ ok: true }));

  // register clinics routes separately (clean architecture)
  
  // register modular routes
  const clinicsRoutes = require('./routes/clinics');
  const authRoutes = require('./routes/auth');
  const patientsRoutes = require('./routes/patients');
  const encountersRoutes = require('./routes/encounters');
  const prescriptionsRoutes = require('./routes/prescriptions');
  const billingRoutes = require('./routes/billing');
  const credentialingRoutes = require('./routes/credentialing');
  const adminRoutes = require('./routes/admin');
  const syncAuditRoutes = require('./routes/sync_audit');
  const inventoryRoutes = require('./routes/inventory');
  const usersRoutes = require('./routes/users');
  
  
  await app.register(authRoutes, { permit });
  await app.register(clinicsRoutes, { permit });
  await app.register(patientsRoutes, { permit });
  await app.register(encountersRoutes, { permit });
  await app.register(prescriptionsRoutes, { permit });
  await app.register(billingRoutes, { permit });
  await app.register(inventoryRoutes, { permit });
  await app.register(usersRoutes, { permit });
  await app.register(credentialingRoutes, { permit });
  await app.register(adminRoutes, { permit });
  await app.register(syncAuditRoutes, { permit });
  
  app.setErrorHandler((error, request, reply) => { request.log.error(error); reply.code(500).send({ code:500, msg:'Internal server error' }); });

  await initDb();
  return app;
}

module.exports = { buildApp };
