/* ══════════════════════════════════════════════════════════════
   BACKUP — پشتیبان‌گیری و بازیابی
   اصلاحات:
   • همه جدول‌ها (شامل banks، bankTransfers، users) پشتیبان گرفته می‌شوند.
   • در بازیابی، شناسه‌های اصلی (id) حفظ می‌شوند تا ارتباط بین
     فاکتور↔شخص↔کالا↔بانک از بین نرود. نسخه قبلی id را حذف می‌کرد
     و شناسه‌های جدید می‌گرفت که همه ارتباط‌ها را خراب می‌کرد.
   • نوشتن دسته‌ای در یک تراکنش (سرعت بیشتر و اتمی‌تر).
   ══════════════════════════════════════════════════════════════ */
var Backup = {
  /* فهرست جدول‌ها از یک منبع واحد خوانده می‌شود (DB.DATA_STORES) تا
     اگر در آینده جدولی اضافه شد، دیگر از پشتیبان جا نیفتد. */
  get STORES() {
    return DB.DATA_STORES;
  },

  exportAll: async function() {
    if (!Perm.require('backup', 'تهیه پشتیبان')) return;
    try {
      var data = {
        app: 'parchehban',
        version: '9.0',
        date: new Date().toISOString(),
        jalaliDate: Jalali.today()
      };
      for (var i = 0; i < Backup.STORES.length; i++) {
        data[Backup.STORES[i]] = await DB.all(Backup.STORES[i]);
      }
      var b = new Blob([JSON.stringify(data, null, 2)], {
        type: 'application/json;charset=utf-8;'
      });
      var a = document.createElement('a');
      a.href = URL.createObjectURL(b);
      a.download = 'parchehban-backup-' + Jalali.today().replace(/\//g, '-') + '.json';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(function() {
        URL.revokeObjectURL(a.href);
      }, 1000);
      Backup.markDone();
      UI.toast('بکاپ ذخیره شد');
    } catch (e) {
      console.error(e);
      UI.toast('خطا در تهیه بکاپ: ' + (e.message || ''), 'e');
    }
  },

  /* ══ یادآور پشتیبان‌گیری ══
     همه داده‌ها فقط در IndexedDB همین مرورگر است. پاک کردن داده‌های
     مرورگر، عوض کردن دستگاه یا خرابی پروفایل یعنی از دست رفتن کل
     دفاتر. این بخش بعد از ورود بررسی می‌کند که آخرین پشتیبان چه زمانی
     گرفته شده و چند سند از آن موقع ثبت شده. */

  KEY: 'pb_last_backup',
  DAYS: 7,          /* فاصله یادآوری */
  DOCS: 20,         /* یا این تعداد سند تازه، هرکدام زودتر رسید */

  markDone: function() {
    try {
      localStorage.setItem(Backup.KEY, JSON.stringify({
        at: Date.now(),
        jalali: Jalali.today(),
        docs: Backup._docCount
      }));
    } catch (e) { /* حالت ناشناس مرورگر — بی‌خطر رد می‌شویم */ }
  },

  _docCount: 0,

  info: function() {
    try {
      var raw = localStorage.getItem(Backup.KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (e) { return null; }
  },

  /* شمردن اسنادی که ارزش از دست رفتن دارند */
  countDocs: async function() {
    var n = 0;
    var stores = ['invoices', 'payments', 'checks'];
    for (var i = 0; i < stores.length; i++) {
      try { n += (await DB.all(stores[i])).length; } catch (e) { /* جدول نبود */ }
    }
    return n;
  },

  /* بعد از ورود صدا زده می‌شود */
  check: async function() {
    try {
      var docs = await Backup.countDocs();
      Backup._docCount = docs;
      if (!docs) return;                    /* برنامه خالی است */

      var last = Backup.info();
      var days = last ? Math.floor((Date.now() - last.at) / 86400000) : null;
      var since = last ? docs - (last.docs || 0) : docs;

      var why = null;
      if (!last) {
        why = 'تا حالا هیچ پشتیبانی نگرفته‌اید و ' + UI.fn(docs) + ' سند ثبت شده.';
      } else if (days >= Backup.DAYS && since !== 0) {
        /* شرط «سند تازه» باید هر نوع تغییری را بگیرد، نه فقط افزایش.
           اگر only since>0 می‌گذاشتیم، وقتی کاربر سندی را حذف کرده بود
           تعداد کم می‌شد، since منفی می‌ماند و با اینکه دفاتر عوض شده
           بود هیچ یادآوری نمی‌آمد. */
        why = UI.fn(days) + ' روز از آخرین پشتیبان گذشته و دفاتر تغییر کرده' +
          (since > 0 ? ' (' + UI.fn(since) + ' سند تازه)' : '') + '.';
      } else if (since >= Backup.DOCS) {
        why = 'از آخرین پشتیبان ' + UI.fn(since) + ' سند تازه ثبت شده.';
      }
      if (!why) return;

      Backup.banner(why, last);
    } catch (e) {
      console.warn('بررسی یادآور پشتیبان ناموفق بود', e);
    }
  },

  /* نوار هشدار بالای صفحه */
  banner: function(why, last) {
    var old = document.getElementById('bkBanner');
    if (old) old.remove();
    var d = document.createElement('div');
    d.id = 'bkBanner';
    d.className = 'bk-ban';
    d.innerHTML =
      '<i class="bi bi-shield-exclamation"></i>' +
      '<div class="bk-tx"><b>پشتیبان بگیرید</b>' +
      '<span>' + esc(why) + ' همه اطلاعات فقط در همین مرورگر ذخیره می‌شود؛ ' +
      'اگر داده‌های مرورگر پاک شود قابل بازیابی نیست.' +
      (last ? ' آخرین پشتیبان: ' + esc(last.jalali || '—') + '.' : '') +
      '</span></div>' +
      '<button class="btn bp bk-go"><i class="bi bi-download"></i> پشتیبان بگیر</button>' +
      '<button class="btn bo bk-x">بعداً</button>';
    document.body.appendChild(d);
    d.querySelector('.bk-go').onclick = async function() {
      await Backup.exportAll();
      var b = document.getElementById('bkBanner');
      if (b) b.remove();
    };
    d.querySelector('.bk-x').onclick = function() {
      /* «بعداً» فقط تا پایان همین نشست ساکت می‌کند — نه برای همیشه */
      try { sessionStorage.setItem('pb_bk_snooze', '1'); } catch (e) {}
      d.remove();
    };
  },

  importAll: function() {
    if (!Perm.can('*')) {
      UI.toast('بازیابی پشتیبان فقط با نقش «مدیر» امکان‌پذیر است، چون همه اطلاعات فعلی را جایگزین می‌کند.', 'e');
      return;
    }
    UI.open('بازیابی بکاپ',
      '<div style="text-align:center;padding:20px">' +
      '<i class="bi bi-cloud-upload" style="font-size:2.5rem;color:var(--p);display:block;margin-bottom:14px"></i>' +
      '<p style="margin-bottom:14px;color:var(--txs)">فایل بکاپ JSON را انتخاب کنید</p>' +
      '<input type="file" id="bkFile" accept=".json" style="display:block;margin:0 auto">' +
      '<p style="margin-top:14px;font-size:.78rem;color:var(--d);font-weight:600">' +
      'هشدار: تمام اطلاعات فعلی حذف و با محتوای این فایل جایگزین می‌شود.</p></div>',
      '<button class="btn bdn" onclick="Backup.doImport()">بازیابی</button>' +
      '<button class="btn bo" onclick="UI.close()">انصراف</button>');
  },

  doImport: async function() {
    var fi = document.getElementById('bkFile');
    if (!fi || !fi.files.length) {
      UI.toast('فایلی انتخاب نشده', 'e');
      return;
    }
    var raw;
    try {
      raw = JSON.parse(await fi.files[0].text());
    } catch (e) {
      UI.toast('فایل JSON معتبر نیست', 'e');
      return;
    }
    var src = raw.data || raw;
    if (!src || typeof src !== 'object' || !Array.isArray(src.contacts)) {
      UI.toast('ساختار فایل بکاپ نامعتبر است', 'e');
      return;
    }
    if (!await UI.confirm('تمام اطلاعات فعلی حذف و جایگزین شود؟ این عمل بازگشت‌پذیر نیست.')) return;

    try {
      /* ۱) پاک کردن همه جدول‌ها */
      for (var s = 0; s < Backup.STORES.length; s++) {
        await DB.clear(Backup.STORES[s]);
      }

      /* ۲) نوشتن مجدد با حفظ شناسه اصلی — هیچ نگاشت مجددی لازم نیست */
      var counts = {};
      for (var t = 0; t < Backup.STORES.length; t++) {
        var store = Backup.STORES[t];
        var arr = Array.isArray(src[store]) ? src[store] : [];
        var rows = arr.filter(function(row) {
          return row && typeof row === 'object' && row.id !== undefined && row.id !== null;
        });
        if (rows.length !== arr.length) {
          console.warn('برخی رکوردهای ' + store + ' بدون شناسه بودند و رد شدند.');
        }
        await DB.bulkPut(store, rows);
        counts[store] = rows.length;
      }

      /* ۳) اطمینان از وجود سال مالی جاری */
      var fy = await DB.all('fiscalYears');
      var cur = fy.find(function(y) {
        return y.isCurrent;
      }) || fy[0];
      if (!cur) {
        var py = parseInt(Jalali.today().split('/')[0], 10);
        var nid = await DB.add('fiscalYears', {
          name: String(py),
          startDate: py + '/01/01',
          endDate: py + '/12/' + Jalali.monthDays(py, 12),
          isCurrent: true,
          isClosed: false
        });
        STATE.yearId = nid;
      } else {
        STATE.yearId = cur.id;
      }
      localStorage.setItem('pb_year', STATE.yearId);
      await FY.ensureDefault();
      await FY.migrate();

      /* ۴) اطمینان از وجود کاربر */
      await Auth.ensureDefaultUser();

      UI.close();
      UI.toast('بازیابی انجام شد (' + UI.fn(counts.invoices || 0) + ' فاکتور، ' +
        UI.fn(counts.contacts || 0) + ' شخص)');
      if (STATE.userId) await Dash.render();
    } catch (e) {
      console.error(e);
      UI.toast('خطا در بازیابی: ' + (e.message || ''), 'e');
    }
  }
};
