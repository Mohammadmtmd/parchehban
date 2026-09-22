/* ══════════════════════════════════════════════════════════════
   RAS-GIRI (راس‌گیری چک و واریزی‌ها)
   محاسبه دقیق راس زمانی (میانگین وزنی سررسید) برای چک‌ها و پرداخت/دریافت‌ها
   با امکان ورود دستی یا انتخاب مستقیم از اسناد سیستم و چاپ گزارش رسمی
   ══════════════════════════════════════════════════════════════ */

var Rasgiri = {
  _mode: 'manual', // 'manual' یا 'select'
  _type: 'all',    // 'all' | 'receipt' | 'payment'
  _baseDate: '',
  _rows: [],       // ردیف‌های فعال برای محاسبه

  render: async function() {
    currentPage = 'rasgiri';
    UI.nav('rasgiri');
    UI.title('bi-calculator', 'راس‌گیری چک و واریزی');
    UI.act(
      '<button class="btn bp bs" onclick="Rasgiri.printReport()"><i class="bi bi-printer"></i> چاپ گزارش رسمی</button> ' +
      '<button class="btn bo bs" onclick="Rasgiri.clearAll()"><i class="bi bi-arrow-counterclockwise"></i> بازنشانی</button>'
    );

    if (!this._baseDate) {
      this._baseDate = todayJ();
    }
    if (!this._rows || !this._rows.length) {
      this._rows = [
        { id: 1, title: '', amount: 0, date: todayJ() },
        { id: 2, title: '', amount: 0, date: todayJ() }
      ];
    }

    var h = '<div style="display:flex;flex-direction:column;gap:16px">';

    /* ── نوار تنظیمات و فیلترها ── */
    h += '<div class="cd">' +
      '<div class="cd-h" style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:10px">' +
      '<span><i class="bi bi-sliders"></i> تنظیمات مبنا و نحوه انتخاب داده‌ها</span>' +
      '<div style="display:flex;gap:8px;align-items:center">' +
      '<button class="btn ' + (this._mode === 'manual' ? 'bp' : 'bo') + ' bs" onclick="Rasgiri.setMode(\'manual\')"><i class="bi bi-pencil-square"></i> ورود دستی</button>' +
      '<button class="btn ' + (this._mode === 'select' ? 'bp' : 'bo') + ' bs" onclick="Rasgiri.setMode(\'select\')"><i class="bi bi-card-checklist"></i> انتخاب از اسناد سیستم</button>' +
      '</div>' +
      '</div><div class="cd-b">' +
      '<div style="display:grid;grid-template-columns:repeat(auto-fit, minmax(220px, 1fr));gap:14px;align-items:end">' +
      '<div class="fg" style="margin:0"><label>تاریخ مبنای محاسبه راس</label>' +
      '<input type="text" class="fc" id="rgBaseDate" value="' + esc(this._baseDate) + '" placeholder="1404/01/01" onchange="Rasgiri.onBaseDateChange(this.value)">' +
      '</div>' +
      '<div class="fg" style="margin:0"><label>نوع تراکنش / سند</label>' +
      '<select class="fc" id="rgTypeSel" onchange="Rasgiri.onTypeChange(this.value)">' +
      '<option value="all"' + (this._type === 'all' ? ' selected' : '') + '>تمام موارد (دریافتی و پرداختی)</option>' +
      '<option value="receipt"' + (this._type === 'receipt' ? ' selected' : '') + '>فقط دریافتی‌ها (چک‌های وارده و واریزی‌ها)</option>' +
      '<option value="payment"' + (this._type === 'payment' ? ' selected' : '') + '>فقط پرداختی‌ها (چک‌های صادره و برداشت‌ها)</option>' +
      '</select>' +
      '</div>' +
      '<div style="display:flex;gap:8px;align-items:center">' +
      '<button class="btn bo" onclick="Rasgiri.setBaseDateToday()"><i class="bi bi-calendar-event"></i> تاریخ امروز</button>' +
      (this._mode === 'select' ? '<button class="btn bg" onclick="Rasgiri.openSelectModal()"><i class="bi bi-plus-circle"></i> انتخاب چک و واریزی</button>' : '') +
      '</div>' +
      '</div>' +
      '</div></div>';

    /* ── کارت نتیجه راس‌گیری ── */
    var res = this.calculate();
    h += '<div class="cd" style="background:linear-gradient(to bottom, var(--sf), var(--bg))">' +
      '<div class="cd-b" style="padding:16px 20px">' +
      '<div style="display:grid;grid-template-columns:repeat(auto-fit, minmax(180px, 1fr));gap:16px;text-align:center">' +
      '<div style="padding:10px;border-radius:10px;background:var(--sf);border:1px solid var(--bd)">' +
      '<small style="color:var(--txs);display:block;margin-bottom:6px">جمع کل مبالغ</small>' +
      '<span style="font-size:1.25rem;font-weight:800;color:var(--tx)">' + UI.fn(res.totalAmount) + '</span>' +
      '<small style="margin-inline-start:4px;color:var(--txs);font-size:.72rem">ریال</small>' +
      '</div>' +
      '<div style="padding:10px;border-radius:10px;background:var(--sf);border:1px solid var(--bd)">' +
      '<small style="color:var(--txs);display:block;margin-bottom:6px">تعداد ردیف‌ها</small>' +
      '<span style="font-size:1.25rem;font-weight:800;color:var(--tx)">' + UI.fn(res.count) + '</span>' +
      '<small style="margin-inline-start:4px;color:var(--txs);font-size:.72rem">فقره</small>' +
      '</div>' +
      '<div style="padding:10px;border-radius:10px;background:var(--sf);border:1px solid var(--bd)">' +
      '<small style="color:var(--txs);display:block;margin-bottom:6px">فاصله زمانی تا راس</small>' +
      '<span style="font-size:1.25rem;font-weight:800;color:var(--p)">' + (res.valid ? UI.fn(res.avgDays) : '—') + '</span>' +
      '<small style="margin-inline-start:4px;color:var(--p);font-size:.72rem">روز ' + (res.avgDays >= 0 ? 'آینده' : 'گذشته') + '</small>' +
      '</div>' +
      '<div style="padding:10px;border-radius:10px;background:var(--sf);border:1px solid var(--bd);border-color:rgba(37,99,235,0.3)">' +
      '<small style="color:var(--txs);display:block;margin-bottom:6px">تاریخ دقیق راس</small>' +
      '<span style="font-size:1.25rem;font-weight:800;color:var(--ok)">' + (res.valid ? esc(res.rasDate) : '—') + '</span>' +
      '</div>' +
      '</div>' +
      '</div></div>';

    /* ── جدول اقلام محاسبه راس‌گیری ── */
    h += '<div class="cd">' +
      '<div class="cd-h" style="display:flex;justify-content:space-between;align-items:center">' +
      '<span><i class="bi bi-table"></i> فهرست اقلام مورد محاسبه در راس</span>' +
      '<div style="display:flex;gap:6px">' +
      (this._mode === 'manual' ? '<button class="btn bp bs" onclick="Rasgiri.addRow()"><i class="bi bi-plus-lg"></i> افزودن ردیف</button>' : '') +
      '</div>' +
      '</div><div class="cd-b" style="padding:0">' +
      '<div class="tw">' +
      '<table style="width:100%;margin:0"><thead><tr>' +
      '<th style="width:38px;text-align:center">#</th>' +
      '<th>شرح / شماره چک / طرف حساب</th>' +
      '<th style="width:180px;text-align:right">مبلغ (ریال)</th>' +
      '<th style="width:140px;text-align:center">تاریخ سررسید / پرداخت</th>' +
      '<th style="width:100px;text-align:center">اختلاف روز</th>' +
      '<th style="width:170px;text-align:right">حاصلضرب (روز × مبلغ)</th>' +
      '<th style="width:50px;text-align:center">عملیات</th>' +
      '</tr></thead><tbody>';

    if (!this._rows || !this._rows.length) {
      h += '<tr><td colspan="7" style="text-align:center;color:var(--txs);padding:30px">ردیفی برای محاسبه ثبت نشده است. از دکمه «افزودن ردیف» یا «انتخاب از اسناد» استفاده کنید.</td></tr>';
    } else {
      for (var i = 0; i < this._rows.length; i++) {
        var row = this._rows[i];
        var days = this._calcDiff(this._baseDate, row.date);
        var product = (row.amount || 0) * (days !== null ? days : 0);

        h += '<tr>' +
          '<td style="text-align:center;color:var(--txs)">' + (i + 1) + '</td>';

        if (this._mode === 'manual') {
          h += '<td><input type="text" class="fc" style="padding:6px 9px;font-size:.82rem" value="' + esc(row.title || '') + '" placeholder="مثال: چک صیادی / فاکتور" onchange="Rasgiri.updateRow(' + i + ', \'title\', this.value)"></td>' +
            '<td><input type="text" class="fc" style="padding:6px 9px;font-size:.82rem;font-weight:700;direction:ltr;text-align:right" value="' + (row.amount ? UI.fn(row.amount) : '') + '" placeholder="0" oninput="this.value=UI.fmtInput(this.value)" onchange="Rasgiri.updateRow(' + i + ', \'amount\', this.value)"></td>' +
            '<td><input type="text" class="fc" style="padding:6px 9px;font-size:.82rem;direction:ltr;text-align:center" value="' + esc(row.date || '') + '" placeholder="1404/01/01" onchange="Rasgiri.updateRow(' + i + ', \'date\', this.value)"></td>';
        } else {
          h += '<td><strong>' + esc(row.title || 'سند') + '</strong>' + (row.sub ? '<br><small style="color:var(--txs)">' + esc(row.sub) + '</small>' : '') + '</td>' +
            '<td style="font-weight:700;direction:ltr;text-align:right">' + UI.fn(row.amount) + '</td>' +
            '<td style="text-align:center;direction:ltr">' + esc(row.date) + '</td>';
        }

        h += '<td style="text-align:center;font-weight:700;' + (days !== null && days < 0 ? 'color:var(--d)' : 'color:var(--p)') + '">' +
          (days !== null ? UI.fn(days) : '—') + '</td>' +
          '<td style="direction:ltr;text-align:right;color:var(--txs);font-size:.8rem">' + UI.fn(product) + '</td>' +
          '<td style="text-align:center">' +
          '<button class="bi2 d" title="حذف ردیف" onclick="Rasgiri.removeRow(' + i + ')"><i class="bi bi-trash"></i></button>' +
          '</td></tr>';
      }
    }

    h += '</tbody><tfoot><tr style="background:var(--bg);font-weight:800">' +
      '<td colspan="2" style="padding:10px 14px;text-align:right">حاصل جمع مبالغ:</td>' +
      '<td style="padding:10px 14px;direction:ltr;text-align:right;color:var(--ok);font-size:.95rem">' + UI.fn(res.totalAmount) + ' ریال</td>' +
      '<td colspan="2" style="padding:10px 14px;text-align:center">تاریخ راس: <span style="color:var(--p)">' + (res.valid ? esc(res.rasDate) : '—') + '</span></td>' +
      '<td style="padding:10px 14px;direction:ltr;text-align:right">' + UI.fn(res.totalProduct) + '</td>' +
      '<td></td>' +
      '</tr></tfoot></table>' +
      '</div></div></div>';

    h += '</div>';

    UI.content(h);
  },

  setMode: function(m) {
    this._mode = m;
    this.render();
  },

  onTypeChange: function(t) {
    this._type = t;
    if (this._mode === 'select') {
      this.openSelectModal();
    } else {
      this.render();
    }
  },

  onBaseDateChange: function(val) {
    var p = Jalali.parse(val);
    if (p) {
      this._baseDate = p;
    } else {
      UI.toast('قالب تاریخ نامعتبر است (مثال: 1404/01/01)', 'e');
    }
    this.render();
  },

  setBaseDateToday: function() {
    this._baseDate = todayJ();
    this.render();
  },

  addRow: function() {
    this._rows.push({
      id: Date.now(),
      title: '',
      amount: 0,
      date: this._baseDate || todayJ()
    });
    this.render();
  },

  removeRow: function(idx) {
    this._rows.splice(idx, 1);
    this.render();
  },

  updateRow: function(idx, field, val) {
    if (!this._rows[idx]) return;
    if (field === 'amount') {
      this._rows[idx].amount = numOf(val);
    } else if (field === 'date') {
      var p = Jalali.parse(val);
      if (p) {
        this._rows[idx].date = p;
      } else {
        UI.toast('قالب تاریخ نامعتبر است', 'e');
      }
    } else {
      this._rows[idx][field] = val;
    }
    this.render();
  },

  clearAll: function() {
    this._rows = [
      { id: 1, title: '', amount: 0, date: this._baseDate || todayJ() },
      { id: 2, title: '', amount: 0, date: this._baseDate || todayJ() }
    ];
    this.render();
  },

  _calcDiff: function(baseDate, targetDate) {
    if (!baseDate || !targetDate) return null;
    var b = Jalali.parse(baseDate);
    var t = Jalali.parse(targetDate);
    if (!b || !t) return null;
    var bp = b.split('/').map(Number);
    var tp = t.split('/').map(Number);
    var bJdn = Jalali.toJDN(bp[0], bp[1], bp[2]);
    var tJdn = Jalali.toJDN(tp[0], tp[1], tp[2]);
    return tJdn - bJdn;
  },

  calculate: function() {
    var totalAmount = 0;
    var totalProduct = 0;
    var validCount = 0;

    for (var i = 0; i < this._rows.length; i++) {
      var r = this._rows[i];
      var amt = numOf(r.amount);
      if (amt <= 0) continue;
      var diff = this._calcDiff(this._baseDate, r.date);
      if (diff === null) continue;
      totalAmount += amt;
      totalProduct += (amt * diff);
      validCount++;
    }

    if (totalAmount <= 0 || validCount === 0) {
      return {
        valid: false,
        totalAmount: totalAmount,
        totalProduct: 0,
        avgDays: 0,
        rasDate: '—',
        count: validCount
      };
    }

    var avgDays = Math.round(totalProduct / totalAmount);
    var rasDate = Jalali.addDays(this._baseDate, avgDays);

    return {
      valid: true,
      totalAmount: totalAmount,
      totalProduct: totalProduct,
      avgDays: avgDays,
      rasDate: rasDate,
      count: validCount
    };
  },

  /* ── پنجره انتخاب چک‌ها و پرداخت/دریافت‌ها ── */
  openSelectModal: async function() {
    var checks = await FY.byYear('checks');
    var payments = await FY.byYear('payments');
    var contacts = await DB.all('contacts');
    var cMap = {};
    contacts.forEach(function(c) { cMap[c.id] = c.name; });

    var items = [];

    /* فیلتر نوع: دریافتی / پرداختی */
    var wantReceipt = (this._type === 'all' || this._type === 'receipt');
    var wantPayment = (this._type === 'all' || this._type === 'payment');

    /* چک‌ها */
    checks.forEach(function(c) {
      var isRec = (c.type === 'received');
      if (isRec && !wantReceipt) return;
      if (!isRec && !wantPayment) return;
      var pers = cMap[c.contactId] || '—';
      items.push({
        source: 'check',
        id: c.id,
        title: (isRec ? 'چک دریافتی' : 'چک پرداختی') + ' شماره ' + (c.checkNumber || c.docNumber || '—'),
        sub: pers + (c.bankName ? ' — ' + c.bankName : ''),
        amount: numOf(c.amount),
        date: c.dueDate || c.issueDate || todayJ(),
        type: isRec ? 'receipt' : 'payment'
      });
    });

    /* دریافت/پرداخت‌ها */
    payments.forEach(function(p) {
      var isRec = (p.type === 'receipt');
      if (isRec && !wantReceipt) return;
      if (!isRec && !wantPayment) return;
      var pers = cMap[p.contactId] || '—';
      items.push({
        source: 'payment',
        id: p.id,
        title: (isRec ? 'واریزی / دریافت نقدی' : 'پرداخت / حواله') + (p.description ? ' (' + p.description + ')' : ''),
        sub: pers,
        amount: numOf(p.amount),
        date: p.date || todayJ(),
        type: isRec ? 'receipt' : 'payment'
      });
    });

    items.sort(function(a, b) {
      return pn(b.date) - pn(a.date);
    });

    var body = '<div style="max-height:420px;overflow-y:auto">' +
      '<div style="margin-bottom:10px;font-size:.84rem;color:var(--txs)">اسناد مورد نظر خود را برای راس‌گیری تیک بزنید:</div>' +
      '<table style="width:100%;font-size:.82rem"><thead><tr>' +
      '<th style="width:35px;text-align:center"><input type="checkbox" id="rgSelAll" onchange="Rasgiri.toggleAllModal(this)"></th>' +
      '<th>عنوان سند</th>' +
      '<th style="width:120px;text-align:center">سررسید / تاریخ</th>' +
      '<th style="width:120px;text-align:right">مبلغ (ریال)</th>' +
      '</tr></thead><tbody>';

    if (!items.length) {
      body += '<tr><td colspan="4" style="text-align:center;padding:20px;color:var(--txs)">هیچ سند مالی یا چکی در این سال مالی مطابق با فیلتر یافت نشد.</td></tr>';
    } else {
      for (var i = 0; i < items.length; i++) {
        var it = items[i];
        body += '<tr>' +
          '<td style="text-align:center"><input type="checkbox" class="rg-chk-item" data-idx="' + i + '"></td>' +
          '<td><strong>' + esc(it.title) + '</strong><br><small style="color:var(--txs)">' + esc(it.sub) + '</small></td>' +
          '<td style="text-align:center;direction:ltr">' + esc(it.date) + '</td>' +
          '<td style="text-align:right;font-weight:700;direction:ltr">' + UI.fn(it.amount) + '</td>' +
          '</tr>';
      }
    }

    body += '</tbody></table></div>';

    var foot = '<button class="btn bp" onclick="Rasgiri.importSelected()"><i class="bi bi-check2-circle"></i> افزودن موارد انتخاب‌شده به راس‌گیری</button> ' +
      '<button class="btn bo" onclick="UI.close()">انصراف</button>';

    Rasgiri._modalItems = items;
    UI.open('انتخاب چک و واریزی‌ها برای راس‌گیری', body, foot);
  },

  toggleAllModal: function(el) {
    var cbs = document.querySelectorAll('.rg-chk-item');
    cbs.forEach(function(c) { c.checked = el.checked; });
  },

  importSelected: function() {
    var cbs = document.querySelectorAll('.rg-chk-item:checked');
    if (!cbs.length) {
      UI.toast('موردی انتخاب نشده است', 'e');
      return;
    }
    var added = [];
    cbs.forEach(function(cb) {
      var idx = intOf(cb.getAttribute('data-idx'));
      var it = Rasgiri._modalItems[idx];
      if (it) {
        added.push({
          id: Date.now() + Math.random(),
          title: it.title,
          sub: it.sub,
          amount: it.amount,
          date: it.date
        });
      }
    });

    this._rows = added;
    UI.close();
    this.render();
    UI.toast(added.length + ' ردیف به فرم راس‌گیری اضافه شد.', 's');
  },

  /* ── چاپ گزارش رسمی راس‌گیری ── */
  printReport: function() {
    var res = this.calculate();
    if (!this._rows.length) {
      UI.toast('ردیفی برای چاپ وجود ندارد', 'e');
      return;
    }

    var base = this._baseDate || todayJ();
    var area = document.getElementById('printArea');
    if (!area) return;

    var rowsHtml = '';
    for (var i = 0; i < this._rows.length; i++) {
      var r = this._rows[i];
      var diff = this._calcDiff(base, r.date);
      var product = (r.amount || 0) * (diff !== null ? diff : 0);

      rowsHtml += '<tr style="border-bottom:1px solid #ddd">' +
        '<td style="border:1px solid #ccc;padding:6px;text-align:center">' + (i + 1) + '</td>' +
        '<td style="border:1px solid #ccc;padding:6px;text-align:right">' + esc(r.title || 'سند مالی') + (r.sub ? ' — ' + esc(r.sub) : '') + '</td>' +
        '<td style="border:1px solid #ccc;padding:6px;text-align:right;direction:ltr;font-weight:bold">' + UI.fn(r.amount) + '</td>' +
        '<td style="border:1px solid #ccc;padding:6px;text-align:center;direction:ltr">' + esc(r.date) + '</td>' +
        '<td style="border:1px solid #ccc;padding:6px;text-align:center;direction:ltr">' + (diff !== null ? UI.fn(diff) : '—') + '</td>' +
        '<td style="border:1px solid #ccc;padding:6px;text-align:right;direction:ltr">' + UI.fn(product) + '</td>' +
        '</tr>';
    }

    var h = '<div style="direction:rtl;font-family:Vazirmatn,sans-serif;padding:15mm;font-size:11px;background:#fff;color:#000;min-height:260mm;position:relative">' +
      '<div style="text-align:center;border-bottom:2.5px double #000;padding-bottom:12px;margin-bottom:16px">' +
      '<h1 style="font-size:20px;margin:0 0 6px 0;font-weight:800">گزارش رسمی راس‌گیری چک و اسناد مالی</h1>' +
      '<div style="font-size:12px;color:#555">سیستم حسابداری و انبارداری پارچه‌بان</div>' +
      '<div style="display:flex;justify-content:space-between;margin-top:10px;font-size:11px;color:#333">' +
      '<div>تاریخ تنظیم گزارش: <strong>' + todayJ() + '</strong></div>' +
      '<div>تاریخ مبنای راس‌گیری: <strong>' + esc(base) + '</strong></div>' +
      '<div>تعداد اقلام: <strong>' + UI.fn(res.count) + ' فقره</strong></div>' +
      '</div>' +
      '</div>' +

      /* جدول خلاصه راس‌گیری */
      '<div style="display:flex;justify-content:space-between;gap:12px;margin-bottom:16px;background:#f9f9f9;border:1px solid #ccc;border-radius:6px;padding:10px 14px">' +
      '<div>جمع کل مبالغ: <strong style="font-size:13px">' + UI.fn(res.totalAmount) + ' ریال</strong></div>' +
      '<div>فاصله تا راس: <strong style="font-size:13px">' + (res.valid ? UI.fn(res.avgDays) + ' روز' : '—') + '</strong></div>' +
      '<div>تاریخ دقیق راس: <strong style="font-size:14px;color:#000">' + (res.valid ? esc(res.rasDate) : '—') + '</strong></div>' +
      '</div>' +

      /* جدول اقلام */
      '<table style="width:100%;border-collapse:collapse;margin-bottom:20px;font-size:10.5px">' +
      '<thead><tr style="background:#f0f0f0">' +
      '<th style="border:1px solid #ccc;padding:6px;width:30px;text-align:center">#</th>' +
      '<th style="border:1px solid #ccc;padding:6px;text-align:right">شرح سند / شماره چک / طرف حساب</th>' +
      '<th style="border:1px solid #ccc;padding:6px;width:120px;text-align:right">مبلغ (ریال)</th>' +
      '<th style="border:1px solid #ccc;padding:6px;width:95px;text-align:center">سررسید</th>' +
      '<th style="border:1px solid #ccc;padding:6px;width:70px;text-align:center">فاصله روز</th>' +
      '<th style="border:1px solid #ccc;padding:6px;width:130px;text-align:right">حاصلضرب (روز × مبلغ)</th>' +
      '</tr></thead>' +
      '<tbody>' + rowsHtml + '</tbody>' +
      '<tfoot><tr style="background:#f4f4f4;font-weight:800">' +
      '<td colspan="2" style="border:1px solid #ccc;padding:8px;text-align:right">حاصل جمع کل مبالغ:</td>' +
      '<td style="border:1px solid #ccc;padding:8px;direction:ltr;text-align:right;font-size:12px">' + UI.fn(res.totalAmount) + ' ریال</td>' +
      '<td colspan="2" style="border:1px solid #ccc;padding:8px;text-align:center">تاریخ راس: ' + (res.valid ? esc(res.rasDate) : '—') + '</td>' +
      '<td style="border:1px solid #ccc;padding:8px;direction:ltr;text-align:right">' + UI.fn(res.totalProduct) + '</td>' +
      '</tr></tfoot>' +
      '</table>' +

      /* جمع حروفی */
      '<div style="margin-bottom:24px;padding:8px 12px;border:1px dashed #999;border-radius:6px;font-size:10px;background:#fafafa">' +
      '<strong>مبلغ کل به حروف:</strong> ' + esc(num2fa(res.totalAmount)) + ' ریال' +
      '</div>' +

      /* خطوط امضا در پایین صفحه */
      '<div style="position:absolute;bottom:15mm;left:15mm;right:15mm;display:flex;justify-content:space-between;border-top:1px solid #aaa;padding-top:14px">' +
      '<div style="width:200px;text-align:center;font-size:10px">امضای تنظیم‌کننده / امور مالی<br><br><br>....................................</div>' +
      '<div style="width:200px;text-align:center;font-size:10px">تأیید مدیریت / طرف حساب<br><br><br>....................................</div>' +
      '</div>' +
      '</div>';

    area.innerHTML = h;
    setTimeout(function() {
      window.print();
    }, 300);
  }
};
