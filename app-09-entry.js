// ============================================================================
// 錯誤紀錄（診斷用）：全域 window.onerror + unhandledrejection 收集到記憶體
// 環形緩衝（最多 ERROR_LOG_MAX 筆，超過丟最舊）並鏡像存 ERROR_LOG_KEY。
// 【絕不可】收集 localStorage 內容、token、行程資料本身，只留偵錯必要欄位：
// 時間、錯誤訊息、呼叫堆疊前 500 字、瀏覽器 UA、頁面網址（去掉 query）。
// 此 key 刻意不納入 buildBackupPayload()/applyBackupObject()，比照 sync-auth key 的處理。
// 另有選用的雲端自動上報（appSettings.autoErrorReport，預設關閉），見 reportErrorToCloud() 與 schema-errorlog.sql。
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
    reportErrorToCloud(entry);
  } catch {
    // 記錄錯誤本身不應該再拋出例外影響其他功能。
  }
}

// 自動上報的節流／去重狀態（純字面值，載入時不執行任何邏輯）：
//   lastSentAt：上一次實際送出的時間戳，用來做「每 60 秒最多送 1 筆」的節流；
//   sentKeys：`message|stack 前 120 字` → 最近送出時間戳，同一種錯誤 24 小時內只送一次。
// 兩者都只活在記憶體，重新整理後歸零（刻意不落地：這是防洗版的軟性保護，
// 不是精確計數，也不值得為它多寫一個 localStorage key）。
const errorReportState = { lastSentAt: 0, sentKeys: {} };
const ERROR_REPORT_MIN_GAP_MS = 60 * 1000;
const ERROR_REPORT_DEDUPE_MS = 24 * 60 * 60 * 1000;

// 把單筆錯誤靜默上報到 Supabase 的 error_reports 表（schema-errorlog.sql）。
// 【設計鐵則】這個函式對呼叫端而言必須「絕對安全」：
//   1. 整段包在 try/catch 裡，任何例外都吞掉——上報失敗絕不能再觸發 recordError 造成無限迴圈；
//   2. fire-and-forget，不 await、不重試、失敗不提示使用者；
//   3. 預設關閉（appSettings.autoErrorReport），沒登入、沒設定雲端一律直接 return；
//   4. 送出的欄位就是 recordError 收集的那 5 個，不多帶任何東西（不含 token／行程內容）。
function reportErrorToCloud(entry) {
  try {
    if (!entry || typeof appSettings !== 'object' || !appSettings || appSettings.autoErrorReport !== true) return;
    const rawConfig = (typeof window === 'object' && window && typeof window.CALENDAR_SYNC_CONFIG === 'object' && window.CALENDAR_SYNC_CONFIG) || {};
    const baseUrl = String(rawConfig.supabaseUrl || '').trim().replace(/\/+$/, '');
    const anonKey = String(rawConfig.supabaseAnonKey || '').trim();
    if (!baseUrl || !anonKey) return;
    const sync = (typeof window === 'object' && window) ? window.CalendarSync : null;
    if (!sync || typeof sync.getAuthState !== 'function') return;
    const state = sync.getAuthState();
    if (!state || !state.accessToken || !state.user || !state.user.id) return;

    const now = Date.now();
    if (now - errorReportState.lastSentAt < ERROR_REPORT_MIN_GAP_MS) return;
    const key = `${entry.message}|${String(entry.stack || '').slice(0, 120)}`;
    const lastSameAt = Number(errorReportState.sentKeys[key]) || 0;
    if (lastSameAt && now - lastSameAt < ERROR_REPORT_DEDUPE_MS) return;

    errorReportState.lastSentAt = now;
    errorReportState.sentKeys[key] = now;

    fetch(`${baseUrl}/rest/v1/error_reports`, {
      method: 'POST',
      headers: {
        apikey: anonKey,
        Authorization: `Bearer ${state.accessToken}`,
        'Content-Type': 'application/json',
        Prefer: 'return=minimal',
      },
      body: JSON.stringify([{
        user_id: state.user.id,
        occurred_at: entry.time,
        message: entry.message,
        stack: entry.stack,
        page_url: entry.url,
        user_agent: entry.ua,
      }]),
    }).catch(() => {});
  } catch {
    // 上報本身出錯一律忽略，避免跟 recordError 互相觸發。
  }
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
    if (task.deletedAt) return; // 墓碑不當壞資料檢查，保留供同步合併用

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
async function fixDataIssues() {
  // exportBackup() 是 async（可能跳出密碼 prompt 並 await 加密）：這裡一定要 await，
  // 確保「先下載完修復前備份、再動資料」的順序不會被 fire-and-forget 打亂
  // （例如使用者選擇加密備份時，加密／下載尚未完成就搶先修改 tasks）。
  await exportBackup();

  let fixedCount = 0;
  const seenIds = new Set();
  const defaultCategoryName = (categories[0] && categories[0].name) || '';

  // 日期欄位不合法的行程直接剔除：日期是 occursOnDate() 判斷重複規則的基準，
  // 沒有安全的方式可以幫使用者猜出正確日期。
  const beforeCount = tasks.length;
  tasks = tasks.filter((task) => typeof task.date === 'string' && DATE_FIELD_RE.test(task.date));
  fixedCount += beforeCount - tasks.length;

  tasks.forEach((task) => {
    if (task.deletedAt) return; // 墓碑不修、不算修復筆數，保留原樣供同步合併用

    let changed = false;

    if (!task.id || seenIds.has(task.id)) {
      task.id = crypto.randomUUID();
      fixedCount += 1;
      changed = true;
    }
    seenIds.add(task.id);

    if (!VALID_REPEAT_VALUES.has(task.repeat)) {
      task.repeat = 'none';
      fixedCount += 1;
      changed = true;
    }

    if (!Array.isArray(task.completedDates)) {
      task.completedDates = [];
      fixedCount += 1;
      changed = true;
    }
    if (!Array.isArray(task.excludedDates)) {
      task.excludedDates = [];
      fixedCount += 1;
      changed = true;
    }

    if (task.category && !categories.some((category) => category.name === task.category) && defaultCategoryName) {
      task.category = defaultCategoryName;
      fixedCount += 1;
      changed = true;
    }

    if (typeof task.start === 'string' && typeof task.end === 'string' && task.start >= task.end) {
      task.end = addMinutesToTime(task.start, 30);
      fixedCount += 1;
      changed = true;
    }

    if (changed) touchTask(task);
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
  if (els.dataCheckDialog?.open) return;
  renderDataCheckResults(runDataCheck());
  renderErrorLogSummary();
  els.dataCheckDialog?.showModal();
}

function closeDataCheckDialog() {
  els.dataCheckDialog?.close();
}

async function handleDataCheckFix() {
  if (!confirm('修復前會先自動下載一份備份，確定要繼續一鍵修復嗎？')) return;
  const fixedCount = await fixDataIssues();
  renderDataCheckResults(runDataCheck());
  showToast(fixedCount ? `已修復 ${fixedCount} 筆問題` : '沒有可修復的問題');
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

// init() 包一層 try/catch：正常情況（index.html 有完整 DOM）不會走到 catch，
// 但 tests.html 只載入 app.js、沒有任何畫面元素時 init() 一定會因為存取 null
// 的 DOM 節點而丟出例外——沒有這層保護，例外會中斷整支 app.js 的執行，導致
// 檔案最底部的 window.CalendarApp 匯出永遠跑不到。
try {
  init();
} catch (err) {
  console.error('[app.js] init() 發生錯誤（若在 tests.html 等無 DOM 頁面屬預期行為）', err);
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
  computeOkrProgress,
  addOkr,
  deleteOkr,
  addKeyResult,
  deleteKeyResult,
  updateKeyResultProgress,
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
