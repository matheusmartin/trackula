// Registers the service worker (sw.js). Not on localhost: there, jaspr serve gives many development files, and the
// cache must not keep them. Test the worker with the build on 127.0.0.1. See README.md.
if ('serviceWorker' in navigator && location.hostname !== 'localhost') {
  navigator.serviceWorker.register('sw.js');
}
