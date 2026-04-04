async function clinicsRoutes(fastify, opts) {
  const { createClinic, getClinic, updateClinic, deleteClinic } = require('../services/clinics');
  const logger = require('../lib/logger');

  fastify.post('/api/clinics', { preHandler: [opts.permit('credentialing:write')] }, async (request, reply) => {
    logger.info(['handler','clinics:create'], `create clinic requested by ${request.user && request.user.username}`);
    const b = request.body || {};
    // enforce single-clinic deployment: only allow create if none exists
    const existing = await getClinic();
    if (existing) { logger.warn(['handler','clinics:create','conflict'], 'clinic already exists'); return reply.code(409).send({ code: 409, msg: 'Clinic already exists for this deployment' }); }
    const clinic = await createClinic({ name: b.name, address: b.address, contactInfo: b.contactInfo, type: b.type, actorId: request.user.id, actorRole: request.user.role, correlationId: request.requestId });
    logger.info(['handler','clinics:create','created'], `clinic=${clinic.id}`);
    reply.code(201); return clinic;
  });

  fastify.get('/api/clinics', { preHandler: [opts.permit('overview:read')] }, async (request) => {
    logger.info(['handler','clinics:get'], `clinic info requested by ${request.user && request.user.username}`);
    const clinic = await getClinic();
    return clinic || {};
  });

  fastify.put('/api/clinics/:id', { preHandler: [opts.permit('credentialing:write')] }, async (request) => {
    logger.info(['handler','clinics:update'], `update clinic ${request.params.id} by ${request.user && request.user.username}`);
    const id = request.params.id;
    const b = request.body || {};
    const clinic = await updateClinic(id, { name: b.name, address: b.address, contactInfo: b.contactInfo, type: b.type, correlationId: request.requestId }, request.user.id, request.user.role);
    logger.info(['handler','clinics:update','saved'], `clinic=${clinic.id}`);
    return clinic;
  });

  fastify.delete('/api/clinics/:id', { preHandler: [opts.permit('credentialing:write')] }, async (request, reply) => {
    logger.info(['handler','clinics:delete'], `delete clinic ${request.params.id} by ${request.user && request.user.username}`);
    const id = request.params.id;
    const b = request.body || {};
    // require explicit confirmation + reason
    if (!b.confirmed || !b.reason) return reply.code(400).send({ code: 400, msg: 'Deletion requires confirmed=true and a reason' });
    const clinic = await deleteClinic(id, { reason: b.reason, confirmed: b.confirmed, correlationId: request.requestId }, request.user.id, request.user.role);
    logger.info(['handler','clinics:delete','deleted'], `clinic=${id}`);
    return clinic;
  });
}

module.exports = clinicsRoutes;
