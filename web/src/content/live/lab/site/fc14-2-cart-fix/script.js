var n = 0;
var cart = document.getElementById('cart');
var toast = document.getElementById('toast');
function add() { n += 1; cart.textContent = n; toast.textContent = '已加入購物車'; }
document.getElementById('add').addEventListener('click', add);
