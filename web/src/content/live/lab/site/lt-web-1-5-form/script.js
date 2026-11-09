// 示範用的開關:點 [data-set="鍵=值 鍵=值"] 把 .page 的 data-鍵 設成值(CSS 依這些屬性切換畫面)。
// 沒有計時器、動畫與亂數:畫面只由點過哪些開關決定。
var page = document.querySelector('.page');
document.querySelectorAll('[data-set]').forEach(function (b) {
  b.addEventListener('click', function () {
    b.getAttribute('data-set').split(' ').forEach(function (pair) {
      var kv = pair.split('=');
      if (kv[0]) page.setAttribute('data-' + kv[0], kv[1] || '');
    });
  });
});

// 預約表單:送出時檢查必填欄位;空的就標紅、不送出;都填了就記下資料(右邊的信封與預約名單照著顯示)
var form = document.getElementById('form');
var SLOT = { 'sat-am': '11/15 上午', 'sat-pm': '11/15 下午', 'sun-am': '11/16 上午' };
form.addEventListener('submit', function () {
  var bad = false;
  form.querySelectorAll('[required]').forEach(function (el) {
    var f = el.closest('.f');
    var empty = !el.value.trim();
    f.classList.toggle('err', empty);
    if (empty) bad = true;
  });
  if (bad) { page.setAttribute('data-sent', 'no'); return; }
  var name = document.getElementById('name').value;
  var phone = document.getElementById('phone').value;
  var slot = document.getElementById('slot').value;
  var kit = document.getElementById('kit').checked ? '是' : '否';
  document.getElementById('v-name').textContent = name;
  document.getElementById('v-phone').textContent = phone;
  document.getElementById('v-slot').textContent = slot;
  document.getElementById('v-kit').textContent = kit === '是' ? 'yes' : 'no';
  document.getElementById('d-name').textContent = name;
  document.getElementById('d-slot').textContent = SLOT[slot] || slot;
  document.getElementById('d-kit').textContent = kit;
  page.setAttribute('data-sent', 'yes');
});
