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
  setupSwipeNavigation();
  setupTaskSwipeActions();
  setupLongPressCreate();
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
  els.printViewBtn?.addEventListener('click', () => window.print());
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
  if (els.addAttachmentBtn) els.addAttachmentBtn.addEventListener('click', () => els.attachmentFileInput?.click());
  if (els.attachmentFileInput) els.attachmentFileInput.addEventListener('change', handleAttachmentFilesSelected);
  if (els.attachmentList) els.attachmentList.addEventListener('click', handleAttachmentListClick);
  [els.taskDate, els.taskStart, els.taskEnd].forEach((el) => el.addEventListener('input', updateConflictWarning));
  els.taskRepeat.addEventListener('change', updateRepeatFieldsVisibility);
  els.taskColorUseCategory.addEventListener('change', updateTaskColorFieldState);
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

  // 掛牆看板模式：#moreToolsDialog 內的按鈕自己綁 click（不是 data-proxy），因為要接著呼叫
  // openKioskMode() 進全螢幕，不是單純轉呼叫某顆既有按鈕。桌面工具列不加鈕，避免更擠。
  els.kioskModeBtn?.addEventListener('click', () => {
    els.moreToolsDialog?.close();
    openKioskMode();
  });
  els.kioskCloseBtn?.addEventListener('click', closeKioskMode);

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

  // 多日曆本：工具列「📚 日曆本」開可見度勾選清單；「管理日曆本…」另開 CRUD 對話框。
  els.calendarsBtn?.addEventListener('click', () => {
    renderCalendarVisibilityList();
    els.calendarVisibilityDialog?.showModal();
  });
  els.closeCalendarVisibilityBtn?.addEventListener('click', () => els.calendarVisibilityDialog?.close());
  els.manageCalendarsBtn?.addEventListener('click', () => {
    els.calendarVisibilityDialog?.close();
    renderCalendarManageList();
    els.calendarManageDialog?.showModal();
  });
  els.closeCalendarManageBtn?.addEventListener('click', () => els.calendarManageDialog?.close());
  els.addCalendarBtn?.addEventListener('click', addCalendar);
  els.calendarNameInput?.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') addCalendar();
  });
  // 重新命名輸入框是動態產生的清單項目，用容器 delegation 接 Enter → blur() 觸發 change 事件存檔。
  els.calendarManageList?.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' && event.target.matches('[data-rename-calendar]')) event.target.blur();
  });

  // D4 旅行模式：開關/顯示時區 select 即改即存 appSettings.travelTimezone，沒有另外的儲存按鈕。
  els.closeTravelModeBtn?.addEventListener('click', () => els.travelModeDialog?.close());
  els.travelModeEnabled?.addEventListener('change', () => {
    const deviceTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    appSettings.travelTimezone = els.travelModeEnabled.checked ? (els.travelModeTimezone?.value || deviceTimezone) : null;
    saveJson(APP_SETTINGS_KEY, appSettings);
    render();
  });
  els.travelModeTimezone?.addEventListener('change', () => {
    if (!els.travelModeEnabled?.checked) return;
    appSettings.travelTimezone = els.travelModeTimezone.value || null;
    saveJson(APP_SETTINGS_KEY, appSettings);
    render();
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
  { label: '年檢視', run: () => document.querySelector('.view-btn[data-view="year"]')?.click() },
  { label: '甘特檢視', run: () => document.querySelector('.view-btn[data-view="gantt"]')?.click() },
  { label: '列表檢視', run: () => document.querySelector('.view-btn[data-view="agenda"]')?.click() },
  { label: '深色模式切換', run: () => els.themeBtn.click() },
  { label: '番茄鐘', run: () => els.pomodoroBtn.click() },
  { label: '週回顧', run: () => els.weeklyReviewBtn.click() },
  { label: '統計', run: () => els.dashboardBtn.click() },
  { label: '批量新增', run: () => els.batchAddBtn.click() },
  { label: '資料檢查', run: () => els.dataCheckBtn.click() },
  { label: '備份', run: () => els.backupBtn.click() },
  { label: '今日待辦模式', run: () => els.todayTodoBtn.click() },
  { label: '看板模式', run: () => els.kioskModeBtn.click() },
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
    ? tasks.filter((task) => !task.deletedAt && (commandPaletteFuzzyMatch(task.title, q) || commandPaletteFuzzyMatch(task.note, q))).slice(0, 8)
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


function setupSwipeNavigation() {
  const view = document.getElementById('calendarView');
  if (!view) return;
  let startX = 0, startY = 0, tracking = false;
  view.addEventListener('touchstart', (e) => {
    if (e.touches.length !== 1) { tracking = false; return; }
    if (e.target.closest('.task-card')) { tracking = false; return; }
    tracking = true;
    startX = e.touches[0].clientX;
    startY = e.touches[0].clientY;
  }, { passive: true });
  view.addEventListener('touchend', (e) => {
    if (!tracking) return;
    tracking = false;
    const t = e.changedTouches[0];
    const dx = t.clientX - startX;
    const dy = t.clientY - startY;
    if (Math.abs(dx) >= 60 && Math.abs(dx) > 2 * Math.abs(dy)) {
      navigate(dx < 0 ? 1 : -1);
    }
  }, { passive: true });
}

function setupTaskSwipeActions() {
  const view = document.getElementById('calendarView');
  if (!view) return;
  let card = null, startX = 0, startY = 0, active = false, horizontal = false;
  view.addEventListener('touchstart', (e) => {
    if (e.touches.length !== 1) { active = false; return; }
    card = e.target.closest('.task-card');
    if (!card || e.target.closest('input, button, a, select, textarea')) { card = null; return; }
    active = true; horizontal = false;
    startX = e.touches[0].clientX; startY = e.touches[0].clientY;
  }, { passive: true });
  view.addEventListener('touchmove', (e) => {
    if (!active || !card) return;
    const dx = e.touches[0].clientX - startX;
    const dy = e.touches[0].clientY - startY;
    if (!horizontal) {
      if (Math.abs(dy) > 12 && Math.abs(dy) > Math.abs(dx)) { resetCardSwipe(card); active = false; card = null; return; }
      if (Math.abs(dx) > 12 && Math.abs(dx) > Math.abs(dy)) horizontal = true;
    }
    if (horizontal) {
      card.classList.add('swiping');
      card.classList.toggle('swiping-left', dx < 0);
      card.classList.toggle('swiping-right', dx > 0);
      card.style.transform = `translateX(${Math.max(-120, Math.min(120, dx))}px)`;
    }
  }, { passive: true });
  view.addEventListener('touchend', (e) => {
    if (!active || !card) { active = false; return; }
    active = false;
    const dx = e.changedTouches[0].clientX - startX;
    const el = card; card = null;
    resetCardSwipe(el);
    if (!horizontal || Math.abs(dx) < 80) return;
    const task = tasks.find((item) => item.id === el.dataset.taskId && !item.deletedAt);
    if (!task) return;
    const dateKey = el.dataset.taskDate || toDateInput(currentDate);
    if (dx < 0) {
      if (isTaskDone(task, dateKey)) return showToast('已完成');
      const blockers = getIncompleteDependencies(task);
      if (blockers.length) return showToast(`前置任務未完成：${blockers.map((dep) => dep.title).join('、')}`);
      setTaskDone(task, dateKey, true);
      playDoneSound();
      saveJson(STORAGE_KEY, tasks);
      render();
      showToast('已完成 ✅');
    } else {
      if (task.repeat !== 'none') return showToast('重複行程請用編輯調整日期');
      if (isTaskDone(task, dateKey)) return showToast('已完成的行程不需順延');
      const nextDate = nextWorkingDay(new Date(dateKey + 'T00:00:00'));
      task.date = toDateInput(nextDate);
      touchTask(task);
      saveJson(STORAGE_KEY, tasks);
      render();
      showToast(`已順延到 ${formatMonthDay(nextDate)}`);
    }
  }, { passive: true });
}

function resetCardSwipe(el) {
  if (!el) return;
  el.classList.remove('swiping', 'swiping-left', 'swiping-right');
  el.style.transform = '';
}

function setupLongPressCreate() {
  const view = document.getElementById('calendarView');
  if (!view) return;
  let timer = null, fired = false, sx = 0, sy = 0;
  const cancel = () => { if (timer) { clearTimeout(timer); timer = null; } };
  view.addEventListener('touchstart', (e) => {
    if (e.touches.length !== 1) return cancel();
    const cell = e.target.closest('.month-day');
    if (!cell || e.target.closest('.task-card, button, input, a')) return cancel();
    const key = cell.dataset.dropDate;
    if (!key) return cancel();
    sx = e.touches[0].clientX; sy = e.touches[0].clientY; fired = false;
    timer = setTimeout(() => {
      timer = null; fired = true;
      openTaskDialog({ date: key });
    }, 500);
  }, { passive: true });
  view.addEventListener('touchmove', (e) => {
    if (!timer) return;
    const dx = e.touches[0].clientX - sx;
    const dy = e.touches[0].clientY - sy;
    if (Math.abs(dx) > 10 || Math.abs(dy) > 10) cancel();
  }, { passive: true });
  view.addEventListener('touchend', () => cancel(), { passive: true });
  view.addEventListener('touchcancel', () => cancel(), { passive: true });
  view.addEventListener('click', (e) => {
    if (fired) { fired = false; e.stopPropagation(); e.preventDefault(); }
  }, true);
}
