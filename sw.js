const CACHE_NAME = 'learnapp-v3';
const APP_SHELL = [
  '/Learning-App/',
  '/Learning-App/index.html',
  '/Learning-App/src/app.js',
  '/Learning-App/src/styles.css',
  '/Learning-App/manifest.json',
  '/Learning-App/icons/icon-180.png'
];

self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE_NAME).then(c => c.addAll(APP_SHELL)));
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  if (url.pathname.includes('/data/')) {
    event.respondWith(
      fetch(event.request)
        .then(res => { const c = res.clone(); caches.open(CACHE_NAME).then(ca => ca.put(event.request, c)); return res; })
        .catch(() => caches.match(event.request))
    );
  } else {
    event.respondWith(caches.match(event.request).then(cached => cached || fetch(event.request)));
  }
});
