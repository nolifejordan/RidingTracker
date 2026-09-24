// Bumping CACHE_NAME forces a refresh of all cached files on next load.
const CACHE_NAME = 'riding-tracker-v2';

// The app shell now includes the three fetched data files, not just the
// HTML -- these are what make the app usable offline after first load.
const APP_SHELL = [
  './index.html',
  './manifest.json',
  './federal.geojson',
  './provincial.geojson',
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

  // App shell (including the data files): cache-first, so the app and its
  // boundary/riding data are available offline after the first successful load.
  if (APP_SHELL.some((path) => url.endsWith(path.replace('./', '')))) {
    event.respondWith(
      caches.match(event.request).then((cached) => cached || fetch(event.request))
    );
    return;
  }

  // Map tiles (Esri Streets/Satellite): cache-first with network fallback,
  // so previously-viewed areas keep working offline.
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
