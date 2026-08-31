/* ══ CHECKS ══ */
var Chk = {
  _fl: 'all',
  sl: function(s) {
    return {
      pending: 'در انتظار',
      deposited: 'واریز',
      passed: 'وصول',
      returned: 'برگشتی',
      transferred: 'انتقال'
    } [s] || s;
  },
  stg: function(s) {
    return {
      pending: 'tg-o',
      deposited: 'tg-b',
      passed: 'tg-g',
      returned: 'tg-r',
      transferred: 'tg-p'
    } [s] || 'tg-b';
  },
  render: async function() {
    currentPage = 'checks';
    UI.nav('checks');
    UI.title('bi-credit-card-2-front-fill', 'چک‌ها');
    UI.act('<button class="btn bg" onclick="Chk.form(\'received\')">دریافتی</button> <button class="btn bdn" onclick="Chk.form(\'issued\')">پرداختی</button>');
    this._fl = 'all';
    await this.ll('all');
  },
  ll: async function(fl) {
    if (fl) this._fl = fl;
    else fl = this._fl;
    var all = await FY.byYear('checks');
    var ct = await DB.all('contacts'),
      cm = {};
    ct.forEach(function(c) {
      cm[c.id] = c.name;
    });
    var ls = all.sort(function(a, b) {
      return (b.id || 0) - (a.id || 0);
    });
    if (fl === 'received') ls = ls.filter(function(c) {
      return c.type === 'received';
    });
    if (fl === 'issued') ls = ls.filter(function(c) {
      return c.type === 'issued';
    });
    var pk = 'chk_' + fl;
    Pag.register(pk, function() {
      return Chk.ll(fl);
    });
    var pg = Pag.slice(pk, ls);
    var tAmt = 0;
    ls.forEach(function(x) {
      tAmt += numOf(x.amount);
    });
    var r = '';
    for (var i = 0; i < pg.items.length; i++) {
      var c = pg.items[i];
      var tl = c.type === 'received' ? 'دریافتی' : 'پرداختی';
      var tt = c.type === 'received' ? 'tg-g' : 'tg-r';
      r += '<tr><td>' + (((pg.page - 1) * pg.per) + i + 1) + '</td><td><span class="tg ' + tt + '">' + tl + '</span></td><td><strong>' + esc(c.checkNumber) + '</strong></td><td>' + esc(c.bank || '—') + '</td><td style="font-weight:700">' + UI.fn(c.amount) + '</td><td>' + esc(cm[c.contactId] || '—') + '</td><td>' + esc(c.dueDate || '—') + '</td><td><span class="tg ' + Chk.stg(c.status) + '">' + Chk.sl(c.status) + '</span></td><td style="white-space:nowrap">';
      if (c.status === 'pending' && c.type === 'received') r += '<button class="bi2" onclick="Chk.transfer(' + c.id + ')"><i class="bi bi-arrow-left-right"></i></button> ';
      r += '<button class="bi2" onclick="Chk.cs(' + c.id + ')"><i class="bi bi-arrow-repeat"></i></button> <button class="bi2" onclick="Chk.form(\'' + c.type + '\',' + c.id + ')"><i class="bi bi-pencil"></i></button> <button class="bi2 d" onclick="Chk.rm(' + c.id + ')"><i class="bi bi-trash3"></i></button></td></tr>';
    }
    var ft = '<tfoot><tr style="background:var(--bg);font-weight:700">' +
      '<td colspan="4">جمع ' + UI.fn(ls.length) + ' چک</td><td>' + UI.fn(tAmt) +
      '</td><td colspan="4"></td></tr></tfoot>';
    var tb = ls.length ?
      '<div class="tw"><table><thead><tr><th>#</th><th>نوع</th><th>شماره</th><th>بانک</th><th>مبلغ</th><th>مرتبط</th><th>سررسید</th><th>وضعیت</th><th></th></tr></thead><tbody>' +
      r + '</tbody>' + ft + '</table></div>' + Pag.html(pk) :
      '<div class="em"><p>چکی نیست</p></div>';
    UI.content('<div class="tab-bar"><button class="tab-btn' + (fl === 'all' ? ' active' : '') + '" onclick="Chk.ll(\'all\')">همه</button><button class="tab-btn' + (fl === 'received' ? ' active' : '') + '" onclick="Chk.ll(\'received\')">دریافتی</button><button class="tab-btn' + (fl === 'issued' ? ' active' : '') + '" onclick="Chk.ll(\'issued\')">پرداختی</button></div><div class="cd">' + tb + '</div>');
  },
  form: async function(type, id) {
    var c = id ? await DB.get('checks', id) : null;
    var ct = await DB.all('contacts');
    var rl = ct.filter(function(cc) {
      if (c) return true;
      return type === 'received' ? (cc.type === 'customer' || cc.type === 'both') : (cc.type === 'supplier' || cc.type === 'both');
    });
    var cO = '<option value="">—</option>';
    rl.forEach(function(cc) {
      cO += '<option value="' + cc.id + '"' + (c && c.contactId === cc.id ? ' selected' : '') + '>' + esc(cc.name) + '</option>';
    });
    var td = todayJ();
    var h = '<div class="fr mb"><div class="fg"><label>شماره چک</label><input class="fc" id="kNm" value="' + esc(c ? c.checkNumber : '') + '"></div><div class="fg"><label>بانک</label><input class="fc" id="kBk" value="' + esc(c ? (c.bank || '') : '') + '"></div></div>';
    var banks = await DB.all('banks');
    var bO = '<option value="">— بدون بانک —</option>';
    banks.forEach(function(b) {
      bO += '<option value="' + b.id + '"' + (c && c.bankAccountId === b.id ? ' selected' : '') + '>' + esc(b.name) + '</option>';
    });
    /* شناسه از pBk به kBkAcc تغییر کرد؛ قبلاً با فیلد حساب در فرم
       دریافت/پرداخت هم‌نام بود و امکان اشتباه گرفتن مقدار وجود داشت. */
    h += '<div class="fg"><label>حساب بانکی</label><select class="fc" id="kBkAcc">' + bO + '</select></div>';
    h += '<div class="fr mb"><div class="fg"><label>مبلغ</label><input class="fc" id="kAm" type="number" value="' + (c ? c.amount : 0) + '" dir="ltr"></div><div class="fg"><label>صادرکننده</label><input class="fc" id="kIs" value="' + esc(c ? (c.issuerName || '') : '') + '"></div></div>';
    h += '<div class="fr mb"><div class="fg"><label>تاریخ صدور</label><input class="fc" id="kIsD" value="' + esc(c ? c.issueDate : td) + '"></div><div class="fg"><label>سررسید</label><input class="fc" id="kDu" value="' + esc(c ? c.dueDate : '') + '"></div></div>';
    h += '<div class="fg"><label>مرتبط</label><select class="fc" id="kCt">' + cO + '</select></div><div class="fg"><label>شرح</label><input class="fc" id="kNt" value="' + esc(c ? (c.notes || '') : '') + '"></div>';
    UI.open(c ? 'ویرایش' : (type === 'received' ? 'دریافتی' : 'پرداختی'), h, '<button class="btn bp" onclick="Chk.save(\'' + type + '\',' + (id || 'null') + ')">' + (c ? 'ذخیره' : 'ثبت') + '</button><button class="btn bo" onclick="UI.close()">انصراف</button>', true);
  },
  save: async function(type, id) {
    var d = {
      type: type,
      fiscalYearId: STATE.yearId,
      checkNumber: elVal('kNm').trim(),
      bank: elVal('kBk').trim(),
      amount: elNum('kAm'),
      issuerName: elVal('kIs').trim(),
      issueDate: Jalali.parse(elVal('kIsD')),
      dueDate: Jalali.parse(elVal('kDu')),
      contactId: intOf(elVal('kCt')) || null,
      bankAccountId: intOf(elVal('kBkAcc')) || null,
      notes: elVal('kNt').trim()
    };
    if (!d.checkNumber) {
      UI.toast('شماره چک را وارد کنید', 'e');
      return;
    }
    if (!(d.amount > 0)) {
      UI.toast('مبلغ چک باید بزرگ‌تر از صفر باشد', 'e');
      return;
    }
    if (!d.issueDate) {
      UI.toast('تاریخ صدور نامعتبر است (نمونه صحیح: 1404/01/05)', 'e');
      return;
    }
    if (!d.dueDate) {
      UI.toast('تاریخ سررسید نامعتبر است (نمونه صحیح: 1404/01/05)', 'e');
      return;
    }
    if (d.amount <= 0) {
      UI.toast('مبلغ', 'e');
      return;
    }
    if (id) {
      var ex = await DB.get('checks', id);
      Object.assign(ex, d);
      await DB.put('checks', ex);
    } else {
      d.status = 'pending';
      await DB.add('checks', d);
    }
    UI.close();
    await this.ll();
  },
  cs: async function(id) {
    var c = await DB.get('checks', id);
    if (!c) return;
    var sts = [{
      v: 'pending',
      l: 'در انتظار'
    }, {
      v: 'deposited',
      l: 'واریز'
    }, {
      v: 'passed',
      l: 'وصول'
    }, {
      v: 'returned',
      l: 'برگشتی'
    }];
    var op = '';
    sts.forEach(function(s) {
      op += '<option value="' + s.v + '"' + (c.status === s.v ? ' selected' : '') + '>' + s.l + '</option>';
    });
    var banks = await DB.all('banks');
    var bO = '<option value="">— بدون بانک —</option>';
    banks.forEach(function(b) {
      bO += '<option value="' + b.id + '"' + (c.bankAccountId === b.id ? ' selected' : '') + '>' + esc(b.name) + '</option>';
    });
    var h = '<div class="fg"><label>وضعیت</label><select class="fc" id="nSt">' + op + '</select></div>';
    h += '<div class="fg"><label>حساب بانکی (برای وصول)</label><select class="fc" id="nBk">' + bO + '</select></div>';
    UI.open('تغییر وضعیت چک', h,
      '<button class="btn bp" onclick="Chk.ss(' + id + ')">ذخیره</button>' +
      '<button class="btn bo" onclick="UI.close()">انصراف</button>');
  },
  ss: async function(id) {
    var c = await DB.get('checks', id);
    if (!c) return;
    c.status = elVal('nSt');
    c.bankAccountId = intOf(elVal('nBk')) || null;
    if (c.status === 'passed') c.passedDate = todayJ();
    await DB.put('checks', c);
    UI.close();
    await this.ll();
  },
  transfer: async function(id) {
    var c = await DB.get('checks', id);
    if (!c) return;
    var ct = await DB.all('contacts');
    var rl = ct.filter(function(cc) {
      return cc.type === 'supplier' || cc.type === 'both';
    });
    var op = '<option value="">—</option>';
    rl.forEach(function(cc) {
      op += '<option value="' + cc.id + '">' + esc(cc.name) + '</option>';
    });
    UI.open('انتقال چک', '<p>مبلغ: ' + UI.fn(c.amount) + '</p><div class="fg"><label>به</label><select class="fc" id="chkTrTo">' + op + '</select></div>',
      '<button class="btn bp" onclick="Chk.doTr(' + id + ')">انتقال</button>' +
      '<button class="btn bo" onclick="UI.close()">انصراف</button>');
  },
  doTr: async function(id) {
    /* شناسه از trTo به chkTrTo تغییر کرد تا با فرم حواله در بخش
       پرداخت‌ها تداخل نداشته باشد. */
    var toId = intOf(elVal('chkTrTo')) || null;
    if (!toId) {
      UI.toast('مقصد انتقال را انتخاب کنید', 'e');
      return;
    }
    var c = await DB.get('checks', id);
    if (!c) return;
    c.status = 'transferred';
    c.transferToId = toId;
    c.transferDate = todayJ();
    await DB.put('checks', c);
    UI.close();
    await this.ll();
  },
  rm: async function(id) {
    if (!await UI.confirm('این چک حذف شود؟')) return;
    await DB.del('checks', id);
    await this.ll();
  }
};
