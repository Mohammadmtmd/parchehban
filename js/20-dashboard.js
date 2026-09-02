/* ══ DASHBOARD ══ */
var Dash = {
  period: 'month',
  _wc: null,
  _cc: null,
  render: async function() {
    currentPage = 'dashboard';
    UI.nav('dashboard');
    UI.title('bi-grid-1x2-fill', 'داشبورد');
    UI.act('');
    UI.content('<div class="ld"><div class="spn"></div></div>');
    await this.load();
  },
  setP: async function(p) {
    this.period = p;
    await this.load();
  },
  load: async function() {
    var contacts = await DB.all('contacts');
    var allInvs = await FY.byYear('invoices');
    var cMap = {};
    contacts.forEach(function(c) {
      cMap[c.id] = c.name;
    });
    var startNum = getPeriodStart(this.period);
    var periodInvs = allInvs.filter(function(inv) {
      return inv.type !== 'proforma' && pn(inv.date) >= startNum;
    });
    var tPur = 0,
      tSal = 0;
    periodInvs.forEach(function(v) {
      if (v.type === 'purchase') tPur += v.grandTotal || 0;
      else tSal += v.grandTotal || 0;
    });
    var avgBuy = {};
    allInvs.forEach(function(inv) {
      if (inv.type !== 'purchase') return;
      (inv.items || []).forEach(function(it) {
        if (!avgBuy[it.productId]) avgBuy[it.productId] = {
          cost: 0,
          qty: 0
        };
        avgBuy[it.productId].cost += it.total;
        avgBuy[it.productId].qty += it.quantity;
      });
    });
    var profit = 0;
    periodInvs.forEach(function(inv) {
      if (inv.type !== 'sale') return;
      (inv.items || []).forEach(function(it) {
        var ab = avgBuy[it.productId];
        var avg = ab && ab.qty > 0 ? ab.cost / ab.qty : 0;
        profit += (it.unitPrice - avg) * it.quantity;
      });
    });
    /* توجه: نسخه قبلی یک تعریف کامل و تکراری از آبجکت Bank را همین‌جا
       داخل تابع داشت (کد مرده با ارجاع به متغیر تعریف‌نشده). حذف شد؛
       تنها تعریف معتبر Bank در فایل 22-banks.js است. */
    var banks = await DB.all('banks'),
      dashPays = await FY.byYear('payments'),
      dashChks = await FY.byYear('checks'),
      dashBts = [];
    try {
      dashBts = await DB.all('bankTransfers');
    } catch (e) {}
    var bankTotal = 0;
    banks.forEach(function(b) {
      var bal = b.openingBalance || 0;
      allInvs.forEach(function(inv) {
        if (inv.type === 'proforma' || inv.bankId !== b.id || !(inv.paidAmount > 0)) return;
        if (inv.type === 'sale') bal += inv.paidAmount;
        else bal -= inv.paidAmount;
      });
      dashPays.forEach(function(p) {
        if (p.bankId === b.id) {
          if (p.type === 'receipt') bal += p.amount;
          else bal -= p.amount;
        }
      });
      dashChks.forEach(function(c) {
        if (c.status === 'passed' && c.bankAccountId === b.id) {
          if (c.type === 'received') bal += c.amount;
          else bal -= c.amount;
        }
      });
      dashBts.forEach(function(bt) {
        if (bt.fromBankId === b.id) bal -= bt.amount;
        if (bt.toBankId === b.id) bal += bt.amount;
      });
      bankTotal += bal;
    });
    /* نمودار */
    var pl = {
      week: 'هفته',
      month: 'ماه',
      year: 'سال'
    };
    var me = this,
      h = '';
    h += '<div class="dash-hero"><div><h2>داشبورد مدیریتی پارچه‌بان</h2><p>نمای سریع فروش، خرید، سود و گردش حساب‌های انتخاب‌شده</p></div><div class="pill">دوره: ' + pl[this.period] + '</div></div>';
    h += '<div style="display:flex;gap:8px;margin-bottom:20px;flex-wrap:wrap">';
    ['week', 'month', 'year'].forEach(function(p) {
      h += '<button class="btn ' + (me.period === p ? 'bp' : 'bo') + ' bs" onclick="Dash.setP(\'' + p + '\')">' + pl[p] + '</button>';
    });
    h += '</div>';
    h += '<div class="sg">';
    h += '<div class="sc" style="cursor:pointer" onclick="ROUTES.reports()"><div class="si ' + (profit >= 0 ? 'g' : 'r') + '"><i class="bi bi-graph-up"></i></div><div class="sti"><h3>' + UI.fn(Math.round(profit)) + '</h3><p>سود/زیان ' + pl[this.period] + '</p></div></div>';
    h += '<div class="sc" style="cursor:pointer" onclick="ROUTES.purchase()"><div class="si o"><i class="bi bi-cart-fill"></i></div><div class="sti"><h3>' + UI.fn(tPur) + '</h3><p>خرید</p></div></div>';
    h += '<div class="sc" style="cursor:pointer" onclick="ROUTES.sales()"><div class="si g"><i class="bi bi-receipt-cutoff"></i></div><div class="sti"><h3>' + UI.fn(tSal) + '</h3><p>فروش</p></div></div>';
    h += '<div class="sc" style="cursor:pointer" onclick="ROUTES.contacts()"><div class="si b"><i class="bi bi-people-fill"></i></div><div class="sti"><h3>' + contacts.length + '</h3><p>اشخاص</p></div></div>';
    if (banks.length) {
      h += '<div class="sc" style="cursor:pointer" onclick="ROUTES.banks()"><div class="si b"><i class="bi bi-bank2"></i></div><div class="sti"><h3>' + UI.fn(bankTotal) + '</h3><p>مانده بانک</p></div></div>';
    }
    h += '</div>';
    h += '<div class="g2">';
    h += '<div class="cd"><div class="cd-h"><i class="bi bi-bar-chart-fill" style="margin-left:8px;color:var(--p)"></i>نمودار</div><div class="cd-b" style="height:260px"><canvas id="dashWC"></canvas></div></div>';
    h += '<div class="cd"><div class="cd-h"><i class="bi bi-pie-chart-fill" style="margin-left:8px;color:var(--ok)"></i>فروش مشتریان</div><div class="cd-b" style="height:260px"><canvas id="dashCC"></canvas></div></div>';
    h += '</div>';
    h += '<div class="cd" style="margin-top:20px"><div class="cd-h"><i class="bi bi-shield-lock" style="color:var(--ok);margin-left:8px"></i>بکاپ</div><div class="cd-b" style="display:flex;gap:8px"><button class="btn bg" onclick="Backup.exportAll()"><i class="bi bi-download"></i>ذخیره</button><button class="btn bdn" onclick="Backup.importAll()"><i class="bi bi-upload"></i>بازیابی</button></div></div>';
    UI.content(h);
    this.renderCharts(allInvs, cMap);
  },
  renderCharts: function(allInvs, cMap) {
    try {
      if (typeof Chart === 'undefined') return;
      var me = this;
      if (me._wc) me._wc.destroy();
      if (me._cc) me._cc.destroy();
      var byDate = {};
      allInvs.forEach(function(inv) {
        if (inv.type === 'proforma') return;
        var d = inv.date || '—';
        if (!byDate[d]) byDate[d] = {
          pur: 0,
          sal: 0
        };
        if (inv.type === 'purchase') byDate[d].pur += inv.grandTotal || 0;
        else byDate[d].sal += inv.grandTotal || 0;
      });
      var dates = Object.keys(byDate).sort().slice(-7);
      var wCtx = document.getElementById('dashWC');
      if (wCtx) {
        me._wc = new Chart(wCtx, {
          type: 'bar',
          data: {
            labels: dates.map(function(d) {
              var p = d.split('/');
              return p[1] + '/' + p[2];
            }),
            datasets: [{
              label: 'خرید',
              data: dates.map(function(d) {
                return byDate[d].pur;
              }),
              backgroundColor: 'rgba(217,119,6,0.7)',
              borderRadius: 4
            }, {
              label: 'فروش',
              data: dates.map(function(d) {
                return byDate[d].sal;
              }),
              backgroundColor: 'rgba(22,163,74,0.7)',
              borderRadius: 4
            }]
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
              legend: {
                position: 'bottom',
                labels: {
                  font: {
                    family: 'Vazirmatn'
                  }
                }
              }
            },
            scales: {
              y: {
                ticks: {
                  font: {
                    family: 'Vazirmatn'
                  },
                  callback: function(v) {
                    return (v / 1000000).toFixed(1) + 'M';
                  }
                }
              },
              x: {
                ticks: {
                  font: {
                    family: 'Vazirmatn'
                  }
                }
              }
            }
          }
        });
      }
      var byCust = {};
      allInvs.forEach(function(inv) {
        if (inv.type !== 'sale') return;
        if (!byCust[inv.contactId]) byCust[inv.contactId] = 0;
        byCust[inv.contactId] += inv.grandTotal || 0;
      });
      var cL = [],
        cD = [];
      for (var k in byCust) {
        cL.push(cMap[k] || '—');
        cD.push(byCust[k]);
      }
      var cCtx = document.getElementById('dashCC');
      if (cCtx && cL.length) {
        me._cc = new Chart(cCtx, {
          type: 'doughnut',
          data: {
            labels: cL,
            datasets: [{
              data: cD,
              backgroundColor: ['#2563eb', '#16a34a', '#d97706', '#dc2626', '#7c3aed', '#0891b2', '#be185d', '#4f46e5'].slice(0, cL.length),
              borderWidth: 2,
              borderColor: getComputedStyle(document.body).getPropertyValue('--sf').trim() || '#fff'
            }]
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
              legend: {
                position: 'bottom',
                labels: {
                  font: {
                    family: 'Vazirmatn'
                  }
                }
              }
            }
          }
        });
      }
    } catch (e) {
      console.log('Chart:', e);
    }
  }
};
