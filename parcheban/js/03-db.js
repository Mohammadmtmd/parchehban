/* ══ DB ══ */
var DB = {
  db: null,
  init: function() {
    return new Promise(function(ok, no) {
      var r = indexedDB.open('parchehban_v8', 3);
      r.onupgradeneeded = function(e) {
        var d = e.target.result;
        ['categories', 'products', 'contacts', 'invoices', 'payments', 'checks', 'fiscalYears', 'yearOpenings', 'users', 'banks', 'bankTransfers'].forEach(function(n) {
          if (!d.objectStoreNames.contains(n)) d.createObjectStore(n, {
            keyPath: 'id',
            autoIncrement: true
          });
        });
      };
      r.onsuccess = function(e) {
        DB.db = e.target.result;
        ok();
      };
      r.onerror = function(e) {
        no(e.target.error);
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
  add: function(n, d) {
    d.createdAt = new Date().toISOString();
    return DB._req(function() {
      return DB.gs(n, 'readwrite').add(d);
    }, 'add(' + n + ')');
  },
  put: function(n, d) {
    d.updatedAt = new Date().toISOString();
    return DB._req(function() {
      return DB.gs(n, 'readwrite').put(d);
    }, 'put(' + n + ')');
  },
  del: function(n, id) {
    return DB._req(function() {
      return DB.gs(n, 'readwrite').delete(id);
    }, 'del(' + n + ')');
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
