const DiffCore = window.DraftDiffCore;
if (!DiffCore) throw new Error("DraftDiffCore failed to load.");
const StateCore = window.DraftDiffStateCore;
if (!StateCore) throw new Error("DraftDiffStateCore failed to load.");
const ToolbarCore = window.DraftDiffToolbarCore;
if (!ToolbarCore) throw new Error("DraftDiffToolbarCore failed to load.");
const RichTextCore = window.DraftDiffRichTextCore;
if (!RichTextCore) throw new Error("DraftDiffRichTextCore failed to load.");
const USB_REVIEW_BUILD = "0.1.1 baseline review";

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
  fileManageBackupStorage: document.querySelector("#file-manage-backup-storage"),
  fileGenerateHistorySummary: document.querySelector("#file-generate-history-summary"),
  fileUsbExport: document.querySelector("#file-usb-export"),
  fileUsbReview: document.querySelector("#file-usb-review"),
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
  historyVersionFilter: document.querySelector("#history-version-filter"),
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
  summaryProgressClose: document.querySelector("#summary-progress-close"),
  appProgressOverlay: document.querySelector("#app-progress-overlay"),
  appProgressTitle: document.querySelector("#app-progress-title"),
  appProgressStep: document.querySelector("#app-progress-step"),
  appProgressTrack: document.querySelector("#app-progress-track"),
  appProgressBar: document.querySelector("#app-progress-bar"),
  appProgressMeta: document.querySelector("#app-progress-meta"),
  appProgressDetail: document.querySelector("#app-progress-detail"),
  backupStorageOverlay: document.querySelector("#backup-storage-overlay"),
  backupStoragePanel: document.querySelector("#backup-storage-panel"),
  backupStorageClose: document.querySelector("#backup-storage-close"),
  backupStorageStatus: document.querySelector("#backup-storage-status"),
  backupStorageProgress: document.querySelector("#backup-storage-progress"),
  backupStorageProgressTrack: document.querySelector("#backup-storage-progress-track"),
  backupStorageProgressBar: document.querySelector("#backup-storage-progress-bar"),
  backupStorageProgressMeta: document.querySelector("#backup-storage-progress-meta"),
  backupStoragePreview: document.querySelector("#backup-storage-preview"),
  backupStorageActiveFiles: document.querySelector("#backup-storage-active-files"),
  backupStorageActiveBytes: document.querySelector("#backup-storage-active-bytes"),
  backupStorageArchiveFiles: document.querySelector("#backup-storage-archive-files"),
  backupStorageArchiveBytes: document.querySelector("#backup-storage-archive-bytes"),
  backupStorageRetainedFiles: document.querySelector("#backup-storage-retained-files"),
  backupStorageRetainedBytes: document.querySelector("#backup-storage-retained-bytes"),
  backupStorageCandidateFiles: document.querySelector("#backup-storage-candidate-files"),
  backupStorageExactFiles: document.querySelector("#backup-storage-exact-files"),
  backupStorageStableFiles: document.querySelector("#backup-storage-stable-files"),
  backupStorageStoriesSection: document.querySelector("#backup-storage-stories-section"),
  backupStorageStories: document.querySelector("#backup-storage-stories"),
  backupStorageWarningsSection: document.querySelector("#backup-storage-warnings-section"),
  backupStorageWarnings: document.querySelector("#backup-storage-warnings"),
  backupStoragePathSection: document.querySelector("#backup-storage-path-section"),
  backupStoragePath: document.querySelector("#backup-storage-path"),
  backupStorageRescan: document.querySelector("#backup-storage-rescan"),
  backupStorageArchive: document.querySelector("#backup-storage-archive"),
  backupStorageExpirySection: document.querySelector("#backup-storage-expiry-section"),
  backupStorageExpiryPolicy: document.querySelector("#backup-storage-expiry-policy"),
  backupStorageExpiryRefresh: document.querySelector("#backup-storage-expiry-refresh"),
  backupStorageExpiryStatus: document.querySelector("#backup-storage-expiry-status"),
  backupStorageExpiryPreview: document.querySelector("#backup-storage-expiry-preview"),
  backupStorageExpiryManaged: document.querySelector("#backup-storage-expiry-managed"),
  backupStorageExpiryExpired: document.querySelector("#backup-storage-expiry-expired"),
  backupStorageExpiryBytes: document.querySelector("#backup-storage-expiry-bytes"),
  backupStorageExpiryRetained: document.querySelector("#backup-storage-expiry-retained"),
  backupStorageExpiryPinned: document.querySelector("#backup-storage-expiry-pinned"),
  backupStorageExpiryProtected: document.querySelector("#backup-storage-expiry-protected"),
  backupStorageExpiryRuns: document.querySelector("#backup-storage-expiry-runs"),
  backupStorageExpiryWarningsSection: document.querySelector("#backup-storage-expiry-warnings-section"),
  backupStorageExpiryWarnings: document.querySelector("#backup-storage-expiry-warnings"),
  backupStorageExpiryPrepare: document.querySelector("#backup-storage-expiry-prepare"),
  backupStorageManualDeletion: document.querySelector("#backup-storage-manual-deletion"),
  backupStorageManualDeletionSummary: document.querySelector("#backup-storage-manual-deletion-summary"),
  backupStorageManualDeletionPath: document.querySelector("#backup-storage-manual-deletion-path"),
  backupStorageManualDeletionOpen: document.querySelector("#backup-storage-manual-deletion-open"),
  manualDeletionReminder: document.querySelector("#manual-deletion-reminder"),
  manualDeletionReminderPanel: document.querySelector("#manual-deletion-reminder-panel"),
  manualDeletionReminderSummary: document.querySelector("#manual-deletion-reminder-summary"),
  manualDeletionReminderPath: document.querySelector("#manual-deletion-reminder-path"),
  manualDeletionReminderOpen: document.querySelector("#manual-deletion-reminder-open"),
  manualDeletionReminderLater: document.querySelector("#manual-deletion-reminder-later"),
  transferReviewOverlay: document.querySelector("#transfer-review-overlay"),
  transferReviewTitle: document.querySelector("#transfer-review-title"),
  transferReviewContent: document.querySelector("#transfer-review-content"),
  transferReviewClose: document.querySelector("#transfer-review-close"),
  transferImportCancel: document.querySelector("#transfer-import-cancel"),
  transferImportProceed: document.querySelector("#transfer-import-proceed"),
  transferPageZoom: document.querySelector("#transfer-page-zoom"),
  transferPageZoomTitle: document.querySelector("#transfer-page-zoom-title"),
  transferPageZoomMeta: document.querySelector("#transfer-page-zoom-meta"),
  transferPageZoomPaper: document.querySelector("#transfer-page-zoom-paper"),
  transferPageZoomClose: document.querySelector("#transfer-page-zoom-close")
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
const HISTORY_VIRTUAL_MIN_PAGES = 12;
const HISTORY_VIRTUAL_MAX_PAGES = 20;
const HISTORY_VIRTUAL_CACHE_LIMIT = 32;
const LINKED_TEXT_BLOCKED_STATUS = "Project saved locally";

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
let linkedTextFileMissing = false;
let linkedTextMissingPath = "";
let isPromptingForLinkedTextFile = false;
let isOpeningTextProject = false;
let browserFileOpenSession = null;
let stateRevision = 0;
let saveQueued = false;
let pendingPageSaveKeys = new Set();
let pendingPageVersionHistorySaveKeys = new Set();
let saveRetryCount = 0;
let isClosingApp = false;
let summaryProgressTimer = null;
let latestSummaryReportPath = "";
let backupStorageJobToken = 0;
let backupStoragePlanId = "";
let backupStoragePreview = null;
let backupStorageBusy = false;
let backupStorageReturnFocus = null;
let backupStorageExpiryPlanId = "";
let backupStorageExpiryPreview = null;
let backupStorageExpiryNotice = "";
let backupStorageExpiryOperationWarnings = [];
let backupStorageManualDeletion = null;
let manualDeletionReminderDismissed = false;
let manualDeletionReminderReturnFocus = null;
let latestTransferReview = null;
let transferTimelineZoomPages = [];
let selectionMenuZoomPages = new Map();
let pagePreviewZoomReturnFocus = null;
let transferExpandedTimelines = new Set();
let suppressLinkedTextBlockedStatusUntil = 0;
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
let historyVersionFilterOpen = null;
let historyVersionExclusions = new Map();
let historyVersionExpandedGroups = new Set();
let draftTabFilterOpen = null;
let draftTabExpandedGroups = new Set();
let historyVirtualState = null;
let historyVirtualScrollFrame = null;
let historyVirtualScrollSuppressed = false;
let historyVirtualRevision = 0;
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
  const pageKey = activeVersionHistoryPageKey();
  if (!pageKey) return 0;
  if (pageKey === STORY_KEY) return ensureProjectNotesVersionHistory().length;

  const item = pageItemForKey(pageKey);
  return item?.page ? ensurePageVersionHistory(item.page, item.title).length : 0;
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

function syncPagesOnScreenToDisplaySelection(options = {}) {
  const normalizedPagesOnScreen = normalizePagesOnScreenForSelection(pagesOnScreen);
  if (normalizedPagesOnScreen !== pagesOnScreen) setPagesOnScreen(normalizedPagesOnScreen, options);
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
    storyId: makeId("story"),
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
  const active = Boolean(backupFolderPath);
  if (els.fileActivateBackup) {
    els.fileActivateBackup.setAttribute("aria-pressed", String(active));
    els.fileActivateBackup.title = backupFolderMissing && active
      ? `Backup folder missing: ${backupFolderPath}`
      : active
      ? `Backups active: ${backupFolderPath}\\original txt; summaries: ${backupFolderPath}\\version history summaries; JSON: ${backupFolderPath}\\json`
      : "Choose a backup and version history folder";
  }
  if (els.fileManageBackupStorage) {
    els.fileManageBackupStorage.disabled = !active || backupFolderMissing;
    els.fileManageBackupStorage.title = backupFolderMissing && active
      ? `Backup folder missing: ${backupFolderPath}`
      : active
      ? "Review and archive version history JSON backups"
      : "Choose a backup folder before managing storage";
  }
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

function isLinkedTextBlockedStatus(value) {
  const text = String(value || "").trim().toLowerCase();
  return text === LINKED_TEXT_BLOCKED_STATUS.toLowerCase()
    || text === "saved locally; linked text file blocked";
}

function suppressLinkedTextBlockedStatus(ms = 8000) {
  suppressLinkedTextBlockedStatusUntil = Math.max(
    suppressLinkedTextBlockedStatusUntil,
    Date.now() + ms
  );
}

function shouldSuppressLinkedTextBlockedStatus(value) {
  return isLinkedTextBlockedStatus(value) && Date.now() < suppressLinkedTextBlockedStatusUntil;
}

function setStatus(text) {
  if (shouldSuppressLinkedTextBlockedStatus(text)) return;
  const statusText = String(text || "").replace(/^Saved\s+/, "Saved · ");
  const statusTextEl = els.saveStatus.querySelector(".status-text");
  if (statusTextEl) {
    statusTextEl.textContent = statusText;
  } else {
    els.saveStatus.textContent = statusText;
  }
  els.saveStatus.title = statusText;
  els.saveStatus.classList.toggle("is-saving", /saving|unsaved/i.test(text));
  els.saveStatus.classList.toggle(
    "is-error",
    /\b(?:failed|error|denied|unavailable|missing|blocked|paused)\b/i.test(statusText)
  );
}

function nextUiFrame(delayMs = 0) {
  return new Promise(resolve => {
    window.requestAnimationFrame(() => {
      window.setTimeout(resolve, delayMs);
    });
  });
}

function appProgressIsVisible() {
  return Boolean(els.appProgressOverlay && !els.appProgressOverlay.hidden);
}

function updateAppProgress(progress = {}) {
  if (!els.appProgressOverlay) return;

  const title = progress.title || "Opening file";
  const step = progress.step || "Preparing...";
  const total = Number(progress.total || 0);
  const completed = Math.min(total, Math.max(0, Number(progress.completed || 0)));
  const hasKnownTotal = Number.isFinite(total) && total > 0 && !progress.indeterminate;
  const percent = hasKnownTotal ? Math.round((completed / total) * 100) : 0;
  const detail = String(progress.detail || "");

  els.appProgressOverlay.hidden = false;
  document.body.setAttribute("aria-busy", "true");
  if (els.appProgressTitle) els.appProgressTitle.textContent = title;
  if (els.appProgressStep) els.appProgressStep.textContent = step;
  if (els.appProgressTrack) els.appProgressTrack.classList.toggle("is-indeterminate", !hasKnownTotal);
  if (els.appProgressBar) els.appProgressBar.style.width = hasKnownTotal ? `${percent}%` : "";
  if (els.appProgressMeta) {
    els.appProgressMeta.textContent = progress.meta || (hasKnownTotal
      ? `${Math.round(completed).toLocaleString("en-GB")} of ${Math.round(total).toLocaleString("en-GB")} steps`
      : "Working...");
  }
  if (els.appProgressDetail) {
    els.appProgressDetail.textContent = detail;
    els.appProgressDetail.hidden = !detail;
  }
}

async function showAppProgress(progress = {}) {
  updateAppProgress(progress);
  await nextUiFrame();
}

async function updateAppProgressFrame(progress = {}) {
  if (!appProgressIsVisible()) return;
  updateAppProgress(progress);
  await nextUiFrame();
}

function hideAppProgress() {
  if (els.appProgressOverlay) els.appProgressOverlay.hidden = true;
  document.body.removeAttribute("aria-busy");
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
  if (isOpeningTextProject) {
    saveQueued = true;
    return;
  }
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
  if (isOpeningTextProject) return;
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
  const parsedHistory = parseDraftPageKey(activeVersionHistoryPageKey());
  if (parsedHistory?.draftId) ids.add(parsedHistory.draftId);
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

function normalizedVersionHistoryPageKey(value = versionHistoryDraftId) {
  if (value === STORY_KEY) return STORY_KEY;
  if (pageKeyExists(value)) return value;
  if (draftExists(value)) return draftContentKey(value);
  return "";
}

function activeVersionHistoryPageKey() {
  return normalizedVersionHistoryPageKey(versionHistoryDraftId);
}

function versionHistoryForPageKey(pageKey = activeVersionHistoryPageKey()) {
  if (!state || !pageKey) return [];
  if (pageKey === STORY_KEY) return ensureProjectNotesVersionHistory();

  const parsed = parseDraftPageKey(pageKey);
  const draft = draftById(parsed?.draftId);
  if (!draft) return [];
  if (parsed.type === "notes") {
    const notesTitle = draft.notes?.title || `${draft.title || "Untitled draft"} Notes`;
    return ensurePageVersionHistory(draft.notes, notesTitle);
  }
  return ensureDraftVersionHistory(draft);
}

function historyVersionId(version, index) {
  return String(version?.id || `version-${index + 1}`);
}

function normalizedHistoryVersionExclusions(pageKey, versions = versionHistoryForPageKey(pageKey)) {
  if (!pageKey) return new Set();
  const validIds = new Set(versions.map(historyVersionId));
  const current = historyVersionExclusions.get(pageKey) || new Set();
  const normalized = new Set([...current].filter(id => validIds.has(id)));
  historyVersionExclusions.set(pageKey, normalized);
  return normalized;
}

function includedHistoryVersionEntries(versions, pageKey = activeVersionHistoryPageKey()) {
  const exclusions = normalizedHistoryVersionExclusions(pageKey, versions);
  return versions
    .map((version, index) => ({ version, index, id: historyVersionId(version, index) }))
    .filter(entry => !exclusions.has(entry.id));
}

function historyVersionLabel(pageKey, version, index) {
  if (pageKey === STORY_KEY) return projectNotesVersionPage(version, index).title;
  const parsed = parseDraftPageKey(pageKey);
  const draft = draftById(parsed?.draftId);
  if (!draft) return `Version ${index + 1}`;
  return parsed.type === "notes"
    ? draftNotesVersionPage(draft, version, index).title
    : draftVersionPage(draft, version, index).title;
}

function selectionDateRange(firstIso, lastIso) {
  if (!firstIso && !lastIso) return null;
  const start = String(firstIso || lastIso || "");
  const end = String(lastIso || firstIso || "");
  return {
    start,
    end,
    text: start === end
      ? formatDate(start)
      : `${formatDate(start)} – ${formatDate(end)}`
  };
}

function selectionDateRangeHtml(range, className) {
  if (!range?.text) return "";
  return `
    <time
      class="${className}"
      data-selection-date-start="${escapeHtml(range.start)}"
      data-selection-date-end="${escapeHtml(range.end)}"
    >${escapeHtml(range.text)}</time>
  `;
}

function historyVersionPage(pageKey, version, index) {
  if (pageKey === STORY_KEY) return projectNotesVersionPage(version, index);
  const parsed = parseDraftPageKey(pageKey);
  const draft = draftById(parsed?.draftId);
  if (!draft) {
    return {
      id: historyVersionId(version, index),
      title: `Version ${index + 1}`,
      createdAt: version?.createdAt,
      content: version?.content || "",
      contentHtml: version?.contentHtml || textToHtml(version?.content || ""),
      format: normalizeFormat(version?.format)
    };
  }
  return parsed.type === "notes"
    ? draftNotesVersionPage(draft, version, index)
    : draftVersionPage(draft, version, index);
}

function selectionPageText(page) {
  return page?.content || plainTextFromHtml(page?.contentHtml || "");
}

function selectionComparisonTextHtml(beforeText, afterText) {
  const parts = transferTimelineDiffParts(beforeText, afterText);
  if (!parts.length) return '<div class="compare-text empty-line">No text yet.</div>';
  return `<div class="compare-text">${parts.map(part => {
    const className = part.type === "same" ? "compare-token" : `compare-token ${part.type}`;
    return `<span class="${className}">${escapeHtml(part.text || "")}</span>`;
  }).join("")}</div>`;
}

function selectionComparisonHtml(beforePage, afterPage, maxLength = 900) {
  if (!afterPage) return '<div class="compare-text empty-line">No text yet.</div>';
  const afterText = selectionPageText(afterPage);
  const beforeText = selectionPageText(beforePage);
  if (!Number.isFinite(maxLength)) {
    return selectionComparisonTextHtml(beforeText, afterText);
  }
  if (!beforePage) {
    return selectionComparisonTextHtml("", afterText.slice(0, maxLength));
  }

  let firstDifference = 0;
  const sharedLength = Math.min(beforeText.length, afterText.length);
  while (
    firstDifference < sharedLength &&
    beforeText[firstDifference] === afterText[firstDifference]
  ) {
    firstDifference += 1;
  }
  if (firstDifference === beforeText.length && firstDifference === afterText.length) {
    return selectionComparisonTextHtml(
      beforeText.slice(0, maxLength),
      afterText.slice(0, maxLength)
    );
  }
  const start = Math.max(0, firstDifference - Math.round(maxLength * 0.18));
  return selectionComparisonTextHtml(
    beforeText.slice(start, start + maxLength),
    afterText.slice(start, start + maxLength)
  );
}

function selectionMenuLeafHtml(options = {}) {
  const classes = [
    "selection-menu-leaf",
    options.checked ? "" : "is-excluded",
    options.className || ""
  ].filter(Boolean).join(" ");
  const checked = options.checked ? " checked" : "";
  const disabled = options.disabled ? " disabled" : "";
  const preview = options.preview || options.label || "";
  const previewHtml = options.previewHtml || escapeHtml(preview);
  const meta = options.meta || "";
  const zoomButton = options.zoomKey
    ? `
      <button
        class="selection-menu-zoom"
        type="button"
        data-selection-menu-zoom="${escapeHtml(options.zoomKey)}"
        aria-label="Enlarge ${escapeHtml(options.label || "page preview")}"
      >Zoom</button>
    `
    : "";
  return `
    <div class="${classes}" ${options.outerAttributes || ""}>
      ${zoomButton}
      <input
        class="selection-menu-checkbox"
        type="checkbox"
        aria-label="${escapeHtml(options.inputAriaLabel || options.label || "")}"
        ${options.inputAttributes || ""}
        ${checked}${disabled}
      >
      <button
        class="selection-menu-miniature"
        type="button"
        aria-label="${escapeHtml(options.buttonAriaLabel || options.label || "")}"
        ${options.buttonAttributes || ""}
      >
        <div class="selection-menu-preview-content">${previewHtml}</div>
        <i aria-hidden="true">×</i>
      </button>
      <span class="selection-menu-leaf-label">${escapeHtml(options.label || "")}</span>
      <time>${escapeHtml(meta)}</time>
      ${options.trailingHtml || ""}
    </div>
  `;
}

function selectionMenuRangeHtml(options = {}) {
  const classes = [
    "selection-menu-range",
    options.className || "",
    options.partial ? "is-partial" : ""
  ].filter(Boolean).join(" ");
  const checked = options.checked ? " checked" : "";
  const disabled = options.disabled ? " disabled" : "";
  const dateRange = selectionDateRangeHtml(options.dateRange, "selection-menu-range-dates");
  return `
    <details
      class="${classes}"
      ${options.keyAttribute || ""}="${escapeHtml(options.key || "")}"
      ${options.open ? "open" : ""}
    >
      <summary class="selection-menu-range-summary">
        <input
          class="selection-menu-checkbox"
          type="checkbox"
          aria-label="${escapeHtml(options.checkboxAriaLabel || options.label || "")}"
          ${options.checkboxAttributes || ""}
          ${checked}${disabled}
        >
        <span class="selection-menu-pile" aria-hidden="true"><i></i><i></i><i></i></span>
        <span class="selection-menu-range-title">
          <span class="selection-menu-range-label">${escapeHtml(options.label || "")}</span>
          ${dateRange}
        </span>
        <span class="selection-menu-range-count" ${options.countAttributes || ""}>${escapeHtml(options.count || "")}</span>
        <span class="selection-menu-range-chevron" aria-hidden="true"></span>
      </summary>
      <div class="selection-menu-range-contents">
        ${options.contents || ""}
      </div>
    </details>
  `;
}

function selectionMenuPopoverHtml(options = {}) {
  const dateRange = selectionDateRangeHtml(options.dateRange, "selection-menu-header-dates");
  return `
    <section
      class="selection-menu-popover ${options.className || ""}"
      aria-label="${escapeHtml(options.ariaLabel || "")}"
      data-selection-menu-key="${escapeHtml(options.menuKey || "")}"
    >
      <header class="selection-menu-header">
        <div>
          <strong>${escapeHtml(options.title || "")}</strong>
          <span>${escapeHtml(options.description || "")}</span>
          ${dateRange}
        </div>
        <span>${escapeHtml(options.count || "")}</span>
      </header>
      <div class="selection-menu-choices ${options.choicesClass || ""}" tabindex="0" aria-label="${escapeHtml(options.choicesAriaLabel || "")}">
        ${options.choices || '<p class="selection-menu-empty">No items.</p>'}
      </div>
      <footer class="selection-menu-footer">${escapeHtml(options.footer || "")}</footer>
    </section>
  `;
}

function selectionMenuScrollSnapshot(container, menuKey) {
  if (!container || !menuKey) return null;
  const menu = container.querySelector(":scope > .selection-menu-popover");
  const choices = menu?.querySelector(":scope > .selection-menu-choices");
  if (!choices || menu.dataset.selectionMenuKey !== menuKey) return null;
  return {
    menuKey,
    scrollTop: choices.scrollTop,
    scrollLeft: choices.scrollLeft
  };
}

function restoreSelectionMenuScroll(container, snapshot) {
  if (!container || !snapshot) return;
  const menu = container.querySelector(":scope > .selection-menu-popover");
  const choices = menu?.querySelector(":scope > .selection-menu-choices");
  if (!choices || menu.dataset.selectionMenuKey !== snapshot.menuKey) return;
  choices.scrollTop = Math.min(
    snapshot.scrollTop,
    Math.max(0, choices.scrollHeight - choices.clientHeight)
  );
  choices.scrollLeft = Math.min(
    snapshot.scrollLeft,
    Math.max(0, choices.scrollWidth - choices.clientWidth)
  );
}

function handleSelectionMenuWheel(container, event) {
  const choices = container?.querySelector(".selection-menu-choices");
  if (
    !choices ||
    event.ctrlKey ||
    event.shiftKey ||
    Math.abs(event.deltaX) > Math.abs(event.deltaY) ||
    choices.scrollHeight <= choices.clientHeight
  ) {
    return;
  }

  const deltaScale = event.deltaMode === WheelEvent.DOM_DELTA_LINE
    ? 28
    : (event.deltaMode === WheelEvent.DOM_DELTA_PAGE ? choices.clientHeight : 1);
  choices.scrollTop += event.deltaY * deltaScale;
  event.preventDefault();
  event.stopPropagation();
}

function historyVersionLeafHtml(pageKey, entry, availableEntries = null) {
  const label = historyVersionLabel(pageKey, entry.version, entry.index);
  const recorded = formatVersionDate(entry.version?.createdAt);
  const preview = entry.version?.content || plainTextFromHtml(entry.version?.contentHtml || "") || "Blank version";
  const versions = versionHistoryForPageKey(pageKey);
  const exclusions = historyVersionExclusions.get(pageKey) || new Set();
  let previousIndex = entry.index - 1;
  while (
    previousIndex >= 0 &&
    exclusions.has(historyVersionId(
      versions[previousIndex] || availableEntries?.find(item => item.index === previousIndex)?.version,
      previousIndex
    ))
  ) {
    previousIndex -= 1;
  }
  const page = historyVersionPage(pageKey, entry.version, entry.index);
  const previousVersion = versions[previousIndex]
    || availableEntries?.find(item => item.index === previousIndex)?.version;
  const previousPage = previousIndex >= 0 && previousVersion
    ? historyVersionPage(pageKey, previousVersion, previousIndex)
    : null;
  const previewHtml = selectionComparisonHtml(previousPage, page);
  const zoomKey = `version:${pageKey}:${entry.id}`;
  selectionMenuZoomPages.set(zoomKey, {
    title: label,
    meta: recorded,
    beforeText: selectionPageText(previousPage),
    afterText: selectionPageText(page)
  });
  const checked = !exclusions.has(entry.id);
  return selectionMenuLeafHtml({
    className: `history-version-menu-item${checked ? "" : " is-excluded"}`,
    label,
    shortLabel: String(entry.index + 1),
    preview,
    previewHtml,
    meta: recorded,
    zoomKey,
    checked,
    inputAriaLabel: `Include ${label}`,
    inputAttributes: `data-history-version-index="${entry.index}"`,
    buttonAriaLabel: `Go to ${label}`,
    buttonAttributes: `data-history-version-focus-index="${entry.index}"`,
    outerAttributes: `title="${escapeHtml(`${label} · ${recorded}`)}"`
  });
}

function largestSelectionGroupSize(count) {
  let size = 10;
  while (count >= size * 10) size *= 10;
  return size;
}

function largestHistoryVersionGroupSize(count) {
  return largestSelectionGroupSize(count);
}

function selectionRangeLabel(start, end) {
  return end === start + 1 ? String(end) : `${start + 1}–${end}`;
}

function historyVersionGroupHtml(pageKey, entries, groupSize, start = 0, end = entries.length) {
  const groups = [];
  const exclusions = historyVersionExclusions.get(pageKey) || new Set();
  for (let groupStart = start; groupStart < end; groupStart += groupSize) {
    const groupEnd = Math.min(end, groupStart + groupSize);
    const groupKey = `${pageKey}:${groupStart}:${groupEnd}`;
    const isOpen = historyVersionExpandedGroups.has(groupKey);
    const groupEntries = entries.slice(groupStart, groupEnd);
    const included = groupEntries.filter(entry => !exclusions.has(entry.id)).length;
    const inner = isOpen
      ? (groupSize <= 10
        ? groupEntries.map(entry => historyVersionLeafHtml(pageKey, entry, entries)).join("")
        : historyVersionGroupHtml(pageKey, entries, Math.max(10, groupSize / 10), groupStart, groupEnd))
      : "";
    groups.push(selectionMenuRangeHtml({
      className: "history-version-group",
      keyAttribute: "data-history-version-group-key",
      key: groupKey,
      open: isOpen,
      partial: included > 0 && included < groupEntries.length,
      checked: Boolean(groupEntries.length) && included === groupEntries.length,
      checkboxAriaLabel: `Include versions ${groupStart + 1} to ${groupEnd}`,
      checkboxAttributes: `data-history-version-group-start="${groupStart}" data-history-version-group-end="${groupEnd}"`,
      label: `Versions ${selectionRangeLabel(groupStart, groupEnd)}`,
      count: `${included} of ${groupEntries.length}`,
      countAttributes: "data-history-version-group-count",
      dateRange: selectionDateRange(
        groupEntries[0]?.version?.createdAt,
        groupEntries[groupEntries.length - 1]?.version?.createdAt
      ),
      contents: inner
    }));
  }
  return groups.join("");
}

function historyVersionTopGroups(pageKey, entries) {
  const groupSize = largestHistoryVersionGroupSize(entries.length);
  const groups = [];
  for (let start = 0; start < entries.length; start += groupSize) {
    const end = Math.min(entries.length, start + groupSize);
    groups.push({
      key: `${pageKey}:top:${start}:${end}`,
      start,
      end,
      groupSize
    });
  }
  return groups;
}

function historyVersionIndividualTabHtml(entry) {
  return `
    <div class="page-tab history-version-item-tab">
      <input
        type="checkbox"
        data-history-version-index="${entry.index}"
        aria-label="Include version ${entry.index + 1}"
      >
      <button
        class="tab-label"
        type="button"
        data-history-version-focus-index="${entry.index}"
        aria-label="Go to version ${entry.index + 1}"
      >
        <span>${entry.index + 1}</span>
      </button>
    </div>
  `;
}

function historyVersionGroupTabHtml(group) {
  const isOpen = historyVersionFilterOpen === group.key;
  const label = selectionRangeLabel(group.start, group.end);
  return `
    <div class="selection-menu-trigger-shell history-version-group-tab-shell">
      <div class="page-tab selection-menu-trigger history-version-range-tab${isOpen ? " active" : ""}">
        <input
          type="checkbox"
          data-history-version-group-start="${group.start}"
          data-history-version-group-end="${group.end}"
          aria-label="Include versions ${group.start + 1} to ${group.end}"
        >
        <button
          class="tab-label selection-menu-trigger-toggle history-version-range-toggle"
          type="button"
          data-history-version-filter-toggle="${escapeHtml(group.key)}"
          data-history-version-filter-start="${group.start}"
          data-history-version-filter-end="${group.end}"
          aria-haspopup="true"
          aria-expanded="${String(isOpen)}"
          aria-label="Choose versions ${group.start + 1} to ${group.end}"
        >
          <span>${label}</span>
        </button>
      </div>
    </div>
  `;
}

function historyVersionOpenGroupMenuHtml(pageKey, entries, groups, included, total) {
  const group = groups.find(item => item.key === historyVersionFilterOpen);
  if (!group) return "";

  const choices = group.groupSize >= 100
    ? historyVersionGroupHtml(
      pageKey,
      entries,
      Math.max(10, group.groupSize / 10),
      group.start,
      group.end
    )
    : entries.slice(group.start, group.end).map(entry => historyVersionLeafHtml(pageKey, entry, entries)).join("");
  const exclusions = historyVersionExclusions.get(pageKey) || new Set();
  const groupIncluded = entries
    .slice(group.start, group.end)
    .filter(entry => !exclusions.has(entry.id))
    .length;

  return selectionMenuPopoverHtml({
    className: "history-version-menu",
    menuKey: group.key,
    ariaLabel: `Choose versions ${group.start + 1} to ${group.end}`,
    title: `Versions ${selectionRangeLabel(group.start, group.end)}`,
    description: "Choose the versions you want included.",
    count: `${groupIncluded.toLocaleString("en-GB")} of ${(group.end - group.start).toLocaleString("en-GB")}`,
    dateRange: selectionDateRange(
      entries[group.start]?.version?.createdAt,
      entries[group.end - 1]?.version?.createdAt
    ),
    choicesClass: "history-version-choices",
    choicesAriaLabel: "Version groups",
    choices,
    footer: `${included.toLocaleString("en-GB")} of ${total.toLocaleString("en-GB")} versions included`
  });
}

function updateAllVersionsLabelDensity() {
  const panel = els.historyVersionFilter?.querySelector(".history-version-tabs-panel");
  if (!panel || els.historyVersionFilter.hidden) return;

  panel.classList.remove("compact-all-versions");
  const allVersions = panel.querySelector(".all-versions-tab");
  const versionTabs = panel.querySelector(".history-version-tabs");
  const total = panel.querySelector(".history-version-total");
  const requiredWidth =
    (allVersions?.offsetWidth || 0) +
    (versionTabs?.scrollWidth || 0) +
    (total?.offsetWidth || 0) +
    34;
  panel.classList.toggle("compact-all-versions", requiredWidth > panel.clientWidth);
}

function syncHistoryVersionGroupControls(pageKey, versions) {
  if (!els.historyVersionFilter) return;
  const exclusions = normalizedHistoryVersionExclusions(pageKey, versions);
  const allControl = els.historyVersionFilter.querySelector("[data-history-version-all]");
  if (allControl) {
    const included = versions.length - exclusions.size;
    allControl.checked = Boolean(versions.length) && included === versions.length;
    allControl.indeterminate = included > 0 && included < versions.length;
  }
  els.historyVersionFilter
    .querySelectorAll("[data-history-version-index]")
    .forEach(control => {
      const index = Number(control.dataset.historyVersionIndex);
      control.checked = Number.isInteger(index) && !exclusions.has(historyVersionId(versions[index], index));
    });
  els.historyVersionFilter
    .querySelectorAll("[data-history-version-group-start][data-history-version-group-end]")
    .forEach(control => {
      const start = Math.max(0, Number(control.dataset.historyVersionGroupStart) || 0);
      const end = Math.min(versions.length, Number(control.dataset.historyVersionGroupEnd) || 0);
      const entries = versions.slice(start, end);
      const included = entries.filter((version, offset) => (
        !exclusions.has(historyVersionId(version, start + offset))
      )).length;
      control.checked = Boolean(entries.length) && included === entries.length;
      control.indeterminate = included > 0 && included < entries.length;
      const count = control.closest("summary")?.querySelector("[data-history-version-group-count]");
      if (count) count.textContent = `${included.toLocaleString("en-GB")} of ${entries.length.toLocaleString("en-GB")}`;
    });
}

function renderHistoryVersionFilter() {
  if (!els.historyVersionFilter) return;
  const menuScroll = selectionMenuScrollSnapshot(
    els.historyVersionFilter,
    historyVersionFilterOpen
  );
  const pageKey = activeVersionHistoryPageKey();
  if (!pageKey) {
    els.historyVersionFilter.hidden = true;
    els.historyVersionFilter.innerHTML = "";
    return;
  }

  const versions = versionHistoryForPageKey(pageKey);
  const exclusions = normalizedHistoryVersionExclusions(pageKey, versions);
  const included = versions.length - exclusions.size;
  const entries = versions.map((version, index) => ({
    version,
    index,
    id: historyVersionId(version, index)
  }));
  const groups = versions.length > 10 ? historyVersionTopGroups(pageKey, entries) : [];
  if (historyVersionFilterOpen && !groups.some(group => group.key === historyVersionFilterOpen)) {
    historyVersionFilterOpen = null;
  }
  const tabs = groups.length
    ? groups.map(historyVersionGroupTabHtml).join("")
    : entries.map(historyVersionIndividualTabHtml).join("");

  els.historyVersionFilter.hidden = false;
  els.historyVersionFilter.innerHTML = `
    <div class="history-version-tabs-panel" aria-label="Versions to include">
      <div class="page-tab all-versions-tab">
        <input
          type="checkbox"
          data-history-version-all
          aria-label="Include all versions"
        >
        <button class="tab-label" type="button" data-history-version-all-label aria-label="All versions">
          <span class="all-versions-label-full">All versions</span>
          <span class="all-versions-label-short" aria-hidden="true">AV</span>
        </button>
      </div>
      <div class="history-version-tabs">${tabs}</div>
      <span class="history-version-total">${included.toLocaleString("en-GB")} of ${versions.length.toLocaleString("en-GB")}</span>
    </div>
    ${historyVersionOpenGroupMenuHtml(pageKey, entries, groups, included, versions.length)}
  `;
  syncHistoryVersionGroupControls(pageKey, versions);
  restoreSelectionMenuScroll(els.historyVersionFilter, menuScroll);
  window.requestAnimationFrame(() => (
    restoreSelectionMenuScroll(els.historyVersionFilter, menuScroll)
  ));
  window.requestAnimationFrame(updateAllVersionsLabelDensity);
}

function setHistoryVersionRangeIncluded(start, end, included) {
  const pageKey = activeVersionHistoryPageKey();
  const versions = versionHistoryForPageKey(pageKey);
  const exclusions = normalizedHistoryVersionExclusions(pageKey, versions);
  versions.slice(start, end).forEach((version, offset) => {
    const id = historyVersionId(version, start + offset);
    if (included) exclusions.delete(id);
    else exclusions.add(id);
  });
  historyVersionExclusions.set(pageKey, exclusions);
}

function updateHistoryVersionSelection() {
  renderHistoryVersionFilter();
  renderDiffSoon("Updating version history");
}

function toggleHistoryVersionFilter(groupKey = null, open = null) {
  if (!activeVersionHistoryPageKey()) return;
  if (draftTabFilterOpen) {
    draftTabFilterOpen = null;
    renderDraftTabs();
  }
  if (groupKey === false || open === false) {
    historyVersionFilterOpen = null;
  } else if (typeof groupKey === "string" && groupKey) {
    historyVersionFilterOpen = historyVersionFilterOpen === groupKey ? null : groupKey;
  }
  renderHistoryVersionFilter();
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
    clearDraftVersionTimer(draftNotesKey(draft.id));
    delete editorSelections[draftContentKey(draft.id)];
    delete editorSelections[draftNotesKey(draft.id)];
  });

  state.drafts = nextDrafts.length ? nextDrafts : [createDraft(null)];
  selectedDraftId = draftExists(entry.selectedDraftId) ? entry.selectedDraftId : state.drafts[0]?.id || null;
  activeArea = entry.activeArea === "story" ? "story" : "draft";
  activeEditorKey = pageKeyExists(entry.activeEditorKey)
    ? entry.activeEditorKey
    : (activeArea === "story" ? STORY_KEY : draftContentKey(selectedDraftId));
  versionHistoryDraftId = normalizedVersionHistoryPageKey(entry.versionHistoryDraftId) || null;

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
  versionHistoryDraftId = pageKey;
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

function restoreDraftNotesVersion(draftId, versionId) {
  const draft = draftById(draftId);
  if (!draft?.notes) return;

  const pageKey = draftNotesKey(draft.id);
  syncPageFromDom(pageKey);
  const notesTitle = draft.notes.title || `${draft.title || "Untitled draft"} Notes`;
  const history = ensurePageVersionHistory(draft.notes, notesTitle);
  const versionIndex = history.findIndex(version => version.id === versionId);
  if (versionIndex < 0) return;

  const version = history[versionIndex];
  const label = `Draft ${draftNotesVersionNumber(draft, versionIndex)}`;
  const confirmed = window.confirm(
    `Restore ${label}?\n\nThis will replace the current draft notes text and formatting. The current draft notes will be kept in version history.`
  );
  if (!confirmed) return;

  recordPageUndoSnapshot(pageKey);
  clearDraftVersionTimer(pageKey);
  appendPageVersionIfChanged(draft.notes, notesTitle);

  const contentHtml = sanitizeRichHtml(version.contentHtml || textToHtml(version.content || ""));
  draft.notes.title = notesTitle;
  draft.notes.contentHtml = contentHtml;
  draft.notes.content = typeof version.content === "string" ? version.content : plainTextFromHtml(contentHtml);
  draft.notes.format = normalizeFormat({ ...currentDefaultFormat(state), ...(version.format || {}) });
  draft.notes.updatedAt = nowIso();

  appendPageVersionIfChanged(draft.notes, notesTitle);
  versionHistoryDraftId = pageKey;
  selectedDraftId = draft.id;
  activeArea = "draft";
  activeEditorKey = pageKey;
  displayPage(pageKey, true);
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

function clearDraftVersionTimer(captureKey) {
  const keys = new Set([captureKey, normalizedVersionHistoryPageKey(captureKey)].filter(Boolean));
  if (captureKey && captureKey !== STORY_KEY && !parseDraftPageKey(captureKey)) {
    keys.add(draftContentKey(captureKey));
    keys.add(draftNotesKey(captureKey));
  }
  keys.forEach(key => {
    window.clearTimeout(draftVersionTimers.get(key));
    draftVersionTimers.delete(key);
  });
}

function flushPageVersionCapture(pageKey, options = {}) {
  const normalizedKey = normalizedVersionHistoryPageKey(pageKey);
  const item = normalizedKey ? pageItemForKey(normalizedKey) : null;
  if (!item?.page) return false;

  clearDraftVersionTimer(normalizedKey);
  const changed = appendPageVersionIfChanged(item.page, item.title);
  if (changed && options.markChanged !== false) {
    markStateChanged();
    rememberLinkedProjectState();
    if (activeVersionHistoryPageKey() === normalizedKey) renderDiffSoon("Loading version history");
  }
  return changed;
}

function flushDraftVersionCapture(draftId, options = {}) {
  return flushPageVersionCapture(draftContentKey(draftId), options);
}

function flushProjectNotesVersionCapture(options = {}) {
  return flushPageVersionCapture(STORY_KEY, options);
}

function flushVersionCapture(captureKey, options = {}) {
  return flushPageVersionCapture(captureKey, options);
}

function scheduleVersionHistoryPageSave(pageKey, historyKey = pageKey) {
  schedulePageSave(pageKey, {
    includeVersionHistory: true,
    refreshUi: false,
    refreshDiff: false
  });
  if (activeVersionHistoryPageKey() === normalizedVersionHistoryPageKey(historyKey)) renderDiffSoon("Loading version history");
}

function flushDraftVersionCaptures() {
  const changedCaptureKeys = [];
  [...draftVersionTimers.keys()].forEach(captureKey => {
    if (flushVersionCapture(captureKey, { markChanged: false })) changedCaptureKeys.push(captureKey);
  });
  return changedCaptureKeys;
}

function queuePageVersionCapture(pageKey) {
  const normalizedKey = normalizedVersionHistoryPageKey(pageKey);
  if (!normalizedKey || isRestoringHistory) return;

  clearDraftVersionTimer(normalizedKey);
  draftVersionTimers.set(normalizedKey, window.setTimeout(() => {
    draftVersionTimers.delete(normalizedKey);
    if (flushPageVersionCapture(normalizedKey)) {
      scheduleVersionHistoryPageSave(normalizedKey);
    }
  }, DRAFT_VERSION_CAPTURE_DELAY_MS));
}

function queueDraftVersionCapture(draftId) {
  queuePageVersionCapture(draftContentKey(draftId));
}

function queueProjectNotesVersionCapture() {
  queuePageVersionCapture(STORY_KEY);
}

function queueDraftVersionCaptureForEditor(editorEl) {
  const pageKey = editorEl?.dataset.editorKey;
  const parsed = parseDraftPageKey(pageKey);
  if (parsed?.type === "story" || parsed?.type === "content" || parsed?.type === "notes") {
    queuePageVersionCapture(pageKey);
  }
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
    if (draft?.id && Array.isArray(draft.notes?.versionHistory)) {
      histories.set(draftNotesKey(draft.id), draft.notes.versionHistory);
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
    if (draft.notes) {
      const notesKey = draftNotesKey(draft.id);
      if (histories?.has(notesKey)) draft.notes.versionHistory = histories.get(notesKey);
      ensurePageVersionHistory(draft.notes, draft.notes.title || `${draft.title || "Untitled draft"} Notes`);
      promotePageToNewestHistoryVersion(draft.notes, draft.notes.title || `${draft.title || "Untitled draft"} Notes`);
    }
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
  if (parsed.type === "notes" && changed) queuePageVersionCapture(key);

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
  ensureDisplaySelection({ persist: false, align: false });
  setPagesOnScreen(pagesOnScreen, { persist: false, align: false });
  saveCurrentViewState({ syncDom: false });
}

function ensureDisplaySelection(options = {}) {
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

  if (options.persist !== false) saveLayoutViewState();
  syncPagesOnScreenToDisplaySelection(options);
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

function displayDraftRange(start, end, shouldDisplay = true) {
  hasStoredDisplaySelection = true;
  state.drafts.slice(start, end).forEach(draft => {
    const key = draftContentKey(draft.id);
    if (shouldDisplay) displayedPageKeys.add(key);
    else displayedPageKeys.delete(key);
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

function setPagesOnScreen(value, options = {}) {
  pagesOnScreen = normalizePagesOnScreenForSelection(value);
  normalizePagePanePercentsForLayout();
  applyPagePaneStyles();
  updatePagesOnScreenControls();
  if (options.persist !== false) persistViewStateChange(500);
  if (changesPanelIsOpen()) renderDiffSoon();
  if (options.align !== false) {
    window.requestAnimationFrame(() => {
      alignPageInCanvas(activeDisplayKey());
      updateAllNotesHeadingDensity();
    });
  }
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
  const historyKey = activeVersionHistoryPageKey();
  if (historyKey) return [historyKey];
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
  if (activeVersionHistoryPageKey()) return "This history";
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
  const historyKey = activeVersionHistoryPageKey();
  if (historyKey) {
    searchState.selectedKeys = new Set([historyKey]);
    els.searchScopeMenu.hidden = true;
    els.searchScopeMenu.innerHTML = "";
    if (els.searchScopeToggle) {
      els.searchScopeToggle.disabled = true;
      els.searchScopeToggle.setAttribute("aria-expanded", "false");
    }
    if (els.searchScopeLabel) els.searchScopeLabel.textContent = "This history";
    return;
  }
  if (els.searchScopeToggle) els.searchScopeToggle.disabled = false;

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
  if (activeVersionHistoryPageKey()) return false;

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
    if (range) {
      const startElement = range.startContainer.nodeType === Node.ELEMENT_NODE
        ? range.startContainer
        : range.startContainer.parentElement;
      matches.push({
        range,
        versionPageId: startElement?.closest?.("[data-compare-page-id]")?.dataset.comparePageId || ""
      });
    }
    index = normalizedHaystack.indexOf(normalizedNeedle, index + Math.max(1, normalizedNeedle.length));
  }

  return matches;
}

function historySearchText(version) {
  return String(
    version?.content ||
    plainTextFromHtml(version?.contentHtml || "")
  );
}

function historySearchMatches(query) {
  const virtualState = historyVirtualState;
  const needle = String(query || "");
  if (!virtualState || !needle) return [];

  const normalizedNeedle = needle.toLocaleLowerCase();
  const matches = [];
  virtualState.entries.forEach((entry, historyPosition) => {
    const haystack = historySearchText(entry.version);
    const normalizedHaystack = haystack.toLocaleLowerCase();
    let sourceOffset = normalizedHaystack.indexOf(normalizedNeedle);
    let occurrence = 0;

    while (sourceOffset >= 0) {
      matches.push({
        historyPosition,
        occurrence,
        sourceOffset,
        versionPageId: entry.id,
        range: null
      });
      occurrence += 1;
      sourceOffset = normalizedHaystack.indexOf(
        normalizedNeedle,
        sourceOffset + Math.max(1, normalizedNeedle.length)
      );
    }
  });
  return matches;
}

function visibleHistorySearchRanges() {
  const historyKey = activeVersionHistoryPageKey();
  const matches = historyKey ? (searchState.results.get(historyKey) || []) : [];
  const query = searchState.query;
  const activeIndex = Number(searchState.activeIndexes[historyKey]) || 0;
  const domMatchesByPosition = new Map();
  const matchRanges = [];
  const activeRanges = [];

  matches.forEach((match, index) => {
    match.range = null;
    const page = els.diffOutput.querySelector(
      `[data-history-position="${match.historyPosition}"]`
    );
    const body = page?.querySelector(".compare-page-body");
    if (!body) return;

    if (!domMatchesByPosition.has(match.historyPosition)) {
      domMatchesByPosition.set(
        match.historyPosition,
        searchMatchesForEditor(body, query)
      );
    }
    const domMatches = domMatchesByPosition.get(match.historyPosition);
    const renderedMatch = domMatches[match.occurrence] || domMatches[0];
    if (!renderedMatch?.range) return;

    match.range = renderedMatch.range;
    if (index === activeIndex) activeRanges.push(match.range);
    else matchRanges.push(match.range);
  });

  return { matchRanges, activeRanges };
}

function refreshVisibleVersionHistorySearchHighlights() {
  if (!searchState.open || !searchState.query || !activeVersionHistoryPageKey()) return;
  const { matchRanges, activeRanges } = visibleHistorySearchRanges();
  setSearchHighlights(matchRanges, activeRanges);
}

function refreshVersionHistorySearchResults(options = {}) {
  const pageKey = activeVersionHistoryPageKey();
  const virtualState = historyVirtualState;
  if (!pageKey || !virtualState) return false;

  const scopedKeys = searchScopePageKeys();
  const signature = `${pageKey}\n${searchState.query}\n${virtualState.revision}`;
  const shouldResetActive = searchState.shouldScrollToFirst || signature !== searchState.lastSignature;
  const results = new Map();

  if (!scopedKeys.includes(pageKey)) {
    searchState.results = results;
    searchState.lastSignature = signature;
    syncSearchResultBars(scopedKeys, results);
    clearSearchHighlights();
    if (els.searchSummary) els.searchSummary.textContent = "No pages selected.";
    if (els.searchPrev) els.searchPrev.disabled = true;
    if (els.searchNext) els.searchNext.disabled = true;
    searchState.shouldScrollToFirst = false;
    return true;
  }

  if (shouldResetActive) {
    searchState.activeIndexes = {};
    searchState.activeKey = null;
  }

  const matches = historySearchMatches(searchState.query);
  results.set(pageKey, matches);
  if (matches.length) {
    searchState.activeIndexes[pageKey] = Math.min(
      matches.length - 1,
      Math.max(0, Number(searchState.activeIndexes[pageKey]) || 0)
    );
    searchState.activeKey = pageKey;
  } else {
    delete searchState.activeIndexes[pageKey];
    searchState.activeKey = null;
  }

  searchState.results = results;
  searchState.lastSignature = signature;
  syncSearchResultBars(scopedKeys, results);
  refreshVisibleVersionHistorySearchHighlights();

  const matchingVersions = new Set(matches.map(match => match.historyPosition)).size;
  if (els.searchSummary) {
    els.searchSummary.textContent = searchSummaryText(matches.length, matchingVersions);
  }
  if (els.searchPrev) els.searchPrev.disabled = matches.length < 2;
  if (els.searchNext) els.searchNext.disabled = matches.length < 2;

  if ((shouldResetActive || options.scrollActive) && matches.length) {
    scrollSearchMatchIntoView(pageKey, searchState.activeIndexes[pageKey] || 0);
  }
  searchState.shouldScrollToFirst = false;
  return true;
}

function searchSummaryText(totalMatches, pageCount) {
  const query = searchState.query;
  if (!query) return "Enter a search term.";
  if (!totalMatches) return `No matches for "${query}".`;
  const unit = activeVersionHistoryPageKey() ? "version" : "page";
  return `${totalMatches.toLocaleString()} ${totalMatches === 1 ? "match" : "matches"} in ${pageCount} ${pageCount === 1 ? unit : `${unit}s`}.`;
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

  const historyKey = activeVersionHistoryPageKey();
  if (historyKey && pageKey === historyKey) {
    if (Number.isInteger(match.historyPosition)) {
      ensureHistoryVirtualPosition(match.historyPosition, { scroll: true });
      refreshVisibleVersionHistorySearchHighlights();
    }
    if (!match.range) return;

    const startElement = match.range.startContainer.nodeType === Node.ELEMENT_NODE
      ? match.range.startContainer
      : match.range.startContainer.parentElement;
    const page = startElement?.closest?.(".compare-page");
    const body = startElement?.closest?.(".compare-page-body");
    page?.scrollIntoView({ block: "nearest", inline: "nearest", behavior: "auto" });
    if (!body) return;

    window.requestAnimationFrame(() => {
      const rect = match.range.getBoundingClientRect();
      const bodyRect = body.getBoundingClientRect();
      const targetTop = body.scrollTop + rect.top - bodyRect.top;
      const targetLeft = body.scrollLeft + rect.left - bodyRect.left;
      body.scrollTo({
        top: Math.max(0, targetTop - (body.clientHeight * 0.36)),
        left: Math.max(0, targetLeft - 28),
        behavior: "smooth"
      });
    });
    return;
  }

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

  if (activeVersionHistoryPageKey() && refreshVersionHistorySearchResults(options)) {
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
    const historyKey = activeVersionHistoryPageKey();
    const searchRoot = historyKey && key === historyKey
      ? els.diffOutput
      : editorElementForKey(key);
    const matches = searchRoot ? searchMatchesForEditor(searchRoot, query) : [];
    results.set(key, matches);
    if (matches.length) {
      const matchingVersionCount = historyKey
        ? new Set(matches.map(match => match.versionPageId).filter(Boolean)).size
        : 0;
      pagesWithMatches += historyKey ? (matchingVersionCount || 1) : 1;
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

function rangeInsideEditor(range, editorEl) {
  return Boolean(
    range &&
    editorEl &&
    editorEl.contains(range.startContainer) &&
    editorEl.contains(range.endContainer)
  );
}

function currentEditorSelectionRange(editorEl) {
  const selection = window.getSelection();
  if (!selection?.rangeCount) return null;
  const range = selection.getRangeAt(0);
  return !range.collapsed && rangeInsideEditor(range, editorEl) ? range.cloneRange() : null;
}

function savedEditorSelectionRange(editorEl) {
  const saved = editorSelections[editorEl?.dataset?.editorKey];
  if (!editorEl || !saved) return null;
  if (saved.startTextOffset === undefined || saved.endTextOffset === undefined) return null;

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

  return range && !range.collapsed && rangeInsideEditor(range, editorEl) ? range : null;
}

function rangeContainsClientPoint(range, clientX, clientY) {
  if (!range) return false;
  return Array.from(range.getClientRects())
    .some(rect => pointInRect(clientX, clientY, rect, 1));
}

function rangeTextOffsetBounds(editorEl, range) {
  if (!rangeInsideEditor(range, editorEl)) return null;
  const start = textOffsetForRangeBoundary(editorEl, range.startContainer, range.startOffset);
  const end = textOffsetForRangeBoundary(editorEl, range.endContainer, range.endOffset);
  return { start: Math.min(start, end), end: Math.max(start, end) };
}

function rangeContainsCaretPoint(range, editorEl, caretRange) {
  if (!rangeInsideEditor(caretRange, editorEl)) return false;
  const bounds = rangeTextOffsetBounds(editorEl, range);
  if (!bounds || bounds.start === bounds.end) return false;
  const offset = textOffsetForRangeBoundary(editorEl, caretRange.startContainer, caretRange.startOffset);
  return offset >= bounds.start && offset <= bounds.end;
}

function selectedRangeAtContextPoint(editorEl, caretRange, clientX, clientY) {
  const ranges = [
    currentEditorSelectionRange(editorEl),
    savedEditorSelectionRange(editorEl)
  ];

  return ranges.find(range => (
    range &&
    (rangeContainsClientPoint(range, clientX, clientY) || rangeContainsCaretPoint(range, editorEl, caretRange))
  )) || null;
}

function selectRange(range) {
  if (!range) return false;
  const selection = window.getSelection();
  selection.removeAllRanges();
  selection.addRange(range);
  return true;
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
  return selectRange(range);
}

function selectedClipboardPayload(editorEl) {
  const selection = window.getSelection();
  if (!selection?.rangeCount) return null;
  const range = selection.getRangeAt(0);
  if (range.collapsed || !rangeInsideEditor(range, editorEl)) return null;

  const container = document.createElement("div");
  container.append(range.cloneContents());
  const html = sanitizeRichHtml(container.innerHTML);
  const text = selection.toString();
  if (!html && !text) return null;
  return { html, text };
}

async function writeClipboardPayload(payload) {
  const html = String(payload?.html || "");
  const text = String(payload?.text || "");
  const clipboard = navigator.clipboard;
  if (!clipboard) return false;

  if (html && typeof clipboard.write === "function" && typeof ClipboardItem === "function" && typeof Blob === "function") {
    try {
      await clipboard.write([
        new ClipboardItem({
          "text/html": new Blob([html], { type: "text/html" }),
          "text/plain": new Blob([text || plainTextFromHtml(html)], { type: "text/plain" })
        })
      ]);
      return true;
    } catch {}
  }

  if (text && typeof clipboard.writeText === "function") {
    await clipboard.writeText(text);
    return true;
  }

  return false;
}

async function readClipboardItemText(item, type) {
  if (!item?.types?.includes(type) || typeof item.getType !== "function") return "";
  const blob = await item.getType(type);
  return typeof blob?.text === "function" ? blob.text() : "";
}

async function readClipboardPayload() {
  const clipboard = navigator.clipboard;
  if (!clipboard) return null;

  if (typeof clipboard.read === "function") {
    try {
      const items = await clipboard.read();
      for (const item of items || []) {
        const html = await readClipboardItemText(item, "text/html");
        const text = await readClipboardItemText(item, "text/plain");
        if (html || text) return { html, text: text || plainTextFromHtml(html) };
      }
    } catch {}
  }

  if (typeof clipboard.readText === "function") {
    try {
      const text = await clipboard.readText();
      if (text) return { html: "", text };
    } catch {}
  }

  return null;
}

function syncEditorDomMutation(editorEl, beforeEntry = null) {
  const editorKey = editorEl?.dataset?.editorKey;
  if (!editorKey) return false;

  const page = pageForEditorKey(editorKey);
  if (page) syncRichPage(page, editorEl);

  if (beforeEntry) {
    const currentEntry = pageHistoryEntryForKey(editorKey);
    if (currentEntry && !historyEntriesMatch(currentEntry, beforeEntry)) pushUndoHistoryEntry(beforeEntry);
  }

  queueDraftVersionCaptureForEditor(editorEl);
  queueDraftNoteStatsRefresh(editorEl, 0);
  saveEditorViewState(editorEl);
  schedulePageSave(editorKey, {
    updateViewState: false,
    cacheLinkedState: false,
    refreshUi: false,
    refreshDiff: false
  });
  return true;
}

function deleteSelectedContent(editorEl) {
  const selection = window.getSelection();
  if (!selection?.rangeCount) return false;
  const range = selection.getRangeAt(0);
  if (range.collapsed || !rangeInsideEditor(range, editorEl)) return false;

  if (execRichTextCommand("delete", { document, editor: editorEl })) return true;

  range.deleteContents();
  range.collapse(true);
  selection.removeAllRanges();
  selection.addRange(range);
  return true;
}

async function copyEditorSelection(editorEl, range = null) {
  if (range && !selectRange(range)) return false;
  const payload = selectedClipboardPayload(editorEl);
  if (!payload) return false;

  try {
    if (await writeClipboardPayload(payload)) return true;
  } catch {}

  return execRichTextCommand("copy", { document, editor: editorEl });
}

async function cutEditorSelection(editorEl, range = null) {
  if (range && !selectRange(range)) return false;
  const payload = selectedClipboardPayload(editorEl);
  if (!payload) return false;

  const beforeEntry = pageHistoryEntryForKey(editorEl.dataset.editorKey);
  try {
    if (await writeClipboardPayload(payload)) {
      if (!deleteSelectedContent(editorEl)) return false;
      syncEditorDomMutation(editorEl, beforeEntry);
      return true;
    }
  } catch {}

  const didCut = execRichTextCommand("cut", { document, editor: editorEl });
  if (didCut) syncEditorDomMutation(editorEl, beforeEntry);
  return didCut;
}

function clipboardPayloadData(payload) {
  return {
    getData(type) {
      if (type === "text/html") return payload?.html || "";
      if (type === "text/plain") return payload?.text || "";
      return "";
    }
  };
}

async function pasteIntoEditor(editorEl, range = null) {
  if (rangeInsideEditor(range, editorEl)) {
    selectRange(range);
  } else {
    editorEl.focus({ preventScroll: true });
  }

  const beforeEntry = pageHistoryEntryForKey(editorEl.dataset.editorKey);
  const payload = await readClipboardPayload();
  if (payload?.html || payload?.text) {
    insertClipboardHtml(clipboardPayloadData(payload), { document, editor: editorEl, textToHtml });
    syncEditorDomMutation(editorEl, beforeEntry);
    return true;
  }

  const didPaste = execRichTextCommand("paste", { document, editor: editorEl });
  if (didPaste) syncEditorDomMutation(editorEl, beforeEntry);
  return didPaste;
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

function showSpellcheckMenu({
  word,
  range = null,
  clipboardRange = null,
  pasteRange = null,
  editorEl = null,
  suggestions = [],
  misspelled = false,
  clientX,
  clientY
}) {
  closeSpellcheckMenu();
  spellcheckRange = range;
  const menu = document.createElement("div");
  menu.className = "spellcheck-menu";
  menu.setAttribute("role", "menu");
  const canUseClipboardSelection = Boolean(editorEl && clipboardRange);

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
    ${menuButtonHtml("Cut", "cut", !canUseClipboardSelection)}
    ${menuButtonHtml("Copy", "copy", !canUseClipboardSelection)}
    ${menuButtonHtml("Paste", "paste", !editorEl)}
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
      const selectionEditor = editorEl || spellcheckRange?.startContainer?.parentElement?.closest("[data-editor-key]");
      if (selectionEditor) {
        const range = document.createRange();
        range.selectNodeContents(selectionEditor);
        selectRange(range);
      }
      closeSpellcheckMenu();
      return;
    }

    if (action === "cut") {
      const range = clipboardRange?.cloneRange();
      closeSpellcheckMenu();
      if (!await cutEditorSelection(editorEl, range)) setStatus("Cut unavailable");
      return;
    }

    if (action === "copy") {
      const range = clipboardRange?.cloneRange();
      closeSpellcheckMenu();
      if (!await copyEditorSelection(editorEl, range)) setStatus("Copy unavailable");
      return;
    }

    if (action === "paste") {
      const range = pasteRange?.cloneRange();
      closeSpellcheckMenu();
      if (!await pasteIntoEditor(editorEl, range)) setStatus("Paste unavailable");
      return;
    }

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

  const caretRange = caretRangeFromPoint(event.clientX, event.clientY);
  const selectionRange = selectedRangeAtContextPoint(editorEl, caretRange, event.clientX, event.clientY);
  const wordInfo = wordRangeAtPoint(editorEl, event.clientX, event.clientY);
  event.preventDefault();
  const range = wordInfo?.range?.cloneRange() || null;
  const clipboardRange = selectionRange || range;
  const pasteRange = selectionRange
    ? selectionRange
    : (rangeInsideEditor(caretRange, editorEl) ? caretRange : null);

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
    clipboardRange,
    pasteRange,
    editorEl,
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

function draftNotesExportMetadata(notes) {
  ensurePageFields(notes);
  return {
    updatedAt: notes.updatedAt || notes.createdAt,
    wordCount: pageWordCount(notes)
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
    pages.push(exportPageBlock(`${title} Notes`, draft.notes.createdAt, draft.notes.content, draftNotesExportMetadata(draft.notes)));
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

function pageFromImportedBlock(block, fallbackTitle, previousPage = null, options = {}) {
  const preserveIdentity = options.preserveIdentity !== false;
  const title = block?.title || fallbackTitle;
  const content = block?.content || "";
  const importedCreatedAt = block?.createdAt || nowIso();
  const importedUpdatedAt = block?.updatedAt || importedCreatedAt;
  const createdAt = preserveIdentity && previousPage?.createdAt ? previousPage.createdAt : importedCreatedAt;
  const previousContent = preserveIdentity && previousPage
    ? previousPage.content || plainTextFromHtml(previousPage.contentHtml || "")
    : null;
  const contentChanged = preserveIdentity && previousPage && previousContent !== content;
  return {
    id: preserveIdentity && previousPage?.id ? previousPage.id : makeId("page"),
    title,
    createdAt,
    updatedAt: contentChanged
      ? nowIso()
      : preserveIdentity && previousPage?.updatedAt
      ? previousPage.updatedAt
      : importedUpdatedAt || createdAt,
    content,
    contentHtml: textToHtml(content),
    format: preservedFormat(previousPage)
  };
}

function stateFromExportText(text, previousState = null, options = {}) {
  const preserveIdentity = options.preserveIdentity !== false;
  const preserveHistory = options.preserveHistory !== false;
  const promoteHistoryPages = options.promoteHistoryPages !== false;
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
    const draft = pageFromImportedBlock(draftBlock, `Draft ${draftNumber}`, previousDraft, { preserveIdentity });
    if (preserveHistory && Array.isArray(previousDraft?.versionHistory)) {
      draft.versionHistory = previousDraft.versionHistory;
    }
    const notes = pageFromImportedBlock(notesBlock, `${draft.title} Notes`, previousDraft?.notes, { preserveIdentity });
    notes.id = preserveIdentity && previousDraft?.notes?.id ? previousDraft.notes.id : makeId("notes");
    notes.title = `${draft.title} Notes`;
    if (preserveHistory && Array.isArray(previousDraft?.notes?.versionHistory)) {
      notes.versionHistory = previousDraft.notes.versionHistory;
    }
    const importedDraft = {
      ...draft,
      id: preserveIdentity && previousDraft?.id ? previousDraft.id : makeId("draft"),
      notes
    };
    ensureDraftVersionHistory(importedDraft);
    if (promoteHistoryPages) {
      promotePageToNewestHistoryVersion(importedDraft, importedDraft.title || `Draft ${draftNumber}`);
    }
    appendDraftVersionIfChanged(importedDraft);
    ensurePageVersionHistory(importedDraft.notes, importedDraft.notes.title);
    if (promoteHistoryPages) {
      promotePageToNewestHistoryVersion(importedDraft.notes, importedDraft.notes.title);
    }
    appendPageVersionIfChanged(importedDraft.notes, importedDraft.notes.title);
    drafts.push(importedDraft);
  }

  if (!drafts.length) drafts.push(createDraft(null, 1));

  const initialNotes = {
    ...pageFromImportedBlock(storyBlock, PROJECT_NOTES_TITLE, previousState?.initialNotes, { preserveIdentity }),
    id: "initial-notes",
    title: PROJECT_NOTES_TITLE
  };
  if (preserveHistory && Array.isArray(previousState?.initialNotes?.versionHistory)) {
    initialNotes.versionHistory = previousState.initialNotes.versionHistory;
  }
  ensurePageVersionHistory(initialNotes, PROJECT_NOTES_TITLE);
  if (promoteHistoryPages) {
    promotePageToNewestHistoryVersion(initialNotes, PROJECT_NOTES_TITLE);
  }
  appendPageVersionIfChanged(initialNotes, PROJECT_NOTES_TITLE);

  return {
    version: 1,
    storyId: previousState?.storyId,
    formatDefaultVersion: FORMAT_DEFAULT_VERSION,
    defaultFormat: currentDefaultFormat(previousState),
    createdAt: preserveIdentity ? createdAt : storyBlock.createdAt || nowIso(),
    updatedAt: nowIso(),
    viewState: preserveIdentity ? previousState?.viewState || null : null,
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

function draftRangeSelectionState(start, end) {
  const drafts = state.drafts.slice(start, end);
  const included = drafts.filter(draft => displayedPageKeys.has(draftContentKey(draft.id))).length;
  return {
    total: drafts.length,
    included,
    checked: Boolean(drafts.length) && included === drafts.length,
    indeterminate: included > 0 && included < drafts.length
  };
}

function draftTabHtml(draft, index, options = {}) {
  const historyMode = Boolean(versionHistoryDraftId);
  const activeHistoryDraftId = parseDraftPageKey(activeVersionHistoryPageKey())?.draftId;
  const activeDraftId = historyMode ? activeHistoryDraftId : selectedDraftId;
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
  if (options.menu) {
    const preview = draft.content || plainTextFromHtml(draft.contentHtml || "") || "Blank draft";
    const referenceIndex = els.compareMode?.value === "consecutive" ? index - 1 : 0;
    const referenceDraft = index > 0 ? state.drafts[referenceIndex] : null;
    const previewHtml = selectionComparisonHtml(referenceDraft, draft);
    const zoomKey = `draft:${draft.id}`;
    selectionMenuZoomPages.set(zoomKey, {
      title: draft.title,
      meta: `Last edited ${formatVersionDate(draft.updatedAt || draft.createdAt)}`,
      beforeText: selectionPageText(referenceDraft),
      afterText: selectionPageText(draft)
    });
    return selectionMenuLeafHtml({
      className: `draft-tab draft-tab-menu-item${historyClass}${active}`,
      label: draft.title,
      shortLabel: draftNumber,
      preview,
      previewHtml,
      meta: formatVersionDate(draft.updatedAt || draft.createdAt),
      zoomKey,
      checked: Boolean(checked),
      disabled: Boolean(disabled),
      inputAriaLabel: displayLabel,
      inputAttributes: `data-display-draft-id="${draft.id}"`,
      buttonAriaLabel: draft.title,
      buttonAttributes: `data-draft-id="${draft.id}"`,
      outerAttributes: `data-draft-tab-id="${draft.id}"`,
      trailingHtml: deleteButton
    });
  }
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
}

function draftNestedGroupHtml(start, end, groupSize) {
  const groups = [];
  for (let groupStart = start; groupStart < end; groupStart += groupSize) {
    const groupEnd = Math.min(end, groupStart + groupSize);
    const key = `draft:nested:${groupStart}:${groupEnd}`;
    const selection = draftRangeSelectionState(groupStart, groupEnd);
    const isOpen = draftTabExpandedGroups.has(key);
    const inner = isOpen
      ? (groupSize <= 10
        ? state.drafts
          .slice(groupStart, groupEnd)
          .map((draft, offset) => draftTabHtml(draft, groupStart + offset, { menu: true }))
          .join("")
        : draftNestedGroupHtml(groupStart, groupEnd, Math.max(10, groupSize / 10)))
      : "";
    groups.push(selectionMenuRangeHtml({
      className: "draft-tab-nested-group",
      keyAttribute: "data-draft-tab-group-key",
      key,
      open: isOpen,
      partial: selection.indeterminate,
      checked: selection.checked,
      disabled: Boolean(versionHistoryDraftId),
      checkboxAriaLabel: `${showChanges ? "Compare" : "Display"} drafts ${groupStart + 1} to ${groupEnd}`,
      checkboxAttributes: `data-display-draft-group-start="${groupStart}" data-display-draft-group-end="${groupEnd}"`,
      label: `Drafts ${selectionRangeLabel(groupStart, groupEnd)}`,
      count: `${selection.included} of ${selection.total}`,
      dateRange: selectionDateRange(
        state.drafts[groupStart]?.createdAt,
        state.drafts[groupEnd - 1]?.createdAt
      ),
      contents: inner
    }));
  }
  return groups.join("");
}

function draftTopGroups() {
  const groupSize = largestSelectionGroupSize(state.drafts.length);
  const groups = [];
  for (let start = 0; start < state.drafts.length; start += groupSize) {
    const end = Math.min(state.drafts.length, start + groupSize);
    groups.push({
      key: `draft:top:${start}:${end}`,
      start,
      end,
      groupSize
    });
  }
  return groups;
}

function draftTopGroupHtml(group) {
  const { key, start, end } = group;
  const selection = draftRangeSelectionState(start, end);
  const checked = selection.checked ? " checked" : "";
  const activeIndex = draftIndexForId(
    versionHistoryDraftId
      ? parseDraftPageKey(activeVersionHistoryPageKey())?.draftId
      : selectedDraftId
  );
  const active = activeIndex >= start && activeIndex < end && (versionHistoryDraftId || activeArea !== "story");
  const isOpen = draftTabFilterOpen === key;
  return `
    <div class="selection-menu-trigger-shell draft-tab-group-shell${selection.indeterminate ? " is-partial" : ""}">
      <div class="page-tab selection-menu-trigger draft-group-tab${versionHistoryDraftId ? " history-tab" : ""}${active || isOpen ? " active" : ""}">
        <input
          type="checkbox"
          data-display-draft-group-start="${start}"
          data-display-draft-group-end="${end}"
          aria-label="${showChanges ? "Compare" : "Display"} drafts ${start + 1} to ${end}"
          ${checked}
          ${versionHistoryDraftId ? "disabled" : ""}
        >
        <button
          class="tab-label selection-menu-trigger-toggle draft-tab-range-toggle"
          type="button"
          data-draft-tab-filter-toggle="${escapeHtml(key)}"
          data-draft-tab-filter-start="${start}"
          data-draft-tab-filter-end="${end}"
          aria-haspopup="true"
          aria-expanded="${String(isOpen)}"
          aria-label="Choose drafts ${start + 1} to ${end}"
        >
          <span>${selectionRangeLabel(start, end)}</span>
        </button>
      </div>
    </div>
  `;
}

function draftOpenGroupMenuHtml(groups) {
  const group = groups.find(item => item.key === draftTabFilterOpen);
  if (!group) return "";

  const selection = draftRangeSelectionState(group.start, group.end);
  const choices = group.groupSize >= 100
    ? draftNestedGroupHtml(
      group.start,
      group.end,
      Math.max(10, group.groupSize / 10)
    )
    : state.drafts
      .slice(group.start, group.end)
      .map((draft, offset) => draftTabHtml(draft, group.start + offset, { menu: true }))
      .join("");
  const selected = selectedDraftDisplayCount();
  const action = showChanges ? "compared" : "displayed";

  return selectionMenuPopoverHtml({
    className: "draft-tab-group-menu",
    menuKey: group.key,
    ariaLabel: `Choose drafts ${group.start + 1} to ${group.end}`,
    title: `Drafts ${selectionRangeLabel(group.start, group.end)}`,
    description: `Choose the drafts you want ${action}.`,
    count: `${selection.included.toLocaleString("en-GB")} of ${selection.total.toLocaleString("en-GB")}`,
    dateRange: selectionDateRange(
      state.drafts[group.start]?.createdAt,
      state.drafts[group.end - 1]?.createdAt
    ),
    choicesClass: "draft-tab-group-choices",
    choicesAriaLabel: "Draft groups",
    choices,
    footer: `${selected.toLocaleString("en-GB")} of ${state.drafts.length.toLocaleString("en-GB")} drafts ${action}`
  });
}

function groupedDraftTabsHtml() {
  if (state.drafts.length <= 10) {
    draftTabFilterOpen = null;
    return state.drafts.map((draft, index) => draftTabHtml(draft, index)).join("");
  }

  const groups = draftTopGroups();
  if (draftTabFilterOpen && !groups.some(group => group.key === draftTabFilterOpen)) {
    draftTabFilterOpen = null;
  }
  return `${groups.map(draftTopGroupHtml).join("")}${draftOpenGroupMenuHtml(groups)}`;
}

function toggleDraftTabFilter(groupKey = null, open = null) {
  if (!state || state.drafts.length <= 10) return;
  if (historyVersionFilterOpen) {
    historyVersionFilterOpen = null;
    renderHistoryVersionFilter();
  }
  if (groupKey === false || open === false) {
    draftTabFilterOpen = null;
  } else if (typeof groupKey === "string" && groupKey) {
    draftTabFilterOpen = draftTabFilterOpen === groupKey ? null : groupKey;
  }
  renderDraftTabs();
}

function renderDraftTabs() {
  const menuScroll = selectionMenuScrollSnapshot(els.draftTabs, draftTabFilterOpen);
  const historyMode = Boolean(versionHistoryDraftId);
  const storyHistoryActive = activeVersionHistoryPageKey() === STORY_KEY;
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

  els.draftTabs.classList.toggle("is-grouped", state.drafts.length > 10);
  els.draftTabs.innerHTML = groupedDraftTabsHtml();
  els.draftTabs
    .querySelectorAll("[data-display-draft-group-start][data-display-draft-group-end]")
    .forEach(control => {
      const start = Number(control.dataset.displayDraftGroupStart);
      const end = Number(control.dataset.displayDraftGroupEnd);
      if (!Number.isInteger(start) || !Number.isInteger(end)) return;
      const selection = draftRangeSelectionState(start, end);
      control.checked = selection.checked;
      control.indeterminate = selection.indeterminate;
    });
  restoreSelectionMenuScroll(els.draftTabs, menuScroll);
  updateTabDensity();
  window.requestAnimationFrame(() => {
    restoreSelectionMenuScroll(els.draftTabs, menuScroll);
    positionOpenDraftTabGroupMenus();
  });
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

function positionOpenDraftTabGroupMenus() {
  if (!els.draftTabs) return;

  const menu = els.draftTabs.querySelector(":scope > .draft-tab-group-menu");
  const toggle = draftTabFilterOpen
    ? els.draftTabs.querySelector(
      `[data-draft-tab-filter-toggle="${cssEscape(draftTabFilterOpen)}"]`
    )
    : null;
  if (!toggle || !menu) return;

  const summaryRect = toggle.closest(".draft-group-tab")?.getBoundingClientRect() || toggle.getBoundingClientRect();
  const viewportPadding = 8;
  const preferredWidth = Math.min(600, window.innerWidth - 36);
  const width = Math.min(preferredWidth, window.innerWidth - (viewportPadding * 2));
  const left = Math.max(
    viewportPadding,
    Math.min(summaryRect.left, window.innerWidth - width - viewportPadding)
  );
  const top = Math.min(summaryRect.bottom + 7, window.innerHeight - viewportPadding);

  menu.style.left = `${Math.round(left)}px`;
  menu.style.right = "auto";
  menu.style.top = `${Math.round(top)}px`;
  menu.style.width = `${Math.round(width)}px`;
  menu.style.maxHeight = `${Math.max(
    120,
    Math.min(660, Math.round(window.innerHeight - top - viewportPadding))
  )}px`;
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
  const versionHistoryButton = parsedPageKey?.type === "content" || parsedPageKey?.type === "notes" || parsedPageKey?.type === "story"
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
    >
      <button
        class="page-width-resizer-handle"
        type="button"
        data-resize-page-before="${escapeHtml(beforeKey)}"
        data-resize-page-after="${escapeHtml(afterKey)}"
        role="separator"
        aria-orientation="vertical"
        aria-label="Resize page panels"
      ></button>
    </div>
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

function draftNotesVersionNumber(draft, index) {
  return `${draftShortNumber(draft)} notes ${index + 1}`;
}

function draftNotesVersionPage(draft, version, index) {
  const number = draftNotesVersionNumber(draft, index);
  const label = `Draft ${number}`;
  const notes = draft.notes || {};
  return {
    id: version.id,
    title: label,
    shortTitle: `Notes ${index + 1}`,
    createdAt: version.createdAt,
    updatedAt: version.createdAt,
    content: version.content || "",
    contentHtml: version.contentHtml || textToHtml(version.content || ""),
    format: normalizeFormat(version.format || notes.format)
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

function coalescedDraftNotesVersionRuns(draft) {
  const notes = draft?.notes;
  const title = notes?.title || `${draft?.title || "Untitled draft"} Notes`;
  const versions = ensurePageVersionHistory(notes, title);
  return coalescedVersionRuns(versions, (version, index) => draftNotesVersionPage(draft, version, index));
}

function coalescedProjectNotesVersionRuns() {
  const versions = ensureProjectNotesVersionHistory();
  return coalescedVersionRuns(versions, projectNotesVersionPage);
}

function versionCoalescedMetaHtml(count) {
  if (!(count > 1)) return "";
  return `<div class="version-coalesced">${Number(count).toLocaleString("en-GB")} autosaves coalesced</div>`;
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

function baseDraftNotesVersionPageHtml(draft, version, index) {
  const page = draftNotesVersionPage(draft, version, index);
  const versionLabel = draftNotesVersionNumber(draft, index);
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
          data-restore-draft-notes-id="${escapeHtml(draft.id)}"
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

function draftNotesVersionComparePageHtml(draft, version, index, previousVersion = null, previousIndex = index - 1, options = {}) {
  const page = draftNotesVersionPage(draft, version, index);
  if (!previousVersion) return baseDraftNotesVersionPageHtml(draft, version, index);

  const versionLabel = draftNotesVersionNumber(draft, index);
  const previousPage = draftNotesVersionPage(draft, previousVersion, previousIndex);
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
          data-restore-draft-notes-id="${escapeHtml(draft.id)}"
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
  const entries = includedHistoryVersionEntries(versions, draftContentKey(draft.id));
  const pages = entries.length
    ? [baseVersionPageHtml(draft, entries[0].version, entries[0].index)]
    : [];
  entries.slice(1).forEach((entry, position) => {
    const previous = entries[position];
    pages.push(versionComparePageHtml(
      draft,
      entry.version,
      entry.index,
      previous.version,
      previous.index
    ));
  });
  return compareStripHtml(pages, "version-history-strip");
}

function renderDraftNotesVersionHistoryStrip(draft) {
  const notesTitle = draft.notes?.title || `${draft.title || "Untitled draft"} Notes`;
  const versions = ensurePageVersionHistory(draft.notes, notesTitle);
  const entries = includedHistoryVersionEntries(versions, draftNotesKey(draft.id));
  const pages = entries.length
    ? [baseDraftNotesVersionPageHtml(draft, entries[0].version, entries[0].index)]
    : [];
  entries.slice(1).forEach((entry, position) => {
    const previous = entries[position];
    pages.push(draftNotesVersionComparePageHtml(
      draft,
      entry.version,
      entry.index,
      previous.version,
      previous.index
    ));
  });
  return compareStripHtml(pages, "version-history-strip");
}

function renderProjectNotesVersionHistoryStrip() {
  const versions = ensureProjectNotesVersionHistory();
  const entries = includedHistoryVersionEntries(versions, STORY_KEY);
  const pages = entries.length
    ? [baseProjectNotesVersionPageHtml(entries[0].version, entries[0].index)]
    : [];
  entries.slice(1).forEach((entry, position) => {
    const previous = entries[position];
    pages.push(projectNotesVersionComparePageHtml(
      entry.version,
      entry.index,
      previous.version,
      previous.index
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

function clearHistoryVirtualState() {
  if (historyVirtualScrollFrame !== null) {
    window.cancelAnimationFrame(historyVirtualScrollFrame);
    historyVirtualScrollFrame = null;
  }
  historyVirtualScrollSuppressed = false;
  historyVirtualState = null;
}

function historyVirtualWindowSize(virtualState) {
  const visiblePages = virtualState?.visiblePages || 1;
  return Math.min(
    virtualState?.entries?.length || 0,
    Math.max(
      HISTORY_VIRTUAL_MIN_PAGES,
      Math.min(HISTORY_VIRTUAL_MAX_PAGES, visiblePages * 4)
    )
  );
}

function historyVirtualWindowBounds(virtualState, focusPosition = 0) {
  const total = virtualState?.entries?.length || 0;
  const size = historyVirtualWindowSize(virtualState);
  if (!total || !size) return { start: 0, end: 0 };

  const focus = Math.max(0, Math.min(total - 1, Math.floor(Number(focusPosition) || 0)));
  let start = Math.max(0, focus - Math.floor(size / 2));
  if (start + size > total) start = Math.max(0, total - size);
  return { start, end: Math.min(total, start + size) };
}

function historyVirtualPageHtml(virtualState, position) {
  if (!virtualState || position < 0 || position >= virtualState.entries.length) return "";
  if (virtualState.pageHtmlCache.has(position)) {
    const cached = virtualState.pageHtmlCache.get(position);
    virtualState.pageHtmlCache.delete(position);
    virtualState.pageHtmlCache.set(position, cached);
    return cached;
  }

  const current = virtualState.entries[position];
  let html = "";
  if (position === 0) {
    html = virtualState.basePageHtml(current.version, current.index);
  } else {
    const previous = virtualState.entries[position - 1];
    html = virtualState.comparePageHtml({
      beforeVersion: previous.version,
      beforeIndex: previous.index,
      afterVersion: current.version,
      afterIndex: current.index
    });
  }

  const annotated = html.replace(
    "<article ",
    `<article data-history-position="${position}" `
  );
  virtualState.pageHtmlCache.set(position, annotated);
  while (virtualState.pageHtmlCache.size > HISTORY_VIRTUAL_CACHE_LIMIT) {
    const oldest = virtualState.pageHtmlCache.keys().next().value;
    virtualState.pageHtmlCache.delete(oldest);
  }
  return annotated;
}

function historyVirtualStripHtml(virtualState, bounds) {
  const total = virtualState.entries.length;
  const visiblePages = virtualState.visiblePages;
  const leftWidth = (bounds.start / visiblePages) * 100;
  const rightWidth = ((total - bounds.end) / visiblePages) * 100;
  const pages = [];
  for (let position = bounds.start; position < bounds.end; position += 1) {
    pages.push(historyVirtualPageHtml(virtualState, position));
  }

  return `
    <div
      class="compare-strip version-history-strip history-virtual-strip"
      data-history-total-pages="${total}"
      data-history-window-start="${bounds.start}"
      data-history-window-end="${bounds.end}"
      style="--compare-visible-pages: ${visiblePages}; --compare-gap-total: 0px;"
    >
      <div class="history-virtual-spacer" aria-hidden="true" style="flex-basis: ${leftWidth}%;"></div>
      ${pages.join("")}
      <div class="history-virtual-spacer" aria-hidden="true" style="flex-basis: ${rightWidth}%;"></div>
    </div>
  `;
}

function captureHistoryVirtualPageScrollPositions(virtualState) {
  if (!virtualState?.pageScrollPositions) return;
  els.diffOutput.querySelectorAll("[data-history-position]").forEach(page => {
    const position = Number(page.dataset.historyPosition);
    const body = page.querySelector(".compare-page-body");
    if (!Number.isInteger(position) || !body) return;
    virtualState.pageScrollPositions.set(position, {
      top: body.scrollTop,
      left: body.scrollLeft
    });
  });
}

function restoreHistoryVirtualPageScrollPositions(virtualState) {
  if (!virtualState?.pageScrollPositions) return;
  els.diffOutput.querySelectorAll("[data-history-position]").forEach(page => {
    const position = Number(page.dataset.historyPosition);
    const body = page.querySelector(".compare-page-body");
    const saved = virtualState.pageScrollPositions.get(position);
    if (!body || !saved) return;
    body.scrollTop = saved.top;
    body.scrollLeft = saved.left;
  });
}

function renderHistoryVirtualWindow(virtualState, focusPosition, options = {}) {
  if (
    !virtualState ||
    historyVirtualState !== virtualState ||
    !diffRenderIsCurrent(virtualState.token)
  ) {
    return false;
  }

  const bounds = historyVirtualWindowBounds(virtualState, focusPosition);
  const unchanged = bounds.start === virtualState.start && bounds.end === virtualState.end;
  const previousScrollLeft = els.diffOutput.scrollLeft;

  if (!unchanged || options.force) {
    historyVirtualScrollSuppressed = true;
    captureHistoryVirtualPageScrollPositions(virtualState);
    els.diffOutput.innerHTML = historyVirtualStripHtml(virtualState, bounds);
    virtualState.start = bounds.start;
    virtualState.end = bounds.end;
    restoreHistoryVirtualPageScrollPositions(virtualState);
  }

  const hasTargetPosition = options.targetPosition !== undefined && options.targetPosition !== null;
  const targetPosition = hasTargetPosition ? Number(options.targetPosition) : null;
  const targetScrollLeft = Number.isInteger(targetPosition)
    ? (targetPosition * els.diffOutput.clientWidth) / virtualState.visiblePages
    : previousScrollLeft;
  els.diffOutput.scrollLeft = Math.max(0, targetScrollLeft);

  window.requestAnimationFrame(() => {
    historyVirtualScrollSuppressed = false;
    updateCompactTitleLabels(els.diffOutput);
    refreshVisibleVersionHistorySearchHighlights();
    scheduleHistoryVirtualWindowUpdate();
  });
  return true;
}

function ensureHistoryVirtualPosition(position, options = {}) {
  const virtualState = historyVirtualState;
  const target = Number(position);
  if (
    !virtualState ||
    !Number.isInteger(target) ||
    target < 0 ||
    target >= virtualState.entries.length
  ) {
    return null;
  }

  const isMounted = target >= virtualState.start && target < virtualState.end;
  if (!isMounted) {
    renderHistoryVirtualWindow(virtualState, target, {
      force: true,
      targetPosition: options.scroll === false ? null : target
    });
  } else if (options.scroll !== false) {
    const targetLeft = (target * els.diffOutput.clientWidth) / virtualState.visiblePages;
    els.diffOutput.scrollLeft = Math.max(0, targetLeft);
  }

  return els.diffOutput.querySelector(`[data-history-position="${target}"]`);
}

function updateHistoryVirtualWindowFromScroll() {
  historyVirtualScrollFrame = null;
  const virtualState = historyVirtualState;
  if (
    historyVirtualScrollSuppressed ||
    !virtualState ||
    historyVirtualState !== virtualState ||
    !diffRenderIsCurrent(virtualState.token) ||
    !els.diffOutput.clientWidth
  ) {
    return;
  }

  const pageWidth = els.diffOutput.clientWidth / virtualState.visiblePages;
  const firstVisible = Math.max(
    0,
    Math.min(
      virtualState.entries.length - 1,
      Math.floor(els.diffOutput.scrollLeft / Math.max(1, pageWidth))
    )
  );
  const rightVisible = firstVisible + virtualState.visiblePages;
  const mountedPageCount = virtualState.end - virtualState.start;
  const sparePageCount = Math.max(0, mountedPageCount - virtualState.visiblePages);
  const bufferPageCount = Math.max(1, Math.floor(sparePageCount / 3));
  const needsWindowUpdate = (
    firstVisible < virtualState.start ||
    rightVisible > virtualState.end ||
    (
      virtualState.start > 0 &&
      firstVisible < virtualState.start + bufferPageCount
    ) ||
    (
      virtualState.end < virtualState.entries.length &&
      rightVisible > virtualState.end - bufferPageCount
    )
  );
  if (!needsWindowUpdate) return;

  const focusPosition = firstVisible + Math.floor(virtualState.visiblePages / 2);
  const nextBounds = historyVirtualWindowBounds(virtualState, focusPosition);
  if (nextBounds.start === virtualState.start && nextBounds.end === virtualState.end) return;

  renderHistoryVirtualWindow(
    virtualState,
    focusPosition
  );
}

function scheduleHistoryVirtualWindowUpdate() {
  if (historyVirtualScrollFrame !== null || historyVirtualScrollSuppressed) return;
  historyVirtualScrollFrame = window.requestAnimationFrame(updateHistoryVirtualWindowFromScroll);
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

function versionHistoryViewDidRender() {
  renderHistoryVersionFilter();
  if (!searchState.open) return;
  window.requestAnimationFrame(() => refreshSearchResults({ allowRender: false }));
}

function renderDiff() {
  diffRenderToken += 1;
  const compareKicker = els.changesPanel?.querySelector(".compare-kicker");
  if (versionHistoryDraftId) {
    renderDiffSoon("Loading version history");
    return;
  }

  clearHistoryVirtualState();
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
  return nextUiFrame(DIFF_PROGRESS_FRAME_DELAY_MS);
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
    pageKey,
    entries,
    basePageHtml,
    comparePageHtml,
    versionLabel,
    emptyHtml = `<p class="empty-state">No versions are currently included.</p>`
  } = options;
  const total = entries.length;

  if (!total) {
    if (diffRenderIsCurrent(token)) {
      clearHistoryVirtualState();
      els.diffOutput.innerHTML = emptyHtml;
      versionHistoryViewDidRender();
    }
    return;
  }

  historyVirtualRevision += 1;
  const virtualState = {
    token,
    revision: historyVirtualRevision,
    pageKey,
    entries,
    basePageHtml,
    comparePageHtml,
    versionLabel,
    visiblePages: compareVisiblePageCount(total),
    start: -1,
    end: -1,
    pageHtmlCache: new Map(),
    pageScrollPositions: new Map()
  };
  clearHistoryVirtualState();
  historyVirtualState = virtualState;
  const initialBounds = historyVirtualWindowBounds(virtualState, 0);
  const initialTotal = initialBounds.end - initialBounds.start;
  const renderProgress = (completed, detail) => {
    if (!diffRenderIsCurrent(token)) return;
    renderDiffLoading({
      label,
      completed,
      total: initialTotal,
      unit: "visible history page",
      verb: "prepared",
      meta: `${completed.toLocaleString("en-GB")} of ${initialTotal.toLocaleString("en-GB")} visible history pages prepared`,
      detail
    });
  };

  renderProgress(0, `Opening ${total.toLocaleString("en-GB")} included versions`);
  await nextDiffProgressFrame();
  if (!diffRenderIsCurrent(token) || historyVirtualState !== virtualState) return;

  for (let position = initialBounds.start; position < initialBounds.end; position += 1) {
    if (!diffRenderIsCurrent(token) || historyVirtualState !== virtualState) return;
    historyVirtualPageHtml(virtualState, position);
    const completed = position - initialBounds.start + 1;
    const nextPosition = position + 1;
    renderProgress(completed, nextPosition < initialBounds.end
      ? `Preparing ${versionLabel(entries[nextPosition].index)}`
      : "Opening history view");
    if (completed % 2 === 0 || completed === initialTotal) {
      await nextDiffProgressFrame();
    }
  }

  if (!diffRenderIsCurrent(token) || historyVirtualState !== virtualState) return;
  renderHistoryVirtualWindow(virtualState, 0, {
    force: true,
    targetPosition: 0
  });
  versionHistoryViewDidRender();
}

function renderDraftVersionHistoryProgressively(draft, token, label) {
  const versions = ensureDraftVersionHistory(draft);
  return renderVersionHistoryStripProgressively({
    token,
    label,
    pageKey: draftContentKey(draft.id),
    entries: includedHistoryVersionEntries(versions, draftContentKey(draft.id)),
    basePageHtml: (version, index) => baseVersionPageHtml(draft, version, index),
    comparePageHtml: run => versionComparePageHtml(
      draft,
      run.afterVersion,
      run.afterIndex,
      run.beforeVersion,
      run.beforeIndex
    ),
    versionLabel: index => `Draft ${draftVersionNumber(draft, index)}`
  });
}

function renderDraftNotesVersionHistoryProgressively(draft, token, label) {
  const notesTitle = draft.notes?.title || `${draft.title || "Untitled draft"} Notes`;
  const versions = ensurePageVersionHistory(draft.notes, notesTitle);
  return renderVersionHistoryStripProgressively({
    token,
    label,
    pageKey: draftNotesKey(draft.id),
    entries: includedHistoryVersionEntries(versions, draftNotesKey(draft.id)),
    basePageHtml: (version, index) => baseDraftNotesVersionPageHtml(draft, version, index),
    comparePageHtml: run => draftNotesVersionComparePageHtml(
      draft,
      run.afterVersion,
      run.afterIndex,
      run.beforeVersion,
      run.beforeIndex
    ),
    versionLabel: index => `Draft ${draftNotesVersionNumber(draft, index)}`
  });
}

function renderProjectNotesVersionHistoryProgressively(token, label) {
  const versions = ensureProjectNotesVersionHistory();
  return renderVersionHistoryStripProgressively({
    token,
    label,
    pageKey: STORY_KEY,
    entries: includedHistoryVersionEntries(versions, STORY_KEY),
    basePageHtml: baseProjectNotesVersionPageHtml,
    comparePageHtml: run => projectNotesVersionComparePageHtml(
      run.afterVersion,
      run.afterIndex,
      run.beforeVersion,
      run.beforeIndex
    ),
    versionLabel: index => `Project notes ${projectNotesVersionNumber(index)}`
  });
}

async function renderDiffProgressively(token, label = "Loading changes") {
  const compareKicker = els.changesPanel?.querySelector(".compare-kicker");
  if (versionHistoryDraftId) {
    const pageKey = activeVersionHistoryPageKey();
    if (compareKicker) compareKicker.textContent = "VERSION HISTORY";
    const historyLabel = label || "Loading version history";

    if (pageKey === STORY_KEY) {
      els.compareSubtitle.textContent = "Version history for Project notes";
      await renderProjectNotesVersionHistoryProgressively(token, historyLabel);
      return;
    }

    const parsed = parseDraftPageKey(pageKey);
    const draft = draftById(parsed?.draftId);
    const isNotes = parsed?.type === "notes";
    els.compareSubtitle.textContent = draft
      ? `Version history for ${isNotes ? `${draft.title} notes` : draft.title}`
      : "Version history";
    if (!draft) {
      if (diffRenderIsCurrent(token)) {
        els.diffOutput.innerHTML = `<p class="empty-state">Draft not found.</p>`;
        versionHistoryViewDidRender();
      }
      return;
    }

    if (isNotes) await renderDraftNotesVersionHistoryProgressively(draft, token, historyLabel);
    else await renderDraftVersionHistoryProgressively(draft, token, historyLabel);
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
  if (versionHistoryDraftId) {
    renderHistoryVersionFilter();
  } else if (els.historyVersionFilter) {
    historyVersionFilterOpen = null;
    els.historyVersionFilter.hidden = true;
    els.historyVersionFilter.innerHTML = "";
  }
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
  versionHistoryDraftId = null;
  historyVersionFilterOpen = null;
  historyVersionExclusions = new Map();
  historyVersionExpandedGroups = new Set();
  draftTabFilterOpen = null;
  draftTabExpandedGroups = new Set();
  selectionMenuZoomPages = new Map();
  hasStoredDisplaySelection = true;
  displayedPageKeys = new Set(defaultDisplayKeys());
  collapsedNotesIds = new Set();
  notesPanePercents = {};
  pagePanePercents = {};
  pagesOnScreen = DEFAULT_PAGES_ON_SCREEN;
  els.compareMode.value = "consecutive";
  saveCurrentViewState();
  setPagesOnScreen(pagesOnScreen);
}

function isAbortError(error) {
  return error?.name === "AbortError";
}

function readableSaveFailure(message = "") {
  const text = String(message || "");
  if (/^project saved locally$/i.test(text) || /^saved locally; linked text file blocked$/i.test(text)) {
    return LINKED_TEXT_BLOCKED_STATUS;
  }
  if (/^save failed:\s*/i.test(text)) {
    return text.replace(/^save failed:\s*/i, "Save failed: ");
  }
  if (/linked text file write failed/i.test(text)) {
    return LINKED_TEXT_BLOCKED_STATUS;
  }
  if (/EACCES|EPERM|access is denied|denied/i.test(text)) {
    return "Save failed: access denied";
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

function readableUsbExportFailure(message = "") {
  const text = String(message || "");
  if (/EACCES|EPERM|access is denied|denied/i.test(text)) {
    return "USB export failed: access denied";
  }
  if (/Failed to fetch|NetworkError|Load failed/i.test(text)) {
    return "USB export failed: local server unavailable";
  }
  if (/request body is too large|REQUEST_BODY_TOO_LARGE|413/i.test(text)) {
    return "USB export failed: project data is too large";
  }
  if (/backup folder missing/i.test(text)) {
    return "USB export failed: backup folder missing";
  }
  return text ? `USB export failed: ${text.slice(0, 90)}` : "USB export failed";
}

function readableBackupFolderFailure(message = "") {
  const text = String(message || "");
  if (/EACCES|EPERM|access is denied|denied/i.test(text)) {
    return "Backup folder failed: access denied";
  }
  if (/Failed to fetch|NetworkError|Load failed/i.test(text)) {
    return "Backup folder failed: local server unavailable";
  }
  return text ? `Backup folder failed: ${text.slice(0, 90)}` : "Backup and version history folder failed";
}

function assertBackupFolderPayload(payload) {
  if (payload?.ok === false && !payload.cancelled) {
    throw new Error(payload.error || payload.message || "Backup folder operation failed");
  }
  return payload;
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
  if (isLinkedTextBlockedStatus(message)) {
    isSaving = false;
    saveRetryCount = 0;
    setStatus(message);
    return;
  }
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
  if (Object.prototype.hasOwnProperty.call(payload, "linkedTextFileMissing")) {
    linkedTextFileMissing = Boolean(payload.linkedTextFileMissing);
  }
  if (Object.prototype.hasOwnProperty.call(payload, "linkedTextMissingPath")) {
    linkedTextMissingPath = payload.linkedTextMissingPath || "";
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
        fileName: options.fileName || projectFileName || "draft-history.txt",
        keepCurrentPages: Boolean(options.keepCurrentPages)
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

async function activateLinkedTextFile(filePath) {
  const body = JSON.stringify({ filePath });
  let payload = null;

  try {
    const response = await fetch("/api/text-file-link/activate", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body
    });
    if (!response.ok) throw new Error(await response.text());
    payload = await response.json();
  } catch (error) {
    if (!window.draftDiffDesktop?.activateTextFileLink) throw error;
    payload = await window.draftDiffDesktop.activateTextFileLink(body);
  }

  if (!payload || payload.ok === false) {
    throw new Error(payload?.error || "Could not link the selected text file.");
  }

  updateStoragePathsFromPayload(payload);
  linkedTextPath = payload.linkedTextPath || payload.filePath || filePath;
  return payload;
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

    await selectVersionHistoryFolder({ recoverMissingFolder: true });
  } finally {
    isPromptingForBackupFolder = false;
  }
}

async function promptForMissingLinkedTextFile(options = {}) {
  if (!linkedTextFileMissing || isPromptingForLinkedTextFile) return false;
  isPromptingForLinkedTextFile = true;

  try {
    const missingPath = linkedTextMissingPath || linkedTextPath || "the linked story file";
    const chooseNow = window.confirm(
      `Story file not found:\n\n${missingPath}\n\nChoose the moved story file now?`
    );
    if (!chooseNow) {
      const markDeleted = window.confirm(
        `Was this local story file deliberately deleted?\n\n${missingPath}\n\nChoose OK to record that this computer no longer has the story file. Choose Cancel to leave it marked as temporarily missing.`
      );
      await fetch("/api/story-registry/status", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          storyId: state?.storyId || "",
          filePath: missingPath,
          status: markDeleted ? "retired" : "missing"
        })
      });
      if (markDeleted) {
        await clearLinkedTextFile();
        linkedTextFileMissing = false;
        linkedTextMissingPath = "";
        setStatus("Local story file recorded as deleted; its identity and saved history were retained");
      } else {
        setStatus("Story file left marked as temporarily missing");
      }
      return false;
    }

    const previousLinkedTextPath = linkedTextPath;
    const preserveState = options.preserveFormatsFrom
      || projectStateFromSnapshot(serializeProjectState());
    try {
      await showAppProgress({
        title: "Opening moved file",
        step: "Choose the moved story file...",
        completed: 0,
        total: 5
      });
      const payload = await requestOpenTextFilePayload();
      if (!payload || payload.cancelled) {
        setStatus("Story file still missing");
        return false;
      }
      if (payload.ok === false) throw new Error(payload.error || "Open failed");

      const stateBeforeMove = await prepareCurrentProjectForOpen({
        skipLinkedTextFileWrite: true
      });
      await applyOpenedTextFilePayload(payload, previousLinkedTextPath, stateBeforeMove, {
        preserveFormatsFrom: stateBeforeMove || preserveState,
        showProgress: true,
        progressTitle: "Opening moved file",
        progressOffset: 1,
        progressTotal: 5
      });
      return true;
    } finally {
      hideAppProgress();
    }
  } finally {
    isPromptingForLinkedTextFile = false;
  }
}

async function applyTextProject(text, fileName, options = {}) {
  const progressTitle = options.progressTitle || "Opening file";
  const progressTotal = Number(options.progressTotal || 0);
  const progressOffset = Number(options.progressOffset || 0);
  const progressEnabled = Boolean(options.showProgress || appProgressIsVisible());
  const reportProgress = async (stepIndex, step, detail = "") => {
    if (!progressEnabled) return;
    await updateAppProgressFrame({
      title: progressTitle,
      step,
      detail,
      completed: progressOffset + stepIndex,
      total: progressTotal || progressOffset + 4
    });
  };

  await reportProgress(0, "Parsing text file...", fileName || "");
  const keepImportedPagesCurrent = options.keepImportedPagesCurrent !== false;
  const importedState = stateFromExportText(text, options.preserveFormatsFrom || null, {
    preserveIdentity: Boolean(options.preserveIdentity),
    preserveHistory: Boolean(options.preserveHistory),
    promoteHistoryPages: !keepImportedPagesCurrent
  });
  if (options.activateLinkedTextFile && options.filePath) {
    await activateLinkedTextFile(options.filePath);
  } else if (options.clearLinkedTextFile) {
    await clearLinkedTextFile();
  }
  state = importedState;
  await reportProgress(1, "Loading saved versions...", fileName || "");
  const historyResult = await applyExternalVersionHistory(state, {
    filePath: options.filePath || "",
    fileName,
    keepCurrentPages: keepImportedPagesCurrent
  });
  state = historyResult.state;
  await reportProgress(2, "Rendering drafts...", `${state.drafts.length.toLocaleString("en-GB")} draft${state.drafts.length === 1 ? "" : "s"}`);
  markStateChanged();
  saveQueued = false;
  editorSelections = {};
  projectFileName = fileName || "draft-history.txt";
  updateProjectTitle();
  restoreViewStateForProject();
  render();
  await reportProgress(3, "Saving imported project...", projectFileName);
  const savedToLinkedFile = await saveNow({
    skipInputSync: true,
    skipLinkedTextFileWrite: Boolean(options.skipLinkedTextFileWrite)
  });
  if (options.requireSaveSuccess && !savedToLinkedFile) {
    throw new Error("The imported project could not be saved.");
  }
  resetHistory();
  const historyText = historyResult.loaded ? "; version history loaded" : "";
  setStatus(savedToLinkedFile ? `Opened ${projectFileName}${historyText}; autosave linked` : `Opened${historyText}; saved companion`);
  await reportProgress(4, "Open complete", projectFileName);
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
    const body = JSON.stringify({
      state: stateToSave,
      fileName: fileNameToSuggest
    });
    let payload = null;
    if (window.draftDiffDesktop?.saveAsTextFile) {
      payload = await window.draftDiffDesktop.saveAsTextFile(body);
    } else {
      const response = await fetch("/api/save-as-text-file", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body
      });

      if (!response.ok) {
        const failure = await response.json().catch(() => ({}));
        throw new Error(failure.error || "Save as failed.");
      }

      payload = await response.json();
    }
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

  els.fileOpenRecentMenu.innerHTML = files.map(file => {
    const missing = file.exists === false;
    const filePath = file.filePath || "";
    const fileName = file.fileName || recentFileLabel(filePath);
    const title = missing ? `Missing: ${filePath}` : filePath;
    return `
    <button class="recent-file-button" type="button" data-recent-file-path="${escapeHtml(filePath)}" title="${escapeHtml(title)}">
      <span class="menu-check" aria-hidden="true"></span>
      <span class="recent-file-text">
        <span class="recent-file-name">${escapeHtml(fileName)}${missing ? " <span aria-hidden=\"true\">(missing)</span>" : ""}</span>
        <span class="recent-file-path">${escapeHtml(recentFileDirectory(filePath))}</span>
      </span>
      <span class="menu-shortcut" aria-hidden="true"></span>
    </button>
  `;
  }).join("");
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

async function beginTextProjectOpen() {
  if (isOpeningTextProject) return null;

  const session = {
    hadFullSave: Boolean(saveTimer) || saveQueued,
    hadPageSave: Boolean(pageSaveTimer) || pendingPageSaveKeys.size > 0,
    capturedVersion: false
  };
  isOpeningTextProject = true;
  window.clearTimeout(saveTimer);
  saveTimer = null;
  window.clearTimeout(pageSaveTimer);
  pageSaveTimer = null;

  const startedAt = Date.now();
  while (isSaving && Date.now() - startedAt < 30_000) {
    await new Promise(resolve => window.setTimeout(resolve, 25));
  }
  if (isSaving) {
    finishTextProjectOpen(session, { resume: true });
    throw new Error("The current save did not finish before opening the file.");
  }

  window.clearTimeout(saveTimer);
  saveTimer = null;
  window.clearTimeout(pageSaveTimer);
  pageSaveTimer = null;
  saveQueued = false;
  syncFromInputs();
  saveCurrentViewState();
  session.capturedVersion = flushDraftVersionCaptures().length > 0;
  rememberLinkedProjectState();
  return session;
}

function finishTextProjectOpen(session, options = {}) {
  if (!session) return;

  const queuedDuringOpen = saveQueued;
  saveQueued = false;
  window.clearTimeout(saveTimer);
  saveTimer = null;
  window.clearTimeout(pageSaveTimer);
  pageSaveTimer = null;
  isOpeningTextProject = false;

  if (options.completed) {
    clearPendingPageSaves();
    return;
  }
  if (options.resume === false) return;

  if (session.hadFullSave || session.capturedVersion || queuedDuringOpen) {
    queueSave(0);
  } else if (session.hadPageSave || pendingPageSaveKeys.size) {
    queuePendingPageSaves(0);
  }
}

async function prepareCurrentProjectForOpen(options = {}) {
  if (!state) return null;

  syncFromInputs();
  saveCurrentViewState();
  rememberLinkedProjectState();
  await cacheLinkedProjectStateOnServer();
  window.clearTimeout(saveTimer);
  saveTimer = null;
  window.clearTimeout(pageSaveTimer);
  pageSaveTimer = null;
  await saveNow({
    promptForMissingLinkedTextFile: false,
    skipLinkedTextFileWrite: Boolean(options.skipLinkedTextFileWrite)
  });
  setStatus("Saving backup...");
  await writeProjectBackupNow({
    allowLinkedTextFileFailure: true,
    skipLinkedTextFileWrite: Boolean(options.skipLinkedTextFileWrite)
  });
  return projectStateFromSnapshot(serializeProjectState());
}

async function applyOpenedTextFilePayload(payload, previousLinkedTextPath = "", previousState = null, options = {}) {
  const openedTextPath = payload.filePath || "";
  const storedState = cachedProjectStateForPath(openedTextPath) || payload.storedState;
  const sameFile = payload.matchesLinkedTextFile === true
    || filePathsMatch(previousLinkedTextPath, openedTextPath);
  const sameFilePreviousState = sameFile ? previousState : null;
  const identityState = options.preserveFormatsFrom || sameFilePreviousState || storedState || null;
  await applyTextProject(payload.text || "", payload.fileName || "draft-history.txt", {
    preserveFormatsFrom: identityState,
    preserveIdentity: Boolean(identityState),
    preserveHistory: Boolean(identityState),
    filePath: openedTextPath,
    activateLinkedTextFile: Boolean(openedTextPath),
    skipLinkedTextFileWrite: true,
    requireSaveSuccess: Boolean(openedTextPath),
    showProgress: Boolean(options.showProgress),
    progressTitle: options.progressTitle,
    progressTotal: options.progressTotal,
    progressOffset: options.progressOffset
  });
}

async function requestOpenTextFilePayload() {
  const failures = [];

  if (window.draftDiffDesktop?.openTextFile) {
    try {
      return await window.draftDiffDesktop.openTextFile();
    } catch (error) {
      failures.push(error?.message || "desktop dialog failed");
    }
  }

  try {
    const response = await fetch("/api/open-text-file", { method: "POST" });
    if (response.ok) return response.json();
    failures.push(await response.text());
  } catch (error) {
    failures.push(error?.message || "server dialog failed");
  }

  if (els.fileOpenInput) {
    setStatus("Native open failed; using browser file picker...");
    els.fileOpenInput.click();
    return null;
  }

  throw new Error(failures.filter(Boolean).join(" / ") || "No open dialog is available.");
}

async function openTextProject() {
  closeFileMenu();

  let openSession = null;
  let selectedFileRead = false;
  let completed = false;
  try {
    openSession = await beginTextProjectOpen();
    if (!openSession) return;
    const previousLinkedTextPath = linkedTextPath;
    await showAppProgress({
      title: "Opening file",
      step: "Choose a text file...",
      completed: 0,
      total: 6
    });
    const payload = await requestOpenTextFilePayload();

    if (payload) {
      if (payload.cancelled) return;
      if (payload.ok === false) throw new Error(payload.error || "Open failed");
      selectedFileRead = true;

      await showAppProgress({
        title: "Opening file",
        step: "Preserving current project...",
        detail: payload.fileName || "",
        completed: 1,
        total: 6
      });
      const selectedFileIsLinked = payload.matchesLinkedTextFile === true
        || filePathsMatch(previousLinkedTextPath, payload.filePath);
      const previousState = await prepareCurrentProjectForOpen({
        skipLinkedTextFileWrite: selectedFileIsLinked
      });
      await applyOpenedTextFilePayload(payload, previousLinkedTextPath, previousState, {
        showProgress: true,
        progressTitle: "Opening file",
        progressOffset: 2,
        progressTotal: 6
      });
      completed = true;
      return;
    }
    browserFileOpenSession = openSession;
    openSession = null;
  } catch (error) {
    if (isAbortError(error)) return;
    console.error(error);
    setStatus(`Open failed: ${error?.message || "Unknown error"}`);
  } finally {
    finishTextProjectOpen(openSession, {
      completed,
      resume: !selectedFileRead
    });
    hideAppProgress();
  }
}

async function recentOpenErrorFromResponse(response) {
  try {
    const payload = await response.json();
    const error = new Error(payload.error || response.statusText || "Recent file not found");
    error.code = payload.code || null;
    error.filePath = payload.filePath || "";
    return error;
  } catch {
    return new Error(response.statusText || `HTTP ${response.status}`);
  }
}

function isMissingRecentFileError(error) {
  return error?.code === "LINKED_TEXT_FILE_MISSING"
    || /recent file no longer exists|recent file not found/i.test(String(error?.message || ""));
}

async function promptForMovedRecentTextFile(missingPath, previousLinkedTextPath, previousState, options = {}) {
  const chooseNow = window.confirm(
    `Recent file not found:\n\n${missingPath}\n\nChoose the moved story file now?`
  );
  if (!chooseNow) {
    const markDeleted = window.confirm(
      `Was this local story file deliberately deleted?\n\n${missingPath}\n\nChoose OK to retain its identity as a deleted story. Choose Cancel to leave it marked as temporarily missing.`
    );
    await fetch("/api/story-registry/status", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        storyId: cachedProjectStateForPath(missingPath)?.storyId || "",
        filePath: missingPath,
        status: markDeleted ? "retired" : "missing"
      })
    });
    setStatus(markDeleted ? "Story recorded as deleted" : "Story left marked as temporarily missing");
    return false;
  }

  try {
    await showAppProgress({
      title: "Opening moved file",
      step: "Choose the moved text file...",
      completed: 0,
      total: 5
    });
    const payload = await requestOpenTextFilePayload();
    if (!payload || payload.cancelled) {
      setStatus("Open recent cancelled");
      return false;
    }
    if (payload.ok === false) throw new Error(payload.error || "Open failed");
    options.onSelected?.();

    const stateBeforeMove = previousState || await prepareCurrentProjectForOpen({
      skipLinkedTextFileWrite: filePathsMatch(previousLinkedTextPath, missingPath)
    });
    const cachedState = cachedProjectStateForPath(missingPath);
    await applyOpenedTextFilePayload(payload, previousLinkedTextPath, stateBeforeMove, {
      preserveFormatsFrom: cachedState || stateBeforeMove,
      showProgress: true,
      progressTitle: "Opening moved file",
      progressOffset: 1,
      progressTotal: 5
    });
    return true;
  } finally {
    hideAppProgress();
  }
}

async function openRecentTextProject(filePath) {
  closeFileMenu();

  let openSession = null;
  let selectedFileRead = false;
  let completed = false;
  let previousLinkedTextPath = linkedTextPath;
  let previousState = null;
  try {
    openSession = await beginTextProjectOpen();
    if (!openSession) return;
    previousLinkedTextPath = linkedTextPath;
    await showAppProgress({
      title: "Opening recent file",
      step: "Reading recent file...",
      detail: recentFileLabel(filePath),
      completed: 0,
      total: 6
    });
    const body = JSON.stringify({ filePath });
    let payload;
    try {
      const response = await fetch("/api/open-recent-text-file", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body
      });
      if (!response.ok) throw await recentOpenErrorFromResponse(response);
      payload = await response.json();
    } catch (error) {
      if (!window.draftDiffDesktop?.openRecentTextFile) throw error;
      payload = await window.draftDiffDesktop.openRecentTextFile(body);
      if (payload?.ok === false) {
        const failure = new Error(payload.error || "Recent file not found");
        failure.code = payload.code || null;
        failure.filePath = payload.filePath || "";
        throw failure;
      }
    }
    selectedFileRead = true;

    await showAppProgress({
      title: "Opening recent file",
      step: "Preserving current project...",
      detail: payload.fileName || recentFileLabel(filePath),
      completed: 1,
      total: 6
    });
    const selectedFileIsLinked = payload.matchesLinkedTextFile === true
      || filePathsMatch(previousLinkedTextPath, payload.filePath);
    previousState = await prepareCurrentProjectForOpen({
      skipLinkedTextFileWrite: selectedFileIsLinked
    });
    await applyOpenedTextFilePayload(payload, previousLinkedTextPath, previousState, {
      showProgress: true,
      progressTitle: "Opening recent file",
      progressOffset: 2,
      progressTotal: 6
    });
    completed = true;
  } catch (error) {
    if (isAbortError(error)) return;
    if (isMissingRecentFileError(error)) {
      hideAppProgress();
      try {
        completed = await promptForMovedRecentTextFile(
          error.filePath || filePath,
          previousLinkedTextPath,
          previousState,
          {
            onSelected: () => {
              selectedFileRead = true;
            }
          }
        );
      } catch (promptError) {
        if (isAbortError(promptError)) return;
        console.error(promptError);
        setStatus("Open recent failed");
      }
      return;
    }
    console.error(error);
    setStatus("Open recent failed");
  } finally {
    finishTextProjectOpen(openSession, {
      completed,
      resume: !selectedFileRead
    });
    hideAppProgress();
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

async function selectVersionHistoryFolder(options = {}) {
  closeFileMenu();

  try {
    if (!state) return;
    syncFromInputs();
    saveCurrentViewState();
    flushDraftVersionCaptures();
    rememberLinkedProjectState();
    window.clearTimeout(saveTimer);
    setStatus("Choose a backup and version history folder...");

    const body = JSON.stringify({
      state,
      filePath: linkedTextPath,
      fileName: projectFileName,
      recoverMissingFolder: Boolean(options.recoverMissingFolder || backupFolderMissing)
    });
    let payload = null;
    try {
      const response = await fetch("/api/version-history-folder/select", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body
      });
      if (!response.ok) throw new Error(await response.text());
      payload = await response.json();
    } catch (error) {
      if (!window.draftDiffDesktop?.selectVersionHistoryFolder) throw error;
      payload = assertBackupFolderPayload(await window.draftDiffDesktop.selectVersionHistoryFolder(body));
    }
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
    const inventory = payload.folderCheck?.folderInventory || {};
    const inventoryText = (() => {
      if (!payload.recoverMissingFolder) return "";
      const invalid = Number(inventory.invalidJsonCount || 0);
      const checked = Number(inventory.versionHistoryJsonCount || 0);
      if (invalid > 0) return `; ${invalid} unreadable history JSON file${invalid === 1 ? "" : "s"}`;
      return `; checked ${checked} history JSON file${checked === 1 ? "" : "s"}`;
    })();
    const migratedText = Number(payload.migratedCount) > 0
      ? `; migrated ${payload.migratedCount} history file${Number(payload.migratedCount) === 1 ? "" : "s"}`
      : "";
    setStatus(`Backup and version history folder set${migratedText}${loadedText}${inventoryText}`);
  } catch (error) {
    if (isAbortError(error)) return;
    console.error(error);
    setStatus(readableBackupFolderFailure(error?.message));
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
      let payload = null;
      try {
        const response = await fetch("/api/backup/deactivate", { method: "POST" });
        if (!response.ok) throw new Error(await response.text());
        payload = await response.json();
      } catch (error) {
        if (!window.draftDiffDesktop?.deactivateBackup) throw error;
        payload = assertBackupFolderPayload(await window.draftDiffDesktop.deactivateBackup());
      }
      updateStoragePathsFromPayload(payload);
      setStatus("Backup deactivated");
      return;
    }

    setStatus("Choose a backup and version history folder...");
    let payload = null;
    try {
      const response = await fetch("/api/backup/activate", { method: "POST" });
      if (!response.ok) throw new Error(await response.text());
      payload = await response.json();
    } catch (error) {
      if (!window.draftDiffDesktop?.activateBackup) throw error;
      payload = assertBackupFolderPayload(await window.draftDiffDesktop.activateBackup());
    }
    if (payload.cancelled) {
      setStatus("Backup and version history folder unchanged");
      return;
    }

    updateStoragePathsFromPayload(payload);
    setStatus("Backup activated");
  } catch (error) {
    if (isAbortError(error)) return;
    console.error(error);
    setStatus(readableBackupFolderFailure(error?.message));
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
    skipSummary: Boolean(options.skipSummary),
    allowLinkedTextFileFailure: Boolean(options.allowLinkedTextFileFailure),
    allowMissingVersionHistoryFolder: Boolean(options.allowMissingVersionHistoryFolder),
    skipLinkedTextFileWrite: Boolean(options.skipLinkedTextFileWrite)
  });
}

async function writeProjectBackupNow(options = {}) {
  if (!state) return null;

  const body = prepareClosePayload({
    skipSummary: options.skipSummary !== false,
    allowLinkedTextFileFailure: Boolean(options.allowLinkedTextFileFailure),
    allowMissingVersionHistoryFolder: Boolean(options.allowMissingVersionHistoryFolder),
    skipLinkedTextFileWrite: Boolean(options.skipLinkedTextFileWrite)
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

function backupStorageObject(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : null;
}

function backupStorageValue(source, paths = []) {
  for (const pathText of paths) {
    let value = source;
    for (const part of String(pathText).split(".")) {
      value = backupStorageObject(value)?.[part];
      if (value === undefined || value === null) break;
    }
    if (value !== undefined && value !== null && value !== "") return value;
  }
  return undefined;
}

function backupStorageNumber(source, paths = []) {
  const value = backupStorageValue(source, paths);
  if (value === undefined) return null;
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 ? number : null;
}

function backupStoragePayloadObjects(payload) {
  const envelope = backupStorageObject(payload) || {};
  const progress = backupStorageObject(envelope.progress);
  const job = backupStorageObject(envelope.job);
  const progressResult = backupStorageObject(progress?.result);
  const result = backupStorageObject(envelope.result);
  return [
    backupStorageObject(envelope.preview),
    backupStorageObject(progress?.preview),
    backupStorageObject(progressResult?.preview),
    backupStorageObject(result?.preview),
    progressResult,
    result,
    progress,
    job,
    envelope
  ].filter(Boolean);
}

function backupStoragePayloadValue(payload, paths = []) {
  for (const source of backupStoragePayloadObjects(payload)) {
    const value = backupStorageValue(source, paths);
    if (value !== undefined) return value;
  }
  return undefined;
}

function backupStoragePreviewFromPayload(payload) {
  const previewKeys = [
    "activeFiles",
    "activeBytes",
    "archiveFiles",
    "archiveBytes",
    "retainedFiles",
    "retainedBytes",
    "sameSizeCandidateFiles",
    "sameSizeCandidateFileCount",
    "exactDuplicateFiles",
    "exactDuplicateFileCount",
    "stableDuplicateFiles",
    "metadataOnlyDuplicateFileCount",
    "scannedFileCount",
    "stories",
    "totals",
    "summary"
  ];
  return backupStoragePayloadObjects(payload).find(candidate => (
    previewKeys.some(key => candidate[key] !== undefined)
    || backupStorageObject(candidate.active)
    || backupStorageObject(candidate.archive)
    || backupStorageObject(candidate.retained)
  )) || null;
}

function backupStorageExpiryPreviewFromPayload(payload) {
  const previewKeys = [
    "managedRunCount",
    "runCount",
    "expiredRunCount",
    "expiredBytes",
    "retainedRunCount",
    "pinnedRunCount",
    "protectedRunCount",
    "firstRunRetentionDays",
    "standardRetentionDays",
    "runs"
  ];
  return backupStoragePayloadObjects(payload).find(candidate => (
    previewKeys.some(key => candidate[key] !== undefined)
    || previewKeys.some(key => backupStorageObject(candidate.summary)?.[key] !== undefined)
  )) || null;
}

function backupStorageExpiryPlanIdFromPayload(payload) {
  const value = backupStoragePayloadValue(payload, [
    "archiveExpiryPlanId",
    "expiryPlanId",
    "planId",
    "plan.id"
  ]);
  return value === undefined ? "" : String(value);
}

function backupStorageBoolean(source, paths = []) {
  const value = backupStorageValue(source, paths);
  if (value === undefined) return null;
  if (typeof value === "string") {
    if (value.toLowerCase() === "true") return true;
    if (value.toLowerCase() === "false") return false;
  }
  return Boolean(value);
}

function normalizeReadyForManualDeletion(value = {}) {
  const source = backupStorageObject(value) || {};
  const runs = Array.isArray(source.runs) ? source.runs : [];
  return {
    ready: backupStorageBoolean(source, ["ready"]) === true,
    unsafe: backupStorageBoolean(source, ["unsafe"]) === true,
    itemCount: backupStorageNumber(source, ["itemCount"]) ?? 0,
    runCount: backupStorageNumber(source, ["runCount"]) ?? runs.length,
    bytes: backupStorageNumber(source, ["bytes"]) ?? 0,
    folderPath: String(backupStorageValue(source, ["folderPath"]) || ""),
    runs,
    unrecognizedItemCount: backupStorageNumber(source, ["unrecognizedItemCount"]) ?? 0,
    warning: String(backupStorageValue(source, ["warning", "message"]) || "")
  };
}

function readyForManualDeletionFromPayload(payload) {
  for (const source of backupStoragePayloadObjects(payload)) {
    const value = backupStorageValue(source, ["readyForManualDeletion"]);
    if (backupStorageObject(value)) return normalizeReadyForManualDeletion(value);
  }
  return null;
}

function backupStorageExpiryRunEntries(preview) {
  const value = backupStorageValue(preview, [
    "runs",
    "managedRuns",
    "archiveRuns",
    "summary.runs"
  ]);
  return Array.isArray(value) ? value : [];
}

function formatBackupStorageRunDate(value) {
  if (!value) return "";
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "";
  return date.toLocaleString("en-GB", {
    dateStyle: "medium",
    timeStyle: "short"
  });
}

function backupStorageExpiryProtectedReasonText(value) {
  const reason = String(value || "");
  const labels = {
    "malformed-policy-state": "Retention policy metadata needs review",
    "changed-retention-metadata": "Retention metadata changed",
    "future-completion-time": "Archive completion time is in the future",
    "failed-or-partial": "Archive did not complete successfully",
    incomplete: "Archive is still incomplete",
    unreadable: "Archive folder could not be read",
    "outside-managed-archive-root": "Archive is outside the managed folder",
    "linked-or-outside-managed-archive-root": "Archive folder is linked or outside the managed folder",
    "unknown-or-linked-contents": "Archive contains unsupported linked content",
    "malformed-or-unreadable": "Archive metadata could not be read",
    "unsupported-or-malformed-manifest": "Archive manifest is unsupported or malformed",
    "changed-or-outside-root": "Archive metadata does not match the managed folder",
    "incomplete-manifest": "Archive manifest is incomplete",
    "malformed-plan-files": "Archive plan is malformed",
    "malformed-manifest-files": "Archive manifest file list is malformed",
    "reserved-file-name": "Archive contains a reserved file name",
    "unknown-contents": "Archive contains unrecognised files",
    "changed-or-unreadable-contents": "Archive contents changed or could not be read"
  };
  return labels[reason] || reason.replace(/-/g, " ");
}

function normalizeBackupStorageExpiryRun(run, index) {
  const status = String(backupStorageValue(run, ["status", "state"]) || "").toLowerCase();
  const protectedReason = String(backupStorageValue(run, [
    "protectedReason",
    "protectionReason",
    "reason"
  ]) || "");
  const pinned = backupStorageBoolean(run, ["pinned", "isPinned"]) === true;
  const protectedRun = backupStorageBoolean(run, ["protected", "isProtected"]) === true
    || Boolean(protectedReason);
  const explicitMovable = backupStorageBoolean(run, [
    "movableToManualDeletion",
    "movable",
    "deletable",
    "canDelete"
  ]);
  const expired = backupStorageBoolean(run, ["expired", "isExpired"]) === true
    || status === "expired"
    || explicitMovable === true;
  const movable = explicitMovable === true && !pinned && !protectedRun;
  const completedAt = String(backupStorageValue(run, [
    "completedAt",
    "archivedAt",
    "createdAt"
  ]) || "");
  const expiresAt = String(backupStorageValue(run, ["expiresAt", "expiryAt"]) || "");
  const folderName = String(backupStorageValue(run, [
    "folderName",
    "archiveName",
    "runName",
    "name",
    "runId",
    "id"
  ]) || `Archive run ${index + 1}`);
  const archiveFolderPath = String(backupStorageValue(run, [
    "archiveFolderPath",
    "folderPath",
    "path"
  ]) || "");
  const fileCount = backupStorageNumber(run, [
    "fileCount",
    "archivedFileCount",
    "files"
  ]) ?? 0;
  const bytes = backupStorageNumber(run, [
    "bytes",
    "archivedBytes",
    "size"
  ]) ?? 0;
  let stateLabel = "Retained";
  if (movable) stateLabel = "Expired";
  else if (pinned) stateLabel = "Pinned";
  else if (protectedRun || expired) stateLabel = "Protected";
  else if (status && !["complete", "completed", "success", "succeeded"].includes(status)) {
    stateLabel = status.replace(/(^|-)\w/g, match => match.toUpperCase());
  }

  return {
    folderName,
    archiveFolderPath,
    completedAt,
    expiresAt,
    retentionDays: backupStorageNumber(run, ["retentionDays"]),
    fileCount,
    bytes,
    expired,
    pinned,
    protected: protectedRun,
    protectedReason: pinned ? "" : backupStorageExpiryProtectedReasonText(protectedReason),
    movable,
    stateLabel
  };
}

function normalizeBackupStorageExpiryPreview(preview, payload = {}) {
  const runs = backupStorageExpiryRunEntries(preview)
    .map(normalizeBackupStorageExpiryRun);
  const managedRunCount = backupStorageNumber(preview, [
    "managedRunCount",
    "runCount",
    "summary.managedRunCount",
    "summary.runCount"
  ]) ?? runs.length;
  const expiredRunCount = backupStorageNumber(preview, [
    "expiredRunCount",
    "summary.expiredRunCount"
  ]) ?? runs.filter(run => run.expired).length;
  const protectedRunCount = backupStorageNumber(preview, [
    "protectedRunCount",
    "summary.protectedRunCount"
  ]) ?? runs.filter(run => run.protected).length;
  const pinnedRunCount = backupStorageNumber(preview, [
    "pinnedRunCount",
    "summary.pinnedRunCount"
  ]) ?? runs.filter(run => run.pinned).length;
  const retainedRunCount = backupStorageNumber(preview, [
    "retainedRunCount",
    "summary.retainedRunCount"
  ]) ?? Math.max(0, managedRunCount - expiredRunCount);
  const warningsValue = backupStorageValue(preview, [
    "warnings",
    "warningMessages",
    "summary.warnings"
  ]) ?? backupStoragePayloadValue(payload, ["warnings", "warningMessages"]);
  const warnings = (Array.isArray(warningsValue) ? warningsValue : warningsValue ? [warningsValue] : [])
    .map(backupStorageWarningText)
    .filter(Boolean);

  return {
    managedRunCount,
    expiredRunCount,
    expiredBytes: backupStorageNumber(preview, [
      "expiredBytes",
      "summary.expiredBytes"
    ]) ?? runs.filter(run => run.movable).reduce((sum, run) => sum + run.bytes, 0),
    retainedRunCount,
    pinnedRunCount,
    protectedRunCount,
    firstRunRetentionDays: backupStorageNumber(preview, [
      "firstRunRetentionDays",
      "summary.firstRunRetentionDays"
    ]) ?? 90,
    standardRetentionDays: backupStorageNumber(preview, [
      "standardRetentionDays",
      "summary.standardRetentionDays"
    ]) ?? 30,
    movableRunCount: backupStorageNumber(preview, [
      "movableRunCount",
      "summary.movableRunCount"
    ]) ?? (runs.length ? runs.filter(run => run.movable).length : expiredRunCount),
    runs,
    warnings: [...new Set([...warnings, ...backupStorageExpiryOperationWarnings])]
  };
}

function backupStorageStoryEntries(preview) {
  const value = backupStorageValue(preview, [
    "stories",
    "storySummaries",
    "storyPlans",
    "byStory"
  ]);
  if (Array.isArray(value)) return value;
  if (!backupStorageObject(value)) return [];
  return Object.entries(value).map(([key, story]) => ({
    ...(backupStorageObject(story) || {}),
    storyKey: backupStorageObject(story)?.storyKey || key
  }));
}

function backupStorageWarningText(entry) {
  if (typeof entry === "string") return entry;
  const warning = backupStorageObject(entry);
  if (!warning) return "";
  const directMessage = backupStorageValue(warning, ["message", "warning", "detail", "error"]);
  if (directMessage) return String(directMessage);

  const type = String(warning.type || "");
  const activeBytes = backupStorageNumber(warning, ["activeBytes"]);
  const limitBytes = backupStorageNumber(warning, ["limitBytes"]);
  const sizeText = activeBytes !== null && limitBytes !== null
    ? ` (${formatBackupStorageBytes(activeBytes)} active; ${formatBackupStorageBytes(limitBytes)} limit)`
    : "";
  if (type === "story-byte-limit") {
    const story = String(backupStorageValue(warning, ["label", "storyName", "storyKey"]) || "A story");
    return `${story} remains above its storage limit because protected backups must stay active${sizeText}.`;
  }
  if (type === "total-byte-limit") {
    return `Active backups remain above the total storage limit because protected backups must stay active${sizeText}.`;
  }
  return type ? `Retention warning: ${type}` : "";
}

function backupStorageWarnings(preview, payload) {
  const value = backupStorageValue(preview, ["warnings", "warningMessages"])
    ?? backupStoragePayloadValue(payload, ["warnings", "warningMessages"]);
  const entries = Array.isArray(value) ? value : value ? [value] : [];
  const warnings = entries.map(backupStorageWarningText).filter(Boolean);
  const protectedCounts = [
    {
      count: backupStorageNumber(preview, ["malformedFileCount", "summary.malformedFileCount"]),
      message: count => `${backupStorageFileLabel(count)} with malformed JSON were kept active for manual review.`
    },
    {
      count: backupStorageNumber(preview, ["futureSchemaFileCount", "summary.futureSchemaFileCount"]),
      message: count => `${backupStorageFileLabel(count)} from a newer data format were kept active.`
    },
    {
      count: backupStorageNumber(preview, ["pinnedFileCount", "summary.pinnedFileCount"]),
      message: count => `${backupStorageFileLabel(count)} marked as pinned were kept active.`
    },
    {
      count: backupStorageNumber(preview, ["sourceChangedFileCount", "summary.sourceChangedFileCount"]),
      message: count => `${backupStorageFileLabel(count)} that changed during the scan were kept active.`
    }
  ];
  protectedCounts.forEach(entry => {
    if (entry.count > 0) warnings.push(entry.message(entry.count));
  });
  return [...new Set(warnings)];
}

function normalizeBackupStorageStory(story, index) {
  const activeFiles = backupStorageNumber(story, [
    "activeFiles",
    "totalFiles",
    "scannedFileCount",
    "active.files",
    "active.fileCount",
    "active.count"
  ]) ?? 0;
  const activeBytes = backupStorageNumber(story, [
    "activeBytes",
    "totalBytes",
    "scannedBytes",
    "active.bytes",
    "active.byteCount",
    "active.size"
  ]) ?? 0;
  const archiveFiles = backupStorageNumber(story, [
    "archiveFiles",
    "archiveFileCount",
    "filesToArchive",
    "archive.files",
    "archive.fileCount",
    "archive.count"
  ]) ?? 0;
  const archiveBytes = backupStorageNumber(story, [
    "archiveBytes",
    "bytesToArchive",
    "archive.bytes",
    "archive.byteCount",
    "archive.size"
  ]) ?? 0;
  const retainedFiles = backupStorageNumber(story, [
    "retainedFiles",
    "keepFileCount",
    "filesRetained",
    "retained.files",
    "retained.fileCount",
    "retained.count"
  ]) ?? Math.max(0, activeFiles - archiveFiles);
  const retainedBytes = backupStorageNumber(story, [
    "retainedBytes",
    "keepBytes",
    "bytesRetained",
    "retained.bytes",
    "retained.byteCount",
    "retained.size"
  ]) ?? Math.max(0, activeBytes - archiveBytes);
  return {
    name: String(backupStorageValue(story, [
      "storyName",
      "displayName",
      "label",
      "fileName",
      "title",
      "name",
      "storyKey",
      "id"
    ]) || `Story ${index + 1}`),
    sourceFilePath: String(backupStorageValue(story, [
      "sourceFilePath",
      "filePath",
      "path"
    ]) || ""),
    archiveFiles,
    archiveBytes,
    retainedFiles,
    retainedBytes
  };
}

function normalizeBackupStoragePreview(preview, payload = {}) {
  const activeFiles = backupStorageNumber(preview, [
    "activeFiles",
    "totalFiles",
    "scannedFileCount",
    "totals.activeFiles",
    "summary.activeFiles",
    "summary.scannedFileCount",
    "counts.activeFiles",
    "active.files",
    "active.fileCount",
    "active.count"
  ]) ?? 0;
  const activeBytes = backupStorageNumber(preview, [
    "activeBytes",
    "totalBytes",
    "scannedBytes",
    "totals.activeBytes",
    "summary.scannedBytes",
    "summary.activeBytes",
    "counts.activeBytes",
    "active.bytes",
    "active.byteCount",
    "active.size"
  ]) ?? 0;
  const archiveFiles = backupStorageNumber(preview, [
    "archiveFiles",
    "archiveFileCount",
    "filesToArchive",
    "totals.archiveFiles",
    "summary.archiveFiles",
    "summary.archiveFileCount",
    "counts.archiveFiles",
    "archive.files",
    "archive.fileCount",
    "archive.count"
  ]) ?? 0;
  const archiveBytes = backupStorageNumber(preview, [
    "archiveBytes",
    "bytesToArchive",
    "totals.archiveBytes",
    "summary.archiveBytes",
    "counts.archiveBytes",
    "archive.bytes",
    "archive.byteCount",
    "archive.size"
  ]) ?? 0;
  const retainedFiles = backupStorageNumber(preview, [
    "retainedFiles",
    "keepFileCount",
    "filesRetained",
    "totals.retainedFiles",
    "summary.retainedFiles",
    "summary.keepFileCount",
    "counts.retainedFiles",
    "retained.files",
    "retained.fileCount",
    "retained.count"
  ]) ?? Math.max(0, activeFiles - archiveFiles);
  const retainedBytes = backupStorageNumber(preview, [
    "retainedBytes",
    "keepBytes",
    "bytesRetained",
    "totals.retainedBytes",
    "summary.retainedBytes",
    "summary.keepBytes",
    "counts.retainedBytes",
    "retained.bytes",
    "retained.byteCount",
    "retained.size"
  ]) ?? Math.max(0, activeBytes - archiveBytes);

  return {
    activeFiles,
    activeBytes,
    archiveFiles,
    archiveBytes,
    retainedFiles,
    retainedBytes,
    sameSizeCandidateFiles: backupStorageNumber(preview, [
      "sameSizeCandidateFiles",
      "sameSizeCandidateFileCount",
      "candidateFiles",
      "sameSizeFiles",
      "totals.sameSizeCandidateFiles",
      "counts.sameSizeCandidateFiles",
      "summary.sameSizeCandidateFileCount"
    ]) ?? 0,
    exactDuplicateFiles: backupStorageNumber(preview, [
      "exactDuplicateFiles",
      "exactDuplicateFileCount",
      "exactDuplicates",
      "totals.exactDuplicateFiles",
      "counts.exactDuplicateFiles",
      "exact.files",
      "summary.exactDuplicateFileCount"
    ]) ?? 0,
    stableDuplicateFiles: backupStorageNumber(preview, [
      "stableDuplicateFiles",
      "stableContentDuplicateFileCount",
      "metadataOnlyDuplicateFileCount",
      "semanticDuplicateFiles",
      "metadataOnlyDuplicateFiles",
      "totals.stableDuplicateFiles",
      "counts.stableDuplicateFiles",
      "stable.files",
      "summary.stableContentDuplicateFileCount",
      "summary.metadataOnlyDuplicateFileCount"
    ]) ?? 0,
    stories: backupStorageStoryEntries(preview).map(normalizeBackupStorageStory),
    warnings: backupStorageWarnings(preview, payload),
    archiveRootPath: String(
      backupStorageValue(preview, [
        "archiveRootPath",
        "archiveFolderPath",
        "archivePath",
        "destinationPath"
      ])
      ?? backupStoragePayloadValue(payload, [
        "archiveRootPath",
        "archiveFolderPath",
        "archivePath",
        "destinationPath"
      ])
      ?? ""
    )
  };
}

function formatBackupStorageBytes(value) {
  const bytes = Math.max(0, Number(value) || 0);
  if (bytes < 1024) return `${Math.round(bytes).toLocaleString("en-GB")} B`;
  const units = ["KiB", "MiB", "GiB", "TiB"];
  const unitIndex = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)) - 1, units.length - 1);
  const amount = bytes / (1024 ** (unitIndex + 1));
  const maximumFractionDigits = amount >= 100 ? 0 : amount >= 10 ? 1 : 2;
  return `${amount.toLocaleString("en-GB", { maximumFractionDigits })} ${units[unitIndex]}`;
}

function backupStorageFileLabel(value) {
  const count = Math.max(0, Math.round(Number(value) || 0));
  return `${count.toLocaleString("en-GB")} ${count === 1 ? "file" : "files"}`;
}

function backupStoragePlanIdFromPayload(payload) {
  const value = backupStoragePayloadValue(payload, [
    "planId",
    "retentionPlanId",
    "plan.id"
  ]);
  return value === undefined ? "" : String(value);
}

function backupStorageJobIdFromPayload(payload) {
  const envelope = backupStorageObject(payload) || {};
  const progress = backupStorageObject(envelope.progress) || {};
  const job = backupStorageObject(envelope.job) || {};
  return String(
    envelope.jobId
    || progress.jobId
    || progress.id
    || job.jobId
    || job.id
    || envelope.id
    || ""
  );
}

function backupStorageProgressFromPayload(payload) {
  const envelope = backupStorageObject(payload) || {};
  const progress = backupStorageObject(envelope.progress)
    || backupStorageObject(envelope.job)
    || envelope;
  const result = backupStorageObject(progress.result)
    || backupStorageObject(envelope.result)
    || {};
  const status = String(
    progress.status
    || progress.state
    || envelope.status
    || envelope.state
    || "running"
  ).toLowerCase();
  const completed = backupStorageNumber(progress, [
    "completed",
    "processed",
    "processedFiles",
    "current",
    "done"
  ]);
  const total = backupStorageNumber(progress, [
    "total",
    "totalFiles",
    "fileCount",
    "items"
  ]);
  const explicitPercent = backupStorageNumber(progress, [
    "percent",
    "percentage",
    "progressPercent"
  ]);
  const percent = explicitPercent !== null
    ? Math.min(100, explicitPercent)
    : total !== null && total > 0 && completed !== null
      ? Math.min(100, (completed / total) * 100)
      : null;
  const errorValue = progress.error || envelope.error;
  const error = typeof errorValue === "string"
    ? errorValue
    : String(backupStorageValue(errorValue, ["message", "detail"]) || "");
  const partial = result.ok === false
    || envelope.ok === false
    || String(result.status || "").toLowerCase() === "partial"
    || ["partial", "completed-with-errors"].includes(status);
  const failures = Array.isArray(result.failures)
    ? result.failures
    : Array.isArray(progress.failures)
      ? progress.failures
      : Array.isArray(envelope.failures)
        ? envelope.failures
        : [];

  return {
    status,
    completed,
    total,
    percent,
    step: String(
      progress.step
      || progress.message
      || progress.label
      || progress.phaseLabel
      || ""
    ),
    error,
    partial,
    failedFileCount: backupStorageNumber(result, ["failedFileCount", "failedFiles"])
      ?? backupStorageNumber(progress, ["failedFileCount", "failedFiles"])
      ?? backupStorageNumber(envelope, ["failedFileCount", "failedFiles"])
      ?? 0,
    failures,
    pollAfterMs: backupStorageNumber(progress, ["pollAfterMs", "retryAfterMs"])
  };
}

function backupStorageTerminalState(status) {
  const value = String(status || "").toLowerCase();
  if (["complete", "completed", "done", "success", "succeeded"].includes(value)) return "complete";
  if (["failed", "error", "cancelled", "canceled", "partial", "completed-with-errors"].includes(value)) {
    return "failed";
  }
  return "";
}

function backupStorageRunLabel(value) {
  const count = Math.max(0, Math.round(Number(value) || 0));
  return `${count.toLocaleString("en-GB")} ${count === 1 ? "run" : "runs"}`;
}

function manualDeletionQueueIsVisible(queue) {
  return Boolean(queue?.ready && (queue.itemCount > 0 || queue.unsafe));
}

function manualDeletionQueueSummary(value) {
  const queue = normalizeReadyForManualDeletion(value);
  const details = [
    countLabel(queue.itemCount, "item"),
    backupStorageRunLabel(queue.runCount),
    formatBackupStorageBytes(queue.bytes)
  ].join(", ");
  if (queue.unsafe) {
    return `${queue.warning || "The manual deletion folder could not be verified."} ${details}.`;
  }
  const unrecognized = queue.unrecognizedItemCount > 0
    ? ` ${countLabel(queue.unrecognizedItemCount, "unrecognised item")} also needs review.`
    : "";
  return `${details} waiting for your review.${unrecognized}`;
}

function renderBackupStorageManualDeletion(value) {
  const queue = normalizeReadyForManualDeletion(value);
  backupStorageManualDeletion = queue;
  const visible = manualDeletionQueueIsVisible(queue);

  if (els.backupStorageManualDeletion) {
    els.backupStorageManualDeletion.hidden = !visible;
    els.backupStorageManualDeletion.classList.toggle("is-unsafe", queue.unsafe);
  }
  if (els.backupStorageManualDeletionSummary) {
    els.backupStorageManualDeletionSummary.textContent = visible
      ? manualDeletionQueueSummary(queue)
      : "";
  }
  if (els.backupStorageManualDeletionPath) {
    els.backupStorageManualDeletionPath.textContent = visible
      ? queue.folderPath || "Folder path unavailable"
      : "";
    els.backupStorageManualDeletionPath.title = queue.folderPath;
  }
  if (els.backupStorageManualDeletionOpen) {
    els.backupStorageManualDeletionOpen.disabled = !visible;
  }
}

function syncBackupStorageActions() {
  const archiveFiles = backupStoragePreview?.archiveFiles || 0;
  if (els.backupStorageRescan) els.backupStorageRescan.disabled = backupStorageBusy;
  if (els.backupStorageArchive) {
    els.backupStorageArchive.textContent = archiveFiles > 0
      ? `Archive ${backupStorageFileLabel(archiveFiles)}`
      : "Archive files";
    els.backupStorageArchive.disabled = backupStorageBusy
      || archiveFiles < 1
      || !backupStoragePlanId;
  }
  if (els.backupStorageExpiryRefresh) {
    els.backupStorageExpiryRefresh.disabled = backupStorageBusy;
  }
  if (els.backupStorageExpiryPrepare) {
    const expiredRuns = backupStorageExpiryPreview?.movableRunCount || 0;
    els.backupStorageExpiryPrepare.textContent = "Prepare for manual deletion";
    els.backupStorageExpiryPrepare.disabled = backupStorageBusy
      || expiredRuns < 1
      || !backupStorageExpiryPlanId;
  }
  if (els.backupStoragePanel) {
    els.backupStoragePanel.setAttribute("aria-busy", String(backupStorageBusy));
  }
}

function setBackupStorageBusy(busy) {
  backupStorageBusy = Boolean(busy);
  syncBackupStorageActions();
}

function renderBackupStoragePreview(preview, payload = {}, options = {}) {
  if (!preview || !els.backupStoragePreview) return false;
  const normalized = normalizeBackupStoragePreview(preview, payload);
  backupStoragePreview = normalized;

  if (els.backupStorageActiveFiles) {
    els.backupStorageActiveFiles.textContent = backupStorageFileLabel(normalized.activeFiles);
  }
  if (els.backupStorageActiveBytes) {
    els.backupStorageActiveBytes.textContent = formatBackupStorageBytes(normalized.activeBytes);
  }
  if (els.backupStorageArchiveFiles) {
    els.backupStorageArchiveFiles.textContent = backupStorageFileLabel(normalized.archiveFiles);
  }
  if (els.backupStorageArchiveBytes) {
    els.backupStorageArchiveBytes.textContent = formatBackupStorageBytes(normalized.archiveBytes);
  }
  if (els.backupStorageRetainedFiles) {
    els.backupStorageRetainedFiles.textContent = backupStorageFileLabel(normalized.retainedFiles);
  }
  if (els.backupStorageRetainedBytes) {
    els.backupStorageRetainedBytes.textContent = formatBackupStorageBytes(normalized.retainedBytes);
  }
  if (els.backupStorageCandidateFiles) {
    els.backupStorageCandidateFiles.textContent = normalized.sameSizeCandidateFiles.toLocaleString("en-GB");
  }
  if (els.backupStorageExactFiles) {
    els.backupStorageExactFiles.textContent = normalized.exactDuplicateFiles.toLocaleString("en-GB");
  }
  if (els.backupStorageStableFiles) {
    els.backupStorageStableFiles.textContent = normalized.stableDuplicateFiles.toLocaleString("en-GB");
  }

  if (els.backupStorageStories && els.backupStorageStoriesSection) {
    els.backupStorageStories.innerHTML = normalized.stories.map(story => `
      <li>
        <span
          class="backup-storage-story-name"
          title="${escapeHtml([story.name, story.sourceFilePath].filter(Boolean).join("\n"))}"
        >${escapeHtml(story.name)}</span>
        <span class="backup-storage-story-value">
          <strong>${story.archiveFiles.toLocaleString("en-GB")}</strong>
          <small>${formatBackupStorageBytes(story.archiveBytes)} to archive</small>
        </span>
        <span class="backup-storage-story-value">
          <strong>${story.retainedFiles.toLocaleString("en-GB")}</strong>
          <small>${formatBackupStorageBytes(story.retainedBytes)} remain</small>
        </span>
      </li>
    `).join("");
    els.backupStorageStoriesSection.hidden = normalized.stories.length === 0;
  }

  if (els.backupStorageWarnings && els.backupStorageWarningsSection) {
    els.backupStorageWarnings.innerHTML = normalized.warnings
      .map(warning => `<li>${escapeHtml(warning)}</li>`)
      .join("");
    els.backupStorageWarningsSection.hidden = normalized.warnings.length === 0;
  }

  if (els.backupStoragePath && els.backupStoragePathSection) {
    els.backupStoragePath.textContent = normalized.archiveRootPath;
    els.backupStoragePath.title = normalized.archiveRootPath;
    els.backupStoragePathSection.hidden = !normalized.archiveRootPath;
  }

  backupStoragePlanId = options.acceptPlan === false
    ? ""
    : backupStoragePlanIdFromPayload(payload);
  els.backupStoragePreview.hidden = false;
  syncBackupStorageActions();
  return true;
}

function renderBackupStorageExpiryPreview(preview, payload = {}) {
  if (!preview || !els.backupStorageExpiryPreview) return false;
  const normalized = normalizeBackupStorageExpiryPreview(preview, payload);
  backupStorageExpiryPreview = normalized;

  if (els.backupStorageExpiryManaged) {
    els.backupStorageExpiryManaged.textContent = normalized.managedRunCount.toLocaleString("en-GB");
  }
  if (els.backupStorageExpiryExpired) {
    els.backupStorageExpiryExpired.textContent = backupStorageRunLabel(normalized.expiredRunCount);
  }
  if (els.backupStorageExpiryBytes) {
    els.backupStorageExpiryBytes.textContent = formatBackupStorageBytes(normalized.expiredBytes);
  }
  if (els.backupStorageExpiryRetained) {
    els.backupStorageExpiryRetained.textContent = normalized.retainedRunCount.toLocaleString("en-GB");
  }
  if (els.backupStorageExpiryPinned) {
    els.backupStorageExpiryPinned.textContent = normalized.pinnedRunCount.toLocaleString("en-GB");
  }
  if (els.backupStorageExpiryProtected) {
    els.backupStorageExpiryProtected.textContent = normalized.protectedRunCount.toLocaleString("en-GB");
  }
  if (els.backupStorageExpiryPolicy) {
    els.backupStorageExpiryPolicy.textContent =
      `The first archive is kept for ${normalized.firstRunRetentionDays} days; later archives are kept for ${normalized.standardRetentionDays} days. Only archives still in the managed folder are included.`;
  }

  if (els.backupStorageExpiryRuns) {
    els.backupStorageExpiryRuns.innerHTML = normalized.runs.map(run => {
      const completedText = formatBackupStorageRunDate(run.completedAt);
      const expiresText = formatBackupStorageRunDate(run.expiresAt);
      const timing = [];
      if (completedText) timing.push(`Archived ${completedText}`);
      if (expiresText) timing.push(`${run.movable || run.expired ? "Expired" : "Expires"} ${expiresText}`);
      if (run.retentionDays !== null) timing.push(`${run.retentionDays}-day retention`);
      if (run.protectedReason) timing.push(run.protectedReason);
      const tooltip = [run.folderName, run.archiveFolderPath].filter(Boolean).join("\n");
      const stateClass = run.movable
        ? "is-expired"
        : run.pinned || run.protected || run.expired
          ? "is-protected"
          : "";
      return `
        <li class="${stateClass}">
          <span class="backup-storage-expiry-run-name" title="${escapeHtml(tooltip)}">
            <strong>${escapeHtml(run.folderName)}</strong>
            <small>${escapeHtml(timing.join(" | ") || "Managed archive run")}</small>
          </span>
          <span class="backup-storage-expiry-run-size">
            <strong>${backupStorageFileLabel(run.fileCount)}</strong>
            <small>${formatBackupStorageBytes(run.bytes)}</small>
          </span>
          <span class="backup-storage-expiry-run-state">${escapeHtml(run.stateLabel)}</span>
        </li>
      `;
    }).join("");
    els.backupStorageExpiryRuns.hidden = normalized.runs.length === 0;
  }

  if (els.backupStorageExpiryWarnings && els.backupStorageExpiryWarningsSection) {
    els.backupStorageExpiryWarnings.innerHTML = normalized.warnings
      .map(warning => `<li>${escapeHtml(warning)}</li>`)
      .join("");
    els.backupStorageExpiryWarningsSection.hidden = normalized.warnings.length === 0;
  }

  const manualDeletion = readyForManualDeletionFromPayload(payload)
    || (backupStorageObject(preview.readyForManualDeletion)
      ? normalizeReadyForManualDeletion(preview.readyForManualDeletion)
      : backupStorageManualDeletion);
  if (manualDeletion) renderBackupStorageManualDeletion(manualDeletion);

  backupStorageExpiryPlanId = backupStorageExpiryPlanIdFromPayload(payload);
  backupStorageExpiryOperationWarnings = [];
  els.backupStorageExpiryPreview.hidden = false;
  if (els.backupStorageExpiryStatus) {
    if (normalized.movableRunCount > 0) {
      els.backupStorageExpiryStatus.textContent =
        `${backupStorageRunLabel(normalized.movableRunCount)} can be prepared for manual deletion. Only completed runs still inside the managed archive folder are included.`;
    } else if (normalized.managedRunCount > 0) {
      els.backupStorageExpiryStatus.textContent =
        "No managed archive runs have reached the end of retention. Archives stored elsewhere are not included.";
    } else {
      els.backupStorageExpiryStatus.textContent =
        "No managed archive runs were found. Archives stored elsewhere are not included.";
    }
  }
  syncBackupStorageActions();
  return true;
}

function showBackupStorageOperationWarnings(warnings = []) {
  if (!els.backupStorageWarnings || !els.backupStorageWarningsSection) return;
  const messages = warnings.map(entry => {
    if (typeof entry === "string") return entry;
    const fileName = String(backupStorageValue(entry, ["fileName", "name", "path"]) || "");
    const error = String(backupStorageValue(entry, ["error", "message", "detail"]) || "");
    return [fileName, error].filter(Boolean).join(": ");
  }).filter(Boolean);
  if (!messages.length) return;
  els.backupStorageWarnings.innerHTML = messages
    .map(message => `<li>${escapeHtml(message)}</li>`)
    .join("");
  els.backupStorageWarningsSection.hidden = false;
}

function showBackupStorageArchivePath(value) {
  const archivePath = String(value || "");
  if (!archivePath || !els.backupStoragePath || !els.backupStoragePathSection) return;
  els.backupStoragePath.textContent = archivePath;
  els.backupStoragePath.title = archivePath;
  els.backupStoragePathSection.hidden = false;
}

function resetBackupStoragePreview() {
  backupStoragePlanId = "";
  backupStoragePreview = null;
  backupStorageExpiryNotice = "";
  if (els.backupStoragePreview) {
    els.backupStoragePreview.hidden = true;
    els.backupStoragePreview.classList.remove("is-archived");
  }
  if (els.backupStorageStories) els.backupStorageStories.innerHTML = "";
  if (els.backupStorageWarnings) els.backupStorageWarnings.innerHTML = "";
  if (els.backupStorageStoriesSection) els.backupStorageStoriesSection.hidden = true;
  if (els.backupStorageWarningsSection) els.backupStorageWarningsSection.hidden = true;
  if (els.backupStoragePathSection) els.backupStoragePathSection.hidden = true;
  resetBackupStorageExpiryPreview();
  syncBackupStorageActions();
}

function resetBackupStorageExpiryPreview(options = {}) {
  backupStorageExpiryPlanId = "";
  backupStorageExpiryPreview = null;
  if (!options.preserveOperationWarnings) backupStorageExpiryOperationWarnings = [];
  if (els.backupStorageExpiryPreview) els.backupStorageExpiryPreview.hidden = true;
  if (els.backupStorageExpiryRuns) {
    els.backupStorageExpiryRuns.innerHTML = "";
    els.backupStorageExpiryRuns.hidden = true;
  }
  if (els.backupStorageExpiryWarnings) els.backupStorageExpiryWarnings.innerHTML = "";
  if (els.backupStorageExpiryWarningsSection) els.backupStorageExpiryWarningsSection.hidden = true;
  if (els.backupStorageManualDeletion) els.backupStorageManualDeletion.hidden = true;
  if (els.backupStorageExpiryStatus) {
    els.backupStorageExpiryStatus.textContent =
      "Archive expiry will be checked after the active backup scan.";
  }
  syncBackupStorageActions();
}

function updateBackupStorageProgress(progress = {}, action = "scan") {
  if (!els.backupStorageProgress) return;
  const terminal = backupStorageTerminalState(progress.status);
  const failed = terminal === "failed";
  const hasPercent = Number.isFinite(progress.percent);
  const percent = terminal === "complete" ? 100 : hasPercent ? progress.percent : 0;
  const isExpiryAction = action === "expiry-scan" || action === "expiry-prepare";
  const defaultStep = action === "archive"
    ? "Moving selected backups into the archive..."
    : action === "expiry-prepare"
      ? "Moving expired archive runs into the manual deletion folder..."
      : action === "expiry-scan"
        ? "Checking managed archive expiry..."
        : "Scanning version history backups...";
  const step = failed
    ? `Could not ${action === "archive"
      ? "archive backups"
      : action === "expiry-prepare"
        ? "prepare expired archives"
        : action === "expiry-scan"
          ? "review managed archives"
          : "complete the scan"}`
    : progress.step || defaultStep;

  els.backupStorageProgress.hidden = false;
  els.backupStorageProgress.classList.toggle("is-failed", failed);
  if (els.backupStorageProgressTrack) {
    els.backupStorageProgressTrack.classList.toggle("is-indeterminate", !hasPercent && !terminal);
    if (hasPercent || terminal === "complete") {
      els.backupStorageProgressTrack.setAttribute("aria-valuenow", String(Math.round(percent)));
      els.backupStorageProgressTrack.setAttribute("aria-valuemin", "0");
      els.backupStorageProgressTrack.setAttribute("aria-valuemax", "100");
    } else {
      els.backupStorageProgressTrack.removeAttribute("aria-valuenow");
      els.backupStorageProgressTrack.removeAttribute("aria-valuemin");
      els.backupStorageProgressTrack.removeAttribute("aria-valuemax");
    }
  }
  if (els.backupStorageProgressBar) {
    els.backupStorageProgressBar.style.width = hasPercent || terminal === "complete"
      ? `${Math.max(0, Math.min(100, percent))}%`
      : "";
  }
  if (els.backupStorageStatus) els.backupStorageStatus.textContent = step;
  if (isExpiryAction && els.backupStorageExpiryStatus) {
    els.backupStorageExpiryStatus.textContent = step;
  }
  if (els.backupStorageProgressMeta) {
    if (failed) {
      els.backupStorageProgressMeta.textContent = progress.error || "The operation did not complete.";
    } else if (progress.total !== null && progress.total > 0) {
      const completed = Math.min(progress.total, progress.completed ?? 0);
      els.backupStorageProgressMeta.textContent =
        `${Math.round(completed).toLocaleString("en-GB")} of ${Math.round(progress.total).toLocaleString("en-GB")} ${isExpiryAction ? "archive runs" : "files"}`;
    } else {
      els.backupStorageProgressMeta.textContent = "Working...";
    }
  }
}

async function backupStorageRequest(url, options = {}) {
  const { allowPartial = false, ...requestOptions } = options;
  const response = await fetch(url, {
    cache: "no-store",
    ...requestOptions
  });
  const responseText = await response.text();
  let payload = {};
  if (responseText) {
    try {
      payload = JSON.parse(responseText);
    } catch {
      payload = { error: responseText };
    }
  }
  const allowedPartial = allowPartial
    && String(payload?.status || "").toLowerCase() === "partial";
  if (!response.ok || (payload?.ok === false && !allowedPartial)) {
    throw new Error(payload?.error || payload?.message || responseText || "Backup storage request failed");
  }
  return payload;
}

function backupStorageDelay(ms) {
  return new Promise(resolve => window.setTimeout(resolve, ms));
}

function finishBackupStorageJob(action, payload, progress, archivedFileCount = 0) {
  const terminal = backupStorageTerminalState(progress.status);
  if (terminal === "failed" && !progress.partial) {
    backupStoragePlanId = "";
    setBackupStorageBusy(false);
    updateBackupStorageProgress(progress, action);
    setStatus(action === "archive" ? "Backup archive failed" : "Backup storage scan failed");
    return;
  }

  const preview = backupStoragePreviewFromPayload(payload);
  if (action === "scan" && !preview) {
    throw new Error("The backup storage scan completed without a retention preview");
  }

  if (preview) {
    renderBackupStoragePreview(preview, payload, { acceptPlan: action === "scan" });
  } else if (action === "archive") {
    backupStoragePlanId = "";
  }

  setBackupStorageBusy(false);
  if (els.backupStorageProgress) els.backupStorageProgress.hidden = true;

  if (action === "archive") {
    backupStoragePlanId = "";
    els.backupStoragePreview?.classList.add("is-archived");
    showBackupStorageArchivePath(backupStoragePayloadValue(payload, [
      "archiveRootPath",
      "archiveFolderPath",
      "archivePath",
      "destinationPath"
    ]));
    const archiveWarnings = backupStoragePayloadValue(payload, ["warnings"]);
    if (Array.isArray(archiveWarnings) && archiveWarnings.length) {
      showBackupStorageOperationWarnings(archiveWarnings);
    }
    const reportedCount = Number(backupStoragePayloadValue(payload, [
      "archivedFiles",
      "archivedFileCount",
      "result.archivedFiles",
      "result.archivedFileCount"
    ]));
    const count = Number.isFinite(reportedCount) ? reportedCount : archivedFileCount;
    const failedCount = progress.failedFileCount
      || progress.failures.length
      || Number(backupStoragePayloadValue(payload, ["failedFileCount", "result.failedFileCount"]))
      || 0;
    if (progress.partial) {
      showBackupStorageOperationWarnings(progress.failures.length
        ? progress.failures
        : [`${backupStorageFileLabel(failedCount)} could not be archived. The active copies were retained.`]);
      if (els.backupStorageStatus) {
        els.backupStorageStatus.textContent =
          `${backupStorageFileLabel(count)} archived; ${backupStorageFileLabel(failedCount)} retained after errors.`;
      }
      setStatus("Backup archive completed with errors");
      syncBackupStorageActions();
      runBackupStorageExpiryJob("expiry-scan");
      return;
    }
    if (els.backupStorageStatus) {
      els.backupStorageStatus.textContent = count > 0
        ? `${backupStorageFileLabel(count)} moved into the archive. Rescan to review active storage.`
        : "Archive complete. Rescan to review active storage.";
    }
    setStatus(count > 0
      ? `Archived ${backupStorageFileLabel(count)}`
      : "Version history backup archive complete");
  } else {
    const archiveFiles = backupStoragePreview?.archiveFiles || 0;
    if (els.backupStorageStatus) {
      els.backupStorageStatus.textContent = archiveFiles > 0
        ? "Scan complete. Review the files selected by the retention policy."
        : "Scan complete. No files need archiving.";
    }
    setStatus(archiveFiles > 0
      ? `${backupStorageFileLabel(archiveFiles)} can be archived`
      : "Backup storage scan complete");
  }
  syncBackupStorageActions();
  runBackupStorageExpiryJob("expiry-scan");
}

async function runBackupStorageJob(action) {
  const isArchive = action === "archive";
  const planId = backupStoragePlanId;
  if (isArchive && !planId) return;

  const archivedFileCount = backupStoragePreview?.archiveFiles || 0;
  const token = ++backupStorageJobToken;
  if (!isArchive) resetBackupStoragePreview();
  backupStoragePlanId = "";
  setBackupStorageBusy(true);
  updateBackupStorageProgress({
    status: "running",
    completed: null,
    total: null,
    percent: null,
    step: isArchive
      ? "Starting backup archive..."
      : "Starting backup storage scan..."
  }, action);

  try {
    const started = await backupStorageRequest(
      isArchive
        ? "/api/version-history-backups/retention/archive"
        : "/api/version-history-backups/retention/start",
      isArchive
        ? {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ planId })
          }
        : { method: "POST" }
    );
    if (token !== backupStorageJobToken || els.backupStorageOverlay?.hidden) return;

    let payload = started;
    let progress = backupStorageProgressFromPayload(payload);
    updateBackupStorageProgress(progress, action);
    let terminal = backupStorageTerminalState(progress.status);
    const directPreview = backupStoragePreviewFromPayload(payload);
    const jobId = backupStorageJobIdFromPayload(payload);
    if (!terminal && !jobId && directPreview) terminal = "complete";
    if (terminal) {
      finishBackupStorageJob(action, payload, { ...progress, status: terminal }, archivedFileCount);
      return;
    }
    if (!jobId) throw new Error("The backup storage job did not return an ID");

    while (token === backupStorageJobToken && !els.backupStorageOverlay?.hidden) {
      const pollDelay = Math.min(1500, Math.max(250, progress.pollAfterMs || 400));
      await backupStorageDelay(pollDelay);
      if (token !== backupStorageJobToken || els.backupStorageOverlay?.hidden) return;
      payload = await backupStorageRequest(
        `/api/version-history-backups/retention/progress?id=${encodeURIComponent(jobId)}`
      );
      if (token !== backupStorageJobToken || els.backupStorageOverlay?.hidden) return;
      progress = backupStorageProgressFromPayload(payload);
      updateBackupStorageProgress(progress, action);
      terminal = backupStorageTerminalState(progress.status);
      if (!terminal) continue;
      finishBackupStorageJob(action, payload, progress, archivedFileCount);
      return;
    }
  } catch (error) {
    if (token !== backupStorageJobToken || els.backupStorageOverlay?.hidden) return;
    console.error(error);
    finishBackupStorageJob(action, {
      error: error?.message || "Backup storage operation failed"
    }, {
      status: "failed",
      error: error?.message || "Backup storage operation failed"
    }, archivedFileCount);
  }
}

function backupStorageExpiryFailureMessages(failures = []) {
  return failures.map(entry => {
    if (typeof entry === "string") return entry;
    const folderName = String(backupStorageValue(entry, [
      "folderName",
      "archiveFolderPath",
      "name",
      "path"
    ]) || "");
    const error = String(backupStorageValue(entry, ["error", "message", "detail"]) || "");
    return [folderName, error].filter(Boolean).join(": ");
  }).filter(Boolean);
}

function isBackupStorageExpiryStaleError(value) {
  return /stale|changed|expired plan|plan.+expired|plan.+not found|no longer (?:current|valid)/i
    .test(String(value || ""));
}

function finishBackupStorageExpiryJob(action, payload, progress) {
  const isPrepare = action === "expiry-prepare";
  const terminal = backupStorageTerminalState(progress.status);
  if (terminal === "failed" && !progress.partial) {
    backupStorageExpiryPlanId = "";
    if (isPrepare && isBackupStorageExpiryStaleError(progress.error)) {
      backupStorageExpiryOperationWarnings = [
        "The managed archive folder changed after the preview. Nothing was moved; the review has been refreshed."
      ];
      backupStorageExpiryNotice = "The previous archive expiry plan was no longer current.";
      setBackupStorageBusy(false);
      runBackupStorageExpiryJob("expiry-scan", { preserveOperationWarnings: true });
      return;
    }
    setBackupStorageBusy(false);
    updateBackupStorageProgress(progress, action);
    if (els.backupStorageExpiryStatus) {
      els.backupStorageExpiryStatus.textContent = progress.error
        || (isPrepare ? "Expired archives could not be prepared." : "Managed archives could not be reviewed.");
    }
    setStatus(isPrepare ? "Archive preparation failed" : "Archive expiry review failed");
    return;
  }

  if (isPrepare) {
    backupStorageExpiryPlanId = "";
    const movedRunCount = Number(backupStoragePayloadValue(payload, [
      "movedRunCount",
      "movedRuns"
    ])) || 0;
    const movedBytes = Number(backupStoragePayloadValue(payload, [
      "movedBytes"
    ])) || 0;
    const failureMessages = backupStorageExpiryFailureMessages(progress.failures);
    const partial = progress.partial || failureMessages.length > 0;
    backupStorageExpiryOperationWarnings = partial
      ? failureMessages.length
        ? failureMessages
        : ["Some expired archive runs could not be prepared. They remain in the managed archive folder."]
      : [];
    backupStorageExpiryNotice = partial
      ? `${backupStorageRunLabel(movedRunCount)} prepared; some managed archive runs remained after errors.`
      : `${backupStorageRunLabel(movedRunCount)} prepared for manual deletion${movedBytes > 0 ? ` (${formatBackupStorageBytes(movedBytes)})` : ""}.`;
    const manualDeletion = readyForManualDeletionFromPayload(payload);
    if (manualDeletion) renderBackupStorageManualDeletion(manualDeletion);
    setBackupStorageBusy(false);
    if (els.backupStorageProgress) els.backupStorageProgress.hidden = true;
    runBackupStorageExpiryJob("expiry-scan", {
      preserveOperationWarnings: true,
      preservePreview: true
    });
    return;
  }

  const preview = backupStorageExpiryPreviewFromPayload(payload);
  if (!preview) {
    throw new Error("The archive expiry scan completed without a preview");
  }
  renderBackupStorageExpiryPreview(preview, payload);
  setBackupStorageBusy(false);
  if (els.backupStorageProgress) els.backupStorageProgress.hidden = true;

  const notice = backupStorageExpiryNotice;
  backupStorageExpiryNotice = "";
  if (els.backupStorageStatus) {
    if (notice) {
      els.backupStorageStatus.textContent = `${notice} Archive expiry has been refreshed.`;
    } else {
      const activeCandidates = backupStoragePreview?.archiveFiles || 0;
      const expiredRuns = backupStorageExpiryPreview?.movableRunCount || 0;
      els.backupStorageStatus.textContent =
        `Storage review complete. ${backupStorageFileLabel(activeCandidates)} can be archived; ${backupStorageRunLabel(expiredRuns)} can be prepared for manual deletion.`;
    }
  }
  setStatus(notice || "Backup storage review complete");
  syncBackupStorageActions();
}

async function runBackupStorageExpiryJob(action = "expiry-scan", options = {}) {
  if (!els.backupStorageOverlay || els.backupStorageOverlay.hidden) return;
  const isPrepare = action === "expiry-prepare";
  const planId = backupStorageExpiryPlanId;
  if (isPrepare && !planId) return;

  const token = ++backupStorageJobToken;
  if (!isPrepare && !options.preservePreview) {
    resetBackupStorageExpiryPreview({
      preserveOperationWarnings: options.preserveOperationWarnings === true
    });
  }
  backupStorageExpiryPlanId = "";
  setBackupStorageBusy(true);
  updateBackupStorageProgress({
    status: "running",
    completed: null,
    total: null,
    percent: null,
    step: isPrepare
      ? "Preparing expired archive runs for manual deletion..."
      : "Checking managed archive expiry..."
  }, action);

  try {
    const started = await backupStorageRequest(
      isPrepare
        ? "/api/version-history-backups/archive-expiry/move-to-manual-deletion"
        : "/api/version-history-backups/archive-expiry/start",
      isPrepare
        ? {
            allowPartial: true,
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ planId })
          }
        : { method: "POST" }
    );
    if (token !== backupStorageJobToken || els.backupStorageOverlay.hidden) return;

    let payload = started;
    let progress = backupStorageProgressFromPayload(payload);
    updateBackupStorageProgress(progress, action);
    let terminal = backupStorageTerminalState(progress.status);
    const directPreview = backupStorageExpiryPreviewFromPayload(payload);
    const jobId = backupStorageJobIdFromPayload(payload);
    if (!terminal && !jobId && (directPreview || isPrepare)) terminal = "complete";
    if (terminal) {
      finishBackupStorageExpiryJob(action, payload, { ...progress, status: terminal });
      return;
    }
    if (!jobId) throw new Error("The archive expiry job did not return an ID");

    while (token === backupStorageJobToken && !els.backupStorageOverlay.hidden) {
      const pollDelay = Math.min(1500, Math.max(250, progress.pollAfterMs || 400));
      await backupStorageDelay(pollDelay);
      if (token !== backupStorageJobToken || els.backupStorageOverlay.hidden) return;
      payload = await backupStorageRequest(
        `/api/version-history-backups/retention/progress?id=${encodeURIComponent(jobId)}`
      );
      if (token !== backupStorageJobToken || els.backupStorageOverlay.hidden) return;
      progress = backupStorageProgressFromPayload(payload);
      updateBackupStorageProgress(progress, action);
      terminal = backupStorageTerminalState(progress.status);
      if (!terminal) continue;
      finishBackupStorageExpiryJob(action, payload, progress);
      return;
    }
  } catch (error) {
    if (token !== backupStorageJobToken || els.backupStorageOverlay.hidden) return;
    console.error(error);
    const message = error?.message || "Archive expiry operation failed";
    if (isPrepare && isBackupStorageExpiryStaleError(message)) {
      backupStorageExpiryOperationWarnings = [
        "The managed archive folder changed after the preview. Nothing was moved; the review has been refreshed."
      ];
      backupStorageExpiryNotice = "The previous archive expiry plan was no longer current.";
      setBackupStorageBusy(false);
      runBackupStorageExpiryJob("expiry-scan", { preserveOperationWarnings: true });
      return;
    }
    finishBackupStorageExpiryJob(action, { error: message }, {
      status: "failed",
      error: message
    });
  }
}

function prepareExpiredBackupArchives() {
  const expiredRuns = backupStorageExpiryPreview?.movableRunCount || 0;
  if (!backupStorageExpiryPlanId || expiredRuns < 1 || backupStorageBusy) return;
  runBackupStorageExpiryJob("expiry-prepare");
}

async function openManualDeletionFolder(options = {}) {
  try {
    await backupStorageRequest("/api/version-history-backups/manual-deletion/open", {
      method: "POST"
    });
    if (els.backupStorageStatus && !els.backupStorageOverlay?.hidden) {
      els.backupStorageStatus.textContent = "Opened the manual deletion folder.";
    }
    setStatus("Opened manual deletion folder");
    if (options.closeReminder) hideManualDeletionReminder();
    return true;
  } catch (error) {
    console.error(error);
    const message = error?.message || "The manual deletion folder could not be opened.";
    if (els.backupStorageStatus && !els.backupStorageOverlay?.hidden) {
      els.backupStorageStatus.textContent = message;
    }
    if (els.manualDeletionReminderSummary && !els.manualDeletionReminder?.hidden) {
      els.manualDeletionReminderSummary.textContent =
        `${manualDeletionQueueSummary(backupStorageManualDeletion)} ${message}`;
    }
    setStatus("Manual-deletion folder could not be opened");
    return false;
  }
}

function showManualDeletionReminder(value) {
  const queue = normalizeReadyForManualDeletion(value);
  backupStorageManualDeletion = queue;
  if (
    manualDeletionReminderDismissed
    || !manualDeletionQueueIsVisible(queue)
    || !els.manualDeletionReminder
  ) {
    return;
  }

  manualDeletionReminderReturnFocus = document.activeElement instanceof HTMLElement
    ? document.activeElement
    : null;
  if (els.manualDeletionReminderSummary) {
    els.manualDeletionReminderSummary.textContent = manualDeletionQueueSummary(queue);
  }
  if (els.manualDeletionReminderPath) {
    els.manualDeletionReminderPath.textContent = queue.folderPath || "Folder path unavailable";
    els.manualDeletionReminderPath.title = queue.folderPath;
  }
  els.manualDeletionReminder.hidden = false;
  nextUiFrame().then(() => els.manualDeletionReminderOpen?.focus());
}

function hideManualDeletionReminder() {
  if (!els.manualDeletionReminder || els.manualDeletionReminder.hidden) return;
  manualDeletionReminderDismissed = true;
  els.manualDeletionReminder.hidden = true;
  const returnFocus = manualDeletionReminderReturnFocus;
  manualDeletionReminderReturnFocus = null;
  window.requestAnimationFrame(() => {
    if (returnFocus?.isConnected) returnFocus.focus();
  });
}

function handleManualDeletionReminderKeydown(event) {
  if (!els.manualDeletionReminder || els.manualDeletionReminder.hidden) return;
  if (event.key === "Escape") {
    event.preventDefault();
    event.stopPropagation();
    hideManualDeletionReminder();
    return;
  }
  if (event.key !== "Tab") return;

  const focusable = Array.from(
    els.manualDeletionReminderPanel?.querySelectorAll(
      "button:not([disabled]), [href], input:not([disabled]), [tabindex]:not([tabindex='-1'])"
    ) || []
  ).filter(element => !element.hidden && element.getClientRects().length > 0);
  if (!focusable.length) return;
  const first = focusable[0];
  const last = focusable[focusable.length - 1];
  if (event.shiftKey && document.activeElement === first) {
    event.preventDefault();
    last.focus();
  } else if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault();
    first.focus();
  }
}

function openBackupStorageManager() {
  const menuSummary = els.fileMenu?.querySelector(":scope > summary");
  const returnFocus = menuSummary instanceof HTMLElement
    ? menuSummary
    : document.activeElement instanceof HTMLElement
      ? document.activeElement
      : els.fileManageBackupStorage;
  closeFileMenu();
  if (!els.backupStorageOverlay) return;
  backupStorageReturnFocus = returnFocus;
  els.backupStorageOverlay.hidden = false;
  resetBackupStoragePreview();
  if (els.backupStorageProgress) els.backupStorageProgress.hidden = true;
  if (els.backupStorageStatus) {
    els.backupStorageStatus.textContent = "Scanning the active backup folder for retention candidates.";
  }
  nextUiFrame().then(() => els.backupStorageClose?.focus());
  runBackupStorageJob("scan");
}

function closeBackupStorageManager() {
  if (!els.backupStorageOverlay || els.backupStorageOverlay.hidden) return;
  backupStorageJobToken += 1;
  backupStorageBusy = false;
  els.backupStorageOverlay.hidden = true;
  if (els.backupStoragePanel) els.backupStoragePanel.removeAttribute("aria-busy");
  const returnFocus = backupStorageReturnFocus;
  backupStorageReturnFocus = null;
  window.requestAnimationFrame(() => {
    if (returnFocus?.isConnected) returnFocus.focus();
  });
}

function handleBackupStorageKeydown(event) {
  if (!els.backupStorageOverlay || els.backupStorageOverlay.hidden) return;
  if (event.key === "Escape") {
    event.preventDefault();
    event.stopPropagation();
    closeBackupStorageManager();
    return;
  }
  if (event.key !== "Tab") return;

  const focusable = Array.from(
    els.backupStoragePanel?.querySelectorAll("button:not([disabled]), [href], input:not([disabled]), [tabindex]:not([tabindex='-1'])")
    || []
  ).filter(element => !element.hidden && element.getClientRects().length > 0);
  if (!focusable.length) return;
  const first = focusable[0];
  const last = focusable[focusable.length - 1];
  if (event.shiftKey && document.activeElement === first) {
    event.preventDefault();
    last.focus();
  } else if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault();
    first.focus();
  }
}

function countLabel(count, singular, plural = `${singular}s`) {
  const value = Number(count) || 0;
  return `${value.toLocaleString("en-GB")} ${value === 1 ? singular : plural}`;
}

function wordCountText(value) {
  return countLabel(value, "word");
}

function versionCountText(value) {
  return countLabel(value, "saved version");
}

function wordCountChangeText(previous, next) {
  return `${Number(previous || 0).toLocaleString("en-GB")} -> ${Number(next || 0).toLocaleString("en-GB")} words`;
}

function renderTransferEntryList(entries = []) {
  if (!entries.length) return '<p class="transfer-review-empty">None</p>';

  return `
    <ul class="transfer-review-list">
      ${entries.slice(0, 80).map(entry => `
        <li>
          <span class="transfer-review-path">${escapeHtml(entry.displayPath || entry.relativePath || entry.itemId || "File")}</span>
          <span class="transfer-review-status">${escapeHtml(entry.statusLabel || entry.status || "")}</span>
        </li>
      `).join("")}
    </ul>
    ${entries.length > 80 ? `<p class="transfer-review-more">${countLabel(entries.length - 80, "more file")}</p>` : ""}
  `;
}

function renderTransferFileGroup(title, entries = []) {
  return `
    <section class="transfer-review-section">
      <h3>${escapeHtml(title)} <span>${entries.length.toLocaleString("en-GB")}</span></h3>
      ${renderTransferEntryList(entries)}
    </section>
  `;
}

function transferShortPath(entry = {}) {
  if (entry.role === "storyText") return fileNameFromPath(entry.displayPath) || "Story text file";
  const relativePath = entry.relativePath || "";
  if (relativePath) return relativePath;
  return fileNameFromPath(entry.displayPath) || entry.itemId || "File";
}

function renderTransferBriefList(entries = [], emptyText = "Nothing to check.") {
  if (!entries.length) return `<p class="transfer-review-empty">${escapeHtml(emptyText)}</p>`;

  return `
    <ul class="transfer-review-brief-list">
      ${entries.slice(0, 8).map(entry => `
        <li>
          <span>${escapeHtml(transferShortPath(entry))}</span>
          <em>${escapeHtml(entry.statusLabel || entry.status || "")}</em>
        </li>
      `).join("")}
    </ul>
    ${entries.length > 8 ? `<p class="transfer-review-more">${countLabel(entries.length - 8, "more item")}</p>` : ""}
  `;
}

function renderTransferDraftList(drafts = [], type) {
  if (!drafts.length) return '<p class="transfer-review-empty">None</p>';

  return `
    <ul class="transfer-review-list">
      ${drafts.map(draft => {
        const number = Number(draft.number || 0);
        const title = type === "notes"
          ? `Draft ${number} Notes`
          : `Draft ${number}: ${draft.title || "Untitled draft"}`;
        const meta = type === "added"
          ? `${wordCountText(draft.wordCount)}, ${versionCountText(draft.versionCount)}`
          : type === "removed"
            ? `${wordCountText(draft.wordCount)}, ${versionCountText(draft.versionCount)}`
          : type === "notes"
            ? wordCountChangeText(draft.previousWordCount, draft.wordCount)
            : `${wordCountChangeText(draft.previousWordCount, draft.wordCount)}, ${countLabel(draft.newVersions, "new saved version")} (${versionCountText(draft.versionCount)} total)`;
        return `
          <li>
            <span class="transfer-review-path">${escapeHtml(title)}</span>
            <span class="transfer-review-status">${escapeHtml(meta)}</span>
          </li>
        `;
      }).join("")}
    </ul>
  `;
}

function transferStoryChangeCount(story = {}) {
  return Number(Boolean(story.projectNotes?.changed))
    + Number(story.addedDrafts?.length || 0)
    + Number(story.removedDrafts?.length || 0)
    + Number(story.changedDrafts?.length || 0)
    + Number(story.changedDraftNotes?.length || 0);
}

function renderTransferStoryLines(story = {}, options = {}) {
  const project = story.projectNotes || {};
  const projectChanged = Boolean(project.changed);
  const lines = [];

  if (projectChanged) {
    lines.push({
      title: "Project notes changed",
      detail: `${wordCountChangeText(project.previousWordCount, project.wordCount)}, ${countLabel(project.newVersions, "new saved version")}`
    });
  }

  (story.addedDrafts || []).forEach(draft => {
    lines.push({
      title: `Draft ${Number(draft.number || 0)} added`,
      detail: `${wordCountText(draft.wordCount)}, ${versionCountText(draft.versionCount)}`
    });
  });

  (story.changedDrafts || []).forEach(draft => {
    lines.push({
      title: `Draft ${Number(draft.number || 0)} changed`,
      detail: `${wordCountChangeText(draft.previousWordCount, draft.wordCount)}, ${countLabel(draft.newVersions, "new saved version")}`
    });
  });

  (story.changedDraftNotes || []).forEach(notes => {
    const newVersionsText = Number(notes.newVersions || 0) > 0
      ? `, ${countLabel(notes.newVersions, "new saved version")}`
      : "";
    lines.push({
      title: `Draft ${Number(notes.number || 0)} notes changed`,
      detail: `${wordCountChangeText(notes.previousWordCount, notes.wordCount)}${newVersionsText}`
    });
  });

  (story.removedDrafts || []).forEach(draft => {
    lines.push({
      title: `Draft ${Number(draft.number || 0)} removed from USB copy`,
      detail: `${wordCountText(draft.wordCount)}, ${versionCountText(draft.versionCount)}`
    });
  });

  if (!lines.length) {
    const merge = options.merge || {};
    const mergeListsUsbChanges = Number(merge.counts?.usbOnly || 0) > 0 || Number(merge.counts?.bothChanged || 0) > 0;
    return mergeListsUsbChanges
      ? '<p class="transfer-review-empty">USB changes are listed in the story merge review above.</p>'
      : '<p class="transfer-review-empty">No story changes detected in the USB copy.</p>';
  }

  return `
    <ul class="transfer-review-plain-list">
      ${lines.slice(0, 14).map(line => `
        <li>
          <strong>${escapeHtml(line.title)}</strong>
          <span>${escapeHtml(line.detail)}</span>
        </li>
      `).join("")}
    </ul>
    ${lines.length > 14 ? `<p class="transfer-review-more">${countLabel(lines.length - 14, "more story change")}</p>` : ""}
  `;
}

function transferMergeVerdict(merge = {}) {
  if (merge.status === "no-changes") {
    return {
      title: merge.localStoryMissing ? "Ready to import USB story" : "The files contain the same saved versions",
      body: merge.localStoryMissing
        ? "No local copy of this story is registered on this computer. Proceed will import the USB story and saved versions."
        : "This computer already contains every saved version found on the USB, and the USB contains every version found here.",
      ready: true
    };
  }
  if (merge.status === "usb-only") {
    return {
      title: merge.localStoryMissing ? "Ready to import USB story" : "The USB contains saved versions missing from this computer",
      body: merge.localStoryMissing
        ? "No local copy of this story is registered on this computer. Proceed will import the USB story and saved versions."
        : "Proceed will back up this computer, add the missing USB versions, and keep the version with the latest save time current.",
      ready: true
    };
  }
  if (merge.status === "local-only") {
    return {
      title: "This computer already contains all USB versions",
      body: "There are no saved versions on the USB that need to be added. This computer also contains additional local versions.",
      ready: true
    };
  }
  if (merge.status === "both-changed") {
    return {
      title: "Both files contain saved versions missing from the other",
      body: "A merge is required. This computer's file will be preserved, USB versions will be added, and each history will be ordered by save time. The latest saved version stays current.",
      ready: false
    };
  }
  return {
    title: "Story merge review unavailable",
    body: merge.reason || "DraftDiff could not prepare the story-level merge summary for this transfer package.",
    ready: false
  };
}

function transferMergeEntryLabel(entry = {}) {
  if (entry.type === "projectNotes") return "Project notes";
  if (entry.type === "draftNotes") return `Draft ${Number(entry.number || 0)} notes`;
  if (entry.type === "draft") return `Draft ${Number(entry.number || 0)}: ${entry.title || "Untitled draft"}`;
  return entry.title || "Story item";
}

function transferMergeCopyLabel(source, sentenceStart = false) {
  if (source === "usb") return "USB copy";
  if (source === "local") return sentenceStart ? "This computer's copy" : "this computer's copy";
  return sentenceStart ? "Newest copy" : "newest copy";
}

function transferMergeEntryTime(entry = {}, source) {
  if (source === "usb") return entry.usbLatestAt || entry.usbCurrentAt || "";
  if (source === "local") return entry.localLatestAt || entry.localCurrentAt || "";
  if (source === "base") return entry.baseCurrentAt || "";
  return "";
}

function transferMergeTimeText(value) {
  return value ? formatVersionDate(value) : "";
}

function transferMergeCopyText(entry, source, sentenceStart = false) {
  const time = transferMergeTimeText(transferMergeEntryTime(entry, source));
  return `${transferMergeCopyLabel(source, sentenceStart)}${time ? ` from ${time}` : ""}`;
}

function transferMergeListDetail(entry = {}, mode, options = {}) {
  const usbMissing = Number(entry.usbUniqueVersions || 0);
  const localMissing = Number(entry.localUniqueVersions || 0);
  const usbLatest = transferMergeCopyText(entry, "usb", true);
  const localLatest = transferMergeCopyText(entry, "local", true);
  const wordCounts = `Current word counts - USB: ${wordCountText(entry.usbWordCount)}; this computer: ${wordCountText(entry.localWordCount)}.`;
  const missingUsbDates = (entry.usbUniqueVersionDetails || [])
    .map(version => version.savedAt ? transferMergeTimeText(version.savedAt) : "unknown date")
    .join(", ");
  if (mode === "both") {
    return `USB has ${countLabel(usbMissing, "version")} missing locally; this computer has ${countLabel(localMissing, "version")} missing from USB. ${usbLatest}; ${localLatest}. ${wordCounts} Both histories will be combined by timestamp, with the latest save current.`;
  }

  if (mode === "usb") {
    if (options.localStoryMissing || !entry.localCurrentAt) {
      return `USB has ${countLabel(usbMissing, "saved version")} to import. ${usbLatest}. ${wordCounts}`;
    }
    if (entry.currentTextMatches) {
      return `The current text matches on both files, but the USB contains ${countLabel(usbMissing, "additional saved history entry")} not stored locally${missingUsbDates ? `, saved ${missingUsbDates}` : ""}. ${wordCounts} The missing history will be added without changing the current draft text.`;
    }
    return `USB has ${countLabel(usbMissing, "saved version")} not on this computer. ${usbLatest}; ${localLatest}. ${wordCounts} The missing versions will be added and the latest save will stay current.`;
  }

  return `This computer already contains every USB version and has ${countLabel(localMissing, "additional local version")}. ${localLatest}; ${usbLatest}. ${wordCounts} No versions need to be imported from USB. The additional local ${localMissing === 1 ? "version will be" : "versions will be"} preserved.`;
}

function transferTimelineSourceLabel(source) {
  if (source === "usb") return "USB";
  if (source === "local") return "Local";
  return "Local + USB";
}

function transferTimelineDiffParts(beforeText, afterText) {
  if (!beforeText) {
    return DiffCore.tokenizeText(afterText || "").map(token => ({ ...token, type: "same" }));
  }
  return DiffCore.restoreIdenticalChangedTokens(DiffCore.diffSequence(
    DiffCore.tokenizeText(beforeText),
    DiffCore.tokenizeText(afterText || "")
  ));
}

function renderTransferTimelineText(version, previousVersion) {
  const parts = transferTimelineDiffParts(previousVersion?.content || "", version?.content || "");
  if (!parts.length) return '<span class="transfer-timeline-empty">No text</span>';
  return parts.map(part => {
    const className = part.type === "added"
      ? "transfer-timeline-added"
      : part.type === "removed"
        ? "transfer-timeline-removed"
        : "";
    return `<span${className ? ` class="${className}"` : ""}>${escapeHtml(part.text || "")}</span>`;
  }).join("");
}

function transferTimelineEntryKey(entry = {}) {
  return `${entry.type || "item"}:${Number(entry.number || 0)}:${entry.title || ""}`;
}

function transferTimelineGapText(entry, mode) {
  const usbVersions = Number(entry.usbUniqueVersions || 0);
  const localVersions = Number(entry.localUniqueVersions || 0);
  if (mode === "usb") return `${countLabel(usbVersions, "USB version")} to import`;
  if (mode === "local") return `${countLabel(localVersions, "additional local version")}`;
  return `${countLabel(usbVersions + localVersions, "mixed version")} to merge`;
}

function renderTransferTimelineEntry(entry = {}, mode, options = {}) {
  const timeline = Array.isArray(entry.timeline) ? entry.timeline : [];
  if (!timeline.length) return "";
  const entryKey = transferTimelineEntryKey(entry);
  const expanded = transferExpandedTimelines.has(entryKey);
  const collapsible = timeline.length > 10;
  const visibleVersions = collapsible && !expanded
    ? [
        { version: timeline[0], originalIndex: 0 },
        { gap: true },
        { version: timeline[timeline.length - 1], originalIndex: timeline.length - 1 }
      ]
    : timeline.map((version, originalIndex) => ({ version, originalIndex }));
  const latestIndex = timeline.length - 1;

  return `
    <article class="transfer-timeline-group">
      <header class="transfer-timeline-group-header">
        <h4>${escapeHtml(transferMergeEntryLabel(entry))}</h4>
        <span>${countLabel(timeline.length, "unique saved version")}</span>
      </header>
      <div class="transfer-timeline" aria-label="Chronological saved-version comparison">
        ${visibleVersions.map((item, visibleIndex) => {
          if (item.gap) {
            return `
              <div class="transfer-timeline-arrow" aria-hidden="true"><span></span></div>
              <div class="transfer-timeline-gap">
                <strong>${escapeHtml(transferTimelineGapText(entry, mode))}</strong>
                <span>${timeline.length.toLocaleString("en-GB")} unique saved versions in the complete history</span>
              </div>
              <div class="transfer-timeline-arrow" aria-hidden="true"><span></span></div>
            `;
          }
          const version = item.version;
          const index = item.originalIndex;
          const previousVersion = expanded || !collapsible
            ? timeline[index - 1]
            : index === latestIndex
              ? timeline[0]
              : null;
          const zoomIndex = transferTimelineZoomPages.push({
            title: `${transferMergeEntryLabel(entry)} · Version ${Number(version.version || index + 1)}`,
            meta: `${transferTimelineSourceLabel(version.source)} · ${transferMergeTimeText(version.savedAt) || "Unknown save date"}${index === latestIndex ? " · Latest, remains current" : ""}`,
            html: renderTransferTimelineText(version, previousVersion)
          }) - 1;
          return `
          ${visibleIndex && !(collapsible && !expanded && visibleIndex === 2) ? '<div class="transfer-timeline-arrow" aria-hidden="true"><span></span></div>' : ""}
          <div class="transfer-timeline-step">
            <div class="transfer-timeline-meta">
              <strong>Version ${Number(version.version || index + 1)}</strong>
              <span class="transfer-timeline-source is-${escapeHtml(version.source || "both")}">${escapeHtml(transferTimelineSourceLabel(version.source))}</span>
              <time>${escapeHtml(transferMergeTimeText(version.savedAt) || "Unknown save date")}</time>
            </div>
            <div class="transfer-timeline-page${index === latestIndex ? " is-latest" : ""}">
              <button class="transfer-timeline-zoom" type="button" data-transfer-timeline-zoom="${zoomIndex}" aria-label="Enlarge ${escapeHtml(transferMergeEntryLabel(entry))} version ${Number(version.version || index + 1)}">Zoom</button>
              ${index === latestIndex ? '<span class="transfer-timeline-latest">Latest · remains current</span>' : ""}
              <div class="transfer-timeline-paper">${renderTransferTimelineText(version, previousVersion)}</div>
            </div>
          </div>
        `}).join("")}
      </div>
      ${collapsible ? `
        <button class="transfer-timeline-expand" type="button" data-transfer-timeline-expand="${escapeHtml(entryKey)}" aria-expanded="${expanded}">
          ${expanded ? "Collapse history" : `Show all ${timeline.length.toLocaleString("en-GB")} versions`}
        </button>
      ` : ""}
      <p class="transfer-timeline-detail">${escapeHtml(transferMergeListDetail(entry, mode, options))}</p>
    </article>
  `;
}

function renderTransferReviewCategory({ title, description, entries = [], mode, className, options = {} }) {
  if (!entries.length) return "";
  return `
    <section class="transfer-review-category ${escapeHtml(className)}">
      <header class="transfer-review-category-header">
        <div>
          <span class="transfer-review-category-count">${entries.length.toLocaleString("en-GB")}</span>
          <h3>${escapeHtml(title)}</h3>
        </div>
        <p>${escapeHtml(description)}</p>
      </header>
      <div class="transfer-timeline-groups">
        ${entries.map(entry => renderTransferTimelineEntry(entry, mode, options)).join("")}
      </div>
    </section>
  `;
}

function renderTransferMergeVisuals(merge = {}) {
  return `
    <div class="transfer-timeline-legend" aria-label="Version comparison legend">
      <span><i class="is-added"></i>Added in this version</span>
      <span><i class="is-removed"></i>Removed in this version</span>
      <strong>Every displayed version will be retained</strong>
    </div>
    <div class="transfer-review-categories">
      ${renderTransferReviewCategory({
        title: merge.localStoryMissing ? "Will be imported from USB" : "USB versions to import",
        description: "The USB contains saved versions that this computer does not contain.",
        entries: merge.usbOnly || [],
        mode: "usb",
        className: "is-usb",
        options: { localStoryMissing: merge.localStoryMissing }
      })}
      ${renderTransferReviewCategory({
        title: "Local history already ahead",
        description: "This computer contains every USB version plus additional local versions.",
        entries: merge.localOnly || [],
        mode: "local",
        className: "is-local"
      })}
      ${renderTransferReviewCategory({
        title: "Histories requiring a merge",
        description: "Each file contains saved versions missing from the other.",
        entries: merge.bothChanged || [],
        mode: "both",
        className: "is-merge"
      })}
    </div>
  `;
}

function renderTransferMergeReview(merge = {}) {
  if (merge.status === "unknown") {
    return `<p class="transfer-review-empty">${escapeHtml(merge.reason || "Story-level merge review is unavailable for this package.")}</p>`;
  }
  if (merge.status === "no-changes") {
    return '<p class="transfer-review-empty">The USB and this computer contain the same saved versions.</p>';
  }

  return `
    ${renderTransferMergeVisuals(merge)}
  `;
}

function renderTransferReview(payload) {
  if (!els.transferReviewOverlay || !els.transferReviewContent) return;

  if (latestTransferReview !== payload) transferExpandedTimelines = new Set();
  latestTransferReview = payload;
  transferTimelineZoomPages = [];
  const files = payload.files || {};
  const merge = payload.merge || {};
  const mergeVerdict = transferMergeVerdict(merge);
  const counts = files.counts || {};
  const needsReviewCount = Number(counts.conflicts || 0)
    + Number(counts.localOnlyChanges || 0)
    + Number(counts.localAdded || 0)
    + Number(counts.usbDeleted || 0)
    + Number(counts.localDeleted || 0);
  const localChangedEntries = [
    ...(files.conflicts || []),
    ...(files.localOnlyChanges || []),
    ...(files.localAdded || []),
    ...(files.localDeleted || [])
  ];
  const usbDeleteEntries = files.usbDeleted || [];
  const exportedAt = payload.manifest?.createdAt ? formatDate(payload.manifest.createdAt) : "";
  if (els.transferReviewTitle) {
    els.transferReviewTitle.textContent = mergeVerdict.title;
  }

  els.transferReviewContent.innerHTML = `
    <section class="transfer-review-verdict ${mergeVerdict.ready ? "is-ready" : "needs-check"}">
      <h3>${escapeHtml(mergeVerdict.title)}</h3>
      <p>${escapeHtml(mergeVerdict.body)}</p>
    </section>

    <section class="transfer-review-simple-grid">
      <div>
        <span class="transfer-review-number">${Number(merge.counts?.usbOnly || 0).toLocaleString("en-GB")}</span>
        <strong>area${Number(merge.counts?.usbOnly || 0) === 1 ? "" : "s"} with missing USB versions</strong>
        <p>The USB contains saved versions that this computer does not contain.</p>
      </div>
      <div>
        <span class="transfer-review-number">${Number(merge.counts?.localOnly || 0).toLocaleString("en-GB")}</span>
        <strong>area${Number(merge.counts?.localOnly || 0) === 1 ? "" : "s"} already ahead locally</strong>
        <p>This computer contains every USB version plus additional local versions.</p>
      </div>
      <div>
        <span class="transfer-review-number">${Number(merge.counts?.bothChanged || 0).toLocaleString("en-GB")}</span>
        <strong>area${Number(merge.counts?.bothChanged || 0) === 1 ? "" : "s"} requiring a merge</strong>
        <p>Each file contains saved versions missing from the other.</p>
      </div>
    </section>

    <section class="transfer-review-section transfer-review-story">
      <h3>Story merge review</h3>
      ${renderTransferMergeReview(merge)}
    </section>

    <section class="transfer-review-section">
      <h3>Check before proceeding</h3>
      ${localChangedEntries.length || usbDeleteEntries.length
        ? `
          ${localChangedEntries.length ? `<h4>Changed on this computer since export</h4>${renderTransferBriefList(localChangedEntries)}` : ""}
          ${usbDeleteEntries.length ? `<h4>Deleted from USB copy</h4>${renderTransferBriefList(usbDeleteEntries)}` : ""}
        `
        : '<p class="transfer-review-empty">Nothing extra to check.</p>'}
    </section>

    <section class="transfer-review-section">
      <h3>What Proceed to Import will do</h3>
      <ul class="transfer-review-plain-list">
        <li><strong>Back up this computer first</strong><span>The current story file and this story's matching history files are copied to a dated backup folder.</span></li>
        <li><strong>Import only this story</strong><span>Other stories in the shared backup folder are left alone.</span></li>
        <li><strong>Preserve this computer's file</strong><span>The local story is not overwritten wholesale; missing USB versions are merged into it.</span></li>
        <li><strong>Combine histories by timestamp</strong><span>All unique local and USB versions are retained, ordered by their saved timestamps, and the latest saved version stays current.</span></li>
      </ul>
    </section>

    <details class="transfer-review-technical">
      <summary>Technical file details</summary>
      <p class="transfer-review-meta">
        ${escapeHtml(payload.packageFolderPath || "")}${exportedAt ? ` - exported ${escapeHtml(exportedAt)}` : ""}
      </p>
      <div class="transfer-review-columns">
        ${renderTransferFileGroup("Conflicts", files.conflicts || [])}
        ${renderTransferFileGroup("Added on USB", files.usbAdded || [])}
        ${renderTransferFileGroup("Changed on USB", files.safeUpdates || [])}
        ${renderTransferFileGroup("Added on this computer", files.localAdded || [])}
        ${renderTransferFileGroup("Changed on this computer", files.localOnlyChanges || [])}
        ${renderTransferFileGroup("Deleted on USB", files.usbDeleted || [])}
        ${renderTransferFileGroup("Deleted on this computer", files.localDeleted || [])}
        ${renderTransferFileGroup("Not yet on this computer", files.localMissing || [])}
        ${renderTransferFileGroup("Already matching", files.alreadyMatching || [])}
      </div>
    </details>
  `;
  if (els.transferImportProceed) els.transferImportProceed.disabled = !payload.packageFolderPath;
  els.transferReviewOverlay.hidden = false;
}

function hideTransferReview() {
  hideTransferPageZoom();
  latestTransferReview = null;
  transferExpandedTimelines = new Set();
  if (els.transferReviewOverlay) els.transferReviewOverlay.hidden = true;
  if (els.transferImportProceed) els.transferImportProceed.disabled = false;
}

function showPagePreviewZoom(page, returnFocus = null) {
  if (!page || !els.transferPageZoom) return;
  pagePreviewZoomReturnFocus = returnFocus instanceof HTMLElement ? returnFocus : null;
  if (els.transferPageZoomTitle) els.transferPageZoomTitle.textContent = page.title;
  if (els.transferPageZoomMeta) els.transferPageZoomMeta.textContent = page.meta;
  if (els.transferPageZoomPaper) {
    els.transferPageZoomPaper.innerHTML = page.html
      ?? (Object.hasOwn(page, "afterText")
        ? selectionComparisonTextHtml(page.beforeText || "", page.afterText || "")
        : escapeHtml(page.text || ""));
  }
  els.transferPageZoom.hidden = false;
  els.transferPageZoomClose?.focus();
}

function showTransferPageZoom(index, returnFocus = null) {
  showPagePreviewZoom(transferTimelineZoomPages[Number(index)], returnFocus);
}

function showSelectionMenuPageZoom(key, returnFocus = null) {
  showPagePreviewZoom(selectionMenuZoomPages.get(String(key || "")), returnFocus);
}

function hideTransferPageZoom() {
  if (els.transferPageZoom) els.transferPageZoom.hidden = true;
  if (els.transferPageZoomPaper) els.transferPageZoomPaper.innerHTML = "";
  const returnFocus = pagePreviewZoomReturnFocus;
  pagePreviewZoomReturnFocus = null;
  if (returnFocus?.isConnected) returnFocus.focus();
}

function toggleTransferTimeline(entryKey) {
  if (!entryKey || !latestTransferReview) return;
  const scrollTop = els.transferReviewContent?.scrollTop || 0;
  if (transferExpandedTimelines.has(entryKey)) transferExpandedTimelines.delete(entryKey);
  else transferExpandedTimelines.add(entryKey);
  renderTransferReview(latestTransferReview);
  if (els.transferReviewContent) els.transferReviewContent.scrollTop = scrollTop;
}

function cancelTransferImport() {
  hideTransferReview();
  setStatus("USB import cancelled");
}

function importConfirmationText(review) {
  const counts = review?.files?.counts || {};
  const needsReviewCount = Number(counts.conflicts || 0)
    + Number(counts.localOnlyChanges || 0)
    + Number(counts.localAdded || 0)
    + Number(counts.usbDeleted || 0)
    + Number(counts.localDeleted || 0);
  const conflictText = needsReviewCount
    ? `\n\n${needsReviewCount.toLocaleString("en-GB")} item${needsReviewCount === 1 ? "" : "s"} need review.`
    : "";
  if (review?.merge?.localStoryMissing) {
    return `Proceed with this USB import?\n\nNo local copy of this story is registered on this computer. DraftDiff will import the USB story and saved versions.${conflictText}`;
  }
  return `Proceed with this USB import?\n\nDraftDiff will back up this computer, preserve the local story file, add versions missing from the USB, and combine each version history in timestamp order. The latest saved version stays current.${conflictText}`;
}

function usbImportIdentityResolution(review) {
  const decision = review?.targetStory?.identityDecision;
  if (!decision?.required) return "";
  const previousLocation = decision.previousFilePath || decision.fileName || "the previous local file";
  const sameRecordedIdentity = decision.type === "restore-retired-id";
  const restore = window.confirm(sameRecordedIdentity
    ? `This USB transfer has the identity of a story whose local copy was recorded as deleted:\n\n${previousLocation}\n\nRestore it as the same story?`
    : `A deleted story with the same filename is recorded on this computer:\n\n${previousLocation}\n\nMerge this import with that previous story and reuse its identity?`);
  if (restore) return "restore";
  const createNew = window.confirm(
    `Import this as a new, unrelated story with a new identity instead?\n\nChoose Cancel to stop the import without changing anything.`
  );
  return createNew ? "new" : null;
}

async function proceedTransferImport() {
  if (!latestTransferReview?.packageFolderPath) return;
  const review = latestTransferReview;
  const identityResolution = usbImportIdentityResolution(review);
  if (identityResolution === null) return;
  if (!window.confirm(importConfirmationText(review))) return;

  closeFileMenu();
  if (els.transferImportProceed) els.transferImportProceed.disabled = true;
  if (els.transferImportCancel) els.transferImportCancel.disabled = true;
  setStatus("Importing USB transfer...");

  try {
    await showAppProgress({
      title: "Importing USB transfer",
      step: "Merging transfer files...",
      completed: 0,
      total: 6
    });
    const response = await fetch("/api/usb-transfer/import", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        packageFolderPath: review.packageFolderPath,
        identityResolution
      })
    });
    if (!response.ok) throw new Error(await response.text());

    const payload = await response.json();
    if (!payload.ok) throw new Error(payload.error || "USB import failed");

    hideTransferReview();
    if (payload.backgroundImport) {
      setStatus(`USB import complete for ${payload.fileName || "registered story"}; the open story was left unchanged`);
      return;
    }
    updateStoragePathsFromPayload(payload);
    linkedTextPath = payload.filePath || linkedTextPath || "";
    await showAppProgress({
      title: "Importing USB transfer",
      step: "Applying imported story...",
      detail: payload.fileName || "",
      completed: 2,
      total: 6
    });
    await applyTextProject(payload.text || "", payload.fileName || projectFileName || "draft-history.txt", {
      preserveFormatsFrom: null,
      filePath: linkedTextPath,
      showProgress: true,
      progressTitle: "Importing USB transfer",
      progressOffset: 2,
      progressTotal: 6
    });
    setStatus(payload.importDestination?.usedFallback
      ? `USB import complete; imported to ${payload.filePath || "app data folder"}`
      : `USB import complete; backup saved to ${payload.backup?.backupFolderPath || "backup folder"}`);
  } catch (error) {
    console.error(error);
    setStatus(`USB import failed: ${error?.message || "Unknown error"}`);
    if (els.transferImportProceed) els.transferImportProceed.disabled = false;
  } finally {
    hideAppProgress();
    if (els.transferImportCancel) els.transferImportCancel.disabled = false;
  }
}

async function requestUsbTransferExport(body) {
  if (window.draftDiffDesktop?.exportUsbTransfer) {
    const payload = await window.draftDiffDesktop.exportUsbTransfer(body);
    if (payload?.ok === false && !payload.cancelled) {
      throw new Error(payload.error || payload.message || "USB export failed");
    }
    return payload;
  }

  const response = await fetch("/api/usb-transfer/export", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body
  });
  if (!response.ok) {
    let message = "";
    try {
      const payload = await response.json();
      message = payload?.error || payload?.message || "";
    } catch {
      message = response.statusText || `HTTP ${response.status}`;
    }
    throw new Error(message || `HTTP ${response.status}`);
  }
  return response.json();
}

async function exportUsbTransfer() {
  closeFileMenu();
  if (!state) return;

  try {
    suppressLinkedTextBlockedStatus(30000);
    syncFromInputs();
    saveCurrentViewState();
    flushDraftVersionCaptures();
    rememberLinkedProjectState();
    window.clearTimeout(saveTimer);
    setStatus("Choose USB transfer folder...");
    const payload = await requestUsbTransferExport(prepareClosePayload({ skipSummary: true }));
    if (payload.cancelled) {
      setStatus("USB export cancelled");
      return;
    }

    suppressLinkedTextBlockedStatus(5000);
    setStatus(`USB transfer exported: ${payload.packageFolderPath || "package created"}`);
  } catch (error) {
    console.error(error);
    suppressLinkedTextBlockedStatusUntil = 0;
    setStatus(readableUsbExportFailure(error?.message));
  }
}

async function reviewUsbTransfer() {
  closeFileMenu();

  try {
    setStatus("Choose returned USB transfer folder...");
    const response = await fetch("/api/usb-transfer/review", { method: "POST" });
    if (!response.ok) throw new Error(await response.text());

    const payload = await response.json();
    if (payload.cancelled) {
      setStatus("USB review cancelled");
      return;
    }

    renderTransferReview(payload);
    setStatus(`USB import review ready · ${USB_REVIEW_BUILD}`);
  } catch (error) {
    console.error(error);
    setStatus(`USB review failed: ${error?.message || "Unknown error"}`);
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

async function saveNow(options = {}) {
  if (!state) return false;

  if (isSaving) {
    saveQueued = true;
    setStatus("Saving...");
    return false;
  }

  const skipInputSync = Boolean(options.skipInputSync);
  if (skipInputSync) {
    saveCurrentViewState({ syncDom: false });
  } else {
    syncFromInputs();
    saveCurrentViewState();
  }
  const capturedVersionPageKeys = skipInputSync ? [] : flushDraftVersionCaptures();
  if (capturedVersionPageKeys.includes(activeVersionHistoryPageKey())) renderDiffSoon("Loading version history");
  rememberLinkedProjectState();
  const requestRevision = stateRevision;
  isSaving = true;
  setStatus("Saving...");
  const requestBody = {
    state,
    filePath: linkedTextPath,
    fileName: projectFileName,
    skipLinkedTextFileWrite: Boolean(options.skipLinkedTextFileWrite)
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
      return Boolean(linkedTextPath && !linkedTextFileMissing);
    }

    ensureDisplaySelection();
    if (!linkedTextPath && exportPath && projectFileName === "draft-history.txt") {
      projectFileName = fileNameFromPath(exportPath) || projectFileName;
    }
    updateProjectTitle();
    if (linkedTextFileMissing) {
      setStatus("Story file missing; choose the moved file before linked saves resume");
      if (options.promptForMissingLinkedTextFile !== false) {
        window.setTimeout(promptForMissingLinkedTextFile, 0);
      }
      renderDraftTabs();
      return false;
    }
    setStatus(linkedTextPath ? `Saved ${formatDate(state.updatedAt)}` : "Saved companion; no text file linked");
    renderDraftTabs();
    return Boolean(linkedTextPath && !linkedTextFileMissing);
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
  linkedTextFileMissing = Boolean(payload.linkedTextFileMissing);
  linkedTextMissingPath = payload.linkedTextMissingPath || "";
  backupStorageManualDeletion = readyForManualDeletionFromPayload(payload)
    || normalizeReadyForManualDeletion();
  projectFileName = payload.linkedTextFileName || fileNameFromPath(exportPath) || projectFileName;
  updateProjectTitle();
  syncBackupMenu();
  restoreViewStateForProject();
  setStatus(linkedTextFileMissing
    ? "Story file missing; choose the moved file"
    : linkedTextPath ? `Saved ${formatDate(state.updatedAt)}` : "Saved companion; no text file linked");
  render();
  resetHistory();
  focusPageEditor(activeEditorKey);
  if (backupFolderMissing) {
    setStatus("Backup folder missing; choose the moved folder");
  }
  window.setTimeout(async () => {
    try {
      if (linkedTextFileMissing) await promptForMissingLinkedTextFile();
      if (backupFolderMissing) await promptForMissingBackupFolder();
    } catch (error) {
      console.error(error);
    } finally {
      showManualDeletionReminder(backupStorageManualDeletion);
    }
  }, 0);
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
  if (command === "undo") {
    undoProjectChange();
    return;
  }

  if (command === "redo") {
    redoProjectChange();
    return;
  }

  const editorEl = editorElementForKey(editorKey);
  if (!editorEl) return;
  activeEditorKey = editorKey;
  const beforeEntry = pageHistoryEntryForKey(editorKey);
  execRichTextCommand(command, { document, editor: editorEl });
  syncEditorDomMutation(editorEl, beforeEntry);
}

function openDraftVersionHistoryForDraft(draftId) {
  const draft = draftById(draftId);
  if (!draft) return;

  syncPageFromDom(draftContentKey(draft.id));
  if (flushDraftVersionCapture(draft.id, { markChanged: false })) {
    scheduleVersionHistoryPageSave(draftContentKey(draft.id));
  }
  versionHistoryDraftId = draftContentKey(draft.id);
  historyVersionFilterOpen = null;
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

function openDraftNotesVersionHistory(draftId) {
  const draft = draftById(draftId);
  if (!draft?.notes) return;

  const pageKey = draftNotesKey(draft.id);
  syncPageFromDom(pageKey);
  if (flushPageVersionCapture(pageKey, { markChanged: false })) {
    scheduleVersionHistoryPageSave(pageKey);
  }
  versionHistoryDraftId = pageKey;
  historyVersionFilterOpen = null;
  showChanges = false;
  activeArea = "draft";
  selectedDraftId = draft.id;
  activeEditorKey = pageKey;
  displayPage(pageKey, true);
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
  historyVersionFilterOpen = null;
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
  if (parsed?.type === "notes") openDraftNotesVersionHistory(parsed.draftId);
}

function closeVersionHistory() {
  if (!versionHistoryDraftId) return;
  versionHistoryDraftId = null;
  historyVersionFilterOpen = null;
  clearHistoryVirtualState();
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
  clearDraftVersionTimer(draftNotesKey(draftId));
  if (parseDraftPageKey(activeVersionHistoryPageKey())?.draftId === draftId) versionHistoryDraftId = null;
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
els.fileManageBackupStorage?.addEventListener("click", openBackupStorageManager);
els.fileGenerateHistorySummary?.addEventListener("click", generateVersionHistorySummary);
els.fileUsbExport?.addEventListener("click", exportUsbTransfer);
els.fileUsbReview?.addEventListener("click", reviewUsbTransfer);
els.fileClose.addEventListener("click", closeApp);
els.summaryProgressOpen?.addEventListener("click", openGeneratedSummaryReport);
els.summaryProgressReveal?.addEventListener("click", revealGeneratedSummaryReport);
els.summaryProgressClose?.addEventListener("click", hideSummaryProgressOverlay);
els.backupStorageClose?.addEventListener("click", closeBackupStorageManager);
els.backupStorageRescan?.addEventListener("click", () => runBackupStorageJob("scan"));
els.backupStorageArchive?.addEventListener("click", () => runBackupStorageJob("archive"));
els.backupStorageExpiryRefresh?.addEventListener("click", () => {
  backupStorageExpiryNotice = "";
  runBackupStorageExpiryJob("expiry-scan");
});
els.backupStorageExpiryPrepare?.addEventListener("click", prepareExpiredBackupArchives);
els.backupStorageManualDeletionOpen?.addEventListener("click", () => openManualDeletionFolder());
els.backupStorageOverlay?.addEventListener("keydown", handleBackupStorageKeydown);
els.backupStorageOverlay?.addEventListener("click", event => {
  if (event.target === els.backupStorageOverlay) closeBackupStorageManager();
});
els.manualDeletionReminderOpen?.addEventListener("click", () => {
  openManualDeletionFolder({ closeReminder: true });
});
els.manualDeletionReminderLater?.addEventListener("click", hideManualDeletionReminder);
els.manualDeletionReminder?.addEventListener("keydown", handleManualDeletionReminderKeydown);
els.manualDeletionReminder?.addEventListener("click", event => {
  if (event.target === els.manualDeletionReminder) hideManualDeletionReminder();
});
els.transferReviewClose?.addEventListener("click", hideTransferReview);
els.transferImportCancel?.addEventListener("click", cancelTransferImport);
els.transferImportProceed?.addEventListener("click", proceedTransferImport);
els.transferReviewContent?.addEventListener("click", event => {
  const expandButton = event.target.closest("[data-transfer-timeline-expand]");
  if (expandButton) {
    toggleTransferTimeline(expandButton.dataset.transferTimelineExpand);
    return;
  }
  const button = event.target.closest("[data-transfer-timeline-zoom]");
  if (button) showTransferPageZoom(button.dataset.transferTimelineZoom, button);
});
els.transferPageZoomClose?.addEventListener("click", hideTransferPageZoom);
els.transferPageZoom?.addEventListener("click", event => {
  if (event.target === els.transferPageZoom) hideTransferPageZoom();
});
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
  const openSession = browserFileOpenSession || await beginTextProjectOpen();
  browserFileOpenSession = null;
  if (!file) {
    finishTextProjectOpen(openSession, { resume: true });
    return;
  }

  let selectedFileRead = false;
  let completed = false;
  try {
    const previousLinkedTextPath = linkedTextPath;
    await showAppProgress({
      title: "Opening file",
      step: "Reading selected file...",
      detail: file.name,
      completed: 0,
      total: 6
    });
    let payload = null;
    if (window.draftDiffDesktop?.openFallbackTextFile) {
      payload = await window.draftDiffDesktop.openFallbackTextFile(file);
      if (payload?.ok === false) throw new Error(payload.error || "Open failed");
    }
    const text = payload?.text ?? await file.text();
    selectedFileRead = true;
    await showAppProgress({
      title: "Opening file",
      step: "Preserving current project...",
      detail: file.name,
      completed: 1,
      total: 6
    });
    const selectedFileIsLinked = payload?.matchesLinkedTextFile === true
      || filePathsMatch(previousLinkedTextPath, payload?.filePath);
    const previousState = await prepareCurrentProjectForOpen({
      skipLinkedTextFileWrite: payload ? selectedFileIsLinked : true
    });
    if (payload?.filePath) {
      await applyOpenedTextFilePayload(payload, previousLinkedTextPath, previousState, {
        showProgress: true,
        progressTitle: "Opening file",
        progressOffset: 2,
        progressTotal: 6
      });
    } else {
      await applyTextProject(text, file.name, {
        clearLinkedTextFile: true,
        skipLinkedTextFileWrite: true,
        showProgress: true,
        progressTitle: "Opening file",
        progressOffset: 2,
        progressTotal: 6
      });
    }
    completed = true;
  } catch (error) {
    console.error(error);
    setStatus(`Open failed: ${error?.message || "Unknown error"}`);
  } finally {
    finishTextProjectOpen(openSession, {
      completed,
      resume: !selectedFileRead
    });
    hideAppProgress();
  }
});

els.fileOpenInput.addEventListener("cancel", () => {
  const openSession = browserFileOpenSession;
  browserFileOpenSession = null;
  finishTextProjectOpen(openSession, { resume: true });
  hideAppProgress();
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
  const zoomButton = event.target.closest("[data-selection-menu-zoom]");
  if (zoomButton) {
    event.preventDefault();
    event.stopPropagation();
    showSelectionMenuPageZoom(zoomButton.dataset.selectionMenuZoom, zoomButton);
    return;
  }

  const groupToggle = event.target.closest("[data-draft-tab-filter-toggle]");
  if (groupToggle) {
    event.preventDefault();
    event.stopPropagation();
    const groupKey = groupToggle.dataset.draftTabFilterToggle;
    window.setTimeout(() => toggleDraftTabFilter(groupKey), 0);
    return;
  }

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
  const groupCheckbox = event.target.closest(
    "[data-display-draft-group-start][data-display-draft-group-end]"
  );
  if (groupCheckbox) {
    if (versionHistoryDraftId) {
      renderDraftTabs();
      return;
    }
    const start = Number(groupCheckbox.dataset.displayDraftGroupStart);
    const end = Number(groupCheckbox.dataset.displayDraftGroupEnd);
    if (!Number.isInteger(start) || !Number.isInteger(end)) return;
    syncViewStateFromDom();
    displayDraftRange(start, end, groupCheckbox.checked);
    render();
    persistViewStateChange(0);
    return;
  }

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

els.draftTabs.addEventListener("toggle", event => {
  const group = event.target.closest?.("[data-draft-tab-group-key]");
  if (!group) return;
  const key = group.dataset.draftTabGroupKey;
  if (group.open) {
    draftTabExpandedGroups.add(key);
    if (!group.querySelector(":scope > .selection-menu-range-contents")?.children.length) {
      renderDraftTabs();
      return;
    }
  } else {
    draftTabExpandedGroups.delete(key);
  }
  window.requestAnimationFrame(positionOpenDraftTabGroupMenus);
}, true);

els.draftTabs.addEventListener("wheel", event => handleSelectionMenuWheel(els.draftTabs, event), {
  passive: false
});

els.tabStrip?.addEventListener("scroll", () => {
  updateTabScrollbar();
  positionOpenDraftTabGroupMenus();
}, { passive: true });
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
  renderDraftTabs();
  renderDiffSoon("Loading changes");
});

els.historyVersionFilter?.addEventListener("click", event => {
  const zoomButton = event.target.closest("[data-selection-menu-zoom]");
  if (zoomButton) {
    event.preventDefault();
    event.stopPropagation();
    showSelectionMenuPageZoom(zoomButton.dataset.selectionMenuZoom, zoomButton);
    return;
  }

  const toggle = event.target.closest("[data-history-version-filter-toggle]");
  if (toggle) {
    event.preventDefault();
    event.stopPropagation();
    const groupKey = toggle.dataset.historyVersionFilterToggle;
    window.setTimeout(() => toggleHistoryVersionFilter(groupKey), 0);
    return;
  }

  const allLabel = event.target.closest("[data-history-version-all-label]");
  if (allLabel) {
    event.preventDefault();
    const versions = versionHistoryForPageKey();
    const exclusions = normalizedHistoryVersionExclusions(activeVersionHistoryPageKey(), versions);
    setHistoryVersionRangeIncluded(0, versions.length, exclusions.size > 0);
    updateHistoryVersionSelection();
    return;
  }

  const focusVersion = event.target.closest("[data-history-version-focus-index]");
  if (!focusVersion) return;
  const index = Number(focusVersion.dataset.historyVersionFocusIndex);
  const versions = versionHistoryForPageKey();
  const includedEntries = includedHistoryVersionEntries(versions);
  const position = includedEntries.findIndex(entry => entry.index === index);
  if (position >= 0) ensureHistoryVirtualPosition(position, { scroll: true });
});

els.historyVersionFilter?.addEventListener("change", event => {
  const allControl = event.target.closest("[data-history-version-all]");
  if (allControl) {
    const versions = versionHistoryForPageKey();
    setHistoryVersionRangeIncluded(0, versions.length, allControl.checked);
    updateHistoryVersionSelection();
    return;
  }

  const versionControl = event.target.closest("[data-history-version-index]");
  if (versionControl) {
    const index = Number(versionControl.dataset.historyVersionIndex);
    if (Number.isInteger(index)) {
      setHistoryVersionRangeIncluded(index, index + 1, versionControl.checked);
      updateHistoryVersionSelection();
    }
    return;
  }

  const groupControl = event.target.closest(
    "[data-history-version-group-start][data-history-version-group-end]"
  );
  if (!groupControl) return;
  const start = Number(groupControl.dataset.historyVersionGroupStart);
  const end = Number(groupControl.dataset.historyVersionGroupEnd);
  if (!Number.isInteger(start) || !Number.isInteger(end)) return;
  setHistoryVersionRangeIncluded(start, end, groupControl.checked);
  updateHistoryVersionSelection();
});

els.historyVersionFilter?.addEventListener("toggle", event => {
  const group = event.target.closest?.("[data-history-version-group-key]");
  if (!group) return;
  const key = group.dataset.historyVersionGroupKey;
  if (group.open) {
    historyVersionExpandedGroups.add(key);
    if (!group.querySelector(":scope > .selection-menu-range-contents")?.children.length) {
      renderHistoryVersionFilter();
      return;
    }
  } else {
    historyVersionExpandedGroups.delete(key);
  }
}, true);

els.historyVersionFilter?.addEventListener(
  "wheel",
  event => handleSelectionMenuWheel(els.historyVersionFilter, event),
  { passive: false }
);

els.diffOutput.addEventListener("dblclick", event => {
  if (!(event.target instanceof Element)) return;

  const sourceToken = event.target.closest("[data-scroll-target-page-id][data-scroll-target-token-index]");
  if (!sourceToken || !els.diffOutput.contains(sourceToken)) return;

  event.preventDefault();
  jumpToComparedToken(sourceToken);
});

els.diffOutput.addEventListener("scroll", scheduleHistoryVirtualWindowUpdate, { passive: true });

els.diffOutput.addEventListener("click", event => {
  if (!(event.target instanceof Element)) return;

  const projectNotesRestoreButton = event.target.closest("[data-restore-project-notes-version-id]");
  if (projectNotesRestoreButton && els.diffOutput.contains(projectNotesRestoreButton)) {
    event.preventDefault();
    restoreProjectNotesVersion(projectNotesRestoreButton.dataset.restoreProjectNotesVersionId);
    return;
  }

  const draftNotesRestoreButton = event.target.closest("[data-restore-draft-notes-id][data-restore-version-id]");
  if (draftNotesRestoreButton && els.diffOutput.contains(draftNotesRestoreButton)) {
    event.preventDefault();
    restoreDraftNotesVersion(
      draftNotesRestoreButton.dataset.restoreDraftNotesId,
      draftNotesRestoreButton.dataset.restoreVersionId
    );
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

els.searchInput?.addEventListener("keydown", event => {
  if (event.isComposing || event.key !== "Enter") return;
  event.preventDefault();
  cycleSearch(event.shiftKey ? -1 : 1);
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

  if (
    historyVersionFilterOpen &&
    event.target instanceof Element &&
    !event.target.closest(".history-version-filter") &&
    !event.target.closest(".transfer-page-zoom")
  ) {
    toggleHistoryVersionFilter(false);
  }

  if (
    draftTabFilterOpen &&
    event.target instanceof Element &&
    !event.target.closest("#draft-tabs") &&
    !event.target.closest(".transfer-page-zoom")
  ) {
    toggleDraftTabFilter(false);
  }

  if (event.target instanceof Element && event.target.closest(".fr-picker")) return;
  closeFormatPickers();
});

document.addEventListener("selectionchange", saveCurrentEditorSelection);

document.addEventListener("keydown", event => {
  if (handleGlobalShortcut(event)) return;

  if (event.key === "Escape") {
    if (els.backupStorageOverlay && !els.backupStorageOverlay.hidden) {
      closeBackupStorageManager();
      return;
    }
    if (els.transferPageZoom && !els.transferPageZoom.hidden) {
      hideTransferPageZoom();
      return;
    }
    if (historyVersionFilterOpen) {
      toggleHistoryVersionFilter(false);
      return;
    }
    if (draftTabFilterOpen) {
      toggleDraftTabFilter(false);
      return;
    }
    closeSpellcheckMenu();
    toggleSearchScopeMenu(false);
    if (searchState.open) closeSearch();
    if (versionHistoryDraftId) closeVersionHistory();
    closeTopMenus();
    closeFormatPickers();
  }
});

document.addEventListener("scroll", positionOpenFormatPickers, true);
document.addEventListener("scroll", positionOpenDraftTabGroupMenus, true);
window.addEventListener("resize", positionOpenFormatPickers);
window.addEventListener("resize", updateTabDensity);
window.addEventListener("resize", positionOpenDraftTabGroupMenus);
window.addEventListener("resize", () => window.requestAnimationFrame(updateAllVersionsLabelDensity));
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
