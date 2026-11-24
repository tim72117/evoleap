var lead = document.getElementById('lead');
var drawerA = document.getElementById('drawerA');
var brA = document.getElementById('brA');
var brB = document.getElementById('brB');
var pc2 = document.getElementById('pc2');
var file = document.getElementById('file');
var ops = ['op-clear', 'op-switch', 'op-pc', 'op-backup'];
function reset(id) {
  for (var i = 0; i < ops.length; i++) document.getElementById(ops[i]).classList.toggle('on', ops[i] === id);
  drawerA.classList.remove('wiped'); brA.classList.remove('lit'); brB.classList.remove('lit'); pc2.classList.remove('lit');
  lead.className = 'lead';
}
document.getElementById('op-clear').addEventListener('click', function () { reset('op-clear'); drawerA.classList.add('wiped'); brA.classList.add('lit'); lead.textContent = '清除瀏覽資料（Cookie 與網站資料）：抽屜一起被清空'; lead.className = 'lead warn'; });
document.getElementById('op-switch').addEventListener('click', function () { reset('op-switch'); brB.classList.add('lit'); lead.textContent = '換瀏覽器：B 有自己的抽屜，裡面是空的'; lead.className = 'lead warn'; });
document.getElementById('op-pc').addEventListener('click', function () { reset('op-pc'); pc2.classList.add('lit'); lead.textContent = '換電腦：清單不會跟過去'; lead.className = 'lead warn'; });
document.getElementById('op-backup').addEventListener('click', function () { reset('op-backup'); file.classList.remove('gone'); lead.textContent = '備份檔是一般的檔案：可以帶到別的瀏覽器、別台電腦匯入'; lead.className = 'lead good'; });
