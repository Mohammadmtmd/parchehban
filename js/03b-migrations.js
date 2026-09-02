/* ══ MIGRATIONS ══
   مهاجرت‌های داده‌ای که یک بار و فقط یک بار اجرا می‌شوند.
   شماره آخرین مهاجرت اجراشده در جدول settings با کلید schemaVersion
   نگه داشته می‌شود، پس اجرای دوباره برنامه داده را دوباره تغییر نمی‌دهد. */
var Migrate = {

  /* آخرین شماره مهاجرت موجود در این نسخه از برنامه */
  LATEST: 3,

  run: async function() {
    var cur = intOf(await DB.getSetting('schemaVersion', 0));

    /* اگر پایگاه داده تازه و خالی است، همه مهاجرت‌ها بی‌معنا هستند؛
       فقط شماره را روی آخرین نسخه بگذار. */
    if (cur === 0) {
      var contacts = await DB.all('contacts');
      var invoices = await DB.all('invoices');
      if (!contacts.length && !invoices.length) {
        await DB.setSetting('schemaVersion', Migrate.LATEST);
        return {
          fresh: true,
          applied: []
        };
      }
    }

    var applied = [];
    for (var v = cur + 1; v <= Migrate.LATEST; v++) {
      var fn = Migrate['v' + v];
      if (!fn) continue;
      var note = await fn.call(Migrate);
      await DB.setSetting('schemaVersion', v);
      applied.push({
        version: v,
        note: note
      });
      console.info('مهاجرت ' + v + ' اجرا شد: ' + note);
    }
    return {
      fresh: false,
      applied: applied
    };
  },

  /* ── مهاجرت ۱ ──────────────────────────────────────────────────
     اصلاح علامت «مانده اولیه» اشخاص طبق عرف حسابداری.

     قبلاً فرم می‌گفت «منفی=بدهکار، مثبت=بستانکار» و کد عدد را قرینه
     می‌کرد. اکنون طبق اصول حسابداری: بدهکار = مثبت، بستانکار = منفی.
     پس علامت مانده اولیه تمام اشخاص موجود یک بار قرینه می‌شود تا
     مانده‌های محاسبه‌شده دقیقاً مثل قبل بمانند. */
  v1: async function() {
    var cs = await DB.all('contacts');
    var changed = 0;
    for (var i = 0; i < cs.length; i++) {
      var c = cs[i];
      var b = numOf(c.balance);
      if (b !== 0) {
        c.balance = -b;
        changed++;
      }
      /* نگه‌داشتن مقدار اصلی برای اطمینان/بازبینی */
      c.balanceLegacy = b;
      await DB.put('contacts', c);
    }
    return 'علامت مانده اولیه ' + changed + ' شخص طبق عرف حسابداری اصلاح شد';
  },

  /* ── مهاجرت ۲ ──────────────────────────────────────────────────
     ساخت سند دریافت/پرداخت برای فاکتورهایی که فیلد «پرداخت شده»
     پرشده دارند ولی سند مالی متناظر ندارند.

     قبلاً این عدد فقط داخل خود فاکتور می‌نشست و در محاسبه مانده
     دوباره حساب می‌شد. حالا هر فاکتور یک سند واقعی می‌سازد و مانده
     فقط از اسناد خوانده می‌شود. */
  v2: async function() {
    var invs = await DB.all('invoices');
    var pays = await DB.all('payments');
    var made = 0;
    for (var i = 0; i < invs.length; i++) {
      var inv = invs[i];
      if (inv.type === 'proforma') continue;
      var paid = numOf(inv.paidAmount);
      if (paid <= 0) continue;
      var exists = pays.some(function(p) {
        return p.sourceInvoiceId === inv.id;
      });
      if (exists) continue;
      await DB.add('payments', {
        type: inv.type === 'sale' ? 'receipt' : 'payment',
        fiscalYearId: inv.fiscalYearId,
        contactId: inv.contactId,
        amount: paid,
        date: inv.date,
        bankId: inv.bankId || null,
        description: 'بابت فاکتور ' + (inv.invoiceNumber || inv.id),
        notes: 'بابت فاکتور ' + (inv.invoiceNumber || inv.id),
        sourceInvoiceId: inv.id,
        auto: true
      });
      made++;
    }
    return made + ' سند دریافت/پرداخت از فیلد «پرداخت شده» فاکتورها ساخته شد';
  },

  /* ── مهاجرت ۳ ──────────────────────────────────────────────────
     افزودن نقش و وضعیت به کاربران موجود. کاربران قبلی همه مدیر
     می‌شوند تا کسی دسترسی‌اش را از دست ندهد. */
  v3: async function() {
    var us = await DB.all('users');
    for (var i = 0; i < us.length; i++) {
      var u = us[i];
      var dirty = false;
      if (!u.role) {
        u.role = 'admin';
        dirty = true;
      }
      if (u.active === undefined) {
        u.active = true;
        dirty = true;
      }
      if (dirty) await DB.put('users', u);
    }
    return us.length + ' کاربر نقش «مدیر» گرفتند';
  }
};
