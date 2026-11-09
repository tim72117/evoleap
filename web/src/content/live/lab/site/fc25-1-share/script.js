document.getElementById('fetch').addEventListener('click',function(){
 ['before','tags-before'].forEach(function(i){document.getElementById(i).classList.add('gone')});
 ['after','tags-after'].forEach(function(i){document.getElementById(i).classList.remove('gone')});
});
