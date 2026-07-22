// ----------------------------------------------------------------------------
// 找空檔：純函式 findNextFreeSlot() 在「該日工作時間範圍」（appSettings.workStart~workEnd，
// 設定 dialog 可調整，預設 7~21 點）內，找第一個長度足夠塞下 durationMinutes 的空隙。
// 只看當天有 start/end 的行程（occursOnDate 判斷含重複行程），忽略全天（無時間）行程。
// 找不到回傳 null；handleFindSlotClick() 負責串表單欄位、往後最多找 7 天、跳日期＋toast。
// ----------------------------------------------------------------------------
function findNextFreeSlot(dateKey, durationMinutes) {
  const duration = Math.max(1, Math.round(Number(durationMinutes)) || 60);
  const dayStartMin = clampHour(appSettings.workStart, 0, 23) * 60;
  const dayEndMin = Math.max(dayStartMin, clampHour(appSettings.workEnd, 1, 24) * 60);

  const busy = tasks
    .filter((task) => task.start && task.end && occursOnDate(task, dateKey))
    .map((task) => ({ start: timeToMinutes(task.start), end: timeToMinutes(task.end) }))
    .filter((block) => block.end > block.start)
    .sort((a, b) => a.start - b.start);

  let cursor = dayStartMin;
  for (const block of busy) {
    if (block.start > cursor && block.start - cursor >= duration) {
      return { start: minutesToTime(cursor), end: minutesToTime(cursor + duration) };
    }
    if (block.end > cursor) cursor = block.end;
  }
  if (dayEndMin - cursor >= duration) {
    return { start: minutesToTime(cursor), end: minutesToTime(cursor + duration) };
  }
  return null;
}

function handleFindSlotClick() {
  const startVal = els.taskStart.value;
  const endVal = els.taskEnd.value;
  const duration = (startVal && endVal && timeToMinutes(endVal) > timeToMinutes(startVal))
    ? timeToMinutes(endVal) - timeToMinutes(startVal)
    : 60;

  let searchBase = els.taskDate.value ? new Date(`${els.taskDate.value}T00:00:00`) : new Date(currentDate);
  if (Number.isNaN(searchBase.getTime())) searchBase = new Date(currentDate);

  for (let i = 0; i < 7; i++) {
    const dateKey = toDateInput(addDays(searchBase, i));
    const slot = findNextFreeSlot(dateKey, duration);
    if (slot) {
      els.taskDate.value = dateKey;
      els.taskStart.value = slot.start;
      els.taskEnd.value = slot.end;
      updateConflictWarning();
      showToast(i === 0
        ? `已填入 ${slot.start}–${slot.end}`
        : `${formatMonthDay(new Date(`${dateKey}T00:00:00`))} 有空檔，已填入 ${slot.start}–${slot.end}`);
      return;
    }
  }
  showToast('未來 7 天都沒有足夠空檔');
}

// 提醒延後持久化表的存取小工具，key 格式見 SNOOZE_KEY 註解。
function loadSnoozeTable() {
  return loadJson(SNOOZE_KEY, {});
}

function saveSnoozeRecord(taskId, dateKey, until) {
  const table = loadSnoozeTable();
  table[`${taskId}|${dateKey}`] = until;
  saveJson(SNOOZE_KEY, table);
}

function removeSnoozeRecord(taskId, dateKey) {
  const table = loadSnoozeTable();
  const key = `${taskId}|${dateKey}`;
  if (key in table) {
    delete table[key];
    saveJson(SNOOZE_KEY, table);
  }
}

// 頁面重開（原本記憶體 setTimeout 已消失）後，checkReminders() 每輪開頭都會補跑這裡：
// (a) 已到期的延後項目→立即補發通知並從表中刪除；(b) 到期超過 24 小時的殘留（分頁長時間
// 沒開）直接清掉不補發，避免一開頁面被舊提醒洗版。已完成的行程不補發。
function processSnoozeTable(now) {
  const table = loadSnoozeTable();
  let changed = false;
  Object.keys(table).forEach((key) => {
    const sepIndex = key.lastIndexOf('|');
    if (sepIndex < 0) { delete table[key]; changed = true; return; }
    const taskId = key.slice(0, sepIndex);
    const dateKey = key.slice(sepIndex + 1);
    const until = Number(table[key]);
    if (!Number.isFinite(until) || now.getTime() >= until + SNOOZE_STALE_MS) {
      delete table[key];
      changed = true;
      return;
    }
    if (now.getTime() < until) return;
    delete table[key];
    changed = true;
    const task = tasks.find((item) => item.id === taskId);
    if (task && !isTaskDone(task, dateKey)) {
      showTaskNotification(task, dateKey, `行程提醒：${task.title}`, `${task.reminder ? `${task.reminder} 分鐘後` : '現在'}開始｜${task.category}`);
    }
  });
  if (changed) saveJson(SNOOZE_KEY, table);
}

function checkReminders() {
  const now = new Date();
  const nowKey = toDateInput(now);

  processSnoozeTable(now);

  tasks.forEach((task) => {
    if (task.reminder < 0 || isTaskDone(task, nowKey) || !occursOnDate(task, nowKey)) return;
    const startAt = new Date(`${nowKey}T${task.start}:00`);
    const remindAt = new Date(startAt.getTime() - Number(task.reminder || 0) * 60 * 1000);
    const notificationId = `${task.id}-${nowKey}-${task.reminder}`;

    if (now >= remindAt && now <= new Date(remindAt.getTime() + 60 * 1000) && !notifiedTaskIds.has(notificationId)) {
      notifiedTaskIds.add(notificationId);
      showTaskNotification(task, nowKey, `行程提醒：${task.title}`, `${task.reminder ? `${task.reminder} 分鐘後` : '現在'}開始｜${task.category}`);
    }
  });
}

function notify(title, body) {
  if (!('Notification' in window) || Notification.permission !== 'granted') {
    showToast(`${title}｜${body}`);
    return;
  }
  try {
    const icon = './icons/icon-192.png';
    if (swRegistration && typeof swRegistration.showNotification === 'function') {
      swRegistration.showNotification(title, { body, icon, badge: icon }).catch(() => showToast(`${title}｜${body}`));
    } else {
      new Notification(title, { body, icon });
    }
  } catch {
    showToast(`${title}｜${body}`);
  }
}

// 行程提醒專用通知：有 Service Worker registration（且非 file:// 本機雙擊開啟）時，
// 帶「✔ 完成」「⏰ 延後10分鐘」互動按鈕，點擊由 service-worker.js 的 notificationclick
// 轉發回頁面（NOTIFICATION_ACTION postMessage）交給 handleNotificationAction() 處理。
// 沒有 SW 或 file:// 情境 fallback 既有 notify()（無按鈕，行為與升級前完全一致）。
function showTaskNotification(task, dateKey, title, body) {
  const canUseSw = !!(navigator.serviceWorker && typeof navigator.serviceWorker.getRegistration === 'function') && location.protocol !== 'file:';
  if (!canUseSw) {
    notify(title, body);
    return;
  }
  if (!('Notification' in window) || Notification.permission !== 'granted') {
    showToast(`${title}｜${body}`);
    return;
  }
  const icon = './icons/icon-192.png';
  navigator.serviceWorker.getRegistration()
    .then((registration) => {
      if (!registration || typeof registration.showNotification !== 'function') {
        notify(title, body);
        return;
      }
      return registration.showNotification(title, {
        body,
        icon,
        badge: icon,
        actions: [
          { action: 'done', title: '✔ 完成' },
          { action: 'snooze', title: '⏰ 延後10分鐘' },
        ],
        data: { kind: 'reminder', taskId: task.id, dateKey },
      }).catch(() => notify(title, body));
    })
    .catch(() => notify(title, body));
}

// 通知互動按鈕（✔ 完成／⏰ 延後10分鐘）的共用處理：由 service-worker.js 的
// notificationclick 透過 postMessage(NOTIFICATION_ACTION) 轉發過來，或頁面被喚醒開新視窗時
// 從 ?notifAction= query 讀到。'完成' 直接重用既有打勾完成的邏輯（setTaskDone + 音效 + render，
// render() 內含 saveJson，不會漏存檔）；'延後' 用 Map 記 timer，重複延後同一筆會先取消舊的。
function handleNotificationAction(action, taskId, dateKey) {
  const task = tasks.find((item) => item.id === taskId);
  if (!task) return;
  const timerKey = `${taskId}-${dateKey}`;

  if (action === 'done') {
    if (reminderSnoozeTimers.has(timerKey)) {
      clearTimeout(reminderSnoozeTimers.get(timerKey));
      reminderSnoozeTimers.delete(timerKey);
    }
    removeSnoozeRecord(taskId, dateKey);
    setTaskDone(task, dateKey, true);
    playDoneSound();
    render();
    showToast(`已完成：${task.title}`);
  } else if (action === 'snooze') {
    if (reminderSnoozeTimers.has(timerKey)) clearTimeout(reminderSnoozeTimers.get(timerKey));
    const timer = setTimeout(() => {
      reminderSnoozeTimers.delete(timerKey);
      removeSnoozeRecord(taskId, dateKey);
      showTaskNotification(task, dateKey, `行程提醒：${task.title}`, `${task.reminder ? `${task.reminder} 分鐘後` : '現在'}開始｜${task.category}`);
    }, 10 * 60 * 1000);
    reminderSnoozeTimers.set(timerKey, timer);
    saveSnoozeRecord(taskId, dateKey, Date.now() + 10 * 60 * 1000);
    showToast('10 分鐘後再提醒');
  }
}

// 通知按鈕在沒有開啟中的視窗時，service-worker.js 會 openWindow('./?notifAction=...')，
// 這裡接住 query 走 handleNotificationAction()，處理完清網址避免重整重複觸發，
// 用法仿照上面的 handleUrlShortcutAction()。
function handleNotifUrlAction() {
  const params = new URLSearchParams(window.location.search);
  const action = params.get('notifAction');
  const taskId = params.get('taskId');
  const dateKey = params.get('dateKey');
  if (!action || !taskId || !dateKey) return;

  handleNotificationAction(action, taskId, dateKey);
  history.replaceState(null, '', window.location.pathname);
}

function requestNotificationPermission(manual = false) {
  if (!('Notification' in window)) {
    if (manual) showToast('此瀏覽器不支援系統通知，將改用頁面內提示');
    return;
  }
  if (Notification.permission === 'granted') {
    if (manual) showToast('通知已開啟');
    updateNotificationButton();
    return;
  }
  if (Notification.permission === 'denied') {
    if (manual) showToast('通知權限已被封鎖，請至瀏覽器設定重新開啟');
    updateNotificationButton();
    return;
  }
  if (!manual && Notification.permission !== 'default') return;
  Notification.requestPermission()
    .then((permission) => {
      if (manual) showToast(permission === 'granted' ? '通知已開啟' : '未開啟通知，將改用頁面內提示');
      updateNotificationButton();
    })
    .catch(() => {
      if (manual) showToast('無法要求通知權限，將改用頁面內提示');
    });
}

function updateNotificationButton() {
  if (!els.enableNotificationsBtn) return;
  if (!('Notification' in window)) {
    els.enableNotificationsBtn.textContent = '🔕 不支援通知';
    els.enableNotificationsBtn.classList.remove('active-mode');
    return;
  }
  const permission = Notification.permission;
  els.enableNotificationsBtn.textContent = permission === 'granted' ? '🔔 通知已開啟' : (permission === 'denied' ? '🔕 通知已封鎖' : '🔔 開啟通知');
  els.enableNotificationsBtn.classList.toggle('active-mode', permission === 'granted');
}

function exportCsv() {
  const statusDate = toDateInput(currentDate);
  const headers = ['日期', '開始', '結束', '事項', '分類', '優先順序', '狀態', '置頂', '重複', '提醒分鐘', '標籤', '子任務', '備註'];
  const rows = tasks.filter((task) => !task.deletedAt).sort(compareTasks).map((task) => [
    task.date,
    task.start,
    task.end,
    task.title,
    task.category,
    priorityLabel[task.priority],
    isTaskDone(task, statusDate) ? '完成' : '未完成',
    task.pinned ? '是' : '否',
    repeatDisplayLabel(task),
    task.reminder < 0 ? '不提醒' : task.reminder,
    (task.tags || []).map((tag) => `#${tag}`).join('｜'),
    (task.subtasks || []).join('｜'),
    task.note,
  ]);
  const csv = [headers, ...rows].map((row) => row.map(csvCell).join(',')).join('\n');
  downloadText(`行程表-${toDateInput(new Date())}.csv`, '\ufeff' + csv, 'text/csv;charset=utf-8;');
}

// 產生等同「備份」匯出的完整資料物件。單一真相：exportBackup()（存檔用）與
// sync.js 的 cloudPush()（雲端同步用）都呼叫這個函式，避免備份格式在兩處各自漂移。
function buildBackupPayload() {
  return {
    version: 8,
    exportedAt: new Date().toISOString(),
    tasks,
    habits,
    categories,
    calendars,
    textSettings,
    appSettings,
    dailyMemos,
    templates,
    weeklyGoals,
    widgetMode,
    theme: localStorage.getItem(THEME_KEY) || 'light',
  };
}

// 備份加密輔助：base64 <-> ArrayBuffer 自寫小工具（file:// 下不依賴任何額外套件）。
function arrayBufferToBase64(buffer) {
  const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
}

function base64ToArrayBuffer(base64) {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

// 用密碼加密備份 JSON 字串：PBKDF2(SHA-256, 150000 次) 導出 AES-GCM 256 金鑰，
// salt(16B)/iv(12B) 隨機產生並隨密文一起輸出（都是 base64），供 decryptBackupJson() 還原用。
async function encryptBackupJson(text, password) {
  const enc = new TextEncoder();
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const keyMaterial = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveKey']);
  const key = await crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt, iterations: 150000, hash: 'SHA-256' },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt']
  );
  const cipherBuf = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, enc.encode(text));
  return {
    encryptedBackup: true,
    v: 1,
    salt: arrayBufferToBase64(salt),
    iv: arrayBufferToBase64(iv),
    data: arrayBufferToBase64(cipherBuf),
  };
}

// 解密 encryptBackupJson() 產生的物件，密碼錯誤或資料損壞時 AES-GCM 驗證失敗會直接 throw，
// 呼叫端（importBackup）負責 catch 並顯示「密碼錯誤或檔案損壞」。
async function decryptBackupJson(obj, password) {
  const salt = base64ToArrayBuffer(obj.salt);
  const iv = base64ToArrayBuffer(obj.iv);
  const data = base64ToArrayBuffer(obj.data);
  const enc = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveKey']);
  const key = await crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt, iterations: 150000, hash: 'SHA-256' },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['decrypt']
  );
  const plainBuf = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, data);
  return new TextDecoder().decode(plainBuf);
}

async function exportBackup() {
  const payload = buildBackupPayload();
  const jsonText = JSON.stringify(payload, null, 2);
  const dateStr = toDateInput(new Date());
  // file:// 下 crypto.subtle 可能不存在：偵測不到就完全跳過密碼流程，直接走原本未加密下載。
  if (window.crypto?.subtle) {
    const password = prompt('設定備份密碼（留空＝不加密）');
    if (password) {
      const encrypted = await encryptBackupJson(jsonText, password);
      downloadText(`行程表備份-${dateStr}.enc.json`, JSON.stringify(encrypted), 'application/json;charset=utf-8;');
      return;
    }
  }
  downloadText(`行程表備份-${dateStr}.json`, jsonText, 'application/json;charset=utf-8;');
}

// 套用一份備份物件（等同「還原」的流程）。單一真相：importBackup()（讀檔還原用）與
// sync.js 從雲端 pull 到較新資料時都呼叫這個函式。不在這裡顯示 toast，交給呼叫端決定文字。
function applyBackupObject(data) {
  data = data && typeof data === 'object' ? data : {};
  tasks = Array.isArray(data.tasks) ? data.tasks : [];
  habits = Array.isArray(data.habits) ? data.habits : [];
  categories = Array.isArray(data.categories) && data.categories.length ? data.categories : defaultCategories;
  calendars = Array.isArray(data.calendars) && data.calendars.length ? data.calendars : defaultCalendars;
  textSettings = { ...defaultTextSettings, ...(data.textSettings || {}) };
  appSettings = { ...defaultAppSettings, ...(data.appSettings || {}) };
  dailyMemos = data.dailyMemos && typeof data.dailyMemos === 'object' ? data.dailyMemos : {};
  templates = Array.isArray(data.templates) && data.templates.length ? data.templates : defaultTemplates;
  weeklyGoals = Array.isArray(data.weeklyGoals) ? data.weeklyGoals : [];
  widgetMode = Boolean(data.widgetMode);
  // 'auto' 是新增的存值，舊備份沒有這個值也沒關係：不合法值一律不覆寫，交給 applyTheme() 內的
  // getStoredThemeMode() 用既有值或預設 'light' 處理。
  if (data.theme === 'light' || data.theme === 'dark' || data.theme === 'auto') localStorage.setItem(THEME_KEY, data.theme);
  normalizeStoredData();
  saveJson(STORAGE_KEY, tasks);
  saveJson(HABIT_KEY, habits);
  saveJson(CATEGORY_KEY, categories);
  saveJson(CALENDAR_KEY, calendars);
  saveJson(TEXT_KEY, textSettings);
  saveJson(APP_SETTINGS_KEY, appSettings);
  saveJson(MEMO_KEY, dailyMemos);
  saveJson(TEMPLATE_KEY, templates);
  saveJson(WEEKLY_GOAL_KEY, weeklyGoals);
  localStorage.setItem(WIDGET_KEY, widgetMode ? '1' : '0');
  document.body.classList.toggle('widget-mode', widgetMode);
  applyTheme();
  applyTextSettings();
  render();
}

function importBackup(event) {
  const file = event.target.files?.[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = async () => {
    try {
      const data = JSON.parse(reader.result);
      if (data && data.encryptedBackup === true) {
        const password = prompt('此備份已加密，請輸入密碼');
        if (password === null) return; // 取消 → 中止
        let decryptedText;
        try {
          decryptedText = await decryptBackupJson(data, password);
        } catch {
          showToast('密碼錯誤或檔案損壞');
          return;
        }
        applyBackupObject(JSON.parse(decryptedText));
        showToast('備份已還原');
        return;
      }
      applyBackupObject(data);
      showToast('備份已還原');
    } catch {
      showToast('還原失敗：檔案格式不正確');
    } finally {
      els.restoreFileInput.value = '';
    }
  };
  reader.readAsText(file, 'utf-8');
}

function exportIcs() {
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//桌面行程表//zh-TW//',
    'CALSCALE:GREGORIAN',
  ];
  tasks.filter((task) => !task.deletedAt).forEach((task) => {
    if (task.repeat === 'lunar-yearly') {
      pushLunarYearlyIcsEvents(lines, task);
      return;
    }
    lines.push('BEGIN:VEVENT');
    lines.push(`UID:${task.id}@desktop-schedule`);
    lines.push(`DTSTAMP:${toIcsUtcDateTime(new Date())}`);
    lines.push(`DTSTART:${toIcsLocalDateTime(task.date, task.start)}`);
    lines.push(`DTEND:${toIcsLocalDateTime(task.date, task.end)}`);
    lines.push(`SUMMARY:${icsEscape(task.title)}`);
    if (task.note) lines.push(`DESCRIPTION:${icsEscape(task.note)}`);
    if (task.category) lines.push(`CATEGORIES:${icsEscape(task.category)}`);
    const rrule = buildRRule(task);
    if (rrule) lines.push(`RRULE:${rrule}`);
    lines.push('END:VEVENT');
  });
  lines.push('END:VCALENDAR');
  downloadText(`行程表-${toDateInput(new Date())}.ics`, lines.join('\r\n'), 'text/calendar;charset=utf-8;');
  showToast('已匯出 .ics 檔');
}

function buildRRule(task) {
  switch (task.repeat) {
    case 'daily': return 'FREQ=DAILY';
    case 'weekly': return 'FREQ=WEEKLY';
    case 'monthly': return 'FREQ=MONTHLY';
    case 'interval': return `FREQ=DAILY;INTERVAL=${Math.max(2, Math.floor(Number(task.repeatInterval) || 2))}`;
    case 'weekdays': return 'FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR';
    case 'monthlyNth': {
      const nth = Number(task.repeatNth) || 1;
      const weekday = WEEKDAY_ICS[Number(task.repeatWeekday) || 0];
      return `FREQ=MONTHLY;BYDAY=${nth}${weekday}`;
    }
    // 'lunar-yearly'：標準 RRULE 無法表達「依農曆日期每年重複」，故不產生 RRULE，
    // 改由 exportIcs() 的 pushLunarYearlyIcsEvents() 展開成多個獨立 VEVENT。
    case 'lunar-yearly': return '';
    default: return '';
  }
}

// 農曆每年重複行程無法用標準 RRULE 表達，改為展開「從 task.date 起未來 5 年」內
// 每年實際發生的國曆日期：逐日掃描並重用既有 occursOnDate() 判斷是否發生（excludedDates
// 天然被排除），每個發生日各輸出一個 VEVENT，UID 加日期後綴確保跨事件唯一。
function pushLunarYearlyIcsEvents(lines, task) {
  const base = startOfDay(new Date(`${task.date}T00:00:00`));
  const endDate = addDays(base, 5 * 366);
  const dtstamp = toIcsUtcDateTime(new Date());
  let cursor = base;
  while (cursor <= endDate) {
    const dateKey = toDateInput(cursor);
    if (occursOnDate(task, dateKey)) {
      lines.push('BEGIN:VEVENT');
      lines.push(`UID:${task.id}-${dateKey}@calendar`);
      lines.push(`DTSTAMP:${dtstamp}`);
      lines.push(`DTSTART:${toIcsLocalDateTime(dateKey, task.start)}`);
      lines.push(`DTEND:${toIcsLocalDateTime(dateKey, task.end)}`);
      lines.push(`SUMMARY:${icsEscape(task.title)}`);
      if (task.note) lines.push(`DESCRIPTION:${icsEscape(task.note)}`);
      if (task.category) lines.push(`CATEGORIES:${icsEscape(task.category)}`);
      lines.push('END:VEVENT');
    }
    cursor = addDays(cursor, 1);
  }
}

function toIcsLocalDateTime(dateStr, timeStr) {
  return `${String(dateStr).replaceAll('-', '')}T${String(timeStr).replace(':', '')}00`;
}

function toIcsUtcDateTime(date) {
  const pad = (n) => String(n).padStart(2, '0');
  return `${date.getUTCFullYear()}${pad(date.getUTCMonth() + 1)}${pad(date.getUTCDate())}T${pad(date.getUTCHours())}${pad(date.getUTCMinutes())}${pad(date.getUTCSeconds())}Z`;
}

function icsEscape(text) {
  return String(text ?? '')
    .replaceAll('\\', '\\\\')
    .replaceAll(';', '\\;')
    .replaceAll(',', '\\,')
    .replaceAll('\n', '\\n');
}

function icsUnescape(text) {
  return String(text ?? '')
    .replaceAll('\\n', '\n')
    .replaceAll('\\,', ',')
    .replaceAll('\\;', ';')
    .replaceAll('\\\\', '\\');
}

function importIcs(event) {
  const file = event.target.files?.[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const text = String(reader.result).replace(/\r\n/g, '\n').replace(/\n[ \t]/g, '');
      const blocks = text.split('BEGIN:VEVENT').slice(1).map((block) => block.split('END:VEVENT')[0]);
      let imported = 0;
      let skipped = 0;
      blocks.forEach((block) => {
        const task = parseIcsEvent(block);
        if (task) { tasks.push(task); imported += 1; } else { skipped += 1; }
      });
      if (imported) {
        saveJson(STORAGE_KEY, tasks);
        render();
      }
      showToast(imported ? `已匯入 ${imported} 筆行程${skipped ? `，跳過 ${skipped} 筆無法解析` : ''}` : '沒有可匯入的行程');
    } catch {
      showToast('匯入失敗：檔案格式不正確');
    } finally {
      els.importIcsFileInput.value = '';
    }
  };
  reader.readAsText(file, 'utf-8');
}

function parseIcsEvent(block) {
  const lines = block.split('\n').map((line) => line.trim()).filter(Boolean);
  const props = {};
  lines.forEach((line) => {
    const idx = line.indexOf(':');
    if (idx === -1) return;
    const rawKey = line.slice(0, idx);
    const value = line.slice(idx + 1);
    const key = rawKey.split(';')[0].toUpperCase();
    props[key] = { value, params: rawKey };
  });

  const summary = props.SUMMARY ? icsUnescape(props.SUMMARY.value) : '';
  if (!summary || !props.DTSTART) return null;

  const startInfo = parseIcsDateTime(props.DTSTART.value, props.DTSTART.params);
  if (!startInfo) return null;

  const endInfo = props.DTEND ? parseIcsDateTime(props.DTEND.value, props.DTEND.params) : null;
  const date = startInfo.date;
  const start = startInfo.allDay ? '00:00' : startInfo.time;
  let end = endInfo && !endInfo.allDay ? endInfo.time : (startInfo.allDay ? '23:59' : addMinutesToTime(start, 30));
  if (end <= start) end = addMinutesToTime(start, 30);

  const task = {
    id: crypto.randomUUID(),
    title: summary,
    date,
    start,
    end,
    priority: 'medium',
    category: categories[0]?.name || '工作',
    repeat: 'none',
    repeatInterval: 2,
    repeatWeekday: new Date(`${date}T00:00:00`).getDay(),
    repeatNth: 1,
    reminder: 10,
    pinned: false,
    countdown: false,
    tags: [],
    subtasks: [],
    note: props.DESCRIPTION ? icsUnescape(props.DESCRIPTION.value) : '',
    completedDates: [],
    excludedDates: [],
    sortOrder: Date.now(),
    createdAt: new Date().toISOString(),
    updatedAt: Date.now(),
  };

  if (props.RRULE) applyRRuleToTask(task, props.RRULE.value);

  return task;
}

function parseIcsDateTime(value, paramsStr) {
  const isDateOnly = /VALUE=DATE\b/i.test(paramsStr || '') || /^\d{8}$/.test(value);
  const digits = value.replace('Z', '');
  const match = digits.match(/^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2})?)?$/);
  if (!match) return null;
  const [, y, mo, d, h, mi] = match;
  const date = `${y}-${mo}-${d}`;
  if (isDateOnly || h === undefined) return { date, allDay: true };
  return { date, allDay: false, time: `${h}:${mi}` };
}

function applyRRuleToTask(task, rruleStr) {
  const parts = {};
  rruleStr.split(';').forEach((pair) => {
    const [key, value] = pair.split('=');
    if (key && value) parts[key.toUpperCase()] = value;
  });
  const freq = parts.FREQ;
  const interval = Number(parts.INTERVAL) || 1;
  const byday = parts.BYDAY;

  if (freq === 'DAILY') {
    if (interval > 1) {
      task.repeat = 'interval';
      task.repeatInterval = interval;
    } else {
      task.repeat = 'daily';
    }
  } else if (freq === 'WEEKLY') {
    const days = byday ? byday.split(',').map((d) => d.trim()).filter(Boolean).sort().join(',') : '';
    if (days === ['FR', 'MO', 'TH', 'TU', 'WE'].sort().join(',')) task.repeat = 'weekdays';
    else task.repeat = 'weekly';
  } else if (freq === 'MONTHLY') {
    const match = byday ? byday.match(/^(-?\d+)([A-Z]{2})$/) : null;
    if (match) {
      task.repeat = 'monthlyNth';
      task.repeatNth = [1, 2, 3, 4, -1].includes(Number(match[1])) ? Number(match[1]) : 1;
      const weekdayIndex = WEEKDAY_ICS.indexOf(match[2]);
      task.repeatWeekday = weekdayIndex >= 0 ? weekdayIndex : task.repeatWeekday;
    } else {
      task.repeat = 'monthly';
    }
  }
  // FREQ=YEARLY 等未支援的規則維持 'none'，以單次事件方式匯入。
}

function timeToMinutes(time) {
  const [h, m] = String(time).split(':').map(Number);
  return (Number(h) || 0) * 60 + (Number(m) || 0);
}

function minutesToTime(minutes) {
  const total = ((Math.round(minutes) % 1440) + 1440) % 1440;
  const hh = String(Math.floor(total / 60)).padStart(2, '0');
  const mm = String(total % 60).padStart(2, '0');
  return `${hh}:${mm}`;
}

function addMinutesToTime(time, minutes) {
  const [h, m] = time.split(':').map(Number);
  const total = ((h * 60 + m + minutes) % (24 * 60) + 24 * 60) % (24 * 60);
  const hh = String(Math.floor(total / 60)).padStart(2, '0');
  const mm = String(total % 60).padStart(2, '0');
  return `${hh}:${mm}`;
}

