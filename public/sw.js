// Keeps the app shell so it opens with no connection, from the first visit on.
// The page registers this with its own build name in the URL, so every deploy installs
// a fresh copy, which replaces the cache instead of adding to it.
// Questions live in IndexedDB; College Board requests never pass through here.
const CACHE = 'sat-shell';

async function precache() {
  const res = await fetch('./', { cache: 'reload' });
  if (!res.ok) throw new Error('shell ' + res.status);
  const html = await res.clone().text();
  const assets = [...html.matchAll(/(?:src|href)="(\.?\/?assets\/[^"]+)"/g)].map(m => m[1]);
  await caches.delete(CACHE);
  const c = await caches.open(CACHE);
  await c.put('./', res);
  await c.addAll(assets);
}

self.addEventListener('install', e => e.waitUntil(precache().then(() => self.skipWaiting())));
self.addEventListener('activate', e => e.waitUntil(self.clients.claim()));

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) return;
  // network first, so an online student always gets the latest deploy
  e.respondWith(fetch(req).catch(() => caches.match(req.mode === 'navigate' ? './' : req, { ignoreSearch: true, ignoreVary: true })
    .then(hit => hit || Response.error())));
});
