const app = document.getElementById('app');
const V = Number(app.dataset.v);
document.querySelectorAll('[data-need]').forEach((el) => { if (V < Number(el.dataset.need)) el.remove(); });
const $ = (id) => document.getElementById(id);
const PEOPLE = [['陳怡君', '行銷部'], ['林家豪', '業務部'], ['王佩珊', '人資部'], ['張志明', '研發部'], ['李欣怡', '財務部'], ['黃俊傑', '業務部'], ['吳雅雯', '行銷部'], ['劉建宏', '研發部'], ['蔡淑芬', '總務部'], ['楊宗翰', '研發部'], ['許雅筑', '客服部'], ['鄭文彬', '財務部']];
const DATA = {
  p12: PEOPLE.map((p) => p.join(', ')).join('\n'),
  p3: '王佩珊, 人資部\n張志明, 研發部\n李欣怡, 財務部',
  dup: '陳怡君, 行銷部\n陳怡君, 研發部\n林家豪, 業務部\n王佩珊, 人資部',
};
let people = [];
let drawn = [];
let splits = 0;
const label = (p) => {
  if (!p) return 'undefined';
  const twin = people.filter((x) => x.name === p.name).length > 1;
  return V >= 4 && twin ? `${p.name}<small>（${p.unit}）</small>` : p.name;
};
function parse() {
  people = $('list').value.split('\n').filter((l) => l.trim()).map((l) => {
    const parts = l.split(/[,，\t]/);
    return { name: parts[0].trim(), unit: parts.slice(1).join(' ').trim() };
  });
  drawn = [];
  $('total').textContent = `共 ${people.length} 人`;
  $('show').innerHTML = '按「抽籤」開始';
  $('show').classList.remove('hit');
  $('msg').textContent = '';
  if ($('gout')) { $('gout').innerHTML = ''; $('gmsg').textContent = ''; }
  renderDrawn();
}
function renderDrawn() {
  if (V < 2) return;
  $('drawn').innerHTML = drawn.map((i) => `<li>${label(people[i])}</li>`).join('');
  $('left').textContent = `剩餘 ${people.length - drawn.length} 人`;
}
$('draw').addEventListener('click', () => {
  const rest = people.map((_, i) => i).filter((i) => !drawn.includes(i));
  if (V >= 4 && !people.length) { $('msg').textContent = '名單是空的，請先貼上名單'; return; }
  if (V >= 4 && !rest.length) { $('msg').textContent = '全部抽完了，按「重設」重新開始'; return; }
  const pick = rest[(drawn.length * 5 + 3) % Math.max(1, rest.length)];
  $('show').innerHTML = label(people[pick]);
  $('show').classList.add('hit');
  if (pick !== undefined) drawn.push(pick);
  renderDrawn();
});
$('reset').addEventListener('click', () => { drawn = []; $('show').innerHTML = '按「抽籤」開始'; $('show').classList.remove('hit'); $('msg').textContent = ''; renderDrawn(); });
if (V >= 3) {
  $('split').addEventListener('click', () => {
    const n = Number($('groups').value) || 1;
    $('gmsg').textContent = '';
    if (V >= 4 && !people.length) { $('gmsg').textContent = '名單是空的，請先貼上名單'; $('gout').innerHTML = ''; return; }
    if (V >= 4 && n > people.length) { $('gmsg').textContent = `只有 ${people.length} 人，最多分 ${people.length} 組，請減少組數`; $('gout').innerHTML = ''; return; }
    splits++;
    const m = 2 * splits + 5;
    const order = people.map((_, i) => i).sort((a, b) => ((a * m + splits * 3) % 97) - ((b * m + splits * 3) % 97));
    const groups = Array.from({ length: n }, () => []);
    order.forEach((idx, k) => groups[k % n].push(idx));
    $('gout').innerHTML = groups.map((g, i) => `<div class="g"><b>第 ${i + 1} 組 · ${g.length} 人</b>${g.length ? g.map((idx) => `<span>${label(people[idx])}</span>`).join('') : '<em>（沒有人）</em>'}</div>`).join('');
  });
}
document.querySelectorAll('[data-paste]').forEach((b) => b.addEventListener('click', () => { $('list').value = DATA[b.dataset.paste]; parse(); }));
$('clear').addEventListener('click', () => { $('list').value = ''; parse(); });
$('list').addEventListener('input', parse);
parse();
