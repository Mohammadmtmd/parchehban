var CACHE_NAME = 'parchehban-v8';

self.addEventListener('install', function(event) {
  self.skipWaiting();
});

self.addEventListener('activate', function(event) {
  event.waitUntil(
    caches.keys().then(function(names) {
      return Promise.all(
        names.filter(function(name) { return name !== CACHE_NAME; })
             .map(function(name) { return caches.delete(name); })
      );
    })
  );
  self.clients.claim();
});

self.addEventListener('fetch', function(event) {
  /* فقط فونت و آیکون را کش کن، فایل اصلی همیشه از سرور بیاد */
  if (event.request.url.indexOf('fonts.googleapis.com') > -1 ||
      event.request.url.indexOf('cdn.jsdelivr.net') > -1) {
    event.respondWith(
      caches.match(event.request).then(function(cached) {
        return cached || fetch(event.request).then(function(response) {
          var clone = response.clone();
          caches.open(CACHE_NAME).then(function(cache) {
            cache.put(event.request, clone);
          });
          return response;
        });
      })
    );
  }
  /* فایل اصلی HTML — همیشه از سرور */
});
