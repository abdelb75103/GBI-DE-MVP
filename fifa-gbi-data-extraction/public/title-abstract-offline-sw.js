const CACHE_NAME = 'gbi-title-abstract-offline-v1';

self.addEventListener('install', (event) => {
  event.waitUntil(self.skipWaiting());
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  if (event.request.mode !== 'navigate' || !url.pathname.startsWith('/title-abstract-offline/')) {
    return;
  }

  event.respondWith((async () => {
    const cache = await caches.open(CACHE_NAME);
    const cached = await cache.match(event.request);
    if (cached) return cached;

    try {
      const response = await fetch(event.request);
      if (response.ok) {
        await cache.put(event.request, response.clone());
      }
      return response;
    } catch {
      const keys = await cache.keys();
      const fallback = keys
        .slice()
        .reverse()
        .find((request) => new URL(request.url).pathname.startsWith('/title-abstract-offline/'));
      if (fallback) {
        const fallbackResponse = await cache.match(fallback);
        if (fallbackResponse) return fallbackResponse;
      }
      return new Response('Offline title/abstract pack is not cached on this device yet.', {
        status: 503,
        headers: { 'Content-Type': 'text/plain; charset=utf-8' },
      });
    }
  })());
});
