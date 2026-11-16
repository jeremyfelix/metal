/* Classic (non-module) script: if the ES modules cannot run (e.g. index.html opened via file://,
   where browsers block module loading), replace the endless "Loading…" with a helpful message. */
(function () {
  function fail(msg) {
    var l = document.getElementById('loading'), e = document.getElementById('error');
    if (!e || !l || l.hidden) return;
    l.hidden = true; e.hidden = false;
    e.querySelector('.error-msg').textContent = msg;
    e.querySelector('.error-hint').textContent = 'Serve the folder over HTTP instead: run  python3 -m http.server  in the repository root and open http://localhost:8000/.';
  }
  if (location.protocol === 'file:') { fail('This page was opened from a file:// URL, so the browser blocks its scripts and data.'); return; }
  setTimeout(function () { fail('The page scripts did not start. Check your connection and the browser console.'); }, 10000);
})();
