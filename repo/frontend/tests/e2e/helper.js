/**
 * Shared helpers for E2E tests in frontend/tests/e2e/.
 *
 * Uses playwright-core directly (no @playwright/test runner required).
 * The browser executable is resolved from environment variables or
 * well-known paths for Linux (Docker), macOS, and Windows.
 */
const assert = require('assert');
const { chromium } = require('playwright-core');

const FRONTEND_URL = process.env.E2E_FRONTEND_URL || process.env.FRONTEND_URL || 'http://localhost:4200';
const API_BASE_URL = process.env.API_BASE_URL || 'http://localhost:3000';
const SEED_PASSWORD = process.env.SEED_PASSWORD || 'Password!123';

const CHROMIUM_PATH =
  process.env.PLAYWRIGHT_CHROMIUM_PATH ||
  process.env.CHROME_BIN ||
  (process.platform === 'win32'
    ? 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'
    : process.platform === 'darwin'
    ? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
    : '/usr/bin/chromium-browser');

const SEEDED_USERS = {
  physician:  'physician@local',
  pharmacist: 'pharmacist@local',
  billing:    'billing@local',
  inventory:  'inventory@local',
  admin:      'admin@local',
  auditor:    'auditor@local',
};

async function createBrowser() {
  return chromium.launch({
    headless: true,
    executablePath: CHROMIUM_PATH,
    args: ['--no-sandbox', '--disable-dev-shm-usage', '--disable-gpu'],
  });
}

async function newContext(browser) {
  const context = await browser.newContext();
  await context.addInitScript((base) => {
    window.API_BASE_URL = base;
  }, API_BASE_URL);
  return context;
}

async function newPage(browser) {
  const context = await newContext(browser);
  const page = await context.newPage();
  return { context, page };
}

async function login(page, role) {
  const username = SEEDED_USERS[role];
  assert.ok(username, `Unknown role: ${role}`);
  await page.goto(FRONTEND_URL, { waitUntil: 'networkidle' });
  await page.fill('input[name="username"]', username);
  await page.fill('input[name="password"]', SEED_PASSWORD);
  await page.click('button[type="submit"]');
  await page.waitForSelector('main', { timeout: 20000 });
}

async function logout(page) {
  const btn = page.getByRole('button', { name: /Sign Out/i });
  if (await btn.count()) {
    await btn.click();
    await page.waitForSelector('form.login-form', { timeout: 10000 });
  }
}

async function navigateTo(page, linkPattern) {
  await page.getByRole('link', { name: linkPattern }).first().click();
}

module.exports = {
  FRONTEND_URL,
  API_BASE_URL,
  SEED_PASSWORD,
  SEEDED_USERS,
  createBrowser,
  newContext,
  newPage,
  login,
  logout,
  navigateTo,
};
