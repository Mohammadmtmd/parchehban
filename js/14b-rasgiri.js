/* ══════════════════════════════════════════════════════════════
   RAS-GIRI (راس‌گیری چک و واریزی‌ها + برنامه‌ریز معکوس چک‌ها)
   ۱) محاسبه دقیق راس زمانی (میانگین وزنی سررسید) از روی اسناد دستی یا سیستم
   ۲) برنامه‌ریزی معکوس: دریافت تاریخ مبنا، تاریخ/تعداد روز راس و مبلغ کل فاکتور
      و ارائه پیشنهادهای متنوع و قابل رفرش برای تاریخ و مبلغ چک‌ها + ثبت مستقیم
   ══════════════════════════════════════════════════════════════ */

var Rasgiri = {
  _mode: 'manual', // 'manual' | 'select' | 'suggest'
  _type: 'all',    // 'all' | 'receipt' | 'payment'
  _baseDate: '',
  _rows: [],       // ردیف‌های فعال محاسبه‌گر (manual / select)

  /* تنظیمات و خروجی بخش پیشنهاد چک از تاریخ راس (برنامه‌ریزی معکوس) */
  _planCfg: {
    totalAmount: 0,
    cashAmount: 0,
    targetMode: 'days', // 'days' | 'date'
    targetDays: 60,
    targetDate: '',
    checkCount: 3,
    roundStep: 1000000,
    avoidFriday: true,
    variant: 0,
    invoiceMeta: null
  },
  _planRows: [],
  _planMeta: null,

  _STRATEGY_META: [
    { key: 'balanced', name: 'اقساط متعادل با فواصل منظم', desc: 'مبالغ نزدیک به هم با سررسیدهای منظم در طول بازه' },
    { key: 'ascending', name: 'پلکانی صعودی (سبک در ابتدا، سنگین‌تر در انتها)', desc: 'فشار کمتر در چک‌های اول و افزایش تدریجی مبلغ' },
    { key: 'descending', name: 'پلکانی نزولی (تمرکز نقدینگی اولیه)', desc: 'دریافت بیشتر در سررسیدهای نزدیک و چک‌های سبک‌تر در پایان' },
    { key: 'calendar', name: 'سررسیدهای رُند تقویمی (مضرب ۱۵ و ۳۰ روزه)', desc: 'تاریخ‌های استاندارد ماهانه/نیم‌ماهیانه و حل دقیق مبالغ' },
    { key: 'fast_start', name: 'شروع سریع + اقساط میان‌مدت', desc: 'چک اول در سررسید نزدیک و پخش مابقی برای رسیدن به راس دقیق' },
    { key: 'pivot', name: 'چیدمان متمرکز با چک محوری', desc: 'چک اصلی نزدیک تاریخ راس به‌همراه چک‌های پشتیبان کوتاه و بلندمدت' }
  ],

  _ensurePlanDefaults: function() {
    if (!this._baseDate) this._baseDate = todayJ();
    if (!this._planCfg) {
      this._planCfg = {
        totalAmount: 0,
        cashAmount: 0,
        targetMode: 'days',
        targetDays: 60,
        targetDate: '',
        checkCount: 3,
        roundStep: 1000000,
        avoidFriday: true,
        variant: 0,
        invoiceMeta: null
      };
    }
    if (!this._planCfg.targetDate || !Jalali.parse(this._planCfg.targetDate)) {
      var td = intOf(this._planCfg.targetDays);
      this._planCfg.targetDate = Jalali.addDays(this._baseDate, td) || this._baseDate;
    }
  },

  _addDaysSafe: function(baseDate, days) {
    if (typeof Jalali !== 'undefined' && typeof Jalali.addDays === 'function') {
      return Jalali.addDays(baseDate, days);
    }
    var b = Jalali.parse(baseDate);
    if (!b || typeof Jalali.toJDN !== 'function' || typeof Jalali.fromJDN !== 'function') return baseDate;
    var p = b.split('/').map(Number);
    var r = Jalali.fromJDN(Jalali.toJDN(p[0], p[1], p[2]) + days);
    return Jalali.format(r[0], r[1], r[2]);
  },

  _dayOfWeekByOffset: function(baseDate, offsetDays) {
    var norm = Jalali.parse(baseDate);
    if (!norm || typeof Jalali.toJDN !== 'function' || typeof Jalali.jdnToDate !== 'function') return -1;
    var p = norm.split('/').map(Number);
    var jdn = Jalali.toJDN(p[0], p[1], p[2]) + offsetDays;
    return Jalali.jdnToDate(jdn).getDay(); // 5 === جمعه
  },

  _weekdayFa: function(dateStr) {
    var norm = Jalali.parse(dateStr);
    if (!norm || typeof Jalali.toJDN !== 'function' || typeof Jalali.jdnToDate !== 'function') return '';
    var p = norm.split('/').map(Number);
    var dow = Jalali.jdnToDate(Jalali.toJDN(p[0], p[1], p[2])).getDay();
    var names = ['یکشنبه', 'دوشنبه', 'سه‌شنبه', 'چهارشنبه', 'پنج‌شنبه', 'جمعه', 'شنبه'];
    return names[dow] || '';
  },

  _isFridayOffset: function(baseDate, offsetDays) {
    return this._dayOfWeekByOffset(baseDate, offsetDays) === 5;
  },

  _toEn: function(v) {
    if (typeof toEnDigits === 'function') return toEnDigits(v);
    if (v === null || v === undefined) return '';
    return String(v);
  },

  _num2fa: function(n) {
    return typeof num2fa === 'function' ? num2fa(n) : (UI.fn(n) + ' ریال');
  },

  render: async function() {
    currentPage = 'rasgiri';
    UI.nav('rasgiri');
    UI.title('bi-calculator', 'راس‌گیری چک و واریزی');

    this._ensurePlanDefaults();
    if (!this._rows || !this._rows.length) {
      this._rows = [
        { id: 1, title: '', amount: 0, date: this._baseDate },
        { id: 2, title: '', amount: 0, date: this._baseDate }
      ];
    }

    if (this._mode === 'suggest') {
      UI.act(
        '<button class="btn bp bs" onclick="Rasgiri.printPlan()"><i class="bi bi-printer"></i> چاپ برنامه چک‌ها</button> ' +
        '<button class="btn bo bs" onclick="Rasgiri.resetPlan()"><i class="bi bi-arrow-counterclockwise"></i> پاک کردن برنامه</button>'
      );
    } else {
      UI.act(
        '<button class="btn bp bs" onclick="Rasgiri.printReport()"><i class="bi bi-printer"></i> چاپ گزارش رسمی</button> ' +
        '<button class="btn bo bs" onclick="Rasgiri.clearAll()"><i class="bi bi-arrow-counterclockwise"></i> بازنشانی</button>'
      );
    }

    var h = '<div style="display:flex;flex-direction:column;gap:16px">';

    /* ── نوار انتخاب حالت و تاریخ مبنا ── */
    h += '<div class="cd">' +
      '<div class="cd-h" style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:10px">' +
      '<span><i class="bi bi-sliders"></i> تنظیمات مبنا و انتخاب ابزار راس‌گیری</span>' +
      '<div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">' +
      '<button class="btn ' + (this._mode === 'manual' ? 'bp' : 'bo') + ' bs" onclick="Rasgiri.setMode(\'manual\')"><i class="bi bi-pencil-square"></i> ورود دستی</button>' +
      '<button class="btn ' + (this._mode === 'select' ? 'bp' : 'bo') + ' bs" onclick="Rasgiri.setMode(\'select\')"><i class="bi bi-card-checklist"></i> انتخاب از اسناد سیستم</button>' +
      '<button class="btn ' + (this._mode === 'suggest' ? 'bp' : 'bo') + ' bs" onclick="Rasgiri.setMode(\'suggest\')"><i class="bi bi-magic"></i> پیشنهاد چک از تاریخ راس</button>' +
      '</div>' +
      '</div><div class="cd-b">' +
      '<div style="display:grid;grid-template-columns:repeat(auto-fit, minmax(220px, 1fr));gap:14px;align-items:end">' +
      '<div class="fg" style="margin:0"><label>تاریخ مبنای محاسبه راس</label>' +
      '<input type="text" class="fc" id="rgBaseDate" dir="ltr" data-date="1" maxlength="10" value="' + esc(this._baseDate) + '" placeholder="1404/01/01" onchange="Rasgiri.onBaseDateChange(this.value)">' +
      '</div>';

    if (this._mode !== 'suggest') {
      h += '<div class="fg" style="margin:0"><label>نوع تراکنش / سند</label>' +
        '<select class="fc" id="rgTypeSel" onchange="Rasgiri.onTypeChange(this.value)">' +
        '<option value="all"' + (this._type === 'all' ? ' selected' : '') + '>تمام موارد (دریافتی و پرداختی)</option>' +
        '<option value="receipt"' + (this._type === 'receipt' ? ' selected' : '') + '>فقط دریافتی‌ها (چک‌های وارده و واریزی‌ها)</option>' +
        '<option value="payment"' + (this._type === 'payment' ? ' selected' : '') + '>فقط پرداختی‌ها (چک‌های صادره و برداشت‌ها)</option>' +
        '</select>' +
        '</div>' +
        '<div style="display:flex;gap:8px;align-items:center">' +
        '<button class="btn bo" onclick="Rasgiri.setBaseDateToday()"><i class="bi bi-calendar-event"></i> تاریخ امروز</button>' +
        (this._mode === 'select' ? '<button class="btn bg" onclick="Rasgiri.openSelectModal()"><i class="bi bi-plus-circle"></i> انتخاب چک و واریزی</button>' : '') +
        '</div>';
    } else {
      h += '<div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">' +
        '<button class="btn bo" onclick="Rasgiri.setBaseDateToday()"><i class="bi bi-calendar-event"></i> تاریخ امروز</button>' +
        '<button class="btn bg" onclick="Rasgiri.openInvoicePickModal()"><i class="bi bi-receipt-cutoff"></i> انتخاب از فاکتورها</button>' +
        '</div>';
      if (this._planCfg.invoiceMeta) {
        var im = this._planCfg.invoiceMeta;
        h += '<div style="font-size:.8rem;background:rgba(37,99,235,.06);border:1px solid rgba(37,99,235,.25);border-radius:8px;padding:8px 12px;display:flex;justify-content:space-between;align-items:center;gap:8px">' +
          '<span><i class="bi bi-link-45deg"></i> فاکتور متصل: <strong>' + esc(im.invoiceNumber) + '</strong> (' + (im.invoiceType === 'sale' ? 'فروش' : 'خرید') + ')</span>' +
          '<button type="button" class="bi2" title="لغو اتصال فاکتور" onclick="Rasgiri.clearInvoiceMeta()"><i class="bi bi-x-lg"></i></button>' +
          '</div>';
      }
    }

    h += '</div></div></div>';

    if (this._mode === 'suggest') {
      h += this._renderSuggestSection();
    } else {
      h += this._renderStandardSection();
    }

    h += '</div>';
    UI.content(h);
  },

  _renderStandardSection: function() {
    var res = this.calculate();
    var h = '<div class="cd" style="background:linear-gradient(to bottom, var(--sf), var(--bg))">' +
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
      '</div></div></div>';

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
            '<td><input type="text" class="fc money" inputmode="numeric" data-money="1" style="padding:6px 9px;font-size:.82rem;font-weight:700;direction:ltr;text-align:right" value="' + (row.amount ? UI.fn(row.amount) : '') + '" placeholder="۰" onchange="Rasgiri.updateRow(' + i + ', \'amount\', this.value)"></td>' +
            '<td><input type="text" class="fc" data-date="1" maxlength="10" style="padding:6px 9px;font-size:.82rem;direction:ltr;text-align:center" value="' + esc(row.date || '') + '" placeholder="1404/01/01" onchange="Rasgiri.updateRow(' + i + ', \'date\', this.value)"></td>';
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

    return h;
  },

  /* ══════════════════════════════════════════════════════════════
     بخش رابط کاربری «پیشنهاد چک از تاریخ راس» (برنامه‌ریزی معکوس)
     ══════════════════════════════════════════════════════════════ */
  _renderSuggestSection: function() {
    var cfg = this._planCfg;
    var planEval = this.evaluatePlan();
    var targetRasDate = cfg.targetDate || this._addDaysSafe(this._baseDate, cfg.targetDays) || '—';
    var totalFmt = cfg.totalAmount ? UI.fn(cfg.totalAmount) : '';
    var cashFmt = cfg.cashAmount ? UI.fn(cfg.cashAmount) : '';

    var h = '<div class="cd">' +
      '<div class="cd-h" style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px">' +
      '<span><i class="bi bi-magic"></i> مشخصات فاکتور و راس هدف برای پیشنهاد چک‌ها</span>' +
      '<span style="font-size:.78rem;color:var(--txs)">مبلغ کل و راس مورد نظر را وارد کنید تا تاریخ و مبلغ چک‌ها محاسبه شود</span>' +
      '</div>' +
      '<div class="cd-b">' +
      '<div style="display:grid;grid-template-columns:repeat(auto-fit, minmax(210px, 1fr));gap:14px;align-items:start">' +

      /* مبلغ کل فاکتور */
      '<div class="fg" style="margin:0">' +
      '<label>مبلغ کلی فاکتور (ریال) <span class="req">*</span></label>' +
      '<div class="fwrap">' +
      '<input type="text" class="fc money has-suf" id="rgPlanTotal" inputmode="numeric" dir="ltr" data-money="1" data-words="rgPlanTotal_w" value="' + esc(totalFmt) + '" placeholder="مثلاً: 150,000,000" onchange="Rasgiri.onPlanFieldChange(\'totalAmount\', this.value)">' +
      '<span class="fsuf">ریال</span>' +
      '</div>' +
      '<div class="fwords" id="rgPlanTotal_w" style="font-size:.73rem;color:var(--p);margin-top:3px">' + (cfg.totalAmount > 0 ? esc(this._num2fa(cfg.totalAmount)) : '') + '</div>' +
      '</div>' +

      /* تعداد روز تا راس */
      '<div class="fg" style="margin:0">' +
      '<label>تعداد روز تا راس مورد نظر</label>' +
      '<div class="fwrap">' +
      '<input type="number" class="fc has-suf" id="rgPlanDays" dir="ltr" min="0" max="1500" value="' + esc(cfg.targetDays) + '" onchange="Rasgiri.onPlanDaysChange(this.value)">' +
      '<span class="fsuf">روز</span>' +
      '</div>' +
      '<div style="display:flex;gap:4px;flex-wrap:wrap;margin-top:6px">' +
      [30, 45, 60, 90, 120].map(function(d) {
        var active = (intOf(cfg.targetDays) === d);
        return '<button type="button" class="qb" style="' + (active ? 'background:var(--p);color:#fff;border-color:var(--p)' : '') + '" onclick="Rasgiri.onPlanDaysChange(' + d + ')">' + UI.fn(d) + ' روز</button>';
      }).join('') +
      '</div>' +
      '</div>' +

      /* تاریخ دقیق راس مورد نظر */
      '<div class="fg" style="margin:0">' +
      '<label>یا تاریخ راس مورد نظر (شمسی)</label>' +
      '<input type="text" class="fc" id="rgPlanDate" dir="ltr" data-date="1" maxlength="10" value="' + esc(targetRasDate) + '" placeholder="1404/03/15" onchange="Rasgiri.onPlanDateChange(this.value)">' +
      '<div style="font-size:.73rem;color:var(--txs);margin-top:4px">' +
      (targetRasDate !== '—' ? ('روز هفته راس: <strong>' + esc(this._weekdayFa(targetRasDate)) + '</strong>') : '') +
      '</div>' +
      '</div>' +

      /* تعداد فقره چک */
      '<div class="fg" style="margin:0">' +
      '<label>تعداد چک پیشنهادی</label>' +
      '<div class="fwrap">' +
      '<input type="number" class="fc has-suf" id="rgPlanCount" dir="ltr" min="1" max="24" value="' + esc(cfg.checkCount) + '" onchange="Rasgiri.onPlanFieldChange(\'checkCount\', this.value)">' +
      '<span class="fsuf">فقره</span>' +
      '</div>' +
      '<div style="display:flex;gap:4px;flex-wrap:wrap;margin-top:6px">' +
      [2, 3, 4, 5, 6].map(function(n) {
        var active = (intOf(cfg.checkCount) === n);
        return '<button type="button" class="qb" style="' + (active ? 'background:var(--p);color:#fff;border-color:var(--p)' : '') + '" onclick="Rasgiri.onPlanFieldChange(\'checkCount\', ' + n + ')">' + UI.fn(n) + ' چک</button>';
      }).join('') +
      '</div>' +
      '</div>' +

      /* رُند کردن مبالغ */
      '<div class="fg" style="margin:0">' +
      '<label>رُند کردن مبلغ چک‌ها</label>' +
      '<select class="fc" id="rgPlanRound" onchange="Rasgiri.onPlanFieldChange(\'roundStep\', this.value)">' +
      '<option value="0"' + (cfg.roundStep === 0 ? ' selected' : '') + '>دقیق (بدون رُند)</option>' +
      '<option value="500000"' + (cfg.roundStep === 500000 ? ' selected' : '') + '>مضرب ۵۰۰ هزار ریال (۵۰ ت)</option>' +
      '<option value="1000000"' + (cfg.roundStep === 1000000 ? ' selected' : '') + '>مضرب ۱ میلیون ریال (۱۰۰ ت)</option>' +
      '<option value="5000000"' + (cfg.roundStep === 5000000 ? ' selected' : '') + '>مضرب ۵ میلیون ریال (۵۰۰ ت)</option>' +
      '<option value="10000000"' + (cfg.roundStep === 10000000 ? ' selected' : '') + '>مضرب ۱۰ میلیون ریال (۱ م ت)</option>' +
      '<option value="50000000"' + (cfg.roundStep === 50000000 ? ' selected' : '') + '>مضرب ۵۰ میلیون ریال (۵ م ت)</option>' +
      '</select>' +
      '</div>' +

      /* پیش‌پرداخت نقدی اختیاری */
      '<div class="fg" style="margin:0">' +
      '<label>پیش‌پرداخت نقدی در تاریخ مبنا <span class="fnote">اختیاری</span></label>' +
      '<div class="fwrap">' +
      '<input type="text" class="fc money has-suf" id="rgPlanCash" inputmode="numeric" dir="ltr" data-money="1" value="' + esc(cashFmt) + '" placeholder="۰ (تماماً چک)" onchange="Rasgiri.onPlanFieldChange(\'cashAmount\', this.value)">' +
      '<span class="fsuf">ریال</span>' +
      '</div>' +
      '<div style="font-size:.71rem;color:var(--txs);margin-top:4px">اگر مبلغی روز مبنا نقد پرداخت شود، راس روی کل فاکتور محاسبه می‌گردد</div>' +
      '</div>' +

      '</div>' +

      /* نوار دکمه‌های عملیات پیشنهاد */
      '<div style="margin-top:14px;padding-top:12px;border-top:1px dashed var(--bd);display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:10px">' +
      '<label style="display:flex;align-items:center;gap:7px;font-size:.82rem;cursor:pointer;margin:0">' +
      '<input type="checkbox" id="rgAvoidFriday" ' + (cfg.avoidFriday ? 'checked' : '') + ' onchange="Rasgiri.onPlanFieldChange(\'avoidFriday\', this.checked)">' +
      '<span>پرهیز از افتادن سررسید چک در روز جمعه</span>' +
      '</label>' +
      '<div style="display:flex;gap:8px;flex-wrap:wrap">' +
      '<button type="button" class="btn bp" onclick="Rasgiri.generateSuggestion(false)"><i class="bi bi-calculator-fill"></i> محاسبه پیشنهاد چک</button>' +
      '<button type="button" class="btn bw" onclick="Rasgiri.refreshSuggestion()" title="تولید چیدمان و تاریخ‌های جایگزین با همان تاریخ راس و مبلغ کل"><i class="bi bi-arrow-repeat"></i> پیشنهاد جدید (رفرش)</button>' +
      '</div>' +
      '</div>' +
      '</div></div>';

    /* ── نمایش نتایج برنامه پیشنهادی ── */
    if (this._planRows && this._planRows.length) {
      var targetTotal = numOf(cfg.totalAmount);
      var cashAmt = numOf(cfg.cashAmount);
      var amountDiff = planEval.totalWithCash - targetTotal;
      var dayDiff = planEval.avgDays - intOf(cfg.targetDays);
      var strategyLabel = (this._planMeta && this._planMeta.strategyName) ? this._planMeta.strategyName : 'برنامه پیشنهادی';
      var strategyDesc = (this._planMeta && this._planMeta.strategyDesc) ? this._planMeta.strategyDesc : '';
      var patternNum = (intOf(cfg.variant) % this._STRATEGY_META.length) + 1;

      /* کارت خلاصه تطابق */
      h += '<div class="cd" style="background:linear-gradient(to bottom, var(--sf), var(--bg))">' +
        '<div class="cd-h" style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px">' +
        '<span><i class="bi bi-stars" style="color:var(--p)"></i> الگوی ' + UI.fn(patternNum) + ': <strong>' + esc(strategyLabel) + '</strong>' +
        (strategyDesc ? ' <small style="color:var(--txs);font-weight:400">(' + esc(strategyDesc) + ')</small>' : '') + '</span>' +
        '<div style="display:flex;gap:6px;flex-wrap:wrap">' +
        '<button type="button" class="btn bo bs" onclick="Rasgiri.refreshSuggestion()"><i class="bi bi-arrow-repeat"></i> تغییر پیشنهاد</button>' +
        (Math.abs(dayDiff) >= 1 ? '<button type="button" class="btn bw bs" onclick="Rasgiri.balanceLastCheckDate()"><i class="bi bi-wrench-adjustable"></i> تنظیم خودکار سررسید برای راس دقیق</button>' : '') +
        '</div>' +
        '</div>' +
        '<div class="cd-b" style="padding:14px 18px">' +
        '<div style="display:grid;grid-template-columns:repeat(auto-fit, minmax(175px, 1fr));gap:12px;text-align:center">' +
        '<div style="padding:10px;border-radius:10px;background:var(--sf);border:1px solid var(--bd)">' +
        '<small style="color:var(--txs);display:block;margin-bottom:4px">جمع چک‌ها' + (cashAmt > 0 ? ' + نقدی' : '') + '</small>' +
        '<strong style="font-size:1.1rem;color:' + (Math.abs(amountDiff) < 1 ? 'var(--ok)' : 'var(--d)') + '">' + UI.fn(planEval.totalWithCash) + '</strong> <small>ریال</small>' +
        (Math.abs(amountDiff) >= 1 ? '<div style="font-size:.71rem;color:var(--d);margin-top:2px">اختلاف با هدف: ' + UI.fn(amountDiff) + '</div>' : '<div style="font-size:.71rem;color:var(--ok);margin-top:2px">تطابق ۱۰۰٪ مبلغ</div>') +
        '</div>' +
        '<div style="padding:10px;border-radius:10px;background:var(--sf);border:1px solid var(--bd)">' +
        '<small style="color:var(--txs);display:block;margin-bottom:4px">راس محاسبه‌شده فعلی</small>' +
        '<strong style="font-size:1.1rem;color:var(--p)">' + UI.fn(planEval.avgDays) + ' روز</strong>' +
        '<div style="font-size:.71rem;color:' + (dayDiff === 0 ? 'var(--ok)' : 'var(--w)') + ';margin-top:2px">' +
        (dayDiff === 0 ? 'منطبق با راس هدف (' + UI.fn(cfg.targetDays) + ' روز)' : 'اختلاف با راس هدف: ' + (dayDiff > 0 ? '+' : '') + UI.fn(dayDiff) + ' روز') +
        '</div></div>' +
        '<div style="padding:10px;border-radius:10px;background:var(--sf);border:1px solid rgba(37,99,235,0.3)">' +
        '<small style="color:var(--txs);display:block;margin-bottom:4px">تاریخ دقیق راس چک‌ها</small>' +
        '<strong style="font-size:1.15rem;color:var(--ok)">' + esc(planEval.rasDate) + '</strong>' +
        '<div style="font-size:.71rem;color:var(--txs);margin-top:2px">هدف: ' + esc(targetRasDate) + '</div>' +
        '</div>' +
        '<div style="padding:10px;border-radius:10px;background:var(--sf);border:1px solid var(--bd)">' +
        '<small style="color:var(--txs);display:block;margin-bottom:4px">جمع چک‌ها</small>' +
        '<strong style="font-size:1.1rem;color:var(--tx)">' + UI.fn(planEval.checksTotal) + '</strong> <small>ریال (' + UI.fn(this._planRows.length) + ' فقره)</small>' +
        (cashAmt > 0 ? '<div style="font-size:.71rem;color:var(--txs);margin-top:2px">نقدی روز مبنا: ' + UI.fn(cashAmt) + ' ریال</div>' : '') +
        '</div>' +
        '</div></div></div>';

      /* جدول چک‌های پیشنهادی قابل ویرایش + دکمه صدور مستقیم */
      h += '<div class="cd">' +
        '<div class="cd-h" style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px">' +
        '<span><i class="bi bi-calendar2-check"></i> جدول زمان‌بندی و مبلغ چک‌های پیشنهادی <small style="color:var(--txs);font-weight:400">(در صورت نیاز هر ردیف قابل اصلاح است)</small></span>' +
        '<div style="display:flex;gap:8px;flex-wrap:wrap">' +
        '<button type="button" class="btn bg" onclick="Rasgiri.openIssueChecksModal()"><i class="bi bi-check2-square"></i> ثبت مستقیم این چک‌ها در سیستم</button>' +
        '<button type="button" class="btn bo bs" onclick="Rasgiri.applyPlanToManual()"><i class="bi bi-arrow-left-right"></i> انتقال به ورود دستی</button>' +
        '</div></div>' +
        '<div class="cd-b" style="padding:0"><div class="tw">' +
        '<table style="width:100%;margin:0"><thead><tr>' +
        '<th style="width:42px;text-align:center">#</th>' +
        '<th>عنوان</th>' +
        '<th style="width:190px;text-align:right">مبلغ چک (ریال)</th>' +
        '<th style="width:140px;text-align:center">تاریخ سررسید</th>' +
        '<th style="width:100px;text-align:center">روز هفته</th>' +
        '<th style="width:100px;text-align:center">فاصله از مبنا</th>' +
        '<th style="width:160px;text-align:right">حاصلضرب (روز × مبلغ)</th>' +
        '</tr></thead><tbody>';

      if (cashAmt > 0) {
        h += '<tr style="background:rgba(22,163,74,.05)">' +
          '<td style="text-align:center;color:var(--ok)">—</td>' +
          '<td><strong>پیش‌پرداخت نقدی (در تاریخ مبنا)</strong></td>' +
          '<td style="font-weight:700;direction:ltr;text-align:right;color:var(--ok)">' + UI.fn(cashAmt) + '</td>' +
          '<td style="text-align:center;direction:ltr">' + esc(this._baseDate) + '</td>' +
          '<td style="text-align:center;font-size:.78rem">' + esc(this._weekdayFa(this._baseDate)) + '</td>' +
          '<td style="text-align:center;font-weight:700;color:var(--ok)">۰ روز</td>' +
          '<td style="direction:ltr;text-align:right;color:var(--txs)">۰</td>' +
          '</tr>';
      }

      for (var i = 0; i < this._planRows.length; i++) {
        var r = this._planRows[i];
        var dDiff = this._calcDiff(this._baseDate, r.date);
        var wday = this._weekdayFa(r.date);
        var isFri = (wday === 'جمعه');
        var prod = numOf(r.amount) * (dDiff !== null ? dDiff : 0);

        h += '<tr>' +
          '<td style="text-align:center;font-weight:700;color:var(--p)">' + UI.fn(i + 1) + '</td>' +
          '<td><input type="text" class="fc" style="padding:6px 9px;font-size:.82rem" value="' + esc(r.title || ('چک شماره ' + (i + 1))) + '" onchange="Rasgiri.updatePlanRow(' + i + ', \'title\', this.value)"></td>' +
          '<td><input type="text" class="fc money" inputmode="numeric" data-money="1" style="padding:6px 9px;font-size:.84rem;font-weight:700;direction:ltr;text-align:right" value="' + (r.amount ? UI.fn(r.amount) : '') + '" onchange="Rasgiri.updatePlanRow(' + i + ', \'amount\', this.value)"></td>' +
          '<td><input type="text" class="fc" data-date="1" maxlength="10" style="padding:6px 9px;font-size:.84rem;direction:ltr;text-align:center" value="' + esc(r.date || '') + '" onchange="Rasgiri.updatePlanRow(' + i + ', \'date\', this.value)"></td>' +
          '<td style="text-align:center;font-size:.8rem;' + (isFri ? 'color:var(--d);font-weight:700' : 'color:var(--txs)') + '">' + esc(wday || '—') + (isFri ? ' ⚠' : '') + '</td>' +
          '<td style="text-align:center;font-weight:700;color:var(--p)">' + (dDiff !== null ? UI.fn(dDiff) + ' روز' : '—') + '</td>' +
          '<td style="direction:ltr;text-align:right;color:var(--txs);font-size:.8rem">' + UI.fn(prod) + '</td>' +
          '</tr>';
      }

      h += '</tbody><tfoot><tr style="background:var(--bg);font-weight:800">' +
        '<td colspan="2" style="padding:10px 14px">جمع کل برنامه:</td>' +
        '<td style="padding:10px 14px;direction:ltr;text-align:right;color:var(--ok)">' + UI.fn(planEval.totalWithCash) + ' ریال</td>' +
        '<td colspan="3" style="padding:10px 14px;text-align:center">تاریخ راس: <span style="color:var(--p)">' + esc(planEval.rasDate) + '</span> (' + UI.fn(planEval.avgDays) + ' روز)</td>' +
        '<td style="padding:10px 14px;direction:ltr;text-align:right">' + UI.fn(planEval.totalProduct) + '</td>' +
        '</tr></tfoot></table></div></div></div>';
    } else {
      h += '<div class="cd"><div class="cd-b" style="text-align:center;padding:28px;color:var(--txs)">' +
        '<i class="bi bi-magic" style="font-size:2rem;color:var(--p);display:block;margin-bottom:8px"></i>' +
        'مبلغ کلی فاکتور، تاریخ مبنا و تاریخ یا تعداد روز راس را وارد کرده و روی <strong>«محاسبه پیشنهاد چک»</strong> کلیک کنید تا چک‌های پیشنهادی چیده شوند.' +
        '</div></div>';
    }

    return h;
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
      if (this._mode === 'suggest' && this._planCfg) {
        if (this._planCfg.targetMode === 'date' && this._planCfg.targetDate) {
          var d = this._calcDiff(this._baseDate, this._planCfg.targetDate);
          if (d !== null && d >= 0) this._planCfg.targetDays = d;
        } else {
          this._planCfg.targetDate = this._addDaysSafe(this._baseDate, intOf(this._planCfg.targetDays)) || this._baseDate;
        }
        if (this._planRows && this._planRows.length && this._planCfg.totalAmount > 0) {
          this.generateSuggestion(true);
          return;
        }
      }
    } else {
      UI.toast('قالب تاریخ نامعتبر است (مثال: 1404/01/01)', 'e');
    }
    this.render();
  },

  setBaseDateToday: function() {
    this.onBaseDateChange(todayJ());
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

  _syncPlanInputsFromDom: function() {
    if (typeof document === 'undefined' || !document.getElementById) return;
    var elBase = document.getElementById('rgBaseDate');
    if (elBase && Jalali.parse(elBase.value)) this._baseDate = Jalali.parse(elBase.value);
    var elTot = document.getElementById('rgPlanTotal');
    if (elTot) this._planCfg.totalAmount = numOf(elTot.value);
    var elCash = document.getElementById('rgPlanCash');
    if (elCash) this._planCfg.cashAmount = Math.max(0, numOf(elCash.value));
    var elCnt = document.getElementById('rgPlanCount');
    if (elCnt) this._planCfg.checkCount = Math.max(1, Math.min(24, intOf(elCnt.value) || 3));
    var elRnd = document.getElementById('rgPlanRound');
    if (elRnd) this._planCfg.roundStep = Math.max(0, intOf(elRnd.value));
    var elFri = document.getElementById('rgAvoidFriday');
    if (elFri) this._planCfg.avoidFriday = !!elFri.checked;
    var elDays = document.getElementById('rgPlanDays');
    var elDt = document.getElementById('rgPlanDate');
    if (this._planCfg.targetMode === 'date' && elDt && Jalali.parse(elDt.value)) {
      var parsedTarget = Jalali.parse(elDt.value);
      this._planCfg.targetDate = parsedTarget;
      var d = this._calcDiff(this._baseDate, parsedTarget);
      if (d !== null) this._planCfg.targetDays = d;
    } else if (elDays) {
      this._planCfg.targetDays = Math.max(0, intOf(elDays.value));
      this._planCfg.targetDate = this._addDaysSafe(this._baseDate, this._planCfg.targetDays) || this._baseDate;
    }
  },

  onPlanFieldChange: function(field, val) {
    this._syncPlanInputsFromDom();
    if (field === 'totalAmount' || field === 'cashAmount') {
      this._planCfg[field] = Math.max(0, numOf(val));
    } else if (field === 'checkCount') {
      this._planCfg.checkCount = Math.max(1, Math.min(24, intOf(val) || 1));
    } else if (field === 'roundStep') {
      this._planCfg.roundStep = Math.max(0, intOf(val));
    } else if (field === 'avoidFriday') {
      this._planCfg.avoidFriday = !!val;
    }
    if (this._planCfg.totalAmount > 0 && (this._planRows.length > 0 || field === 'checkCount' || field === 'roundStep' || field === 'avoidFriday')) {
      if (this._planRows.length > 0) {
        this.generateSuggestion(true);
        return;
      }
    }
    this.render();
  },

  onPlanDaysChange: function(val) {
    this._syncPlanInputsFromDom();
    var d = Math.max(0, intOf(val));
    this._planCfg.targetMode = 'days';
    this._planCfg.targetDays = d;
    this._planCfg.targetDate = this._addDaysSafe(this._baseDate, d) || this._baseDate;
    if (this._planCfg.totalAmount > 0 && this._planRows.length > 0) {
      this.generateSuggestion(true);
      return;
    }
    this.render();
  },

  onPlanDateChange: function(val) {
    this._syncPlanInputsFromDom();
    var p = Jalali.parse(val);
    if (!p) {
      UI.toast('قالب تاریخ راس نامعتبر است (مثال: 1404/03/15)', 'e');
      this.render();
      return;
    }
    var diff = this._calcDiff(this._baseDate, p);
    if (diff === null || diff < 0) {
      UI.toast('تاریخ راس هدف نباید قبل از تاریخ مبنای راس‌گیری باشد', 'e');
      this.render();
      return;
    }
    this._planCfg.targetMode = 'date';
    this._planCfg.targetDate = p;
    this._planCfg.targetDays = diff;
    if (this._planCfg.totalAmount > 0 && this._planRows.length > 0) {
      this.generateSuggestion(true);
      return;
    }
    this.render();
  },

  clearInvoiceMeta: function() {
    this._planCfg.invoiceMeta = null;
    this.render();
  },

  resetPlan: function() {
    this._planCfg.totalAmount = 0;
    this._planCfg.cashAmount = 0;
    this._planCfg.variant = 0;
    this._planCfg.invoiceMeta = null;
    this._planRows = [];
    this._planMeta = null;
    this.render();
  },

  /* ══════════════════════════════════════════════════════════════
     الگوریتم ریاضی تولید برنامه چک از روی مبلغ کل و راس هدف
     تضمین‌کننده: جمع چک‌ها + نقدی = مبلغ کل دقیق  و  راس محاسبه‌شده = راس هدف
     ══════════════════════════════════════════════════════════════ */
  generateCheckSchedule: function(opts) {
    var me = this;
    var baseDate = Jalali.parse(opts && opts.baseDate) || this._baseDate || todayJ();
    var totalAmount = Math.round(Math.max(0, numOf(opts && opts.totalAmount)));
    var cashAmount = Math.round(Math.max(0, numOf(opts && opts.cashAmount)));
    var checkCount = Math.max(1, Math.min(24, intOf(opts && opts.checkCount) || 3));
    var roundStep = Math.max(0, intOf(opts && opts.roundStep));
    var avoidFriday = (opts && opts.avoidFriday !== undefined) ? !!opts.avoidFriday : true;
    var variant = Math.max(0, intOf(opts && opts.variant));

    var targetDays = intOf(opts && opts.targetDays);
    if (opts && opts.targetDate && Jalali.parse(opts.targetDate) && (opts.targetMode === 'date' || opts.targetDays == null)) {
      var dDiff = me._calcDiff(baseDate, opts.targetDate);
      if (dDiff !== null) targetDays = dDiff;
    }
    targetDays = Math.max(0, targetDays);

    if (totalAmount <= 0) {
      return { error: 'مبلغ کلی فاکتور باید بزرگ‌تر از صفر باشد.' };
    }
    if (cashAmount >= totalAmount) {
      return { error: 'مبلغ پیش‌پرداخت نقدی باید کمتر از مبلغ کل فاکتور باشد.' };
    }

    var checkTotal = totalAmount - cashAmount;
    var targetProduct = totalAmount * targetDays;
    var avgCheckDays = targetProduct / checkTotal;
    var targetRasDate = me._addDaysSafe(baseDate, targetDays) || baseDate;

    var strategyIdx = variant % me._STRATEGY_META.length;
    var cycle = Math.floor(variant / me._STRATEGY_META.length);
    var strategyInfo = me._STRATEGY_META[strategyIdx];

    var nudgeNonFriday = function(day, minDay, forbiddenMap) {
      var d = Math.max(minDay, Math.round(day));
      if (!avoidFriday) {
        while (forbiddenMap && forbiddenMap[d]) d++;
        return d;
      }
      if (!me._isFridayOffset(baseDate, d) && (!forbiddenMap || !forbiddenMap[d])) return d;
      for (var delta = 1; delta <= 6; delta++) {
        if (d + delta >= minDay && !me._isFridayOffset(baseDate, d + delta) && (!forbiddenMap || !forbiddenMap[d + delta])) {
          return d + delta;
        }
        if (d - delta >= minDay && !me._isFridayOffset(baseDate, d - delta) && (!forbiddenMap || !forbiddenMap[d - delta])) {
          return d - delta;
        }
      }
      return d;
    };

    /* حالت تک‌چک */
    if (checkCount === 1) {
      var dSingle = Math.max(0, Math.round(avgCheckDays));
      if (avoidFriday && dSingle > 0 && me._isFridayOffset(baseDate, dSingle)) {
        dSingle = nudgeNonFriday(dSingle, 1, null);
      }
      var dtSingle = me._addDaysSafe(baseDate, dSingle) || baseDate;
      var actualAvgSingle = Math.round((checkTotal * dSingle) / totalAmount);
      return {
        valid: true,
        strategyKey: strategyInfo.key,
        strategyName: strategyInfo.name,
        strategyDesc: strategyInfo.desc,
        baseDate: baseDate,
        targetDays: targetDays,
        targetRasDate: targetRasDate,
        totalAmount: totalAmount,
        cashAmount: cashAmount,
        checksTotal: checkTotal,
        actualAvgDays: actualAvgSingle,
        actualRasDate: me._addDaysSafe(baseDate, actualAvgSingle) || dtSingle,
        totalProduct: checkTotal * dSingle,
        rows: [{
          title: 'چک شماره ۱',
          amount: checkTotal,
          date: dtSingle,
          days: dSingle
        }]
      };
    }

    /* حالت خاص: تاریخ راس همان تاریخ مبنا و بدون پیش‌پرداخت (روز ۰) */
    if (avgCheckDays <= 0) {
      var eqAmt = Math.floor(checkTotal / checkCount);
      var zeroRows = [];
      for (var zi = 0; zi < checkCount; zi++) {
        var amtZ = (zi === checkCount - 1) ? (checkTotal - eqAmt * (checkCount - 1)) : eqAmt;
        zeroRows.push({
          title: 'چک شماره ' + UI.fn(zi + 1),
          amount: amtZ,
          date: baseDate,
          days: 0
        });
      }
      return {
        valid: true,
        strategyKey: strategyInfo.key,
        strategyName: strategyInfo.name,
        strategyDesc: strategyInfo.desc,
        baseDate: baseDate,
        targetDays: 0,
        targetRasDate: baseDate,
        totalAmount: totalAmount,
        cashAmount: cashAmount,
        checksTotal: checkTotal,
        actualAvgDays: 0,
        actualRasDate: baseDate,
        totalProduct: 0,
        rows: zeroRows
      };
    }

    var n = checkCount;
    var minAllowed = avgCheckDays >= n ? 1 : 0;
    var days = [];
    var prefWeights = [];
    var i;

    /* ۱) تعیین روزهای کاندید بر اساس الگوی انتخاب‌شده */
    if (strategyInfo.key === 'balanced') {
      var spanFactor = 0.55 + (cycle % 3) * 0.12;
      var halfSpan = Math.min(avgCheckDays - minAllowed, Math.max(n - 1, Math.round(avgCheckDays * spanFactor)));
      var lowD = Math.max(minAllowed, Math.floor(avgCheckDays - halfSpan));
      var highD = Math.max(lowD + n - 1, Math.ceil(avgCheckDays + halfSpan));
      for (i = 0; i < n; i++) {
        days.push(Math.round(lowD + ((highD - lowD) * i) / (n - 1)));
        prefWeights.push(1);
      }
    } else if (strategyInfo.key === 'ascending') {
      var aSpan = 0.62 + (cycle % 3) * 0.1;
      var aLow = Math.max(minAllowed, Math.round(avgCheckDays * (1 - aSpan)));
      var aHigh = Math.max(aLow + n - 1, Math.round(avgCheckDays * (1 + aSpan * 0.72)));
      for (i = 0; i < n; i++) {
        days.push(Math.round(aLow + ((aHigh - aLow) * i) / (n - 1)));
        prefWeights.push(0.65 + (0.85 * i) / (n - 1));
      }
    } else if (strategyInfo.key === 'descending') {
      var dSpan = 0.52 + (cycle % 3) * 0.1;
      var dLow = Math.max(minAllowed, Math.round(avgCheckDays * (1 - dSpan * 0.68)));
      var dHigh = Math.max(dLow + n - 1, Math.round(avgCheckDays * (1 + dSpan * 1.1)));
      for (i = 0; i < n; i++) {
        days.push(Math.round(dLow + ((dHigh - dLow) * i) / (n - 1)));
        prefWeights.push(1.5 - (0.85 * i) / (n - 1));
      }
    } else if (strategyInfo.key === 'calendar') {
      var grid = avgCheckDays >= 50 ? 30 : (avgCheckDays >= 20 ? 15 : 10);
      if (cycle % 2 === 1 && grid === 30) grid = 15;
      var cStart = Math.max(grid, Math.floor((avgCheckDays * 0.45) / grid) * grid);
      if (cStart >= avgCheckDays) cStart = Math.max(minAllowed, Math.floor((avgCheckDays - 1) / grid) * grid || minAllowed);
      for (i = 0; i < n; i++) {
        var cand = cStart + i * grid;
        if (i === n - 1 && cand <= avgCheckDays) {
          cand = Math.ceil((avgCheckDays + 1) / grid) * grid;
        }
        days.push(Math.max(minAllowed, cand));
        prefWeights.push(1);
      }
    } else if (strategyInfo.key === 'fast_start') {
      var fLow = Math.max(minAllowed, Math.round(avgCheckDays * (0.22 + (cycle % 3) * 0.06)));
      var fHigh = Math.max(fLow + n, Math.round(avgCheckDays * (1.55 + (cycle % 2) * 0.15)));
      for (i = 0; i < n; i++) {
        var tRatio = Math.pow(i / (n - 1), 0.85);
        days.push(Math.round(fLow + (fHigh - fLow) * tRatio));
        prefWeights.push(1 + ((i === 0) ? 0.15 : 0));
      }
    } else {
      /* pivot — چک محوری نزدیک به راس */
      var pMid = Math.max(minAllowed + 1, Math.round(avgCheckDays));
      var pLow = Math.max(minAllowed, Math.round(avgCheckDays * (0.35 + (cycle % 3) * 0.08)));
      var pHigh = Math.max(pMid + 1, Math.round(avgCheckDays * (1.65 - (cycle % 3) * 0.08)));
      for (i = 0; i < n; i++) {
        days.push(Math.round(pLow + ((pHigh - pLow) * i) / (n - 1)));
        var midDist = Math.abs(i - (n - 1) / 2) / Math.max(1, (n - 1) / 2);
        prefWeights.push(1.5 - 0.7 * midDist);
      }
    }

    /* تضمین صعودی اکید و اجتناب از جمعه */
    var usedMap = {};
    for (i = 0; i < n; i++) {
      var floorD = i === 0 ? minAllowed : (days[i - 1] + 1);
      var snapped = nudgeNonFriday(Math.max(floorD, days[i]), floorD, usedMap);
      days[i] = snapped;
      usedMap[snapped] = true;
    }

    /* اطمینان از اینکه میانگین هدف بین اولین و آخرین چک قرار دارد */
    if (days[0] >= avgCheckDays) {
      var lowTarget = Math.max(0, Math.floor(avgCheckDays) - 1);
      days[0] = nudgeNonFriday(lowTarget, 0, null);
      if (days[0] >= days[1]) {
        days[0] = Math.max(0, days[1] - 1);
      }
    }
    if (days[n - 1] <= avgCheckDays) {
      var highTarget = Math.ceil(avgCheckDays) + Math.max(2, Math.round(avgCheckDays * 0.25));
      var takenBeforeLast = {};
      for (i = 0; i < n - 1; i++) takenBeforeLast[days[i]] = true;
      days[n - 1] = nudgeNonFriday(Math.max(days[n - 2] + 1, highTarget), days[n - 2] + 1, takenBeforeLast);
    }

    /* ۲) حل دقیق وزن‌ها (آمیزش خطی تا avg === avgCheckDays) */
    var normalizeW = function(arr) {
      var s = 0;
      for (var k = 0; k < arr.length; k++) s += arr[k];
      return arr.map(function(v) { return v / (s || 1); });
    };
    var weightedAvg = function(wArr) {
      var s = 0;
      for (var k = 0; k < wArr.length; k++) s += wArr[k] * days[k];
      return s;
    };

    var wBase = normalizeW(prefWeights);
    var curMean = weightedAvg(wBase);
    var minShare = Math.min(0.45 / n, 0.06);
    var probs = wBase.slice();

    if (Math.abs(curMean - avgCheckDays) > 1e-6) {
      var extremeW = [];
      var lastD = days[n - 1];
      var firstD = days[0];
      var spanD = Math.max(1, lastD - firstD);

      if (curMean < avgCheckDays) {
        /* وزن بیشتر روی سررسیدهای دورتر */
        for (i = 0; i < n; i++) {
          extremeW.push(minShare + Math.pow((days[i] - firstD) / spanD, 2));
        }
        extremeW = normalizeW(extremeW);
        if (weightedAvg(extremeW) < avgCheckDays) {
          extremeW = [];
          for (i = 0; i < n; i++) {
            extremeW.push(i === n - 1 ? (1 - minShare * (n - 1)) : minShare);
          }
        }
      } else {
        /* وزن بیشتر روی سررسیدهای نزدیک‌تر */
        for (i = 0; i < n; i++) {
          extremeW.push(minShare + Math.pow((lastD - days[i]) / spanD, 2));
        }
        extremeW = normalizeW(extremeW);
        if (weightedAvg(extremeW) > avgCheckDays) {
          extremeW = [];
          for (i = 0; i < n; i++) {
            extremeW.push(i === 0 ? (1 - minShare * (n - 1)) : minShare);
          }
        }
      }

      var mBase = curMean;
      var mExt = weightedAvg(extremeW);
      if (Math.abs(mExt - mBase) > 1e-6) {
        var alpha = (avgCheckDays - mBase) / (mExt - mBase);
        alpha = Math.max(0, Math.min(1, alpha));
        probs = [];
        for (i = 0; i < n; i++) {
          probs.push((1 - alpha) * wBase[i] + alpha * extremeW[i]);
        }
      }
    }

    /* ۳) تبدیل به مبالغ رُند با حفظ جمع دقیق checkTotal */
    var effStep = roundStep;
    if (effStep > 0 && effStep * n > checkTotal) {
      var candidates = [50000000, 10000000, 5000000, 1000000, 500000, 100000, 0];
      effStep = 0;
      for (var ci = 0; ci < candidates.length; ci++) {
        if (candidates[ci] <= roundStep && (candidates[ci] === 0 || candidates[ci] * n <= checkTotal)) {
          effStep = candidates[ci];
          break;
        }
      }
    }

    var minAmt = effStep > 0 ? effStep : Math.max(1, Math.floor(checkTotal * 0.02));
    if (minAmt * n > checkTotal) minAmt = 1;

    var amounts = [];
    var sumAmt = 0;
    for (i = 0; i < n; i++) {
      var raw = checkTotal * probs[i];
      var rounded = effStep > 0 ? Math.round(raw / effStep) * effStep : Math.round(raw);
      if (rounded < minAmt) rounded = minAmt;
      amounts.push(rounded);
      sumAmt += rounded;
    }

    /* سرریز رُندینگ را در چکی می‌گذاریم که کمترین تغییر را روی راس ایجاد کند */
    var remainder = checkTotal - sumAmt;
    var pivotIdx = 0;
    var bestPivotDist = Infinity;
    for (i = 0; i < n; i++) {
      var distP = Math.abs(days[i] - avgCheckDays);
      if (distP < bestPivotDist && amounts[i] + remainder >= 1) {
        bestPivotDist = distP;
        pivotIdx = i;
      }
    }
    if (amounts[pivotIdx] + remainder < 1) {
      /* توزیع ایمن مابه‌التفاوت منفی */
      for (i = n - 1; i >= 0 && remainder !== 0; i--) {
        var room = amounts[i] - 1;
        if (remainder < 0 && room > 0) {
          var take = Math.min(room, -remainder);
          amounts[i] -= take;
          remainder += take;
        }
      }
    } else {
      amounts[pivotIdx] += remainder;
    }

    /* ۴) تنظیم دقیق نهایی (Fine-Tuner) روی روزها و واحدهای رُند تا راس دقیقاً منطبق شود */
    var calcProd = function(aArr, dArr) {
      var s = 0;
      for (var k = 0; k < aArr.length; k++) s += aArr[k] * dArr[k];
      return s;
    };

    var curProd = calcProd(amounts, days);
    var curErr = Math.abs(curProd - targetProduct);

    for (var iter = 0; iter < 50; iter++) {
      if (curErr < 0.5) break;
      var bestMove = null;
      var bestNextErr = curErr;

      /* جابجایی ۱ یا ۲ روز در تاریخ چک‌ها (بدون تداخل و بدون افتادن در جمعه) */
      var dayShifts = [-2, -1, 1, 2];
      for (i = 0; i < n; i++) {
        for (var si = 0; si < dayShifts.length; si++) {
          var nd = days[i] + dayShifts[si];
          if (nd < (i === 0 ? 0 : days[i - 1] + 1)) continue;
          if (i < n - 1 && nd >= days[i + 1]) continue;
          if (avoidFriday && nd > 0 && me._isFridayOffset(baseDate, nd)) continue;
          var nextProdD = curProd + amounts[i] * dayShifts[si];
          var nextErrD = Math.abs(nextProdD - targetProduct);
          if (nextErrD + 1e-6 < bestNextErr) {
            bestNextErr = nextErrD;
            bestMove = { kind: 'day', idx: i, val: nd, prod: nextProdD };
          }
        }
      }

      /* جابجایی یک گام رُند بین دو چک با حفظ جمع و رُند بودن */
      if (effStep > 0) {
        for (var fromI = 0; fromI < n; fromI++) {
          if (amounts[fromI] - effStep < minAmt) continue;
          for (var toI = 0; toI < n; toI++) {
            if (fromI === toI) continue;
            var nextProdA = curProd + effStep * (days[toI] - days[fromI]);
            var nextErrA = Math.abs(nextProdA - targetProduct);
            if (nextErrA + 1e-6 < bestNextErr) {
              bestNextErr = nextErrA;
              bestMove = { kind: 'amt', from: fromI, to: toI, delta: effStep, prod: nextProdA };
            }
          }
        }
      }

      if (!bestMove) break;
      if (bestMove.kind === 'day') {
        days[bestMove.idx] = bestMove.val;
      } else {
        amounts[bestMove.from] -= bestMove.delta;
        amounts[bestMove.to] += bestMove.delta;
      }
      curProd = bestMove.prod;
      curErr = bestNextErr;
    }

    var actualAvgDays = Math.round(curProd / totalAmount);
    var actualRasDate = me._addDaysSafe(baseDate, actualAvgDays) || targetRasDate;
    var rows = [];
    for (i = 0; i < n; i++) {
      rows.push({
        title: 'چک شماره ' + UI.fn(i + 1),
        amount: amounts[i],
        date: me._addDaysSafe(baseDate, days[i]) || baseDate,
        days: days[i]
      });
    }

    return {
      valid: true,
      strategyKey: strategyInfo.key,
      strategyName: strategyInfo.name,
      strategyDesc: strategyInfo.desc,
      baseDate: baseDate,
      targetDays: targetDays,
      targetRasDate: targetRasDate,
      totalAmount: totalAmount,
      cashAmount: cashAmount,
      checksTotal: checkTotal,
      actualAvgDays: actualAvgDays,
      actualRasDate: actualRasDate,
      totalProduct: curProd,
      rows: rows
    };
  },

  _planSignature: function(rows) {
    if (!rows || !rows.length) return '';
    return rows.map(function(r) { return r.amount + '@' + r.date; }).join('|');
  },

  generateSuggestion: function(silent) {
    this._syncPlanInputsFromDom();
    var cfg = this._planCfg;
    var res = this.generateCheckSchedule({
      baseDate: this._baseDate,
      targetMode: cfg.targetMode,
      targetDays: cfg.targetDays,
      targetDate: cfg.targetDate,
      totalAmount: cfg.totalAmount,
      cashAmount: cfg.cashAmount,
      checkCount: cfg.checkCount,
      roundStep: cfg.roundStep,
      avoidFriday: cfg.avoidFriday,
      variant: cfg.variant
    });
    if (res.error) {
      if (!silent) UI.toast(res.error, 'e');
      return null;
    }
    this._planRows = res.rows;
    this._planMeta = res;
    this.render();
    return res;
  },

  refreshSuggestion: function() {
    this._syncPlanInputsFromDom();
    var cfg = this._planCfg;
    if (!(numOf(cfg.totalAmount) > 0)) {
      UI.toast('ابتدا مبلغ کلی فاکتور را وارد کنید', 'e');
      return null;
    }
    var prevSig = this._planSignature(this._planRows);
    var chosen = null;
    var tries = 0;
    while (tries < this._STRATEGY_META.length) {
      cfg.variant = (intOf(cfg.variant) + 1);
      var cand = this.generateCheckSchedule({
        baseDate: this._baseDate,
        targetMode: cfg.targetMode,
        targetDays: cfg.targetDays,
        targetDate: cfg.targetDate,
        totalAmount: cfg.totalAmount,
        cashAmount: cfg.cashAmount,
        checkCount: cfg.checkCount,
        roundStep: cfg.roundStep,
        avoidFriday: cfg.avoidFriday,
        variant: cfg.variant
      });
      if (cand && cand.error) {
        UI.toast(cand.error, 'e');
        return null;
      }
      chosen = cand;
      if (this._planSignature(cand.rows) !== prevSig) break;
      tries++;
    }
    if (chosen && chosen.valid) {
      this._planRows = chosen.rows;
      this._planMeta = chosen;
      this.render();
    }
    return chosen;
  },

  updatePlanRow: function(idx, field, val) {
    if (!this._planRows || !this._planRows[idx]) return;
    if (field === 'amount') {
      this._planRows[idx].amount = Math.max(0, Math.round(numOf(val)));
    } else if (field === 'date') {
      var p = Jalali.parse(val);
      if (!p) {
        UI.toast('قالب تاریخ نامعتبر است (مثال: 1404/03/15)', 'e');
        this.render();
        return;
      }
      this._planRows[idx].date = p;
      this._planRows[idx].days = this._calcDiff(this._baseDate, p);
    } else {
      this._planRows[idx][field] = val;
    }
    this.render();
  },

  evaluatePlan: function() {
    var rows = this._planRows || [];
    var cashAmt = Math.max(0, Math.round(numOf(this._planCfg && this._planCfg.cashAmount)));
    var checksTotal = 0;
    var totalProduct = 0;
    for (var i = 0; i < rows.length; i++) {
      var r = rows[i];
      var amt = numOf(r.amount);
      if (amt <= 0) continue;
      var diff = this._calcDiff(this._baseDate, r.date);
      if (diff === null) continue;
      checksTotal += amt;
      totalProduct += amt * diff;
    }
    var totalWithCash = checksTotal + cashAmt;
    if (totalWithCash <= 0) {
      return {
        valid: false,
        checksTotal: 0,
        totalWithCash: 0,
        totalProduct: 0,
        avgDays: 0,
        rasDate: '—'
      };
    }
    var avgDays = Math.round(totalProduct / totalWithCash);
    return {
      valid: true,
      checksTotal: checksTotal,
      totalWithCash: totalWithCash,
      totalProduct: totalProduct,
      avgDays: avgDays,
      rasDate: this._addDaysSafe(this._baseDate, avgDays) || '—'
    };
  },

  balanceLastCheckDate: function() {
    var rows = this._planRows || [];
    if (!rows.length) return;
    var lastIdx = rows.length - 1;
    var lastAmt = numOf(rows[lastIdx].amount);
    if (lastAmt <= 0) return;

    var cashAmt = Math.max(0, Math.round(numOf(this._planCfg.cashAmount)));
    var totalWithCash = cashAmt;
    var prodExceptLast = 0;
    for (var i = 0; i < rows.length; i++) {
      var amt = numOf(rows[i].amount);
      totalWithCash += amt;
      if (i !== lastIdx) {
        var diff = this._calcDiff(this._baseDate, rows[i].date) || 0;
        prodExceptLast += amt * diff;
      }
    }
    var targetProduct = totalWithCash * intOf(this._planCfg.targetDays);
    var neededDays = Math.max(0, Math.round((targetProduct - prodExceptLast) / lastAmt));
    if (this._planCfg.avoidFriday && neededDays > 0 && this._isFridayOffset(this._baseDate, neededDays)) {
      if (!this._isFridayOffset(this._baseDate, neededDays + 1)) neededDays += 1;
      else if (neededDays > 1 && !this._isFridayOffset(this._baseDate, neededDays - 1)) neededDays -= 1;
    }
    rows[lastIdx].days = neededDays;
    rows[lastIdx].date = this._addDaysSafe(this._baseDate, neededDays) || this._baseDate;
    this.render();
    UI.toast('سررسید چک آخر برای انطباق دقیق با تاریخ راس هدف تنظیم شد.', 's');
  },

  applyPlanToManual: function() {
    if (!this._planRows || !this._planRows.length) {
      UI.toast('ابتدا برنامه چک‌ها را تولید کنید', 'e');
      return;
    }
    var nextRows = [];
    var cashAmt = Math.max(0, Math.round(numOf(this._planCfg.cashAmount)));
    if (cashAmt > 0) {
      nextRows.push({
        id: Date.now(),
        title: 'پیش‌پرداخت نقدی روز مبنا',
        amount: cashAmt,
        date: this._baseDate
      });
    }
    this._planRows.forEach(function(r, idx) {
      nextRows.push({
        id: Date.now() + idx + 1,
        title: r.title || ('چک شماره ' + (idx + 1)),
        amount: numOf(r.amount),
        date: r.date
      });
    });
    this._rows = nextRows;
    this._mode = 'manual';
    this.render();
    UI.toast('برنامه پیشنهادی به جدول راس‌گیری دستی منتقل شد.', 's');
  },

  /* ── انتخاب فاکتور برای پر کردن خودکار مبلغ، تاریخ مبنا و طرف حساب ── */
  openInvoicePickModal: async function() {
    var invs = (await FY.byYear('invoices')) || [];
    var pays = (await FY.byYear('payments')) || [];
    var chks = (await FY.byYear('checks')) || [];
    var ct = (await DB.all('contacts')) || [];
    var cm = {};
    ct.forEach(function(c) { if (c) cm[c.id] = c.name; });

    var settleMap = (typeof FinanceEngine !== 'undefined' && typeof FinanceEngine.calculateInvoiceSettlements === 'function')
      ? FinanceEngine.calculateInvoiceSettlements(invs, pays, { checks: chks }).byInvoiceId
      : {};

    var list = invs.filter(function(v) { return v && v.type !== 'proforma'; })
      .sort(function(a, b) { return (b.id || 0) - (a.id || 0); });

    this._pickInvoices = list;
    this._pickSettle = settleMap;

    var rowsHtml = '';
    if (!list.length) {
      rowsHtml = '<tr><td colspan="6" style="text-align:center;padding:24px;color:var(--txs)">فاکتور فروش یا خریدی در این سال مالی ثبت نشده است.</td></tr>';
    } else {
      for (var i = 0; i < list.length; i++) {
        var v = list[i];
        var st = settleMap[v.id];
        var rem = st ? Math.max(0, st.remaining) : Math.max(0, numOf(v.grandTotal) - numOf(v.paidAmount));
        var tl = v.type === 'sale' ? '<span class="tg tg-g">فروش</span>' : '<span class="tg tg-o">خرید</span>';
        rowsHtml += '<tr class="clk" onclick="Rasgiri.pickInvoice(' + v.id + ')">' +
          '<td><strong>' + esc(v.invoiceNumber || ('#' + v.id)) + '</strong> ' + tl + '</td>' +
          '<td style="text-align:center;direction:ltr">' + esc(v.date || '—') + '</td>' +
          '<td>' + esc(cm[v.contactId] || '—') + '</td>' +
          '<td style="direction:ltr;text-align:right">' + UI.fn(v.grandTotal) + '</td>' +
          '<td style="direction:ltr;text-align:right;font-weight:700;color:' + (rem > 0 ? 'var(--d)' : 'var(--ok)') + '">' + UI.fn(rem) + '</td>' +
          '<td style="text-align:center"><button type="button" class="btn bp bs" onclick="event.stopPropagation();Rasgiri.pickInvoice(' + v.id + ')">انتخاب</button></td>' +
          '</tr>';
      }
    }

    var body = '<div style="max-height:420px;overflow-y:auto">' +
      '<div style="margin-bottom:10px;font-size:.82rem;color:var(--txs)">با انتخاب فاکتور، مانده فاکتور (یا جمع کل در صورت تسویه‌بودن) به‌عنوان مبلغ و تاریخ فاکتور به‌عنوان تاریخ مبنا تنظیم می‌شود:</div>' +
      '<table style="width:100%;font-size:.82rem"><thead><tr>' +
      '<th>شماره</th><th style="text-align:center">تاریخ</th><th>طرف حساب</th><th style="text-align:right">جمع کل</th><th style="text-align:right">مانده</th><th></th>' +
      '</tr></thead><tbody>' + rowsHtml + '</tbody></table></div>';

    UI.open('انتخاب فاکتور برای راس‌گیری و صدور چک', body, '<button class="btn bo" onclick="UI.close()">بستن</button>', true);
  },

  pickInvoice: function(invId) {
    var v = (this._pickInvoices || []).find(function(x) { return x && x.id === invId; });
    if (!v) return;
    var st = (this._pickSettle || {})[v.id];
    var rem = st ? Math.max(0, st.remaining) : Math.max(0, numOf(v.grandTotal) - numOf(v.paidAmount));
    var chosenAmt = rem > 0 ? rem : numOf(v.grandTotal);

    if (v.date && Jalali.parse(v.date)) {
      this._baseDate = Jalali.parse(v.date);
      this._planCfg.targetDate = this._addDaysSafe(this._baseDate, intOf(this._planCfg.targetDays)) || this._baseDate;
    }
    this._planCfg.totalAmount = chosenAmt;
    this._planCfg.cashAmount = 0;
    this._planCfg.invoiceMeta = {
      invoiceId: v.id,
      invoiceUid: v.uid || null,
      invoiceNumber: v.invoiceNumber || ('#' + v.id),
      invoiceType: v.type,
      contactId: v.contactId || null,
      remaining: rem
    };
    UI.close();
    this.generateSuggestion(true);
    UI.toast('اطلاعات فاکتور ' + (v.invoiceNumber || '') + ' اعمال و برنامه چک‌ها پیشنهاد شد.', 's');
  },

  /* ── ثبت و صدور مستقیم چک‌های پیشنهادی در بخش چک‌های سیستم ── */
  openIssueChecksModal: async function() {
    if (!Perm.require('edit', 'ثبت چک')) return;
    if (!await FY.assertOpen()) return;
    if (!this._planRows || !this._planRows.length) {
      UI.toast('ابتدا برنامه چک‌های پیشنهادی را ایجاد کنید', 'e');
      return;
    }

    var ct = (await DB.all('contacts')) || [];
    var banks = (await DB.all('banks')) || [];
    var invs = (await FY.byYear('invoices')) || [];
    var pays = (await FY.byYear('payments')) || [];
    var chks = (await FY.byYear('checks')) || [];
    var meta = this._planCfg.invoiceMeta;
    var defType = (meta && meta.invoiceType === 'purchase') ? 'issued' : 'received';
    var defContact = (meta && meta.contactId) ? meta.contactId : '';

    this._issueCache = { invs: invs, pays: pays, chks: chks, ct: ct };

    var ctOpts = '<option value="">— انتخاب طرف حساب —</option>';
    ct.forEach(function(c) {
      if (!c) return;
      ctOpts += '<option value="' + c.id + '"' + (String(c.id) === String(defContact) ? ' selected' : '') + '>' + esc(c.name) + ' (' + Con.tl(c.type) + ')</option>';
    });
    var bkOpts = '<option value="">— بدون حساب بانکی —</option>';
    banks.forEach(function(b) {
      if (!b) return;
      bkOpts += '<option value="' + b.id + '">' + esc(b.name) + '</option>';
    });

    var rowsHtml = '';
    for (var i = 0; i < this._planRows.length; i++) {
      var r = this._planRows[i];
      rowsHtml += '<tr>' +
        '<td style="text-align:center">' + UI.fn(i + 1) + '</td>' +
        '<td><input type="text" class="fc" id="rgIssNo_' + i + '" dir="ltr" placeholder="شماره چک (الزامی)" style="padding:5px 8px;font-size:.82rem"></td>' +
        '<td style="direction:ltr;text-align:right;font-weight:700">' + UI.fn(r.amount) + '</td>' +
        '<td style="text-align:center;direction:ltr">' + esc(r.date) + '</td>' +
        '<td style="text-align:center;font-size:.76rem;color:var(--txs)">' + esc(this._weekdayFa(r.date)) + '</td>' +
        '</tr>';
    }

    var cashAmt = Math.max(0, Math.round(numOf(this._planCfg.cashAmount)));
    var cashNotice = cashAmt > 0
      ? '<div style="font-size:.8rem;background:rgba(245,158,11,.1);border:1px solid rgba(245,158,11,.35);border-radius:8px;padding:8px 12px;color:#92400e">' +
        '<i class="bi bi-info-circle-fill"></i> توجه: مبلغ <strong>' + UI.fn(cashAmt) + ' ریال</strong> پیش‌پرداخت نقدی در برنامه لحاظ شده است؛ این پنجره فقط چک‌ها را ثبت می‌کند و سند نقدی در صورت نیاز از بخش «دریافت و پرداخت» قابل ثبت است.' +
        '</div>'
      : '';

    var body = '<div style="display:flex;flex-direction:column;gap:12px">' +
      cashNotice +
      '<div class="fr">' +
      '<div class="fg"><label>نوع چک‌ها <span class="req">*</span></label>' +
      '<select class="fc" id="rgIssType" onchange="Rasgiri._refreshIssueInvoiceSelect()">' +
      '<option value="received"' + (defType === 'received' ? ' selected' : '') + '>چک دریافتی (از مشتری / فروش)</option>' +
      '<option value="issued"' + (defType === 'issued' ? ' selected' : '') + '>چک پرداختی (به تأمین‌کننده / خرید)</option>' +
      '</select></div>' +
      '<div class="fg"><label>طرف حساب <span class="req">*</span></label>' +
      '<select class="fc" id="rgIssContact" onchange="Rasgiri._refreshIssueInvoiceSelect()">' + ctOpts + '</select></div>' +
      '</div>' +
      '<div class="fr">' +
      '<div class="fg"><label>بانک صادرکننده چک</label><input type="text" class="fc" id="rgIssBankName" placeholder="مثلاً: ملت، ملی..."></div>' +
      '<div class="fg"><label>حساب بانکی ما <span class="fnote">اختیاری</span></label><select class="fc" id="rgIssBankAcc">' + bkOpts + '</select></div>' +
      '<div class="fg"><label>تاریخ صدور</label><input type="text" class="fc" id="rgIssDate" dir="ltr" data-date="1" value="' + esc(this._baseDate) + '"></div>' +
      '</div>' +
      '<div id="rgIssInvBox"></div>' +
      '<div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px;background:var(--bg);padding:8px 12px;border-radius:8px;border:1px solid var(--bd)">' +
      '<span style="font-size:.8rem;color:var(--txs)">می‌توانید شماره اولین چک را وارد و دکمه شماره‌گذاری متوالی را بزنید:</span>' +
      '<div style="display:flex;gap:6px;align-items:center">' +
      '<input type="text" class="fc" id="rgIssSeqStart" dir="ltr" placeholder="شروع (مثلاً 120501)" style="width:160px;padding:5px 8px;font-size:.8rem">' +
      '<button type="button" class="btn bo bs" onclick="Rasgiri.fillSequentialCheckNumbers()"><i class="bi bi-list-ol"></i> شماره متوالی</button>' +
      '</div></div>' +
      '<div class="tw" style="max-height:240px;overflow-y:auto"><table><thead><tr>' +
      '<th style="width:36px;text-align:center">#</th><th>شماره چک</th><th style="text-align:right">مبلغ (ریال)</th><th style="text-align:center">سررسید</th><th style="text-align:center">روز هفته</th>' +
      '</tr></thead><tbody>' + rowsHtml + '</tbody></table></div>' +
      '</div>';

    var foot = '<button type="button" class="btn bg" onclick="Rasgiri.submitIssuedChecks()"><i class="bi bi-check2-circle"></i> ثبت نهایی ' + UI.fn(this._planRows.length) + ' چک</button> ' +
      '<button type="button" class="btn bo" onclick="UI.close()">انصراف</button>';

    UI.open('ثبت مستقیم چک‌های پیشنهادی در سیستم', body, foot, true);
    this._refreshIssueInvoiceSelect();
  },

  _refreshIssueInvoiceSelect: function() {
    var box = (typeof document !== 'undefined' && document.getElementById) ? document.getElementById('rgIssInvBox') : null;
    if (!box || !this._issueCache) return;
    var chkType = elVal('rgIssType') || 'received';
    var cid = intOf(elVal('rgIssContact')) || null;
    var meta = this._planCfg.invoiceMeta;

    if (!cid) {
      box.innerHTML = '';
      return;
    }

    var targetInvType = chkType === 'received' ? 'sale' : 'purchase';
    var settleMap = (typeof FinanceEngine !== 'undefined' && typeof FinanceEngine.calculateInvoiceSettlements === 'function')
      ? FinanceEngine.calculateInvoiceSettlements(this._issueCache.invs, this._issueCache.pays, { checks: this._issueCache.chks }).byInvoiceId
      : {};

    var openInvs = this._issueCache.invs.filter(function(v) {
      if (!v || v.type !== targetInvType || v.contactId !== cid) return false;
      var st = settleMap[v.id];
      var rem = st ? st.remaining : Math.max(0, numOf(v.grandTotal) - numOf(v.paidAmount));
      return rem > 0.01;
    });

    if (!openInvs.length) {
      box.innerHTML = '';
      return;
    }

    var defInvId = (meta && meta.contactId === cid && meta.invoiceId) ? meta.invoiceId : '';
    var ops = '<option value="">— اتصال به هیچ فاکتوری انجام نشود (ثبت عمومی) —</option>';
    openInvs.forEach(function(v) {
      var st = settleMap[v.id];
      var rem = st ? st.remaining : Math.max(0, numOf(v.grandTotal) - numOf(v.paidAmount));
      ops += '<option value="' + v.id + '"' + (String(v.id) === String(defInvId) ? ' selected' : '') + '>' +
        esc(v.invoiceNumber || ('#' + v.id)) + ' (' + esc(v.date || '') + ') — مانده: ' + UI.fn(rem) + ' ریال</option>';
    });

    box.innerHTML = '<div class="fg" style="margin:0"><label>اتصال و تسویه خودکار روی فاکتور بازِ این شخص <span class="fnote">اختیاری</span></label>' +
      '<select class="fc" id="rgIssInvId">' + ops + '</select></div>';
  },

  fillSequentialCheckNumbers: function() {
    if (!this._planRows || !this._planRows.length) return;
    var startRaw = this._toEn(elVal('rgIssSeqStart') || '').trim();
    if (!startRaw) {
      var firstField = elVal('rgIssNo_0');
      startRaw = this._toEn(firstField || '').trim();
    }
    var m = startRaw.match(/^(.*?)(\d+)$/);
    if (!m) {
      UI.toast('یک شماره عددی برای شروع وارد کنید (مثلاً 120501)', 'e');
      return;
    }
    var prefix = m[1];
    var numStr = m[2];
    var startNum = parseInt(numStr, 10);
    var padLen = numStr.length;
    for (var i = 0; i < this._planRows.length; i++) {
      var elInp = document.getElementById('rgIssNo_' + i);
      if (elInp) {
        var val = prefix + String(startNum + i).padStart(padLen, '0');
        elInp.value = val;
      }
    }
  },

  submitIssuedChecks: async function() {
    if (!Perm.require('edit', 'ثبت چک')) return;
    if (!await FY.assertOpen()) return;
    if (!this._planRows || !this._planRows.length) return;

    var type = elVal('rgIssType') || 'received';
    var contactId = intOf(elVal('rgIssContact')) || null;
    var bankName = (elVal('rgIssBankName') || '').trim();
    var bankAccountId = intOf(elVal('rgIssBankAcc')) || null;
    var issueDate = Jalali.parse(elVal('rgIssDate')) || this._baseDate || todayJ();
    var linkInvId = intOf(elVal('rgIssInvId')) || null;

    if (!contactId) {
      UI.toast('طرف حساب را انتخاب کنید', 'e');
      return;
    }

    var checkNums = [];
    for (var i = 0; i < this._planRows.length; i++) {
      var r = this._planRows[i];
      var cNo = this._toEn(elVal('rgIssNo_' + i) || '').trim();
      if (!cNo) {
        UI.toast('شماره چک ردیف ' + UI.fn(i + 1) + ' را وارد کنید (یا از دکمه شماره متوالی استفاده کنید)', 'e');
        return;
      }
      var due = Jalali.parse(r.date);
      if (!due || !(numOf(r.amount) > 0)) {
        UI.toast('مبلغ یا تاریخ سررسید ردیف ' + UI.fn(i + 1) + ' نامعتبر است', 'e');
        return;
      }
      checkNums.push(cNo);
    }

    /* آماده سازی تخصیص ایمن فاکتور بدون بیش‌تخصیص یا دوباره‌شماری */
    var linkedInv = null;
    var remainingToAllocate = 0;
    if (linkInvId) {
      var invs = (await FY.byYear('invoices')) || [];
      var pays = (await FY.byYear('payments')) || [];
      var chks = (await FY.byYear('checks')) || [];
      linkedInv = invs.find(function(x) { return x && x.id === linkInvId; }) || null;
      if (linkedInv && typeof FinanceEngine !== 'undefined' && typeof FinanceEngine.calculateInvoiceSettlements === 'function') {
        var st = FinanceEngine.calculateInvoiceSettlements(invs, pays, { checks: chks }).byInvoiceId[linkInvId];
        remainingToAllocate = st ? Math.max(0, st.remaining) : Math.max(0, numOf(linkedInv.grandTotal) - numOf(linkedInv.paidAmount));
      } else if (linkedInv) {
        remainingToAllocate = Math.max(0, numOf(linkedInv.grandTotal) - numOf(linkedInv.paidAmount));
      }
    }

    var nextDocInt = intOf(typeof Chk !== 'undefined' && Chk.nextDocNumber ? await Chk.nextDocNumber() : '1001');
    if (nextDocInt < 1001) nextDocInt = 1001;

    var createdIds = [];
    for (i = 0; i < this._planRows.length; i++) {
      var row = this._planRows[i];
      var amt = Math.round(numOf(row.amount));
      var allocs = [];
      if (linkedInv && remainingToAllocate > 0.01) {
        var take = Math.min(amt, remainingToAllocate);
        if (take > 0.01) {
          allocs.push({
            invoiceId: linkedInv.id,
            invoiceUid: linkedInv.uid || null,
            invoiceNumber: linkedInv.invoiceNumber || ('#' + linkedInv.id),
            amount: take
          });
          remainingToAllocate -= take;
        }
      }

      var chkDoc = {
        type: type,
        docNumber: String(nextDocInt + i).padStart(4, '0'),
        fiscalYearId: STATE.yearId,
        checkNumber: checkNums[i],
        bank: bankName,
        branch: '',
        accountNumber: '',
        sayadId: '',
        amount: amt,
        issuerName: '',
        issueDate: issueDate,
        dueDate: Jalali.parse(row.date),
        contactId: contactId,
        bankAccountId: bankAccountId,
        notes: 'برنامه‌ریزی از راس‌گیری' + (linkedInv ? ' — بابت ' + (linkedInv.invoiceNumber || ('#' + linkedInv.id)) : ''),
        invoiceAllocations: allocs,
        status: 'pending'
      };
      var newId = await DB.add('checks', chkDoc);
      createdIds.push(newId);
    }

    UI.close();
    UI.toast(UI.fn(createdIds.length) + ' فقره چک با موفقیت در سیستم ثبت شد.', 's');
    return createdIds;
  },

  /* ── چاپ برنامه چک‌های پیشنهادی ── */
  printPlan: function() {
    if (!this._planRows || !this._planRows.length) {
      UI.toast('ابتدا برنامه چک‌ها را محاسبه کنید', 'e');
      return;
    }
    var area = document.getElementById('printArea');
    if (!area) return;

    var planEval = this.evaluatePlan();
    var base = this._baseDate || todayJ();
    var cashAmt = Math.max(0, Math.round(numOf(this._planCfg.cashAmount)));
    var meta = this._planCfg.invoiceMeta;

    var rowsHtml = '';
    if (cashAmt > 0) {
      rowsHtml += '<tr style="background:#f4fbf6">' +
        '<td style="border:1px solid #ccc;padding:6px;text-align:center">—</td>' +
        '<td style="border:1px solid #ccc;padding:6px">پیش‌پرداخت نقدی در تاریخ مبنا</td>' +
        '<td style="border:1px solid #ccc;padding:6px;direction:ltr;text-align:right;font-weight:bold">' + UI.fn(cashAmt) + '</td>' +
        '<td style="border:1px solid #ccc;padding:6px;text-align:center;direction:ltr">' + esc(base) + '</td>' +
        '<td style="border:1px solid #ccc;padding:6px;text-align:center">' + esc(this._weekdayFa(base)) + '</td>' +
        '<td style="border:1px solid #ccc;padding:6px;text-align:center">۰ روز</td>' +
        '<td style="border:1px solid #ccc;padding:6px;direction:ltr;text-align:right">۰</td>' +
        '</tr>';
    }
    for (var i = 0; i < this._planRows.length; i++) {
      var r = this._planRows[i];
      var diff = this._calcDiff(base, r.date);
      var prod = numOf(r.amount) * (diff !== null ? diff : 0);
      rowsHtml += '<tr>' +
        '<td style="border:1px solid #ccc;padding:6px;text-align:center">' + UI.fn(i + 1) + '</td>' +
        '<td style="border:1px solid #ccc;padding:6px">' + esc(r.title || ('چک شماره ' + (i + 1))) + '</td>' +
        '<td style="border:1px solid #ccc;padding:6px;direction:ltr;text-align:right;font-weight:bold">' + UI.fn(r.amount) + '</td>' +
        '<td style="border:1px solid #ccc;padding:6px;text-align:center;direction:ltr">' + esc(r.date) + '</td>' +
        '<td style="border:1px solid #ccc;padding:6px;text-align:center">' + esc(this._weekdayFa(r.date)) + '</td>' +
        '<td style="border:1px solid #ccc;padding:6px;text-align:center">' + (diff !== null ? UI.fn(diff) + ' روز' : '—') + '</td>' +
        '<td style="border:1px solid #ccc;padding:6px;direction:ltr;text-align:right">' + UI.fn(prod) + '</td>' +
        '</tr>';
    }

    var h = '<div style="direction:rtl;font-family:Vazirmatn,sans-serif;padding:15mm;font-size:11px;background:#fff;color:#000;min-height:260mm;position:relative">' +
      '<div style="text-align:center;border-bottom:2.5px double #000;padding-bottom:12px;margin-bottom:16px">' +
      '<h1 style="font-size:20px;margin:0 0 6px 0;font-weight:800">برنامه زمان‌بندی و صدور چک‌ها بر اساس راس هدف</h1>' +
      '<div style="font-size:12px;color:#555">سیستم حسابداری و انبارداری پارچه‌بان' + (meta ? ' — فاکتور ' + esc(meta.invoiceNumber) : '') + '</div>' +
      '<div style="display:flex;justify-content:space-between;margin-top:10px;font-size:11px;color:#333">' +
      '<div>تاریخ تنظیم: <strong>' + todayJ() + '</strong></div>' +
      '<div>تاریخ مبنا: <strong>' + esc(base) + '</strong></div>' +
      '<div>الگو: <strong>' + esc((this._planMeta && this._planMeta.strategyName) || 'سفارشی') + '</strong></div>' +
      '</div></div>' +

      '<div style="display:flex;justify-content:space-between;gap:12px;margin-bottom:16px;background:#f9f9f9;border:1px solid #ccc;border-radius:6px;padding:10px 14px">' +
      '<div>مبلغ کل: <strong>' + UI.fn(planEval.totalWithCash) + ' ریال</strong></div>' +
      '<div>تعداد چک: <strong>' + UI.fn(this._planRows.length) + ' فقره</strong></div>' +
      '<div>فاصله تا راس: <strong>' + UI.fn(planEval.avgDays) + ' روز</strong></div>' +
      '<div>تاریخ دقیق راس: <strong>' + esc(planEval.rasDate) + '</strong></div>' +
      '</div>' +

      '<table style="width:100%;border-collapse:collapse;margin-bottom:20px;font-size:10.5px">' +
      '<thead><tr style="background:#f0f0f0">' +
      '<th style="border:1px solid #ccc;padding:6px;width:30px;text-align:center">#</th>' +
      '<th style="border:1px solid #ccc;padding:6px;text-align:right">شرح چک</th>' +
      '<th style="border:1px solid #ccc;padding:6px;width:120px;text-align:right">مبلغ (ریال)</th>' +
      '<th style="border:1px solid #ccc;padding:6px;width:90px;text-align:center">سررسید</th>' +
      '<th style="border:1px solid #ccc;padding:6px;width:75px;text-align:center">روز هفته</th>' +
      '<th style="border:1px solid #ccc;padding:6px;width:70px;text-align:center">فاصله روز</th>' +
      '<th style="border:1px solid #ccc;padding:6px;width:120px;text-align:right">حاصلضرب</th>' +
      '</tr></thead><tbody>' + rowsHtml + '</tbody>' +
      '<tfoot><tr style="background:#f4f4f4;font-weight:800">' +
      '<td colspan="2" style="border:1px solid #ccc;padding:8px">جمع کل برنامه چک‌ها:</td>' +
      '<td style="border:1px solid #ccc;padding:8px;direction:ltr;text-align:right">' + UI.fn(planEval.totalWithCash) + ' ریال</td>' +
      '<td colspan="3" style="border:1px solid #ccc;padding:8px;text-align:center">تاریخ راس: ' + esc(planEval.rasDate) + '</td>' +
      '<td style="border:1px solid #ccc;padding:8px;direction:ltr;text-align:right">' + UI.fn(planEval.totalProduct) + '</td>' +
      '</tr></tfoot></table>' +

      '<div style="margin-bottom:24px;padding:8px 12px;border:1px dashed #999;border-radius:6px;font-size:10px;background:#fafafa">' +
      '<strong>جمع کل به حروف:</strong> ' + esc(this._num2fa(planEval.totalWithCash)) +
      '</div>' +

      '<div style="position:absolute;bottom:15mm;left:15mm;right:15mm;display:flex;justify-content:space-between;border-top:1px solid #aaa;padding-top:14px">' +
      '<div style="width:200px;text-align:center;font-size:10px">تنظیم‌کننده / فروشنده<br><br><br>....................................</div>' +
      '<div style="width:200px;text-align:center;font-size:10px">تأیید و امضای صادرکننده چک‌ها / خریدار<br><br><br>....................................</div>' +
      '</div></div>';

    area.innerHTML = h;
    setTimeout(function() {
      window.print();
    }, 300);
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
    var rasDate = this._addDaysSafe(this._baseDate, avgDays);

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
        sub: pers + (c.bank ? ' — ' + c.bank : (c.bankName ? ' — ' + c.bankName : '')),
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
      '<strong>مبلغ کل به حروف:</strong> ' + esc(this._num2fa(res.totalAmount)) +
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

if (typeof window !== 'undefined') {
  window.Rasgiri = Rasgiri;
}
if (typeof globalThis !== 'undefined') {
  globalThis.Rasgiri = Rasgiri;
}
if (typeof module !== 'undefined' && module.exports) {
  module.exports = Rasgiri;
}
