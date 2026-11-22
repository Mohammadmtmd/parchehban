/* ══ PAYMENTS (with edit) ══ */
var Pay = {
  _fl: 'all',
  _filters: {
    contactId: '',
    dateFrom: '',
    dateTo: '',
    status: 'all'
  },
  render: async function() {
    currentPage = 'payments';
    UI.nav('payments');
    UI.title('bi-wallet2', 'پرداخت و دریافت');
    UI.act('<button class="btn bg" onclick="Pay.showF(\'receipt\')">دریافت</button> <button class="btn bdn" onclick="Pay.showF(\'payment\')">پرداخت</button> <button class="btn bw" onclick="Pay.showTransfer()">حواله</button>');
    this._fl = 'all';
    this._filters = {
      contactId: '',
      dateFrom: '',
      dateTo: '',
      status: 'all'
    };
    await this.ll('all');
  },
  setFilter: async function(key, val) {
    if (key === 'type') {
      this._fl = val || 'all';
    } else {
      if (!this._filters) this._filters = { contactId: '', dateFrom: '', dateTo: '', status: 'all' };
      this._filters[key] = val == null ? '' : String(val).trim();
    }
    var pk = 'pay_' + (this._fl || 'all');
    if (typeof Pag !== 'undefined' && typeof Pag.reset === 'function') Pag.reset(pk);
    await this.ll();
  },
  resetFilters: async function() {
    this._fl = 'all';
    this._filters = {
      contactId: '',
      dateFrom: '',
      dateTo: '',
      status: 'all'
    };
    if (typeof Pag !== 'undefined' && typeof Pag.reset === 'function') Pag.reset('pay_all');
    await this.ll('all');
  },
  ll: async function(fl) {
    if (fl) this._fl = fl;
    else fl = this._fl || 'all';
    if (!this._filters) {
      this._filters = { contactId: '', dateFrom: '', dateTo: '', status: 'all' };
    }
    var fContact = this._filters.contactId || '';
    var fDateFrom = this._filters.dateFrom || '';
    var fDateTo = this._filters.dateTo || '';
    var fStatus = this._filters.status || 'all';

    var all = (await FY.byYear('payments')) || [];
    var ct = (await DB.all('contacts')) || [],
      cm = {};
    ct.forEach(function(c) {
      if (c && c.id != null) cm[c.id] = c.name;
    });
    var ls = all.slice().sort(function(a, b) {
      return (b.id || 0) - (a.id || 0);
    });
    if (fl === 'receipt') ls = ls.filter(function(p) {
      return p.type === 'receipt';
    });
    if (fl === 'payment') ls = ls.filter(function(p) {
      return p.type === 'payment';
    });
    if (fl === 'transfer') ls = ls.filter(function(p) {
      return p.transferId;
    });

    if (fContact === '__none__') {
      ls = ls.filter(function(p) {
        return !p.contactId;
      });
    } else if (fContact) {
      ls = ls.filter(function(p) {
        return String(p.contactId || '') === String(fContact);
      });
    }

    var dFromNum = fDateFrom ? pn(fDateFrom) : 0;
    var dToNum = fDateTo ? pn(fDateTo) : 0;
    if (dFromNum > 0) {
      ls = ls.filter(function(p) {
        var d = pn(p.date);
        return d > 0 && d >= dFromNum;
      });
    }
    if (dToNum > 0) {
      ls = ls.filter(function(p) {
        var d = pn(p.date);
        return d > 0 && d <= dToNum;
      });
    }

    if (fStatus && fStatus !== 'all') {
      ls = ls.filter(function(p) {
        var isAutoDoc = !!(p.sourceInvoiceId || p.sourceCheckId);
        var hasAlloc = Array.isArray(p.invoiceAllocations) && p.invoiceAllocations.some(function(a) {
          return a && numOf(a.amount) > 0;
        });
        if (fStatus === 'allocated') return !!p.sourceInvoiceId || hasAlloc;
        if (fStatus === 'unallocated') return !isAutoDoc && !p.transferId && !hasAlloc;
        if (fStatus === 'auto') return isAutoDoc;
        if (fStatus === 'manual') return !isAutoDoc && !p.transferId;
        return true;
      });
    }

    /* صفحه‌بندی — قبلاً کل تراکنش‌ها در یک صفحه رندر می‌شد */
    var pk = 'pay_' + fl;
    Pag.register(pk, function() {
      return Pay.ll(fl);
    });
    var pg = Pag.slice(pk, ls);
    var tAmt = 0;
    ls.forEach(function(x) {
      tAmt += numOf(x.amount);
    });
    var r = '';
    for (var i = 0; i < pg.items.length; i++) {
      var p = pg.items[i];
      var tl = p.transferId ? 'حواله' : (p.type === 'receipt' ? 'دریافت' : 'پرداخت');
      /* اصلاح باگ: خط دوم، مقدار درست را بازنویسی می‌کرد و برچسب
         بنفش «حواله» هرگز نمایش داده نمی‌شد. */
      var tt = p.transferId ? 'tg-p' : (p.type === 'receipt' ? 'tg-g' : 'tg-r');
      /* اسناد خودکارِ ساخته‌شده از فاکتور قابل ویرایش دستی نیستند —
         باید از خود فاکتور اصلاح شوند تا دو طرف ناهماهنگ نشوند. */
      var isAutoInv = !!p.sourceInvoiceId;
      var isAutoChk = !!p.sourceCheckId;
      var isAuto = isAutoInv || isAutoChk;
      var actions;
      if (isAutoInv) {
        actions = '<button class="bi2" title="نمایش فاکتور مبدأ" onclick="Inv.vw(' + p.sourceInvoiceId + ')"><i class="bi bi-receipt"></i></button>' +
          ' <button class="bi2" title="ویرایش از طریق فاکتور" onclick="Pay.autoNote()"><i class="bi bi-lock"></i></button>';
      } else if (isAutoChk) {
        /* سند وصول چک هم مثل سند فاکتور دستی ویرایش نمی‌شود؛ باید از
           صفحه چک‌ها اصلاح گردد تا دو طرف ناهماهنگ نشوند. */
        actions = '<button class="bi2" title="رفتن به چک‌ها" onclick="location.hash=\'#checks\'"><i class="bi bi-card-checklist"></i></button>' +
          ' <button class="bi2" title="ویرایش از طریق چک" onclick="Pay.autoNoteChk()"><i class="bi bi-lock"></i></button>';
      } else {
        actions = '<button class="bi2" onclick="Pay.showF(\'' + p.type + '\',' + p.id + ')"><i class="bi bi-pencil"></i></button>' +
          ' <button class="bi2 d" onclick="Pay.rm(' + p.id + ')"><i class="bi bi-trash3"></i></button>';
      }
      var srcTag = isAuto ? ' <span class="tg tg-b" title="' + (isAutoChk ? 'سند خودکار وصول چک' : 'سند خودکار فاکتور') + '">خودکار</span>' : '';
      var catTag = (p.category && !p.transferId)
        ? ' <span class="tg tg-p" style="font-size:10px;margin-inline-start:4px" title="سرفصل: ' + esc(p.category) + '">' + esc(p.category) + '</span>'
        : '';
      var allocHtml = '';
      if (!isAuto && !p.transferId && Array.isArray(p.invoiceAllocations) && p.invoiceAllocations.length) {
        allocHtml = '<div style="margin-top:4px;display:flex;flex-wrap:wrap;gap:4px">' +
          p.invoiceAllocations.map(function(al) {
            if (!al || !numOf(al.amount)) return '';
            var lbl = 'بابت ' + esc(al.invoiceNumber || ('#' + al.invoiceId)) + ' (' + UI.fn(al.amount) + ')';
            return '<span class="tg tg-b" style="font-size:10px;cursor:pointer" title="نمایش فاکتور" onclick="Inv.vw(' + al.invoiceId + ')">' + lbl + '</span>';
          }).join('') +
        '</div>';
      }
      if (!isAutoInv && !isAutoChk && !p.transferId) {
        actions = '<button class="bi2" title="ویرایش سند و تخصیص به فاکتور" onclick="Pay.showF(\'' + p.type + '\',' + p.id + ')"><i class="bi bi-pencil"></i></button>' +
          ' <button class="bi2 d" onclick="Pay.rm(' + p.id + ')"><i class="bi bi-trash3"></i></button>';
      }
      r += '<tr><td>' + (((pg.page - 1) * pg.per) + i + 1) + '</td><td><span class="tg ' + tt + '">' + tl + '</span>' + catTag + srcTag + '</td><td>' + p.date + '</td><td>' + esc(cm[p.contactId] || '—') + '</td><td style="font-weight:700">' + UI.fn(p.amount) + '</td><td>' + esc(p.description || p.notes || '—') + allocHtml + '</td><td style="white-space:nowrap">' + actions + '</td></tr>';
    }

    var contactOpts = '<option value="">همه اشخاص</option>' +
      '<option value="__none__"' + (fContact === '__none__' ? ' selected' : '') + '>بدون شخص (مخارج عمومی)</option>';
    ct.slice().sort(function(a, b) {
      return String(a.name || '').localeCompare(String(b.name || ''), 'fa');
    }).forEach(function(c) {
      if (!c || c.id == null) return;
      contactOpts += '<option value="' + c.id + '"' + (String(fContact) === String(c.id) ? ' selected' : '') + '>' + esc(c.name) + '</option>';
    });
    var hasActiveFilter = (fl !== 'all' || !!fContact || !!fDateFrom || !!fDateTo || fStatus !== 'all');
    var filterBar = '<div style="display:flex;align-items:flex-end;flex-wrap:wrap;gap:10px;margin-bottom:14px;background:var(--sf);padding:10px 14px;border-radius:10px;border:1px solid var(--bd)">' +
      '<div style="display:flex;flex-direction:column;gap:4px;min-width:130px;flex:1">' +
        '<label style="font-size:.75rem;color:var(--txs)">نوع</label>' +
        '<select id="payFType" class="fc" style="font-size:.82rem;padding:6px 10px" onchange="Pay.setFilter(\'type\',this.value)">' +
          '<option value="all"' + (fl === 'all' ? ' selected' : '') + '>همه انواع</option>' +
          '<option value="receipt"' + (fl === 'receipt' ? ' selected' : '') + '>دریافت</option>' +
          '<option value="payment"' + (fl === 'payment' ? ' selected' : '') + '>پرداخت</option>' +
          '<option value="transfer"' + (fl === 'transfer' ? ' selected' : '') + '>حواله</option>' +
        '</select>' +
      '</div>' +
      '<div style="display:flex;flex-direction:column;gap:4px;min-width:165px;flex:1.4">' +
        '<label style="font-size:.75rem;color:var(--txs)">شخص</label>' +
        '<select id="payFContact" class="fc" style="font-size:.82rem;padding:6px 10px" onchange="Pay.setFilter(\'contactId\',this.value)">' + contactOpts + '</select>' +
      '</div>' +
      '<div style="display:flex;flex-direction:column;gap:4px;min-width:120px;flex:1">' +
        '<label style="font-size:.75rem;color:var(--txs)">از تاریخ</label>' +
        '<input id="payFDateFrom" class="fc" dir="ltr" placeholder="1404/01/01" value="' + esc(fDateFrom) + '" style="font-size:.82rem;padding:6px 10px" onchange="Pay.setFilter(\'dateFrom\',this.value)" onkeydown="if(event.key===\'Enter\')Pay.setFilter(\'dateFrom\',this.value)">' +
      '</div>' +
      '<div style="display:flex;flex-direction:column;gap:4px;min-width:120px;flex:1">' +
        '<label style="font-size:.75rem;color:var(--txs)">تا تاریخ</label>' +
        '<input id="payFDateTo" class="fc" dir="ltr" placeholder="1404/12/29" value="' + esc(fDateTo) + '" style="font-size:.82rem;padding:6px 10px" onchange="Pay.setFilter(\'dateTo\',this.value)" onkeydown="if(event.key===\'Enter\')Pay.setFilter(\'dateTo\',this.value)">' +
      '</div>' +
      '<div style="display:flex;flex-direction:column;gap:4px;min-width:155px;flex:1.2">' +
        '<label style="font-size:.75rem;color:var(--txs)">وضعیت</label>' +
        '<select id="payFStatus" class="fc" style="font-size:.82rem;padding:6px 10px" onchange="Pay.setFilter(\'status\',this.value)">' +
          '<option value="all"' + (fStatus === 'all' ? ' selected' : '') + '>همه وضعیت‌ها</option>' +
          '<option value="allocated"' + (fStatus === 'allocated' ? ' selected' : '') + '>متصل به فاکتور</option>' +
          '<option value="unallocated"' + (fStatus === 'unallocated' ? ' selected' : '') + '>علی‌الحساب / بدون فاکتور</option>' +
          '<option value="manual"' + (fStatus === 'manual' ? ' selected' : '') + '>سند دستی</option>' +
          '<option value="auto"' + (fStatus === 'auto' ? ' selected' : '') + '>سند خودکار</option>' +
        '</select>' +
      '</div>' +
      (hasActiveFilter ? '<button type="button" class="btn bs bo" onclick="Pay.resetFilters()" style="height:34px;white-space:nowrap"><i class="bi bi-x-lg"></i> پاک کردن فیلتر</button>' : '') +
      '</div>';

    var ft = '<tfoot><tr style="background:var(--bg);font-weight:700">' +
      '<td colspan="4">جمع ' + UI.fn(ls.length) + ' تراکنش</td>' +
      '<td>' + UI.fn(tAmt) + '</td><td colspan="2"></td></tr></tfoot>';
    var tb = ls.length ?
      '<div class="tw"><table><thead><tr><th>#</th><th>نوع</th><th>تاریخ</th><th>شخص</th><th>مبلغ</th><th>شرح</th><th></th></tr></thead><tbody>' +
      r + '</tbody>' + ft + '</table></div>' + Pag.html(pk) :
      '<div class="em"><p>' + (hasActiveFilter ? 'تراکنشی با فیلترهای انتخاب‌شده یافت نشد' : 'تراکنشی نیست') + '</p></div>';
    UI.content('<div class="tab-bar"><button class="tab-btn' + (fl === 'all' ? ' active' : '') + '" onclick="Pay.ll(\'all\')">همه</button><button class="tab-btn' + (fl === 'receipt' ? ' active' : '') + '" onclick="Pay.ll(\'receipt\')">دریافت</button><button class="tab-btn' + (fl === 'payment' ? ' active' : '') + '" onclick="Pay.ll(\'payment\')">پرداخت</button><button class="tab-btn' + (fl === 'transfer' ? ' active' : '') + '" onclick="Pay.ll(\'transfer\')">حواله</button></div>' + filterBar + '<div class="cd">' + tb + '</div>');
  },
  EXPENSE_CATEGORIES: [
    'حقوق و دستمزد',
    'اجاره',
    'هزینه اداری',
    'هزینه حمل',
    'هزینه بازاریابی و تبلیغات',
    'تعمیر و نگهداری',
    'کارمزد بانکی',
    'هزینه‌های متفرقه',
    'تسویه تأمین‌کننده / خرید',
    'سایر هزینه‌ها'
  ],
  _formCtx: null,
  _getEligibleInvoices: function(cid, type) {
    var ctx = this._formCtx;
    if (!ctx || !cid) return [];
    var targetType = type === 'receipt' ? 'sale' : 'purchase';
    var selOrder = ctx.selectedOrder || [];
    var settleById = ctx.settleById || {};
    var eligible = [];
    (ctx.allInvs || []).forEach(function(inv) {
      if (!inv || inv.type !== targetType || inv.contactId !== cid) return;
      var st = settleById[inv.id];
      var remBefore = st ? Math.max(0, st.remaining) : Math.max(0, numOf(inv.grandTotal) - numOf(inv.paidAmount));
      var isSelected = selOrder.indexOf(inv.id) !== -1;
      if (remBefore > 0.01 || isSelected) {
        eligible.push({
          invoiceId: inv.id,
          invoiceUid: inv.uid || null,
          invoiceNumber: inv.invoiceNumber || ('#' + inv.id),
          date: inv.date || '',
          grandTotal: numOf(inv.grandTotal),
          paidBefore: st ? st.totalPaid : numOf(inv.paidAmount),
          remainingBeforePayment: remBefore,
          isSelected: isSelected
        });
      }
    });
    eligible.sort(function(a, b) {
      return (pn(a.date) - pn(b.date)) || ((a.invoiceId || 0) - (b.invoiceId || 0));
    });
    return eligible;
  },
  _computeFormAllocations: function(cid, amount, settleByIdOverride, allInvsOverride) {
    var ctx = this._formCtx;
    if (!ctx || !cid) {
      return { items: [], allocations: [], totalAllocated: 0, unallocatedAmount: Math.max(0, numOf(amount)) };
    }
    var targetType = ctx.type === 'receipt' ? 'sale' : 'purchase';
    var invList = allInvsOverride || ctx.allInvs || [];
    var settleMap = settleByIdOverride || ctx.settleById || {};
    var orderedItems = [];
    (ctx.selectedOrder || []).forEach(function(invId) {
      var inv = invList.find(function(x) { return x && x.id === invId; });
      if (!inv || inv.type !== targetType || inv.contactId !== cid) return;
      var st = settleMap[inv.id];
      var remBefore = st ? Math.max(0, st.remaining) : Math.max(0, numOf(inv.grandTotal) - numOf(inv.paidAmount));
      orderedItems.push({
        invoiceId: inv.id,
        invoiceUid: inv.uid || null,
        invoiceNumber: inv.invoiceNumber || ('#' + inv.id),
        date: inv.date || '',
        grandTotal: numOf(inv.grandTotal),
        remainingBeforePayment: remBefore
      });
    });
    if (typeof FinanceEngine !== 'undefined' && typeof FinanceEngine.allocatePaymentToInvoices === 'function') {
      return FinanceEngine.allocatePaymentToInvoices(amount, orderedItems);
    }
    return { items: [], allocations: [], totalAllocated: 0, unallocatedAmount: Math.max(0, numOf(amount)) };
  },
  onFormContactChange: function() {
    var cid = intOf(elVal('pCt')) || null;
    if (this._formCtx) {
      if (this._formCtx.contactId !== cid) {
        this._formCtx.contactId = cid;
        this._formCtx.selectedOrder = [];
      }
    }
    this._renderInvAllocUI();
  },
  toggleInv: function(invId) {
    var ctx = this._formCtx;
    if (!ctx) return;
    invId = intOf(invId);
    var idx = ctx.selectedOrder.indexOf(invId);
    if (idx !== -1) ctx.selectedOrder.splice(idx, 1);
    else ctx.selectedOrder.push(invId);
    this._renderInvAllocUI();
  },
  moveInv: function(invId, delta) {
    var ctx = this._formCtx;
    if (!ctx) return;
    invId = intOf(invId);
    var idx = ctx.selectedOrder.indexOf(invId);
    var targetIdx = idx + delta;
    if (idx === -1 || targetIdx < 0 || targetIdx >= ctx.selectedOrder.length) return;
    var tmp = ctx.selectedOrder[idx];
    ctx.selectedOrder[idx] = ctx.selectedOrder[targetIdx];
    ctx.selectedOrder[targetIdx] = tmp;
    this._renderInvAllocUI();
  },
  autoSelectInvs: function() {
    var ctx = this._formCtx;
    if (!ctx) return;
    var cid = intOf(elVal('pCt')) || ctx.contactId || null;
    if (!cid) return;
    var eligible = this._getEligibleInvoices(cid, ctx.type).filter(function(it) {
      return it.remainingBeforePayment > 0.01;
    });
    var am = elNum('pAm');
    var nextOrder = [];
    if (am > 0) {
      var acc = 0;
      for (var i = 0; i < eligible.length; i++) {
        nextOrder.push(eligible[i].invoiceId);
        acc += eligible[i].remainingBeforePayment;
        if (acc >= am - 0.01) break;
      }
    } else {
      eligible.forEach(function(it) {
        nextOrder.push(it.invoiceId);
      });
    }
    ctx.selectedOrder = nextOrder;
    this._renderInvAllocUI();
  },
  clearInvSelection: function() {
    if (!this._formCtx) return;
    this._formCtx.selectedOrder = [];
    this._renderInvAllocUI();
  },
  fillAmountFromSelected: function() {
    var ctx = this._formCtx;
    if (!ctx) return;
    var cid = intOf(elVal('pCt')) || ctx.contactId || null;
    var eligible = this._getEligibleInvoices(cid, ctx.type);
    var elMap = {};
    eligible.forEach(function(e) { elMap[e.invoiceId] = e; });
    var totalRem = 0;
    (ctx.selectedOrder || []).forEach(function(id) {
      if (elMap[id]) totalRem += elMap[id].remainingBeforePayment;
    });
    var amEl = document.getElementById('pAm');
    if (amEl && totalRem > 0) {
      amEl.value = UI.fn(Math.round(totalRem));
      var wEl = document.getElementById('pAm_w');
      if (wEl && typeof num2fa === 'function') wEl.textContent = num2fa(Math.round(totalRem));
    }
    this._renderInvAllocUI();
  },
  _renderInvAllocUI: function() {
    var box = document.getElementById('pInvSec');
    if (!box || !this._formCtx) return;
    var ctx = this._formCtx;
    var cid = intOf(elVal('pCt')) || null;
    var am = elNum('pAm');
    var isR = ctx.type === 'receipt';

    if (!cid) {
      box.innerHTML = '<div class="hint-box" style="font-size:.78rem;color:var(--txs)">' +
        '<i class="bi bi-receipt"></i> ' +
        (isR
          ? 'پس از انتخاب شخص، فاکتورهای فروش بازِ او برای تسویه در اینجا نمایش داده می‌شوند.'
          : 'در صورت انتخاب تأمین‌کننده، فاکتورهای خرید بازِ او برای تسویه در اینجا نمایش داده می‌شوند.') +
        '</div>';
      return;
    }

    var eligible = this._getEligibleInvoices(cid, ctx.type);
    if (!eligible.length) {
      box.innerHTML = '<div class="hint-box" style="font-size:.78rem;color:var(--txs)">' +
        '<i class="bi bi-check-circle"></i> فاکتور ' + (isR ? 'فروش' : 'خرید') +
        ' تسویه‌نشده‌ای برای این شخص وجود ندارد (این مبلغ به‌صورت علی‌الحساب در حساب شخص ثبت می‌شود).' +
        '</div>';
      return;
    }

    var allocRes = this._computeFormAllocations(cid, am);
    var allocById = {};
    (allocRes.items || []).forEach(function(it) {
      allocById[it.invoiceId] = it;
    });

    var selOrder = ctx.selectedOrder || [];
    var sumSelectedRem = 0;
    eligible.forEach(function(e) {
      if (selOrder.indexOf(e.invoiceId) !== -1) sumSelectedRem += e.remainingBeforePayment;
    });

    var h = '<div style="border:1px solid var(--bd);border-radius:8px;padding:10px 12px;background:var(--bg)">';
    h += '<div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:6px;margin-bottom:8px">';
    h += '<strong style="font-size:.82rem"><i class="bi bi-receipt-cutoff"></i> تسویه فاکتورها (اختیاری — به ترتیب انتخاب)</strong>';
    h += '<div style="display:flex;gap:6px;flex-wrap:wrap">';
    h += '<button type="button" class="btn bs bo" onclick="Pay.autoSelectInvs()" title="انتخاب فاکتورهای باز از قدیمی‌ترین به جدیدترین">انتخاب خودکار قدیمی‌ترین</button>';
    if (selOrder.length) {
      h += '<button type="button" class="btn bs bo" onclick="Pay.fillAmountFromSelected()" title="پر کردن کادر مبلغ برابر با جمع مانده فاکتورهای انتخاب‌شده">تنظیم مبلغ = ' + UI.fn(Math.round(sumSelectedRem)) + '</button>';
      h += '<button type="button" class="btn bs bo" onclick="Pay.clearInvSelection()">پاک کردن</button>';
    }
    h += '</div></div>';

    h += '<div style="display:flex;flex-direction:column;gap:6px;max-height:220px;overflow-y:auto">';
    eligible.forEach(function(inv) {
      var orderIdx = selOrder.indexOf(inv.invoiceId);
      var isSel = orderIdx !== -1;
      var al = allocById[inv.invoiceId];
      var borderCol = isSel ? 'var(--p)' : 'var(--bd)';
      var bgCol = isSel ? 'rgba(37,99,235,.05)' : '#fff';

      h += '<div style="border:1px solid ' + borderCol + ';background:' + bgCol + ';border-radius:6px;padding:7px 10px;display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px;font-size:.78rem">';
      h += '<label style="display:flex;align-items:center;gap:8px;cursor:pointer;margin:0;flex:1;min-width:190px">';
      h += '<input type="checkbox" ' + (isSel ? 'checked' : '') + ' onchange="Pay.toggleInv(' + inv.invoiceId + ')">';
      if (isSel) {
        h += '<span class="tg tg-b" style="font-size:10px;min-width:22px;text-align:center">#' + UI.fn(orderIdx + 1) + '</span>';
      }
      h += '<div><div style="font-weight:700">' + esc(inv.invoiceNumber) +
        ' <span style="font-weight:400;color:var(--txs)">(' + esc(inv.date) + ')</span></div>' +
        '<div style="font-size:.72rem;color:var(--txs)">جمع: ' + UI.fn(inv.grandTotal) + ' | مانده فعلی: <strong style="color:var(--d)">' + UI.fn(inv.remainingBeforePayment) + '</strong></div></div>';
      h += '</label>';

      h += '<div style="display:flex;align-items:center;gap:6px">';
      if (isSel && selOrder.length > 1) {
        h += '<div style="display:flex;gap:2px">';
        if (orderIdx > 0) h += '<button type="button" class="bi2" style="width:24px;height:24px" title="اولویت بالاتر" onclick="Pay.moveInv(' + inv.invoiceId + ',-1)"><i class="bi bi-arrow-up"></i></button>';
        if (orderIdx < selOrder.length - 1) h += '<button type="button" class="bi2" style="width:24px;height:24px" title="اولویت پایین‌تر" onclick="Pay.moveInv(' + inv.invoiceId + ',1)"><i class="bi bi-arrow-down"></i></button>';
        h += '</div>';
      }
      if (isSel && al) {
        if (am > 0) {
          var remAfter = al.remainingAfter;
          h += '<div style="text-align:left;font-size:.74rem">' +
            '<div style="color:var(--p);font-weight:700">تخصیص: ' + UI.fn(al.allocatedAmount) + '</div>' +
            '<div style="color:' + (remAfter <= 0 ? 'var(--ok)' : 'var(--w)') + ';font-weight:700">' +
            (remAfter <= 0 ? 'تسویه کامل (مانده: ۰)' : 'مانده جدید: ' + UI.fn(remAfter)) + '</div></div>';
        } else {
          h += '<span style="font-size:.72rem;color:var(--txs)">منتظر ورود مبلغ</span>';
        }
      }
      h += '</div></div>';
    });
    h += '</div>';

    h += '<div style="margin-top:8px;padding-top:8px;border-top:1px dashed var(--bd);font-size:.76rem;display:flex;justify-content:space-between;flex-wrap:wrap;gap:6px">';
    if (selOrder.length) {
      h += '<span>تخصیص‌یافته به <strong>' + UI.fn(selOrder.length) + '</strong> فاکتور: <strong style="color:var(--ok)">' + UI.fn(allocRes.totalAllocated) + ' ریال</strong></span>';
      if (allocRes.unallocatedAmount > 0 && am > 0) {
        h += '<span style="color:var(--w)">مازاد تخصیص‌نیافته (علی‌الحساب): <strong>' + UI.fn(allocRes.unallocatedAmount) + ' ریال</strong></span>';
      }
    } else {
      h += '<span style="color:var(--txs)">هیچ فاکتوری انتخاب نشده — این سند به حساب کل شخص منظور می‌شود و مانده فاکتورها تغییر نمی‌کند.</span>';
    }
    h += '</div></div>';
    box.innerHTML = h;
  },
  showF: async function(type, id) {
    var p = id ? await DB.get('payments', id) : null;
    var isR = type === 'receipt';
    var ct = (await DB.all('contacts')) || [];
    var rl = ct.filter(function(c) {
      return isR
        ? (c.type === 'customer' || c.type === 'both' || c.type === 'broker')
        : (c.type === 'supplier' || c.type === 'both' || c.type === 'broker');
    });
    var banks = (await DB.all('banks')) || [];
    var balMap = await Con.allBalances();
    var allInvs = (await FY.byYear('invoices')) || [];
    var allPays = (await FY.byYear('payments')) || [];

    var settleRes = (typeof FinanceEngine !== 'undefined' && typeof FinanceEngine.calculateInvoiceSettlements === 'function')
      ? FinanceEngine.calculateInvoiceSettlements(allInvs, allPays, { excludePaymentId: id || null })
      : { byInvoiceId: {}, byInvoiceUid: {} };

    var initialOrder = [];
    if (p && Array.isArray(p.invoiceAllocations)) {
      p.invoiceAllocations.forEach(function(a) {
        if (!a) return;
        var matchedInv = null;
        if (a.invoiceId != null) {
          matchedInv = allInvs.find(function(x) { return x && x.id === a.invoiceId; });
        }
        if (!matchedInv && a.invoiceUid) {
          matchedInv = allInvs.find(function(x) { return x && x.uid === a.invoiceUid; });
        }
        if (matchedInv && initialOrder.indexOf(matchedInv.id) === -1) {
          initialOrder.push(matchedInv.id);
        }
      });
    }

    this._formCtx = {
      type: type,
      editId: id || null,
      contactId: p ? (p.contactId || null) : null,
      allInvs: allInvs,
      settleById: settleRes.byInvoiceId || {},
      selectedOrder: initialOrder
    };

    /* مانده واقعی و لحظه‌ای هر طرف حساب کنار نامش می‌آید تا موقع ثبت معلوم باشد
       چقدر بدهکار/بستانکار است */
    var people = rl.map(function(c) {
      var bal = balMap[c.id] || 0;
      var roleTag = c.type === 'broker' ? ' (واسطه)' : '';
      return { v: c.id, t: c.name + roleTag + Con.balTag(bal) };
    });
    var accs = banks.map(function(b) { return { v: b.id, t: b.name }; });

    var catItems = this.EXPENSE_CATEGORIES.map(function(c) {
      return { v: c, t: c };
    });
    if (p && p.category && this.EXPENSE_CATEGORIES.indexOf(p.category) === -1) {
      catItems.push({ v: p.category, t: p.category + ' (سرفصل قدیمی / نیازمند بررسی)' });
    }

    var h = F.section(isR ? 'طرف حساب' : 'طرف حساب و سرفصل', isR ? 'bi-arrow-down-left' : 'bi-arrow-up-right') +
      F.select({
        id: 'pCt', label: isR ? 'دریافت از' : 'پرداخت به', req: isR,
        value: p ? p.contactId : '', items: people,
        empty: isR ? '— انتخاب کنید —' : '— انتخاب شخص (اختیاری در مخارج عمومی) —',
        hint: people.length ? 'مانده فعلی هر شخص کنار نامش نوشته شده' :
          (isR ? 'هیچ مشتری یا واسطه‌ای ثبت نشده — از صفحه «اشخاص»' : 'هیچ تأمین‌کننده یا واسطه‌ای ثبت نشده — از صفحه «اشخاص»')
      }) +
      (!isR ? F.select({
        id: 'pCat', label: 'سرفصل هزینه / نوع پرداخت',
        value: p ? (p.category || '') : '',
        items: catItems,
        empty: '— بدون سرفصل / تسویه عادی —',
        hint: 'هزینه‌های عملیاتی انتخاب‌شده مستقیماً در صورت سود و زیان (P&L) تفکیک و لحاظ می‌شوند'
      }) : '') +

      F.section('مبلغ و حساب', 'bi-cash-stack') +
      F.money({
        id: 'pAm', label: 'مبلغ', req: true,
        value: p ? p.amount : ''
      }) +
      F.select({
        id: 'pBk', label: 'حساب بانکی', value: p ? p.bankId : '', items: accs,
        empty: '— نقدی / بدون حساب —',
        hint: 'اگر حساب انتخاب کنید، این مبلغ در گردش همان حساب ثبت می‌شود'
      }) +
      '<div id="pInvSec" style="margin:12px 0 4px"></div>' +

      F.section('تاریخ و شرح', 'bi-calendar3') +
      F.date({
        id: 'pDt', label: 'تاریخ', req: true,
        value: p ? p.date : todayJ(),
        hint: 'قالب: سال/ماه/روز شمسی'
      }) +
      F.text({
        id: 'pNt', label: 'شرح', note: 'اختیاری',
        value: p ? (p.description || p.notes || '') : '',
        ph: isR ? 'مثلاً: تسویه فاکتور ۱۲۰۳' : 'مثلاً: علی‌الحساب خرید پارچه یا هزینه اجاره',
        hint: 'در دفتر حساب و گزارش‌ها همین متن دیده می‌شود'
      });

    var ft = p ? 'ویرایش سند و تسویه فاکتور' : (isR ? 'ثبت دریافت جدید' : 'ثبت پرداخت جدید');
    UI.open(ft, h,
      '<button class="btn ' + (isR ? 'bg' : 'bdn') + '" onclick="Pay.save(\'' + type + '\',' + (id || 'null') + ')">' +
        '<i class="bi bi-check-lg"></i> ' + (p ? 'ذخیره تغییرات' : 'ثبت') + '</button>' +
      '<button class="btn bo" onclick="UI.close()">انصراف</button>', true);

    var ctEl = document.getElementById('pCt');
    if (ctEl && ctEl.addEventListener) {
      ctEl.addEventListener('change', function() { Pay.onFormContactChange(); });
    }
    var amEl = document.getElementById('pAm');
    if (amEl && amEl.addEventListener) {
      amEl.addEventListener('input', function() { Pay._renderInvAllocUI(); });
      amEl.addEventListener('change', function() { Pay._renderInvAllocUI(); });
    }
    this._renderInvAllocUI();
    F.focusFirst('pCt');
  },

  save: async function(type, id) {
    if (!F.validate()) return;
    /* سطح دسترسی و سال مالی بسته */
    if (!Perm.require('edit', 'ثبت یا ویرایش سند')) return;
    if (!await FY.assertOpen()) return;
    var p = id ? await DB.get('payments', id) : null;
    var cid = intOf(elVal('pCt')) || null;
    var am = elNum('pAm');
    var catEl = document.getElementById('pCat');
    var cat = catEl ? catEl.value.trim() : (p ? (p.category || '') : '');

    if (type === 'receipt' && !cid) {
      UI.toast('شخص را انتخاب کنید', 'e');
      return;
    }
    if (type === 'payment' && !cid && !cat) {
      UI.toast('طرف حساب یا سرفصل هزینه را انتخاب کنید', 'e');
      return;
    }
    if (am <= 0) {
      UI.toast('مبلغ باید بزرگ‌تر از صفر باشد', 'e');
      return;
    }
    var dt = Jalali.parse(elVal('pDt'));
    if (!dt) {
      UI.toast('تاریخ نامعتبر است (نمونه صحیح: 1404/01/05)', 'e');
      return;
    }

    var invoiceAllocations = [];
    if (cid && this._formCtx && this._formCtx.type === type && Array.isArray(this._formCtx.selectedOrder) && this._formCtx.selectedOrder.length) {
      var allInvs = (await FY.byYear('invoices')) || [];
      var allPays = (await FY.byYear('payments')) || [];
      var freshSettle = (typeof FinanceEngine !== 'undefined' && typeof FinanceEngine.calculateInvoiceSettlements === 'function')
        ? FinanceEngine.calculateInvoiceSettlements(allInvs, allPays, { excludePaymentId: id || null }).byInvoiceId
        : (this._formCtx.settleById || {});
      var allocResult = this._computeFormAllocations(cid, am, freshSettle, allInvs);
      invoiceAllocations = allocResult.allocations || [];
    } else if (id && !this._formCtx && p && Array.isArray(p.invoiceAllocations) && p.contactId === cid && p.invoiceAllocations.length) {
      /* در صورت ذخیره مستقیم بدون باز کردن مودال، تخصیص‌های قبلی متناسب با مبلغ جدید بازمحاسبه می‌شوند */
      var freshInvs = (await FY.byYear('invoices')) || [];
      var freshPays = (await FY.byYear('payments')) || [];
      var freshMap = (typeof FinanceEngine !== 'undefined' && typeof FinanceEngine.calculateInvoiceSettlements === 'function')
        ? FinanceEngine.calculateInvoiceSettlements(freshInvs, freshPays, { excludePaymentId: id }).byInvoiceId
        : {};
      var targetInvType = type === 'receipt' ? 'sale' : 'purchase';
      var ord = [];
      p.invoiceAllocations.forEach(function(al) {
        if (!al) return;
        var inv = freshInvs.find(function(x) { return x && x.id === al.invoiceId && x.contactId === cid && x.type === targetInvType; });
        if (!inv) return;
        var st = freshMap[inv.id];
        ord.push({
          invoiceId: inv.id,
          invoiceUid: inv.uid || null,
          invoiceNumber: inv.invoiceNumber || ('#' + inv.id),
          date: inv.date || '',
          grandTotal: numOf(inv.grandTotal),
          remainingBeforePayment: st ? Math.max(0, st.remaining) : Math.max(0, numOf(inv.grandTotal) - numOf(inv.paidAmount))
        });
      });
      if (typeof FinanceEngine !== 'undefined' && typeof FinanceEngine.allocatePaymentToInvoices === 'function') {
        invoiceAllocations = FinanceEngine.allocatePaymentToInvoices(am, ord).allocations || [];
      }
    }

    var note = elVal('pNt').trim();
    var d = {
      type: type,
      fiscalYearId: STATE.yearId,
      contactId: cid,
      amount: am,
      date: dt,
      bankId: intOf(elVal('pBk')) || null,
      /* هر دو فیلد یک مقدار دارند چون نسخه‌های قدیمی داده از notes
         استفاده می‌کردند و کدهای دیگر هنوز آن را می‌خوانند */
      description: note,
      notes: note,
      category: cat || null,
      invoiceAllocations: invoiceAllocations
    };
    if (id) {
      var ex = p || await DB.get('payments', id);
      Object.assign(ex, d);
      await DB.put('payments', ex);
      UI.toast('ویرایش شد');
    } else {
      await DB.add('payments', d);
      UI.toast('ثبت شد');
    }
    this._formCtx = null;
    UI.close();
    await this.ll();
  },
  autoNote: function() {
    UI.toast('این سند به‌طور خودکار از فیلد «پرداخت شده» فاکتور ساخته شده است. برای تغییر مبلغ یا حساب بانکی، خودِ فاکتور را ویرایش کنید.', 'e');
  },
  autoNoteChk: function() {
    UI.toast('این سند به‌طور خودکار هنگام وصول چک ساخته شده است. برای تغییر، از صفحه چک‌ها وضعیت یا مبلغ چک را اصلاح کنید.', 'e');
  },
  rm: async function(id) {
    /* سطح دسترسی */
    if (!Perm.require('delete', 'حذف')) return;
    var pRow = await DB.get('payments', id);
    if (pRow && pRow.sourceInvoiceId) {
      this.autoNote();
      return;
    }
    if (pRow && pRow.sourceCheckId) {
      this.autoNoteChk();
      return;
    }
    var p = await DB.get('payments', id);
    /* اگر بخشی از یک حواله است، هر دو سمت آن حذف می‌شود تا حساب
       نامتوازن نماند (قبلاً فقط یک طرف حذف می‌شد). */
    if (p && p.transferId) {
      if (!await UI.confirm('این تراکنش بخشی از یک حواله است؛ هر دو طرف حواله حذف می‌شود. ادامه؟')) return;
      var all = await DB.all('payments');
      var pair = all.filter(function(x) {
        return x.transferId === p.transferId;
      });
      for (var i = 0; i < pair.length; i++) await DB.del('payments', pair[i].id);
    } else {
      if (!await UI.confirm('این تراکنش حذف شود؟')) return;
      await DB.del('payments', id);
    }
    await this.ll();
  },
  showTransfer: async function() {
    var ct = await DB.all('contacts');
    var balMap = await Con.allBalances();
    var customers = ct.filter(function(c) {
      return c.type === 'customer' || c.type === 'both';
    });
    var suppliers = ct.filter(function(c) {
      return c.type === 'supplier' || c.type === 'both';
    });
    var cO = '<option value="">— مشتری —</option>';
    customers.forEach(function(c) {
      cO += '<option value="' + c.id + '">' + esc(c.name) + Con.balTag(balMap[c.id] || 0) + '</option>';
    });
    var sO = '<option value="">— تأمین‌کننده —</option>';
    suppliers.forEach(function(c) {
      sO += '<option value="' + c.id + '">' + esc(c.name) + Con.balTag(balMap[c.id] || 0) + '</option>';
    });
    var td = todayJ();
    var h = '<div class="fr mb"><div class="fg"><label>تاریخ</label><input class="fc" id="trDt" value="' + esc(td) + '"></div><div class="fg"><label>مبلغ</label><input class="fc" id="trAm" type="number" dir="ltr"></div></div>';
    h += '<div class="fr mb"><div class="fg"><label>از مشتری</label><select class="fc" id="trFrom">' + cO + '</select></div><div class="fg"><label>به تأمین‌کننده</label><select class="fc" id="trTo">' + sO + '</select></div></div>';
    h += '<div class="fg"><label>شرح</label><input class="fc" id="trNt" placeholder="بابت..."></div>';
    UI.open('حواله بانکی', h, '<button class="btn bw" onclick="Pay.saveTransfer()">ثبت حواله</button><button class="btn bo" onclick="UI.close()">انصراف</button>');
  },
  saveTransfer: async function() {
    var fromId = intOf(elVal('trFrom')) || null;
    var toId = intOf(elVal('trTo')) || null;
    var am = elNum('trAm');
    var dt = Jalali.parse(elVal('trDt'));
    var nt = elVal('trNt').trim();
    if (!fromId) {
      UI.toast('مشتری را انتخاب کنید', 'e');
      return;
    }
    if (!toId) {
      UI.toast('تأمین‌کننده را انتخاب کنید', 'e');
      return;
    }
    if (am <= 0) {
      UI.toast('مبلغ باید بزرگ‌تر از صفر باشد', 'e');
      return;
    }
    if (!dt) {
      UI.toast('تاریخ نامعتبر است (نمونه صحیح: 1404/01/05)', 'e');
      return;
    }
    var tid = Date.now();
    await DB.add('payments', {
      type: 'receipt',
      fiscalYearId: STATE.yearId,
      contactId: fromId,
      amount: am,
      date: dt,
      description: 'حواله به ' + nt,
      notes: 'حواله بانکی — ' + nt,
      transferId: tid,
      transferTo: toId
    });
    await DB.add('payments', {
      type: 'payment',
      fiscalYearId: STATE.yearId,
      contactId: toId,
      amount: am,
      date: dt,
      description: 'حواله از مشتری — ' + nt,
      notes: 'حواله بانکی — ' + nt,
      transferId: tid,
      transferFrom: fromId
    });
    UI.close();
    UI.toast('حواله ثبت شد');
    await this.ll();
  }
};

if (typeof window !== 'undefined') {
  window.Pay = Pay;
}
if (typeof globalThis !== 'undefined') {
  globalThis.Pay = Pay;
}
if (typeof module !== 'undefined' && module.exports) {
  module.exports = Pay;
}

