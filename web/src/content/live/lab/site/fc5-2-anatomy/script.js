var app = document.querySelector('.app');
['html', 'css', 'js'].forEach(function (k) {
  document.getElementById('t-' + k).addEventListener('click', function () { app.setAttribute('data-tab', k); });
});
document.getElementById('demo').addEventListener('click', function () {
  app.setAttribute('data-run', '1');
  document.getElementById('demo-msg').textContent = '嗨！謝謝你來看我的頁面';
});
