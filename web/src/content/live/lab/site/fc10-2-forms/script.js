const $ = (id) => document.getElementById(id)
const users = { 'an@example.com': 'croissant88' }
const show = (items) => { $('chk').innerHTML = items.map(([ok, t]) => '<li class="' + (ok ? 'ok' : 'bad') + '">' + t + '</li>').join('') }
const tab = (reg) => { $('reg').classList.toggle('hide', !reg); $('login').classList.toggle('hide', reg); $('tReg').classList.toggle('on', reg); $('tLogin').classList.toggle('on', !reg); $('home').classList.add('hide') }
$('tReg').addEventListener('click', () => tab(true))
$('tLogin').addEventListener('click', () => tab(false))
$('reg').addEventListener('submit', () => {
  const e = $('rEmail').value.trim(), p = $('rPw').value
  const fmt = /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e), len = p.length >= 8, dup = !!users[e]
  const r = [[fmt, 'Email 格式正確'], [len, '密碼至少 8 個字']]
  if (fmt) r.push([!dup, 'Email 還沒被註冊過'])
  if (fmt && len && !dup) { r.push([true, '密碼雜湊後才存進資料庫'], [true, '寄出驗證信']); users[e] = p; $('rMsg').className = 'msg ok'; $('rMsg').textContent = '帳號建立好了，請到信箱收驗證信。' }
  else { $('rMsg').className = 'msg'; $('rMsg').textContent = !fmt ? 'Email 格式不對' : !len ? '密碼太短，至少 8 個字' : '這個 Email 已經註冊過，請直接登入' }
  show(r)
})
$('login').addEventListener('submit', () => {
  const e = $('lEmail').value.trim(), p = $('lPw').value
  const ok = users[e] === p
  if (!ok) { $('lMsg').className = 'msg'; $('lMsg').textContent = '帳號或密碼錯誤'; show([[true, '比對雜湊：不符'], [true, '錯誤訊息不透露是 Email 錯還是密碼錯'], [true, '記一次失敗（連錯 5 次要等 15 分鐘）']]); return }
  $('login').classList.add('hide'); $('home').classList.remove('hide'); $('who').textContent = e
  show([[true, '比對雜湊：相符'], [true, '換發新的 session ID'], [true, 'Set-Cookie：HttpOnly、Secure、SameSite=Lax']])
})
$('out').addEventListener('click', () => {
  $('home').classList.add('hide'); $('login').classList.remove('hide'); $('who').textContent = '訪客'; $('lMsg').textContent = ''
  show([[true, '伺服器刪除這個 session'], [true, '清掉瀏覽器的 cookie'], [true, '舊的 cookie 再拿來用也沒效']])
})
