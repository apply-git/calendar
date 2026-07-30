const STORAGE_KEY = 'desktop-schedule-v1';
const HABIT_KEY = 'desktop-schedule-habits-v1';
const THEME_KEY = 'desktop-schedule-theme-v1';
const CATEGORY_KEY = 'desktop-schedule-categories-v1';
const CALENDAR_KEY = 'desktop-schedule-calendars-v1';
const TEXT_KEY = 'desktop-schedule-text-settings-v1';
const APP_SETTINGS_KEY = 'desktop-schedule-app-settings-v1';
const MEMO_KEY = 'desktop-schedule-daily-memos-v1';
const DIARY_KEY = 'desktop-schedule-diary-v1'; // 每日心情：{ 'YYYY-MM-DD': { mood: 1~5, updatedAt } }；文字內容沿用 dailyMemos，不重複存
const POMODORO_LOG_KEY = 'desktop-schedule-pomodoro-log-v1'; // 番茄鐘完成紀錄：陣列 [{ id, at, minutes, taskId }]，**依 at 由舊到新排序**，上限 300 筆
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

// 提醒延後（snooze）持久化：key 為 `${taskId}|${dateKey}`（用 '|' 分隔避免與 UUID/日期裡的 '-' 混淆），
// value 為 snooze 到期時間戳。已納入 buildBackupPayload()/applyBackupObject() 一起雲端同步（S3），雲端合併時同 key 取較晚的到期時間（見 sync.js 的 mergeSnoozeTables）；超過 SNOOZE_STALE_MS 的殘留會在讀取時清掉。
const SNOOZE_KEY = 'desktop-schedule-snooze-v1';
const SNOOZE_STALE_MS = 24 * 60 * 60 * 1000; // 到期超過 24 小時的殘留視為過期，清掉不補發

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

const defaultAppSettings = { workStart: 7, workEnd: 21, showLunar: true, dayViewMode: 'list', autoSync: false, travelTimezone: null, digestMorning: false, digestEvening: false, digestWeekly: false, autoErrorReport: false };
const TIMELINE_HOUR_HEIGHT = 60;

// D4 行程時區：任務表單「時區」select 常用清單＋旅行模式顯示時區 select 共用同一份清單。
// value 用 IANA 字串，label 是中文城市名，兩者都會出現在 select option 文字裡（見 getTimezoneOptionsHtml()）。
const COMMON_TIMEZONES = [
  { value: 'Asia/Taipei', label: '台北' },
  { value: 'Asia/Tokyo', label: '東京' },
  { value: 'Asia/Seoul', label: '首爾' },
  { value: 'Asia/Shanghai', label: '上海' },
  { value: 'Asia/Hong_Kong', label: '香港' },
  { value: 'Asia/Singapore', label: '新加坡' },
  { value: 'Asia/Bangkok', label: '曼谷' },
  { value: 'Australia/Sydney', label: '雪梨' },
  { value: 'Europe/London', label: '倫敦' },
  { value: 'Europe/Paris', label: '巴黎' },
  { value: 'America/New_York', label: '紐約' },
  { value: 'America/Los_Angeles', label: '洛杉磯' },
];

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

const defaultCalendars = [
  { id: 'default', name: '預設' },
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

let tasks = loadJson(STORAGE_KEY, []);
let habits = loadJson(HABIT_KEY, []);
let categories = loadJson(CATEGORY_KEY, defaultCategories);
let calendars = loadJson(CALENDAR_KEY, defaultCalendars);
let textSettings = { ...defaultTextSettings, ...loadJson(TEXT_KEY, {}) };
let appSettings = { ...defaultAppSettings, ...loadJson(APP_SETTINGS_KEY, {}) };
let dailyMemos = loadJson(MEMO_KEY, {});
let diaryEntries = loadJson(DIARY_KEY, {});
let pomodoroLog = loadJson(POMODORO_LOG_KEY, []);
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
  jumpDateIconMonth: $('jumpDateIconMonth'),
  jumpDateIconDay: $('jumpDateIconDay'),
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
  printViewBtn: $('printViewBtn'),
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
  taskCalendarField: $('taskCalendarField'),
  taskCalendar: $('taskCalendar'),
  taskColor: $('taskColor'),
  taskColorUseCategory: $('taskColorUseCategory'),
  taskLocation: $('taskLocation'),
  taskTimezone: $('taskTimezone'),
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
  taskShared: $('taskShared'),
  taskDependsOnField: $('taskDependsOnField'),
  taskDependsOnList: $('taskDependsOnList'),
  taskTags: $('taskTags'),
  taskSubtasks: $('taskSubtasks'),
  taskNote: $('taskNote'),
  attachmentSection: $('attachmentSection'),
  attachmentList: $('attachmentList'),
  addAttachmentBtn: $('addAttachmentBtn'),
  attachmentFileInput: $('attachmentFileInput'),
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
  moodPicker: $('moodPicker'),
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
  calendarsBtn: $('calendarsBtn'),
  calendarVisibilityDialog: $('calendarVisibilityDialog'),
  closeCalendarVisibilityBtn: $('closeCalendarVisibilityBtn'),
  calendarVisibilityList: $('calendarVisibilityList'),
  manageCalendarsBtn: $('manageCalendarsBtn'),
  calendarManageDialog: $('calendarManageDialog'),
  closeCalendarManageBtn: $('closeCalendarManageBtn'),
  calendarManageList: $('calendarManageList'),
  calendarNameInput: $('calendarNameInput'),
  addCalendarBtn: $('addCalendarBtn'),
  travelModeDialog: $('travelModeDialog'),
  closeTravelModeBtn: $('closeTravelModeBtn'),
  travelModeEnabled: $('travelModeEnabled'),
  travelModeTimezone: $('travelModeTimezone'),
  toast: $('toast'),
  fabAddBtn: $('fabAddBtn'),
  moreToolsBtn: $('moreToolsBtn'),
  moreToolsDialog: $('moreToolsDialog'),
  closeMoreToolsBtn: $('closeMoreToolsBtn'),
  moreToolsWeeklyReviewBtn: $('moreToolsWeeklyReviewBtn'),
  kioskModeBtn: $('kioskModeBtn'),
  kioskOverlay: $('kioskOverlay'),
  kioskCloseBtn: $('kioskCloseBtn'),
  kioskClock: $('kioskClock'),
  kioskDateLine: $('kioskDateLine'),
  kioskTaskList: $('kioskTaskList'),
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
  dashboardMoodSummary: $('dashboardMoodSummary'),
  dashboardMoodDistribution: $('dashboardMoodDistribution'),
  dashboardPomodoroSummary: $('dashboardPomodoroSummary'),
  dashboardPomodoroDaily: $('dashboardPomodoroDaily'),
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
  autoErrorReportToggle: $('autoErrorReportToggle'),
  exportErrorLogBtn: $('exportErrorLogBtn'),
  clearErrorLogBtn: $('clearErrorLogBtn'),
  swUpdateBanner: $('swUpdateBanner'),
  swUpdateBtn: $('swUpdateBtn'),
  commandPaletteBtn: $('commandPaletteBtn'),
  commandPalette: $('commandPalette'),
  commandPaletteInput: $('commandPaletteInput'),
  commandPaletteResults: $('commandPaletteResults'),
};

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

// 全域錯誤紀錄：獨立於 init() 之外、無條件先掛上，這樣即使 init() 因為缺少畫面
// 元素（例如 tests.html 這種沒有完整 DOM 的頁面）而失敗，錯誤蒐集本身仍然有效。
setupErrorLogging();

// 工具列溢出收合的共用狀態：必須宣告在 init() 呼叫【之前】。
// 教訓：原本宣告在檔案更下方，init() → setupToolbarOverflow() 執行時 let 變數
// 還在暫時性死區（TDZ），拋 ReferenceError 被 init 的 try/catch 吞掉，導致
// render() 整個沒跑（標題停在「行程」、日檢視按鈕全部消失）。
const VIEW_CONTROLLED_TOOLBAR_IDS = new Set(['clearDayBtn', 'deferBtn', 'shareCardBtn', 'clearWeekBtn', 'clearMonthBtn']);
let overflowHiddenIds = []; // stack：越後面代表越晚被藏，還原時優先還原最近被藏的（LIFO）

// 桌面工具列六組下拉選單（setupToolbarMenus()）設定表：同樣的教訓，必須宣告在 init() 呼叫【之前】。
// items 成員為 {proxyId}（點擊時代原按鈕 .click()，文字/隱藏狀態都取自原按鈕）或
// {label, onClick}（沒有對應原按鈕、直接執行函式，例如看板模式）。
const TOOLBAR_MENU_GROUPS = [
  {
    btnId: 'viewActionsMenuBtn',
    items: [
      { proxyId: 'clearDayBtn' },
      { proxyId: 'clearWeekBtn' },
      { proxyId: 'clearMonthBtn' },
      { proxyId: 'deferBtn' },
      { proxyId: 'shareCardBtn' },
    ],
  },
  {
    btnId: 'modesMenuBtn',
    items: [
      { proxyId: 'todayTodoBtn' },
      { proxyId: 'widgetModeBtn' },
      { proxyId: 'calendarsBtn' },
      { label: '🖥 看板模式', onClick: () => openKioskMode() },
    ],
  },
  {
    btnId: 'toolsMenuBtn',
    items: [
      { proxyId: 'pomodoroBtn' },
      { proxyId: 'batchAddBtn' },
      { proxyId: 'dataCheckBtn' },
      { proxyId: 'cleanupBtn' },
    ],
  },
  {
    btnId: 'analyticsMenuBtn',
    items: [
      { proxyId: 'dashboardBtn' },
      { proxyId: 'weeklyReviewBtn' },
    ],
  },
  {
    btnId: 'exportMenuBtn',
    items: [
      { proxyId: 'backupBtn' },
      { proxyId: 'restoreBtn' },
      { proxyId: 'exportCsvBtn' },
      { proxyId: 'printViewBtn' },
      { proxyId: 'printBtn' },
      { proxyId: 'exportIcsBtn' },
      { proxyId: 'importIcsBtn' },
    ],
  },
  {
    btnId: 'settingsMenuBtn',
    items: [
      { proxyId: 'enableNotificationsBtn' },
      { proxyId: 'settingsBtn' },
      { label: '🌏 旅行模式', onClick: () => openTravelModeDialog() },
    ],
  },
];

