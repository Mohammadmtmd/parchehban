/* ══ DASHBOARD ══ */
var Dash = {
  period: 'month',
  _wc: null,
  _cc: null,
  render: async function() {
    currentPage = 'dashboard';
    UI.nav('dashboard');
    UI.title('bi-grid-1x2-fill', 'داشبورد مدیریتی جامع');
    UI.act('<button class="btn bo bs" onclick="Dash.load()" title="تازه‌سازی داده‌ها"><i class="bi bi-arrow-clockwise"></i> بروزرسانی</button>');
    UI.content('<div class="ld"><div class="spn"></div></div>');
    await this.load();
  },
  setP: async function(p) {
    this.period = p;
    await this.load();
  },
  load: async function() {
    var contacts = await DB.all('contacts');
    var allInvs = await FY.byYear('invoices');

    /* هوشمندی انتخاب سال مالی در صورت عدم وجود فاکتور در سال فعلی */
    if (!allInvs.length) {
      var totalInvs = await DB.all('invoices');
      if (totalInvs.length > 0) {
        var yearCounts = {};
        totalInvs.forEach(function(inv) {
          var yk = inv.fiscalYearId != null ? intOf(inv.fiscalYearId) : 0;
          yearCounts[yk] = (yearCounts[yk] || 0) + 1;
        });
        var bestYear = Object.keys(yearCounts).sort(function(a, b) {
          return yearCounts[b] - yearCounts[a];
        })[0];
        if (bestYear && intOf(bestYear) > 0 && intOf(bestYear) !== intOf(STATE.yearId)) {
          STATE.yearId = intOf(bestYear);
          localStorage.setItem('pb_year', STATE.yearId);
          await FY.refreshSel();
          allInvs = await FY.byYear('invoices');
        } else if (!allInvs.length) {
          allInvs = totalInvs;
        }
      }
    }

    var cMap = {};
    contacts.forEach(function(c) {
      cMap[c.id] = c.name;
    });

    var startNum = getPeriodStart(this.period);
    var periodInvs = allInvs.filter(function(inv) {
      return inv.type !== 'proforma' && (Dash.period === 'all' || pn(inv.date) >= startNum);
    });

    var tPur = 0, tSal = 0, purCount = 0, salCount = 0;
    periodInvs.forEach(function(v) {
      if (v.type === 'purchase') {
        tPur += numOf(v.grandTotal);
        purCount++;
      } else {
        tSal += numOf(v.grandTotal);
        salCount++;
      }
    });

    /* بهای تمام‌شده و سود دوره */
    var avgBuy = {};
    allInvs.forEach(function(inv) {
      if (inv.type !== 'purchase') return;
      (inv.items || []).forEach(function(it) {
        if (!avgBuy[it.productId]) avgBuy[it.productId] = { cost: 0, qty: 0 };
        avgBuy[it.productId].cost += numOf(it.total);
        avgBuy[it.productId].qty += numOf(it.quantity);
      });
    });

    var profit = 0;
    periodInvs.forEach(function(inv) {
      if (inv.type !== 'sale') return;
      (inv.items || []).forEach(function(it) {
        var ab = avgBuy[it.productId];
        var avg = ab && ab.qty > 0 ? ab.cost / ab.qty : 0;
        profit += (numOf(it.unitPrice) - avg) * numOf(it.quantity);
      });
      if (inv.brokerCommission) profit -= numOf(inv.brokerCommission);
    });

    /* مانده بانک‌ها */
    var banks = await DB.all('banks'),
      dashPays = await FY.byYear('payments'),
      dashChks = await FY.byYear('checks'),
      dashBts = [];
    try { dashBts = await DB.all('bankTransfers'); } catch (e) {}

    var bankTotal = 0;
    banks.forEach(function(b) {
      var bal = numOf(b.openingBalance);
      allInvs.forEach(function(inv) {
        if (inv.type === 'proforma' || inv.bankId !== b.id || !(inv.paidAmount > 0)) return;
        if (inv.type === 'sale') bal += numOf(inv.paidAmount);
        else bal -= numOf(inv.paidAmount);
      });
      dashPays.forEach(function(p) {
        if (p.bankId === b.id) {
          if (p.type === 'receipt') bal += numOf(p.amount);
          else bal -= numOf(p.amount);
        }
      });
      dashChks.forEach(function(c) {
        if (c.status === 'passed' && c.bankAccountId === b.id) {
          if (c.type === 'received') bal += numOf(c.amount);
          else bal -= numOf(c.amount);
        }
      });
      dashBts.forEach(function(bt) {
        if (bt.fromBankId === b.id) bal -= numOf(bt.amount);
        if (bt.toBankId === b.id) bal += numOf(bt.amount);
      });
      bankTotal += bal;
    });

    /* محاسبه بدهکاران و بستانکاران کل برای کارت‌های شاخص */
    var totalDebtors = 0, totalCreditors = 0;
    for (var ci = 0; ci < contacts.length; ci++) {
      var co = contacts[ci];
      var cBal = await getOpenBal(co.id);
      allInvs.forEach(function(inv) {
        if (inv.type === 'proforma') return;
        if (inv.contactId === co.id) {
          cBal += inv.type === 'sale' ? numOf(inv.grandTotal) : -numOf(inv.grandTotal);
          if (inv.type === 'sale' && inv.paidAmount) cBal -= numOf(inv.paidAmount);
          if (inv.type === 'purchase' && inv.paidAmount) cBal += numOf(inv.paidAmount);
        }
        if (inv.brokerId === co.id && inv.brokerCommission) cBal -= numOf(inv.brokerCommission);
      });
      dashPays.forEach(function(pay) {
        if (pay.contactId === co.id) cBal += pay.type === 'payment' ? numOf(pay.amount) : -numOf(pay.amount);
      });
      dashChks.forEach(function(chk) {
        if (chk.contactId === co.id && chk.status !== 'returned') {
          if (chk.type === 'received') cBal -= numOf(chk.amount);
          if (chk.type === 'issued') cBal += numOf(chk.amount);
        }
        if (chk.status === 'transferred' && chk.transferToId === co.id) cBal += numOf(chk.amount);
      });
      if (cBal > 0) totalDebtors += cBal;
      else if (cBal < 0) totalCreditors += Math.abs(cBal);
    }

    /* تحلیل چک‌های سررسید صیادی */
    var dueAnalysis = Chk.getDueAnalysis(dashChks);

    /* استخراج ۵ فاکتور آخر خرید و فروش */
    var salesList = allInvs.filter(function(x) { return x.type === 'sale'; })
      .sort(function(a, b) { return (b.id || 0) - (a.id || 0); });
    var latest5Sales = salesList.slice(0, 5);

    var purchaseList = allInvs.filter(function(x) { return x.type === 'purchase'; })
      .sort(function(a, b) { return (b.id || 0) - (a.id || 0); });
    var latest5Purchases = purchaseList.slice(0, 5);

    /* استخراج ۵ چک پرداختی و دریافتی آخر */
    var issuedList = dashChks.filter(function(x) { return x.type === 'issued'; })
      .sort(function(a, b) { return (b.id || 0) - (a.id || 0); });
    var latest5IssuedChecks = issuedList.slice(0, 5);

    var receivedList = dashChks.filter(function(x) { return x.type === 'received'; })
      .sort(function(a, b) { return (b.id || 0) - (a.id || 0); });
    var latest5ReceivedChecks = receivedList.slice(0, 5);

    var pl = { week: 'هفته جاری', month: 'ماه جاری', year: 'سال مالی جاری', all: 'تمام دوران' };
    var me = this, h = '';

    /* بنر هشدار امنیت در صورت رمز پیش‌فرض */
    var isDefaultPass = false;
    try { isDefaultPass = await Auth.isDefaultAdminPass(); } catch (e) {}
    if (isDefaultPass && Perm.can('*')) {
      h += '<div class="hint-box" style="margin-bottom:16px;background:rgba(239,68,68,.08);border-color:var(--d);display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:10px">' +
        '<div><strong style="color:var(--d)"><i class="bi bi-shield-exclamation"></i> هشدار امنیتی مهم:</strong> ' +
        'رمز عبور کاربر مدیر هنوز رمز پیش‌فرض (<code>admin123</code>) است! برای جلوگیری از دسترسی غیرمجاز آن را تغییر دهید.</div>' +
        '<button class="btn bp bs" onclick="ROUTES.settings()"><i class="bi bi-key"></i> تغییر رمز عبور</button>' +
        '</div>';
    }

    /* بنر همگام‌سازی ابری */
    var supaCfg = Sync.getConfig();
    if (!supaCfg.configured && Perm.can('*')) {
      h += '<div class="hint-box" style="margin-bottom:16px;display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:10px">' +
        '<div><strong style="color:var(--p)"><i class="bi bi-clouds"></i> همگام‌سازی ابری با گوشی همراه:</strong> ' +
        'برای اتصال دائم گوشی و کامپیوتر و انتقال آنی فاکتورها و چک‌ها، اتصال ابری را فعال کنید.</div>' +
        '<button class="btn bo bs" onclick="ROUTES.settings()"><i class="bi bi-gear"></i> تنظیم اتصال ابری</button>' +
        '</div>';
    }

    /* هدر داشبورد و سوییچ دوره زمانی */
    h += '<div class="dash-hero" style="margin-bottom:18px">' +
      '<div><h2>داشبورد جامع مدیریتی پارچه‌بان</h2><p>نمای متمرکز فاکتورها، وضعیت چک‌های صیادی، مانده حساب‌ها و سود عملیاتی</p></div>' +
      '<div style="display:flex;gap:6px;flex-wrap:wrap;align-items:center">' +
      ['week', 'month', 'year', 'all'].map(function(p) {
        return '<button class="btn ' + (me.period === p ? 'bp' : 'bo') + ' bs" onclick="Dash.setP(\'' + p + '\')">' + pl[p] + '</button>';
      }).join('') +
      '</div></div>';

    /* ══ کارت‌های شاخص کلیدی (KPIs) — همگی با کلیک به بخش مربوطه وارد می‌شوند ══ */
    h += '<div class="sg" style="grid-template-columns:repeat(auto-fit,minmax(195px,1fr));margin-bottom:22px">';

    /* سود و زیان -> صفحه P&L */
    h += '<div class="sc" style="cursor:pointer" onclick="ROUTES.profit()" title="مشاهده گزارش دقیق صورت سود و زیان (P&L)">' +
      '<div class="si ' + (profit >= 0 ? 'g' : 'r') + '"><i class="bi bi-graph-up-arrow"></i></div>' +
      '<div class="sti"><h3>' + UI.fn(Math.round(profit)) + '</h3><p>سود ناخالص (' + pl[this.period] + ') ←</p></div></div>';

    /* فروش -> فاکتورهای فروش */
    h += '<div class="sc" style="cursor:pointer" onclick="ROUTES.sales()" title="مشاهده فهرست فاکتورهای فروش">' +
      '<div class="si g"><i class="bi bi-receipt-cutoff"></i></div>' +
      '<div class="sti"><h3>' + UI.fn(tSal) + '</h3><p>فروش (' + UI.fn(salCount) + ' فاکتور) ←</p></div></div>';

    /* خرید -> فاکتورهای خرید */
    h += '<div class="sc" style="cursor:pointer" onclick="ROUTES.purchase()" title="مشاهده فهرست فاکتورهای خرید">' +
      '<div class="si o"><i class="bi bi-cart-fill"></i></div>' +
      '<div class="sti"><h3>' + UI.fn(tPur) + '</h3><p>خرید (' + UI.fn(purCount) + ' فاکتور) ←</p></div></div>';

    /* موجودی نقد و بانک -> بانک‌ها */
    h += '<div class="sc" style="cursor:pointer" onclick="ROUTES.banks()" title="مشاهده حساب‌های بانکی و صندوق">' +
      '<div class="si b"><i class="bi bi-bank2"></i></div>' +
      '<div class="sti"><h3>' + UI.fn(bankTotal) + '</h3><p>مانده نقد و بانک‌ها ←</p></div></div>';

    /* طلب از مشتریان -> بدهکاران */
    h += '<div class="sc" style="cursor:pointer" onclick="ROUTES.debtors()" title="مشاهده گزارش بدهکاران">' +
      '<div class="si b"><i class="bi bi-arrow-down-left-circle-fill"></i></div>' +
      '<div class="sti"><h3 style="color:var(--p)">' + UI.fn(totalDebtors) + '</h3><p>طلب از مشتریان ←</p></div></div>';

    /* بدهی به تأمین‌کنندگان -> بستانکاران */
    h += '<div class="sc" style="cursor:pointer" onclick="ROUTES.creditors()" title="مشاهده گزارش بستانکاران">' +
      '<div class="si r"><i class="bi bi-arrow-up-right-circle-fill"></i></div>' +
      '<div class="sti"><h3 style="color:var(--d)">' + UI.fn(totalCreditors) + '</h3><p>بدهی به تأمین‌کنندگان ←</p></div></div>';

    h += '</div>';

    /* ══ بخش ۱: یادآور هوشمند سررسید چک‌های صیادی ══ */
    h += '<div class="cd" style="margin-bottom:24px;border:1.5px solid ' + (dueAnalysis.overdue.length ? 'var(--d)' : dueAnalysis.count > 0 ? 'var(--w)' : 'var(--bd)') + '">';
    h += '<div class="cd-h" style="background:' + (dueAnalysis.count > 0 ? 'rgba(217,119,6,.06)' : 'transparent') + '">' +
      '<div style="display:flex;align-items:center;gap:10px">' +
      '<i class="bi bi-bell-fill" style="color:' + (dueAnalysis.overdue.length ? 'var(--d)' : dueAnalysis.count > 0 ? 'var(--w)' : 'var(--ok)') + ';font-size:1.15rem"></i>' +
      '<span style="font-weight:700">یادآور هوشمند سررسید چک‌های صیادی</span>' +
      (dueAnalysis.count > 0 ? '<span class="tg ' + (dueAnalysis.overdue.length ? 'tg-r' : 'tg-o') + '">' + dueAnalysis.count + ' چک نیازمند توجه</span>' : '<span class="tg tg-g">وضعیت عادی</span>') +
      '</div>' +
      '<button class="btn bo bs" onclick="ROUTES.checks()" title="ورود به بخش کلی مدیریت چک‌ها" style="cursor:pointer"><i class="bi bi-arrow-left"></i> ورود به مدیریت چک‌ها</button>' +
      '</div>';

    if (dueAnalysis.count > 0) {
      /* جدول چک‌های دارای سررسید نزدیک یا گذشته */
      var urgentRows = '';
      dueAnalysis.allUrgent.forEach(function(c, i) {
        var isR = c.type === 'received';
        var badge = Chk.dueBadgeHTML(c.dueDate, c.status);
        urgentRows += '<tr class="clk" onclick="Chk.form(\'' + c.type + '\',' + c.id + ')" title="کلیک برای مشاهده و ویرایش چک">' +
          '<td>' + (i + 1) + '</td>' +
          '<td><span class="tg ' + (isR ? 'tg-g' : 'tg-r') + '">' + (isR ? 'دریافتی' : 'پرداختی') + '</span></td>' +
          '<td><strong>' + esc(c.checkNumber) + '</strong></td>' +
          '<td>' + esc(cMap[c.contactId] || '—') + '</td>' +
          '<td>' + esc(c.bank || '—') + '</td>' +
          '<td>' + esc(c.dueDate || '—') + badge + '</td>' +
          '<td style="font-weight:700;text-align:left">' + UI.fn(c.amount) + '</td>' +
          '<td><span class="tg ' + Chk.stg(c.status) + '">' + Chk.sl(c.status) + '</span></td>' +
          '<td style="white-space:nowrap" onclick="event.stopPropagation()">' +
          '<button class="bi2" onclick="Chk.cs(' + c.id + ')" title="تغییر وضعیت چک"><i class="bi bi-arrow-repeat"></i></button> ' +
          '<button class="bi2" onclick="Chk.form(\'' + c.type + '\',' + c.id + ')" title="ویرایش"><i class="bi bi-pencil"></i></button>' +
          '</td>' +
          '</tr>';
      });

      h += '<div class="cd-b" style="padding-bottom:12px;background:var(--bg);border-bottom:1px solid var(--bd);display:flex;gap:14px;flex-wrap:wrap;align-items:center;justify-content:space-between">' +
        '<div style="display:flex;gap:10px;flex-wrap:wrap;font-size:.84rem">' +
        (dueAnalysis.overdue.length ? '<div style="padding:6px 12px;background:var(--dl);color:var(--d);border-radius:8px"><strong>' + dueAnalysis.overdue.length + ' چک سررسید گذشته:</strong> لطفاً فوراً پیگیری فرمایید</div>' : '') +
        (dueAnalysis.totalIssuedAmt > 0 ? '<div style="padding:6px 12px;background:var(--dl);color:var(--d);border-radius:8px"><strong>موجودی موردنیاز چک‌های پرداختی:</strong> ' + UI.fn(dueAnalysis.totalIssuedAmt) + ' ریال</div>' : '') +
        (dueAnalysis.totalReceivedAmt > 0 ? '<div style="padding:6px 12px;background:var(--okl);color:var(--ok);border-radius:8px"><strong>مبلغ چک‌های دریافتی آماده وصول:</strong> ' + UI.fn(dueAnalysis.totalReceivedAmt) + ' ریال</div>' : '') +
        '</div>' +
        '<div style="display:flex;gap:6px">' +
        '<button class="btn bo bs" onclick="Chk.ll(\'due7\')"><i class="bi bi-calendar-check"></i> فیلتر ۷ روز آینده</button>' +
        '</div></div>';

      h += '<div class="tw"><table><thead><tr><th>#</th><th>نوع</th><th>شماره چک</th><th>طرف حساب</th><th>بانک صادرکننده</th><th>سررسید</th><th style="text-align:left">مبلغ (ریال)</th><th>وضعیت</th><th>عملیات</th></tr></thead><tbody>' +
        urgentRows + '</tbody></table></div>';
    } else {
      h += '<div style="padding:22px;text-align:center;display:flex;align-items:center;justify-content:center;gap:12px;color:var(--ok)">' +
        '<i class="bi bi-check-circle-fill" style="font-size:1.8rem"></i>' +
        '<div style="text-align:right">' +
        '<strong style="font-size:.95rem;color:var(--tx)">هیچ چکی با سررسید نزدیک (۷ روز آینده) یا سررسید گذشته وجود ندارد.</strong>' +
        '<div style="font-size:.8rem;color:var(--txs);margin-top:2px">تمامی تعهدات صیادی در وضعیت منظم قرار دارند.</div>' +
        '</div>' +
        '<div style="margin-inline-start:auto;display:flex;gap:8px">' +
        '<button class="btn bg bs" onclick="Chk.form(\'received\')"><i class="bi bi-plus-lg"></i> ثبت چک دریافتی</button>' +
        '<button class="btn bdn bs" onclick="Chk.form(\'issued\')"><i class="bi bi-plus-lg"></i> ثبت چک پرداختی</button>' +
        '</div></div>';
    }
    h += '</div>';

    /* ══ بخش ۲: مقایسه فاکتورهای اخیر (۵ فاکتور آخر خرید و ۵ فاکتور آخر فروش) ══ */
    h += '<div class="g2" style="margin-bottom:24px">';

    /* کارت ۵ فاکتور آخر فروش */
    h += '<div class="cd">';
    h += '<div class="cd-h">' +
      '<div style="display:flex;align-items:center;gap:8px"><i class="bi bi-receipt" style="color:var(--ok)"></i><span>۵ فاکتور اخیر فروش</span></div>' +
      '<button class="btn bo bs" onclick="ROUTES.sales()" title="ورود به فاکتورهای فروش" style="cursor:pointer">مشاهده همه فروش‌ها ←</button>' +
      '</div>';
    if (latest5Sales.length) {
      var sRows = '';
      latest5Sales.forEach(function(v, i) {
        var isPaid = numOf(v.paidAmount) >= numOf(v.grandTotal);
        var rem = numOf(v.grandTotal) - numOf(v.paidAmount);
        sRows += '<tr class="clk" onclick="Inv.vw(' + v.id + ')" title="کلیک برای مشاهده و چاپ فاکتور">' +
          '<td>' + (i + 1) + '</td>' +
          '<td><strong style="color:var(--p)">' + esc(v.invoiceNumber || '—') + '</strong></td>' +
          '<td>' + esc(cMap[v.contactId] || 'مشتری آزاد') + '</td>' +
          '<td style="text-align:center">' + esc(v.date || '—') + '</td>' +
          '<td style="font-weight:700;text-align:left">' + UI.fn(v.grandTotal) + '</td>' +
          '<td style="text-align:center">' + (isPaid ? '<span class="tg tg-g">تسویه</span>' : '<span class="tg tg-o">مانده: ' + UI.fn(rem) + '</span>') + '</td>' +
          '<td style="white-space:nowrap" onclick="event.stopPropagation()">' +
          '<button class="bi2" onclick="Inv.vw(' + v.id + ')" title="پیش‌نمایش و چاپ"><i class="bi bi-printer"></i></button>' +
          '</td></tr>';
      });
      h += '<div class="tw"><table><thead><tr><th>#</th><th>شماره</th><th>مشتری</th><th style="text-align:center">تاریخ</th><th style="text-align:left">مبلغ</th><th style="text-align:center">وضعیت</th><th></th></tr></thead><tbody>' + sRows + '</tbody></table></div>';
    } else {
      h += '<div class="em"><p>فاکتور فروشی ثبت نشده است</p><button class="btn bg bs" style="margin-top:10px" onclick="Inv.form(\'sale\')"><i class="bi bi-plus-lg"></i> ثبت اولین فاکتور فروش</button></div>';
    }
    h += '</div>';

    /* کارت ۵ فاکتور آخر خرید */
    h += '<div class="cd">';
    h += '<div class="cd-h">' +
      '<div style="display:flex;align-items:center;gap:8px"><i class="bi bi-cart-fill" style="color:var(--w)"></i><span>۵ فاکتور اخیر خرید</span></div>' +
      '<button class="btn bo bs" onclick="ROUTES.purchase()" title="ورود به فاکتورهای خرید" style="cursor:pointer">مشاهده همه خریدها ←</button>' +
      '</div>';
    if (latest5Purchases.length) {
      var pRows = '';
      latest5Purchases.forEach(function(v, i) {
        var isPaid = numOf(v.paidAmount) >= numOf(v.grandTotal);
        var rem = numOf(v.grandTotal) - numOf(v.paidAmount);
        pRows += '<tr class="clk" onclick="Inv.vw(' + v.id + ')" title="کلیک برای مشاهده و چاپ فاکتور">' +
          '<td>' + (i + 1) + '</td>' +
          '<td><strong style="color:var(--w)">' + esc(v.invoiceNumber || '—') + '</strong></td>' +
          '<td>' + esc(cMap[v.contactId] || 'تأمین‌کننده') + '</td>' +
          '<td style="text-align:center">' + esc(v.date || '—') + '</td>' +
          '<td style="font-weight:700;text-align:left">' + UI.fn(v.grandTotal) + '</td>' +
          '<td style="text-align:center">' + (isPaid ? '<span class="tg tg-g">تسویه</span>' : '<span class="tg tg-o">مانده: ' + UI.fn(rem) + '</span>') + '</td>' +
          '<td style="white-space:nowrap" onclick="event.stopPropagation()">' +
          '<button class="bi2" onclick="Inv.vw(' + v.id + ')" title="پیش‌نمایش و چاپ"><i class="bi bi-printer"></i></button>' +
          '</td></tr>';
      });
      h += '<div class="tw"><table><thead><tr><th>#</th><th>شماره</th><th>تأمین‌کننده</th><th style="text-align:center">تاریخ</th><th style="text-align:left">مبلغ</th><th style="text-align:center">وضعیت</th><th></th></tr></thead><tbody>' + pRows + '</tbody></table></div>';
    } else {
      h += '<div class="em"><p>فاکتور خریدی ثبت نشده است</p><button class="btn bw bs" style="margin-top:10px" onclick="Inv.form(\'purchase\')"><i class="bi bi-plus-lg"></i> ثبت اولین فاکتور خرید</button></div>';
    }
    h += '</div>';

    h += '</div>';

    /* ══ بخش ۳: ۵ چک دریافتی آخر و ۵ چک پرداختی آخر ══ */
    h += '<div class="g2" style="margin-bottom:24px">';

    /* کارت ۵ چک دریافتی آخر */
    h += '<div class="cd">';
    h += '<div class="cd-h">' +
      '<div style="display:flex;align-items:center;gap:8px"><i class="bi bi-credit-card-2-front-fill" style="color:var(--ok)"></i><span>۵ چک دریافتی اخیر (از مشتریان)</span></div>' +
      '<button class="btn bo bs" onclick="Chk.ll(\'received\')" title="ورود به چک‌های دریافتی" style="cursor:pointer">مشاهده همه دریافتی‌ها ←</button>' +
      '</div>';
    if (latest5ReceivedChecks.length) {
      var crRows = '';
      latest5ReceivedChecks.forEach(function(c, i) {
        var badge = Chk.dueBadgeHTML(c.dueDate, c.status);
        crRows += '<tr class="clk" onclick="Chk.form(\'received\',' + c.id + ')" title="کلیک برای ویرایش یا مشاهده چک">' +
          '<td>' + (i + 1) + '</td>' +
          '<td><strong>' + esc(c.checkNumber) + '</strong></td>' +
          '<td>' + esc(cMap[c.contactId] || '—') + '</td>' +
          '<td>' + esc(c.bank || '—') + '</td>' +
          '<td>' + esc(c.dueDate || '—') + badge + '</td>' +
          '<td style="font-weight:700;text-align:left">' + UI.fn(c.amount) + '</td>' +
          '<td><span class="tg ' + Chk.stg(c.status) + '">' + Chk.sl(c.status) + '</span></td>' +
          '<td style="white-space:nowrap" onclick="event.stopPropagation()">' +
          '<button class="bi2" onclick="Chk.cs(' + c.id + ')" title="تغییر وضعیت"><i class="bi bi-arrow-repeat"></i></button>' +
          '</td></tr>';
      });
      h += '<div class="tw"><table><thead><tr><th>#</th><th>شماره</th><th>مشتری</th><th>بانک</th><th>سررسید</th><th style="text-align:left">مبلغ</th><th>وضعیت</th><th></th></tr></thead><tbody>' + crRows + '</tbody></table></div>';
    } else {
      h += '<div class="em"><p>چک دریافتی ثبت نشده است</p><button class="btn bg bs" style="margin-top:10px" onclick="Chk.form(\'received\')"><i class="bi bi-plus-lg"></i> ثبت چک دریافتی</button></div>';
    }
    h += '</div>';

    /* کارت ۵ چک پرداختی آخر */
    h += '<div class="cd">';
    h += '<div class="cd-h">' +
      '<div style="display:flex;align-items:center;gap:8px"><i class="bi bi-credit-card-2-front-fill" style="color:var(--d)"></i><span>۵ چک پرداختی اخیر (به تأمین‌کنندگان)</span></div>' +
      '<button class="btn bo bs" onclick="Chk.ll(\'issued\')" title="ورود به چک‌های پرداختی" style="cursor:pointer">مشاهده همه پرداختی‌ها ←</button>' +
      '</div>';
    if (latest5IssuedChecks.length) {
      var ciRows = '';
      latest5IssuedChecks.forEach(function(c, i) {
        var badge = Chk.dueBadgeHTML(c.dueDate, c.status);
        ciRows += '<tr class="clk" onclick="Chk.form(\'issued\',' + c.id + ')" title="کلیک برای ویرایش یا مشاهده چک">' +
          '<td>' + (i + 1) + '</td>' +
          '<td><strong>' + esc(c.checkNumber) + '</strong></td>' +
          '<td>' + esc(cMap[c.contactId] || '—') + '</td>' +
          '<td>' + esc(c.bank || '—') + '</td>' +
          '<td>' + esc(c.dueDate || '—') + badge + '</td>' +
          '<td style="font-weight:700;text-align:left">' + UI.fn(c.amount) + '</td>' +
          '<td><span class="tg ' + Chk.stg(c.status) + '">' + Chk.sl(c.status) + '</span></td>' +
          '<td style="white-space:nowrap" onclick="event.stopPropagation()">' +
          '<button class="bi2" onclick="Chk.cs(' + c.id + ')" title="تغییر وضعیت"><i class="bi bi-arrow-repeat"></i></button>' +
          '</td></tr>';
      });
      h += '<div class="tw"><table><thead><tr><th>#</th><th>شماره</th><th>تأمین‌کننده</th><th>بانک</th><th>سررسید</th><th style="text-align:left">مبلغ</th><th>وضعیت</th><th></th></tr></thead><tbody>' + ciRows + '</tbody></table></div>';
    } else {
      h += '<div class="em"><p>چک پرداختی ثبت نشده است</p><button class="btn bdn bs" style="margin-top:10px" onclick="Chk.form(\'issued\')"><i class="bi bi-plus-lg"></i> ثبت چک پرداختی</button></div>';
    }
    h += '</div>';

    h += '</div>';

    /* ══ بخش ۴: نمودارهای تحلیلی ══ */
    h += '<div class="g2" style="margin-bottom:24px">';
    h += '<div class="cd"><div class="cd-h"><i class="bi bi-bar-chart-fill" style="margin-inline-end:8px;color:var(--p)"></i>روند مقایسه‌ای فروش و خرید روزانه</div><div class="cd-b" style="height:260px"><canvas id="dashWC"></canvas></div></div>';
    h += '<div class="cd"><div class="cd-h"><i class="bi bi-pie-chart-fill" style="margin-inline-end:8px;color:var(--ok)"></i>سهم مشتریان برتر در فروش</div><div class="cd-b" style="height:260px"><canvas id="dashCC"></canvas></div></div>';
    h += '</div>';

    /* ══ بخش ۵: پشتیبان‌گیری و PWA ══ */
    h += '<div class="cd" style="margin-top:20px"><div class="cd-h"><div style="display:flex;align-items:center;gap:8px"><i class="bi bi-shield-lock" style="color:var(--ok)"></i><span>پشتیبان‌گیری امن و نصب برنامه</span></div></div>' +
      '<div class="cd-b" style="display:flex;gap:10px;flex-wrap:wrap;align-items:center;justify-content:space-between">' +
      '<div style="font-size:.84rem;color:var(--txs)">از داده‌های انبار، فاکتورها و چک‌ها فایل پشتیبان تهیه کنید یا برنامه را مستقیماً روی گوشی نصب فرمایید.</div>' +
      '<div style="display:flex;gap:8px;flex-wrap:wrap">' +
      '<button class="btn bg bs" onclick="Backup.exportAll()"><i class="bi bi-download"></i> دانلود فایل پشتیبان (JSON)</button>' +
      '<button class="btn bdn bs" onclick="Backup.importAll()"><i class="bi bi-upload"></i> بازیابی نسخه پشتیبان</button>' +
      '<button class="btn bo bs" onclick="PWA.promptInstall()"><i class="bi bi-phone"></i> راهنما / نصب اپلیکیشن</button>' +
      '</div></div></div>';

    UI.content(h);
    this.renderCharts(allInvs, cMap);
  },
  renderCharts: function(allInvs, cMap) {
    try {
      if (typeof Chart === 'undefined') return;
      var me = this;
      if (me._wc) me._wc.destroy();
      if (me._cc) me._cc.destroy();
      var byDate = {};
      allInvs.forEach(function(inv) {
        if (inv.type === 'proforma') return;
        var d = inv.date || '—';
        if (!byDate[d]) byDate[d] = { pur: 0, sal: 0 };
        if (inv.type === 'purchase') byDate[d].pur += numOf(inv.grandTotal);
        else byDate[d].sal += numOf(inv.grandTotal);
      });
      var dates = Object.keys(byDate).sort().slice(-7);
      var wCtx = document.getElementById('dashWC');
      if (wCtx) {
        if (!dates.length) {
          wCtx.parentElement.innerHTML = '<div class="em" style="padding:48px 14px;text-align:center"><i class="bi bi-bar-chart" style="font-size:2.2rem;color:var(--txs);opacity:.45"></i><p style="margin-top:10px;font-size:.84rem;color:var(--txs)">هنوز فاکتور خرید یا فروشی در این دوره ثبت نشده است</p></div>';
        } else {
          me._wc = new Chart(wCtx, {
            type: 'bar',
            data: {
              labels: dates.map(function(d) {
                var p = (d || '').split('/');
                return p.length >= 3 ? (p[1] + '/' + p[2]) : d;
              }),
              datasets: [{
                label: 'خرید',
                data: dates.map(function(d) { return byDate[d].pur; }),
                backgroundColor: 'rgba(217,119,6,0.75)',
                borderRadius: 4
              }, {
                label: 'فروش',
                data: dates.map(function(d) { return byDate[d].sal; }),
                backgroundColor: 'rgba(22,163,74,0.75)',
                borderRadius: 4
              }]
            },
            options: {
              responsive: true,
              maintainAspectRatio: false,
              plugins: {
                legend: {
                  position: 'bottom',
                  labels: { font: { family: 'Vazirmatn' } }
                }
              },
              scales: {
                y: {
                  ticks: {
                    font: { family: 'Vazirmatn' },
                    callback: function(v) {
                      if (v >= 1000000) return (v / 1000000).toFixed(1) + 'M';
                      if (v >= 1000) return (v / 1000).toFixed(0) + 'K';
                      return v;
                    }
                  }
                },
                x: {
                  ticks: { font: { family: 'Vazirmatn' } }
                }
              }
            }
          });
        }
      }
      var byCust = {};
      allInvs.forEach(function(inv) {
        if (inv.type !== 'sale') return;
        var cid = inv.contactId || 'unknown';
        if (!byCust[cid]) byCust[cid] = 0;
        byCust[cid] += numOf(inv.grandTotal);
      });
      var cL = [], cD = [];
      for (var k in byCust) {
        cL.push(cMap[k] || 'مشتری آزاد');
        cD.push(byCust[k]);
      }
      var cCtx = document.getElementById('dashCC');
      if (cCtx) {
        if (!cL.length) {
          cCtx.parentElement.innerHTML = '<div class="em" style="padding:48px 14px;text-align:center"><i class="bi bi-pie-chart" style="font-size:2.2rem;color:var(--txs);opacity:.45"></i><p style="margin-top:10px;font-size:.84rem;color:var(--txs)">هنوز فاکتور فروش مشتریان در این دوره ثبت نشده است</p></div>';
        } else {
          me._cc = new Chart(cCtx, {
            type: 'doughnut',
            data: {
              labels: cL,
              datasets: [{
                data: cD,
                backgroundColor: ['#2563eb', '#16a34a', '#d97706', '#dc2626', '#7c3aed', '#0891b2', '#be185d', '#4f46e5'].slice(0, cL.length),
                borderWidth: 2,
                borderColor: getComputedStyle(document.body).getPropertyValue('--sf').trim() || '#fff'
              }]
            },
            options: {
              responsive: true,
              maintainAspectRatio: false,
              plugins: {
                legend: {
                  position: 'bottom',
                  labels: { font: { family: 'Vazirmatn' } }
                }
              }
            }
          });
        }
      }
    } catch (e) {
      console.log('Chart:', e);
    }
  }
};

