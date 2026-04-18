const { createApiContext, bootstrapAuth } = require('./helper');

async function runNamed(name, fn, api, sessions) {
  const startedAt = Date.now();
  await fn(api, sessions);
  const elapsedMs = Date.now() - startedAt;
  console.log(`[api] ${name} passed (${elapsedMs}ms)`);
}

async function main() {
  process.env.NODE_ENV = 'test';
  if (!process.env.JWT_SECRET) process.env.JWT_SECRET = 'meridian-local-jwt-secret';
  if (!process.env.PHI_KEY) process.env.PHI_KEY = 'meridian-local-phi-key';

  const { runApiSmoke } = require('./api_smoke_test');
  const { runOverviewApi } = require('./overview_endpoint_test');
  const { runRequirementApi } = require('./requirement_api_test');
  const { runObjectIsolation } = require('./object_isolation.test');
  const { runAdminAccess } = require('./admin_access.test');
  const { runAdversaryHardGate } = require('./adversary_hard_gate.test');
  const { runRouteIsolationMatrix } = require('./route_isolation_matrix.test');
  const { runBillingUat } = require('./billing_uat.test');
  const { runComprehensiveCoverage } = require('./comprehensive_coverage.test');

  const { app, api } = await createApiContext();
  const sessions = await bootstrapAuth(api);

  try {
    await runNamed('smoke', runApiSmoke, api, sessions);
    await runNamed('overview', runOverviewApi, api, sessions);
    await runNamed('requirements', runRequirementApi, api, sessions);
    await runNamed('object-isolation', runObjectIsolation, api, sessions);
    await runNamed('admin-access-negative', runAdminAccess, api, sessions);
    await runNamed('adversary-hard-gate', runAdversaryHardGate, api, sessions);
    await runNamed('route-isolation-matrix', runRouteIsolationMatrix, api, sessions);
    await runNamed('billing-uat', runBillingUat, api, sessions);
    await runNamed('comprehensive-coverage', runComprehensiveCoverage, api, sessions);
    console.log('[api] all API acceptance tests passed');
  } finally {
    await app.close();
  }
}

main().catch((error) => {
  console.error('[api] acceptance tests failed');
  console.error(error);
  process.exit(1);
});
