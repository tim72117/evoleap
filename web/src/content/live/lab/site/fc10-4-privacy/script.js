for (let i = 1; i <= 6; i++) document.getElementById('q' + i).addEventListener('click', () => {
  for (let k = 1; k <= 6; k++) {
    const q = document.getElementById('q' + k)
    if (q.classList.contains('on')) q.classList.add('seen')
    q.classList.toggle('on', k === i)
    document.getElementById('s' + k).classList.toggle('on', k === i)
  }
})
