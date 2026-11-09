var app = document.getElementById('app');
var v = Number(app.getAttribute('data-v'));
var SETS = {"photos":[["photo-01.jpg",4032,3024,4.8],["photo-02.jpg",4032,3024,5.3],["photo-03.jpg",4032,3024,4.1],["photo-04.jpg",3024,4032,4.6],["photo-05.jpg",4032,3024,4.9],["photo-06.jpg",4032,3024,5.1],["photo-07.jpg",4032,3024,4.4],["photo-08.jpg",4032,3024,5],["photo-09.jpg",4032,3024,4.7],["photo-10.jpg",4032,3024,5.2]],"mixed":[["photo-01.jpg",4032,3024,4.8],["photo-04.jpg",3024,4032,4.6],["photo-big.jpg",8064,6048,22.6],["notes.txt",0,0,0.01],["IMG_0042.HEIC",4032,3024,2.1]]};
var Q = {"high":0.8,"mid":0.55,"low":0.35};
var files = [];
function $(id) { return document.getElementById(id); }
function kb(x) { return x >= 1024 ? (x / 1024).toFixed(1) + ' MB' : x + ' KB'; }
function esc(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;'); }
function listPicked() {
  if (!files.length) { $('picked').innerHTML = '<div class="hint">還沒有選照片</div>'; return; }
  var h = '<div class="hint">已選 ' + files.length + ' 個檔案</div>';
  for (var i = 0; i < files.length; i++) h += '<div class="pf">' + esc(files[i][0]) + (v >= 2 ? '<small>' + files[i][3].toFixed(1) + ' MB</small>' : '') + '</div>';
  $('picked').innerHTML = h;
}
$('pick').addEventListener('click', function () { $('modal').classList.remove('gone'); });
var sets = document.querySelectorAll('[data-set]');
for (var i = 0; i < sets.length; i++) sets[i].addEventListener('click', function (e) {
  files = SETS[e.currentTarget.getAttribute('data-set')];
  $('modal').classList.add('gone');
  $('out').innerHTML = '';
  listPicked();
});
$('pick-cancel').addEventListener('click', function () { $('modal').classList.add('gone'); });
$('go').addEventListener('click', function () {
  var edge = parseFloat($('edge').value);
  var q = Q[$('quality').value];
  var out = $('out');
  if (!files.length) { out.innerHTML = '<div class="bad">請先選照片</div>'; return; }
  if (v >= 3 && !(edge > 0)) { out.innerHTML = '<div class="bad">最長邊要大於 0</div>'; return; }
  var h = '', n = 0, before = 0, after = 0;
  for (var i = 0; i < files.length; i++) {
    var f = files[i], name = f[0];
    var isImg = /\.(jpe?g|png)$/i.test(name);
    var heic = /\.heic$/i.test(name);
    if (!isImg && !heic) {
      if (v < 3) { out.innerHTML = '<div class="bad">處理失敗：讀不到 ' + esc(name) + '（沒有下載任何照片）</div>'; return; }
      h += '<div class="row skip">' + esc(name) + '<span>不是圖片，已跳過</span></div>';
      continue;
    }
    if (heic) {
      if (v < 3) { out.innerHTML = '<div class="bad">處理失敗：讀不到 ' + esc(name) + '（沒有下載任何照片）</div>'; return; }
      h += '<div class="row skip">' + esc(name) + '<span>這個瀏覽器讀不了 HEIC，請先轉成 JPG</span></div>';
      continue;
    }
    var longest = Math.max(f[1], f[2]);
    var s = edge / longest;
    var keep = false;
    if (v >= 3 && s >= 1) { s = 1; keep = true; }
    var w = Math.round(f[1] * s), hh = Math.round(f[2] * s);
    var k = Math.round(f[3] * 1024 * s * s * q);
    var outName = name.replace(/\.(jpe?g|png)$/i, '-small.jpg');
    n++; before += f[3] * 1024; after += k;
    h += '<div class="row">' + '<b>⬇ ' + esc(outName) + '</b>' + (v >= 2 ? '<span>' + kb(Math.round(f[3] * 1024)) + ' → <em>' + kb(k) + '</em> · ' + w + ' × ' + hh + (keep ? '（比原圖大，維持原尺寸）' : '') + '</span>' : '<span>已下載</span>') + '</div>';
  }
  var sum = '<div class="sum">已下載 ' + n + ' 張到「下載」資料夾' + (v >= 2 ? '　共 ' + kb(Math.round(before)) + ' → ' + kb(Math.round(after)) : '') + '</div>';
  out.innerHTML = sum + h;
});
listPicked();
