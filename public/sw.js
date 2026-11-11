const CACHE_PREFIX = 'lakshay-library-pwa-';
const CACHE_NAME = `${CACHE_PREFIX}v2`;
const APP_SHELL_CACHE = CACHE_NAME;

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(APP_SHELL_CACHE);
    const response = await fetch('/', { cache: 'reload' });
    if (!response.ok) throw new Error(`App shell fetch failed: ${response.status}`);
    const html = await response.clone().text();
    await cache.put('/', response);
    await cache.put('/index.html', new Response(html, {
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    }));

    // Vite emits hashed JS/CSS assets. Precache those exact build outputs so the
    // installed PWA can boot offline after a successful online installation.
    const assetUrls = new Set();
    for (const match of html.matchAll(/(?:src|href)=["']([^"']+\.(?:js|css)(?:\?[^"']*)?)["']/g)) {
      const url = new URL(match[1], self.location.origin);
      if (url.origin === self.location.origin) assetUrls.add(url.href);
    }
    for (const assetUrl of assetUrls) {
      const assetResponse = await fetch(assetUrl, { cache: 'reload' });
      if (!assetResponse.ok) throw new Error(`App asset precache failed: ${assetUrl}`);
      await cache.put(assetUrl, assetResponse);
    }

    for (const path of ['/manifest.json', '/icon.svg', '/app-icon.png', '/apple-touch-icon.png']) {
      try {
        const assetResponse = await fetch(path, { cache: 'reload' });
        if (assetResponse.ok) await cache.put(path, assetResponse);
      } catch {
        // Optional icons must not prevent the application shell from installing.
      }
    }
  })());
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter((key) => key.startsWith(CACHE_PREFIX) && key !== CACHE_NAME)
      .map((key) => caches.delete(key)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // Never cache dynamic API/auth traffic. Only the same-origin application
  // shell and static build assets are eligible for offline caching.
  if (url.pathname.startsWith('/api/') || url.pathname.includes('/__/auth/')) return;

  if (request.mode === 'navigate') {
    event.respondWith((async () => {
      try {
        const networkResponse = await fetch(request);
        if (networkResponse.ok) {
          const cache = await caches.open(APP_SHELL_CACHE);
          await cache.put('/', networkResponse.clone());
        }
        return networkResponse;
      } catch {
        const cached = await caches.match('/');
        return cached || caches.match('/index.html') || Response.error();
      }
    })());
    return;
  }

  event.respondWith((async () => {
    const cached = await caches.match(request);
    if (cached) return cached;
    try {
      const response = await fetch(request);
      if (response.ok && (url.pathname.startsWith('/assets/') ||
          /\.(?:js|css|svg|png|webp|woff2?)$/i.test(url.pathname))) {
        const cache = await caches.open(APP_SHELL_CACHE);
        await cache.put(request, response.clone());
      }
      return response;
    } catch {
      return Response.error();
    }
  })());
});
