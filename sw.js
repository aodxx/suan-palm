/* Service worker — ให้แอปเปิดได้แม้ไม่มีสัญญาณ (กลางสวน)
   - ไฟล์ของแอปเอง: ลองเครือข่ายก่อน (ได้ของใหม่เสมอ) ถ้าไม่มีสัญญาณใช้ของที่แคชไว้
   - ไลบรารีจาก CDN (เวอร์ชันล็อกในที่อยู่แล้ว): ใช้แคชก่อน
   - ภาพแผนที่/บริการที่อยู่: ไม่แคช ปล่อยผ่านเครือข่ายตามปกติ */
const VERSION = 'suan-palm-v1';
const APP_SHELL = [
  './', 'index.html', 'css/style.css', 'js/calculator.js', 'js/app.js', 'js/exporter.js', 'js/pwa.js',
  'site.webmanifest', 'assets/fonts/Sarabun-Regular.ttf', 'assets/fonts/Sarabun-Bold.ttf',
  'assets/icons/favicon.ico', 'assets/icons/png/palm-gps-icon-32.png'
];
const CDN_LIBS = [
  'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css',
  'https://unpkg.com/leaflet-draw@1.0.4/dist/leaflet.draw.css',
  'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js',
  'https://unpkg.com/leaflet-draw@1.0.4/dist/leaflet.draw.js',
  'https://cdn.jsdelivr.net/npm/@turf/turf@6.5.0/turf.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js'
];
const CDN_HOSTS = ['unpkg.com', 'cdn.jsdelivr.net', 'cdnjs.cloudflare.com'];

self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const cache = await caches.open(VERSION);
    await cache.addAll(APP_SHELL);
    // ไลบรารีภายนอกโหลดไม่ได้ก็ไม่ให้การติดตั้งล้ม (จะแคชตอนใช้งานจริงแทน)
    await Promise.allSettled(CDN_LIBS.map(url => cache.add(new Request(url, { mode: 'no-cors' }))));
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(key => key !== VERSION).map(key => caches.delete(key)));
    await self.clients.claim();
  })());
});

async function networkFirst(request) {
  const cache = await caches.open(VERSION);
  try {
    const response = await fetch(request);
    if (response && response.ok) cache.put(request, response.clone());
    return response;
  } catch (error) {
    const cached = await cache.match(request, { ignoreSearch: true });
    if (cached) return cached;
    if (request.mode === 'navigate') {
      const shell = await cache.match('index.html');
      if (shell) return shell;
    }
    throw error;
  }
}

async function cacheFirst(request) {
  const cache = await caches.open(VERSION);
  const cached = await cache.match(request);
  if (cached) return cached;
  const response = await fetch(request);
  if (response && (response.ok || response.type === 'opaque')) cache.put(request, response.clone());
  return response;
}

self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin === self.location.origin) {
    event.respondWith(networkFirst(request));
  } else if (CDN_HOSTS.includes(url.hostname)) {
    event.respondWith(cacheFirst(request));
  }
});
