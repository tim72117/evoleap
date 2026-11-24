var st = document.getElementById('st-ga');
function done(on) {
  document.getElementById('banner').classList.add('gone');
  st.textContent = on ? '分析（GA4）：開啟，正在送出' : '分析（GA4）：關閉，0 個請求';
  st.className = on ? 'on' : 'off';
}
document.getElementById('reject').addEventListener('click', function () { done(false); });
document.getElementById('accept').addEventListener('click', function () { done(true); });
