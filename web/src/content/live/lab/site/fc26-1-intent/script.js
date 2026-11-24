(function(){
  var n=0;
  var app=document.getElementById('app');
  function upd(){
    document.querySelectorAll('[data-s]').forEach(function(e){var s=+e.getAttribute('data-s');e.classList.toggle('on',s<=n);e.classList.toggle('now',s===n)});
    document.querySelectorAll('[data-k]').forEach(function(e){var ks=e.getAttribute('data-k').split(' ');e.classList.toggle('lit',ks.indexOf(String(n))>=0)});
    document.querySelectorAll('[data-t'+n+']').forEach(function(e){e.textContent=e.getAttribute('data-t'+n)});
    if(app)app.setAttribute('data-step',String(n));
  }
  document.querySelectorAll('#next,.nx').forEach(function(b){b.addEventListener('click',function(){n++;upd()})});
  document.querySelectorAll('[data-go]').forEach(function(e){e.addEventListener('click',function(){n=+e.getAttribute('data-go');upd()})});
  upd();
})();
