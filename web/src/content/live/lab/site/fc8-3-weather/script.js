const $ = (id) => document.getElementById(id)
$('down').addEventListener('click', () => { $('ok').classList.add('hide'); $('fb').classList.remove('hide') })
$('up').addEventListener('click', () => { $('fb').classList.add('hide'); $('ok').classList.remove('hide') })
