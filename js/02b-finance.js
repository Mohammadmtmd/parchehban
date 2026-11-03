/**
 * ══════════════════════════════════════════════════════════════════════════════
 * پارچه‌بان — موتور استاندارد و یکپارچه محاسبات مالی (FinanceEngine)
 * ══════════════════════════════════════════════════════════════════════════════
 * منبع واحد حقیقت (Single Source of Truth) برای تمام محاسبات مالی، بهای تمام‌شده،
 * سود ناخالص، هزینه‌های عملیاتی و صورت سود و زیان (P&L).
 *
 * قوانین غیرقابل‌نقض:
 * ۱. بهای تمام‌شده کالای فروش‌رفته (COGS) منحصراً بر پایه buyPrice ثبت‌شده در هر
 *    قلم فاکتور محاسبه می‌شود: itemCOGS = buyPrice × quantity.
 *    استفاده از میانگین موزون (avgBuy) برای فروش اکیداً ممنوع است.
 * ۲. تخفیف فاکتور به صورت تناسبی به اقلام تسهیم می‌شود.
 * ۳. کرایه حمل فاکتور فروش، درآمد خدمات حمل است.
 * ۴. کمیسیون واسطه فروش از سود ناخالص کسر می‌شود.
 * ۵. تسویه بستانکاران و حواله‌های بین‌بانکی به هیچ عنوان هزینه عملیاتی نیستند.
 * ۶. تمامی توابع این ماژول خالص (Pure) بوده و هیچ رکوردی در دیتابیس تغییر نمی‌دهند.
 */

var FinanceEngine = (function() {
  'use strict';

  /**
   * تبدیل امن ورودی به عدد اعشاری معتبر
   */
  function safeNum(val) {
    if (typeof window !== 'undefined' && typeof window.numOf === 'function') return window.numOf(val);
    if (val === null || val === undefined || val === '') return 0;
    var n = parseFloat(String(val).replace(/,/g, '').trim());
    return isNaN(n) ? 0 : n;
  }

  /**
   * تبدیل امن تاریخ شمسی به عدد برای مقایسه (مثلاً ۱۴۰۳۰۸۱۵)
   */
  function parseDateNum(dateStr) {
    if (typeof window !== 'undefined' && typeof window.pn === 'function') return window.pn(dateStr);
    if (!dateStr) return 0;
    var num = parseInt(String(dateStr).replace(/\D/g, ''), 10);
    return isNaN(num) ? 0 : num;
  }

  /**
   * بررسی معتبر بودن بهای خرید (باید عددی مثبت و بزرگتر از صفر باشد)
   * قیمت خرید نامشخص، صفر، منفی، خالی، null یا نامعتبر به هیچ وجه بهای معتبر نیست.
   */
  function isValidBuyPrice(val) {
    if (val === null || val === undefined || val === '') return false;
    if (typeof val === 'string' && val.trim() === '') return false;
    var n = safeNum(val);
    return typeof n === 'number' && !isNaN(n) && isFinite(n) && n > 0;
  }

  /**
   * محاسبه سود و بهای تمام‌شده یک قلم کالا در فاکتور فروش
   * @param {Object} item - قلم فاکتور
   * @param {number} invoiceSubtotal - جمع اقلام فاکتور قبل از تخفیف
   * @param {number} invoiceDiscount - تخفیف کل فاکتور
   */
  function calculateItemProfit(item, invoiceSubtotal, invoiceDiscount) {
    var it = item || {};
    var qty = safeNum(it.quantity);
    var unitPrice = safeNum(it.unitPrice);
    var itemTotal = safeNum(it.total) || (qty * unitPrice);

    var subtotal = safeNum(invoiceSubtotal);
    var discount = safeNum(invoiceDiscount);

    // تسهیم تناسبی تخفیف به نسبت سهم این ردیف از جمع ناخالص اقلام
    var allocatedDiscount = 0;
    if (subtotal > 0 && discount > 0 && itemTotal > 0) {
      allocatedDiscount = Math.round((itemTotal / subtotal) * discount);
    }

    var netRevenue = itemTotal - allocatedDiscount;
    var hasValidBuyPrice = isValidBuyPrice(it.buyPrice);
    var buyPrice = hasValidBuyPrice ? safeNum(it.buyPrice) : null;

    // بهای تمام‌شده و سود ناخالص:
    // اگر قیمت خرید معتبر باشد: COGS = buyPrice × qty و Gross Profit = netRevenue - COGS
    // اگر قیمت خرید نامعتبر یا نامشخص باشد: بهای تمام‌شده نامشخص (null) است نه صفر، و سود قطعی نامشخص است
    var cogs = hasValidBuyPrice ? Math.round(buyPrice * qty) : null;
    var verifiedCOGS = hasValidBuyPrice ? cogs : 0;

    var grossProfit = hasValidBuyPrice ? (netRevenue - cogs) : null;
    var verifiedGrossProfit = hasValidBuyPrice ? (netRevenue - cogs) : 0;
    var marginPct = (hasValidBuyPrice && netRevenue > 0) ? ((grossProfit / netRevenue) * 100) : null;

    return {
      productId: it.productId,
      productName: it.productName || (it.name || 'نامشخص'),
      quantity: qty,
      unitPrice: unitPrice,
      buyPrice: buyPrice,
      rawBuyPrice: it.buyPrice,
      hasValidBuyPrice: hasValidBuyPrice,
      isVerified: hasValidBuyPrice,
      itemTotal: itemTotal,
      allocatedDiscount: allocatedDiscount,
      netRevenue: netRevenue,
      cogs: cogs, // null در صورت نامعتبر بودن قیمت خرید
      verifiedCOGS: verifiedCOGS,
      grossProfit: grossProfit, // null در صورت نامعتبر بودن (هرگز netRevenue فرض نمی‌شود)
      verifiedGrossProfit: verifiedGrossProfit,
      marginPct: marginPct,
      status: hasValidBuyPrice ? 'complete' : 'incomplete',
      profitStatus: hasValidBuyPrice ? 'complete' : 'incomplete',
      statusLabel: hasValidBuyPrice ? 'معتبر و قطعی' : 'ناقص / نیازمند تکمیل اطلاعات'
    };
  }

  /**
   * محاسبه جامع سود و متغیرهای مالی یک فاکتور فروش
   * تفکیک کامل فروش کل، فروش اقلام معتبر، فروش اقلام نامعتبر، بهای تمام‌شده موثق و سود موثق
   * @param {Object} invoice - شیء کامل فاکتور
   */
  function calculateInvoiceProfit(invoice) {
    var inv = invoice || {};
    var subtotal = safeNum(inv.subtotal);
    var discount = safeNum(inv.discount);
    var shippingCost = safeNum(inv.shippingCost);
    var brokerCommission = safeNum(inv.brokerCommission);
    var grandTotal = safeNum(inv.grandTotal) || (subtotal - discount + shippingCost);

    var items = inv.items || [];
    var calculatedItems = [];
    var verifiedCOGS = 0;
    var unverifiedCount = 0;
    var unverifiedRevenue = 0;
    var salesWithValidBuyPrice = 0;
    var salesWithoutValidBuyPrice = 0;

    // در صورتی که subtotal در رکورد فاکتور خالی باشد، از جمع اقلام محاسبه می‌شود
    var computedSubtotal = subtotal;
    if (computedSubtotal <= 0 && items.length > 0) {
      items.forEach(function(it) {
        computedSubtotal += (safeNum(it.quantity) * safeNum(it.unitPrice));
      });
    }

    items.forEach(function(it) {
      var itemCalc = calculateItemProfit(it, computedSubtotal, discount);
      calculatedItems.push(itemCalc);

      if (itemCalc.hasValidBuyPrice) {
        verifiedCOGS += itemCalc.cogs;
        salesWithValidBuyPrice += itemCalc.netRevenue;
      } else {
        unverifiedCount++;
        unverifiedRevenue += itemCalc.netRevenue;
        salesWithoutValidBuyPrice += itemCalc.netRevenue;
      }
    });

    // درآمد خدمات حمل به عنوان بخشی از درآمد کل فاکتور لحاظ می‌شود
    // فروش کل بدون Double Counting: فروش اقلام معتبر + فروش اقلام بدون بهای خرید + حمل
    var netSales = (computedSubtotal - discount) + shippingCost;

    // سود ناخالص قابل تأیید:
    // منحصراً سود اقلام دارای قیمت خرید معتبر + درآمد خدمات حمل
    // اقلام فاقد قیمت خرید به هیچ وجه سود تلقی نمی‌شوند
    var verifiedGrossProfit = (salesWithValidBuyPrice - verifiedCOGS) + shippingCost;
    var profitAfterBroker = verifiedGrossProfit - brokerCommission;

    var isComplete = (unverifiedCount === 0);
    var marginPct = (salesWithValidBuyPrice + shippingCost) > 0
      ? (profitAfterBroker / (salesWithValidBuyPrice + shippingCost)) * 100
      : (netSales > 0 ? (profitAfterBroker / netSales) * 100 : 0);

    return {
      invoiceId: inv.id,
      invoiceNumber: inv.invoiceNumber || '—',
      contactId: inv.contactId,
      date: inv.date || '',
      dateNum: parseDateNum(inv.date),
      type: inv.type || 'sale',
      subtotal: computedSubtotal,
      discount: discount,
      shippingCost: shippingCost,
      brokerCommission: brokerCommission,
      grandTotal: grandTotal,
      // ۱. فروش کل
      totalSales: netSales,
      netSales: netSales,
      // ۲. فروش اقلام دارای بهای تمام‌شده معتبر
      salesWithValidBuyPrice: salesWithValidBuyPrice,
      // ۳. فروش اقلام فاقد بهای تمام‌شده معتبر
      salesWithoutValidBuyPrice: salesWithoutValidBuyPrice,
      // ۴. بهای تمام‌شده قابل تأیید
      verifiedCOGS: verifiedCOGS,
      cogs: verifiedCOGS,
      // ۵. سود ناخالص قابل تأیید
      verifiedGrossProfit: verifiedGrossProfit,
      grossProfit: verifiedGrossProfit,
      profitAfterBroker: profitAfterBroker,
      verifiedProfitAfterBroker: profitAfterBroker,
      marginPct: marginPct,
      // ۶. تعداد اقلام دارای قیمت خرید نامعتبر
      invalidBuyPriceCount: unverifiedCount,
      unverifiedCount: unverifiedCount,
      // ۷. مبلغ فروش اقلام دارای قیمت خرید نامعتبر
      invalidBuyPriceAmount: unverifiedRevenue,
      unverifiedRevenue: unverifiedRevenue,
      // وضعیت سود فاکتور
      hasUnverifiedItems: unverifiedCount > 0,
      isProfitVerified: isComplete,
      isComplete: isComplete,
      status: isComplete ? 'complete' : 'incomplete',
      profitStatus: isComplete ? 'complete' : 'incomplete',
      statusLabel: isComplete ? 'قطعی' : 'ناقص / نیازمند تکمیل اطلاعات',
      items: calculatedItems
    };
  }

  /**
   * پالایش دقیق هزینه‌های عملیاتی دوره‌ای و تفکیک جریان‌های نامربوط
   * @param {Array} payments - آرایه رکوردهای جدول payments
   * @param {number} startNum - تاریخ آغاز دوره به صورت عدد
   * @param {number} endNum - تاریخ پایان دوره به صورت عدد (اختیاری)
   */
  function filterOperatingExpenses(payments, startNum, endNum) {
    var pays = payments || [];
    var sNum = startNum || 0;
    var eNum = endNum || 0;

    var classifiedOpEx = 0;
    var unclassifiedPayments = 0;
    var supplierSettlements = 0;
    var transfers = 0;
    var checkSettlements = 0;
    var byCategory = {};

    var classifiedItems = [];
    var unclassifiedItems = [];

    pays.forEach(function(p) {
      if (!p) return;
      var dNum = parseDateNum(p.date);
      if (sNum > 0 && dNum < sNum) return;
      if (eNum > 0 && dNum > eNum) return;

      var amt = safeNum(p.amount);
      if (amt <= 0) return;

      // دریافت‌ها جریان درآمدی یا تسویه هستند، نه هزینه عملیاتی
      if (p.type === 'receipt') return;

      // ۱. انتقال بین‌بانکی / صندوق
      if (p.transferId || (p.note && String(p.note).indexOf('انتقال') !== -1)) {
        transfers += amt;
        return;
      }

      // ۲. پاس شدن یا تسویه چک
      if (p.sourceCheckId) {
        checkSettlements += amt;
        return;
      }

      // ۳. پرداخت متصل به فاکتور خرید (تسویه بستانکاران / تأمین‌کنندگان)
      if (p.sourceInvoiceId) {
        supplierSettlements += amt;
        return;
      }

      // ۴. بررسی سرفصل دسته‌بندی هزینه
      var cat = (p.category || '').trim();
      if (cat && cat !== 'تأمین‌کننده' && cat !== 'بستانکار' && cat !== 'تسویه حساب') {
        classifiedOpEx += amt;
        byCategory[cat] = (byCategory[cat] || 0) + amt;
        classifiedItems.push({
          id: p.id,
          date: p.date,
          amount: amt,
          category: cat,
          note: p.note || ''
        });
      } else {
        // پرداخت‌های بدون سرفصل مشخص (مطابق تصمیم تأییدشده کاربر: تفکیک و عدم کسر خودکار)
        unclassifiedPayments += amt;
        unclassifiedItems.push({
          id: p.id,
          date: p.date,
          amount: amt,
          category: 'نامشخص',
          note: p.note || ''
        });
      }
    });

    return {
      classifiedOpEx: classifiedOpEx,
      unclassifiedPayments: unclassifiedPayments,
      supplierSettlements: supplierSettlements,
      transfers: transfers,
      checkSettlements: checkSettlements,
      byCategory: byCategory,
      classifiedItems: classifiedItems,
      unclassifiedItems: unclassifiedItems
    };
  }

  /**
   * محاسبه جامع صورت سود و زیان (P&L) دوره مالی
   * @param {Array} invoices - تمام فاکتورها
   * @param {Array} payments - تمام پرداخت‌ها
   * @param {number} startNum - تاریخ آغاز دوره
   * @param {number} endNum - تاریخ پایان دوره
   */
  function calculatePeriodPL(invoices, payments, startNum, endNum) {
    var invs = invoices || [];
    var sNum = startNum || 0;
    var eNum = endNum || 0;

    var grossSales = 0;
    var totalDiscounts = 0;
    var totalShipping = 0;
    var totalVerifiedCOGS = 0;
    var totalVerifiedGrossProfit = 0;
    var totalBrokerCommissions = 0;
    var unverifiedItemsCount = 0;
    var unverifiedRevenueTotal = 0;
    var salesWithValidBuyPriceTotal = 0;
    var salesWithoutValidBuyPriceTotal = 0;
    var incompleteInvoicesCount = 0;

    var productBreakdown = {};
    var invoiceBreakdown = [];

    // فیلتر فاکتورهای فروش دوره
    var saleInvs = invs.filter(function(inv) {
      if (!inv || inv.type !== 'sale') return false;
      var dNum = parseDateNum(inv.date);
      if (sNum > 0 && dNum < sNum) return false;
      if (eNum > 0 && dNum > eNum) return false;
      return true;
    });

    saleInvs.forEach(function(inv) {
      var calc = calculateInvoiceProfit(inv);
      invoiceBreakdown.push(calc);

      grossSales += calc.subtotal;
      totalDiscounts += calc.discount;
      totalShipping += calc.shippingCost;
      totalVerifiedCOGS += calc.verifiedCOGS;
      totalVerifiedGrossProfit += calc.verifiedGrossProfit;
      totalBrokerCommissions += calc.brokerCommission;
      unverifiedItemsCount += calc.unverifiedCount;
      unverifiedRevenueTotal += calc.unverifiedRevenue;
      salesWithValidBuyPriceTotal += calc.salesWithValidBuyPrice;
      salesWithoutValidBuyPriceTotal += calc.salesWithoutValidBuyPrice;
      if (calc.unverifiedCount > 0) {
        incompleteInvoicesCount++;
      }

      // تجمیع به تفکیک کالا
      calc.items.forEach(function(it) {
        var pid = it.productId || it.productName;
        if (!productBreakdown[pid]) {
          productBreakdown[pid] = {
            id: it.productId,
            name: it.productName,
            qty: 0,
            revenue: 0,
            salesWithValidBuyPrice: 0,
            salesWithoutValidBuyPrice: 0,
            cogs: 0,
            verifiedCOGS: 0,
            profit: 0,
            verifiedGrossProfit: 0,
            unverifiedCount: 0,
            unverifiedRevenue: 0,
            hasValidBuyPriceCount: 0,
            status: 'complete',
            statusLabel: 'قطعی'
          };
        }
        var pb = productBreakdown[pid];
        pb.qty += it.quantity;
        pb.revenue += it.netRevenue;
        if (it.hasValidBuyPrice) {
          pb.salesWithValidBuyPrice += it.netRevenue;
          pb.cogs += it.verifiedCOGS;
          pb.verifiedCOGS += it.verifiedCOGS;
          pb.profit += it.verifiedGrossProfit;
          pb.verifiedGrossProfit += it.verifiedGrossProfit;
          pb.hasValidBuyPriceCount++;
        } else {
          pb.salesWithoutValidBuyPrice += it.netRevenue;
          pb.unverifiedCount++;
          pb.unverifiedRevenue += it.netRevenue;
          pb.status = 'incomplete';
          pb.statusLabel = 'ناقص / نیازمند تکمیل اطلاعات';
        }
      });
    });

    var netSales = (grossSales - totalDiscounts) + totalShipping;
    var isPeriodComplete = (unverifiedItemsCount === 0);
    var periodStatus = isPeriodComplete ? 'complete' : 'incomplete';
    var periodStatusLabel = isPeriodComplete ? 'قطعی' : 'ناقص / نیازمند تکمیل اطلاعات';

    // سود ناخالص موثق
    var grossProfit = totalVerifiedGrossProfit;
    var grossMarginPct = (salesWithValidBuyPriceTotal + totalShipping) > 0
      ? (grossProfit / (salesWithValidBuyPriceTotal + totalShipping)) * 100
      : (netSales > 0 ? (grossProfit / netSales) * 100 : 0);

    // استخراج هزینه‌های عملیاتی دوره
    var expenseData = filterOperatingExpenses(payments, sNum, eNum);
    var classifiedOpEx = expenseData.classifiedOpEx;
    var unclassifiedPayments = expenseData.unclassifiedPayments;

    // سود خالص عملیاتی نهایی بر پایه سود موثق و قابل تأیید
    var netOperatingProfit = grossProfit - totalBrokerCommissions - classifiedOpEx;
    var netMarginPct = netSales > 0 ? (netOperatingProfit / netSales) * 100 : 0;

    return {
      period: { startNum: sNum, endNum: eNum },
      invoiceCount: saleInvs.length,
      incompleteInvoicesCount: incompleteInvoicesCount,
      grossSales: grossSales,
      totalDiscounts: totalDiscounts,
      totalShipping: totalShipping,
      // ۱. فروش کل
      totalSales: netSales,
      netSales: netSales,
      // ۲. فروش اقلام دارای بهای تمام‌شده معتبر
      salesWithValidBuyPrice: salesWithValidBuyPriceTotal,
      // ۳. فروش اقلام فاقد بهای تمام‌شده معتبر
      salesWithoutValidBuyPrice: salesWithoutValidBuyPriceTotal,
      // ۴. بهای تمام‌شده قابل تأیید
      verifiedCOGS: totalVerifiedCOGS,
      cogs: totalVerifiedCOGS,
      // ۵. سود ناخالص قابل تأیید
      verifiedGrossProfit: grossProfit,
      grossProfit: grossProfit,
      grossMarginPct: grossMarginPct,
      // ۶. کمیسیون واسطه‌ها و هزینه‌های عملیاتی
      brokerCommissions: totalBrokerCommissions,
      profitAfterBroker: grossProfit - totalBrokerCommissions,
      classifiedOpEx: classifiedOpEx,
      unclassifiedPayments: unclassifiedPayments,
      expensesByCategory: expenseData.byCategory,
      // ۷. سود خالص عملیاتی نهایی
      netOperatingProfit: netOperatingProfit,
      netMarginPct: netMarginPct,
      // وضعیت دوره و اقلام دارای قیمت خرید نامعتبر
      invalidBuyPriceCount: unverifiedItemsCount,
      unverifiedItemsCount: unverifiedItemsCount,
      invalidBuyPriceAmount: unverifiedRevenueTotal,
      unverifiedRevenueTotal: unverifiedRevenueTotal,
      hasUnverifiedItems: unverifiedItemsCount > 0,
      isProfitVerified: isPeriodComplete,
      isComplete: isPeriodComplete,
      status: periodStatus,
      profitStatus: periodStatus,
      statusLabel: periodStatusLabel,
      // جزئیات
      productBreakdown: productBreakdown,
      invoiceBreakdown: invoiceBreakdown,
      expenseDetails: expenseData
    };
  }

  /**
   * مجموعه آزمون‌های تشخیصی ۱۰‌گانه مالی (کاملاً ایزوله با داده‌های ساختگی درون‌حافظه)
   */
  function runDiagnosticSuite() {
    var results = [];

    // سناریو ۱: فاکتور ساده با بهای تمام‌شده و سود صریح
    (function test1() {
      var inv = {
        id: 1,
        type: 'sale',
        subtotal: 100000,
        discount: 0,
        shippingCost: 0,
        brokerCommission: 0,
        grandTotal: 100000,
        items: [{ productId: 10, productName: 'پارچه ویسکوز', quantity: 10, unitPrice: 10000, buyPrice: 7000 }]
      };
      var res = calculateInvoiceProfit(inv);
      var pass = (res.cogs === 70000) && (res.grossProfit === 30000) && (res.profitAfterBroker === 30000);
      results.push({
        id: 1,
        title: 'سناریو ۱: محاسبه پایه بهای تمام‌شده بر اساس buyPrice',
        description: '۱۰ واحد با قیمت فروش ۱۰،۰۰۰ و قیمت خرید ۷،۰۰۰ باید دقیقا بهای ۷۰،۰۰۰ و سود ۳۰،۰۰۰ بدهد.',
        expected: 'بهای تمام‌شده: ۷۰،۰۰۰ | سود: ۳۰،۰۰۰',
        actual: 'بهای تمام‌شده: ' + res.cogs.toLocaleString('fa-IR') + ' | سود: ' + res.grossProfit.toLocaleString('fa-IR'),
        passed: pass
      });
    })();

    // سناریو ۲: تسهیم تناسبی تخفیف فاکتور بین اقلام
    (function test2() {
      var inv = {
        id: 2,
        type: 'sale',
        subtotal: 200000,
        discount: 20000, // ۱۰ درصد تخفیف کل
        shippingCost: 0,
        brokerCommission: 0,
        grandTotal: 180000,
        items: [
          { productId: 1, productName: 'پارچه الف', quantity: 10, unitPrice: 10000, buyPrice: 6000 }, // سهم ناخالص: ۱۰۰،۰۰۰ (۵۰٪)
          { productId: 2, productName: 'پارچه ب', quantity: 5, unitPrice: 20000, buyPrice: 15000 }   // سهم ناخالص: ۱۰۰،۰۰۰ (۵۰٪)
        ]
      };
      var res = calculateInvoiceProfit(inv);
      var it1 = res.items[0];
      var it2 = res.items[1];
      // تخفیف سهم الف = ۱۰،۰۰۰ => درآمد خالص الف = ۹۰،۰۰۰ | بهای الف = ۶۰،۰۰۰ => سود الف = ۳۰،۰۰۰
      // تخفیف سهم ب = ۱۰،۰۰۰ => درآمد خالص ب = ۹۰،۰۰۰ | بهای ب = ۷۵،۰۰۰ => سود ب = ۱۵،۰۰۰
      var pass = (it1.allocatedDiscount === 10000 && it1.grossProfit === 30000) &&
                 (it2.allocatedDiscount === 10000 && it2.grossProfit === 15000) &&
                 (res.grossProfit === 45000);
      results.push({
        id: 2,
        title: 'سناریو ۲: تسهیم تناسبی تخفیف کل فاکتور به اقلام',
        description: 'تخفیف ۲۰،۰۰۰ تومانی روی دو قلم مساوی باید نفری ۱۰،۰۰۰ تسهیم شود و سود ۴۵،۰۰۰ حاصل گردد.',
        expected: 'تسهیم تخفیف: ۱۰،۰۰۰ و ۱۰،۰۰۰ | سود ناخالص کل: ۴۵،۰۰۰',
        actual: 'تسهیم: ' + it1.allocatedDiscount.toLocaleString('fa-IR') + ' و ' + it2.allocatedDiscount.toLocaleString('fa-IR') + ' | سود: ' + res.grossProfit.toLocaleString('fa-IR'),
        passed: pass
      });
    })();

    // سناریو ۳: کرایه فاکتور فروش به عنوان درآمد حمل
    (function test3() {
      var inv = {
        id: 3,
        type: 'sale',
        subtotal: 100000,
        discount: 0,
        shippingCost: 5000,
        brokerCommission: 0,
        grandTotal: 105000,
        items: [{ productId: 10, productName: 'پارچه کتان', quantity: 10, unitPrice: 10000, buyPrice: 7000 }]
      };
      var res = calculateInvoiceProfit(inv);
      // درآمد کل = ۱۰۰،۰۰۰ + ۵،۰۰۰ = ۱۰۵،۰۰۰ | بهای کالا = ۷۰،۰۰۰ | سود = ۳۵،۰۰۰
      var pass = (res.netSales === 105000) && (res.grossProfit === 35000);
      results.push({
        id: 3,
        title: 'سناریو ۳: کرایه فروش به عنوان درآمد خدمات حمل',
        description: 'کرایه ۵،۰۰۰ در فاکتور فروش به جمع کل افزوده شده و سود ناخالص ۳۵،۰۰۰ می‌شود.',
        expected: 'درآمد کل: ۱۰۵،۰۰۰ | سود ناخالص: ۳۵،۰۰۰',
        actual: 'درآمد کل: ' + res.netSales.toLocaleString('fa-IR') + ' | سود: ' + res.grossProfit.toLocaleString('fa-IR'),
        passed: pass
      });
    })();

    // سناریو ۴: استقلال کرایه خرید از فاکتور فروش
    (function test4() {
      var purchaseInv = {
        id: 4,
        type: 'purchase',
        subtotal: 100000,
        shippingCost: 10000,
        grandTotal: 110000
      };
      var saleInv = {
        id: 5,
        type: 'sale',
        subtotal: 150000,
        discount: 0,
        shippingCost: 0,
        items: [{ productId: 20, productName: 'پارچه نخی', quantity: 10, unitPrice: 15000, buyPrice: 11000 }]
      };
      var res = calculateInvoiceProfit(saleInv);
      var pass = (res.cogs === 110000) && (res.grossProfit === 40000);
      results.push({
        id: 4,
        title: 'سناریو ۴: رعایت بهای تمام‌شده مستقل در اقلام خرید و فروش',
        description: 'بهای خرید ۱۱،۰۰۰ برای ۱۰ واحد فروش دقیقا ۱۱۰،۰۰۰ بهای تمام‌شده و ۴۰،۰۰۰ سود تولید می‌کند.',
        expected: 'بهای تمام‌شده: ۱۱۰،۰۰۰ | سود: ۴۰،۰۰۰',
        actual: 'بهای تمام‌شده: ' + res.cogs.toLocaleString('fa-IR') + ' | سود: ' + res.grossProfit.toLocaleString('fa-IR'),
        passed: pass
      });
    })();

    // سناریو ۵: کسر کمیسیون واسطه فروش
    (function test5() {
      var inv = {
        id: 6,
        type: 'sale',
        subtotal: 100000,
        discount: 0,
        shippingCost: 0,
        brokerCommission: 5000,
        grandTotal: 100000,
        items: [{ productId: 30, productName: 'پارچه کرپ', quantity: 10, unitPrice: 10000, buyPrice: 6000 }]
      };
      var res = calculateInvoiceProfit(inv);
      // سود ناخالص = ۴۰،۰۰۰ | پس از کسر کمیسیون = ۳۵،۰۰۰
      var pass = (res.grossProfit === 40000) && (res.profitAfterBroker === 35000);
      results.push({
        id: 5,
        title: 'سناریو ۵: کسر پورسانت واسطه فروش از سود ناخالص',
        description: 'کمیسیون ۵،۰۰۰ واسطه فروش باید از سود ناخالص ۴۰،۰۰۰ کسر شده و سود نهایی ۳۵،۰۰۰ شود.',
        expected: 'سود ناخالص: ۴۰،۰۰۰ | سود پس از کمیسیون: ۳۵،۰۰۰',
        actual: 'سود ناخالص: ' + res.grossProfit.toLocaleString('fa-IR') + ' | سود پس از کمیسیون: ' + res.profitAfterBroker.toLocaleString('fa-IR'),
        passed: pass
      });
    })();

    // سناریو ۶: تفکیک هزینه‌های عملیاتی واقعی از تسویه‌ها و حواله‌ها
    (function test6() {
      var payments = [
        { id: 1, type: 'payment', amount: 50000, category: 'اجاره', date: '1403/08/01' },
        { id: 2, type: 'payment', amount: 100000, sourceInvoiceId: 99, date: '1403/08/02' }, // تسویه فاکتور خرید
        { id: 3, type: 'payment', amount: 80000, transferId: 'tr_123', date: '1403/08/03' }, // انتقال بین‌بانکی
        { id: 4, type: 'payment', amount: 20000, category: '', date: '1403/08/04' } // بدون سرفصل
      ];
      var exp = filterOperatingExpenses(payments, 0, 0);
      var pass = (exp.classifiedOpEx === 50000) &&
                 (exp.supplierSettlements === 100000) &&
                 (exp.transfers === 80000) &&
                 (exp.unclassifiedPayments === 20000);
      results.push({
        id: 6,
        title: 'سناریو ۶: تفکیک هزینه‌های جاری از تسویه بستانکاران و انتقالات',
        description: 'از ۲۵۰،۰۰۰ پرداختی، فقط ۵۰،۰۰۰ اجاره هزینه عملیاتی است و بقیه تسویه/انتقال/نامشخص هستند.',
        expected: 'هزینه عملیاتی: ۵۰،۰۰۰ | تسویه خرید: ۱۰۰،۰۰۰ | انتقال: ۸۰،۰۰۰ | نامشخص: ۲۰،۰۰۰',
        actual: 'عملیاتی: ' + exp.classifiedOpEx.toLocaleString('fa-IR') + ' | تسویه: ' + exp.supplierSettlements.toLocaleString('fa-IR') + ' | انتقال: ' + exp.transfers.toLocaleString('fa-IR'),
        passed: pass
      });
    })();

    // سناریو ۷: قلم بدون قیمت خرید (Zero/Missing buyPrice)
    (function test7() {
      var inv = {
        id: 7,
        type: 'sale',
        subtotal: 50000,
        discount: 0,
        items: [{ productId: 40, productName: 'پارچه تترون', quantity: 10, unitPrice: 5000, buyPrice: 0 }]
      };
      var res = calculateInvoiceProfit(inv);
      var pass = (res.hasUnverifiedItems === true) &&
                 (res.cogs === 0) &&
                 (res.verifiedGrossProfit === 0) &&
                 (res.unverifiedRevenue === 50000) &&
                 (res.status === 'incomplete') &&
                 (res.items[0].grossProfit === null);
      results.push({
        id: 7,
        title: 'سناریو ۷: تشخیص و تفکیک اقلام فاقد قیمت خرید و عدم احتساب فروش به عنوان سود',
        description: 'اقلام با buyPrice صفر به عنوان بهای نامشخص ثبت شده و سود آن‌ها به هیچ وجه به عنوان سود قطعی شناسایی نمی‌شود.',
        expected: 'دارای قلم نامشخص: بله | سود ناخالص موثق: ۰ | وضعیت: ناقص',
        actual: 'دارای قلم نامشخص: ' + (res.hasUnverifiedItems ? 'بله' : 'خیر') + ' | سود موثق: ' + res.verifiedGrossProfit.toLocaleString('fa-IR') + ' | وضعیت: ' + res.statusLabel,
        passed: pass
      });
    })();

    // سناریو ۸: استقلال فاکتور فروش از خریدهای بعدی (ممنوعیت میانگین موزون)
    (function test8() {
      var saleInv = {
        id: 8,
        type: 'sale',
        date: '1403/05/10',
        subtotal: 100000,
        items: [{ productId: 50, productName: 'پارچه مازراتی', quantity: 10, unitPrice: 10000, buyPrice: 6000 }]
      };
      // حتی اگر بعداً خریدی با قیمت ۹،۰۰۰ انجام شود، فاکتور فروش ماه ۵ نباید دستخوش تغییر شود
      var res = calculateInvoiceProfit(saleInv);
      var pass = (res.cogs === 60000) && (res.grossProfit === 40000);
      results.push({
        id: 8,
        title: 'سناریو ۸: مصونیت سود فروش از نوسانات و خریدهای پس از فروش',
        description: 'قیمت خرید ۶،۰۰۰ فاکتور فروش تحت هیچ شرایطی با میانگین خریدهای بعدی جایگزین نمی‌شود.',
        expected: 'بهای تمام‌شده مصون: ۶۰،۰۰۰ | سود: ۴۰،۰۰۰',
        actual: 'بهای تمام‌شده: ' + res.cogs.toLocaleString('fa-IR') + ' | سود: ' + res.grossProfit.toLocaleString('fa-IR'),
        passed: pass
      });
    })();

    // سناریو ۹: تفکیک تاریخ تعهدی فاکتور از تاریخ تسویه چک/وجه
    (function test9() {
      var invoices = [
        {
          id: 9,
          type: 'sale',
          date: '1403/08/15', // ماه ۸
          subtotal: 100000,
          items: [{ productId: 60, productName: 'پارچه حریر', quantity: 10, unitPrice: 10000, buyPrice: 7000 }]
        }
      ];
      var payments = []; // هیچ نقدی در ماه ۸ وصول نشده

      var plMonth8 = calculatePeriodPL(invoices, payments, 14030801, 14030830);
      var plMonth9 = calculatePeriodPL(invoices, payments, 14030901, 14030930);

      var pass = (plMonth8.grossProfit === 30000) && (plMonth9.grossProfit === 0);
      results.push({
        id: 9,
        title: 'سناریو ۹: مبنای تعهدی تاریخ فاکتور در شناسایی سود دوره',
        description: 'سود فاکتور در دوره صدور فاکتور (آبان) شناسایی می‌شود، نه در دوره‌های بعدی.',
        expected: 'سود آبان: ۳۰،۰۰۰ | سود آذر: ۰',
        actual: 'سود آبان: ' + plMonth8.grossProfit.toLocaleString('fa-IR') + ' | سود آذر: ' + plMonth9.grossProfit.toLocaleString('fa-IR'),
        passed: pass
      });
    })();

    // سناریو ۱۰: تجمیع دوره‌ای و تطابق صددرصدی ارقام داشبورد و گزارشات
    (function test10() {
      var invoices = [
        {
          id: 10,
          type: 'sale',
          date: '1403/08/01',
          subtotal: 200000,
          discount: 10000,
          shippingCost: 5000,
          brokerCommission: 5000,
          grandTotal: 195000,
          items: [{ productId: 70, productName: 'پارچه فاستونی', quantity: 20, unitPrice: 10000, buyPrice: 6000 }]
        }
      ];
      var payments = [
        { id: 1, type: 'payment', amount: 30000, category: 'ملزومات دفتر', date: '1403/08/05' }
      ];

      var pl = calculatePeriodPL(invoices, payments, 14030801, 14030830);
      // درآمد خالص = (۲۰۰،۰۰۰ - ۱۰،۰۰۰) + ۵،۰۰۰ = ۱۹۵،۰۰۰
      // بهای کالا = ۲۰ × ۶،۰۰۰ = ۱۲۰،۰۰۰
      // سود ناخالص = ۱۹۵،۰۰۰ - ۱۲۰،۰۰۰ = ۷۵،۰۰۰
      // سود خالص عملیاتی = ۷۵،۰۰۰ - ۵،۰۰۰ (کمیسیون) - ۳۰،۰۰۰ (هزینه ملزومات) = ۴۰،۰۰۰
      var pass = (pl.netSales === 195000) &&
                 (pl.cogs === 120000) &&
                 (pl.grossProfit === 75000) &&
                 (pl.netOperatingProfit === 40000);
      results.push({
        id: 10,
        title: 'سناریو ۱۰: تجمیع دوره‌ای کامل و انطباق فرمول‌های داشبورد و گزارش P&L',
        description: 'تمام فاکتورهای فروش، تخفیف، کرایه، کمیسیون و هزینه جاری باید سود خالص دقیق ۴۰،۰۰۰ تولید کنند.',
        expected: 'فروش خالص: ۱۹۵،۰۰۰ | بهای تمام‌شده: ۱۲۰،۰۰۰ | سود ناخالص: ۷۵،۰۰۰ | سود خالص: ۴۰،۰۰۰',
        actual: 'فروش: ' + pl.netSales.toLocaleString('fa-IR') + ' | سود ناخالص: ' + pl.grossProfit.toLocaleString('fa-IR') + ' | سود خالص: ' + pl.netOperatingProfit.toLocaleString('fa-IR'),
        passed: pass
      });
    })();

    var passedCount = results.filter(function(r) { return r.passed; }).length;
    return {
      passed: passedCount,
      failed: results.length - passedCount,
      total: results.length,
      allPassed: passedCount === results.length,
      results: results
    };
  }

  /**
   * مجموعه ۷ آزمون تخصصی و الزامی اصلاح محاسبات سود اقلام فاقد قیمت خرید معتبر
   * کاملاً ایزوله با داده‌های ساختگی در رم
   */
  function runMandatoryAuditSuite() {
    var results = [];

    // ۱. قلم با قیمت خرید معتبر (قیمت خرید ۵۰، فروش ۸۰، تعداد ۱۰ => سود ۳۰۰)
    (function audit1() {
      var it = { productId: 101, productName: 'تست ۱', quantity: 10, unitPrice: 80, buyPrice: 50 };
      var res = calculateItemProfit(it, 800, 0);
      var pass = (res.hasValidBuyPrice === true) &&
                 (res.cogs === 500) &&
                 (res.grossProfit === 300) &&
                 (res.verifiedGrossProfit === 300) &&
                 (res.isVerified === true);
      results.push({
        id: 1,
        title: 'آزمون ۱: قلم با قیمت خرید معتبر',
        description: 'خرید ۵۰، فروش ۸۰، تعداد ۱۰ باید بهای تمام‌شده ۵۰۰ و سود قطعی ۳۰۰ بدهد.',
        expected: 'بهای تمام‌شده: ۵۰۰ | سود قطعی: ۳۰۰ | وضعیت: معتبر',
        actual: 'بهای تمام‌شده: ' + (res.cogs !== null ? res.cogs : 'نامشخص') + ' | سود: ' + (res.grossProfit !== null ? res.grossProfit : 'نامشخص'),
        passed: pass
      });
    })();

    // ۲. قلم با قیمت خرید صفر (سود نباید ۸۰ به ازای هر واحد باشد، بلکه وضعیت نامشخص)
    (function audit2() {
      var it = { productId: 102, productName: 'تست ۲', quantity: 10, unitPrice: 80, buyPrice: 0 };
      var res = calculateItemProfit(it, 800, 0);
      var pass = (res.hasValidBuyPrice === false) &&
                 (res.grossProfit === null) &&
                 (res.cogs === null) &&
                 (res.verifiedGrossProfit === 0) &&
                 (res.isVerified === false);
      results.push({
        id: 2,
        title: 'آزمون ۲: قلم با قیمت خرید صفر (عدم احتساب به عنوان سود)',
        description: 'قیمت خرید ۰ به معنی خرید رایگان نیست؛ سود نباید ۸۰ به ازای هر واحد (مجموع ۸۰۰) باشد.',
        expected: 'بهای تمام‌شده: نامشخص | سود قطعی: نامشخص (نه ۸۰۰) | وضعیت: نامشخص',
        actual: 'بهای تمام‌شده: ' + (res.cogs !== null ? res.cogs : 'نامشخص') + ' | سود: ' + (res.grossProfit !== null ? res.grossProfit : 'نامشخص (null)'),
        passed: pass
      });
    })();

    // ۳. قلم با قیمت خرید خالی یا null
    (function audit3() {
      var itNull = { productId: 103, productName: 'تست ۳-الف', quantity: 5, unitPrice: 100, buyPrice: null };
      var itEmpty = { productId: 104, productName: 'تست ۳-ب', quantity: 5, unitPrice: 100, buyPrice: '' };
      var itUndef = { productId: 105, productName: 'تست ۳-ج', quantity: 5, unitPrice: 100, buyPrice: undefined };

      var rNull = calculateItemProfit(itNull, 500, 0);
      var rEmpty = calculateItemProfit(itEmpty, 500, 0);
      var rUndef = calculateItemProfit(itUndef, 500, 0);

      var pass = (!rNull.hasValidBuyPrice && rNull.cogs === null && rNull.grossProfit === null) &&
                 (!rEmpty.hasValidBuyPrice && rEmpty.cogs === null && rEmpty.grossProfit === null) &&
                 (!rUndef.hasValidBuyPrice && rUndef.cogs === null && rUndef.grossProfit === null);
      results.push({
        id: 3,
        title: 'آزمون ۳: قلم با قیمت خرید خالی، null یا نامعتبر',
        description: 'مقادیر خالی، null و undefined باید به درستی شناسایی شده و بهای تمام‌شده و سود آن‌ها نامشخص باشد.',
        expected: 'هر ۳ حالت: hasValidBuyPrice=false, cogs=null, grossProfit=null',
        actual: 'null: ' + (!rNull.hasValidBuyPrice ? 'نامشخص' : 'معتبر') + ' | empty: ' + (!rEmpty.hasValidBuyPrice ? 'نامشخص' : 'معتبر') + ' | undefined: ' + (!rUndef.hasValidBuyPrice ? 'نامشخص' : 'معتبر'),
        passed: pass
      });
    })();

    // ۴. فاکتور با ۲ قلم: یکی با قیمت خرید معتبر و یکی نامشخص (سود قلم اول محاسبه شود، وضعیت فاکتور ناقص باشد)
    (function audit4() {
      var inv = {
        id: 106,
        type: 'sale',
        subtotal: 1300,
        discount: 0,
        shippingCost: 0,
        brokerCommission: 0,
        items: [
          { productId: 1, productName: 'کالای معتبر', quantity: 10, unitPrice: 80, buyPrice: 50 }, // سود ۳۰۰
          { productId: 2, productName: 'کالای نامشخص', quantity: 5, unitPrice: 100, buyPrice: null }  // فروش ۵۰۰، سود نامشخص
        ]
      };
      var res = calculateInvoiceProfit(inv);
      var pass = (res.items[0].grossProfit === 300) &&
                 (res.items[1].grossProfit === null) &&
                 (res.salesWithValidBuyPrice === 800) &&
                 (res.salesWithoutValidBuyPrice === 500) &&
                 (res.verifiedCOGS === 500) &&
                 (res.verifiedGrossProfit === 300) &&
                 (res.status === 'incomplete') &&
                 (res.isProfitVerified === false) &&
                 (res.invalidBuyPriceCount === 1) &&
                 (res.invalidBuyPriceAmount === 500);
      results.push({
        id: 4,
        title: 'آزمون ۴: فاکتور ۲ قلمی (یکی معتبر و یکی نامشخص)',
        description: 'سود قلم اول (۳۰۰) محاسبه شده، قلم دوم سود فرضی نمی‌گیرد و کل وضعیت فاکتور ناقص گزارش می‌شود.',
        expected: 'سود قلم اول: ۳۰۰ | سود قلم دوم: نامشخص | سود موثق فاکتور: ۳۰۰ | وضعیت: ناقص',
        actual: 'سود ۱: ' + res.items[0].grossProfit + ' | سود ۲: ' + res.items[1].grossProfit + ' | سود موثق: ' + res.verifiedGrossProfit + ' | وضعیت: ' + res.statusLabel,
        passed: pass
      });
    })();

    // ۵. فاکتور با تمام اقلام دارای قیمت خرید معتبر (سود قطعی)
    (function audit5() {
      var inv = {
        id: 107,
        type: 'sale',
        subtotal: 2000,
        discount: 0,
        shippingCost: 0,
        brokerCommission: 0,
        items: [
          { productId: 1, productName: 'کالا ۱', quantity: 10, unitPrice: 100, buyPrice: 70 }, // بهای ۷۰۰، سود ۳۰۰
          { productId: 2, productName: 'کالا ۲', quantity: 5, unitPrice: 200, buyPrice: 150 }   // بهای ۷۵۰، سود ۲۵۰
        ]
      };
      var res = calculateInvoiceProfit(inv);
      var pass = (res.totalSales === 2000) &&
                 (res.salesWithValidBuyPrice === 2000) &&
                 (res.salesWithoutValidBuyPrice === 0) &&
                 (res.verifiedCOGS === 1450) &&
                 (res.verifiedGrossProfit === 550) &&
                 (res.status === 'complete') &&
                 (res.isProfitVerified === true) &&
                 (res.invalidBuyPriceCount === 0);
      results.push({
        id: 5,
        title: 'آزمون ۵: فاکتور با تمام اقلام دارای قیمت خرید معتبر',
        description: 'فاکتوری که تمام اقلام آن دارای قیمت خرید هستند باید سود قطعی و وضعیت کامل داشته باشد.',
        expected: 'فروش: ۲،۰۰۰ | بهای تمام‌شده: ۱،۴۵۰ | سود قطعی: ۵۵۰ | وضعیت: قطعی',
        actual: 'فروش: ' + res.totalSales + ' | بهای تمام‌شده: ' + res.verifiedCOGS + ' | سود: ' + res.verifiedGrossProfit + ' | وضعیت: ' + res.statusLabel,
        passed: pass
      });
    })();

    // ۶. فاکتور دارای قلم با قیمت خرید بیشتر از قیمت فروش (سود منفی/زیان به‌درستی منعکس شود)
    (function audit6() {
      var inv = {
        id: 108,
        type: 'sale',
        subtotal: 800,
        discount: 0,
        shippingCost: 0,
        brokerCommission: 0,
        items: [
          { productId: 1, productName: 'کالای با زیان', quantity: 10, unitPrice: 80, buyPrice: 100 }
        ]
      };
      var res = calculateInvoiceProfit(inv);
      var pass = (res.items[0].grossProfit === -200) &&
                 (res.verifiedCOGS === 1000) &&
                 (res.verifiedGrossProfit === -200) &&
                 (res.status === 'complete') &&
                 (res.isProfitVerified === true);
      results.push({
        id: 6,
        title: 'آزمون ۶: قلم با قیمت خرید بیشتر از قیمت فروش (شناسایی زیان)',
        description: 'فروش زیر قیمت خرید باید سود منفی (زیان ۲۰۰-) را به عنوان سود قطعی منفی منعکس کند.',
        expected: 'بهای تمام‌شده: ۱،۰۰۰ | سود: ۲۰۰- (زیان) | وضعیت: قطعی',
        actual: 'بهای تمام‌شده: ' + res.verifiedCOGS + ' | سود: ' + res.verifiedGrossProfit + ' | وضعیت: ' + res.statusLabel,
        passed: pass
      });
    })();

    // ۷. تأیید عدم تکرار فروش (عدم Double Counting) اقلام فاقد قیمت خرید در درآمد کل
    (function audit7() {
      var inv = {
        id: 109,
        type: 'sale',
        subtotal: 2000,
        discount: 0,
        shippingCost: 0,
        brokerCommission: 0,
        items: [
          { productId: 1, productName: 'معتبر', quantity: 10, unitPrice: 100, buyPrice: 60 }, // فروش ۱۰۰۰
          { productId: 2, productName: 'بدون قیمت ۰', quantity: 5, unitPrice: 80, buyPrice: 0 }, // فروش ۴۰۰
          { productId: 3, productName: 'بدون قیمت null', quantity: 2, unitPrice: 300, buyPrice: null } // فروش ۶۰۰
        ]
      };
      var res = calculateInvoiceProfit(inv);
      var pass = (res.totalSales === 2000) &&
                 (res.salesWithValidBuyPrice === 1000) &&
                 (res.salesWithoutValidBuyPrice === 1000) &&
                 ((res.salesWithValidBuyPrice + res.salesWithoutValidBuyPrice) === res.totalSales) &&
                 (res.verifiedCOGS === 600) &&
                 (res.verifiedGrossProfit === 400) &&
                 (res.invalidBuyPriceCount === 2) &&
                 (res.invalidBuyPriceAmount === 1000);
      results.push({
        id: 7,
        title: 'آزمون ۷: تأیید عدم Double Counting اقلام فاقد قیمت خرید در درآمد کل',
        description: 'اقلام بدون قیمت خرید دقیقاً یک‌بار در درآمد کل لحاظ شده و جمع تفکیک‌ها با کل فروش منطبق است.',
        expected: 'فروش کل: ۲،۰۰۰ | معتبر: ۱،۰۰۰ | نامعتبر: ۱،۰۰۰ | مجموع تفکیک: ۲،۰۰۰',
        actual: 'فروش کل: ' + res.totalSales + ' | معتبر: ' + res.salesWithValidBuyPrice + ' | نامعتبر: ' + res.salesWithoutValidBuyPrice,
        passed: pass
      });
    })();

    var passedCount = results.filter(function(r) { return r.passed; }).length;
    return {
      passed: passedCount,
      failed: results.length - passedCount,
      total: results.length,
      allPassed: passedCount === results.length,
      results: results
    };
  }

  // اکسپورت ماژول به دامنه سراسری پنجره
  return {
    isValidBuyPrice: isValidBuyPrice,
    calculateItemProfit: calculateItemProfit,
    calculateInvoiceProfit: calculateInvoiceProfit,
    filterOperatingExpenses: filterOperatingExpenses,
    calculatePeriodPL: calculatePeriodPL,
    runDiagnosticSuite: runDiagnosticSuite,
    runMandatoryAuditSuite: runMandatoryAuditSuite
  };
})();

if (typeof window !== 'undefined') {
  window.FinanceEngine = FinanceEngine;
}
if (typeof globalThis !== 'undefined') {
  globalThis.FinanceEngine = FinanceEngine;
}
if (typeof module !== 'undefined' && module.exports) {
  module.exports = FinanceEngine;
}
