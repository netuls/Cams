const CACHE_NAME = 'cams-gym-v2';
const ASSETS = [
  './',
  'index.html',
  'style.css',
  'scripts.js',
  'firebase-config.js',
  'https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@400;700&family=Jost:wght@300;400;600&display=swap'
];

// Instalação: Salva arquivos no Cache
self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS))
  );
});

// Ativação: Limpa caches antigos
self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(keys.map((key) => {
        if (key !== CACHE_NAME) return caches.delete(key);
      }));
    })
  );
});

// Busca: Serve do cache se estiver offline
self.addEventListener('fetch', (e) => {
  e.respondWith(
    caches.match(e.request).then((response) => {
      return response || fetch(e.request);
    })
  );
});
