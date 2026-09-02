/* ══ SYNC LAYER ══
   لایه آماده‌سازی برای انتقال ذخیره‌سازی به سرور (Supabase) و استفاده
   از چند دستگاه.

   ⚠️ این ماژول در حال حاضر هیچ چیزی به سرور نمی‌فرستد.
   کاری که می‌کند این است که زیرساخت لازم را از همین حالا فراهم کند:

     ۱) هر رکورد یک `uid` یکتای جهانی می‌گیرد (در js/03-db.js).
        شناسه عددی IndexedDB بین دستگاه‌ها تکراری می‌شود، پس نمی‌تواند
        کلید اصلی در سرور باشد. `uid` می‌تواند.

     ۲) هر تغییر (درج/ویرایش/حذف) در جدول محلی `syncQueue` ثبت می‌شود.
        این همان الگوی «صندوق خروجی» (outbox) است: وقتی آداپتور سرور
        اضافه شد، فقط باید این صف را به ترتیب برای سرور بفرستد.
        بنابراین تغییرهایی که همین حالا آفلاین ثبت می‌کنید، بعد از
        اتصال به Supabase از دست نمی‌روند.

     ۳) `Sync.adapter` نقطه اتصال است. برای فعال‌کردن همگام‌سازی فقط
        باید یک آبجکت با متد `push(batch)` به آن بدهید. هیچ جای دیگری
        از برنامه لازم نیست تغییر کند.

   ساختار جدول‌ها و سیاست‌های امنیتی سمت سرور در فایل
   `supabase/schema.sql` آماده است. */
var Sync = {

  /* تا وقتی آداپتور تعیین نشده، صف فقط جمع می‌شود و چیزی ارسال نمی‌گردد */
  adapter: null,

  /* بیشترین تعداد رکورد صف؛ برای اینکه در استفاده تک‌دستگاهی صف
     بی‌نهایت رشد نکند. قدیمی‌ترین‌ها هرس می‌شوند. */
  MAX_QUEUE: 5000,

  /* شناسه این دستگاه — برای تشخیص اینکه یک تغییر از کدام دستگاه آمده */
  deviceId: function() {
    var k = 'pb_device';
    var v = localStorage.getItem(k);
    if (!v) {
      v = uuid();
      localStorage.setItem(k, v);
    }
    return v;
  },

  /* ثبت یک تغییر در صف خروجی. از DB.add/put/del صدا زده می‌شود. */
  enqueue: function(store, op, row, id) {
    var entry = {
      store: store,
      op: op,
      rowId: id != null ? id : (row && row.id),
      uid: (row && row.uid) || null,
      /* برای حذف، بدنه لازم نیست؛ فقط uid کافی است */
      payload: op === 'delete' ? null : Sync.strip(row),
      at: new Date().toISOString(),
      device: Sync.deviceId(),
      sent: false
    };
    /* نوشتن در صف نباید مسیر اصلی را کند یا خطادار کند، پس بی‌صدا
       و بدون await انجام می‌شود. */
    DB._req(function() {
      return DB.gs('syncQueue', 'readwrite').add(entry);
    }, 'enqueue').then(function() {
      Sync.trim();
      if (Sync.adapter && Sync.adapter.push) Sync.flush();
    }).catch(function(e) {
      console.warn('ثبت در صف همگام‌سازی ناموفق بود:', e && e.message);
    });
  },

  /* حذف فیلدهای محلی که به سرور نمی‌روند */
  strip: function(row) {
    if (!row) return null;
    var out = {};
    Object.keys(row).forEach(function(k) {
      if (k === 'id') return; /* شناسه محلی به سرور نمی‌رود؛ uid جایش است */
      out[k] = row[k];
    });
    return out;
  },

  pending: async function() {
    var all = await DB.all('syncQueue');
    return all.filter(function(e) {
      return !e.sent;
    });
  },

  count: async function() {
    return (await Sync.pending()).length;
  },

  /* هرس صف: رکوردهای ارسال‌شده و مازاد قدیمی حذف می‌شوند */
  trim: async function() {
    try {
      var all = await DB.all('syncQueue');
      if (all.length <= Sync.MAX_QUEUE) return;
      var sorted = all.sort(function(a, b) {
        return (a.id || 0) - (b.id || 0);
      });
      var extra = sorted.length - Sync.MAX_QUEUE;
      for (var i = 0; i < extra; i++) {
        await DB._req(function() {
          return DB.gs('syncQueue', 'readwrite').delete(sorted[i].id);
        }, 'trim');
      }
    } catch (e) {
      console.warn('هرس صف همگام‌سازی', e);
    }
  },

  /* ارسال صف به سرور — فقط وقتی آداپتور تعریف شده باشد کار می‌کند */
  _busy: false,
  flush: async function() {
    if (!Sync.adapter || !Sync.adapter.push) return {
      skipped: 'آداپتور همگام‌سازی تعریف نشده است'
    };
    if (Sync._busy) return {
      skipped: 'در حال ارسال'
    };
    if (typeof navigator !== 'undefined' && navigator.onLine === false) return {
      skipped: 'اتصال اینترنت وجود ندارد'
    };
    Sync._busy = true;
    try {
      var batch = await Sync.pending();
      if (!batch.length) return {
        sent: 0
      };
      await Sync.adapter.push(batch);
      for (var i = 0; i < batch.length; i++) {
        batch[i].sent = true;
        batch[i].sentAt = new Date().toISOString();
        await DB._req(function() {
          return DB.gs('syncQueue', 'readwrite').put(batch[i]);
        }, 'markSent');
      }
      return {
        sent: batch.length
      };
    } catch (e) {
      console.warn('ارسال صف ناموفق بود؛ در تلاش بعدی دوباره امتحان می‌شود:', e && e.message);
      return {
        error: e && e.message
      };
    } finally {
      Sync._busy = false;
    }
  },

  /* پاک کردن کامل صف — بعد از اولین بارگذاری کامل روی سرور */
  clearQueue: async function() {
    await DB.clear('syncQueue');
  },

  /* خروجی کامل داده به فرمتی که مستقیم به Supabase قابل بارگذاری است.
     هر جدول یک آرایه از سطرها با کلید uid. */
  exportForServer: async function() {
    var out = {
      generatedAt: new Date().toISOString(),
      device: Sync.deviceId(),
      tables: {}
    };
    for (var i = 0; i < DB.DATA_STORES.length; i++) {
      var name = DB.DATA_STORES[i];
      var rows = await DB.all(name);
      out.tables[name] = rows.map(function(r) {
        var c = Sync.strip(r);
        c.local_id = r.id;
        return c;
      });
    }
    return out;
  }
};

/* وقتی اینترنت برگشت، تلاش دوباره برای ارسال صف */
if (typeof window !== 'undefined') {
  window.addEventListener('online', function() {
    if (Sync.adapter) Sync.flush();
  });
}
