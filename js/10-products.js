/* ══ PRODUCTS ══ */
var Prod = {
  /* موجودی انبار.
     نکته مهم: موجودی به صورت «تجمعی روی همه سال‌های مالی» حساب می‌شود،
     چون کالای خریداری‌شده در سال قبل هنوز در انبار موجود است. صفحه انبار
     هم اصلاح شد تا از همین قاعده استفاده کند (قبلاً فقط سال مالی جاری را
     می‌دید و عدد دو صفحه با هم اختلاف داشت).
     excludeInvoiceId: هنگام ویرایش یک فاکتور، اثر خودِ آن فاکتور کنار
     گذاشته می‌شود تا هشدار موجودی درست محاسبه شود. */
  stock: async function(pid, excludeInvoiceId) {
    var invs = await DB.all('invoices');
    var s = 0;
    invs.forEach(function(inv) {
      if (inv.type === 'proforma') return;
      if (excludeInvoiceId && inv.id === excludeInvoiceId) return;
      (inv.items || []).forEach(function(it) {
        if (it.productId === pid) s += inv.type === 'purchase' ? numOf(it.quantity) : -numOf(it.quantity);
      });
    });
    return s;
  },

  /* موجودی همه کالاها در یک پیمایش — به‌جای فراخوانی stock در حلقه */
  stockMap: async function(excludeInvoiceId) {
    var invs = await DB.all('invoices');
    var m = {};
    invs.forEach(function(inv) {
      if (inv.type === 'proforma') return;
      /* هنگام ویرایش یک فاکتور، اثر خودِ آن فاکتور کنار گذاشته می‌شود
         تا موجودیِ نمایش‌داده‌شده با کنترل «فروش بیش از موجودی»
         (که همین کار را می‌کند) یکسان باشد. بدون آرگومان، رفتار
         قبلی حفظ می‌شود. */
      if (excludeInvoiceId && inv.id === excludeInvoiceId) return;
      (inv.items || []).forEach(function(it) {
        if (!it.productId) return;
        if (m[it.productId] === undefined) m[it.productId] = 0;
        m[it.productId] += inv.type === 'purchase' ? numOf(it.quantity) : -numOf(it.quantity);
      });
    });
    return m;
  },
  render: async function() {
    currentPage = 'products';
    UI.nav('products');
    UI.title('bi-box-seam-fill', 'کالا');
    UI.act('<button class="btn bp" onclick="Prod.form()">کالای جدید</button>');
    var ps = await DB.all('products'),
      cs = await DB.all('categories'),
      cm = {};
    cs.forEach(function(c) {
      cm[c.id] = c.name;
    });
    if (!ps.length) {
      UI.content('<div class="cd"><div class="em"><i class="bi bi-box-seam"></i><p>کالایی نیست</p></div></div>');
      return;
    }
    /* بهینه‌سازی: قبلاً برای هر کالا کل فاکتورها یک بار پیمایش می‌شد
       (N×M). حالا یک پیمایش برای همه. */
    var sm = await Prod.stockMap();
    var r = '';
    for (var i = 0; i < ps.length; i++) {
      var p = ps[i];
      var st = sm[p.id] || 0;
      var sc = (p.minStock && st <= p.minStock) || st < 0 ? 'color:var(--d);font-weight:700' : '';
      r += '<tr><td>' + (i + 1) + '</td><td><strong>' + esc(p.name) + '</strong></td><td>' + (cm[p.categoryId] || '—') + '</td><td>' + esc(p.colorShade || '—') + '</td><td>' + esc(p.colorCatalog || '—') + '</td><td>' + esc(p.unit || '—') + '</td><td style="' + sc + '">' + UI.fn(st) + '</td><td><button class="bi2" onclick="Prod.form(' + p.id + ')"><i class="bi bi-pencil"></i></button> <button class="bi2 d" onclick="Prod.rm(' + p.id + ')"><i class="bi bi-trash3"></i></button></td></tr>';
    }
    UI.content('<div class="cd"><div class="cd-h">کالاها</div><div class="tw"><table><thead><tr><th>#</th><th>نام</th><th>گروه</th><th>شید</th><th>کالیته</th><th>واحد</th><th>موجودی</th><th></th></tr></thead><tbody>' + r + '</tbody></table></div></div>');
  },
  form: async function(id) {
    /* سطح دسترسی */
    if (!Perm.require('edit', 'ثبت یا ویرایش')) return;
    var p = id ? await DB.get('products', id) : null;
    var cs = await DB.all('categories');

    /* بازنویسی با ابزار مشترک فرم (js/05b-form.js):
       برچسب‌های گویا، نشانه فیلد اجباری، راهنمای زیر فیلد و
       بخش‌بندی — قبلاً همه فیلدها پشت‌سرهم و بی‌توضیح بودند. */
    var cats = cs.map(function(c) { return { v: c.id, t: c.name }; });

    var h = F.section('مشخصات کالا', 'bi-box-seam') +
      F.row(
        F.select({
          id: 'pCt', label: 'گروه کالا', value: p ? p.categoryId : '',
          items: cats, empty: '— بدون گروه —',
          hint: cats.length ? '' : 'هنوز گروهی نساخته‌اید — از صفحه «گروه‌ها»'
        }),
        F.select({
          id: 'pUn', label: 'واحد شمارش', req: true, empty: false,
          value: p ? p.unit : 'متر',
          items: ['متر', 'طاقه', 'رول', 'عدد', 'کیلوگرم', 'یارد']
        })
      ) +
      F.text({
        id: 'pNm', label: 'نام کالا', req: true, value: p ? p.name : '',
        ph: 'مثلاً: کتان کشی عرض ۱۵۰',
        hint: 'همین نام در فاکتور و انبار نمایش داده می‌شود'
      }) +

      F.section('رنگ و کد', 'bi-palette') +
      F.row(
        F.text({
          id: 'pSh', label: 'شید رنگ', value: p ? (p.colorShade || '') : '',
          ph: 'مثلاً: آبی نفتی', note: 'اختیاری',
          hint: 'تُن رنگی پارچه'
        }),
        F.text({
          id: 'pCa', label: 'کد کالیته', value: p ? (p.colorCatalog || '') : '',
          ph: 'مثلاً: C-4120', dir: 'ltr', note: 'اختیاری',
          hint: 'کد رنگ در کاتالوگ کارخانه'
        })
      ) +

      F.section('کنترل موجودی', 'bi-clipboard-check') +
      F.num({
        id: 'pMn', label: 'حداقل موجودی', min: 0,
        value: p ? (p.minStock || 0) : 0,
        suffix: p ? (p.unit || '') : 'متر',
        hint: 'اگر موجودی از این عدد کمتر شود، در داشبورد هشدار می‌گیرید. صفر یعنی بدون هشدار.'
      }) +
      F.area({
        id: 'pNt', label: 'توضیحات', value: p ? (p.notes || '') : '',
        note: 'اختیاری', rows: 2,
        ph: 'جنس، عرض، وزن، نام تأمین‌کننده یا هر یادداشت دیگر'
      });

    UI.open(
      p ? 'ویرایش کالا — ' + p.name : 'ثبت کالای جدید',
      h,
      '<button class="btn bp" onclick="Prod.save(' + (id || 'null') + ')">' +
        '<i class="bi bi-check-lg"></i> ' + (p ? 'ذخیره تغییرات' : 'ثبت کالا') + '</button>' +
      '<button class="btn bo" onclick="UI.close()">انصراف</button>',
      true
    );
    F.focusFirst('pNm');
  },

  save: async function(id) {
    if (!F.validate()) return;
    var d = {
      categoryId: intOf(elVal('pCt')) || null,
      name: elVal('pNm').trim(),
      colorShade: elVal('pSh').trim(),
      colorCatalog: elVal('pCa').trim(),
      unit: elVal('pUn'),
      minStock: intOf(elVal('pMn')),
      notes: elVal('pNt').trim()
    };
    if (!d.name) {
      UI.toast('نام کالا را وارد کنید', 'e');
      return;
    }
    if (id) {
      var ex = await DB.get('products', id);
      Object.assign(ex, d);
      await DB.put('products', ex);
    } else await DB.add('products', d);
    UI.close();
    await this.render();
  },
  rm: async function(id) {
    /* سطح دسترسی */
    if (!Perm.require('delete', 'حذف')) return;
    /* جلوگیری از حذف کالایی که در فاکتور استفاده شده — قبلاً حذف می‌شد
       و فاکتورها به کالای ناموجود ارجاع می‌دادند. */
    var invs = await DB.all('invoices');
    var used = invs.filter(function(inv) {
      return (inv.items || []).some(function(it) {
        return it.productId === id;
      });
    });
    if (used.length) {
      UI.toast('این کالا در ' + UI.fn(used.length) + ' فاکتور استفاده شده و قابل حذف نیست', 'e');
      return;
    }
    if (!await UI.confirm('این کالا حذف شود؟')) return;
    await DB.del('products', id);
    await this.render();
  }
};
