// One explicitly provisioned QA ticket only; one real admin reply/email.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const {chromium} = require(process.env.POLYLOOT_PLAYWRIGHT_PATH || 'playwright');
for (const file of ['.env.local','.env']) { try { process.loadEnvFile(file); } catch(e) { if(e.code!=='ENOENT') throw e; } }
const id=process.argv[2];
assert.match(id||'',/^SP-[A-F0-9]{16}$/);
const base='https://poly-loot-store.vercel.app';
(async()=>{
  const browser=await chromium.launch({channel:'msedge',headless:true});
  const context=await browser.newContext({viewport:{width:1440,height:1000}});
  const results=[]; let payload;
  try {
    assert.equal((await context.request.post(base+'/api/admin',{headers:{Origin:base},data:{action:'login',password:process.env.ADMIN_PASSWORD}})).status(),200);
    const initial=await (await context.request.get(base+'/api/admin/support?id='+id)).json();
    assert.ok(initial.ticket.message.startsWith('QA SUPPORT LIVE TEST'));
    assert.equal(initial.messages.length,0,'Never resend an already tested ticket');
    const page=await context.newPage(); const errors=[];
    page.on('pageerror',e=>errors.push(e.message));
    page.on('request',request=>{
      if(request.url()===base+'/api/admin/support'&&request.method()==='POST') {
        const value=request.postDataJSON(); if(value.action==='reply'&&value.id===id) payload=value;
      }
    });
    await page.goto(base+'/admin/');
    await page.locator('[data-view="support"]').click();
    await page.locator(`[data-open-ticket="${id}"]`).click();
    await page.locator('.support-reply-form textarea').fill('QA ทดสอบระบบคำร้อง: ผู้ดูแลตอบกลับผ่านระบบจริงแล้วครับ นี่เป็นข้อความทดสอบ ไม่ต้องชำระเงินหรือส่งข้อมูลส่วนตัว');
    const saved=page.waitForResponse(r=>r.url()===base+'/api/admin/support'&&r.request().method()==='POST');
    await page.locator('.support-reply-form [type="submit"]').click();
    const response=await saved; assert.equal(response.status(),200);
    const thread=await response.json(); assert.equal(thread.messages.length,1);
    assert.equal(thread.messages[0].emailStatus,'SENT','Provider must accept the email');
    await page.waitForFunction(()=>document.querySelector('.support-reply-form textarea')?.value==='');
    assert.ok((await page.locator('.support-conversation').innerText()).includes('ผู้ให้บริการรับเมลแล้ว'));
    results.push({check:'Real Edge admin reply persisted; email provider accepted',passed:true});
    const duplicate=await context.request.post(base+'/api/admin/support',{headers:{Origin:base},data:payload});
    assert.equal(duplicate.status(),200); assert.equal((await duplicate.json()).messages.length,1);
    results.push({check:'Same request ID does not duplicate message/email',passed:true});
    const guest=await browser.newContext();
    assert.equal((await guest.request.get(base+'/api/support?id='+id)).status(),401);
    assert.equal((await guest.request.get(base+'/api/admin/support?id='+id)).status(),401);
    await guest.close(); assert.deepEqual(errors,[]);
    results.push({check:'Guest APIs reject access; no browser script errors',passed:true});
    await context.request.post(base+'/api/admin',{headers:{Origin:base},data:{action:'set-ticket-status',id,status:'RESOLVED'}}).then(r=>assert.equal(r.status(),200));
    fs.mkdirSync('.data/live-verification',{recursive:true});
    await page.screenshot({path:'.data/live-verification/support-production-admin.png'});
    const report={at:new Date().toISOString(),base,ticketId:id,messageId:thread.messages[0].id,results};
    fs.writeFileSync('.data/live-verification/support-live-report.json',JSON.stringify(report,null,2));
    console.log(JSON.stringify(report,null,2));
  } finally {
    await context.request.post(base+'/api/admin',{headers:{Origin:base},data:{action:'logout'}}).catch(()=>{});
    await browser.close();
  }
})().catch(e=>{console.error(e.message);process.exitCode=1;});
