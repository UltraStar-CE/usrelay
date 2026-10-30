// Network only: never cache room credentials, catalogs, media or old frontend assets.
// No skipWaiting/clients.claim: activating an update must not interrupt a session.
self.addEventListener('fetch', event => {
  event.respondWith(fetch(event.request));
});
