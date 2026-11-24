var doc = document.querySelector('.doc');
['phone', 'tablet', 'desktop'].forEach(function (k) {
  document.getElementById('bp-' + k).addEventListener('click', function () { doc.setAttribute('data-bp', k); });
});
