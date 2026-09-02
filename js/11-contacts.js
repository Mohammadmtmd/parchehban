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
    var me = this,
      r = '';
    for (var i = 0; i < ls.length; i++) {
      var c = ls[i];
      r += '<tr><td>' + (i + 1) + '</td><td><strong>' + esc(c.name) + '</strong></td><td><span class="tg ' + me.tt(c.type) + '">' + me.tl(c.type) + '</span></td><td>' + esc(c.phone || '—') + '</td><td style="white-space:nowrap"><button class="bi2" onclick="Led.show(' + c.id + ')"><i class="bi bi-journal-text"></i></button> <button class="bi2" onclick="Con.form(' + c.id + ')"><i class="bi bi-pencil"></i></button> <button class="bi2 d" onclick="Con.rm(' + c.id + ')"><i class="bi bi-trash3"></i></button></td></tr>';
    }
    UI.content('<div class="cd"><div class="cd-h">اشخاص</div><div class="tw"><table><thead><tr><th>#</th><th>نام</th><th>نوع</th><th>تلفن</th><th></th></tr></thead><tbody>' + r + '</tbody></table></div></div>');
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
      h += '<div class="fh" style="margin-top:14px">' +
        'مانده فعلی: <b>' + UI.fn(Math.abs(numOf(c.balance))) + ' ریال ' +
        (numOf(c.balance) >= 0 ? 'بدهکار' : 'بستانکار') + '</b>' +
        ' — این عدد از روی فاکتورها و اسناد محاسبه می‌شود و اینجا قابل تغییر نیست.</div>';
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
