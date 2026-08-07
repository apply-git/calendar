// ============================================================================
// gcal.js — G1：Google Calendar 唯讀匯入
// ----------------------------------------------------------------------------
// 設計原則（改動前請先讀 CLOUD_GCAL_SETUP.md）：
//   1. 「唯讀」是硬規則。只要 calendar.readonly scope，永遠不呼叫任何寫入端點，
//      所以本檔案不可能改動使用者真正的 Google 日曆。
//   2. 只做「抓取 + 對應 + 交給 app 存檔」三件事。實際動 tasks 陣列的邏輯放在
//      app-08-data.js 的 replaceGcalTasks()，資料真相仍由 app 端單一入口掌管。
//   3. 沒設定 config.js、沒登入、沒有這組 UI、Google API 掛掉——任一情況都必須
//      安全跳過，絕不影響本機行程功能（整段包 try/catch，失敗只 console.warn）。
//   4. provider_token 是憑證，只存 localStorage 的 GCAL_KEY，
//      **不進 buildBackupPayload()**，不會被匯出或分享出去。
//
// 匯入的活動長相：id 一律是 `gcal-<Google event id>`、`source: 'gcal'`、
// 分類固定「Google 日曆」。重新匯入＝整批換掉上一次的匯入結果（見 replaceGcalTasks）。
// ============================================================================

(function () {
  'use strict';

  const GCAL_KEY = 'desktop-schedule-gcal-v1'; // { providerToken, tokenSavedAt, range, lastImportAt, lastCount }；憑證性質，不納入備份 JSON
  const GCAL_API = 'https://www.googleapis.com/calendar/v3/calendars/primary/events';
  const GCAL_ID_PREFIX = 'gcal-';
  const GCAL_CATEGORY = 'Google 日曆';
  const MAX_EVENTS = 500;   // 單次匯入上限，避免一次灌爆 localStorage
  const MAX_PAGES = 10;     // 分頁保險絲，避免 nextPageToken 異常時無限迴圈

  // 匯入區間預設值：使用者最常要的是「回顧上個月 + 規劃未來一季」，所以 default 取 -1 ~ +3 個月。
  // months: [起始偏移月, 結束偏移月]；thisYear 特例用 months: null 走年初～年末。
  const RANGE_PRESETS = [
    { value: 'default', label: '前一個月～後三個月', months: [-1, 3] },
    { value: 'next1m', label: '僅未來一個月', months: [0, 1] },
    { value: 'around3m', label: '前後各三個月', months: [-3, 3] },
    { value: 'thisYear', label: '今年整年', months: null },
  ];
  const DEFAULT_RANGE = 'default';

  const gcalEls = {};
  let importing = false;

  init();

  // ---- 初始化 ----

  function init() {
    try {
      cacheEls();
      bindEvents();
      updateUI();
    } catch (err) {
      console.warn('[gcal] 初始化失敗，Google 日曆匯入本次停用，不影響其他功能', err);
    }
  }

  function cacheEls() {
    if (typeof document === 'undefined') return;
    gcalEls.block = document.getElementById('gcalBlock');
    gcalEls.status = document.getElementById('gcalStatus');
    gcalEls.rangeSelect = document.getElementById('gcalRangeSelect');
    gcalEls.importBtn = document.getElementById('gcalImportBtn');
  }

  function bindEvents() {
    if (!gcalEls.importBtn || !gcalEls.rangeSelect) return; // index.html 沒有這組 UI（例如 tests.html）時整段安全跳過
    gcalEls.rangeSelect.value = loadState().range || DEFAULT_RANGE;
    gcalEls.rangeSelect.addEventListener('change', () => {
      saveState({ range: gcalEls.rangeSelect.value });
      updateUI();
    });
    gcalEls.importBtn.addEventListener('click', () => { importNow(); });
  }

  // ---- 本機狀態（localStorage，不進備份 JSON）----

  function loadState() {
    try {
      const raw = localStorage.getItem(GCAL_KEY);
      const parsed = raw ? JSON.parse(raw) : null;
      return (parsed && typeof parsed === 'object') ? parsed : {};
    } catch (err) {
      return {};
    }
  }

  function saveState(patch) {
    try {
      localStorage.setItem(GCAL_KEY, JSON.stringify({ ...loadState(), ...patch }));
    } catch (err) {
      // localStorage 滿了或被封鎖：這次的設定不會被記住，但不影響本機行程功能。
    }
  }

  // sync.js 登入成功後把 Google 的 provider_token 交過來（見 handleAuthRedirectIfPresent）。
  // 這顆 token 是 Google 直接發的存取權杖，約 1 小時到期，過期就請使用者重新登入。
  function storeProviderToken(token) {
    const value = String(token || '').trim();
    if (!value) return;
    saveState({ providerToken: value, tokenSavedAt: Date.now() });
    updateUI();
  }

  function clearProviderToken() {
    saveState({ providerToken: '', tokenSavedAt: 0 });
    updateUI();
  }

  // ---- 純函式：區間計算（可單元測試，不碰 DOM／網路／localStorage）----

  // 月份位移並夾住月底：3/31 往前一個月要得到 2/28（或 2/29），不能溢位成 3/3。
  function shiftMonths(date, months) {
    const target = new Date(date.getFullYear(), date.getMonth() + months, 1);
    const lastDay = new Date(target.getFullYear(), target.getMonth() + 1, 0).getDate();
    target.setDate(Math.min(date.getDate(), lastDay));
    return target;
  }

  // 回傳 Calendar API 需要的 timeMin/timeMax（RFC3339）。preset 認不得時一律退回 default，
  // 讓壞掉的 localStorage 值也不會導致匯入失敗。
  function computeRange(preset, now) {
    const base = (now instanceof Date && !Number.isNaN(now.getTime())) ? new Date(now.getTime()) : new Date();
    let minDate;
    let maxDate;
    if (preset === 'thisYear') {
      minDate = new Date(base.getFullYear(), 0, 1);
      maxDate = new Date(base.getFullYear(), 11, 31);
    } else {
      const found = RANGE_PRESETS.find((item) => item.value === preset && item.months)
        || RANGE_PRESETS.find((item) => item.value === DEFAULT_RANGE);
      minDate = shiftMonths(base, found.months[0]);
      maxDate = shiftMonths(base, found.months[1]);
    }
    minDate.setHours(0, 0, 0, 0);
    maxDate.setHours(23, 59, 59, 999);
    return { timeMin: minDate.toISOString(), timeMax: maxDate.toISOString() };
  }

  function rangeLabel(preset) {
    const found = RANGE_PRESETS.find((item) => item.value === preset);
    return found ? found.label : RANGE_PRESETS[0].label;
  }

  // ---- 純函式：Google event → 行程表 task（可單元測試）----

  function pad2(value) {
    return String(value).padStart(2, '0');
  }

  function toDateKey(date) {
    return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
  }

  function toTimeStr(date) {
    return `${pad2(date.getHours())}:${pad2(date.getMinutes())}`;
  }

  // Google 允許零長度活動，行程表則要求 end > start，補一分鐘避免資料檢查噴 badTimeRange。
  function bumpMinute(hhmm) {
    const parts = String(hhmm).split(':');
    const total = Math.min(23 * 60 + 59, Number(parts[0]) * 60 + Number(parts[1]) + 1);
    return `${pad2(Math.floor(total / 60))}:${pad2(total % 60)}`;
  }

  // 對應規則：
  //   - status === 'cancelled' 或沒有 id／沒有可用時間 → 回 null（呼叫端過濾掉）
  //   - start.dateTime（有時段）→ date/start/end；跨日的結束時間夾成當日 23:59
  //   - start.date（全天）→ 只取起始日，start/end 留空＝無時段行程（沿用既有支援的形狀）
  function mapEventToTask(ev) {
    if (!ev || typeof ev !== 'object') return null;
    if (ev.status === 'cancelled') return null;
    const eventId = String(ev.id || '').trim();
    if (!eventId) return null;

    const startRaw = (ev.start && typeof ev.start === 'object') ? ev.start : {};
    const endRaw = (ev.end && typeof ev.end === 'object') ? ev.end : {};
    let date = '';
    let start = '';
    let end = '';

    if (startRaw.dateTime) {
      const startAt = new Date(startRaw.dateTime);
      if (Number.isNaN(startAt.getTime())) return null;
      date = toDateKey(startAt);
      start = toTimeStr(startAt);
      if (endRaw.dateTime) {
        const endAt = new Date(endRaw.dateTime);
        if (!Number.isNaN(endAt.getTime())) {
          end = toDateKey(endAt) === date ? toTimeStr(endAt) : '23:59';
        }
      }
      if (end && end <= start) end = start < '23:59' ? bumpMinute(start) : '';
    } else if (startRaw.date) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(startRaw.date)) return null;
      date = startRaw.date;
    } else {
      return null;
    }

    const noteParts = [];
    const location = String(ev.location || '').trim();
    const description = String(ev.description || '').trim();
    if (location) noteParts.push(`地點：${location}`);
    if (description) noteParts.push(description);
    noteParts.push('（由 Google 日曆匯入，唯讀）');

    const title = String(ev.summary || '').trim() || '(無標題活動)';
    const nowMs = Date.now();

    return {
      id: GCAL_ID_PREFIX + eventId,
      title,
      date,
      start,
      end,
      priority: 'medium',
      category: GCAL_CATEGORY,
      calendarId: 'default',
      color: null,
      location,
      timezone: null,
      repeat: 'none',
      repeatInterval: 2,
      repeatWeekday: 0,
      repeatNth: 1,
      reminder: -1, // 匯入行程一律不提醒，避免一次匯入幾百筆就灌爆通知
      pinned: false,
      countdown: false,
      shared: false,
      tags: [],
      subtasks: [],
      note: noteParts.join('\n').slice(0, 2000),
      dependsOn: [],
      completedDates: [],
      excludedDates: [],
      repeatUntil: '',
      attachmentCount: 0,
      sortOrder: nowMs,
      createdAt: new Date(nowMs).toISOString(),
      updatedAt: nowMs,
      source: 'gcal', // 唯讀判斷的唯一依據；openTaskDialog／拖曳／勾選完成都認這個欄位
      gcalId: eventId,
      gcalLink: String(ev.htmlLink || ''),
    };
  }

  // ---- 網路：Calendar API（只讀 events.list，無任何寫入端點）----

  async function fetchEvents(token, timeMin, timeMax) {
    const collected = [];
    let pageToken = '';
    for (let page = 0; page < MAX_PAGES; page++) {
      const params = new URLSearchParams({
        timeMin,
        timeMax,
        singleEvents: 'true', // 把重複活動展開成一筆一筆的實例，比自行翻譯 RRULE 可靠
        orderBy: 'startTime',
        maxResults: '250',
        showDeleted: 'false',
      });
      if (pageToken) params.set('pageToken', pageToken);
      const res = await fetch(`${GCAL_API}?${params.toString()}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.status === 401 || res.status === 403) {
        const err = new Error('Google 日曆授權失效');
        err.code = 'unauthorized';
        throw err;
      }
      if (!res.ok) throw new Error(`Google Calendar API ${res.status}`);
      const data = await res.json();
      if (Array.isArray(data.items)) collected.push(...data.items);
      pageToken = data.nextPageToken || '';
      if (!pageToken || collected.length >= MAX_EVENTS) break;
    }
    return collected.slice(0, MAX_EVENTS);
  }

  // ---- 主流程 ----

  async function importNow() {
    if (importing) return;
    const app = (typeof window === 'object' && window) ? window.CalendarApp : null;
    if (!app || typeof app.replaceGcalTasks !== 'function') {
      toast('匯入功能尚未就緒，請重新整理頁面');
      return;
    }
    const state = loadState();
    const token = String(state.providerToken || '').trim();
    if (!token) {
      toast('尚未取得 Google 日曆授權：請先在上方「登出」後再用 Google 登入一次');
      return;
    }
    const preset = (gcalEls.rangeSelect && gcalEls.rangeSelect.value) || state.range || DEFAULT_RANGE;
    saveState({ range: preset });

    importing = true;
    setBusy(true);
    try {
      const { timeMin, timeMax } = computeRange(preset, new Date());
      const events = await fetchEvents(token, timeMin, timeMax);
      const mapped = events.map(mapEventToTask).filter(Boolean);
      const result = app.replaceGcalTasks(mapped);
      saveState({ lastImportAt: Date.now(), lastCount: result.imported, range: preset });
      toast(`已匯入 ${result.imported} 筆 Google 日曆活動${result.removed ? `，清掉 ${result.removed} 筆過期匯入` : ''}`);
    } catch (err) {
      if (err && err.code === 'unauthorized') {
        clearProviderToken();
        toast('Google 日曆授權已過期，請登出後重新用 Google 登入');
      } else {
        console.warn('[gcal] 匯入失敗', err);
        toast(`匯入失敗：${(err && err.message) || '未知錯誤'}`);
      }
    } finally {
      importing = false;
      setBusy(false);
      updateUI();
    }
  }

  // ---- UI ----

  function setBusy(busy) {
    if (!gcalEls.importBtn) return;
    gcalEls.importBtn.disabled = busy;
    gcalEls.importBtn.textContent = busy ? '匯入中…' : '匯入 Google 日曆';
  }

  function updateUI() {
    if (!gcalEls.status) return;
    const state = loadState();
    const preset = (gcalEls.rangeSelect && gcalEls.rangeSelect.value) || state.range || DEFAULT_RANGE;
    if (!state.providerToken) {
      gcalEls.status.textContent = '尚未授權 Google 日曆。登出後重新用 Google 登入，即可取得唯讀日曆權限。';
      return;
    }
    const last = state.lastImportAt
      ? `上次匯入：${new Date(state.lastImportAt).toLocaleString('zh-TW')}（${state.lastCount || 0} 筆）`
      : '尚未匯入過。';
    gcalEls.status.textContent = `${last} 目前區間：${rangeLabel(preset)}。`;
  }

  function toast(message) {
    if (typeof window === 'object' && window.CalendarApp && typeof window.CalendarApp.showToast === 'function') {
      window.CalendarApp.showToast(message);
    } else {
      console.log('[gcal]', message);
    }
  }

  // 對外介面：sync.js 交 provider_token 進來，tests.html 測純函式。
  if (typeof window === 'object' && window) {
    window.CalendarGCal = {
      GCAL_SCOPE: 'https://www.googleapis.com/auth/calendar.readonly',
      RANGE_PRESETS,
      DEFAULT_RANGE,
      storeProviderToken,
      clearProviderToken,
      shiftMonths,
      computeRange,
      mapEventToTask,
      importNow,
    };
  }
})();
