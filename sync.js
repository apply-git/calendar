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
// 同步策略：last-write-wins（比對 sync_state.updated_at）。
//   - 手動「立即同步」與自動同步都會先 cloudPull()：
//     若雲端 updated_at 比「本機記錄的上次同步時間」新 → 視為其他裝置有更新，
//     套用雲端資料到本機（並提示使用者）。
//     否則視為本機較新（或雲端沒有資料）→ cloudPush() 覆蓋雲端。
//   - 這是個人跨裝置同步，不是多人即時協作；兩台裝置都離線編輯過才同步時，
//     較晚同步的一方會蓋掉較早的一方，請見 CLOUD_SETUP.md 的說明。
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
  }

  function bindEvents() {
    if (!syncEls.btn || !syncEls.dialog) return; // index.html 沒有這組 UI 時整段安全跳過
    syncEls.btn.addEventListener('click', () => {
      updateUI();
      if (typeof syncEls.dialog.showModal === 'function') syncEls.dialog.showModal();
    });
    syncEls.closeBtn?.addEventListener('click', () => syncEls.dialog.close());
    syncEls.loginBtn?.addEventListener('click', login);
    syncEls.logoutBtn?.addEventListener('click', logout);
    syncEls.nowBtn?.addEventListener('click', () => syncNow({ silent: false }));
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

  async function cloudPull() {
    const ok = await ensureFreshToken();
    if (!ok) return null;
    const userId = authState.user?.id;
    if (!userId) return null;
    const url = `${SUPABASE_URL}/rest/v1/sync_state?user_id=eq.${encodeURIComponent(userId)}&select=payload,updated_at`;
    const res = await fetch(url, { headers: authHeaders() });
    if (!res.ok) throw new Error('cloudPull failed: ' + res.status);
    const rows = await res.json();
    return Array.isArray(rows) && rows.length ? rows[0] : null;
  }

  // 回傳伺服器實際寫入的 updated_at（ISO 字串）；理論上不該發生但拿不到時回傳 null，
  // 呼叫端（syncNow）需自行 fallback，不能假設一定拿得到伺服器時間。
  async function cloudPush(backupObject) {
    const ok = await ensureFreshToken();
    if (!ok) return null;
    const userId = authState.user?.id;
    if (!userId) return null;
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
      const meta = loadSyncMeta();
      const lastSyncedAt = Number(meta.lastSyncedAt) || 0;
      const remoteUpdatedAtMs = remote?.updated_at ? new Date(remote.updated_at).getTime() : 0;

      if (remote && remoteUpdatedAtMs > lastSyncedAt) {
        // 雲端比本機記錄的上次同步時間新：視為其他裝置已更新過，套用雲端資料（last-write-wins）。
        window.CalendarApp.applyBackupObject(remote.payload || {});
        saveSyncMeta({ lastSyncedAt: remoteUpdatedAtMs });
        toast('已從雲端取得較新的資料並更新本機');
      } else {
        // 本機較新（或雲端還沒有資料）：把本機資料覆蓋上去。
        // lastSyncedAt 必須用「伺服器」寫入的 updated_at，不能用裝置本機 Date.now()：
        // 裝置時鐘不準時，之後跟其他裝置的 remoteUpdatedAtMs 比較會永遠判斷錯誤。
        const payload = window.CalendarApp.buildBackupPayload();
        const serverUpdatedAt = await cloudPush(payload);
        saveSyncMeta({ lastSyncedAt: serverUpdatedAt ? new Date(serverUpdatedAt).getTime() : Date.now() });
        if (!silent) toast('已同步到雲端');
      }
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
      console.log('[sync]', message);
    }
  }

  // 供除錯或未來擴充使用（例如其他頁面／情境手動觸發）。
  window.CalendarSync = {
    isEnabled: () => SYNC_ENABLED,
    isLoggedIn,
    login,
    logout,
    syncNow,
  };
})();
