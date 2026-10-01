/* ══ INVOICES ══ */
var Inv = {
  items: [],
  prodMap: {},
  prodOpts: '',
  contactBal: async function(cid) {
    return Con.balance(cid);
  },

  render: async function(type) {
    currentPage = type === 'sale' ? 'sales' : type === 'proforma' ? 'proforma' : 'purchase';
    var isP = type === 'proforma';
    var isS = type === 'sale';
    UI.nav(currentPage);
    UI.title(isP ? 'bi-file-earmark-text' : isS ? 'bi-receipt-cutoff' : 'bi-cart-fill', isP ? 'پیش فاکتور' : isS ? 'فاکتور فروش' : 'فاکتور خرید');
    UI.act('<button class="btn bp" onclick="Inv.showF(\'' + type + '\')"><i class="bi bi-plus-lg"></i>جدید</button>');
    await this.ll(type);
  },

  ll: async function(type) {
    var all = await FY.byYear('invoices');
    var ls = all.filter(function(i) {
      return i.type === type;
    }).sort(function(a, b) {
      return (b.id || 0) - (a.id || 0);
    });
    var ct = await DB.all('contacts'),
      cm = {};
    ct.forEach(function(c) {
      cm[c.id] = c.name;
    });
    if (!ls.length) {
      UI.content('<div class="cd"><div class="em"><i class="bi bi-receipt"></i><p>فاکتوری نیست</p></div></div>');
      return;
    }
    /* جمع کل */
    var tSub = 0,
      tShip = 0,
      tDis = 0,
      tGrand = 0,
      tPaid = 0,
      tRem = 0;
    ls.forEach(function(v) {
      tSub += v.subtotal || 0;
      tShip += v.shippingCost || 0;
      tDis += v.discount || 0;
      tGrand += v.grandTotal || 0;
      tPaid += v.paidAmount || 0;
      tRem += (v.grandTotal || 0) - (v.paidAmount || 0);
    });
    /* صفحه‌بندی */
    var pk = 'inv_' + type;
    Pag.register(pk, function() {
      return Inv.ll(type);
    });
    var pg = Pag.slice(pk, ls);
    var r = '';
    for (var i = 0; i < pg.items.length; i++) {
      var v = pg.items[i];
      var rm = (v.grandTotal || 0) - (v.paidAmount || 0);
      var sg = rm <= 0 ? 'tg-g' : v.paidAmount > 0 ? 'tg-o' : 'tg-r';
      var sl = rm <= 0 ? 'تسویه' : v.paidAmount > 0 ? 'جزئی' : 'باز';
      r += '<tr><td>' + (((pg.page - 1) * pg.per) + i + 1) + '</td><td>' + esc(v.invoiceNumber || '—') + '</td><td>' + v.date + '</td><td>' + esc(cm[v.contactId] || '—') + '</td><td>' + UI.fn(v.subtotal) + '</td><td>' + UI.fn(v.shippingCost || 0) + '</td><td>' + UI.fn(v.discount || 0) + '</td><td style="font-weight:700">' + UI.fn(v.grandTotal) + '</td><td>' + UI.fn(v.paidAmount) + '</td><td style="color:' + (rm > 0 ? 'var(--d)' : 'var(--ok)') + ';font-weight:700">' + UI.fn(rm) + '</td><td><span class="tg ' + sg + '">' + sl + '</span></td><td style="white-space:nowrap"><button class="bi2" title="پیش‌نمایش چاپ و تنظیمات" onclick="Inv.vw(' + v.id + ')"><i class="bi bi-eye"></i></button> <button class="bi2" title="پیش‌نمایش و چاپ A4" onclick="Inv.vw(' + v.id + ',\'a4\')"><span style="font-size:.6rem;font-weight:800">A4</span></button> <button class="bi2" title="پیش‌نمایش و چاپ A5" onclick="Inv.vw(' + v.id + ',\'a5\')"><span style="font-size:.6rem;font-weight:800">A5</span></button> <button class="bi2" title="ویرایش" onclick="Inv.showF(\'' + type + '\',' + v.id + ')"><i class="bi bi-pencil"></i></button> <button class="bi2 d" title="حذف" onclick="Inv.rm(' + v.id + ',\'' + type + '\')"><i class="bi bi-trash3"></i></button></td></tr>';
    }
    var ft = '<tfoot><tr style="background:var(--bg);font-weight:700">';
    ft += '<td colspan="4">جمع ' + ls.length + ' فاکتور</td>';
    ft += '<td>' + UI.fn(tSub) + '</td><td>' + UI.fn(tShip) + '</td><td>' + UI.fn(tDis) + '</td>';
    ft += '<td>' + UI.fn(tGrand) + '</td><td>' + UI.fn(tPaid) + '</td><td>' + UI.fn(tRem) + '</td>';
    ft += '<td colspan="2"></td></tr></tfoot>';
    var title = type === 'proforma' ? 'پیش فاکتور' : type === 'sale' ? 'فروش' : 'خرید';
    var h = '<div class="cd"><div class="cd-h">' + title + '</div>';
    h += '<div class="tw"><table><thead><tr><th>#</th><th>شماره</th><th>تاریخ</th><th>شخص</th><th>جمع</th><th>حمل</th><th>تخفیف</th><th>نهایی</th><th>پرداختی</th><th>مانده</th><th>وضعیت</th><th></th></tr></thead>';
    h += '<tbody>' + r + '</tbody>' + ft + '</table></div>';
    h += Pag.html(pk);
    h += '</div>';
    UI.content(h);
  },

  nn: async function(type) {
    var all = await DB.all('invoices');
    var pf = type === 'sale' ? 'ف-' : type === 'proforma' ? 'پ-' : 'خ-';
    var mx = 0;
    all.forEach(function(i) {
      if (i.type === type && i.invoiceNumber) {
        var n = intOf(String(i.invoiceNumber).replace(pf, ''));
        if (n > mx) mx = n;
      }
    });
    return pf + String(mx + 1).padStart(4, '0');
  },

  showF: async function(type, id) {
    var inv = id ? await DB.get('invoices', id) : null;
    var isS = type === 'sale';
    var isP = type === 'proforma';
    var ct = await DB.all('contacts'),
      pr = await DB.all('products');
    this.prodMap = {};
    pr.forEach(function(p) {
      Inv.prodMap[p.id] = p;
    });
    /* موجودی فعلی هر کالا کنار نامش در فهرست انتخاب نوشته می‌شود.
       این فقط برچسبِ نمایشی است — value همان شناسه کالاست، پس هیچ
       چیزی از این عدد وارد ردیف فاکتور یا دیتابیس نمی‌شود.
       هنگام ویرایش، خودِ همین فاکتور از محاسبه کنار گذاشته می‌شود تا
       عددِ نمایش‌داده‌شده با همان چیزی که کنترل «فروش بیش از موجودی»
       بررسی می‌کند یکی باشد. */
    var smap = await Prod.stockMap(id || null);
    this.stockMap = smap;
    this.prodOpts = '';
    pr.forEach(function(p) {
      var st = numOf(smap[p.id] || 0);
      var lbl = esc(p.name) + (p.colorCatalog ? ' (' + esc(p.colorCatalog) + ')' : '');
      /* اعداد داخل <option> با فاصله مجازی جدا می‌شوند چون در
         تگ option نمی‌شود از span/رنگ استفاده کرد */
      lbl += '  \u2502  ' + (st > 0 ? 'موجودی: ' + UI.fn(st) + ' ' + (p.unit || '') : 'ناموجود');
      Inv.prodOpts += '<option value="' + p.id + '">' + lbl + '</option>';
    });
    var rc = ct.filter(function(c) {
      if (isP) return c.type === 'customer' || c.type === 'both';
      return isS ? (c.type === 'customer' || c.type === 'both') : (c.type === 'supplier' || c.type === 'both');
    });
    var bk = ct.filter(function(c) {
      return c.type === 'broker';
    });
    var balMap = await Con.allBalances();
    var cO = '<option value="">— انتخاب —</option>';
    rc.forEach(function(c) {
      var bal = balMap[c.id] || 0;
      cO += '<option value="' + c.id + '"' + (inv && inv.contactId === c.id ? ' selected' : '') + '>' + esc(c.name) + Con.balTag(bal) + '</option>';
    });
    var bO = '<option value="">— بدون —</option>';
    bk.forEach(function(c) {
      bO += '<option value="' + c.id + '"' + (inv && inv.brokerId === c.id ? ' selected' : '') + '>' + esc(c.name) + '</option>';
    });
    this._type = type;
    this.items = inv ? JSON.parse(JSON.stringify(inv.items || [])) : [];
    if (!this.items.length) {
      this.items.push({
        productId: '',
        catalog: '',
        shade: '',
        quantity: 1,
        unitPrice: 0,
        total: 0
      });
    }
    var iN = inv ? inv.invoiceNumber : await this.nn(type),
      td = todayJ();
    var ft = inv ? (isP ? 'ویرایش پیش فاکتور' : 'ویرایش فاکتور') : (isP ? 'پیش فاکتور جدید' : 'فاکتور جدید');
    var h = '<div class="fr mb"><div class="fg"><label>شماره</label><input class="fc" id="iNm" value="' + esc(iN) + '" readonly style="background:var(--bg)"></div><div class="fg"><label>تاریخ</label><input class="fc" id="iDt" value="' + esc(inv ? inv.date : td) + '"></div></div>';
    h += '<div class="fr mb"><div class="fg"><label>' + (isP || isS ? 'مشتری' : 'تأمین‌کننده') + '</label><select class="fc" id="iCt" onchange="Inv.showBal()">' + cO + '</select></div><div class="fg"><label>حمل</label><input class="fc" id="iSh" type="number" value="' + (inv ? (inv.shippingCost || 0) : 0) + '" dir="ltr" oninput="Inv.calc()"></div></div>';
    h += '<div id="iBal" style="font-size:.82rem;color:var(--txs);margin-bottom:10px"></div>';
    if (!isP) {
      h += '<div class="sec-div" onclick="var e=document.getElementById(\'iBs\');e.style.display=e.style.display===\'none\'?\'block\':\'none\'"><i class="bi bi-chevron-down"></i>واسطه</div>';
      h += '<div id="iBs" style="display:' + (inv && inv.brokerId ? 'block' : 'none') + ';padding:16px 0"><div class="fr"><div class="fg"><label>واسطه</label><select class="fc" id="iBr">' + bO + '</select></div><div class="fg"><label>کمیسیون</label><input class="fc" id="iCm" type="number" value="' + (inv ? (inv.brokerCommission || 0) : 0) + '" dir="ltr"></div></div></div>';
    }
    h += '<div class="cd mb"><div class="cd-h">اقلام <button class="btn bs bo" onclick="Inv.ai()" style="margin-right:auto">+</button></div><div id="iW"></div></div>';
    var banks = await DB.all('banks');
    var bankO = '<option value="">— انتخاب حساب —</option>';
    banks.forEach(function(b) {
      bankO += '<option value="' + b.id + '"' + (inv && inv.bankId === b.id ? ' selected' : '') + '>' + esc(b.name) + '</option>';
    });
    h += '<div class="fr mb"><div class="fg"><label>تخفیف</label><input class="fc" id="iDis" type="number" value="' + (inv ? (inv.discount || 0) : 0) + '" dir="ltr" oninput="Inv.calc()"></div><div class="fg"><label>پرداختی</label><input class="fc" id="iPd" type="number" value="' + (inv ? (inv.paidAmount || 0) : 0) + '" dir="ltr" oninput="Inv.calc()"></div></div>';
    if (!isP) h += '<div class="fg"><label>حساب دریافت/پرداخت فاکتور</label><select class="fc" id="iBk">' + bankO + '</select><div class="hint-box" style="margin-top:8px">اگر مبلغ پرداختی وارد شود، سند دریافت/پرداخت به همین حساب متصل می‌شود و در گزارش گردش حساب نمایش داده خواهد شد.</div></div>';
    h += '<div class="inv-totals" id="iT"></div>';
    h += '<div class="fr" style="margin-top:10px"><div class="fg"><label>سایز پرینت</label><select class="fc" id="iPrt"><option value="a4"' + (!inv || inv.printSize !== 'a5' ? ' selected' : '') + '>A4</option><option value="a5"' + (inv && inv.printSize === 'a5' ? ' selected' : '') + '>A5</option></select></div><div class="fg"><label>توضیحات</label><input class="fc" id="iNt" value="' + esc(inv ? (inv.notes || '') : '') + '"></div></div>';
    UI.open(ft, h, '<button class="btn bp" onclick="Inv.save(\'' + type + '\',' + (id || 'null') + ')">' + (inv ? 'ذخیره' : 'ثبت') + '</button>' + (inv ? '<button class="btn bg" onclick="Inv.vw(' + inv.id + ',{size:document.getElementById(\'iPrt\').value})"><i class="bi bi-printer"></i>پیش‌نمایش و چاپ</button>' : '') + '<button class="btn bo" onclick="UI.close()">انصراف</button>', true);
    this.ri();
    this.calc();
    if (inv && inv.contactId) this.showBal();
  },

  showBal: async function() {
    var cid = intOf(elVal('iCt')) || null;
    var el = document.getElementById('iBal');
    if (!el) return;
    if (!cid) {
      el.innerHTML = '';
      return;
    }
    var bal = await this.contactBal(cid);
    var label = bal > 0 ? 'بدهکار' : bal < 0 ? 'بستانکار' : 'تسویه';
    var color = bal > 0 ? 'var(--d)' : bal < 0 ? 'var(--ok)' : 'var(--txs)';
    el.innerHTML = '<i class="bi bi-info-circle" style="margin-left:4px"></i>مانده حساب: <strong style="color:' + color + '">' + UI.fn(Math.abs(bal)) + ' ریال ' + label + '</strong>' +
      ' <a href="javascript:void(0)" onclick="Led.show(' + cid + ')" style="margin-right:8px;font-size:.78rem;text-decoration:underline">مشاهده معین</a>';
  },

  ai: function() {
    this.items.push({
      productId: '',
      catalog: '',
      shade: '',
      quantity: 0,
      unitPrice: 0,
      total: 0
    });
    this.ri();
  },
  ri2: function(i) {
    this.items.splice(i, 1);
    this.ri();
    this.calc();
  },
  oc: function(i, f, v) {
    var it = this.items[i];
    if (f === 'p') {
      it.productId = intOf(v) || '';
      if (it.productId && this.prodMap[it.productId]) {
        var pp = this.prodMap[it.productId];
        it.catalog = pp.colorCatalog || '';
        it.shade = pp.colorShade || '';
      } else {
        it.catalog = '';
        it.shade = '';
      }
      var catEl = document.getElementById('cat' + i);
      if (catEl) catEl.value = it.catalog || '';
      var shEl = document.getElementById('sh' + i);
      if (shEl) shEl.value = it.shade || '';
    } else if (f === 'q') it.quantity = parseFloat(v) || 0;
    else if (f === 'u') it.unitPrice = numOf(v);
    else if (f === 'bp') it.buyPrice = numOf(v);
    else if (f === 'cat') it.catalog = v;
    else if (f === 'sh') it.shade = v;
    it.total = it.quantity * it.unitPrice;
    it.profit = it.quantity * (it.unitPrice - (it.buyPrice || 0));
    var tc = document.getElementById('t' + i);
    if (tc) tc.textContent = UI.fn(it.total);
    this.calc();
  },

  ri: function() {
    var w = document.getElementById('iW');
    if (!w) return;
    if (!this.items.length) {
      w.innerHTML = '<div style="text-align:center;padding:20px;color:var(--txm)">یک قلم اضافه کنید</div>';
      return;
    }
    var isSale = (this._type === 'sale' || this._type === 'proforma');
    var h = '<table class="inv-tbl"><thead><tr><th style="width:30px">#</th><th>کالا</th><th style="width:90px">کالیته</th><th style="width:80px">شید</th><th style="width:70px">مقدار</th>';
    if (isSale) h += '<th style="width:80px">ق.خرید</th>';
    h += '<th style="width:100px">قیمت</th><th style="width:90px">جمع</th><th style="width:30px"></th></tr></thead><tbody>';
    for (var i = 0; i < this.items.length; i++) {
      var it = this.items[i];
      /* کادر جست‌وجوی تایپی به‌جای <select> (js/12b-prodpick.js).
         با فهرست‌های بلند کالا، انتخاب از select عملی نبود. */
      h += '<tr><td>' + (i + 1) + '</td><td>' + PPick.cell(i, it.productId) + '</td>';
      h += '<td><input id="cat' + i + '" type="text" value="' + esc(it.catalog || '') + '" oninput="Inv.oc(' + i + ',\'cat\',this.value)" style="text-align:center;font-size:.8rem"></td>';
      h += '<td><input id="sh' + i + '" type="text" value="' + esc(it.shade || '') + '" oninput="Inv.oc(' + i + ',\'sh\',this.value)" style="text-align:center;font-size:.8rem"></td>';
      h += '<td><input type="number" id="q' + i + '" value="' + (it.quantity || '') + '" oninput="Inv.oc(' + i + ',\'q\',this.value)" style="text-align:center"></td>';
      if (isSale) h += '<td><input type="number" id="bp' + i + '" value="' + (it.buyPrice || '') + '" oninput="Inv.oc(' + i + ',\'bp\',this.value)" style="text-align:center"></td>';
      h += '<td><input type="number" id="u' + i + '" value="' + (it.unitPrice || '') + '" oninput="Inv.oc(' + i + ',\'u\',this.value)" style="text-align:center"></td>';
      h += '<td class="it-total" id="t' + i + '">' + UI.fn(it.total) + '</td>';
      h += '<td style="text-align:center"><button class="bi2 d" onclick="Inv.ri2(' + i + ')" style="width:28px;height:28px"><i class="bi bi-x" style="font-size:.8rem"></i></button></td></tr>';
    }
    h += '</tbody></table>';
    w.innerHTML = h;
  },

  calc: function() {
    var sub = 0;
    this.items.forEach(function(it) {
      sub += (it.total || 0);
    });
    var sh = elNum('iSh');
    var dis = elNum('iDis');
    var pd = elNum('iPd');
    var gr = Math.max(0, sub + sh - dis);
    var rm = gr - pd;
    var el = document.getElementById('iT');
    if (!el) return;
    var h = '<div class="inv-ti"><label>جمع اقلام</label><div class="val">' + UI.fn(sub) + '</div></div>';
    if (sh) h += '<div class="inv-ti"><label>حمل</label><div class="val">' + UI.fn(sh) + '</div></div>';
    if (dis) h += '<div class="inv-ti"><label>تخفیف</label><div class="val g">−' + UI.fn(dis) + '</div></div>';
    h += '<div class="inv-ti"><label>نهایی</label><div class="val g">' + UI.fn(gr) + '</div></div>';
    h += '<div class="inv-ti"><label>پرداختی</label><div class="val">' + UI.fn(pd) + '</div></div>';
    if (this._type === 'sale' || this._type === 'proforma') {
      var profit = 0;
      this.items.forEach(function(it) {
        profit += (it.profit || 0);
      });
      if (profit !== 0) h += '<div class="inv-ti"><label>سود</label><div class="val ' + (profit >= 0 ? 'g' : 'r') + '">' + UI.fn(profit) + '</div></div>';
    };
    h += '<div class="inv-ti"><label>مانده</label><div class="val ' + (rm > 0 ? 'r' : 'g') + '">' + UI.fn(rm) + '</div></div>';
    el.innerHTML = h;
  },

  save: async function(type, id) {
    /* سطح دسترسی و سال مالی بسته */
    if (!Perm.require('edit', 'ثبت یا ویرایش سند')) return;
    if (!await FY.assertOpen()) return;
    var cid = intOf(elVal('iCt')) || null;
    if (!cid) {
      UI.toast('شخص فاکتور را انتخاب کنید', 'e');
      return;
    }

    /* اعتبارسنجی تاریخ — قبلاً هر رشته‌ای ذخیره می‌شد و گزارش‌ها
       و مرتب‌سازی را خراب می‌کرد. */
    var dateStr = Jalali.parse(elVal('iDt'));
    if (!dateStr) {
      UI.toast('تاریخ نامعتبر است (نمونه صحیح: 1404/01/05)', 'e');
      return;
    }

    if (!this.items.length) {
      UI.toast('حداقل یک قلم کالا اضافه کنید', 'e');
      return;
    }
    for (var i = 0; i < this.items.length; i++) {
      if (!this.items[i].productId) {
        UI.toast('کالای ردیف ' + (i + 1) + ' انتخاب نشده', 'e');
        return;
      }
      if (!(this.items[i].quantity > 0)) {
        UI.toast('مقدار ردیف ' + (i + 1) + ' باید بزرگ‌تر از صفر باشد', 'e');
        return;
      }
    }
    var pr = await DB.all('products'),
      pm = {};
    pr.forEach(function(p) {
      pm[p.id] = p.name;
    });
    var items = this.items.map(function(it) {
      return {
        productId: it.productId,
        productName: pm[it.productId] || '—',
        catalog: it.catalog || '',
        shade: it.shade || '',
        quantity: it.quantity,
        unitPrice: it.unitPrice,
        total: it.total,
        buyPrice: type === 'purchase' ? it.unitPrice : (it.buyPrice || 0),
        profit: type === 'purchase' ? 0 : it.quantity * (it.unitPrice - (it.buyPrice || 0))
      };
    });
    var sub = 0;
    items.forEach(function(it) {
      sub += it.total;
    });
    var sh = elNum('iSh');
    var dis = elNum('iDis');
    var pd = elNum('iPd');
    var isS = type === 'sale';
    var isP = type === 'proforma';
    var grand = Math.max(0, sub + sh - dis);
    if (dis > sub + sh) {
      UI.toast('تخفیف از جمع فاکتور بیشتر است', 'e');
      return;
    }
    if (pd > grand) {
      UI.toast('مبلغ پرداختی از مبلغ نهایی فاکتور بیشتر است', 'e');
      return;
    }

    /* فروش بیش از موجودی کاملاً مسدود است — ابتدا باید فاکتور خرید
       ثبت شود. (درخواست کاربر: بند ۴.۴) */
    if (isS) {
      var short = [];
      for (var si = 0; si < this.items.length; si++) {
        var itm = this.items[si];
        var cur = await Prod.stock(itm.productId, id);
        if (cur - itm.quantity < 0) {
          short.push((pm[itm.productId] || '—') + ' — موجودی: ' +
            UI.fn(cur) + ' / درخواست: ' + UI.fn(itm.quantity));
        }
      }
      if (short.length) {
        UI.toast('موجودی کافی نیست؛ ابتدا فاکتور خرید را ثبت کنید:\n' + short.join('\n'), 'e');
        return;
      }
    }
    var d = {
      type: type,
      fiscalYearId: STATE.yearId,
      invoiceNumber: elVal('iNm'),
      date: dateStr,
      contactId: cid,
      /* اصلاح باگ: واسطه/کمیسیون قبلاً فقط برای فاکتور فروش ذخیره می‌شد،
         در حالی که همان فیلدها در فاکتور خرید هم نمایش داده می‌شد و
         اطلاعات وارد‌شده بی‌صدا از بین می‌رفت. */
      brokerId: isP ? null : (intOf(elVal('iBr')) || null),
      brokerCommission: isP ? 0 : intOf(elVal('iCm')),
      items: items,
      subtotal: sub,
      shippingCost: sh,
      discount: dis,
      grandTotal: grand,
      paidAmount: pd,
      bankId: intOf(elVal('iBk')) || null,
      printSize: elVal('iPrt') || 'a4',
      notes: elVal('iNt').trim()
    };
    var invId = id;
    if (id) {
      var ex = await DB.get('invoices', id);
      Object.assign(ex, d);
      await DB.put('invoices', ex);
      UI.toast('ویرایش شد');
    } else {
      invId = await DB.add('invoices', d);
      UI.toast('ثبت شد');
    }
    /* ساخت/به‌روزرسانی سند مالی متناظر با فیلد «پرداخت شده» */
    await this.syncAutoPayment(invId);
    UI.close();
    await this.ll(type);
  },

  /* ══ سند خودکار دریافت/پرداخت فاکتور ══
     فیلد «پرداخت شده» فاکتور دیگر یک عدد بی‌سند نیست: یک سند واقعی
     دریافت (برای فروش) یا پرداخت (برای خرید) می‌سازد که به همان حساب
     بانکی انتخاب‌شده در فاکتور وصل است. بنابراین:
       • در دفتر معین شخص دیده می‌شود
       • در مانده حساب بانکی اثر می‌گذارد
       • در گزارش‌ها و فهرست دریافت/پرداخت‌ها می‌آید
     محاسبه مانده شخص فقط از اسناد خوانده می‌شود، پس دیگر خطر دو بار
     حساب شدن وجود ندارد. */
  syncAutoPayment: async function(invId) {
    var inv = await DB.get('invoices', invId);
    if (!inv) return;
    var pays = await DB.all('payments');
    var linked = pays.filter(function(p) {
      return p.sourceInvoiceId === invId;
    });
    var paid = numOf(inv.paidAmount);

    /* پیش‌فاکتور یا مبلغ صفر → سند نباید وجود داشته باشد */
    if (inv.type === 'proforma' || paid <= 0) {
      for (var i = 0; i < linked.length; i++) await DB.del('payments', linked[i].id);
      return;
    }
    var label = 'بابت فاکتور ' + (inv.invoiceNumber || inv.id);
    var body = {
      type: inv.type === 'sale' ? 'receipt' : 'payment',
      fiscalYearId: inv.fiscalYearId,
      contactId: inv.contactId,
      amount: paid,
      date: inv.date,
      bankId: inv.bankId || null,
      description: label,
      notes: label,
      sourceInvoiceId: invId,
      auto: true
    };
    if (linked.length) {
      var keep = linked[0];
      Object.assign(keep, body);
      await DB.put('payments', keep);
      /* اگر به هر دلیل چند سند تکراری ساخته شده بود، اضافی‌ها حذف شوند */
      for (var j = 1; j < linked.length; j++) await DB.del('payments', linked[j].id);
    } else {
      await DB.add('payments', body);
    }
  },

  /* حذف سند خودکار وابسته به یک فاکتور */
  removeAutoPayment: async function(invId) {
    var pays = await DB.all('payments');
        var linked = pays.filter(function(p) {
      return p.sourceInvoiceId === invId;
    });
    for (var i = 0; i < linked.length; i++) await DB.del('payments', linked[i].id);
    return linked.length;
  },

  /* ══ سازنده پیشرفته و سفارشی‌سازی‌پذیر HTML فاکتور ══ */
  _html: async function(v, opts) {
    if (typeof opts === 'string') opts = { size: opts };
    opts = Object.assign({
      size: (v && v.printSize) || 'a4',
      orientation: 'portrait',
      showTotalBal: true,
      showPayment: true,
      showPrices: true,
      showCatalogShade: true,
      showSignature: true,
      showNotes: true,
      customNote: '',
      fontSize: 'normal'
    }, opts || {});

    var ct = await DB.all('contacts'),
      cm = {},
      cMapFull = {};
    ct.forEach(function(c) {
      cm[c.id] = c.name;
      cMapFull[c.id] = c;
    });

    var a5 = opts.size === 'a5';
    var isLand = opts.orientation === 'landscape';
    var isS = v.type === 'sale';
    var isPf = v.type === 'proforma';
    var items = v.items || [];
    var rm = numOf(v.grandTotal) - numOf(v.paidAmount);
    var cBal = isPf ? 0 : await this.contactBal(v.contactId);
    var cObj = cMapFull[v.contactId];
    var custName = cm[v.contactId] || '—';
    var custPhone = cObj && cObj.phone ? cObj.phone : '';
    var custAddress = cObj && cObj.address ? cObj.address : '';

    var headTitle = isPf ? 'پیش فاکتور فروش' : (isS ? 'صورتحساب فروش' : 'صورتحساب خرید');
    var personLabel = isS || isPf ? 'خریدار / مشتری:' : 'فروشنده / تأمین‌کننده:';

    var pd = a5 ? (isLand ? '6mm 9mm' : '8mm 9mm') : (isLand ? '10mm 14mm' : '12mm 14mm');
    var fs = a5 ? (opts.fontSize === 'compact' ? '8.5px' : opts.fontSize === 'large' ? '11px' : '9.5px') :
                  (opts.fontSize === 'compact' ? '10px' : opts.fontSize === 'large' ? '12.5px' : '11px');

    var bd = 'border:1px solid #cbd5e1;padding:4px 6px;';
    var th = 'border:1px solid #cbd5e1;padding:5px 6px;background:#f1f5f9;text-align:center;font-weight:700;color:#0f172a;white-space:nowrap;';

    var r = '';
    items.forEach(function(it, i) {
      r += '<tr style="border-bottom:1px solid #e2e8f0">' +
        '<td style="' + bd + 'text-align:center;width:28px">' + UI.fn(i + 1) + '</td>' +
        '<td style="' + bd + 'font-weight:600">' + esc(it.productName || '—') + '</td>';
      if (opts.showCatalogShade) {
        r += '<td style="' + bd + 'text-align:center;width:65px">' + esc(it.catalog || '—') + '</td>' +
             '<td style="' + bd + 'text-align:center;width:55px">' + esc(it.shade || '—') + '</td>';
      }
      r += '<td style="' + bd + 'text-align:center;width:55px;font-weight:700">' + UI.fn(it.quantity) + '</td>' +
           '<td style="' + bd + 'text-align:center;width:45px;color:#64748b">' + esc(it.unit || 'متر') + '</td>';
      if (opts.showPrices) {
        r += '<td style="' + bd + 'text-align:center;width:75px">' + UI.fn(it.unitPrice) + '</td>' +
             '<td style="' + bd + 'text-align:center;width:85px;font-weight:700">' + UI.fn(it.total) + '</td>';
      }
      r += '</tr>';
    });

    var addRow = function(lab, val, bold, color) {
      var st = (bold ? 'background:#f8fafc;font-weight:800;' : '') + (color ? 'color:' + color + ';' : 'color:#0f172a;');
      return '<tr><td style="padding:4px 10px;border:1px solid #cbd5e1;white-space:nowrap;' + st + '">' + lab +
        '</td><td style="padding:4px 10px;border:1px solid #cbd5e1;text-align:left;white-space:nowrap;' + st + '">' + val + '</td></tr>';
    };

    var h = '<div style="direction:rtl;font-family:Vazirmatn,system-ui,sans-serif;padding:' + pd +
      ';font-size:' + fs + ';line-height:1.6;color:#0f172a;background:#ffffff;box-sizing:border-box;min-height:100%;display:flex;flex-direction:column">';

    // Header
    h += '<div style="border-bottom:2.5px double #0f172a;padding-bottom:10px;margin-bottom:12px">' +
      '<div style="display:flex;justify-content:space-between;align-items:center">' +
      '<div>' +
        '<h1 style="font-size:' + (a5 ? '15px' : '19px') + ';margin:0;font-weight:800;color:#0f172a">' + headTitle + '</h1>' +
        '<div style="font-size:11px;color:#64748b;margin-top:2px">سیستم حسابداری و فروش پارچه‌بان</div>' +
      '</div>' +
      '<div style="text-align:left;font-size:10.5px;color:#334155;line-height:1.6">' +
        '<div>شماره فاکتور: <strong style="font-size:12px;color:#0f172a">' + esc(v.invoiceNumber || v.id) + '</strong></div>' +
        '<div>تاریخ: <strong>' + esc(v.date || todayJ()) + '</strong></div>' +
      '</div></div></div>';

    // Contact Box
    h += '<div style="margin-bottom:12px;padding:8px 12px;border:1px solid #cbd5e1;border-radius:6px;font-size:10px;background:#f8fafc;display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px">' +
      '<div><strong>' + personLabel + '</strong> <span style="font-size:11.5px;font-weight:700">' + esc(custName) + '</span></div>';
    if (custPhone) h += '<div><span style="color:#64748b">تلفن:</span> <strong>' + esc(custPhone) + '</strong></div>';
    if (custAddress) h += '<div style="width:100%;font-size:9.5px;color:#475569"><span style="color:#64748b">نشانی:</span> ' + esc(custAddress) + '</div>';
    h += '</div>';

    // Table Header
    h += '<table style="width:100%;border-collapse:collapse;margin-bottom:12px;font-size:' + (a5 ? '9px' : '10.5px') +
      '"><thead><tr><th style="' + th + '">#</th><th style="' + th + '">شرح کالا / پارچه</th>';
    if (opts.showCatalogShade) {
      h += '<th style="' + th + '">کالیته</th><th style="' + th + '">شید</th>';
    }
    h += '<th style="' + th + '">مقدار</th><th style="' + th + '">واحد</th>';
    if (opts.showPrices) {
      h += '<th style="' + th + '">فی (ریال)</th><th style="' + th + '">جمع کل (ریال)</th>';
    }
    h += '</tr></thead><tbody>' + r + '</tbody></table>';

    // Totals Section
    if (opts.showPrices) {
      h += '<div style="display:flex;justify-content:flex-end;margin-bottom:12px">' +
        '<table style="border-collapse:collapse;font-size:' + (a5 ? '8.5px' : '10px') + ';width:auto">' +
        addRow('جمع اقلام', UI.fn(v.subtotal) + ' ریال', false);
      if (v.shippingCost) h += addRow('هزینه حمل', UI.fn(v.shippingCost) + ' ریال', false);
      if (v.discount) h += addRow('تخفیف', '−' + UI.fn(v.discount) + ' ریال', false, '#16a34a');
      h += addRow('مبلغ قابل پرداخت', UI.fn(v.grandTotal) + ' ریال', true);
      if (v.paidAmount && !isPf && opts.showPayment) h += addRow('مبلغ پرداخت شده', UI.fn(v.paidAmount) + ' ریال', false, '#16a34a');
      if (rm > 0 && !isPf && opts.showPayment) h += addRow('مانده این فاکتور', UI.fn(rm) + ' ریال', false, '#dc2626');
      if (!isPf && Math.abs(cBal) > 0 && opts.showTotalBal) {
        var balLabel = cBal > 0 ? 'بدهکار' : 'بستانکار';
        h += addRow('مانده حساب کل (' + balLabel + ')', UI.fn(Math.abs(cBal)) + ' ریال', true, cBal > 0 ? '#dc2626' : '#16a34a');
      }
      h += '</table></div>';

      // Words box
      h += '<div style="margin-bottom:12px;padding:6px 10px;border:1px dashed #94a3b8;border-radius:6px;font-size:9.5px;background:#f8fafc;line-height:1.7">' +
        '<div><strong>مبلغ فاکتور به حروف:</strong> ' + esc(num2fa(v.grandTotal)) + ' ریال</div>';
      if (!isPf && Math.abs(cBal) > 0 && opts.showTotalBal) {
        h += '<div><strong>مانده کل حساب به حروف:</strong> ' + esc(num2fa(Math.abs(cBal))) + ' ریال (' + (cBal > 0 ? 'بدهکار' : 'بستانکار') + ')</div>';
      }
      h += '</div>';
    }

    // Notes
    if (opts.showNotes && v.notes) {
      h += '<div style="margin-bottom:8px;font-size:9.5px;color:#334155;background:#f8fafc;padding:6px 10px;border-radius:6px;border:1px solid #e2e8f0">' +
        '<strong>توضیحات فاکتور:</strong> ' + esc(v.notes) + '</div>';
    }
    if (opts.customNote) {
      h += '<div style="margin-bottom:8px;font-size:9.5px;color:#1e293b;background:#eff6ff;padding:6px 10px;border-radius:6px;border:1px solid #bfdbfe">' +
        '<strong>یادداشت اختصاصی:</strong> ' + esc(opts.customNote) + '</div>';
    }

    // Signatures
    if (opts.showSignature) {
      h += '<div style="margin-top:auto;padding-top:16px;display:flex;justify-content:space-between;border-top:1px solid #cbd5e1">' +
        '<div style="width:170px;text-align:center;font-size:9.5px;padding-top:28px;border-top:1px solid #64748b">مهر و امضای ' +
        (isS ? 'فروشنده' : 'خریدار') + '</div>' +
        '<div style="width:170px;text-align:center;font-size:9.5px;padding-top:28px;border-top:1px solid #64748b">مهر و امضای ' +
        (isS ? 'خریدار / تحویل‌گیرنده' : 'فروشنده') + '</div></div>';
    }

    h += '</div>';
    return h;
  },

  /* ══ مودال استودیوی پیش‌نمایش و تنظیمات چاپ ══ */
  vw: async function(id, initialOpts) {
    var v = await DB.get('invoices', id);
    if (!v) {
      UI.toast('فاکتور یافت نشد', 'e');
      return;
    }
    this._currentInvoice = v;
    var defaultSize = (initialOpts && initialOpts.size) || v.printSize || 'a4';
    this._currentPrintOpts = Object.assign({
      size: defaultSize,
      orientation: 'portrait',
      showTotalBal: true,
      showPayment: true,
      showPrices: true,
      showCatalogShade: true,
      showSignature: true,
      showNotes: true,
      customNote: '',
      fontSize: 'normal',
      scale: defaultSize === 'a5' ? 1.0 : 0.85
    }, initialOpts || {});

    this._zoomLevel = this._currentPrintOpts.scale;
    var modalHtml = this._buildPreviewModalHtml(v, this._currentPrintOpts);

    UI.open('پیش‌نمایش چاپ — فاکتور شماره ' + (v.invoiceNumber || v.id), modalHtml,
      '<button class="btn bp" onclick="Inv.execPrint()"><i class="bi bi-printer-fill"></i> چاپ با چاپگر</button>' +
      '<button class="btn bdn" onclick="Inv.exportPDF()"><i class="bi bi-file-earmark-pdf-fill"></i> ذخیره PDF</button>' +
      '<button class="btn bg" onclick="Inv.exportJPEG()"><i class="bi bi-file-earmark-image-fill"></i> ذخیره عکس (JPEG)</button>' +
      '<button class="btn bo" onclick="UI.close()">بستن</button>', 'xl');

    this.updatePreviewSheet();
  },

  pr: async function(id, sz) {
    await this.vw(id, { size: sz || 'a4' });
  },

  _buildPreviewModalHtml: function(v, opts) {
    var h = '<div class="pr-prev-layout">' +
      // Sidebar: Print Options
      '<div class="pr-prev-sidebar">' +
        '<div class="pr-opt-sec">' +
          '<div class="pr-opt-title"><i class="bi bi-file-earmark-text"></i> اندازه برگه چاپ</div>' +
          '<div class="pr-btn-group">' +
            '<button type="button" class="' + (opts.size === 'a4' ? 'active' : '') + '" onclick="Inv.setPrintOpt(\'size\',\'a4\')">A4 (بزرگ)</button>' +
            '<button type="button" class="' + (opts.size === 'a5' ? 'active' : '') + '" onclick="Inv.setPrintOpt(\'size\',\'a5\')">A5 (کوچک)</button>' +
          '</div>' +
        '</div>' +
        '<div class="pr-opt-sec">' +
          '<div class="pr-opt-title"><i class="bi bi-arrow-repeat"></i> جهت صفحه</div>' +
          '<div class="pr-btn-group">' +
            '<button type="button" class="' + (opts.orientation === 'portrait' ? 'active' : '') + '" onclick="Inv.setPrintOpt(\'orientation\',\'portrait\')">عمودی</button>' +
            '<button type="button" class="' + (opts.orientation === 'landscape' ? 'active' : '') + '" onclick="Inv.setPrintOpt(\'orientation\',\'landscape\')">افقی</button>' +
          '</div>' +
        '</div>' +
        '<div class="pr-opt-sec">' +
          '<div class="pr-opt-title"><i class="bi bi-fonts"></i> اندازه قلم و فشردگی</div>' +
          '<div class="pr-btn-group">' +
            '<button type="button" class="' + (opts.fontSize === 'compact' ? 'active' : '') + '" onclick="Inv.setPrintOpt(\'fontSize\',\'compact\')">فشرده</button>' +
            '<button type="button" class="' + (opts.fontSize === 'normal' ? 'active' : '') + '" onclick="Inv.setPrintOpt(\'fontSize\',\'normal\')">معمولی</button>' +
            '<button type="button" class="' + (opts.fontSize === 'large' ? 'active' : '') + '" onclick="Inv.setPrintOpt(\'fontSize\',\'large\')">درشت</button>' +
          '</div>' +
        '</div>' +
        '<div class="pr-opt-sec">' +
          '<div class="pr-opt-title"><i class="bi bi-check2-square"></i> محتوای چاپی فاکتور</div>' +
          '<label class="pr-check-label"><input type="checkbox" id="prOptPrices" ' + (opts.showPrices ? 'checked' : '') + ' onchange="Inv.onPrintCheckboxChange()"> <span>نمایش قیمت‌ها و مبالغ ریالی</span></label>' +
          '<label class="pr-check-label"><input type="checkbox" id="prOptPayment" ' + (opts.showPayment ? 'checked' : '') + ' onchange="Inv.onPrintCheckboxChange()"> <span>جزئیات پرداخت و مانده این فاکتور</span></label>' +
          '<label class="pr-check-label"><input type="checkbox" id="prOptTotalBal" ' + (opts.showTotalBal ? 'checked' : '') + ' onchange="Inv.onPrintCheckboxChange()"> <span>نمایش مانده حساب کل شخص</span></label>' +
          '<label class="pr-check-label"><input type="checkbox" id="prOptCatalog" ' + (opts.showCatalogShade ? 'checked' : '') + ' onchange="Inv.onPrintCheckboxChange()"> <span>ستون کالیته و شید</span></label>' +
          '<label class="pr-check-label"><input type="checkbox" id="prOptSignature" ' + (opts.showSignature ? 'checked' : '') + ' onchange="Inv.onPrintCheckboxChange()"> <span>کادر مهر و امضای طرفین</span></label>' +
          '<label class="pr-check-label"><input type="checkbox" id="prOptNotes" ' + (opts.showNotes ? 'checked' : '') + ' onchange="Inv.onPrintCheckboxChange()"> <span>توضیحات ثبت‌شده فاکتور</span></label>' +
        '</div>' +
        '<div class="pr-opt-sec">' +
          '<div class="pr-opt-title"><i class="bi bi-pencil-square"></i> متن سفارشی پاورقی</div>' +
          '<input class="fc" id="prOptCustomNote" placeholder="مثلاً: اجناس تا ۴۸ ساعت قابل تعویض است" value="' + esc(opts.customNote || '') + '" oninput="Inv.onPrintCustomNoteChange()" style="font-size:.8rem;padding:6px 10px">' +
        '</div>' +
      '</div>' +
      // Main Stage: Document Canvas
      '<div class="pr-prev-stage">' +
        '<div class="pr-prev-toolbar">' +
          '<div id="prPaperBadge" style="font-weight:700;display:flex;align-items:center;gap:6px">' +
            '<i class="bi bi-aspect-ratio"></i> ' + (opts.size.toUpperCase()) + ' ' + (opts.orientation === 'landscape' ? 'افقی' : 'عمودی') +
          '</div>' +
          '<div class="pr-prev-zoom-controls">' +
            '<button type="button" class="pr-prev-zoom-btn" onclick="Inv.zoom(-0.1)" title="کوچک‌نمایی"><i class="bi bi-zoom-out"></i></button>' +
            '<span id="prZoomLabel" style="font-size:.78rem;min-width:44px;text-align:center">' + Math.round(opts.scale * 100) + '٪</span>' +
            '<button type="button" class="pr-prev-zoom-btn" onclick="Inv.zoom(0.1)" title="بزرگ‌نمایی"><i class="bi bi-zoom-in"></i></button>' +
            '<button type="button" class="pr-prev-zoom-btn" onclick="Inv.zoomReset()" title="اندازه طبیعی">۱۰۰٪</button>' +
          '</div>' +
        '</div>' +
        '<div class="pr-prev-scroll" id="prPrevScroll">' +
          '<div class="pr-paper-wrap" id="prPaperWrap" style="transform:scale(' + opts.scale + ')">' +
            '<div id="invPaperSheet" class="pr-paper-sheet ' + opts.size + ' ' + opts.orientation + '">' +
              '<!-- محتوای برگه فاکتور -->' +
            '</div>' +
          '</div>' +
        '</div>' +
      '</div>' +
    '</div>';
    return h;
  },

  setPrintOpt: function(key, val) {
    if (!this._currentPrintOpts) return;
    this._currentPrintOpts[key] = val;
    this._refreshSettingsUi();
    this.updatePreviewSheet();
  },

  onPrintCheckboxChange: function() {
    if (!this._currentPrintOpts) return;
    this._currentPrintOpts.showPrices = !!(document.getElementById('prOptPrices') && document.getElementById('prOptPrices').checked);
    this._currentPrintOpts.showPayment = !!(document.getElementById('prOptPayment') && document.getElementById('prOptPayment').checked);
    this._currentPrintOpts.showTotalBal = !!(document.getElementById('prOptTotalBal') && document.getElementById('prOptTotalBal').checked);
    this._currentPrintOpts.showCatalogShade = !!(document.getElementById('prOptCatalog') && document.getElementById('prOptCatalog').checked);
    this._currentPrintOpts.showSignature = !!(document.getElementById('prOptSignature') && document.getElementById('prOptSignature').checked);
    this._currentPrintOpts.showNotes = !!(document.getElementById('prOptNotes') && document.getElementById('prOptNotes').checked);
    this.updatePreviewSheet();
  },

  onPrintCustomNoteChange: function() {
    if (!this._currentPrintOpts) return;
    var el = document.getElementById('prOptCustomNote');
    this._currentPrintOpts.customNote = el ? el.value.trim() : '';
    this.updatePreviewSheet();
  },

  _refreshSettingsUi: function() {
    var opts = this._currentPrintOpts || {};
    var buttons = document.querySelectorAll('.pr-btn-group button');
    buttons.forEach(function(btn) {
      var oc = btn.getAttribute('onclick') || '';
      if (oc.indexOf("'" + opts.size + "'") > -1 && oc.indexOf('size') > -1) {
        btn.classList.add('active');
      } else if (oc.indexOf('size') > -1) {
        btn.classList.remove('active');
      }
      if (oc.indexOf("'" + opts.orientation + "'") > -1 && oc.indexOf('orientation') > -1) {
        btn.classList.add('active');
      } else if (oc.indexOf('orientation') > -1) {
        btn.classList.remove('active');
      }
      if (oc.indexOf("'" + opts.fontSize + "'") > -1 && oc.indexOf('fontSize') > -1) {
        btn.classList.add('active');
      } else if (oc.indexOf('fontSize') > -1) {
        btn.classList.remove('active');
      }
    });
  },

  updatePreviewSheet: async function() {
    var v = this._currentInvoice;
    if (!v) return;
    var opts = this._currentPrintOpts || {};
    var sheetEl = document.getElementById('invPaperSheet');
    if (!sheetEl) return;

    sheetEl.className = 'pr-paper-sheet ' + opts.size + ' ' + opts.orientation;
    sheetEl.innerHTML = await this._html(v, opts);

    var badge = document.getElementById('prPaperBadge');
    if (badge) {
      var sizeText = opts.size === 'a5' ? 'A5 (۱۴۸ × ۲۱۰ میلی‌متر)' : 'A4 (۲۱۰ × ۲۹۷ میلی‌متر)';
      badge.innerHTML = '<i class="bi bi-aspect-ratio"></i> ' + sizeText + ' — ' + (opts.orientation === 'landscape' ? 'افقی' : 'عمودی');
    }
  },

  zoom: function(delta) {
    var newZoom = (this._zoomLevel || 0.85) + delta;
    if (newZoom < 0.3) newZoom = 0.3;
    if (newZoom > 2.0) newZoom = 2.0;
    this._zoomLevel = Math.round(newZoom * 10) / 10;
    this._applyZoom();
  },

  zoomReset: function() {
    this._zoomLevel = 1.0;
    this._applyZoom();
  },

  _applyZoom: function() {
    var wrap = document.getElementById('prPaperWrap');
    if (wrap) wrap.style.transform = 'scale(' + this._zoomLevel + ')';
    var lbl = document.getElementById('prZoomLabel');
    if (lbl) lbl.textContent = Math.round(this._zoomLevel * 100) + '٪';
  },

  /* ══ ارسال مستقیم به چاپگر با تنظیمات انتخابی ══ */
  execPrint: async function() {
    var v = this._currentInvoice;
    if (!v) return;
    var opts = this._currentPrintOpts || {};
    var area = document.getElementById('printArea');
    if (!area) return;

    area.innerHTML = await this._html(v, opts);

    // اعمال سایز صفحه برای چاپ
    var styleId = 'pbDynamicPageStyle';
    var existingStyle = document.getElementById(styleId);
    if (!existingStyle) {
      existingStyle = document.createElement('style');
      existingStyle.id = styleId;
      document.head.appendChild(existingStyle);
    }
    var pageSize = (opts.size === 'a5' ? 'A5' : 'A4') + (opts.orientation === 'landscape' ? ' landscape' : ' portrait');
    existingStyle.innerHTML = '@page { size: ' + pageSize + '; margin: 8mm; }';

    setTimeout(function() {
      window.print();
    }, 250);
  },

  /* ══ ذخیره مستقیم فاکتور به صورت PDF ══ */
  exportPDF: async function() {
    var v = this._currentInvoice;
    if (!v) return;
    var paperEl = document.getElementById('invPaperSheet');
    if (!paperEl) {
      UI.toast('برگه فاکتور پیدا نشد', 'e');
      return;
    }
    if (typeof html2canvas === 'undefined') {
      UI.toast('کتابخانه در حال بارگذاری است. لطفاً کمی بعد امتحان کنید.', 'e');
      return;
    }
    var jsPdfCtor = (window.jspdf && window.jspdf.jsPDF) || window.jsPDF;
    if (!jsPdfCtor) {
      UI.toast('کتابخانه ساخت PDF در دسترس نیست. می‌توانید از دکمه چاپ و ذخیره PDF مرورگر استفاده کنید.', 'e');
      return;
    }
    UI.toast('در حال ساخت فایل PDF با کیفیت بالا...', 'i');
    try {
      var opts = this._currentPrintOpts || {};
      var isA5 = opts.size === 'a5';
      var isLand = opts.orientation === 'landscape';

      var canvas = await html2canvas(paperEl, {
        scale: 2,
        useCORS: true,
        backgroundColor: '#ffffff',
        logging: false,
        onclone: function(clonedDoc) {
          var el = clonedDoc.getElementById('invPaperSheet');
          if (el) {
            el.style.transform = 'none';
            el.style.boxShadow = 'none';
            el.style.margin = '0';
          }
        }
      });

      var imgData = canvas.toDataURL('image/jpeg', 0.95);
      var pdf = new jsPdfCtor({
        orientation: isLand ? 'landscape' : 'portrait',
        unit: 'mm',
        format: isA5 ? 'a5' : 'a4'
      });

      var pageWidth = isLand ? (isA5 ? 210 : 297) : (isA5 ? 148 : 210);
      var pageHeight = isLand ? (isA5 ? 148 : 210) : (isA5 ? 210 : 297);

      var imgWidth = pageWidth;
      var imgHeight = (canvas.height * imgWidth) / canvas.width;
      if (imgHeight > pageHeight) {
        imgHeight = pageHeight;
        imgWidth = (canvas.width * imgHeight) / canvas.height;
      }
      var posX = (pageWidth - imgWidth) / 2;
      var posY = 0;

      pdf.addImage(imgData, 'JPEG', posX, posY, imgWidth, imgHeight);
      var typeName = v.type === 'sale' ? 'فروش' : (v.type === 'purchase' ? 'خرید' : 'پیش‌فاکتور');
      var fileName = 'فاکتور-' + typeName + '-' + (v.invoiceNumber || v.id) + '.pdf';
      pdf.save(fileName);
      UI.toast('فایل PDF با موفقیت ذخیره شد', 's');
    } catch (err) {
      console.error('PDF Export Error:', err);
      UI.toast('خطا در تولید PDF: ' + (err.message || 'نامشخص'), 'e');
    }
  },

  /* ══ ذخیره مستقیم فاکتور به صورت عکس JPEG باکیفیت ══ */
  exportJPEG: async function() {
    var v = this._currentInvoice;
    if (!v) return;
    var paperEl = document.getElementById('invPaperSheet');
    if (!paperEl) {
      UI.toast('برگه فاکتور پیدا نشد', 'e');
      return;
    }
    if (typeof html2canvas === 'undefined') {
      UI.toast('کتابخانه ساخت تصویر در حال بارگذاری است. لطفاً چند لحظه دیگر امتحان کنید.', 'e');
      return;
    }
    UI.toast('در حال ساخت عکس با وضوح بالا (JPEG)...', 'i');
    try {
      var canvas = await html2canvas(paperEl, {
        scale: 2,
        useCORS: true,
        backgroundColor: '#ffffff',
        logging: false,
        onclone: function(clonedDoc) {
          var el = clonedDoc.getElementById('invPaperSheet');
          if (el) {
            el.style.transform = 'none';
            el.style.boxShadow = 'none';
            el.style.margin = '0';
          }
        }
      });

      var dataUrl = canvas.toDataURL('image/jpeg', 0.95);
      var typeName = v.type === 'sale' ? 'فروش' : (v.type === 'purchase' ? 'خرید' : 'پیش‌فاکتور');
      var fileName = 'فاکتور-' + typeName + '-' + (v.invoiceNumber || v.id) + '.jpeg';

      var link = document.createElement('a');
      link.download = fileName;
      link.href = dataUrl;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      UI.toast('تصویر JPEG فاکتور با موفقیت ذخیره شد', 's');
    } catch (err) {
      console.error('JPEG Export Error:', err);
      UI.toast('خطا در ذخیره تصویر: ' + (err.message || 'نامشخص'), 'e');
    }
  },

  rm: async function(id, type) {
    /* سطح دسترسی */
    if (!Perm.require('delete', 'حذف')) return;
    var pays = await DB.all('payments');
    var linked = pays.filter(function(p) {
      return p.sourceInvoiceId === id;
    });
    var msg = 'این فاکتور حذف شود؟ موجودی انبار هم اصلاح می‌شود.';
    if (linked.length) msg += '\nسند دریافت/پرداخت خودکار مربوط به آن هم حذف می‌شود.';
    if (!await UI.confirm(msg)) return;
    await this.removeAutoPayment(id);
    await DB.del('invoices', id);
    UI.toast('فاکتور حذف شد');
    await this.ll(type);
  }
};
