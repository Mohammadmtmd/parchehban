/**
 * تست‌های اختصاصی موتور مالی FinanceEngine (کاملاً ایزوله با داده‌های ساختگی در حافظه)
 */
import '../js/02b-finance.js';
import assert from 'assert';

const FinanceEngine = globalThis.FinanceEngine;

console.log('--- اجرای تست‌های موتور مالی FinanceEngine ---');
assert(FinanceEngine, 'FinanceEngine باید لود شده باشد');

// اجرای مجموعه ۱۰ سناریو
const suite = FinanceEngine.runDiagnosticSuite();
console.log(`نتیجه کلی سناریوهای پایه: ${suite.passed} از ${suite.total} سناریو با موفقیت پاس شدند.`);

suite.results.forEach(r => {
  console.log(`[${r.passed ? '✓' : '✗'}] ${r.title}`);
  assert(r.passed, `تست سناریو شکست خورد: ${r.title} - ${r.actual}`);
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
console.log('✓ تمام آزمون‌های پایه، الزامی و آزمون مستقل calculatePeriodPL با موفقیت پاس شدند.');

console.log('\n--- اجرای ۸ آزمون تخصصی ثبت و تفکیک هزینه‌های عملیاتی (OpEx) و صورت سود و زیان ---');
const opExSuite = FinanceEngine.runOperatingExpensesSuite();
console.log(`نتیجه کلی آزمون‌های هزینه‌های عملیاتی: ${opExSuite.passed} از ${opExSuite.total} سناریو با موفقیت پاس شدند.`);

opExSuite.results.forEach(r => {
  console.log(`[${r.passed ? '✓' : '✗'}] ${r.title}`);
  assert(r.passed, `تست سناریو هزینه‌های عملیاتی شکست خورد: ${r.title} - ${r.actual}`);
});

assert.strictEqual(opExSuite.passed, 8, 'باید تمام ۸ آزمون هزینه‌های عملیاتی پاس شوند');
assert.strictEqual(opExSuite.allPassed, true);

console.log('✓ تمامی ۸ آزمون تخصصی ثبت و تفکیک هزینه‌های عملیاتی با موفقیت ۱۰۰٪ تأیید شدند.');
console.log(`\n🎉 مجموع کل: ${suite.total + mandatorySuite.total + opExSuite.total} سناریوی مالی و حسابداری پارچه‌بان با موفقیت ۱۰۰٪ پاس شدند.`);

