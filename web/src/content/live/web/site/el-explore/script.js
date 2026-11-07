// 點點看:點一個元素,顯示或隱藏它的框與標籤;點到裡面的元素時,外面的容器不跟著切換
document.querySelectorAll('[data-x]').forEach((box) => {
  box.addEventListener('click', (e) => {
    e.stopPropagation();
    box.classList.toggle('on');
  });
});
