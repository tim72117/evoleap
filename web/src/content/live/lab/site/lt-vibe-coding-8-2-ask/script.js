const ids = ['os', 'cmd', 'err', 'tried', 'goal']
const head = { os: '環境', cmd: '執行的指令', err: '錯誤訊息', tried: '試過', goal: '目的' }
const esc = (s) => s.replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[c])
function update() {
  const parts = []
  for (const id of ids) {
    const v = document.getElementById(id).value.trim()
    document.getElementById('k-' + id).classList.toggle('ok', !!v)
    if (v) parts.push('<div class="pl"><b>' + head[id] + '：</b>' + (id === 'err' || id === 'cmd' ? '<code>' + esc(v) + '</code>' : esc(v)) + '</div>')
  }
  document.getElementById('msg').innerHTML = parts.length ? parts.join('') : '<span class="empty">填左邊的欄位，這裡會組成一則求助。</span>'
}
for (const id of ids) {
  document.getElementById(id).addEventListener('input', update)
  document.getElementById(id).addEventListener('change', update)
}
