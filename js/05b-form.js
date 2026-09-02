/* ══ ابزار ساخت فرم ══
   چرا این ماژول اضافه شد:
   هر فرم قبلاً HTML خودش را دستی می‌چید. نتیجه این بود که ظاهر و رفتار
   فرم‌ها با هم فرق داشت — بعضی برچسب‌ها تک‌کلمه‌ای و مبهم بودند («شید»،
   «مرتبط»، «حداقل»)، هیچ فیلدی نشان نمی‌داد اجباری است، مبلغ‌ها بدون
   جداکننده هزارگان وارد می‌شدند و کاربر باید صفرها را می‌شمرد، و فیلد
   تاریخ هیچ راهنمایی از قالب درست نمی‌داد.

   حالا همه فرم‌ها از همین توابع ساخته می‌شوند تا یک‌دست باشند. اضافه
   کردن یک قابلیت اینجا، همه فرم‌ها را با هم بهتر می‌کند.

   نکته سازگاری: خروجی همه‌شان همان <input class="fc" id="..."> قبلی است،
   پس elVal/elNum بدون تغییر کار می‌کنند. */

var F = {

  /* ── ستون‌بندی ─────────────────────────────────────────────── */

  /* چند فیلد را کنار هم می‌چیند */
  row: function() {
    var out = '';
    for (var i = 0; i < arguments.length; i++) out += arguments[i] || '';
    return '<div class="fr mb">' + out + '</div>';
  },

  /* عنوان بخش — فرم‌های بلند را به تکه‌های قابل فهم می‌شکند */
  section: function(title, icon) {
    return '<div class="fsec"><i class="bi ' + (icon || 'bi-dot') + '"></i>' + esc(title) + '</div>';
  },

  /* ── اجزای مشترک ───────────────────────────────────────────── */

  _label: function(o) {
    var star = o.req ? '<span class="req" title="اجباری">*</span>' : '';
    var note = o.note ? '<span class="fnote">' + esc(o.note) + '</span>' : '';
    return '<label for="' + o.id + '">' + esc(o.label) + star + note + '</label>';
  },

  _hint: function(o) {
    return o.hint ? '<div class="fh">' + esc(o.hint) + '</div>' : '';
  },

  _wrap: function(o, inner) {
    return '<div class="fg">' + this._label(o) + inner + this._hint(o) + '</div>';
  },

  /* ── فیلدها ────────────────────────────────────────────────── */

  /* متن ساده */
  text: function(o) {
    var a = '';
    if (o.ph) a += ' placeholder="' + esc(o.ph) + '"';
    if (o.dir) a += ' dir="' + o.dir + '"';
    if (o.maxlength) a += ' maxlength="' + o.maxlength + '"';
    if (o.req) a += ' data-req="' + esc(o.label) + '"';
    return this._wrap(o, '<input class="fc" id="' + o.id + '" value="' + esc(o.value == null ? '' : o.value) + '"' + a + '>');
  },

  /* عدد ساده (تعداد، حداقل موجودی و مانند آن) */
  num: function(o) {
    var a = ' type="number" dir="ltr"';
    if (o.ph) a += ' placeholder="' + esc(o.ph) + '"';
    if (o.min !== undefined) a += ' min="' + o.min + '"';
    if (o.step) a += ' step="' + o.step + '"';
    var suffix = o.suffix ? '<span class="fsuf">' + esc(o.suffix) + '</span>' : '';
    var inner = '<div class="fwrap">' +
      '<input class="fc' + (suffix ? ' has-suf' : '') + '" id="' + o.id + '" value="' +
      esc(o.value == null ? '' : o.value) + '"' + a + '>' + suffix + '</div>';
    return this._wrap(o, inner);
  },

  /* مبلغ — جداکننده هزارگان زنده و نمایش مبلغ به حروف زیر فیلد.
     type را text می‌گذاریم چون input[type=number] اجازه کاما نمی‌دهد.
     numOf/elNum جداکننده را خودشان حذف می‌کنند. */
  money: function(o) {
    var v = (o.value === null || o.value === undefined || o.value === '' || o.value === 0) ?
      '' : UI.fn(o.value);
    var a = ' inputmode="numeric" dir="ltr" data-money="1" data-words="' + o.id + '_w"';
    a += ' placeholder="' + esc(o.ph || '۰') + '"';
    if (o.req) a += ' data-req="' + esc(o.label) + '"';
    var inner = '<div class="fwrap">' +
      '<input class="fc money has-suf" id="' + o.id + '" value="' + esc(v) + '"' + a + '>' +
      '<span class="fsuf">' + esc(o.unit || 'ریال') + '</span></div>' +
      '<div class="fwords" id="' + o.id + '_w"></div>';
    return this._wrap(o, inner);
  },

  /* تاریخ شمسی — راهنمای قالب و دکمه‌های میان‌بر */
  date: function(o) {
    var a = ' dir="ltr" placeholder="1405/01/05" data-date="1" maxlength="10"';
    if (o.req) a += ' data-req="' + esc(o.label) + '"';
    var quick = '<div class="fquick">' +
      '<button type="button" class="qb" data-fill="' + o.id + '" data-days="0">امروز</button>' +
      '<button type="button" class="qb" data-fill="' + o.id + '" data-days="7">۱ هفته</button>' +
      '<button type="button" class="qb" data-fill="' + o.id + '" data-days="30">۱ ماه</button>' +
      '<button type="button" class="qb" data-fill="' + o.id + '" data-days="90">۳ ماه</button>' +
      '</div>';
    var inner = '<input class="fc" id="' + o.id + '" value="' + esc(o.value == null ? '' : o.value) + '"' + a + '>' +
      (o.quick === false ? '' : quick);
    return this._wrap(o, inner);
  },

  /* فهرست انتخابی — items آرایه‌ای از {v, t, sel} یا رشته */
  select: function(o) {
    var op = '';
    if (o.empty !== false) {
      op += '<option value="">' + esc(o.empty || '— انتخاب کنید —') + '</option>';
    }
    (o.items || []).forEach(function(it) {
      if (typeof it === 'string') it = { v: it, t: it, sel: o.value === it };
      var sel = (it.sel || (o.value !== undefined && o.value !== null && String(o.value) === String(it.v))) ? ' selected' : '';
      op += '<option value="' + esc(it.v) + '"' + sel + '>' + esc(it.t) + '</option>';
    });
    var a = o.req ? ' data-req="' + esc(o.label) + '"' : '';
    return this._wrap(o, '<select class="fc" id="' + o.id + '"' + a + '>' + op + '</select>');
  },

  /* متن چندخطی */
  area: function(o) {
    var a = o.ph ? ' placeholder="' + esc(o.ph) + '"' : '';
    return this._wrap(o, '<textarea class="fc" id="' + o.id + '" rows="' + (o.rows || 2) + '"' + a + '>' +
      esc(o.value == null ? '' : o.value) + '</textarea>');
  },

  /* ── کمکی‌ها ───────────────────────────────────────────────── */

  /* فیلدهای اجباریِ خالی را پیدا و اولی را برجسته می‌کند.
     برمی‌گرداند: true اگر همه چیز پر است. */
  validate: function() {
    var bad = null;
    var list = document.querySelectorAll('[data-req]');
    for (var i = 0; i < list.length; i++) {
      var elx = list[i];
      elx.classList.remove('invalid');
      if (!String(elx.value || '').trim() && !bad) bad = elx;
    }
    if (bad) {
      bad.classList.add('invalid');
      bad.focus();
      UI.toast('«' + bad.getAttribute('data-req') + '» را وارد کنید', 'e');
      return false;
    }
    return true;
  },

  /* تمرکز روی اولین فیلد قابل تایپ */
  focusFirst: function(id) {
    setTimeout(function() {
      var t = id ? document.getElementById(id) : null;
      if (!t) {
        var m = document.querySelector('#modalBody .fc:not([disabled])');
        t = m || null;
      }
      if (t) {
        t.focus();
        if (t.select && t.value) t.select();
      }
    }, 60);
  }
};

/* ══ رفتارهای زنده فرم ══
   یک بار برای کل برنامه ثبت می‌شوند (delegation) تا هر فرمی که بعداً
   باز شود خودکار همین رفتار را داشته باشد. */
(function() {

  /* ── جداکننده هزارگان زنده، با حفظ جای مکان‌نما ─────────────── */
  function formatMoney(input) {
    var raw = input.value;
    /* شمردن رقم‌های پیش از مکان‌نما تا بعد از قالب‌بندی همان‌جا برگردد */
    var pos = input.selectionStart || 0;
    var digitsBefore = (toEnDigits(raw.slice(0, pos)).match(/\d/g) || []).length;

    var n = toEnDigits(raw).replace(/[^\d]/g, '');
    if (!n) {
      input.value = '';
      showWords(input, 0);
      return;
    }
    var out = UI.fn(parseInt(n, 10));
    input.value = out;

    /* مکان‌نما را بعد از همان تعداد رقم قرار می‌دهیم */
    var seen = 0, idx = out.length;
    for (var i = 0; i < out.length; i++) {
      if (/[\d\u06F0-\u06F9]/.test(out[i])) {
        seen++;
        if (seen === digitsBefore) { idx = i + 1; break; }
      }
    }
    if (digitsBefore === 0) idx = 0;
    try { input.setSelectionRange(idx, idx); } catch (e) {}
    showWords(input, parseInt(n, 10));
  }

  function showWords(input, val) {
    var id = input.getAttribute('data-words');
    if (!id) return;
    var box = document.getElementById(id);
    if (!box) return;
    if (!val) { box.textContent = ''; return; }
    box.textContent = numToWordsFa(val) + ' ریال';
  }

  document.addEventListener('input', function(e) {
    var t = e.target;
    if (!t || !t.getAttribute) return;
    if (t.getAttribute('data-money')) formatMoney(t);
    if (t.getAttribute('data-date')) {
      /* ارقام فارسی را به لاتین تبدیل و خودکار / می‌گذارد */
      var v = toEnDigits(t.value).replace(/[^\d/]/g, '');
      if (/^\d{4}$/.test(v)) v = v + '/';
      else if (/^\d{4}\/\d{2}$/.test(v)) v = v + '/';
      if (v !== t.value) t.value = v;
    }
    if (t.classList && t.classList.contains('invalid') && String(t.value || '').trim()) {
      t.classList.remove('invalid');
    }
  });

  /* مبلغ‌های از پیش پرشده هم باید حروفشان نمایش داده شود */
  document.addEventListener('focusin', function(e) {
    var t = e.target;
    if (t && t.getAttribute && t.getAttribute('data-money') && t.value) {
      showWords(t, numOf(t.value));
    }
  });

  /* ── دکمه‌های میان‌بر تاریخ ─────────────────────────────────── */
  document.addEventListener('click', function(e) {
    var b = e.target.closest && e.target.closest('.qb[data-fill]');
    if (!b) return;
    e.preventDefault();
    var target = document.getElementById(b.getAttribute('data-fill'));
    if (!target) return;
    var days = parseInt(b.getAttribute('data-days'), 10) || 0;
    /* Jalali.addDays سرریز ماه و سال کبیسه را خودش درست می‌کند */
    target.value = days ? Jalali.addDays(todayJ(), days) : todayJ();
    target.classList.remove('invalid');
    target.dispatchEvent(new Event('input', { bubbles: true }));
  });

  /* ── Enter برای ثبت ────────────────────────────────────────── */
  document.addEventListener('keydown', function(e) {
    if (e.key !== 'Enter') return;
    var t = e.target;
    if (!t || !t.classList || !t.classList.contains('fc')) return;
    if (t.tagName === 'TEXTAREA') return;
    var modal = t.closest('#modalBody');
    if (!modal) return;
    /* اولین دکمه اصلی فرم را می‌زند */
    var foot = document.getElementById('modalFoot');
    var btn = foot && foot.querySelector('.btn.bp, .btn.bg, .btn.bdn, .btn.bw');
    if (btn) { e.preventDefault(); btn.click(); }
  });
})();

/* ══ عدد به حروف فارسی ══
   برای نمایش زیر فیلد مبلغ، تا اشتباه صفر گرفتن دیده شود.
   نمونه: ۱۲۵۰۰۰۰ → «یک میلیون و دویست و پنجاه هزار» */
function numToWordsFa(n) {
  n = Math.floor(Math.abs(numOf(n)));
  if (!n) return 'صفر';
  var yekan = ['', 'یک', 'دو', 'سه', 'چهار', 'پنج', 'شش', 'هفت', 'هشت', 'نه'];
  var dahgan = ['', '', 'بیست', 'سی', 'چهل', 'پنجاه', 'شصت', 'هفتاد', 'هشتاد', 'نود'];
  var dahyek = ['ده', 'یازده', 'دوازده', 'سیزده', 'چهارده', 'پانزده', 'شانزده', 'هفده', 'هجده', 'نوزده'];
  var sadgan = ['', 'صد', 'دویست', 'سیصد', 'چهارصد', 'پانصد', 'ششصد', 'هفتصد', 'هشتصد', 'نهصد'];
  var scale = ['', ' هزار', ' میلیون', ' میلیارد', ' هزار میلیارد'];

  function three(x) {
    var p = [];
    var s = Math.floor(x / 100);
    var r = x % 100;
    if (s) p.push(sadgan[s]);
    if (r >= 10 && r <= 19) {
      p.push(dahyek[r - 10]);
    } else {
      var d = Math.floor(r / 10);
      var y = r % 10;
      if (d) p.push(dahgan[d]);
      if (y) p.push(yekan[y]);
    }
    return p.join(' و ');
  }

  var parts = [];
  var i = 0;
  while (n > 0 && i < scale.length) {
    var chunk = n % 1000;
    if (chunk) parts.unshift(three(chunk) + scale[i]);
    n = Math.floor(n / 1000);
    i++;
  }
  return parts.join(' و ');
}
