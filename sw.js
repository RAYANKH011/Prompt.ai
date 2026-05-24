const CACHE = 'promptgen-v3';
const SHELL = [
  '/',
  '/index.html',
  '/manifest.json',
  '/icon-192.png',
  '/icon-512.png',
];

// ── INSTALL : mise en cache du shell ─────────────────────────────────────────
self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE).then(c => c.addAll(SHELL))
  );
  self.skipWaiting();
});

// ── ACTIVATE : nettoyage des anciens caches ───────────────────────────────────
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// ── FETCH : cache-first pour les assets, network-first pour l'API ─────────────
self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);

  // Requêtes API Anthropic → toujours réseau (pas de mise en cache)
  if (url.hostname === 'api.anthropic.com') return;

  // Polices Google Fonts → réseau puis cache
  if (url.hostname.includes('googleapis.com') || url.hostname.includes('gstatic.com')) {
    e.respondWith(
      caches.open(CACHE + '-fonts').then(c =>
        c.match(e.request).then(cached => {
          if (cached) return cached;
          return fetch(e.request).then(res => { c.put(e.request, res.clone()); return res; });
        })
      )
    );
    return;
  }

  // CDN unpkg (React, Babel) → cache-first
  if (url.hostname === 'unpkg.com') {
    e.respondWith(
      caches.open(CACHE + '-cdn').then(c =>
        c.match(e.request).then(cached => {
          if (cached) return cached;
          return fetch(e.request).then(res => { c.put(e.request, res.clone()); return res; });
        })
      )
    );
    return;
  }

  // App shell → cache-first, fallback index.html
  e.respondWith(
    caches.match(e.request).then(cached =>
      cached || fetch(e.request).catch(() => caches.match('/index.html'))
    )
  );
});
