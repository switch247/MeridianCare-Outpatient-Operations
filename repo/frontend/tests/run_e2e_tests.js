const assert = require('assert');
const { createBrowser, newPage, uiLogin, logout } = require('./e2e_helper');

async function testPhysicianFlow(page) {
  await uiLogin(page, 'physician');
  // sidebar and card variants may both expose the link; choose the first
  await page.getByRole('link', { name: /Encounters/i }).first().click();
  await page.waitForURL(/\/encounters$/, { timeout: 15000 });
  await page.waitForSelector('h3', { timeout: 10000 });
  const heading = await page.textContent('h3');
  assert.ok((heading || '').includes('Encounter Workbench'));
  await logout(page);
}

async function testPharmacistFlow(page) {
  await uiLogin(page, 'pharmacist');
  // multiple match variants exist; pick the first to avoid strict-mode errors
  await page.getByRole('link', { name: /Pharmacy Queue/i }).first().click();
  await page.waitForURL(/\/pharmacy$/, { timeout: 15000 });
  const heading = await page.textContent('h3');
  assert.ok((heading || '').includes('Pharmacy Review Queue'));
  await logout(page);
}

async function testBillingFlow(page) {
  await uiLogin(page, 'billing');
  // multiple accessible links match /Billing/i (sidebar + card); pick the first match
  await page.getByRole('link', { name: /Billing/i }).first().click();
  await page.waitForURL(/\/billing$/, { timeout: 15000 });
  const heading = await page.textContent('h3');
  assert.ok((heading || '').includes('Billing Checkout Center'));

  await page.getByRole('button', { name: /New Invoice/i }).click();
  await page.waitForSelector('text=Create Invoice', { timeout: 15000  });
  await page.getByRole('button', { name: /Cancel/i }).click();
  await logout(page);
}

async function testAdminOpsFlow(page) {
  await uiLogin(page, 'admin');
  // nav duplicates exist (sidebar + card); pick the first match
  await page.getByRole('link', { name: /Admin Ops/i }).first().click();
  await page.waitForURL(/\/admin-ops$/, { timeout: 15000 });
  const heading = await page.textContent('h3');
  assert.ok((heading || '').includes('Admin Operations'));

  // Wait for the crawl button to appear (label in UI is 'Queue Job') then click
  await page.waitForSelector('button:has-text("Queue Job")', { timeout: 10000 });
  await page.locator('button:has-text("Queue Job")').first().click();
  await page.waitForSelector('text=Crawler job queued', { timeout: 10000 });
  await logout(page);
}

async function main() {
  const browser = await createBrowser();
  try {
    const { context, page } = await newPage(browser);
    try {
      const scenarios = [
        ['physician_ui', testPhysicianFlow],
        ['pharmacist_ui', testPharmacistFlow],
        ['billing_ui', testBillingFlow],
        ['admin_ops_ui', testAdminOpsFlow],
      ];

      for (const [name, fn] of scenarios) {
        const started = Date.now();
        await fn(page);
        console.log(`[e2e-ui] ${name} passed (${Date.now() - started}ms)`);
      }
      console.log('[e2e-ui] all UI E2E scenarios passed');
    } finally {
      await context.close();
    }
  } finally {
    await browser.close();
  }
}

main().catch((error) => {
  console.error('[e2e-ui] UI E2E scenarios failed');
  console.error(error);
  process.exit(1);
});
