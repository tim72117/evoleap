var app = document.getElementById('app');
function go(n) {
  app.setAttribute('data-s', String(n));
  app.querySelectorAll('[data-at]').forEach(function (e) { e.classList.toggle('on', Number(e.getAttribute('data-at')) <= n); });
  app.querySelectorAll('[data-only]').forEach(function (e) { e.classList.toggle('on', (' ' + e.getAttribute('data-only') + ' ').indexOf(' ' + n + ' ') >= 0); });
  app.querySelectorAll('[data-go]').forEach(function (b) { b.classList.toggle('cur', Number(b.getAttribute('data-go')) === n); });
}
app.querySelectorAll('[data-go]').forEach(function (b) { b.addEventListener('click', function () { go(Number(b.getAttribute('data-go'))); }); });
app.querySelectorAll('[data-toggle]').forEach(function (b) { b.addEventListener('click', function () { b.classList.toggle('on'); }); });
go(0);
