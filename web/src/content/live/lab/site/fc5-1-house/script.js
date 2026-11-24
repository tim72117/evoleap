var wrap = document.querySelector('.wrap');
function set(n) { if (Number(wrap.getAttribute('data-layer')) < n) wrap.setAttribute('data-layer', String(n)); }
document.getElementById('add-html').addEventListener('click', function () { set(1); });
document.getElementById('add-css').addEventListener('click', function () { set(2); });
document.getElementById('add-js').addEventListener('click', function () { set(3); });
document.getElementById('light').addEventListener('click', function () { set(4); document.getElementById('light').textContent = '燈亮了'; });
