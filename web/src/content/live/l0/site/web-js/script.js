const add = document.getElementById('add');
const count = document.getElementById('count');
const toast = document.getElementById('toast');

add.addEventListener('click', () => {
  count.textContent = Number(count.textContent) + 1;
  toast.hidden = false;
});
