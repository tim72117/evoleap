const app = document.getElementById('app');
const items = [...document.querySelectorAll('.wi')];
const used = new Set(items.map((w) => w.dataset.src).filter(Boolean));
document.querySelectorAll('.rq').forEach((r) => r.classList.toggle('gap', !used.has(r.id)));
items.forEach((w) => w.addEventListener('click', () => {
  const on = !w.classList.contains('pick');
  items.forEach((x) => x.classList.remove('pick'));
  document.querySelectorAll('.ln').forEach((l) => l.classList.remove('hot'));
  document.querySelectorAll('.rq').forEach((r) => r.classList.remove('lit'));
  if (!on) return;
  w.classList.add('pick');
  document.querySelectorAll('.ln[data-w="' + w.id + '"]').forEach((l) => l.classList.add('hot'));
  if (w.dataset.src) document.getElementById(w.dataset.src).classList.add('lit');
}));
const step = (id, cls) => document.getElementById(id).addEventListener('click', (e) => { app.classList.add(cls); e.currentTarget.classList.add('done'); });
step('link', 'linked');
step('orphan', 's-orphan');
step('gap', 's-gap');
