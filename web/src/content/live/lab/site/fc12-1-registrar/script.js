var rows = document.getElementById('rows');
var saved = document.getElementById('saved');
function cell(t) { var td = document.createElement('td'); td.textContent = t; return td; }
document.getElementById('form').addEventListener('submit', function () {
  var type = document.getElementById('type').value;
  var name = document.getElementById('name');
  var value = document.getElementById('value');
  if (!name.value || !value.value) return;
  rows.querySelectorAll('tr.new').forEach(function (r) { r.classList.remove('new'); });
  var tr = document.createElement('tr');
  tr.className = 'new';
  var td = document.createElement('td');
  var tag = document.createElement('span'); tag.className = 't'; tag.textContent = type; td.appendChild(tag);
  tr.appendChild(td); tr.appendChild(cell(name.value)); tr.appendChild(cell(value.value));
  var act = document.createElement('td');
  var del = document.createElement('button'); del.type = 'button'; del.className = 'del'; del.textContent = '刪除';
  del.addEventListener('click', function () { tr.remove(); saved.textContent = '已刪除一筆紀錄'; });
  act.appendChild(del); tr.appendChild(act);
  rows.appendChild(tr);
  saved.textContent = '✓ 已儲存：' + type + ' ' + name.value;
  name.value = ''; value.value = '';
});
