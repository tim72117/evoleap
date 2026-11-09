var m = document.getElementById('modal');
document.getElementById('fb-open').addEventListener('click', function () { m.classList.add('on'); });
document.getElementById('fb-form').addEventListener('submit', function (e) { e.preventDefault(); m.classList.add('sent'); });
