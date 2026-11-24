const wrap = document.querySelector('.wrap')
document.getElementById('edit').addEventListener('click', () => wrap.setAttribute('data-s', '1'))
document.getElementById('check').addEventListener('click', () => wrap.setAttribute('data-s', '2'))
