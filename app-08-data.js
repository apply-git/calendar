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
  tasks = tasks.map((task) => {
    const completedDates = Array.isArray(task.completedDates) ? task.completedDates : (task.done ? [task.date] : []);
    const categoryExists = categories.some((category) => category.name === task.category);
    return {
      ...task,
      category: categoryExists ? task.category : categories[0].name,
      completedDates,
      pinned: Boolean(task.pinned),
      countdown: Boolean(task.countdown),
      shared: Boolean(task.shared),
      tags: Array.isArray(task.tags) ? task.tags.filter(Boolean) : [],
      subtasks: Array.isArray(task.subtasks) ? task.subtasks.filter(Boolean) : [],
      excludedDates: Array.isArray(task.excludedDates) ? task.excludedDates.filter(Boolean) : [],
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
}

function mergeCategories(base, saved) {
  const merged = [...base];
  (Array.isArray(saved) ? saved : []).forEach((category) => {
    if (!category?.name || merged.some((item) => item.name === category.name)) return;
    merged.push({ name: category.name, color: category.color || '#4568f0', system: Boolean(category.system) });
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

