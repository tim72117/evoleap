// 圖解逐步揭示:點 [data-go="k"] 的元素(要是 HTML 元素,不能是 SVG),
// 所有 data-at 含 k 的元素加上 .on;data-off 含 k 的元素拿掉 .on;被點的元素加上 .done。
// 沒有計時器與動畫,畫面只由點擊決定(瀏覽器演員依時間重播點擊)。
document.querySelectorAll('[data-go]').forEach(function (b) {
  b.addEventListener('click', function () {
    var k = b.getAttribute('data-go');
    document.querySelectorAll('[data-at]').forEach(function (el) {
      if (el.getAttribute('data-at').split(' ').indexOf(k) >= 0) el.classList.add('on');
    });
    document.querySelectorAll('[data-off]').forEach(function (el) {
      if (el.getAttribute('data-off').split(' ').indexOf(k) >= 0) el.classList.remove('on');
    });
    b.classList.add('done');
  });
});
