// 設計變數面板:換主色、切換深色模式、顯示對比;改的是 .app 上的變數,整站跟著變
const app = document.getElementById('app');
const BRAND = { blue: '#2b6cb0', green: '#2f855a', orange: '#c05621' };
const LIGHT = { text: '#22303c', muted: '#5b6672', danger: '#c53030', bg: '#ffffff', ratio: '5.9 : 1 夠清楚' };
const DARK = { text: '#e6edf3', muted: '#9aa7b4', danger: '#fc8181', bg: '#121a24', ratio: '6.3 : 1 夠清楚' };
const ctl = document.querySelectorAll('[data-brand].ctl');
const dark = document.getElementById('dark');
const contrast = document.getElementById('contrast');
function show() {
  const t = app.classList.contains('dark') ? DARK : LIGHT;
  document.getElementById('v-brand').textContent = BRAND[app.dataset.brand];
  document.getElementById('v-text').textContent = t.text;
  document.getElementById('v-muted').textContent = t.muted;
  document.getElementById('v-danger').textContent = t.danger;
  document.getElementById('v-bg').textContent = t.bg;
  document.getElementById('ratio1').textContent = '對比 ' + t.ratio;
  ctl.forEach((b) => b.classList.toggle('on', b.dataset.brand === app.dataset.brand));
  dark.classList.toggle('on', app.classList.contains('dark'));
  contrast.classList.toggle('on', app.classList.contains('check'));
}
ctl.forEach((b) => b.addEventListener('click', () => { app.dataset.brand = b.dataset.brand; show(); }));
dark.addEventListener('click', () => { app.classList.toggle('dark'); show(); });
contrast.addEventListener('click', () => { app.classList.toggle('check'); show(); });
show();
