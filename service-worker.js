// Service Worker simplificado - sem cache para evitar problemas
self.addEventListener('install', (event) => {
    event.waitUntil(self.skipWaiting());
});

self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then(keys => Promise.all(keys.map(key => caches.delete(key))))
        .then(() => self.clients.claim())
    );
});

self.addEventListener('fetch', (event) => {
    // Não faz cache - apenas passa a requisição
    event.respondWith(fetch(event.request));
});
