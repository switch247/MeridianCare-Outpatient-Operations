const { buildApp } = require('./app');
const { env } = require('./config');
const { run: seedRun } = require('./db/seed');

async function start() {
	const app = await buildApp();
	await seedRun();
  app.log.info('DB seeding finished');
	await app.listen({ port: env.PORT, host: env.HOST });
  app.log.info('Ready to accept requests on port ' + env.PORT);
}

start().catch((err) => { console.error('Failed to start server', err); process.exit(1); });
