/* ══ ROUTES ══ */
async function routeToHash() {
  var hash = (location.hash || '').replace('#', '').trim();
  /* Object.prototype.hasOwnProperty برای جلوگیری از تطبیق اشتباه با
     خصوصیت‌های ارثی مانند «constructor» در آدرس */
  if (hash && Object.prototype.hasOwnProperty.call(ROUTES, hash)) {
    /* نگهبان سطح دسترسی — صفحه‌های محدودشده برای نقش کاربر باز نمی‌شوند */
    if (typeof Perm !== 'undefined' && !Perm.guardPage(hash)) {
      await Dash.render();
      return;
    }
    try {
      await ROUTES[hash]();
    } catch (e) {
      console.error('Route ' + hash + ' failed:', e);
      UI.toast('خطا در بارگذاری صفحه: ' + (e.message || ''), 'e');
    }
    return;
  }
  await Dash.render();
}
/* اصلاح: هر مسیر حالا Promise را برمی‌گرداند. قبلاً نتیجه render
   بازگردانده نمی‌شد، بنابراین routeToHash نمی‌توانست منتظر پایان
   بارگذاری بماند و خطاهای درون صفحه هم قابل گرفتن نبود. */
var ROUTES = {
  dashboard: function() {
    return Dash.render();
  },
  categories: function() {
    return Cat.render();
  },
  products: function() {
    return Prod.render();
  },
  contacts: function() {
    return Con.render();
  },
  purchase: function() {
    return Inv.render('purchase');
  },
  sales: function() {
    return Inv.render('sale');
  },
  proforma: function() {
    return Inv.render('proforma');
  },
  warehouse: function() {
    return Wh.render();
  },
  payments: function() {
    return Pay.render();
  },
  checks: function() {
    return Chk.render();
  },
  ledger: function() {
    return Led.render();
  },
  productLedger: function() {
    return PLed.render();
  },
  reports: function() {
    return Rep.render();
  },
  years: function() {
    return FY.render();
  },
  banks: function() {
    return Bank.render();
  },
  settings: function() {
    return Settings.render();
  },
  users: function() {
    return Users.render();
  }
};
