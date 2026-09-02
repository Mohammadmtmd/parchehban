/* ══ BANKS ══ */
var Bank = {
  render: async function() {
    currentPage = 'banks';
    UI.nav('banks');
    UI.title('bi-bank2', 'حساب‌های بانکی');
    UI.act('<button class="btn bp" onclick="Bank.form()"><i class="bi bi-plus-lg"></i>حساب جدید</button>');
    var bs = await DB.all('banks');
    if (!bs.length) {
      UI.content('<div class="cd"><div class="em"><i class="bi bi-bank2"></i><p>حسابی تعریف نشده</p><button class="btn bp" style="margin-top:16px" onclick="Bank.form()">اولین حساب</button></div></div>');
      return;
    }
    /* اصلاح باگ: قبلاً مانده در این لیست فقط از دریافت/پرداخت و چک
       محاسبه می‌شد، در حالی که صفحه جزئیات، فاکتورها و انتقال بین بانکی
       را هم حساب می‌کرد؛ نتیجه: عدد لیست با عدد صورت‌حساب یکی نبود.
       حالا هر دو از یک تابع واحد (Bank.balance) استفاده می‌کنند. */
    var r = '',
      totalBal = 0;
    for (var i = 0; i < bs.length; i++) {
      var b = bs[i];
      var bal = await Bank.balance(b.id);
      totalBal += bal;
      var bc = bal >= 0 ? 'color:var(--ok)' : 'color:var(--d)';
      r += '<tr class="clk" onclick="Bank.show(' + b.id + ')">';
      r += '<td>' + (i + 1) + '</td>';
      r += '<td><strong>' + esc(b.name) + '</strong></td>';
      r += '<td>' + esc(b.bankName || '—') + '</td>';
      r += '<td>' + esc(b.accountNumber || '—') + '</td>';
      r += '<td style="font-weight:700;' + bc + '">' + UI.fn(bal) + '</td>';
      r += '<td style="white-space:nowrap">';
      r += '<button class="bi2" onclick="event.stopPropagation();Bank.form(' + b.id + ')"><i class="bi bi-pencil"></i></button> ';
      r += '<button class="bi2 d" onclick="event.stopPropagation();Bank.rm(' + b.id + ')"><i class="bi bi-trash3"></i></button>';
      r += '</td></tr>';
    }
    var tc = totalBal >= 0 ? 'color:var(--ok)' : 'color:var(--d)';
    var tf = '<tfoot><tr style="background:var(--bg);font-weight:700">' +
      '<td colspan="4">جمع ' + UI.fn(bs.length) + ' حساب</td>' +
      '<td style="' + tc + '">' + UI.fn(totalBal) + '</td><td></td></tr></tfoot>';
    UI.content('<div class="cd"><div class="cd-h">حساب‌های بانکی</div>' +
      '<div class="tw"><table><thead><tr><th>#</th><th>نام حساب</th><th>بانک</th><th>شماره حساب</th><th>موجودی</th><th></th></tr></thead>' +
      '<tbody>' + r + '</tbody>' + tf + '</table></div></div>');
  },

  form: async function(id) {
    /* سطح دسترسی */
    if (!Perm.require('edit', 'ثبت یا ویرایش')) return;
    var b = id ? await DB.get('banks', id) : null;

    /* بازنویسی با ابزار مشترک فرم (js/05b-form.js) */
    var h = F.section('شناسایی حساب', 'bi-bank') +
      F.text({
        id: 'bNm', label: 'عنوان حساب', req: true, value: b ? b.name : '',
        ph: 'مثلاً: ملت — جاری فروشگاه',
        hint: 'نامی که خودتان می‌شناسید؛ در فرم‌ها همین دیده می‌شود'
      }) +
      F.row(
        F.text({
          id: 'bBk', label: 'نام بانک', value: b ? (b.bankName || '') : '',
          ph: 'ملت، صادرات، …', note: 'اختیاری'
        }),
        F.text({
          id: 'bAc', label: 'شماره حساب', dir: 'ltr',
          value: b ? (b.accountNumber || '') : '', note: 'اختیاری'
        })
      ) +
      F.text({
        id: 'bCr', label: 'شماره کارت', dir: 'ltr', maxlength: 19,
        value: b ? (b.cardNumber || '') : '', ph: '۶۰۳۷ ۹۹۷۰ ۰۰۰۰ ۰۰۰۰', note: 'اختیاری'
      }) +

      F.section('موجودی', 'bi-cash-coin');

    if (!b) {
      h += F.money({
        id: 'bOb', label: 'موجودی اولیه', value: '',
        hint: 'موجودی حساب در لحظه‌ای که آن را وارد برنامه می‌کنید. مبنای همه گردش‌های بعدی همین است.'
      });
    } else {
      h += F.money({
        id: 'bOb', label: 'موجودی اولیه', value: b.openingBalance || 0,
        hint: 'تغییر این عدد، مانده فعلی حساب را هم جابه‌جا می‌کند. فقط اگر موقع ثبت اشتباه وارد کرده بودید اصلاحش کنید.'
      });
    }

    h += F.area({
      id: 'bNt', label: 'توضیحات', value: b ? (b.notes || '') : '',
      note: 'اختیاری', rows: 2, ph: 'شعبه، نام صاحب حساب، یا هر یادداشت'
    });

    UI.open(b ? 'ویرایش حساب — ' + b.name : 'ثبت حساب بانکی جدید', h,
      '<button class="btn bp" onclick="Bank.save(' + (id || 'null') + ')">' +
        '<i class="bi bi-check-lg"></i> ' + (b ? 'ذخیره تغییرات' : 'ثبت حساب') + '</button>' +
      '<button class="btn bo" onclick="UI.close()">انصراف</button>', true);
    F.focusFirst('bNm');
  },

  save: async function(id) {
    if (!F.validate()) return;
    var d = {
      name: elVal('bNm').trim(),
      bankName: elVal('bBk').trim(),
      accountNumber: elVal('bAc').trim(),
      cardNumber: elVal('bCr').trim(),
      openingBalance: elNum('bOb'),
      notes: elVal('bNt').trim()
    };
    if (!d.name) {
      UI.toast('عنوان حساب را وارد کنید', 'e');
      return;
    }
    if (id) {
      var ex = await DB.get('banks', id);
      Object.assign(ex, d);
      await DB.put('banks', ex);
    } else {
      await DB.add('banks', d);
    }
    UI.close();
    await this.render();
    UI.toast('ذخیره شد');
  },

  rm: async function(id) {
    /* سطح دسترسی */
    if (!Perm.require('delete', 'حذف')) return;
    if (!await UI.confirm('حذف شود؟')) return;
    await DB.del('banks', id);
    await this.render();
  },

  balance: async function(bankId) {
    var b = await DB.get('banks', bankId);
    if (!b) return 0;
    var bal = b.openingBalance || 0;
    var pays = await FY.byYear('payments');
    var bts = [];
    try {
      bts = await DB.all('bankTransfers');
    } catch (e) {}
    /* مبلغ «پرداخت شده» فاکتورها اینجا جداگانه حساب نمی‌شود؛ هر فاکتور
       یک سند دریافت/پرداخت واقعی می‌سازد که در حلقه pays پایین شمرده
       می‌شود. قبلاً هر دو حساب می‌شدند و مانده بانک دو برابر می‌شد. */
    pays.forEach(function(p) {
      if (p.bankId === bankId) {
        if (p.type === 'receipt') bal += p.amount;
        else bal -= p.amount;
      }
    });
    /* حلقه چک حذف شد: چکِ وصول‌شده حالا یک سند دریافت/پرداخت واقعی
       می‌سازد که در حلقه pays بالا شمرده می‌شود. اگر اینجا هم شمرده
       می‌شد، مانده بانک دو برابر می‌شد. */
    bts.forEach(function(bt) {
      if (bt.fromBankId === bankId) bal -= bt.amount;
      if (bt.toBankId === bankId) bal += bt.amount;
    });
    return bal;
  },

  /* توجه: نسخه قبلی دو تعریف از show داشت؛ اولی ناقص بود و فقط
     دریافت/پرداخت را جمع می‌کرد و هیچ خروجی‌ای نمایش نمی‌داد. حذف شد. */

  transfer: function(fromId) {
    DB.all('banks').then(function(bs) {
      var to = bs.filter(function(b) {
        return b.id !== fromId;
      });
      if (!to.length) {
        UI.toast('بانک دیگری نیست', 'e');
        return;
      }
      var o = '<option value="">— انتخاب —</option>';
      to.forEach(function(b) {
        o += '<option value="' + b.id + '">' + esc(b.name) + '</option>';
      });
      var td = todayJ();
      var h = '<div class="fr mb"><div class="fg"><label>تاریخ</label><input class="fc" id="btDt" value="' + esc(td) + '"></div>';
      h += '<div class="fg"><label>مبلغ</label><input class="fc" id="btAm" type="number" dir="ltr"></div></div>';
      h += '<div class="fg"><label>به حساب</label><select class="fc" id="btTo">' + o + '</select></div>';
      h += '<div class="fg"><label>شرح</label><input class="fc" id="btNt" placeholder="انتقال بین بانکی"></div>';
      UI.open('انتقال بین بانکی', h, '<button class="btn bw" onclick="Bank.doTransfer(' + fromId + ')">ثبت</button><button class="btn bo" onclick="UI.close()">انصراف</button>');
    });
  },
  doTransfer: async function(fromId) {
    var toId = intOf(elVal('btTo')) || null;
    var am = elNum('btAm');
    var dt = elVal('btDt');
    var nt = elVal('btNt').trim() || 'انتقال بین بانکی';
    if (!toId) {
      UI.toast('مقصد', 'e');
      return;
    }
    if (am <= 0) {
      UI.toast('مبلغ', 'e');
      return;
    }
    var tid = Date.now();
    await DB.add('bankTransfers', {
      fromBankId: fromId,
      toBankId: toId,
      amount: am,
      date: dt,
      notes: nt,
      transferId: tid
    });
    UI.close();
    UI.toast('انتقال ثبت شد');
    await Bank.show(fromId);
  },
  show: async function(bankId) {
    var b = await DB.get('banks', bankId);
    if (!b) return;
    currentPage = 'banks';
    UI.nav('banks');
    UI.title('bi-bank2', b.name);
    UI.act('<button class="btn bo" onclick="Bank.render()"><i class="bi bi-arrow-right"></i>بازگشت</button> <button class="btn bw" onclick="Bank.transfer(' + bankId + ')"><i class="bi bi-arrow-left-right"></i>انتقال</button>');
    var bs = await DB.all('banks');
    var pays = await FY.byYear('payments');
    var bts = await DB.all('bankTransfers');
    var ct = await DB.all('contacts'),
      cm = {};
    ct.forEach(function(c) {
      cm[c.id] = c.name;
    });
    var txs = [];
    var bal = b.openingBalance || 0;
    /* اصلاح باگ (مهم): این حلقه، مبلغ «پرداخت شده» فاکتور را مستقیم به
       دفتر بانک اضافه می‌کرد، در حالی که همان فاکتور یک سند دریافت
       واقعی هم می‌سازد که در حلقه pays پایین شمرده می‌شود. نتیجه: هر
       پرداخت فاکتور دو ردیف در دفتر بانک می‌ساخت. این دوباره‌شماری
       قبلاً از Bank.balance حذف شده بود ولی از این صفحه نه، برای همین
       دفتر بانک با مانده بانک نمی‌خواند. حلقه حذف شد. */
    pays.forEach(function(p) {
      if (p.bankId === bankId) {
        var desc = p.type === 'receipt' ? 'دریافت' : 'پرداخت';
        desc += ' — ' + (cm[p.contactId] || '—');
        if (p.description) desc += ' / ' + p.description;
        /* اصلاح باگ: بدهکار و بستانکار جابه‌جا بود. مانده با فرمول
           bal + db - cr حساب می‌شود، پس برای حساب بانکی «دریافت» یعنی
           پول وارد شده و باید بدهکار باشد، نه بستانکار. با کد قبلی هر
           دریافت، مانده دفتر را کم می‌کرد. */
        txs.push({
          d: p.date,
          desc: desc,
          db: p.type === 'receipt' ? p.amount : 0,
          cr: p.type === 'payment' ? p.amount : 0,
          s: 1
        });
      }
    });
    /* حلقه چک حذف شد: وصول چک حالا سند دریافت/پرداخت واقعی می‌سازد که
       در حلقه pays بالا می‌آید (با شرح «بابت وصول چک …»). ضمناً همین
       حلقه هم بدهکار/بستانکارش وارونه بود و چک دریافتیِ وصول‌شده مانده
       دفتر را کم می‌کرد. */
    bts.forEach(function(bt) {
      if (bt.fromBankId === bankId) {
        var nm = (bs.find(function(x) {
          return x.id === bt.toBankId;
        }) || {}).name || '—';
        txs.push({
          d: bt.date,
          desc: 'انتقال به ' + nm + (bt.notes ? ' / ' + bt.notes : ''),
          db: 0,
          cr: bt.amount,
          s: 3
        });
      }
      if (bt.toBankId === bankId) {
        var nm2 = (bs.find(function(x) {
          return x.id === bt.fromBankId;
        }) || {}).name || '—';
        txs.push({
          d: bt.date,
          desc: 'انتقال از ' + nm2 + (bt.notes ? ' / ' + bt.notes : ''),
          db: bt.amount,
          cr: 0,
          s: 3
        });
      }
    });
    txs.sort(function(a, b) {
      if (a.d < b.d) return -1;
      if (a.d > b.d) return 1;
      return a.s - b.s;
    });
    var rows = [{
      d: '—',
      desc: 'مانده اولیه',
      db: bal > 0 ? bal : 0,
      cr: bal < 0 ? -bal : 0,
      bal: bal
    }];
    txs.forEach(function(t) {
      bal = bal + t.db - t.cr;
      rows.push({
        d: t.d,
        desc: t.desc,
        db: t.db,
        cr: t.cr,
        bal: bal
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
      tr += '<tr><td>' + (i + 1) + '</td><td>' + r.d + '</td><td>' + esc(r.desc) + '</td>';
      tr += '<td class="cd">' + (r.db ? UI.fn(r.db) : '—') + '</td>';
      tr += '<td class="cc">' + (r.cr ? UI.fn(r.cr) : '—') + '</td>';
      tr += '<td class="' + bc + '">' + UI.fn(Math.abs(r.bal)) + ' ' + bl + '</td></tr>';
    });
    var fB = bal;
    var bL = fB > 0 ? 'بدهکار' : fB < 0 ? 'بستانکار' : 'تسویه';
    var bC = fB > 0 ? 'rd' : fB < 0 ? 'gn' : 'bl';
    var h = '<div class="cd mb"><div class="cd-h">' + esc(b.name) + ' <span style="font-size:.78rem;color:var(--txs)">' + (b.bankName || '') + '</span></div>';
    h += '<div class="cd-b"><div class="lg-sm">';
    h += '<div class="lg-box rd"><h4>' + UI.fn(tD) + '</h4><p>بدهکار</p></div>';
    h += '<div class="lg-box gn"><h4>' + UI.fn(tC) + '</h4><p>بستانکار</p></div>';
    h += '<div class="lg-box ' + bC + '"><h4>' + UI.fn(Math.abs(fB)) + '</h4><p>' + bL + '</p></div>';
    h += '</div></div></div>';
    h += '<div class="cd"><div class="cd-h">گردش حساب</div>';
    h += '<div class="tw"><table><thead><tr><th>#</th><th>تاریخ</th><th>شرح</th><th>بدهکار</th><th>بستانکار</th><th>مانده</th></tr></thead>';
    h += '<tbody>' + (tr || '<tr><td colspan="6" style="text-align:center">گردشی نیست</td></tr>') + '</tbody>';
    h += '<tfoot><tr style="background:var(--bg);font-weight:700"><td colspan="3">جمع</td>';
    h += '<td class="cd">' + UI.fn(tD) + '</td><td class="cc">' + UI.fn(tC) + '</td><td></td></tr></tfoot>';
    h += '</table></div></div>';
    UI.content(h);
  }
};
