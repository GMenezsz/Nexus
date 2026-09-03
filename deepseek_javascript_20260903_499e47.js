const CACHE_NAME = 'nexus-cache-v1';
const API_CACHE = 'nexus-api-cache-v1';

const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/style.css',
  '/script.js',
  '/manifest.json',
  '/icons/icon-72x72.png',
  '/icons/icon-96x96.png',
  '/icons/icon-128x128.png',
  '/icons/icon-144x144.png',
  '/icons/icon-152x152.png',
  '/icons/icon-192x192.png',
  '/icons/icon-384x384.png',
  '/icons/icon-512x512.png',
  'https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js'
];

// Instalação do Service Worker
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('Cache aberto');
        return cache.addAll(STATIC_ASSETS);
      })
      .then(() => self.skipWaiting())
  );
});

// Ativação do Service Worker
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((cacheNames) => {
        return Promise.all(
          cacheNames.map((cacheName) => {
            if (cacheName !== CACHE_NAME && cacheName !== API_CACHE) {
              console.log('Removendo cache antigo:', cacheName);
              return caches.delete(cacheName);
            }
          })
        );
      })
      .then(() => self.clients.claim())
  );
});

// Interceptação de requisições
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);
  
  // Estratégia para API
  if (url.origin === 'https://nexus-api-mz3t.onrender.com') {
    // Network-first com fallback para cache
    event.respondWith(
      fetch(request)
        .then((response) => {
          // Cachear resposta da API
          const responseClone = response.clone();
          caches.open(API_CACHE)
            .then((cache) => {
              if (request.method === 'GET') {
                cache.put(request, responseClone);
              }
            });
          return response;
        })
        .catch(() => {
          // Fallback para cache
          return caches.match(request)
            .then((cachedResponse) => {
              return cachedResponse || new Response(JSON.stringify({
                error: 'Offline',
                message: 'Você está offline'
              }), {
                status: 503,
                headers: { 'Content-Type': 'application/json' }
              });
            });
        })
    );
    return;
  }
  
  // Estratégia para assets estáticos
  if (STATIC_ASSETS.includes(url.pathname) || url.origin === 'https://cdn.jsdelivr.net') {
    // Cache-first com revalidação em background
    event.respondWith(
      caches.match(request)
        .then((cachedResponse) => {
          if (cachedResponse) {
            // Revalidar em background
            fetch(request)
              .then((response) => {
                if (response.ok) {
                  caches.open(CACHE_NAME)
                    .then((cache) => cache.put(request, response));
                }
              })
              .catch(() => {});
            
            return cachedResponse;
          }
          
          return fetch(request)
            .then((response) => {
              const responseClone = response.clone();
              caches.open(CACHE_NAME)
                .then((cache) => cache.put(request, responseClone));
              return response;
            });
        })
    );
    return;
  }
  
  // Padrão: network-first
  event.respondWith(
    fetch(request)
      .catch(() => {
        return caches.match(request);
      })
  );
});

// Auto-update
self.addEventListener('message', (event) => {
  if (event.data === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

// Verificar atualizações periodicamente
setInterval(() => {
  self.registration.update();
}, 60 * 60 * 1000); // Verificar a cada hora