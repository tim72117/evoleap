var pg = document.getElementById('pg');
function tab(rt) { document.getElementById('tab-rt').classList.toggle('on', rt); document.getElementById('tab-admin').classList.toggle('on', !rt); }
document.getElementById('create').addEventListener('click', function () { pg.dataset.v = '2'; });
document.getElementById('stream-create').addEventListener('click', function () { pg.dataset.v = '3'; });
document.getElementById('tab-rt').addEventListener('click', function () { pg.dataset.v = '4'; tab(true); });
