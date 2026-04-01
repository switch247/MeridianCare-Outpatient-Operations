const { pool } = require('../db');
const { verifyPassword } = require('../services/security');
const { env } = require('../config');
const { v4: uuidv4 } = require('uuid');
const logger = require('../lib/logger');

async function authRoutes(fastify, opts) {
  fastify.post('/api/auth/login', async (request, reply) => {
    logger.info(['handler','auth:login'], `login attempt for ${request.body && request.body.username}`);
    const { username, password } = request.body || {};
    const userRes = await pool.query('SELECT * FROM users WHERE username=$1', [username]);
    const user = userRes.rows[0];
    if (!user) { logger.warn(['handler','auth:login','fail'], `unknown user ${username}`); return reply.code(401).send({ code: 401, msg: 'Invalid credentials' }); }
    const { isLocked } = require('../services/security');
    if (isLocked(user.lockout_until)) return reply.code(423).send({ code: 423, msg: 'Account locked' });
    const ok = await verifyPassword(password, user.password_hash);
    if (!ok) {
      const failed = Number(user.failed_attempts || 0) + 1;
      const lockout = failed >= 5 ? new Date(Date.now() + 15 * 60 * 1000) : null;
      await pool.query('UPDATE users SET failed_attempts=$1, lockout_until=$2 WHERE id=$3', [failed >= 5 ? 0 : failed, lockout, user.id]);
      logger.warn(['handler','auth:login','fail'], `bad password for ${username}`);
      return reply.code(401).send({ code: 401, msg: 'Invalid credentials' });
    }
    await pool.query('UPDATE users SET failed_attempts=0, lockout_until=NULL, last_active_at=NOW() WHERE id=$1', [user.id]);
    const body = request.body || {};
    const kiosk = !!body.kiosk;
    const jti = uuidv4();
    const ttlMin = kiosk ? env.KIOSK_TOKEN_TTL_MIN : env.TOKEN_TTL_MIN;
    const expiresAt = new Date(Date.now() + ttlMin * 60 * 1000).toISOString();
    await pool.query('INSERT INTO sessions(user_id,jti,kiosk,revoked,last_active_at,expires_at) VALUES($1,$2,$3,$4,NOW(),$5)', [user.id, jti, kiosk, false, expiresAt]);
    logger.info(['handler','auth:login','success'], `user=${username} jti=${jti} kiosk=${kiosk}`);
    const token = await reply.jwtSign({ sub: user.id, role: user.role, kiosk }, { jwtid: jti, expiresIn: `${ttlMin}m` });
    // return safe user info along with token
    const safeUser = { id: user.id, username: user.username, role: user.role, clinic_id: user.clinic_id || null };
    return { token, role: user.role, user: safeUser };
    });
  
    // Public route that will authenticate the token inside the handler so it works even when caller
    // uses a plain GET and CORS preflight; this avoids reliance on preHandler wiring in some clients.
    fastify.get('/api/auth/me', async (request, reply) => {
      try {
        // attempt to authenticate using the app-level auth decorator
        if (typeof fastify.auth === 'function') await fastify.auth(request, reply);
        const u = request.user;
        if (!u || !u.id) return reply.code(401).send({ code: 401, msg: 'Not authenticated' });
        const r = await pool.query('SELECT id,username,role,clinic_id FROM users WHERE id=$1', [u.id]);
        const user = r.rows[0] || null;
        return user;
      } catch (e) {
        logger.warn(['handler','auth:me','unauthorized'], e.message);
        return reply.code(401).send({ code: 401, msg: 'Unauthorized' });
      }
    });

  fastify.post('/api/auth/logout', async (request, reply) => {
    logger.info(['handler','auth:logout'], `logout request`);
    try {
      const token = (request.headers.authorization || '').replace('Bearer ', '') || request.cookies.session;
      if (!token) return reply.code(400).send({ code: 400, msg: 'Missing token' });
      const decoded = fastify.jwt.decode(token) || {};
      const jti = decoded.jti || decoded.jwd || null;
      if (!jti) return reply.code(400).send({ code: 400, msg: 'Invalid token' });
      await pool.query('UPDATE sessions SET revoked=true WHERE jti=$1', [jti]);
      logger.info(['handler','auth:logout','revoked'], `jti=${jti}`);
      return { ok: true };
    } catch (e) { logger.error(['handler','auth:logout','error'], e.message); return reply.code(500).send({ code:500, msg:'Internal server error' }); }
  });

  fastify.get('/api/auth/sessions', { preHandler: [opts.permit('*')] }, async (request) => {
    logger.info(['handler','auth:sessions','list'], `sessions list requested by ${request.user && request.user.username}`);
    const rows = (await pool.query('SELECT id,user_id,jti,kiosk,revoked,last_active_at,expires_at,created_at FROM sessions ORDER BY created_at DESC LIMIT 100')).rows;
    return rows;
  });

  fastify.post('/api/auth/unlock/:id', { preHandler: [opts.permit('admin:unlock')] }, async (request, reply) => {
    const userId = request.params.id;
    const result = await pool.query(
      'UPDATE users SET failed_attempts=0, lockout_until=NULL WHERE id=$1 RETURNING id,username,role',
      [userId],
    );
    if (!result.rows[0]) return reply.code(404).send({ code: 404, msg: 'User not found' });
    logger.info(['handler','auth:unlock'], `account unlocked id=${userId} by ${request.user && request.user.username}`);
    return { ok: true, user: result.rows[0] };
  });
}

module.exports = authRoutes;
