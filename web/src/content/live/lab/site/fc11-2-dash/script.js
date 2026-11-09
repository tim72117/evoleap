const $ = (id) => document.getElementById(id)
$('mode').addEventListener('click', () => {
  const live = $('pg').classList.toggle('live')
  $('mlabel').textContent = live ? '正式模式' : '測試模式'
  $('banner').textContent = live ? '正式模式：這裡是真的錢。' : '你正在看測試資料。這裡的付款都不是真的錢。'
  $('pk').textContent = live ? 'pk_live_…（審核通過後才有）' : 'pk_test_51Nx…a8Qd'
  $('sk').textContent = live ? 'sk_live_…（審核通過後才有）' : 'sk_test_••••••••••••••••7Rk2'
  $('live').classList.toggle('hide', !live)
})
