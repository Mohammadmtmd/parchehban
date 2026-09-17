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
  },

  /* بررسی جامع سلامت دیتابیس IndexedDB و LocalStorage */
  testDatabaseHealth: async function() {
    var t0 = performance.now();
    var res = {
      indexedDbSupported: typeof indexedDB !== 'undefined',
      localStorageSupported: typeof localStorage !== 'undefined',
      dbConnected: false,
      latencyMs: 0,
      counts: { products: 0, invoices: 0, contacts: 0, users: 0, checks: 0, fiscalYears: 0 },
      isPersisted: false,
      totalRecords: 0,
      error: null
    };

    try {
      if (typeof navigator !== 'undefined' && navigator.storage && navigator.storage.persisted) {
        res.isPersisted = await navigator.storage.persisted();
      }
    } catch (e) {}

    try {
      if (typeof DB !== 'undefined' && DB.all) {
        var p = await DB.all('products');
        var inv = await DB.all('invoices');
        var c = await DB.all('contacts');
        var u = await DB.all('users');
        var chk = await DB.all('checks');
        var fy = await DB.all('fiscalYears');
        res.dbConnected = true;
        res.latencyMs = Math.round(performance.now() - t0);
        res.counts.products = p.length;
        res.counts.invoices = inv.length;
        res.counts.contacts = c.length;
        res.counts.users = u.length;
        res.counts.checks = chk.length;
        res.counts.fiscalYears = fy.length;
        res.totalRecords = p.length + inv.length + c.length + chk.length;
      }
    } catch (err) {
      res.error = err && err.message ? err.message : String(err);
    }
    return res;
  },

  /* بررسی وضعیت داده‌ها در هنگام راه‌اندازی و جلوگیری از صفحه سفید/خالی در PWA */
  checkEmptyStateOnBoot: async function() {
    try {
      var isPwa = this.isStandalone();
      var isIos = this.isIOS();
      var health = await this.testDatabaseHealth();

      /* اگر پایگاه داده خام است (بدون کالا، شخص، فاکتور و چک) */
      var isEmpty = (health.totalRecords === 0);

      /* در هر دو حالت (صفحه لاگین یا داشبورد)، ویجت هوشمند را آماده می‌کنیم */
      if (isEmpty) {
        this.renderEmptyStateBanner(isPwa, isIos, health);

        /* در صورتی که کاربر به عنوان اپلیکیشن مستقل PWA در حال اجرا باشد و هیچ داده‌ای نباشد */
        if (isPwa) {
          console.info('PWA Standalone detected with empty local database.');
        }
      }
    } catch (e) {
      console.warn('PWA checkEmptyStateOnBoot:', e);
    }
  },

  /* نمایش مدال تست سلامت و اتصال دیتابیس */
  showHealthModal: async function() {
    UI.modal('تست و بررسی اتصال پایگاه داده (IndexedDB)', '<div class="ld"><div class="spn"></div><p style="margin-top:10px;font-size:.85rem;color:var(--txs)">در حال آزمودن پایگاه داده محلی...</p></div>', '');

    var health = await this.testDatabaseHealth();
    var supaCfg = typeof Sync !== 'undefined' ? Sync.getConfig() : { configured: false };
    var supaStatus = 'تنظیم نشده';
    var supaOk = false;
    if (supaCfg.configured) {
      try {
        var sCheck = await Sync.checkRemoteCounts();
        if (sCheck && sCheck.ok) {
          supaOk = true;
          supaStatus = 'متصل و آنلاین (' + sCheck.total + ' رکورد روی سرور ابری)';
        } else {
          supaStatus = 'عدم دسترسی به سرور: ' + ((sCheck && sCheck.error) || 'نامشخص');
        }
      } catch (e) {
        supaStatus = 'خطا در شبکه اینترنت';
      }
    }

    var isPwa = this.isStandalone();
    var isIos = this.isIOS();

    var html = '<div style="font-size:.85rem;line-height:1.7">' +
      '<div style="background:var(--bg);border:1.5px solid ' + (health.dbConnected ? 'var(--ok)' : 'var(--d)') + ';border-radius:12px;padding:14px;margin-bottom:12px">' +
      '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px">' +
      '<strong style="color:var(--tx);font-size:.9rem"><i class="bi bi-database-check" style="color:' + (health.dbConnected ? 'var(--ok)' : 'var(--d)') + '"></i> وضعیت موتور پایگاه داده (IndexedDB)</strong>' +
      '<span class="tg ' + (health.dbConnected ? 'ts' : 'td') + '">' + (health.dbConnected ? 'فعال و متصل' : 'قطع / خطا') + '</span>' +
      '</div>' +
      '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(130px,1fr));gap:8px;font-size:.78rem;color:var(--txs)">' +
      '<div>نام دیتابیس: <strong>parchehban_v8</strong></div>' +
      '<div>پاسخ‌دهی: <strong>' + health.latencyMs + ' میلی‌ثانیه</strong></div>' +
      '<div>نوع اجرا: <strong>' + (isPwa ? 'اپلیکیشن مستقل (PWA)' : 'مرورگر وب') + '</strong></div>' +
      '<div>سیستم‌عامل: <strong>' + (isIos ? 'Apple iOS (سافاری)' : 'سایر پلتفرم‌ها') + '</strong></div>' +
      '<div>ماندگاری اطلاعات: <strong style="color:' + (health.isPersisted ? 'var(--ok)' : 'var(--p)') + '">' + (health.isPersisted ? 'ایمن و دائمی' : 'استاندارد مرورگر') + '</strong></div>' +
      '<div>مجموع رکوردهای کاری: <strong>' + UI.fn(health.totalRecords) + '</strong></div>' +
      '</div>' +
      '</div>' +

      '<div style="background:var(--sf);border:1px solid var(--bd);border-radius:12px;padding:12px 14px;margin-bottom:14px">' +
      '<strong style="font-size:.82rem;color:var(--tx);display:block;margin-bottom:8px">شمارش تفکیکی اطلاعات ذخیره‌شده در این فضا:</strong>' +
      '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(95px,1fr));gap:8px;font-size:.8rem;text-align:center">' +
      '<div style="background:var(--bg);padding:8px 6px;border-radius:8px">فاکتورها<div style="font-size:1.1rem;font-weight:700;color:var(--p);margin-top:2px">' + UI.fn(health.counts.invoices) + '</div></div>' +
      '<div style="background:var(--bg);padding:8px 6px;border-radius:8px">کالاها<div style="font-size:1.1rem;font-weight:700;color:var(--ok);margin-top:2px">' + UI.fn(health.counts.products) + '</div></div>' +
      '<div style="background:var(--bg);padding:8px 6px;border-radius:8px">اشخاص<div style="font-size:1.1rem;font-weight:700;color:var(--tx);margin-top:2px">' + UI.fn(health.counts.contacts) + '</div></div>' +
      '<div style="background:var(--bg);padding:8px 6px;border-radius:8px">چک‌ها<div style="font-size:1.1rem;font-weight:700;color:var(--w);margin-top:2px">' + UI.fn(health.counts.checks) + '</div></div>' +
      '</div>' +
      '</div>' +

      /* وضعیت سرور ابری */
      '<div style="background:var(--bg);border:1px solid var(--bd);border-radius:12px;padding:12px 14px;margin-bottom:14px">' +
      '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px">' +
      '<strong style="font-size:.84rem;color:var(--tx)"><i class="bi bi-clouds"></i> وضعیت سرور ابری (Supabase)</strong>' +
      '<span class="tg ' + (supaOk ? 'ts' : 'td') + '">' + (supaOk ? 'متصل' : 'غیرفعال') + '</span>' +
      '</div>' +
      '<div style="font-size:.78rem;color:var(--txs)">' + supaStatus + '</div>' +
      (supaOk ? '<div style="margin-top:8px"><button class="btn bp bs" onclick="Auth.quickCloudRestore()"><i class="bi bi-cloud-arrow-down-fill"></i> بازیابی فوری تمام اطلاعات از سرور ابری</button></div>' : '') +
      '</div>' +

      /* اگر خالی است، راهنمای بازیابی سریع */
      (health.totalRecords === 0 ?
        '<div style="background:rgba(239,68,68,.06);border:1.5px dashed var(--d);border-radius:12px;padding:12px 14px;margin-bottom:12px">' +
        '<div style="font-weight:700;color:var(--d);font-size:.85rem;margin-bottom:4px"><i class="bi bi-exclamation-triangle-fill"></i> این محیط در حال حاضر کاملاً خام است</div>' +
        '<p style="font-size:.78rem;color:var(--txs);line-height:1.8;margin:0 0 8px 0">' +
        'اگر قبلاً در مرورگر سافاری، کامپیوتر یا دستگاه دیگر اطلاعات داشته‌اید، از گزینه‌های زیر برای انتقال فوری استفاده نمایید:' +
        '</p>' +
        '<div style="display:flex;gap:8px;flex-wrap:wrap">' +
        '<label class="btn bp bs" style="cursor:pointer;margin:0;display:inline-flex;align-items:center;gap:6px">' +
        '<i class="bi bi-upload"></i> انتخاب فایل بکاپ (.json)' +
        '<input type="file" accept=".json" style="display:none" onchange="Auth.restoreBackupDirectly(this.files[0])">' +
        '</label>' +
        '<button class="btn bo bs" onclick="PWA.openSafariExportGuide()"><i class="bi bi-compass"></i> راهنمای دریافت بکاپ از سافاری</button>' +
        '</div>' +
        '</div>' : '') +

      '</div>';

    UI.modal('تست و بررسی اتصال پایگاه داده (IndexedDB)', html,
      '<button class="btn bo" onclick="PWA.showHealthModal()"><i class="bi bi-arrow-clockwise"></i> تست مجدد</button>' +
      '<button class="btn bp" onclick="UI.close()">بستن</button>'
    );
  },

  /* باز کردن راهنمای گام‌به‌گام برای کاربران آیفون */
  openSafariExportGuide: function() {
    UI.modal('راهنمای انتقال آسان داده‌ها از سافاری به PWA آیفون',
      '<div style="padding:8px 2px;font-size:.86rem;line-height:1.9">' +
      '<div style="display:flex;align-items:center;gap:10px;margin-bottom:14px;background:rgba(37,99,235,.07);padding:10px 12px;border-radius:10px">' +
      '<i class="bi bi-info-circle-fill" style="color:var(--p);font-size:1.3rem"></i>' +
      '<div style="font-size:.8rem;color:var(--tx)">چرا این اتفاق می‌افتد؟ شرکت اپل در سیستم‌عامل iOS، حافظه آیکون صفحه اصلی را به دلایل امنیتی از مرورگر سافاری جدا نگه می‌دارد.</div>' +
      '</div>' +
      '<ol style="padding-inline-start:20px;color:var(--tx);margin:0 0 14px 0">' +
      '<li>همین آدرس برنامه را داخل <strong>مرورگر سافاری (Safari)</strong> باز کنید (جایی که قبلاً فاکتورها و کالاها ثبت شده بودند).</li>' +
      '<li>وارد برنامه شوید، منوی کناری را باز کرده و گزینه <strong>پشتیبان‌گیری (دانلود فایل .json)</strong> را لمس کنید تا فایل در پوشه دانلودهای آیفون ذخیره شود.</li>' +
      '<li>مجدداً به همین آیکون در صفحه اصلی (PWA) بازگردید و روی دکمه <strong>«انتخاب فایل بکاپ (.json)»</strong> بزنید.</li>' +
      '</ol>' +
      '<div style="text-align:center">' +
      '<label class="btn bp" style="cursor:pointer;padding:8px 18px;display:inline-flex;align-items:center;gap:6px">' +
      '<i class="bi bi-upload"></i> بارگذاری فایل پشتیبان در همین لحظه' +
      '<input type="file" accept=".json" style="display:none" onchange="Auth.restoreBackupDirectly(this.files[0])">' +
      '</label>' +
      '</div>' +
      '</div>',
      '<button class="btn bo" onclick="UI.close()">متوجه شدم</button>'
    );
  },

  /* رندر کردن بنر هوشمند وضعیت خالی */
  renderEmptyStateBanner: function(isPwa, isIos, health) {
    var pwaHint = document.getElementById('pwaIosHint');
    if (pwaHint) {
      pwaHint.style.display = 'block';
    }
  }
};

PWA.init();

