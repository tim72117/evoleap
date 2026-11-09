for (const id of ['d1', 'd2']) document.getElementById(id).addEventListener('click', () => { for (const k of ['d1', 'd2']) document.getElementById(k).classList.toggle('on', k === id) })
