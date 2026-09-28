const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require(process.env.POLYLOOT_PLAYWRIGHT_PATH || 'playwright');
const base = process.env.POLYLOOT_VERIFY_URL || 'http://127.0.0.1:3100';
const output = path.resolve(__dirname, '../.data/mobile-menu-verification');
fs.mkdirSync(output, { recursive: true });
const cases = (process.env.POLYLOOT_REPRODUCE ? [false] : [false, true]).flatMap(signedIn =>
  ['light', 'dark'].flatMap(theme => [390, 560, 800].map(width => ({ signedIn, theme, width }))));

(async () => {
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  try {
    for (const { signedIn, theme, width } of cases) {
        const context = await browser.newContext({ viewport: { width, height: 844 } });
        const page = await context.newPage(), errors = [];
        page.on('pageerror', error => errors.push(error.message));
        await page.addInitScript(theme => localStorage.setItem('polyloot-display-preferences-v1', JSON.stringify({ theme, language: 'th' })), theme);
        await page.route('**/api/customer?view=session', route => route.fulfill({ json: { user: signedIn ? { username: 'menu_test', email: 'menu@example.test', name: 'Menu Test', firstName: 'Menu', lastName: 'Test' } : null } }));
        await page.route('**/api/customer?view=orders', route => route.fulfill({ json: { orders: [] } }));
        await page.route('**/api/support*', route => route.fulfill({ json: { tickets: [] } }));
        await page.route('**/api/notifications*', route => route.fulfill({ json: { notifications: [], total: 0, unreadCount: 0, hasMore: false } }));
        await page.route('**/api/settings*', route => route.fulfill({ json: { settings: { announcement: '', faq: [] }, preferences: { theme, language: 'th', notify_orders: true, notify_support: true, notify_announcements: true } } }));
        await page.goto(base, { waitUntil: 'domcontentloaded' });
        await page.locator('.home-hero').waitFor();
        await page.locator('#mobile-menu-toggle').click();
        await page.locator('#nav-auth-action').click();
        if (signedIn) {
          await page.locator('#profile-form').waitFor();
          assert.equal(await page.locator('#mobile-nav').isVisible(), false);
        }
        await page.locator(signedIn ? '#profile-form' : '#auth-form').waitFor();
        const loginMenu = { expanded: await page.locator('#mobile-menu-toggle').getAttribute('aria-expanded'), visible: await page.locator('#mobile-nav').isVisible() };
        if (process.env.POLYLOOT_REPRODUCE) {
          console.log(JSON.stringify({ theme, width, loginMenu }));
          await page.screenshot({ path: path.join(output, `before-${theme}-${width}.png`) });
          await context.close();
          continue;
        }
        assert.deepEqual(loginMenu, { expanded: 'false', visible: false });
        const routes = ['login', 'register', 'forgot-password', 'reset-password', 'home', 'catalog', 'cart', 'track', 'help', 'settings', 'library', 'profile', 'history', 'notifications', 'unknown-page'];
        for (const route of routes) {
          if (await page.evaluate(route => location.hash === '#' + route, route)) {
            await page.evaluate(() => { location.hash = '#catalog'; });
            await page.waitForFunction(() => document.querySelector('.nav-pills [data-nav="catalog"]').classList.contains('active'));
          }
          await page.locator('#mobile-menu-toggle').click();
          assert.equal(await page.locator('#mobile-nav').isVisible(), true);
          const box = await page.locator('#mobile-nav').boundingBox();
          assert.ok(box.x >= 0 && box.x + box.width <= width + 1);
          const header = await page.locator('.site-header').boundingBox();
          assert.ok(Math.abs(box.width - header.width) <= 2);
          // Hash navigation also covers browser back, protected pages and in-content links.
          await page.evaluate(route => { location.hash = route; }, route);
          await page.waitForFunction(() => document.querySelector('#mobile-menu-toggle').getAttribute('aria-expanded') === 'false');
          assert.equal(await page.locator('#mobile-nav').isVisible(), false, `${theme}/${width}/${route}`);
        }
        await page.evaluate(() => { location.hash = '#login'; });
        await page.locator(signedIn ? '#profile-form' : '#auth-form').waitFor();
        await page.locator('#mobile-menu-toggle').click();
        await page.locator('#settings-menu-toggle').click();
        await page.locator('.settings-shortcut[href="#help"]').click();
        await page.waitForURL('**/#help');
        assert.equal(await page.locator('#mobile-nav').isVisible(), false);
        assert.equal(await page.locator('#settings-dropdown').isVisible(), false);
        await page.locator('#mobile-menu-toggle').click();
        await page.keyboard.press('Escape');
        assert.equal(await page.locator('#mobile-nav').isVisible(), false);
        assert.equal(await page.locator('#mobile-menu-toggle').evaluate(node => node === document.activeElement), true);
        await page.locator('#mobile-menu-toggle').click();
        await page.locator('#mobile-menu-toggle').click();
        assert.equal(await page.locator('#mobile-nav').isVisible(), false);
        await page.locator('#mobile-menu-toggle').click();
        await page.mouse.click(3, 150);
        assert.equal(await page.locator('#mobile-nav').isVisible(), false);
        await page.locator('#mobile-menu-toggle').click();
        await page.locator('.nav-pills [data-nav="catalog"]').click();
        await page.waitForURL('**/#catalog');
        assert.equal(await page.locator('#mobile-nav').isVisible(), false);
        await page.goBack();
        await page.waitForURL('**/#help');
        assert.equal(await page.locator('#mobile-nav').isVisible(), false);
        await page.evaluate(() => { location.hash = '#login'; });
        await page.locator(signedIn ? '#profile-form' : '#auth-form').waitFor();
        await page.screenshot({ path: path.join(output, `after-${signedIn ? 'account' : 'guest'}-${theme}-${width}.png`) });
        await page.setViewportSize({ width: 1440, height: 1000 });
        assert.equal(await page.locator('#mobile-nav').isVisible(), true);
        await page.setViewportSize({ width, height: 844 });
        assert.equal(await page.locator('#mobile-nav').isVisible(), false);
        assert.deepEqual(errors, []);
        console.log(JSON.stringify({ signedIn, theme, width, routeCases: routes.length, login: true, settingsShortcut: true, escape: true, outsideClick: true, browserBack: true, resize: true, pageErrors: 0 }));
        await context.close();
    }
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
