var v = { M: 1, m: 4, p: 2 };
var el = function (id) { return document.getElementById(id); };
function show(hit, notes) {
  el('vM').textContent = v.M; el('vm').textContent = v.m; el('vp').textContent = v.p;
  ['major', 'minor', 'patch'].forEach(function (k) { el(k).className = 'd' + (k === hit ? ' hit' : '') + ((hit === 'major' && k !== 'major') || (hit === 'minor' && k === 'patch') ? ' zero' : ''); });
  var div = document.createElement('div');
  div.className = 'e new';
  div.innerHTML = '<b>' + v.M + '.' + v.m + '.' + v.p + '</b>' + notes;
  var box = el('entries');
  Array.prototype.forEach.call(box.children, function (c) { c.className = 'e'; });
  box.insertBefore(div, box.firstChild);
}
el('b-patch').addEventListener('click', function () { v.p++; this.className = 'done'; show('patch', '修正：結帳金額算錯'); });
el('b-minor').addEventListener('click', function () { v.m++; v.p = 0; this.className = 'done'; show('minor', '新增：宅配選項'); });
el('b-major').addEventListener('click', function () { v.M++; v.m = 0; v.p = 0; this.className = 'done'; show('major', '<span class="br">破壞性變更：訂單網址改成 /orders/編號，舊連結失效</span>'); });
