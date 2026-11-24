var msg = document.getElementById('msg');
var rej = document.getElementById('rej');
var saved = document.getElementById('saved');
var tgrid = document.getElementById('tgrid');
var ok = [];
document.querySelectorAll('.file').forEach(function (f) {
  f.addEventListener('click', function () {
    if (f.classList.contains('gone')) return;
    f.classList.add('gone');
    var name = f.childNodes[1].textContent;
    var d = document.createElement('div');
    if (f.getAttribute('data-ok') === '1') {
      d.textContent = '✓ ' + name;
      saved.appendChild(d);
      ok.push(f.id);
      msg.textContent = name + ' 通過檢查，存進雲端儲存，得到自己的網址。';
    } else {
      d.textContent = '✗ ' + name + '：' + f.getAttribute('data-why');
      rej.appendChild(d);
      msg.textContent = name + ' 被擋下來：' + f.getAttribute('data-why') + '，告訴使用者原因。';
    }
  });
});
document.getElementById('make').addEventListener('click', function () {
  tgrid.innerHTML = '';
  ok.forEach(function (id) {
    var t = document.createElement('div');
    t.className = id === 'f1' ? 't1' : 't4';
    t.textContent = id === 'f1' ? '貓咪 300px' : '甜點 300px';
    tgrid.appendChild(t);
  });
  document.getElementById('cmp').classList.add('on');
  msg.textContent = '另存一份 300 像素寬的小圖：列表頁用縮圖，點進去才看原圖。';
});
