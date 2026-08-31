/* ══ NAVIGATION ══ */
var navEl = document.getElementById('sidebarNav');
if (navEl) navEl.addEventListener('click', function(e) {
  var item = e.target.closest('.ni');
  if (!item) return;
  e.preventDefault();
  var p = item.dataset.page;
  if (ROUTES[p]) {
    ROUTES[p]();
    history.replaceState(null, '', '#' + p);
  }
});
var loginBtn = document.getElementById('loginBtn');
if (loginBtn) loginBtn.addEventListener('click', function() {
  Auth.login();
});
var loginPass = document.getElementById('loginPass');
if (loginPass) loginPass.addEventListener('keydown', function(e) {
  if (e.key === 'Enter') Auth.login();
});
var logoutBtn = document.getElementById('logoutBtn');
if (logoutBtn) logoutBtn.addEventListener('click', function() {
  Auth.logout();
});
var modalCloseBtn = document.getElementById('modalCloseBtn');
if (modalCloseBtn) modalCloseBtn.onclick = function() {
  UI.close();
};
var modalOverlay = document.getElementById('modalOverlay');
if (modalOverlay) modalOverlay.addEventListener('click', function(e) {
  if (e.target === this) UI.close();
});
var darkBtn = document.getElementById('darkBtn');
if (darkBtn) darkBtn.onclick = function() {
  document.body.classList.toggle('dark');
  localStorage.setItem('pb_dark', document.body.classList.contains('dark'));
  this.innerHTML = document.body.classList.contains('dark') ? '<i class="bi bi-sun"></i>' : '<i class="bi bi-moon"></i>';
};
var yearSel = document.getElementById('yearSel');
if (yearSel) yearSel.addEventListener('change', function() {
  switchYear(this.value);
});

/* ══ BOOT ══ */
(async function() {
  /* اصلاح: متغیر ld قبلاً هم در try و هم در catch با var تعریف می‌شد. */
  function hideLoading() {
    var ld = document.getElementById('loadingScreen');
    if (ld) ld.style.display = 'none';
  }
  try {
    await DB.init();
    if (localStorage.getItem('pb_dark') === 'true') document.body.classList.add('dark');
    await Auth.ensureDefaultUser();
    APP_READY = true;
    hideLoading();
    if (Auth.checkSession()) {
      document.getElementById('loginPage').style.display = 'none';
      document.getElementById('appContainer').style.display = '';
      await Auth.onLogin();
      await routeToHash();
    } else {
      document.getElementById('loginPage').style.display = '';
      var _f = el('loginUser');
    if (_f) _f.focus();
    }
  } catch (err) {
    console.error('Boot:', err);
    APP_READY = true;
    hideLoading();
    var lp = document.getElementById('loginPage');
    if (lp) lp.style.display = '';
    var le = document.getElementById('loginErr');
    if (le) {
      le.textContent = 'خطا در راه‌اندازی برنامه: ' + (err && err.message ? err.message : 'نامشخص');
      le.style.display = 'block';
    }
  }
})();

/* گزارش خطاهای پیش‌بینی‌نشده به کاربر — قبلاً بی‌صدا در کنسول می‌ماندند */
window.addEventListener('unhandledrejection', function(e) {
  console.error('Unhandled rejection:', e.reason);
  if (typeof UI !== 'undefined' && UI.toast) {
    UI.toast('خطای غیرمنتظره: ' + ((e.reason && e.reason.message) || 'نامشخص'), 'e');
  }
});
