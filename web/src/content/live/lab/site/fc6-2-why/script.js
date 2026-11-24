['env', 'db', 'dist', 'nm'].forEach(function (id) {
  var el = document.getElementById(id);
  el.addEventListener('click', function () { el.classList.add('open'); });
});
