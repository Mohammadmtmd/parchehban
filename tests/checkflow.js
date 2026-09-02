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
const pg=await b.newPage({viewport:{width:1400,height:900}});
pg.on('pageerror',e=>console.log('!! ERR',e.message));
await pg.route('**/*',r=>r.request().url().startsWith(BASE)?r.continue():r.abort());
await pg.goto(BASE+'/index.html',{waitUntil:'domcontentloaded'});
await pg.waitForTimeout(1800);
await pg.fill('#loginUser','admin');await pg.fill('#loginPass','admin123');
await pg.click('#loginBtn');await pg.waitForTimeout(1800);
const R=await pg.evaluate(async()=>{
  const L=[];const ok=(n,c,extra)=>L.push((c?'✓ ':'✗ ')+n+(extra!==undefined?'  ['+extra+']':''));
  await DB.put('banks',{id:1,name:'ملت',accountNo:'1',openingBalance:0});
  await DB.put('contacts',{id:1,name:'مشتری الف',type:'both',balance:0});
  await DB.put('categories',{id:1,name:'پارچه'});
  await DB.put('products',{id:1,name:'کتان',categoryId:1,unit:'متر',stock:100,price:1000,buyPrice:500});
  const fy=(await DB.all('fiscalYears'))[0];

  // ── سناریو: فروش ۱۰۰٬۰۰۰ نسیه، بعد چک ۱۰۰٬۰۰۰ می‌گیریم، بعد وصول می‌شود
  const invId=await DB.add('invoices',{type:'sale',fiscalYearId:fy.id,contactId:1,date:todayJ(),
    invoiceNumber:'2001',items:[{productId:1,qty:100,price:1000,total:100000}],
    grandTotal:100000,paidAmount:0,bankId:null});
  await Inv.syncAutoPayment(invId);
  ok('پس از فروش نسیه، طرف ۱۰۰٬۰۰۰ بدهکار است', await Inv.contactBal(1)===100000, await Inv.contactBal(1));

  const ckId=await DB.add('checks',{type:'received',fiscalYearId:fy.id,contactId:1,amount:100000,
    checkNumber:'55',bank:'صادرات',dueDate:todayJ(),issueDate:todayJ(),status:'pending',bankAccountId:1});
  await Chk.syncAutoPayment(ckId);
  ok('چک در انتظار: بدهی طرف صفر شد', await Inv.contactBal(1)===0, await Inv.contactBal(1));
  ok('چک در انتظار: هنوز سند خودکار ندارد',
     (await DB.all('payments')).filter(p=>p.sourceCheckId).length===0);
  ok('چک در انتظار: مانده بانک صفر است', await Bank.balance(1)===0, await Bank.balance(1));

  // وصول
  const c=await DB.get('checks',ckId); c.status='passed'; c.passedDate=todayJ();
  await DB.put('checks',c); await Chk.syncAutoPayment(ckId);
  const auto=(await DB.all('payments')).filter(p=>p.sourceCheckId);
  ok('وصول: سند خودکار ساخته شد', auto.length===1);
  ok('وصول: نوع سند «دریافت» است', auto[0]&&auto[0].type==='receipt');
  ok('وصول: مانده بانک ۱۰۰٬۰۰۰ شد', await Bank.balance(1)===100000, await Bank.balance(1));
  ok('وصول: بدهی طرف همچنان صفر (دوبار کم نشد)', await Inv.contactBal(1)===0, await Inv.contactBal(1));

  // دفتر بانک باید با مانده بخواند
  await Bank.show(1); await new Promise(r=>setTimeout(r,400));
  const cells=[...document.querySelectorAll('#mainContent tbody tr')].map(t=>t.innerText.replace(/\s+/g,' ').trim());
  const last=cells[cells.length-1]||'';
  ok('دفتر بانک با مانده بانک می‌خواند', last.includes('۱۰۰٬۰۰۰'), last);
  ok('دفتر بانک ردیف تکراری ندارد', cells.length===2, cells.length+' ردیف');

  // برگشت خوردن چک
  const c2=await DB.get('checks',ckId); c2.status='returned'; await DB.put('checks',c2);
  await Chk.syncAutoPayment(ckId);
  ok('برگشتی: سند خودکار حذف شد',(await DB.all('payments')).filter(p=>p.sourceCheckId).length===0);
  ok('برگشتی: مانده بانک صفر شد', await Bank.balance(1)===0, await Bank.balance(1));
  ok('برگشتی: بدهی طرف دوباره ۱۰۰٬۰۰۰ شد', await Inv.contactBal(1)===100000, await Inv.contactBal(1));

  // حذف چک وصول‌شده
  const c3=await DB.get('checks',ckId); c3.status='passed'; await DB.put('checks',c3);
  await Chk.syncAutoPayment(ckId);
  await DB.del('checks',ckId); await Chk.syncAutoPayment(ckId);
  ok('حذف چک: سند یتیم نماند',(await DB.all('payments')).filter(p=>p.sourceCheckId).length===0);
  ok('حذف چک: مانده بانک صفر', await Bank.balance(1)===0, await Bank.balance(1));
  return L;
});
R.forEach(l=>console.log(l));
console.log('\nنتیجه: '+R.filter(x=>x[0]==='✓').length+' قبول / '+R.filter(x=>x[0]==='✗').length+' مردود');
await b.close();
})();
