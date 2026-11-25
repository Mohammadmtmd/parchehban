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
globalThis.toEnDigits = function(s) {
  if (s === null || s === undefined) return '';
  return String(s)
    .replace(/[۰-۹]/g, function(ch) { return String('۰۱۲۳۴۵۶۷۸۹'.indexOf(ch)); })
    .replace(/[٠-٩]/g, function(ch) { return String('٠١٢٣٤٥٦٧٨٩'.indexOf(ch)); });
};
globalThis.numOf = function(val) {
  if (typeof val === 'number') return isFinite(val) ? val : 0;
  if (val === null || val === undefined || val === '') return 0;
  var t = globalThis.toEnDigits(val).replace(/\u066B/g, '.').replace(/[,\u066C\u060C\u2009\u00A0\s_]/g, '');
  var n = parseFloat(t);
  return isNaN(n) ? 0 : n;
};
globalThis.intOf = function(val) {
  var n = parseInt(globalThis.toEnDigits(val), 10);
  return isNaN(n) ? 0 : n;
};
globalThis.num2fa = function(n) {
  return (n || 0).toLocaleString('fa-IR') + ' ریال';
};
globalThis.esc = function(val) { return String(val || ''); };
globalThis.todayJ = function() { return '1404/01/15'; };
globalThis.Jalali = {
  _breaks: [-61, 9, 38, 199, 426, 686, 756, 818, 1111, 1181, 1210, 1635, 2060, 2097, 2192, 2262, 2324, 2394, 2456, 3178],
  _div: function(a, b) { return ~~(a / b); },
  _mod: function(a, b) { return a - ~~(a / b) * b; },
  _cal: function(jy) {
    var bl = this._breaks.length, gy = jy + 621, leapJ = -14, jp = this._breaks[0], jm, jump = 0, leap, n, i;
    for (i = 1; i < bl; i += 1) {
      jm = this._breaks[i]; jump = jm - jp;
      if (jy < jm) break;
      leapJ = leapJ + this._div(jump, 33) * 8 + this._div(this._mod(jump, 33), 4);
      jp = jm;
    }
    n = jy - jp;
    leapJ = leapJ + this._div(n, 33) * 8 + this._div(this._mod(n, 33) + 3, 4);
    if (this._mod(jump, 33) === 4 && jump - n === 4) leapJ += 1;
    var leapG = this._div(gy, 4) - this._div((this._div(gy, 100) + 1) * 3, 4) - 150;
    var march = 20 + leapJ - leapG;
    if (jump - n < 6) n = n - jump + this._div(jump + 4, 33) * 33;
    leap = this._mod(this._mod(n + 1, 33) - 1, 4);
    if (leap === -1) leap = 4;
    return { leap: leap, gy: gy, march: march };
  },
  isLeap: function(jy) { return this._cal(jy).leap === 0; },
  monthDays: function(jy, jm) {
    if (jm <= 6) return 31;
    if (jm <= 11) return 30;
    return this.isLeap(jy) ? 30 : 29;
  },
  dateToJDN: function(gy, gm, gd) {
    var d = this._div((gy + this._div(gm - 8, 6) + 100100) * 1461, 4) +
      this._div(153 * this._mod(gm + 9, 12) + 2, 5) + gd - 34840408;
    return d - this._div(this._div(gy + 100100 + this._div(gm - 8, 6), 100) * 3, 4) + 752;
  },
  jdnToDate: function(jdn) {
    var j = 4 * jdn + 139361631;
    j = j + this._div(this._div(4 * jdn + 183187720, 146097) * 3, 4) * 4 - 3908;
    var i = this._div(this._mod(j, 1461), 4) * 5 + 308;
    var gd = this._div(this._mod(i, 153), 5) + 1;
    var gm = this._mod(this._div(i, 153), 12) + 1;
    var gy = this._div(j, 1461) - 100100 + this._div(8 - gm, 6);
    return new Date(gy, gm - 1, gd);
  },
  toJDN: function(jy, jm, jd) {
    var r = this._cal(jy);
    return this.dateToJDN(r.gy, 3, r.march) + (jm - 1) * 31 - this._div(jm, 7) * (jm - 7) + jd - 1;
  },
  fromJDN: function(jdn) {
    var gy = this.jdnToDate(jdn).getFullYear(), jy = gy - 621;
    var r = this._cal(jy), jdn1f = this.dateToJDN(gy, 3, r.march), jd, jm, k;
    k = jdn - jdn1f;
    if (k >= 0) {
      if (k <= 185) { jm = 1 + this._div(k, 31); jd = this._mod(k, 31) + 1; return [jy, jm, jd]; }
      else k -= 186;
    } else {
      jy -= 1; k += 179;
      if (r.leap === 1) k += 1;
    }
    jm = 7 + this._div(k, 30); jd = this._mod(k, 30) + 1;
    return [jy, jm, jd];
  },
  format: function(jy, jm, jd) {
    return jy + '/' + String(jm).padStart(2, '0') + '/' + String(jd).padStart(2, '0');
  },
  parse: function(s) {
    if (!s) return null;
    var c = globalThis.toEnDigits(String(s).trim()).replace(/[-.]/g, '/');
    var m = c.match(/^(\d{4})\/(\d{1,2})\/(\d{1,2})$/);
    if (!m && /^\d{8}$/.test(c)) m = [null, c.slice(0, 4), c.slice(4, 6), c.slice(6, 8)];
    if (!m) return null;
    var jy = parseInt(m[1], 10), jm = parseInt(m[2], 10), jd = parseInt(m[3], 10);
    if (jy < 1200 || jy > 1700 || jm < 1 || jm > 12 || jd < 1 || jd > this.monthDays(jy, jm)) return null;
    return this.format(jy, jm, jd);
  },
  addDays: function(dateStr, days) {
    var norm = this.parse(dateStr);
    if (!norm) return null;
    var p = norm.split('/').map(Number);
    var r = this.fromJDN(this.toJDN(p[0], p[1], p[2]) + days);
    return this.format(r[0], r[1], r[2]);
  },
  addMonths: function(dateStr, months) {
    var norm = this.parse(dateStr);
    if (!norm) return '1403/12/15';
    var p = norm.split('/').map(Number);
    var total = (p[0] * 12 + (p[1] - 1)) + months;
    var jy = Math.floor(total / 12), jm = (total % 12) + 1;
    var jd = Math.min(p[2], this.monthDays(jy, jm));
    return this.format(jy, jm, jd);
  },
  today: function() { return '1404/01/15'; }
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
  checks: () => {},
  sales: () => {},
  purchase: () => {},
  ledger: () => {},
  productLedger: () => {},
  reports: () => {},
  settings: () => {},
  years: () => {}
};
globalThis.Chk = { autoPassDueChecks: async () => {}, ll: () => {} };
globalThis.Auth = { isDefaultAdminPass: async () => false };
globalThis.Sync = { getConfig: () => ({ configured: false }) };
globalThis.getOpenBal = async function() { return 0; };
globalThis.EXP = { csv: function() {}, pdf: function() {} };
if (!globalThis.localStorage) {
  const _ls = {};
  globalThis.localStorage = {
    getItem: (k) => (k in _ls ? _ls[k] : null),
    setItem: (k, v) => { _ls[k] = String(v); },
    removeItem: (k) => { delete _ls[k]; }
  };
}
if (!globalThis.navigator) globalThis.navigator = { onLine: true };
if (!globalThis.window) globalThis.window = globalThis;
if (!globalThis.document) {
  globalThis.document = {
    getElementById: function() { return null; },
    querySelectorAll: function() { return []; },
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
  checks: [],
  banks: {},
  bankTransfers: [],
  contacts: null,
  products: []
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
    if (table === 'checks') {
      const c = memStore.checks.find(x => x.id === id);
      return c ? JSON.parse(JSON.stringify(c)) : null;
    }
    if (table === 'contacts') {
      const list = memStore.contacts || [{ id: 1, name: 'مشتری ۱', type: 'customer' }, { id: 2, name: 'تأمین‌کننده ۲', type: 'supplier' }];
      const ct = list.find(x => x.id === id);
      return ct ? JSON.parse(JSON.stringify(ct)) : null;
    }
    if (table === 'products') {
      const pr = (memStore.products || []).find(x => x.id === id);
      return pr ? JSON.parse(JSON.stringify(pr)) : null;
    }
    if (table === 'fiscalYears') return { id: 1, name: '۱۴۰۴', isCurrent: true, isClosed: false };
    return null;
  },
  all: async function(table) {
    if (table === 'payments') return JSON.parse(JSON.stringify(memStore.payments));
    if (table === 'checks') return JSON.parse(JSON.stringify(memStore.checks));
    if (table === 'invoices') return Object.values(memStore.invoices).map(x => JSON.parse(JSON.stringify(x)));
    if (table === 'banks') return Object.values(memStore.banks).map(x => JSON.parse(JSON.stringify(x)));
    if (table === 'bankTransfers') return JSON.parse(JSON.stringify(memStore.bankTransfers));
    if (table === 'contacts') return JSON.parse(JSON.stringify(memStore.contacts || [{ id: 1, name: 'مشتری ۱', type: 'customer' }, { id: 2, name: 'تأمین‌کننده ۲', type: 'supplier' }]));
    if (table === 'fiscalYears') return [{ id: 1, name: '۱۴۰۴', isCurrent: true, isClosed: false }];
    if (table === 'products') return JSON.parse(JSON.stringify(memStore.products || []));
    return [];
  },
  add: async function(table, doc) {
    const copy = JSON.parse(JSON.stringify(doc));
    copy.id = ++mockAutoId;
    if (table === 'payments') memStore.payments.push(copy);
    if (table === 'checks') memStore.checks.push(copy);
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
    if (table === 'checks') {
      const idx = memStore.checks.findIndex(x => x.id === copy.id);
      if (idx !== -1) memStore.checks[idx] = copy;
      else memStore.checks.push(copy);
    }
    if (table === 'invoices') memStore.invoices[copy.id] = copy;
  },
  del: async function(table, id) {
    if (table === 'payments') {
      memStore.payments = memStore.payments.filter(x => x.id !== id);
    }
    if (table === 'checks') {
      memStore.checks = memStore.checks.filter(x => x.id !== id);
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
  assertOpen: async function() { return true; },
  refreshSel: async function() {}
};

globalThis.F = {
  section: function(t) { return '<div class="fsec">' + t + '</div>'; },
  row: function() { return Array.prototype.slice.call(arguments).join(' '); },
  select: function(o) {
    var ops = (o.items || []).map(function(it) {
      return '<option value="' + it.v + '">' + it.t + '</option>';
    }).join('');
    return '<select id="' + o.id + '">' + ops + '</select>';
  },
  money: function(o) { return '<input id="' + o.id + '" value="' + (o.value || '') + '">'; },
  date: function(o) { return '<input id="' + o.id + '" value="' + (o.value || '') + '">'; },
  text: function(o) { return '<input id="' + o.id + '" value="' + (o.value || '') + '">'; },
  area: function(o) { return '<textarea id="' + o.id + '">' + (o.value || '') + '</textarea>'; },
  validate: function() { return true; },
  focusFirst: function() {}
};

// بارگذاری ماژول‌های پروژه
await import('../js/12-invoices.js');
await import('../js/13-payments.js');
await import('../js/14-checks.js');
await import('../js/14b-rasgiri.js');
await import('../js/15-ledger.js');
await import('../js/17-product-ledger.js');
await import('../js/18-reports.js');
await import('../js/22-banks.js');
await import('../js/20-dashboard.js');
await import('../js/03c-sync.js');

const Inv = globalThis.Inv;
const Pay = globalThis.Pay;
const Chk = globalThis.Chk;
const Rasgiri = globalThis.Rasgiri;
const Led = globalThis.Led;
const PLed = globalThis.PLed;
const Rep = globalThis.Rep;
const Bank = globalThis.Bank;
const Dash = globalThis.Dash;
const Sync = globalThis.Sync;

assert(Inv && typeof Inv.syncAutoPayment === 'function', 'ماژول Inv باید در دسترس باشد');
assert(Pay && typeof Pay.save === 'function', 'ماژول Pay باید در دسترس باشد');
assert(Chk && typeof Chk.save === 'function', 'ماژول Chk باید در دسترس باشد');
assert(Rasgiri && typeof Rasgiri.generateCheckSchedule === 'function', 'ماژول Rasgiri باید در دسترس باشد');
assert(Led && typeof Led.show === 'function', 'ماژول Led باید در دسترس باشد');
assert(PLed && typeof PLed.show === 'function', 'ماژول PLed باید در دسترس باشد');
assert(Rep && typeof Rep.summary === 'function', 'ماژول Rep باید در دسترس باشد');
assert(Bank && typeof Bank.balance === 'function', 'ماژول Bank باید در دسترس باشد');
assert(Dash && typeof Dash.load === 'function', 'ماژول Dash باید در دسترس باشد');
assert(Sync && typeof Sync.refreshCurrentView === 'function', 'ماژول Sync باید در دسترس باشد');

console.log('✓ محیط Mock در رم و ماژول‌های Inv، Pay، Chk، Rasgiri، Led، PLed، Rep، Bank، Dash و Sync با موفقیت مقداردهی شدند.');

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

console.log('\n--- اجرای ۲۰ آزمون تخصصی مرحله چهارم: تخصیص هزینه حمل خرید به بهای تمام‌شده و پیشنهاد قیمت در فروش ---');

// اطمینان از وجود ماک‌های کمکی مورد نیاز برای رندر و محاسبات گزارش/فاکتور
if (!globalThis.PPick) {
  globalThis.PPick = { cell: function(i, pid) { return '<input id="pp' + i + '" data-pid="' + (pid || '') + '">'; } };
}
if (!globalThis.num2fa) {
  globalThis.num2fa = function(n) { return String(n || 0); };
}
if (!globalThis.getPeriodStart) {
  globalThis.getPeriodStart = function() { return 0; };
}
if (!globalThis.EXP) {
  globalThis.EXP = { csv: function() {}, pdf: function() {} };
}
if (!globalThis.ROUTES.purchase) globalThis.ROUTES.purchase = () => {};
if (!globalThis.ROUTES.sales) globalThis.ROUTES.sales = () => {};

function runPhase4Test(title, fn) {
  fn();
  console.log(`  [✓] ${title}`);
  executedTestTracker.push({ title, passed: true });
}

async function runPhase4AsyncTest(title, fn) {
  await fn();
  console.log(`  [✓] ${title}`);
  executedTestTracker.push({ title, passed: true });
}

// ۱. فاکتور خرید تک‌قلمی با هزینه حمل
runPhase4Test('مرحله ۴ — آزمون ۱: فاکتور خرید تک‌قلمی با هزینه حمل', () => {
  const inv = {
    id: 4001,
    type: 'purchase',
    shippingCost: 100000,
    items: [{ productId: 10, productName: 'پوپلین', quantity: 100, unitPrice: 50000 }]
  };
  const alloc = FinanceEngine.allocatePurchaseShipping(inv);
  assert.strictEqual(alloc.status, 'allocated');
  assert.strictEqual(alloc.allocatedShippingTotal, 100000);
  assert.strictEqual(alloc.items[0].itemGrossAmount, 5000000);
  assert.strictEqual(alloc.items[0].itemShippingShare, 100000);
  assert.strictEqual(alloc.items[0].itemShippingPerUnit, 1000);
  assert.strictEqual(alloc.items[0].landedUnitCost, 51000);
  assert.strictEqual(alloc.allocationMatchesShipping, true);
});

// ۲. فاکتور خرید دو قلمی با مبلغ مساوی
runPhase4Test('مرحله ۴ — آزمون ۲: فاکتور خرید دو قلمی با مبلغ ناخالص مساوی', () => {
  const inv = {
    id: 4002,
    type: 'purchase',
    shippingCost: 200000,
    items: [
      { productId: 11, productName: 'کالا الف', quantity: 50, unitPrice: 100000 },
      { productId: 12, productName: 'کالا ب', quantity: 100, unitPrice: 50000 }
    ]
  };
  const alloc = FinanceEngine.allocatePurchaseShipping(inv);
  assert.strictEqual(alloc.invoiceItemsSubtotal, 10000000);
  assert.strictEqual(alloc.items[0].itemShippingShare, 100000);
  assert.strictEqual(alloc.items[1].itemShippingShare, 100000);
  assert.strictEqual(alloc.items[0].landedUnitCost, 102000);
  assert.strictEqual(alloc.items[1].landedUnitCost, 51000);
});

// ۳. فاکتور خرید سه‌قلمی با مبالغ نامساوی (تخصیص تناسبی)
runPhase4Test('مرحله ۴ — آزمون ۳: فاکتور خرید سه‌قلمی با مبالغ نامساوی (نسبت مبلغ خرید)', () => {
  const inv = {
    id: 4003,
    type: 'purchase',
    shippingCost: 1000000,
    items: [
      { productId: 21, productName: 'الف', quantity: 10, unitPrice: 100000 }, // 1M (10%)
      { productId: 22, productName: 'ب', quantity: 30, unitPrice: 100000 },   // 3M (30%)
      { productId: 23, productName: 'ج', quantity: 60, unitPrice: 100000 }    // 6M (60%)
    ]
  };
  const alloc = FinanceEngine.allocatePurchaseShipping(inv);
  assert.strictEqual(alloc.invoiceItemsSubtotal, 10000000);
  assert.strictEqual(alloc.items[0].itemShippingShare, 100000);
  assert.strictEqual(alloc.items[1].itemShippingShare, 300000);
  assert.strictEqual(alloc.items[2].itemShippingShare, 600000);
  assert.strictEqual(alloc.items[0].landedUnitCost, 110000);
  assert.strictEqual(alloc.items[1].landedUnitCost, 110000);
  assert.strictEqual(alloc.items[2].landedUnitCost, 110000);
});

// ۴. فاکتور خرید با هزینه حمل صفر
runPhase4Test('مرحله ۴ — آزمون ۴: فاکتور خرید با هزینه حمل صفر', () => {
  const inv = {
    id: 4004,
    type: 'purchase',
    shippingCost: 0,
    items: [{ productId: 10, productName: 'پوپلین', quantity: 20, unitPrice: 75000 }]
  };
  const alloc = FinanceEngine.allocatePurchaseShipping(inv);
  assert.strictEqual(alloc.status, 'allocated');
  assert.strictEqual(alloc.shippingCost, 0);
  assert.strictEqual(alloc.items[0].itemShippingShare, 0);
  assert.strictEqual(alloc.items[0].itemShippingPerUnit, 0);
  assert.strictEqual(alloc.items[0].landedUnitCost, 75000);
});

// ۵. فاکتور خرید دارای تخفیف و هزینه حمل (مبنا: مبلغ ناخالص قبل از تخفیف)
runPhase4Test('مرحله ۴ — آزمون ۵: فاکتور خرید دارای تخفیف و هزینه حمل (مبنای مبلغ ناخالص قبل از تخفیف)', () => {
  const inv = {
    id: 4005,
    type: 'purchase',
    discount: 500000,
    shippingCost: 300000,
    items: [
      { productId: 31, productName: 'کالا ۱', quantity: 10, unitPrice: 100000 }, // 1M
      { productId: 32, productName: 'کالا ۲', quantity: 20, unitPrice: 100000 }  // 2M
    ]
  };
  const alloc = FinanceEngine.allocatePurchaseShipping(inv);
  assert.strictEqual(alloc.invoiceItemsSubtotal, 3000000);
  assert.strictEqual(alloc.items[0].itemShippingShare, 100000);
  assert.strictEqual(alloc.items[1].itemShippingShare, 200000);
  assert.strictEqual(alloc.items[0].landedUnitCost, 110000);
  assert.strictEqual(alloc.items[1].landedUnitCost, 110000);
});

// ۶. تست باقیمانده گرد کردن (تطابق دقیق مجموع سهم حمل اقلام با کل هزینه حمل فاکتور)
runPhase4Test('مرحله ۴ — آزمون ۶: تطابق دقیق باقیمانده گرد کردن با کل هزینه حمل فاکتور', () => {
  const inv = {
    id: 4006,
    type: 'purchase',
    shippingCost: 100,
    items: [
      { productId: 41, productName: 'کالا ۱', quantity: 1, unitPrice: 1000 },
      { productId: 42, productName: 'کالا ۲', quantity: 1, unitPrice: 1000 },
      { productId: 43, productName: 'کالا ۳', quantity: 1, unitPrice: 1000 }
    ]
  };
  const alloc = FinanceEngine.allocatePurchaseShipping(inv);
  const sumShare = alloc.items.reduce((s, it) => s + it.itemShippingShare, 0);
  assert.strictEqual(sumShare, 100);
  assert.strictEqual(alloc.allocatedShippingTotal, 100);
  assert.strictEqual(alloc.items[0].itemShippingShare, 33);
  assert.strictEqual(alloc.items[1].itemShippingShare, 33);
  assert.strictEqual(alloc.items[2].itemShippingShare, 34); // باقیمانده به آخرین قلم واجد شرایط
  assert.strictEqual(alloc.allocationMatchesShipping, true);
});

// ۷. پیشنهاد بهای تمام‌شده با حمل هنگام انتخاب کالا در فاکتور فروش جدید
runPhase4Test('مرحله ۴ — آزمون ۷: پیشنهاد خودکار بهای تمام‌شده واحد با حمل در فروش جدید', () => {
  const invoices = [
    {
      id: 4100,
      invoiceNumber: 'خ-۰۱۰۰',
      type: 'purchase',
      date: '1404/01/05',
      shippingCost: 200000,
      items: [{ productId: 50, productName: 'فلامنت', quantity: 100, unitPrice: 40000 }]
    }
  ];
  const sug = FinanceEngine.suggestSaleBuyPrice(50, invoices, { id: 50, buyPrice: 35000 });
  assert.strictEqual(sug.found, true);
  assert.strictEqual(sug.baseBuyPrice, 40000);
  assert.strictEqual(sug.allocatedShippingPerUnit, 2000);
  assert.strictEqual(sug.landedUnitCost, 42000);
  assert.strictEqual(sug.buyPrice, 42000);
  assert.strictEqual(sug.buyPriceStatus, 'auto_suggested');
  assert.strictEqual(sug.sourcePurchaseInvoiceId, 4100);
  assert.strictEqual(sug.sourcePurchaseInvoiceNumber, 'خ-۰۱۰۰');
});

// ۸. دو خرید با تاریخ و هزینه حمل متفاوت -> انتخاب آخرین خرید معتبر و ممنوعیت میانگین موزون
runPhase4Test('مرحله ۴ — آزمون ۸: دو خرید متوالی و انتخاب آخرین خرید معتبر (بدون میانگین موزون)', () => {
  const invoices = [
    {
      id: 4101,
      invoiceNumber: 'خ-۰۱۰۱',
      type: 'purchase',
      date: '1404/01/02',
      shippingCost: 100000,
      items: [{ productId: 51, quantity: 100, unitPrice: 30000 }] // landed: 31,000
    },
    {
      id: 4102,
      invoiceNumber: 'خ-۰۱۰۲',
      type: 'purchase',
      date: '1404/01/12',
      shippingCost: 300000,
      items: [{ productId: 51, quantity: 100, unitPrice: 50000 }] // landed: 53,000
    }
  ];
  const sug = FinanceEngine.suggestSaleBuyPrice(51, invoices, { id: 51, buyPrice: 40000 });
  assert.strictEqual(sug.sourcePurchaseInvoiceId, 4102);
  assert.strictEqual(sug.baseBuyPrice, 50000);
  assert.strictEqual(sug.allocatedShippingPerUnit, 3000);
  assert.strictEqual(sug.buyPrice, 53000);
  assert.notStrictEqual(sug.buyPrice, 42000); // میانگین موزون نیست
});

// ۹. اصلاح دستی قیمت خرید در فاکتور فروش و محاسبه سود بر پایه مقدار ویرایش‌شده
runPhase4Test('مرحله ۴ — آزمون ۹: اصلاح دستی قیمت خرید در فاکتور فروش و ثبت منشأ manual_override', () => {
  Inv._type = 'sale';
  Inv._editId = null;
  Inv._allInvoices = [
    {
      id: 4103,
      invoiceNumber: 'خ-۰۱۰۳',
      type: 'purchase',
      date: '1404/01/10',
      shippingCost: 100000,
      items: [{ productId: 52, quantity: 50, unitPrice: 80000 }] // landed = 82000
    }
  ];
  Inv.prodMap = { 52: { id: 52, name: 'کدری', unit: 'متر', salePrice: 120000, buyPrice: 70000 } };
  Inv.items = [{ productId: 52, quantity: 10, unitPrice: 120000, total: 1200000 }];

  Inv.oc(0, 'p', '52');
  assert.strictEqual(Inv.items[0].buyPrice, 82000);
  assert.strictEqual(Inv.items[0].buyPriceStatus, 'auto_suggested');

  // اصلاح دستی توسط کاربر به 90000
  Inv.oc(0, 'bp', '90000');
  assert.strictEqual(Inv.items[0].buyPrice, 90000);
  assert.strictEqual(Inv.items[0].buyPriceStatus, 'manual_override');
  assert.strictEqual(Inv.items[0].buyPriceSource, 'اصلاح دستی');
  assert.strictEqual(Inv.items[0].landedBuyPrice, 82000); // حفظ مرجع پیشنهادی قبلی

  const calc = FinanceEngine.calculateInvoiceProfit({
    subtotal: 1200000,
    discount: 0,
    shippingCost: 0,
    brokerCommission: 0,
    items: Inv.items
  });
  assert.strictEqual(calc.verifiedCOGS, 900000);
  assert.strictEqual(calc.verifiedGrossProfit, 300000);
});

// ۱۰. کالای فاقد سابقه خرید معتبر (عدم قیمت‌سازی جعلی و صدور هشدار)
runPhase4Test('مرحله ۴ — آزمون ۱۰: کالای فاقد سابقه خرید معتبر (هشدار و عدم قیمت‌سازی جعلی)', () => {
  const sugNoDefault = FinanceEngine.suggestSaleBuyPrice(9991, [], { id: 9991, name: 'بدون سابقه' });
  assert.strictEqual(sugNoDefault.found, false);
  assert.strictEqual(sugNoDefault.buyPrice, null);
  assert.strictEqual(sugNoDefault.buyPriceStatus, 'missing_purchase');
  assert(sugNoDefault.warning && sugNoDefault.warning.includes('سابقه خرید معتبر'));

  const sugFallback = FinanceEngine.suggestSaleBuyPrice(9992, [], { id: 9992, buyPrice: 45000 });
  assert.strictEqual(sugFallback.found, false);
  assert.strictEqual(sugFallback.hasFallback, true);
  assert.strictEqual(sugFallback.buyPrice, 45000);
  assert.strictEqual(sugFallback.buyPriceStatus, 'unverified_fallback');
  assert(sugFallback.warning && sugFallback.warning.includes('قابل تأیید نیست'));
});

// ۱۱. فاکتور فروش دارای هزینه حمل (درآمد خدمات حمل، بدون تداخل با هزینه حمل خرید)
runPhase4Test('مرحله ۴ — آزمون ۱۱: فاکتور فروش با هزینه حمل (درآمد حمل، عدم اجرای تخصیص خرید)', () => {
  const saleInv = {
    id: 4200,
    type: 'sale',
    date: '1404/01/15',
    shippingCost: 150000,
    discount: 0,
    brokerCommission: 0,
    subtotal: 1000000,
    grandTotal: 1150000,
    items: [{ productId: 50, quantity: 10, unitPrice: 100000, buyPrice: 60000 }]
  };
  const alloc = FinanceEngine.allocatePurchaseShipping(saleInv);
  assert.strictEqual(alloc.applicable, false);
  assert.strictEqual(alloc.status, 'not_applicable');

  const pl = FinanceEngine.calculatePeriodPL([saleInv], [], 0, 0);
  assert.strictEqual(pl.netSales, 1150000);
  assert.strictEqual(pl.verifiedCOGS, 600000);
  assert.strictEqual(pl.verifiedGrossProfit, 550000);
});

// ۱۲. هزینه حمل فاکتور خرید + پرداخت خودکار فاکتور -> عدم کسر مجدد در OpEx
runPhase4Test('مرحله ۴ — آزمون ۱۲: عدم کسر مجدد هزینه حمل خرید در OpEx هنگام تسویه فاکتور خرید', () => {
  const invoices = [
    {
      id: 4300,
      invoiceNumber: 'خ-۰۳۰۰',
      type: 'purchase',
      date: '1404/01/05',
      shippingCost: 200000,
      grandTotal: 2200000,
      paidAmount: 2200000,
      items: [{ productId: 60, quantity: 20, unitPrice: 100000 }] // landed = 110,000
    },
    {
      id: 4301,
      invoiceNumber: 'ف-۰۳۰۱',
      type: 'sale',
      date: '1404/01/10',
      shippingCost: 0,
      grandTotal: 3000000,
      items: [{ productId: 60, quantity: 20, unitPrice: 150000, buyPrice: 110000 }]
    }
  ];
  const payments = [
    { id: 801, type: 'payment', amount: 2200000, date: '1404/01/05', sourceInvoiceId: 4300, auto: true, category: 'هزینه حمل' }
  ];
  const pl = FinanceEngine.calculatePeriodPL(invoices, payments, 0, 0);
  assert.strictEqual(pl.verifiedCOGS, 2200000);
  assert.strictEqual(pl.classifiedOpEx, 0);
  assert.strictEqual(pl.supplierSettlements, 2200000);
  assert.strictEqual(pl.netOperatingProfit, 800000);
  assert.strictEqual(pl.hasDuplicateShippingWarning, false);
});

// ۱۳. هزینه حمل فاکتور خرید + پرداخت مستقل واقعی «هزینه حمل» غیرمرتبط (عدم هشدار کاذب و ثبت در OpEx)
runPhase4Test('مرحله ۴ — آزمون ۱۳: پرداخت مستقل واقعی هزینه حمل ارسال بار (باقی ماندن در OpEx بدون هشدار کاذب)', () => {
  const invoices = [
    {
      id: 4310,
      invoiceNumber: 'خ-۰۳۱۰',
      type: 'purchase',
      date: '1404/01/02',
      contactId: 2,
      shippingCost: 200000,
      items: [{ productId: 60, quantity: 20, unitPrice: 100000 }]
    }
  ];
  const payments = [
    { id: 802, type: 'payment', amount: 75000, date: '1404/01/14', contactId: 9, category: 'هزینه حمل', description: 'کرایه ارسال سفارش مشتری تهران' }
  ];
  const pl = FinanceEngine.calculatePeriodPL(invoices, payments, 0, 0);
  assert.strictEqual(pl.classifiedOpEx, 75000);
  assert.strictEqual(pl.hasDuplicateShippingWarning, false);
});

// ۱۴. تشخیص ثبت مضاعف هزینه حمل خرید (فاکتور خرید + پرداخت مستقل هم‌نام/هم‌مبلغ «هزینه حمل»)
runPhase4Test('مرحله ۴ — آزمون ۱۴: تشخیص و هشدار احتمال ثبت مضاعف هزینه حمل خرید بدون حذف سند', () => {
  const invoices = [
    {
      id: 4320,
      invoiceNumber: 'خ-۰۳۲۰',
      type: 'purchase',
      date: '1404/01/08',
      contactId: 2,
      shippingCost: 350000,
      items: [{ productId: 60, quantity: 10, unitPrice: 100000 }]
    }
  ];
  const payments = [
    { id: 803, type: 'payment', amount: 350000, date: '1404/01/08', contactId: 2, category: 'هزینه حمل', description: 'کرایه بار فاکتور خ-۰۳۲۰' }
  ];
  const pl = FinanceEngine.calculatePeriodPL(invoices, payments, 0, 0);
  assert.strictEqual(pl.hasDuplicateShippingWarning, true);
  assert.strictEqual(pl.duplicateShippingWarnings.length, 1);
  assert.strictEqual(pl.duplicateShippingWarnings[0].purchaseInvoiceId, 4320);
  assert.strictEqual(pl.duplicateShippingWarnings[0].paymentId, 803);
  assert(pl.duplicateShippingWarnings[0].warning.includes('ثبت مضاعف'));
  assert.strictEqual(payments.length, 1); // عدم حذف یا دستکاری سند
});

// ۱۵. فاکتور خرید با مبلغ اقلام صفر و هزینه حمل مثبت (وضعیت تخصیص‌نیافته و نیازمند بررسی)
runPhase4Test('مرحله ۴ — آزمون ۱۵: فاکتور خرید با جمع اقلام صفر و هزینه حمل مثبت (unallocated)', () => {
  const inv = {
    id: 4330,
    type: 'purchase',
    shippingCost: 150000,
    items: [{ productId: 70, productName: 'نمونه رایگان', quantity: 10, unitPrice: 0 }]
  };
  const alloc = FinanceEngine.allocatePurchaseShipping(inv);
  assert.strictEqual(alloc.status, 'unallocated');
  assert.strictEqual(alloc.needsReview, true);
  assert.strictEqual(alloc.unallocatedShipping, 150000);
  assert(alloc.warning && alloc.warning.includes('نیازمند بررسی'));
});

// ۱۶. فاکتور خرید با هزینه حمل منفی یا نامعتبر
runPhase4Test('مرحله ۴ — آزمون ۱۶: فاکتور خرید با هزینه حمل منفی یا نامعتبر (نیازمند بررسی)', () => {
  const negInv = {
    id: 4340,
    type: 'purchase',
    shippingCost: -50000,
    items: [{ productId: 70, quantity: 10, unitPrice: 100000 }]
  };
  const allocNeg = FinanceEngine.allocatePurchaseShipping(negInv);
  assert.strictEqual(allocNeg.status, 'invalid_negative_shipping');
  assert.strictEqual(allocNeg.needsReview, true);
  assert.strictEqual(allocNeg.hasInvalidShipping, true);

  const badInv = {
    id: 4341,
    type: 'purchase',
    shippingCost: 'abc',
    items: [{ productId: 70, quantity: 10, unitPrice: 100000 }]
  };
  const allocBad = FinanceEngine.allocatePurchaseShipping(badInv);
  assert.strictEqual(allocBad.status, 'invalid_shipping');
  assert.strictEqual(allocBad.needsReview, true);
});

// ۱۷. عدم بازنویسی یا تغییر خودکار فاکتورهای فروش قبلی هنگام ثبت خرید جدید یا باز کردن فرم ویرایش
await runPhase4AsyncTest('مرحله ۴ — آزمون ۱۷: عدم تغییر خودکار فاکتورهای فروش قدیمی هنگام ثبت خرید جدید یا ویرایش', async () => {
  const oldSale = {
    id: 4401,
    invoiceNumber: 'ف-۴۴۰۱',
    type: 'sale',
    date: '1404/01/03',
    contactId: 1,
    subtotal: 1000000,
    grandTotal: 1000000,
    items: [{ productId: 80, productName: 'کرپ', quantity: 10, unitPrice: 100000, buyPrice: 60000, total: 1000000 }]
  };
  const newerPurchase = {
    id: 4402,
    invoiceNumber: 'خ-۴۴۰۲',
    type: 'purchase',
    date: '1404/01/14',
    shippingCost: 500000,
    items: [{ productId: 80, productName: 'کرپ', quantity: 10, unitPrice: 90000 }] // landed = 140,000
  };
  memStore.invoices = { 4401: oldSale, 4402: newerPurchase };
  memStore.products = [{ id: 80, name: 'کرپ', unit: 'متر', buyPrice: 55000, salePrice: 100000 }];

  const origDbAll = DB.all;
  const origDbGet = DB.get;
  DB.all = async (table) => table === 'products' ? JSON.parse(JSON.stringify(memStore.products)) : origDbAll(table);
  DB.get = async (table, id) => table === 'products' ? (memStore.products.find(x => x.id === id) || null) : origDbGet(table, id);
  try {
    await Inv.showF('sale', 4401);
    assert.strictEqual(Inv.items[0].buyPrice, 60000, 'هنگام باز کردن فاکتور فروش قدیمی، buyPrice قبلی نباید بازنویسی شود');
    assert.strictEqual(memStore.invoices[4401].items[0].buyPrice, 60000);
  } finally {
    DB.all = origDbAll;
    DB.get = origDbGet;
  }
});

// ۱۸. عدم تغییر خودکار رکوردهای فاکتور خرید و جدول products
runPhase4Test('مرحله ۴ — آزمون ۱۸: حفظ کامل عدم تغییر فاکتورهای خرید و رکورد کالاها در توابع موتور مالی', () => {
  const purSnapshot = {
    id: 4501,
    type: 'purchase',
    date: '1404/01/10',
    shippingCost: 120000,
    items: [{ productId: 90, quantity: 12, unitPrice: 50000 }]
  };
  const prodSnapshot = { id: 90, name: 'ساتن', buyPrice: 48000 };
  const beforePur = JSON.stringify(purSnapshot);
  const beforeProd = JSON.stringify(prodSnapshot);

  FinanceEngine.allocatePurchaseShipping(purSnapshot);
  FinanceEngine.suggestSaleBuyPrice(90, [purSnapshot], prodSnapshot);
  FinanceEngine.calculatePeriodPL([purSnapshot], [], 0, 0);

  assert.strictEqual(JSON.stringify(purSnapshot), beforePur);
  assert.strictEqual(JSON.stringify(prodSnapshot), beforeProd);
});

// ۱۹. یکپارچگی فرم فاکتور (Inv.save و Inv._html): ذخیره متادیتای حسابرسی در فروش و رندر جزئیات تخصیص حمل در چاپ/PDF خرید
await runPhase4AsyncTest('مرحله ۴ — آزمون ۱۹: ذخیره متادیتای بهای تمام‌شده در Inv.save و رندر تخصیص حمل در Inv._html', async () => {
  const purInv = {
    id: 4601,
    invoiceNumber: 'خ-۴۶۰۱',
    type: 'purchase',
    date: '1404/01/05',
    contactId: 2,
    subtotal: 2000000,
    shippingCost: 200000,
    grandTotal: 2200000,
    paidAmount: 0,
    items: [
      { productId: 95, productName: 'مخمل', quantity: 10, unitPrice: 100000, total: 1000000 },
      { productId: 96, productName: 'حریر', quantity: 20, unitPrice: 50000, total: 1000000 }
    ]
  };
  memStore.invoices = { 4601: purInv };
  memStore.payments = [];
  memStore.products = [
    { id: 95, name: 'مخمل', unit: 'متر', buyPrice: 90000, salePrice: 150000 },
    { id: 96, name: 'حریر', unit: 'متر', buyPrice: 45000, salePrice: 80000 }
  ];

  const origDbAll = DB.all;
  const origDbGet = DB.get;
  const origElVal = globalThis.elVal;
  const origElNum = globalThis.elNum;
  DB.all = async (table) => table === 'products' ? JSON.parse(JSON.stringify(memStore.products)) : origDbAll(table);
  DB.get = async (table, id) => table === 'products' ? (memStore.products.find(x => x.id === id) || null) : origDbGet(table, id);
  try {
    // چاپ/PDF فاکتور خرید باید جدول تخصیص حمل را نمایش دهد
    const purHtml = await Inv._html(purInv, { showPrices: true });
    assert(purHtml.includes('هزینه حمل خرید'), 'عنوان هزینه حمل خرید باید در خروجی چاپ وجود داشته باشد');
    assert(purHtml.includes('جزئیات تخصیص هزینه حمل خرید'), 'جدول جزئیات تخصیص حمل باید در چاپ فاکتور خرید نمایش داده شود');

    // شبیه‌سازی ثبت فاکتور فروش جدید با انتخاب کالا و ذخیره
    await Inv.showF('sale');
    Inv.oc(0, 'p', '95');
    Inv.oc(0, 'q', '5');
    assert.strictEqual(Inv.items[0].buyPrice, 110000); // 100000 + 10000 سهم حمل
    assert.strictEqual(Inv.items[0].allocatedShippingPerUnit, 10000);
    assert.strictEqual(Inv.items[0].buyPriceStatus, 'auto_suggested');

    globalThis.elVal = (fid) => {
      if (fid === 'iCt') return '1';
      if (fid === 'iDt') return '1404/01/15';
      if (fid === 'iNm') return 'ف-۴۶۰۲';
      if (fid === 'iPrt') return 'a4';
      return '';
    };
    globalThis.elNum = () => 0;

    await Inv.save('sale', null);
    const savedSale = Object.values(memStore.invoices).find(x => x.invoiceNumber === 'ف-۴۶۰۲');
    assert(savedSale, 'فاکتور فروش جدید باید در حافظه ثبت شود');
    assert.strictEqual(savedSale.items[0].buyPrice, 110000);
    assert.strictEqual(savedSale.items[0].baseBuyPrice, 100000);
    assert.strictEqual(savedSale.items[0].allocatedShippingPerUnit, 10000);
    assert.strictEqual(savedSale.items[0].landedBuyPrice, 110000);
    assert.strictEqual(savedSale.items[0].sourcePurchaseInvoiceId, 4601);
    assert.strictEqual(savedSale.items[0].buyPriceMethod, 'purchase_shipping_ratio');
    assert.strictEqual(savedSale.items[0].buyPriceStatus, 'auto_suggested');
  } finally {
    DB.all = origDbAll;
    DB.get = origDbGet;
    globalThis.elVal = origElVal;
    globalThis.elNum = origElNum;
  }
});

// ۲۰. یکپارچگی گزارش سود و زیان (Rep.profit) و داشبورد (Dash.load) در ارزش‌گذاری انبار با حمل و هشدار حمل مضاعف
await runPhase4AsyncTest('مرحله ۴ — آزمون ۲۰: گزارش سود و زیان (Rep.profit) و ارزش موجودی داشبورد با بهای با حمل و هشدار حمل مضاعف', async () => {
  memStore.banks = { 1: { id: 1, name: 'ملت', openingBalance: 10000000 } };
  memStore.invoices = {
    4701: {
      id: 4701,
      invoiceNumber: 'خ-۴۷۰۱',
      type: 'purchase',
      date: '1404/01/05',
      contactId: 2,
      subtotal: 1000000,
      shippingCost: 100000,
      grandTotal: 1100000,
      items: [{ productId: 98, productName: 'کتان', quantity: 10, unitPrice: 100000 }] // landed = 110,000
    },
    4702: {
      id: 4702,
      invoiceNumber: 'ف-۴۷۰۲',
      type: 'sale',
      date: '1404/01/12',
      contactId: 1,
      subtotal: 600000,
      shippingCost: 0,
      grandTotal: 600000,
      items: [{ productId: 98, productName: 'کتان', quantity: 4, unitPrice: 150000, buyPrice: 110000 }]
    }
  };
  memStore.payments = [
    { id: 8801, type: 'payment', amount: 100000, date: '1404/01/05', contactId: 2, category: 'هزینه حمل', description: 'کرایه خ-۴۷۰۱' }
  ];
  memStore.bankTransfers = [];
  memStore.products = [{ id: 98, name: 'کتان', unit: 'متر', buyPrice: 90000 }];

  const origDbAll = DB.all;
  const origStockMap = Prod.stockMap;
  DB.all = async (table) => table === 'products' ? JSON.parse(JSON.stringify(memStore.products)) : origDbAll(table);
  Prod.stockMap = async () => ({ 98: 6 }); // 10 خرید - 4 فروش = 6 متر مانده
  try {
    await Rep.profit('all');
    const repHtml = capturedHTML['rC'] || '';
    assert(repHtml.includes('احتمال ثبت مضاعف هزینه حمل'), 'گزارش P&L باید هشدار ثبت مضاعف هزینه حمل را نمایش دهد');
    assert(repHtml.includes('شامل سهم حمل خرید'), 'شرح COGS باید شامل سهم حمل خرید باشد');

    capturedUIContent = '';
    await Dash.load();
    // 6 متر × 110,000 (شامل سهم حمل خرید) = 660,000 ریال
    assert.strictEqual(Dash.lastData.estimatedInvValue, 660000, 'ارزش موجودی انبار داشبورد باید بر پایه بهای تمام‌شده با حمل (۶۶۰٬۰۰۰) باشد');
    assert(capturedUIContent.includes('حمل مضاعف'), 'داشبورد باید هشدار حمل مضاعف را در مرکز توجه نمایش دهد');
  } finally {
    DB.all = origDbAll;
    Prod.stockMap = origStockMap;
  }
});

console.log('\n--- اجرای آزمون‌های اتصال دریافت/پرداخت به فاکتورها، تسویه آبشاری چندفاکتوری، ویرایش عطف به ماسبق و دریافت از واسطه ---');

// تست ۱: تخصیص تک‌فاکتوری و عدم دوباره‌شماری
runPhase4Test('تخصیص فاکتور — آزمون ۱: تسویه کامل تک‌فاکتوری و ترکیب با پیش‌پرداخت مستقیم بدون دوباره‌شماری', () => {
  const inv1 = { id: 6001, invoiceNumber: 'ف-۶۰۰۱', type: 'sale', contactId: 1, grandTotal: 1000000, paidAmount: 300000 };
  const autoPay = { id: 7001, type: 'receipt', contactId: 1, amount: 300000, sourceInvoiceId: 6001 }; // نباید دوباره جمع شود
  const linkedReceipt = {
    id: 7002,
    type: 'receipt',
    contactId: 1,
    amount: 700000,
    invoiceAllocations: [{ invoiceId: 6001, invoiceNumber: 'ف-۶۰۰۱', amount: 700000 }]
  };

  const res = FinanceEngine.calculateInvoiceSettlements([inv1], [autoPay, linkedReceipt]);
  const s = res.byInvoiceId[6001];
  assert.strictEqual(s.directPaid, 300000);
  assert.strictEqual(s.linkedPaid, 700000);
  assert.strictEqual(s.totalPaid, 1000000);
  assert.strictEqual(s.remaining, 0);
  assert.strictEqual(s.status, 'settled');
  assert.strictEqual(s.statusLabel, 'تسویه');
});

// تست ۲: تسویه آبشاری چندفاکتوری به ترتیب انتخاب و نگهداری مازاد تخصیص‌نیافته
runPhase4Test('تخصیص فاکتور — آزمون ۲: تسویه آبشاری چندفاکتوری (صفر کردن اولی، سرریز به دومی و مازاد علی‌الحساب)', () => {
  const ordered = [
    { invoiceId: 6101, invoiceNumber: 'ف-۶۱۰۱', remainingBeforePayment: 5000000, grandTotal: 5000000 },
    { invoiceId: 6102, invoiceNumber: 'ف-۶۱۰۲', remainingBeforePayment: 3000000, grandTotal: 3000000 },
    { invoiceId: 6103, invoiceNumber: 'ف-۶۱۰۳', remainingBeforePayment: 4000000, grandTotal: 4000000 }
  ];

  // دریافت ۶.۵ میلیون: اولی ۵M (تسویه کامل)، دومی ۱.۵M (مانده ۱.۵M)، سومی ۰ (مانده ۴M)
  const cascade = FinanceEngine.allocatePaymentToInvoices(6500000, ordered);
  assert.strictEqual(cascade.totalAllocated, 6500000);
  assert.strictEqual(cascade.unallocatedAmount, 0);
  assert.strictEqual(cascade.allocations.length, 2);
  assert.strictEqual(cascade.items[0].allocatedAmount, 5000000);
  assert.strictEqual(cascade.items[0].remainingAfter, 0);
  assert.strictEqual(cascade.items[1].allocatedAmount, 1500000);
  assert.strictEqual(cascade.items[1].remainingAfter, 1500000);
  assert.strictEqual(cascade.items[2].allocatedAmount, 0);
  assert.strictEqual(cascade.items[2].remainingAfter, 4000000);

  // پرداخت بیشتر از جمع دو فاکتور انتخاب‌شده (مثلاً ۱۰M روی ۵M + ۳M) -> ۲M علی‌الحساب
  const over = FinanceEngine.allocatePaymentToInvoices(10000000, ordered.slice(0, 2));
  assert.strictEqual(over.totalAllocated, 8000000);
  assert.strictEqual(over.unallocatedAmount, 2000000);
});

// تست ۳: ثبت و ویرایش عطف به ماسبق در Pay.showF و Pay.save بدون دستکاری مانده بانک و گزارش‌ها
await runPhase4AsyncTest('تخصیص فاکتور — آزمون ۳: ویرایش دریافت/پرداخت قبلی، تسویه چندفاکتوری و انعکاس در Inv.ll، Inv._html، Dash و Rep', async () => {
  memStore.banks = { 1: { id: 1, name: 'ملت', openingBalance: 10000000 } };
  memStore.invoices = {
    6201: { id: 6201, invoiceNumber: 'ف-۶۲۰۱', type: 'sale', date: '1404/01/05', contactId: 1, subtotal: 4000000, grandTotal: 4000000, paidAmount: 0, items: [] },
    6202: { id: 6202, invoiceNumber: 'ف-۶۲۰۲', type: 'sale', date: '1404/01/10', contactId: 1, subtotal: 3000000, grandTotal: 3000000, paidAmount: 0, items: [] }
  };
  // دریافت قبلی بدون اتصال به فاکتور به مبلغ ۵،۰۰۰،۰۰۰ ریال
  memStore.payments = [
    { id: 7201, type: 'receipt', fiscalYearId: 1, contactId: 1, amount: 5000000, date: '1404/01/12', bankId: 1, description: 'واریز قدیمی' }
  ];
  memStore.bankTransfers = [];

  const origElVal = globalThis.elVal;
  const origElNum = globalThis.elNum;
  try {
    // ابتدا باز کردن مودال ویرایش سند قدیمی ۷۲۰۱
    await Pay.showF('receipt', 7201);
    assert.strictEqual(Pay._formCtx.selectedOrder.length, 0);
    // انتخاب هر دو فاکتور به ترتیب: اول ۶۲۰۱ (۴M)، دوم ۶۲۰۲ (۳M -> فقط ۱M تخصیص می‌گیرد)
    Pay.toggleInv(6201);
    Pay.toggleInv(6202);

    globalThis.elVal = (fid) => {
      if (fid === 'pCt') return '1';
      if (fid === 'pDt') return '1404/01/12';
      if (fid === 'pBk') return '1';
      if (fid === 'pNt') return 'تسویه فاکتورها';
      return '';
    };
    globalThis.elNum = (fid) => (fid === 'pAm' ? 5000000 : 0);

    await Pay.save('receipt', 7201);
    assert.strictEqual(memStore.payments.length, 1, 'تعداد اسناد نباید هنگام ویرایش اضافه شود');
    assert.strictEqual(memStore.payments[0].invoiceAllocations.length, 2);
    assert.strictEqual(memStore.payments[0].invoiceAllocations[0].amount, 4000000);
    assert.strictEqual(memStore.payments[0].invoiceAllocations[1].amount, 1000000);

    // مانده بانک باید دقیقاً ۱۵M باشد (۱۰M اولیه + ۵M دریافت)، بدون هیچ دوباره‌شماری
    const bankBal = await Bank.balance(1);
    assert.strictEqual(bankBal, 15000000);

    // لیست فاکتورها (Inv.ll) باید ف-۶۲۰۱ را تسویه و ف-۶۲۰۲ را جزئی با مانده ۲M نشان دهد
    capturedUIContent = '';
    await Inv.ll('sale');
    assert(capturedUIContent.includes('تسویه'), 'ف-۶۲۰۱ باید برچسب تسویه بگیرد');
    assert(capturedUIContent.includes('جزئی'), 'ف-۶۲۰۲ باید برچسب جزئی بگیرد');

    // خروجی چاپ فاکتور (Inv._html) باید پرداخت‌شده و مانده واقعی را نشان دهد
    const invHtml1 = await Inv._html(memStore.invoices[6201], { showPrices: true, showPayment: true });
    assert(invHtml1.includes('مبلغ پرداخت شده'), 'چاپ ف-۶۲۰۱ باید مبلغ پرداخت شده را نشان دهد');
    assert(!invHtml1.includes('مانده این فاکتور'), 'چاپ ف-۶۲۰۱ بعد از تسویه کامل نباید مانده این فاکتور نشان دهد');

    const invHtml2 = await Inv._html(memStore.invoices[6202], { showPrices: true, showPayment: true });
    assert(invHtml2.includes('مبلغ پرداخت شده'));
    assert(invHtml2.includes('مانده این فاکتور'));

    // گزارش summary نباید دوباره‌شماری کند: کل فروش ۷M، دریافت ۵M، مانده ۲M
    await Rep.summary();
    assert(capturedHTML['rC'].includes(UI.fn(2000000)), 'گزارش کلی فروش باید مانده دقیق ۲M را نشان دهد');

    // ویرایش مجدد همین سند برای بررسی excludePaymentId (فاکتور ۶۲۰۱ تسویه‌شده هم باید دیده شود!)
    await Pay.showF('receipt', 7201);
    assert.strictEqual(Pay._formCtx.selectedOrder.length, 2);
    const elig = Pay._getEligibleInvoices(1, 'receipt');
    const el6201 = elig.find(x => x.invoiceId === 6201);
    assert(el6201 && el6201.remainingBeforePayment === 4000000, 'در ویرایش مجدد، مانده پیش از این سند برای ۶۲۰۱ باید ۴M باشد');

    // داشبورد باید برای ف-۶۲۰۱ وضعیت تسویه و برای ف-۶۲۰۲ مانده ۲M را برگرداند
    capturedUIContent = '';
    await Dash.load();
    assert(capturedUIContent.includes('تسویه'));
  } finally {
    globalThis.elVal = origElVal;
    globalThis.elNum = origElNum;
    Pay._formCtx = null;
  }
});

// تست ۴: پرداخت فاکتور خرید بدون انتخاب سرفصل هزینه نباید وارد Unclassified یا OpEx شود
runPhase4Test('تخصیص فاکتور — آزمون ۴: طبقه‌بندی خودکار پرداخت متصل به فاکتور خرید در supplierSettlements (نه هزینه عملیاتی)', () => {
  const exp = FinanceEngine.filterOperatingExpenses([
    {
      id: 7301,
      type: 'payment',
      amount: 2500000,
      date: '1404/01/15',
      contactId: 2,
      category: null,
      invoiceAllocations: [{ invoiceId: 901, invoiceNumber: 'خ-۰۹۰۱', amount: 2500000 }]
    }
  ], 0, 0);
  assert.strictEqual(exp.supplierSettlements, 2500000);
  assert.strictEqual(exp.classifiedOpEx, 0);
  assert.strictEqual(exp.unclassifiedPayments, 0);
});

// تست ۵: امکان انتخاب واسطه (broker) در بخش دریافت و ثبت دریافت از واسطه
await runPhase4AsyncTest('تخصیص فاکتور — آزمون ۵: نمایش واسطه در فهرست «دریافت از» و ثبت موفق دریافت از واسطه', async () => {
  const origDbAll = DB.all;
  const origElVal = globalThis.elVal;
  const origElNum = globalThis.elNum;
  memStore.banks = { 1: { id: 1, name: 'ملت', openingBalance: 0 } };
  memStore.invoices = {};
  memStore.payments = [];

  DB.all = async (table) => {
    if (table === 'contacts') {
      return [
        { id: 1, name: 'مشتری ۱', type: 'customer' },
        { id: 2, name: 'تأمین‌کننده ۲', type: 'supplier' },
        { id: 3, name: 'واسطه کریمی', type: 'broker' }
      ];
    }
    return origDbAll(table);
  };

  try {
    capturedUIContent = '';
    await Pay.showF('receipt', null);
    assert(capturedUIContent.includes('واسطه کریمی'), 'نام واسطه باید در فرم دریافت جدید نمایش داده شود');
    assert(!capturedUIContent.includes('تأمین‌کننده ۲'), 'تأمین‌کننده صرف نباید در فهرست دریافت باشد');

    globalThis.elVal = (fid) => {
      if (fid === 'pCt') return '3';
      if (fid === 'pDt') return '1404/01/15';
      if (fid === 'pBk') return '1';
      if (fid === 'pNt') return 'دریافت از واسطه';
      return '';
    };
    globalThis.elNum = (fid) => (fid === 'pAm' ? 1200000 : 0);

    await Pay.save('receipt', null);
    assert.strictEqual(memStore.payments.length, 1);
    assert.strictEqual(memStore.payments[0].type, 'receipt');
    assert.strictEqual(memStore.payments[0].contactId, 3);
    assert.strictEqual(memStore.payments[0].amount, 1200000);
    assert.strictEqual(await Bank.balance(1), 1200000);
  } finally {
    DB.all = origDbAll;
    globalThis.elVal = origElVal;
    globalThis.elNum = origElNum;
    Pay._formCtx = null;
  }
});

// تست ۶: حذف سند پرداخت متصل باعث بازگشت مانده فاکتور و حذف فاکتور باعث پاک‌سازی ایمن ارجاع در سند بدون حذف اصل پرداخت می‌شود
await runPhase4AsyncTest('تخصیص فاکتور — آزمون ۶: بازگشت مانده با حذف سند پرداخت و پاک‌سازی ایمن تخصیص هنگام حذف فاکتور', async () => {
  memStore.invoices = {
    6401: { id: 6401, invoiceNumber: 'خ-۶۴۰۱', type: 'purchase', date: '1404/01/05', contactId: 2, grandTotal: 2000000, paidAmount: 0, items: [] },
    6402: { id: 6402, invoiceNumber: 'خ-۶۴۰۲', type: 'purchase', date: '1404/01/06', contactId: 2, grandTotal: 1000000, paidAmount: 0, items: [] }
  };
  memStore.payments = [
    {
      id: 7401,
      type: 'payment',
      contactId: 2,
      amount: 2500000,
      date: '1404/01/10',
      invoiceAllocations: [
        { invoiceId: 6401, invoiceNumber: 'خ-۶۴۰۱', amount: 2000000 },
        { invoiceId: 6402, invoiceNumber: 'خ-۶۴۰۲', amount: 500000 }
      ]
    }
  ];

  // حذف فاکتور ۶۴۰۱ نباید کل سند ۷۴۰۱ را پاک کند؛ فقط ارجاع ۶۴۰۱ را حذف کند و ۶۴۰۲ را حفظ کند
  await Inv.rm(6401, 'purchase');
  assert.strictEqual(memStore.payments.length, 1, 'سند پرداخت دستی نباید با حذف یکی از فاکتورها پاک شود');
  assert.strictEqual(memStore.payments[0].invoiceAllocations.length, 1);
  assert.strictEqual(memStore.payments[0].invoiceAllocations[0].invoiceId, 6402);

  // حذف سند پرداخت ۷۴۰۱ باید مانده فاکتور ۶۴۰۲ را به ۱،۰۰۰،۰۰۰ ریال برگرداند
  await Pay.rm(7401);
  assert.strictEqual(memStore.payments.length, 0);
  const stAfter = FinanceEngine.calculateInvoiceSettlements(Object.values(memStore.invoices), memStore.payments);
  assert.strictEqual(stAfter.byInvoiceId[6402].remaining, 1000000);
});

// تست فیلترهای صفحه پرداخت و دریافت (شخص، تاریخ، نوع، وضعیت)
await runPhase4AsyncTest('فیلترهای لیست — آزمون ۱: فیلتر نوع، شخص، تاریخ و وضعیت در صفحه دریافت و پرداخت (Pay)', async () => {
  const origDbAll = DB.all;
  DB.all = async (table) => {
    if (table === 'contacts') {
      return [
        { id: 1, name: 'مشتری اول', type: 'customer' },
        { id: 2, name: 'تأمین‌کننده دوم', type: 'supplier' }
      ];
    }
    return origDbAll(table);
  };
  memStore.payments = [
    { id: 8101, type: 'receipt', contactId: 1, amount: 1000000, date: '1404/01/05', description: 'دریافت اول متصل', invoiceAllocations: [{ invoiceId: 1, amount: 1000000 }] },
    { id: 8102, type: 'receipt', contactId: 1, amount: 2000000, date: '1404/02/10', description: 'دریافت دوم علی‌الحساب' },
    { id: 8103, type: 'payment', contactId: 2, amount: 3000000, date: '1404/02/15', description: 'پرداخت خودکار فاکتور', sourceInvoiceId: 2 },
    { id: 8104, type: 'payment', contactId: null, amount: 400000, date: '1404/03/01', category: 'اجاره', description: 'اجاره دفتر' }
  ];

  try {
    await Pay.render();
    assert(capturedUIContent.includes('دریافت اول متصل'));
    assert(capturedUIContent.includes('اجاره دفتر'));

    // فیلتر نوع: فقط دریافت
    await Pay.setFilter('type', 'receipt');
    assert(capturedUIContent.includes('دریافت اول متصل'));
    assert(capturedUIContent.includes('دریافت دوم علی‌الحساب'));
    assert(!capturedUIContent.includes('پرداخت خودکار فاکتور'));

    // فیلتر وضعیت: فقط متصل به فاکتور
    await Pay.setFilter('status', 'allocated');
    assert(capturedUIContent.includes('دریافت اول متصل'));
    assert(!capturedUIContent.includes('دریافت دوم علی‌الحساب'));

    // پاک کردن و فیلتر بازه تاریخ + شخص
    await Pay.resetFilters();
    await Pay.setFilter('dateFrom', '1404/02/01');
    await Pay.setFilter('dateTo', '1404/02/20');
    assert(!capturedUIContent.includes('دریافت اول متصل'));
    assert(capturedUIContent.includes('دریافت دوم علی‌الحساب'));
    assert(capturedUIContent.includes('پرداخت خودکار فاکتور'));
    assert(!capturedUIContent.includes('اجاره دفتر'));

    // فیلتر بدون شخص (مخارج عمومی)
    await Pay.resetFilters();
    await Pay.setFilter('contactId', '__none__');
    assert(capturedUIContent.includes('اجاره دفتر'));
    assert(!capturedUIContent.includes('دریافت اول متصل'));

    // حالت بدون نتیجه باید نوار فیلتر را حفظ کند تا کاربر بتواند فیلتر را تغییر دهد
    await Pay.setFilter('dateFrom', '1405/01/01');
    assert(capturedUIContent.includes('تراکنشی با فیلترهای انتخاب‌شده یافت نشد'));
    assert(capturedUIContent.includes('payFContact') && capturedUIContent.includes('payFStatus'));
  } finally {
    await Pay.resetFilters();
    DB.all = origDbAll;
  }
});

// تست فیلترهای صفحه فاکتور فروش و خرید (شخص، تاریخ، نوع، وضعیت)
await runPhase4AsyncTest('فیلترهای لیست — آزمون ۲: فیلتر نوع، شخص، تاریخ و وضعیت در صفحه فاکتورهای فروش و خرید (Inv)', async () => {
  const origDbAll = DB.all;
  DB.all = async (table) => {
    if (table === 'contacts') {
      return [
        { id: 1, name: 'مشتری آلفا', type: 'customer' },
        { id: 2, name: 'تأمین‌کننده بتا', type: 'supplier' }
      ];
    }
    return origDbAll(table);
  };
  memStore.invoices = {
    9101: { id: 9101, invoiceNumber: 'ف-۹۱۰۱', type: 'sale', date: '1404/01/05', contactId: 1, subtotal: 1000000, grandTotal: 1000000, paidAmount: 1000000, items: [] }, // تسویه
    9102: { id: 9102, invoiceNumber: 'ف-۹۱۰۲', type: 'sale', date: '1404/02/10', contactId: 1, subtotal: 2000000, grandTotal: 2000000, paidAmount: 500000, items: [] }, // جزئی
    9103: { id: 9103, invoiceNumber: 'ف-۹۱۰۳', type: 'sale', date: '1404/03/01', contactId: 1, subtotal: 3000000, grandTotal: 3000000, paidAmount: 0, items: [] }, // باز
    9104: { id: 9104, invoiceNumber: 'خ-۹۱۰۴', type: 'purchase', date: '1404/02/15', contactId: 2, subtotal: 4000000, grandTotal: 4000000, paidAmount: 0, items: [] } // خرید باز
  };
  memStore.payments = [];

  try {
    await Inv.render('sale');
    assert(capturedUIContent.includes('ف-۹۱۰۱'));
    assert(capturedUIContent.includes('ف-۹۱۰۳'));
    assert(!capturedUIContent.includes('خ-۹۱۰۴'), 'صفحه فروش در حالت پیش‌فرض نباید فاکتور خرید نشان دهد');

    // فیلتر وضعیت: جزئی
    await Inv.setFilter('status', 'partial');
    assert(!capturedUIContent.includes('ف-۹۱۰۱'));
    assert(capturedUIContent.includes('ف-۹۱۰۲'));
    assert(!capturedUIContent.includes('ف-۹۱۰۳'));

    // فیلتر وضعیت: مانده‌دار (باز و جزئی)
    await Inv.setFilter('status', 'unsettled');
    assert(!capturedUIContent.includes('ف-۹۱۰۱'));
    assert(capturedUIContent.includes('ف-۹۱۰۲'));
    assert(capturedUIContent.includes('ف-۹۱۰۳'));

    // فیلتر نوع: همه فاکتورها + فیلتر شخص تامین‌کننده بتا
    await Inv.setFilter('invType', 'all');
    assert(capturedUIContent.includes('خ-۹۱۰۴'));
    await Inv.setFilter('contactId', '2');
    assert(capturedUIContent.includes('خ-۹۱۰۴'));
    assert(!capturedUIContent.includes('ف-۹۱۰۲'));

    // بازنشانی فیلتر و تست فیلتر تاریخ روی صفحه فروش
    await Inv.resetFilters();
    await Inv.setFilter('dateFrom', '1404/02/01');
    await Inv.setFilter('dateTo', '1404/02/29');
    assert(!capturedUIContent.includes('ف-۹۱۰۱'));
    assert(capturedUIContent.includes('ف-۹۱۰۲'));
    assert(!capturedUIContent.includes('ف-۹۱۰۳'));
  } finally {
    await Inv.resetFilters();
    DB.all = origDbAll;
  }
});

// تست تخصیص چندفاکتوری چک‌های دریافتی و پرداختی و ممیزی عدم دوباره‌شماری
await runPhase4AsyncTest('چک و ممیزی — آزمون ۱: تسویه آبشاری چک دریافتی/پرداختی، برگشت چک و عدم دوباره‌شماری هنگام پاس شدن چک', async () => {
  memStore.banks = { 1: { id: 1, name: 'ملت', openingBalance: 10000000 } };
  memStore.invoices = {
    9501: { id: 9501, invoiceNumber: 'ف-۹۵۰۱', type: 'sale', date: '1404/01/05', contactId: 1, subtotal: 4000000, grandTotal: 4000000, paidAmount: 0, items: [] },
    9502: { id: 9502, invoiceNumber: 'ف-۹۵۰۲', type: 'sale', date: '1404/01/08', contactId: 1, subtotal: 3000000, grandTotal: 3000000, paidAmount: 0, items: [] },
    9503: { id: 9503, invoiceNumber: 'خ-۹۵۰۳', type: 'purchase', date: '1404/01/10', contactId: 2, subtotal: 2500000, grandTotal: 2500000, paidAmount: 0, items: [] }
  };
  // یک پرداخت دستی ۱M روی فاکتور ف-۹۵۰۱ ثبت شده؛ بنابراین مانده ف-۹۵۰۱ پیش از چک ۳M است
  memStore.payments = [
    { id: 9601, type: 'receipt', fiscalYearId: 1, contactId: 1, amount: 1000000, date: '1404/01/06', bankId: 1, description: 'پیش‌پرداخت', invoiceAllocations: [{ invoiceId: 9501, invoiceNumber: 'ف-۹۵۰۱', amount: 1000000 }] }
  ];
  memStore.checks = [];
  memStore.bankTransfers = [];

  const origElVal = globalThis.elVal;
  const origElNum = globalThis.elNum;
  try {
    // ۱) باز کردن فرم چک دریافتی و تخصیص آبشاری ۵M روی ف-۹۵۰۱ (مانده ۳M) و ف-۹۵۰۲ (مانده ۳M -> ۲M تخصیص، ۱M باقی‌مانده)
    await Chk.form('received', null);
    globalThis.elVal = (fid) => {
      if (fid === 'kDocNo') return '1001';
      if (fid === 'kNm') return '550011';
      if (fid === 'kBk') return 'ملت';
      if (fid === 'kIsD') return '1404/01/10';
      if (fid === 'kDu') return '1404/02/10';
      if (fid === 'kCt') return '1';
      if (fid === 'kBkAcc') return '1';
      if (fid === 'kNt') return 'چک بابت دو فاکتور';
      return '';
    };
    globalThis.elNum = (fid) => (fid === 'kAm' ? 5000000 : 0);
    Chk.onFormContactChange();
    Chk.toggleInv(9501);
    Chk.toggleInv(9502);
    await Chk.save('received', null);

    assert.strictEqual(memStore.checks.length, 1);
    const chkId = memStore.checks[0].id;
    assert.strictEqual(memStore.checks[0].invoiceAllocations.length, 2);
    assert.strictEqual(memStore.checks[0].invoiceAllocations[0].amount, 3000000);
    assert.strictEqual(memStore.checks[0].invoiceAllocations[1].amount, 2000000);

    // بررسی مانده فاکتورها تا این لحظه (چک در جریان)
    let st = FinanceEngine.calculateInvoiceSettlements(Object.values(memStore.invoices), memStore.payments, { checks: memStore.checks });
    assert.strictEqual(st.byInvoiceId[9501].remaining, 0, 'ف-۹۵۰۱ باید با ۱M پرداخت + ۳M چک کاملاً تسویه شود');
    assert.strictEqual(st.byInvoiceId[9502].remaining, 1000000, 'ف-۹۵۰۲ باید ۱M مانده داشته باشد');
    assert.strictEqual(await Bank.balance(1), 11000000, 'تا پیش از پاس شدن چک فقط ۱۰M اولیه + ۱M دریافت نقدی در بانک است');

    // ۲) پاس شدن چک و ایجاد سند بانکی خودکار (sourceCheckId) -> نباید فاکتور دوباره تسویه شود!
    globalThis.elVal = (fid) => {
      if (fid === 'nSt') return 'passed';
      if (fid === 'nPassDate') return '1404/02/10';
      if (fid === 'nBk') return '1';
      return '';
    };
    await Chk.ss(chkId);
    assert.strictEqual(memStore.payments.length, 2, 'پس از وصول چک باید یک سند خودکار بانکی با sourceCheckId ساخته شود');
    assert.strictEqual(memStore.payments[1].sourceCheckId, chkId);
    assert.strictEqual(await Bank.balance(1), 16000000, 'بانک پس از پاس شدن چک باید ۱۶M باشد (۱۰M + ۱M + ۵M)');

    // کنترل دقیق عدم دوباره‌شماری در تسویه فاکتورها پس از ایجاد sourceCheckId:
    st = FinanceEngine.calculateInvoiceSettlements(Object.values(memStore.invoices), memStore.payments, { checks: memStore.checks });
    assert.strictEqual(st.byInvoiceId[9501].totalPaid, 4000000, 'سند sourceCheckId نباید دوباره فاکتور ۹۵۰۱ را کم کند');
    assert.strictEqual(st.byInvoiceId[9501].remaining, 0);
    assert.strictEqual(st.byInvoiceId[9502].totalPaid, 2000000);
    assert.strictEqual(st.byInvoiceId[9502].remaining, 1000000);

    // ۳) برگشت خوردن چک باید سند sourceCheckId را حذف و مانده فاکتورها را بازگرداند
    globalThis.elVal = (fid) => {
      if (fid === 'nSt') return 'returned';
      if (fid === 'nRetDate') return '1404/02/11';
      return '';
    };
    await Chk.ss(chkId);
    assert.strictEqual(await Bank.balance(1), 11000000, 'پس از برگشت چک مانده بانک باید به ۱۱M برگردد');
    st = FinanceEngine.calculateInvoiceSettlements(Object.values(memStore.invoices), memStore.payments, { checks: memStore.checks });
    assert.strictEqual(st.byInvoiceId[9501].remaining, 3000000, 'با برگشت چک، ۳M مانده ف-۹۵۰۱ باید باز شود');
    assert.strictEqual(st.byInvoiceId[9502].remaining, 3000000, 'با برگشت چک، کل ف-۹۵۰۲ باید مجدد باز شود');

    // ۴) ثبت چک پرداختی برای فاکتور خرید خ-۹۵۰۳
    await Chk.form('issued', null);
    globalThis.elVal = (fid) => {
      if (fid === 'kDocNo') return '1002';
      if (fid === 'kNm') return '770022';
      if (fid === 'kBk') return 'ملی';
      if (fid === 'kIsD') return '1404/01/12';
      if (fid === 'kDu') return '1404/02/20';
      if (fid === 'kCt') return '2';
      if (fid === 'kBkAcc') return '1';
      return '';
    };
    globalThis.elNum = (fid) => (fid === 'kAm' ? 1500000 : 0);
    Chk.onFormContactChange();
    Chk.toggleInv(9503);
    await Chk.save('issued', null);
    st = FinanceEngine.calculateInvoiceSettlements(Object.values(memStore.invoices), memStore.payments, { checks: memStore.checks });
    assert.strictEqual(st.byInvoiceId[9503].totalPaid, 1500000);
    assert.strictEqual(st.byInvoiceId[9503].remaining, 1000000);

    // ۵) حذف فاکتور خ-۹۵۰۳ نباید چک پرداختی را پاک کند؛ فقط ارجاع تخصیص را پاک می‌کند
    await Inv.rm(9503, 'purchase');
    const issuedChk = memStore.checks.find(x => x.checkNumber === '770022');
    assert(issuedChk, 'اصل چک نباید هنگام حذف فاکتور پاک شود');
    assert.strictEqual((issuedChk.invoiceAllocations || []).length, 0, 'ارجاع فاکتور حذف‌شده باید از چک پاک شود');
  } finally {
    globalThis.elVal = origElVal;
    globalThis.elNum = origElNum;
    Chk._formCtx = null;
    memStore.checks = [];
    memStore.payments = [];
  }
});

// تست فیلترهای صفحه چک‌ها (طرف حساب، نوع، وضعیت)
await runPhase4AsyncTest('چک و ممیزی — آزمون ۲: فیلتر طرف حساب (از جمله گیرنده واگذاری)، نوع و وضعیت در صفحه چک‌ها (Chk)', async () => {
  memStore.contacts = [
    { id: 1, name: 'مشتری اول', type: 'customer' },
    { id: 2, name: 'تأمین‌کننده دوم', type: 'supplier' },
    { id: 3, name: 'واسطه سوم', type: 'broker' }
  ];
  memStore.checks = [
    { id: 9701, docNumber: '1001', type: 'received', checkNumber: 'CHK-A1', bank: 'ملت', amount: 1000000, dueDate: '1404/03/01', contactId: 1, status: 'pending' },
    { id: 9702, docNumber: '1002', type: 'received', checkNumber: 'CHK-B2', bank: 'ملی', amount: 2000000, dueDate: '1404/03/05', contactId: 1, transferToId: 2, status: 'transferred' },
    { id: 9703, docNumber: '1003', type: 'issued', checkNumber: 'CHK-C3', bank: 'صادرات', amount: 3000000, dueDate: '1404/03/10', contactId: 2, status: 'passed' },
    { id: 9704, docNumber: '1004', type: 'received', checkNumber: 'CHK-D4', bank: 'تجارت', amount: 500000, dueDate: '1404/03/12', contactId: 3, status: 'returned_to_customer' }
  ];

  try {
    await Chk.render();
    assert(capturedUIContent.includes('CHK-A1') && capturedUIContent.includes('CHK-D4'));

    // فیلتر نوع: واگذارشده به غیر
    await Chk.setFilter('type', 'transferred');
    assert(capturedUIContent.includes('CHK-B2'));
    assert(!capturedUIContent.includes('CHK-A1'));

    // بازنشانی و فیلتر طرف حساب: تامین‌کننده دوم (هم چک پرداختی به او و هم چک واگذارشده به او را شامل شود)
    await Chk.resetFilters();
    await Chk.setFilter('contactId', '2');
    assert(capturedUIContent.includes('CHK-B2'), 'چک واگذارشده به طرف حساب هم باید در فیلتر طرف حساب دیده شود');
    assert(capturedUIContent.includes('CHK-C3'));
    assert(!capturedUIContent.includes('CHK-A1'));

    // بازنشانی و فیلتر وضعیت: همه عودتی/برگشتی‌ها
    await Chk.resetFilters();
    await Chk.setFilter('status', 'returned_all');
    assert(capturedUIContent.includes('CHK-D4'));
    assert(!capturedUIContent.includes('CHK-A1') && !capturedUIContent.includes('CHK-C3'));

    // در صورت نبود نتیجه، کنترل‌های فیلتر نباید مخفی شوند
    await Chk.setFilter('type', 'issued');
    assert(capturedUIContent.includes('چکی با فیلترها یا عبارت جستجوی انتخاب‌شده یافت نشد'));
    assert(capturedUIContent.includes('chkFContact') && capturedUIContent.includes('chkFType') && capturedUIContent.includes('chkFStatus'));
  } finally {
    await Chk.resetFilters();
    memStore.contacts = null;
    memStore.checks = [];
  }
});

// تست حفظ صفحه، زیرصفحه، شخص/کالا/بانک انتخاب‌شده، تب گزارش و فیلترها هنگام همگام‌سازی
await runPhase4AsyncTest('همگام‌سازی — آزمون ۳: حفظ زیرصفحه (دفتر معین، دفتر کالا، جزئیات بانک، تب گزارش) و فیلترها در Sync.refreshCurrentView', async () => {
  memStore.contacts = [{ id: 1, name: 'مشتری معین', type: 'customer' }];
  memStore.products = [{ id: 11, name: 'پارچه کرپ', unit: 'متر', buyPrice: 100000, sellPrice: 150000 }];
  memStore.banks = { 5: { id: 5, name: 'بانک تجارت', openingBalance: 5000000 } };
  memStore.invoices = {
    9801: { id: 9801, invoiceNumber: 'ف-۹۸۰۱', type: 'sale', date: '1404/01/10', contactId: 1, subtotal: 1500000, grandTotal: 1500000, paidAmount: 0, items: [{ productId: 11, quantity: 10, unitPrice: 150000, total: 1500000 }] }
  };
  memStore.payments = [
    { id: 9811, type: 'receipt', contactId: 1, amount: 500000, date: '1404/01/11', bankId: 5, description: 'تست حفظ فیلتر' }
  ];
  memStore.checks = [
    { id: 9821, docNumber: '1009', type: 'received', checkNumber: 'CHK-SYNC', amount: 250000, dueDate: '1404/02/01', contactId: 1, status: 'pending' }
  ];

  try {
    // ۱) دفتر معین روی مشتری ۱: بعد از Sync.refreshCurrentView نباید به صفحه انتخاب مشتری برگردد
    await Led.show(1);
    assert.strictEqual(Led._currentCid, 1);
    assert(capturedUIContent.includes('ف-۹۸۰۱'));
    capturedUIContent = '';
    await Sync.refreshCurrentView();
    assert.strictEqual(Led._currentCid, 1);
    assert(capturedUIContent.includes('ف-۹۸۰۱') && !capturedUIContent.includes('id="lP"'), 'نباید به صفحه اول دفتر معین (انتخاب شخص) برگردد');

    // ۲) دفتر کالا روی کالای ۱۱
    currentPage = 'productLedger';
    await PLed.show(11);
    assert.strictEqual(PLed._currentPid, 11);
    assert(capturedUIContent.includes('پارچه کرپ'));
    capturedUIContent = '';
    await Sync.refreshCurrentView();
    assert.strictEqual(PLed._currentPid, 11);
    assert(capturedUIContent.includes('ف-۹۸۰۱'));

    // ۳) جزئیات بانک ۵
    await Bank.show(5);
    assert.strictEqual(Bank._currentBankId, 5);
    capturedUIContent = '';
    await Sync.refreshCurrentView();
    assert.strictEqual(Bank._currentBankId, 5);
    assert(capturedUIContent.includes('گردش حساب'));

    // ۴) حفظ فیلترها در Pay، Inv و Chk هنگام همگام‌سازی
    await Pay.render();
    await Pay.setFilter('type', 'receipt');
    assert.strictEqual(Pay._fl, 'receipt');
    await Sync.refreshCurrentView();
    assert.strictEqual(Pay._fl, 'receipt', 'فیلتر دریافت/پرداخت نباید هنگام همگام‌سازی پاک شود');

    await Inv.render('sale');
    await Inv.setFilter('status', 'unsettled');
    assert.strictEqual(Inv._filters.status, 'unsettled');
    await Sync.refreshCurrentView();
    assert.strictEqual(Inv._filters.status, 'unsettled', 'فیلتر فاکتور نباید هنگام همگام‌سازی پاک شود');

    await Chk.render();
    await Chk.setFilter('contactId', '1');
    assert.strictEqual(Chk._filters.contactId, '1');
    await Sync.refreshCurrentView();
    assert.strictEqual(Chk._filters.contactId, '1', 'فیلتر چک نباید هنگام همگام‌سازی پاک شود');

    // ۵) حفظ تب فعال گزارشات (بدهکاران)
    currentPage = 'reports';
    Rep._c = 'debtors';
    capturedHTML['rC'] = '';
    await Sync.refreshCurrentView();
    assert.strictEqual(Rep._c, 'debtors', 'تب فعال گزارشات نباید به خلاصه برگردد');
    assert(capturedHTML['rC'].includes('بدهکاران'));
  } finally {
    await Pay.resetFilters();
    await Inv.resetFilters();
    await Chk.resetFilters();
    Led._currentCid = null;
    PLed._currentPid = null;
    Bank._currentBankId = null;
    Rep._c = null;
    currentPage = '';
    memStore.contacts = null;
    memStore.products = [];
    memStore.checks = [];
    memStore.payments = [];
  }
});

// ═══════════════════════════════════════════════════════════════
// آزمون ۲۹: راس‌گیری معکوس — تولید تمام ۶ الگوی قابل رفرش با جمع و راس دقیق
// ═══════════════════════════════════════════════════════════════
await runPhase4AsyncTest('آزمون ۲۹: راس‌گیری معکوس — تمام ۶ الگو در رفرش پیشنهادهای متفاوت با جمع و راس دقیق می‌دهند', async () => {
  const sigs = new Set();
  for (let v = 0; v < 6; v++) {
    const plan = Rasgiri.generateCheckSchedule({
      baseDate: '1404/01/15',
      targetDays: 60,
      totalAmount: 150000000,
      cashAmount: 0,
      checkCount: 4,
      roundStep: 1000000,
      avoidFriday: true,
      variant: v
    });
    assert.strictEqual(plan.valid, true, `الگوی ${v} باید معتبر باشد`);
    assert.strictEqual(plan.rows.length, 4, `الگوی ${v} باید ۴ چک داشته باشد`);
    const sumAmt = plan.rows.reduce((s, r) => s + r.amount, 0);
    assert.strictEqual(sumAmt, 150000000, `الگوی ${v}: جمع مبلغ چک‌ها باید دقیقاً ۱۵۰٬۰۰۰٬۰۰۰ باشد`);
    assert.strictEqual(plan.actualAvgDays, 60, `الگوی ${v}: راس محاسبه‌شده باید دقیقاً ۶۰ روز باشد`);
    assert.strictEqual(plan.actualRasDate, plan.targetRasDate, `الگوی ${v}: تاریخ دقیق راس باید منطبق بر تاریخ هدف باشد`);

    // هیچ سررسیدی نباید جمعه باشد و تاریخ‌ها صعودی اکید باشند
    for (let i = 0; i < plan.rows.length; i++) {
      const p = plan.rows[i].date.split('/').map(Number);
      const dow = Jalali.jdnToDate(Jalali.toJDN(p[0], p[1], p[2])).getDay();
      assert.notStrictEqual(dow, 5, `چک ${i + 1} در الگوی ${v} نباید به جمعه بیفتد (${plan.rows[i].date})`);
      if (i > 0) {
        assert(plan.rows[i].days > plan.rows[i - 1].days, `تاریخ سررسید چک‌ها در الگوی ${v} باید صعودی باشد`);
      }
    }
    sigs.add(plan.rows.map(r => r.amount + '@' + r.date).join('|'));
  }
  assert(sigs.size >= 5, `حداقل ۵ پیشنهاد متمایز از ۶ رفرش باید تولید شود (تعداد متمایز: ${sigs.size})`);
});

// ═══════════════════════════════════════════════════════════════
// آزمون ۳۰: راس‌گیری معکوس با تاریخ راس هدف (targetMode='date')، پیش‌پرداخت نقدی و موارد مرزی
// ═══════════════════════════════════════════════════════════════
await runPhase4AsyncTest('آزمون ۳۰: پشتیبانی از تاریخ راس هدف، پیش‌پرداخت نقدی و موارد مرزی تک‌چک/روز صفر/رُند بزرگ', async () => {
  // ۱) تاریخ هدف: 1404/01/15 + 45 روز = 1404/02/29 + با ۳۵M نقدی از کل ۱۲۰M
  const targetDt = Jalali.addDays('1404/01/15', 45);
  const planCash = Rasgiri.generateCheckSchedule({
    baseDate: '1404/01/15',
    targetMode: 'date',
    targetDate: targetDt,
    totalAmount: 120000000,
    cashAmount: 30000000,
    checkCount: 3,
    roundStep: 1000000,
    avoidFriday: true,
    variant: 0
  });
  assert.strictEqual(planCash.valid, true);
  assert.strictEqual(planCash.targetDays, 45);
  const chkSum = planCash.rows.reduce((s, r) => s + r.amount, 0);
  assert.strictEqual(chkSum, 90000000, 'جمع چک‌ها باید پس از کسر نقدی ۹۰M باشد');
  assert.strictEqual(chkSum + planCash.cashAmount, 120000000);
  assert.strictEqual(planCash.actualAvgDays, 45, 'راس وزنی کل (نقدی روز صفر + ۳ چک) باید دقیقاً ۴۵ روز شود');

  // ۲) تک‌چک (checkCount = 1)
  const oneChk = Rasgiri.generateCheckSchedule({
    baseDate: '1404/01/15',
    targetDays: 30,
    totalAmount: 50000000,
    checkCount: 1,
    avoidFriday: false
  });
  assert.strictEqual(oneChk.rows.length, 1);
  assert.strictEqual(oneChk.rows[0].amount, 50000000);
  assert.strictEqual(oneChk.actualAvgDays, 30);

  // ۳) گام رُند بزرگ‌تر از سهم هر چک (roundStep=50M ولی کل فاکتور ۱۰M با ۴ چک)
  const tinyInv = Rasgiri.generateCheckSchedule({
    baseDate: '1404/01/15',
    targetDays: 40,
    totalAmount: 10000000,
    checkCount: 4,
    roundStep: 50000000,
    avoidFriday: true
  });
  assert.strictEqual(tinyInv.valid, true);
  assert.strictEqual(tinyInv.rows.reduce((s, r) => s + r.amount, 0), 10000000);
  assert.strictEqual(tinyInv.actualAvgDays, 40);

  // ۴) روز راس = صفر
  const zeroDay = Rasgiri.generateCheckSchedule({
    baseDate: '1404/01/15',
    targetDays: 0,
    totalAmount: 30000000,
    checkCount: 2
  });
  assert.strictEqual(zeroDay.valid, true);
  assert.strictEqual(zeroDay.rows.reduce((s, r) => s + r.amount, 0), 30000000);
  assert.strictEqual(zeroDay.actualAvgDays, 0);
});

// ═══════════════════════════════════════════════════════════════
// آزمون ۳۱: اتصال به فاکتور و صدور مستقیم چک‌ها از راس‌گیری با تضمین عدم بیش‌تخصیص و عدم دوباره‌شماری
// ═══════════════════════════════════════════════════════════════
await runPhase4AsyncTest('آزمون ۳۱: انتخاب فاکتور و صدور مستقیم چک‌ها در سیستم با تخصیص ایمن بدون دوباره‌شماری', async () => {
  memStore.invoices = {};
  memStore.payments = [];
  memStore.checks = [];
  memStore.contacts = [{ id: 1, name: 'مشتری تست', type: 'customer' }];
  memStore.banks = { 1: { id: 1, name: 'بانک ملت', openingBalance: 0 } };

  memStore.invoices[9901] = {
    id: 9901,
    uid: 'u-inv-9901',
    invoiceNumber: 'ف-۹۹۰۱',
    type: 'sale',
    contactId: 1,
    date: '1404/01/20',
    grandTotal: 100000000,
    paidAmount: 0
  };
  // پیش‌پرداخت قبلی ۲۰M برای تست محاسبه مانده واقعی ۸۰M
  memStore.payments.push({
    id: 9950,
    type: 'receipt',
    contactId: 1,
    date: '1404/01/20',
    amount: 20000000,
    bankAccountId: 1,
    invoiceAllocations: [{ invoiceId: 9901, invoiceUid: 'u-inv-9901', invoiceNumber: 'ف-۹۹۰۱', amount: 20000000 }]
  });

  const origElVal = globalThis.elVal;
  try {
    Rasgiri._mode = 'suggest';
    Rasgiri._baseDate = '1404/01/20';
    Rasgiri._pickInvoices = [memStore.invoices[9901]];
    Rasgiri._pickSettle = FinanceEngine.calculateInvoiceSettlements(Object.values(memStore.invoices), memStore.payments, { checks: memStore.checks }).byInvoiceId;
    Rasgiri.pickInvoice(9901);

    assert.strictEqual(Rasgiri._planCfg.totalAmount, 80000000, 'مبلغ پیشنهادی باید برابر مانده واقعی فاکتور (۸۰M) باشد');
    assert.strictEqual(Rasgiri._baseDate, '1404/01/20', 'تاریخ مبنا باید از تاریخ فاکتور پر شود');
    assert.strictEqual(Rasgiri._planRows.reduce((s, r) => s + r.amount, 0), 80000000);

    const nRows = Rasgiri._planRows.length;
    globalThis.elVal = (id) => {
      if (id === 'rgIssType') return 'received';
      if (id === 'rgIssContact') return '1';
      if (id === 'rgIssBankName') return 'ملت';
      if (id === 'rgIssBankAcc') return '1';
      if (id === 'rgIssDate') return '1404/01/20';
      if (id === 'rgIssInvId') return '9901';
      if (id && id.startsWith('rgIssNo_')) {
        const idx = parseInt(id.split('_')[1], 10);
        return String(501001 + idx);
      }
      return '';
    };

    const created = await Rasgiri.submitIssuedChecks();
    assert.strictEqual(created.length, nRows, 'تعداد چک‌های ثبت‌شده باید با ردیف‌های برنامه برابر باشد');
    assert.strictEqual(memStore.checks.length, nRows);

    // بررسی تخصیص و نبود دوباره‌شماری
    const postSettle = FinanceEngine.calculateInvoiceSettlements(Object.values(memStore.invoices), memStore.payments, { checks: memStore.checks }).byInvoiceId[9901];
    assert.strictEqual(postSettle.linkedPaid, 100000000);
    assert.strictEqual(postSettle.totalPaid, 100000000);
    const payAllocSum = postSettle.allocations.filter(a => a.paymentId).reduce((s, a) => s + a.amount, 0);
    const chkAllocSum = postSettle.allocations.filter(a => a.checkId).reduce((s, a) => s + a.amount, 0);
    assert.strictEqual(payAllocSum, 20000000);
    assert.strictEqual(chkAllocSum, 80000000);
    assert.strictEqual(postSettle.remaining, 0, 'مانده فاکتور پس از ثبت چک‌ها باید دقیقاً صفر شود (بدون دوباره‌شماری)');
  } finally {
    globalThis.elVal = origElVal;
    Rasgiri.resetPlan();
    memStore.invoices = {};
    memStore.payments = [];
    memStore.checks = [];
    memStore.contacts = null;
    memStore.banks = {};
  }
});

// ═══════════════════════════════════════════════════════════════
// آزمون ۳۲: حفظ وضعیت صفحه راس‌گیری هنگام همگام‌سازی خودکار پس‌زمینه (Sync.refreshCurrentView)
// ═══════════════════════════════════════════════════════════════
await runPhase4AsyncTest('آزمون ۳۲: حفظ ورودی‌ها و پیشنهادهای فعال صفحه راس‌گیری هنگام همگام‌سازی پس‌زمینه', async () => {
  currentPage = 'rasgiri';
  Rasgiri._mode = 'suggest';
  Rasgiri._baseDate = '1404/02/01';
  Rasgiri._planCfg.totalAmount = 95000000;
  Rasgiri._planCfg.targetDays = 75;
  Rasgiri._planCfg.checkCount = 3;
  Rasgiri.generateSuggestion(true);

  const beforeSig = Rasgiri._planRows.map(r => r.amount + '@' + r.date).join('|');
  capturedUIContent = '';
  await Sync.refreshCurrentView();

  assert.strictEqual(capturedUIContent, '', 'همگام‌سازی نباید فرم و پیشنهادهای فعال راس‌گیری را بازنویسی کند');
  assert.strictEqual(Rasgiri._mode, 'suggest');
  assert.strictEqual(Rasgiri._planCfg.totalAmount, 95000000);
  assert.strictEqual(Rasgiri._planRows.map(r => r.amount + '@' + r.date).join('|'), beforeSig);

  Rasgiri.resetPlan();
  Rasgiri._mode = 'manual';
  currentPage = '';
});

// ═══════════════════════════════════════════════════════════════
// آزمون ۳۳: چرخه کامل واسطه — کمیسیون + حواله واسطه به تأمین‌کننده با تسویه فاکتور + ویرایش حواله + واگذاری چک دریافتی و حفاظت موجودی بانک
// ═══════════════════════════════════════════════════════════════
await runPhase4AsyncTest('آزمون ۳۳: چرخه کامل واسطه (کمیسیون، حواله به تأمین‌کننده با تسویه فاکتور، ویرایش حواله، واگذاری چک و عدم واریز کاذب به بانک)', async () => {
  await import('../js/11-contacts.js');
  const RealCon = globalThis.Con;

  memStore.contacts = [
    { id: 1, name: 'مشتری اول', type: 'customer' },
    { id: 2, name: 'تأمین‌کننده پارچه', type: 'supplier' },
    { id: 3, name: 'واسطه کریمی', type: 'broker' }
  ];
  memStore.banks = { 1: { id: 1, name: 'بانک ملت', openingBalance: 10000000 } };
  memStore.invoices = {
    99001: {
      id: 99001,
      uid: 'u-sale-99001',
      invoiceNumber: 'ف-۹۹۰۰۱',
      type: 'sale',
      date: '1404/01/05',
      contactId: 1,
      brokerId: 3,
      brokerCommission: 10000000,
      grandTotal: 60000000,
      paidAmount: 0,
      items: []
    },
    99002: {
      id: 99002,
      uid: 'u-pur-99002',
      invoiceNumber: 'خ-۹۹۰۰۲',
      type: 'purchase',
      date: '1404/01/06',
      contactId: 2,
      grandTotal: 50000000,
      paidAmount: 0,
      items: []
    }
  };
  memStore.payments = [];
  memStore.checks = [
    {
      id: 99010,
      docNumber: '2001',
      type: 'received',
      checkNumber: 'CHK-BRK-1',
      bank: 'ملی',
      amount: 60000000,
      issueDate: '1404/01/05',
      dueDate: '1404/02/10',
      contactId: 1,
      bankAccountId: 1,
      status: 'pending'
    }
  ];
  memStore.bankTransfers = [];

  const origElVal = globalThis.elVal;
  const origElNum = globalThis.elNum;
  try {
    // ۱) باز کردن مودال حواله: واسطه کریمی باید در بخش «از» دیده شود
    capturedUIContent = '';
    await Pay.showTransfer();
    assert(capturedUIContent.includes('واسطه کریمی (واسطه)'), 'واسطه باید در فهرست پرداخت‌کننده حواله دیده شود');

    // ۲) ثبت حواله ۴۰ میلیون از واسطه (۳) به تأمین‌کننده (۲) با انتخاب فاکتور خرید خ-۹۹۰۰۲
    globalThis.elVal = (fid) => {
      if (fid === 'trFrom') return '3';
      if (fid === 'trTo') return '2';
      if (fid === 'trDt') return '1404/01/08';
      if (fid === 'trNt') return 'پرداخت نقدی واسطه بابت خرید';
      return '';
    };
    globalThis.elNum = (fid) => (fid === 'trAm' ? 40000000 : 0);
    Pay.onTransferTargetChange();
    Pay.toggleTrInv(99002);
    await Pay.saveTransfer(null);

    assert.strictEqual(memStore.payments.length, 2, 'حواله باید دقیقاً ۲ سند هم‌جفت بسازد');
    const tid = memStore.payments[0].transferId;
    assert(tid, 'هر دو سند حواله باید دارای transferId مشترک باشند');

    // بررسی تسویه جزئی ۴۰M روی فاکتور خ-۹۹۰۰۲ (مانده ۱۰M) و بدون دوباره‌شماری
    let st = FinanceEngine.calculateInvoiceSettlements(Object.values(memStore.invoices), memStore.payments, { checks: memStore.checks });
    assert.strictEqual(st.byInvoiceId[99002].linkedPaid, 40000000);
    assert.strictEqual(st.byInvoiceId[99002].remaining, 10000000);

    // ۳) ویرایش همان حواله به مبلغ ۵۰M و بررسی حفظ جفت و صفر شدن مانده فاکتور خ-۹۹۰۰۲
    await Pay.showTransfer(tid);
    assert.strictEqual(Pay._trCtx.selectedOrder[0], 99002, 'هنگام ویرایش حواله، فاکتور خرید متصل باید از قبل انتخاب‌شده باشد');
    globalThis.elNum = (fid) => (fid === 'trAm' ? 50000000 : 0);
    await Pay.saveTransfer(tid);

    assert.strictEqual(memStore.payments.length, 2, 'ویرایش حواله نباید رکورد تکراری اضافه کند');
    assert.strictEqual(memStore.payments[0].transferId, tid);
    assert.strictEqual(memStore.payments[1].transferId, tid);

    st = FinanceEngine.calculateInvoiceSettlements(Object.values(memStore.invoices), memStore.payments, { checks: memStore.checks });
    assert.strictEqual(st.byInvoiceId[99002].linkedPaid, 50000000);
    assert.strictEqual(st.byInvoiceId[99002].remaining, 0, 'فاکتور خرید خ-۹۹۰۰۲ باید با حواله ۵۰M واسطه کاملاً تسویه شود');

    // حواله‌ها نباید به عنوان هزینه عملیاتی (OpEx) یا پرداخت طبقه‌بندی‌نشده حساب شوند
    const opex = FinanceEngine.filterOperatingExpenses(memStore.payments, 0, 0);
    assert.strictEqual(opex.classifiedOpEx, 0);
    assert.strictEqual(opex.unclassifiedPayments, 0);

    // ۴) کنترل مانده اشخاص قبل از واگذاری چک به واسطه:
    // مشتری ۱ = ۶۰M فروش - ۶۰M چک = ۰ | تأمین‌کننده ۲ = -۵۰M خرید + ۵۰M حواله = ۰ | واسطه ۳ = -۱۰M کمیسیون - ۵۰M حواله = -۶۰M (بستانکار)
    let bals = await RealCon.allBalances();
    assert.strictEqual(bals[1], 0);
    assert.strictEqual(bals[2], 0);
    assert.strictEqual(bals[3], -60000000, 'واسطه باید ۶۰M بستانکار باشد (۱۰M کمیسیون + ۵۰M حواله به تأمین‌کننده)');

    // ۵) واگذاری چک ۶۰M مشتری به واسطه کریمی
    capturedUIContent = '';
    await Chk.openTransferModal(99010);
    assert(capturedUIContent.includes('واسطه‌ها') && capturedUIContent.includes('واسطه کریمی (واسطه)'));

    globalThis.elVal = (fid) => {
      if (fid === 'chkTrTo') return '3';
      if (fid === 'chkTrDate') return '1404/01/09';
      if (fid === 'chkTrNotes') return 'تسویه با واسطه کریمی';
      return '';
    };
    await Chk.execTransfer(false);

    assert.strictEqual(memStore.checks[0].status, 'transferred');
    assert.strictEqual(memStore.checks[0].transferToId, 3);
    assert.strictEqual(memStore.checks[0].bankAccountId, null, 'چک واگذارشده نباید حساب بانکی ما را اشغال کند');

    // ۶) رسیدن سررسید چک واگذارشده (حتی اگر bankAccountId قدیمی داشته باشد) نباید موجودی بانک ما را بالا ببرد!
    memStore.checks[0].dueDate = '1404/01/10';
    memStore.checks[0].bankAccountId = 1;
    await Chk.autoPassDueChecks();
    assert.strictEqual(memStore.checks[0].status, 'passed');
    assert.strictEqual(memStore.checks[0].transferToId, 3);
    assert.strictEqual(memStore.payments.some(p => p.sourceCheckId === 99010), false, 'چک واگذارشده پس از پاس شدن نباید سند واریز بانکی بسازد');
    assert.strictEqual(await Bank.balance(1), 10000000, 'موجودی بانک ما باید ثابت بماند (۱۰M)');

    // ۷) مانده نهایی واسطه باید دقیقاً صفر (تسویه) شود: -۱۰M کمیسیون - ۵۰M حواله + ۶۰M چک = ۰
    bals = await RealCon.allBalances();
    assert.strictEqual(bals[3], 0, 'حساب واسطه پس از واگذاری چک ۶۰M باید دقیقاً تسویه شود');

    // ۸) در لیست دریافت/پرداخت، دکمه ویرایش حواله باید Pay.showTransfer را صدا بزند نه Pay.showF
    await Pay.render();
    assert(capturedUIContent.includes('Pay.showTransfer(' + tid + ')'), 'ویرایش ردیف حواله در لیست باید Pay.showTransfer را فراخوانی کند');
  } finally {
    globalThis.elVal = origElVal;
    globalThis.elNum = origElNum;
    Pay._trCtx = null;
    Chk._trPreviewCtx = null;
    Chk._pendingTransferIds = null;
    memStore.contacts = null;
    memStore.invoices = {};
    memStore.payments = [];
    memStore.checks = [];
    memStore.banks = {};
  }
});

// ═══════════════════════════════════════════════════════════════
// آزمون ۳۴: گزارش اختصاصی واسطه‌ها (Rep.brokers)، نمایش نام واسطه در دفتر معین (Led) و فیلتر اشخاص (Con)
// ═══════════════════════════════════════════════════════════════
await runPhase4AsyncTest('آزمون ۳۴: گزارش اختصاصی واسطه‌ها (Rep.brokers)، دفتر معین چک واگذارشده به واسطه و فیلتر تب اشخاص', async () => {
  const RealCon = globalThis.Con;
  memStore.contacts = [
    { id: 1, name: 'مشتری آلفا', type: 'customer' },
    { id: 2, name: 'تأمین‌کننده بتا', type: 'supplier' },
    { id: 3, name: 'واسطه کریمی', type: 'broker' }
  ];
  memStore.invoices = {
    99101: { id: 99101, invoiceNumber: 'ف-۹۹۱۰۱', type: 'sale', date: '1404/01/05', contactId: 1, brokerId: 3, brokerCommission: 5000000, grandTotal: 25000000, items: [] }
  };
  memStore.payments = [
    { id: 99110, type: 'receipt', contactId: 3, amount: 15000000, date: '1404/01/06', transferId: 'tr-test-1', transferTo: 2, description: 'حواله نقدی به تأمین‌کننده بتا' },
    { id: 99111, type: 'payment', contactId: 3, amount: 2000000, date: '1404/01/07', description: 'پرداخت علی‌الحساب به واسطه' }
  ];
  memStore.checks = [
    { id: 99120, docNumber: '3001', type: 'received', checkNumber: 'CHK-LED-9', amount: 10000000, issueDate: '1404/01/05', dueDate: '1404/02/05', contactId: 1, transferToId: 3, transferDate: '1404/01/08', status: 'transferred' }
  ];

  try {
    // ۱) گزارش واسطه‌ها: مانده واسطه کریمی = -۵M کمیسیون - ۱۵M حواله + ۲M نقدی + ۱۰M چک = -۸M (بستانکار)
    await Rep.brokers();
    const repHtml = capturedHTML['rC'] || '';
    assert(repHtml.includes('واسطه کریمی'), 'گزارش واسطه‌ها باید نام واسطه کریمی را نمایش دهد');
    assert(repHtml.includes(UI.fn(5000000)), 'باید جمع کمیسیون (۵M) نمایش داده شود');
    assert(repHtml.includes(UI.fn(15000000)), 'باید حواله به تأمین‌کننده (۱۵M) نمایش داده شود');
    assert(repHtml.includes(UI.fn(10000000)), 'باید چک واگذارشده (۱۰M) نمایش داده شود');
    assert(repHtml.includes(UI.fn(8000000) + ' ریال بستانکار'), 'مانده خالص واسطه باید ۸M بستانکار باشد');

    // ۲) دفتر معین مشتری ۱ باید نام دقیق «واسطه کریمی» را در شرح چک واگذارشده نشان دهد (نه تامین‌کننده)
    capturedUIContent = '';
    await Led.show(1);
    assert(capturedUIContent.includes('چک واگذارشده به واسطه کریمی'), 'دفتر معین مشتری باید نام دقیق گیرنده چک (واسطه کریمی) را بنویسد');

    // ۳) دفتر معین واسطه ۳ باید کمیسیون، حواله، پرداخت نقدی و انتقال چک را نشان دهد
    capturedUIContent = '';
    await Led.show(3);
    assert(capturedUIContent.includes('کمیسیون ف-۹۹۱۰۱'));
    assert(capturedUIContent.includes('حواله'));
    assert(capturedUIContent.includes('انتقال چک #CHK-LED-9'));

    // ۴) فیلتر اشخاص روی واسطه‌ها
    await RealCon.setFilter('broker');
    assert(capturedUIContent.includes('واسطه کریمی'));
    assert(!capturedUIContent.includes('مشتری آلفا'));
    assert(!capturedUIContent.includes('تأمین‌کننده بتا'));
  } finally {
    await RealCon.setFilter('all');
    Led._currentCid = null;
    memStore.contacts = null;
    memStore.invoices = {};
    memStore.payments = [];
    memStore.checks = [];
  }
});

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
