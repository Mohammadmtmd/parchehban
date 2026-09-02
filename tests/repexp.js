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
const ctx=await b.newContext({viewport:{width:1400,height:900},acceptDownloads:true});
const pg=await ctx.newPage();
pg.on('pageerror',e=>console.log('!! ERR',e.message));
await pg.route('**/*',r=>r.request().url().startsWith(BASE)?r.continue():r.abort());
await pg.goto(BASE+'/index.html',{waitUntil:'domcontentloaded'});
await pg.waitForTimeout(1800);
await pg.fill('#loginUser','admin');await pg.fill('#loginPass','admin123');
await pg.click('#loginBtn');await pg.waitForTimeout(1800);
await pg.evaluate(async()=>{
  await DB.put('banks',{id:1,name:'ملت',accountNo:'1',openingBalance:0});
  await DB.put('contacts',{id:1,name:'مشتری الف',type:'both',balance:0});
  await DB.put('contacts',{id:2,name:'تأمین‌کننده ب',type:'both',balance:0});
  await DB.put('categories',{id:1,name:'پارچه'});
  await DB.put('products',{id:1,name:'کتان آبی',categoryId:1,unit:'متر',stock:80,price:1000,buyPrice:600});
  const fy=(await DB.all('fiscalYears'))[0];
  await DB.add('invoices',{type:'purchase',fiscalYearId:fy.id,contactId:2,date:todayJ(),invoiceNumber:'P1',
    items:[{productId:1,qty:100,price:600,total:60000}],grandTotal:60000,paidAmount:60000,bankId:1});
  await DB.add('invoices',{type:'sale',fiscalYearId:fy.id,contactId:1,date:todayJ(),invoiceNumber:'S1',
    items:[{productId:1,qty:20,price:1000,total:20000}],grandTotal:20000,paidAmount:0,bankId:null});
  // خرید نسیه تا یک بستانکار واقعی داشته باشیم
  await DB.add('invoices',{type:'purchase',fiscalYearId:fy.id,contactId:2,date:todayJ(),invoiceNumber:'P2',
    items:[{productId:1,qty:10,price:600,total:6000}],grandTotal:6000,paidAmount:0,bankId:null});
});
await pg.evaluate(()=>{location.hash='#reports'}); await pg.waitForTimeout(1200);
const tabs=[['summary','خلاصه'],['purchases','خرید'],['sales','فروش'],['stock','موجودی'],['profit','سود و زیان'],['debtors','بدهکاران'],['creditors','بستانکاران']];
for(const [k,fa] of tabs){
  await pg.evaluate(async x=>{Rep._c=x; await Rep[x](); Rep._btns();},k);
  await pg.waitForTimeout(400);
  const g=await pg.evaluate(()=>Rep._grab());
  const hasBtn=await pg.evaluate(()=>!!document.querySelector('button[onclick="Rep.expCSV()"]'));
  // خروجی واقعی CSV را می‌گیریم
  let dl='—';
  try{
    const [d1]=await Promise.all([pg.waitForEvent('download',{timeout:4000}),pg.evaluate(()=>Rep.expCSV())]);
    const p=await d1.path(); dl=fs.readFileSync(p,'utf8').split('\n').length+' خط';
  }catch(e){dl='بدون فایل';}
  console.log((g&&g.rows.length&&hasBtn?'✓ ':'✗ ')+fa.padEnd(12)+' ستون:'+String(g?g.head.length:0)+
    ' ردیف:'+String(g?g.rows.length:0).padStart(3)+' دکمه:'+(hasBtn?'دارد':'ندارد')+' فایل:'+dl);
}
await b.close();
})();
