/**
 * E2E: Inventory operations workflow.
 *
 * Covers: inventory page loads, item list, create item form,
 * stock movement panel, low stock alerts, variance report.
 */
const assert = require('assert');
const { createBrowser, newPage, login, logout } = require('./helper');

async function testInventoryPageLoads(page) {
  await login(page, 'inventory');
  await page.getByRole('link', { name: /Inventory/i }).first().click();
  await page.waitForURL(/\/inventory$/, { timeout: 15000 });
  await page.waitForSelector('h3', { timeout: 10000 });
  const heading = await page.textContent('h3');
  assert.ok((heading || '').includes('Inventory Operations'), `Expected "Inventory Operations", got: ${heading}`);
  await logout(page);
}

async function testInventoryItemTablePresent(page) {
  await login(page, 'inventory');
  await page.getByRole('link', { name: /Inventory/i }).first().click();
  await page.waitForURL(/\/inventory$/, { timeout: 15000 });
  const table = page.locator('table');
  await table.first().waitFor({ timeout: 10000 });
  const headers = await table.first().locator('th').allTextContents();
  assert.ok(headers.some((h) => /sku/i.test(h)), 'Table should have SKU column');
  assert.ok(headers.some((h) => /name/i.test(h)), 'Table should have Name column');
  await logout(page);
}

async function testNewItemButtonTogglesForm(page) {
  await login(page, 'inventory');
  await page.getByRole('link', { name: /Inventory/i }).first().click();
  await page.waitForURL(/\/inventory$/, { timeout: 15000 });
  await page.waitForSelector('h3', { timeout: 10000 });

  const newItemBtn = page.getByRole('button', { name: /New Item/i });
  await newItemBtn.waitFor({ timeout: 10000 });
  await newItemBtn.click();
  await page.waitForTimeout(300);

  // Create form should appear
  const createSection = page.locator('h4:has-text("Create Item")');
  await createSection.waitFor({ timeout: 5000 });
  assert.ok(await createSection.count() > 0, 'Create Item form should appear after clicking New Item');

  // Toggle it off
  await newItemBtn.click();
  await page.waitForTimeout(300);
  await logout(page);
}

async function testCreateItemFormHasRequiredFields(page) {
  await login(page, 'inventory');
  await page.getByRole('link', { name: /Inventory/i }).first().click();
  await page.waitForURL(/\/inventory$/, { timeout: 15000 });
  await page.waitForSelector('h3', { timeout: 10000 });

  const newItemBtn = page.getByRole('button', { name: /New Item/i });
  await newItemBtn.waitFor({ timeout: 10000 });
  await newItemBtn.click();
  await page.waitForSelector('h4:has-text("Create Item")', { timeout: 5000 });

  const skuInput = page.locator('label:has-text("SKU") input');
  const nameInput = page.locator('label:has-text("Name") input');
  await skuInput.waitFor({ timeout: 5000 });
  assert.ok(await skuInput.count() > 0, 'SKU input should be present in create form');
  assert.ok(await nameInput.count() > 0, 'Name input should be present in create form');

  await logout(page);
}

async function testLowStockAlertsSection(page) {
  await login(page, 'inventory');
  await page.getByRole('link', { name: /Inventory/i }).first().click();
  await page.waitForURL(/\/inventory$/, { timeout: 15000 });

  const lowStockHeading = page.locator('h4:has-text("Low Stock Alerts")');
  await lowStockHeading.waitFor({ timeout: 10000 });
  assert.ok(await lowStockHeading.count() > 0, 'Low Stock Alerts section should be present');
  await logout(page);
}

async function testVarianceReportSection(page) {
  await login(page, 'inventory');
  await page.getByRole('link', { name: /Inventory/i }).first().click();
  await page.waitForURL(/\/inventory$/, { timeout: 15000 });

  const varianceHeading = page.locator('h4:has-text("Variance Report")');
  await varianceHeading.waitFor({ timeout: 10000 });
  assert.ok(await varianceHeading.count() > 0, 'Variance Report section should be present');
  await logout(page);
}

async function testStockMovementPanelAppearsOnItemSelect(page) {
  await login(page, 'inventory');
  await page.getByRole('link', { name: /Inventory/i }).first().click();
  await page.waitForURL(/\/inventory$/, { timeout: 15000 });
  await page.waitForSelector('table', { timeout: 10000 });

  const moveBtn = page.locator('button:has-text("Move")');
  if (await moveBtn.count() > 0) {
    await moveBtn.first().click();
    await page.waitForTimeout(300);
    const movementHeading = page.locator('h4:has-text("Stock Movement")');
    await movementHeading.waitFor({ timeout: 5000 });
    assert.ok(await movementHeading.count() > 0, 'Stock Movement panel should appear after selecting an item');
  } else {
    console.log('[e2e:inventory] no items with Move button found (conditional pass)');
  }
  await logout(page);
}

async function main() {
  const browser = await createBrowser();
  try {
    const { context, page } = await newPage(browser);
    try {
      const scenarios = [
        ['inventory_page_loads', testInventoryPageLoads],
        ['inventory_item_table_present', testInventoryItemTablePresent],
        ['new_item_button_toggles_form', testNewItemButtonTogglesForm],
        ['create_item_form_has_required_fields', testCreateItemFormHasRequiredFields],
        ['low_stock_alerts_section', testLowStockAlertsSection],
        ['variance_report_section', testVarianceReportSection],
        ['stock_movement_panel_appears', testStockMovementPanelAppearsOnItemSelect],
      ];

      for (const [name, fn] of scenarios) {
        const t0 = Date.now();
        await fn(page);
        console.log(`[e2e:inventory] ${name} passed (${Date.now() - t0}ms)`);
      }
      console.log('[e2e:inventory] all inventory E2E tests passed');
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
    console.error('[e2e:inventory] FAILED', err);
    process.exit(1);
  });
}
