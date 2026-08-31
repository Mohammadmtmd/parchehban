/* ══ SETTINGS ══ */
var Settings = {
  render: async function() {
    currentPage = 'settings';
    UI.nav('settings');
    UI.title('bi-gear-fill', 'تنظیمات');
    UI.act('');
    var user = await DB.get('users', STATE.userId);
    var h = '<div class="g2"><div class="cd"><div class="cd-h">اطلاعات کاربری</div><div class="cd-b"><div class="fg"><label>نام کاربری</label><input class="fc" id="setUser" value="' + esc(user ? user.username : '') + '"></div><div class="fg"><label>نام نمایشی</label><input class="fc" id="setDisp" value="' + esc(user ? (user.displayName || '') : '') + '"></div><button class="btn bp" onclick="Settings.saveInfo()">ذخیره</button></div></div><div class="cd"><div class="cd-h">تغییر رمز</div><div class="cd-b"><div class="fg"><label>رمز فعلی</label><input class="fc" id="setOld" type="password"></div><div class="fg"><label>رمز جدید</label><input class="fc" id="setNew" type="password"></div><div class="fg"><label>تکرار</label><input class="fc" id="setConf" type="password"></div><button class="btn bp" onclick="Settings.changePass()">تغییر رمز</button></div></div></div>';
    UI.content(h);
  },
  saveInfo: async function() {
    var nu = elVal('setUser').trim(),
      nd = elVal('setDisp').trim();
    if (!nu || nu.length < 3) {
      UI.toast('نام کاربری حداقل ۳ کاراکتر باشد', 'e');
      return;
    }
    var users = await DB.all('users');
    if (users.find(function(u) {
        return u.username === nu && u.id !== STATE.userId;
      })) {
      UI.toast('این نام کاربری قبلاً استفاده شده', 'e');
      return;
    }
    var user = await DB.get('users', STATE.userId);
    user.username = nu;
    user.displayName = nd || nu;
    await DB.put('users', user);
    STATE.username = nu;
    var prev = {};
    try {
      prev = JSON.parse(localStorage.getItem('pb_session') || '{}') || {};
    } catch (e) {}
    localStorage.setItem('pb_session', JSON.stringify({
      userId: user.id,
      username: nu,
      name: user.displayName,
      /* انقضای نشست حفظ می‌شود تا تغییر نام کاربری آن را بی‌نهایت نکند */
      expires: prev.expires || (Date.now() + Auth.SESSION_HOURS * 3600 * 1000)
    }));
    UI.toast('ذخیره شد');
  },
  changePass: async function() {
    var o = elVal('setOld'),
      n = elVal('setNew'),
      c = elVal('setConf');
    if (!o) {
      UI.toast('رمز فعلی را وارد کنید', 'e');
      return;
    }
    if (!n || n.length < 6) {
      UI.toast('رمز جدید حداقل ۶ کاراکتر باشد', 'e');
      return;
    }
    if (n !== c) {
      UI.toast('تکرار رمز مطابقت ندارد', 'e');
      return;
    }
    if (n === o) {
      UI.toast('رمز جدید با رمز فعلی یکی است', 'e');
      return;
    }
    var user = await DB.get('users', STATE.userId);
    if (!user || !await Auth.verify(user, o)) {
      UI.toast('رمز فعلی اشتباه است', 'e');
      return;
    }
    user.password = await Auth.hash(n);
    await DB.put('users', user);
    UI.toast('رمز تغییر کرد');
    document.getElementById('setOld').value = '';
    document.getElementById('setNew').value = '';
    document.getElementById('setConf').value = '';
  }
};
