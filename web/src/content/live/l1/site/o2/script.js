const btn = document.getElementById('menuBtn');
const nav = document.getElementById('nav');

btn.addEventListener('click', () => {
  const open = nav.classList.toggle('open');
  btn.setAttribute('aria-expanded', String(open));
});

nav.addEventListener('click', (e) => {
  if (e.target.tagName === 'A') {
    nav.classList.remove('open');
    btn.setAttribute('aria-expanded', 'false');
  }
});

// 送出前檢查:填錯時在欄位旁邊提醒
const form = document.getElementById('orderForm');
const $ = (id) => document.getElementById(id);
const IDS = ['item', 'qty', 'date', 'slot', 'name', 'phone'];
const today = form.dataset.today;

function show(id, msg) {
  form.querySelector(`.err[data-for="${id}"]`).textContent = msg;
  const el = $(id);
  if (el) el.classList.toggle('bad', !!msg);
}
const slotValue = () => (form.querySelector('input[name="slot"]:checked') || {}).value || '';
const phoneValue = () => $('phone').value.trim();

function check() {
  const errs = {};
  if (!$('item').value) errs.item = '請選擇品項';
  const q = $('qty').value.trim();
  if (!q) errs.qty = '請填數量';
  else if (!/^\d+$/.test(q) || Number(q) < 1) errs.qty = '數量要是 1 以上的整數';
  const d = $('date').value;
  if (!d) errs.date = '請選擇取貨日期';
  else if (d < today) errs.date = '取貨日期不能是過去的日期';
  if (!slotValue()) errs.slot = '請選擇取貨時段';
  if (!$('name').value.trim()) errs.name = '請填姓名';
  const p = phoneValue();
  if (!p) errs.phone = '請填手機';
  else if (!/^09\d{8}$/.test(p)) errs.phone = '手機要是 09 開頭的 10 碼數字';
  return errs;
}

// 改了某個欄位,就先拿掉它的紅字(下次送出再檢查)
form.addEventListener('change', (e) => show(e.target.name === 'slot' ? 'slot' : e.target.id, ''));

form.addEventListener('submit', (e) => {
  e.preventDefault();
  const errs = check();
  IDS.forEach((id) => show(id, errs[id] || ''));
  const ok = Object.keys(errs).length === 0;
  const result = $('result');
  result.textContent = ok ? '檢查通過，可以送出' : '有欄位要修正，請看紅字提醒';
  result.className = 'result ' + (ok ? 'ok' : 'ng');
});
