const app = document.getElementById('app');
const pii = document.querySelectorAll('.pii');
document.getElementById('find').addEventListener('click', (e) => {
  app.classList.add('f1');
  e.currentTarget.classList.add('done');
  document.querySelector('.found .n').textContent = String(pii.length);
  document.querySelector('.found .kinds').textContent = [...pii].map((p) => p.dataset.k).join('、');
});
document.getElementById('mask').addEventListener('click', (e) => {
  app.classList.add('f1', 'f2');
  e.currentTarget.classList.add('done');
});
