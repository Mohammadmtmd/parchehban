/* ══ PRODUCT LEDGER (cardex) ══ */
var PLed = {
  render: async function() {
    currentPage = 'productLedger';
    UI.nav('productLedger');
    UI.title('bi-list-check', 'دفتر کالا');
    UI.act('');
    var ps = await DB.all('products');
    var op = '<option value="">— انتخاب کالا —</option>';
    ps.forEach(function(p) {
      op += '<option value="' + p.id + '">' + esc(p.name + (p.colorCatalog ? ' (' + p.colorCatalog + ')' : '')) + '</option>';
    });
    UI.content('<div class="cd mb"><div class="cd-b"><select class="fc" id="plP" onchange="if(this.value)PLed.show(intOf(this.value))">' + op + '</select></div></div><div id="plC"></div>');
  },
  show: async function(pid) {
    var p = await DB.get('products', pid);
    if (!p) return;
    var invs = await FY.byYear('invoices');
    var ct = await DB.all('contacts'),
      cm = {};
    ct.forEach(function(c) {
      cm[c.id] = c.name;
    });
    var txs = [];
    invs.forEach(function(inv) {
      if (inv.type === 'proforma') return;
      (inv.items || []).forEach(function(it) {
        if (it.productId !== pid) return;
        txs.push({
          id: inv.id,
          type: inv.type,
          d: inv.date,
          num: inv.invoiceNumber,
          person: cm[inv.contactId] || '—',
          qty: it.quantity,
          price: it.unitPrice,
          total: it.total
        });
      });
    });
    txs.sort(function(a, b) {
      return a.d < b.d ? -1 : a.d > b.d ? 1 : 0;
    });
    var bal = 0,
      tBuy = 0,
      tSell = 0,
      tBuyQ = 0,
      tSellQ = 0;
    var tr = '';
    txs.forEach(function(t, i) {
      var isP = t.type === 'purchase';
      if (isP) {
        bal += t.qty;
        tBuy += t.total;
        tBuyQ += t.qty;
      } else {
        bal -= t.qty;
        tSell += t.total;
        tSellQ += t.qty;
      }
      tr += '<tr class="clk" onclick="Inv.vw(' + t.id + ')"><td>' + (i + 1) + '</td><td>' + t.d + '</td><td><span class="tg ' + (isP ? 'tg-o' : 'tg-g') + '">' + (isP ? 'خرید' : 'فروش') + '</span></td><td>' + esc(t.num) + '</td><td>' + esc(t.person) + '</td><td>' + (isP ? UI.fn(t.qty) : '—') + '</td><td>' + (!isP ? UI.fn(t.qty) : '—') + '</td><td>' + UI.fn(t.price) + '</td><td>' + UI.fn(t.total) + '</td><td style="font-weight:700">' + UI.fn(bal) + '</td></tr>';
    });
    var avg = tBuyQ > 0 ? Math.round(tBuy / tBuyQ) : 0;
    var h = '<div class="cd mb"><div class="cd-h">' + p.name + (p.colorCatalog ? ' (' + p.colorCatalog + ')' : '') + '</div><div class="cd-b"><div class="lg-sm"><div class="lg-box rd"><h4>' + UI.fn(tBuyQ) + '</h4><p>کل خرید</p></div><div class="lg-box gn"><h4>' + UI.fn(tSellQ) + '</h4><p>کل فروش</p></div><div class="lg-box bl"><h4>' + UI.fn(bal) + '</h4><p>موجودی</p></div><div class="lg-box gn"><h4>' + UI.fn(avg) + '</h4><p>میانگین خرید</p></div></div></div></div>';
    h += '<div class="cd"><div class="cd-h">گردش کالا</div><div class="tw"><table><thead><tr><th>#</th><th>تاریخ</th><th>نوع</th><th>شماره</th><th>شخص</th><th>خرید</th><th>فروش</th><th>فی</th><th>جمع</th><th>موجودی</th></tr></thead><tbody>' + (tr || '<tr><td colspan="10" style="text-align:center">گردشی نیست</td></tr>') + '</tbody><tfoot><tr style="background:var(--bg);font-weight:700"><td colspan="5">جمع</td><td>' + UI.fn(tBuyQ) + '</td><td>' + UI.fn(tSellQ) + '</td><td></td><td></td><td></td></tr></tfoot></table></div></div>';
    var tg = document.getElementById('plC');
    if (tg) tg.innerHTML = h;
    else UI.content(h);
  }
};
