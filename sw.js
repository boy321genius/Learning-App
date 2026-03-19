const CACHE_NAME = 'learnapp-v1';
const APP_SHELL = [
  '/learning-app/',
  '/learning-app/index.html',
  '/learning-app/src/app.js',
  '/learning-app/src/styles.css',
  '/learning-app/manifest.json',
  '/learning-app/icons/icon-180.png',
];


// Install: cache the app shell
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(APP_SHELL))
  );
  self.skipWaiting();
});

// Activate: clear old caches
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// Fetch: cache-first for shell, network-first for topic JSON
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  if (url.pathname.includes('/data/')) {
    // Network-first for ALL data files (topics.json index + per-topic files)
    event.respondWith(
      fetch(event.request)
        .then(res => {
          const clone = res.clone();
          caches.open(CACHE_NAME).then(c => c.put(event.request, clone));
          return res;
        })
        .catch(() => caches.match(event.request))
    );
  } else {
    // Cache-first for app shell (JS, CSS, HTML, icons)
    event.respondWith(
      caches.match(event.request).then(cached => cached || fetch(event.request))
    );
  }
});


