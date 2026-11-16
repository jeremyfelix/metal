/* Runs before first paint (classic script, no module) so the saved theme is applied without a flash. */
(function () {
  try {
    var t = localStorage.getItem('metal-theme');
    if (t === 'light' || t === 'dark') document.documentElement.setAttribute('data-theme', t);
  } catch (e) { /* storage blocked: follow the system preference */ }
})();
