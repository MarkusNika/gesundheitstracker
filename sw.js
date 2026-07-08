/* sw.js — einfaches App-Shell-Caching (Cache-first für statische Dateien).
 * Bei Änderungen am App-Shell CACHE-Version hochzählen, damit der SW aktualisiert.
 */
const CACHE = 'gt-shell-v10';
const ASSETS = [
  './',
  './index.html',
  './styles.css',
  './db.js',
  './import-core.js',
  './validation.js',
  './entries-core.js',
  './photo-core.js',
  './range-core.js',
  './bodyfat-core.js',
  './training-core.js',
  './app.js',
  './vendor/chart.umd.min.js',
  './manifest.webmanifest',
  './icon-192.png',
  './icon-512.png',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  e.respondWith(
    caches.match(e.request).then((hit) =>
      hit || fetch(e.request).then((res) => {
        const copy = res.clone();
        caches.open(CACHE).then((c) => { try { c.put(e.request, copy); } catch (_) {} });
        return res;
      }).catch(() => hit)
    )
  );
});
