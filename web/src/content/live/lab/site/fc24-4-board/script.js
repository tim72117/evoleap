document.querySelectorAll('.inbox .fb').forEach(function (fb) {
  fb.addEventListener('click', function () {
    var to = fb.getAttribute('data-to');
    document.querySelector('#col-' + to + ' .drop').appendChild(fb);
    var n = document.getElementById('n-' + to);
    n.textContent = String(Number(n.textContent) + 1);
    if (!document.querySelector('.inbox .fb')) document.getElementById('todo').classList.add('on');
  });
});
