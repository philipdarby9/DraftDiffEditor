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
  searchSummary: document.querySelector("#search-summary")
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
const VIEW_STATE_VERSION = 2;
const HISTORY_LIMIT = 100;
const MAX_SAVE_RETRIES = 3;
const AUTOSAVE_DELAY_MS = 2000;
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
let isClosingApp = false;
let viewStateSaveTimer = null;
let isSavingViewState = false;
let viewStateSaveQueued = false;

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
let panelDragEnabled = false;
let detachedUnitKeys = new Set();
let detachedPanelWindows = new Map();
let tabScrollbarDrag = null;
let fallbackZoomFactor = 1;
let diffRenderToken = 0;
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

const DEFAULT_FORMAT = {
  fontFamily: "Consolas",
  fontSize: "16",
  lineHeight: "1.62"
};

const FONT_FAMILY_OPTIONS = [
  "Consolas",
  "Segoe UI",
  "Arial",
  "Calibri",
  "Cambria",
  "Candara",
  "Constantia",
  "Corbel",
  "Georgia",
  "Garamond",
  "Book Antiqua",
  "Palatino Linotype",
  "Times New Roman",
  "Courier New",
  "Lucida Console",
  "Verdana",
  "Tahoma",
  "Trebuchet MS"
];

const FONT_SIZE_OPTIONS = ["12", "14", "16", "18", "20", "24", "28", "32"];
const LINE_HEIGHT_OPTIONS = ["1.2", "1.4", "1.62", "1.8", "2"];

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
  panelDrag: { mac: "Cmd+Opt+P", default: "Ctrl+Alt+P" },
  zoomIn: { mac: "⌘+", default: "Ctrl++" },
  zoomOut: { mac: "⌘-", default: "Ctrl+-" },
  pages1: { mac: "⌘1", default: "Ctrl+1" },
  pages2: { mac: "⌘2", default: "Ctrl+2" },
  pages3: { mac: "⌘3", default: "Ctrl+3" },
  pages4: { mac: "⌘4", default: "Ctrl+4" }
};

const toolbarIcons = {
  undo: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 14 5 10l4-4"></path><path d="M5 10h11a4 4 0 1 1 0 8h-1"></path></svg>',
  redo: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m15 14 4-4-4-4"></path><path d="M19 10H8a4 4 0 1 0 0 8h1"></path></svg>',
  bold: '<span class="fr-letter-icon bold" aria-hidden="true">B</span>',
  italic: '<span class="fr-letter-icon italic" aria-hidden="true">I</span>',
  underline: '<span class="fr-letter-icon underline" aria-hidden="true">U</span>',
  strike: '<span class="fr-letter-icon strike" aria-hidden="true">S</span>',
  unorderedList: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 6h11"></path><path d="M9 12h11"></path><path d="M9 18h11"></path><path d="M5 6v.01"></path><path d="M5 12v.01"></path><path d="M5 18v.01"></path></svg>',
  orderedList: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M11 6h9"></path><path d="M11 12h9"></path><path d="M12 18h8"></path><path d="M4 6h1v4"></path><path d="M4 10h2"></path><path d="M6 18H4c0-1.2 2-2.1 2-3.2 0-.7-.5-1.2-1.2-1.2-.5 0-.9.2-1.2.6"></path></svg>',
  outdent: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 6H9"></path><path d="M20 12h-7"></path><path d="M20 18H9"></path><path d="m8 8-4 4 4 4"></path></svg>',
  indent: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 6H9"></path><path d="M20 12h-7"></path><path d="M20 18H9"></path><path d="m4 8 4 4-4 4"></path></svg>',
  alignLeft: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 6h16"></path><path d="M4 12h10"></path><path d="M4 18h14"></path></svg>',
  alignCenter: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 6h16"></path><path d="M8 12h8"></path><path d="M6 18h12"></path></svg>',
  alignRight: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 6h16"></path><path d="M10 12h10"></path><path d="M6 18h14"></path></svg>',
  clear: '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M4.2 12.3h7.4"></path><path d="m5.3 8.8 3.9-4.2 2.2 2.1-3.9 4.2H5.3z"></path><path d="M4 13.1 12.5 3"></path></svg>',
  format: '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M3 4.5h10M3 8h10M3 11.5h10"></path><path d="M5.5 3v3M10.5 6.5v3M7.5 10v3"></path></svg>',
  search: '<svg viewBox="0 0 16 16" aria-hidden="true"><circle cx="7" cy="7" r="4.2"></circle><path d="m10.2 10.2 3.1 3.1"></path></svg>',
  detach: '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M5.4 3.6H4.1c-.8 0-1.4.6-1.4 1.4v6.9c0 .8.6 1.4 1.4 1.4H11c.8 0 1.4-.6 1.4-1.4v-1.3"></path><path d="M8.2 3.4h4.4v4.4"></path><path d="M7.2 8.8 12.4 3.6"></path></svg>'
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

  const isPanelDragShortcut = isMacPlatform()
    ? event.metaKey && event.altKey && !event.ctrlKey && !event.shiftKey && key === "p"
    : event.ctrlKey && event.altKey && !event.metaKey && !event.shiftKey && key === "p";

  if (isPanelDragShortcut) {
    event.preventDefault();
    setPanelDragEnabled(!panelDragEnabled);
    closeTopMenus();
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

function mainDisplayPageCount() {
  if (!state) return 0;
  let count = displayedPageKeys.has(STORY_KEY) && !detachedUnitKeys.has(STORY_KEY) ? 1 : 0;
  state.drafts.forEach(draft => {
    if (draftHasVisibleMainPanel(draft)) count += 1;
  });
  return count;
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
  const lineHeight = allowedLineHeights.has(String(format.lineHeight))
    ? String(format.lineHeight)
    : DEFAULT_FORMAT.lineHeight;
  return { fontFamily, fontSize, lineHeight };
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

function queueSave(delay = AUTOSAVE_DELAY_MS) {
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
  state = projectStateFromSnapshot(snapshot);
  editorSelections = {};
  reconcileViewAfterHistoryRestore();
  makeHistoryTargetVisible(target);
  render();
  scheduleSave();
  updateUndoRedoControls();
  revealHistoryChange(target);
  isRestoringHistory = false;
}

function undoProjectChange() {
  if (!undoStack.length) {
    updateUndoRedoControls();
    return;
  }

  syncFromInputs();
  const fromState = projectStateFromSnapshot(serializeProjectState());
  const currentSnapshot = serializeProjectState();
  const previousSnapshot = undoStack.pop();
  const toState = projectStateFromSnapshot(previousSnapshot);
  if (currentSnapshot && currentSnapshot !== previousSnapshot) redoStack.push(currentSnapshot);
  restoreHistorySnapshotWithTarget(previousSnapshot, findHistoryChangeTarget(fromState, toState));
}

function redoProjectChange() {
  if (!redoStack.length) {
    updateUndoRedoControls();
    return;
  }

  syncFromInputs();
  const fromState = projectStateFromSnapshot(serializeProjectState());
  const currentSnapshot = serializeProjectState();
  const nextSnapshot = redoStack.pop();
  const toState = projectStateFromSnapshot(nextSnapshot);
  if (currentSnapshot && currentSnapshot !== nextSnapshot) {
    undoStack.push(currentSnapshot);
    if (undoStack.length > HISTORY_LIMIT) undoStack.shift();
  }
  restoreHistorySnapshotWithTarget(nextSnapshot, findHistoryChangeTarget(fromState, toState));
}

function editableHistoryTarget(target) {
  if (!(target instanceof Element)) return null;
  return target.closest("[data-editor-key], [data-title-draft-id]");
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

  return true;
}

function applyDetachedUnitSnapshot(unit) {
  if (!unit?.pages?.length) return false;
  let applied = false;
  unit.pages.forEach(page => {
    if (page?.key && applyPageSnapshot(page.key, page.page || page)) applied = true;
  });
  return applied;
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

function restoreEditorSelections(stored) {
  editorSelections = {};
  if (!stored || typeof stored !== "object" || Array.isArray(stored)) return;

  Object.entries(stored).forEach(([key, selection]) => {
    if (!pageKeyExists(key)) return;
    const normalized = normalizeStoredEditorSelection(selection);
    if (normalized) editorSelections[key] = normalized;
  });
}

function saveCurrentViewState() {
  if (!state) return;

  saveCurrentEditorViewState();
  saveVisibleEditorScrollPositions();

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
  const visiblePagesOnScreen = Math.max(1, Math.min(pagesOnScreen, mainDisplayPageCount() || pagesOnScreen));
  const outerPadding = 0;
  const pageGap = 0;
  const widthOffset = outerPadding + pageGap * (visiblePagesOnScreen - 1);
  document.documentElement.style.setProperty(
    "--page-width",
    `calc((100vw - ${widthOffset}px) / ${visiblePagesOnScreen})`
  );
  if (els.pagesOnScreen) {
    els.pagesOnScreen.querySelectorAll("[data-pages-on-screen]").forEach(button => {
      button.setAttribute("aria-pressed", String(Number(button.dataset.pagesOnScreen) === pagesOnScreen));
    });
  }
  saveCurrentViewState();
  queueViewStateSave(500);
  if (showChanges) renderDiff();
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
  syncFromInputs();

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
  if (!applyDetachedUnitSnapshot(unit)) return;

  markStateChanged();
  rememberLinkedProjectState();
  refreshRenderedPageLabels();
  renderDraftTabs();
  renderDiff();
  setStatus(isSaving ? "Saving..." : "Unsaved changes");
  queueSave();
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
  saveCurrentViewState();
  render();
  queueViewStateSave(0);
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
  syncFromInputs();
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
  recordUndoSnapshot();
  document.execCommand("insertText", false, value);
  if (editorEl) {
    const page = pageForEditorKey(editorEl.dataset.editorKey);
    if (page) syncRichPage(page, editorEl);
  }
  scheduleSave({ syncInputs: false, refreshUi: false, refreshDiff: false });
}

function menuButtonHtml(label, action, disabled = false) {
  return `<button type="button" data-spellcheck-action="${escapeHtml(action)}"${disabled ? " disabled" : ""}>${escapeHtml(label)}</button>`;
}

function showSpellcheckMenu({ word, suggestions = [], misspelled = false, clientX, clientY }) {
  closeSpellcheckMenu();
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
    document.execCommand(action, false, null);
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
  spellcheckRange = wordInfo?.range?.cloneRange() || null;

  let misspelled = false;
  let suggestions = [];
  if (wordInfo?.word && window.draftDiffDesktop?.isWordMisspelled) {
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

function wordCountForText(text) {
  const matches = String(text || "").match(/[\p{L}\p{N}]+(?:['’\-][\p{L}\p{N}]+)*/gu);
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
  const importedCreatedAt = block?.createdAt || nowIso();
  const createdAt = previousPage?.createdAt || importedCreatedAt;
  const previousContent = previousPage
    ? previousPage.content || plainTextFromHtml(previousPage.contentHtml || "")
    : null;
  const contentChanged = previousPage && previousContent !== content;
  return {
    id: previousPage?.id || makeId("page"),
    title,
    createdAt,
    updatedAt: contentChanged ? nowIso() : previousPage?.updatedAt || createdAt,
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
    viewState: previousState?.viewState || null,
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
  const storyDisabled = showChanges;
  els.storyTab.classList.toggle("active", !showChanges && activeArea === "story");
  els.storyTab.classList.toggle("is-disabled", storyDisabled);
  els.storyTab.setAttribute("aria-disabled", String(storyDisabled));
  els.storyDisplayToggle.checked = showChanges ? false : displayedPageKeys.has(STORY_KEY);
  els.storyDisplayToggle.disabled = storyDisabled;
  els.storyDisplayToggle.setAttribute("aria-label", showChanges ? "Project notes are not compared" : "Display Project notes");
  const storyFocusButton = els.storyTab.querySelector("[data-story-focus]");
  if (storyFocusButton) {
    storyFocusButton.disabled = storyDisabled;
    storyFocusButton.setAttribute("aria-disabled", String(storyDisabled));
  }
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

function updateNotesHeadingDensity(heading) {
  if (!heading) return;

  heading.classList.remove("notes-heading-hide-label", "notes-heading-is-tight");

  const main = heading.querySelector(".notes-heading-main");
  if (!main) return;

  const styles = window.getComputedStyle(heading);
  const gap = parseFloat(styles.columnGap || styles.gap) || 0;
  const horizontalPadding = (parseFloat(styles.paddingLeft) || 0) + (parseFloat(styles.paddingRight) || 0);
  const children = Array.from(heading.children);
  const requiredWidth = children.reduce((total, child) => total + child.scrollWidth, 0)
    + Math.max(0, children.length - 1) * gap;
  const availableWidth = heading.clientWidth - horizontalPadding;

  heading.classList.toggle("notes-heading-hide-label", requiredWidth > availableWidth);

  const mainIsClipped = main.scrollWidth > main.clientWidth + 1;
  heading.classList.toggle("notes-heading-is-tight", mainIsClipped);
}

function updateAllNotesHeadingDensity() {
  els.pageCanvas
    ?.querySelectorAll(".notes-toggle-heading")
    .forEach(updateNotesHeadingDensity);
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
        ${formatPickerHtml("lineHeight", "Line spacing", LINE_HEIGHT_OPTIONS, "line-height")}
      </div>
      <div class="fr-group">
        <button class="fr-btn" type="button" data-search-page="${escapeHtml(pageKey)}" title="Search this page" aria-label="Search this page">${toolbarIcons.search}</button>
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
      ${notesHint}
      ${formatButton}
      ${detachButton}
      ${notesHeaderStats}
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

function draftStackHtml(draft) {
  if (detachedUnitKeys.has(draftUnitKey(draft.id))) return "";

  const draftItem = pageItemForKey(draftContentKey(draft.id));
  const notesItem = pageItemForKey(draftNotesKey(draft.id));
  const collapsed = collapsedNotesIds.has(draft.id);

  return `
    <section class="draft-stack-page display-page${collapsed ? " notes-are-collapsed" : ""}" data-draft-stack-id="${escapeHtml(draft.id)}" style="--draft-pane-height: ${getNotesPanePercent(draft.id)}%;" aria-label="${escapeHtml(draft.title)}">
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
  state.drafts.forEach(draft => {
    ensurePageFields(draft);
    ensurePageFields(draft.notes);
  });

  const selectedDrafts = state.drafts.filter(draft => displayedPageKeys.has(draftContentKey(draft.id)));
  const hasStory = displayedPageKeys.has(STORY_KEY) && !detachedUnitKeys.has(STORY_KEY);
  const pageHtml = [
    hasStory ? editorPanelHtml(pageItemForKey(STORY_KEY), { detachUnitKey: STORY_KEY, detachTitle: PROJECT_NOTES_TITLE }) : "",
    ...selectedDrafts.map(draftStackHtml)
  ].filter(Boolean);

  els.pageCanvas.classList.toggle("empty-page-canvas", !pageHtml.length);
  els.pageCanvas.innerHTML = pageHtml.length
    ? pageHtml.join("")
    : `<p class="empty-state page-empty-state">No pages selected.</p>`;

  hydrateVisibleEditors(visibleEditorItems());
  window.requestAnimationFrame(updateAllNotesHeadingDensity);
  window.requestAnimationFrame(() => refreshSearchResults({ allowRender: false }));
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

    const draftWordCount = panel.querySelector("[data-draft-word-count]");
    if (draftWordCount && item.type === "notes" && item.draft) {
      draftWordCount.textContent = formatWordCount(pageWordCount(item.draft));
    }

    const draftLastEdited = panel.querySelector("[data-draft-last-edited]");
    if (draftLastEdited && item.type === "notes" && item.draft) {
      draftLastEdited.textContent = `Last edited: ${formatDate(item.draft.updatedAt || item.draft.createdAt)}`;
    }
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
        <div class="meta">Created: ${formatDate(draft.createdAt)}</div>
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
          <div>Created: ${formatDate(pair.after.createdAt)}</div>
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

function compareVisiblePageCount(pageCount) {
  return Math.min(clampPagesOnScreen(pagesOnScreen), Math.max(1, pageCount));
}

function renderComparisonStrip(indexes) {
  const pages = [];

  pages.push(baseComparePageHtml(state.drafts[indexes[0]], "BASELINE"));

  indexes.slice(1).forEach((draftIndex, offset) => {
    const beforeIndex = beforeIndexForSelectedDraft(indexes, offset + 1);
    const pair = pairForIndexes(beforeIndex, draftIndex);
    pages.push(markedComparePageHtml(pair));
  });

  const visiblePages = compareVisiblePageCount(pages.length);
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
  diffRenderToken += 1;
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

function renderDiffLoading() {
  els.diffOutput.innerHTML = `
    <div class="diff-loading" role="status" aria-live="polite">
      <span>Loading changes</span>
      <div class="diff-loading-track" aria-hidden="true"><span></span></div>
    </div>
  `;
}

function renderDiffSoon() {
  if (!showChanges) {
    renderDiff();
    return;
  }

  const token = diffRenderToken + 1;
  diffRenderToken = token;
  renderDiffLoading();
  window.requestAnimationFrame(() => {
    window.setTimeout(() => {
      if (token !== diffRenderToken || !showChanges) return;
      renderDiff();
    }, 0);
  });
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
    const nextTitle = input.value || "Untitled draft";
    if (draft.title !== nextTitle) {
      draft.title = nextTitle;
      draft.updatedAt = nowIso();
    }
    draft.notes.title = `${draft.title} Notes`;
  });

  els.pageCanvas.querySelectorAll("[data-editor-key]").forEach(editorEl => {
    const page = pageForEditorKey(editorEl.dataset.editorKey);
    if (page) syncRichPage(page, editorEl);
  });
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
  if (showChanges && options.refreshDiff !== false) renderDiff();
  scheduleSearchRefresh();
  setStatus(isSaving ? "Saving..." : "Unsaved changes");
  queueSave(options.saveDelay);
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
      saveCurrentViewState();
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

async function closeApp() {
  closeFileMenu();
  window.clearTimeout(saveTimer);

  try {
    if (state) {
      syncFromInputs();
      saveCurrentViewState();
      await saveViewStateNow();
    }
    isClosingApp = true;
    setStatus("Closing...");

    const response = await fetch("/api/shutdown", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: state ? JSON.stringify(state) : ""
    });
    if (!response.ok) throw new Error(await response.text());

    window.setTimeout(() => {
      window.close();
      document.body.innerHTML = '<main class="closed-screen"><h1>Draft Diff Editor closed</h1><p>You can close this tab.</p></main>';
    }, 120);
  } catch (error) {
    console.error(error);
    isClosingApp = false;
    setStatus(readableSaveFailure(error?.message || "Close failed"));
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
  focusPageEditor(activeEditorKey);
}

function setActiveFromPageKey(pageKey) {
  const parsed = parseDraftPageKey(pageKey);
  activeEditorKey = pageKey;

  if (pageKey === STORY_KEY) {
    activeArea = "story";
    renderDraftTabs();
    saveCurrentViewState();
    queueViewStateSave(0);
    return;
  }

  if (parsed?.draftId) {
    selectedDraftId = parsed.draftId;
    activeArea = "draft";
    renderDraftTabs();
    saveCurrentViewState();
    queueViewStateSave(0);
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
  syncFromInputs();
  selectedDraftId = draftId;
  activeArea = "draft";
  activeEditorKey = draftContentKey(draftId);
  displayPage(activeEditorKey, true);
  render();
  scheduleSave();
  queueViewStateSave(0);
  focusPageEditor(activeEditorKey);
}

function addDraft(copyFromSelected) {
  syncFromInputs();
  recordUndoSnapshot();
  const draft = createDraft(copyFromSelected ? getSelectedDraft() : null);
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

  recordUndoSnapshot();
  page.format = nextFormat;
  applyEditorFormat(editorEl, page.format);
  syncToolbarValues(editorKey);
  syncGlobalFormatControls();
  scheduleSave();
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
els.fileOpenLocation.addEventListener("click", openFileLocation);
els.fileSaveAs.addEventListener("click", () => saveAsTextProject());
els.fileClose.addEventListener("click", closeApp);
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
  if (showChanges) return;
  syncFromInputs();
  activeArea = "story";
  activeEditorKey = STORY_KEY;
  renderDraftTabs();
  saveCurrentViewState();
  queueViewStateSave(0);
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
    saveCurrentViewState();
    queueViewStateSave(0);
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

  recordUndoSnapshot();
});

els.pageCanvas.addEventListener("input", event => {
  const editorEl = event.target.closest("[data-editor-key]");
  const titleInput = event.target.closest("[data-title-draft-id]");
  if (editorEl) {
    const page = pageForEditorKey(editorEl.dataset.editorKey);
    if (page) syncRichPage(page, editorEl);
    window.requestAnimationFrame(() => saveEditorViewState(editorEl));
  }

  if (editorEl || titleInput) {
    scheduleSave(editorEl
      ? {
        syncInputs: false,
        updateViewState: false,
        cacheLinkedState: false,
        refreshUi: false,
        refreshDiff: false
      }
      : undefined
    );
  }
});

els.pageCanvas.addEventListener("keyup", event => {
  const editorEl = event.target.closest("[data-editor-key]");
  if (editorEl) {
    saveEditorViewState(editorEl);
    queueViewStateSave(750);
  }
});

els.pageCanvas.addEventListener("pointerup", event => {
  const editorEl = event.target.closest("[data-editor-key]");
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
    closeTopMenus();
    closeFormatPickers();
  }
});

document.addEventListener("scroll", positionOpenFormatPickers, true);
window.addEventListener("resize", positionOpenFormatPickers);
window.addEventListener("resize", updateTabDensity);
window.addEventListener("resize", updateAllNotesHeadingDensity);

window.addEventListener("beforeunload", () => {
  if (!state || isClosingApp) return;
  syncFromInputs();
  sendViewStateBeacon();
  const blob = new Blob([JSON.stringify(state)], { type: "application/json" });
  navigator.sendBeacon("/api/close", blob);
});

window.draftDiffPersistBeforeClose = async () => {
  if (!state) return true;
  window.clearTimeout(viewStateSaveTimer);
  syncFromInputs();
  await saveViewStateNow();
  return true;
};

populateGlobalFormatControls();
updateMenuShortcutLabels();
syncPanelDragMenu();
pingServer();
window.setInterval(pingServer, 5_000);

loadState().catch(error => {
  console.error(error);
  setStatus("Could not load project");
});
