// The start screen of index.html: the element `splash` shows the logo while the browser loads the app. The app removes
// the element when its first screen shows. See src/app/main.jsx.
//
// If the app cannot start, the start screen shows the reason and stays. Examples: a browser without JavaScript
// modules, or no network on the first open.
(() => {
  const fail = () => {
    const splash = document.getElementById('splash');
    // The app runs: its own screens show the errors.
    if (!splash) return;
    splash.classList.add('failed');
    document.getElementById('splash-text').textContent =
      'Trackula cannot start. It needs Chrome or Edge 111, Firefox 114, Safari 16.4 or a later version, and a ' +
      'network connection for the first open. Update the browser, then load the page again.';
  };
  if (!('noModule' in HTMLScriptElement.prototype)) {
    document.addEventListener('DOMContentLoaded', fail);
    return;
  }
  // A script that does not load, or an error at the start of the app.
  window.addEventListener('error', fail, true);
  window.addEventListener('unhandledrejection', fail);
})();
