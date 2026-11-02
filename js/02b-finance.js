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
    var buyPrice = safeNum(it.buyPrice);
    var hasValidBuyPrice = buyPrice > 0;

    // بهای تمام‌شده: فقط در صورت ثبت صریح buyPrice معتبر
    var cogs = hasValidBuyPrice ? Math.round(buyPrice * qty) : 0;
    var grossProfit = netRevenue - cogs;
    var marginPct = netRevenue > 0 ? (grossProfit / netRevenue) * 100 : 0;

    return {
      productId: it.productId,
      productName: it.productName || (it.name || 'نامشخص'),
      quantity: qty,
      unitPrice: unitPrice,
      buyPrice: buyPrice,
      hasValidBuyPrice: hasValidBuyPrice,
      itemTotal: itemTotal,
      allocatedDiscount: allocatedDiscount,
      netRevenue: netRevenue,
      cogs: cogs,
      grossProfit: grossProfit,
      marginPct: marginPct
    };
  }

  /**
   * محاسبه جامع سود و متغیرهای مالی یک فاکتور فروش
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
    var totalCOGS = 0;
    var unverifiedCount = 0;
    var unverifiedRevenue = 0;

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
      totalCOGS += itemCalc.cogs;
      if (!itemCalc.hasValidBuyPrice) {
        unverifiedCount++;
        unverifiedRevenue += itemCalc.netRevenue;
      }
    });

    // درآمد خدمات حمل به عنوان بخشی از درآمد کل فاکتور لحاظ می‌شود
    var netSales = (computedSubtotal - discount) + shippingCost;
    var grossProfit = netSales - totalCOGS;
    var profitAfterBroker = grossProfit - brokerCommission;
    var marginPct = netSales > 0 ? (profitAfterBroker / netSales) * 100 : 0;

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
      netSales: netSales,
      cogs: totalCOGS,
      grossProfit: grossProfit,
      profitAfterBroker: profitAfterBroker,
      marginPct: marginPct,
      hasUnverifiedItems: unverifiedCount > 0,
      unverifiedCount: unverifiedCount,
      unverifiedRevenue: unverifiedRevenue,
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
    var totalCOGS = 0;
    var totalBrokerCommissions = 0;
    var unverifiedItemsCount = 0;
    var unverifiedRevenueTotal = 0;

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
      totalCOGS += calc.cogs;
      totalBrokerCommissions += calc.brokerCommission;
      unverifiedItemsCount += calc.unverifiedCount;
      unverifiedRevenueTotal += calc.unverifiedRevenue;

      // تجمیع به تفکیک کالا
      calc.items.forEach(function(it) {
        var pid = it.productId || it.productName;
        if (!productBreakdown[pid]) {
          productBreakdown[pid] = {
            id: it.productId,
            name: it.productName,
            qty: 0,
            revenue: 0,
            cogs: 0,
            profit: 0,
            unverifiedCount: 0
          };
        }
        productBreakdown[pid].qty += it.quantity;
        productBreakdown[pid].revenue += it.netRevenue;
        productBreakdown[pid].cogs += it.cogs;
        productBreakdown[pid].profit += it.grossProfit;
        if (!it.hasValidBuyPrice) {
          productBreakdown[pid].unverifiedCount++;
        }
      });
    });

    var netSales = (grossSales - totalDiscounts) + totalShipping;
    var grossProfit = netSales - totalCOGS;
    var grossMarginPct = netSales > 0 ? (grossProfit / netSales) * 100 : 0;

    // استخراج هزینه‌های عملیاتی دوره
    var expenseData = filterOperatingExpenses(payments, sNum, eNum);
    var classifiedOpEx = expenseData.classifiedOpEx;
    var unclassifiedPayments = expenseData.unclassifiedPayments;

    // سود خالص عملیاتی نهایی
    var netOperatingProfit = grossProfit - totalBrokerCommissions - classifiedOpEx;
    var netMarginPct = netSales > 0 ? (netOperatingProfit / netSales) * 100 : 0;

    return {
      period: { startNum: sNum, endNum: eNum },
      invoiceCount: saleInvs.length,
      grossSales: grossSales,
      totalDiscounts: totalDiscounts,
      totalShipping: totalShipping,
      netSales: netSales,
      cogs: totalCOGS,
      grossProfit: grossProfit,
      grossMarginPct: grossMarginPct,
      brokerCommissions: totalBrokerCommissions,
      classifiedOpEx: classifiedOpEx,
      unclassifiedPayments: unclassifiedPayments,
      expensesByCategory: expenseData.byCategory,
      netOperatingProfit: netOperatingProfit,
      netMarginPct: netMarginPct,
      unverifiedItemsCount: unverifiedItemsCount,
      unverifiedRevenueTotal: unverifiedRevenueTotal,
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
      var pass = (res.hasUnverifiedItems === true) && (res.cogs === 0) && (res.unverifiedRevenue === 50000);
      results.push({
        id: 7,
        title: 'سناریو ۷: تشخیص و برچسب‌گذاری اقلام فاقد قیمت خرید',
        description: 'اقلام با buyPrice صفر باید به عنوان بهای نامشخص برچسب‌گذاری و تفکیک شوند.',
        expected: 'دارای قلم نامشخص: بله | بهای تمام‌شده: ۰ | فروش نامشخص: ۵۰،۰۰۰',
        actual: 'دارای قلم نامشخص: ' + (res.hasUnverifiedItems ? 'بله' : 'خیر') + ' | بهای تمام‌شده: ' + res.cogs.toLocaleString('fa-IR'),
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

  // اکسپورت ماژول به دامنه سراسری پنجره
  return {
    calculateItemProfit: calculateItemProfit,
    calculateInvoiceProfit: calculateInvoiceProfit,
    filterOperatingExpenses: filterOperatingExpenses,
    calculatePeriodPL: calculatePeriodPL,
    runDiagnosticSuite: runDiagnosticSuite
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
