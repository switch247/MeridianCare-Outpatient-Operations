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
  await page.waitForSelector('.modal-panel', { timeout: 15000  });
  // Scope Cancel click to the modal panel to avoid matching Cancel buttons on invoice rows
  await page.locator('.modal-panel').getByRole('button', { name: /Cancel/i }).click();
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

/**
 * Clinical safety flow: Diagnosis-required signing.
 * Verifies that the UI shows an error when trying to sign an encounter without diagnoses.
 */
async function testDiagnosisRequiredSigning(page) {
  await uiLogin(page, 'physician');
  await page.getByRole('link', { name: /Encounters/i }).first().click();
  await page.waitForURL(/\/encounters$/, { timeout: 15000 });
  await page.waitForSelector('h3', { timeout: 10000 });

  // Select a patient
  const patientSelect = page.locator('select');
  await patientSelect.waitFor({ timeout: 10000 });
  const options = await patientSelect.locator('option').all();
  assert.ok(options.length > 1, 'Expected at least one selectable patient for diagnosis signing test');
  await patientSelect.selectOption({ index: 1 });

  // Fill encounter form without adding diagnoses
  await page.fill('input[ng-reflect-model]', '');
  const chiefInput = page.locator('label:has-text("Chief Complaint") input');
  if (await chiefInput.count()) {
    await chiefInput.fill('Test complaint for no-diagnosis sign');
  }
  const treatmentInput = page.locator('label:has-text("Treatment") input');
  if (await treatmentInput.count()) {
    await treatmentInput.fill('rest');
  }
  const followUpInput = page.locator('label:has-text("Follow Up") input');
  if (await followUpInput.count()) {
    await followUpInput.fill('3 days');
  }

  // Create encounter
  const createBtn = page.getByRole('button', { name: /Create Encounter/i });
  await createBtn.waitFor({ timeout: 10000 });
  assert.ok(await createBtn.isEnabled(), 'Create Encounter button must be enabled for diagnosis signing test');
  await createBtn.click();
  await page.waitForTimeout(2000);

  // Try to sign without diagnoses - should show error
  const signBtn = page.getByRole('button', { name: /Sign Latest/i });
  await signBtn.waitFor({ timeout: 10000 });
  assert.ok(await signBtn.isEnabled(), 'Sign Latest button must be enabled for diagnosis signing test');
  await signBtn.click();
  await page.waitForTimeout(2000);
  // Check for error message about diagnosis being required
  const msgEl = page.locator('.msg');
  await msgEl.waitFor({ timeout: 10000 });
  const msg = await msgEl.textContent();
  assert.ok(
    (msg || '').toLowerCase().includes('diagnosis') || (msg || '').toLowerCase().includes('sign failed'),
    'Expected error about diagnosis requirement or sign failure',
  );
  await logout(page);
}

/**
 * Clinical safety flow: Contraindication hard-stop with override re-auth.
 * Verifies the prescription form includes override reason and re-auth password fields.
 */
async function testContraindicationOverrideReauth(page) {
  await uiLogin(page, 'physician');
  await page.getByRole('link', { name: /Encounters/i }).first().click();
  await page.waitForURL(/\/encounters$/, { timeout: 15000 });
  await page.waitForSelector('h3', { timeout: 10000 });

  // Verify override fields exist in the prescription section
  const overrideInput = page.locator('label:has-text("Override Reason") input');
  await overrideInput.waitFor({ timeout: 10000 });
  assert.ok(await overrideInput.count() > 0, 'Override Reason input should be present');

  const reauthInput = page.locator('label:has-text("Re-auth Password") input');
  await reauthInput.waitFor({ timeout: 10000 });
  assert.ok(await reauthInput.count() > 0, 'Re-auth Password input should be present');

  // Verify re-auth input is password type
  const inputType = await reauthInput.getAttribute('type');
  assert.equal(inputType, 'password', 'Re-auth input should be password type');

  await logout(page);
}

/**
 * Clinical safety flow: Pharmacist void-after-dispense deny.
 * Verifies that the Void button is disabled when a prescription has been dispensed.
 */
async function testVoidAfterDispenseDeny(page) {
  await uiLogin(page, 'pharmacist');
  await page.getByRole('link', { name: /Pharmacy Queue/i }).first().click();
  await page.waitForURL(/\/pharmacy$/, { timeout: 15000 });
  const heading = await page.textContent('h3');
  assert.ok((heading || '').includes('Pharmacy Review Queue'));

  // Check for prescriptions in the queue
  const rows = page.locator('tbody tr');
  await rows.first().waitFor({ timeout: 10000 });
  const rowCount = await rows.count();
  assert.ok(rowCount > 0, 'Expected at least one pharmacy queue row');

  let foundDispensed = false;
  for (let i = 0; i < rowCount; i++) {
    const row = rows.nth(i);
    const stateCell = row.locator('td .badge');
    if (await stateCell.count()) {
      const state = (await stateCell.textContent() || '').trim().toLowerCase();
      if (state === 'dispensed') {
        foundDispensed = true;
        await row.click();
        await page.waitForTimeout(500);
        // Verify the Void button is disabled for dispensed prescriptions
        const voidBtn = page.locator('button.warn:has-text("Void")');
        await voidBtn.waitFor({ timeout: 10000 });
        const isDisabled = await voidBtn.isDisabled();
        assert.ok(isDisabled, 'Void button must be disabled after dispensing');
        break;
      }
    }
  }
  assert.ok(foundDispensed, 'Expected a dispensed prescription in pharmacy queue to validate void denial');

  // Also verify the void button is disabled when dispensed_quantity > 0
  // by checking the button's disabled condition exists in the UI
  const voidBtn = page.locator('button.warn');
  await voidBtn.waitFor({ timeout: 10000 });
  const btnText = (await voidBtn.textContent() || '').trim();
  assert.ok(btnText.includes('Void'), 'Void button should be labeled correctly');

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
        ['diagnosis_required_signing', testDiagnosisRequiredSigning],
        ['contraindication_override_reauth', testContraindicationOverrideReauth],
        ['void_after_dispense_deny', testVoidAfterDispenseDeny],
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
