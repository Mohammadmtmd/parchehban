/* ══ SERVICE WORKER — پارچه‌بان ══
   هدف: برنامه بدون اینترنت کامل کار کند.

   راهبرد:
     • فایل‌های خود برنامه (HTML/CSS/JS) → Stale-While-Revalidate
       یعنی فوراً از حافظه نهان سرو می‌شوند (سرعت + کارکرد آفلاین) و
       در پس‌زمینه نسخه تازه گرفته می‌شود.
     • فونت و آیکون و Chart.js داخل پوشه vendor/ هستند (نه CDN) تا
       برنامه بدون اینترنت هم بالا بیاید؛ آن‌ها با Cache-First نگه
       داشته می‌شوند چون تغییر نمی‌کنند و حجم دارند.
     • هر درخواست غیر GET یا غیر http(s) دست‌نخورده رد می‌شود.

   توجه: داده‌های حسابداری در IndexedDB است و ربطی به این حافظه نهان
   ندارد؛ پاک شدن cache هیچ سندی را از بین نمی‌برد. */

var VERSION = 'pb-v9.4';
var SHELL_CACHE = VERSION + '-shell';
var CDN_CACHE = VERSION + '-cdn';

/* فایل‌های ضروری برنامه. اگر ماژول جدیدی اضافه شد، اینجا هم اضافه شود. */
var SHELL = [
  './',
  './index.html',
  './manifest.json',
  './css/app.css',
  './vendor/vazirmatn.css',
  './vendor/bootstrap-icons.css',
  './vendor/chart.umd.min.js',
  './vendor/fonts/bootstrap-icons.woff2',
  './vendor/fonts/vazirmatn-Dxxo8j6PP2D_kU2muijlE8WWMmk.woff2',
  './vendor/fonts/vazirmatn-Dxxo8j6PP2D_kU2muijlGMWWMmk.woff2',
  './vendor/fonts/vazirmatn-Dxxo8j6PP2D_kU2muijlHcWW.woff2',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './js/00-core.js',
  './js/01-state.js',
  './js/02-utils.js',
  './js/03-db.js',
  './js/03b-migrations.js',
  './js/03c-sync.js',
  './js/04-auth.js',
  './js/04b-permissions.js',
  './js/05-ui.js',
  './js/05b-form.js',
  './js/06-export.js',
  './js/07-fiscal-year.js',
  './js/08-backup.js',
  './js/09-categories.js',
  './js/10-products.js',
  './js/11-contacts.js',
  './js/12-invoices.js',
  './js/12b-prodpick.js',
  './js/13-payments.js',
  './js/14-checks.js',
  './js/15-ledger.js',
  './js/16-warehouse.js',
  './js/17-product-ledger.js',
  './js/18-reports.js',
  './js/19-settings.js',
  './js/20-dashboard.js',
  './js/21-pagination.js',
  './js/22-banks.js',
  './js/22b-search.js',
  './js/23-routes.js',
  './js/24-boot.js'
];

self.addEventListener('install', function(e) {
  e.waitUntil(
    caches.open(SHELL_CACHE).then(function(c) {
      /* addAll اگر یک فایل ۴۰۴ بدهد کل نصب را می‌شکند، پس تک‌تک
         اضافه می‌شوند تا یک فایل جامانده کل آفلاین را از کار نیندازد. */
      return Promise.all(SHELL.map(function(u) {
        return c.add(new Request(u, {
          cache: 'reload'
        })).catch(function(err) {
          console.warn('[SW] کش نشد: ' + u, err && err.message);
        });
      }));
    }).then(function() {
      return self.skipWaiting();
    })
  );
});

self.addEventListener('activate', function(e) {
  e.waitUntil(
    caches.keys().then(function(keys) {
      /* پاک کردن حافظه نهان نسخه‌های قبلی */
      return Promise.all(keys.filter(function(k) {
        return k.indexOf(VERSION) !== 0;
      }).map(function(k) {
        return caches.delete(k);
      }));
    }).then(function() {
      return self.clients.claim();
    })
  );
});

self.addEventListener('fetch', function(e) {
  var req = e.request;
  if (req.method !== 'GET') return;
  var url;
  try {
    url = new URL(req.url);
  } catch (err) {
    return;
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return;

  var sameOrigin = url.origin === self.location.origin;

  /* ── منابع بیرونی (فونت، آیکون، Chart.js): اول حافظه نهان ── */
  if (!sameOrigin) {
    e.respondWith(
      caches.match(req).then(function(hit) {
        if (hit) return hit;
        return fetch(req).then(function(res) {
          if (res && (res.ok || res.type === 'opaque')) {
            var copy = res.clone();
            caches.open(CDN_CACHE).then(function(c) {
              c.put(req, copy);
            });
          }
          return res;
        }).catch(function() {
          return new Response('', {
            status: 504,
            statusText: 'offline'
          });
        });
      })
    );
    return;
  }

  /* ── فایل‌های خود برنامه: نمایش فوری از حافظه نهان + تازه‌سازی ── */
  e.respondWith(
    caches.match(req).then(function(hit) {
      var fresh = fetch(req).then(function(res) {
        if (res && res.ok) {
          var copy = res.clone();
          caches.open(SHELL_CACHE).then(function(c) {
            c.put(req, copy);
          });
        }
        return res;
      }).catch(function() {
        return null;
      });

      if (hit) return hit;
      return fresh.then(function(res) {
        if (res) return res;
        /* آفلاین و بدون نسخه ذخیره‌شده: برای درخواست‌های ناوبری،
           صفحه اصلی برنامه را برگردان (مسیریابی با هَش انجام می‌شود). */
        if (req.mode === 'navigate') return caches.match('./index.html');
        return new Response('', {
          status: 504,
          statusText: 'offline'
        });
      });
    })
  );
});

/* پیام از برنامه: اعمال فوری نسخه جدید */
self.addEventListener('message', function(e) {
  if (e.data === 'skipWaiting') self.skipWaiting();
});
