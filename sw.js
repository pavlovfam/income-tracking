/* Service worker: хранит копию приложения на телефоне, чтобы оно открывалось без интернета.
   Данные пользователя здесь не хранятся, они лежат в localStorage страницы. */
var CACHE = 'uchet-dohodov-v30';
var CORE = ['./', 'index.html', 'manifest.json', 'icon-192.png', 'icon-512.png', 'apple-touch-icon.png'];
var EXTRA = [
  'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js',
  'https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500&family=IBM+Plex+Sans:wght@400;500;600&display=swap'
];

self.addEventListener('install', function (e) {
  e.waitUntil(caches.open(CACHE).then(function (c) {
    return c.addAll(CORE).then(function () {
      return Promise.all(EXTRA.map(function (u) {
        return fetch(new Request(u, { mode: 'no-cors' })).then(function (r) { return c.put(u, r); }).catch(function () {});
      }));
    });
  }).then(function () { return self.skipWaiting(); }));
});

self.addEventListener('activate', function (e) {
  e.waitUntil(caches.keys().then(function (keys) {
    return Promise.all(keys.filter(function (k) { return k !== CACHE; }).map(function (k) { return caches.delete(k); }));
  }).then(function () { return self.clients.claim(); }));
});

function store(req, res) {
  if (res && (res.ok || res.type === 'opaque')) { var copy = res.clone(); caches.open(CACHE).then(function (c) { c.put(req, copy); }); }
  return res;
}

self.addEventListener('fetch', function (e) {
  var req = e.request;
  if (req.method !== 'GET') return;
  var same = new URL(req.url).origin === self.location.origin;
  if (same) {
    /* Свои файлы: сначала сеть (чтобы обновления приходили), при отсутствии связи или за 4 секунды берем копию. */
    e.respondWith(new Promise(function (resolve) {
      var done = false;
      function fromCache() { return caches.match(req).then(function (m) { return m || caches.match('index.html'); }); }
      var t = setTimeout(function () { if (!done) fromCache().then(function (m) { if (m && !done) { done = true; resolve(m); } }); }, 4000);
      fetch(req).then(function (r) { if (!done) { done = true; clearTimeout(t); resolve(store(req, r)); } else store(req, r); })
        .catch(function () { clearTimeout(t); if (!done) { done = true; fromCache().then(resolve); } });
    }));
  } else {
    /* Библиотека Excel и шрифты: сначала копия, иначе сеть. */
    e.respondWith(caches.match(req).then(function (m) { return m || fetch(req).then(function (r) { return store(req, r); }); }));
  }
});
