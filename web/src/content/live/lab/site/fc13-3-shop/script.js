var app = document.querySelector('.app');
var n = 0;
document.getElementById('add').addEventListener('click', function () {
  n += 1;
  document.getElementById('cart').textContent = n;
});
document.getElementById('checkout').addEventListener('click', function (e) {
  e.preventDefault();
  document.getElementById('qty').textContent = n;
  document.getElementById('sum').textContent = n * 280;
  app.className = 'app paying';
});
document.getElementById('pay').addEventListener('click', function () {
  if (document.getElementById('email').value) app.className = 'app ok';
});
