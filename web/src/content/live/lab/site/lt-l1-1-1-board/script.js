const notes = [...document.querySelectorAll('.n')];
notes.forEach((n) => {
  const s = document.createElement('div');
  s.className = 'src';
  s.innerHTML = (n.dataset.src === 'o' ? '<span class="tag g">原文</span>' : '<span class="tag r">推測</span>') + n.dataset.q;
  n.appendChild(s);
  if (n.dataset.src === 'g') n.dataset.mark = '推測';
  n.addEventListener('click', () => n.classList.toggle('show'));
});
document.getElementById('tagAll').addEventListener('click', (e) => {
  notes.forEach((n) => n.classList.add('show'));
  e.currentTarget.classList.add('done');
});
const sorter = (id, col) => document.getElementById(id).addEventListener('click', (e) => {
  notes.filter((n) => n.dataset.col === col).forEach((n) => document.getElementById('col-' + col).appendChild(n));
  e.currentTarget.classList.add('done');
});
sorter('sortMust', 'must');
sorter('sortNice', 'nice');
sorter('sortTbd', 'tbd');
