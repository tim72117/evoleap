var lead = document.getElementById('lead');
var cloud = document.getElementById('cloud-box');
var local = document.getElementById('local-box');
var ps = document.querySelectorAll('[data-p]');
for (var i = 0; i < ps.length; i++) ps[i].addEventListener('click', function (e) {
  var p = e.currentTarget.getAttribute('data-p');
  for (var j = 0; j < ps.length; j++) ps[j].classList.toggle('on', ps[j].getAttribute('data-p') === p);
  cloud.classList.toggle('hot', p === 'ai');
  local.classList.toggle('hot', p === 'local');
  lead.textContent = p === 'ai' ? '證件內容離開了你的電腦，送到 AI 服務' : '證件沒有離開你的電腦，交出去的是蓋好浮水印的新檔';
  lead.className = p === 'ai' ? 'lead bad' : 'lead good';
});
