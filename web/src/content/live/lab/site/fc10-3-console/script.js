const $ = (id) => document.getElementById(id)
$('new').addEventListener('click', () => { $('list').classList.add('hide'); $('form').classList.remove('hide') })
$('create').addEventListener('click', () => {
  $('orShow').textContent = [$('origin').value, $('origin2').value].filter(Boolean).join('、')
  $('form').classList.add('hide'); $('done').classList.remove('hide')
})
