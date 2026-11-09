var pg = document.getElementById('pg');
function v(x) { pg.dataset.v = x; document.getElementById('tab-faq').classList.toggle('on', x === 'faq'); document.getElementById('tab-tpl').classList.toggle('on', x === 'tpl'); }
document.getElementById('tab-faq').addEventListener('click', function () { v('faq'); });
document.getElementById('tab-tpl').addEventListener('click', function () { v('tpl'); });
