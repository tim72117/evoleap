const wrap = document.querySelector('.wrap')
document.getElementById('compare').addEventListener('click', () => wrap.setAttribute('data-s', '1'))
document.getElementById('update').addEventListener('click', () => wrap.setAttribute('data-s', '2'))
