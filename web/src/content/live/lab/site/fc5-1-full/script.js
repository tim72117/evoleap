var btn = document.getElementById('hi');
var msg = document.getElementById('msg');
var count = 0;
btn.addEventListener('click', function () {
  count = count + 1;
  btn.classList.add('pressed');
  msg.classList.add('on');
  msg.textContent = '嗨！謝謝你來看我的頁面。已經有 ' + count + ' 個人跟我打招呼';
});
