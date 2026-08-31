/* ══════════════════════════════════════════════════════════════
   PAGINATION — صفحه‌بندی جدول‌ها
   اصلاحات:
   • slice حالا total و pages را در state ذخیره می‌کند. قبلاً فقط
     برمی‌گرداند و html آن‌ها را undefined می‌خواند؛ نتیجه: دکمه صفحه
     ساخته نمی‌شد و پایین جدول «۱ تا NaN از undefined» نوشته می‌شد.
   • eval حذف شد و جای آن یک رجیستری تابع (Pag.register) آمد.
   ══════════════════════════════════════════════════════════════ */
var Pag = {
  state: {},
  handlers: {},

  /* ثبت تابع بازسازی جدول برای هر کلید — جانشین eval */
  register: function(key, fn) {
    this.handlers[key] = fn;
    return this.init(key);
  },

  init: function(key, perPage) {
    if (!this.state[key]) this.state[key] = {
      page: 1,
      per: perPage || 20,
      total: 0,
      pages: 1
    };
    else if (perPage) this.state[key].per = perPage;
    return this.state[key];
  },

  slice: function(key, arr) {
    var s = this.init(key);
    var total = arr.length;
    var pages = Math.max(1, Math.ceil(total / s.per));
    if (s.page > pages) s.page = pages;
    if (s.page < 1) s.page = 1;
    /* ← اصلاح اصلی: نوشتن مقادیر در state */
    s.total = total;
    s.pages = pages;
    var start = (s.page - 1) * s.per;
    return {
      items: arr.slice(start, start + s.per),
      total: total,
      pages: pages,
      page: s.page,
      per: s.per
    };
  },

  html: function(key) {
    var s = this.init(key);
    var q = "'" + key + "'";
    /* اگر فقط یک صفحه و کمتر از ۱۰ ردیف است، نواری لازم نیست */
    if (s.total === 0) return '';
    var h = '<div style="display:flex;align-items:center;justify-content:space-between;padding:12px 16px;border-top:1px solid var(--bd);flex-wrap:wrap;gap:10px">';
    h += '<div style="display:flex;align-items:center;gap:6px;font-size:.8rem;color:var(--txs)">';
    h += '<span>نمایش:</span>';
    [10, 20, 50, 100].forEach(function(n) {
      h += '<button class="btn bs ' + (s.per === n ? 'bp' : 'bo') +
        '" onclick="Pag.setPerPage(' + q + ',' + n + ')">' + UI.fn(n) + '</button>';
    });
    h += '</div>';

    h += '<div style="display:flex;align-items:center;gap:4px">';
    h += '<button class="btn bs bo" onclick="Pag.go(' + q + ',' + (s.page - 1) + ')"' +
      (s.page <= 1 ? ' disabled style="opacity:.4"' : '') + '><i class="bi bi-chevron-right"></i></button>';
    var start = Math.max(1, s.page - 2);
    var end = Math.min(s.pages, s.page + 2);
    if (start > 1) h += '<button class="btn bs bo" onclick="Pag.go(' + q + ',1)">' + UI.fn(1) + '</button>';
    if (start > 2) h += '<span style="color:var(--txm);padding:0 4px">...</span>';
    for (var i = start; i <= end; i++) {
      h += '<button class="btn bs ' + (i === s.page ? 'bp' : 'bo') +
        '" onclick="Pag.go(' + q + ',' + i + ')">' + UI.fn(i) + '</button>';
    }
    if (end < s.pages - 1) h += '<span style="color:var(--txm);padding:0 4px">...</span>';
    if (end < s.pages) h += '<button class="btn bs bo" onclick="Pag.go(' + q + ',' + s.pages + ')">' + UI.fn(s.pages) + '</button>';
    h += '<button class="btn bs bo" onclick="Pag.go(' + q + ',' + (s.page + 1) + ')"' +
      (s.page >= s.pages ? ' disabled style="opacity:.4"' : '') + '><i class="bi bi-chevron-left"></i></button>';
    h += '</div>';

    var from = s.total ? (s.page - 1) * s.per + 1 : 0;
    var to = Math.min(s.page * s.per, s.total);
    h += '<div style="font-size:.78rem;color:var(--txm)">' + UI.fn(from) + ' تا ' +
      UI.fn(to) + ' از ' + UI.fn(s.total) + '</div>';
    h += '</div>';
    return h;
  },

  _run: function(key) {
    var fn = this.handlers[key];
    if (typeof fn === 'function') {
      var r = fn();
      if (r && typeof r.catch === 'function') r.catch(function(e) {
        console.error(e);
      });
    }
  },

  go: function(key, page) {
    var s = this.init(key);
    if (page < 1 || page > s.pages) return;
    s.page = page;
    this._run(key);
  },

  setPerPage: function(key, per) {
    var s = this.init(key);
    s.per = per;
    s.page = 1;
    this._run(key);
  },

  /* بازگشت به صفحه اول — بعد از تغییر فیلتر یا جست‌وجو */
  reset: function(key) {
    var s = this.init(key);
    s.page = 1;
  }
};
