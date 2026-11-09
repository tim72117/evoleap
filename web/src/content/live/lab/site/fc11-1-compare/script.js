for (let i = 1; i <= 6; i++) document.getElementById('r' + i).addEventListener('click', () => {
  for (let k = 1; k <= 6; k++) document.getElementById('r' + k).classList.toggle('on', k === i)
  if (i === 4) document.getElementById('mor').classList.remove('hide')
})
