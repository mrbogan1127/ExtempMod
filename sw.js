// Change the version whenever publishing changes to any app asset.
const PREFIX = 'extemp-prep-' + new URL(self.registration.scope).pathname + '-';
const CACHE = PREFIX + '2026-10-rounds-4';
const ASSETS = ['./index.html', './styles.css', './rounds.js', './room-tools.js', './script.js', './device.js', './manifest.webmanifest', './icons/icon-192.png', './icons/icon-512.png'];
self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(ASSETS.map(path => new Request(new URL(path, self.registration.scope), {cache: 'reload'})))));
  // Updates wait for existing app windows to close; never interrupt an active round.
});
self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(key => key.startsWith(PREFIX) && key !== CACHE).map(key => caches.delete(key)));
    await self.clients.claim();
  })());
});
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  if (event.request.method !== 'GET' || !url.href.startsWith(self.registration.scope)) return;
  const index = new URL('./index.html', self.registration.scope).href;
  const scope = new URL(self.registration.scope).href;
  if (event.request.mode === 'navigate' && (url.pathname === new URL(index).pathname || url.pathname === new URL(scope).pathname)) {
    event.respondWith(caches.open(CACHE).then(async cache => (await cache.match(index)) || fetch(event.request)));
    return;
  }
  event.respondWith(caches.open(CACHE).then(async cache => (await cache.match(event.request)) || fetch(event.request)));
});
