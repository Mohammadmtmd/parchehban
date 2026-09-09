/* ══════════════════════════════════════════════════════════════
   SYNC LAYER — همگام‌سازی ابری با Supabase و پشتیبانی کامل آفلاین
   این ماژول امکان استفاده همزمان از چند دستگاه (رایانه ویندوز،
   گوشی موبایل، تبلت و...) را با حفظ کامل داده‌ها و کارکرد آفلاین فراهم می‌کند.
   ══════════════════════════════════════════════════════════════ */

var Sync = {
  /* نگاشت نام جدول‌های IndexedDB به نام جدول‌های Supabase */
  STORE_MAP: {
    fiscalYears: 'fiscal_years',
    categories: 'categories',
    products: 'products',
    contacts: 'contacts',
    banks: 'banks',
    yearOpenings: 'year_openings',
    invoices: 'invoices',
    payments: 'payments',
    checks: 'checks',
    bankTransfers: 'bank_transfers',
    settings: 'app_settings',
    users: 'app_users'
  },

  /* ترتیب وابستگی جدول‌ها در دریافت و بازیابی (ابتدا پایه‌ها، سپس اسناد) */
  STORES_ORDER: [
    'fiscalYears',
    'categories',
    'products',
    'contacts',
    'banks',
    'yearOpenings',
    'invoices',
    'payments',
    'checks',
    'bankTransfers',
    'settings',
    'users'
  ],

  MAX_QUEUE: 5000,
  _busy: false,
  _autoTimer: null,
  _debounceTimer: null,

  /* شناسه این دستگاه — برای تفکیک منبع تغییرات */
  deviceId: function() {
    var k = 'pb_device';
    var v = localStorage.getItem(k);
    if (!v) {
      v = uuid();
      localStorage.setItem(k, v);
    }
    return v;
  },

  /* دریافت تنظیمات اتصال به Supabase */
  getConfig: function() {
    var url = (localStorage.getItem('pb_supabase_url') || '').trim().replace(/\/+$/, '');
    var key = (localStorage.getItem('pb_supabase_key') || '').trim();
    var orgId = (localStorage.getItem('pb_supabase_org_id') || 'shop1').trim();
    var autoSync = localStorage.getItem('pb_auto_sync') !== 'false';
    return {
      url: url,
      key: key,
      orgId: orgId,
      autoSync: autoSync,
      configured: !!(url && key && orgId)
    };
  },

  /* ذخیره تنظیمات اتصال */
  saveConfig: function(cfg) {
    if (cfg.url !== undefined) localStorage.setItem('pb_supabase_url', (cfg.url || '').trim().replace(/\/+$/, ''));
    if (cfg.key !== undefined) localStorage.setItem('pb_supabase_key', (cfg.key || '').trim());
    if (cfg.orgId !== undefined) localStorage.setItem('pb_supabase_org_id', (cfg.orgId || 'shop1').trim());
    if (cfg.autoSync !== undefined) localStorage.setItem('pb_auto_sync', cfg.autoSync ? 'true' : 'false');
    Sync.init();
    Sync.updateUI();
  },

  /* آزمایش اتصال به سرور Supabase */
  testConnection: async function(url, key) {
    var targetUrl = (url || '').trim().replace(/\/+$/, '');
    var targetKey = (key || '').trim();
    if (!targetUrl || !targetKey) {
      return { ok: false, message: 'آدرس سرور و کلید دسترسی (API Key) الزامی است.' };
    }
    try {
      var res = await fetch(targetUrl + '/rest/v1/app_settings?select=id&limit=1', {
        method: 'GET',
        headers: {
          'apikey': targetKey,
          'Authorization': 'Bearer ' + targetKey
        }
      });
      if (res.ok) {
        return { ok: true, message: 'اتصال به Supabase با موفقیت برقرار شد.' };
      }
      var text = await res.text();
      return { ok: false, message: 'خطا از سمت سرور (' + res.status + '): ' + (text || res.statusText) };
    } catch (e) {
      return { ok: false, message: 'عدم دسترسی به سرور: ' + (e && e.message ? e.message : 'خطای شبکه') };
    }
  },

  /* ثبت یک تغییر در صف خروجی محلی (Outbox Pattern) */
  enqueue: function(store, op, row, id) {
    var entry = {
      store: store,
      op: op,
      rowId: id != null ? id : (row && row.id),
      uid: (row && row.uid) || (op === 'delete' ? (row && row.uid) : uuid()),
      payload: op === 'delete' ? null : Sync.strip(row),
      at: new Date().toISOString(),
      device: Sync.deviceId(),
      sent: false
    };

    DB._req(function() {
      return DB.gs('syncQueue', 'readwrite').add(entry);
    }, 'enqueue').then(function() {
      Sync.trim();
      Sync.updateUI();
      /* ارسال با کمی تأخیر (Debounce) تا تغییرات پی‌درپی باهم ارسال شوند */
      if (Sync.getConfig().configured) {
        clearTimeout(Sync._debounceTimer);
        Sync._debounceTimer = setTimeout(function() {
          Sync.flush();
        }, 1500);
      }
    }).catch(function(e) {
      console.warn('ثبت در صف همگام‌سازی ناموفق بود:', e && e.message);
    });
  },

  /* پاک‌سازی فیلدهای غیرضروری محلی */
  strip: function(row) {
    if (!row) return null;
    var out = {};
    Object.keys(row).forEach(function(k) {
      out[k] = row[k];
    });
    return out;
  },

  pending: async function() {
    try {
      var all = await DB.all('syncQueue');
      return all.filter(function(e) {
        return !e.sent;
      });
    } catch (e) {
      return [];
    }
  },

  count: async function() {
    return (await Sync.pending()).length;
  },

  /* هرس رکوردهای قدیمی صف */
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

  /* آماده‌سازی ستون‌های آینه‌ای برای نمایش و فیلتر ساده در داشبورد Supabase */
  _buildServerPayload: function(store, row, orgId, isDeleted) {
    var now = new Date().toISOString();
    var uid = row.uid || uuid();
    var payload = {
      id: uid,
      org_id: orgId,
      data: row,
      updated_at: row.updatedAt || now,
      is_deleted: !!isDeleted
    };

    if (store === 'categories') {
      payload.name = row.name || '';
    } else if (store === 'products') {
      payload.name = row.name || '';
      payload.code = row.code || '';
      payload.unit = row.unit || '';
      payload.category_id = row.categoryUid || (row.categoryId ? String(row.categoryId) : null);
      payload.purchase_price = row.purchasePrice || 0;
      payload.sale_price = row.salePrice || 0;
    } else if (store === 'contacts') {
      payload.name = row.name || '';
      payload.type = row.type || '';
      payload.phone = row.phone || '';
      payload.address = row.address || '';
      payload.balance = row.balance || 0;
    } else if (store === 'banks') {
      payload.title = row.title || '';
      payload.bank_name = row.bankName || '';
      payload.account_number = row.accountNumber || '';
      payload.opening_balance = row.openingBalance || 0;
    } else if (store === 'invoices') {
      payload.fiscal_year_id = row.fiscalYearUid || (row.fiscalYearId ? String(row.fiscalYearId) : null);
      payload.type = row.type || '';
      payload.invoice_number = row.invoiceNumber || '';
      payload.date = row.date || '';
      payload.contact_id = row.contactUid || (row.contactId ? String(row.contactId) : null);
      payload.subtotal = row.subtotal || 0;
      payload.shipping_cost = row.shippingCost || 0;
      payload.discount = row.discount || 0;
      payload.grand_total = row.grandTotal || 0;
      payload.paid_amount = row.paidAmount || 0;
      payload.bank_id = row.bankUid || (row.bankId ? String(row.bankId) : null);
    } else if (store === 'payments') {
      payload.fiscal_year_id = row.fiscalYearUid || (row.fiscalYearId ? String(row.fiscalYearId) : null);
      payload.type = row.type || '';
      payload.contact_id = row.contactUid || (row.contactId ? String(row.contactId) : null);
      payload.amount = row.amount || 0;
      payload.date = row.date || '';
      payload.bank_id = row.bankUid || (row.bankId ? String(row.bankId) : null);
      payload.description = row.description || row.notes || '';
      payload.source_invoice_id = row.sourceInvoiceUid || (row.sourceInvoiceId ? String(row.sourceInvoiceId) : null);
      payload.is_auto = !!row.isAuto;
    } else if (store === 'checks') {
      payload.fiscal_year_id = row.fiscalYearUid || (row.fiscalYearId ? String(row.fiscalYearId) : null);
      payload.type = row.type || '';
      payload.check_number = row.checkNumber || '';
      payload.contact_id = row.contactUid || (row.contactId ? String(row.contactId) : null);
      payload.amount = row.amount || 0;
      payload.issue_date = row.issueDate || '';
      payload.due_date = row.dueDate || '';
      payload.bank_name = row.bankName || '';
      payload.bank_account_id = row.bankAccountId || null;
      payload.status = row.status || 'pending';
    } else if (store === 'bankTransfers') {
      payload.fiscal_year_id = row.fiscalYearUid || (row.fiscalYearId ? String(row.fiscalYearId) : null);
      payload.from_bank_id = row.fromBankUid || (row.fromBankId ? String(row.fromBankId) : null);
      payload.to_bank_id = row.toBankUid || (row.toBankId ? String(row.toBankId) : null);
      payload.amount = row.amount || 0;
      payload.date = row.date || '';
      payload.description = row.description || '';
    } else if (store === 'yearOpenings') {
      payload.fiscal_year_id = row.fiscalYearUid || (row.fiscalYearId ? String(row.fiscalYearId) : null);
      payload.contact_id = row.contactUid || (row.contactId ? String(row.contactId) : null);
      payload.balance = row.balance || 0;
    } else if (store === 'fiscalYears') {
      payload.name = row.name || '';
      payload.start_date = row.startDate || '';
      payload.end_date = row.endDate || '';
      payload.is_current = !!row.isCurrent;
      payload.is_closed = !!row.isClosed;
    } else if (store === 'settings') {
      payload.key = row.key || '';
      payload.value = typeof row.value === 'object' ? JSON.stringify(row.value) : String(row.value || '');
    } else if (store === 'users') {
      payload.username = row.username || '';
      payload.display_name = row.displayName || '';
      payload.role = row.role || 'operator';
      payload.active = row.active !== false;
    }

    return payload;
  },

  /* ارسال صف تغییرات محلی به سرور Supabase */
  flush: async function() {
    var cfg = Sync.getConfig();
    if (!cfg.configured) return { skipped: 'اتصال به Supabase تنظیم نشده است' };
    if (Sync._busy) return { skipped: 'عملیات همگام‌سازی در حال انجام است' };
    if (typeof navigator !== 'undefined' && navigator.onLine === false) {
      Sync.updateUI();
      return { skipped: 'دستگاه آفلاین است' };
    }

    Sync._busy = true;
    Sync.updateUI();

    try {
      var batch = await Sync.pending();
      if (!batch.length) {
        Sync._busy = false;
        Sync.updateUI();
        return { sent: 0 };
      }

      /* دسته‌بندی سطرها بر اساس نام جدول */
      var byStore = {};
      batch.forEach(function(item) {
        if (!byStore[item.store]) byStore[item.store] = [];
        byStore[item.store].push(item);
      });

      var storeKeys = Object.keys(byStore);
      for (var s = 0; s < storeKeys.length; s++) {
        var storeName = storeKeys[s];
        var tableName = Sync.STORE_MAP[storeName] || storeName;
        var items = byStore[storeName];

        var rowsToUpsert = [];
        items.forEach(function(item) {
          if (item.op === 'delete') {
            rowsToUpsert.push({
              id: item.uid,
              org_id: cfg.orgId,
              data: {},
              updated_at: new Date().toISOString(),
              is_deleted: true
            });
          } else if (item.payload) {
            rowsToUpsert.push(Sync._buildServerPayload(storeName, item.payload, cfg.orgId, false));
          }
        });

        if (rowsToUpsert.length > 0) {
          var res = await fetch(cfg.url + '/rest/v1/' + tableName, {
            method: 'POST',
            headers: {
              'apikey': cfg.key,
              'Authorization': 'Bearer ' + cfg.key,
              'Content-Type': 'application/json',
              'Prefer': 'resolution=merge-duplicates,return=minimal'
            },
            body: JSON.stringify(rowsToUpsert)
          });

          if (!res.ok) {
            var errTxt = await res.text();
            throw new Error('خطا در ارسال به جدول ' + tableName + ': ' + (errTxt || res.statusText));
          }
        }

        /* علامت‌گذاری آیتم‌های ارسال‌شده */
        for (var i = 0; i < items.length; i++) {
          items[i].sent = true;
          items[i].sentAt = new Date().toISOString();
          await DB._req(function() {
            return DB.gs('syncQueue', 'readwrite').put(items[i]);
          }, 'markSent');
        }
      }

      localStorage.setItem('pb_last_sync', new Date().toISOString());
      Sync.trim();
      return { sent: batch.length };
    } catch (e) {
      console.warn('ارسال صف به Supabase ناموفق بود:', e && e.message);
      return { error: e && e.message };
    } finally {
      Sync._busy = false;
      Sync.updateUI();
    }
  },

  /* دریافت تغییرات جدید از Supabase به دستگاه محلی (Pull) */
  pull: async function(isFull) {
    var cfg = Sync.getConfig();
    if (!cfg.configured) return { skipped: 'تنظیمات ناقص' };
    if (typeof navigator !== 'undefined' && navigator.onLine === false) return { skipped: 'آفلاین' };

    var lastSync = isFull ? null : localStorage.getItem('pb_last_sync');
    var updatedCount = 0;

    try {
      for (var s = 0; s < Sync.STORES_ORDER.length; s++) {
        var storeName = Sync.STORES_ORDER[s];
        var tableName = Sync.STORE_MAP[storeName] || storeName;

        var url = cfg.url + '/rest/v1/' + tableName + '?org_id=eq.' + encodeURIComponent(cfg.orgId);
        if (lastSync) {
          url += '&updated_at=gt.' + encodeURIComponent(lastSync);
        }
        url += '&order=updated_at.asc&limit=1000';

        var res = await fetch(url, {
          method: 'GET',
          headers: {
            'apikey': cfg.key,
            'Authorization': 'Bearer ' + cfg.key
          }
        });

        if (!res.ok) continue;
        var remoteRows = await res.json();
        if (!Array.isArray(remoteRows) || !remoteRows.length) continue;

        var localAll = await DB.all(storeName);
        var localByUid = {};
        localAll.forEach(function(r) {
          if (r.uid) localByUid[r.uid] = r;
        });

        for (var i = 0; i < remoteRows.length; i++) {
          var rem = remoteRows[i];
          var uid = rem.id;
          var local = localByUid[uid];

          if (rem.is_deleted) {
            if (local) {
              await DB._req(function() {
                return DB.gs(storeName, 'readwrite').delete(local.id);
              }, 'pullDel');
              updatedCount++;
            }
          } else {
            var data = rem.data || {};
            data.uid = uid;
            data.updatedAt = rem.updated_at || data.updatedAt || new Date().toISOString();

            if (local) {
              /* اگر نسخه سرور جدیدتر از محلی است، اعمال شود */
              var remTime = new Date(rem.updated_at || 0).getTime();
              var locTime = new Date(local.updatedAt || 0).getTime();
              if (remTime >= locTime) {
                data.id = local.id; /* حفظ کلید عددی محلی */
                await DB._req(function() {
                  return DB.gs(storeName, 'readwrite').put(data);
                }, 'pullPut');
                updatedCount++;
              }
            } else {
              /* رکورد جدید در این دستگاه */
              if (data.id) {
                var existById = localAll.find(function(x) { return x.id === data.id; });
                if (existById) delete data.id; /* اجازه به ایندکس‌دی‌بی برای تخصیص کلید خودکار */
              }
              await DB._req(function() {
                return DB.gs(storeName, 'readwrite').put(data);
              }, 'pullAdd');
              updatedCount++;
            }
          }
        }
      }

      localStorage.setItem('pb_last_sync', new Date().toISOString());

      /* اگر داده‌های جدید آمد و کاربر در صفحه مربوطه است، صفحه تازه‌سازی شود */
      if (updatedCount > 0 && typeof currentPage !== 'undefined' && ROUTES[currentPage]) {
        if (typeof UI !== 'undefined' && UI.toast) {
          UI.toast('داده‌ها با سرور همگام شدند (' + updatedCount + ' تغییر)');
        }
        await FY.refreshSel();
        ROUTES[currentPage]();
      }

      return { pulled: updatedCount };
    } catch (e) {
      console.warn('دریافت تغییرات از Supabase ناموفق بود:', e && e.message);
      return { error: e && e.message };
    }
  },

  /* همگام‌سازی دوطرفه فوری: ابتدا ارسال صف، سپس دریافت تغییرات جدید */
  syncNow: async function() {
    var cfg = Sync.getConfig();
    if (!cfg.configured) {
      Sync.uiModal();
      return;
    }
    Sync.updateUI('syncing');
    var pushRes = await Sync.flush();
    var pullRes = await Sync.pull();
    Sync.updateUI();
    return { push: pushRes, pull: pullRes };
  },

  /* بارگذاری کل اطلاعات محلی روی Supabase (مخصوص اولین بار روی سیستم اصلی) */
  fullUpload: async function(onProgress) {
    var cfg = Sync.getConfig();
    if (!cfg.configured) throw new Error('تنظیمات Supabase هنوز ذخیره نشده است.');

    var totalRecords = 0;
    for (var s = 0; s < Sync.STORES_ORDER.length; s++) {
      var storeName = Sync.STORES_ORDER[s];
      var tableName = Sync.STORE_MAP[storeName] || storeName;
      var rows = await DB.all(storeName);

      if (onProgress) onProgress(storeName, 0, rows.length);

      /* اطمینان از وجود uid روی تک‌تک رکوردها */
      for (var r = 0; r < rows.length; r++) {
        if (!rows[r].uid) {
          rows[r].uid = uuid();
          await DB._req(function() {
            return DB.gs(storeName, 'readwrite').put(rows[r]);
          }, 'ensureUid');
        }
      }

      /* ارسال در بسته‌های ۵۰ تایی برای جلوگیری از سنگین شدن ترافیک شبکه */
      var chunkSize = 50;
      for (var i = 0; i < rows.length; i += chunkSize) {
        var chunk = rows.slice(i, i + chunkSize);
        var payload = chunk.map(function(row) {
          return Sync._buildServerPayload(storeName, row, cfg.orgId, false);
        });

        var res = await fetch(cfg.url + '/rest/v1/' + tableName, {
          method: 'POST',
          headers: {
            'apikey': cfg.key,
            'Authorization': 'Bearer ' + cfg.key,
            'Content-Type': 'application/json',
            'Prefer': 'resolution=merge-duplicates,return=minimal'
          },
          body: JSON.stringify(payload)
        });

        if (!res.ok) {
          var errTxt = await res.text();
          throw new Error('خطا در بارگذاری جدول ' + tableName + ': ' + (errTxt || res.statusText));
        }

        totalRecords += chunk.length;
        if (onProgress) onProgress(storeName, Math.min(i + chunkSize, rows.length), rows.length);
      }
    }

    /* پاک‌سازی صف محلی چون همه اطلاعات مستقیم آپلود شدند */
    await DB.clear('syncQueue');
    localStorage.setItem('pb_last_sync', new Date().toISOString());
    Sync.updateUI();
    return totalRecords;
  },

  /* دریافت کل اطلاعات از Supabase به دستگاه محلی (مخصوص راه‌اندازی دستگاه دوم مانند موبایل) */
  fullDownload: async function(onProgress) {
    var cfg = Sync.getConfig();
    if (!cfg.configured) throw new Error('تنظیمات Supabase وارد نشده است.');

    var totalDownloaded = 0;
    for (var s = 0; s < Sync.STORES_ORDER.length; s++) {
      var storeName = Sync.STORES_ORDER[s];
      var tableName = Sync.STORE_MAP[storeName] || storeName;

      if (onProgress) onProgress(storeName, 'در حال دریافت...');

      var res = await fetch(cfg.url + '/rest/v1/' + tableName + '?org_id=eq.' + encodeURIComponent(cfg.orgId) + '&is_deleted=eq.false&limit=5000', {
        method: 'GET',
        headers: {
          'apikey': cfg.key,
          'Authorization': 'Bearer ' + cfg.key
        }
      });

      if (!res.ok) {
        var errTxt = await res.text();
        throw new Error('خطا در دریافت جدول ' + tableName + ': ' + (errTxt || res.statusText));
      }

      var remoteRows = await res.json();
      if (Array.isArray(remoteRows)) {
        for (var i = 0; i < remoteRows.length; i++) {
          var rem = remoteRows[i];
          var data = rem.data || {};
          data.uid = rem.id;
          data.updatedAt = rem.updated_at || data.updatedAt || new Date().toISOString();

          await DB._req(function() {
            return DB.gs(storeName, 'readwrite').put(data);
          }, 'fullDownloadPut');
          totalDownloaded++;
        }
      }
    }

    localStorage.setItem('pb_last_sync', new Date().toISOString());
    await FY.ensureDefault();
    Sync.updateUI();
    return totalDownloaded;
  },

  /* راه‌اندازی اولیه ماژول همگام‌سازی و شنوندگان رویدادها */
  init: function() {
    var cfg = Sync.getConfig();

    /* پاک کردن تایمرهای قبلی در صورت راه‌اندازی مجدد */
    if (Sync._autoTimer) clearInterval(Sync._autoTimer);

    if (cfg.configured && cfg.autoSync) {
      /* همگام‌سازی خودکار هر ۳۵ ثانیه */
      Sync._autoTimer = setInterval(function() {
        if (typeof navigator !== 'undefined' && navigator.onLine) {
          Sync.syncNow();
        }
      }, 35000);

      /* همگام‌سازی فوری هنگام باز شدن دوباره تب یا بازگشت فوکوس */
      if (typeof window !== 'undefined' && !Sync._listenersBound) {
        window.addEventListener('focus', function() {
          if (Sync.getConfig().configured) Sync.syncNow();
        });
        document.addEventListener('visibilitychange', function() {
          if (document.visibilityState === 'visible' && Sync.getConfig().configured) {
            Sync.syncNow();
          }
        });
        window.addEventListener('online', function() {
          UI.toast('اتصال اینترنت برقرار شد. در حال همگام‌سازی...');
          Sync.syncNow();
        });
        window.addEventListener('offline', function() {
          Sync.updateUI();
        });
        Sync._listenersBound = true;
      }

      /* یک تلاش همگام‌سازی آرام در ابتدای ورود */
      setTimeout(function() {
        Sync.syncNow();
      }, 2000);
    }

    Sync.updateUI();
  },

  /* به‌روزرسانی نشانگر وضعیت همگام‌سازی در هدر بالای برنامه */
  updateUI: async function(forceState) {
    var el = document.getElementById('syncStatusBtn');
    if (!el) return;

    var cfg = Sync.getConfig();
    var pCount = 0;
    try { pCount = await Sync.count(); } catch (e) {}

    var isOnline = typeof navigator !== 'undefined' ? navigator.onLine : true;

    if (!cfg.configured) {
      el.innerHTML = '<i class="bi bi-cloud-slash"></i> <span class="sync-lbl">آفلاین (محلی)</span>';
      el.className = 'btn bo bs sync-status-btn sync-unconfigured';
      el.title = 'اتصال ابری تنظیم نشده است (فقط ذخیره در این دستگاه). برای اتصال کلیک کنید.';
      return;
    }

    if (!isOnline) {
      el.innerHTML = '<i class="bi bi-wifi-off text-d"></i> <span class="sync-lbl">آفلاین (' + pCount + ')</span>';
      el.className = 'btn bo bs sync-status-btn sync-offline';
      el.title = 'اتصال اینترنت قطع است. ' + pCount + ' تغییر در صف ارسال پس از وصل شدن است.';
      return;
    }

    if (forceState === 'syncing' || Sync._busy) {
      el.innerHTML = '<i class="bi bi-arrow-repeat spin text-p"></i> <span class="sync-lbl">همگام‌سازی...</span>';
      el.className = 'btn bo bs sync-status-btn sync-active';
      el.title = 'در حال ارتباط با سرور ابری Supabase...';
      return;
    }

    if (pCount > 0) {
      el.innerHTML = '<i class="bi bi-cloud-arrow-up text-w"></i> <span class="sync-lbl">در صف (' + pCount + ')</span>';
      el.className = 'btn bo bs sync-status-btn sync-pending';
      el.title = pCount + ' تغییر در صف ارسال به سرور. برای همگام‌سازی فوری کلیک کنید.';
      return;
    }

    var lastSync = localStorage.getItem('pb_last_sync');
    var timeTxt = lastSync ? new Date(lastSync).toLocaleTimeString('fa-IR', { hour: '2-digit', minute: '2-digit' }) : 'لحظاتی پیش';
    el.innerHTML = '<i class="bi bi-cloud-check-fill text-ok"></i> <span class="sync-lbl">همگام (' + timeTxt + ')</span>';
    el.className = 'btn bo bs sync-status-btn sync-synced';
    el.title = 'تمام اطلاعات با سرور ابری Supabase همگام است. آخرین همگام‌سازی: ' + timeTxt;
  },

  /* مودال وضعیت و دسترسی سریع به همگام‌سازی */
  uiModal: async function() {
    var cfg = Sync.getConfig();
    var pCount = await Sync.count();
    var lastSync = localStorage.getItem('pb_last_sync');
    var lastSyncFa = lastSync ? new Date(lastSync).toLocaleString('fa-IR') : 'هنوز انجام نشده';

    var h = '<div style="direction:rtl;text-align:right">';
    h += '<h3 style="margin-bottom:12px;font-weight:800;font-size:1.15rem;display:flex;align-items:center;gap:8px">' +
         '<i class="bi bi-clouds-fill" style="color:var(--p)"></i> وضعیت همگام‌سازی ابری (Supabase)</h3>';

    if (!cfg.configured) {
      h += '<div class="hint-box" style="margin-bottom:16px">' +
           '<strong>اتصال ابری هنوز فعال نشده است.</strong><br>' +
           'برای استفاده همزمان از برنامه روی چند دستگاه (رایانه، موبایل) و پشتیبان‌گیری خودکار، اطلاعات اتصال به Supabase را در تنظیمات وارد کنید.' +
           '</div>';
      h += '<div style="display:flex;gap:10px;justify-content:flex-end">' +
           '<button class="btn bo" onclick="UI.close()">بستن</button>' +
           '<button class="btn bp" onclick="UI.close();Settings.render();"><i class="bi bi-gear"></i> رفتن به تنظیمات اتصال</button>' +
           '</div>';
    } else {
      h += '<div style="background:var(--bg);border:1px solid var(--bd);border-radius:var(--rd);padding:14px;margin-bottom:16px;font-size:.88rem;line-height:1.9">' +
           '<div><strong>شناسه کسب‌وکار:</strong> <code>' + esc(cfg.orgId) + '</code></div>' +
           '<div><strong>آدرس سرور:</strong> <code style="direction:ltr;display:inline-block">' + esc(cfg.url) + '</code></div>' +
           '<div><strong>تغییرات منتظر ارسال:</strong> ' + (pCount > 0 ? '<span style="color:var(--d);font-weight:700">' + pCount + ' مورد</span>' : '<span style="color:var(--ok)">صف خالی (همه ارسال شده)</span>') + '</div>' +
           '<div><strong>آخرین همگام‌سازی:</strong> ' + lastSyncFa + '</div>' +
           '<div><strong>همگام‌سازی خودکار:</strong> ' + (cfg.autoSync ? '<span style="color:var(--ok)">فعال</span>' : '<span style="color:var(--txs)">غیرفعال</span>') + '</div>' +
           '</div>';

      h += '<div style="display:flex;gap:8px;flex-wrap:wrap;justify-content:space-between;align-items:center">' +
           '<button class="btn bo" onclick="UI.close();Settings.render()"><i class="bi bi-sliders"></i> تنظیمات پیشرفته</button>' +
           '<div style="display:flex;gap:8px">' +
           '<button class="btn bo" onclick="UI.close()">بستن</button>' +
           '<button class="btn bp" id="modalSyncNowBtn" onclick="Sync.handleModalSync()"><i class="bi bi-arrow-repeat"></i> همگام‌سازی فوری</button>' +
           '</div>' +
           '</div>';
    }

    h += '</div>';
    UI.modal(h);
  },

  handleModalSync: async function() {
    var btn = document.getElementById('modalSyncNowBtn');
    if (btn) {
      btn.disabled = true;
      btn.innerHTML = '<i class="bi bi-arrow-repeat spin"></i> در حال همگام‌سازی...';
    }
    try {
      var res = await Sync.syncNow();
      if (res && res.push && res.push.error) {
        UI.toast('خطا در ارسال: ' + res.push.error, 'e');
      } else if (res && res.pull && res.pull.error) {
        UI.toast('خطا در دریافت: ' + res.pull.error, 'e');
      } else {
        UI.toast('همگام‌سازی با موفقیت انجام شد');
      }
    } catch (e) {
      UI.toast('خطا: ' + (e && e.message ? e.message : 'نامشخص'), 'e');
    }
    UI.close();
  }
};
