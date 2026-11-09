var app = document.querySelector('.app');
var cnt = document.getElementById('cnt');
var text = { '1': '你直接安裝了 6 個套件', '2': '實際上一共裝了 847 個', '3': '漏洞在第 3 層：tiny-buffer', '4': 'tiny-buffer 的漏洞：高風險' };
document.querySelectorAll('.chips button').forEach(function (b) {
  b.addEventListener('click', function () {
    var s = b.getAttribute('data-s');
    app.className = 'app s' + s;
    cnt.textContent = text[s];
  });
});
