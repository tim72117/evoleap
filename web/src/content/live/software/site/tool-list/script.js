const $ = (id) => document.getElementById(id);
const PHONE = /09[\d\s-]{8,12}/;

// 一行一則報名訊息:抓出姓名、電話、備註;同一支電話視為重複,合併成一筆
function parse(text) {
  const people = [];
  let dups = 0;
  for (const line of text.split('\n')) {
    const phone = (line.match(PHONE) || [''])[0].replace(/\D/g, '');
    const name = (line.replace(/\+1|我也要！?/g, '').match(/[一-鿿]{2,4}/) || [''])[0];
    if (!name) continue;
    const note = (line.split(PHONE)[1] || '').trim();
    const same = people.find((p) => p.phone && p.phone === phone);
    if (same) {
      same.merged = true;
      dups += 1;
      continue;
    }
    people.push({ name, phone, note, merged: false });
  }
  return { people, dups };
}

const fmt = (p) => (p.length === 10 ? `${p.slice(0, 4)}-${p.slice(4, 7)}-${p.slice(7)}` : p);

$('go').addEventListener('click', () => {
  const { people, dups } = parse($('raw').value);
  $('rows').innerHTML = people
    .map((p, i) => `<tr class="${p.merged ? 'merged' : ''}"><td>${i + 1}</td><td>${p.name}</td><td>${fmt(p.phone)}</td><td class="note">${p.note}${p.merged ? '（已合併重複）' : ''}</td></tr>`)
    .join('');
  $('count').textContent = String(people.length);
  $('dups').textContent = String(dups);
  $('out').hidden = false;
});
