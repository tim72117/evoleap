const app = document.getElementById('app');
['bg', 'task', 'limit', 'fmt'].forEach((k) => {
  document.getElementById(k).addEventListener('click', (e) => {
    app.classList.add(k);
    document.getElementById('s-' + k).classList.add('on');
    e.currentTarget.classList.add('done');
    document.querySelector('.count .n').textContent = String(document.querySelectorAll('.slot.on').length);
  });
});
