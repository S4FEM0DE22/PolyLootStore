const assert = require('node:assert/strict');
const path = require('node:path');
const { chromium } = require(process.env.POLYLOOT_PLAYWRIGHT_PATH || 'playwright');

(async () => {
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  try {
    const results = [];
    for (const mode of ['web', 'desktop']) {
      const context = await browser.newContext({
        viewport: { width: 1440, height: 940 },
        ...(mode === 'desktop' ? { userAgent: 'Mozilla/5.0 Chrome/144.0.0.0 PolyLootAdminDesktop/1.0' } : {}),
      });
      const page = await context.newPage();
      const errors = [];
      page.on('pageerror', error => errors.push(error.message));
      const response = await page.goto('https://poly-loot-store.vercel.app/admin/', { waitUntil: 'domcontentloaded' });
      await page.locator('#login-form').waitFor({ timeout: 30000 });
      const returnLink = page.getByRole('link', { name: 'กลับหน้าร้าน', exact: true });
      const brand = page.locator('.admin-auth-side .brand');
      const brandTag = await brand.evaluate(element => element.tagName);
      const linkCount = await returnLink.count();
      assert.equal(response.status(), 200);
      assert.equal(linkCount, mode === 'web' ? 1 : 0);
      assert.equal(brandTag, mode === 'web' ? 'A' : 'SPAN');
      assert.deepEqual(errors, []);
      await page.screenshot({ path: path.resolve(__dirname, `../apps/desktop/dist/verify-admin-${mode}.png`), fullPage: true });
      if (mode === 'web') {
        await returnLink.click();
        await page.waitForURL(url => url.pathname === '/', { timeout: 30000 });
        assert.equal(new URL(page.url()).pathname, '/');
      }
      results.push({ mode, httpStatus: response.status(), returnLinkCount: linkCount, brandTag, pageErrors: errors.length, webReturnVerified: mode === 'web' });
      await context.close();
    }
    console.log(JSON.stringify(results, null, 2));
  } finally { await browser.close(); }
})().catch(error => { console.error(error.message); process.exitCode = 1; });
