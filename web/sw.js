// Service worker: the app opens also without a network connection. See "Install the app" in README.md.
//
// Network first: each request goes to the network, and the cache keeps the last good copy of the file. Without a
// network, the cache gives that copy. So a new deploy shows at the next open, and an old copy shows only offline.
// Only the files of the app and of BeerCSS go through the cache. Google sign-in, the Picker and the Sheets API go
// to the network directly: offline, the app shows their errors.

const CACHE = 'trackula';

// BeerCSS: the same pinned version as web/index.html.
const BEERCSS = 'https://cdn.jsdelivr.net/npm/beercss@5.0.3/dist/cdn/';

// The files that the app needs to open. The worker gets them when it installs, so the first offline open works.
const APP_FILES = [
  './',
  'main.client.dart.js',
  'main.css',
  'theme.css',
  'images/logo.svg',
  'favicon.ico',
  'manifest.webmanifest',
  `${BEERCSS}beer.min.css`,
  `${BEERCSS}beer.min.js`,
  `${BEERCSS}material-symbols-outlined.woff2`,
];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(APP_FILES)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()));

self.addEventListener('fetch', (event) => {
  const request = event.request;
  const url = new URL(request.url);
  const isAppFile = url.origin === self.location.origin || url.href.startsWith(BEERCSS);
  if (request.method !== 'GET' || !isAppFile) return;
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
