var pg = document.getElementById('pg');
document.getElementById('google').addEventListener('click', function () { pg.dataset.view = '2'; });
document.getElementById('plat-browser').addEventListener('click', function () { this.classList.add('sel'); });
document.getElementById('create').addEventListener('click', function () { pg.dataset.view = '3'; });
document.getElementById('copy').addEventListener('click', function () { document.getElementById('copied').classList.add('on'); });
