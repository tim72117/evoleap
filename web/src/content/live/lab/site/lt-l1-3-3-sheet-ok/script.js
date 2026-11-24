// 按「貼上」：把剪貼簿裡的表格貼進 A1（只切換 class，沒有計時器）
const app = document.getElementById('app');
document.getElementById('paste').addEventListener('click', () => {
  app.classList.add('pasted');
});
