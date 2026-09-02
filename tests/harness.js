/* بارگذاری برنامه دقیقاً بر اساس تگ‌های <script> داخل index.html
   تا اگر فایلی جا افتاده باشد تست شکست بخورد. */
const fs=require('fs'),path=require('path');
const {JSDOM}=require('jsdom');
require('fake-indexeddb/auto');
const {webcrypto}=require('crypto');

const APP=path.resolve(__dirname,'..');  /* ریشه پروژه، مستقل از مسیر نصب */
function boot(){
  const html=fs.readFileSync(path.join(APP,'index.html'),'utf8');
  const dom=new JSDOM(html,{runScripts:'outside-only',pretendToBeVisual:true,url:'https://x.test/'});
  const w=dom.window;
  w.indexedDB=indexedDB; w.IDBKeyRange=IDBKeyRange;
  Object.defineProperty(w,'crypto',{value:webcrypto,configurable:true});
  w.Chart=function(){return{destroy(){},update(){}}};
  w.print=()=>{};
  w.alert=()=>{};
  const errs=[];
  w.addEventListener('error',e=>errs.push('window.error: '+e.message));
  // استخراج ترتیب واقعی اسکریپت‌ها از index.html
  const order=[...html.matchAll(/<script[^>]+src="(js\/[^"]+)"/g)].map(m=>m[1]);
  const onDisk=fs.readdirSync(path.join(APP,'js')).filter(f=>f.endsWith('.js')).sort();
  const declared=order.map(o=>o.replace('js/',''));
  const missing=onDisk.filter(f=>!declared.includes(f));
  const ghost=declared.filter(f=>!onDisk.includes(f));
  for(const rel of order){
    const fp=path.join(APP,rel);
    if(!fs.existsSync(fp)){ errs.push('MISSING FILE '+rel); continue; }
    try{ w.eval(fs.readFileSync(fp,'utf8')); }
    catch(e){ errs.push('EVAL '+rel+': '+e.message); }
  }
  return {w,errs,order,missing,ghost};
}
module.exports={boot,APP};
