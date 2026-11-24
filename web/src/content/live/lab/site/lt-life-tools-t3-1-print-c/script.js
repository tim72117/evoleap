const app = document.getElementById('app');
const V = app.dataset.v;
const PEOPLE = [['陳怡君', '行銷部'], ['林家豪', '業務部'], ['王佩珊', '人資部'], ['張志明', '研發部'], ['李欣怡', '財務部'], ['黃俊傑', '業務部'], ['吳雅雯', '行銷部'], ['劉建宏', '研發部'], ['蔡淑芬', '總務部'], ['楊宗翰', '研發部'], ['許雅筑', '客服部'], ['鄭文彬', '財務部']];
const badge = (p) => `<div class="badge"><div class="nm">${p[0]}</div><div class="un">${p[1]}</div></div>`;
const preview = document.getElementById('preview');
if (V === 'a') {
  // 修改前:整個網頁照印,輸入區、按鈕都在紙上,名牌被切到下一頁
  preview.innerHTML =
    `<div class="paper"><div class="whole"><div class="wh">名牌列印工具</div><div class="wta">陳怡君, 行銷部<br>林家豪, 業務部<br>王佩珊, 人資部<br>張志明, 研發部<br>…</div><div class="wbtn">清空</div><div class="wc">共 12 張</div></div><div class="grid g-a">${PEOPLE.slice(0, 6).map(badge).join('')}</div><div class="cutline" data-x="cut">名牌被切成兩半</div><div class="pno">1 / 3</div></div>` +
    `<div class="paper"><div class="half">（上一頁名牌的下半截）</div><div class="grid g-top">${PEOPLE.slice(6, 12).map(badge).join('')}</div><div class="pno">2 / 3</div></div>`;
  document.getElementById('pages').textContent = '共 3 頁';
} else {
  preview.innerHTML = [PEOPLE.slice(0, 8), PEOPLE.slice(8)].map((ps, i) => `<div class="paper"><div class="grid">${ps.map(badge).join('')}</div><div class="pno">${i + 1} / 2</div></div>`).join('');
}
const dest = document.getElementById('dest');
const goBtn = document.getElementById('go');
dest.addEventListener('click', () => { dest.textContent = '另存為 PDF'; dest.classList.add('pdf'); goBtn.textContent = '儲存'; });
goBtn.addEventListener('click', () => { if (goBtn.textContent === '儲存') app.classList.add('saved'); });
