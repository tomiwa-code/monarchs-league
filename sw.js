const CACHE_NAME = 'league-arena-v1';
const ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  // If you have external CSS/JS files, add them here.
  // For fonts and icons, we rely on the network (they are cached by the browser anyway).
];

// Install – cache core assets
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(ASSETS))
      .then(() => self.skipWaiting())
  );
});

// Activate – clean up old caches
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys => {
      return Promise.all(
        keys.filter(key => key !== CACHE_NAME)
          .map(key => caches.delete(key))
      );
    }).then(() => self.clients.claim())
  );
});

// Fetch – serve from cache, fallback to network
self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request)
      .then(cached => cached || fetch(event.request))
      .catch(() => {
        // Optionally return a fallback page
        if (event.request.mode === 'navigate') {
          return caches.match('/');
        }
      })
  );
});