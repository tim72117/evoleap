document.getElementById('reveal').addEventListener('click', function () {
  document.getElementById('svg').classList.add('shown');
  this.classList.add('on');
  document.getElementById('cap').textContent = '其實是聖誕節：大家本來就會看更多甜點影片、訂更多蛋糕。';
});
document.getElementById('show-gap').addEventListener('click', function () {
  document.getElementById('src').classList.add('gap');
  this.classList.add('on');
});
