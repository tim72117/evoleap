var doc = document.querySelector('.doc');
document.getElementById('say-bad').addEventListener('click', function () { doc.setAttribute('data-bad', '1'); });
document.getElementById('say-good').addEventListener('click', function () { doc.setAttribute('data-good', '1'); });
document.getElementById('tab').addEventListener('click', function () {
  var k = Number(doc.getAttribute('data-k')) % 4 + 1;
  doc.setAttribute('data-k', String(k));
});
document.getElementById('switch').addEventListener('click', function () {
  doc.setAttribute('data-lang', doc.getAttribute('data-lang') === 'zh' ? 'en' : 'zh');
});
