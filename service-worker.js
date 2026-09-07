// Bumping CACHE_NAME forces a refresh of all cached files on next load.
const CACHE_NAME = 'riding-tracker-v1';

// Everything the app needs to run is either this shell (data is baked in
// as JS, not fetched separately) or the map tiles, which come from
// OpenStreetMap and are cached opportunistically as they're requested.
const APP_SHELL = [
  './index.html',
  './manifest.json'
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

  // App shell: cache-first, so the app itself opens instantly offline.
  if (APP_SHELL.some((path) => url.endsWith(path.replace('./', '')))) {
    event.respondWith(
      caches.match(event.request).then((cached) => cached || fetch(event.request))
    );
    return;
  }

  // Map tiles (OpenStreetMap): cache-first with network fallback, so
  // previously-viewed areas keep working offline; new areas still need a
  // connection the first time they're viewed.
  if (url.includes('tile.openstreetmap.org')) {
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

  // Everything else (Leaflet/Turf CDN scripts): network-first, cache as
  // a fallback for offline use once loaded at least once.
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
