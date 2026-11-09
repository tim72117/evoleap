// 送出表單:顯示「已送出」(表單不會真的離開頁面)
document.getElementById('order').addEventListener('submit', function () {
  document.getElementById('done').classList.add('on');
  document.getElementById('send').textContent = '已送出';
});
