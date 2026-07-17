// ponytail: 全量 precache、cache-first、ignoreSearch —— 照 yazelin PWA 離線守則
const CACHE = 'lcm-v85';
const ASSETS = ['./', 'index.html', 'style.css', 'app.js', 'ai.js', 'vendor/html2canvas.min.js', 'verify.html', 'manifest.webmanifest', 'icons/icon-192.png', 'icons/icon-512.png'];
self.addEventListener('install', (e) => { e.waitUntil(caches.open(CACHE).then((c) => c.addAll(ASSETS)).then(() => self.skipWaiting())); });
self.addEventListener('activate', (e) => { e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  // 頁面導航 network-first:改版一次重整就生效;離線時退回「該頁」快取,找不到才退主頁
  // (原本成功時一律 put 進 'index.html' 鍵、失敗時一律回主頁:開過 verify.html 會把主頁快取蓋成驗證頁)
  if (e.request.mode === 'navigate') {
    e.respondWith(fetch(e.request).then((res) => { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(e.request, copy)); return res; }).catch(() => caches.match(e.request, { ignoreSearch: true }).then((hit) => hit || caches.match('index.html'))));
    return;
  }
  e.respondWith(caches.match(e.request, { ignoreSearch: true }).then((hit) => hit || fetch(e.request).then((res) => { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(e.request, copy)); return res; })));
});
