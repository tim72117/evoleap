var res = document.getElementById('res');
var a = document.getElementById('b-day'), b = document.getElementById('b-pitr');
a.addEventListener('click', function () { res.dataset.r = '1'; a.classList.add('sel'); b.classList.remove('sel'); });
b.addEventListener('click', function () { res.dataset.r = '2'; b.classList.add('sel'); a.classList.remove('sel'); });
