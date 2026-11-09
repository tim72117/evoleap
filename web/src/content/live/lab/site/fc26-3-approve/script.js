var base=document.getElementById('draft').textContent;document.getElementById('add').addEventListener('input',function(){var a=document.getElementById('add').value;document.getElementById('draft').textContent=base+(a?' '+a:'')});
document.getElementById('approve').addEventListener('click',function(){var s=document.getElementById('st');s.textContent='已核准 · 明天 10:00 自動發布';s.className='pill ok'});
document.getElementById('reject').addEventListener('click',function(){var s=document.getElementById('st');s.textContent='已退回';s.className='pill bad'});
