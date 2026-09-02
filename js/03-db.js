/* ══ DB ══ */
var DB = {
  db: null,

  /* فهرست واحد جدول‌ها — پشتیبان‌گیری و مهاجرت هم از همین می‌خوانند
     تا دیگر هیچ جدولی از پشتیبان جا نیفتد. */
  STORES: ['categories', 'products', 'contacts', 'invoices', 'payments',
    'checks', 'fiscalYears', 'yearOpenings', 'users', 'banks',
    'bankTransfers', 'settings', 'syncQueue'
  ],

  /* جدول‌هایی که داده کاری کاربر در آن‌هاست (برای پشتیبان و همگام‌سازی).
     syncQueue محلی است و پشتیبان‌گیری نمی‌شود. */
  DATA_STORES: ['categories', 'products', 'contacts', 'invoices', 'payments',
    'checks', 'fiscalYears', 'yearOpenings', 'users', 'banks',
    'bankTransfers', 'settings'
  ],
  init: function() {
    return new Promise(function(ok, no) {
      /* نسخه ۴: جدول‌های settings (نگه‌داشتن شماره نسخه اسکیما و
         تنظیمات برنامه) و syncQueue (آماده‌سازی برای همگام‌سازی آینده
         با Supabase) اضافه شد. */
      var settled = false;

      function done(fn, arg) {
        if (settled) return;
        settled = true;
        fn(arg);
      }
      /* اصلاح: اگر پایگاه داده به هر دلیلی جواب ندهد، قبلاً این Promise
         هیچ‌وقت تمام نمی‌شد و برنامه بی‌صدا روی صفحه لودینگ می‌ماند.
         حالا بعد از ۱۵ ثانیه با پیام روشن رد می‌شود. */
      var timer = setTimeout(function() {
        done(no, new Error('پایگاه داده پاسخ نداد. اگر برنامه در تب دیگری باز است آن را ببندید و صفحه را بازخوانی کنید.'));
      }, 15000);

      var r;
      try {
        r = indexedDB.open('parchehban_v8', 4);
      } catch (e) {
        clearTimeout(timer);
        done(no, e);
        return;
      }
      r.onupgradeneeded = function(e) {
        var d = e.target.result;
        DB.STORES.forEach(function(n) {
          if (!d.objectStoreNames.contains(n)) d.createObjectStore(n, {
            keyPath: 'id',
            autoIncrement: true
          });
        });
      };
      /* onblocked قبلاً تعریف نشده بود: اگر همین برنامه در تب دیگری باز
         باشد، ارتقای نسخه پایگاه داده بلاک می‌شود و راه‌اندازی برای همیشه
         معطل می‌ماند — بدون هیچ خطایی. */
      r.onblocked = function() {
        clearTimeout(timer);
        done(no, new Error('برنامه در یک تب دیگر باز است و اجازه ارتقای پایگاه داده را نمی‌دهد. آن تب را ببندید و دوباره تلاش کنید.'));
      };
      r.onsuccess = function(e) {
        clearTimeout(timer);
        DB.db = e.target.result;
        /* اگر تب دیگری بخواهد نسخه را ارتقا دهد، این اتصال را ببند تا
           آن تب بلاک نشود. */
        DB.db.onversionchange = function() {
          DB.db.close();
          DB.db = null;
        };
        done(ok);
      };
      r.onerror = function(e) {
        clearTimeout(timer);
        done(no, (e.target && e.target.error) || new Error('خطای بازکردن پایگاه داده'));
      };
    });
  },
  gs: function(n, m) {
    return this.db.transaction(n, m || 'readonly').objectStore(n);
  },
  /* پوشش مشترک: هر درخواست IndexedDB حالا در صورت خطا reject می‌شود.
     قبلاً onerror تعریف نشده بود و خطاها بی‌صدا گم می‌شدند. */
  _req: function(reqFactory, label) {
    return new Promise(function(ok, no) {
      var r;
      try {
        r = reqFactory();
      } catch (e) {
        no(e);
        return;
      }
      r.onsuccess = function() {
        ok(r.result);
      };
      r.onerror = function() {
        var err = r.error || new Error('خطای پایگاه داده');
        console.error('DB ' + label + ' failed:', err);
        no(err);
      };
      if (r.transaction) r.transaction.onabort = function() {
        no(r.transaction.error || new Error('تراکنش پایگاه داده لغو شد'));
      };
    });
  },
  all: function(n) {
    return DB._req(function() {
      return DB.gs(n).getAll();
    }, 'all(' + n + ')');
  },
  get: function(n, id) {
    /* اگر شناسه خالی/نامعتبر باشد به‌جای پرتاب DataError مقدار null
       برگردان — مثلاً وقتی نشست خراب است و STATE.userId تعریف نشده،
       صفحه تنظیمات قبلاً کامل از کار می‌افتاد. */
    if (id === null || id === undefined || id === '') return Promise.resolve(null);
    var key = typeof id === 'number' ? id : intOf(id);
    if (!isFinite(key) || key === 0) return Promise.resolve(null);
    return DB._req(function() {
      return DB.gs(n).get(key);
    }, 'get(' + n + ')');
  },
  /* هنگام نوشتن در جدول syncQueue نباید دوباره صف‌گذاری انجام شود،
     وگرنه بازگشت بی‌پایان می‌شود. */
  _queue: function(store, op, row, id) {
    if (store === 'syncQueue' || store === 'settings') return;
    if (typeof Sync === 'undefined' || !Sync.enqueue) return;
    try {
      Sync.enqueue(store, op, row, id);
    } catch (e) {
      console.warn('صف همگام‌سازی', e);
    }
  },

  add: function(n, d) {
    var now = new Date().toISOString();
    d.createdAt = now;
    d.updatedAt = now;
    /* شناسه یکتای جهانی — برای همگام‌سازی آینده با Supabase لازم است،
       چون id عددی IndexedDB بین دستگاه‌ها تکراری می‌شود. */
    if (!d.uid) d.uid = uuid();
    return DB._req(function() {
      return DB.gs(n, 'readwrite').add(d);
    }, 'add(' + n + ')').then(function(id) {
      DB._queue(n, 'insert', d, id);
      return id;
    });
  },
  put: function(n, d) {
    d.updatedAt = new Date().toISOString();
    if (!d.uid) d.uid = uuid();
    return DB._req(function() {
      return DB.gs(n, 'readwrite').put(d);
    }, 'put(' + n + ')').then(function(id) {
      DB._queue(n, 'update', d, d.id || id);
      return id;
    });
  },

  /* ── تنظیمات کلید/مقدار ── */
  getSetting: async function(key, dflt) {
    var rows = await DB.all('settings');
    var row = rows.find(function(r) {
      return r.key === key;
    });
    return row ? row.value : dflt;
  },
  setSetting: async function(key, value) {
    var rows = await DB.all('settings');
    var row = rows.find(function(r) {
      return r.key === key;
    });
    if (row) {
      row.value = value;
      await DB.put('settings', row);
    } else {
      await DB.add('settings', {
        key: key,
        value: value
      });
    }
    return value;
  },
  del: function(n, id) {
    var self = this;
    /* uid رکورد قبل از حذف خوانده می‌شود تا صف همگام‌سازی بداند در
       سرور کدام سطر باید حذف شود. */
    return this.get(n, id).catch(function() {
      return null;
    }).then(function(row) {
      return DB._req(function() {
        return DB.gs(n, 'readwrite').delete(id);
      }, 'del(' + n + ')').then(function(r) {
        DB._queue(n, 'delete', row || {
          id: id
        }, id);
        return r;
      });
    });
  },
  /* نوشتن دسته‌ای در یک تراکنش — برای بازیابی پشتیبان */
  bulkPut: function(n, rows) {
    return new Promise(function(ok, no) {
      if (!rows || !rows.length) {
        ok(0);
        return;
      }
      var tx = DB.db.transaction(n, 'readwrite'),
        st = tx.objectStore(n);
      rows.forEach(function(row) {
        st.put(row);
      });
      tx.oncomplete = function() {
        ok(rows.length);
      };
      tx.onerror = tx.onabort = function() {
        no(tx.error || new Error('خطا در نوشتن ' + n));
      };
    });
  },
  clear: function(n) {
    return DB._req(function() {
      return DB.gs(n, 'readwrite').clear();
    }, 'clear(' + n + ')');
  }
};
