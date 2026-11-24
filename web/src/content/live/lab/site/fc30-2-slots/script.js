var names = { am: '上午 9:00–12:00', pm: '下午 13:00–18:00' };
document.getElementById('order').addEventListener('submit', function () {
  var v = document.getElementById('slot').value;
  var done = document.getElementById('done');
  done.textContent = v ? '已送出！請在 11/14（六）' + names[v] + ' 來取貨。' : '請選擇取貨時段';
  done.className = 'done on' + (v ? '' : ' warn');
});
