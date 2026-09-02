const fs=require('fs'),path=require('path');
const {JSDOM}=require('jsdom');
require('fake-indexeddb/auto');
const {webcrypto}=require('crypto');
const APP='/home/user/workspace/parcheban';
const html=fs.readFileSync(path.join(APP,'index.html'),'utf8');
const dom=new JSDOM(html,{runScripts:'outside-only',pretendToBeVisual:true,url:'https://x.test/'});
const w=dom.window;
w.indexedDB=indexedDB; w.IDBKeyRange=IDBKeyRange;
Object.defineProperty(w,'crypto',{value:webcrypto,configurable:true});
w.Chart=function(){return{destroy(){},update(){}};};
w.matchMedia=w.matchMedia||function(){return{matches:false,addListener(){},removeListener(){}}};
w.print=function(){};
const errs=[];
w.addEventListener('error',e=>errs.push('window.error: '+e.message));
const files=fs.readdirSync(path.join(APP,'js')).filter(f=>f.endsWith('.js')).sort();
for(const f of files){
  try{ w.eval(fs.readFileSync(path.join(APP,'js',f),'utf8')); }
  catch(e){ errs.push('EVAL '+f+': '+e.message); }
}
(async()=>{
  const g=w;
  // 1. Jalali correctness spot checks
  const checks=[['1403/01/01','2024-03-20'],['1404/01/01','2025-03-21'],['1403/12/30','2025-03-20'],['1399/06/31','2020-09-21']];
  for(const [j,iso] of checks){
    const p=j.split('/').map(Number);
    const d=g.Jalali.toGregorian(p[0],p[1],p[2]);
    const got=d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');
    console.log((got===iso?'PASS':'FAIL')+' Jalali '+j+' -> '+got+' (want '+iso+')');
  }
  // 2. round trip 1350-1450
  let bad=0;
  for(let y=1350;y<=1450;y++)for(let m=1;m<=12;m++){const dm=g.Jalali.monthDays(y,m);for(let d=1;d<=dm;d++){
    const s=y+'/'+String(m).padStart(2,'0')+'/'+String(d).padStart(2,'0');
    if(g.Jalali.format(...g.Jalali.fromDate(g.Jalali.toGregorian(y,m,d)))!==s)bad++;
  }}
  console.log((bad===0?'PASS':'FAIL')+' Jalali round-trip 1350-1450, mismatches='+bad);
  // 3. Jalali.parse tolerance
  const pv=[['1404/1/5','1404/01/05'],['۱۴۰۴/۰۱/۰۵','1404/01/05'],['1404-01-05','1404/01/05'],['1404/13/01',null],['garbage',null],['1403/12/30','1403/12/30'],['1404/12/30',null]];
  for(const [i,o] of pv){const r=g.Jalali.parse(i);console.log((r===o?'PASS':'FAIL')+' parse("'+i+'") -> '+r+' (want '+o+')');}
  // 4. esc
  console.log((g.esc('<img src=x onerror=alert(1)>')==='&lt;img src=x onerror=alert(1)&gt;'?'PASS':'FAIL')+' esc html');
  console.log((g.numOf('۱۲٬۳۴۵')===12345?'PASS':'FAIL')+' numOf persian digits -> '+g.numOf('۱۲٬۳۴۵'));
  // 5. DB open + auth
  await g.DB.init();
  console.log('PASS DB.open');
  g.STATE.yearId = 1;
  /* اجازه بده کدهای راه‌اندازی (boot) که هنگام eval شروع شده‌اند تمام
     شوند، وگرنه تست با آن‌ها هم‌زمان می‌شود. */
  await new Promise(r=>setTimeout(r,400));
  await g.DB.clear('users');
  await g.Auth.ensureDefaultUser();
  await g.Auth.ensureDefaultUser();
  let users=await g.DB.all('users');
  console.log((users.length===1&&users[0].username==='admin'?'PASS':'FAIL')+' ensureDefaultUser twice -> one admin: '+JSON.stringify(users.map(u=>u.username)));
  await g.DB.clear('users'); await g.Auth.ensureDefaultUser();
  await g.DB.add('users',{username:'ADMIN',password:'x'});
  await g.Auth.ensureDefaultUser();
  users=await g.DB.all('users');
  console.log((users.length===2?'PASS':'FAIL')+' guard is case-insensitive on username: '+JSON.stringify(users.map(u=>u.username)));
  await g.DB.clear('users'); await g.Auth.ensureDefaultUser();
  users=await g.DB.all('users');
  const h=await g.Auth.hash('admin123');
  console.log((h.length===64&&h!=='admin123'?'PASS':'FAIL')+' Auth.hash sha256 len='+h.length);
  console.log((users[0].password===h?'PASS':'FAIL')+' default user stored as sha256');
  console.log(((await g.Auth.verify({password:h},'admin123'))?'PASS':'FAIL')+' verify correct pw');
  console.log(((await g.Auth.verify({password:h},'wrong'))?'FAIL':'PASS')+' verify rejects wrong pw');
  const legacyUser={id:999,username:'old',password:g.Auth.legacyHash('admin123')};
  await g.DB.add('users',legacyUser);
  console.log(((await g.Auth.verify(legacyUser,'admin123'))?'PASS':'FAIL')+' verify accepts legacy hash');
  console.log((legacyUser.password===h?'PASS':'FAIL')+' legacy hash auto-upgraded to sha256');
  // DB error propagation
  let threw=false;
  try{ await g.DB.get('nosuchstore',1); }catch(e){ threw=true; }
  console.log((threw?'PASS':'FAIL')+' DB rejects on bad store (no silent failure)');
  // ── backup export/import round trip ──
  await g.DB.add('contacts',{name:'مشتری <تست>',type:'customer',balance:5000});
  await g.DB.add('banks',{name:'بانک تست',openingBalance:100});
  await g.DB.add('invoices',{type:'sale',fiscalYearId:1,contactId:1,invoiceNumber:'F-1',date:'1404/01/05',items:[{productId:1,productName:'پارچه',quantity:3,unitPrice:1000,total:3000}],subtotal:3000,grandTotal:3000,paidAmount:0});
  let captured=null;
  g.URL.createObjectURL=function(b){captured=b;return 'blob:x';};
  g.URL.revokeObjectURL=function(){};
  const origToast=g.UI.toast; g.UI.toast=function(){};
  await g.Backup.exportAll();
  const text=await captured.text();
  const dump=JSON.parse(text);
  const missing=g.Backup.STORES.filter(s=>!(s in dump));
  console.log((missing.length===0?'PASS':'FAIL')+' backup exports all '+g.Backup.STORES.length+' stores'+(missing.length?' missing='+missing:''));
  const before={}; for(const s of g.Backup.STORES) before[s]=await g.DB.all(s);
  console.log((before.contacts[0].id!==undefined?'PASS':'FAIL')+' exported records carry ids');
  // wipe then re-import via doImport's core path
  for(const s of g.Backup.STORES) await g.DB.clear(s);
  console.log(((await g.DB.all('contacts')).length===0?'PASS':'FAIL')+' stores cleared for import test');
  for(const s of g.Backup.STORES){ if(Array.isArray(dump[s])&&dump[s].length) await g.DB.bulkPut(s,dump[s]); }
  const after={}; for(const s of g.Backup.STORES) after[s]=await g.DB.all(s);
  let idOk=true, cntOk=true;
  for(const s of g.Backup.STORES){
    if(before[s].length!==after[s].length){cntOk=false;console.log('  count differs in '+s+': '+before[s].length+' -> '+after[s].length);}
    before[s].forEach((r,i)=>{ if(after[s][i]&&r.id!==after[s][i].id){idOk=false;} });
  }
  console.log((cntOk?'PASS':'FAIL')+' import restores same record counts');
  console.log((idOk?'PASS':'FAIL')+' import preserves original ids (relations intact)');
  const inv=(await g.DB.all('invoices'))[0];
  const con=(await g.DB.all('contacts')).find(c=>c.id===inv.contactId);
  console.log((con?'PASS':'FAIL')+' invoice still resolves to its contact after restore');
  g.UI.toast=origToast;
  // ── stock & balance math ──
  const st=await g.Prod.stockMap();
  console.log((st[1]===-3?'PASS':'FAIL')+' stockMap: sale of 3 gives -3 -> '+st[1]);
  const bal=await g.Inv.contactBal(inv.contactId);
  console.log((bal===8000?'PASS':'FAIL')+' contactBal: opening 5000 debtor + 3000 sale -> '+bal+' (want 8000)');
  await g.DB.add('payments',{type:'receipt',fiscalYearId:1,contactId:inv.contactId,amount:1000,date:'1404/01/06'});
  const bal2 = await g.Inv.contactBal(inv.contactId);
  console.log((bal2===7000?'PASS':'FAIL')+' contactBal after 1000 receipt -> '+bal2+' (want 7000)');
  // 6. Pagination
  g.Pag.reset('t'); const items=Array.from({length:95},(_,i)=>i);
  const sl=g.Pag.slice('t',items);
  console.log((sl.total===95&&sl.pages===Math.ceil(95/sl.per)&&sl.items.length===Math.min(sl.per,95)?'PASS':'FAIL')+' Pag.slice total='+sl.total+' pages='+sl.pages+' per='+sl.per);
  console.log((g.Pag.html('t').includes('<')?'PASS':'FAIL')+' Pag.html renders buttons');
  console.log('\nERRORS: '+(errs.length?'\n'+errs.join('\n'):'none'));
})().catch(e=>{console.log('FATAL',e.stack);process.exit(1)});
