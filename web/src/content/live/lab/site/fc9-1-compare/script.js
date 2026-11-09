for (const o of document.querySelectorAll('.opt')) o.addEventListener('click', () => {
  for (const x of document.querySelectorAll('.opt')) { if (x.classList.contains('on')) x.classList.add('seen'); x.classList.remove('on') }
  o.classList.add('on')
})
