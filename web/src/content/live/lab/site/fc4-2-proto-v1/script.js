const app = document.getElementById('app');
function go(n) {
  for (let i = 1; i <= 9; i++) app.classList.toggle('on' + i, i <= n);
  app.dataset.s = String(n);
  document.querySelectorAll('[data-go]').forEach((b) => b.classList.toggle('cur', b.dataset.go === String(n)));
}
document.querySelectorAll('[data-go]').forEach((b) => b.addEventListener('click', () => go(Number(b.dataset.go))));
document.querySelectorAll('[data-pick]').forEach((b) => b.addEventListener('click', () => {
  app.dataset.pick = b.dataset.pick;
  document.querySelectorAll('[data-pick]').forEach((x) => x.classList.toggle('cur', x.dataset.pick === b.dataset.pick));
}));
function count() {
  const n = document.querySelectorAll('[data-toggle].done').length;
  document.querySelectorAll('[data-count]').forEach((c) => { c.textContent = String(n); });
  document.querySelectorAll('[data-bar]').forEach((c) => { c.style.width = (100 * n / Number(c.dataset.bar)) + '%'; });
}
document.querySelectorAll('[data-toggle]').forEach((b) => b.addEventListener('click', () => { b.classList.toggle('done'); count(); }));
if (app.dataset.start) go(Number(app.dataset.start));
const n = document.getElementById('n');
if (n) {
  document.getElementById('plus').addEventListener('click', () => { n.textContent = String(Number(n.textContent) + 1); });
  document.getElementById('minus').addEventListener('click', () => { n.textContent = String(Math.max(1, Number(n.textContent) - 1)); });
}
