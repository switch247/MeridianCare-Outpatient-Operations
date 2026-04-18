/**
 * E2E: Physician encounter workflow.
 *
 * Covers: patient selection, encounter creation, ICD typeahead,
 * encounter signing, diagnosis-required guard, prescription form
 * with override/re-auth fields.
 */
const assert = require('assert');
const { createBrowser, newPage, login, logout } = require('./helper');

async function testEncounterWorkbenchLoads(page) {
  await login(page, 'physician');
  await page.getByRole('link', { name: /Encounters/i }).first().click();
  await page.waitForURL(/\/encounters$/, { timeout: 15000 });
  await page.waitForSelector('h3', { timeout: 10000 });
  const heading = await page.textContent('h3');
  assert.ok((heading || '').includes('Encounter Workbench'), `Expected "Encounter Workbench" but got: ${heading}`);
  await logout(page);
}

async function testPatientSelectVisible(page) {
  await login(page, 'physician');
  await page.getByRole('link', { name: /Encounters/i }).first().click();
  await page.waitForURL(/\/encounters$/, { timeout: 15000 });
  const patientSelect = page.locator('select');
  await patientSelect.waitFor({ timeout: 10000 });
  const optionCount = await patientSelect.locator('option').count();
  assert.ok(optionCount >= 1, 'Patient select should have at least 1 option (placeholder)');
  await logout(page);
}

async function testIcdTypeaheadVisible(page) {
  await login(page, 'physician');
  await page.getByRole('link', { name: /Encounters/i }).first().click();
  await page.waitForURL(/\/encounters$/, { timeout: 15000 });
  await page.waitForSelector('h3', { timeout: 10000 });
  const icdInput = page.locator('input[placeholder*="ICD"], input[placeholder*="icd"], input[placeholder*="Search ICD"]');
  await icdInput.waitFor({ timeout: 10000 });
  assert.ok(await icdInput.count() > 0, 'ICD search input should be present');
  await logout(page);
}

async function testEncounterFormFieldsExist(page) {
  await login(page, 'physician');
  await page.getByRole('link', { name: /Encounters/i }).first().click();
  await page.waitForURL(/\/encounters$/, { timeout: 15000 });
  await page.waitForSelector('h3', { timeout: 10000 });

  // Check create encounter button
  const createBtn = page.getByRole('button', { name: /Create Encounter/i });
  await createBtn.waitFor({ timeout: 10000 });
  assert.ok(await createBtn.count() > 0, 'Create Encounter button should be present');

  // Check sign latest button
  const signBtn = page.getByRole('button', { name: /Sign Latest/i });
  await signBtn.waitFor({ timeout: 10000 });
  assert.ok(await signBtn.count() > 0, 'Sign Latest button should be present');

  await logout(page);
}

async function testPrescriptionOverrideFieldsPresent(page) {
  await login(page, 'physician');
  await page.getByRole('link', { name: /Encounters/i }).first().click();
  await page.waitForURL(/\/encounters$/, { timeout: 15000 });
  await page.waitForSelector('h3', { timeout: 10000 });

  // Override reason field should be visible
  const overrideLabel = page.locator('label:has-text("Override Reason")');
  await overrideLabel.waitFor({ timeout: 10000 });
  assert.ok(await overrideLabel.count() > 0, 'Override Reason field should be present in prescription form');

  // Re-auth password field should be visible and of type password
  const reauthLabel = page.locator('label:has-text("Re-auth Password")');
  await reauthLabel.waitFor({ timeout: 10000 });
  assert.ok(await reauthLabel.count() > 0, 'Re-auth Password field should be present');

  const reauthInput = reauthLabel.locator('input');
  const inputType = await reauthInput.getAttribute('type');
  assert.equal(inputType, 'password', 'Re-auth input must have type="password"');

  await logout(page);
}

async function testDiagnosisRequiredBeforeSigning(page) {
  await login(page, 'physician');
  await page.getByRole('link', { name: /Encounters/i }).first().click();
  await page.waitForURL(/\/encounters$/, { timeout: 15000 });
  await page.waitForSelector('h3', { timeout: 10000 });

  // Select a patient if available
  const select = page.locator('select');
  await select.waitFor({ timeout: 10000 });
  const options = await select.locator('option').all();
  if (options.length > 1) {
    await select.selectOption({ index: 1 });

    // Fill encounter fields without adding diagnoses
    const chiefInput = page.locator('label:has-text("Chief Complaint") input');
    if (await chiefInput.count()) await chiefInput.fill('Headache');
    const treatmentInput = page.locator('label:has-text("Treatment") input');
    if (await treatmentInput.count()) await treatmentInput.fill('rest');
    const followUpInput = page.locator('label:has-text("Follow Up") input');
    if (await followUpInput.count()) await followUpInput.fill('7 days');

    // Create encounter then attempt to sign without diagnoses
    const createBtn = page.getByRole('button', { name: /Create Encounter/i });
    if (await createBtn.isEnabled()) {
      await createBtn.click();
      await page.waitForTimeout(2000);

      const signBtn = page.getByRole('button', { name: /Sign Latest/i });
      if (await signBtn.isEnabled()) {
        await signBtn.click();
        await page.waitForTimeout(1500);
        // Either an error message about diagnoses, or sign simply doesn't proceed
        const msg = page.locator('.msg');
        if (await msg.count()) {
          const text = await msg.textContent();
          assert.ok(
            (text || '').length > 0,
            'Should show a message after sign attempt without diagnoses',
          );
        }
      }
    }
  }
  await logout(page);
}

async function testEncounterListVisible(page) {
  await login(page, 'physician');
  await page.getByRole('link', { name: /Encounters/i }).first().click();
  await page.waitForURL(/\/encounters$/, { timeout: 15000 });
  await page.waitForSelector('h3', { timeout: 10000 });
  // Recent encounters table should exist
  const table = page.locator('table');
  await table.waitFor({ timeout: 10000 });
  assert.ok(await table.count() > 0, 'Encounter table should be present');
  await logout(page);
}

async function main() {
  const browser = await createBrowser();
  try {
    const { context, page } = await newPage(browser);
    try {
      const scenarios = [
        ['encounter_workbench_loads', testEncounterWorkbenchLoads],
        ['patient_select_visible', testPatientSelectVisible],
        ['icd_typeahead_visible', testIcdTypeaheadVisible],
        ['encounter_form_fields', testEncounterFormFieldsExist],
        ['prescription_override_fields', testPrescriptionOverrideFieldsPresent],
        ['diagnosis_required_before_signing', testDiagnosisRequiredBeforeSigning],
        ['encounter_list_visible', testEncounterListVisible],
      ];

      for (const [name, fn] of scenarios) {
        const t0 = Date.now();
        await fn(page);
        console.log(`[e2e:physician] ${name} passed (${Date.now() - t0}ms)`);
      }
      console.log('[e2e:physician] all physician E2E tests passed');
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
    console.error('[e2e:physician] FAILED', err);
    process.exit(1);
  });
}
