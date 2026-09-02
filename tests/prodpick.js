const {chromium}=require('playwright-core');
const PORT=process.env.PB_PORT||'8000';const BASE='http://localhost:'+PORT;
let fail=0; const ck=(c,m)=>{console.log((c?'  ✓ ':'  ✗ ')+m); if(!c)fail++;};
(async()=>{
const b=await chromium.launch({executablePath:process.env.PB_CHROME,args:['--no-sandbox']});
const pg=await b.newPage({viewport:{width:1400,height:950}});
pg.on('pageerror',e=>{console.log('PAGEERROR',e.message);fail++;});
await pg.route('**/*',r=>r.request().url().startsWith(BASE)?r.continue():r.abort());
await pg.goto(BASE+'/index.html',{waitUntil:'domcontentloaded'});await pg.waitForTimeout(1700);
await pg.fill('#loginUser','admin');await pg.fill('#loginPass','admin123');
await pg.click('#loginBtn');await pg.waitForTimeout(1700);
await pg.evaluate(async()=>{
  await DB.put('contacts',{id:1,name:'بازرگانی نوید',type:'both',balance:0});
  await DB.put('products',{id:1,name:'کتان کشی عرض ۱۵۰',unit:'متر',colorCatalog:'C-4120',colorShade:'آبی نفتی'});
  await DB.put('products',{id:2,name:'حریر صورتی',unit:'متر',colorCatalog:'H-900'});
  await DB.put('products',{id:3,name:'کتان ساده',unit:'متر'});
  await DB.put('invoices',{id:1,type:'purchase',invoiceNumber:'P1',date:todayJ(),contactId:1,
    items:[{productId:1,quantity:37,unitPrice:1000}],total:37000,paidAmount:0});
});
await pg.evaluate(()=>{location.hash='#invoices'});await pg.waitForTimeout(600);
await pg.evaluate(()=>Inv.showF('sale'));await pg.waitForTimeout(800);
await pg.evaluate(()=>Inv.ai());await pg.waitForTimeout(400);

console.log('\n— جست‌وجوی تایپی —');
await pg.click('#pp0'); await pg.waitForTimeout(300);
ck(await pg.evaluate(()=>document.getElementById('ppList').classList.contains('show')),'با کلیک فهرست باز شد');
ck(await pg.evaluate(()=>document.querySelectorAll('#ppList .pp-it').length===3),'هر ۳ کالا نمایش داده شد');
await pg.type('#pp0','کتان',{delay:40}); await pg.waitForTimeout(300);
ck(await pg.evaluate(()=>document.querySelectorAll('#ppList .pp-it').length===2),'فیلتر «کتان» → ۲ نتیجه');
// جست‌وجو با کد کالیته
await pg.fill('#pp0',''); await pg.type('#pp0','H-900',{delay:40}); await pg.waitForTimeout(300);
ck(await pg.evaluate(()=>document.querySelectorAll('#ppList .pp-it').length===1),'جست‌وجو با کد کالیته');
// حرف عربی ي به‌جای ی فارسی
await pg.fill('#pp0',''); await pg.type('#pp0','حرير',{delay:40}); await pg.waitForTimeout(300);
ck(await pg.evaluate(()=>document.querySelectorAll('#ppList .pp-it').length===1),'ی عربی هم پیدا می‌کند');
// موجودی در فهرست
await pg.fill('#pp0',''); await pg.type('#pp0','کتان کشی',{delay:40}); await pg.waitForTimeout(300);
const st=await pg.textContent('#ppList .pp-it .pp-st');
ck(/موجودی: ۳۷ متر/.test(st),'موجودی در فهرست: '+st.trim());

console.log('\n— انتخاب با صفحه‌کلید —');
await pg.keyboard.press('Enter'); await pg.waitForTimeout(500);
const pid=await pg.evaluate(()=>Inv.items[0].productId);
ck(pid===1,'Enter کالا را انتخاب کرد: '+pid);
ck(await pg.evaluate(()=>document.getElementById('cat0').value==='C-4120'),'کالیته خودکار پر شد');
ck(await pg.evaluate(()=>document.getElementById('sh0').value==='آبی نفتی'),'شید خودکار پر شد');
ck(await pg.evaluate(()=>document.activeElement.id==='q0'),'مکان‌نما به فیلد تعداد رفت');
ck(!await pg.evaluate(()=>document.getElementById('ppList').classList.contains('show')),'فهرست بسته شد');
ck(await pg.evaluate(()=>document.getElementById('modalOverlay').classList.contains('show')),'Enter فاکتور را ثبت نکرد');

console.log('\n— انتخاب با موس —');
await pg.evaluate(()=>Inv.ai());await pg.waitForTimeout(400);
await pg.click('#pp1');await pg.waitForTimeout(300);
await pg.click('#ppList .pp-it[data-pid="2"]');await pg.waitForTimeout(500);
ck(await pg.evaluate(()=>Inv.items[1].productId)===2,'کلیک کالا را انتخاب کرد');

console.log('\n— پاک کردن و متن نامعتبر —');
await pg.fill('#pp1',''); await pg.click('#pp0'); await pg.waitForTimeout(500);
ck(await pg.evaluate(()=>Inv.items[1].productId)==='','خالی کردن انتخاب را پاک کرد');
await pg.fill('#pp1','چیز نامربوط'); await pg.click('#pp0'); await pg.waitForTimeout(500);
ck(await pg.evaluate(()=>document.getElementById('pp1').classList.contains('pp-bad')),'متن نامعتبر علامت خورد');

console.log('\n— ثبت واقعی فاکتور —');
await pg.evaluate(()=>{PPick.hide();Inv.ri2(1);});await pg.waitForTimeout(400);
await pg.selectOption('#iCt','1');
await pg.evaluate(()=>{Inv.oc(0,'q','5');Inv.oc(0,'u','200000');});
await pg.waitForTimeout(300);
await pg.evaluate(()=>document.querySelector('#modalFoot .btn.bp').click());
await pg.waitForTimeout(1000);
const invs=await pg.evaluate(async()=>(await DB.all('invoices')).filter(i=>i.type==='sale').map(i=>i.items));
ck(invs.length===1 && invs[0][0].productId===1 && invs[0][0].quantity===5,
   'فاکتور با کالای انتخابی ذخیره شد: '+JSON.stringify(invs[0]));

console.log(fail?'\n✗ '+fail+' مورد مردود':'\n✓ همه قبول');
await b.close();process.exit(fail?1:0);
})();
