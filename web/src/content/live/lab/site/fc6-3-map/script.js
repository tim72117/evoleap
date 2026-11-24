var map = document.querySelector('.map');
['no', 'yes', 'shared', 'local'].forEach(function (k) {
  document.getElementById(k).addEventListener('click', function () {
    if (k === 'shared' || k === 'local') map.classList.add('p-yes');
    map.classList.add('p-' + k);
  });
});
