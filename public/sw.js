// Keeps the app shell so it opens with no connection. Network first, so a new deploy
// is picked up whenever the student is online; the cache is only the fallback.
// Questions live in IndexedDB, and College Board requests are never cached here.
const CACHE = 'sat-shell-v1';

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', e => e.waitUntil(self.clients.claim()));

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) return;
  e.respondWith(fetch(req).then(res => {
    if (res.ok) { const copy = res.clone(); caches.open(CACHE).then(c => c.put(req, copy)); }
    return res;
  }).catch(() => caches.match(req, { ignoreSearch: true })
    .then(hit => hit || (req.mode === 'navigate' ? caches.match('./') : undefined))
    .then(hit => hit || Response.error())));
});
