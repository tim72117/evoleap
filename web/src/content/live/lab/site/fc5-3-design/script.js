document.getElementById('spec').addEventListener('click', function () {
  document.querySelector('.canvas').setAttribute('data-spec', '1');
  document.getElementById('spec').textContent = '標註已顯示';
});
