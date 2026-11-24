var det = document.getElementById('detail');
['run', 'sql', 'log', 'net', 'disk'].forEach(function (k) {
  document.getElementById('s-' + k).addEventListener('click', function () {
    det.dataset.k = k;
    document.querySelectorAll('.li').forEach(function (li) { li.classList.toggle('sel', li.id === 's-' + k); });
    document.querySelectorAll('.sl').forEach(function (s) { s.classList.toggle('dim', s.getAttribute('data-k') !== k); });
  });
});
