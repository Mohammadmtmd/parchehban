/* ══ NAVIGATION ══ */
var navEl = document.getElementById('sidebarNav');
if (navEl) navEl.addEventListener('click', function(e) {
  var item = e.target.closest('.ni');
  if (!item) return;
  e.preventDefault();
  var p = item.dataset.page;
  if (!ROUTES[p]) return;
  /* اصلاح: قبلاً replaceState استفاده می‌شد، پس هیچ سابقه‌ای در مرورگر
     ثبت نمی‌شد و دکمه «بازگشت» کاربر را از برنامه بیرون می‌برد.
     حالا pushState سابقه می‌سازد (به‌جز وقتی همان صفحه دوباره کلیک شود). */
  var cur = (location.hash || '').replace('#', '').trim();
  if (cur !== p) history.pushState(null, '', '#' + p);
  ROUTES[p]();
});

/* اصلاح: هیچ شنونده‌ای برای تغییر آدرس وجود نداشت، بنابراین دکمه‌های
   بازگشت/جلوی مرورگر و تغییر دستی آدرس هیچ اثری نداشتند. */
window.addEventListener('popstate', function() {
  if (!STATE.userId) return;
  routeToHash();
});
window.addEventListener('hashchange', function() {
  if (!STATE.userId) return;
  var h = (location.hash || '').replace('#', '').trim();
  if (h && h !== currentPage) routeToHash();
});
var loginBtn = document.getElementById('loginBtn');
if (loginBtn) loginBtn.addEventListener('click', function() {
  Auth.login();
});
var loginPass = document.getElementById('loginPass');
if (loginPass) loginPass.addEventListener('keydown', function(e) {
  if (e.key === 'Enter') Auth.login();
});
var logoutBtn = document.getElementById('logoutBtn');
if (logoutBtn) logoutBtn.addEventListener('click', function() {
  Auth.logout();
});
var modalCloseBtn = document.getElementById('modalCloseBtn');
if (modalCloseBtn) modalCloseBtn.onclick = function() {
  UI.close();
};
var modalOverlay = document.getElementById('modalOverlay');
if (modalOverlay) modalOverlay.addEventListener('click', function(e) {
  if (e.target === this) UI.close();
});
var darkBtn = document.getElementById('darkBtn');
if (darkBtn) darkBtn.onclick = function() {
  document.body.classList.toggle('dark');
  localStorage.setItem('pb_dark', document.body.classList.contains('dark'));
  this.innerHTML = document.body.classList.contains('dark') ? '<i class="bi bi-sun"></i>' : '<i class="bi bi-moon"></i>';
};
var yearSel = document.getElementById('yearSel');
if (yearSel) yearSel.addEventListener('change', function() {
  switchYear(this.value);
});

/* ══ BOOT ══ */
(async function() {
  /* اصلاح: متغیر ld قبلاً هم در try و هم در catch با var تعریف می‌شد. */
  function hideLoading() {
    var ld = document.getElementById('loadingScreen');
    if (ld) ld.style.display = 'none';
  }
  /* هر مرحله راه‌اندازی نام‌گذاری می‌شود تا اگر جایی گیر کرد، پیام خطا
     بگوید کدام مرحله بود. */
  var step = 'شروع';

  /* هیچ مرحله‌ای اجازه ندارد بی‌نهایت طول بکشد. */
  function withTimeout(p, ms, label) {
    var timer;
    return Promise.race([p, new Promise(function(_, no) {
      timer = setTimeout(function() {
        no(new Error('مرحله «' + label + '» در زمان مقرر تمام نشد'));
      }, ms);
    })]).then(function(v) {
      clearTimeout(timer);
      return v;
    }, function(e) {
      clearTimeout(timer);
      throw e;
    });
  }
  try {
    step = 'بازکردن پایگاه داده';
    await withTimeout(DB.init(), 20000, step);
    if (localStorage.getItem('pb_dark') === 'true') document.body.classList.add('dark');
    step = 'ساخت کاربر پیش‌فرض';
    await withTimeout(Auth.ensureDefaultUser(), 15000, step);
    /* مهاجرت‌های داده — یک بار و فقط یک بار اجرا می‌شوند */
    step = 'مهاجرت داده';
    await withTimeout(Migrate.run(), 60000, step);
    APP_READY = true;
    hideLoading();
    if (Auth.checkSession()) {
      document.getElementById('loginPage').style.display = 'none';
      document.getElementById('appContainer').style.display = '';
      step = 'ورود به برنامه';
      await withTimeout(Auth.onLogin(), 20000, step);
      step = 'بارگذاری صفحه';
      await routeToHash();
    } else {
      document.getElementById('loginPage').style.display = '';
      var _f = el('loginUser');
    if (_f) _f.focus();
    }
  } catch (err) {
    console.error('Boot:', err);
    APP_READY = true;
    hideLoading();
    var lp = document.getElementById('loginPage');
    if (lp) lp.style.display = '';
    var le = document.getElementById('loginErr');
    if (le) {
      le.textContent = 'خطا در راه‌اندازی (مرحله: ' + step + ') — ' +
        (err && err.message ? err.message : 'نامشخص');
      le.style.display = 'block';
    }
  }
})();

/* ثبت Service Worker برای کارکرد کامل بدون اینترنت.
   از پروتکل file:// پشتیبانی نمی‌شود؛ در آن حالت بی‌صدا رد می‌شود. */
if ('serviceWorker' in navigator && location.protocol.indexOf('http') === 0) {
  window.addEventListener('load', function() {
    navigator.serviceWorker.register('sw.js').then(function(reg) {
      console.info('Service Worker فعال شد', reg.scope);
      /* اگر نسخه جدیدی از برنامه آماده شد، به کاربر خبر بده */
      reg.addEventListener('updatefound', function() {
        var sw = reg.installing;
        if (!sw) return;
        sw.addEventListener('statechange', function() {
          if (sw.state === 'installed' && navigator.serviceWorker.controller) {
            if (typeof UI !== 'undefined' && UI.toast) {
              UI.toast('نسخه جدید برنامه آماده است. صفحه را بازخوانی کنید (F5).');
            }
          }
        });
      });
    }).catch(function(e) {
      console.warn('ثبت Service Worker ناموفق بود:', e.message);
    });
  });
}

/* گزارش خطاهای پیش‌بینی‌نشده به کاربر — قبلاً بی‌صدا در کنسول می‌ماندند */
window.addEventListener('unhandledrejection', function(e) {
  console.error('Unhandled rejection:', e.reason);
  if (typeof UI !== 'undefined' && UI.toast) {
    UI.toast('خطای غیرمنتظره: ' + ((e.reason && e.reason.message) || 'نامشخص'), 'e');
  }
});

/* ══ نصب برنامه روی دستگاه (PWA) ══
   برنامه از قبل شرایط نصب را داشت (manifest + Service Worker + آیکون)،
   ولی هیچ دکمه‌ای برای نصب نبود و کاربر باید از منوی مرورگر پیدایش می‌کرد.

   مرورگر وقتی شرایط نصب فراهم باشد رویداد beforeinstallprompt را می‌فرستد.
   آن را نگه می‌داریم و دکمه کنار حالت شب را نشان می‌دهیم. نکته: این رویداد
   فقط روی http**s** یا localhost و فقط وقتی برنامه هنوز نصب نشده می‌آید. */
(function() {
  var deferred = null;
  var btn = function() {
    return document.getElementById('installBtn');
  };

  window.addEventListener('beforeinstallprompt', function(e) {
    e.preventDefault();
    deferred = e;
    var b = btn();
    if (b) b.style.display = '';
  });

  window.addEventListener('appinstalled', function() {
    deferred = null;
    var b = btn();
    if (b) b.style.display = 'none';
    if (typeof UI !== 'undefined' && UI.toast) {
      UI.toast('پارچه‌بان روی دستگاه نصب شد.', 's');
    }
  });

  document.addEventListener('click', function(e) {
    var b = e.target.closest && e.target.closest('#installBtn');
    if (!b) return;
    if (!deferred) {
      if (typeof UI !== 'undefined' && UI.toast) {
        UI.toast('نصب از منوی خود مرورگر انجام می‌شود (در کروم: منوی سه‌نقطه ← Install).', 'e');
      }
      return;
    }
    deferred.prompt();
    deferred.userChoice.then(function() {
      deferred = null;
      var x = btn();
      if (x) x.style.display = 'none';
    });
  });

  /* اگر برنامه همین حالا به‌صورت نصب‌شده باز شده، دکمه لازم نیست */
  window.addEventListener('load', function() {
    var standalone = window.matchMedia('(display-mode: standalone)').matches ||
      window.navigator.standalone === true;
    if (standalone) {
      var b = btn();
      if (b) b.style.display = 'none';
    }
  });
})();
