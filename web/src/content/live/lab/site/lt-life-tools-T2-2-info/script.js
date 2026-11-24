function $(id) { return document.getElementById(id); }
var rows = document.querySelectorAll('[data-row]');
var TABS = {
  'tab-before': { size: '4.8 MB', dim: '4032 × 3024', camera: '範例手機 X12', time: '2026/11/07 15:42', gps: '緯度 25.0418　經度 121.5089', port: false, none: false },
  'tab-after': { size: '426 KB', dim: '1600 × 1200', camera: '（沒有這項資訊）', time: '（沒有這項資訊）', gps: '（沒有這項資訊）', port: false, none: true },
  'tab-portrait': { size: '408 KB', dim: '1200 × 1600（直的，沒有轉向）', camera: '（沒有這項資訊）', time: '（沒有這項資訊）', gps: '（沒有這項資訊）', port: true, none: true }
};
function open(r) { r.classList.add('open'); }
for (var i = 0; i < rows.length; i++) rows[i].addEventListener('click', function (e) { open(e.currentTarget); });
$('all').addEventListener('click', function () { for (var i = 0; i < rows.length; i++) open(rows[i]); $('note').classList.remove('gone'); });
function setTab(id) {
  var t = TABS[id];
  for (var k in TABS) $(k).classList.toggle('on', k === id);
  $('v-size').textContent = t.size; $('v-dim').textContent = t.dim; $('v-camera').textContent = t.camera; $('v-time').textContent = t.time; $('v-gps').textContent = t.gps;
  $('cap').textContent = t.dim;
  $('map').classList.toggle('gone', t.none);
  $('pic-land').classList.toggle('gone', t.port);
  $('pic-port').classList.toggle('gone', !t.port);
  for (var i = 0; i < rows.length; i++) { open(rows[i]); var key = rows[i].getAttribute('data-row'); rows[i].classList.toggle('none', t.none && key !== 'size' && key !== 'dim'); }
  $('note').classList.remove('gone');
  $('note').textContent = t.none ? '縮小後只留下畫面：相機型號、拍攝時間、拍攝位置都不見了' : '這些資訊都藏在照片檔案裡，直接分享原檔，會一起送出去';
  $('note').className = t.none ? 'note good' : 'note';
}
for (var k in TABS) $(k).addEventListener('click', (function (id) { return function () { setTab(id); }; })(k));
