// 點點看:點一個元素,顯示或隱藏它的框與標籤;點到裡面的元素時,外面的容器不跟著切換
document.querySelectorAll('[data-x]').forEach((box) => {
  box.addEventListener('click', (e) => {
    e.stopPropagation();
    box.classList.toggle('on');
  });
});

// 藏起來的開關:<button data-hide="card"> 點一下,把 data-x="card" 的元素藏起來(容器連同裡面的東西),再點一次恢復
document.querySelectorAll('[data-hide]').forEach((btn) => {
  btn.addEventListener('click', () => {
    document.querySelector(`[data-x="${btn.dataset.hide}"]`)?.classList.toggle('gone');
  });
});
