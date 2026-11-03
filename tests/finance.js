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

console.log('\n--- اجرای ۷ آزمون الزامی محاسبات اقلام فاقد قیمت خرید ---');
const mandatorySuite = FinanceEngine.runMandatoryAuditSuite();
console.log(`نتیجه کلی آزمون‌های الزامی: ${mandatorySuite.passed} از ${mandatorySuite.total} سناریو با موفقیت پاس شدند.`);

mandatorySuite.results.forEach(r => {
  console.log(`[${r.passed ? '✓' : '✗'}] ${r.title}`);
  assert(r.passed, `تست سناریو الزامی شکست خورد: ${r.title} - ${r.actual}`);
});

assert.strictEqual(mandatorySuite.passed, 7, 'باید تمام ۷ آزمون الزامی پاس شوند');
assert.strictEqual(mandatorySuite.allPassed, true);

console.log('✓ تمامی ۷ آزمون تخصصی اصلاح سود با موفقیت ۱۰۰٪ تأیید شدند.');

