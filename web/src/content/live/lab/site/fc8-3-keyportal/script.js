const $ = (id) => document.getElementById(id)
$('new').addEventListener('click', () => { $('form').classList.remove('hide'); $('empty').classList.add('hide') })
$('create').addEventListener('click', () => {
  $('kshow').textContent = $('kname').value || 'my-server'
  $('form').classList.add('hide'); $('made').classList.remove('hide'); $('new').classList.add('hide')
})
$('copy').addEventListener('click', () => $('copied').classList.remove('hide'))
