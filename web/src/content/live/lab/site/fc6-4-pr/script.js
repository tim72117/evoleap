var host = document.querySelector('.host');
document.getElementById('tab-talk').addEventListener('click', function () { host.setAttribute('data-tab', 'talk'); });
document.getElementById('tab-files').addEventListener('click', function () { host.setAttribute('data-tab', 'files'); });
document.getElementById('tab-tags').addEventListener('click', function () { host.setAttribute('data-tab', 'tags'); });
document.getElementById('tab-code').addEventListener('click', function () { host.setAttribute('data-tab', 'talk'); });
document.getElementById('merge').addEventListener('click', function () { host.setAttribute('data-state', 'merged'); host.setAttribute('data-tab', 'talk'); });
