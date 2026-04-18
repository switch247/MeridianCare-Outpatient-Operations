/**
 * E2E: Role-Based Access Control (RBAC) enforcement in the UI.
 *
 * Covers: role-specific navigation items, cross-role access denial,
 * correct page shown per role, unauthenticated redirect.
 */
const assert = require('assert');
const { createBrowser, newPage, login, logout, FRONTEND_URL } = require('./helper');

async function testUnauthenticatedRedirectsToLogin(page) {
  await page.goto(FRONTEND_URL, { waitUntil: 'networkidle' });
  const form = await page.$('form.login-form, form');
  assert.ok(form, 'Unauthenticated visit should show login form');
  const main = await page.$('main');
  assert.ok(!main, 'Unauthenticated visit should NOT show workspace');
}

async function testPhysicianSeesEncountersLink(page) {
  await login(page, 'physician');
  const link = page.getByRole('link', { name: /Encounters/i });
  await link.first().waitFor({ timeout: 10000 });
  assert.ok(await link.count() > 0, 'Physician should see Encounters navigation link');
  await logout(page);
}

async function testPharmacistSeesPharmacyQueueLink(page) {
  await login(page, 'pharmacist');
  const link = page.getByRole('link', { name: /Pharmacy Queue/i });
  await link.first().waitFor({ timeout: 10000 });
  assert.ok(await link.count() > 0, 'Pharmacist should see Pharmacy Queue link');
  await logout(page);
}

async function testBillingUserSeesBillingLink(page) {
  await login(page, 'billing');
  const link = page.getByRole('link', { name: /Billing/i });
  await link.first().waitFor({ timeout: 10000 });
  assert.ok(await link.count() > 0, 'Billing user should see Billing link');
  await logout(page);
}

async function testAdminSeesAdminOpsLink(page) {
  await login(page, 'admin');
  const link = page.getByRole('link', { name: /Admin Ops/i });
  await link.first().waitFor({ timeout: 10000 });
  assert.ok(await link.count() > 0, 'Admin should see Admin Ops link');
  await logout(page);
}

async function testInventoryUserSeesInventoryLink(page) {
  await login(page, 'inventory');
  const link = page.getByRole('link', { name: /Inventory/i });
  await link.first().waitFor({ timeout: 10000 });
  assert.ok(await link.count() > 0, 'Inventory user should see Inventory link');
  await logout(page);
}

async function testBillingCannotDirectNavigateToAdminOps(page) {
  await login(page, 'billing');
  await page.goto(`${FRONTEND_URL}/admin-ops`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1000);
  const url = page.url();
  assert.ok(
    !url.endsWith('/admin-ops'),
    `Billing user should be redirected away from /admin-ops (was at ${url})`,
  );
  await logout(page);
}

async function testPhysicianCannotDirectNavigateToAdminOps(page) {
  await login(page, 'physician');
  await page.goto(`${FRONTEND_URL}/admin-ops`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1000);
  const url = page.url();
  assert.ok(
    !url.endsWith('/admin-ops'),
    `Physician should be redirected away from /admin-ops (was at ${url})`,
  );
  await logout(page);
}

async function testAuditorCanNavigateToOverviewOrHome(page) {
  await login(page, 'auditor');
  // Auditor should land on some dashboard
  const main = await page.$('main');
  assert.ok(main, 'Auditor should see workspace after login');
  await logout(page);
}

async function testEachRoleSeesRoleIndicator(page) {
  const roles = ['physician', 'pharmacist', 'billing', 'admin', 'auditor'];
  for (const role of roles) {
    await login(page, role);
    // Look for a role indicator in the page (could be username, role badge, etc.)
    const body = await page.textContent('body');
    assert.ok(
      (body || '').toLowerCase().includes(role) || (body || '').includes(role.charAt(0).toUpperCase() + role.slice(1)),
      `Page should mention role "${role}" somewhere after login`,
    );
    await logout(page);
  }
}

async function main() {
  const browser = await createBrowser();
  try {
    const { context, page } = await newPage(browser);
    try {
      const scenarios = [
        ['unauthenticated_redirects_to_login', testUnauthenticatedRedirectsToLogin],
        ['physician_sees_encounters_link', testPhysicianSeesEncountersLink],
        ['pharmacist_sees_pharmacy_queue_link', testPharmacistSeesPharmacyQueueLink],
        ['billing_sees_billing_link', testBillingUserSeesBillingLink],
        ['admin_sees_admin_ops_link', testAdminSeesAdminOpsLink],
        ['inventory_sees_inventory_link', testInventoryUserSeesInventoryLink],
        ['billing_cannot_navigate_to_admin_ops', testBillingCannotDirectNavigateToAdminOps],
        ['physician_cannot_navigate_to_admin_ops', testPhysicianCannotDirectNavigateToAdminOps],
        ['auditor_can_navigate_to_overview', testAuditorCanNavigateToOverviewOrHome],
        ['each_role_sees_role_indicator', testEachRoleSeesRoleIndicator],
      ];

      for (const [name, fn] of scenarios) {
        const t0 = Date.now();
        await fn(page);
        console.log(`[e2e:rbac] ${name} passed (${Date.now() - t0}ms)`);
      }
      console.log('[e2e:rbac] all RBAC E2E tests passed');
    } finally {
      await context.close();
    }
  } finally {
    await browser.close();
  }
}

module.exports = { main };

if (require.main === module) {
  main().catch((err) => {
    console.error('[e2e:rbac] FAILED', err);
    process.exit(1);
  });
}
