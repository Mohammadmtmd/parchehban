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

async function scenario(name,routeFn){
  const ctx=await b.newContext({viewport:{width:1280,height:820}});
  const pg=await ctx.newPage();
  const errs=[];
  pg.on('pageerror',e=>errs.push(e.message));
  await pg.route('**/*',routeFn);
  pg.goto(BASE+'/index.html').catch(()=>{});
  await pg.waitForTimeout(7000);
  const st=await pg.evaluate(()=>({
    ready:!!window.APP_READY,
    core:typeof window.elVal,
    loading:(document.getElementById('loadingScreen')||{}).style.display,
    loginShown:document.getElementById('loginPage')&&getComputedStyle(document.getElementById('loginPage')).display!=='none',
    userField:!!document.getElementById('loginUser'),
    fontOk:getComputedStyle(document.body).fontFamily.indexOf('Vazirmatn')>-1
  })).catch(e=>({fail:String(e).slice(0,60)}));
  console.log('['+name+']');
  console.log('   اسکریپت‌ها اجرا شد: '+(st.core==='function'?'بله':'خیر')+
    ' | APP_READY: '+st.ready+' | لودینگ: '+(st.loading==='none'?'پنهان':'*** مانده ***')+
    ' | فرم ورود: '+(st.loginShown?'نمایش داده شد':'نه')+
    ' | فیلد کاربر: '+(st.userField?'دارد':'ندارد')+' | فونت: '+(st.fontOk?'وزیرمتن':'پیش‌فرض'));
  if(errs.length) console.log('   خطا: '+errs.join(' / '));
  await pg.screenshot({path:'/tmp/shots/off-'+name+'.png',timeout:15000}).catch(()=>{});
  await ctx.close();
}

// ۱) هیچ اینترنتی نیست، درخواست‌های بیرونی بی‌جواب می‌مانند (همان حالتی که باگ را ساخت)
await scenario('بی‌جواب-ماندن-CDN',async r=>{
  if(r.request().url().startsWith(BASE)) return r.continue();
  return new Promise(()=>{});
});
// ۲) هیچ اینترنتی نیست، درخواست‌های بیرونی خطا می‌دهند
await scenario('قطع-کامل-اینترنت',r=>
  r.request().url().startsWith(BASE)?r.continue():r.abort());
await b.close();
})();
