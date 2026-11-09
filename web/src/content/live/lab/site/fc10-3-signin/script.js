const $ = (id) => document.getElementById(id)
$('google').addEventListener('click', () => { $('box').classList.add('hide'); $('pick').classList.remove('hide') })
$('acc').addEventListener('click', () => { $('pick').classList.add('hide'); $('in').classList.remove('hide'); $('who').textContent = '小安' })
