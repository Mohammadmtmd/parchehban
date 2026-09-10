/* ══ REPORTS ══ */
var Rep = {
  _c: null,
  render: async function() {
    currentPage = 'reports';
    UI.nav('reports');
    UI.title('bi-bar-chart-line-fill', 'گزارشات');
    UI.act('');
    UI.content('<div class="tab-bar"><button class="tab-btn active" onclick="Rep.tab(this,\'summary\')">خلاصه</button><button class="tab-btn" onclick="Rep.tab(this,\'purchases\')">خرید</button><button class="tab-btn" onclick="Rep.tab(this,\'sales\')">فروش</button><button class="tab-btn" onclick="Rep.tab(this,\'stock\')">موجودی</button><button class="tab-btn" onclick="Rep.tab(this,\'profit\')">سود و زیان</button><button class="tab-btn" onclick="Rep.tab(this,\'debtors\')">بدهکاران</button><button class="tab-btn" onclick="Rep.tab(this,\'creditors\')">بستانکاران</button></div><div id="rC"></div>');
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
    creditors: 'بستانکاران'
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
    if (g.foot) rows.push(g.foot);
    var t = this._titles[this._c] || 'گزارش';
    EXP.csv(g.head, rows, 'parchehban-' + (this._c || 'report') + '-' + todayJ().replace(/\//g, '-') + '.csv');
    UI.toast('خروجی ' + t + ' آماده شد', 's');
  },

  expPDF: function() {
    var g = this._grab();
    if (!g || !g.rows.length) {
      UI.toast('این گزارش داده‌ای برای خروجی ندارد', 'e');
      return;
    }
    var t = this._titles[this._c] || 'گزارش';
    /* پارامتر چهارم EXP.pdf یک قطعه HTML است نه آرایه؛ پس
       ردیف جمع را همانجا داخل جدول می‌فرستیم. */
    var rows = g.rows.slice();
    if (g.foot) rows.push(g.foot);
    EXP.pdf(t + ' — ' + todayJ(), g.head, rows, null);
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

    /* محاسبه میانگین وزنی قیمت خرید برای هر کالا */
    var avgBuy = {};
    invs.forEach(function(inv) {
      if (inv.type !== 'purchase') return;
      (inv.items || []).forEach(function(it) {
        if (!avgBuy[it.productId]) avgBuy[it.productId] = { cost: 0, qty: 0 };
        avgBuy[it.productId].cost += numOf(it.total);
        avgBuy[it.productId].qty += numOf(it.quantity);
      });
    });

    /* بررسی فاکتورهای فروش دوره */
    var saleInvs = invs.filter(function(inv) {
      return inv.type === 'sale' && (startNum === 0 || pn(inv.date) >= startNum);
    });

    var grossSales = 0;
    var totalDiscounts = 0;
    var totalShipping = 0;
    var totalCOGS = 0; // بهای تمام‌شده کالای فروش‌رفته
    var brokerCommissions = 0;
    var productBreakdown = {};
    var invoiceBreakdown = [];

    saleInvs.forEach(function(inv) {
      var invTotal = numOf(inv.grandTotal);
      var invSub = numOf(inv.subtotal);
      var invDis = numOf(inv.discount);
      var invShip = numOf(inv.shippingCost);
      var invBroker = numOf(inv.brokerCommission);

      grossSales += invSub;
      totalDiscounts += invDis;
      totalShipping += invShip;
      brokerCommissions += invBroker;

      var invCOGS = 0;

      (inv.items || []).forEach(function(it) {
        var pid = it.productId;
        var ab = avgBuy[pid];
        var unitCost = (ab && ab.qty > 0) ? (ab.cost / ab.qty) : (pMap[pid] ? numOf(pMap[pid].buyPrice) : 0);
        var itemQty = numOf(it.quantity);
        var itemTotal = numOf(it.total);
        var itemCost = unitCost * itemQty;
        var itemProfit = itemTotal - itemCost;

        invCOGS += itemCost;

        if (!productBreakdown[pid]) {
          productBreakdown[pid] = {
            id: pid,
            name: it.productName || (pMap[pid] ? pMap[pid].name : 'نامشخص'),
            qty: 0,
            revenue: 0,
            cogs: 0,
            profit: 0
          };
        }
        productBreakdown[pid].qty += itemQty;
        productBreakdown[pid].revenue += itemTotal;
        productBreakdown[pid].cogs += itemCost;
        productBreakdown[pid].profit += itemProfit;
      });

      totalCOGS += invCOGS;
      var invProfit = invTotal - invCOGS - invBroker;
      var invMargin = invTotal > 0 ? (invProfit / invTotal) * 100 : 0;

      invoiceBreakdown.push({
        id: inv.id,
        number: inv.invoiceNumber || '—',
        contactName: cMap[inv.contactId] || 'مشتری آزاد',
        date: inv.date || '—',
        grandTotal: invTotal,
        cogs: invCOGS,
        profit: invProfit,
        margin: invMargin
      });
    });

    /* هزینه‌های متفرقه عملیاتی (پرداخت‌های غیر فاکتوری دوره) */
    var generalExpenses = 0;
    pays.forEach(function(pay) {
      if (pay.type === 'payment' && !pay.sourceInvoiceId && !pay.sourceCheckId) {
        if (startNum === 0 || pn(pay.date) >= startNum) {
          generalExpenses += numOf(pay.amount);
        }
      }
    });

    var netSales = grossSales - totalDiscounts + totalShipping;
    var grossProfit = netSales - totalCOGS;
    var grossMarginPct = netSales > 0 ? (grossProfit / netSales) * 100 : 0;
    var netProfit = grossProfit - brokerCommissions - generalExpenses;
    var netMarginPct = netSales > 0 ? (netProfit / netSales) * 100 : 0;

    /* ساخت رابط کاربری حرفه‌ای صورت سود و زیان (P&L) */
    var pLabels = { month: 'ماه جاری', quarter: '۳ ماهه جاری', year: 'سال مالی جاری', all: 'تمام دوران' };

    var h = '<div style="margin-bottom:18px;display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:10px">';
    h += '<div style="display:flex;gap:6px">';
    ['month', 'quarter', 'year', 'all'].forEach(function(pk) {
      var act = (p === pk) ? 'bp' : 'bo';
      h += '<button class="btn ' + act + ' bs" onclick="Rep.profit(\'' + pk + '\')">' + pLabels[pk] + '</button>';
    });
    h += '</div>';
    h += '<div style="font-size:.82rem;color:var(--txs)"><i class="bi bi-clock-history"></i> دوره بررسی: <strong>' + pLabels[p] + '</strong> (' + UI.fn(saleInvs.length) + ' فاکتور فروش)</div>';
    h += '</div>';

    /* کارت‌های خلاصه آماری P&L */
    h += '<div class="sg" style="grid-template-columns:repeat(auto-fit,minmax(210px,1fr));margin-bottom:20px">';
    h += '<div class="sc"><div class="si g"><i class="bi bi-cash-stack"></i></div><div class="sti"><h3>' + UI.fn(netSales) + '</h3><p>درآمد خالص فروش</p></div></div>';
    h += '<div class="sc"><div class="si o"><i class="bi bi-cart-check-fill"></i></div><div class="sti"><h3>' + UI.fn(Math.round(totalCOGS)) + '</h3><p>بهای تمام‌شده کالای فروش‌رفته (COGS)</p></div></div>';
    h += '<div class="sc"><div class="si ' + (grossProfit >= 0 ? 'g' : 'r') + '"><i class="bi bi-graph-up-arrow"></i></div><div class="sti"><h3 style="color:' + (grossProfit >= 0 ? 'var(--ok)' : 'var(--d)') + '">' + UI.fn(Math.round(grossProfit)) + '</h3><p>سود ناخالص (' + grossMarginPct.toFixed(1) + '٪)</p></div></div>';
    h += '<div class="sc"><div class="si ' + (netProfit >= 0 ? 'b' : 'r') + '"><i class="bi bi-award-fill"></i></div><div class="sti"><h3 style="color:' + (netProfit >= 0 ? 'var(--p)' : 'var(--d)') + '">' + UI.fn(Math.round(netProfit)) + '</h3><p>سود خالص عملیاتی (' + netMarginPct.toFixed(1) + '٪)</p></div></div>';
    h += '</div>';

    /* صورت حساب رسمی سود و زیان (P&L Statement) */
    h += '<div class="cd" style="margin-bottom:22px">';
    h += '<div class="cd-h"><div style="display:flex;align-items:center;gap:8px"><i class="bi bi-file-earmark-spreadsheet-fill" style="color:var(--p)"></i><span>صورت سود و زیان دوره‌ای (Income Statement)</span></div><span class="tg tg-b">' + pLabels[p] + '</span></div>';
    h += '<div class="tw"><table><thead><tr><th style="text-align:right">شرح حساب</th><th style="width:160px;text-align:left">مبلغ جزئی (ریال)</th><th style="width:180px;text-align:left">مبلغ نهایی (ریال)</th><th style="width:90px;text-align:center">درصد از فروش</th></tr></thead><tbody>';

    h += '<tr style="font-weight:700;background:rgba(37,99,235,.04)"><td>درآمد عملیاتی ناخالص فروش</td><td style="text-align:left">' + UI.fn(grossSales) + '</td><td></td><td style="text-align:center">۱۰۰٪</td></tr>';
    if (totalDiscounts > 0) {
      h += '<tr style="color:var(--d)"><td style="padding-inline-start:28px">کسر می‌شود: تخفیفات اعطایی فروش</td><td style="text-align:left">(' + UI.fn(totalDiscounts) + ')</td><td></td><td style="text-align:center">−' + (netSales > 0 ? ((totalDiscounts / grossSales) * 100).toFixed(1) : 0) + '٪</td></tr>';
    }
    if (totalShipping > 0) {
      h += '<tr><td style="padding-inline-start:28px">اضافه می‌شود: هزینه حمل فاکتورها</td><td style="text-align:left">' + UI.fn(totalShipping) + '</td><td></td><td style="text-align:center">+' + (netSales > 0 ? ((totalShipping / grossSales) * 100).toFixed(1) : 0) + '٪</td></tr>';
    }
    h += '<tr style="font-weight:800;background:var(--bg)"><td>= درآمد خالص فروش (Net Sales)</td><td></td><td style="text-align:left;font-weight:800;color:var(--p)">' + UI.fn(netSales) + '</td><td style="text-align:center;font-weight:700">۱۰۰٪</td></tr>';

    h += '<tr style="color:var(--w)"><td style="padding-inline-start:28px">کسر می‌شود: بهای تمام‌شده کالای فروش‌رفته (COGS)</td><td style="text-align:left">(' + UI.fn(Math.round(totalCOGS)) + ')</td><td></td><td style="text-align:center">−' + (netSales > 0 ? ((totalCOGS / netSales) * 100).toFixed(1) : 0) + '٪</td></tr>';
    h += '<tr style="font-weight:800;background:rgba(22,163,74,.08)"><td>= سود ناخالص عملیاتی (Gross Profit)</td><td></td><td style="text-align:left;font-weight:800;color:' + (grossProfit >= 0 ? 'var(--ok)' : 'var(--d)') + '">' + UI.fn(Math.round(grossProfit)) + '</td><td style="text-align:center;font-weight:800;color:' + (grossProfit >= 0 ? 'var(--ok)' : 'var(--d)') + '">' + grossMarginPct.toFixed(1) + '٪</td></tr>';

    if (brokerCommissions > 0) {
      h += '<tr style="color:var(--d)"><td style="padding-inline-start:28px">کسر می‌شود: کارمزد و حق‌العمل واسطه‌ها</td><td style="text-align:left">(' + UI.fn(brokerCommissions) + ')</td><td></td><td style="text-align:center">−' + (netSales > 0 ? ((brokerCommissions / netSales) * 100).toFixed(1) : 0) + '٪</td></tr>';
    }
    if (generalExpenses > 0) {
      h += '<tr style="color:var(--d)"><td style="padding-inline-start:28px">کسر می‌شود: سایر هزینه‌های جاری و متفرقه</td><td style="text-align:left">(' + UI.fn(generalExpenses) + ')</td><td></td><td style="text-align:center">−' + (netSales > 0 ? ((generalExpenses / netSales) * 100).toFixed(1) : 0) + '٪</td></tr>';
    }

    h += '<tr style="font-weight:800;font-size:.95rem;background:' + (netProfit >= 0 ? 'var(--okl)' : 'var(--dl)') + '"><td style="color:' + (netProfit >= 0 ? 'var(--ok)' : 'var(--d)') + '">= سود خالص نهایی دوره (Net Profit)</td><td></td><td style="text-align:left;font-weight:800;color:' + (netProfit >= 0 ? 'var(--ok)' : 'var(--d)') + '">' + UI.fn(Math.round(netProfit)) + '</td><td style="text-align:center;font-weight:800;color:' + (netProfit >= 0 ? 'var(--ok)' : 'var(--d)') + '">' + netMarginPct.toFixed(1) + '٪</td></tr>';
    h += '</tbody></table></div></div>';

    /* جدول سود به تفکیک کالاها */
    var prodRows = '';
    var prodList = Object.values(productBreakdown).sort(function(a, b) { return b.profit - a.profit; });
    prodList.forEach(function(it, idx) {
      var margin = it.revenue > 0 ? (it.profit / it.revenue) * 100 : 0;
      var avgBuyPrice = it.qty > 0 ? Math.round(it.cogs / it.qty) : 0;
      var avgSellPrice = it.qty > 0 ? Math.round(it.revenue / it.qty) : 0;
      prodRows += '<tr>' +
        '<td>' + (idx + 1) + '</td>' +
        '<td><strong>' + esc(it.name) + '</strong></td>' +
        '<td style="text-align:center">' + UI.fn(it.qty) + '</td>' +
        '<td style="text-align:left">' + UI.fn(avgBuyPrice) + '</td>' +
        '<td style="text-align:left">' + UI.fn(avgSellPrice) + '</td>' +
        '<td style="text-align:left">' + UI.fn(Math.round(it.cogs)) + '</td>' +
        '<td style="text-align:left">' + UI.fn(it.revenue) + '</td>' +
        '<td style="text-align:left;font-weight:700;color:' + (it.profit >= 0 ? 'var(--ok)' : 'var(--d)') + '">' + UI.fn(Math.round(it.profit)) + '</td>' +
        '<td style="text-align:center;font-weight:600"><span class="tg ' + (margin >= 15 ? 'tg-g' : margin > 0 ? 'tg-o' : 'tg-r') + '">' + margin.toFixed(1) + '٪</span></td>' +
        '</tr>';
    });

    h += '<div class="cd" style="margin-bottom:22px">';
    h += '<div class="cd-h"><span><i class="bi bi-tags-fill" style="margin-inline-end:6px;color:var(--ok)"></i>سود ناخالص به تفکیک کالاها</span><span class="mut" style="font-size:11px">' + prodList.length + ' قلم کالا</span></div>';
    h += '<div class="tw"><table><thead><tr><th>#</th><th>نام کالا</th><th style="text-align:center">تعداد فروش</th><th style="text-align:left">میانگین خرید</th><th style="text-align:left">میانگین فروش</th><th style="text-align:left">بهای تمام‌شده کل</th><th style="text-align:left">درآمد فروش</th><th style="text-align:left">سود ریالی</th><th style="text-align:center">حاشیه سود</th></tr></thead><tbody>';
    h += (prodRows || '<tr><td colspan="9" style="text-align:center">فروشی در این دوره ثبت نشده است</td></tr>');
    h += '</tbody></table></div></div>';

    /* جدول سود به تفکیک فاکتورهای فروش */
    var invRows = '';
    invoiceBreakdown.sort(function(a, b) { return (b.id || 0) - (a.id || 0); });
    invoiceBreakdown.slice(0, 25).forEach(function(inv, idx) {
      invRows += '<tr class="clk" onclick="Inv.vw(' + inv.id + ')">' +
        '<td>' + (idx + 1) + '</td>' +
        '<td><strong style="color:var(--p)">' + esc(inv.number) + '</strong></td>' +
        '<td>' + esc(inv.contactName) + '</td>' +
        '<td style="text-align:center">' + esc(inv.date) + '</td>' +
        '<td style="text-align:left">' + UI.fn(inv.grandTotal) + '</td>' +
        '<td style="text-align:left">' + UI.fn(Math.round(inv.cogs)) + '</td>' +
        '<td style="text-align:left;font-weight:700;color:' + (inv.profit >= 0 ? 'var(--ok)' : 'var(--d)') + '">' + UI.fn(Math.round(inv.profit)) + '</td>' +
        '<td style="text-align:center"><span class="tg ' + (inv.margin >= 15 ? 'tg-g' : inv.margin > 0 ? 'tg-o' : 'tg-r') + '">' + inv.margin.toFixed(1) + '٪</span></td>' +
        '</tr>';
    });

    h += '<div class="cd">';
    h += '<div class="cd-h"><span><i class="bi bi-receipt" style="margin-inline-end:6px;color:var(--p)"></i>سود به تفکیک فاکتورهای فروش (کلیک برای مشاهده)</span><span class="mut" style="font-size:11px">' + invoiceBreakdown.length + ' فاکتور</span></div>';
    h += '<div class="tw"><table><thead><tr><th>#</th><th>شماره فاکتور</th><th>مشتری</th><th style="text-align:center">تاریخ</th><th style="text-align:left">مبلغ فاکتور</th><th style="text-align:left">بهای تمام‌شده</th><th style="text-align:left">سود فاکتور</th><th style="text-align:center">حاشیه سود</th></tr></thead><tbody>';
    h += (invRows || '<tr><td colspan="8" style="text-align:center">فاکتوری در این دوره ثبت نشده است</td></tr>');
    h += '</tbody></table></div></div>';

    setHTML('rC', h);
  },
  /* ورود مستقل به صفحه صورت سود و زیان (P&L) از منو یا داشبورد */
  renderProfit: async function(period) {
    currentPage = 'profit';
    UI.nav('profit');
    UI.title('bi-graph-up-arrow', 'گزارش دقیق صورت سود و زیان (P&L)');
    this._c = 'profit';
    UI.content('<div class="tab-bar"><button class="tab-btn" onclick="ROUTES.reports()">← بازگشت به گزارشات</button><button class="tab-btn active">صورت سود و زیان جامع</button></div><div id="rC"></div>');
    await this.profit(period || 'year');
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
    /* اصلاح: invs دو بار با var تعریف شده بود */
    var invs = await FY.byYear('invoices');
    var pays = await FY.byYear('payments');
    var chks = await FY.byYear('checks');
    var res = [];
    for (var ci = 0; ci < ct.length; ci++) {
      var c = ct[ci];
      var bal = await getOpenBal(c.id);
      invs.forEach(function(inv) {
        if (inv.type === 'proforma') return;
        if (inv.contactId === c.id) {
          bal += inv.type === 'sale' ? inv.grandTotal : -inv.grandTotal;
          if (inv.type === 'sale' && inv.paidAmount) bal -= inv.paidAmount;
          if (inv.type === 'purchase' && inv.paidAmount) bal += inv.paidAmount;
        }
        if (inv.brokerId === c.id && inv.brokerCommission) bal -= inv.brokerCommission;
      });
      pays.forEach(function(pay) {
        if (pay.contactId === c.id) bal += pay.type === 'payment' ? pay.amount : -pay.amount;
      });
      chks.forEach(function(chk) {
        if (chk.contactId === c.id && chk.status !== 'returned') {
          if (chk.type === 'received') bal -= chk.amount;
          if (chk.type === 'issued') bal += chk.amount;
        }
        if (chk.status === 'transferred' && chk.transferToId === c.id) bal += chk.amount;
      });
      if (w === 'debtors' && bal > 0) res.push({
        name: c.name,
        type: c.type,
        bal: bal
      });
      if (w === 'creditors' && bal < 0) res.push({
        name: c.name,
        type: c.type,
        bal: bal
      });
    }
    res.sort(function(a, b) {
      return Math.abs(b.bal) - Math.abs(a.bal);
    });
    var lb = w === 'debtors' ? 'بدهکاران' : 'بستانکاران';
    var tr = '',
      tot = 0;
    res.forEach(function(r, i) {
      tot += r.bal;
      tr += '<tr><td>' + (i + 1) + '</td><td><strong>' + r.name + '</strong></td>';
      tr += '<td><span class="tg ' + Con.tt(r.type) + '">' + Con.tl(r.type) + '</span></td>';
      tr += '<td style="font-weight:700;color:var(' + (w === 'debtors' ? 'd' : 'ok') + ')">' + UI.fn(Math.abs(r.bal)) + ' ریال</td></tr>';
    });
    var h = '<div class="cd"><div class="cd-h">' + lb + ' <span class="tg ' + (w === 'debtors' ? 'tg-r' : 'tg-g') + '">' + res.length + ' نفر — ' + UI.fn(Math.abs(tot)) + ' ریال</span></div>';
    if (res.length) h += '<div class="tw"><table><thead><tr><th>#</th><th>نام</th><th>نوع</th><th>مانده</th></tr></thead><tbody>' + tr + '</tbody></table></div></div>';
    else h += '<div class="cd-b"><p>موردی نیست</p></div></div>';
    setHTML('rC', h);
  }
};
