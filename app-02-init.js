// ============================================================================
// 行程附件（IndexedDB）：DB desktop-schedule-attachments v1、objectStore 'files'
// （keyPath 'id'，taskId 建索引）。附件本體（blob）只存本機 IndexedDB，不進
// localStorage／備份 JSON／雲端同步——task 只存 attachmentCount 供卡片顯示數量。
// 教訓同上：這些狀態變數／常數必須宣告在 init() 呼叫【之前】，避免 TDZ。
// IndexedDB 開庫失敗（極舊瀏覽器／部分隱私模式）時 attachmentsUnavailable=true，
// 整個附件 UI 隱藏，其他功能零影響（initAttachmentFeature() 見下方，init() 內呼叫）。
// ============================================================================
const ATTACHMENT_DB_NAME = 'desktop-schedule-attachments';
const ATTACHMENT_DB_VERSION = 1;
const ATTACHMENT_STORE = 'files';
const ATTACHMENT_MAX_SIZE = 5 * 1024 * 1024; // 單檔 5MB
const ATTACHMENT_MAX_PER_TASK = 10; // 每行程最多 10 個附件

let attachmentsUnavailable = false;
let attachmentDbPromise = null;
let pendingAttachments = []; // 新增行程尚未儲存時的暫存附件（記憶體陣列，取消時釋放）
let currentAttachmentRecords = []; // 目前對話框顯示中的附件清單（供刪除/預覽點擊查找）
let attachmentDialogTaskId = ''; // 目前對話框對應的既有 task.id；新增行程尚未儲存時為空字串
let attachmentObjectUrls = []; // 縮圖用的 createObjectURL，重新渲染/關窗前先 revoke 避免洩漏

function openAttachmentDb() {
  if (attachmentDbPromise) return attachmentDbPromise;
  attachmentDbPromise = new Promise((resolve, reject) => {
    if (!window.indexedDB) { reject(new Error('indexedDB unavailable')); return; }
    let request;
    try {
      request = window.indexedDB.open(ATTACHMENT_DB_NAME, ATTACHMENT_DB_VERSION);
    } catch (err) {
      reject(err);
      return;
    }
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(ATTACHMENT_STORE)) {
        const store = db.createObjectStore(ATTACHMENT_STORE, { keyPath: 'id' });
        store.createIndex('taskId', 'taskId', { unique: false });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error('indexedDB open failed'));
  });
  return attachmentDbPromise;
}

function idbPut(record) {
  return openAttachmentDb().then((db) => new Promise((resolve, reject) => {
    const tx = db.transaction(ATTACHMENT_STORE, 'readwrite');
    tx.objectStore(ATTACHMENT_STORE).put(record);
    tx.oncomplete = () => resolve(record);
    tx.onerror = () => reject(tx.error);
  }));
}

function idbGetByTask(taskId) {
  return openAttachmentDb().then((db) => new Promise((resolve, reject) => {
    const tx = db.transaction(ATTACHMENT_STORE, 'readonly');
    const req = tx.objectStore(ATTACHMENT_STORE).index('taskId').getAll(taskId);
    req.onsuccess = () => resolve(req.result || []);
    req.onerror = () => reject(req.error);
  }));
}

function idbDelete(id) {
  return openAttachmentDb().then((db) => new Promise((resolve, reject) => {
    const tx = db.transaction(ATTACHMENT_STORE, 'readwrite');
    tx.objectStore(ATTACHMENT_STORE).delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  }));
}

function idbDeleteByTask(taskId) {
  return idbGetByTask(taskId)
    .then((records) => Promise.all(records.map((record) => idbDelete(record.id))))
    .catch(() => {});
}

// 偵測 IndexedDB 可用性：不可用就整個附件 UI 隱藏，其餘功能不受影響。
function initAttachmentFeature() {
  if (!window.indexedDB) {
    attachmentsUnavailable = true;
    hideAttachmentUI();
    return;
  }
  openAttachmentDb()
    .then(() => { attachmentsUnavailable = false; })
    .catch(() => {
      attachmentsUnavailable = true;
      hideAttachmentUI();
    });
}

function hideAttachmentUI() {
  if (els.attachmentSection) els.attachmentSection.hidden = true;
}

function init() {
  // M-fix2: 非安全來源（區網 http 預覽）沒有 crypto.randomUUID，補 polyfill 避免儲存失敗
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID !== 'function' && typeof crypto.getRandomValues === 'function') {
    crypto.randomUUID = () => ([1e7] + -1e3 + -4e3 + -8e3 + -1e11).replace(/[018]/g, (c) => (c ^ crypto.getRandomValues(new Uint8Array(1))[0] & 15 >> c / 4).toString(16));
  }

  document.body.classList.toggle('widget-mode', widgetMode);
  applyTheme();
  bindSystemThemeListener();
  els.todayLabel.textContent = formatLongDate(new Date());
  applyTextSettings();

  // 全新安裝／無資料時保持空白，不再自動塞範例行程：
  // 範例行程曾在雲端同步時被誤推上雲端蓋掉正式資料，且對新使用者也未必需要。
  normalizeStoredData();
  initAttachmentFeature();
  const storedHolidays = getStoredHolidays();
  if (storedHolidays && storedHolidays.days) dynamicHolidays = storedHolidays.days;
  bindEvents();
  setupMobilePanels();
  setupToolbarMenus();
  setupToolbarOverflow();
  setupVoiceInput();
  render();
  updatePomodoroDisplay();
  requestNotificationPermission();
  registerServiceWorker();
  handleUrlShortcutAction();
  handleShareTarget();
  handleNotifUrlAction();
  setInterval(checkReminders, 30 * 1000);

  // 首次進入時自動彈出歡迎教學卡片（只在 WELCOME_KEY 不存在時；見 maybeShowWelcome()）。
  maybeShowWelcome();

  // 天氣（Open-Meteo，免金鑰）：零設定零影響——file:// 雙擊開啟或離線時完全跳過，
  // 不顯示天氣但其他功能不受影響；fetchWeather() 內部已包 try/catch 靜默降級。
  if (location.protocol !== 'file:' && navigator.onLine) {
    fetchWeather();
  }

  // 台灣假日自動更新（TaiwanCalendar CDN，免金鑰）：零設定零影響，規則同天氣——
  // file:// 雙擊開啟或離線時完全跳過，繼續使用內建 TAIWAN_HOLIDAYS 靜態表；
  // fetchHolidayUpdates() 內部已包 try/catch 靜默降級，且 30 天內不重抓。
  if (location.protocol !== 'file:' && navigator.onLine) {
    fetchHolidayUpdates();
  }
}

// 首次進入的歡迎教學卡片：只有 WELCOME_KEY 不存在（沒看過、也沒勾「不再顯示」）時，
// init() 完成後自動彈出一次。純裝置本機 UI 狀態，不進備份 JSON、不進雲端同步。
// localStorage 讀取以 try/catch 保護（隱私模式可能 throw）：讀不到就當作已看過、不打擾，
// 避免異常環境反覆彈窗（寫入旗標由 app-03-events.js 的 closeWelcomeDialog() 負責，同樣包 try/catch）。
function maybeShowWelcome() {
  let seen = true;
  try {
    seen = localStorage.getItem(WELCOME_KEY) === '1';
  } catch (_) {
    seen = true;
  }
  if (!seen) els.welcomeDialog?.showModal();
}

// 深色模式三段循環（淺色 → 深色 → 自動(跟隨系統) → 淺色）：THEME_KEY 存 'light'|'dark'|'auto'。
// 'auto' 時實際深淺由 matchMedia('(prefers-color-scheme: dark)') 決定，並即時跟隨系統切換。
// applyTheme() 是唯一「由存值算出實際深淺並套用 body.dark + 更新按鈕圖示/title」的地方，
// init()、toggleTheme()、applyBackupObject()、系統主題變更監聽都呼叫它，避免各處各自判斷漂移。
function getStoredThemeMode() {
  const stored = localStorage.getItem(THEME_KEY);
  return stored === 'dark' || stored === 'auto' ? stored : 'light';
}

function systemPrefersDark() {
  return Boolean(window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches);
}

function applyTheme() {
  const mode = getStoredThemeMode();
  const isDark = mode === 'dark' || (mode === 'auto' && systemPrefersDark());
  document.body.classList.toggle('dark', isDark);
  if (els.themeBtn) {
    els.themeBtn.textContent = mode === 'auto' ? '🌗' : (mode === 'dark' ? '☀️' : '🌙');
    const modeLabel = mode === 'auto' ? '自動（跟隨系統）' : (mode === 'dark' ? '深色' : '淺色');
    els.themeBtn.title = `目前主題：${modeLabel}，點擊切換`;
  }
}

function bindSystemThemeListener() {
  if (!window.matchMedia) return;
  const media = window.matchMedia('(prefers-color-scheme: dark)');
  const handler = () => { if (getStoredThemeMode() === 'auto') applyTheme(); };
  if (typeof media.addEventListener === 'function') media.addEventListener('change', handler);
  else if (typeof media.addListener === 'function') media.addListener(handler); // 舊瀏覽器相容
}

// 手機版排版大改（只在 max-width:760px 生效，桌面版完全不受影響）：
// 1) 側欄面板（今日重點/完成率/每週目標/習慣追蹤/自訂分類/快速範本）、搜尋篩選區、
//    每日備忘錄改成收合式，預設收合，點標題列展開/收回。
// 2) 顯示右下角懸浮新增按鈕（FAB）。
// 3) 顯示工具列「⋯ 更多」按鈕（次要工具鈕的 dialog 由 bindEvents() 綁好，這裡只負責顯示）。
// 只在 init() 判斷一次 matchMedia，不監聽 resize（規格如此，轉回桌面寬時因為所有收合
// 樣式都包在 media query 內，class 留著也不會有視覺效果）。
function setupMobilePanels() {
  const isMobile = window.matchMedia('(max-width: 760px)').matches;
  if (!isMobile) return;

  // 品牌區（圖示＋標題＋今天日期）整組搬到 .main 最上方當表頭：
  // 手機版 .main 排最前（order:1），原本品牌區困在下方的側欄裡很突兀。
  // 加 brand-mobile class 讓 CSS 縮小尺寸；側欄的大顆「＋ 新增行程」由 CSS 隱藏（右下角 FAB 取代）。
  const brandEl = document.querySelector('.sidebar .brand');
  const mainEl = document.querySelector('.main');
  if (brandEl && mainEl) {
    brandEl.classList.add('brand-mobile');
    mainEl.insertBefore(brandEl, mainEl.firstChild);
  }

  const makeCollapsible = (panel, headEl, startCollapsed = true) => {
    if (!panel || !headEl || panel.classList.contains('collapsible')) return;
    headEl.classList.add('panel-collapse-head');
    panel.classList.add('collapsible');
    if (startCollapsed) panel.classList.add('collapsed');
    headEl.addEventListener('click', () => panel.classList.toggle('collapsed'));
  };

  // 側欄各面板：h2 是既有標題，直接綁。
  document.querySelectorAll('.sidebar .panel').forEach((panel) => {
    makeCollapsible(panel, panel.querySelector('h2'));
  });

  // 搜尋/篩選區（.controls）本來沒有標題列，手機模式動態插入一個可點的 h2。
  const controls = document.querySelector('.controls');
  if (controls) {
    let heading = controls.querySelector('.controls-heading');
    if (!heading) {
      heading = document.createElement('h2');
      heading.className = 'controls-heading';
      heading.textContent = '搜尋與篩選';
      controls.insertBefore(heading, controls.firstChild);
    }
    makeCollapsible(controls, heading);
  }

  // 每日備忘錄：沿用既有的 .daily-memo-head（內含標題與「自動儲存」文字）當標題列。
  const dailyMemo = document.querySelector('.daily-memo');
  if (dailyMemo) {
    makeCollapsible(dailyMemo, dailyMemo.querySelector('.daily-memo-head'));
  }

  // 懸浮新增按鈕（FAB）：小工具模式／今日待辦模式不用特別處理，維持顯示即可。
  if (els.fabAddBtn) {
    els.fabAddBtn.hidden = false;
    els.fabAddBtn.addEventListener('click', () => openTaskDialog({ date: toDateInput(currentDate) }));
  }

  // 工具列「⋯ 更多」按鈕：顯示出來，實際開關與 proxy click 綁定在 bindEvents()。
  if (els.moreToolsBtn) els.moreToolsBtn.hidden = false;
}

// 桌面工具列六組下拉選單：TOOLBAR_MENU_GROUPS 設定表驅動，proxy 模式（零改既有綁定）。
// 開啟選單時動態重建項目——文字/隱藏狀態當下即時取自原按鈕，原按鈕 hidden 的項目跳過不生成。
function closeAllToolbarMenus() {
  document.querySelectorAll('.toolbar-menu-wrap').forEach((wrap) => {
    const menu = wrap.querySelector('.toolbar-menu');
    const btn = wrap.querySelector('.toolbar-menu-btn');
    if (menu) menu.hidden = true;
    if (btn) btn.classList.remove('active');
  });
}

function renderToolbarMenuItems(group, menu) {
  menu.innerHTML = '';
  group.items.forEach((item) => {
    let label;
    let activate;
    if (item.proxyId) {
      const original = document.getElementById(item.proxyId);
      if (!original || original.hidden) return; // 原按鈕 hidden → 跳過不生成
      label = original.textContent;
      activate = () => original.click();
    } else {
      label = item.label;
      activate = item.onClick;
    }
    const itemBtn = document.createElement('button');
    itemBtn.type = 'button';
    itemBtn.className = 'toolbar-menu-item';
    itemBtn.textContent = label;
    itemBtn.addEventListener('click', () => {
      closeAllToolbarMenus(); // 選完自動消失
      activate();
    });
    menu.appendChild(itemBtn);
  });
}

// 依 TOOLBAR_MENU_GROUPS 同步各群組鈕的 hidden：全部成員都 hidden 時群組鈕本身也 hidden。
// 由 updateDayModeSwitch() 尾端呼叫（檢視切換會改變 clearDayBtn 等的 hidden，需即時同步）。
function updateToolbarMenuButtons() {
  TOOLBAR_MENU_GROUPS.forEach((group) => {
    const btn = document.getElementById(group.btnId);
    if (!btn) return;
    const anyVisible = group.items.some((item) => {
      if (!item.proxyId) return true; // 非 proxy 項目（如看板模式）永遠視為可用
      const original = document.getElementById(item.proxyId);
      return original && !original.hidden;
    });
    btn.hidden = !anyVisible;
    if (!anyVisible) {
      const wrap = btn.closest('.toolbar-menu-wrap');
      const menu = wrap?.querySelector('.toolbar-menu');
      if (menu) menu.hidden = true;
      btn.classList.remove('active');
    }
  });
}

function setupToolbarMenus() {
  TOOLBAR_MENU_GROUPS.forEach((group) => {
    const btn = document.getElementById(group.btnId);
    const wrap = btn?.closest('.toolbar-menu-wrap');
    const menu = wrap?.querySelector('.toolbar-menu');
    if (!btn || !wrap || !menu) return;
    btn.addEventListener('click', (event) => {
      event.stopPropagation();
      const wasOpen = !menu.hidden;
      closeAllToolbarMenus(); // 互斥：開一個關其他
      if (!wasOpen) {
        renderToolbarMenuItems(group, menu);
        // position:fixed 由 JS 依按鈕位置定位：.toolbar-actions 有 overflow:hidden
        // （溢出偵測需要），absolute 選單會被整個裁掉看不到，fixed 才能跳出裁切。
        const rect = btn.getBoundingClientRect();
        menu.style.top = `${rect.bottom + 6}px`;
        menu.style.left = 'auto';
        menu.hidden = false;
        btn.classList.add('active');
        // 先顯示才量得到選單寬度；右緣超出視窗時往左收
        const menuRect = menu.getBoundingClientRect();
        const left = Math.max(8, Math.min(rect.left, window.innerWidth - menuRect.width - 8));
        menu.style.left = `${left}px`;
      }
    });
  });

  // fixed 定位跟著視窗捲動/縮放會漂移，直接關閉最單純。
  window.addEventListener('scroll', closeAllToolbarMenus, { passive: true });
  window.addEventListener('resize', closeAllToolbarMenus);

  document.addEventListener('click', (event) => {
    if (event.target.closest('.toolbar-menu-wrap')) return; // 點在選單/群組鈕內部不處理
    closeAllToolbarMenus();
  });

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') closeAllToolbarMenus();
  });

  updateToolbarMenuButtons();
}

// 桌面版工具列動態溢出收合（跟上面手機版 setupMobilePanels() 並存、互不干擾）：
// 手機 matchMedia(max-width:760px) 為真時，.toolbar-actions 整組按鈕本來就由 CSS
// display:none !important 蓋掉、改走 moreToolsDialog，所以下面 adjust() 一開頭
// 判斷到手機寬度就直接 return，完全不介入。
// clearDayBtn/deferBtn/shareCardBtn/clearWeekBtn/clearMonthBtn 這幾顆由
// updateDayModeSwitch() 依目前檢視（日/週/月）自行控制 hidden，为避免互相打架，
// 這裡的溢出收合刻意排除它們，只處理其餘固定顯示的工具鈕。
function setupToolbarOverflow() {
  const container = document.querySelector('.toolbar-actions');
  if (!container || !els.moreToolsBtn) return;

  const isMobile = () => window.matchMedia('(max-width: 760px)').matches;
  const isOverflowing = () => container.scrollWidth > container.clientWidth + 1;
  const getCandidates = () => Array.from(container.querySelectorAll(':scope > button')).filter(
    (btn) => btn !== els.moreToolsBtn && !VIEW_CONTROLLED_TOOLBAR_IDS.has(btn.id) && btn.id
  );

  function syncOverflowProxies() {
    if (!els.moreToolsDialog) return;
    let group = document.getElementById('overflowProxyGroup');
    if (!group) {
      group = document.createElement('div');
      group.id = 'overflowProxyGroup';
      els.moreToolsDialog.querySelector('.more-tools-body')?.appendChild(group);
    }
    const hiddenSet = new Set(overflowHiddenIds);
    // 移除「本群組內」不再需要的動態 proxy（原本手機固定的 proxy 不在這個群組裡，不會被動到）。
    Array.from(group.children).forEach((proxy) => {
      if (!hiddenSet.has(proxy.dataset.proxy)) proxy.remove();
    });
    // 補上缺少的 proxy：整個 #moreToolsDialog 內（含手機固定 proxy）已經有的就重複使用、不重建。
    overflowHiddenIds.forEach((id) => {
      if (els.moreToolsDialog.querySelector(`[data-proxy="${id}"]`)) return;
      const original = document.getElementById(id);
      if (!original) return;
      const proxy = document.createElement('button');
      proxy.type = 'button';
      proxy.className = 'more-tools-item';
      proxy.dataset.proxy = id;
      proxy.textContent = original.textContent;
      proxy.addEventListener('click', () => {
        els.moreToolsDialog?.close();
        original.click();
      });
      group.appendChild(proxy);
    });
  }

  function adjust() {
    if (isMobile()) return; // 手機模式交給既有 setupMobilePanels() / CSS，這裡不介入

    // 1. 先嘗試還原（優先還原最近被藏的），每還原一顆就重新量測，空間不夠就藏回去並停止。
    while (overflowHiddenIds.length) {
      const id = overflowHiddenIds[overflowHiddenIds.length - 1];
      const btn = document.getElementById(id);
      if (!btn) { overflowHiddenIds.pop(); continue; }
      btn.hidden = false;
      if (isOverflowing()) {
        btn.hidden = true;
        break;
      }
      overflowHiddenIds.pop();
    }

    // 2. 若仍溢出，從最右邊的按鈕開始藏（排除 moreToolsBtn），每藏一顆重新量測。
    const candidates = getCandidates();
    let guard = candidates.length + 5; // 保險，避免極端狀況造成無窮迴圈
    while (isOverflowing() && guard-- > 0) {
      const rightmost = [...candidates].reverse().find((btn) => !btn.hidden);
      if (!rightmost) break;
      rightmost.hidden = true;
      overflowHiddenIds.push(rightmost.id);
    }

    // 3. moreToolsBtn：只要有任何按鈕因桌面溢出被藏起來，就顯示它；否則維持 hidden。
    els.moreToolsBtn.hidden = overflowHiddenIds.length === 0;

    syncOverflowProxies();
  }

  let resizeTimer = null;
  const debouncedAdjust = () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(adjust, 150);
  };

  if (window.ResizeObserver) {
    new ResizeObserver(debouncedAdjust).observe(container);
  } else {
    window.addEventListener('resize', debouncedAdjust);
  }

  adjust(); // 一開始先量測一次
}

// Android PWA「長按主畫面圖示」快捷選單（manifest.json 的 shortcuts）會導向
// ./index.html?action=xxx，這裡讀取 query param 觸發對應既有邏輯，
// 處理完立刻把網址上的 ?action=... 清掉，避免重新整理時重複觸發。
function handleUrlShortcutAction() {
  const params = new URLSearchParams(window.location.search);
  const action = params.get('action');
  if (!action) return;

  if (action === 'quickadd') {
    openTaskDialog({ date: toDateInput(currentDate) });
  } else if (action === 'todaytodo') {
    if (!todayTodoMode) toggleTodayTodoMode();
  } else if (action === 'pomodoro') {
    openPomodoroDialog();
  }

  history.replaceState(null, '', window.location.pathname);
}

// PWA 分享目標：手機上其他 App 用「分享」把文字/連結送進來時，Android 會帶
// ?share_title=...&share_text=...&share_url=... 開啟（manifest.json 的 share_target）。
// param 名故意加 share_ 前綴，避免跟上面 handleUrlShortcutAction() 的 ?action= 快捷衝突。
// title＋text 合併成標題丟給 openTaskDialog()，再借用既有的 applyNaturalLanguageParse()
// 自動解析日期/時間語彙；share_url 有值則附加到備註欄，方便保留原始分享連結。
function handleShareTarget() {
  const params = new URLSearchParams(window.location.search);
  const title = params.get('share_title') || '';
  const text = params.get('share_text') || '';
  const url = params.get('share_url') || '';
  if (!title && !text && !url) return;

  const combinedTitle = [title, text].filter(Boolean).join(' ').trim();
  openTaskDialog({ date: toDateInput(currentDate), title: combinedTitle });
  applyNaturalLanguageParse();
  if (url) {
    els.taskNote.value = els.taskNote.value ? `${els.taskNote.value}\n${url}` : url;
  }

  history.replaceState(null, '', window.location.pathname);
}

// 新版 Service Worker 就緒提示：偵測到「已經有舊版在控制目前頁面、且有新版安裝完成
// 在等待中」時顯示固定橫幅，使用者按「立即更新」才會真的切換過去並重新整理，
// 不會在背景默默把使用中的頁面換掉。file:// 開啟（無 SW）時 registerServiceWorker()
// 一開頭就 return，這整段邏輯完全不會執行。
function showSwUpdateBanner(registration) {
  if (!els.swUpdateBanner || !els.swUpdateBtn) return;
  els.swUpdateBanner.hidden = false;
  els.swUpdateBtn.onclick = () => {
    const waiting = registration.waiting;
    if (!waiting) return;
    els.swUpdateBtn.disabled = true;
    els.swUpdateBtn.textContent = '更新中…';
    waiting.postMessage({ type: 'SKIP_WAITING' });
  };
}

function watchServiceWorkerUpdates(registration) {
  // 同一個 registration 物件可能因為 register().then() 與 .ready.then() 都呼叫到這裡而重複執行，
  // 用一個標記避免重複掛 updatefound 監聽（掛兩次不會出錯，但沒必要）。
  if (!registration || registration._swUpdateWatched) return;
  registration._swUpdateWatched = true;

  // 頁面載入時剛好已經有新版在等待（例如上次沒有按「立即更新」就關掉分頁）。
  if (registration.waiting && navigator.serviceWorker.controller) {
    showSwUpdateBanner(registration);
  }

  registration.addEventListener('updatefound', () => {
    const newWorker = registration.installing;
    if (!newWorker) return;
    newWorker.addEventListener('statechange', () => {
      // 只有「目前頁面已經被某個舊版 SW 控制中」才算是「更新」；全新安裝（沒有
      // controller）不用提示，直接讓它自然啟用即可。
      if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
        showSwUpdateBanner(registration);
      }
    });
  });
}

function registerServiceWorker() {
  if (!('serviceWorker' in navigator) || location.protocol === 'file:') return;

  // 提醒通知的「✔ 完成」「⏰ 延後10分鐘」按鈕由 service-worker.js 的 notificationclick
  // 轉發過來（頁面仍開著、找得到視窗時）。雲端推播通知沒有 kind 欄位，SW 端已濾掉不會送到這裡。
  navigator.serviceWorker.addEventListener('message', (event) => {
    const msg = event.data;
    if (msg && msg.type === 'NOTIFICATION_ACTION') {
      handleNotificationAction(msg.action, msg.taskId, msg.dateKey);
    }
  });

  // 新版 SW 透過 SKIP_WAITING 訊息取得控制權後會觸發這個事件；用旗標防止同一次
  // 更新觸發兩次重新整理（controllerchange 理論上只會在真正切換控制權時觸發一次，
  // 但多層保護避免潛在的重複註冊/重複事件造成使用者困擾）。
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (swUpdateReloading) return;
    swUpdateReloading = true;
    location.reload();
  });

  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./service-worker.js')
      .then((registration) => {
        swRegistration = registration;
        watchServiceWorkerUpdates(registration);
      })
      .catch(() => {
        // PWA 離線快取註冊失敗時，不影響一般行程表功能。
      });
  });

  navigator.serviceWorker.ready.then((registration) => {
    swRegistration = registration;
    watchServiceWorkerUpdates(registration);
  }).catch(() => {});
}

