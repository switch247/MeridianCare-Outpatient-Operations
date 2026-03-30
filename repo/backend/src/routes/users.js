async function usersRoutes(fastify, opts) {
  const { createUser, listUsers, getUser, updateUser, deleteUser } = require('../services/users');
  const logger = require('../lib/logger');

  fastify.post('/api/users', { preHandler: [opts.permit('user:write')] }, async (request, reply) => {
    logger.info(['handler','users:create'], `create user request by ${request.user && request.user.username}`);
    const b = request.body || {};
    // scope: created user inherits creator's clinic if present
    const clinicId = request.user && request.user.clinic_id ? request.user.clinic_id : b.clinicId || null;
    const user = await createUser({ username: b.username, password: b.password, role: b.role || 'provider', clinicId, actorId: request.user.id, actorRole: request.user.role, correlationId: request.requestId });
    logger.info(['handler','users:create','created'], `user=${user.username} role=${user.role}`);
    reply.code(201); return user;
  });

  fastify.get('/api/users', { preHandler: [opts.permit('user:read')] }, async (request) => {
    logger.info(['handler','users:list'], `list users requested by ${request.user && request.user.username}`);
    const clinicId = request.user && request.user.clinic_id ? request.user.clinic_id : null;
    const users = await listUsers({ clinicId });
    return users;
  });

  fastify.get('/api/users/:id', { preHandler: [opts.permit('user:read')] }, async (request, reply) => {
    logger.info(['handler','users:get'], `get user ${request.params.id} by ${request.user && request.user.username}`);
    const u = await getUser(request.params.id);
    if (!u) return reply.code(404).send({ code: 404, msg: 'User not found' });
    return u;
  });

  fastify.put('/api/users/:id', { preHandler: [opts.permit('user:write')] }, async (request, reply) => {
    logger.info(['handler','users:update'], `update user ${request.params.id} by ${request.user && request.user.username}`);
    const b = request.body || {};
    const clinicId = request.user && request.user.clinic_id ? request.user.clinic_id : b.clinicId || null;
    const u = await updateUser(request.params.id, { username: b.username, role: b.role, clinicId, correlationId: request.requestId }, request.user.id, request.user.role);
    logger.info(['handler','users:update','saved'], `user=${u.username}`);
    return u;
  });

  fastify.delete('/api/users/:id', { preHandler: [opts.permit('user:write')] }, async (request, reply) => {
    logger.info(['handler','users:delete'], `delete user ${request.params.id} by ${request.user && request.user.username}`);
    const b = request.body || {};
    if (!b.confirmed || !b.reason) return reply.code(400).send({ code: 400, msg: 'Deletion requires confirmed=true and a reason' });
    try {
      const deleted = await deleteUser(request.params.id, { confirmed: b.confirmed, reason: b.reason, correlationId: request.requestId }, request.user.id, request.user.role);
      logger.info(['handler','users:delete','deleted'], `user=${request.params.id} reason=${b.reason}`);
      return deleted;
    } catch (e) { logger.error(['handler','users:delete','error'], e.message); return reply.code(400).send({ code: 400, msg: e.message }); }
  });
}

module.exports = usersRoutes;
