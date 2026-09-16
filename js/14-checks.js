/* ══ CHECKS ══ */
var Chk = {
  _fl: 'all',
  _q: '',
  _sort: 'asc',
  _selected: {},
  _currentVoucher: null,
  nextDocNumber: async function() {
    var all = await DB.all('checks');
    var max = 1000;
    all.forEach(function(c) {
      var n = intOf(c.docNumber);
      if (n > max) max = n;
    });
    return String(max + 1).padStart(4, '0');
  },
  ensureDocNumbers: async function() {
    var all = await DB.all('checks');
    var sorted = all.slice().sort(function(a, b) {
      return (a.id || 0) - (b.id || 0);
    });
    var current = 1000;
    sorted.forEach(function(c) {
      var n = intOf(c.docNumber);
      if (n > current) current = n;
    });
    var changed = false;
    for (var i = 0; i < sorted.length; i++) {
      var c = sorted[i];
      if (!c.docNumber) {
        current++;
        c.docNumber = String(current).padStart(4, '0');
        await DB.put('checks', c);
        changed = true;
      }
    }
    return changed;
  },
  onSearch: function(val) {
    this._q = val;
    this.ll();
  },
  onSortChange: function(val) {
    this._sort = val;
    this.ll();
  },
  sl: function(s) {
    return {
      pending: 'در انتظار',
      deposited: 'واریز',
      passed: 'وصول',
      returned: 'برگشتی',
      transferred: 'انتقال‌یافته'
    } [s] || s;
  },
  stg: function(s) {
    return {
      pending: 'tg-o',
      deposited: 'tg-b',
      passed: 'tg-g',
      returned: 'tg-r',
      transferred: 'tg-p'
    } [s] || 'tg-b';
  },
  /* ══ تحلیل هوشمند سررسید چک‌های صیادی ══
     چک‌های فعال (در انتظار، واریزشده، انتقال‌یافته - غیر از وصول یا برگشتی)
     را بر اساس فاصله با تاریخ امروز تفکیک می‌کند. */
  calcDiffDays: function(dueDate) {
    if (!dueDate) return null;
    var normDue = Jalali.parse(dueDate);
    var today = Jalali.today();
    var normToday = Jalali.parse(today);
    if (!normDue || !normToday) return null;
    var dP = normDue.split('/').map(Number);
    var tP = normToday.split('/').map(Number);
    var dueJdn = Jalali.toJDN(dP[0], dP[1], dP[2]);
    var todayJdn = Jalali.toJDN(tP[0], tP[1], tP[2]);
    return dueJdn - todayJdn; // < 0: گذشته | 0: امروز | > 0: روزهای باقی‌مانده
  },
  getDueAnalysis: function(checks) {
    var me = this;
    var overdue = [], dueToday = [], within3 = [], within7 = [];
    var totalIssuedAmt = 0, totalReceivedAmt = 0;

    (checks || []).forEach(function(c) {
      if (c.status === 'passed' || c.status === 'returned') return;
      var diff = me.calcDiffDays(c.dueDate);
      if (diff === null) return;
      var item = Object.assign({}, c, { diffDays: diff });

      if (diff < 0) {
        overdue.push(item);
      } else if (diff === 0) {
        dueToday.push(item);
      } else if (diff <= 3) {
        within3.push(item);
      } else if (diff <= 7) {
        within7.push(item);
      }

      if (diff <= 7) {
        if (c.type === 'issued') totalIssuedAmt += numOf(c.amount);
        else totalReceivedAmt += numOf(c.amount);
      }
    });

    return {
      overdue: overdue,
      dueToday: dueToday,
      within3: within3,
      within7: within7,
      allUrgent: overdue.concat(dueToday, within3, within7),
      totalIssuedAmt: totalIssuedAmt,
      totalReceivedAmt: totalReceivedAmt,
      count: overdue.length + dueToday.length + within3.length + within7.length
    };
  },
  dueBadgeHTML: function(dueDate, status) {
    if (status === 'passed' || status === 'returned') return '';
    var diff = this.calcDiffDays(dueDate);
    if (diff === null) return '';
    if (diff < 0) {
      return '<span class="tg tg-r" style="font-weight:700;margin-inline-start:4px"><i class="bi bi-exclamation-octagon-fill" style="margin-inline-end:3px"></i>' + Math.abs(diff) + ' روز گذشته</span>';
    }
    if (diff === 0) {
      return '<span class="tg tg-o" style="font-weight:800;margin-inline-start:4px;animation:pulse 1.5s infinite"><i class="bi bi-clock-fill" style="margin-inline-end:3px"></i>امروز</span>';
    }
    if (diff <= 3) {
      return '<span class="tg tg-b" style="font-weight:700;margin-inline-start:4px"><i class="bi bi-hourglass-split" style="margin-inline-end:3px"></i>' + diff + ' روز مانده</span>';
    }
    if (diff <= 7) {
      return '<span class="tg tg-p" style="font-weight:600;margin-inline-start:4px"><i class="bi bi-calendar-event" style="margin-inline-end:3px"></i>' + diff + ' روز مانده</span>';
    }
    return '';
  },
  render: async function(filterMode) {
    currentPage = 'checks';
    UI.nav('checks');
    UI.title('bi-credit-card-2-front-fill', 'مدیریت چک‌ها و صیادی');
    UI.act(
      '<button class="btn bg" onclick="Chk.form(\'received\')"><i class="bi bi-plus-lg"></i>چک دریافتی</button> ' +
      '<button class="btn bdn" onclick="Chk.form(\'issued\')"><i class="bi bi-plus-lg"></i>چک پرداختی</button> ' +
      '<button class="btn bo" onclick="Chk.openTransferModal()" title="انتقال و واگذاری چک‌های انتخابی به مشتری یا تامین‌کننده"><i class="bi bi-arrow-left-right"></i> انتقال چک</button> ' +
      '<button class="btn bo" onclick="Chk.openPrintModal()" title="چاپ قبض پرداخت چک‌های انتخابی"><i class="bi bi-printer"></i> قبض پرداخت چک</button>'
    );
    this._fl = filterMode || 'all';
    await this.ll(this._fl);
  },
  onSel: function(id, isChecked) {
    if (isChecked) {
      this._selected[id] = true;
    } else {
      delete this._selected[id];
    }
    this.syncSelectAllHeader();
    this.updateBatchBar();
  },
  toggleAll: function(isChecked) {
    var me = this;
    var cbs = document.querySelectorAll('.chk-row-cb');
    cbs.forEach(function(cb) {
      cb.checked = isChecked;
      var cid = intOf(cb.value);
      if (cid) {
        if (isChecked) me._selected[cid] = true;
        else delete me._selected[cid];
      }
    });
    this.updateBatchBar();
  },
  syncSelectAllHeader: function() {
    var master = document.getElementById('chkSelAll');
    if (!master) return;
    var cbs = document.querySelectorAll('.chk-row-cb');
    if (!cbs.length) { master.checked = false; return; }
    var allChecked = true;
    for (var i = 0; i < cbs.length; i++) {
      if (!cbs[i].checked) { allChecked = false; break; }
    }
    master.checked = allChecked;
  },
  clearSelection: function() {
    this._selected = {};
    var cbs = document.querySelectorAll('.chk-row-cb');
    cbs.forEach(function(cb) { cb.checked = false; });
    var master = document.getElementById('chkSelAll');
    if (master) master.checked = false;
    this.updateBatchBar();
    var trs = document.querySelectorAll('tbody tr');
    trs.forEach(function(tr) { tr.style.background = ''; });
  },
  getSelectedIds: function() {
    var me = this;
    return Object.keys(this._selected).map(Number).filter(function(id) {
      return me._selected[id];
    });
  },
  updateBatchBar: async function() {
    var ids = this.getSelectedIds();
    var bar = document.getElementById('chkBatchBar');
    if (!ids.length) {
      if (bar) bar.remove();
      return;
    }
    var checks = await DB.all('checks');
    var selChecks = checks.filter(function(c) { return ids.indexOf(c.id) > -1; });
    var sum = 0;
    selChecks.forEach(function(c) { sum += numOf(c.amount); });

    var html = '<div style="display:flex;align-items:center;gap:10px">' +
      '<span class="tg tg-b" style="font-weight:800;font-size:.86rem;padding:5px 12px">' +
      '<i class="bi bi-check2-square" style="margin-inline-end:4px"></i>' + UI.fn(ids.length) + ' چک انتخاب شده</span>' +
      '<span style="font-size:.85rem;color:var(--txs)">مجموع مبالغ: <strong style="color:var(--tx)">' + UI.fn(sum) + ' ریال</strong></span>' +
      '</div>' +
      '<div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">' +
      '<button class="btn bp bs" onclick="Chk.openTransferModal()"><i class="bi bi-arrow-left-right"></i> انتقال چک (به مشتری یا تامین‌کننده)</button>' +
      '<button class="btn bg bs" onclick="Chk.openPrintModal()"><i class="bi bi-printer-fill"></i> قبض پرداخت چک (پرینت)</button>' +
      '<button class="btn bo bs" onclick="Chk.clearSelection()" style="padding:6px 10px"><i class="bi bi-x-lg"></i> لغو</button>' +
      '</div>';

    if (!bar) {
      bar = document.createElement('div');
      bar.id = 'chkBatchBar';
      bar.className = 'chk-batch-bar';
      document.body.appendChild(bar);
    }
    bar.innerHTML = html;
  },
  ll: async function(fl) {
    if (fl) this._fl = fl;
    else fl = this._fl;

    await this.ensureDocNumbers();
    var all = await FY.byYear('checks');
    var ct = await DB.all('contacts'),
      cm = {};
    ct.forEach(function(c) {
      cm[c.id] = c.name;
    });

    var me = this;
    var analysis = me.getDueAnalysis(all);

    /* نقشه‌برداری ردیف ثابت و پایدار بر اساس تقدم ثبت تاریخی چک‌ها:
       چک اول ردیف ۱، چک دوم ردیف ۲، ... و آخرین چک ثبت‌شده همیشه آخرین عدد ردیف را می‌گیرد.
       با ثبت چک جدید، ردیف چک‌های قدیمی هرگز تغییر نمی‌کند و ۱ اضافه نمی‌شود! */
    var rowMap = {};
    var chron = all.slice().sort(function(a, b) {
      var na = intOf(a.docNumber) || a.id || 0;
      var nb = intOf(b.docNumber) || b.id || 0;
      if (na !== nb) return na - nb;
      return (a.id || 0) - (b.id || 0);
    });
    chron.forEach(function(c, idx) {
      rowMap[c.id] = idx + 1;
    });

    var sortMode = this._sort || 'asc';
    var ls = all.slice();

    if (sortMode === 'asc') {
      ls.sort(function(a, b) {
        var na = intOf(a.docNumber) || a.id || 0;
        var nb = intOf(b.docNumber) || b.id || 0;
        if (na !== nb) return na - nb;
        return (a.id || 0) - (b.id || 0);
      });
    } else if (sortMode === 'desc') {
      ls.sort(function(a, b) {
        var na = intOf(a.docNumber) || a.id || 0;
        var nb = intOf(b.docNumber) || b.id || 0;
        if (na !== nb) return nb - na;
        return (b.id || 0) - (a.id || 0);
      });
    } else if (sortMode === 'dueAsc') {
      ls.sort(function(a, b) {
        var da = me.calcDiffDays(a.dueDate);
        var db = me.calcDiffDays(b.dueDate);
        return (da == null ? 9999 : da) - (db == null ? 9999 : db);
      });
    } else if (sortMode === 'dueDesc') {
      ls.sort(function(a, b) {
        var da = me.calcDiffDays(a.dueDate);
        var db = me.calcDiffDays(b.dueDate);
        return (db == null ? -9999 : db) - (da == null ? -9999 : da);
      });
    } else if (sortMode === 'amtDesc') {
      ls.sort(function(a, b) {
        return (b.amount || 0) - (a.amount || 0);
      });
    }

    if (fl === 'received') ls = ls.filter(function(c) {
      return c.type === 'received';
    });
    if (fl === 'transferred') ls = ls.filter(function(c) {
      return c.status === 'transferred';
    });
    if (fl === 'issued') ls = ls.filter(function(c) {
      return c.type === 'issued';
    });
    if (fl === 'due7') ls = ls.filter(function(c) {
      if (c.status === 'passed' || c.status === 'returned') return false;
      var d = me.calcDiffDays(c.dueDate);
      return d !== null && d >= 0 && d <= 7;
    });
    if (fl === 'overdue') ls = ls.filter(function(c) {
      if (c.status === 'passed' || c.status === 'returned') return false;
      var d = me.calcDiffDays(c.dueDate);
      return d !== null && d < 0;
    });

    /* جستجو بر اساس شماره سند ۴ رقمی، شماره چک، صیاد، حساب، طرف حساب، بانک و مبلغ */
    if (me._q && me._q.trim()) {
      var q = toEnDigits(me._q).trim().toLowerCase();
      ls = ls.filter(function(c) {
        var doc = toEnDigits(String(c.docNumber || '')).toLowerCase();
        var chkNo = toEnDigits(String(c.checkNumber || '')).toLowerCase();
        var accNo = toEnDigits(String(c.accountNumber || '')).toLowerCase();
        var sayad = toEnDigits(String(c.sayadId || '')).toLowerCase();
        var person = (cm[c.contactId] || '').toLowerCase();
        var trPerson = (cm[c.transferToId] || '').toLowerCase();
        var bnk = (c.bank || '').toLowerCase();
        var br = (c.branch || '').toLowerCase();
        var amt = String(c.amount || '');
        var nts = (c.notes || '').toLowerCase();
        var due = toEnDigits(String(c.dueDate || '')).toLowerCase();

        return doc.indexOf(q) > -1 ||
          chkNo.indexOf(q) > -1 ||
          accNo.indexOf(q) > -1 ||
          sayad.indexOf(q) > -1 ||
          person.indexOf(q) > -1 ||
          trPerson.indexOf(q) > -1 ||
          bnk.indexOf(q) > -1 ||
          br.indexOf(q) > -1 ||
          amt.indexOf(q) > -1 ||
          nts.indexOf(q) > -1 ||
          due.indexOf(q) > -1;
      });
    }

    var pk = 'chk_' + fl;
    Pag.register(pk, function() {
      return Chk.ll(fl);
    });
    var pg = Pag.slice(pk, ls);
    var tAmt = 0;
    ls.forEach(function(x) {
      tAmt += numOf(x.amount);
    });
    var r = '';
    for (var i = 0; i < pg.items.length; i++) {
      var c = pg.items[i];
      var tl = c.type === 'received' ? 'دریافتی' : 'پرداختی';
      var tt = c.type === 'received' ? 'tg-g' : 'tg-r';
      var dueBadge = me.dueBadgeHTML(c.dueDate, c.status);
      var isChecked = !!me._selected[c.id];
      var bnkTxt = esc(c.bank || '—');
      if (c.branch) bnkTxt += '<br><small style="color:var(--txs)">شعبه ' + esc(c.branch) + '</small>';
      var personText = esc(cm[c.contactId] || '—');
      if (c.status === 'transferred' && c.transferToId) {
        personText = '<span style="color:var(--txs);font-size:.78rem">از:</span> ' + personText +
          '<br><span class="tg tg-p" style="font-size:.73rem;padding:2px 6px"><i class="bi bi-arrow-left"></i> ' + esc(cm[c.transferToId] || '—') + '</span>';
      }

      r += '<tr' + (isChecked ? ' style="background:rgba(37,99,235,.07)"' : '') + '>' +
        '<td class="chk-sel-cell"><input type="checkbox" class="chk-row-cb" value="' + c.id + '" ' + (isChecked ? 'checked' : '') + ' onchange="Chk.onSel(' + c.id + ',this.checked)"></td>' +
        '<td style="text-align:center;font-weight:700;color:var(--txs)">' + UI.fn(rowMap[c.id] || (((pg.page - 1) * pg.per) + i + 1)) + '</td>' +
        '<td style="text-align:center"><span class="tg tg-b" style="font-family:monospace;font-size:.85rem;font-weight:800;letter-spacing:0.5px;padding:3px 8px">' + esc(c.docNumber || '—') + '</span></td>' +
        '<td><span class="tg ' + tt + '">' + tl + '</span></td>' +
        '<td><strong>' + esc(c.checkNumber) + '</strong>' + (c.accountNumber ? '<br><small style="color:var(--txs);direction:ltr;display:inline-block">حساب: ' + esc(c.accountNumber) + '</small>' : '') + '</td>' +
        '<td>' + bnkTxt + '</td>' +
        '<td style="font-weight:700">' + UI.fn(c.amount) + '</td>' +
        '<td>' + personText + '</td>' +
        '<td>' + esc(c.dueDate || '—') + dueBadge + '</td>' +
        '<td><span class="tg ' + Chk.stg(c.status) + '">' + Chk.sl(c.status) + '</span></td>' +
        '<td style="white-space:nowrap">';

      if (c.type === 'received') {
        r += '<button class="bi2" onclick="Chk.openTransferModal(' + c.id + ')" title="' + (c.status === 'transferred' ? 'تغییر طرف حساب یا لغو واگذاری' : 'انتقال و واگذاری به مشتری یا تامین‌کننده') + '"><i class="bi bi-arrow-left-right"></i></button> ';
      }
      if (c.status === 'transferred') {
        r += '<button class="bi2" onclick="Chk.printSingleVoucher(' + c.id + ')" title="چاپ قبض پرداخت چک"><i class="bi bi-printer"></i></button> ';
      }
      r += '<button class="bi2" onclick="Chk.cs(' + c.id + ')" title="تغییر وضعیت"><i class="bi bi-arrow-repeat"></i></button> ' +
        '<button class="bi2" onclick="Chk.form(\'' + c.type + '\',' + c.id + ')" title="ویرایش"><i class="bi bi-pencil"></i></button> ' +
        '<button class="bi2 d" onclick="Chk.rm(' + c.id + ')" title="حذف"><i class="bi bi-trash3"></i></button></td></tr>';
    }
    var ft = '<tfoot><tr style="background:var(--bg);font-weight:700">' +
      '<td colspan="6">جمع ' + UI.fn(ls.length) + ' چک' + (me._q ? ' (فیلتر شده)' : '') + '</td><td>' + UI.fn(tAmt) +
      '</td><td colspan="4"></td></tr></tfoot>';
    var tb = ls.length ?
      '<div class="tw"><table><thead><tr>' +
      '<th class="chk-sel-cell"><input type="checkbox" id="chkSelAll" onchange="Chk.toggleAll(this.checked)" title="انتخاب همه چک‌های این صفحه"></th>' +
      '<th style="width:48px;text-align:center">ردیف</th>' +
      '<th style="width:90px;text-align:center">شماره سند</th>' +
      '<th>نوع</th><th>شماره چک</th><th>بانک و شعبه</th><th>مبلغ (ریال)</th><th>طرف حساب</th><th>سررسید</th><th>وضعیت</th><th>عملیات</th></tr></thead><tbody>' +
      r + '</tbody>' + ft + '</table></div>' + Pag.html(pk) :
      '<div class="em"><p>' + (me._q ? 'چکی با عبارت «' + esc(me._q) + '» یافت نشد' : 'چکی با این شرط یافت نشد') + '</p></div>';

    /* کارت هشدار سررسید در بالای صفحه چک‌ها */
    var reminderBanner = '';
    if (analysis.count > 0) {
      reminderBanner = '<div style="background:var(--sf);border:1.5px solid var(--w);border-radius:12px;padding:14px 18px;margin-bottom:18px;box-shadow:var(--shd);display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:12px">' +
        '<div style="display:flex;align-items:center;gap:12px">' +
        '<div style="width:42px;height:42px;border-radius:10px;background:var(--wl);color:var(--w);display:flex;align-items:center;justify-content:center;font-size:1.3rem;flex-shrink:0"><i class="bi bi-bell-fill"></i></div>' +
        '<div>' +
        '<strong style="font-size:.95rem;color:var(--tx)">یادآور هوشمند سررسید چک‌ها:</strong>' +
        '<div style="font-size:.82rem;color:var(--txs);margin-top:3px">' +
        (analysis.overdue.length ? '<span class="tg tg-r" style="margin-inline-end:6px"><strong>' + analysis.overdue.length + '</strong> چک سررسید گذشته</span>' : '') +
        (analysis.dueToday.length ? '<span class="tg tg-o" style="margin-inline-end:6px"><strong>' + analysis.dueToday.length + '</strong> چک امروز</span>' : '') +
        (analysis.within3.length ? '<span class="tg tg-b" style="margin-inline-end:6px"><strong>' + analysis.within3.length + '</strong> چک تا ۳ روز آینده</span>' : '') +
        (analysis.within7.length ? '<span class="tg tg-p" style="margin-inline-end:6px"><strong>' + analysis.within7.length + '</strong> چک تا ۷ روز آینده</span>' : '') +
        '</div></div></div>' +
        '<div style="display:flex;gap:10px;align-items:center;font-size:.82rem">' +
        (analysis.totalIssuedAmt > 0 ? '<div style="padding:6px 12px;background:var(--dl);color:var(--d);border-radius:8px"><strong>پرداختی سررسیددار:</strong> ' + UI.fn(analysis.totalIssuedAmt) + '</div>' : '') +
        (analysis.totalReceivedAmt > 0 ? '<div style="padding:6px 12px;background:var(--okl);color:var(--ok);border-radius:8px"><strong>دریافتی سررسیددار:</strong> ' + UI.fn(analysis.totalReceivedAmt) + '</div>' : '') +
        '</div></div>';
    }

    var trCount = all.filter(function(x){return x.status === 'transferred'}).length;
    var tabBar = '<div class="tab-bar">' +
      '<button class="tab-btn' + (fl === 'all' ? ' active' : '') + '" onclick="Chk.ll(\'all\')">همه چک‌ها (' + all.length + ')</button>' +
      '<button class="tab-btn' + (fl === 'received' ? ' active' : '') + '" onclick="Chk.ll(\'received\')">دریافتی (' + all.filter(function(x){return x.type==='received'}).length + ')</button>' +
      '<button class="tab-btn' + (fl === 'transferred' ? ' active' : '') + '" onclick="Chk.ll(\'transferred\')">انتقال‌یافته (' + trCount + ')</button>' +
      '<button class="tab-btn' + (fl === 'issued' ? ' active' : '') + '" onclick="Chk.ll(\'issued\')">پرداختی (' + all.filter(function(x){return x.type==='issued'}).length + ')</button>' +
      '<button class="tab-btn' + (fl === 'due7' ? ' active' : '') + '" onclick="Chk.ll(\'due7\')" style="color:' + (analysis.dueToday.length || analysis.within3.length || analysis.within7.length ? 'var(--w)' : '') + '"><i class="bi bi-clock-history"></i> سررسید ۷ روز (' + (analysis.dueToday.length + analysis.within3.length + analysis.within7.length) + ')</button>' +
      '<button class="tab-btn' + (fl === 'overdue' ? ' active' : '') + '" onclick="Chk.ll(\'overdue\')" style="color:' + (analysis.overdue.length ? 'var(--d)' : '') + '"><i class="bi bi-exclamation-triangle"></i> سررسید گذشته (' + analysis.overdue.length + ')</button>' +
      '</div>';

    /* نوار ابزار جستجو و مرتب‌سازی */
    var toolBar = '<div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:10px;margin-bottom:14px;background:var(--sf);padding:10px 14px;border-radius:10px;border:1px solid var(--bd)">' +
      '<div style="display:flex;align-items:center;gap:8px;flex:1;min-width:240px;max-width:440px">' +
      '<div style="position:relative;width:100%">' +
      '<input id="chkSearchInput" class="fc" placeholder="جستجو (شماره سند ۴ رقمی، چک، طرف حساب، بانک...)" value="' + esc(me._q || '') + '" oninput="Chk.onSearch(this.value)" style="padding-inline-start:34px;font-size:.84rem">' +
      '<i class="bi bi-search" style="position:absolute;top:50%;transform:translateY(-50%);right:10px;color:var(--txs);pointer-events:none"></i>' +
      (me._q ? '<button type="button" onclick="Chk.onSearch(\'\')" style="position:absolute;left:8px;top:50%;transform:translateY(-50%);background:none;border:none;color:var(--txs);cursor:pointer" title="پاک کردن جستجو"><i class="bi bi-x-circle-fill"></i></button>' : '') +
      '</div></div>' +
      '<div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">' +
      '<label style="font-size:.82rem;color:var(--txs);white-space:nowrap"><i class="bi bi-sort-down" style="margin-inline-end:4px"></i>مرتب‌سازی:</label>' +
      '<select class="fc" style="width:auto;font-size:.82rem;padding:5px 10px" onchange="Chk.onSortChange(this.value)">' +
      '<option value="asc"' + (sortMode === 'asc' ? ' selected' : '') + '>شماره سند / ثبت (صعودی - قدیمی به جدید)</option>' +
      '<option value="desc"' + (sortMode === 'desc' ? ' selected' : '') + '>شماره سند / ثبت (نزولی - جدیدترین ابتدا)</option>' +
      '<option value="dueAsc"' + (sortMode === 'dueAsc' ? ' selected' : '') + '>سررسید (نزدیک‌ترین)</option>' +
      '<option value="dueDesc"' + (sortMode === 'dueDesc' ? ' selected' : '') + '>سررسید (دورترین)</option>' +
      '<option value="amtDesc"' + (sortMode === 'amtDesc' ? ' selected' : '') + '>بیشترین مبلغ</option>' +
      '</select>' +
      '</div></div>';

    UI.content(reminderBanner + tabBar + toolBar + '<div class="cd">' + tb + '</div>');
    me.syncSelectAllHeader();
    me.updateBatchBar();
  },
  form: async function(type, id) {
    var c = id ? await DB.get('checks', id) : null;
    var ct = await DB.all('contacts');
    var rl = ct.filter(function(cc) {
      if (c) return true;
      return type === 'received' ? (cc.type === 'customer' || cc.type === 'both') : (cc.type === 'supplier' || cc.type === 'both');
    });
    var banks = await DB.all('banks');
    var isR = type === 'received';
    var nextDoc = await this.nextDocNumber();

    /* بازنویسی با ابزار مشترک فرم (js/05b-form.js).
       دو مشکل جدی فرم قبلی رفع شد:
       ۱) دو فیلد هر دو «بانک» نام داشتند — یکی بانکِ روی برگه چک و
          یکی حساب بانکی خودمان. حالا برچسب‌ها صریح‌اند.
       ۲) «مرتبط» معلوم نبود یعنی چه؛ حالا بسته به نوع چک
          «دریافت از» یا «پرداخت به» نوشته می‌شود. */

    var people = rl.map(function(cc) { return { v: cc.id, t: cc.name }; });
    var allRecipients = ct.map(function(cc) {
      var tag = cc.type === 'customer' ? ' (مشتری)' : (cc.type === 'supplier' ? ' (تامین‌کننده)' : ' (دوطرفه)');
      return { v: cc.id, t: cc.name + tag };
    });
    var accs = banks.map(function(b) { return { v: b.id, t: b.name }; });

    var h = F.section('مشخصات برگه و سند چک', 'bi-card-text') +
      F.row(
        F.text({
          id: 'kDocNo', label: 'شماره سند چک', req: true, dir: 'ltr',
          value: c ? (c.docNumber || nextDoc) : nextDoc, ph: '1001',
          hint: 'شماره سند ۴ رقمی حسابداری جهت پیگیری و جست‌وجو'
        }),
        F.text({
          id: 'kNm', label: 'شماره چک', req: true, dir: 'ltr',
          value: c ? c.checkNumber : '', ph: '۱۲۳۴۵۶',
          hint: 'شماره درج‌شده روی برگه'
        })
      ) +
      F.row(
        F.text({
          id: 'kBk', label: 'بانک صادرکننده', value: c ? (c.bank || '') : '',
          ph: 'مثلاً: ملت',
          hint: 'بانکی که چک از آن کشیده شده'
        }),
        F.text({
          id: 'kBr', label: 'شعبه بانک', value: c ? (c.branch || '') : '',
          ph: 'مثلاً: بازار / کد ۱۲۳',
          hint: 'شعبه درج‌شده روی برگه چک'
        })
      ) +
      F.row(
        F.text({
          id: 'kAcc', label: 'شماره حساب', dir: 'ltr', value: c ? (c.accountNumber || '') : '',
          ph: 'مثلاً: ۰۲۱... یا شناسه صیاد',
          hint: 'شماره حساب درج‌شده روی برگه چک'
        }),
        F.text({
          id: 'kSayad', label: 'شناسه صیادی (۱۶ رقمی)', dir: 'ltr',
          value: c ? (c.sayadId || '') : '', ph: 'شناسه صیاد',
          hint: 'جهت پیگیری و استعلام وضعیت صیادی'
        })
      ) +
      F.row(
        F.money({
          id: 'kAm', label: 'مبلغ چک', req: true, value: c ? c.amount : ''
        }),
        F.text({
          id: 'kIs', label: isR ? 'نام صاحب چک' : 'در وجه',
          value: c ? (c.issuerName || '') : '',
          ph: isR ? 'نامی که روی چک آمده' : 'نام گیرنده',
          hint: isR ? 'اگر چک از شخص دیگری پشت‌نویسی شده، نام صاحب اصلی' : ''
        })
      ) +

      F.section('تاریخ‌ها', 'bi-calendar3') +
      F.row(
        F.date({
          id: 'kIsD', label: 'تاریخ صدور', value: c ? c.issueDate : todayJ(), quick: false,
          hint: 'تاریخ نوشته‌شده روی چک'
        }),
        F.date({
          id: 'kDu', label: 'تاریخ سررسید', req: true, value: c ? c.dueDate : '',
          hint: 'روزی که چک قابل وصول می‌شود — مبنای هشدار سررسید'
        })
      ) +

      F.section('ارتباط با حساب‌ها', 'bi-link-45deg') +
      F.select({
        id: 'kCt', label: isR ? 'دریافت از' : 'پرداخت به', req: true,
        value: c ? c.contactId : '', items: people,
        empty: '— انتخاب کنید —',
        hint: 'به‌محض ثبت چک، مانده این شخص اصلاح می‌شود'
      }) +
      F.select({
        id: 'kBkAcc', label: 'حساب بانکی ما', value: c ? c.bankAccountId : '', items: accs,
        empty: '— هنوز مشخص نیست —',
        hint: isR ? 'حسابی که چک قرار است به آن خوابانده شود. هنگام «وصول» سند بانکی خودکار ساخته می‌شود.'
                  : 'حسابی که چک از آن کشیده شده. هنگام «پاس شدن» سند بانکی خودکار ساخته می‌شود.'
      }) +
      F.text({
        id: 'kNt', label: 'شرح', note: 'اختیاری',
        value: c ? (c.notes || '') : '', ph: 'بابت چه چیزی؟'
      });

    if (isR) {
      h += F.section('وضعیت واگذاری / انتقال چک (اختیاری)', 'bi-arrow-left-right') +
        F.row(
          F.select({
            id: 'kTrTo', label: 'واگذار شده به (مشتری یا تامین‌کننده)',
            value: c ? (c.transferToId || '') : '',
            items: allRecipients,
            empty: '— واگذار نشده (نزد صندوق) —',
            hint: 'اگر چک به مشتری یا تامین‌کننده دیگری واگذار شده، او را انتخاب نمایید'
          }),
          F.date({
            id: 'kTrD', label: 'تاریخ واگذاری',
            value: c ? (c.transferDate || '') : '',
            quick: false,
            hint: 'تاریخ تحویل یا واگذاری برگه چک'
          })
        ) +
        F.text({
          id: 'kTrNt', label: 'توضیحات واگذاری',
          value: c ? (c.transferNotes || '') : '',
          ph: 'مثلاً: بابت تسویه فاکتور خرید یا بستانکاری...',
          note: 'اختیاری'
        });
    }

    UI.open(
      c ? 'ویرایش چک ' + esc(c.checkNumber) + (c.docNumber ? ' (سند ' + esc(c.docNumber) + ')' : '') : (isR ? 'ثبت چک دریافتی' : 'ثبت چک پرداختی'),
      h,
      '<button class="btn bp" onclick="Chk.save(\'' + type + '\',' + (id || 'null') + ')">' +
        '<i class="bi bi-check-lg"></i> ' + (c ? 'ذخیره تغییرات' : 'ثبت چک') + '</button>' +
      '<button class="btn bo" onclick="UI.close()">انصراف</button>',
      true
    );
    F.focusFirst('kNm');
  },
  save: async function(type, id) {
    if (!F.validate()) return;
    /* سطح دسترسی و سال مالی بسته */
    if (!Perm.require('edit', 'ثبت یا ویرایش سند')) return;
    if (!await FY.assertOpen()) return;

    var docNo = elVal('kDocNo').trim();
    if (!docNo) {
      docNo = await this.nextDocNumber();
    } else {
      var nVal = intOf(docNo);
      if (nVal > 0) docNo = String(nVal).padStart(4, '0');
    }

    var d = {
      type: type,
      docNumber: docNo,
      fiscalYearId: STATE.yearId,
      checkNumber: elVal('kNm').trim(),
      bank: elVal('kBk').trim(),
      branch: elVal('kBr').trim(),
      accountNumber: elVal('kAcc').trim(),
      sayadId: elVal('kSayad').trim(),
      amount: elNum('kAm'),
      issuerName: elVal('kIs').trim(),
      issueDate: Jalali.parse(elVal('kIsD')),
      dueDate: Jalali.parse(elVal('kDu')),
      contactId: intOf(elVal('kCt')) || null,
      bankAccountId: intOf(elVal('kBkAcc')) || null,
      notes: elVal('kNt').trim()
    };
    if (type === 'received') {
      var trTo = intOf(elVal('kTrTo')) || null;
      var trDt = Jalali.parse(elVal('kTrD')) || null;
      var trNt = (elVal('kTrNt') || '').trim();
      d.transferToId = trTo;
      d.transferDate = trDt;
      d.transferNotes = trNt;
      if (trTo) {
        d.status = 'transferred';
      } else if (id) {
        var prevChk = await DB.get('checks', id);
        if (prevChk && prevChk.status === 'transferred') {
          d.status = 'pending';
        }
      }
    }
    if (!d.checkNumber) {
      UI.toast('شماره چک را وارد کنید', 'e');
      return;
    }
    if (!(d.amount > 0)) {
      UI.toast('مبلغ چک باید بزرگ‌تر از صفر باشد', 'e');
      return;
    }
    if (!d.issueDate) {
      UI.toast('تاریخ صدور نامعتبر است (نمونه صحیح: 1404/01/05)', 'e');
      return;
    }
    if (!d.dueDate) {
      UI.toast('تاریخ سررسید نامعتبر است (نمونه صحیح: 1404/01/05)', 'e');
      return;
    }
    if (d.amount <= 0) {
      UI.toast('مبلغ', 'e');
      return;
    }
    if (id) {
      var ex = await DB.get('checks', id);
      Object.assign(ex, d);
      await DB.put('checks', ex);
      /* افزوده شد: اگر مبلغ یا حساب بانکیِ چکِ وصول‌شده ویرایش شود،
         سند خودکارش هم باید به‌روز گردد. */
      await this.syncAutoPayment(id);
    } else {
      if (!d.status) d.status = 'pending';
      await DB.add('checks', d);
    }
    UI.close();
    await this.ll();
  },
  cs: async function(id) {
    var c = await DB.get('checks', id);
    if (!c) return;
    var sts = [{
      v: 'pending',
      l: 'در انتظار'
    }, {
      v: 'deposited',
      l: 'واریز'
    }, {
      v: 'passed',
      l: 'وصول'
    }, {
      v: 'returned',
      l: 'برگشتی'
    }];
    var op = '';
    sts.forEach(function(s) {
      op += '<option value="' + s.v + '"' + (c.status === s.v ? ' selected' : '') + '>' + s.l + '</option>';
    });
    var banks = await DB.all('banks');
    var bO = '<option value="">— بدون بانک —</option>';
    banks.forEach(function(b) {
      bO += '<option value="' + b.id + '"' + (c.bankAccountId === b.id ? ' selected' : '') + '>' + esc(b.name) + '</option>';
    });
    var h = '<div class="fg"><label>وضعیت</label><select class="fc" id="nSt">' + op + '</select></div>';
    h += '<div class="fg"><label>حساب بانکی (برای وصول)</label><select class="fc" id="nBk">' + bO + '</select></div>';
    UI.open('تغییر وضعیت چک', h,
      '<button class="btn bp" onclick="Chk.ss(' + id + ')">ذخیره</button>' +
      '<button class="btn bo" onclick="UI.close()">انصراف</button>');
  },
  ss: async function(id) {
    var c = await DB.get('checks', id);
    if (!c) return;
    c.status = elVal('nSt');
    c.bankAccountId = intOf(elVal('nBk')) || null;
    if (c.status === 'passed') c.passedDate = todayJ();
    await DB.put('checks', c);
    /* افزوده شد: وصول چک باید مثل فاکتور یک سند دریافت/پرداخت واقعی
       بسازد. قبلاً فقط وضعیت چک عوض می‌شد و هیچ ردی در صفحه
       دریافت/پرداخت نمی‌ماند. */
    await this.syncAutoPayment(id);
    UI.close();
    await this.ll();
  },

  /* سند خودکارِ وصول چک — دقیقاً هم‌الگوی Inv.syncAutoPayment.
     فقط چکِ «وصول‌شده»ای که حساب بانکی دارد سند می‌سازد، چون تنها در آن
     لحظه پول واقعاً وارد/خارج بانک می‌شود. با تغییر وضعیت به هر چیز
     دیگری سند حذف می‌گردد.

     توجه مهم: این سند روی مانده «شخص» اثر نمی‌گذارد. مانده شخص از خودِ
     چک محاسبه می‌شود (به‌محض دریافت چک، نه هنگام وصول) و اگر این سند هم
     شمرده می‌شد، بدهی طرف دو برابر کم می‌شد. برای همین در محاسبه مانده
     شخص و دفتر معین، سندهای دارای sourceCheckId رد می‌شوند. */
  syncAutoPayment: async function(checkId) {
    var c = await DB.get('checks', checkId);
    var pays = await DB.all('payments');
    var linked = pays.filter(function(p) {
      return p.sourceCheckId === checkId;
    });
    var i;
    if (!c || c.status !== 'passed' || !c.bankAccountId || !(c.amount > 0)) {
      for (i = 0; i < linked.length; i++) await DB.del('payments', linked[i].id);
      return;
    }
    var label = 'بابت وصول چک ' + (c.checkNumber || c.id);
    var body = {
      type: c.type === 'received' ? 'receipt' : 'payment',
      fiscalYearId: c.fiscalYearId,
      contactId: c.contactId,
      amount: c.amount,
      date: c.passedDate || c.dueDate,
      bankId: c.bankAccountId,
      description: label,
      notes: label,
      sourceCheckId: checkId,
      auto: true
    };
    if (linked.length) {
      var keep = linked[0];
      Object.assign(keep, body);
      await DB.put('payments', keep);
      for (i = 1; i < linked.length; i++) await DB.del('payments', linked[i].id);
    } else {
      await DB.add('payments', body);
    }
  },
  transfer: async function(id) {
    await this.openTransferModal(id);
  },
  openTransferModal: async function(singleCheckId) {
    var ids = singleCheckId ? [singleCheckId] : this.getSelectedIds();
    if (!ids.length) {
      UI.toast('لطفاً حداقل یک چک را برای واگذاری انتخاب کنید', 'w');
      return;
    }
    var allChecks = await DB.all('checks');
    var checks = allChecks.filter(function(c) { return ids.indexOf(c.id) > -1; });
    if (!checks.length) return;

    var sum = 0;
    checks.forEach(function(c) { sum += numOf(c.amount); });
    var ras = this.calcRas(checks, todayJ());

    var ct = await DB.all('contacts');
    var cm = {};
    ct.forEach(function(c) { cm[c.id] = c.name; });

    // نام طرف حساب‌هایی که این چک‌ها از آنها دریافت شده
    var fromNames = [];
    checks.forEach(function(c) {
      var n = cm[c.contactId];
      if (n && fromNames.indexOf(n) === -1) fromNames.push(n);
    });

    var isTransferred = checks.some(function(c) { return c.status === 'transferred'; });
    var preSelectedTo = '';
    var preTransferDate = todayJ();
    var preTransferNotes = '';
    for (var i = 0; i < checks.length; i++) {
      if (checks[i].transferToId) {
        preSelectedTo = checks[i].transferToId;
        if (checks[i].transferDate) preTransferDate = checks[i].transferDate;
        if (checks[i].transferNotes) preTransferNotes = checks[i].transferNotes;
        break;
      }
    }

    var customers = ct.filter(function(cc) { return cc.type === 'customer'; });
    var suppliers = ct.filter(function(cc) { return cc.type === 'supplier'; });
    var both = ct.filter(function(cc) { return cc.type === 'both'; });
    var others = ct.filter(function(cc) { return cc.type !== 'customer' && cc.type !== 'supplier' && cc.type !== 'both'; });

    var op = '<option value="">— انتخاب مشتری یا تامین‌کننده (دریافت‌کننده چک) —</option>';
    if (customers.length) {
      op += '<optgroup label="مشتریان (' + customers.length + ')">';
      customers.forEach(function(s) {
        op += '<option value="' + s.id + '"' + (s.id === preSelectedTo ? ' selected' : '') + '>' + esc(s.name) + ' (مشتری)</option>';
      });
      op += '</optgroup>';
    }
    if (suppliers.length) {
      op += '<optgroup label="تامین‌کنندگان (' + suppliers.length + ')">';
      suppliers.forEach(function(s) {
        op += '<option value="' + s.id + '"' + (s.id === preSelectedTo ? ' selected' : '') + '>' + esc(s.name) + ' (تامین‌کننده)</option>';
      });
      op += '</optgroup>';
    }
    if (both.length) {
      op += '<optgroup label="مشتری و تامین‌کننده (دوطرفه)">';
      both.forEach(function(s) {
        op += '<option value="' + s.id + '"' + (s.id === preSelectedTo ? ' selected' : '') + '>' + esc(s.name) + ' (دوطرفه)</option>';
      });
      op += '</optgroup>';
    }
    if (others.length) {
      op += '<optgroup label="سایر طرف‌های حساب">';
      others.forEach(function(s) {
        op += '<option value="' + s.id + '"' + (s.id === preSelectedTo ? ' selected' : '') + '>' + esc(s.name) + '</option>';
      });
      op += '</optgroup>';
    }

    var infoBanner = '';
    if (isTransferred) {
      var currentRecipient = cm[preSelectedTo] || 'نامشخص';
      infoBanner = '<div style="margin-bottom:12px;padding:10px 14px;background:var(--sf);border:1.5px solid var(--p,#3b82f6);border-radius:10px;font-size:.84rem;color:var(--tx);display:flex;align-items:center;gap:8px">' +
        '<i class="bi bi-arrow-repeat" style="font-size:1.1rem;color:var(--p);flex-shrink:0"></i>' +
        '<div>این چک قبلاً به <strong>«' + esc(currentRecipient) + '»</strong> واگذار شده است. برای تغییر دریافت‌کننده، شخص جدید (مشتری یا تامین‌کننده) را انتخاب نمایید یا در صورت نیاز واگذاری را لغو کنید.</div>' +
        '</div>';
    }

    var h = infoBanner +
      '<div style="margin-bottom:14px;padding:12px 16px;background:var(--sf);border:1.5px solid var(--bd);border-radius:10px">' +
      '<div style="font-weight:700;margin-bottom:6px;color:var(--tx);font-size:.9rem">خلاصه چک‌های انتخابی (' + UI.fn(checks.length) + ' فقره):</div>' +
      '<div style="font-size:.85rem;color:var(--txs);display:flex;justify-content:space-between;flex-wrap:wrap;gap:10px">' +
      (fromNames.length ? '<span>دریافت‌شده از: <strong style="color:var(--tx)">' + esc(fromNames.join('، ')) + '</strong></span>' : '') +
      '<span>مجموع مبالغ: <strong style="color:var(--p);font-size:.95rem">' + UI.fn(sum) + ' ریال</strong></span>' +
      '<span>راس تاریخ چک‌ها: <strong style="color:var(--tx)">' + ras.rasDate + '</strong> (' + (ras.avgDays >= 0 ? UI.fn(ras.avgDays) + ' روز مانده' : UI.fn(Math.abs(ras.avgDays)) + ' روز گذشته') + ')</span>' +
      '</div></div>' +
      '<div class="fg"><label>واگذاری و انتقال به (مشتری یا تامین‌کننده) <span style="color:var(--d)">*</span></label>' +
      '<select class="fc" id="chkTrTo">' + op + '</select>' +
      '<span class="form-hint" style="font-size:.78rem;color:var(--txs);margin-top:4px;display:block">می‌توانید هر یک از مشتریان یا تامین‌کنندگان را به عنوان گیرنده جدید چک انتخاب کنید.</span>' +
      '</div>' +
      '<div class="fr"><div class="fg"><label>تاریخ پرداخت و واگذاری</label>' +
      '<input class="fc" id="chkTrDate" value="' + esc(preTransferDate) + '" style="text-align:center;direction:ltr"></div>' +
      '<div class="fg"><label>بابت / توضیحات سند (اختیاری)</label>' +
      '<input class="fc" id="chkTrNotes" value="' + esc(preTransferNotes) + '" placeholder="مثلاً: بابت تسویه فاکتور یا بدهی..."></div></div>';

    this._pendingTransferIds = ids;
    var footerButtons =
      '<button class="btn bp" onclick="Chk.execTransfer(true)"><i class="bi bi-printer-fill"></i> انتقال و چاپ قبض پرداخت</button>' +
      '<button class="btn bo" onclick="Chk.execTransfer(false)"><i class="bi bi-check-lg"></i> فقط انتقال و ذخیره</button>';
    if (isTransferred) {
      footerButtons += '<button class="btn bo bd" onclick="Chk.cancelTransfer()"><i class="bi bi-arrow-counterclockwise"></i> لغو واگذاری (برگشت به صندوق)</button>';
    }
    footerButtons += '<button class="btn bo" onclick="UI.close()">انصراف</button>';

    UI.open(
      isTransferred ? ('ویرایش واگذاری ' + UI.fn(checks.length) + ' چک') : ('انتقال و واگذاری ' + UI.fn(checks.length) + ' چک به مشتری یا تامین‌کننده'),
      h,
      footerButtons,
      true
    );
  },
  execTransfer: async function(andPrint) {
    if (!Perm.require('edit', 'انتقال چک')) return;
    if (!await FY.assertOpen()) return;

    var toId = intOf(elVal('chkTrTo'));
    if (!toId) {
      UI.toast('لطفاً مشتری یا تامین‌کننده (دریافت‌کننده چک) را انتخاب کنید', 'e');
      return;
    }
    var payDate = Jalali.parse(elVal('chkTrDate')) || todayJ();
    var notes = elVal('chkTrNotes').trim();

    var ids = this._pendingTransferIds || this.getSelectedIds();
    if (!ids.length) return;

    var allChecks = await DB.all('checks');
    var checks = allChecks.filter(function(c) { return ids.indexOf(c.id) > -1; });

    for (var i = 0; i < checks.length; i++) {
      var c = checks[i];
      c.status = 'transferred';
      c.transferToId = toId;
      c.transferDate = payDate;
      c.transferNotes = notes;
      await DB.put('checks', c);
    }

    var ct = await DB.get('contacts', toId);
    var recipientName = ct ? ct.name : '';

    this.clearSelection();
    UI.close();
    UI.toast(UI.fn(checks.length) + ' چک با موفقیت به ' + esc(recipientName) + ' واگذار گردید', 's');

    if (andPrint) {
      await this.previewVoucher(checks, recipientName, payDate, notes);
    }

    await this.ll();
  },
  cancelTransfer: async function() {
    if (!Perm.require('edit', 'لغو انتقال چک')) return;
    if (!await FY.assertOpen()) return;
    var ids = this._pendingTransferIds || this.getSelectedIds();
    if (!ids.length) return;
    var ok = await UI.confirm('آیا از لغو واگذاری و بازگرداندن این ' + UI.fn(ids.length) + ' چک به وضعیت «در انتظار (نزد صندوق)» اطمینان دارید؟');
    if (!ok) return;
    var allChecks = await DB.all('checks');
    var checks = allChecks.filter(function(c) { return ids.indexOf(c.id) > -1; });
    for (var i = 0; i < checks.length; i++) {
      var c = checks[i];
      c.status = 'pending';
      c.transferToId = null;
      c.transferDate = null;
      c.transferNotes = null;
      await DB.put('checks', c);
    }
    this.clearSelection();
    UI.close();
    UI.toast('واگذاری ' + UI.fn(checks.length) + ' چک لغو و به صندوق بازگردانده شد', 's');
    await this.ll();
  },
  doTr: async function(id) {
    await this.openTransferModal(id);
  },
  /* ══ محاسبه دقیق راس تاریخ چک‌ها (Weighted Maturity Date) ══ */
  calcRas: function(checks, baseDate) {
    if (!checks || !checks.length) {
      var t = Jalali.parse(baseDate || todayJ()) || Jalali.today();
      return { baseDate: t, rasDate: t, avgDays: 0, totalAmt: 0, count: 0 };
    }
    var base = Jalali.parse(baseDate || todayJ());
    if (!base) base = Jalali.today();
    var bP = base.split('/').map(Number);
    var baseJdn = Jalali.toJDN(bP[0], bP[1], bP[2]);

    var totalAmt = 0;
    var totalWeightedDays = 0;
    var validChecks = 0;

    checks.forEach(function(c) {
      var amt = numOf(c.amount);
      var dStr = Jalali.parse(c.dueDate);
      if (amt > 0 && dStr) {
        var dP = dStr.split('/').map(Number);
        var dueJdn = Jalali.toJDN(dP[0], dP[1], dP[2]);
        var diff = dueJdn - baseJdn;
        totalWeightedDays += (diff * amt);
        totalAmt += amt;
        validChecks++;
      }
    });

    if (totalAmt <= 0 || validChecks === 0) {
      return {
        baseDate: base,
        rasDate: base,
        avgDays: 0,
        totalAmt: totalAmt,
        count: checks.length
      };
    }

    var avgDays = Math.round(totalWeightedDays / totalAmt);
    var rasJdn = baseJdn + avgDays;
    var rasParts = Jalali.fromJDN(rasJdn);
    var rasDate = Jalali.format(rasParts[0], rasParts[1], rasParts[2]);

    return {
      baseDate: base,
      rasDate: rasDate,
      avgDays: avgDays,
      totalAmt: totalAmt,
      count: validChecks
    };
  },
  /* ══ قالب HTML چاپ قبض پرداخت چک ══ */
  voucherHTML: function(checks, recipientName, payDate, notes, sz) {
    var a5 = sz === 'a5';
    var pd = a5 ? '8mm' : '12mm';
    var fs = a5 ? '9px' : '11px';
    var thFs = a5 ? '9px' : '10.5px';
    var tdFs = a5 ? '8.5px' : '10px';

    payDate = Jalali.parse(payDate) || todayJ();
    var ras = this.calcRas(checks, payDate);
    var totalAmt = 0;
    checks.forEach(function(c) { totalAmt += numOf(c.amount); });

    var rows = '';
    for (var i = 0; i < checks.length; i++) {
      var c = checks[i];
      var docNum = c.docNumber || '—';
      var chkNum = c.checkNumber || '—';
      var accNum = c.accountNumber || c.sayadId || '—';
      var due = c.dueDate || '—';
      var bk = c.bank || '—';
      var br = c.branch || (c.bank && c.bank.indexOf('شعبه') > -1 ? c.bank.split('شعبه')[1].trim() : '—');
      var amt = UI.fn(c.amount);

      rows += '<tr style="text-align:center">' +
        '<td style="border:1px solid #374151;padding:5px;font-weight:700">' + UI.fn(i + 1) + '</td>' +
        '<td style="border:1px solid #374151;padding:5px;font-family:monospace;font-weight:800;letter-spacing:0.5px">' + esc(docNum) + '</td>' +
        '<td style="border:1px solid #374151;padding:5px;font-weight:800;letter-spacing:0.5px">' + esc(chkNum) + '</td>' +
        '<td style="border:1px solid #374151;padding:5px;direction:ltr;text-align:center">' + esc(accNum) + '</td>' +
        '<td style="border:1px solid #374151;padding:5px;font-weight:600">' + esc(due) + '</td>' +
        '<td style="border:1px solid #374151;padding:5px">' + esc(bk) + '</td>' +
        '<td style="border:1px solid #374151;padding:5px">' + esc(br) + '</td>' +
        '<td style="border:1px solid #374151;padding:5px;font-weight:800;text-align:center">' + amt + '</td>' +
        '</tr>';
    }

    var rasDaysText = '';
    if (ras.avgDays === 0) {
      rasDaysText = 'هم‌زمان با تاریخ پرداخت';
    } else if (ras.avgDays > 0) {
      rasDaysText = UI.fn(ras.avgDays) + ' روز پس از تاریخ پرداخت';
    } else {
      rasDaysText = UI.fn(Math.abs(ras.avgDays)) + ' روز قبل از تاریخ پرداخت';
    }

    var voucherNo = (checks.length === 1 && checks[0].docNumber) ? ('سند ' + checks[0].docNumber) : ('CHK-TR-' + (toEnDigits(payDate).replace(/\//g, '').slice(2)) + '-' + String(checks[0] ? (checks[0].id || 1) : 1).padStart(3, '0'));

    var h = '<div class="chk-voucher-box" style="direction:rtl;font-family:Vazirmatn,system-ui,sans-serif;padding:' + pd + ';background:#fff;color:#111;min-height:' + (a5 ? '185mm' : '260mm') + ';position:relative;box-sizing:border-box">';

    /* ۱. بالای کادر، وسط: اسم نرم افزار "پارچه بان" و زیر آن "قبض پرداخت چک" */
    h += '<div style="text-align:center;border-bottom:2px solid #111;padding-bottom:12px;margin-bottom:14px;position:relative">' +
      '<div style="font-size:' + (a5 ? '17px' : '22px') + ';font-weight:900;letter-spacing:0.5px;color:#000">پارچه بان</div>' +
      '<div style="font-size:' + (a5 ? '14px' : '17px') + ';font-weight:800;color:#111;margin-top:3px">قبض پرداخت چک</div>' +
      '<div style="font-size:' + (a5 ? '8.5px' : '10px') + ';color:#555;margin-top:2px">رسید واگذاری و تحویل اسناد تجاری</div>' +
      '<div style="display:flex;justify-content:space-between;align-items:center;margin-top:10px;font-size:' + (a5 ? '9px' : '10.5px') + ';color:#222;border-top:1px dashed #bbb;padding-top:6px">' +
      '<div><strong>شماره سند:</strong> <span style="font-family:monospace;font-size:11px">' + voucherNo + '</span></div>' +
      '<div><strong>تاریخ پرداخت:</strong> <span style="font-weight:700">' + esc(payDate) + '</span></div>' +
      '<div><strong>تاریخ چاپ:</strong> ' + todayJ() + '</div>' +
      '</div></div>';

    /* ۲. نام دریافت‌کننده و جزئیات */
    h += '<div style="margin-bottom:12px;padding:8px 12px;border:1px solid #ccc;border-radius:6px;background:#f9fafb;font-size:' + fs + ';display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px">' +
      '<div><strong>نام دریافت‌کننده:</strong> <span style="font-weight:800;font-size:' + (a5 ? '11px' : '13px') + ';margin-inline-start:4px">' + esc(recipientName || 'تامین‌کننده / شخص') + '</span></div>' +
      '<div><strong>تعداد چک:</strong> <span style="font-weight:700">' + UI.fn(checks.length) + ' فقره</span></div>' +
      '</div>';

    if (notes) {
      h += '<div style="margin-bottom:12px;padding:6px 10px;border:1px dashed #cbd5e1;border-radius:6px;background:#fff;font-size:' + (a5 ? '8.5px' : '10px') + '">' +
        '<strong>بابت / توضیحات:</strong> ' + esc(notes) +
        '</div>';
    }

    /* ۳. جدول مشخصات چک‌های انتخابی: ردیف، شماره سند، شماره چک، شماره حساب، تاریخ چک، بانک، شعبه، مبلغ */
    h += '<table class="chk-voucher-table" style="margin-bottom:14px;font-size:' + tdFs + '">' +
      '<thead>' +
      '<tr>' +
      '<th style="width:34px;font-size:' + thFs + '">ردیف</th>' +
      '<th style="width:65px;font-size:' + thFs + '">شماره سند</th>' +
      '<th style="font-size:' + thFs + '">شماره چک</th>' +
      '<th style="font-size:' + thFs + '">شماره حساب</th>' +
      '<th style="font-size:' + thFs + '">تاریخ چک</th>' +
      '<th style="font-size:' + thFs + '">بانک</th>' +
      '<th style="font-size:' + thFs + '">شعبه</th>' +
      '<th style="font-size:' + thFs + '">مبلغ (ریال)</th>' +
      '</tr>' +
      '</thead>' +
      '<tbody>' + rows + '</tbody>' +
      '<tfoot>' +
      /* جمع کل مبالغ به عدد و به حروف */
      '<tr style="background:#f3f4f6;font-weight:700">' +
      '<td colspan="7" style="border:1px solid #374151;padding:6px 10px;text-align:right;font-size:' + fs + '">' +
      '<strong>جمع مبلغ چک‌ها (' + UI.fn(checks.length) + ' فقره):</strong> ' +
      '<span style="font-weight:normal;color:#4b5563;margin-inline-start:6px">(' + esc(num2fa(totalAmt)) + ')</span>' +
      '</td>' +
      '<td style="border:1px solid #374151;padding:6px 10px;text-align:center;font-size:' + (a5 ? '10px' : '12px') + ';font-weight:900">' + UI.fn(totalAmt) + '</td>' +
      '</tr>' +
      /* راس تاریخ چک‌ها نسبت به تاریخ پرداخت و صدور */
      '<tr style="background:#fff;font-weight:700">' +
      '<td colspan="8" style="border:1px solid #374151;padding:8px 10px;text-align:right;font-size:' + fs + ';line-height:1.8">' +
      '📅 <strong>راس تاریخ چک‌ها نسبت به تاریخ صدور و پرداخت:</strong> ' +
      '<span style="display:inline-block;padding:2px 10px;margin:0 4px;background:#f3f4f6;border:1px solid #9ca3af;border-radius:4px;font-weight:900;color:#000">' + esc(ras.rasDate) + '</span> ' +
      '<span style="color:#4b5563;font-weight:normal">(' + rasDaysText + ')</span>' +
      '</td>' +
      '</tr>' +
      '</tfoot>' +
      '</table>';

    /* متن تایید رسید */
    h += '<div style="font-size:' + (a5 ? '8px' : '9.5px') + ';color:#4b5563;line-height:1.7;margin-bottom:24px">' +
      'بدینوسیله تأیید می‌گردد اسناد تجاری فوق‌الذکر با مشخصات مندرج در جدول، در تاریخ قید شده تحویل و واگذار گردید.' +
      '</div>';

    /* امضاها: سمت راست "امضای دریافت کننده"، سمت چپ "امضای پرداخت کننده" */
    h += '<div style="position:absolute;bottom:' + pd + ';left:' + pd + ';right:' + pd + ';display:flex;justify-content:space-between;padding-top:14px;border-top:1.5px dashed #9ca3af">' +
      '<div style="width:200px;text-align:center;font-size:' + fs + '">' +
      '<div style="font-weight:800;margin-bottom:6px">امضای دریافت کننده</div>' +
      '<div style="font-size:' + (a5 ? '8px' : '9px') + ';color:#6b7280;margin-bottom:45px">(' + esc(recipientName || 'تامین‌کننده') + ')</div>' +
      '<div style="font-size:' + (a5 ? '8px' : '9.5px') + ';color:#9ca3af">مهر و امضاء</div>' +
      '</div>' +
      '<div style="width:200px;text-align:center;font-size:' + fs + '">' +
      '<div style="font-weight:800;margin-bottom:6px">امضای پرداخت کننده</div>' +
      '<div style="font-size:' + (a5 ? '8px' : '9px') + ';color:#6b7280;margin-bottom:45px">(پارچه بان)</div>' +
      '<div style="font-size:' + (a5 ? '8px' : '9.5px') + ';color:#9ca3af">مهر و امضاء</div>' +
      '</div>' +
      '</div>';

    h += '</div>';
    return h;
  },
  openPrintModal: async function(checkIds, recipientId, payDate, notes) {
    var ids = checkIds || this.getSelectedIds();
    if (!ids.length) {
      UI.toast('لطفاً حداقل یک چک را برای چاپ قبض انتخاب کنید', 'w');
      return;
    }
    var allChecks = await DB.all('checks');
    var checks = allChecks.filter(function(c) { return ids.indexOf(c.id) > -1; });
    if (!checks.length) return;

    var ct = await DB.all('contacts');
    var cm = {};
    ct.forEach(function(c) { cm[c.id] = c.name; });

    var targetName = '';
    if (recipientId) {
      targetName = cm[recipientId] || '';
    } else {
      var trIds = checks.map(function(c) { return c.transferToId; }).filter(Boolean);
      if (trIds.length && trIds.every(function(x) { return x === trIds[0]; })) {
        targetName = cm[trIds[0]] || '';
      } else if (trIds.length) {
        targetName = cm[trIds[0]] || '';
      } else {
        // چک‌ها هنوز واگذار نشده‌اند؛ ابتدا مدال انتقال باز می‌شود تا مشتری یا تامین‌کننده مشخص گردد
        UI.toast('برای صدور قبض پرداخت، ابتدا دریافت‌کننده (مشتری یا تامین‌کننده) را مشخص نمایید', 'i');
        await this.openTransferModal(ids.length === 1 ? ids[0] : null);
        return;
      }
    }

    payDate = payDate || (checks[0].transferDate || todayJ());
    notes = notes || (checks[0].transferNotes || checks[0].notes || '');

    await this.previewVoucher(checks, targetName, payDate, notes);
  },
  previewVoucher: async function(checks, recipientName, payDate, notes) {
    if (!checks || !checks.length) return;
    this._currentVoucher = {
      checks: checks,
      recipientName: recipientName,
      payDate: payDate,
      notes: notes
    };

    var vHtml = this.voucherHTML(checks, recipientName, payDate, notes, 'a4');

    var ct = await DB.all('contacts');
    var allContacts = ct.filter(function(cc) {
      return cc.type === 'supplier' || cc.type === 'both' || cc.type === 'customer';
    });

    var editBar = '<div style="margin-bottom:12px;padding:8px 12px;background:var(--sf);border:1px solid var(--bd);border-radius:10px;display:flex;gap:10px;align-items:center;flex-wrap:wrap">' +
      '<div style="font-size:.82rem;font-weight:700">تنظیمات قبض:</div>' +
      '<div style="display:flex;align-items:center;gap:6px">' +
      '<label style="font-size:.8rem;color:var(--txs)">دریافت‌کننده (مشتری/تامین‌کننده):</label>' +
      '<input id="vRecipInput" class="fc" value="' + esc(recipientName || '') + '" list="recipList" style="width:170px;padding:4px 8px;font-size:.82rem" oninput="Chk.onVoucherMetaChange()">' +
      '<datalist id="recipList">' + allContacts.map(function(s){
        var tag = s.type === 'customer' ? ' (مشتری)' : (s.type === 'supplier' ? ' (تامین‌کننده)' : '');
        return '<option value="' + esc(s.name) + '">' + esc(s.name + tag) + '</option>';
      }).join('') + '</datalist>' +
      '</div>' +
      '<div style="display:flex;align-items:center;gap:6px">' +
      '<label style="font-size:.8rem;color:var(--txs)">تاریخ پرداخت:</label>' +
      '<input id="vDateInput" class="fc" value="' + esc(payDate) + '" style="width:110px;padding:4px 8px;font-size:.82rem;text-align:center" oninput="Chk.onVoucherMetaChange()">' +
      '</div>' +
      '<div style="display:flex;align-items:center;gap:6px;flex:1">' +
      '<label style="font-size:.8rem;color:var(--txs)">بابت:</label>' +
      '<input id="vNotesInput" class="fc" value="' + esc(notes || '') + '" placeholder="توضیحات..." style="padding:4px 8px;font-size:.82rem" oninput="Chk.onVoucherMetaChange()">' +
      '</div>' +
      '<button class="btn bo bs" onclick="Chk.saveVoucherMetaToChecks()" title="ذخیره نام دریافت‌کننده و تاریخ در اطلاعات چک‌ها" style="font-size:.78rem;padding:4px 10px"><i class="bi bi-check2"></i> ذخیره در چک‌ها</button>' +
      '</div>';

    var container = editBar + '<div id="voucherPreviewArea" style="max-height:65vh;overflow-y:auto;border:1px solid #ccc;border-radius:8px">' + vHtml + '</div>';

    UI.open(
      'قبض پرداخت چک (' + UI.fn(checks.length) + ' فقره)',
      container,
      '<button class="btn bp" onclick="Chk.prCurrentVoucher(\'a4\')"><i class="bi bi-printer-fill"></i> چاپ قبض (A4)</button>' +
      '<button class="btn bw" onclick="Chk.prCurrentVoucher(\'a5\')"><i class="bi bi-printer"></i> چاپ قبض (A5)</button>' +
      '<button class="btn bo" onclick="UI.close()">بستن</button>',
      true
    );
  },
  saveVoucherMetaToChecks: async function() {
    if (!this._currentVoucher || !this._currentVoucher.checks.length) return;
    var r = (elVal('vRecipInput') || '').trim();
    var d = Jalali.parse(elVal('vDateInput')) || todayJ();
    var n = (elVal('vNotesInput') || '').trim();
    if (!r) {
      UI.toast('نام دریافت‌کننده نمی‌تواند خالی باشد', 'w');
      return;
    }
    var ct = await DB.all('contacts');
    var matched = ct.find(function(x) { return x.name.trim().toLowerCase() === r.toLowerCase(); });
    for (var i = 0; i < this._currentVoucher.checks.length; i++) {
      var c = this._currentVoucher.checks[i];
      c.status = 'transferred';
      if (matched) c.transferToId = matched.id;
      c.transferDate = d;
      c.transferNotes = n;
      await DB.put('checks', c);
    }
    UI.toast('اطلاعات واگذاری چک‌ها با موفقیت ذخیره شد', 's');
    await this.ll();
  },
  onVoucherMetaChange: function() {
    if (!this._currentVoucher) return;
    var r = elVal('vRecipInput').trim();
    var d = Jalali.parse(elVal('vDateInput')) || todayJ();
    var n = elVal('vNotesInput').trim();
    this._currentVoucher.recipientName = r;
    this._currentVoucher.payDate = d;
    this._currentVoucher.notes = n;
    var preview = document.getElementById('voucherPreviewArea');
    if (preview) {
      preview.innerHTML = this.voucherHTML(this._currentVoucher.checks, r, d, n, 'a4');
    }
  },
  prCurrentVoucher: function(sz) {
    if (!this._currentVoucher) return;
    var v = this._currentVoucher;
    var area = document.getElementById('printArea');
    if (!area) return;
    area.innerHTML = this.voucherHTML(v.checks, v.recipientName, v.payDate, v.notes, sz === 'a5' ? 'a5' : 'a4');
    setTimeout(function() {
      window.print();
    }, 250);
  },
  printSingleVoucher: async function(id) {
    var c = await DB.get('checks', id);
    if (!c) {
      UI.toast('چک یافت نشد', 'e');
      return;
    }
    var ct = await DB.all('contacts');
    var cm = {};
    ct.forEach(function(x) { cm[x.id] = x.name; });
    var recip = cm[c.transferToId] || '';
    if (!recip) {
      UI.toast('برای صدور قبض پرداخت، ابتدا دریافت‌کننده (مشتری یا تامین‌کننده) را مشخص نمایید', 'i');
      await this.openTransferModal(id);
      return;
    }
    var pDate = c.transferDate || todayJ();
    var notes = c.transferNotes || c.notes || '';
    await this.previewVoucher([c], recip, pDate, notes);
  },
  rm: async function(id) {
    if (!await UI.confirm('این چک حذف شود؟')) return;
    await DB.del('checks', id);
    /* افزوده شد: سند خودکارِ وصول هم باید برود، وگرنه سند یتیم می‌ماند
       و مانده بانک اشتباه می‌شود. */
    await this.syncAutoPayment(id);
    await this.ll();
  }
};

