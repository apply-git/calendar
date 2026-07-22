// ----------------------------------------------------------------------------
// 附件 UI（#taskDialog 內，備註欄之後）：新增行程尚未儲存時附件先暫存在 pendingAttachments
// 記憶體陣列，saveTaskFromForm() 拿到 task.id 後才寫入 IndexedDB；編輯既有行程則即寫即存。
// attachmentsUnavailable 時整個區塊已在 initAttachmentFeature() 隱藏，這裡的函式不會被觸發
// （addAttachmentBtn/attachmentList 皆為 null，事件不會綁上）。
// ----------------------------------------------------------------------------
function revokeAttachmentObjectUrls() {
  attachmentObjectUrls.forEach((url) => URL.revokeObjectURL(url));
  attachmentObjectUrls = [];
}

function loadAttachmentsForDialog(taskId) {
  if (attachmentsUnavailable || !els.attachmentList) return;
  if (taskId) {
    idbGetByTask(taskId).then((records) => renderAttachmentList(records)).catch(() => renderAttachmentList([]));
  } else {
    renderAttachmentList(pendingAttachments);
  }
}

function renderAttachmentList(records) {
  currentAttachmentRecords = records;
  if (!els.attachmentList) return;
  revokeAttachmentObjectUrls();
  if (!records.length) {
    els.attachmentList.innerHTML = '<p class="muted">尚無附件</p>';
    return;
  }
  els.attachmentList.innerHTML = records.map((record) => {
    const isImage = (record.type || '').startsWith('image/');
    let thumb;
    if (isImage) {
      const url = URL.createObjectURL(record.blob);
      attachmentObjectUrls.push(url);
      thumb = `<img src="${url}" alt="" class="attachment-thumb" data-preview-attachment="${record.id}" />`;
    } else {
      thumb = `<span class="attachment-thumb attachment-thumb-file" data-preview-attachment="${record.id}">📄</span>`;
    }
    return `
      <div class="attachment-item">
        ${thumb}
        <span class="attachment-name" data-preview-attachment="${record.id}" title="${escapeHtml(record.name)}">${escapeHtml(record.name)}</span>
        <button type="button" class="small-btn" data-delete-attachment="${record.id}" title="刪除附件">🗑</button>
      </div>
    `;
  }).join('');
}

function makeAttachmentRecord(file, taskId) {
  return {
    id: `att-${crypto.randomUUID()}`,
    taskId: taskId || null,
    name: file.name,
    type: file.type || '',
    size: file.size,
    blob: file,
    createdAt: Date.now(),
  };
}

function handleAttachmentFilesSelected(event) {
  const files = Array.from(event.target.files || []);
  event.target.value = '';
  if (!files.length || attachmentsUnavailable) return;

  const currentCount = attachmentDialogTaskId ? currentAttachmentRecords.length : pendingAttachments.length;
  let remaining = ATTACHMENT_MAX_PER_TASK - currentCount;
  const accepted = [];
  for (const file of files) {
    if (remaining <= 0) { showToast(`每筆行程最多 ${ATTACHMENT_MAX_PER_TASK} 個附件`); break; }
    if (file.size > ATTACHMENT_MAX_SIZE) { showToast(`「${file.name}」超過 5MB，已略過`); continue; }
    accepted.push(file);
    remaining--;
  }
  if (!accepted.length) return;

  const records = accepted.map((file) => makeAttachmentRecord(file, attachmentDialogTaskId || null));

  if (attachmentDialogTaskId) {
    Promise.all(records.map((record) => idbPut(record))).then(() => {
      const task = tasks.find((item) => item.id === attachmentDialogTaskId);
      if (task) {
        task.attachmentCount = (task.attachmentCount || 0) + records.length;
        touchTask(task);
        saveJson(STORAGE_KEY, tasks);
        render();
      }
      loadAttachmentsForDialog(attachmentDialogTaskId);
    }).catch(() => showToast('附件儲存失敗'));
  } else {
    pendingAttachments = [...pendingAttachments, ...records];
    renderAttachmentList(pendingAttachments);
  }
}

function deleteAttachmentItem(id) {
  if (attachmentDialogTaskId) {
    idbDelete(id).then(() => {
      const task = tasks.find((item) => item.id === attachmentDialogTaskId);
      if (task) {
        task.attachmentCount = Math.max(0, (task.attachmentCount || 0) - 1);
        touchTask(task);
        saveJson(STORAGE_KEY, tasks);
        render();
      }
      loadAttachmentsForDialog(attachmentDialogTaskId);
    }).catch(() => showToast('附件刪除失敗'));
  } else {
    pendingAttachments = pendingAttachments.filter((record) => record.id !== id);
    renderAttachmentList(pendingAttachments);
  }
}

function openAttachmentPreview(id) {
  const record = currentAttachmentRecords.find((item) => item.id === id);
  if (!record) return;
  const url = URL.createObjectURL(record.blob);
  window.open(url, '_blank');
}

function handleAttachmentListClick(event) {
  const deleteId = event.target.closest('[data-delete-attachment]')?.dataset.deleteAttachment;
  if (deleteId) { deleteAttachmentItem(deleteId); return; }
  const previewId = event.target.closest('[data-preview-attachment]')?.dataset.previewAttachment;
  if (previewId) openAttachmentPreview(previewId);
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

  // D3 任務依賴：前置任務僅單次（非重複）行程可設定，重複行程隱藏此欄
  // （saveTaskFromForm() 存檔時同步清空 dependsOn，兩處條件都是 repeat === 'none'）。
  if (els.taskDependsOnField) els.taskDependsOnField.hidden = repeat !== 'none';
}

// D3 任務依賴：檢查 startId 這筆行程是否會（直接或間接）依賴 targetId，用來在
// 「前置任務」候選清單排除選了會成環的行程（選了 A 依賴 B，就不准 B 再依賴 A）。
function dependsOnReachable(startId, targetId) {
  const visited = new Set();
  const queue = [startId];
  while (queue.length) {
    const id = queue.shift();
    if (visited.has(id)) continue;
    visited.add(id);
    const current = tasks.find((item) => item.id === id);
    if (!current || !Array.isArray(current.dependsOn)) continue;
    for (const depId of current.dependsOn) {
      if (depId === targetId) return true;
      if (!visited.has(depId)) queue.push(depId);
    }
  }
  return false;
}

// D3 任務依賴：畫出「前置任務」checkbox 清單。候選項目＝其他單次（repeat==='none'）
// 且未刪除的行程，排除自己、排除選了會成環者。currentTaskId 新增行程時為空字串，
// 此時不可能形成環（沒有任何行程能依賴一個還不存在的 id），全部候選項目都會列出。
function renderDependsOnOptions(currentTaskId, selectedIds) {
  if (!els.taskDependsOnList) return;
  const selected = new Set(Array.isArray(selectedIds) ? selectedIds : []);
  const candidates = tasks
    .filter((task) => !task.deletedAt && task.repeat === 'none' && task.id !== currentTaskId)
    .filter((task) => !(currentTaskId && dependsOnReachable(task.id, currentTaskId)))
    .sort((a, b) => a.date.localeCompare(b.date) || a.title.localeCompare(b.title));

  els.taskDependsOnList.innerHTML = candidates.length
    ? candidates.map((task) => `
        <label>
          <input type="checkbox" value="${task.id}" ${selected.has(task.id) ? 'checked' : ''} />
          <span>${escapeHtml(task.title)}</span>
          <span class="muted">${formatMonthDay(new Date(`${task.date}T00:00:00`))}</span>
        </label>
      `).join('')
    : '<p class="muted">尚無可設定的單次行程</p>';
}

// D3 任務依賴：從目前開著的「前置任務」checkbox 清單讀出使用者勾選的 id。
function getCheckedDependsOnIds() {
  if (!els.taskDependsOnList) return [];
  return Array.from(els.taskDependsOnList.querySelectorAll('input[type="checkbox"]:checked')).map((input) => input.value);
}

// 「使用分類色」勾選時停用色彩選色器，避免使用者誤以為調色會生效。
function updateTaskColorFieldState() {
  els.taskColor.disabled = els.taskColorUseCategory.checked;
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
    calendarId: els.taskCalendar ? els.taskCalendar.value : 'default',
    color: els.taskColorUseCategory.checked ? null : els.taskColor.value,
    location: els.taskLocation.value.trim(),
    timezone: els.taskTimezone ? (els.taskTimezone.value || null) : null,
    repeat: els.taskRepeat.value,
    repeatInterval: Math.min(365, Math.max(2, Number(els.taskRepeatInterval.value) || 2)),
    repeatWeekday: Math.min(6, Math.max(0, Number(els.taskRepeatWeekday.value) || 0)),
    repeatNth: [1, 2, 3, 4, -1].includes(Number(els.taskRepeatNth.value)) ? Number(els.taskRepeatNth.value) : 1,
    reminder: Number(els.taskReminder.value),
    pinned: els.taskPinned.checked,
    countdown: els.taskCountdown.checked,
    shared: els.taskShared.checked,
    tags: parseTags(els.taskTags.value),
    subtasks: linesFromTextarea(els.taskSubtasks.value),
    note: els.taskNote.value.trim(),
    // D3 任務依賴：僅單次行程可設定前置任務；重複行程存檔時一律清空 dependsOn。
    dependsOn: els.taskRepeat.value === 'none'
      ? getCheckedDependsOnIds().filter((depId) => depId !== els.taskId.value)
      : [],
    completedDates: existingTask?.completedDates || [],
    excludedDates: existingTask?.excludedDates || [],
    repeatUntil: existingTask?.repeatUntil || '',
    attachmentCount: existingTask?.attachmentCount || 0,
    sortOrder: existingTask?.sortOrder || Date.now(),
    createdAt: existingTask?.createdAt || new Date().toISOString(),
    updatedAt: Date.now(),
  };

  if (!task.title) return showToast('請輸入事項名稱');
  if (task.end <= task.start) return showToast('結束時間需晚於開始時間');

  const editOnce = Boolean(existingTask && editingOccurrenceDate && existingTask.repeat !== 'none' && els.taskScope.value === 'once');
  const editFuture = Boolean(existingTask && editingOccurrenceDate && existingTask.repeat !== 'none' && els.taskScope.value === 'future');
  if (editOnce) {
    existingTask.excludedDates = [...new Set([...(existingTask.excludedDates || []), editingOccurrenceDate])];
    touchTask(existingTask);
    tasks.push({
      ...task,
      id: crypto.randomUUID(),
      date: task.date,
      repeat: 'none',
      completedDates: (existingTask.completedDates || []).includes(editingOccurrenceDate) ? [task.date] : [],
      excludedDates: [],
      attachmentCount: 0, // 附件跟著 originalSeriesId 那筆存在 IndexedDB，這個新拆出的 id 底下沒有實體附件
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
      touchTask(existingTask);
      const originalCompleted = Array.isArray(existingTask.completedDates) ? existingTask.completedDates : [];
      tasks.push({
        ...task,
        id: crypto.randomUUID(),
        date: splitDate,
        excludedDates: preservedExcludedDates,
        completedDates: originalCompleted.filter((date) => date >= splitDate),
        attachmentCount: 0, // 同上：附件實體仍在原系列 id 底下
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

  // 新增行程（無 existingTask）尚未儲存前的暫存附件，此刻拿到 task.id 才真正寫入 IndexedDB。
  if (!existingTask && pendingAttachments.length && !attachmentsUnavailable) {
    pendingAttachments.forEach((record) => { record.taskId = task.id; });
    Promise.all(pendingAttachments.map((record) => idbPut(record))).catch(() => showToast('附件儲存失敗'));
    task.attachmentCount = pendingAttachments.length;
    pendingAttachments = [];
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
  if (els.batchAddDialog.open) return;
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
      color: null,
      location: '',
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
      updatedAt: Date.now(),
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
    touchTask(task);
  } else if (task) {
    tombstoneTask(task);
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
    attachmentCount: 0, // 複製到明天是新 id，附件本體不會跟著複製
    sortOrder: Date.now(),
    createdAt: new Date().toISOString(),
    updatedAt: Date.now(),
  });
  saveJson(STORAGE_KEY, tasks);
  render();
  showToast(`已複製到 ${copyDate}`);
}

function toggleTaskPinned(id) {
  const task = tasks.find((item) => item.id === id);
  if (!task) return;
  task.pinned = !task.pinned;
  touchTask(task);
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
  const calendarDeleteId = event.target.dataset.deleteCalendar;
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
    const deleteTarget = tasks.find((item) => item.id === deleteId);
    if (deleteTarget) tombstoneTask(deleteTarget);
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
  if (calendarDeleteId) deleteCalendar(calendarDeleteId);

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
  const calendarRenameId = event.target.dataset.renameCalendar;
  const calendarVisibilityId = event.target.dataset.toggleCalendarVisibility;

  if (taskId) {
    const task = tasks.find((item) => item.id === taskId);
    const doneDate = event.target.dataset.doneDate || toDateInput(currentDate);
    // D3 任務依賴：只擋「勾選完成」，取消勾選不受前置任務狀態限制。
    const blockers = task && event.target.checked ? getIncompleteDependencies(task) : [];
    if (blockers.length) {
      event.target.checked = false;
      showToast(`前置任務未完成：${blockers.map((dep) => dep.title).join('、')}`);
    } else if (task) {
      setTaskDone(task, doneDate, event.target.checked);
      if (event.target.checked) playDoneSound();
    }
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

  if (calendarRenameId) renameCalendar(calendarRenameId, event.target.value);

  if (calendarVisibilityId) {
    const visibleSet = new Set(Array.isArray(appSettings.visibleCalendarIds) ? appSettings.visibleCalendarIds : calendars.map((cal) => cal.id));
    if (event.target.checked) visibleSet.add(calendarVisibilityId);
    else visibleSet.delete(calendarVisibilityId);
    appSettings.visibleCalendarIds = Array.from(visibleSet);
    saveJson(APP_SETTINGS_KEY, appSettings);
    render();
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
    touchTask(task);
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
    touchTask(task);
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
    const calendarMatch = isCalendarVisible(task.calendarId);
    return textMatch && categoryMatch && priorityMatch && statusMatch && calendarMatch;
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

