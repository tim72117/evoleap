document.getElementById('save').addEventListener('click',function(){
 var t=document.getElementById('records');var tr=document.createElement('tr');tr.id='new';
 ['type','name','value'].forEach(function(id){var td=document.createElement('td');td.textContent=document.getElementById(id).value||'@';if(id==='value')td.className='mono';tr.appendChild(td)});
 var td=document.createElement('td');td.textContent='1 小時';tr.appendChild(td);tr.style.background='#fff7e0';t.appendChild(tr);
 document.getElementById('saved').classList.remove('gone');
});
