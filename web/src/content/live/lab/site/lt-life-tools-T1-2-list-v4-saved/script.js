var app = document.getElementById('app');
var v = Number(app.getAttribute('data-v'));
var items = JSON.parse(app.getAttribute('data-saved') || '[]');
var BACKUP = [{"t":"牛奶","d":true},{"t":"洗碗精","d":false},{"t":"衛生紙","d":false}];
var list = document.getElementById('list');
var input = document.getElementById('item');
var hint = document.getElementById('hint');
var toast = document.getElementById('toast');
var modal = document.getElementById('modal');
var pending = null;
function esc(s) { return s.replace(/&/g, '&amp;').replace(/</g, '&lt;'); }
function render() {
  if (!items.length) { list.innerHTML = '<li class="empty">清單是空的，先新增一項吧</li>'; return; }
  var h = '';
  for (var i = 0; i < items.length; i++) {
    h += '<li data-item="' + esc(items[i].t) + '"' + (items[i].d ? ' class="done"' : '') + '><input type="checkbox" class="check"' + (items[i].d ? ' checked' : '') + ' data-i="' + i + '"><span class="name">' + esc(items[i].t) + '</span><button class="del" data-i="' + i + '" aria-label="刪除">✕</button></li>';
  }
  list.innerHTML = h;
}
list.addEventListener('click', function (e) {
  var t = e.target;
  if (!t.getAttribute || t.getAttribute('data-i') === null) return;
  var i = Number(t.getAttribute('data-i'));
  if (t.classList.contains('del')) items.splice(i, 1);
  else items[i].d = !items[i].d;
  render();
});
document.getElementById('add').addEventListener('click', function () {
  var t = input.value;
  if (hint) hint.textContent = '';
  if (v >= 4) {
    t = t.trim();
    if (!t) { hint.textContent = '請輸入項目名稱'; return; }
  }
  items.push({ t: t, d: false });
  input.value = '';
  render();
});
function showToast(html, bad) { toast.innerHTML = html; toast.className = bad ? 'toast bad' : 'toast'; }
var exp = document.getElementById('export');
if (exp) exp.addEventListener('click', function () {
  showToast('已下載 <b>shopping-list-backup.json</b> 到「下載」資料夾<pre>' + esc(JSON.stringify(items.map(function (x) { return { name: x.t, done: x.d }; }), null, 1)) + '</pre>');
});
var imp = document.getElementById('import');
if (imp) imp.addEventListener('click', function () { modal.classList.remove('gone'); document.getElementById('picker').classList.remove('gone'); document.getElementById('confirm').classList.add('gone'); });
var files = document.querySelectorAll('[data-file]');
for (var k = 0; k < files.length; k++) files[k].addEventListener('click', function (e) {
  var f = e.currentTarget.getAttribute('data-file');
  if (f === 'backup') { pending = BACKUP; document.getElementById('picker').classList.add('gone'); document.getElementById('confirm').classList.remove('gone'); return; }
  modal.classList.add('gone');
  if (v >= 4) { showToast('檔案格式不對，清單沒有變動', true); return; }
  items = [];
  render();
});
var cancelPick = document.getElementById('pick-cancel');
if (cancelPick) cancelPick.addEventListener('click', function () { modal.classList.add('gone'); });
var ok = document.getElementById('ok');
if (ok) ok.addEventListener('click', function () {
  items = pending.map(function (x) { return { t: x.t, d: x.d }; });
  modal.classList.add('gone');
  showToast('已從備份還原 ' + items.length + ' 個項目');
  render();
});
var no = document.getElementById('no');
if (no) no.addEventListener('click', function () { modal.classList.add('gone'); });
render();
