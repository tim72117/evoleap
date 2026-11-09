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
const log = document.getElementById('log');
document.getElementById('err').addEventListener('click', (e) => e.currentTarget.classList.toggle('open'));
const add = (cls, text) => { const d = document.createElement('div'); d.className = 'm ' + cls; d.textContent = text; log.appendChild(d); };
const cmd = document.getElementById('cmd');
cmd.addEventListener('change', () => {
  const c = cmd.value.trim();
  if (!c) return;
  add('in', '› ' + c);
  const set = /\.title'\)\.textContent\s*=\s*'([^']*)'/.exec(c);
  if (set) { document.querySelector('.title').textContent = set[1]; add('outv', "'" + set[1] + "'"); }
  else if (c.includes('#cart-btn')) add('nul', 'null');
  else if (c.includes('#cartBtn')) add('outv', '<button id="cartBtn">加入購物車</button>');
  else add('nul', 'undefined');
  cmd.value = '';
});
