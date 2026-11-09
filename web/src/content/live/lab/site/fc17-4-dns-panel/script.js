var rec = document.getElementById('rec');
var saved = document.getElementById('saved');
var dirty = document.getElementById('dirty');
function touch() { saved.classList.remove('on'); dirty.classList.add('on'); }
function bindDel(btn) { btn.addEventListener('click', function () { var tr = btn.closest('tr'); if (tr) tr.remove(); touch(); }); }
rec.querySelectorAll('.del').forEach(bindDel);
var n = 0;
document.getElementById('add').addEventListener('click', function () {
  var t = document.getElementById('type').value, nm = document.getElementById('name').value || '@', v = document.getElementById('value').value, ttl = document.getElementById('ttl').value;
  if (!v) return;
  n += 1;
  var tr = document.createElement('tr');
  tr.className = 'new'; tr.id = 'new-' + n;
  [nm, t, v, ttl].forEach(function (x, i) { var td = document.createElement('td'); if (i === 1) { var s = document.createElement('span'); s.className = 'ty'; s.textContent = x; td.appendChild(s); } else { td.className = i === 2 ? 'mono v' : 'mono'; td.textContent = x; } tr.appendChild(td); });
  var td = document.createElement('td'); var b = document.createElement('button'); b.className = 'del'; b.id = 'del-new-' + n; b.textContent = '刪除'; bindDel(b); td.appendChild(b); tr.appendChild(td);
  rec.appendChild(tr);
  document.getElementById('name').value = ''; document.getElementById('value').value = '';
  touch();
});
document.getElementById('save').addEventListener('click', function () { dirty.classList.remove('on'); saved.classList.add('on'); });
