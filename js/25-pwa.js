/* ══ PWA MANAGEMENT ══ */
var PWA = {
  deferredPrompt: null,

  init: function() {
    var me = this;
    window.addEventListener('beforeinstallprompt', function(e) {
      e.preventDefault();
      me.deferredPrompt = e;
      var b = document.getElementById('installBtn');
      if (b) b.style.display = '';
    });

    window.addEventListener('appinstalled', function() {
      me.deferredPrompt = null;
      var b = document.getElementById('installBtn');
      if (b) b.style.display = 'none';
      if (typeof UI !== 'undefined' && UI.toast) {
        UI.toast('نرم‌افزار پارچه‌بان با موفقیت روی دستگاه شما نصب شد.', 's');
      }
    });

    window.addEventListener('load', function() {
      if (me.isStandalone()) {
        var b = document.getElementById('installBtn');
        if (b) b.style.display = 'none';
      }
    });
  },

  isStandalone: function() {
    return (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches) ||
      window.navigator.standalone === true;
  },

  isIOS: function() {
    var ua = (navigator.userAgent || '').toLowerCase();
    return /iphone|ipad|ipod/.test(ua);
  },

  promptInstall: function() {
    var me = this;
    if (this.isStandalone()) {
      UI.modal('وضعیت نصب اپلیکیشن',
        '<div style="text-align:center;padding:16px">' +
        '<div style="width:56px;height:56px;border-radius:50%;background:var(--okl);color:var(--ok);display:inline-flex;align-items:center;justify-content:center;font-size:1.8rem;margin-bottom:12px"><i class="bi bi-check2-circle"></i></div>' +
        '<h4 style="margin-bottom:6px">اپلیکیشن نصب شده است</h4>' +
        '<p style="font-size:.88rem;color:var(--txs)">پارچه‌بان هم‌اکنون به عنوان اپلیکیشن مستقل روی دستگاه شما در حال اجراست و بدون نوار آدرس مرورگر به تمام قابلیت‌ها و پایگاه داده محلی دسترسی دارید.</p>' +
        '</div>',
        '<button class="btn bp" onclick="UI.close()">بستن</button>'
      );
      return;
    }

    if (this.deferredPrompt) {
      this.deferredPrompt.prompt();
      this.deferredPrompt.userChoice.then(function(choice) {
        if (choice.outcome === 'accepted') {
          if (typeof UI !== 'undefined' && UI.toast) {
            UI.toast('در حال نصب برنامه روی گوشی...', 's');
          }
        }
        me.deferredPrompt = null;
      });
      return;
    }

    /* راهنمای مرحله‌به‌مرحله متناسب با سیستم عامل */
    if (this.isIOS()) {
      UI.modal('نصب پارچه‌بان روی آیفون و آیپد (iOS)',
        '<div style="padding:10px 4px">' +
        '<div style="display:flex;align-items:center;gap:12px;margin-bottom:14px">' +
        '<img src="icons/icon-192.png" style="width:48px;height:48px;border-radius:10px">' +
        '<div><strong>نرم‌افزار مدیریت پارچه‌بان</strong><div style="font-size:.8rem;color:var(--txs)">قابل نصب سریع از مرورگر Safari</div></div>' +
        '</div>' +
        '<ol style="padding-inline-start:20px;font-size:.88rem;line-height:1.9;color:var(--tx)">' +
        '<li>در نوار پایینی مرورگر سافاری، دکمه <strong>اشتراک‌گذاری (Share <i class="bi bi-box-arrow-up" style="color:var(--p)"></i>)</strong> را لمس کنید.</li>' +
        '<li>در منوی بازشده به پایین اسکرول کرده و گزینه <strong>«Add to Home Screen» (افزودن به صفحه اصلی <i class="bi bi-plus-square"></i>)</strong> را انتخاب کنید.</li>' +
        '<li>در گوشه بالای سمت راست، گزینه <strong>«Add»</strong> را لمس کنید تا آیکون پارچه‌بان مانند یک اپلیکیشن بومی به صفحه گوشی اضافه شود.</li>' +
        '</ol>' +
        '<div class="hint-box" style="margin-top:12px;font-size:.82rem"><i class="bi bi-info-circle"></i> پس از نصب، برنامه بدون نیاز به اینترنت و بدون تاخیر اجرا خواهد شد.</div>' +
        '</div>',
        '<button class="btn bp" onclick="UI.close()">متوجه شدم</button>'
      );
      return;
    }

    /* اندروید یا کروم دسکتاپ */
    UI.modal('نصب نرم‌افزار روی گوشی و تبلت (Android/Chrome)',
      '<div style="padding:10px 4px">' +
      '<div style="display:flex;align-items:center;gap:12px;margin-bottom:14px">' +
      '<img src="icons/icon-192.png" style="width:48px;height:48px;border-radius:10px">' +
      '<div><strong>نرم‌افزار مدیریت پارچه‌بان</strong><div style="font-size:.8rem;color:var(--txs)">اپلیکیشن پیشرو تحت وب (PWA)</div></div>' +
      '</div>' +
      '<ol style="padding-inline-start:20px;font-size:.88rem;line-height:1.9;color:var(--tx)">' +
      '<li>در گوشه بالا یا پایین مرورگر کروم، دکمه <strong>منوی سه‌نقطه (<i class="bi bi-three-dots-vertical"></i>)</strong> را لمس کنید.</li>' +
      '<li>گزینه <strong>«نصب برنامه» (Install app)</strong> یا <strong>«افزودن به صفحه اصلی» (Add to Home screen)</strong> را انتخاب کنید.</li>' +
      '<li>روی دکمه تأیید یا «نصب» بزنید تا پارچه‌بان مانند یک اپلیکیشن اختصاصی با سرعت بالا روی گوشی شما قرار گیرد.</li>' +
      '</ol>' +
      '<div class="hint-box" style="margin-top:12px;font-size:.82rem"><i class="bi bi-check-circle"></i> با نصب برنامه، فاکتورها و چک‌ها حتی در زمان قطعی کامل اینترنت باز و ثبت می‌شوند.</div>' +
      '</div>',
      '<button class="btn bp" onclick="UI.close()">متوجه شدم</button>'
    );
  }
};

PWA.init();
