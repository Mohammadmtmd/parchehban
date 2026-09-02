/* ══ GLOBAL SEARCH ══
   جست‌وجوی سراسری روی فاکتورها، اسناد دریافت/پرداخت، چک‌ها، اشخاص،
   کالاها و حساب‌های بانکی.

   نسخه قبلی فقط ردیف‌های جدولِ همان صفحه را مخفی/نمایان می‌کرد، پس
   اگر فاکتوری در صفحه دیگری بود پیدا نمی‌شد. حالا کل پایگاه داده
   جست‌وجو می‌شود و هر نتیجه به سند مربوطه پیوند دارد.

   میان‌بر: Ctrl+K یا Cmd+K  |  بستن: Escape */
var Search = {
  _t: null,
  _last: '',
  MIN: 2,
  LIMIT_PER_GROUP: 8,

  onInput: function() {
    /* تأخیر کوتاه تا با هر حرف، کل پایگاه داده خوانده نشود */
    clearTimeout(Search._t);
    Search._t = setTimeout(function() {
      Search.run(elVal('searchInput'));
    }, 220);
  },

  onKey: function(e) {
    if (e.key === 'Escape') {
      Search.closePanel();
      var box = el('searchInput');
      if (box) box.blur();
    }
    if (e.key === 'Enter') {
      clearTimeout(Search._t);
      Search.run(elVal('searchInput'));
    }
  },

  focus: function() {
    var box = el('searchInput');
    if (box) {
      box.focus();
      box.select();
    }
  },

  /* نرمال‌سازی: ارقام فارسی/عربی به لاتین، ی و ک عربی به فارسی،
     حذف نیم‌فاصله و فاصله‌های اضافه — تا «محمّد رضا» و «محمدرضا» هم
     پیدا شوند. */
  norm: function(v) {
    return toEnDigits(String(v == null ? '' : v))
      .replace(/[يﻱﻲ]/g, 'ی')
      .replace(/[كﻙﻚ]/g, 'ک')
      .replace(/[\u200c\u200f\u200e]/g, '')
      .replace(/\s+/g, ' ')
      .trim()
      .toLowerCase();
  },

  hit: function(hay, q) {
    return Search.norm(hay).indexOf(q) > -1;
  },

  run: async function(raw) {
    var q = Search.norm(raw);
    Search._last = q;
    if (q.length < Search.MIN) {
      Search.closePanel();
      return;
    }
    var groups = [];
    try {
      var contacts = await DB.all('contacts');
      var cm = {};
      contacts.forEach(function(c) {
        cm[c.id] = c.name;
      });
      var products = await DB.all('products');
      var invoices = await DB.all('invoices');
      var payments = await DB.all('payments');
      var checks = await DB.all('checks');
      var banks = await DB.all('banks');
      var years = await DB.all('fiscalYears');
      var ym = {};
      years.forEach(function(y) {
        ym[y.id] = y.name;
      });

      /* ── اشخاص ── */
      groups.push({
        title: 'اشخاص',
        icon: 'bi-people-fill',
        rows: contacts.filter(function(c) {
          return Search.hit(c.name, q) || Search.hit(c.phone || '', q) || Search.hit(c.address || '', q);
        }).map(function(c) {
          return {
            main: c.name,
            sub: (c.phone ? 'تلفن ' + c.phone : '') + (c.address ? ' — ' + c.address : ''),
            go: 'Search.openLedger(' + c.id + ')'
          };
        })
      });

      /* ── کالاها ── */
      groups.push({
        title: 'کالاها',
        icon: 'bi-box-seam-fill',
        rows: products.filter(function(p) {
          return Search.hit(p.name, q) || Search.hit(p.code || '', q);
        }).map(function(p) {
          return {
            main: p.name,
            sub: (p.code ? 'کد ' + p.code : '') + (p.unit ? ' — ' + p.unit : ''),
            go: 'Search.openProduct(' + p.id + ')'
          };
        })
      });

      /* ── فاکتورها ── */
      var tName = {
        sale: 'فاکتور فروش',
        purchase: 'فاکتور خرید',
        proforma: 'پیش‌فاکتور'
      };
      groups.push({
        title: 'فاکتورها',
        icon: 'bi-receipt',
        rows: invoices.filter(function(iv) {
          if (Search.hit(iv.invoiceNumber || '', q)) return true;
          if (Search.hit(iv.date || '', q)) return true;
          if (Search.hit(cm[iv.contactId] || '', q)) return true;
          if (Search.hit(iv.notes || '', q)) return true;
          if (Search.hit(String(iv.grandTotal || ''), q)) return true;
          /* جست‌وجو در نام کالاهای داخل فاکتور */
          return (iv.items || []).some(function(it) {
            var pr = products.find(function(p) {
              return p.id === it.productId;
            });
            return pr && Search.hit(pr.name, q);
          });
        }).sort(function(a, b) {
          return pn(b.date) - pn(a.date);
        }).map(function(iv) {
          return {
            main: (tName[iv.type] || 'فاکتور') + ' ' + (iv.invoiceNumber || iv.id) +
              ' — ' + (cm[iv.contactId] || 'بی‌نام'),
            sub: iv.date + ' — مبلغ ' + UI.fn(iv.grandTotal) +
              (ym[iv.fiscalYearId] ? ' — سال ' + ym[iv.fiscalYearId] : ''),
            go: 'Search.openInvoice(' + iv.id + ')'
          };
        })
      });

      /* ── دریافت و پرداخت ── */
      groups.push({
        title: 'دریافت و پرداخت',
        icon: 'bi-wallet2',
        rows: payments.filter(function(pp) {
          return Search.hit(cm[pp.contactId] || '', q) ||
            Search.hit(pp.description || '', q) ||
            Search.hit(pp.notes || '', q) ||
            Search.hit(pp.date || '', q) ||
            Search.hit(String(pp.amount || ''), q);
        }).sort(function(a, b) {
          return pn(b.date) - pn(a.date);
        }).map(function(pp) {
          return {
            main: (pp.type === 'receipt' ? 'دریافت' : 'پرداخت') + ' ' + UI.fn(pp.amount) +
              ' — ' + (cm[pp.contactId] || 'بی‌نام'),
            sub: pp.date + (pp.description ? ' — ' + pp.description : '') +
              (pp.sourceInvoiceId ? ' (خودکار از فاکتور)' : ''),
            go: "Search.goto('#payments')"
          };
        })
      });

      /* ── چک‌ها ── */
      groups.push({
        title: 'چک‌ها',
        icon: 'bi-credit-card-2-front-fill',
        rows: checks.filter(function(ck) {
          return Search.hit(ck.checkNumber || '', q) ||
            Search.hit(cm[ck.contactId] || '', q) ||
            Search.hit(ck.bankName || '', q) ||
            Search.hit(ck.dueDate || '', q) ||
            Search.hit(String(ck.amount || ''), q);
        }).map(function(ck) {
          return {
            main: 'چک ' + (ck.checkNumber || '—') + ' — ' + UI.fn(ck.amount),
            sub: (ck.type === 'received' ? 'دریافتی' : 'پرداختی') +
              ' — سررسید ' + (ck.dueDate || '—') + ' — ' + (cm[ck.contactId] || 'بی‌نام'),
            go: "Search.goto('#checks')"
          };
        })
      });

      /* ── حساب‌های بانکی ── */
      groups.push({
        title: 'حساب‌های بانکی',
        icon: 'bi-bank2',
        rows: banks.filter(function(b) {
          return Search.hit(b.title || b.name || '', q) ||
            Search.hit(b.accountNumber || '', q) ||
            Search.hit(b.bankName || '', q);
        }).map(function(b) {
          return {
            main: b.title || b.name || 'حساب',
            sub: (b.bankName || '') + (b.accountNumber ? ' — ' + b.accountNumber : ''),
            go: "Search.goto('#banks')"
          };
        })
      });
    } catch (e) {
      console.error('خطا در جست‌وجو', e);
      Search.panel('<div class="sr-empty">جست‌وجو با خطا مواجه شد: ' + esc(e.message || '') + '</div>');
      return;
    }

    /* اگر کاربر در این فاصله متن را عوض کرده، نتیجه قدیمی را نشان نده */
    if (Search._last !== q) return;

    var total = groups.reduce(function(n, g) {
      return n + g.rows.length;
    }, 0);
    if (!total) {
      Search.panel('<div class="sr-empty">نتیجه‌ای برای «' + esc(raw) + '» پیدا نشد.</div>');
      return;
    }
    var h = '<div class="sr-head">' + UI.fn(total) + ' نتیجه برای «' + esc(raw) + '»' +
      '<button class="sr-x" onclick="Search.closePanel()"><i class="bi bi-x-lg"></i></button></div>';
    groups.forEach(function(g) {
      if (!g.rows.length) return;
      var shown = g.rows.slice(0, Search.LIMIT_PER_GROUP);
      h += '<div class="sr-g"><div class="sr-gt"><i class="bi ' + g.icon + '"></i>' +
        esc(g.title) + ' <span class="sr-c">' + UI.fn(g.rows.length) + '</span></div>';
      shown.forEach(function(r) {
        h += '<div class="sr-i" onclick="' + r.go + '">' +
          '<div class="sr-m">' + esc(r.main) + '</div>' +
          (r.sub ? '<div class="sr-s">' + esc(r.sub) + '</div>' : '') + '</div>';
      });
      if (g.rows.length > shown.length) {
        h += '<div class="sr-more">' + UI.fn(g.rows.length - shown.length) +
          ' نتیجه دیگر — جست‌وجو را دقیق‌تر کنید</div>';
      }
      h += '</div>';
    });
    Search.panel(h);
  },

  panel: function(html) {
    var p = el('searchPanel');
    if (!p) {
      p = document.createElement('div');
      p.id = 'searchPanel';
      p.className = 'sr-p';
      document.body.appendChild(p);
    }
    p.innerHTML = html;
    p.style.display = 'block';
  },

  closePanel: function() {
    var p = el('searchPanel');
    if (p) p.style.display = 'none';
  },

  _reset: function() {
    Search.closePanel();
    var box = el('searchInput');
    if (box) box.value = '';
  },

  /* رفتن به یک صفحه */
  goto: async function(hash) {
    Search._reset();
    if (location.hash === hash) {
      var r = ROUTES[hash.replace('#', '')];
      if (r) await r();
    } else {
      location.hash = hash;
    }
  },

  /* باز کردن مستقیم دفتر معین یک شخص */
  openLedger: async function(cid) {
    Search._reset();
    currentPage = 'ledger';
    await Led.show(cid);
  },

  /* باز کردن مستقیم کارتکس یک کالا */
  openProduct: async function(pid) {
    Search._reset();
    currentPage = 'productLedger';
    UI.nav('productLedger');
    await PLed.render();
    await PLed.show(pid);
  },

  /* باز کردن پیش‌نمایش فاکتور، حتی اگر در سال مالی دیگری باشد */
  openInvoice: async function(id) {
    Search._reset();
    var inv = await DB.get('invoices', id);
    if (!inv) {
      UI.toast('این فاکتور پیدا نشد', 'e');
      return;
    }
    if (inv.fiscalYearId && inv.fiscalYearId !== STATE.yearId) {
      var y = await DB.get('fiscalYears', inv.fiscalYearId);
      UI.toast('این فاکتور در سال مالی ' + ((y && y.name) || inv.fiscalYearId) + ' ثبت شده است.');
    }
    await Inv.vw(id);
  }
};

/* میان‌بر Ctrl+K / Cmd+K و بستن پنل با کلیک بیرون از آن */
document.addEventListener('keydown', function(e) {
  if ((e.ctrlKey || e.metaKey) && String(e.key).toLowerCase() === 'k') {
    e.preventDefault();
    Search.focus();
  }
});
document.addEventListener('click', function(e) {
  var p = el('searchPanel');
  if (!p || p.style.display === 'none') return;
  if (p.contains(e.target)) return;
  if (e.target && e.target.id === 'searchInput') return;
  Search.closePanel();
});
