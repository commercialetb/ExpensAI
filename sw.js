const CACHE_NAME = 'expensai-spark-v1';
const ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './assets/template.xlsx',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './js/firebase.js',
  './js/state.js',
  './js/auth.js',
  './js/firestore.js',
  './js/ai.js',
  './js/pdf.js',
  './js/excel.js',
  './js/ui.js',
  './js/app.js'
];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(ASSETS)));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then(keys => Promise.all(keys.map(k => (k!==CACHE_NAME) ? caches.delete(k) : null)))
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  event.respondWith(
    caches.match(req).then(cached => {
      const fetchPromise = fetch(req).then(res => {
        // Update cache in background
        const copy = res.clone();
        caches.open(CACHE_NAME).then(cache => cache.put(req, copy)).catch(()=>{});
        return res;
      }).catch(()=>cached);
      return cached || fetchPromise;
    })
  );
});
