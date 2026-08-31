/* ══ PAYMENTS (with edit) ══ */
var Pay = {
  _fl: 'all',
  render: async function() {
    currentPage = 'payments';
    UI.nav('payments');
    UI.title('bi-wallet2', 'پرداخت و دریافت');
    UI.act('<button class="btn bg" onclick="Pay.showF(\'receipt\')">دریافت</button> <button class="btn bdn" onclick="Pay.showF(\'payment\')">پرداخت</button> <button class="btn bw" onclick="Pay.showTransfer()">حواله</button>');
    this._fl = 'all';
    await this.ll('all');
  },
  ll: async function(fl) {
    if (fl) this._fl = fl;
    else fl = this._fl;
    var all = await FY.byYear('payments');
    var ct = await DB.all('contacts'),
      cm = {};
    ct.forEach(function(c) {
      cm[c.id] = c.name;
    });
    var ls = all.sort(function(a, b) {
      return (b.id || 0) - (a.id || 0);
    });
    if (fl === 'receipt') ls = ls.filter(function(p) {
      return p.type === 'receipt';
    });
    if (fl === 'payment') ls = ls.filter(function(p) {
      return p.type === 'payment';
    });
    if (fl === 'transfer') ls = ls.filter(function(p) {
      return p.transferId;
    });
    /* صفحه‌بندی — قبلاً کل تراکنش‌ها در یک صفحه رندر می‌شد */
    var pk = 'pay_' + fl;
    Pag.register(pk, function() {
      return Pay.ll(fl);
    });
    var pg = Pag.slice(pk, ls);
    var tAmt = 0;
    ls.forEach(function(x) {
      tAmt += numOf(x.amount);
    });
    var r = '';
    for (var i = 0; i < pg.items.length; i++) {
      var p = pg.items[i];
      var tl = p.transferId ? 'حواله' : (p.type === 'receipt' ? 'دریافت' : 'پرداخت');
      /* اصلاح باگ: خط دوم، مقدار درست را بازنویسی می‌کرد و برچسب
         بنفش «حواله» هرگز نمایش داده نمی‌شد. */
      var tt = p.transferId ? 'tg-p' : (p.type === 'receipt' ? 'tg-g' : 'tg-r');
      r += '<tr><td>' + (((pg.page - 1) * pg.per) + i + 1) + '</td><td><span class="tg ' + tt + '">' + tl + '</span></td><td>' + p.date + '</td><td>' + esc(cm[p.contactId] || '—') + '</td><td style="font-weight:700">' + UI.fn(p.amount) + '</td><td>' + esc(p.description || p.notes || '—') + '</td><td style="white-space:nowrap"><button class="bi2" onclick="Pay.showF(\'' + p.type + '\',' + p.id + ')"><i class="bi bi-pencil"></i></button> <button class="bi2 d" onclick="Pay.rm(' + p.id + ')"><i class="bi bi-trash3"></i></button></td></tr>';
    }
    var ft = '<tfoot><tr style="background:var(--bg);font-weight:700">' +
      '<td colspan="4">جمع ' + UI.fn(ls.length) + ' تراکنش</td>' +
      '<td>' + UI.fn(tAmt) + '</td><td colspan="2"></td></tr></tfoot>';
    var tb = ls.length ?
      '<div class="tw"><table><thead><tr><th>#</th><th>نوع</th><th>تاریخ</th><th>شخص</th><th>مبلغ</th><th>شرح</th><th></th></tr></thead><tbody>' +
      r + '</tbody>' + ft + '</table></div>' + Pag.html(pk) :
      '<div class="em"><p>تراکنشی نیست</p></div>';
    UI.content('<div class="tab-bar"><button class="tab-btn' + (fl === 'all' ? ' active' : '') + '" onclick="Pay.ll(\'all\')">همه</button><button class="tab-btn' + (fl === 'receipt' ? ' active' : '') + '" onclick="Pay.ll(\'receipt\')">دریافت</button><button class="tab-btn' + (fl === 'payment' ? ' active' : '') + '" onclick="Pay.ll(\'payment\')">پرداخت</button><button class="tab-btn' + (fl === 'transfer' ? ' active' : '') + '" onclick="Pay.ll(\'transfer\')">حواله</button></div><div class="cd">' + tb + '</div>');
  },
  showF: async function(type, id) {
    var p = id ? await DB.get('payments', id) : null;
    var isR = type === 'receipt';
    var ct = await DB.all('contacts');
    var rl = ct.filter(function(c) {
      return isR ? (c.type === 'customer' || c.type === 'both') : (c.type === 'supplier' || c.type === 'both' || c.type === 'broker');
    });
    var cO = '<option value="">— انتخاب —</option>';
    rl.forEach(function(c) {
      cO += '<option value="' + c.id + '"' + (p && p.contactId === c.id ? ' selected' : '') + '>' + esc(c.name) + '</option>';
    });
    var banks = await DB.all('banks');
    var bO = '<option value="">— انتخاب حساب —</option>';
    banks.forEach(function(b) {
      bO += '<option value="' + b.id + '"' + (p && p.bankId === b.id ? ' selected' : '') + '>' + esc(b.name) + '</option>';
    });
    var td = p ? p.date : todayJ();
    var h = '<div class="fr mb"><div class="fg"><label>تاریخ</label><input class="fc" id="pDt" value="' + esc(td) + '"></div><div class="fg"><label>شخص</label><select class="fc" id="pCt">' + cO + '</select></div></div>';
    h += '<div class="fr mb"><div class="fg"><label>مبلغ</label><input class="fc" id="pAm" type="number" value="' + (p ? p.amount : '') + '" dir="ltr"></div><div class="fg"><label>حساب</label><select class="fc" id="pBk">' + bO + '</select></div></div>';
    h += '<div class="fg"><label>شرح</label><input class="fc" id="pNt" value="' + esc(p ? (p.description || p.notes || '') : '') + '"></div>';
    var ft = p ? 'ویرایش' : (isR ? 'دریافت جدید' : 'پرداخت جدید');
    UI.open(ft, h, '<button class="btn ' + (isR ? 'bg' : 'bdn') + '" onclick="Pay.save(\'' + type + '\',' + (id || 'null') + ')">' + (p ? 'ذخیره' : 'ثبت') + '</button><button class="btn bo" onclick="UI.close()">انصراف</button>');
    var _f = el('pAm');
    if (_f) _f.focus();
  },
  save: async function(type, id) {
    var cid = intOf(elVal('pCt')) || null;
    var am = elNum('pAm');
    if (!cid) {
      UI.toast('شخص را انتخاب کنید', 'e');
      return;
    }
    if (am <= 0) {
      UI.toast('مبلغ باید بزرگ‌تر از صفر باشد', 'e');
      return;
    }
    var dt = Jalali.parse(elVal('pDt'));
    if (!dt) {
      UI.toast('تاریخ نامعتبر است (نمونه صحیح: 1404/01/05)', 'e');
      return;
    }
    var note = elVal('pNt').trim();
    var d = {
      type: type,
      fiscalYearId: STATE.yearId,
      contactId: cid,
      amount: am,
      date: dt,
      bankId: intOf(elVal('pBk')) || null,
      /* هر دو فیلد یک مقدار دارند چون نسخه‌های قدیمی داده از notes
         استفاده می‌کردند و کدهای دیگر هنوز آن را می‌خوانند */
      description: note,
      notes: note
    };
    if (id) {
      var ex = await DB.get('payments', id);
      Object.assign(ex, d);
      await DB.put('payments', ex);
      UI.toast('ویرایش شد');
    } else {
      await DB.add('payments', d);
      UI.toast('ثبت شد');
    }
    UI.close();
    await this.ll();
  },
  rm: async function(id) {
    var p = await DB.get('payments', id);
    /* اگر بخشی از یک حواله است، هر دو سمت آن حذف می‌شود تا حساب
       نامتوازن نماند (قبلاً فقط یک طرف حذف می‌شد). */
    if (p && p.transferId) {
      if (!await UI.confirm('این تراکنش بخشی از یک حواله است؛ هر دو طرف حواله حذف می‌شود. ادامه؟')) return;
      var all = await DB.all('payments');
      var pair = all.filter(function(x) {
        return x.transferId === p.transferId;
      });
      for (var i = 0; i < pair.length; i++) await DB.del('payments', pair[i].id);
    } else {
      if (!await UI.confirm('این تراکنش حذف شود؟')) return;
      await DB.del('payments', id);
    }
    await this.ll();
  },
  showTransfer: function() {
    DB.all('contacts').then(function(ct) {
      var customers = ct.filter(function(c) {
        return c.type === 'customer' || c.type === 'both';
      });
      var suppliers = ct.filter(function(c) {
        return c.type === 'supplier' || c.type === 'both';
      });
      var cO = '<option value="">— مشتری —</option>';
      customers.forEach(function(c) {
        cO += '<option value="' + c.id + '">' + esc(c.name) + '</option>';
      });
      var sO = '<option value="">— تأمین‌کننده —</option>';
      suppliers.forEach(function(c) {
        sO += '<option value="' + c.id + '">' + esc(c.name) + '</option>';
      });
      var td = todayJ();
      var h = '<div class="fr mb"><div class="fg"><label>تاریخ</label><input class="fc" id="trDt" value="' + esc(td) + '"></div><div class="fg"><label>مبلغ</label><input class="fc" id="trAm" type="number" dir="ltr"></div></div>';
      h += '<div class="fr mb"><div class="fg"><label>از مشتری</label><select class="fc" id="trFrom">' + cO + '</select></div><div class="fg"><label>به تأمین‌کننده</label><select class="fc" id="trTo">' + sO + '</select></div></div>';
      h += '<div class="fg"><label>شرح</label><input class="fc" id="trNt" placeholder="بابت..."></div>';
      UI.open('حواله بانکی', h, '<button class="btn bw" onclick="Pay.saveTransfer()">ثبت حواله</button><button class="btn bo" onclick="UI.close()">انصراف</button>');
    });
  },
  saveTransfer: async function() {
    var fromId = intOf(elVal('trFrom')) || null;
    var toId = intOf(elVal('trTo')) || null;
    var am = elNum('trAm');
    var dt = Jalali.parse(elVal('trDt'));
    var nt = elVal('trNt').trim();
    if (!fromId) {
      UI.toast('مشتری را انتخاب کنید', 'e');
      return;
    }
    if (!toId) {
      UI.toast('تأمین‌کننده را انتخاب کنید', 'e');
      return;
    }
    if (am <= 0) {
      UI.toast('مبلغ باید بزرگ‌تر از صفر باشد', 'e');
      return;
    }
    if (!dt) {
      UI.toast('تاریخ نامعتبر است (نمونه صحیح: 1404/01/05)', 'e');
      return;
    }
    var tid = Date.now();
    await DB.add('payments', {
      type: 'receipt',
      fiscalYearId: STATE.yearId,
      contactId: fromId,
      amount: am,
      date: dt,
      description: 'حواله به ' + nt,
      notes: 'حواله بانکی — ' + nt,
      transferId: tid,
      transferTo: toId
    });
    await DB.add('payments', {
      type: 'payment',
      fiscalYearId: STATE.yearId,
      contactId: toId,
      amount: am,
      date: dt,
      description: 'حواله از مشتری — ' + nt,
      notes: 'حواله بانکی — ' + nt,
      transferId: tid,
      transferFrom: fromId
    });
    UI.close();
    UI.toast('حواله ثبت شد');
    await this.ll();
  }
};
