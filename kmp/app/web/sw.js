// Service worker: the app opens also without a network connection. See "Install the app" in README.md.
//
// Network first: each request goes to the network, and the cache keeps the last good copy of the file. Without a
// network, the cache gives that copy. So a new deploy shows at the next open, and an old copy shows only offline.
// Only the files of the app go through the cache. Google sign-in, the Picker, the Sheets API and the fallback fonts of
// Compose go to the network directly: offline, the app shows their errors.
//
// This file is a template. The Gradle task wasmJsBrowserDistribution writes it to the output with the values of
// BUILD and APP_FILES. See kmp/app/build.gradle.kts.

// One cache for each build. When a new build activates, the worker deletes the caches of the old builds, also the
// cache `trackula` of the Dart app. It keeps the other caches, for example the resource cache of Compose.
const BUILD = '/* build */';
const CACHE = `trackula-${BUILD}`;

// The files that the app needs to open: './' and the files of the build. The worker gets them when it installs, so the
// first offline open works. The names of the .wasm files change with each build.
const APP_FILES = ['./', /* app-files */];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(APP_FILES)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  const deleteOld = caches.keys()
    .then((keys) => keys.filter((key) => key.startsWith('trackula') && key !== CACHE))
    .then((old) => Promise.all(old.map((key) => caches.delete(key))));
  event.waitUntil(deleteOld.then(() => self.clients.claim()));
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET' || new URL(request.url).origin !== self.location.origin) return;
  event.respondWith(networkFirst(request));
});

// The response of the network. It also goes to the cache. Without a network, the copy in the cache.
async function networkFirst(request) {
  const cache = await caches.open(CACHE);
  try {
    const response = await fetch(request);
    if (response.ok) await cache.put(request, response.clone());
    return response;
  } catch (error) {
    // A page URL has a query, for example `?demo`. All pages are the same file: `./`.
    const copy = request.mode === 'navigate'
      ? await cache.match('./')
      : await cache.match(request, { ignoreSearch: true });
    if (copy) return copy;
    throw error;
  }
}
