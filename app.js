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
// 錯誤紀錄（診斷用，見檔案底部 setupErrorLogging()）：只存偵錯必要欄位，
// 刻意不納入備份匯出/還原（比照 sync-auth key 的處理，buildBackupPayload()/applyBackupObject() 不會碰它）。
const ERROR_LOG_KEY = 'desktop-schedule-errorlog-v1';
const ERROR_LOG_MAX = 50;

// 天氣（Open-Meteo，免金鑰，見檔案底部 fetchWeather()）：只是顯示用快取，
// 刻意不納入 buildBackupPayload()/applyBackupObject()，比照 sync-auth key 的處理。
const WEATHER_KEY = 'desktop-schedule-weather-v1';
const WEATHER_TTL_MS = 3 * 60 * 60 * 1000; // 3 小時內不重抓
const WEATHER_FALLBACK_LAT = 22.63; // 高雄（定位被拒絕/逾時/失敗時的預設座標）
const WEATHER_FALLBACK_LON = 120.30;
let weatherWarned = false; // console.warn 最多一次，避免零設定環境洗版

const HOLIDAYS_KEY = 'desktop-schedule-holidays-v1'; // 動態假日快取，刻意不納入 buildBackupPayload()/applyBackupObject()
const HOLIDAYS_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 天內不重抓
let holidayWarned = false; // console.warn 最多一次，避免零設定環境洗版
let dynamicHolidays = {}; // init() 時從 localStorage 載入進記憶體，供 getHoliday() 優先查詢

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
  'lunar-yearly': '農曆每年',
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
let reminderSnoozeTimers = new Map();
let pomodoroState = { mode: 'focus', remainingSeconds: 25 * 60, running: false, intervalId: null };
let swRegistration = null;
let swUpdateReloading = false;
let timelineResizeState = null;
let timelineDragMoved = false;
// 錯誤紀錄環形緩衝（最多 ERROR_LOG_MAX 筆，超過丟最舊），鏡像存 ERROR_LOG_KEY。
let errorLog = (() => {
  const stored = loadJson(ERROR_LOG_KEY, []);
  return Array.isArray(stored) ? stored : [];
})();
// 自然語言快速新增：openTaskDialog() 開窗當下記錄日期/開始/結束欄位的「預設值」快照，
// saveTaskFromForm() 送出前的保險解析只在欄位仍等於這份快照（=使用者沒手動改過）時才套用，
// 避免蓋掉使用者手動調整過的日期/時間。
let taskDialogDefaults = { date: '', start: '', end: '' };
// 編輯重複行程時，保留使用者點選的實際出現日；系列本身的 task.date 仍是起始日。
let editingOccurrenceDate = '';

const $ = (id) => document.getElementById(id);
const els = {
  brandTitle: $('brandTitle'),
  todayLabel: $('todayLabel'),
  currentTitle: $('currentTitle'),
  lunarDayLabel: $('lunarDayLabel'),
  weatherDayLabel: $('weatherDayLabel'),
  calendarView: $('calendarView'),
  quickAddBtn: $('quickAddBtn'),
  topThreeHeading: $('topThreeHeading'),
  countdownList: $('countdownList'),
  completionHeading: $('completionHeading'),
  habitHeading: $('habitHeading'),
  categoryHeading: $('categoryHeading'),
  prevBtn: $('prevBtn'),
  todayBtn: $('todayBtn'),
  nextBtn: $('nextBtn'),
  jumpDateInput: $('jumpDateInput'),
  jumpDateBtn: $('jumpDateBtn'),
  themeBtn: $('themeBtn'),
  enableNotificationsBtn: $('enableNotificationsBtn'),
  dayModeSwitch: $('dayModeSwitch'),
  clearDayBtn: $('clearDayBtn'),
  deferBtn: $('deferBtn'),
  shareCardBtn: $('shareCardBtn'),
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
  batchAddBtn: $('batchAddBtn'),
  batchAddDialog: $('batchAddDialog'),
  closeBatchAddBtn: $('closeBatchAddBtn'),
  batchAddInput: $('batchAddInput'),
  batchAddHint: $('batchAddHint'),
  batchAddPreviewWrap: $('batchAddPreviewWrap'),
  batchAddPreviewBody: $('batchAddPreviewBody'),
  batchAddPreviewBtn: $('batchAddPreviewBtn'),
  batchAddCancelBtn: $('batchAddCancelBtn'),
  batchAddImportBtn: $('batchAddImportBtn'),
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
  voiceInputBtn: $('voiceInputBtn'),
  taskDate: $('taskDate'),
  taskStart: $('taskStart'),
  taskEnd: $('taskEnd'),
  findSlotBtn: $('findSlotBtn'),
  taskPriority: $('taskPriority'),
  taskCategory: $('taskCategory'),
  taskRepeat: $('taskRepeat'),
  repeatIntervalField: $('repeatIntervalField'),
  taskRepeatInterval: $('taskRepeatInterval'),
  repeatNthField: $('repeatNthField'),
  taskRepeatNth: $('taskRepeatNth'),
  repeatWeekdayField: $('repeatWeekdayField'),
  taskRepeatWeekday: $('taskRepeatWeekday'),
  taskScopeField: $('taskScopeField'),
  taskScope: $('taskScope'),
  taskScopeHint: $('taskScopeHint'),
  taskReminder: $('taskReminder'),
  taskPinned: $('taskPinned'),
  taskCountdown: $('taskCountdown'),
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
  fabAddBtn: $('fabAddBtn'),
  moreToolsBtn: $('moreToolsBtn'),
  moreToolsDialog: $('moreToolsDialog'),
  closeMoreToolsBtn: $('closeMoreToolsBtn'),
  moreToolsWeeklyReviewBtn: $('moreToolsWeeklyReviewBtn'),
  weeklyReviewBtn: $('weeklyReviewBtn'),
  weeklyReviewDialog: $('weeklyReviewDialog'),
  closeWeeklyReviewBtn: $('closeWeeklyReviewBtn'),
  dashboardBtn: $('dashboardBtn'),
  dashboardDialog: $('dashboardDialog'),
  closeDashboardBtn: $('closeDashboardBtn'),
  dashboardCategoryHours: $('dashboardCategoryHours'),
  dashboardWeeklyTrend: $('dashboardWeeklyTrend'),
  dashboardOverdueSummary: $('dashboardOverdueSummary'),
  dashboardOverdueList: $('dashboardOverdueList'),
  dashboardTimeDistribution: $('dashboardTimeDistribution'),
  weeklyReviewRateValue: $('weeklyReviewRateValue'),
  weeklyReviewCountsLabel: $('weeklyReviewCountsLabel'),
  weeklyReviewCompare: $('weeklyReviewCompare'),
  weeklyReviewCategories: $('weeklyReviewCategories'),
  weeklyReviewNextWeekSummary: $('weeklyReviewNextWeekSummary'),
  weeklyReviewNextWeekList: $('weeklyReviewNextWeekList'),
  weeklyReviewGoals: $('weeklyReviewGoals'),
  dataCheckBtn: $('dataCheckBtn'),
  dataCheckDialog: $('dataCheckDialog'),
  closeDataCheckBtn: $('closeDataCheckBtn'),
  dataCheckSummary: $('dataCheckSummary'),
  dataCheckList: $('dataCheckList'),
  dataCheckFixBtn: $('dataCheckFixBtn'),
  dataCheckErrorLogSummary: $('dataCheckErrorLogSummary'),
  exportErrorLogBtn: $('exportErrorLogBtn'),
  clearErrorLogBtn: $('clearErrorLogBtn'),
  swUpdateBanner: $('swUpdateBanner'),
  swUpdateBtn: $('swUpdateBtn'),
  commandPaletteBtn: $('commandPaletteBtn'),
  commandPalette: $('commandPalette'),
  commandPaletteInput: $('commandPaletteInput'),
  commandPaletteResults: $('commandPaletteResults'),
};

// 全域錯誤紀錄：獨立於 init() 之外、無條件先掛上，這樣即使 init() 因為缺少畫面
// 元素（例如 tests.html 這種沒有完整 DOM 的頁面）而失敗，錯誤蒐集本身仍然有效。
setupErrorLogging();

// init() 包一層 try/catch：正常情況（index.html 有完整 DOM）不會走到 catch，
// 但 tests.html 只載入 app.js、沒有任何畫面元素時 init() 一定會因為存取 null
// 的 DOM 節點而丟出例外——沒有這層保護，例外會中斷整支 app.js 的執行，導致
// 檔案最底部的 window.CalendarApp 匯出永遠跑不到。
try {
  init();
} catch (err) {
  console.error('[app.js] init() 發生錯誤（若在 tests.html 等無 DOM 頁面屬預期行為）', err);
}

function init() {
  document.body.classList.toggle('widget-mode', widgetMode);
  applyTheme();
  bindSystemThemeListener();
  els.todayLabel.textContent = formatLongDate(new Date());
  applyTextSettings();

  // 全新安裝／無資料時保持空白，不再自動塞範例行程：
  // 範例行程曾在雲端同步時被誤推上雲端蓋掉正式資料，且對新使用者也未必需要。
  normalizeStoredData();
  const storedHolidays = getStoredHolidays();
  if (storedHolidays && storedHolidays.days) dynamicHolidays = storedHolidays.days;
  bindEvents();
  setupMobilePanels();
  setupVoiceInput();
  render();
  updatePomodoroDisplay();
  requestNotificationPermission();
  registerServiceWorker();
  handleUrlShortcutAction();
  handleShareTarget();
  handleNotifUrlAction();
  setInterval(checkReminders, 30 * 1000);

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

// ============================================================================
// 天氣整合（Open-Meteo，免金鑰）。零設定零影響：init() 只在非 file:// 且
// navigator.onLine 時才呼叫 fetchWeather()；任何失敗（無網路、定位被拒、API 掛掉）
// 都靜默降級，不顯示天氣、不影響其他功能，console 最多 warn 一次（見 weatherWarned）。
// WEATHER_KEY 只是顯示快取，刻意不納入 buildBackupPayload()/applyBackupObject()。
// ============================================================================

// WMO weather code → emoji。對照不到的代碼回傳空字串（顯示端會直接不占位）。
function weatherEmoji(code) {
  if (code === 0) return '☀️';
  if (code === 1 || code === 2) return '🌤';
  if (code === 3) return '☁️';
  if (code === 45 || code === 48) return '🌫';
  if (code >= 51 && code <= 67) return '🌧';
  if (code >= 71 && code <= 77) return '🌨';
  if (code >= 80 && code <= 82) return '🌦';
  if (code >= 95 && code <= 99) return '⛈';
  return '';
}

function getStoredWeather() {
  return loadJson(WEATHER_KEY, null);
}

function isWeatherFresh(w) {
  return Boolean(w && w.fetchedAt && (Date.now() - w.fetchedAt) < WEATHER_TTL_MS && w.days);
}

// ============================================================================
// 台灣假日自動更新（TaiwanCalendar CDN，免金鑰）。零設定零影響：init() 只在非 file:// 且
// navigator.onLine 時才呼叫 fetchHolidayUpdates()；30 天內不重抓（HOLIDAYS_TTL_MS）；
// 任何失敗（無網路、CDN 掛掉、格式異常）都靜默降級，繼續使用 TAIWAN_HOLIDAYS 靜態表，
// console 最多 warn 一次（見 holidayWarned）。HOLIDAYS_KEY 只是快取，刻意不納入
// buildBackupPayload()/applyBackupObject()。getHoliday() 會先查 dynamicHolidays，查無再查靜態表。
// ============================================================================

function getStoredHolidays() {
  return loadJson(HOLIDAYS_KEY, null);
}

function isHolidaysFresh(h) {
  return Boolean(h && h.fetchedAt && (Date.now() - h.fetchedAt) < HOLIDAYS_TTL_MS && h.days);
}

async function fetchHolidayUpdates() {
  try {
    if (isHolidaysFresh(getStoredHolidays())) return;
    const thisYear = new Date().getFullYear();
    const years = [thisYear, thisYear + 1];
    const results = await Promise.all(years.map(async (year) => {
      const res = await fetch(`https://cdn.jsdelivr.net/gh/ruyut/TaiwanCalendar/data/${year}.json`, { cache: 'no-store' });
      if (!res.ok) throw new Error(`holidays http ${res.status}`);
      const data = await res.json();
      if (!Array.isArray(data)) throw new Error('holidays data 格式異常');
      return data;
    }));
    const days = {};
    results.flat().forEach((item) => {
      if (!item || item.isHoliday !== true || !item.description) return;
      const raw = String(item.date || '');
      if (!/^\d{8}$/.test(raw)) return;
      const dateKey = `${raw.slice(0, 4)}-${raw.slice(4, 6)}-${raw.slice(6, 8)}`;
      days[dateKey] = item.description;
    });
    saveJson(HOLIDAYS_KEY, { fetchedAt: Date.now(), days });
    dynamicHolidays = days;
    render();
  } catch (err) {
    if (!holidayWarned) {
      holidayWarned = true;
      console.warn('[calendar] 假日資料更新失敗，改用內建靜態表', err);
    }
  }
}

// 取某天（'YYYY-MM-DD'）的天氣資料，沒有快取或該天不在 7 天預報內時回傳 null。
function getWeatherDay(dateKey) {
  const w = getStoredWeather();
  return (w && w.days && w.days[dateKey]) || null;
}

// 日檢視標題旁的天氣文字（emoji＋高低溫，降雨機率 ≥30% 才附加 ☔）。
// 拆成 weather-emoji / weather-temp 兩個 span，手機寬度可只縮小或隱藏溫度只留 emoji。
function weatherDayHtml(w) {
  const emoji = weatherEmoji(w.code);
  const rainPart = (typeof w.rain === 'number' && w.rain >= 30) ? ` ☔${w.rain}%` : '';
  return `<span class="weather-emoji">${emoji}</span><span class="weather-temp">高低溫 ↑${w.tmax}° ↓${w.tmin}°${rainPart}</span>`;
}

// 定位：優先用瀏覽器 geolocation（5 秒逾時），使用者拒絕／逾時／失敗一律 fallback 高雄，
// 不丟錯誤、不中斷天氣抓取流程。
function getWeatherGeoPosition() {
  return new Promise((resolve) => {
    if (!navigator.geolocation) {
      resolve({ lat: WEATHER_FALLBACK_LAT, lon: WEATHER_FALLBACK_LON });
      return;
    }
    let settled = false;
    const finish = (lat, lon) => {
      if (settled) return;
      settled = true;
      resolve({ lat, lon });
    };
    const timer = setTimeout(() => finish(WEATHER_FALLBACK_LAT, WEATHER_FALLBACK_LON), 5000);
    navigator.geolocation.getCurrentPosition(
      (pos) => { clearTimeout(timer); finish(pos.coords.latitude, pos.coords.longitude); },
      () => { clearTimeout(timer); finish(WEATHER_FALLBACK_LAT, WEATHER_FALLBACK_LON); },
      { timeout: 5000 }
    );
  });
}

// 抓 7 天天氣預報並存快取；3 小時內有新鮮快取就直接跳過不重抓。抓到新資料後呼叫
// render() 讓畫面補上天氣；任何一步失敗都靜默吞掉，最多 console.warn 一次。
async function fetchWeather() {
  try {
    if (isWeatherFresh(getStoredWeather())) return;
    const { lat, lon } = await getWeatherGeoPosition();
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max&timezone=Asia%2FTaipei&forecast_days=7`;
    const res = await fetch(url, { cache: 'no-store' });
    if (!res.ok) throw new Error(`weather http ${res.status}`);
    const data = await res.json();
    const daily = data && data.daily;
    if (!daily || !Array.isArray(daily.time)) throw new Error('weather data 格式異常');
    const days = {};
    daily.time.forEach((dateKey, i) => {
      days[dateKey] = {
        code: daily.weather_code[i],
        tmax: Math.round(daily.temperature_2m_max[i]),
        tmin: Math.round(daily.temperature_2m_min[i]),
        rain: Array.isArray(daily.precipitation_probability_max) ? daily.precipitation_probability_max[i] : null,
      };
    });
    saveJson(WEATHER_KEY, { fetchedAt: Date.now(), lat, lon, days });
    render();
  } catch (err) {
    if (!weatherWarned) {
      weatherWarned = true;
      console.warn('[calendar] 天氣資料抓取失敗，不影響本機功能', err);
    }
  }
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
  // 支援 showPicker() 的瀏覽器：把日期輸入框藏起來（版面乾淨），
  // 用 📅 按鈕或點標題開啟選擇器；不支援的舊瀏覽器保留小輸入框當備援、藏掉 📅 按鈕。
  const openDatePicker = () => {
    try {
      els.jumpDateInput?.showPicker?.();
    } catch {
      els.jumpDateInput?.focus();
    }
  };
  if (els.jumpDateInput && typeof els.jumpDateInput.showPicker === 'function') {
    els.jumpDateInput.classList.add('picker-hidden');
  } else if (els.jumpDateBtn) {
    els.jumpDateBtn.hidden = true;
  }
  els.jumpDateBtn?.addEventListener('click', openDatePicker);
  els.currentTitle.addEventListener('click', openDatePicker);
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
  els.deferBtn?.addEventListener('click', deferUnfinishedTasks);
  els.shareCardBtn?.addEventListener('click', generateShareCard);
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

  // 批量貼上匯入：見 openBatchAddDialog() 等函式（自然語言區塊下方）。
  els.batchAddBtn?.addEventListener('click', openBatchAddDialog);
  els.closeBatchAddBtn?.addEventListener('click', closeBatchAddDialog);
  els.batchAddCancelBtn?.addEventListener('click', closeBatchAddDialog);
  els.batchAddPreviewBtn?.addEventListener('click', renderBatchAddPreview);
  els.batchAddImportBtn?.addEventListener('click', importBatchAddRows);

  // 手機版「⋯ 更多」工具視窗：桌面版 moreToolsBtn 一直是 hidden（setupMobilePanels()
  // 只在手機才移除 hidden），所以這段綁定即使一律執行也不影響桌面行為。dialog 內每顆
  // 按鈕都是 proxy：先關 dialog，再對原本的按鈕呼叫 .click()，不用搬動任何原按鈕。
  els.moreToolsBtn?.addEventListener('click', () => els.moreToolsDialog?.showModal());
  els.closeMoreToolsBtn?.addEventListener('click', () => els.moreToolsDialog?.close());
  document.querySelectorAll('#moreToolsDialog [data-proxy]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const targetId = btn.dataset.proxy;
      els.moreToolsDialog?.close();
      document.getElementById(targetId)?.click();
    });
  });

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
  els.taskScope.addEventListener('change', handleTaskScopeChange);
  // 自然語言快速新增：標題欄位失焦時嘗試解析中文日期/時間語彙，見 parseNaturalDateTime()。
  els.taskTitle.addEventListener('blur', applyNaturalLanguageParse);
  // 找空檔：見 handleFindSlotClick() / findNextFreeSlot()（日期工具區）。
  els.findSlotBtn?.addEventListener('click', handleFindSlotClick);

  // 每週回顧：桌面工具列鈕與「⋯ 更多」視窗內的按鈕都直接開啟 weeklyReviewDialog
  // （更多視窗這顆不是 proxy click，是自己的 click handler）。
  els.weeklyReviewBtn?.addEventListener('click', openWeeklyReviewDialog);
  els.closeWeeklyReviewBtn?.addEventListener('click', closeWeeklyReviewDialog);
  els.moreToolsWeeklyReviewBtn?.addEventListener('click', () => {
    els.moreToolsDialog?.close();
    openWeeklyReviewDialog();
  });

  // 統計儀表板：手機版走 #moreToolsDialog 的 data-proxy="dashboardBtn"（沿用既有
  // proxy click 迴圈，不需要額外綁定）。逾期清單點擊比照 data-countdown-edit 的
  // 委派寫法，但用 data-dashboard-edit 這組新 dataset key 避免跟既有委派衝突。
  els.dashboardBtn?.addEventListener('click', openDashboardDialog);
  els.closeDashboardBtn?.addEventListener('click', closeDashboardDialog);
  els.dashboardOverdueList?.addEventListener('click', (event) => {
    const item = event.target.closest('[data-dashboard-edit]');
    if (!item) return;
    const task = tasks.find((t) => t.id === item.dataset.dashboardEdit);
    if (!task) return;
    closeDashboardDialog();
    openTaskDialog(task, item.dataset.dashboardDate || '');
  });

  // 資料檢查／修復工具：桌面工具列鈕；手機版由 CSS 隱藏、改走 #moreToolsDialog 的
  // data-proxy 按鈕（沿用既有 proxy click 迴圈，不需要額外綁定）。
  els.dataCheckBtn?.addEventListener('click', openDataCheckDialog);
  els.closeDataCheckBtn?.addEventListener('click', closeDataCheckDialog);
  els.dataCheckFixBtn?.addEventListener('click', handleDataCheckFix);
  els.exportErrorLogBtn?.addEventListener('click', exportErrorLog);
  els.clearErrorLogBtn?.addEventListener('click', clearErrorLog);

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

  // 全域命令面板（Ctrl+K / Cmd+K）：面板開著時原生 <dialog> 已經吃掉大部分鍵盤焦點，
  // 這裡沒有其他全域快捷鍵需要互斥，Esc 交給 <dialog> 原生行為關閉。
  els.commandPaletteBtn?.addEventListener('click', openCommandPalette);
  els.commandPaletteInput?.addEventListener('input', (event) => renderCommandPaletteResults(event.target.value));
  els.commandPaletteInput?.addEventListener('keydown', (event) => {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setCommandPaletteActive(commandPaletteActiveIndex + 1);
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setCommandPaletteActive(commandPaletteActiveIndex - 1);
    } else if (event.key === 'Enter') {
      event.preventDefault();
      runCommandPaletteActive();
    }
  });
  els.commandPaletteResults?.addEventListener('mousemove', (event) => {
    const item = event.target.closest('[data-cp-index]');
    if (item) setCommandPaletteActive(Number(item.dataset.cpIndex));
  });
  els.commandPaletteResults?.addEventListener('click', (event) => {
    const item = event.target.closest('[data-cp-index]');
    if (!item) return;
    commandPaletteActiveIndex = Number(item.dataset.cpIndex);
    runCommandPaletteActive();
  });
  document.addEventListener('keydown', (event) => {
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
      event.preventDefault();
      openCommandPalette();
    }
  });
}

// 全域命令面板（Ctrl+K）：COMMAND_PALETTE_ACTIONS 是固定指令清單，全部透過既有函式或
// 按鈕 .click() 觸發，不重複實作邏輯。輸入 >=1 字時額外把標題／備註符合關鍵字的行程
// 一併列進結果（最多 8 筆），Enter／點擊會跳到該行程日期的日檢視並開啟編輯視窗。
const COMMAND_PALETTE_ACTIONS = [
  { label: '新增行程', run: () => openTaskDialog({ date: toDateInput(currentDate) }) },
  { label: '今天', run: () => els.todayBtn.click() },
  { label: '日檢視', run: () => document.querySelector('.view-btn[data-view="day"]')?.click() },
  { label: '週檢視', run: () => document.querySelector('.view-btn[data-view="week"]')?.click() },
  { label: '月檢視', run: () => document.querySelector('.view-btn[data-view="month"]')?.click() },
  { label: '列表檢視', run: () => document.querySelector('.view-btn[data-view="agenda"]')?.click() },
  { label: '深色模式切換', run: () => els.themeBtn.click() },
  { label: '番茄鐘', run: () => els.pomodoroBtn.click() },
  { label: '週回顧', run: () => els.weeklyReviewBtn.click() },
  { label: '統計', run: () => els.dashboardBtn.click() },
  { label: '批量新增', run: () => els.batchAddBtn.click() },
  { label: '資料檢查', run: () => els.dataCheckBtn.click() },
  { label: '備份', run: () => els.backupBtn.click() },
  { label: '今日待辦模式', run: () => els.todayTodoBtn.click() },
];

let commandPaletteItems = [];
let commandPaletteActiveIndex = -1;

function openCommandPalette() {
  if (!els.commandPalette) return;
  if (els.commandPalette.open) {
    els.commandPaletteInput.focus();
    return;
  }
  els.commandPaletteInput.value = '';
  renderCommandPaletteResults('');
  els.commandPalette.showModal();
  els.commandPaletteInput.focus();
}

function closeCommandPalette() {
  els.commandPalette?.close();
}

function commandPaletteFuzzyMatch(text, query) {
  return String(text || '').toLowerCase().includes(query.toLowerCase());
}

function renderCommandPaletteResults(query) {
  const q = query.trim();
  const matchedCommands = COMMAND_PALETTE_ACTIONS.filter((cmd) => !q || commandPaletteFuzzyMatch(cmd.label, q));
  const matchedTasks = q
    ? tasks.filter((task) => commandPaletteFuzzyMatch(task.title, q) || commandPaletteFuzzyMatch(task.note, q)).slice(0, 8)
    : [];

  commandPaletteItems = [
    ...matchedCommands.map((cmd) => ({ type: 'command', label: cmd.label, run: cmd.run })),
    ...matchedTasks.map((task) => ({ type: 'task', label: task.title, sub: task.date, run: () => jumpToTaskAndEdit(task) })),
  ];

  if (!commandPaletteItems.length) {
    els.commandPaletteResults.innerHTML = '<li class="command-palette-empty">沒有符合的指令或行程</li>';
    commandPaletteActiveIndex = -1;
    return;
  }

  els.commandPaletteResults.innerHTML = commandPaletteItems.map((item, index) => `
    <li class="command-palette-item${index === 0 ? ' active' : ''}" data-cp-index="${index}">
      <span>${item.type === 'task' ? '🗓 ' : '⚡ '}${escapeHtml(item.label)}</span>
      ${item.sub ? `<span class="cp-sub">${escapeHtml(item.sub)}</span>` : ''}
    </li>
  `).join('');
  commandPaletteActiveIndex = 0;
}

function setCommandPaletteActive(index) {
  const items = els.commandPaletteResults.querySelectorAll('.command-palette-item');
  if (!items.length) return;
  commandPaletteActiveIndex = (index + items.length) % items.length;
  items.forEach((item, i) => item.classList.toggle('active', i === commandPaletteActiveIndex));
  items[commandPaletteActiveIndex].scrollIntoView({ block: 'nearest' });
}

function runCommandPaletteActive() {
  const item = commandPaletteItems[commandPaletteActiveIndex];
  if (!item) return;
  closeCommandPalette();
  item.run();
}

function jumpToTaskAndEdit(task) {
  currentView = 'day';
  document.querySelectorAll('.view-btn:not(.day-mode-btn)').forEach((btn) => btn.classList.toggle('active', btn.dataset.view === 'day'));
  currentDate = startOfDay(new Date(`${task.date}T00:00:00`));
  render();
  openTaskDialog(task, task.repeat && task.repeat !== 'none' ? task.date : '');
}

function render() {
  renderCategoryOptions();
  const visibleTasks = getFilteredTasks(tasks);
  renderTitle();
  renderDailyMemo();
  renderCalendar(visibleTasks);
  renderTodayPanel();
  renderCountdownPanel();
  renderWeeklyGoals();
  renderHabits();
  renderCategories();
  renderTemplates();
  updateModeButtons();
  updateDayModeSwitch();
  updateNotificationButton();
  updateAppBadge();
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
  if (currentView === 'agenda') els.currentTitle.textContent = '未來 30 天';
  els.lunarDayLabel.textContent = (currentView === 'day' && appSettings.showLunar) ? `🌙 農曆 ${lunarFullLabel(currentDate)}` : '';
  if (els.weatherDayLabel) {
    const dayWeather = currentView === 'day' ? getWeatherDay(toDateInput(currentDate)) : null;
    els.weatherDayLabel.innerHTML = dayWeather ? weatherDayHtml(dayWeather) : '';
  }
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
  if (currentView === 'agenda') renderAgenda(visibleTasks);
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
        const dayWeather = getWeatherDay(key);
        return `
          <div class="week-day ${isToday(day) ? 'today' : ''} ${holidayName ? 'holiday' : ''}" data-drop-date="${key}">
            <div class="day-head"><span>${weekdayName(day)}</span><span>${formatMonthDay(day)}${dayWeather ? `<span class="weather-mini">${weatherEmoji(dayWeather.code)}</span>` : ''}</span></div>
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
        const allDayTasks = visibleTasks.filter((task) => occursOnDate(task, key));
        const dayTasks = allDayTasks.slice().sort(compareTasks).slice(0, 4);
        const dayWeather = getWeatherDay(key);
        return `
          <div class="month-day ${heatClass(allDayTasks.length)} ${isToday(day) ? 'today' : ''} ${day.getMonth() !== currentDate.getMonth() ? 'outside' : ''} ${holidayName ? 'holiday' : ''}" data-drop-date="${key}" title="${allDayTasks.length} 筆行程">
            <div class="day-head"><span>${day.getDate()}${dayWeather ? `<span class="weather-mini">${weatherEmoji(dayWeather.code)}</span>` : ''}</span><button class="small-btn" data-new-date="${key}">＋</button></div>
            ${appSettings.showLunar ? `<div class="lunar-mini">${escapeHtml(lunarCellLabel(day))}</div>` : ''}
            ${holidayName ? `<div class="holiday-label">${escapeHtml(holidayName)}</div>` : ''}
            ${dayTasks.map((task) => taskCard(task, key)).join('')}
            ${allDayTasks.length > 4 ? '<span class="badge">更多...</span>' : ''}
          </div>
        `;
      }).join('')}
    </div>
  `;
}

// 月檢視熱力圖：依「當天行程數」加淡淡的主色底色，疊在最底層（class 加在最前面，
// 讓後面宣告的 .month-day.today／.month-day.holiday 這些既有規則在 CSS 來源順序上
// 仍然覆蓋得到，不會被熱力底色蓋掉）。0 筆不加 class；1–2 筆 mh-1；3–4 筆 mh-2；5 筆以上 mh-3。
function heatClass(count) {
  if (count >= 5) return 'mh-3';
  if (count >= 3) return 'mh-2';
  if (count >= 1) return 'mh-1';
  return '';
}

// Agenda 列表檢視（第四種檢視）：從 currentDate 起算 30 天，依日期分組，
// 完全沒行程的日期跳過不顯示；30 天內都沒行程時顯示空狀態。
function renderAgenda(visibleTasks) {
  const days = Array.from({ length: 30 }, (_, i) => addDays(currentDate, i));
  const todayKey = toDateInput(new Date());
  const tomorrowKey = toDateInput(addDays(new Date(), 1));

  const groups = days
    .map((day) => {
      const key = toDateInput(day);
      const dayTasks = visibleTasks.filter((task) => occursOnDate(task, key)).sort(compareTasks);
      return { day, key, dayTasks };
    })
    .filter((group) => group.dayTasks.length);

  if (!groups.length) {
    els.calendarView.innerHTML = '<div class="empty-state"><div><strong>未來 30 天沒有行程</strong><p>按「新增行程」開始安排。</p></div></div>';
    return;
  }

  els.calendarView.innerHTML = `
    <div class="agenda-list">
      ${groups.map(({ day, key, dayTasks }) => {
        const holidayName = getHoliday(key);
        const dayLabel = key === todayKey ? '今天　' : (key === tomorrowKey ? '明天　' : '');
        const dayWeather = getWeatherDay(key);
        return `
          <div class="agenda-group ${isToday(day) ? 'today' : ''}">
            <div class="agenda-date-head">
              <span class="agenda-date-main">${dayLabel}${weekdayName(day)}　${formatMonthDay(day)}</span>
              ${appSettings.showLunar ? `<span class="lunar-mini agenda-lunar">${escapeHtml(lunarCellLabel(day))}</span>` : ''}
              ${holidayName ? `<span class="holiday-label agenda-holiday">${escapeHtml(holidayName)}</span>` : ''}
              ${dayWeather ? `<span class="weather-mini agenda-weather"><span class="weather-emoji">${weatherEmoji(dayWeather.code)}</span> <span class="weather-temp">↑${dayWeather.tmax}° ↓${dayWeather.tmin}°</span></span>` : ''}
            </div>
            <div class="agenda-day-tasks">${dayTasks.map((task) => taskCard(task, key)).join('')}</div>
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

// 倒數日側欄面板：列出所有 countdown=true 的行程，依「下一次出現日期」（重複行程用
// nextCountdownOccurrence() 往前掃描找最近一次 >= 今天的出現日）由近到遠排序。
function renderCountdownPanel() {
  if (!els.countdownList) return;
  const todayKey = toDateInput(new Date());
  const items = tasks
    .filter((task) => task.countdown)
    .map((task) => {
      const dateKey = nextCountdownOccurrence(task, todayKey);
      return dateKey ? { task, dateKey } : null;
    })
    .filter(Boolean)
    .sort((a, b) => a.dateKey.localeCompare(b.dateKey));

  els.countdownList.innerHTML = items.length
    ? items.map(({ task, dateKey }) => {
        const days = diffDaysBetween(todayKey, dateKey);
        const daysLabel = days <= 0 ? '就是今天！' : `還有 ${days} 天`;
        const md = formatMonthDay(new Date(`${dateKey}T00:00:00`));
        return `
          <div class="countdown-item" data-countdown-edit="${task.id}" data-countdown-date="${dateKey}">
            <span class="countdown-days ${days <= 0 ? 'countdown-today' : ''}">${daysLabel}</span>
            <span class="countdown-title">${escapeHtml(task.title)}</span>
            <span class="muted">${md}</span>
          </div>
        `;
      }).join('')
    : '<p class="muted">尚無倒數事項</p>';
}

// 找出 task 從 fromDateKey（含）起算最近一次出現的日期。不重複行程直接比較 task.date；
// 重複行程逐日往後掃描（最多兩年），避免每天重算太久。
function nextCountdownOccurrence(task, fromDateKey) {
  if (task.repeat === 'none') {
    return task.date >= fromDateKey && occursOnDate(task, task.date) ? task.date : null;
  }
  let cursor = new Date(`${fromDateKey}T00:00:00`);
  for (let i = 0; i < 730; i++) {
    const key = toDateInput(cursor);
    if (occursOnDate(task, key)) return key;
    cursor = addDays(cursor, 1);
  }
  return null;
}

function diffDaysBetween(fromDateKey, toDateKey) {
  return Math.round((new Date(`${toDateKey}T00:00:00`) - new Date(`${fromDateKey}T00:00:00`)) / 86400000);
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
    countdown: false,
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
  if (els.deferBtn) els.deferBtn.hidden = !visible;
  if (els.shareCardBtn) els.shareCardBtn.hidden = !visible;
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

// 未完成行程一鍵順延到下個工作日：只處理「目前檢視日期」當天非重複且未完成的行程，
// 直接把 task.date 改到下一個工作日。重複行程跳過不動——改 date 對重複系列沒有單次
// 順延的意義（會連動整個系列的起始日/出現規則），使用者要調整請走既有的編輯功能。
function deferUnfinishedTasks() {
  const dateKey = toDateInput(currentDate);
  const targets = tasks.filter((task) => occursOnDate(task, dateKey) && task.repeat === 'none' && !isTaskDone(task, dateKey));
  if (!targets.length) return showToast('當天沒有可順延的未完成行程');

  const nextDate = nextWorkingDay(currentDate);
  const nextDateKey = toDateInput(nextDate);
  if (!confirm(`即將把 ${targets.length} 筆未完成行程順延到 ${formatMonthDay(nextDate)}，確定要繼續嗎？`)) return;

  targets.forEach((task) => { task.date = nextDateKey; });
  saveJson(STORAGE_KEY, tasks);
  render();
  showToast(`已順延 ${targets.length} 筆到 ${formatMonthDay(nextDate)}`);
}

// 當日行程分享圖卡：離屏 canvas 畫出當天行程清單，輸出 PNG 供分享或下載。
// 配色固定亮色系（不跟深色模式連動），字體、留白皆寫死，只服務「分享出去要好看」這件事。
function generateShareCard() {
  const dateKey = toDateInput(currentDate);
  const dayTasks = tasks.filter((task) => occursOnDate(task, dateKey)).sort(compareTasks);
  if (!dayTasks.length) return showToast('當天沒有行程');

  const WIDTH = 720;
  const HEADER_H = 150;
  const FOOTER_H = 60;
  const ROW_H = 64;
  const MAX_ROWS = 12;
  const visibleTasks = dayTasks.slice(0, MAX_ROWS);
  const overflowCount = dayTasks.length - visibleTasks.length;
  const listH = visibleTasks.length * ROW_H + (overflowCount > 0 ? ROW_H : 0);
  const height = HEADER_H + listH + FOOTER_H;

  const canvas = document.createElement('canvas');
  canvas.width = WIDTH;
  canvas.height = height;
  const ctx = canvas.getContext('2d');

  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, WIDTH, height);

  const weekday = new Intl.DateTimeFormat('zh-TW', { weekday: 'short' }).format(currentDate);
  const dateTitle = `${currentDate.getMonth() + 1}月${currentDate.getDate()}日 ${weekday}`;
  const lunarText = `農曆 ${lunarFullLabel(currentDate)}`;
  const holidayName = getHoliday(dateKey);

  ctx.fillStyle = '#4568f0';
  ctx.font = 'bold 28px "Microsoft JhengHei", sans-serif';
  ctx.fillText(dateTitle, 32, 58);

  ctx.fillStyle = '#777777';
  ctx.font = '15px "Microsoft JhengHei", sans-serif';
  ctx.fillText(lunarText, 32, 86);

  if (holidayName) {
    ctx.fillStyle = '#e0562f';
    ctx.font = 'bold 15px "Microsoft JhengHei", sans-serif';
    ctx.fillText(`🟢 ${holidayName}`, 32, 110);
  }

  ctx.strokeStyle = '#e6e9f5';
  ctx.beginPath();
  ctx.moveTo(0, HEADER_H);
  ctx.lineTo(WIDTH, HEADER_H);
  ctx.stroke();

  let y = HEADER_H;
  const titleX = 130;
  const maxTitleWidth = WIDTH - titleX - 56;
  visibleTasks.forEach((task) => {
    const done = isTaskDone(task, dateKey);
    const color = getCategoryColor(task.category);

    ctx.fillStyle = color;
    ctx.fillRect(0, y, 6, ROW_H);

    const timeLabel = task.start ? task.start : '全天';
    ctx.fillStyle = '#333333';
    ctx.font = '17px "Microsoft JhengHei", sans-serif';
    ctx.fillText(timeLabel, 26, y + ROW_H / 2 + 6);

    ctx.font = done ? '19px "Microsoft JhengHei", sans-serif' : 'bold 19px "Microsoft JhengHei", sans-serif';
    ctx.fillStyle = done ? '#9a9a9a' : '#222222';
    let displayTitle = task.title || '';
    while (ctx.measureText(displayTitle).width > maxTitleWidth && displayTitle.length > 1) {
      displayTitle = displayTitle.slice(0, -1);
    }
    if (displayTitle !== (task.title || '')) displayTitle += '…';
    const textY = y + ROW_H / 2 + 6;
    ctx.fillText(displayTitle, titleX, textY);

    if (done) {
      const titleWidth = ctx.measureText(displayTitle).width;
      ctx.strokeStyle = '#9a9a9a';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(titleX, textY - 6);
      ctx.lineTo(titleX + titleWidth, textY - 6);
      ctx.stroke();

      ctx.fillStyle = '#2fae6a';
      ctx.font = '20px sans-serif';
      ctx.fillText('✓', WIDTH - 44, textY);
    }

    ctx.strokeStyle = '#f0f1f8';
    ctx.beginPath();
    ctx.moveTo(6, y + ROW_H);
    ctx.lineTo(WIDTH, y + ROW_H);
    ctx.stroke();

    y += ROW_H;
  });

  if (overflowCount > 0) {
    ctx.fillStyle = '#999999';
    ctx.font = '17px "Microsoft JhengHei", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(`…還有 ${overflowCount} 筆`, WIDTH / 2, y + ROW_H / 2 + 6);
    ctx.textAlign = 'left';
    y += ROW_H;
  }

  const doneCount = dayTasks.filter((task) => isTaskDone(task, dateKey)).length;
  ctx.strokeStyle = '#e6e9f5';
  ctx.beginPath();
  ctx.moveTo(0, y);
  ctx.lineTo(WIDTH, y);
  ctx.stroke();

  ctx.fillStyle = '#4568f0';
  ctx.font = 'bold 22px "Microsoft JhengHei", sans-serif';
  ctx.fillText(`完成 ${doneCount}/${dayTasks.length}`, 32, y + FOOTER_H / 2 + 8);

  ctx.fillStyle = '#aaaaaa';
  ctx.font = '13px "Microsoft JhengHei", sans-serif';
  ctx.textAlign = 'right';
  ctx.fillText('桌面行程表', WIDTH - 32, y + FOOTER_H / 2 + 8);
  ctx.textAlign = 'left';

  canvas.toBlob(async (blob) => {
    if (!blob) return showToast('圖卡產生失敗');
    const filename = `行程卡_${dateKey}.png`;
    let shared = false;
    if (navigator.share && navigator.canShare) {
      try {
        const file = new File([blob], filename, { type: 'image/png' });
        if (navigator.canShare({ files: [file] })) {
          await navigator.share({ files: [file], title: dateTitle });
          shared = true;
        }
      } catch (err) {
        if (err?.name === 'AbortError') shared = true;
      }
    }
    if (shared) return;
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);
    showToast('已下載圖卡');
  }, 'image/png');
}

// 下一個工作日：從隔天開始往後找，跳過週六日與 TAIWAN_HOLIDAYS（國定假日對照表，見 getHoliday()）。
function nextWorkingDay(date) {
  let next = addDays(startOfDay(date), 1);
  while (next.getDay() === 0 || next.getDay() === 6 || getHoliday(toDateInput(next))) {
    next = addDays(next, 1);
  }
  return next;
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
    const streak = habitStreak(habit);
    const streakBadge = streak >= 2 ? `<span class="streak-badge">🔥${streak}</span>` : '';
    return `
      <div class="habit-item">
        <label><input type="checkbox" ${checked ? 'checked' : ''} data-toggle-habit="${habit.id}" /> ${escapeHtml(habit.name)}</label>
        <span class="streak">${streakBadge}<button class="small-btn" data-delete-habit="${habit.id}">✕</button></span>
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

// ----------------------------------------------------------------------------
// 每週回顧：computeWeeklyReview() 是不碰 DOM 的純函式（只讀全域 tasks / weeklyGoals /
// categories），回傳本週/上週完成率、分類統計、下週預覽、每週目標完成情況；渲染邏輯
// 另外寫在 renderWeeklyReview()。重複行程沿用 occursOnDate() 判斷「每天算一次出現」，
// 完成判定沿用既有 isTaskDone()。
// ----------------------------------------------------------------------------
function computeWeeklyReview(baseDate) {
  const base = startOfDay(baseDate instanceof Date && !Number.isNaN(baseDate.getTime()) ? baseDate : new Date());
  const thisMonday = startOfWeek(base);
  const prevMonday = addDays(thisMonday, -7);
  const nextMonday = addDays(thisMonday, 7);

  const scanWeek = (monday) => {
    const dayKeys = Array.from({ length: 7 }, (_, i) => toDateInput(addDays(monday, i)));
    let total = 0;
    let done = 0;
    const categoryStats = new Map();
    dayKeys.forEach((dateKey) => {
      tasks.forEach((task) => {
        if (!occursOnDate(task, dateKey)) return;
        total += 1;
        const isDone = isTaskDone(task, dateKey);
        if (isDone) done += 1;
        const stat = categoryStats.get(task.category) || { total: 0, done: 0 };
        stat.total += 1;
        if (isDone) stat.done += 1;
        categoryStats.set(task.category, stat);
      });
    });
    return {
      start: dayKeys[0],
      end: dayKeys[6],
      total,
      done,
      rate: total ? Math.round((done / total) * 100) : 0,
      categoryStats,
    };
  };

  const currentWeek = scanWeek(thisMonday);
  const previousWeek = scanWeek(prevMonday);

  let trend = 'same';
  if (currentWeek.rate > previousWeek.rate) trend = 'up';
  else if (currentWeek.rate < previousWeek.rate) trend = 'down';

  const categoryList = categories
    .map((category) => {
      const stat = currentWeek.categoryStats.get(category.name);
      return stat ? { name: category.name, color: category.color, done: stat.done, total: stat.total } : null;
    })
    .filter(Boolean)
    .sort((a, b) => b.total - a.total)
    .slice(0, 6);

  const nextWeekDayKeys = Array.from({ length: 7 }, (_, i) => toDateInput(addDays(nextMonday, i)));
  const nextWeekItems = [];
  nextWeekDayKeys.forEach((dateKey) => {
    tasks
      .filter((task) => occursOnDate(task, dateKey))
      .sort((a, b) => a.start.localeCompare(b.start))
      .forEach((task) => nextWeekItems.push({ date: dateKey, title: task.title }));
  });

  const weekKey = toDateInput(thisMonday);
  const goalsThisWeek = weeklyGoals.filter((goal) => goal.week === weekKey);

  return {
    currentWeek: { start: currentWeek.start, end: currentWeek.end, total: currentWeek.total, done: currentWeek.done, rate: currentWeek.rate },
    previousWeek: { start: previousWeek.start, end: previousWeek.end, total: previousWeek.total, done: previousWeek.done, rate: previousWeek.rate },
    trend,
    categories: categoryList,
    nextWeek: { total: nextWeekItems.length, items: nextWeekItems.slice(0, 3) },
    goals: { total: goalsThisWeek.length, done: goalsThisWeek.filter((goal) => Boolean(goal.done)).length },
  };
}

function renderWeeklyReview() {
  const data = computeWeeklyReview(new Date());

  els.weeklyReviewRateValue.textContent = `${data.currentWeek.rate}%`;
  els.weeklyReviewCountsLabel.textContent = `總行程 ${data.currentWeek.total} 件｜已完成 ${data.currentWeek.done} 件`;

  const trendIcon = data.trend === 'up' ? '↑' : (data.trend === 'down' ? '↓' : '→');
  els.weeklyReviewCompare.textContent = `上週完成率 ${data.previousWeek.rate}%　${trendIcon}　本週完成率 ${data.currentWeek.rate}%`;

  els.weeklyReviewCategories.innerHTML = data.categories.length
    ? data.categories.map((cat) => `
        <div class="weekly-review-category-row">
          <span class="color-dot" style="--dot-color:${cat.color}"></span>
          <span class="weekly-review-category-name">${escapeHtml(cat.name)}</span>
          <span class="muted">${cat.done} / ${cat.total}</span>
        </div>
      `).join('')
    : '<p class="muted">本週尚無分類資料</p>';

  els.weeklyReviewNextWeekSummary.textContent = `下週已排定 ${data.nextWeek.total} 件行程`;
  els.weeklyReviewNextWeekList.innerHTML = data.nextWeek.items.length
    ? data.nextWeek.items.map((item) => `<li>${formatMonthDay(new Date(`${item.date}T00:00:00`))}　${escapeHtml(item.title)}</li>`).join('')
    : '<li class="muted">下週尚無排定行程</li>';

  els.weeklyReviewGoals.textContent = data.goals.total
    ? `本週目標：已完成 ${data.goals.done} / ${data.goals.total} 項`
    : '本週尚未設定每週目標';
}

function openWeeklyReviewDialog() {
  renderWeeklyReview();
  els.weeklyReviewDialog.showModal();
}

function closeWeeklyReviewDialog() {
  els.weeklyReviewDialog.close();
}

// ----------------------------------------------------------------------------
// 統計儀表板：computeDashboardStats() 是不碰 DOM 的純函式（只讀全域 tasks /
// categories），只用既有資料（出現次數／completedDates／start・end／category）
// 算四塊統計，不要求任何新紀錄。重複行程沿用 occursOnDate() 判斷「每天算一次出現」，
// 完成判定沿用既有 isTaskDone()。渲染邏輯另外寫在 renderDashboard()。
// ----------------------------------------------------------------------------
function computeDashboardStats(baseDate) {
  const base = startOfDay(baseDate instanceof Date && !Number.isNaN(baseDate.getTime()) ? baseDate : new Date());
  const rangeDays = 30;
  const dayKeys = Array.from({ length: rangeDays }, (_, i) => toDateInput(addDays(base, -(rangeDays - 1) + i)));

  const categoryMinutes = new Map();
  const overdueItems = [];
  let overdueTotal = 0;
  let occurrenceTotal = 0;
  const timeBuckets = { morning: 0, afternoon: 0, evening: 0, dawn: 0 };

  dayKeys.forEach((dateKey) => {
    const dateObj = startOfDay(new Date(`${dateKey}T00:00:00`));
    tasks.forEach((task) => {
      if (!occursOnDate(task, dateKey)) return;
      occurrenceTotal += 1;
      const isDone = isTaskDone(task, dateKey);

      const startMin = timeToMinutes(task.start);
      const endMin = timeToMinutes(task.end);
      const duration = (task.start && task.end && endMin > startMin) ? endMin - startMin : 0;
      const catName = task.category || '未分類';
      categoryMinutes.set(catName, (categoryMinutes.get(catName) || 0) + duration);

      if (!isDone && dateObj < base) {
        overdueTotal += 1;
        overdueItems.push({ id: task.id, title: task.title, date: dateKey });
      }

      if (task.start) {
        const hour = Math.floor(startMin / 60);
        if (hour >= 5 && hour < 12) timeBuckets.morning += 1;
        else if (hour >= 12 && hour < 18) timeBuckets.afternoon += 1;
        else if (hour >= 18 && hour < 24) timeBuckets.evening += 1;
        else timeBuckets.dawn += 1;
      }
    });
  });

  const categoryHours = Array.from(categoryMinutes.entries())
    .map(([name, minutes]) => ({ name, color: getCategoryColor(name), hours: minutes / 60 }))
    .filter((item) => item.hours > 0)
    .sort((a, b) => b.hours - a.hours)
    .slice(0, 8);
  const maxCategoryHours = categoryHours.reduce((max, item) => Math.max(max, item.hours), 0);

  const thisMonday = startOfWeek(base);
  const weeklyTrend = Array.from({ length: 8 }, (_, i) => {
    const monday = addDays(thisMonday, -(7 - i) * 7);
    const weekDayKeys = Array.from({ length: 7 }, (_, d) => toDateInput(addDays(monday, d)));
    let total = 0;
    let done = 0;
    weekDayKeys.forEach((dateKey) => {
      tasks.forEach((task) => {
        if (!occursOnDate(task, dateKey)) return;
        total += 1;
        if (isTaskDone(task, dateKey)) done += 1;
      });
    });
    return {
      label: `${monday.getMonth() + 1}/${monday.getDate()}`,
      rate: total ? Math.round((done / total) * 100) : 0,
      total,
      done,
    };
  });

  overdueItems.sort((a, b) => a.date.localeCompare(b.date));

  return {
    rangeStart: dayKeys[0],
    rangeEnd: dayKeys[dayKeys.length - 1],
    categoryHours,
    maxCategoryHours,
    weeklyTrend,
    overdue: {
      total: overdueTotal,
      ratio: occurrenceTotal ? Math.round((overdueTotal / occurrenceTotal) * 100) : 0,
      occurrenceTotal,
      items: overdueItems.slice(0, 5),
    },
    timeDistribution: [
      { label: '早 05-12', count: timeBuckets.morning },
      { label: '午 12-18', count: timeBuckets.afternoon },
      { label: '晚 18-24', count: timeBuckets.evening },
      { label: '凌晨 00-05', count: timeBuckets.dawn },
    ],
  };
}

function renderDashboard() {
  const data = computeDashboardStats(new Date());

  els.dashboardCategoryHours.innerHTML = data.categoryHours.length
    ? data.categoryHours.map((item) => `
        <div class="dashboard-bar-row">
          <div class="dashboard-bar-head">
            <span class="color-dot" style="--dot-color:${item.color}"></span>
            <span class="dashboard-bar-label">${escapeHtml(item.name)}</span>
            <span class="dashboard-bar-value">${item.hours.toFixed(1)} 小時</span>
          </div>
          <div class="dashboard-bar-track"><div class="dashboard-bar-fill" style="width:${data.maxCategoryHours ? Math.round((item.hours / data.maxCategoryHours) * 100) : 0}%"></div></div>
        </div>
      `).join('')
    : '<p class="muted">尚無資料</p>';

  els.dashboardWeeklyTrend.innerHTML = data.weeklyTrend.some((week) => week.total > 0)
    ? `<div class="dashboard-trend-chart">${data.weeklyTrend.map((week) => `
        <div class="dashboard-trend-col">
          <span class="dashboard-trend-value">${week.rate}%</span>
          <div class="dashboard-trend-bar-track"><div class="dashboard-trend-bar-fill" style="height:${Math.round((week.rate / 100) * 96)}px"></div></div>
          <span class="dashboard-trend-label">${escapeHtml(week.label)}</span>
        </div>
      `).join('')}</div>`
    : '<p class="muted">尚無資料</p>';

  els.dashboardOverdueSummary.textContent = data.overdue.occurrenceTotal
    ? `近 30 天共 ${data.overdue.occurrenceTotal} 筆行程出現，逾期未完成 ${data.overdue.total} 筆（${data.overdue.ratio}%）`
    : '尚無資料';
  els.dashboardOverdueList.innerHTML = data.overdue.items.length
    ? data.overdue.items.map((item) => `
        <li class="dashboard-overdue-item" data-dashboard-edit="${item.id}" data-dashboard-date="${item.date}">
          <span class="dashboard-overdue-date">${formatMonthDay(new Date(`${item.date}T00:00:00`))}</span>
          <span class="dashboard-overdue-title">${escapeHtml(item.title)}</span>
        </li>
      `).join('')
    : '<li class="muted">尚無資料</li>';

  const maxBucket = data.timeDistribution.reduce((max, bucket) => Math.max(max, bucket.count), 0);
  els.dashboardTimeDistribution.innerHTML = maxBucket
    ? data.timeDistribution.map((bucket) => `
        <div class="dashboard-bar-row">
          <div class="dashboard-bar-head">
            <span class="dashboard-bar-label">${bucket.label}</span>
            <span class="dashboard-bar-value">${bucket.count} 筆</span>
          </div>
          <div class="dashboard-bar-track"><div class="dashboard-bar-fill" style="width:${Math.round((bucket.count / maxBucket) * 100)}%"></div></div>
        </div>
      `).join('')
    : '<p class="muted">尚無資料</p>';
}

function openDashboardDialog() {
  renderDashboard();
  els.dashboardDialog.showModal();
}

function closeDashboardDialog() {
  els.dashboardDialog.close();
}

function openTaskDialog(defaults = {}, occurrenceDate = '') {
  renderCategoryOptions();
  const isEdit = Boolean(defaults.id);
  const isRecurringOccurrence = isEdit && defaults.repeat !== 'none' && Boolean(occurrenceDate);
  editingOccurrenceDate = isRecurringOccurrence ? occurrenceDate : '';
  els.dialogTitle.textContent = isRecurringOccurrence ? '編輯重複行程' : (isEdit ? '編輯行程' : '新增行程');
  els.taskId.value = defaults.id || '';
  els.taskTitle.value = defaults.title || '';
  els.taskDate.value = editingOccurrenceDate || defaults.date || toDateInput(currentDate);
  els.taskStart.value = defaults.start || '09:00';
  els.taskEnd.value = defaults.end || '10:00';
  els.taskPriority.value = defaults.priority || 'medium';
  els.taskCategory.value = defaults.category || '工作';
  els.taskRepeat.value = defaults.repeat || 'none';
  const repeatBaseDate = defaults.date ? new Date(`${defaults.date}T00:00:00`) : currentDate;
  els.taskRepeatInterval.value = String(Math.min(365, Math.max(2, Number(defaults.repeatInterval) || 2)));
  els.taskRepeatNth.value = String([1, 2, 3, 4, -1].includes(Number(defaults.repeatNth)) ? Number(defaults.repeatNth) : nthWeekdayInMonth(repeatBaseDate));
  els.taskRepeatWeekday.value = String(typeof defaults.repeatWeekday === 'number' ? defaults.repeatWeekday : repeatBaseDate.getDay());
  els.taskScopeField.hidden = !isRecurringOccurrence;
  els.taskScope.value = isRecurringOccurrence ? 'once' : 'series';
  if (isRecurringOccurrence) {
    els.taskScopeHint.textContent = `其他重複日期不會受影響（${formatMonthDay(new Date(`${occurrenceDate}T00:00:00`))}）`;
  }
  updateRepeatFieldsVisibility();
  els.taskReminder.value = String(defaults.reminder ?? 10);
  els.taskPinned.checked = Boolean(defaults.pinned);
  els.taskCountdown.checked = Boolean(defaults.countdown);
  els.taskTags.value = (defaults.tags || []).map((tag) => `#${tag}`).join(', ');
  els.taskSubtasks.value = (defaults.subtasks || []).join('\n');
  els.taskNote.value = defaults.note || '';
  els.deleteTaskBtn.hidden = !isEdit;
  updateConflictWarning();
  // 自然語言快速新增：記錄這次開窗當下日期/開始/結束的預設值，saveTaskFromForm() 送出前
  // 的保險解析只在欄位仍等於這份快照時才套用，避免蓋掉使用者手動改過的欄位。
  taskDialogDefaults = { date: els.taskDate.value, start: els.taskStart.value, end: els.taskEnd.value };
  els.taskDialog.showModal();
  els.taskTitle.focus();
}

function closeTaskDialog() {
  els.taskDialog.close();
  els.taskForm.reset();
  els.taskScopeField.hidden = true;
  editingOccurrenceDate = '';
  els.conflictWarning.hidden = true;
}

function updateRepeatFieldsVisibility() {
  const repeat = els.taskRepeat.value;
  const isInterval = repeat === 'interval';
  const isNth = repeat === 'monthlyNth';

  els.repeatIntervalField.hidden = !isInterval;
  els.taskRepeatInterval.disabled = !isInterval;

  els.repeatNthField.hidden = !isNth;
  els.taskRepeatNth.disabled = !isNth;

  els.repeatWeekdayField.hidden = !isNth;
  els.taskRepeatWeekday.disabled = !isNth;
}

function handleTaskScopeChange() {
  if (!editingOccurrenceDate) return;
  const existingTask = tasks.find((item) => item.id === els.taskId.value);

  if (els.taskScope.value === 'series') {
    if (existingTask && existingTask.date) {
      els.taskDate.value = existingTask.date;
    }
    els.taskScopeHint.textContent = '這會修改整個重複系列，以此日期為系列起始日。';
  } else if (els.taskScope.value === 'future') {
    els.taskDate.value = editingOccurrenceDate;
    els.taskScopeHint.textContent = `這會修改此日期及之後所有重複日期，之前的日期不受影響。`;
  } else {
    els.taskDate.value = editingOccurrenceDate;
    els.taskScopeHint.textContent = `其他重複日期不會受影響（${formatMonthDay(new Date(`${editingOccurrenceDate}T00:00:00`))}）`;
  }

  updateConflictWarning();
}

function saveTaskFromForm(event) {
  event.preventDefault();
  // 保險再解析一次：正常流程 blur 已經處理過，這裡是給「Enter 直接送出、taskTitle
  // 沒機會 blur」的情況兜底，且只在日期/時間欄位仍是開窗當下的預設值時才套用。
  applyNaturalLanguageParseOnSubmit();
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
    countdown: els.taskCountdown.checked,
    tags: parseTags(els.taskTags.value),
    subtasks: linesFromTextarea(els.taskSubtasks.value),
    note: els.taskNote.value.trim(),
    completedDates: existingTask?.completedDates || [],
    excludedDates: existingTask?.excludedDates || [],
    repeatUntil: existingTask?.repeatUntil || '',
    sortOrder: existingTask?.sortOrder || Date.now(),
    createdAt: existingTask?.createdAt || new Date().toISOString(),
  };

  if (!task.title) return showToast('請輸入事項名稱');
  if (task.end <= task.start) return showToast('結束時間需晚於開始時間');

  const editOnce = Boolean(existingTask && editingOccurrenceDate && existingTask.repeat !== 'none' && els.taskScope.value === 'once');
  const editFuture = Boolean(existingTask && editingOccurrenceDate && existingTask.repeat !== 'none' && els.taskScope.value === 'future');
  if (editOnce) {
    existingTask.excludedDates = [...new Set([...(existingTask.excludedDates || []), editingOccurrenceDate])];
    tasks.push({
      ...task,
      id: crypto.randomUUID(),
      date: task.date,
      repeat: 'none',
      completedDates: (existingTask.completedDates || []).includes(editingOccurrenceDate) ? [task.date] : [],
      excludedDates: [],
      originalSeriesId: existingTask.id,
      originalOccurrenceDate: editingOccurrenceDate,
      sortOrder: Date.now(),
      createdAt: new Date().toISOString(),
    });
  } else if (editFuture) {
    if (existingTask.date === editingOccurrenceDate) {
      const index = tasks.findIndex((item) => item.id === task.id);
      if (index >= 0) tasks[index] = task;
      else tasks.push(task);
    } else {
      const splitDate = editingOccurrenceDate;
      const splitUntil = toDateInput(addDays(new Date(`${splitDate}T00:00:00`), -1));
      const oldExcludedDates = Array.isArray(existingTask.excludedDates) ? existingTask.excludedDates : [];
      const preservedExcludedDates = oldExcludedDates.filter((date) => date >= splitDate);
      existingTask.excludedDates = oldExcludedDates.filter((date) => date < splitDate);
      existingTask.repeatUntil = splitUntil;
      const originalCompleted = Array.isArray(existingTask.completedDates) ? existingTask.completedDates : [];
      tasks.push({
        ...task,
        id: crypto.randomUUID(),
        date: splitDate,
        excludedDates: preservedExcludedDates,
        completedDates: originalCompleted.filter((date) => date >= splitDate),
        originalSeriesId: existingTask.id,
        originalOccurrenceDate: splitDate,
        sortOrder: Date.now(),
        createdAt: new Date().toISOString(),
      });
    }
  } else {
    const index = tasks.findIndex((item) => item.id === task.id);
    if (index >= 0) tasks[index] = task;
    else tasks.push(task);
  }

  saveJson(STORAGE_KEY, tasks);
  closeTaskDialog();
  render();
  showToast(editOnce ? '已修改這次行程' : '行程已儲存');
}

// ----------------------------------------------------------------------------
// 批量貼上匯入：textarea 每行一筆，逐行丟給 parseNaturalDateTime() 解析日期/時間，
// 解析不到的欄位用今天/全天。新增的 task 物件欄位形狀比照 saveTaskFromForm() 的預設值
// （priority: medium、category: 分類清單第一項、repeat: none...），只是跳過表單 UI。
// ----------------------------------------------------------------------------
const BATCH_ADD_MAX_LINES = 50;
let batchAddParsedRows = [];

function openBatchAddDialog() {
  els.batchAddInput.value = '';
  els.batchAddHint.hidden = true;
  els.batchAddPreviewWrap.hidden = true;
  els.batchAddPreviewBody.innerHTML = '';
  els.batchAddImportBtn.disabled = true;
  batchAddParsedRows = [];
  els.batchAddDialog.showModal();
  els.batchAddInput.focus();
}

function closeBatchAddDialog() {
  els.batchAddDialog.close();
}

function batchAddParseLines() {
  const rawLines = els.batchAddInput.value.split('\n').map((line) => line.trim()).filter(Boolean);
  let lines = rawLines;
  if (rawLines.length > BATCH_ADD_MAX_LINES) {
    lines = rawLines.slice(0, BATCH_ADD_MAX_LINES);
    els.batchAddHint.textContent = `⚠️ 超過 ${BATCH_ADD_MAX_LINES} 行，僅解析前 ${BATCH_ADD_MAX_LINES} 筆（原始共 ${rawLines.length} 行）。`;
    els.batchAddHint.hidden = false;
  } else {
    els.batchAddHint.hidden = true;
  }

  return lines.map((line) => {
    const parsed = parseNaturalDateTime(line, new Date());
    const title = (parsed.title || '').trim() || line;
    return { title, date: parsed.date || '', start: parsed.start || '', end: parsed.end || '' };
  });
}

function renderBatchAddPreview() {
  const rows = batchAddParseLines();
  batchAddParsedRows = rows;

  els.batchAddPreviewBody.innerHTML = rows.map((row) => {
    const dateLabel = row.date ? formatMonthDay(new Date(`${row.date}T00:00:00`)) : '今天';
    const timeLabel = row.start ? `${row.start}–${row.end || row.start}` : '全天';
    return `<tr><td>${escapeHtml(row.title)}</td><td>${escapeHtml(dateLabel)}</td><td>${escapeHtml(timeLabel)}</td></tr>`;
  }).join('');
  els.batchAddPreviewWrap.hidden = rows.length === 0;
  els.batchAddImportBtn.disabled = rows.length === 0;
  if (!rows.length) showToast('沒有可解析的行程，請確認貼上的內容');
}

function importBatchAddRows() {
  const rows = batchAddParsedRows.length ? batchAddParsedRows : batchAddParseLines();
  const validRows = rows.filter((row) => row.title);
  if (!validRows.length) return showToast('沒有可匯入的行程');

  const todayKey = toDateInput(new Date());
  validRows.forEach((row) => {
    tasks.push({
      id: crypto.randomUUID(),
      title: row.title,
      date: row.date || todayKey,
      start: row.start || '',
      end: row.end || '',
      priority: 'medium',
      category: categories[0]?.name || '工作',
      repeat: 'none',
      repeatInterval: 2,
      repeatWeekday: 0,
      repeatNth: 1,
      reminder: 10,
      pinned: false,
      countdown: false,
      tags: [],
      subtasks: [],
      note: '',
      completedDates: [],
      excludedDates: [],
      repeatUntil: '',
      sortOrder: Date.now(),
      createdAt: new Date().toISOString(),
    });
  });

  saveJson(STORAGE_KEY, tasks);
  closeBatchAddDialog();
  render();
  showToast(`已新增 ${validRows.length} 筆`);
}

// ----------------------------------------------------------------------------
// 自然語言快速新增：DOM 掛接層。實際解析邏輯是不依賴 DOM 的純函式 parseNaturalDateTime()
// （定義在檔案底部日期工具區），這裡只負責讀 #taskTitle、套用解析結果到表單欄位、
// 顯示 toast。解析不到任何日期/時間語彙時完全不動作。
// ----------------------------------------------------------------------------
function applyNaturalLanguageParse() {
  const parsed = parseNaturalDateTime(els.taskTitle.value, new Date());
  if (!parsed.date && !parsed.start) return;

  if (parsed.date) els.taskDate.value = parsed.date;
  if (parsed.start) els.taskStart.value = parsed.start;
  if (parsed.end) els.taskEnd.value = parsed.end;
  els.taskTitle.value = parsed.title;
  updateConflictWarning();

  const toastParts = [];
  if (parsed.date) toastParts.push(formatMonthDay(new Date(`${parsed.date}T00:00:00`)));
  if (parsed.start) toastParts.push(parsed.start);
  if (toastParts.length) showToast(`已解析：${toastParts.join(' ')}`);
}

// saveTaskFromForm() 送出前的保險呼叫：只在標題仍含可解析語彙、且日期/開始/結束欄位
// 都還是開窗當下的預設值（taskDialogDefaults，代表使用者沒手動改過）時才個別套用，
// 避免蓋掉使用者手動調整過的欄位。正常情況下 blur 已經處理過，這裡多半是 no-op。
function applyNaturalLanguageParseOnSubmit() {
  const parsed = parseNaturalDateTime(els.taskTitle.value, new Date());
  if (!parsed.date && !parsed.start) return;

  if (parsed.date && els.taskDate.value === taskDialogDefaults.date) els.taskDate.value = parsed.date;
  if (parsed.start && els.taskStart.value === taskDialogDefaults.start) els.taskStart.value = parsed.start;
  if (parsed.end && els.taskEnd.value === taskDialogDefaults.end) els.taskEnd.value = parsed.end;
  els.taskTitle.value = parsed.title;
}

// ----------------------------------------------------------------------------
// 語音輸入：偵測不到 SpeechRecognition API 的瀏覽器直接把按鈕整顆移除（降級）。
// 支援的瀏覽器：點擊開始聆聽（🎤→🔴），辨識結果 append 到 #taskTitle 現有文字後，
// 再主動觸發一次自然語言解析；再點一次可停止；錯誤（如使用者拒絕權限）toast 提示並還原按鈕。
// ----------------------------------------------------------------------------
function setupVoiceInput() {
  const btn = els.voiceInputBtn;
  if (!btn) return;
  const SpeechRecognitionCtor = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SpeechRecognitionCtor) {
    btn.remove();
    return;
  }

  const recognition = new SpeechRecognitionCtor();
  recognition.lang = 'zh-TW';
  recognition.interimResults = false;
  let listening = false;

  const resetButton = () => {
    listening = false;
    btn.textContent = '🎤';
    btn.title = '語音輸入';
  };

  recognition.addEventListener('result', (event) => {
    const transcript = event.results?.[0]?.[0]?.transcript?.trim() || '';
    if (transcript) {
      const existing = els.taskTitle.value.trim();
      els.taskTitle.value = existing ? `${existing} ${transcript}` : transcript;
      applyNaturalLanguageParse();
    }
  });
  recognition.addEventListener('error', () => {
    showToast('無法使用麥克風');
    resetButton();
  });
  recognition.addEventListener('end', resetButton);

  btn.addEventListener('click', () => {
    if (listening) {
      recognition.stop();
      return;
    }
    try {
      recognition.start();
      listening = true;
      btn.textContent = '🔴';
      btn.title = '聆聽中…再按一次停止';
    } catch {
      showToast('無法使用麥克風');
      resetButton();
    }
  });
}

function deleteCurrentTask() {
  const id = els.taskId.value;
  if (!id) return;
  const task = tasks.find((item) => item.id === id);
  const deleteOnce = Boolean(task && editingOccurrenceDate && task.repeat !== 'none' && els.taskScope.value === 'once');
  if (deleteOnce) {
    task.excludedDates = [...new Set([...(task.excludedDates || []), editingOccurrenceDate])];
  } else {
    tasks = tasks.filter((item) => item.id !== id);
  }
  saveJson(STORAGE_KEY, tasks);
  closeTaskDialog();
  render();
  showToast(deleteOnce ? '已刪除這次行程' : '行程已刪除');
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
  const countdownEditId = event.target.closest('[data-countdown-edit]')?.dataset.countdownEdit;

  if (countdownEditId) {
    const countdownItem = event.target.closest('[data-countdown-edit]');
    const task = tasks.find((item) => item.id === countdownEditId);
    if (task) openTaskDialog(task, countdownItem?.dataset.countdownDate || '');
  }
  if (applyTemplateId) applyTemplate(applyTemplateId);
  if (deleteTemplateId) deleteTemplate(deleteTemplateId);
  if (pinId) toggleTaskPinned(pinId);
  if (copyId) copyTaskToTomorrow(copyId);
  if (editId) {
    const task = tasks.find((item) => item.id === editId);
    const occurrenceDate = event.target.closest('[data-task-date]')?.dataset.taskDate || '';
    if (task) openTaskDialog(task, occurrenceDate);
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
    if (task) openTaskDialog(task, timelineBlock.dataset.taskDate || '');
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
  if (currentView === 'agenda') currentDate = addDays(currentDate, direction * 30);
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
    els.conflictWarning.textContent = `⚠️ 與下列行程時間重疊：${conflicts.map((task) => `${task.start}–${task.end} ${task.title}（${task.category}）`).join('、')}。請調整時間或儲存後手動確認。`;
  } else {
    els.conflictWarning.hidden = true;
  }
}

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
    setTaskDone(task, dateKey, true);
    playDoneSound();
    render();
    showToast(`已完成：${task.title}`);
  } else if (action === 'snooze') {
    if (reminderSnoozeTimers.has(timerKey)) clearTimeout(reminderSnoozeTimers.get(timerKey));
    const timer = setTimeout(() => {
      reminderSnoozeTimers.delete(timerKey);
      showTaskNotification(task, dateKey, `行程提醒：${task.title}`, `${task.reminder ? `${task.reminder} 分鐘後` : '現在'}開始｜${task.category}`);
    }, 10 * 60 * 1000);
    reminderSnoozeTimers.set(timerKey, timer);
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
    // 'lunar-yearly'：標準 RRULE 無法表達「依農曆日期每年重複」，故不產生 RRULE，
    // 匯出時降級為單次事件（.ics 只會有 DTSTART 那天，即首次日期）。
    case 'lunar-yearly': return '';
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
    countdown: false,
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

// ============================================================================
// 錯誤紀錄（診斷用）：全域 window.onerror + unhandledrejection 收集到記憶體
// 環形緩衝（最多 ERROR_LOG_MAX 筆，超過丟最舊）並鏡像存 ERROR_LOG_KEY。
// 【絕不可】收集 localStorage 內容、token、行程資料本身，只留偵錯必要欄位：
// 時間、錯誤訊息、呼叫堆疊前 500 字、瀏覽器 UA、頁面網址（去掉 query）。
// 此 key 刻意不納入 buildBackupPayload()/applyBackupObject()，比照 sync-auth key 的處理。
// ============================================================================
function recordError(message, stack) {
  try {
    const entry = {
      time: new Date().toISOString(),
      message: String(message == null ? '(無訊息)' : message).slice(0, 2000),
      stack: String(stack == null ? '' : stack).slice(0, 500),
      ua: (typeof navigator !== 'undefined' && navigator.userAgent) || '',
      url: (typeof location !== 'undefined' && (location.origin + location.pathname)) || '',
    };
    errorLog.push(entry);
    if (errorLog.length > ERROR_LOG_MAX) errorLog = errorLog.slice(errorLog.length - ERROR_LOG_MAX);
    saveJson(ERROR_LOG_KEY, errorLog);
  } catch {
    // 記錄錯誤本身不應該再拋出例外影響其他功能。
  }
}

function setupErrorLogging() {
  if (typeof window === 'undefined' || typeof window.addEventListener !== 'function') return;
  window.addEventListener('error', (event) => {
    const message = event?.message || (event?.error && event.error.message);
    const stack = event?.error && event.error.stack;
    recordError(message, stack);
  });
  window.addEventListener('unhandledrejection', (event) => {
    const reason = event?.reason;
    const message = reason && reason.message ? reason.message : String(reason);
    const stack = reason && reason.stack ? reason.stack : '';
    recordError(message, stack);
  });
}

function exportErrorLog() {
  downloadText(`錯誤紀錄-${toDateInput(new Date())}.json`, JSON.stringify(errorLog, null, 2), 'application/json;charset=utf-8;');
  showToast('已匯出錯誤紀錄');
}

function clearErrorLog() {
  errorLog = [];
  saveJson(ERROR_LOG_KEY, errorLog);
  renderErrorLogSummary();
  showToast('已清空錯誤紀錄');
}

function renderErrorLogSummary() {
  if (!els.dataCheckErrorLogSummary) return;
  els.dataCheckErrorLogSummary.textContent = errorLog.length
    ? `目前有 ${errorLog.length} 筆錯誤紀錄（最多保留 ${ERROR_LOG_MAX} 筆）`
    : '目前沒有錯誤紀錄';
}

// ============================================================================
// 資料檢查／修復工具：純檢查 tasks 陣列的常見壞資料型態，不主動修改資料，
// 由呼叫端（openDataCheckDialog()）決定何時顯示；真正修改資料的是 fixDataIssues()。
// ============================================================================
const VALID_REPEAT_VALUES = new Set(['none', 'daily', 'weekly', 'monthly', 'interval', 'weekdays', 'monthlyNth', 'lunar-yearly']);
const DATE_FIELD_RE = /^\d{4}-\d{2}-\d{2}$/;

function runDataCheck() {
  const issues = [];
  const seenIds = new Set();
  const categoryNames = new Set(categories.map((category) => category.name));

  tasks.forEach((task, index) => {
    const label = `#${index + 1}｜${task.title || '(無標題)'}`;

    if (!task.id) {
      issues.push({ type: 'badId', taskIndex: index, message: `${label}：缺少 id` });
    } else if (seenIds.has(task.id)) {
      issues.push({ type: 'badId', taskIndex: index, message: `${label}：id 重複（${task.id}）` });
    }
    if (task.id) seenIds.add(task.id);

    if (typeof task.date !== 'string' || !DATE_FIELD_RE.test(task.date)) {
      issues.push({ type: 'badDate', taskIndex: index, message: `${label}：日期欄位不合法（${task.date}）` });
    }

    if (!VALID_REPEAT_VALUES.has(task.repeat)) {
      issues.push({ type: 'badRepeat', taskIndex: index, message: `${label}：重複規則不合法（${task.repeat}）` });
    }

    if (typeof task.start === 'string' && typeof task.end === 'string' && task.start >= task.end) {
      issues.push({ type: 'badTimeRange', taskIndex: index, message: `${label}：開始時間需早於結束時間（${task.start}–${task.end}）` });
    }

    if (!Array.isArray(task.completedDates)) {
      issues.push({ type: 'badCompletedDates', taskIndex: index, message: `${label}：completedDates 不是陣列` });
    }
    if (!Array.isArray(task.excludedDates)) {
      issues.push({ type: 'badExcludedDates', taskIndex: index, message: `${label}：excludedDates 不是陣列` });
    }

    if (task.category && !categoryNames.has(task.category)) {
      issues.push({ type: 'orphanCategory', taskIndex: index, message: `${label}：分類「${task.category}」不存在` });
    }
  });

  return issues;
}

// 一鍵修復：呼叫前一定要先讓使用者確認（由 handleDataCheckFix() 的 confirm() 把關），
// 這裡開頭一定先觸發既有 exportBackup() 下載一份修復前的完整備份，修壞了還能救回來。
function fixDataIssues() {
  exportBackup();

  let fixedCount = 0;
  const seenIds = new Set();
  const defaultCategoryName = (categories[0] && categories[0].name) || '';

  // 日期欄位不合法的行程直接剔除：日期是 occursOnDate() 判斷重複規則的基準，
  // 沒有安全的方式可以幫使用者猜出正確日期。
  const beforeCount = tasks.length;
  tasks = tasks.filter((task) => typeof task.date === 'string' && DATE_FIELD_RE.test(task.date));
  fixedCount += beforeCount - tasks.length;

  tasks.forEach((task) => {
    if (!task.id || seenIds.has(task.id)) {
      task.id = crypto.randomUUID();
      fixedCount += 1;
    }
    seenIds.add(task.id);

    if (!VALID_REPEAT_VALUES.has(task.repeat)) {
      task.repeat = 'none';
      fixedCount += 1;
    }

    if (!Array.isArray(task.completedDates)) {
      task.completedDates = [];
      fixedCount += 1;
    }
    if (!Array.isArray(task.excludedDates)) {
      task.excludedDates = [];
      fixedCount += 1;
    }

    if (task.category && !categories.some((category) => category.name === task.category) && defaultCategoryName) {
      task.category = defaultCategoryName;
      fixedCount += 1;
    }

    if (typeof task.start === 'string' && typeof task.end === 'string' && task.start >= task.end) {
      task.end = addMinutesToTime(task.start, 30);
      fixedCount += 1;
    }
  });

  saveJson(STORAGE_KEY, tasks);
  render();
  return fixedCount;
}

function renderDataCheckResults(issues) {
  if (!els.dataCheckSummary || !els.dataCheckList) return;
  els.dataCheckSummary.textContent = issues.length ? `⚠️ 發現 ${issues.length} 筆問題` : '✅ 沒有發現問題，資料狀態正常。';
  els.dataCheckList.innerHTML = issues.length
    ? issues.map((issue) => `<div class="data-check-issue">${escapeHtml(issue.message)}</div>`).join('')
    : '';
  if (els.dataCheckFixBtn) els.dataCheckFixBtn.hidden = issues.length === 0;
}

function openDataCheckDialog() {
  renderDataCheckResults(runDataCheck());
  renderErrorLogSummary();
  els.dataCheckDialog?.showModal();
}

function closeDataCheckDialog() {
  els.dataCheckDialog?.close();
}

function handleDataCheckFix() {
  if (!confirm('修復前會先自動下載一份備份，確定要繼續一鍵修復嗎？')) return;
  const fixedCount = fixDataIssues();
  renderDataCheckResults(runDataCheck());
  showToast(fixedCount ? `已修復 ${fixedCount} 筆問題` : '沒有可修復的問題');
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

// ============================================================================
// 自然語言快速新增：中文日期/時間語彙解析。parseNaturalDateTime(text, baseDate) 是
// 完全不依賴 DOM 的純函式，回傳 { title, date, start, end }（抓不到的欄位為 null，
// title 是剝離掉已解析語彙後、trim 過的文字）。DOM 掛接（讀寫 #taskTitle 等表單欄位）
// 另外寫在 applyNaturalLanguageParse() / applyNaturalLanguageParseOnSubmit()（在
// saveTaskFromForm() 附近）。
//
// 設計保守：只有「時間語彙前後是斷詞邊界或字串端點」時才承認是時間（擋掉像「3點檔」
// 「第3點」這種數字+點不是真的時間的情況），拿捏不準就放棄解析該段、完全不動作。
// ============================================================================
const NL_CN_DIGIT_MAP = { 一: 1, 二: 2, 兩: 2, 三: 3, 四: 4, 五: 5, 六: 6, 七: 7, 八: 8, 九: 9, 十: 10 };
const NL_CN_WEEKDAY_MAP = { 一: 1, 二: 2, 三: 3, 四: 4, 五: 5, 六: 6, 日: 0, 天: 0 };

// 全形轉半形（含數字、冒號、斜線等），用 code point 位移一次處理整個全形符號區塊
// （U+FF01–FF5E → U+0021–007E），逐字元替換不改變字串長度，方便後面用 index 對應回原字串。
function nlToHalfWidth(str) {
  return str.replace(/[！-～]/g, (ch) => String.fromCharCode(ch.charCodeAt(0) - 0xFEE0));
}

// 中文數字轉阿拉伯數字，支援一~十二（時間欄位夠用：小時最大到 12）。
function nlChineseNumberToInt(str) {
  if (!str) return null;
  if (str.length === 1) return NL_CN_DIGIT_MAP[str] ?? null;
  if (str.length === 2 && str[0] === '十') {
    const tail = NL_CN_DIGIT_MAP[str[1]];
    return tail ? 10 + tail : 10;
  }
  return null;
}

function nlHourToken(str) {
  if (/^[0-9]{1,2}$/.test(str)) return parseInt(str, 10);
  return nlChineseNumberToInt(str);
}

// 判斷字元是否為「斷詞邊界」：字串端點、空白、常見標點都算邊界；中日文字元／數字不算
// （用來擋掉「3點檔」的「檔」、「第3點」的「第」這種黏在數字旁邊的情況）。
function nlIsWordBoundaryChar(ch) {
  if (ch === undefined) return true;
  if (/[\s,，、。.!！?？:：\-~—()（）[\]「」『』]/.test(ch)) return true;
  return !/[一-鿿\d]/.test(ch);
}

function nlHasValidBoundary(text, startIndex, endIndex) {
  const before = startIndex > 0 ? text[startIndex - 1] : undefined;
  const after = endIndex < text.length ? text[endIndex] : undefined;
  return nlIsWordBoundaryChar(before) && nlIsWordBoundaryChar(after);
}

function nlSpliceOut(str, start, end) {
  return str.slice(0, start) + str.slice(end);
}

function nlMinutesToTime(totalMinutes) {
  const wrapped = ((totalMinutes % 1440) + 1440) % 1440;
  const hh = Math.floor(wrapped / 60);
  const mm = wrapped % 60;
  return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
}

function nlTimeToMinutes(hhmm) {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
}

// 上午/早上：12 點視為 0 點（午夜），其餘照原值。下午/晚上：12 點維持 12 點（中午），
// 其餘 +12。
function nlApplyPeriod(period, hour) {
  if (period === '上午' || period === '早上') return hour === 12 ? 0 : hour;
  if (period === '下午' || period === '晚上') return hour === 12 ? 12 : hour + 12;
  return hour;
}

// 沒有上午/下午詞的裸數字＋點（例如「3點」）：12 以下時，<8 視為下午/晚上（+12），
// 否則照原值（8~12 當作已經是白天的整點）；>12 已經是明確的 24 小時制數字，照原值。
function nlBareHourAdjust(hour) {
  if (hour <= 12) return hour < 8 ? hour + 12 : hour;
  return hour;
}

function nlExtractDate(work, base) {
  const relDayPatterns = [
    { re: /大後天/, offset: 3 },
    { re: /後天/, offset: 2 },
    { re: /明天/, offset: 1 },
    { re: /今天/, offset: 0 },
  ];
  for (const { re, offset } of relDayPatterns) {
    const m = re.exec(work);
    if (m) {
      const target = addDays(base, offset);
      return { start: m.index, end: m.index + m[0].length, dateKey: toDateInput(target) };
    }
  }

  // 下週X / 下周X（不論本週有沒有過，一律算下一週的那一天）
  const nextWeekMatch = /下(?:週|周)([一二三四五六日天])/.exec(work);
  if (nextWeekMatch) {
    const weekday = NL_CN_WEEKDAY_MAP[nextWeekMatch[1]];
    if (weekday !== undefined) {
      const thisMonday = startOfWeek(base);
      const nextMonday = addDays(thisMonday, 7);
      const daysFromMonday = (weekday - 1 + 7) % 7;
      const target = addDays(nextMonday, daysFromMonday);
      return { start: nextWeekMatch.index, end: nextWeekMatch.index + nextWeekMatch[0].length, dateKey: toDateInput(target) };
    }
  }

  // 週X / 周X / 星期X / 禮拜X（本週該日，已過則下週；「下週X」已在上面優先攔截）
  const thisWeekMatch = /(?:週|周|星期|禮拜)([一二三四五六日天])/.exec(work);
  if (thisWeekMatch) {
    const weekday = NL_CN_WEEKDAY_MAP[thisWeekMatch[1]];
    if (weekday !== undefined) {
      const thisMonday = startOfWeek(base);
      const daysFromMonday = (weekday - 1 + 7) % 7;
      let target = addDays(thisMonday, daysFromMonday);
      if (target < base) target = addDays(target, 7);
      return { start: thisWeekMatch.index, end: thisWeekMatch.index + thisWeekMatch[0].length, dateKey: toDateInput(target) };
    }
  }

  // N月N日 / N月N號（今年；数字前後加 lookaround 避免咬到更長數字的一部分）
  const mdMatch = /(?<!\d)(\d{1,2})月(\d{1,2})[日號](?!\d)/.exec(work);
  if (mdMatch) {
    const month = parseInt(mdMatch[1], 10);
    const day = parseInt(mdMatch[2], 10);
    if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
      const year = base.getFullYear();
      let target = new Date(year, month - 1, day);
      if (target < base) target = new Date(year + 1, month - 1, day);
      return { start: mdMatch.index, end: mdMatch.index + mdMatch[0].length, dateKey: toDateInput(target) };
    }
  }

  // N/N（月/日，今年，已過則明年）
  const slashMatch = /(?<!\d)(\d{1,2})\/(\d{1,2})(?!\d)/.exec(work);
  if (slashMatch) {
    const month = parseInt(slashMatch[1], 10);
    const day = parseInt(slashMatch[2], 10);
    if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
      const year = base.getFullYear();
      let target = new Date(year, month - 1, day);
      if (target < base) target = new Date(year + 1, month - 1, day);
      return { start: slashMatch.index, end: slashMatch.index + slashMatch[0].length, dateKey: toDateInput(target) };
    }
  }

  return null;
}

function nlExtractTime(work) {
  const numToken = '(?:[0-9]{1,2}|[一二三四五六七八九十]{1,2})';

  // 上午/早上/下午/晚上 + 區間（例如「下午3點到5點」）
  const periodRangeRe = new RegExp(`(上午|早上|下午|晚上)(${numToken})[點点](半)?(?:到|至|-|~)(${numToken})[點点](半)?`);
  let m = periodRangeRe.exec(work);
  if (m) {
    const h1 = nlHourToken(m[2]);
    const h2 = nlHourToken(m[4]);
    if (h1 !== null && h2 !== null) {
      const startMin = nlApplyPeriod(m[1], h1) * 60 + (m[3] ? 30 : 0);
      const endMin = nlApplyPeriod(m[1], h2) * 60 + (m[5] ? 30 : 0);
      return { start: m.index, end: m.index + m[0].length, startTime: nlMinutesToTime(startMin), endTime: nlMinutesToTime(endMin) };
    }
  }

  // 上午/早上/下午/晚上 + 單一時間（可帶「半」或「:MM」分鐘）
  const periodSingleRe = new RegExp(`(上午|早上|下午|晚上)(${numToken})[點点](?:(半)|[:：]([0-5][0-9]))?`);
  m = periodSingleRe.exec(work);
  if (m) {
    const h = nlHourToken(m[2]);
    if (h !== null) {
      const minute = m[3] ? 30 : (m[4] ? parseInt(m[4], 10) : 0);
      const startMin = nlApplyPeriod(m[1], h) * 60 + minute;
      return { start: m.index, end: m.index + m[0].length, startTime: nlMinutesToTime(startMin), endTime: null };
    }
  }

  // 24 小時制區間，例如「15:30-17:00」「3:30-5:00」
  const colonRangeRe = /([01]?[0-9]|2[0-3]):([0-5][0-9])\s*(?:[-~到至])\s*([01]?[0-9]|2[0-3]):([0-5][0-9])/;
  m = colonRangeRe.exec(work);
  if (m) {
    return { start: m.index, end: m.index + m[0].length, startTime: `${m[1].padStart(2, '0')}:${m[2]}`, endTime: `${m[3].padStart(2, '0')}:${m[4]}` };
  }

  // 24 小時制單一時間，例如「15:30」
  const colonSingleRe = /([01]?[0-9]|2[0-3]):([0-5][0-9])/;
  m = colonSingleRe.exec(work);
  if (m) {
    return { start: m.index, end: m.index + m[0].length, startTime: `${m[1].padStart(2, '0')}:${m[2]}`, endTime: null };
  }

  // 不帶上午/下午詞的區間，例如「3點到5點」（需通過斷詞邊界檢查）
  const bareRangeRe = new RegExp(`(${numToken})[點点](半)?(?:到|至|-|~)(${numToken})[點点](半)?`);
  m = bareRangeRe.exec(work);
  if (m && nlHasValidBoundary(work, m.index, m.index + m[0].length)) {
    const h1 = nlHourToken(m[1]);
    const h2 = nlHourToken(m[3]);
    if (h1 !== null && h2 !== null) {
      const startMin = nlBareHourAdjust(h1) * 60 + (m[2] ? 30 : 0);
      const endMin = nlBareHourAdjust(h2) * 60 + (m[4] ? 30 : 0);
      return { start: m.index, end: m.index + m[0].length, startTime: nlMinutesToTime(startMin), endTime: nlMinutesToTime(endMin) };
    }
  }

  // 不帶上午/下午詞的單一時間，例如「3點」（<8 視為下午/晚上；需通過斷詞邊界檢查，
  // 避免「3點檔」「第3點」被誤判為時間）
  const bareSingleRe = new RegExp(`(${numToken})[點点](半)?`);
  m = bareSingleRe.exec(work);
  if (m && nlHasValidBoundary(work, m.index, m.index + m[0].length)) {
    const h = nlHourToken(m[1]);
    if (h !== null) {
      const minute = m[2] ? 30 : 0;
      const startMin = nlBareHourAdjust(h) * 60 + minute;
      return { start: m.index, end: m.index + m[0].length, startTime: nlMinutesToTime(startMin), endTime: null };
    }
  }

  return null;
}

function parseNaturalDateTime(text, baseDate) {
  const raw = String(text == null ? '' : text);
  const base = startOfDay(baseDate instanceof Date && !Number.isNaN(baseDate.getTime()) ? baseDate : new Date());

  let work = nlToHalfWidth(raw);
  let title = raw; // 保留原始字元（含使用者輸入的全形），只移除掉解析到的區段

  let resultDate = null;
  let resultStart = null;
  let resultEnd = null;

  const dateMatch = nlExtractDate(work, base);
  if (dateMatch) {
    resultDate = dateMatch.dateKey;
    work = nlSpliceOut(work, dateMatch.start, dateMatch.end);
    title = nlSpliceOut(title, dateMatch.start, dateMatch.end);
  }

  const timeMatch = nlExtractTime(work);
  if (timeMatch) {
    resultStart = timeMatch.startTime;
    resultEnd = timeMatch.endTime || nlMinutesToTime(nlTimeToMinutes(timeMatch.startTime) + 60);
    work = nlSpliceOut(work, timeMatch.start, timeMatch.end);
    title = nlSpliceOut(title, timeMatch.start, timeMatch.end);
  }

  title = title.replace(/\s+/g, ' ').trim();

  return { title, date: resultDate, start: resultStart, end: resultEnd };
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
// 提供給 sync.js（雲端同步 scaffold）與 tests.html（純函式測試跑道）使用的介面。
// sync.js 不直接碰 tasks / appSettings 等內部變數，一律透過這個介面，
// 讓「備份資料格式」與「本機儲存」維持單一真相在 app.js。
// index.html 若沒有載入 sync.js，這個物件單純不會被用到，不影響任何原有功能。
// occursOnDate / parseNaturalDateTime / timeOverlaps / computeWeeklyReview 是額外
// 加上的純函式匯出，只給 tests.html 呼叫做迴歸測試，不影響原本 sync.js 的用法。
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
  occursOnDate,
  parseNaturalDateTime,
  timeOverlaps,
  computeWeeklyReview,
  // sync.js 會把自己的 notifyLocalChange 掛在這裡；render() 存檔後會呼叫（如果有掛的話）。
  onDataChanged: null,
};
