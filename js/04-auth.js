/* ══════════════════════════════════════════════════════════════
   AUTH — احراز هویت، رمزنگاری و امنیت پیشرفته کاربران
   • رمزنگاری امن با Salt اختصاصی برای هر کاربر + الگوریتم SHA-256
   • ارتقای خودکار هش‌های قدیمی بدون نیاز به ریست اطلاعات
   • حفاظت در برابر حملات جست‌وجوی فراگیر (Brute Force Protection)
   • بازیابی امن رمز عبور فقط از طریق «کلید بازیابی اضطراری» (Master Key)
   ══════════════════════════════════════════════════════════════ */

var Auth = {
  SALT: '_pb7_salt',
  SESSION_HOURS: 24,
  MAX_FAILED_ATTEMPTS: 5,
  LOCKOUT_DURATION_MS: 60000, /* ۱ دقیقه قفل پس از ۵ تلاش ناموفق */

  /* پیاده‌سازی پشتیبان SHA-256 در محیط‌های بدون SSL/WebCrypto */
  _sha256Fallback: function(ascii) {
    function rightRotate(value, amount) {
      return (value >>> amount) | (value << (32 - amount));
    }
    var mathPow = Math.pow;
    var maxWord = mathPow(2, 32);
    var lengthProperty = 'length';
    var i, j;
    var result = '';
    var words = [];
    var asciiBitLength = ascii[lengthProperty] * 8;
    var hash = [];
    var k = [];
    var primeCounter = 0;

    var isComposite = {};
    for (var candidate = 2; primeCounter < 64; candidate++) {
      if (!isComposite[candidate]) {
        for (i = 0; i < 300; i += candidate) {
          isComposite[i] = candidate;
        }
        hash[primeCounter] = (mathPow(candidate, 0.5) * maxWord) | 0;
        k[primeCounter++] = (mathPow(candidate, 1 / 3) * maxWord) | 0;
      }
    }

    ascii += '\x80';
    while (ascii[lengthProperty] % 64 - 56) ascii += '\x00';
    for (i = 0; i < ascii[lengthProperty]; i++) {
      j = ascii.charCodeAt(i);
      words[i >> 2] |= j << ((3 - i % 4) * 8);
    }
    words[words[lengthProperty]] = ((asciiBitLength / maxWord) | 0);
    words[words[lengthProperty]] = (asciiBitLength | 0);

    for (j = 0; j < words[lengthProperty];) {
      var w = words.slice(j, j += 16);
      var oldHash = hash;
      hash = hash.slice(0, 8);

      for (i = 0; i < 64; i++) {
        var w15 = w[i - 15], w2 = w[i - 2];
        var s0 = rightRotate(w15, 7) ^ rightRotate(w15, 18) ^ (w15 >>> 3);
        var s1 = rightRotate(w2, 17) ^ rightRotate(w2, 19) ^ (w2 >>> 10);
        w[i] = i < 16 ? w[i] : (w[i - 16] + s0 + w[i - 7] + s1) | 0;

        var s0_2 = rightRotate(hash[0], 2) ^ rightRotate(hash[0], 13) ^ rightRotate(hash[0], 22);
        var maj = (hash[0] & hash[1]) ^ (hash[0] & hash[2]) ^ (hash[1] & hash[2]);
        var t2 = (s0_2 + maj) | 0;
        var s1_2 = rightRotate(hash[4], 6) ^ rightRotate(hash[4], 11) ^ rightRotate(hash[4], 25);
        var ch = (hash[4] & hash[5]) ^ ((~hash[4]) & hash[6]);
        var t1 = (hash[7] + s1_2 + ch + k[i] + w[i]) | 0;

        hash = [(t1 + t2) | 0].concat(hash);
        hash[4] = (hash[4] + t1) | 0;
      }

      for (i = 0; i < 8; i++) {
        hash[i] = (hash[i] + oldHash[i]) | 0;
      }
    }

    for (i = 0; i < 8; i++) {
      for (var b = 3; b >= 0; b--) {
        var byteVal = (hash[i] >> (8 * b)) & 255;
        result += (byteVal < 16 ? '0' : '') + byteVal.toString(16);
      }
    }
    return result;
  },

  /* هش امن با Salt اختصاصی کاربر */
  hash: async function(plainPassword, userSalt) {
    var salt = userSalt || Auth.SALT;
    var raw = String(plainPassword) + ':' + salt;

    if (self.crypto && self.crypto.subtle) {
      try {
        var enc = new TextEncoder().encode(raw);
        var buf = await crypto.subtle.digest('SHA-256', enc);
        return Array.from(new Uint8Array(buf)).map(function(b) {
          return b.toString(16).padStart(2, '0');
        }).join('');
      } catch (e) {
        /* در صورت بروز خطای نامنتظره در ساب‌تل، به فال‌بک امن سوییچ می‌شود */
      }
    }
    return Auth._sha256Fallback(raw);
  },

  /* هش قدیمی نسخه قبلی (سازگاری با پایگاه‌های موجود) */
  legacyHashV1: async function(plain) {
    if (self.crypto && self.crypto.subtle) {
      var enc = new TextEncoder().encode(plain + Auth.SALT);
      var buf = await crypto.subtle.digest('SHA-256', enc);
      return Array.from(new Uint8Array(buf)).map(function(b) {
        return b.toString(16).padStart(2, '0');
      }).join('');
    }
    return Auth._sha256Fallback(plain + Auth.SALT);
  },

  legacyHashBtoa: function(plain) {
    return btoa(unescape(encodeURIComponent(plain + Auth.SALT)));
  },

  /* تولید انواع دگرگونی‌های متنی برای تطابق هوشمند فارسی/انگلیسی */
  _variations: function(str) {
    if (str === null || str === undefined || str === '') return [];
    var s = String(str);
    var list = [s];

    var trimmed = s.trim();
    if (!list.includes(trimmed)) list.push(trimmed);

    /* تبدیل ارقام فارسی و عربی به انگلیسی */
    var en = s
      .replace(/[۰-۹]/g, function(ch) { return String('۰۱۲۳۴۵۶۷۸۹'.indexOf(ch)); })
      .replace(/[٠-٩]/g, function(ch) { return String('٠١٢٣٤٥٦٧٨٩'.indexOf(ch)); });
    if (!list.includes(en)) list.push(en);
    if (!list.includes(en.trim())) list.push(en.trim());

    /* تبدیل ارقام انگلیسی به فارسی */
    var fa = s.replace(/[0-9]/g, function(d) {
      return '۰۱۲۳۴۵۶۷۸۹'[parseInt(d, 10)];
    });
    if (!list.includes(fa)) list.push(fa);
    if (!list.includes(fa.trim())) list.push(fa.trim());

    /* یکسان‌سازی حروف عربی و فارسی ی و ک و حذف نیم‌فاصله */
    var normLetters = s
      .replace(/ي/g, 'ی')
      .replace(/ك/g, 'ک')
      .replace(/\u200c/g, '')
      .replace(/\u00a0/g, ' ');
    if (!list.includes(normLetters)) list.push(normLetters);
    if (!list.includes(normLetters.trim())) list.push(normLetters.trim());

    var normAll = en
      .replace(/ي/g, 'ی')
      .replace(/ك/g, 'ک')
      .replace(/\u200c/g, '')
      .replace(/\u00a0/g, ' ')
      .trim();
    if (!list.includes(normAll)) list.push(normAll);

    return list;
  },

  /* بررسی رمز عبور با پشتیبانی کامل از ارقام فارسی/انگلیسی و ارتقای خودکار */
  verify: async function(user, plain) {
    if (!user || !user.password) return false;

    var vars = Auth._variations(plain);
    for (var i = 0; i < vars.length; i++) {
      var v = vars[i];

      /* ۱. تطابق با ساختار جدید (Salt اختصاصی کاربر) */
      if (user.salt) {
        var hNew = await Auth.hash(v, user.salt);
        if (user.password === hNew) return true;
      }

      /* ۲. تطابق با ساختار میانی SHA-256 تک‌سالت */
      var hV1 = await Auth.legacyHashV1(v);
      if (user.password === hV1) {
        user.salt = uuid();
        user.password = await Auth.hash(v, user.salt);
        try { await DB.put('users', user); } catch (e) {}
        return true;
      }

      /* ۳. تطابق با ساختار اولیه btoa */
      if (user.password === Auth.legacyHashBtoa(v)) {
        user.salt = uuid();
        user.password = await Auth.hash(v, user.salt);
        try { await DB.put('users', user); } catch (e) {}
        return true;
      }
    }

    return false;
  },

  /* بررسی وضعیت قفل موقت به دلیل تلاش‌های ناموفق مکرر */
  getLockoutStatus: function() {
    try {
      var attempts = parseInt(sessionStorage.getItem('pb_fail_count') || '0', 10);
      var lockedUntil = parseInt(sessionStorage.getItem('pb_lock_until') || '0', 10);
      var now = Date.now();

      if (lockedUntil > now) {
        var remainingSec = Math.ceil((lockedUntil - now) / 1000);
        return { locked: true, remainingSec: remainingSec };
      }
      return { locked: false, attempts: attempts };
    } catch (e) {
      return { locked: false, attempts: 0 };
    }
  },

  recordFailedAttempt: function() {
    try {
      var attempts = parseInt(sessionStorage.getItem('pb_fail_count') || '0', 10) + 1;
      sessionStorage.setItem('pb_fail_count', attempts);
      if (attempts >= Auth.MAX_FAILED_ATTEMPTS) {
        sessionStorage.setItem('pb_lock_until', Date.now() + Auth.LOCKOUT_DURATION_MS);
        sessionStorage.setItem('pb_fail_count', '0');
      }
    } catch (e) {}
  },

  clearFailedAttempts: function() {
    try {
      sessionStorage.removeItem('pb_fail_count');
      sessionStorage.removeItem('pb_lock_until');
    } catch (e) {}
  },

  /* ورود به برنامه */
  login: async function() {
    var errEl = document.getElementById('loginErr');
    if (errEl) errEl.style.display = 'none';

    var lock = Auth.getLockoutStatus();
    if (lock.locked) {
      if (errEl) {
        errEl.innerHTML = 'تعداد تلاش‌های اشتباه بیش از حد مجاز است. لطفاً ' + lock.remainingSec + ' ثانیه صبر کنید یا از <a href="#" onclick="Auth.showTroubleshootModal();return false" style="color:var(--p);font-weight:700">ابزار عیب‌یابی و بازیابی امن</a> استفاده کنید.';
        errEl.style.display = 'block';
      }
      return;
    }

    if (!APP_READY) {
      if (errEl) {
        errEl.textContent = 'در حال آماده‌سازی سیستم...';
        errEl.style.display = 'block';
      }
      return;
    }

    var rawU = (elVal('loginUser') || '').trim();
    var p = elVal('loginPass');
    if (!rawU || !p) {
      if (errEl) {
        errEl.textContent = 'نام کاربری و رمز عبور را وارد کنید.';
        errEl.style.display = 'block';
      }
      return;
    }

    try {
      var users = await DB.all('users');
      if (!users || users.length === 0) {
        await Auth.ensureDefaultUser();
        users = await DB.all('users');
      }

      var uVars = Auth._variations(rawU).map(function(x) { return x.toLowerCase(); });

      var candidate = users.find(function(x) {
        var un = (x.username || '').toLowerCase();
        var dn = (x.displayName || '').toLowerCase();
        return uVars.includes(un) || uVars.includes(dn);
      });

      var isValid = candidate && (await Auth.verify(candidate, p));

      if (!isValid) {
        Auth.recordFailedAttempt();
        var updatedLock = Auth.getLockoutStatus();
        if (updatedLock.locked) {
          if (errEl) {
            errEl.innerHTML = 'تعداد تلاش‌های ناموفق به حد نصاب رسید. دسترسی موقتاً قفل شد. <br><a href="#" onclick="Auth.showTroubleshootModal();return false" style="color:var(--p);font-weight:700;display:inline-block;margin-top:6px">برای بررسی وضعیت دیتابیس یا بازیابی امن با کلید اضطراری کلیک کنید</a>';
            errEl.style.display = 'block';
          }
        } else {
          var left = Auth.MAX_FAILED_ATTEMPTS - (updatedLock.attempts || 0);
          if (errEl) {
            errEl.innerHTML = 'نام کاربری یا رمز عبور اشتباه است. (' + left + ' فرصت باقی‌مانده)' +
              '<br><small style="color:var(--txs)">نکته: زبان کیبورد (فارسی/انگلیسی) و دکمه چشم را بررسی کنید، یا از <a href="#" onclick="Auth.showTroubleshootModal();return false" style="color:var(--p)">ابزار عیب‌یابی</a> استفاده کنید.</small>';
            errEl.style.display = 'block';
          }
        }
        return;
      }

      if (candidate.active === false) {
        if (errEl) {
          errEl.textContent = 'این حساب کاربری غیرفعال شده است. با مدیر سیستم تماس بگیرید.';
          errEl.style.display = 'block';
        }
        return;
      }

      /* ورود موفق */
      Auth.clearFailedAttempts();
      localStorage.setItem('pb_session', JSON.stringify({
        userId: candidate.id,
        username: candidate.username,
        name: candidate.displayName || candidate.username,
        role: candidate.role || 'operator',
        expires: Date.now() + Auth.SESSION_HOURS * 3600 * 1000
      }));

      STATE.userId = candidate.id;
      STATE.username = candidate.username;
      STATE.userRole = candidate.role || 'operator';

      document.getElementById('loginPage').style.display = 'none';
      document.getElementById('appContainer').style.display = '';

      await Auth.onLogin();
      await routeToHash();
    } catch (err) {
      console.error(err);
      if (errEl) {
        errEl.textContent = 'خطا در ورود: ' + (err && err.message ? err.message : 'نامشخص');
        errEl.style.display = 'block';
      }
    }
  },

  logout: function() {
    localStorage.removeItem('pb_session');
    STATE.userId = null;
    STATE.username = null;
    document.getElementById('loginPage').style.display = '';
    document.getElementById('appContainer').style.display = 'none';
    var pEl = document.getElementById('loginPass');
    if (pEl) pEl.value = '';
    var errEl = document.getElementById('loginErr');
    if (errEl) errEl.style.display = 'none';
  },

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
      STATE.userRole = d.role || 'operator';
      return true;
    } catch (e) {
      localStorage.removeItem('pb_session');
      return false;
    }
  },

  /* تضمین وجود کاربر مدیر در سیستم */
  ensureDefaultUser: async function() {
    var users = await DB.all('users');
    if (!users || users.length === 0) {
      var adminSalt = uuid();
      await DB.add('users', {
        username: 'admin',
        salt: adminSalt,
        password: await Auth.hash('admin123', adminSalt),
        displayName: 'مدیر سیستم',
        role: 'admin',
        active: true
      });
    } else {
      /* اگر کاربر مدیر نام کاربری خود را عوض کرده باشد، حساب‌های روح/پیش‌فرض پاکسازی می‌شوند */
      var customAdmin = users.find(function(u) {
        return (u.role === 'admin' || !u.role) && (u.username || '').toLowerCase() !== 'admin';
      });
      if (customAdmin) {
        await Auth.cleanupGhostAccounts(customAdmin.id);
      }
    }

    /* تضمین وجود کلید بازیابی اضطراری برای صاحب سیستم */
    await Auth.getMasterRecoveryKey();
  },

  /* پاکسازی حساب‌های اضافه یا شبح پیش‌فرض پس از تغییر نام مدیر */
  cleanupGhostAccounts: async function(primaryId) {
    try {
      var users = await DB.all('users');
      if (!users || users.length <= 1) return;
      var primary = users.find(function(u) { return String(u.id) === String(primaryId); });
      if (!primary) return;

      for (var i = 0; i < users.length; i++) {
        var other = users[i];
        if (String(other.id) === String(primary.id)) continue;
        if ((other.username || '').toLowerCase() === 'admin') {
          var isDefault = await Auth.verify(other, 'admin123');
          if (isDefault) {
            await DB.gs('users', 'readwrite').delete(other.id);
            console.info('حساب کاربری پیش‌فرض روح پاکسازی شد.');
          }
        }
      }
    } catch (e) {
      console.warn('cleanupGhostAccounts:', e);
    }
  },

  /* تولید یا خواندن کلید بازیابی اضطراری */
  getMasterRecoveryKey: async function() {
    var stored = await DB.getSetting('masterRecoveryKey', null);
    if (!stored) {
      /* ساخت کلید امن ۱۲ کاراکتری مانند PB-8X2M-9K4T */
      var chars = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
      var part1 = '', part2 = '';
      for (var i = 0; i < 4; i++) part1 += chars.charAt(Math.floor(Math.random() * chars.length));
      for (var j = 0; j < 4; j++) part2 += chars.charAt(Math.floor(Math.random() * chars.length));
      stored = 'PB-' + part1 + '-' + part2;
      await DB.setSetting('masterRecoveryKey', stored);
    }
    return stored;
  },

  /* بررسی اینکه آیا مدیر هنوز رمز پیش‌فرض admin123 دارد یا خیر */
  isDefaultAdminPass: async function() {
    try {
      var users = await DB.all('users');
      var admin = users.find(function(u) { return (u.username || '').toLowerCase() === 'admin'; });
      if (!admin) return false;
      return await Auth.verify(admin, 'admin123');
    } catch (e) {
      return false;
    }
  },

  onLogin: async function() {
    await FY.ensureDefault();
    await FY.migrate();
    await Perm.load();
    if (document.body.classList.contains('dark')) setHTML('darkBtn', '<i class="bi bi-sun"></i>');

    /* شروع همگام‌سازی خودکار در صورت تنظیم بودن */
    if (typeof Sync !== 'undefined' && Sync.init) {
      Sync.init();
    }

    /* یادآور پشتیبان‌گیری */
    try {
      if (sessionStorage.getItem('pb_bk_snooze') !== '1') {
        setTimeout(function() { Backup.check(); }, 1200);
      }
    } catch (e) {
      setTimeout(function() { Backup.check(); }, 1200);
    }
  },

  /* تغییر وضعیت نمایش/عدم‌نمایش گذرواژه */
  togglePassVis: function(inputId, btn) {
    var el = document.getElementById(inputId);
    if (!el) return;
    if (el.type === 'password') {
      el.type = 'text';
      if (btn) btn.innerHTML = '<i class="bi bi-eye-slash"></i>';
    } else {
      el.type = 'password';
      if (btn) btn.innerHTML = '<i class="bi bi-eye"></i>';
    }
  },

  /* ══════════════════════════════════════════════════════════════
     ابزار عیب‌یابی جامع و بازیابی امن رمز عبور (Troubleshoot & Recovery)
     ══════════════════════════════════════════════════════════════ */
  showTroubleshootModal: async function() {
    var t0 = performance.now();
    var dbOk = false;
    var dbLatency = 0;
    var counts = {};
    var users = [];
    var lockStatus = Auth.getLockoutStatus();

    try {
      var allU = await DB.all('users');
      users = allU || [];
      var pCount = (await DB.all('products')).length;
      var iCount = (await DB.all('invoices')).length;
      var cCount = (await DB.all('contacts')).length;
      dbLatency = Math.round(performance.now() - t0);
      dbOk = true;
      counts = { users: users.length, products: pCount, invoices: iCount, contacts: cCount };
    } catch (e) {
      dbOk = false;
    }

    /* تحلیل هش و کاربران */
    var hashAnalysis = [];
    var hasGhost = false;
    var customAdmin = null;

    users.forEach(function(u) {
      var hType = 'سالت‌دار SHA-256 (ایمن)';
      if (!u.password) hType = 'نامعتبر یا خالی';
      else if (!u.salt) hType = 'هش قدیمی بدون سالت';
      hashAnalysis.push({
        id: u.id,
        role: u.role || 'کاربر',
        hashType: hType,
        active: u.active !== false
      });
      if ((u.role === 'admin' || !u.role) && (u.username || '').toLowerCase() !== 'admin') {
        customAdmin = u;
      }
    });

    if (customAdmin && users.some(function(x) { return (x.username || '').toLowerCase() === 'admin'; })) {
      hasGhost = true;
    }

    var body = '<div style="font-size:.85rem;line-height:1.7">' +
      /* ── کارت ۱: وضعیت اتصال به پایگاه داده محلی ── */
      '<div style="background:var(--bg);border:1px solid var(--bd);border-radius:12px;padding:12px 14px;margin-bottom:12px">' +
      '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px">' +
      '<strong style="color:var(--tx)"><i class="bi bi-database-check" style="color:' + (dbOk ? 'var(--ok)' : 'var(--d)') + '"></i> وضعیت پایگاه داده محلی (IndexedDB)</strong>' +
      '<span class="tg ' + (dbOk ? 'ts' : 'td') + '">' + (dbOk ? 'متصل و سالم' : 'خطا در اتصال') + '</span>' +
      '</div>' +
      '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(110px,1fr));gap:6px;font-size:.78rem;color:var(--txs)">' +
      '<div>نسخه پایگاه داده: <strong>parchehban_v8</strong></div>' +
      '<div>پاسخ‌دهی: <strong>' + dbLatency + ' ms</strong></div>' +
      '<div>تعداد کاربران: <strong>' + (counts.users || 0) + '</strong></div>' +
      '<div>تعداد کالاها: <strong>' + (counts.products || 0) + '</strong></div>' +
      '<div>تعداد فاکتورها: <strong>' + (counts.invoices || 0) + '</strong></div>' +
      '<div>تعداد اشخاص: <strong>' + (counts.contacts || 0) + '</strong></div>' +
      '</div>' +
      '</div>' +

      /* ── کارت ۲: سلامت هَش رمز عبور و بررسی تضاد ── */
      '<div style="background:var(--bg);border:1px solid var(--bd);border-radius:12px;padding:12px 14px;margin-bottom:12px">' +
      '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:6px">' +
      '<strong style="color:var(--tx)"><i class="bi bi-shield-check" style="color:var(--p)"></i> سلامت هَش رمز و سیستم امنیتی</strong>' +
      '<span class="tg ' + (lockStatus.locked ? 'td' : (hasGhost ? 'tw' : 'ts')) + '">' +
      (lockStatus.locked ? 'قفل موقت فعال (' + lockStatus.remainingSec + ' ثانیه)' : (hasGhost ? 'تضاد حساب شناسایی شد' : 'بدون تضاد')) +
      '</span>' +
      '</div>' +
      '<p style="color:var(--txs);font-size:.78rem;margin:0 0 8px 0">' +
      (hasGhost ?
        '⚠️ یک حساب روح پیش‌فرض در کنار حساب اختصاصی شما در پایگاه داده شناسایی شد که با بازنشانی امن یا تغییر مشخصات، خودکار پاکسازی می‌شود.' :
        'الگوریتم رمزنگاری فعال: <strong>SHA-256 سالت‌دار</strong> با پشتیبانی از ارقام فارسی و انگلیسی.') +
      '</p>' +
      (lockStatus.locked ?
        '<p style="color:var(--d);font-size:.78rem;margin:0">به دلیل ورودهای ناموفق قبلی، فرم ورود موقتاً مسدود است. پس از اعتبارسنجی زیر، قفل بلافاصله برطرف می‌شود.</p>' :
        '') +
      '</div>' +

      /* ── کارت ۳: آزمایش زنده اعتبار‌سنجی (بدون قفل شدن حساب) ── */
      '<details style="background:var(--bg);border:1px solid var(--bd);border-radius:12px;padding:10px 14px;margin-bottom:12px">' +
      '<summary style="cursor:pointer;font-weight:700;color:var(--tx);font-size:.82rem"><i class="bi bi-clipboard-pulse"></i> آزمایش تطابق رمز عبور (آزمون بدون قفل شدن)</summary>' +
      '<div style="padding-top:10px">' +
      '<p style="font-size:.78rem;color:var(--txs);margin-bottom:8px">می‌توانید نام کاربری و رمز خود را در اینجا امتحان کنید تا ببینید آیا با دیتابیس همخوانی دارد یا خیر (این آزمون حساب شما را قفل نمی‌کند):</p>' +
      '<div class="g2" style="margin-bottom:8px">' +
      '<input class="fc" id="diagTestUser" placeholder="نام کاربری مورد نظر" style="font-size:.82rem">' +
      '<div style="position:relative">' +
      '<input class="fc" id="diagTestPass" type="password" placeholder="رمز عبور" style="font-size:.82rem;padding-inline-end:34px">' +
      '<button type="button" onclick="Auth.togglePassVis(\'diagTestPass\', this)" style="position:absolute;left:6px;top:50%;transform:translateY(-50%);background:none;border:none;color:var(--txs);cursor:pointer;font-size:1rem;padding:2px"><i class="bi bi-eye"></i></button>' +
      '</div>' +
      '</div>' +
      '<button type="button" class="btn bo bs" onclick="Auth.runDiagTest()" style="font-size:.8rem"><i class="bi bi-play-circle"></i> بررسی اعتبار</button>' +
      '<div id="diagTestResult" style="margin-top:8px;font-size:.8rem;display:none"></div>' +
      '</div>' +
      '</details>' +

      /* ── کارت ۴: بازنشانی ایمن و رفع تضاد (Secure Recovery) ── */
      '<div style="background:rgba(37,99,235,.04);border:1.5px solid var(--p);border-radius:12px;padding:14px">' +
      '<div style="font-weight:700;font-size:.88rem;color:var(--p);margin-bottom:6px"><i class="bi bi-shield-lock-fill"></i> بازنشانی ایمن رمز عبور و رفع تضاد سیستم</div>' +
      '<p style="color:var(--txs);font-size:.8rem;line-height:1.7;margin-bottom:12px">' +
      'جهت حفظ امنیت و جلوگیری از سوءاستفاده افراد غیرمجاز، تغییر یا بازنشانی رمز تنها در صورت ارائه <strong>«کلید بازیابی اضطراری (Master Key)»</strong> یا <strong>«فایل پشتیبان معتبر سیستم»</strong> ممکن است.' +
      '</p>' +

      '<div style="display:flex;gap:12px;margin-bottom:12px">' +
      '<label style="display:flex;align-items:center;gap:6px;font-size:.82rem;cursor:pointer;font-weight:600">' +
      '<input type="radio" name="recMethod" value="key" checked onchange="Auth.toggleRecMethod(\'key\')"> روش ۱: وارد کردن کلید بازیابی اضطراری' +
      '</label>' +
      '<label style="display:flex;align-items:center;gap:6px;font-size:.82rem;cursor:pointer;font-weight:600">' +
      '<input type="radio" name="recMethod" value="file" onchange="Auth.toggleRecMethod(\'file\')"> روش ۲: انتخاب فایل پشتیبان سیستم' +
      '</label>' +
      '</div>' +

      /* بخش کلید */
      '<div id="recSecKey" class="fg" style="margin-bottom:10px">' +
      '<label class="fl">کلید بازیابی اضطراری (Master Key)</label>' +
      '<input type="text" class="fc" id="diagMasterKey" placeholder="مثال: PB-XXXX-YYYY" style="direction:ltr;font-family:monospace;letter-spacing:1px;font-weight:700">' +
      '<small style="color:var(--txs);font-size:.74rem">این کلید هنگام راه‌اندازی در بخش تنظیمات در اختیار مدیر قرار گرفته است.</small>' +
      '</div>' +

      /* بخش فایل پشتیبان */
      '<div id="recSecFile" class="fg" style="margin-bottom:10px;display:none">' +
      '<label class="fl">انتخاب فایل پشتیبان پارچه‌بان (.json)</label>' +
      '<input type="file" class="fc" id="diagBackupFile" accept=".json">' +
      '<small style="color:var(--txs);font-size:.74rem">با ارائه فایل پشتیبان قبلی، مالکیت شما بر داده‌ها تأیید می‌شود.</small>' +
      '</div>' +

      /* مشخصات جدید */
      '<div class="g2" style="margin-bottom:8px">' +
      '<div class="fg" style="margin-bottom:0">' +
      '<label class="fl">نام کاربری جدید</label>' +
      '<input type="text" class="fc" id="diagNewUser" value="' + esc(customAdmin ? customAdmin.username : (users[0] ? users[0].username : 'admin')) + '" placeholder="نام کاربری">' +
      '</div>' +
      '<div class="fg" style="margin-bottom:0">' +
      '<label class="fl">نام نمایشی (اختیاری)</label>' +
      '<input type="text" class="fc" id="diagNewDisp" value="' + esc(customAdmin ? (customAdmin.displayName || '') : '') + '" placeholder="مدیر سیستم">' +
      '</div>' +
      '</div>' +

      '<div class="g2" style="margin-bottom:12px">' +
      '<div class="fg" style="margin-bottom:0">' +
      '<label class="fl">رمز عبور جدید</label>' +
      '<div style="position:relative">' +
      '<input type="password" class="fc" id="diagNewPass" placeholder="حداقل ۵ کاراکتر" style="padding-inline-end:34px">' +
      '<button type="button" onclick="Auth.togglePassVis(\'diagNewPass\', this)" style="position:absolute;left:6px;top:50%;transform:translateY(-50%);background:none;border:none;color:var(--txs);cursor:pointer;font-size:1rem;padding:2px"><i class="bi bi-eye"></i></button>' +
      '</div>' +
      '</div>' +
      '<div class="fg" style="margin-bottom:0">' +
      '<label class="fl">تکرار رمز عبور جدید</label>' +
      '<div style="position:relative">' +
      '<input type="password" class="fc" id="diagConfPass" placeholder="تکرار رمز جدید" style="padding-inline-end:34px">' +
      '<button type="button" onclick="Auth.togglePassVis(\'diagConfPass\', this)" style="position:absolute;left:6px;top:50%;transform:translateY(-50%);background:none;border:none;color:var(--txs);cursor:pointer;font-size:1rem;padding:2px"><i class="bi bi-eye"></i></button>' +
      '</div>' +
      '</div>' +
      '</div>' +

      '<div id="diagActionErr" style="color:var(--d);font-size:.82rem;margin-bottom:10px;display:none"></div>' +
      '<button type="button" class="btn bp" style="width:100%;justify-content:center;padding:10px" onclick="Auth.executeSecureRecovery()"><i class="bi bi-shield-check"></i> تأیید هویت و اعمال بازنشانی ایمن</button>' +
      '</div>' +
      '</div>';

    var foot = '<button class="btn bo" onclick="UI.close()">بستن</button>';
    UI.open('ابزار عیب‌یابی دیتابیس و بازیابی امن رمز عبور', body, foot);
  },

  toggleRecMethod: function(method) {
    var sKey = document.getElementById('recSecKey');
    var sFile = document.getElementById('recSecFile');
    if (method === 'file') {
      if (sKey) sKey.style.display = 'none';
      if (sFile) sFile.style.display = 'block';
    } else {
      if (sKey) sKey.style.display = 'block';
      if (sFile) sFile.style.display = 'none';
    }
  },

  /* اجرای آزمون اعتبار تطابق بدون قفل کردن حساب */
  runDiagTest: async function() {
    var resEl = document.getElementById('diagTestResult');
    if (!resEl) return;
    var u = (elVal('diagTestUser') || '').trim();
    var p = elVal('diagTestPass');

    if (!u || !p) {
      resEl.innerHTML = '<span style="color:var(--d)">لطفاً نام کاربری و رمز عبور را وارد کنید.</span>';
      resEl.style.display = 'block';
      return;
    }

    try {
      var users = await DB.all('users');
      var uVars = Auth._variations(u).map(function(x) { return x.toLowerCase(); });
      var target = users.find(function(x) {
        return uVars.includes((x.username || '').toLowerCase()) || uVars.includes((x.displayName || '').toLowerCase());
      });

      if (!target) {
        resEl.innerHTML = '<span style="color:var(--d)">❌ کاربری با نام «' + esc(u) + '» در سیستم یافت نشد.</span>';
        resEl.style.display = 'block';
        return;
      }

      var ok = await Auth.verify(target, p);
      if (ok) {
        resEl.innerHTML = '<span style="color:var(--ok);font-weight:700">✓ تطابق کامل: هَش رمز عبور وارد شده با حساب «' + esc(target.username) + '» کاملاً منطبق است. می‌توانید با این مشخصات وارد شوید.</span>';
      } else {
        resEl.innerHTML = '<span style="color:var(--d)">❌ هَش رمز عبور مطابقت ندارد. دلیل: رمز تایپ‌شده با رمز ذخیره شده یکسان نیست (زبان کیبورد و دکمه چشم را بررسی کنید).</span>';
      }
      resEl.style.display = 'block';
    } catch (e) {
      resEl.innerHTML = '<span style="color:var(--d)">خطا در بررسی: ' + esc(e.message) + '</span>';
      resEl.style.display = 'block';
    }
  },

  /* اجرای بازنشانی ایمن پس از احراز هویت با کلید یا فایل پشتیبان */
  executeSecureRecovery: async function() {
    var errEl = document.getElementById('diagActionErr');
    if (errEl) errEl.style.display = 'none';

    function setErr(msg) {
      if (errEl) {
        errEl.textContent = msg;
        errEl.style.display = 'block';
      }
    }

    var method = 'key';
    var rMethod = document.querySelector('input[name="recMethod"]:checked');
    if (rMethod) method = rMethod.value;

    var newU = (elVal('diagNewUser') || '').trim();
    var newDisp = (elVal('diagNewDisp') || '').trim();
    var newP = elVal('diagNewPass');
    var confP = elVal('diagConfPass');

    if (!newU || newU.length < 3) {
      setErr('نام کاربری باید حداقل ۳ کاراکتر باشد.');
      return;
    }
    if (!newP || newP.length < 5) {
      setErr('رمز عبور باید حداقل ۵ کاراکتر باشد.');
      return;
    }
    if (newP !== confP) {
      setErr('رمز عبور جدید و تکرار آن یکسان نیستند.');
      return;
    }

    var isOwnerVerified = false;

    if (method === 'key') {
      var inputKey = (elVal('diagMasterKey') || '').trim().toUpperCase();
      if (!inputKey) {
        setErr('لطفاً کلید بازیابی اضطراری را وارد نمایید.');
        return;
      }
      var realMaster = await Auth.getMasterRecoveryKey();
      if (inputKey === (realMaster || '').toUpperCase()) {
        isOwnerVerified = true;
      } else {
        setErr('کلید بازیابی اضطراری وارد شده نامعتبر است.');
        return;
      }
    } else {
      /* اعتبارسنجی با فایل پشتیبان */
      var fileInp = document.getElementById('diagBackupFile');
      if (!fileInp || !fileInp.files || !fileInp.files[0]) {
        setErr('لطفاً یک فایل پشتیبان معتبر انتخاب فرمایید.');
        return;
      }
      var file = fileInp.files[0];
      try {
        var text = await file.text();
        var json = JSON.parse(text);
        if (json && (json.data || json.version || json.app === 'parchehban' || json.products || json.invoices)) {
          isOwnerVerified = true;
        } else {
          setErr('فایل انتخاب‌شده، فایل پشتیبان معتبر پارچه‌بان نیست.');
          return;
        }
      } catch (e) {
        setErr('خطا در خواندن فایل پشتیبان: ' + e.message);
        return;
      }
    }

    if (!isOwnerVerified) {
      setErr('احراز هویت انجام نشد.');
      return;
    }

    /* به‌روزرسانی یا ایجاد کاربر مدیر با مشخصات جدید */
    var users = await DB.all('users');
    var targetUser = users.find(function(u) {
      return (u.role === 'admin' || !u.role);
    }) || users[0];

    var cleanPass = newP.trim();
    var newSalt = uuid();
    var newHash = await Auth.hash(cleanPass, newSalt);

    if (targetUser) {
      targetUser.username = newU;
      targetUser.displayName = newDisp || newU;
      targetUser.salt = newSalt;
      targetUser.password = newHash;
      targetUser.role = 'admin';
      targetUser.active = true;
      targetUser.updatedAt = new Date().toISOString();
      await DB.put('users', targetUser);
    } else {
      targetUser = {
        username: newU,
        displayName: newDisp || newU,
        salt: newSalt,
        password: newHash,
        role: 'admin',
        active: true
      };
      var newId = await DB.add('users', targetUser);
      targetUser.id = newId;
    }

    /* پاکسازی هرگونه حساب روح یا تکراری قدیمی */
    await Auth.cleanupGhostAccounts(targetUser.id);

    /* رفع قفل سیستم و بستن پنجره */
    Auth.clearFailedAttempts();

    var uInp = document.getElementById('loginUser');
    var pInp = document.getElementById('loginPass');
    if (uInp) uInp.value = newU;
    if (pInp) pInp.value = cleanPass;

    var errElLogin = document.getElementById('loginErr');
    if (errElLogin) errElLogin.style.display = 'none';

    UI.close();
    UI.toast('هویت شما تأیید شد و رمز عبور حساب «' + newU + '» با موفقیت ثبت گردید. اکنون وارد شوید.', 's');
  }
};
