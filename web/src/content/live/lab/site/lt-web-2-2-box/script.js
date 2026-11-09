// 示範用的開關:點 [data-set="鍵=值 鍵=值"] 把 .page 的 data-鍵 設成值(CSS 依這些屬性切換畫面)。
// 沒有計時器、動畫與亂數:畫面只由點過哪些開關決定。
var page = document.querySelector('.page');
document.querySelectorAll('[data-set]').forEach(function (b) {
  b.addEventListener('click', function () {
    b.getAttribute('data-set').split(' ').forEach(function (pair) {
      var kv = pair.split('=');
      if (kv[0]) page.setAttribute('data-' + kv[0], kv[1] || '');
    });
  });
});

// 調整鈕:[data-inc="pad+1"] 把內距加一級(內距、外距 0–2 級,邊框 0–1 級)
var MAX = { pad: 2, bor: 1, mar: 2 };
document.querySelectorAll('[data-inc]').forEach(function (b) {
  b.addEventListener('click', function () {
    var m = /^(\w+)([+-]1)$/.exec(b.getAttribute('data-inc'));
    var k = m[1];
    var v = Number(page.getAttribute('data-' + k)) + Number(m[2]);
    page.setAttribute('data-' + k, String(Math.max(0, Math.min(MAX[k], v))));
  });
});
