/**
 * E2E test runner for frontend/tests/e2e/.
 *
 * Runs all test modules sequentially. Each module exports a `main()` function.
 * Set E2E_FRONTEND_URL and API_BASE_URL environment variables to point at
 * a running instance (Docker or local).
 *
 * Usage:
 *   node frontend/tests/e2e/run_e2e.js
 *   # or from frontend/:
 *   API_BASE_URL=http://backend:3000 node tests/e2e/run_e2e.js
 */

async function main() {
  const suites = [
    ['auth',       require('./auth.test')],
    ['rbac',       require('./rbac.test')],
    ['physician',  require('./physician.test')],
    ['pharmacist', require('./pharmacist.test')],
    ['billing',    require('./billing.test')],
    ['inventory',  require('./inventory.test')],
    ['admin',      require('./admin.test')],
  ];

  const results = [];
  for (const [name, mod] of suites) {
    const t0 = Date.now();
    try {
      await mod.main();
      const elapsed = Date.now() - t0;
      results.push({ name, passed: true, elapsed });
      console.log(`[e2e-runner] ✓ ${name} (${elapsed}ms)`);
    } catch (err) {
      const elapsed = Date.now() - t0;
      results.push({ name, passed: false, elapsed, error: err });
      console.error(`[e2e-runner] ✗ ${name} (${elapsed}ms): ${err.message || err}`);
    }
  }

  const failed = results.filter((r) => !r.passed);
  console.log('\n[e2e-runner] ─── Summary ───────────────────────────────────');
  for (const r of results) {
    console.log(`  ${r.passed ? '✓' : '✗'} ${r.name} (${r.elapsed}ms)`);
  }
  console.log('──────────────────────────────────────────────────────────');

  if (failed.length > 0) {
    console.error(`[e2e-runner] ${failed.length} suite(s) failed`);
    process.exit(1);
  }
  console.log(`[e2e-runner] all ${results.length} E2E suites passed`);
}

main().catch((err) => {
  console.error('[e2e-runner] runner error', err);
  process.exit(1);
});
