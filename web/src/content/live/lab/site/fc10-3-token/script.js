const $ = (id) => document.getElementById(id)
for (const id of ['bh', 'bp', 'bs']) $(id).addEventListener('click', () => { $(id).classList.add('open'); if (id === 'bs') $('ck').classList.remove('hide') })
