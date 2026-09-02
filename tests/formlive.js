const {chromium}=require('playwright-core');
const PORT=process.env.PB_PORT||'8000';const BASE='http://localhost:'+PORT;
let fail=0; const ck=(c,m)=>{console.log((c?'  ✓ ':'  ✗ ')+m); if(!c)fail++;};
(async()=>{
const b=await chromium.launch({executablePath:process.env.PB_CHROME,args:['--no-sandbox']});
const pg=await b.newPage({viewport:{width:1400,height:950}});
pg.on('pageerror',e=>{console.log('PAGEERROR',e.message);fail++;});
await pg.route('**/*',r=>r.request().url().startsWith(BASE)?r.continue():r.abort());
await pg.goto(BASE+'/index.html',{waitUntil:'domcontentloaded'});await pg.waitForTimeout(1600);
await pg.fill('#loginUser','admin');await pg.fill('#loginPass','admin123');
await pg.click('#loginBtn');await pg.waitForTimeout(1600);
await pg.evaluate(async()=>{
  await DB.put('categories',{id:1,name:'پارچه کتان'});
  await DB.put('contacts',{id:1,name:'بازرگانی نوید',type:'both',balance:4500000});
  await DB.put('banks',{id:1,name:'بانک ملت',openingBalance:0});
  await DB.put('products',{id:1,name:'کتان آبی',categoryId:1,unit:'متر',minStock:5});
  await DB.put('products',{id:2,name:'حریر صورتی',categoryId:1,unit:'متر',minStock:0});
  await DB.put('invoices',{id:1,type:'purchase',invoiceNumber:'P1',date:todayJ(),contactId:1,
    items:[{productId:1,quantity:37,unitPrice:1000}],total:37000,paidAmount:0});
});

console.log('\n— جداکننده هزارگان و مبلغ به حروف —');
await pg.evaluate(()=>Pay.showF('receipt'));await pg.waitForTimeout(500);
await pg.click('#pAm'); await pg.type('#pAm','1250000',{delay:25});
let v=await pg.inputValue('#pAm'); let w=await pg.textContent('#pAm_w');
ck(v==='۱٬۲۵۰٬۰۰۰', 'جداکننده زنده: '+v);
ck(/یک میلیون و دویست و پنجاه هزار ریال/.test(w), 'به حروف: '+w);
// ارقام فارسی
await pg.fill('#pAm',''); await pg.type('#pAm','۴۵۶۷۸',{delay:25});
v=await pg.inputValue('#pAm'); ck(v==='۴۵٬۶۷۸','ارقام فارسی: '+v);
// مانده طرف حساب کنار نام
const opt=await pg.textContent('#pCt option[value="1"]');
ck(/بدهکار/.test(opt),'مانده کنار نام شخص: '+opt.trim());
// اعتبارسنجی
await pg.evaluate(()=>document.querySelector('#modalFoot .btn').click());
await pg.waitForTimeout(400);
ck(await pg.evaluate(()=>document.getElementById('pCt').classList.contains('invalid')),'فیلد اجباری خالی برجسته شد');
ck(await pg.evaluate(()=>document.getElementById('modalOverlay').classList.contains('show')),'فرم بسته نشد');
// میان‌بر تاریخ
await pg.click('.qb[data-fill="pDt"][data-days="30"]'); await pg.waitForTimeout(200);
const d30=await pg.inputValue('#pDt');
ck(/^\d{4}\/\d{2}\/\d{2}$/.test(d30) && d30!==await pg.evaluate(()=>todayJ()),'میان‌بر ۱ ماه: '+d30);
// ذخیره واقعی
await pg.selectOption('#pCt','1'); await pg.fill('#pAm','۲٬۰۰۰٬۰۰۰');
await pg.evaluate(()=>document.querySelector('#modalFoot .btn').click());
await pg.waitForTimeout(700);
const saved=await pg.evaluate(async()=>(await DB.all('payments')).map(x=>x.amount));
ck(saved.length===1 && saved[0]===2000000,'ذخیره مبلغ با جداکننده: '+JSON.stringify(saved));

console.log('\n— موجودی کنار نام کالا در فاکتور —');
await pg.evaluate(()=>{location.hash='#invoices'});await pg.waitForTimeout(600);
await pg.evaluate(()=>Inv.showF('sale'));await pg.waitForTimeout(700);
const o1=await pg.evaluate(()=>Inv.prodOpts);
ck(/موجودی: ۳۷ متر/.test(o1),'موجودی کالای موجود در فهرست');
ck(/ناموجود/.test(o1),'برچسب ناموجود برای کالای بدون موجودی');
// انتخاب کالا و اطمینان از اینکه چیزی از موجودی وارد ردیف نشد
await pg.evaluate(()=>{Inv.ai();Inv.oc(0,'p','1');});await pg.waitForTimeout(400);
const item=await pg.evaluate(()=>JSON.stringify(Inv.items[0]));
ck(!/37|موجودی/.test(item),'موجودی وارد ردیف فاکتور نشد: '+item);

console.log('\n— ویرایش شخص مانده را صفر نمی‌کند —');
await pg.evaluate(()=>UI.close());
await pg.evaluate(()=>{location.hash='#contacts'});await pg.waitForTimeout(600);
await pg.evaluate(()=>Con.form(1));await pg.waitForTimeout(500);
ck(await pg.evaluate(()=>!document.getElementById('cBl')),'فیلد مانده در ویرایش نیست');
await pg.fill('#cNm','بازرگانی نوید (اصلاح)');
await pg.evaluate(()=>document.querySelector('#modalFoot .btn').click());
await pg.waitForTimeout(700);
const bal=await pg.evaluate(async()=>(await DB.get('contacts',1)).balance);
ck(bal===4500000,'مانده پس از ویرایش دست‌نخورده: '+bal);

console.log(fail?'\n✗ '+fail+' مورد مردود':'\n✓ همه قبول');
await b.close(); process.exit(fail?1:0);
})();
