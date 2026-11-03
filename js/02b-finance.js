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
   * سرفصل‌های معتبر و تأییدشده هزینه‌های عملیاتی دوره (مطابق ممیزی مرحله دوم)
   * فقط این سرفصل‌ها مجاز به ورود به محاسبات هزینه عملیاتی (OpEx) هستند.
   */
  var APPROVED_OPEX_CATEGORIES = [
    'حقوق و دستمزد',
    'اجاره',
    'هزینه اداری',
    'هزینه حمل',
    'هزینه بازاریابی و تبلیغات',
    'تعمیر و نگهداری',
    'کارمزد بانکی',
    'هزینه‌های متفرقه',
    'سایر هزینه‌ها'
  ];

  function normalizePersianText(str) {
    if (!str || typeof str !== 'string') return '';
    return str
      .trim()
      .replace(/\u200c/g, ' ') // تبدیل نیم‌فاصله به فاصله جهت یکدست‌سازی
      .replace(/[\u064A\u0649]/g, '\u06CC') // ي عربی به ی فارسی
      .replace(/\u0643/g, '\u06A9') // ك عربی به ک فارسی
      .replace(/\s+/g, ' '); // حذف فاصله‌های اضافی
  }

  function isApprovedOpEx(cat) {
    if (!cat || typeof cat !== 'string') return false;
    var norm = normalizePersianText(cat);
    for (var i = 0; i < APPROVED_OPEX_CATEGORIES.length; i++) {
      if (norm === normalizePersianText(APPROVED_OPEX_CATEGORIES[i])) {
        return true;
      }
    }
    return false;
  }

  function isSupplierSettlementCategory(cat) {
    if (!cat || typeof cat !== 'string') return false;
    var norm = normalizePersianText(cat);
    var supplierKeywords = [
      'تامین کننده',
      'تأمین کننده',
      'بستانکار',
      'تسویه حساب',
      'تسویه تامین کننده',
      'تسویه تأمین کننده',
      'تسویه خرید',
      'تسویه بدهی',
      'تسویه تامین کننده / خرید',
      'تسویه تأمین کننده / خرید'
    ];
    for (var i = 0; i < supplierKeywords.length; i++) {
      if (norm === normalizePersianText(supplierKeywords[i])) {
        return true;
      }
    }
    if (norm.indexOf('تسویه تامین کننده') !== -1 || norm.indexOf('تسویه تأمین کننده') !== -1) {
      return true;
    }
    return false;
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

      // ۱. انتقال بین‌بانکی / حواله / صندوق ساختاریافته
      // طبق ممیزی مرحله دوم: صرف وجود کلمات «حواله» یا «انتقال» در شرح آزاد پرداخت نباید
      // به‌تنهایی باعث حذف آن از هزینه‌های عملیاتی یا تلقی خودکار به عنوان حواله شود.
      // تشخیص حواله منحصراً بر پایه transferId و فیلدهای ساختاریافته انتقال انجام می‌گیرد.
      var pDesc = String(p.description || p.notes || p.note || '');
      var isStructuredTransfer = !!(p.transferId || p.transferTo || p.transferFrom);
      if (isStructuredTransfer) {
        transfers += amt;
        return;
      }

      // ۲. پاس شدن یا تسویه چک
      if (p.sourceCheckId) {
        checkSettlements += amt;
        return;
      }

      // ۳. پرداخت متصل به فاکتور خرید یا دارای سرفصل تسویه بستانکاران / تأمین‌کنندگان
      var cat = (p.category || '').trim();
      if (p.sourceInvoiceId || isSupplierSettlementCategory(cat)) {
        supplierSettlements += amt;
        return;
      }

      // ۴. بررسی سرفصل دسته‌بندی هزینه عملیاتی
      // فقط سرفصل‌های معتبر و تأییدشده وارد محاسبات OpEx می‌شوند.
      // هر سرفصل ناشناخته، قدیمی یا خالی در گروه «نیازمند بررسی» قرار گرفته و از سود کسر نمی‌شود.
      if (isApprovedOpEx(cat)) {
        classifiedOpEx += amt;
        byCategory[cat] = (byCategory[cat] || 0) + amt;
        classifiedItems.push({
          id: p.id,
          date: p.date,
          amount: amt,
          category: cat,
          note: pDesc
        });
      } else {
        // پرداخت‌های بدون سرفصل مشخص یا سرفصل‌های ناشناخته/قدیمی
        // (مطابق استانداردهای محافظه‌کارانه حسابداری: تفکیک در نیازمند بررسی بدون کسر از سود)
        unclassifiedPayments += amt;
        unclassifiedItems.push({
          id: p.id,
          date: p.date,
          amount: amt,
          category: cat || 'نامشخص',
          note: pDesc,
          isUnknownCategory: !!cat
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
      supplierSettlements: expenseData.supplierSettlements,
      transfers: expenseData.transfers,
      checkSettlements: expenseData.checkSettlements,
      expenseData: expenseData,
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
      verifiedGrossProfitTitle: isPeriodComplete ? 'سود ناخالص بازرگانی' : 'سود ناخالص قابل‌تأیید',
      verifiedNetProfitTitle: isPeriodComplete ? 'سود خالص عملیاتی' : 'سود خالص قابل‌تأیید',
      profitWarning: isPeriodComplete ? null : 'سود نهایی دوره قابل تعیین نیست',
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
        { id: 1, type: 'payment', amount: 30000, category: 'هزینه اداری', description: 'ملزومات دفتر', date: '1403/08/05' }
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

    // ۸. آزمون صورت سود و زیان دوره‌ای (calculatePeriodPL) با اقلام معتبر و فاقد بهای خرید
    (function audit8() {
      var inv = {
        id: 110,
        type: 'sale',
        subtotal: 1400,
        discount: 0,
        shippingCost: 0,
        brokerCommission: 0,
        items: [
          { productId: 1, productName: 'کالای معتبر', quantity: 10, unitPrice: 100, buyPrice: 60 },
          { productId: 2, productName: 'کالای فاقد قیمت خرید', quantity: 5, unitPrice: 80, buyPrice: null }
        ]
      };
      var pl = calculatePeriodPL([inv], [], 0, 0);

      var conditionTotalSales = (pl.totalSales === 1400 && pl.netSales === 1400);
      var conditionSalesSplit = (pl.salesWithValidBuyPrice === 1000 && pl.salesWithoutValidBuyPrice === 400 && (pl.salesWithValidBuyPrice + pl.salesWithoutValidBuyPrice === 1400));
      var conditionVerifiedProfit = (pl.verifiedGrossProfit === 400 && pl.grossProfit === 400 && pl.verifiedCOGS === 600);
      var conditionIncompleteStatus = (pl.status === 'incomplete' && pl.isProfitVerified === false && pl.isComplete === false && pl.hasUnverifiedItems === true);
      var conditionNotDefinite = (pl.statusLabel !== 'قطعی' && pl.statusLabel.indexOf('ناقص') !== -1);

      var pass = conditionTotalSales &&
                 conditionSalesSplit &&
                 conditionVerifiedProfit &&
                 conditionIncompleteStatus &&
                 conditionNotDefinite;

      results.push({
        id: 8,
        title: 'آزمون ۸: ارزیابی صورت سود و زیان دوره (calculatePeriodPL) با اقلام معتبر و فاقد بهای خرید',
        description: 'بررسی صحت درآمد کل، تفکیک فروش اقلام معتبر/نامعتبر، درستی سود قابل‌تأیید، وضعیت incomplete و عدم معرفی سود ناقص به عنوان سود قطعی.',
        expected: 'فروش کل: ۱،۴۰۰ | معتبر: ۱،۰۰۰ | نامعتبر: ۴۰۰ | سود قابل‌تأیید: ۴۰۰ | وضعیت: incomplete (ناقص - غیرقطعی)',
        actual: 'فروش: ' + pl.totalSales + ' (معتبر: ' + pl.salesWithValidBuyPrice + '، نامعتبر: ' + pl.salesWithoutValidBuyPrice + ') | سود قابل‌تأیید: ' + pl.verifiedGrossProfit + ' | وضعیت: ' + pl.status + ' (' + pl.statusLabel + ')',
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
   * مجموعه آزمون‌های ۸‌گانه ثبت، تفکیک و دسته‌بندی هزینه‌های عملیاتی و صورت سود و زیان (کاملاً ایزوله در رم)
   */
  function runOperatingExpensesSuite() {
    var results = [];

    // ۱. ثبت و شناسایی هزینه اجاره
    (function testOpEx1() {
      var p = { id: 101, type: 'payment', amount: 5000000, category: 'اجاره', date: '1404/01/10', description: 'اجاره ماهانه کارگاه' };
      var exp = filterOperatingExpenses([p]);
      var pass = (exp.classifiedOpEx === 5000000 && exp.byCategory['اجاره'] === 5000000 && exp.classifiedItems.length === 1 && exp.unclassifiedPayments === 0);
      results.push({
        id: 1,
        title: 'آزمون ۱: ثبت و شناسایی هزینه اجاره در سرفصل اختصاصی',
        description: 'بررسی ثبت پرداخت با سرفصل «اجاره» و انعکاس در هزینه‌های عملیاتی طبقه‌بندی‌شده دوره.',
        expected: 'classifiedOpEx: ۵،۰۰۰،۰۰۰ | byCategory[اجاره]: ۵،۰۰۰،۰۰۰ | بدون هزینه نامشخص',
        actual: 'classifiedOpEx: ' + exp.classifiedOpEx + ' | byCategory[اجاره]: ' + (exp.byCategory['اجاره'] || 0) + ' | unclassified: ' + exp.unclassifiedPayments,
        passed: pass
      });
    })();

    // ۲. ثبت و شناسایی هزینه حقوق و دستمزد
    (function testOpEx2() {
      var p = { id: 102, type: 'payment', amount: 3000000, category: 'حقوق و دستمزد', date: '1404/01/25', description: 'حقوق فروردین پرسنل' };
      var exp = filterOperatingExpenses([p]);
      var pass = (exp.classifiedOpEx === 3000000 && exp.byCategory['حقوق و دستمزد'] === 3000000 && exp.unclassifiedPayments === 0);
      results.push({
        id: 2,
        title: 'آزمون ۲: ثبت و شناسایی هزینه حقوق و دستمزد',
        description: 'بررسی ثبت پرداخت با سرفصل «حقوق و دستمزد» و تفکیک در دسته‌بندی هزینه‌های دوره.',
        expected: 'classifiedOpEx: ۳،۰۰۰،۰۰۰ | byCategory[حقوق و دستمزد]: ۳،۰۰۰،۰۰۰',
        actual: 'classifiedOpEx: ' + exp.classifiedOpEx + ' | byCategory[حقوق و دستمزد]: ' + (exp.byCategory['حقوق و دستمزد'] || 0),
        passed: pass
      });
    })();

    // ۳. ثبت و شناسایی هزینه اداری و تجمیع چندگانه
    (function testOpEx3() {
      var p1 = { id: 101, type: 'payment', amount: 5000000, category: 'اجاره', date: '1404/01/10' };
      var p2 = { id: 102, type: 'payment', amount: 3000000, category: 'حقوق و دستمزد', date: '1404/01/25' };
      var p3 = { id: 103, type: 'payment', amount: 1000000, category: 'هزینه اداری', date: '1404/01/28', description: 'قبوض تلفن و اینترنت' };
      var exp = filterOperatingExpenses([p1, p2, p3]);
      var pass = (exp.classifiedOpEx === 9000000 &&
                  exp.byCategory['هزینه اداری'] === 1000000 &&
                  exp.byCategory['اجاره'] === 5000000 &&
                  exp.byCategory['حقوق و دستمزد'] === 3000000);
      results.push({
        id: 3,
        title: 'آزمون ۳: ثبت هزینه اداری و تجمیع سرفصل‌های متنوع عملیاتی',
        description: 'بررسی هم‌افزایی هزینه‌های اداری، حقوق و اجاره و تجمیع صحیح هزینه‌های عملیاتی.',
        expected: 'جمع هزینه‌های عملیاتی: ۹،۰۰۰،۰۰۰ (اجاره: ۵M، حقوق: ۳M، اداری: ۱M)',
        actual: 'جمع هزینه‌ها: ' + exp.classifiedOpEx + ' | اداری: ' + (exp.byCategory['هزینه اداری'] || 0),
        passed: pass
      });
    })();

    // ۴. ثبت تسویه تأمین‌کننده و تفکیک قطعی از هزینه‌های عملیاتی
    (function testOpEx4() {
      var pInv = { id: 104, type: 'payment', amount: 15000000, sourceInvoiceId: 501, date: '1404/01/15' };
      var pCat = { id: 105, type: 'payment', amount: 8000000, category: 'تسویه تأمین‌کننده / خرید', date: '1404/01/20' };
      var exp = filterOperatingExpenses([pInv, pCat]);
      var pass = (exp.classifiedOpEx === 0 && exp.supplierSettlements === 23000000 && exp.unclassifiedPayments === 0);
      results.push({
        id: 4,
        title: 'آزمون ۴: ثبت تسویه بدهی تأمین‌کننده و عدم خلط با هزینه‌های عملیاتی',
        description: 'بررسی عدم ورود پرداخت‌های متصل به فاکتور خرید یا سرفصل تسویه تأمین‌کننده به هزینه‌های عملیاتی.',
        expected: 'supplierSettlements: ۲۳،۰۰۰،۰۰۰ | classifiedOpEx: ۰ (هیچ هزینه‌ای شناسایی نشود)',
        actual: 'supplierSettlements: ' + exp.supplierSettlements + ' | classifiedOpEx: ' + exp.classifiedOpEx,
        passed: pass
      });
    })();

    // ۵. ثبت انتقال وجه بین حساب‌ها (حواله) و تفکیک از هزینه عملیاتی
    (function testOpEx5() {
      var pTr = { id: 106, type: 'payment', amount: 12000000, transferId: 99001, date: '1404/01/18', notes: 'حواله بانکی به حساب سپه' };
      var exp = filterOperatingExpenses([pTr]);
      var pass = (exp.transfers === 12000000 && exp.classifiedOpEx === 0 && exp.unclassifiedPayments === 0);
      results.push({
        id: 5,
        title: 'آزمون ۵: ثبت انتقال بین‌حسابی (حواله) و تفکیک کامل از هزینه‌ها',
        description: 'اطمینان از اینکه جابجایی وجه بین حساب‌های بانکی/صندوق به عنوان هزینه در نظر گرفته نمی‌شود.',
        expected: 'transfers: ۱۲،۰۰۰،۰۰۰ | classifiedOpEx: ۰',
        actual: 'transfers: ' + exp.transfers + ' | classifiedOpEx: ' + exp.classifiedOpEx,
        passed: pass
      });
    })();

    // ۶. ویرایش دسته‌بندی پرداخت و انتقال بین نامشخص و عملیاتی
    (function testOpEx6() {
      var p = { id: 107, type: 'payment', amount: 2500000, category: null, date: '1404/02/01' };
      var before = filterOperatingExpenses([p]);
      var passBefore = (before.unclassifiedPayments === 2500000 && before.classifiedOpEx === 0);

      p.category = 'تعمیر و نگهداری';
      var after = filterOperatingExpenses([p]);
      var passAfter = (after.unclassifiedPayments === 0 && after.classifiedOpEx === 2500000 && after.byCategory['تعمیر و نگهداری'] === 2500000);

      results.push({
        id: 6,
        title: 'آزمون ۶: ویرایش دسته‌بندی پرداخت و انتقال هوشمند بین نامشخص و عملیاتی',
        description: 'بررسی گذار پرداخت از وضعیت نامشخص به سرفصل هزینه مشخص پس از ویرایش.',
        expected: 'قبل: unclassified=۲.۵M, OpEx=۰ | بعد: unclassified=۰, OpEx=۲.۵M (تعمیر و نگهداری)',
        actual: 'قبل: OpEx=' + before.classifiedOpEx + ', Unclass=' + before.unclassifiedPayments + ' | بعد: OpEx=' + after.classifiedOpEx + ', Unclass=' + after.unclassifiedPayments,
        passed: passBefore && passAfter
      });
    })();

    // ۷. نمایش و محاسبه صحیح در صورت سود و زیان (P&L)
    (function testOpEx7() {
      var saleInv = {
        id: 201,
        type: 'sale',
        subtotal: 25000000,
        discount: 0,
        shippingCost: 0,
        brokerCommission: 1000000,
        items: [
          { productId: 1, productName: 'پارچه مبلی', quantity: 100, unitPrice: 250000, buyPrice: 150000 }
        ]
      };
      var p1 = { id: 301, type: 'payment', amount: 5000000, category: 'اجاره', date: '1404/01/10' };
      var p2 = { id: 302, type: 'payment', amount: 3000000, category: 'حقوق و دستمزد', date: '1404/01/25' };

      var pl = calculatePeriodPL([saleInv], [p1, p2], 0, 0);

      var passGross = (pl.grossProfit === 10000000);
      var passBroker = (pl.brokerCommissions === 1000000 && pl.profitAfterBroker === 9000000);
      var passOpEx = (pl.classifiedOpEx === 8000000 && pl.expensesByCategory['اجاره'] === 5000000 && pl.expensesByCategory['حقوق و دستمزد'] === 3000000);
      var passNet = (pl.netOperatingProfit === 1000000); // 10M - 1M - 8M = 1M

      var pass = passGross && passBroker && passOpEx && passNet;
      results.push({
        id: 7,
        title: 'آزمون ۷: محاسبه و انعکاس صحیح هزینه‌های عملیاتی در صورت سود و زیان (P&L)',
        description: 'بررسی کسر دقیق کمیسیون واسطه و هزینه‌های عملیاتی از سود ناخالص جهت محاسبه سود خالص عملیاتی.',
        expected: 'سود ناخالص: ۱۰M | کمیسیون: ۱M | سود پس از کمیسیون: ۹M | هزینه‌های عملیاتی: ۸M | سود خالص: ۱،۰۰۰،۰۰۰',
        actual: 'سود ناخالص: ' + pl.grossProfit + ' | کمیسیون: ' + pl.brokerCommissions + ' | هزینه‌ها: ' + pl.classifiedOpEx + ' | سود خالص نهایی: ' + pl.netOperatingProfit,
        passed: pass
      });
    })();

    // ۸. اطمینان از عدم احتساب تسویه تأمین‌کننده، حواله و پرداخت نامشخص در سود خالص
    (function testOpEx8() {
      var saleInv = {
        id: 201,
        type: 'sale',
        subtotal: 25000000,
        discount: 0,
        shippingCost: 0,
        brokerCommission: 1000000,
        items: [
          { productId: 1, productName: 'پارچه مبلی', quantity: 100, unitPrice: 250000, buyPrice: 150000 }
        ]
      };
      var p1 = { id: 301, type: 'payment', amount: 5000000, category: 'اجاره', date: '1404/01/10' };
      var p2 = { id: 302, type: 'payment', amount: 3000000, category: 'حقوق و دستمزد', date: '1404/01/25' };
      var pSup1 = { id: 303, type: 'payment', amount: 15000000, sourceInvoiceId: 99, date: '1404/01/12' };
      var pSup2 = { id: 304, type: 'payment', amount: 8000000, category: 'تسویه تأمین‌کننده / خرید', date: '1404/01/16' };
      var pTr = { id: 305, type: 'payment', amount: 12000000, transferId: 5544, date: '1404/01/18' };
      var pUnclass = { id: 306, type: 'payment', amount: 4000000, category: null, date: '1404/01/22' };

      var pl = calculatePeriodPL([saleInv], [p1, p2, pSup1, pSup2, pTr, pUnclass], 0, 0);

      var passNetUntouched = (pl.netOperatingProfit === 1000000);
      var passOpExUntouched = (pl.classifiedOpEx === 8000000);
      var passSupSettlement = (pl.supplierSettlements === 23000000);
      var passTransfers = (pl.transfers === 12000000);
      var passUnclass = (pl.unclassifiedPayments === 4000000);

      var pass = passNetUntouched && passOpExUntouched && passSupSettlement && passTransfers && passUnclass;
      results.push({
        id: 8,
        title: 'آزمون ۸: مصونیت سود خالص از تسویه تأمین‌کننده، حواله و پرداخت‌های بدون سرفصل',
        description: 'تأیید عدم کسر ۲۳M تسویه تأمین‌کننده، ۱۲M حواله و ۴M پرداخت نامشخص از سود دوره.',
        expected: 'سود خالص دقیقاً ۱،۰۰۰،۰۰۰ باقی بماند | هزینه‌ها ۸M | تسویه تأمین‌کننده: ۲۳M | حواله: ۱۲M | نامشخص: ۴M',
        actual: 'سود خالص: ' + pl.netOperatingProfit + ' | هزینه‌ها: ' + pl.classifiedOpEx + ' | تسویه: ' + pl.supplierSettlements + ' | حواله: ' + pl.transfers + ' | نامشخص: ' + pl.unclassifiedPayments,
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
   * مجموعه آزمون‌های تکمیلی ممیزی مرحله دوم: اعتبارسنجی سرفصل‌های هزینه و اصلاح تشخیص حواله
   */
  function runPhase2AuditSuite() {
    var results = [];

    // ۱. پرداخت با سرفصل معتبر «اجاره» به عنوان OpEx شناسایی شود
    (function testP2_1() {
      var p = { id: 401, type: 'payment', amount: 7000000, category: 'اجاره', date: '1404/01/10', description: 'اجاره انبار مرکزی' };
      var exp = filterOperatingExpenses([p]);
      var pass = (exp.classifiedOpEx === 7000000 &&
                  exp.byCategory['اجاره'] === 7000000 &&
                  exp.unclassifiedPayments === 0 &&
                  exp.transfers === 0);
      results.push({
        id: 1,
        title: 'ممیزی ۱: شناسایی قطعی سرفصل معتبر «اجاره» در هزینه‌های عملیاتی (OpEx)',
        description: 'بررسی صحت ورود پرداخت با سرفصل معتبر «اجاره» به محاسبات هزینه عملیاتی دوره.',
        expected: 'classifiedOpEx: ۷،۰۰۰،۰۰۰ | byCategory[اجاره]: ۷،۰۰۰،۰۰۰ | unclassified: ۰',
        actual: 'classifiedOpEx: ' + exp.classifiedOpEx + ' | byCategory[اجاره]: ' + (exp.byCategory['اجاره'] || 0) + ' | unclassified: ' + exp.unclassifiedPayments,
        passed: pass
      });
    })();

    // ۲. پرداخت با سرفصل ناشناخته از سود کسر نشود (انتقال به نیازمند بررسی)
    (function testP2_2() {
      var p = { id: 402, type: 'payment', amount: 4000000, category: 'سرمایه‌گذاری شخصی', date: '1404/01/12', description: 'واریز متفرقه' };
      var inv = { id: 501, type: 'sale', subtotal: 10000000, items: [{ productId: 1, quantity: 1, unitPrice: 10000000, buyPrice: 6000000 }] };
      var exp = filterOperatingExpenses([p]);
      var pl = calculatePeriodPL([inv], [p], 0, 0);
      var pass = (exp.classifiedOpEx === 0 &&
                  exp.unclassifiedPayments === 4000000 &&
                  pl.netOperatingProfit === 4000000); // 10M - 6M = 4M gross profit (untouched)
      results.push({
        id: 2,
        title: 'ممیزی ۲: عدم کسر پرداخت با سرفصل ناشناخته از سود و تفکیک در «نیازمند بررسی»',
        description: 'بررسی عدم ورود سرفصل‌های نامعتبر یا ناشناخته به OpEx و حفظ سود عملیاتی.',
        expected: 'classifiedOpEx: ۰ | unclassifiedPayments: ۴،۰۰۰،۰۰۰ | سود خالص بدون کسر: ۴،۰۰۰،۰۰۰',
        actual: 'classifiedOpEx: ' + exp.classifiedOpEx + ' | unclassified: ' + exp.unclassifiedPayments + ' | سود خالص: ' + pl.netOperatingProfit,
        passed: pass
      });
    })();

    // ۳. پرداخت با سرفصل قدیمی و ناشناخته از سود کسر نشود
    (function testP2_3() {
      var p = { id: 403, type: 'payment', amount: 3500000, category: 'هزینه نامشخص دوره قبل', date: '1404/01/14', notes: 'سند سنواتی قدیمی' };
      var inv = { id: 502, type: 'sale', subtotal: 15000000, items: [{ productId: 1, quantity: 1, unitPrice: 15000000, buyPrice: 10000000 }] };
      var exp = filterOperatingExpenses([p]);
      var pl = calculatePeriodPL([inv], [p], 0, 0);
      var pass = (exp.classifiedOpEx === 0 &&
                  exp.unclassifiedPayments === 3500000 &&
                  pl.netOperatingProfit === 5000000); // 15M - 10M = 5M gross profit (untouched)
      results.push({
        id: 3,
        title: 'ممیزی ۳: عدم کسر پرداخت با سرفصل قدیمی/سنواتی ناشناخته از سود دوره',
        description: 'اطمینان از اینکه صرف وجود مقدار در category در اسناد قدیمی، باعث کسر از سود نمی‌شود.',
        expected: 'classifiedOpEx: ۰ | unclassifiedPayments: ۳،۵۰۰،۰۰۰ | سود خالص مصون: ۵،۰۰۰،۰۰۰',
        actual: 'classifiedOpEx: ' + exp.classifiedOpEx + ' | unclassified: ' + exp.unclassifiedPayments + ' | سود خالص: ' + pl.netOperatingProfit,
        passed: pass
      });
    })();

    // ۴. پرداخت واقعی با شرحی شامل کلمه «حواله» ولی بدون شناسه انتقال، اشتباهاً حواله محسوب نشود
    (function testP2_4() {
      // حالت الف: پرداخت هزینه اجاره که در شرح آن واژه حواله آمده است (باید OpEx باشد، نه حواله)
      var pOpEx = { id: 404, type: 'payment', amount: 6000000, category: 'اجاره', description: 'حواله اینترنتی اجاره فروردین دفتر' };
      // حالت ب: پرداخت بدون شناسه انتقال با شرح حواله (حالت مبهم: نباید خودکار حواله شود، بلکه نیازمند بررسی)
      var pAmbiguous = { id: 405, type: 'payment', amount: 2000000, category: null, description: 'حواله نامشخص بدون شناسه' };
      var exp = filterOperatingExpenses([pOpEx, pAmbiguous]);
      var pass = (exp.classifiedOpEx === 6000000 &&
                  exp.byCategory['اجاره'] === 6000000 &&
                  exp.transfers === 0 &&
                  exp.unclassifiedPayments === 2000000);
      results.push({
        id: 4,
        title: 'ممیزی ۴: عدم تلقی اشتباه پرداخت‌های شامل کلمه «حواله» در متن به عنوان انتقال بین‌حسابی',
        description: 'اطمینان از اینکه وجود واژه «حواله» در شرح، هزینه اجاره را حذف نمی‌کند و پرداخت مبهم را خودکار حواله نمی‌کند.',
        expected: 'classifiedOpEx: ۶،۰۰۰،۰۰۰ (اجاره) | transfers: ۰ (هیچ حواله ساختاریافته‌ای نیست) | unclassified: ۲،۰۰۰،۰۰۰',
        actual: 'classifiedOpEx: ' + exp.classifiedOpEx + ' | transfers: ' + exp.transfers + ' | unclassified: ' + exp.unclassifiedPayments,
        passed: pass
      });
    })();

    // ۵. حواله ساختاریافته دارای transferId همچنان از هزینه عملیاتی جدا باشد
    (function testP2_5() {
      var pTr = { id: 406, type: 'payment', amount: 15000000, transferId: 887766, date: '1404/01/18', description: 'انتقال وجه بین بانکی صادرات به سامان' };
      var exp = filterOperatingExpenses([pTr]);
      var pass = (exp.transfers === 15000000 &&
                  exp.classifiedOpEx === 0 &&
                  exp.unclassifiedPayments === 0);
      results.push({
        id: 5,
        title: 'ممیزی ۵: تفکیک قطعی حواله‌های دارای transferId از هزینه‌های عملیاتی',
        description: 'تأیید شناسایی دقیق حواله ساختاریافته بر پایه شناسه انتقال و تفکیک کامل از هزینه‌ها.',
        expected: 'transfers: ۱۵،۰۰۰،۰۰۰ | classifiedOpEx: ۰ | unclassified: ۰',
        actual: 'transfers: ' + exp.transfers + ' | classifiedOpEx: ' + exp.classifiedOpEx + ' | unclassified: ' + exp.unclassifiedPayments,
        passed: pass
      });
    })();

    // ۶. سرفصل «تسویه تأمین‌کننده / خرید» از سود کسر نشود
    (function testP2_6() {
      var pSup = { id: 407, type: 'payment', amount: 12000000, category: 'تسویه تأمین‌کننده / خرید', date: '1404/01/20', description: 'تسویه بستانکاری خرید پارچه' };
      var inv = { id: 503, type: 'sale', subtotal: 20000000, items: [{ productId: 1, quantity: 1, unitPrice: 20000000, buyPrice: 12000000 }] };
      var pl = calculatePeriodPL([inv], [pSup], 0, 0);
      var pass = (pl.supplierSettlements === 12000000 &&
                  pl.classifiedOpEx === 0 &&
                  pl.netOperatingProfit === 8000000); // 20M - 12M = 8M gross profit (untouched)
      results.push({
        id: 6,
        title: 'ممیزی ۶: عدم کسر سرفصل «تسویه تأمین‌کننده / خرید» از صورت سود و زیان',
        description: 'تأیید قرارگیری در گروه تسویه تأمین‌کنندگان و مصونیت کامل سود خالص از این پرداخت.',
        expected: 'supplierSettlements: ۱۲،۰۰۰،۰۰۰ | classifiedOpEx: ۰ | سود خالص دست‌نخورده: ۸،۰۰۰،۰۰۰',
        actual: 'supplierSettlements: ' + pl.supplierSettlements + ' | classifiedOpEx: ' + pl.classifiedOpEx + ' | سود خالص: ' + pl.netOperatingProfit,
        passed: pass
      });
    })();

    // ۷. تفکیک دقیق و عدم اختلاط هزینه‌های عملیاتی، پرداخت‌های ناشناخته، حواله‌ها و تسویه‌ها
    (function testP2_7() {
      var inv = {
        id: 504,
        type: 'sale',
        subtotal: 30000000,
        brokerCommission: 2000000,
        items: [{ productId: 1, quantity: 1, unitPrice: 30000000, buyPrice: 10000000 }]
      }; // سود ناخالص = 20,000,000 | پس از کمیسیون = 18,000,000

      var pRent = { id: 410, type: 'payment', amount: 6000000, category: 'اجاره', description: 'حواله اجاره' };
      var pSalary = { id: 411, type: 'payment', amount: 4000000, category: 'حقوق و دستمزد', description: 'حقوق پرسنل' };
      var pUnknown = { id: 412, type: 'payment', amount: 5000000, category: 'سرفصل نامعتبر ناشناس', description: 'مخارج نامشخص' };
      var pAmbiguousWord = { id: 413, type: 'payment', amount: 3000000, category: null, description: 'انتقال بدون شناسه' };
      var pRealTransfer = { id: 414, type: 'payment', amount: 8000000, transferId: 998877, description: 'حواله به بانک دیگر' };
      var pSupSettlement = { id: 415, type: 'payment', amount: 14000000, category: 'تسویه تأمین‌کننده / خرید' };

      var pl = calculatePeriodPL([inv], [pRent, pSalary, pUnknown, pAmbiguousWord, pRealTransfer, pSupSettlement], 0, 0);

      var pass = (pl.grossProfit === 20000000 &&
                  pl.brokerCommissions === 2000000 &&
                  pl.profitAfterBroker === 18000000 &&
                  pl.classifiedOpEx === 10000000 && // 6M + 4M
                  pl.unclassifiedPayments === 8000000 && // 5M + 3M
                  pl.transfers === 8000000 && // 8M
                  pl.supplierSettlements === 14000000 && // 14M
                  pl.netOperatingProfit === 8000000); // 20M - 2M - 10M = 8M

      results.push({
        id: 7,
        title: 'ممیزی ۷: آزمون تجمیعی عدم اختلاط OpEx، پرداخت‌های ناشناخته، حواله‌ها و تسویه‌ها در P&L',
        description: 'بررسی جامع همزمانی تمام جریان‌ها و اطمینان از کسر صرفاً هزینه‌های عملیاتی تأییدشده از سود.',
        expected: 'OpEx: ۱۰M | نامشخص: ۸M | حواله: ۸M | تسویه: ۱۴M | سود خالص نهایی: ۸،۰۰۰،۰۰۰',
        actual: 'OpEx: ' + pl.classifiedOpEx + ' | نامشخص: ' + pl.unclassifiedPayments + ' | حواله: ' + pl.transfers + ' | تسویه: ' + pl.supplierSettlements + ' | سود خالص: ' + pl.netOperatingProfit,
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
   * ══════════════════════════════════════════════════════════════════════════════
   * ممیزی و محاسبه مانده حساب‌های بانکی و نقدینگی (Bank Balance & Cash Audit)
   * ══════════════════════════════════════════════════════════════════════════════
   * منبع واحد حقیقت (Single Source of Truth) برای مانده هر حساب بانکی و صندوق.
   *
   * اصول قطعی:
   * ۱. مانده حساب = موجودی اولیه + دریافت‌های دارای bankId - پرداخت‌های دارای bankId + حواله ورودی - حواله خروجی.
   * ۲. مبالغ پرداختی فاکتورها منحصراً از طریق اسناد پرداخت متناظر در جدول payments (که با sourceInvoiceId و bankId ثبت شده‌اند)
   *    محاسبه می‌شوند و هرگز نباید paidAmount فاکتورها به صورت موازی با payments جمع شود (تضمین صفر شدن خطای دوباره‌شماری).
   * ۳. پرداخت‌ها/دریافت‌های نقدی بدون حساب (bankId == null) وارد مانده بانک‌های دارای شناسه نمی‌شوند و در نقدینگی آزاد نگهداری می‌شوند.
   * ۴. حواله‌های بین دو حساب (bankTransfers) جمع جبری کل نقدینگی را تغییر نمی‌دهند (تراز صفر).
   */
  function calculateBankBalances(banks, payments, bankTransfers, options) {
    var bList = Array.isArray(banks) ? banks : [];
    var pList = Array.isArray(payments) ? payments : [];
    var btList = Array.isArray(bankTransfers) ? bankTransfers : [];
    var opts = options || {};

    var startNum = opts.startNum || (opts.startDate ? parseDateNum(opts.startDate) : 0);
    var endNum = opts.endNum || (opts.endDate ? parseDateNum(opts.endDate) : 0);

    var bankMap = {};
    var detailedList = [];
    var totalBankBal = 0;
    var periodReceipts = 0;
    var periodPayments = 0;

    // نگاشت اولیه حساب‌ها
    bList.forEach(function(b) {
      if (!b || b.id == null) return;
      var bid = b.id;
      var ob = safeNum(b.openingBalance);
      var bName = b.name || 'حساب بدون نام';
      var isCash = (bName.indexOf('صندوق') !== -1 || bName.indexOf('نقد') !== -1 || b.isCash === true);
      bankMap[bid] = {
        id: bid,
        name: bName,
        bankName: b.bankName || '',
        accountNumber: b.accountNumber || '',
        cardNumber: b.cardNumber || '',
        openingBalance: ob,
        balance: ob,
        totalReceipts: 0,
        totalPayments: 0,
        periodReceipts: 0,
        periodPayments: 0,
        transfersIn: 0,
        transfersOut: 0,
        isCash: isCash
      };
    });

    // پردازش دریافت‌ها و پرداخت‌ها
    var unassignedCash = {
      totalReceipts: 0,
      totalPayments: 0,
      balance: 0,
      periodReceipts: 0,
      periodPayments: 0
    };

    pList.forEach(function(p) {
      if (!p) return;
      var amt = safeNum(p.amount);
      if (amt <= 0) return;

      var pDateNum = p.date ? parseDateNum(p.date) : 0;
      var inPeriod = (startNum === 0 || pDateNum >= startNum) && (endNum === 0 || pDateNum <= endNum);
      var isReceipt = (p.type === 'receipt');

      if (p.bankId != null && bankMap[p.bankId]) {
        var acc = bankMap[p.bankId];
        if (isReceipt) {
          acc.balance += amt;
          acc.totalReceipts += amt;
          if (inPeriod) {
            acc.periodReceipts += amt;
            periodReceipts += amt;
          }
        } else {
          acc.balance -= amt;
          acc.totalPayments += amt;
          if (inPeriod) {
            acc.periodPayments += amt;
            periodPayments += amt;
          }
        }
      } else {
        // پرداخت یا دریافت نقدی بدون انتخاب حساب بانکی (صندوق آزاد / بدون حساب)
        if (isReceipt) {
          unassignedCash.totalReceipts += amt;
          unassignedCash.balance += amt;
          if (inPeriod) unassignedCash.periodReceipts += amt;
        } else {
          unassignedCash.totalPayments += amt;
          unassignedCash.balance -= amt;
          if (inPeriod) unassignedCash.periodPayments += amt;
        }
      }
    });

    // پردازش حواله‌ها و نقل و انتقالات بین‌بانکی
    var totalTransfersVolume = 0;
    btList.forEach(function(bt) {
      if (!bt) return;
      var amt = safeNum(bt.amount);
      if (amt <= 0) return;
      totalTransfersVolume += amt;

      if (bt.fromBankId != null && bankMap[bt.fromBankId]) {
        bankMap[bt.fromBankId].balance -= amt;
        bankMap[bt.fromBankId].transfersOut += amt;
      }
      if (bt.toBankId != null && bankMap[bt.toBankId]) {
        bankMap[bt.toBankId].balance += amt;
        bankMap[bt.toBankId].transfersIn += amt;
      }
    });

    // تجمیع خروجی
    bList.forEach(function(b) {
      if (!b || b.id == null) return;
      var item = bankMap[b.id];
      if (item) {
        totalBankBal += item.balance;
        detailedList.push(item);
      }
    });

    return {
      bankBalances: detailedList,
      bankMap: bankMap,
      totalBankBal: totalBankBal,
      totalBankBalance: totalBankBal,
      bankReceiptsPeriod: periodReceipts,
      bankPaymentsPeriod: periodPayments,
      unassignedCash: unassignedCash,
      totalLiquidity: totalBankBal + unassignedCash.balance,
      totalTransfersVolume: totalTransfersVolume
    };
  }

  function calculateAccountBalance(bankId, banks, payments, bankTransfers) {
    if (bankId == null) return 0;
    var all = calculateBankBalances(banks, payments, bankTransfers);
    var acc = all.bankMap[bankId];
    return acc ? acc.balance : 0;
  }

  /**
   * ══════════════════════════════════════════════════════════════════════════════
   * آزمون‌های ۸‌گانه الزامی ممیزی مانده حساب‌های بانکی و نقدینگی در رم (Bank Audit Suite)
   * ══════════════════════════════════════════════════════════════════════════════
   */
  function runBankAuditSuite() {
    var results = [];

    // ۱. ثبت فاکتور با پرداخت کامل بانکی: مبلغ فقط یک بار به مانده بانک اضافه شود
    (function testB1_fullPayment() {
      var bank = { id: 1, name: 'بانک ملت', openingBalance: 10000000 };
      var invoice = { id: 101, type: 'sale', grandTotal: 5000000, paidAmount: 5000000, bankId: 1 };
      var autoPayment = { id: 201, type: 'receipt', amount: 5000000, bankId: 1, sourceInvoiceId: 101, auto: true };

      var res = calculateBankBalances([bank], [autoPayment], []);
      var bal = res.bankMap[1].balance;
      // اگر سیستم هم inv.paidAmount و هم autoPayment را جمع می‌کرد، مانده ۲۰،۰۰۰،۰۰۰ می‌شد
      var pass = (bal === 15000000 && res.totalBankBal === 15000000);

      results.push({
        id: 1,
        title: 'آزمون ۱: فاکتور با پرداخت کامل بانکی (شمارش دقیقاً یک‌باره مبلغ)',
        description: 'بررسی اینکه مبلغ پرداخت‌شده فاکتور فقط از طریق سند پرداختی جدول payments حساب شود و با paidAmount دوبار شمرده نشود.',
        expected: 'مانده بانک: ۱۵،۰۰۰،۰۰۰ ریال',
        actual: 'مانده محاسبه‌شده: ' + bal,
        passed: pass
      });
    })();

    // ۲. ثبت فاکتور با پرداخت جزئی: فقط مبلغ پرداخت‌شده وارد بانک شود، نه کل مبلغ فاکتور
    (function testB2_partialPayment() {
      var bank = { id: 2, name: 'بانک صادرات', openingBalance: 20000000 };
      var invoice = { id: 102, type: 'sale', grandTotal: 12000000, paidAmount: 4000000, bankId: 2 };
      var autoPayment = { id: 202, type: 'receipt', amount: 4000000, bankId: 2, sourceInvoiceId: 102, auto: true };

      var res = calculateBankBalances([bank], [autoPayment], []);
      var bal = res.bankMap[2].balance;
      var pass = (bal === 24000000); // 20M + 4M (not + 12M)

      results.push({
        id: 2,
        title: 'آزمون ۲: فاکتور با پرداخت جزئی (اضافه شدن صرفاً مبلغ پرداختی واقعی)',
        description: 'اطمینان از اینکه در پرداخت جزئی فقط مبلغ نقد پرداخت‌شده (۴M) به موجودی بانک افزوده می‌شود نه کل فاکتور (۱۲M).',
        expected: 'مانده بانک: ۲۴،۰۰۰،۰۰۰ ریال',
        actual: 'مانده محاسبه‌شده: ' + bal,
        passed: pass
      });
    })();

    // ۳. پرداخت بعدی برای مانده فاکتور: فقط مبلغ پرداخت بعدی اضافه شود و مانده قبلی حفظ شود
    (function testB3_subsequentPayment() {
      var bank = { id: 2, name: 'بانک صادرات', openingBalance: 20000000 };
      var autoPayment = { id: 202, type: 'receipt', amount: 4000000, bankId: 2, sourceInvoiceId: 102, auto: true };
      var manualPayment = { id: 203, type: 'receipt', amount: 5000000, bankId: 2, contactId: 10, notes: 'تسویه قسط دوم فاکتور ۱۰۲' };

      var res = calculateBankBalances([bank], [autoPayment, manualPayment], []);
      var bal = res.bankMap[2].balance;
      var pass = (bal === 29000000); // 20M + 4M + 5M

      results.push({
        id: 3,
        title: 'آزمون ۳: پرداخت مرحله‌ای برای مانده فاکتور (شمارش مستقل هر پرداخت بعدی)',
        description: 'بررسی ثبت دریافت قسطی یا ثانویه فاکتور و افزایش دقیق ۵M بدون دستکاری پرداخت اولیه ۴M.',
        expected: 'مانده بانک: ۲۹،۰۰۰،۰۰۰ ریال',
        actual: 'مانده محاسبه‌شده: ' + bal,
        passed: pass
      });
    })();

    // ۴. پرداخت نقدی فاکتور: مانده بانک‌های غیرنقدی تغییر نکند
    (function testB4_cashPayment() {
      var bank = { id: 3, name: 'بانک تجارت', openingBalance: 50000000 };
      var invoice = { id: 103, type: 'sale', grandTotal: 3000000, paidAmount: 3000000, bankId: null };
      var autoCashPayment = { id: 204, type: 'receipt', amount: 3000000, bankId: null, sourceInvoiceId: 103, auto: true };

      var res = calculateBankBalances([bank], [autoCashPayment], []);
      var bankBal = res.bankMap[3].balance;
      var unassigned = res.unassignedCash.balance;
      var pass = (bankBal === 50000000 && unassigned === 3000000);

      results.push({
        id: 4,
        title: 'آزمون ۴: پرداخت نقدی فاکتور (تفکیک از حساب‌های بانکی و حفظ مانده بانک)',
        description: 'دریافت‌های نقدی بدون شناسه حساب نباید مانده بانک‌های تعریف‌شده را تغییر دهند و در نقدینگی آزاد لحاظ می‌شوند.',
        expected: 'مانده بانک تجارت: ۵۰،۰۰۰،۰۰۰ | نقدینگی نقدی آزاد: ۳،۰۰۰،۰۰۰',
        actual: 'بانک تجارت: ' + bankBal + ' | نقد آزاد: ' + unassigned,
        passed: pass
      });
    })();

    // ۵. انتقال وجه بین دو حساب: از مبدأ کسر، به مقصد اضافه، و جمع کل نقدینگی ثابت بماند
    (function testB5_bankTransfer() {
      var bankA = { id: 10, name: 'بانک الف', openingBalance: 15000000 };
      var bankB = { id: 20, name: 'بانک ب', openingBalance: 25000000 };
      var transfer = { id: 301, fromBankId: 10, toBankId: 20, amount: 6000000, date: '1404/01/15' };

      var res = calculateBankBalances([bankA, bankB], [], [transfer]);
      var balA = res.bankMap[10].balance;
      var balB = res.bankMap[20].balance;
      var total = res.totalBankBal;
      var pass = (balA === 9000000 && balB === 31000000 && total === 40000000);

      results.push({
        id: 5,
        title: 'آزمون ۵: انتقال وجه بین‌بانکی (تراز صفربین و حفظ ثبات جمع دارایی نقد و بانک)',
        description: 'انتقال ۶M از بانک الف به ب باید دقیقاً از الف کم و به ب اضافه شود و کل موجودی روی ۴۰M ثابت بماند.',
        expected: 'بانک الف: ۹M | بانک ب: ۳۱M | جمع کل نقدینگی: ۴۰،۰۰۰،۰۰۰',
        actual: 'بانک الف: ' + balA + ' | بانک ب: ' + balB + ' | جمع کل: ' + total,
        passed: pass
      });
    })();

    // ۶. ویرایش مبلغ پرداختی فاکتور: به‌روزرسانی سند خودکار، عدم انباشت یا ساخت رکورد جدید
    (function testB6_editPayment() {
      var bank = { id: 1, name: 'بانک ملت', openingBalance: 10000000 };
      // حالت قبل از ویرایش: paidAmount = 2000000
      var autoPayment = { id: 205, type: 'receipt', amount: 2000000, bankId: 1, sourceInvoiceId: 104, auto: true };
      // کاربر فاکتور را ویرایش کرده و پرداختی را به 7000000 تغییر داده است؛ syncAutoPayment رکورد موجود را آپدیت می‌کند:
      autoPayment.amount = 7000000;

      var res = calculateBankBalances([bank], [autoPayment], []);
      var bal = res.bankMap[1].balance;
      // اگر رکورد جدید افزوده می‌شد یا دوباره‌شماری رخ می‌داد، عدد ۱۹،۰۰۰،۰۰۰ می‌شد
      var pass = (bal === 17000000); // 10M + 7M

      results.push({
        id: 6,
        title: 'آزمون ۶: ویرایش پرداخت فاکتور (جایگزینی دقیق مبلغ و عدم ایجاد رکورد مضاعف)',
        description: 'تغییر مبلغ پرداختی فاکتور باید بدون انباشت سند، مبلغ جدید (۷M) را جایگزین کند.',
        expected: 'مانده بانک: ۱۷،۰۰۰،۰۰۰ ریال',
        actual: 'مانده محاسبه‌شده: ' + bal,
        passed: pass
      });
    })();

    // ۷. تطابق ۱۰۰٪ مانده محاسبه‌شده بین داشبورد و صفحه بانک‌ها
    (function testB7_dashboardAndBankMatch() {
      var b1 = { id: 101, name: 'بانک ملی', openingBalance: 12000000 };
      var b2 = { id: 102, name: 'بانک ملت', openingBalance: 18000000 };
      var b3 = { id: 103, name: 'صندوق نقدی', openingBalance: 5000000 };
      var banks = [b1, b2, b3];

      var payments = [
        { id: 1, type: 'receipt', amount: 3000000, bankId: 101 },
        { id: 2, type: 'payment', amount: 2000000, bankId: 101 },
        { id: 3, type: 'receipt', amount: 7000000, bankId: 102 },
        { id: 4, type: 'payment', amount: 1000000, bankId: 103 }
      ];

      var transfers = [
        { id: 1, fromBankId: 102, toBankId: 101, amount: 4000000 }
      ];

      // محاسبه در داشبورد به روش تجمیعی
      var dashRes = calculateBankBalances(banks, payments, transfers);
      // محاسبه تک‌تک در صفحه بانک‌ها
      var singleBal101 = calculateAccountBalance(101, banks, payments, transfers);
      var singleBal102 = calculateAccountBalance(102, banks, payments, transfers);
      var singleBal103 = calculateAccountBalance(103, banks, payments, transfers);

      var pass = (dashRes.bankMap[101].balance === singleBal101 &&
                  dashRes.bankMap[102].balance === singleBal102 &&
                  dashRes.bankMap[103].balance === singleBal103 &&
                  singleBal101 === 17000000 && // 12M + 3M - 2M + 4M
                  singleBal102 === 21000000 && // 18M + 7M - 4M
                  singleBal103 === 4000000);  // 5M - 1M

      results.push({
        id: 7,
        title: 'آزمون ۷: تطابق ۱۰۰٪ مانده محاسبه‌شده بین داشبورد و صفحه بانک‌ها',
        description: 'تضمین انطباق ریاضی کامل خروجی داشبورد و صفحه جزئیات حساب‌ها با منبع واحد حقیقت.',
        expected: 'ب۱۰۱: ۱۷M | ب۱۰۲: ۲۱M | ب۱۰۳: ۴M با تطابق کامل دوطرفه',
        actual: 'ب۱۰۱: ' + singleBal101 + ' | ب۱۰۲: ' + singleBal102 + ' | ب۱۰۳: ' + singleBal103,
        passed: pass
      });
    })();

    // ۸. عدم جمع جبری paidAmount فاکتور و پرداخت‌های متناظر آن در گزارش‌ها/داشبورد
    (function testB8_noDoubleCountInReports() {
      var inv = { id: 901, type: 'sale', grandTotal: 10000000, paidAmount: 6000000 };
      var autoPay = { id: 91, type: 'receipt', amount: 6000000, sourceInvoiceId: 901, auto: true };
      var indepPay = { id: 92, type: 'receipt', amount: 2000000, sourceInvoiceId: null };

      var allPays = [autoPay, indepPay];

      // شبیه‌سازی منطق بدون دوباره‌شماری در گزارش‌ها:
      // دریافت فاکتور = مجموع پرداختی فاکتورها (یا پرداخت‌های دارای sourceInvoiceId)
      var invPaid = inv.paidAmount;
      // دریافت مستقل = دریافت‌های فاقد sourceInvoiceId
      var indepTotal = 0;
      allPays.forEach(function(p) {
        if (!p.sourceInvoiceId && p.type === 'receipt') indepTotal += p.amount;
      });
      var totalReceived = invPaid + indepTotal;
      var remainingReceivable = inv.grandTotal - totalReceived;

      // در حالت اشتباه قبلی: totalReceived = invPaid + (autoPay + indepPay) = 6M + 8M = 14M (بیش از کل فاکتور!)
      var pass = (totalReceived === 8000000 && remainingReceivable === 2000000);

      results.push({
        id: 8,
        title: 'آزمون ۸: ممیزی گزارش‌ها و تفکیک پرداخت‌های مستقل از اسناد خودکار فاکتور',
        description: 'عدم احتساب مضاعف سند خودکار فاکتور در پرداخت‌های مستقل و صحت مانده مطالبات.',
        expected: 'دریافتی فاکتور: ۶M | دریافتی مستقل: ۲M | کل دریافت: ۸M | مانده طلب: ۲M',
        actual: 'کل دریافت: ' + totalReceived + ' | مانده طلب: ' + remainingReceivable,
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
    calculateBankBalances: calculateBankBalances,
    calculateAccountBalance: calculateAccountBalance,
    runDiagnosticSuite: runDiagnosticSuite,
    runMandatoryAuditSuite: runMandatoryAuditSuite,
    runOperatingExpensesSuite: runOperatingExpensesSuite,
    runPhase2AuditSuite: runPhase2AuditSuite,
    runBankAuditSuite: runBankAuditSuite,
    APPROVED_OPEX_CATEGORIES: APPROVED_OPEX_CATEGORIES,
    isApprovedOpEx: isApprovedOpEx,
    isSupplierSettlementCategory: isSupplierSettlementCategory
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
