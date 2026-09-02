const {boot}=require('./harness');
let P=0,F=0;const fails=[];
function t(n,c){ if(c)P++; else {F++;fails.push(n);} }
(async()=>{
const {w}=boot();
await new Promise(r=>setTimeout(r,600));
const {DB,FY,Inv,STATE,Jalali,Perm,Auth,UI}=w;
const users=await DB.all('users'); STATE.userId=users[0].id; await Perm.load();
await FY.ensureDefault(); const yid=STATE.yearId;

const cid=await DB.add('contacts',{name:'طرف حساب',type:'both',balance:0});
const pid=await DB.add('products',{name:'کتان آبی',code:'C1',unit:'متر'});

// capture toasts
const toasts=[]; const orig=UI.toast; UI.toast=function(m,k){toasts.push(String(m));return orig.call(UI,m,k)};
// auto-confirm
UI.confirm=async()=>true;

async function trySave(type,qty,price){
  toasts.length=0;
  await Inv.showF(type);
  w.document.getElementById('iDt').value=Jalali.today();
  w.document.getElementById('iCt').value=String(cid);
  Inv.items=[{productId:pid,quantity:qty,unitPrice:price,total:qty*price}];
  await Inv.save(type,null);
  return toasts.join(' || ');
}

// selling with zero stock must be refused
let out=await trySave('sale',10,5000);
let invs=await DB.all('invoices');
t('4.4 sale is blocked when stock is zero', invs.filter(i=>i.type==='sale').length===0);
t('4.4 message tells the user to record the purchase first', /فاکتور خرید/.test(out));
console.log('  پیام:', out.slice(0,140));

// purchase 50 succeeds
out=await trySave('purchase',50,1000);
invs=await DB.all('invoices');
t('4.4 purchase invoice is accepted', invs.filter(i=>i.type==='purchase').length===1);
let stock=await w.Prod.stock(pid);
t('4.4 stock is 50 after purchase (got '+stock+')', stock===50);

// selling 60 of 50 must be refused
out=await trySave('sale',60,5000);
invs=await DB.all('invoices');
t('4.4 selling more than stock is blocked', invs.filter(i=>i.type==='sale').length===0);
t('4.4 block message shows the available quantity', /موجودی/.test(out));

// selling exactly 50 is allowed
out=await trySave('sale',50,5000);
invs=await DB.all('invoices');
t('4.4 selling exactly the available quantity is allowed', invs.filter(i=>i.type==='sale').length===1);
stock=await w.Prod.stock(pid);
t('4.4 stock is 0 after selling everything (got '+stock+')', stock===0);

// and now nothing more can be sold
out=await trySave('sale',1,5000);
t('4.4 stock can never go negative', (await DB.all('invoices')).filter(i=>i.type==='sale').length===1);

// viewer cannot save at all
Perm.role='viewer';
out=await trySave('purchase',5,1000);
t('viewer is refused when saving an invoice', /اجازه/.test(out));
Perm.role='admin';

// closed year blocks saving
let fy=await DB.get('fiscalYears',yid); fy.isClosed=true; await DB.put('fiscalYears',fy);
out=await trySave('purchase',5,1000);
t('closed year blocks saving an invoice', /بسته شده/.test(out));

console.log('\n'+(F?'✗':'✓')+'  PASS '+P+'   FAIL '+F);
if(fails.length) console.log('FAILED:\n - '+fails.join('\n - '));
process.exit(F?1:0);
})().catch(e=>{console.error('CRASH',e);process.exit(2)});
