/* ══ SETTINGS ══ */
var Settings = {
  render: async function() {
    currentPage = 'settings';
    UI.nav('settings');
    UI.title('bi-gear-fill', 'تنظیمات');
    UI.act('');
    var user = await DB.get('users', STATE.userId);
    var h = '<div class="g2"><div class="cd"><div class="cd-h">اطلاعات کاربری</div><div class="cd-b"><div class="fg"><label>نام کاربری</label><input class="fc" id="setUser" value="' + esc(user ? user.username : '') + '"></div><div class="fg"><label>نام نمایشی</label><input class="fc" id="setDisp" value="' + esc(user ? (user.displayName || '') : '') + '"></div><button class="btn bp" onclick="Settings.saveInfo()">ذخیره</button></div></div><div class="cd"><div class="cd-h">تغییر رمز</div><div class="cd-b"><div class="fg"><label>رمز فعلی</label><input class="fc" id="setOld" type="password"></div><div class="fg"><label>رمز جدید</label><input class="fc" id="setNew" type="password"></div><div class="fg"><label>تکرار</label><input class="fc" id="setConf" type="password"></div><button class="btn bp" onclick="Settings.changePass()">تغییر رمز</button></div></div></div>';
    /* ── وضعیت آفلاین و آماده‌بودن برای همگام‌سازی ── */
    var swState = !('serviceWorker' in navigator) ?
      'مرورگر شما پشتیبانی نمی‌کند' :
      (navigator.serviceWorker.controller ? 'فعال — برنامه بدون اینترنت هم کار می‌کند' :
        'ثبت شده؛ پس از یک بار بازخوانی صفحه فعال می‌شود');
    var pending = 0;
    try {
      pending = await Sync.count();
    } catch (e) {}
    var schema = await DB.getSetting('schemaVersion', 0);

    h += '<div class="cd" style="margin-top:14px"><div class="cd-h">وضعیت برنامه</div><div class="cd-b">' +
      '<table style="width:100%;font-size:.83rem"><tbody>' +
      '<tr><td style="padding:6px 0;color:var(--txm)">نقش شما</td><td><strong>' + esc(Perm.roleLabel(Perm.role)) + '</strong></td></tr>' +
      '<tr><td style="padding:6px 0;color:var(--txm)">کارکرد بدون اینترنت</td><td>' + esc(swState) + '</td></tr>' +
      '<tr><td style="padding:6px 0;color:var(--txm)">اتصال فعلی</td><td>' + (navigator.onLine === false ? 'آفلاین' : 'آنلاین') + '</td></tr>' +
      '<tr><td style="padding:6px 0;color:var(--txm)">تغییرات در انتظار همگام‌سازی</td><td>' + UI.fn(pending) + ' مورد</td></tr>' +
      '<tr><td style="padding:6px 0;color:var(--txm)">نسخه ساختار داده</td><td>' + UI.fn(schema) + '</td></tr>' +
      '<tr><td style="padding:6px 0;color:var(--txm)">شناسه این دستگاه</td><td style="font-family:monospace;font-size:.72rem" dir="ltr">' + esc(Sync.deviceId()) + '</td></tr>' +
      '</tbody></table>' +
      '<div class="hint-box" style="margin-top:10px">همه اطلاعات فعلاً در همین مرورگر ذخیره می‌شود. ' +
      'هر تغییری که ثبت می‌کنید در یک صف داخلی هم ثبت می‌شود، تا هر وقت ذخیره‌سازی روی سرور ' +
      '(Supabase) فعال شد، هیچ سندی از دست نرود. تا آن زمان، پشتیبان‌گیری دستی را جدی بگیرید.</div>' +
      (Perm.can('*') ? '<button class="btn bo bs" style="margin-top:10px" onclick="Settings.exportServer()">' +
        '<i class="bi bi-cloud-arrow-up"></i>خروجی آماده بارگذاری روی سرور</button>' : '') +
      '</div></div>';

    UI.content(h);
  },

  /* خروجی JSON با ساختاری که مستقیم قابل بارگذاری در Supabase است */
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
      UI.toast('خروجی ساخته شد. ساختار جدول‌های مقصد در فایل supabase/schema.sql است.');
    } catch (e) {
      UI.toast('خطا در ساخت خروجی: ' + (e.message || ''), 'e');
    }
  },
  saveInfo: async function() {
    var nu = elVal('setUser').trim(),
      nd = elVal('setDisp').trim();
    if (!nu || nu.length < 3) {
      UI.toast('نام کاربری حداقل ۳ کاراکتر باشد', 'e');
      return;
    }
    var users = await DB.all('users');
    if (users.find(function(u) {
        return u.username === nu && u.id !== STATE.userId;
      })) {
      UI.toast('این نام کاربری قبلاً استفاده شده', 'e');
      return;
    }
    var user = await DB.get('users', STATE.userId);
    user.username = nu;
    user.displayName = nd || nu;
    await DB.put('users', user);
    STATE.username = nu;
    var prev = {};
    try {
      prev = JSON.parse(localStorage.getItem('pb_session') || '{}') || {};
    } catch (e) {}
    localStorage.setItem('pb_session', JSON.stringify({
      userId: user.id,
      username: nu,
      name: user.displayName,
      /* انقضای نشست حفظ می‌شود تا تغییر نام کاربری آن را بی‌نهایت نکند */
      expires: prev.expires || (Date.now() + Auth.SESSION_HOURS * 3600 * 1000)
    }));
    UI.toast('ذخیره شد');
  },
  changePass: async function() {
    var o = elVal('setOld'),
      n = elVal('setNew'),
      c = elVal('setConf');
    if (!o) {
      UI.toast('رمز فعلی را وارد کنید', 'e');
      return;
    }
    if (!n || n.length < 6) {
      UI.toast('رمز جدید حداقل ۶ کاراکتر باشد', 'e');
      return;
    }
    if (n !== c) {
      UI.toast('تکرار رمز مطابقت ندارد', 'e');
      return;
    }
    if (n === o) {
      UI.toast('رمز جدید با رمز فعلی یکی است', 'e');
      return;
    }
    var user = await DB.get('users', STATE.userId);
    if (!user || !await Auth.verify(user, o)) {
      UI.toast('رمز فعلی اشتباه است', 'e');
      return;
    }
    user.password = await Auth.hash(n);
    await DB.put('users', user);
    UI.toast('رمز تغییر کرد');
    document.getElementById('setOld').value = '';
    document.getElementById('setNew').value = '';
    document.getElementById('setConf').value = '';
  }
};
