var app = document.querySelector('.app');
app.classList.add('s0');
document.querySelectorAll('.chips button').forEach(function (b) {
  b.addEventListener('click', function () {
    app.className = 'app s' + b.getAttribute('data-s');
  });
});
