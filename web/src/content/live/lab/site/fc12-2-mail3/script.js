var app = document.querySelector('.app');
var uses = 0;
document.getElementById('cta').addEventListener('click', function () {
  uses += 1;
  app.className = 'app ' + (uses === 1 ? 's1' : 's2');
});
document.getElementById('save').addEventListener('click', function () { app.className = 'app'; });
document.getElementById('back').addEventListener('click', function () { app.className = 'app'; });
