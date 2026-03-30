(function(){
	const pino = require('pino');
	const { env } = require('../config');

	const pinoLogger = pino({ level: env.LOG_LEVEL || 'info', base: null, timestamp: pino.stdTimeFunctions.isoTime });

	function fmtTags(tags) {
		if (!tags) return '';
		if (Array.isArray(tags)) return tags.map(t => `[${String(t)}]`).join('');
		return `[${String(tags)}]`;
	}

	function formatMessage(tags, msg) { return `${fmtTags(tags)} ${msg}`; }

	const SENSITIVE_KEYS = ['password','password_hash','ssn','ssn_encrypted','authorization','auth','token','session','cookie','credit_card','cc','cvv','secret','apiKey','apikey','reauthPassword'];

	function sanitizeValue(val) {
		if (val === null || val === undefined) return val;
		if (typeof val === 'string') return val;
		if (typeof val === 'number' || typeof val === 'boolean') return val;
		if (Array.isArray(val)) return val.map(sanitizeValue);
		if (typeof val === 'object') return sanitizeObject(val);
		return val;
	}

	function sanitizeObject(obj) {
		if (!obj || typeof obj !== 'object') return obj;
		const out = Array.isArray(obj) ? [] : {};
		for (const k of Object.keys(obj)) {
			try {
				if (SENSITIVE_KEYS.includes(k)) {
					out[k] = '***REDACTED***';
				} else {
					out[k] = sanitizeValue(obj[k]);
				}
			} catch (e) {
				out[k] = '***REDACTED***';
			}
		}
		return out;
	}

	function sanitize(input) {
		try {
			if (input == null) return input;
			if (typeof input === 'object') return sanitizeObject(input);
			return input;
		} catch (e) { return '***REDACTED***'; }
	}

	const api = {
		pino: pinoLogger,
		info: (tags, msg, meta) => pinoLogger.info({ meta: sanitize(meta) }, formatMessage(tags, msg)),
		warn: (tags, msg, meta) => pinoLogger.warn({ meta: sanitize(meta) }, formatMessage(tags, msg)),
		error: (tags, msg, meta) => pinoLogger.error({ meta: sanitize(meta) }, formatMessage(tags, msg)),
		debug: (tags, msg, meta) => pinoLogger.debug({ meta: sanitize(meta) }, formatMessage(tags, msg)),
		child: (obj) => pinoLogger.child(obj),
		sanitize
	};

	// fastify plugin to attach hooks
	async function plugin(fastify, opts) {
		 // attach logger helpers to fastify
		 try { fastify.decorate('logger', api); } catch (e) { fastify.logger = api; }
		 // ensure `fastify.log` is bound to our pino instance for consistency
		 try { fastify.decorate('log', pinoLogger); } catch (e) { fastify.log = pinoLogger; }

		fastify.addHook('onRequest', async (request, reply) => {
			try {
				request._startTime = Date.now();
				const ip = request.ip || request.socket && request.socket.remoteAddress;
				// generate correlation id for this request
				const { v4: uuidv4 } = require('uuid');
				const cid = uuidv4();
				request.requestId = cid;
				// attach a child logger with cid so entries include it
				try { request.log = pinoLogger.child({ cid }); } catch (e) { request.log = pinoLogger; }
				if (reply && typeof reply.header === 'function') reply.header('X-Request-Id', cid);
				api.info(['req','incoming', request.method, request.raw.url, `cid:${cid}`], `from ${ip}`, { ip, cid });
			} catch (e) { /* swallow */ }
		});

		fastify.addHook('onResponse', async (request, reply) => {
			try {
				const dur = Date.now() - (request._startTime || Date.now());
				const cid = request.requestId || null;
				api.info(['req','completed', request.method, request.raw.url, `status:${reply.statusCode}`, `cid:${cid}`], `completed in ${dur}ms`, { cid, durationMs: dur });
			} catch (e) { /* swallow */ }
		});
	}

	module.exports = { pino: pinoLogger, plugin, info: api.info, warn: api.warn, error: api.error, debug: api.debug, child: api.child, sanitize: api.sanitize };
})();

