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
    var banks = await DB.all('banks');
    var isR = type === 'received';

    /* بازنویسی با ابزار مشترک فرم (js/05b-form.js).
       دو مشکل جدی فرم قبلی رفع شد:
       ۱) دو فیلد هر دو «بانک» نام داشتند — یکی بانکِ روی برگه چک و
          یکی حساب بانکی خودمان. حالا برچسب‌ها صریح‌اند.
       ۲) «مرتبط» معلوم نبود یعنی چه؛ حالا بسته به نوع چک
          «دریافت از» یا «پرداخت به» نوشته می‌شود. */

    var people = rl.map(function(cc) { return { v: cc.id, t: cc.name }; });
    var accs = banks.map(function(b) { return { v: b.id, t: b.name }; });

    var h = F.section('مشخصات برگه چک', 'bi-card-text') +
      F.row(
        F.text({
          id: 'kNm', label: 'شماره چک', req: true, dir: 'ltr',
          value: c ? c.checkNumber : '', ph: '۱۲۳۴۵۶',
          hint: 'شماره درج‌شده روی برگه'
        }),
        F.text({
          id: 'kBk', label: 'بانک صادرکننده', value: c ? (c.bank || '') : '',
          ph: 'مثلاً: ملت شعبه ونک',
          hint: 'بانکی که چک از آن کشیده شده'
        })
      ) +
      F.row(
        F.money({
          id: 'kAm', label: 'مبلغ چک', req: true, value: c ? c.amount : ''
        }),
        F.text({
          id: 'kIs', label: isR ? 'نام صاحب چک' : 'در وجه',
          value: c ? (c.issuerName || '') : '',
          ph: isR ? 'نامی که روی چک آمده' : 'نام گیرنده',
          hint: isR ? 'اگر چک از شخص دیگری پشت‌نویسی شده، نام صاحب اصلی' : ''
        })
      ) +

      F.section('تاریخ‌ها', 'bi-calendar3') +
      F.row(
        F.date({
          id: 'kIsD', label: 'تاریخ صدور', value: c ? c.issueDate : todayJ(), quick: false,
          hint: 'تاریخ نوشته‌شده روی چک'
        }),
        F.date({
          id: 'kDu', label: 'تاریخ سررسید', req: true, value: c ? c.dueDate : '',
          hint: 'روزی که چک قابل وصول می‌شود — مبنای هشدار سررسید'
        })
      ) +

      F.section('ارتباط با حساب‌ها', 'bi-link-45deg') +
      F.select({
        id: 'kCt', label: isR ? 'دریافت از' : 'پرداخت به', req: true,
        value: c ? c.contactId : '', items: people,
        empty: '— انتخاب کنید —',
        hint: 'به‌محض ثبت چک، مانده این شخص اصلاح می‌شود'
      }) +
      F.select({
        id: 'kBkAcc', label: 'حساب بانکی ما', value: c ? c.bankAccountId : '', items: accs,
        empty: '— هنوز مشخص نیست —',
        hint: isR ? 'حسابی که چک قرار است به آن خوابانده شود. هنگام «وصول» سند بانکی خودکار ساخته می‌شود.'
                  : 'حسابی که چک از آن کشیده شده. هنگام «پاس شدن» سند بانکی خودکار ساخته می‌شود.'
      }) +
      F.text({
        id: 'kNt', label: 'شرح', note: 'اختیاری',
        value: c ? (c.notes || '') : '', ph: 'بابت چه چیزی؟'
      });

    UI.open(
      c ? 'ویرایش چک ' + esc(c.checkNumber) : (isR ? 'ثبت چک دریافتی' : 'ثبت چک پرداختی'),
      h,
      '<button class="btn bp" onclick="Chk.save(\'' + type + '\',' + (id || 'null') + ')">' +
        '<i class="bi bi-check-lg"></i> ' + (c ? 'ذخیره تغییرات' : 'ثبت چک') + '</button>' +
      '<button class="btn bo" onclick="UI.close()">انصراف</button>',
      true
    );
    F.focusFirst('kNm');
  },
  save: async function(type, id) {
    if (!F.validate()) return;
    /* سطح دسترسی و سال مالی بسته */
    if (!Perm.require('edit', 'ثبت یا ویرایش سند')) return;
    if (!await FY.assertOpen()) return;
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
      /* افزوده شد: اگر مبلغ یا حساب بانکیِ چکِ وصول‌شده ویرایش شود،
         سند خودکارش هم باید به‌روز گردد. */
      await this.syncAutoPayment(id);
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
    /* افزوده شد: وصول چک باید مثل فاکتور یک سند دریافت/پرداخت واقعی
       بسازد. قبلاً فقط وضعیت چک عوض می‌شد و هیچ ردی در صفحه
       دریافت/پرداخت نمی‌ماند. */
    await this.syncAutoPayment(id);
    UI.close();
    await this.ll();
  },

  /* سند خودکارِ وصول چک — دقیقاً هم‌الگوی Inv.syncAutoPayment.
     فقط چکِ «وصول‌شده»ای که حساب بانکی دارد سند می‌سازد، چون تنها در آن
     لحظه پول واقعاً وارد/خارج بانک می‌شود. با تغییر وضعیت به هر چیز
     دیگری سند حذف می‌گردد.

     توجه مهم: این سند روی مانده «شخص» اثر نمی‌گذارد. مانده شخص از خودِ
     چک محاسبه می‌شود (به‌محض دریافت چک، نه هنگام وصول) و اگر این سند هم
     شمرده می‌شد، بدهی طرف دو برابر کم می‌شد. برای همین در محاسبه مانده
     شخص و دفتر معین، سندهای دارای sourceCheckId رد می‌شوند. */
  syncAutoPayment: async function(checkId) {
    var c = await DB.get('checks', checkId);
    var pays = await DB.all('payments');
    var linked = pays.filter(function(p) {
      return p.sourceCheckId === checkId;
    });
    var i;
    if (!c || c.status !== 'passed' || !c.bankAccountId || !(c.amount > 0)) {
      for (i = 0; i < linked.length; i++) await DB.del('payments', linked[i].id);
      return;
    }
    var label = 'بابت وصول چک ' + (c.checkNumber || c.id);
    var body = {
      type: c.type === 'received' ? 'receipt' : 'payment',
      fiscalYearId: c.fiscalYearId,
      contactId: c.contactId,
      amount: c.amount,
      date: c.passedDate || c.dueDate,
      bankId: c.bankAccountId,
      description: label,
      notes: label,
      sourceCheckId: checkId,
      auto: true
    };
    if (linked.length) {
      var keep = linked[0];
      Object.assign(keep, body);
      await DB.put('payments', keep);
      for (i = 1; i < linked.length; i++) await DB.del('payments', linked[i].id);
    } else {
      await DB.add('payments', body);
    }
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
    /* افزوده شد: سند خودکارِ وصول هم باید برود، وگرنه سند یتیم می‌ماند
       و مانده بانک اشتباه می‌شود. */
    await this.syncAutoPayment(id);
    await this.ll();
  }
};
