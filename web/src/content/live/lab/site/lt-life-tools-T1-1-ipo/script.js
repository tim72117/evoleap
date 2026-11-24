var boxes = document.querySelectorAll('[data-x]');
var foot = document.getElementById('foot');
function refresh() {
  var n = 0;
  for (var i = 0; i < boxes.length; i++) if (boxes[i].classList.contains('on')) n++;
  foot.className = n === boxes.length ? 'foot on' : 'foot';
}
for (var i = 0; i < boxes.length; i++) {
  boxes[i].addEventListener('click', function (e) { e.currentTarget.classList.toggle('on'); refresh(); });
}
