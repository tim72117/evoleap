var b = document.getElementById('scrub');
b.addEventListener('click', function () {
  b.classList.add('on');
  b.textContent = '✓ 已遮蔽個資';
  document.querySelector('.pg').classList.add('masked');
  document.querySelectorAll('.pii').forEach(function (el) {
    var t = el.textContent;
    if (t.indexOf('email=') === 0) el.textContent = 'email=[已移除]';
    else if (t.indexOf('@') > 0) el.textContent = '[已移除]';
    else if (t.indexOf('電話') === 0) el.textContent = '[表單內容不收集]';
    else el.textContent = '203.0.113.0（只留前三段）';
  });
});
