/* ══ LEDGER (clickable items) ══ */
var Led = {
  render: async function() {
    currentPage = 'ledger';
    UI.nav('ledger');
    UI.title('bi-journal-text', 'دفتر معین');
    UI.act('');
    var ct = await DB.all('contacts');
    var op = '<option value="">— انتخاب —</option>';
    ct.forEach(function(c) {
      op += '<option value="' + c.id + '">' + esc(c.name) + '</option>';
    });
    UI.content('<div class="cd mb"><div class="cd-b"><select class="fc" id="lP" onchange="if(this.value)Led.show(intOf(this.value))">' + op + '</select></div></div><div id="lC"></div>');
  },
  show: async function(cid) {
    var c = await DB.get('contacts', cid);
    if (!c) return;
    currentPage = 'ledger';
    UI.nav('ledger');
    UI.title('bi-journal-text', 'معین — ' + c.name);
    UI.act('<button class="btn bo" onclick="Led.render()"><i class="bi bi-arrow-right"></i>بازگشت</button> <button class="btn bg bs" onclick="Led.expCSV(' + cid + ')"><i class="bi bi-filetype-xlsx"></i>Excel</button> <button class="btn bdn bs" onclick="Led.expPDF(' + cid + ')"><i class="bi bi-filetype-pdf"></i>PDF</button>')
    var invs = await FY.byYear('invoices'),
      pays = await FY.byYear('payments'),
      chks = await FY.byYear('checks');
    var txs = [];
    invs.forEach(function(inv) {
      if (inv.type === 'proforma') return;
      if (inv.contactId === cid) {
        if (inv.type === 'sale') {
          txs.push({
            d: inv.date,
            desc: 'فروش ' + inv.invoiceNumber,
            db: inv.grandTotal,
            cr: 0,
            s: 1,
            invId: inv.id
          });
          if (inv.paidAmount > 0) txs.push({
            d: inv.date,
            desc: 'دریافت فاکتور ' + inv.invoiceNumber,
            db: 0,
            cr: inv.paidAmount,
            s: 1,
            invId: inv.id
          });
        } else {
          txs.push({
            d: inv.date,
            desc: 'خرید ' + inv.invoiceNumber,
            db: 0,
            cr: inv.grandTotal,
            s: 1,
            invId: inv.id
          });
          if (inv.paidAmount > 0) txs.push({
            d: inv.date,
            desc: 'پرداخت فاکتور ' + inv.invoiceNumber,
            db: inv.paidAmount,
            cr: 0,
            s: 1,
            invId: inv.id
          });
        }
      }
      if (inv.brokerId === cid && inv.brokerCommission) txs.push({
        d: inv.date,
        desc: 'کمیسیون ' + inv.invoiceNumber,
        db: 0,
        cr: inv.brokerCommission,
        s: 1,
        invId: inv.id
      });
    });
    pays.forEach(function(pay) {
      if (pay.contactId === cid) {
        var pdesc = pay.description || pay.notes || '';
        if (pay.type === 'receipt') txs.push({
          d: pay.date,
          desc: 'دریافت' + (pdesc ? ' / ' + pdesc : ''),
          db: 0,
          cr: pay.amount,
          s: 2,
          payId: pay.id
        });
        else txs.push({
          d: pay.date,
          desc: 'پرداخت' + (pdesc ? ' / ' + pdesc : ''),
          db: pay.amount,
          cr: 0,
          s: 2,
          payId: pay.id
        });
      }
    });
    chks.forEach(function(chk) {
      if (chk.contactId === cid && chk.status !== 'returned') {
        if (chk.type === 'received') txs.push({
          d: chk.issueDate || chk.dueDate,
          desc: 'چک #' + chk.checkNumber,
          db: 0,
          cr: chk.amount,
          s: 3,
          chkId: chk.id,
          chkType: chk.type
        });
        if (chk.type === 'issued') txs.push({
          d: chk.issueDate || chk.dueDate,
          desc: 'چک #' + chk.checkNumber,
          db: chk.amount,
          cr: 0,
          s: 3,
          chkId: chk.id,
          chkType: chk.type
        });
      }
      if (chk.status === 'transferred' && chk.transferToId === cid) txs.push({
        d: chk.transferDate || chk.dueDate,
        desc: 'انتقال چک #' + chk.checkNumber,
        db: chk.amount,
        cr: 0,
        s: 3,
        chkId: chk.id,
        chkType: chk.type
      });
    });
    txs.sort(function(a, b) {
      if (a.d < b.d) return -1;
      if (a.d > b.d) return 1;
      return a.s - b.s;
    });
    var ob = await getOpenBal(cid);
    var bal = ob;
    var rows = [{
      d: '—',
      desc: 'مانده اولیه',
      db: ob > 0 ? ob : 0,
      cr: ob < 0 ? -ob : 0,
      bal: ob,
      invId: null,
      payId: null,
      chkId: null,
      chkType: null
    }];
    txs.forEach(function(t) {
      bal = bal + t.db - t.cr;
      rows.push({
        d: t.d,
        desc: t.desc,
        db: t.db,
        cr: t.cr,
        bal: bal,
        invId: t.invId || null,
        payId: t.payId || null,
        chkId: t.chkId || null,
        chkType: t.chkType || null
      });
    });
    var tD = 0,
      tC = 0;
    rows.forEach(function(r) {
      tD += r.db;
      tC += r.cr;
    });
    var tr = '';
    rows.forEach(function(r, i) {
      var bl = r.bal > 0 ? 'بد' : r.bal < 0 ? 'بس' : '';
      var bc = r.bal > 0 ? 'bp2' : r.bal < 0 ? 'bn' : '';
      var clk = '';
      if (r.invId) clk = ' class="clk" onclick="Inv.vw(' + r.invId + ')"';
      else if (r.payId) {
        var pt = r.db > 0 ? 'payment' : 'receipt';
        clk = ' class="clk" onclick="Pay.showF(\'' + pt + '\',' + r.payId + ')"';
      } else if (r.chkId) clk = ' class="clk" onclick="Chk.form(\'' + r.chkType + '\',' + r.chkId + ')"';
      tr += '<tr' + clk + '><td>' + (i + 1) + '</td><td>' + r.d + '</td><td>' + esc(r.desc) + '</td>';
      tr += '<td class="cd">' + (r.db ? UI.fn(r.db) : '—') + '</td>';
      tr += '<td class="cc">' + (r.cr ? UI.fn(r.cr) : '—') + '</td>';
      tr += '<td class="' + bc + '">' + UI.fn(Math.abs(r.bal)) + ' ' + bl + '</td></tr>';
    });
    var fB = bal;
    var bL = fB > 0 ? 'بدهکار' : fB < 0 ? 'بستانکار' : 'تسویه';
    var bC = fB > 0 ? 'rd' : fB < 0 ? 'gn' : 'bl';
    var h = '<div class="cd mb"><div class="cd-h">' + esc(c.name) + ' <span class="tg ' + Con.tt(c.type) + '">' + Con.tl(c.type) + '</span></div>';
    h += '<div class="cd-b"><div class="lg-sm">';
    h += '<div class="lg-box rd"><h4>' + UI.fn(tD) + '</h4><p>بدهکار</p></div>';
    h += '<div class="lg-box gn"><h4>' + UI.fn(tC) + '</h4><p>بستانکار</p></div>';
    h += '<div class="lg-box ' + bC + '"><h4>' + UI.fn(Math.abs(fB)) + '</h4><p>' + bL + '</p></div>';
    h += '</div></div></div>';
    h += '<div class="cd"><div class="cd-h">صورتحساب</div>';
    h += '<div class="tw"><table><thead><tr><th>#</th><th>تاریخ</th><th>شرح</th><th>بدهکار</th><th>بستانکار</th><th>مانده</th></tr></thead>';
    h += '<tbody>' + tr + '</tbody>';
    h += '<tfoot><tr style="background:var(--bg);font-weight:700"><td colspan="3">جمع</td>';
    h += '<td class="cd">' + UI.fn(tD) + '</td><td class="cc">' + UI.fn(tC) + '</td><td></td></tr></tfoot>';
    h += '</table></div></div>';
    var tg = document.getElementById('lC');
    if (tg) tg.innerHTML = h;
    else UI.content(h);
  }
};
Led.expCSV = function(cid) {
  DB.get('contacts', cid).then(async function(c) {
    if (!c) return;
    var invs = await FY.byYear('invoices'),
      pays = await FY.byYear('payments'),
      chks = await FY.byYear('checks');
    var txs = [];
    invs.forEach(function(inv) {
      if (inv.type === 'proforma') return;
      if (inv.contactId === cid) {
        if (inv.type === 'sale') {
          txs.push({
            d: inv.date,
            desc: 'فروش ' + inv.invoiceNumber,
            db: inv.grandTotal,
            cr: 0,
            s: 1
          });
          if (inv.paidAmount > 0) txs.push({
            d: inv.date,
            desc: 'دریافت فاکتور ' + inv.invoiceNumber,
            db: 0,
            cr: inv.paidAmount,
            s: 1
          });
        } else {
          txs.push({
            d: inv.date,
            desc: 'خرید ' + inv.invoiceNumber,
            db: 0,
            cr: inv.grandTotal,
            s: 1
          });
          if (inv.paidAmount > 0) txs.push({
            d: inv.date,
            desc: 'پرداخت فاکتور ' + inv.invoiceNumber,
            db: inv.paidAmount,
            cr: 0,
            s: 1
          });
        }
      }
      if (inv.brokerId === cid && inv.brokerCommission) txs.push({
        d: inv.date,
        desc: 'کمیسیون ' + inv.invoiceNumber,
        db: 0,
        cr: inv.brokerCommission,
        s: 1
      });
    });
    pays.forEach(function(pay) {
      if (pay.contactId === cid) {
        if (pay.type === 'receipt') {
          var pdesc = pay.description || pay.notes || '';
          txs.push({
            d: pay.date,
            desc: 'دریافت' + (pdesc ? ' / ' + pdesc : ''),
            db: 0,
            cr: pay.amount,
            s: 2
          });
        } else {
          var pdesc2 = pay.description || pay.notes || '';
          txs.push({
            d: pay.date,
            desc: 'پرداخت' + (pdesc2 ? ' / ' + pdesc2 : ''),
            db: pay.amount,
            cr: 0,
            s: 2
          });
        }
      }
    });
    chks.forEach(function(chk) {
      if (chk.contactId === cid && chk.status !== 'returned') {
        if (chk.type === 'received') txs.push({
          d: chk.issueDate || chk.dueDate,
          desc: 'چک #' + chk.checkNumber,
          db: 0,
          cr: chk.amount,
          s: 3
        });
        if (chk.type === 'issued') txs.push({
          d: chk.issueDate || chk.dueDate,
          desc: 'چک #' + chk.checkNumber,
          db: chk.amount,
          cr: 0,
          s: 3
        });
      }
      if (chk.status === 'transferred' && chk.transferToId === cid) txs.push({
        d: chk.transferDate || chk.dueDate,
        desc: 'انتقال چک #' + chk.checkNumber,
        db: chk.amount,
        cr: 0,
        s: 3
      });
    });
    txs.sort(function(a, b) {
      if (a.d < b.d) return -1;
      if (a.d > b.d) return 1;
      return a.s - b.s;
    });
    var ob = await getOpenBal(cid);
    var bal = ob;
    var rows = [
      ['—', 'مانده اولیه', ob > 0 ? ob : 0, ob < 0 ? -ob : 0, ob]
    ];
    txs.forEach(function(t) {
      bal = bal + t.db - t.cr;
      rows.push([t.d, t.desc, t.db || '', t.cr || '', bal]);
    });
    EXP.csv(['تاریخ', 'شرح', 'بدهکار', 'بستانکار', 'مانده'], rows, 'معین-' + esc(c.name) + '.csv');
  });
};

Led.expPDF = function(cid) {
  DB.get('contacts', cid).then(async function(c) {
    if (!c) return;
    var invs = await FY.byYear('invoices'),
      pays = await FY.byYear('payments'),
      chks = await FY.byYear('checks');
    var txs = [];
    invs.forEach(function(inv) {
      if (inv.type === 'proforma') return;
      if (inv.contactId === cid) {
        if (inv.type === 'sale') {
          txs.push({
            d: inv.date,
            desc: 'فروش ' + inv.invoiceNumber,
            db: inv.grandTotal,
            cr: 0,
            s: 1
          });
          if (inv.paidAmount > 0) txs.push({
            d: inv.date,
            desc: 'دریافت فاکتور ' + inv.invoiceNumber,
            db: 0,
            cr: inv.paidAmount,
            s: 1
          });
        } else {
          txs.push({
            d: inv.date,
            desc: 'خرید ' + inv.invoiceNumber,
            db: 0,
            cr: inv.grandTotal,
            s: 1
          });
          if (inv.paidAmount > 0) txs.push({
            d: inv.date,
            desc: 'پرداخت فاکتور ' + inv.invoiceNumber,
            db: inv.paidAmount,
            cr: 0,
            s: 1
          });
        }
      }
      if (inv.brokerId === cid && inv.brokerCommission) txs.push({
        d: inv.date,
        desc: 'کمیسیون ' + inv.invoiceNumber,
        db: 0,
        cr: inv.brokerCommission,
        s: 1
      });
    });
    pays.forEach(function(pay) {
      if (pay.contactId === cid) {
        if (pay.type === 'receipt') {
          var pdesc = pay.description || pay.notes || '';
          txs.push({
            d: pay.date,
            desc: 'دریافت' + (pdesc ? ' / ' + pdesc : ''),
            db: 0,
            cr: pay.amount,
            s: 2
          });
        } else {
          var pdesc2 = pay.description || pay.notes || '';
          txs.push({
            d: pay.date,
            desc: 'پرداخت' + (pdesc2 ? ' / ' + pdesc2 : ''),
            db: pay.amount,
            cr: 0,
            s: 2
          });
        }
      }
    });
    chks.forEach(function(chk) {
      if (chk.contactId === cid && chk.status !== 'returned') {
        if (chk.type === 'received') txs.push({
          d: chk.issueDate || chk.dueDate,
          desc: 'چک #' + chk.checkNumber,
          db: 0,
          cr: chk.amount,
          s: 3
        });
        if (chk.type === 'issued') txs.push({
          d: chk.issueDate || chk.dueDate,
          desc: 'چک #' + chk.checkNumber,
          db: chk.amount,
          cr: 0,
          s: 3
        });
      }
      if (chk.status === 'transferred' && chk.transferToId === cid) txs.push({
        d: chk.transferDate || chk.dueDate,
        desc: 'انتقال چک #' + chk.checkNumber,
        db: chk.amount,
        cr: 0,
        s: 3
      });
    });
    txs.sort(function(a, b) {
      if (a.d < b.d) return -1;
      if (a.d > b.d) return 1;
      return a.s - b.s;
    });
    var ob = await getOpenBal(cid);
    var bal = ob;
    var rows = [
      ['—', 'مانده اولیه', ob > 0 ? UI.fn(ob) : '—', ob < 0 ? UI.fn(-ob) : '—', UI.fn(ob)]
    ];
    txs.forEach(function(t) {
      bal = bal + t.db - t.cr;
      rows.push([t.d, t.desc, t.db ? UI.fn(t.db) : '—', t.cr ? UI.fn(t.cr) : '—', UI.fn(Math.abs(bal)) + (bal > 0 ? ' بد' : bal < 0 ? ' بس' : '')]);
    });
    var fB = bal;
    var bL = fB > 0 ? 'بدهکار' : fB < 0 ? 'بستانکار' : 'تسویه';
    var sum = '<p style="font-size:12px;margin-bottom:10px">مانده: <strong>' + UI.fn(Math.abs(fB)) + ' ریال (' + bL + ')</strong></p>';
    EXP.pdf('دفتر معین — ' + c.name, ['تاریخ', 'شرح', 'بدهکار', 'بستانکار', 'مانده'], rows, sum);
  });
};
