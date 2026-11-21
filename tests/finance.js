/**
 * تست‌های اختصاصی موتور مالی FinanceEngine (کاملاً ایزوله با داده‌های ساختگی در حافظه)
 */
import '../js/02b-finance.js';
import assert from 'assert';

const FinanceEngine = globalThis.FinanceEngine;
const executedTestTracker = [];

console.log('--- اجرای تست‌های موتور مالی FinanceEngine ---');
assert(FinanceEngine, 'FinanceEngine باید لود شده باشد');

// اجرای مجموعه ۱۰ سناریو
const suite = FinanceEngine.runDiagnosticSuite();
console.log(`نتیجه کلی سناریوهای پایه: ${suite.passed} از ${suite.total} سناریو با موفقیت پاس شدند.`);

suite.results.forEach(r => {
  console.log(`[${r.passed ? '✓' : '✗'}] ${r.title}`);
  assert(r.passed, `تست سناریو شکست خورد: ${r.title} - ${r.actual}`);
  executedTestTracker.push({ title: r.title, passed: r.passed });
});

assert.strictEqual(suite.passed, 10, 'باید تمام ۱۰ سناریو پاس شوند');
assert.strictEqual(suite.allPassed, true);

console.log('✓ تمامی ۱۰ آزمون پایه مالی با موفقیت ۱۰۰٪ تأیید شدند.');

console.log('\n--- اجرای ۸ آزمون الزامی محاسبات اقلام فاقد قیمت خرید و صورت سود و زیان ---');
const mandatorySuite = FinanceEngine.runMandatoryAuditSuite();
console.log(`نتیجه کلی آزمون‌های الزامی: ${mandatorySuite.passed} از ${mandatorySuite.total} سناریو با موفقیت پاس شدند.`);

mandatorySuite.results.forEach(r => {
  console.log(`[${r.passed ? '✓' : '✗'}] ${r.title}`);
  assert(r.passed, `تست سناریو الزامی شکست خورد: ${r.title} - ${r.actual}`);
  executedTestTracker.push({ title: r.title, passed: r.passed });
});

assert.strictEqual(mandatorySuite.passed, 8, 'باید تمام ۸ آزمون الزامی پاس شوند');
assert.strictEqual(mandatorySuite.allPassed, true);

console.log('✓ تمامی ۸ آزمون تخصصی اصلاح سود با موفقیت ۱۰۰٪ تأیید شدند.');

console.log('\n--- اجرای آزمون مستقل calculatePeriodPL (مرحله تکمیلی ممیزی سود دوره) ---');
// آزمون مستقل calculatePeriodPL با فاکتور دارای یک قلم معتبر و یک قلم فاقد قیمت خرید
const sampleInvoice = {
  id: 201,
  invoiceNumber: 'INV-AUDIT-201',
  type: 'sale',
  subtotal: 1400,
  discount: 0,
  shippingCost: 0,
  brokerCommission: 0,
  items: [
    { productId: 1, productName: 'کالای معتبر', quantity: 10, unitPrice: 100, buyPrice: 60 },
    { productId: 2, productName: 'کالای فاقد قیمت خرید', quantity: 5, unitPrice: 80, buyPrice: null }
  ]
};

const periodPL = FinanceEngine.calculatePeriodPL([sampleInvoice], [], 0, 0);

// ۱. درآمد کل درست باشد
assert.strictEqual(periodPL.totalSales, 1400, 'درآمد کل فروش باید دقیقاً ۱۴۰۰ باشد');
assert.strictEqual(periodPL.netSales, 1400, 'فروش خالص باید ۱۴۰۰ باشد');

// ۲. فروش اقلام معتبر و نامعتبر جداگانه محاسبه شود
assert.strictEqual(periodPL.salesWithValidBuyPrice, 1000, 'فروش اقلام معتبر باید ۱۰۰۰ باشد (۱۰ × ۱۰۰)');
assert.strictEqual(periodPL.salesWithoutValidBuyPrice, 400, 'فروش اقلام نامعتبر باید ۴۰۰ باشد (۵ × ۸۰)');
assert.strictEqual(
  periodPL.salesWithValidBuyPrice + periodPL.salesWithoutValidBuyPrice,
  periodPL.totalSales,
  'جمع فروش اقلام معتبر و نامعتبر باید بدون تکرار (Double Counting) برابر فروش کل باشد'
);

// ۳. سود قابل‌تأیید درست باشد
assert.strictEqual(periodPL.verifiedGrossProfit, 400, 'سود ناخالص قابل‌تأیید باید ۴۰۰ باشد (۱۰۰۰ منهای بهای تمام‌شده ۶۰۰)');
assert.strictEqual(periodPL.grossProfit, 400, 'سود ناخالص باید صرفاً بر پایه اقلام دارای بهای موثق باشد');
assert.strictEqual(periodPL.verifiedCOGS, 600, 'بهای تمام‌شده قابل‌تأیید باید ۶۰۰ باشد');

// ۴. وضعیت دوره incomplete باشد
assert.strictEqual(periodPL.status, 'incomplete', 'وضعیت دوره باید incomplete باشد');
assert.strictEqual(periodPL.isProfitVerified, false, 'پرچم isProfitVerified باید false باشد');
assert.strictEqual(periodPL.isComplete, false, 'پرچم isComplete باید false باشد');
assert.strictEqual(periodPL.hasUnverifiedItems, true, 'پرچم hasUnverifiedItems باید true باشد');
assert.strictEqual(periodPL.unverifiedItemsCount, 1, 'تعداد اقلام نامعتبر باید ۱ باشد');
assert.strictEqual(periodPL.unverifiedRevenueTotal, 400, 'مبلغ فروش اقلام نامعتبر باید ۴۰۰ باشد');

// ۵. سود ناقص به‌عنوان سود قطعی معرفی نشود
assert.notStrictEqual(periodPL.statusLabel, 'قطعی', 'سود ناقص نباید برچسب قطعی داشته باشد');
assert(periodPL.statusLabel.includes('ناقص'), 'برچسب وضعیت باید شامل عبارت ناقص باشد');
assert.strictEqual(periodPL.profitWarning, 'سود نهایی دوره قابل تعیین نیست', 'پیام هشدار صریح سود نهایی باید تنظیم شده باشد');

console.log('✓ آزمون مستقل calculatePeriodPL با موفقیت ۱۰۰٪ پاس شد:');
console.log(`  - درآمد کل: ${periodPL.totalSales}`);
console.log(`  - تفکیک فروش: معتبر=${periodPL.salesWithValidBuyPrice} | فاقد بهای معتبر=${periodPL.salesWithoutValidBuyPrice}`);
console.log(`  - سود قابل‌تأیید: ${periodPL.verifiedGrossProfit}`);
console.log(`  - وضعیت دوره: ${periodPL.status} (${periodPL.statusLabel})`);
console.log(`  - هشدار سود: ${periodPL.profitWarning}`);
executedTestTracker.push({ title: 'آزمون مستقل ارزیابی صورت سود و زیان دوره (calculatePeriodPL)', passed: true });
console.log('✓ تمام آزمون‌های پایه، الزامی و آزمون مستقل calculatePeriodPL با موفقیت پاس شدند.');

console.log('\n--- اجرای ۸ آزمون تخصصی ثبت و تفکیک هزینه‌های عملیاتی (OpEx) و صورت سود و زیان ---');
const opExSuite = FinanceEngine.runOperatingExpensesSuite();
console.log(`نتیجه کلی آزمون‌های هزینه‌های عملیاتی: ${opExSuite.passed} از ${opExSuite.total} سناریو با موفقیت پاس شدند.`);

opExSuite.results.forEach(r => {
  console.log(`[${r.passed ? '✓' : '✗'}] ${r.title}`);
  assert(r.passed, `تست سناریو هزینه‌های عملیاتی شکست خورد: ${r.title} - ${r.actual}`);
  executedTestTracker.push({ title: r.title, passed: r.passed });
});

assert.strictEqual(opExSuite.passed, 8, 'باید تمام ۸ آزمون هزینه‌های عملیاتی پاس شوند');
assert.strictEqual(opExSuite.allPassed, true);

console.log('✓ تمامی ۸ آزمون تخصصی ثبت و تفکیک هزینه‌های عملیاتی با موفقیت ۱۰۰٪ تأیید شدند.');

console.log('\n--- اجرای ۷ آزمون تکمیلی ممیزی مرحله دوم (اعتبارسنجی سرفصل‌های هزینه و اصلاح تشخیص حواله) ---');
const phase2Suite = FinanceEngine.runPhase2AuditSuite();
console.log(`نتیجه کلی ممیزی مرحله دوم: ${phase2Suite.passed} از ${phase2Suite.total} سناریو با موفقیت پاس شدند.`);

phase2Suite.results.forEach(r => {
  console.log(`[${r.passed ? '✓' : '✗'}] ${r.title}`);
  assert(r.passed, `تست ممیزی مرحله دوم شکست خورد: ${r.title} - ${r.actual}`);
  executedTestTracker.push({ title: r.title, passed: r.passed });
});

assert.strictEqual(phase2Suite.passed, 7, 'باید تمام ۷ آزمون ممیزی مرحله دوم پاس شوند');
assert.strictEqual(phase2Suite.allPassed, true);

console.log('✓ تمامی ۷ آزمون تکمیلی ممیزی مرحله دوم با موفقیت ۱۰۰٪ تأیید شدند.');

console.log('\n--- اجرای ۱۲ آزمون الزامی ممیزی و محاسبه مانده حساب‌های بانکی و نقدینگی ---');
const bankSuite = FinanceEngine.runBankAuditSuite();
console.log(`نتیجه کلی آزمون‌های مانده بانک: ${bankSuite.passed} از ${bankSuite.total} سناریو با موفقیت پاس شدند.`);

bankSuite.results.forEach(r => {
  console.log(`[${r.passed ? '✓' : '✗'}] ${r.title}`);
  assert(r.passed, `تست ممیزی مانده بانک شکست خورد: ${r.title} - ${r.actual}`);
  executedTestTracker.push({ title: r.title, passed: r.passed });
});

assert.strictEqual(bankSuite.passed, 12, 'باید تمام ۱۲ آزمون ممیزی مانده بانک پاس شوند');
assert.strictEqual(bankSuite.allPassed, true);

console.log('✓ تمامی ۱۲ آزمون تخصصی مانده بانک و نقدینگی با موفقیت ۱۰۰٪ تأیید شدند.');

console.log('\n--- راه‌اندازی محیط Mock ایزوله در رم جهت آزمون‌های واقعی توابع سیستم ---');
// شبیه‌سازی متغیرها و ماک دیتابیس در حافظه
globalThis.numOf = function(val) {
  if (val === null || val === undefined || val === '') return 0;
  var n = parseFloat(String(val).replace(/,/g, '').trim());
  return isNaN(n) ? 0 : n;
};
globalThis.intOf = function(val) {
  var n = parseInt(val, 10);
  return isNaN(n) ? 0 : n;
};
globalThis.esc = function(val) { return String(val || ''); };
globalThis.todayJ = function() { return '1404/01/15'; };
globalThis.Jalali = {
  parse: function(d) { return d; },
  today: function() { return '1404/01/15'; },
  addMonths: function(d, m) { return '1403/12/15'; }
};
globalThis.Perm = { require: function() { return true; }, can: function() { return true; } };
globalThis.STATE = { yearId: 1 };
globalThis.currentPage = '';
globalThis.Pag = {
  register: function() {},
  slice: function(k, list) { return { items: list, page: 1, per: 50 }; },
  html: function() { return ''; }
};
globalThis.Con = {
  balance: async function(cid) { return 0; },
  allBalances: async function() { return {}; },
  balTag: function() { return ''; },
  tt: function() { return ''; },
  tl: function(t) { return t; }
};
globalThis.Prod = {
  stock: async function() { return 1000; },
  stockMap: async function() { return {}; }
};

globalThis.pn = function(d) {
  if (!d) return 0;
  var n = parseInt(String(d).replace(/\D/g, ''), 10);
  return isNaN(n) ? 0 : n;
};
globalThis.elVal = function() { return ''; };
globalThis.elNum = function() { return 0; };
globalThis.ROUTES = {
  profit: () => {},
  debtors: () => {},
  creditors: () => {},
  banks: () => {},
  warehouse: () => {},
  payments: () => {},
  settings: () => {},
  years: () => {}
};
globalThis.Chk = { autoPassDueChecks: async () => {}, ll: () => {} };
globalThis.Auth = { isDefaultAdminPass: async () => false };
globalThis.Sync = { getConfig: () => ({ configured: false }) };
if (!globalThis.navigator) globalThis.navigator = { onLine: true };
if (!globalThis.window) globalThis.window = globalThis;
if (!globalThis.document) {
  globalThis.document = {
    getElementById: function() { return null; },
    body: { classList: { contains: () => false } }
  };
}
if (!globalThis.getComputedStyle) {
  globalThis.getComputedStyle = function() {
    return { getPropertyValue: () => '' };
  };
}

let capturedUIContent = '';
let capturedHTML = {};
globalThis.setHTML = function(id, html) {
  capturedHTML[id] = html;
};
globalThis.UI = {
  fn: function(n) { return (n || 0).toLocaleString('fa-IR'); },
  toast: function() {},
  close: function() {},
  open: function(title, body) { capturedUIContent = title + ' ' + body; },
  confirm: async function() { return true; },
  nav: function() {},
  title: function() {},
  act: function() {},
  content: function(html) { capturedUIContent = html; }
};

// تعریف دیتابیس ساختگی درون رم (کاملاً ایزوله بدون اتصال به IndexedDB یا Supabase)
let memStore = {
  invoices: {},
  payments: [],
  banks: {},
  bankTransfers: []
};
let mockAutoId = 2000;

globalThis.DB = {
  get: async function(table, id) {
    if (table === 'invoices') return memStore.invoices[id] ? JSON.parse(JSON.stringify(memStore.invoices[id])) : null;
    if (table === 'banks') return memStore.banks[id] ? JSON.parse(JSON.stringify(memStore.banks[id])) : null;
    if (table === 'payments') {
      const p = memStore.payments.find(x => x.id === id);
      return p ? JSON.parse(JSON.stringify(p)) : null;
    }
    if (table === 'fiscalYears') return { id: 1, name: '۱۴۰۴', isCurrent: true, isClosed: false };
    return null;
  },
  all: async function(table) {
    if (table === 'payments') return JSON.parse(JSON.stringify(memStore.payments));
    if (table === 'invoices') return Object.values(memStore.invoices).map(x => JSON.parse(JSON.stringify(x)));
    if (table === 'banks') return Object.values(memStore.banks).map(x => JSON.parse(JSON.stringify(x)));
    if (table === 'bankTransfers') return JSON.parse(JSON.stringify(memStore.bankTransfers));
    if (table === 'contacts') return [{ id: 1, name: 'مشتری ۱' }, { id: 2, name: 'تأمین‌کننده ۲' }];
    if (table === 'fiscalYears') return [{ id: 1, name: '۱۴۰۴', isCurrent: true, isClosed: false }];
    if (table === 'checks') return [];
    if (table === 'products') return [];
    return [];
  },
  add: async function(table, doc) {
    const copy = JSON.parse(JSON.stringify(doc));
    copy.id = ++mockAutoId;
    if (table === 'payments') memStore.payments.push(copy);
    if (table === 'invoices') memStore.invoices[copy.id] = copy;
    return copy.id;
  },
  put: async function(table, doc) {
    const copy = JSON.parse(JSON.stringify(doc));
    if (table === 'payments') {
      const idx = memStore.payments.findIndex(x => x.id === copy.id);
      if (idx !== -1) memStore.payments[idx] = copy;
      else memStore.payments.push(copy);
    }
    if (table === 'invoices') memStore.invoices[copy.id] = copy;
  },
  del: async function(table, id) {
    if (table === 'payments') {
      memStore.payments = memStore.payments.filter(x => x.id !== id);
    }
    if (table === 'invoices') {
      delete memStore.invoices[id];
    }
  }
};

globalThis.FY = {
  byYear: async function(table) {
    return globalThis.DB.all(table);
  },
  assertOpen: async function() { return true; }
};

// بارگذاری ماژول‌های پروژه
await import('../js/12-invoices.js');
await import('../js/18-reports.js');
await import('../js/22-banks.js');
await import('../js/20-dashboard.js');

const Inv = globalThis.Inv;
const Rep = globalThis.Rep;
const Bank = globalThis.Bank;
const Dash = globalThis.Dash;

assert(Inv && typeof Inv.syncAutoPayment === 'function', 'ماژول Inv باید در دسترس باشد');
assert(Rep && typeof Rep.summary === 'function', 'ماژول Rep باید در دسترس باشد');
assert(Bank && typeof Bank.balance === 'function', 'ماژول Bank باید در دسترس باشد');
assert(Dash && typeof Dash.load === 'function', 'ماژول Dash باید در دسترس باشد');

console.log('✓ محیط Mock در رم و ماژول‌های Inv، Rep، Bank و Dash با موفقیت مقداردهی شدند.');

console.log('\n--- اجرای آزمون واقعی ۲: رفتار دقیق Inv.syncAutoPayment در ویرایش و حذف ---');
await (async () => {
  // مرحله ۱: ثبت فاکتور با پرداخت اولیه ۲،۰۰۰،۰۰۰ ریال به بانک ۱ (موجودی اولیه ۱۰M)
  memStore.banks[1] = { id: 1, name: 'بانک سپه', openingBalance: 10000000 };
  memStore.invoices[501] = {
    id: 501,
    invoiceNumber: 'ف-۵۰۱',
    type: 'sale',
    grandTotal: 10000000,
    paidAmount: 2000000,
    bankId: 1,
    contactId: 1,
    date: '1404/01/10'
  };

  await Inv.syncAutoPayment(501);

  // بررسی ایجاد دقیقاً ۱ سند خودکار
  assert.strictEqual(memStore.payments.length, 1, 'دقیقاً ۱ سند پرداخت خودکار باید ساخته شود');
  assert.strictEqual(memStore.payments[0].amount, 2000000, 'مبلغ سند خودکار باید ۲،۰۰۰،۰۰۰ باشد');
  assert.strictEqual(memStore.payments[0].sourceInvoiceId, 501, 'شناسه فاکتور مبدأ باید ۵۰۱ باشد');
  assert.strictEqual(memStore.payments[0].auto, true, 'پرچم auto باید true باشد');

  let bal1 = await Bank.balance(1);
  assert.strictEqual(bal1, 12000000, 'مانده بانک باید ۱۰M + ۲M = ۱۲،۰۰۰،۰۰۰ ریال باشد');
  console.log('  [✓] گام ۱: ساخت اولیه سند خودکار و افزایش دقیق مانده بانک به ۱۲M تأیید شد.');

  // مرحله ۲: ویرایش فاکتور و افزایش مبلغ پرداختی به ۷،۰۰۰،۰۰۰ ریال
  memStore.invoices[501].paidAmount = 7000000;
  await Inv.syncAutoPayment(501);

  // بررسی به‌روزرسانی همان سند بدون ایجاد سند جدید
  assert.strictEqual(memStore.payments.length, 1, 'تعداد اسناد خودکار باید همچنان دقیقاً ۱ باشد (عدم انباشت)');
  assert.strictEqual(memStore.payments[0].amount, 7000000, 'مبلغ سند باید به ۷،۰۰۰،۰۰۰ به‌روزرسانی شده باشد');

  let bal2 = await Bank.balance(1);
  assert.strictEqual(bal2, 17000000, 'مانده بانک باید دقیقاً ۱۰M + ۷M = ۱۷،۰۰۰،۰۰۰ باشد نه ۱۹،۰۰۰،۰۰۰');
  console.log('  [✓] گام ۲: به‌روزرسانی سند موجود، عدم ایجاد رکورد مضاعف و مانده قطعی ۱۷M تأیید شد.');

  // مرحله ۳: صفر کردن مبلغ پرداختی فاکتور (تسویه نقدی حذف شده)
  memStore.invoices[501].paidAmount = 0;
  await Inv.syncAutoPayment(501);

  assert.strictEqual(memStore.payments.length, 0, 'با صفر شدن پرداختی، سند خودکار باید کاملاً حذف شود');
  let bal3 = await Bank.balance(1);
  assert.strictEqual(bal3, 10000000, 'مانده بانک به موجودی اولیه ۱۰،۰۰۰،۰۰۰ برگشت.');
  console.log('  [✓] گام ۳: حذف خودکار سند پرداخت هنگام صفر شدن paidAmount فاکتور تأیید شد.');

  // مرحله ۴: شبیه‌سازی وجود داده‌های تکراری سنواتی و پاکسازی هوشمند
  memStore.invoices[502] = { id: 502, invoiceNumber: 'ف-۵۰۲', type: 'sale', grandTotal: 5000000, paidAmount: 3000000, bankId: 1 };
  memStore.payments.push(
    { id: 9001, sourceInvoiceId: 502, amount: 3000000, auto: true },
    { id: 9002, sourceInvoiceId: 502, amount: 3000000, auto: true } // رکورد تکراری اشتباهی
  );
  assert.strictEqual(memStore.payments.filter(p => p.sourceInvoiceId === 502).length, 2);

  await Inv.syncAutoPayment(502);
  const remainingLinked = memStore.payments.filter(p => p.sourceInvoiceId === 502);
  assert.strictEqual(remainingLinked.length, 1, 'تابع باید رکوردهای تکراری اضافه را پاکسازی کند');
  console.log('  [✓] گام ۴: پاکسازی اسناد تکراری و ابقای یک سند واحد توسط syncAutoPayment تأیید شد.');
})();
executedTestTracker.push({ title: 'گروه عملیاتی ۱: همگام‌سازی، ویرایش، حذف و پاکسازی سند خودکار فاکتور (Inv.syncAutoPayment)', passed: true });

console.log('✓ گروه عملیاتی ۱: همگام‌سازی، ویرایش، حذف و پاکسازی سند خودکار فاکتور با موفقیت ۱۰۰٪ تأیید شد.');

console.log('\n--- اجرای آزمون واقعی ۳: گزارش‌های Rep.summary و Rep._ir با تفکیک مستقل ---');
await (async () => {
  // داده‌های فاکتور فروش ۱۰M (پرداختی ۶M)، فاکتور خرید ۱۵M (پرداختی ۱۰M)
  // پرداخت‌های متناظر در جدول payments + دریافت مستقل ۲M و پرداخت مستقل ۳M
  memStore.invoices = {
    10: { id: 10, type: 'sale', grandTotal: 10000000, paidAmount: 6000000, shippingCost: 0 },
    20: { id: 20, type: 'purchase', grandTotal: 15000000, paidAmount: 10000000, shippingCost: 0 }
  };
  memStore.payments = [
    { id: 1, type: 'receipt', amount: 6000000, sourceInvoiceId: 10, auto: true },
    { id: 2, type: 'receipt', amount: 2000000, sourceInvoiceId: null },
    { id: 3, type: 'payment', amount: 10000000, sourceInvoiceId: 20, auto: true },
    { id: 4, type: 'payment', amount: 3000000, sourceInvoiceId: null }
  ];

  await Rep.summary();
  const summaryHtml = capturedHTML['rC'] || '';

  // بررسی خروجی وضعیت فروش:
  // دریافت فاکتور: ۶M | دریافت مستقل: ۲M | کل دریافت: ۸M | مانده: ۲M
  assert(summaryHtml.includes('کل فروش: ۱۰٬۰۰۰٬۰۰۰') || summaryHtml.includes('10,000,000') || summaryHtml.includes('۱۰,۰۰۰,۰۰۰'), 'کل فروش باید ۱۰M باشد');
  assert(summaryHtml.includes('دریافت فاکتور: ۶٬۰۰۰٬۰۰۰') || summaryHtml.includes('۶,۰۰۰,۰۰۰'), 'دریافت فاکتور باید ۶M باشد');
  assert(summaryHtml.includes('دریافت مستقل: ۲٬۰۰۰٬۰۰۰') || summaryHtml.includes('۲,۰۰۰,۰۰۰'), 'دریافت مستقل باید ۲M باشد');
  assert(summaryHtml.includes('کل دریافتی: ۸٬۰۰۰٬۰۰۰') || summaryHtml.includes('۸,۰۰۰,۰۰۰'), 'کل دریافتی باید ۸M باشد نه ۱۴M');
  assert(summaryHtml.includes('مانده: ۲٬۰۰۰٬۰۰۰') || summaryHtml.includes('۲,۰۰۰,۰۰۰'), 'مانده طلب باید ۲M باشد');

  // بررسی خروجی وضعیت خرید:
  // پرداخت فاکتور: ۱۰M | پرداخت مستقل: ۳M | کل پرداخت: ۱۳M | مانده: ۲M
  assert(summaryHtml.includes('کل خرید: ۱۵٬۰۰۰٬۰۰۰') || summaryHtml.includes('15,000,000') || summaryHtml.includes('۱۵,۰۰۰,۰۰۰'), 'کل خرید باید ۱۵M باشد');
  assert(summaryHtml.includes('پرداخت فاکتور: ۱۰٬۰۰۰٬۰۰۰') || summaryHtml.includes('۱۰,۰۰۰,۰۰۰'), 'پرداخت فاکتور خرید باید ۱۰M باشد');
  assert(summaryHtml.includes('پرداخت مستقل: ۳٬۰۰۰٬۰۰۰') || summaryHtml.includes('۳,۰۰۰,۰۰۰'), 'پرداخت مستقل خرید باید ۳M باشد');
  assert(summaryHtml.includes('کل پرداختی: ۱۳٬۰۰۰٬۰۰۰') || summaryHtml.includes('۱۳,۰۰۰,۰۰۰'), 'کل پرداختی خرید باید ۱۳M باشد');
  console.log('  [✓] خروجی Rep.summary بدون دوباره‌شماری و با تفکیک کامل فروش و خرید تأیید شد.');

  // آزمون گزارش مجزای فروش Rep._ir('sale')
  await Rep.sales();
  const salesHtml = capturedHTML['rC'] || '';
  assert(salesHtml.includes('کل دریافتی') || salesHtml.includes('کل دریافت'), 'گزارش فروش باید شامل کل دریافت باشد');
  assert(salesHtml.includes('۸٬۰۰۰٬۰۰۰') || salesHtml.includes('8,000,000'), 'کل دریافت فروش باید ۸M باشد');
  assert(salesHtml.includes('۲٬۰۰۰٬۰۰۰') || salesHtml.includes('2,000,000'), 'مانده طلب فروش باید ۲M باشد');
  console.log('  [✓] خروجی Rep.sales بدون دوباره‌شماری با دریافت ۸M و مانده ۲M تأیید شد.');

  // آزمون گزارش مجزای خرید Rep._ir('purchase')
  await Rep.purchases();
  const purchaseHtml = capturedHTML['rC'] || '';
  assert(purchaseHtml.includes('۱۳٬۰۰۰٬۰۰۰') || purchaseHtml.includes('13,000,000'), 'کل پرداختی خرید باید ۱۳M باشد');
  assert(purchaseHtml.includes('۲٬۰۰۰٬۰۰۰') || purchaseHtml.includes('2,000,000'), 'مانده بدهی خرید باید ۲M باشد');
  console.log('  [✓] خروجی Rep.purchases بدون دوباره‌شماری با پرداخت ۱۳M و مانده ۲M تأیید شد.');
})();
executedTestTracker.push({ title: 'گروه عملیاتی ۲: محاسبات و خروجی گزارش‌های Rep بدون دوباره‌شماری (Rep.summary, Rep.sales, Rep.purchases)', passed: true });

console.log('✓ گروه عملیاتی ۲: محاسبات و خروجی گزارش‌های Rep با موفقیت ۱۰۰٪ تأیید شدند.');

console.log('\n--- اجرای آزمون واقعی ۴: آزمون واقعی داشبورد و تطابق چندلایه با بانک‌ها و نقدینگی آزاد ---');
await (async () => {
  const bankA = { id: 101, name: 'بانک ملت', bankName: 'ملت', accountNumber: '111', openingBalance: 12000000 };
  const bankB = { id: 102, name: 'بانک صادرات', bankName: 'صادرات', accountNumber: '222', openingBalance: 18000000 };
  memStore.banks = { 101: bankA, 102: bankB };

  memStore.payments = [
    { id: 1, type: 'receipt', amount: 4000000, bankId: 101, date: '1404/01/10', description: 'دریافت بانک ۱۰۱' },
    { id: 2, type: 'payment', amount: 1000000, bankId: 101, date: '1404/01/11', description: 'پرداخت بانک ۱۰۱' },
    { id: 3, type: 'receipt', amount: 6000000, bankId: 102, date: '1404/01/12', description: 'دریافت بانک ۱۰۲' },
    // نقدینگی آزاد (بدون انتساب به حساب بانکی)
    { id: 4, type: 'receipt', amount: 3000000, bankId: null, date: '1404/01/13', description: 'دریافت نقدی صندوق آزاد' },
    { id: 5, type: 'payment', amount: 500000, bankId: null, date: '1404/01/13', description: 'پرداخت نقدی صندوق آزاد' },
    // تراکنش دارای شناسه حساب نامعتبر یا حذف‌شده
    { id: 6, type: 'receipt', amount: 1500000, bankId: 999, date: '1404/01/14', description: 'دریافت با حساب نامعتبر ۹۹۹' }
  ];

  memStore.bankTransfers = [
    { id: 1, fromBankId: 102, toBankId: 101, amount: 5000000, date: '1404/01/14', notes: 'انتقال از ۱۰۲ به ۱۰۱' }
  ];

  // ۱. محاسبه مستقیم از موتور مالی (منبع واحد حقیقت)
  const dashEngine = FinanceEngine.calculateBankBalances(
    Object.values(memStore.banks),
    memStore.payments,
    memStore.bankTransfers
  );

  // ۲. استخراج از متدهای Bank
  const bankAll = await Bank.allBalances();
  const balA_single = await Bank.balance(101);
  const balB_single = await Bank.balance(102);

  // بررسی ریاضی:
  // بانک ۱۰۱: ۱۲M + ۴M - ۱M + ۵M = ۲۰،۰۰۰،۰۰۰ ریال
  // بانک ۱۰۲: ۱۸M + ۶M - ۵M = ۱۹،۰۰۰،۰۰۰ ریال
  // مجموع کل بانک‌ها: ۳۹،۰۰۰،۰۰۰ ریال
  // نقدینگی آزاد: ۳M - ۰.۵M = ۲،۵۰۰،۰۰۰ ریال
  // تراکنش نامنطبق: ۱ مورد به مبلغ ۱،۵۰۰،۰۰۰ ریال
  assert.strictEqual(dashEngine.bankMap[101].balance, 20000000);
  assert.strictEqual(dashEngine.bankMap[102].balance, 19000000);
  assert.strictEqual(dashEngine.totalBankBal, 39000000);
  assert.strictEqual(dashEngine.unassignedCash.balance, 2500000);
  assert.strictEqual(dashEngine.unassignedCash.totalReceipts, 3000000);
  assert.strictEqual(dashEngine.unassignedCash.totalPayments, 500000);
  assert.strictEqual(dashEngine.unmatchedBankTransactions.length, 1);
  assert.strictEqual(dashEngine.unmatchedBankReceipts, 1500000);

  // بررسی تطابق ۱۰۰٪ با Bank.allBalances
  assert.strictEqual(bankAll.bankMap[101].balance, 20000000);
  assert.strictEqual(bankAll.bankMap[102].balance, 19000000);
  assert.strictEqual(bankAll.totalBankBal, 39000000);
  assert.strictEqual(bankAll.unassignedCash.balance, 2500000);
  assert.strictEqual(bankAll.unmatchedBankTransactions.length, 1);

  // بررسی تطابق با Bank.balance تک‌تک حساب‌ها
  assert.strictEqual(balA_single, 20000000);
  assert.strictEqual(balB_single, 19000000);

  // ۳. آزمون واقعی لود داشبورد
  await Dash.load();
  assert(Dash.lastData, 'Dash.lastData باید با اطلاعات تجمیعی داشبورد مقداردهی شود');
  assert.strictEqual(Dash.lastData.totalBankBal, 39000000, 'مانده بانک‌های داشبورد باید ۳۹M باشد');
  assert.strictEqual(Dash.lastData.totalBankBal, dashEngine.totalBankBal, 'مانده داشبورد باید منطبق با موتور مالی باشد');
  assert.strictEqual(Dash.lastData.totalBankBal, bankAll.totalBankBal, 'مانده داشبورد باید منطبق با Bank.allBalances باشد');
  assert.strictEqual(Dash.lastData.unassignedCash.balance, 2500000, 'مانده نقدینگی آزاد داشبورد باید ۲.۵M باشد');
  assert.strictEqual(Dash.lastData.unassignedCash.totalReceipts, 3000000);
  assert.strictEqual(Dash.lastData.unassignedCash.totalPayments, 500000);
  assert.strictEqual(Dash.lastData.unmatchedBankTransactions.length, 1);
  assert.strictEqual(Dash.lastData.unmatchedBankReceipts, 1500000);

  // بررسی رندر در UI داشبورد
  assert(capturedUIContent.includes('۳۹٬۰۰۰٬۰۰۰') || capturedUIContent.includes('39,000,000'), 'داشبورد باید مانده تجمیعی ۳۹M را رندر کند');
  assert(capturedUIContent.includes('۲٬۵۰۰٬۰۰۰') || capturedUIContent.includes('2,500,000'), 'داشبورد باید نقدینگی آزاد ۲.۵M را شفاف نشان دهد');
  assert(capturedUIContent.includes('حساب نامعتبر') || capturedUIContent.includes('نامنطبق'), 'داشبورد باید هشدار تراکنش نامنطبق را نشان دهد');

  // بررسی مودال تراکنش‌های نامنطبق در داشبورد
  Dash.showUnmatchedBankModal();
  assert(capturedUIContent.includes('۹۹۹'), 'مودال تراکنش‌های نامنطبق باید شناسه حساب ۹۹۹ را نشان دهد');
  assert(capturedUIContent.includes('۱٬۵۰۰٬۰۰۰') || capturedUIContent.includes('1,500,000'), 'مودال باید مبلغ ۱.۵M را نمایش دهد');

  // بررسی رندر صفحه بانک‌ها و هشدار ممیزی
  await Bank.render();
  assert(capturedUIContent.includes('۳۹٬۰۰۰٬۰۰۰') || capturedUIContent.includes('39,000,000'), 'صفحه بانک‌ها باید مانده کل ۳۹M را نشان دهد');
  assert(capturedUIContent.includes('هشدار ممیزی'), 'صفحه بانک‌ها باید بنر هشدار ممیزی را نشان دهد');

  Bank.showUnmatchedModal();
  assert(capturedUIContent.includes('۹۹۹'), 'مودال بانک‌ها باید تراکنش با حساب ۹۹۹ را نشان دهد');

  // اجرای واقعی Bank.show(101) و Bank.show(102) جهت بررسی تطابق صفحه جزئیات
  await Bank.show(101);
  assert(capturedUIContent.includes('۲۰٬۰۰۰٬۰۰۰') || capturedUIContent.includes('20,000,000'), 'صفحه جزئیات بانک ۱۰۱ باید مانده نهایی ۲۰M را نشان دهد');

  // ۴. آزمون رفتار سیستم در صورت عدم دسترسی به موتور مالی
  const origFE = globalThis.FinanceEngine;
  delete globalThis.FinanceEngine;
  try {
    const missingBal = await Bank.allBalances();
    assert.strictEqual(missingBal.totalBankBal, null, 'در نبود موتور مالی نباید مانده کل محاسبه شود');
    assert.strictEqual(missingBal.error, 'FINANCE_ENGINE_UNAVAILABLE');
    const missingSingleBal = await Bank.balance(101);
    assert.strictEqual(missingSingleBal, null, 'در نبود موتور مالی نباید مانده حساب برگردانده شود');
    await Bank.render();
    assert(capturedUIContent.includes('خطا در بارگذاری موتور مالی') || capturedUIContent.includes('غیرقابل محاسبه'), 'صفحه بانک‌ها باید خطای نبود موتور مالی را نشان دهد');
    await Bank.show(101);
    assert(capturedUIContent.includes('خطا در دسترسی به موتور مالی'), 'صفحه جزئیات بانک باید خطای صریح نبود موتور مالی را نشان دهد');
    await Dash.load();
    assert(capturedUIContent.includes('خطا در دسترسی به موتور مالی'), 'داشبورد باید خطای صریح نبود موتور مالی را نشان دهد');
    console.log('  [✓] رفتار محافظت‌شده سیستم در نبود FinanceEngine (عدم محاسبه موازی و نمایش خطای شفاف) تأیید شد.');
  } finally {
    globalThis.FinanceEngine = origFE;
  }

  console.log('  [✓] تطابق ۱۰۰٪ بین خروجی داشبورد، FinanceEngine، Bank.allBalances، Bank.balance و Bank.show تأیید شد.');
  console.log('  [✓] تفکیک کامل مانده بانک‌ها (۳۹M)، نقدینگی آزاد (۲.۵M) و تراکنش نامنطبق (۱.۵M) تأیید شد.');
})();
executedTestTracker.push({ title: 'گروه عملیاتی ۳: آزمون واقعی داشبورد و تطابق چندلایه مانده بانک‌ها، نقدینگی آزاد و تراکنش‌های نامنطبق (Dash & Bank)', passed: true });

console.log('✓ گروه عملیاتی ۳: تطابق کامل داشبورد، بانک‌ها، نقدینگی آزاد و تراکنش‌های نامنطبق با موفقیت تأیید شد.');

console.log('\n--- اجرای آزمون‌های مستقل Bank.show (سناریوهای الف تا و) و پیگیری انتقال‌های نامنطبق ---');

// (الف) حساب با موجودی اولیه و چند دریافت و پرداخت
await (async () => {
  memStore.banks = { 1001: { id: 1001, name: 'بانک مسکن آزمایشی', bankName: 'مسکن', accountNumber: '1001', openingBalance: 10000000 } };
  memStore.payments = [
    { id: 1, type: 'receipt', amount: 3000000, bankId: 1001, contactId: 1, date: '1404/01/05', description: 'دریافت اول' },
    { id: 2, type: 'receipt', amount: 2000000, bankId: 1001, contactId: 1, date: '1404/01/06', description: 'دریافت دوم' },
    { id: 3, type: 'payment', amount: 1500000, bankId: 1001, contactId: 2, date: '1404/01/07', description: 'پرداخت اول' },
    { id: 4, type: 'payment', amount: 500000, bankId: 1001, contactId: 2, date: '1404/01/08', description: 'پرداخت دوم' }
  ];
  memStore.bankTransfers = [];

  const expectedEngineBal = FinanceEngine.calculateAccountBalance(1001, Object.values(memStore.banks), memStore.payments, memStore.bankTransfers);
  assert.strictEqual(expectedEngineBal, 13000000, 'خروجی FinanceEngine برای حساب ۱۰M+۵M-۲M باید ۱۳M باشد');

  capturedUIContent = '';
  await Bank.show(1001);
  assert.strictEqual(Bank._lastShow.engineBalance, expectedEngineBal, 'Bank.show باید با خروجی FinanceEngine برابر باشد');
  assert.strictEqual(Bank._lastShow.ledgerBalance, 13000000, 'مانده گردش جزئیات نیز باید ۱۳M باشد');
  assert.strictEqual(Bank._lastShow.hasDiscrepancy, false, 'در حالت عادی نباید مغایرت وجود داشته باشد');
  assert(capturedUIContent.includes('مانده اولیه') && (capturedUIContent.includes('۱۰٬۰۰۰٬۰۰۰') || capturedUIContent.includes('10,000,000')), 'مانده اولیه باید در سطر آغازین جدول حفظ شود');
  assert(capturedUIContent.includes('۱۳٬۰۰۰٬۰۰۰') || capturedUIContent.includes('13,000,000'), 'مانده نهایی معتبر ۱۳M باید در صفحه نمایش داده شود');
  assert(!capturedUIContent.includes('هشدار مغایرت محاسباتی'), 'در نبود اختلاف نباید هشدار مغایرت نمایش داده شود');
  console.log('  [✓] سناریو (الف): حساب با موجودی اولیه و چند دریافت و پرداخت با FinanceEngine منطبق بود.');
})();
executedTestTracker.push({ title: 'آزمون مستقل Bank.show (الف): حساب با موجودی اولیه و چند دریافت و پرداخت', passed: true });

// (ب) حساب دارای انتقال ورودی
await (async () => {
  memStore.banks = {
    2001: { id: 2001, name: 'بانک مقصد ورودی', bankName: 'تجارت', openingBalance: 5000000 },
    2002: { id: 2002, name: 'بانک مبدأ خروجی', bankName: 'پارسیان', openingBalance: 20000000 }
  };
  memStore.payments = [];
  memStore.bankTransfers = [
    { id: 11, fromBankId: 2002, toBankId: 2001, amount: 4000000, date: '1404/01/10', notes: 'واریز بین‌بانکی ورودی' }
  ];

  const expectedInBal = FinanceEngine.calculateAccountBalance(2001, Object.values(memStore.banks), memStore.payments, memStore.bankTransfers);
  assert.strictEqual(expectedInBal, 9000000, 'مانده حساب دارای انتقال ورودی باید ۵M + ۴M = ۹M باشد');

  capturedUIContent = '';
  await Bank.show(2001);
  assert.strictEqual(Bank._lastShow.engineBalance, expectedInBal, 'مانده Bank.show برای انتقال ورودی باید با FinanceEngine یکسان باشد');
  assert.strictEqual(Bank._lastShow.hasDiscrepancy, false);
  assert(capturedUIContent.includes('۹٬۰۰۰٬۰۰۰') || capturedUIContent.includes('9,000,000'), 'مانده ۹M باید نمایش داده شود');
  assert(capturedUIContent.includes('انتقال از بانک مبدأ خروجی'), 'ردیف انتقال ورودی باید در جدول گردش نمایش داده شود');
  console.log('  [✓] سناریو (ب): حساب دارای انتقال ورودی با FinanceEngine منطبق بود.');
})();
executedTestTracker.push({ title: 'آزمون مستقل Bank.show (ب): حساب دارای انتقال ورودی', passed: true });

// (ج) حساب دارای انتقال خروجی
await (async () => {
  const expectedOutBal = FinanceEngine.calculateAccountBalance(2002, Object.values(memStore.banks), memStore.payments, memStore.bankTransfers);
  assert.strictEqual(expectedOutBal, 16000000, 'مانده حساب دارای انتقال خروجی باید ۲۰M - ۴M = ۱۶M باشد');

  capturedUIContent = '';
  await Bank.show(2002);
  assert.strictEqual(Bank._lastShow.engineBalance, expectedOutBal, 'مانده Bank.show برای انتقال خروجی باید با FinanceEngine یکسان باشد');
  assert.strictEqual(Bank._lastShow.hasDiscrepancy, false);
  assert(capturedUIContent.includes('۱۶٬۰۰۰٬۰۰۰') || capturedUIContent.includes('16,000,000'), 'مانده ۱۶M باید نمایش داده شود');
  assert(capturedUIContent.includes('انتقال به بانک مقصد ورودی'), 'ردیف انتقال خروجی باید در جدول گردش نمایش داده شود');
  console.log('  [✓] سناریو (ج): حساب دارای انتقال خروجی با FinanceEngine منطبق بود.');
})();
executedTestTracker.push({ title: 'آزمون مستقل Bank.show (ج): حساب دارای انتقال خروجی', passed: true });

// (د) حساب دارای چند تراکنش و انتقال ورودی/خروجی همزمان
await (async () => {
  memStore.banks = {
    3001: { id: 3001, name: 'بانک اصلی ترکیبی', bankName: 'ملت', openingBalance: 8000000 },
    3002: { id: 3002, name: 'بانک همکار ۱', bankName: 'ملی', openingBalance: 12000000 },
    3003: { id: 3003, name: 'بانک همکار ۲', bankName: 'صادرات', openingBalance: 3000000 }
  };
  memStore.payments = [
    { id: 21, type: 'receipt', amount: 5000000, bankId: 3001, contactId: 1, date: '1404/01/02', description: 'وصول مشتری' },
    { id: 22, type: 'receipt', amount: 2000000, bankId: 3001, contactId: 1, date: '1404/01/04', description: 'بیعانه' },
    { id: 23, type: 'payment', amount: 3000000, bankId: 3001, contactId: 2, date: '1404/01/06', description: 'پرداخت به تأمین‌کننده' }
  ];
  memStore.bankTransfers = [
    { id: 31, fromBankId: 3002, toBankId: 3001, amount: 4500000, date: '1404/01/08', notes: 'شارژ حساب از ملی' },
    { id: 32, fromBankId: 3001, toBankId: 3003, amount: 1500000, date: '1404/01/09', notes: 'انتقال به صادرات' }
  ];

  const expectedMixedBal = FinanceEngine.calculateAccountBalance(3001, Object.values(memStore.banks), memStore.payments, memStore.bankTransfers);
  // 8M + 5M + 2M - 3M + 4.5M - 1.5M = 15M
  assert.strictEqual(expectedMixedBal, 15000000, 'مانده حساب ترکیبی باید ۱۵M باشد');

  capturedUIContent = '';
  await Bank.show(3001);
  assert.strictEqual(Bank._lastShow.engineBalance, expectedMixedBal, 'مانده Bank.show در سناریو ترکیبی باید دقیقاً با FinanceEngine برابر باشد');
  assert.strictEqual(Bank._lastShow.ledgerBalance, 15000000);
  assert.strictEqual(Bank._lastShow.hasDiscrepancy, false);
  assert(capturedUIContent.includes('۱۵٬۰۰۰٬۰۰۰') || capturedUIContent.includes('15,000,000'), 'مانده نهایی ۱۵M باید رندر شود');
  console.log('  [✓] سناریو (د): حساب دارای چند تراکنش و انتقال ورودی/خروجی همزمان با FinanceEngine منطبق بود.');
})();
executedTestTracker.push({ title: 'آزمون مستقل Bank.show (د): حساب دارای چند تراکنش و انتقال ورودی و خروجی همزمان', passed: true });

// (هـ) اختلاف بین مانده محاسبه‌شده از گردش جزئیات و خروجی FinanceEngine
await (async () => {
  memStore.banks = { 4001: { id: 4001, name: 'بانک تست مغایرت', bankName: 'سپه', openingBalance: 10000000 } };
  memStore.payments = [
    { id: 41, type: 'receipt', amount: 2000000, bankId: 4001, contactId: 1, date: '1404/01/10', description: 'دریافت ثبت‌شده' }
  ];
  memStore.bankTransfers = [];

  const origCalcAcc = FinanceEngine.calculateAccountBalance;
  FinanceEngine.calculateAccountBalance = function() {
    return 14500000; // اختلاف عمدی ۲،۵۰۰،۰۰۰ ریالی با مانده گردش (۱۲،۰۰۰،۰۰۰)
  };
  try {
    capturedUIContent = '';
    await Bank.show(4001);
    assert.strictEqual(Bank._lastShow.engineBalance, 14500000, 'مانده معتبر باید خروجی FinanceEngine (۱۴.۵M) باشد');
    assert.strictEqual(Bank._lastShow.ledgerBalance, 12000000, 'مانده گردش جزئیات باید ۱۲M محاسبه شده باشد');
    assert.strictEqual(Bank._lastShow.discrepancy, 2500000, 'مقدار اختلاف باید ۲.۵M باشد');
    assert.strictEqual(Bank._lastShow.hasDiscrepancy, true, 'پرچم مغایرت باید true باشد');
    assert(capturedUIContent.includes('هشدار مغایرت محاسباتی'), 'هشدار صریح مغایرت محاسباتی باید نمایش داده شود');
    assert(capturedUIContent.includes('۱۴٬۵۰۰٬۰۰۰') || capturedUIContent.includes('14,500,000'), 'مانده نهایی معتبر FinanceEngine (۱۴.۵M) باید نمایش داده شود');
    assert(capturedUIContent.includes('مانده اولیه') && capturedUIContent.includes('دریافت ثبت‌شده'), 'جدول گردش تراکنش‌ها باید همچنان قابل مشاهده باشد');
    console.log('  [✓] سناریو (هـ): در صورت مغایرت گردش با FinanceEngine، هشدار مغایرت و مانده معتبر موتور مالی نمایش داده شد.');
  } finally {
    FinanceEngine.calculateAccountBalance = origCalcAcc;
  }
})();
executedTestTracker.push({ title: 'آزمون مستقل Bank.show (هـ): تشخیص مغایرت گردش با FinanceEngine و نمایش هشدار و مانده معتبر', passed: true });

// (و) نبود FinanceEngine — عدم نمایش هرگونه مانده تخمینی و نمایش خطای صریح
await (async () => {
  memStore.banks = { 5001: { id: 5001, name: 'بانک تست نبود موتور', bankName: 'رفاه', openingBalance: 9876543 } };
  memStore.payments = [
    { id: 51, type: 'receipt', amount: 1000000, bankId: 5001, contactId: 1, date: '1404/01/11', description: 'دریافت تست' }
  ];
  memStore.bankTransfers = [];

  const origFE = globalThis.FinanceEngine;
  delete globalThis.FinanceEngine;
  try {
    capturedUIContent = '';
    await Bank.show(5001);
    assert(capturedUIContent.includes('خطا در دسترسی به موتور مالی'), 'خطای صریح نبود موتور مالی باید نمایش داده شود');
    assert(!capturedUIContent.includes('۹٬۸۷۶٬۵۴۳') && !capturedUIContent.includes('9,876,543'), 'مانده اولیه نباید به عنوان مانده نهایی یا تخمینی نمایش داده شود');
    assert(!capturedUIContent.includes('۱۰٬۸۷۶٬۵۴۳') && !capturedUIContent.includes('10,876,543'), 'هیچ مانده تخمینی از گردش نباید بدون FinanceEngine محاسبه یا نمایش داده شود');
    assert(!capturedUIContent.includes('جمع گردش و مانده نهایی'), 'جدول و مانده نهایی نباید در نبود موتور مالی رندر شوند');
  } finally {
    globalThis.FinanceEngine = origFE;
  }

  // همچنین بررسی وضعیت برگرداندن مقدار نامعتبر (null) توسط calculateAccountBalance
  const origCalcAcc = FinanceEngine.calculateAccountBalance;
  FinanceEngine.calculateAccountBalance = function() { return null; };
  try {
    capturedUIContent = '';
    await Bank.show(5001);
    assert(capturedUIContent.includes('خطا در دریافت مانده معتبر از موتور مالی'), 'در صورت نامعتبر بودن خروجی FinanceEngine باید خطای صریح نمایش داده شود');
    assert(!capturedUIContent.includes('۹٬۸۷۶٬۵۴۳') && !capturedUIContent.includes('۱۰٬۸۷۶٬۵۴۳'), 'هیچ مانده تخمینی نباید در صورت خطای FinanceEngine نمایش داده شود');
  } finally {
    FinanceEngine.calculateAccountBalance = origCalcAcc;
  }
  console.log('  [✓] سناریو (و): در نبود FinanceEngine هیچ مانده تخمینی یا اولیه نمایش داده نشد و خطای صریح صادر گردید.');
})();
executedTestTracker.push({ title: 'آزمون مستقل Bank.show (و): نبود FinanceEngine و جلوگیری کامل از نمایش مانده تخمینی یا اولیه', passed: true });

// (ز) پیگیری انتقال‌های بین‌بانکی نامنطبق (unmatchedTransfers) در بخش بانک‌ها و داشبورد
await (async () => {
  memStore.banks = {
    6001: { id: 6001, name: 'بانک مبدأ واقعی', bankName: 'ملت', openingBalance: 10000000 },
    6002: { id: 6002, name: 'بانک سالم کناری', bankName: 'ملی', openingBalance: 5000000 }
  };
  memStore.payments = [];
  memStore.bankTransfers = [
    { id: 77, fromBankId: 6001, toBankId: 9999, amount: 3000000, date: '1404/01/15', notes: 'انتقال به حساب حذف‌شده ۹۹۹۹' }
  ];

  const calc = FinanceEngine.calculateBankBalances(Object.values(memStore.banks), memStore.payments, memStore.bankTransfers);
  assert.strictEqual(calc.unmatchedTransfers.length, 1, 'یک انتقال نامنطبق باید شناسایی شود');
  assert.strictEqual(calc.unmatchedTransfersTotal, 3000000, 'جمع مبلغ انتقال نامنطبق باید ۳M باشد');
  assert.strictEqual(calc.bankMap[6001].balance, 7000000);

  capturedUIContent = '';
  await Bank.render();
  assert(capturedUIContent.includes('دارای انتقال نامنطبق (غیرقطعی)'), 'حساب درگیر در لیست بانک‌ها باید برچسب غیرقطعی داشته باشد');
  assert(capturedUIContent.includes('هشدار انتقال بانکی نامنطبق'), 'صفحه بانک‌ها باید بنر هشدار انتقال نامنطبق را نمایش دهد');

  capturedUIContent = '';
  Bank.showUnmatchedModal();
  assert(capturedUIContent.includes('انتقال‌های بین‌بانکی نامنطبق') && (capturedUIContent.includes('9999') || capturedUIContent.includes('۹۹۹۹')), 'مودال بانک‌ها باید جزئیات انتقال نامنطبق با شناسه مقصد ۹۹۹۹ را نمایش دهد');

  capturedUIContent = '';
  await Bank.show(6001);
  assert(capturedUIContent.includes('هشدار ممیزی انتقال بانکی'), 'صفحه جزئیات حساب درگیر باید هشدار ممیزی انتقال نامنطبق را نمایش دهد');
  assert(capturedUIContent.includes('حساب نامعتبر'), 'ردیف انتقال در جزئیات حساب باید طرف مقابل نامعتبر را مشخص کند');
  assert.strictEqual(Bank._lastShow.unmatchedTransfers.length, 1);

  capturedUIContent = '';
  await Dash.load();
  assert.strictEqual(Dash.lastData.unmatchedTransfers.length, 1, 'داشبورد باید انتقال‌های نامنطبق را در داده‌های خود نگه دارد');
  assert(capturedUIContent.includes('انتقال نامنطبق') && capturedUIContent.includes('غیرقطعی'), 'داشبورد باید هشدار غیرقطعی بودن مانده دارای انتقال نامنطبق را نمایش دهد');

  capturedUIContent = '';
  Dash.showUnmatchedBankModal();
  assert(capturedUIContent.includes('انتقال‌های بین‌بانکی نامنطبق') && (capturedUIContent.includes('9999') || capturedUIContent.includes('۹۹۹۹')), 'مودال داشبورد باید جزئیات انتقال نامنطبق را نمایش دهد');
  console.log('  [✓] سناریو (ز): مشاهده‌پذیری و پیگیری کامل unmatchedTransfers در بخش بانک‌ها و داشبورد تأیید شد.');
})();
executedTestTracker.push({ title: 'آزمون پیگیری انتقال‌های بین‌بانکی نامنطبق (unmatchedTransfers) در بانک‌ها و داشبورد با هشدار غیرقطعی', passed: true });

// استخراج داینامیک و دقیق شمارش آزمون‌ها از آرایه ردیابی
const totalExecuted = executedTestTracker.length;
const totalPassed = executedTestTracker.filter(t => t.passed).length;
const totalFailed = totalExecuted - totalPassed;

console.log('\n--- فهرست کامل آزمون‌های اجراشده ---');
executedTestTracker.forEach((t, idx) => {
  console.log(`${idx + 1}. [${t.passed ? '✓' : '✗'}] ${t.title}`);
});

console.log(`\n🎉 مجموع کل: ${totalPassed} از ${totalExecuted} سناریوی جامع مالی، بانکی و حسابداری پارچه‌بان با موفقیت ۱۰۰٪ پاس شدند (ناموفق: ${totalFailed}).`);

assert(totalExecuted > 0, 'حداقل یک آزمون باید اجرا شده باشد');
assert.strictEqual(totalFailed, 0, 'هیچ آزمونی نباید ناموفق باشد');
assert.strictEqual(totalPassed, totalExecuted, 'تمامی آزمون‌های اجراشده باید با موفقیت پاس شوند');
assert(executedTestTracker.every(t => t.passed), 'تمام تک‌تک آزمون‌ها باید با وضعیت passed: true تأیید شده باشند');
