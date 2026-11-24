var days = ['週一', '週二', '週三', '週四', '週五', '週六', '週日'];
var dow = [1, 2, 3, 4, 5, 6, 0];
var hours = document.getElementById('hours');
var rows = document.getElementById('rows');
hours.appendChild(document.createElement('span'));
for (var h = 0; h < 24; h++) { var s = document.createElement('span'); s.textContent = h % 3 === 0 ? h : ''; hours.appendChild(s); }
var cells = [];
days.forEach(function (d, i) {
  var r = document.createElement('div'); r.className = 'row';
  var lab = document.createElement('span'); lab.className = 'd'; lab.textContent = d; r.appendChild(lab);
  cells[i] = [];
  for (var h = 0; h < 24; h++) { var c = document.createElement('span'); r.appendChild(c); cells[i][h] = c; }
  rows.appendChild(r);
});
function show(expr, text, tz) {
  var p = expr.split(' ');
  for (var k = 0; k < 5; k++) {
    document.getElementById('v' + k).textContent = p[k];
    document.getElementById('v' + k).parentNode.className = 'slot' + (p[k] !== '*' ? ' on' : '');
  }
  document.getElementById('say').textContent = text;
  document.getElementById('tz').className = 'tz' + (tz ? ' on' : '');
  for (var i = 0; i < 7; i++) for (var h = 0; h < 24; h++) {
    var hitH = p[1] === '*' || Number(p[1]) === (tz ? (h + 24 - 8) % 24 : h);
    var hitD = p[4] === '*' || Number(p[4]) === dow[i];
    cells[i][h].className = hitH && hitD ? (p[0].indexOf('/') >= 0 ? 'many' : 'hit') : '';
  }
}
document.querySelectorAll('.chips button').forEach(function (b) {
  b.addEventListener('click', function () {
    document.querySelectorAll('.chips button').forEach(function (x) { x.className = ''; });
    b.className = 'cur';
    show(b.getAttribute('data-c'), b.getAttribute('data-t'), b.getAttribute('data-tz'));
  });
});
show('0 9 * * *', '每天 9:00', false);
document.getElementById('e1').className = 'cur';
