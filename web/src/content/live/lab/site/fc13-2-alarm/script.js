var A = document.getElementById('dA'), B = document.getElementById('dB');
var msg = document.getElementById('msg');
document.getElementById('tA').addEventListener('click', function () {
  A.classList.add('beep'); document.getElementById('sA').textContent = '嗶——嗶——';
  msg.textContent = 'A 按測試鈕會響：它證明了自己「真的會叫」。';
});
document.getElementById('smoke').addEventListener('click', function () {
  document.getElementById('smokeArea').classList.add('smoky');
  A.classList.add('beep'); document.getElementById('sA').textContent = '嗶——嗶——';
  document.getElementById('sB').textContent = '……（還是安安靜靜）';
  msg.textContent = '真的冒煙了：A 響了，B 一聲都沒有。';
});
document.getElementById('open').addEventListener('click', function () {
  B.classList.add('opened');
  msg.textContent = 'B 從來沒響過，不是因為家裡安全，而是它根本不會響。';
});
