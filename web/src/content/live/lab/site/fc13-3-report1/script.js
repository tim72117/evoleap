var shot = document.getElementById('shot');
function pick(id) {
  document.querySelectorAll('.t').forEach(function (t) { t.classList.remove('sel'); });
  document.getElementById('t' + id).classList.add('sel');
  shot.classList.add('sel-on');
  document.querySelectorAll('.hint').forEach(function (h) { h.style.display = h.id === 'h' + id ? 'block' : 'none'; });
}
document.getElementById('t4').addEventListener('click', function () { pick(4); });
document.getElementById('t6').addEventListener('click', function () { pick(6); });
