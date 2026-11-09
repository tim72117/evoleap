var MED={line:'social',ig:'social',threads:'social',newsletter:'email'};
function slug(s){return s.trim().toLowerCase().replace(/\s+/g,'-')}
function upd(){var b=document.getElementById('base').value,s=document.getElementById('src').value,c=slug(document.getElementById('cmp').value);
 var m=MED[s]||'';document.getElementById('med').value=m;
 document.getElementById('out').textContent=s?b+'?utm_source='+s+'&utm_medium='+m+(c?'&utm_campaign='+c:''):'—'}
['base','src','cmp'].forEach(function(i){document.getElementById(i).addEventListener('input',upd);document.getElementById(i).addEventListener('change',upd)});
document.getElementById('copy').addEventListener('click',function(){document.getElementById('copied').classList.remove('gone')});
upd();
