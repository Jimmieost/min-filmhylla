/* Bump VERSION whenever any app-shell file changes. Never delete IndexedDB. */
const VERSION = '1.0.0';
const SHELL = `min-filmhylla-shell-${VERSION}`;
const POSTERS = 'min-filmhylla-posters-v1';
const base = self.registration.scope;
const url = path => new URL(path, base).href;
const FILES = [ './', 'index.html', 'css/styles.css', 'js/app.js', 'js/router.js', 'js/components.js', 'js/db.js', 'js/model.js', 'js/movies.js', 'js/tmdb.js', 'js/stats.js', 'js/backup.js', 'js/settings.js', 'js/pwa.js', 'manifest.webmanifest', 'assets/icons/sprite.svg', 'assets/icons/icon.svg', 'assets/icons/icon-192.png', 'assets/icons/icon-512.png', 'assets/icons/icon-maskable-512.png', 'assets/icons/apple-touch-icon.png', 'assets/icons/tmdb.svg', 'assets/icons/poster-placeholder.svg' ];
const shellURLs = new Set(FILES.map(url));
self.addEventListener('install', event => { event.waitUntil(caches.open(SHELL).then(cache => cache.addAll(FILES.map(url)))); });
// Updates wait until explicitly requested. No automatic reload of a review form.
self.addEventListener('message', event => { if (event.data?.type === 'SKIP_WAITING') self.skipWaiting(); });
self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(key => key.startsWith('min-filmhylla-shell-') && key !== SHELL).map(key => caches.delete(key)));
    await self.clients.claim();
  })());
});
let posterQueue = Promise.resolve();
async function cachePoster(request, response) {
  // Serialize pruning so simultaneous poster loads cannot exceed the cache limit.
  posterQueue = posterQueue.catch(() => {}).then(async () => {
    const cache = await caches.open(POSTERS);
    await cache.put(request, response);
    const keys = await cache.keys();
    for (const key of keys.slice(0, Math.max(0, keys.length - 80))) await cache.delete(key);
  });
  return posterQueue;
}
self.addEventListener('fetch', event => {
  const request = event.request;
  const parsed = new URL(request.url);
  // Authenticated API requests are never intercepted or cached.
  if (request.method !== 'GET' || request.headers.has('Authorization') || parsed.hostname === 'api.themoviedb.org') return;
  if (request.mode === 'navigate' && request.url.startsWith(base)) {
    event.respondWith(caches.open(SHELL).then(async cache => (await cache.match(url('index.html'))) || fetch(request)));
    return;
  }
  if (shellURLs.has(request.url)) {
    event.respondWith(caches.open(SHELL).then(async cache => (await cache.match(request)) || fetch(request)));
    return;
  }
  if (parsed.origin === 'https://image.tmdb.org' && parsed.pathname.startsWith('/t/p/')) {
    event.respondWith((async () => {
      const cache = await caches.open(POSTERS); const cached = await cache.match(request);
      if (cached) return cached;
      try {
        const response = await fetch(request);
        if (!response.ok && response.type !== 'opaque') throw new Error('Affischen saknas');
        event.waitUntil(cachePoster(request, response.clone()).catch(() => {}));
        return response;
      } catch { return (await caches.open(SHELL)).match(url('assets/icons/poster-placeholder.svg')); }
    })());
  }
});
