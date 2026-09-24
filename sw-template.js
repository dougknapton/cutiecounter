/* Service worker for the Tasks app. Built into dist/sw.js by vite.config.ts. */
const VERSION = __VERSION__;
const CACHE = `tasks-${VERSION}`;
const PRECACHE = __PRECACHE__;

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.addAll(PRECACHE))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith('tasks-') && k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  // Only the app shell is handled here. Calls to Apps Script (another origin)
  // go straight to the network so the app's own queue can see failures.
  if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) return;

  if (req.mode === 'navigate') {
    event.respondWith(caches.match('./', { cacheName: CACHE }).then((hit) => hit || fetch(req)));
    return;
  }
  event.respondWith(caches.match(req, { cacheName: CACHE }).then((hit) => hit || fetch(req)));
});
