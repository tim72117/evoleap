let n = 0
for (const b of document.querySelectorAll('.ev')) b.addEventListener('click', () => {
  n++
  b.classList.add('sent')
  const code = b.dataset.code || '200'
  const tr = document.createElement('tr')
  tr.innerHTML = '<td>' + n + '</td><td>' + b.dataset.ev + '</td><td><span class="tag ' + (code === '200' ? 'ok' : 'bad') + '">' + code + (code === '200' ? ' OK' : ' 簽章驗證失敗') + '</span></td>'
  document.getElementById('log').appendChild(tr)
})
