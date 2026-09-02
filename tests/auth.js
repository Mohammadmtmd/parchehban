const {chromium}=require('playwright-core');
const PORT=process.env.PB_PORT||'8000';const BASE='http://localhost:'+PORT;
let fail=0; const ck=(c,m)=>{console.log((c?'  ✓ ':'  ✗ ')+m); if(!c)fail++;};
(async()=>{
const b=await chromium.launch({executablePath:process.env.PB_CHROME,args:['--no-sandbox']});
const pg=await b.newPage({viewport:{width:1300,height:900}});
pg.on('pageerror',e=>{console.log('PAGEERROR',e.message);fail++;});
await pg.route('**/*',r=>r.request().url().startsWith(BASE)?r.continue():r.abort());
await pg.goto(BASE+'/index.html',{waitUntil:'domcontentloaded'});await pg.waitForTimeout(1800);

// کاربری با رمز به روش قدیمی btoa می‌سازیم
await pg.evaluate(async()=>{
  await DB.add('users',{username:'ghadimi',password:Auth.legacyHash('rmz1234'),
    role:'admin',displayName:'کاربر قدیمی',active:true});
});
const before=await pg.evaluate(async()=>(await DB.all('users')).find(u=>u.username==='ghadimi').password);
ck(before.length<64,'رمز اولیه به روش قدیمی است: '+before);

await pg.fill('#loginUser','ghadimi');await pg.fill('#loginPass','rmz1234');
await pg.click('#loginBtn');await pg.waitForTimeout(1800);
ck(await pg.evaluate(()=>document.getElementById('loginPage').style.display==='none'),'ورود با رمز قدیمی موفق');
const after=await pg.evaluate(async()=>(await DB.all('users')).find(u=>u.username==='ghadimi').password);
ck(/^[0-9a-f]{64}$/.test(after),'رمز به SHA-256 ارتقا یافت: '+after.slice(0,16)+'…');
ck(after!==before,'هش عوض شد');

// خروج و ورود دوباره با همان رمز (باید با هش جدید کار کند)
await pg.evaluate(()=>Auth.logout());await pg.waitForTimeout(600);
await pg.fill('#loginUser','ghadimi');await pg.fill('#loginPass','rmz1234');
await pg.click('#loginBtn');await pg.waitForTimeout(1500);
ck(await pg.evaluate(()=>document.getElementById('loginPage').style.display==='none'),'ورود دوباره با هش جدید موفق');

// رمز غلط باید رد شود
await pg.evaluate(()=>Auth.logout());await pg.waitForTimeout(600);
await pg.fill('#loginUser','ghadimi');await pg.fill('#loginPass','ghalat');
await pg.click('#loginBtn');await pg.waitForTimeout(1200);
ck(await pg.evaluate(()=>document.getElementById('loginPage').style.display!=='none'),'رمز غلط رد شد');

console.log(fail?'\n✗ '+fail+' مورد مردود':'\n✓ همه قبول');
await b.close();process.exit(fail?1:0);
})();
