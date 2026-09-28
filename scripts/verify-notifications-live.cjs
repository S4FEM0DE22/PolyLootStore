const assert = require('node:assert/strict');
const { chromium } = require(process.env.POLYLOOT_PLAYWRIGHT_PATH || 'playwright');
const base = process.env.POLYLOOT_VERIFY_URL || 'https://poly-loot-store.vercel.app';
// Credentials remain in memory and are never printed or saved in browser state.
for (const file of ['.env.local', '.env']) { try { process.loadEnvFile(file); } catch (error) { if (error.code !== 'ENOENT') throw error; } }
(async () => {
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  try {
    const context = await browser.newContext();
    const page = await context.newPage(), errors = [];
    page.on('pageerror', error => errors.push(error.message));
    const denied = await context.request.get(base + '/api/notifications');
    assert.equal(denied.status(), 401);
    const adminDenied = await context.request.get(base + '/api/admin/notifications');
    assert.equal(adminDenied.status(), 401);
    assert.ok(process.env.ADMIN_PASSWORD, 'Admin credential unavailable');
    const login = await context.request.post(base + '/api/admin', { headers: { Origin: base }, data: { action: 'login', password: process.env.ADMIN_PASSWORD } });
    assert.equal(login.status(), 200, 'Live admin sign-in failed');
    const response = await context.request.get(base + '/api/admin/notifications?days=7&limit=20');
    assert.equal(response.status(), 200);
    const data = await response.json();
    assert.ok(Array.isArray(data.notifications));
    await page.goto(base + '/admin/', { waitUntil: 'domcontentloaded' });
    await page.locator('#notification-toggle').waitFor();
    await page.locator('#notification-toggle').click();
    await page.locator('.nc-head').waitFor();
    assert.equal(await page.locator('.nc-dropdown .nc-row').count(), data.notifications.length);
    await page.locator('[data-nc-show-all]').click();
    await page.locator('.nc-summary').waitFor();
    await page.waitForFunction(() => document.querySelector('.nc-summary').textContent.includes('รายการ'));
    assert.deepEqual(errors, []);
    // Read-only: do not click a row/read/read-all or mutate real receipts.
    await context.request.post(base + '/api/admin', { headers: { Origin: base }, data: { action: 'logout' } });
    console.log(JSON.stringify({ target: base, customerAnonymous: denied.status(), adminAnonymous: adminDenied.status(), authenticatedFeed: response.status(), dropdown: true, allPage: true, pageErrors: errors.length, realReceiptsChanged: false }));
    await context.close();
  } finally { await browser.close(); }
})().catch(error => { console.error(error.message); process.exitCode = 1; });
