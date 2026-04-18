const assert = require('assert');
const { chromium } = require('playwright-core');

const frontendUrl = process.env.E2E_FRONTEND_URL || 'http://localhost:4200';
const apiBaseUrl = process.env.API_BASE_URL || 'http://localhost:3000';
const seedPassword = process.env.SEED_PASSWORD || 'Password!123';
const chromiumPath =
  process.env.PLAYWRIGHT_CHROMIUM_PATH ||
  process.env.CHROME_BIN ||
  (process.platform === 'win32' 
    ? 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'
    : process.platform === 'darwin'
    ? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
    : '/usr/bin/chromium-browser');

const seededUsers = {
  physician: 'physician@local',
  pharmacist: 'pharmacist@local',
  billing: 'billing@local',
  inventory: 'inventory@local',
  admin: 'admin@local',
  auditor: 'auditor@local',
};

async function createBrowser() {
  return chromium.launch({
    headless: true,
    executablePath: chromiumPath,
    args: [
      '--no-sandbox',
      '--disable-dev-shm-usage',
      '--disable-gpu',
      '--disable-web-security',
      '--disable-site-isolation-trials',
    ],
  });
}

async function newPage(browser) {
  const context = await browser.newContext();
  await context.addInitScript((base) => {
    window.API_BASE_URL = base;
  }, apiBaseUrl);
  const page = await context.newPage();
  return { context, page };
}

async function uiLogin(page, role) {
  const username = seededUsers[role];
  assert.ok(username, `Unknown role for uiLogin: ${role}`);
  await page.goto(frontendUrl, { waitUntil: 'networkidle' });
  await page.fill('input[name="username"]', username);
  await page.fill('input[name="password"]', seedPassword);
  await page.click('button[type="submit"]');
  // Wait for either main (success) or .status (login error)
  const result = await Promise.race([
    page.waitForSelector('main', { timeout: 20000 }).then(() => 'main'),
    page.waitForSelector('.status', { timeout: 20000 }).then(() => 'status'),
  ]);
  if (result === 'status') {
    const msg = await page.textContent('.status');
    throw new Error('Login failed: ' + (msg || 'Unknown error'));
  }
}

async function logout(page) {
  const signOut = page.getByRole('button', { name: /Sign Out/i });
  if (await signOut.count()) {
    await signOut.click();
    await page.waitForSelector('form.login-form', { timeout: 10000 });
  }
}

function roleLabel(role) {
  return role.charAt(0).toUpperCase() + role.slice(1);
}

module.exports = {
  frontendUrl,
  apiBaseUrl,
  createBrowser,
  newPage,
  uiLogin,
  logout,
  roleLabel,
};
