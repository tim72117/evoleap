var app = document.getElementById('app');
var v = Number(app.getAttribute('data-v'));
var amt = document.getElementById('amount');
var ppl = document.getElementById('people');
var fee = document.getElementById('fee');
var feeTag = document.getElementById('fee-tag');
var each = document.getElementById('each');
var extra = document.getElementById('extra');
var msg = document.getElementById('msg');
function fmt(x) {
  if (isNaN(x)) return 'NaN';
  if (!isFinite(x)) return 'Infinity';
  var s = String(Math.round(x * 100) / 100);
  var parts = s.split('.');
  parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return parts.join('.');
}
function problem(a, n) {
  if (amt.value.trim() === '') return '請輸入總金額';
  if (ppl.value.trim() === '') return '請輸入人數';
  if (a < 0) return '金額不能是負數';
  if (n < 1) return '人數至少 1 人';
  if (Math.floor(n) !== n) return '人數要是整數';
  return '';
}
function update() {
  var a = parseFloat(amt.value);
  var n = parseFloat(ppl.value);
  var withFee = fee ? fee.checked : false;
  if (feeTag) { feeTag.textContent = withFee ? '含 10% 服務費' : '未含服務費'; feeTag.className = withFee ? 'tag on' : 'tag'; }
  if (msg) { msg.textContent = ''; msg.className = 'msg gone'; }
  if (amt.value === '' && ppl.value === '') { each.textContent = '—'; if (extra) extra.textContent = '多收 — 元'; return; }
  if (v >= 4) {
    var p = problem(a, n);
    if (p) { each.textContent = '—'; if (extra) extra.textContent = '多收 — 元'; msg.textContent = p; msg.className = 'msg'; return; }
  }
  var total = withFee ? Math.round(a * 110) / 100 : a;
  if (v >= 3) {
    var per = Math.ceil(total / n);
    each.textContent = fmt(per) + ' 元';
    extra.textContent = '多收 ' + fmt(Math.round((per * n - total) * 100) / 100) + ' 元（歸先付帳的人）';
  } else {
    each.textContent = fmt(total / n) + ' 元';
  }
}
amt.addEventListener('input', update);
ppl.addEventListener('input', update);
if (fee) fee.addEventListener('change', update);
update();
