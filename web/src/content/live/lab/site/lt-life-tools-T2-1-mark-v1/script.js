var app = document.getElementById('app');
var v = Number(app.getAttribute('data-v'));
var today = app.getAttribute('data-today');
var stage = document.getElementById('stage');
var card = document.getElementById('idcard');
var broken = document.getElementById('broken');
var empty = document.getElementById('empty');
var wm = document.getElementById('wm');
var text = document.getElementById('text');
var op = document.getElementById('opacity');
var sz = document.getElementById('size');
var toast = document.getElementById('toast');
var modal = document.getElementById('modal');
var picked = '';
function wmText() {
  if (v < 2) return '僅供申請使用';
  var t = text.value.trim();
  return t ? t + ' ' + today : '';
}
function draw() {
  var t = wmText();
  var size = sz ? Number(sz.value) : 26;
  var alpha = op ? Number(op.value) / 100 : 0.35;
  if (sz) document.getElementById('size-v').textContent = size + ' px';
  if (op) document.getElementById('opacity-v').textContent = Math.round(alpha * 100) + '%';
  wm.innerHTML = '';
  if (picked !== 'id' || !t) return;
  var gap = size * 2.6;
  var rows = Math.ceil(900 / gap);
  for (var r = 0; r < rows; r++) {
    var row = document.createElement('div');
    row.className = 'wm-row';
    row.style.top = (r * gap) + 'px';
    row.style.left = ((r % 2) * -size * 3) + 'px';
    row.style.fontSize = size + 'px';
    var s = '';
    for (var c = 0; c < 8; c++) s += t + '\u3000\u3000';
    row.textContent = s;
    wm.appendChild(row);
  }
  wm.style.opacity = String(alpha);
}
function show(which) {
  empty.classList.toggle('gone', which !== '');
  card.classList.toggle('gone', which !== 'id');
  broken.classList.toggle('gone', which !== 'txt');
  draw();
}
document.getElementById('pick').addEventListener('click', function () { modal.classList.remove('gone'); });
var files = document.querySelectorAll('[data-file]');
for (var i = 0; i < files.length; i++) files[i].addEventListener('click', function (e) {
  var f = e.currentTarget.getAttribute('data-file');
  modal.classList.add('gone');
  toast.className = 'toast gone';
  if (f === 'txt' && v >= 5) { toast.textContent = '請選擇圖片檔（剛才選的是 說明.txt）'; toast.className = 'toast bad'; return; }
  picked = f;
  document.getElementById('fname').textContent = f === 'id' ? '虛構證件範例.png' : '說明.txt';
  show(f);
});
document.getElementById('pick-cancel').addEventListener('click', function () { modal.classList.add('gone'); });
if (text) text.addEventListener('input', draw);
if (op) op.addEventListener('input', draw);
if (sz) sz.addEventListener('input', draw);
document.getElementById('download').addEventListener('click', function () {
  if (picked !== 'id') { toast.textContent = '還沒有選圖片'; toast.className = 'toast bad'; return; }
  toast.textContent = '已下載：' + (v >= 4 ? '虛構證件範例-watermark.png' : 'watermarked.png') + '（原圖沒有改變）';
  toast.className = 'toast';
});
show('');
