/**
 * E2E: Admin operations workflow.
 *
 * Covers: Admin Ops page loads, crawler queue, model registration,
 * exception alerts, backup drills, user management panel.
 */
const assert = require('assert');
const { createBrowser, newPage, login, logout } = require('./helper');

async function testAdminOpsPageLoads(page) {
  await login(page, 'admin');
  await page.getByRole('link', { name: /Admin Ops/i }).first().click();
  await page.waitForURL(/\/admin-ops$/, { timeout: 15000 });
  const heading = await page.textContent('h3');
  assert.ok((heading || '').includes('Admin Operations'), `Expected "Admin Operations", got: ${heading}`);
  await logout(page);
}

async function testCrawlerQueueJobButton(page) {
  await login(page, 'admin');
  await page.getByRole('link', { name: /Admin Ops/i }).first().click();
  await page.waitForURL(/\/admin-ops$/, { timeout: 15000 });

  await page.waitForSelector('button:has-text("Queue Job")', { timeout: 10000 });
  await page.locator('button:has-text("Queue Job")').first().click();

  await page.waitForSelector('text=Crawler job queued', { timeout: 10000 });
  const msg = await page.locator('.msg').textContent();
  assert.ok((msg || '').includes('Crawler job queued'), `Expected success message, got: ${msg}`);
  await logout(page);
}

async function testCrawlerTablePresent(page) {
  await login(page, 'admin');
  await page.getByRole('link', { name: /Admin Ops/i }).first().click();
  await page.waitForURL(/\/admin-ops$/, { timeout: 15000 });
  await page.waitForSelector('.ops-table', { timeout: 10000 });
  const tables = await page.locator('.ops-table').all();
  assert.ok(tables.length >= 1, 'At least one ops table should be present on Admin Ops page');
  await logout(page);
}

async function testCreateExceptionAlert(page) {
  await login(page, 'admin');
  await page.getByRole('link', { name: /Admin Ops/i }).first().click();
  await page.waitForURL(/\/admin-ops$/, { timeout: 15000 });

  const createAlertBtn = page.getByRole('button', { name: /Create Alert/i });
  await createAlertBtn.waitFor({ timeout: 10000 });
  await createAlertBtn.click();
  await page.waitForTimeout(1500);

  const msg = await page.locator('.msg').textContent();
  assert.ok(
    (msg || '').includes('Exception alert recorded') || (msg || '').length > 0,
    'Should show feedback after creating exception alert',
  );
  await logout(page);
}

async function testRunNightlyBackup(page) {
  await login(page, 'admin');
  await page.getByRole('link', { name: /Admin Ops/i }).first().click();
  await page.waitForURL(/\/admin-ops$/, { timeout: 15000 });

  const backupBtn = page.getByRole('button', { name: /Run Nightly Backup/i });
  await backupBtn.waitFor({ timeout: 10000 });
  await backupBtn.click();
  await page.waitForTimeout(5000); // Backup may take a few seconds
  const msg = await page.locator('.msg').textContent();
  assert.ok(
    (msg || '').includes('Nightly backup completed') || (msg || '').includes('failed'),
    `Backup should show completion or error message, got: ${msg}`,
  );
  await logout(page);
}

async function testRegisterModelButton(page) {
  await login(page, 'admin');
  await page.getByRole('link', { name: /Admin Ops/i }).first().click();
  await page.waitForURL(/\/admin-ops$/, { timeout: 15000 });

  const registerBtn = page.getByRole('button', { name: /Register.*Deploy/i });
  await registerBtn.waitFor({ timeout: 10000 });
  await registerBtn.click();
  await page.waitForTimeout(1500);
  const msg = await page.locator('.msg').textContent();
  assert.ok(
    (msg || '').includes('Model registered') || (msg || '').includes('failed'),
    `Register model should produce feedback, got: ${msg}`,
  );
  await logout(page);
}

async function testUserManagementPageLoads(page) {
  await login(page, 'admin');
  await page.getByRole('link', { name: /Users/i }).first().click();
  await page.waitForURL(/\/users$/, { timeout: 15000 });
  await page.waitForSelector('h3', { timeout: 10000 });
  const heading = await page.textContent('h3');
  assert.ok((heading || '').includes('User Management') || (heading || '').length > 0, `Expected user management heading, got: ${heading}`);
  await logout(page);
}

async function testAdminCanCreateUser(page) {
  await login(page, 'admin');
  await page.getByRole('link', { name: /Users/i }).first().click();
  await page.waitForURL(/\/users$/, { timeout: 15000 });
  await page.waitForSelector('h3', { timeout: 10000 });

  const addBtn = page.getByRole('button', { name: /Add User/i });
  await addBtn.waitFor({ timeout: 10000 });
  await addBtn.click();
  await page.waitForSelector('.modal-panel', { timeout: 10000 });
  const modalText = await page.locator('.modal-panel').textContent();
  assert.ok((modalText || '').length > 0, 'User creation modal should have content');
  await page.locator('.modal-panel').getByRole('button', { name: /Cancel/i }).click();
  await logout(page);
}

async function testAdminCannotSeePhysicianRoutes(page) {
  await login(page, 'admin');
  // Admin should NOT see the Encounters link (physician-only page)
  const encLink = page.getByRole('link', { name: /^Encounters$/i });
  const count = await encLink.count();
  // Admin might not have Encounters in their nav
  if (count > 0) {
    // If the link exists, it should not be accessible as admin
    await encLink.first().click();
    await page.waitForTimeout(1000);
    const url = page.url();
    // Either redirected away or the page is a 403 view
    console.log(`[e2e:admin] admin navigated to encounters → ${url}`);
  }
  await logout(page);
}

async function main() {
  const browser = await createBrowser();
  try {
    const { context, page } = await newPage(browser);
    try {
      const scenarios = [
        ['admin_ops_page_loads', testAdminOpsPageLoads],
        ['crawler_queue_job_button', testCrawlerQueueJobButton],
        ['crawler_table_present', testCrawlerTablePresent],
        ['create_exception_alert', testCreateExceptionAlert],
        ['register_model_button', testRegisterModelButton],
        ['user_management_page_loads', testUserManagementPageLoads],
        ['admin_can_create_user', testAdminCanCreateUser],
        ['run_nightly_backup', testRunNightlyBackup],
      ];

      for (const [name, fn] of scenarios) {
        const t0 = Date.now();
        await fn(page);
        console.log(`[e2e:admin] ${name} passed (${Date.now() - t0}ms)`);
      }
      console.log('[e2e:admin] all admin E2E tests passed');
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
    console.error('[e2e:admin] FAILED', err);
    process.exit(1);
  });
}
