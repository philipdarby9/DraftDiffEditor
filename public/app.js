const els = {
  saveStatus: document.querySelector("#save-status"),
  projectTitle: document.querySelector("#project-title"),
  fileMenu: document.querySelector("#file-menu"),
  editMenu: document.querySelector("#edit-menu"),
  viewMenu: document.querySelector("#view-menu"),
  fileNew: document.querySelector("#file-new"),
  fileOpen: document.querySelector("#file-open"),
  fileOpenLocation: document.querySelector("#file-open-location"),
  fileSaveAs: document.querySelector("#file-save-as"),
  editUndo: document.querySelector("#edit-undo"),
  editRedo: document.querySelector("#edit-redo"),
  editGlobalFont: document.querySelector("#edit-global-font"),
  editGlobalFontSize: document.querySelector("#edit-global-font-size"),
  fileOpenInput: document.querySelector("#file-open-input"),
  storyTab: document.querySelector("#story-tab"),
  storyDisplayToggle: document.querySelector("#story-display-toggle"),
  allDraftsTab: document.querySelector("#all-drafts-tab"),
  allDraftsToggle: document.querySelector("#all-drafts-toggle"),
  draftTabs: document.querySelector("#draft-tabs"),
  pageCanvas: document.querySelector("#page-canvas"),
  newDraftCopy: document.querySelector("#new-draft-copy"),
  newDraftBlank: document.querySelector("#new-draft-blank"),
  toggleChanges: document.querySelector("#toggle-changes"),
  compareMode: document.querySelector("#compare-mode"),
  pagesOnScreen: document.querySelector("#pages-on-screen"),
  compareSubtitle: document.querySelector("#compare-subtitle"),
  diffOutput: document.querySelector("#diff-output"),
  editorSurface: document.querySelector("#editor-surface"),
  changesPanel: document.querySelector("#changes-panel")
};

const STORY_KEY = "story";
const PROJECT_NOTES_TITLE = "Project notes";
const DISPLAY_STORAGE_KEY = "draftDiff.displayedPageKeys";
const NOTES_COLLAPSED_STORAGE_KEY = "draftDiff.collapsedNotesIds";
const NOTES_SIZE_STORAGE_KEY = "draftDiff.notesPanePercents";
const PAGES_ON_SCREEN_STORAGE_KEY = "draftDiff.pagesOnScreen";
const FILE_VIEW_STATES_STORAGE_KEY = "draftDiff.fileViewStates";
const PROJECT_STATE_CACHE_STORAGE_KEY = "draftDiff.projectStatesByPath";
const DEFAULT_PAGES_ON_SCREEN = 2;
const HISTORY_LIMIT = 100;
const MAX_SAVE_RETRIES = 3;
const FORMAT_DEFAULT_VERSION = 2;
const LEGACY_DEFAULT_FONT_FAMILY = "Segoe UI";

let state = null;
let selectedDraftId = null;
let activeArea = "draft";
let saveTimer = null;
let isSaving = false;
let showChanges = false;
let exportPath = "";
let activeEditorKey = STORY_KEY;
let projectFileName = "draft-history.txt";
let linkedTextPath = "";
let stateRevision = 0;
let saveQueued = false;
let saveRetryCount = 0;

let fileViewStates = readStoredFileViewStates();
let displayedPageKeys = new Set();
let hasStoredDisplaySelection = false;
let collapsedNotesIds = new Set();
let notesPanePercents = {};
let pagesOnScreen = DEFAULT_PAGES_ON_SCREEN;
let resizingDraftId = null;
let compareHighlightTimer = null;
let editorSelections = {};
let undoStack = [];
let redoStack = [];
let isRestoringHistory = false;

const DEFAULT_FORMAT = {
  fontFamily: "Consolas",
  fontSize: "16"
};

const FONT_FAMILY_OPTIONS = [
  "Consolas",
  "Segoe UI",
  "Arial",
  "Calibri",
  "Georgia",
  "Times New Roman",
  "Courier New"
];

const FONT_SIZE_OPTIONS = ["12", "14", "16", "18", "20", "24", "28", "32"];

const allowedFontFamilies = new Set(FONT_FAMILY_OPTIONS);
const allowedFontSizes = new Set(FONT_SIZE_OPTIONS);

const MENU_SHORTCUT_LABELS = {
  new: { mac: "⌘N", default: "Ctrl+N" },
  open: { mac: "⌘O", default: "Ctrl+O" },
  openLocation: { mac: "⌘⌥O", default: "Ctrl+Alt+O" },
  saveAs: { mac: "⌘⇧S", default: "Ctrl+Shift+S" },
  undo: { mac: "⌘Z", default: "Ctrl+Z" },
  redo: { mac: "⌘⇧Z", default: "Ctrl+Y" },
  pages1: { mac: "⌘1", default: "Ctrl+1" },
  pages2: { mac: "⌘2", default: "Ctrl+2" },
  pages3: { mac: "⌘3", default: "Ctrl+3" },
  pages4: { mac: "⌘4", default: "Ctrl+4" }
};

const toolbarIcons = {
  undo: '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M3 7h7.5a2.5 2.5 0 0 1 0 5H8"></path><path d="M5.5 4.5 3 7l2.5 2.5"></path></svg>',
  redo: '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M13 7H5.5a2.5 2.5 0 0 0 0 5H8"></path><path d="M10.5 4.5 13 7l-2.5 2.5"></path></svg>',
  bold: '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M5 3h4a2.25 2.25 0 1 1 0 4.5H5zM5 7.5h4.5a2.5 2.5 0 1 1 0 5H5z"></path></svg>',
  italic: '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M10.5 3h-4M9.5 13h-4M9.5 3l-3 10"></path></svg>',
  underline: '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M4.5 3v5a3.5 3.5 0 0 0 7 0V3"></path><path d="M3.5 13.5h9"></path></svg>',
  strike: '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M2.5 8h11"></path><path d="M5 5.5a2.5 2.5 0 0 1 5 0"></path><path d="M11 10.5a2.5 2.5 0 0 1-5 0"></path></svg>',
  unorderedList: '<svg viewBox="0 0 16 16" aria-hidden="true"><circle cx="3.5" cy="4.5" r="0.8" fill="currentColor"></circle><circle cx="3.5" cy="8" r="0.8" fill="currentColor"></circle><circle cx="3.5" cy="11.5" r="0.8" fill="currentColor"></circle><path d="M6 4.5h7M6 8h7M6 11.5h7"></path></svg>',
  orderedList: '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M6 4.5h7M6 8h7M6 11.5h7"></path><path d="M2.5 3v3M2 3h1M2 6h1.5M2 8.5h1.5M2 8.5a.75.75 0 0 1 1.5 0c0 .75-1.5.75-1.5 1.5h1.5"></path><path d="M2 11h1.5M2 12.5h1.5M2 12.5a.75.75 0 0 1 .75-.75M2 14h1.5"></path></svg>',
  outdent: '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M3 3.5h10M7 7h6M7 9h6M3 12.5h10"></path><path d="M5 7 3 8.5 5 10"></path></svg>',
  indent: '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M3 3.5h10M7 7h6M7 9h6M3 12.5h10"></path><path d="m3 7 2 1.5L3 10"></path></svg>',
  alignLeft: '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M3 3.5h10M3 7h7M3 10.5h10M3 13.5h7"></path></svg>',
  alignCenter: '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M3 3.5h10M5 7h6M3 10.5h10M5 13.5h6"></path></svg>',
  alignRight: '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M3 3.5h10M6 7h7M3 10.5h10M6 13.5h7"></path></svg>',
  clear: '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M4 12.5h8"></path><path d="M5.5 3.5H10l-1.5 7h-2zM3 13l3-3"></path></svg>',
  format: '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M3 4.5h10M3 8h10M3 11.5h10"></path><path d="M5.5 3v3M10.5 6.5v3M7.5 10v3"></path></svg>'
};

function nowIso() {
  return new Date().toISOString();
}

function pingServer() {
  fetch("/api/ping", { method: "POST", keepalive: true }).catch(() => {});
}

function isMacPlatform() {
  const platform = navigator.userAgentData?.platform || navigator.platform || "";
  return /mac|iphone|ipad|ipod/i.test(platform);
}

function updateMenuShortcutLabels() {
  const labelSet = isMacPlatform() ? "mac" : "default";

  document.querySelectorAll("[data-shortcut]").forEach(shortcut => {
    const labels = MENU_SHORTCUT_LABELS[shortcut.dataset.shortcut];
    if (labels) shortcut.textContent = labels[labelSet];
  });
}

function hasPlatformShortcutModifier(event) {
  return isMacPlatform()
    ? event.metaKey && !event.ctrlKey
    : event.ctrlKey && !event.metaKey;
}

function handleGlobalShortcut(event) {
  if (event.defaultPrevented || event.isComposing) return false;

  const key = event.key.toLowerCase();
  const isOpenLocationShortcut = isMacPlatform()
    ? event.metaKey && event.altKey && !event.ctrlKey && !event.shiftKey && key === "o"
    : event.ctrlKey && event.altKey && !event.metaKey && !event.shiftKey && key === "o";

  if (isOpenLocationShortcut) {
    event.preventDefault();
    openFileLocation();
    return true;
  }

  if (event.altKey) return false;
  if (!hasPlatformShortcutModifier(event)) return false;

  if (!event.shiftKey && key === "z") {
    event.preventDefault();
    undoProjectChange();
    closeTopMenus();
    return true;
  }

  if ((!event.shiftKey && key === "y") || (event.shiftKey && key === "z")) {
    event.preventDefault();
    redoProjectChange();
    closeTopMenus();
    return true;
  }

  if (!event.shiftKey && key === "n") {
    event.preventDefault();
    newTextProject();
    return true;
  }

  if (!event.shiftKey && key === "o") {
    event.preventDefault();
    openTextProject();
    return true;
  }

  if (event.shiftKey && key === "s") {
    event.preventDefault();
    saveAsTextProject();
    return true;
  }

  if (!event.shiftKey && /^[1-4]$/.test(event.key)) {
    event.preventDefault();
    setPagesOnScreen(event.key);
    closeTopMenus();
    return true;
  }

  return false;
}

function makeId(prefix) {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function formatDate(iso) {
  const date = new Date(iso);
  if (Number.isNaN(date.valueOf())) return iso;
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(date);
}

function formatDateForExport(iso) {
  const date = new Date(iso);
  if (Number.isNaN(date.valueOf())) return iso;
  return new Intl.DateTimeFormat("en-GB", {
    dateStyle: "full",
    timeStyle: "short"
  }).format(date);
}

function draftContentKey(draftId) {
  return `draft:${draftId}:content`;
}

function draftNotesKey(draftId) {
  return `draft:${draftId}:notes`;
}

function parseDraftPageKey(key) {
  if (key === STORY_KEY) return { type: "story" };
  const match = /^draft:(.+):(content|notes)$/.exec(key);
  if (!match) return null;
  return { type: match[2], draftId: match[1] };
}

function readStoredStringArray(storageKey) {
  try {
    const parsed = JSON.parse(window.localStorage.getItem(storageKey) || "[]");
    return Array.isArray(parsed) ? parsed.filter(value => typeof value === "string") : [];
  } catch {
    return [];
  }
}

function readStoredNumberMap(storageKey) {
  try {
    const parsed = JSON.parse(window.localStorage.getItem(storageKey) || "{}");
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
    return Object.fromEntries(
      Object.entries(parsed)
        .map(([key, value]) => [key, Number(value)])
        .filter(([key, value]) => key && Number.isFinite(value))
    );
  } catch {
    return {};
  }
}

function readStoredDisplayKeys() {
  const raw = window.localStorage.getItem(DISPLAY_STORAGE_KEY);
  if (raw === null) return { hasStored: false, keys: [] };

  try {
    const parsed = JSON.parse(raw);
    return { hasStored: true, keys: Array.isArray(parsed) ? parsed.filter(Boolean) : [] };
  } catch {
    return { hasStored: false, keys: [] };
  }
}

function readStoredFileViewStates() {
  try {
    const parsed = JSON.parse(window.localStorage.getItem(FILE_VIEW_STATES_STORAGE_KEY) || "{}");
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

function projectFileNameKey(fileName = projectFileName) {
  return String(fileName || "draft-history.txt").trim().toLowerCase() || "draft-history.txt";
}

function projectViewStateKey(fileName = projectFileName, projectState = state) {
  const baseKey = projectFileNameKey(fileName);
  const fingerprint = [
    projectState?.createdAt,
    projectState?.initialNotes?.createdAt,
    projectState?.drafts?.[0]?.createdAt
  ].filter(Boolean).join("|");
  return fingerprint ? `${baseKey}|${fingerprint}` : baseKey;
}

function clampPagesOnScreen(value) {
  return Math.min(4, Math.max(1, Number(value) || DEFAULT_PAGES_ON_SCREEN));
}

function selectedDisplayPageCount() {
  if (!state) return 0;
  const validKeys = new Set(displayKeys());
  return [...displayedPageKeys].filter(key => validKeys.has(key)).length;
}

function normalizePagesOnScreenForSelection(value) {
  const requestedPagesOnScreen = clampPagesOnScreen(value);
  const selectedCount = selectedDisplayPageCount();
  if (selectedCount === 0) return 1;
  return Math.min(requestedPagesOnScreen, selectedCount);
}

function syncPagesOnScreenToDisplaySelection() {
  const normalizedPagesOnScreen = normalizePagesOnScreenForSelection(pagesOnScreen);
  if (normalizedPagesOnScreen !== pagesOnScreen) setPagesOnScreen(normalizedPagesOnScreen);
}

function saveFileViewStates() {
  window.localStorage.setItem(FILE_VIEW_STATES_STORAGE_KEY, JSON.stringify(fileViewStates));
}

function legacyViewState() {
  const storedDisplay = readStoredDisplayKeys();
  const storedPagesOnScreen = Number(window.localStorage.getItem(PAGES_ON_SCREEN_STORAGE_KEY) || DEFAULT_PAGES_ON_SCREEN);
  const legacyDisplayedPageKeys = new Set(storedDisplay.keys);
  const legacyCollapsedIds = readStoredStringArray(NOTES_COLLAPSED_STORAGE_KEY);
  const legacyNotesPanePercents = readStoredNumberMap(NOTES_SIZE_STORAGE_KEY);
  const notesPanePercentsByIndex = {};

  Object.entries(legacyNotesPanePercents).forEach(([draftId, value]) => {
    const index = draftIndexForId(draftId);
    if (index >= 0 && Number.isFinite(Number(value))) notesPanePercentsByIndex[index] = Number(value);
  });

  return {
    hasStoredDisplaySelection: storedDisplay.hasStored,
    displayedStory: legacyDisplayedPageKeys.has(STORY_KEY),
    displayedDraftIndexes: state?.drafts
      ? state.drafts
        .map((draft, index) => legacyDisplayedPageKeys.has(draftContentKey(draft.id)) ? index : null)
        .filter(index => index !== null)
      : [],
    collapsedNotesIndexes: draftIndexesFromIds(legacyCollapsedIds),
    notesPanePercents: notesPanePercentsByIndex,
    pagesOnScreen: storedPagesOnScreen
  };
}

function saveDisplaySelection() {
  saveCurrentViewState();
}

function saveCollapsedNotes() {
  saveCurrentViewState();
}

function saveNotesPanePercents() {
  saveCurrentViewState();
}

function getSelectedDraft() {
  return state.drafts.find(draft => draft.id === selectedDraftId) || state.drafts[0];
}

function draftById(draftId) {
  return state.drafts.find(draft => draft.id === draftId);
}

function createDraft(copyFrom, indexOverride, defaultFormatOverride = null) {
  const index = indexOverride || ((state?.drafts?.length || 0) + 1);
  const createdAt = nowIso();
  const defaultFormat = normalizeFormat(defaultFormatOverride || currentDefaultFormat(state));
  return {
    id: makeId("draft"),
    title: `Draft ${index}`,
    createdAt,
    content: copyFrom?.content || "",
    contentHtml: copyFrom?.contentHtml || textToHtml(copyFrom?.content || ""),
    format: copyFrom?.format ? { ...normalizeFormat(copyFrom.format) } : { ...defaultFormat },
    notes: {
      id: makeId("notes"),
      title: `Draft ${index} Notes`,
      createdAt,
      content: "",
      contentHtml: "",
      format: { ...defaultFormat }
    }
  };
}

function createDefaultState() {
  const createdAt = nowIso();
  const defaultFormat = { ...DEFAULT_FORMAT };
  return {
    version: 1,
    formatDefaultVersion: FORMAT_DEFAULT_VERSION,
    defaultFormat,
    createdAt,
    updatedAt: createdAt,
    initialNotes: {
      id: "initial-notes",
      title: PROJECT_NOTES_TITLE,
      createdAt,
      content: "",
      contentHtml: "",
      format: { ...defaultFormat }
    },
    drafts: [createDraft(null, 1, defaultFormat)]
  };
}

function fileNameFromPath(filePath) {
  return String(filePath || "").split(/[\\/]/).filter(Boolean).pop() || "";
}

function ensureTxtExtension(fileName) {
  const trimmed = String(fileName || "").trim();
  if (!trimmed) return "draft-history.txt";
  return /\.txt$/i.test(trimmed) ? trimmed : `${trimmed}.txt`;
}

function filePathsMatch(a, b) {
  const normalizePath = value => String(value || "").replace(/\//g, "\\").toLowerCase();
  return Boolean(a && b && normalizePath(a) === normalizePath(b));
}

function textFileStateCacheKey(filePath) {
  return String(filePath || "").replace(/\//g, "\\").toLowerCase();
}

function readProjectStateCache() {
  try {
    const parsed = JSON.parse(window.localStorage.getItem(PROJECT_STATE_CACHE_STORAGE_KEY) || "{}");
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

function writeProjectStateCache(cache) {
  try {
    window.localStorage.setItem(PROJECT_STATE_CACHE_STORAGE_KEY, JSON.stringify(cache));
  } catch {}
}

function cachedProjectStateForPath(filePath) {
  const entry = readProjectStateCache()[textFileStateCacheKey(filePath)];
  if (!entry?.state) return null;

  return migrateLegacyDefaultFonts(entry.state);
}

function rememberProjectStateForPath(filePath, projectState = state) {
  if (!filePath || !projectState) return;

  const cache = readProjectStateCache();
  cache[textFileStateCacheKey(filePath)] = {
    filePath,
    updatedAt: nowIso(),
    state: projectStateFromSnapshot(serializeProjectState(projectState))
  };

  const entries = Object.entries(cache)
    .sort(([, left], [, right]) => String(right.updatedAt || "").localeCompare(String(left.updatedAt || "")))
    .slice(0, 25);
  writeProjectStateCache(Object.fromEntries(entries));
}

function rememberLinkedProjectState() {
  rememberProjectStateForPath(linkedTextPath);
}

async function cacheLinkedProjectStateOnServer() {
  if (!linkedTextPath || !state) return;

  try {
    await fetch("/api/cache-text-file-state", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        filePath: linkedTextPath,
        state
      })
    });
  } catch {
    // The local browser cache still preserves formats if this best-effort cache write fails.
  }
}

function updateProjectTitle() {
  const title = projectFileName || fileNameFromPath(exportPath) || "draft-history.txt";
  projectFileName = title;
  if (els.projectTitle) els.projectTitle.textContent = title;
  document.title = `${title} - Draft Diff Editor`;
}

function closeFileMenu() {
  if (els.fileMenu) els.fileMenu.open = false;
}

function closeTopMenus(exceptMenu = null) {
  [els.fileMenu, els.editMenu, els.viewMenu].forEach(menu => {
    if (menu && menu !== exceptMenu) menu.open = false;
  });
}

function setStatus(text) {
  const statusText = String(text || "").replace(/^Saved\s+/, "Saved · ");
  const statusTextEl = els.saveStatus.querySelector(".status-text");
  if (statusTextEl) {
    statusTextEl.textContent = statusText;
  } else {
    els.saveStatus.textContent = statusText;
  }
  els.saveStatus.classList.toggle("is-saving", /saving|unsaved/i.test(text));
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function textToHtml(value) {
  return escapeHtml(value).replace(/\n/g, "<br>");
}

function hasParagraphHtml(value) {
  return /<\s*p(?:\s|>|\/)/i.test(String(value || ""));
}

function lineBreakCount(value) {
  return (String(value || "").match(/\n/g) || []).length;
}

function normalizeFormat(format = {}) {
  const fontFamily = allowedFontFamilies.has(format.fontFamily)
    ? format.fontFamily
    : DEFAULT_FORMAT.fontFamily;
  const fontSize = allowedFontSizes.has(String(format.fontSize))
    ? String(format.fontSize)
    : DEFAULT_FORMAT.fontSize;
  return { fontFamily, fontSize };
}

function upgradeLegacyDefaultFormat(format = {}, shouldUpgrade = false) {
  const normalized = normalizeFormat(format);
  return shouldUpgrade && normalized.fontFamily === LEGACY_DEFAULT_FONT_FAMILY
    ? { ...normalized, fontFamily: DEFAULT_FORMAT.fontFamily }
    : normalized;
}

function currentDefaultFormat(projectState = null) {
  return normalizeFormat(projectState?.defaultFormat || DEFAULT_FORMAT);
}

function migrateLegacyDefaultFonts(projectState) {
  if (!projectState) return projectState;

  const shouldUpgrade = projectState.formatDefaultVersion !== FORMAT_DEFAULT_VERSION;
  projectState.defaultFormat = upgradeLegacyDefaultFormat(
    projectState.defaultFormat || DEFAULT_FORMAT,
    shouldUpgrade
  );
  if (!shouldUpgrade) return projectState;

  const upgradePage = page => {
    if (page) page.format = upgradeLegacyDefaultFormat(page.format, true);
  };

  upgradePage(projectState.initialNotes);
  projectState.drafts?.forEach(draft => {
    upgradePage(draft);
    upgradePage(draft.notes);
  });
  projectState.formatDefaultVersion = FORMAT_DEFAULT_VERSION;
  return projectState;
}

function serializeProjectState(projectState = state) {
  return projectState ? JSON.stringify(projectState) : "";
}

function projectStateFromSnapshot(snapshot) {
  return migrateLegacyDefaultFonts(JSON.parse(snapshot));
}

function markStateChanged() {
  stateRevision += 1;
}

function queueSave(delay = 450) {
  window.clearTimeout(saveTimer);
  saveTimer = window.setTimeout(saveNow, delay);
}

function updateUndoRedoControls() {
  if (els.editUndo) els.editUndo.disabled = !undoStack.length;
  if (els.editRedo) els.editRedo.disabled = !redoStack.length;
}

function resetHistory() {
  undoStack = [];
  redoStack = [];
  updateUndoRedoControls();
}

function recordUndoSnapshot() {
  if (!state || isRestoringHistory) return;

  const snapshot = serializeProjectState();
  if (!snapshot || snapshot === undoStack[undoStack.length - 1]) return;

  undoStack.push(snapshot);
  if (undoStack.length > HISTORY_LIMIT) undoStack.shift();
  redoStack = [];
  updateUndoRedoControls();
}

function draftExists(draftId) {
  return Boolean(draftId && state?.drafts?.some(draft => draft.id === draftId));
}

function pageKeyExists(pageKey) {
  if (pageKey === STORY_KEY) return true;
  const parsed = parseDraftPageKey(pageKey);
  return Boolean(parsed?.draftId && draftExists(parsed.draftId));
}

function reconcileViewAfterHistoryRestore() {
  if (!state?.drafts?.length) state.drafts = [createDraft(null, 1)];

  if (!draftExists(selectedDraftId)) selectedDraftId = state.drafts[0]?.id || null;
  if (!pageKeyExists(activeEditorKey)) {
    activeEditorKey = activeArea === "story" ? STORY_KEY : draftContentKey(selectedDraftId);
  }

  const parsed = parseDraftPageKey(activeEditorKey);
  if (activeEditorKey === STORY_KEY) {
    activeArea = "story";
  } else if (parsed?.draftId && draftExists(parsed.draftId)) {
    selectedDraftId = parsed.draftId;
    activeArea = "draft";
  } else {
    selectedDraftId = state.drafts[0]?.id || null;
    activeArea = "draft";
    activeEditorKey = draftContentKey(selectedDraftId);
  }

  ensureDisplaySelection();
}

function restoreHistorySnapshot(snapshot) {
  isRestoringHistory = true;
  state = projectStateFromSnapshot(snapshot);
  editorSelections = {};
  reconcileViewAfterHistoryRestore();
  render();
  scheduleSave();
  updateUndoRedoControls();
  focusPageEditor(activeEditorKey);
  isRestoringHistory = false;
}

function undoProjectChange() {
  if (!undoStack.length) {
    updateUndoRedoControls();
    return;
  }

  syncFromInputs();
  const currentSnapshot = serializeProjectState();
  const previousSnapshot = undoStack.pop();
  if (currentSnapshot && currentSnapshot !== previousSnapshot) redoStack.push(currentSnapshot);
  restoreHistorySnapshot(previousSnapshot);
}

function redoProjectChange() {
  if (!redoStack.length) {
    updateUndoRedoControls();
    return;
  }

  syncFromInputs();
  const currentSnapshot = serializeProjectState();
  const nextSnapshot = redoStack.pop();
  if (currentSnapshot && currentSnapshot !== nextSnapshot) {
    undoStack.push(currentSnapshot);
    if (undoStack.length > HISTORY_LIMIT) undoStack.shift();
  }
  restoreHistorySnapshot(nextSnapshot);
}

function editableHistoryTarget(target) {
  if (!(target instanceof Element)) return null;
  return target.closest("[data-editor-key], [data-title-draft-id]");
}

function ensurePageFields(page) {
  page.content = typeof page.content === "string" ? page.content : "";
  page.contentHtml = typeof page.contentHtml === "string" ? page.contentHtml : textToHtml(page.content);
  if (page.contentHtml) {
    const htmlContent = plainTextFromHtml(page.contentHtml);
    if (!hasParagraphHtml(page.contentHtml) && page.content && lineBreakCount(page.content) > lineBreakCount(htmlContent)) {
      page.contentHtml = textToHtml(page.content);
    } else {
      page.content = htmlContent;
    }
  }
  page.format = normalizeFormat({ ...currentDefaultFormat(state), ...(page.format || {}) });
  return page;
}

function fontStyle(format) {
  const normalized = normalizeFormat(format);
  return `font-family: ${normalized.fontFamily}; font-size: ${normalized.fontSize}px;`;
}

function pageItemForKey(key) {
  if (!state) return null;
  if (key === STORY_KEY) {
    return {
      key: STORY_KEY,
      type: "story",
      title: PROJECT_NOTES_TITLE,
      kicker: "Page",
      createdAt: state.initialNotes.createdAt,
      page: state.initialNotes,
      ariaLabel: PROJECT_NOTES_TITLE,
      editableTitle: false
    };
  }

  const parsed = parseDraftPageKey(key);
  if (!parsed) return null;
  const draft = draftById(parsed.draftId);
  if (!draft) return null;

  if (parsed.type === "content") {
    return {
      key,
      type: "draft",
      title: draft.title,
      kicker: "Draft",
      createdAt: draft.createdAt,
      page: draft,
      draft,
      ariaLabel: `${draft.title} text`,
      editableTitle: true
    };
  }

  return {
    key,
    type: "notes",
    title: `${draft.title} notes`,
    kicker: "Notes",
    createdAt: draft.notes.createdAt,
    page: draft.notes,
    draft,
    ariaLabel: `${draft.title} notes`,
    editableTitle: false
  };
}

function allPageItems() {
  const pages = [pageItemForKey(STORY_KEY)];
  state.drafts.forEach(draft => {
    pages.push(pageItemForKey(draftContentKey(draft.id)));
    pages.push(pageItemForKey(draftNotesKey(draft.id)));
  });
  return pages.filter(Boolean);
}

function displayKeys() {
  return [STORY_KEY, ...state.drafts.map(draft => draftContentKey(draft.id))];
}

function draftDisplayKeys() {
  return state.drafts.map(draft => draftContentKey(draft.id));
}

function defaultDisplayKeys() {
  const firstDraft = state.drafts[0];
  if (!firstDraft) return [STORY_KEY];
  return [STORY_KEY, draftContentKey(firstDraft.id)];
}

function draftIndexesFromIds(ids) {
  return ids
    .map(draftIndexForId)
    .filter(index => index >= 0)
    .sort((a, b) => a - b);
}

function draftIdsFromIndexes(indexes) {
  return (Array.isArray(indexes) ? indexes : [])
    .map(index => state.drafts[Number(index)]?.id)
    .filter(Boolean);
}

function displayKeysFromStoredDraftIndexes(indexes, includeStory) {
  const keys = new Set();
  if (includeStory) keys.add(STORY_KEY);
  draftIdsFromIndexes(indexes).forEach(draftId => keys.add(draftContentKey(draftId)));
  return keys;
}

function saveCurrentViewState() {
  if (!state) return;

  const selectedDraftIndex = draftIndexForId(selectedDraftId);
  const collapsedNotesIndexes = draftIndexesFromIds([...collapsedNotesIds]);
  const notesPanePercentsByIndex = {};
  Object.entries(notesPanePercents).forEach(([draftId, value]) => {
    const index = draftIndexForId(draftId);
    if (index >= 0 && Number.isFinite(Number(value))) notesPanePercentsByIndex[index] = Number(value);
  });

  fileViewStates[projectViewStateKey()] = {
    version: 1,
    hasStoredDisplaySelection,
    displayedStory: displayedPageKeys.has(STORY_KEY),
    displayedDraftIndexes: state.drafts
      .map((draft, index) => displayedPageKeys.has(draftContentKey(draft.id)) ? index : null)
      .filter(index => index !== null),
    collapsedNotesIndexes,
    notesPanePercents: notesPanePercentsByIndex,
    pagesOnScreen,
    selectedDraftIndex: selectedDraftIndex >= 0 ? selectedDraftIndex : 0,
    activeArea,
    showChanges,
    compareMode: els.compareMode.value
  };
  saveFileViewStates();
}

function restoreStoredViewState(stored) {
  const hasStored = Boolean(stored);

  hasStoredDisplaySelection = Boolean(stored?.hasStoredDisplaySelection ?? hasStored);
  displayedPageKeys = hasStored
    ? displayKeysFromStoredDraftIndexes(stored.displayedDraftIndexes, stored.displayedStory)
    : new Set();

  collapsedNotesIds = new Set(draftIdsFromIndexes(stored?.collapsedNotesIndexes));
  notesPanePercents = {};
  Object.entries(stored?.notesPanePercents || {}).forEach(([index, value]) => {
    const draftId = state.drafts[Number(index)]?.id;
    if (draftId && Number.isFinite(Number(value))) notesPanePercents[draftId] = Number(value);
  });

  pagesOnScreen = clampPagesOnScreen(stored?.pagesOnScreen);

  const selectedDraft = state.drafts[Number(stored?.selectedDraftIndex)] || state.drafts[0];
  selectedDraftId = selectedDraft?.id || null;
  activeArea = stored?.activeArea === "draft" ? "draft" : "story";
  activeEditorKey = activeArea === "story" ? STORY_KEY : draftContentKey(selectedDraftId);
  showChanges = Boolean(stored?.showChanges);

  if (stored?.compareMode === "first" || stored?.compareMode === "consecutive") {
    els.compareMode.value = stored.compareMode;
  }

}

function restoreViewStateForProject(options = {}) {
  const key = projectViewStateKey();
  const fileNameOnlyKey = projectFileNameKey();
  const stored = options.fresh ? null : fileViewStates[key] || fileViewStates[fileNameOnlyKey];
  const fallback = !stored && fileNameOnlyKey === projectFileNameKey(fileNameFromPath(exportPath))
    ? legacyViewState()
    : null;

  restoreStoredViewState(stored || fallback);
  ensureDisplaySelection();
  setPagesOnScreen(pagesOnScreen);
}

function ensureDisplaySelection() {
  const validKeys = new Set(displayKeys());
  const validDraftIds = new Set(state.drafts.map(draft => draft.id));
  displayedPageKeys = new Set([...displayedPageKeys].filter(key => validKeys.has(key)));
  collapsedNotesIds = new Set([...collapsedNotesIds].filter(id => validDraftIds.has(id)));
  notesPanePercents = Object.fromEntries(
    Object.entries(notesPanePercents).filter(([id]) => validDraftIds.has(id))
  );

  if (!hasStoredDisplaySelection && !displayedPageKeys.size) {
    displayedPageKeys = new Set(defaultDisplayKeys());
  }

  saveDisplaySelection();
  saveCollapsedNotes();
  saveNotesPanePercents();
  syncPagesOnScreenToDisplaySelection();
}

function displayPage(key, shouldDisplay = true) {
  hasStoredDisplaySelection = true;
  if (shouldDisplay) {
    displayedPageKeys.add(key);
  } else {
    displayedPageKeys.delete(key);
  }
  ensureDisplaySelection();
}

function selectedDraftDisplayCount() {
  return draftDisplayKeys().filter(key => displayedPageKeys.has(key)).length;
}

function allDraftsSelected() {
  return Boolean(state?.drafts?.length) && selectedDraftDisplayCount() === state.drafts.length;
}

function displayAllDrafts(shouldDisplay = true) {
  hasStoredDisplaySelection = true;
  draftDisplayKeys().forEach(key => {
    if (shouldDisplay) {
      displayedPageKeys.add(key);
    } else {
      displayedPageKeys.delete(key);
    }
  });
  ensureDisplaySelection();
}

function activeDisplayKey() {
  if (activeArea === "story") return STORY_KEY;
  return selectedDraftId ? draftContentKey(selectedDraftId) : STORY_KEY;
}

function setPagesOnScreen(value) {
  pagesOnScreen = normalizePagesOnScreenForSelection(value);
  const outerPadding = 0;
  const pageGap = 0;
  const widthOffset = outerPadding + pageGap * (pagesOnScreen - 1);
  document.documentElement.style.setProperty(
    "--page-width",
    `calc((100vw - ${widthOffset}px) / ${pagesOnScreen})`
  );
  if (els.pagesOnScreen) {
    els.pagesOnScreen.querySelectorAll("[data-pages-on-screen]").forEach(button => {
      button.setAttribute("aria-pressed", String(Number(button.dataset.pagesOnScreen) === pagesOnScreen));
    });
  }
  saveCurrentViewState();
  window.requestAnimationFrame(() => alignPageInCanvas(activeDisplayKey()));
}

function getNotesPanePercent(draftId) {
  const value = Number(notesPanePercents[draftId]);
  return Number.isFinite(value) ? Math.min(72, Math.max(28, value)) : 58;
}

function setNotesPanePercent(draftId, value) {
  notesPanePercents[draftId] = Math.min(72, Math.max(28, Number(value) || 58));
  saveNotesPanePercents();
  const stack = Array.from(els.pageCanvas.querySelectorAll("[data-draft-stack-id]"))
    .find(element => element.dataset.draftStackId === draftId);
  if (stack) stack.style.setProperty("--draft-pane-height", `${notesPanePercents[draftId]}%`);
}

function isPageEmpty(page) {
  ensurePageFields(page);
  return !page.content.trim() && !plainTextFromHtml(page.contentHtml).trim();
}

function canDeleteDraft(draft) {
  return isPageEmpty(draft) && isPageEmpty(draft.notes);
}

function editorElementForKey(editorKey) {
  return Array.from(els.pageCanvas.querySelectorAll("[data-editor-key]"))
    .find(editor => editor.dataset.editorKey === editorKey);
}

function nodeOffsetLimit(node) {
  return node.nodeType === Node.TEXT_NODE ? node.nodeValue.length : node.childNodes.length;
}

function nodePathFromRoot(root, node) {
  const path = [];
  let current = node;

  while (current && current !== root) {
    const parent = current.parentNode;
    if (!parent) return null;
    path.unshift(Array.prototype.indexOf.call(parent.childNodes, current));
    current = parent;
  }

  return current === root ? path : null;
}

function nodeFromPath(root, path) {
  if (!Array.isArray(path)) return null;
  let current = root;

  for (const index of path) {
    current = current?.childNodes?.[index] || null;
    if (!current) return null;
  }

  return current;
}

function textOffsetForRangeBoundary(root, container, offset) {
  const range = document.createRange();
  range.selectNodeContents(root);
  range.setEnd(container, offset);
  return range.toString().length;
}

function rangeBoundaryFromTextOffset(root, offset) {
  const target = Math.max(0, Number(offset) || 0);
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  let currentOffset = 0;
  let lastTextNode = null;

  while (walker.nextNode()) {
    const node = walker.currentNode;
    const nextOffset = currentOffset + node.nodeValue.length;
    lastTextNode = node;

    if (target <= nextOffset) {
      return { node, offset: target - currentOffset };
    }

    currentOffset = nextOffset;
  }

  if (lastTextNode) {
    return { node: lastTextNode, offset: lastTextNode.nodeValue.length };
  }

  return { node: root, offset: root.childNodes.length };
}

function rangeFromTextOffsets(root, startOffset, endOffset) {
  const range = document.createRange();
  const start = rangeBoundaryFromTextOffset(root, startOffset);
  const end = rangeBoundaryFromTextOffset(root, Math.max(startOffset, endOffset));
  range.setStart(start.node, start.offset);
  range.setEnd(end.node, end.offset);
  return range;
}

function saveEditorSelection(editorEl) {
  if (!editorEl) return;
  const selection = window.getSelection();
  if (!selection?.rangeCount) return;

  const range = selection.getRangeAt(0);
  if (!editorEl.contains(range.startContainer) || !editorEl.contains(range.endContainer)) return;

  editorSelections[editorEl.dataset.editorKey] = {
    ...editorSelections[editorEl.dataset.editorKey],
    startPath: nodePathFromRoot(editorEl, range.startContainer),
    startOffset: range.startOffset,
    endPath: nodePathFromRoot(editorEl, range.endContainer),
    endOffset: range.endOffset,
    startTextOffset: textOffsetForRangeBoundary(editorEl, range.startContainer, range.startOffset),
    endTextOffset: textOffsetForRangeBoundary(editorEl, range.endContainer, range.endOffset)
  };
}

function saveEditorScrollPosition(editorEl) {
  if (!editorEl?.dataset.editorKey) return;
  editorSelections[editorEl.dataset.editorKey] = {
    ...editorSelections[editorEl.dataset.editorKey],
    scrollTop: editorEl.scrollTop,
    scrollLeft: editorEl.scrollLeft
  };
}

function saveEditorViewState(editorEl) {
  saveEditorScrollPosition(editorEl);
  saveEditorSelection(editorEl);
}

function saveVisibleEditorScrollPositions() {
  els.pageCanvas.querySelectorAll("[data-editor-key]").forEach(saveEditorScrollPosition);
}

function saveCurrentEditorSelection() {
  const selection = window.getSelection();
  const anchor = selection?.anchorNode;
  const anchorElement = anchor?.nodeType === Node.ELEMENT_NODE ? anchor : anchor?.parentElement;
  const editorEl = anchorElement?.closest?.("[data-editor-key]");
  if (editorEl && els.pageCanvas.contains(editorEl)) saveEditorSelection(editorEl);
}

function saveCurrentEditorViewState() {
  const selection = window.getSelection();
  const anchor = selection?.anchorNode;
  const anchorElement = anchor?.nodeType === Node.ELEMENT_NODE ? anchor : anchor?.parentElement;
  const editorEl = anchorElement?.closest?.("[data-editor-key]");
  if (editorEl && els.pageCanvas.contains(editorEl)) saveEditorViewState(editorEl);
}

function restoreEditorScrollPosition(editorEl) {
  const saved = editorSelections[editorEl?.dataset.editorKey];
  if (!editorEl || !saved) return;

  editorEl.scrollTop = Math.max(0, Number(saved.scrollTop) || 0);
  editorEl.scrollLeft = Math.max(0, Number(saved.scrollLeft) || 0);
}

function restoreEditorSelection(editorEl) {
  const saved = editorSelections[editorEl?.dataset.editorKey];
  if (!editorEl || !saved) return false;
  if (saved.startTextOffset === undefined || saved.endTextOffset === undefined) return false;

  const startNode = nodeFromPath(editorEl, saved.startPath);
  const endNode = nodeFromPath(editorEl, saved.endPath);
  let range = null;

  if (
    startNode &&
    endNode &&
    saved.startOffset <= nodeOffsetLimit(startNode) &&
    saved.endOffset <= nodeOffsetLimit(endNode)
  ) {
    range = document.createRange();
    range.setStart(startNode, saved.startOffset);
    range.setEnd(endNode, saved.endOffset);
  } else {
    range = rangeFromTextOffsets(editorEl, saved.startTextOffset, saved.endTextOffset);
  }

  const selection = window.getSelection();
  selection.removeAllRanges();
  selection.addRange(range);
  return true;
}

function displayElementForKey(pageKey) {
  if (pageKey === STORY_KEY) {
    return Array.from(els.pageCanvas.querySelectorAll("[data-page-key]"))
      .find(panel => panel.dataset.pageKey === STORY_KEY);
  }

  const parsed = parseDraftPageKey(pageKey);
  if (!parsed?.draftId) return null;

  return Array.from(els.pageCanvas.querySelectorAll("[data-draft-stack-id]"))
    .find(stack => stack.dataset.draftStackId === parsed.draftId);
}

function alignPageInCanvas(pageKey) {
  const pageEl = displayElementForKey(pageKey);
  if (!pageEl) return;

  const canvasRect = els.pageCanvas.getBoundingClientRect();
  const pageRect = pageEl.getBoundingClientRect();
  const left = els.pageCanvas.scrollLeft + pageRect.left - canvasRect.left;
  els.pageCanvas.scrollTo({ left, behavior: "auto" });
}

function toolbarForEditor(editorKey) {
  return Array.from(els.pageCanvas.querySelectorAll("[data-toolbar-for]"))
    .find(toolbar => toolbar.dataset.toolbarFor === editorKey);
}

function pagePanelForKey(pageKey) {
  return Array.from(els.pageCanvas.querySelectorAll("[data-page-key]"))
    .find(panel => panel.dataset.pageKey === pageKey);
}

function pageForEditorKey(editorKey) {
  return pageItemForKey(editorKey)?.page;
}

function sanitizeStyleMarks(styleValue = "") {
  const style = styleValue.toLowerCase();
  return {
    bold: /font-weight\s*:\s*(bold|[6-9]00)/.test(style),
    italic: /font-style\s*:\s*italic/.test(style),
    underline: /text-decoration[^;]*underline/.test(style),
    strike: /text-decoration[^;]*(line-through|strike)/.test(style)
  };
}

function wrapSemanticHtml(html, marks) {
  let output = html;
  if (marks.strike) output = `<s>${output}</s>`;
  if (marks.underline) output = `<u>${output}</u>`;
  if (marks.italic) output = `<em>${output}</em>`;
  if (marks.bold) output = `<strong>${output}</strong>`;
  return output;
}

function sanitizeRichHtml(html) {
  const template = document.createElement("template");
  template.innerHTML = String(html || "");
  const blockTags = new Set(["div", "p", "blockquote", "ul", "ol", "li"]);

  const sanitizeNode = node => {
    if (node.nodeType === Node.TEXT_NODE) return escapeHtml(node.nodeValue);
    if (node.nodeType !== Node.ELEMENT_NODE) return "";

    const tag = node.tagName.toLowerCase();
    if (tag === "br") return "<br>";

    const inner = Array.from(node.childNodes).map(sanitizeNode).join("");
    if (tag === "b" || tag === "strong") return `<strong>${inner}</strong>`;
    if (tag === "i" || tag === "em") return `<em>${inner}</em>`;
    if (tag === "u") return `<u>${inner}</u>`;
    if (tag === "s" || tag === "strike" || tag === "del") return `<s>${inner}</s>`;
    if (tag === "span") return wrapSemanticHtml(inner, sanitizeStyleMarks(node.getAttribute("style") || ""));
    if (blockTags.has(tag)) return `<${tag}>${inner}</${tag}>`;
    return inner;
  };

  return Array.from(template.content.childNodes).map(sanitizeNode).join("");
}

function plainTextFromHtml(html) {
  const template = document.createElement("template");
  template.innerHTML = sanitizeRichHtml(html);
  return plainTextFromNode(template.content).trimEnd();
}

function plainTextFromNode(root) {
  let output = "";
  const blockTags = new Set(["div", "p", "blockquote", "li", "ul", "ol"]);
  const paragraphTags = new Set(["p", "blockquote"]);

  const ensureTrailingNewlines = count => {
    if (!output) return;
    const trailing = output.match(/\n*$/u)?.[0].length || 0;
    if (trailing < count) output += "\n".repeat(count - trailing);
  };

  const normalizedTextNodeValue = node => {
    let text = node.nodeValue.replace(/\u00a0/g, " ");
    if (!text.includes("\n")) return text;

    const siblings = node.parentNode ? Array.from(node.parentNode.childNodes) : [];
    const hasElementSibling = siblings.some(sibling => sibling.nodeType === Node.ELEMENT_NODE);
    if (!hasElementSibling) return text;
    if (!text.trim()) return "";

    return text
      .replace(/^[ \t]*\n[ \t]*/u, "")
      .replace(/[ \t]*\n[ \t]*$/u, "");
  };

  const walk = node => {
    if (node.nodeType === Node.TEXT_NODE) {
      output += normalizedTextNodeValue(node);
      return;
    }

    if (node.nodeType !== Node.ELEMENT_NODE && node.nodeType !== Node.DOCUMENT_FRAGMENT_NODE) return;

    const tag = node.nodeType === Node.ELEMENT_NODE ? node.tagName.toLowerCase() : "";
    if (tag === "br") {
      output += "\n";
      return;
    }

    if (blockTags.has(tag)) ensureTrailingNewlines(1);
    Array.from(node.childNodes).forEach(walk);
    if (paragraphTags.has(tag)) {
      ensureTrailingNewlines(2);
    } else if (blockTags.has(tag)) {
      ensureTrailingNewlines(1);
    }
  };

  walk(root);
  return output;
}

function editorPlainText(editorEl) {
  return plainTextFromNode(editorEl).trimEnd();
}

function exportPageBlock(title, createdAt, content) {
  const body = String(content || "").trimEnd();
  return [
    `Created: ${formatDateForExport(createdAt)}`,
    title,
    "",
    body || "[No text yet]"
  ].join("\n");
}

function formatExportText(projectState) {
  const pages = [
    exportPageBlock(PROJECT_NOTES_TITLE, projectState.initialNotes.createdAt, projectState.initialNotes.content)
  ];

  projectState.drafts.forEach((draft, index) => {
    const title = draft.title || `Draft ${index + 1}`;
    pages.push(exportPageBlock(title, draft.createdAt, draft.content));
    pages.push(exportPageBlock(`${title} Notes`, draft.notes.createdAt, draft.notes.content));
  });

  return `${pages.join("\n\n---\n\n")}\n`;
}

const monthIndexes = new Map([
  ["january", 0],
  ["february", 1],
  ["march", 2],
  ["april", 3],
  ["may", 4],
  ["june", 5],
  ["july", 6],
  ["august", 7],
  ["september", 8],
  ["october", 9],
  ["november", 10],
  ["december", 11]
]);

function parseCreatedAt(value) {
  const raw = String(value || "").trim();
  if (!raw) return nowIso();

  const direct = new Date(raw);
  if (!Number.isNaN(direct.valueOf())) return direct.toISOString();

  const englishDate = raw.match(/^(?:[A-Za-z]+,\s*)?(\d{1,2})\s+([A-Za-z]+)\s+(\d{4})(?:\s+at|,)?\s+(\d{1,2}):(\d{2})/);
  if (englishDate) {
    const [, day, monthName, year, hour, minute] = englishDate;
    const month = monthIndexes.get(monthName.toLowerCase());
    if (month !== undefined) {
      const parsed = new Date(Number(year), month, Number(day), Number(hour), Number(minute));
      if (!Number.isNaN(parsed.valueOf())) return parsed.toISOString();
    }
  }

  return nowIso();
}

function parseExportBlock(block) {
  const lines = String(block || "").replace(/\r\n/g, "\n").replace(/\r/g, "\n").split("\n");
  const createdMatch = /^Created:\s*(.*)$/i.exec(lines[0] || "");
  if (!createdMatch || !lines[1]) {
    throw new Error("This file does not match the Draft Diff text format.");
  }

  const bodyLines = lines.slice(2);
  if (bodyLines[0] === "") bodyLines.shift();
  const content = bodyLines.join("\n").replace(/\n+$/g, "");

  return {
    title: lines[1].trim() || "Untitled",
    createdAt: parseCreatedAt(createdMatch[1]),
    content: content === "[No text yet]" ? "" : content
  };
}

function preservedFormat(previousPage) {
  return previousPage?.format ? { ...normalizeFormat(previousPage.format) } : { ...DEFAULT_FORMAT };
}

function pageFromImportedBlock(block, fallbackTitle, previousPage = null) {
  const title = block?.title || fallbackTitle;
  const content = block?.content || "";
  return {
    id: previousPage?.id || makeId("page"),
    title,
    createdAt: block?.createdAt || nowIso(),
    content,
    contentHtml: textToHtml(content),
    format: preservedFormat(previousPage)
  };
}

function stateFromExportText(text, previousState = null) {
  const blocks = String(text || "")
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .split(/\n{2}[ \t]*---[ \t]*\n{2}/g)
    .map(block => block.replace(/^\n+|\n+$/g, ""))
    .filter(block => block.trim());

  if (!blocks.length) throw new Error("This file is empty.");

  const pages = blocks.map(parseExportBlock);
  const storyIndex = pages.findIndex(page => {
    const title = page.title.toLowerCase();
    return title === "project notes" || title === "story notes";
  });
  const storyBlock = pages[storyIndex >= 0 ? storyIndex : 0];
  const createdAt = storyBlock.createdAt || nowIso();
  const afterStory = pages.slice((storyIndex >= 0 ? storyIndex : 0) + 1);
  const drafts = [];

  for (let index = 0; index < afterStory.length; index += 1) {
    const draftBlock = afterStory[index];
    if (!draftBlock || /\snotes$/i.test(draftBlock.title)) continue;

    let notesBlock = null;
    const nextBlock = afterStory[index + 1];
    if (nextBlock && (
      nextBlock.title.toLowerCase() === `${draftBlock.title} notes`.toLowerCase() ||
      /\snotes$/i.test(nextBlock.title)
    )) {
      notesBlock = nextBlock;
      index += 1;
    }

    const draftNumber = drafts.length + 1;
    const previousDraft = previousState?.drafts?.[draftNumber - 1] || null;
    const draft = pageFromImportedBlock(draftBlock, `Draft ${draftNumber}`, previousDraft);
    const notes = pageFromImportedBlock(notesBlock, `${draft.title} Notes`, previousDraft?.notes);
    notes.id = previousDraft?.notes?.id || makeId("notes");
    notes.title = `${draft.title} Notes`;
    drafts.push({
      ...draft,
      id: previousDraft?.id || makeId("draft"),
      notes
    });
  }

  if (!drafts.length) drafts.push(createDraft(null, 1));

  return {
    version: 1,
    formatDefaultVersion: FORMAT_DEFAULT_VERSION,
    defaultFormat: currentDefaultFormat(previousState),
    createdAt,
    updatedAt: nowIso(),
    initialNotes: {
      ...pageFromImportedBlock(storyBlock, PROJECT_NOTES_TITLE, previousState?.initialNotes),
      id: "initial-notes",
      title: PROJECT_NOTES_TITLE
    },
    drafts
  };
}

function setEditorHtml(editorEl, html) {
  const sanitized = sanitizeRichHtml(html);
  if (editorEl.innerHTML !== sanitized) editorEl.innerHTML = sanitized;
}

function applyEditorFormat(editorEl, format) {
  const normalized = normalizeFormat(format);
  editorEl.style.fontFamily = normalized.fontFamily;
  editorEl.style.fontSize = `${normalized.fontSize}px`;
}

function syncToolbarValues(editorKey) {
  const page = pageForEditorKey(editorKey);
  const toolbar = toolbarForEditor(editorKey);
  if (!page || !toolbar) return;

  ensurePageFields(page);
  toolbar.querySelectorAll("[data-page-format]").forEach(control => {
    const field = control.dataset.pageFormat;
    control.value = page.format[field];
  });
  toolbar.querySelectorAll("[data-page-format-picker]").forEach(picker => {
    const field = picker.dataset.pageFormatPicker;
    const value = page.format[field];
    const valueText = picker.querySelector("[data-format-value]");
    const toggle = picker.querySelector("[data-format-toggle]");

    picker.dataset.value = value;
    if (valueText) valueText.textContent = value;
    if (toggle) toggle.setAttribute("aria-label", `${toggle.title}: ${value}`);
    picker.querySelectorAll("[data-format-option]").forEach(option => {
      option.setAttribute("aria-selected", String(option.dataset.formatOption === value));
    });
  });
}

function editablePages(projectState = state) {
  if (!projectState) return [];

  const pages = [];
  if (projectState.initialNotes) pages.push(projectState.initialNotes);
  projectState.drafts?.forEach(draft => {
    if (!draft) return;
    pages.push(draft);
    if (draft.notes) pages.push(draft.notes);
  });
  return pages;
}

function sharedPageFormatValue(field) {
  const pages = editablePages();
  if (!pages.length) return currentDefaultFormat(state)[field];

  const values = new Set(pages.map(page => {
    ensurePageFields(page);
    return page.format[field];
  }));
  return values.size === 1 ? values.values().next().value : "";
}

function globalFormatOptions(values) {
  return [
    '<option value="" disabled>Mixed</option>',
    ...values.map(value => `<option value="${escapeHtml(value)}">${escapeHtml(value)}</option>`)
  ].join("");
}

function populateGlobalFormatControls() {
  if (els.editGlobalFont) els.editGlobalFont.innerHTML = globalFormatOptions(FONT_FAMILY_OPTIONS);
  if (els.editGlobalFontSize) els.editGlobalFontSize.innerHTML = globalFormatOptions(FONT_SIZE_OPTIONS);
}

function syncGlobalFormatControls() {
  if (els.editGlobalFont) els.editGlobalFont.value = sharedPageFormatValue("fontFamily");
  if (els.editGlobalFontSize) els.editGlobalFontSize.value = sharedPageFormatValue("fontSize");
}

function syncRichPage(page, editorEl) {
  ensurePageFields(page);
  page.contentHtml = sanitizeRichHtml(editorEl.innerHTML);
  page.content = editorPlainText(editorEl);
  page.format = normalizeFormat(page.format);
}

function splitLines(text) {
  if (!text) return [];
  return text.replace(/\r\n/g, "\n").replace(/\r/g, "\n").split("\n");
}

function isDiffSequenceWordText(text) {
  return /^[\p{L}\p{N}]+$/u.test(text || "");
}

function isDiffSequenceWhitespaceText(text) {
  return /^\s+$/u.test(text || "");
}

function previousSameWordIndex(parts, index) {
  for (let current = index - 1; current >= 0; current -= 1) {
    if (parts[current].type === "same" && isDiffSequenceWordText(parts[current].text)) return current;
  }

  return -1;
}

function nextSameWordIndex(parts, index) {
  for (let current = index + 1; current < parts.length; current += 1) {
    if (parts[current].type === "same" && isDiffSequenceWordText(parts[current].text)) return current;
    if (parts[current].type !== "same") return -1;
  }

  return -1;
}

function changedWordCounts(parts, start, end) {
  const counts = { added: 0, removed: 0 };

  for (let index = start; index < end; index += 1) {
    const part = parts[index];
    if ((part.type === "added" || part.type === "removed") && isDiffSequenceWordText(part.text)) {
      counts[part.type] += 1;
    }
  }

  return counts;
}

function shouldCoalesceReplacementSegment(segment) {
  const counts = changedWordCounts(segment, 0, segment.length);
  return counts.added >= 2 && counts.removed >= 2 && counts.added + counts.removed <= 12;
}

function isChangedDiffPart(part) {
  return part?.type === "added" || part?.type === "removed";
}

function sameWordCount(parts) {
  return parts.filter(part => part.type === "same" && isDiffSequenceWordText(part.text)).length;
}

function wordTokenCount(parts) {
  return parts.filter(part => isDiffSequenceWordText(part.text)).length;
}

function coerceDiffPartType(part, type) {
  return {
    ...part,
    type,
    beforeIndex: type === "removed" ? part.beforeIndex : undefined,
    afterIndex: type === "added" ? part.afterIndex : undefined
  };
}

function coalesceReplacementSegment(segment) {
  const removed = [];
  const added = [];
  const neutral = [];
  let sawRemoved = false;
  let sawAdded = false;

  segment.forEach(part => {
    if (part.type === "removed") {
      removed.push(part);
      if (isDiffSequenceWordText(part.text)) sawRemoved = true;
      return;
    }

    if (part.type === "added") {
      added.push(part);
      if (isDiffSequenceWordText(part.text)) sawAdded = true;
      return;
    }

    if (part.type === "same" && isDiffSequenceWhitespaceText(part.text)) {
      if (sawRemoved) removed.push(coerceDiffPartType(part, "removed"));
      if (sawAdded) added.push(coerceDiffPartType(part, "added"));
      return;
    }

    neutral.push(part);
  });

  return [...removed, ...added, ...neutral];
}

function coalesceInterleavedReplacementWindow(segment) {
  const removed = [];
  const added = [];

  segment.forEach(part => {
    if (part.type === "removed") {
      removed.push(part);
      return;
    }

    if (part.type === "added") {
      added.push(part);
      return;
    }

    if (part.type !== "same") return;

    removed.push(coerceDiffPartType(part, "removed"));
    added.push(coerceDiffPartType(part, "added"));
  });

  return [...removed, ...added];
}

function shouldCoalesceInterleavedReplacementWindow(segment) {
  const counts = changedWordCounts(segment, 0, segment.length);
  const anchors = sameWordCount(segment);
  if (counts.added < 3 || counts.removed < 3) return false;

  const words = wordTokenCount(segment);
  if (words > 18) return false;

  const changedWords = counts.added + counts.removed;
  if (!anchors) return changedWords / words >= 0.75;

  if (anchors > 5) return false;
  return changedWords / words >= 0.55;
}

function changedWordTypes(segment) {
  return segment
    .filter(part => isChangedDiffPart(part) && isDiffSequenceWordText(part.text))
    .map(part => part.type);
}

function changedWordInfos(segment) {
  return segment
    .map((part, index) => ({ part, index }))
    .filter(({ part }) => isChangedDiffPart(part) && isDiffSequenceWordText(part.text))
    .map(({ part, index }) => ({ type: part.type, index }));
}

function changedTypesAreCoalescableAlternation(types) {
  if (types.length < 6) return false;

  const added = types.filter(type => type === "added").length;
  const removed = types.length - added;
  if (added < 3 || removed < 3) return false;

  return types.every((type, index) => index === 0 || type !== types[index - 1]);
}

function shouldCoalesceAlternatingChangedWords(segment) {
  return changedTypesAreCoalescableAlternation(changedWordTypes(segment));
}

function alternatingChangedWordRunBounds(segment) {
  const infos = changedWordInfos(segment);
  if (infos.length < 6) return null;

  let best = null;
  let runStart = 0;
  const considerRun = end => {
    const run = infos.slice(runStart, end);
    const types = run.map(info => info.type);
    if (!changedTypesAreCoalescableAlternation(types)) return;

    if (!best || run.length > best.wordCount) {
      best = {
        start: run[0].index,
        end: run[run.length - 1].index + 1,
        wordCount: run.length
      };
    }
  };

  for (let index = 1; index <= infos.length; index += 1) {
    if (index === infos.length || infos[index].type === infos[index - 1].type) {
      considerRun(index);
      runStart = index;
    }
  }

  return best;
}

function coalesceAlternatingChangedWordRun(segment) {
  const bounds = alternatingChangedWordRunBounds(segment);
  if (!bounds) return segment;

  return [
    ...segment.slice(0, bounds.start),
    ...coalesceInterleavedReplacementWindow(segment.slice(bounds.start, bounds.end)),
    ...coalesceAlternatingChangedWordRun(segment.slice(bounds.end))
  ];
}

function coalesceAlternatingChangedWordSubsegments(segment) {
  const coalesced = [];
  let start = 0;

  for (let index = 0; index <= segment.length; index += 1) {
    const isBoundary = index === segment.length || segment[index].text === "\n";
    if (!isBoundary) continue;

    coalesced.push(...coalesceAlternatingChangedWordRun(segment.slice(start, index)));

    if (index < segment.length) coalesced.push(segment[index]);
    start = index + 1;
  }

  return coalesced;
}

function coalesceAlternatingChangedWordSegments(parts) {
  const coalesced = [];
  let index = 0;

  while (index < parts.length) {
    if (parts[index].type === "same" && isDiffSequenceWordText(parts[index].text)) {
      coalesced.push(parts[index]);
      index += 1;
      continue;
    }

    const segmentStart = index;
    while (
      index < parts.length &&
      !(parts[index].type === "same" && isDiffSequenceWordText(parts[index].text))
    ) {
      index += 1;
    }

    coalesced.push(...coalesceAlternatingChangedWordSubsegments(parts.slice(segmentStart, index)));
  }

  return coalesced;
}

function coalesceInterleavedReplacementSubsegment(segment) {
  const firstChanged = segment.findIndex(isChangedDiffPart);
  if (firstChanged < 0) return segment;

  let lastChanged = -1;
  for (let index = segment.length - 1; index >= firstChanged; index -= 1) {
    if (isChangedDiffPart(segment[index])) {
      lastChanged = index;
      break;
    }
  }

  const replacementWindow = segment.slice(firstChanged, lastChanged + 1);
  if (!shouldCoalesceInterleavedReplacementWindow(replacementWindow)) return segment;

  return [
    ...segment.slice(0, firstChanged),
    ...coalesceInterleavedReplacementWindow(replacementWindow),
    ...segment.slice(lastChanged + 1)
  ];
}

function coalesceInterleavedReplacementSegments(parts) {
  const coalesced = [];
  let start = 0;

  for (let index = 0; index <= parts.length; index += 1) {
    const isBoundary = index === parts.length || parts[index].text === "\n";
    if (!isBoundary) continue;

    coalesced.push(...coalesceInterleavedReplacementSubsegment(parts.slice(start, index)));
    if (index < parts.length) coalesced.push(parts[index]);
    start = index + 1;
  }

  return coalesced;
}

function coalesceReplacementSubsegments(segment) {
  const coalesced = [];
  let start = 0;

  for (let index = 0; index <= segment.length; index += 1) {
    const isBoundary = index === segment.length || segment[index].text === "\n";
    if (!isBoundary) continue;

    const subsegment = segment.slice(start, index);
    if (shouldCoalesceReplacementSegment(subsegment)) {
      coalesced.push(...coalesceReplacementSegment(subsegment));
    } else {
      coalesced.push(...subsegment);
    }

    if (index < segment.length) coalesced.push(segment[index]);
    start = index + 1;
  }

  return coalesced;
}

function coalesceReplacementSegments(parts) {
  const coalesced = [];
  let index = 0;

  while (index < parts.length) {
    const part = parts[index];

    if (part.type !== "same" || !isDiffSequenceWordText(part.text)) {
      const segmentStart = index;
      while (
        index < parts.length &&
        !(parts[index].type === "same" && isDiffSequenceWordText(parts[index].text))
      ) {
        index += 1;
      }

      coalesced.push(...coalesceReplacementSubsegments(parts.slice(segmentStart, index)));
      continue;
    }

    coalesced.push(part);
    index += 1;

    const segmentStart = index;
    while (
      index < parts.length &&
      !(parts[index].type === "same" && isDiffSequenceWordText(parts[index].text))
    ) {
      index += 1;
    }

    const segment = parts.slice(segmentStart, index);
    coalesced.push(...coalesceReplacementSubsegments(segment));
  }

  return coalesced;
}

function diffPartKey(part) {
  const marks = part?.marks || {};
  return [
    part?.text || "",
    marks.bold ? "b" : "",
    marks.italic ? "i" : "",
    marks.underline ? "u" : "",
    marks.strike ? "s" : ""
  ].join("|");
}

function diffChangedTokenRun(before, after) {
  const rows = Array.from({ length: before.length + 1 }, () => Array(after.length + 1).fill(0));

  for (let i = before.length - 1; i >= 0; i -= 1) {
    for (let j = after.length - 1; j >= 0; j -= 1) {
      rows[i][j] = diffPartKey(before[i]) === diffPartKey(after[j])
        ? rows[i + 1][j + 1] + 1
        : Math.max(rows[i + 1][j], rows[i][j + 1]);
    }
  }

  const result = [];
  let i = 0;
  let j = 0;

  while (i < before.length && j < after.length) {
    if (diffPartKey(before[i]) === diffPartKey(after[j])) {
      result.push({
        ...after[j],
        type: "same",
        beforeIndex: before[i].beforeIndex,
        afterIndex: after[j].afterIndex
      });
      i += 1;
      j += 1;
    } else if (rows[i + 1][j] >= rows[i][j + 1]) {
      result.push(before[i]);
      i += 1;
    } else {
      result.push(after[j]);
      j += 1;
    }
  }

  while (i < before.length) {
    result.push(before[i]);
    i += 1;
  }

  while (j < after.length) {
    result.push(after[j]);
    j += 1;
  }

  return result;
}

function sameDiffPartFromChangedPair(removedPart, addedPart) {
  return {
    ...addedPart,
    type: "same",
    marks: addedPart.marks || removedPart.marks || {},
    beforeIndex: removedPart.beforeIndex,
    afterIndex: addedPart.afterIndex
  };
}

function changedRunContentCount(parts) {
  return parts.filter(part => String(part.text || "").trim()).length;
}

function isMeaningfulCommonChangedRun(parts) {
  if (!parts.length) return false;
  const wordCount = parts.filter(part => isDiffSequenceWordText(part.text)).length;
  return wordCount >= 1;
}

function commonChangedPrefixLength(removed, added) {
  let length = 0;
  while (
    length < removed.length &&
    length < added.length &&
    diffPartKey(removed[length]) === diffPartKey(added[length])
  ) {
    length += 1;
  }
  return length;
}

function commonChangedSuffixLength(removed, added, prefixLength) {
  let length = 0;
  while (
    length < removed.length - prefixLength &&
    length < added.length - prefixLength &&
    diffPartKey(removed[removed.length - 1 - length]) === diffPartKey(added[added.length - 1 - length])
  ) {
    length += 1;
  }
  return length;
}

function restoreCommonChangedAffixes(segment) {
  const removed = segment.filter(part => part.type === "removed");
  const added = segment.filter(part => part.type === "added");
  if (!removed.length || !added.length) return segment;

  let prefixLength = commonChangedPrefixLength(removed, added);
  if (!isMeaningfulCommonChangedRun(removed.slice(0, prefixLength))) prefixLength = 0;

  let suffixLength = commonChangedSuffixLength(removed, added, prefixLength);
  if (!isMeaningfulCommonChangedRun(removed.slice(removed.length - suffixLength))) suffixLength = 0;

  if (!prefixLength && !suffixLength) return segment;

  const prefix = removed
    .slice(0, prefixLength)
    .map((part, index) => sameDiffPartFromChangedPair(part, added[index]));
  const suffixRemovedStart = removed.length - suffixLength;
  const suffixAddedStart = added.length - suffixLength;
  const suffix = removed
    .slice(suffixRemovedStart)
    .map((part, index) => sameDiffPartFromChangedPair(part, added[suffixAddedStart + index]));

  return [
    ...prefix,
    ...removed.slice(prefixLength, suffixRemovedStart),
    ...added.slice(prefixLength, suffixAddedStart),
    ...suffix
  ];
}

function shouldRestoreChangedTokenRun(segment) {
  const changedParts = segment.filter(part => part.type === "added" || part.type === "removed");
  if (!changedParts.some(part => part.type === "added")) return false;
  if (!changedParts.some(part => part.type === "removed")) return false;
  if (segment.some(part => part.type === "same")) return false;
  return changedParts.every(part => !isDiffSequenceWordText(part.text));
}

function restoreIdenticalChangedTokens(parts) {
  const restored = [];
  let index = 0;

  while (index < parts.length) {
    if (parts[index].type === "same") {
      restored.push(parts[index]);
      index += 1;
      continue;
    }

    const segmentStart = index;
    while (
      index < parts.length &&
      parts[index].type !== "same"
    ) {
      index += 1;
    }

    const segment = parts.slice(segmentStart, index);
    const affixRestored = restoreCommonChangedAffixes(segment);
    if (affixRestored !== segment) {
      restored.push(...affixRestored);
      continue;
    }

    if (!shouldRestoreChangedTokenRun(segment)) {
      restored.push(...segment);
      continue;
    }

    restored.push(...diffChangedTokenRun(
      segment.filter(part => part.type === "removed"),
      segment.filter(part => part.type === "added")
    ));
  }

  return restored;
}

function shouldAbsorbWeakReplacementAnchor(parts, index) {
  const part = parts[index];
  if (part?.type !== "same" || !isDiffSequenceWordText(part.text)) return false;

  const previousIndex = previousSameWordIndex(parts, index);
  const followingIndex = nextSameWordIndex(parts, index);
  if (previousIndex < 0 || followingIndex < 0) return false;

  const counts = changedWordCounts(parts, previousIndex + 1, index);
  return counts.added >= 2 && counts.removed >= 2 && counts.added + counts.removed <= 10;
}

function cleanupWeakReplacementAnchors(parts) {
  const absorbIndexes = new Set();

  parts.forEach((part, index) => {
    if (!shouldAbsorbWeakReplacementAnchor(parts, index)) return;
    absorbIndexes.add(index);

    for (let current = index + 1; current < parts.length; current += 1) {
      if (parts[current].type !== "same" || !isDiffSequenceWhitespaceText(parts[current].text)) break;
      absorbIndexes.add(current);
    }
  });

  const absorbedParts = absorbIndexes.size ? parts.map((part, index) => {
    if (!absorbIndexes.has(index)) return part;
    return {
      ...part,
      type: "added",
      beforeIndex: undefined
    };
  }) : parts;

  return restoreIdenticalChangedTokens(coalesceReplacementSegments(
    coalesceInterleavedReplacementSegments(
      coalesceAlternatingChangedWordSegments(absorbedParts)
    )
  ));
}

function diffSequence(before, after) {
  const rows = Array.from({ length: before.length + 1 }, () => Array(after.length + 1).fill(0));

  for (let i = before.length - 1; i >= 0; i -= 1) {
    for (let j = after.length - 1; j >= 0; j -= 1) {
      rows[i][j] = before[i].key === after[j].key
        ? rows[i + 1][j + 1] + 1
        : Math.max(rows[i + 1][j], rows[i][j + 1]);
    }
  }

  const result = [];
  let i = 0;
  let j = 0;

  while (i < before.length && j < after.length) {
    if (before[i].key === after[j].key) {
      result.push({
        type: "same",
        text: after[j].text,
        marks: after[j].marks || before[i].marks || {},
        beforeIndex: before[i].index ?? i,
        afterIndex: after[j].index ?? j
      });
      i += 1;
      j += 1;
    } else if (rows[i + 1][j] >= rows[i][j + 1]) {
      result.push({
        type: "removed",
        text: before[i].text,
        marks: before[i].marks || {},
        beforeIndex: before[i].index ?? i
      });
      i += 1;
    } else {
      result.push({
        type: "added",
        text: after[j].text,
        marks: after[j].marks || {},
        afterIndex: after[j].index ?? j
      });
      j += 1;
    }
  }

  while (i < before.length) {
    result.push({
      type: "removed",
      text: before[i].text,
      marks: before[i].marks || {},
      beforeIndex: before[i].index ?? i
    });
    i += 1;
  }

  while (j < after.length) {
    result.push({
      type: "added",
      text: after[j].text,
      marks: after[j].marks || {},
      afterIndex: after[j].index ?? j
    });
    j += 1;
  }

  return cleanupWeakReplacementAnchors(result);
}

function tokenizeSegment(text, marks = {}) {
  const normalized = String(text || "").replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  const matches = normalized.match(/\n|[^\S\n]+|[\p{L}\p{N}]+|[^\s\p{L}\p{N}]/gu) || [];
  const semanticKey = marks.whitespace ? "" : `${marks.bold ? "b" : ""}${marks.italic ? "i" : ""}${marks.underline ? "u" : ""}${marks.strike ? "s" : ""}`;
  return matches.map(token => ({
    key: /^\s+$/u.test(token)
      ? token
      : `${token}|${semanticKey}`,
    text: token,
    marks: { ...marks },
    isWhitespace: /^\s+$/u.test(token)
  }));
}

function semanticTokensFromHtml(html) {
  const template = document.createElement("template");
  template.innerHTML = sanitizeRichHtml(html);
  const tokens = [];
  const blockTags = new Set(["div", "p", "blockquote", "li", "ul", "ol"]);
  const paragraphTags = new Set(["p", "blockquote"]);

  const addNewline = (marks, options = {}) => {
    if (!tokens.length) return;

    if (options.preserveBlankLine) {
      tokens.push(...tokenizeSegment("\n", marks));
      return;
    }

    const count = options.count || 1;
    let trailing = 0;
    for (let index = tokens.length - 1; index >= 0 && tokens[index].text === "\n"; index -= 1) {
      trailing += 1;
    }

    while (trailing < count) {
      tokens.push(...tokenizeSegment("\n", marks));
      trailing += 1;
    }
  };

  const normalizedTextNodeValue = node => {
    let text = node.nodeValue.replace(/\u00a0/g, " ");
    if (!text.includes("\n")) return text;

    const siblings = node.parentNode ? Array.from(node.parentNode.childNodes) : [];
    const hasElementSibling = siblings.some(sibling => sibling.nodeType === Node.ELEMENT_NODE);
    if (!hasElementSibling) return text;
    if (!text.trim()) return "";

    return text
      .replace(/^[ \t]*\n[ \t]*/u, "")
      .replace(/[ \t]*\n[ \t]*$/u, "");
  };

  const walk = (node, marks = {}) => {
    if (node.nodeType === Node.TEXT_NODE) {
      tokens.push(...tokenizeSegment(normalizedTextNodeValue(node), marks));
      return;
    }

    if (node.nodeType !== Node.ELEMENT_NODE && node.nodeType !== Node.DOCUMENT_FRAGMENT_NODE) return;

    const tag = node.nodeType === Node.ELEMENT_NODE ? node.tagName.toLowerCase() : "";
    if (tag === "br") {
      addNewline(marks, { preserveBlankLine: true });
      return;
    }

    const nextMarks = {
      bold: marks.bold || tag === "b" || tag === "strong",
      italic: marks.italic || tag === "i" || tag === "em",
      underline: marks.underline || tag === "u",
      strike: marks.strike || tag === "s" || tag === "strike" || tag === "del"
    };

    Array.from(node.childNodes).forEach(child => walk(child, nextMarks));
    if (paragraphTags.has(tag)) {
      addNewline(marks, { count: 2 });
    } else if (blockTags.has(tag)) {
      addNewline(marks);
    }
  };

  walk(template.content);
  while (tokens.length && tokens[tokens.length - 1].text === "\n") tokens.pop();
  return tokens.map((token, index) => ({ ...token, index }));
}

const DIFF_COMMON_WORDS = new Set([
  "a", "an", "and", "are", "as", "at", "be", "been", "but", "by", "for", "from",
  "had", "has", "have", "he", "her", "his", "i", "in", "is", "it", "its", "me",
  "my", "not", "of", "on", "or", "our", "she", "so", "that", "the", "their",
  "them", "then", "there", "they", "this", "to", "was", "we", "were", "with",
  "you", "your"
]);

const DIFF_CLAUSE_STARTERS = new Set([
  "and", "but", "or", "so", "then", "yet", "though", "although", "because",
  "while", "when", "where", "who", "which", "that", "one", "two", "some",
  "couple", "another", "other", "others", "going", "no", "i", "he", "she",
  "they", "we", "it", "the", "there", "this"
]);

const DIFF_BOUNDARY_CONJUNCTIONS = new Set([
  "and", "but", "or", "so", "yet"
]);

const DIFF_LONG_COMMA_CLAUSE_MIN_TERMS = 4;
const DIFF_LONG_CONJUNCTION_CLAUSE_MIN_TERMS = 4;

function isDiffWordToken(token) {
  return /^[\p{L}\p{N}]+$/u.test(token?.text || "");
}

function diffTermForToken(token) {
  return String(token?.text || "").toLowerCase();
}

function comparableDiffTerm(term) {
  return String(term || "").replace(/[^\p{L}\p{N}]+/gu, "").toLowerCase();
}

function diffTermsMatch(left, right) {
  if (left === right) return true;

  const normalizedLeft = comparableDiffTerm(left);
  const normalizedRight = comparableDiffTerm(right);
  return Boolean(
    normalizedLeft &&
    normalizedRight &&
    normalizedLeft === normalizedRight
  );
}

function meaningfulTermsForTokens(tokens) {
  const terms = tokens
    .filter(isDiffWordToken)
    .map(diffTermForToken)
    .filter(term => term.length > 1 && !DIFF_COMMON_WORDS.has(term));

  if (terms.length) return terms;

  return tokens
    .filter(isDiffWordToken)
    .map(diffTermForToken)
    .filter(term => term.length > 1);
}

function isDiffClauseDashToken(token) {
  const text = token?.text || "";
  return text === "\u2014" || text === "\u2013";
}

function splitDiffBlocks(tokens) {
  const blocks = [];
  let current = [];
  let pendingSentenceBoundary = false;
  const closingPunctuation = new Set([")", "]", "}", "\"", "'", "”", "’"]);

  const flush = () => {
    if (!current.length) return;
    if (current.some(token => String(token.text || "").trim() || token.text === "\n")) {
      blocks.push(current);
    }
    current = [];
    pendingSentenceBoundary = false;
  };

  const shouldSplitAfterComma = index => {
    let nextWord = "";
    const clauseTokens = [];

    for (let nextIndex = index + 1; nextIndex < tokens.length; nextIndex += 1) {
      const nextToken = tokens[nextIndex];
      if (nextToken.text === "\n") return true;
      if (/[.!?:;]/u.test(nextToken.text || "") || nextToken.text === "," || isDiffClauseDashToken(nextToken)) break;
      clauseTokens.push(nextToken);
      if (/^\s+$/u.test(nextToken.text || "")) continue;
      if (!isDiffWordToken(nextToken)) break;
      if (!nextWord) nextWord = diffTermForToken(nextToken);
    }

    return Boolean(
      nextWord &&
      (
        DIFF_CLAUSE_STARTERS.has(nextWord) ||
        meaningfulTermsForTokens(clauseTokens).length >= DIFF_LONG_COMMA_CLAUSE_MIN_TERMS
      )
    );
  };

  const shouldSplitAfterConjunction = index => {
    if (!isDiffWordToken(tokens[index])) return false;
    if (!DIFF_BOUNDARY_CONJUNCTIONS.has(diffTermForToken(tokens[index]))) return false;

    let nextWord = "";
    const clauseTokens = [];

    for (let nextIndex = index + 1; nextIndex < tokens.length; nextIndex += 1) {
      const nextToken = tokens[nextIndex];
      if (nextToken.text === "\n") break;
      if (/[.!?:;]/u.test(nextToken.text || "") || nextToken.text === "," || isDiffClauseDashToken(nextToken)) break;
      clauseTokens.push(nextToken);
      if (/^\s+$/u.test(nextToken.text || "")) continue;
      if (!isDiffWordToken(nextToken)) break;
      if (!nextWord) nextWord = diffTermForToken(nextToken);
    }

    return Boolean(
      nextWord &&
      meaningfulTermsForTokens(clauseTokens).length >= DIFF_LONG_CONJUNCTION_CLAUSE_MIN_TERMS
    );
  };

  tokens.forEach((token, index) => {
    const isWhitespace = /^\s+$/u.test(token.text || "");
    if (token.text === "(" && current.some(currentToken => String(currentToken.text || "").trim())) flush();
    if (pendingSentenceBoundary && !isWhitespace && !closingPunctuation.has(token.text)) flush();

    current.push(token);

    if (token.text === "\n") {
      flush();
    } else if (
      /[.!?:;]/u.test(token.text || "") ||
      isDiffClauseDashToken(token) ||
      (token.text === "," && shouldSplitAfterComma(index)) ||
      shouldSplitAfterConjunction(index)
    ) {
      pendingSentenceBoundary = true;
    }
  });

  flush();
  return blocks;
}

function blockSimilarity(beforeBlock, afterBlock) {
  const beforeTerms = meaningfulTermsForTokens(beforeBlock);
  const afterTerms = meaningfulTermsForTokens(afterBlock);
  if (!beforeTerms.length || !afterTerms.length) return 0;

  const availableBeforeTerms = [...beforeTerms];

  let shared = 0;
  afterTerms.forEach(term => {
    const matchedIndex = availableBeforeTerms.findIndex(beforeTerm => diffTermsMatch(beforeTerm, term));
    if (matchedIndex < 0) return;
    shared += 1;
    availableBeforeTerms.splice(matchedIndex, 1);
  });

  if (!shared) return 0;

  return (2 * shared) / (beforeTerms.length + afterTerms.length);
}

function shouldAlignBlocks(beforeBlock, afterBlock) {
  const beforeTerms = meaningfulTermsForTokens(beforeBlock);
  const afterTerms = meaningfulTermsForTokens(afterBlock);
  const shorterLength = Math.min(beforeTerms.length, afterTerms.length);
  if (!shorterLength) return false;

  const similarity = blockSimilarity(beforeBlock, afterBlock);
  const threshold = shorterLength <= 2 ? 0.5 : shorterLength <= 3 ? 0.42 : 0.38;
  return similarity >= threshold;
}

function alignDiffBlocks(beforeBlocks, afterBlocks) {
  const rows = Array.from(
    { length: beforeBlocks.length + 1 },
    () => Array(afterBlocks.length + 1).fill(0)
  );
  const similarities = Array.from(
    { length: beforeBlocks.length },
    () => Array(afterBlocks.length).fill(0)
  );

  for (let i = beforeBlocks.length - 1; i >= 0; i -= 1) {
    for (let j = afterBlocks.length - 1; j >= 0; j -= 1) {
      const similarity = shouldAlignBlocks(beforeBlocks[i], afterBlocks[j])
        ? blockSimilarity(beforeBlocks[i], afterBlocks[j])
        : 0;
      similarities[i][j] = similarity;
      rows[i][j] = Math.max(
        rows[i + 1][j],
        rows[i][j + 1],
        similarity ? similarity + rows[i + 1][j + 1] : 0
      );
    }
  }

  const pairs = [];
  let i = 0;
  let j = 0;
  while (i < beforeBlocks.length && j < afterBlocks.length) {
    const similarity = similarities[i][j];
    const matchScore = similarity ? similarity + rows[i + 1][j + 1] : -1;
    if (similarity && matchScore >= rows[i + 1][j] && matchScore >= rows[i][j + 1]) {
      pairs.push([i, j]);
      i += 1;
      j += 1;
    } else if (rows[i + 1][j] >= rows[i][j + 1]) {
      i += 1;
    } else {
      j += 1;
    }
  }

  return pairs;
}

function flattenDiffBlockRange(blocks, start, end) {
  return blocks.slice(start, end).flat();
}

function diffBlockRangeSimilarity(beforeBlocks, afterBlocks, range) {
  return blockSimilarity(
    flattenDiffBlockRange(beforeBlocks, range.beforeStart, range.beforeEnd),
    flattenDiffBlockRange(afterBlocks, range.afterStart, range.afterEnd)
  );
}

function shouldExpandDiffBlockRange(currentSimilarity, candidateSimilarity) {
  const improvement = candidateSimilarity - currentSimilarity;
  if (candidateSimilarity >= 0.9 && improvement >= 0.02) return true;
  if (candidateSimilarity >= 0.68 && improvement >= 0.05) return true;
  return currentSimilarity < 0.62 && improvement >= 0.1;
}

function diffBlockHasMeaningfulTerms(block) {
  return meaningfulTermsForTokens(block).length > 0;
}

function previousDiffExpansionStart(blocks, start, limit) {
  let candidateStart = start - 1;
  while (candidateStart > limit && !diffBlockHasMeaningfulTerms(blocks[candidateStart])) {
    candidateStart -= 1;
  }
  return candidateStart;
}

function nextDiffExpansionEnd(blocks, end, limit) {
  let candidateEnd = end + 1;
  while (candidateEnd < limit && !diffBlockHasMeaningfulTerms(blocks[candidateEnd - 1])) {
    candidateEnd += 1;
  }
  return candidateEnd;
}

function expandDiffBlockPairs(pairs, beforeBlocks, afterBlocks) {
  const ranges = pairs.map(([beforeIndex, afterIndex]) => ({
    beforeStart: beforeIndex,
    beforeEnd: beforeIndex + 1,
    afterStart: afterIndex,
    afterEnd: afterIndex + 1
  }));

  let changed = true;
  let guard = beforeBlocks.length + afterBlocks.length;

  while (changed && guard > 0) {
    changed = false;
    guard -= 1;

    ranges.forEach((range, index) => {
      const prevBeforeLimit = index > 0 ? ranges[index - 1].beforeEnd : 0;
      const prevAfterLimit = index > 0 ? ranges[index - 1].afterEnd : 0;
      const nextBeforeLimit = index + 1 < ranges.length ? ranges[index + 1].beforeStart : beforeBlocks.length;
      const nextAfterLimit = index + 1 < ranges.length ? ranges[index + 1].afterStart : afterBlocks.length;
      const currentSimilarity = diffBlockRangeSimilarity(beforeBlocks, afterBlocks, range);
      let bestRange = null;
      let bestSimilarity = currentSimilarity;

      const candidates = [];
      if (range.beforeStart > prevBeforeLimit) {
        candidates.push({
          ...range,
          beforeStart: previousDiffExpansionStart(beforeBlocks, range.beforeStart, prevBeforeLimit)
        });
      }
      if (range.afterStart > prevAfterLimit) {
        candidates.push({
          ...range,
          afterStart: previousDiffExpansionStart(afterBlocks, range.afterStart, prevAfterLimit)
        });
      }
      if (range.beforeEnd < nextBeforeLimit) {
        candidates.push({
          ...range,
          beforeEnd: nextDiffExpansionEnd(beforeBlocks, range.beforeEnd, nextBeforeLimit)
        });
      }
      if (range.afterEnd < nextAfterLimit) {
        candidates.push({
          ...range,
          afterEnd: nextDiffExpansionEnd(afterBlocks, range.afterEnd, nextAfterLimit)
        });
      }

      candidates.forEach(candidate => {
        const candidateSimilarity = diffBlockRangeSimilarity(beforeBlocks, afterBlocks, candidate);
        if (
          candidateSimilarity > bestSimilarity &&
          shouldExpandDiffBlockRange(currentSimilarity, candidateSimilarity)
        ) {
          bestRange = candidate;
          bestSimilarity = candidateSimilarity;
        }
      });

      if (bestRange) {
        range.beforeStart = bestRange.beforeStart;
        range.beforeEnd = bestRange.beforeEnd;
        range.afterStart = bestRange.afterStart;
        range.afterEnd = bestRange.afterEnd;
        changed = true;
      }
    });
  }

  return ranges;
}

function diffUnmatchedBlock(tokens, type) {
  return tokens.map(token => ({
    type,
    text: token.text,
    marks: token.marks || {},
    beforeIndex: type === "removed" ? token.index : undefined,
    afterIndex: type === "added" ? token.index : undefined
  }));
}

function diffBlocksHaveSameTokens(beforeBlock, afterBlock) {
  if (beforeBlock.length !== afterBlock.length) return false;
  return beforeBlock.every((token, index) => token.key === afterBlock[index].key);
}

function appendUnmatchedBlockGap(parts, beforeBlocks, afterBlocks, beforeStart, beforeEnd, afterStart, afterEnd) {
  let beforeIndex = beforeStart;
  let afterIndex = afterStart;

  while (beforeIndex < beforeEnd || afterIndex < afterEnd) {
    if (
      beforeIndex < beforeEnd &&
      afterIndex < afterEnd &&
      diffBlocksHaveSameTokens(beforeBlocks[beforeIndex], afterBlocks[afterIndex])
    ) {
      parts.push(...diffSequence(beforeBlocks[beforeIndex], afterBlocks[afterIndex]));
      beforeIndex += 1;
      afterIndex += 1;
      continue;
    }

    if (beforeIndex < beforeEnd) {
      parts.push(...diffUnmatchedBlock(beforeBlocks[beforeIndex], "removed"));
      beforeIndex += 1;
      continue;
    }

    parts.push(...diffUnmatchedBlock(afterBlocks[afterIndex], "added"));
    afterIndex += 1;
  }
}

function diffRichPages(beforePage, afterPage) {
  ensurePageFields(beforePage);
  ensurePageFields(afterPage);
  const beforeBlocks = splitDiffBlocks(semanticTokensFromHtml(beforePage.contentHtml));
  const afterBlocks = splitDiffBlocks(semanticTokensFromHtml(afterPage.contentHtml));
  const pairs = expandDiffBlockPairs(alignDiffBlocks(beforeBlocks, afterBlocks), beforeBlocks, afterBlocks);
  const parts = [];
  let beforeIndex = 0;
  let afterIndex = 0;

  pairs.forEach(range => {
    appendUnmatchedBlockGap(parts, beforeBlocks, afterBlocks, beforeIndex, range.beforeStart, afterIndex, range.afterStart);

    parts.push(...diffSequence(
      flattenDiffBlockRange(beforeBlocks, range.beforeStart, range.beforeEnd),
      flattenDiffBlockRange(afterBlocks, range.afterStart, range.afterEnd)
    ));
    beforeIndex = range.beforeEnd;
    afterIndex = range.afterEnd;
  });

  appendUnmatchedBlockGap(parts, beforeBlocks, afterBlocks, beforeIndex, beforeBlocks.length, afterIndex, afterBlocks.length);

  return restoreIdenticalChangedTokens(parts);
}

function countMeaningfulChanges(parts) {
  let count = 0;
  let inChange = false;

  parts.forEach(part => {
    if (part.type === "same") {
      inChange = false;
      return;
    }

    if (!inChange) {
      count += 1;
      inChange = true;
    }
  });

  return count;
}

function diffTokenStats(parts) {
  return parts.reduce((stats, part) => {
    if (part.type === "added" && part.text.trim()) stats.adds += 1;
    if (part.type === "removed" && part.text.trim()) stats.dels += 1;
    return stats;
  }, { adds: 0, dels: 0 });
}

function pairForIndexes(beforeIndex, afterIndex) {
  const previous = state.drafts[beforeIndex];
  const draft = state.drafts[afterIndex];
  return {
    before: previous,
    after: draft,
    label: `${draft.title} compared to ${previous.title}`
  };
}

function draftIndexForId(draftId) {
  return state.drafts.findIndex(draft => draft.id === draftId);
}

function renderDraftTabs() {
  els.storyTab.classList.toggle("active", !showChanges && activeArea === "story");
  els.storyDisplayToggle.checked = showChanges ? false : displayedPageKeys.has(STORY_KEY);
  els.storyDisplayToggle.disabled = showChanges;
  els.storyDisplayToggle.setAttribute("aria-label", showChanges ? "Project notes are not compared" : "Display Project notes");
  const selectedDrafts = selectedDraftDisplayCount();
  const hasDrafts = Boolean(state.drafts.length);
  const allSelected = hasDrafts && selectedDrafts === state.drafts.length;
  const partiallySelected = selectedDrafts > 0 && !allSelected;

  if (els.allDraftsTab && els.allDraftsToggle) {
    els.allDraftsTab.classList.toggle("is-partial", partiallySelected);
    els.allDraftsToggle.checked = allSelected;
    els.allDraftsToggle.indeterminate = partiallySelected;
    els.allDraftsToggle.disabled = !hasDrafts;
    els.allDraftsToggle.setAttribute("aria-label", showChanges ? "Compare all drafts" : "Display all drafts");
    els.allDraftsToggle.setAttribute("aria-checked", partiallySelected ? "mixed" : String(allSelected));
  }

  els.draftTabs.innerHTML = state.drafts.map((draft, index) => {
    const active = draft.id === selectedDraftId && activeArea !== "story" ? " active" : "";
    const checked = displayedPageKeys.has(draftContentKey(draft.id)) ? " checked" : "";
    const draftNumber = String(index + 1);
    const deleteButton = canDeleteDraft(draft)
      ? `
        <button class="delete-draft-tab" type="button" data-delete-draft-id="${draft.id}" title="Delete empty draft" aria-label="Delete ${escapeHtml(draft.title)}">
          <svg viewBox="0 0 12 12" aria-hidden="true">
            <path d="M3 3l6 6M9 3L3 9"></path>
          </svg>
        </button>
      `
      : "";
    return `
      <div class="page-tab draft-tab${active}" data-draft-tab-id="${draft.id}">
        <input type="checkbox" data-display-draft-id="${draft.id}" aria-label="${showChanges ? "Compare" : "Display"} ${escapeHtml(draft.title)}"${checked}>
        <button class="tab-label" type="button" data-draft-id="${draft.id}" aria-label="${escapeHtml(draft.title)}">
          <span class="tab-label-full">${escapeHtml(draft.title)}</span>
          <span class="tab-label-short" aria-hidden="true">${escapeHtml(draftNumber)}</span>
        </button>
        ${deleteButton}
      </div>
    `;
  }).join("");
  updateTabDensity();
}

function updateTabDensity() {
  const strip = els.storyTab?.closest(".tab-strip");
  if (!strip || !state) return;

  strip.classList.remove("compact-tabs", "scrollable-tabs");
  const needsCompactLabels = strip.scrollWidth > strip.clientWidth + 1;
  strip.classList.toggle("compact-tabs", needsCompactLabels);
  strip.classList.toggle("scrollable-tabs", strip.scrollWidth > strip.clientWidth + 1);
}

function scrollTabsToEnd() {
  const strip = els.storyTab?.closest(".tab-strip");
  if (!strip) return;

  window.requestAnimationFrame(() => {
    updateTabDensity();
    strip.scrollTo({ left: strip.scrollWidth, behavior: "auto" });
  });
}

function formatPickerHtml(field, label, values, className) {
  const defaultValue = DEFAULT_FORMAT[field];
  const options = values.map(value => `
    <button
      class="fr-picker-option"
      type="button"
      role="option"
      data-format-option="${escapeHtml(value)}"
      aria-selected="${String(value === defaultValue)}"
    >${escapeHtml(value)}</button>
  `).join("");

  return `
    <div class="fr-picker ${className}" data-page-format-picker="${escapeHtml(field)}" data-value="${escapeHtml(defaultValue)}">
      <button
        class="fr-picker-button"
        type="button"
        data-format-toggle
        title="${escapeHtml(label)}"
        aria-label="${escapeHtml(label)}: ${escapeHtml(defaultValue)}"
        aria-haspopup="listbox"
        aria-expanded="false"
      >
        <span data-format-value>${escapeHtml(defaultValue)}</span>
      </button>
      <div class="fr-picker-menu" role="listbox" aria-label="${escapeHtml(label)}">
        ${options}
      </div>
    </div>
  `;
}

function formatRibbonHtml(pageKey, label, options = {}) {
  return `
    <div
      id="format-ribbon-${escapeHtml(pageKey)}"
      class="editor-format-ribbon"
      data-toolbar-for="${escapeHtml(pageKey)}"
      aria-label="${escapeHtml(label)} formatting"
      aria-hidden="true"
    >
      <div class="fr-group">
        ${formatPickerHtml("fontFamily", "Page font", FONT_FAMILY_OPTIONS, "family")}
        ${formatPickerHtml("fontSize", "Page font size", FONT_SIZE_OPTIONS, "size")}
      </div>
      <div class="fr-group">
        <button class="fr-btn" type="button" data-command="undo" title="Undo" aria-label="Undo">${toolbarIcons.undo}</button>
        <button class="fr-btn" type="button" data-command="redo" title="Redo" aria-label="Redo">${toolbarIcons.redo}</button>
      </div>
      <div class="fr-group">
        <button class="fr-btn" type="button" data-command="bold" title="Bold" aria-label="Bold">${toolbarIcons.bold}</button>
        <button class="fr-btn" type="button" data-command="italic" title="Italic" aria-label="Italic">${toolbarIcons.italic}</button>
        <button class="fr-btn" type="button" data-command="underline" title="Underline" aria-label="Underline">${toolbarIcons.underline}</button>
        <button class="fr-btn" type="button" data-command="strikeThrough" title="Strikethrough" aria-label="Strikethrough">${toolbarIcons.strike}</button>
      </div>
      <div class="fr-group">
        <button class="fr-btn" type="button" data-command="insertUnorderedList" title="Bulleted list" aria-label="Bulleted list">${toolbarIcons.unorderedList}</button>
        <button class="fr-btn" type="button" data-command="insertOrderedList" title="Numbered list" aria-label="Numbered list">${toolbarIcons.orderedList}</button>
        <button class="fr-btn" type="button" data-command="outdent" title="Decrease indent" aria-label="Decrease indent">${toolbarIcons.outdent}</button>
        <button class="fr-btn" type="button" data-command="indent" title="Increase indent" aria-label="Increase indent">${toolbarIcons.indent}</button>
      </div>
      <div class="fr-group">
        <button class="fr-btn" type="button" data-command="justifyLeft" title="Align left" aria-label="Align left">${toolbarIcons.alignLeft}</button>
        <button class="fr-btn" type="button" data-command="justifyCenter" title="Align center" aria-label="Align center">${toolbarIcons.alignCenter}</button>
        <button class="fr-btn" type="button" data-command="justifyRight" title="Align right" aria-label="Align right">${toolbarIcons.alignRight}</button>
      </div>
      <div class="fr-group">
        <button class="fr-btn" type="button" data-command="removeFormat" title="Clear formatting" aria-label="Clear formatting">${toolbarIcons.clear}</button>
      </div>
    </div>
  `;
}

function editorPanelHtml(item, options = {}) {
  const page = ensurePageFields(item.page);
  const isNotesPanel = Boolean(options.notesDraftId);
  const hasToolbar = !options.collapsed;
  const ribbonId = `format-ribbon-${item.key}`;
  const titleRow = item.editableTitle
    ? `
      <div class="panel-title-row">
        <input
          id="title-${escapeHtml(item.key)}"
          class="draft-title-input"
          data-title-draft-id="${escapeHtml(item.draft.id)}"
          type="text"
          autocomplete="off"
          aria-label="${escapeHtml(item.kicker)} title"
          value="${escapeHtml(item.draft.title)}"
        >
      </div>
    `
    : `
      <div class="panel-title-row">
        <h2>${escapeHtml(item.title)}</h2>
      </div>
  `;
  const headingContent = isNotesPanel
    ? `<span class="panel-kicker">Notes</span>`
    : titleRow;
  const standaloneClass = options.standalone === false ? "" : " display-page";
  const collapsedClass = options.collapsed ? " notes-collapsed" : "";
  const headingClass = isNotesPanel ? "panel-heading notes-toggle-heading" : "panel-heading";
  const headingAttributes = isNotesPanel
    ? ` data-toggle-notes="${escapeHtml(options.notesDraftId)}" role="button" tabindex="0" aria-expanded="${String(!options.collapsed)}" title="${options.collapsed ? "Show notes" : "Collapse notes"}"`
    : "";
  const notesCaret = isNotesPanel
    ? `
      <span class="notes-caret" aria-hidden="true">
        <svg viewBox="0 0 12 12">
          <path d="M3 7.5 6 4.5l3 3"></path>
        </svg>
      </span>
    `
    : "";
  const notesHint = isNotesPanel
    ? `<span class="notes-collapse-hint">${options.collapsed ? "Click to expand" : "Click to collapse"}</span>`
    : "";
  const formatButton = hasToolbar
    ? `
      <button
        class="panel-format-toggle"
        type="button"
        data-ribbon-toggle="${escapeHtml(item.key)}"
        aria-expanded="false"
        aria-controls="${escapeHtml(ribbonId)}"
        title="Formatting"
        aria-label="Show ${escapeHtml(item.title)} formatting"
      >${toolbarIcons.format}</button>
    `
    : "";
  const headingInner = isNotesPanel
    ? `
      <div class="notes-heading-main">
        ${notesCaret}
        ${headingContent}
      </div>
      ${formatButton}
      <span class="meta" title="Created ${formatDate(item.createdAt)}">${formatDate(item.createdAt)}</span>
      ${notesHint}
    `
    : `
      ${headingContent}
      ${formatButton}
      <span class="meta" title="Created ${formatDate(item.createdAt)}">${formatDate(item.createdAt)}</span>
    `;
  const placeholder = item.type === "story"
    ? "Project notes..."
    : (item.type === "notes" ? "Draft notes..." : "Start drafting...");
  const pageToolbar = hasToolbar
    ? formatRibbonHtml(item.key, item.title, options)
    : "";
  const ribbonRegion = `
    <div class="editor-ribbon-region" data-ribbon-region="${escapeHtml(item.key)}">
      <div class="${headingClass}"${headingAttributes}>
        ${headingInner}
      </div>
      ${pageToolbar}
    </div>
  `;
  const editorShell = options.collapsed
    ? ""
    : `
      <div class="rich-editor-shell">
        <div
          class="rich-editor"
          contenteditable="true"
          role="textbox"
          aria-multiline="true"
          spellcheck="true"
          aria-label="${escapeHtml(item.ariaLabel)}"
          data-editor-key="${escapeHtml(item.key)}"
          data-empty="${escapeHtml(placeholder)}"
        ></div>
      </div>
    `;

  return `
    <section class="editor-panel${standaloneClass} ${escapeHtml(item.type)}-display-page${collapsedClass}" data-page-key="${escapeHtml(item.key)}" aria-label="${escapeHtml(item.ariaLabel)}">
      ${ribbonRegion}
      ${editorShell}
    </section>
  `;
}

function hydrateVisibleEditors(items) {
  items.forEach(item => {
    const editorEl = editorElementForKey(item.key);
    if (!editorEl) return;
    setEditorHtml(editorEl, item.page.contentHtml);
    applyEditorFormat(editorEl, item.page.format);
    syncToolbarValues(item.key);
    restoreEditorScrollPosition(editorEl);
    window.requestAnimationFrame(() => restoreEditorScrollPosition(editorEl));
  });
}

function visibleEditorItems() {
  const items = [];
  if (displayedPageKeys.has(STORY_KEY)) items.push(pageItemForKey(STORY_KEY));
  state.drafts.forEach(draft => {
    if (!displayedPageKeys.has(draftContentKey(draft.id))) return;
    items.push(pageItemForKey(draftContentKey(draft.id)));
    if (!collapsedNotesIds.has(draft.id)) items.push(pageItemForKey(draftNotesKey(draft.id)));
  });
  return items.filter(Boolean);
}

function draftStackHtml(draft) {
  const draftItem = pageItemForKey(draftContentKey(draft.id));
  const notesItem = pageItemForKey(draftNotesKey(draft.id));
  const collapsed = collapsedNotesIds.has(draft.id);

  return `
    <section class="draft-stack-page display-page${collapsed ? " notes-are-collapsed" : ""}" data-draft-stack-id="${escapeHtml(draft.id)}" style="--draft-pane-height: ${getNotesPanePercent(draft.id)}%;" aria-label="${escapeHtml(draft.title)}">
      ${editorPanelHtml(draftItem, { standalone: false })}
      ${collapsed ? "" : `
        <div
          class="notes-resizer"
          data-resize-notes="${escapeHtml(draft.id)}"
          role="separator"
          aria-orientation="horizontal"
          aria-label="Resize ${escapeHtml(draft.title)} notes"
          tabindex="0"
        ></div>
      `}
      ${editorPanelHtml(notesItem, {
        standalone: false,
        collapsed,
        notesDraftId: draft.id
      })}
    </section>
  `;
}

function renderEditor() {
  ensurePageFields(state.initialNotes);
  state.drafts.forEach(draft => {
    ensurePageFields(draft);
    ensurePageFields(draft.notes);
  });

  const selectedDrafts = state.drafts.filter(draft => displayedPageKeys.has(draftContentKey(draft.id)));
  const hasStory = displayedPageKeys.has(STORY_KEY);
  const pageHtml = [
    hasStory ? editorPanelHtml(pageItemForKey(STORY_KEY)) : "",
    ...selectedDrafts.map(draftStackHtml)
  ].filter(Boolean);

  els.pageCanvas.classList.toggle("empty-page-canvas", !pageHtml.length);
  els.pageCanvas.innerHTML = pageHtml.length
    ? pageHtml.join("")
    : `<p class="empty-state page-empty-state">No pages selected.</p>`;

  hydrateVisibleEditors(visibleEditorItems());
}

function refreshRenderedPageLabels() {
  allPageItems().forEach(item => {
    const panel = pagePanelForKey(item.key);
    if (!panel) return;

    panel.setAttribute("aria-label", item.ariaLabel);
    const heading = panel.querySelector("h2");
    if (heading && !item.editableTitle) heading.textContent = item.title;

    const editorEl = editorElementForKey(item.key);
    if (editorEl) editorEl.setAttribute("aria-label", item.ariaLabel);

    const toolbar = toolbarForEditor(item.key);
    if (toolbar) toolbar.setAttribute("aria-label", `${item.title} formatting`);
  });
}

function richPageHtml(page) {
  ensurePageFields(page);
  if (!page.content.trim()) {
    return `<p class="compare-line empty-line">No draft text yet.</p>`;
  }
  return sanitizeRichHtml(page.contentHtml);
}

function semanticClasses(marks = {}) {
  return [
    marks.bold ? "semantic-bold" : "",
    marks.italic ? "semantic-italic" : "",
    marks.underline ? "semantic-underline" : "",
    marks.strike ? "semantic-strike" : ""
  ].filter(Boolean).join(" ");
}

function visibleChangedWhitespace(text) {
  return text
    .replace(/ /g, "·")
    .replace(/\t/g, "⇥")
    .replace(/\n/g, "↵\n");
}

function isCompareWordToken(text) {
  return String(text || "").trim().length > 0;
}

function compareTokenAttributes(attributes = {}) {
  return Object.entries(attributes)
    .filter(([, value]) => value !== undefined && value !== null)
    .map(([name, value]) => `${name}="${escapeHtml(value)}"`)
    .join(" ");
}

function renderComparePageToken(token, index) {
  const classes = ["compare-token"];
  const semanticClassName = semanticClasses(token.marks);
  if (semanticClassName) classes.push(semanticClassName);

  const attributes = isCompareWordToken(token.text)
    ? { "data-compare-token-index": index }
    : {};
  const attributeText = compareTokenAttributes(attributes);

  return `<span class="${classes.join(" ")}"${attributeText ? ` ${attributeText}` : ""}>${escapeHtml(token.text)}</span>`;
}

function comparePageContentHtml(page) {
  ensurePageFields(page);
  if (!page.content.trim()) {
    return `<div class="compare-text empty-line">No draft text yet.</div>`;
  }

  const tokens = semanticTokensFromHtml(page.contentHtml)
    .map((token, index) => renderComparePageToken(token, index))
    .join("");
  return `<div class="compare-text">${tokens}</div>`;
}

function renderDiffToken(part, pair) {
  const classes = ["compare-token"];
  if (part.type !== "same") classes.push(part.type);
  const semanticClassName = semanticClasses(part.marks);
  if (semanticClassName) classes.push(semanticClassName);
  const text = part.type === "same" ? part.text : visibleChangedWhitespace(part.text);
  const attributes = {};

  if (isCompareWordToken(part.text)) {
    if ((part.type === "same" || part.type === "added") && Number.isInteger(part.afterIndex)) {
      attributes["data-compare-token-index"] = part.afterIndex;
    }

    if ((part.type === "same" || part.type === "removed") && Number.isInteger(part.beforeIndex)) {
      attributes["data-scroll-target-page-id"] = pair.before.id;
      attributes["data-scroll-target-token-index"] = part.beforeIndex;
      attributes.title = "Double-click to find this word in the previous version";
    }
  }

  const attributeText = compareTokenAttributes(attributes);
  return `<span class="${classes.join(" ")}"${attributeText ? ` ${attributeText}` : ""}>${escapeHtml(text)}</span>`;
}

function baseComparePageHtml(draft, subtitle = "BASELINE") {
  ensurePageFields(draft);
  return `
    <article class="compare-page is-baseline" data-compare-page-id="${escapeHtml(draft.id)}">
      <div class="compare-page-header">
        <div class="kicker">${escapeHtml(subtitle)}</div>
        <div class="title-row">
          <div class="title">${escapeHtml(draft.title)}</div>
        </div>
        <div class="meta">${formatDate(draft.createdAt)}</div>
      </div>
      <div class="compare-page-body" style="${fontStyle(draft.format)}">
        ${comparePageContentHtml(draft)}
      </div>
    </article>
  `;
}

function markedLaterPageHtml(pair, diff = diffRichPages(pair.before, pair.after)) {
  if (!diff.length) {
    return `<div class="compare-text empty-line">No draft text yet.</div>`;
  }

  const tokens = diff.map(part => renderDiffToken(part, pair)).join("");
  return `<div class="compare-text">${tokens}</div>`;
}

function markedComparePageHtml(pair) {
  const diff = diffRichPages(pair.before, pair.after);
  const stats = diffTokenStats(diff);

  return `
    <article class="compare-page later-page" data-compare-page-id="${escapeHtml(pair.after.id)}">
      <div class="compare-page-header">
        <div class="kicker">CHANGES</div>
        <div class="title-row">
          <div class="title">${escapeHtml(pair.after.title)}</div>
          <div class="vs">vs ${escapeHtml(pair.before.title)}</div>
        </div>
        <div class="meta">
          <div>${formatDate(pair.after.createdAt)}</div>
          <div class="compare-stats">
            <span class="stat add"><span class="num">+${stats.adds}</span> added</span>
            <span class="stat del"><span class="num">-${stats.dels}</span> deleted</span>
          </div>
        </div>
      </div>
      <div class="compare-page-body" style="${fontStyle(pair.after.format)}">
        ${markedLaterPageHtml(pair, diff)}
      </div>
    </article>
  `;
}

function selectedCompareIndexes() {
  return state.drafts
    .map((draft, index) => displayedPageKeys.has(draftContentKey(draft.id)) ? index : null)
    .filter(index => index !== null);
}

function beforeIndexForSelectedDraft(indexes, position) {
  return els.compareMode.value === "first" ? indexes[0] : indexes[position - 1];
}

function renderComparisonStrip(indexes) {
  const pages = [];

  pages.push(baseComparePageHtml(state.drafts[indexes[0]], "BASELINE"));

  indexes.slice(1).forEach((draftIndex, offset) => {
    const beforeIndex = beforeIndexForSelectedDraft(indexes, offset + 1);
    const pair = pairForIndexes(beforeIndex, draftIndex);
    pages.push(markedComparePageHtml(pair));
  });

  const visiblePages = Math.min(4, Math.max(1, pages.length));
  const gapTotal = 0;
  const style = `--compare-visible-pages: ${visiblePages}; --compare-gap-total: ${gapTotal}px;`;
  return `<div class="compare-strip" style="${style}">${pages.join("")}</div>`;
}

function cssEscape(value) {
  if (window.CSS && typeof window.CSS.escape === "function") return window.CSS.escape(String(value));
  return String(value).replace(/["\\]/g, "\\$&");
}

function clearCompareTargetHighlight() {
  window.clearTimeout(compareHighlightTimer);
  compareHighlightTimer = null;
  els.diffOutput.querySelector(".compare-target-highlight")?.classList.remove("compare-target-highlight");
}

function findCompareTargetToken(pageId, tokenIndex) {
  const index = Number(tokenIndex);
  if (!pageId || !Number.isInteger(index)) return null;

  const page = els.diffOutput.querySelector(`[data-compare-page-id="${cssEscape(pageId)}"]`);
  return page?.querySelector(`[data-compare-token-index="${index}"]`) || null;
}

function scrollCompareTargetIntoView(target, sourceToken) {
  const page = target.closest(".compare-page");
  const body = target.closest(".compare-page-body");
  const sourceRect = sourceToken.getBoundingClientRect();

  page?.scrollIntoView({ block: "nearest", inline: "nearest", behavior: "smooth" });

  if (body) {
    const bodyRect = body.getBoundingClientRect();
    const targetRect = target.getBoundingClientRect();
    const targetTop = body.scrollTop + targetRect.top - bodyRect.top;
    const sourceOffset = sourceRect.top - bodyRect.top;
    body.scrollTo({ top: Math.max(0, targetTop - sourceOffset), behavior: "smooth" });
  }
}

function highlightCompareTarget(target) {
  clearCompareTargetHighlight();
  target.classList.add("compare-target-highlight");
  compareHighlightTimer = window.setTimeout(clearCompareTargetHighlight, 2200);
}

function jumpToComparedToken(sourceToken) {
  const target = findCompareTargetToken(
    sourceToken.dataset.scrollTargetPageId,
    sourceToken.dataset.scrollTargetTokenIndex
  );
  if (!target) return;

  scrollCompareTargetIntoView(target, sourceToken);
  highlightCompareTarget(target);
}

function renderDiff() {
  if (!showChanges) {
    els.diffOutput.innerHTML = "";
    els.compareSubtitle.textContent = "";
    return;
  }

  const indexes = selectedCompareIndexes();

  const baseline = state.drafts[indexes[0]];
  els.compareSubtitle.textContent = els.compareMode.value === "first"
    ? (baseline ? `Against ${baseline.title}` : "No baseline")
    : "Consecutive";

  els.diffOutput.innerHTML = indexes.length
    ? renderComparisonStrip(indexes)
    : `<p class="empty-state">No draft pages selected.</p>`;
}

function renderChangesVisibility() {
  els.editorSurface.classList.toggle("compare-open", showChanges);
  els.changesPanel.hidden = !showChanges;
  els.toggleChanges.setAttribute("aria-pressed", String(showChanges));
  const label = els.toggleChanges.querySelector(".toggle-changes-label");
  if (label) {
    label.textContent = showChanges ? "Hide changes" : "Show changes";
  } else {
    els.toggleChanges.textContent = showChanges ? "Hide changes" : "Show changes";
  }
}

function render() {
  saveCurrentEditorViewState();
  saveVisibleEditorScrollPositions();
  ensureDisplaySelection();
  renderDraftTabs();
  renderEditor();
  renderChangesVisibility();
  renderDiff();
  syncGlobalFormatControls();
}

function syncFromInputs() {
  if (!state) return;
  saveCurrentEditorViewState();
  saveVisibleEditorScrollPositions();

  els.pageCanvas.querySelectorAll("[data-title-draft-id]").forEach(input => {
    const draft = draftById(input.dataset.titleDraftId);
    if (!draft) return;
    draft.title = input.value || "Untitled draft";
    draft.notes.title = `${draft.title} Notes`;
  });

  els.pageCanvas.querySelectorAll("[data-editor-key]").forEach(editorEl => {
    const page = pageForEditorKey(editorEl.dataset.editorKey);
    if (page) syncRichPage(page, editorEl);
  });
}

function scheduleSave() {
  markStateChanged();
  saveRetryCount = 0;
  syncFromInputs();
  rememberLinkedProjectState();
  renderDraftTabs();
  refreshRenderedPageLabels();
  renderDiff();
  setStatus(isSaving ? "Saving..." : "Unsaved changes");
  queueSave();
}

function resetViewStateForProject() {
  selectedDraftId = state.drafts[0]?.id || null;
  activeArea = "story";
  activeEditorKey = STORY_KEY;
  showChanges = false;
  hasStoredDisplaySelection = true;
  displayedPageKeys = new Set(defaultDisplayKeys());
  collapsedNotesIds = new Set();
  notesPanePercents = {};
  pagesOnScreen = DEFAULT_PAGES_ON_SCREEN;
  els.compareMode.value = "first";
  saveCurrentViewState();
  setPagesOnScreen(pagesOnScreen);
}

function isAbortError(error) {
  return error?.name === "AbortError";
}

function readableSaveFailure(message = "") {
  const text = String(message || "");
  if (/linked text file write failed|EACCES|EPERM|access is denied|denied/i.test(text)) {
    return "Save failed: linked text file blocked";
  }
  if (/Unexpected token|JSON|payload|state/i.test(text)) {
    return "Save failed: project data was rejected";
  }
  if (/Failed to fetch|NetworkError|Load failed/i.test(text)) {
    return "Save failed: local server unavailable";
  }
  return text ? `Save failed: ${text.slice(0, 90)}` : "Save failed";
}

async function responseSaveFailure(response) {
  try {
    const payload = await response.json();
    return readableSaveFailure(payload?.error);
  } catch {
    return readableSaveFailure(response.statusText || `HTTP ${response.status}`);
  }
}

function handleSaveFailure(message) {
  isSaving = false;
  if (saveRetryCount < MAX_SAVE_RETRIES) {
    saveRetryCount += 1;
    setStatus(`${message}; retrying`);
    queueSave(Math.min(1500 * saveRetryCount, 6000));
    return;
  }

  setStatus(message);
}

function downloadExportText(fileName) {
  const blob = new Blob([formatExportText(state)], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = ensureTxtExtension(fileName);
  document.body.append(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
}

async function applyTextProject(text, fileName, options = {}) {
  state = stateFromExportText(text, options.preserveFormatsFrom || null);
  markStateChanged();
  saveQueued = false;
  editorSelections = {};
  projectFileName = fileName || "draft-history.txt";
  updateProjectTitle();
  restoreViewStateForProject();
  render();
  const savedToLinkedFile = await saveNow();
  resetHistory();
  setStatus(savedToLinkedFile ? `Opened ${projectFileName}; autosave linked` : "Opened; saved companion");
  focusPageEditor(STORY_KEY);
}

async function clearLinkedTextFile() {
  linkedTextPath = "";

  try {
    await fetch("/api/clear-text-file-link", { method: "POST" });
  } catch {
    // The fallback file input cannot provide a real disk path, so local autosave is disabled.
  }
}

async function saveAsTextProject(stateOverride = null, suggestedFileName = null) {
  if (!state && !stateOverride) return false;
  closeFileMenu();
  if (!stateOverride) syncFromInputs();

  const stateToSave = stateOverride || state;
  const fileNameToSuggest = ensureTxtExtension(
    suggestedFileName || projectFileName || fileNameFromPath(exportPath)
  );

  try {
    setStatus("Choose a save location...");
    const response = await fetch("/api/save-as-text-file", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        state: stateToSave,
        fileName: fileNameToSuggest
      })
    });

    if (!response.ok) {
      const payload = await response.json().catch(() => ({}));
      throw new Error(payload.error || "Save as failed.");
    }

    const payload = await response.json();
    if (payload.cancelled) {
      setStatus("Save as cancelled");
      return false;
    }

    state = payload.state;
    markStateChanged();
    saveQueued = false;
    exportPath = payload.exportPath || exportPath;
    projectFileName = payload.fileName || projectFileName;
    linkedTextPath = payload.filePath || linkedTextPath || "";
    rememberLinkedProjectState();
    updateProjectTitle();
    setStatus(`Saved as ${projectFileName}`);
    return true;
  } catch (error) {
    if (isAbortError(error)) return false;
    console.error(error);
    setStatus("Save as failed");
    return false;
  }
}

async function newTextProject() {
  closeFileMenu();

  try {
    const nextState = createDefaultState();
    const saved = await saveAsTextProject(nextState, "draft-history.txt");
    if (!saved) return;

    editorSelections = {};
    resetViewStateForProject();
    render();
    resetHistory();
    focusPageEditor(STORY_KEY);
  } catch (error) {
    if (isAbortError(error)) return;
    console.error(error);
    setStatus("New file failed");
  }
}

async function openTextProject() {
  closeFileMenu();

  try {
    if (state) {
      syncFromInputs();
      rememberLinkedProjectState();
      await cacheLinkedProjectStateOnServer();
      window.clearTimeout(saveTimer);
      await saveNow();
    }

    const previousLinkedTextPath = linkedTextPath;
    const previousState = state ? projectStateFromSnapshot(serializeProjectState()) : null;
    const response = await fetch("/api/open-text-file", { method: "POST" });
    if (response.ok) {
      const payload = await response.json();
      if (payload.cancelled) return;

      linkedTextPath = payload.filePath || "";
      const storedState = cachedProjectStateForPath(linkedTextPath) || payload.storedState;
      await applyTextProject(payload.text || "", payload.fileName || "draft-history.txt", {
        preserveFormatsFrom: storedState || (filePathsMatch(previousLinkedTextPath, linkedTextPath) ? previousState : null)
      });
      return;
    }

    els.fileOpenInput.click();
  } catch (error) {
    if (isAbortError(error)) return;
    console.error(error);
    setStatus("Open failed");
  }
}

async function openFileLocation() {
  closeFileMenu();

  try {
    if (state) await saveNow();

    const response = await fetch("/api/open-file-location", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ fileName: projectFileName })
    });
    if (!response.ok) throw new Error("Open file location failed");
    const location = await response.json();

    setStatus(location.directoryPath ? `Opened ${location.directoryPath}` : "Opened file location");
  } catch (error) {
    console.error(error);
    setStatus("Open file location failed");
  }
}

async function saveNow() {
  if (!state) return false;

  if (isSaving) {
    saveQueued = true;
    setStatus("Saving...");
    return false;
  }

  syncFromInputs();
  rememberLinkedProjectState();
  const requestRevision = stateRevision;
  isSaving = true;
  setStatus("Saving...");

  try {
    const response = await fetch("/api/state", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(state)
    });

    if (!response.ok) {
      handleSaveFailure(await responseSaveFailure(response));
      return false;
    }

    const payload = await response.json();
    const responseMatchesCurrentState = requestRevision === stateRevision;
    if (responseMatchesCurrentState) state = payload.state;

    exportPath = payload.exportPath || exportPath;
    linkedTextPath = payload.linkedTextPath || linkedTextPath || "";
    if (payload.linkedTextFileName) projectFileName = payload.linkedTextFileName;
    isSaving = false;
    saveRetryCount = 0;

    if (!responseMatchesCurrentState || saveQueued) {
      saveQueued = false;
      setStatus("Unsaved changes");
      queueSave(0);
      return Boolean(linkedTextPath);
    }

    ensureDisplaySelection();
    if (!linkedTextPath && exportPath && projectFileName === "draft-history.txt") {
      projectFileName = fileNameFromPath(exportPath) || projectFileName;
    }
    updateProjectTitle();
    setStatus(linkedTextPath ? `Saved ${formatDate(state.updatedAt)}` : "Saved companion; no text file linked");
    renderDraftTabs();
    return Boolean(linkedTextPath);
  } catch (error) {
    console.error(error);
    handleSaveFailure(readableSaveFailure(error?.message));
    return false;
  }
}

async function loadState() {
  const response = await fetch("/api/state");
  const payload = await response.json();
  state = migrateLegacyDefaultFonts(payload.state);
  stateRevision = 0;
  saveQueued = false;
  editorSelections = {};
  exportPath = payload.exportPath || "";
  linkedTextPath = payload.linkedTextPath || "";
  projectFileName = payload.linkedTextFileName || fileNameFromPath(exportPath) || projectFileName;
  updateProjectTitle();
  restoreViewStateForProject();
  setStatus(linkedTextPath ? `Saved ${formatDate(state.updatedAt)}` : "Saved companion; no text file linked");
  render();
  resetHistory();
}

function setActiveFromPageKey(pageKey) {
  const parsed = parseDraftPageKey(pageKey);
  activeEditorKey = pageKey;

  if (pageKey === STORY_KEY) {
    activeArea = "story";
    renderDraftTabs();
    saveCurrentViewState();
    return;
  }

  if (parsed?.draftId) {
    selectedDraftId = parsed.draftId;
    activeArea = "draft";
    renderDraftTabs();
    saveCurrentViewState();
  }
}

function focusPageEditor(pageKey) {
  window.requestAnimationFrame(() => {
    const editor = editorElementForKey(pageKey);
    if (editor) {
      editor.focus({ preventScroll: true });
      restoreEditorSelection(editor);
      restoreEditorScrollPosition(editor);
    }
    alignPageInCanvas(pageKey);
  });
}

function selectDraft(draftId) {
  syncFromInputs();
  selectedDraftId = draftId;
  activeArea = "draft";
  displayPage(draftContentKey(draftId), true);
  render();
  scheduleSave();
  focusPageEditor(draftContentKey(draftId));
}

function addDraft(copyFromSelected) {
  syncFromInputs();
  recordUndoSnapshot();
  const draft = createDraft(copyFromSelected ? getSelectedDraft() : null);
  state.drafts.push(draft);
  selectedDraftId = draft.id;
  activeArea = "draft";
  displayPage(draftContentKey(draft.id), true);
  render();
  scheduleSave();
  scrollTabsToEnd();
  focusPageEditor(draftContentKey(draft.id));
}

function toolbarFormatValues(editorKey) {
  const toolbar = toolbarForEditor(editorKey);
  const values = {};
  toolbar?.querySelectorAll("[data-page-format-picker]").forEach(picker => {
    const field = picker.dataset.pageFormatPicker;
    if (field && picker.dataset.value) values[field] = picker.dataset.value;
  });
  return values;
}

function applyPageFormat(editorKey, field, value) {
  const page = pageForEditorKey(editorKey);
  const editorEl = editorElementForKey(editorKey);
  if (!page || !editorEl) return;

  ensurePageFields(page);
  const nextFormat = normalizeFormat({
    ...page.format,
    ...toolbarFormatValues(editorKey),
    [field]: value
  });
  if (page.format.fontFamily === nextFormat.fontFamily && page.format.fontSize === nextFormat.fontSize) return;

  recordUndoSnapshot();
  page.format = nextFormat;
  applyEditorFormat(editorEl, page.format);
  syncToolbarValues(editorKey);
  syncGlobalFormatControls();
  scheduleSave();
}

function applyUniversalFormat(field, value) {
  const normalizedValue = String(value || "");
  const allowedValues = field === "fontFamily" ? allowedFontFamilies : allowedFontSizes;
  if (!allowedValues.has(normalizedValue)) {
    syncGlobalFormatControls();
    return;
  }

  syncFromInputs();

  const currentFormat = currentDefaultFormat(state);
  const nextFormat = normalizeFormat({
    ...currentFormat,
    [field]: normalizedValue
  });
  const pages = editablePages();
  const hasPageChange = pages.some(page => {
    ensurePageFields(page);
    return page.format[field] !== nextFormat[field];
  });
  const hasDefaultChange = currentFormat[field] !== nextFormat[field];

  if (!hasPageChange && !hasDefaultChange) {
    syncGlobalFormatControls();
    return;
  }

  recordUndoSnapshot();
  state.defaultFormat = nextFormat;
  pages.forEach(page => {
    ensurePageFields(page);
    page.format = normalizeFormat({
      ...page.format,
      [field]: nextFormat[field]
    });
  });
  render();
  scheduleSave();
}

function runEditorCommand(editorKey, command) {
  const editorEl = editorElementForKey(editorKey);
  if (!editorEl) return;
  activeEditorKey = editorKey;
  editorEl.focus();
  recordUndoSnapshot();
  document.execCommand(command, false, null);
  scheduleSave();
}

function setRibbonRegionOpen(region, open) {
  region.classList.toggle("ribbon-open", open);

  const toggle = region.querySelector("[data-ribbon-toggle]");
  const toolbar = region.querySelector(".editor-format-ribbon");
  if (toggle) toggle.setAttribute("aria-expanded", String(open));
  if (toolbar) toolbar.setAttribute("aria-hidden", String(!open));
}

function closeEditorRibbonRegion(region) {
  if (!region?.classList.contains("ribbon-open")) return;
  setRibbonRegionOpen(region, false);
  closeFormatPickers();
}

function closeRibbonsOutsidePanel(target) {
  if (!(target instanceof Element)) return;

  els.pageCanvas.querySelectorAll(".editor-ribbon-region.ribbon-open").forEach(region => {
    const panel = region.closest(".editor-panel");
    if (!panel || panel.contains(target)) return;
    closeEditorRibbonRegion(region);
  });
}

function toggleEditorRibbon(toggle) {
  const region = toggle.closest(".editor-ribbon-region");
  if (!region) return;

  const shouldOpen = !region.classList.contains("ribbon-open");
  if (shouldOpen) {
    closeRibbonsOutsidePanel(toggle);
    setRibbonRegionOpen(region, true);
    syncToolbarValues(region.dataset.ribbonRegion);
    return;
  }

  closeEditorRibbonRegion(region);
}

function closeFormatPickers(exceptPicker = null) {
  const affectedToolbars = new Set();

  els.pageCanvas.querySelectorAll(".fr-picker.is-open").forEach(picker => {
    if (picker === exceptPicker) return;
    picker.classList.remove("is-open");
    picker.querySelector("[data-format-toggle]")?.setAttribute("aria-expanded", "false");
    clearFormatPickerPosition(picker);
    const toolbar = picker.closest("[data-toolbar-for]");
    if (toolbar) affectedToolbars.add(toolbar);
  });

  affectedToolbars.forEach(updateToolbarPickerState);
}

function clearFormatPickerPosition(picker) {
  const menu = picker.querySelector(".fr-picker-menu");
  if (!menu) return;

  menu.style.removeProperty("left");
  menu.style.removeProperty("top");
  menu.style.removeProperty("min-width");
}

function updateToolbarPickerState(toolbar) {
  toolbar.classList.toggle("has-open-picker", Boolean(toolbar.querySelector(".fr-picker.is-open")));
}

function positionFormatPickerMenu(picker) {
  const toggle = picker.querySelector("[data-format-toggle]");
  const menu = picker.querySelector(".fr-picker-menu");
  if (!toggle || !menu || !picker.classList.contains("is-open")) return;

  const viewportWidth = document.documentElement.clientWidth;
  const viewportHeight = document.documentElement.clientHeight;
  const margin = 6;
  const gap = 5;
  const toggleRect = toggle.getBoundingClientRect();

  menu.style.minWidth = `${Math.ceil(toggleRect.width)}px`;

  const menuRect = menu.getBoundingClientRect();
  const menuWidth = menuRect.width;
  const menuHeight = menuRect.height;
  const left = Math.max(margin, Math.min(toggleRect.left, viewportWidth - menuWidth - margin));
  const belowTop = toggleRect.bottom + gap;
  const aboveTop = toggleRect.top - menuHeight - gap;
  const top = belowTop + menuHeight <= viewportHeight - margin || aboveTop < margin
    ? Math.max(margin, Math.min(belowTop, viewportHeight - menuHeight - margin))
    : aboveTop;

  menu.style.left = `${Math.round(left)}px`;
  menu.style.top = `${Math.round(top)}px`;
}

function positionOpenFormatPickers() {
  els.pageCanvas.querySelectorAll(".fr-picker.is-open").forEach(positionFormatPickerMenu);
}

function toggleFormatPicker(toggle) {
  const picker = toggle.closest("[data-page-format-picker]");
  if (!picker) return;

  const shouldOpen = !picker.classList.contains("is-open");
  const toolbar = picker.closest("[data-toolbar-for]");
  closeFormatPickers(picker);
  picker.classList.toggle("is-open", shouldOpen);
  toggle.setAttribute("aria-expanded", String(shouldOpen));

  if (!shouldOpen) clearFormatPickerPosition(picker);
  if (toolbar) updateToolbarPickerState(toolbar);
  if (shouldOpen) positionFormatPickerMenu(picker);
}

function chooseFormatOption(option) {
  const picker = option.closest("[data-page-format-picker]");
  const toolbar = option.closest("[data-toolbar-for]");
  if (!picker || !toolbar) return;

  applyPageFormat(toolbar.dataset.toolbarFor || activeEditorKey, picker.dataset.pageFormatPicker, option.dataset.formatOption);
  closeFormatPickers();
}

function toggleNotes(draftId) {
  syncFromInputs();
  if (collapsedNotesIds.has(draftId)) {
    collapsedNotesIds.delete(draftId);
  } else {
    collapsedNotesIds.add(draftId);
  }
  ensureDisplaySelection();
  render();
  scheduleSave();
}

function deleteDraft(draftId) {
  syncFromInputs();
  const draft = draftById(draftId);
  if (!draft || !canDeleteDraft(draft)) return;

  recordUndoSnapshot();
  state.drafts = state.drafts.filter(item => item.id !== draftId);
  displayedPageKeys.delete(draftContentKey(draftId));
  collapsedNotesIds.delete(draftId);
  delete editorSelections[draftContentKey(draftId)];
  delete editorSelections[draftNotesKey(draftId)];

  if (!state.drafts.length) {
    state.drafts.push(createDraft(null));
  }

  selectedDraftId = state.drafts[0]?.id;
  activeArea = "draft";
  displayPage(draftContentKey(selectedDraftId), true);
  ensureDisplaySelection();
  render();
  scheduleSave();
}

function resizeNotesPane(draftId, clientY) {
  const stack = Array.from(els.pageCanvas.querySelectorAll("[data-draft-stack-id]"))
    .find(element => element.dataset.draftStackId === draftId);
  if (!stack) return;
  const rect = stack.getBoundingClientRect();
  if (!rect.height) return;
  const draftPixels = clientY - rect.top;
  setNotesPanePercent(draftId, (draftPixels / rect.height) * 100);
}

els.fileNew.addEventListener("click", newTextProject);
els.fileOpen.addEventListener("click", openTextProject);
els.fileOpenLocation.addEventListener("click", openFileLocation);
els.fileSaveAs.addEventListener("click", () => saveAsTextProject());
els.editUndo.addEventListener("click", () => {
  undoProjectChange();
  closeTopMenus();
});
els.editRedo.addEventListener("click", () => {
  redoProjectChange();
  closeTopMenus();
});
els.editGlobalFont.addEventListener("change", event => {
  applyUniversalFormat("fontFamily", event.target.value);
});
els.editGlobalFontSize.addEventListener("change", event => {
  applyUniversalFormat("fontSize", event.target.value);
});

els.fileOpenInput.addEventListener("change", async event => {
  const [file] = event.target.files || [];
  event.target.value = "";
  if (!file) return;

  try {
    await clearLinkedTextFile();
    await applyTextProject(await file.text(), file.name);
  } catch (error) {
    console.error(error);
    setStatus("Open failed");
  }
});

els.storyTab.addEventListener("click", event => {
  if (!event.target.closest("[data-story-focus]")) return;
  syncFromInputs();
  activeArea = "story";
  renderDraftTabs();
  saveCurrentViewState();
  focusPageEditor(STORY_KEY);
});

els.storyDisplayToggle.addEventListener("change", event => {
  if (showChanges) {
    event.target.checked = false;
    return;
  }

  syncFromInputs();
  displayPage(STORY_KEY, event.target.checked);
  render();
  scheduleSave();
});

els.allDraftsTab.addEventListener("click", event => {
  if (event.target === els.allDraftsToggle) return;
  if (!event.target.closest("[data-all-drafts-toggle]")) return;
  syncFromInputs();
  displayAllDrafts(!allDraftsSelected());
  render();
  scheduleSave();
});

els.allDraftsToggle.addEventListener("change", event => {
  syncFromInputs();
  displayAllDrafts(event.target.checked);
  render();
  scheduleSave();
});

els.draftTabs.addEventListener("click", event => {
  const deleteButton = event.target.closest("[data-delete-draft-id]");
  if (deleteButton) {
    deleteDraft(deleteButton.dataset.deleteDraftId);
    return;
  }

  const button = event.target.closest("[data-draft-id]");
  if (!button) return;
  selectDraft(button.dataset.draftId);
});

els.draftTabs.addEventListener("change", event => {
  const checkbox = event.target.closest("[data-display-draft-id]");
  if (!checkbox) return;
  syncFromInputs();
  displayPage(draftContentKey(checkbox.dataset.displayDraftId), checkbox.checked);
  render();
  scheduleSave();
});

els.newDraftBlank.addEventListener("click", () => addDraft(false));
els.newDraftCopy.addEventListener("click", () => addDraft(true));

els.pagesOnScreen.addEventListener("click", event => {
  const button = event.target.closest("[data-pages-on-screen]");
  if (!button) return;
  setPagesOnScreen(button.dataset.pagesOnScreen);
  if (els.viewMenu) els.viewMenu.open = false;
});

els.pageCanvas.addEventListener("focusin", event => {
  const editorEl = event.target.closest("[data-editor-key]");
  if (editorEl) {
    setActiveFromPageKey(editorEl.dataset.editorKey);
    return;
  }

  const titleInput = event.target.closest("[data-title-draft-id]");
  if (titleInput) {
    selectedDraftId = titleInput.dataset.titleDraftId;
    activeArea = "draft";
    activeEditorKey = draftContentKey(selectedDraftId);
    renderDraftTabs();
    saveCurrentViewState();
  }
});

els.pageCanvas.addEventListener("focusout", event => {
  const editorEl = event.target.closest("[data-editor-key]");
  if (editorEl) saveEditorViewState(editorEl);
});

els.pageCanvas.addEventListener("beforeinput", event => {
  if (!editableHistoryTarget(event.target)) return;

  if (event.inputType === "historyUndo") {
    event.preventDefault();
    undoProjectChange();
    return;
  }

  if (event.inputType === "historyRedo") {
    event.preventDefault();
    redoProjectChange();
    return;
  }

  recordUndoSnapshot();
});

els.pageCanvas.addEventListener("input", event => {
  const editorEl = event.target.closest("[data-editor-key]");
  const titleInput = event.target.closest("[data-title-draft-id]");
  if (editorEl) window.requestAnimationFrame(() => saveEditorViewState(editorEl));

  if (editorEl || titleInput) {
    recordUndoSnapshot();
    scheduleSave();
  }
});

els.pageCanvas.addEventListener("keyup", event => {
  const editorEl = event.target.closest("[data-editor-key]");
  if (editorEl) saveEditorViewState(editorEl);
});

els.pageCanvas.addEventListener("pointerup", event => {
  const editorEl = event.target.closest("[data-editor-key]");
  if (editorEl) saveEditorViewState(editorEl);
});

els.pageCanvas.addEventListener("scroll", event => {
  const editorEl = event.target.closest?.("[data-editor-key]");
  if (editorEl) saveEditorScrollPosition(editorEl);
}, true);

els.pageCanvas.addEventListener("wheel", event => {
  const editorEl = event.target.closest?.("[data-editor-key]");
  if (editorEl) window.requestAnimationFrame(() => saveEditorScrollPosition(editorEl));
});

els.pageCanvas.addEventListener("keydown", event => {
  if (event.target.closest("[data-ribbon-toggle]")) return;

  const notesHeading = event.target.closest("[data-toggle-notes]");
  if (notesHeading && (event.key === "Enter" || event.key === " ")) {
    event.preventDefault();
    toggleNotes(notesHeading.dataset.toggleNotes);
    return;
  }

  const editorEl = event.target.closest("[data-editor-key]");
  if (!editorEl || event.key !== "Tab") return;

  event.preventDefault();
  activeEditorKey = editorEl.dataset.editorKey;
  recordUndoSnapshot();
  document.execCommand("insertText", false, "\t");
  scheduleSave();
});

els.pageCanvas.addEventListener("paste", event => {
  const editorEl = event.target.closest("[data-editor-key]");
  if (!editorEl) return;

  event.preventDefault();
  activeEditorKey = editorEl.dataset.editorKey;
  recordUndoSnapshot();
  const html = event.clipboardData.getData("text/html");
  const text = event.clipboardData.getData("text/plain");
  document.execCommand("insertHTML", false, html ? sanitizeRichHtml(html) : textToHtml(text));
  scheduleSave();
});

els.pageCanvas.addEventListener("pointerdown", event => {
  const resizer = event.target.closest("[data-resize-notes]");
  if (!resizer) return;

  event.preventDefault();
  resizingDraftId = resizer.dataset.resizeNotes;
  resizer.closest(".draft-stack-page")?.classList.add("is-resizing");

  const onMove = moveEvent => resizeNotesPane(resizingDraftId, moveEvent.clientY);
  const onUp = () => {
    resizer.closest(".draft-stack-page")?.classList.remove("is-resizing");
    resizingDraftId = null;
    window.removeEventListener("pointermove", onMove);
    window.removeEventListener("pointerup", onUp);
  };

  window.addEventListener("pointermove", onMove);
  window.addEventListener("pointerup", onUp);
});

els.pageCanvas.addEventListener("mousedown", event => {
  if (event.target.closest(".editor-format-ribbon button")) event.preventDefault();
});

els.pageCanvas.addEventListener("click", event => {
  const ribbonToggle = event.target.closest("[data-ribbon-toggle]");
  if (ribbonToggle) {
    toggleEditorRibbon(ribbonToggle);
    return;
  }

  const notesToggle = event.target.closest("[data-toggle-notes]");
  if (notesToggle) {
    toggleNotes(notesToggle.dataset.toggleNotes);
    return;
  }

  const formatToggle = event.target.closest("[data-format-toggle]");
  if (formatToggle) {
    toggleFormatPicker(formatToggle);
    return;
  }

  const formatOption = event.target.closest("[data-format-option]");
  if (formatOption) {
    chooseFormatOption(formatOption);
    return;
  }

  const button = event.target.closest("[data-command]");
  if (!button) return;
  const toolbar = button.closest("[data-toolbar-for]");
  runEditorCommand(toolbar?.dataset.toolbarFor || activeEditorKey, button.dataset.command);
});

els.pageCanvas.addEventListener("change", event => {
  const control = event.target.closest("[data-page-format]");
  if (!control) return;
  const toolbar = control.closest("[data-toolbar-for]");
  applyPageFormat(toolbar?.dataset.toolbarFor || activeEditorKey, control.dataset.pageFormat, control.value);
});

els.pageCanvas.addEventListener("keydown", event => {
  const resizer = event.target.closest("[data-resize-notes]");
  if (!resizer) return;

  if (event.key === "ArrowUp") {
    event.preventDefault();
    setNotesPanePercent(resizer.dataset.resizeNotes, getNotesPanePercent(resizer.dataset.resizeNotes) - 4);
  }

  if (event.key === "ArrowDown") {
    event.preventDefault();
    setNotesPanePercent(resizer.dataset.resizeNotes, getNotesPanePercent(resizer.dataset.resizeNotes) + 4);
  }
});

els.compareMode.addEventListener("change", () => {
  saveCurrentViewState();
  renderDiff();
});

els.diffOutput.addEventListener("dblclick", event => {
  if (!(event.target instanceof Element)) return;

  const sourceToken = event.target.closest("[data-scroll-target-page-id][data-scroll-target-token-index]");
  if (!sourceToken || !els.diffOutput.contains(sourceToken)) return;

  event.preventDefault();
  jumpToComparedToken(sourceToken);
});

els.toggleChanges.addEventListener("click", () => {
  syncFromInputs();
  showChanges = !showChanges;
  saveCurrentViewState();
  renderDraftTabs();
  renderChangesVisibility();
  renderDiff();
});

document.addEventListener("click", event => {
  const topMenu =
    event.target instanceof Element ? event.target.closest("#file-menu, #edit-menu, #view-menu") : null;
  if (topMenu) {
    closeTopMenus(topMenu);
  } else {
    closeTopMenus();
  }

  closeRibbonsOutsidePanel(event.target);

  if (event.target instanceof Element && event.target.closest(".fr-picker")) return;
  closeFormatPickers();
});

document.addEventListener("selectionchange", saveCurrentEditorSelection);

document.addEventListener("keydown", event => {
  if (handleGlobalShortcut(event)) return;

  if (event.key === "Escape") {
    closeTopMenus();
    closeFormatPickers();
  }
});

document.addEventListener("scroll", positionOpenFormatPickers, true);
window.addEventListener("resize", positionOpenFormatPickers);
window.addEventListener("resize", updateTabDensity);

window.addEventListener("beforeunload", () => {
  if (!state) return;
  syncFromInputs();
  const blob = new Blob([JSON.stringify(state)], { type: "application/json" });
  navigator.sendBeacon("/api/close", blob);
});

populateGlobalFormatControls();
updateMenuShortcutLabels();
pingServer();
window.setInterval(pingServer, 5_000);

loadState().catch(error => {
  console.error(error);
  setStatus("Could not load project");
});
