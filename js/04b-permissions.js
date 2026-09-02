/* ══ PERMISSIONS ══
   سیستم چندکاربره با سطوح دسترسی.

   چهار نقش تعریف شده است:
     admin      مدیر        — همه چیز، شامل مدیریت کاربران و پشتیبان‌گیری
     accountant حسابدار     — ثبت و ویرایش همه اسناد، بدون مدیریت کاربران
     operator   کاربر ثبت   — فقط ثبت فاکتور و سند؛ حذف و بستن سال ممنوع
     viewer     فقط مشاهده  — هیچ تغییری نمی‌تواند بدهد

   نکته امنیتی: این لایه، محدودیت رابط کاربری است نه امنیت سرور.
   چون فعلاً تمام داده در مرورگر خود کاربر است، کسی که به دستگاه
   دسترسی دارد می‌تواند از راه ابزار توسعه‌دهنده دورش بزند. امنیت
   واقعی بعد از انتقال به Supabase و اعمال Row Level Security به دست
   می‌آید (بخش «مسیر انتقال به سرور» در README). */
var Perm = {

  ROLES: {
    admin: {
      label: 'مدیر',
      desc: 'دسترسی کامل به همه بخش‌ها، مدیریت کاربران و پشتیبان‌گیری'
    },
    accountant: {
      label: 'حسابدار',
      desc: 'ثبت، ویرایش و حذف اسناد و گزارش‌ها؛ بدون مدیریت کاربران'
    },
    operator: {
      label: 'کاربر ثبت',
      desc: 'ثبت و ویرایش فاکتور و سند؛ بدون حذف و بدون بستن سال مالی'
    },
    viewer: {
      label: 'فقط مشاهده',
      desc: 'فقط دیدن اطلاعات و گزارش‌ها؛ هیچ تغییری امکان‌پذیر نیست'
    }
  },

  /* توانایی‌های هر نقش. '*' یعنی همه چیز. */
  ABILITIES: {
    admin: ['*'],
    accountant: ['view', 'create', 'edit', 'delete', 'reports', 'backup', 'closeYear', 'manageBaseData'],
    operator: ['view', 'create', 'edit', 'reports', 'manageBaseData'],
    viewer: ['view', 'reports']
  },

  /* کدام صفحه‌ها برای هر نقش دیده می‌شوند */
  HIDDEN_PAGES: {
    admin: [],
    accountant: ['users'],
    operator: ['users', 'years'],
    viewer: ['users', 'years']
  },

  role: 'admin',

  /* بارگذاری نقش کاربر وارد‌شده */
  load: async function() {
    Perm.role = 'admin';
    if (!STATE.userId) return Perm.role;
    var u = await DB.get('users', STATE.userId);
    if (u && u.role && Perm.ROLES[u.role]) Perm.role = u.role;
    Perm.applyToNav();
    return Perm.role;
  },

  /* آیا کاربر جاری اجازه این کار را دارد؟ */
  can: function(ability) {
    var list = Perm.ABILITIES[Perm.role] || [];
    return list.indexOf('*') > -1 || list.indexOf(ability) > -1;
  },

  /* نگهبان: اگر اجازه نداشت پیام می‌دهد و false برمی‌گرداند */
  require: function(ability, what) {
    if (Perm.can(ability)) return true;
    var rl = (Perm.ROLES[Perm.role] || {}).label || Perm.role;
    UI.toast('نقش شما «' + rl + '» است و اجازه ' + (what || 'این کار') + ' را ندارید.', 'e');
    return false;
  },

  roleLabel: function(role) {
    return (Perm.ROLES[role] || {}).label || role || '—';
  },

  /* مخفی کردن آیتم‌های منو بر اساس نقش */
  applyToNav: function() {
    var hidden = Perm.HIDDEN_PAGES[Perm.role] || [];
    document.querySelectorAll('.ni[data-page]').forEach(function(a) {
      var pg = a.getAttribute('data-page');
      a.style.display = hidden.indexOf(pg) > -1 ? 'none' : '';
    });
    /* نمایش نقش کنار نام کاربر */
    var badge = document.getElementById('roleBadge');
    if (badge) badge.textContent = Perm.roleLabel(Perm.role);
  },

  /* نگهبان ورود به صفحه — در ROUTES استفاده می‌شود */
  guardPage: function(page) {
    var hidden = Perm.HIDDEN_PAGES[Perm.role] || [];
    if (hidden.indexOf(page) > -1) {
      UI.toast('دسترسی شما به این صفحه محدود شده است.', 'e');
      return false;
    }
    return true;
  }
};

/* ══ مدیریت کاربران (فقط مدیر) ══ */
var Users = {
  render: async function() {
    currentPage = 'users';
    UI.nav('users');
    UI.title('bi-people', 'کاربران و سطوح دسترسی');
    if (!Perm.can('*')) {
      UI.content('<div class="cd"><div class="em"><i class="bi bi-shield-lock"></i>' +
        '<p>فقط کاربران با نقش «مدیر» می‌توانند کاربران را مدیریت کنند.</p></div></div>');
      UI.act('');
      return;
    }
    UI.act('<button class="btn bp" onclick="Users.form()"><i class="bi bi-plus-lg"></i>کاربر جدید</button>');
    var us = await DB.all('users');
    var r = '';
    for (var i = 0; i < us.length; i++) {
      var u = us[i];
      var isMe = u.id === STATE.userId;
      var st = u.active === false ?
        '<span class="tg tg-r">غیرفعال</span>' :
        '<span class="tg tg-g">فعال</span>';
      r += '<tr><td>' + (i + 1) + '</td>' +
        '<td><strong>' + esc(u.username) + '</strong>' + (isMe ? ' <span class="tg tg-b">شما</span>' : '') + '</td>' +
        '<td>' + esc(u.displayName || '—') + '</td>' +
        '<td>' + esc(Perm.roleLabel(u.role || 'admin')) + '</td>' +
        '<td>' + st + '</td>' +
        '<td style="white-space:nowrap">' +
        '<button class="bi2" title="ویرایش" onclick="Users.form(' + u.id + ')"><i class="bi bi-pencil"></i></button> ' +
        (isMe ? '' : '<button class="bi2 d" title="حذف" onclick="Users.rm(' + u.id + ')"><i class="bi bi-trash3"></i></button>') +
        '</td></tr>';
    }
    var roleHelp = Object.keys(Perm.ROLES).map(function(k) {
      return '<li><strong>' + esc(Perm.ROLES[k].label) + ':</strong> ' + esc(Perm.ROLES[k].desc) + '</li>';
    }).join('');
    UI.content('<div class="cd"><div class="cd-h">کاربران</div>' +
      '<div class="tw"><table><thead><tr><th>#</th><th>نام کاربری</th><th>نام نمایشی</th>' +
      '<th>نقش</th><th>وضعیت</th><th>عملیات</th></tr></thead><tbody>' + r + '</tbody></table></div></div>' +
      '<div class="cd" style="margin-top:14px"><div class="cd-h">راهنمای نقش‌ها</div>' +
      '<div style="padding:12px"><ul style="margin:0 18px;padding:0;line-height:1.9;font-size:.85rem">' +
      roleHelp + '</ul>' +
      '<div class="hint-box" style="margin-top:10px">این سطوح دسترسی محدودیت رابط کاربری هستند. ' +
      'چون فعلاً همه اطلاعات در همین مرورگر ذخیره می‌شود، امنیت کامل بعد از انتقال به سرور ' +
      '(Supabase) و فعال‌کردن Row Level Security به دست می‌آید.</div></div></div>');
  },

  form: async function(id) {
    if (!Perm.can('*')) return;
    var u = id ? await DB.get('users', id) : null;
    var ro = Object.keys(Perm.ROLES).map(function(k) {
      var sel = (u ? (u.role || 'admin') : 'operator') === k ? ' selected' : '';
      return '<option value="' + k + '"' + sel + '>' + esc(Perm.ROLES[k].label) + '</option>';
    }).join('');
    UI.open(u ? 'ویرایش کاربر' : 'کاربر جدید',
      '<div class="fr"><div class="fg"><label>نام کاربری</label>' +
      '<input class="fc" id="uUn" value="' + esc(u ? u.username : '') + '" dir="ltr" autocomplete="off"></div>' +
      '<div class="fg"><label>نام نمایشی</label>' +
      '<input class="fc" id="uDn" value="' + esc(u ? (u.displayName || '') : '') + '"></div></div>' +
      '<div class="fr"><div class="fg"><label>نقش</label><select class="fc" id="uRl">' + ro + '</select></div>' +
      '<div class="fg"><label>وضعیت</label><select class="fc" id="uAc">' +
      '<option value="1"' + (!u || u.active !== false ? ' selected' : '') + '>فعال</option>' +
      '<option value="0"' + (u && u.active === false ? ' selected' : '') + '>غیرفعال</option>' +
      '</select></div></div>' +
      '<div class="fg"><label>رمز عبور' + (u ? ' (خالی بگذارید تا تغییر نکند)' : '') + '</label>' +
      '<input class="fc" id="uPw" type="password" dir="ltr" autocomplete="new-password"></div>' +
      '<div class="fg"><label>تکرار رمز عبور</label>' +
      '<input class="fc" id="uPw2" type="password" dir="ltr" autocomplete="new-password"></div>' +
      '<div class="hint-box">کاربر غیرفعال نمی‌تواند وارد برنامه شود ولی اسناد ثبت‌شده‌اش دست‌نخورده می‌ماند.</div>',
      '<button class="btn bp" onclick="Users.save(' + (id || 'null') + ')">' + (u ? 'ذخیره' : 'ثبت') + '</button>' +
      '<button class="btn bo" onclick="UI.close()">انصراف</button>');
    var f = el('uUn');
    if (f) f.focus();
  },

  save: async function(id) {
    if (!Perm.can('*')) return;
    var un = elVal('uUn').trim();
    var pw = elVal('uPw');
    var pw2 = elVal('uPw2');
    var role = elVal('uRl');
    if (!un) {
      UI.toast('نام کاربری را وارد کنید', 'e');
      return;
    }
    if (un.length < 3) {
      UI.toast('نام کاربری باید حداقل ۳ نویسه باشد', 'e');
      return;
    }
    if (!Perm.ROLES[role]) {
      UI.toast('نقش انتخاب‌شده معتبر نیست', 'e');
      return;
    }
    var all = await DB.all('users');
    /* نام کاربری تکراری — بدون حساسیت به بزرگی و کوچکی حروف */
    var dup = all.find(function(x) {
      return x.id !== id && String(x.username).toLowerCase() === un.toLowerCase();
    });
    if (dup) {
      UI.toast('این نام کاربری قبلاً ثبت شده است', 'e');
      return;
    }
    if (!id && !pw) {
      UI.toast('برای کاربر جدید باید رمز عبور تعیین کنید', 'e');
      return;
    }
    if (pw) {
      if (pw.length < 6) {
        UI.toast('رمز عبور باید حداقل ۶ نویسه باشد', 'e');
        return;
      }
      if (pw !== pw2) {
        UI.toast('رمز عبور و تکرار آن یکسان نیستند', 'e');
        return;
      }
    }
    var active = elVal('uAc') === '1';

    /* نباید آخرین مدیر فعال حذف یا تنزل داده شود */
    if (id) {
      var target = await DB.get('users', id);
      var admins = all.filter(function(x) {
        return (x.role || 'admin') === 'admin' && x.active !== false;
      });
      var wasLastAdmin = admins.length === 1 && admins[0].id === id;
      if (wasLastAdmin && (role !== 'admin' || !active)) {
        UI.toast('این تنها مدیر فعال برنامه است. ابتدا یک مدیر دیگر بسازید، سپس نقش یا وضعیت این کاربر را تغییر دهید.', 'e');
        return;
      }
      target.username = un;
      target.displayName = elVal('uDn').trim();
      target.role = role;
      target.active = active;
      if (pw) target.password = await Auth.hash(pw);
      await DB.put('users', target);
      UI.toast('کاربر ویرایش شد');
      /* اگر نقش خودِ کاربر جاری عوض شد، بلافاصله اعمال شود */
      if (id === STATE.userId) await Perm.load();
    } else {
      await DB.add('users', {
        username: un,
        displayName: elVal('uDn').trim(),
        role: role,
        active: active,
        password: await Auth.hash(pw)
      });
      UI.toast('کاربر ثبت شد');
    }
    UI.close();
    await Users.render();
  },

  rm: async function(id) {
    if (!Perm.can('*')) return;
    if (id === STATE.userId) {
      UI.toast('کاربر وارد‌شده را نمی‌توانید حذف کنید', 'e');
      return;
    }
    var all = await DB.all('users');
    var u = all.find(function(x) {
      return x.id === id;
    });
    if (!u) return;
    var admins = all.filter(function(x) {
      return (x.role || 'admin') === 'admin' && x.active !== false;
    });
    if (admins.length <= 1 && (u.role || 'admin') === 'admin') {
      UI.toast('نمی‌توانید تنها مدیر برنامه را حذف کنید', 'e');
      return;
    }
    if (!await UI.confirm('کاربر «' + u.username + '» حذف شود؟ اسناد ثبت‌شده‌اش پاک نمی‌شود.')) return;
    await DB.del('users', id);
    UI.toast('کاربر حذف شد');
    await Users.render();
  }
};
