var n = 0;
var cart = document.getElementById('cart');
var toast = document.getElementById('toast');
function add() { n += 1; cart.textContent = n; toast.textContent = '已加入購物車'; }
// 頁面初始化時綁一次……
document.getElementById('add').addEventListener('click', function () { add(); });
// ……顯示商品時又綁了一次（這就是問題）
document.getElementById('add').addEventListener('click', function () { add(); });
