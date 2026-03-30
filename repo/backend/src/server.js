const { buildApp } = require('./app');
const { env } = require('./config');
const { run: seedRun } = require('./db/seed');

async function start() {
	const app = await buildApp();
	await app.listen({ port: env.PORT, host: env.HOST });
	// run seeder in background but don't block startup
	seedRun().then(() => { app.log.info('DB seeding finished'); }).catch((e) => { app.log.error(e, 'DB seeding failed'); });
}

start().catch((err) => { console.error('Failed to start server', err); process.exit(1); });
