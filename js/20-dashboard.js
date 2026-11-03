/* ══════════════════════════════════════════════════════════════════════════════
   PARCHEHBAN ERP — داشبورد مدیریتی جامع و حرفه‌ای (Professional ERP Dashboard)
   ══════════════════════════════════════════════════════════════════════════════
   منبع واحد حقیقت محاسبات مالی: FinanceEngine (js/02b-finance.js)
   منبع واحد مانده‌گیری حساب اشخاص: Con.allBalances (js/11-contacts.js)
   منبع واحد مانده حساب‌های بانکی: Bank.balance (js/22-banks.js)
   موجودی تجمعی انبار: Prod.stockMap (js/10-products.js)
   قانون غیرقابل‌نقض: محاسبات کاملاً Pure و درون حافظه؛ هیچ داده‌ای در DB دستکاری نمی‌شود.
   ══════════════════════════════════════════════════════════════════════════════ */

var Dash = {
  period: 'month', // 'week' | 'month' | 'quarter' | 'year' | 'all' | 'custom'
  customStart: '',
  customEnd: '',
  chartView: 'combined', // 'combined' | 'salesPur'
  prodSort: 'profit', // 'profit' | 'sales'
  prodQuery: '',
  activityFilter: 'all', // 'all' | 'sales' | 'purchases' | 'payments' | 'checks'
  lastUpdated: null,
  _perfChart: null,
  _custChart: null,
  _cache: null,

  /* ══ نمایش و راه‌اندازی داشبورد ══ */
  render: async function() {
    currentPage = 'dashboard';
    UI.nav('dashboard');
    UI.title('bi-speedometer2', 'داشبورد مدیریتی پارچه‌بان');
    UI.act(
      '<button class="btn bo bs" onclick="Dash.load()" title="تازه‌سازی فوری داده‌ها">' +
        '<i class="bi bi-arrow-clockwise"></i> بروزرسانی' +
      '</button>'
    );
    UI.content('<div class="ld"><div class="spn"></div></div>');
    try {
      await this.load();
    } catch (err) {
      console.error('Dash.render error:', err);
      UI.content(
        '<div class="hint-box" style="margin:24px;background:var(--dl);color:var(--d);padding:20px;border-radius:12px;border:1px solid var(--d)">' +
          '<strong><i class="bi bi-exclamation-octagon-fill"></i> خطا در بارگذاری داشبورد:</strong> ' +
          esc(err && err.message ? err.message : 'خطای بارگذاری داده‌ها') +
          '<div style="margin-top:12px">' +
            '<button class="btn bp bs" onclick="Dash.load()"><i class="bi bi-arrow-clockwise"></i> تلاش مجدد</button>' +
          '</div>' +
        '</div>'
      );
    }
  },

  /* ══ تغییر دوره زمانی ══ */
  setP: async function(p) {
    this.period = p;
    if (p !== 'custom') {
      await this.load();
    } else {
      this.toggleCustomRangeBar(true);
    }
  },

  /* ══ اعمال بازه تاریخ دلخواه ══ */
  applyCustomRange: async function() {
    var sVal = elVal('dashStartDt').trim();
    var eVal = elVal('dashEndDt').trim();
    if (!sVal || !eVal) {
      UI.toast('لطفاً هر دو تاریخ ابتدا و انتهای بازه را وارد نمایید', 'w');
      return;
    }
    var normS = Jalali.parse(sVal);
    var normE = Jalali.parse(eVal);
    if (!normS || !normE) {
      UI.toast('فرمت تاریخ نامعتبر است (مثال: ۱۴۰۳/۰۸/۱۵)', 'e');
      return;
    }
    if (pn(normS) > pn(normE)) {
      UI.toast('تاریخ شروع نمی‌تواند پس از تاریخ پایان باشد', 'w');
      return;
    }
    this.customStart = normS;
    this.customEnd = normE;
    this.period = 'custom';
    await this.load();
  },

  toggleCustomRangeBar: function(forceOpen) {
    var bar = document.getElementById('dashCustomBar');
    if (!bar) return;
    if (forceOpen === true) {
      bar.style.display = 'flex';
      var sInput = document.getElementById('dashStartDt');
      if (sInput && !sInput.value) sInput.value = this.customStart || Jalali.addMonths(Jalali.today(), -1);
      var eInput = document.getElementById('dashEndDt');
      if (eInput && !eInput.value) eInput.value = this.customEnd || Jalali.today();
      if (sInput) sInput.focus();
    } else {
      bar.style.display = (bar.style.display === 'none' || !bar.style.display) ? 'flex' : 'none';
    }
  },

  /* ══ تاریخ فارسی امروز برای سربرگ ══ */
  _getFormattedToday: function() {
    var td = Jalali.today();
    var p = td.split('/');
    var jy = parseInt(p[0], 10);
    var jm = parseInt(p[1], 10);
    var jd = parseInt(p[2], 10);
    var weekDays = ['یکشنبه', 'دوشنبه', 'سه‌شنبه', 'چهارشنبه', 'پنج‌شنبه', 'جمعه', 'شنبه'];
    var monthNames = ['', 'فروردین', 'اردیبهشت', 'خرداد', 'تیر', 'مرداد', 'شهریور', 'مهر', 'آبان', 'آذر', 'دی', 'بهمن', 'اسفند'];
    var dayName = weekDays[new Date().getDay()] || '';
    return dayName + '، ' + jd + ' ' + monthNames[jm] + ' ' + jy;
  },

  /* ══ بارگذاری و تجمیع داده‌های جامع داشبورد ══ */
  load: async function() {
    try {
      if (typeof Chk !== 'undefined' && typeof Chk.autoPassDueChecks === 'function') {
        await Chk.autoPassDueChecks();
      }
    } catch (chkErr) {
      console.warn('Chk.autoPassDueChecks non-fatal:', chkErr);
    }

    var contacts = (await DB.all('contacts')) || [];
    var fiscalYears = (await DB.all('fiscalYears')) || [];
    var currentYear = null;
    if (STATE.yearId != null) {
      try { currentYear = await DB.get('fiscalYears', STATE.yearId); } catch (e) {}
    }
    if (!currentYear && fiscalYears.length) {
      currentYear = fiscalYears.find(function(y) { return y && y.isCurrent && !y.isClosed; }) || fiscalYears[fiscalYears.length - 1];
    }

    var allInvs = (await FY.byYear('invoices')) || [];

    /* هوشمندی انتخاب سال مالی در صورت عدم وجود فاکتور در سال فعلی */
    if (!allInvs.length) {
      var totalInvs = (await DB.all('invoices')) || [];
      if (totalInvs.length > 0) {
        var yearCounts = {};
        totalInvs.forEach(function(inv) {
          if (!inv) return;
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
          try { currentYear = await DB.get('fiscalYears', STATE.yearId); } catch (e) {}
          allInvs = (await FY.byYear('invoices')) || [];
        } else if (!allInvs.length) {
          allInvs = totalInvs;
        }
      }
    }

    var cMap = {};
    contacts.forEach(function(c) {
      if (c && c.id != null) cMap[c.id] = c.name;
    });

    var banks = (await DB.all('banks')) || [];
    var dashPays = (await FY.byYear('payments')) || [];
    var dashChks = (await FY.byYear('checks')) || [];
    var dashBts = [];
    try { dashBts = (await DB.all('bankTransfers')) || []; } catch (e) {}

    var products = (await DB.all('products')) || [];
    var categories = (await DB.all('categories')) || [];
    var catMap = {};
    categories.forEach(function(ct) { if (ct && ct.id != null) catMap[ct.id] = ct.name; });

    var stockMap = {};
    try { stockMap = (await Prod.stockMap()) || {}; } catch (e) { stockMap = {}; }
    var dashBalMap = {};
    try { dashBalMap = (await Con.allBalances()) || {}; } catch (e) { dashBalMap = {}; }

    /* ══ محاسبه مرزهای زمانی بازه انتخابی ══ */
    var today = Jalali.today();
    var startNum = 0, endNum = 0;
    var rangeDescription = '';

    if (this.period === 'week') {
      var sDt = Jalali.addDays(today, -7);
      startNum = pn(sDt);
      endNum = pn(today);
      rangeDescription = '۷ روز اخیر (' + sDt + ' تا ' + today + ')';
    } else if (this.period === 'month') {
      var sDt = Jalali.addMonths(today, -1);
      startNum = pn(sDt);
      endNum = pn(today);
      rangeDescription = '۳۰ روز اخیر (' + sDt + ' تا ' + today + ')';
    } else if (this.period === 'quarter') {
      var sDt = Jalali.addMonths(today, -3);
      startNum = pn(sDt);
      endNum = pn(today);
      rangeDescription = '۳ ماه اخیر (' + sDt + ' تا ' + today + ')';
    } else if (this.period === 'year') {
      if (currentYear && currentYear.startDate) {
        startNum = pn(currentYear.startDate);
        endNum = pn(currentYear.endDate || today);
        rangeDescription = 'سال مالی ' + esc(currentYear.name || '') + ' (' + currentYear.startDate + ' تا ' + (currentYear.endDate || today) + ')';
      } else {
        var sDt = Jalali.addMonths(today, -12);
        startNum = pn(sDt);
        endNum = pn(today);
        rangeDescription = 'سال جاری';
      }
    } else if (this.period === 'custom') {
      startNum = pn(this.customStart);
      endNum = pn(this.customEnd);
      rangeDescription = 'بازه دلخواه (' + (this.customStart || '—') + ' تا ' + (this.customEnd || '—') + ')';
    } else {
      startNum = 0;
      endNum = 0;
      rangeDescription = 'تمام دوران فعالیت';
    }

    /* فیلتر فاکتورهای دوره */
    var periodInvs = allInvs.filter(function(inv) {
      if (!inv || inv.type === 'proforma') return false;
      var dNum = pn(inv.date);
      if (startNum > 0 && dNum < startNum) return false;
      if (endNum > 0 && dNum > endNum) return false;
      return true;
    });

    var tPur = 0, purCount = 0;
    var tSal = 0, salCount = 0;
    var cashPaidOnSales = 0;
    periodInvs.forEach(function(v) {
      if (!v) return;
      if (v.type === 'purchase') {
        tPur += numOf(v.grandTotal);
        purCount++;
      } else if (v.type === 'sale') {
        tSal += numOf(v.grandTotal);
        cashPaidOnSales += numOf(v.paidAmount);
        salCount++;
      }
    });

    /* ══ محاسبه سود و زیان (P&L) از منبع حقیقت FinanceEngine ══ */
    var plData = FinanceEngine.calculatePeriodPL(allInvs, dashPays, startNum, endNum);
    var netSales = plData.netSales || 0;
    var totalCOGS = plData.cogs || 0;
    var grossProfit = plData.grossProfit || 0;
    var brokerCommissions = plData.brokerCommissions || 0;
    var profitAfterBroker = grossProfit - brokerCommissions;
    var netProfit = plData.netOperatingProfit || 0;
    var grossMarginPct = plData.grossMarginPct || 0;
    var netMarginPct = plData.netMarginPct || 0;
    var unverifiedItemsCount = plData.unverifiedItemsCount || 0;
    var unverifiedRevenueTotal = plData.unverifiedRevenueTotal || 0;
    var hasUnverified = unverifiedItemsCount > 0;

    /* ══ محاسبه دقیق مانده نقد و بانک‌ها از منبع واحد حقیقت (FinanceEngine.calculateBankBalances) ══ */
    var bankCalc = (typeof FinanceEngine !== 'undefined' && typeof FinanceEngine.calculateBankBalances === 'function')
      ? FinanceEngine.calculateBankBalances(banks, dashPays, dashBts, { startNum: startNum, endNum: endNum })
      : null;

    var bankBalances = bankCalc ? bankCalc.bankBalances : [];
    var totalBankBal = bankCalc ? bankCalc.totalBankBal : 0;
    var bankReceiptsPeriod = bankCalc ? bankCalc.bankReceiptsPeriod : 0;
    var bankPaymentsPeriod = bankCalc ? bankCalc.bankPaymentsPeriod : 0;

    if (!bankCalc) {
      console.error('[Dashboard] خطای اساسی مالی: ماژول FinanceEngine بارگذاری نشده است! جهت جلوگیری از دوباره‌شماری و مغایرت، از اجرای محاسبات موازی خودداری شد.');
      banks.forEach(function(b) {
        if (!b) return;
        var ob = numOf(b.openingBalance);
        bankBalances.push({
          id: b.id,
          name: b.name,
          bankName: b.bankName || '',
          accountNumber: b.accountNumber || '',
          balance: ob
        });
        totalBankBal += ob;
      });
    }

    /* ══ تجمیع مطالبات (بدهکاران) و بدهی‌ها (بستانکاران) از Con.allBalances ══ */
    var totalDebtors = 0, debtorCount = 0, debtorList = [];
    var totalCreditors = 0, creditorCount = 0, creditorList = [];

    contacts.forEach(function(co) {
      if (!co) return;
      var cBal = dashBalMap[co.id] || 0;
      if (cBal > 0) {
        totalDebtors += cBal;
        debtorCount++;
        debtorList.push({ id: co.id, name: co.name, phone: co.phone, balance: cBal, type: co.type });
      } else if (cBal < 0) {
        var absBal = Math.abs(cBal);
        totalCreditors += absBal;
        creditorCount++;
        creditorList.push({ id: co.id, name: co.name, phone: co.phone, balance: absBal, rawBal: cBal, type: co.type });
      }
    });

    debtorList.sort(function(a, b) { return b.balance - a.balance; });
    creditorList.sort(function(a, b) { return b.balance - a.balance; });
    var top5Debtors = debtorList.slice(0, 5);
    var top5Creditors = creditorList.slice(0, 5);

    /* ══ ارزش‌گذاری شفاف موجودی انبار بر اساس آخرین فاکتورهای خرید موثق ══ */
    var latestBuyPrices = {};
    allInvs.forEach(function(inv) {
      if (!inv || inv.type !== 'purchase') return;
      (inv.items || []).forEach(function(it) {
        if (it && it.productId && numOf(it.unitPrice) > 0) {
          if (!latestBuyPrices[it.productId] || pn(inv.date) >= pn(latestBuyPrices[it.productId].date)) {
            latestBuyPrices[it.productId] = { price: numOf(it.unitPrice), date: inv.date };
          }
        }
      });
    });

    var totalStockMeters = 0;
    var estimatedInvValue = 0;
    var inStockCount = 0;
    var outOfStockCount = 0;
    var lowStockProducts = [];
    var outOfStockProducts = [];
    var prodsWithVerifiedPrice = 0;
    var prodsWithoutBuyPrice = 0;

    products.forEach(function(p) {
      if (!p || p.id == null) return;
      var st = stockMap[p.id] || 0;
      if (st > 0) {
        totalStockMeters += st;
        inStockCount++;
        var bp = (latestBuyPrices[p.id] ? latestBuyPrices[p.id].price : 0) || numOf(p.buyPrice);
        if (bp > 0) {
          estimatedInvValue += (st * bp);
          prodsWithVerifiedPrice++;
        } else {
          prodsWithoutBuyPrice++;
        }
        if (p.minStock && st <= p.minStock) {
          lowStockProducts.push({ id: p.id, name: p.name, stock: st, minStock: p.minStock, unit: p.unit });
        }
      } else {
        outOfStockCount++;
        outOfStockProducts.push({ id: p.id, name: p.name, stock: st, unit: p.unit });
      }
    });

    /* ══ تحلیل ۱۰ مشتری برتر دوره ══ */
    var custSalesMap = {};
    periodInvs.forEach(function(inv) {
      if (!inv || inv.type !== 'sale') return;
      var cid = inv.contactId || 'unknown';
      if (!custSalesMap[cid]) {
        custSalesMap[cid] = {
          contactId: inv.contactId,
          name: cMap[inv.contactId] || 'مشتری آزاد',
          invoiceCount: 0,
          totalSales: 0,
          paidAmount: 0
        };
      }
      custSalesMap[cid].invoiceCount++;
      custSalesMap[cid].totalSales += numOf(inv.grandTotal);
      custSalesMap[cid].paidAmount += numOf(inv.paidAmount);
    });

    var topCustomersList = [];
    for (var k in custSalesMap) {
      topCustomersList.push(custSalesMap[k]);
    }
    topCustomersList.sort(function(a, b) { return b.totalSales - a.totalSales; });
    var top10Customers = topCustomersList.slice(0, 10);

    /* ══ تحلیل سود کالاها از productBreakdown ══ */
    var prodProfitList = [];
    for (var pk in plData.productBreakdown) {
      var pb = plData.productBreakdown[pk];
      if (!pb) continue;
      var avgSell = pb.qty > 0 ? Math.round(pb.revenue / pb.qty) : 0;
      var pMargin = pb.revenue > 0 ? (pb.profit / pb.revenue) * 100 : 0;
      prodProfitList.push({
        id: pb.id,
        name: pb.name,
        qty: pb.qty,
        avgSell: avgSell,
        cogs: pb.cogs,
        revenue: pb.revenue,
        profit: pb.profit,
        margin: pMargin,
        unverified: pb.unverifiedCount > 0,
        unverifiedCount: pb.unverifiedCount
      });
    }

    /* ══ کالاهای پرفروش و کم‌گردش ══ */
    var topMovers = prodProfitList.slice().sort(function(a, b) { return b.qty - a.qty; }).slice(0, 5);
    var slowMovers = [];
    products.forEach(function(p) {
      if (!p) return;
      var matched = prodProfitList.find(function(x) { return x.id === p.id; });
      if (!matched) {
        slowMovers.push({ id: p.id, name: p.name, stock: stockMap[p.id] || 0, unit: p.unit });
      }
    });
    slowMovers = slowMovers.slice(0, 5);

    /* ══ تحلیل چک‌های صیادی و سررسید با گارد امنیتی ══ */
    var dueAnalysis = (typeof Chk !== 'undefined' && typeof Chk.getDueAnalysis === 'function') ?
      Chk.getDueAnalysis(dashChks) :
      { overdue: [], dueToday: [], within3: [], within7: [], allUrgent: [], totalIssuedAmt: 0, totalReceivedAmt: 0, count: 0 };

    var overdueChecks = dueAnalysis.overdue || [];
    var within7Checks = dueAnalysis.within7 || []; // دقت: فیلد داخل Chk.getDueAnalysis به نام within7 است
    var returnedChecks = (dashChks || []).filter(function(c) {
      return c && (c.status === 'returned' || c.status === 'returned_to_me' || c.status === 'returned_to_customer');
    });

    /* ══ آخرین فعالیت‌های تجاری برنامه ══ */
    var recentActivities = [];
    allInvs.filter(function(x) { return x && x.type === 'sale'; }).slice(0, 5).forEach(function(inv) {
      recentActivities.push({
        kind: 'sale',
        typeLabel: 'فاکتور فروش',
        id: inv.id,
        num: inv.invoiceNumber || '—',
        person: cMap[inv.contactId] || 'مشتری آزاد',
        date: inv.date,
        amount: numOf(inv.grandTotal),
        status: (numOf(inv.paidAmount) >= numOf(inv.grandTotal)) ? 'تسویه' : 'مانده: ' + UI.fn(numOf(inv.grandTotal) - numOf(inv.paidAmount)),
        isPositive: true,
        action: 'Inv.vw(' + inv.id + ')'
      });
    });

    allInvs.filter(function(x) { return x && x.type === 'purchase'; }).slice(0, 5).forEach(function(inv) {
      recentActivities.push({
        kind: 'purchase',
        typeLabel: 'فاکتور خرید',
        id: inv.id,
        num: inv.invoiceNumber || '—',
        person: cMap[inv.contactId] || 'تأمین‌کننده',
        date: inv.date,
        amount: numOf(inv.grandTotal),
        status: (numOf(inv.paidAmount) >= numOf(inv.grandTotal)) ? 'تسویه' : 'مانده: ' + UI.fn(numOf(inv.grandTotal) - numOf(inv.paidAmount)),
        isPositive: false,
        action: 'Inv.vw(' + inv.id + ')'
      });
    });

    dashPays.slice(0, 5).forEach(function(p) {
      if (!p) return;
      recentActivities.push({
        kind: 'payment',
        typeLabel: p.type === 'receipt' ? 'دریافت وجه' : 'پرداخت وجه',
        id: p.id,
        num: p.category || 'تراکنش',
        person: cMap[p.contactId] || p.note || '—',
        date: p.date,
        amount: numOf(p.amount),
        status: 'ثبت شد',
        isPositive: p.type === 'receipt',
        action: 'ROUTES.payments()'
      });
    });

    dashChks.slice(0, 5).forEach(function(c) {
      if (!c) return;
      recentActivities.push({
        kind: 'check',
        typeLabel: c.type === 'received' ? 'چک دریافتی' : 'چک پرداختی',
        id: c.id,
        num: c.checkNumber || '—',
        person: cMap[c.contactId] || '—',
        date: c.dueDate || c.date,
        amount: numOf(c.amount),
        status: Chk.sl ? Chk.sl(c.status) : (c.status || '—'),
        isPositive: c.type === 'received',
        action: 'Chk.form(\'' + c.type + '\',' + c.id + ')'
      });
    });

    recentActivities.sort(function(a, b) { return (pn(b.date) - pn(a.date)) || ((b.id || 0) - (a.id || 0)); });

    /* ══ ذخیره وضعیت در حافظه کش برای فیلتر و تعامل آنی ══ */
    this.lastUpdated = new Date().toLocaleTimeString('fa-IR');
    this._cache = {
      contacts: contacts,
      cMap: cMap,
      allInvs: allInvs,
      periodInvs: periodInvs,
      plData: plData,
      banks: banks,
      bankBalances: bankBalances,
      totalBankBal: totalBankBal,
      bankReceiptsPeriod: bankReceiptsPeriod,
      bankPaymentsPeriod: bankPaymentsPeriod,
      totalDebtors: totalDebtors,
      debtorCount: debtorCount,
      top5Debtors: top5Debtors,
      totalCreditors: totalCreditors,
      creditorCount: creditorCount,
      top5Creditors: top5Creditors,
      products: products,
      stockMap: stockMap,
      totalStockMeters: totalStockMeters,
      estimatedInvValue: estimatedInvValue,
      inStockCount: inStockCount,
      outOfStockCount: outOfStockCount,
      lowStockProducts: lowStockProducts,
      outOfStockProducts: outOfStockProducts,
      topMovers: topMovers,
      slowMovers: slowMovers,
      top10Customers: top10Customers,
      prodProfitList: prodProfitList,
      dueAnalysis: dueAnalysis,
      overdueChecks: overdueChecks,
      within7Checks: within7Checks,
      returnedChecks: returnedChecks,
      recentActivities: recentActivities,
      startNum: startNum,
      endNum: endNum,
      rangeDescription: rangeDescription
    };

    /* ══ رندر HTML کامل داشبورد ══ */
    var h = '<div class="erp-dash">';

    /* ── بنر راهنمای بازیابی یا تست PWA در صورت خالی بودن دیتابیس ── */
    if (contacts.length === 0 && allInvs.length === 0 && products.length === 0) {
      var supaReady = typeof Sync !== 'undefined' && Sync.getConfig().configured;
      h += '<div class="hint-box" style="margin-bottom:6px;background:rgba(37,99,235,.07);border:1.5px solid var(--p);border-radius:12px;padding:16px;display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:14px">' +
        '<div>' +
        '<div style="font-weight:700;font-size:.95rem;color:var(--p);margin-bottom:4px"><i class="bi bi-phone"></i> پایگاه داده در این بخش یا دستگاه خالی است</div>' +
        '<div style="font-size:.84rem;color:var(--txs);line-height:1.7">' +
        (supaReady ?
          'اتصال به پایگاه داده ابری Supabase برقرار است. می‌توانید با یک کلیک اطلاعات خود را از سرور بازیابی کنید، یا در صورت تمایل فایل پشتیبان آفلاین (JSON) را بارگذاری نمایید.' :
          'در صورتی که قبلاً در مرورگر یا دستگاه دیگر نسخه پشتیبان تهیه کرده‌اید، می‌توانید فایل پشتیبان (JSON) را بازیابی نمایید.') +
        '</div>' +
        '</div>' +
        '<div style="display:flex;gap:8px;flex-wrap:wrap">' +
        '<button class="btn bo" onclick="PWA.showHealthModal()"><i class="bi bi-activity"></i> تست سلامت دیتابیس</button>' +
        (supaReady ? '<button class="btn bs" style="background:var(--ok);color:#fff" onclick="Auth.quickCloudRestore()"><i class="bi bi-cloud-arrow-down-fill"></i> بازیابی فوری از سرور ابری</button>' : '') +
        '<button class="btn bp" onclick="Backup.importAll()"><i class="bi bi-file-earmark-arrow-up"></i> بازیابی فایل پشتیبان</button>' +
        '</div>' +
        '</div>';
    }

    /* ── هدر مدیریتی ۳۶۰ درجه ── */
    var supaCfg = (typeof Sync !== 'undefined') ? Sync.getConfig() : { configured: false };
    var isOnline = navigator.onLine;
    var syncBadge = supaCfg.configured ?
      (isOnline ? '<span class="erp-meta-pill" style="color:var(--ok)"><i class="bi bi-cloud-check-fill"></i> همگام ابری</span>' : '<span class="erp-meta-pill" style="color:var(--w)"><i class="bi bi-cloud-slash-fill"></i> آفلاین (ابری)</span>') :
      '<span class="erp-meta-pill" style="color:var(--txs)" title="کلیک برای تنظیم همگام‌سازی ابری" onclick="ROUTES.settings()"><i class="bi bi-hdd"></i> حافظه محلی</span>';

    h += '<div class="erp-header-card">' +
      '<div class="erp-header-top">' +
        '<div class="erp-header-title">' +
          '<h2><i class="bi bi-speedometer2" style="color:var(--p)"></i> داشبورد مدیریتی پارچه‌بان</h2>' +
          '<p>دیدبان عملیات مالی، فروش، وضعیت چک‌های صیادی و موجودی انبار نساجی</p>' +
        '</div>' +
        '<div class="erp-header-meta">' +
          '<span class="erp-meta-pill"><i class="bi bi-calendar3"></i> ' + this._getFormattedToday() + '</span>' +
          '<span class="erp-meta-pill" style="cursor:pointer" onclick="ROUTES.years()" title="مدیریت سال‌های مالی"><i class="bi bi-archive-fill"></i> سال مالی: <strong>' + esc(currentYear ? currentYear.name : 'فعال') + '</strong></span>' +
          syncBadge +
          '<span class="erp-meta-pill" style="font-size:0.75rem;color:var(--txm)"><i class="bi bi-clock-history"></i> ' + this.lastUpdated + '</span>' +
        '</div>' +
      '</div>' +
      '<div class="erp-header-controls">' +
        '<div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">' +
          '<span style="font-size:0.8rem;font-weight:700;color:var(--txs)">دوره گزارش:</span>' +
          '<div class="erp-period-group">' +
            [
              { id: 'week', label: 'هفته جاری' },
              { id: 'month', label: 'ماه جاری' },
              { id: 'quarter', label: '۳ ماهه' },
              { id: 'year', label: 'سال مالی' },
              { id: 'all', label: 'تمام دوران' },
              { id: 'custom', label: 'بازه دلخواه…' }
            ].map(function(item) {
              var activeClass = (Dash.period === item.id) ? ' active' : '';
              return '<button class="erp-period-btn' + activeClass + '" onclick="Dash.setP(\'' + item.id + '\')">' + item.label + '</button>';
            }).join('') +
          '</div>' +
        '</div>' +
        '<div style="font-size:0.8rem;color:var(--txs)">' +
          '<i class="bi bi-info-circle"></i> ' + rangeDescription +
        '</div>' +
      '</div>' +
      '<div class="erp-custom-range-bar" id="dashCustomBar" style="display:' + (this.period === 'custom' ? 'flex' : 'none') + '">' +
        '<span>از تاریخ:</span>' +
        '<input type="text" id="dashStartDt" class="fc" style="width:115px;padding:4px 8px;font-size:0.8rem;text-align:center" value="' + esc(this.customStart || Jalali.addMonths(Jalali.today(), -1)) + '" placeholder="۱۴۰۳/۰۱/۰۱">' +
        '<span>تا تاریخ:</span>' +
        '<input type="text" id="dashEndDt" class="fc" style="width:115px;padding:4px 8px;font-size:0.8rem;text-align:center" value="' + esc(this.customEnd || Jalali.today()) + '" placeholder="۱۴۰۳/۱۲/۲۹">' +
        '<button class="btn bp bs" onclick="Dash.applyCustomRange()"><i class="bi bi-check-lg"></i> اعمال بازه</button>' +
        '<button class="btn bo bs" onclick="Dash.setP(\'month\')">انصراف</button>' +
      '</div>' +
    '</div>';

    /* ── بخش اول: ۸ شاخص کلیدی مالی (KPI Cards) ── */
    var profitColorClass = profitAfterBroker >= 0 ? 'green' : 'red';
    var netColorClass = netProfit >= 0 ? 'blue' : 'red';
    var avgInvoiceVal = salCount > 0 ? Math.round(netSales / salCount) : 0;

    h += '<div class="erp-kpi-grid">';

    // ۱. فروش دوره
    h += '<div class="erp-kpi-card" onclick="ROUTES.sales()" title="مشاهده فاکتورهای فروش">' +
      '<div class="erp-kpi-head">' +
        '<span class="erp-kpi-title">فروش دوره</span>' +
        '<div class="erp-kpi-icon blue"><i class="bi bi-receipt-cutoff"></i></div>' +
      '</div>' +
      '<div class="erp-kpi-value">' + UI.fn(netSales) + ' <small style="font-size:0.8rem;font-weight:500">ریال</small></div>' +
      '<div class="erp-kpi-sub">' +
        '<span>' + UI.fn(salCount) + ' فاکتور · میانگین ' + UI.fn(avgInvoiceVal) + '</span>' +
        '<span class="erp-kpi-link-hint">مشاهده ←</span>' +
      '</div>' +
    '</div>';

    // ۲. خرید دوره
    h += '<div class="erp-kpi-card" onclick="ROUTES.purchase()" title="مشاهده فاکتورهای خرید">' +
      '<div class="erp-kpi-head">' +
        '<span class="erp-kpi-title">خرید دوره</span>' +
        '<div class="erp-kpi-icon amber"><i class="bi bi-cart-fill"></i></div>' +
      '</div>' +
      '<div class="erp-kpi-value">' + UI.fn(tPur) + ' <small style="font-size:0.8rem;font-weight:500">ریال</small></div>' +
      '<div class="erp-kpi-sub">' +
        '<span>' + UI.fn(purCount) + ' فاکتور تأمین کالا</span>' +
        '<span class="erp-kpi-link-hint">مشاهده ←</span>' +
      '</div>' +
    '</div>';

    // ۳. سود ناخالص (پس از کسر کمیسیون واسطه‌ها)
    var card3Title = hasUnverified
      ? (brokerCommissions > 0 ? 'سود قابل‌تأیید (پس از کمیسیون)' : 'سود ناخالص قابل‌تأیید')
      : (brokerCommissions > 0 ? 'سود ناخالص (پس از کمیسیون)' : 'سود ناخالص بازرگانی');
    var card3Tooltip = hasUnverified
      ? 'سود قابل‌تأیید بر پایه اقلام دارای بهای موثق — سود نهایی دوره قابل تعیین نیست'
      : 'سود ناخالص بازرگانی بر پایه بهای تمام‌شده موثق';

    h += '<div class="erp-kpi-card" onclick="ROUTES.profit()" title="' + card3Tooltip + '">' +
      '<div class="erp-kpi-head">' +
        '<span class="erp-kpi-title">' + card3Title + '</span>' +
        '<div class="erp-kpi-icon ' + profitColorClass + '"><i class="bi bi-graph-up-arrow"></i></div>' +
      '</div>' +
      '<div class="erp-kpi-value" style="color:' + (profitAfterBroker >= 0 ? 'var(--ok)' : 'var(--d)') + '">' +
        UI.fn(Math.round(profitAfterBroker)) + ' <small style="font-size:0.8rem;font-weight:500">ریال</small>' +
      '</div>' +
      '<div class="erp-kpi-sub">' +
        (hasUnverified
          ? '<span style="color:var(--w);font-weight:600" title="' + unverifiedItemsCount + ' قلم فاقد قیمت خرید">⚠ سود نهایی دوره قابل تعیین نیست</span>'
          : '<span>حاشیه سود: ' + grossMarginPct.toFixed(1) + '٪</span>') +
        '<span class="erp-kpi-link-hint">صورت P&L ←</span>' +
      '</div>' +
    '</div>';

    // ۴. سود خالص عملیاتی
    var card4Title = hasUnverified ? 'سود خالص قابل‌تأیید' : 'سود خالص عملیاتی';
    var card4Tooltip = hasUnverified
      ? 'سود خالص قابل‌تأیید بر پایه اقلام معتبر پس از کسر هزینه‌ها — سود نهایی دوره قابل تعیین نیست'
      : 'سود خالص عملیاتی پس از کسر هزینه‌های جاری';

    h += '<div class="erp-kpi-card" onclick="ROUTES.profit()" title="' + card4Tooltip + '">' +
      '<div class="erp-kpi-head">' +
        '<span class="erp-kpi-title">' + card4Title + '</span>' +
        '<div class="erp-kpi-icon ' + netColorClass + '"><i class="bi bi-award-fill"></i></div>' +
      '</div>' +
      '<div class="erp-kpi-value" style="color:' + (netProfit >= 0 ? 'var(--p)' : 'var(--d)') + '">' +
        UI.fn(Math.round(netProfit)) + ' <small style="font-size:0.8rem;font-weight:500">ریال</small>' +
      '</div>' +
      '<div class="erp-kpi-sub">' +
        (hasUnverified
          ? '<span style="color:var(--w);font-size:11.5px">سود نهایی نامشخص (' + UI.fn(unverifiedItemsCount) + ' قلم بدون بهای خرید)</span>'
          : '<span>حاشیه خالص: ' + netMarginPct.toFixed(1) + '٪</span>') +
        '<span class="erp-kpi-link-hint">جزئیات ←</span>' +
      '</div>' +
    '</div>';

    // ۵. طلب از مشتریان (مطالبات)
    h += '<div class="erp-kpi-card" onclick="ROUTES.debtors()" title="مشاهده لیست بدهکاران">' +
      '<div class="erp-kpi-head">' +
        '<span class="erp-kpi-title">طلب از مشتریان</span>' +
        '<div class="erp-kpi-icon cyan"><i class="bi bi-arrow-down-left-circle-fill"></i></div>' +
      '</div>' +
      '<div class="erp-kpi-value" style="color:var(--p)">' + UI.fn(totalDebtors) + ' <small style="font-size:0.8rem;font-weight:500">ریال</small></div>' +
      '<div class="erp-kpi-sub">' +
        '<span>' + UI.fn(debtorCount) + ' مشتری بدهکار</span>' +
        '<span class="erp-kpi-link-hint">بدهکاران ←</span>' +
      '</div>' +
    '</div>';

    // ۶. بدهی به تأمین‌کنندگان
    h += '<div class="erp-kpi-card" onclick="ROUTES.creditors()" title="مشاهده لیست بستانکاران">' +
      '<div class="erp-kpi-head">' +
        '<span class="erp-kpi-title">بدهی به تأمین‌کنندگان</span>' +
        '<div class="erp-kpi-icon red"><i class="bi bi-arrow-up-right-circle-fill"></i></div>' +
      '</div>' +
      '<div class="erp-kpi-value" style="color:var(--d)">' + UI.fn(totalCreditors) + ' <small style="font-size:0.8rem;font-weight:500">ریال</small></div>' +
      '<div class="erp-kpi-sub">' +
        '<span>' + UI.fn(creditorCount) + ' تأمین‌کننده بستانکار</span>' +
        '<span class="erp-kpi-link-hint">بستانکاران ←</span>' +
      '</div>' +
    '</div>';

    // ۷. موجودی نقد و بانک‌ها
    h += '<div class="erp-kpi-card" onclick="ROUTES.banks()" title="مشاهده حساب‌های بانکی و صندوق">' +
      '<div class="erp-kpi-head">' +
        '<span class="erp-kpi-title">مانده نقد و بانک‌ها</span>' +
        '<div class="erp-kpi-icon purple"><i class="bi bi-bank2"></i></div>' +
      '</div>' +
      '<div class="erp-kpi-value">' + UI.fn(totalBankBal) + ' <small style="font-size:0.8rem;font-weight:500">ریال</small></div>' +
      '<div class="erp-kpi-sub">' +
        '<span>' + UI.fn(banks.length) + ' حساب بانکی و صندوق</span>' +
        '<span class="erp-kpi-link-hint">دفتر بانک ←</span>' +
      '</div>' +
    '</div>';

    // ۸. ارزش موجودی انبار
    var invValNote = (prodsWithoutBuyPrice > 0) ?
      'ارزش برآوردی (' + UI.fn(prodsWithVerifiedPrice) + ' کالا با قیمت موثق)' :
      'ارزش کالاهای دارای موجودی';

    h += '<div class="erp-kpi-card" onclick="ROUTES.warehouse()" title="' + invValNote + '">' +
      '<div class="erp-kpi-head">' +
        '<span class="erp-kpi-title">ارزش موجودی انبار</span>' +
        '<div class="erp-kpi-icon green"><i class="bi bi-boxes"></i></div>' +
      '</div>' +
      '<div class="erp-kpi-value">' + UI.fn(Math.round(estimatedInvValue)) + ' <small style="font-size:0.8rem;font-weight:500">ریال</small></div>' +
      '<div class="erp-kpi-sub">' +
        '<span>' + UI.fn(totalStockMeters) + ' متر در انبار' + (prodsWithoutBuyPrice > 0 ? ' <span style="color:var(--w)" title="' + prodsWithoutBuyPrice + ' قلم کالا فاقد قیمت خرید">⚠</span>' : '') + '</span>' +
        '<span class="erp-kpi-link-hint">انبارداری ←</span>' +
      '</div>' +
    '</div>';

    h += '</div>';

    /* ── بخش ششم: هشدارهای هوشمند و نیازمند توجه (Attention Center) ── */
    var alertItemsHtml = '';

    if (overdueChecks.length > 0) {
      alertItemsHtml += '<div class="erp-alert-item" onclick="Chk.ll(\'overdue\')">' +
        '<div class="erp-alert-lead">' +
          '<span class="erp-alert-badge danger"><i class="bi bi-exclamation-octagon-fill"></i> فوری</span>' +
          '<strong>' + UI.fn(overdueChecks.length) + ' فقره چک سررسید گذشته:</strong> لطفاً جهت وصول یا پیگیری اقدام فرمایید.' +
        '</div>' +
        '<span class="erp-kpi-link-hint">رسیدگی ←</span>' +
      '</div>';
    }

    if (within7Checks.length > 0) {
      alertItemsHtml += '<div class="erp-alert-item" onclick="Chk.ll(\'due7\')">' +
        '<div class="erp-alert-lead">' +
          '<span class="erp-alert-badge warning"><i class="bi bi-calendar-event"></i> ۷ روز آینده</span>' +
          '<strong>' + UI.fn(within7Checks.length) + ' فقره چک با سررسید نزدیک:</strong> ' +
          (dueAnalysis.totalIssuedAmt > 0 ? 'تأمین موجودی پرداختی: ' + UI.fn(dueAnalysis.totalIssuedAmt) + ' ریال' : '') +
          (dueAnalysis.totalReceivedAmt > 0 ? ' · دریافتی آماده واگذاری: ' + UI.fn(dueAnalysis.totalReceivedAmt) + ' ریال' : '') +
        '</div>' +
        '<span class="erp-kpi-link-hint">مشاهده ←</span>' +
      '</div>';
    }

    if (returnedChecks.length > 0) {
      alertItemsHtml += '<div class="erp-alert-item" onclick="Chk.ll(\'returned\')">' +
        '<div class="erp-alert-lead">' +
          '<span class="erp-alert-badge danger"><i class="bi bi-arrow-return-left"></i> برگشتی</span>' +
          '<strong>' + UI.fn(returnedChecks.length) + ' فقره چک برگشتی:</strong> نیازمند پیگیری حقوقی یا استرداد.' +
        '</div>' +
        '<span class="erp-kpi-link-hint">بررسی ←</span>' +
      '</div>';
    }

    if (lowStockProducts.length > 0) {
      alertItemsHtml += '<div class="erp-alert-item" onclick="ROUTES.warehouse()">' +
        '<div class="erp-alert-lead">' +
          '<span class="erp-alert-badge warning"><i class="bi bi-box-seam"></i> سفارش کالا</span>' +
          '<strong>' + UI.fn(lowStockProducts.length) + ' قلم کالا به نقطه سفارش رسیده‌اند:</strong> (' +
          lowStockProducts.slice(0, 3).map(function(p) { return esc(p.name); }).join('، ') +
          (lowStockProducts.length > 3 ? ' و ...' : '') + ')' +
        '</div>' +
        '<span class="erp-kpi-link-hint">مشاهده انبار ←</span>' +
      '</div>';
    }

    if (hasUnverified) {
      alertItemsHtml += '<div class="erp-alert-item" onclick="ROUTES.profit()">' +
        '<div class="erp-alert-lead">' +
          '<span class="erp-alert-badge warning" style="background:rgba(217,119,6,.15);color:var(--w)"><i class="bi bi-exclamation-triangle-fill"></i> سود نهایی نامشخص</span>' +
          '<strong>سود نهایی دوره قابل تعیین نیست:</strong> تعداد ' + UI.fn(unverifiedItemsCount) + ' قلم کالا در فروش‌های دوره فاقد بهای خرید معتبر هستند. سود نمایش‌داده‌شده صرفاً «سود قابل‌تأیید» است و نباید به عنوان سود قطعی کل دوره تلقی گردد.' +
        '</div>' +
        '<span class="erp-kpi-link-hint">گزارش سود ←</span>' +
      '</div>';
    }

    if (plData.unclassifiedPayments > 0) {
      alertItemsHtml += '<div class="erp-alert-item" onclick="ROUTES.payments()">' +
        '<div class="erp-alert-lead">' +
          '<span class="erp-alert-badge info"><i class="bi bi-tags"></i> سرفصل هزینه</span>' +
          '<strong>مبلغ ' + UI.fn(plData.unclassifiedPayments) + ' ریال پرداخت فاقد سرفصل مشخص هزینه:</strong> در جدول P&L جدا شده و خودکار کسر نشده است.' +
        '</div>' +
        '<span class="erp-kpi-link-hint">تخصیص سرفصل ←</span>' +
      '</div>';
    }

    var isDefaultPass = false;
    try { isDefaultPass = await Auth.isDefaultAdminPass(); } catch (e) {}
    if (isDefaultPass && Perm.can('*')) {
      alertItemsHtml += '<div class="erp-alert-item" onclick="ROUTES.settings()">' +
        '<div class="erp-alert-lead">' +
          '<span class="erp-alert-badge danger"><i class="bi bi-shield-exclamation"></i> امنیت</span>' +
          '<strong>رمز عبور مدیر هنوز پیش‌فرض (admin123) است:</strong> برای امنیت اطلاعات آن را تغییر دهید.' +
        '</div>' +
        '<span class="erp-kpi-link-hint">تنظیمات ←</span>' +
      '</div>';
    }

    if (!supaCfg.configured && Perm.can('*')) {
      alertItemsHtml += '<div class="erp-alert-item" onclick="ROUTES.settings()">' +
        '<div class="erp-alert-lead">' +
          '<span class="erp-alert-badge info"><i class="bi bi-cloud-arrow-up"></i> همگام‌سازی</span>' +
          '<strong>اتصال ابری فعال نیست:</strong> برای همگام‌سازی دائمی فاکتورها بین گوشی و رایانه، اتصال Supabase را تنظیم فرمایید.' +
        '</div>' +
        '<span class="erp-kpi-link-hint">پیکربندی ←</span>' +
      '</div>';
    }

    if (alertItemsHtml) {
      h += '<div class="erp-alerts-panel">' +
        '<div class="erp-alerts-header">' +
          '<div style="display:flex;align-items:center;gap:8px;font-weight:700">' +
            '<i class="bi bi-bell-fill" style="color:var(--w)"></i>' +
            '<span>مرکز توجه و هشدارهای مدیریتی</span>' +
          '</div>' +
          '<span style="font-size:0.75rem;color:var(--txs)">اقدامات نیازمند تصمیم‌گیری</span>' +
        '</div>' +
        '<div class="erp-alerts-list">' + alertItemsHtml + '</div>' +
      '</div>';
    }

    /* ── بخش دوم: نمودارهای تحلیلی عملکرد مالی ── */
    h += '<div class="g2" style="margin-top:4px">' +
      '<div class="cd">' +
        '<div class="cd-h" style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:8px">' +
          '<div style="display:flex;align-items:center;gap:8px;font-weight:700">' +
            '<i class="bi bi-bar-chart-line-fill" style="color:var(--p)"></i>' +
            '<span>روند عملکرد فروش و سودآوری</span>' +
          '</div>' +
          '<div class="erp-period-group">' +
            '<button class="erp-period-btn' + (this.chartView === 'combined' ? ' active' : '') + '" onclick="Dash.setChartView(\'combined\')">فروش و سود</button>' +
            '<button class="erp-period-btn' + (this.chartView === 'salesPur' ? ' active' : '') + '" onclick="Dash.setChartView(\'salesPur\')">فروش و خرید</button>' +
          '</div>' +
        '</div>' +
        '<div class="cd-b" style="height:280px;position:relative">' +
          '<canvas id="dashPerfChart"></canvas>' +
        '</div>' +
      '</div>' +
      '<div class="cd">' +
        '<div class="cd-h" style="display:flex;align-items:center;justify-content:space-between">' +
          '<div style="display:flex;align-items:center;gap:8px;font-weight:700">' +
            '<i class="bi bi-pie-chart-fill" style="color:var(--ok)"></i>' +
            '<span>سهم مشتریان برتر در فروش</span>' +
          '</div>' +
          '<span style="font-size:0.75rem;color:var(--txs)">تمرکز درآمدی</span>' +
        '</div>' +
        '<div class="cd-b" style="height:280px;position:relative">' +
          '<canvas id="dashCustChart"></canvas>' +
        '</div>' +
      '</div>' +
    '</div>';

    /* ── بخش سوم: تحلیل فروش و جدول ۱۰ مشتری برتر ── */
    var creditSales = Math.max(0, netSales - cashPaidOnSales);
    var cashPct = netSales > 0 ? Math.round((cashPaidOnSales / netSales) * 100) : 0;
    var creditPct = 100 - cashPct;

    h += '<div class="cd">' +
      '<div class="cd-h" style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:8px">' +
        '<div style="display:flex;align-items:center;gap:8px;font-weight:700">' +
          '<i class="bi bi-people-fill" style="color:var(--p)"></i>' +
          '<span>تحلیل مشتریان و ۱۰ خریدار برتر دوره</span>' +
        '</div>' +
        '<div style="display:flex;gap:12px;font-size:0.8rem;color:var(--txs)">' +
          '<span>فروش نقدی فاکتورها: <strong>' + UI.fn(cashPaidOnSales) + ' (' + cashPct + '٪)</strong></span>' +
          '<span>فروش نسیه/مانده: <strong>' + UI.fn(creditSales) + ' (' + creditPct + '٪)</strong></span>' +
        '</div>' +
      '</div>';

    if (top10Customers.length > 0) {
      var custRows = '';
      top10Customers.forEach(function(c, i) {
        var cBal = dashBalMap[c.contactId] || 0;
        var bStr = cBal > 0 ? ('<span style="color:var(--p);font-weight:700">' + UI.fn(cBal) + ' بدهکار</span>') :
          (cBal < 0 ? ('<span style="color:var(--d);font-weight:700">' + UI.fn(Math.abs(cBal)) + ' بستانکار</span>') :
          '<span style="color:var(--txs)">تسویه</span>');

        custRows += '<tr class="clk" onclick="Led.show(' + c.contactId + ')" title="کلیک برای مشاهده دفتر معین">' +
          '<td>' + (i + 1) + '</td>' +
          '<td><strong>' + esc(c.name) + '</strong></td>' +
          '<td style="text-align:center">' + UI.fn(c.invoiceCount) + '</td>' +
          '<td style="text-align:left;font-weight:700;font-variant-numeric:tabular-nums">' + UI.fn(c.totalSales) + '</td>' +
          '<td style="text-align:left;font-variant-numeric:tabular-nums">' + UI.fn(c.paidAmount) + '</td>' +
          '<td style="text-align:left">' + bStr + '</td>' +
          '<td style="text-align:center">' +
            '<button class="bi2" title="دفتر معین"><i class="bi bi-journal-text"></i></button>' +
          '</td>' +
        '</tr>';
      });

      h += '<div class="tw"><table><thead><tr>' +
        '<th>#</th><th>نام مشتری</th><th style="text-align:center">تعداد فاکتور</th>' +
        '<th style="text-align:left">مجموع خرید (ریال)</th><th style="text-align:left">پرداختی فاکتورها</th>' +
        '<th style="text-align:left">مانده حساب فعلی</th><th style="text-align:center">دفتر</th>' +
        '</tr></thead><tbody>' + custRows + '</tbody></table></div>';
    } else {
      h += '<div class="em"><i class="bi bi-people"></i><p>در بازه زمانی انتخابی، فاکتور فروشی ثبت نشده است</p></div>';
    }
    h += '</div>';

    /* ── بخش چهارم: تحلیل سود کالاها (Product Profitability Table) ── */
    h += '<div class="cd">' +
      '<div class="cd-h" style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:10px">' +
        '<div style="display:flex;align-items:center;gap:8px;font-weight:700">' +
          '<i class="bi bi-tags-fill" style="color:var(--ok)"></i>' +
          '<span>تحلیل سودآوری و درآمد کالاها</span>' +
        '</div>' +
        '<div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">' +
          '<input type="text" id="dashProdSearch" class="fc" style="width:160px;padding:4px 8px;font-size:0.78rem" placeholder="جستجوی کالا..." oninput="Dash.onProdFilter(this.value)">' +
          '<div class="erp-period-group">' +
            '<button class="erp-period-btn' + (this.prodSort === 'profit' ? ' active' : '') + '" onclick="Dash.setProdSort(\'profit\')">بیشترین سود</button>' +
            '<button class="erp-period-btn' + (this.prodSort === 'sales' ? ' active' : '') + '" onclick="Dash.setProdSort(\'sales\')">بیشترین فروش</button>' +
          '</div>' +
        '</div>' +
      '</div>' +
      '<div id="dashProdTableWrap">' + this._renderProdTableHtml(prodProfitList) + '</div>' +
    '</div>';

    /* ── بخش پنجم: وضعیت مالی، مطالبات، بدهی‌ها و نقدینگی (۳ ستون) ── */
    h += '<div class="erp-liquidity-grid">' +
      /* ۱. مطالبات */
      '<div class="cd">' +
        '<div class="cd-h" style="display:flex;align-items:center;justify-content:space-between">' +
          '<div style="display:flex;align-items:center;gap:6px;font-weight:700">' +
            '<i class="bi bi-arrow-down-left-circle-fill" style="color:var(--p)"></i>' +
            '<span>مطالبات از مشتریان</span>' +
          '</div>' +
          '<button class="btn bo bs" onclick="ROUTES.debtors()">لیست بدهکاران ←</button>' +
        '</div>' +
        '<div class="cd-b" style="padding:12px 14px;background:rgba(37,99,235,.03);border-bottom:1px solid var(--bd)">' +
          '<div style="font-size:0.78rem;color:var(--txs)">مجموع مطالبات قطعی:</div>' +
          '<div style="font-size:1.3rem;font-weight:800;color:var(--p);font-variant-numeric:tabular-nums">' +
            UI.fn(totalDebtors) + ' <small style="font-size:0.75rem">ریال (' + UI.fn(debtorCount) + ' مشتری)</small>' +
          '</div>' +
        '</div>' +
        '<div class="erp-mini-list">' +
          (top5Debtors.length ? top5Debtors.map(function(d) {
            return '<div class="erp-mini-item" onclick="Led.show(' + d.id + ')" title="مشاهده معین">' +
              '<div><strong>' + esc(d.name) + '</strong><div style="font-size:0.72rem;color:var(--txs)">' + esc(d.phone || '—') + '</div></div>' +
              '<strong style="color:var(--p);font-variant-numeric:tabular-nums">' + UI.fn(d.balance) + '</strong>' +
            '</div>';
          }).join('') : '<div class="em" style="padding:20px"><p>هیچ مشتری بدهکاری ثبت نشده است</p></div>') +
        '</div>' +
      '</div>' +

      /* ۲. بدهی به تأمین‌کنندگان */
      '<div class="cd">' +
        '<div class="cd-h" style="display:flex;align-items:center;justify-content:space-between">' +
          '<div style="display:flex;align-items:center;gap:6px;font-weight:700">' +
            '<i class="bi bi-arrow-up-right-circle-fill" style="color:var(--d)"></i>' +
            '<span>بدهی به تأمین‌کنندگان</span>' +
          '</div>' +
          '<button class="btn bo bs" onclick="ROUTES.creditors()">لیست بستانکاران ←</button>' +
        '</div>' +
        '<div class="cd-b" style="padding:12px 14px;background:rgba(220,38,38,.03);border-bottom:1px solid var(--bd)">' +
          '<div style="font-size:0.78rem;color:var(--txs)">مجموع بدهی‌های جاری:</div>' +
          '<div style="font-size:1.3rem;font-weight:800;color:var(--d);font-variant-numeric:tabular-nums">' +
            UI.fn(totalCreditors) + ' <small style="font-size:0.75rem">ریال (' + UI.fn(creditorCount) + ' تأمین‌کننده)</small>' +
          '</div>' +
        '</div>' +
        '<div class="erp-mini-list">' +
          (top5Creditors.length ? top5Creditors.map(function(c) {
            return '<div class="erp-mini-item" onclick="Led.show(' + c.id + ')" title="مشاهده معین">' +
              '<div><strong>' + esc(c.name) + '</strong><div style="font-size:0.72rem;color:var(--txs)">' + esc(c.phone || '—') + '</div></div>' +
              '<strong style="color:var(--d);font-variant-numeric:tabular-nums">' + UI.fn(c.balance) + '</strong>' +
            '</div>';
          }).join('') : '<div class="em" style="padding:20px"><p>هیچ تأمین‌کننده بستانکاری ثبت نشده است</p></div>') +
        '</div>' +
      '</div>' +

      /* ۳. حساب‌های بانکی و نقدینگی */
      '<div class="cd">' +
        '<div class="cd-h" style="display:flex;align-items:center;justify-content:space-between">' +
          '<div style="display:flex;align-items:center;gap:6px;font-weight:700">' +
            '<i class="bi bi-bank2" style="color:var(--ok)"></i>' +
            '<span>بانک و نقدینگی</span>' +
          '</div>' +
          '<button class="btn bo bs" onclick="ROUTES.banks()">مدیریت بانک‌ها ←</button>' +
        '</div>' +
        '<div class="cd-b" style="padding:12px 14px;background:rgba(22,163,74,.03);border-bottom:1px solid var(--bd)">' +
          '<div style="font-size:0.78rem;color:var(--txs)">موجودی نقدی تجمیعی:</div>' +
          '<div style="font-size:1.3rem;font-weight:800;color:var(--ok);font-variant-numeric:tabular-nums">' +
            UI.fn(totalBankBal) + ' <small style="font-size:0.75rem">ریال</small>' +
          '</div>' +
          '<div style="margin-top:4px;font-size:0.74rem;color:var(--txs);display:flex;justify-content:space-between">' +
            '<span>گردش دریافت دوره: +' + UI.fn(bankReceiptsPeriod) + '</span>' +
            '<span>پرداخت: −' + UI.fn(bankPaymentsPeriod) + '</span>' +
          '</div>' +
        '</div>' +
        '<div class="erp-mini-list">' +
          (bankBalances.length ? bankBalances.map(function(b) {
            return '<div class="erp-mini-item" onclick="Bank.show(' + b.id + ')" title="مشاهده گردش حساب">' +
              '<div><strong>' + esc(b.name) + '</strong><div style="font-size:0.72rem;color:var(--txs)">' + esc(b.bankName || b.accountNumber || '—') + '</div></div>' +
              '<strong style="color:' + (b.balance >= 0 ? 'var(--ok)' : 'var(--d)') + ';font-variant-numeric:tabular-nums">' + UI.fn(b.balance) + '</strong>' +
            '</div>';
          }).join('') : '<div class="em" style="padding:20px"><p>حساب بانکی تعریف نشده است</p></div>') +
        '</div>' +
      '</div>' +
    '</div>';

    /* ── بخش هفتم: انبار و کالاهای نساجی ── */
    h += '<div class="cd">' +
      '<div class="cd-h" style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:8px">' +
        '<div style="display:flex;align-items:center;gap:8px;font-weight:700">' +
          '<i class="bi bi-box-seam-fill" style="color:var(--w)"></i>' +
          '<span>دیدبان انبار و کالاهای نساجی</span>' +
        '</div>' +
        '<button class="btn bo bs" onclick="ROUTES.warehouse()">ورود به انبار و کاردکس کالاها ←</button>' +
      '</div>' +
      '<div class="cd-b" style="padding-bottom:8px">' +
        '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:10px;margin-bottom:14px">' +
          '<div style="padding:10px;background:var(--bg);border-radius:8px;text-align:center">' +
            '<div style="font-size:0.76rem;color:var(--txs)">کل کاتالوگ کالاها</div>' +
            '<div style="font-size:1.15rem;font-weight:800;margin-top:2px">' + UI.fn(products.length) + '</div>' +
          '</div>' +
          '<div style="padding:10px;background:var(--bg);border-radius:8px;text-align:center">' +
            '<div style="font-size:0.76rem;color:var(--txs)">کالاهای موجود</div>' +
            '<div style="font-size:1.15rem;font-weight:800;color:var(--ok);margin-top:2px">' + UI.fn(inStockCount) + '</div>' +
          '</div>' +
          '<div style="padding:10px;background:var(--bg);border-radius:8px;text-align:center">' +
            '<div style="font-size:0.76rem;color:var(--txs)">کالاهای ناموجود</div>' +
            '<div style="font-size:1.15rem;font-weight:800;color:var(--d);margin-top:2px">' + UI.fn(outOfStockCount) + '</div>' +
          '</div>' +
          '<div style="padding:10px;background:var(--bg);border-radius:8px;text-align:center">' +
            '<div style="font-size:0.76rem;color:var(--txs)">متراژ کل موجودی</div>' +
            '<div style="font-size:1.15rem;font-weight:800;color:var(--p);margin-top:2px">' + UI.fn(totalStockMeters) + ' <small style="font-size:0.7rem">متر</small></div>' +
          '</div>' +
        '</div>' +
        '<div class="g2">' +
          '<div>' +
            '<div style="font-size:0.8rem;font-weight:700;margin-bottom:8px;color:var(--ok)">' +
              '<i class="bi bi-lightning-charge-fill"></i> ۵ کالای پرفروش دوره (Top Movers)' +
            '</div>' +
            '<div class="erp-mini-list">' +
              (topMovers.length ? topMovers.map(function(m) {
                return '<div class="erp-mini-item" onclick="PLed.show(' + m.id + ')" title="کاردکس">' +
                  '<span><strong>' + esc(m.name) + '</strong></span>' +
                  '<span>' + UI.fn(m.qty) + ' متر (' + UI.fn(m.revenue) + ' ریال)</span>' +
                '</div>';
              }).join('') : '<div style="font-size:0.78rem;color:var(--txs);padding:10px">فروشی در این دوره ثبت نشده است</div>') +
            '</div>' +
          '</div>' +
          '<div>' +
            '<div style="font-size:0.8rem;font-weight:700;margin-bottom:8px;color:var(--w)">' +
              '<i class="bi bi-hourglass-split"></i> کالاهای کم‌گردش یا راکد (Slow Movers)' +
            '</div>' +
            '<div class="erp-mini-list">' +
              (slowMovers.length ? slowMovers.map(function(s) {
                return '<div class="erp-mini-item" onclick="PLed.show(' + s.id + ')" title="کاردکس">' +
                  '<span><strong>' + esc(s.name) + '</strong></span>' +
                  '<span style="color:var(--txs)">موجودی انبار: ' + UI.fn(s.stock) + ' ' + esc(s.unit || 'متر') + '</span>' +
                '</div>';
              }).join('') : '<div style="font-size:0.78rem;color:var(--txs);padding:10px">کالای راکد ثبت نشده است</div>') +
            '</div>' +
          '</div>' +
        '</div>' +
      '</div>' +
    '</div>';

    /* ── بخش هشتم: فعالیت‌ها و رویدادهای اخیر (Activity Stream) ── */
    h += '<div class="cd">' +
      '<div class="cd-h" style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:8px">' +
        '<div style="display:flex;align-items:center;gap:8px;font-weight:700">' +
          '<i class="bi bi-clock-history" style="color:var(--p)"></i>' +
          '<span>آخرین فعالیت‌ها و اسناد ثبت‌شده برنامه</span>' +
        '</div>' +
        '<div class="erp-period-group">' +
          '<button class="erp-period-btn' + (this.activityFilter === 'all' ? ' active' : '') + '" onclick="Dash.setActivityFilter(\'all\')">همه</button>' +
          '<button class="erp-period-btn' + (this.activityFilter === 'sales' ? ' active' : '') + '" onclick="Dash.setActivityFilter(\'sales\')">فروش‌ها</button>' +
          '<button class="erp-period-btn' + (this.activityFilter === 'purchase' ? ' active' : '') + '" onclick="Dash.setActivityFilter(\'purchase\')">خریدها</button>' +
          '<button class="erp-period-btn' + (this.activityFilter === 'payments' ? ' active' : '') + '" onclick="Dash.setActivityFilter(\'payments\')">تراکنش‌ها</button>' +
          '<button class="erp-period-btn' + (this.activityFilter === 'checks' ? ' active' : '') + '" onclick="Dash.setActivityFilter(\'checks\')">چک‌ها</button>' +
        '</div>' +
      '</div>' +
      '<div id="dashActivityWrap">' + this._renderActivityTableHtml(recentActivities) + '</div>' +
    '</div>';

    /* ── بخش نهم: میانبرهای کاربردی مدیر (Quick Actions Bar) ── */
    h += '<div class="cd">' +
      '<div class="cd-h" style="display:flex;align-items:center;justify-content:space-between">' +
        '<div style="display:flex;align-items:center;gap:8px;font-weight:700">' +
          '<i class="bi bi-grid-3x3-gap-fill" style="color:var(--p)"></i>' +
          '<span>میانبرهای کاربردی مدیر پارچه‌بان</span>' +
        '</div>' +
        '<span style="font-size:0.75rem;color:var(--txs)">دسترسی سریع با یک کلیک</span>' +
      '</div>' +
      '<div class="cd-b">' +
        '<div class="erp-quick-actions">' +
          '<div class="erp-quick-btn" onclick="Inv.form(\'sale\')">' +
            '<i class="bi bi-receipt" style="color:var(--ok)"></i>' +
            '<span>ثبت فاکتور فروش</span>' +
          '</div>' +
          '<div class="erp-quick-btn" onclick="Inv.form(\'purchase\')">' +
            '<i class="bi bi-cart-plus" style="color:var(--w)"></i>' +
            '<span>ثبت فاکتور خرید</span>' +
          '</div>' +
          '<div class="erp-quick-btn" onclick="Pay.showF(\'receipt\')">' +
            '<i class="bi bi-cash-coin" style="color:var(--ok)"></i>' +
            '<span>ثبت دریافت وجه</span>' +
          '</div>' +
          '<div class="erp-quick-btn" onclick="Pay.showF(\'payment\')">' +
            '<i class="bi bi-wallet-fill" style="color:var(--d)"></i>' +
            '<span>ثبت پرداخت وجه</span>' +
          '</div>' +
          '<div class="erp-quick-btn" onclick="Bank.transfer()">' +
            '<i class="bi bi-arrow-left-right" style="color:var(--p)"></i>' +
            '<span>انتقال بین‌بانکی</span>' +
          '</div>' +
          '<div class="erp-quick-btn" onclick="Chk.form(\'received\')">' +
            '<i class="bi bi-credit-card-2-front" style="color:var(--ok)"></i>' +
            '<span>ثبت چک صیادی</span>' +
          '</div>' +
          '<div class="erp-quick-btn" onclick="Prod.form()">' +
            '<i class="bi bi-box-seam" style="color:var(--p)"></i>' +
            '<span>تعریف کالای جدید</span>' +
          '</div>' +
          '<div class="erp-quick-btn" onclick="ROUTES.profit()">' +
            '<i class="bi bi-file-earmark-spreadsheet" style="color:var(--p)"></i>' +
            '<span>صورت سود و زیان</span>' +
          '</div>' +
          '<div class="erp-quick-btn" onclick="ROUTES.warehouse()">' +
            '<i class="bi bi-boxes" style="color:var(--w)"></i>' +
            '<span>موجودی و کاردکس</span>' +
          '</div>' +
          '<div class="erp-quick-btn" onclick="Backup.exportAll()">' +
            '<i class="bi bi-download" style="color:var(--ok)"></i>' +
            '<span>پشتیبان‌گیری (JSON)</span>' +
          '</div>' +
        '</div>' +
      '</div>' +
    '</div>';

    h += '</div>'; // پایان .erp-dash

    UI.content(h);
    this.renderCharts(periodInvs, plData, cMap);
  },

  /* ══ رندر جدول سودآوری کالاها (با فیلتر و مرتب‌سازی زنده) ══ */
  _renderProdTableHtml: function(list) {
    var query = (this.prodQuery || '').trim().toLowerCase();
    var filtered = (list || []).filter(function(it) {
      if (!it) return false;
      if (!query) return true;
      return (it.name || '').toLowerCase().indexOf(query) !== -1;
    });

    if (this.prodSort === 'sales') {
      filtered.sort(function(a, b) { return b.revenue - a.revenue; });
    } else {
      filtered.sort(function(a, b) { return b.profit - a.profit; });
    }

    if (!filtered.length) {
      return '<div class="em"><i class="bi bi-tags"></i><p>کالایی منطبق با جستجو یا فروش دوره یافت نشد</p></div>';
    }

    var r = '';
    filtered.forEach(function(it, i) {
      var badge = it.unverified ?
        '<span style="color:var(--w);font-size:0.75rem" title="' + it.unverifiedCount + ' قلم فروش بدون قیمت خرید">⚠ بهای نامشخص</span>' :
        '<span style="color:var(--ok);font-size:0.75rem"><i class="bi bi-check-circle-fill"></i> موثق</span>';

      var pCol = it.profit >= 0 ? 'var(--ok)' : 'var(--d)';

      r += '<tr class="clk" onclick="PLed.show(' + it.id + ')" title="مشاهده کاردکس و دفتر کالا">' +
        '<td>' + (i + 1) + '</td>' +
        '<td><strong>' + esc(it.name) + '</strong></td>' +
        '<td style="text-align:center;font-variant-numeric:tabular-nums">' + UI.fn(it.qty) + '</td>' +
        '<td style="text-align:left;font-variant-numeric:tabular-nums">' + UI.fn(it.avgSell) + '</td>' +
        '<td style="text-align:left;font-variant-numeric:tabular-nums">' + UI.fn(Math.round(it.cogs)) + '</td>' +
        '<td style="text-align:left;font-variant-numeric:tabular-nums;font-weight:700">' + UI.fn(Math.round(it.revenue)) + '</td>' +
        '<td style="text-align:left;font-variant-numeric:tabular-nums;font-weight:700;color:' + pCol + '">' + UI.fn(Math.round(it.profit)) + '</td>' +
        '<td style="text-align:center;font-variant-numeric:tabular-nums;color:' + pCol + '">' + it.margin.toFixed(1) + '٪</td>' +
        '<td style="text-align:center">' + badge + '</td>' +
        '<td style="text-align:center"><button class="bi2" title="دفتر کالا"><i class="bi bi-journal-text"></i></button></td>' +
      '</tr>';
    });

    return '<div class="tw"><table><thead><tr>' +
      '<th>#</th><th>نام کالا</th><th style="text-align:center">مقدار فروش</th>' +
      '<th style="text-align:left">میانگین نرخ فروش</th><th style="text-align:left">بهای تمام‌شده (COGS)</th>' +
      '<th style="text-align:left">درآمد فروش (ریال)</th><th style="text-align:left">سود ناخالص</th>' +
      '<th style="text-align:center">حاشیه سود</th><th style="text-align:center">وضعیت داده</th><th></th>' +
      '</tr></thead><tbody>' + r + '</tbody></table></div>';
  },

  setProdSort: function(s) {
    this.prodSort = s;
    if (this._cache) {
      var wrap = document.getElementById('dashProdTableWrap');
      if (wrap) wrap.innerHTML = this._renderProdTableHtml(this._cache.prodProfitList);
    }
  },

  onProdFilter: function(q) {
    this.prodQuery = q;
    if (this._cache) {
      var wrap = document.getElementById('dashProdTableWrap');
      if (wrap) wrap.innerHTML = this._renderProdTableHtml(this._cache.prodProfitList);
    }
  },

  /* ══ رندر جدول فعالیت‌های اخیر ══ */
  _renderActivityTableHtml: function(list) {
    var fl = this.activityFilter || 'all';
    var filtered = (list || []).filter(function(item) {
      if (!item) return false;
      if (fl === 'all') return true;
      if (fl === 'sales') return item.kind === 'sale';
      if (fl === 'purchase') return item.kind === 'purchase';
      if (fl === 'payments') return item.kind === 'payment';
      if (fl === 'checks') return item.kind === 'check';
      return true;
    });

    if (!filtered.length) {
      return '<div class="em"><i class="bi bi-clock-history"></i><p>رویدادی در این دسته‌بندی یافت نشد</p></div>';
    }

    var r = '';
    filtered.slice(0, 10).forEach(function(item, i) {
      var typeBadgeClass = (item.kind === 'sale' || item.typeLabel === 'دریافت وجه' || item.typeLabel === 'چک دریافتی') ? 'tg-g' : 'tg-r';
      r += '<tr class="clk" onclick="' + item.action + '" title="مشاهده جزئیات">' +
        '<td>' + (i + 1) + '</td>' +
        '<td><span class="tg ' + typeBadgeClass + '">' + esc(item.typeLabel) + '</span></td>' +
        '<td><strong>' + esc(item.num) + '</strong></td>' +
        '<td>' + esc(item.person) + '</td>' +
        '<td style="text-align:center">' + esc(item.date || '—') + '</td>' +
        '<td style="text-align:left;font-weight:700;font-variant-numeric:tabular-nums">' + UI.fn(item.amount) + '</td>' +
        '<td style="text-align:center">' + esc(item.status) + '</td>' +
        '<td style="text-align:center"><button class="bi2" title="مشاهده"><i class="bi bi-eye"></i></button></td>' +
      '</tr>';
    });

    return '<div class="tw"><table><thead><tr>' +
      '<th>#</th><th>نوع رویداد</th><th>شماره / شرح</th><th>شخص مرتبط</th>' +
      '<th style="text-align:center">تاریخ</th><th style="text-align:left">مبلغ (ریال)</th>' +
      '<th style="text-align:center">وضعیت</th><th></th>' +
      '</tr></thead><tbody>' + r + '</tbody></table></div>';
  },

  setActivityFilter: function(fl) {
    this.activityFilter = fl;
    if (this._cache) {
      var wrap = document.getElementById('dashActivityWrap');
      if (wrap) wrap.innerHTML = this._renderActivityTableHtml(this._cache.recentActivities);
    }
  },

  setChartView: function(v) {
    this.chartView = v;
    if (this._cache) {
      this.renderCharts(this._cache.periodInvs, this._cache.plData, this._cache.cMap);
    }
  },

  /* ══ رندر تعاملی نمودارهای Chart.js با پشتیبانی RTL و تم تاریک ══ */
  renderCharts: function(periodInvs, plData, cMap) {
    try {
      if (typeof Chart === 'undefined') return;

      if (this._perfChart) {
        try { this._perfChart.destroy(); } catch (e) {}
        this._perfChart = null;
      }
      if (this._custChart) {
        try { this._custChart.destroy(); } catch (e) {}
        this._custChart = null;
      }

      var isDark = document.body.classList.contains('dark');
      var fontFam = 'Vazirmatn, sans-serif';
      var textMuted = isDark ? '#94a3b8' : '#64748b';
      var gridBorder = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)';

      /* ── نمودار اول: روند عملکرد مالی (فروش، خرید، بهای تمام‌شده و سود) ── */
      var pCtx = document.getElementById('dashPerfChart');
      if (pCtx) {
        var buckets = {};
        var invs = periodInvs || [];
        var isMonthlyGrouping = (this.period === 'quarter' || this.period === 'year' || this.period === 'all');

        invs.forEach(function(inv) {
          if (!inv || !inv.date) return;
          var key = isMonthlyGrouping ? inv.date.substring(0, 7) : inv.date;
          if (!buckets[key]) {
            buckets[key] = { sales: 0, purchases: 0, cogs: 0, profit: 0 };
          }
          if (inv.type === 'purchase') {
            buckets[key].purchases += numOf(inv.grandTotal);
          } else if (inv.type === 'sale') {
            var sub = numOf(inv.subtotal);
            var disc = numOf(inv.discount);
            var ship = numOf(inv.shippingCost);
            var rev = (sub - disc) + ship;
            buckets[key].sales += rev;
            (inv.items || []).forEach(function(it) {
              if (!it) return;
              var bp = numOf(it.buyPrice);
              if (bp > 0) buckets[key].cogs += (bp * numOf(it.quantity));
            });
            buckets[key].profit = buckets[key].sales - buckets[key].cogs;
          }
        });

        var sortedKeys = Object.keys(buckets).sort();
        if (sortedKeys.length > 14) {
          sortedKeys = sortedKeys.slice(-14);
        }

        if (!sortedKeys.length) {
          pCtx.parentElement.innerHTML = '<div class="em" style="padding:48px 14px;text-align:center"><i class="bi bi-bar-chart" style="font-size:2.2rem;color:var(--txs);opacity:.45"></i><p style="margin-top:10px;font-size:.84rem;color:var(--txs)">فاکتور خرید یا فروشی در این دوره زمانی ثبت نشده است</p></div>';
        } else {
          var chartDatasets = [];

          if (this.chartView === 'combined') {
            chartDatasets = [
              {
                type: 'bar',
                label: 'درآمد فروش',
                data: sortedKeys.map(function(k) { return buckets[k].sales; }),
                backgroundColor: 'rgba(37, 99, 235, 0.75)',
                borderColor: '#2563eb',
                borderWidth: 1,
                borderRadius: 4
              },
              {
                type: 'bar',
                label: 'بهای تمام‌شده (COGS)',
                data: sortedKeys.map(function(k) { return buckets[k].cogs; }),
                backgroundColor: 'rgba(217, 119, 6, 0.75)',
                borderColor: '#d97706',
                borderWidth: 1,
                borderRadius: 4
              },
              {
                type: 'line',
                label: 'سود ناخالص',
                data: sortedKeys.map(function(k) { return buckets[k].profit; }),
                borderColor: '#16a34a',
                backgroundColor: 'rgba(22, 163, 74, 0.15)',
                borderWidth: 2.5,
                tension: 0.3,
                fill: false,
                pointRadius: 4,
                pointBackgroundColor: '#16a34a'
              }
            ];
          } else {
            chartDatasets = [
              {
                type: 'bar',
                label: 'مجموع فروش',
                data: sortedKeys.map(function(k) { return buckets[k].sales; }),
                backgroundColor: 'rgba(22, 163, 74, 0.8)',
                borderColor: '#16a34a',
                borderWidth: 1,
                borderRadius: 4
              },
              {
                type: 'bar',
                label: 'مجموع خرید',
                data: sortedKeys.map(function(k) { return buckets[k].purchases; }),
                backgroundColor: 'rgba(217, 119, 6, 0.8)',
                borderColor: '#d97706',
                borderWidth: 1,
                borderRadius: 4
              }
            ];
          }

          this._perfChart = new Chart(pCtx, {
            data: {
              labels: sortedKeys.map(function(k) {
                var parts = k.split('/');
                if (parts.length === 3) return parts[1] + '/' + parts[2];
                return k;
              }),
              datasets: chartDatasets
            },
            options: {
              responsive: true,
              maintainAspectRatio: false,
              interaction: {
                mode: 'index',
                intersect: false
              },
              plugins: {
                legend: {
                  position: 'bottom',
                  labels: {
                    font: { family: fontFam, size: 11 },
                    color: textMuted,
                    usePointStyle: true,
                    boxWidth: 8
                  }
                },
                tooltip: {
                  rtl: true,
                  titleFont: { family: fontFam },
                  bodyFont: { family: fontFam },
                  callbacks: {
                    label: function(ctx) {
                      return ctx.dataset.label + ': ' + UI.fn(ctx.parsed.y) + ' ریال';
                    }
                  }
                }
              },
              scales: {
                y: {
                  grid: { color: gridBorder },
                  ticks: {
                    font: { family: fontFam, size: 10 },
                    color: textMuted,
                    callback: function(v) {
                      if (v >= 1000000000) return (v / 1000000000).toFixed(1) + 'B';
                      if (v >= 1000000) return (v / 1000000).toFixed(0) + 'M';
                      if (v >= 1000) return (v / 1000).toFixed(0) + 'K';
                      return v;
                    }
                  }
                },
                x: {
                  grid: { display: false },
                  ticks: {
                    font: { family: fontFam, size: 10 },
                    color: textMuted
                  }
                }
              }
            }
          });
        }
      }

      /* ── نمودار دوم: سهم مشتریان برتر در فروش (Doughnut Chart) ── */
      var cCtx = document.getElementById('dashCustChart');
      if (cCtx) {
        var topCusts = (this._cache && this._cache.top10Customers) ? this._cache.top10Customers : [];
        if (!topCusts.length) {
          cCtx.parentElement.innerHTML = '<div class="em" style="padding:48px 14px;text-align:center"><i class="bi bi-pie-chart" style="font-size:2.2rem;color:var(--txs);opacity:.45"></i><p style="margin-top:10px;font-size:.84rem;color:var(--txs)">فروش به مشتریان در این دوره ثبت نشده است</p></div>';
        } else {
          var labels = topCusts.slice(0, 6).map(function(c) { return c.name; });
          var dataVals = topCusts.slice(0, 6).map(function(c) { return c.totalSales; });
          var palette = ['#2563eb', '#16a34a', '#d97706', '#7c3aed', '#0891b2', '#be185d'];

          this._custChart = new Chart(cCtx, {
            type: 'doughnut',
            data: {
              labels: labels,
              datasets: [{
                data: dataVals,
                backgroundColor: palette.slice(0, labels.length),
                borderWidth: 2,
                borderColor: getComputedStyle(document.body).getPropertyValue('--sf').trim() || '#ffffff'
              }]
            },
            options: {
              responsive: true,
              maintainAspectRatio: false,
              plugins: {
                legend: {
                  position: 'bottom',
                  labels: {
                    font: { family: fontFam, size: 11 },
                    color: textMuted,
                    usePointStyle: true,
                    boxWidth: 8
                  }
                },
                tooltip: {
                  rtl: true,
                  titleFont: { family: fontFam },
                  bodyFont: { family: fontFam },
                  callbacks: {
                    label: function(ctx) {
                      var sum = dataVals.reduce(function(a, b) { return a + b; }, 0);
                      var pct = sum > 0 ? ((ctx.parsed / sum) * 100).toFixed(1) : 0;
                      return ctx.label + ': ' + UI.fn(ctx.parsed) + ' ریال (' + pct + '٪)';
                    }
                  }
                }
              }
            }
          });
        }
      }
    } catch (err) {
      console.warn('Dashboard Chart.js render warning:', err);
    }
  }
};

if (typeof window !== 'undefined') {
  window.Dash = Dash;
}
if (typeof globalThis !== 'undefined') {
  globalThis.Dash = Dash;
}
if (typeof module !== 'undefined' && module.exports) {
  module.exports = Dash;
}

