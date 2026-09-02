/* ══ انتخاب کالا با جست‌وجوی تایپی ══
   چرا اضافه شد:
   ردیف‌های فاکتور از <select> ساده استفاده می‌کردند. وقتی تعداد کالاها
   از چند ده مورد بگذرد، پیدا کردن کالا در فهرست بازشو عملاً غیرممکن
   می‌شود — باید با موس اسکرول کنید و نمی‌شود تایپ کرد.

   حالا هر ردیف یک کادر تایپی است: چند حرف از نام یا کد کالیته را
   می‌زنید و فهرست فیلتر می‌شود. با ↑ ↓ حرکت و با Enter انتخاب.

   نکته مهم: در پایان همان Inv.oc(i,'p',id) صدا زده می‌شود، پس تمام
   منطق قبلی (پر شدن خودکار کالیته و شید، محاسبه جمع، کنترل فروش بیش
   از موجودی) بدون تغییر باقی می‌ماند. */

var PPick = {

  _open: null,   /* شماره ردیفی که فهرستش باز است */
  _idx: -1,      /* گزینه‌ای که با کلید انتخاب شده */
  _rows: [],     /* نتایج فعلی */

  /* ══ جعبه فهرست ══
     یک جعبه مشترک که مستقیم به <body> چسبانده می‌شود.
     چرا داخل ردیف نگه داشته نشد: پنجره فاکتور backdrop-filter دارد و
     این ویژگی برای فرزندان position:fixed یک «بلوک مرجع» می‌سازد، پس
     مختصات صفحه‌ای که حساب می‌کردیم جابه‌جا اعمال می‌شد و فهرست جای
     غلط (بیرون کادر دید) می‌افتاد. با چسباندن به body از هر بلوک
     مرجع و هر overflow:hidden بیرون می‌ماند. */
  box: function() {
    var b = document.getElementById('ppList');
    if (!b) {
      b = document.createElement('div');
      b.id = 'ppList';
      b.className = 'pp-list';
      document.body.appendChild(b);
    }
    return b;
  },

  /* HTML کادر انتخاب برای ردیف i */
  cell: function(i, productId) {
    var p = productId ? Inv.prodMap[productId] : null;
    var txt = p ? PPick.label(p, true) : '';
    return '<div class="pp" data-row="' + i + '">' +
      '<input class="pp-in" id="pp' + i + '" autocomplete="off" ' +
      'placeholder="نام یا کد کالا…" value="' + esc(txt) + '" ' +
      'data-pid="' + esc(productId || '') + '">' +
      '</div>';
  },

  /* برچسب کالا. short=true یعنی نسخه کوتاه برای داخل کادر */
  label: function(p, short) {
    var t = p.name;
    if (p.colorCatalog) t += ' (' + p.colorCatalog + ')';
    if (short) return t;
    return t;
  },

  /* موجودی به شکل قابل نمایش */
  stockTag: function(p) {
    var st = numOf((Inv.stockMap || {})[p.id] || 0);
    if (st > 0) return '<span class="stk-ok">موجودی: ' + UI.fn(st) + ' ' + esc(p.unit || '') + '</span>';
    if (st < 0) return '<span class="stk-no">کسری: ' + UI.fn(-st) + ' ' + esc(p.unit || '') + '</span>';
    return '<span class="stk-no">ناموجود</span>';
  },

  /* فیلتر کردن کالاها بر اساس متن تایپ‌شده */
  find: function(q) {
    var all = [];
    for (var k in Inv.prodMap) {
      if (Object.prototype.hasOwnProperty.call(Inv.prodMap, k)) all.push(Inv.prodMap[k]);
    }
    q = Search.norm(q);
    if (!q) return all.slice(0, 50);
    var out = [];
    all.forEach(function(p) {
      /* نام، کد کالیته و شید رنگ هر سه جست‌وجو می‌شوند */
      var hay = [p.name, p.colorCatalog, p.colorShade].join(' ');
      if (Search.norm(hay).indexOf(q) > -1) out.push(p);
    });
    /* کالاهایی که نامشان با عبارت شروع می‌شود اول می‌آیند */
    out.sort(function(a, b) {
      var sa = Search.norm(a.name).indexOf(q) === 0 ? 0 : 1;
      var sb = Search.norm(b.name).indexOf(q) === 0 ? 0 : 1;
      return sa - sb;
    });
    return out.slice(0, 50);
  },

  /* نمایش فهرست زیر کادر ردیف i */
  show: function(i, q) {
    var box = PPick.box();
    PPick._open = i;
    PPick._rows = PPick.find(q == null ? '' : q);
    PPick._idx = PPick._rows.length ? 0 : -1;

    if (!PPick._rows.length) {
      box.innerHTML = '<div class="pp-none">کالایی پیدا نشد</div>';
      box.classList.add('show');
      return;
    }
    var h = '';
    PPick._rows.forEach(function(p, n) {
      h += '<div class="pp-it' + (n === 0 ? ' on' : '') + '" data-row="' + i + '" data-pid="' + p.id + '">' +
        '<span class="pp-nm">' + esc(PPick.label(p)) + '</span>' +
        '<span class="pp-st">' + PPick.stockTag(p) + '</span>' +
        '</div>';
    });
    box.innerHTML = h;
    box.classList.add('show');
    box.scrollTop = 0;
    PPick.place(i);
  },

  /* ══ جای‌گذاری فهرست ══
     کارت «اقلام» overflow:hidden دارد و بدنه پنجره هم اسکرول می‌شود؛
     با موقعیت absolute فهرست بریده می‌شد و فقط یک نوار باریک از آن
     دیده می‌شد. با position:fixed از همه این محدودیت‌ها بیرون می‌آید
     و مختصاتش را اینجا حساب می‌کنیم. */
  place: function(i) {
    var inp = document.getElementById('pp' + i);
    if (!inp) return;
    var box = PPick.box();
    var r = inp.getBoundingClientRect();
    /* حداقل عرض تا نام کالا و موجودی جا شود */
    var w = Math.max(r.width, 280);
    var left = r.right - w;
    if (left < 8) left = 8;
    if (left + w > window.innerWidth - 8) left = window.innerWidth - 8 - w;

    box.style.width = w + 'px';
    box.style.left = left + 'px';

    var below = window.innerHeight - r.bottom - 12;
    var above = r.top - 12;
    /* اگر پایین جا نبود، فهرست به سمت بالا باز می‌شود */
    if (below < 150 && above > below) {
      box.style.maxHeight = Math.min(230, above) + 'px';
      box.style.top = '';
      box.style.bottom = (window.innerHeight - r.top + 3) + 'px';
    } else {
      box.style.maxHeight = Math.min(230, below) + 'px';
      box.style.bottom = '';
      box.style.top = (r.bottom + 3) + 'px';
    }
  },

  hide: function() {
    if (PPick._open === null) return;
    PPick.box().classList.remove('show');
    PPick._open = null;
    PPick._idx = -1;
    PPick._rows = [];
  },

  /* حرکت با کلیدهای بالا/پایین */
  move: function(d) {
    if (PPick._open === null || !PPick._rows.length) return;
    PPick._idx += d;
    if (PPick._idx < 0) PPick._idx = PPick._rows.length - 1;
    if (PPick._idx >= PPick._rows.length) PPick._idx = 0;
    var its = PPick.box().querySelectorAll('.pp-it');
    for (var n = 0; n < its.length; n++) its[n].classList.toggle('on', n === PPick._idx);
    var cur = its[PPick._idx];
    if (cur && cur.scrollIntoView) cur.scrollIntoView({ block: 'nearest' });
  },

  /* انتخاب نهایی — همان مسیر قبلی Inv.oc صدا زده می‌شود */
  pick: function(i, pid) {
    var p = Inv.prodMap[pid];
    var inp = document.getElementById('pp' + i);
    if (inp) {
      inp.value = p ? PPick.label(p, true) : '';
      inp.setAttribute('data-pid', pid || '');
      inp.classList.remove('pp-bad');
    }
    PPick.hide();
    Inv.oc(i, 'p', pid || '');
    /* مکان‌نما به فیلد تعداد همان ردیف می‌رود تا جریان کار نشکند */
    var q = document.getElementById('q' + i);
    if (q) { q.focus(); if (q.select) q.select(); }
  },

  /* اگر کادر خالی/نامعتبر رها شد، انتخاب پاک می‌شود تا ردیف با
     نام نیمه‌تایپ‌شده و بدون کالا ذخیره نشود */
  settle: function(i) {
    var inp = document.getElementById('pp' + i);
    if (!inp) return;
    var pid = intOf(inp.getAttribute('data-pid'));
    if (!inp.value.trim()) {
      /* مبنا باید خودِ ردیف فاکتور باشد نه data-pid: به‌محض تایپ،
         data-pid پاک می‌شود، پس اگر آن را ملاک می‌گرفتیم خالی کردن
         کادر هرگز کالای قبلی را از ردیف حذف نمی‌کرد و فاکتور با
         کالای اشتباه ثبت می‌شد. */
      var cur = Inv.items[i];
      if (cur && cur.productId) Inv.oc(i, 'p', '');
      inp.setAttribute('data-pid', '');
      inp.classList.remove('pp-bad');
      return;
    }
    if (!pid) {
      /* متنی هست ولی کالایی انتخاب نشده — اگر فقط یک نتیجه دارد
         خودکار همان را می‌گیریم، وگرنه علامت می‌زنیم */
      var r = PPick.find(inp.value);
      if (r.length === 1) { PPick.pick(i, r[0].id); return; }
      inp.classList.add('pp-bad');
      return;
    }
    /* برگرداندن متن به نام درست کالا */
    var p = Inv.prodMap[pid];
    if (p) inp.value = PPick.label(p, true);
  }
};

/* ══ رفتار زنده (delegation، یک بار برای کل برنامه) ══ */
(function() {

  function rowOf(t) {
    var w = t.closest && t.closest('.pp');
    return w ? intOf(w.getAttribute('data-row')) : null;
  }

  document.addEventListener('input', function(e) {
    var t = e.target;
    if (!t.classList || !t.classList.contains('pp-in')) return;
    var i = rowOf(t);
    if (i === null) return;
    /* تا وقتی کاربر تایپ می‌کند انتخاب قبلی بی‌اعتبار است */
    t.setAttribute('data-pid', '');
    t.classList.remove('pp-bad');
    PPick.show(i, t.value);
  });

  document.addEventListener('focusin', function(e) {
    var t = e.target;
    if (!t.classList || !t.classList.contains('pp-in')) return;
    var i = rowOf(t);
    if (i === null) return;
    if (t.select) t.select();
    PPick.show(i, '');
  });

  document.addEventListener('focusout', function(e) {
    var t = e.target;
    if (!t.classList || !t.classList.contains('pp-in')) return;
    var i = rowOf(t);
    /* کمی صبر تا اگر کاربر روی یک گزینه کلیک کرده، کلیک از دست نرود */
    setTimeout(function() {
      if (PPick._open === i) PPick.hide();
      if (i !== null) PPick.settle(i);
    }, 160);
  });

  document.addEventListener('keydown', function(e) {
    var t = e.target;
    if (!t.classList || !t.classList.contains('pp-in')) return;
    var i = rowOf(t);
    if (i === null) return;
    if (e.key === 'ArrowDown') { e.preventDefault(); if (PPick._open !== i) PPick.show(i, t.value); else PPick.move(1); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); PPick.move(-1); }
    else if (e.key === 'Enter') {
      e.preventDefault();
      e.stopPropagation(); /* جلوی ثبت شدن کل فاکتور با Enter را می‌گیرد */
      if (PPick._open === i && PPick._idx > -1 && PPick._rows[PPick._idx]) {
        PPick.pick(i, PPick._rows[PPick._idx].id);
      }
    } else if (e.key === 'Escape') { PPick.hide(); }
  }, true);

  /* با اسکرول یا تغییر اندازه، فهرست باید همراه کادر جابه‌جا شود */
  function reflow() { if (PPick._open !== null) PPick.place(PPick._open); }
  window.addEventListener('scroll', reflow, true);
  window.addEventListener('resize', reflow);

  /* mousedown به‌جای click تا پیش از focusout اجرا شود */
  document.addEventListener('mousedown', function(e) {
    var it = e.target.closest && e.target.closest('.pp-it');
    if (!it) return;
    e.preventDefault();
    PPick.pick(intOf(it.getAttribute('data-row')), intOf(it.getAttribute('data-pid')));
  });
})();
