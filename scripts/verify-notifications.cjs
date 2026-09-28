const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require(process.env.POLYLOOT_PLAYWRIGHT_PATH || 'playwright');
const base = process.env.POLYLOOT_VERIFY_URL || 'http://127.0.0.1:3100';
const output = path.resolve(__dirname, '../.data/notification-verification');
fs.mkdirSync(output, { recursive: true });
const preferences = { theme: 'light', language: 'th', notify_orders: true, notify_support: true, notify_announcements: true };
const fixture = () => Array.from({ length: 28 }, (_, i) => ({ id: 'fixture-' + i, type: i % 2 ? 'order' : 'support', status: i % 2 ? 'PAID' : 'OPEN', title: 'รับคำร้องแล้ว', detail: i === 27 ? 'OLDER_THAN_7_DAYS' : 'Reference ' + i, createdAt: new Date(Date.now() - (i === 27 ? 8 * 86400000 : i * 60000)).toISOString(), read: false, href: i % 2 ? '#history' : '#help' }));
(async () => {
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  const results = [];
  try {
    for (const mode of (process.env.POLYLOOT_VERIFY_MODE ? [process.env.POLYLOOT_VERIFY_MODE] : ['customer-light', 'customer-dark', 'customer-mobile', 'admin-light', 'admin-dark', 'admin-mobile'])) {
      const admin = mode.startsWith('admin'), mobile = mode.includes('mobile'), dark = mode.includes('dark');
      const context = await browser.newContext({ viewport: mobile ? { width: 390, height: 844 } : { width: 1440, height: 1000 } });
      let rows = fixture(), fail = false, expire = false;
      const page = await context.newPage(), errors = [];
      page.on('pageerror', error => errors.push(error.message));
      await page.addInitScript(theme => localStorage.setItem('polyloot-display-preferences-v1', JSON.stringify({ theme, language: 'th' })), dark ? 'dark' : 'light');
      // Only the UI uses fixture responses; no real account, read receipts or emails are changed.
      await page.route('**/api/customer?view=session', route => route.fulfill({ json: { user: { email: 'ui@example.test', username: 'ui_test', name: 'UI Test' } } }));
      await page.route('**/api/settings*', route => route.fulfill({ json: { settings: { announcement: '', faq: [] }, preferences, notifications: [] } }));
      await page.route('**/api/support*', route => route.fulfill({ json: { tickets: [] } }));
      await page.route('**/api/orders*', route => route.fulfill({ json: { orders: [] } }));
      await page.route('**/api/admin?*', route => {
        const view = new URL(route.request().url()).searchParams.get('view');
        return route.fulfill({ json: view === 'session' ? { authenticated: true, configured: true } : { assets: [], orders: [], customers: [], tickets: [], emailConfigured: false } });
      });
      await page.route(/\/api\/(?:admin\/)?notifications(?:\?|$)/, async route => {
        if (expire) { await route.fulfill({ status: 401, json: { error: 'Session expired' } }); return; }
        if (fail) { fail = false; await route.fulfill({ status: 503, json: { error: 'TEST_RETRY_MESSAGE' } }); return; }
        if (route.request().method() === 'POST') {
          const input = route.request().postDataJSON();
          rows = rows.map(item => input.action === 'mark-all-read' || item.id === input.id ? { ...item, read: true } : item);
          await route.fulfill({ json: { success: true } }); return;
        }
        const params = new URL(route.request().url()).searchParams;
        const filtered = rows.filter(item => (!params.get('days') || Date.parse(item.createdAt) >= Date.now() - 7 * 86400000) && (params.get('filter') !== 'unread' || !item.read) && (!params.get('type') || item.type === params.get('type')));
        const offset = Number(params.get('offset') || 0), limit = Number(params.get('limit') || 20);
        await route.fulfill({ json: { notifications: filtered.slice(offset, offset + limit).map(item => ({ ...item, href: admin ? (item.type === 'order' ? 'orders' : 'support') : item.href })), total: filtered.length, unreadCount: rows.filter(item => !item.read).length, hasMore: offset + limit < filtered.length, fetchedAt: new Date().toISOString() } });
      });
      await page.goto(base + (admin ? '/admin/' : '/'), { waitUntil: 'domcontentloaded' });
      await page.waitForFunction(() => !document.querySelector('#app > .loading,#app > .boot'));
      await page.locator('#notification-toggle').waitFor({ state: 'attached' });
      if (mobile && !admin) await page.locator('#mobile-menu-toggle').click();
      await page.locator('#notification-toggle').click();
      try { await page.locator('.nc-dropdown .nc-row').first().waitFor({ timeout: 15000 }); }
      catch (error) {
        console.log(JSON.stringify({ mode, errors, dropdown: await page.locator('#notification-dropdown').innerHTML(), app: (await page.locator('#app').textContent()).slice(0, 400) }));
        await page.screenshot({ path: path.join(output, mode + '-failure.png'), fullPage: true });
        throw error;
      }
      assert.equal(await page.locator('.nc-dropdown .nc-row').count(), 20);
      assert.equal(await page.locator('.nc-dropdown').getByText('OLDER_THAN_7_DAYS').count(), 0);
      assert.ok((await page.locator('.nc-head').textContent()).includes('27'));
      await page.screenshot({ path: path.join(output, mode + '-dropdown.png'), fullPage: true });
      const box = await page.locator('#notification-dropdown').boundingBox();
      assert.ok(box.x >= 0 && box.x + box.width <= (mobile ? 390 : 1440));
      await page.locator('[data-nc-read]').first().click();
      await page.waitForFunction(() => document.querySelector('#notification-count').textContent === '27');
      await page.keyboard.press('Escape');
      assert.equal(await page.locator('#notification-toggle').getAttribute('aria-expanded'), 'false');
      assert.equal(await page.locator('#notification-toggle').evaluate(node => node === document.activeElement), true);
      await page.locator('#notification-toggle').click();
      await page.locator('[data-nc-show-all]').click();
      await page.locator('.nc-page .nc-row').first().waitFor();
      await page.locator('[data-nc-more]').click();
      await page.locator('.nc-page').getByText('OLDER_THAN_7_DAYS', { exact: true }).waitFor();
      assert.equal(await page.locator('.nc-page .nc-row').count(), 28);
      await page.locator('[data-nc-filter="filter"]').selectOption('unread');
      await page.waitForFunction(() => document.querySelector('.nc-summary')?.textContent.startsWith('27 '));
      await page.locator('[data-nc-filter="type"]').selectOption('order');
      await page.waitForFunction(() => document.querySelector('.nc-summary')?.textContent.startsWith('14 '));
      fail = true;
      await page.locator('[data-nc-retry="page"]').click();
      await page.getByText('TEST_RETRY_MESSAGE').waitFor();
      await page.locator('.nc-empty [data-nc-retry]').click();
      await page.locator('.nc-page .nc-row').first().waitFor();
      await page.locator('.nc-page [data-nc-all]').click();
      await page.waitForFunction(() => document.querySelector('#notification-count').hidden);
      await page.locator('[data-nc-filter="filter"]').selectOption('all');
      await page.locator('.nc-page .nc-row').first().waitFor();
      await page.screenshot({ path: path.join(output, mode + '-all.png'), fullPage: true });
      await page.locator('[data-nc-filter="type"]').selectOption('support');
      await page.locator('.nc-page .nc-row').first().waitFor();
      await page.locator('.nc-page [data-nc-open]').first().click();
      if (admin) await page.locator('.admin-topbar h1').filter({ hasText: 'คำร้องลูกค้า' }).waitFor();
      else await page.waitForURL('**/#help');
      rows.push({ ...fixture()[0], id: 'new-update', detail: 'New live update', createdAt: new Date().toISOString() });
      await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')));
      await page.waitForFunction(() => document.querySelector('#notification-count').textContent === '1' && !document.querySelector('#notification-count').hidden);
      if (mobile && !admin) await page.locator('#mobile-menu-toggle').click();
      expire = true;
      await page.locator('#notification-toggle').click();
      await page.locator(admin ? '#login-form' : '#auth-form').waitFor();
      assert.equal(await page.locator('.nc-page').count(), 0);
      if (!admin) assert.equal(await page.locator('#notification-dropdown').textContent(), '');
      assert.deepEqual(errors, []);
      results.push({ mode, dropdownDays: 7, allHistory: 28, markRead: true, filters: true, retry: true, markAll: true, keyboard: true, openRelatedPage: true, newUpdate: true, sessionExpiry: true, pageErrors: errors.length });
      await context.close();
    }
    console.log(JSON.stringify(results, null, 2));
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
