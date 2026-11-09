(function(){
  function show(name){
    document.querySelectorAll('[data-tab]').forEach(function(e){e.classList.toggle('act',e.getAttribute('data-tab')===name)});
    document.querySelectorAll('[data-panel]').forEach(function(e){e.classList.toggle('gone',e.getAttribute('data-panel')!==name)});
  }
  document.querySelectorAll('[data-tab]').forEach(function(e){e.addEventListener('click',function(){show(e.getAttribute('data-tab'))})});
  var first=document.querySelector('[data-tab].act')||document.querySelector('[data-tab]');
  if(first)show(first.getAttribute('data-tab'));
})();

document.getElementById('verify').addEventListener('click',function(){var r=document.getElementById('vres');r.textContent='已驗證';r.className='pill ok';document.getElementById('vok').classList.remove('gone')});
