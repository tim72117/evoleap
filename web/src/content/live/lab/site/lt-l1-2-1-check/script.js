const app = document.getElementById('app');
document.getElementById('apply').addEventListener('click', (e) => { app.classList.add('up'); e.currentTarget.classList.add('done'); });
document.getElementById('fix').addEventListener('click', (e) => { app.classList.add('up', 'fixed'); e.currentTarget.classList.add('done'); });
document.querySelectorAll('.vr').forEach((r) => r.addEventListener('click', () => {
  r.classList.add('chk');
  document.querySelectorAll('.rl').forEach((l) => l.classList.toggle('lit', l.id === r.dataset.ref));
}));
