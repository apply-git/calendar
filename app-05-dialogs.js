// D4 行程時區：時區 select 的 <option> HTML 只需組一次（COMMON_TIMEZONES + Intl.supportedValuesOf()
// 全量清單可能上百筆），第一次要用到時才建、建好快取，供 taskDialog 與旅行模式對話框共用。
let cachedTimezoneOptionsHtml = null;
let taskTimezoneOptionsBuilt = false;
let travelTimezoneOptionsBuilt = false;

function getTimezoneOptionsHtml() {
  if (cachedTimezoneOptionsHtml !== null) return cachedTimezoneOptionsHtml;
  let html = COMMON_TIMEZONES.map((tz) => `<option value="${tz.value}">${escapeHtml(tz.label)}（${tz.value}）</option>`).join('');
  if (typeof Intl.supportedValuesOf === 'function') {
    try {
      const commonSet = new Set(COMMON_TIMEZONES.map((tz) => tz.value));
      const all = Intl.supportedValuesOf('timeZone').filter((tz) => !commonSet.has(tz));
      if (all.length) {
        html += `<optgroup label="更多…">${all.map((tz) => `<option value="${escapeHtml(tz)}">${escapeHtml(tz)}</option>`).join('')}</optgroup>`;
      }
    } catch (err) {
      // Intl.supportedValuesOf 不可用或拋錯（少數瀏覽器）：忽略，只提供常用清單
    }
  }
  cachedTimezoneOptionsHtml = html;
  return html;
}

// 行程表單「時區」select：本地（預設，value 空字串）+ 常用清單 + 更多。一次性填充，
// 開表單（openTaskDialog）才建，不在頂層執行；後續開表單直接沿用已建好的 options。
function ensureTaskTimezoneOptions() {
  if (taskTimezoneOptionsBuilt || !els.taskTimezone) return;
  taskTimezoneOptionsBuilt = true;
  els.taskTimezone.innerHTML = '<option value="">本地（預設）</option>' + getTimezoneOptionsHtml();
}

// D4 旅行模式設定：⚙ 設定下拉「🌏 旅行模式」開啟的小對話框。開關 + 顯示時區 select，
// 兩者 change 時即時存 appSettings.travelTimezone 並重繪（見 app-03-events.js 綁定），
// 沒有另外的儲存按鈕，跟日曆本可見度對話框同一種「即改即存」模式。
function openTravelModeDialog() {
  if (!els.travelModeDialog) return;
  if (!travelTimezoneOptionsBuilt && els.travelModeTimezone) {
    travelTimezoneOptionsBuilt = true;
    els.travelModeTimezone.innerHTML = getTimezoneOptionsHtml();
  }
  const deviceTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  els.travelModeEnabled.checked = Boolean(appSettings.travelTimezone);
  if (els.travelModeTimezone) {
    els.travelModeTimezone.value = appSettings.travelTimezone || deviceTimezone;
    // 保險：極少數情況目前值不在清單內（理論上 Intl.supportedValuesOf 應涵蓋裝置時區），
    // value 設定失敗會變回清單第一項，這裡不特別處理，讓使用者自行從清單重選即可。
  }
  els.travelModeDialog.showModal();
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
    const color = getTaskColor(task);

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

  tasks.forEach((task) => {
    if (removeIds.has(task.id)) {
      tombstoneTask(task);
      return;
    }
    const excludeDates = excludeMap.get(task.id);
    if (!excludeDates) return;
    task.excludedDates = Array.isArray(task.excludedDates) ? task.excludedDates : [];
    excludeDates.forEach((dateKey) => {
      if (!task.excludedDates.includes(dateKey)) task.excludedDates.push(dateKey);
    });
    touchTask(task);
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

// 日曆本下拉（新增／編輯行程表單用）：只有一本（預設）時整欄隱藏，避免多數人用不到的情況下還占畫面。
function renderCalendarField() {
  if (!els.taskCalendar || !els.taskCalendarField) return;
  const current = els.taskCalendar.value;
  els.taskCalendar.innerHTML = calendars.map((cal) => `<option value="${escapeHtml(cal.id)}">${escapeHtml(cal.name)}</option>`).join('');
  els.taskCalendar.value = calendars.some((cal) => cal.id === current) ? current : 'default';
  els.taskCalendarField.hidden = calendars.length <= 1;
}

// 工具列「📚 日曆本」對話框：每本一個 checkbox，勾選=顯示，可複選疊加。
function renderCalendarVisibilityList() {
  if (!els.calendarVisibilityList) return;
  els.calendarVisibilityList.innerHTML = calendars.map((cal) => `
    <div class="habit-item">
      <label><input type="checkbox" ${isCalendarVisible(cal.id) ? 'checked' : ''} data-toggle-calendar-visibility="${escapeHtml(cal.id)}" /> ${escapeHtml(cal.name)}</label>
    </div>
  `).join('');
}

// 「管理日曆本…」對話框：名稱可直接在輸入框內修改（change 時觸發 renameCalendar()），
// 'default' 本不可刪除（比照分類管理的 system 分類不可刪）。
function renderCalendarManageList() {
  if (!els.calendarManageList) return;
  els.calendarManageList.innerHTML = calendars.map((cal) => `
    <div class="category-item">
      <input type="text" class="calendar-rename-input" value="${escapeHtml(cal.name)}" data-rename-calendar="${escapeHtml(cal.id)}" />
      ${cal.id === 'default' ? '<span class="streak">預設</span>' : `<button class="small-btn" data-delete-calendar="${escapeHtml(cal.id)}">✕</button>`}
    </div>
  `).join('');
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
  if (els.weeklyReviewDialog.open) return;
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

// 近 30 天心情統計：只讀 diaryEntries，mood 0（取消的墓碑）不列入。
// 回傳 max 至少為 1，避免長條寬度除以 0。
// 番茄鐘統計：近 7 天逐日專注分鐘數 ＋ 近 30 天總計。只讀 pomodoroLog，不改它。
// maxMinutes 至少為 1，避免長條寬度除以 0。
function computePomodoroStats(baseDate) {
  const startOfDay = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const todayStart = startOfDay(baseDate);
  const dayMinutes = new Map();
  let total30 = 0;
  let minutes30 = 0;
  (Array.isArray(pomodoroLog) ? pomodoroLog : []).forEach((row) => {
    const at = Number(row && row.at) || 0;
    if (!at) return;
    const diffDays = Math.round((todayStart - startOfDay(new Date(at))) / 86400000);
    if (diffDays < 0 || diffDays > 29) return;
    const minutes = Number(row.minutes) || 0;
    total30 += 1;
    minutes30 += minutes;
    if (diffDays <= 6) dayMinutes.set(diffDays, (dayMinutes.get(diffDays) || 0) + minutes);
  });
  const days = [];
  for (let i = 6; i >= 0; i -= 1) {
    const day = new Date(baseDate.getFullYear(), baseDate.getMonth(), baseDate.getDate() - i);
    days.push({ label: formatMonthDay(day), minutes: dayMinutes.get(i) || 0 });
  }
  return {
    days,
    maxMinutes: days.reduce((m, d) => Math.max(m, d.minutes), 0) || 1,
    total30,
    minutes30,
  };
}

// ---- P3 目標 OKR：純函式 CRUD，操作全域 okrs 陣列 + saveJson，不碰 DOM ----
// 進度＝底下每條關鍵結果 (current/target) 的平均百分比，四捨五入、每條各自 clamp 在 0~100；
// target<=0（尚未填數字）視為 0%；沒有任何關鍵結果時整體回傳 0（避免除以 0）。
function computeOkrProgress(okr) {
  const results = Array.isArray(okr && okr.keyResults) ? okr.keyResults : [];
  if (!results.length) return 0;
  const sum = results.reduce((acc, kr) => {
    const target = Number(kr.target) || 0;
    const current = Number(kr.current) || 0;
    const pct = target > 0 ? Math.min(100, Math.max(0, (current / target) * 100)) : 0;
    return acc + pct;
  }, 0);
  return Math.round(sum / results.length);
}

function addOkr(title, dueDate) {
  const trimmed = (title || '').trim();
  if (!trimmed) return null;
  const okr = { id: crypto.randomUUID(), title: trimmed, dueDate: dueDate || '', keyResults: [], archived: false, updatedAt: Date.now() };
  okrs.push(okr);
  saveJson(OKR_KEY, okrs);
  return okr;
}

function deleteOkr(id) {
  okrs = okrs.filter((o) => o.id !== id);
  saveJson(OKR_KEY, okrs);
}

function addKeyResult(okrId, title, target) {
  const okr = okrs.find((o) => o.id === okrId);
  const trimmed = (title || '').trim();
  if (!okr || !trimmed) return null;
  const kr = { id: crypto.randomUUID(), title: trimmed, target: Number(target) || 0, current: 0 };
  okr.keyResults.push(kr);
  okr.updatedAt = Date.now();
  saveJson(OKR_KEY, okrs);
  return kr;
}

function deleteKeyResult(okrId, krId) {
  const okr = okrs.find((o) => o.id === okrId);
  if (!okr) return;
  okr.keyResults = okr.keyResults.filter((kr) => kr.id !== krId);
  okr.updatedAt = Date.now();
  saveJson(OKR_KEY, okrs);
}

function updateKeyResultProgress(okrId, krId, current) {
  const okr = okrs.find((o) => o.id === okrId);
  const kr = okr && okr.keyResults.find((k) => k.id === krId);
  if (!kr) return;
  kr.current = Number(current) || 0;
  okr.updatedAt = Date.now();
  saveJson(OKR_KEY, okrs);
}

function openOkrDialog() {
  if (els.okrDialog.open) return;
  renderOkrList();
  els.okrDialog.showModal();
}

function closeOkrDialog() {
  if (els.okrDialog.open) els.okrDialog.close();
}

// 渲染 okrDialog 清單：每個目標一張卡片，含進度條、關鍵結果清單（可改進度/刪除）、
// 卡片內的「新增關鍵結果」小表單。委派事件都綁在 els.okrList 上（見 app-03-events.js），
// 這裡只負責產生 HTML，不綁事件。
function renderOkrList() {
  if (!els.okrList) return;
  if (!okrs.length) {
    els.okrList.innerHTML = '<p class="muted">還沒有目標，上面輸入標題新增一個。</p>';
    return;
  }
  els.okrList.innerHTML = okrs.map((okr) => {
    const progress = computeOkrProgress(okr);
    const krRows = (okr.keyResults || []).map((kr) => `
      <div class="okr-kr-row">
        <span class="okr-kr-title">${escapeHtml(kr.title)}</span>
        <input type="number" class="okr-kr-input" min="0" value="${Number(kr.current) || 0}" data-okr-id="${okr.id}" data-kr-progress="${kr.id}" aria-label="${escapeHtml(kr.title)} 目前進度" />
        <span class="muted">／ ${Number(kr.target) || 0}</span>
        <button type="button" class="icon-btn" data-okr-id="${okr.id}" data-kr-delete="${kr.id}" aria-label="刪除關鍵結果">✕</button>
      </div>
    `).join('');
    return `
      <div class="okr-card" data-okr-id="${okr.id}">
        <div class="okr-card-head">
          <div>
            <div class="okr-card-title">${escapeHtml(okr.title)}</div>
            ${okr.dueDate ? `<div class="okr-card-due">期限：${escapeHtml(okr.dueDate)}</div>` : ''}
          </div>
          <button type="button" class="icon-btn" data-okr-delete="${okr.id}" aria-label="刪除目標">✕</button>
        </div>
        <div class="okr-progress-track"><div class="okr-progress-fill" style="width:${progress}%"></div></div>
        <div class="muted">${progress}%</div>
        ${krRows}
        <div class="okr-kr-row">
          <input type="text" class="okr-kr-title okr-kr-add-title" placeholder="新增關鍵結果" aria-label="新增關鍵結果標題" data-okr-add-title="${okr.id}" />
          <input type="number" class="okr-kr-input okr-kr-add-target" min="0" placeholder="目標值" aria-label="關鍵結果目標值" data-okr-add-target="${okr.id}" />
          <button type="button" class="ghost-btn" data-okr-add-kr="${okr.id}">＋</button>
        </div>
      </div>
    `;
  }).join('');
}

function computeMoodStats(baseDate) {
  const labels = ['😞 很差', '🙁 不好', '😐 普通', '🙂 不錯', '😄 很好'];
  const counts = [0, 0, 0, 0, 0];
  let total = 0;
  let sum = 0;
  for (let i = 0; i < 30; i += 1) {
    const day = new Date(baseDate.getFullYear(), baseDate.getMonth(), baseDate.getDate() - i);
    const entry = diaryEntries[toDateInput(day)];
    const mood = entry ? Number(entry.mood) : 0;
    if (!(mood >= 1 && mood <= 5)) continue;
    counts[mood - 1] += 1;
    total += 1;
    sum += mood;
  }
  return {
    buckets: labels.map((label, i) => ({ label, count: counts[i] })),
    total,
    max: counts.reduce((m, c) => Math.max(m, c), 0) || 1,
    avg: total ? sum / total : 0,
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
        <li class="dashboard-overdue-item" data-dashboard-edit="${item.id}" data-dashboard-date="${item.date}" tabindex="0" role="button">
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

  const moodStats = computeMoodStats(new Date());
  els.dashboardMoodSummary.textContent = moodStats.total
    ? `近 30 天記錄 ${moodStats.total} 天，平均 ${moodStats.avg.toFixed(1)} / 5`
    : '近 30 天沒有心情記錄';
  els.dashboardMoodDistribution.innerHTML = moodStats.total
    ? moodStats.buckets.map((bucket) => `
        <div class="dashboard-bar-row">
          <div class="dashboard-bar-head">
            <span class="dashboard-bar-label">${bucket.label}</span>
            <span class="dashboard-bar-value">${bucket.count} 天</span>
          </div>
          <div class="dashboard-bar-track"><div class="dashboard-bar-fill" style="width:${Math.round((bucket.count / moodStats.max) * 100)}%"></div></div>
        </div>
      `).join('')
    : '<p class="muted">尚無資料</p>';

  const pomodoroStats = computePomodoroStats(new Date());
  els.dashboardPomodoroSummary.textContent = pomodoroStats.total30
    ? `近 30 天完成 ${pomodoroStats.total30} 顆番茄，共 ${(pomodoroStats.minutes30 / 60).toFixed(1)} 小時，平均每日 ${Math.round(pomodoroStats.minutes30 / 30)} 分鐘`
    : '近 30 天沒有番茄鐘紀錄';
  els.dashboardPomodoroDaily.innerHTML = pomodoroStats.total30
    ? pomodoroStats.days.map((day) => `
        <div class="dashboard-bar-row">
          <div class="dashboard-bar-head">
            <span class="dashboard-bar-label">${escapeHtml(day.label)}</span>
            <span class="dashboard-bar-value">${(day.minutes / 60).toFixed(1)} 小時</span>
          </div>
          <div class="dashboard-bar-track"><div class="dashboard-bar-fill" style="width:${Math.round((day.minutes / pomodoroStats.maxMinutes) * 100)}%"></div></div>
        </div>
      `).join('')
    : '<p class="muted">尚無資料</p>';
}

function openDashboardDialog() {
  if (els.dashboardDialog.open) return;
  renderDashboard();
  els.dashboardDialog.showModal();
}

function closeDashboardDialog() {
  els.dashboardDialog.close();
}

function openTaskDialog(defaults = {}, occurrenceDate = '') {
  if (els.taskDialog.open) return;
  // G1：Google 日曆匯入的行程唯讀。擋在這個唯一入口，所有呼叫端（卡片、時間軸、倒數、
  // 儀表板、命令面板…）一次全部生效，連帶也擋掉對話框內的刪除按鈕。
  if (defaults && defaults.source === 'gcal') {
    showToast('這筆行程由 Google 日曆匯入，唯讀不可編輯');
    return;
  }
  renderCategoryOptions();
  renderCalendarField();
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
  if (els.taskCalendar) els.taskCalendar.value = calendars.some((cal) => cal.id === defaults.calendarId) ? defaults.calendarId : 'default';
  els.taskColorUseCategory.checked = !defaults.color;
  els.taskColor.value = defaults.color || getCategoryColor(defaults.category || '工作');
  updateTaskColorFieldState();
  els.taskLocation.value = defaults.location || '';
  ensureTaskTimezoneOptions();
  if (els.taskTimezone) els.taskTimezone.value = defaults.timezone || '';
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
  // D3 任務依賴：候選清單依「目前正在編輯的行程 id + 已存的 dependsOn」畫出，
  // 要放在 updateRepeatFieldsVisibility() 前後皆可（那裡只管 hidden，這裡管內容）。
  renderDependsOnOptions(defaults.id || '', Array.isArray(defaults.dependsOn) ? defaults.dependsOn : []);
  updateRepeatFieldsVisibility();
  els.taskReminder.value = String(defaults.reminder ?? 10);
  els.taskPinned.checked = Boolean(defaults.pinned);
  els.taskCountdown.checked = Boolean(defaults.countdown);
  els.taskShared.checked = Boolean(defaults.shared);
  els.taskTags.value = (defaults.tags || []).map((tag) => `#${tag}`).join(', ');
  els.taskSubtasks.value = (defaults.subtasks || []).join('\n');
  els.taskNote.value = defaults.note || '';
  els.deleteTaskBtn.hidden = !isEdit;
  attachmentDialogTaskId = isEdit ? defaults.id : '';
  pendingAttachments = [];
  loadAttachmentsForDialog(attachmentDialogTaskId);
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
  // 取消新增（或存檔完成後關窗）都要釋放暫存附件與縮圖 URL，避免記憶體洩漏／舊資料殘留。
  pendingAttachments = [];
  attachmentDialogTaskId = '';
  currentAttachmentRecords = [];
  revokeAttachmentObjectUrls();
}

