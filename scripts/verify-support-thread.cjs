// Actual frontend + actual local handlers/storage. Virtual HTTP transport only.
// Never loads production credentials or sends real email.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const React = require('react');
const { randomUUID } = require('node:crypto');
const { renderToStaticMarkup } = require('react-dom/server');
const { chromium } = require(process.env.POLYLOOT_PLAYWRIGHT_PATH || 'playwright');
const root = path.resolve(__dirname, '..');
const origin = 'https://polyloot-support.test';
function pageHtml(admin) {
  const source = fs.readFileSync(path.join(root, admin ? 'app/admin/page.tsx' : 'app/page.tsx'), 'utf8');
  const compiled = ts.transpileModule(source, { compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.CommonJS } }).outputText;
  const mod = { exports: {} };
  vm.runInThisContext(`(function(require,module,exports){${compiled}\n})`)(name => name.endsWith('.css') ? {} : name === 'next/script' ? { default: ({src,type}) => React.createElement('script', {src,type}) } : require(name), mod, mod.exports);
  const css = ['app/theme.css', admin ? 'app/admin/admin.css' : 'app/store.css', 'app/dark.css', 'app/navigation-icons.css', 'app/support-thread.css'].map(file => fs.readFileSync(path.join(root,file),'utf8').replace(/@import[^;]+;/g,'')).join('\n');
  return `<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><style>${css}</style></head><body>${renderToStaticMarkup(React.createElement(mod.exports.default))}</body></html>`;
}
(async () => {
  const store = await import('../lib/store.js');
  assert.ok(store.isLocalDemo(), 'run without production/Supabase credentials');
  const modules = {};
  for (const key of ['customer','support','admin','assets','settings','notifications']) modules[key] = (await import(`../handlers/${key}.js`)).default;
  const {handleSupportThread} = await import('../handlers/support-thread.js');
  const {notificationHandler} = await import('../handlers/notifications.js');
  const post = (url,data,cookie='') => new Request(origin+url,{method:'POST',headers:{'Content-Type':'application/json',Cookie:cookie,Origin:origin},body:JSON.stringify(data)});
  const tag = randomUUID().slice(0,8);
  const signup = await modules.customer.fetch(post('/api/customer',{action:'register',username:`ui_${tag}`,email:`${tag}@example.test`,password:'UiConversationPass123!',first:'UI',last:'Test'}));
  assert.equal(signup.status,201); const customerCookie = signup.headers.get('set-cookie').split(';')[0];
  process.env.ADMIN_PASSWORD='UiAdminTemporaryPassword123!';
  const login=await modules.admin.fetch(post('/api/admin',{action:'login',password:process.env.ADMIN_PASSWORD}));
  const adminCookie=login.headers.get('set-cookie').split(';')[0];
  const browser=await chromium.launch({channel:'msedge',headless:true}); const results=[];
  try {
    for(const theme of ['light','dark']) {
      const created=await modules.support.fetch(post('/api/support',{category:'DOWNLOAD',message:'Original support issue for UI verification.'},customerCookie));
      const id=(await created.json()).ticket.id;
      for(const admin of [false,true]) {
        const context=await browser.newContext({viewport:{width:admin?1440:390,height:900},...(admin?{userAgent:'Mozilla/5.0 PolyLootAdminDesktop/1.0'}:{})});
        const page=await context.newPage(); const errors=[]; const replyIds=[]; let lost=false;
        page.on('pageerror',error=>errors.push(error.message));
        await page.addInitScript(value=>localStorage.setItem('polyloot-display-preferences-v1',JSON.stringify({theme:value,language:'th'})),theme);
        await page.route(origin+'/**',async route=>{
          const url=new URL(route.request().url());
          if(url.pathname==='/'||url.pathname==='/admin/') return route.fulfill({contentType:'text/html',body:pageHtml(admin)});
          if(url.pathname.startsWith('/api/')) {
            const req=route.request(); const headers={...req.headers(),Cookie:admin?adminCookie:customerCookie};
            const request=new Request(req.url(),{method:req.method(),headers,...(req.postData()?{body:req.postData()}: {})});
            let response;
            if(url.pathname==='/api/admin/support') response=await handleSupportThread(request,true);
            else if(url.pathname==='/api/admin/notifications') response=await notificationHandler(true).fetch(request);
            else { const handler=modules[url.pathname.slice(5)]; response=handler?await handler.fetch(request):Response.json({error:'fixture route missing'},{status:404}); }
            if(req.method()==='POST'&&req.postDataJSON()?.action==='reply') {
              replyIds.push(req.postDataJSON().messageId);
              if(!admin&&!lost) { lost=true; return route.abort('failed'); }
            }
            return route.fulfill({status:response.status,headers:Object.fromEntries(response.headers),body:Buffer.from(await response.arrayBuffer())});
          }
          const filename=path.resolve(root,'public','.'+url.pathname);
          if(filename.startsWith(path.join(root,'public')+path.sep)&&fs.existsSync(filename)&&fs.statSync(filename).isFile()) return route.fulfill({path:filename,contentType:filename.endsWith('.js')?'text/javascript':undefined});
          return route.fulfill({status:404,body:''});
        });
        await page.goto(origin+(admin?'/admin/':`/#ticket/${id}`));
        if(admin) { await page.locator('[data-view="support"]').click(); await page.locator(`[data-open-ticket="${id}"]`).click(); }
        await page.locator('.support-reply-form textarea').fill(admin?'Admin solution: open the OBJ file.':'Customer follow-up <img src=x onerror=alert(1)>');
        const send=page.locator('.support-reply-form [type="submit"]');
        await send.click();
        if(!admin) { await page.waitForFunction(()=>!document.querySelector('.support-reply-form [type="submit"]').disabled); await send.click(); }
        await page.waitForFunction(()=>document.querySelector('.support-reply-form textarea')?.value==='');
        assert.ok(await page.locator('.support-conversation').innerText().then(text=>text.includes(admin?'Admin solution':'Customer follow-up')));
        if(!admin) { assert.equal(replyIds.length,2); assert.equal(replyIds[0],replyIds[1]); }
        assert.equal(await page.locator('.support-conversation img').count(),0);
        if(admin) assert.ok((await page.locator('.support-conversation').innerText()).includes('DEMO'));
        await page.locator('.support-reply-form textarea').fill('Preserve unsent draft');
        await page.locator('[data-thread-refresh]').click();
        await page.waitForFunction(()=>!document.querySelector('[data-thread-refresh]').disabled);
        assert.equal(await page.locator('.support-reply-form textarea').inputValue(),'Preserve unsent draft');
        assert.equal(await page.locator('html').getAttribute('data-theme'),theme);
        assert.deepEqual(errors,[]);
        assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
        if(admin) assert.equal(await page.locator('a[href="/"]').count(),0);
        fs.mkdirSync(path.join(root,'.data/live-verification'),{recursive:true});
        await page.screenshot({path:path.join(root,`.data/live-verification/support-${admin?'admin':'customer'}-${theme}.png`),fullPage:!admin});
        results.push({role:admin?'admin':'customer',theme,passed:true}); await context.close();
      }
    }
    console.log(JSON.stringify({browser:'Edge',backend:'actual local handlers; demo email',results},null,2));
  } finally {await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
