var btn = document.getElementById('hi');
var msg = document.getElementById('msg');
var count = 0;
btn.addEventListener('click', function () {
  count = count + 1;
  btn.classList.add('pressed');
  msg.classList.add('on');
  msg.textContent = '嗨！謝謝你來看我的頁面。已經有 ' + count + ' 個人跟我打招呼';
});

var dict = {
  'zh-TW': { name: '林小安', tagline: '喜歡烘焙的設計新手', aboutT: '關於我', about: '我在台中長大，白天做行政工作，晚上學做網站。最喜歡週末烤一盤司康，分給同事吃。', likesT: '我的興趣', l1: '烘焙', l1d: '司康、磅蛋糕', l2: '散步', l2d: '每天傍晚走 30 分鐘', l3: '做網站', l3d: '正在學 HTML 和 CSS', hi: '打個招呼', msg0: '按一下按鈕，跟我說嗨', foot: '© 2026 林小安', toggle: 'English' },
  en: { name: 'Lin Hsiao-an', tagline: 'A design beginner who loves baking', aboutT: 'About me', about: 'I grew up in Taichung. I work in an office by day and learn web design at night. On weekends I bake scones for my coworkers.', likesT: 'What I like', l1: 'Baking', l1d: 'Scones, pound cake', l2: 'Walking', l2d: '30 minutes every evening', l3: 'Making websites', l3d: 'Learning HTML and CSS', hi: 'Say hi', msg0: 'Press the button to say hi', foot: '© 2026 Lin Hsiao-an', toggle: '中文' }
};
var lang = 'zh-TW';
document.getElementById('lang').addEventListener('click', function () {
  lang = lang === 'zh-TW' ? 'en' : 'zh-TW';
  var t = dict[lang];
  document.querySelectorAll('[data-i18n]').forEach(function (el) { el.textContent = t[el.getAttribute('data-i18n')]; });
  document.getElementById('lang').textContent = t.toggle;
});
