const app = document.getElementById('app');
const rows = [...document.querySelectorAll('button.tr')];
const mark = (r) => {
  r.classList.add('run');
  const fixed = app.classList.contains('fixed');
  const ok = r.dataset.ok === '1' || fixed;
  r.querySelector('.res').innerHTML = ok
    ? '<span class="tag g">✓ 是／否</span>' + (fixed && r.dataset.ok === '0' ? ' <span class="tag b">改過</span>' : fixed ? ' <span class="tag">沒動</span>' : '')
    : '<span class="tag r">？ ' + r.dataset.why + '</span>';
  count();
};
const count = () => {
  const run = rows.filter((r) => r.classList.contains('run'));
  const fixed = app.classList.contains('fixed');
  const bad = fixed ? 0 : run.filter((r) => r.dataset.ok === '0').length;
  document.querySelector('.foot .n').textContent = String(run.length - bad + (fixed ? 1 : 0));
  document.querySelector('.foot .m').textContent = String(bad);
};
rows.forEach((r) => r.addEventListener('click', () => mark(r)));
document.getElementById('runAll').addEventListener('click', (e) => { rows.forEach(mark); e.currentTarget.classList.add('done'); });
document.getElementById('fix').addEventListener('click', (e) => {
  app.classList.add('fixed');
  rows.forEach((r) => r.classList.toggle('same', r.dataset.ok === '1'));
  rows.forEach(mark);
  e.currentTarget.classList.add('done');
});
