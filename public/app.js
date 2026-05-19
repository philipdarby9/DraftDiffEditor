const els = {
  saveStatus: document.querySelector("#save-status"),
  projectTitle: document.querySelector("#project-title"),
  fileMenu: document.querySelector("#file-menu"),
  viewMenu: document.querySelector("#view-menu"),
  fileNew: document.querySelector("#file-new"),
  fileOpen: document.querySelector("#file-open"),
  fileSaveAs: document.querySelector("#file-save-as"),
  fileOpenInput: document.querySelector("#file-open-input"),
  storyTab: document.querySelector("#story-tab"),
  storyDisplayToggle: document.querySelector("#story-display-toggle"),
  draftTabs: document.querySelector("#draft-tabs"),
  pageCanvas: document.querySelector("#page-canvas"),
  newDraftCopy: document.querySelector("#new-draft-copy"),
  newDraftBlank: document.querySelector("#new-draft-blank"),
  toggleChanges: document.querySelector("#toggle-changes"),
  compareMode: document.querySelector("#compare-mode"),
  pagesOnScreen: document.querySelector("#pages-on-screen"),
  compareSelector: document.querySelector("#compare-selector"),
  compareSubtitle: document.querySelector("#compare-subtitle"),
  diffOutput: document.querySelector("#diff-output"),
  editorSurface: document.querySelector("#editor-surface"),
  changesPanel: document.querySelector("#changes-panel")
};

const STORY_KEY = "story";
const DISPLAY_STORAGE_KEY = "draftDiff.displayedPageKeys";
const NOTES_COLLAPSED_STORAGE_KEY = "draftDiff.collapsedNotesIds";
const NOTES_SIZE_STORAGE_KEY = "draftDiff.notesPanePercents";
const PAGES_ON_SCREEN_STORAGE_KEY = "draftDiff.pagesOnScreen";
const FILE_VIEW_STATES_STORAGE_KEY = "draftDiff.fileViewStates";
const DEFAULT_PAGES_ON_SCREEN = 2;

let state = null;
let selectedDraftId = null;
let activeArea = "draft";
let saveTimer = null;
let isSaving = false;
let showChanges = false;
let exportPath = "";
let compareSelectedIds = new Set();
let activeEditorKey = STORY_KEY;
let projectFileName = "draft-history.txt";
let projectFileHandle = null;
let projectFileWritesEnabled = false;

let fileViewStates = readStoredFileViewStates();
let displayedPageKeys = new Set();
let hasStoredDisplaySelection = false;
let collapsedNotesIds = new Set();
let notesPanePercents = {};
let pagesOnScreen = DEFAULT_PAGES_ON_SCREEN;
let resizingDraftId = null;

const DEFAULT_FORMAT = {
  fontFamily: "Segoe UI",
  fontSize: "16"
};

const FONT_FAMILY_OPTIONS = [
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

function createDraft(copyFrom, indexOverride) {
  const index = indexOverride || ((state?.drafts?.length || 0) + 1);
  const createdAt = nowIso();
  return {
    id: makeId("draft"),
    title: `Draft ${index}`,
    createdAt,
    content: copyFrom?.content || "",
    contentHtml: copyFrom?.contentHtml || textToHtml(copyFrom?.content || ""),
    format: copyFrom?.format ? { ...normalizeFormat(copyFrom.format) } : { ...DEFAULT_FORMAT },
    notes: {
      id: makeId("notes"),
      title: `Draft ${index} Notes`,
      createdAt,
      content: "",
      contentHtml: "",
      format: { ...DEFAULT_FORMAT }
    }
  };
}

function createDefaultState() {
  const createdAt = nowIso();
  return {
    version: 1,
    createdAt,
    updatedAt: createdAt,
    initialNotes: {
      id: "initial-notes",
      title: "Story Notes",
      createdAt,
      content: "",
      contentHtml: "",
      format: { ...DEFAULT_FORMAT }
    },
    drafts: [createDraft(null, 1)]
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
  [els.fileMenu, els.viewMenu].forEach(menu => {
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

function normalizeFormat(format = {}) {
  const fontFamily = allowedFontFamilies.has(format.fontFamily)
    ? format.fontFamily
    : DEFAULT_FORMAT.fontFamily;
  const fontSize = allowedFontSizes.has(String(format.fontSize))
    ? String(format.fontSize)
    : DEFAULT_FORMAT.fontSize;
  return { fontFamily, fontSize };
}

function ensurePageFields(page) {
  page.content = typeof page.content === "string" ? page.content : "";
  page.contentHtml = typeof page.contentHtml === "string" ? page.contentHtml : textToHtml(page.content);
  if (!page.content && page.contentHtml) page.content = plainTextFromHtml(page.contentHtml);
  page.format = normalizeFormat(page.format);
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
      title: "Story notes",
      kicker: "Page",
      createdAt: state.initialNotes.createdAt,
      page: state.initialNotes,
      ariaLabel: "Story notes",
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
    compareMode: els.compareMode.value,
    compareSelectedDraftIndexes: selectedCompareIndexes()
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

  const storedCompareIds = draftIdsFromIndexes(stored?.compareSelectedDraftIndexes);
  compareSelectedIds = storedCompareIds.length
    ? new Set(storedCompareIds)
    : new Set(state.drafts.map(draft => draft.id));
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

  const walk = node => {
    if (node.nodeType === Node.TEXT_NODE) {
      output += node.nodeValue.replace(/\u00a0/g, " ");
      return;
    }

    if (node.nodeType !== Node.ELEMENT_NODE && node.nodeType !== Node.DOCUMENT_FRAGMENT_NODE) return;

    const tag = node.nodeType === Node.ELEMENT_NODE ? node.tagName.toLowerCase() : "";
    if (tag === "br") {
      output += "\n";
      return;
    }

    Array.from(node.childNodes).forEach(walk);
    if (blockTags.has(tag) && output && !output.endsWith("\n")) output += "\n";
  };

  walk(root);
  return output.replace(/\n{3,}/g, "\n\n");
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
    exportPageBlock("Story Notes", projectState.initialNotes.createdAt, projectState.initialNotes.content)
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

function pageFromImportedBlock(block, fallbackTitle) {
  const title = block?.title || fallbackTitle;
  const content = block?.content || "";
  return {
    id: makeId("page"),
    title,
    createdAt: block?.createdAt || nowIso(),
    content,
    contentHtml: textToHtml(content),
    format: { ...DEFAULT_FORMAT }
  };
}

function stateFromExportText(text) {
  const blocks = String(text || "")
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .split(/\n{2}[ \t]*---[ \t]*\n{2}/g)
    .map(block => block.replace(/^\n+|\n+$/g, ""))
    .filter(block => block.trim());

  if (!blocks.length) throw new Error("This file is empty.");

  const pages = blocks.map(parseExportBlock);
  const storyIndex = pages.findIndex(page => page.title.toLowerCase() === "story notes");
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
    const draft = pageFromImportedBlock(draftBlock, `Draft ${draftNumber}`);
    const notes = pageFromImportedBlock(notesBlock, `${draft.title} Notes`);
    notes.id = makeId("notes");
    notes.title = `${draft.title} Notes`;
    drafts.push({
      ...draft,
      id: makeId("draft"),
      notes
    });
  }

  if (!drafts.length) drafts.push(createDraft(null, 1));

  return {
    version: 1,
    createdAt,
    updatedAt: nowIso(),
    initialNotes: {
      ...pageFromImportedBlock(storyBlock, "Story Notes"),
      id: "initial-notes",
      title: "Story Notes"
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
      result.push({ type: "same", text: before[i].text, marks: after[j].marks || before[i].marks || {} });
      i += 1;
      j += 1;
    } else if (rows[i + 1][j] >= rows[i][j + 1]) {
      result.push({ type: "removed", text: before[i].text, marks: before[i].marks || {} });
      i += 1;
    } else {
      result.push({ type: "added", text: after[j].text, marks: after[j].marks || {} });
      j += 1;
    }
  }

  while (i < before.length) {
    result.push({ type: "removed", text: before[i].text, marks: before[i].marks || {} });
    i += 1;
  }

  while (j < after.length) {
    result.push({ type: "added", text: after[j].text, marks: after[j].marks || {} });
    j += 1;
  }

  return result;
}

function tokenizeSegment(text, marks = {}) {
  const normalized = String(text || "").replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  const matches = normalized.match(/\n|[^\S\n]+|[\p{L}\p{N}]+|[^\s\p{L}\p{N}]/gu) || [];
  const semanticKey = marks.whitespace ? "" : `${marks.bold ? "b" : ""}${marks.italic ? "i" : ""}${marks.underline ? "u" : ""}${marks.strike ? "s" : ""}`;
  return matches.map(token => ({
    key: /^\s+$/u.test(token) ? token : `${token}|${semanticKey}`,
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

  const addNewline = marks => {
    if (tokens.length && tokens[tokens.length - 1].text !== "\n") {
      tokens.push(...tokenizeSegment("\n", marks));
    }
  };

  const walk = (node, marks = {}) => {
    if (node.nodeType === Node.TEXT_NODE) {
      tokens.push(...tokenizeSegment(node.nodeValue.replace(/\u00a0/g, " "), marks));
      return;
    }

    if (node.nodeType !== Node.ELEMENT_NODE && node.nodeType !== Node.DOCUMENT_FRAGMENT_NODE) return;

    const tag = node.nodeType === Node.ELEMENT_NODE ? node.tagName.toLowerCase() : "";
    if (tag === "br") {
      addNewline(marks);
      return;
    }

    const nextMarks = {
      bold: marks.bold || tag === "b" || tag === "strong",
      italic: marks.italic || tag === "i" || tag === "em",
      underline: marks.underline || tag === "u",
      strike: marks.strike || tag === "s" || tag === "strike" || tag === "del"
    };

    Array.from(node.childNodes).forEach(child => walk(child, nextMarks));
    if (blockTags.has(tag)) addNewline(marks);
  };

  walk(template.content);
  while (tokens.length && tokens[tokens.length - 1].text === "\n") tokens.pop();
  return tokens;
}

function diffRichPages(beforePage, afterPage) {
  ensurePageFields(beforePage);
  ensurePageFields(afterPage);
  return diffSequence(
    semanticTokensFromHtml(beforePage.contentHtml),
    semanticTokensFromHtml(afterPage.contentHtml)
  );
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

function resetCompareSelection() {
  compareSelectedIds = new Set(state.drafts.map(draft => draft.id));
}

function pruneCompareSelection() {
  const draftIds = new Set(state.drafts.map(draft => draft.id));
  compareSelectedIds = new Set([...compareSelectedIds].filter(id => draftIds.has(id)));
}

function renderDraftTabs() {
  els.storyTab.classList.toggle("active", activeArea === "story");
  els.storyDisplayToggle.checked = displayedPageKeys.has(STORY_KEY);
  els.storyDisplayToggle.disabled = showChanges;
  els.draftTabs.innerHTML = state.drafts.map((draft, index) => {
    const active = draft.id === selectedDraftId && activeArea !== "story" ? " active" : "";
    const checked = displayedPageKeys.has(draftContentKey(draft.id)) ? " checked" : "";
    const disabled = showChanges ? " disabled" : "";
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
        <input type="checkbox" data-display-draft-id="${draft.id}" aria-label="Display ${escapeHtml(draft.title)}"${checked}${disabled}>
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
    ? "Story notes..."
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

function renderDiffToken(part) {
  const classes = ["compare-token"];
  if (part.type !== "same") classes.push(part.type);
  const semanticClassName = semanticClasses(part.marks);
  if (semanticClassName) classes.push(semanticClassName);
  const text = part.type === "same" ? part.text : visibleChangedWhitespace(part.text);
  return `<span class="${classes.join(" ")}">${escapeHtml(text)}</span>`;
}

function baseComparePageHtml(draft, subtitle = "BASELINE") {
  ensurePageFields(draft);
  return `
    <article class="compare-page is-baseline">
      <div class="compare-page-header">
        <div class="kicker">${escapeHtml(subtitle)}</div>
        <div class="title-row">
          <div class="title">${escapeHtml(draft.title)}</div>
        </div>
        <div class="meta">${formatDate(draft.createdAt)}</div>
      </div>
      <div class="compare-page-body" style="${fontStyle(draft.format)}">
        <div class="compare-rich-content">${richPageHtml(draft)}</div>
      </div>
    </article>
  `;
}

function markedLaterPageHtml(pair, diff = diffRichPages(pair.before, pair.after)) {
  if (!diff.length) {
    return `<div class="compare-text empty-line">No draft text yet.</div>`;
  }

  const tokens = diff.map(renderDiffToken).join("");
  return `<div class="compare-text">${tokens}</div>`;
}

function markedComparePageHtml(pair) {
  const diff = diffRichPages(pair.before, pair.after);
  const stats = diffTokenStats(diff);

  return `
    <article class="compare-page later-page">
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
  return [...compareSelectedIds]
    .map(draftIndexForId)
    .filter(index => index >= 0)
    .sort((a, b) => a - b);
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

function renderCompareSelector() {
  pruneCompareSelection();

  if (!state.drafts.length) {
    els.compareSelector.classList.remove("compact-compare", "scrollable-compare");
    els.compareSelector.innerHTML = `<p class="compare-selector-empty">No drafts yet.</p>`;
    return;
  }

  els.compareSelector.innerHTML = [
    `<span class="compare-selector-label">Drafts</span>`,
    ...state.drafts.map((draft, index) => {
    const checked = compareSelectedIds.has(draft.id) ? " checked" : "";
    const draftNumber = String(index + 1);
    return `
      <label class="compare-choice">
        <input type="checkbox" data-compare-draft-id="${draft.id}" aria-label="Compare ${escapeHtml(draft.title)}"${checked}>
        <span class="compare-label-full">${escapeHtml(draft.title)}</span>
        <span class="compare-label-short" aria-hidden="true">${escapeHtml(draftNumber)}</span>
      </label>
    `;
    })
  ].join("");
  updateCompareSelectorDensity();
}

function updateCompareSelectorDensity() {
  if (!els.compareSelector || !state || !els.compareSelector.clientWidth) return;

  els.compareSelector.classList.remove("compact-compare", "scrollable-compare");
  const needsCompactLabels = els.compareSelector.scrollWidth > els.compareSelector.clientWidth + 1;
  els.compareSelector.classList.toggle("compact-compare", needsCompactLabels);
  els.compareSelector.classList.toggle("scrollable-compare", els.compareSelector.scrollWidth > els.compareSelector.clientWidth + 1);
}

function renderDiff() {
  if (!showChanges) {
    els.diffOutput.innerHTML = "";
    els.compareSubtitle.textContent = "";
    return;
  }

  renderCompareSelector();
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
  ensureDisplaySelection();
  renderDraftTabs();
  renderEditor();
  renderCompareSelector();
  renderChangesVisibility();
  renderDiff();
}

function syncFromInputs() {
  if (!state) return;

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
  syncFromInputs();
  renderDraftTabs();
  refreshRenderedPageLabels();
  renderDiff();
  setStatus(isSaving ? "Saving..." : "Unsaved changes");
  window.clearTimeout(saveTimer);
  saveTimer = window.setTimeout(saveNow, 450);
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
  resetCompareSelection();
  saveCurrentViewState();
  setPagesOnScreen(pagesOnScreen);
}

async function requestWriteAccess(handle) {
  if (!handle?.queryPermission || !handle?.requestPermission) return true;

  try {
    const options = { mode: "readwrite" };
    if (await handle.queryPermission(options) === "granted") return true;
    return await handle.requestPermission(options) === "granted";
  } catch {
    return false;
  }
}

async function writeSelectedTextFile() {
  if (!projectFileHandle) return true;

  if (!projectFileWritesEnabled) {
    projectFileWritesEnabled = await requestWriteAccess(projectFileHandle);
    if (!projectFileWritesEnabled) return false;
  }

  try {
    const writable = await projectFileHandle.createWritable();
    await writable.write(formatExportText(state));
    await writable.close();
    return true;
  } catch (error) {
    console.error(error);
    projectFileWritesEnabled = false;
    return false;
  }
}

function pickerTextFileOptions() {
  return {
    types: [
      {
        description: "Draft Diff text files",
        accept: { "text/plain": [".txt"] }
      }
    ],
    excludeAcceptAllOption: false
  };
}

function isAbortError(error) {
  return error?.name === "AbortError";
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

async function applyTextProject(text, fileName, handle) {
  state = stateFromExportText(text);
  projectFileName = fileName || "draft-history.txt";
  projectFileHandle = handle || null;
  projectFileWritesEnabled = false;
  updateProjectTitle();
  restoreViewStateForProject();
  render();
  await saveNow({ writeSelectedFile: false });
  setStatus(projectFileHandle ? "Opened; edits will ask to sync file" : "Opened; saved companion");
  focusPageEditor(STORY_KEY);
}

async function saveAsTextProject() {
  if (!state) return;
  closeFileMenu();
  syncFromInputs();

  try {
    if ("showSaveFilePicker" in window) {
      const handle = await window.showSaveFilePicker({
        suggestedName: ensureTxtExtension(projectFileName || fileNameFromPath(exportPath)),
        ...pickerTextFileOptions()
      });
      projectFileName = handle.name || ensureTxtExtension(projectFileName);
      projectFileHandle = handle;
      projectFileWritesEnabled = await requestWriteAccess(handle);
      updateProjectTitle();
      const saved = await saveNow();
      setStatus(saved ? `Saved as ${projectFileName}` : "Save as blocked");
      return;
    }

    const fileName = window.prompt("Save as", ensureTxtExtension(projectFileName));
    if (!fileName) return;
    projectFileName = ensureTxtExtension(fileName);
    projectFileHandle = null;
    projectFileWritesEnabled = false;
    updateProjectTitle();
    downloadExportText(projectFileName);
    await saveNow({ writeSelectedFile: false });
    setStatus("Downloaded copy; saved companion");
  } catch (error) {
    if (isAbortError(error)) return;
    console.error(error);
    setStatus("Save as failed");
  }
}

async function newTextProject() {
  closeFileMenu();

  try {
    let handle = null;
    let fileName = "draft-history.txt";
    let canWrite = false;

    if ("showSaveFilePicker" in window) {
      handle = await window.showSaveFilePicker({
        suggestedName: "draft-history.txt",
        ...pickerTextFileOptions()
      });
      fileName = handle.name || fileName;
      canWrite = await requestWriteAccess(handle);
    }

    state = createDefaultState();
    projectFileName = fileName;
    projectFileHandle = handle;
    projectFileWritesEnabled = Boolean(handle && canWrite);
    updateProjectTitle();
    resetViewStateForProject();
    render();
    await saveNow();
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
    if ("showOpenFilePicker" in window) {
      const [handle] = await window.showOpenFilePicker({
        multiple: false,
        ...pickerTextFileOptions()
      });
      const file = await handle.getFile();
      await applyTextProject(await file.text(), file.name, handle);
      return;
    }

    els.fileOpenInput.click();
  } catch (error) {
    if (isAbortError(error)) return;
    console.error(error);
    setStatus("Open failed");
  }
}

async function saveNow(options = {}) {
  if (!state) return false;
  syncFromInputs();
  isSaving = true;
  setStatus("Saving...");

  try {
    const response = await fetch("/api/state", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(state)
    });

    if (!response.ok) {
      setStatus("Save failed");
      isSaving = false;
      return false;
    }

    const payload = await response.json();
    state = payload.state;
    exportPath = payload.exportPath || exportPath;
    const wroteSelectedFile = options.writeSelectedFile === false
      ? true
      : await writeSelectedTextFile();
    isSaving = false;
    ensureDisplaySelection();
    if (!projectFileHandle && exportPath && projectFileName === "draft-history.txt") {
      projectFileName = fileNameFromPath(exportPath) || projectFileName;
    }
    updateProjectTitle();
    setStatus(wroteSelectedFile ? `Saved ${formatDate(state.updatedAt)}` : "Saved companion; file write blocked");
    renderDraftTabs();
    return wroteSelectedFile;
  } catch (error) {
    console.error(error);
    setStatus("Save failed");
    isSaving = false;
    return false;
  }
}

async function loadState() {
  const response = await fetch("/api/state");
  const payload = await response.json();
  state = payload.state;
  exportPath = payload.exportPath || "";
  projectFileName = fileNameFromPath(exportPath) || projectFileName;
  projectFileHandle = null;
  projectFileWritesEnabled = false;
  updateProjectTitle();
  restoreViewStateForProject();
  setStatus(`Saved ${formatDate(state.updatedAt)}`);
  render();
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
    if (editor) editor.focus({ preventScroll: true });
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
  const draft = createDraft(copyFromSelected ? getSelectedDraft() : null);
  state.drafts.push(draft);
  compareSelectedIds.add(draft.id);
  selectedDraftId = draft.id;
  activeArea = "draft";
  displayPage(draftContentKey(draft.id), true);
  render();
  scheduleSave();
  scrollTabsToEnd();
  focusPageEditor(draftContentKey(draft.id));
}

function applyPageFormat(editorKey, field, value) {
  const page = pageForEditorKey(editorKey);
  const editorEl = editorElementForKey(editorKey);
  if (!page || !editorEl) return;

  ensurePageFields(page);
  page.format[field] = value;
  page.format = normalizeFormat(page.format);
  applyEditorFormat(editorEl, page.format);
  syncToolbarValues(editorKey);
  scheduleSave();
}

function runEditorCommand(editorKey, command) {
  const editorEl = editorElementForKey(editorKey);
  if (!editorEl) return;
  activeEditorKey = editorKey;
  editorEl.focus();
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

function toggleEditorRibbon(toggle) {
  const region = toggle.closest(".editor-ribbon-region");
  if (!region) return;

  const shouldOpen = !region.classList.contains("ribbon-open");
  setRibbonRegionOpen(region, shouldOpen);

  if (shouldOpen) {
    syncToolbarValues(region.dataset.ribbonRegion);
  } else {
    closeFormatPickers();
  }
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

  state.drafts = state.drafts.filter(item => item.id !== draftId);
  compareSelectedIds.delete(draftId);
  displayedPageKeys.delete(draftContentKey(draftId));
  collapsedNotesIds.delete(draftId);

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
els.fileSaveAs.addEventListener("click", saveAsTextProject);

els.fileOpenInput.addEventListener("change", async event => {
  const [file] = event.target.files || [];
  event.target.value = "";
  if (!file) return;

  try {
    await applyTextProject(await file.text(), file.name, null);
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
  syncFromInputs();
  displayPage(STORY_KEY, event.target.checked);
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

els.pageCanvas.addEventListener("input", event => {
  if (event.target.closest("[data-editor-key]") || event.target.closest("[data-title-draft-id]")) {
    scheduleSave();
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
  document.execCommand("insertText", false, "\t");
  scheduleSave();
});

els.pageCanvas.addEventListener("paste", event => {
  const editorEl = event.target.closest("[data-editor-key]");
  if (!editorEl) return;

  event.preventDefault();
  activeEditorKey = editorEl.dataset.editorKey;
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

els.compareSelector.addEventListener("change", event => {
  const checkbox = event.target.closest("[data-compare-draft-id]");
  if (!checkbox) return;

  if (checkbox.checked) {
    compareSelectedIds.add(checkbox.dataset.compareDraftId);
  } else {
    compareSelectedIds.delete(checkbox.dataset.compareDraftId);
  }

  saveCurrentViewState();
  renderDiff();
});

els.toggleChanges.addEventListener("click", () => {
  syncFromInputs();
  showChanges = !showChanges;
  saveCurrentViewState();
  renderChangesVisibility();
  renderDiff();
});

document.addEventListener("click", event => {
  const topMenu =
    event.target instanceof Element ? event.target.closest("#file-menu, #view-menu") : null;
  if (topMenu) {
    closeTopMenus(topMenu);
  } else {
    closeTopMenus();
  }

  if (event.target instanceof Element && event.target.closest(".fr-picker")) return;
  closeFormatPickers();
});

document.addEventListener("keydown", event => {
  if (event.key === "Escape") {
    closeTopMenus();
    closeFormatPickers();
  }
});

document.addEventListener("scroll", positionOpenFormatPickers, true);
window.addEventListener("resize", positionOpenFormatPickers);
window.addEventListener("resize", updateTabDensity);
window.addEventListener("resize", updateCompareSelectorDensity);

window.addEventListener("beforeunload", () => {
  if (!state) return;
  syncFromInputs();
  const blob = new Blob([JSON.stringify(state)], { type: "application/json" });
  navigator.sendBeacon("/api/close", blob);
});

loadState().catch(error => {
  console.error(error);
  setStatus("Could not load project");
});
