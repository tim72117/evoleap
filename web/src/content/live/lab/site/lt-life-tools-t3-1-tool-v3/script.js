const app = document.getElementById('app');
const V = Number(app.dataset.v);
const list = document.getElementById('list');
const sheets = document.getElementById('sheets');
const count = document.getElementById('count');
const PEOPLE = [['陳怡君', '行銷部'], ['林家豪', '業務部'], ['王佩珊', '人資部'], ['張志明', '研發部'], ['李欣怡', '財務部'], ['黃俊傑', '業務部'], ['吳雅雯', '行銷部'], ['劉建宏', '研發部'], ['蔡淑芬', '總務部'], ['楊宗翰', '研發部'], ['許雅筑', '客服部'], ['鄭文彬', '財務部']];
const DATA = {
  comma: PEOPLE.map((p) => p.join(', ')).join('\n'),
  sheet: PEOPLE.map((p) => p.join('\t')).join('\n'),
  long: 'Maximilian Alexander, 國際業務暨通路開發部\n林家豪, 業務部\n王佩珊, 人資部',
  blank: '陳怡君, 行銷部\n\n林家豪, 業務部\n\n\n王佩珊, 人資部',
  one: '陳怡君, 行銷部',
};
const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;');
function parse(text) {
  if (!text.trim()) return [];
  let lines = text.split('\n');
  if (V >= 4) lines = lines.filter((l) => l.trim());
  const sep = V >= 2 ? /[,，\t]/ : /[,，]/;
  return lines.map((l) => {
    const parts = l.split(sep);
    return { name: (parts[0] || '').trim(), unit: parts.slice(1).join(' ').trim() };
  });
}
function render() {
  const people = parse(list.value);
  count.textContent = `共 ${people.length} 張`;
  if (!people.length) { sheets.innerHTML = '<div class="empty">貼上名單後，名牌會排在這裡</div>'; return; }
  let html = '';
  for (let p = 0; p < people.length; p += 8) {
    const page = people.slice(p, p + 8).map((x) => {
      const long = V >= 4 && x.name.length > 8 ? ' long' : '';
      return `<div class="badge${long}"><div class="nm">${esc(x.name)}</div><div class="un">${esc(x.unit)}</div></div>`;
    }).join('');
    html += `<div class="page"><div class="grid">${page}</div><div class="pno">A4 · 第 ${p / 8 + 1} 頁</div></div>`;
  }
  sheets.innerHTML = html;
}
document.querySelectorAll('[data-paste]').forEach((b) => b.addEventListener('click', () => { list.value = DATA[b.dataset.paste]; render(); }));
document.getElementById('clear').addEventListener('click', () => { list.value = ''; render(); });
list.addEventListener('input', render);
render();
