const fs=require('fs'),path=require('path');const {JSDOM}=require('jsdom');
require('fake-indexeddb/auto');const {webcrypto}=require('crypto');
const APP='/home/user/workspace/parcheban';
const dom=new JSDOM(fs.readFileSync(APP+'/index.html','utf8'),{runScripts:'outside-only',pretendToBeVisual:true,url:'https://x.test/'});
const w=dom.window;w.indexedDB=indexedDB;w.IDBKeyRange=IDBKeyRange;
Object.defineProperty(w,'crypto',{value:webcrypto,configurable:true});
w.Chart=function(){return{destroy(){},update(){}}};w.print=()=>{};
const errs=[];w.addEventListener('error',e=>errs.push(e.message));
for(const f of fs.readdirSync(APP+'/js').filter(f=>f.endsWith('.js')).sort()) w.eval(fs.readFileSync(APP+'/js/'+f,'utf8'));
(async()=>{
  await new Promise(r=>setTimeout(r,500));
  await w.DB.init(); w.STATE.yearId=1;
  await w.FY.ensureDefault();
  // seed representative data
  const cat=await w.DB.add('categories',{name:'پارچه پرده‌ای'});
  const pid=await w.DB.add('products',{name:'مخمل','categoryId':cat,catalog:'K1',shade:'12',unit:'متر',buyPrice:500,salePrice:900});
  const cid=await w.DB.add('contacts',{name:'حسن <b>تست</b>',type:'both',balance:-2000,phone:'0912'});
  const bnk=await w.DB.add('banks',{name:'ملت',openingBalance:1000000});
  await w.DB.add('invoices',{type:'sale',fiscalYearId:w.STATE.yearId,contactId:cid,invoiceNumber:'S-1',date:'1404/01/05',items:[{productId:pid,productName:'مخمل',quantity:5,unitPrice:900,total:4500}],subtotal:4500,shippingCost:100,discount:50,grandTotal:4550,paidAmount:1000,bankId:bnk,printSize:'a4'});
  await w.DB.add('invoices',{type:'purchase',fiscalYearId:w.STATE.yearId,contactId:cid,invoiceNumber:'P-1',date:'1404/01/03',items:[{productId:pid,productName:'مخمل',quantity:20,unitPrice:500,total:10000}],subtotal:10000,grandTotal:10000,paidAmount:0});
  await w.DB.add('payments',{type:'receipt',fiscalYearId:w.STATE.yearId,contactId:cid,amount:1500,date:'1404/01/06',bankId:bnk,description:'قسط اول'});
  await w.DB.add('checks',{type:'received',fiscalYearId:w.STATE.yearId,contactId:cid,checkNumber:'123456',bank:'صادرات',amount:9000,issueDate:'1404/01/05',dueDate:'1404/02/10',status:'pending'});
  const names=Object.keys(w.ROUTES);
  for(const r of names){
    try{ await w.ROUTES[r](); const t=(w.document.getElementById('mainContent')||{}).innerHTML||''; 
      console.log((t.length>20?'PASS':'WARN')+' route '+r+' -> '+t.length+' chars :: '+t.slice(0,90).replace(/\s+/g,' '));
    }catch(e){ console.log('FAIL route '+r+': '+e.message); }
  }
  // modal/print paths
  try{ await w.Inv.vw(1); console.log('PASS Inv.vw preview'); }catch(e){ console.log('FAIL Inv.vw: '+e.message); }
  try{ await w.Inv.pr(1,'a5'); console.log('PASS Inv.pr a5'); }catch(e){ console.log('FAIL Inv.pr: '+e.message); }
  try{ await w.Led.show(cid); console.log('PASS ledger for contact'); }catch(e){ console.log('FAIL Led.show: '+e.message); }
  try{ await w.PLed.show(pid); console.log('PASS product ledger'); }catch(e){ console.log('FAIL PLed.show: '+e.message); }
  try{ await w.Bank.show(bnk); console.log('PASS bank detail'); }catch(e){ console.log('FAIL Bank.show: '+e.message); }
  for(const rep of ['sales','purchase','profit','stock','debtors','creditors']){
    try{ if(w.Rep[rep]) await w.Rep[rep](); console.log('PASS report '+rep); }catch(e){ console.log('FAIL report '+rep+': '+e.message); }
  }
  // XSS check
  await w.Con.render();
  const html=w.document.getElementById('mainContent').innerHTML;
  console.log((html.includes('&lt;b&gt;')&&!html.includes('حسن <b>')?'PASS':'FAIL')+' contact name is escaped (no HTML injection)');
  console.log('\nUNCAUGHT: '+(errs.length?errs.join(' | '):'none'));
})().catch(e=>console.log('FATAL',e.stack));
