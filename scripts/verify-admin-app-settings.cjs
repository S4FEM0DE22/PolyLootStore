// Actual admin module, guest session fixture. No production login or mutations.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require(process.env.POLYLOOT_PLAYWRIGHT_PATH || 'playwright');
const root = path.resolve(__dirname, '..');
const css = ['app/theme.css', 'app/admin/admin.css', 'app/dark.css', 'app/navigation-icons.css'].map(file => fs.readFileSync(path.join(root, file), 'utf8').replace(/@import[^;]+;/g, '')).join('\n');
(async () => {
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  const results = [];
  try {
    for (const mode of ['web', 'desktop']) for (const width of [390, 1440]) {
      const context = await browser.newContext({ viewport: { width, height: 900 }, colorScheme: 'light', ...(mode === 'desktop' ? { userAgent: 'Mozilla/5.0 PolyLootAdminDesktop/1.0' } : {}) });
      const page = await context.newPage();
      const errors = [], apiCalls = [];
      page.on('pageerror', error => errors.push(error.message));
      await page.route('http://polyloot-admin.test/**', async route => {
        const url = new URL(route.request().url());
        if (url.pathname === '/admin/') return route.fulfill({ contentType: 'text/html', body: `<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><style>${css}</style></head><body><div id="app"></div><script type="module" src="/legacy/admin.js"></script></body></html>` });
        if (url.pathname.startsWith('/api/')) {
          apiCalls.push({ path: url.pathname + url.search, method: route.request().method() });
          if (url.pathname === '/api/admin' && url.search === '?view=session') return route.fulfill({ contentType: 'application/json', body: JSON.stringify({ authenticated: false, configured: true }) });
          return route.fulfill({ status: 401, contentType: 'application/json', body: '{"error":"unauthorized"}' });
        }
        const filename = path.resolve(root, 'public', '.' + url.pathname);
        if (filename.startsWith(path.join(root, 'public') + path.sep) && fs.existsSync(filename) && fs.statSync(filename).isFile()) return route.fulfill({ path: filename, contentType: filename.endsWith('.js') ? 'text/javascript' : undefined });
        return route.fulfill({ status: 404, body: '' });
      });
      await page.goto('http://polyloot-admin.test/admin/');
      await page.locator('#password').fill('fixture-draft-not-a-real-password');
      await page.locator('.admin-app-settings summary').focus();
      await page.keyboard.press('Enter');
      await page.locator('#guest-admin-theme').selectOption('dark');
      assert.equal(await page.locator('html').getAttribute('data-theme'), 'dark');
      assert.equal(await page.locator('.theme-logo-dark').isVisible(), true);
      await page.locator('#guest-admin-language').selectOption('en');
      assert.equal(await page.locator('html').getAttribute('lang'), 'en');
      assert.equal(await page.locator('.admin-app-settings summary').innerText(), 'App settings');
      assert.equal(await page.locator('#password').inputValue(), 'fixture-draft-not-a-real-password');
      await page.reload();
      assert.equal(await page.locator('html').getAttribute('data-theme'), 'dark');
      await page.locator('.admin-app-settings summary').click();
      assert.equal(await page.locator('#guest-admin-theme').inputValue(), 'dark');
      assert.equal(await page.locator('#guest-admin-language').inputValue(), 'en');
      await page.locator('#guest-admin-language').selectOption('th');
      assert.equal(await page.locator('.admin-app-settings summary').innerText(), 'ตั้งค่าแอป');
      await page.locator('#guest-admin-theme').selectOption('system');
      await page.emulateMedia({ colorScheme: 'dark' });
      await page.waitForFunction(() => document.documentElement.dataset.theme === 'dark');
      assert.equal(await page.locator('html').getAttribute('data-theme'), 'dark');
      await page.emulateMedia({ colorScheme: 'light' });
      await page.waitForFunction(() => document.documentElement.dataset.theme === 'light');
      assert.equal(await page.locator('html').getAttribute('data-theme'), 'light');
      assert.equal(await page.locator('.admin-workspace,#store-settings-form').count(), 0);
      assert.equal(await page.locator('a[href="/"]').count() > 0, mode === 'web');
      assert.ok(apiCalls.every(call => call.path === '/api/admin?view=session' && call.method === 'GET'), 'guest appearance must not access private APIs');
      assert.deepEqual(errors, []);
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'no horizontal overflow');
      const output = path.join(root, '.data/live-verification');
      fs.mkdirSync(output, { recursive: true });
      await page.screenshot({ path: path.join(output, `admin-guest-settings-${mode}-${width}.png`), fullPage: true });
      results.push({ mode, width, passed: true });
      await context.close();
    }
    console.log(JSON.stringify({ browser: 'Edge', api: 'guest fixtures', results }, null, 2));
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
