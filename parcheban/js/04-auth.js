/* ══ AUTH ══ */
var Auth = {
  SALT: '_pb7_salt',
  SESSION_HOURS: 12, /* مدت اعتبار نشست */

  /* هش امن SHA-256 — نسخه قبلی از btoa استفاده می‌کرد که
     یک کدگذاری برگشت‌پذیر است، نه هش. */
  hash: async function(p) {
    var enc = new TextEncoder().encode(p + Auth.SALT);
    var buf = await crypto.subtle.digest('SHA-256', enc);
    return Array.from(new Uint8Array(buf)).map(function(b) {
      return b.toString(16).padStart(2, '0');
    }).join('');
  },

  /* هش قدیمی (btoa) — فقط برای اینکه کاربران فعلی بتوانند وارد شوند
     و رمزشان به‌صورت خودکار به SHA-256 ارتقا یابد. */
  legacyHash: function(p) {
    return btoa(unescape(encodeURIComponent(p + Auth.SALT)));
  },

  /* بررسی رمز با پشتیبانی از هش قدیمی + ارتقای خودکار */
  verify: async function(user, plain) {
    var h = await Auth.hash(plain);
    if (user.password === h) return true;
    if (user.password === Auth.legacyHash(plain)) {
      user.password = h; /* ارتقا به هش امن */
      try {
        await DB.put('users', user);
      } catch (e) {
        console.warn('ارتقای هش رمز ناموفق بود', e);
      }
      return true;
    }
    return false;
  },
  login: async function() {
    try {
      var errEl = document.getElementById('loginErr');
      errEl.style.display = 'none';
      if (!APP_READY) {
        errEl.textContent = 'در حال آماده‌سازی...';
        errEl.style.display = 'block';
        return;
      }
      var u = elVal('loginUser').trim();
      var p = elVal('loginPass');
      if (!u || !p) {
        errEl.textContent = 'نام کاربری و رمز را وارد کنید';
        errEl.style.display = 'block';
        return;
      }
      var users = await DB.all('users');
      var candidate = users.find(function(x) {
        return x.username === u;
      });
      var user = candidate && await Auth.verify(candidate, p) ? candidate : null;
      if (!user) {
        errEl.textContent = 'نام کاربری یا رمز اشتباه';
        errEl.style.display = 'block';
        return;
      }
      localStorage.setItem('pb_session', JSON.stringify({
        userId: user.id,
        username: user.username,
        name: user.displayName || user.username,
        expires: Date.now() + Auth.SESSION_HOURS * 3600 * 1000
      }));
      STATE.userId = user.id;
      STATE.username = user.username;
      document.getElementById('loginPage').style.display = 'none';
      document.getElementById('appContainer').style.display = '';
      await Auth.onLogin();
      await routeToHash();
    } catch (err) {
      console.error(err);
      document.getElementById('loginErr').textContent = 'خطا: ' + err.message;
      document.getElementById('loginErr').style.display = 'block';
    }
  },
  logout: function() {
    localStorage.removeItem('pb_session');
    STATE.userId = null;
    document.getElementById('loginPage').style.display = '';
    document.getElementById('appContainer').style.display = 'none';
    document.getElementById('loginPass').value = '';
    document.getElementById('loginErr').style.display = 'none';
  },
  /* نشست حالا تاریخ انقضا دارد و پس از آن باطل می‌شود */
  checkSession: function() {
    try {
      var a = localStorage.getItem('pb_session');
      if (!a) return false;
      var d = JSON.parse(a);
      if (!d || !d.userId) return false;
      if (d.expires && Date.now() > d.expires) {
        localStorage.removeItem('pb_session');
        return false;
      }
      STATE.userId = d.userId;
      STATE.username = d.username;
      return true;
    } catch (e) {
      localStorage.removeItem('pb_session');
      return false;
    }
  },
  ensureDefaultUser: async function() {
    var users = await DB.all('users');
    /* بررسی بر اساس نام کاربری، نه فقط خالی بودن جدول — تا اگر پشتیبان
       بازیابی شد یا این تابع دو بار اجرا شد، کاربر admin تکراری ساخته نشود. */
    var exists = users.some(function(u) {
      return String(u.username || '').toLowerCase() === 'admin';
    });
    if (!exists) await DB.add('users', {
      username: 'admin',
      password: await Auth.hash('admin123'),
      displayName: 'مدیر سیستم'
    });
  },
  onLogin: async function() {
    await FY.ensureDefault();
    await FY.migrate();
    if (document.body.classList.contains('dark')) setHTML('darkBtn', '<i class="bi bi-sun"></i>');
  }
};

/* بازنشانی رمز — حالا با تأیید صریح.
   نسخه قبلی بدون هیچ پرسشی همه کاربران را حذف می‌کرد. */
async function resetPass() {
  var ok = window.confirm(
    'هشدار\n\nاین کار تمام کاربران را حذف کرده و فقط کاربر admin با رمز admin123 را می‌سازد.\n' +
    'اطلاعات حسابداری (فاکتور، کالا، اشخاص) حذف نمی‌شود.\n\nادامه می‌دهید؟');
  if (!ok) return;
  try {
    await DB.clear('users');
    await DB.add('users', {
      username: 'admin',
      password: await Auth.hash('admin123'),
      displayName: 'مدیر سیستم'
    });
    alert('رمز بازنشانی شد.\nنام کاربری: admin\nرمز: admin123\n\nلطفاً بعد از ورود، رمز را از بخش تنظیمات تغییر دهید.');
  } catch (e) {
    alert('خطا در بازنشانی رمز: ' + (e.message || ''));
  }
}
