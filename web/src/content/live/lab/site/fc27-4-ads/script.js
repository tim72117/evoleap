(function(){
  function show(name){
    document.querySelectorAll('[data-tab]').forEach(function(e){e.classList.toggle('act',e.getAttribute('data-tab')===name)});
    document.querySelectorAll('[data-panel]').forEach(function(e){e.classList.toggle('gone',e.getAttribute('data-panel')!==name)});
  }
  document.querySelectorAll('[data-tab]').forEach(function(e){e.addEventListener('click',function(){show(e.getAttribute('data-tab'))})});
  var first=document.querySelector('[data-tab].act')||document.querySelector('[data-tab]');
  if(first)show(first.getAttribute('data-tab'));
})();

document.getElementById('addpay').addEventListener('click',function(){document.getElementById('paystate').textContent='信用卡 •••• 已設定'});
document.getElementById('submit').addEventListener('click',function(){document.getElementById('sent').classList.remove('gone')});
