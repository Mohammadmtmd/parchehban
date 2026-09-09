/* ══ UI ══ */
var UI = {
  nav: function(p) {
    document.querySelectorAll('.ni').forEach(function(e) {
      e.classList.remove('active');
    });
    var el = document.querySelector('[data-page="' + p + '"]');
    if (el) {
      el.classList.add('active');
      /* باز کردن خودکار گروه کشویی بالاسری این صفحه در منو */
      var sub = el.closest('.sb-sub');
      if (sub) {
        var prev = sub.previousElementSibling;
        if (prev && prev.classList.contains('sb-drop')) {
          prev.classList.add('open');
        }
      }
    }
  },
  toggleSidebar: function(force) {
    var sb = document.getElementById('appSidebar') || document.querySelector('.sb');
    var bd = document.getElementById('sbBackdrop');
    if (!sb) return;
    var isOpen = typeof force === 'boolean' ? force : !sb.classList.contains('open');
    if (isOpen) {
      sb.classList.add('open');
      if (bd) bd.classList.add('show');
    } else {
      sb.classList.remove('open');
      if (bd) bd.classList.remove('show');
    }
  },
  closeSidebar: function() {
    UI.toggleSidebar(false);
  },
  title: function(i, t) {
    document.getElementById('pageTitle').innerHTML =
      '<i class="bi ' + esc(i) + '"></i><span>' + esc(t) + '</span>';
  },
  act: function(h) {
    setHTML('topActions', h || '');
  },
  content: function(h) {
    setHTML('mainContent', h);
  },
  open: function(t, b, f, w) {
    var titleEl = document.getElementById('modalTitle');
    if (titleEl) titleEl.textContent = t || '';
    setHTML('modalBody', b || '');
    setHTML('modalFoot', f || '');
    var box = document.getElementById('modalBox');
    if (box) box.className = w ? 'md w' : 'md';
    var ov = document.getElementById('modalOverlay');
    if (ov) ov.classList.add('show');
  },
  modal: function(b, t, f, w) {
    /* پشتیبانی از فراخوانی UI.modal(html) و UI.modal(body, title, foot, wide) */
    UI.open(t || '', b, f || '', w);
  },
  close: function() {
    var ov = document.getElementById('modalOverlay');
    if (ov) ov.classList.remove('show');
  },
  toast: function(m, tp) {
    tp = tp || 's';
    var ic = {
      s: 'bi-check-circle-fill',
      e: 'bi-x-circle-fill',
      i: 'bi-info-circle-fill'
    };
    var el = document.createElement('div');
    el.className = 'tst tst-' + tp;
    /* پیام با esc درج می‌شود تا متن خطا یا نام کالا صفحه را نشکند */
    el.innerHTML = '<i class="bi ' + (ic[tp] || ic.i) + '"></i>' + esc(m);
    document.getElementById('toastWrap').appendChild(el);
    setTimeout(function() {
      el.style.opacity = '0';
      setTimeout(function() {
        el.remove();
      }, 300);
    }, 3000);
  },
  confirm: function(m) {
    return new Promise(function(ok) {
      UI.open('تأیید', '<p style="font-size:.92rem;line-height:1.7;color:var(--txs)">' + esc(m) + '</p>', '<button class="btn bdn" id="btnYes">بله</button><button class="btn bo" id="btnNo">انصراف</button>');
      document.getElementById('btnYes').onclick = function() {
        UI.close();
        ok(true);
      };
      document.getElementById('btnNo').onclick = function() {
        UI.close();
        ok(false);
      };
    });
  },
  /* قالب‌بندی عدد — ورودی نامعتبر یا رشته‌ای هم به‌درستی هندل می‌شود */
  fn: function(n) {
    var v = typeof n === 'number' ? n : numOf(n);
    if (!isFinite(v)) v = 0;
    return v.toLocaleString('fa-IR', {
      maximumFractionDigits: 2
    });
  },

  /* میان‌بر برای خنثی‌سازی متن در قالب‌های HTML */
  esc: esc,

  /* نمایش تاریخ شمسی ورودی کاربر به‌شکل استاندارد */
  dj: function(s) {
    var n = Jalali.parse(s);
    return n ? n : (s ? esc(s) : '—');
  },
  fd: function(s) {
    if (!s) return '—';
    try {
      var d = new Date(s);
      if (isNaN(d.getTime())) return String(s);
      var jp = Jalali.fromDate(d);
      return Jalali.format(jp[0], jp[1], jp[2]);
    } catch (e) {
      return s;
    }
  }
};
