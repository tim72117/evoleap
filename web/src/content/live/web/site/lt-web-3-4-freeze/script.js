// 沒有載入狀態的查詢:請求送出後畫面完全不變,使用者以為沒按到,又按一次
const $ = (id) => document.getElementById(id);
const result = $('result');
const timeline = $('timeline');
let pending = 0;
let sent = 0;
function add(cls, html) {
  const empty = timeline.querySelector('.t-empty');
  if (empty) empty.remove();
  timeline.querySelectorAll('.new').forEach((e) => e.classList.remove('new'));
  const row = document.createElement('div');
  row.className = 'ev new ' + cls;
  row.innerHTML = html;
  timeline.appendChild(row);
  while (timeline.children.length > 7) timeline.removeChild(timeline.firstChild);
}
$('search').addEventListener('click', () => {
  pending += 1;
  sent += 1;
  add('req', '<span class="tag">請求</span>' + (sent === 1 ? '查詢 11/22 的空位 →' : '又送了一次同樣的請求 →'));
  add('wait', '等待回應中…（畫面上什麼都沒顯示）');
});
$('ok').addEventListener('click', () => {
  if (!pending) return;
  const n = pending;
  pending = 0;
  for (let i = 0; i < n; i++) add('res ok', '← 3 個空位<span class="tag">成功</span>');
  result.innerHTML = (n > 1 ? '<p class="dup" id="dup">同一個查詢送了 ' + n + ' 次</p>' : '') + '<div id="rooms"><div class="room"><b>雙人木屋 A</b><span>NT$ 3,200</span></div><div class="room"><b>雙人木屋 C</b><span>NT$ 3,200</span></div><div class="room"><b>景觀雅房</b><span>NT$ 2,600</span></div></div>';
});
