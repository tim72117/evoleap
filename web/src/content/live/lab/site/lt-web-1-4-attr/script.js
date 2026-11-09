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

// 「店家位置」連結:沒有 href 時點了沒反應;有 href 就在同一個分頁換掉網頁;再加上 target="_blank" 就開新分頁
document.getElementById('lnk').addEventListener('click', function () {
  var a = page.getAttribute('data-a');
  if (a === 'href') page.setAttribute('data-nav', 'same');
  if (a === 'blank') page.setAttribute('data-nav', 'new');
  page.setAttribute('data-hover', 'no');
});
