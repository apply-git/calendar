// D4 行程時區換算 helper：wallTimeToEpoch(日期字串, 時間字串, IANA 時區) 反推「該時區牆上時間」
// 對應的實際時間戳（epoch ms）。標準做法：先假設目標牆上時間就是 UTC 時間戳當初始猜測，
// 用 Intl.DateTimeFormat 把猜測值格式化到目標時區、量出當下時區 offset，再用 offset 修正猜測值，
// 兩次疊代即可收斂（含 DST 換日邊界）。tz 為空／未傳時視為瀏覽器本地時區，直接用 Date 建構子。
function wallTimeToEpoch(dateStr, timeStr, tz) {
  if (!dateStr || !timeStr) return NaN;
  const [y, mo, d] = dateStr.split('-').map(Number);
  const [h, mi] = timeStr.split(':').map(Number);
  if (!Number.isFinite(y) || !Number.isFinite(mo) || !Number.isFinite(d) || !Number.isFinite(h) || !Number.isFinite(mi)) return NaN;
  if (!tz) return new Date(y, mo - 1, d, h, mi, 0, 0).getTime();
  const target = Date.UTC(y, mo - 1, d, h, mi, 0);
  const dtf = new Intl.DateTimeFormat('en-US', {
    timeZone: tz, hour12: false,
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  });
  const asUtcNumber = (epoch) => {
    const parts = dtf.formatToParts(new Date(epoch));
    const map = {};
    parts.forEach((part) => { if (part.type !== 'literal') map[part.type] = part.value; });
    // Intl 24 小時制邊界某些環境會回傳 "24" 代表隔天 00 點，這裡收斂成 0 避免 Date.UTC 誤算成下一天。
    const hour = map.hour === '24' ? 0 : Number(map.hour);
    return Date.UTC(Number(map.year), Number(map.month) - 1, Number(map.day), hour, Number(map.minute), Number(map.second));
  };
  let guess = target;
  for (let i = 0; i < 2; i++) {
    const offset = asUtcNumber(guess) - guess;
    guess = target - offset;
  }
  return guess;
}

// D4：把一個 epoch 時間戳格式化成指定時區的牆上日期/時間，供換算 badge 顯示與跨日判斷用。
// tz 為空時使用瀏覽器本地時區（Intl.DateTimeFormat 的 timeZone 傳 undefined 即代表本地）。
function formatInTz(epochMs, tz) {
  const dtf = new Intl.DateTimeFormat('en-US', {
    timeZone: tz || undefined, hour12: false,
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit',
  });
  const parts = dtf.formatToParts(new Date(epochMs));
  const map = {};
  parts.forEach((part) => { if (part.type !== 'literal') map[part.type] = part.value; });
  const hour = map.hour === '24' ? '00' : map.hour;
  return { date: `${map.year}-${map.month}-${map.day}`, time: `${hour}:${map.minute}` };
}

function applyTextSettings() {
  document.title = textSettings.appTitle;
  els.brandTitle.textContent = textSettings.appTitle;
  els.quickAddBtn.textContent = textSettings.addTaskText;
  els.topThreeHeading.textContent = textSettings.topThreeTitle;
  els.completionHeading.textContent = textSettings.completionTitle;
  els.habitHeading.textContent = textSettings.habitTitle;
  els.categoryHeading.textContent = textSettings.categoryTitle;
  els.searchLabel.textContent = textSettings.searchLabel;
  els.taskNameLabel.textContent = textSettings.taskNameLabel;
  els.taskTitle.placeholder = textSettings.defaultTaskPlaceholder;
}

function openSettingsDialog() {
  if (els.settingsDialog.open) return;
  els.settingAppTitle.value = textSettings.appTitle;
  els.settingAddTaskText.value = textSettings.addTaskText;
  els.settingTopThreeTitle.value = textSettings.topThreeTitle;
  els.settingCompletionTitle.value = textSettings.completionTitle;
  els.settingHabitTitle.value = textSettings.habitTitle;
  els.settingCategoryTitle.value = textSettings.categoryTitle;
  els.settingSearchLabel.value = textSettings.searchLabel;
  els.settingTaskNameLabel.value = textSettings.taskNameLabel;
  els.settingDefaultTaskPlaceholder.value = textSettings.defaultTaskPlaceholder;
  els.settingWorkStart.value = appSettings.workStart;
  els.settingWorkEnd.value = appSettings.workEnd;
  els.settingShowLunar.checked = appSettings.showLunar;
  els.settingsDialog.showModal();
  els.settingAppTitle.focus();
}

function closeSettingsDialog() {
  els.settingsDialog.close();
}

function saveTextSettingsFromForm(event) {
  event.preventDefault();
  textSettings = {
    appTitle: els.settingAppTitle.value.trim() || defaultTextSettings.appTitle,
    addTaskText: els.settingAddTaskText.value.trim() || defaultTextSettings.addTaskText,
    topThreeTitle: els.settingTopThreeTitle.value.trim() || defaultTextSettings.topThreeTitle,
    completionTitle: els.settingCompletionTitle.value.trim() || defaultTextSettings.completionTitle,
    habitTitle: els.settingHabitTitle.value.trim() || defaultTextSettings.habitTitle,
    categoryTitle: els.settingCategoryTitle.value.trim() || defaultTextSettings.categoryTitle,
    searchLabel: els.settingSearchLabel.value.trim() || defaultTextSettings.searchLabel,
    taskNameLabel: els.settingTaskNameLabel.value.trim() || defaultTextSettings.taskNameLabel,
    defaultTaskPlaceholder: els.settingDefaultTaskPlaceholder.value.trim() || defaultTextSettings.defaultTaskPlaceholder,
  };
  appSettings = {
    ...appSettings,
    workStart: clampHour(Number(els.settingWorkStart.value || defaultAppSettings.workStart), 0, 23),
    workEnd: clampHour(Number(els.settingWorkEnd.value || defaultAppSettings.workEnd), 1, 24),
    showLunar: els.settingShowLunar.checked,
  };
  if (appSettings.workEnd < appSettings.workStart) appSettings.workEnd = appSettings.workStart;
  saveJson(TEXT_KEY, textSettings);
  saveJson(APP_SETTINGS_KEY, appSettings);
  applyTextSettings();
  render();
  closeSettingsDialog();
  showToast('設定已儲存');
}

function resetTextSettings() {
  textSettings = { ...defaultTextSettings };
  saveJson(TEXT_KEY, textSettings);
  applyTextSettings();
  closeSettingsDialog();
  showToast('已恢復預設文字');
}

function addHabit() {
  const name = els.habitInput.value.trim();
  if (!name) return;
  habits.push({ id: crypto.randomUUID(), name, records: [] });
  els.habitInput.value = '';
  renderHabits();
}

function habitStreak(habit) {
  const records = new Set(habit.records || []);
  let streak = 0;
  let cursor = startOfDay(new Date());
  while (records.has(toDateInput(cursor))) {
    streak += 1;
    cursor = addDays(cursor, -1);
  }
  return streak;
}

function addCategory() {
  const name = els.categoryNameInput.value.trim();
  const color = els.categoryColorInput.value;
  if (!name) return showToast('請輸入分類名稱');
  if (categories.some((category) => category.name === name)) return showToast('分類已存在');
  categories.push({ name, color, system: false });
  els.categoryNameInput.value = '';
  saveJson(CATEGORY_KEY, categories);
  render();
  showToast('分類已新增');
}

function deleteCategory(name) {
  const inUse = tasks.some((task) => !task.deletedAt && task.category === name);
  if (inUse) return showToast('此分類已有行程使用，無法刪除');
  categories = categories.filter((category) => category.name !== name || category.system);
  saveJson(CATEGORY_KEY, categories);
  render();
  showToast('分類已刪除');
}

function getCategoryColor(name) {
  return categories.find((category) => category.name === name)?.color || '#4568f0';
}

// 日曆本 CRUD（比照上面分類管理的做法）：'default' 本不可刪除，刪除其他本時
// 該本所有行程 calendarId 歸回 'default'（走 touchTask 記錄異動時間）。
function addCalendar() {
  const name = els.calendarNameInput.value.trim();
  if (!name) return showToast('請輸入日曆本名稱');
  if (calendars.some((cal) => cal.name === name)) return showToast('日曆本已存在');
  const id = crypto.randomUUID();
  calendars.push({ id, name });
  appSettings.visibleCalendarIds = Array.isArray(appSettings.visibleCalendarIds)
    ? [...appSettings.visibleCalendarIds, id]
    : calendars.map((cal) => cal.id);
  els.calendarNameInput.value = '';
  saveJson(CALENDAR_KEY, calendars);
  saveJson(APP_SETTINGS_KEY, appSettings);
  renderCalendarManageList();
  renderCalendarVisibilityList();
  renderCalendarField();
  showToast('日曆本已新增');
}

function renameCalendar(id, name) {
  const cal = calendars.find((item) => item.id === id);
  if (!cal) return;
  const trimmed = (name || '').trim();
  if (!trimmed) { renderCalendarManageList(); return showToast('名稱不可空白'); }
  if (calendars.some((item) => item.id !== id && item.name === trimmed)) {
    renderCalendarManageList();
    return showToast('日曆本名稱已存在');
  }
  if (cal.name === trimmed) return;
  cal.name = trimmed;
  saveJson(CALENDAR_KEY, calendars);
  renderCalendarManageList();
  renderCalendarVisibilityList();
  renderCalendarField();
  render();
  showToast('日曆本已更名');
}

function deleteCalendar(id) {
  if (id === 'default') return showToast('預設日曆本無法刪除');
  const cal = calendars.find((item) => item.id === id);
  if (!cal) return;
  tasks.forEach((task) => {
    if (task.calendarId === id) {
      task.calendarId = 'default';
      touchTask(task);
    }
  });
  calendars = calendars.filter((item) => item.id !== id);
  if (Array.isArray(appSettings.visibleCalendarIds)) {
    appSettings.visibleCalendarIds = appSettings.visibleCalendarIds.filter((cid) => cid !== id);
  }
  saveJson(STORAGE_KEY, tasks);
  saveJson(CALENDAR_KEY, calendars);
  saveJson(APP_SETTINGS_KEY, appSettings);
  renderCalendarManageList();
  renderCalendarVisibilityList();
  renderCalendarField();
  render();
  showToast('日曆本已刪除，行程已歸回預設日曆本');
}

// 過濾用單一入口：appSettings.visibleCalendarIds 未設定（非陣列）時視為全部顯示，
// 比照 normalizeStoredData() 會補成明確陣列，這裡只是防禦性寫法。
function isCalendarVisible(calendarId) {
  const id = calendarId || 'default';
  return Array.isArray(appSettings.visibleCalendarIds) ? appSettings.visibleCalendarIds.includes(id) : true;
}

// 單筆行程色彩來源：task.color 有自訂值就優先用，否則退回分類色。所有畫面上「這筆行程要用什麼顏色」
// 都走這裡，避免各 render 點各自判斷 task.color / 分類色而漂移。
function getTaskColor(task) {
  return task.color || getCategoryColor(task.category);
}

function isTaskDone(task, dateKey) {
  if (Array.isArray(task.completedDates)) return task.completedDates.includes(dateKey);
  return Boolean(task.done);
}

function setTaskDone(task, dateKey, done) {
  task.completedDates = Array.isArray(task.completedDates) ? task.completedDates : [];
  task.completedDates = done
    ? [...new Set([...task.completedDates, dateKey])]
    : task.completedDates.filter((date) => date !== dateKey);
  delete task.done;
  touchTask(task);
}

// D3 任務依賴：回傳某筆行程「尚未完成的前置任務」清單（task.dependsOn 內、
// completedDates 未含自身 date 的行程）。供勾選完成擋下（handleCalendarChange）
// 與行程卡 🔗 badge（taskCard）共用，唯一判斷入口。
function getIncompleteDependencies(task) {
  if (!Array.isArray(task.dependsOn) || !task.dependsOn.length) return [];
  return task.dependsOn
    .map((depId) => tasks.find((item) => item.id === depId && !item.deletedAt))
    .filter(Boolean)
    .filter((dep) => !(dep.completedDates || []).includes(dep.date));
}

// 逐筆同步用的中央 helper：任何「使用者動作改變某筆 task 內容」都要呼叫 touchTask()
// 記錄最後修改時間；「真刪除」一律改叫 tombstoneTask() 留墓碑供之後雲端同步合併判斷，
// 不從 tasks 陣列真的移除（例外：fixDataIssues 對非法日期壞資料維持真刪除）。
function touchTask(task) {
  task.updatedAt = Date.now();
}

function tombstoneTask(task) {
  task.deletedAt = Date.now();
  touchTask(task);
  // 中央 helper：所有「使用者刪除行程」路徑（卡片刪除／對話框刪除／清除當天/週/月／
  // 清理舊行程）都經過這裡，一併清掉該行程在 IndexedDB 的附件本體。
  idbDeleteByTask(task.id);
  // D3 任務依賴：同步把這個已刪除行程的 id 從其他行程的 dependsOn 移除，
  // 避免依賴一個已刪除的前置任務導致永遠無法勾選完成。
  tasks.forEach((other) => {
    if (other.id === task.id || !Array.isArray(other.dependsOn) || !other.dependsOn.includes(task.id)) return;
    other.dependsOn = other.dependsOn.filter((id) => id !== task.id);
    touchTask(other);
  });
}

function habitStreak(habit) {
  if (!Array.isArray(habit.records)) return 0;
  let count = 0;
  let checkDate = new Date();
  while (true) {
    const dateKey = toDateInput(checkDate);
    if (!habit.records.includes(dateKey)) break;
    count++;
    checkDate = addDays(checkDate, -1);
  }
  return count;
}

function updateAppBadge() {
  try {
    if (!navigator.setAppBadge) return;
    const todayKey = toDateInput(new Date());
    let count = 0;
    for (const task of tasks) {
      if (occursOnDate(task, todayKey) && !isTaskDone(task, todayKey)) {
        count++;
      }
    }
    if (count > 0) {
      navigator.setAppBadge(count).catch(() => {});
    } else {
      navigator.clearAppBadge().catch(() => {});
    }
  } catch (err) {
    // Feature not available or failed, gracefully ignore
  }
}

function toggleTheme() {
  const order = ['light', 'dark', 'auto'];
  const next = order[(order.indexOf(getStoredThemeMode()) + 1) % order.length];
  localStorage.setItem(THEME_KEY, next);
  applyTheme();
  const labelMap = { light: '淺色', dark: '深色', auto: '自動(跟隨系統)' };
  showToast(`主題：${labelMap[next]}`);
}

function normalizeStoredData() {
  categories = mergeCategories(defaultCategories, categories);
  calendars = mergeCalendars(defaultCalendars, calendars);
  // D3 任務依賴：先收集目前存在（未被刪除墓碑）的 task id，供下面過濾 dependsOn 用，
  // 避免依賴一筆已不存在／已刪除的行程導致永遠卡在「前置未完成」。
  const existingTaskIds = new Set(tasks.filter((task) => !task.deletedAt).map((task) => task.id));
  tasks = tasks.map((task) => {
    const completedDates = Array.isArray(task.completedDates) ? task.completedDates : (task.done ? [task.date] : []);
    const categoryExists = categories.some((category) => category.name === task.category);
    const calendarExists = calendars.some((calendar) => calendar.id === task.calendarId);
    return {
      ...task,
      category: categoryExists ? task.category : categories[0].name,
      calendarId: calendarExists ? task.calendarId : 'default',
      completedDates,
      dependsOn: Array.isArray(task.dependsOn)
        ? task.dependsOn.filter((id) => id !== task.id && existingTaskIds.has(id))
        : [],
      pinned: Boolean(task.pinned),
      countdown: Boolean(task.countdown),
      shared: Boolean(task.shared),
      tags: Array.isArray(task.tags) ? task.tags.filter(Boolean) : [],
      subtasks: Array.isArray(task.subtasks) ? task.subtasks.filter(Boolean) : [],
      excludedDates: Array.isArray(task.excludedDates) ? task.excludedDates.filter(Boolean) : [],
      color: typeof task.color === 'string' && task.color ? task.color : null,
      location: typeof task.location === 'string' ? task.location : '',
      // D4 行程時區：IANA 字串或 null（=本地時區，不換算顯示）。
      timezone: typeof task.timezone === 'string' && task.timezone ? task.timezone : null,
      repeat: task.repeat || 'none',
      repeatInterval: Number.isFinite(Number(task.repeatInterval)) && Number(task.repeatInterval) > 0 ? Math.floor(Number(task.repeatInterval)) : 2,
      repeatWeekday: Number.isFinite(Number(task.repeatWeekday)) ? Math.min(6, Math.max(0, Math.floor(Number(task.repeatWeekday)))) : new Date(`${task.date}T00:00:00`).getDay(),
      repeatNth: [1, 2, 3, 4, -1].includes(Number(task.repeatNth)) ? Number(task.repeatNth) : 1,
      reminder: Number.isFinite(Number(task.reminder)) ? Number(task.reminder) : 10,
      originalSeriesId: typeof task.originalSeriesId === 'string' ? task.originalSeriesId : '',
      originalOccurrenceDate: typeof task.originalOccurrenceDate === 'string' ? task.originalOccurrenceDate : '',
      repeatUntil: typeof task.repeatUntil === 'string' ? task.repeatUntil : '',
      attachmentCount: Number.isFinite(Number(task.attachmentCount)) ? Math.max(0, Math.floor(Number(task.attachmentCount))) : 0,
      sortOrder: Number(task.sortOrder || 0),
      updatedAt: Number.isFinite(Number(task.updatedAt)) ? Number(task.updatedAt) : 0,
    };
  });
  // 刪除墓碑（tombstone）超過 90 天：保留期內留給雲端同步合併用，超過就視為
  // 沒有同步意義，真正從陣列移除，避免本機資料無限增長。這裡不是「使用者刪除」
  // 的路徑（tombstoneTask() 當下已經清過一次），但順手再清一次 IndexedDB 附件，
  // 涵蓋「墓碑是從雲端同步/還原備份帶進來、本機從未呼叫過 tombstoneTask()」的情況。
  const TOMBSTONE_RETENTION_MS = 90 * 24 * 60 * 60 * 1000;
  tasks
    .filter((task) => task.deletedAt && Date.now() - task.deletedAt > TOMBSTONE_RETENTION_MS)
    .forEach((task) => idbDeleteByTask(task.id));
  tasks = tasks.filter((task) => !(task.deletedAt && Date.now() - task.deletedAt > TOMBSTONE_RETENTION_MS));
  appSettings.workStart = clampHour(appSettings.workStart, 0, 23);
  appSettings.workEnd = Math.max(appSettings.workStart, clampHour(appSettings.workEnd, 1, 24));
  appSettings.showLunar = typeof appSettings.showLunar === 'boolean' ? appSettings.showLunar : true;
  appSettings.dayViewMode = appSettings.dayViewMode === 'timeline' ? 'timeline' : 'list';
  appSettings.autoSync = typeof appSettings.autoSync === 'boolean' ? appSettings.autoSync : false;
  // D4 旅行模式：IANA 字串或 null（=關閉，換算顯示改用裝置時區判斷是否需要 badge）。
  appSettings.travelTimezone = typeof appSettings.travelTimezone === 'string' && appSettings.travelTimezone ? appSettings.travelTimezone : null;
  // 可見日曆本集合：未設定（非陣列）才補成「全部顯示」；已是陣列（含使用者主動全部取消勾選
  // 的空陣列）一律尊重，只做「移除已刪除日曆本 id」的收斂，不覆寫使用者的選擇。
  const calendarIds = calendars.map((calendar) => calendar.id);
  appSettings.visibleCalendarIds = Array.isArray(appSettings.visibleCalendarIds)
    ? appSettings.visibleCalendarIds.filter((id) => calendarIds.includes(id))
    : calendarIds.slice();
}

function mergeCategories(base, saved) {
  const merged = [...base];
  (Array.isArray(saved) ? saved : []).forEach((category) => {
    if (!category?.name || merged.some((item) => item.name === category.name)) return;
    merged.push({ name: category.name, color: category.color || '#4568f0', system: Boolean(category.system) });
  });
  return merged;
}

function mergeCalendars(base, saved) {
  const merged = [...base];
  (Array.isArray(saved) ? saved : []).forEach((calendar) => {
    if (!calendar?.id || merged.some((item) => item.id === calendar.id)) return;
    merged.push({ id: calendar.id, name: calendar.name || '未命名日曆本' });
  });
  return merged;
}

function occursOnDate(task, dateKey) {
  if (task.deletedAt) return false;
  if (Array.isArray(task.excludedDates) && task.excludedDates.includes(dateKey)) return false;
  if (task.date === dateKey) return true;
  if (task.repeat === 'none') return false;

  const base = startOfDay(new Date(`${task.date}T00:00:00`));
  const target = startOfDay(new Date(`${dateKey}T00:00:00`));
  if (target < base) return false;
  if (task.repeatUntil) {
    const until = startOfDay(new Date(`${task.repeatUntil}T00:00:00`));
    if (target > until) return false;
  }

  if (task.repeat === 'daily') return true;
  if (task.repeat === 'weekly') return base.getDay() === target.getDay();
  if (task.repeat === 'monthly') return base.getDate() === target.getDate();
  if (task.repeat === 'interval') {
    const interval = Math.max(1, Math.floor(Number(task.repeatInterval) || 2));
    const diffDays = Math.round((target - base) / 86400000);
    return diffDays % interval === 0;
  }
  if (task.repeat === 'weekdays') {
    const day = target.getDay();
    return day >= 1 && day <= 5;
  }
  if (task.repeat === 'monthlyNth') {
    const weekday = Number.isFinite(Number(task.repeatWeekday)) ? Number(task.repeatWeekday) : base.getDay();
    if (target.getDay() !== weekday) return false;
    const nth = Number(task.repeatNth) || 1;
    if (nth === -1) return target.getDate() + 7 > daysInMonth(target);
    return nthWeekdayInMonth(target) === nth;
  }
  if (task.repeat === 'lunar-yearly') {
    // 農曆每年：把首次日期與目標日期都換算成農曆（月, 日），比對月日是否相同。
    // 目標日期若落在閏月，一律視為不匹配，避免閏月年同一農曆月日出現兩次。
    const baseLunar = solarToLunarInfo(base);
    const targetLunar = solarToLunarInfo(target);
    if (!baseLunar || !targetLunar) return false;
    if (targetLunar.isLeap) return false;
    return baseLunar.month === targetLunar.month && baseLunar.day === targetLunar.day;
  }
  return false;
}

function nthWeekdayInMonth(date) {
  return Math.ceil(date.getDate() / 7);
}

function repeatDisplayLabel(task) {
  if (task.repeat === 'interval') return `每隔 ${task.repeatInterval || 2} 天`;
  if (task.repeat === 'weekdays') return '只工作日';
  if (task.repeat === 'monthlyNth') {
    const nth = Number(task.repeatNth);
    const nthText = nth === -1 ? '最後一個' : `第 ${nth} 個`;
    return `每月${nthText}${WEEKDAY_FULL_NAMES[Number(task.repeatWeekday)] || ''}`;
  }
  return repeatLabel[task.repeat] || task.repeat;
}

function getHoliday(dateKey) {
  return dynamicHolidays[dateKey] || TAIWAN_HOLIDAYS[dateKey] || '';
}

function holidayBanner(name) {
  return name ? `<div class="holiday-banner">🟢 國定假日：${escapeHtml(name)}</div>` : '';
}

function compareTasks(a, b) {
  return Number(b.pinned) - Number(a.pinned) || a.date.localeCompare(b.date) || (a.sortOrder || 0) - (b.sortOrder || 0) || a.start.localeCompare(b.start) || priorityWeight[b.priority] - priorityWeight[a.priority];
}

function isTaskOverdue(task, dateKey) {
  if (isTaskDone(task, dateKey)) return false;
  return new Date(`${dateKey}T${task.end}:00`) < new Date();
}

function timeOverlaps(aStart, aEnd, bStart, bEnd) {
  return aStart < bEnd && bStart < aEnd;
}

function emptyState(dateKey, holidayName = getHoliday(dateKey)) {
  return `
    ${holidayBanner(holidayName)}
    <div class="empty-state" data-drop-date="${dateKey}">
      <div>
        <strong>這天還沒有行程</strong>
        <p>按「新增行程」開始安排，或拖曳其他日期的行程到這裡。</p>
      </div>
    </div>
  `;
}

function linesFromTextarea(value) {
  return value.split('\n').map((line) => line.trim()).filter(Boolean);
}

function parseTags(value) {
  return value.split(/[#,，、\s]+/).map((tag) => tag.trim()).filter(Boolean);
}

function playDoneSound() {
  try {
    const audio = new AudioContext();
    const osc = audio.createOscillator();
    const gain = audio.createGain();
    osc.connect(gain);
    gain.connect(audio.destination);
    osc.frequency.value = 720;
    gain.gain.setValueAtTime(0.08, audio.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, audio.currentTime + 0.16);
    osc.start();
    osc.stop(audio.currentTime + 0.16);
  } catch {}
}

function clampHour(value, min, max) {
  const number = Number(value);
  if (!Number.isFinite(number)) return min;
  return Math.min(max, Math.max(min, Math.floor(number)));
}

function csvCell(value) {
  return `"${String(value ?? '').replaceAll('"', '""')}"`;
}

function downloadText(filename, content, type) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

