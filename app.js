const STORAGE_KEY = 'desktop-schedule-v1';
const HABIT_KEY = 'desktop-schedule-habits-v1';
const THEME_KEY = 'desktop-schedule-theme-v1';
const CATEGORY_KEY = 'desktop-schedule-categories-v1';
const TEXT_KEY = 'desktop-schedule-text-settings-v1';
const APP_SETTINGS_KEY = 'desktop-schedule-app-settings-v1';
const MEMO_KEY = 'desktop-schedule-daily-memos-v1';
const TEMPLATE_KEY = 'desktop-schedule-templates-v1';
const WEEKLY_GOAL_KEY = 'desktop-schedule-weekly-goals-v1';
const WIDGET_KEY = 'desktop-schedule-widget-mode-v1';

// 台灣國定假日對照表（2025–2027年，含補假／彈性放假）。資料來源：行政院人事行政總處公告辦公日曆表。
const TAIWAN_HOLIDAYS = {
  '2025-01-01': '元旦',
  '2025-01-27': '春節（彈性放假）',
  '2025-01-28': '除夕',
  '2025-01-29': '春節',
  '2025-01-30': '春節',
  '2025-01-31': '春節',
  '2025-02-28': '和平紀念日',
  '2025-04-03': '兒童節（補假）',
  '2025-04-04': '兒童節／清明節',
  '2025-05-01': '勞動節',
  '2025-05-30': '端午節（補假）',
  '2025-05-31': '端午節',
  '2025-09-28': '教師節',
  '2025-10-06': '中秋節',
  '2025-10-10': '國慶日',
  '2025-10-25': '臺灣光復節',
  '2025-12-25': '行憲紀念日',
  '2026-01-01': '元旦',
  '2026-02-16': '除夕',
  '2026-02-17': '春節',
  '2026-02-18': '春節',
  '2026-02-19': '春節',
  '2026-02-20': '春節（彈性放假）',
  '2026-02-28': '和平紀念日',
  '2026-04-04': '兒童節',
  '2026-04-05': '清明節',
  '2026-05-01': '勞動節',
  '2026-06-19': '端午節',
  '2026-09-25': '中秋節',
  '2026-09-28': '教師節',
  '2026-10-10': '國慶日',
  '2026-10-25': '臺灣光復節',
  '2026-12-25': '行憲紀念日',
  '2027-01-01': '元旦',
  '2027-02-04': '春節（彈性放假）',
  '2027-02-05': '除夕',
  '2027-02-06': '春節',
  '2027-02-07': '春節',
  '2027-02-08': '春節',
  '2027-02-09': '春節（補假）',
  '2027-02-10': '春節（補假）',
  '2027-02-28': '和平紀念日',
  '2027-04-04': '兒童節',
  '2027-04-05': '清明節',
  '2027-05-01': '勞動節',
  '2027-06-09': '端午節',
  '2027-09-15': '中秋節',
  '2027-09-28': '教師節',
  '2027-10-10': '國慶日',
  '2027-10-25': '臺灣光復節',
  '2027-12-25': '行憲紀念日',
  '2027-12-31': '元旦（補假）',
};

const defaultAppSettings = { workStart: 7, workEnd: 21, showLunar: true, dayViewMode: 'list', autoSync: false };
const TIMELINE_HOUR_HEIGHT = 60;

const defaultTemplates = [
  { id: 't-morning', name: '晨會', start: '09:00', end: '09:30', category: '工作', priority: 'medium' },
  { id: 't-sport', name: '運動', start: '18:00', end: '19:00', category: '運動', priority: 'medium' },
  { id: 't-study', name: '讀書', start: '20:00', end: '21:00', category: '學習', priority: 'medium' },
];

const defaultTextSettings = {
  appTitle: '桌面行程表',
  addTaskText: '＋ 新增行程',
  topThreeTitle: '今日重點',
  completionTitle: '完成率',
  habitTitle: '習慣追蹤',
  categoryTitle: '自訂分類',
  searchLabel: '搜尋',
  taskNameLabel: '事項名稱',
  defaultTaskPlaceholder: '例如：拜訪客戶、讀書、運動',
};

const defaultCategories = [
  { name: '工作', color: '#3b82f6', system: true },
  { name: '家庭', color: '#f97316', system: true },
  { name: '學習', color: '#8b5cf6', system: true },
  { name: '運動', color: '#10b981', system: true },
  { name: '重要事項', color: '#ef4444', system: true },
];

const priorityLabel = { high: '高', medium: '中', low: '低' };
const priorityWeight = { high: 3, medium: 2, low: 1 };
const repeatLabel = {
  none: '不重複',
  daily: '每天',
  weekly: '每週',
  monthly: '每月',
  interval: '每隔 N 天',
  weekdays: '只工作日',
  monthlyNth: '每月第 N 個週幾',
};
const WEEKDAY_ICS = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'];
const WEEKDAY_FULL_NAMES = ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六'];

// 農曆換算資料表（1900–2100年），每個元素以位元記錄該農曆年閏月與各月大小月。
const LUNAR_INFO = [
  0x04bd8, 0x04ae0, 0x0a570, 0x054d5, 0x0d260, 0x0d950, 0x16554, 0x056a0, 0x09ad0, 0x055d2,
  0x04ae0, 0x0a5b6, 0x0a4d0, 0x0d250, 0x1d255, 0x0b540, 0x0d6a0, 0x0ada2, 0x095b0, 0x14977,
  0x04970, 0x0a4b0, 0x0b4b5, 0x06a50, 0x06d40, 0x1ab54, 0x02b60, 0x09570, 0x052f2, 0x04970,
  0x06566, 0x0d4a0, 0x0ea50, 0x06e95, 0x05ad0, 0x02b60, 0x186e3, 0x092e0, 0x1c8d7, 0x0c950,
  0x0d4a0, 0x1d8a6, 0x0b550, 0x056a0, 0x1a5b4, 0x025d0, 0x092d0, 0x0d2b2, 0x0a950, 0x0b557,
  0x06ca0, 0x0b550, 0x15355, 0x04da0, 0x0a5d0, 0x14573, 0x052d0, 0x0a9a8, 0x0e950, 0x06aa0,
  0x0aea6, 0x0ab50, 0x04b60, 0x0aae4, 0x0a570, 0x05260, 0x0f263, 0x0d950, 0x05b57, 0x056a0,
  0x096d0, 0x04dd5, 0x04ad0, 0x0a4d0, 0x0d4d4, 0x0d250, 0x0d558, 0x0b540, 0x0b5a0, 0x195a6,
  0x095b0, 0x049b0, 0x0a974, 0x0a4b0, 0x0b27a, 0x06a50, 0x06d40, 0x0af46, 0x0ab60, 0x09570,
  0x04af5, 0x04970, 0x064b0, 0x074a3, 0x0ea50, 0x06b58, 0x055c0, 0x0ab60, 0x096d5, 0x092e0,
  0x0c960, 0x0d954, 0x0d4a0, 0x0da50, 0x07552, 0x056a0, 0x0abb7, 0x025d0, 0x092d0, 0x0cab5,
  0x0a950, 0x0b4a0, 0x0baa4, 0x0ad50, 0x055d9, 0x04ba0, 0x0a5b0, 0x15176, 0x052b0, 0x0a930,
  0x07954, 0x06aa0, 0x0ad50, 0x05b52, 0x04b60, 0x0a6e6, 0x0a4e0, 0x0d260, 0x0ea65, 0x0d530,
  0x05aa0, 0x076a3, 0x096d0, 0x04bd7, 0x04ad0, 0x0a4d0, 0x1d0b6, 0x0d250, 0x0d520, 0x0dd45,
  0x0b5a0, 0x056d0, 0x055b2, 0x049b0, 0x0a577, 0x0a4b0, 0x0aa50, 0x1b255, 0x06d20, 0x0ada0,
  0x14b63, 0x09370, 0x049f8, 0x04970, 0x064b0, 0x168a6, 0x0ea50, 0x06b20, 0x1a6c4, 0x0aae0,
  0x0a2e0, 0x0d2e3, 0x0c960, 0x0d557, 0x0d4a0, 0x0da50, 0x05d55, 0x056a0, 0x0a6d0, 0x055d4,
  0x052d0, 0x0a9b8, 0x0a950, 0x0b4a0, 0x0b6a6, 0x0ad50, 0x055a0, 0x0aba4, 0x0a5b0, 0x052b0,
  0x0b273, 0x06930, 0x07337, 0x06aa0, 0x0ad50, 0x14b55, 0x04b60, 0x0a570, 0x054e4, 0x0d160,
  0x0e968, 0x0d520, 0x0daa0, 0x16aa6, 0x056d0, 0x04ae0, 0x0a9d4, 0x0a2d0, 0x0d150, 0x0f252,
  0x0d520,
];
const LUNAR_MONTH_NAMES = ['正月', '二月', '三月', '四月', '五月', '六月', '七月', '八月', '九月', '十月', '冬月', '臘月'];
const LUNAR_DAY_NAMES = [
  '初一', '初二', '初三', '初四', '初五', '初六', '初七', '初八', '初九', '初十',
  '十一', '十二', '十三', '十四', '十五', '十六', '十七', '十八', '十九', '二十',
  '廿一', '廿二', '廿三', '廿四', '廿五', '廿六', '廿七', '廿八', '廿九', '三十',
];

let tasks = loadJson(STORAGE_KEY, []);
let habits = loadJson(HABIT_KEY, []);
let categories = loadJson(CATEGORY_KEY, defaultCategories);
let textSettings = { ...defaultTextSettings, ...loadJson(TEXT_KEY, {}) };
let appSettings = { ...defaultAppSettings, ...loadJson(APP_SETTINGS_KEY, {}) };
let dailyMemos = loadJson(MEMO_KEY, {});
let templates = loadJson(TEMPLATE_KEY, defaultTemplates);
let weeklyGoals = loadJson(WEEKLY_GOAL_KEY, []);
let currentDate = startOfDay(new Date());
let currentView = 'day';
let todayTodoMode = false;
let widgetMode = localStorage.getItem(WIDGET_KEY) === '1';
let notifiedTaskIds = new Set();
let pomodoroState = { mode: 'focus', remainingSeconds: 25 * 60, running: false, intervalId: null };
let swRegistration = null;
let timelineResizeState = null;
let timelineDragMoved = false;

const $ = (id) => document.getElementById(id);
const els = {
  brandTitle: $('brandTitle'),
  todayLabel: $('todayLabel'),
  currentTitle: $('currentTitle'),
  lunarDayLabel: $('lunarDayLabel'),
  calendarView: $('calendarView'),
  quickAddBtn: $('quickAddBtn'),
  topThreeHeading: $('topThreeHeading'),
  completionHeading: $('completionHeading'),
  habitHeading: $('habitHeading'),
  categoryHeading: $('categoryHeading'),
  prevBtn: $('prevBtn'),
  todayBtn: $('todayBtn'),
  nextBtn: $('nextBtn'),
  jumpDateInput: $('jumpDateInput'),
  themeBtn: $('themeBtn'),
  enableNotificationsBtn: $('enableNotificationsBtn'),
  dayModeSwitch: $('dayModeSwitch'),
  clearDayBtn: $('clearDayBtn'),
  clearWeekBtn: $('clearWeekBtn'),
  clearMonthBtn: $('clearMonthBtn'),
  backupBtn: $('backupBtn'),
  restoreBtn: $('restoreBtn'),
  restoreFileInput: $('restoreFileInput'),
  settingsBtn: $('settingsBtn'),
  cleanupBtn: $('cleanupBtn'),
  exportCsvBtn: $('exportCsvBtn'),
  printBtn: $('printBtn'),
  exportIcsBtn: $('exportIcsBtn'),
  importIcsBtn: $('importIcsBtn'),
  importIcsFileInput: $('importIcsFileInput'),
  searchLabel: $('searchLabel'),
  searchInput: $('searchInput'),
  filterCategory: $('filterCategory'),
  filterStatus: $('filterStatus'),
  filterPriority: $('filterPriority'),
  todayTodoBtn: $('todayTodoBtn'),
  widgetModeBtn: $('widgetModeBtn'),
  pomodoroBtn: $('pomodoroBtn'),
  pomodoroDialog: $('pomodoroDialog'),
  closePomodoroBtn: $('closePomodoroBtn'),
  pomodoroTaskSelect: $('pomodoroTaskSelect'),
  pomodoroFocusInput: $('pomodoroFocusInput'),
  pomodoroBreakInput: $('pomodoroBreakInput'),
  pomodoroModeLabel: $('pomodoroModeLabel'),
  pomodoroDisplay: $('pomodoroDisplay'),
  pomodoroStartBtn: $('pomodoroStartBtn'),
  pomodoroPauseBtn: $('pomodoroPauseBtn'),
  pomodoroResetBtn: $('pomodoroResetBtn'),
  taskDialog: $('taskDialog'),
  taskForm: $('taskForm'),
  dialogTitle: $('dialogTitle'),
  closeDialogBtn: $('closeDialogBtn'),
  cancelTaskBtn: $('cancelTaskBtn'),
  deleteTaskBtn: $('deleteTaskBtn'),
  taskId: $('taskId'),
  taskNameLabel: $('taskNameLabel'),
  taskTitle: $('taskTitle'),
  taskDate: $('taskDate'),
  taskStart: $('taskStart'),
  taskEnd: $('taskEnd'),
  taskPriority: $('taskPriority'),
  taskCategory: $('taskCategory'),
  taskRepeat: $('taskRepeat'),
  repeatIntervalField: $('repeatIntervalField'),
  taskRepeatInterval: $('taskRepeatInterval'),
  repeatNthField: $('repeatNthField'),
  taskRepeatNth: $('taskRepeatNth'),
  repeatWeekdayField: $('repeatWeekdayField'),
  taskRepeatWeekday: $('taskRepeatWeekday'),
  taskReminder: $('taskReminder'),
  taskPinned: $('taskPinned'),
  taskTags: $('taskTags'),
  taskSubtasks: $('taskSubtasks'),
  taskNote: $('taskNote'),
  conflictWarning: $('conflictWarning'),
  settingsDialog: $('settingsDialog'),
  settingsForm: $('settingsForm'),
  closeSettingsBtn: $('closeSettingsBtn'),
  cancelSettingsBtn: $('cancelSettingsBtn'),
  resetSettingsBtn: $('resetSettingsBtn'),
  settingAppTitle: $('settingAppTitle'),
  settingAddTaskText: $('settingAddTaskText'),
  settingTopThreeTitle: $('settingTopThreeTitle'),
  settingCompletionTitle: $('settingCompletionTitle'),
  settingHabitTitle: $('settingHabitTitle'),
  settingCategoryTitle: $('settingCategoryTitle'),
  settingSearchLabel: $('settingSearchLabel'),
  settingTaskNameLabel: $('settingTaskNameLabel'),
  settingDefaultTaskPlaceholder: $('settingDefaultTaskPlaceholder'),
  settingWorkStart: $('settingWorkStart'),
  settingWorkEnd: $('settingWorkEnd'),
  settingShowLunar: $('settingShowLunar'),
  dailyMemo: $('dailyMemo'),
  dailyMemoStatus: $('dailyMemoStatus'),
  templateList: $('templateList'),
  templateNameInput: $('templateNameInput'),
  addTemplateBtn: $('addTemplateBtn'),
  topThreeList: $('topThreeList'),
  completionRate: $('completionRate'),
  completionSummary: $('completionSummary'),
  statsSummary: $('statsSummary'),
  weeklyChart: $('weeklyChart'),
  weeklyGoalHeading: $('weeklyGoalHeading'),
  weeklyGoalList: $('weeklyGoalList'),
  weeklyGoalInput: $('weeklyGoalInput'),
  addWeeklyGoalBtn: $('addWeeklyGoalBtn'),
  habitList: $('habitList'),
  habitInput: $('habitInput'),
  addHabitBtn: $('addHabitBtn'),
  categoryList: $('categoryList'),
  categoryNameInput: $('categoryNameInput'),
  categoryColorInput: $('categoryColorInput'),
  addCategoryBtn: $('addCategoryBtn'),
  toast: $('toast'),
};

init();

function init() {
  document.body.classList.toggle('dark', localStorage.getItem(THEME_KEY) === 'dark');
  document.body.classList.toggle('widget-mode', widgetMode);
  els.themeBtn.textContent = document.body.classList.contains('dark') ? '☀️' : '🌙';
  els.todayLabel.textContent = formatLongDate(new Date());
  applyTextSettings();

  // 全新安裝／無資料時保持空白，不再自動塞範例行程：
  // 範例行程曾在雲端同步時被誤推上雲端蓋掉正式資料，且對新使用者也未必需要。
  normalizeStoredData();
  bindEvents();
  render();
  updatePomodoroDisplay();
  requestNotificationPermission();
  registerServiceWorker();
  handleUrlShortcutAction();
  setInterval(checkReminders, 30 * 1000);
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

function registerServiceWorker() {
  if (!('serviceWorker' in navigator) || location.protocol === 'file:') return;

  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./service-worker.js')
      .then((registration) => { swRegistration = registration; })
      .catch(() => {
        // PWA 離線快取註冊失敗時，不影響一般行程表功能。
      });
  });

  navigator.serviceWorker.ready.then((registration) => { swRegistration = registration; }).catch(() => {});
}

function bindEvents() {
  els.quickAddBtn.addEventListener('click', () => openTaskDialog({ date: toDateInput(currentDate) }));
  els.prevBtn.addEventListener('click', () => navigate(-1));
  els.todayBtn.addEventListener('click', () => { currentDate = startOfDay(new Date()); render(); });
  els.nextBtn.addEventListener('click', () => navigate(1));
  // 年月日直選跳轉：改變日期選擇器就跳到那一天（週/月檢視會跳到含該日的那一週/月）。
  els.jumpDateInput?.addEventListener('change', () => {
    if (!els.jumpDateInput.value) return;
    const next = new Date(`${els.jumpDateInput.value}T00:00:00`);
    if (Number.isNaN(next.getTime())) return;
    currentDate = startOfDay(next);
    render();
  });
  // 點標題也能開啟年月日選擇器（showPicker 需要使用者手勢，且舊瀏覽器可能不支援，包 try/catch）。
  els.currentTitle.addEventListener('click', () => {
    try {
      els.jumpDateInput?.showPicker?.();
    } catch {
      els.jumpDateInput?.focus();
    }
  });
  // 行程視窗的日期欄：點整個欄位就打開年月日選擇器，不用瞄準小小的日曆圖示。
  els.taskDate.addEventListener('click', () => {
    try {
      els.taskDate.showPicker?.();
    } catch {}
  });
  els.themeBtn.addEventListener('click', toggleTheme);
  els.enableNotificationsBtn.addEventListener('click', () => requestNotificationPermission(true));
  els.backupBtn.addEventListener('click', exportBackup);
  els.restoreBtn.addEventListener('click', () => els.restoreFileInput.click());
  els.restoreFileInput.addEventListener('change', importBackup);
  els.settingsBtn.addEventListener('click', openSettingsDialog);
  els.todayTodoBtn.addEventListener('click', toggleTodayTodoMode);
  els.widgetModeBtn.addEventListener('click', toggleWidgetMode);
  els.pomodoroBtn.addEventListener('click', openPomodoroDialog);
  els.closePomodoroBtn.addEventListener('click', closePomodoroDialog);
  els.pomodoroStartBtn.addEventListener('click', startPomodoro);
  els.pomodoroPauseBtn.addEventListener('click', pausePomodoro);
  els.pomodoroResetBtn.addEventListener('click', resetPomodoro);
  [els.pomodoroFocusInput, els.pomodoroBreakInput].forEach((el) => el.addEventListener('input', () => {
    if (pomodoroState.running) return;
    pomodoroState.remainingSeconds = pomodoroTotalSeconds();
    updatePomodoroDisplay();
  }));
  els.cleanupBtn.addEventListener('click', cleanupOldTasks);
  els.clearDayBtn.addEventListener('click', clearDayTasks);
  els.clearWeekBtn.addEventListener('click', clearWeekTasks);
  els.clearMonthBtn.addEventListener('click', clearMonthTasks);
  els.addTemplateBtn.addEventListener('click', addTemplateFromDialog);
  els.templateNameInput.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') addTemplateFromDialog();
  });
  els.closeSettingsBtn.addEventListener('click', closeSettingsDialog);
  els.cancelSettingsBtn.addEventListener('click', closeSettingsDialog);
  els.resetSettingsBtn.addEventListener('click', resetTextSettings);
  els.settingsForm.addEventListener('submit', saveTextSettingsFromForm);
  els.exportCsvBtn.addEventListener('click', exportCsv);
  els.printBtn.addEventListener('click', () => window.print());
  els.exportIcsBtn.addEventListener('click', exportIcs);
  els.importIcsBtn.addEventListener('click', () => els.importIcsFileInput.click());
  els.importIcsFileInput.addEventListener('change', importIcs);

  document.querySelectorAll('.view-btn:not(.day-mode-btn)').forEach((btn) => {
    btn.addEventListener('click', () => {
      currentView = btn.dataset.view;
      document.querySelectorAll('.view-btn:not(.day-mode-btn)').forEach((b) => b.classList.toggle('active', b === btn));
      render();
    });
  });

  document.querySelectorAll('.day-mode-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      appSettings.dayViewMode = btn.dataset.dayMode === 'timeline' ? 'timeline' : 'list';
      saveJson(APP_SETTINGS_KEY, appSettings);
      render();
    });
  });

  [els.searchInput, els.filterCategory, els.filterStatus, els.filterPriority].forEach((el) => el.addEventListener('input', render));
  els.dailyMemo.addEventListener('input', saveDailyMemo);

  els.addWeeklyGoalBtn.addEventListener('click', addWeeklyGoal);
  els.weeklyGoalInput.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') addWeeklyGoal();
  });

  els.closeDialogBtn.addEventListener('click', closeTaskDialog);
  els.cancelTaskBtn.addEventListener('click', closeTaskDialog);
  els.deleteTaskBtn.addEventListener('click', deleteCurrentTask);
  els.taskForm.addEventListener('submit', saveTaskFromForm);
  [els.taskDate, els.taskStart, els.taskEnd].forEach((el) => el.addEventListener('input', updateConflictWarning));
  els.taskRepeat.addEventListener('change', updateRepeatFieldsVisibility);

  els.addHabitBtn.addEventListener('click', addHabit);
  els.habitInput.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') addHabit();
  });
  els.addCategoryBtn.addEventListener('click', addCategory);
  els.categoryNameInput.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') addCategory();
  });

  document.addEventListener('click', handleCalendarClick);
  document.addEventListener('change', handleCalendarChange);
  document.addEventListener('dragstart', handleDragStart);
  document.addEventListener('dragover', handleDragOver);
  document.addEventListener('drop', handleDrop);
  document.addEventListener('mousedown', handleTimelinePointerDown);
  document.addEventListener('touchstart', handleTimelinePointerDown, { passive: false });
}

function render() {
  renderCategoryOptions();
  const visibleTasks = getFilteredTasks(tasks);
  renderTitle();
  renderDailyMemo();
  renderCalendar(visibleTasks);
  renderTodayPanel();
  renderWeeklyGoals();
  renderHabits();
  renderCategories();
  renderTemplates();
  updateModeButtons();
  updateDayModeSwitch();
  updateNotificationButton();
  saveJson(STORAGE_KEY, tasks);
  saveJson(CATEGORY_KEY, categories);
  saveJson(APP_SETTINGS_KEY, appSettings);

  // 雲端同步 scaffold（sync.js）掛勾：未載入 sync.js 或未設定同步時安全跳過，
  // 任何錯誤都不能影響本機行程功能，所以包一層 try/catch。
  try {
    if (window.CalendarApp && typeof window.CalendarApp.onDataChanged === 'function') {
      window.CalendarApp.onDataChanged();
    }
  } catch (err) {
    console.warn('[calendar] onDataChanged 掛勾執行失敗，不影響本機功能', err);
  }
}

function renderTitle() {
  if (currentView === 'day') {
    const holidayName = getHoliday(toDateInput(currentDate));
    els.currentTitle.textContent = formatLongDate(currentDate) + (holidayName ? `　🟢 ${holidayName}` : '');
  }
  if (currentView === 'week') {
    const start = startOfWeek(currentDate);
    const end = addDays(start, 6);
    els.currentTitle.textContent = `${formatMonthDay(start)} – ${formatMonthDay(end)}`;
  }
  if (currentView === 'month') els.currentTitle.textContent = `${currentDate.getFullYear()} 年 ${currentDate.getMonth() + 1} 月`;
  els.lunarDayLabel.textContent = (currentView === 'day' && appSettings.showLunar) ? `🌙 農曆 ${lunarFullLabel(currentDate)}` : '';
  if (els.jumpDateInput) els.jumpDateInput.value = toDateInput(currentDate);
}

function renderDailyMemo() {
  const key = toDateInput(currentDate);
  els.dailyMemo.value = dailyMemos[key] || '';
  els.dailyMemoStatus.textContent = `${key} 自動儲存`;
}

function saveDailyMemo() {
  dailyMemos[toDateInput(currentDate)] = els.dailyMemo.value.trim();
  saveJson(MEMO_KEY, dailyMemos);
  els.dailyMemoStatus.textContent = '已儲存';
}

function renderCalendar(visibleTasks) {
  if (todayTodoMode || widgetMode) return renderTodoList(visibleTasks);
  if (currentView === 'day') renderDay(visibleTasks);
  if (currentView === 'week') renderWeek(visibleTasks);
  if (currentView === 'month') renderMonth(visibleTasks);
}

function renderTodoList(visibleTasks) {
  const todayKey = toDateInput(new Date());
  const list = visibleTasks
    .filter((task) => occursOnDate(task, todayKey) && !isTaskDone(task, todayKey))
    .sort(compareTasks);
  els.calendarView.innerHTML = list.length
    ? `<div class="todo-list-mode">${list.map((task) => taskCard(task, todayKey)).join('')}</div>`
    : '<div class="empty-state"><div><strong>今天待辦已完成</strong><p>沒有未完成行程。</p></div></div>';
}

function renderDay(visibleTasks) {
  const dateKey = toDateInput(currentDate);
  const holidayName = getHoliday(dateKey);
  const dayTasks = visibleTasks
    .filter((task) => occursOnDate(task, dateKey))
    .sort(compareTasks);

  if (appSettings.dayViewMode === 'timeline') {
    renderDayTimeline(dayTasks, dateKey, holidayName);
    return;
  }

  if (!dayTasks.length) {
    els.calendarView.innerHTML = emptyState(dateKey, holidayName);
    return;
  }

  const startHour = clampHour(appSettings.workStart, 0, 23);
  const endHour = Math.max(startHour, clampHour(appSettings.workEnd, 1, 24));
  const rows = Array.from({ length: endHour - startHour + 1 }, (_, index) => index + startHour).map((hour) => {
    const timeLabel = `${String(hour).padStart(2, '0')}:00`;
    const tasksInHour = dayTasks.filter((task) => Number(task.start.slice(0, 2)) === hour);
    return `
      <div class="hour-row">${timeLabel}</div>
      <div class="day-task-lane" data-drop-date="${dateKey}">
        ${tasksInHour.map((task) => taskCard(task, dateKey)).join('')}
      </div>
    `;
  }).join('');

  const unslotted = dayTasks.filter((task) => {
    const hour = Number(task.start.slice(0, 2));
    return hour < startHour || hour > endHour;
  });

  els.calendarView.innerHTML = `
    ${holidayBanner(holidayName)}
    <div class="day-layout">${rows}</div>
    ${unslotted.length ? `<h3>其他時間</h3>${unslotted.map((task) => taskCard(task, dateKey)).join('')}` : ''}
  `;
}

function renderDayTimeline(dayTasks, dateKey, holidayName) {
  const startHour = clampHour(appSettings.workStart, 0, 23);
  const endHour = Math.max(startHour + 1, clampHour(appSettings.workEnd, 1, 24));
  const rangeStartMin = startHour * 60;
  const rangeEndMin = endHour * 60;

  const timedTasks = dayTasks.filter((task) => timeToMinutes(task.end) > rangeStartMin && timeToMinutes(task.start) < rangeEndMin);
  const outsideTasks = dayTasks.filter((task) => !timedTasks.includes(task));
  const layout = computeTimelineLayout(timedTasks);

  const hourRows = Array.from({ length: endHour - startHour }, (_, i) => startHour + i)
    .map((hour) => `<div class="timeline-hour-row" style="height:${TIMELINE_HOUR_HEIGHT}px">${String(hour).padStart(2, '0')}:00</div>`)
    .join('');

  const blocks = layout.map(({ task, startMin, endMin, col, totalCols, conflict }) => {
    const clampedStart = Math.max(startMin, rangeStartMin);
    const clampedEnd = Math.min(endMin, rangeEndMin);
    const top = (clampedStart - rangeStartMin) / 60 * TIMELINE_HOUR_HEIGHT;
    const height = Math.max(18, (clampedEnd - clampedStart) / 60 * TIMELINE_HOUR_HEIGHT);
    const widthPct = 100 / totalCols;
    const leftPct = widthPct * col;
    const color = getCategoryColor(task.category);
    const done = isTaskDone(task, dateKey);
    return `
      <div class="timeline-block ${done ? 'done' : ''} ${conflict ? 'conflict' : ''}" style="top:${top}px;height:${height}px;left:calc(${leftPct}% + 2px);width:calc(${widthPct}% - 4px);--category-color:${color}" data-task-id="${task.id}" data-task-date="${dateKey}" title="${escapeHtml(task.title)} ${task.start}–${task.end}">
        <label class="timeline-block-check" title="完成"><input type="checkbox" ${done ? 'checked' : ''} data-toggle-done="${task.id}" data-done-date="${dateKey}" aria-label="完成 ${escapeHtml(task.title)}" /></label>
        <div class="timeline-block-title">${escapeHtml(task.title)}</div>
        <div class="timeline-block-time">${task.start}–${task.end}${conflict ? ' ⚠️衝突' : ''}</div>
        <div class="timeline-resize-handle" data-resize-task="${task.id}" title="拖曳下緣調整結束時間"></div>
      </div>
    `;
  }).join('');

  els.calendarView.innerHTML = `
    ${holidayBanner(holidayName)}
    <div class="timeline-wrap">
      <div class="timeline-hours">${hourRows}</div>
      <div class="timeline-lane" style="height:${(endHour - startHour) * TIMELINE_HOUR_HEIGHT}px">${blocks}</div>
    </div>
    ${outsideTasks.length ? `<h3>其他時間</h3>${outsideTasks.map((task) => taskCard(task, dateKey)).join('')}` : ''}
    ${!dayTasks.length ? '<p class="muted center" style="margin-top:14px">這天還沒有行程，按「新增行程」開始安排。</p>' : ''}
  `;
}

function computeTimelineLayout(dayTasks) {
  const items = dayTasks
    .map((task) => ({ task, startMin: timeToMinutes(task.start), endMin: timeToMinutes(task.end) }))
    .sort((a, b) => a.startMin - b.startMin || a.endMin - b.endMin);

  const clusters = [];
  let currentCluster = [];
  let clusterEnd = -Infinity;
  items.forEach((item) => {
    if (currentCluster.length && item.startMin >= clusterEnd) {
      clusters.push(currentCluster);
      currentCluster = [];
      clusterEnd = -Infinity;
    }
    currentCluster.push(item);
    clusterEnd = Math.max(clusterEnd, item.endMin);
  });
  if (currentCluster.length) clusters.push(currentCluster);

  clusters.forEach((cluster) => {
    const columnEnds = [];
    cluster.forEach((item) => {
      let placed = false;
      for (let i = 0; i < columnEnds.length; i++) {
        if (columnEnds[i] <= item.startMin) {
          item.col = i;
          columnEnds[i] = item.endMin;
          placed = true;
          break;
        }
      }
      if (!placed) {
        item.col = columnEnds.length;
        columnEnds.push(item.endMin);
      }
    });
    const totalCols = columnEnds.length;
    cluster.forEach((item) => {
      item.totalCols = totalCols;
      item.conflict = totalCols > 1;
    });
  });

  return items;
}

function renderWeek(visibleTasks) {
  const start = startOfWeek(currentDate);
  const days = Array.from({ length: 7 }, (_, i) => addDays(start, i));

  els.calendarView.innerHTML = `
    <div class="week-grid">
      ${days.map((day) => {
        const key = toDateInput(day);
        const holidayName = getHoliday(key);
        const dayTasks = visibleTasks.filter((task) => occursOnDate(task, key)).sort(compareTasks);
        return `
          <div class="week-day ${isToday(day) ? 'today' : ''} ${holidayName ? 'holiday' : ''}" data-drop-date="${key}">
            <div class="day-head"><span>${weekdayName(day)}</span><span>${formatMonthDay(day)}</span></div>
            ${appSettings.showLunar ? `<div class="lunar-mini">${escapeHtml(lunarCellLabel(day))}</div>` : ''}
            ${holidayName ? `<div class="holiday-label">${escapeHtml(holidayName)}</div>` : ''}
            ${dayTasks.length ? dayTasks.map((task) => taskCard(task, key)).join('') : '<p class="muted">無行程</p>'}
          </div>
        `;
      }).join('')}
    </div>
  `;
}

function renderMonth(visibleTasks) {
  const first = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
  const gridStart = startOfWeek(first);
  const days = Array.from({ length: 42 }, (_, i) => addDays(gridStart, i));

  els.calendarView.innerHTML = `
    <div class="month-grid">
      ${days.map((day) => {
        const key = toDateInput(day);
        const holidayName = getHoliday(key);
        const dayTasks = visibleTasks.filter((task) => occursOnDate(task, key)).sort(compareTasks).slice(0, 4);
        return `
          <div class="month-day ${isToday(day) ? 'today' : ''} ${day.getMonth() !== currentDate.getMonth() ? 'outside' : ''} ${holidayName ? 'holiday' : ''}" data-drop-date="${key}">
            <div class="day-head"><span>${day.getDate()}</span><button class="small-btn" data-new-date="${key}">＋</button></div>
            ${appSettings.showLunar ? `<div class="lunar-mini">${escapeHtml(lunarCellLabel(day))}</div>` : ''}
            ${holidayName ? `<div class="holiday-label">${escapeHtml(holidayName)}</div>` : ''}
            ${dayTasks.map((task) => taskCard(task, key)).join('')}
            ${visibleTasks.filter((task) => occursOnDate(task, key)).length > 4 ? '<span class="badge">更多...</span>' : ''}
          </div>
        `;
      }).join('')}
    </div>
  `;
}

function taskCard(task, dateKey) {
  const priorityClass = `priority-${task.priority}`;
  const color = getCategoryColor(task.category);
  const done = isTaskDone(task, dateKey);
  const overdue = isTaskOverdue(task, dateKey);
  return `
    <article class="task-card ${done ? 'done' : ''} ${overdue ? 'overdue' : ''} ${task.pinned ? 'pinned' : ''}" style="--category-color:${color}" draggable="true" data-task-id="${task.id}" data-task-date="${dateKey}">
      <div class="task-top">
        <input type="checkbox" ${done ? 'checked' : ''} data-toggle-done="${task.id}" data-done-date="${dateKey}" aria-label="完成 ${escapeHtml(task.title)}" />
        <div class="task-title">${escapeHtml(task.title)}</div>
        <div class="task-actions">
          <button class="small-btn" data-toggle-pin="${task.id}" title="置頂 / 取消置頂">${task.pinned ? '📌' : '📍'}</button>
          <button class="small-btn" data-copy-task="${task.id}" title="複製到明天">⧉</button>
          <button class="small-btn" data-edit-task="${task.id}" title="編輯">✎</button>
          <button class="small-btn" data-delete-task="${task.id}" title="刪除">🗑</button>
        </div>
      </div>
      <div class="task-meta">
        <span class="badge">${task.start}–${task.end}</span>
        <span class="badge">${escapeHtml(task.category)}</span>
        <span class="badge ${priorityClass}">優先：${priorityLabel[task.priority]}</span>
        ${task.pinned ? '<span class="badge pinned-badge">置頂</span>' : ''}
        ${overdue ? '<span class="badge overdue-badge">逾時</span>' : ''}
        ${task.repeat !== 'none' ? `<span class="badge">${escapeHtml(repeatDisplayLabel(task))}</span>` : ''}
        ${(task.tags || []).map((tag) => `<span class="badge tag-badge">#${escapeHtml(tag)}</span>`).join('')}
      </div>
      ${task.subtasks?.length ? `<ul class="subtask-list">${task.subtasks.map((item) => `<li>${escapeHtml(item)}</li>`).join('')}</ul>` : ''}
      ${task.note ? `<p class="muted">${escapeHtml(task.note)}</p>` : ''}
    </article>
  `;
}

function renderTodayPanel() {
  const todayKey = toDateInput(new Date());
  const todayTasks = tasks.filter((task) => occursOnDate(task, todayKey));
  const done = todayTasks.filter((task) => isTaskDone(task, todayKey)).length;
  const rate = todayTasks.length ? Math.round(done / todayTasks.length * 100) : 0;

  els.completionRate.textContent = `${rate}%`;
  els.completionRate.parentElement.style.setProperty('--progress', `${rate}%`);
  els.completionSummary.textContent = todayTasks.length ? `${done} / ${todayTasks.length} 件完成` : '尚無今日任務';

  const topThree = todayTasks
    .filter((task) => !isTaskDone(task, todayKey))
    .sort((a, b) => Number(b.pinned) - Number(a.pinned) || priorityWeight[b.priority] - priorityWeight[a.priority] || a.start.localeCompare(b.start))
    .slice(0, 3);
  els.topThreeList.innerHTML = topThree.map((task) => `<li>${task.pinned ? '📌 ' : ''}${escapeHtml(task.title)} <span class="muted">${task.start}</span></li>`).join('');

  const weekDone = countDoneInRange(startOfWeek(new Date()), 7);
  const monthDone = countDoneInRange(new Date(new Date().getFullYear(), new Date().getMonth(), 1), daysInMonth(new Date()));
  els.statsSummary.textContent = `本週完成 ${weekDone} 件｜本月完成 ${monthDone} 件`;

  renderWeeklyChart();
}

function renderWeeklyChart() {
  const days = Array.from({ length: 7 }, (_, i) => addDays(new Date(), i - 6));
  const counts = days.map((day) => countDoneOnDate(day));
  const max = Math.max(1, ...counts);
  els.weeklyChart.innerHTML = days.map((day, index) => {
    const count = counts[index];
    const heightPct = Math.max(4, Math.round((count / max) * 100));
    return `
      <div class="chart-col">
        <span class="chart-value">${count}</span>
        <div class="chart-bar ${isToday(day) ? 'chart-bar-today' : ''}" style="--bar-height:${heightPct}%"></div>
        <span class="chart-label">${formatMonthDay(day)}</span>
      </div>
    `;
  }).join('');
}

function countDoneOnDate(date) {
  const key = toDateInput(date);
  let count = 0;
  tasks.forEach((task) => {
    if ((task.completedDates || []).includes(key)) count += 1;
  });
  return count;
}

function countDoneInRange(startDate, days) {
  const keys = new Set(Array.from({ length: days }, (_, i) => toDateInput(addDays(startDate, i))));
  let count = 0;
  tasks.forEach((task) => {
    (task.completedDates || []).forEach((date) => { if (keys.has(date)) count += 1; });
  });
  return count;
}

function renderTemplates() {
  els.templateList.innerHTML = templates.length ? templates.map((tpl) => `
    <div class="template-item">
      <button class="template-apply" data-apply-template="${tpl.id}" title="建立到 ${toDateInput(currentDate)}">${escapeHtml(tpl.name)} <span class="muted">${tpl.start}</span></button>
      <button class="small-btn" data-delete-template="${tpl.id}">✕</button>
    </div>
  `).join('') : '<p class="muted">可新增常用範本</p>';
  saveJson(TEMPLATE_KEY, templates);
}

function applyTemplate(id) {
  const tpl = templates.find((item) => item.id === id);
  if (!tpl) return;
  tasks.push({
    id: crypto.randomUUID(),
    title: tpl.name,
    date: toDateInput(currentDate),
    start: tpl.start,
    end: tpl.end,
    priority: tpl.priority || 'medium',
    category: tpl.category || categories[0].name,
    repeat: 'none',
    reminder: 10,
    pinned: false,
    tags: [],
    subtasks: [],
    note: '',
    completedDates: [],
    excludedDates: [],
    sortOrder: Date.now(),
    createdAt: new Date().toISOString(),
  });
  saveJson(STORAGE_KEY, tasks);
  render();
  showToast(`已建立：${tpl.name}`);
}

function addTemplateFromDialog() {
  const name = els.templateNameInput.value.trim();
  if (!name) return showToast('請輸入範本名稱');
  templates.push({
    id: crypto.randomUUID(),
    name,
    start: '09:00',
    end: '10:00',
    category: categories[0].name,
    priority: 'medium',
  });
  els.templateNameInput.value = '';
  saveJson(TEMPLATE_KEY, templates);
  renderTemplates();
  showToast('範本已新增');
}

function deleteTemplate(id) {
  templates = templates.filter((item) => item.id !== id);
  saveJson(TEMPLATE_KEY, templates);
  renderTemplates();
  showToast('範本已刪除');
}

function toggleTodayTodoMode() {
  todayTodoMode = !todayTodoMode;
  if (todayTodoMode) {
    currentDate = startOfDay(new Date());
    currentView = 'day';
  }
  render();
  showToast(todayTodoMode ? '已切換今日待辦' : '已取消今日待辦');
}

function toggleWidgetMode() {
  widgetMode = !widgetMode;
  localStorage.setItem(WIDGET_KEY, widgetMode ? '1' : '0');
  document.body.classList.toggle('widget-mode', widgetMode);
  render();
  showToast(widgetMode ? '已開啟小工具模式' : '已關閉小工具模式');
}

function updateModeButtons() {
  els.todayTodoBtn.classList.toggle('active-mode', todayTodoMode);
  els.widgetModeBtn.classList.toggle('active-mode', widgetMode);
  els.todayTodoBtn.textContent = todayTodoMode ? '取消今日待辦' : '今日待辦';
  els.widgetModeBtn.textContent = widgetMode ? '一般模式' : '小工具模式';
}

function updateDayModeSwitch() {
  if (!els.dayModeSwitch) return;
  const modeActive = !todayTodoMode && !widgetMode;
  const visible = currentView === 'day' && modeActive;
  els.dayModeSwitch.hidden = !visible;
  if (els.clearDayBtn) els.clearDayBtn.hidden = !visible;
  if (els.clearWeekBtn) els.clearWeekBtn.hidden = !(currentView === 'week' && modeActive);
  if (els.clearMonthBtn) els.clearMonthBtn.hidden = !(currentView === 'month' && modeActive);
  document.querySelectorAll('.day-mode-btn').forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.dayMode === appSettings.dayViewMode);
  });
}

function openPomodoroDialog() {
  renderPomodoroTaskOptions();
  updatePomodoroDisplay();
  els.pomodoroDialog.showModal();
}

function closePomodoroDialog() {
  els.pomodoroDialog.close();
}

function renderPomodoroTaskOptions() {
  const todayKey = toDateInput(new Date());
  const todayTasks = tasks.filter((task) => occursOnDate(task, todayKey)).sort(compareTasks);
  const current = els.pomodoroTaskSelect.value;
  els.pomodoroTaskSelect.innerHTML = '<option value="">不綁定行程</option>'
    + todayTasks.map((task) => `<option value="${task.id}">${escapeHtml(task.title)}</option>`).join('');
  els.pomodoroTaskSelect.value = todayTasks.some((task) => task.id === current) ? current : '';
}

function pomodoroTotalSeconds() {
  const minutes = pomodoroState.mode === 'focus'
    ? Math.max(1, Number(els.pomodoroFocusInput.value) || 25)
    : Math.max(1, Number(els.pomodoroBreakInput.value) || 5);
  return minutes * 60;
}

function startPomodoro() {
  if (pomodoroState.running) return;
  if (!pomodoroState.remainingSeconds) pomodoroState.remainingSeconds = pomodoroTotalSeconds();
  pomodoroState.running = true;
  els.pomodoroFocusInput.disabled = true;
  els.pomodoroBreakInput.disabled = true;
  pomodoroState.intervalId = setInterval(pomodoroTick, 1000);
  updatePomodoroDisplay();
}

function pausePomodoro() {
  pomodoroState.running = false;
  clearInterval(pomodoroState.intervalId);
  pomodoroState.intervalId = null;
  els.pomodoroFocusInput.disabled = false;
  els.pomodoroBreakInput.disabled = false;
  updatePomodoroDisplay();
}

function resetPomodoro() {
  pausePomodoro();
  pomodoroState.mode = 'focus';
  pomodoroState.remainingSeconds = pomodoroTotalSeconds();
  updatePomodoroDisplay();
}

function pomodoroTick() {
  pomodoroState.remainingSeconds -= 1;
  if (pomodoroState.remainingSeconds <= 0) {
    completePomodoroSegment();
    return;
  }
  updatePomodoroDisplay();
}

function completePomodoroSegment() {
  const finishedMode = pomodoroState.mode;
  pausePomodoro();
  playDoneSound();
  const task = tasks.find((item) => item.id === els.pomodoroTaskSelect.value);
  const label = finishedMode === 'focus' ? '專注時間結束，休息一下吧！' : '休息結束，繼續加油！';
  notify('番茄鐘', task ? `${label}（${task.title}）` : label);
  pomodoroState.mode = finishedMode === 'focus' ? 'break' : 'focus';
  pomodoroState.remainingSeconds = pomodoroTotalSeconds();
  updatePomodoroDisplay();
}

function updatePomodoroDisplay() {
  const minutes = String(Math.floor(pomodoroState.remainingSeconds / 60)).padStart(2, '0');
  const seconds = String(pomodoroState.remainingSeconds % 60).padStart(2, '0');
  els.pomodoroDisplay.textContent = `${minutes}:${seconds}`;
  els.pomodoroModeLabel.textContent = pomodoroState.mode === 'focus' ? '專注時間' : '休息時間';
  els.pomodoroDialog.classList.toggle('is-break', pomodoroState.mode === 'break');
  els.pomodoroStartBtn.disabled = pomodoroState.running;
  els.pomodoroPauseBtn.disabled = !pomodoroState.running;
}

function cleanupOldTasks() {
  const todayKey = toDateInput(new Date());
  const removable = tasks.filter((task) => task.repeat === 'none' && task.date < todayKey && (task.completedDates || []).length);
  if (!removable.length) return showToast('沒有可清理的舊行程');
  if (!confirm(`確定刪除 ${removable.length} 筆已完成的過去行程？`)) return;
  const ids = new Set(removable.map((task) => task.id));
  tasks = tasks.filter((task) => !ids.has(task.id));
  saveJson(STORAGE_KEY, tasks);
  render();
  showToast(`已清理 ${removable.length} 筆舊行程`);
}

function clearDayTasks() {
  const dateKey = toDateInput(currentDate);
  const dayTasks = tasks.filter((task) => occursOnDate(task, dateKey));
  if (!dayTasks.length) return showToast('今天沒有行程可清除');
  if (!confirm(`即將清除今天 ${dayTasks.length} 筆行程，此動作無法復原，確定要繼續嗎？`)) return;
  dayTasks.forEach((task) => {
    if (task.repeat === 'none') {
      tasks = tasks.filter((item) => item.id !== task.id);
      return;
    }
    task.excludedDates = Array.isArray(task.excludedDates) ? task.excludedDates : [];
    if (!task.excludedDates.includes(dateKey)) task.excludedDates.push(dateKey);
  });
  saveJson(STORAGE_KEY, tasks);
  render();
  showToast(`已清除今天 ${dayTasks.length} 筆行程`);
}

function clearWeekTasks() {
  const start = startOfWeek(currentDate);
  const dateKeys = Array.from({ length: 7 }, (_, i) => toDateInput(addDays(start, i)));
  clearTasksForDateKeys(dateKeys, '本週');
}

function clearMonthTasks() {
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const total = daysInMonth(currentDate);
  const dateKeys = Array.from({ length: total }, (_, i) => toDateInput(new Date(year, month, i + 1)));
  clearTasksForDateKeys(dateKeys, '本月');
}

// 共用邏輯：比照 clearDayTasks()，一次清除多天範圍內的行程出現次數。
// 先掃描整個範圍蒐集「要刪除的非重複行程 id」與「重複行程要新增的 excludedDates」，
// 全部蒐集完才一次套用，避免逐天處理時 tasks 陣列被提前修改，導致後面幾天找不到已刪除的物件。
function clearTasksForDateKeys(dateKeys, label) {
  const removeIds = new Set();
  const excludeMap = new Map(); // taskId -> Set(dateKey)
  let count = 0;

  dateKeys.forEach((dateKey) => {
    tasks.filter((task) => occursOnDate(task, dateKey)).forEach((task) => {
      count += 1;
      if (task.repeat === 'none') {
        removeIds.add(task.id);
      } else {
        if (!excludeMap.has(task.id)) excludeMap.set(task.id, new Set());
        excludeMap.get(task.id).add(dateKey);
      }
    });
  });

  if (!count) return showToast(`${label}沒有行程可清除`);
  if (!confirm(`即將清除${label} ${count} 筆行程，此動作無法復原，確定要繼續嗎？`)) return;

  tasks = tasks.filter((task) => !removeIds.has(task.id));
  tasks.forEach((task) => {
    const excludeDates = excludeMap.get(task.id);
    if (!excludeDates) return;
    task.excludedDates = Array.isArray(task.excludedDates) ? task.excludedDates : [];
    excludeDates.forEach((dateKey) => {
      if (!task.excludedDates.includes(dateKey)) task.excludedDates.push(dateKey);
    });
  });

  saveJson(STORAGE_KEY, tasks);
  render();
  showToast(`已清除${label} ${count} 筆行程`);
}

function renderHabits() {
  const todayKey = toDateInput(new Date());
  els.habitList.innerHTML = habits.length ? habits.map((habit) => {
    const checked = habit.records?.includes(todayKey);
    return `
      <div class="habit-item">
        <label><input type="checkbox" ${checked ? 'checked' : ''} data-toggle-habit="${habit.id}" /> ${escapeHtml(habit.name)}</label>
        <span class="streak">連續 ${habitStreak(habit)} 天 <button class="small-btn" data-delete-habit="${habit.id}">✕</button></span>
      </div>
    `;
  }).join('') : '<p class="muted">可新增每日習慣</p>';
  saveJson(HABIT_KEY, habits);
}

function renderCategoryOptions() {
  const currentFilter = els.filterCategory.value || 'all';
  const currentTaskCategory = els.taskCategory.value;
  const options = categories.map((category) => `<option value="${escapeHtml(category.name)}">${escapeHtml(category.name)}</option>`).join('');
  els.filterCategory.innerHTML = `<option value="all">全部</option>${options}`;
  els.taskCategory.innerHTML = options;
  els.filterCategory.value = categories.some((category) => category.name === currentFilter) ? currentFilter : 'all';
  els.taskCategory.value = categories.some((category) => category.name === currentTaskCategory) ? currentTaskCategory : categories[0]?.name;
}

function renderCategories() {
  els.categoryList.innerHTML = categories.map((category) => `
    <div class="category-item">
      <span class="category-name"><span class="color-dot" style="--dot-color:${category.color}"></span>${escapeHtml(category.name)}</span>
      ${category.system ? '<span class="streak">預設</span>' : `<button class="small-btn" data-delete-category="${escapeHtml(category.name)}">✕</button>`}
    </div>
  `).join('');
}

function renderWeeklyGoals() {
  const weekKey = toDateInput(startOfWeek(new Date()));
  const goals = weeklyGoals.filter((goal) => goal.week === weekKey);
  els.weeklyGoalList.innerHTML = goals.length ? goals.map((goal) => `
    <div class="habit-item">
      <label><input type="checkbox" ${goal.done ? 'checked' : ''} data-toggle-weekly-goal="${goal.id}" /> ${escapeHtml(goal.title)}</label>
      <span class="streak"><button class="small-btn" data-delete-weekly-goal="${goal.id}">✕</button></span>
    </div>
  `).join('') : '<p class="muted">可新增本週目標</p>';
  saveJson(WEEKLY_GOAL_KEY, weeklyGoals);
}

function addWeeklyGoal() {
  const title = els.weeklyGoalInput.value.trim();
  if (!title) return;
  weeklyGoals.push({ id: crypto.randomUUID(), week: toDateInput(startOfWeek(new Date())), title, done: false });
  els.weeklyGoalInput.value = '';
  renderWeeklyGoals();
  showToast('每週目標已新增');
}

function openTaskDialog(defaults = {}) {
  renderCategoryOptions();
  const isEdit = Boolean(defaults.id);
  els.dialogTitle.textContent = isEdit ? '編輯行程' : '新增行程';
  els.taskId.value = defaults.id || '';
  els.taskTitle.value = defaults.title || '';
  els.taskDate.value = defaults.date || toDateInput(currentDate);
  els.taskStart.value = defaults.start || '09:00';
  els.taskEnd.value = defaults.end || '10:00';
  els.taskPriority.value = defaults.priority || 'medium';
  els.taskCategory.value = defaults.category || '工作';
  els.taskRepeat.value = defaults.repeat || 'none';
  const repeatBaseDate = defaults.date ? new Date(`${defaults.date}T00:00:00`) : currentDate;
  els.taskRepeatInterval.value = String(defaults.repeatInterval || 2);
  els.taskRepeatNth.value = String(defaults.repeatNth ?? nthWeekdayInMonth(repeatBaseDate));
  els.taskRepeatWeekday.value = String(defaults.repeatWeekday ?? repeatBaseDate.getDay());
  updateRepeatFieldsVisibility();
  els.taskReminder.value = String(defaults.reminder ?? 10);
  els.taskPinned.checked = Boolean(defaults.pinned);
  els.taskTags.value = (defaults.tags || []).map((tag) => `#${tag}`).join(', ');
  els.taskSubtasks.value = (defaults.subtasks || []).join('\n');
  els.taskNote.value = defaults.note || '';
  els.deleteTaskBtn.hidden = !isEdit;
  updateConflictWarning();
  els.taskDialog.showModal();
  els.taskTitle.focus();
}

function closeTaskDialog() {
  els.taskDialog.close();
  els.taskForm.reset();
  els.conflictWarning.hidden = true;
}

function updateRepeatFieldsVisibility() {
  const repeat = els.taskRepeat.value;
  els.repeatIntervalField.hidden = repeat !== 'interval';
  const isNth = repeat === 'monthlyNth';
  els.repeatNthField.hidden = !isNth;
  els.repeatWeekdayField.hidden = !isNth;
}

function saveTaskFromForm(event) {
  event.preventDefault();
  const existingTask = tasks.find((item) => item.id === els.taskId.value);
  const task = {
    id: els.taskId.value || crypto.randomUUID(),
    title: els.taskTitle.value.trim(),
    date: els.taskDate.value,
    start: els.taskStart.value,
    end: els.taskEnd.value,
    priority: els.taskPriority.value,
    category: els.taskCategory.value,
    repeat: els.taskRepeat.value,
    repeatInterval: Math.min(365, Math.max(2, Number(els.taskRepeatInterval.value) || 2)),
    repeatWeekday: Math.min(6, Math.max(0, Number(els.taskRepeatWeekday.value) || 0)),
    repeatNth: [1, 2, 3, 4, -1].includes(Number(els.taskRepeatNth.value)) ? Number(els.taskRepeatNth.value) : 1,
    reminder: Number(els.taskReminder.value),
    pinned: els.taskPinned.checked,
    tags: parseTags(els.taskTags.value),
    subtasks: linesFromTextarea(els.taskSubtasks.value),
    note: els.taskNote.value.trim(),
    completedDates: existingTask?.completedDates || [],
    excludedDates: existingTask?.excludedDates || [],
    sortOrder: existingTask?.sortOrder || Date.now(),
    createdAt: existingTask?.createdAt || new Date().toISOString(),
  };

  if (!task.title) return showToast('請輸入事項名稱');
  if (task.end <= task.start) return showToast('結束時間需晚於開始時間');

  const index = tasks.findIndex((item) => item.id === task.id);
  if (index >= 0) tasks[index] = task;
  else tasks.push(task);

  saveJson(STORAGE_KEY, tasks);
  closeTaskDialog();
  render();
  showToast('行程已儲存');
}

function deleteCurrentTask() {
  const id = els.taskId.value;
  if (!id) return;
  tasks = tasks.filter((task) => task.id !== id);
  saveJson(STORAGE_KEY, tasks);
  closeTaskDialog();
  render();
  showToast('行程已刪除');
}

function copyTaskToTomorrow(id) {
  const task = tasks.find((item) => item.id === id);
  if (!task) return;
  const copyDate = toDateInput(addDays(new Date(`${task.date}T00:00:00`), 1));
  tasks.push({
    ...task,
    id: crypto.randomUUID(),
    date: copyDate,
    repeat: 'none',
    completedDates: [],
    excludedDates: [],
    sortOrder: Date.now(),
    createdAt: new Date().toISOString(),
  });
  saveJson(STORAGE_KEY, tasks);
  render();
  showToast(`已複製到 ${copyDate}`);
}

function toggleTaskPinned(id) {
  const task = tasks.find((item) => item.id === id);
  if (!task) return;
  task.pinned = !task.pinned;
  saveJson(STORAGE_KEY, tasks);
  render();
  showToast(task.pinned ? '行程已置頂' : '已取消置頂');
}

function handleCalendarClick(event) {
  const editId = event.target.dataset.editTask;
  const deleteId = event.target.dataset.deleteTask;
  const copyId = event.target.dataset.copyTask;
  const pinId = event.target.dataset.togglePin;
  const newDate = event.target.dataset.newDate;
  const habitDeleteId = event.target.dataset.deleteHabit;
  const weeklyGoalDeleteId = event.target.dataset.deleteWeeklyGoal;
  const categoryDeleteName = event.target.dataset.deleteCategory;
  const applyTemplateId = event.target.closest('[data-apply-template]')?.dataset.applyTemplate;
  const deleteTemplateId = event.target.dataset.deleteTemplate;

  if (applyTemplateId) applyTemplate(applyTemplateId);
  if (deleteTemplateId) deleteTemplate(deleteTemplateId);
  if (pinId) toggleTaskPinned(pinId);
  if (copyId) copyTaskToTomorrow(copyId);
  if (editId) {
    const task = tasks.find((item) => item.id === editId);
    if (task) openTaskDialog(task);
  }
  if (deleteId) {
    tasks = tasks.filter((task) => task.id !== deleteId);
    saveJson(STORAGE_KEY, tasks);
    render();
    showToast('行程已刪除');
  }
  if (newDate) openTaskDialog({ date: newDate });
  if (habitDeleteId) {
    habits = habits.filter((habit) => habit.id !== habitDeleteId);
    saveJson(HABIT_KEY, habits);
    renderHabits();
    showToast('習慣已刪除');
  }
  if (weeklyGoalDeleteId) {
    weeklyGoals = weeklyGoals.filter((goal) => goal.id !== weeklyGoalDeleteId);
    saveJson(WEEKLY_GOAL_KEY, weeklyGoals);
    renderWeeklyGoals();
    showToast('每週目標已刪除');
  }
  if (categoryDeleteName) deleteCategory(categoryDeleteName);

  const timelineHandle = event.target.closest('.timeline-resize-handle');
  const timelineCheck = event.target.closest('.timeline-block-check');
  const timelineBlock = event.target.closest('.timeline-block');
  if (!timelineHandle && !timelineCheck && timelineBlock && !timelineDragMoved) {
    const task = tasks.find((item) => item.id === timelineBlock.dataset.taskId);
    if (task) openTaskDialog(task);
  }
  if (timelineDragMoved) timelineDragMoved = false;
}

function handleCalendarChange(event) {
  const taskId = event.target.dataset.toggleDone;
  const habitId = event.target.dataset.toggleHabit;
  const weeklyGoalId = event.target.dataset.toggleWeeklyGoal;

  if (taskId) {
    const task = tasks.find((item) => item.id === taskId);
    const doneDate = event.target.dataset.doneDate || toDateInput(currentDate);
    if (task) setTaskDone(task, doneDate, event.target.checked);
    if (event.target.checked) playDoneSound();
    render();
  }

  if (weeklyGoalId) {
    const goal = weeklyGoals.find((item) => item.id === weeklyGoalId);
    if (goal) goal.done = event.target.checked;
    saveJson(WEEKLY_GOAL_KEY, weeklyGoals);
    renderWeeklyGoals();
  }

  if (habitId) {
    const todayKey = toDateInput(new Date());
    const habit = habits.find((item) => item.id === habitId);
    if (!habit) return;
    habit.records = habit.records || [];
    habit.records = event.target.checked
      ? [...new Set([...habit.records, todayKey])]
      : habit.records.filter((date) => date !== todayKey);
    renderHabits();
  }
}

function handleDragStart(event) {
  const card = event.target.closest('.task-card');
  if (!card) return;
  card.classList.add('dragging');
  event.dataTransfer.setData('text/plain', card.dataset.taskId);
}

function handleDragOver(event) {
  if (event.target.closest('[data-drop-date]')) event.preventDefault();
}

function handleDrop(event) {
  const target = event.target.closest('[data-drop-date]');
  if (!target) return;
  event.preventDefault();
  const id = event.dataTransfer.getData('text/plain');
  const task = tasks.find((item) => item.id === id);
  if (task) {
    const oldDate = task.date;
    task.date = target.dataset.dropDate;
    task.sortOrder = Date.now();
    saveJson(STORAGE_KEY, tasks);
    render();
    showToast(oldDate === task.date ? '已調整行程順序' : '已調整行程日期');
  }
}

function handleTimelinePointerDown(event) {
  const handle = event.target.closest('.timeline-resize-handle');
  if (!handle) return;
  const block = handle.closest('.timeline-block');
  if (!block) return;
  const task = tasks.find((item) => item.id === block.dataset.taskId);
  if (!task) return;
  event.preventDefault();
  const clientY = event.touches ? event.touches[0].clientY : event.clientY;
  timelineDragMoved = false;
  timelineResizeState = {
    taskId: task.id,
    block,
    startClientY: clientY,
    startHeightPx: block.offsetHeight,
    taskStartMin: timeToMinutes(task.start),
  };
  document.addEventListener('mousemove', handleTimelinePointerMove);
  document.addEventListener('mouseup', handleTimelinePointerUp);
  document.addEventListener('touchmove', handleTimelinePointerMove, { passive: false });
  document.addEventListener('touchend', handleTimelinePointerUp);
}

function handleTimelinePointerMove(event) {
  if (!timelineResizeState) return;
  event.preventDefault();
  const clientY = event.touches ? event.touches[0].clientY : event.clientY;
  const delta = clientY - timelineResizeState.startClientY;
  if (Math.abs(delta) > 3) timelineDragMoved = true;
  const newHeight = Math.max(16, timelineResizeState.startHeightPx + delta);
  timelineResizeState.block.style.height = `${newHeight}px`;
}

function handleTimelinePointerUp(event) {
  if (!timelineResizeState) return;
  const state = timelineResizeState;
  timelineResizeState = null;
  document.removeEventListener('mousemove', handleTimelinePointerMove);
  document.removeEventListener('mouseup', handleTimelinePointerUp);
  document.removeEventListener('touchmove', handleTimelinePointerMove);
  document.removeEventListener('touchend', handleTimelinePointerUp);

  const task = tasks.find((item) => item.id === state.taskId);
  if (!task) return;
  const finalHeight = state.block.offsetHeight;
  const durationMin = Math.max(10, Math.round((finalHeight / TIMELINE_HOUR_HEIGHT * 60) / 5) * 5);
  const newEnd = minutesToTime(state.taskStartMin + durationMin);
  if (newEnd > task.start) {
    task.end = newEnd;
    saveJson(STORAGE_KEY, tasks);
    showToast(`已更新結束時間為 ${newEnd}`);
  }
  render();
}

function navigate(direction) {
  if (currentView === 'day') currentDate = addDays(currentDate, direction);
  if (currentView === 'week') currentDate = addDays(currentDate, direction * 7);
  if (currentView === 'month') currentDate = new Date(currentDate.getFullYear(), currentDate.getMonth() + direction, 1);
  render();
}

function getFilteredTasks(source) {
  const q = els.searchInput.value.trim().toLowerCase();
  const category = els.filterCategory.value;
  const status = todayTodoMode ? 'todo' : els.filterStatus.value;
  const priority = els.filterPriority.value;
  const statusDate = todayTodoMode ? toDateInput(new Date()) : toDateInput(currentDate);

  return source.filter((task) => {
    const subtaskText = (task.subtasks || []).join(' ');
    const tagText = (task.tags || []).map((tag) => `#${tag}`).join(' ');
    const textMatch = !q || [task.title, task.note, task.category, subtaskText, tagText].join(' ').toLowerCase().includes(q);
    const categoryMatch = category === 'all' || task.category === category;
    const priorityMatch = priority === 'all' || task.priority === priority;
    const done = isTaskDone(task, statusDate);
    const statusMatch = status === 'all' || (status === 'done' ? done : !done);
    return textMatch && categoryMatch && priorityMatch && statusMatch;
  });
}

function updateConflictWarning() {
  const currentId = els.taskId.value;
  const date = els.taskDate.value;
  const start = els.taskStart.value;
  const end = els.taskEnd.value;
  if (!date || !start || !end || end <= start) {
    els.conflictWarning.hidden = true;
    return;
  }

  const conflicts = tasks.filter((task) => task.id !== currentId && occursOnDate(task, date) && timeOverlaps(start, end, task.start, task.end));
  if (conflicts.length) {
    els.conflictWarning.hidden = false;
    els.conflictWarning.textContent = `⚠️ 時間可能衝突：${conflicts.map((task) => task.title).join('、')}`;
  } else {
    els.conflictWarning.hidden = true;
  }
}

function checkReminders() {
  const now = new Date();
  const nowKey = toDateInput(now);

  tasks.forEach((task) => {
    if (task.reminder < 0 || isTaskDone(task, nowKey) || !occursOnDate(task, nowKey)) return;
    const startAt = new Date(`${nowKey}T${task.start}:00`);
    const remindAt = new Date(startAt.getTime() - Number(task.reminder || 0) * 60 * 1000);
    const notificationId = `${task.id}-${nowKey}-${task.reminder}`;

    if (now >= remindAt && now <= new Date(remindAt.getTime() + 60 * 1000) && !notifiedTaskIds.has(notificationId)) {
      notifiedTaskIds.add(notificationId);
      notify(`行程提醒：${task.title}`, `${task.reminder ? `${task.reminder} 分鐘後` : '現在'}開始｜${task.category}`);
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
  const rows = tasks.sort(compareTasks).map((task) => [
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
    version: 7,
    exportedAt: new Date().toISOString(),
    tasks,
    habits,
    categories,
    textSettings,
    appSettings,
    dailyMemos,
    templates,
    weeklyGoals,
    widgetMode,
    theme: localStorage.getItem(THEME_KEY) || 'light',
  };
}

function exportBackup() {
  const payload = buildBackupPayload();
  downloadText(`行程表備份-${toDateInput(new Date())}.json`, JSON.stringify(payload, null, 2), 'application/json;charset=utf-8;');
}

// 套用一份備份物件（等同「還原」的流程）。單一真相：importBackup()（讀檔還原用）與
// sync.js 從雲端 pull 到較新資料時都呼叫這個函式。不在這裡顯示 toast，交給呼叫端決定文字。
function applyBackupObject(data) {
  data = data && typeof data === 'object' ? data : {};
  tasks = Array.isArray(data.tasks) ? data.tasks : [];
  habits = Array.isArray(data.habits) ? data.habits : [];
  categories = Array.isArray(data.categories) && data.categories.length ? data.categories : defaultCategories;
  textSettings = { ...defaultTextSettings, ...(data.textSettings || {}) };
  appSettings = { ...defaultAppSettings, ...(data.appSettings || {}) };
  dailyMemos = data.dailyMemos && typeof data.dailyMemos === 'object' ? data.dailyMemos : {};
  templates = Array.isArray(data.templates) && data.templates.length ? data.templates : defaultTemplates;
  weeklyGoals = Array.isArray(data.weeklyGoals) ? data.weeklyGoals : [];
  widgetMode = Boolean(data.widgetMode);
  if (data.theme) localStorage.setItem(THEME_KEY, data.theme);
  normalizeStoredData();
  saveJson(STORAGE_KEY, tasks);
  saveJson(HABIT_KEY, habits);
  saveJson(CATEGORY_KEY, categories);
  saveJson(TEXT_KEY, textSettings);
  saveJson(APP_SETTINGS_KEY, appSettings);
  saveJson(MEMO_KEY, dailyMemos);
  saveJson(TEMPLATE_KEY, templates);
  saveJson(WEEKLY_GOAL_KEY, weeklyGoals);
  localStorage.setItem(WIDGET_KEY, widgetMode ? '1' : '0');
  document.body.classList.toggle('dark', localStorage.getItem(THEME_KEY) === 'dark');
  document.body.classList.toggle('widget-mode', widgetMode);
  els.themeBtn.textContent = document.body.classList.contains('dark') ? '☀️' : '🌙';
  applyTextSettings();
  render();
}

function importBackup(event) {
  const file = event.target.files?.[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const data = JSON.parse(reader.result);
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
  tasks.forEach((task) => {
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
    default: return '';
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
    tags: [],
    subtasks: [],
    note: props.DESCRIPTION ? icsUnescape(props.DESCRIPTION.value) : '',
    completedDates: [],
    excludedDates: [],
    sortOrder: Date.now(),
    createdAt: new Date().toISOString(),
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
  const inUse = tasks.some((task) => task.category === name);
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
}

function toggleTheme() {
  document.body.classList.toggle('dark');
  const isDark = document.body.classList.contains('dark');
  localStorage.setItem(THEME_KEY, isDark ? 'dark' : 'light');
  els.themeBtn.textContent = isDark ? '☀️' : '🌙';
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
      tags: Array.isArray(task.tags) ? task.tags.filter(Boolean) : [],
      subtasks: Array.isArray(task.subtasks) ? task.subtasks.filter(Boolean) : [],
      excludedDates: Array.isArray(task.excludedDates) ? task.excludedDates.filter(Boolean) : [],
      repeat: task.repeat || 'none',
      repeatInterval: Number.isFinite(Number(task.repeatInterval)) && Number(task.repeatInterval) > 0 ? Math.floor(Number(task.repeatInterval)) : 2,
      repeatWeekday: Number.isFinite(Number(task.repeatWeekday)) ? Math.min(6, Math.max(0, Math.floor(Number(task.repeatWeekday)))) : new Date(`${task.date}T00:00:00`).getDay(),
      repeatNth: [1, 2, 3, 4, -1].includes(Number(task.repeatNth)) ? Number(task.repeatNth) : 1,
      reminder: Number.isFinite(Number(task.reminder)) ? Number(task.reminder) : 10,
      sortOrder: Number(task.sortOrder || 0),
    };
  });
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
  if (Array.isArray(task.excludedDates) && task.excludedDates.includes(dateKey)) return false;
  if (task.date === dateKey) return true;
  if (task.repeat === 'none') return false;

  const base = startOfDay(new Date(`${task.date}T00:00:00`));
  const target = startOfDay(new Date(`${dateKey}T00:00:00`));
  if (target < base) return false;

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
  return TAIWAN_HOLIDAYS[dateKey] || '';
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

function loadJson(key, fallback) {
  try { return JSON.parse(localStorage.getItem(key)) ?? fallback; }
  catch { return fallback; }
}

function saveJson(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

function startOfDay(date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function startOfWeek(date) {
  const day = startOfDay(date);
  const diff = day.getDay() === 0 ? -6 : 1 - day.getDay();
  return addDays(day, diff);
}

function addDays(date, days) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function toDateInput(date) {
  const d = new Date(date);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function formatLongDate(date) {
  return new Intl.DateTimeFormat('zh-TW', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' }).format(date);
}

function formatMonthDay(date) {
  return `${date.getMonth() + 1}/${date.getDate()}`;
}

function daysInMonth(date) {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
}

// ---- 農曆換算（純前端原生計算，涵蓋 1900–2100 年，內嵌 LUNAR_INFO 資料表）----

function lunarLeapMonth(year) {
  return LUNAR_INFO[year - 1900] & 0xf;
}

function lunarLeapDays(year) {
  if (lunarLeapMonth(year)) return (LUNAR_INFO[year - 1900] & 0x10000) ? 30 : 29;
  return 0;
}

function lunarMonthDays(year, month) {
  return (LUNAR_INFO[year - 1900] & (0x10000 >> month)) ? 30 : 29;
}

function lunarYearDays(year) {
  let sum = 348;
  for (let i = 0x8000; i > 0x8; i >>= 1) {
    sum += (LUNAR_INFO[year - 1900] & i) ? 1 : 0;
  }
  return sum + lunarLeapDays(year);
}

function solarToLunarInfo(date) {
  const year = date.getFullYear();
  if (year < 1900 || year > 2100) return null;

  let offset = Math.round((startOfDay(date) - new Date(1900, 0, 31)) / 86400000);
  let lunarYear = 1900;
  let yearDays = 0;
  for (; lunarYear < 2101 && offset > 0; lunarYear++) {
    yearDays = lunarYearDays(lunarYear);
    offset -= yearDays;
  }
  if (offset < 0) {
    offset += yearDays;
    lunarYear--;
  }

  const leapMonth = lunarLeapMonth(lunarYear);
  let isLeap = false;
  let lunarMonth = 1;
  let monthDays = 0;
  for (; lunarMonth < 13 && offset > 0; lunarMonth++) {
    if (leapMonth > 0 && lunarMonth === leapMonth + 1 && !isLeap) {
      lunarMonth--;
      isLeap = true;
      monthDays = lunarLeapDays(lunarYear);
    } else {
      monthDays = lunarMonthDays(lunarYear, lunarMonth);
    }
    if (isLeap && lunarMonth === leapMonth + 1) isLeap = false;
    offset -= monthDays;
  }
  if (offset === 0 && leapMonth > 0 && lunarMonth === leapMonth + 1) {
    if (isLeap) isLeap = false;
    else { isLeap = true; lunarMonth--; }
  }
  if (offset < 0) {
    offset += monthDays;
    lunarMonth--;
  }

  return { year: lunarYear, month: lunarMonth, day: offset + 1, isLeap };
}

function lunarCellLabel(date) {
  const info = solarToLunarInfo(date);
  if (!info) return '';
  if (info.day === 1) return (info.isLeap ? '閏' : '') + (LUNAR_MONTH_NAMES[info.month - 1] || '');
  return LUNAR_DAY_NAMES[info.day - 1] || '';
}

function lunarFullLabel(date) {
  const info = solarToLunarInfo(date);
  if (!info) return '';
  return `${info.isLeap ? '閏' : ''}${LUNAR_MONTH_NAMES[info.month - 1] || ''}${LUNAR_DAY_NAMES[info.day - 1] || ''}`;
}

function weekdayName(date) {
  return new Intl.DateTimeFormat('zh-TW', { weekday: 'short' }).format(date);
}

function isToday(date) {
  return toDateInput(date) === toDateInput(new Date());
}

function escapeHtml(text) {
  return String(text ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function showToast(message) {
  els.toast.textContent = message;
  els.toast.classList.add('show');
  clearTimeout(showToast.timer);
  showToast.timer = setTimeout(() => els.toast.classList.remove('show'), 2600);
}

// ============================================================================
// 提供給 sync.js（雲端同步 scaffold）使用的介面。
// sync.js 不直接碰 tasks / appSettings 等內部變數，一律透過這個介面，
// 讓「備份資料格式」與「本機儲存」維持單一真相在 app.js。
// index.html 若沒有載入 sync.js，這個物件單純不會被用到，不影響任何原有功能。
// ============================================================================
window.CalendarApp = {
  buildBackupPayload,
  applyBackupObject,
  isAutoSyncEnabled: () => Boolean(appSettings.autoSync),
  setAutoSyncEnabled: (enabled) => {
    appSettings.autoSync = Boolean(enabled);
    saveJson(APP_SETTINGS_KEY, appSettings);
  },
  showToast,
  // sync.js 會把自己的 notifyLocalChange 掛在這裡；render() 存檔後會呼叫（如果有掛的話）。
  onDataChanged: null,
};
