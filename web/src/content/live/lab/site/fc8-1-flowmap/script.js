for (const m of document.querySelectorAll('.m')) m.addEventListener('click', () => { for (const x of document.querySelectorAll('.m')) x.classList.toggle('on', x === m) })
