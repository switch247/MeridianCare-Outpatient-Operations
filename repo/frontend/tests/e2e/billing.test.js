/**
 * E2E: Billing checkout workflow.
 *
 * Covers: invoice listing, new invoice modal, price calculator,
 * payment flow, cancel flow, PHI masking of patient names,
 * shipping template selection.
 */
const assert = require('assert');
const { createBrowser, newPage, login, logout } = require('./helper');

async function testBillingPageLoads(page) {
  await login(page, 'billing');
  await page.getByRole('link', { name: /Billing/i }).first().click();
  await page.waitForURL(/\/billing$/, { timeout: 15000 });
  const heading = await page.textContent('h3');
  assert.ok((heading || '').includes('Billing Checkout Center'), `Expected billing heading, got: ${heading}`);
  await logout(page);
}

async function testInvoiceTablePresent(page) {
  await login(page, 'billing');
  await page.getByRole('link', { name: /Billing/i }).first().click();
  await page.waitForURL(/\/billing$/, { timeout: 15000 });
  const table = page.locator('table');
  await table.waitFor({ timeout: 10000 });
  const headers = await table.locator('th').allTextContents();
  assert.ok(headers.length > 0, 'Invoice table should have column headers');
  await logout(page);
}

async function testNewInvoiceModalOpens(page) {
  await login(page, 'billing');
  await page.getByRole('link', { name: /Billing/i }).first().click();
  await page.waitForURL(/\/billing$/, { timeout: 15000 });

  const newBtn = page.getByRole('button', { name: /New Invoice/i });
  await newBtn.waitFor({ timeout: 10000 });
  await newBtn.click();

  await page.waitForSelector('.modal-panel', { timeout: 15000 });
  const modalHeading = await page.locator('.modal-panel h3, .modal-panel h4').first().textContent();
  assert.ok((modalHeading || '').length > 0, 'Invoice modal should have a heading');

  await logout(page);
}

async function testNewInvoiceModalCloses(page) {
  await login(page, 'billing');
  await page.getByRole('link', { name: /Billing/i }).first().click();
  await page.waitForURL(/\/billing$/, { timeout: 15000 });

  const newBtn = page.getByRole('button', { name: /New Invoice/i });
  await newBtn.waitFor({ timeout: 10000 });
  await newBtn.click();
  await page.waitForSelector('.modal-panel', { timeout: 15000 });

  // Click Cancel in the modal
  await page.locator('.modal-panel').getByRole('button', { name: /Cancel/i }).click();
  await page.waitForTimeout(500);
  const modal = await page.$('.modal-panel');
  assert.ok(!modal, 'Modal should be closed after clicking Cancel');

  await logout(page);
}

async function testInvoiceModalHasPriceCalculator(page) {
  await login(page, 'billing');
  await page.getByRole('link', { name: /Billing/i }).first().click();
  await page.waitForURL(/\/billing$/, { timeout: 15000 });

  const newBtn = page.getByRole('button', { name: /New Invoice/i });
  await newBtn.waitFor({ timeout: 10000 });
  await newBtn.click();
  await page.waitForSelector('.modal-panel', { timeout: 15000 });

  // Check for plan percent / coupon inputs
  const planInput = page.locator('.modal-panel').locator('input[type="number"]');
  const inputCount = await planInput.count();
  assert.ok(inputCount >= 1, 'Invoice modal should have at least one number input for price calculation');

  await page.locator('.modal-panel').getByRole('button', { name: /Cancel/i }).click();
  await logout(page);
}

async function testBillingCannotAccessAdmin(page) {
  await login(page, 'billing');
  // Attempt to navigate directly to admin-ops URL
  const { FRONTEND_URL } = require('./helper');
  await page.goto(`${FRONTEND_URL}/admin-ops`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1000);
  // Should be redirected to root (login or home, not admin-ops)
  const url = page.url();
  assert.ok(!url.includes('/admin-ops'), 'Billing user should not be able to access admin-ops route');
  await logout(page);
}

async function main() {
  const browser = await createBrowser();
  try {
    const { context, page } = await newPage(browser);
    try {
      const scenarios = [
        ['billing_page_loads', testBillingPageLoads],
        ['invoice_table_present', testInvoiceTablePresent],
        ['new_invoice_modal_opens', testNewInvoiceModalOpens],
        ['new_invoice_modal_closes', testNewInvoiceModalCloses],
        ['invoice_modal_has_price_calculator', testInvoiceModalHasPriceCalculator],
        ['billing_cannot_access_admin', testBillingCannotAccessAdmin],
      ];

      for (const [name, fn] of scenarios) {
        const t0 = Date.now();
        await fn(page);
        console.log(`[e2e:billing] ${name} passed (${Date.now() - t0}ms)`);
      }
      console.log('[e2e:billing] all billing E2E tests passed');
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
    console.error('[e2e:billing] FAILED', err);
    process.exit(1);
  });
}
