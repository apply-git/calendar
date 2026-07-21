'use strict';

// ============================================================================
// sync.js — 雲端同步 scaffold（Worker 4）
// ----------------------------------------------------------------------------
// 純前端、免 build：只用原生 fetch() 打 Supabase REST（PostgREST）與
// Auth（GoTrue）端點，不載入任何需要打包的 SDK。
//
// 停用狀態（預設）：
//   config.js 沒填 supabaseUrl / supabaseAnonKey 時，SYNC_ENABLED = false，
//   本檔案所有對外動作都是安全的 no-op，App 行為與純本機版完全一樣。
//
// 資料格式單一真相在 app.js：
//   window.CalendarApp.buildBackupPayload()  → 產生等同 exportBackup() 的物件
//   window.CalendarApp.applyBackupObject(x)  → 套用等同 importBackup() 的流程
// sync.js 只負責「把這包 JSON 存到雲端 / 從雲端取回」、登入狀態與同步 UI，
// 不重複實作備份資料結構，避免兩處資料格式各自漂移。
//
// 同步策略：pull → merge → push 收斂式雙向合併（取代整包 last-write-wins）。
//   - 手動「立即同步」與自動同步都會先 cloudPull()：
//     雲端完全沒有資料列（第一次同步）→ 直接 cloudPush() 本機資料，沒有東西可合併。
//     雲端已有資料 → 一律 local = CalendarApp.buildBackupPayload()、
//       merged = mergeBackupPayloads(local, cloud)、applyBackupObject(merged) 套回本機、
//       再 cloudPush(merged) 推回雲端。不再用「時間戳比大小決定單向 pull 或 push」。
//   - mergeBackupPayloads()（純函式，見下方）：tasks 依 id 取聯集，同 id 整筆取
//     updatedAt 較大者（缺 = 0，同分取 local）；墓碑（deletedAt）就是整筆的一部分，
//     所以「刪除較新維持刪除、編輯較新則復活」不用額外邏輯。其餘非 tasks 欄位
//     （habits/categories/appSettings/...）v1 整區塊取 generatedAt 較新那份。
//   - 這是個人跨裝置同步，不是多人即時協作；但因為改成逐筆合併，兩台裝置離線期間
//     各自新增/編輯不同筆行程時不會再互相蓋掉，詳見 CLOUD_SETUP.md 的說明。
// ============================================================================

(function () {
  const SYNC_AUTH_KEY = 'desktop-schedule-sync-auth-v1'; // 登入權杖，不納入備份 JSON（帳號憑證不該被匯出/分享）
  const SYNC_META_KEY = 'desktop-schedule-sync-meta-v1'; // 最後同步時間等狀態，不納入備份 JSON
  const AUTO_SYNC_DEBOUNCE_MS = 4000;

  const rawConfig = (typeof window.CALENDAR_SYNC_CONFIG === 'object' && window.CALENDAR_SYNC_CONFIG) || {};
  const SUPABASE_URL = String(rawConfig.supabaseUrl || '').trim().replace(/\/+$/, '');
  const SUPABASE_ANON_KEY = String(rawConfig.supabaseAnonKey || '').trim();
  const SYNC_ENABLED = Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);

  let authState = loadAuthState();
  let autoSyncTimer = null;
  let syncing = false;
  let lastHistoryList = []; // 快取 listHistory() 最近一次結果（含 payload），restoreHistory(id) 依此找快照內容，避免再打一次 API

  const syncEls = {};

  init();

  // ---- 初始化 ----

  function init() {
    try {
      cacheEls();
      bindEvents();
      handleAuthRedirectIfPresent();
      if (window.CalendarApp) {
        window.CalendarApp.onDataChanged = notifyLocalChange;
      }
      updateUI();
      if (SYNC_ENABLED && isLoggedIn()) {
        syncNow({ silent: true });
      }
    } catch (err) {
      console.warn('[sync] 初始化失敗，雲端同步本次停用，不影響本機功能', err);
    }
  }

  function cacheEls() {
    syncEls.btn = document.getElementById('cloudSyncBtn');
    syncEls.dialog = document.getElementById('cloudSyncDialog');
    syncEls.closeBtn = document.getElementById('closeCloudSyncBtn');
    syncEls.status = document.getElementById('cloudSyncStatus');
    syncEls.setupHint = document.getElementById('cloudSyncSetupHint');
    syncEls.loginBtn = document.getElementById('cloudSyncLoginBtn');
    syncEls.loggedInBox = document.getElementById('cloudSyncLoggedInBox');
    syncEls.userEmail = document.getElementById('cloudSyncUserEmail');
    syncEls.autoToggle = document.getElementById('cloudAutoSyncToggle');
    syncEls.nowBtn = document.getElementById('cloudSyncNowBtn');
    syncEls.logoutBtn = document.getElementById('cloudSyncLogoutBtn');
    syncEls.debugBtn = document.getElementById('cloudSyncDebugBtn');
    syncEls.forcePullBtn = document.getElementById('cloudSyncForcePullBtn');
    syncEls.forcePushBtn = document.getElementById('cloudSyncForcePushBtn');
    syncEls.historyBtn = document.getElementById('cloudHistoryBtn');
    syncEls.historyDialog = document.getElementById('cloudHistoryDialog');
    syncEls.historyCloseBtn = document.getElementById('closeCloudHistoryBtn');
    syncEls.historyList = document.getElementById('cloudHistoryList');
  }

  function bindEvents() {
    if (!syncEls.btn || !syncEls.dialog) return; // index.html 沒有這組 UI 時整段安全跳過
    syncEls.btn.addEventListener('click', () => {
      if (syncEls.dialog.open) return;
      updateUI();
      if (typeof syncEls.dialog.showModal === 'function') syncEls.dialog.showModal();
    });
    syncEls.closeBtn?.addEventListener('click', () => syncEls.dialog.close());
    syncEls.loginBtn?.addEventListener('click', login);
    syncEls.logoutBtn?.addEventListener('click', logout);
    syncEls.nowBtn?.addEventListener('click', () => syncNow({ silent: false }));
    syncEls.debugBtn?.addEventListener('click', showDebugStatus);
    syncEls.forcePullBtn?.addEventListener('click', forcePullFromCloud);
    syncEls.forcePushBtn?.addEventListener('click', forcePushToCloud);
    syncEls.historyBtn?.addEventListener('click', openCloudHistoryDialog);
    syncEls.historyCloseBtn?.addEventListener('click', () => syncEls.historyDialog.close());
    syncEls.historyList?.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-restore-id]');
      if (!btn) return;
      restoreHistory(btn.getAttribute('data-restore-id'));
    });
    syncEls.autoToggle?.addEventListener('change', () => {
      if (!window.CalendarApp) return;
      window.CalendarApp.setAutoSyncEnabled(syncEls.autoToggle.checked);
      toast(syncEls.autoToggle.checked ? '已開啟自動同步' : '已關閉自動同步');
      if (syncEls.autoToggle.checked) notifyLocalChange();
    });
  }

  // ---- 登入狀態管理（localStorage，不進備份 JSON）----

  function loadAuthState() {
    try {
      const raw = localStorage.getItem(SYNC_AUTH_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      return parsed && parsed.accessToken ? parsed : null;
    } catch {
      return null;
    }
  }

  function saveAuthState(state) {
    authState = state;
    try {
      localStorage.setItem(SYNC_AUTH_KEY, JSON.stringify(state));
    } catch {
      // localStorage 滿了或被封鎖時，登入狀態就不會被記住，但不影響本機行程功能。
    }
  }

  function clearAuthState() {
    authState = null;
    try {
      localStorage.removeItem(SYNC_AUTH_KEY);
      // 一併清掉同步紀錄（lastSyncedAt）：舊版曾用裝置本機時間存過這個值，
      // 若裝置時鐘不準會殘留錯誤紀錄卡住往後的同步判斷。重新登入視為
      // 全新一輪同步，清空後下次一定會先跟雲端資料比對，不會誤判本機較新。
      localStorage.removeItem(SYNC_META_KEY);
    } catch {}
  }

  function isLoggedIn() {
    return Boolean(authState && authState.accessToken && authState.user && authState.user.id);
  }

  function loadSyncMeta() {
    try {
      return JSON.parse(localStorage.getItem(SYNC_META_KEY)) || {};
    } catch {
      return {};
    }
  }

  function saveSyncMeta(patch) {
    try {
      localStorage.setItem(SYNC_META_KEY, JSON.stringify({ ...loadSyncMeta(), ...patch }));
    } catch {}
  }

  function decodeJwtPayload(token) {
    try {
      const part = String(token).split('.')[1];
      if (!part) return null;
      const base64 = part.replace(/-/g, '+').replace(/_/g, '/');
      const padded = base64 + '='.repeat((4 - (base64.length % 4)) % 4);
      const json = decodeURIComponent(
        atob(padded)
          .split('')
          .map((c) => '%' + c.charCodeAt(0).toString(16).padStart(2, '0'))
          .join('')
      );
      return JSON.parse(json);
    } catch {
      return null;
    }
  }

  // ---- 登入 / 登出（Supabase Auth／GoTrue，Google OAuth）----

  function login() {
    if (!SYNC_ENABLED) {
      toast('雲端同步未設定，請先參考 CLOUD_SETUP.md 設定 config.js');
      return;
    }
    try {
      const redirectTo = window.location.origin && window.location.origin !== 'null'
        ? window.location.origin + window.location.pathname
        : window.location.href.split('#')[0];
      const authorizeUrl = `${SUPABASE_URL}/auth/v1/authorize?provider=google&redirect_to=${encodeURIComponent(redirectTo)}`;
      window.location.href = authorizeUrl;
    } catch (err) {
      console.warn('[sync] 開啟登入頁面失敗', err);
      toast('無法開啟登入頁面');
    }
  }

  function logout() {
    clearAuthState();
    updateUI();
    toast('已登出雲端同步（本機資料不受影響）');
  }

  function handleAuthRedirectIfPresent() {
    if (!SYNC_ENABLED) return;
    const hash = window.location.hash || '';
    if (!hash) return;

    if (hash.indexOf('error=') !== -1) {
      const params = new URLSearchParams(hash.replace(/^#/, ''));
      const desc = params.get('error_description') || params.get('error') || '登入失敗';
      history.replaceState(null, '', window.location.pathname + window.location.search);
      toast(`雲端登入失敗：${decodeURIComponent(desc)}`);
      return;
    }

    if (hash.indexOf('access_token=') === -1) return;

    try {
      const params = new URLSearchParams(hash.replace(/^#/, ''));
      const accessToken = params.get('access_token');
      const refreshToken = params.get('refresh_token') || '';
      const expiresIn = Number(params.get('expires_in')) || 3600;
      if (!accessToken) return;

      const payload = decodeJwtPayload(accessToken) || {};
      saveAuthState({
        accessToken,
        refreshToken,
        expiresAt: Date.now() + expiresIn * 1000,
        user: { id: payload.sub || '', email: payload.email || '' },
      });
      history.replaceState(null, '', window.location.pathname + window.location.search);
      toast('登入成功' + (authState.user.email ? `：${authState.user.email}` : ''));

      if (!authState.user.email) {
        fetchAndStoreUserInfo(accessToken).catch(() => {});
      }
      updateUI();
      syncNow({ silent: true });
    } catch (err) {
      console.warn('[sync] 解析登入回傳資料失敗', err);
    }
  }

  async function fetchAndStoreUserInfo(accessToken) {
    try {
      const res = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
        headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${accessToken}` },
      });
      if (!res.ok || !authState) return;
      const data = await res.json();
      saveAuthState({
        ...authState,
        user: { id: data.id || authState.user?.id || '', email: data.email || authState.user?.email || '' },
      });
      updateUI();
    } catch (err) {
      console.warn('[sync] 取得使用者資訊失敗', err);
    }
  }

  async function ensureFreshToken() {
    if (!authState || !authState.accessToken) return false;
    const margin = 60 * 1000;
    if (authState.expiresAt && authState.expiresAt - margin > Date.now()) return true;
    if (!authState.refreshToken) return false;
    return refreshAccessToken();
  }

  async function refreshAccessToken() {
    try {
      const res = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=refresh_token`, {
        method: 'POST',
        headers: { apikey: SUPABASE_ANON_KEY, 'Content-Type': 'application/json' },
        body: JSON.stringify({ refresh_token: authState.refreshToken }),
      });
      if (!res.ok) throw new Error('refresh failed: ' + res.status);
      const data = await res.json();
      if (!data.access_token) throw new Error('refresh response missing access_token');
      saveAuthState({
        accessToken: data.access_token,
        refreshToken: data.refresh_token || authState.refreshToken,
        expiresAt: Date.now() + (Number(data.expires_in) || 3600) * 1000,
        user: authState.user,
      });
      return true;
    } catch (err) {
      console.warn('[sync] 更新登入權杖失敗，需要重新登入', err);
      clearAuthState();
      updateUI();
      toast('雲端同步登入已過期，請重新登入');
      return false;
    }
  }

  function authHeaders() {
    return { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${authState?.accessToken || ''}` };
  }

  // ---- Supabase REST（PostgREST）：sync_state 表的取回／覆蓋 ----

  // 注意：這裡「連線失敗」跟「雲端本來就還沒有這個帳號的資料列」必須明確分開處理。
  // 前者要 throw（讓 syncNow 整段中止、不要誤判成可以安全推播覆蓋），
  // 後者才回傳 null（syncNow 據此判斷「第一次同步，安全推播」）。
  // 這兩種情況混在一起，曾經導致手機一次暫時的權杖更新失敗，
  // 被誤判成「雲端沒資料」，反而把手機本機的舊資料整包推上去蓋掉雲端正確資料。
  async function cloudPull() {
    const ok = await ensureFreshToken();
    if (!ok) throw new Error('cloudPull：登入權杖無效或更新失敗，無法連線雲端（不是雲端沒有資料）');
    const userId = authState.user?.id;
    if (!userId) throw new Error('cloudPull：找不到使用者 id，無法連線雲端（不是雲端沒有資料）');
    const url = `${SUPABASE_URL}/rest/v1/sync_state?user_id=eq.${encodeURIComponent(userId)}&select=payload,updated_at`;
    // cache: 'no-store'：同步判斷必須讀到雲端「當下」的資料，任何一層快取（瀏覽器 HTTP 快取）
    // 都可能造成用舊資料比較而誤判方向。Service Worker 端也已改為不攔截跨網域請求。
    const res = await fetch(url, { headers: authHeaders(), cache: 'no-store' });
    if (!res.ok) throw new Error('cloudPull failed: ' + res.status);
    const rows = await res.json();
    // 這裡回傳 null 才是真的「雲端還沒有這個帳號的資料列」（例如第一次同步），是合理、安全的 null。
    return Array.isArray(rows) && rows.length ? rows[0] : null;
  }

  // 回傳伺服器實際寫入的 updated_at（ISO 字串）；理論上不該發生但拿不到時回傳 null，
  // 呼叫端（syncNow）需自行 fallback，不能假設一定拿得到伺服器時間。
  async function cloudPush(backupObject) {
    const ok = await ensureFreshToken();
    if (!ok) throw new Error('cloudPush：登入權杖無效或更新失敗，未送出（不能當作已同步）');
    const userId = authState.user?.id;
    if (!userId) throw new Error('cloudPush：找不到使用者 id，未送出（不能當作已同步）');
    const url = `${SUPABASE_URL}/rest/v1/sync_state?on_conflict=user_id`;
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        ...authHeaders(),
        'Content-Type': 'application/json',
        Prefer: 'resolution=merge-duplicates,return=representation',
      },
      body: JSON.stringify([{ user_id: userId, payload: backupObject, updated_at: new Date().toISOString() }]),
    });
    if (!res.ok) throw new Error('cloudPush failed: ' + res.status);
    try {
      const data = await res.json();
      const updatedAt = Array.isArray(data) && data[0] ? data[0].updated_at : null;
      if (!updatedAt) {
        console.warn('[sync] cloudPush 未取得伺服器 updated_at，將 fallback 用本機時間（可能導致時鐘不準的裝置同步異常）');
        return null;
      }
      return updatedAt;
    } catch (err) {
      console.warn('[sync] cloudPush 解析回應失敗，將 fallback 用本機時間', err);
      return null;
    }
  }

  // ---- 合併：pull → merge → push 收斂式同步（純函式，不碰 DOM／網路／localStorage）----
  //
  // tasks（核心）：以 task.id 為鍵取聯集；兩邊都有同一個 id 時，整筆取 updatedAt
  //   較大者（缺 updatedAt 視為 0，同分取 local）。墓碑（deletedAt）本身就是「整筆」
  //   的一部分，updatedAt 較新的一筆自然勝出：刪除較新就維持刪除，對方較新的編輯
  //   勝出就等於復活，不需要額外的墓碑特判邏輯。
  //
  // 其餘欄位（habits/categories/appSettings/textSettings/dailyMemos/templates/
  //   weeklyGoals/widgetMode/theme/version/exportedAt…全部非 tasks 欄位）：v1 做法
  //   是整區塊取 generatedAt 較新那份 payload 的值（沒辦法逐筆合併，可接受）。
  function mergeBackupPayloads(localObj, cloudObj) {
    localObj = localObj && typeof localObj === 'object' ? localObj : {};
    cloudObj = cloudObj && typeof cloudObj === 'object' ? cloudObj : {};

    const localGen = Number(localObj.generatedAt) || 0;
    const cloudGen = Number(cloudObj.generatedAt) || 0;
    // 同分取 local（跟下面 tasks 合併的同分規則一致）。
    const newerBlock = cloudGen > localGen ? cloudObj : localObj;

    const taskMap = new Map();
    const putTask = (task) => {
      if (!task || !task.id) return;
      const existing = taskMap.get(task.id);
      if (!existing) {
        taskMap.set(task.id, task);
        return;
      }
      const existingUpdated = Number(existing.updatedAt) || 0;
      const incomingUpdated = Number(task.updatedAt) || 0;
      // 嚴格大於才覆蓋：local 先跑一輪放進 map，同分（含都缺 = 0）時 cloud 那輪
      // 不會覆蓋掉已存在的 local 那筆，天然達成「同分取 local」。
      if (incomingUpdated > existingUpdated) taskMap.set(task.id, task);
    };
    (Array.isArray(localObj.tasks) ? localObj.tasks : []).forEach(putTask);
    (Array.isArray(cloudObj.tasks) ? cloudObj.tasks : []).forEach(putTask);

    return {
      ...newerBlock,
      tasks: Array.from(taskMap.values()),
      generatedAt: Math.max(localGen, cloudGen) || Date.now(),
    };
  }

  // buildBackupPayload()（app.js）刻意完全不動，不加 generatedAt 欄位（會讓既有
  // 備份 roundtrip 測試在兩次呼叫間比較出時間戳差異而變脆弱）。改在這裡、合併／
  // 推送前補上；已經有值（例如合併後的 payload 再次經過這裡）就不覆寫。
  function withGeneratedAt(payload) {
    if (!payload || typeof payload !== 'object') return payload;
    if (payload.generatedAt) return payload;
    return { ...payload, generatedAt: Date.now() };
  }

  // ---- 疑難排解：手機無法開發者工具時，用 alert() 直接把同步狀態顯示出來 ----

  async function showDebugStatus() {
    const meta = loadSyncMeta();
    const lines = [];
    lines.push('雲端同步設定：' + (SYNC_ENABLED ? '已設定' : '未設定'));
    lines.push('登入狀態：' + (isLoggedIn() ? '已登入' : '未登入'));
    lines.push('帳號：' + (authState?.user?.email || '（無）'));
    lines.push('本機記錄的上次同步時間：' + (meta.lastSyncedAt ? new Date(Number(meta.lastSyncedAt)).toLocaleString() : '（無，等於 0）'));
    const localTasks = window.CalendarApp ? (window.CalendarApp.buildBackupPayload().tasks || []) : null;
    lines.push('本機目前行程筆數：' + (localTasks ? localTasks.length : '（無法讀取）'));
    if (localTasks && localTasks.length) {
      lines.push('本機第一筆標題：' + (localTasks[0].title || '（無標題）') + '　id：' + localTasks[0].id);
    }
    lines.push('本機墓碑數：' + (localTasks ? localTasks.filter((t) => t.deletedAt).length : '（無法讀取）'));
    lines.push('合併模式：逐筆（pull → merge → push）');

    if (!SYNC_ENABLED) {
      alert(lines.join('\n'));
      return;
    }
    if (!isLoggedIn()) {
      lines.push('（未登入，不會嘗試連線雲端）');
      alert(lines.join('\n'));
      return;
    }

    lines.push('---- 正在連線雲端 ----');
    try {
      const ok = await ensureFreshToken();
      lines.push('權杖是否有效：' + (ok ? '有效' : '無效／更新失敗'));
      if (!ok) {
        alert(lines.join('\n'));
        return;
      }
      const remote = await cloudPull();
      if (!remote) {
        lines.push('雲端目前沒有這個帳號的資料列（remote 為 null）');
      } else {
        lines.push('雲端 updated_at：' + remote.updated_at);
        const remoteTasks = (remote.payload && remote.payload.tasks) ? remote.payload.tasks : null;
        lines.push('雲端行程筆數：' + (remoteTasks ? remoteTasks.length : '（payload 沒有 tasks）'));
        if (remoteTasks && remoteTasks.length) {
          lines.push('雲端第一筆標題：' + (remoteTasks[0].title || '（無標題）') + '　id：' + remoteTasks[0].id);
        }
      }
    } catch (err) {
      lines.push('連線雲端時發生錯誤：' + (err?.message || String(err)));
    }
    alert(lines.join('\n'));
  }

  // 疑難排解用：跳過「比對時間、決定 pull 還是 push」的邏輯，直接把雲端資料強制套用到本機，
  // 並強制整頁重新整理，確保一定看得到最新結果（排除「資料其實已經對了、只是畫面沒重繪」的可能）。
  // 只做 pull，不會反過來覆蓋雲端，所以就算按錯，最多是本機當下未存檔的操作被換掉，不會弄丟雲端資料。
  async function forcePullFromCloud() {
    if (!SYNC_ENABLED) {
      alert('雲端同步未設定');
      return;
    }
    if (!isLoggedIn()) {
      alert('尚未登入，無法拉取');
      return;
    }
    if (!confirm('會用雲端上的資料整包覆蓋本機目前畫面（不會影響雲端），確定要繼續嗎？')) return;
    try {
      const ok = await ensureFreshToken();
      if (!ok) {
        alert('權杖無效，無法連線雲端');
        return;
      }
      const remote = await cloudPull();
      if (!remote) {
        alert('雲端目前沒有這個帳號的資料，無法拉取');
        return;
      }
      window.CalendarApp.applyBackupObject(remote.payload || {});
      const remoteUpdatedAtMs = remote.updated_at ? new Date(remote.updated_at).getTime() : Date.now();
      saveSyncMeta({ lastSyncedAt: remoteUpdatedAtMs });
      alert('已套用雲端資料，即將重新整理頁面');
      window.location.reload();
    } catch (err) {
      alert('強制拉取失敗：' + (err?.message || String(err)));
    }
  }

  // 疑難排解／救資料用：跳過時間比對，直接把「本機目前資料」整包強制覆蓋雲端，
  // 並把 lastSyncedAt 更新成伺服器回傳的時間（讓這台裝置之後不會又誤判要 pull）。
  // 用途：某台裝置確定是「正確、完整」的那一份，要用它強制修正被別台覆蓋壞掉的雲端。
  async function forcePushToCloud() {
    if (!SYNC_ENABLED) {
      alert('雲端同步未設定');
      return;
    }
    if (!isLoggedIn() || !window.CalendarApp) {
      alert('尚未登入或找不到本機資料介面，無法推送');
      return;
    }
    const count = (window.CalendarApp.buildBackupPayload().tasks || []).length;
    if (!confirm(`會用「這台裝置目前的 ${count} 筆行程」整包覆蓋雲端上的資料（其他裝置下次同步會拿到這一份）。\n請確認這台就是資料正確的那一台，確定要繼續嗎？`)) return;
    try {
      const payload = window.CalendarApp.buildBackupPayload();
      const serverUpdatedAt = await cloudPush(payload);
      saveSyncMeta({ lastSyncedAt: serverUpdatedAt ? new Date(serverUpdatedAt).getTime() : Date.now() });
      saveHistorySnapshot(payload).catch(() => {});
      alert('已把這台的資料強制推送到雲端。接下來到另一台裝置按「⬇️ 強制拉取雲端資料覆蓋本機」即可。');
    } catch (err) {
      alert('強制推送失敗：' + (err?.message || String(err)));
    }
  }

  // ---- 雲端備份版本（sync_history）：每次推送自動留存快照、可一鍵回復 ----
  // 這整段是「誤覆蓋救援」的加強版：last-write-wins 同步策略下，較新的一份會整包覆蓋
  // 另一份，一旦覆蓋方向錯了（例如某台裝置誤推了不完整資料）原本沒有辦法復原。
  // 這裡在每次成功推送到 sync_state 時，「順便」多存一份快照到 sync_history，
  // 最多保留每位使用者最新 10 份，UI 提供清單與「還原」。
  //
  // 設計原則：fire-and-forget，絕對不能影響主同步流程。
  //   - sync_history 表可能還沒建立（使用者沒有執行 schema-history.sql），
  //     這種情況下所有請求都會失敗（404 / PGRST205），必須優雅降級成 console.warn，
  //     不能 throw、不能擋住 syncNow() / forcePushToCloud() 的主要行為。

  // 儲存一份快照並修剪超過 10 份的舊版本。整個函式保證不 throw。
  async function saveHistorySnapshot(backupObject) {
    try {
      if (!SYNC_ENABLED || !isLoggedIn()) return;
      const ok = await ensureFreshToken();
      if (!ok) return;
      const userId = authState.user?.id;
      if (!userId) return;
      const res = await fetch(`${SUPABASE_URL}/rest/v1/sync_history`, {
        method: 'POST',
        headers: {
          ...authHeaders(),
          'Content-Type': 'application/json',
          Prefer: 'return=minimal',
        },
        body: JSON.stringify({ user_id: userId, payload: backupObject }),
      });
      if (!res.ok) {
        // 最常見原因：sync_history 表尚未建立（使用者還沒跑 schema-history.sql）。
        console.warn('[sync] saveHistorySnapshot 寫入快照失敗（sync_history 表可能尚未建立），略過本次快照：', res.status);
        return;
      }
      await pruneHistorySnapshots(userId);
    } catch (err) {
      console.warn('[sync] saveHistorySnapshot 發生錯誤，不影響主同步流程', err);
    }
  }

  // 只保留最新 10 份快照，第 11 筆以後刪除。同樣保證不 throw。
  async function pruneHistorySnapshots(userId) {
    try {
      const listUrl = `${SUPABASE_URL}/rest/v1/sync_history?user_id=eq.${encodeURIComponent(userId)}&select=id&order=created_at.desc`;
      const res = await fetch(listUrl, { headers: authHeaders(), cache: 'no-store' });
      if (!res.ok) return;
      const rows = await res.json();
      if (!Array.isArray(rows) || rows.length <= 10) return;
      const idsToDelete = rows.slice(10).map((r) => r.id);
      if (!idsToDelete.length) return;
      const deleteUrl = `${SUPABASE_URL}/rest/v1/sync_history?id=in.(${idsToDelete.join(',')})`;
      await fetch(deleteUrl, { method: 'DELETE', headers: authHeaders() });
    } catch (err) {
      console.warn('[sync] 修剪雲端備份版本失敗，不影響主同步流程', err);
    }
  }

  // 列出最新 10 份快照（含 payload，供還原時直接使用不用再打一次 API）。
  // 回傳 null 代表「連線失敗或 sync_history 表尚未建立」，回傳 [] 代表「表存在但還沒有任何快照」，
  // UI 需要區分這兩種情況顯示不同提示文字。
  async function listHistory() {
    if (!SYNC_ENABLED || !isLoggedIn()) return null;
    try {
      const ok = await ensureFreshToken();
      if (!ok) return null;
      const userId = authState.user?.id;
      if (!userId) return null;
      const url = `${SUPABASE_URL}/rest/v1/sync_history?user_id=eq.${encodeURIComponent(userId)}&select=id,created_at,payload&order=created_at.desc&limit=10`;
      const res = await fetch(url, { headers: authHeaders(), cache: 'no-store' });
      if (!res.ok) {
        console.warn('[sync] listHistory 讀取失敗（sync_history 表可能尚未建立）：', res.status);
        return null;
      }
      const rows = await res.json();
      return Array.isArray(rows) ? rows : null;
    } catch (err) {
      console.warn('[sync] listHistory 發生錯誤', err);
      return null;
    }
  }

  // 開啟「雲端備份版本」對話框並載入清單。
  async function openCloudHistoryDialog() {
    if (!syncEls.historyDialog) return;
    if (syncEls.historyDialog.open) return;
    if (typeof syncEls.historyDialog.showModal === 'function') syncEls.historyDialog.showModal();
    if (syncEls.historyList) syncEls.historyList.innerHTML = '<p class="muted">載入中…</p>';
    const list = await listHistory();
    lastHistoryList = Array.isArray(list) ? list : [];
    renderHistoryList(list);
  }

  function pad2(n) {
    return String(n).padStart(2, '0');
  }

  function renderHistoryList(list) {
    if (!syncEls.historyList) return;
    if (list === null) {
      syncEls.historyList.innerHTML = '<p class="muted">尚未建立 sync_history 資料表，請依 CLOUD_SETUP.md 的「版本備份」段落執行 schema-history.sql</p>';
      return;
    }
    if (!list.length) {
      syncEls.historyList.innerHTML = '<p class="muted">還沒有任何快照，先按一次立即同步就會有第一份</p>';
      return;
    }
    syncEls.historyList.innerHTML = list
      .map((item) => {
        const d = new Date(item.created_at);
        const label = `${d.getFullYear()}/${d.getMonth() + 1}/${d.getDate()} ${pad2(d.getHours())}:${pad2(d.getMinutes())}:${pad2(d.getSeconds())}`;
        const count = item.payload && Array.isArray(item.payload.tasks) ? item.payload.tasks.length : 0;
        return (
          `<div class="cloud-history-row">` +
          `<span class="cloud-history-info">${label}｜${count} 筆行程</span>` +
          `<button type="button" class="ghost-btn" data-restore-id="${item.id}">還原</button>` +
          `</div>`
        );
      })
      .join('');
  }

  // 還原：把選定快照套用到本機，再推送成雲端最新一份（讓其他裝置下次同步拿到這一份），
  // 並把還原本身也留一份新快照（讓「還原這個動作」自己也可以被追溯／再還原）。
  async function restoreHistory(id) {
    const entry = lastHistoryList.find((item) => String(item.id) === String(id));
    if (!entry) {
      toast('找不到這份快照，請重新開啟雲端備份版本清單');
      return;
    }
    if (!window.CalendarApp) {
      toast('還原失敗：找不到本機資料介面');
      return;
    }
    if (!confirm('會用這份快照覆蓋目前本機與雲端資料，確定？')) return;
    try {
      window.CalendarApp.applyBackupObject(entry.payload || {});
      const serverUpdatedAt = await cloudPush(entry.payload);
      saveSyncMeta({ lastSyncedAt: serverUpdatedAt ? new Date(serverUpdatedAt).getTime() : Date.now() });
      toast('已還原並同步該版本');
      syncEls.historyDialog?.close();
      saveHistorySnapshot(entry.payload).catch(() => {});
    } catch (err) {
      console.warn('[sync] restoreHistory 失敗', err);
      toast('還原失敗：' + (err?.message || String(err)));
    }
  }

  // ---- 同步主流程（手動「立即同步」與自動同步共用）----

  async function syncNow(options = {}) {
    const { silent = false } = options;
    if (!SYNC_ENABLED) {
      if (!silent) toast('雲端同步未設定，請先參考 CLOUD_SETUP.md');
      return false;
    }
    if (!isLoggedIn()) {
      if (!silent) toast('請先登入雲端同步');
      return false;
    }
    if (!window.CalendarApp) {
      if (!silent) toast('同步失敗：找不到本機資料介面');
      return false;
    }
    if (syncing) return false;

    syncing = true;
    updateUI();
    try {
      const remote = await cloudPull();

      // 不再用「本機記錄的上次同步時間 vs 雲端 updated_at」比大小決定單向 pull 或
      // push（原本的 last-write-wins 整包覆蓋邏輯，已移除）。改成每次同步都雙向
      // 收斂：雲端完全沒有資料列時沒東西可合併才直接 push；否則一律 merge。
      if (!remote) {
        // 雲端還沒有這個帳號的資料列（第一次同步）：直接把本機資料整包推上去。
        const payload = withGeneratedAt(window.CalendarApp.buildBackupPayload());
        const serverUpdatedAt = await cloudPush(payload);
        // lastSyncedAt 必須用「伺服器」寫入的 updated_at，不能用裝置本機 Date.now()：
        // 裝置時鐘不準時，之後跟其他裝置比較會永遠判斷錯誤。
        saveSyncMeta({ lastSyncedAt: serverUpdatedAt ? new Date(serverUpdatedAt).getTime() : Date.now() });
        saveHistorySnapshot(payload).catch(() => {});
        if (!silent) toast('已同步到雲端');
        return true;
      }

      const local = withGeneratedAt(window.CalendarApp.buildBackupPayload());
      const merged = mergeBackupPayloads(local, remote.payload || {});
      window.CalendarApp.applyBackupObject(merged);
      const serverUpdatedAt = await cloudPush(merged);
      saveSyncMeta({ lastSyncedAt: serverUpdatedAt ? new Date(serverUpdatedAt).getTime() : Date.now() });
      saveHistorySnapshot(merged).catch(() => {});
      if (!silent) toast('已雙向合併同步');
      return true;
    } catch (err) {
      console.warn('[sync] 同步失敗', err);
      toast('雲端同步失敗，已保留本機資料，稍後會自動再試');
      return false;
    } finally {
      syncing = false;
      updateUI();
    }
  }

  // 存檔時（app.js render() 之後）呼叫；只有已登入且開啟自動同步才會真的動作。
  // 用 debounce 收斂高頻率呼叫（例如打字搜尋也會觸發 render()），避免頻繁打 API。
  function notifyLocalChange() {
    if (!SYNC_ENABLED || !isLoggedIn()) return;
    if (!window.CalendarApp || !window.CalendarApp.isAutoSyncEnabled()) return;
    clearTimeout(autoSyncTimer);
    autoSyncTimer = setTimeout(() => {
      syncNow({ silent: true });
    }, AUTO_SYNC_DEBOUNCE_MS);
  }

  // ---- UI ----

  function updateUI() {
    if (!syncEls.btn || !syncEls.dialog) return;
    const loggedIn = isLoggedIn();

    syncEls.btn.textContent = !SYNC_ENABLED ? '☁️ 雲端同步未設定' : (loggedIn ? '☁️ 已登入雲端' : '☁️ 雲端同步');
    syncEls.btn.classList.toggle('active-mode', loggedIn);

    if (syncEls.setupHint) syncEls.setupHint.hidden = SYNC_ENABLED;
    if (syncEls.loginBtn) syncEls.loginBtn.hidden = !SYNC_ENABLED || loggedIn;
    if (syncEls.loggedInBox) syncEls.loggedInBox.hidden = !SYNC_ENABLED || !loggedIn;

    if (!syncEls.status) return;
    if (!SYNC_ENABLED) {
      syncEls.status.textContent = '雲端同步未設定，App 目前完全使用本機資料（離線可用）。';
    } else if (!loggedIn) {
      syncEls.status.textContent = '已設定 Supabase，尚未登入，資料仍只存在本機。';
    } else {
      syncEls.status.textContent = syncing ? '同步中…' : '已登入，可手動或自動同步備份資料。';
      if (syncEls.userEmail) syncEls.userEmail.textContent = authState.user?.email ? `帳號：${authState.user.email}` : '帳號：（未取得 email）';
      if (syncEls.autoToggle && window.CalendarApp) syncEls.autoToggle.checked = window.CalendarApp.isAutoSyncEnabled();
      if (syncEls.nowBtn) syncEls.nowBtn.disabled = syncing;
    }
  }

  function toast(message) {
    if (window.CalendarApp && typeof window.CalendarApp.showToast === 'function') {
      window.CalendarApp.showToast(message);
    } else {
      console.warn('[sync]', message);
    }
  }

  // 供除錯或未來擴充使用（例如其他頁面／情境手動觸發）。
  window.CalendarSync = {
    isEnabled: () => SYNC_ENABLED,
    isLoggedIn,
    login,
    logout,
    syncNow,
    showDebugStatus,
    forcePullFromCloud,
    forcePushToCloud,
    // 供 push.js（背景推播 scaffold）讀取目前登入狀態用，回傳淺拷貝避免外部程式改到內部狀態。
    // 不做 token 刷新；push.js 只在使用者於對話框內操作時呼叫，沿用當下已知的登入狀態即可。
    getAuthState: () => (authState ? { ...authState, user: authState.user ? { ...authState.user } : null } : null),
    // 純函式，供 node 腳本直接測試合併邏輯用，不依賴登入狀態或網路。
    _mergeBackupPayloads: mergeBackupPayloads,
  };
})();
