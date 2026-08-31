/* ══ CONTACTS ══ */
var Con = {
  tl: function(t) {
    return {
      customer: 'مشتری',
      supplier: 'تأمین‌کننده',
      both: 'هر دو',
      broker: 'واسطه'
    } [t] || t;
  },
  tt: function(t) {
    return {
      customer: 'tg-g',
      supplier: 'tg-o',
      both: 'tg-b',
      broker: 'tg-p'
    } [t] || 'tg-b';
  },
  render: async function() {
    currentPage = 'contacts';
    UI.nav('contacts');
    UI.title('bi-people-fill', 'اشخاص');
    UI.act('<button class="btn bp" onclick="Con.form()">شخص جدید</button>');
    var ls = await DB.all('contacts');
    if (!ls.length) {
      UI.content('<div class="cd"><div class="em"><i class="bi bi-people"></i><p>شخصی نیست</p></div></div>');
      return;
    }
    var me = this,
      r = '';
    for (var i = 0; i < ls.length; i++) {
      var c = ls[i];
      r += '<tr><td>' + (i + 1) + '</td><td><strong>' + esc(c.name) + '</strong></td><td><span class="tg ' + me.tt(c.type) + '">' + me.tl(c.type) + '</span></td><td>' + esc(c.phone || '—') + '</td><td style="white-space:nowrap"><button class="bi2" onclick="Led.show(' + c.id + ')"><i class="bi bi-journal-text"></i></button> <button class="bi2" onclick="Con.form(' + c.id + ')"><i class="bi bi-pencil"></i></button> <button class="bi2 d" onclick="Con.rm(' + c.id + ')"><i class="bi bi-trash3"></i></button></td></tr>';
    }
    UI.content('<div class="cd"><div class="cd-h">اشخاص</div><div class="tw"><table><thead><tr><th>#</th><th>نام</th><th>نوع</th><th>تلفن</th><th></th></tr></thead><tbody>' + r + '</tbody></table></div></div>');
  },
  form: async function(id) {
    var c = id ? await DB.get('contacts', id) : null;
    var to = '';
    [{
      v: 'customer',
      l: 'مشتری'
    }, {
      v: 'supplier',
      l: 'تأمین‌کننده'
    }, {
      v: 'both',
      l: 'هر دو'
    }, {
      v: 'broker',
      l: 'واسطه'
    }].forEach(function(o) {
      to += '<option value="' + o.v + '"' + (c && c.type === o.v ? ' selected' : '') + '>' + esc(o.l) + '</option>';
    });
    UI.open(c ? 'ویرایش' : 'شخص جدید', '<div class="fg"><label>نام</label><input class="fc" id="cNm" value="' + esc(c ? c.name : '') + '"></div><div class="fr"><div class="fg"><label>نوع</label><select class="fc" id="cTp">' + to + '</select></div><div class="fg"><label>تلفن</label><input class="fc" id="cPh" value="' + esc(c ? (c.phone || '') : '') + '"></div></div><div class="fg"><label>آدرس</label><textarea class="fc" id="cAd">' + esc(c ? (c.address || '') : '') + '</textarea></div><div class="fg"><label>مانده اولیه</label><input class="fc" id="cBl" type="number" value="' + (c ? (c.balance || 0) : 0) + '" dir="ltr"><p style="font-size:.72rem;color:var(--txm);margin-top:3px">منفی=بدهکار، مثبت=بستانکار</p></div>', '<button class="btn bp" onclick="Con.save(' + (id || 'null') + ')">' + (c ? 'ذخیره' : 'ثبت') + '</button><button class="btn bo" onclick="UI.close()">انصراف</button>', true);
    var _f = el('cNm');
    if (_f) _f.focus();
  },
  save: async function(id) {
    var d = {
      name: elVal('cNm').trim(),
      type: elVal('cTp'),
      phone: elVal('cPh').trim(),
      address: elVal('cAd').trim(),
      balance: elNum('cBl')
    };
    if (!d.name) {
      UI.toast('نام', 'e');
      return;
    }
    if (id) {
      var ex = await DB.get('contacts', id);
      Object.assign(ex, d);
      await DB.put('contacts', ex);
    } else await DB.add('contacts', d);
    UI.close();
    await this.render();
  },
  rm: async function(id) {
    if (!await UI.confirm('حذف شود؟')) return;
    await DB.del('contacts', id);
    await this.render();
  }
};
