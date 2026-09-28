// Scoped production write test. Only a newly created, clearly labelled QA asset is changed/deleted.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const {chromium} = require(process.env.POLYLOOT_PLAYWRIGHT_PATH || 'playwright');
for(const file of ['.env.local','.env']){try{process.loadEnvFile(file);}catch(e){if(e.code!=='ENOENT')throw e;}}
const base='https://poly-loot-store.vercel.app';
const results=[];
let ownId;
async function check(name,fn){try{results.push({name,status:'PASS',detail:await fn()});}catch(e){results.push({name,status:'FAIL',detail:e.message.slice(0,400)});}console.log(JSON.stringify(results.at(-1)));}
(async()=>{
  const browser=await chromium.launch({channel:'msedge',headless:true});
  const context=await browser.newContext();
  const post=data=>context.request.post(base+'/api/admin',{headers:{Origin:base},data});
  try{
    assert.equal((await post({action:'login',password:process.env.ADMIN_PASSWORD})).status(),200);
    await check('Upload own temporary OBJ to real storage',async()=>{
      const response=await context.request.post(base+'/api/admin',{headers:{Origin:base},multipart:{action:'add-asset',id:'qa-live-'+Date.now(),title:'QA LIVE TEST 2026-09-28',subtitle:'Temporary automated verification',description:'Temporary verification asset; not a customer product.',author:'PolyLoot QA',price:'1',category:'Props',formats:'OBJ',engines:'Unity,Unreal,Godot',version:'1.0.0',license:'Project demo',cover_mode:'default',file:{name:'qa-triangle.obj',mimeType:'text/plain',buffer:Buffer.from('o QA\nv 0 0 0\nv 1 0 0\nv 0 1 0\nf 1 2 3\n')}}});
      const data=await response.json(); assert.equal(response.status(),200,data.error); ownId=data.asset.id;
      assert.ok(ownId.startsWith('qa-live-')); return {assetId:ownId};
    });
    if(!ownId)return;
    await check('Hide own asset and enforce catalog visibility',async()=>{
      assert.equal((await post({action:'set-asset-active',id:ownId,active:false})).status(),200);
      const {assets}=await (await context.request.get(base+'/api/assets')).json();
      assert.ok(!assets.some(a=>a.id===ownId)); return 'Hidden from public catalog';
    });
    await check('Import/export own metadata',async()=>{
      const response=await post({action:'import-assets',assets:[{id:ownId,title:'QA LIVE TEST updated',price:2}]});
      assert.equal(response.status(),200); assert.equal((await response.json()).updated,1);
      const {assets}=await (await context.request.get(base+'/api/admin?view=export')).json();
      const own=assets.find(a=>a.id===ownId); assert.equal(own.price,2); assert.equal(own.title,'QA LIVE TEST updated');return 'Import persisted and export confirmed';
    });
    await check('Import rejects negative price on hidden QA asset',async()=>{
      const response=await post({action:'import-assets',assets:[{id:ownId,price:-1}]});
      assert.equal(response.status(),400,'Invalid negative price should be rejected');return response.status();
    });
    await post({action:'import-assets',assets:[{id:ownId,price:2}]});
    await check('Admin invalid support status rejected',async()=>{
      const response=await post({action:'set-ticket-status',id:'SP-0000000000000000',status:'INVALID'});assert.equal(response.status(),400);return response.status();
    });
  }finally{
    if(ownId)await check('Cleanup only own test asset',async()=>{
      const response=await post({action:'delete-asset',id:ownId});assert.equal(response.status(),200);
      const {assets}=await (await context.request.get(base+'/api/admin?view=export')).json(); assert.ok(!assets.some(a=>a.id===ownId));return {removed:ownId};
    });
    await post({action:'logout'});
    fs.mkdirSync('.data/live-verification',{recursive:true});fs.writeFileSync('.data/live-verification/admin-write-report.json',JSON.stringify({at:new Date().toISOString(),base,results},null,2));await browser.close();
  }
})().catch(e=>{console.error(e.message);process.exitCode=1;});
