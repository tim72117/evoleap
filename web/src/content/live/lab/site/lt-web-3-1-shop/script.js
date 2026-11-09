// 事件紀錄(幕後):每次事件發生,記一列「事件、發生在哪、誰在聽、做了什麼」
const log = document.getElementById('log');
const chips = document.querySelectorAll('.chip');
function record(type, where, who, what) {
  const empty = document.getElementById('empty');
  if (empty) empty.remove();
  const old = document.getElementById('latest');
  if (old) { old.removeAttribute('id'); old.classList.remove('new'); }
  const row = document.createElement('div');
  row.className = 'row new';
  row.id = 'latest';
  row.innerHTML = '<code>' + type + '</code><span>' + where + '</span><span class="who">' + who + '</span><span>' + what + '</span>';
  log.appendChild(row);
  while (log.children.length > 5) log.removeChild(log.firstChild);
  chips.forEach((c) => c.classList.toggle('on', c.dataset.type === type));
}

// 監聽 click:加入購物車
let cart = 0;
document.getElementById('add').addEventListener('click', () => {
  cart += 1;
  document.getElementById('count').textContent = cart;
  record('click', '「加入購物車」按鈕', 'addToCart()', '購物車 +1，變成 ' + cart);
});

// 監聽 input:邊打字邊檢查 Email 格式
const email = document.getElementById('email');
const hint = document.getElementById('hint');
email.addEventListener('input', () => {
  const ok = /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email.value);
  hint.textContent = ok ? '✓ 格式正確' : '✗ 格式不對：少了 @ 或網域';
  hint.className = 'hint ' + (ok ? 'good' : 'bad');
  record('input', 'Email 欄位', 'checkEmail()', ok ? '顯示「格式正確」' : '顯示「格式不對」');
});

// 監聽 submit:送出訂閱表單
document.getElementById('news').addEventListener('submit', (e) => {
  e.preventDefault();
  document.getElementById('done').hidden = false;
  record('submit', '訂閱表單', 'subscribe()', '顯示「訂閱成功」');
});
