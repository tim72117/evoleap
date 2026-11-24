var checks = ['c1', 'c5', 'c6', 'c6'];
document.querySelectorAll('.chips button').forEach(function (b, i) {
  b.addEventListener('click', function () {
    if (b.classList.contains('used')) return;
    b.classList.add('used');
    var chip = document.createElement('div');
    chip.className = 'chip';
    chip.textContent = b.getAttribute('data-t');
    document.getElementById(b.getAttribute('data-c')).appendChild(chip);
    document.getElementById(checks[i]).classList.add('done');
  });
});
