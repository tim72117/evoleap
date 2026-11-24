var pg = document.getElementById('pg');
document.getElementById('next').addEventListener('click', function () { pg.dataset.s = String(Math.min(7, Number(pg.dataset.s) + 1)); });
