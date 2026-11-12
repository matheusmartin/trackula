// The start screen of index.html: the element `splash` shows the logo while the browser loads the app. The app removes
// the element when its first screen shows. See main() in Main.kt.
//
// If the app cannot start, the start screen shows the reason and stays. Examples: a browser without WebAssembly GC,
// or no network on the first open.
(() => {
  const fail = () => {
    const splash = document.getElementById('splash');
    // The app runs: its own screens show the errors.
    if (!splash) return;
    splash.classList.add('failed');
    document.getElementById('splash-text').textContent =
      'Trackula cannot start. It needs Chrome or Edge 119, Firefox 120, Safari 18.2 or a later version, and a ' +
      'network connection for the first open. Update the browser, then load the page again.';
  };
  if (typeof WebAssembly !== 'object') {
    document.addEventListener('DOMContentLoaded', fail);
    return;
  }
  // A script that does not load, an error at the start of the app, or WebAssembly code that the browser cannot use.
  window.addEventListener('error', fail, true);
  window.addEventListener('unhandledrejection', fail);
})();
