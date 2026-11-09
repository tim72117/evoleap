// 點一格：把剛才一問一答得到的內容寫進那一格（只切換 class，沒有計時器）
['sec-input', 'sec-steps', 'sec-output', 'sec-check'].forEach((id) => {
  const sec = document.getElementById(id);
  sec.addEventListener('click', () => sec.classList.add('filled'));
});
