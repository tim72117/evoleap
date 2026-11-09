document.querySelectorAll('[data-show]').forEach(function(e){e.addEventListener('click',function(){e.getAttribute('data-show').split(' ').forEach(function(id){var t=document.getElementById(id);if(t)t.classList.remove('gone')});e.classList.add('act')})});
document.querySelectorAll('[data-hide]').forEach(function(e){e.addEventListener('click',function(){e.getAttribute('data-hide').split(' ').forEach(function(id){var t=document.getElementById(id);if(t)t.classList.add('gone')})})});
function env(live){document.getElementById('env-live').classList.toggle('act',live);document.getElementById('env-test').classList.toggle('act',!live);var m=document.getElementById('mode');m.textContent=live?'正式模式':'測試模式';m.classList.toggle('live',live)}
document.getElementById('env-live').addEventListener('click',function(){env(true)});
document.getElementById('env-test').addEventListener('click',function(){env(false)});
document.getElementById('save').addEventListener('click',function(){var u=document.getElementById('url').value,e=document.getElementById('ev').value;
 var em=document.getElementById('empty');if(em)em.remove();
 var tr=document.createElement('tr');tr.id='ep';tr.innerHTML='<td class="mono"></td><td class="mono"></td><td><span class="pill ok">已啟用</span></td>';tr.children[0].textContent=u;tr.children[1].textContent=e;
 var old=document.getElementById('ep');if(old)old.remove();document.getElementById('list').appendChild(tr);
 document.getElementById('form').classList.add('gone');['secret','test'].forEach(function(i){document.getElementById(i).classList.remove('gone')})});
document.getElementById('send').addEventListener('click',function(){var u=(document.getElementById('ep')||{children:[{textContent:''}]}).children[0].textContent;var ok=/\/api\/webhooks\/pay$/.test(u);var r=document.getElementById('tres');
 r.textContent=ok?'200 OK · 已收到':'404 Not Found';r.className='pill '+(ok?'ok':'bad')});
