/* ══ INVOICES ══ */
var Inv = {
  items: [],
  prodMap: {},
  prodOpts: '',
  contactBal: async function(cid) {
    var bal = await getOpenBal(cid);
    var invs = await FY.byYear('invoices');
    var pays = await FY.byYear('payments');
    var chks = await FY.byYear('checks');
    invs.forEach(function(inv) {
      if (inv.type === 'proforma') return;
      if (inv.contactId === cid) {
        bal += inv.type === 'sale' ? inv.grandTotal : -inv.grandTotal;
        if (inv.type === 'sale' && inv.paidAmount) bal -= inv.paidAmount;
        if (inv.type === 'purchase' && inv.paidAmount) bal += inv.paidAmount;
      }
      if (inv.brokerId === cid && inv.brokerCommission) bal -= inv.brokerCommission;
    });
    /* اصلاح باگ: این بلوک قبلاً به آرایه تعریف‌نشده txs push می‌کرد
       (کپی‌شده از دفتر معین) و باعث ReferenceError می‌شد؛ بنابراین مانده
       هر شخصی که حتی یک دریافت/پرداخت داشت قابل محاسبه نبود. */
    pays.forEach(function(pay) {
      if (pay.contactId !== cid) return;
      if (pay.type === 'receipt') bal -= pay.amount || 0;
      else bal += pay.amount || 0;
    });
    chks.forEach(function(chk) {
      if (chk.contactId === cid && chk.status !== 'returned') {
        if (chk.type === 'received') bal -= chk.amount;
        if (chk.type === 'issued') bal += chk.amount;
      }
      if (chk.status === 'transferred' && chk.transferToId === cid) bal += chk.amount;
    });
    return bal;
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
      r += '<tr><td>' + (((pg.page - 1) * pg.per) + i + 1) + '</td><td>' + esc(v.invoiceNumber || '—') + '</td><td>' + v.date + '</td><td>' + esc(cm[v.contactId] || '—') + '</td><td>' + UI.fn(v.subtotal) + '</td><td>' + UI.fn(v.shippingCost || 0) + '</td><td>' + UI.fn(v.discount || 0) + '</td><td style="font-weight:700">' + UI.fn(v.grandTotal) + '</td><td>' + UI.fn(v.paidAmount) + '</td><td style="color:' + (rm > 0 ? 'var(--d)' : 'var(--ok)') + ';font-weight:700">' + UI.fn(rm) + '</td><td><span class="tg ' + sg + '">' + sl + '</span></td><td style="white-space:nowrap"><button class="bi2" onclick="Inv.vw(' + v.id + ')"><i class="bi bi-eye"></i></button> <button class="bi2" onclick="Inv.pr(' + v.id + ',\'a4\')"><span style="font-size:.6rem;font-weight:800">A4</span></button> <button class="bi2" onclick="Inv.pr(' + v.id + ',\'a5\')"><span style="font-size:.6rem;font-weight:800">A5</span></button> <button class="bi2" onclick="Inv.showF(\'' + type + '\',' + v.id + ')"><i class="bi bi-pencil"></i></button> <button class="bi2 d" onclick="Inv.rm(' + v.id + ',\'' + type + '\')"><i class="bi bi-trash3"></i></button></td></tr>';
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
    this.prodOpts = '';
    pr.forEach(function(p) {
      Inv.prodOpts += '<option value="' + p.id + '">' + esc(p.name) + (p.colorCatalog ? ' (' + esc(p.colorCatalog) + ')' : '') + '</option>';
    });
    var rc = ct.filter(function(c) {
      if (isP) return c.type === 'customer' || c.type === 'both';
      return isS ? (c.type === 'customer' || c.type === 'both') : (c.type === 'supplier' || c.type === 'both');
    });
    var bk = ct.filter(function(c) {
      return c.type === 'broker';
    });
    var cO = '<option value="">— انتخاب —</option>';
    rc.forEach(function(c) {
      cO += '<option value="' + c.id + '"' + (inv && inv.contactId === c.id ? ' selected' : '') + '>' + esc(c.name) + '</option>';
    });
    var bO = '<option value="">— بدون —</option>';
    bk.forEach(function(c) {
      bO += '<option value="' + c.id + '"' + (inv && inv.brokerId === c.id ? ' selected' : '') + '>' + esc(c.name) + '</option>';
    });
    this._type = type;
    this.items = inv ? JSON.parse(JSON.stringify(inv.items || [])) : [];
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
    UI.open(ft, h, '<button class="btn bp" onclick="Inv.save(\'' + type + '\',' + (id || 'null') + ')">' + (inv ? 'ذخیره' : 'ثبت') + '</button>' + (inv ? '<button class="btn bg" onclick="Inv.pr(' + inv.id + ',document.getElementById(\'iPrt\').value)"><i class="bi bi-printer"></i>پرینت</button>' : '') + '<button class="btn bo" onclick="UI.close()">انصراف</button>', true);
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
    el.innerHTML = '<i class="bi bi-info-circle" style="margin-left:4px"></i>مانده حساب: <strong style="color:' + color + '">' + UI.fn(Math.abs(bal)) + ' ' + label + '</strong>';
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
    var opts = this.prodOpts;
    var isSale = (this._type === 'sale' || this._type === 'proforma');
    var h = '<table class="inv-tbl"><thead><tr><th style="width:30px">#</th><th>کالا</th><th style="width:90px">کالیته</th><th style="width:80px">شید</th><th style="width:70px">تعداد</th>';
    if (isSale) h += '<th style="width:80px">ق.خرید</th>';
    h += '<th style="width:100px">قیمت</th><th style="width:90px">جمع</th><th style="width:30px"></th></tr></thead><tbody>';
    for (var i = 0; i < this.items.length; i++) {
      var it = this.items[i];
      var sel = it.productId ? opts.replace('value="' + it.productId + '"', 'value="' + it.productId + '" selected') : opts;
      h += '<tr><td>' + (i + 1) + '</td><td><select onchange="Inv.oc(' + i + ',\'p\',this.value)"><option value="">—</option>' + sel + '</select></td>';
      h += '<td><input id="cat' + i + '" type="text" value="' + esc(it.catalog || '') + '" oninput="Inv.oc(' + i + ',\'cat\',this.value)" style="text-align:center;font-size:.8rem"></td>';
      h += '<td><input id="sh' + i + '" type="text" value="' + esc(it.shade || '') + '" oninput="Inv.oc(' + i + ',\'sh\',this.value)" style="text-align:center;font-size:.8rem"></td>';
      h += '<td><input type="number" value="' + (it.quantity || '') + '" oninput="Inv.oc(' + i + ',\'q\',this.value)" style="text-align:center"></td>';
      if (isSale) h += '<td><input type="number" value="' + (it.buyPrice || '') + '" oninput="Inv.oc(' + i + ',\'bp\',this.value)" style="text-align:center"></td>';
      h += '<td><input type="number" value="' + (it.unitPrice || '') + '" oninput="Inv.oc(' + i + ',\'u\',this.value)" style="text-align:center"></td>';
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

    /* هشدار فروش بیش از موجودی — جلوی ثبت را نمی‌گیرد ولی خبر می‌دهد */
    if (isS) {
      var warn = [];
      for (var si = 0; si < this.items.length; si++) {
        var itm = this.items[si];
        var cur = await Prod.stock(itm.productId, id);
        if (cur - itm.quantity < 0) {
          warn.push((pm[itm.productId] || '—') + ' (موجودی: ' + UI.fn(cur) + ')');
        }
      }
      if (warn.length && !await UI.confirm('موجودی این کالاها کافی نیست و منفی می‌شود:\n' +
          warn.join('، ') + '\n\nبا این حال ثبت شود؟')) return;
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
    if (id) {
      var ex = await DB.get('invoices', id);
      Object.assign(ex, d);
      await DB.put('invoices', ex);
      UI.toast('ویرایش شد');
    } else {
      await DB.add('invoices', d);
      UI.toast('ثبت شد');
    }
    UI.close();
    await this.ll(type);
  },

  /* ══ سازنده مشترک HTML فاکتور ══
     قبلاً دو تابع vw (پیش‌نمایش) و pr (چاپ) حدود ۶۰ خط HTML یکسان را
     تکرار می‌کردند و هر تغییر باید در دو جا اعمال می‌شد. اکنون یک
     سازنده مشترک با پارامتر اندازه (a4/a5) وجود دارد. */
  _html: async function(v, sz) {
    var ct = await DB.all('contacts'),
      cm = {};
    ct.forEach(function(c) {
      cm[c.id] = c.name;
    });
    var a5 = sz === 'a5';
    var isS = v.type === 'sale';
    var isPf = v.type === 'proforma';
    var items = v.items || [];
    var rm = numOf(v.grandTotal) - numOf(v.paidAmount);
    var cBal = isPf ? 0 : await this.contactBal(v.contactId);
    var custName = cm[v.contactId] || '—';
    var headTitle = isPf ? 'پیش فاکتور فروش' : (isS ? 'صورتحساب فروش' : 'صورتحساب خرید');
    var personLabel = isS || isPf ? 'مشتری:' : 'تأمین‌کننده:';
    var pd = a5 ? '8mm' : '12mm';
    var fs = a5 ? '9.5px' : '11px';
    var bd = 'border:1px solid #ccc;padding:3px 6px;';
    var th = 'border:1px solid #ccc;padding:4px 6px;background:#f0f0f0;text-align:center;white-space:nowrap;';
    var r = '';
    items.forEach(function(it, i) {
      r += '<tr style="white-space:nowrap">' +
        '<td style="' + bd + 'text-align:center">' + UI.fn(i + 1) + '</td>' +
        '<td style="' + bd + 'white-space:nowrap">' + esc(it.productName || '—') + '</td>' +
        '<td style="' + bd + 'text-align:center">' + esc(it.catalog || '—') + '</td>' +
        '<td style="' + bd + 'text-align:center">' + esc(it.shade || '—') + '</td>' +
        '<td style="' + bd + 'text-align:center">' + UI.fn(it.quantity) + '</td>' +
        '<td style="' + bd + 'text-align:center">' + UI.fn(it.unitPrice) + '</td>' +
        '<td style="' + bd + 'text-align:center">' + UI.fn(it.total) + '</td></tr>';
    });
    var addRow = function(lab, val, bold, color) {
      var st = (bold ? 'background:#f0f0f0;font-weight:800;' : '') + (color ? 'color:' + color + ';' : '');
      return '<tr><td style="padding:4px 10px;border:1px solid #ddd;white-space:nowrap;' + st + '">' + lab +
        '</td><td style="padding:4px 10px;border:1px solid #ddd;text-align:left;white-space:nowrap;' + st + '">' + val + '</td></tr>';
    };
    var h = '<div style="direction:rtl;font-family:Vazirmatn,sans-serif;padding:' + pd +
      ';font-size:' + fs + ';position:relative;min-height:' + (a5 ? '180mm' : '250mm') + ';background:#fff">';
    h += '<div style="text-align:center;border-bottom:2.5px double #000;padding-bottom:10px;margin-bottom:14px">' +
      '<h1 style="font-size:' + (a5 ? '15px' : '20px') + ';margin:0;font-weight:800">' + headTitle + '</h1>' +
      '<div style="font-size:11px;color:#555;margin-top:2px">پارچه‌بان</div>' +
      '<div style="display:flex;justify-content:space-between;margin-top:8px;font-size:10px;color:#444">' +
      '<div>شماره: <strong>' + esc(v.invoiceNumber) + '</strong></div><div>تاریخ: ' + esc(v.date) + '</div></div></div>';
    h += '<div style="margin-bottom:14px;padding:8px 12px;border:1px solid #ddd;border-radius:6px;font-size:10px;background:#fafafa">' +
      '<strong>' + personLabel + '</strong> ' + esc(custName) + '</div>';
    h += '<table style="width:100%;border-collapse:collapse;margin-bottom:14px;font-size:' + (a5 ? '8.5px' : '10px') +
      '"><thead><tr><th style="' + th + 'width:25px">#</th><th style="' + th + '">شرح کالا</th>' +
      '<th style="' + th + 'width:65px">کالیته</th><th style="' + th + 'width:55px">شید</th>' +
      '<th style="' + th + 'width:45px">تعداد</th><th style="' + th + 'width:70px">فی</th>' +
      '<th style="' + th + 'width:80px">جمع</th></tr></thead><tbody>' + r + '</tbody></table>';
    h += '<div style="display:flex;justify-content:flex-end;margin-bottom:16px">' +
      '<table style="border-collapse:collapse;font-size:' + (a5 ? '8px' : '9.5px') + ';width:auto">' +
      addRow('جمع اقلام', UI.fn(v.subtotal) + ' ریال', false);
    if (v.shippingCost) h += addRow('حمل', UI.fn(v.shippingCost) + ' ریال', false);
    if (v.discount) h += addRow('تخفیف', '−' + UI.fn(v.discount) + ' ریال', false, '#16a34a');
    h += addRow('مبلغ قابل پرداخت', UI.fn(v.grandTotal) + ' ریال', true);
    if (v.paidAmount && !isPf) h += addRow('پرداخت شده', UI.fn(v.paidAmount) + ' ریال', false, '#16a34a');
    if (rm > 0 && !isPf) h += addRow('مانده این فاکتور', UI.fn(rm) + ' ریال', false, '#dc2626');
    if (!isPf && Math.abs(cBal) > 0) h += addRow('مانده حساب کل', UI.fn(Math.abs(cBal)) + ' ریال', true, '#dc2626');
    h += '</table></div>';
    h += '<div style="margin-bottom:16px;padding:6px 10px;border:1px dashed #bbb;border-radius:6px;font-size:9px;background:#fafafa;line-height:1.8">' +
      '<div><strong>مبلغ کل:</strong> ' + esc(num2fa(v.grandTotal)) + '</div>';
    if (!isPf && Math.abs(cBal) > 0) h += '<div><strong>مانده حساب کل:</strong> ' + esc(num2fa(Math.abs(cBal))) + '</div>';
    h += '</div>';
    if (v.notes) h += '<div style="margin-bottom:14px;font-size:10px"><strong>توضیحات:</strong> ' + esc(v.notes) + '</div>';
    h += '<div style="position:absolute;bottom:' + pd + ';left:' + pd + ';right:' + pd +
      ';display:flex;justify-content:space-between;padding-top:10px;border-top:1px solid #ccc">' +
      '<div style="width:160px;text-align:center;font-size:9px;padding-top:20px;border-top:1px solid #999">مهر و امضای ' +
      (isS ? 'فروشنده' : 'خریدار') + '</div>' +
      '<div style="width:160px;text-align:center;font-size:9px;padding-top:20px;border-top:1px solid #999">مهر و امضای ' +
      (isS ? 'خریدار' : 'فروشنده') + '</div></div></div>';
    return h;
  },

  vw: async function(id) {
    var v = await DB.get('invoices', id);
    if (!v) {
      UI.toast('فاکتور یافت نشد', 'e');
      return;
    }
    var h = await this._html(v, v.printSize === 'a5' ? 'a5' : 'a4');
    UI.open('پیش‌نمایش ' + (v.invoiceNumber || ''), h,
      '<button class="btn bp" onclick="Inv.pr(' + v.id + ',\'a4\')">چاپ A4</button>' +
      '<button class="btn bw" onclick="Inv.pr(' + v.id + ',\'a5\')">چاپ A5</button>' +
      '<button class="btn bo" onclick="UI.close()">بستن</button>', true);
  },

  pr: async function(id, sz) {
    var v = await DB.get('invoices', id);
    if (!v) {
      UI.toast('فاکتور یافت نشد', 'e');
      return;
    }
    var area = document.getElementById('printArea');
    if (!area) return;
    area.innerHTML = await this._html(v, sz === 'a5' ? 'a5' : 'a4');
    setTimeout(function() {
      window.print();
    }, 300);
  },

  rm: async function(id, type) {
    if (!await UI.confirm('این فاکتور حذف شود؟ موجودی انبار هم اصلاح می‌شود.')) return;
    await DB.del('invoices', id);
    await this.ll(type);
  }
};
