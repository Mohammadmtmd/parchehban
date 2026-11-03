/* ══ REPORTS ══ */
var Rep = {
  _c: null,
  render: async function() {
    currentPage = 'reports';
    UI.nav('reports');
    UI.title('bi-bar-chart-line-fill', 'گزارشات');
    UI.act('');
    UI.content('<div class="tab-bar"><button class="tab-btn active" onclick="Rep.tab(this,\'summary\')">خلاصه</button><button class="tab-btn" onclick="Rep.tab(this,\'purchases\')">خرید</button><button class="tab-btn" onclick="Rep.tab(this,\'sales\')">فروش</button><button class="tab-btn" onclick="Rep.tab(this,\'stock\')">موجودی</button><button class="tab-btn" onclick="Rep.tab(this,\'profit\')">سود و زیان</button><button class="tab-btn" onclick="Rep.tab(this,\'debtors\')">بدهکاران</button><button class="tab-btn" onclick="Rep.tab(this,\'creditors\')">بستانکاران</button><button class="tab-btn" onclick="Rep.tab(this,\'diagnostics\')"><i class="bi bi-shield-check"></i> آزمونگر تشخیصی</button></div><div id="rC"></div>');
    this._c = 'summary';
    await this.summary();
    this._btns();
  },
  tab: async function(el, n) {
    document.querySelectorAll('.tab-btn').forEach(function(b) {
      b.classList.remove('active');
    });
    el.classList.add('active');
    this._c = n;
    await this[n]();
    this._btns();
  },

  /* ── خروجی گزارش‌ها ────────────────────────────────────────────────
     افزوده شد: تا قبل از این فقط دفتر معین دکمه خروجی داشت و هیچ‌کدام
     از هفت گزارش قابل ذخیره نبود.

     به‌جای نوشتن هفت تابع خروجی جداگانه (که با هر تغییر گزارش از کار
     می‌افتاد)، جدولِ همان لحظه از روی صفحه خوانده می‌شود. پس هر تغییری
     در گزارش‌ها خودبه‌خود در خروجی هم اعمال می‌گردد.

     گزارش‌هایی که به‌جای جدول کارت خلاصه دارند (خلاصه، خرید، فروش) به
     شکل «عنوان / مقدار» صادر می‌شوند. */
  _titles: {
    summary: 'خلاصه',
    purchases: 'گزارش خرید',
    sales: 'گزارش فروش',
    stock: 'گزارش موجودی',
    profit: 'سود و زیان',
    debtors: 'بدهکاران',
    creditors: 'بستانکاران',
    diagnostics: 'آزمونگر تشخیصی ۱۰ سناریوی مالی'
  },

  _btns: function() {
    var t = this._titles[this._c] || 'گزارش';
    UI.act('<button class="btn bg bs" onclick="Rep.expCSV()"><i class="bi bi-filetype-xlsx"></i>Excel</button> ' +
      '<button class="btn bdn bs" onclick="Rep.expPDF()"><i class="bi bi-filetype-pdf"></i>PDF</button>' +
      '<span class="mut" style="margin-inline-start:8px;font-size:12px">' + esc(t) + '</span>');
  },

  /* جدول جاری را از DOM می‌خواند و به {head, rows, foot} تبدیل می‌کند */
  _grab: function() {
    var c = document.getElementById('rC');
    if (!c) return null;
    var txt = function(el) {
      return (el.innerText || el.textContent || '').replace(/\s+/g, ' ').trim();
    };
    var tb = c.querySelector('table');
    if (tb) {
      var head = [];
      var hr = tb.querySelectorAll('thead th');
      for (var i = 0; i < hr.length; i++) head.push(txt(hr[i]));
      var rows = [];
      var trs = tb.querySelectorAll('tbody tr');
      for (var j = 0; j < trs.length; j++) {
        var tds = trs[j].querySelectorAll('td');
        if (!tds.length) continue;
        var r = [];
        for (var k = 0; k < tds.length; k++) r.push(txt(tds[k]));
        while (r.length < head.length) {
          r.push('');
        }
        rows.push(r);
      }
      var foot = null;
      var ftr = tb.querySelector('tfoot tr');
      if (ftr) {
        foot = [];
        var fc = ftr.querySelectorAll('td,th');
        for (var m = 0; m < fc.length; m++) foot.push(txt(fc[m]));
      }
      if (!head.length && rows.length) {
        for (var n = 0; n < rows[0].length; n++) head.push('ستون ' + (n + 1));
      }
      return {
        head: head,
        rows: rows,
        foot: foot
      };
    }
    /* حالت کارتی */
    var cards = c.querySelectorAll('.sc');
    if (cards.length) {
      var cr = [];
      for (var q = 0; q < cards.length; q++) {
        var h3 = cards[q].querySelector('h3');
        var pp = cards[q].querySelector('p');
        cr.push([pp ? txt(pp) : '—', h3 ? txt(h3) : '—']);
      }
      return {
        head: ['عنوان', 'مقدار'],
        rows: cr,
        foot: null
      };
    }
    return null;
  },

  expCSV: function() {
    var g = this._grab();
    if (!g || !g.rows.length) {
      UI.toast('این گزارش داده‌ای برای خروجی ندارد', 'e');
      return;
    }
    var rows = g.rows.slice();
    if (this._c === 'profit' && this._lastPL && !this._lastPL.isComplete) {
      rows.unshift(['هشدار مهم اعتبار سود:', 'سود نهایی دوره قابل تعیین نیست', 'سود نمایش‌داده‌شده صرفاً «سود قابل‌تأیید» بر پایه اقلام دارای بهای موثق است', 'وضعیت: ناقص']);
    }
    if (g.foot) rows.push(g.foot);
    var t = this._titles[this._c] || 'گزارش';
    var suffix = (this._c === 'profit' && this._lastPL && !this._lastPL.isComplete) ? '-unverified' : '';
    EXP.csv(g.head, rows, 'parchehban-' + (this._c || 'report') + suffix + '-' + todayJ().replace(/\//g, '-') + '.csv');
    UI.toast('خروجی ' + t + ' آماده شد', 's');
  },

  expPDF: function() {
    var g = this._grab();
    if (!g || !g.rows.length) {
      UI.toast('این گزارش داده‌ای برای خروجی ندارد', 'e');
      return;
    }
    var t = this._titles[this._c] || 'گزارش';
    var sum = null;
    if (this._c === 'profit' && this._lastPL && !this._lastPL.isComplete) {
      sum = '<div style="background:#fff3cd;border:1.5px solid #ffeeba;color:#856404;padding:12px 16px;border-radius:6px;margin-bottom:14px;font-size:12px;line-height:1.8">' +
        '<strong>⚠ هشدار مهم مالی: سود نهایی دوره قابل تعیین نیست.</strong><br>' +
        'در این دوره، تعداد <strong>' + (this._lastPL.unverifiedItemsCount || 0) + ' قلم کالا</strong> در فاکتورهای فروش فاقد بهای خرید معتبر هستند (مجموع فروش این اقلام: ' + UI.fn(this._lastPL.unverifiedRevenueTotal || 0) + ' ریال). مبالغ سود نمایش‌داده‌شده در این گزارش صرفاً <strong>«سود قابل‌تأیید»</strong> اقلام دارای بهای موثق است و نباید به عنوان سود قطعی کل دوره تلقی گردد.' +
        '</div>';
    }
    var titleSuffix = (this._c === 'profit' && this._lastPL && !this._lastPL.isComplete) ? ' (سود قابل‌تأیید — وضعیت: ناقص)' : '';
    var rows = g.rows.slice();
    if (g.foot) rows.push(g.foot);
    EXP.pdf(t + ' — ' + todayJ() + titleSuffix, g.head, rows, sum);
  },
  summary: async function() {
    var invs = await FY.byYear('invoices'),
      pays = await FY.byYear('payments');
    var tP = 0,
      tPP = 0,
      tS = 0,
      tSP = 0,
      tSh = 0;
    invs.forEach(function(v) {
      if (v.type === 'proforma') return;
      if (v.type === 'purchase') {
        tP += v.grandTotal || 0;
        tPP += v.paidAmount || 0;
      } else {
        tS += v.grandTotal || 0;
        tSP += v.paidAmount || 0;
      }
      tSh += v.shippingCost || 0;
    });
    var tR = 0,
      tPm = 0;
    pays.forEach(function(p) {
      if (p.type === 'receipt') tR += p.amount || 0;
      else tPm += p.amount || 0;
    });
    tPP += tPm;
    tSP += tR;
    var pr = tS - tP - tSh;
    var h = '<div class="sg">';
    h += '<div class="sc"><div class="si o"><i class="bi bi-cart-fill"></i></div><div class="sti"><h3>' + UI.fn(tP) + '</h3><p>کل خرید</p></div></div>';
    h += '<div class="sc"><div class="si g"><i class="bi bi-receipt-cutoff"></i></div><div class="sti"><h3>' + UI.fn(tS) + '</h3><p>کل فروش</p></div></div>';
    h += '<div class="sc"><div class="si g"><i class="bi bi-arrow-down-circle"></i></div><div class="sti"><h3>' + UI.fn(tR) + '</h3><p>دریافت‌ها</p></div></div>';
    h += '<div class="sc"><div class="si r"><i class="bi bi-arrow-up-circle"></i></div><div class="sti"><h3>' + UI.fn(tPm) + '</h3><p>پرداخت‌ها</p></div></div></div>';
    h += '<div class="g2"><div class="cd"><div class="cd-h">وضعیت خرید</div><div class="cd-b"><p>کل خرید: ' + UI.fn(tP) + '</p><p>پرداخت فاکتور: ' + UI.fn(tPP - tPm) + '</p><p>پرداخت مستقل: ' + UI.fn(tPm) + '</p><p style="font-weight:700;color:var(--ok)">کل پرداختی: ' + UI.fn(tPP) + '</p><p style="color:var(--d);font-weight:700">مانده: ' + UI.fn(tP - tPP) + '</p></div></div><div class="cd"><div class="cd-h">وضعیت فروش</div><div class="cd-b"><p>کل فروش: ' + UI.fn(tS) + '</p><p>دریافت فاکتور: ' + UI.fn(tSP - tR) + '</p><p>دریافت مستقل: ' + UI.fn(tR) + '</p><p style="font-weight:700;color:var(--ok)">کل دریافتی: ' + UI.fn(tSP) + '</p><p style="color:var(--d);font-weight:700">مانده: ' + UI.fn(tS - tSP) + '</p></div></div></div>';
    setHTML('rC', h);
  },
  purchases: async function() {
    await this._ir('purchase');
  },
  sales: async function() {
    await this._ir('sale');
  },
  _ir: async function(type) {
    var all = await FY.byYear('invoices');
    var pays = await FY.byYear('payments');
    var ls = all.filter(function(i) {
      return i.type === type;
    });
    var ct = await DB.all('contacts'),
      cm = {};
    ct.forEach(function(c) {
      cm[c.id] = c.name;
    });
    var tG = 0,
      tP = 0;
    ls.forEach(function(v) {
      tG += v.grandTotal || 0;
      tP += v.paidAmount || 0;
    });
    var stPay = 0;
    pays.forEach(function(p) {
      if (type === 'purchase' && p.type === 'payment') stPay += p.amount || 0;
      if (type === 'sale' && p.type === 'receipt') stPay += p.amount || 0;
    });
    var lb = type === 'sale' ? 'فروش' : 'خرید';
    var pl = type === 'sale' ? 'دریافت' : 'پرداخت';
    var h = '<div class="sg">';
    h += '<div class="sc"><div class="si o"><i class="bi bi-cart-fill"></i></div><div class="sti"><h3>' + UI.fn(tG) + '</h3><p>کل ' + lb + '</p></div></div>';
    h += '<div class="sc"><div class="si g"><i class="bi bi-check-circle"></i></div><div class="sti"><h3>' + UI.fn(tP + stPay) + '</h3><p>کل ' + pl + '</p></div></div>';
    h += '<div class="sc"><div class="si r"><i class="bi bi-exclamation-circle"></i></div><div class="sti"><h3>' + UI.fn(tG - tP - stPay) + '</h3><p>مانده</p></div></div></div>';
    setHTML('rC', h);
  },
  stock: async function() {
    var ps = await DB.all('products'),
      cs = await DB.all('categories'),
      cm = {};
    cs.forEach(function(c) {
      cm[c.id] = c.name;
    });
    var invs = await FY.byYear('invoices');
    var sm = {};
    ps.forEach(function(p) {
      sm[p.id] = 0;
    });
    invs.forEach(function(inv) {
      if (inv.type === 'proforma') return;
      (inv.items || []).forEach(function(it) {
        if (sm[it.productId] !== undefined) sm[it.productId] += inv.type === 'purchase' ? it.quantity : -it.quantity;
      });
    });
    var tr = '';
    for (var i = 0; i < ps.length; i++) {
      var p = ps[i];
      var st = sm[p.id] || 0;
      var sc = (p.minStock && st <= p.minStock) || st < 0 ? 'color:var(--d);font-weight:700' : '';
      tr += '<tr><td>' + (i + 1) + '</td><td><strong>' + esc(p.name) + '</strong></td><td>' + (cm[p.categoryId] || '—') + '</td><td>' + esc(p.colorShade || '—') + '</td><td>' + esc(p.colorCatalog || '—') + '</td><td style="' + sc + '">' + UI.fn(st) + '</td></tr>';
    }
    setHTML('rC', '<div class="cd"><div class="cd-h">موجودی</div><div class="tw"><table><thead><tr><th>#</th><th>نام</th><th>گروه</th><th>شید</th><th>کالیته</th><th>موجودی</th></tr></thead><tbody>' + tr + '</tbody></table></div></div>');
  },
  profit: async function(period) {
    var p = period || this._pPeriod || 'year';
    this._pPeriod = p;
    var invs = await FY.byYear('invoices');
    var ps = await DB.all('products');
    var contacts = await DB.all('contacts');
    var pays = await FY.byYear('payments');

    var pMap = {}, cMap = {};
    ps.forEach(function(x) { pMap[x.id] = x; });
    contacts.forEach(function(x) { cMap[x.id] = x.name; });

    /* فیلتر دوره زمانی */
    var startNum = 0;
    if (p !== 'all') {
      startNum = getPeriodStart(p);
    }

    /* محاسبه جامع سود و متغیرهای مالی از طریق موتور استاندارد FinanceEngine */
    var plData = FinanceEngine.calculatePeriodPL(invs, pays, startNum, 0);
    this._lastPL = plData;

    var grossSales = plData.grossSales;
    var totalDiscounts = plData.totalDiscounts;
    var totalShipping = plData.totalShipping;
    var netSales = plData.netSales;
    var totalCOGS = plData.cogs;
    var grossProfit = plData.grossProfit;
    var grossMarginPct = plData.grossMarginPct;
    var brokerCommissions = plData.brokerCommissions;
    var classifiedOpEx = plData.classifiedOpEx;
    var unclassifiedPayments = plData.unclassifiedPayments;
    var netProfit = plData.netOperatingProfit;
    var netMarginPct = plData.netMarginPct;
    var productBreakdown = plData.productBreakdown;
    var invoiceBreakdown = plData.invoiceBreakdown;
    var saleInvsCount = plData.invoiceCount;
    var isComplete = plData.isComplete;

    /* ساخت رابط کاربری حرفه‌ای صورت سود و زیان (P&L) */
    var pLabels = { month: 'ماه جاری', quarter: '۳ ماهه جاری', year: 'سال مالی جاری', all: 'تمام دوران' };

    var h = '<div style="margin-bottom:18px;display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:10px">';
    h += '<div style="display:flex;gap:6px">';
    ['month', 'quarter', 'year', 'all'].forEach(function(pk) {
      var act = (p === pk) ? 'bp' : 'bo';
      h += '<button class="btn ' + act + ' bs" onclick="Rep.profit(\'' + pk + '\')">' + pLabels[pk] + '</button>';
    });
    h += '</div>';
    h += '<div style="font-size:.82rem;color:var(--txs)"><i class="bi bi-clock-history"></i> دوره بررسی: <strong>' + pLabels[p] + '</strong> (' + UI.fn(saleInvsCount) + ' فاکتور فروش)</div>';
    h += '</div>';

    /* بنر هشدار اقلام فاقد قیمت خرید (الزام ممیزی: هشدار صریح سود نهایی دوره قابل تعیین نیست) */
    if (plData.unverifiedItemsCount > 0) {
      h += '<div class="hint-box" style="margin-bottom:18px;background:rgba(217,119,6,.08);border:1.5px solid var(--w);padding:14px 18px;border-radius:10px;display:flex;align-items:center;gap:12px">' +
        '<i class="bi bi-exclamation-triangle-fill" style="color:var(--w);font-size:1.45rem;flex-shrink:0"></i>' +
        '<div style="font-size:.86rem;line-height:1.75">' +
        '<strong style="color:var(--w);font-size:.95rem">هشدار ممیزی سود: سود نهایی دوره قابل تعیین نیست.</strong><br>' +
        'در این دوره، تعداد <strong>' + UI.fn(plData.unverifiedItemsCount) + ' قلم کالا</strong> در فاکتورهای فروش فاقد قیمت خرید معتبر (یا صفر) می‌باشند (مجموع فروش این اقلام: ' + UI.fn(plData.unverifiedRevenueTotal) + ' ریال). مبالغ سود نمایش‌داده‌شده در این گزارش صرفاً <strong>«سود قابل‌تأیید»</strong> بر پایه اقلام دارای بهای موثق است و نباید به عنوان سود قطعی کل دوره تلقی گردد.' +
        '</div>' +
        '</div>';
    }

    /* کارت‌های خلاصه آماری P&L */
    var profitAfterBroker = grossProfit - brokerCommissions;
    var marginAfterBrokerPct = netSales > 0 ? (profitAfterBroker / netSales) * 100 : 0;
    var card3Title = isComplete
      ? (brokerCommissions > 0 ? 'سود فروش (پس از کمیسیون)' : 'سود ناخالص بازرگانی')
      : (brokerCommissions > 0 ? 'سود قابل‌تأیید (پس از کمیسیون)' : 'سود ناخالص قابل‌تأیید');
    var card4Title = isComplete ? 'سود خالص عملیاتی' : 'سود خالص قابل‌تأیید';

    h += '<div class="sg" style="grid-template-columns:repeat(auto-fit,minmax(210px,1fr));margin-bottom:20px">';
    h += '<div class="sc"><div class="si g"><i class="bi bi-cash-stack"></i></div><div class="sti"><h3>' + UI.fn(netSales) + '</h3><p>درآمد خالص فروش</p></div></div>';
    h += '<div class="sc"><div class="si o"><i class="bi bi-cart-check-fill"></i></div><div class="sti"><h3>' + UI.fn(Math.round(totalCOGS)) + '</h3><p>بهای تمام‌شده موثق (COGS)</p></div></div>';
    h += '<div class="sc"><div class="si ' + (profitAfterBroker >= 0 ? 'g' : 'r') + '"><i class="bi bi-graph-up-arrow"></i></div><div class="sti"><h3 style="color:' + (profitAfterBroker >= 0 ? 'var(--ok)' : 'var(--d)') + '">' + UI.fn(Math.round(profitAfterBroker)) + '</h3><p>' + card3Title + ' (' + marginAfterBrokerPct.toFixed(1) + '٪)' + (!isComplete ? ' <span class="tg tg-o" style="font-size:10px">سود قابل‌تأیید</span>' : '') + '</p></div></div>';
    h += '<div class="sc"><div class="si ' + (netProfit >= 0 ? 'b' : 'r') + '"><i class="bi bi-award-fill"></i></div><div class="sti"><h3 style="color:' + (netProfit >= 0 ? 'var(--p)' : 'var(--d)') + '">' + UI.fn(Math.round(netProfit)) + '</h3><p>' + card4Title + ' (' + netMarginPct.toFixed(1) + '٪)' + (!isComplete ? ' <span class="tg tg-o" style="font-size:10px">سود قابل‌تأیید</span>' : '') + '</p></div></div>';
    h += '</div>';

    /* صورت حساب رسمی سود و زیان (P&L Statement) */
    h += '<div class="cd" style="margin-bottom:22px">';
    h += '<div class="cd-h"><div style="display:flex;align-items:center;gap:8px"><i class="bi bi-file-earmark-spreadsheet-fill" style="color:var(--p)"></i><span>صورت سود و زیان دوره‌ای (Income Statement)</span></div><div style="display:flex;gap:6px">' +
      (!isComplete ? '<span class="tg tg-o" style="font-weight:700">سود نهایی دوره قابل تعیین نیست</span>' : '') +
      '<span class="tg ' + (plData.isComplete ? 'tg-g' : 'tg-o') + '">' + plData.statusLabel + '</span><span class="tg tg-b">' + pLabels[p] + '</span></div></div>';
    h += '<div class="tw"><table><thead><tr><th style="text-align:right">شرح حساب</th><th style="width:160px;text-align:left">مبلغ جزئی (ریال)</th><th style="width:180px;text-align:left">مبلغ نهایی (ریال)</th><th style="width:90px;text-align:center">درصد از فروش</th></tr></thead><tbody>';

    if (!isComplete) {
      h += '<tr style="background:rgba(217,119,6,.08);color:var(--w);font-weight:700"><td colspan="4"><i class="bi bi-exclamation-triangle-fill" style="margin-inline-end:6px"></i> توجه حسابداری: سود نهایی دوره قابل تعیین نیست. مبالغ اعلام‌شده در این صورت مالی صرفاً «سود قابل‌تأیید» اقلام دارای بهای خرید معتبر بوده و سود قطعی دوره نمی‌باشد.</td></tr>';
    }

    h += '<tr style="font-weight:700;background:rgba(37,99,235,.04)"><td>درآمد عملیاتی ناخالص فروش</td><td style="text-align:left">' + UI.fn(grossSales) + '</td><td></td><td style="text-align:center">۱۰۰٪</td></tr>';
    if (totalDiscounts > 0) {
      h += '<tr style="color:var(--d)"><td style="padding-inline-start:28px">کسر می‌شود: تخفیفات اعطایی فاکتورها (تسهیم‌شده)</td><td style="text-align:left">(' + UI.fn(totalDiscounts) + ')</td><td></td><td style="text-align:center">−' + (netSales > 0 ? ((totalDiscounts / grossSales) * 100).toFixed(1) : 0) + '٪</td></tr>';
    }
    if (totalShipping > 0) {
      h += '<tr><td style="padding-inline-start:28px">اضافه می‌شود: درآمد خدمات حمل فاکتورهای فروش</td><td style="text-align:left">' + UI.fn(totalShipping) + '</td><td></td><td style="text-align:center">+' + (netSales > 0 ? ((totalShipping / grossSales) * 100).toFixed(1) : 0) + '٪</td></tr>';
    }
    h += '<tr style="font-weight:800;background:var(--bg)"><td>= درآمد خالص کل فروش (Net Sales)</td><td></td><td style="text-align:left;font-weight:800;color:var(--p)">' + UI.fn(netSales) + '</td><td style="text-align:center;font-weight:700">۱۰۰٪</td></tr>';

    // تفکیک دقیق فروش بر پایه وضعیت بهای تمام‌شده
    h += '<tr style="font-size:12.5px;color:var(--txs)"><td style="padding-inline-start:28px">• فروش اقلام دارای بهای تمام‌شده معتبر</td><td style="text-align:left">' + UI.fn(plData.salesWithValidBuyPrice) + '</td><td></td><td style="text-align:center">' + (netSales > 0 ? ((plData.salesWithValidBuyPrice / netSales) * 100).toFixed(1) : 0) + '٪</td></tr>';
    if (plData.salesWithoutValidBuyPrice > 0) {
      h += '<tr style="font-size:12.5px;color:var(--w);background:rgba(217,119,6,.04)"><td style="padding-inline-start:28px">• فروش اقلام فاقد بهای معتبر (سود نامشخص / نیازمند تکمیل اطلاعات)</td><td style="text-align:left">' + UI.fn(plData.salesWithoutValidBuyPrice) + '</td><td></td><td style="text-align:center">' + (netSales > 0 ? ((plData.salesWithoutValidBuyPrice / netSales) * 100).toFixed(1) : 0) + '٪</td></tr>';
    }

    h += '<tr style="color:var(--w)"><td style="padding-inline-start:28px">کسر می‌شود: بهای تمام‌شده کالای فروش‌رفته (بر پایه buyPrice صریح اقلام معتبر)</td><td style="text-align:left">(' + UI.fn(Math.round(totalCOGS)) + ')</td><td></td><td style="text-align:center">−' + (netSales > 0 ? ((totalCOGS / netSales) * 100).toFixed(1) : 0) + '٪</td></tr>';
    var grossProfitLabel = isComplete
      ? '= سود ناخالص عملیاتی بازرگانی (Gross Profit)'
      : '= سود ناخالص قابل‌تأیید (سود نهایی دوره قابل تعیین نیست)';
    var grossStatusTag = isComplete
      ? '<span class="tg tg-g" style="font-size:11px;margin-inline-start:8px">قطعی</span>'
      : '<span class="tg tg-o" style="font-size:11px;margin-inline-start:8px">سود قابل‌تأیید</span>';
    h += '<tr style="font-weight:800;background:rgba(22,163,74,.08)"><td>' + grossProfitLabel + ' ' + grossStatusTag + '</td><td></td><td style="text-align:left;font-weight:800;color:' + (grossProfit >= 0 ? 'var(--ok)' : 'var(--d)') + '">' + UI.fn(Math.round(grossProfit)) + '</td><td style="text-align:center;font-weight:800;color:' + (grossProfit >= 0 ? 'var(--ok)' : 'var(--d)') + '">' + grossMarginPct.toFixed(1) + '٪</td></tr>';

    if (brokerCommissions > 0) {
      h += '<tr style="color:var(--d)"><td style="padding-inline-start:28px">کسر می‌شود: کارمزد و پورسانت واسطه‌های فروش</td><td style="text-align:left">(' + UI.fn(brokerCommissions) + ')</td><td></td><td style="text-align:center">−' + (netSales > 0 ? ((brokerCommissions / netSales) * 100).toFixed(1) : 0) + '٪</td></tr>';
      var brokerProfitLabel = isComplete
        ? '= سود فروش پس از کسر کمیسیون واسطه‌ها'
        : '= سود قابل‌تأیید پس از کسر کمیسیون واسطه‌ها';
      h += '<tr style="font-weight:700;background:rgba(37,99,235,.05)"><td>' + brokerProfitLabel + '</td><td></td><td style="text-align:left;font-weight:800;color:' + (profitAfterBroker >= 0 ? 'var(--ok)' : 'var(--d)') + '">' + UI.fn(Math.round(profitAfterBroker)) + '</td><td style="text-align:center;font-weight:700">' + marginAfterBrokerPct.toFixed(1) + '٪</td></tr>';
    }

    if (classifiedOpEx > 0) {
      h += '<tr style="color:var(--d)"><td style="padding-inline-start:28px">کسر می‌شود: هزینه‌های جاری عملیاتی (تفکیک‌شده)</td><td style="text-align:left">(' + UI.fn(classifiedOpEx) + ')</td><td></td><td style="text-align:center">−' + (netSales > 0 ? ((classifiedOpEx / netSales) * 100).toFixed(1) : 0) + '٪</td></tr>';
      // ریز سرفصل‌های هزینه
      var expCats = Object.keys(plData.expensesByCategory || {});
      expCats.forEach(function(ck) {
        var cAmt = plData.expensesByCategory[ck];
        h += '<tr style="font-size:12px;color:var(--txs)"><td style="padding-inline-start:48px">• سرفصل: ' + esc(ck) + '</td><td style="text-align:left">' + UI.fn(cAmt) + '</td><td></td><td></td></tr>';
      });
    }

    var netProfitLabel = isComplete
      ? '= سود خالص عملیاتی نهایی دوره (Net Profit)'
      : '= سود خالص قابل‌تأیید عملیاتی (سود نهایی دوره قابل تعیین نیست)';
    var netStatusTag = isComplete
      ? '<span class="tg tg-g" style="font-size:11px;margin-inline-start:6px">قطعی</span>'
      : '<span class="tg tg-o" style="font-size:11px;margin-inline-start:6px">سود نهایی نامشخص</span>';
    h += '<tr style="font-weight:800;font-size:.95rem;background:' + (netProfit >= 0 ? 'var(--okl)' : 'var(--dl)') + '"><td style="color:' + (netProfit >= 0 ? 'var(--ok)' : 'var(--d)') + '">' + netProfitLabel + ' ' + netStatusTag + '</td><td></td><td style="text-align:left;font-weight:800;color:' + (netProfit >= 0 ? 'var(--ok)' : 'var(--d)') + '">' + UI.fn(Math.round(netProfit)) + '</td><td style="text-align:center;font-weight:800;color:' + (netProfit >= 0 ? 'var(--ok)' : 'var(--d)') + '">' + netMarginPct.toFixed(1) + '٪</td></tr>';

    // سطر تحلیلی پرداخت‌های بدون سرفصل مشخص (مطابق تصمیم تأییدشده کاربر: تفکیک و عدم کسر خودکار)
    if (unclassifiedPayments > 0) {
      h += '<tr style="background:rgba(217,119,6,.06);color:var(--w);font-weight:600"><td><i class="bi bi-question-circle" style="margin-inline-end:6px"></i> پرداخت‌های خروجی نیازمند تعیین سرفصل (کسر نشده از سود)</td><td style="text-align:left">[' + UI.fn(unclassifiedPayments) + ']</td><td></td><td style="text-align:center"><span class="tg tg-o">نیازمند بررسی</span></td></tr>';
    }

    h += '</tbody></table></div></div>';

    /* جدول سود به تفکیک کالاها */
    var prodRows = '';
    var prodList = Object.values(productBreakdown).sort(function(a, b) { return b.profit - a.profit; });
    prodList.forEach(function(it, idx) {
      var margin = it.revenue > 0 ? (it.profit / it.revenue) * 100 : 0;
      var avgBuyPrice = it.qty > 0 ? Math.round(it.cogs / it.qty) : 0;
      var avgSellPrice = it.qty > 0 ? Math.round(it.revenue / it.qty) : 0;
      var unvBadge = it.unverifiedCount > 0 ? ' <span class="tg tg-o" style="font-size:10px" title="تعداد ' + it.unverifiedCount + ' ردیف فاقد قیمت خرید">بهای نامشخص</span>' : '';

      prodRows += '<tr>' +
        '<td>' + (idx + 1) + '</td>' +
        '<td><strong>' + esc(it.name) + '</strong>' + unvBadge + '</td>' +
        '<td style="text-align:center">' + UI.fn(it.qty) + '</td>' +
        '<td style="text-align:left">' + (avgBuyPrice > 0 ? UI.fn(avgBuyPrice) : '<span style="color:var(--w)">نامشخص</span>') + '</td>' +
        '<td style="text-align:left">' + UI.fn(avgSellPrice) + '</td>' +
        '<td style="text-align:left">' + UI.fn(Math.round(it.cogs)) + '</td>' +
        '<td style="text-align:left">' + UI.fn(it.revenue) + '</td>' +
        '<td style="text-align:left;font-weight:700;color:' + (it.profit >= 0 ? 'var(--ok)' : 'var(--d)') + '">' + UI.fn(Math.round(it.profit)) + '</td>' +
        '<td style="text-align:center;font-weight:600"><span class="tg ' + (margin >= 15 ? 'tg-g' : margin > 0 ? 'tg-o' : 'tg-r') + '">' + margin.toFixed(1) + '٪</span></td>' +
        '</tr>';
    });

    h += '<div class="cd" style="margin-bottom:22px">';
    h += '<div class="cd-h"><span><i class="bi bi-tags-fill" style="margin-inline-end:6px;color:var(--ok)"></i>سود ناخالص به تفکیک کالاها (با بهای اختصاصی اقلام)</span><span class="mut" style="font-size:11px">' + prodList.length + ' قلم کالا</span></div>';
    h += '<div class="tw"><table><thead><tr><th>#</th><th>نام کالا</th><th style="text-align:center">تعداد فروش</th><th style="text-align:left">میانگین خرید</th><th style="text-align:left">میانگین فروش</th><th style="text-align:left">بهای تمام‌شده کل</th><th style="text-align:left">درآمد فروش</th><th style="text-align:left">سود ریالی</th><th style="text-align:center">حاشیه سود</th></tr></thead><tbody>';
    h += (prodRows || '<tr><td colspan="9" style="text-align:center">فروشی در این دوره ثبت نشده است</td></tr>');
    h += '</tbody></table></div></div>';

    /* جدول سود به تفکیک فاکتورهای فروش */
    var invRows = '';
    invoiceBreakdown.sort(function(a, b) { return (b.invoiceId || 0) - (a.invoiceId || 0); });
    invoiceBreakdown.slice(0, 30).forEach(function(inv, idx) {
      var contactTitle = cMap[inv.contactId] || 'مشتری آزاد';
      var badgeUnv = inv.hasUnverifiedItems ? ' <span class="tg tg-o" style="font-size:10px" title="شامل قلم فاقد قیمت خرید">⚠ بررسی</span>' : '';
      var pVal = inv.profitAfterBroker !== undefined ? inv.profitAfterBroker : (inv.grossProfit - (inv.brokerCommission || 0));
      var commBadge = (inv.brokerCommission > 0) ? ' <span class="tg tg-r" style="font-size:10px" title="کمیسیون واسطه">کمیسیون: −' + UI.fn(inv.brokerCommission) + '</span>' : '';

      invRows += '<tr class="clk" onclick="Inv.vw(' + inv.invoiceId + ')">' +
        '<td>' + (idx + 1) + '</td>' +
        '<td><strong style="color:var(--p)">' + esc(inv.invoiceNumber) + '</strong>' + badgeUnv + '</td>' +
        '<td>' + esc(contactTitle) + '</td>' +
        '<td style="text-align:center">' + esc(inv.date) + '</td>' +
        '<td style="text-align:left">' + UI.fn(inv.grandTotal) + '</td>' +
        '<td style="text-align:left">' + UI.fn(Math.round(inv.cogs)) + '</td>' +
        '<td style="text-align:left;font-weight:700;color:' + (pVal >= 0 ? 'var(--ok)' : 'var(--d)') + '">' + UI.fn(Math.round(pVal)) + commBadge + '</td>' +
        '<td style="text-align:center"><span class="tg ' + (inv.marginPct >= 15 ? 'tg-g' : inv.marginPct > 0 ? 'tg-o' : 'tg-r') + '">' + inv.marginPct.toFixed(1) + '٪</span></td>' +
        '</tr>';
    });

    h += '<div class="cd">';
    h += '<div class="cd-h"><span><i class="bi bi-receipt" style="margin-inline-end:6px;color:var(--p)"></i>سود به تفکیک فاکتورهای فروش (کلیک برای مشاهده)</span><span class="mut" style="font-size:11px">' + invoiceBreakdown.length + ' فاکتور</span></div>';
    h += '<div class="tw"><table><thead><tr><th>#</th><th>شماره فاکتور</th><th>مشتری</th><th style="text-align:center">تاریخ</th><th style="text-align:left">مبلغ فاکتور</th><th style="text-align:left">بهای تمام‌شده</th><th style="text-align:left">سود فاکتور (با کسر کمیسیون)</th><th style="text-align:center">حاشیه سود</th></tr></thead><tbody>';
    h += (invRows || '<tr><td colspan="8" style="text-align:center">فاکتوری در این دوره ثبت نشده است</td></tr>');
    h += '</tbody></table></div></div>';

    setHTML('rC', h);
  },

  /* آزمونگر تشخیصی محاسبات مالی (کاملاً ایزوله در رم بدون دیتابیس) */
  diagnostics: async function() {
    var suite = FinanceEngine.runDiagnosticSuite();
    var mandatorySuite = FinanceEngine.runMandatoryAuditSuite ? FinanceEngine.runMandatoryAuditSuite() : { passed: 0, total: 0, results: [] };
    var opExSuite = FinanceEngine.runOperatingExpensesSuite ? FinanceEngine.runOperatingExpensesSuite() : { passed: 0, total: 0, results: [] };
    var phase2Suite = FinanceEngine.runPhase2AuditSuite ? FinanceEngine.runPhase2AuditSuite() : { passed: 0, total: 0, results: [] };
    var totalPassed = suite.passed + mandatorySuite.passed + opExSuite.passed + phase2Suite.passed;
    var totalTests = suite.total + mandatorySuite.total + opExSuite.total + phase2Suite.total;
    var allPassed = (totalPassed === totalTests);

    var h = '<div style="margin-bottom:18px;display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:12px">';
    h += '<div><h3 style="margin:0;font-size:1.15rem;font-weight:800"><i class="bi bi-shield-check" style="color:var(--ok);margin-inline-end:8px"></i>آزمونگر تشخیصی محاسبات مالی و اعتبارسنجی سود</h3><p style="margin:4px 0 0;font-size:.84rem;color:var(--txs)">اعتبارسنجی زنده ' + totalTests + ' سناریوی حسابداری (۱۰ پایه + ۸ ممیزی سود + ۸ هزینه‌های عملیاتی + ' + phase2Suite.total + ' ممیزی سرفصل و حواله) کاملاً ایزوله در رم</p></div>';
    h += '<div style="display:flex;align-items:center;gap:10px">';
    h += '<span class="tg ' + (allPassed ? 'tg-g' : 'tg-r') + '" style="font-size:.9rem;padding:6px 14px;font-weight:700">' + (allPassed ? '✓ ' + totalPassed + ' از ' + totalTests + ' سناریو کاملاً موفق' : (totalTests - totalPassed) + ' سناریو ناموفق') + '</span>';
    h += '<button class="btn bp bs" onclick="Rep.diagnostics()"><i class="bi bi-arrow-repeat"></i> اجرای مجدد آزمون‌ها</button>';
    h += '</div></div>';

    // بخش ۱: آزمون‌های ممیزی مرحله دوم (اعتبارسنجی سرفصل‌های هزینه و اصلاح تشخیص حواله)
    h += '<div class="cd" style="margin-bottom:24px;border:1.5px solid #0284c7">';
    h += '<div class="cd-h"><div style="display:flex;align-items:center;gap:8px"><i class="bi bi-shield-shaded" style="color:#0284c7"></i><strong style="color:#0284c7">مجموعه ' + phase2Suite.total + ' آزمون تکمیلی ممیزی مرحله دوم: اعتبارسنجی سرفصل‌های معتبر هزینه و تشخیص دقیق حواله</strong></div><span class="tg ' + (phase2Suite.allPassed ? 'tg-g' : 'tg-r') + '">' + phase2Suite.passed + ' از ' + phase2Suite.total + ' موفق</span></div>';
    h += '<div style="padding:16px 20px;display:grid;grid-template-columns:1fr;gap:12px">';
    phase2Suite.results.forEach(function(r) {
      var ok = r.passed;
      h += '<div style="padding:14px 18px;border-radius:10px;background:var(--bg);border-inline-start:4px solid ' + (ok ? 'var(--ok)' : 'var(--d)') + '">';
      h += '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px">';
      h += '<strong style="font-size:.92rem;color:' + (ok ? 'var(--tx)' : 'var(--d)') + '">' + esc(r.title) + '</strong>';
      h += '<span class="tg ' + (ok ? 'tg-g' : 'tg-r') + '">' + (ok ? 'تأیید شد (Passed)' : 'خطا (Failed)') + '</span>';
      h += '</div>';
      h += '<p style="margin:0 0 8px;font-size:.83rem;color:var(--txs);line-height:1.6">' + esc(r.description) + '</p>';
      h += '<div style="display:flex;flex-wrap:wrap;gap:16px;font-size:.8rem;background:rgba(0,0,0,.03);padding:8px 12px;border-radius:6px">';
      h += '<div><span style="color:var(--txs)">مورد انتظار:</span> <strong style="color:var(--p)">' + esc(r.expected) + '</strong></div>';
      h += '<div><span style="color:var(--txs)">محاسبه‌شده:</span> <strong style="color:' + (ok ? 'var(--ok)' : 'var(--d)') + '">' + esc(r.actual) + '</strong></div>';
      h += '</div>';
      h += '</div>';
    });
    h += '</div></div>';

    // بخش ۲: آزمون‌های تخصصی ثبت و تفکیک هزینه‌های عملیاتی (OpEx)
    h += '<div class="cd" style="margin-bottom:24px;border:1.5px solid var(--ok)">';
    h += '<div class="cd-h"><div style="display:flex;align-items:center;gap:8px"><i class="bi bi-wallet2" style="color:var(--ok)"></i><strong style="color:var(--ok)">مجموعه ' + opExSuite.total + ' آزمون تخصصی: ثبت، تفکیک سرفصل‌های هزینه عملیاتی و عدم تداخل با تسویه و حواله</strong></div><span class="tg ' + (opExSuite.allPassed ? 'tg-g' : 'tg-r') + '">' + opExSuite.passed + ' از ' + opExSuite.total + ' موفق</span></div>';
    h += '<div style="padding:16px 20px;display:grid;grid-template-columns:1fr;gap:12px">';
    opExSuite.results.forEach(function(r) {
      var ok = r.passed;
      h += '<div style="padding:14px 18px;border-radius:10px;background:var(--bg);border-inline-start:4px solid ' + (ok ? 'var(--ok)' : 'var(--d)') + '">';
      h += '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px">';
      h += '<strong style="font-size:.92rem;color:' + (ok ? 'var(--tx)' : 'var(--d)') + '">' + esc(r.title) + '</strong>';
      h += '<span class="tg ' + (ok ? 'tg-g' : 'tg-r') + '">' + (ok ? 'تأیید شد (Passed)' : 'خطا (Failed)') + '</span>';
      h += '</div>';
      h += '<p style="margin:0 0 8px;font-size:.83rem;color:var(--txs);line-height:1.6">' + esc(r.description) + '</p>';
      h += '<div style="display:flex;flex-wrap:wrap;gap:16px;font-size:.8rem;background:rgba(0,0,0,.03);padding:8px 12px;border-radius:6px">';
      h += '<div><span style="color:var(--txs)">مورد انتظار:</span> <strong style="color:var(--p)">' + esc(r.expected) + '</strong></div>';
      h += '<div><span style="color:var(--txs)">محاسبه‌شده:</span> <strong style="color:' + (ok ? 'var(--ok)' : 'var(--d)') + '">' + esc(r.actual) + '</strong></div>';
      h += '</div>';
      h += '</div>';
    });
    h += '</div></div>';

    // بخش ۳: آزمون‌های الزامی و تخصصی اصلاح سود و صورت P&L
    h += '<div class="cd" style="margin-bottom:24px;border:1.5px solid var(--p)">';
    h += '<div class="cd-h"><div style="display:flex;align-items:center;gap:8px"><i class="bi bi-patch-check-fill" style="color:var(--p)"></i><strong style="color:var(--p)">مجموعه ' + mandatorySuite.total + ' آزمون الزامی: اصلاح محاسبه سود، اقلام نامشخص و صورت سود و زیان دوره‌ای</strong></div><span class="tg ' + (mandatorySuite.allPassed ? 'tg-g' : 'tg-r') + '">' + mandatorySuite.passed + ' از ' + mandatorySuite.total + ' موفق</span></div>';
    h += '<div style="padding:16px 20px;display:grid;grid-template-columns:1fr;gap:12px">';
    mandatorySuite.results.forEach(function(r) {
      var ok = r.passed;
      h += '<div style="padding:14px 18px;border-radius:10px;background:var(--bg);border-inline-start:4px solid ' + (ok ? 'var(--ok)' : 'var(--d)') + '">';
      h += '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px">';
      h += '<strong style="font-size:.92rem;color:' + (ok ? 'var(--tx)' : 'var(--d)') + '">' + esc(r.title) + '</strong>';
      h += '<span class="tg ' + (ok ? 'tg-g' : 'tg-r') + '">' + (ok ? 'تأیید شد (Passed)' : 'خطا (Failed)') + '</span>';
      h += '</div>';
      h += '<p style="margin:0 0 8px;font-size:.83rem;color:var(--txs);line-height:1.6">' + esc(r.description) + '</p>';
      h += '<div style="display:flex;flex-wrap:wrap;gap:16px;font-size:.8rem;background:rgba(0,0,0,.03);padding:8px 12px;border-radius:6px">';
      h += '<div><span style="color:var(--txs)">مورد انتظار:</span> <strong style="color:var(--p)">' + esc(r.expected) + '</strong></div>';
      h += '<div><span style="color:var(--txs)">محاسبه‌شده:</span> <strong style="color:' + (ok ? 'var(--ok)' : 'var(--d)') + '">' + esc(r.actual) + '</strong></div>';
      h += '</div>';
      h += '</div>';
    });
    h += '</div></div>';

    // بخش ۴: ۱۰ سناریوی پایه حسابداری
    h += '<div class="cd" style="margin-bottom:24px">';
    h += '<div class="cd-h"><div style="display:flex;align-items:center;gap:8px"><i class="bi bi-shield-check" style="color:var(--ok)"></i><strong>مجموعه ۱۰ سناریوی پایه حسابداری موتور مالی</strong></div><span class="tg ' + (suite.allPassed ? 'tg-g' : 'tg-r') + '">' + suite.passed + ' از ۱۰ موفق</span></div>';
    h += '<div style="padding:16px 20px;display:grid;grid-template-columns:1fr;gap:12px">';
    suite.results.forEach(function(r) {
      var ok = r.passed;
      h += '<div style="padding:14px 18px;border-radius:10px;background:var(--bg);border-inline-start:4px solid ' + (ok ? 'var(--ok)' : 'var(--d)') + '">';
      h += '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px">';
      h += '<strong style="font-size:.92rem;color:' + (ok ? 'var(--tx)' : 'var(--d)') + '">' + esc(r.title) + '</strong>';
      h += '<span class="tg ' + (ok ? 'tg-g' : 'tg-r') + '">' + (ok ? 'تأیید شد (Passed)' : 'خطا (Failed)') + '</span>';
      h += '</div>';
      h += '<p style="margin:0 0 8px;font-size:.83rem;color:var(--txs);line-height:1.6">' + esc(r.description) + '</p>';
      h += '<div style="display:flex;flex-wrap:wrap;gap:16px;font-size:.8rem;background:rgba(0,0,0,.03);padding:8px 12px;border-radius:6px">';
      h += '<div><span style="color:var(--txs)">مورد انتظار:</span> <strong style="color:var(--p)">' + esc(r.expected) + '</strong></div>';
      h += '<div><span style="color:var(--txs)">محاسبه‌شده:</span> <strong style="color:' + (ok ? 'var(--ok)' : 'var(--d)') + '">' + esc(r.actual) + '</strong></div>';
      h += '</div>';
      h += '</div>';
    });
    h += '</div></div>';

    setHTML('rC', h);
  },

  /* ورود مستقل به صفحه صورت سود و زیان (P&L) از منو یا داشبورد */
  renderProfit: async function(period) {
    currentPage = 'profit';
    UI.nav('profit');
    UI.title('bi-graph-up-arrow', 'گزارش دقیق صورت سود و زیان (P&L)');
    this._c = 'profit';
    UI.content('<div class="tab-bar"><button class="tab-btn" onclick="ROUTES.reports()">← بازگشت به گزارشات</button><button class="tab-btn active">صورت سود و زیان جامع</button><button class="tab-btn" onclick="Rep.renderDiagnostics()"><i class="bi bi-shield-check"></i> آزمونگر تشخیصی محاسبات</button></div><div id="rC"></div>');
    await this.profit(period || 'year');
    this._btns();
  },

  /* ورود مستقیم به صفحه آزمونگر تشخیصی */
  renderDiagnostics: async function() {
    currentPage = 'reports';
    UI.nav('reports');
    UI.title('bi-shield-check', 'آزمونگر تشخیصی محاسبات مالی');
    this._c = 'diagnostics';
    UI.content('<div class="tab-bar"><button class="tab-btn" onclick="ROUTES.profit()">← بازگشت به صورت سود و زیان</button><button class="tab-btn active"><i class="bi bi-shield-check"></i> آزمونگر تشخیصی ۱۰ سناریو</button></div><div id="rC"></div>');
    await this.diagnostics();
    this._btns();
  },
  renderDebtors: async function() {
    currentPage = 'reports';
    UI.nav('reports');
    UI.title('bi-people-fill', 'گزارش بدهکاران (طلب از مشتریان)');
    UI.content('<div class="tab-bar"><button class="tab-btn" onclick="Rep.tab(this,\'summary\')">خلاصه</button><button class="tab-btn active" onclick="Rep.tab(this,\'debtors\')">بدهکاران</button><button class="tab-btn" onclick="Rep.tab(this,\'creditors\')">بستانکاران</button><button class="tab-btn" onclick="Rep.tab(this,\'profit\')">سود و زیان</button></div><div id="rC"></div>');
    this._c = 'debtors';
    await this.debtors();
    this._btns();
  },
  renderCreditors: async function() {
    currentPage = 'reports';
    UI.nav('reports');
    UI.title('bi-people-fill', 'گزارش بستانکاران (بدهی به تأمین‌کنندگان)');
    UI.content('<div class="tab-bar"><button class="tab-btn" onclick="Rep.tab(this,\'summary\')">خلاصه</button><button class="tab-btn" onclick="Rep.tab(this,\'debtors\')">بدهکاران</button><button class="tab-btn active" onclick="Rep.tab(this,\'creditors\')">بستانکاران</button><button class="tab-btn" onclick="Rep.tab(this,\'profit\')">سود و زیان</button></div><div id="rC"></div>');
    this._c = 'creditors';
    await this.creditors();
    this._btns();
  },
  debtors: async function() {
    await this._br('debtors');
  },
  creditors: async function() {
    await this._br('creditors');
  },
  _br: async function(w) {
    var ct = await DB.all('contacts');
    var balMap = await Con.allBalances();
    var res = [];
    ct.forEach(function(c) {
      var bal = balMap[c.id] || 0;
      if (w === 'debtors' && bal > 0) res.push({
        id: c.id,
        name: c.name,
        type: c.type,
        phone: c.phone,
        bal: bal
      });
      if (w === 'creditors' && bal < 0) res.push({
        id: c.id,
        name: c.name,
        type: c.type,
        phone: c.phone,
        bal: bal
      });
    });
    res.sort(function(a, b) {
      return Math.abs(b.bal) - Math.abs(a.bal);
    });
    var lb = w === 'debtors' ? 'بدهکاران (طلب از مشتریان)' : 'بستانکاران (بدهی به تأمین‌کنندگان)';
    var tr = '',
      tot = 0;
    res.forEach(function(r, i) {
      tot += r.bal;
      tr += '<tr class="clk" onclick="Led.show(' + r.id + ')" title="کلیک برای مشاهده صورت‌حساب معین ' + esc(r.name) + '">';
      tr += '<td>' + (i + 1) + '</td><td><strong>' + esc(r.name) + '</strong></td>';
      tr += '<td><span class="tg ' + Con.tt(r.type) + '">' + Con.tl(r.type) + '</span></td>';
      tr += '<td>' + esc(r.phone || '—') + '</td>';
      tr += '<td style="font-weight:700;color:var(' + (w === 'debtors' ? 'd' : 'ok') + ')">' + UI.fn(Math.abs(r.bal)) + ' ریال</td>';
      tr += '<td style="white-space:nowrap"><button class="bi2" title="دفتر معین" onclick="event.stopPropagation();Led.show(' + r.id + ')"><i class="bi bi-journal-text"></i> معین</button></td></tr>';
    });
    var h = '<div class="cd"><div class="cd-h">' + lb + ' <span class="tg ' + (w === 'debtors' ? 'tg-r' : 'tg-g') + '">' + res.length + ' نفر — جمع: ' + UI.fn(Math.abs(tot)) + ' ریال</span></div>';
    if (res.length) h += '<div class="tw"><table><thead><tr><th>#</th><th>نام</th><th>نوع</th><th>تلفن</th><th>مانده حساب</th><th></th></tr></thead><tbody>' + tr + '</tbody></table></div></div>';
    else h += '<div class="cd-b"><p>موردی نیست</p></div></div>';
    setHTML('rC', h);
  }
};
