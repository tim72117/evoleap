const $ = (id) => document.getElementById(id)
for (let i = 1; i <= 4; i++) $('n' + i).addEventListener('click', () => {
  $('f' + i).classList.add('hide'); $('f' + (i + 1)).classList.remove('hide')
  if (i < 4) { $('k' + i).className = 'did'; $('k' + (i + 1)).className = 'on' } else $('k4').className = 'did'
})
