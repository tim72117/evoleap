document.getElementById('qf').addEventListener('submit', function () {
  if (document.getElementById('q').value.indexOf('ERROR') >= 0) {
    document.getElementById('logs').classList.add('filtered');
    document.getElementById('count').textContent = '顯示 214 行（全部是同一種錯誤：付款失敗：缺少設定 PAYMENT_KEY）';
  }
});
