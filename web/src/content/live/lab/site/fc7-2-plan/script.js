var plan = document.querySelector('.plan');
document.getElementById('next').addEventListener('click', function () {
  var n = Math.min(4, Number(plan.getAttribute('data-step')) + 1);
  plan.setAttribute('data-step', String(n));
});
