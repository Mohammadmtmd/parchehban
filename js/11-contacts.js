/* ══ CONTACTS ══ */
var Con = {
  tl: function(t) {
    return {
      customer: 'مشتری',
      supplier: 'تأمین‌کننده',
      both: 'هر دو',
      broker: 'واسطه'
    } [t] || t;
  },
  tt: function(t) {
    return {
      customer: 'tg-g',
      supplier: 'tg-o',
      both: 'tg-b',
      broker: 'tg-p'
    } [t] || 'tg-b';
  },
  render: async function() {
    currentPage = 'contacts';
    UI.nav('contacts');
    UI.title('bi-people-fill', 'اشخاص');
    UI.act('<button class="btn bp" onclick="Con.form()">شخص جدید</button>');
    var ls = await DB.all('contacts');
    if (!ls.length) {
      UI.content('<div class="cd"><div class="em"><i class="bi bi-people"></i><p>شخصی نیست</p></div></div>');
      return;
    }
    var balMap = await this.allBalances();
    var me = this,
      r = '';
    for (var i = 0; i < ls.length; i++) {
      var c = ls[i];
      var bal = balMap[c.id] || 0;
      var bColor = bal > 0 ? 'var(--d)' : (bal < 0 ? 'var(--ok)' : 'var(--txs)');
      var bLabel = bal > 0 ? 'بدهکار' : (bal < 0 ? 'بستانکار' : 'تسویه');
      var bStr = bal === 0 ? 'تسویه' : (UI.fn(Math.abs(bal)) + ' ریال ' + bLabel);
      r += '<tr><td>' + (i + 1) + '</td><td><strong>' + esc(c.name) + '</strong></td><td><span class="tg ' + me.tt(c.type) + '">' + me.tl(c.type) + '</span></td><td>' + esc(c.phone || '—') + '</td><td style="font-weight:700;color:' + bColor + '">' + bStr + '</td><td style="white-space:nowrap"><button class="bi2" title="دفتر معین" onclick="Led.show(' + c.id + ')"><i class="bi bi-journal-text"></i></button> <button class="bi2" title="ویرایش" onclick="Con.form(' + c.id + ')"><i class="bi bi-pencil"></i></button> <button class="bi2 d" title="حذف" onclick="Con.rm(' + c.id + ')"><i class="bi bi-trash3"></i></button></td></tr>';
    }
    UI.content('<div class="cd"><div class="cd-h">اشخاص</div><div class="tw"><table><thead><tr><th>#</th><th>نام</th><th>نوع</th><th>تلفن</th><th>مانده حساب</th><th></th></tr></thead><tbody>' + r + '</tbody></table></div></div>');
  },
  /* ══ متد مرجع و واحد مانده‌گیری حساب کلیه اشخاص (مشتری و تامین‌کننده) ══ */
  allBalances: async function() {
    var contacts = await DB.all('contacts');
    var openings = await DB.all('yearOpenings');
    var invs = await FY.byYear('invoices');
    var pays = await FY.byYear('payments');
    var chks = await FY.byYear('checks');

    var balMap = {};
    for (var i = 0; i < contacts.length; i++) {
      var c = contacts[i];
      var ob = openings.find(function(o) {
        return o.fiscalYearId === STATE.yearId && o.contactId === c.id;
      });
      balMap[c.id] = ob ? numOf(ob.balance) : numOf(c.balance);
    }

    invs.forEach(function(inv) {
      if (inv.type === 'proforma') return;
      if (inv.contactId && balMap[inv.contactId] !== undefined) {
        balMap[inv.contactId] += inv.type === 'sale' ? numOf(inv.grandTotal) : -numOf(inv.grandTotal);
      }
      if (inv.brokerId && inv.brokerCommission && balMap[inv.brokerId] !== undefined) {
        balMap[inv.brokerId] -= numOf(inv.brokerCommission);
      }
    });

    pays.forEach(function(pay) {
      /* اسناد خودکار حاصل از چک در مانده شمرده نمی‌شوند چون خود چک محاسبه می‌شود */
      if (pay.sourceCheckId) return;
      if (pay.contactId && balMap[pay.contactId] !== undefined) {
        if (pay.type === 'receipt') balMap[pay.contactId] -= numOf(pay.amount);
        else balMap[pay.contactId] += numOf(pay.amount);
      }
    });

    chks.forEach(function(chk) {
      var isRet = (chk.status === 'returned' || chk.status === 'returned_to_me' || chk.status === 'returned_to_customer');
      var amt = numOf(chk.amount);

      if (chk.contactId && balMap[chk.contactId] !== undefined && !isRet) {
        if (chk.type === 'received') balMap[chk.contactId] -= amt;
        if (chk.type === 'issued') balMap[chk.contactId] += amt;
      }

      var isSupplierActive = (chk.status === 'transferred' || (chk.status === 'passed' && chk.transferToId)) && !isRet;
      if (isSupplierActive && chk.transferToId && balMap[chk.transferToId] !== undefined) {
        balMap[chk.transferToId] += amt;
      }
    });

    return balMap;
  },
  balance: async function(cid) {
    var bm = await this.allBalances();
    return bm[cid] || 0;
  },
  formatBal: function(bal) {
    if (bal > 0) return UI.fn(bal) + ' ریال بدهکار';
    if (bal < 0) return UI.fn(Math.abs(bal)) + ' ریال بستانکار';
    return 'تسویه (۰ ریال)';
  },
  balTag: function(bal) {
    if (bal > 0) return ' — بدهکار ' + UI.fn(bal) + ' ریال';
    if (bal < 0) return ' — بستانکار ' + UI.fn(Math.abs(bal)) + ' ریال';
    return ' — تسویه';
  },
  form: async function(id) {
    /* سطح دسترسی */
    if (!Perm.require('edit', 'ثبت یا ویرایش')) return;
    var c = id ? await DB.get('contacts', id) : null;

    /* بازنویسی با ابزار مشترک فرم (js/05b-form.js).
       «مانده اولیه» فقط هنگام ساخت شخص جدید معنی دارد؛ بعد از آن
       مانده از روی فاکتورها و اسناد حساب می‌شود. قبلاً موقع ویرایش
       هم نمایش داده می‌شد و کاربر می‌توانست ناخواسته حساب را
       دستکاری کند. */
    var h = F.section('مشخصات', 'bi-person-vcard') +
      F.text({
        id: 'cNm', label: 'نام', req: true, value: c ? c.name : '',
        ph: 'نام شخص یا شرکت',
        hint: 'همین نام در فاکتور، چک و گزارش‌ها دیده می‌شود'
      }) +
      F.row(
        F.select({
          id: 'cTp', label: 'نوع طرف حساب', req: true, empty: false,
          value: c ? c.type : 'customer',
          items: [
            { v: 'customer', t: 'مشتری — از ما می‌خرد' },
            { v: 'supplier', t: 'تأمین‌کننده — به ما می‌فروشد' },
            { v: 'both',     t: 'هر دو' },
            { v: 'broker',   t: 'واسطه / دلال' }
          ],
          hint: 'تعیین می‌کند در کدام فرم‌ها پیشنهاد شود'
        }),
        F.text({
          id: 'cPh', label: 'تلفن', dir: 'ltr',
          value: c ? (c.phone || '') : '', ph: '۰۹۱۲۰۰۰۰۰۰۰', note: 'اختیاری'
        })
      ) +
      F.area({
        id: 'cAd', label: 'آدرس', value: c ? (c.address || '') : '',
        note: 'اختیاری', rows: 2, ph: 'آدرس یا نشانی بازار / حجره'
      });

    if (!c) {
      h += F.section('مانده اولیه', 'bi-scales') +
        F.money({
          id: 'cBl', label: 'مانده اولیه', value: '',
          hint: 'اگر از قبل با این شخص حساب باز دارید اینجا وارد کنید. برای عدد منفی، علامت − بگذارید. خالی = بدون بدهی.'
        }) +
        '<div class="fh" style="margin-top:-2px">' +
        '<b>مثبت</b> = او به ما بدهکار است &nbsp;•&nbsp; <b>منفی</b> = ما به او بدهکاریم</div>';
    } else {
      var curBal = await this.balance(c.id);
      var bLabel = curBal > 0 ? 'بدهکار' : curBal < 0 ? 'بستانکار' : 'تسویه';
      var bColor = curBal > 0 ? 'var(--d)' : curBal < 0 ? 'var(--ok)' : 'var(--txs)';
      h += '<div class="fh" style="margin-top:14px;padding:12px 14px;background:var(--bg);border-radius:8px;border:1px solid var(--bd)">' +
        'مانده فعلی بر اساس کلیه فاکتورها، دریافت/پرداخت‌ها و چک‌ها: <strong style="color:' + bColor + '">' + UI.fn(Math.abs(curBal)) + ' ریال ' + bLabel + '</strong>' +
        ' <span style="display:inline-block;margin-right:12px"><button class="btn bs bo" type="button" onclick="UI.close();Led.show(' + c.id + ')"><i class="bi bi-journal-text"></i> مشاهده دفتر معین</button></span>' +
        '</div>';
    }

    UI.open(c ? 'ویرایش — ' + c.name : 'ثبت شخص جدید', h,
      '<button class="btn bp" onclick="Con.save(' + (id || 'null') + ')">' +
        '<i class="bi bi-check-lg"></i> ' + (c ? 'ذخیره تغییرات' : 'ثبت') + '</button>' +
      '<button class="btn bo" onclick="UI.close()">انصراف</button>', true);
    F.focusFirst('cNm');
  },
  save: async function(id) {
    if (!F.validate()) return;
    var d = {
      name: elVal('cNm').trim(),
      type: elVal('cTp'),
      phone: elVal('cPh').trim(),
      address: elVal('cAd').trim()
    };
    /* «مانده اولیه» فقط در فرم شخص جدید وجود دارد. اگر مثل قبل
       بی‌قیدوشرط خوانده می‌شد، هنگام ویرایش چون فیلدی در صفحه نیست
       elNum مقدار صفر برمی‌گرداند و مانده واقعی شخص پاک می‌شد. */
    if (document.getElementById('cBl')) d.balance = elNum('cBl');
    if (!d.name) {
      UI.toast('نام شخص را وارد کنید', 'e');
      return;
    }
    if (id) {
      var ex = await DB.get('contacts', id);
      Object.assign(ex, d);
      await DB.put('contacts', ex);
    } else await DB.add('contacts', d);
    UI.close();
    await this.render();
    UI.toast(id ? 'تغییرات ذخیره شد' : 'شخص ثبت شد');
  },
  rm: async function(id) {
    /* سطح دسترسی */
    if (!Perm.require('delete', 'حذف')) return;
    if (!await UI.confirm('حذف شود؟')) return;
    await DB.del('contacts', id);
    await this.render();
  }
};
