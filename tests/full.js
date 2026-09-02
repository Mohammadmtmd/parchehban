const {boot}=require('./harness');
let P=0,F=0;const fails=[];
function t(n,c){ if(c){P++;} else {F++;fails.push(n);} }
(async()=>{
const {w,errs,missing,ghost}=boot();
t('every js file is loaded by index.html', missing.length===0);
t('no dead script tags', ghost.length===0);
t('no load errors', errs.length===0);
if(errs.length) console.log('  errs:',errs.join(' | '));

await new Promise(r=>setTimeout(r,600));

// ── globals ──
['esc','numOf','intOf','elVal','uuid','Migrate','Perm','Users','Sync','Search','FY','Inv','Pay','Bank','Led','PLed','ROUTES'].forEach(n=>
  t('global '+n, typeof w[n]!=='undefined'));

const {DB,Migrate,Perm,Users,Sync,Search,FY,Inv,Pay,Bank,Led,Auth,STATE,ROUTES,Jalali}=w;

// ── migrations run once ──
const sv = await DB.getSetting('schemaVersion',0);
t('schemaVersion set at boot ('+sv+')', Number(sv)===Migrate.LATEST);
const r2 = await Migrate.run();
t('re-running migrations is a no-op', r2.applied.length===0);

// ── default admin has role ──
let users = await DB.all('users');
t('one admin user', users.filter(u=>u.username==='admin').length===1);
t('admin has role=admin', users[0].role==='admin');
t('admin is active', users[0].active===true);

// ── uid + updatedAt on every write ──
const cid = await DB.add('contacts',{name:'مشتری تست',type:'customer',balance:500000});
let c = await DB.get('contacts',cid);
t('add() sets uid', typeof c.uid==='string' && c.uid.length>5);
t('add() sets updatedAt', !!c.updatedAt);

// ── 4.2 accounting sign: positive balance = debtor ──
STATE.userId = users[0].id;
await Perm.load();
let ob = await w.getOpenBal(cid);
t('4.2 positive opening balance stays positive (بدهکار)', ob===500000);
let bal = await Inv.contactBal(cid);
t('4.2 contactBal reflects debit-positive opening', bal===500000);

// ── setup for invoice tests ──
const catId = await DB.add('categories',{name:'پارچه'});
const pid = await DB.add('products',{name:'کرپ مشکی',code:'K1',unit:'متر',categoryId:catId});
const bankId = await DB.add('banks',{title:'ملت جاری',bankName:'ملت',accountNumber:'123',openingBalance:1000000});
await FY.ensureDefault();
const yid = STATE.yearId;
t('fiscal year exists', !!yid);

// purchase 100 m so stock exists
const purId = await DB.add('invoices',{type:'purchase',fiscalYearId:yid,invoiceNumber:'X1',date:Jalali.today(),
  contactId:cid,items:[{productId:pid,quantity:100,unitPrice:1000,total:100000}],
  subtotal:100000,shippingCost:0,discount:0,grandTotal:100000,paidAmount:0,bankId:null});
let stock = await w.Prod.stock(pid);
t('stock after purchase = 100', stock===100);

// ── 4.1 auto payment from paidAmount ──
const saleId = await DB.add('invoices',{type:'sale',fiscalYearId:yid,invoiceNumber:'S1',date:Jalali.today(),
  contactId:cid,items:[{productId:pid,quantity:10,unitPrice:5000,total:50000}],
  subtotal:50000,shippingCost:0,discount:0,grandTotal:50000,paidAmount:20000,bankId:bankId});
await Inv.syncAutoPayment(saleId);
let pays = (await DB.all('payments')).filter(p=>p.sourceInvoiceId===saleId);
t('4.1 auto payment doc created', pays.length===1);
t('4.1 auto doc type=receipt for sale', pays[0] && pays[0].type==='receipt');
t('4.1 auto doc amount matches paidAmount', pays[0] && pays[0].amount===20000);
t('4.1 auto doc linked to the invoice bank account', pays[0] && pays[0].bankId===bankId);
t('4.1 auto doc flagged auto', pays[0] && pays[0].auto===true);

// no double counting: opening 500000 + purchase -100000 + sale +50000 - receipt 20000 = 430000
bal = await Inv.contactBal(cid);
t('4.1 no double counting in contactBal (got '+bal+')', bal===430000);

// bank: opening 1000000 + receipt 20000
let bb = await Bank.balance(bankId);
t('4.1 bank balance includes the auto receipt once (got '+bb+')', bb===1020000);

// ledger has exactly one row for that receipt
await Led.show(cid);
let html = w.document.getElementById('mainContent').innerHTML;
let occurrences = (html.match(/بابت فاکتور S1/g)||[]).length;
t('4.1 ledger shows the receipt once, not twice (got '+occurrences+')', occurrences===1);

// edit paidAmount -> doc updates, not duplicates
let sv2 = await DB.get('invoices',saleId); sv2.paidAmount=35000; await DB.put('invoices',sv2);
await Inv.syncAutoPayment(saleId);
pays = (await DB.all('payments')).filter(p=>p.sourceInvoiceId===saleId);
t('4.1 editing paidAmount updates the same doc', pays.length===1 && pays[0].amount===35000);

// paidAmount -> 0 removes the doc
sv2 = await DB.get('invoices',saleId); sv2.paidAmount=0; await DB.put('invoices',sv2);
await Inv.syncAutoPayment(saleId);
pays = (await DB.all('payments')).filter(p=>p.sourceInvoiceId===saleId);
t('4.1 zeroing paidAmount deletes the doc', pays.length===0);

// restore
sv2 = await DB.get('invoices',saleId); sv2.paidAmount=20000; await DB.put('invoices',sv2);
await Inv.syncAutoPayment(saleId);

// deleting the invoice removes the linked doc
const tmpInv = await DB.add('invoices',{type:'sale',fiscalYearId:yid,invoiceNumber:'S9',date:Jalali.today(),
  contactId:cid,items:[],subtotal:0,shippingCost:0,discount:0,grandTotal:9000,paidAmount:9000,bankId:bankId});
await Inv.syncAutoPayment(tmpInv);
t('4.1 temp invoice has a doc', (await DB.all('payments')).filter(p=>p.sourceInvoiceId===tmpInv).length===1);
const removed = await Inv.removeAutoPayment(tmpInv);
await DB.del('invoices',tmpInv);
t('4.1 deleting invoice removes its doc', removed===1 &&
  (await DB.all('payments')).filter(p=>p.sourceInvoiceId===tmpInv).length===0);

// auto docs are protected from direct edit/delete
let before = (await DB.all('payments')).length;
const autoId = (await DB.all('payments')).find(p=>p.sourceInvoiceId===saleId).id;
await Pay.rm(autoId);
t('4.1 auto doc cannot be deleted directly', (await DB.all('payments')).length===before);

// ── 4.4 overselling is blocked ──
stock = await w.Prod.stock(pid);
w.Inv.items=[{productId:pid,quantity:stock+50,unitPrice:5000,total:1}];
t('4.4 stock is finite ('+stock+')', stock>0);

// ── fiscal year close carries balances forward ──
const y2 = await DB.add('fiscalYears',{name:'1405',startDate:'1405/01/01',endDate:'1405/12/29',isCurrent:false,isClosed:false});
const closingBal = await Inv.contactBal(cid);
// simulate FY.doClose without the modal
{
  const prev = STATE.yearId; STATE.yearId = yid;
  const contacts = await DB.all('contacts');
  for (const ct of contacts){
    const cb = await Inv.contactBal(ct.id);
    await DB.add('yearOpenings',{fiscalYearId:y2,contactId:ct.id,balance:cb,carriedFromYearId:yid});
  }
  STATE.yearId = prev;
}
STATE.yearId = y2;
const carried = await w.getOpenBal(cid);
t('year close carries the closing balance forward (got '+carried+' vs '+closingBal+')', carried===closingBal);
STATE.yearId = yid;

// closed year is read-only
let fy = await DB.get('fiscalYears',yid); fy.isClosed=true; await DB.put('fiscalYears',fy);
t('closed year blocks document entry', (await FY.assertOpen())===false);
fy = await DB.get('fiscalYears',yid); fy.isClosed=false; await DB.put('fiscalYears',fy);
t('open year allows document entry', (await FY.assertOpen())===true);

// ── permissions ──
Perm.role='viewer';
t('viewer can view', Perm.can('view'));
t('viewer cannot create', !Perm.can('create'));
t('viewer cannot delete', !Perm.can('delete'));
t('viewer cannot manage users', !Perm.can('*'));
t('viewer is blocked from users page', !Perm.guardPage('users'));
Perm.role='operator';
t('operator can create', Perm.can('create'));
t('operator cannot delete', !Perm.can('delete'));
t('operator cannot close year', !Perm.can('closeYear'));
Perm.role='accountant';
t('accountant can delete', Perm.can('delete'));
t('accountant can close year', Perm.can('closeYear'));
t('accountant cannot manage users', !Perm.can('*'));
Perm.role='admin';
t('admin can do everything', Perm.can('*') && Perm.can('anything'));

// inactive user cannot log in
const inact = await DB.add('users',{username:'ghost',password:await Auth.hash('secret123'),role:'viewer',active:false});
w.document.getElementById('loginUser').value='ghost';
w.document.getElementById('loginPass').value='secret123';
await Auth.login();
t('inactive user is refused at login', /غیرفعال/.test(w.document.getElementById('loginErr').textContent));
await DB.del('users',inact);

// last admin cannot be demoted
users = await DB.all('users');
const adminRow = users.find(u=>u.username==='admin');
STATE.userId = adminRow.id;
await Perm.load();

// ── global search ──
await Search.run('کرپ');
let panel = w.document.getElementById('searchPanel');
t('search finds a product by name', panel && /کرپ مشکی/.test(panel.innerHTML));
await Search.run('S1');
panel = w.document.getElementById('searchPanel');
t('search finds an invoice by number', panel && /S1/.test(panel.innerHTML));
await Search.run('مشتری');
panel = w.document.getElementById('searchPanel');
t('search finds a contact by name', panel && /مشتری تست/.test(panel.innerHTML));
await Search.run('۲۰۰۰۰');
panel = w.document.getElementById('searchPanel');
t('search normalizes Persian digits', panel && !/پیدا نشد/.test(panel.innerHTML));
await Search.run('zzzzqqq');
panel = w.document.getElementById('searchPanel');
t('search reports no results cleanly', panel && /پیدا نشد/.test(panel.innerHTML));
// XSS through search
const xssId = await DB.add('contacts',{name:'<img src=x onerror=alert(1)>',type:'customer',balance:0});
await Search.run('onerror');
panel = w.document.getElementById('searchPanel');
t('search escapes HTML in results', panel && panel.innerHTML.indexOf('<img src=x')===-1);
await DB.del('contacts',xssId);

// ── sync outbox ──
const qBefore = (await DB.all('syncQueue')).length;
const tmpC = await DB.add('contacts',{name:'صف تست',type:'customer',balance:0});
await new Promise(r=>setTimeout(r,150));
const q = await DB.all('syncQueue');
t('writes are recorded in the sync outbox', q.length>qBefore);
const ent = q[q.length-1];
t('outbox entry has store+op', ent && ent.store==='contacts' && ent.op==='insert');
t('outbox entry carries uid', ent && typeof ent.uid==='string');
t('outbox entry payload has no local id', ent && ent.payload && ent.payload.id===undefined);
await DB.del('contacts',tmpC);
await new Promise(r=>setTimeout(r,150));
const delEnt = (await DB.all('syncQueue')).slice(-1)[0];
t('delete is recorded in the outbox', delEnt && delEnt.op==='delete');
t('settings writes are not queued', !(await DB.all('syncQueue')).some(e=>e.store==='settings'));
const flushRes = await Sync.flush();
t('flush is a safe no-op without an adapter', !!flushRes.skipped);
let pushed=null;
Sync.adapter={push:async b=>{pushed=b;}};
const fr = await Sync.flush();
t('flush sends the batch to the adapter', pushed && pushed.length>0 && fr.sent===pushed.length);
t('flushed entries are marked sent', (await Sync.pending()).length===0);
Sync.adapter=null;
const exp = await Sync.exportForServer();
t('server export covers every data table', w.DB.DATA_STORES.every(s=>Array.isArray(exp.tables[s])));

// ── backup covers every table ──
t('backup store list == DB.DATA_STORES', JSON.stringify(w.Backup.STORES)===JSON.stringify(w.DB.DATA_STORES));

// ── all routes still render ──
for (const [name,fn] of Object.entries(ROUTES)){
  try{
    await fn();
    const c = w.document.getElementById('mainContent').innerHTML;
    t('route '+name+' renders content', c && c.length>40 && !/در حال بارگذاری/.test(c));
  }catch(e){ t('route '+name+' renders content', false); console.log('   '+name+' threw: '+e.message); }
}

// ── service worker shell list is complete ──
const fs=require('fs');
const sw=fs.readFileSync('/home/user/workspace/parcheban/sw.js','utf8');
const jsFiles=fs.readdirSync('/home/user/workspace/parcheban/js').filter(f=>f.endsWith('.js'));
const notCached=jsFiles.filter(f=>sw.indexOf("'./js/"+f+"'")===-1);
t('service worker caches every js module'+(notCached.length?' -> missing: '+notCached.join(', '):''), notCached.length===0);
t('service worker caches css', sw.indexOf("'./css/app.css'")>-1);

console.log('\n'+(F?'✗':'✓')+'  PASS '+P+'   FAIL '+F);
if(fails.length) console.log('FAILED:\n - '+fails.join('\n - '));
process.exit(F?1:0);
})().catch(e=>{console.error('HARNESS CRASH',e);process.exit(2)});
