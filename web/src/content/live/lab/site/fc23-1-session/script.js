var pg = document.getElementById('pg');
var N = [[0,0,0],[1,1,1],[2,1,1],[3,1,1],[4,1,1],[4,1,1],[5,2,1]];
document.getElementById('next').addEventListener('click', function () {
  var s = Math.min(6, Number(pg.dataset.s) + 1);
  pg.dataset.s = String(s);
  document.getElementById('nev').textContent = N[s][0];
  document.getElementById('nss').textContent = N[s][1];
  document.getElementById('nus').textContent = N[s][2];
});
