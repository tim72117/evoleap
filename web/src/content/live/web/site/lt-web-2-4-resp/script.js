// 漢堡選單:點一下展開導覽,再點一下收起來
const btn = document.getElementById('menu-btn');
const nav = document.getElementById('nav');
btn.addEventListener('click', () => {
  nav.classList.toggle('open');
  btn.classList.toggle('on');
});
