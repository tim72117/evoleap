const app = document.getElementById('app');
const V = Number(app.dataset.v);
document.querySelectorAll('[data-need]').forEach((el) => { if (V < Number(el.dataset.need)) el.remove(); });
const $ = (id) => document.getElementById(id);
const EX = '同事甲 珍奶 半糖少冰 55\n同事乙 紅茶 無糖去冰 35\n同事丙 珍奶 半糖少冰 55\n同事丁 珍奶 無糖去冰 55';
const DATA = { ex: EX, edge: EX + '\n同事甲 紅茶 無糖去冰 35\n同事戊 綠茶 微糖少冰 五十五' };
function render() {
  const lines = $('list').value.split('\n').filter((l) => l.trim());
  const warns = [];
  const order = new Map();
  const per = new Map();
  let cups = 0;
  let money = 0;
  lines.forEach((l, i) => {
    const [name, item, sugar, priceText] = l.trim().split(V >= 5 ? /[\s　]+/ : ' ');
    const price = Number(priceText);
    if (V >= 5 && (!item || !sugar || !Number.isFinite(price))) { warns.push(`第 ${i + 1} 行「${l.trim()}」看不懂：價格請寫成數字（例如 55），其他行照常計算`); return; }
    const key = V >= 2 ? `${item} ${sugar}` : item;
    order.set(key, (order.get(key) || 0) + 1);
    per.set(name, (per.get(name) || 0) + price);
    cups += 1;
    money += price;
  });
  $('order').innerHTML = [...order].map(([k, n]) => `<tr><td>${k}</td><td class="n">× ${n}</td></tr>`).join('') || '<tr><td class="muted">（還沒有點單）</td></tr>';
  $('cups').textContent = String(cups);
  $('money').textContent = `${money} 元`;
  $('per').innerHTML = [...per].map(([k, n]) => `<span>${k} <b>${n}</b></span>`).join('');
  if (V >= 5 && !lines.length) warns.push('請先貼上點單訊息');
  $('warns').innerHTML = warns.map((w) => `<div>⚠ ${w}</div>`).join('');
}
document.querySelectorAll('[data-paste]').forEach((b) => b.addEventListener('click', () => { $('list').value = DATA[b.dataset.paste]; app.classList.remove('did-copy'); render(); }));
if ($('copy')) $('copy').addEventListener('click', () => app.classList.add('did-copy'));
$('list').addEventListener('input', render);
render();
