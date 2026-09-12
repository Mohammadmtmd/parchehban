/* ══════════════════════════════════════════════════════════════
   SETTINGS — تنظیمات سیستم، امنیت کاربران و اتصال به Supabase
   ══════════════════════════════════════════════════════════════ */

var Settings = {
  render: async function() {
    currentPage = 'settings';
    UI.nav('settings');
    UI.title('bi-gear-fill', 'تنظیمات و اتصال ابری');
    UI.act('');

    var user = null;
    if (STATE.userId) user = await DB.get('users', STATE.userId);
    if (!user && STATE.username) {
      var allU = await DB.all('users');
      user = allU.find(function(x) {
        return (x.username || '').toLowerCase() === String(STATE.username).toLowerCase() || String(x.id) === String(STATE.userId);
      });
    }
    if (!user) {
      var allU = await DB.all('users');
      user = allU[0];
      if (user) {
        STATE.userId = user.id;
        STATE.username = user.username;
      }
    }
    var supaCfg = Sync.getConfig();
    var masterKey = await Auth.getMasterRecoveryKey();

    var h = '<div class="g2">';

    /* ── کارت ۱: اطلاعات کاربری ── */
    h += '<div class="cd"><div class="cd-h"><i class="bi bi-person-badge"></i> اطلاعات کاربری</div><div class="cd-b">' +
      '<div class="fg"><label>نام کاربری</label><input class="fc" id="setUser" value="' + esc(user ? user.username : '') + '" placeholder="نام کاربری"></div>' +
      '<div class="fg"><label>نام نمایشی</label><input class="fc" id="setDisp" value="' + esc(user ? (user.displayName || '') : '') + '" placeholder="مثال: مدیر سیستم یا نام شما"></div>' +
      '<button class="btn bp" onclick="Settings.saveInfo()"><i class="bi bi-check-lg"></i> ذخیره مشخصات</button>' +
      '</div></div>';

    /* ── کارت ۲: تغییر رمز عبور ── */
    h += '<div class="cd"><div class="cd-h"><i class="bi bi-key-fill"></i> تغییر رمز عبور</div><div class="cd-b">' +
      '<div class="fg"><label>رمز فعلی</label><div style="position:relative"><input class="fc" id="setOld" type="password" style="padding-inline-end:38px"><button type="button" onclick="Auth.togglePassVis(\'setOld\', this)" style="position:absolute;left:8px;top:50%;transform:translateY(-50%);background:none;border:none;color:var(--txs);cursor:pointer;font-size:1.1rem;padding:4px"><i class="bi bi-eye"></i></button></div></div>' +
      '<div class="fg"><label>رمز جدید</label><div style="position:relative"><input class="fc" id="setNew" type="password" placeholder="حداقل ۵ کاراکتر" style="padding-inline-end:38px"><button type="button" onclick="Auth.togglePassVis(\'setNew\', this)" style="position:absolute;left:8px;top:50%;transform:translateY(-50%);background:none;border:none;color:var(--txs);cursor:pointer;font-size:1.1rem;padding:4px"><i class="bi bi-eye"></i></button></div></div>' +
      '<div class="fg"><label>تکرار رمز جدید</label><div style="position:relative"><input class="fc" id="setConf" type="password" style="padding-inline-end:38px"><button type="button" onclick="Auth.togglePassVis(\'setConf\', this)" style="position:absolute;left:8px;top:50%;transform:translateY(-50%);background:none;border:none;color:var(--txs);cursor:pointer;font-size:1.1rem;padding:4px"><i class="bi bi-eye"></i></button></div></div>' +
      '<button class="btn bp" onclick="Settings.changePass()"><i class="bi bi-shield-check"></i> تغییر و ذخیره رمز جدید</button>' +
      '</div></div>';

    h += '</div>';

    /* ── کارت ۳: اتصال به Supabase (همگام‌سازی چند دستگاهی) ── */
    h += '<div class="cd" style="margin-top:14px">' +
      '<div class="cd-h" style="display:flex;justify-content:space-between;align-items:center">' +
      '<span><i class="bi bi-clouds-fill" style="color:var(--p)"></i> اتصال به سرور Supabase (همگام‌سازی ویندوز و موبایل)</span>' +
      '<button class="btn bo bs" onclick="Settings.showSqlHelp()"><i class="bi bi-filetype-sql"></i> راهنمای جدول‌ها و SQL</button>' +
      '</div><div class="cd-b">' +
      '<p style="color:var(--txs);font-size:.85rem;margin-bottom:14px;line-height:1.8">' +
      'با اتصال به Supabase، فاکتورها، انبار و حساب‌های شما بین تمام دستگاه‌ها (رایانه مغازه، گوشی موبایل و...) به‌طور زنده همگام می‌شود و حتی در صورت قطع اینترنت، برنامه به کار خود ادامه می‌دهد.' +
      '</p>' +
      '<div class="g2">' +
      '<div class="fg"><label>آدرس پروژه Supabase (Project URL)</label>' +
      '<input class="fc" id="setSupaUrl" placeholder="https://xxxxxxxx.supabase.co" value="' + esc(supaCfg.url) + '" style="direction:ltr;font-family:monospace">' +
      '</div>' +
      '<div class="fg"><label>شناسه کسب‌وکار / سازمان (Org ID)</label>' +
      '<input class="fc" id="setSupaOrg" placeholder="مثال: shop1404" value="' + esc(supaCfg.orgId) + '" style="direction:ltr;font-family:monospace">' +
      '</div>' +
      '</div>' +
      '<div class="fg"><label>کلید عمومی دسترسی (Supabase Anon Public API Key)</label>' +
      '<input class="fc" id="setSupaKey" type="password" placeholder="eyJhbGciOi..." value="' + esc(supaCfg.key) + '" style="direction:ltr;font-family:monospace">' +
      '</div>' +
      '<div class="fg" style="margin-bottom:16px"><label style="display:flex;align-items:center;gap:8px;cursor:pointer">' +
      '<input type="checkbox" id="setSupaAuto"' + (supaCfg.autoSync ? ' checked' : '') + '> همگام‌سازی خودکار در پس‌زمینه (هر ۳۵ ثانیه و هنگام بازگشت به برنامه)' +
      '</label></div>' +
      '<div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center">' +
      '<button class="btn bp" onclick="Settings.saveSupabaseConfig()"><i class="bi bi-save"></i> ذخیره تنظیمات اتصال</button>' +
      '<button class="btn bo" onclick="Settings.testSupabase()"><i class="bi bi-plug"></i> آزمایش اتصال</button>' +
      '<button class="btn bo" onclick="Sync.syncNow()"><i class="bi bi-arrow-repeat"></i> همگام‌سازی فوری</button>' +
      '<button class="btn bo" onclick="Settings.doFullUpload()" title="ارسال تمام اطلاعات سیستم فعلی به Supabase"><i class="bi bi-cloud-arrow-up"></i> بارگذاری کامل روی سرور (سیستم مبدأ)</button>' +
      '<button class="btn bo" onclick="Settings.doFullDownload()" title="دریافت تمام اطلاعات از سرور روی این دستگاه"><i class="bi bi-cloud-arrow-down"></i> دریافت کامل از سرور (گوشی / سیستم جدید)</button>' +
      '<button class="btn bo" onclick="Settings.copyMobileLink()" title="ایجاد لینک برای اتصال فوق‌سریع گوشی بدون نیاز به تایپ کلید"><i class="bi bi-phone"></i> کپی لینک اتصال به گوشی</button>' +
      '</div>' +
      '</div></div>';

    /* ── کارت ۴: کلید بازیابی اضطراری (امنیت پیشرفته) ── */
    h += '<div class="cd" style="margin-top:14px"><div class="cd-h"><i class="bi bi-shield-lock-fill" style="color:var(--p)"></i> امنیت و کلید بازیابی اضطراری (Master Key)</div><div class="cd-b">' +
      '<p style="color:var(--txs);font-size:.85rem;margin-bottom:12px;line-height:1.8">' +
      'این کلید اختصاصی برای احراز هویت مالک در <strong>«ابزار عیب‌یابی و بازیابی امن»</strong> در صفحه ورود استفاده می‌شود. در صورتی که رمز عبور خود را فراموش کنید یا سیستم به علت تلاش‌های ناموفق قفل شود، تنها با وارد کردن این کلید (یا ارائه فایل پشتیبان سیستم) قادر به بازنشانی امن رمز خواهید بود. جهت جلوگیری از دسترسی افراد متفرقه، این کلید را محرمانه نگه دارید.' +
      '</p>' +
      '<div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap;margin-bottom:14px">' +
      '<div style="background:var(--bg);border:1.5px dashed var(--bd);padding:10px 18px;border-radius:var(--rd);font-family:monospace;font-size:1.1rem;font-weight:700;letter-spacing:1px;direction:ltr" id="masterKeyDisp">' +
      esc(masterKey) +
      '</div>' +
      '<button class="btn bo bs" onclick="Settings.copyMasterKey()"><i class="bi bi-clipboard"></i> کپی کلید</button>' +
      '<button class="btn bo bs" onclick="Settings.regenerateMasterKey()"><i class="bi bi-arrow-clockwise"></i> تولید کلید جدید</button>' +
      '</div>' +
      '<small style="color:var(--txm)">توصیه: این کلید را روی کاغذ یا در یادداشت‌های امن گوشی خود ذخیره داشته باشید.</small>' +
      '</div></div>';

    /* ── کارت ۵: وضعیت برنامه و کارکرد آفلاین ── */
    var swState = !('serviceWorker' in navigator) ?
      'مرورگر پشتیبانی نمی‌کند' :
      (navigator.serviceWorker.controller ? 'فعال — برنامه کامل بدون اینترنت هم کار می‌کند' :
        'ثبت شده؛ پس از یک‌بار بازخوانی فعال می‌شود');
    var pending = 0;
    try { pending = await Sync.count(); } catch (e) {}
    var lastSync = localStorage.getItem('pb_last_sync');
    var lastSyncFa = lastSync ? new Date(lastSync).toLocaleString('fa-IR') : 'انجام نشده';

    h += '<div class="cd" style="margin-top:14px"><div class="cd-h"><i class="bi bi-info-circle"></i> وضعیت برنامه و حافظه محلی</div><div class="cd-b">' +
      '<table style="width:100%;font-size:.84rem"><tbody>' +
      '<tr><td style="padding:6px 0;color:var(--txm);width:220px">نقش شما در سیستم</td><td><strong>' + esc(Perm.roleLabel(Perm.role)) + '</strong></td></tr>' +
      '<tr><td style="padding:6px 0;color:var(--txm)">سرویس‌ورکر آفلاین (PWA)</td><td><span style="color:var(--ok)">' + esc(swState) + '</span></td></tr>' +
      '<tr><td style="padding:6px 0;color:var(--txm)">اتصال اینترنت فعلی</td><td>' + (navigator.onLine === false ? '<span style="color:var(--d);font-weight:700">آفلاین</span>' : '<span style="color:var(--ok)">آنلاین</span>') + '</td></tr>' +
      '<tr><td style="padding:6px 0;color:var(--txm)">تغییرات در نوبت ارسال</td><td><strong>' + UI.fn(pending) + '</strong> مورد</td></tr>' +
      '<tr><td style="padding:6px 0;color:var(--txm)">آخرین زمان همگام‌سازی</td><td>' + lastSyncFa + '</td></tr>' +
      '<tr><td style="padding:6px 0;color:var(--txm)">شناسه این دستگاه</td><td style="font-family:monospace;font-size:.75rem" dir="ltr">' + esc(Sync.deviceId()) + '</td></tr>' +
      '</tbody></table>' +
      (Perm.can('*') ? '<button class="btn bo bs" style="margin-top:12px" onclick="Settings.exportServer()">' +
        '<i class="bi bi-download"></i> دانلود فایل خروجی JSON برای سرور</button>' : '') +
      '</div></div>';

    UI.content(h);
  },

  saveSupabaseConfig: function() {
    var url = elVal('setSupaUrl');
    var key = elVal('setSupaKey');
    var org = elVal('setSupaOrg');
    var autoEl = document.getElementById('setSupaAuto');
    var auto = autoEl ? autoEl.checked : true;

    Sync.saveConfig({
      url: url,
      key: key,
      orgId: org,
      autoSync: auto
    });
    UI.toast('تنظیمات Supabase با موفقیت ذخیره شد.', 's');
  },

  testSupabase: async function() {
    var url = elVal('setSupaUrl');
    var key = elVal('setSupaKey');
    if (!url || !key) {
      UI.toast('آدرس سرور و کلید API را وارد کنید.', 'e');
      return;
    }
    UI.toast('در حال آزمایش اتصال به Supabase...', 'i');
    var res = await Sync.testConnection(url, key);
    if (res.ok) {
      UI.toast(res.message, 's');
    } else {
      UI.toast(res.message, 'e');
    }
  },

  doFullUpload: async function() {
    var ok = window.confirm(
      'بارگذاری کل اطلاعات به Supabase\n\n' +
      'این کار تمام اطلاعات فعلی (فاکتورها، اشخاص، انبار و...) را روی Supabase ذخیره می‌کند تا از موبایل یا سیستم‌های دیگر در دسترس باشد.\n\n' +
      'ادامه می‌دهید؟'
    );
    if (!ok) return;

    UI.toast('در حال ارسال تمام اطلاعات به سرور...', 'i');
    try {
      var count = await Sync.fullUpload();
      UI.toast('با موفقیت ' + count + ' رکورد روی سرور ابری ثبت شد.', 's');
      Settings.render();
    } catch (e) {
      UI.toast('خطا در بارگذاری: ' + (e && e.message ? e.message : 'نامشخص'), 'e');
    }
  },

  doFullDownload: async function() {
    var ok = window.confirm(
      'دریافت کل اطلاعات از Supabase\n\n' +
      'این کار تمام اطلاعات ثبت‌شده روی سرور را روی این دستگاه بارگیری می‌کند (مناسب برای راه‌اندازی اولیه روی موبایل یا سیستم جدید).\n\n' +
      'ادامه می‌دهید؟'
    );
    if (!ok) return;

    UI.toast('در حال دریافت اطلاعات از سرور...', 'i');
    try {
      var count = await Sync.fullDownload();
      UI.toast('اطلاعات با موفقیت دریافت شد (' + count + ' رکورد).', 's');
      Settings.render();
    } catch (e) {
      UI.toast('خطا در دریافت: ' + (e && e.message ? e.message : 'نامشخص'), 'e');
    }
  },

  copyMasterKey: function() {
    var key = document.getElementById('masterKeyDisp').textContent.trim();
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(key).then(function() {
        UI.toast('کلید بازیابی در حافظه کپی شد', 's');
      });
    } else {
      UI.toast('کلید: ' + key);
    }
  },

  regenerateMasterKey: async function() {
    var ok = window.confirm('آیا مایل به تولید یک کلید بازیابی اضطراری جدید هستید؟ کلید قبلی منقضی خواهد شد.');
    if (!ok) return;
    var chars = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
    var p1 = '', p2 = '';
    for (var i = 0; i < 4; i++) p1 += chars.charAt(Math.floor(Math.random() * chars.length));
    for (var j = 0; j < 4; j++) p2 += chars.charAt(Math.floor(Math.random() * chars.length));
    var newKey = 'PB-' + p1 + '-' + p2;
    await DB.setSetting('masterRecoveryKey', newKey);
    var el = document.getElementById('masterKeyDisp');
    if (el) el.textContent = newKey;
    UI.toast('کلید جدید ذخیره شد: ' + newKey, 's');
  },

  copyMobileLink: function() {
    var cfg = Sync.getConfig();
    if (!cfg.configured) {
      UI.toast('ابتدا اطلاعات اتصال به Supabase را وارد و ذخیره کنید.', 'e');
      return;
    }
    var payload = btoa(unescape(encodeURIComponent(JSON.stringify({
      u: cfg.url,
      k: cfg.key,
      o: cfg.orgId
    }))));
    var origin = location.origin + location.pathname;
    var link = origin + '#sync-setup=' + payload;
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(link).then(function() {
        UI.toast('لینک اتصال در حافظه کپی شد! آن را به پیام‌رسان گوشی خود بفرستید و باز کنید.', 's');
      });
    } else {
      window.prompt('لینک اتصال را کپی و روی گوشی خود باز کنید:', link);
    }
  },

  showSqlHelp: function() {
    var body = '<p style="color:var(--txs);font-size:.85rem;line-height:1.8;margin-bottom:14px">' +
      'برای راه‌اندازی پایگاه داده در پروژه رایگان Supabase، کافی است فایل آماده <code>supabase/schema.sql</code> را در پنل Supabase اجرا کنید:<br>' +
      '۱. در پنل <a href="https://supabase.com" target="_blank" style="color:var(--p);text-decoration:underline">Supabase</a> وارد پروژه خود شوید.<br>' +
      '۲. از منوی سمت چپ به بخش <strong>SQL Editor</strong> بروید و روی <strong>New Query</strong> کلیک کنید.<br>' +
      '۳. محتوای فایل <code>supabase/schema.sql</code> را کپی کرده و در کادر قرار داده و دکمه <strong>Run</strong> را بزنید.<br>' +
      '۴. تمام ۱۲ جدول، شاخص‌ها و تریگرها ساخته می‌شوند و آماده همگام‌سازی می‌باشند.' +
      '</p>';
    var foot = '<button class="btn bp" onclick="UI.close()">متوجه شدم</button>';
    UI.open('راهنمای راه‌اندازی جدول‌ها در Supabase', body, foot);
  },

  exportServer: async function() {
    if (!Perm.require('backup', 'تهیه خروجی')) return;
    try {
      var data = await Sync.exportForServer();
      var b = new Blob([JSON.stringify(data, null, 2)], {
        type: 'application/json;charset=utf-8;'
      });
      var a = document.createElement('a');
      a.href = URL.createObjectURL(b);
      a.download = 'parchehban-server-export-' + Jalali.today().replace(/\//g, '-') + '.json';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(function() {
        URL.revokeObjectURL(a.href);
      }, 1000);
      UI.toast('خروجی ساخته شد.');
    } catch (e) {
      UI.toast('خطا در ساخت خروجی: ' + (e.message || ''), 'e');
    }
  },

  saveInfo: async function() {
    var nu = (elVal('setUser') || '').trim();
    var nd = (elVal('setDisp') || '').trim();
    if (!nu || nu.length < 3) {
      UI.toast('نام کاربری حداقل ۳ کاراکتر باشد', 'e');
      return;
    }
    var users = await DB.all('users');
    var user = null;
    if (STATE.userId) {
      user = users.find(function(x) { return String(x.id) === String(STATE.userId); });
    }
    if (!user && STATE.username) {
      user = users.find(function(x) { return (x.username || '').toLowerCase() === String(STATE.username).toLowerCase(); });
    }
    if (!user) user = users[0];

    if (!user) {
      UI.toast('حساب کاربری یافت نشد', 'e');
      return;
    }

    if (users.some(function(u) {
        return (u.username || '').toLowerCase() === nu.toLowerCase() && String(u.id) !== String(user.id);
      })) {
      UI.toast('این نام کاربری قبلاً استفاده شده است', 'e');
      return;
    }

    var oldUname = user.username;
    user.username = nu;
    user.displayName = nd || nu;
    user.updatedAt = new Date().toISOString();
    await DB.put('users', user);

    STATE.userId = user.id;
    STATE.username = nu;

    var prev = {};
    try {
      prev = JSON.parse(localStorage.getItem('pb_session') || '{}') || {};
    } catch (e) {}
    localStorage.setItem('pb_session', JSON.stringify({
      userId: user.id,
      username: nu,
      name: user.displayName,
      role: user.role || 'admin',
      expires: prev.expires || (Date.now() + Auth.SESSION_HOURS * 3600 * 1000)
    }));

    /* پاکسازی رکوردهای تکراری قدیمی یا اضافه که ممکن بود ساخته شوند */
    if (typeof Auth !== 'undefined' && Auth.cleanupGhostAccounts) {
      await Auth.cleanupGhostAccounts(user.id);
    }

    UI.toast('مشخصات کاربری با موفقیت به نام «' + nu + '» ذخیره شد.', 's');
  },

  changePass: async function() {
    var o = (elVal('setOld') || '').trim();
    var n = (elVal('setNew') || '').trim();
    var c = (elVal('setConf') || '').trim();
    if (!o) {
      UI.toast('رمز عبور فعلی را وارد کنید', 'e');
      return;
    }
    if (!n || n.length < 5) {
      UI.toast('رمز جدید حداقل ۵ کاراکتر باشد', 'e');
      return;
    }
    if (n !== c) {
      UI.toast('تکرار رمز با رمز جدید مطابقت ندارد', 'e');
      return;
    }
    if (n === o) {
      UI.toast('رمز جدید با رمز فعلی یکسان است', 'e');
      return;
    }
    var users = await DB.all('users');
    var user = null;
    if (STATE.userId) {
      user = users.find(function(x) { return String(x.id) === String(STATE.userId); });
    }
    if (!user && STATE.username) {
      user = users.find(function(x) { return (x.username || '').toLowerCase() === String(STATE.username).toLowerCase(); });
    }
    if (!user) user = users[0];

    if (!user) {
      UI.toast('حساب کاربری یافت نشد', 'e');
      return;
    }
    if (!await Auth.verify(user, o)) {
      UI.toast('رمز عبور فعلی اشتباه است', 'e');
      return;
    }

    user.salt = uuid();
    user.password = await Auth.hash(n, user.salt);
    user.updatedAt = new Date().toISOString();
    await DB.put('users', user);

    /* پاکسازی رکوردهای تکراری یا روح پیش‌فرض */
    if (typeof Auth !== 'undefined' && Auth.cleanupGhostAccounts) {
      await Auth.cleanupGhostAccounts(user.id);
    }

    UI.toast('رمز عبور کاربر «' + user.username + '» با موفقیت تغییر کرد و ذخیره شد.', 's');
    document.getElementById('setOld').value = '';
    document.getElementById('setNew').value = '';
    document.getElementById('setConf').value = '';
  }
};
