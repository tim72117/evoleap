// 沒有監聽的版本:事件照樣發生,紀錄寫下來,但沒有程式在聽,畫面不會變
const log = document.getElementById('log');
const chips = document.querySelectorAll('.chip');
function record(type, where) {
  const empty = document.getElementById('empty');
  if (empty) empty.remove();
  const old = document.getElementById('latest');
  if (old) { old.removeAttribute('id'); old.classList.remove('new'); }
  const row = document.createElement('div');
  row.className = 'row new';
  row.id = 'latest';
  row.innerHTML = '<code>' + type + '</code><span>' + where + '</span><span class="who none">（沒有）</span><span>什麼都沒發生</span>';
  log.appendChild(row);
  while (log.children.length > 5) log.removeChild(log.firstChild);
  chips.forEach((c) => c.classList.toggle('on', c.dataset.type === type));
}
// 這段只是幕後的紀錄器,不是網頁自己的功能
document.getElementById('add').addEventListener('click', () => record('click', '「加入購物車」按鈕'));
document.getElementById('news').addEventListener('submit', (e) => e.preventDefault());
