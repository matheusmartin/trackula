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

// The worker asks the server for each file and does not use the HTTP cache of the browser. GitHub Pages lets the
// browser keep a file for 10 minutes, and trackula.js has the same name in each build. Without this, the worker can
// keep an old trackula.js that asks for .wasm files of an old build.
self.addEventListener('install', (event) => {
  const requests = APP_FILES.map((file) => new Request(file, { cache: 'no-cache' }));
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(requests)).then(() => self.skipWaiting()));
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
  let response;
  try {
    // A navigation request cannot get other options, so the worker asks for its URL.
    response = request.mode === 'navigate'
      ? await fetch(request.url, { cache: 'no-cache' })
      : await fetch(request, { cache: 'no-cache' });
  } catch (error) {
    // A page URL has a query, for example `?demo`. All pages are the same file: `./`.
    const copy = request.mode === 'navigate'
      ? await cache.match('./')
      : await cache.match(request, { ignoreSearch: true });
    if (copy) return copy;
    throw error;
  }
  // If the cache cannot keep the file, for example because the storage is full, the page still gets the response.
  if (response.ok) await cache.put(request, response.clone()).catch(() => {});
  return response;
}
