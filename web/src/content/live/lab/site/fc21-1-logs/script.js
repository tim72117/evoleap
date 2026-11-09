var q = document.getElementById('qtext');
var rows = document.querySelectorAll('.r');
var state = { err: false, path: false };
function apply() {
  var n = 0;
  rows.forEach(function (r) {
    var hide = (state.err && !r.classList.contains('err')) || (state.path && !r.classList.contains('co'));
    r.classList.toggle('gone', hide);
    if (!hide) n++;
  });
  var t = 'resource.type="cloud_run_revision"';
  if (state.err) t += '\nAND severity>=ERROR';
  if (state.path) t += '\nAND httpRequest.requestUrl:"/api/checkout"';
  q.innerHTML = t.replace(/\n/g, '<br>');
  document.getElementById('count').textContent = '顯示 ' + n + ' 筆';
  document.getElementById('f-all').classList.toggle('on', !state.err && !state.path);
  document.getElementById('f-error').classList.toggle('on', state.err);
  document.getElementById('f-path').classList.toggle('on', state.path);
}
document.getElementById('f-error').addEventListener('click', function () { state.err = !state.err; apply(); });
document.getElementById('f-path').addEventListener('click', function () { state.path = !state.path; apply(); });
