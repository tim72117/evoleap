const WORDS = [
  ['apple', '蘋果 🍎'],
  ['rabbit', '兔子 🐰'],
  ['umbrella', '雨傘 ☂️'],
  ['library', '圖書館 📚'],
  ['rainbow', '彩虹 🌈'],
];
const $ = (id) => document.getElementById(id);
let i = 0;
let ok = 0;
const dots = [...$('dots').children];

function show() {
  $('card').classList.remove('flip');
  $('word').textContent = WORDS[i][0];
  $('mean').textContent = WORDS[i][1];
  $('no').textContent = String(i + 1);
  dots.forEach((d, k) => d.classList.toggle('on', k === i));
}

$('card').addEventListener('click', () => $('card').classList.toggle('flip'));
$('know').addEventListener('click', () => {
  ok += 1;
  $('ok').textContent = String(ok);
  dots[i].classList.add('done');
  i = (i + 1) % WORDS.length;
  show();
});
$('again').addEventListener('click', () => {
  i = (i + 1) % WORDS.length;
  show();
});
