var lines = document.querySelectorAll('.lines li');
var verdict = document.getElementById('verdict');
var shown = 0;
document.getElementById('next').addEventListener('click', function () {
  if (shown < lines.length) { lines[shown].classList.add('on'); shown++; }
  else verdict.classList.add('on');
});
