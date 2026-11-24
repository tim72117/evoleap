['c1', 'c2', 'c3', 'c4'].forEach(function (id) {
  var c = document.getElementById(id);
  c.addEventListener('click', function () { c.classList.add('open'); });
});
