/* ══ انتخاب کالا با فهرست بازشو و جست‌وجوی تایپی (Product Picker) ══
   - با کلیک روی کادر، کل فهرست کالاها باز می‌شود.
   - با تایپ هر حرف در کادر، کالاها بر اساس نام، کالیته، شید و کد فیلتر می‌شوند.
   - دارای z-index بالا (20000) تا همیشه روی پنجره مودال فاکتور نمایش یابد.
   - پشتیبانی کامل از کیبورد (ArrowDown / ArrowUp / Enter / Escape) و لمس موبایل.
*/

var PPick = {

  _open: null,      /* شماره ردیف فاکتور که فهرست آن باز است */
  _idx: -1,         /* ایندکس ردیف فعال در فهرست با کلیدهای جهت‌نما */
  _rows: [],        /* لیست رکوردهای فیلترشده فعلی */
  _insideBox: false,/* آیا نشانگر موس یا لمس کاربر داخل کادر فهرست است؟ */

  /* نرمال‌سازی متن جهت جست‌وجوی دقیق فارسی و عربی */
  norm: function(v) {
    if (typeof Search !== 'undefined' && Search.norm) {
      return Search.norm(v);
    }
    return String(v == null ? '' : v)
      .replace(/[۰-۹]/g, function(d) { return String.fromCharCode(d.charCodeAt(0) - 1728); })
      .replace(/[٠-٩]/g, function(d) { return String.fromCharCode(d.charCodeAt(0) - 1584); })
      .replace(/[يﻱﻲ]/g, 'ی')
      .replace(/[كﻙﻚ]/g, 'ک')
      .replace(/[\u200c\u200f\u200e]/g, '')
      .replace(/\s+/g, ' ')
      .trim()
      .toLowerCase();
  },

  /* المان مشترک فهرست متصل به <body> */
  box: function() {
    var b = document.getElementById('ppList');
    if (!b) {
      b = document.createElement('div');
      b.id = 'ppList';
      b.className = 'pp-list';
      b.style.position = 'fixed';
      b.style.zIndex = '20000';
      document.body.appendChild(b);

      /* رویدادهای مربوط به عدم بسته شدن ناخواسته هنگام اسکرول فهرست */
      b.addEventListener('mouseenter', function() { PPick._insideBox = true; });
      b.addEventListener('mouseleave', function() { PPick._insideBox = false; });
      b.addEventListener('mousedown', function() { PPick._insideBox = true; });
      b.addEventListener('touchstart', function() { PPick._insideBox = true; }, { passive: true });
    }
    return b;
  },

  /* ساخت کادر انتخاب کالا برای ردیف i */
  cell: function(i, productId) {
    var p = productId ? (Inv.prodMap ? Inv.prodMap[productId] : null) : null;
    var txt = p ? PPick.label(p, true) : '';
    return '<div class="pp" id="ppWrap' + i + '" data-row="' + i + '">' +
      '<input class="pp-in" id="pp' + i + '" autocomplete="off" ' +
      'placeholder="انتخاب یا جست‌وجوی کالا…" value="' + esc(txt) + '" ' +
      'data-pid="' + esc(productId || '') + '">' +
      '<span class="pp-arrow"><i class="bi bi-chevron-down"></i></span>' +
      '</div>';
  },

  /* عنوان کالا جهت نمایش در کادر و فهرست */
  label: function(p, short) {
    if (!p) return '';
    var t = p.name || '';
    var extra = [];
    if (p.colorCatalog) extra.push('کالیته ' + p.colorCatalog);
    if (p.colorShade) extra.push('شید ' + p.colorShade);
    if (extra.length) {
      t += ' (' + extra.join(' - ') + ')';
    }
    return t;
  },

  /* برچسب موجودی انبار */
  stockTag: function(p) {
    var smap = Inv.stockMap || {};
    var st = numOf(smap[p.id] || 0);
    if (st > 0) return '<span class="stk-ok" style="font-weight:700"><i class="bi bi-check2-circle"></i> موجودی: ' + UI.fn(st) + ' ' + esc(p.unit || 'متر') + '</span>';
    if (st < 0) return '<span class="stk-no" style="font-weight:700"><i class="bi bi-exclamation-octagon"></i> کسری: ' + UI.fn(-st) + ' ' + esc(p.unit || 'متر') + '</span>';
    return '<span class="stk-no" style="opacity:.85"><i class="bi bi-x-circle"></i> ناموجود</span>';
  },

  /* فیلتر کردن کالاها با متن تایپ‌شده */
  find: function(q) {
    var all = [];
    if (Inv.prodMap && Object.keys(Inv.prodMap).length > 0) {
      for (var k in Inv.prodMap) {
        if (Object.prototype.hasOwnProperty.call(Inv.prodMap, k)) all.push(Inv.prodMap[k]);
      }
    }

    /* اگر کادر خالی است، کل کالاها را نمایش بده */
    var normQ = PPick.norm(q);
    if (!normQ) {
      all.sort(function(a, b) {
        return (a.name || '').localeCompare(b.name || '', 'fa');
      });
      return all.slice(0, 120);
    }

    var out = [];
    all.forEach(function(p) {
      var hay = [
        p.name || '',
        p.colorCatalog || '',
        p.colorShade || '',
        p.unit || '',
        p.notes || '',
        p.id ? String(p.id) : ''
      ].join(' ');

      if (PPick.norm(hay).indexOf(normQ) > -1) {
        out.push(p);
      }
    });

    /* اولویت‌بندی نتایج: کالاهایی که نامشان با عبارت شروع می‌شود در ابتدا قرار می‌گیرند */
    out.sort(function(a, b) {
      var an = PPick.norm(a.name || '');
      var bn = PPick.norm(b.name || '');
      var sa = an.indexOf(normQ) === 0 ? 0 : 1;
      var sb = bn.indexOf(normQ) === 0 ? 0 : 1;
      if (sa !== sb) return sa - sb;
      return (a.name || '').localeCompare(b.name || '', 'fa');
    });

    return out.slice(0, 120);
  },

  /* نمایش فهرست زیر کادر ردیف i */
  show: async function(i, q) {
    /* اطمینان از بارگذاری اطلاعات کالاها در حافظه موقت فاکتور */
    if (!Inv.prodMap || Object.keys(Inv.prodMap).length === 0) {
      try {
        var pr = await DB.all('products');
        Inv.prodMap = Inv.prodMap || {};
        pr.forEach(function(p) { Inv.prodMap[p.id] = p; });
        if (!Inv.stockMap && typeof Prod !== 'undefined' && Prod.stockMap) {
          Inv.stockMap = await Prod.stockMap();
        }
      } catch (e) {
        console.warn('PPick load products error:', e);
      }
    }

    var box = PPick.box();
    PPick._open = i;

    /* به‌روزرسانی وضعیت باز بودن کادر در استایل */
    document.querySelectorAll('.pp').forEach(function(el) { el.classList.remove('pp-open'); });
    var curWrap = document.getElementById('ppWrap' + i);
    if (curWrap) curWrap.classList.add('pp-open');

    /* دریافت کالاها */
    PPick._rows = PPick.find(q == null ? '' : q);

    /* بررسی کالای جاری انتخاب شده برای هایلایت شدن در فهرست */
    var inp = document.getElementById('pp' + i);
    var curPid = inp ? intOf(inp.getAttribute('data-pid')) : null;

    PPick._idx = 0;
    if (curPid && PPick._rows.length) {
      var foundIdx = PPick._rows.findIndex(function(x) { return x.id === curPid; });
      if (foundIdx > -1) PPick._idx = foundIdx;
    }

    if (!PPick._rows.length) {
      var totalProds = Inv.prodMap ? Object.keys(Inv.prodMap).length : 0;
      if (totalProds === 0) {
        box.innerHTML = '<div class="pp-none">' +
          '<i class="bi bi-box-seam" style="font-size:1.4rem;color:var(--txm);display:block;margin-bottom:6px"></i>' +
          '<strong>هیچ کالایی در برنامه ثبت نشده است.</strong><br>' +
          '<small style="color:var(--txs)">ابتدا باید در بخش «کالاها» اقلام خود را تعریف نمایید.</small>' +
          '</div>';
      } else {
        box.innerHTML = '<div class="pp-none">' +
          '<i class="bi bi-search" style="font-size:1.2rem;color:var(--txm);display:block;margin-bottom:4px"></i>' +
          'کالایی با عبارت «' + esc(q) + '» پیدا نشد.' +
          '</div>';
      }
      box.classList.add('show');
      PPick.place(i);
      return;
    }

    var h = '';
    PPick._rows.forEach(function(p, n) {
      var isCur = (n === PPick._idx);
      var sub = [];
      if (p.colorCatalog) sub.push('کالیته: <strong>' + esc(p.colorCatalog) + '</strong>');
      if (p.colorShade) sub.push('شید: <strong>' + esc(p.colorShade) + '</strong>');
      var subHtml = sub.length ? '<div style="font-size:.74rem;color:var(--txs);margin-top:2px">' + sub.join(' &bull; ') + '</div>' : '';

      h += '<div class="pp-it' + (isCur ? ' on' : '') + '" data-row="' + i + '" data-pid="' + p.id + '">' +
        '<div style="min-width:0;flex:1">' +
        '<div class="pp-nm">' + esc(p.name) + '</div>' +
        subHtml +
        '</div>' +
        '<div class="pp-st">' + PPick.stockTag(p) + '</div>' +
        '</div>';
    });

    box.innerHTML = h;
    box.classList.add('show');
    PPick.place(i);

    /* اسکرول به سمت گزینه هایلایت شده */
    var activeIt = box.querySelector('.pp-it.on');
    if (activeIt && activeIt.scrollIntoView) {
      activeIt.scrollIntoView({ block: 'nearest' });
    }
  },

  /* جای‌گذاری دقیق فهرست زیر یا بالای کادر ورودی با موقعیت Fixed */
  place: function(i) {
    var inp = document.getElementById('pp' + i);
    if (!inp) return;
    var box = PPick.box();
    var r = inp.getBoundingClientRect();
    if (r.width === 0 && r.height === 0) return;

    var w = Math.max(r.width, 320);
    var left = r.right - w;
    if (left < 10) left = 10;
    if (left + w > window.innerWidth - 10) left = window.innerWidth - 10 - w;

    box.style.width = w + 'px';
    box.style.left = left + 'px';

    var below = window.innerHeight - r.bottom - 12;
    var above = r.top - 12;
    if (below < 160 && above > below) {
      box.style.maxHeight = Math.min(260, above) + 'px';
      box.style.top = '';
      box.style.bottom = (window.innerHeight - r.top + 4) + 'px';
    } else {
      box.style.maxHeight = Math.min(260, below) + 'px';
      box.style.bottom = '';
      box.style.top = (r.bottom + 4) + 'px';
    }
  },

  /* بستن فهرست بازشو */
  hide: function() {
    if (PPick._open === null) return;
    var box = PPick.box();
    box.classList.remove('show');
    document.querySelectorAll('.pp').forEach(function(el) { el.classList.remove('pp-open'); });
    PPick._open = null;
    PPick._idx = -1;
    PPick._rows = [];
    PPick._insideBox = false;
  },

  /* حرکت بین گزینه‌ها با کلیدهای جهت‌نما */
  move: function(d) {
    if (PPick._open === null || !PPick._rows.length) return;
    PPick._idx += d;
    if (PPick._idx < 0) PPick._idx = PPick._rows.length - 1;
    if (PPick._idx >= PPick._rows.length) PPick._idx = 0;
    var its = PPick.box().querySelectorAll('.pp-it');
    for (var n = 0; n < its.length; n++) {
      its[n].classList.toggle('on', n === PPick._idx);
    }
    var cur = its[PPick._idx];
    if (cur && cur.scrollIntoView) cur.scrollIntoView({ block: 'nearest' });
  },

  /* انتخاب نهایی کالا */
  pick: function(i, pid) {
    var p = Inv.prodMap ? Inv.prodMap[pid] : null;
    var inp = document.getElementById('pp' + i);
    if (inp) {
      inp.value = p ? PPick.label(p, true) : '';
      inp.setAttribute('data-pid', pid || '');
      inp.classList.remove('pp-bad');
    }
    PPick.hide();
    Inv.oc(i, 'p', pid || '');

    /* انتقال خودکار فوکوس به فیلد تعداد همان ردیف */
    var q = document.getElementById('q' + i);
    if (q) {
      q.focus();
      if (q.select) q.select();
    }
  },

  /* تثبیت نهایی مقدار ورودی پس از خروج از فیلد */
  settle: function(i) {
    var inp = document.getElementById('pp' + i);
    if (!inp) return;
    var pid = intOf(inp.getAttribute('data-pid'));
    if (!inp.value.trim()) {
      var cur = Inv.items[i];
      if (cur && cur.productId) Inv.oc(i, 'p', '');
      inp.setAttribute('data-pid', '');
      inp.classList.remove('pp-bad');
      return;
    }
    if (!pid) {
      var r = PPick.find(inp.value);
      if (r.length === 1) {
        PPick.pick(i, r[0].id);
        return;
      }
      inp.classList.add('pp-bad');
      return;
    }
    var p = Inv.prodMap ? Inv.prodMap[pid] : null;
    if (p) inp.value = PPick.label(p, true);
  }
};

/* ══ شنوندگان رویدادها (Event Delegation) ══ */
(function() {

  function rowOf(t) {
    var w = t.closest && t.closest('.pp');
    return w ? intOf(w.getAttribute('data-row')) : null;
  }

  /* ۱. تایپ در کادر: بلافاصله فیلتر انجام شود */
  document.addEventListener('input', function(e) {
    var t = e.target;
    if (!t.classList || !t.classList.contains('pp-in')) return;
    var i = rowOf(t);
    if (i === null) return;
    t.setAttribute('data-pid', '');
    t.classList.remove('pp-bad');
    PPick.show(i, t.value);
  });

  /* ۲. کلیک روی کادر یا فلش بازشو: کل فهرست نمایش داده شود */
  document.addEventListener('click', function(e) {
    var t = e.target;

    /* اگر کلیک روی کادر ورودی انتخاب کالا است */
    if (t.classList && t.classList.contains('pp-in')) {
      var i = rowOf(t);
      if (i === null) return;
      PPick.show(i, '');
      if (t.select) t.select();
      return;
    }

    /* اگر کلیک روی آیکون فلش یا ظرف کادر است */
    var pWrap = t.closest && t.closest('.pp');
    if (pWrap) {
      var inp = pWrap.querySelector('.pp-in');
      if (inp) {
        var rIdx = rowOf(inp);
        if (rIdx !== null) {
          inp.focus();
          PPick.show(rIdx, '');
          if (inp.select) inp.select();
          return;
        }
      }
    }

    /* اگر کلیک خارج از کادر و خارج از فهرست بود، فهرست بسته شود */
    if (!t.closest('.pp') && !t.closest('#ppList')) {
      if (PPick._open !== null) {
        var openRow = PPick._open;
        PPick.hide();
        PPick.settle(openRow);
      }
    }
  });

  /* ۳. ورود فوکوس به کادر */
  document.addEventListener('focusin', function(e) {
    var t = e.target;
    if (!t.classList || !t.classList.contains('pp-in')) return;
    var i = rowOf(t);
    if (i === null) return;
    PPick.show(i, '');
    if (t.select) t.select();
  });

  /* ۴. خروج فوکوس با محافظت از کلیک داخل فهرست */
  document.addEventListener('focusout', function(e) {
    var t = e.target;
    if (!t.classList || !t.classList.contains('pp-in')) return;
    var i = rowOf(t);
    setTimeout(function() {
      if (PPick._insideBox) return;
      if (PPick._open === i) PPick.hide();
      if (i !== null) PPick.settle(i);
    }, 220);
  });

  /* ۵. ناوبری با کلیدهای کیبورد */
  document.addEventListener('keydown', function(e) {
    var t = e.target;
    if (!t.classList || !t.classList.contains('pp-in')) return;
    var i = rowOf(t);
    if (i === null) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (PPick._open !== i) {
        PPick.show(i, t.value);
      } else {
        PPick.move(1);
      }
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      PPick.move(-1);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      e.stopPropagation();
      if (PPick._open === i && PPick._idx > -1 && PPick._rows[PPick._idx]) {
        PPick.pick(i, PPick._rows[PPick._idx].id);
      }
    } else if (e.key === 'Escape') {
      PPick.hide();
    }
  }, true);

  /* تنظیم موقعیت هنگام اسکرول یا تغییر سایز پنجره */
  function reflow() {
    if (PPick._open !== null) PPick.place(PPick._open);
  }
  window.addEventListener('scroll', reflow, true);
  window.addEventListener('resize', reflow);

  /* ۶. انتخاب گزینه با کلیک یا لمس سریع */
  function handleSelect(e) {
    var it = e.target.closest && e.target.closest('.pp-it');
    if (!it) return;
    e.preventDefault();
    e.stopPropagation();
    PPick.pick(intOf(it.getAttribute('data-row')), intOf(it.getAttribute('data-pid')));
  }

  document.addEventListener('mousedown', handleSelect);
  document.addEventListener('touchstart', handleSelect, { passive: false });
})();

