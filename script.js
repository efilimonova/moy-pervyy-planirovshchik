"use strict";

const STORAGE_KEY = "domashnieDelaLegko:v1";
const STORAGE_BACKUP_PREFIX = "domashnieDelaLegko:corrupt:";
const LARGE_STORAGE_WARNING_BYTES = 4 * 1024 * 1024;
const DRAFT_SAVE_DELAY = 500;
const WEEKDAY_NAMES = ["Понедельник", "Вторник", "Среда", "Четверг", "Пятница", "Суббота", "Воскресенье"];
const MONTH_NAMES = ["января", "февраля", "марта", "апреля", "мая", "июня", "июля", "августа", "сентября", "октября", "ноября", "декабря"];
const CATEGORY_COLORS = ["#7E9C8A", "#708BB5", "#BB8E72", "#A27E9E", "#AA9A62", "#6C9E9B", "#B17A81", "#87976B"];

const pageState = { selectedWeekStart: getMonday(new Date()), activeDialog: null, lastDialogTrigger: null, pendingConfirmation: null, confirmReturnDialog: null, pendingOverdueMoveTaskId: null, pendingImportState: null, taskFormBase: null };
const elements = {
  root: document.documentElement,
  main: document.querySelector("#main-content"),
  weekTitle: document.querySelector("[data-week-title]"),
  weekCaption: document.querySelector("[data-week-caption]"),
  weekBoard: document.querySelector("[data-week-board]"),
  themeToggle: document.querySelector("[data-theme-toggle]"),
  themeLabel: document.querySelector("[data-theme-label]"),
  summary: document.querySelector(".daily-summary"),
  summaryCopy: document.querySelector("[data-summary-copy]"),
  overduePanel: document.querySelector("[data-overdue-panel]"),
  overdueList: document.querySelector("[data-overdue-list]"),
  timerValue: document.querySelector("[data-timer-value]"),
  timerStatus: document.querySelector("[data-timer-status]"),
  timerActions: document.querySelector("[data-timer-actions]"),
  markHabitButton: document.querySelector("[data-mark-habit]"),
  statisticsNote: document.querySelector("[data-statistics-note]"),
  statCurrent: document.querySelector("[data-stat-current]"),
  statBest: document.querySelector("[data-stat-best]"),
  statWeek: document.querySelector("[data-stat-week]"),
  statMonth: document.querySelector("[data-stat-month]"),
  backdrop: document.querySelector("[data-dialog-backdrop]"),
  toastRegion: document.querySelector("[data-toast-region]"),
  taskForm: document.querySelector("[data-placeholder-form]"),
  taskDialogTitle: document.querySelector("[data-task-dialog-title]"),
  taskDialogKicker: document.querySelector("[data-task-dialog-kicker]"),
  taskError: document.querySelector("[data-task-form-error]"),
  categoryForm: document.querySelector("[data-category-form]"),
  categoryError: document.querySelector("[data-category-form-error]"),
  categoryList: document.querySelector("[data-category-list]"),
  categorySubmit: document.querySelector("[data-category-submit]"),
  archiveList: document.querySelector("[data-archive-list]"),
  archiveEmpty: document.querySelector("[data-archive-empty]"),
  confirmTitle: document.querySelector("[data-confirm-title]"),
  confirmCopy: document.querySelector("[data-confirm-copy]"),
  confirmAction: document.querySelector("[data-confirm-action]"),
  timerSettingsForm: document.querySelector("[data-timer-settings-form]"),
  timerSettingsError: document.querySelector("[data-timer-settings-error]"),
  customHabitForm: document.querySelector("[data-custom-habit-form]"),
  customHabitError: document.querySelector("[data-custom-habit-error]"),
  customHabitList: document.querySelector("[data-custom-habit-list]"),
  overdueMoveForm: document.querySelector("[data-overdue-move-form]"),
  overdueMoveError: document.querySelector("[data-overdue-move-error]"),
  overdueMoveTaskTitle: document.querySelector("[data-overdue-move-task-title]"),
  draftChoice: document.querySelector("[data-draft-choice]"),
  dataStatus: document.querySelector("[data-data-status]"),
  dataError: document.querySelector("[data-data-error]"),
  importFile: document.querySelector("[data-import-file]"),
  confirmKicker: document.querySelector("[data-confirm-kicker]"),
  confirmAcknowledgement: document.querySelector("[data-confirm-acknowledgement]"),
  confirmAcknowledgementWrap: document.querySelector("[data-confirm-acknowledgement-wrap]")
};

function startOfLocalDay(date) { return new Date(date.getFullYear(), date.getMonth(), date.getDate()); }
function getMonday(date) { const localDate = startOfLocalDay(date); const dayIndex = localDate.getDay(); localDate.setDate(localDate.getDate() + (dayIndex === 0 ? -6 : 1 - dayIndex)); return localDate; }
function toDateInputValue(date) { return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`; }
function fromDateInputValue(value) { const [year, month, day] = value.split("-").map(Number); return new Date(year, month - 1, day); }
function isValidDateValue(value) { if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false; const date = fromDateInputValue(value); return !Number.isNaN(date.getTime()) && toDateInputValue(date) === value; }
function isSameLocalDate(firstDate, secondDate) { return firstDate.getFullYear() === secondDate.getFullYear() && firstDate.getMonth() === secondDate.getMonth() && firstDate.getDate() === secondDate.getDate(); }
function formatDayDate(date) { return `${date.getDate()} ${MONTH_NAMES[date.getMonth()]}`; }
function formatFullDate(value) { const date = fromDateInputValue(value); return `${date.getDate()} ${MONTH_NAMES[date.getMonth()]} ${date.getFullYear()}`; }
function formatWeekRange(weekStart) { const weekEnd = new Date(weekStart.getFullYear(), weekStart.getMonth(), weekStart.getDate() + 6); if (weekStart.getFullYear() === weekEnd.getFullYear() && weekStart.getMonth() === weekEnd.getMonth()) return `${weekStart.getDate()}–${weekEnd.getDate()} ${MONTH_NAMES[weekEnd.getMonth()]} ${weekEnd.getFullYear()}`; if (weekStart.getFullYear() === weekEnd.getFullYear()) return `${weekStart.getDate()} ${MONTH_NAMES[weekStart.getMonth()]} — ${weekEnd.getDate()} ${MONTH_NAMES[weekEnd.getMonth()]} ${weekEnd.getFullYear()}`; return `${weekStart.getDate()} ${MONTH_NAMES[weekStart.getMonth()]} ${weekStart.getFullYear()} — ${weekEnd.getDate()} ${MONTH_NAMES[weekEnd.getMonth()]} ${weekEnd.getFullYear()}`; }
function getSystemTheme() { return window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light"; }
function nowIso() { const date = new Date(); const offsetMinutes = -date.getTimezoneOffset(); const sign = offsetMinutes >= 0 ? "+" : "-"; const absoluteOffset = Math.abs(offsetMinutes); return `${toDateInputValue(date)}T${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}:${String(date.getSeconds()).padStart(2, "0")}${sign}${String(Math.floor(absoluteOffset / 60)).padStart(2, "0")}:${String(absoluteOffset % 60).padStart(2, "0")}`; }
function createId(prefix) { return window.crypto?.randomUUID ? `${prefix}-${window.crypto.randomUUID()}` : `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`; }

function createDefaultCategories() {
  const createdAt = nowIso();
  return [
    { id: "uncategorized", name: "Вне категории", color: "#8A948F", isSystem: true, createdAt },
    { id: "cleaning", name: "Уборка", color: "#7E9C8A", isSystem: false, createdAt },
    { id: "plants", name: "Растения", color: "#708BB5", isSystem: false, createdAt },
    { id: "laundry", name: "Стирка", color: "#BB8E72", isSystem: false, createdAt },
    { id: "shopping", name: "Покупки", color: "#A27E9E", isSystem: false, createdAt },
    { id: "other", name: "Другое", color: "#AA9A62", isSystem: false, createdAt }
  ];
}

function createInitialState() {
  return {
    version: 1,
    settings: { theme: getSystemTheme(), timerDurationMinutes: 15, notificationPromptShown: false },
    categories: createDefaultCategories(),
    tasks: [],
    dailyHabit: { completions: {} },
    timer: { state: "idle", date: toDateInputValue(new Date()), durationSeconds: 900, remainingSeconds: 900, endAt: null, startedAt: null },
    drafts: { taskForm: null },
    customHabits: []
  };
}

function isSupportedState(candidate) {
  return Boolean(candidate && candidate.version === 1 && candidate.settings && typeof candidate.settings === "object" && !Array.isArray(candidate.settings) && Array.isArray(candidate.categories) && Array.isArray(candidate.tasks) && candidate.dailyHabit && typeof candidate.dailyHabit === "object" && !Array.isArray(candidate.dailyHabit) && candidate.timer && typeof candidate.timer === "object" && !Array.isArray(candidate.timer));
}

function normalizeState(candidate) {
  if (!isSupportedState(candidate)) return null;
  candidate.settings = { theme: getSystemTheme(), timerDurationMinutes: 15, notificationPromptShown: false, ...(candidate.settings || {}) };
  candidate.dailyHabit = candidate.dailyHabit || { completions: {} };
  candidate.timer = candidate.timer || { state: "idle", date: toDateInputValue(new Date()), durationSeconds: 900, remainingSeconds: 900, endAt: null, startedAt: null };
  candidate.drafts = candidate.drafts || { taskForm: null };
  candidate.customHabits = Array.isArray(candidate.customHabits) ? candidate.customHabits : [];
  if (!candidate.categories.some((category) => category.id === "uncategorized")) candidate.categories.unshift(createDefaultCategories()[0]);
  return candidate;
}

function showToast(message) {
  const toast = makeElement("div", { className: "toast", text: message, attributes: { role: "status" } });
  elements.toastRegion.append(toast);
  window.setTimeout(() => toast.remove(), 4000);
}

let storageHealth = { hasUnsavedChanges: false, serializedSize: 0 };

function rememberCorruptState(value) {
  try { window.localStorage.setItem(`${STORAGE_BACKUP_PREFIX}${Date.now()}`, value); } catch (error) { /* Не мешаем запуску, если резервная запись невозможна. */ }
}

function loadState() {
  let saved;
  try {
    saved = window.localStorage.getItem(STORAGE_KEY);
  } catch (error) {
    showToast("Не удалось прочитать сохранённые данные. Создан чистый план.");
    return createInitialState();
  }
  if (saved) {
    try {
      const normalized = normalizeState(JSON.parse(saved));
      if (normalized) return normalized;
    } catch (error) { /* Повреждённое значение будет сохранено ниже. */ }
    rememberCorruptState(saved);
    showToast("Сохранённые данные повреждены. Создан чистый план; можно импортировать резервную копию.");
  }
  const initialState = createInitialState();
  try { window.localStorage.setItem(STORAGE_KEY, JSON.stringify(initialState)); } catch (error) { storageHealth.hasUnsavedChanges = true; }
  return initialState;
}

let appState = loadState();
let timerTicker = null;
let audioContext = null;
let taskDraftTimer = null;

function saveState() {
  let serialized;
  try { serialized = JSON.stringify(appState); }
  catch (error) { storageHealth.hasUnsavedChanges = true; showToast("Изменения не удалось подготовить к сохранению."); renderDataStatus(); return false; }
  storageHealth.serializedSize = typeof Blob === "function" ? new Blob([serialized]).size : serialized.length * 2;
  try {
    window.localStorage.setItem(STORAGE_KEY, serialized);
    storageHealth.hasUnsavedChanges = false;
    renderDataStatus();
    return true;
  } catch (error) {
    storageHealth.hasUnsavedChanges = true;
    renderDataStatus();
    showToast("Изменения пока не сохранены в браузере. Сделайте экспорт или очистите историю.");
    return false;
  }
}

function makeElement(tagName, options = {}) {
  const element = document.createElement(tagName);
  if (options.className) element.className = options.className;
  if (options.text !== undefined) element.textContent = options.text;
  if (options.type) element.type = options.type;
  if (options.attributes) Object.entries(options.attributes).forEach(([name, value]) => element.setAttribute(name, value));
  return element;
}

function renderDataStatus() {
  if (!elements.dataStatus) return;
  const size = storageHealth.serializedSize || (() => {
    try { const serialized = JSON.stringify(appState); return typeof Blob === "function" ? new Blob([serialized]).size : serialized.length * 2; } catch (error) { return 0; }
  })();
  storageHealth.serializedSize = size;
  elements.dataStatus.classList.toggle("is-warning", storageHealth.hasUnsavedChanges || size >= LARGE_STORAGE_WARNING_BYTES);
  if (storageHealth.hasUnsavedChanges) elements.dataStatus.textContent = "Есть несохранённые изменения. Экспортируйте данные или очистите историю и попробуйте сохранить снова.";
  else if (size >= LARGE_STORAGE_WARNING_BYTES) elements.dataStatus.textContent = "Данные занимают больше 4 МБ. Сделайте экспорт и при необходимости очистите историю.";
  else elements.dataStatus.textContent = "Данные хранятся только в этом браузере.";
}

function clearDataError() { if (elements.dataError) elements.dataError.textContent = ""; }

function exportData() {
  try {
    const exported = { ...appState, exportedAt: nowIso() };
    const file = new Blob([JSON.stringify(exported, null, 2)], { type: "application/json;charset=utf-8" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(file);
    link.download = `domashnie-dela-legko-${toDateInputValue(new Date())}.json`;
    document.body.append(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(link.href), 0);
    showToast("Резервная копия подготовлена.");
  } catch (error) {
    elements.dataError.textContent = "Не удалось подготовить файл экспорта.";
  }
}

function readImportFile(file) {
  if (!file) return;
  clearDataError();
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const candidate = normalizeState(JSON.parse(String(reader.result)));
      if (!candidate) {
        const parsed = JSON.parse(String(reader.result));
        elements.dataError.textContent = parsed?.version !== 1 ? "Этот файл создан другой версией приложения и пока не поддерживается." : "Файл не содержит нужные данные планировщика.";
        return;
      }
      pageState.pendingImportState = candidate;
      openConfirmation("import", "", elements.importFile);
    } catch (error) {
      elements.dataError.textContent = "Не удалось прочитать JSON-файл. Текущие данные не изменены.";
    }
  };
  reader.onerror = () => { elements.dataError.textContent = "Не удалось прочитать выбранный файл. Текущие данные не изменены."; };
  reader.readAsText(file, "UTF-8");
}

function importState() {
  const importedState = pageState.pendingImportState;
  if (!importedState) return;
  appState = importedState;
  pageState.pendingImportState = null;
  clearTimerTicker();
  saveState();
  dismissAllDialogs();
  renderAll();
  showToast("Данные импортированы.");
}

function cleanupHistory(mode) {
  const cutoff = new Date();
  cutoff.setFullYear(cutoff.getFullYear() - 1);
  const cutoffTime = cutoff.getTime();
  const wasHistorical = (task) => task.status === "deleted" ? new Date(task.deletedAt).getTime() < cutoffTime : task.status === "completed" && new Date(task.completedAt).getTime() < cutoffTime;
  const before = appState.tasks.length;
  appState.tasks = appState.tasks.filter((task) => {
    if (task.status === "deleted") return !wasHistorical(task);
    if (mode === "all-history" && task.status === "completed") return !wasHistorical(task);
    return true;
  });
  const removed = before - appState.tasks.length;
  saveState();
  closeDialog();
  renderAll();
  showToast(removed ? `Очищено записей: ${removed}.` : "Подходящих старых записей не найдено.");
}

function resetAllData() {
  clearTimerTicker();
  try { window.localStorage.removeItem(STORAGE_KEY); } catch (error) { /* Чистое состояние всё равно будет подготовлено в памяти. */ }
  appState = createInitialState();
  storageHealth = { hasUnsavedChanges: false, serializedSize: 0 };
  saveState();
  dismissAllDialogs();
  renderAll();
  showToast("Данные удалены.");
}

function getCategory(categoryId) { return appState.categories.find((category) => category.id === categoryId) || appState.categories.find((category) => category.id === "uncategorized"); }
function getTaskById(taskId) { return appState.tasks.find((task) => task.id === taskId); }
function getNextOrder() { return appState.tasks.reduce((highest, task) => Math.max(highest, Number(task.order) || 0), 0) + 1; }
function getTaskCategoryDisplay(task) { const currentCategory = getCategory(task.categoryId); return task.categoryId === "uncategorized" && task.categoryNameAtCompletion ? { name: `Была категория: ${task.categoryNameAtCompletion}`, color: task.categoryColorAtCompletion || currentCategory.color, historical: true } : { name: currentCategory.name, color: currentCategory.color, historical: false }; }
function getRepeatLabel(repeat) { return ({ daily: "Каждый день", weekly: "Каждую неделю", monthly: "Каждый месяц" })[repeat] || ""; }
function nextRepeatedDate(task) {
  const base = fromDateInputValue(task.date);
  if (task.repeat === "daily") return new Date(base.getFullYear(), base.getMonth(), base.getDate() + 1);
  if (task.repeat === "weekly") return new Date(base.getFullYear(), base.getMonth(), base.getDate() + 7);
  if (task.repeat === "monthly") {
    const anchorDay = task.repeatDay || base.getDate();
    const nextMonthStart = new Date(base.getFullYear(), base.getMonth() + 1, 1);
    const lastDayOfNextMonth = new Date(nextMonthStart.getFullYear(), nextMonthStart.getMonth() + 1, 0).getDate();
    return new Date(nextMonthStart.getFullYear(), nextMonthStart.getMonth(), Math.min(anchorDay, lastDayOfNextMonth));
  }
  return null;
}
function createNextRepeatedTask(task) {
  if (!task.repeat || task.repeat === "none" || task.generatedNextTaskId) return;
  const nextDate = nextRepeatedDate(task);
  if (!nextDate) return;
  const nextTask = {
    id: createId("task"), title: task.title, date: toDateInputValue(nextDate), categoryId: task.categoryId, note: task.note,
    repeat: task.repeat, repeatDay: task.repeatDay || fromDateInputValue(task.date).getDate(), status: "active",
    createdAt: nowIso(), updatedAt: nowIso(), completedAt: null, deletedAt: null,
    categoryNameAtCompletion: null, categoryColorAtCompletion: null, order: getNextOrder(), generatedNextTaskId: null
  };
  task.generatedNextTaskId = nextTask.id;
  appState.tasks.push(nextTask);
}
function getTasksForDate(dateValue) { return appState.tasks.filter((task) => task.date === dateValue && task.status !== "deleted").sort((first, second) => (first.status === "active" ? 0 : 1) - (second.status === "active" ? 0 : 1) || first.order - second.order); }
function getOverdueTasks() { const today = toDateInputValue(new Date()); return appState.tasks.filter((task) => task.status === "active" && task.date < today).sort((first, second) => first.date.localeCompare(second.date) || first.order - second.order); }

function setTheme(theme, persist = true) {
  const isDark = theme === "dark";
  elements.root.dataset.theme = isDark ? "dark" : "light";
  elements.themeToggle.setAttribute("aria-pressed", String(isDark));
  elements.themeToggle.setAttribute("aria-label", isDark ? "Включить светлую тему" : "Включить тёмную тему");
  elements.themeLabel.textContent = isDark ? "Светлая тема" : "Тёмная тема";
  if (persist) { appState.settings.theme = isDark ? "dark" : "light"; saveState(); }
}

function getTimerDurationSeconds() {
  return Number(appState.settings.timerDurationMinutes) * 60;
}

function getHabitCompletion(dateValue) {
  return appState.dailyHabit.completions[dateValue] || null;
}

function isHabitCompleted(dateValue) {
  return Boolean(getHabitCompletion(dateValue));
}

function clearTimerTicker() {
  if (timerTicker) window.clearInterval(timerTicker);
  timerTicker = null;
}

function resetTimer(persist = true) {
  clearTimerTicker();
  appState.timer = {
    state: "idle",
    date: toDateInputValue(new Date()),
    durationSeconds: getTimerDurationSeconds(),
    remainingSeconds: getTimerDurationSeconds(),
    endAt: null,
    startedAt: null
  };
  if (persist) saveState();
}

function ensureAudioContext() {
  const AudioContextConstructor = window.AudioContext || window.webkitAudioContext;
  if (!AudioContextConstructor) return null;
  if (!audioContext) audioContext = new AudioContextConstructor();
  if (audioContext.state === "suspended") audioContext.resume().catch(() => {});
  return audioContext;
}

function playCompletionSound() {
  const context = ensureAudioContext();
  if (!context) return;
  try {
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.type = "sine";
    oscillator.frequency.setValueAtTime(660, context.currentTime);
    gain.gain.setValueAtTime(0.0001, context.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.32, context.currentTime + 0.04);
    gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + 2.2);
    oscillator.connect(gain);
    gain.connect(context.destination);
    oscillator.start();
    oscillator.stop(context.currentTime + 2.3);
  } catch (error) {
    // Аудио — необязательное дополнение; отсутствие поддержки не мешает привычке.
  }
}

function requestNotificationPermission() {
  if (!("Notification" in window) || appState.settings.notificationPromptShown || Notification.permission !== "default") return;
  appState.settings.notificationPromptShown = true;
  saveState();
  Notification.requestPermission().catch(() => {});
}

function showCompletionNotification(durationMinutes) {
  if (!("Notification" in window) || Notification.permission !== "granted") return;
  try {
    new Notification("Домашние дела легко", { body: `Время вышло — ${durationMinutes} минут для дома выполнены!` });
  } catch (error) {
    // Системные уведомления могут быть недоступны для локальной страницы.
  }
}

function completeHabit(dateValue, source) {
  if (isHabitCompleted(dateValue)) return true;
  appState.dailyHabit.completions[dateValue] = { completedAt: nowIso(), source };
  return false;
}

function markHabitManually(dateValue, completed) {
  if (completed) {
    completeHabit(dateValue, "manual");
    if (appState.timer.date === dateValue && ["running", "paused"].includes(appState.timer.state)) resetTimer(false);
    showToast("Привычка отмечена выполненной.");
  } else {
    delete appState.dailyHabit.completions[dateValue];
    if (appState.timer.date === dateValue && appState.timer.state === "finished") resetTimer(false);
    showToast("Отметка привычки снята.");
  }
  saveState();
  renderAll();
}

function formatRemainingTime(seconds) {
  const safeSeconds = Math.max(0, Math.ceil(seconds));
  return `${String(Math.floor(safeSeconds / 60)).padStart(2, "0")}:${String(safeSeconds % 60).padStart(2, "0")}`;
}

function getTodayHabitCardText() {
  const timer = appState.timer;
  if (timer.state === "running") return `15 минут для дома · осталось ${formatRemainingTime(getRemainingSeconds())}`;
  if (timer.state === "paused") return `15 минут для дома · пауза ${formatRemainingTime(timer.remainingSeconds)}`;
  if (timer.state === "finished") return "15 минут для дома · выполнено — запустить ещё раз";
  if (isHabitCompleted(toDateInputValue(new Date()))) return "15 минут для дома · выполнено — запустить ещё раз";
  return "15 минут для дома · начать таймер";
}

function updateTodayHabitCard() {
  const timerButton = document.querySelector("[data-today-timer-card]");
  if (!timerButton) return;
  timerButton.textContent = getTodayHabitCardText();
  timerButton.classList.toggle("is-completed", isHabitCompleted(toDateInputValue(new Date())));
}

function getRemainingSeconds() {
  if (appState.timer.state !== "running" || !appState.timer.endAt) return appState.timer.remainingSeconds;
  return Math.max(0, Math.ceil((new Date(appState.timer.endAt).getTime() - Date.now()) / 1000));
}

function finishTimer(notify = true) {
  clearTimerTicker();
  const finishedDate = appState.timer.date;
  const durationMinutes = Math.round(appState.timer.durationSeconds / 60);
  const wasCompleted = completeHabit(finishedDate, "timer");
  appState.timer.state = "finished";
  appState.timer.remainingSeconds = 0;
  appState.timer.endAt = null;
  saveState();
  renderAll();
  if (notify) {
    playCompletionSound();
    showCompletionNotification(durationMinutes);
    showToast(wasCompleted ? "Таймер завершён. Привычка уже была отмечена сегодня." : "Время вышло — привычка выполнена!");
  }
}

function tickTimer() {
  const remainingSeconds = getRemainingSeconds();
  appState.timer.remainingSeconds = remainingSeconds;
  if (remainingSeconds <= 0) {
    finishTimer(true);
    return;
  }
  renderHabitPanel();
}

function startTimerTicker() {
  clearTimerTicker();
  timerTicker = window.setInterval(tickTimer, 500);
}

function startTimer() {
  const today = toDateInputValue(new Date());
  if (appState.timer.state === "paused") return resumeTimer();
  ensureAudioContext();
  requestNotificationPermission();
  appState.timer = {
    state: "running",
    date: today,
    durationSeconds: getTimerDurationSeconds(),
    remainingSeconds: getTimerDurationSeconds(),
    endAt: new Date(Date.now() + getTimerDurationSeconds() * 1000).toISOString(),
    startedAt: nowIso()
  };
  saveState();
  startTimerTicker();
  renderHabitPanel();
}

function pauseTimer() {
  const remainingSeconds = getRemainingSeconds();
  if (remainingSeconds <= 0) return finishTimer(true);
  clearTimerTicker();
  appState.timer.state = "paused";
  appState.timer.remainingSeconds = remainingSeconds;
  appState.timer.endAt = null;
  saveState();
  renderHabitPanel();
}

function resumeTimer() {
  const remainingSeconds = Math.max(1, appState.timer.remainingSeconds);
  ensureAudioContext();
  appState.timer.state = "running";
  appState.timer.endAt = new Date(Date.now() + remainingSeconds * 1000).toISOString();
  saveState();
  startTimerTicker();
  renderHabitPanel();
}

function reconcileTimerOnLoad() {
  const today = toDateInputValue(new Date());
  if (appState.timer.state === "running") {
    const remainingSeconds = getRemainingSeconds();
    if (remainingSeconds <= 0) {
      finishTimer(false);
    } else {
      appState.timer.remainingSeconds = remainingSeconds;
      startTimerTicker();
    }
  }
  if (["idle", "finished", "paused"].includes(appState.timer.state) && appState.timer.date !== today) resetTimer(false);
  saveState();
}

function createTimerAction(text, action, style = "button-primary") {
  const button = makeElement("button", { className: `button ${style}`, type: "button", text });
  button.dataset.timerAction = action;
  return button;
}

function renderHabitPanel() {
  const timer = appState.timer;
  const today = toDateInputValue(new Date());
  const remainingSeconds = getRemainingSeconds();
  elements.timerValue.textContent = formatRemainingTime(remainingSeconds);
  updateTodayHabitCard();
  elements.timerActions.replaceChildren();
  elements.markHabitButton.textContent = isHabitCompleted(today) ? "Снять отметку" : "Отметить вручную";
  if (timer.state === "running") {
    elements.timerStatus.textContent = "Таймер идёт. Спокойно займитесь тем, что сейчас важнее всего.";
    elements.timerActions.append(createTimerAction("Пауза", "pause", "button-secondary"), createTimerAction("Сбросить", "reset", "button-secondary"));
  } else if (timer.state === "paused") {
    elements.timerStatus.textContent = "Таймер на паузе. Можно продолжить, когда будете готовы.";
    elements.timerActions.append(createTimerAction("Продолжить", "resume"), createTimerAction("Сбросить", "reset", "button-secondary"));
  } else if (timer.state === "finished" && timer.date === today) {
    elements.timerStatus.textContent = "Готово! Сегодняшние минуты для дома уже сделаны.";
    elements.timerActions.append(createTimerAction("Запустить ещё раз", "restart", "button-secondary"));
  } else {
    elements.timerStatus.textContent = `Начните с малого — ${appState.settings.timerDurationMinutes} минут для дома.`;
    elements.timerActions.append(createTimerAction("Начать", "start"));
  }
}

function getHabitStatistics() {
  const completedDates = Object.keys(appState.dailyHabit.completions).sort();
  const completedSet = new Set(completedDates);
  const today = startOfLocalDay(new Date());
  const todayValue = toDateInputValue(today);
  let streakCursor = completedSet.has(todayValue) ? today : new Date(today.getFullYear(), today.getMonth(), today.getDate() - 1);
  let currentStreak = 0;
  while (completedSet.has(toDateInputValue(streakCursor))) {
    currentStreak += 1;
    streakCursor = new Date(streakCursor.getFullYear(), streakCursor.getMonth(), streakCursor.getDate() - 1);
  }
  let bestStreak = 0;
  let runningStreak = 0;
  completedDates.forEach((dateValue, index) => {
    if (index === 0) runningStreak = 1;
    else {
      const previous = fromDateInputValue(completedDates[index - 1]);
      const current = fromDateInputValue(dateValue);
      runningStreak = current.getTime() - previous.getTime() === 86400000 ? runningStreak + 1 : 1;
    }
    bestStreak = Math.max(bestStreak, runningStreak);
  });
  const weekStart = getMonday(today);
  const weekCount = completedDates.filter((dateValue) => dateValue >= toDateInputValue(weekStart) && dateValue <= todayValue).length;
  const monthStart = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-01`;
  const monthCount = completedDates.filter((dateValue) => dateValue >= monthStart && dateValue <= todayValue).length;
  return { currentStreak, bestStreak, weekCount, monthCount, hasCompletions: completedDates.length > 0 };
}

function renderHabitStatistics() {
  const statistics = getHabitStatistics();
  elements.statCurrent.textContent = `${statistics.currentStreak} ${statistics.currentStreak === 1 ? "день" : "дней"}`;
  elements.statBest.textContent = `${statistics.bestStreak} ${statistics.bestStreak === 1 ? "день" : "дней"}`;
  elements.statWeek.textContent = `${statistics.weekCount} из 7`;
  elements.statMonth.textContent = `${statistics.monthCount} ${statistics.monthCount === 1 ? "день" : "дней"}`;
  elements.statisticsNote.textContent = statistics.hasCompletions ? "Каждая отметка делает привычку заметнее" : "Появится после первых отметок";
}

function isCustomHabitCompleted(habit, dateValue) {
  return Boolean(habit.completions?.[dateValue]);
}

function markCustomHabit(habit, dateValue, completed) {
  habit.completions = habit.completions || {};
  if (completed) habit.completions[dateValue] = { completedAt: nowIso() };
  else delete habit.completions[dateValue];
  saveState();
  renderAll();
}

function renderCustomHabitList() {
  elements.customHabitList.replaceChildren();
  appState.customHabits.forEach((habit) => {
    const item = makeElement("article", { className: "custom-habit-item" });
    const removeButton = makeElement("button", { type: "button", text: "Удалить" });
    removeButton.dataset.removeCustomHabit = habit.id;
    item.append(makeElement("h3", { text: habit.title }), removeButton);
    elements.customHabitList.append(item);
  });
}

function makeTaskIconButton(action, taskId) {
  const icons = {
    restore: { symbol: "↺", label: "Вернуть в планы" },
    edit: { symbol: "✎", label: "Редактировать" },
    copy: { symbol: "⧉", label: "Скопировать задачу" },
    tomorrow: { symbol: "☀", label: "Перенести на завтра" },
    "next-week": { symbol: "⇢", label: "Перенести через неделю" },
    delete: { symbol: "⌫", label: "Удалить" }
  };
  const icon = icons[action];
  const button = makeElement("button", {
    className: "task-icon-button",
    type: "button",
    text: icon.symbol,
    attributes: { "aria-label": icon.label, title: icon.label }
  });
  button.dataset.taskAction = action;
  button.dataset.taskId = taskId;
  return button;
}

function makeOverdueIconButton(action, taskId) {
  const icons = {
    move: { symbol: "↪", label: "Перенести задачу" },
    complete: { symbol: "✓", label: "Завершить задачу" },
    delete: { symbol: "⌫", label: "Удалить задачу" }
  };
  const icon = icons[action];
  const button = makeElement("button", {
    className: `overdue-icon-button${action === "delete" ? " is-delete" : ""}`,
    type: "button",
    text: icon.symbol,
    attributes: { "aria-label": icon.label, title: icon.label }
  });
  button.dataset.overdueAction = action;
  button.dataset.taskId = taskId;
  return button;
}

function renderTaskCard(task) {
  const category = getTaskCategoryDisplay(task);
  const card = makeElement("article", { className: `task-card${task.status === "completed" ? " is-completed" : ""}` });
  const top = makeElement("div", { className: "task-card-top" });
  const checkbox = makeElement("input", { type: "checkbox", attributes: { "aria-label": `${task.status === "completed" ? "Вернуть в планы" : "Отметить выполненной"}: ${task.title}` } });
  checkbox.checked = task.status === "completed";
  checkbox.dataset.taskToggle = task.id;
  top.append(checkbox, makeElement("h4", { className: "task-title", text: task.title }));
  const categoryLine = makeElement("p", { className: category.historical ? "historical-category" : "task-category" });
  const dot = makeElement("span", { className: "category-dot", attributes: { "aria-hidden": "true" } });
  dot.style.setProperty("--category-color", category.color);
  categoryLine.append(dot, document.createTextNode(category.name));
  card.append(top, categoryLine);
  if (task.repeat && task.repeat !== "none") card.append(makeElement("span", { className: "task-repeat", text: getRepeatLabel(task.repeat) }));
  if (task.note) card.append(makeElement("p", { className: "task-note", text: task.note }));
  const actions = makeElement("div", { className: "task-actions", attributes: { "aria-label": `Действия с задачей: ${task.title}` } });
  if (task.status === "completed") actions.append(makeTaskIconButton("restore", task.id));
  actions.append(makeTaskIconButton("edit", task.id), makeTaskIconButton("copy", task.id), makeTaskIconButton("tomorrow", task.id), makeTaskIconButton("next-week", task.id), makeTaskIconButton("delete", task.id));
  card.append(actions);
  return card;
}

function renderWeek() {
  const today = startOfLocalDay(new Date());
  elements.weekTitle.textContent = formatWeekRange(pageState.selectedWeekStart);
  elements.weekCaption.textContent = "Выберите спокойный темп — маленькие дела тоже имеют значение.";
  elements.weekBoard.replaceChildren();
  WEEKDAY_NAMES.forEach((weekdayName, index) => {
    const date = new Date(pageState.selectedWeekStart.getFullYear(), pageState.selectedWeekStart.getMonth(), pageState.selectedWeekStart.getDate() + index);
    const dateValue = toDateInputValue(date);
    const dayCard = makeElement("article", { className: `day-card${isSameLocalDate(date, today) ? " is-today" : ""}` });
    if (isSameLocalDate(date, today)) dayCard.append(makeElement("span", { className: "today-badge", text: "Сегодня" }));
    dayCard.append(makeElement("h3", { text: weekdayName }), makeElement("p", { className: "day-date", text: formatDayDate(date) }));
    const habitIsCompleted = isHabitCompleted(dateValue);
    if (isSameLocalDate(date, today)) {
      const timerButton = makeElement("button", { className: `daily-habit-mini${habitIsCompleted ? " is-completed" : ""}`, type: "button", text: getTodayHabitCardText() });
      timerButton.dataset.startTodayTimer = "true";
      timerButton.dataset.todayTimerCard = "true";
      timerButton.setAttribute("aria-label", habitIsCompleted ? "Запустить таймер ещё раз для привычки «15 минут для дома»" : "Начать таймер привычки «15 минут для дома»");
      dayCard.append(timerButton);
    } else {
      const habitLabel = makeElement("label", { className: `daily-habit-mini${habitIsCompleted ? " is-completed" : ""}` });
      const habitCheckbox = makeElement("input", { type: "checkbox", attributes: { "aria-label": `Отметить привычку «15 минут для дома» за ${formatFullDate(dateValue)}` } });
      habitCheckbox.checked = habitIsCompleted;
      habitCheckbox.dataset.habitDate = dateValue;
      habitLabel.append(habitCheckbox, makeElement("span", { text: "15 минут для дома" }));
      dayCard.append(habitLabel);
    }
    appState.customHabits.filter((habit) => habit.startDate <= dateValue).forEach((habit) => {
      const customHabitLabel = makeElement("label", { className: `daily-habit-mini${isCustomHabitCompleted(habit, dateValue) ? " is-completed" : ""}` });
      const customHabitCheckbox = makeElement("input", { type: "checkbox", attributes: { "aria-label": `Отметить привычку «${habit.title}» за ${formatFullDate(dateValue)}` } });
      customHabitCheckbox.checked = isCustomHabitCompleted(habit, dateValue);
      customHabitCheckbox.dataset.customHabitId = habit.id;
      customHabitCheckbox.dataset.customHabitDate = dateValue;
      customHabitLabel.append(customHabitCheckbox, makeElement("span", { text: habit.title }));
      dayCard.append(customHabitLabel);
    });
    const tasks = getTasksForDate(dateValue);
    if (tasks.length) { const taskList = makeElement("div", { className: "task-list" }); tasks.forEach((task) => taskList.append(renderTaskCard(task))); dayCard.append(taskList); }
    else dayCard.append(makeElement("p", { className: "empty-day", text: "На этот день пока ничего не запланировано" }));
    const addButton = makeElement("button", { className: "button button-secondary", text: "Добавить задачу", type: "button" });
    addButton.dataset.openDialog = "task-dialog";
    addButton.dataset.taskDate = dateValue;
    dayCard.append(addButton);
    elements.weekBoard.append(dayCard);
  });
}

function renderSummary() {
  const today = toDateInputValue(new Date());
  const todayTasks = getTasksForDate(today);
  const completed = todayTasks.filter((task) => task.status === "completed").length;
  const overdueCount = getOverdueTasks().length;
  if (!todayTasks.length) elements.summaryCopy.textContent = overdueCount ? `На сегодня пока ничего не запланировано. Есть просроченные дела: ${overdueCount}.` : "На этот день пока ничего не запланировано. Начните с малого, когда будете готовы.";
  else if (completed === todayTasks.length) elements.summaryCopy.textContent = overdueCount ? `Отлично, на сегодня всё готово. Ещё есть просроченные дела: ${overdueCount}.` : "Отлично, на сегодня всё готово.";
  else elements.summaryCopy.textContent = `Сегодня задач: ${todayTasks.length}, выполнено: ${completed}.${overdueCount ? ` Просроченных: ${overdueCount}.` : ""}`;
}

function renderOverdue() {
  const overdueTasks = getOverdueTasks();
  elements.overduePanel.hidden = overdueTasks.length === 0;
  elements.overdueList.replaceChildren();
  overdueTasks.forEach((task) => {
    const category = getTaskCategoryDisplay(task);
    const item = makeElement("article", { className: "overdue-item" });
    const copy = makeElement("div");
    copy.append(makeElement("h3", { text: task.title }), makeElement("p", { text: `${formatFullDate(task.date)} · ${category.name}` }));
    const actions = makeElement("div", { className: "inline-actions", attributes: { "aria-label": `Действия с просроченной задачей: ${task.title}` } });
    actions.append(makeOverdueIconButton("move", task.id), makeOverdueIconButton("complete", task.id), makeOverdueIconButton("delete", task.id));
    item.append(copy, actions);
    elements.overdueList.append(item);
  });
}

function renderTaskCategoryOptions(selectedCategoryId) {
  const select = elements.taskForm.elements.category;
  select.replaceChildren();
  appState.categories.forEach((category) => { const option = makeElement("option", { text: category.name }); option.value = category.id; option.selected = category.id === selectedCategoryId; select.append(option); });
}

function renderCategoryColorOptions(selectedColor) {
  const select = elements.categoryForm.elements["category-color"];
  select.replaceChildren();
  CATEGORY_COLORS.forEach((color) => {
    const option = makeElement("option", { text: color });
    option.value = color;
    option.selected = color === selectedColor;
    select.append(option);
  });
}

function renderCategories() {
  elements.categoryList.replaceChildren();
  appState.categories.forEach((category) => {
    const item = makeElement("article", { className: "category-item" });
    const titleWrap = makeElement("div", { className: "category-item-title" });
    const dot = makeElement("span", { className: "category-dot", attributes: { "aria-hidden": "true" } });
    dot.style.setProperty("--category-color", category.color);
    titleWrap.append(dot, makeElement("h3", { text: category.name }));
    const actions = makeElement("div", { className: "category-item-actions" });
    if (category.isSystem) actions.append(makeElement("span", { className: "section-note", text: "Системная" }));
    else {
      const editButton = makeElement("button", { type: "button", text: "Изменить" }); editButton.dataset.categoryAction = "edit"; editButton.dataset.categoryId = category.id;
      const deleteButton = makeElement("button", { type: "button", text: "Удалить" }); deleteButton.dataset.categoryAction = "delete"; deleteButton.dataset.categoryId = category.id;
      actions.append(editButton, deleteButton);
    }
    item.append(titleWrap, actions);
    elements.categoryList.append(item);
  });
}

function renderArchive() {
  const deletedTasks = appState.tasks.filter((task) => task.status === "deleted").sort((first, second) => String(second.deletedAt).localeCompare(String(first.deletedAt)));
  elements.archiveList.replaceChildren();
  elements.archiveEmpty.hidden = deletedTasks.length > 0;
  deletedTasks.forEach((task) => {
    const category = getTaskCategoryDisplay(task);
    const item = makeElement("article", { className: "archive-item" });
    const copy = makeElement("div");
    copy.append(makeElement("h3", { text: task.title }), makeElement("p", { text: `Планировалось: ${formatFullDate(task.date)} · ${category.name}` }));
    if (task.note) copy.append(makeElement("p", { text: task.note }));
    const actions = makeElement("div", { className: "archive-item-actions" });
    const restoreButton = makeElement("button", { type: "button", text: "Восстановить в план" }); restoreButton.dataset.archiveRestore = task.id;
    actions.append(restoreButton);
    item.append(copy, actions);
    elements.archiveList.append(item);
  });
}

function renderAll() { renderWeek(); renderSummary(); renderOverdue(); renderHabitPanel(); renderHabitStatistics(); renderCustomHabitList(); renderCategories(); renderArchive(); }

function resetTaskForm() {
  elements.taskForm.reset();
  elements.taskForm.elements["task-id"].value = "";
  elements.taskForm.elements.date.value = toDateInputValue(new Date());
  elements.taskForm.elements.repeat.value = "none";
  renderTaskCategoryOptions("uncategorized");
  elements.taskDialogKicker.textContent = "Новое дело";
  elements.taskDialogTitle.textContent = "Добавить задачу";
  elements.taskError.textContent = "";
  elements.draftChoice.hidden = true;
}

function populateTaskForm(task, dateValue) {
  pageState.taskFormBase = { taskId: task?.id || null, dateValue: task?.date || dateValue || toDateInputValue(new Date()) };
  if (!task) { resetTaskForm(); elements.taskForm.elements.date.value = pageState.taskFormBase.dateValue; return; }
  elements.taskForm.elements["task-id"].value = task.id;
  elements.taskForm.elements.title.value = task.title;
  elements.taskForm.elements.date.value = task.date;
  elements.taskForm.elements.repeat.value = task.repeat || "none";
  elements.taskForm.elements.note.value = task.note;
  renderTaskCategoryOptions(task.categoryId);
  elements.taskDialogKicker.textContent = "Ваше дело";
  elements.taskDialogTitle.textContent = "Редактировать задачу";
  elements.taskError.textContent = "";
  elements.draftChoice.hidden = true;
}

function getTaskDraftMode() { return elements.taskForm.elements["task-id"].value ? "edit" : "create"; }

function getMatchingTaskDraft() {
  const draft = appState.drafts?.taskForm;
  if (!draft) return null;
  const taskId = elements.taskForm.elements["task-id"].value || null;
  return draft.mode === getTaskDraftMode() && (draft.mode === "create" || draft.taskId === taskId) ? draft : null;
}

function makeTaskFormDraft() {
  return {
    mode: getTaskDraftMode(),
    taskId: elements.taskForm.elements["task-id"].value || null,
    title: elements.taskForm.elements.title.value,
    date: elements.taskForm.elements.date.value,
    categoryId: elements.taskForm.elements.category.value,
    repeat: elements.taskForm.elements.repeat.value,
    note: elements.taskForm.elements.note.value,
    updatedAt: nowIso()
  };
}

function saveTaskDraftNow() {
  if (!pageState.activeDialog || pageState.activeDialog.dataset.dialog !== "task-dialog") return;
  if (taskDraftTimer) window.clearTimeout(taskDraftTimer);
  taskDraftTimer = null;
  appState.drafts.taskForm = makeTaskFormDraft();
  saveState();
}

function queueTaskDraftSave() {
  if (!pageState.activeDialog || pageState.activeDialog.dataset.dialog !== "task-dialog") return;
  if (taskDraftTimer) window.clearTimeout(taskDraftTimer);
  taskDraftTimer = window.setTimeout(saveTaskDraftNow, DRAFT_SAVE_DELAY);
}

function clearTaskDraft(persist = true) {
  if (taskDraftTimer) window.clearTimeout(taskDraftTimer);
  taskDraftTimer = null;
  if (appState.drafts) appState.drafts.taskForm = null;
  elements.draftChoice.hidden = true;
  if (persist) saveState();
}

function offerTaskDraft() { elements.draftChoice.hidden = !getMatchingTaskDraft(); }

function restoreTaskDraft() {
  const draft = getMatchingTaskDraft();
  if (!draft) return;
  elements.taskForm.elements.title.value = draft.title || "";
  elements.taskForm.elements.date.value = isValidDateValue(draft.date) ? draft.date : pageState.taskFormBase.dateValue;
  elements.taskForm.elements.repeat.value = ["none", "daily", "weekly", "monthly"].includes(draft.repeat) ? draft.repeat : "none";
  elements.taskForm.elements.note.value = draft.note || "";
  renderTaskCategoryOptions(appState.categories.some((category) => category.id === draft.categoryId) ? draft.categoryId : "uncategorized");
  elements.draftChoice.hidden = true;
  elements.taskForm.elements.title.focus();
}

function discardTaskDraft() {
  clearTaskDraft();
  const task = pageState.taskFormBase.taskId ? getTaskById(pageState.taskFormBase.taskId) : null;
  populateTaskForm(task, pageState.taskFormBase.dateValue);
}

function cancelTaskForm() { clearTaskDraft(); closeDialog({ saveTaskDraft: false }); }

function resetCategoryForm() {
  elements.categoryForm.reset();
  elements.categoryForm.elements["category-id"].value = "";
  renderCategoryColorOptions(CATEGORY_COLORS[0]);
  elements.categorySubmit.textContent = "Добавить категорию";
  elements.categoryError.textContent = "";
}

function populateCategoryForm(category) {
  elements.categoryForm.elements["category-id"].value = category.id;
  elements.categoryForm.elements["category-name"].value = category.name;
  renderCategoryColorOptions(category.color);
  elements.categorySubmit.textContent = "Сохранить изменения";
  elements.categoryError.textContent = "";
  elements.categoryForm.elements["category-name"].focus();
}

function openDialog(dialogName, trigger) {
  const dialog = document.querySelector(`[data-dialog="${dialogName}"]`);
  if (!dialog) return;
  const previousDialog = pageState.activeDialog;
  if (previousDialog && previousDialog !== dialog) previousDialog.hidden = true;
  pageState.activeDialog = dialog;
  pageState.lastDialogTrigger = previousDialog && previousDialog !== dialog ? pageState.lastDialogTrigger : (trigger || pageState.lastDialogTrigger);
  elements.backdrop.hidden = false;
  dialog.hidden = false;
  document.body.classList.add("dialog-open");
  if (dialogName === "task-dialog") { populateTaskForm(null, trigger?.dataset.taskDate); offerTaskDraft(); }
  if (dialogName === "categories-dialog") { resetCategoryForm(); renderCategories(); }
  if (dialogName === "archive-dialog") renderArchive();
  if (dialogName === "data-dialog") { clearDataError(); renderDataStatus(); }
  if (dialogName === "custom-habit-dialog") {
    elements.customHabitForm.reset();
    elements.customHabitError.textContent = "";
    renderCustomHabitList();
  }
  if (dialogName === "timer-settings-dialog") {
    elements.timerSettingsForm.elements["timer-duration"].value = appState.settings.timerDurationMinutes;
    elements.timerSettingsError.textContent = "";
  }
  const heading = dialog.querySelector("h2[tabindex='-1']");
  const firstInput = dialog.querySelector("input:not([type='hidden']), select, textarea, button");
  (firstInput || heading)?.focus();
}

function openTaskEditor(task, trigger) {
  const dialog = document.querySelector("[data-dialog='task-dialog']");
  pageState.activeDialog = dialog;
  pageState.lastDialogTrigger = trigger;
  elements.backdrop.hidden = false;
  dialog.hidden = false;
  document.body.classList.add("dialog-open");
  populateTaskForm(task);
  offerTaskDraft();
  dialog.querySelector("input[name='title']")?.focus();
}

function openManagementSection(dialogName) {
  const managementTrigger = pageState.lastDialogTrigger;
  closeDialog();
  openDialog(dialogName, managementTrigger);
}

function openOverdueMoveDialog(task, trigger) {
  const dialog = document.querySelector("[data-dialog='overdue-move-dialog']");
  if (!dialog) return;
  pageState.activeDialog = dialog;
  pageState.lastDialogTrigger = trigger;
  pageState.pendingOverdueMoveTaskId = task.id;
  elements.overdueMoveTaskTitle.textContent = `«${task.title}»`;
  elements.overdueMoveForm.elements["overdue-move-date"].value = toDateInputValue(new Date());
  elements.overdueMoveError.textContent = "";
  elements.backdrop.hidden = false;
  dialog.hidden = false;
  document.body.classList.add("dialog-open");
  dialog.querySelector("[data-overdue-move-today]")?.focus();
}

function applyOverdueMove(dateValue) {
  const task = getTaskById(pageState.pendingOverdueMoveTaskId);
  if (!task || task.status !== "active") {
    elements.overdueMoveError.textContent = "Эта задача больше недоступна для переноса.";
    return;
  }
  task.date = dateValue;
  task.updatedAt = nowIso();
  saveState();
  closeDialog();
  renderAll();
  showToast("Задача перенесена.");
}

function dismissAllDialogs() {
  const focusTarget = pageState.lastDialogTrigger;
  pageState.activeDialog?.setAttribute("hidden", "");
  pageState.confirmReturnDialog?.setAttribute("hidden", "");
  elements.backdrop.hidden = true;
  document.body.classList.remove("dialog-open");
  pageState.activeDialog = null;
  pageState.lastDialogTrigger = null;
  pageState.pendingConfirmation = null;
  pageState.confirmReturnDialog = null;
  pageState.pendingOverdueMoveTaskId = null;
  pageState.pendingImportState = null;
  focusTarget?.focus();
}

function closeDialog(options = {}) {
  if (!pageState.activeDialog) return;
  if (pageState.activeDialog.dataset.dialog === "task-dialog" && options.saveTaskDraft !== false) saveTaskDraftNow();
  if (pageState.activeDialog.dataset.dialog === "confirm-dialog" && pageState.confirmReturnDialog) {
    if (pageState.pendingConfirmation?.type === "import") pageState.pendingImportState = null;
    pageState.activeDialog.hidden = true;
    pageState.activeDialog = pageState.confirmReturnDialog;
    pageState.confirmReturnDialog = null;
    pageState.activeDialog.hidden = false;
    pageState.pendingConfirmation = null;
    pageState.lastDialogTrigger?.focus();
    return;
  }
  pageState.activeDialog.hidden = true;
  elements.backdrop.hidden = true;
  document.body.classList.remove("dialog-open");
  const focusTarget = pageState.lastDialogTrigger;
  pageState.activeDialog = null;
  pageState.lastDialogTrigger = null;
  pageState.pendingConfirmation = null;
  pageState.confirmReturnDialog = null;
  pageState.pendingOverdueMoveTaskId = null;
  pageState.pendingImportState = null;
  focusTarget?.focus();
}

function trapDialogFocus(event) {
  if (!pageState.activeDialog || event.key !== "Tab") return;
  const focusable = [...pageState.activeDialog.querySelectorAll("button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex='-1'])")].filter((element) => !element.hidden && element.offsetParent !== null);
  if (!focusable.length) return;
  const firstElement = focusable[0]; const lastElement = focusable[focusable.length - 1];
  if (event.shiftKey && document.activeElement === firstElement) { event.preventDefault(); lastElement.focus(); }
  else if (!event.shiftKey && document.activeElement === lastElement) { event.preventDefault(); firstElement.focus(); }
}

function handleWeekAction(action) {
  if (action === "previous") pageState.selectedWeekStart.setDate(pageState.selectedWeekStart.getDate() - 7);
  if (action === "next") pageState.selectedWeekStart.setDate(pageState.selectedWeekStart.getDate() + 7);
  if (action === "today") { pageState.selectedWeekStart = getMonday(new Date()); elements.main.scrollIntoView({ behavior: "smooth", block: "start" }); }
  renderWeek();
}

function saveTaskFromForm() {
  const taskId = elements.taskForm.elements["task-id"].value;
  const title = elements.taskForm.elements.title.value.trim();
  const date = elements.taskForm.elements.date.value;
  const categoryId = elements.taskForm.elements.category.value;
  const repeat = elements.taskForm.elements.repeat.value;
  const note = elements.taskForm.elements.note.value;
  if (!title || title.length > 120) { elements.taskError.textContent = "Введите название задачи от 1 до 120 символов."; return; }
  if (!isValidDateValue(date)) { elements.taskError.textContent = "Выберите корректную дату."; return; }
  if (note.length > 1000) { elements.taskError.textContent = "Заметка не может быть длиннее 1 000 символов."; return; }
  const safeCategoryId = appState.categories.some((category) => category.id === categoryId) ? categoryId : "uncategorized";
  if (taskId) {
    const task = getTaskById(taskId);
    if (!task || task.status === "deleted") { elements.taskError.textContent = "Эта задача больше недоступна для редактирования."; return; }
    Object.assign(task, { title, date, categoryId: safeCategoryId, note, repeat, repeatDay: repeat === "monthly" ? (task.repeatDay || fromDateInputValue(date).getDate()) : null, updatedAt: nowIso() });
    showToast("Задача обновлена.");
  } else {
    appState.tasks.push({ id: createId("task"), title, date, categoryId: safeCategoryId, note, repeat, repeatDay: repeat === "monthly" ? fromDateInputValue(date).getDate() : null, status: "active", createdAt: nowIso(), updatedAt: nowIso(), completedAt: null, deletedAt: null, categoryNameAtCompletion: null, categoryColorAtCompletion: null, order: getNextOrder(), generatedNextTaskId: null });
    showToast("Задача добавлена.");
  }
  clearTaskDraft(false);
  saveState(); closeDialog({ saveTaskDraft: false }); renderAll();
}

function setTaskCompleted(task, completed) {
  task.status = completed ? "completed" : "active";
  task.updatedAt = nowIso();
  if (completed) { const category = getCategory(task.categoryId); task.completedAt = nowIso(); task.categoryNameAtCompletion = category.name; task.categoryColorAtCompletion = category.color; showToast("Задача выполнена."); }
  else { task.completedAt = null; task.categoryNameAtCompletion = null; task.categoryColorAtCompletion = null; showToast("Задача возвращена в планы."); }
  if (completed) createNextRepeatedTask(task);
  saveState(); renderAll();
}

function moveTask(task, dateValue) { task.date = dateValue; task.updatedAt = nowIso(); saveState(); renderAll(); }
function copyTask(task) {
  appState.tasks.push({
    id: createId("task"), title: task.title, date: task.date, categoryId: task.categoryId, note: task.note,
    repeat: task.repeat || "none", repeatDay: task.repeatDay || null, status: "active", createdAt: nowIso(), updatedAt: nowIso(),
    completedAt: null, deletedAt: null, categoryNameAtCompletion: null, categoryColorAtCompletion: null, order: getNextOrder(), generatedNextTaskId: null
  });
  saveState(); renderAll(); showToast("Копия задачи добавлена.");
}
function deleteTask(task) { task.status = "deleted"; task.deletedAt = nowIso(); task.updatedAt = nowIso(); saveState(); showToast("Задача перемещена в архив."); closeDialog(); renderAll(); }
function restoreTask(task) { task.status = "active"; task.deletedAt = null; task.updatedAt = nowIso(); if (!appState.categories.some((category) => category.id === task.categoryId)) task.categoryId = "uncategorized"; saveState(); showToast("Задача восстановлена в план."); renderAll(); }

function saveCategoryFromForm() {
  const categoryId = elements.categoryForm.elements["category-id"].value;
  const name = elements.categoryForm.elements["category-name"].value.trim();
  const color = elements.categoryForm.elements["category-color"].value;
  if (!name || name.length > 40) { elements.categoryError.textContent = "Введите название категории от 1 до 40 символов."; return; }
  if (appState.categories.some((category) => category.name.trim().toLocaleLowerCase("ru") === name.toLocaleLowerCase("ru") && category.id !== categoryId)) { elements.categoryError.textContent = "Категория с таким названием уже есть."; return; }
  if (!CATEGORY_COLORS.includes(color)) { elements.categoryError.textContent = "Выберите цвет из палитры."; return; }
  if (categoryId) {
    const category = getCategory(categoryId);
    if (category.isSystem) { elements.categoryError.textContent = "Системную категорию изменить нельзя."; return; }
    Object.assign(category, { name, color }); showToast("Категория обновлена.");
  } else { appState.categories.push({ id: createId("cat"), name, color, isSystem: false, createdAt: nowIso() }); showToast("Категория добавлена."); }
  saveState(); resetCategoryForm(); renderAll();
}

function deleteCategory(category) {
  appState.tasks.forEach((task) => {
    if (task.categoryId !== category.id) return;
    if (task.status !== "active" && !task.categoryNameAtCompletion) { task.categoryNameAtCompletion = category.name; task.categoryColorAtCompletion = category.color; }
    task.categoryId = "uncategorized"; task.updatedAt = nowIso();
  });
  appState.categories = appState.categories.filter((item) => item.id !== category.id);
  saveState(); showToast("Категория удалена. Связанные задачи перенесены во «Вне категории».");
  const categoriesDialog = document.querySelector("[data-dialog='categories-dialog']");
  pageState.confirmReturnDialog = null;
  pageState.activeDialog.hidden = true;
  pageState.activeDialog = categoriesDialog;
  categoriesDialog.hidden = false;
  pageState.pendingConfirmation = null;
  renderAll();
  elements.categoryForm.elements["category-name"].focus();
}

function openConfirmation(type, identifier, trigger) {
  const dialog = document.querySelector("[data-dialog='confirm-dialog']");
  pageState.confirmReturnDialog = pageState.activeDialog;
  pageState.activeDialog?.setAttribute("hidden", "");
  pageState.activeDialog = dialog; pageState.lastDialogTrigger = trigger; pageState.pendingConfirmation = { type, identifier };
  elements.confirmAcknowledgement.checked = false;
  elements.confirmAcknowledgementWrap.hidden = type !== "reset";
  elements.confirmAction.disabled = type === "reset";
  elements.confirmKicker.textContent = "Подтверждение";
  elements.confirmAction.textContent = "Удалить";
  if (type === "task") { const task = getTaskById(identifier); elements.confirmTitle.textContent = "Удалить задачу?"; elements.confirmCopy.textContent = `«${task.title}» исчезнет с недельной доски, но останется в архиве — её можно будет восстановить.`; }
  else if (type === "category") { const category = getCategory(identifier); elements.confirmTitle.textContent = "Удалить категорию?"; elements.confirmCopy.textContent = `Задачи из категории «${category.name}» будут переведены в «Вне категории».`; }
  else if (type === "import") { elements.confirmKicker.textContent = "Импорт"; elements.confirmTitle.textContent = "Заменить текущие данные?"; elements.confirmCopy.textContent = "Импорт заменит все текущие локальные данные: задачи, категории, историю, настройки и привычки."; elements.confirmAction.textContent = "Импортировать"; }
  else if (type === "cleanup") { elements.confirmKicker.textContent = "Очистка истории"; elements.confirmTitle.textContent = "Очистить старую историю?"; elements.confirmCopy.textContent = identifier === "deleted" ? "Будут навсегда удалены задачи из архива, удалённые более года назад." : "Будут навсегда удалены выполненные и удалённые задачи старше года. Активные задачи останутся."; elements.confirmAction.textContent = "Очистить"; }
  else if (type === "reset") { elements.confirmKicker.textContent = "Начать заново"; elements.confirmTitle.textContent = "Удалить все данные?"; elements.confirmCopy.textContent = "Будут удалены задачи, история, привычки, категории и настройки этого планировщика."; elements.confirmAction.textContent = "Удалить всё"; }
  elements.backdrop.hidden = false; dialog.hidden = false; document.body.classList.add("dialog-open"); (type === "reset" ? elements.confirmAcknowledgement : elements.confirmAction).focus();
}

function handleTaskAction(action, task, trigger) {
  if (!task || task.status === "deleted") return;
  if (action === "edit") return openTaskEditor(task, trigger);
  if (action === "copy") return copyTask(task);
  if (action === "delete") return openConfirmation("task", task.id, trigger);
  if (action === "restore") return setTaskCompleted(task, false);
  if (action === "complete") return setTaskCompleted(task, true);
  if (action === "leave") return showToast("Задача остаётся в исходном дне.");
  if (action === "today") return moveTask(task, toDateInputValue(new Date()));
  const baseDate = fromDateInputValue(task.date);
  if (action === "tomorrow") return moveTask(task, toDateInputValue(new Date(baseDate.getFullYear(), baseDate.getMonth(), baseDate.getDate() + 1)));
  if (action === "next-week") return moveTask(task, toDateInputValue(new Date(baseDate.getFullYear(), baseDate.getMonth(), baseDate.getDate() + 7)));
}

function handleConfirmation() {
  const confirmation = pageState.pendingConfirmation;
  if (!confirmation) return;
  if (confirmation.type === "task") { const task = getTaskById(confirmation.identifier); if (task) deleteTask(task); }
  if (confirmation.type === "category") { const category = getCategory(confirmation.identifier); if (category && !category.isSystem) deleteCategory(category); }
  if (confirmation.type === "import") importState();
  if (confirmation.type === "cleanup") cleanupHistory(confirmation.identifier);
  if (confirmation.type === "reset" && elements.confirmAcknowledgement.checked) resetAllData();
}

function saveCustomHabit() {
  const title = elements.customHabitForm.elements["custom-habit-title"].value.trim();
  if (!title || title.length > 80) {
    elements.customHabitError.textContent = "Введите название привычки от 1 до 80 символов.";
    return;
  }
  appState.customHabits.push({ id: createId("habit"), title, startDate: toDateInputValue(new Date()), createdAt: nowIso(), completions: {} });
  saveState();
  elements.customHabitForm.reset();
  elements.customHabitError.textContent = "";
  renderAll();
  showToast("Ежедневная привычка добавлена.");
}

function removeCustomHabit(habitId) {
  appState.customHabits = appState.customHabits.filter((habit) => habit.id !== habitId);
  saveState();
  renderAll();
  showToast("Ежедневная привычка удалена.");
}

document.addEventListener("click", (event) => {
  const weekButton = event.target.closest("[data-week-action]"); if (weekButton) handleWeekAction(weekButton.dataset.weekAction);
  const dialogOpener = event.target.closest("[data-open-dialog]"); if (dialogOpener) openDialog(dialogOpener.dataset.openDialog, dialogOpener);
  const managementSectionButton = event.target.closest("[data-open-management-section]");
  if (managementSectionButton) openManagementSection(managementSectionButton.dataset.openManagementSection);
  if (event.target.closest("[data-close-dialog]") || event.target === elements.backdrop) closeDialog();
  if (event.target.closest("[data-cancel-task-form]")) cancelTaskForm();
  if (event.target.closest("[data-restore-task-draft]")) restoreTaskDraft();
  if (event.target.closest("[data-discard-task-draft]")) discardTaskDraft();
  const unavailableButton = event.target.closest("[data-not-ready]"); if (unavailableButton) showToast(unavailableButton.dataset.notReady);
  if (event.target.closest("[data-dismiss-summary]")) elements.summary.hidden = true;
  if (event.target.closest("[data-theme-toggle]")) setTheme(elements.root.dataset.theme === "dark" ? "light" : "dark");
  const taskActionButton = event.target.closest("[data-task-action]"); if (taskActionButton) handleTaskAction(taskActionButton.dataset.taskAction, getTaskById(taskActionButton.dataset.taskId), taskActionButton);
  const overdueActionButton = event.target.closest("[data-overdue-action]");
  if (overdueActionButton) {
    const task = getTaskById(overdueActionButton.dataset.taskId);
    if (overdueActionButton.dataset.overdueAction === "move" && task) openOverdueMoveDialog(task, overdueActionButton);
    if (overdueActionButton.dataset.overdueAction === "complete" && task) setTaskCompleted(task, true);
    if (overdueActionButton.dataset.overdueAction === "delete" && task) openConfirmation("task", task.id, overdueActionButton);
  }
  if (event.target.closest("[data-overdue-move-today]")) applyOverdueMove(toDateInputValue(new Date()));
  const categoryActionButton = event.target.closest("[data-category-action]");
  if (categoryActionButton) { const category = getCategory(categoryActionButton.dataset.categoryId); if (categoryActionButton.dataset.categoryAction === "edit" && !category.isSystem) populateCategoryForm(category); if (categoryActionButton.dataset.categoryAction === "delete" && !category.isSystem) openConfirmation("category", category.id, categoryActionButton); }
  const archiveRestore = event.target.closest("[data-archive-restore]"); if (archiveRestore) restoreTask(getTaskById(archiveRestore.dataset.archiveRestore));
  if (event.target.closest("[data-reset-category-form]")) resetCategoryForm();
  if (event.target.closest("[data-confirm-action]")) handleConfirmation();
  if (event.target.closest("[data-export-data]")) exportData();
  if (event.target.closest("[data-import-data]")) { clearDataError(); elements.importFile.click(); }
  const cleanupButton = event.target.closest("[data-clean-history]");
  if (cleanupButton) openConfirmation("cleanup", cleanupButton.dataset.cleanHistory, cleanupButton);
  if (event.target.closest("[data-request-reset]")) openConfirmation("reset", "", event.target.closest("[data-request-reset]"));
  if (event.target.closest("[data-move-all-overdue]")) { getOverdueTasks().forEach((task) => { task.date = toDateInputValue(new Date()); task.updatedAt = nowIso(); }); saveState(); renderAll(); showToast("Просроченные задачи перенесены на сегодня."); }
  const timerAction = event.target.closest("[data-timer-action]");
  if (timerAction) {
    if (timerAction.dataset.timerAction === "start" || timerAction.dataset.timerAction === "restart") startTimer();
    if (timerAction.dataset.timerAction === "pause") pauseTimer();
    if (timerAction.dataset.timerAction === "resume") resumeTimer();
    if (timerAction.dataset.timerAction === "reset") { resetTimer(); renderAll(); }
  }
  if (event.target.closest("[data-mark-habit]")) {
    const today = toDateInputValue(new Date());
    markHabitManually(today, !isHabitCompleted(today));
  }
  if (event.target.closest("[data-start-today-timer]")) {
    if (appState.timer.state === "running") showToast("Таймер уже запущен.");
    else if (appState.timer.state === "paused") resumeTimer();
    else startTimer();
  }
  const removeCustomHabitButton = event.target.closest("[data-remove-custom-habit]");
  if (removeCustomHabitButton) removeCustomHabit(removeCustomHabitButton.dataset.removeCustomHabit);
});

document.addEventListener("change", (event) => {
  if (event.target === elements.importFile) { readImportFile(elements.importFile.files?.[0]); elements.importFile.value = ""; }
  if (event.target === elements.confirmAcknowledgement) elements.confirmAction.disabled = !elements.confirmAcknowledgement.checked;
  const checkbox = event.target.closest("[data-task-toggle]");
  if (checkbox) { const task = getTaskById(checkbox.dataset.taskToggle); if (task) setTaskCompleted(task, checkbox.checked); }
  const habitCheckbox = event.target.closest("[data-habit-date]");
  if (habitCheckbox) markHabitManually(habitCheckbox.dataset.habitDate, habitCheckbox.checked);
  const customHabitCheckbox = event.target.closest("[data-custom-habit-id]");
  if (customHabitCheckbox) {
    const habit = appState.customHabits.find((item) => item.id === customHabitCheckbox.dataset.customHabitId);
    if (habit) markCustomHabit(habit, customHabitCheckbox.dataset.customHabitDate, customHabitCheckbox.checked);
  }
});
elements.taskForm.addEventListener("input", queueTaskDraftSave);
elements.taskForm.addEventListener("focusout", () => { window.setTimeout(saveTaskDraftNow, 0); });
document.addEventListener("keydown", (event) => { if (event.key === "Escape" && pageState.activeDialog) closeDialog(); trapDialogFocus(event); });
elements.taskForm.addEventListener("submit", (event) => { event.preventDefault(); saveTaskFromForm(); });
elements.categoryForm.addEventListener("submit", (event) => { event.preventDefault(); saveCategoryFromForm(); });
elements.customHabitForm.addEventListener("submit", (event) => { event.preventDefault(); saveCustomHabit(); });
elements.overdueMoveForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const dateValue = elements.overdueMoveForm.elements["overdue-move-date"].value;
  if (!isValidDateValue(dateValue)) {
    elements.overdueMoveError.textContent = "Выберите корректную дату.";
    return;
  }
  applyOverdueMove(dateValue);
});
elements.timerSettingsForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const duration = Number(elements.timerSettingsForm.elements["timer-duration"].value);
  if (!Number.isInteger(duration) || duration < 1 || duration > 120) {
    elements.timerSettingsError.textContent = "Введите целое число от 1 до 120.";
    return;
  }
  appState.settings.timerDurationMinutes = duration;
  if (appState.timer.state === "idle") resetTimer(false);
  saveState();
  closeDialog();
  renderAll();
  showToast("Длительность таймера сохранена.");
});

window.addEventListener("storage", (event) => {
  if (event.key !== STORAGE_KEY || event.storageArea !== window.localStorage || !event.newValue) return;
  try {
    const nextState = normalizeState(JSON.parse(event.newValue));
    if (!nextState) throw new Error("invalid storage state");
    const isEditingTask = pageState.activeDialog?.dataset.dialog === "task-dialog";
    const localDraft = isEditingTask ? makeTaskFormDraft() : null;
    appState = nextState;
    if (localDraft) appState.drafts.taskForm = localDraft;
    storageHealth.hasUnsavedChanges = false;
    storageHealth.serializedSize = event.newValue.length * 2;
    renderAll();
    renderDataStatus();
    showToast("Данные обновлены в другой вкладке.");
  } catch (error) {
    showToast("Не удалось применить изменения из другой вкладки.");
  }
});

setTheme(appState.settings.theme, false);
reconcileTimerOnLoad();
renderAll();

