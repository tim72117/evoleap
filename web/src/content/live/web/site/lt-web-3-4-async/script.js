// 非同步的查詢:送出請求後先顯示載入中,等伺服器(由畫面右邊的按鈕扮演)回應,再畫出成功、失敗或逾時
const $ = (id) => document.getElementById(id);
const result = $('result');
const timeline = $('timeline');
const search = $('search');
let phase = 'idle';
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
const ROOMS = '<div class="room"><b>雙人木屋 A</b><span>NT$ 3,200</span></div><div class="room"><b>雙人木屋 C</b><span>NT$ 3,200</span></div><div class="room"><b>景觀雅房</b><span>NT$ 2,600</span></div>';
function start() {
  phase = 'loading';
  search.disabled = true;
  search.textContent = '查詢中…';
  result.innerHTML = '<p class="loading-tip" id="loading"><span class="spin"></span>正在查詢空位…</p><div class="skel"></div><div class="skel"></div><div class="skel"></div>';
  add('req', '<span class="tag">請求</span>查詢 11/22 的空位 →');
  add('wait', '等待回應中…（畫面照樣可以動）');
}
function finish() {
  phase = 'idle';
  search.disabled = false;
  search.textContent = '查詢空位';
}
search.addEventListener('click', start);
result.addEventListener('click', (e) => {
  if (e.target.closest('#retry')) start();
});
$('ok').addEventListener('click', () => {
  if (phase !== 'loading') return;
  finish();
  result.innerHTML = '<div id="rooms">' + ROOMS + '</div>';
  add('res ok', '← 3 個空位<span class="tag">成功</span>');
});
$('fail').addEventListener('click', () => {
  if (phase !== 'loading') return;
  finish();
  result.innerHTML = '<div class="warn fail" id="err"><b>查詢失敗</b>伺服器暫時出了問題，請再試一次。<br><button class="retry" id="retry">再試一次</button></div>';
  add('res err', '← 伺服器出錯<span class="tag">失敗</span>');
});
$('wait').addEventListener('click', () => {
  if (phase !== 'loading') return;
  finish();
  result.innerHTML = '<div class="warn slow" id="slow"><b>等太久了</b>超過 10 秒沒有回應，網路可能太慢。<br><button class="retry" id="retry">再試一次</button></div>';
  add('miss', '10 秒過去，回應沒有回來：逾時，放棄這次請求');
});
