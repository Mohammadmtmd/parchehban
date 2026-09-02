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
      /* اسناد خودکارِ ساخته‌شده از فاکتور قابل ویرایش دستی نیستند —
         باید از خود فاکتور اصلاح شوند تا دو طرف ناهماهنگ نشوند. */
      var isAutoInv = !!p.sourceInvoiceId;
      var isAutoChk = !!p.sourceCheckId;
      var isAuto = isAutoInv || isAutoChk;
      var actions;
      if (isAutoInv) {
        actions = '<button class="bi2" title="نمایش فاکتور مبدأ" onclick="Inv.vw(' + p.sourceInvoiceId + ')"><i class="bi bi-receipt"></i></button>' +
          ' <button class="bi2" title="ویرایش از طریق فاکتور" onclick="Pay.autoNote()"><i class="bi bi-lock"></i></button>';
      } else if (isAutoChk) {
        /* سند وصول چک هم مثل سند فاکتور دستی ویرایش نمی‌شود؛ باید از
           صفحه چک‌ها اصلاح گردد تا دو طرف ناهماهنگ نشوند. */
        actions = '<button class="bi2" title="رفتن به چک‌ها" onclick="location.hash=\'#checks\'"><i class="bi bi-card-checklist"></i></button>' +
          ' <button class="bi2" title="ویرایش از طریق چک" onclick="Pay.autoNoteChk()"><i class="bi bi-lock"></i></button>';
      } else {
        actions = '<button class="bi2" onclick="Pay.showF(\'' + p.type + '\',' + p.id + ')"><i class="bi bi-pencil"></i></button>' +
          ' <button class="bi2 d" onclick="Pay.rm(' + p.id + ')"><i class="bi bi-trash3"></i></button>';
      }
      var srcTag = isAuto ? ' <span class="tg tg-b" title="' + (isAutoChk ? 'سند خودکار وصول چک' : 'سند خودکار فاکتور') + '">خودکار</span>' : '';
      r += '<tr><td>' + (((pg.page - 1) * pg.per) + i + 1) + '</td><td><span class="tg ' + tt + '">' + tl + '</span>' + srcTag + '</td><td>' + p.date + '</td><td>' + esc(cm[p.contactId] || '—') + '</td><td style="font-weight:700">' + UI.fn(p.amount) + '</td><td>' + esc(p.description || p.notes || '—') + '</td><td style="white-space:nowrap">' + actions + '</td></tr>';
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
    var banks = await DB.all('banks');

    /* بازنویسی با ابزار مشترک فرم (js/05b-form.js).
       مهم‌ترین تغییر: مبلغ حالا جداکننده هزارگان زنده دارد و زیرش
       به حروف نوشته می‌شود — قبلاً input[type=number] بود و کاربر
       باید صفرها را می‌شمرد. */

    /* مانده هر طرف حساب کنار نامش می‌آید تا موقع ثبت معلوم باشد
       چقدر بدهکار/بستانکار است */
    var people = rl.map(function(c) {
      var bal = numOf(c.balance);
      var tag = '';
      if (bal > 0) tag = ' — بدهکار ' + UI.fn(bal);
      else if (bal < 0) tag = ' — بستانکار ' + UI.fn(-bal);
      return { v: c.id, t: c.name + tag };
    });
    var accs = banks.map(function(b) { return { v: b.id, t: b.name }; });

    var h = F.section("طرف حساب", isR ? 'bi-arrow-down-left' : 'bi-arrow-up-right') +
      F.select({
        id: 'pCt', label: isR ? 'دریافت از' : 'پرداخت به', req: true,
        value: p ? p.contactId : '', items: people,
        empty: '— انتخاب کنید —',
        hint: people.length ? 'مانده فعلی هر شخص کنار نامش نوشته شده' :
          (isR ? 'هیچ مشتری‌ای ثبت نشده — از صفحه «اشخاص»' : 'هیچ تأمین‌کننده‌ای ثبت نشده — از صفحه «اشخاص»')
      }) +

      F.section('مبلغ و حساب', 'bi-cash-stack') +
      F.money({
        id: 'pAm', label: 'مبلغ', req: true,
        value: p ? p.amount : ''
      }) +
      F.select({
        id: 'pBk', label: 'حساب بانکی', value: p ? p.bankId : '', items: accs,
        empty: '— نقدی / بدون حساب —',
        hint: 'اگر حساب انتخاب کنید، این مبلغ در گردش همان حساب ثبت می‌شود'
      }) +

      F.section('تاریخ و شرح', 'bi-calendar3') +
      F.date({
        id: 'pDt', label: 'تاریخ', req: true,
        value: p ? p.date : todayJ(),
        hint: 'قالب: سال/ماه/روز شمسی'
      }) +
      F.text({
        id: 'pNt', label: 'شرح', note: 'اختیاری',
        value: p ? (p.description || p.notes || '') : '',
        ph: isR ? 'مثلاً: تسویه فاکتور ۱۲۰۳' : 'مثلاً: علی‌الحساب خرید پارچه',
        hint: 'در دفتر حساب و گزارش‌ها همین متن دیده می‌شود'
      });

    var ft = p ? 'ویرایش سند' : (isR ? 'ثبت دریافت جدید' : 'ثبت پرداخت جدید');
    UI.open(ft, h,
      '<button class="btn ' + (isR ? 'bg' : 'bdn') + '" onclick="Pay.save(\'' + type + '\',' + (id || 'null') + ')">' +
        '<i class="bi bi-check-lg"></i> ' + (p ? 'ذخیره تغییرات' : 'ثبت') + '</button>' +
      '<button class="btn bo" onclick="UI.close()">انصراف</button>', true);
    F.focusFirst('pCt');
  },

  save: async function(type, id) {
    if (!F.validate()) return;
    /* سطح دسترسی و سال مالی بسته */
    if (!Perm.require('edit', 'ثبت یا ویرایش سند')) return;
    if (!await FY.assertOpen()) return;
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
  autoNote: function() {
    UI.toast('این سند به‌طور خودکار از فیلد «پرداخت شده» فاکتور ساخته شده است. برای تغییر مبلغ یا حساب بانکی، خودِ فاکتور را ویرایش کنید.', 'e');
  },
  autoNoteChk: function() {
    UI.toast('این سند به‌طور خودکار هنگام وصول چک ساخته شده است. برای تغییر، از صفحه چک‌ها وضعیت یا مبلغ چک را اصلاح کنید.', 'e');
  },
  rm: async function(id) {
    /* سطح دسترسی */
    if (!Perm.require('delete', 'حذف')) return;
    var pRow = await DB.get('payments', id);
    if (pRow && pRow.sourceInvoiceId) {
      this.autoNote();
      return;
    }
    if (pRow && pRow.sourceCheckId) {
      this.autoNoteChk();
      return;
    }
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
