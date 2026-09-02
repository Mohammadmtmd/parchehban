/* ══ FISCAL YEAR ══ */
var FY = {
  refreshSel: async function() {
    var ys = await DB.all('fiscalYears');
    var sel = document.getElementById('yearSel');
    if (!sel) return;
    if (!ys.length) {
      sel.innerHTML = '<option>تعریف نشده</option>';
      return;
    }
    var h = '';
    ys.forEach(function(y) {
      h += '<option value="' + y.id + '"' + (y.id === STATE.yearId ? ' selected' : '') + '>' + esc(y.name) + (y.isClosed ? ' (بسته)' : '') + '</option>';
    });
    sel.innerHTML = h;
  },
  ensureDefault: async function() {
    var ys = await DB.all('fiscalYears');
    if (!ys.length) {
      /* اصلاح: سال شمسی از تقویم واقعی گرفته می‌شود (قبلاً میلادی+۶۲۱
         بود که در بازه فروردین تا دی یک سال جلو/عقب می‌افتاد) و پایان
         سال با توجه به کبیسه بودن ۲۹ یا ۳۰ اسفند است. */
      var py = parseInt(Jalali.today().split('/')[0], 10);
      var id = await DB.add('fiscalYears', {
        name: String(py),
        startDate: py + '/01/01',
        endDate: py + '/12/' + Jalali.monthDays(py, 12),
        isCurrent: true,
        isClosed: false
      });
      STATE.yearId = id;
      localStorage.setItem('pb_year', id);
    } else if (!STATE.yearId || !ys.find(function(y) {
        return y.id === STATE.yearId;
      })) {
      var cur = ys.find(function(y) {
        return y.isCurrent && !y.isClosed;
      }) || ys[ys.length - 1];
      STATE.yearId = cur.id;
      localStorage.setItem('pb_year', cur.id);
    }
    await this.refreshSel();
  },
  migrate: async function() {
    var stores = ['invoices', 'payments', 'checks'];
    for (var s = 0; s < stores.length; s++) {
      var all = await DB.all(stores[s]);
      for (var i = 0; i < all.length; i++) {
        if (!all[i].fiscalYearId) {
          all[i].fiscalYearId = STATE.yearId;
          await DB.put(stores[s], all[i]);
        }
      }
    }
  },
  byYear: async function(store) {
    var all = await DB.all(store);
    return all.filter(function(r) {
      return r.fiscalYearId === STATE.yearId;
    });
  },
  render: async function() {
    currentPage = 'years';
    UI.nav('years');
    UI.title('bi-calendar3', 'سال مالی');
    UI.act('<button class="btn bp" onclick="FY.form()"><i class="bi bi-plus-lg"></i>سال جدید</button>');
    var ys = await DB.all('fiscalYears');
    if (!ys.length) {
      UI.content('<div class="cd"><div class="em"><i class="bi bi-calendar3"></i><p>سال مالی ندارید</p></div></div>');
      return;
    }
    var r = '';
    for (var i = 0; i < ys.length; i++) {
      var y = ys[i];
      var tags = '';
      if (y.id === STATE.yearId) tags += '<span class="tg tg-b">جاری</span> ';
      if (y.isClosed) tags += '<span class="tg tg-r">بسته</span> ';
      r += '<tr><td>' + (i + 1) + '</td><td><strong>' + y.name + '</strong></td><td>' + y.startDate + '</td><td>' + y.endDate + '</td><td>' + tags + '</td><td style="white-space:nowrap">';
      if (!y.isClosed && y.id !== STATE.yearId) r += '<button class="btn bs bo" onclick="FY.setCurrent(' + y.id + ')">انتخاب</button> ';
      if (!y.isClosed) r += '<button class="btn bs bw" onclick="FY.closeYear(' + y.id + ')">بستن سال</button> ';
      if (y.isClosed) r += '<button class="btn bs bo" onclick="FY.reopen(' + y.id + ')">بازکردن</button> ';
      r += '<button class="bi2" onclick="FY.form(' + y.id + ')"><i class="bi bi-pencil"></i></button> <button class="bi2 d" onclick="FY.remove(' + y.id + ')"><i class="bi bi-trash3"></i></button></td></tr>';
    }
    UI.content('<div class="cd"><div class="cd-h">سال‌های مالی</div><div class="tw"><table><thead><tr><th>#</th><th>نام</th><th>شروع</th><th>پایان</th><th>وضعیت</th><th>عملیات</th></tr></thead><tbody>' + r + '</tbody></table></div></div>');
  },
  form: async function(id) {
    var y = id ? await DB.get('fiscalYears', id) : null;
    UI.open(y ? 'ویرایش' : 'سال جدید', '<div class="fg"><label>نام</label><input class="fc" id="fyName" value="' + esc(y ? y.name : '') + '" placeholder="1404-1405"></div><div class="fr"><div class="fg"><label>شروع</label><input class="fc" id="fyStart" value="' + esc(y ? y.startDate : '') + '" placeholder="1404/01/01"></div><div class="fg"><label>پایان</label><input class="fc" id="fyEnd" value="' + esc(y ? y.endDate : '') + '" placeholder="1404/12/29"></div></div>', '<button class="btn bp" onclick="FY.save(' + (id || 'null') + ')">' + (y ? 'ذخیره' : 'ثبت') + '</button><button class="btn bo" onclick="UI.close()">انصراف</button>');
    var f = el('fyName');
    if (f) f.focus();
  },
  save: async function(id) {
    var d = {
      name: elVal('fyName').trim(),
      /* اصلاح: تاریخ‌های سال مالی اعتبارسنجی و نرمال‌سازی می‌شوند؛
         قبلاً هر رشته‌ای پذیرفته می‌شد و گزارش‌های دوره‌ای را خراب می‌کرد. */
      startDate: Jalali.parse(elVal('fyStart')),
      endDate: Jalali.parse(elVal('fyEnd'))
    };
    if (!d.name) {
      UI.toast('نام سال مالی را وارد کنید', 'e');
      return;
    }
    if (!d.startDate) {
      UI.toast('تاریخ شروع نامعتبر است (نمونه صحیح: 1404/01/01)', 'e');
      return;
    }
    if (!d.endDate) {
      UI.toast('تاریخ پایان نامعتبر است (نمونه صحیح: 1404/12/29)', 'e');
      return;
    }
    if (d.endDate < d.startDate) {
      UI.toast('تاریخ پایان نمی‌تواند قبل از تاریخ شروع باشد', 'e');
      return;
    }
    if (id) {
      var ex = await DB.get('fiscalYears', id);
      Object.assign(ex, d);
      await DB.put('fiscalYears', ex);
    } else {
      d.isCurrent = false;
      d.isClosed = false;
      await DB.add('fiscalYears', d);
    }
    UI.close();
    await FY.refreshSel();
    await FY.render();
  },
  setCurrent: async function(id) {
    var ys = await DB.all('fiscalYears');
    for (var i = 0; i < ys.length; i++) {
      ys[i].isCurrent = ys[i].id === id;
      await DB.put('fiscalYears', ys[i]);
    }
    STATE.yearId = id;
    localStorage.setItem('pb_year', id);
    await FY.refreshSel();
    await FY.render();
  },
  /* ══ بستن سال مالی با انتقال خودکار مانده‌ها ══
     مانده پایان دوره هر شخص در سال جاری محاسبه و به‌عنوان «مانده
     اولیه» سال بعد در جدول yearOpenings ثبت می‌شود. مانده حساب‌های
     بانکی هم به سال بعد منتقل می‌گردد.
     سال بسته‌شده فقط خواندنی است. */
  closeYear: async function(yearId) {
    if (!Perm.require('closeYear', 'بستن سال مالی')) return;
    var year = await DB.get('fiscalYears', yearId);
    if (!year) return;
    var years = await DB.all('fiscalYears');

    /* سال مقصد: اولین سال باز که شروعش بعد از پایان این سال است */
    var targets = years.filter(function(y) {
      return y.id !== yearId && !y.isClosed && pn(y.startDate) >= pn(year.endDate);
    }).sort(function(a, b) {
      return pn(a.startDate) - pn(b.startDate);
    });
    var options = targets.map(function(y) {
      return '<option value="' + y.id + '">' + esc(y.name) + ' (' + y.startDate + ' تا ' + y.endDate + ')</option>';
    }).join('');

    var body = '<div class="hint-box">با بستن سال مالی <strong>' + esc(year.name) + '</strong>:' +
      '<ul style="margin:6px 18px 0 18px;padding:0">' +
      '<li>مانده پایان دوره همه اشخاص به‌عنوان مانده اولیه سال بعد ثبت می‌شود</li>' +
      '<li>مانده حساب‌های بانکی به سال بعد منتقل می‌شود</li>' +
      '<li>این سال فقط‌خواندنی می‌شود و امکان ثبت یا ویرایش سند در آن نخواهید داشت</li>' +
      '</ul></div>';
    if (options) {
      body += '<div class="fg" style="margin-top:12px"><label>انتقال مانده‌ها به سال مالی</label>' +
        '<select class="fc" id="fyTarget"><option value="">— انتقال نده، فقط سال را ببند —</option>' + options + '</select></div>';
    } else {
      body += '<div class="fg" style="margin-top:12px"><p style="font-size:.8rem;color:var(--txm)">' +
        'سال مالی بازی برای انتقال مانده‌ها وجود ندارد. ابتدا سال بعد را تعریف کنید، سپس این سال را ببندید. ' +
        'اگر الان ببندید، مانده‌ها منتقل نمی‌شوند.</p></div>';
    }
    UI.open('بستن سال مالی ' + esc(year.name), body,
      '<button class="btn bw" onclick="FY.doClose(' + yearId + ')">تأیید و بستن سال</button>' +
      '<button class="btn bo" onclick="UI.close()">انصراف</button>');
  },

  doClose: async function(yearId) {
    if (!Perm.require('closeYear', 'بستن سال مالی')) return;
    var year = await DB.get('fiscalYears', yearId);
    if (!year) return;
    var targetId = intOf(elVal('fyTarget')) || null;
    if (!await UI.confirm('سال مالی «' + year.name + '» بسته شود؟ این کار قابل بازگشت است (از دکمه بازکردن سال).')) return;

    var moved = 0,
      banksMoved = 0;
    if (targetId) {
      /* مانده پایان دوره باید در بستر همین سال محاسبه شود */
      var prevYear = STATE.yearId;
      STATE.yearId = yearId;
      try {
        var contacts = await DB.all('contacts');
        var openings = await DB.all('yearOpenings');
        for (var i = 0; i < contacts.length; i++) {
          var c = contacts[i];
          var closing = await Inv.contactBal(c.id);
          var ex = openings.find(function(o) {
            return o.fiscalYearId === targetId && o.contactId === c.id;
          });
          if (ex) {
            ex.balance = closing;
            ex.carriedFromYearId = yearId;
            await DB.put('yearOpenings', ex);
          } else {
            await DB.add('yearOpenings', {
              fiscalYearId: targetId,
              contactId: c.id,
              balance: closing,
              carriedFromYearId: yearId
            });
          }
          if (closing !== 0) moved++;
        }

        /* انتقال مانده حساب‌های بانکی */
        var banks = await DB.all('banks');
        for (var b = 0; b < banks.length; b++) {
          var bank = banks[b];
          var bal = await Bank.balance(bank.id);
          bank.openingBalance = bal;
          bank.openingCarriedFromYearId = yearId;
          await DB.put('banks', bank);
          banksMoved++;
        }
      } finally {
        STATE.yearId = prevYear;
      }
    }

    year.isClosed = true;
    year.isCurrent = false;
    year.closedAt = new Date().toISOString();
    year.closedToYearId = targetId;
    await DB.put('fiscalYears', year);

    /* اگر سال بسته‌شده سال فعال بود، به سال مقصد یا اولین سال باز برو */
    if (STATE.yearId === yearId) {
      var open = (await DB.all('fiscalYears')).filter(function(y) {
        return !y.isClosed;
      });
      var next = (targetId && open.find(function(y) {
        return y.id === targetId;
      })) || open[0];
      if (next) {
        STATE.yearId = next.id;
        localStorage.setItem('pb_year', next.id);
      }
    }
    UI.close();
    if (targetId) {
      UI.toast('سال بسته شد. مانده ' + moved + ' شخص و ' + banksMoved + ' حساب بانکی به سال بعد منتقل شد.');
    } else {
      UI.toast('سال مالی بسته شد (بدون انتقال مانده).');
    }
    await FY.refreshSel();
    await FY.render();
  },

  /* بازکردن سال بسته‌شده — برای وقتی که اشتباهی بسته شده است */
  reopen: async function(yearId) {
    if (!Perm.can('*')) {
      UI.toast('بازکردن سال مالی بسته‌شده فقط با نقش «مدیر» امکان‌پذیر است.', 'e');
      return;
    }
    var year = await DB.get('fiscalYears', yearId);
    if (!year) return;
    if (!await UI.confirm('سال مالی «' + year.name + '» باز شود؟ مانده‌های منتقل‌شده به سال بعد پاک نمی‌شوند؛ در صورت نیاز باید دستی اصلاحشان کنید.')) return;
    year.isClosed = false;
    await DB.put('fiscalYears', year);
    UI.toast('سال مالی باز شد');
    await FY.refreshSel();
    await FY.render();
  },

  /* نگهبان فقط‌خواندنی — همه فرم‌های ثبت سند این را صدا می‌زنند */
  assertOpen: async function() {
    var y = await DB.get('fiscalYears', STATE.yearId);
    if (y && y.isClosed) {
      UI.toast('سال مالی «' + y.name + '» بسته شده است و امکان ثبت یا ویرایش سند در آن وجود ندارد. ابتدا سال را باز کنید یا به سال مالی باز سوئیچ کنید.', 'e');
      return false;
    }
    return true;
  },

  remove: async function(id) {
    if (!await UI.confirm('حذف شود؟')) return;
    await DB.del('fiscalYears', id);
    if (STATE.yearId === id) {
      STATE.yearId = null;
      await FY.ensureDefault();
    }
    await FY.refreshSel();
    await FY.render();
  }
};
