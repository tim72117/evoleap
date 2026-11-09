var btn = document.getElementById('menuBtn');
var nav = document.getElementById('nav');
btn.addEventListener('click', function () {
  var open = nav.classList.toggle('open');
  btn.setAttribute('aria-expanded', String(open));
});
