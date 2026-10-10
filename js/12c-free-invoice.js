/* ══════════════════════════════════════════════════════════════
   FREE INVOICE — صدور و چاپ پیش‌فاکتور و فاکتور آزاد (پارچه‌بان)
   • ورود کاملاً تایپی اقلام بدون نیاز به تعریف قبلی کالا در انبار
   • پشتیبانی همه‌جانبه از سایزهای برگه A4 و A5 با مقیاس‌بندی دقیق
   • جلوگیری از شکست خط در شرح کالا (No Wrap) و تنظیم عرض ستون
   • پد اختصاصی امضای لمسی/موسی دیجیتال و بارگذاری مهر
   • محاسبات دقیق، مالیات، تخفیف، مانده کل و تبدیل خودکار به حروف فارسی
   • چاپ بهینه، صدور PDF و JPEG با رزولوشن بالا
   • ذخیره مستقیم در پایگاه داده Supabase بدون وابستگی به کش مرورگر
   ══════════════════════════════════════════════════════════════ */

var FreeInv = {
  _state: null,
  _sigRole: 'seller', // 'seller' | 'buyer'
  _sigColor: '#111111',
  _sigWidth: 3,
  _isDrawing: false,
  _lastX: 0,
  _lastY: 0,
  _canvas: null,
  _ctx: null,

  /* بازیابی یا ایجاد وضعیت اولیه */
  getDefaultState: function() {
    var today = typeof Jalali !== 'undefined' ? Jalali.today() : '';
    return {
      id: uuid(),
      title: 'پیش فاکتور',
      companyName: 'پارچه‌بان',
      companySubtitle: 'بورس و مرکز پخش انواع منسوجات، پارچه‌های لباسی و پرده‌ای',
      logo: null,
      invoiceNumber: 'پ-' + String(Math.floor(Math.random() * 900) + 100),
      date: today,
      buyer: {
        name: '',
        phone: '',
        ecoCode: '',
        address: '',
        contactId: null
      },
      currency: 'ریال', // 'ریال' | 'تومان'
      paperSize: 'a4',  // 'a4' | 'a5'
      noWrap: true,
      descColWidth: 250, // 200, 250, 320, 400
      items: [
        { id: 1, name: 'ویسکوز نساجی کجراه برماندو', colite: '-', shade: 'مشکی', qty: 120, price: 3800000 },
        { id: 2, name: 'فاستونی مطهری ۴۵.۵۵ اعلا', colite: 'A-12', shade: 'سرمه‌ای تیره', qty: 65, price: 7200000 },
        { id: 3, name: 'لینن شسته شده اسلپ ترک', colite: '-', shade: 'کرم نسکافه‌ای', qty: 90, price: 2950000 }
      ],
      discount: 0,
      hasTax: false,
      taxPercent: 10,
      showPrevBalance: false,
      prevBalance: 0,
      prevBalanceType: 'بدهکار', // 'بدهکار' | 'بستانکار'
      showTerms: true,
      terms: '۱. اجناس تحویل‌شده تا ۲۴ ساعت پس از تحویل، با ارائه این برگه و عدم برش پارچه قابل بررسی و تطبیق است.\n۲. تسویه نهایی فاکتور ظرف مدت توافق‌شده الزامی است.\n۳. شماره کارت جهت واریز: ۶۰۳۷-۹۹۱۸-۲۳۴۵-۶۷۸۹ بنام پارچه‌بان',
      sellerSign: null,
      buyerSign: null,
      updatedAt: new Date().toISOString()
    };
  },

  /* بارگذاری اولیه و هماهنگی پیش‌نویس */
  init: function() {
    if (!this._state) {
      try {
        var saved = localStorage.getItem('pb_free_inv_draft');
        if (saved) {
          this._state = JSON.parse(saved);
        }
      } catch (e) {
        console.warn('Error reading free invoice draft:', e);
      }
      if (!this._state || !this._state.items) {
        this._state = this.getDefaultState();
      }
    }
  },

  /* ذخیره آنی پیش‌نویس در LocalStorage */
  autoSaveDraft: function() {
    try {
      if (this._state) {
        this._state.updatedAt = new Date().toISOString();
        localStorage.setItem('pb_free_inv_draft', JSON.stringify(this._state));
      }
    } catch (e) {}
  },

  /* ایجاد فاکتور جدید و پاکسازی فرم */
  newInvoice: async function() {
    if (this._state && this._state.items && this._state.items.length > 0) {
      var ok = await UI.confirm('آیا مایلید فاکتور جاری پاک شده و یک فاکتور نو با شماره جدید ایجاد شود؟');
      if (!ok) return;
    }
    this._state = this.getDefaultState();
    this.autoSaveDraft();
    this.render();
    UI.toast('فاکتور جدید ایجاد شد', 'i');
  },

  /* ══ رندر اصلی صفحه در تب "پیش فاکتور آزاد" ══ */
  render: async function() {
    currentPage = 'free-invoice';
    UI.nav('free-invoice');
    UI.title('bi-pencil-square', 'پیش فاکتور آزاد');
    UI.act('');

    this.init();
    var s = this._state;

    // بررسی اتصال ابری Supabase برای نمایش وضعیت زنده
    var supaCfg = typeof Sync !== 'undefined' ? Sync.getConfig() : { configured: false };

    var h = '<div class="free-inv-container" id="freeInvContainer">' +
      /* ── نوار ابزار و کنترل‌ها ── */
      '<div class="free-inv-toolbar">' +
        '<div class="free-inv-tool-group actions-group">' +
          '<button type="button" class="btn bp" onclick="FreeInv.print()" title="چاپ مستقیم با پرینتر"><i class="bi bi-printer-fill"></i> چاپ با چاپگر</button>' +
          '<button type="button" class="btn bdn" onclick="FreeInv.exportPDF()" title="خروجی PDF باکیفیت"><i class="bi bi-file-earmark-pdf-fill"></i> ذخیره PDF</button>' +
          '<button type="button" class="btn bg" onclick="FreeInv.exportJPEG()" title="دانلود عکس JPEG با رزولوشن بالا"><i class="bi bi-file-earmark-image-fill"></i> ذخیره عکس (JPEG)</button>' +
          '<button type="button" class="btn bp" onclick="FreeInv.saveToSupabase()" title="ذخیره مستقیم در Supabase"><i class="bi bi-cloud-arrow-up-fill"></i> ذخیره در Supabase</button>' +
          '<button type="button" class="btn bo" onclick="FreeInv.openArchiveModal()" title="مرور فاکتورهای ذخیره شده"><i class="bi bi-archive-fill"></i> آرشیو فاکتورها</button>' +
          '<button type="button" class="btn bo" onclick="FreeInv.newInvoice()" title="ایجاد فاکتور جدید"><i class="bi bi-plus-circle"></i> فاکتور جدید</button>' +
        '</div>' +
        '<div class="free-inv-tool-group settings-group">' +
          /* سوئیچ اندازه برگه */
          '<div class="free-tool-item">' +
            '<label><i class="bi bi-aspect-ratio"></i> سایز کاغذ:</label>' +
            '<div class="btn-group-pill">' +
              '<button type="button" class="' + (s.paperSize === 'a4' ? 'active' : '') + '" onclick="FreeInv.setPaperSize(\'a4\')">A4 استاندارد</button>' +
              '<button type="button" class="' + (s.paperSize === 'a5' ? 'active' : '') + '" onclick="FreeInv.setPaperSize(\'a5\')">A5 کوچک</button>' +
            '</div>' +
          '</div>' +
          /* سوئیچ عنوان */
          '<div class="free-tool-item">' +
            '<label><i class="bi bi-type"></i> عنوان:</label>' +
            '<div class="btn-group-pill">' +
              '<button type="button" class="' + (s.title === 'پیش فاکتور' ? 'active' : '') + '" onclick="FreeInv.setTitlePreset(\'پیش فاکتور\')">پیش فاکتور</button>' +
              '<button type="button" class="' + (s.title === 'صورتحساب فروش' ? 'active' : '') + '" onclick="FreeInv.setTitlePreset(\'صورتحساب فروش\')">صورتحساب فروش</button>' +
              '<button type="button" class="' + (s.title === 'فاکتور فروش' ? 'active' : '') + '" onclick="FreeInv.setTitlePreset(\'فاکتور فروش\')">فاکتور فروش</button>' +
            '</div>' +
          '</div>' +
          /* سوئیچ واحد پول */
          '<div class="free-tool-item">' +
            '<label><i class="bi bi-cash-stack"></i> واحد پول:</label>' +
            '<div class="btn-group-pill">' +
              '<button type="button" class="' + (s.currency === 'ریال' ? 'active' : '') + '" onclick="FreeInv.setCurrency(\'ریال\')">ریال</button>' +
              '<button type="button" class="' + (s.currency === 'تومان' ? 'active' : '') + '" onclick="FreeInv.setCurrency(\'تومان\')">تومان</button>' +
            '</div>' +
          '</div>' +
          /* تنظیم عرض ستون شرح کالا */
          '<div class="free-tool-item">' +
            '<label><i class="bi bi-arrows-expand"></i> عرض شرح:</label>' +
            '<select class="fc fc-sm" onchange="FreeInv.setDescWidth(this.value)">' +
              '<option value="200"' + (s.descColWidth === 200 ? ' selected' : '') + '>معمولی (200px)</option>' +
              '<option value="250"' + (s.descColWidth === 250 ? ' selected' : '') + '>پیش‌فرض (250px)</option>' +
              '<option value="320"' + (s.descColWidth === 320 ? ' selected' : '') + '>بزرگ (320px)</option>' +
              '<option value="400"' + (s.descColWidth === 400 ? ' selected' : '') + '>خیلی بزرگ (400px)</option>' +
            '</select>' +
          '</div>' +
          /* جلوگیری از شکست خط */
          '<div class="free-tool-item">' +
            '<label class="pr-check-label" title="نام‌های طولانی پارچه شکسته نشده و در یک خط باقی می‌مانند">' +
              '<input type="checkbox" ' + (s.noWrap ? 'checked' : '') + ' onchange="FreeInv.toggleNoWrap(this.checked)">' +
              '<span>عدم شکست خطوط (No Wrap)</span>' +
            '</label>' +
          '</div>' +
          /* نشانگر وضعیت Supabase */
          '<div class="free-tool-item">' +
            '<div class="free-supa-badge ' + (supaCfg.configured ? 'connected' : 'local') + '" onclick="FreeInv.openSupaConfigModal()" title="' + (supaCfg.configured ? 'پایگاه داده ابری Supabase متصل است (کلیک برای مشاهده تنظیمات)' : 'Supabase متصل نیست — برای اتصال پایدار کلیک کنید') + '">' +
              '<i class="bi bi-' + (supaCfg.configured ? 'cloud-check-fill' : 'cloud-slash') + '"></i> ' +
              '<span>' + (supaCfg.configured ? 'متصل به Supabase' : 'ذخیره محلی (آفلاین)') + '</span>' +
            '</div>' +
          '</div>' +
        '</div>' +
      '</div>' +

      /* ── برگه اصلی فاکتور ── */
      '<div class="free-inv-sheet-wrap">' +
        '<div id="freeInvPaperSheet" class="free-inv-sheet ' + s.paperSize + '">' +
          this._renderSheetHtml() +
        '</div>' +
      '</div>' +
    '</div>';

    UI.content(h);
    this._attachLiveEvents();
  },

  /* رندر محتوای برگه فاکتور */
  _renderSheetHtml: function() {
    var s = this._state;
    var subtotal = 0;
    s.items.forEach(function(it) {
      subtotal += (numOf(it.qty) * numOf(it.price));
    });

    var discount = numOf(s.discount);
    var taxable = Math.max(0, subtotal - discount);
    var tax = s.hasTax ? Math.round(taxable * (numOf(s.taxPercent) / 100)) : 0;
    var payable = Math.max(0, taxable + tax);
    var prevBal = numOf(s.prevBalance);

    var cur = s.currency || 'ریال';
    var wordsPayable = (typeof numToWordsFa !== 'undefined' ? numToWordsFa(payable) : num2fa(payable)) + ' ' + cur;
    var wordsPrev = (typeof numToWordsFa !== 'undefined' ? numToWordsFa(Math.abs(prevBal)) : num2fa(Math.abs(prevBal))) + ' ' + cur + ' (' + (s.prevBalanceType || 'بدهکار') + ')';

    var h = '<!-- سربرگ فاکتور -->' +
      '<div class="free-header">' +
        '<div class="free-hdr-right">' +
          '<div class="free-logo-box" onclick="FreeInv.changeLogo()" title="کلیک برای درج یا تغییر لوگوی مجموعه">' +
            (s.logo ? '<img src="' + s.logo + '" class="free-logo-img" alt="لوگو">' : '<div class="free-logo-placeholder"><i class="bi bi-image"></i><span>درج لوگو</span></div>') +
            (s.logo ? '<button type="button" class="free-logo-del" onclick="event.stopPropagation();FreeInv.removeLogo();" title="حذف لوگو"><i class="bi bi-x"></i></button>' : '') +
          '</div>' +
          '<div class="free-company-info">' +
            '<input type="text" class="free-inp-title free-comp-name" value="' + esc(s.companyName || 'پارچه‌بان') + '" onchange="FreeInv.updateField(\'companyName\', this.value)" placeholder="نام مجموعه / فروشگاه">' +
            '<input type="text" class="free-inp-sub free-comp-sub" value="' + esc(s.companySubtitle || '') + '" onchange="FreeInv.updateField(\'companySubtitle\', this.value)" placeholder="زیرعنوان یا نشانی مختصر">' +
          '</div>' +
        '</div>' +
        '<div class="free-hdr-center">' +
          '<div class="free-title-badge">' +
            '<input type="text" class="free-inv-title-inp" value="' + esc(s.title || 'پیش فاکتور') + '" onchange="FreeInv.updateField(\'title\', this.value)">' +
          '</div>' +
        '</div>' +
        '<div class="free-hdr-left">' +
          '<div class="free-meta-row">' +
            '<span class="meta-label">شماره:</span>' +
            '<input type="text" class="free-meta-inp" value="' + esc(s.invoiceNumber || '') + '" onchange="FreeInv.updateField(\'invoiceNumber\', this.value)" placeholder="پ-001">' +
          '</div>' +
          '<div class="free-meta-row">' +
            '<span class="meta-label">تاریخ:</span>' +
            '<input type="text" class="free-meta-inp" value="' + esc(s.date || '') + '" onchange="FreeInv.updateField(\'date\', this.value)" placeholder="1405/01/01">' +
            '<button type="button" class="btn bo bs btn-today-date" onclick="FreeInv.setTodayDate()" title="درج تاریخ امروز"><i class="bi bi-calendar-check"></i> امروز</button>' +
          '</div>' +
        '</div>' +
      '</div>' +

      /* خط تفکیک ضخیم افقی نساجی */
      '<div class="textile-divider-line"></div>' +

      /* کادر گرد مشخصات خریدار / مشتری */
      '<div class="free-buyer-box">' +
        '<div class="free-buyer-hdr">' +
          '<span><i class="bi bi-person-badge-fill"></i> مشخصات خریدار / طرف حساب</span>' +
          '<button type="button" class="btn bo bs btn-pick-contact" onclick="FreeInv.openContactPicker()"><i class="bi bi-people"></i> انتخاب مشتری از اشخاص برنامه</button>' +
        '</div>' +
        '<div class="free-buyer-grid">' +
          '<div class="buyer-cell">' +
            '<label>نام خریدار:</label>' +
            '<input type="text" value="' + esc(s.buyer.name || '') + '" onchange="FreeInv.updateBuyerField(\'name\', this.value)" placeholder="نام شخص یا شرکت خریدار">' +
          '</div>' +
          '<div class="buyer-cell">' +
            '<label>شماره تماس:</label>' +
            '<input type="text" value="' + esc(s.buyer.phone || '') + '" onchange="FreeInv.updateBuyerField(\'phone\', this.value)" placeholder="همراه / تلفن">' +
          '</div>' +
          '<div class="buyer-cell">' +
            '<label>شناسه اقتصادی / کد ملی:</label>' +
            '<input type="text" value="' + esc(s.buyer.ecoCode || '') + '" onchange="FreeInv.updateBuyerField(\'ecoCode\', this.value)" placeholder="کد اقتصادی یا کد ملی">' +
          '</div>' +
          '<div class="buyer-cell full-width">' +
            '<label>نشانی:</label>' +
            '<input type="text" value="' + esc(s.buyer.address || '') + '" onchange="FreeInv.updateBuyerField(\'address\', this.value)" placeholder="نشانی محل تحویل کالا یا انبار خریدار">' +
          '</div>' +
        '</div>' +
      '</div>' +

      /* جدول اقلام و کالاها */
      '<div class="free-table-wrap">' +
        '<table class="free-table' + (s.noWrap ? ' no-wrap-mode' : '') + '">' +
          '<thead>' +
            '<tr>' +
              '<th style="width:40px">#</th>' +
              '<th style="width:' + (s.descColWidth || 250) + 'px" class="col-desc">شرح کالا</th>' +
              '<th style="width:75px">کالیته</th>' +
              '<th style="width:110px">شید / رنگ</th>' +
              '<th style="width:105px">تعداد / متراژ</th>' +
              '<th style="width:130px">فی واحد (' + cur + ')</th>' +
              '<th style="width:140px">جمع کل (' + cur + ')</th>' +
              '<th style="width:70px" class="no-print">عملیات</th>' +
            '</tr>' +
          '</thead>' +
          '<tbody id="freeItemsTbody">' +
            this._renderItemsRowsHtml() +
          '</tbody>' +
        '</table>' +
        '<div class="free-table-actions no-print">' +
          '<button type="button" class="btn bp bs" onclick="FreeInv.addItem()"><i class="bi bi-plus-lg"></i> افزودن ردیف جدید</button>' +
          '<button type="button" class="btn bo bs text-d" onclick="FreeInv.clearAllItems()"><i class="bi bi-trash"></i> پاکسازی همه ردیف‌ها</button>' +
        '</div>' +
      '</div>' +

      /* بخش محاسبات مالی و تبدیل به حروف فارسی */
      '<div class="free-bottom-section">' +
        '<div class="free-bottom-right">' +
          /* کادر خط‌چین حروف فارسی (Dashed Border) */
          '<div class="free-words-box">' +
            '<div class="words-line">' +
              '<span class="words-title"><i class="bi bi-card-text"></i> مبلغ قابل پرداخت به حروف:</span>' +
              '<span class="words-text">' + wordsPayable + '</span>' +
            '</div>' +
            (s.showPrevBalance ? 
              '<div class="words-line words-prev-line">' +
                '<span class="words-title"><i class="bi bi-wallet2"></i> مانده حساب قبلی به حروف:</span>' +
                '<span class="words-text text-d">' + wordsPrev + '</span>' +
              '</div>' : '') +
          '</div>' +

          /* کادر توضیحات و شرایط فاکتور */
          (s.showTerms ? 
            '<div class="free-terms-box">' +
              '<div class="terms-hdr">' +
                '<span><i class="bi bi-shield-check"></i> شرایط و توضیحات فاکتور:</span>' +
                '<button type="button" class="btn-hide-terms no-print" onclick="FreeInv.toggleTerms(false)" title="مخفی کردن شرایط در چاپ"><i class="bi bi-eye-slash"></i> مخفی‌سازی</button>' +
              '</div>' +
              '<textarea class="free-terms-text" onchange="FreeInv.updateField(\'terms\', this.value)" rows="3">' + esc(s.terms || '') + '</textarea>' +
            '</div>' : 
            '<div class="no-print" style="margin-top:10px">' +
              '<button type="button" class="btn bo bs" onclick="FreeInv.toggleTerms(true)"><i class="bi bi-eye"></i> نمایش کادر شرایط فاکتور</button>' +
            '</div>'
          ) +
        '</div>' +

        /* کادر فشرده مبالغ در پایین جدول */
        '<div class="free-totals-card">' +
          '<table class="totals-table">' +
            '<tr>' +
              '<td>جمع اقلام:</td>' +
              '<td class="val-cell">' + UI.fn(subtotal) + ' ' + cur + '</td>' +
            '</tr>' +
            '<tr>' +
              '<td>تخفیف:</td>' +
              '<td class="val-cell">' +
                '<input type="text" class="totals-inp" value="' + (discount ? UI.fn(discount) : '') + '" placeholder="۰" oninput="FreeInv.onNumberInput(this, \'discount\')">' +
              '</td>' +
            '</tr>' +
            '<tr>' +
              '<td>' +
                '<label class="pr-check-label inline-check">' +
                  '<input type="checkbox" ' + (s.hasTax ? 'checked' : '') + ' onchange="FreeInv.toggleTax(this.checked)">' +
                  '<span>مالیات (' + (s.taxPercent || 10) + '٪):</span>' +
                '</label>' +
              '</td>' +
              '<td class="val-cell">' + (s.hasTax ? UI.fn(tax) + ' ' + cur : '—') + '</td>' +
            '</tr>' +
            '<tr class="row-payable">' +
              '<td><strong>مبلغ قابل پرداخت:</strong></td>' +
              '<td class="val-cell"><strong>' + UI.fn(payable) + ' ' + cur + '</strong></td>' +
            '</tr>' +
            /* مانده حساب کل با استایل متمایز و رنگ قرمز بولد */
            '<tr class="row-prev-bal">' +
              '<td>' +
                '<label class="pr-check-label inline-check">' +
                  '<input type="checkbox" ' + (s.showPrevBalance ? 'checked' : '') + ' onchange="FreeInv.togglePrevBal(this.checked)">' +
                  '<span class="text-d-bold">مانده حساب کل (قبلی):</span>' +
                '</label>' +
              '</td>' +
              '<td class="val-cell">' +
                (s.showPrevBalance ? 
                  '<div class="prev-bal-inputs">' +
                    '<select class="fc fc-xs" onchange="FreeInv.updateField(\'prevBalanceType\', this.value)">' +
                      '<option value="بدهکار"' + (s.prevBalanceType === 'بدهکار' ? ' selected' : '') + '>بدهکار</option>' +
                      '<option value="بستانکار"' + (s.prevBalanceType === 'بستانکار' ? ' selected' : '') + '>بستانکار</option>' +
                    '</select>' +
                    '<input type="text" class="totals-inp text-d-bold" value="' + (prevBal ? UI.fn(Math.abs(prevBal)) : '') + '" placeholder="۰" oninput="FreeInv.onNumberInput(this, \'prevBalance\')">' +
                  '</div>' : '—') +
              '</td>' +
            '</tr>' +
          '</table>' +
        '</div>' +
      '</div>' +

      /* کادر مهر و امضای طرفین */
      '<div class="free-signatures-grid">' +
        '<div class="sig-col">' +
          '<div class="sig-title"><i class="bi bi-pen"></i> مهر و امضای فروشنده</div>' +
          '<div class="sig-box' + (s.sellerSign ? ' has-sig' : '') + '" onclick="FreeInv.openSignatureModal(\'seller\')">' +
            (s.sellerSign ? 
              '<img src="' + s.sellerSign + '" class="sig-img" alt="امضای فروشنده">' +
              '<button type="button" class="btn-clear-sig no-print" onclick="event.stopPropagation();FreeInv.clearSignature(\'seller\')" title="حذف امضا"><i class="bi bi-x-circle"></i></button>' : 
              '<div class="sig-empty-hint no-print"><i class="bi bi-fingerprint"></i> کلیک برای رسم امضا یا بارگذاری مهر</div>'
            ) +
          '</div>' +
        '</div>' +
        '<div class="sig-col">' +
          '<div class="sig-title"><i class="bi bi-person-check"></i> مهر و امضای خریدار</div>' +
          '<div class="sig-box' + (s.buyerSign ? ' has-sig' : '') + '" onclick="FreeInv.openSignatureModal(\'buyer\')">' +
            (s.buyerSign ? 
              '<img src="' + s.buyerSign + '" class="sig-img" alt="امضای خریدار">' +
              '<button type="button" class="btn-clear-sig no-print" onclick="event.stopPropagation();FreeInv.clearSignature(\'buyer\')" title="حذف امضا"><i class="bi bi-x-circle"></i></button>' : 
              '<div class="sig-empty-hint no-print"><i class="bi bi-fingerprint"></i> کلیک برای رسم امضا یا بارگذاری مهر</div>'
            ) +
          '</div>' +
        '</div>' +
      '</div>';

    return h;
  },

  /* رندر ردیف‌های جدول اقلام */
  _renderItemsRowsHtml: function() {
    var s = this._state;
    if (!s.items || !s.items.length) {
      return '<tr><td colspan="8" style="text-align:center;padding:24px;color:var(--txs)">هیچ ردیفی ثبت نشده است. دکمه «افزودن ردیف جدید» را بزنید.</td></tr>';
    }

    var html = '';
    var noWrapClass = s.noWrap ? ' no-wrap-cell' : '';

    s.items.forEach(function(it, idx) {
      var rowQty = numOf(it.qty);
      var rowPrice = numOf(it.price);
      var rowTotal = rowQty * rowPrice;

      html += '<tr data-row-idx="' + idx + '">' +
        '<td class="td-idx">' + (idx + 1) + '</td>' +
        '<td class="td-desc' + noWrapClass + '">' +
          '<input type="text" class="cell-inp' + noWrapClass + '" value="' + esc(it.name || '') + '" placeholder="شرح کالا (مانند: ویسکوز نساجی کجراه برماندو)" oninput="FreeInv.onItemTextChange(' + idx + ', \'name\', this.value)">' +
        '</td>' +
        '<td class="td-colite">' +
          '<input type="text" class="cell-inp text-center" value="' + esc(it.colite || '-') + '" placeholder="-" oninput="FreeInv.onItemTextChange(' + idx + ', \'colite\', this.value)">' +
        '</td>' +
        '<td class="td-shade">' +
          '<input type="text" class="cell-inp text-center" value="' + esc(it.shade || '') + '" placeholder="مشکی، سرمه‌ای..." oninput="FreeInv.onItemTextChange(' + idx + ', \'shade\', this.value)">' +
        '</td>' +
        '<td class="td-qty">' +
          '<input type="text" class="cell-inp text-center num-inp" value="' + (rowQty ? UI.fn(rowQty) : '') + '" placeholder="۰" oninput="FreeInv.onItemNumberInput(' + idx + ', \'qty\', this)">' +
        '</td>' +
        '<td class="td-price">' +
          '<input type="text" class="cell-inp text-center num-inp" value="' + (rowPrice ? UI.fn(rowPrice) : '') + '" placeholder="۰" oninput="FreeInv.onItemNumberInput(' + idx + ', \'price\', this)">' +
        '</td>' +
        '<td class="td-total font-bold">' +
          '<span id="rowTotal_' + idx + '">' + (rowTotal ? UI.fn(rowTotal) : '۰') + '</span>' +
        '</td>' +
        '<td class="td-ops no-print">' +
          '<div class="row-ops-btns">' +
            '<button type="button" class="btn-op-icon" onclick="FreeInv.duplicateItem(' + idx + ')" title="تکثیر این ردیف"><i class="bi bi-copy"></i></button>' +
            '<button type="button" class="btn-op-icon text-d" onclick="FreeInv.removeItem(' + idx + ')" title="حذف این ردیف"><i class="bi bi-trash"></i></button>' +
          '</div>' +
        '</td>' +
      '</tr>';
    });

    return html;
  },

  /* به‌روزرسانی زنده برگه فاکتور بدون نیاز به رفرش کل صفحه */
  refreshSheet: function() {
    var sheet = document.getElementById('freeInvPaperSheet');
    if (sheet) {
      sheet.className = 'free-inv-sheet ' + this._state.paperSize;
      sheet.innerHTML = this._renderSheetHtml();
      this._attachLiveEvents();
    }
  },

  _attachLiveEvents: function() {
    // رویدادهای اختصاصی در صورت نیاز
  },

  /* ══ عملیات ردیف‌های اقلام ══ */
  addItem: function() {
    this._state.items.push({
      id: Date.now(),
      name: '',
      colite: '-',
      shade: '',
      qty: 0,
      price: 0
    });
    this.autoSaveDraft();
    this.refreshSheet();
  },

  duplicateItem: function(idx) {
    if (!this._state.items[idx]) return;
    var orig = this._state.items[idx];
    this._state.items.splice(idx + 1, 0, {
      id: Date.now(),
      name: orig.name,
      colite: orig.colite,
      shade: orig.shade,
      qty: orig.qty,
      price: orig.price
    });
    this.autoSaveDraft();
    this.refreshSheet();
    UI.toast('ردیف با موفقیت تکثیر شد', 'i');
  },

  removeItem: function(idx) {
    if (this._state.items.length <= 1) {
      this._state.items = [{ id: Date.now(), name: '', colite: '-', shade: '', qty: 0, price: 0 }];
    } else {
      this._state.items.splice(idx, 1);
    }
    this.autoSaveDraft();
    this.refreshSheet();
  },

  clearAllItems: async function() {
    var ok = await UI.confirm('آیا از حذف تمام ردیف‌های جدول فاکتور مطمئن هستید؟');
    if (!ok) return;
    this._state.items = [
      { id: Date.now(), name: '', colite: '-', shade: '', qty: 0, price: 0 }
    ];
    this.autoSaveDraft();
    this.refreshSheet();
  },

  onItemTextChange: function(idx, field, val) {
    if (!this._state.items[idx]) return;
    this._state.items[idx][field] = val;
    this.autoSaveDraft();
  },

  onItemNumberInput: function(idx, field, inputEl) {
    var raw = inputEl.value;
    var num = numOf(raw);
    if (!this._state.items[idx]) return;
    this._state.items[idx][field] = num;

    // به‌روزرسانی ردیف جمع کل ردیف
    var it = this._state.items[idx];
    var tot = numOf(it.qty) * numOf(it.price);
    var totEl = document.getElementById('rowTotal_' + idx);
    if (totEl) totEl.textContent = tot ? UI.fn(tot) : '۰';

    // فرمت‌دهی جداکننده هزارگان زنده بدون پرش نشانگر
    var curPos = inputEl.selectionStart;
    var oldLen = inputEl.value.length;
    inputEl.value = num ? UI.fn(num) : '';
    var newLen = inputEl.value.length;
    if (inputEl.setSelectionRange) {
      inputEl.setSelectionRange(curPos + (newLen - oldLen), curPos + (newLen - oldLen));
    }

    this.autoSaveDraft();
    this._updateBottomTotals();
  },

  /* به‌روزرسانی محاسبات پایین برگه بدون ری‌رندر کامل برای حفظ فوکوس */
  _updateBottomTotals: function() {
    var s = this._state;
    var subtotal = 0;
    s.items.forEach(function(it) {
      subtotal += (numOf(it.qty) * numOf(it.price));
    });

    var discount = numOf(s.discount);
    var taxable = Math.max(0, subtotal - discount);
    var tax = s.hasTax ? Math.round(taxable * (numOf(s.taxPercent) / 100)) : 0;
    var payable = Math.max(0, taxable + tax);
    var prevBal = numOf(s.prevBalance);
    var cur = s.currency || 'ریال';

    var wordsPayable = (typeof numToWordsFa !== 'undefined' ? numToWordsFa(payable) : num2fa(payable)) + ' ' + cur;
    var wordsPrev = (typeof numToWordsFa !== 'undefined' ? numToWordsFa(Math.abs(prevBal)) : num2fa(Math.abs(prevBal))) + ' ' + cur + ' (' + (s.prevBalanceType || 'بدهکار') + ')';

    var card = document.querySelector('.free-totals-card');
    if (card) {
      var rows = card.querySelectorAll('tr');
      if (rows[0] && rows[0].children[1]) rows[0].children[1].textContent = UI.fn(subtotal) + ' ' + cur;
      if (rows[2] && rows[2].children[1]) rows[2].children[1].textContent = s.hasTax ? UI.fn(tax) + ' ' + cur : '—';
      if (rows[3] && rows[3].children[1]) rows[3].children[1].innerHTML = '<strong>' + UI.fn(payable) + ' ' + cur + '</strong>';
    }

    var wBox = document.querySelector('.free-words-box');
    if (wBox) {
      var lines = wBox.querySelectorAll('.words-text');
      if (lines[0]) lines[0].textContent = wordsPayable;
      if (lines[1]) lines[1].textContent = wordsPrev;
    }
  },

  /* رویدادهای فیلدهای متنی و عددی عمومی */
  updateField: function(field, val) {
    this._state[field] = val;
    this.autoSaveDraft();
    if (field === 'currency') this.refreshSheet();
  },

  updateBuyerField: function(field, val) {
    this._state.buyer[field] = val;
    this.autoSaveDraft();
  },

  onNumberInput: function(inputEl, field) {
    var raw = inputEl.value;
    var num = numOf(raw);
    this._state[field] = num;

    var curPos = inputEl.selectionStart;
    var oldLen = inputEl.value.length;
    inputEl.value = num ? UI.fn(num) : '';
    var newLen = inputEl.value.length;
    if (inputEl.setSelectionRange) {
      inputEl.setSelectionRange(curPos + (newLen - oldLen), curPos + (newLen - oldLen));
    }

    this.autoSaveDraft();
    this._updateBottomTotals();
  },

  /* سوییچ‌های نوار ابزار */
  setPaperSize: function(sz) {
    this._state.paperSize = sz;
    this.autoSaveDraft();
    this.render();
  },

  setTitlePreset: function(t) {
    this._state.title = t;
    this.autoSaveDraft();
    this.render();
  },

  setCurrency: function(c) {
    this._state.currency = c;
    this.autoSaveDraft();
    this.render();
  },

  setDescWidth: function(w) {
    this._state.descColWidth = parseInt(w, 10) || 250;
    this.autoSaveDraft();
    this.refreshSheet();
  },

  toggleNoWrap: function(checked) {
    this._state.noWrap = !!checked;
    this.autoSaveDraft();
    this.refreshSheet();
  },

  setTodayDate: function() {
    this._state.date = Jalali.today();
    this.autoSaveDraft();
    this.refreshSheet();
  },

  toggleTax: function(checked) {
    this._state.hasTax = !!checked;
    this.autoSaveDraft();
    this.refreshSheet();
  },

  togglePrevBal: function(checked) {
    this._state.showPrevBalance = !!checked;
    this.autoSaveDraft();
    this.refreshSheet();
  },

  toggleTerms: function(show) {
    this._state.showTerms = !!show;
    this.autoSaveDraft();
    this.refreshSheet();
  },

  /* ══ لوگوی اختصاصی سربرگ ══ */
  changeLogo: function() {
    var inp = document.createElement('input');
    inp.type = 'file';
    inp.accept = 'image/*';
    inp.onchange = function(e) {
      var file = e.target.files && e.target.files[0];
      if (!file) return;
      var reader = new FileReader();
      reader.onload = function(evt) {
        FreeInv._state.logo = evt.target.result;
        FreeInv.autoSaveDraft();
        FreeInv.refreshSheet();
        UI.toast('لوگوی سربرگ با موفقیت بارگذاری شد', 's');
      };
      reader.readAsDataURL(file);
    };
    inp.click();
  },

  removeLogo: function() {
    this._state.logo = null;
    this.autoSaveDraft();
    this.refreshSheet();
    UI.toast('لوگو حذف شد', 'i');
  },

  /* ══ انتخاب سریع مشتری از اشخاص برنامه ══ */
  openContactPicker: async function() {
    var contacts = await DB.all('contacts');
    if (!contacts.length) {
      UI.toast('هنوز شخصی در بخش اشخاص ثبت نشده است', 'i');
      return;
    }

    var balMap = (typeof Con !== 'undefined' && Con.allBalances) ? await Con.allBalances() : {};

    var listHtml = '<div style="margin-bottom:12px">' +
      '<input type="text" class="fc" id="pickerContactSearch" placeholder="جست‌وجوی نام مشتری یا شماره تماس…" oninput="FreeInv.filterContactList(this.value)">' +
    '</div>' +
    '<div id="pickerContactList" style="max-height:360px;overflow-y:auto;display:flex;flex-direction:column;gap:6px">';

    contacts.forEach(function(c) {
      var bal = balMap[c.id] || 0;
      var balText = bal > 0 ? ('بدهکار: ' + UI.fn(bal) + ' ریال') : bal < 0 ? ('بستانکار: ' + UI.fn(Math.abs(bal)) + ' ریال') : 'تسویه';
      var balColor = bal > 0 ? 'var(--d)' : bal < 0 ? 'var(--ok)' : 'var(--txs)';

      listHtml += '<div class="contact-pick-item" onclick="FreeInv.selectContact(' + c.id + ')" data-name="' + esc(c.name || '') + '" data-phone="' + esc(c.phone || '') + '">' +
        '<div style="font-weight:700">' + esc(c.name) + '</div>' +
        '<div style="font-size:.78rem;color:var(--txs);display:flex;gap:12px;margin-top:2px">' +
          (c.phone ? '<span><i class="bi bi-phone"></i> ' + esc(c.phone) + '</span>' : '') +
          '<span style="color:' + balColor + ';font-weight:600">' + balText + '</span>' +
        '</div>' +
      '</div>';
    });

    listHtml += '</div>';

    UI.open('انتخاب خریدار از اشخاص برنامه', listHtml, '<button class="btn bo" onclick="UI.close()">بستن</button>');
  },

  filterContactList: function(q) {
    q = (q || '').trim().toLowerCase();
    var items = document.querySelectorAll('#pickerContactList .contact-pick-item');
    items.forEach(function(el) {
      var n = (el.getAttribute('data-name') || '').toLowerCase();
      var p = (el.getAttribute('data-phone') || '').toLowerCase();
      if (!q || n.indexOf(q) > -1 || p.indexOf(q) > -1) {
        el.style.display = '';
      } else {
        el.style.display = 'none';
      }
    });
  },

  selectContact: async function(cid) {
    var c = await DB.get('contacts', cid);
    if (!c) return;
    this._state.buyer.contactId = c.id;
    this._state.buyer.name = c.name || '';
    this._state.buyer.phone = c.phone || '';
    this._state.buyer.address = c.address || '';
    this._state.buyer.ecoCode = c.ecoCode || c.nationalId || '';

    // دریافت مانده حساب واقعی شخص
    if (typeof Con !== 'undefined' && Con.balance) {
      var bal = await Con.balance(c.id);
      if (bal !== 0) {
        this._state.showPrevBalance = true;
        this._state.prevBalance = Math.abs(bal);
        this._state.prevBalanceType = bal > 0 ? 'بدهکار' : 'بستانکار';
      }
    }

    this.autoSaveDraft();
    this.refreshSheet();
    UI.close();
    UI.toast('مشخصات و مانده خریدار درج شد', 's');
  },

  /* ══ پد امضای دیجیتال و بارگذاری مهر ══ */
  openSignatureModal: function(role) {
    this._sigRole = role;
    var title = role === 'seller' ? 'مهر و امضای فروشنده' : 'مهر و امضای خریدار';

    var modalHtml = '<div class="sig-modal-layout">' +
      '<div class="sig-tabs">' +
        '<button type="button" class="sig-tab-btn active" id="sigTabPad" onclick="FreeInv.switchSigTab(\'pad\')"><i class="bi bi-pen"></i> رسم امضا آنلاین</button>' +
        '<button type="button" class="sig-tab-btn" id="sigTabUpload" onclick="FreeInv.switchSigTab(\'upload\')"><i class="bi bi-upload"></i> بارگذاری عکس مهر / امضا</button>' +
      '</div>' +

      /* تب ۱: رسم با قلم لمسی یا ماوس */
      '<div id="sigPanePad" class="sig-pane">' +
        '<div class="sig-toolbar">' +
          '<div class="sig-tool-sec">' +
            '<label>رنگ قلم:</label>' +
            '<div class="sig-color-options">' +
              '<button type="button" class="sig-color-dot dot-black active" onclick="FreeInv.setSigColor(\'#111111\', this)" title="مشکی"></button>' +
              '<button type="button" class="sig-color-dot dot-blue" onclick="FreeInv.setSigColor(\'#1e3a8a\', this)" title="سرمه‌ای"></button>' +
              '<button type="button" class="sig-color-dot dot-red" onclick="FreeInv.setSigColor(\'#dc2626\', this)" title="قرمز مهری"></button>' +
            '</div>' +
          '</div>' +
          '<div class="sig-tool-sec">' +
            '<label>ضخامت:</label>' +
            '<select class="fc fc-xs" onchange="FreeInv.setSigWidth(this.value)">' +
              '<option value="2">نازک (2px)</option>' +
              '<option value="3" selected>معمولی (3px)</option>' +
              '<option value="5">ضخیم (5px)</option>' +
            '</select>' +
          '</div>' +
          '<button type="button" class="btn bo bs text-d" onclick="FreeInv.clearSigCanvas()"><i class="bi bi-eraser"></i> پاک کردن</button>' +
        '</div>' +
        '<div class="sig-canvas-wrap">' +
          '<canvas id="freeInvSigCanvas" width="460" height="220"></canvas>' +
        '</div>' +
        '<div style="font-size:.76rem;color:var(--txs);margin-top:6px;text-align:center">با ماوس یا قلم/انگشت خود روی کادر بالا امضا کنید.</div>' +
      '</div>' +

      /* تب ۲: بارگذاری عکس اسکن‌شده */
      '<div id="sigPaneUpload" class="sig-pane" style="display:none">' +
        '<div class="sig-upload-box">' +
          '<i class="bi bi-cloud-arrow-up" style="font-size:2.5rem;color:var(--p)"></i>' +
          '<p style="margin:8px 0;font-weight:600">انتخاب تصویر اسکن‌شده مهر یا امضا</p>' +
          '<p style="font-size:.78rem;color:var(--txs);margin-bottom:14px">پشتیبانی از PNG با پس‌زمینه شفاف یا عکس JPEG</p>' +
          '<label class="btn bp bs" style="cursor:pointer">' +
            '<i class="bi bi-folder2-open"></i> انتخاب فایل عکس…' +
            '<input type="file" accept="image/*" style="display:none" onchange="FreeInv.onSignatureFile(this)">' +
          '</label>' +
          '<div id="sigUploadPreviewWrap" style="margin-top:16px;display:none">' +
            '<img id="sigUploadPreviewImg" style="max-height:120px;max-width:260px;object-fit:contain;border:1px dashed var(--bd);padding:6px;border-radius:8px">' +
          '</div>' +
        '</div>' +
      '</div>' +
    '</div>';

    UI.open(title, modalHtml, 
      '<button class="btn bp" onclick="FreeInv.saveSignature()"><i class="bi bi-check2"></i> درج امضا در فاکتور</button>' +
      '<button class="btn bo" onclick="UI.close()">انصراف</button>'
    );

    setTimeout(function() {
      FreeInv._initSigPad();
    }, 50);
  },

  switchSigTab: function(tab) {
    var pPad = document.getElementById('sigPanePad');
    var pUpload = document.getElementById('sigPaneUpload');
    var tPad = document.getElementById('sigTabPad');
    var tUpload = document.getElementById('sigTabUpload');

    if (tab === 'pad') {
      if (pPad) pPad.style.display = '';
      if (pUpload) pUpload.style.display = 'none';
      if (tPad) tPad.classList.add('active');
      if (tUpload) tUpload.classList.remove('active');
    } else {
      if (pPad) pPad.style.display = 'none';
      if (pUpload) pUpload.style.display = '';
      if (tPad) tPad.classList.remove('active');
      if (tUpload) tUpload.classList.add('active');
    }
  },

  _initSigPad: function() {
    var c = document.getElementById('freeInvSigCanvas');
    if (!c) return;
    this._canvas = c;
    this._ctx = c.getContext('2d');
    this._ctx.lineCap = 'round';
    this._ctx.lineJoin = 'round';
    this._ctx.strokeStyle = this._sigColor || '#111111';
    this._ctx.lineWidth = this._sigWidth || 3;

    var self = this;
    function getPos(e) {
      var rect = c.getBoundingClientRect();
      var clientX = e.clientX;
      var clientY = e.clientY;
      if (e.touches && e.touches[0]) {
        clientX = e.touches[0].clientX;
        clientY = e.touches[0].clientY;
      }
      return {
        x: (clientX - rect.left) * (c.width / rect.width),
        y: (clientY - rect.top) * (c.height / rect.height)
      };
    }

    c.onpointerdown = function(e) {
      e.preventDefault();
      self._isDrawing = true;
      var pos = getPos(e);
      self._lastX = pos.x;
      self._lastY = pos.y;
    };

    window.onpointermove = function(e) {
      if (!self._isDrawing || !self._ctx) return;
      var pos = getPos(e);
      self._ctx.beginPath();
      self._ctx.moveTo(self._lastX, self._lastY);
      self._ctx.lineTo(pos.x, pos.y);
      self._ctx.stroke();
      self._lastX = pos.x;
      self._lastY = pos.y;
    };

    window.onpointerup = function() {
      self._isDrawing = false;
    };
  },

  setSigColor: function(col, btn) {
    this._sigColor = col;
    if (this._ctx) this._ctx.strokeStyle = col;
    document.querySelectorAll('.sig-color-dot').forEach(function(d) { d.classList.remove('active'); });
    if (btn) btn.classList.add('active');
  },

  setSigWidth: function(w) {
    this._sigWidth = parseInt(w, 10) || 3;
    if (this._ctx) this._ctx.lineWidth = this._sigWidth;
  },

  clearSigCanvas: function() {
    if (this._canvas && this._ctx) {
      this._ctx.clearRect(0, 0, this._canvas.width, this._canvas.height);
    }
  },

  onSignatureFile: function(inp) {
    var file = inp.files && inp.files[0];
    if (!file) return;
    var reader = new FileReader();
    reader.onload = function(evt) {
      var res = evt.target.result;
      FreeInv._uploadedSigData = res;
      var wrap = document.getElementById('sigUploadPreviewWrap');
      var img = document.getElementById('sigUploadPreviewImg');
      if (wrap && img) {
        img.src = res;
        wrap.style.display = 'block';
      }
    };
    reader.readAsDataURL(file);
  },

  saveSignature: function() {
    var pUpload = document.getElementById('sigPaneUpload');
    var isUploadTab = pUpload && pUpload.style.display !== 'none';
    var sigData = null;

    if (isUploadTab && this._uploadedSigData) {
      sigData = this._uploadedSigData;
    } else if (this._canvas) {
      sigData = this._canvas.toDataURL('image/png');
    }

    if (sigData) {
      if (this._sigRole === 'seller') {
        this._state.sellerSign = sigData;
      } else {
        this._state.buyerSign = sigData;
      }
      this.autoSaveDraft();
      this.refreshSheet();
      UI.close();
      UI.toast('امضا با موفقیت درج شد', 's');
    } else {
      UI.toast('لطفاً ابتدا روی کادر امضا کنید یا عکس انتخاب نمایید', 'w');
    }
  },

  clearSignature: function(role) {
    if (role === 'seller') {
      this._state.sellerSign = null;
    } else {
      this._state.buyerSign = null;
    }
    this.autoSaveDraft();
    this.refreshSheet();
    UI.toast('امضا حذف شد', 'i');
  },

  /* ══ چاپ حرفه‌ای با پرینتر ══ */
  print: async function() {
    var s = this._state;
    var area = document.getElementById('printArea');
    if (!area) return;

    // بارگذاری محتوا در بخش چاپ
    area.innerHTML = '<div class="free-inv-sheet ' + s.paperSize + ' print-mode">' +
      this._renderSheetHtml() +
    '</div>';

    // تزریق استایل @page متناسب با برگه انتخابی (A4 یا A5)
    var styleId = 'pbFreePageStyle';
    var existingStyle = document.getElementById(styleId);
    if (!existingStyle) {
      existingStyle = document.createElement('style');
      existingStyle.id = styleId;
      document.head.appendChild(existingStyle);
    }

    var pageSize = s.paperSize === 'a5' ? 'A5' : 'A4';
    var margin = s.paperSize === 'a5' ? '6mm' : '8mm';
    existingStyle.innerHTML = '@page { size: ' + pageSize + '; margin: ' + margin + '; }' +
      '@media print { * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; } }';

    setTimeout(function() {
      window.print();
    }, 200);
  },

  /* ══ دانلود PDF باکیفیت ══ */
  exportPDF: async function() {
    var sheet = document.getElementById('freeInvPaperSheet');
    if (!sheet) {
      UI.toast('برگه فاکتور در صفحه یافت نشد', 'e');
      return;
    }
    if (typeof html2canvas === 'undefined') {
      UI.toast('کتابخانه ساخت عکس در حال بارگذاری است...', 'e');
      return;
    }
    var jsPdfCtor = (window.jspdf && window.jspdf.jsPDF) || window.jsPDF;
    if (!jsPdfCtor) {
      UI.toast('کتابخانه PDF در دسترس نیست', 'e');
      return;
    }

    UI.toast('در حال تولید فایل PDF با کیفیت بالا...', 'i');
    try {
      var s = this._state;
      var isA5 = s.paperSize === 'a5';

      var canvas = await html2canvas(sheet, {
        scale: 2.5,
        useCORS: true,
        backgroundColor: '#ffffff',
        logging: false,
        onclone: function(clonedDoc) {
          var el = clonedDoc.getElementById('freeInvPaperSheet');
          if (el) {
            el.style.transform = 'none';
            el.style.boxShadow = 'none';
            el.style.margin = '0';
          }
          // مخفی‌سازی دکمه‌های کنترلی درون برگه
          var noP = clonedDoc.querySelectorAll('.no-print');
          noP.forEach(function(np) { np.style.display = 'none'; });
        }
      });

      var imgData = canvas.toDataURL('image/jpeg', 0.95);
      var pdf = new jsPdfCtor({
        orientation: 'portrait',
        unit: 'mm',
        format: isA5 ? 'a5' : 'a4'
      });

      var pageWidth = isA5 ? 148 : 210;
      var pageHeight = isA5 ? 210 : 297;

      var imgWidth = pageWidth;
      var imgHeight = (canvas.height * imgWidth) / canvas.width;
      if (imgHeight > pageHeight) {
        imgHeight = pageHeight;
        imgWidth = (canvas.width * imgHeight) / canvas.height;
      }
      var posX = (pageWidth - imgWidth) / 2;
      var posY = 0;

      pdf.addImage(imgData, 'JPEG', posX, posY, imgWidth, imgHeight);
      var fileName = (s.title || 'پیش‌فاکتور') + '-' + (s.invoiceNumber || s.id) + '.pdf';
      pdf.save(fileName);
      UI.toast('فایل PDF با موفقیت دانلود شد', 's');
    } catch (err) {
      console.error('PDF Export Error:', err);
      UI.toast('خطا در تولید PDF: ' + (err.message || ''), 'e');
    }
  },

  /* ══ دانلود تصویر با فرمت JPEG و رزولوشن بالا ══ */
  exportJPEG: async function() {
    var sheet = document.getElementById('freeInvPaperSheet');
    if (!sheet) return;
    if (typeof html2canvas === 'undefined') {
      UI.toast('کتابخانه ساخت تصویر در حال بارگذاری است', 'e');
      return;
    }

    UI.toast('در حال پردازش تصویر با رزولوشن بالا (JPEG)...', 'i');
    try {
      var canvas = await html2canvas(sheet, {
        scale: 2.5,
        useCORS: true,
        backgroundColor: '#ffffff',
        logging: false,
        onclone: function(clonedDoc) {
          var el = clonedDoc.getElementById('freeInvPaperSheet');
          if (el) {
            el.style.transform = 'none';
            el.style.boxShadow = 'none';
            el.style.margin = '0';
          }
          var noP = clonedDoc.querySelectorAll('.no-print');
          noP.forEach(function(np) { np.style.display = 'none'; });
        }
      });

      var dataUrl = canvas.toDataURL('image/jpeg', 0.95);
      var fileName = (this._state.title || 'پیش‌فاکتور') + '-' + (this._state.invoiceNumber || this._state.id) + '.jpeg';

      var link = document.createElement('a');
      link.download = fileName;
      link.href = dataUrl;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      UI.toast('تصویر JPEG فاکتور دانلود شد', 's');
    } catch (err) {
      console.error('JPEG Export Error:', err);
      UI.toast('خطا در تولید تصویر: ' + (err.message || ''), 'e');
    }
  },

  /* ══ ذخیره‌سازی ابری در Supabase بدون وابستگی به کش مرورگر ══ */
  saveToSupabase: async function() {
    var s = this._state;
    if (!s) return;

    var subtotal = 0;
    s.items.forEach(function(it) { subtotal += (numOf(it.qty) * numOf(it.price)); });
    var discount = numOf(s.discount);
    var taxable = Math.max(0, subtotal - discount);
    var tax = s.hasTax ? Math.round(taxable * (numOf(s.taxPercent) / 100)) : 0;
    var grandTotal = Math.max(0, taxable + tax);

    // ۱. آماده‌سازی بدنه سند
    var recordId = s.id || uuid();
    s.id = recordId;

    var supaCfg = typeof Sync !== 'undefined' ? Sync.getConfig() : { configured: false };

    // بررسی سرور برای اطمینان از تنظیمات پایدار
    if (!supaCfg.configured && typeof Sync !== 'undefined' && Sync.fetchServerConfig) {
      await Sync.fetchServerConfig();
      supaCfg = Sync.getConfig();
    }

    var recordPayload = {
      id: recordId,
      org_id: supaCfg.orgId || 'shop1',
      type: 'free_proforma',
      invoice_number: s.invoiceNumber || 'پ-001',
      date: s.date || Jalali.today(),
      contact_id: s.buyer.contactId ? String(s.buyer.contactId) : null,
      subtotal: subtotal,
      shipping_cost: 0,
      discount: discount,
      grand_total: grandTotal,
      paid_amount: 0,
      bank_id: null,
      data: JSON.parse(JSON.stringify(s)),
      updated_at: new Date().toISOString(),
      is_deleted: false
    };

    // ۲. ذخیره محلی موازی (IndexedDB) برای دسترسی بدون اینترنت
    try {
      await DB.put('invoices', {
        id: recordId,
        type: 'free_proforma',
        invoiceNumber: s.invoiceNumber,
        date: s.date,
        contactId: s.buyer.contactId || null,
        subtotal: subtotal,
        discount: discount,
        grandTotal: grandTotal,
        data: s,
        updatedAt: new Date().toISOString()
      });
    } catch (e) {
      console.warn('Local indexedDB save error:', e);
    }

    // ۳. ارسال مستقیم به سرور REST پایگاه داده Supabase با دور زدن کش
    if (supaCfg.configured && supaCfg.url && supaCfg.key) {
      UI.toast('در حال ارسال مستقیم به Supabase...', 'i');
      try {
        var url = supaCfg.url.replace(/\/+$/, '') + '/rest/v1/invoices';
        // افزودن پارامتر زمان‌بندی برای دور زدن ۱۰۰٪ هرگونه کش مرورگر یا پراکسی
        var reqUrl = url + '?_ts=' + Date.now();

        var res = await fetch(reqUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'apikey': supaCfg.key,
            'Authorization': 'Bearer ' + supaCfg.key,
            'Prefer': 'resolution=merge-duplicates,return=representation',
            'Cache-Control': 'no-cache, no-store, must-revalidate',
            'Pragma': 'no-cache'
          },
          body: JSON.stringify(recordPayload)
        });

        if (res.ok) {
          UI.toast('پیش‌فاکتور آزاد با موفقیت در Supabase ذخیره شد', 's');
          this.autoSaveDraft();
          return true;
        } else {
          var errText = await res.text();
          console.error('Supabase save error:', res.status, errText);
          UI.toast('خطا در ذخیره Supabase: ' + (errText || res.status), 'e');
          return false;
        }
      } catch (netErr) {
        console.error('Network error saving to Supabase:', netErr);
        UI.toast('خطای ارتباط با سرور: پیش‌فاکتور به صورت محلی ذخیره شد.', 'w');
        return false;
      }
    } else {
      // اگر تنظیمات Supabase هنوز در این مرورگر وارد نشده باشد
      UI.toast('پیش‌فاکتور به صورت محلی ذخیره شد. برای ذخیره ابری به Supabase متصل شوید.', 'w');
      this.openSupaConfigModal();
      return true;
    }
  },

  /* ══ مدال آرشیو فاکتورها ══ */
  openArchiveModal: async function() {
    UI.toast('در حال بارگیری فهرست فاکتورها...', 'i');
    var invoices = [];
    var supaCfg = typeof Sync !== 'undefined' ? Sync.getConfig() : { configured: false };
    var loadedFromCloud = false;

    // تلاش برای بارگیری زنده و تازه از Supabase بدون کش مرورگر
    if (supaCfg.configured && supaCfg.url && supaCfg.key) {
      try {
        var fetchUrl = supaCfg.url.replace(/\/+$/, '') + 
          '/rest/v1/invoices?type=eq.free_proforma&is_deleted=eq.false&order=updated_at.desc&_ts=' + Date.now();

        var res = await fetch(fetchUrl, {
          method: 'GET',
          headers: {
            'apikey': supaCfg.key,
            'Authorization': 'Bearer ' + supaCfg.key,
            'Cache-Control': 'no-cache, no-store, must-revalidate'
          }
        });

        if (res.ok) {
          var data = await res.json();
          if (Array.isArray(data)) {
            invoices = data;
            loadedFromCloud = true;
          }
        }
      } catch (e) {
        console.warn('Error fetching archive from Supabase, falling back to local:', e);
      }
    }

    // در صورت عدم اتصال یا خطا، از IndexedDB محلی خوانده می‌شود
    if (!invoices.length) {
      try {
        var allLocal = await DB.all('invoices');
        invoices = allLocal.filter(function(i) {
          return i.type === 'free_proforma';
        });
      } catch (e) {}
    }

    FreeInv._archiveList = invoices;

    var cur = (this._state && this._state.currency) || 'ریال';

    var modalHtml = '<div style="margin-bottom:12px;display:flex;gap:10px;align-items:center;flex-wrap:wrap">' +
      '<input type="text" class="fc" id="archiveSearchInput" placeholder="جست‌وجوی شماره فاکتور یا نام خریدار…" oninput="FreeInv.filterArchive(this.value)" style="flex:1;min-width:180px">' +
      '<div class="free-supa-badge ' + (loadedFromCloud ? 'connected' : 'local') + '">' +
        '<i class="bi bi-' + (loadedFromCloud ? 'cloud-check' : 'hdd') + '"></i> ' +
        '<span>' + (loadedFromCloud ? 'دریافت مستقیم از Supabase' : 'پایگاه داده محلی') + '</span>' +
      '</div>' +
      '<button type="button" class="btn bo bs" onclick="FreeInv.exportArchiveBackup()" title="دانلود فایل پشتیبان"><i class="bi bi-download"></i> دانلود بکاپ JSON</button>' +
      '<label class="btn bo bs" style="cursor:pointer;margin:0" title="بازیابی فایل بکاپ">' +
        '<i class="bi bi-upload"></i> بازیابی JSON' +
        '<input type="file" accept=".json" style="display:none" onchange="FreeInv.importArchiveBackup(this.files[0])">' +
      '</label>' +
    '</div>' +
    '<div id="archiveTableWrap" style="max-height:420px;overflow-y:auto">' +
      this._renderArchiveTableHtml(invoices, cur) +
    '</div>';

    UI.open('آرشیو پیش‌فاکتورهای آزاد', modalHtml, '<button class="btn bo" onclick="UI.close()">بستن</button>', 'xl');
  },

  _renderArchiveTableHtml: function(invoices, cur) {
    if (!invoices || !invoices.length) {
      return '<div style="text-align:center;padding:36px;color:var(--txs)">هیچ پیش‌فاکتور آزادی در این بخش ذخیره نشده است.</div>';
    }

    var h = '<table class="dt" style="width:100%;font-size:.82rem">' +
      '<thead>' +
        '<tr>' +
          '<th>شماره</th>' +
          '<th>تاریخ</th>' +
          '<th>خریدار</th>' +
          '<th>عنوان</th>' +
          '<th>تعداد اقلام</th>' +
          '<th>مبلغ کل</th>' +
          '<th style="text-align:center">عملیات</th>' +
        '</tr>' +
      '</thead>' +
      '<tbody id="archiveTbody">';

    invoices.forEach(function(inv, idx) {
      var docData = inv.data || {};
      var buyerName = (docData.buyer && docData.buyer.name) || inv.buyer_name || '—';
      var itemsCount = (docData.items && docData.items.length) || 0;
      var total = inv.grand_total || inv.grandTotal || 0;
      var invNum = inv.invoice_number || inv.invoiceNumber || '—';
      var invDate = inv.date || '—';
      var invTitle = docData.title || inv.title || 'پیش فاکتور';

      h += '<tr data-inv-idx="' + idx + '" data-q="' + esc(invNum + ' ' + buyerName) + '">' +
        '<td><strong>' + esc(invNum) + '</strong></td>' +
        '<td>' + esc(invDate) + '</td>' +
        '<td>' + esc(buyerName) + '</td>' +
        '<td>' + esc(invTitle) + '</td>' +
        '<td>' + itemsCount + ' ردیف</td>' +
        '<td style="font-weight:700">' + UI.fn(total) + ' ' + cur + '</td>' +
        '<td style="text-align:center">' +
          '<div style="display:inline-flex;gap:4px">' +
            '<button type="button" class="btn bp bs" style="padding:3px 8px;font-size:.76rem" onclick="FreeInv.loadFromArchive(' + idx + ')" title="باز کردن در فرم"><i class="bi bi-box-arrow-in-left"></i> بارگذاری</button>' +
            '<button type="button" class="btn bo bs text-d" style="padding:3px 8px;font-size:.76rem" onclick="FreeInv.deleteFromArchive(' + idx + ')" title="حذف فاکتور"><i class="bi bi-trash"></i></button>' +
          '</div>' +
        '</td>' +
      '</tr>';
    });

    h += '</tbody></table>';
    return h;
  },

  filterArchive: function(q) {
    q = (q || '').trim().toLowerCase();
    var rows = document.querySelectorAll('#archiveTbody tr');
    rows.forEach(function(r) {
      var text = (r.getAttribute('data-q') || '').toLowerCase();
      if (!q || text.indexOf(q) > -1) {
        r.style.display = '';
      } else {
        r.style.display = 'none';
      }
    });
  },

  loadFromArchive: function(idx) {
    var inv = this._archiveList && this._archiveList[idx];
    if (!inv) return;
    var state = inv.data || inv;
    if (!state.items) {
      UI.toast('اطلاعات کامل این فاکتور یافت نشد', 'e');
      return;
    }
    this._state = state;
    this.autoSaveDraft();
    this.render();
    UI.close();
    UI.toast('فاکتور شماره ' + (state.invoiceNumber || '') + ' با موفقیت باز شد', 's');
  },

  deleteFromArchive: async function(idx) {
    var inv = this._archiveList && this._archiveList[idx];
    if (!inv) return;
    var ok = await UI.confirm('آیا از حذف این فاکتور مطمئن هستید؟ این عملیات قابل بازگشت نیست.');
    if (!ok) return;

    var id = inv.id;
    var supaCfg = typeof Sync !== 'undefined' ? Sync.getConfig() : { configured: false };

    // ۱. حذف از Supabase
    if (supaCfg.configured && supaCfg.url && supaCfg.key && id) {
      try {
        await fetch(supaCfg.url.replace(/\/+$/, '') + '/rest/v1/invoices?id=eq.' + id, {
          method: 'DELETE',
          headers: {
            'apikey': supaCfg.key,
            'Authorization': 'Bearer ' + supaCfg.key
          }
        });
      } catch (e) {
        console.warn('Delete from Supabase warning:', e);
      }
    }

    // ۲. حذف از IndexedDB
    try {
      if (id) await DB.del('invoices', id);
    } catch (e) {}

    this._archiveList.splice(idx, 1);
    var wrap = document.getElementById('archiveTableWrap');
    if (wrap) {
      var cur = (this._state && this._state.currency) || 'ریال';
      wrap.innerHTML = this._renderArchiveTableHtml(this._archiveList, cur);
    }
    UI.toast('فاکتور با موفقیت حذف شد', 'i');
  },

  exportArchiveBackup: function() {
    var data = this._archiveList || [];
    var blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = 'free-invoices-backup-' + (Jalali.today().replace(/\//g, '-')) + '.json';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    UI.toast('فایل پشتیبان JSON دانلود شد', 's');
  },

  importArchiveBackup: function(file) {
    if (!file) return;
    var reader = new FileReader();
    reader.onload = async function(evt) {
      try {
        var parsed = JSON.parse(evt.target.result);
        if (!Array.isArray(parsed)) throw new Error('فایل بکاپ نامعتبر است');
        UI.toast('در حال بازیابی فاکتورها...', 'i');

        for (var i = 0; i < parsed.length; i++) {
          var item = parsed[i];
          if (item && item.id) {
            await DB.put('invoices', item);
          }
        }
        UI.toast('فاکتورها با موفقیت بازیابی شدند', 's');
        FreeInv.openArchiveModal();
      } catch (e) {
        UI.toast('خطا در خواندن فایل بکاپ: ' + e.message, 'e');
      }
    };
    reader.readAsText(file);
  },

  /* ══ مودال تنظیمات سریع اتصال به Supabase ══ */
  openSupaConfigModal: function() {
    if (typeof Sync !== 'undefined' && Sync.uiModal) {
      Sync.uiModal();
    } else {
      UI.toast('ماژول هماهنگی ابری در دسترس نیست', 'w');
    }
  }
};
