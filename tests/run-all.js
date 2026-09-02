/* ══ اجراکننده همه تست‌ها ══
   استفاده:
     node tests/run-all.js          فقط تست‌های منطقی (بدون مرورگر)
     node tests/run-all.js --all    به‌علاوه تست‌های مرورگری

   تست‌های مرورگری نیاز دارند برنامه روی http://localhost:8000 بالا باشد.
   پورت دیگر:  PB_PORT=8080 node tests/run-all.js --all
*/
const { execFileSync } = require('child_process');
const path = require('path');

var logic = [
  ['full.js', 'تست جامع منطق'],
  ['oversell.js', 'جلوگیری از فروش بیش از موجودی'],
  ['run.js', 'مانده‌ها و گردش حساب'],
  ['routes.js', 'صفحه‌ها و مسیرها'],
  ['intl.js', 'تقویم جلالی']
];
var browser = [
  ['audit.js', 'باز شدن همه صفحه‌ها'],
  ['checkflow.js', 'چرخه کامل چک'],
  ['repexp.js', 'خروجی گزارش‌ها'],
  ['formlive.js', 'فرم‌ها و ورود اطلاعات'],
  ['prodpick.js', 'جست‌وجوی تایپی کالا'],
  ['auth.js', 'ورود و ارتقای رمز'],
  ['backup.js', 'یادآور پشتیبان‌گیری'],
  ['offline.js', 'بالا آمدن بدون اینترنت']
];

var wantAll = process.argv.indexOf('--all') > -1;
var list = wantAll ? logic.concat(browser) : logic;
var failed = 0;

console.log('\n══ تست‌های پارچه‌بان ══\n');
list.forEach(function(t) {
  var name = t[0], label = t[1];
  process.stdout.write('▶ ' + label + ' … ');
  try {
    var out = execFileSync('node', [path.join(__dirname, name)], {
      encoding: 'utf8',
      timeout: 180000,
      stdio: ['ignore', 'pipe', 'pipe']
    });
    var bad = /✗|FAIL [1-9]|مردود: [1-9]/.test(out);
    if (bad) {
      failed++;
      console.log('مردود');
      console.log(out.split('\n').filter(function(l) {
        return l.indexOf('✗') > -1 || l.indexOf('FAIL') > -1;
      }).map(function(l) { return '     ' + l; }).join('\n'));
    } else {
      var m = out.match(/PASS (\d+)/);
      console.log('قبول' + (m ? ' (' + m[1] + ' مورد)' : ''));
    }
  } catch (e) {
    failed++;
    console.log('خطا — ' + String(e.message).split('\n')[0]);
  }
});

if (!wantAll) {
  console.log('\nبرای تست‌های مرورگری هم: node tests/run-all.js --all');
  console.log('(اول برنامه را با python3 -m http.server 8000 بالا بیاورید)');
}
console.log('\n' + (failed ? '✗ ' + failed + ' دسته مردود شد' : '✓ همه تست‌ها قبول') + '\n');
process.exit(failed ? 1 : 0);
