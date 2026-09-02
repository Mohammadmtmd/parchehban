const {chromium}=require('playwright-core');
const PORT=process.env.PB_PORT||'8000';const BASE='http://localhost:'+PORT;
let fail=0; const ck=(c,m)=>{console.log((c?'  ✓ ':'  ✗ ')+m); if(!c)fail++;};
const login=async(pg)=>{await pg.fill('#loginUser','admin');await pg.fill('#loginPass','admin123');
  await pg.click('#loginBtn');await pg.waitForTimeout(2200);};
(async()=>{
const b=await chromium.launch({executablePath:process.env.PB_CHROME,args:['--no-sandbox']});
const ctx=await b.newContext({viewport:{width:1300,height:900},acceptDownloads:true});
const pg=await ctx.newPage();
pg.on('pageerror',e=>{console.log('PAGEERROR',e.message);fail++;});
await pg.route('**/*',r=>r.request().url().startsWith(BASE)?r.continue():r.abort());
await pg.goto(BASE+'/index.html',{waitUntil:'domcontentloaded'});await pg.waitForTimeout(1700);
await login(pg);

console.log('\n— برنامه خالی: نباید هشدار بدهد —');
await pg.waitForTimeout(1800);
ck(!await pg.$('#bkBanner'),'با نبودن سند، هشداری نمی‌آید');

console.log('\n— اولین بار، با سند ثبت‌شده —');
await pg.evaluate(async()=>{
  await DB.put('contacts',{id:1,name:'نوید',type:'both',balance:0});
  for(let i=1;i<=3;i++) await DB.put('invoices',{id:i,type:'sale',invoiceNumber:'S'+i,
    date:todayJ(),contactId:1,items:[],total:0,paidAmount:0});
});
await pg.evaluate(()=>Backup.check());await pg.waitForTimeout(600);
ck(!!await pg.$('#bkBanner'),'هشدار «هیچ پشتیبانی نگرفته‌اید» آمد');
let tx=await pg.textContent('#bkBanner .bk-tx');
ck(/هیچ پشتیبانی نگرفته/.test(tx),'متن درست: '+tx.slice(0,60).replace(/\s+/g,' '));

console.log('\n— گرفتن پشتیبان هشدار را می‌بندد —');
const dl=pg.waitForEvent('download',{timeout:15000});
await pg.click('#bkBanner .bk-go');
const d=await dl; await pg.waitForTimeout(900);
ck(/parchehban-backup-.*\.json/.test(d.suggestedFilename()),'فایل دانلود شد: '+d.suggestedFilename());
ck(!await pg.$('#bkBanner'),'نوار بسته شد');
const rec=await pg.evaluate(()=>JSON.parse(localStorage.getItem('pb_last_backup')));
ck(rec && rec.docs===3,'زمان و تعداد سند ثبت شد: '+JSON.stringify(rec));

console.log('\n— بلافاصله بعدش نباید دوباره هشدار بدهد —');
await pg.evaluate(()=>Backup.check());await pg.waitForTimeout(500);
ck(!await pg.$('#bkBanner'),'هشدار تکراری نمی‌آید');

console.log('\n— بعد از ۲۰ سند تازه —');
await pg.evaluate(async()=>{for(let i=10;i<32;i++) await DB.put('invoices',{id:i,type:'sale',
  invoiceNumber:'S'+i,date:todayJ(),contactId:1,items:[],total:0,paidAmount:0});});
await pg.evaluate(()=>Backup.check());await pg.waitForTimeout(600);
ck(!!await pg.$('#bkBanner'),'با انباشت سند دوباره هشدار داد');
tx=await pg.textContent('#bkBanner .bk-tx');
ck(/سند تازه ثبت شده/.test(tx),'دلیل درست ذکر شد');

console.log('\n— بعد از ۷ روز —');
await pg.evaluate(()=>{document.getElementById('bkBanner').remove();
  const r=JSON.parse(localStorage.getItem('pb_last_backup'));
  r.at=Date.now()-8*86400000; r.docs=5;
  localStorage.setItem('pb_last_backup',JSON.stringify(r));});
await pg.evaluate(async()=>{await DB.put('invoices',{id:200,type:'sale',invoiceNumber:'S200',
  date:todayJ(),contactId:1,items:[],total:0,paidAmount:0});});
await pg.evaluate(()=>Backup.check());await pg.waitForTimeout(600);
ck(!!await pg.$('#bkBanner'),'با گذشت زمان هشدار داد');
tx=await pg.textContent('#bkBanner .bk-tx');
ck(/روز از آخرین پشتیبان/.test(tx),'دلیل زمانی ذکر شد: '+tx.slice(0,50).replace(/\s+/g,' '));

console.log('\n— «بعداً» تا پایان نشست ساکت می‌کند —');
await pg.click('#bkBanner .bk-x');await pg.waitForTimeout(400);
ck(!await pg.$('#bkBanner'),'با «بعداً» بسته شد');
ck(await pg.evaluate(()=>sessionStorage.getItem('pb_bk_snooze')==='1'),'علامت نشست ثبت شد');
await pg.evaluate(()=>Auth.logout());await pg.waitForTimeout(500);
await login(pg); await pg.waitForTimeout(2000);
ck(!await pg.$('#bkBanner'),'در همان نشست دوباره نیامد');
// نشست تازه = باید دوباره بیاید
await pg.evaluate(()=>sessionStorage.clear());
await pg.evaluate(()=>Auth.logout());await pg.waitForTimeout(500);
await login(pg); await pg.waitForTimeout(2200);
ck(!!await pg.$('#bkBanner'),'در نشست تازه دوباره آمد');

console.log(fail?'\n✗ '+fail+' مورد مردود':'\n✓ همه قبول');
await b.close();process.exit(fail?1:0);
})();
