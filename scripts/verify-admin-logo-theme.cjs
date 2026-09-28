// UI-only regression using actual styles, brand markup, images and preference module.
// Virtual host fixtures never authenticate or change production data.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require(process.env.POLYLOOT_PLAYWRIGHT_PATH || 'playwright');
const root = path.resolve(__dirname, '..');
const base = process.env.POLYLOOT_VERIFY_URL?.replace(/\/$/,'');
(async () => {
  const { getAdminNavigation } = await import('../public/legacy/admin-platform.js');
  const css = ['app/theme.css', 'app/admin/admin.css', 'app/dark.css'].map(file => fs.readFileSync(path.join(root,file),'utf8').replace(/@import[^;]+;/g,'')).join('\n');
  const browser = await chromium.launch({channel:'msedge',headless:true});
  try {
    for (const mode of ['web','desktop']) for (const state of ['login','workspace']) for(const width of [390,1440]) {
      const context = await browser.newContext({viewport:{width,height:900},colorScheme:'light',...(mode==='desktop'?{userAgent:'Mozilla/5.0 PolyLootAdminDesktop/1.0'}:{})});
      const page = await context.newPage();
      const brand = getAdminNavigation(mode === 'desktop' ? 'PolyLootAdminDesktop/1.0' : '').brand;
      const errors=[]; page.on('pageerror',e=>errors.push(e.message));
      if (!base) await page.route('http://polyloot-ui.test/**', async route => {
        const pathname = new URL(route.request().url()).pathname;
        if (pathname === '/') return route.fulfill({contentType:'text/html',body:`<!doctype html><html><head><style>${css}</style></head><body><div class="${state==='login'?'admin-auth-side':'admin-brand'}">${brand}</div><script type="module">window.logoPreferences=await import('/legacy/settings-ui.js');</script></body></html>`});
        const file = path.join(root,'public',pathname.slice(1));
        if (!file.startsWith(path.join(root,'public')+path.sep) || !fs.existsSync(file)) return route.fulfill({status:404,body:''});
        return route.fulfill({contentType:pathname.endsWith('.png')?'image/png':'text/javascript',body:fs.readFileSync(file)});
      });
      if (base) {
        // Real deployed styles/modules with UI-only API fixtures, never server writes.
        await page.route('**/api/admin?*',route=>route.fulfill({json:new URL(route.request().url()).searchParams.get('view')==='session'?{authenticated:state==='workspace',configured:true}:{assets:[],orders:[],customers:[],tickets:[],emailConfigured:false}}));
        await page.route('**/api/settings*',route=>route.fulfill({json:{settings:{announcement:'',faq:[]}}}));
        await page.route(/\/api\/admin\/notifications(?:\?|$)/,route=>route.fulfill({json:{notifications:[],total:0,unreadCount:0,hasMore:false}}));
        await page.goto(base+'/admin/');
        await page.locator(state==='login'?'.admin-auth-side .brand':'.admin-brand .brand').waitFor();
        await page.evaluate(async()=>{window.logoPreferences=await import('/legacy/settings-ui.js');});
      } else await page.goto('http://polyloot-ui.test/');
      await page.waitForFunction(()=>Boolean(window.logoPreferences));
      async function verify(theme) {
        await page.waitForFunction(t=>document.documentElement.dataset.theme===t,theme);
        const light=page.locator('.theme-logo-light'), dark=page.locator('.theme-logo-dark');
        assert.equal(await light.isVisible(),theme==='light',`${mode}/${state}/${width}/${theme}: light logo`);
        assert.equal(await dark.isVisible(),theme==='dark',`${mode}/${state}/${width}/${theme}: dark logo`);
        const visible=theme==='light'?light:dark;
        await page.waitForFunction(selector=>{
          const img=document.querySelector(selector);
          return img?.complete && img.naturalWidth>0;
        },theme==='light'?'.theme-logo-light':'.theme-logo-dark');
        assert.ok(await visible.evaluate(img=>img.complete && img.naturalWidth>0),'Artwork loaded');
      }
      for(const theme of ['light','dark','light']) {
        await page.evaluate(t=>window.logoPreferences.saveDisplayPreferences({theme:t}),theme); await verify(theme);
      }
      await page.evaluate(()=>window.logoPreferences.saveDisplayPreferences({theme:'system'}));
      await verify('light'); await page.emulateMedia({colorScheme:'dark'}); await verify('dark');
      await page.emulateMedia({colorScheme:'light'}); await verify('light');
      assert.deepEqual(errors,[]);
      if(width===1440 && mode==='web') {
        const output=path.join(root,'.data/admin-logo-verification');fs.mkdirSync(output,{recursive:true});
        for(const theme of ['light','dark']) {
          await page.evaluate(t=>window.logoPreferences.saveDisplayPreferences({theme:t}),theme);await verify(theme);
          await page.locator('.brand').screenshot({path:path.join(output,`${state}-${theme}.png`)});
        }
      }
      console.log(JSON.stringify({mode,state,width,instantToggle:true,systemChanges:true,oneVisibleLogo:true}));
      await context.close();
    }
  } finally { await browser.close(); }
})().catch(error=>{console.error(error.message);process.exitCode=1;});
