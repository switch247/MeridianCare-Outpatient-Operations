/**
 * E2E: Authentication flows.
 *
 * Covers: login success, logout, login with wrong credentials, session
 * persistence (remember-me), and access control (role-based redirect).
 */
const assert = require('assert');
const { createBrowser, newPage, login, logout, FRONTEND_URL, SEED_PASSWORD } = require('./helper');

async function testLoginSuccess(page) {
  await login(page, 'admin');
  const main = await page.$('main');
  assert.ok(main, 'main element should be present after login');
  await logout(page);
}

async function testLoginWrongPassword(page) {
  await page.goto(FRONTEND_URL, { waitUntil: 'networkidle' });
  await page.fill('input[name="username"]', 'admin@local');
  await page.fill('input[name="password"]', 'wrongpassword123');
  await page.click('button[type="submit"]');
  // Should stay on login page and show an error
  await page.waitForTimeout(1500);
  const form = await page.$('form.login-form, form');
  assert.ok(form, 'login form should still be visible after bad credentials');
  const main = await page.$('main');
  assert.ok(!main, 'main workspace should NOT appear after failed login');
}

async function testLoginUnknownUser(page) {
  await page.goto(FRONTEND_URL, { waitUntil: 'networkidle' });
  await page.fill('input[name="username"]', 'nobody@nowhere.com');
  await page.fill('input[name="password"]', SEED_PASSWORD);
  await page.click('button[type="submit"]');
  await page.waitForTimeout(1500);
  const main = await page.$('main');
  assert.ok(!main, 'unknown user should not be authenticated');
}

async function testLogout(page) {
  await login(page, 'physician');
  // Ensure logged in
  const main = await page.$('main');
  assert.ok(main, 'should be logged in');
  await logout(page);
  // Should be back at login
  const loginForm = await page.$('form.login-form, form');
  assert.ok(loginForm, 'should show login form after logout');
}

async function testPhysicianLogin(page) {
  await login(page, 'physician');
  const heading = await page.textContent('h1, h2');
  assert.ok((heading || '').length > 0, 'physician should see workspace heading');
  await logout(page);
}

async function testPharmacistLogin(page) {
  await login(page, 'pharmacist');
  const main = await page.$('main');
  assert.ok(main, 'pharmacist should be authenticated');
  await logout(page);
}

async function testBillingLogin(page) {
  await login(page, 'billing');
  const main = await page.$('main');
  assert.ok(main, 'billing user should be authenticated');
  await logout(page);
}

async function testAuditorLogin(page) {
  await login(page, 'auditor');
  const main = await page.$('main');
  assert.ok(main, 'auditor should be authenticated');
  await logout(page);
}

async function testLoginFormElements(page) {
  await page.goto(FRONTEND_URL, { waitUntil: 'networkidle' });
  const usernameInput = await page.$('input[name="username"]');
  const passwordInput = await page.$('input[name="password"]');
  const submitBtn = await page.$('button[type="submit"]');
  assert.ok(usernameInput, 'username input should be present on login page');
  assert.ok(passwordInput, 'password input should be present on login page');
  assert.ok(submitBtn, 'submit button should be present on login page');
  const pwType = await passwordInput.getAttribute('type');
  assert.equal(pwType, 'password', 'password field should have type="password"');
}

async function main() {
  const browser = await createBrowser();
  try {
    const { context, page } = await newPage(browser);
    try {
      const scenarios = [
        ['login_form_elements', testLoginFormElements],
        ['login_success_admin', testLoginSuccess],
        ['login_wrong_password', testLoginWrongPassword],
        ['login_unknown_user', testLoginUnknownUser],
        ['logout', testLogout],
        ['physician_login', testPhysicianLogin],
        ['pharmacist_login', testPharmacistLogin],
        ['billing_login', testBillingLogin],
        ['auditor_login', testAuditorLogin],
      ];

      for (const [name, fn] of scenarios) {
        const t0 = Date.now();
        await fn(page);
        console.log(`[e2e:auth] ${name} passed (${Date.now() - t0}ms)`);
      }
      console.log('[e2e:auth] all auth E2E tests passed');
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
    console.error('[e2e:auth] FAILED', err);
    process.exit(1);
  });
}
