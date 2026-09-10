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
  /* ══ تحلیل هوشمند سررسید چک‌های صیادی ══
     چک‌های فعال (در انتظار، واریزشده، انتقال‌یافته - غیر از وصول یا برگشتی)
     را بر اساس فاصله با تاریخ امروز تفکیک می‌کند. */
  calcDiffDays: function(dueDate) {
    if (!dueDate) return null;
    var normDue = Jalali.parse(dueDate);
    var today = Jalali.today();
    var normToday = Jalali.parse(today);
    if (!normDue || !normToday) return null;
    var dP = normDue.split('/').map(Number);
    var tP = normToday.split('/').map(Number);
    var dueJdn = Jalali.toJDN(dP[0], dP[1], dP[2]);
    var todayJdn = Jalali.toJDN(tP[0], tP[1], tP[2]);
    return dueJdn - todayJdn; // < 0: گذشته | 0: امروز | > 0: روزهای باقی‌مانده
  },
  getDueAnalysis: function(checks) {
    var me = this;
    var overdue = [], dueToday = [], within3 = [], within7 = [];
    var totalIssuedAmt = 0, totalReceivedAmt = 0;

    (checks || []).forEach(function(c) {
      if (c.status === 'passed' || c.status === 'returned') return;
      var diff = me.calcDiffDays(c.dueDate);
      if (diff === null) return;
      var item = Object.assign({}, c, { diffDays: diff });

      if (diff < 0) {
        overdue.push(item);
      } else if (diff === 0) {
        dueToday.push(item);
      } else if (diff <= 3) {
        within3.push(item);
      } else if (diff <= 7) {
        within7.push(item);
      }

      if (diff <= 7) {
        if (c.type === 'issued') totalIssuedAmt += numOf(c.amount);
        else totalReceivedAmt += numOf(c.amount);
      }
    });

    return {
      overdue: overdue,
      dueToday: dueToday,
      within3: within3,
      within7: within7,
      allUrgent: overdue.concat(dueToday, within3, within7),
      totalIssuedAmt: totalIssuedAmt,
      totalReceivedAmt: totalReceivedAmt,
      count: overdue.length + dueToday.length + within3.length + within7.length
    };
  },
  dueBadgeHTML: function(dueDate, status) {
    if (status === 'passed' || status === 'returned') return '';
    var diff = this.calcDiffDays(dueDate);
    if (diff === null) return '';
    if (diff < 0) {
      return '<span class="tg tg-r" style="font-weight:700;margin-inline-start:4px"><i class="bi bi-exclamation-octagon-fill" style="margin-inline-end:3px"></i>' + Math.abs(diff) + ' روز گذشته</span>';
    }
    if (diff === 0) {
      return '<span class="tg tg-o" style="font-weight:800;margin-inline-start:4px;animation:pulse 1.5s infinite"><i class="bi bi-clock-fill" style="margin-inline-end:3px"></i>امروز</span>';
    }
    if (diff <= 3) {
      return '<span class="tg tg-b" style="font-weight:700;margin-inline-start:4px"><i class="bi bi-hourglass-split" style="margin-inline-end:3px"></i>' + diff + ' روز مانده</span>';
    }
    if (diff <= 7) {
      return '<span class="tg tg-p" style="font-weight:600;margin-inline-start:4px"><i class="bi bi-calendar-event" style="margin-inline-end:3px"></i>' + diff + ' روز مانده</span>';
    }
    return '';
  },
  render: async function(filterMode) {
    currentPage = 'checks';
    UI.nav('checks');
    UI.title('bi-credit-card-2-front-fill', 'مدیریت چک‌ها و صیادی');
    UI.act('<button class="btn bg" onclick="Chk.form(\'received\')"><i class="bi bi-plus-lg"></i>چک دریافتی</button> <button class="btn bdn" onclick="Chk.form(\'issued\')"><i class="bi bi-plus-lg"></i>چک پرداختی</button>');
    this._fl = filterMode || 'all';
    await this.ll(this._fl);
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

    var me = this;
    var analysis = me.getDueAnalysis(all);

    var ls = all.sort(function(a, b) {
      return (b.id || 0) - (a.id || 0);
    });
    if (fl === 'received') ls = ls.filter(function(c) {
      return c.type === 'received';
    });
    if (fl === 'issued') ls = ls.filter(function(c) {
      return c.type === 'issued';
    });
    if (fl === 'due7') ls = ls.filter(function(c) {
      if (c.status === 'passed' || c.status === 'returned') return false;
      var d = me.calcDiffDays(c.dueDate);
      return d !== null && d >= 0 && d <= 7;
    }).sort(function(a, b) {
      var da = me.calcDiffDays(a.dueDate) || 999;
      var db = me.calcDiffDays(b.dueDate) || 999;
      return da - db;
    });
    if (fl === 'overdue') ls = ls.filter(function(c) {
      if (c.status === 'passed' || c.status === 'returned') return false;
      var d = me.calcDiffDays(c.dueDate);
      return d !== null && d < 0;
    }).sort(function(a, b) {
      var da = me.calcDiffDays(a.dueDate) || 0;
      var db = me.calcDiffDays(b.dueDate) || 0;
      return da - db;
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
      var dueBadge = me.dueBadgeHTML(c.dueDate, c.status);
      r += '<tr><td>' + (((pg.page - 1) * pg.per) + i + 1) + '</td><td><span class="tg ' + tt + '">' + tl + '</span></td><td><strong>' + esc(c.checkNumber) + '</strong></td><td>' + esc(c.bank || '—') + '</td><td style="font-weight:700">' + UI.fn(c.amount) + '</td><td>' + esc(cm[c.contactId] || '—') + '</td><td>' + esc(c.dueDate || '—') + dueBadge + '</td><td><span class="tg ' + Chk.stg(c.status) + '">' + Chk.sl(c.status) + '</span></td><td style="white-space:nowrap">';
      if (c.status === 'pending' && c.type === 'received') r += '<button class="bi2" onclick="Chk.transfer(' + c.id + ')" title="انتقال / واگذاری"><i class="bi bi-arrow-left-right"></i></button> ';
      r += '<button class="bi2" onclick="Chk.cs(' + c.id + ')" title="تغییر وضعیت"><i class="bi bi-arrow-repeat"></i></button> <button class="bi2" onclick="Chk.form(\'' + c.type + '\',' + c.id + ')" title="ویرایش"><i class="bi bi-pencil"></i></button> <button class="bi2 d" onclick="Chk.rm(' + c.id + ')" title="حذف"><i class="bi bi-trash3"></i></button></td></tr>';
    }
    var ft = '<tfoot><tr style="background:var(--bg);font-weight:700">' +
      '<td colspan="4">جمع ' + UI.fn(ls.length) + ' چک</td><td>' + UI.fn(tAmt) +
      '</td><td colspan="4"></td></tr></tfoot>';
    var tb = ls.length ?
      '<div class="tw"><table><thead><tr><th>#</th><th>نوع</th><th>شماره</th><th>بانک</th><th>مبلغ</th><th>طرف حساب</th><th>سررسید</th><th>وضعیت</th><th>عملیات</th></tr></thead><tbody>' +
      r + '</tbody>' + ft + '</table></div>' + Pag.html(pk) :
      '<div class="em"><p>چکی با این شرط یافت نشد</p></div>';

    /* کارت هشدار سررسید در بالای صفحه چک‌ها */
    var reminderBanner = '';
    if (analysis.count > 0) {
      reminderBanner = '<div style="background:var(--sf);border:1.5px solid var(--w);border-radius:12px;padding:14px 18px;margin-bottom:18px;box-shadow:var(--shd);display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:12px">' +
        '<div style="display:flex;align-items:center;gap:12px">' +
        '<div style="width:42px;height:42px;border-radius:10px;background:var(--wl);color:var(--w);display:flex;align-items:center;justify-content:center;font-size:1.3rem;flex-shrink:0"><i class="bi bi-bell-fill"></i></div>' +
        '<div>' +
        '<strong style="font-size:.95rem;color:var(--tx)">یادآور هوشمند سررسید چک‌ها:</strong>' +
        '<div style="font-size:.82rem;color:var(--txs);margin-top:3px">' +
        (analysis.overdue.length ? '<span class="tg tg-r" style="margin-inline-end:6px"><strong>' + analysis.overdue.length + '</strong> چک سررسید گذشته</span>' : '') +
        (analysis.dueToday.length ? '<span class="tg tg-o" style="margin-inline-end:6px"><strong>' + analysis.dueToday.length + '</strong> چک امروز</span>' : '') +
        (analysis.within3.length ? '<span class="tg tg-b" style="margin-inline-end:6px"><strong>' + analysis.within3.length + '</strong> چک تا ۳ روز آینده</span>' : '') +
        (analysis.within7.length ? '<span class="tg tg-p" style="margin-inline-end:6px"><strong>' + analysis.within7.length + '</strong> چک تا ۷ روز آینده</span>' : '') +
        '</div></div></div>' +
        '<div style="display:flex;gap:10px;align-items:center;font-size:.82rem">' +
        (analysis.totalIssuedAmt > 0 ? '<div style="padding:6px 12px;background:var(--dl);color:var(--d);border-radius:8px"><strong>پرداختی سررسیددار:</strong> ' + UI.fn(analysis.totalIssuedAmt) + '</div>' : '') +
        (analysis.totalReceivedAmt > 0 ? '<div style="padding:6px 12px;background:var(--okl);color:var(--ok);border-radius:8px"><strong>دریافتی سررسیددار:</strong> ' + UI.fn(analysis.totalReceivedAmt) + '</div>' : '') +
        '</div></div>';
    }

    var tabBar = '<div class="tab-bar">' +
      '<button class="tab-btn' + (fl === 'all' ? ' active' : '') + '" onclick="Chk.ll(\'all\')">همه چک‌ها (' + all.length + ')</button>' +
      '<button class="tab-btn' + (fl === 'received' ? ' active' : '') + '" onclick="Chk.ll(\'received\')">دریافتی (' + all.filter(function(x){return x.type==='received'}).length + ')</button>' +
      '<button class="tab-btn' + (fl === 'issued' ? ' active' : '') + '" onclick="Chk.ll(\'issued\')">پرداختی (' + all.filter(function(x){return x.type==='issued'}).length + ')</button>' +
      '<button class="tab-btn' + (fl === 'due7' ? ' active' : '') + '" onclick="Chk.ll(\'due7\')" style="color:' + (analysis.dueToday.length || analysis.within3.length || analysis.within7.length ? 'var(--w)' : '') + '"><i class="bi bi-clock-history"></i> سررسید ۷ روز (' + (analysis.dueToday.length + analysis.within3.length + analysis.within7.length) + ')</button>' +
      '<button class="tab-btn' + (fl === 'overdue' ? ' active' : '') + '" onclick="Chk.ll(\'overdue\')" style="color:' + (analysis.overdue.length ? 'var(--d)' : '') + '"><i class="bi bi-exclamation-triangle"></i> سررسید گذشته (' + analysis.overdue.length + ')</button>' +
      '</div>';

    UI.content(reminderBanner + tabBar + '<div class="cd">' + tb + '</div>');
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
