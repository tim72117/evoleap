function upd(){document.getElementById('pn').textContent=document.getElementById('name').value||'商家名稱';document.getElementById('pc').textContent=document.getElementById('cat').value||'類別';document.getElementById('pd').textContent=document.getElementById('desc').value||'簡介'}
['name','cat','desc'].forEach(function(i){document.getElementById(i).addEventListener('input',upd);document.getElementById(i).addEventListener('change',upd)});
document.getElementById('send').addEventListener('click',function(){var d=document.getElementById('desc').value;var bad=/\.example|http|www|\d{4}/.test(d);
 document.getElementById('err').classList.toggle('gone',!bad);document.getElementById('ok').classList.toggle('gone',bad)});
upd();
