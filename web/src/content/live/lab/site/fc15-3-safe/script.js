document.getElementById('f').addEventListener('submit', function () {
  var c = document.createElement('div'); c.className = 'c new';
  var b = document.createElement('b'); b.textContent = document.getElementById('name').value;
  var p = document.createElement('p'); p.textContent = document.getElementById('msg').value; // 當成文字，不當成程式
  c.appendChild(b); c.appendChild(p);
  document.getElementById('list').appendChild(c);
  document.getElementById('safe').textContent = '🛡 留言原封不動顯示成文字，沒有被執行';
});
