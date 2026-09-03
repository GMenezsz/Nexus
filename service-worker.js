// service-worker.js
const CACHE_VERSION = 'v1.0.0';
const CACHE_NAME = `nexus-cache-${CACHE_VERSION}`;
const OFFLINE_URL = '/offline.html';

// Arquivos essenciais para cache
const PRECACHE_ASSETS = [
  '/',
  '/index.html',
  '/style.css',
  '/script.js',
  '/manifest.json',
  '/offline.html',
  '/icons/icon-72x72.png',
  '/icons/icon-96x96.png',
  '/icons/icon-128x128.png',
  '/icons/icon-144x144.png',
  '/icons/icon-152x152.png',
  '/icons/icon-192x192.png',
  '/icons/icon-384x384.png',
  '/icons/icon-512x512.png',
  '/icons/apple-touch-icon.png'
];

// URLs da API que devem ser cacheadas (apenas GETs)
const API_CACHE_URLS = [
  'https://nexus-api-mz3t.onrender.com/categorias'
];

// Evento de instalação - pré-cache dos assets essenciais
self.addEventListener('install', (event) => {
  console.log('[Service Worker] Instalando versão:', CACHE_VERSION);
  
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('[Service Worker] Pré-cacheando assets');
        return cache.addAll(PRECACHE_ASSETS);
      })
      .then(() => {
        console.log('[Service Worker] Instalação concluída');
        // Força a ativação imediata do SW
        return self.skipWaiting();
      })
      .catch((error) => {
        console.error('[Service Worker] Erro no pré-cache:', error);
      })
  );
});

// Evento de ativação - limpa caches antigos
self.addEventListener('activate', (event) => {
  console.log('[Service Worker] Ativando versão:', CACHE_VERSION);
  
  event.waitUntil(
    caches.keys()
      .then((cacheNames) => {
        return Promise.all(
          cacheNames.map((cacheName) => {
            if (cacheName !== CACHE_NAME && cacheName.startsWith('nexus-cache-')) {
              console.log('[Service Worker] Removendo cache antigo:', cacheName);
              return caches.delete(cacheName);
            }
            return null;
          })
        );
      })
      .then(() => {
        console.log('[Service Worker] Ativação concluída');
        // Toma controle imediato das páginas
        return self.clients.claim();
      })
  );
});

// Evento de fetch - estratégias de cache
self.addEventListener('fetch', (event) => {
  const request = event.request;
  const url = new URL(request.url);

  // Estratégia para requisições da API
  if (url.origin === 'https://nexus-api-mz3t.onrender.com') {
    // Para GETs da API, tenta cache-first com fallback network
    if (request.method === 'GET') {
      // Se for uma URL de categoria, usa cache-first
      if (url.pathname === '/categorias') {
        event.respondWith(
          caches.match(request)
            .then((cachedResponse) => {
              if (cachedResponse) {
                console.log('[SW] API GET (cache):', url.pathname);
                return cachedResponse;
              }
              return fetch(request)
                .then((response) => {
                  // Cache da resposta
                  return caches.open(CACHE_NAME)
                    .then((cache) => {
                      cache.put(request, response.clone());
                      return response;
                    });
                })
                .catch((error) => {
                  console.error('[SW] Erro na requisição API:', error);
                  return new Response(JSON.stringify({ error: 'Offline' }), {
                    status: 503,
                    headers: { 'Content-Type': 'application/json' }
                  });
                });
            })
        );
        return;
      }
    }

    // Para POST, PUT, DELETE - network-first sem cache
    if (request.method !== 'GET') {
      event.respondWith(
        fetch(request)
          .catch((error) => {
            console.error('[SW] Erro em operação não-GET:', error);
            return new Response(JSON.stringify({ 
              error: 'Você está offline. Conecte-se para realizar esta operação.' 
            }), {
              status: 503,
              headers: { 'Content-Type': 'application/json' }
            });
          })
      );
      return;
    }

    // Para outros GETs da API (resumo, listagens), tenta network-first
    event.respondWith(
      fetch(request)
        .then((response) => {
          // Cache da resposta em segundo plano
          caches.open(CACHE_NAME)
            .then((cache) => {
              cache.put(request, response.clone());
            });
          return response;
        })
        .catch(() => {
          return caches.match(request)
            .then((cachedResponse) => {
              if (cachedResponse) {
                return cachedResponse;
              }
              return new Response(JSON.stringify({ 
                error: 'Dados não disponíveis offline' 
              }), {
                status: 503,
                headers: { 'Content-Type': 'application/json' }
              });
            });
        })
    );
    return;
  }

  // Estratégia para assets estáticos - Cache-First
  if (request.method === 'GET') {
    // Verifica se é um asset do app
    const isAsset = PRECACHE_ASSETS.some(asset => request.url.includes(asset));
    
    event.respondWith(
      caches.match(request)
        .then((cachedResponse) => {
          if (cachedResponse) {
            // Retorna do cache e atualiza em background
            if (isAsset) {
              event.waitUntil(
                fetch(request)
                  .then((response) => {
                    return caches.open(CACHE_NAME)
                      .then((cache) => {
                        cache.put(request, response);
                      });
                  })
                  .catch(() => { /* Ignora falhas */ })
              );
            }
            return cachedResponse;
          }

          // Se não estiver em cache, busca na rede
          return fetch(request)
            .then((response) => {
              // Cache da resposta para próximas vezes
              if (response.ok) {
                const responseToCache = response.clone();
                caches.open(CACHE_NAME)
                  .then((cache) => {
                    cache.put(request, responseToCache);
                  });
              }
              return response;
            })
            .catch((error) => {
              console.error('[SW] Erro ao buscar recurso:', request.url, error);
              // Se for uma navegação, retorna a página offline
              if (request.headers.get('accept')?.includes('text/html')) {
                return caches.match(OFFLINE_URL) || new Response(
                  '<html><body><h1>Offline</h1><p>Conecte-se para acessar o Nexus</p></body></html>',
                  { headers: { 'Content-Type': 'text/html' } }
                );
              }
              return new Response('Recurso indisponível offline', { status: 503 });
            });
        })
    );
    return;
  }

  // Fallback para outros métodos (não GET)
  event.respondWith(
    fetch(request)
      .catch((error) => {
        console.error('[SW] Erro no fetch fallback:', error);
        return new Response('Erro de rede', { status: 503 });
      })
  );
});

// Evento de message - para comunicação com a página
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
  
  // Verificação de atualizações
  if (event.data && event.data.type === 'CHECK_UPDATE') {
    self.skipWaiting();
    // Notifica todos os clients sobre a atualização
    self.clients.matchAll()
      .then((clients) => {
        clients.forEach((client) => {
          client.postMessage({
            type: 'UPDATE_AVAILABLE',
            version: CACHE_VERSION
          });
        });
      });
  }
});

// Evento de push (notificações) - opcional
self.addEventListener('push', (event) => {
  const options = {
    body: event.data ? event.data.text() : 'Nova atualização disponível',
    icon: '/icons/icon-192x192.png',
    badge: '/icons/icon-72x72.png',
    vibrate: [100, 50, 100],
    data: {
      dateOfArrival: Date.now(),
      primaryKey: '1'
    },
    actions: [
      {
        action: 'open',
        title: 'Abrir Nexus'
      },
      {
        action: 'close',
        title: 'Fechar'
      }
    ]
  };

  event.waitUntil(
    self.registration.showNotification('Nexus', options)
  );
});

// Evento de click em notificação
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  if (event.action === 'open') {
    event.waitUntil(
      clients.matchAll({ type: 'window' })
        .then((clientList) => {
          // Se já houver uma janela aberta, foca nela
          for (const client of clientList) {
            if (client.url === '/' && 'focus' in client) {
              return client.focus();
            }
          }
          // Senão, abre uma nova
          if (clients.openWindow) {
            return clients.openWindow('/');
          }
        })
    );
  }
});

// Estratégia de auto-update - verifica novas versões periodicamente
self.addEventListener('periodicsync', (event) => {
  if (event.tag === 'update-check') {
    event.waitUntil(
      fetch('/manifest.json')
        .then((response) => response.json())
        .then((manifest) => {
          const newVersion = manifest.version || CACHE_VERSION;
          if (newVersion !== CACHE_VERSION) {
            self.skipWaiting();
            self.clients.matchAll().then((clients) => {
              clients.forEach((client) => {
                client.postMessage({
                  type: 'UPDATE_AVAILABLE',
                  version: newVersion
                });
              });
            });
          }
        })
        .catch(() => { /* Ignora */ })
    );
  }
});

// Log de inicialização
console.log('[Service Worker] Inicializado com cache:', CACHE_NAME);
console.log('[Service Worker] Versão:', CACHE_VERSION);
console.log('[Service Worker] Precache assets:', PRECACHE_ASSETS.length);
