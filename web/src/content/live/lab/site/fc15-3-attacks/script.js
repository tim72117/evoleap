var app = document.querySelector('.app');
document.querySelectorAll('.tabs button').forEach(function (b) {
  b.addEventListener('click', function () { app.className = 'app t' + b.getAttribute('data-t'); });
});
