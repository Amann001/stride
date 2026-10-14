// Stride web app service worker: makes the installed app open fast and keep working on a weak
// signal, without ever showing an old version when you're online.
//
// - Pages: always the network first, so updates appear straight away; the last saved copy is
//   used only when there's no connection.
// - App code with a fingerprint in its name (/app/_expo/static/...) never changes, so a saved
//   copy is used immediately.
// - Other app files (icons, fonts, the map worker): the saved copy, refreshed in the background.
// - Everything else is left alone: your data (the Stride server), map tiles and other sites
//   always come straight from the network.
//
// BUILD_ID is filled in when the web app is built, so each new version gets a fresh cache
// and the old one is deleted.
const CACHE = 'stride-app-__BUILD_ID__';
const SHELL = '/app';

const save = (request, response) => {
  if (response && response.ok) {
    const copy = response.clone();
    caches.open(CACHE).then((cache) => cache.put(request, copy));
  }
  return response;
};

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.add(SHELL))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith('stride-app-') && k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin || !url.pathname.startsWith('/app')) return;

  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => save(SHELL, response))
        .catch(() => caches.match(SHELL)),
    );
    return;
  }

  if (url.pathname.startsWith('/app/_expo/static/')) {
    event.respondWith(caches.match(request).then((hit) => hit || fetch(request).then((response) => save(request, response))));
    return;
  }

  event.respondWith(
    caches.match(request).then((hit) => {
      const fresh = fetch(request)
        .then((response) => save(request, response))
        .catch(() => hit);
      return hit || fresh;
    }),
  );
});
