function upd(){var t=document.getElementById('title').value||'標題',s=document.getElementById('sub').value||'副標';
 document.querySelectorAll('.t').forEach(function(e){e.textContent=t});document.querySelectorAll('.s').forEach(function(e){e.textContent=s});
 document.getElementById('grid').classList.toggle('dark',document.getElementById('theme').value==='dark');}
['title','sub','theme'].forEach(function(i){document.getElementById(i).addEventListener('input',upd);document.getElementById(i).addEventListener('change',upd)});
document.getElementById('export').addEventListener('click',function(){document.getElementById('done').classList.remove('gone')});
upd();
