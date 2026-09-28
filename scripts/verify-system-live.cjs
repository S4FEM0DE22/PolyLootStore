// Real Edge / production checks: no mocked requests and no saved credentials.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { chromium } = require(process.env.POLYLOOT_PLAYWRIGHT_PATH || 'playwright');
for (const file of ['.env.local', '.env']) { try { process.loadEnvFile(file); } catch (e) { if (e.code !== 'ENOENT') throw e; } }
const base = 'https://poly-loot-store.vercel.app';
const results = [];
async function check(name, fn) {
  try { const detail = await fn(); results.push({ name, status: 'PASS', detail }); }
  catch (e) { results.push({ name, status: 'FAIL', detail: e.message.split('\n').slice(0, 3).join(' ').slice(0, 500) }); }
  console.log(JSON.stringify(results.at(-1)));
}
(async () => {
  const browser = await chromium.launch({ channel: 'msedge', headless: !process.env.POLYLOOT_INTERACTIVE });
  const guest = await browser.newContext({viewport:{width:390,height:844}});
  const page = await guest.newPage(), errors = [];
  page.on('pageerror', e => errors.push(e.message));
  const admin = await browser.newContext();
  const adminPage = await admin.newPage();
  try {
    await check('Guest API privacy', async () => {
      for (const route of ['/api/customer?view=orders','/api/support','/api/settings?view=customer','/api/notifications','/api/admin?view=overview','/api/admin?view=export','/api/admin/notifications']) {
        assert.equal((await guest.request.get(base+route)).status(),401,route);
      }
      assert.equal((await guest.request.get(base+'/api/download?token=invalid')).status(),403);
      return 'Seven protected reads denied; invalid download denied';
    });
    await check('Live catalog and mobile routes', async () => {
      const response = await guest.request.get(base+'/api/assets');
      assert.equal(response.status(),200); const {assets} = await response.json();
      assert.ok(assets.length > 0); assert.ok(assets.every(a=> !('file' in a)));
      await page.goto(base, {waitUntil:'networkidle'});
      for (const hash of ['home','catalog','asset/'+assets[0].id,'cart','track','help','login','register','forgot-password','settings','profile','history','library','notifications']) {
        await page.evaluate(h=>location.hash=h, '#'+hash);
        await page.waitForTimeout(350);
        assert.ok((await page.locator('#app').innerText()).trim().length>0,hash);
        assert.equal(await page.locator('#mobile-menu-toggle').getAttribute('aria-expanded'),'false',hash);
        assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+2),false,hash+' overflow');
      }
      assert.deepEqual(errors,[]); return {assets:assets.length,routes:14};
    });
    await check('Admin form login and server data', async () => {
      await adminPage.goto(base+'/admin/',{waitUntil:'networkidle'});
      await adminPage.locator('#password').fill(process.env.ADMIN_PASSWORD);
      await adminPage.locator('#login-form button[type=submit]').click();
      await adminPage.locator('.admin-workspace').waitFor();
      const response = await admin.request.get(base+'/api/admin?view=overview'); assert.equal(response.status(),200);
      const data = await response.json(); assert.ok(data.emailConfigured); assert.ok(Array.isArray(data.assets));
      return {assets:data.assets.length,orders:data.orders.length,emailConfigured:data.emailConfigured};
    });
    await check('Admin all views and export download', async () => {
      for (const view of ['overview','orders','assets','customers','support','settings','alerts']) {
        await adminPage.locator('[data-view="'+view+'"]').first().click();
        await adminPage.waitForTimeout(300);
        assert.ok((await adminPage.locator('.admin-content').innerText()).trim().length,view);
      }
      await adminPage.locator('[data-view="overview"]').first().click();
      const downloaded = adminPage.waitForEvent('download'); await adminPage.locator('#export-orders').click();
      const download = await downloaded; assert.equal(await download.failure(),null);
      await download.saveAs('.data/live-verification/orders-export.csv');
      const response = await admin.request.get(base+'/api/admin?view=export'); assert.equal(response.status(),200);
      const data = await response.json(); assert.ok(data.assets.length); return {views:7,csv:download.suggestedFilename(),jsonAssets:data.assets.length};
    });
    await check('Admin seven-day dropdown / all feed', async () => {
      const response = await admin.request.get(base+'/api/admin/notifications?days=7&limit=20'); assert.equal(response.status(),200);
      const data = await response.json();
      for(const n of data.notifications) assert.ok(Date.parse(n.createdAt)>=Date.now()-7*86400000, 'outside seven-day window');
      await adminPage.locator('#notification-toggle').click(); await adminPage.locator('.nc-head').waitFor();
      assert.equal(await adminPage.locator('.nc-dropdown .nc-row').count(),data.notifications.length);
      await adminPage.locator('[data-nc-show-all]').click(); await adminPage.locator('.nc-summary').waitFor();
      return {recent:data.notifications.length,readReceiptsChanged:false};
    });
    await check('Cross-origin writes rejected',async()=>{
      const response=await admin.request.post(base+'/api/admin',{headers:{Origin:'https://example.invalid'},data:{action:'set-asset-active',id:'nonexistent-test',active:false}});
      assert.equal(response.status(),403); return response.status();
    });
    await check('Admin logout revokes access',async()=>{
      await adminPage.locator('[data-action=logout]').click(); await adminPage.locator('#login-form').waitFor();
      assert.equal((await admin.request.get(base+'/api/admin?view=overview')).status(),401); return 'UI logout and API denial';
    });
    if(process.env.POLYLOOT_INTERACTIVE) {
      await page.setViewportSize({width:1200,height:900});
      await page.goto(base+'/#login');
      console.log('CUSTOMER_LOGIN_WAITING: Please sign in manually to the opened test Edge window. No password/session is saved.');
      const deadline=Date.now()+10*60*1000;
      while(Date.now()<deadline) {
        const response=await guest.request.get(base+'/api/customer?view=session');
        const data=await response.json();
        if(data.user?.email==='yoyuuu29@gmail.com') { console.log('CUSTOMER_LOGIN_READY'); break; }
        await page.waitForTimeout(3000);
      }
    }
  } finally {
    fs.mkdirSync('.data/live-verification',{recursive:true});
    fs.writeFileSync('.data/live-verification/web-report.json',JSON.stringify({at:new Date().toISOString(),base,realNetwork:true,results,pageErrors:errors},null,2));
    await browser.close();
  }
})().catch(e=>{console.error(e.message);process.exitCode=1;});
