const $ = (id) => document.getElementById(id)
$('pay').addEventListener('click', () => {
  const n = $('card').value.replace(/\s/g, '')
  if (n === '4242424242424242') { $('payBox').classList.add('hide'); $('done').classList.remove('hide') }
  else if (n === '4000000000000002') $('msg').textContent = '卡片被拒絕（測試卡：模擬銀行拒絕）'
  else $('msg').textContent = '測試模式只接受測試卡號'
})
