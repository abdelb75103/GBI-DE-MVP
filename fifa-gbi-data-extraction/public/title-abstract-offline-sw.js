const CACHE_NAME = 'gbi-title-abstract-offline-v2';

self.addEventListener('install', (event) => {
  event.waitUntil(self.skipWaiting());
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const names = await caches.keys();
    await Promise.all(
      names
        .filter((name) => name.startsWith('gbi-title-abstract-offline-') && name !== CACHE_NAME)
        .map((name) => caches.delete(name)),
    );
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  if (event.request.mode !== 'navigate' || !url.pathname.startsWith('/title-abstract-offline/')) {
    return;
  }

  event.respondWith((async () => {
    const cache = await caches.open(CACHE_NAME);
    try {
      const response = await fetch(event.request);
      if (response.ok) {
        await cache.put(event.request, response.clone());
      }
      return response;
    } catch {
      const cached = await cache.match(event.request);
      if (cached) return cached;

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
