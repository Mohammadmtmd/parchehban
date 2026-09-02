/* ══ EXPORT ══ */
var EXP = {
  /* خروجی CSV — جداکننده هزارگان و ارقام فارسی حذف می‌شود تا اکسل
     مقادیر را به‌عنوان عدد بشناسد. */
  _cell: function(v) {
    if (v === null || v === undefined) return '';
    if (typeof v === 'number') return String(v);
    var s = String(v);
    /* اگر مقدار یک عدد فارسی قالب‌بندی‌شده است، به عدد لاتین تبدیل شود */
    if (/^[۰-۹0-9,٫.\-\s]+$/.test(s) && /[۰-۹]/.test(s)) {
      return String(numOf(s.replace(/,/g, '')));
    }
    return s;
  },
  csv: function(hd, rows, fn) {
    var lines = [hd.join(',')];
    for (var i = 0; i < rows.length; i++) {
      var c = [];
      for (var j = 0; j < rows[i].length; j++) {
        var v = EXP._cell(rows[i][j]);
        v = v.replace(/"/g, '""');
        if (v.indexOf(',') > -1 || v.indexOf('"') > -1) v = '"' + v + '"';
        c.push(v);
      }
      lines.push(c.join(','));
    }
    var b = new Blob(['\uFEFF' + lines.join('\n')], {
      type: 'text/csv;charset=utf-8;'
    });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(b);
    a.download = fn;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  },
  pdf: function(title, hd, rows, sum) {
    var h = '<div style="direction:rtl;font-family:Vazirmatn,sans-serif;padding:15mm">';
    h += '<h1 style="font-size:18px;border-bottom:3px double #000;padding-bottom:10px;margin-bottom:14px">' + esc(title) + '</h1>';
    h += '<p style="font-size:11px;color:#666;margin-bottom:14px">تاریخ: ' + todayJ() + '</p>';
    if (sum) h += sum;
    h += '<table style="width:100%;border-collapse:collapse;font-size:11px"><thead><tr>';
    for (var i = 0; i < hd.length; i++) h += '<th style="border:1px solid #ccc;padding:7px;background:#f0f0f0">' + esc(hd[i]) + '</th>';
    h += '</tr></thead><tbody>';
    for (var r = 0; r < rows.length; r++) {
      h += '<tr>';
      for (var c = 0; c < rows[r].length; c++) h += '<td style="border:1px solid #ccc;padding:6px;text-align:center;white-space:nowrap">' + esc(rows[r][c] === 0 ? '0' : (rows[r][c] || '—')) + '</td>';
      h += '</tr>';
    }
    h += '</tbody></table></div>';
    setHTML('printArea', h);
    window.print();
  }
};
