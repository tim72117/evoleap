const rows = [...document.querySelectorAll('tbody tr')]
const count = () => {
  const n = rows.filter((r) => r.classList.contains('ok')).length
  document.getElementById('n').textContent = String(n)
  document.getElementById('done').classList.toggle('show', n === rows.length)
}
for (const r of rows) {
  const b = r.querySelector('.st')
  const mark = () => {
    if (r.dataset.fail === '1' && !r.classList.contains('bad')) {
      r.classList.add('bad')
      b.textContent = '✕ 沒設定 email'
    } else {
      r.classList.remove('bad')
      r.classList.add('ok')
      b.textContent = '✓ 通過'
    }
    count()
  }
  b.addEventListener('click', mark)
  r.addEventListener('click', (e) => { if (e.target === r) mark() })
}
