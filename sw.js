// Cronoscatto: tiene in cache l'app per usarla anche senza rete.
// Le pagine si scaricano prima dalla rete (così gli aggiornamenti arrivano subito)
// e, se la rete manca o è lenta, dalla cache. Font e librerie: prima dalla cache.
const CACHE = 'cronoscatto-v2';
const PAGES = ['./', './index.html', './analisi.html'];
const NO_CACHE = /(^|\.)tile\.openstreetmap\.org$|openseamap\.org$|arcgisonline\.com$/;

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE)
      .then(c => Promise.all(PAGES.map(p => c.add(p).catch(() => {}))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

function networkFirst(req) {
  return caches.open(CACHE).then(cache => {
    const net = fetch(req).then(res => {
      if (res && res.ok) cache.put(req, res.clone());
      return res;
    });
    const timeout = new Promise(r => setTimeout(r, 3500));
    return Promise.race([net.catch(() => null), timeout]).then(async res => {
      if (res) return res;
      const hit = await cache.match(req, { ignoreSearch: true });
      return hit || net;
    });
  });
}

function cacheFirst(req) {
  return caches.open(CACHE).then(async cache => {
    const hit = await cache.match(req);
    const net = fetch(req)
      .then(res => {
        if (res && (res.ok || res.type === 'opaque')) cache.put(req, res.clone());
        return res;
      })
      .catch(() => hit);
    return hit || net;
  });
}

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (NO_CACHE.test(url.hostname)) return;
  if (req.mode === 'navigate' || (url.origin === self.location.origin && /\.html?$|\/$/.test(url.pathname))) {
    e.respondWith(networkFirst(req));
  } else {
    e.respondWith(cacheFirst(req));
  }
});
