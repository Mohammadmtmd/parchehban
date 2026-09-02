/* ══ UTILS ══ */
function switchYear(id) {
  STATE.yearId = intOf(id);
  localStorage.setItem('pb_year', STATE.yearId);
  var r = ROUTES[currentPage];
  if (r) r();
}

/* جست‌وجوی قدیمی حذف شد: فقط ردیف‌های جدولِ همان صفحه را مخفی می‌کرد.
   جای آن جست‌وجوی سراسری در js/22b-search.js آمده است. */

/* تبدیل تاریخ شمسی «1404/01/05» به عدد قابل مقایسه 14040105
   حالا ارقام فارسی، جداکننده‌های مختلف و ورودی نامعتبر را درست هندل می‌کند. */
function pn(s) {
  var norm = Jalali.parse(s);
  if (!norm) return 0;
  var p = norm.split('/');
  return parseInt(p[0], 10) * 10000 + parseInt(p[1], 10) * 100 + parseInt(p[2], 10);
}

/* ابتدای بازه زمانی (هفته/ماه/سال) بر اساس تقویم واقعی جلالی.
   نسخه قبلی هر ماه را ۳۰ روز فرض می‌کرد و مرز بازه‌ها را غلط حساب می‌کرد. */
function getPeriodStart(pr) {
  var today = Jalali.today();
  var start;
  if (pr === 'week') start = Jalali.addDays(today, -7);
  else if (pr === 'month') start = Jalali.addMonths(today, -1);
  else if (pr === 'quarter') start = Jalali.addMonths(today, -3);
  else start = Jalali.addMonths(today, -12);
  return pn(start);
}

function num2fa(n) {
  if (n === 0) return 'صفر';
  var yekan = ['', 'یک', 'دو', 'سه', 'چهار', 'پنج', 'شش', 'هفت', 'هشت', 'نه'];
  var dahgan = ['', '', 'بیست', 'سی', 'چهل', 'پنجاه', 'شصت', 'هفتاد', 'هشتاد', 'نود'];
  var sadgan = ['', 'یکصد', 'دویست', 'سیصد', 'چهارصد', 'پانصد', 'ششصد', 'هفتصد', 'هشتصد', 'نهصد'];
  var bakhsh = ['', 'هزار', 'میلیون', 'میلیارد'];
  var str = '',
    grp = 0,
    neg = false;
  if (n < 0) {
    neg = true;
    n = -n;
  }
  n = Math.floor(n);
  while (n > 0) {
    var g = n % 1000,
      s = '';
    if (g > 0) {
      var s0 = Math.floor(g / 100),
        s1 = Math.floor((g % 100) / 10),
        s2 = g % 10;
      if (s0) s += sadgan[s0] + ' و ';
      if (s1 >= 2) {
        s += dahgan[s1];
        if (s2) s += ' و ' + yekan[s2];
      } else if (s1 === 1) {
        var teen = ['ده', 'یازده', 'دوازده', 'سیزده', 'چهارده', 'پانزده', 'شانزده', 'هفده', 'هجده', 'نوزده'];
        s += teen[s2];
      } else if (s2) s += yekan[s2];
      if (bakhsh[grp]) s += ' ' + bakhsh[grp];
      if (str) str = s + ' و ' + str;
      else str = s;
    }
    n = Math.floor(n / 1000);
    grp++;
  }
  return (neg ? 'منفی ' : '') + str + ' ریال';
}
async function getOpenBal(cid) {
  var obs = await DB.all('yearOpenings');
  var ob = obs.find(function(o) {
    return o.fiscalYearId === STATE.yearId && o.contactId === cid;
  });
  if (ob) return ob.balance;
  var c = await DB.get('contacts', cid);
  /* اگر شخص حذف شده باشد، به‌جای خطا صفر برگردان */
  if (!c) return 0;
  /* عرف حسابداری: بدهکار = مثبت، بستانکار = منفی.
     دیگر قرینه نمی‌شود؛ مهاجرت v1 علامت داده‌های قبلی را اصلاح کرد. */
  return numOf(c.balance);
}
