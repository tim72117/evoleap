// 清單資料 → 卡片:重複(每一筆畫一張)、條件(庫存 0 顯示售完、清單空的顯示提示)
const $ = (id) => document.getElementById(id);
const items = [
  { name: '手作陶杯', price: 680, stock: 5, color: '#d9c1a4' },
  { name: '亞麻茶巾', price: 320, stock: 12, color: '#c9d8c5' },
  { name: '木製托盤', price: 890, stock: 2, color: '#e3cba8' },
];
const more = [
  { name: '亞麻餐墊', price: 450, stock: 3, color: '#cdd9e5' },
  { name: '木湯匙', price: 180, stock: 0, color: '#e6d3b3' },
  { name: '陶瓷小碟', price: 260, stock: 8, color: '#e8d5d5' },
];
let fresh = -1;
function render() {
  // 左邊:清單資料
  let rows = '<div class="d-row head"><span>#</span><span>名稱</span><span>價格</span><span>庫存</span></div>';
  if (!items.length) rows += '<div class="d-empty">（空的：沒有任何一筆）</div>';
  items.forEach((it, i) => {
    rows += '<div class="d-row' + (i === fresh ? ' new' : '') + '"><span>' + (i + 1) + '</span><span>' + it.name + '</span><span>' + it.price + '</span><span class="' + (it.stock === 0 ? 'zero' : '') + '">' + it.stock + '</span></div>';
  });
  $('data').innerHTML = rows;
  // 右邊:重複,每一筆畫一張卡片
  let html = '';
  items.forEach((it, i) => {
    const sold = it.stock === 0;
    html += '<div class="card' + (sold ? ' soldout' : '') + (i === fresh ? ' new' : '') + '" id="card' + (i + 1) + '">' +
      '<div class="pic" style="background:' + it.color + '"><span class="nth">第 ' + (i + 1) + ' 筆</span>' + (sold ? '<span class="sold">售完</span>' : '') + '</div>' +
      '<div class="info"><div class="name">' + it.name + '</div><div class="price">NT$ ' + it.price + '</div>' +
      '<button class="buy"' + (sold ? ' disabled>售完' : '>加入購物車') + '</button></div></div>';
  });
  if (!items.length) html = '<div class="none" id="none">目前沒有商品</div>';
  $('cards').innerHTML = html;
  $('count').textContent = items.length + ' 筆資料 → ' + items.length + ' 張卡片';
  $('r-loop').classList.toggle('on', items.length > 0);
  $('r-stock').classList.toggle('on', items.some((it) => it.stock === 0));
  $('r-empty').classList.toggle('on', !items.length);
}
$('add-item').addEventListener('click', () => {
  if (!more.length) return;
  items.push(more.shift());
  fresh = items.length - 1;
  render();
});
$('clear').addEventListener('click', () => {
  items.length = 0;
  fresh = -1;
  render();
});
render();
