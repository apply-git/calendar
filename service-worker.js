const CACHE_NAME = 'desktop-schedule-pwa-v16';

// 把「經過重新導向」的回應重新包成乾淨的 200 回應再存快取。
// 原因：Cloudflare Pages 會把 /index.html 重導向到 /，導致快取到的回應帶有
// redirected 旗標；Chrome 對「頁面導航」拒收這種來自 Service Worker 的回應
// （直接顯示 ERR_FAILED），安裝版 PWA 一打開就掛。重新包一層即可去掉旗標。
async function sanitizeResponse(response) {
  if (!response || !response.redirected) return response;
  const body = await response.blob();
  return new Response(body, {
    status: response.status,
    statusText: response.statusText,
    headers: response.headers,
  });
}
const APP_SHELL = [
  './',
  './index.html',
  './styles.css',
  './app.js',
  './config.js',
  './sync.js',
  './push.js',
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
        // 不用 cache.add()：要先 sanitizeResponse() 去掉 redirected 旗標再存。
        APP_SHELL.map((url) => fetch(url)
          .then((res) => {
            if (!res.ok) throw new Error('HTTP ' + res.status);
            return sanitizeResponse(res);
          })
          .then((clean) => cache.put(url, clean))
          .catch((err) => {
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
        .then(async (response) => {
          // 重新導向過的回應要先包乾淨再快取＋回傳（頁面導航拒收 redirected 回應）。
          const clean = await sanitizeResponse(response.clone());
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clean.clone())).catch(() => {});
          return response.redirected ? clean : response;
        })
        .catch(() => caches.match('./index.html').then((fallback) => fallback || caches.match('./')));
    })
  );
});

// ============================================================================
// 背景推播提醒（Web Push，進階選用功能，見 push.js 與 CLOUD_PUSH_SETUP.md）
// ----------------------------------------------------------------------------
// 只有使用者在「☁️ 雲端同步」對話框內主動開啟「背景推播提醒」並訂閱成功後，
// 瀏覽器才會真的送 push 事件進來；沒有訂閱、或 config.js 的 webPushPublicKey
// 是空值（整個功能停用）時，這兩個監聽器永遠不會被觸發，對其他功能零影響。
// ============================================================================

self.addEventListener('push', (event) => {
  // 預設文字：伺服器傳來的資料解析失敗（不是合法 JSON、或缺欄位）時的保底顯示，
  // 確保就算 payload 格式有誤也還是會跳出一則通知，而不是整個事件靜默失敗。
  let data = { title: '行程提醒', body: '', url: './' };
  try {
    if (event.data) {
      const parsed = event.data.json();
      data = {
        title: parsed.title || data.title,
        body: parsed.body || data.body,
        url: parsed.url || data.url,
      };
    }
  } catch (err) {
    console.warn('[service-worker] push 事件資料解析失敗，改用預設文字', err);
  }

  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: './icons/icon-192.png',
      badge: './icons/icon-192.png',
      data: { url: data.url },
    })
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const targetUrl = (event.notification.data && event.notification.data.url) || './';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      // 已經有開啟的視窗就直接切過去，不用另外開新分頁。
      for (const client of windowClients) {
        if ('focus' in client) return client.focus();
      }
      if (clients.openWindow) return clients.openWindow(targetUrl);
    })
  );
});
