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
  stockMap: async function() {
    var invs = await DB.all('invoices');
    var m = {};
    invs.forEach(function(inv) {
      if (inv.type === 'proforma') return;
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
    var p = id ? await DB.get('products', id) : null;
    var cs = await DB.all('categories');
    var co = '<option value="">—</option>';
    cs.forEach(function(c) {
      co += '<option value="' + c.id + '"' + (p && p.categoryId === c.id ? ' selected' : '') + '>' + esc(c.name) + '</option>';
    });
    var uo = '';
    ['متر', 'طاقه', 'رول', 'عدد'].forEach(function(u) {
      uo += '<option value="' + u + '"' + (p && p.unit === u ? ' selected' : '') + '>' + u + '</option>';
    });
    UI.open(p ? 'ویرایش' : 'کالای جدید', '<div class="fg"><label>گروه</label><select class="fc" id="pCt">' + co + '</select></div><div class="fg"><label>نام</label><input class="fc" id="pNm" value="' + esc(p ? p.name : '') + '"></div><div class="fr"><div class="fg"><label>شید</label><input class="fc" id="pSh" value="' + esc(p ? (p.colorShade || '') : '') + '"></div><div class="fg"><label>کالیته</label><input class="fc" id="pCa" value="' + esc(p ? (p.colorCatalog || '') : '') + '"></div></div><div class="fr"><div class="fg"><label>واحد</label><select class="fc" id="pUn">' + uo + '</select></div><div class="fg"><label>حداقل</label><input class="fc" id="pMn" type="number" value="' + (p ? (p.minStock || 0) : 0) + '"></div></div><div class="fg"><label>توضیحات</label><textarea class="fc" id="pNt">' + esc(p ? (p.notes || '') : '') + '</textarea></div>', '<button class="btn bp" onclick="Prod.save(' + (id || 'null') + ')">' + (p ? 'ذخیره' : 'ثبت') + '</button><button class="btn bo" onclick="UI.close()">انصراف</button>', true);
    var _f = el('pNm');
    if (_f) _f.focus();
  },
  save: async function(id) {
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
