const wrap = document.querySelector('.wrap')
for (const n of [1, 2, 3]) {
  const b = document.getElementById('s' + n)
  b.addEventListener('click', () => {
    wrap.setAttribute('data-s', String(n))
    for (const m of [1, 2, 3]) document.getElementById('s' + m).classList.toggle('on', m === n)
  })
}
