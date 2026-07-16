const CACHE_NAME = 'desktop-schedule-pwa-v13';
const APP_SHELL = [
  './',
  './index.html',
  './styles.css',
  './app.js',
  './config.js',
  './sync.js',
  './manifest.json',
  './icons/icon.svg',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-maskable-512.png',
  './icons/apple-touch-icon.png',
  './icons/favicon-64.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => Promise.all(
        // 逐一快取，單一檔案 fetch 失敗（例如缺圖示）不會讓整個 SW 安裝失敗。
        APP_SHELL.map((url) => cache.add(url).catch((err) => {
          console.warn('[service-worker] 快取失敗，略過：', url, err);
        }))
      ))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  // 【重要】只攔截「自己網站」的檔案請求（HTML/JS/CSS/圖示等 app shell）。
  // 跨網域請求（尤其 Supabase API 的 GET，例如 cloudPull 讀 sync_state）一律
  // 直接走網路、絕對不要快取：曾經因為這裡把 API 回應也 cache-first，
  // 導致每台裝置永遠讀到第一次快取的舊雲端資料，同步判斷全面失準，
  // 裝置間互相用舊資料覆蓋。API 的即時性比離線可用重要。
  const requestUrl = new URL(event.request.url);
  if (requestUrl.origin !== self.location.origin) return;

  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) return cached;

      return fetch(event.request)
        .then((response) => {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
          return response;
        })
        .catch(() => caches.match('./index.html'));
    })
  );
});
