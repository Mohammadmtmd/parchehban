/* ══ REPORTS ══ */
var Rep = {
  _c: null,
  render: async function() {
    currentPage = 'reports';
    UI.nav('reports');
    UI.title('bi-bar-chart-line-fill', 'گزارشات');
    UI.act('');
    UI.content('<div class="tab-bar"><button class="tab-btn active" onclick="Rep.tab(this,\'summary\')">خلاصه</button><button class="tab-btn" onclick="Rep.tab(this,\'purchases\')">خرید</button><button class="tab-btn" onclick="Rep.tab(this,\'sales\')">فروش</button><button class="tab-btn" onclick="Rep.tab(this,\'stock\')">موجودی</button><button class="tab-btn" onclick="Rep.tab(this,\'profit\')">سود و زیان</button><button class="tab-btn" onclick="Rep.tab(this,\'debtors\')">بدهکاران</button><button class="tab-btn" onclick="Rep.tab(this,\'creditors\')">بستانکاران</button></div><div id="rC"></div>');
    await this.summary();
  },
  tab: async function(el, n) {
    document.querySelectorAll('.tab-btn').forEach(function(b) {
      b.classList.remove('active');
    });
    el.classList.add('active');
    await this[n]();
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
  profit: async function() {
    var invs = await FY.byYear('invoices');
    var avgBuy = {};
    invs.forEach(function(inv) {
      if (inv.type !== 'purchase') return;
      (inv.items || []).forEach(function(it) {
        if (!avgBuy[it.productId]) avgBuy[it.productId] = {
          cost: 0,
          qty: 0
        };
        avgBuy[it.productId].cost += it.total;
        avgBuy[it.productId].qty += it.quantity;
      });
    });
    var profitByProduct = {};
    var pT = 0,
      sT = 0;
    invs.forEach(function(inv) {
      if (inv.type === 'proforma') return;
      (inv.items || []).forEach(function(it) {
        if (inv.type === 'purchase') {
          pT += it.total;
        } else {
          sT += it.total;
          var ab = avgBuy[it.productId];
          var avg = ab && ab.qty > 0 ? ab.cost / ab.qty : 0;
          var profit = (it.unitPrice - avg) * it.quantity;
          if (!profitByProduct[it.productId]) profitByProduct[it.productId] = {
            name: it.productName,
            profit: 0
          };
          profitByProduct[it.productId].profit += profit;
        }
      });
    });
    var tr = '',
      idx = 0;
    for (var k in profitByProduct) {
      var pp = profitByProduct[k];
      tr += '<tr><td>' + (++idx) + '</td><td><strong>' + pp.name + '</strong></td><td style="color:' + (pp.profit >= 0 ? 'var(--ok)' : 'var(--d)') + ';font-weight:700">' + UI.fn(Math.round(pp.profit)) + '</td></tr>';
    }
    var tp = sT - pT;
    var h = '<div class="sg" style="grid-template-columns:repeat(2,1fr)">';
    h += '<div class="sc"><div class="si o"><i class="bi bi-cart-fill"></i></div><div class="sti"><h3>' + UI.fn(pT) + '</h3><p>خرید</p></div></div>';
    h += '<div class="sc"><div class="si g"><i class="bi bi-receipt-cutoff"></i></div><div class="sti"><h3>' + UI.fn(sT) + '</h3><p>فروش</p></div></div></div>';
    h += '<div class="cd"><div class="cd-h">سود هر کالا (قیمت فروش - میانگین خرید) × تعداد</div><div class="tw"><table><thead><tr><th>#</th><th>کالا</th><th>سود</th></tr></thead><tbody>' + (tr || '<tr><td colspan="3" style="text-align:center">داده‌ای نیست</td></tr>') + '</tbody></table></div></div>';
    setHTML('rC', h);
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
