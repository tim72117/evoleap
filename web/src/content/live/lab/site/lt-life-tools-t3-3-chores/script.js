const app = document.getElementById('app');
function go(n) {
  for (let i = 1; i <= 9; i++) app.classList.toggle('on' + i, i <= n);
  app.dataset.s = String(n);
  document.querySelectorAll('[data-go]').forEach((b) => b.classList.toggle('cur', b.dataset.go === String(n)));
}
document.querySelectorAll('[data-go]').forEach((b) => b.addEventListener('click', () => go(Number(b.dataset.go))));
go(Number(app.dataset.start || 0));
