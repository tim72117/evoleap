var m = document.getElementById('mail');
function v(x) { m.dataset.v = x; document.getElementById('t-bad').classList.toggle('on', x === 'bad'); document.getElementById('t-good').classList.toggle('on', x === 'good'); }
document.getElementById('t-bad').addEventListener('click', function () { v('bad'); });
document.getElementById('t-good').addEventListener('click', function () { v('good'); });
