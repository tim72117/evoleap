var j = document.getElementById('j-deploy');
j.addEventListener('click', function () {
  j.classList.add('sel');
  document.getElementById('log').classList.add('open');
  document.getElementById('hint').style.display = 'none';
});
