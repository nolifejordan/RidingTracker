// Bumping CACHE_NAME forces a refresh of all cached files on next load.
const CACHE_NAME = 'riding-tracker-v4';

const APP_SHELL = [
  './index.html',
  './manifest.json',
  './federal.geojson',
  './provincial.geojson',
  './us-house.geojson',
  './us-states.geojson',
  './riding-data.json'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const url = event.request.url;

  // App shell + data files: stale-while-revalidate. Serve the cached copy
  // instantly (works offline), but refresh it in the background so the NEXT
  // load picks up any redeployed changes. (Plain cache-first would keep
  // serving an old index.html forever unless this file itself changed.)
  if (APP_SHELL.some((path) => url.endsWith(path.replace('./', '')))) {
    event.respondWith(
      caches.open(CACHE_NAME).then((cache) =>
        cache.match(event.request).then((cached) => {
          const network = fetch(event.request).then((response) => {
            if (response && response.ok) cache.put(event.request, response.clone());
            return response;
          }).catch(() => cached);
          return cached || network;
        })
      )
    );
    return;
  }

  if (url.includes('arcgisonline.com')) {
    event.respondWith(
      caches.open(CACHE_NAME).then((cache) =>
        cache.match(event.request).then((cached) => {
          if (cached) return cached;
          return fetch(event.request).then((response) => {
            cache.put(event.request, response.clone());
            return response;
          }).catch(() => cached);
        })
      )
    );
    return;
  }

  event.respondWith(
    fetch(event.request)
      .then((response) => {
        const copy = response.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
        return response;
      })
      .catch(() => caches.match(event.request))
  );
});
