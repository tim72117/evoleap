var app = document.querySelector('.app');
document.querySelectorAll('.chips button').forEach(function (b) {
  b.addEventListener('click', function () { app.className = 'app s' + b.getAttribute('data-s'); });
});
