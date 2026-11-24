var w = document.querySelector('.w');
document.getElementById('edit').addEventListener('click', function () { w.setAttribute('data-done', '1'); });
document.getElementById('single').addEventListener('click', function () { w.setAttribute('data-mode', 'single'); w.setAttribute('data-done', '0'); });
