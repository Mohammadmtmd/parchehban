/* ══ CATEGORIES ══ */
var Cat = {
  render: async function() {
    currentPage = 'categories';
    UI.nav('categories');
    UI.title('bi-bookmark-fill', 'گروه‌بندی');
    UI.act('<button class="btn bp" onclick="Cat.form()">گروه جدید</button>');
    var cs = await DB.all('categories');
    if (!cs.length) {
      UI.content('<div class="cd"><div class="em"><i class="bi bi-bookmark"></i><p>گروهی نیست</p></div></div>');
      return;
    }
    var r = '';
    for (var i = 0; i < cs.length; i++) {
      r += '<tr><td>' + (i + 1) + '</td><td><strong>' + cs[i].name + '</strong></td><td><button class="bi2" onclick="Cat.form(' + cs[i].id + ')"><i class="bi bi-pencil"></i></button> <button class="bi2 d" onclick="Cat.rm(' + cs[i].id + ')"><i class="bi bi-trash3"></i></button></td></tr>';
    }
    UI.content('<div class="cd"><div class="cd-h">گروه‌ها</div><div class="tw"><table><thead><tr><th>#</th><th>نام</th><th></th></tr></thead><tbody>' + r + '</tbody></table></div></div>');
  },
  form: async function(id) {
    /* سطح دسترسی */
    if (!Perm.require('edit', 'ثبت یا ویرایش')) return;
    var c = id ? await DB.get('categories', id) : null;
    UI.open(c ? 'ویرایش گروه' : 'ثبت گروه جدید',
      F.text({
        id: 'cNm', label: 'نام گروه', req: true, value: c ? c.name : '',
        ph: 'مثلاً: کتان، حریر، مبلی',
        hint: 'برای دسته‌بندی کالاها در انبار و گزارش‌ها'
      }),
      '<button class="btn bp" onclick="Cat.save(' + (id || 'null') + ')">' +
        '<i class="bi bi-check-lg"></i> ' + (c ? 'ذخیره' : 'ثبت') + '</button>' +
      '<button class="btn bo" onclick="UI.close()">انصراف</button>');
    F.focusFirst('cNm');
  },
  save: async function(id) {
    if (!F.validate()) return;
    var n = elVal('cNm').trim();
    if (!n) {
      UI.toast('نام', 'e');
      return;
    }
    if (id) {
      var c = await DB.get('categories', id);
      c.name = n;
      await DB.put('categories', c);
    } else await DB.add('categories', {
      name: n
    });
    UI.close();
    await this.render();
  },
  rm: async function(id) {
    /* سطح دسترسی */
    if (!Perm.require('delete', 'حذف')) return;
    if (!await UI.confirm('حذف شود؟')) return;
    await DB.del('categories', id);
    await this.render();
  }
};
