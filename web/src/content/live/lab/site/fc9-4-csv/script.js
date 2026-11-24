for (const n of [1, 2, 3]) document.getElementById('t' + n).addEventListener('click', () => {
  for (const k of [1, 2, 3]) { document.getElementById('p' + k).classList.toggle('hide', k !== n); document.getElementById('t' + k).classList.toggle('on', k === n) }
})
