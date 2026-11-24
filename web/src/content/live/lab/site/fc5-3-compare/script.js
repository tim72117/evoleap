var rep = document.querySelector('.rep');
[1, 2, 3].forEach(function (n) {
  document.getElementById('r' + n).addEventListener('click', function () { rep.setAttribute('data-r', String(n)); });
});
