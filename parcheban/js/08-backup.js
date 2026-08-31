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
  /* تمام جدول‌های برنامه */
  STORES: ['categories', 'products', 'contacts', 'invoices', 'payments',
    'checks', 'fiscalYears', 'yearOpenings', 'banks', 'bankTransfers', 'users'
  ],

  exportAll: async function() {
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
      UI.toast('بکاپ ذخیره شد');
    } catch (e) {
      console.error(e);
      UI.toast('خطا در تهیه بکاپ: ' + (e.message || ''), 'e');
    }
  },

  importAll: function() {
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
