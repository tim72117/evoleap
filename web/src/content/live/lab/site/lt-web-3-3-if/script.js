// 註冊表單:送出時依序判斷兩個條件,右邊的流程圖亮出這一次走的路線
const $ = (id) => document.getElementById(id);
const msg = $('msg');
const ids = ['n-start', 'e-s', 'q1', 'e-1y', 'r1', 'e-1n', 'q2', 'e-2y', 'r2', 'e-2n', 'ok'];
function light(path) {
  ids.forEach((id) => $(id).classList.toggle('on', path.includes(id)));
}
$('form').addEventListener('submit', (e) => {
  e.preventDefault();
  const email = $('email').value.trim();
  const pw = $('pw').value;
  if (email === '') {
    msg.textContent = '請填 Email';
    msg.className = 'msg bad';
    light(['n-start', 'e-s', 'q1', 'e-1y', 'r1']);
  } else if (pw.length < 8) {
    msg.textContent = '密碼至少 8 個字';
    msg.className = 'msg bad';
    light(['n-start', 'e-s', 'q1', 'e-1n', 'q2', 'e-2y', 'r2']);
  } else {
    msg.textContent = '註冊成功，歡迎加入！';
    msg.className = 'msg good';
    light(['n-start', 'e-s', 'q1', 'e-1n', 'q2', 'e-2n', 'ok']);
  }
});
