const {chromium}=require('playwright-core');
/* راه‌انداز مرورگر — مسیر کروم و آدرس سرور از اینجا می‌آید.
   پورت را با متغیر محیطی PB_PORT عوض کنید: PB_PORT=8000 node tests/xxx.js */
const path=require('path');
const PORT=process.env.PB_PORT||'8000';
const BASE='http://localhost:'+PORT;
function launchOpts(){
  const o={args:['--no-sandbox']};
  if(process.env.PB_CHROME) o.executablePath=process.env.PB_CHROME;
  return o;
}
const fs=require('fs');
(async()=>{
const b=await chromium.launch(launchOpts());
const ctx=await b.newContext({viewport:{width:1400,height:900}});
const pg=await ctx.newPage();
const errs=[];const warns=[];
pg.on('pageerror',e=>errs.push('PAGEERROR '+e.message));
pg.on('console',m=>{if(m.type()==='error')errs.push('CONSOLE '+m.text().slice(0,140));});
await pg.route('**/*',r=>r.request().url().startsWith(BASE)?r.continue():r.abort());
await pg.goto(BASE+'/index.html',{waitUntil:'domcontentloaded'});
await pg.waitForTimeout(2000);
await pg.fill('#loginUser','admin');await pg.fill('#loginPass','admin123');
await pg.click('#loginBtn');await pg.waitForTimeout(2000);

// داده نمونه می‌سازیم تا صفحه‌ها خالی نباشند
await pg.evaluate(async()=>{
  await DB.put('categories',{id:1,name:'پارچه کتان'});
  await DB.put('products',{id:1,name:'کتان آبی',categoryId:1,unit:'متر',stock:0,price:50000,buyPrice:30000});
  await DB.put('contacts',{id:1,name:'فروشگاه الف',type:'both',balance:0,phone:'0912'});
  await DB.put('banks',{id:1,name:'ملت',accountNo:'123',openingBalance:1000000});
  await DB.put('checks',{id:1,type:'received',contactId:1,amount:500000,serial:'11',dueDate:'1405/07/01',status:'pending',bankAccountId:1,year:1405});
});
const pages=['dashboard','categories','products','contacts','purchase','sales','proforma','warehouse','payments','checks','banks','ledger','reports','years','users','settings'];
const names={dashboard:'داشبورد',categories:'دسته‌بندی',products:'کالاها',contacts:'اشخاص',purchase:'فاکتور خرید',sales:'فاکتور فروش',proforma:'پیش‌فاکتور',warehouse:'انبار',payments:'دریافت/پرداخت',checks:'چک‌ها',banks:'بانک',ledger:'دفتر معین',reports:'گزارشات',years:'سال مالی',users:'کاربران',settings:'تنظیمات'};
for(const p of pages){
  const before=errs.length;
  await pg.evaluate(x=>{location.hash='#'+x},p);
  await pg.waitForTimeout(1200);
  const info=await pg.evaluate(()=>{
    const c=document.getElementById('mainContent');
    return {len:c?c.innerHTML.length:0,txt:(c?c.innerText:'').slice(0,60).replace(/\n/g,' ')};
  });
  const bad=errs.slice(before);
  console.log((bad.length?'✗':'✓')+' '+names[p].padEnd(16)+' محتوا:'+String(info.len).padStart(6)+(bad.length?'  << '+bad.join(' | '):''));
}
// تب‌های گزارشات
await pg.evaluate(()=>{location.hash='#reports'});await pg.waitForTimeout(1000);
for(const t of ['summary','purchases','sales','stock','profit','debtors','creditors']){
  const before=errs.length;
  await pg.evaluate(async x=>{await Rep[x]()},t).catch(e=>errs.push('TAB '+t+' '+e.message.slice(0,80)));
  await pg.waitForTimeout(500);
  const bad=errs.slice(before);
  console.log((bad.length?'✗':'✓')+' گزارش '+t.padEnd(12)+(bad.length?' << '+bad.join(' | '):''));
}
console.log('\nمجموع خطا: '+errs.length);
await b.close();
})();
