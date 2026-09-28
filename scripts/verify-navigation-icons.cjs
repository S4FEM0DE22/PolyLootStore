const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require(process.env.POLYLOOT_PLAYWRIGHT_PATH || 'playwright');
const base = process.env.POLYLOOT_VERIFY_URL || 'http://127.0.0.1:3100';
const output = path.resolve(__dirname, '../.data/navigation-verification');
fs.mkdirSync(output, { recursive: true });

(async () => {
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  try {
    for (const mode of ['customer-light', 'customer-dark', 'customer-tablet', 'customer-mobile', 'admin-light', 'admin-dark', 'admin-tablet', 'admin-mobile', 'admin-desktop-app', 'admin-english']) {
      const admin = mode.startsWith('admin'), mobile = mode.includes('mobile');
      const width = mobile ? 390 : mode.includes('tablet') ? 1024 : 1440;
      const context = await browser.newContext({ viewport: { width, height: 1000 }, ...(mode.includes('desktop-app') ? { userAgent: 'Mozilla/5.0 PolyLootAdminDesktop/1.0.0' } : {}) });
      const page = await context.newPage(), errors = [];
      page.on('pageerror', error => errors.push(error.message));
      await page.addInitScript(preferences => localStorage.setItem('polyloot-display-preferences-v1', JSON.stringify(preferences)), { theme: mode.includes('dark') ? 'dark' : 'light', language: mode.includes('english') ? 'en' : 'th' });
      // UI fixtures only: never change real account data or perform production actions.
      await page.route('**/api/customer?view=session', route => route.fulfill({ json: { user: null } }));
      await page.route('**/api/settings*', route => route.fulfill({ json: { settings: { announcement: '', faq: [] }, preferences: {} } }));
      await page.route('**/api/admin/settings*', route => route.fulfill({ json: { settings: { announcement: '', faq: [] } } }));
      await page.route('**/api/admin?*', route => route.fulfill({ json: new URL(route.request().url()).searchParams.get('view') === 'session' ? { authenticated: true, configured: true } : { assets: [], orders: [], customers: [], tickets: [], emailConfigured: false } }));
      await page.route(/\/api\/(?:admin\/)?notifications(?:\?|$)/, route => route.fulfill({ json: { notifications: [], total: 0, unreadCount: 0, hasMore: false } }));
      await page.goto(base + (admin ? '/admin/' : '/'), { waitUntil: 'domcontentloaded' });
      await page.locator(admin ? '.admin-workspace' : '.home-hero').waitFor();
      if (mobile) await page.locator(admin ? '#admin-menu-toggle' : '#mobile-menu-toggle').click();
      const icons = page.locator(admin ? '.admin-nav .menu-icon' : '.nav-pills > a .menu-icon');
      assert.equal(await icons.count(), admin ? mode.includes('desktop-app') ? 8 : 9 : 4);
      await page.waitForFunction(selector => [...document.querySelectorAll(selector)].every(svg => svg.getBBox().width > 0 && svg.getBBox().height > 0), admin ? '.admin-nav .menu-icon' : '.nav-pills > a .menu-icon');
      for (const icon of await icons.all()) {
        assert.equal(await icon.getAttribute('aria-hidden'), 'true');
        const box = await icon.boundingBox();
        assert.ok(box && box.width === 20 && box.height === 20 && box.x >= 0 && box.x + box.width <= width);
      }
      if (admin) {
        assert.equal(await page.locator('.admin-topbar [data-action="refresh"] .menu-icon').count(), 1);
        assert.equal(await page.locator('.admin-nav .nav-bottom a[href="/"]').count(), mode.includes('desktop-app') ? 0 : 1);
        for (const view of ['orders', 'assets', 'customers', 'support', 'alerts', 'settings', 'overview']) {
          if (mobile && await page.locator('#admin-menu-toggle').getAttribute('aria-expanded') === 'false') await page.locator('#admin-menu-toggle').click();
          await page.locator(`.admin-nav [data-view="${view}"]`).click({ position: { x: 22, y: 22 } });
          await page.locator(`.admin-nav [data-view="${view}"].active`).waitFor({ state: 'attached' });
          assert.equal(await page.locator(`.admin-nav [data-view="${view}"] .menu-icon`).count(), 1);
        }
        if (mobile) await page.locator('#admin-menu-toggle').click();
      } else {
        await page.locator('.nav-pills [data-nav="catalog"]').click({ position: { x: 22, y: 22 } });
        await page.waitForURL('**/#catalog');
        if (mobile) await page.locator('#mobile-menu-toggle').click();
      }
      await page.screenshot({ path: path.join(output, mode + '.png'), fullPage: false });
      assert.deepEqual(errors, []);
      console.log(JSON.stringify({ mode, icons: await icons.count(), visibleSVG: true, menuClicks: true, runtimeErrors: 0 }));
      await context.close();
    }
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
