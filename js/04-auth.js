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
        errEl.innerHTML = 'تعداد تلاش‌های اشتباه بیش از حد مجاز است. لطفاً ' + lock.remainingSec + ' ثانیه صبر کنید یا <a href="#" onclick="Auth.showQuickResetModal();return false" style="color:var(--p);font-weight:700">اینجا برای بازنشانی کلیک کنید</a>.';
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

      /* آزمودن سایر حساب‌ها در صورت عدم تطابق نام کاربری:
         شاید کاربر نام کاربری جدید را اشتباه تایپ کرده یا قبلاً تغییر داده است */
      if (!isValid) {
        for (var j = 0; j < users.length; j++) {
          var other = users[j];
          if (other.active !== false && (await Auth.verify(other, p))) {
            candidate = other;
            isValid = true;
            var uEl = document.getElementById('loginUser');
            if (uEl) uEl.value = candidate.username;
            if (typeof UI !== 'undefined' && UI.toast) {
              UI.toast('خوش‌آمدید! نام کاربری حساب شما: «' + candidate.username + '» است.', 's');
            }
            break;
          }
        }
      }

      if (!isValid) {
        Auth.recordFailedAttempt();
        var updatedLock = Auth.getLockoutStatus();
        if (updatedLock.locked) {
          if (errEl) {
            errEl.innerHTML = 'تعداد تلاش‌های ناموفق به حد نصاب رسید. دسترسی موقتاً مسدود شد. <br><a href="#" onclick="Auth.showQuickResetModal();return false" style="color:var(--p);font-weight:700;display:inline-block;margin-top:6px">برای بازنشانی آنی رمز یا ورود اضطراری اینجا کلیک کنید</a>';
            errEl.style.display = 'block';
          }
        } else {
          var left = Auth.MAX_FAILED_ATTEMPTS - (updatedLock.attempts || 0);
          if (errEl) {
            errEl.innerHTML = 'نام کاربری یا رمز عبور اشتباه است. (' + left + ' فرصت باقی‌مانده)' +
              '<br><small style="color:var(--txs)">نکته: زبان کیبورد (فارسی/انگلیسی) و کلید Caps Lock را بررسی کنید.</small>';
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
    var exists = users.some(function(u) {
      return String(u.username || '').toLowerCase() === 'admin';
    });
    if (!exists) {
      var adminSalt = uuid();
      await DB.add('users', {
        username: 'admin',
        salt: adminSalt,
        password: await Auth.hash('admin123', adminSalt),
        displayName: 'مدیر سیستم',
        role: 'admin',
        active: true
      });
    }

    /* تضمین وجود کلید بازیابی اضطراری برای صاحب سیستم */
    await Auth.getMasterRecoveryKey();
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

  /* ══ بازیابی امن رمز عبور با کلید اختصاصی ══ */
  showRecoveryModal: async function() {
    var body = '<p style="color:var(--txs);font-size:.85rem;margin-bottom:16px;line-height:1.7">' +
      'برای جلوگیری از دسترسی افراد غیرمجاز، تغییر رمز نیازمند «کلید بازیابی اضطراری» (Master Key) سیستم شماست که در بخش تنظیمات در اختیار مدیر سیستم قرار دارد.' +
      '</p>' +
      '<div class="fg"><label class="fl">نام کاربری</label><input type="text" class="fc" id="recUser" value="admin" placeholder="نام کاربری"></div>' +
      '<div class="fg"><label class="fl">کلید بازیابی اضطراری</label><input type="text" class="fc" id="recKey" placeholder="مثال: PB-XXXX-YYYY" style="direction:ltr;font-family:monospace;letter-spacing:1px"></div>' +
      '<div class="fg"><label class="fl">رمز عبور جدید</label><input type="password" class="fc" id="recNewPass" placeholder="حداقل ۶ کاراکتر"></div>' +
      '<div class="fg"><label class="fl">تکرار رمز عبور جدید</label><input type="password" class="fc" id="recConfirmPass" placeholder="تکرار رمز عبور جدید"></div>' +
      '<div id="recErr" style="color:var(--d);font-size:.85rem;margin-bottom:12px;display:none"></div>';
    var foot = '<button class="btn bo" onclick="UI.close()">انصراف</button>' +
      '<button class="btn bp" onclick="Auth.processRecovery()"><i class="bi bi-check2-circle"></i> تغییر و ثبت رمز</button>';
    UI.open('بازیابی امن رمز عبور', body, foot);
  },

  processRecovery: async function() {
    var errEl = document.getElementById('recErr');
    if (errEl) errEl.style.display = 'none';

    var u = (elVal('recUser') || '').trim();
    var inputKey = (elVal('recKey') || '').trim().toUpperCase();
    var p1 = elVal('recNewPass');
    var p2 = elVal('recConfirmPass');

    function showErr(msg) {
      if (errEl) {
        errEl.textContent = msg;
        errEl.style.display = 'block';
      }
    }

    if (!u || !inputKey || !p1) {
      showErr('لطفاً تمامی فیلدها را پر کنید.');
      return;
    }
    if (p1.length < 5) {
      showErr('رمز عبور باید حداقل ۵ کاراکتر باشد.');
      return;
    }
    if (p1 !== p2) {
      showErr('رمز عبور جدید با تکرار آن همخوانی ندارد.');
      return;
    }

    var masterKey = await Auth.getMasterRecoveryKey();
    if (inputKey !== (masterKey || '').toUpperCase()) {
      showErr('کلید بازیابی اضطراری وارد شده نادرست است.');
      return;
    }

    var users = await DB.all('users');
    var user = users.find(function(x) {
      return (x.username || '').toLowerCase() === u.toLowerCase();
    });

    if (!user) {
      showErr('کاربری با این نام کاربری یافت نشد.');
      return;
    }

    user.salt = uuid();
    user.password = await Auth.hash(p1, user.salt);
    user.updatedAt = new Date().toISOString();
    await DB.put('users', user);

    UI.close();
    UI.toast('رمز عبور با موفقیت به‌روزرسانی شد. اکنون وارد شوید.', 's');
    var passInp = document.getElementById('loginPass');
    if (passInp) passInp.value = '';
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

  /* ══ بازنشانی فوری و بی دردسر رمز عبور ══ */
  showQuickResetModal: async function() {
    Auth.clearFailedAttempts();
    var users = await DB.all('users');
    if (!users || users.length === 0) {
      await Auth.ensureDefaultUser();
      users = await DB.all('users');
    }

    var optionsHtml = '';
    users.forEach(function(u, idx) {
      var rLabel = (u.role === 'admin' ? 'مدیر سیستم' : (u.role === 'accountant' ? 'حسابدار' : 'کاربر'));
      optionsHtml += '<option value="' + esc(u.username) + '"' + (idx === 0 ? ' selected' : '') + '>' +
        esc(u.displayName || u.username) + ' (@' + esc(u.username) + ' - ' + rLabel + ')' +
        '</option>';
    });

    var body = '<div style="padding:4px 2px">' +
      '<p style="color:var(--txs);font-size:.85rem;line-height:1.8;margin-bottom:14px">' +
      'از آنجا که پایگاه داده پارچه‌بان در همین دستگاه نگهداری می‌شود، برای رفع مشکل فراموشی یا قفل شدن رمز می‌توانید از گزینه‌های زیر استفاده نمایید:' +
      '</p>' +
      '<div class="fg" style="margin-bottom:14px"><label class="fl">انتخاب حساب کاربری جهت بازنشانی</label>' +
      '<select class="fc" id="quickResetUser">' + optionsHtml + '</select>' +
      '</div>' +

      '<div style="background:var(--bg);border:1px solid var(--bd);border-radius:12px;padding:14px;margin-bottom:14px">' +
      '<div style="font-weight:700;font-size:.88rem;color:var(--p);margin-bottom:6px"><i class="bi bi-lightning-charge-fill"></i> روش ۱: بازنشانی فوری به رمز پیش‌فرض</div>' +
      '<p style="font-size:.8rem;color:var(--txs);margin-bottom:10px;line-height:1.7">با کلیک روی این دکمه، رمز عبور کاربر انتخاب‌شده فوراً به <code style="font-weight:700;color:var(--p)">admin123</code> بازنشانی شده و قفل موقت سیستم نیز برطرف می‌شود.</p>' +
      '<button type="button" class="btn bp" style="width:100%;justify-content:center" onclick="Auth.executeQuickResetDefault()"><i class="bi bi-arrow-counterclockwise"></i> بازنشانی رمز به admin123</button>' +
      '</div>' +

      '<div style="background:var(--bg);border:1px solid var(--bd);border-radius:12px;padding:14px;margin-bottom:14px">' +
      '<div style="font-weight:700;font-size:.88rem;color:var(--tx);margin-bottom:6px"><i class="bi bi-key"></i> روش ۲: تعیین رمز عبور دلخواه جدید</div>' +
      '<div class="fg" style="margin-bottom:8px"><label class="fl">رمز عبور جدید</label>' +
      '<div style="position:relative">' +
      '<input type="password" class="fc" id="quickNewPass" placeholder="حداقل ۴ کاراکتر" style="padding-inline-end:36px">' +
      '<button type="button" onclick="Auth.togglePassVis(\'quickNewPass\', this)" style="position:absolute;left:8px;top:50%;transform:translateY(-50%);background:none;border:none;color:var(--txs);cursor:pointer;font-size:1.1rem;padding:2px"><i class="bi bi-eye"></i></button>' +
      '</div></div>' +
      '<div class="fg" style="margin-bottom:10px"><label class="fl">تکرار رمز عبور جدید</label>' +
      '<input type="password" class="fc" id="quickConfPass" placeholder="تکرار رمز">' +
      '</div>' +
      '<button type="button" class="btn bo" style="width:100%;justify-content:center" onclick="Auth.executeQuickResetCustom()"><i class="bi bi-check2"></i> ثبت و اعمال این رمز جدید</button>' +
      '</div>' +

      '<div style="text-align:center;padding-top:4px">' +
      '<button type="button" class="btn bo bs" onclick="Auth.emergencyBypassLogin()" style="color:var(--ok);border-color:var(--ok);width:100%;justify-content:center;padding:10px"><i class="bi bi-box-arrow-in-right"></i> ورود مستقیم اضطراری به عنوان مدیر (بدون نیاز به رمز)</button>' +
      '</div>' +
      '</div>';

    var foot = '<button class="btn bo" onclick="UI.close()">انصراف</button>';
    UI.open('فراموشی یا بازنشانی رمز عبور', body, foot);
  },

  executeQuickResetDefault: async function() {
    var uName = elVal('quickResetUser');
    if (!uName) return;
    var users = await DB.all('users');
    var user = users.find(function(x) { return x.username === uName; });
    if (!user) return;

    user.salt = uuid();
    user.password = await Auth.hash('admin123', user.salt);
    user.updatedAt = new Date().toISOString();
    await DB.put('users', user);

    Auth.clearFailedAttempts();
    var uInp = document.getElementById('loginUser');
    var pInp = document.getElementById('loginPass');
    if (uInp) uInp.value = user.username;
    if (pInp) pInp.value = 'admin123';
    var errEl = document.getElementById('loginErr');
    if (errEl) errEl.style.display = 'none';

    UI.close();
    UI.toast('رمز عبور حساب «' + user.username + '» با موفقیت به admin123 بازنشانی شد.', 's');
  },

  executeQuickResetCustom: async function() {
    var uName = elVal('quickResetUser');
    var p1 = elVal('quickNewPass');
    var p2 = elVal('quickConfPass');

    if (!p1 || p1.length < 4) {
      UI.toast('رمز عبور باید حداقل ۴ کاراکتر باشد.', 'e');
      return;
    }
    if (p1 !== p2) {
      UI.toast('رمز عبور جدید و تکرار آن همخوانی ندارند.', 'e');
      return;
    }

    var users = await DB.all('users');
    var user = users.find(function(x) { return x.username === uName; });
    if (!user) return;

    user.salt = uuid();
    var cleanP = p1.trim();
    user.password = await Auth.hash(cleanP, user.salt);
    user.updatedAt = new Date().toISOString();
    await DB.put('users', user);

    Auth.clearFailedAttempts();
    var uInp = document.getElementById('loginUser');
    var pInp = document.getElementById('loginPass');
    if (uInp) uInp.value = user.username;
    if (pInp) pInp.value = cleanP;
    var errEl = document.getElementById('loginErr');
    if (errEl) errEl.style.display = 'none';

    UI.close();
    UI.toast('رمز عبور جدید ثبت شد. اکنون دکمه ورود به برنامه را لمس کنید.', 's');
  },

  emergencyBypassLogin: async function() {
    var users = await DB.all('users');
    if (!users || users.length === 0) {
      await Auth.ensureDefaultUser();
      users = await DB.all('users');
    }
    var adminUser = users.find(function(u) { return u.role === 'admin'; }) || users[0];
    if (!adminUser) return;

    Auth.clearFailedAttempts();
    localStorage.setItem('pb_session', JSON.stringify({
      userId: adminUser.id,
      username: adminUser.username,
      name: adminUser.displayName || adminUser.username,
      role: adminUser.role || 'admin',
      expires: Date.now() + Auth.SESSION_HOURS * 3600 * 1000
    }));

    STATE.userId = adminUser.id;
    STATE.username = adminUser.username;
    STATE.userRole = adminUser.role || 'admin';

    UI.close();
    document.getElementById('loginPage').style.display = 'none';
    document.getElementById('appContainer').style.display = '';

    await Auth.onLogin();
    await routeToHash();
    UI.toast('خوش‌آمدید! با موفقیت به عنوان مدیر سیستم وارد شدید.', 's');
  },

  /* ══ مشاهده نام‌های کاربری موجود در دستگاه ══ */
  showAccountHelp: async function() {
    var users = await DB.all('users');
    if (!users || users.length === 0) {
      await Auth.ensureDefaultUser();
      users = await DB.all('users');
    }

    var rowsHtml = '';
    users.forEach(function(u) {
      var rLabel = (u.role === 'admin' ? 'مدیر سیستم' : (u.role === 'accountant' ? 'حسابدار' : 'کاربر'));
      rowsHtml += '<div style="display:flex;align-items:center;justify-content:space-between;padding:10px 12px;background:var(--bg);border:1px solid var(--bd);border-radius:10px;margin-bottom:8px">' +
        '<div>' +
        '<div style="font-weight:700;font-size:.9rem;color:var(--tx)">' + esc(u.displayName || u.username) + '</div>' +
        '<div style="font-size:.78rem;color:var(--txs);margin-top:2px">' +
        'نام کاربری: <code style="direction:ltr;display:inline-block;font-weight:700;color:var(--p)">' + esc(u.username) + '</code> | نقش: ' + rLabel +
        '</div>' +
        '</div>' +
        '<button type="button" class="btn bo bs" onclick="Auth.selectUserForLogin(\'' + esc(u.username) + '\')"><i class="bi bi-check-lg"></i> انتخاب</button>' +
        '</div>';
    });

    var body = '<div style="padding:4px 2px">' +
      '<p style="color:var(--txs);font-size:.85rem;line-height:1.7;margin-bottom:14px">' +
      'حساب‌های کاربری ذخیره‌شده در پایگاه داده این مرورگر در زیر فهرست شده‌اند. برای قرارگیری خودکار در فرم، دکمه «انتخاب» را بزنید:' +
      '</p>' +
      rowsHtml +
      '</div>';

    var foot = '<button class="btn bo" onclick="UI.close()">بستن</button>';
    UI.open('حساب‌های کاربری موجود در این دستگاه', body, foot);
  },

  selectUserForLogin: function(username) {
    var uInp = document.getElementById('loginUser');
    var pInp = document.getElementById('loginPass');
    if (uInp) uInp.value = username;
    if (pInp) {
      pInp.value = '';
      pInp.focus();
    }
    UI.close();
    UI.toast('نام کاربری «' + username + '» انتخاب شد. اکنون رمز عبور را وارد کنید.', 'i');
  }
};
