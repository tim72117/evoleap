// 示意主控台:按「建立使用者」把欄位內容加到清單,顯示連線字串(密碼以 **** 代替)。沒有計時器。
var btn = document.getElementById('create');
btn.addEventListener('click', function () {
  var u = document.getElementById('user').value || 'new_user';
  var role = document.getElementById('role').value;
  var tr = document.createElement('tr');
  var label = role === 'ro' ? '<span class="ro">唯讀</span>' : '<span class="rw">讀寫</span>';
  tr.innerHTML = '<td>' + u + '</td><td>' + label + '</td><td>你</td>';
  document.querySelector('#list tbody').appendChild(tr);
  document.getElementById('conn').textContent = 'postgres://' + u + ':****@db.example-cloud.com:5432/bakery';
  document.getElementById('ok').classList.add('on');
});
