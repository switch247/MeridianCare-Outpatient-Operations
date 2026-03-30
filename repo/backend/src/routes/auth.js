const { pool } = require('../db');
const { hashPassword, verifyPassword } = require('../services/security');
const { env } = require('../config');
const { v4: uuidv4 } = require('uuid');
const logger = require('../lib/logger');

async function authRoutes(fastify, opts) {
  fastify.post('/api/auth/register', async (request, reply) => {
    logger.info(['handler','auth:register'], `register request body keys=${Object.keys(request.body||{})}`);
    const { username, password, role } = request.body || {};
    try {
      const passwordHash = await hashPassword(password);
      const r = await pool.query('INSERT INTO users(username,password_hash,role,last_active_at) VALUES($1,$2,$3,NOW()) RETURNING id,username,role', [username, passwordHash, role]);
      reply.code(201);
      logger.info(['handler','auth:register','created'], `user=${r.rows[0].username}`);
      return r.rows[0];
    } catch (e) { logger.error(['handler','auth:register','error'], e.message); return reply.code(400).send({ code: 400, msg: e.message }); }
  });

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
    return { token, role: user.role };
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
}

module.exports = authRoutes;
