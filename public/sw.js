const CACHE_NAME = 'petpanic-v2';
const SHELL_ASSETS = ['/', '/manifest.json', '/icons/icon.svg'];

// Install
self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then(c => c.addAll(SHELL_ASSETS)));
  self.skipWaiting();
});

// Activate
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))))
  );
  self.clients.claim();
});

// Fetch: network-first for navigation, cache-first for assets
self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;
  if (!request.url.startsWith(self.location.origin)) return;

  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then(response => { const c = response.clone(); caches.open(CACHE_NAME).then(cache => cache.put(request, c)); return response; })
        .catch(() => caches.match('/'))
    );
    return;
  }

  if (request.url.match(/\.(js|css|png|jpg|svg|woff2?)$/)) {
    event.respondWith(
      caches.match(request).then(cached => {
        if (cached) return cached;
        return fetch(request).then(response => { const c = response.clone(); caches.open(CACHE_NAME).then(cache => cache.put(request, c)); return response; });
      })
    );
    return;
  }
});

// Web Push
self.addEventListener('push', (event) => {
  const data = event.data?.json() ?? {};
  const title = data.title || 'PetPanic';
  const options = {
    body: data.body || 'Nueva alerta de mascota perdida',
    icon: '/icons/icon.svg',
    badge: '/icons/icon.svg',
    tag: `alert-${data.alertId || 'unknown'}`,
    renotify: true,
    requireInteraction: true,
    vibrate: [200, 100, 200, 100, 200],
    data: { url: data.alertId ? `/alerts/${data.alertId}` : '/' },
    actions: [
      { action: 'view', title: 'Ver Alerta' },
      { action: 'dismiss', title: 'Cerrar' }
    ]
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

// Notification click
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  if (event.action === 'dismiss') return;
  const url = event.notification.data?.url || '/';
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(wins => {
      for (const w of wins) {
        if (w.url.includes(self.location.origin)) { w.navigate(url); return w.focus(); }
      }
      return clients.openWindow(url);
    })
  );
});
