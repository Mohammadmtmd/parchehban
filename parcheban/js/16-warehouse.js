/* ══ WAREHOUSE ══ */
var Wh = {
  render: async function() {
    currentPage = 'warehouse';
    UI.nav('warehouse');
    UI.title('bi-archive-fill', 'انبار');
    UI.act('');
    var ps = await DB.all('products'),
      cs = await DB.all('categories'),
      cm = {};
    cs.forEach(function(c) {
      cm[c.id] = c.name;
    });
    /* اصلاح ناسازگاری: این صفحه قبلاً فقط فاکتورهای سال مالی جاری را
       می‌شمرد، در حالی که ستون موجودی صفحه «کالا» همه سال‌ها را حساب
       می‌کرد و دو عدد متفاوت نشان داده می‌شد. موجودی انبار ماهیتاً
       تجمعی است، پس اینجا هم همه فاکتورها لحاظ می‌شوند.
       ستون‌های «کل خرید/فروش» هم به همین ترتیب تجمعی‌اند. */
    var invs = await DB.all('invoices');
    var stk = {};
    ps.forEach(function(p) {
      stk[p.id] = {
        name: p.name,
        cat: cm[p.categoryId] || '—',
        shade: p.colorShade || '',
        catalog: p.colorCatalog || '',
        unit: p.unit || '',
        min: p.minStock || 0,
        qty: 0,
        buyT: 0,
        buyQ: 0,
        sellT: 0,
        sellQ: 0
      };
    });
    invs.forEach(function(inv) {
      if (inv.type === 'proforma') return;
      (inv.items || []).forEach(function(it) {
        var s = stk[it.productId];
        if (!s) return;
        if (inv.type === 'purchase') {
          s.qty += numOf(it.quantity);
          s.buyT += it.total;
          s.buyQ += it.quantity;
        } else {
          s.qty -= numOf(it.quantity);
          s.sellT += it.total;
          s.sellQ += it.quantity;
        }
      });
    });
    var r = '',
      idx = 0;
    for (var k in stk) {
      var s = stk[k];
      var avg = s.buyQ > 0 ? Math.round(s.buyT / s.buyQ) : 0;
      var sc = (s.min && s.qty <= s.min) || s.qty < 0 ? 'color:var(--d);font-weight:700' : '';
      r += '<tr><td>' + (++idx) + '</td><td><strong>' + esc(s.name) + '</strong></td><td>' + esc(s.cat) + '</td><td>' + esc(s.catalog || '—') + '</td><td>' + esc(s.shade || '—') + '</td><td>' + esc(s.unit) + '</td><td style="' + sc + '">' + UI.fn(s.qty) + '</td><td>' + (s.min || '—') + '</td><td>' + UI.fn(avg) + '</td><td>' + UI.fn(s.buyQ) + '</td><td>' + UI.fn(s.sellQ) + '</td></tr>';
    }
    var tQty = 0,
      tBuyQ = 0,
      tSellQ = 0;
    for (var tk in stk) {
      var ts = stk[tk];
      tQty += ts.qty;
      tBuyQ += ts.buyQ;
      tSellQ += ts.sellQ;
    }
    var ft = '<tfoot><tr style="background:var(--bg);font-weight:700">';
    ft += '<td colspan="6">جمع ' + idx + ' کالا</td>';
    ft += '<td>' + UI.fn(tQty) + '</td>';
    ft += '<td></td>';
    ft += '<td></td>';
    ft += '<td>' + UI.fn(tBuyQ) + '</td>';
    ft += '<td>' + UI.fn(tSellQ) + '</td></tr></tfoot>';
    UI.content('<div class="cd"><div class="cd-h">موجودی انبار</div><div class="tw"><table><thead><tr><th>#</th><th>نام</th><th>گروه</th><th>کالیته</th><th>شید</th><th>واحد</th><th>موجودی</th><th>حداقل</th><th>میانگین</th><th>کل خرید</th><th>کل فروش</th></tr></thead><tbody>' + (r || '<tr><td colspan="11" style="text-align:center">کالایی نیست</td></tr>') + '</tbody>' + ft + '</table></div></div>');
  }
};
