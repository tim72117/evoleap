var small = false;
function $(id) { return document.getElementById(id); }
$('send').addEventListener('click', function () {
  $('alert').classList.toggle('gone', small);
  $('sent').classList.toggle('gone', !small);
});
$('use-small').addEventListener('click', function () {
  small = true;
  $('att-big').classList.add('gone'); $('sum-big').classList.add('gone');
  $('att-small').classList.remove('gone'); $('sum-small').classList.remove('gone');
  $('alert').classList.add('gone');
});
