/* DealRadar NL service worker – versie 8cb0940c49
   Pagina en data: eerst online ophalen (nieuwste prijzen), offline uit de cache.
   Lettertypen en iconen: uit de cache, op de achtergrond bijwerken. */
const CACHE = 'dealradar-8cb0940c49';
const SHELL = ['./', './index.html', './manifest.webmanifest', './favicon.svg', './icon-192.png', './icon-512.png', './data/latest.json'];
self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
const fresh = (req, key) => fetch(req).then(r => { if (r.ok) { const copy = r.clone(); caches.open(CACHE).then(c => c.put(key || req, copy)); } return r; }).catch(() => caches.match(key || req));
self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (req.mode === 'navigate') { e.respondWith(fresh(req, './index.html')); return; }
  if (url.origin === location.origin && url.pathname.endsWith('/data/latest.json')) { e.respondWith(fresh(req)); return; }
  const fonts = /fonts\.(googleapis|gstatic)\.com$/.test(url.hostname);
  if (url.origin !== location.origin && !fonts) return; // API's: altijd live, nooit uit de cache
  e.respondWith(caches.match(req).then(hit => {
    const net = fetch(req).then(r => { if (r.ok || r.type === 'opaque') { const copy = r.clone(); caches.open(CACHE).then(c => c.put(req, copy)); } return r; }).catch(() => hit);
    return hit || net;
  }));
});
