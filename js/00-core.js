/* ══════════════════════════════════════════════════════════════
   CORE — ابزارهای پایه: امنیت متن، تاریخ شمسی، اعداد
   این فایل باید قبل از همه ماژول‌های دیگر بارگذاری شود.
   ══════════════════════════════════════════════════════════════ */

/* --------------------------------------------------------------
   esc(v) : خنثی‌سازی متن قبل از قرار دادن داخل HTML
   جلوگیری از شکستن صفحه یا اجرای کد وقتی نام کالا/شخص
   شامل کاراکترهایی مثل " ' < > & باشد.
   -------------------------------------------------------------- */
function esc(v) {
  if (v === null || v === undefined) return '';
  return String(v)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/* --------------------------------------------------------------
   اعداد
   -------------------------------------------------------------- */
/* تبدیل ارقام فارسی/عربی به لاتین */
function toEnDigits(s) {
  if (s === null || s === undefined) return '';
  return String(s)
    .replace(/[۰-۹]/g, function(ch) {
      return String('۰۱۲۳۴۵۶۷۸۹'.indexOf(ch));
    })
    .replace(/[٠-٩]/g, function(ch) {
      return String('٠١٢٣٤٥٦٧٨٩'.indexOf(ch));
    });
}

/* عدد امن: هر ورودی (رشته فارسی، خالی، NaN) را به عدد تبدیل می‌کند */
function numOf(v) {
  if (typeof v === 'number') return isFinite(v) ? v : 0;
  /* جداکننده هزارگان لاتین/فارسی/عربی و فاصله‌ها حذف و اعشار عربی به
     نقطه تبدیل می‌شود تا «۱۲٬۳۴۵٫۵» درست خوانده شود (قبلاً فقط تا
     اولین جداکننده خوانده می‌شد و ۱۲ برمی‌گشت). */
  var t = toEnDigits(v)
    .replace(/\u066B/g, '.')
    .replace(/[,\u066C\u060C\u2009\u00A0\s_]/g, '');
  var n = parseFloat(t);
  return isFinite(n) ? n : 0;
}

/* عدد صحیح امن */
function intOf(v) {
  return Math.round(numOf(v));
}

/* --------------------------------------------------------------
   تاریخ شمسی — تبدیل دقیق جلالی ↔ میلادی
   الگوریتم استاندارد (بدون وابستگی به کتابخانه بیرونی)
   -------------------------------------------------------------- */
var Jalali = {
  /* جدول شکست‌های تقویم جلالی (الگوریتم jalaali — منطبق بر تقویم رسمی ایران) */
  _breaks: [-61, 9, 38, 199, 426, 686, 756, 818, 1111, 1181, 1210,
    1635, 2060, 2097, 2192, 2262, 2324, 2394, 2456, 3178
  ],

  _div: function(a, b) {
    return ~~(a / b);
  },
  _mod: function(a, b) {
    return a - ~~(a / b) * b;
  },

  /* محاسبات پایه سال جلالی: تعداد روزهای کبیسه، روز شروع فروردین */
  _cal: function(jy) {
    var bl = this._breaks.length,
      gy = jy + 621,
      leapJ = -14,
      jp = this._breaks[0],
      jm, jump = 0,
      leap, n, i;
    if (jy < jp || jy >= this._breaks[bl - 1]) throw new Error('سال جلالی خارج از محدوده: ' + jy);
    for (i = 1; i < bl; i += 1) {
      jm = this._breaks[i];
      jump = jm - jp;
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
    return {
      leap: leap,
      gy: gy,
      march: march
    };
  },

  /* آیا سال جلالی کبیسه است؟ */
  isLeap: function(jy) {
    return this._cal(jy).leap === 0;
  },

  /* تعداد روزهای یک ماه جلالی */
  monthDays: function(jy, jm) {
    if (jm <= 6) return 31;
    if (jm <= 11) return 30;
    return this.isLeap(jy) ? 30 : 29;
  },

  /* شماره روز جولیانی از تاریخ میلادی */
  dateToJDN: function(gy, gm, gd) {
    var d = this._div((gy + this._div(gm - 8, 6) + 100100) * 1461, 4) +
      this._div(153 * this._mod(gm + 9, 12) + 2, 5) + gd - 34840408;
    return d - this._div(this._div(gy + 100100 + this._div(gm - 8, 6), 100) * 3, 4) + 752;
  },

  /* تاریخ میلادی از شماره روز جولیانی */
  jdnToDate: function(jdn) {
    var j = 4 * jdn + 139361631;
    j = j + this._div(this._div(4 * jdn + 183187720, 146097) * 3, 4) * 4 - 3908;
    var i = this._div(this._mod(j, 1461), 4) * 5 + 308;
    var gd = this._div(this._mod(i, 153), 5) + 1;
    var gm = this._mod(this._div(i, 153), 12) + 1;
    var gy = this._div(j, 1461) - 100100 + this._div(8 - gm, 6);
    return new Date(gy, gm - 1, gd);
  },

  /* شماره روز جولیانی از تاریخ جلالی */
  toJDN: function(jy, jm, jd) {
    var r = this._cal(jy);
    return this.dateToJDN(r.gy, 3, r.march) + (jm - 1) * 31 -
      this._div(jm, 7) * (jm - 7) + jd - 1;
  },

  /* تاریخ جلالی از شماره روز جولیانی — بازگشت [jy, jm, jd] */
  fromJDN: function(jdn) {
    var gy = this.jdnToDate(jdn).getFullYear(),
      jy = gy - 621;
    var r = this._cal(jy),
      jdn1f = this.dateToJDN(gy, 3, r.march),
      jd, jm, k;
    k = jdn - jdn1f;
    if (k >= 0) {
      if (k <= 185) {
        jm = 1 + this._div(k, 31);
        jd = this._mod(k, 31) + 1;
        return [jy, jm, jd];
      } else k -= 186;
    } else {
      jy -= 1;
      k += 179;
      /* اصلاح مهم: کبیسه بودن باید برای سال jy اولیه (قبل از کاهش)
         سنجیده شود، نه سال کاهش‌یافته. با نسخه قبلی همه تاریخ‌های
         دی/بهمن/اسفند برخی سال‌ها یک روز عقب‌تر تبدیل می‌شدند. */
      if (r.leap === 1) k += 1;
    }
    jm = 7 + this._div(k, 30);
    jd = this._mod(k, 30) + 1;
    return [jy, jm, jd];
  },

  /* جلالی → میلادی (بازگشت: آبجکت Date) */
  toGregorian: function(jy, jm, jd) {
    return this.jdnToDate(this.toJDN(jy, jm, jd));
  },

  /* میلادی → جلالی (بازگشت: [jy, jm, jd]) */
  fromDate: function(date) {
    return this.fromJDN(this.dateToJDN(date.getFullYear(), date.getMonth() + 1, date.getDate()));
  },

  /* امروز به شکل 1404/01/05 */
  today: function() {
    var p = this.fromDate(new Date());
    return this.format(p[0], p[1], p[2]);
  },

  format: function(jy, jm, jd) {
    return jy + '/' + String(jm).padStart(2, '0') + '/' + String(jd).padStart(2, '0');
  },

  /* اعتبارسنجی و نرمال‌سازی رشته تاریخ ورودی کاربر
     ورودی‌های قابل قبول: 1404/1/5 ، ۱۴۰۴-۰۱-۰۵ ، 14040105
     بازگشت: '1404/01/05' یا null اگر نامعتبر باشد */
  parse: function(s) {
    if (!s) return null;
    var c = toEnDigits(String(s).trim()).replace(/[-.]/g, '/');
    var m = c.match(/^(\d{4})\/(\d{1,2})\/(\d{1,2})$/);
    if (!m && /^\d{8}$/.test(c)) m = [null, c.slice(0, 4), c.slice(4, 6), c.slice(6, 8)];
    if (!m) return null;
    var jy = parseInt(m[1], 10),
      jm = parseInt(m[2], 10),
      jd = parseInt(m[3], 10);
    if (jy < 1200 || jy > 1700) return null;
    if (jm < 1 || jm > 12) return null;
    if (jd < 1 || jd > this.monthDays(jy, jm)) return null;
    return this.format(jy, jm, jd);
  },

  /* افزودن/کاهش روز به یک تاریخ جلالی معتبر */
  addDays: function(dateStr, days) {
    var norm = this.parse(dateStr);
    if (!norm) return null;
    var p = norm.split('/').map(Number);
    var r = this.fromJDN(this.toJDN(p[0], p[1], p[2]) + days);
    return this.format(r[0], r[1], r[2]);
  },

  /* افزودن/کاهش ماه (روز به آخرین روز ماه مقصد محدود می‌شود) */
  addMonths: function(dateStr, months) {
    var norm = this.parse(dateStr);
    if (!norm) return null;
    var p = norm.split('/').map(Number);
    var total = (p[0] * 12 + (p[1] - 1)) + months;
    var jy = Math.floor(total / 12),
      jm = (total % 12) + 1;
    var jd = Math.min(p[2], this.monthDays(jy, jm));
    return this.format(jy, jm, jd);
  }
};

/* تاریخ شمسی امروز — جایگزین toLocaleDateString('fa-IR')
   که در برخی مرورگرها/سیستم‌ها ارقام فارسی یا فرمت متفاوت برمی‌گرداند */
function todayJ() {
  return Jalali.today();
}

/* --------------------------------------------------------------
   خواندن مقدار امن از فرم‌ها (بدون خطا اگر عنصر نبود)
   -------------------------------------------------------------- */
function elVal(id) {
  var el = document.getElementById(id);
  return el ? el.value : '';
}

function elNum(id) {
  return intOf(elVal(id));
}

/* نوشتن امن در یک عنصر — اگر کاربر پیش از پایان بارگذاری صفحه را عوض
   کند عنصر مقصد وجود ندارد و نسخه قبلی با
   «Cannot set properties of null» از کار می‌افتاد. */
function setHTML(id, html) {
  var el = document.getElementById(id);
  if (el) el.innerHTML = html;
  return !!el;
}

/* گرفتن عنصر با احتیاط */
function el(id) {
  return document.getElementById(id);
}

/* شناسه یکتا — برای همگام‌سازی آینده با سرور (Supabase) */
function uuid() {
  if (window.crypto && crypto.randomUUID) return crypto.randomUUID();
  return 'u-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 10);
}
