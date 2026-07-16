'use strict';

// ============================================================================
// push.js — 背景推播提醒 scaffold（Web Push，進階選用功能）
// ----------------------------------------------------------------------------
// 目標：頁面/App 關著也能收到行程提醒（實際發送由 Supabase Edge Function
// `send-reminders` 定期呼叫，見 supabase/functions/send-reminders/index.ts）。
//
// 停用狀態（預設）：
//   config.js 沒填 webPushPublicKey 時，本檔案最上面就直接 return，
//   不插入任何 UI、不註冊任何事件、不打任何網路請求，
//   App 行為與加入這個功能之前完全一樣（比照 sync.js 的停用模式）。
//
// 依賴（都是「選用」，缺了只會讓這個功能本身用不了，不影響其他功能）：
//   - sync.js 需先載入，且其 window.CalendarSync 上要有 getAuthState()
//     （取得目前登入的 access token / user id，不做 token 刷新）。
//   - service-worker.js 要有 push / notificationclick 事件（已加）。
//   - Supabase 專案要先執行 schema-push.sql 建好 push_subscriptions 表，
//     否則訂閱寫入雲端會失敗（會跳 toast 提示，但不影響本機行程功能）。
//
// 完整設定教學見 CLOUD_PUSH_SETUP.md。
// ============================================================================

(function () {
  const rawConfig = (typeof window.CALENDAR_SYNC_CONFIG === 'object' && window.CALENDAR_SYNC_CONFIG) || {};
  const PUBLIC_KEY = String(rawConfig.webPushPublicKey || '').trim();
  if (!PUBLIC_KEY) return; // 未設定 = 背景推播整個停用：零 UI、零事件、零網路請求。

  const SUPABASE_URL = String(rawConfig.supabaseUrl || '').trim().replace(/\/+$/, '');
  const SUPABASE_ANON_KEY = String(rawConfig.supabaseAnonKey || '').trim();
  const CLOUD_READY = Boolean(SUPABASE_URL && SUPABASE_ANON_KEY); // 訂閱需要寫入 Supabase，缺這兩個就無法運作

  // iOS Safari 16.4+ 才支援 Web Push，且需先加入主畫面；file:// 協定完全不會註冊 Service Worker。
  const PUSH_SUPPORTED = 'serviceWorker' in navigator && 'PushManager' in window && location.protocol !== 'file:';

  const els = {};

  init();

  function init() {
    const box = document.getElementById('cloudSyncLoggedInBox');
    if (!box) return; // index.html 沒有這組雲端同步 UI 時，整段安全跳過

    insertUI(box);
    refreshUI();

    // #cloudSyncLoggedInBox 的 hidden 屬性由 sync.js 依登入狀態切換（登入/登出/初始化時都會呼叫
    // 它自己的 updateUI()）。用 MutationObserver 跟著同一顆元素的變化來刷新推播區塊狀態，
    // 這樣完全不需要修改 sync.js 既有的任何函式。
    try {
      const observer = new MutationObserver(() => refreshUI());
      observer.observe(box, { attributes: true, attributeFilter: ['hidden'] });
    } catch (err) {
      // 理論上不會發生（MutationObserver 支援度很高），就算不支援也只是狀態不會即時刷新，
      // 不影響其他功能；下面的「開啟雲端同步」按鈕點擊仍會刷新一次。
    }

    // 使用者重新打開「☁️ 雲端同步」對話框時，順便重新確認一次目前的訂閱／登入狀態。
    document.getElementById('cloudSyncBtn')?.addEventListener('click', refreshUI);
  }

  function insertUI(box) {
    // 用分隔線＋小標題跟上面既有的「自動同步／立即同步／登出…」按鈕群拉開視覺區隔，
    // checkbox＋狀態小字排版沿用既有 .checkbox-field／.muted。測試通知區塊
    // （#pushTestRow）預設 hidden，只有實際訂閱成功後才顯示，靠 CSS 的
    // `:not([hidden])` 寫法避免 .push-test-row 的 display:flex 蓋掉 hidden 屬性。
    const wrap = document.createElement('div');
    wrap.className = 'push-block';
    wrap.innerHTML =
      '<h3 class="push-heading">🔔 背景提醒</h3>' +
      '<div class="field checkbox-field push-field">' +
      '<label><input id="pushEnableToggle" type="checkbox" /> 📲 背景推播提醒（App 關閉也會通知）</label>' +
      '<p id="pushStatusText" class="muted"></p>' +
      '</div>' +
      '<div id="pushTestRow" class="push-test-row" hidden>' +
      '<button type="button" id="pushTestBtn" class="ghost-btn">🔔 發送測試通知</button>' +
      '<p class="muted push-test-hint">雲端排程推播需完成 <code>CLOUD_PUSH_SETUP.md</code> 部署後才會運作。</p>' +
      '</div>';
    box.appendChild(wrap);

    els.toggle = wrap.querySelector('#pushEnableToggle');
    els.status = wrap.querySelector('#pushStatusText');
    els.testRow = wrap.querySelector('#pushTestRow');
    els.testBtn = wrap.querySelector('#pushTestBtn');
    els.toggle.addEventListener('change', onToggleChange);
    els.testBtn.addEventListener('click', onTestNotificationClick);
  }

  function setStatus(text) {
    if (els.status) els.status.textContent = text;
  }

  function showTestRow(show) {
    if (els.testRow) els.testRow.hidden = !show;
  }

  // iOS Safari 16.4+ 才支援 Web Push，但一定要先「加入主畫面」（standalone 模式）才會生效；
  // 一般分頁模式下 PushManager 直接不存在。navigator.standalone 只有 iOS Safari 才有這個屬性，
  // 其他瀏覽器一律是 undefined（=== false 恆不成立），不會誤判。
  function isIOSNeedsHomeScreen() {
    return navigator.standalone === false && /iPhone|iPad/.test(navigator.userAgent);
  }

  function isLoggedIn() {
    return Boolean(window.CalendarSync && typeof window.CalendarSync.isLoggedIn === 'function' && window.CalendarSync.isLoggedIn());
  }

  function getAuth() {
    if (!window.CalendarSync || typeof window.CalendarSync.getAuthState !== 'function') return null;
    const state = window.CalendarSync.getAuthState();
    if (!state || !state.accessToken || !state.user || !state.user.id) return null;
    return state;
  }

  // 依「瀏覽器支援度 → 登入狀態 → 雲端同步是否設定完成 → 目前實際訂閱狀態」四層判斷，
  // 每次都重算一次，不快取，避免登入/登出後畫面顯示跟實際狀態不一致。
  async function refreshUI() {
    if (!els.toggle) return;

    if (!PUSH_SUPPORTED) {
      els.toggle.checked = false;
      els.toggle.disabled = true;
      setStatus(isIOSNeedsHomeScreen() ? 'iPhone 需先把本頁加入主畫面（iOS 16.4+）才能使用背景提醒' : '此瀏覽器不支援背景推播');
      showTestRow(false);
      return;
    }

    if (!isLoggedIn()) {
      els.toggle.checked = false;
      els.toggle.disabled = true;
      setStatus('請先登入雲端同步');
      showTestRow(false);
      return;
    }

    if (!CLOUD_READY) {
      els.toggle.checked = false;
      els.toggle.disabled = true;
      setStatus('雲端同步尚未設定完成，無法使用背景推播');
      showTestRow(false);
      return;
    }

    // 使用者曾經按過「封鎖」：checkbox 直接鎖住，不讓他再勾一次徒勞觸發 requestPermission()
    // （瀏覽器不會再跳出權限詢問，只會靜默維持 denied），改用狀態文字導引去瀏覽器設定處理。
    if (Notification.permission === 'denied') {
      els.toggle.checked = false;
      els.toggle.disabled = true;
      setStatus('通知權限已被封鎖，請到瀏覽器網站設定重新允許');
      showTestRow(false);
      return;
    }

    els.toggle.disabled = false;
    try {
      const registration = await navigator.serviceWorker.ready;
      const sub = await registration.pushManager.getSubscription();
      const subscribed = Boolean(sub);
      els.toggle.checked = subscribed;
      setStatus(subscribed ? '背景推播提醒已開啟' : '背景推播提醒尚未開啟');
      showTestRow(subscribed);
    } catch (err) {
      console.warn('[push] 讀取訂閱狀態失敗', err);
      setStatus('無法讀取目前的訂閱狀態');
      showTestRow(false);
    }
  }

  async function onToggleChange() {
    const wantOn = els.toggle.checked;
    els.toggle.disabled = true;
    showTestRow(false);
    setStatus(wantOn ? '訂閱中…' : '取消訂閱中…');
    try {
      if (wantOn) {
        await subscribe();
      } else {
        await unsubscribe();
      }
    } catch (err) {
      console.warn('[push] 設定背景推播失敗', err);
      toast('背景推播設定失敗：' + (err?.message || String(err)));
    } finally {
      await refreshUI();
    }
  }

  // 「發送測試通知」只驗證「瀏覽器端顯示路徑」（Service Worker 能不能叫出系統通知），
  // 完全不經過雲端／VAPID／Supabase，按鈕旁小字也有註明。訂閱過程中權限被瀏覽器
  // 記成「已封鎖」的話（例如訂閱後使用者自己去瀏覽器設定關掉），這裡也要攔下來，
  // 不能悶不吭聲地失敗。
  async function onTestNotificationClick() {
    if (Notification.permission === 'denied') {
      toast('通知權限已被封鎖，請到瀏覽器設定重新允許通知');
      return;
    }
    try {
      const registration = await navigator.serviceWorker.ready;
      await registration.showNotification('測試通知', {
        body: '看得到這則就代表通知顯示正常（這是本機測試，不經過雲端）',
        icon: './icons/icon-192.png',
      });
    } catch (err) {
      console.warn('[push] 測試通知顯示失敗', err);
      toast('測試通知顯示失敗：' + (err?.message || String(err)));
    }
  }

  async function subscribe() {
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') {
      toast('未取得通知權限，無法開啟背景推播');
      return;
    }
    const registration = await navigator.serviceWorker.ready;
    let sub = await registration.pushManager.getSubscription();
    if (!sub) {
      sub = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(PUBLIC_KEY),
      });
    }
    await saveSubscriptionToCloud(sub);
    toast('已開啟背景推播提醒');
  }

  async function unsubscribe() {
    const registration = await navigator.serviceWorker.ready;
    const sub = await registration.pushManager.getSubscription();
    if (sub) {
      const endpoint = sub.endpoint;
      await sub.unsubscribe();
      await deleteSubscriptionFromCloud(endpoint);
    }
    toast('已關閉背景推播提醒');
  }

  async function saveSubscriptionToCloud(sub) {
    const auth = getAuth();
    if (!auth) throw new Error('尚未登入雲端同步，無法儲存訂閱');
    const res = await fetch(`${SUPABASE_URL}/rest/v1/push_subscriptions?on_conflict=endpoint`, {
      method: 'POST',
      headers: {
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${auth.accessToken}`,
        'Content-Type': 'application/json',
        Prefer: 'resolution=merge-duplicates,return=minimal',
      },
      body: JSON.stringify([{ endpoint: sub.endpoint, user_id: auth.user.id, subscription: sub.toJSON() }]),
    });
    if (!res.ok) throw new Error('儲存訂閱到雲端失敗（HTTP ' + res.status + '），請確認已執行 schema-push.sql');
  }

  async function deleteSubscriptionFromCloud(endpoint) {
    const auth = getAuth();
    if (!auth || !endpoint) return; // 沒有登入狀態或訂閱本來就不存在時，本機端已經取消訂閱即可，不用擋住使用者
    try {
      const url = `${SUPABASE_URL}/rest/v1/push_subscriptions?endpoint=eq.${encodeURIComponent(endpoint)}`;
      await fetch(url, {
        method: 'DELETE',
        headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${auth.accessToken}` },
      });
    } catch (err) {
      console.warn('[push] 刪除雲端訂閱紀錄失敗（本機訂閱已取消，不影響使用）', err);
    }
  }

  function toast(message) {
    if (window.CalendarApp && typeof window.CalendarApp.showToast === 'function') {
      window.CalendarApp.showToast(message);
    } else {
      console.log('[push]', message);
    }
  }

  // 標準 VAPID 公鑰轉換：base64url 字串 → Uint8Array，pushManager.subscribe() 需要這個格式。
  function urlBase64ToUint8Array(base64String) {
    const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
    const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
    const rawData = atob(base64);
    const outputArray = new Uint8Array(rawData.length);
    for (let i = 0; i < rawData.length; i++) {
      outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray;
  }
})();
