const app = document.getElementById('app');
document.querySelectorAll('.nl').forEach((n) => n.addEventListener('click', () => n.classList.toggle('peek')));
const step = (id, cls) => document.getElementById(id).addEventListener('click', (e) => {
  app.classList.add(cls);
  e.currentTarget.classList.add('done');
});
step('markNew', 's-new');
step('markDiff', 's-diff');
step('merge', 's-merge');
