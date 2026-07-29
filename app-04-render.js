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
  saveJson(CALENDAR_KEY, calendars);
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
  if (currentView === 'year') els.currentTitle.textContent = `${currentDate.getFullYear()} 年`;
  if (currentView === 'gantt') {
    const ganttStart = startOfWeek(currentDate);
    els.currentTitle.textContent = `${formatMonthDay(ganttStart)} – ${formatMonthDay(addDays(ganttStart, 55))} 甘特`;
  }
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
  renderMoodPicker();
}

// 心情選擇列：只負責把「目前這一天」的心情反白。點擊行為綁在 app-03-events.js 的 bindEvents()。
function renderMoodPicker() {
  if (!els.moodPicker) return;
  const entry = diaryEntries[toDateInput(currentDate)];
  const mood = entry && Number(entry.mood) ? Number(entry.mood) : 0;
  els.moodPicker.querySelectorAll('.mood-btn').forEach((btn) => {
    const on = Number(btn.dataset.mood) === mood;
    btn.classList.toggle('is-active', on);
    btn.setAttribute('aria-pressed', on ? 'true' : 'false');
  });
}

// 同一顆再按一次＝取消；updatedAt 供雲端同步「逐日較新者勝」使用。
function setMoodForCurrentDate(mood) {
  const key = toDateInput(currentDate);
  const current = diaryEntries[key] && Number(diaryEntries[key].mood);
  if (current === mood) diaryEntries[key] = { mood: 0, updatedAt: Date.now() }; // 取消不是刪除，留 mood:0 墓碑讓雲端合併知道「這是新的取消動作」
  else diaryEntries[key] = { mood, updatedAt: Date.now() };
  saveJson(DIARY_KEY, diaryEntries);
  renderMoodPicker();
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
  if (currentView === 'year') renderYear(visibleTasks);
  if (currentView === 'gantt') renderGantt(visibleTasks);
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
    const color = getTaskColor(task);
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
            ${moodDotHtml(key)}
            ${dayTasks.map((task) => taskCard(task, key)).join('')}
            ${allDayTasks.length > 4 ? '<span class="badge">更多...</span>' : ''}
          </div>
        `;
      }).join('')}
    </div>
  `;
}

// 月檢視心情色點：絕對定位在格子右下角，不佔文字流、不改格子高度。
// mood 0（取消的墓碑）與沒記錄一律回空字串，不畫點。
function moodDotHtml(dateKey) {
  const entry = diaryEntries[dateKey];
  const mood = entry ? Number(entry.mood) : 0;
  if (!(mood >= 1 && mood <= 5)) return '';
  return `<span class="mood-dot mood-dot-${mood}" title="心情 ${mood}/5" aria-hidden="true"></span>`;
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

// 年檢視（第五種檢視）：12 個迷你月曆格＋全年行程數熱力圖。行程數統計「一次」建好
// dateKey → count 的 Map（buildYearDateCountMap），逐格套用時只查表，不對每一格
// 重新跑 visibleTasks.filter(occursOnDate)。熱力 class 沿用月檢視同一顆 heatClass()。
function renderYear(visibleTasks) {
  const year = currentDate.getFullYear();
  const counts = buildYearDateCountMap(visibleTasks, year);
  const todayKey = toDateInput(new Date());

  els.calendarView.innerHTML = `
    <div class="year-grid">
      ${Array.from({ length: 12 }, (_, month) => renderMiniMonth(year, month, counts, todayKey)).join('')}
    </div>
  `;
}

function buildYearDateCountMap(visibleTasks, year) {
  const counts = new Map();
  let cursor = new Date(year, 0, 1);
  const end = new Date(year, 11, 31);
  while (cursor <= end) {
    const key = toDateInput(cursor);
    let count = 0;
    for (const task of visibleTasks) {
      if (occursOnDate(task, key)) count += 1;
    }
    counts.set(key, count);
    cursor = addDays(cursor, 1);
  }
  return counts;
}

const MINI_WEEKDAY_LABELS = ['一', '二', '三', '四', '五', '六', '日'];

function renderMiniMonth(year, month, counts, todayKey) {
  const first = new Date(year, month, 1);
  const gridStart = startOfWeek(first);
  const days = Array.from({ length: 42 }, (_, i) => addDays(gridStart, i));
  const monthKey = `${year}-${String(month + 1).padStart(2, '0')}`;

  return `
    <div class="mini-month">
      <h3 class="mini-month-title" data-jump-month="${monthKey}" title="點一下切換到月檢視">${month + 1} 月</h3>
      <div class="mini-weekday-row">${MINI_WEEKDAY_LABELS.map((label) => `<span>${label}</span>`).join('')}</div>
      <div class="mini-day-grid">
        ${days.map((day) => {
          const key = toDateInput(day);
          const inMonth = day.getMonth() === month;
          const count = inMonth ? (counts.get(key) || 0) : 0;
          return `<div class="mini-day ${inMonth ? heatClass(count) : ''} ${key === todayKey ? 'today' : ''} ${!inMonth ? 'outside' : ''}" data-jump-day="${key}" title="${inMonth ? count + ' 筆行程' : ''}">${day.getDate()}</div>`;
        }).join('')}
      </div>
    </div>
  `;
}

// 年檢視互動：點月名跳到月檢視、點日格跳到日檢視。寫法比照既有 jumpToTaskAndEdit()
// （app-03-events.js）——先切 currentView、同步 view-switch active 樣式、設定
// currentDate，最後呼叫 render()，只是這裡不開任務編輯視窗。
function jumpToMonthView(monthKey) {
  const [y, m] = monthKey.split('-').map(Number);
  currentView = 'month';
  document.querySelectorAll('.view-btn:not(.day-mode-btn)').forEach((btn) => btn.classList.toggle('active', btn.dataset.view === 'month'));
  currentDate = new Date(y, m - 1, 1);
  render();
}

function jumpToDayView(dateKey) {
  currentView = 'day';
  document.querySelectorAll('.view-btn:not(.day-mode-btn)').forEach((btn) => btn.classList.toggle('active', btn.dataset.view === 'day'));
  currentDate = startOfDay(new Date(`${dateKey}T00:00:00`));
  render();
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

// D3 任務依賴：組出 🔗 badge 的 title 文字，列出所有前置任務名稱與完成狀態
// （完成判定走 getIncompleteDependencies() 同一套 completedDates 含自身 date 邏輯）。
function dependsOnTitle(task) {
  const incompleteIds = new Set(getIncompleteDependencies(task).map((dep) => dep.id));
  const names = (task.dependsOn || [])
    .map((depId) => tasks.find((item) => item.id === depId && !item.deletedAt))
    .filter(Boolean)
    .map((dep) => `${dep.title}（${incompleteIds.has(dep.id) ? '未完成' : '已完成'}）`);
  return names.length ? `前置任務：${names.join('、')}` : '';
}

// D4 旅行模式換算 badge：只有 task.timezone 存在且跟目前顯示時區不同才顯示，只加顯示用 badge，
// 不碰行程本身的排序/所屬日期/存檔值（task.date/task.start 本身完全不變）。
// 目前顯示時區：旅行模式開啟時＝appSettings.travelTimezone，否則＝裝置本地時區。
function timezoneConversionBadge(task) {
  if (!task.timezone || !task.start) return ''; // 無時間的全天行程不顯示換算
  const displayTz = appSettings.travelTimezone || Intl.DateTimeFormat().resolvedOptions().timeZone;
  if (task.timezone === displayTz) return '';
  const epoch = wallTimeToEpoch(task.date, task.start, task.timezone);
  if (!Number.isFinite(epoch)) return '';
  const converted = formatInTz(epoch, displayTz);
  const dayDiff = Math.round((new Date(`${converted.date}T00:00:00`) - new Date(`${task.date}T00:00:00`)) / 86400000);
  const dayLabel = dayDiff > 0 ? ` +${dayDiff}d` : (dayDiff < 0 ? ` ${dayDiff}d` : '');
  const known = COMMON_TIMEZONES.find((item) => item.value === displayTz);
  const displayLabel = known ? known.label : displayTz.split('/').pop().replace(/_/g, ' ');
  const title = `${task.timezone} ${task.start} → ${displayTz} ${converted.time}${dayLabel}`;
  return `<span class="badge tz-badge" title="${escapeHtml(title)}">→${escapeHtml(displayLabel)} ${converted.time}${dayLabel}</span>`;
}

function taskCard(task, dateKey) {
  const priorityClass = `priority-${task.priority}`;
  const color = getTaskColor(task);
  const done = isTaskDone(task, dateKey);
  const overdue = isTaskOverdue(task, dateKey);
  return `
    <article class="task-card ${done ? 'done' : ''} ${overdue ? 'overdue' : ''} ${task.pinned ? 'pinned' : ''}" style="--category-color:${color}" draggable="true" data-task-id="${task.id}" data-task-date="${dateKey}">
      <div class="task-top">
        <input type="checkbox" ${done ? 'checked' : ''} data-toggle-done="${task.id}" data-done-date="${dateKey}" aria-label="完成 ${escapeHtml(task.title)}" />
        <div class="task-title">${escapeHtml(task.title)}${task.shared ? '<span class="shared-badge" title="家人共享行程" style="font-size:0.8em;">👨‍👩‍👧</span>' : ''}</div>
        <div class="task-actions">
          <button class="small-btn" data-toggle-pin="${task.id}" title="置頂 / 取消置頂">${task.pinned ? '📌' : '📍'}</button>
          <button class="small-btn" data-copy-task="${task.id}" title="複製到明天">⧉</button>
          <button class="small-btn" data-edit-task="${task.id}" title="編輯">✎</button>
          <button class="small-btn" data-delete-task="${task.id}" title="刪除">🗑</button>
        </div>
      </div>
      <div class="task-meta">
        <span class="badge">${task.start}–${task.end}</span>
        ${timezoneConversionBadge(task)}
        <span class="badge">${escapeHtml(task.category)}</span>
        <span class="badge ${priorityClass}">優先：${priorityLabel[task.priority]}</span>
        ${task.pinned ? '<span class="badge pinned-badge">置頂</span>' : ''}
        ${overdue ? '<span class="badge overdue-badge">逾時</span>' : ''}
        ${task.repeat !== 'none' ? `<span class="badge">${escapeHtml(repeatDisplayLabel(task))}</span>` : ''}
        ${task.dependsOn?.length ? `<span class="badge depends-badge" title="${escapeHtml(dependsOnTitle(task))}">🔗</span>` : ''}
        ${task.attachmentCount > 0 ? `<span class="badge">📎${task.attachmentCount}</span>` : ''}
        ${(task.tags || []).map((tag) => `<span class="badge tag-badge">#${escapeHtml(tag)}</span>`).join('')}
      </div>
      ${task.location ? `<p class="task-location"><a href="https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(task.location)}" target="_blank" rel="noopener" onclick="event.stopPropagation()">📍${escapeHtml(task.location)}</a></p>` : ''}
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
    .filter((task) => !task.deletedAt && task.countdown)
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
    color: null,
    location: '',
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
    updatedAt: Date.now(),
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

// 掛牆看板模式：家用平板全螢幕今日行程。#kioskOverlay 是一般 div（非 dialog），開啟時
// 進全螢幕＋顯示 overlay；時鐘每 30 秒更新、行程清單每分鐘重新渲染（跨日/完成狀態變化會反映）。
// Esc 監聽只在看板開啟期間掛上，關閉時連同兩個 timer 一起清掉。
let kioskClockTimer = null;
let kioskRenderTimer = null;

function openKioskMode() {
  if (!els.kioskOverlay) return;
  els.kioskOverlay.hidden = false;
  document.documentElement.requestFullscreen?.().catch(() => {});
  renderKioskClock();
  renderKioskTasks();
  clearInterval(kioskClockTimer);
  clearInterval(kioskRenderTimer);
  kioskClockTimer = setInterval(renderKioskClock, 30000);
  kioskRenderTimer = setInterval(renderKioskTasks, 60000);
  document.addEventListener('keydown', handleKioskKeydown);
}

function closeKioskMode() {
  if (!els.kioskOverlay) return;
  els.kioskOverlay.hidden = true;
  document.exitFullscreen?.().catch(() => {});
  clearInterval(kioskClockTimer);
  clearInterval(kioskRenderTimer);
  kioskClockTimer = null;
  kioskRenderTimer = null;
  document.removeEventListener('keydown', handleKioskKeydown);
}

function handleKioskKeydown(event) {
  if (event.key === 'Escape') closeKioskMode();
}

function renderKioskClock() {
  const now = new Date();
  if (els.kioskClock) {
    els.kioskClock.textContent = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
  }
  if (els.kioskDateLine) {
    const dateKey = toDateInput(now);
    const weekday = new Intl.DateTimeFormat('zh-TW', { weekday: 'short' }).format(now);
    const holidayName = getHoliday(dateKey);
    els.kioskDateLine.textContent = `${now.getMonth() + 1}月${now.getDate()}日 ${weekday}　農曆${lunarFullLabel(now)}${holidayName ? '　🟢 ' + holidayName : ''}`;
  }
}

function renderKioskTasks() {
  if (!els.kioskTaskList) return;
  const dateKey = toDateInput(new Date());
  const dayTasks = tasks.filter((task) => occursOnDate(task, dateKey)).sort((a, b) => a.start.localeCompare(b.start));

  if (!dayTasks.length) {
    els.kioskTaskList.innerHTML = '<div class="kiosk-empty">今天沒有行程 🎉</div>';
    return;
  }

  els.kioskTaskList.innerHTML = dayTasks.map((task) => {
    const done = isTaskDone(task, dateKey);
    const color = getTaskColor(task);
    return `
      <div class="kiosk-task-item ${done ? 'done' : ''}">
        <span class="kiosk-task-dot" style="background:${color}"></span>
        <span class="kiosk-task-time">${task.start}</span>
        <span class="kiosk-task-title">${escapeHtml(task.title)}</span>
      </div>
    `;
  }).join('');
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
  updateToolbarMenuButtons();
}

function openPomodoroDialog() {
  if (els.pomodoroDialog.open) return;
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
  const removable = tasks.filter((task) => !task.deletedAt && task.repeat === 'none' && task.date < todayKey && (task.completedDates || []).length);
  if (!removable.length) return showToast('沒有可清理的舊行程');
  if (!confirm(`確定刪除 ${removable.length} 筆已完成的過去行程？`)) return;
  removable.forEach((task) => tombstoneTask(task));
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
      tombstoneTask(task);
      return;
    }
    task.excludedDates = Array.isArray(task.excludedDates) ? task.excludedDates : [];
    if (!task.excludedDates.includes(dateKey)) task.excludedDates.push(dateKey);
    touchTask(task);
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

  targets.forEach((task) => { task.date = nextDateKey; touchTask(task); });
  saveJson(STORAGE_KEY, tasks);
  render();
  showToast(`已順延 ${targets.length} 筆到 ${formatMonthDay(nextDate)}`);
}

// ── 甘特檢視（V2）──────────────────────────────────────────────────
// 8 週橫向時間軸：列＝範圍內至少出現一次的可見行程（重複行程以 occursOnDate 展開，
// 每個命中日一格 bar）；單次行程間的 dependsOn 以 SVG L 形連線表示，前置未完成時
// 連線用警示色虛線。點列名或 bar 走既有 data-edit-task 委派開編輯視窗。
const GANTT_COL = 26;
const GANTT_ROW = 30;
const GANTT_NAME_W = 140;
const GANTT_MAX_ROWS = 60;

function renderGantt(visibleTasks) {
  const start = startOfWeek(currentDate);
  const days = Array.from({ length: 56 }, (_, i) => addDays(start, i));
  const dayKeys = days.map((day) => toDateInput(day));
  const todayKey = toDateInput(new Date());
  const width = dayKeys.length * GANTT_COL;

  const rows = [];
  for (const task of visibleTasks) {
    const hitIdx = [];
    dayKeys.forEach((key, idx) => { if (occursOnDate(task, key)) hitIdx.push(idx); });
    if (hitIdx.length) rows.push({ task, hitIdx });
  }
  rows.sort((a, b) => a.hitIdx[0] - b.hitIdx[0] || String(a.task.start || '').localeCompare(String(b.task.start || '')));
  const hidden = Math.max(0, rows.length - GANTT_MAX_ROWS);
  const shown = rows.slice(0, GANTT_MAX_ROWS);

  if (!shown.length) {
    els.calendarView.innerHTML = '<div class="empty-state"><div><strong>此 8 週內沒有行程</strong><p>調整篩選，或按「今天」回到本週。</p></div></div>';
    return;
  }

  const todayIdx = dayKeys.indexOf(todayKey);
  const headCells = days.map((day, idx) => {
    const wd = day.getDay();
    const label = (idx === 0 || day.getDate() === 1) ? `${day.getMonth() + 1}/${day.getDate()}` : String(day.getDate());
    return `<span class="gantt-head-cell${wd === 0 || wd === 6 ? ' weekend' : ''}${idx === todayIdx ? ' today' : ''}" title="${dayKeys[idx]}">${label}</span>`;
  }).join('');

  const rowHtml = shown.map(({ task, hitIdx }) => {
    const color = getTaskColor(task);
    const bars = hitIdx.map((idx) => {
      const key = dayKeys[idx];
      const done = isTaskDone(task, key);
      return `<span class="gantt-bar${done ? ' done' : ''}" style="left:${idx * GANTT_COL + 2}px;background:${color}" data-edit-task="${task.id}" title="${task.title}　${key}${done ? '（已完成）' : ''}">${done ? '✓' : ''}</span>`;
    }).join('');
    const todayLine = todayIdx >= 0 ? `<span class="gantt-today-col" style="left:${todayIdx * GANTT_COL}px"></span>` : '';
    return `<div class="gantt-row"><div class="gantt-name" data-edit-task="${task.id}" title="${task.title}"><span class="gantt-dot" style="background:${color}"></span>${task.title}</div><div class="gantt-cells" style="width:${width}px">${todayLine}${bars}</div></div>`;
  }).join('');

  const pos = new Map();
  shown.forEach(({ task, hitIdx }, rowIdx) => {
    if (task.repeat === 'none') pos.set(task.id, { rowIdx, colIdx: hitIdx[0] });
  });
  const links = [];
  shown.forEach(({ task }) => {
    if (task.repeat !== 'none' || !Array.isArray(task.dependsOn) || !task.dependsOn.length) return;
    const to = pos.get(task.id);
    if (!to) return;
    const incompleteIds = new Set(getIncompleteDependencies(task).map((dep) => dep.id));
    task.dependsOn.forEach((depId) => {
      const from = pos.get(depId);
      if (!from) return;
      const x1 = (from.colIdx + 1) * GANTT_COL - 2;
      const y1 = from.rowIdx * GANTT_ROW + GANTT_ROW / 2;
      const x2 = to.colIdx * GANTT_COL + 2;
      const y2 = to.rowIdx * GANTT_ROW + GANTT_ROW / 2;
      const xm = Math.max(x1 + 6, x2 - 6);
      links.push(`<path d="M ${x1} ${y1} H ${xm} V ${y2} H ${x2}"${incompleteIds.has(depId) ? ' class="blocked"' : ''}></path>`);
    });
  });
  const svg = links.length
    ? `<svg class="gantt-links" style="left:${GANTT_NAME_W}px" width="${width}" height="${shown.length * GANTT_ROW}" xmlns="http://www.w3.org/2000/svg">${links.join('')}</svg>`
    : '';

  els.calendarView.innerHTML = `
    <div class="gantt-scroll">
      <div class="gantt-inner">
        <div class="gantt-head-row"><div class="gantt-name gantt-head-name">行程</div><div class="gantt-cells" style="width:${width}px">${headCells}</div></div>
        <div class="gantt-body">${rowHtml}${svg}</div>
      </div>
    </div>
    ${hidden ? `<div class="gantt-more">還有 ${hidden} 筆行程未顯示（縮小篩選範圍可見）</div>` : ''}`;
}

