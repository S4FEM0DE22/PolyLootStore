// Actual storefront DOM/modules in Edge, with isolated API fixtures (not provider E2E).
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');
const { chromium } = require(process.env.POLYLOOT_PLAYWRIGHT_PATH || 'playwright');
const root = path.resolve(__dirname, '..');
const compiled = ts.transpileModule(fs.readFileSync(path.join(root, 'app/page.tsx'), 'utf8'), {
  compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.CommonJS }
}).outputText;
const storeModule = { exports: {} };
vm.runInThisContext(`(function(require,module,exports){${compiled}\n})`)((name) => {
  if (name.endsWith('.css')) return {};
  if (name === 'next/script') return { default: ({ src, type }) => React.createElement('script', { src, type }) };
  return require(name);
}, storeModule, storeModule.exports);
const css = ['theme', 'store', 'dark', 'navigation-icons'].map(name => fs.readFileSync(path.join(root, `app/${name}.css`), 'utf8')).join('\n');
const html = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>${css}</style></head><body>${renderToStaticMarkup(React.createElement(storeModule.exports.default))}</body></html>`;
const user = { id: 'fixture', email: 'session-fixture@example.test', username: 'session_fixture', name: 'Session Fixture', firstName: 'Session', lastName: 'Fixture' };
const deferred = () => { let resolve; const promise = new Promise(r => { resolve = r; }); return { promise, resolve }; };

(async () => {
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  const results = [];
  async function scenario(name, { initialUser = null, slowCatalog = false, staleGuest = false } = {}, check) {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const page = await context.newPage();
    const catalogGate = deferred(), guestGate = deferred();
    let account = initialUser, sessions = 0, documents = 0;
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.route('http://polyloot-session.test/**', async route => {
      const url = new URL(route.request().url());
      const json = data => route.fulfill({ contentType: 'application/json', body: JSON.stringify(data) });
      if (url.pathname === '/') { documents++; return route.fulfill({ contentType: 'text/html', body: html }); }
      if (url.pathname === '/api/customer') {
        if (url.searchParams.get('view') === 'session') {
          sessions++;
          if (staleGuest && sessions === 1) { await guestGate.promise; return json({ user: null }); }
          return json({ user: account });
        }
        account = null; return json({ user: null });
      }
      if (url.pathname === '/api/assets') { if (slowCatalog) await catalogGate.promise; return json({ assets: [] }); }
      if (url.pathname === '/api/settings') return json({ settings: {}, preferences: { theme: 'light', language: 'th' } });
      if (url.pathname === '/api/notifications') return json({ notifications: [], unreadCount: 0, total: 0, hasMore: false });
      const filename = path.resolve(root, 'public', '.' + decodeURIComponent(url.pathname));
      const publicRoot = path.join(root, 'public') + path.sep;
      if (filename.startsWith(publicRoot) && fs.existsSync(filename) && fs.statSync(filename).isFile()) {
        const ext = path.extname(filename);
        return route.fulfill({ path: filename, contentType: ext === '.js' ? 'text/javascript' : ext === '.svg' ? 'image/svg+xml' : undefined });
      }
      return route.fulfill({ status: 404, body: '' });
    });
    try {
      await page.goto('http://polyloot-session.test/#' + (initialUser ? 'profile' : 'login'), { waitUntil: 'commit' });
      await page.waitForFunction(() => typeof window.polylootAuthReturn === 'function');
      await check({ page, login: () => { account = user; }, catalogGate, guestGate, sessionCount: () => sessions });
      assert.equal(documents, 1, 'session transition must not reload document');
      assert.deepEqual(errors, [], 'no storefront JavaScript errors');
      results.push({ name, passed: true });
    } finally { catalogGate.resolve(); guestGate.resolve(); await context.close(); }
  }
  try {
    await scenario('warm OAuth return shows verified account without reopening', {}, async ({ page, login }) => {
      await page.locator('#auth-form').waitFor(); login();
      await page.evaluate(() => window.polylootAuthReturn());
      await page.locator('#profile-email').waitFor();
      assert.equal(await page.locator('#profile-email').inputValue(), user.email);
      assert.equal(new URL(page.url()).hash, '#profile');
    });
    await scenario('cold account appears before slow catalog; draft survives bootstrap', { initialUser: user, slowCatalog: true }, async ({ page, catalogGate }) => {
      await page.locator('#profile-first').waitFor();
      await page.locator('#profile-first').fill('Unsaved draft');
      catalogGate.resolve();
      await page.waitForLoadState('load');
      assert.equal(await page.locator('#profile-first').inputValue(), 'Unsaved draft');
    });
    await scenario('late guest response cannot overwrite OAuth return', { staleGuest: true }, async ({ page, login, guestGate }) => {
      login(); await page.evaluate(() => window.polylootAuthReturn());
      await page.locator('#profile-email').waitFor(); guestGate.resolve();
      await page.waitForLoadState('load');
      assert.equal(await page.locator('#profile-email').inputValue(), user.email);
    });
    await scenario('unchanged resume keeps draft; logout returns to login', { initialUser: user }, async ({ page, sessionCount }) => {
      await page.waitForLoadState('load');
      await page.locator('#profile-first').fill('Keep draft');
      const count = sessionCount();
      const resumed = page.waitForResponse(response => response.url().includes('customer?view=session'));
      await page.evaluate(() => window.dispatchEvent(new Event('polyloot:resume')));
      await (await resumed).finished();
      await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
      assert.ok(sessionCount() > count);
      assert.equal(await page.locator('#profile-first').inputValue(), 'Keep draft');
      await page.locator('#customer-logout').click();
      await page.locator('#auth-form').waitFor();
    });
    await scenario('lifecycle notification alone cannot authenticate a guest', {}, async ({ page }) => {
      await page.locator('#auth-form').waitFor();
      await page.evaluate(() => window.polylootAuthReturn());
      await page.locator('#session-refresh-retry').waitFor();
      assert.equal(await page.locator('#profile-email').count(), 0);
    });
    console.log(JSON.stringify({ browser: 'Edge', api: 'isolated fixtures', results }, null, 2));
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
