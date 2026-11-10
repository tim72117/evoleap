const NAMES = { a: '小美', b: '阿哲', c: '佳慧', d: '小芸' };
const ids = Object.keys(NAMES);
const $ = (id) => document.getElementById(id);

function calc() {
  const paid = ids.map((id) => Number($(id).value.replace(/\D/g, '')) || 0);
  const sum = paid.reduce((a, b) => a + b, 0);
  const each = Math.round(sum / ids.length);
  $('sum').textContent = sum.toLocaleString();
  $('each').textContent = each.toLocaleString();
  const out = $('result');
  if (!sum) {
    out.innerHTML = '<p class="empty">填上金額就會算出來</p>';
    return;
  }
  // 付太少的人依序補給付太多的人
  const bal = ids.map((id, i) => ({ name: NAMES[id], v: paid[i] - each }));
  const give = bal.filter((p) => p.v < 0);
  const take = bal.filter((p) => p.v > 0);
  const rows = [];
  for (const g of give) {
    for (const t of take) {
      if (g.v === 0) break;
      const n = Math.min(-g.v, t.v);
      if (n <= 0) continue;
      rows.push(`<div class="pay">${g.name}<span class="arrow">→</span>${t.name}<b>${n.toLocaleString()} 元</b></div>`);
      g.v += n;
      t.v -= n;
    }
  }
  out.innerHTML = rows.join('') + '<div class="done">✓ 轉完就扯平了</div>';
}

ids.forEach((id) => $(id).addEventListener('input', calc));
