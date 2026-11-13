// 點官方網站那一筆:標成選到了(示範畫面不換頁,下一步由腳本換到官方網站)
document.querySelector('#official').addEventListener('click', (e) => e.currentTarget.classList.add('picked'))
