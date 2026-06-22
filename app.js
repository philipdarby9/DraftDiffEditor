const DiffCore = window.DraftDiffCore;
if (!DiffCore) throw new Error("DraftDiffCore failed to load.");
const StateCore = window.DraftDiffStateCore;
if (!StateCore) throw new Error("DraftDiffStateCore failed to load.");
const ToolbarCore = window.DraftDiffToolbarCore;
if (!ToolbarCore) throw new Error("DraftDiffToolbarCore failed to load.");
const RichTextCore = window.DraftDiffRichTextCore;
if (!RichTextCore) throw new Error("DraftDiffRichTextCore failed to load.");

const els = {
  saveStatus: document.querySelector("#save-status"),
  projectTitle: document.querySelector("#project-title"),
  fileMenu: document.querySelector("#file-menu"),
  editMenu: document.querySelector("#edit-menu"),
  viewMenu: document.querySelector("#view-menu"),
  fileNew: document.querySelector("#file-new"),
  fileOpen: document.querySelector("#file-open"),
  fileOpenRecent: document.querySelector("#file-open-recent"),
  fileOpenRecentButton: document.querySelector("#file-open-recent-button"),
  fileOpenRecentMenu: document.querySelector("#file-open-recent-menu"),
  fileOpenLocation: document.querySelector("#file-open-location"),
  fileSaveAs: document.querySelector("#file-save-as"),
  fileVersionHistoryFolder: document.querySelector("#file-version-history-folder"),
  fileActivateBackup: document.querySelector("#file-activate-backup"),
  fileGenerateHistorySummary: document.querySelector("#file-generate-history-summary"),
  fileClose: document.querySelector("#file-close"),
  editUndo: document.querySelector("#edit-undo"),
  editRedo: document.querySelector("#edit-redo"),
  editSearch: document.querySelector("#edit-search"),
  editGlobalFont: document.querySelector("#edit-global-font"),
  editGlobalFontSize: document.querySelector("#edit-global-font-size"),
  viewEnablePanelDrag: document.querySelector("#view-enable-panel-drag"),
  viewZoomIn: document.querySelector("#view-zoom-in"),
  viewZoomOut: document.querySelector("#view-zoom-out"),
  fileOpenInput: document.querySelector("#file-open-input"),
  storyTab: document.querySelector("#story-tab"),
  storyDisplayToggle: document.querySelector("#story-display-toggle"),
  allDraftsTab: document.querySelector("#all-drafts-tab"),
  allDraftsToggle: document.querySelector("#all-drafts-toggle"),
  tabStrip: document.querySelector(".tab-strip"),
  tabStripFrame: document.querySelector(".tab-strip-frame"),
  tabScrollbar: document.querySelector("#tab-scrollbar"),
  tabScrollbarThumb: document.querySelector("#tab-scrollbar-thumb"),
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
  changesPanel: document.querySelector("#changes-panel"),
  searchPopover: document.querySelector("#search-popover"),
  searchInput: document.querySelector("#search-input"),
  searchScopeToggle: document.querySelector("#search-scope-toggle"),
  searchScopeLabel: document.querySelector("#search-scope-label"),
  searchScopeMenu: document.querySelector("#search-scope-menu"),
  searchPrev: document.querySelector("#search-prev"),
  searchNext: document.querySelector("#search-next"),
  searchClose: document.querySelector("#search-close"),
  searchSummary: document.querySelector("#search-summary"),
  summaryProgressOverlay: document.querySelector("#summary-progress-overlay"),
  summaryProgressStep: document.querySelector("#summary-progress-step"),
  summaryProgressBar: document.querySelector("#summary-progress-bar"),
  summaryProgressMeta: document.querySelector("#summary-progress-meta"),
  summaryProgressPath: document.querySelector("#summary-progress-path"),
  summaryProgressActions: document.querySelector("#summary-progress-actions"),
  summaryProgressOpen: document.querySelector("#summary-progress-open"),
  summaryProgressReveal: document.querySelector("#summary-progress-reveal"),
  summaryProgressClose: document.querySelector("#summary-progress-close")
};

const STORY_KEY = StateCore.STORY_KEY;
const PROJECT_NOTES_TITLE = StateCore.PROJECT_NOTES_TITLE;
const DISPLAY_STORAGE_KEY = "draftDiff.displayedPageKeys";
const NOTES_COLLAPSED_STORAGE_KEY = "draftDiff.collapsedNotesIds";
const NOTES_SIZE_STORAGE_KEY = "draftDiff.notesPanePercents";
const PAGES_ON_SCREEN_STORAGE_KEY = "draftDiff.pagesOnScreen";
const FILE_VIEW_STATES_STORAGE_KEY = "draftDiff.fileViewStates";
const PROJECT_STATE_CACHE_STORAGE_KEY = "draftDiff.projectStatesByPath";
const DEFAULT_PAGES_ON_SCREEN = 2;
const VIEW_STATE_VERSION = StateCore.VIEW_STATE_VERSION;
const HISTORY_LIMIT = 100;
const MIN_PAGE_PANE_PERCENT = StateCore.MIN_PAGE_PANE_PERCENT;
const MAX_SAVE_RETRIES = 3;
const AUTOSAVE_DELAY_MS = 2000;
const WORD_COUNT_REFRESH_DELAY_MS = 350;
const UNDO_TYPING_GROUP_WINDOW_MS = 1200;
const UNDO_TYPING_GROUP_MAX_MS = 5000;
const DRAFT_VERSION_CAPTURE_DELAY_MS = 2500;
const FORMAT_DEFAULT_VERSION = StateCore.FORMAT_DEFAULT_VERSION;
const LEGACY_DEFAULT_FONT_FAMILY = StateCore.LEGACY_DEFAULT_FONT_FAMILY;
const DIFF_PROGRESS_FRAME_DELAY_MS = 0;
const DIFF_BLOCK_CACHE_LIMIT = 160;
const DIFF_RESULT_CACHE_LIMIT = 80;
const DIFF_RESULT_MAX_CACHE_PARTS = 20000;

let state = null;
let selectedDraftId = null;
let activeArea = "draft";
let saveTimer = null;
let pageSaveTimer = null;
let isSaving = false;
let showChanges = false;
let exportPath = "";
let activeEditorKey = STORY_KEY;
let projectFileName = "draft-history.txt";
let linkedTextPath = "";
let versionHistoryFolderPath = "";
let versionHistoryPath = "";
let backupFolderPath = "";
let backupFolderMissing = false;
let isPromptingForBackupFolder = false;
let stateRevision = 0;
let saveQueued = false;
let pendingPageSaveKeys = new Set();
let pendingPageVersionHistorySaveKeys = new Set();
let saveRetryCount = 0;
let isClosingApp = false;
let summaryProgressTimer = null;
let latestSummaryReportPath = "";
let viewStateSaveTimer = null;
let isSavingViewState = false;
let viewStateSaveQueued = false;
let typingUndoGroup = null;
let draftNoteStatsTimers = new Map();
let draftVersionTimers = new Map();
let notesHeadingDensityFrame = null;
let notesHeadingResizeObserver = null;
let draftHeadingDensityFrame = null;
let draftHeadingResizeObserver = null;

let fileViewStates = readStoredFileViewStates();
let displayedPageKeys = new Set();
let hasStoredDisplaySelection = false;
let collapsedNotesIds = new Set();
let notesPanePercents = {};
let pagePanePercents = {};
let pagesOnScreen = DEFAULT_PAGES_ON_SCREEN;
let resizingDraftId = null;
let pageDividerDrag = null;
let compareHighlightTimer = null;
let editorSelections = {};
let undoStack = [];
let redoStack = [];
let isRestoringHistory = false;
let panelDragEnabled = false;
let detachedUnitKeys = new Set();
let detachedPanelWindows = new Map();
let tabScrollbarDrag = null;
let fallbackZoomFactor = 1;
let recentSubmenuTracking = false;
let diffRenderToken = 0;
const diffBlockCache = new Map();
const diffResultCache = new Map();
const diffMeaningfulTermsCache = new WeakMap();
let versionHistoryDraftId = null;
let searchRefreshTimer = null;
let spellcheckMenu = null;
let spellcheckRange = null;
let ignoredSpellcheckWords = new Set();
let searchState = {
  open: false,
  query: "",
  selectedKeys: new Set(),
  activeIndexes: {},
  activeKey: null,
  lastSignature: "",
  shouldScrollToFirst: false,
  results: new Map()
};

const DETACHED_PANEL_CHANNEL = "draftDiff.detachedPanels";
const SEARCH_MATCH_HIGHLIGHT = "draft-diff-search-match";
const SEARCH_ACTIVE_HIGHLIGHT = "draft-diff-search-active";
const detachedPanelChannel = "BroadcastChannel" in window
  ? new BroadcastChannel(DETACHED_PANEL_CHANNEL)
  : null;

const DEFAULT_FORMAT = StateCore.DEFAULT_FORMAT;
const FONT_FAMILY_OPTIONS = StateCore.FONT_FAMILY_OPTIONS;
const FONT_SIZE_OPTIONS = StateCore.FONT_SIZE_OPTIONS;
const LINE_HEIGHT_OPTIONS = StateCore.LINE_HEIGHT_OPTIONS;
const toolbarIcons = ToolbarCore.toolbarIcons;
const sanitizeRichHtml = RichTextCore.sanitizeRichHtml;
const execRichTextCommand = RichTextCore.execRichTextCommand;
const insertClipboardHtml = RichTextCore.insertClipboardHtml;
const insertPlainText = RichTextCore.insertPlainText;

const allowedFontFamilies = new Set(FONT_FAMILY_OPTIONS);
const allowedFontSizes = new Set(FONT_SIZE_OPTIONS);
const allowedLineHeights = new Set(LINE_HEIGHT_OPTIONS);

function allowedFormatValuesForField(field) {
  if (field === "fontFamily") return allowedFontFamilies;
  if (field === "fontSize") return allowedFontSizes;
  if (field === "lineHeight") return allowedLineHeights;
  return new Set();
}

const MENU_SHORTCUT_LABELS = {
  new: { mac: "⌘N", default: "Ctrl+N" },
  open: { mac: "⌘O", default: "Ctrl+O" },
  openLocation: { mac: "⌘⌥O", default: "Ctrl+Alt+O" },
  saveAs: { mac: "⌘⇧S", default: "Ctrl+Shift+S" },
  close: { mac: "⌘W", default: "Ctrl+W" },
  undo: { mac: "⌘Z", default: "Ctrl+Z" },
  redo: { mac: "⌘⇧Z", default: "Ctrl+Y" },
  search: { mac: "Cmd+F", default: "Ctrl+F" },
  zoomIn: { mac: "⌘+", default: "Ctrl++" },
  zoomOut: { mac: "⌘-", default: "Ctrl+-" },
  pages1: { mac: "⌘1", default: "Ctrl+1" },
  pages2: { mac: "⌘2", default: "Ctrl+2" },
  pages3: { mac: "⌘3", default: "Ctrl+3" },
  pages4: { mac: "⌘4", default: "Ctrl+4" }
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

function setFallbackZoom(direction) {
  const step = direction === "out" ? -0.1 : 0.1;
  fallbackZoomFactor = Math.min(2, Math.max(0.5, Number((fallbackZoomFactor + step).toFixed(2))));
  document.documentElement.style.zoom = String(fallbackZoomFactor);
}

function zoomView(direction) {
  if (direction === "in") {
    window.draftDiffDesktop?.zoomIn?.();
  } else {
    window.draftDiffDesktop?.zoomOut?.();
  }

  if (!window.draftDiffDesktop) setFallbackZoom(direction);
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

  if (!event.shiftKey && key === "f") {
    event.preventDefault();
    openSearch({ scope: "all" });
    closeTopMenus();
    return true;
  }

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

  if (!event.shiftKey && key === "w") {
    event.preventDefault();
    closeApp();
    return true;
  }

  if (key === "+" || key === "=") {
    event.preventDefault();
    zoomView("in");
    return true;
  }

  if (key === "-" || key === "_") {
    event.preventDefault();
    zoomView("out");
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

function formatVersionDate(iso) {
  const date = new Date(iso);
  if (Number.isNaN(date.valueOf())) return iso;
  const now = new Date();
  const options = date.getFullYear() === now.getFullYear()
    ? { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }
    : { month: "short", day: "numeric", year: "2-digit", hour: "numeric", minute: "2-digit" };
  return new Intl.DateTimeFormat(undefined, options).format(date);
}

function formatDateForExport(iso) {
  const date = new Date(iso);
  if (Number.isNaN(date.valueOf())) return iso;
  return new Intl.DateTimeFormat("en-GB", {
    dateStyle: "full",
    timeStyle: "short"
  }).format(date);
}

function compactTitleHtml(fullTitle, shortTitle) {
  return `
    <span class="compact-title" title="${escapeHtml(fullTitle)}">
      <span class="compact-title-full">${escapeHtml(fullTitle)}</span>
      <span class="compact-title-short" aria-hidden="true">${escapeHtml(shortTitle)}</span>
    </span>
  `;
}

function draftContentKey(draftId) {
  return `draft:${draftId}:content`;
}

function draftNotesKey(draftId) {
  return `draft:${draftId}:notes`;
}

function draftUnitKey(draftId) {
  return `draft:${draftId}`;
}

function parseDraftPageKey(key) {
  if (key === STORY_KEY) return { type: "story" };
  const match = /^draft:(.+):(content|notes)$/.exec(key);
  if (!match) return null;
  return { type: match[2], draftId: match[1] };
}

function parseDetachedUnitKey(key) {
  if (key === STORY_KEY) return { type: "story" };
  const match = /^draft:(.+)$/.exec(String(key || ""));
  if (!match) return null;
  return { type: "draft", draftId: match[1] };
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

function viewStateUpdatedAtMs(viewState) {
  const time = Date.parse(viewState?.updatedAt || "");
  return Number.isFinite(time) ? time : 0;
}

function newestViewState(...viewStates) {
  return viewStates
    .filter(viewState => viewState && typeof viewState === "object" && !Array.isArray(viewState))
    .sort((left, right) => viewStateUpdatedAtMs(right) - viewStateUpdatedAtMs(left))[0] || null;
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

function draftHasVisibleMainPanel(draft) {
  if (!draft || !displayedPageKeys.has(draftContentKey(draft.id))) return false;
  return !detachedUnitKeys.has(draftUnitKey(draft.id));
}

function topLevelPageKeyForDraft(draftId) {
  return draftContentKey(draftId);
}

function topLevelDisplayPageKeys() {
  const keys = [];
  if (displayedPageKeys.has(STORY_KEY) && !detachedUnitKeys.has(STORY_KEY)) keys.push(STORY_KEY);
  state?.drafts?.forEach(draft => {
    if (draftHasVisibleMainPanel(draft)) keys.push(topLevelPageKeyForDraft(draft.id));
  });
  return keys;
}

function mainDisplayPageCount() {
  if (!state) return 0;
  let count = displayedPageKeys.has(STORY_KEY) && !detachedUnitKeys.has(STORY_KEY) ? 1 : 0;
  state.drafts.forEach(draft => {
    if (draftHasVisibleMainPanel(draft)) count += 1;
  });
  return count;
}

function versionHistoryPageCount() {
  if (!state || !versionHistoryDraftId) return 0;
  if (versionHistoryDraftId === STORY_KEY) return ensureProjectNotesVersionHistory().length;

  const draft = draftById(versionHistoryDraftId);
  return draft ? ensureDraftVersionHistory(draft).length : 0;
}

function currentPagesOnScreenLimit() {
  if (!state) return clampPagesOnScreen(DEFAULT_PAGES_ON_SCREEN);

  if (versionHistoryDraftId) {
    return Math.max(1, Math.min(4, versionHistoryPageCount() || 1));
  }

  if (showChanges) {
    return Math.max(1, Math.min(4, selectedCompareIndexes().length || 1));
  }

  return Math.max(1, Math.min(4, selectedDisplayPageCount() || 1));
}

function normalizePagesOnScreenForSelection(value) {
  return Math.min(clampPagesOnScreen(value), currentPagesOnScreenLimit());
}

function updatePagesOnScreenControls() {
  if (!els.pagesOnScreen) return;

  const maxPages = currentPagesOnScreenLimit();
  els.pagesOnScreen.querySelectorAll("[data-pages-on-screen]").forEach(button => {
    const value = Number(button.dataset.pagesOnScreen);
    const disabled = value > maxPages;
    button.disabled = disabled;
    button.setAttribute("aria-disabled", String(disabled));
    button.setAttribute("aria-pressed", String(!disabled && value === pagesOnScreen));
  });
}

function syncPagesOnScreenToDisplaySelection() {
  const normalizedPagesOnScreen = normalizePagesOnScreenForSelection(pagesOnScreen);
  if (normalizedPagesOnScreen !== pagesOnScreen) setPagesOnScreen(normalizedPagesOnScreen);
  else updatePagesOnScreenControls();
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

function saveLayoutViewState() {
  saveCurrentViewState({ syncDom: false });
}

function saveNotesPanePercents() {
  saveLayoutViewState();
}

function savePagePanePercents() {
  saveLayoutViewState();
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
  const draft = {
    id: makeId("draft"),
    title: `Draft ${index}`,
    createdAt,
    updatedAt: createdAt,
    content: copyFrom?.content || "",
    contentHtml: copyFrom?.contentHtml || textToHtml(copyFrom?.content || ""),
    format: copyFrom?.format ? { ...normalizeFormat(copyFrom.format) } : { ...defaultFormat },
    notes: {
      id: makeId("notes"),
      title: `Draft ${index} Notes`,
      createdAt,
      updatedAt: createdAt,
      content: "",
      contentHtml: "",
      format: { ...defaultFormat }
    }
  };
  return draft;
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
      updatedAt: createdAt,
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

function closestElement(target, selector) {
  const element = target instanceof Element ? target : target?.parentElement;
  return element?.closest?.(selector) || null;
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
    state: projectStateFromSnapshot(serializeProjectState(projectState, {
      includeVersionHistory: !versionHistoryFolderPath
    }))
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

function syncBackupMenu() {
  if (!els.fileActivateBackup) return;

  const active = Boolean(backupFolderPath);
  els.fileActivateBackup.setAttribute("aria-pressed", String(active));
  els.fileActivateBackup.title = backupFolderMissing && active
    ? `Backup folder missing: ${backupFolderPath}`
    : active
    ? `Backups active: ${backupFolderPath}\\original txt; summaries: ${backupFolderPath}\\version history summaries; JSON: ${backupFolderPath}\\json`
    : "Choose a backup and version history folder";
}

function closeFileMenu() {
  if (els.fileMenu) els.fileMenu.open = false;
  setRecentSubmenuOpen(false);
}

function closeTopMenus(exceptMenu = null) {
  [els.fileMenu, els.editMenu, els.viewMenu].forEach(menu => {
    if (menu && menu !== exceptMenu) menu.open = false;
  });
  if (exceptMenu !== els.fileMenu) setRecentSubmenuOpen(false);
}

function setRecentSubmenuOpen(open) {
  const isOpen = Boolean(open);
  els.fileOpenRecent?.classList.toggle("is-open", isOpen);
  els.fileOpenRecentButton?.setAttribute("aria-expanded", String(isOpen));
  if (isOpen) {
    startRecentSubmenuTracking();
  } else {
    stopRecentSubmenuTracking();
  }
}

function pointInRect(clientX, clientY, rect, padding = 0) {
  if (!rect) return false;
  return clientX >= rect.left - padding &&
    clientX <= rect.right + padding &&
    clientY >= rect.top - padding &&
    clientY <= rect.bottom + padding;
}

function pointInTriangle(point, a, b, c) {
  const sign = (p1, p2, p3) =>
    (p1.x - p3.x) * (p2.y - p3.y) - (p2.x - p3.x) * (p1.y - p3.y);
  const hasNegative = sign(point, a, b) < 0 || sign(point, b, c) < 0 || sign(point, c, a) < 0;
  const hasPositive = sign(point, a, b) > 0 || sign(point, b, c) > 0 || sign(point, c, a) > 0;
  return !(hasNegative && hasPositive);
}

function isPointInRecentSubmenuPanel(clientX, clientY) {
  if (!els.fileOpenRecentMenu) return false;
  return pointInRect(clientX, clientY, els.fileOpenRecentMenu.getBoundingClientRect(), 3);
}

function isPointInRecentSubmenuSafeArea(clientX, clientY) {
  if (!els.fileOpenRecent || !els.fileOpenRecentButton || !els.fileOpenRecentMenu) return false;

  const triggerRect = els.fileOpenRecentButton.getBoundingClientRect();
  const menuRect = els.fileOpenRecent.closest(".file-menu-panel")?.getBoundingClientRect();
  const submenuRect = els.fileOpenRecentMenu.getBoundingClientRect();
  if (pointInRect(clientX, clientY, triggerRect, 3) || pointInRect(clientX, clientY, submenuRect, 3)) return true;

  const bridgeRect = {
    left: Math.min(triggerRect.right, submenuRect.left),
    right: Math.max(triggerRect.right, submenuRect.left),
    top: Math.min(triggerRect.top, submenuRect.top),
    bottom: Math.max(menuRect?.bottom || triggerRect.bottom, submenuRect.bottom)
  };
  if (pointInRect(clientX, clientY, bridgeRect, 3)) return true;

  if (!menuRect) return false;
  return pointInTriangle(
    { x: clientX, y: clientY },
    { x: menuRect.left, y: triggerRect.top },
    { x: triggerRect.right, y: triggerRect.bottom },
    { x: triggerRect.right, y: menuRect.bottom }
  );
}

function handleRecentSubmenuPointerMove(event) {
  if (!els.fileOpenRecent?.classList.contains("is-open")) return;
  if (!isPointInRecentSubmenuSafeArea(event.clientX, event.clientY)) setRecentSubmenuOpen(false);
}

function handleRecentSubmenuWheel(event) {
  if (!els.fileOpenRecent?.classList.contains("is-open")) return;

  if (!isPointInRecentSubmenuSafeArea(event.clientX, event.clientY)) {
    setRecentSubmenuOpen(false);
    return;
  }

  if (isPointInRecentSubmenuPanel(event.clientX, event.clientY) || !els.fileOpenRecentMenu) return;
  if (els.fileOpenRecentMenu.scrollHeight <= els.fileOpenRecentMenu.clientHeight) return;
  event.preventDefault();
  els.fileOpenRecentMenu.scrollTop += event.deltaY || event.deltaX;
}

function startRecentSubmenuTracking() {
  if (recentSubmenuTracking) return;
  recentSubmenuTracking = true;
  document.addEventListener("pointermove", handleRecentSubmenuPointerMove);
  document.addEventListener("wheel", handleRecentSubmenuWheel, { passive: false });
}

function stopRecentSubmenuTracking() {
  if (!recentSubmenuTracking) return;
  recentSubmenuTracking = false;
  document.removeEventListener("pointermove", handleRecentSubmenuPointerMove);
  document.removeEventListener("wheel", handleRecentSubmenuWheel);
}

function setStatus(text) {
  const statusText = String(text || "").replace(/^Saved\s+/, "Saved · ");
  const statusTextEl = els.saveStatus.querySelector(".status-text");
  if (statusTextEl) {
    statusTextEl.textContent = statusText;
  } else {
    els.saveStatus.textContent = statusText;
  }
  els.saveStatus.title = statusText;
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
  return StateCore.normalizeFormat(format);
}

function upgradeLegacyDefaultFormat(format = {}, shouldUpgrade = false) {
  return StateCore.upgradeLegacyDefaultFormat(format, shouldUpgrade);
}

function currentDefaultFormat(projectState = null) {
  return StateCore.currentDefaultFormat(projectState);
}

function migrateLegacyDefaultFonts(projectState) {
  return StateCore.migrateLegacyDefaultFonts(projectState);
}

function projectStateWithoutVersionHistory(projectState) {
  return StateCore.stateWithoutVersionHistory(projectState);
}

function serializeProjectState(projectState = state, options = {}) {
  return StateCore.serializeProjectState(projectState, options);
}

function projectStateFromSnapshot(snapshot) {
  return StateCore.projectStateFromSnapshot(snapshot);
}

function markStateChanged() {
  stateRevision += 1;
}

function queueSave(delay = AUTOSAVE_DELAY_MS) {
  clearPendingPageSaves();
  window.clearTimeout(saveTimer);
  saveTimer = window.setTimeout(saveNow, delay);
}

function clearPendingPageSaves() {
  pendingPageSaveKeys.clear();
  pendingPageVersionHistorySaveKeys.clear();
  window.clearTimeout(pageSaveTimer);
  pageSaveTimer = null;
}

function queuePendingPageSaves(delay = 0) {
  if (!pendingPageSaveKeys.size) return;
  window.clearTimeout(pageSaveTimer);
  pageSaveTimer = window.setTimeout(savePendingPagesNow, delay);
}

function queuePageSave(pageKey, delay = AUTOSAVE_DELAY_MS, options = {}) {
  if (!pageKey) return;
  pendingPageSaveKeys.add(pageKey);
  if (options.includeVersionHistory) pendingPageVersionHistorySaveKeys.add(pageKey);
  queuePendingPageSaves(delay);
}

function pageSavePayload(pageKey, options = {}) {
  const page = pageForEditorKey(pageKey);
  if (!page) return null;

  ensurePageFields(page);
  const parsed = parseDraftPageKey(pageKey);
  const payloadPage = {
    content: page.content,
    contentHtml: page.contentHtml,
    format: normalizeFormat(page.format)
  };
  if (parsed?.type === "content") payloadPage.title = page.title || "";
  if (options.includeVersionHistory && Array.isArray(page.versionHistory)) {
    payloadPage.versionHistory = page.versionHistory;
  }

  return {
    key: pageKey,
    page: payloadPage
  };
}

function pageKeyForTitleInput(titleInput) {
  const draftId = titleInput?.dataset?.titleDraftId;
  return draftId && draftExists(draftId) ? draftContentKey(draftId) : "";
}

function syncDraftTitleInput(titleInput) {
  const draft = draftById(titleInput?.dataset?.titleDraftId);
  if (!draft) return "";

  const nextTitle = titleInput.value || "Untitled draft";
  if (draft.title !== nextTitle) {
    draft.title = nextTitle;
    draft.updatedAt = nowIso();
  }
  if (draft.notes) draft.notes.title = `${draft.title} Notes`;
  return draftContentKey(draft.id);
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

function isPageHistoryEntry(entry) {
  return entry?.type === "page" && typeof entry.key === "string";
}

function isDraftStructureHistoryEntry(entry) {
  return entry?.type === "draft-structure" && Array.isArray(entry.draftOrder);
}

function isProjectFormatHistoryEntry(entry) {
  return entry?.type === "project-format" && Array.isArray(entry.pageFormats);
}

function isFullHistoryEntry(entry) {
  return typeof entry === "string" || entry?.type === "full";
}

function fullHistorySnapshot(entry) {
  return typeof entry === "string" ? entry : entry?.snapshot || "";
}

function pageHistorySnapshot(page) {
  if (!page) return null;
  ensurePageFields(page);
  return {
    title: page.title || "",
    content: page.content || "",
    contentHtml: page.contentHtml || "",
    format: normalizeFormat(page.format),
    updatedAt: page.updatedAt || page.createdAt || nowIso()
  };
}

function pageHistoryEntryForKey(pageKey) {
  const page = pageForEditorKey(pageKey);
  const snapshot = pageHistorySnapshot(page);
  return snapshot ? { type: "page", key: pageKey, page: snapshot } : null;
}

function cloneHistoryValue(value) {
  return JSON.parse(JSON.stringify(value));
}

function draftHistorySnapshot(draft) {
  if (!draft?.id) return null;
  const { versionHistory, ...draftSnapshot } = draft;
  const snapshot = {
    ...draftSnapshot,
    format: normalizeFormat(draft.format)
  };

  if (draft.notes) {
    const { versionHistory: notesVersionHistory, ...notesSnapshot } = draft.notes;
    snapshot.notes = {
      ...notesSnapshot,
      format: normalizeFormat(draft.notes.format)
    };
  }

  return cloneHistoryValue(snapshot);
}

function compactDraftStructureIds(affectedDraftIds = []) {
  const ids = new Set(affectedDraftIds.filter(Boolean));
  if (selectedDraftId) ids.add(selectedDraftId);
  const parsedActive = parseDraftPageKey(activeEditorKey);
  if (parsedActive?.draftId) ids.add(parsedActive.draftId);
  if (versionHistoryDraftId && versionHistoryDraftId !== STORY_KEY) ids.add(versionHistoryDraftId);
  return Array.from(ids);
}

function draftStructureHistoryEntry(affectedDraftIds = []) {
  if (!state) return null;

  const draftIds = compactDraftStructureIds(affectedDraftIds);
  const draftsById = new Map((state.drafts || []).map(draft => [draft.id, draft]));
  const draftSnapshots = draftIds
    .map(draftId => draftHistorySnapshot(draftsById.get(draftId)))
    .filter(Boolean);

  return {
    type: "draft-structure",
    affectedDraftIds: Array.from(new Set(affectedDraftIds.filter(Boolean))),
    draftOrder: (state.drafts || []).map(draft => draft.id).filter(Boolean),
    drafts: draftSnapshots,
    selectedDraftId,
    activeArea,
    activeEditorKey,
    displayedPageKeys: Array.from(displayedPageKeys),
    collapsedNotesIds: Array.from(collapsedNotesIds),
    versionHistoryDraftId
  };
}

function pageFormatHistorySnapshot(entry) {
  if (!entry?.key || !entry.page) return null;
  ensurePageFields(entry.page);
  return {
    key: entry.key,
    format: normalizeFormat(entry.page.format)
  };
}

function projectFormatHistoryEntry() {
  if (!state) return null;
  return {
    type: "project-format",
    defaultFormat: normalizeFormat(state.defaultFormat),
    pageFormats: Array.from(pageEntriesForProjectState(state).values())
      .map(pageFormatHistorySnapshot)
      .filter(Boolean),
    activeEditorKey
  };
}

function pageHistorySignature(entry) {
  if (!isPageHistoryEntry(entry)) return "";
  return JSON.stringify({
    key: entry.key,
    title: entry.page?.title || "",
    content: entry.page?.content || "",
    contentHtml: entry.page?.contentHtml || "",
    format: normalizeFormat(entry.page?.format || {})
  });
}

function draftStructureHistorySignature(entry) {
  if (!isDraftStructureHistoryEntry(entry)) return "";
  return JSON.stringify({
    affectedDraftIds: entry.affectedDraftIds || [],
    draftOrder: entry.draftOrder || [],
    drafts: entry.drafts || [],
    selectedDraftId: entry.selectedDraftId || "",
    activeArea: entry.activeArea || "",
    activeEditorKey: entry.activeEditorKey || "",
    displayedPageKeys: entry.displayedPageKeys || [],
    collapsedNotesIds: entry.collapsedNotesIds || [],
    versionHistoryDraftId: entry.versionHistoryDraftId || ""
  });
}

function projectFormatHistorySignature(entry) {
  if (!isProjectFormatHistoryEntry(entry)) return "";
  return JSON.stringify({
    defaultFormat: normalizeFormat(entry.defaultFormat),
    pageFormats: entry.pageFormats || [],
    activeEditorKey: entry.activeEditorKey || ""
  });
}

function historyEntriesMatch(left, right) {
  if (isPageHistoryEntry(left) || isPageHistoryEntry(right)) {
    return isPageHistoryEntry(left)
      && isPageHistoryEntry(right)
      && pageHistorySignature(left) === pageHistorySignature(right);
  }

  if (isDraftStructureHistoryEntry(left) || isDraftStructureHistoryEntry(right)) {
    return isDraftStructureHistoryEntry(left)
      && isDraftStructureHistoryEntry(right)
      && draftStructureHistorySignature(left) === draftStructureHistorySignature(right);
  }

  if (isProjectFormatHistoryEntry(left) || isProjectFormatHistoryEntry(right)) {
    return isProjectFormatHistoryEntry(left)
      && isProjectFormatHistoryEntry(right)
      && projectFormatHistorySignature(left) === projectFormatHistorySignature(right);
  }

  if (isFullHistoryEntry(left) || isFullHistoryEntry(right)) {
    return isFullHistoryEntry(left)
      && isFullHistoryEntry(right)
      && fullHistorySnapshot(left) === fullHistorySnapshot(right);
  }

  return false;
}

function pushUndoHistoryEntry(entry) {
  if (!entry || historyEntriesMatch(entry, undoStack[undoStack.length - 1])) return;

  undoStack.push(entry);
  if (undoStack.length > HISTORY_LIMIT) undoStack.shift();
  redoStack = [];
  updateUndoRedoControls();
}

function recordUndoSnapshot() {
  if (!state || isRestoringHistory) return;
  typingUndoGroup = null;

  const snapshot = serializeProjectState(state, { includeVersionHistory: false });
  if (!snapshot) return;
  pushUndoHistoryEntry(snapshot);
}

function recordPageUndoSnapshot(pageKey) {
  if (!state || isRestoringHistory) return;
  typingUndoGroup = null;

  pushUndoHistoryEntry(pageHistoryEntryForKey(pageKey));
}

function recordDraftStructureUndoSnapshot(affectedDraftIds = []) {
  if (!state || isRestoringHistory) return;
  typingUndoGroup = null;
  pushUndoHistoryEntry(draftStructureHistoryEntry(affectedDraftIds));
}

function recordProjectFormatUndoSnapshot() {
  if (!state || isRestoringHistory) return;
  typingUndoGroup = null;
  pushUndoHistoryEntry(projectFormatHistoryEntry());
}

function isGroupedTypingInput(inputType) {
  return /^(insertText|insertCompositionText|insertParagraph|deleteContentBackward|deleteContentForward)$/u
    .test(String(inputType || ""));
}

function undoTargetForInputEvent(event) {
  const editorEl = closestElement(event.target, "[data-editor-key]");
  if (editorEl) {
    return {
      type: "page",
      key: editorEl.dataset.editorKey,
      grouped: isGroupedTypingInput(event.inputType)
    };
  }

  const titleInput = closestElement(event.target, "[data-title-draft-id]");
  if (titleInput) {
    const pageKey = pageKeyForTitleInput(titleInput);
    if (!pageKey) return null;
    return {
      type: "page",
      key: pageKey,
      grouped: isGroupedTypingInput(event.inputType)
    };
  }

  return null;
}

function recordUndoSnapshotForInput(event) {
  const target = undoTargetForInputEvent(event);
  if (!target) return;

  if (!target.grouped) {
    if (target.type === "page") {
      recordPageUndoSnapshot(target.key);
    } else {
      recordUndoSnapshot();
    }
    return;
  }

  const now = performance.now();
  const canContinueGroup = typingUndoGroup
    && typingUndoGroup.key === target.key
    && now - typingUndoGroup.lastAt <= UNDO_TYPING_GROUP_WINDOW_MS
    && now - typingUndoGroup.startedAt <= UNDO_TYPING_GROUP_MAX_MS;

  if (canContinueGroup) {
    typingUndoGroup.lastAt = now;
    return;
  }

  if (target.type === "page") {
    recordPageUndoSnapshot(target.key);
  } else {
    recordUndoSnapshot();
  }
  typingUndoGroup = { key: target.key, startedAt: now, lastAt: now };
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
  const versionHistories = draftVersionHistoriesById();
  state = projectStateFromSnapshot(snapshot);
  restoreDraftVersionHistories(state, versionHistories);
  editorSelections = {};
  reconcileViewAfterHistoryRestore();
  render();
  scheduleSave();
  updateUndoRedoControls();
  focusPageEditor(activeEditorKey);
  isRestoringHistory = false;
}

function pageEntriesForProjectState(projectState) {
  const entries = new Map();
  if (!projectState) return entries;

  if (projectState.initialNotes) {
    entries.set(STORY_KEY, {
      key: STORY_KEY,
      page: projectState.initialNotes,
      type: "story"
    });
  }

  projectState.drafts?.forEach(draft => {
    if (!draft?.id) return;
    entries.set(draftContentKey(draft.id), {
      key: draftContentKey(draft.id),
      page: draft,
      type: "draft"
    });
    if (draft.notes) {
      entries.set(draftNotesKey(draft.id), {
        key: draftNotesKey(draft.id),
        page: draft.notes,
        type: "notes"
      });
    }
  });

  return entries;
}

function comparablePageSnapshot(entry) {
  if (!entry?.page) return "";
  const format = normalizeFormat(entry.page.format);
  return JSON.stringify({
    title: entry.page.title || "",
    content: entry.page.content || "",
    contentHtml: entry.page.contentHtml || "",
    format
  });
}

function pagePlainTextForHistory(entry) {
  if (!entry?.page) return "";
  return entry.page.content || plainTextFromHtml(entry.page.contentHtml || "");
}

function firstChangedTextOffset(beforeText, afterText) {
  const before = String(beforeText || "");
  const after = String(afterText || "");
  let offset = 0;
  const limit = Math.min(before.length, after.length);

  while (offset < limit && before[offset] === after[offset]) {
    offset += 1;
  }

  return Math.min(offset, after.length);
}

function historyChangeCandidateKeys(fromEntries, toEntries, preferredKey) {
  const keys = new Set();
  if (preferredKey) keys.add(preferredKey);
  if (selectedDraftId) {
    keys.add(draftContentKey(selectedDraftId));
    keys.add(draftNotesKey(selectedDraftId));
  }
  keys.add(STORY_KEY);
  toEntries.forEach((_, key) => keys.add(key));
  fromEntries.forEach((_, key) => keys.add(key));
  return Array.from(keys);
}

function findHistoryChangeTarget(fromState, toState, preferredKey = activeEditorKey) {
  const fromEntries = pageEntriesForProjectState(fromState);
  const toEntries = pageEntriesForProjectState(toState);
  const keys = historyChangeCandidateKeys(fromEntries, toEntries, preferredKey);

  for (const key of keys) {
    const beforeEntry = fromEntries.get(key);
    const afterEntry = toEntries.get(key);
    if (!beforeEntry && !afterEntry) continue;
    if (comparablePageSnapshot(beforeEntry) === comparablePageSnapshot(afterEntry)) continue;

    const targetEntry = afterEntry || beforeEntry;
    const beforeText = pagePlainTextForHistory(beforeEntry);
    const afterText = pagePlainTextForHistory(afterEntry);
    const titleChanged = (beforeEntry?.page?.title || "") !== (afterEntry?.page?.title || "");
    const textChanged = beforeText !== afterText || (beforeEntry?.page?.contentHtml || "") !== (afterEntry?.page?.contentHtml || "");

    return {
      key: targetEntry.key,
      type: textChanged ? "text" : (titleChanged ? "title" : "panel"),
      offset: firstChangedTextOffset(beforeText, afterText)
    };
  }

  return null;
}

function makeHistoryTargetVisible(target) {
  if (!target?.key) return;

  if (target.key === STORY_KEY) {
    displayPage(STORY_KEY, true);
    activeArea = "story";
    activeEditorKey = STORY_KEY;
    return;
  }

  const parsed = parseDraftPageKey(target.key);
  if (!parsed?.draftId || !draftExists(parsed.draftId)) return;

  selectedDraftId = parsed.draftId;
  activeArea = "draft";
  activeEditorKey = target.key;
  displayPage(draftContentKey(parsed.draftId), true);
  if (parsed.type === "notes") collapsedNotesIds.delete(parsed.draftId);
}

function restoreHistorySnapshotWithTarget(snapshot, target) {
  isRestoringHistory = true;
  const versionHistories = draftVersionHistoriesById();
  state = projectStateFromSnapshot(snapshot);
  restoreDraftVersionHistories(state, versionHistories);
  editorSelections = {};
  reconcileViewAfterHistoryRestore();
  makeHistoryTargetVisible(target);
  render();
  scheduleSave();
  updateUndoRedoControls();
  revealHistoryChange(target);
  isRestoringHistory = false;
}

function pageHistoryEntryForTarget(entry) {
  if (!isPageHistoryEntry(entry)) return null;
  return {
    key: entry.key,
    page: entry.page,
    type: parseDraftPageKey(entry.key)?.type || "page"
  };
}

function findPageHistoryChangeTarget(fromEntry, toEntry) {
  if (!isPageHistoryEntry(fromEntry) || !isPageHistoryEntry(toEntry)) return null;

  const beforeEntry = pageHistoryEntryForTarget(fromEntry);
  const afterEntry = pageHistoryEntryForTarget(toEntry);
  const beforeText = pagePlainTextForHistory(beforeEntry);
  const afterText = pagePlainTextForHistory(afterEntry);
  const titleChanged = (beforeEntry?.page?.title || "") !== (afterEntry?.page?.title || "");
  const textChanged = beforeText !== afterText || (beforeEntry?.page?.contentHtml || "") !== (afterEntry?.page?.contentHtml || "");

  return {
    key: toEntry.key,
    type: textChanged ? "text" : (titleChanged ? "title" : "panel"),
    offset: firstChangedTextOffset(beforeText, afterText)
  };
}

function applyPageHistoryEntry(entry) {
  if (!isPageHistoryEntry(entry)) return false;

  const parsed = parseDraftPageKey(entry.key);
  const page = pageForEditorKey(entry.key);
  if (!parsed || !page || !entry.page) return false;

  const snapshot = pageHistorySnapshot(entry.page);
  if (!snapshot) return false;

  page.content = snapshot.content;
  page.contentHtml = snapshot.contentHtml;
  page.format = snapshot.format;
  page.updatedAt = snapshot.updatedAt || nowIso();

  if (parsed.type === "content" && typeof snapshot.title === "string") {
    page.title = snapshot.title.trim() || "Untitled draft";
    if (page.notes) page.notes.title = `${page.title} Notes`;
  } else if (parsed.type === "story" && typeof snapshot.title === "string") {
    page.title = snapshot.title || PROJECT_NOTES_TITLE;
  }

  ensurePageFields(page);
  return true;
}

function restorePageHistoryEntryWithTarget(entry, target) {
  isRestoringHistory = true;
  if (!applyPageHistoryEntry(entry)) {
    isRestoringHistory = false;
    updateUndoRedoControls();
    return;
  }

  editorSelections = {
    ...editorSelections,
    [entry.key]: {}
  };
  makeHistoryTargetVisible(target || { key: entry.key, type: "text", offset: 0 });
  render();
  schedulePageSave(entry.key);
  updateUndoRedoControls();
  revealHistoryChange(target || { key: entry.key, type: "text", offset: 0 });
  isRestoringHistory = false;
}

function pageKeyForDraftStructureEntry(entry) {
  if (pageKeyExists(entry?.activeEditorKey)) return entry.activeEditorKey;
  if (entry?.activeArea === "story") return STORY_KEY;
  return draftContentKey(selectedDraftId);
}

function applyDraftStructureHistoryEntry(entry) {
  if (!state || !isDraftStructureHistoryEntry(entry)) return false;

  const currentDrafts = new Map((state.drafts || []).map(draft => [draft.id, draft]));
  const snapshots = new Map((entry.drafts || []).map(draft => [draft.id, draft]));
  const nextDrafts = [];

  (entry.draftOrder || []).forEach(draftId => {
    const existingDraft = currentDrafts.get(draftId);
    if (existingDraft) {
      nextDrafts.push(existingDraft);
      return;
    }

    const snapshot = snapshots.get(draftId);
    if (snapshot) nextDrafts.push(cloneHistoryValue(snapshot));
  });

  const nextIds = new Set(nextDrafts.map(draft => draft.id));
  (state.drafts || []).forEach(draft => {
    if (nextIds.has(draft.id)) return;
    clearDraftVersionTimer(draft.id);
    delete editorSelections[draftContentKey(draft.id)];
    delete editorSelections[draftNotesKey(draft.id)];
  });

  state.drafts = nextDrafts.length ? nextDrafts : [createDraft(null)];
  selectedDraftId = draftExists(entry.selectedDraftId) ? entry.selectedDraftId : state.drafts[0]?.id || null;
  activeArea = entry.activeArea === "story" ? "story" : "draft";
  activeEditorKey = pageKeyExists(entry.activeEditorKey)
    ? entry.activeEditorKey
    : (activeArea === "story" ? STORY_KEY : draftContentKey(selectedDraftId));
  versionHistoryDraftId = entry.versionHistoryDraftId === STORY_KEY || draftExists(entry.versionHistoryDraftId)
    ? entry.versionHistoryDraftId
    : null;

  displayedPageKeys = new Set((entry.displayedPageKeys || []).filter(pageKeyExists));
  collapsedNotesIds = new Set((entry.collapsedNotesIds || []).filter(draftExists));
  ensureDisplaySelection();
  return true;
}

function restoreDraftStructureHistoryEntryWithTarget(entry) {
  isRestoringHistory = true;
  if (!applyDraftStructureHistoryEntry(entry)) {
    isRestoringHistory = false;
    updateUndoRedoControls();
    return;
  }

  const target = { key: pageKeyForDraftStructureEntry(entry), type: "panel", offset: 0 };
  render();
  scheduleSave();
  queueViewStateSave(0);
  updateUndoRedoControls();
  revealHistoryChange(target);
  isRestoringHistory = false;
}

function applyProjectFormatHistoryEntry(entry) {
  if (!state || !isProjectFormatHistoryEntry(entry)) return false;

  state.defaultFormat = normalizeFormat(entry.defaultFormat);
  (entry.pageFormats || []).forEach(pageFormat => {
    const page = pageForEditorKey(pageFormat.key);
    if (!page) return;
    ensurePageFields(page);
    page.format = normalizeFormat(pageFormat.format);
  });
  return true;
}

function restoreProjectFormatHistoryEntryWithTarget(entry) {
  isRestoringHistory = true;
  if (!applyProjectFormatHistoryEntry(entry)) {
    isRestoringHistory = false;
    updateUndoRedoControls();
    return;
  }

  const target = { key: pageKeyExists(entry.activeEditorKey) ? entry.activeEditorKey : activeEditorKey, type: "panel", offset: 0 };
  makeHistoryTargetVisible(target);
  render();
  scheduleSave();
  updateUndoRedoControls();
  revealHistoryChange(target);
  isRestoringHistory = false;
}

function undoProjectChange() {
  typingUndoGroup = null;
  if (!undoStack.length) {
    updateUndoRedoControls();
    return;
  }

  const previousEntry = undoStack[undoStack.length - 1];
  if (isPageHistoryEntry(previousEntry)) {
    syncPageFromDom(previousEntry.key);
    undoStack.pop();
    const currentEntry = pageHistoryEntryForKey(previousEntry.key);
    if (currentEntry && !historyEntriesMatch(currentEntry, previousEntry)) redoStack.push(currentEntry);
    restorePageHistoryEntryWithTarget(previousEntry, findPageHistoryChangeTarget(currentEntry, previousEntry));
    return;
  }

  if (isDraftStructureHistoryEntry(previousEntry)) {
    syncFromInputs();
    undoStack.pop();
    const currentEntry = draftStructureHistoryEntry(previousEntry.affectedDraftIds || []);
    if (currentEntry && !historyEntriesMatch(currentEntry, previousEntry)) redoStack.push(currentEntry);
    restoreDraftStructureHistoryEntryWithTarget(previousEntry);
    return;
  }

  if (isProjectFormatHistoryEntry(previousEntry)) {
    syncFromInputs();
    undoStack.pop();
    const currentEntry = projectFormatHistoryEntry();
    if (currentEntry && !historyEntriesMatch(currentEntry, previousEntry)) redoStack.push(currentEntry);
    restoreProjectFormatHistoryEntryWithTarget(previousEntry);
    return;
  }

  syncFromInputs();
  undoStack.pop();
  const previousSnapshot = fullHistorySnapshot(previousEntry);
  const fromState = projectStateFromSnapshot(serializeProjectState(state, { includeVersionHistory: false }));
  const currentSnapshot = serializeProjectState(state, { includeVersionHistory: false });
  const toState = projectStateFromSnapshot(previousSnapshot);
  if (currentSnapshot && currentSnapshot !== previousSnapshot) redoStack.push(currentSnapshot);
  restoreHistorySnapshotWithTarget(previousSnapshot, findHistoryChangeTarget(fromState, toState));
}

function redoProjectChange() {
  typingUndoGroup = null;
  if (!redoStack.length) {
    updateUndoRedoControls();
    return;
  }

  const nextEntry = redoStack[redoStack.length - 1];
  if (isPageHistoryEntry(nextEntry)) {
    syncPageFromDom(nextEntry.key);
    redoStack.pop();
    const currentEntry = pageHistoryEntryForKey(nextEntry.key);
    if (currentEntry && !historyEntriesMatch(currentEntry, nextEntry)) {
      undoStack.push(currentEntry);
      if (undoStack.length > HISTORY_LIMIT) undoStack.shift();
    }
    restorePageHistoryEntryWithTarget(nextEntry, findPageHistoryChangeTarget(currentEntry, nextEntry));
    return;
  }

  if (isDraftStructureHistoryEntry(nextEntry)) {
    syncFromInputs();
    redoStack.pop();
    const currentEntry = draftStructureHistoryEntry(nextEntry.affectedDraftIds || []);
    if (currentEntry && !historyEntriesMatch(currentEntry, nextEntry)) {
      undoStack.push(currentEntry);
      if (undoStack.length > HISTORY_LIMIT) undoStack.shift();
    }
    restoreDraftStructureHistoryEntryWithTarget(nextEntry);
    return;
  }

  if (isProjectFormatHistoryEntry(nextEntry)) {
    syncFromInputs();
    redoStack.pop();
    const currentEntry = projectFormatHistoryEntry();
    if (currentEntry && !historyEntriesMatch(currentEntry, nextEntry)) {
      undoStack.push(currentEntry);
      if (undoStack.length > HISTORY_LIMIT) undoStack.shift();
    }
    restoreProjectFormatHistoryEntryWithTarget(nextEntry);
    return;
  }

  syncFromInputs();
  redoStack.pop();
  const nextSnapshot = fullHistorySnapshot(nextEntry);
  const fromState = projectStateFromSnapshot(serializeProjectState(state, { includeVersionHistory: false }));
  const currentSnapshot = serializeProjectState(state, { includeVersionHistory: false });
  const toState = projectStateFromSnapshot(nextSnapshot);
  if (currentSnapshot && currentSnapshot !== nextSnapshot) {
    undoStack.push(currentSnapshot);
    if (undoStack.length > HISTORY_LIMIT) undoStack.shift();
  }
  restoreHistorySnapshotWithTarget(nextSnapshot, findHistoryChangeTarget(fromState, toState));
}

function editableHistoryTarget(target) {
  return closestElement(target, "[data-editor-key], [data-title-draft-id]");
}

function ensurePageFields(page) {
  page.createdAt = page.createdAt || nowIso();
  page.updatedAt = page.updatedAt || page.createdAt;
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

function stateCoreHistoryOptions() {
  return {
    ensurePage: ensurePageFields,
    now: nowIso,
    sanitizeHtml: sanitizeRichHtml,
    textFromHtml: plainTextFromHtml
  };
}

function pageVersionSnapshot(page, fallbackTitle, timestamp = nowIso()) {
  ensurePageFields(page);
  return StateCore.pageVersionSnapshot(page, fallbackTitle, timestamp);
}

function versionHasMeaningfulContent(version) {
  return StateCore.versionHasMeaningfulContent(version);
}

function ensurePageVersionHistory(page, fallbackTitle) {
  return StateCore.ensurePageVersionHistory(page, fallbackTitle, stateCoreHistoryOptions());
}

function ensureDraftVersionHistory(draft) {
  return StateCore.ensureDraftVersionHistory(draft, stateCoreHistoryOptions());
}

function ensureProjectNotesVersionHistory(projectState = state) {
  return StateCore.ensureProjectNotesVersionHistory(projectState, stateCoreHistoryOptions());
}

function pageVersionSignature(version) {
  return StateCore.pageVersionSignature(version);
}

function versionHistoryTime(version) {
  return StateCore.versionHistoryTime(version);
}

function sortVersionHistoryByCreatedAt(history) {
  return StateCore.sortVersionHistoryByCreatedAt(history);
}

function latestVersionHistoryEntry(history) {
  return StateCore.latestVersionHistoryEntry(history);
}

function currentPageHistorySnapshot(page, fallbackTitle) {
  return StateCore.currentPageHistorySnapshot(page, fallbackTitle, stateCoreHistoryOptions());
}

function addCurrentPageToHistoryIfMissing(history, page, fallbackTitle) {
  return StateCore.addCurrentPageToHistoryIfMissing(history, page, fallbackTitle, stateCoreHistoryOptions());
}

function applyVersionHistoryEntryToPage(page, version, fallbackTitle) {
  return StateCore.applyVersionHistoryEntryToPage(page, version, fallbackTitle, stateCoreHistoryOptions());
}

function promotePageToNewestHistoryVersion(page, fallbackTitle) {
  return StateCore.promotePageToNewestHistoryVersion(page, fallbackTitle, stateCoreHistoryOptions());
}

function appendPageVersionIfChanged(page, fallbackTitle) {
  return StateCore.appendPageVersionIfChanged(page, fallbackTitle, stateCoreHistoryOptions());
}

function appendDraftVersionIfChanged(draft) {
  return appendPageVersionIfChanged(draft, draft?.title || "Untitled draft");
}

function appendProjectNotesVersionIfChanged() {
  return appendPageVersionIfChanged(state?.initialNotes, PROJECT_NOTES_TITLE);
}

function restoreDraftVersion(draftId, versionId) {
  const draft = draftById(draftId);
  if (!draft) return;

  const pageKey = draftContentKey(draft.id);
  syncPageFromDom(pageKey);
  const history = ensureDraftVersionHistory(draft);
  const versionIndex = history.findIndex(version => version.id === versionId);
  if (versionIndex < 0) return;

  const version = history[versionIndex];
  const label = `Draft ${draftVersionNumber(draft, versionIndex)}`;
  const confirmed = window.confirm(
    `Restore ${label}?\n\nThis will replace the current draft title, text, and formatting. The current draft will be kept in version history.`
  );
  if (!confirmed) return;

  recordPageUndoSnapshot(pageKey);
  clearDraftVersionTimer(draft.id);
  appendDraftVersionIfChanged(draft);

  const contentHtml = sanitizeRichHtml(version.contentHtml || textToHtml(version.content || ""));
  draft.title = version.title || draft.title || "Untitled draft";
  draft.contentHtml = contentHtml;
  draft.content = typeof version.content === "string" ? version.content : plainTextFromHtml(contentHtml);
  draft.format = normalizeFormat({ ...currentDefaultFormat(state), ...(version.format || {}) });
  draft.updatedAt = nowIso();
  if (draft.notes) draft.notes.title = `${draft.title} Notes`;

  appendDraftVersionIfChanged(draft);
  versionHistoryDraftId = draft.id;
  selectedDraftId = draft.id;
  activeArea = "draft";
  activeEditorKey = pageKey;
  displayPage(activeEditorKey, true);
  schedulePageSave(pageKey, {
    includeVersionHistory: true,
    refreshUi: false,
    refreshDiff: false
  });
  render();
  setStatus(`Restored ${label}; saving...`);
}

function restoreProjectNotesVersion(versionId) {
  if (!state?.initialNotes) return;

  syncPageFromDom(STORY_KEY);
  const history = ensureProjectNotesVersionHistory();
  const versionIndex = history.findIndex(version => version.id === versionId);
  if (versionIndex < 0) return;

  const version = history[versionIndex];
  const label = `Project notes ${versionIndex + 1}`;
  const confirmed = window.confirm(
    `Restore ${label}?\n\nThis will replace the current Project notes text and formatting. The current Project notes will be kept in version history.`
  );
  if (!confirmed) return;

  recordPageUndoSnapshot(STORY_KEY);
  clearDraftVersionTimer(STORY_KEY);
  appendProjectNotesVersionIfChanged();

  const contentHtml = sanitizeRichHtml(version.contentHtml || textToHtml(version.content || ""));
  state.initialNotes.title = PROJECT_NOTES_TITLE;
  state.initialNotes.contentHtml = contentHtml;
  state.initialNotes.content = typeof version.content === "string" ? version.content : plainTextFromHtml(contentHtml);
  state.initialNotes.format = normalizeFormat({ ...currentDefaultFormat(state), ...(version.format || {}) });
  state.initialNotes.updatedAt = nowIso();

  appendProjectNotesVersionIfChanged();
  versionHistoryDraftId = STORY_KEY;
  activeArea = "story";
  activeEditorKey = STORY_KEY;
  displayPage(STORY_KEY, true);
  schedulePageSave(STORY_KEY, {
    includeVersionHistory: true,
    refreshUi: false,
    refreshDiff: false
  });
  render();
  setStatus(`Restored ${label}; saving...`);
}

function clearDraftVersionTimer(draftId) {
  window.clearTimeout(draftVersionTimers.get(draftId));
  draftVersionTimers.delete(draftId);
}

function flushDraftVersionCapture(draftId, options = {}) {
  const draft = draftById(draftId);
  if (!draft) return false;

  clearDraftVersionTimer(draftId);
  const changed = appendDraftVersionIfChanged(draft);
  if (changed && options.markChanged !== false) {
    markStateChanged();
    rememberLinkedProjectState();
    if (versionHistoryDraftId === draftId) renderDiffSoon("Loading version history");
  }
  return changed;
}

function flushProjectNotesVersionCapture(options = {}) {
  if (!state?.initialNotes) return false;

  clearDraftVersionTimer(STORY_KEY);
  const changed = appendProjectNotesVersionIfChanged();
  if (changed && options.markChanged !== false) {
    markStateChanged();
    rememberLinkedProjectState();
    if (versionHistoryDraftId === STORY_KEY) renderDiffSoon("Loading version history");
  }
  return changed;
}

function flushVersionCapture(captureKey, options = {}) {
  return captureKey === STORY_KEY
    ? flushProjectNotesVersionCapture(options)
    : flushDraftVersionCapture(captureKey, options);
}

function scheduleVersionHistoryPageSave(pageKey, historyKey = pageKey) {
  schedulePageSave(pageKey, {
    includeVersionHistory: true,
    refreshUi: false,
    refreshDiff: false
  });
  if (versionHistoryDraftId === historyKey) renderDiffSoon("Loading version history");
}

function flushDraftVersionCaptures() {
  const changedCaptureKeys = [];
  [...draftVersionTimers.keys()].forEach(captureKey => {
    if (flushVersionCapture(captureKey, { markChanged: false })) changedCaptureKeys.push(captureKey);
  });
  return changedCaptureKeys;
}

function queueDraftVersionCapture(draftId) {
  if (!draftId || isRestoringHistory) return;

  clearDraftVersionTimer(draftId);
  draftVersionTimers.set(draftId, window.setTimeout(() => {
    draftVersionTimers.delete(draftId);
    if (appendDraftVersionIfChanged(draftById(draftId))) {
      scheduleVersionHistoryPageSave(draftContentKey(draftId), draftId);
    }
  }, DRAFT_VERSION_CAPTURE_DELAY_MS));
}

function queueProjectNotesVersionCapture() {
  if (isRestoringHistory) return;

  clearDraftVersionTimer(STORY_KEY);
  draftVersionTimers.set(STORY_KEY, window.setTimeout(() => {
    draftVersionTimers.delete(STORY_KEY);
    if (appendProjectNotesVersionIfChanged()) {
      scheduleVersionHistoryPageSave(STORY_KEY);
    }
  }, DRAFT_VERSION_CAPTURE_DELAY_MS));
}

function queueDraftVersionCaptureForEditor(editorEl) {
  const parsed = parseDraftPageKey(editorEl?.dataset.editorKey);
  if (parsed?.type === "story") queueProjectNotesVersionCapture();
  if (parsed?.type === "content") queueDraftVersionCapture(parsed.draftId);
}

function draftVersionHistoriesById(projectState = state) {
  const histories = new Map();
  if (Array.isArray(projectState?.initialNotes?.versionHistory)) {
    histories.set(STORY_KEY, projectState.initialNotes.versionHistory);
  }
  projectState?.drafts?.forEach(draft => {
    if (draft?.id && Array.isArray(draft.versionHistory)) {
      histories.set(draft.id, draft.versionHistory);
    }
  });
  return histories;
}

function restoreDraftVersionHistories(projectState, histories) {
  if (projectState?.initialNotes) {
    if (histories?.has(STORY_KEY)) projectState.initialNotes.versionHistory = histories.get(STORY_KEY);
    ensureProjectNotesVersionHistory(projectState);
    promotePageToNewestHistoryVersion(projectState.initialNotes, PROJECT_NOTES_TITLE);
  }
  projectState?.drafts?.forEach(draft => {
    if (histories?.has(draft.id)) draft.versionHistory = histories.get(draft.id);
    ensureDraftVersionHistory(draft);
    promotePageToNewestHistoryVersion(draft, draft.title || "Untitled draft");
  });
}

function fontStyle(format) {
  const normalized = normalizeFormat(format);
  return `font-family: ${normalized.fontFamily}; font-size: ${normalized.fontSize}px; line-height: ${normalized.lineHeight};`;
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

function pageSnapshotForPanel(key) {
  const item = pageItemForKey(key);
  if (!item) return null;
  const page = ensurePageFields(item.page);
  return {
    key,
    type: item.type,
    title: item.title,
    kicker: item.kicker,
    ariaLabel: item.ariaLabel,
    editableTitle: item.editableTitle,
    page: {
      title: page.title,
      createdAt: page.createdAt,
      updatedAt: page.updatedAt,
      content: page.content,
      contentHtml: page.contentHtml,
      format: normalizeFormat(page.format)
    }
  };
}

function snapshotForDetachedUnit(unitKey) {
  const parsed = parseDetachedUnitKey(unitKey);
  if (!parsed) return null;

  if (parsed.type === "story") {
    const story = pageSnapshotForPanel(STORY_KEY);
    return story ? {
      key: STORY_KEY,
      type: "story",
      title: story.title,
      pages: [story]
    } : null;
  }

  const draft = draftById(parsed.draftId);
  if (!draft) return null;
  const draftPage = pageSnapshotForPanel(draftContentKey(draft.id));
  const notesPage = pageSnapshotForPanel(draftNotesKey(draft.id));
  if (!draftPage || !notesPage) return null;

  return {
    key: draftUnitKey(draft.id),
    type: "draft",
    draftId: draft.id,
    title: draft.title,
    pages: [draftPage, notesPage]
  };
}

function applyPageSnapshot(key, snapshotPage) {
  const parsed = parseDraftPageKey(key);
  const page = pageForEditorKey(key);
  if (!parsed || !page || !snapshotPage) return false;

  ensurePageFields(page);
  let changed = false;

  if (typeof snapshotPage.content === "string" && page.content !== snapshotPage.content) {
    page.content = snapshotPage.content;
    changed = true;
  }
  if (typeof snapshotPage.contentHtml === "string") {
    const contentHtml = sanitizeRichHtml(snapshotPage.contentHtml);
    if (page.contentHtml !== contentHtml) {
      page.contentHtml = contentHtml;
      changed = true;
    }
  }
  if (snapshotPage.format) {
    const nextFormat = normalizeFormat({ ...page.format, ...snapshotPage.format });
    if (
      page.format.fontFamily !== nextFormat.fontFamily ||
      page.format.fontSize !== nextFormat.fontSize ||
      page.format.lineHeight !== nextFormat.lineHeight
    ) {
      page.format = nextFormat;
      changed = true;
    }
  }

  if (parsed.type === "content" && typeof snapshotPage.title === "string") {
    const draft = draftById(parsed.draftId);
    if (draft) {
      const nextTitle = snapshotPage.title.trim() || "Untitled draft";
      if (draft.title !== nextTitle) {
        draft.title = nextTitle;
        draft.notes.title = `${draft.title} Notes`;
        changed = true;
      }
    }
  }

  if (snapshotPage.updatedAt) {
    page.updatedAt = snapshotPage.updatedAt;
  } else if (changed) {
    page.updatedAt = nowIso();
  }

  if (parsed.type === "story" && changed) queueProjectNotesVersionCapture();
  if (parsed.type === "content" && changed) queueDraftVersionCapture(parsed.draftId);

  return true;
}

function applyDetachedUnitSnapshotPageKeys(unit) {
  const appliedPageKeys = [];
  if (!unit?.pages?.length) return appliedPageKeys;

  unit.pages.forEach(page => {
    if (page?.key && applyPageSnapshot(page.key, page.page || page)) {
      appliedPageKeys.push(page.key);
    }
  });
  return appliedPageKeys;
}

function applyDetachedUnitSnapshot(unit) {
  return applyDetachedUnitSnapshotPageKeys(unit).length > 0;
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

function draftFromStoredRef(draftId, draftIndex) {
  return state.drafts.find(draft => draft.id === draftId)
    || state.drafts[Number(draftIndex)]
    || state.drafts[0]
    || null;
}

function normalizeStoredEditorSelection(selection) {
  if (!selection || typeof selection !== "object" || Array.isArray(selection)) return null;

  const normalized = {};
  ["startOffset", "endOffset", "startTextOffset", "endTextOffset", "scrollTop", "scrollLeft"].forEach(field => {
    const value = Number(selection[field]);
    if (Number.isFinite(value)) normalized[field] = Math.max(0, value);
  });

  ["startPath", "endPath"].forEach(field => {
    if (!Array.isArray(selection[field])) return;
    normalized[field] = selection[field]
      .map(value => Number(value))
      .filter(value => Number.isInteger(value) && value >= 0);
  });

  return Object.keys(normalized).length ? normalized : null;
}

function storedEditorSelections() {
  const selections = {};
  Object.entries(editorSelections).forEach(([key, selection]) => {
    if (!pageKeyExists(key)) return;
    const normalized = normalizeStoredEditorSelection(selection);
    if (normalized) selections[key] = normalized;
  });
  return selections;
}

function storedPagePanePercents() {
  const validKeys = new Set([STORY_KEY, ...state.drafts.map(draft => topLevelPageKeyForDraft(draft.id))]);
  const stored = {};
  Object.entries(pagePanePercents).forEach(([key, value]) => {
    const numericValue = Number(value);
    if (validKeys.has(key) && Number.isFinite(numericValue)) stored[key] = numericValue;
  });
  return stored;
}

function restoreEditorSelections(stored) {
  editorSelections = {};
  if (!stored || typeof stored !== "object" || Array.isArray(stored)) return;

  Object.entries(stored).forEach(([key, selection]) => {
    if (!pageKeyExists(key)) return;
    const normalized = normalizeStoredEditorSelection(selection);
    if (normalized) editorSelections[key] = normalized;
  });
}

function saveCurrentViewState(options = {}) {
  if (!state) return;

  if (options.syncDom !== false) {
    saveCurrentEditorViewState();
    saveVisibleEditorScrollPositions();
  }

  const selectedDraftIndex = draftIndexForId(selectedDraftId);
  const selectedDraft = state.drafts[selectedDraftIndex] || state.drafts[0] || null;
  const activePage = parseDraftPageKey(activeEditorKey);
  const activeDraftIndex = activePage?.draftId ? draftIndexForId(activePage.draftId) : selectedDraftIndex;
  const activeDraft = state.drafts[activeDraftIndex] || selectedDraft || null;
  const collapsedNotesIndexes = draftIndexesFromIds([...collapsedNotesIds]);
  const notesPanePercentsByIndex = {};
  Object.entries(notesPanePercents).forEach(([draftId, value]) => {
    const index = draftIndexForId(draftId);
    if (index >= 0 && Number.isFinite(Number(value))) notesPanePercentsByIndex[index] = Number(value);
  });
  const storedPanePercents = storedPagePanePercents();

  const viewState = {
    version: VIEW_STATE_VERSION,
    updatedAt: nowIso(),
    hasStoredDisplaySelection,
    displayedStory: displayedPageKeys.has(STORY_KEY),
    displayedDraftIndexes: state.drafts
      .map((draft, index) => displayedPageKeys.has(draftContentKey(draft.id)) ? index : null)
      .filter(index => index !== null),
    displayedDraftIds: state.drafts
      .filter(draft => displayedPageKeys.has(draftContentKey(draft.id)))
      .map(draft => draft.id),
    collapsedNotesIndexes,
    collapsedNotesIds: [...collapsedNotesIds],
    notesPanePercents: notesPanePercentsByIndex,
    pagePanePercents: storedPanePercents,
    pagesOnScreen,
    selectedDraftId: selectedDraft?.id || null,
    selectedDraftIndex: selectedDraftIndex >= 0 ? selectedDraftIndex : 0,
    activeDraftId: activeDraft?.id || null,
    activeDraftIndex: activeDraftIndex >= 0 ? activeDraftIndex : selectedDraftIndex >= 0 ? selectedDraftIndex : 0,
    activePageType: activeEditorKey === STORY_KEY ? "story" : activePage?.type || "content",
    activeEditorKey,
    editorSelections: storedEditorSelections(),
    activeArea,
    showChanges,
    compareMode: els.compareMode.value
  };
  state.viewState = viewState;
  fileViewStates[projectViewStateKey()] = viewState;
  saveFileViewStates();
}

async function saveViewStateNow(options = {}) {
  if (!state) return false;

  if (isSavingViewState) {
    viewStateSaveQueued = true;
    return false;
  }

  saveCurrentViewState();
  isSavingViewState = true;

  try {
    const response = await fetch("/api/view-state", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ viewState: state.viewState }),
      keepalive: Boolean(options.keepalive)
    });

    if (response.ok) {
      const payload = await response.json().catch(() => ({}));
      if (payload.viewState) state.viewState = payload.viewState;
    }
    return response.ok;
  } catch {
    return false;
  } finally {
    isSavingViewState = false;
    if (viewStateSaveQueued) {
      viewStateSaveQueued = false;
      queueViewStateSave(0);
    }
  }
}

function queueViewStateSave(delay = 350) {
  if (!state) return;
  window.clearTimeout(viewStateSaveTimer);
  viewStateSaveTimer = window.setTimeout(() => {
    saveViewStateNow();
  }, delay);
}

function persistViewStateChange(delay = 0) {
  if (!state) return;
  saveCurrentViewState();
  if (pendingPageSaveKeys.size) queuePendingPageSaves(0);
  const hasPendingProjectSave = pendingPageSaveKeys.size || Boolean(saveTimer) || isSaving;
  queueViewStateSave(hasPendingProjectSave ? Math.max(delay, AUTOSAVE_DELAY_MS + 100) : delay);
}

function sendViewStateBeacon() {
  if (!state) return;
  saveCurrentViewState();
  const body = JSON.stringify({ viewState: state.viewState });
  if (!navigator.sendBeacon?.("/api/view-state", new Blob([body], { type: "application/json" }))) {
    void fetch("/api/view-state", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body,
      keepalive: true
    }).catch(() => {});
  }
}

function restoreStoredViewState(stored) {
  const hasStored = Boolean(stored);

  hasStoredDisplaySelection = Boolean(stored?.hasStoredDisplaySelection ?? hasStored);
  displayedPageKeys = hasStored
    ? displayKeysFromStoredDraftIndexes(stored.displayedDraftIndexes, stored.displayedStory)
    : new Set();
  if (hasStored && Array.isArray(stored.displayedDraftIds)) {
    stored.displayedDraftIds.forEach(draftId => {
      if (draftExists(draftId)) displayedPageKeys.add(draftContentKey(draftId));
    });
  }

  collapsedNotesIds = new Set(draftIdsFromIndexes(stored?.collapsedNotesIndexes));
  if (Array.isArray(stored?.collapsedNotesIds)) {
    stored.collapsedNotesIds.forEach(draftId => {
      if (draftExists(draftId)) collapsedNotesIds.add(draftId);
    });
  }
  notesPanePercents = {};
  Object.entries(stored?.notesPanePercents || {}).forEach(([index, value]) => {
    const draftId = state.drafts[Number(index)]?.id;
    if (draftId && Number.isFinite(Number(value))) notesPanePercents[draftId] = Number(value);
  });

  pagePanePercents = {};
  Object.entries(stored?.pagePanePercents || {}).forEach(([key, value]) => {
    const numericValue = Number(value);
    if (!Number.isFinite(numericValue)) return;
    if (key === STORY_KEY || parseDraftPageKey(key)?.type === "content") {
      pagePanePercents[key] = Math.max(MIN_PAGE_PANE_PERCENT, numericValue);
    }
  });

  pagesOnScreen = clampPagesOnScreen(stored?.pagesOnScreen);

  const selectedDraft = draftFromStoredRef(stored?.selectedDraftId, stored?.selectedDraftIndex);
  selectedDraftId = selectedDraft?.id || null;
  activeArea = stored?.activeArea === "draft" ? "draft" : "story";
  const activeDraft = draftFromStoredRef(stored?.activeDraftId, stored?.activeDraftIndex ?? stored?.selectedDraftIndex);
  const activePageType = stored?.activePageType === "notes" ? "notes" : "content";
  if (activeArea === "draft" && activeDraft) {
    selectedDraftId = activeDraft.id;
    activeEditorKey = activePageType === "notes" ? draftNotesKey(activeDraft.id) : draftContentKey(activeDraft.id);
  } else {
    activeArea = "story";
    activeEditorKey = STORY_KEY;
  }
  restoreEditorSelections(stored?.editorSelections);
  showChanges = Boolean(stored?.showChanges);

  if (stored?.compareMode === "first" || stored?.compareMode === "consecutive") {
    els.compareMode.value = stored.compareMode;
  }

}

function restoreViewStateForProject(options = {}) {
  const key = projectViewStateKey();
  const fileNameOnlyKey = projectFileNameKey();
  const stored = options.fresh
    ? null
    : newestViewState(fileViewStates[key], fileViewStates[fileNameOnlyKey], state?.viewState);
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
  pagePanePercents = Object.fromEntries(
    Object.entries(pagePanePercents).filter(([key]) => (
      key === STORY_KEY || validDraftIds.has(parseDraftPageKey(key)?.draftId)
    ))
  );

  if (!hasStoredDisplaySelection && !displayedPageKeys.size) {
    displayedPageKeys = new Set(defaultDisplayKeys());
  }

  saveLayoutViewState();
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

function defaultPagePanePercent() {
  return 100 / Math.max(1, pagesOnScreen);
}

function pagePanePercent(key) {
  const value = Number(pagePanePercents[key]);
  return Number.isFinite(value) ? Math.max(MIN_PAGE_PANE_PERCENT, value) : defaultPagePanePercent();
}

function setPagePanePercent(key, value) {
  if (!key) return;
  pagePanePercents[key] = Math.max(MIN_PAGE_PANE_PERCENT, Number(value) || defaultPagePanePercent());
}

function targetPagePaneTotal(keys = topLevelDisplayPageKeys()) {
  return keys.length * defaultPagePanePercent();
}

function normalizePagePanePercentsForLayout(keys = topLevelDisplayPageKeys()) {
  if (!keys.length) return;
  keys.forEach(key => {
    if (!Number.isFinite(Number(pagePanePercents[key]))) pagePanePercents[key] = defaultPagePanePercent();
  });

  const total = keys.reduce((sum, key) => sum + pagePanePercent(key), 0);
  const targetTotal = targetPagePaneTotal(keys);
  if (!total || !targetTotal) return;

  const scale = targetTotal / total;
  keys.forEach(key => {
    pagePanePercents[key] = Math.max(MIN_PAGE_PANE_PERCENT, pagePanePercent(key) * scale);
  });
}

function pagePaneStyle(key, extra = "") {
  return `--page-pane-percent: ${pagePanePercent(key)}; ${extra}`.trim();
}

function applyPagePaneStyles() {
  Object.entries(pagePanePercents).forEach(([key, value]) => {
    const element = els.pageCanvas.querySelector(`[data-page-key="${cssEscape(key)}"]`);
    if (element) element.style.setProperty("--page-pane-percent", String(value));
  });
  queueNotesHeadingDensityUpdate();
  queueDraftHeadingDensityUpdate();
}

function setAdjacentPagePanePercents(beforeKey, afterKey, beforeValue, afterValue) {
  setPagePanePercent(beforeKey, beforeValue);
  setPagePanePercent(afterKey, afterValue);
  applyPagePaneStyles();
}

function applyAdjacentPagePaneResize(beforeKey, afterKey, nextBeforeValue) {
  if (!beforeKey || !afterKey) return;
  const beforeValue = pagePanePercent(beforeKey);
  const afterValue = pagePanePercent(afterKey);
  const pairTotal = beforeValue + afterValue;
  if (!pairTotal) return;

  const minimum = Math.min(MIN_PAGE_PANE_PERCENT, pairTotal / 2);
  const clampedBeforeValue = Math.min(pairTotal - minimum, Math.max(minimum, nextBeforeValue));
  setAdjacentPagePanePercents(beforeKey, afterKey, clampedBeforeValue, pairTotal - clampedBeforeValue);
}

function resetPagePanePercents(keys = topLevelDisplayPageKeys()) {
  const defaultValue = defaultPagePanePercent();
  keys.forEach(key => {
    pagePanePercents[key] = defaultValue;
  });
  applyPagePaneStyles();
  savePagePanePercents();
  queueViewStateSave(250);
}

function setPagesOnScreen(value) {
  pagesOnScreen = normalizePagesOnScreenForSelection(value);
  normalizePagePanePercentsForLayout();
  applyPagePaneStyles();
  updatePagesOnScreenControls();
  persistViewStateChange(500);
  if (changesPanelIsOpen()) renderDiffSoon();
  window.requestAnimationFrame(() => {
    alignPageInCanvas(activeDisplayKey());
    updateAllNotesHeadingDensity();
  });
}

function syncPanelDragMenu() {
  if (!els.viewEnablePanelDrag) return;
  els.viewEnablePanelDrag.setAttribute("aria-pressed", String(panelDragEnabled));
}

function setPanelDragEnabled(enabled) {
  panelDragEnabled = Boolean(enabled);
  syncPanelDragMenu();
  render();
}

function detachedWindowName(key) {
  return `draft-panel-${String(key).replace(/[^a-z0-9]+/gi, "-")}`;
}

function postDetachedPanelMessage(message) {
  detachedPanelChannel?.postMessage({ source: "main", ...message });
}

function broadcastDetachedUnit(key) {
  const unit = snapshotForDetachedUnit(key);
  if (!unit) return;
  postDetachedPanelMessage({ type: "unit:state", key, unit });
}

function reattachDetachedUnit(key, options = {}) {
  const record = detachedPanelWindows.get(key);
  if (record?.timer) window.clearInterval(record.timer);
  detachedPanelWindows.delete(key);

  if (!detachedUnitKeys.delete(key)) return;
  refreshDetachedUnitFromServer(key).finally(() => {
    render();
    setPagesOnScreen(pagesOnScreen);
    const focusKey = key === STORY_KEY ? STORY_KEY : draftContentKey(parseDetachedUnitKey(key)?.draftId);
    if (options.focus && focusKey) focusPageEditor(focusKey);
  });
}

function detachUnit(key) {
  if (!state) return;
  syncDetachedUnitFromDom(key);

  const unit = snapshotForDetachedUnit(key);
  if (!unit) return;

  detachedUnitKeys.add(key);

  const url = new URL("/panel.html", window.location.href);
  url.searchParams.set("unit", key);
  url.searchParams.set("title", unit.title);

  const panelWindow = window.open(
    url.toString(),
    detachedWindowName(key),
    "popup=yes,width=760,height=820"
  );

  if (!panelWindow) {
    detachedUnitKeys.delete(key);
    setStatus("Panel window blocked");
    return;
  }

  const timer = window.setInterval(() => {
    if (panelWindow.closed) reattachDetachedUnit(key);
  }, 750);

  detachedPanelWindows.set(key, { window: panelWindow, timer });
  render();
  setPagesOnScreen(pagesOnScreen);
  window.setTimeout(() => broadcastDetachedUnit(key), 150);
}

function handleDetachedUnitUpdate(key, unit) {
  if (!detachedUnitKeys.has(key)) return;
  const appliedPageKeys = applyDetachedUnitSnapshotPageKeys(unit);
  if (!appliedPageKeys.length) return;

  markStateChanged();
  saveRetryCount = 0;
  rememberLinkedProjectState();
  refreshRenderedPageLabels();
  renderDraftTabs();
  renderDiffSoon();
  setStatus(isSaving ? "Saving..." : "Unsaved changes");
  Array.from(new Set(appliedPageKeys)).forEach(pageKey => {
    queuePageSave(pageKey, AUTOSAVE_DELAY_MS);
  });
}

async function refreshDetachedUnitFromServer(key) {
  if (!state) return;
  try {
    const response = await fetch("/api/state", { cache: "no-store" });
    if (!response.ok) return;
    const payload = await response.json();
    const remoteState = migrateLegacyDefaultFonts(payload.state);
    const remoteUnit = unitForKeyInState(remoteState, key);
    if (remoteUnit) applyDetachedUnitSnapshot(remoteUnit);
  } catch {}
}

function unitForKeyInState(projectState, key) {
  const parsed = parseDetachedUnitKey(key);
  if (!projectState || !parsed) return null;
  if (parsed.type === "story") {
    return {
      key: STORY_KEY,
      type: "story",
      title: PROJECT_NOTES_TITLE,
      pages: [{
        key: STORY_KEY,
        type: "story",
        title: PROJECT_NOTES_TITLE,
        kicker: "Page",
        editableTitle: false,
        page: projectState.initialNotes
      }]
    };
  }

  const draft = projectState.drafts?.find(item => item.id === parsed.draftId);
  if (!draft) return null;
  return {
    key: draftUnitKey(draft.id),
    type: "draft",
    draftId: draft.id,
    title: draft.title,
    pages: [
      {
        key: draftContentKey(draft.id),
        type: "draft",
        title: draft.title,
        kicker: "Draft",
        editableTitle: true,
        page: draft
      },
      {
        key: draftNotesKey(draft.id),
        type: "notes",
        title: `${draft.title} notes`,
        kicker: "Notes",
        editableTitle: false,
        page: draft.notes
      }
    ]
  };
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
  if (editorEl && els.pageCanvas.contains(editorEl)) {
    saveEditorSelection(editorEl);
    queueViewStateSave(1000);
  }
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

function searchHighlightsSupported() {
  return Boolean(window.CSS?.highlights && window.Highlight);
}

function clearSearchHighlights() {
  if (!window.CSS?.highlights) return;
  CSS.highlights.delete(SEARCH_MATCH_HIGHLIGHT);
  CSS.highlights.delete(SEARCH_ACTIVE_HIGHLIGHT);
}

function setSearchHighlights(matchRanges, activeRanges) {
  clearSearchHighlights();
  if (!searchHighlightsSupported()) return;
  if (matchRanges.length) CSS.highlights.set(SEARCH_MATCH_HIGHLIGHT, new Highlight(...matchRanges));
  if (activeRanges.length) CSS.highlights.set(SEARCH_ACTIVE_HIGHLIGHT, new Highlight(...activeRanges));
}

function pageSearchLabel(item) {
  if (!item) return "";
  if (item.key === STORY_KEY) return PROJECT_NOTES_TITLE;
  if (item.type === "notes" && item.draft) return `${item.draft.title} notes`;
  return item.title || "Untitled";
}

function allSearchPageKeys() {
  return state ? allPageItems().map(item => item.key) : [];
}

function normalizeSearchScopeSelection() {
  const validKeys = new Set(allSearchPageKeys());
  searchState.selectedKeys = new Set([...searchState.selectedKeys].filter(key => validKeys.has(key)));
}

function setSearchScopeAll(checked = true) {
  searchState.selectedKeys = checked ? new Set(allSearchPageKeys()) : new Set();
}

function setSearchScopeSingle(pageKey) {
  searchState.selectedKeys = pageKeyExists(pageKey) ? new Set([pageKey]) : new Set();
}

function isAllSearchScopeSelected() {
  const allKeys = allSearchPageKeys();
  return Boolean(allKeys.length) && allKeys.every(key => searchState.selectedKeys.has(key));
}

function searchScopeLabelText() {
  const allKeys = allSearchPageKeys();
  const selectedKeys = [...searchState.selectedKeys];
  if (!selectedKeys.length) return "No pages";
  if (allKeys.length && selectedKeys.length === allKeys.length) return "All pages";
  if (selectedKeys.length === 1) return pageSearchLabel(pageItemForKey(selectedKeys[0]));
  return `${selectedKeys.length} pages`;
}

function populateSearchScopeOptions() {
  if (!els.searchScopeMenu || !state) return;
  normalizeSearchScopeSelection();

  const pageOptions = allPageItems().map(item => `
    <label class="search-scope-option">
      <input type="checkbox" data-search-scope-page="${escapeHtml(item.key)}"${searchState.selectedKeys.has(item.key) ? " checked" : ""}>
      <span>${escapeHtml(pageSearchLabel(item))}</span>
    </label>
  `).join("");
  const allChecked = isAllSearchScopeSelected();

  els.searchScopeMenu.innerHTML = `
    <label class="search-scope-option search-scope-all">
      <input type="checkbox" data-search-scope-all${allChecked ? " checked" : ""}>
      <span>All pages</span>
    </label>
    <span class="menu-divider" aria-hidden="true"></span>
    ${pageOptions}
  `;
  const allInput = els.searchScopeMenu.querySelector("[data-search-scope-all]");
  if (allInput) allInput.indeterminate = Boolean(searchState.selectedKeys.size && !allChecked);
  if (els.searchScopeLabel) els.searchScopeLabel.textContent = searchScopeLabelText();
}

function selectedSearchText() {
  const text = window.getSelection?.()?.toString?.() || "";
  return text.replace(/\s+/g, " ").trim();
}

function searchScopePageKeys() {
  if (!state) return [];
  normalizeSearchScopeSelection();
  return [...searchState.selectedKeys];
}

function makePageVisibleForSearch(pageKey) {
  if (pageKey === STORY_KEY) {
    if (detachedUnitKeys.has(STORY_KEY)) return false;
    const changed = !displayedPageKeys.has(STORY_KEY);
    displayedPageKeys.add(STORY_KEY);
    return changed;
  }

  const parsed = parseDraftPageKey(pageKey);
  if (!parsed?.draftId || detachedUnitKeys.has(draftUnitKey(parsed.draftId))) return false;

  const draftKey = draftContentKey(parsed.draftId);
  let changed = !displayedPageKeys.has(draftKey);
  displayedPageKeys.add(draftKey);
  if (parsed.type === "notes" && collapsedNotesIds.has(parsed.draftId)) {
    collapsedNotesIds.delete(parsed.draftId);
    changed = true;
  }
  return changed;
}

function ensureSearchScopeVisible() {
  if (!state || !searchState.open || !searchState.query) return false;

  let shouldRender = false;
  if (showChanges) {
    showChanges = false;
    shouldRender = true;
  }

  searchScopePageKeys().forEach(pageKey => {
    if (makePageVisibleForSearch(pageKey)) shouldRender = true;
  });

  if (!shouldRender) return false;
  hasStoredDisplaySelection = true;
  ensureDisplaySelection();
  persistViewStateChange(0);
  render();
  return true;
}

function textSegmentsForEditor(editorEl) {
  const segments = [];
  const walker = document.createTreeWalker(editorEl, NodeFilter.SHOW_TEXT);
  let offset = 0;

  while (walker.nextNode()) {
    const node = walker.currentNode;
    const value = node.nodeValue || "";
    if (!value) continue;
    segments.push({ node, start: offset, end: offset + value.length });
    offset += value.length;
  }

  return segments;
}

function textBoundaryFromSegments(segments, offset) {
  if (!segments.length) return null;
  for (const segment of segments) {
    if (offset <= segment.end) {
      return {
        node: segment.node,
        offset: Math.max(0, Math.min(segment.node.nodeValue.length, offset - segment.start))
      };
    }
  }

  const last = segments[segments.length - 1];
  return { node: last.node, offset: last.node.nodeValue.length };
}

function rangeFromTextSegments(segments, startOffset, endOffset) {
  const start = textBoundaryFromSegments(segments, startOffset);
  const end = textBoundaryFromSegments(segments, endOffset);
  if (!start || !end) return null;

  const range = document.createRange();
  range.setStart(start.node, start.offset);
  range.setEnd(end.node, end.offset);
  return range.collapsed ? null : range;
}

function searchMatchesForEditor(editorEl, query) {
  const needle = String(query || "");
  if (!editorEl || !needle) return [];

  const segments = textSegmentsForEditor(editorEl);
  const haystack = segments.map(segment => segment.node.nodeValue).join("");
  const normalizedHaystack = haystack.toLocaleLowerCase();
  const normalizedNeedle = needle.toLocaleLowerCase();
  const matches = [];
  let index = normalizedHaystack.indexOf(normalizedNeedle);

  while (index >= 0) {
    const range = rangeFromTextSegments(segments, index, index + needle.length);
    if (range) matches.push({ range });
    index = normalizedHaystack.indexOf(normalizedNeedle, index + Math.max(1, normalizedNeedle.length));
  }

  return matches;
}

function searchSummaryText(totalMatches, pageCount) {
  const query = searchState.query;
  if (!query) return "Enter a search term.";
  if (!totalMatches) return `No matches for "${query}".`;
  return `${totalMatches.toLocaleString()} ${totalMatches === 1 ? "match" : "matches"} in ${pageCount} ${pageCount === 1 ? "page" : "pages"}.`;
}

function syncSearchResultBars(scopedKeys, results) {
  const scoped = new Set(scopedKeys);
  const query = searchState.query;

  els.pageCanvas.querySelectorAll("[data-search-bar-for]").forEach(bar => {
    const key = bar.dataset.searchBarFor;
    const matches = results.get(key) || [];
    const activeIndex = Math.min(matches.length - 1, Math.max(0, Number(searchState.activeIndexes[key]) || 0));
    const visible = Boolean(searchState.open && query && scoped.has(key));
    const countText = matches.length
      ? `${matches.length.toLocaleString()} ${matches.length === 1 ? "match" : "matches"}`
      : "No matches";

    bar.hidden = !visible;
    bar.querySelector("[data-search-count]")?.replaceChildren(document.createTextNode(countText));
    bar.querySelector("[data-search-position]")?.replaceChildren(
      document.createTextNode(matches.length ? `${activeIndex + 1} of ${matches.length}` : "")
    );
    bar.querySelectorAll("[data-search-page-prev], [data-search-page-next]").forEach(button => {
      button.disabled = matches.length < 2;
    });
  });
}

function scrollSearchMatchIntoView(pageKey, index) {
  const match = searchState.results.get(pageKey)?.[index];
  if (!match) return;

  const editorEl = editorElementForKey(pageKey);
  if (!editorEl) return;

  alignPageInCanvas(pageKey);
  window.requestAnimationFrame(() => {
    const rect = match.range.getBoundingClientRect();
    const editorRect = editorEl.getBoundingClientRect();
    if (!rect.height && !rect.width) return;

    const targetTop = editorEl.scrollTop + rect.top - editorRect.top;
    const targetLeft = editorEl.scrollLeft + rect.left - editorRect.left;
    editorEl.scrollTo({
      top: Math.max(0, targetTop - (editorEl.clientHeight * 0.36)),
      left: Math.max(0, targetLeft - 28),
      behavior: "smooth"
    });
  });
}

function refreshSearchResults(options = {}) {
  if (!els.searchPopover) return;

  if (!searchState.open) {
    searchState.results = new Map();
    syncSearchResultBars([], searchState.results);
    clearSearchHighlights();
    return;
  }

  populateSearchScopeOptions();

  const query = searchState.query;
  if (!query) {
    searchState.results = new Map();
    syncSearchResultBars(searchScopePageKeys(), searchState.results);
    clearSearchHighlights();
    if (els.searchSummary) els.searchSummary.textContent = searchSummaryText(0, 0);
    return;
  }

  if (options.allowRender !== false && ensureSearchScopeVisible()) {
    window.requestAnimationFrame(() => refreshSearchResults({ ...options, allowRender: false }));
    return;
  }

  const scopedKeys = searchScopePageKeys();
  const signature = `${scopedKeys.join("\u0000")}\n${query}`;
  const shouldResetActive = searchState.shouldScrollToFirst || signature !== searchState.lastSignature;
  const results = new Map();
  const matchRanges = [];
  const activeRanges = [];
  let totalMatches = 0;
  let pagesWithMatches = 0;

  if (!scopedKeys.length) {
    searchState.results = results;
    searchState.lastSignature = signature;
    syncSearchResultBars(scopedKeys, results);
    clearSearchHighlights();
    if (els.searchSummary) els.searchSummary.textContent = "No pages selected.";
    if (els.searchPrev) els.searchPrev.disabled = true;
    if (els.searchNext) els.searchNext.disabled = true;
    searchState.shouldScrollToFirst = false;
    return;
  }

  if (shouldResetActive) {
    searchState.activeIndexes = {};
    searchState.activeKey = null;
  }

  scopedKeys.forEach(key => {
    const editorEl = editorElementForKey(key);
    const matches = editorEl ? searchMatchesForEditor(editorEl, query) : [];
    results.set(key, matches);
    if (matches.length) {
      pagesWithMatches += 1;
      totalMatches += matches.length;
      const activeIndex = Math.min(
        matches.length - 1,
        Math.max(0, Number(searchState.activeIndexes[key]) || 0)
      );
      searchState.activeIndexes[key] = activeIndex;
      if (!searchState.activeKey) searchState.activeKey = key;
      matches.forEach((match, index) => {
        if (index === activeIndex) {
          activeRanges.push(match.range);
        } else {
          matchRanges.push(match.range);
        }
      });
    } else {
      delete searchState.activeIndexes[key];
    }
  });

  searchState.results = results;
  searchState.lastSignature = signature;
  syncSearchResultBars(scopedKeys, results);
  setSearchHighlights(matchRanges, activeRanges);
  if (els.searchSummary) els.searchSummary.textContent = searchSummaryText(totalMatches, pagesWithMatches);
  if (els.searchPrev) els.searchPrev.disabled = totalMatches < 2;
  if (els.searchNext) els.searchNext.disabled = totalMatches < 2;

  if (shouldResetActive) {
    results.forEach((matches, key) => {
      if (matches.length) scrollSearchMatchIntoView(key, searchState.activeIndexes[key] || 0);
    });
  } else if (options.scrollActive && searchState.activeKey) {
    scrollSearchMatchIntoView(searchState.activeKey, searchState.activeIndexes[searchState.activeKey] || 0);
  }

  searchState.shouldScrollToFirst = false;
}

function openSearch(options = {}) {
  if (!els.searchPopover) return;
  if (options.pageKey) {
    syncPageFromDom(options.pageKey);
  } else {
    syncFromInputs();
  }
  searchState.open = true;
  if (options.pageKey) {
    setSearchScopeSingle(options.pageKey);
  } else if (options.scope === "all" || !searchState.selectedKeys.size) {
    setSearchScopeAll(true);
  }
  if (options.query !== undefined) {
    searchState.query = String(options.query);
  } else if (!searchState.query) {
    searchState.query = selectedSearchText();
  }
  searchState.shouldScrollToFirst = true;
  els.searchPopover.hidden = false;
  if (els.searchInput) els.searchInput.value = searchState.query;
  refreshSearchResults();
  window.requestAnimationFrame(() => {
    els.searchInput?.focus();
    els.searchInput?.select();
  });
}

function closeSearch() {
  searchState.open = false;
  searchState.results = new Map();
  if (els.searchPopover) els.searchPopover.hidden = true;
  if (els.searchScopeMenu) els.searchScopeMenu.hidden = true;
  if (els.searchScopeToggle) els.searchScopeToggle.setAttribute("aria-expanded", "false");
  syncSearchResultBars([], searchState.results);
  clearSearchHighlights();
}

function toggleSearchScopeMenu(open = null) {
  if (!els.searchScopeMenu || !els.searchScopeToggle) return;
  const nextOpen = open ?? els.searchScopeMenu.hidden;
  els.searchScopeMenu.hidden = !nextOpen;
  els.searchScopeToggle.setAttribute("aria-expanded", String(nextOpen));
}

function setSearchQuery(value) {
  searchState.query = String(value || "");
  searchState.shouldScrollToFirst = true;
  refreshSearchResults();
}

function setSearchScopeFromControl(control) {
  if (!control) return;
  if (control.matches("[data-search-scope-all]")) {
    setSearchScopeAll(control.checked);
  } else if (control.matches("[data-search-scope-page]")) {
    const pageKey = control.dataset.searchScopePage;
    if (control.checked) {
      searchState.selectedKeys.add(pageKey);
    } else {
      searchState.selectedKeys.delete(pageKey);
    }
  }

  searchState.activeKey = null;
  searchState.shouldScrollToFirst = true;
  refreshSearchResults();
}

function cycleSearchPage(pageKey, direction) {
  const matches = searchState.results.get(pageKey) || [];
  if (!matches.length) return;
  const current = Number(searchState.activeIndexes[pageKey]) || 0;
  const next = (current + direction + matches.length) % matches.length;
  searchState.activeIndexes[pageKey] = next;
  searchState.activeKey = pageKey;
  refreshSearchResults({ allowRender: false, scrollActive: true });
}

function cycleSearch(direction) {
  const flatMatches = [];
  searchScopePageKeys().forEach(key => {
    const matches = searchState.results.get(key) || [];
    matches.forEach((_, index) => flatMatches.push({ key, index }));
  });
  if (!flatMatches.length) return;

  const currentFlatIndex = flatMatches.findIndex(match => (
    match.key === searchState.activeKey &&
    match.index === (Number(searchState.activeIndexes[match.key]) || 0)
  ));
  const nextFlatIndex = (Math.max(0, currentFlatIndex) + direction + flatMatches.length) % flatMatches.length;
  const next = flatMatches[nextFlatIndex];
  searchState.activeIndexes[next.key] = next.index;
  searchState.activeKey = next.key;
  refreshSearchResults({ allowRender: false, scrollActive: true });
}

function closeSpellcheckMenu() {
  spellcheckMenu?.remove();
  spellcheckMenu = null;
  spellcheckRange = null;
}

function caretRangeFromPoint(clientX, clientY) {
  if (document.caretRangeFromPoint) return document.caretRangeFromPoint(clientX, clientY);
  const position = document.caretPositionFromPoint?.(clientX, clientY);
  if (!position) return null;

  const range = document.createRange();
  range.setStart(position.offsetNode, position.offset);
  range.collapse(true);
  return range;
}

function wordRangeAtPoint(editorEl, clientX, clientY) {
  const caretRange = caretRangeFromPoint(clientX, clientY);
  if (!caretRange || !editorEl.contains(caretRange.startContainer)) return null;

  let node = caretRange.startContainer;
  let offset = caretRange.startOffset;
  if (node.nodeType !== Node.TEXT_NODE) {
    node = Array.from(node.childNodes || []).find(child => child.nodeType === Node.TEXT_NODE) || null;
    offset = 0;
  }
  if (!node?.nodeValue) return null;

  const text = node.nodeValue;
  const isWordCharacter = character => /[\p{L}\p{N}'’-]/u.test(character || "");
  if (offset > 0 && !isWordCharacter(text[offset]) && isWordCharacter(text[offset - 1])) offset -= 1;
  if (!isWordCharacter(text[offset])) return null;

  let start = offset;
  let end = offset;
  while (start > 0 && isWordCharacter(text[start - 1])) start -= 1;
  while (end < text.length && isWordCharacter(text[end])) end += 1;
  if (start === end) return null;

  const range = document.createRange();
  range.setStart(node, start);
  range.setEnd(node, end);
  return { word: text.slice(start, end), range };
}

function selectSpellcheckRange(range = spellcheckRange) {
  if (!range) return false;
  const selection = window.getSelection();
  selection.removeAllRanges();
  selection.addRange(range);
  return true;
}

function replaceSpellcheckWord(value) {
  const range = spellcheckRange?.cloneRange();
  closeSpellcheckMenu();
  if (!selectSpellcheckRange(range)) return;

  const editorEl = range.startContainer.parentElement?.closest("[data-editor-key]");
  if (editorEl) activeEditorKey = editorEl.dataset.editorKey;
  if (editorEl) {
    recordPageUndoSnapshot(editorEl.dataset.editorKey);
  } else {
    recordUndoSnapshot();
  }
  insertPlainText(value, { document });
  if (editorEl) {
    const page = pageForEditorKey(editorEl.dataset.editorKey);
    if (page) syncRichPage(page, editorEl);
    schedulePageSave(editorEl.dataset.editorKey, {
      updateViewState: false,
      refreshUi: false,
      refreshDiff: false
    });
    return;
  }
  scheduleSave({ syncInputs: false, refreshUi: false, refreshDiff: false });
}

function menuButtonHtml(label, action, disabled = false) {
  return `<button type="button" data-spellcheck-action="${escapeHtml(action)}"${disabled ? " disabled" : ""}>${escapeHtml(label)}</button>`;
}

function showSpellcheckMenu({ word, range = null, suggestions = [], misspelled = false, clientX, clientY }) {
  closeSpellcheckMenu();
  spellcheckRange = range;
  const menu = document.createElement("div");
  menu.className = "spellcheck-menu";
  menu.setAttribute("role", "menu");

  const suggestionButtons = misspelled
    ? (suggestions.length
      ? suggestions.map((suggestion, index) => menuButtonHtml(suggestion, `suggestion:${index}`)).join("")
      : menuButtonHtml("No spelling suggestions", "none", true))
    : "";

  menu.innerHTML = `
    ${suggestionButtons}
    ${misspelled ? '<span class="menu-divider" aria-hidden="true"></span>' : ""}
    ${misspelled ? menuButtonHtml(`Ignore "${word}"`, "ignore") : ""}
    ${misspelled ? menuButtonHtml(`Add "${word}" to dictionary`, "add") : ""}
    <span class="menu-divider" aria-hidden="true"></span>
    ${menuButtonHtml("Cut", "cut")}
    ${menuButtonHtml("Copy", "copy")}
    ${menuButtonHtml("Paste", "paste")}
    <span class="menu-divider" aria-hidden="true"></span>
    ${menuButtonHtml("Select all", "selectAll")}
  `;

  menu.addEventListener("click", async event => {
    const button = event.target.closest("[data-spellcheck-action]");
    if (!button || button.disabled) return;
    const action = button.dataset.spellcheckAction;

    if (action.startsWith("suggestion:")) {
      replaceSpellcheckWord(suggestions[Number(action.split(":")[1])]);
      return;
    }
    if (action === "ignore") {
      ignoredSpellcheckWords.add(word.toLocaleLowerCase());
      closeSpellcheckMenu();
      return;
    }
    if (action === "add") {
      await window.draftDiffDesktop?.addWordToDictionary?.(word);
      replaceSpellcheckWord(word);
      return;
    }
    if (action === "selectAll") {
      const editorEl = spellcheckRange?.startContainer?.parentElement?.closest("[data-editor-key]");
      if (editorEl) {
        const range = document.createRange();
        range.selectNodeContents(editorEl);
        selectSpellcheckRange(range);
      }
      closeSpellcheckMenu();
      return;
    }

    selectSpellcheckRange();
    execRichTextCommand(action, { document });
    closeSpellcheckMenu();
  });

  document.body.append(menu);
  const rect = menu.getBoundingClientRect();
  const margin = 6;
  menu.style.left = `${Math.max(margin, Math.min(clientX, window.innerWidth - rect.width - margin))}px`;
  menu.style.top = `${Math.max(margin, Math.min(clientY, window.innerHeight - rect.height - margin))}px`;
  spellcheckMenu = menu;
}

async function readSpellcheckValue(callback, fallback) {
  try {
    return await Promise.resolve(callback());
  } catch {
    return fallback;
  }
}

async function handleEditorContextMenu(event) {
  const target = event.target instanceof Element ? event.target : event.target?.parentElement;
  const editorEl = target?.closest?.("[data-editor-key]");
  if (!editorEl) return;

  const wordInfo = wordRangeAtPoint(editorEl, event.clientX, event.clientY);
  event.preventDefault();
  const range = wordInfo?.range?.cloneRange() || null;

  let misspelled = false;
  let suggestions = [];
  if (wordInfo?.word && window.draftDiffDesktop?.checkSpelling) {
    const normalizedWord = wordInfo.word.toLocaleLowerCase();
    const result = await readSpellcheckValue(
      () => window.draftDiffDesktop.checkSpelling(wordInfo.word),
      { misspelled: false, suggestions: [] }
    );
    misspelled = !ignoredSpellcheckWords.has(normalizedWord) && Boolean(result?.misspelled);
    suggestions = misspelled && Array.isArray(result?.suggestions) ? result.suggestions : [];
  } else if (wordInfo?.word && window.draftDiffDesktop?.isWordMisspelled) {
    const normalizedWord = wordInfo.word.toLocaleLowerCase();
    misspelled = !ignoredSpellcheckWords.has(normalizedWord) && await readSpellcheckValue(
      () => window.draftDiffDesktop.isWordMisspelled(wordInfo.word),
      false
    );
    if (misspelled && window.draftDiffDesktop?.getWordSuggestions) {
      suggestions = await readSpellcheckValue(
        () => window.draftDiffDesktop.getWordSuggestions(wordInfo.word),
        []
      );
    }
  }

  showSpellcheckMenu({
    word: wordInfo?.word || "",
    range,
    suggestions,
    misspelled,
    clientX: event.clientX,
    clientY: event.clientY
  });
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

function alignPageInCanvas(pageKey, behavior = "auto") {
  const pageEl = displayElementForKey(pageKey);
  if (!pageEl) return;

  const canvasRect = els.pageCanvas.getBoundingClientRect();
  const pageRect = pageEl.getBoundingClientRect();
  const left = els.pageCanvas.scrollLeft + pageRect.left - canvasRect.left;
  els.pageCanvas.scrollTo({ left, behavior });
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

function wordCountForText(text) {
  const matches = String(text || "").match(/[\p{L}\p{N}]+(?:[\u0027\u2019/-][\p{L}\p{N}]+)*|\*+/gu);
  return matches ? matches.length : 0;
}

function pageWordCount(page) {
  ensurePageFields(page);
  return wordCountForText(page.content || plainTextFromHtml(page.contentHtml || ""));
}

function formatWordCount(count) {
  const value = Number(count) || 0;
  return `${value.toLocaleString()} ${value === 1 ? "word" : "words"}`;
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

function exportPageBlock(title, createdAt, content, metadata = {}) {
  const body = String(content || "").trimEnd();
  const lines = [
    title,
    `Created: ${formatDateForExport(createdAt)}`
  ];
  if (metadata.updatedAt) lines.push(`Last edited: ${formatDateForExport(metadata.updatedAt)}`);
  if (Number.isFinite(metadata.wordCount)) {
    lines.push(`Word count: ${Number(metadata.wordCount).toLocaleString("en-GB")}`);
  }
  lines.push("", body || "[No text yet]");
  return lines.join("\n");
}

function draftExportMetadata(draft) {
  ensurePageFields(draft);
  return {
    updatedAt: draft.updatedAt || draft.createdAt,
    wordCount: pageWordCount(draft)
  };
}

function projectNotesExportMetadata(projectState) {
  ensurePageFields(projectState.initialNotes);
  return {
    updatedAt: projectState.initialNotes.updatedAt || projectState.initialNotes.createdAt
  };
}

function formatExportText(projectState) {
  const pages = [
    exportPageBlock(
      PROJECT_NOTES_TITLE,
      projectState.initialNotes.createdAt,
      projectState.initialNotes.content,
      projectNotesExportMetadata(projectState)
    )
  ];

  projectState.drafts.forEach((draft, index) => {
    const title = draft.title || `Draft ${index + 1}`;
    pages.push(exportPageBlock(title, draft.createdAt, draft.content, draftExportMetadata(draft)));
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
  const firstLineCreatedMatch = /^Created:\s*(.*)$/i.exec(lines[0] || "");
  const title = firstLineCreatedMatch ? lines[1] : lines[0];
  const createdMatch = firstLineCreatedMatch || /^Created:\s*(.*)$/i.exec(lines[1] || "");
  if (!createdMatch || !title) {
    throw new Error("This file does not match the Draft Diff text format.");
  }

  let updatedAt = "";
  let bodyStart = 2;
  for (; bodyStart < lines.length; bodyStart += 1) {
    const line = lines[bodyStart] || "";
    if (line === "") {
      bodyStart += 1;
      break;
    }

    const lastEditedMatch = /^Last edited:\s*(.*)$/i.exec(line);
    if (lastEditedMatch) {
      updatedAt = parseCreatedAt(lastEditedMatch[1]);
      continue;
    }

    if (/^Word count:\s*/i.test(line)) continue;
    break;
  }

  const bodyLines = lines.slice(bodyStart);
  const content = bodyLines.join("\n").replace(/\n+$/g, "");

  return {
    title: title.trim() || "Untitled",
    createdAt: parseCreatedAt(createdMatch[1]),
    updatedAt,
    content: content === "[No text yet]" ? "" : content
  };
}

function preservedFormat(previousPage) {
  return previousPage?.format ? { ...normalizeFormat(previousPage.format) } : { ...DEFAULT_FORMAT };
}

function pageFromImportedBlock(block, fallbackTitle, previousPage = null) {
  const title = block?.title || fallbackTitle;
  const content = block?.content || "";
  const importedCreatedAt = block?.createdAt || nowIso();
  const importedUpdatedAt = block?.updatedAt || importedCreatedAt;
  const createdAt = previousPage?.createdAt || importedCreatedAt;
  const previousContent = previousPage
    ? previousPage.content || plainTextFromHtml(previousPage.contentHtml || "")
    : null;
  const contentChanged = previousPage && previousContent !== content;
  return {
    id: previousPage?.id || makeId("page"),
    title,
    createdAt,
    updatedAt: contentChanged ? nowIso() : previousPage?.updatedAt || importedUpdatedAt || createdAt,
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
  const createdAt = previousState?.createdAt || storyBlock.createdAt || nowIso();
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
    if (Array.isArray(previousDraft?.versionHistory)) {
      draft.versionHistory = previousDraft.versionHistory;
    }
    const notes = pageFromImportedBlock(notesBlock, `${draft.title} Notes`, previousDraft?.notes);
    notes.id = previousDraft?.notes?.id || makeId("notes");
    notes.title = `${draft.title} Notes`;
    const importedDraft = {
      ...draft,
      id: previousDraft?.id || makeId("draft"),
      notes
    };
    ensureDraftVersionHistory(importedDraft);
    promotePageToNewestHistoryVersion(importedDraft, importedDraft.title || `Draft ${draftNumber}`);
    appendDraftVersionIfChanged(importedDraft);
    drafts.push(importedDraft);
  }

  if (!drafts.length) drafts.push(createDraft(null, 1));

  const initialNotes = {
    ...pageFromImportedBlock(storyBlock, PROJECT_NOTES_TITLE, previousState?.initialNotes),
    id: "initial-notes",
    title: PROJECT_NOTES_TITLE
  };
  if (Array.isArray(previousState?.initialNotes?.versionHistory)) {
    initialNotes.versionHistory = previousState.initialNotes.versionHistory;
  }
  ensurePageVersionHistory(initialNotes, PROJECT_NOTES_TITLE);
  promotePageToNewestHistoryVersion(initialNotes, PROJECT_NOTES_TITLE);
  appendPageVersionIfChanged(initialNotes, PROJECT_NOTES_TITLE);

  return {
    version: 1,
    formatDefaultVersion: FORMAT_DEFAULT_VERSION,
    defaultFormat: currentDefaultFormat(previousState),
    createdAt,
    updatedAt: nowIso(),
    viewState: previousState?.viewState || null,
    initialNotes,
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
  editorEl.style.lineHeight = normalized.lineHeight;
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
  const nextContentHtml = sanitizeRichHtml(editorEl.innerHTML);
  const nextContent = editorPlainText(editorEl);
  const nextFormat = normalizeFormat(page.format);
  if (
    page.contentHtml !== nextContentHtml ||
    page.content !== nextContent ||
    page.format.fontFamily !== nextFormat.fontFamily ||
    page.format.fontSize !== nextFormat.fontSize ||
    page.format.lineHeight !== nextFormat.lineHeight
  ) {
    page.updatedAt = nowIso();
  }
  page.contentHtml = nextContentHtml;
  page.content = nextContent;
  page.format = nextFormat;
}

function splitLines(text) {
  if (!text) return [];
  return text.replace(/\r\n/g, "\n").replace(/\r/g, "\n").split("\n");
}

function tokenizeSegment(text, marks = {}) {
  return DiffCore.tokenizeText(text, marks);
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

function hashDiffText(value) {
  return DiffCore.hashText(value);
}

function diffHtmlSignature(html) {
  const text = String(html || "");
  return `${text.length}:${hashDiffText(text)}`;
}

function rememberLimitedCache(cache, key, value, limit) {
  if (cache.has(key)) cache.delete(key);
  cache.set(key, value);

  while (cache.size > limit) {
    cache.delete(cache.keys().next().value);
  }

  return value;
}

function cachedDiffBlocks(signature, html) {
  const cached = diffBlockCache.get(signature);
  if (!cached || cached.html !== html) return null;

  diffBlockCache.delete(signature);
  diffBlockCache.set(signature, cached);
  return cached;
}

function diffBlocksForPage(page) {
  ensurePageFields(page);
  const html = page.contentHtml || textToHtml(page.content || "");
  const signature = diffHtmlSignature(html);
  const cached = cachedDiffBlocks(signature, html);
  if (cached) return cached;

  const tokens = semanticTokensFromHtml(html);
  const blocks = DiffCore.splitDiffBlocks(tokens);
  return rememberLimitedCache(diffBlockCache, signature, {
    html,
    signature,
    tokens,
    blocks
  }, DIFF_BLOCK_CACHE_LIMIT);
}

function sameDiffPartsFromTokens(beforeTokens, afterTokens) {
  return afterTokens.map((token, index) => ({
    type: "same",
    text: token.text,
    marks: token.marks || beforeTokens[index]?.marks || {},
    beforeIndex: beforeTokens[index]?.index ?? index,
    afterIndex: token.index ?? index
  }));
}

function diffResultCacheKey(beforeInfo, afterInfo) {
  return `${beforeInfo.signature}>${afterInfo.signature}`;
}

function cachedDiffResult(beforeInfo, afterInfo) {
  const cacheKey = diffResultCacheKey(beforeInfo, afterInfo);
  const cached = diffResultCache.get(cacheKey);
  if (!cached || cached.beforeHtml !== beforeInfo.html || cached.afterHtml !== afterInfo.html) return null;

  diffResultCache.delete(cacheKey);
  diffResultCache.set(cacheKey, cached);
  return cached.result;
}

function rememberDiffResult(beforeInfo, afterInfo, result) {
  if ((result.parts?.length || 0) > DIFF_RESULT_MAX_CACHE_PARTS) return result;

  return rememberLimitedCache(diffResultCache, diffResultCacheKey(beforeInfo, afterInfo), {
    beforeHtml: beforeInfo.html,
    afterHtml: afterInfo.html,
    result
  }, DIFF_RESULT_CACHE_LIMIT).result;
}

function completeDiffResult(beforeInfo, afterInfo, parts) {
  return {
    parts,
    hasChanges: beforeInfo.html !== afterInfo.html || parts.some(DiffCore.isChangedDiffPart)
  };
}

function diffRichPagesResult(beforePage, afterPage) {
  const beforeInfo = diffBlocksForPage(beforePage);
  const afterInfo = diffBlocksForPage(afterPage);
  const cached = cachedDiffResult(beforeInfo, afterInfo);
  if (cached) return cached;

  if (beforeInfo.html === afterInfo.html) {
    return rememberDiffResult(beforeInfo, afterInfo, completeDiffResult(
      beforeInfo,
      afterInfo,
      sameDiffPartsFromTokens(beforeInfo.tokens, afterInfo.tokens)
    ));
  }

  const beforeBlocks = beforeInfo.blocks;
  const afterBlocks = afterInfo.blocks;
  const pairs = DiffCore.expandDiffBlockPairs(DiffCore.alignDiffBlocks(beforeBlocks, afterBlocks), beforeBlocks, afterBlocks);
  const parts = [];
  let beforeIndex = 0;
  let afterIndex = 0;

  pairs.forEach(range => {
    DiffCore.appendUnmatchedBlockGap(parts, beforeBlocks, afterBlocks, beforeIndex, range.beforeStart, afterIndex, range.afterStart);

    const beforeTokens = DiffCore.flattenDiffBlockRange(beforeBlocks, range.beforeStart, range.beforeEnd);
    const afterTokens = DiffCore.flattenDiffBlockRange(afterBlocks, range.afterStart, range.afterEnd);

    parts.push(...DiffCore.diffSequence(beforeTokens, afterTokens));
    beforeIndex = range.beforeEnd;
    afterIndex = range.afterEnd;
  });

  DiffCore.appendUnmatchedBlockGap(parts, beforeBlocks, afterBlocks, beforeIndex, beforeBlocks.length, afterIndex, afterBlocks.length);

  return rememberDiffResult(beforeInfo, afterInfo, completeDiffResult(
    beforeInfo,
    afterInfo,
    DiffCore.restoreIdenticalChangedTokens(parts)
  ));
}

function diffRichPages(beforePage, afterPage) {
  return diffRichPagesResult(beforePage, afterPage).parts;
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

function countDiffSegments(parts, type) {
  let count = 0;
  let text = "";

  const flush = () => {
    if (text.trim()) count += 1;
    text = "";
  };

  parts.forEach(part => {
    if (part.type === type) {
      text += part.text || "";
      return;
    }
    if (text) flush();
  });
  if (text) flush();

  return count;
}

function diffSegmentStats(parts) {
  return {
    adds: countDiffSegments(parts, "added"),
    dels: countDiffSegments(parts, "removed")
  };
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
  const historyMode = Boolean(versionHistoryDraftId);
  const storyHistoryActive = versionHistoryDraftId === STORY_KEY;
  const storySelectionDisabled = showChanges || historyMode;
  els.tabStrip?.classList.toggle("version-history-tabs", historyMode);
  els.storyTab.classList.toggle("history-tab", historyMode);
  els.storyTab.classList.toggle("active", historyMode ? storyHistoryActive : (!showChanges && activeArea === "story"));
  els.storyTab.classList.toggle("is-disabled", showChanges);
  els.storyTab.setAttribute("aria-disabled", String(showChanges));
  els.storyDisplayToggle.checked = storySelectionDisabled ? false : displayedPageKeys.has(STORY_KEY);
  els.storyDisplayToggle.disabled = storySelectionDisabled;
  els.storyDisplayToggle.setAttribute("aria-label", historyMode
    ? "Project notes display selection is not used in version history"
    : (showChanges ? "Project notes are not compared" : "Display Project notes"));
  const storyFocusButton = els.storyTab.querySelector("[data-story-focus]");
  if (storyFocusButton) {
    storyFocusButton.disabled = showChanges;
    storyFocusButton.setAttribute("aria-disabled", String(showChanges));
  }
  const selectedDrafts = selectedDraftDisplayCount();
  const hasDrafts = Boolean(state.drafts.length);
  const allSelected = hasDrafts && selectedDrafts === state.drafts.length;
  const partiallySelected = selectedDrafts > 0 && !allSelected;

  if (els.allDraftsTab && els.allDraftsToggle) {
    els.allDraftsTab.classList.toggle("is-partial", !historyMode && partiallySelected);
    els.allDraftsTab.classList.toggle("is-disabled", historyMode || !hasDrafts);
    els.allDraftsToggle.checked = historyMode ? false : allSelected;
    els.allDraftsToggle.indeterminate = historyMode ? false : partiallySelected;
    els.allDraftsToggle.disabled = historyMode || !hasDrafts;
    els.allDraftsToggle.setAttribute("aria-label", historyMode
      ? "Draft display selection is not used in version history"
      : (showChanges ? "Compare all drafts" : "Display all drafts"));
    els.allDraftsToggle.setAttribute("aria-checked", historyMode ? "false" : (partiallySelected ? "mixed" : String(allSelected)));
  }

  els.draftTabs.innerHTML = state.drafts.map((draft, index) => {
    const activeDraftId = historyMode ? versionHistoryDraftId : selectedDraftId;
    const active = draft.id === activeDraftId && (historyMode || activeArea !== "story") ? " active" : "";
    const checked = displayedPageKeys.has(draftContentKey(draft.id)) ? " checked" : "";
    const disabled = historyMode ? " disabled" : "";
    const historyClass = historyMode ? " history-tab" : "";
    const displayLabel = historyMode
      ? `Draft display selection is not used in version history for ${draft.title}`
      : `${showChanges ? "Compare" : "Display"} ${draft.title}`;
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
      <div class="page-tab draft-tab${historyClass}${active}" data-draft-tab-id="${draft.id}">
        <input type="checkbox" data-display-draft-id="${draft.id}" aria-label="${escapeHtml(displayLabel)}"${checked}${disabled}>
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
  const strip = els.tabStrip || els.storyTab?.closest(".tab-strip");
  if (!strip || !state) return;

  strip.classList.remove("compact-tabs", "scrollable-tabs");
  const needsCompactLabels = strip.scrollWidth > strip.clientWidth + 1;
  strip.classList.toggle("compact-tabs", needsCompactLabels);
  strip.classList.toggle("scrollable-tabs", strip.scrollWidth > strip.clientWidth + 1);
  updateTabScrollbar();
  requestAnimationFrame(updateTabScrollbar);
}

function tabScrollMetrics() {
  const strip = els.tabStrip;
  const track = els.tabScrollbar;
  const thumb = els.tabScrollbarThumb;
  if (!strip || !track || !thumb) return null;

  const scrollable = strip.scrollWidth > strip.clientWidth + 1;
  const maxScrollLeft = Math.max(0, strip.scrollWidth - strip.clientWidth);
  const trackWidth = track.clientWidth;
  const thumbWidth = scrollable && trackWidth
    ? Math.max(26, Math.round((strip.clientWidth / strip.scrollWidth) * trackWidth))
    : 0;
  const maxThumbLeft = Math.max(0, trackWidth - thumbWidth);

  return { strip, track, thumb, scrollable, maxScrollLeft, trackWidth, thumbWidth, maxThumbLeft };
}

function updateTabScrollbar() {
  const metrics = tabScrollMetrics();
  if (!metrics) return;

  const { strip, track, thumb, scrollable, maxScrollLeft, thumbWidth, maxThumbLeft } = metrics;
  const frame = els.tabStripFrame;
  frame?.classList.toggle("has-tab-overflow", scrollable);
  frame?.classList.toggle("can-scroll-left", scrollable && strip.scrollLeft > 1);
  frame?.classList.toggle("can-scroll-right", scrollable && strip.scrollLeft < maxScrollLeft - 1);
  track.hidden = !scrollable;

  if (!scrollable) return;

  const thumbLeft = maxScrollLeft
    ? Math.round((strip.scrollLeft / maxScrollLeft) * maxThumbLeft)
    : 0;
  thumb.style.width = `${thumbWidth}px`;
  thumb.style.transform = `translateX(${thumbLeft}px)`;
}

function scrollTabsFromTrackClientX(clientX) {
  const metrics = tabScrollMetrics();
  if (!metrics?.scrollable) return;

  const { strip, track, thumbWidth, maxScrollLeft, maxThumbLeft } = metrics;
  const rect = track.getBoundingClientRect();
  const thumbLeft = Math.max(0, Math.min(maxThumbLeft, clientX - rect.left - (thumbWidth / 2)));
  strip.scrollLeft = maxThumbLeft ? (thumbLeft / maxThumbLeft) * maxScrollLeft : 0;
  updateTabScrollbar();
}

function beginTabScrollbarDrag(event) {
  const metrics = tabScrollMetrics();
  if (!metrics?.scrollable) return;

  event.preventDefault();
  tabScrollbarDrag = true;
  els.tabStripFrame?.classList.add("is-dragging-scrollbar");
  scrollTabsFromTrackClientX(event.clientX);
  window.addEventListener("pointermove", dragTabScrollbar);
  window.addEventListener("pointerup", endTabScrollbarDrag, { once: true });
}

function dragTabScrollbar(event) {
  if (!tabScrollbarDrag) return;
  event.preventDefault();
  scrollTabsFromTrackClientX(event.clientX);
}

function endTabScrollbarDrag() {
  tabScrollbarDrag = null;
  els.tabStripFrame?.classList.remove("is-dragging-scrollbar");
  window.removeEventListener("pointermove", dragTabScrollbar);
}

function queueNotesHeadingDensityUpdate() {
  if (notesHeadingDensityFrame) return;
  notesHeadingDensityFrame = window.requestAnimationFrame(() => {
    notesHeadingDensityFrame = null;
    updateAllNotesHeadingDensity();
  });
}

function visibleElementWidth(element) {
  if (!element) return 0;
  const styles = window.getComputedStyle(element);
  if (styles.display === "none") {
    const horizontalPadding = (parseFloat(styles.paddingLeft) || 0) + (parseFloat(styles.paddingRight) || 0);
    const horizontalMargin = (parseFloat(styles.marginLeft) || 0) + (parseFloat(styles.marginRight) || 0);
    return Math.ceil(measuredTextWidth(element.textContent || "", element) + horizontalPadding + horizontalMargin);
  }
  return Math.ceil(Math.max(element.scrollWidth || 0, element.getBoundingClientRect().width || 0));
}

function styleGap(element) {
  if (!element) return 0;
  const styles = window.getComputedStyle(element);
  return parseFloat(styles.columnGap || styles.gap) || 0;
}

const DRAFT_HEADING_DENSITY_CLASSES = [
  "draft-heading-no-detach",
  "draft-heading-title-short",
  "draft-heading-hide-meta",
  "draft-heading-hide-detach",
  "draft-heading-hide-format"
];
const DRAFT_HEADING_META_MIN_WIDTH = 72;

function matchingElements(root, selector) {
  const elements = [];
  if (root instanceof Element && root.matches(selector)) elements.push(root);
  root?.querySelectorAll?.(selector).forEach(element => elements.push(element));
  return elements;
}

function draftHeadingTitleWidth(row, useShortTitle = false) {
  const input = row?.querySelector(".draft-title-input");
  if (!input) return 0;
  const shortTitle = row.querySelector(".draft-title-short-display")?.textContent || input.dataset.shortTitle || input.value;
  const text = useShortTitle ? shortTitle : input.value;
  return Math.ceil(measuredTextWidth(text, input) + horizontalPaddingWidth(input));
}

function headingHorizontalPadding(heading) {
  const styles = window.getComputedStyle(heading);
  return (parseFloat(styles.paddingLeft) || 0) + (parseFloat(styles.paddingRight) || 0);
}

function draftHeadingNaturalWidth(heading, options = {}) {
  const row = heading.querySelector(".draft-title-row");
  const metaWidth = options.metaWidth ?? visibleElementWidth(heading.querySelector(".meta"));
  const widths = [
    draftHeadingTitleWidth(row, options.shortTitle === true),
    options.includeFormat === false ? 0 : visibleElementWidth(heading.querySelector(".panel-format-toggle")),
    options.includeDetach === false ? 0 : visibleElementWidth(heading.querySelector(".panel-detach-button")),
    options.includeMeta === false ? 0 : metaWidth
  ].filter(Boolean);

  return headingHorizontalPadding(heading)
    + widths.reduce((total, width) => total + width, 0)
    + Math.max(0, widths.length - 1) * styleGap(heading);
}

function draftHeadingTitleIsClipped(row) {
  if (!row) return false;
  const input = row.querySelector(".draft-title-input");
  return Boolean(input && draftHeadingTitleWidth(row, false) > input.clientWidth + 1);
}

function updateDraftHeadingDensity(heading) {
  if (!heading) return;

  const row = heading.querySelector(".draft-title-row");
  if (!row) return;

  heading.classList.remove(...DRAFT_HEADING_DENSITY_CLASSES);
  heading.classList.toggle("draft-heading-no-detach", !heading.querySelector(".panel-detach-button"));
  row.classList.remove("use-short-title");

  const shortTitleWidth = Math.max(18, draftHeadingTitleWidth(row, true));
  heading.style.setProperty("--draft-heading-title-min", `${shortTitleWidth}px`);

  const availableWidth = heading.clientWidth || 0;
  if (!availableWidth) return;

  if (
    draftHeadingNaturalWidth(heading, { shortTitle: false }) > availableWidth + 1 ||
    draftHeadingTitleIsClipped(row)
  ) {
    row.classList.add("use-short-title");
    heading.classList.add("draft-heading-title-short");
  }

  const useShortTitle = row.classList.contains("use-short-title");
  if (
    draftHeadingNaturalWidth(heading, {
      shortTitle: useShortTitle,
      metaWidth: DRAFT_HEADING_META_MIN_WIDTH
    }) > availableWidth + 1
  ) {
    heading.classList.add("draft-heading-hide-meta");
  }
  if (
    (!heading.querySelector(".panel-detach-button") && heading.classList.contains("draft-heading-hide-meta")) ||
    draftHeadingNaturalWidth(heading, { shortTitle: useShortTitle, includeMeta: false }) > availableWidth + 1
  ) {
    heading.classList.add("draft-heading-hide-detach");
  }
  if (draftHeadingNaturalWidth(heading, { shortTitle: useShortTitle, includeMeta: false, includeDetach: false }) > availableWidth + 1) {
    heading.classList.add("draft-heading-hide-format");
  }
}

function updateAllDraftHeadingDensity(root = document) {
  const headings = new Set();
  matchingElements(root, ".draft-title-row").forEach(row => {
    const heading = row.closest(".panel-heading:not(.notes-toggle-heading)");
    if (heading) headings.add(heading);
  });
  headings.forEach(updateDraftHeadingDensity);
}

function queueDraftHeadingDensityUpdate() {
  if (draftHeadingDensityFrame) return;
  draftHeadingDensityFrame = window.requestAnimationFrame(() => {
    draftHeadingDensityFrame = null;
    updateAllDraftHeadingDensity();
  });
}

function observeDraftHeadingDensity() {
  if (!("ResizeObserver" in window) || !els.pageCanvas) return;
  if (!draftHeadingResizeObserver) {
    draftHeadingResizeObserver = new ResizeObserver(queueDraftHeadingDensityUpdate);
  }
  draftHeadingResizeObserver.disconnect();
  updateAllDraftHeadingDensity(els.pageCanvas);
  matchingElements(els.pageCanvas, ".draft-title-row").forEach(row => {
    const heading = row.closest(".panel-heading:not(.notes-toggle-heading)");
    if (heading) draftHeadingResizeObserver.observe(heading);
  });
}

function notesHeadingNaturalWidth(heading, options = {}) {
  const includeHint = options.includeHint === true;
  const includeLabel = options.includeLabel !== false;
  const includeWordStats = options.includeWordStats !== false;
  const main = heading.querySelector(".notes-heading-main");
  const actions = heading.querySelector(".notes-heading-actions");
  const caret = heading.querySelector(".notes-caret");
  const label = heading.querySelector(".panel-kicker");
  const hint = heading.querySelector(".notes-collapse-hint");
  const formatButton = heading.querySelector(".panel-format-toggle");
  const detachButton = heading.querySelector(".panel-detach-button");
  const wordCount = heading.querySelector(".notes-heading-word-count");
  const divider = heading.querySelector(".notes-heading-stat-divider");
  const date = heading.querySelector(".notes-heading-last-edited");

  const headingStyles = window.getComputedStyle(heading);
  const horizontalPadding = (parseFloat(headingStyles.paddingLeft) || 0) + (parseFloat(headingStyles.paddingRight) || 0);
  const headingGap = styleGap(heading);
  const actionsGap = styleGap(actions);
  const mainGap = styleGap(main);
  const statsGap = styleGap(heading.querySelector(".notes-heading-stats"));

  const mainWidths = [
    visibleElementWidth(caret),
    includeLabel ? visibleElementWidth(label) : 0
  ].filter(Boolean);
  const mainWidth = mainWidths.reduce((total, width) => total + width, 0)
    + Math.max(0, mainWidths.length - 1) * mainGap;

  const statsWidths = [
    includeWordStats ? visibleElementWidth(wordCount) : 0,
    includeWordStats ? visibleElementWidth(divider) : 0,
    visibleElementWidth(date)
  ].filter(Boolean);
  const statsWidth = statsWidths.reduce((total, width) => total + width, 0)
    + Math.max(0, statsWidths.length - 1) * statsGap;

  const actionWidths = [
    visibleElementWidth(formatButton),
    includeHint ? visibleElementWidth(hint) : 0,
    visibleElementWidth(detachButton),
    statsWidth
  ].filter(Boolean);
  const actionsWidth = actionWidths.reduce((total, width) => total + width, 0)
    + Math.max(0, actionWidths.length - 1) * actionsGap;

  const headerWidths = [
    mainWidth,
    actionsWidth
  ].filter(Boolean);

  return horizontalPadding
    + headerWidths.reduce((total, width) => total + width, 0)
    + Math.max(0, headerWidths.length - 1) * headingGap;
}

function notesHeadingNeedsCompaction(heading, options = {}) {
  return notesHeadingNaturalWidth(heading, options) > heading.clientWidth + 1;
}

function updateNotesHeadingDensity(heading) {
  if (!heading) return;

  heading.classList.remove("notes-heading-hide-hint", "notes-heading-hide-label", "notes-heading-is-tight");

  const main = heading.querySelector(".notes-heading-main");
  if (!main) return;

  void heading.offsetWidth;
  if (notesHeadingNeedsCompaction(heading, { includeHint: true })) {
    heading.classList.add("notes-heading-hide-hint");
    void heading.offsetWidth;
  }
  if (notesHeadingNeedsCompaction(heading, { includeHint: false })) {
    heading.classList.add("notes-heading-hide-label");
    void heading.offsetWidth;
  }
  if (notesHeadingNeedsCompaction(heading, { includeHint: false, includeLabel: false })) {
    heading.classList.add("notes-heading-is-tight");
    void heading.offsetWidth;
  }
}

function updateAllNotesHeadingDensity() {
  els.pageCanvas
    ?.querySelectorAll(".notes-toggle-heading")
    .forEach(updateNotesHeadingDensity);
}

function observeNotesHeadingDensity() {
  if (!("ResizeObserver" in window) || !els.pageCanvas) return;
  if (!notesHeadingResizeObserver) {
    notesHeadingResizeObserver = new ResizeObserver(queueNotesHeadingDensityUpdate);
  }
  notesHeadingResizeObserver.disconnect();
  els.pageCanvas
    .querySelectorAll(".notes-toggle-heading")
    .forEach(heading => notesHeadingResizeObserver.observe(heading));
}

const textMeasureCanvas = document.createElement("canvas");
const textMeasureContext = textMeasureCanvas.getContext("2d");

function measuredTextWidth(text, element) {
  if (!textMeasureContext || !element) return 0;
  const styles = window.getComputedStyle(element);
  textMeasureContext.font = `${styles.fontStyle} ${styles.fontVariant} ${styles.fontWeight} ${styles.fontSize} ${styles.fontFamily}`;
  const baseWidth = textMeasureContext.measureText(String(text || "")).width;
  const letterSpacing = parseFloat(styles.letterSpacing);
  return Number.isFinite(letterSpacing)
    ? baseWidth + Math.max(0, String(text || "").length - 1) * letterSpacing
    : baseWidth;
}

function horizontalPaddingWidth(element) {
  const styles = window.getComputedStyle(element);
  return (parseFloat(styles.paddingLeft) || 0) + (parseFloat(styles.paddingRight) || 0);
}

function formatPickerLabelWidthStyle(field, values) {
  if (field !== "fontFamily" || !textMeasureContext) return "";
  const styles = window.getComputedStyle(document.documentElement);
  const fontFamily = styles.getPropertyValue("--font-ui").trim() || "Segoe UI, Arial, sans-serif";
  textMeasureContext.font = `12.5px ${fontFamily}`;
  const labelWidth = Math.ceil(Math.max(...values.map(value => textMeasureContext.measureText(String(value)).width)));
  return ` style="--picker-label-width: ${labelWidth}px;"`;
}

function updateCompactTitleLabels(root = document) {
  matchingElements(root, ".compact-title").forEach(title => {
    title.classList.remove("use-short-title");
    const full = title.querySelector(".compact-title-full");
    if (!full) return;
    const availableWidth = title.parentElement?.clientWidth || title.clientWidth || 0;
    if (availableWidth && measuredTextWidth(full.textContent, full) > availableWidth + 1) {
      title.classList.add("use-short-title");
    }
  });

  updateAllDraftHeadingDensity(root);
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
  const pickerStyle = formatPickerLabelWidthStyle(field, values);
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
    <div class="fr-picker ${className}" data-page-format-picker="${escapeHtml(field)}" data-value="${escapeHtml(defaultValue)}"${pickerStyle}>
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
  const parsedPageKey = parseDraftPageKey(pageKey);
  const versionHistoryButton = parsedPageKey?.type === "content" || parsedPageKey?.type === "story"
    ? `<button class="fr-btn" type="button" data-version-history="${escapeHtml(pageKey)}" title="Version history" aria-label="Version history">${toolbarIcons.history}</button>`
    : "";
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
        ${formatPickerHtml("lineHeight", "Line spacing", LINE_HEIGHT_OPTIONS, "line-height")}
      </div>
      <div class="fr-group">
        <button class="fr-btn" type="button" data-search-page="${escapeHtml(pageKey)}" title="Search this page" aria-label="Search this page">${toolbarIcons.search}</button>
        ${versionHistoryButton}
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
  const notesHeaderStats = isNotesPanel && item.draft
    ? `
      <div class="notes-heading-stats" aria-label="${escapeHtml(item.draft.title)} statistics">
        <span class="notes-heading-word-count" data-draft-word-count>${formatWordCount(pageWordCount(item.draft))}</span>
        <span class="notes-heading-stat-divider" aria-hidden="true"></span>
        <span class="notes-heading-last-edited" data-draft-last-edited>Last edited: ${formatDate(item.draft.updatedAt || item.draft.createdAt)}</span>
      </div>
    `
    : "";
  const createdDateText = formatDate(item.createdAt);
  const headerDateText = item.type === "draft" ? `Created: ${createdDateText}` : createdDateText;
  const hasToolbar = !options.collapsed;
  const ribbonId = `format-ribbon-${item.key}`;
  const shortDraftTitle = item.editableTitle ? draftShortNumber(item.draft) : "";
  const titleRow = item.editableTitle
    ? `
      <div class="panel-title-row draft-title-row">
        <input
          id="title-${escapeHtml(item.key)}"
          class="draft-title-input"
          data-title-draft-id="${escapeHtml(item.draft.id)}"
          data-short-title="${escapeHtml(shortDraftTitle)}"
          type="text"
          autocomplete="off"
          aria-label="${escapeHtml(item.kicker)} title"
          value="${escapeHtml(item.draft.title)}"
        >
        <span class="draft-title-short-display" aria-hidden="true">${escapeHtml(shortDraftTitle)}</span>
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
  const detachUnitKey = options.detachUnitKey || "";
  const detachButton = panelDragEnabled && detachUnitKey && !detachedUnitKeys.has(detachUnitKey)
    ? `
      <button
        class="panel-detach-button"
        type="button"
        data-detach-unit-key="${escapeHtml(detachUnitKey)}"
        title="Extract panel"
        aria-label="Extract ${escapeHtml(options.detachTitle || item.title)} to a separate window"
      >${toolbarIcons.detach}</button>
    `
    : "";
  const headingInner = isNotesPanel
    ? `
      <div class="notes-heading-main">
        ${notesCaret}
        ${headingContent}
      </div>
      <div class="notes-heading-actions">
        ${formatButton}
        ${notesHint}
        ${detachButton}
        ${notesHeaderStats}
      </div>
    `
    : `
      ${headingContent}
      ${formatButton}
      ${detachButton}
      <span class="meta" title="Created ${createdDateText}">${headerDateText}</span>
    `;
  const placeholder = item.type === "story"
    ? "Project notes..."
    : (item.type === "notes" ? "Draft notes..." : "Start drafting...");
  const pageToolbar = hasToolbar
    ? formatRibbonHtml(item.key, item.title, options)
    : "";
  const pageStyle = options.pageStyle ? ` style="${escapeHtml(options.pageStyle)}"` : "";
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
      <div class="page-search-bar" data-search-bar-for="${escapeHtml(item.key)}" hidden>
        <span class="page-search-count" data-search-count>No matches</span>
        <span class="page-search-position" data-search-position></span>
        <button type="button" data-search-page-prev="${escapeHtml(item.key)}" aria-label="Previous match in ${escapeHtml(item.title)}">Prev</button>
        <button type="button" data-search-page-next="${escapeHtml(item.key)}" aria-label="Next match in ${escapeHtml(item.title)}">Next</button>
      </div>
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
    <section class="editor-panel${standaloneClass} ${escapeHtml(item.type)}-display-page${collapsedClass}" data-page-key="${escapeHtml(item.key)}"${pageStyle} aria-label="${escapeHtml(item.ariaLabel)}">
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
  if (displayedPageKeys.has(STORY_KEY) && !detachedUnitKeys.has(STORY_KEY)) {
    items.push(pageItemForKey(STORY_KEY));
  }
  state.drafts.forEach(draft => {
    if (!displayedPageKeys.has(draftContentKey(draft.id))) return;
    if (detachedUnitKeys.has(draftUnitKey(draft.id))) return;
    items.push(pageItemForKey(draftContentKey(draft.id)));
    if (!collapsedNotesIds.has(draft.id)) items.push(pageItemForKey(draftNotesKey(draft.id)));
  });
  return items.filter(Boolean);
}

function pageWidthResizerHtml(beforeKey, afterKey) {
  return `
    <div
      class="page-width-resizer"
      data-resize-page-before="${escapeHtml(beforeKey)}"
      data-resize-page-after="${escapeHtml(afterKey)}"
      role="separator"
      aria-orientation="vertical"
      aria-label="Resize page panels"
      tabindex="0"
    ></div>
  `;
}

function draftStackHtml(draft) {
  if (detachedUnitKeys.has(draftUnitKey(draft.id))) return "";

  const draftItem = pageItemForKey(draftContentKey(draft.id));
  const notesItem = pageItemForKey(draftNotesKey(draft.id));
  const collapsed = collapsedNotesIds.has(draft.id);
  const paneKey = topLevelPageKeyForDraft(draft.id);

  return `
    <section class="draft-stack-page display-page${collapsed ? " notes-are-collapsed" : ""}" data-draft-stack-id="${escapeHtml(draft.id)}" data-page-key="${escapeHtml(paneKey)}" style="${escapeHtml(pagePaneStyle(paneKey, `--draft-pane-height: ${getNotesPanePercent(draft.id)}%;`))}" aria-label="${escapeHtml(draft.title)}">
      ${editorPanelHtml(draftItem, {
        standalone: false,
        detachUnitKey: draftUnitKey(draft.id),
        detachTitle: `${draft.title} and notes`
      })}
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
  ensureProjectNotesVersionHistory();
  state.drafts.forEach(draft => {
    ensurePageFields(draft);
    ensureDraftVersionHistory(draft);
    ensurePageFields(draft.notes);
  });

  const selectedDrafts = state.drafts.filter(draft => displayedPageKeys.has(draftContentKey(draft.id)));
  const hasStory = displayedPageKeys.has(STORY_KEY) && !detachedUnitKeys.has(STORY_KEY);
  const topLevelKeys = topLevelDisplayPageKeys();
  normalizePagePanePercentsForLayout(topLevelKeys);
  const pageEntries = [
    hasStory
      ? {
          key: STORY_KEY,
          html: editorPanelHtml(pageItemForKey(STORY_KEY), {
            detachUnitKey: STORY_KEY,
            detachTitle: PROJECT_NOTES_TITLE,
            pageStyle: pagePaneStyle(STORY_KEY)
          })
        }
      : null,
    ...selectedDrafts
      .filter(draft => !detachedUnitKeys.has(draftUnitKey(draft.id)))
      .map(draft => ({
        key: topLevelPageKeyForDraft(draft.id),
        html: draftStackHtml(draft)
      }))
  ].filter(Boolean);
  const pageHtml = pageEntries.flatMap((entry, index) => {
    if (index >= pageEntries.length - 1) return [entry.html];
    const nextEntry = pageEntries[index + 1];
    return [entry.html, pageWidthResizerHtml(entry.key, nextEntry.key)];
  });

  els.pageCanvas.classList.toggle("empty-page-canvas", !pageHtml.length);
  els.pageCanvas.innerHTML = pageHtml.length
    ? pageHtml.join("")
    : `<p class="empty-state page-empty-state">No pages selected.</p>`;

  hydrateVisibleEditors(visibleEditorItems());
  observeNotesHeadingDensity();
  observeDraftHeadingDensity();
  queueNotesHeadingDensityUpdate();
  queueDraftHeadingDensityUpdate();
  window.requestAnimationFrame(() => refreshSearchResults({ allowRender: false }));
}

function refreshDraftNoteStats(draft, panel = null) {
  if (!draft?.id) return;

  const notesPanel = panel || pagePanelForKey(draftNotesKey(draft.id));
  if (!notesPanel) return;

  const draftWordCount = notesPanel.querySelector("[data-draft-word-count]");
  if (draftWordCount) {
    draftWordCount.textContent = formatWordCount(pageWordCount(draft));
  }

  const draftLastEdited = notesPanel.querySelector("[data-draft-last-edited]");
  if (draftLastEdited) {
    draftLastEdited.textContent = `Last edited: ${formatDate(draft.updatedAt || draft.createdAt)}`;
  }

  const heading = notesPanel.querySelector(".notes-toggle-heading");
  window.requestAnimationFrame(() => updateNotesHeadingDensity(heading));
}

function refreshDraftNoteStatsForEditor(editorEl) {
  const parsed = parseDraftPageKey(editorEl?.dataset.editorKey);
  if (parsed?.type !== "content") return;

  const draft = draftById(parsed.draftId);
  if (!draft) return;

  const notesPanel = pagePanelForKey(draftNotesKey(draft.id));
  if (!notesPanel) return;

  const draftWordCount = notesPanel.querySelector("[data-draft-word-count]");
  if (draftWordCount) {
    const page = pageForEditorKey(editorEl.dataset.editorKey);
    draftWordCount.textContent = formatWordCount(wordCountForText(page?.content ?? editorPlainText(editorEl)));
  }

  const draftLastEdited = notesPanel.querySelector("[data-draft-last-edited]");
  if (draftLastEdited) {
    draftLastEdited.textContent = `Last edited: ${formatDate(draft.updatedAt || nowIso())}`;
  }

  const heading = notesPanel.querySelector(".notes-toggle-heading");
  window.requestAnimationFrame(() => updateNotesHeadingDensity(heading));
}

function queueDraftNoteStatsRefresh(editorEl, delay = WORD_COUNT_REFRESH_DELAY_MS) {
  const editorKey = editorEl?.dataset.editorKey;
  if (!editorKey) return;

  window.clearTimeout(draftNoteStatsTimers.get(editorKey));
  draftNoteStatsTimers.set(editorKey, window.setTimeout(() => {
    draftNoteStatsTimers.delete(editorKey);
    refreshDraftNoteStatsForEditor(editorEl);
  }, delay));
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

    if (item.type === "notes" && item.draft) refreshDraftNoteStats(item.draft, panel);
  });
  window.requestAnimationFrame(updateAllNotesHeadingDensity);
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

  const tokens = diffBlocksForPage(page).tokens
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
          <div class="title">${compactTitleHtml(draft.title, draftShortNumber(draft))}</div>
        </div>
        <div class="meta">Created: ${formatDate(draft.createdAt)}</div>
      </div>
      <div class="compare-page-body" style="${fontStyle(draft.format)}">
        ${comparePageContentHtml(draft)}
      </div>
    </article>
  `;
}

function normalizedDiffResult(diffResult) {
  return Array.isArray(diffResult)
    ? { parts: diffResult, hasChanges: diffResult.some(DiffCore.isChangedDiffPart) }
    : diffResult;
}

function compareStatsHtml(diffResult) {
  const stats = diffSegmentStats(diffResult.parts);
  return `
    <div class="compare-stats">
      <span class="stat add"><span class="num">+${stats.adds}</span> added</span>
      <span class="stat del"><span class="num">-${stats.dels}</span> deleted</span>
    </div>
  `;
}

function markedLaterPageHtml(pair, diffResult = diffRichPagesResult(pair.before, pair.after)) {
  const result = normalizedDiffResult(diffResult);
  const diff = result.parts;
  if (!diff.length) {
    return `<div class="compare-text empty-line">No draft text yet.</div>`;
  }

  const tokens = diff.map(part => renderDiffToken(part, pair)).join("");
  return `<div class="compare-text">${tokens}</div>`;
}

function markedComparePageHtml(pair) {
  const diffResult = diffRichPagesResult(pair.before, pair.after);

  return `
    <article class="compare-page later-page" data-compare-page-id="${escapeHtml(pair.after.id)}">
      <div class="compare-page-header">
        <div class="kicker">CHANGES</div>
        <div class="title-row">
          <div class="title">${compactTitleHtml(pair.after.title, draftShortNumber(pair.after))}</div>
          <div class="vs">${compactTitleHtml(`vs ${pair.before.title}`, `vs ${draftShortNumber(pair.before)}`)}</div>
        </div>
        <div class="meta">
          <div>Created: ${formatDate(pair.after.createdAt)}</div>
          ${compareStatsHtml(diffResult)}
        </div>
      </div>
      <div class="compare-page-body" style="${fontStyle(pair.after.format)}">
        ${markedLaterPageHtml(pair, diffResult)}
      </div>
    </article>
  `;
}

function draftVersionNumber(draft, index) {
  const draftIndex = state.drafts.findIndex(item => item.id === draft.id);
  return `${Math.max(0, draftIndex) + 1}.${index + 1}`;
}

function draftShortNumber(draft) {
  const draftIndex = state.drafts.findIndex(item => item.id === draft?.id);
  return String(Math.max(0, draftIndex) + 1);
}

function draftVersionPage(draft, version, index) {
  const number = draftVersionNumber(draft, index);
  const label = `Draft ${number}`;
  return {
    id: version.id,
    title: label,
    shortTitle: number,
    createdAt: version.createdAt,
    updatedAt: version.createdAt,
    content: version.content || "",
    contentHtml: version.contentHtml || textToHtml(version.content || ""),
    format: normalizeFormat(version.format || draft.format)
  };
}

function projectNotesVersionNumber(index) {
  return String(index + 1);
}

function projectNotesVersionPage(version, index) {
  const number = projectNotesVersionNumber(index);
  const page = state.initialNotes || {};
  return {
    id: version.id,
    title: `Project notes ${number}`,
    shortTitle: `PN ${number}`,
    createdAt: version.createdAt,
    updatedAt: version.createdAt,
    content: version.content || "",
    contentHtml: version.contentHtml || textToHtml(version.content || ""),
    format: normalizeFormat(version.format || page.format)
  };
}

function versionDiffSideTokenWindow(parts, side) {
  const indexKey = side === "after" ? "afterIndex" : "beforeIndex";
  const changedIndexes = [];
  const tokenIndexes = [];

  parts.forEach((part, index) => {
    if (!DiffCore.isChangedDiffPart(part)) return;
    changedIndexes.push(index);
    if (Number.isInteger(part[indexKey])) tokenIndexes.push(part[indexKey]);
  });

  if (!changedIndexes.length) return null;
  if (tokenIndexes.length) {
    return {
      start: Math.min(...tokenIndexes),
      end: Math.max(...tokenIndexes) + 1
    };
  }

  const firstChangedIndex = changedIndexes[0];
  const lastChangedIndex = changedIndexes[changedIndexes.length - 1];
  let beforeAnchor = null;
  let afterAnchor = null;

  for (let index = firstChangedIndex - 1; index >= 0; index -= 1) {
    if (Number.isInteger(parts[index][indexKey])) {
      beforeAnchor = parts[index][indexKey] + 1;
      break;
    }
  }

  for (let index = lastChangedIndex + 1; index < parts.length; index += 1) {
    if (Number.isInteger(parts[index][indexKey])) {
      afterAnchor = parts[index][indexKey];
      break;
    }
  }

  const anchor = Number.isInteger(beforeAnchor) ? beforeAnchor : (Number.isInteger(afterAnchor) ? afterAnchor : 0);
  return { start: anchor, end: anchor };
}

function versionTokenWindowGap(left, right) {
  if (!left || !right) return Infinity;
  if (left.end < right.start) return right.start - left.end;
  if (right.end < left.start) return left.start - right.end;
  return 0;
}

function versionTokensBetweenWindows(tokens, left, right) {
  const start = Math.min(left.end, right.end);
  const end = Math.max(left.start, right.start);
  return tokens.slice(start, end).map(token => token.text || "").join("");
}

function versionWindowsTouchSamePhrase(sharedPage, left, right) {
  const gap = versionTokenWindowGap(left, right);
  if (!Number.isFinite(gap)) return false;
  if (gap <= 4) return true;
  if (gap > 24) return false;

  const tokens = diffBlocksForPage(sharedPage).tokens;
  const between = versionTokensBetweenWindows(tokens, left, right);
  return !/[.!?\n]/u.test(between);
}

function versionTransitionInfo(versions, pageForVersion, beforeIndex) {
  const before = pageForVersion(versions[beforeIndex], beforeIndex);
  const after = pageForVersion(versions[beforeIndex + 1], beforeIndex + 1);
  const diffResult = diffRichPagesResult(before, after);
  if (!diffResult.hasChanges) return null;

  return {
    before,
    after,
    beforeIndex,
    afterIndex: beforeIndex + 1,
    beforeWindow: versionDiffSideTokenWindow(diffResult.parts, "before"),
    afterWindow: versionDiffSideTokenWindow(diffResult.parts, "after")
  };
}

function shouldMergeVersionTransitions(previous, next, sharedPage) {
  return versionWindowsTouchSamePhrase(sharedPage, previous.afterWindow, next.beforeWindow);
}

function coalescedVersionRuns(versions, pageForVersion) {
  const runs = [];
  let run = null;

  const flushRun = () => {
    if (!run) return;
    runs.push({
      beforeIndex: run.beforeIndex,
      afterIndex: run.afterIndex,
      beforeVersion: versions[run.beforeIndex],
      afterVersion: versions[run.afterIndex],
      coalescedVersionCount: run.afterIndex - run.beforeIndex
    });
    run = null;
  };

  for (let index = 0; index < versions.length - 1; index += 1) {
    const info = versionTransitionInfo(versions, pageForVersion, index);
    if (!info) continue;

    if (
      run &&
      run.afterIndex === info.beforeIndex &&
      shouldMergeVersionTransitions(run.lastInfo, info, pageForVersion(versions[info.beforeIndex], info.beforeIndex))
    ) {
      run.afterIndex = info.afterIndex;
      run.lastInfo = info;
      continue;
    }

    flushRun();
    run = {
      beforeIndex: info.beforeIndex,
      afterIndex: info.afterIndex,
      lastInfo: info
    };
  }

  flushRun();
  return runs;
}

function coalescedDraftVersionRuns(draft) {
  const versions = ensureDraftVersionHistory(draft);
  return coalescedVersionRuns(versions, (version, index) => draftVersionPage(draft, version, index));
}

function coalescedProjectNotesVersionRuns() {
  const versions = ensureProjectNotesVersionHistory();
  return coalescedVersionRuns(versions, projectNotesVersionPage);
}

function versionCoalescedMetaHtml(count) {
  if (!(count > 1)) return "";
  return `<div>${Number(count).toLocaleString("en-GB")} autosaves coalesced</div>`;
}

function baseVersionPageHtml(draft, version, index) {
  const page = draftVersionPage(draft, version, index);
  const versionLabel = draftVersionNumber(draft, index);
  const recordedText = formatVersionDate(page.createdAt);
  const fullRecordedText = formatDate(page.createdAt);
  return `
    <article class="compare-page is-baseline version-page" data-compare-page-id="${escapeHtml(page.id)}">
      <div class="compare-page-header version-page-header">
        <div class="kicker">VERSION</div>
        <div class="title-row version-page-title-row">
          <div class="title">${compactTitleHtml(page.title, page.shortTitle)}</div>
        </div>
        <div class="meta version-page-meta">
          <div class="version-recorded" title="Recorded: ${escapeHtml(fullRecordedText)}">Recorded ${escapeHtml(recordedText)}</div>
        </div>
        <button
          class="version-restore-button"
          type="button"
          data-restore-draft-id="${escapeHtml(draft.id)}"
          data-restore-version-id="${escapeHtml(version.id)}"
          title="Restore Draft ${escapeHtml(versionLabel)}"
          aria-label="Restore Draft ${escapeHtml(versionLabel)}"
        >Restore</button>
      </div>
      <div class="compare-page-body" style="${fontStyle(page.format)}">
        ${comparePageContentHtml(page)}
      </div>
    </article>
  `;
}

function baseProjectNotesVersionPageHtml(version, index) {
  const page = projectNotesVersionPage(version, index);
  const versionLabel = projectNotesVersionNumber(index);
  const recordedText = formatVersionDate(page.createdAt);
  const fullRecordedText = formatDate(page.createdAt);
  return `
    <article class="compare-page is-baseline version-page" data-compare-page-id="${escapeHtml(page.id)}">
      <div class="compare-page-header version-page-header">
        <div class="kicker">VERSION</div>
        <div class="title-row version-page-title-row">
          <div class="title">${compactTitleHtml(page.title, page.shortTitle)}</div>
        </div>
        <div class="meta version-page-meta">
          <div class="version-recorded" title="Recorded: ${escapeHtml(fullRecordedText)}">Recorded ${escapeHtml(recordedText)}</div>
        </div>
        <button
          class="version-restore-button"
          type="button"
          data-restore-project-notes-version-id="${escapeHtml(version.id)}"
          title="Restore Project notes ${escapeHtml(versionLabel)}"
          aria-label="Restore Project notes ${escapeHtml(versionLabel)}"
        >Restore</button>
      </div>
      <div class="compare-page-body" style="${fontStyle(page.format)}">
        ${comparePageContentHtml(page)}
      </div>
    </article>
  `;
}

function versionComparePageHtml(draft, version, index, previousVersion = null, previousIndex = index - 1, options = {}) {
  const page = draftVersionPage(draft, version, index);
  if (!previousVersion) return baseVersionPageHtml(draft, version, index);

  const versionLabel = draftVersionNumber(draft, index);
  const previousPage = draftVersionPage(draft, previousVersion, previousIndex);
  const pair = {
    before: previousPage,
    after: page,
    label: `${page.title} compared to ${previousPage.title}`
  };
  const diffResult = diffRichPagesResult(previousPage, page);
  const recordedText = formatVersionDate(page.createdAt);
  const fullRecordedText = formatDate(page.createdAt);

  return `
    <article class="compare-page later-page version-page" data-compare-page-id="${escapeHtml(page.id)}">
      <div class="compare-page-header version-page-header">
        <div class="kicker">VERSION</div>
        <div class="title-row version-page-title-row">
          <div class="title">${compactTitleHtml(page.title, page.shortTitle)}</div>
          <div class="vs">${compactTitleHtml(`vs ${previousPage.title}`, `vs ${previousPage.shortTitle}`)}</div>
        </div>
        <div class="meta version-page-meta">
          <div class="version-recorded" title="Recorded: ${escapeHtml(fullRecordedText)}">Recorded ${escapeHtml(recordedText)}</div>
          ${versionCoalescedMetaHtml(options.coalescedVersionCount)}
          ${compareStatsHtml(diffResult)}
        </div>
        <button
          class="version-restore-button"
          type="button"
          data-restore-draft-id="${escapeHtml(draft.id)}"
          data-restore-version-id="${escapeHtml(version.id)}"
          title="Restore Draft ${escapeHtml(versionLabel)}"
          aria-label="Restore Draft ${escapeHtml(versionLabel)}"
        >Restore</button>
      </div>
      <div class="compare-page-body" style="${fontStyle(page.format)}">
        ${markedLaterPageHtml(pair, diffResult)}
      </div>
    </article>
  `;
}

function projectNotesVersionComparePageHtml(version, index, previousVersion = null, previousIndex = index - 1, options = {}) {
  const page = projectNotesVersionPage(version, index);
  if (!previousVersion) return baseProjectNotesVersionPageHtml(version, index);

  const versionLabel = projectNotesVersionNumber(index);
  const previousPage = projectNotesVersionPage(previousVersion, previousIndex);
  const pair = {
    before: previousPage,
    after: page,
    label: `${page.title} compared to ${previousPage.title}`
  };
  const diffResult = diffRichPagesResult(previousPage, page);
  const recordedText = formatVersionDate(page.createdAt);
  const fullRecordedText = formatDate(page.createdAt);

  return `
    <article class="compare-page later-page version-page" data-compare-page-id="${escapeHtml(page.id)}">
      <div class="compare-page-header version-page-header">
        <div class="kicker">VERSION</div>
        <div class="title-row version-page-title-row">
          <div class="title">${compactTitleHtml(page.title, page.shortTitle)}</div>
          <div class="vs">${compactTitleHtml(`vs ${previousPage.title}`, `vs ${previousPage.shortTitle}`)}</div>
        </div>
        <div class="meta version-page-meta">
          <div class="version-recorded" title="Recorded: ${escapeHtml(fullRecordedText)}">Recorded ${escapeHtml(recordedText)}</div>
          ${versionCoalescedMetaHtml(options.coalescedVersionCount)}
          ${compareStatsHtml(diffResult)}
        </div>
        <button
          class="version-restore-button"
          type="button"
          data-restore-project-notes-version-id="${escapeHtml(version.id)}"
          title="Restore Project notes ${escapeHtml(versionLabel)}"
          aria-label="Restore Project notes ${escapeHtml(versionLabel)}"
        >Restore</button>
      </div>
      <div class="compare-page-body" style="${fontStyle(page.format)}">
        ${markedLaterPageHtml(pair, diffResult)}
      </div>
    </article>
  `;
}

function renderDraftVersionHistoryStrip(draft) {
  const versions = ensureDraftVersionHistory(draft);
  const pages = versions.length ? [baseVersionPageHtml(draft, versions[0], 0)] : [];
  coalescedDraftVersionRuns(draft).forEach(run => {
    pages.push(versionComparePageHtml(
      draft,
      run.afterVersion,
      run.afterIndex,
      run.beforeVersion,
      run.beforeIndex,
      { coalescedVersionCount: run.coalescedVersionCount }
    ));
  });
  return compareStripHtml(pages, "version-history-strip");
}

function renderProjectNotesVersionHistoryStrip() {
  const versions = ensureProjectNotesVersionHistory();
  const pages = versions.length ? [baseProjectNotesVersionPageHtml(versions[0], 0)] : [];
  coalescedProjectNotesVersionRuns().forEach(run => {
    pages.push(projectNotesVersionComparePageHtml(
      run.afterVersion,
      run.afterIndex,
      run.beforeVersion,
      run.beforeIndex,
      { coalescedVersionCount: run.coalescedVersionCount }
    ));
  });
  return compareStripHtml(pages, "version-history-strip");
}

function selectedCompareIndexes() {
  return state.drafts
    .map((draft, index) => displayedPageKeys.has(draftContentKey(draft.id)) ? index : null)
    .filter(index => index !== null);
}

function beforeIndexForSelectedDraft(indexes, position) {
  return els.compareMode.value === "first" ? indexes[0] : indexes[position - 1];
}

function compareVisiblePageCount(pageCount) {
  return Math.max(1, Math.min(normalizePagesOnScreenForSelection(pagesOnScreen), Number(pageCount) || 1));
}

function compareStripHtml(pages, className = "") {
  const visiblePages = compareVisiblePageCount(pages.length);
  const gapTotal = 0;
  const style = `--compare-visible-pages: ${visiblePages}; --compare-gap-total: ${gapTotal}px;`;
  const classes = ["compare-strip", className].filter(Boolean).join(" ");
  return `<div class="${classes}" style="${style}">${pages.join("")}</div>`;
}

function renderComparisonStrip(indexes) {
  const pages = [];

  pages.push(baseComparePageHtml(state.drafts[indexes[0]], "BASELINE"));

  indexes.slice(1).forEach((draftIndex, offset) => {
    const beforeIndex = beforeIndexForSelectedDraft(indexes, offset + 1);
    const pair = pairForIndexes(beforeIndex, draftIndex);
    pages.push(markedComparePageHtml(pair));
  });

  return compareStripHtml(pages);
}

function changesPanelIsOpen() {
  return showChanges || Boolean(versionHistoryDraftId);
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

function revealComparePage(pageId, behavior = "smooth") {
  window.requestAnimationFrame(() => {
    const page = els.diffOutput.querySelector(`[data-compare-page-id="${cssEscape(pageId)}"]`);
    page?.scrollIntoView({ block: "nearest", inline: "start", behavior });
  });
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
  diffRenderToken += 1;
  const compareKicker = els.changesPanel?.querySelector(".compare-kicker");
  if (versionHistoryDraftId) {
    if (compareKicker) compareKicker.textContent = "VERSION HISTORY";
    if (versionHistoryDraftId === STORY_KEY) {
      els.compareSubtitle.textContent = "Version history for Project notes";
      els.diffOutput.innerHTML = renderProjectNotesVersionHistoryStrip();
      return;
    }

    const draft = draftById(versionHistoryDraftId);
    els.compareSubtitle.textContent = draft ? `Version history for ${draft.title}` : "Version history";
    els.diffOutput.innerHTML = draft
      ? renderDraftVersionHistoryStrip(draft)
      : `<p class="empty-state">Draft not found.</p>`;
    return;
  }

  if (!showChanges) {
    if (compareKicker) compareKicker.textContent = "DRAFT COMPARISON";
    els.diffOutput.innerHTML = "";
    els.compareSubtitle.textContent = "";
    return;
  }

  if (compareKicker) compareKicker.textContent = "DRAFT COMPARISON";
  const indexes = selectedCompareIndexes();

  const baseline = state.drafts[indexes[0]];
  els.compareSubtitle.textContent = els.compareMode.value === "first"
    ? (baseline ? `Against ${baseline.title}` : "No baseline")
    : "Consecutive";

  els.diffOutput.innerHTML = indexes.length
    ? renderComparisonStrip(indexes)
    : `<p class="empty-state">No draft pages selected.</p>`;
}

function nextDiffProgressFrame() {
  return new Promise(resolve => {
    window.requestAnimationFrame(() => {
      window.setTimeout(resolve, DIFF_PROGRESS_FRAME_DELAY_MS);
    });
  });
}

function diffRenderIsCurrent(token) {
  return token === diffRenderToken && changesPanelIsOpen();
}

function progressUnitText(unit, count) {
  const text = String(unit || "item");
  if (Number(count) === 1 || text.endsWith("s")) return text;
  return `${text}s`;
}

function renderDiffLoading(progress = "Loading changes") {
  const options = typeof progress === "string" ? { label: progress } : (progress || {});
  const label = options.label || "Loading changes";
  const total = Math.max(0, Number(options.total) || 0);
  const completed = total ? Math.max(0, Math.min(total, Number(options.completed) || 0)) : 0;
  const percent = total ? Math.round((completed / total) * 100) : 0;
  const unit = progressUnitText(options.unit || "item", total);
  const verb = options.verb || "loaded";
  const meta = options.meta || (total
    ? `${completed.toLocaleString("en-GB")} of ${total.toLocaleString("en-GB")} ${unit} ${verb}`
    : "Preparing...");
  const detail = options.detail
    ? `<span class="diff-loading-detail">${escapeHtml(options.detail)}</span>`
    : "";
  const trackClass = total ? "diff-loading-track" : "diff-loading-track is-indeterminate";
  const barStyle = total ? ` style="width: ${percent}%"` : "";

  els.diffOutput.innerHTML = `
    <div class="diff-loading" role="status" aria-live="polite">
      <span class="diff-loading-title">${escapeHtml(label)}</span>
      <div class="${trackClass}" aria-hidden="true"><span${barStyle}></span></div>
      <span class="diff-loading-meta">${escapeHtml(meta)}</span>
      ${detail}
    </div>
  `;
}

async function renderComparisonStripProgressively(indexes, token, label = "Loading changes") {
  const total = indexes.length;
  if (!total) {
    if (diffRenderIsCurrent(token)) els.diffOutput.innerHTML = `<p class="empty-state">No draft pages selected.</p>`;
    return;
  }

  const pages = [];
  const renderProgress = (completed, detail) => {
    if (!diffRenderIsCurrent(token)) return;
    renderDiffLoading({
      label,
      completed,
      total,
      unit: "draft page",
      verb: "loaded",
      detail
    });
  };

  renderProgress(0, "Preparing comparison");
  await nextDiffProgressFrame();
  if (!diffRenderIsCurrent(token)) return;

  pages.push(baseComparePageHtml(state.drafts[indexes[0]], "BASELINE"));
  renderProgress(1, indexes.length > 1
    ? `Comparing ${state.drafts[indexes[1]]?.title || "next draft"}`
    : "Loaded baseline");
  await nextDiffProgressFrame();

  for (let position = 1; position < indexes.length; position += 1) {
    if (!diffRenderIsCurrent(token)) return;

    const draftIndex = indexes[position];
    const beforeIndex = beforeIndexForSelectedDraft(indexes, position);
    const pair = pairForIndexes(beforeIndex, draftIndex);
    pages.push(markedComparePageHtml(pair));

    const nextDraft = state.drafts[indexes[position + 1]];
    renderProgress(position + 1, nextDraft
      ? `Comparing ${nextDraft.title || "next draft"}`
      : "Building comparison view");
    await nextDiffProgressFrame();
  }

  if (!diffRenderIsCurrent(token)) return;
  els.diffOutput.innerHTML = compareStripHtml(pages);
}

async function renderVersionHistoryStripProgressively(options) {
  const {
    token,
    label,
    versions,
    pageForVersion,
    basePageHtml,
    comparePageHtml,
    versionLabel,
    emptyHtml = `<p class="empty-state">No version history to show.</p>`
  } = options;
  const total = versions.length;

  if (!total) {
    if (diffRenderIsCurrent(token)) els.diffOutput.innerHTML = emptyHtml;
    return;
  }

  const pages = [];
  const renderScanProgress = (completed, detail) => {
    if (!diffRenderIsCurrent(token)) return;
    renderDiffLoading({
      label,
      completed,
      total,
      unit: "version",
      verb: "checked",
      detail
    });
  };

  renderScanProgress(0, "Preparing version history");
  await nextDiffProgressFrame();
  if (!diffRenderIsCurrent(token)) return;

  pages.push(basePageHtml(versions[0], 0));
  renderScanProgress(1, total > 1 ? `Checking ${versionLabel(1)}` : "Loaded first version");
  await nextDiffProgressFrame();

  const runs = [];
  let run = null;
  const flushRun = () => {
    if (!run) return;
    runs.push({
      beforeIndex: run.beforeIndex,
      afterIndex: run.afterIndex,
      beforeVersion: versions[run.beforeIndex],
      afterVersion: versions[run.afterIndex],
      coalescedVersionCount: run.afterIndex - run.beforeIndex
    });
    run = null;
  };

  for (let index = 0; index < versions.length - 1; index += 1) {
    if (!diffRenderIsCurrent(token)) return;

    const info = versionTransitionInfo(versions, pageForVersion, index);
    if (info) {
      if (
        run &&
        run.afterIndex === info.beforeIndex &&
        shouldMergeVersionTransitions(run.lastInfo, info, pageForVersion(versions[info.beforeIndex], info.beforeIndex))
      ) {
        run.afterIndex = info.afterIndex;
        run.lastInfo = info;
      } else {
        flushRun();
        run = {
          beforeIndex: info.beforeIndex,
          afterIndex: info.afterIndex,
          lastInfo: info
        };
      }
    }

    const completed = index + 2;
    renderScanProgress(completed, completed < total
      ? `Checking ${versionLabel(completed)}`
      : "Preparing changed version groups");
    await nextDiffProgressFrame();
  }

  flushRun();
  if (!diffRenderIsCurrent(token)) return;

  if (runs.length) {
    const pageTotal = 1 + runs.length;
    const renderPageProgress = (completed, detail) => {
      if (!diffRenderIsCurrent(token)) return;
      renderDiffLoading({
        label,
        completed,
        total: pageTotal,
        unit: "history page",
        verb: "rendered",
        detail
      });
    };

    renderPageProgress(1, `Rendering ${versionLabel(runs[0].afterIndex)}`);
    await nextDiffProgressFrame();

    for (let index = 0; index < runs.length; index += 1) {
      if (!diffRenderIsCurrent(token)) return;
      const currentRun = runs[index];
      pages.push(comparePageHtml(currentRun));
      const nextRun = runs[index + 1];
      renderPageProgress(index + 2, nextRun
        ? `Rendering ${versionLabel(nextRun.afterIndex)}`
        : "Building history view");
      await nextDiffProgressFrame();
    }
  }

  if (!diffRenderIsCurrent(token)) return;
  els.diffOutput.innerHTML = compareStripHtml(pages, "version-history-strip");
}

function renderDraftVersionHistoryProgressively(draft, token, label) {
  const versions = ensureDraftVersionHistory(draft);
  return renderVersionHistoryStripProgressively({
    token,
    label,
    versions,
    pageForVersion: (version, index) => draftVersionPage(draft, version, index),
    basePageHtml: (version, index) => baseVersionPageHtml(draft, version, index),
    comparePageHtml: run => versionComparePageHtml(
      draft,
      run.afterVersion,
      run.afterIndex,
      run.beforeVersion,
      run.beforeIndex,
      { coalescedVersionCount: run.coalescedVersionCount }
    ),
    versionLabel: index => `Draft ${draftVersionNumber(draft, index)}`
  });
}

function renderProjectNotesVersionHistoryProgressively(token, label) {
  const versions = ensureProjectNotesVersionHistory();
  return renderVersionHistoryStripProgressively({
    token,
    label,
    versions,
    pageForVersion: projectNotesVersionPage,
    basePageHtml: baseProjectNotesVersionPageHtml,
    comparePageHtml: run => projectNotesVersionComparePageHtml(
      run.afterVersion,
      run.afterIndex,
      run.beforeVersion,
      run.beforeIndex,
      { coalescedVersionCount: run.coalescedVersionCount }
    ),
    versionLabel: index => `Project notes ${projectNotesVersionNumber(index)}`
  });
}

async function renderDiffProgressively(token, label = "Loading changes") {
  const compareKicker = els.changesPanel?.querySelector(".compare-kicker");
  if (versionHistoryDraftId) {
    if (compareKicker) compareKicker.textContent = "VERSION HISTORY";
    const historyLabel = label || "Loading version history";

    if (versionHistoryDraftId === STORY_KEY) {
      els.compareSubtitle.textContent = "Version history for Project notes";
      await renderProjectNotesVersionHistoryProgressively(token, historyLabel);
      return;
    }

    const draft = draftById(versionHistoryDraftId);
    els.compareSubtitle.textContent = draft ? `Version history for ${draft.title}` : "Version history";
    if (!draft) {
      if (diffRenderIsCurrent(token)) els.diffOutput.innerHTML = `<p class="empty-state">Draft not found.</p>`;
      return;
    }

    await renderDraftVersionHistoryProgressively(draft, token, historyLabel);
    return;
  }

  if (!showChanges) {
    if (compareKicker) compareKicker.textContent = "DRAFT COMPARISON";
    if (diffRenderIsCurrent(token)) {
      els.diffOutput.innerHTML = "";
      els.compareSubtitle.textContent = "";
    }
    return;
  }

  if (compareKicker) compareKicker.textContent = "DRAFT COMPARISON";
  const indexes = selectedCompareIndexes();
  const baseline = state.drafts[indexes[0]];
  els.compareSubtitle.textContent = els.compareMode.value === "first"
    ? (baseline ? `Against ${baseline.title}` : "No baseline")
    : "Consecutive";
  await renderComparisonStripProgressively(indexes, token, label || "Loading changes");
}

function renderDiffSoon(label = "Loading changes") {
  if (!changesPanelIsOpen()) {
    renderDiff();
    return;
  }

  const token = diffRenderToken + 1;
  diffRenderToken = token;
  const progressLabel = versionHistoryDraftId && label === "Loading changes"
    ? "Loading version history"
    : label;
  renderDiffLoading({ label: progressLabel, detail: "Preparing..." });

  void (async () => {
    await nextDiffProgressFrame();
    if (!diffRenderIsCurrent(token)) return;
    await renderDiffProgressively(token, progressLabel);
    if (diffRenderIsCurrent(token)) {
      window.requestAnimationFrame(() => updateCompactTitleLabels(els.diffOutput));
    }
  })();
}

function renderChangesVisibility() {
  const panelOpen = changesPanelIsOpen();
  els.editorSurface.classList.toggle("compare-open", panelOpen);
  els.changesPanel.hidden = !panelOpen;
  els.changesPanel.classList.toggle("version-history-open", Boolean(versionHistoryDraftId));
  els.toggleChanges.setAttribute("aria-pressed", String(panelOpen));
  const label = els.toggleChanges.querySelector(".toggle-changes-label");
  const buttonLabel = versionHistoryDraftId
    ? "Hide history"
    : (showChanges ? "Hide changes" : "Show changes");
  els.toggleChanges.setAttribute("aria-label", buttonLabel);
  if (label) {
    label.textContent = buttonLabel;
  } else {
    els.toggleChanges.textContent = buttonLabel;
  }
  syncPagesOnScreenToDisplaySelection();
}

function render() {
  saveCurrentEditorViewState();
  saveVisibleEditorScrollPositions();
  ensureDisplaySelection();
  renderDraftTabs();
  renderEditor();
  renderChangesVisibility();
  renderDiffSoon();
  syncGlobalFormatControls();
  window.requestAnimationFrame(() => updateCompactTitleLabels());
}

function syncFromInputs() {
  if (!state) return;
  saveCurrentEditorViewState();
  saveVisibleEditorScrollPositions();

  els.pageCanvas.querySelectorAll("[data-title-draft-id]").forEach(input => {
    syncDraftTitleInput(input);
  });

  els.pageCanvas.querySelectorAll("[data-editor-key]").forEach(editorEl => {
    const page = pageForEditorKey(editorEl.dataset.editorKey);
    if (page) syncRichPage(page, editorEl);
  });
}

function syncPageFromDom(pageKey) {
  if (!state || !pageKey) return;
  syncViewStateFromDom();

  const parsed = parseDraftPageKey(pageKey);
  if (parsed?.type === "content") {
    const titleInput = els.pageCanvas.querySelector(`[data-title-draft-id="${cssEscape(parsed.draftId)}"]`);
    if (titleInput) syncDraftTitleInput(titleInput);
  }

  const editorEl = editorElementForKey(pageKey);
  const page = editorEl ? pageForEditorKey(pageKey) : null;
  if (page && editorEl) syncRichPage(page, editorEl);
}

function syncViewStateFromDom() {
  if (!state) return;
  saveCurrentEditorViewState();
  saveVisibleEditorScrollPositions();
}

function syncDetachedUnitFromDom(unitKey) {
  const parsed = parseDetachedUnitKey(unitKey);
  if (!parsed) return;

  if (parsed.type === "story") {
    syncPageFromDom(STORY_KEY);
    return;
  }

  syncPageFromDom(draftContentKey(parsed.draftId));
  syncPageFromDom(draftNotesKey(parsed.draftId));
}

function scheduleSearchRefresh(delay = 250) {
  if (!searchState.open) return;
  window.clearTimeout(searchRefreshTimer);
  searchRefreshTimer = window.setTimeout(() => {
    refreshSearchResults({ allowRender: false });
  }, delay);
}

function scheduleSave(options = {}) {
  markStateChanged();
  saveRetryCount = 0;
  if (options.syncInputs === false) {
    if (options.updateViewState !== false) saveCurrentEditorViewState();
  } else {
    syncFromInputs();
  }
  if (options.updateViewState !== false) saveCurrentViewState();
  if (options.cacheLinkedState !== false) rememberLinkedProjectState();
  if (options.refreshUi !== false) {
    renderDraftTabs();
    refreshRenderedPageLabels();
  }
  if (showChanges && options.refreshDiff !== false) renderDiffSoon();
  scheduleSearchRefresh();
  setStatus(isSaving ? "Saving..." : "Unsaved changes");
  queueSave(options.saveDelay);
}

function schedulePageSave(pageKey, options = {}) {
  if (!state || !pageKey) {
    scheduleSave(options);
    return;
  }

  markStateChanged();
  saveRetryCount = 0;
  if (options.updateViewState !== false) {
    saveCurrentEditorViewState();
    saveCurrentViewState();
  }
  if (options.cacheLinkedState !== false) rememberLinkedProjectState();
  if (options.refreshUi !== false) {
    renderDraftTabs();
    refreshRenderedPageLabels();
  }
  if (showChanges && options.refreshDiff !== false) renderDiffSoon();
  scheduleSearchRefresh();
  setStatus(isSaving ? "Saving..." : "Unsaved changes");
  queuePageSave(pageKey, options.saveDelay, {
    includeVersionHistory: Boolean(options.includeVersionHistory)
  });
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
  pagePanePercents = {};
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
  if (/backup folder missing/i.test(text)) {
    return "Save paused: backup folder missing";
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
    if (payload?.code === "BACKUP_FOLDER_MISSING") {
      backupFolderMissing = true;
      backupFolderPath = payload.folderPath || backupFolderPath;
      versionHistoryFolderPath = payload.folderPath || versionHistoryFolderPath;
      syncBackupMenu();
      window.setTimeout(promptForMissingBackupFolder, 0);
      return {
        message: "Save paused: backup folder missing",
        retry: false
      };
    }
    return readableSaveFailure(payload?.error);
  } catch {
    return readableSaveFailure(response.statusText || `HTTP ${response.status}`);
  }
}

function handleSaveFailure(failure) {
  const message = typeof failure === "object" && failure
    ? failure.message
    : failure;
  const retry = !(typeof failure === "object" && failure && failure.retry === false);
  isSaving = false;
  if (retry && saveRetryCount < MAX_SAVE_RETRIES) {
    saveRetryCount += 1;
    setStatus(`${message}; retrying`);
    queueSave(Math.min(1500 * saveRetryCount, 6000));
    return;
  }

  setStatus(message);
}

function projectRecoveryStatusText(recovery) {
  const backupPath = String(recovery?.backupPath || "");
  const backupName = fileNameFromPath(backupPath) || "a .broken backup";
  return `Recovered corrupt project.json; broken file backed up as ${backupName}`;
}

function acknowledgeProjectRecoveryNotice() {
  fetch("/api/project-recovery/ack", { method: "POST" }).catch(error => {
    console.warn(error);
  });
}

function showProjectRecoveryNotice(recovery) {
  if (!recovery) return;
  setStatus(projectRecoveryStatusText(recovery));
  if (els.saveStatus && recovery.backupPath) {
    els.saveStatus.title = `Recovered corrupt project.json. Broken file backup: ${recovery.backupPath}`;
  }
  acknowledgeProjectRecoveryNotice();
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

function updateStoragePathsFromPayload(payload = {}) {
  exportPath = payload.exportPath || exportPath;
  linkedTextPath = payload.linkedTextPath || linkedTextPath || "";
  if (Object.prototype.hasOwnProperty.call(payload, "versionHistoryFolderPath")) {
    versionHistoryFolderPath = payload.versionHistoryFolderPath || "";
  }
  if (Object.prototype.hasOwnProperty.call(payload, "versionHistoryPath")) {
    versionHistoryPath = payload.versionHistoryPath || "";
  }
  if (
    Object.prototype.hasOwnProperty.call(payload, "backupFolderMissing")
    || Object.prototype.hasOwnProperty.call(payload, "versionHistoryFolderMissing")
  ) {
    backupFolderMissing = Boolean(payload.backupFolderMissing || payload.versionHistoryFolderMissing);
  }
  if (Object.prototype.hasOwnProperty.call(payload, "backupFolderPath")) {
    backupFolderPath = payload.backupFolderPath || payload.versionHistoryFolderPath || "";
  }
  if (payload.linkedTextFileName) projectFileName = payload.linkedTextFileName;
  syncBackupMenu();
}

async function applyExternalVersionHistory(projectState, options = {}) {
  try {
    const response = await fetch("/api/version-history/apply", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        state: projectState,
        filePath: options.filePath || linkedTextPath || "",
        fileName: options.fileName || projectFileName || "draft-history.txt"
      })
    });
    if (!response.ok) throw new Error(await response.text());

    const payload = await response.json();
    updateStoragePathsFromPayload(payload);
    return {
      state: migrateLegacyDefaultFonts(payload.state),
      loaded: Boolean(payload.loaded)
    };
  } catch (error) {
    console.error(error);
    return { state: projectState, loaded: false };
  }
}

async function promptForMissingBackupFolder() {
  if (!backupFolderMissing || isPromptingForBackupFolder) return;
  isPromptingForBackupFolder = true;

  try {
    const missingPath = backupFolderPath || versionHistoryFolderPath || "the selected backup folder";
    const chooseNow = window.confirm(
      `Backup folder not found:\n\n${missingPath}\n\nChoose the moved folder now?`
    );
    if (!chooseNow) {
      setStatus("Backup folder missing; saves paused until you choose the moved folder");
      return;
    }

    await selectVersionHistoryFolder();
  } finally {
    isPromptingForBackupFolder = false;
  }
}

async function applyTextProject(text, fileName, options = {}) {
  state = stateFromExportText(text, options.preserveFormatsFrom || null);
  const historyResult = await applyExternalVersionHistory(state, {
    filePath: options.filePath || "",
    fileName
  });
  state = historyResult.state;
  markStateChanged();
  saveQueued = false;
  editorSelections = {};
  projectFileName = fileName || "draft-history.txt";
  updateProjectTitle();
  restoreViewStateForProject();
  render();
  const savedToLinkedFile = await saveNow();
  resetHistory();
  const historyText = historyResult.loaded ? "; version history loaded" : "";
  setStatus(savedToLinkedFile ? `Opened ${projectFileName}${historyText}; autosave linked` : `Opened${historyText}; saved companion`);
  focusPageEditor(activeEditorKey);
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
  if (!stateOverride) {
    syncFromInputs();
    saveCurrentViewState();
  }

  const stateToSave = stateOverride || state;
  const fileNameToSuggest = ensureTxtExtension(
    suggestedFileName || projectFileName || fileNameFromPath(exportPath)
  );

  try {
    if (!stateOverride && state) {
      setStatus("Saving backup...");
      await writeProjectBackupNow();
    }
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
    updateStoragePathsFromPayload(payload);
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
    if (state) await prepareCurrentProjectForOpen();
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

function recentFileLabel(filePath) {
  return fileNameFromPath(filePath) || "Untitled";
}

function recentFileDirectory(filePath) {
  const parts = String(filePath || "").split(/[\\/]/);
  parts.pop();
  return parts.join("\\");
}

function renderRecentFilesMenu(files = []) {
  if (!els.fileOpenRecentMenu) return;

  if (!files.length) {
    els.fileOpenRecentMenu.innerHTML = '<button type="button" disabled><span class="menu-check" aria-hidden="true"></span><span>No recent files</span><span class="menu-shortcut" aria-hidden="true"></span></button>';
    return;
  }

  els.fileOpenRecentMenu.innerHTML = files.map(file => `
    <button class="recent-file-button" type="button" data-recent-file-path="${escapeHtml(file.filePath || "")}" title="${escapeHtml(file.filePath || "")}">
      <span class="menu-check" aria-hidden="true"></span>
      <span class="recent-file-text">
        <span class="recent-file-name">${escapeHtml(file.fileName || recentFileLabel(file.filePath))}</span>
        <span class="recent-file-path">${escapeHtml(recentFileDirectory(file.filePath))}</span>
      </span>
      <span class="menu-shortcut" aria-hidden="true"></span>
    </button>
  `).join("");
}

async function refreshRecentFilesMenu() {
  if (!els.fileOpenRecentMenu) return;

  try {
    let payload;
    try {
      const response = await fetch("/api/recent-text-files", { cache: "no-store" });
      if (!response.ok) throw new Error("Recent files unavailable");
      payload = await response.json();
    } catch (error) {
      if (!window.draftDiffDesktop?.recentTextFiles) throw error;
      payload = await window.draftDiffDesktop.recentTextFiles();
    }
    renderRecentFilesMenu(Array.isArray(payload.files) ? payload.files : []);
  } catch {
    els.fileOpenRecentMenu.innerHTML = '<button type="button" disabled><span class="menu-check" aria-hidden="true"></span><span>Recent files unavailable</span><span class="menu-shortcut" aria-hidden="true"></span></button>';
  }
}

async function openRecentFilesSubmenu() {
  if (!els.fileMenu || !els.fileOpenRecentMenu) return;

  closeTopMenus(els.fileMenu);
  els.fileMenu.open = true;
  setRecentSubmenuOpen(true);
  await refreshRecentFilesMenu();
  const firstRecent = els.fileOpenRecentMenu.querySelector("[data-recent-file-path]");
  if (firstRecent) firstRecent.focus();
  else els.fileOpenRecentButton?.focus();
}

async function prepareCurrentProjectForOpen() {
  if (!state) return null;

  syncFromInputs();
  saveCurrentViewState();
  rememberLinkedProjectState();
  await cacheLinkedProjectStateOnServer();
  window.clearTimeout(saveTimer);
  await saveNow();
  setStatus("Saving backup...");
  await writeProjectBackupNow();
  return projectStateFromSnapshot(serializeProjectState());
}

async function applyOpenedTextFilePayload(payload, previousLinkedTextPath = "", previousState = null) {
  linkedTextPath = payload.filePath || "";
  const storedState = cachedProjectStateForPath(linkedTextPath) || payload.storedState;
  updateStoragePathsFromPayload(payload);
  await applyTextProject(payload.text || "", payload.fileName || "draft-history.txt", {
    preserveFormatsFrom: storedState || (filePathsMatch(previousLinkedTextPath, linkedTextPath) ? previousState : null),
    filePath: linkedTextPath
  });
}

async function openTextProject() {
  closeFileMenu();

  try {
    const previousLinkedTextPath = linkedTextPath;
    const previousState = await prepareCurrentProjectForOpen();
    let payload = null;
    try {
      const response = await fetch("/api/open-text-file", { method: "POST" });
      if (response.ok) {
        payload = await response.json();
      } else {
        els.fileOpenInput.click();
        return;
      }
    } catch (error) {
      if (!window.draftDiffDesktop?.openTextFile) throw error;
      payload = await window.draftDiffDesktop.openTextFile();
    }

    if (payload) {
      if (payload.cancelled) return;

      await applyOpenedTextFilePayload(payload, previousLinkedTextPath, previousState);
      return;
    }
  } catch (error) {
    if (isAbortError(error)) return;
    console.error(error);
    setStatus("Open failed");
  }
}

async function openRecentTextProject(filePath) {
  closeFileMenu();

  try {
    const previousLinkedTextPath = linkedTextPath;
    const previousState = await prepareCurrentProjectForOpen();
    const body = JSON.stringify({ filePath });
    let payload;
    try {
      const response = await fetch("/api/open-recent-text-file", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body
      });
      if (!response.ok) throw new Error(await response.text());
      payload = await response.json();
    } catch (error) {
      if (!window.draftDiffDesktop?.openRecentTextFile) throw error;
      payload = await window.draftDiffDesktop.openRecentTextFile(body);
      if (payload?.ok === false) throw new Error(payload.error || "Recent file not found");
    }

    await applyOpenedTextFilePayload(payload, previousLinkedTextPath, previousState);
  } catch (error) {
    if (isAbortError(error)) return;
    console.error(error);
    setStatus("Open recent failed");
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

async function selectVersionHistoryFolder() {
  closeFileMenu();

  try {
    if (!state) return;
    syncFromInputs();
    saveCurrentViewState();
    flushDraftVersionCaptures();
    rememberLinkedProjectState();
    window.clearTimeout(saveTimer);
    setStatus("Choose a backup and version history folder...");

    const response = await fetch("/api/version-history-folder/select", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        state,
        filePath: linkedTextPath,
        fileName: projectFileName
      })
    });
    if (!response.ok) throw new Error(await response.text());

    const payload = await response.json();
    if (payload.cancelled) {
      setStatus("Backup and version history folder unchanged");
      return;
    }

    state = migrateLegacyDefaultFonts(payload.state);
    updateStoragePathsFromPayload(payload);
    rememberLinkedProjectState();
    saveQueued = false;
    isSaving = false;
    saveRetryCount = 0;
    render();
    if (versionHistoryDraftId) renderDiffSoon("Loading version history");
    const loadedText = payload.loaded ? "; loaded matching histories" : "";
    const migratedText = Number(payload.migratedCount) > 0
      ? `; migrated ${payload.migratedCount} history file${Number(payload.migratedCount) === 1 ? "" : "s"}`
      : "";
    setStatus(`Backup and version history folder set${migratedText}${loadedText}`);
  } catch (error) {
    if (isAbortError(error)) return;
    console.error(error);
    setStatus("Backup and version history folder failed");
  }
}

async function toggleBackup() {
  closeFileMenu();

  try {
    if (backupFolderMissing) {
      await selectVersionHistoryFolder();
      return;
    }

    if (backupFolderPath) {
      const response = await fetch("/api/backup/deactivate", { method: "POST" });
      if (!response.ok) throw new Error(await response.text());

      const payload = await response.json();
      updateStoragePathsFromPayload(payload);
      setStatus("Backup deactivated");
      return;
    }

    setStatus("Choose a backup and version history folder...");
    const response = await fetch("/api/backup/activate", { method: "POST" });
    if (!response.ok) throw new Error(await response.text());

    const payload = await response.json();
    if (payload.cancelled) {
      setStatus("Backup and version history folder unchanged");
      return;
    }

    updateStoragePathsFromPayload(payload);
    setStatus("Backup activated");
  } catch (error) {
    if (isAbortError(error)) return;
    console.error(error);
    setStatus("Backup setup failed");
  }
}

function prepareClosePayload(options = {}) {
  if (!state) return "";

  syncFromInputs();
  saveCurrentViewState();
  flushDraftVersionCaptures();
  rememberLinkedProjectState();
  return JSON.stringify({
    state,
    filePath: linkedTextPath,
    fileName: projectFileName,
    waitForSummary: Boolean(options.waitForSummary),
    skipSummary: Boolean(options.skipSummary)
  });
}

async function writeProjectBackupNow(options = {}) {
  if (!state) return null;

  const body = prepareClosePayload({
    skipSummary: options.skipSummary !== false
  });
  try {
    const response = await fetch("/api/backup/project", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body
    });
    if (!response.ok) {
      const failure = await responseSaveFailure(response);
      throw new Error(typeof failure === "object" && failure ? failure.message : failure);
    }
    return response.json();
  } catch (error) {
    if (!window.draftDiffDesktop?.backupProject) throw error;
    return window.draftDiffDesktop.backupProject(body);
  }
}

function formatElapsedMs(ms = 0) {
  const totalSeconds = Math.max(0, Math.floor(Number(ms) / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return minutes ? `${minutes}m ${seconds}s` : `${seconds}s`;
}

function showSummaryProgressOverlay() {
  window.clearInterval(summaryProgressTimer);
  latestSummaryReportPath = "";
  if (els.summaryProgressOverlay) els.summaryProgressOverlay.hidden = false;
  if (els.summaryProgressActions) els.summaryProgressActions.hidden = true;
  if (els.summaryProgressOpen) els.summaryProgressOpen.disabled = true;
  if (els.summaryProgressReveal) els.summaryProgressReveal.disabled = true;
  if (els.summaryProgressPath) els.summaryProgressPath.textContent = "";
  updateSummaryProgressOverlay({
    status: "running",
    step: "Preparing...",
    completed: 0,
    total: 1,
    elapsedMs: 0
  });
}

function hideSummaryProgressOverlay() {
  window.clearInterval(summaryProgressTimer);
  summaryProgressTimer = null;
  if (els.summaryProgressOverlay) els.summaryProgressOverlay.hidden = true;
}

function updateSummaryProgressOverlay(progress = {}) {
  const completed = Number(progress.completed) || 0;
  const total = Math.max(Number(progress.total) || 1, 1);
  const percent = progress.status === "complete"
    ? 100
    : Math.max(0, Math.min(99, Math.round((completed / total) * 100)));
  if (els.summaryProgressStep) {
    els.summaryProgressStep.textContent = progress.status === "failed"
      ? `Failed: ${progress.error || "Summary generation failed"}`
      : progress.step || "Working...";
  }
  if (els.summaryProgressBar) els.summaryProgressBar.style.width = `${percent}%`;
  if (els.summaryProgressMeta) {
    els.summaryProgressMeta.textContent = `${Math.min(completed, total).toLocaleString("en-GB")} of ${total.toLocaleString("en-GB")} · ${formatElapsedMs(progress.elapsedMs)}`;
  }
  if (els.summaryProgressPath && progress.result?.reportPath) {
    latestSummaryReportPath = String(progress.result.reportPath || "");
    els.summaryProgressPath.textContent = latestSummaryReportPath;
  }
  const canShowActions = progress.status === "complete" || progress.status === "failed";
  const canOpenReport = Boolean(latestSummaryReportPath && progress.status === "complete");
  if (els.summaryProgressActions) els.summaryProgressActions.hidden = !canShowActions;
  if (els.summaryProgressOpen) {
    els.summaryProgressOpen.hidden = !canOpenReport;
    els.summaryProgressOpen.disabled = !canOpenReport || !window.draftDiffDesktop?.openGeneratedReport;
  }
  if (els.summaryProgressReveal) {
    els.summaryProgressReveal.hidden = !canOpenReport;
    els.summaryProgressReveal.disabled = !canOpenReport || !window.draftDiffDesktop?.showGeneratedReportInFolder;
  }
}

async function openGeneratedSummaryReport() {
  if (!latestSummaryReportPath) return;
  try {
    if (!window.draftDiffDesktop?.openGeneratedReport) throw new Error("Desktop file opener unavailable");
    await window.draftDiffDesktop.openGeneratedReport(latestSummaryReportPath);
    setStatus("Opened version history summary");
  } catch (error) {
    console.error(error);
    setStatus(`Open failed: ${error?.message || "could not open summary"}`);
  }
}

async function revealGeneratedSummaryReport() {
  if (!latestSummaryReportPath) return;
  try {
    if (!window.draftDiffDesktop?.showGeneratedReportInFolder) throw new Error("Desktop folder opener unavailable");
    await window.draftDiffDesktop.showGeneratedReportInFolder(latestSummaryReportPath);
    setStatus("Opened summary folder");
  } catch (error) {
    console.error(error);
    setStatus(`Open folder failed: ${error?.message || "could not open folder"}`);
  }
}

async function startVersionHistorySummaryJob(body) {
  try {
    const response = await fetch("/api/version-history-summary/start", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body
    });
    if (!response.ok) throw new Error(await response.text());
    return response.json();
  } catch (error) {
    if (!window.draftDiffDesktop?.startVersionHistorySummary) throw error;
    return window.draftDiffDesktop.startVersionHistorySummary(body);
  }
}

async function fetchVersionHistorySummaryProgress(jobId) {
  try {
    const response = await fetch(`/api/version-history-summary/progress?id=${encodeURIComponent(jobId)}`, {
      cache: "no-store"
    });
    if (!response.ok) throw new Error(await response.text());
    return response.json();
  } catch (error) {
    if (!window.draftDiffDesktop?.versionHistorySummaryProgress) throw error;
    return window.draftDiffDesktop.versionHistorySummaryProgress(jobId);
  }
}

async function pollVersionHistorySummary(jobId) {
  const payload = await fetchVersionHistorySummaryProgress(jobId);
  if (!payload.ok) throw new Error(payload.error || "Summary progress unavailable");
  const progress = payload.progress || {};
  updateSummaryProgressOverlay(progress);

  if (progress.status === "complete") {
    window.clearInterval(summaryProgressTimer);
    summaryProgressTimer = null;
    setStatus("Version history summary generated");
    return "complete";
  }

  if (progress.status === "failed") {
    window.clearInterval(summaryProgressTimer);
    summaryProgressTimer = null;
    setStatus("Version history summary failed");
    return "failed";
  }

  return progress.status || "running";
}

async function generateVersionHistorySummary() {
  closeFileMenu();
  if (!state) return;

  try {
    showSummaryProgressOverlay();
    setStatus("Generating version history summary...");
    syncFromInputs();
    saveCurrentViewState();
    flushDraftVersionCaptures();
    rememberLinkedProjectState();
    window.clearTimeout(saveTimer);
    await saveNow();

    const body = prepareClosePayload({ skipSummary: true });
    const started = await startVersionHistorySummaryJob(body);
    const jobId = started.jobId || started.progress?.id;
    if (!jobId) throw new Error("Summary job did not start");
    updateSummaryProgressOverlay(started.progress || {});

    const initialStatus = await pollVersionHistorySummary(jobId);
    if (initialStatus === "complete" || initialStatus === "failed") return;
    summaryProgressTimer = window.setInterval(() => {
      pollVersionHistorySummary(jobId).catch(error => {
        console.error(error);
        window.clearInterval(summaryProgressTimer);
        summaryProgressTimer = null;
        updateSummaryProgressOverlay({
          status: "failed",
          step: "Failed",
          error: error?.message || "Summary progress unavailable",
          completed: 0,
          total: 1,
          elapsedMs: 0
        });
        setStatus("Version history summary failed");
      });
    }, 400);
  } catch (error) {
    console.error(error);
    updateSummaryProgressOverlay({
      status: "failed",
      step: "Failed",
      error: error?.message || "Summary generation failed",
      completed: 0,
      total: 1,
      elapsedMs: 0
    });
    setStatus("Version history summary failed");
  }
}

async function closeApp() {
  closeFileMenu();
  window.clearTimeout(saveTimer);
  window.clearTimeout(pageSaveTimer);

  try {
    const body = prepareClosePayload({ skipSummary: true });
    isClosingApp = true;
    setStatus("Closing...");
    if (window.draftDiffDesktop?.persistClose) {
      await window.draftDiffDesktop.hideForClose?.();
      await window.draftDiffDesktop.persistClose(body);
      window.close();
      document.body.innerHTML = '<main class="closed-screen"><h1>Draft Diff Editor closed</h1><p>You can close this tab.</p></main>';
      return;
    }

    const response = await fetch("/api/shutdown", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body
    });
    if (!response.ok) {
      const failure = await responseSaveFailure(response);
      throw new Error(typeof failure === "object" && failure ? failure.message : failure);
    }

    window.setTimeout(() => {
      window.close();
      document.body.innerHTML = '<main class="closed-screen"><h1>Draft Diff Editor closed</h1><p>You can close this tab.</p></main>';
    }, 120);
  } catch (error) {
    console.error(error);
    isClosingApp = false;
    await window.draftDiffDesktop?.showAfterCloseError?.();
    setStatus(readableSaveFailure(error?.message || "Close failed"));
  }
}

async function savePendingPagesNow() {
  if (!state || !pendingPageSaveKeys.size) return false;

  window.clearTimeout(pageSaveTimer);
  pageSaveTimer = null;

  if (isSaving) {
    setStatus("Saving...");
    queuePendingPageSaves(100);
    return false;
  }

  const keys = Array.from(pendingPageSaveKeys);
  const versionHistoryKeys = new Set(pendingPageVersionHistorySaveKeys);
  pendingPageSaveKeys.clear();
  pendingPageVersionHistorySaveKeys.clear();
  const payloads = keys
    .map(key => pageSavePayload(key, { includeVersionHistory: versionHistoryKeys.has(key) }))
    .filter(Boolean);
  if (!payloads.length) return false;

  const requestRevision = stateRevision;
  isSaving = true;
  setStatus("Saving...");

  try {
    let latestPayload = null;
    for (const requestBody of payloads) {
      const response = await fetch("/api/page", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(requestBody)
      });

      if (!response.ok) {
        isSaving = false;
        handleSaveFailure(await responseSaveFailure(response));
        return false;
      }

      latestPayload = await response.json();
    }

    const responseMatchesCurrentState = requestRevision === stateRevision;
    if (responseMatchesCurrentState && latestPayload?.state) {
      state = migrateLegacyDefaultFonts(latestPayload.state);
    }

    isSaving = false;
    saveRetryCount = 0;

    if (!responseMatchesCurrentState || saveQueued) {
      const hasFullSaveQueued = saveQueued || Boolean(saveTimer);
      saveQueued = false;
      setStatus("Unsaved changes");
      if (hasFullSaveQueued || !pendingPageSaveKeys.size) {
        queueSave(0);
      } else {
        queuePendingPageSaves(0);
      }
      return true;
    }

    if (pendingPageSaveKeys.size) {
      setStatus("Unsaved changes");
      queuePendingPageSaves(0);
      return true;
    }

    setStatus(linkedTextPath ? `Saved ${formatDate(state.updatedAt)}` : "Saved companion; no text file linked");
    return true;
  } catch (error) {
    console.error(error);
    isSaving = false;
    handleSaveFailure(readableSaveFailure(error?.message));
    return false;
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
  saveCurrentViewState();
  const capturedVersionDraftIds = flushDraftVersionCaptures();
  if (capturedVersionDraftIds.includes(versionHistoryDraftId)) renderDiffSoon("Loading version history");
  rememberLinkedProjectState();
  const requestRevision = stateRevision;
  isSaving = true;
  setStatus("Saving...");
  const requestBody = {
    state,
    filePath: linkedTextPath,
    fileName: projectFileName
  };

  try {
    let payload;
    try {
      const response = await fetch("/api/state", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(requestBody)
      });

      if (!response.ok) {
        handleSaveFailure(await responseSaveFailure(response));
        return false;
      }

      payload = await response.json();
    } catch (error) {
      console.error(error);
      if (!window.draftDiffDesktop?.saveState) throw error;
      payload = await window.draftDiffDesktop.saveState(JSON.stringify(requestBody));
    }

    const responseMatchesCurrentState = requestRevision === stateRevision;
    if (responseMatchesCurrentState) state = payload.state;

    updateStoragePathsFromPayload(payload);
    isSaving = false;
    saveRetryCount = 0;
    if (responseMatchesCurrentState) clearPendingPageSaves();

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
  versionHistoryFolderPath = payload.versionHistoryFolderPath || "";
  versionHistoryPath = payload.versionHistoryPath || "";
  backupFolderPath = payload.backupFolderPath || payload.versionHistoryFolderPath || "";
  backupFolderMissing = Boolean(payload.backupFolderMissing || payload.versionHistoryFolderMissing);
  projectFileName = payload.linkedTextFileName || fileNameFromPath(exportPath) || projectFileName;
  updateProjectTitle();
  syncBackupMenu();
  restoreViewStateForProject();
  setStatus(linkedTextPath ? `Saved ${formatDate(state.updatedAt)}` : "Saved companion; no text file linked");
  render();
  resetHistory();
  focusPageEditor(activeEditorKey);
  if (backupFolderMissing) {
    setStatus("Backup folder missing; choose the moved folder");
    window.setTimeout(promptForMissingBackupFolder, 0);
  }
  showProjectRecoveryNotice(payload.projectRecovery);
}

function setActiveFromPageKey(pageKey) {
  const parsed = parseDraftPageKey(pageKey);
  activeEditorKey = pageKey;

  if (pageKey === STORY_KEY) {
    activeArea = "story";
    renderDraftTabs();
    persistViewStateChange(0);
    return;
  }

  if (parsed?.draftId) {
    selectedDraftId = parsed.draftId;
    activeArea = "draft";
    renderDraftTabs();
    persistViewStateChange(0);
  }
}

function focusPageEditor(pageKey, options = {}) {
  window.requestAnimationFrame(() => {
    const editor = editorElementForKey(pageKey);
    if (editor) {
      editor.focus({ preventScroll: true });
      restoreEditorSelection(editor);
      restoreEditorScrollPosition(editor);
    }
    alignPageInCanvas(pageKey, options.canvasScrollBehavior || "auto");
  });
}

function scrollEditorOffsetIntoView(editor, offset) {
  if (!editor) return;
  const range = rangeFromTextOffsets(editor, offset, offset);
  const marker = document.createElement("span");
  marker.className = "history-reveal-marker";
  marker.textContent = "\u200b";

  range.insertNode(marker);
  marker.scrollIntoView({ block: "center", inline: "nearest", behavior: "smooth" });
  marker.remove();

  const selectionRange = rangeFromTextOffsets(editor, offset, offset);
  const selection = window.getSelection();
  selection.removeAllRanges();
  selection.addRange(selectionRange);
}

function revealHistoryChange(target) {
  if (!target?.key) {
    focusPageEditor(activeEditorKey);
    return;
  }

  window.requestAnimationFrame(() => {
    alignPageInCanvas(target.key);

    if (target.type === "title") {
      const parsed = parseDraftPageKey(target.key);
      const titleInput = parsed?.draftId
        ? els.pageCanvas.querySelector(`[data-title-draft-id="${cssEscape(parsed.draftId)}"]`)
        : null;
      if (titleInput) {
        titleInput.focus({ preventScroll: true });
        titleInput.select();
        titleInput.scrollIntoView({ block: "center", inline: "nearest", behavior: "smooth" });
        return;
      }
    }

    const editor = editorElementForKey(target.key);
    if (!editor) {
      focusPageEditor(activeEditorKey);
      return;
    }

    const offset = Math.max(0, Number(target.offset) || 0);
    editorSelections[target.key] = {
      ...editorSelections[target.key],
      startTextOffset: offset,
      endTextOffset: offset
    };
    editor.focus({ preventScroll: true });
    scrollEditorOffsetIntoView(editor, offset);
  });
}

function selectDraft(draftId) {
  syncViewStateFromDom();
  selectedDraftId = draftId;
  activeArea = "draft";
  activeEditorKey = draftContentKey(draftId);
  displayPage(activeEditorKey, true);
  render();
  persistViewStateChange(0);
  focusPageEditor(activeEditorKey, { canvasScrollBehavior: "smooth" });
}

function selectDraftInChanges(draftId) {
  if (!draftById(draftId)) return;

  syncViewStateFromDom();
  selectedDraftId = draftId;
  activeArea = "draft";
  activeEditorKey = draftContentKey(draftId);
  const wasDisplayed = displayedPageKeys.has(activeEditorKey);
  displayPage(activeEditorKey, true);
  render();
  persistViewStateChange(0);
  revealComparePage(draftId, wasDisplayed ? "smooth" : "auto");
}

function addDraft(copyFromSelected) {
  syncFromInputs();
  const draft = createDraft(copyFromSelected ? getSelectedDraft() : null);
  recordDraftStructureUndoSnapshot([draft.id]);
  state.drafts.push(draft);
  selectedDraftId = draft.id;
  activeArea = "draft";
  activeEditorKey = draftContentKey(draft.id);
  displayPage(activeEditorKey, true);
  render();
  scheduleSave();
  queueViewStateSave(0);
  scrollTabsToEnd();
  focusPageEditor(activeEditorKey);
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
  if (
    page.format.fontFamily === nextFormat.fontFamily &&
    page.format.fontSize === nextFormat.fontSize &&
    page.format.lineHeight === nextFormat.lineHeight
  ) return;

  recordPageUndoSnapshot(editorKey);
  page.format = nextFormat;
  applyEditorFormat(editorEl, page.format);
  syncToolbarValues(editorKey);
  syncGlobalFormatControls();
  queueDraftVersionCaptureForEditor(editorEl);
  schedulePageSave(editorKey);
}

function applyUniversalFormat(field, value) {
  const normalizedValue = String(value || "");
  const allowedValues = allowedFormatValuesForField(field);
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

  recordProjectFormatUndoSnapshot();
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
  recordPageUndoSnapshot(editorKey);
  execRichTextCommand(command, { document, editor: editorEl });
  queueDraftVersionCaptureForEditor(editorEl);
  const page = pageForEditorKey(editorKey);
  if (page) syncRichPage(page, editorEl);
  schedulePageSave(editorKey);
}

function openDraftVersionHistoryForDraft(draftId) {
  const draft = draftById(draftId);
  if (!draft) return;

  syncPageFromDom(draftContentKey(draft.id));
  if (flushDraftVersionCapture(draft.id, { markChanged: false })) {
    scheduleVersionHistoryPageSave(draftContentKey(draft.id), draft.id);
  }
  versionHistoryDraftId = draft.id;
  showChanges = false;
  activeArea = "draft";
  selectedDraftId = draft.id;
  activeEditorKey = draftContentKey(draft.id);
  displayPage(activeEditorKey, true);
  persistViewStateChange(0);
  renderDraftTabs();
  renderChangesVisibility();
  renderDiffSoon("Loading version history");
}

function openProjectNotesVersionHistory() {
  if (!state?.initialNotes) return;

  syncPageFromDom(STORY_KEY);
  if (flushProjectNotesVersionCapture({ markChanged: false })) {
    scheduleVersionHistoryPageSave(STORY_KEY);
  }
  versionHistoryDraftId = STORY_KEY;
  showChanges = false;
  activeArea = "story";
  activeEditorKey = STORY_KEY;
  displayPage(STORY_KEY, true);
  persistViewStateChange(0);
  renderDraftTabs();
  renderChangesVisibility();
  renderDiffSoon("Loading version history");
}

function openDraftVersionHistoryForPage(editorKey) {
  const parsed = parseDraftPageKey(editorKey);
  if (parsed?.type === "story") {
    openProjectNotesVersionHistory();
    return;
  }
  if (parsed?.type === "content") openDraftVersionHistoryForDraft(parsed.draftId);
}

function closeVersionHistory() {
  if (!versionHistoryDraftId) return;
  versionHistoryDraftId = null;
  renderDraftTabs();
  renderChangesVisibility();
  renderDiff();
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
  syncViewStateFromDom();
  if (collapsedNotesIds.has(draftId)) {
    collapsedNotesIds.delete(draftId);
  } else {
    collapsedNotesIds.add(draftId);
  }
  ensureDisplaySelection();
  render();
  persistViewStateChange(0);
}

function deleteDraft(draftId) {
  syncFromInputs();
  const draft = draftById(draftId);
  if (!draft || !canDeleteDraft(draft)) return;

  recordDraftStructureUndoSnapshot([draftId]);
  state.drafts = state.drafts.filter(item => item.id !== draftId);
  displayedPageKeys.delete(draftContentKey(draftId));
  collapsedNotesIds.delete(draftId);
  clearDraftVersionTimer(draftId);
  if (versionHistoryDraftId === draftId) versionHistoryDraftId = null;
  delete editorSelections[draftContentKey(draftId)];
  delete editorSelections[draftNotesKey(draftId)];

  if (!state.drafts.length) {
    state.drafts.push(createDraft(null));
  }

  selectedDraftId = state.drafts[0]?.id;
  activeArea = "draft";
  activeEditorKey = draftContentKey(selectedDraftId);
  displayPage(activeEditorKey, true);
  ensureDisplaySelection();
  render();
  scheduleSave();
  queueViewStateSave(0);
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
els.fileMenu?.addEventListener("toggle", () => {
  if (els.fileMenu.open) refreshRecentFilesMenu();
  else setRecentSubmenuOpen(false);
});
els.fileOpenRecent?.addEventListener("pointerenter", () => {
  setRecentSubmenuOpen(true);
  refreshRecentFilesMenu();
});
els.fileOpenRecentButton?.addEventListener("click", event => {
  event.preventDefault();
  event.stopPropagation();
  const nextOpen = !els.fileOpenRecent?.classList.contains("is-open");
  setRecentSubmenuOpen(nextOpen);
  if (nextOpen) refreshRecentFilesMenu();
});
els.fileOpenRecentMenu?.addEventListener("click", event => {
  const button = event.target.closest("[data-recent-file-path]");
  if (!button) return;
  openRecentTextProject(button.dataset.recentFilePath);
});
els.fileOpenLocation.addEventListener("click", openFileLocation);
els.fileSaveAs.addEventListener("click", () => saveAsTextProject());
els.fileVersionHistoryFolder?.addEventListener("click", selectVersionHistoryFolder);
els.fileActivateBackup?.addEventListener("click", toggleBackup);
els.fileGenerateHistorySummary?.addEventListener("click", generateVersionHistorySummary);
els.fileClose.addEventListener("click", closeApp);
els.summaryProgressOpen?.addEventListener("click", openGeneratedSummaryReport);
els.summaryProgressReveal?.addEventListener("click", revealGeneratedSummaryReport);
els.summaryProgressClose?.addEventListener("click", hideSummaryProgressOverlay);
els.editUndo.addEventListener("click", () => {
  undoProjectChange();
  closeTopMenus();
});
els.editRedo.addEventListener("click", () => {
  redoProjectChange();
  closeTopMenus();
});
els.editSearch?.addEventListener("click", () => {
  openSearch({ scope: "all" });
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
  if (versionHistoryDraftId) {
    openProjectNotesVersionHistory();
    return;
  }
  if (showChanges) return;
  syncViewStateFromDom();
  activeArea = "story";
  activeEditorKey = STORY_KEY;
  renderDraftTabs();
  persistViewStateChange(0);
  focusPageEditor(STORY_KEY, { canvasScrollBehavior: "smooth" });
});

els.storyDisplayToggle.addEventListener("change", event => {
  if (showChanges || versionHistoryDraftId) {
    event.target.checked = false;
    return;
  }

  syncViewStateFromDom();
  displayPage(STORY_KEY, event.target.checked);
  render();
  persistViewStateChange(0);
});

els.allDraftsTab.addEventListener("click", event => {
  if (event.target === els.allDraftsToggle) return;
  if (!event.target.closest("[data-all-drafts-toggle]")) return;
  if (versionHistoryDraftId) return;
  syncViewStateFromDom();
  displayAllDrafts(!allDraftsSelected());
  render();
  persistViewStateChange(0);
});

els.allDraftsToggle.addEventListener("change", event => {
  if (versionHistoryDraftId) {
    renderDraftTabs();
    return;
  }

  syncViewStateFromDom();
  displayAllDrafts(event.target.checked);
  render();
  persistViewStateChange(0);
});

els.draftTabs.addEventListener("click", event => {
  const deleteButton = event.target.closest("[data-delete-draft-id]");
  if (deleteButton) {
    deleteDraft(deleteButton.dataset.deleteDraftId);
    return;
  }

  const button = event.target.closest("[data-draft-id]");
  if (!button) return;
  if (versionHistoryDraftId) {
    openDraftVersionHistoryForDraft(button.dataset.draftId);
    return;
  }

  if (showChanges) {
    selectDraftInChanges(button.dataset.draftId);
    return;
  }

  selectDraft(button.dataset.draftId);
});

els.draftTabs.addEventListener("change", event => {
  const checkbox = event.target.closest("[data-display-draft-id]");
  if (!checkbox) return;
  if (versionHistoryDraftId) {
    checkbox.checked = displayedPageKeys.has(draftContentKey(checkbox.dataset.displayDraftId));
    return;
  }

  syncViewStateFromDom();
  displayPage(draftContentKey(checkbox.dataset.displayDraftId), checkbox.checked);
  render();
  persistViewStateChange(0);
});

els.tabStrip?.addEventListener("scroll", updateTabScrollbar, { passive: true });
els.tabScrollbar?.addEventListener("pointerdown", beginTabScrollbarDrag);
els.newDraftBlank.addEventListener("click", () => addDraft(false));
els.newDraftCopy.addEventListener("click", () => addDraft(true));

els.pagesOnScreen.addEventListener("click", event => {
  const button = event.target.closest("[data-pages-on-screen]");
  if (!button) return;
  setPagesOnScreen(button.dataset.pagesOnScreen);
  if (els.viewMenu) els.viewMenu.open = false;
});

els.viewEnablePanelDrag?.addEventListener("click", () => {
  setPanelDragEnabled(!panelDragEnabled);
});
els.viewZoomIn?.addEventListener("click", event => {
  event.preventDefault();
  event.stopPropagation();
  zoomView("in");
});
els.viewZoomOut?.addEventListener("click", event => {
  event.preventDefault();
  event.stopPropagation();
  zoomView("out");
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
    persistViewStateChange(0);
  }
});

els.pageCanvas.addEventListener("focusout", event => {
  const editorEl = event.target.closest("[data-editor-key]");
  if (editorEl) {
    saveEditorViewState(editorEl);
    queueViewStateSave(250);
  }
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

  recordUndoSnapshotForInput(event);
});

els.pageCanvas.addEventListener("input", event => {
  const editorEl = closestElement(event.target, "[data-editor-key]");
  const titleInput = closestElement(event.target, "[data-title-draft-id]");
  if (editorEl) {
    const page = pageForEditorKey(editorEl.dataset.editorKey);
    if (page) syncRichPage(page, editorEl);
    queueDraftVersionCaptureForEditor(editorEl);
    queueDraftNoteStatsRefresh(editorEl);
    window.requestAnimationFrame(() => saveEditorViewState(editorEl));
  }

  const titlePageKey = titleInput ? syncDraftTitleInput(titleInput) : "";
  if (titleInput) window.requestAnimationFrame(() => updateCompactTitleLabels(titleInput.closest(".panel-title-row") || document));

  if (editorEl) {
    schedulePageSave(editorEl.dataset.editorKey, {
      updateViewState: false,
      cacheLinkedState: false,
      refreshUi: false,
      refreshDiff: false
    });
  } else if (titleInput) {
    if (titlePageKey) {
      schedulePageSave(titlePageKey);
    } else {
      scheduleSave();
    }
  }
});

els.pageCanvas.addEventListener("keyup", event => {
  const editorEl = closestElement(event.target, "[data-editor-key]");
  if (editorEl) {
    saveEditorViewState(editorEl);
    queueViewStateSave(750);
  }
});

els.pageCanvas.addEventListener("pointerup", event => {
  const editorEl = closestElement(event.target, "[data-editor-key]");
  if (editorEl) {
    saveEditorViewState(editorEl);
    queueViewStateSave(750);
  }
});

els.pageCanvas.addEventListener("scroll", event => {
  const editorEl = event.target.closest?.("[data-editor-key]");
  if (editorEl) {
    saveEditorScrollPosition(editorEl);
    queueViewStateSave(1000);
  }
}, true);

els.pageCanvas.addEventListener("wheel", event => {
  const editorEl = event.target.closest?.("[data-editor-key]");
  if (editorEl) {
    window.requestAnimationFrame(() => {
      saveEditorScrollPosition(editorEl);
      queueViewStateSave(1000);
    });
  }
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
  recordPageUndoSnapshot(editorEl.dataset.editorKey);
  insertPlainText("\t", { document });
  const page = pageForEditorKey(editorEl.dataset.editorKey);
  if (page) syncRichPage(page, editorEl);
  queueDraftVersionCaptureForEditor(editorEl);
  queueDraftNoteStatsRefresh(editorEl, 0);
  schedulePageSave(editorEl.dataset.editorKey, {
    updateViewState: false,
    cacheLinkedState: false,
    refreshUi: false,
    refreshDiff: false
  });
});

els.pageCanvas.addEventListener("paste", event => {
  const editorEl = closestElement(event.target, "[data-editor-key]");
  if (!editorEl) return;

  event.preventDefault();
  activeEditorKey = editorEl.dataset.editorKey;
  recordPageUndoSnapshot(editorEl.dataset.editorKey);
  insertClipboardHtml(event.clipboardData, { document, textToHtml });
  const page = pageForEditorKey(editorEl.dataset.editorKey);
  if (page) syncRichPage(page, editorEl);
  queueDraftVersionCaptureForEditor(editorEl);
  queueDraftNoteStatsRefresh(editorEl, 0);
  schedulePageSave(editorEl.dataset.editorKey, {
    updateViewState: false,
    cacheLinkedState: false,
    refreshUi: false,
    refreshDiff: false
  });
});

els.pageCanvas.addEventListener("pointerdown", event => {
  const pageResizer = event.target.closest("[data-resize-page-before][data-resize-page-after]");
  if (pageResizer) {
    event.preventDefault();
    const beforeKey = pageResizer.dataset.resizePageBefore;
    const afterKey = pageResizer.dataset.resizePageAfter;
    const viewportWidth = document.documentElement.clientWidth || window.innerWidth || els.pageCanvas.getBoundingClientRect().width;
    if (!beforeKey || !afterKey || !viewportWidth) return;

    pageDividerDrag = {
      beforeKey,
      afterKey,
      startX: event.clientX,
      startBefore: pagePanePercent(beforeKey),
      startAfter: pagePanePercent(afterKey),
      viewportWidth
    };
    pageResizer.classList.add("is-active");
    els.pageCanvas.classList.add("is-page-resizing");

    const onMove = moveEvent => {
      if (!pageDividerDrag) return;
      const deltaPercent = ((moveEvent.clientX - pageDividerDrag.startX) / pageDividerDrag.viewportWidth) * 100;
      const pairTotal = pageDividerDrag.startBefore + pageDividerDrag.startAfter;
      const minimum = Math.min(MIN_PAGE_PANE_PERCENT, pairTotal / 2);
      const nextBeforeValue = Math.min(
        pairTotal - minimum,
        Math.max(minimum, pageDividerDrag.startBefore + deltaPercent)
      );
      setAdjacentPagePanePercents(
        pageDividerDrag.beforeKey,
        pageDividerDrag.afterKey,
        nextBeforeValue,
        pairTotal - nextBeforeValue
      );
    };
    const onUp = () => {
      pageResizer.classList.remove("is-active");
      els.pageCanvas.classList.remove("is-page-resizing");
      pageDividerDrag = null;
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
      savePagePanePercents();
      queueViewStateSave(250);
    };

    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
    return;
  }

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
    window.removeEventListener("pointercancel", onUp);
    queueViewStateSave(250);
  };

  window.addEventListener("pointermove", onMove);
  window.addEventListener("pointerup", onUp);
  window.addEventListener("pointercancel", onUp);
});

els.pageCanvas.addEventListener("mousedown", event => {
  if (event.target.closest(".editor-format-ribbon button")) event.preventDefault();
});

els.pageCanvas.addEventListener("contextmenu", event => {
  handleEditorContextMenu(event);
});

els.pageCanvas.addEventListener("dblclick", event => {
  const pageResizer = event.target.closest("[data-resize-page-before][data-resize-page-after]");
  if (pageResizer) {
    event.preventDefault();
    resetPagePanePercents();
    return;
  }

  const notesResizer = event.target.closest("[data-resize-notes]");
  if (notesResizer) {
    event.preventDefault();
    setNotesPanePercent(notesResizer.dataset.resizeNotes, 58);
    queueViewStateSave(250);
  }
});

els.pageCanvas.addEventListener("click", event => {
  const detachButton = event.target.closest("[data-detach-unit-key]");
  if (detachButton) {
    detachUnit(detachButton.dataset.detachUnitKey);
    return;
  }

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

  const searchPageButton = event.target.closest("[data-search-page]");
  if (searchPageButton) {
    openSearch({ pageKey: searchPageButton.dataset.searchPage });
    return;
  }

  const versionHistoryButton = event.target.closest("[data-version-history]");
  if (versionHistoryButton) {
    openDraftVersionHistoryForPage(versionHistoryButton.dataset.versionHistory);
    return;
  }

  const searchPrevButton = event.target.closest("[data-search-page-prev]");
  if (searchPrevButton) {
    cycleSearchPage(searchPrevButton.dataset.searchPagePrev, -1);
    return;
  }

  const searchNextButton = event.target.closest("[data-search-page-next]");
  if (searchNextButton) {
    cycleSearchPage(searchNextButton.dataset.searchPageNext, 1);
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
  const pageResizer = event.target.closest("[data-resize-page-before][data-resize-page-after]");
  if (pageResizer) {
    if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;

    event.preventDefault();
    const beforeKey = pageResizer.dataset.resizePageBefore;
    const afterKey = pageResizer.dataset.resizePageAfter;
    const step = event.shiftKey ? 8 : 3;
    applyAdjacentPagePaneResize(
      beforeKey,
      afterKey,
      pagePanePercent(beforeKey) + (event.key === "ArrowRight" ? step : -step)
    );
    savePagePanePercents();
    queueViewStateSave(250);
    return;
  }

  const resizer = event.target.closest("[data-resize-notes]");
  if (!resizer) return;

  if (event.key === "ArrowUp") {
    event.preventDefault();
    setNotesPanePercent(resizer.dataset.resizeNotes, getNotesPanePercent(resizer.dataset.resizeNotes) - 4);
    queueViewStateSave(250);
  }

  if (event.key === "ArrowDown") {
    event.preventDefault();
    setNotesPanePercent(resizer.dataset.resizeNotes, getNotesPanePercent(resizer.dataset.resizeNotes) + 4);
    queueViewStateSave(250);
  }
});

els.compareMode.addEventListener("change", () => {
  persistViewStateChange(0);
  renderDiffSoon("Loading changes");
});

els.diffOutput.addEventListener("dblclick", event => {
  if (!(event.target instanceof Element)) return;

  const sourceToken = event.target.closest("[data-scroll-target-page-id][data-scroll-target-token-index]");
  if (!sourceToken || !els.diffOutput.contains(sourceToken)) return;

  event.preventDefault();
  jumpToComparedToken(sourceToken);
});

els.diffOutput.addEventListener("click", event => {
  if (!(event.target instanceof Element)) return;

  const projectNotesRestoreButton = event.target.closest("[data-restore-project-notes-version-id]");
  if (projectNotesRestoreButton && els.diffOutput.contains(projectNotesRestoreButton)) {
    event.preventDefault();
    restoreProjectNotesVersion(projectNotesRestoreButton.dataset.restoreProjectNotesVersionId);
    return;
  }

  const restoreButton = event.target.closest("[data-restore-draft-id][data-restore-version-id]");
  if (!restoreButton || !els.diffOutput.contains(restoreButton)) return;

  event.preventDefault();
  restoreDraftVersion(restoreButton.dataset.restoreDraftId, restoreButton.dataset.restoreVersionId);
});

els.toggleChanges.addEventListener("click", () => {
  syncViewStateFromDom();
  if (versionHistoryDraftId) {
    closeVersionHistory();
    return;
  }

  versionHistoryDraftId = null;
  showChanges = !showChanges;
  persistViewStateChange(0);
  renderDraftTabs();
  renderChangesVisibility();
  renderDiffSoon();
});

els.searchInput?.addEventListener("input", event => {
  setSearchQuery(event.target.value);
});

els.searchScopeToggle?.addEventListener("click", event => {
  event.preventDefault();
  toggleSearchScopeMenu();
});

els.searchScopeMenu?.addEventListener("change", event => {
  setSearchScopeFromControl(event.target);
});

els.searchPrev?.addEventListener("click", () => {
  cycleSearch(-1);
});

els.searchNext?.addEventListener("click", () => {
  cycleSearch(1);
});

els.searchClose?.addEventListener("click", () => {
  closeSearch();
});

detachedPanelChannel?.addEventListener("message", event => {
  const message = event.data || {};
  if (message.source !== "panel") return;

  if (message.type === "unit:ready" && detachedUnitKeys.has(message.key)) {
    broadcastDetachedUnit(message.key);
    return;
  }

  if (message.type === "unit:update") {
    handleDetachedUnitUpdate(message.key, message.unit);
    return;
  }

  if (message.type === "version-history:open") {
    openDraftVersionHistoryForPage(message.pageKey);
    return;
  }

  if (message.type === "unit:closed") {
    reattachDetachedUnit(message.key);
  }
});

document.addEventListener("click", event => {
  if (spellcheckMenu && event.target instanceof Element && !event.target.closest(".spellcheck-menu")) {
    closeSpellcheckMenu();
  }

  const topMenu =
    event.target instanceof Element ? event.target.closest("#file-menu, #edit-menu, #view-menu") : null;
  if (topMenu) {
    closeTopMenus(topMenu);
  } else {
    closeTopMenus();
  }

  closeRibbonsOutsidePanel(event.target);

  if (
    els.searchScopeMenu &&
    event.target instanceof Element &&
    !event.target.closest(".search-scope-dropdown")
  ) {
    toggleSearchScopeMenu(false);
  }

  if (event.target instanceof Element && event.target.closest(".fr-picker")) return;
  closeFormatPickers();
});

document.addEventListener("selectionchange", saveCurrentEditorSelection);

document.addEventListener("keydown", event => {
  if (handleGlobalShortcut(event)) return;

  if (event.key === "Escape") {
    closeSpellcheckMenu();
    toggleSearchScopeMenu(false);
    if (searchState.open) closeSearch();
    if (versionHistoryDraftId) closeVersionHistory();
    closeTopMenus();
    closeFormatPickers();
  }
});

document.addEventListener("scroll", positionOpenFormatPickers, true);
window.addEventListener("resize", positionOpenFormatPickers);
window.addEventListener("resize", updateTabDensity);
window.addEventListener("resize", updateAllNotesHeadingDensity);
window.addEventListener("resize", () => window.requestAnimationFrame(() => updateCompactTitleLabels()));

window.addEventListener("beforeunload", () => {
  if (!state || isClosingApp) return;
  sendViewStateBeacon();
  const blob = new Blob([prepareClosePayload({ skipSummary: true })], { type: "application/json" });
  navigator.sendBeacon("/api/close", blob);
});

window.draftDiffPersistBeforeClose = async () => {
  if (!state) return true;
  if (isClosingApp) return true;
  window.clearTimeout(viewStateSaveTimer);
  const body = prepareClosePayload({ skipSummary: true });
  setStatus("Closing...");
  if (window.draftDiffDesktop?.persistClose) {
    await window.draftDiffDesktop.persistClose(body);
    isClosingApp = true;
    return true;
  }
  const response = await fetch("/api/close", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body
  });
  if (!response.ok) throw new Error(await response.text());
  isClosingApp = true;
  return true;
};

populateGlobalFormatControls();
updateMenuShortcutLabels();
syncPanelDragMenu();
syncBackupMenu();
pingServer();
window.setInterval(pingServer, 5_000);

loadState().catch(error => {
  console.error(error);
  setStatus("Could not load project");
});
