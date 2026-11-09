var w = document.querySelector('.w');
document.getElementById('go-loop').addEventListener('click', function () { w.setAttribute('data-view', 'loop'); });
document.getElementById('next').addEventListener('click', function () {
  if (w.getAttribute('data-view') === 'big') w.setAttribute('data-view', 'loop');
  w.setAttribute('data-n', String(Math.min(5, Number(w.getAttribute('data-n')) + 1)));
});
document.getElementById('rules').addEventListener('click', function () { w.setAttribute('data-view', 'rules'); });
