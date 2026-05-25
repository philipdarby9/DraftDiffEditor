const fs = require("node:fs");
const http = require("node:http");
const path = require("node:path");
const { spawn } = require("node:child_process");
const { URL } = require("node:url");

const ROOT = __dirname;
const PUBLIC_DIR = path.join(ROOT, "public");
const DATA_DIR = path.resolve(process.env.DRAFT_DIFF_DATA_DIR || path.join(ROOT, "data"));
const STATE_FILE = path.join(DATA_DIR, "project.json");
const EXPORT_FILE = path.join(DATA_DIR, "draft-history.txt");
const TEXT_FILE_LINK_FILE = path.join(DATA_DIR, "text-file-link.json");
const TEXT_FILE_STATES_FILE = path.join(DATA_DIR, "text-file-states.json");
const VERSION_HISTORY_FOLDER_FILE = path.join(DATA_DIR, "version-history-folder.json");
const VERSION_HISTORY_FILE_SUFFIX = ".version-history.json";
const PORT = Number(process.env.PORT || 4173);
const PROJECT_NOTES_TITLE = "Project notes";
const FORMAT_DEFAULT_VERSION = 2;
const VIEW_STATE_VERSION = 2;
const LEGACY_DEFAULT_FONT_FAMILY = "Segoe UI";
const MIN_PAGE_PANE_PERCENT = 12;
const SERVER_BUILD = "server-compare-created-label-2026-05-20";
const AUTO_EXIT_ON_IDLE = process.env.DRAFT_DIFF_AUTO_EXIT === "1";
const CLIENT_IDLE_EXIT_MS = 5 * 60_000;
const STARTUP_IDLE_EXIT_MS = 120_000;

let lastClientSeenAt = 0;
let activeServer = null;
let idleTimer = null;
let processExitRequested = false;

const mimeTypes = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".txt": "text/plain; charset=utf-8",
  ".svg": "image/svg+xml; charset=utf-8"
};

function nowIso() {
  return new Date().toISOString();
}

function id(prefix) {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function asText(value) {
  return typeof value === "string" ? value : "";
}

const DEFAULT_FORMAT = {
  fontFamily: "Consolas",
  fontSize: "16",
  lineHeight: "1.62"
};

const allowedFontFamilies = new Set([
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
]);

const allowedFontSizes = new Set(["12", "14", "16", "18", "20", "24", "28", "32"]);
const allowedLineHeights = new Set(["1.2", "1.4", "1.62", "1.8", "2"]);

function escapeHtml(value) {
  return asText(value)
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
  return /<\s*p(?:\s|>|\/)/i.test(asText(value));
}

function decodeHtmlText(value) {
  return asText(value)
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'");
}

function htmlToText(value) {
  const source = asText(value);
  const blockTags = new Set(["div", "p", "li", "blockquote", "h1", "h2", "h3", "h4", "h5", "h6", "ul", "ol"]);
  const paragraphTags = new Set(["p", "blockquote"]);
  let output = "";
  let lastIndex = 0;

  const ensureTrailingNewlines = count => {
    if (!output) return;
    const trailing = output.match(/\n*$/u)?.[0].length || 0;
    if (trailing < count) output += "\n".repeat(count - trailing);
  };

  const appendDecodedSegment = (segment, hasAdjacentTag) => {
    let text = decodeHtmlText(segment);
    if (hasAdjacentTag && text.includes("\n")) {
      if (!text.trim()) return;
      text = text
        .replace(/^[ \t]*\n[ \t]*/u, "")
        .replace(/[ \t]*\n[ \t]*$/u, "");
    }

    output += text;
  };

  source.replace(/<[^>]*>/g, (tagText, offset) => {
    appendDecodedSegment(source.slice(lastIndex, offset), true);
    const tagMatch = /^<\s*\/?\s*([a-z0-9]+)/i.exec(tagText);
    const tagName = tagMatch?.[1]?.toLowerCase() || "";
    const isClosingTag = /^<\s*\//.test(tagText);

    if (tagName === "br") {
      output += "\n";
    } else if (paragraphTags.has(tagName)) {
      ensureTrailingNewlines(isClosingTag ? 2 : 1);
    } else if (blockTags.has(tagName)) {
      ensureTrailingNewlines(1);
    }

    lastIndex = offset + tagText.length;
    return tagText;
  });

  appendDecodedSegment(source.slice(lastIndex), lastIndex > 0);
  return output.trimEnd();
}

function lineBreakCount(value) {
  return (asText(value).match(/\n/g) || []).length;
}

function normalizeFormat(format) {
  const fontFamily = allowedFontFamilies.has(format?.fontFamily)
    ? format.fontFamily
    : DEFAULT_FORMAT.fontFamily;
  const fontSize = allowedFontSizes.has(String(format?.fontSize))
    ? String(format.fontSize)
    : DEFAULT_FORMAT.fontSize;
  const lineHeight = allowedLineHeights.has(String(format?.lineHeight))
    ? String(format.lineHeight)
    : DEFAULT_FORMAT.lineHeight;
  return { fontFamily, fontSize, lineHeight };
}

function upgradeLegacyDefaultFormat(format, shouldUpgrade) {
  const normalized = normalizeFormat(format);
  return shouldUpgrade && normalized.fontFamily === LEGACY_DEFAULT_FONT_FAMILY
    ? { ...normalized, fontFamily: DEFAULT_FORMAT.fontFamily }
    : normalized;
}

function currentDefaultFormat(state) {
  return normalizeFormat(state?.defaultFormat || DEFAULT_FORMAT);
}

function normalizePage(page, fallback, options = {}) {
  const providedContentHtml = asText(page?.contentHtml);
  const providedContent = asText(page?.content);
  const htmlContent = providedContentHtml ? htmlToText(providedContentHtml) : "";
  const shouldPreservePlainTextLines = providedContent &&
    !hasParagraphHtml(providedContentHtml) &&
    lineBreakCount(providedContent) > lineBreakCount(htmlContent);
  const content = shouldPreservePlainTextLines ? providedContent : htmlContent || providedContent;
  return {
    id: page?.id || fallback.id,
    title: page?.title || fallback.title,
    createdAt: page?.createdAt || fallback.createdAt,
    updatedAt: page?.updatedAt || fallback.updatedAt || page?.createdAt || fallback.createdAt,
    content,
    contentHtml: shouldPreservePlainTextLines ? textToHtml(content) : providedContentHtml || textToHtml(content),
    format: upgradeLegacyDefaultFormat(
      { ...normalizeFormat(options.defaultFormat || DEFAULT_FORMAT), ...(page?.format || {}) },
      options.upgradeLegacyDefaultFont
    )
  };
}

function pageVersionSnapshot(page, fallbackTitle, timestamp = nowIso()) {
  return {
    id: id("version"),
    createdAt: timestamp,
    title: page.title || fallbackTitle,
    content: page.content,
    contentHtml: page.contentHtml,
    format: normalizeFormat(page.format)
  };
}

function versionHasMeaningfulContent(version) {
  return Boolean((asText(version?.content) || htmlToText(version?.contentHtml || "")).trim());
}

function normalizePageVersionHistory(history, page, fallbackTitle) {
  const normalized = (Array.isArray(history) ? history : [])
    .filter(entry => entry && typeof entry === "object")
    .map((entry, index) => {
      const contentHtml = asText(entry.contentHtml) || textToHtml(asText(entry.content) || page.content);
      const content = asText(entry.content) || htmlToText(contentHtml);
      return {
        id: asText(entry.id) || id("version"),
        createdAt: asText(entry.createdAt) || page.updatedAt || page.createdAt || nowIso(),
        title: asText(entry.title) || page.title || fallbackTitle,
        content,
        contentHtml,
        format: normalizeFormat({ ...page.format, ...(entry.format || {}) })
      };
    });

  while (normalized.length && !versionHasMeaningfulContent(normalized[0])) {
    normalized.shift();
  }

  if (!normalized.length) {
    const current = pageVersionSnapshot(page, fallbackTitle, page.updatedAt || nowIso());
    if (versionHasMeaningfulContent(current)) normalized.push(current);
  }

  return normalized;
}

function normalizeDraftVersionHistory(history, draft) {
  return normalizePageVersionHistory(history, draft, draft?.title || "Untitled draft");
}

function normalizeIndexArray(values, maxLength) {
  return [...new Set((Array.isArray(values) ? values : [])
    .map(value => Number(value))
    .filter(value => Number.isInteger(value) && value >= 0 && value < maxLength))]
    .sort((a, b) => a - b);
}

function normalizeIdArray(values, validIds) {
  return [...new Set((Array.isArray(values) ? values : [])
    .map(value => asText(value))
    .filter(value => validIds.has(value)))];
}

function normalizeNotesPanePercents(values, maxLength) {
  const normalized = {};
  if (!values || typeof values !== "object" || Array.isArray(values)) return normalized;

  Object.entries(values).forEach(([index, value]) => {
    const numericIndex = Number(index);
    const numericValue = Number(value);
    if (
      Number.isInteger(numericIndex) &&
      numericIndex >= 0 &&
      numericIndex < maxLength &&
      Number.isFinite(numericValue)
    ) {
      normalized[numericIndex] = Math.min(90, Math.max(10, numericValue));
    }
  });
  return normalized;
}

function normalizePagePanePercents(values, drafts) {
  const normalized = {};
  if (!values || typeof values !== "object" || Array.isArray(values)) return normalized;

  const validKeys = new Set([
    "story",
    ...drafts.map(draft => `draft:${draft.id}:content`)
  ]);
  Object.entries(values).forEach(([key, value]) => {
    const numericValue = Number(value);
    if (validKeys.has(key) && Number.isFinite(numericValue)) {
      normalized[key] = Math.min(1000, Math.max(MIN_PAGE_PANE_PERCENT, numericValue));
    }
  });
  return normalized;
}

function draftIndexById(drafts, draftId) {
  return drafts.findIndex(draft => draft.id === draftId);
}

function draftRefFromViewState(drafts, draftId, draftIndex) {
  const byIdIndex = draftIndexById(drafts, asText(draftId));
  const byIndex = Number(draftIndex);
  const normalizedIndex = byIdIndex >= 0
    ? byIdIndex
    : Number.isInteger(byIndex) && byIndex >= 0 && byIndex < drafts.length
      ? byIndex
      : 0;
  return {
    draft: drafts[normalizedIndex] || null,
    index: normalizedIndex
  };
}

function normalizeEditorSelection(selection) {
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

function validEditorKeys(drafts) {
  return new Set([
    "story",
    ...drafts.flatMap(draft => [
      `draft:${draft.id}:content`,
      `draft:${draft.id}:notes`
    ])
  ]);
}

function normalizeEditorSelections(selections, drafts) {
  const normalized = {};
  if (!selections || typeof selections !== "object" || Array.isArray(selections)) return normalized;

  const keys = validEditorKeys(drafts);
  Object.entries(selections).forEach(([key, selection]) => {
    if (!keys.has(key)) return;
    const normalizedSelection = normalizeEditorSelection(selection);
    if (normalizedSelection) normalized[key] = normalizedSelection;
  });
  return normalized;
}

function normalizeViewState(viewState, drafts) {
  if (!viewState || typeof viewState !== "object" || Array.isArray(viewState)) return null;

  const validDraftIds = new Set(drafts.map(draft => draft.id));
  const displayedDraftIndexes = normalizeIndexArray(viewState.displayedDraftIndexes, drafts.length);
  const displayedDraftIds = normalizeIdArray(viewState.displayedDraftIds, validDraftIds);
  displayedDraftIndexes.forEach(index => {
    const draftId = drafts[index]?.id;
    if (draftId && !displayedDraftIds.includes(draftId)) displayedDraftIds.push(draftId);
  });

  const collapsedNotesIndexes = normalizeIndexArray(viewState.collapsedNotesIndexes, drafts.length);
  const collapsedNotesIds = normalizeIdArray(viewState.collapsedNotesIds, validDraftIds);
  collapsedNotesIndexes.forEach(index => {
    const draftId = drafts[index]?.id;
    if (draftId && !collapsedNotesIds.includes(draftId)) collapsedNotesIds.push(draftId);
  });

  const selectedRef = draftRefFromViewState(drafts, viewState.selectedDraftId, viewState.selectedDraftIndex);
  const activeRef = draftRefFromViewState(
    drafts,
    viewState.activeDraftId || viewState.selectedDraftId,
    viewState.activeDraftIndex ?? viewState.selectedDraftIndex
  );
  const activeArea = viewState.activeArea === "draft" && activeRef.draft ? "draft" : "story";
  const activePageType = activeArea === "story" ? "story" : viewState.activePageType === "notes" ? "notes" : "content";
  const activeEditorKey = activeArea === "story"
    ? "story"
    : `draft:${activeRef.draft.id}:${activePageType === "notes" ? "notes" : "content"}`;
  const pagesOnScreen = Math.min(4, Math.max(1, Number(viewState.pagesOnScreen) || 2));

  return {
    version: VIEW_STATE_VERSION,
    updatedAt: viewState.updatedAt || nowIso(),
    hasStoredDisplaySelection: Boolean(viewState.hasStoredDisplaySelection),
    displayedStory: Boolean(viewState.displayedStory),
    displayedDraftIndexes,
    displayedDraftIds,
    collapsedNotesIndexes,
    collapsedNotesIds,
    notesPanePercents: normalizeNotesPanePercents(viewState.notesPanePercents, drafts.length),
    pagePanePercents: normalizePagePanePercents(viewState.pagePanePercents, drafts),
    pagesOnScreen,
    selectedDraftId: selectedRef.draft?.id || null,
    selectedDraftIndex: selectedRef.index,
    activeDraftId: activeRef.draft?.id || null,
    activeDraftIndex: activeRef.index,
    activePageType,
    activeEditorKey,
    editorSelections: normalizeEditorSelections(viewState.editorSelections, drafts),
    activeArea,
    showChanges: Boolean(viewState.showChanges),
    compareMode: viewState.compareMode === "consecutive" ? "consecutive" : "first"
  };
}

function createDraft(index, content = "") {
  const createdAt = nowIso();
  return {
    id: id("draft"),
    title: `Draft ${index}`,
    createdAt,
    updatedAt: createdAt,
    content,
    contentHtml: textToHtml(content),
    format: { ...DEFAULT_FORMAT },
    notes: {
      id: id("notes"),
      title: `Draft ${index} Notes`,
      createdAt,
      updatedAt: createdAt,
      content: "",
      contentHtml: "",
      format: { ...DEFAULT_FORMAT }
    }
  };
}

function defaultState() {
  const createdAt = nowIso();
  return {
    version: 1,
    formatDefaultVersion: FORMAT_DEFAULT_VERSION,
    defaultFormat: { ...DEFAULT_FORMAT },
    createdAt,
    updatedAt: createdAt,
    initialNotes: {
      id: "initial-notes",
      title: PROJECT_NOTES_TITLE,
      createdAt,
      updatedAt: createdAt,
      content: "",
      contentHtml: "",
      format: { ...DEFAULT_FORMAT }
    },
    drafts: [createDraft(1)]
  };
}

function normalizeState(input, options = {}) {
  const fallback = defaultState();
  const raw = input && typeof input === "object" ? input : fallback;
  const createdAt = raw.createdAt || fallback.createdAt;
  const drafts = Array.isArray(raw.drafts) && raw.drafts.length ? raw.drafts : fallback.drafts;
  const upgradeLegacyDefaultFont = raw.formatDefaultVersion !== FORMAT_DEFAULT_VERSION;
  const defaultFormat = upgradeLegacyDefaultFormat(currentDefaultFormat(raw), upgradeLegacyDefaultFont);
  const normalizedDrafts = drafts.map((draft, index) => {
    const draftNumber = index + 1;
    const draftCreatedAt = draft?.createdAt || nowIso();
    const normalizedDraft = normalizePage(draft, {
      id: draft?.id || id("draft"),
      title: draft?.title || `Draft ${draftNumber}`,
      createdAt: draftCreatedAt,
      updatedAt: draft?.updatedAt || draftCreatedAt,
      content: ""
    }, { upgradeLegacyDefaultFont, defaultFormat });
    const normalized = {
      ...normalizedDraft,
      notes: normalizePage(draft?.notes, {
        id: draft?.notes?.id || id("notes"),
        title: draft?.notes?.title || `Draft ${draftNumber} Notes`,
        createdAt: draft?.notes?.createdAt || draftCreatedAt,
        updatedAt: draft?.notes?.updatedAt || draft?.notes?.createdAt || draftCreatedAt,
        content: ""
      }, { upgradeLegacyDefaultFont, defaultFormat })
    };
    normalized.versionHistory = normalizeDraftVersionHistory(draft?.versionHistory, normalized);
    return normalized;
  });

  const initialNotes = normalizePage(raw.initialNotes, {
    id: raw.initialNotes?.id || "initial-notes",
    title: raw.initialNotes?.title || PROJECT_NOTES_TITLE,
    createdAt: raw.initialNotes?.createdAt || createdAt,
    updatedAt: raw.initialNotes?.updatedAt || raw.initialNotes?.createdAt || createdAt,
    content: ""
  }, { upgradeLegacyDefaultFont, defaultFormat });
  initialNotes.versionHistory = normalizePageVersionHistory(raw.initialNotes?.versionHistory, initialNotes, PROJECT_NOTES_TITLE);

  const normalized = {
    version: 1,
    formatDefaultVersion: FORMAT_DEFAULT_VERSION,
    defaultFormat,
    createdAt,
    updatedAt: options.touch ? nowIso() : raw.updatedAt || createdAt,
    initialNotes,
    drafts: normalizedDrafts
  };
  const viewState = normalizeViewState(raw.viewState, normalizedDrafts);
  if (viewState) normalized.viewState = viewState;
  return normalized;
}

function formatDate(iso) {
  const date = new Date(iso);
  if (Number.isNaN(date.valueOf())) return iso;
  return new Intl.DateTimeFormat("en-GB", {
    dateStyle: "full",
    timeStyle: "short"
  }).format(date);
}

function pageBlock(title, createdAt, content) {
  const body = asText(content).trimEnd();
  return [
    `Created: ${formatDate(createdAt)}`,
    title,
    "",
    body || "[No text yet]"
  ].join("\n");
}

function formatExport(state) {
  const pages = [
    pageBlock(PROJECT_NOTES_TITLE, state.initialNotes.createdAt, state.initialNotes.content)
  ];

  state.drafts.forEach((draft, index) => {
    const title = draft.title || `Draft ${index + 1}`;
    pages.push(pageBlock(title, draft.createdAt, draft.content));
    pages.push(pageBlock(`${title} Notes`, draft.notes.createdAt, draft.notes.content));
  });

  return `${pages.join("\n\n---\n\n")}\n`;
}

function ensureDataDir() {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

function readVersionHistoryFolderPath() {
  ensureDataDir();

  try {
    const parsed = JSON.parse(fs.readFileSync(VERSION_HISTORY_FOLDER_FILE, "utf8").replace(/^\uFEFF/, ""));
    const folderPath = asText(parsed?.folderPath).trim();
    return folderPath ? path.resolve(folderPath) : null;
  } catch {
    return null;
  }
}

function writeVersionHistoryFolderPath(folderPath) {
  ensureDataDir();

  if (!folderPath) {
    try {
      fs.rmSync(VERSION_HISTORY_FOLDER_FILE, { force: true });
    } catch {}
    return null;
  }

  const resolvedPath = path.resolve(folderPath);
  fs.mkdirSync(resolvedPath, { recursive: true });
  fs.writeFileSync(
    VERSION_HISTORY_FOLDER_FILE,
    `${JSON.stringify({ folderPath: resolvedPath, updatedAt: nowIso() }, null, 2)}\n`,
    "utf8"
  );
  return resolvedPath;
}

function historySourceInfo(options = {}) {
  const linkedTextPath = readTextFileLink();
  const explicitFileName = asText(options.fileName).trim();
  const filePath = asText(options.filePath) || linkedTextPath || (explicitFileName ? "" : EXPORT_FILE);
  const resolvedFilePath = filePath ? path.resolve(filePath) : null;
  const fileName = explicitFileName || (resolvedFilePath ? path.basename(resolvedFilePath) : "draft-history.txt");
  return {
    filePath: resolvedFilePath,
    fileName: fileName || "draft-history.txt"
  };
}

function normalizedHistoryName(value) {
  return asText(value).trim().toLowerCase();
}

function sameHistoryPath(left, right) {
  if (!left || !right) return false;
  const leftPath = path.resolve(left);
  const rightPath = path.resolve(right);
  return process.platform === "win32"
    ? leftPath.toLowerCase() === rightPath.toLowerCase()
    : leftPath === rightPath;
}

function safeHistoryBaseName(sourceName) {
  const parsed = path.parse(asText(sourceName) || "draft-history.txt");
  const rawName = parsed.name || parsed.base || "draft-history";
  const cleaned = rawName
    .replace(/[<>:"/\\|?*\x00-\x1f]/g, "_")
    .replace(/[.\s]+$/g, "")
    .slice(0, 120);
  return cleaned || "draft-history";
}

function expectedVersionHistoryFilePath(options = {}) {
  const folderPath = readVersionHistoryFolderPath();
  if (!folderPath) return null;
  const source = historySourceInfo(options);
  return path.join(folderPath, `${safeHistoryBaseName(source.fileName)}${VERSION_HISTORY_FILE_SUFFIX}`);
}

function parseVersionHistoryFile(filePath) {
  try {
    const parsed = JSON.parse(fs.readFileSync(filePath, "utf8").replace(/^\uFEFF/, ""));
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function versionHistoryPayloadMatchesSource(payload, source) {
  if (!payload || !source) return false;
  if (source.filePath && sameHistoryPath(payload.sourceFilePath, source.filePath)) return true;
  return normalizedHistoryName(payload.sourceFileName) === normalizedHistoryName(source.fileName);
}

function findVersionHistoryFilePath(options = {}) {
  const folderPath = readVersionHistoryFolderPath();
  if (!folderPath) return null;

  const source = historySourceInfo(options);
  const expectedPath = expectedVersionHistoryFilePath(source);
  if (expectedPath && fs.existsSync(expectedPath)) return expectedPath;

  try {
    const entries = fs.readdirSync(folderPath, { withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isFile() || !entry.name.endsWith(VERSION_HISTORY_FILE_SUFFIX)) continue;
      const filePath = path.join(folderPath, entry.name);
      const payload = parseVersionHistoryFile(filePath);
      if (versionHistoryPayloadMatchesSource(payload, source)) return filePath;
    }
  } catch {}

  return expectedPath;
}

function versionHistorySignature(version) {
  return JSON.stringify({
    title: asText(version?.title),
    content: asText(version?.content),
    contentHtml: asText(version?.contentHtml),
    format: normalizeFormat(version?.format || {})
  });
}

function mergePageVersionHistories(existingHistory, incomingHistory, page, fallbackTitle) {
  const existing = normalizePageVersionHistory(existingHistory, page, fallbackTitle);
  if (!Array.isArray(incomingHistory) || !incomingHistory.length) return existing;

  const merged = [];
  const seenIds = new Set();
  const seenSignatures = new Set();

  const addEntries = entries => {
    entries.forEach(entry => {
      const idValue = asText(entry?.id);
      const signature = versionHistorySignature(entry);
      if (idValue && seenIds.has(idValue)) return;
      if (seenSignatures.has(signature)) return;
      if (idValue) seenIds.add(idValue);
      seenSignatures.add(signature);
      merged.push(entry);
    });
  };

  addEntries(existing);
  addEntries(normalizePageVersionHistory(incomingHistory, page, fallbackTitle));

  return merged.sort((left, right) => {
    const leftTime = Date.parse(left.createdAt || "");
    const rightTime = Date.parse(right.createdAt || "");
    if (Number.isNaN(leftTime) || Number.isNaN(rightTime)) return 0;
    return leftTime - rightTime;
  });
}

function normalizeHistoryTitle(value) {
  return asText(value).trim().toLowerCase();
}

function applyVersionHistoryPayloadToState(state, payload) {
  if (!state || !payload || typeof payload !== "object") return false;

  const storyHistory = Array.isArray(payload.story?.history)
    ? payload.story.history
    : Array.isArray(payload.initialNotes)
      ? payload.initialNotes
      : null;
  if (state.initialNotes && storyHistory) {
    state.initialNotes.versionHistory = mergePageVersionHistories(
      state.initialNotes.versionHistory,
      storyHistory,
      state.initialNotes,
      PROJECT_NOTES_TITLE
    );
  }

  const incomingDrafts = Array.isArray(payload.drafts) ? payload.drafts : [];
  const byId = new Map();
  const byIndex = new Map();
  const titles = new Map();

  incomingDrafts.forEach((entry, index) => {
    const history = Array.isArray(entry?.history) ? entry.history : entry?.versionHistory;
    if (!Array.isArray(history)) return;

    const idValue = asText(entry.id || entry.draftId);
    if (idValue) byId.set(idValue, entry);
    const indexValue = Number.isInteger(entry.index) ? entry.index : index;
    byIndex.set(indexValue, entry);

    const titleKey = normalizeHistoryTitle(entry.title);
    if (titleKey) {
      if (titles.has(titleKey)) titles.set(titleKey, null);
      else titles.set(titleKey, entry);
    }
  });

  state.drafts?.forEach((draft, index) => {
    const titleKey = normalizeHistoryTitle(draft.title);
    const matchingDraft = byId.get(draft.id)
      || (titleKey ? titles.get(titleKey) : null)
      || byIndex.get(index);
    const history = Array.isArray(matchingDraft?.history)
      ? matchingDraft.history
      : matchingDraft?.versionHistory;
    if (!Array.isArray(history)) return;

    draft.versionHistory = mergePageVersionHistories(
      draft.versionHistory,
      history,
      draft,
      draft.title || "Untitled draft"
    );
  });

  return true;
}

function applyExternalVersionHistory(state, options = {}) {
  const normalized = normalizeState(state);
  const filePath = findVersionHistoryFilePath(options);
  if (!filePath || !fs.existsSync(filePath)) return { state: normalized, loaded: false, filePath: null };

  const payload = parseVersionHistoryFile(filePath);
  const loaded = applyVersionHistoryPayloadToState(normalized, payload);
  return { state: normalized, loaded, filePath };
}

function versionHistoryPayloadFromState(state, options = {}) {
  const source = historySourceInfo(options);
  return {
    version: 1,
    sourceFileName: source.fileName,
    sourceFilePath: source.filePath,
    updatedAt: nowIso(),
    projectUpdatedAt: state.updatedAt || null,
    story: {
      id: state.initialNotes?.id || "initial-notes",
      title: PROJECT_NOTES_TITLE,
      history: state.initialNotes?.versionHistory || []
    },
    drafts: (state.drafts || []).map((draft, index) => ({
      id: draft.id,
      index,
      title: draft.title || `Draft ${index + 1}`,
      createdAt: draft.createdAt || null,
      history: draft.versionHistory || []
    }))
  };
}

function stateWithoutVersionHistory(state) {
  const copy = JSON.parse(JSON.stringify(state));
  if (copy.initialNotes) delete copy.initialNotes.versionHistory;
  copy.drafts?.forEach(draft => {
    delete draft.versionHistory;
  });
  return copy;
}

function persistVersionHistory(state, options = {}) {
  const folderPath = readVersionHistoryFolderPath();
  if (!folderPath) return null;

  fs.mkdirSync(folderPath, { recursive: true });
  const filePath = expectedVersionHistoryFilePath(options);
  const stateToWrite = options.mergeExisting
    ? applyExternalVersionHistory(state, options).state
    : state;
  fs.writeFileSync(
    filePath,
    `${JSON.stringify(versionHistoryPayloadFromState(stateToWrite, options), null, 2)}\n`,
    "utf8"
  );
  return filePath;
}

function stateForStorage(state) {
  return readVersionHistoryFolderPath() ? stateWithoutVersionHistory(state) : state;
}

function parseJsonFile(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8").replace(/^\uFEFF/, ""));
}

function migrateStateVersionHistoryToFolder(state, options = {}, migrated = new Map(), errors = []) {
  if (!state || typeof state !== "object") return { migrated, errors };

  try {
    const historyPath = persistVersionHistory(normalizeState(state), {
      filePath: options.filePath,
      fileName: options.fileName,
      mergeExisting: true
    });
    if (historyPath) {
      migrated.set(historyPath, {
        historyPath,
        filePath: options.filePath || null,
        fileName: options.fileName || (options.filePath ? path.basename(options.filePath) : null)
      });
    }
  } catch (error) {
    errors.push({
      filePath: options.filePath || null,
      fileName: options.fileName || null,
      error: error.message
    });
  }

  return { migrated, errors };
}

function migrateEmbeddedVersionHistoriesToFolder(currentState, options = {}) {
  const migrated = new Map();
  const errors = [];
  const linkedTextPath = readTextFileLink();

  try {
    if (fs.existsSync(STATE_FILE)) {
      migrateStateVersionHistoryToFolder(
        parseJsonFile(STATE_FILE),
        { filePath: linkedTextPath || EXPORT_FILE },
        migrated,
        errors
      );
    }
  } catch (error) {
    errors.push({ filePath: STATE_FILE, fileName: path.basename(STATE_FILE), error: error.message });
  }

  const textFileStates = readTextFileStates();
  Object.values(textFileStates).forEach(entry => {
    if (!entry?.state) return;
    migrateStateVersionHistoryToFolder(
      entry.state,
      { filePath: entry.filePath },
      migrated,
      errors
    );
  });

  const currentFilePath = options.filePath || linkedTextPath || (options.fileName ? "" : EXPORT_FILE);
  migrateStateVersionHistoryToFolder(
    currentState,
    { filePath: currentFilePath, fileName: options.fileName },
    migrated,
    errors
  );

  return {
    migrated: Array.from(migrated.values()),
    migratedCount: migrated.size,
    errors
  };
}

function readTextFileLink() {
  ensureDataDir();

  try {
    const parsed = JSON.parse(fs.readFileSync(TEXT_FILE_LINK_FILE, "utf8"));
    const filePath = typeof parsed?.filePath === "string" ? parsed.filePath : "";
    return filePath ? path.resolve(filePath) : null;
  } catch {
    return null;
  }
}

function writeTextFileLink(filePath) {
  ensureDataDir();

  if (!filePath) {
    try {
      fs.rmSync(TEXT_FILE_LINK_FILE, { force: true });
    } catch {}
    return null;
  }

  const resolvedPath = path.resolve(filePath);
  fs.writeFileSync(TEXT_FILE_LINK_FILE, `${JSON.stringify({ filePath: resolvedPath }, null, 2)}\n`, "utf8");
  return resolvedPath;
}

function textFileStateKey(filePath) {
  const resolvedPath = path.resolve(filePath);
  return process.platform === "win32" ? resolvedPath.toLowerCase() : resolvedPath;
}

function readTextFileStates() {
  ensureDataDir();

  try {
    const parsed = JSON.parse(fs.readFileSync(TEXT_FILE_STATES_FILE, "utf8"));
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

function writeTextFileStates(states) {
  ensureDataDir();
  fs.writeFileSync(TEXT_FILE_STATES_FILE, `${JSON.stringify(states, null, 2)}\n`, "utf8");
}

function readTextFileState(filePath) {
  if (!filePath) return null;

  const entry = readTextFileStates()[textFileStateKey(filePath)];
  if (!entry?.state) return null;

  return applyExternalVersionHistory(entry.state, { filePath }).state;
}

function recentTextFiles(limit = 12) {
  const files = new Map();
  const fileExists = filePath => {
    try {
      return fs.existsSync(filePath) && fs.statSync(filePath).isFile();
    } catch {
      return false;
    }
  };
  const addFile = (filePath, updatedAt = "") => {
    if (!filePath) return;
    const resolvedPath = path.resolve(filePath);
    const key = textFileStateKey(resolvedPath);
    const existing = files.get(key);
    if (existing && String(existing.updatedAt || "") >= String(updatedAt || "")) return;

    files.set(key, {
      filePath: resolvedPath,
      fileName: path.basename(resolvedPath),
      updatedAt: updatedAt || "",
      exists: fileExists(resolvedPath)
    });
  };

  Object.values(readTextFileStates()).forEach(entry => {
    addFile(entry?.filePath, entry?.updatedAt);
  });
  addFile(readTextFileLink(), nowIso());

  return Array.from(files.values())
    .filter(file => file.exists)
    .sort((left, right) => String(right.updatedAt || "").localeCompare(String(left.updatedAt || "")))
    .slice(0, limit);
}

function isRecentTextFile(filePath) {
  const targetKey = textFileStateKey(filePath);
  return recentTextFiles(100).some(file => textFileStateKey(file.filePath) === targetKey);
}

function writeTextFileState(filePath, state) {
  if (!filePath || !state) return;

  const resolvedPath = path.resolve(filePath);
  const normalized = normalizeState(state);
  persistVersionHistory(normalized, { filePath: resolvedPath });

  const states = readTextFileStates();
  states[textFileStateKey(resolvedPath)] = {
    filePath: resolvedPath,
    updatedAt: nowIso(),
    state: stateForStorage(normalized)
  };
  writeTextFileStates(states);
}

function writeProjectStateOnly(state, options = {}) {
  ensureDataDir();
  const normalized = normalizeState(state, { touch: Boolean(options.touch) });
  fs.writeFileSync(STATE_FILE, `${JSON.stringify(stateForStorage(normalized), null, 2)}\n`, "utf8");

  const linkedTextPath = readTextFileLink();
  if (linkedTextPath) {
    try {
      writeTextFileState(linkedTextPath, normalized);
    } catch {}
  }

  return normalized;
}

function writeAll(state, options = {}) {
  ensureDataDir();
  const normalized = normalizeState(state, { touch: true });
  const exportText = formatExport(normalized);
  const linkedTextPath = readTextFileLink();
  persistVersionHistory(normalized, {
    filePath: options.filePath || linkedTextPath || (options.fileName ? "" : EXPORT_FILE),
    fileName: options.fileName
  });
  fs.writeFileSync(STATE_FILE, `${JSON.stringify(stateForStorage(normalized), null, 2)}\n`, "utf8");
  fs.writeFileSync(EXPORT_FILE, exportText, "utf8");

  if (linkedTextPath) {
    try {
      fs.writeFileSync(linkedTextPath, exportText, "utf8");
      writeTextFileState(linkedTextPath, normalized);
    } catch (error) {
      throw new Error(`Linked text file write failed: ${linkedTextPath} (${error.code || error.message})`);
    }
  }

  return normalized;
}

function readState() {
  ensureDataDir();
  if (!fs.existsSync(STATE_FILE)) {
    return writeAll(defaultState());
  }

  try {
    const parsed = JSON.parse(fs.readFileSync(STATE_FILE, "utf8"));
    const normalized = applyExternalVersionHistory(parsed, { filePath: readTextFileLink() || EXPORT_FILE }).state;
    fs.writeFileSync(EXPORT_FILE, formatExport(normalized), "utf8");
    return normalized;
  } catch (error) {
    const backup = `${STATE_FILE}.broken-${Date.now()}`;
    fs.copyFileSync(STATE_FILE, backup);
    return writeAll(defaultState());
  }
}

function sendJson(res, statusCode, payload) {
  const body = JSON.stringify(payload);
  res.writeHead(statusCode, {
    "content-type": "application/json; charset=utf-8",
    "content-length": Buffer.byteLength(body)
  });
  res.end(body);
}

function markClientActive() {
  if (AUTO_EXIT_ON_IDLE) lastClientSeenAt = Date.now();
}

function maybeExitWhenIdle(startedAt) {
  if (!AUTO_EXIT_ON_IDLE) return;

  const now = Date.now();
  const idleMs = lastClientSeenAt ? now - lastClientSeenAt : now - startedAt;
  const limitMs = lastClientSeenAt ? CLIENT_IDLE_EXIT_MS : STARTUP_IDLE_EXIT_MS;

  if (idleMs < limitMs) return;

  closeServerAndExit();
}

function windowlessExitFallback() {
  setTimeout(() => process.exit(0), 1500).unref();
}

function closeServerAndExit() {
  if (processExitRequested) return;
  processExitRequested = true;
  flushOnExit();

  if (idleTimer) {
    clearInterval(idleTimer);
    idleTimer = null;
  }

  if (activeServer?.listening) {
    activeServer.close(() => process.exit(0));
    windowlessExitFallback();
    return;
  }

  process.exit(0);
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let body = "";
    req.setEncoding("utf8");
    req.on("data", chunk => {
      body += chunk;
      if (body.length > 10_000_000) {
        reject(new Error("Request body is too large."));
        req.destroy();
      }
    });
    req.on("end", () => resolve(body));
    req.on("error", reject);
  });
}

function safeStaticPath(pathname) {
  const decodedPath = decodeURIComponent(pathname === "/" ? "/index.html" : pathname);
  const filePath = path.normalize(path.join(PUBLIC_DIR, decodedPath));
  return filePath.startsWith(PUBLIC_DIR) ? filePath : null;
}

function currentTextFilePath() {
  return readTextFileLink() || EXPORT_FILE;
}

function parseStatePayload(body) {
  const payload = JSON.parse(body || "{}");
  if (payload?.state && typeof payload.state === "object") {
    return {
      state: payload.state,
      filePath: asText(payload.filePath),
      fileName: payload.fileName
    };
  }

  return {
    state: payload,
    filePath: "",
    fileName: null
  };
}

function statePathPayload(options = {}) {
  const linkedTextPath = readTextFileLink();
  const historySourcePath = options.filePath || linkedTextPath || (options.fileName ? "" : EXPORT_FILE);
  return {
    exportPath: EXPORT_FILE,
    statePath: STATE_FILE,
    linkedTextPath,
    linkedTextFileName: linkedTextPath ? path.basename(linkedTextPath) : null,
    versionHistoryFolderPath: readVersionHistoryFolderPath(),
    versionHistoryPath: findVersionHistoryFilePath({
      filePath: historySourcePath,
      fileName: options.fileName || (historySourcePath ? path.basename(historySourcePath) : "draft-history.txt")
    })
  };
}

function parseDraftPageKey(key) {
  if (key === "story") return { type: "story" };
  const match = /^draft:(.+):(content|notes)$/.exec(asText(key));
  if (!match) return null;
  return { draftId: match[1], type: match[2] };
}

function parseDetachedUnitKey(key) {
  if (key === "story") return { type: "story" };
  const match = /^draft:(.+)$/.exec(asText(key));
  if (!match) return null;
  return { draftId: match[1], type: "draft" };
}

function pageForKey(state, key) {
  const parsed = parseDraftPageKey(key);
  if (!parsed) return null;
  if (parsed.type === "story") return state.initialNotes;

  const draft = state.drafts.find(item => item.id === parsed.draftId);
  if (!draft) return null;
  return parsed.type === "notes" ? draft.notes : draft;
}

function applyPagePayload(state, key, payload) {
  const parsed = parseDraftPageKey(key);
  const page = pageForKey(state, key);
  if (!parsed || !page || !payload || typeof payload !== "object") return false;

  if (typeof payload.content === "string") page.content = payload.content;
  if (typeof payload.contentHtml === "string") page.contentHtml = payload.contentHtml;
  if (payload.format && typeof payload.format === "object") {
    page.format = normalizeFormat({ ...(page.format || {}), ...payload.format });
  }

  if (parsed.type === "content" && typeof payload.title === "string") {
    const nextTitle = payload.title.trim() || "Untitled draft";
    page.title = nextTitle;
    if (page.notes) page.notes.title = `${nextTitle} Notes`;
  }

  page.updatedAt = nowIso();
  return true;
}

function unitForKey(state, key) {
  const parsed = parseDetachedUnitKey(key);
  if (!parsed) return null;

  if (parsed.type === "story") {
    return {
      key: "story",
      type: "story",
      title: PROJECT_NOTES_TITLE,
      pages: [{
        key: "story",
        type: "story",
        title: PROJECT_NOTES_TITLE,
        page: state.initialNotes
      }]
    };
  }

  const draft = state.drafts.find(item => item.id === parsed.draftId);
  if (!draft) return null;

  return {
    key,
    type: "draft",
    draftId: draft.id,
    title: draft.title,
    pages: [
      {
        key: `draft:${draft.id}:content`,
        type: "draft",
        title: draft.title,
        page: draft
      },
      {
        key: `draft:${draft.id}:notes`,
        type: "notes",
        title: `${draft.title} notes`,
        page: draft.notes
      }
    ]
  };
}

function applyUnitPayload(state, key, payload) {
  const unit = unitForKey(state, key);
  if (!unit || !payload || typeof payload !== "object") return false;

  const pages = Array.isArray(payload.pages) ? payload.pages : [];
  let applied = false;
  pages.forEach(entry => {
    const pageKey = asText(entry?.key);
    if (!unit.pages.some(page => page.key === pageKey)) return;
    if (applyPagePayload(state, pageKey, entry.page || entry)) applied = true;
  });

  return applied;
}

function powershellString(value) {
  return `'${String(value).replaceAll("'", "''")}'`;
}

function runPowerShell(command) {
  return new Promise((resolve, reject) => {
    const child = spawn("powershell.exe", [
      "-NoProfile",
      "-STA",
      "-ExecutionPolicy",
      "Bypass",
      "-Command",
      command
    ], {
      windowsHide: true
    });

    let stdout = "";
    let stderr = "";
    child.stdout.on("data", chunk => {
      stdout += chunk;
    });
    child.stderr.on("data", chunk => {
      stderr += chunk;
    });
    child.once("error", reject);
    child.once("close", code => {
      if (code === 0) {
        resolve(stdout.trim());
      } else {
        reject(new Error(stderr.trim() || `PowerShell exited with code ${code}.`));
      }
    });
  });
}

function existingDirectory(filePath) {
  const directoryPath = path.dirname(filePath);
  return fs.existsSync(directoryPath) ? directoryPath : DATA_DIR;
}

function windowsFileDialogCommand(dialogType, initialDirectory, initialFileName = "") {
  const dialogClass = dialogType === "save"
    ? "System.Windows.Forms.SaveFileDialog"
    : "System.Windows.Forms.OpenFileDialog";
  const dialogOptions = dialogType === "save"
    ? [
        "$dialog.OverwritePrompt = $true",
        "$dialog.AddExtension = $true",
        "$dialog.DefaultExt = 'txt'",
        `$dialog.FileName = ${powershellString(initialFileName)}`
      ]
    : [
        "$dialog.Multiselect = $false"
      ];

  return [
    "Add-Type -AssemblyName System.Windows.Forms",
    "Add-Type -AssemblyName System.Drawing",
    "[System.Windows.Forms.Application]::EnableVisualStyles()",
    "$owner = New-Object System.Windows.Forms.Form",
    "$owner.TopMost = $true",
    "$owner.ShowInTaskbar = $false",
    "$owner.StartPosition = 'CenterScreen'",
    "$owner.Size = New-Object System.Drawing.Size(1, 1)",
    "$owner.Opacity = 0",
    "$owner.Show()",
    "$owner.Activate()",
    `$dialog = New-Object ${dialogClass}`,
    "$dialog.Filter = 'Text files (*.txt)|*.txt|All files (*.*)|*.*'",
    "$dialog.CheckPathExists = $true",
    `$dialog.InitialDirectory = ${powershellString(initialDirectory)}`,
    ...dialogOptions,
    "$result = $dialog.ShowDialog($owner)",
    "$owner.Close()",
    "$owner.Dispose()",
    "if ($result -eq [System.Windows.Forms.DialogResult]::OK) { [Console]::Write($dialog.FileName) }"
  ].join("; ");
}

async function chooseTextFileToOpen() {
  const initialDirectory = existingDirectory(readTextFileLink() || EXPORT_FILE);
  const command = windowsFileDialogCommand("open", initialDirectory);
  return runPowerShell(command);
}

async function chooseTextFileToSave(suggestedName) {
  const linkedPath = readTextFileLink();
  const initialDirectory = existingDirectory(linkedPath || EXPORT_FILE);
  const initialFileName = path.basename(linkedPath || suggestedName || EXPORT_FILE);
  const command = windowsFileDialogCommand("save", initialDirectory, initialFileName);
  return runPowerShell(command);
}

function windowsFolderDialogCommand(initialDirectory) {
  return [
    "Add-Type -AssemblyName System.Windows.Forms",
    "Add-Type -AssemblyName System.Drawing",
    "[System.Windows.Forms.Application]::EnableVisualStyles()",
    "$owner = New-Object System.Windows.Forms.Form",
    "$owner.TopMost = $true",
    "$owner.ShowInTaskbar = $false",
    "$owner.StartPosition = 'CenterScreen'",
    "$owner.Size = New-Object System.Drawing.Size(1, 1)",
    "$owner.Opacity = 0",
    "$owner.Show()",
    "$owner.Activate()",
    "$dialog = New-Object System.Windows.Forms.FolderBrowserDialog",
    "$dialog.Description = 'Select the version history folder'",
    "$dialog.ShowNewFolderButton = $true",
    `$dialog.SelectedPath = ${powershellString(initialDirectory)}`,
    "$result = $dialog.ShowDialog($owner)",
    "$owner.Close()",
    "$owner.Dispose()",
    "if ($result -eq [System.Windows.Forms.DialogResult]::OK) { [Console]::Write($dialog.SelectedPath) }"
  ].join("; ");
}

async function chooseVersionHistoryFolder() {
  const initialDirectory = readVersionHistoryFolderPath() || existingDirectory(readTextFileLink() || EXPORT_FILE);

  if (process.platform === "win32") {
    return runPowerShell(windowsFolderDialogCommand(initialDirectory));
  }

  throw new Error("Version history folder selection is only available in the desktop Windows dialog right now.");
}

function openFileLocation(filePath) {
  const targetPath = path.resolve(filePath);
  const targetExists = fs.existsSync(targetPath);
  const isFile = targetExists && fs.statSync(targetPath).isFile();
  const directoryPath = isFile ? path.dirname(targetPath) : targetPath;

  let command = "";
  let args = [];

  if (process.platform === "win32") {
    command = "explorer.exe";
    args = isFile ? [`/select,${targetPath}`] : [directoryPath];
  } else if (process.platform === "darwin") {
    command = "open";
    args = isFile ? ["-R", targetPath] : [directoryPath];
  } else {
    command = "xdg-open";
    args = [directoryPath];
  }

  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      detached: true,
      stdio: "ignore"
    });

    child.once("error", reject);
    child.once("spawn", () => {
      child.unref();
      resolve({ filePath: targetPath, directoryPath, command, args });
    });
  });
}

async function handleApi(req, res, pathname) {
  if (req.method === "GET" && pathname === "/api/server-info") {
    sendJson(res, 200, {
      ok: true,
      build: SERVER_BUILD
    });
    return;
  }

  if (req.method === "POST" && pathname === "/api/ping") {
    markClientActive();
    sendJson(res, 200, { ok: true });
    return;
  }

  if (req.method === "GET" && pathname === "/api/state") {
    markClientActive();
    const state = readState();
    sendJson(res, 200, {
      state,
      ...statePathPayload()
    });
    return;
  }

  if (req.method === "PUT" && pathname === "/api/state") {
    markClientActive();
    const body = await readBody(req);
    const payload = parseStatePayload(body);
    const state = writeAll(payload.state, {
      filePath: payload.filePath,
      fileName: payload.fileName
    });
    sendJson(res, 200, {
      ok: true,
      state,
      ...statePathPayload()
    });
    return;
  }

  if ((req.method === "PATCH" || req.method === "POST") && pathname === "/api/page") {
    markClientActive();
    const body = await readBody(req);
    const payload = body ? JSON.parse(body) : {};
    const key = asText(payload.key);
    const state = readState();

    if (!applyPagePayload(state, key, payload.page)) {
      sendJson(res, 404, { error: "Page not found" });
      return;
    }

    const savedState = writeAll(state);
    sendJson(res, 200, {
      ok: true,
      state: savedState,
      page: pageForKey(savedState, key)
    });
    return;
  }

  if ((req.method === "PATCH" || req.method === "POST") && pathname === "/api/unit") {
    markClientActive();
    const body = await readBody(req);
    const payload = body ? JSON.parse(body) : {};
    const key = asText(payload.key || payload.unitKey);
    const state = readState();

    if (!applyUnitPayload(state, key, payload)) {
      sendJson(res, 404, { error: "Panel unit not found" });
      return;
    }

    const savedState = writeAll(state);
    sendJson(res, 200, {
      ok: true,
      state: savedState,
      unit: unitForKey(savedState, key)
    });
    return;
  }

  if (req.method === "POST" && pathname === "/api/view-state") {
    markClientActive();
    const body = await readBody(req);
    const payload = body ? JSON.parse(body) : {};
    const state = readState();
    if (payload.viewState && typeof payload.viewState === "object") {
      state.viewState = payload.viewState;
    }

    const savedState = writeProjectStateOnly(state);
    sendJson(res, 200, {
      ok: true,
      viewState: savedState.viewState || null
    });
    return;
  }

  if (req.method === "POST" && pathname === "/api/close") {
    markClientActive();
    const body = await readBody(req);
    if (body) {
      const payload = parseStatePayload(body);
      writeAll(payload.state, {
        filePath: payload.filePath,
        fileName: payload.fileName
      });
    } else {
      writeAll(readState());
    }
    sendJson(res, 200, { ok: true });
    return;
  }

  if (req.method === "POST" && pathname === "/api/shutdown") {
    const body = await readBody(req);
    if (body) {
      const payload = parseStatePayload(body);
      writeAll(payload.state, {
        filePath: payload.filePath,
        fileName: payload.fileName
      });
    } else {
      writeAll(readState());
    }

    sendJson(res, 200, { ok: true });
    setTimeout(() => {
      closeServerAndExit();
    }, 50).unref();
    return;
  }

  if (req.method === "GET" && pathname === "/api/export") {
    const state = readState();
    const body = formatExport(state);
    res.writeHead(200, {
      "content-type": "text/plain; charset=utf-8",
      "content-disposition": "inline; filename=\"draft-history.txt\"",
      "content-length": Buffer.byteLength(body)
    });
    res.end(body);
    return;
  }

  if (req.method === "POST" && pathname === "/api/version-history/apply") {
    markClientActive();
    const body = await readBody(req);
    const payload = parseStatePayload(body);
    const result = applyExternalVersionHistory(payload.state, {
      filePath: payload.filePath,
      fileName: payload.fileName
    });
    sendJson(res, 200, {
      ok: true,
      state: result.state,
      loaded: result.loaded,
      versionHistoryPath: result.filePath || findVersionHistoryFilePath({
        filePath: payload.filePath,
        fileName: payload.fileName
      }),
      ...statePathPayload({ filePath: payload.filePath, fileName: payload.fileName })
    });
    return;
  }

  if (req.method === "POST" && pathname === "/api/version-history-folder/select") {
    markClientActive();
    const body = await readBody(req);
    const payload = body
      ? parseStatePayload(body)
      : { state: readState(), filePath: "", fileName: null };
    const folderPath = await chooseVersionHistoryFolder();
    if (!folderPath) {
      sendJson(res, 200, { ok: false, cancelled: true });
      return;
    }

    const versionHistoryFolderPath = writeVersionHistoryFolderPath(folderPath);
    const filePath = payload.filePath || readTextFileLink() || (payload.fileName ? "" : EXPORT_FILE);
    const migration = migrateEmbeddedVersionHistoriesToFolder(payload.state, {
      filePath,
      fileName: payload.fileName
    });
    const result = applyExternalVersionHistory(payload.state, {
      filePath,
      fileName: payload.fileName
    });
    const state = writeAll(result.state, {
      filePath,
      fileName: payload.fileName
    });
    sendJson(res, 200, {
      ok: true,
      state,
      loaded: result.loaded,
      versionHistoryFolderPath,
      migratedCount: migration.migratedCount,
      migrationErrors: migration.errors,
      ...statePathPayload({ filePath, fileName: payload.fileName })
    });
    return;
  }

  if (req.method === "POST" && pathname === "/api/open-text-file") {
    markClientActive();
    const filePath = await chooseTextFileToOpen();
    if (!filePath) {
      sendJson(res, 200, { ok: false, cancelled: true });
      return;
    }

    writeTextFileLink(filePath);
    sendJson(res, 200, {
      ok: true,
      filePath,
      fileName: path.basename(filePath),
      text: fs.readFileSync(filePath, "utf8"),
      storedState: readTextFileState(filePath),
      ...statePathPayload({ filePath, fileName: path.basename(filePath) })
    });
    return;
  }

  if (req.method === "GET" && pathname === "/api/recent-text-files") {
    markClientActive();
    sendJson(res, 200, {
      ok: true,
      files: recentTextFiles()
    });
    return;
  }

  if (req.method === "POST" && pathname === "/api/open-recent-text-file") {
    markClientActive();
    const body = await readBody(req);
    const payload = body ? JSON.parse(body) : {};
    const filePath = asText(payload.filePath);

    if (!filePath || !isRecentTextFile(filePath)) {
      sendJson(res, 404, { error: "Recent file not found" });
      return;
    }

    const resolvedPath = path.resolve(filePath);
    try {
      if (!fs.existsSync(resolvedPath) || !fs.statSync(resolvedPath).isFile()) {
        sendJson(res, 404, { error: "Recent file no longer exists" });
        return;
      }
    } catch {
      sendJson(res, 404, { error: "Recent file no longer exists" });
      return;
    }

    writeTextFileLink(resolvedPath);
    sendJson(res, 200, {
      ok: true,
      filePath: resolvedPath,
      fileName: path.basename(resolvedPath),
      text: fs.readFileSync(resolvedPath, "utf8"),
      storedState: readTextFileState(resolvedPath),
      ...statePathPayload({ filePath: resolvedPath, fileName: path.basename(resolvedPath) })
    });
    return;
  }

  if (req.method === "POST" && pathname === "/api/save-as-text-file") {
    markClientActive();
    const body = await readBody(req);
    const payload = parseStatePayload(body);
    const normalized = normalizeState(payload.state, { touch: true });
    const filePath = await chooseTextFileToSave(payload.fileName);
    if (!filePath) {
      sendJson(res, 200, { ok: false, cancelled: true });
      return;
    }

    writeTextFileLink(filePath);
    const state = writeAll(normalized, {
      filePath,
      fileName: path.basename(filePath)
    });
    sendJson(res, 200, {
      ok: true,
      state,
      filePath,
      fileName: path.basename(filePath),
      ...statePathPayload({ filePath, fileName: path.basename(filePath) })
    });
    return;
  }

  if (req.method === "POST" && pathname === "/api/cache-text-file-state") {
    markClientActive();
    const body = await readBody(req);
    const payload = body ? JSON.parse(body) : {};
    if (payload.filePath && payload.state) writeTextFileState(payload.filePath, payload.state);
    sendJson(res, 200, { ok: true });
    return;
  }

  if (req.method === "POST" && pathname === "/api/clear-text-file-link") {
    markClientActive();
    writeTextFileLink(null);
    sendJson(res, 200, { ok: true });
    return;
  }

  if (req.method === "POST" && pathname === "/api/open-file-location") {
    const body = await readBody(req);
    const payload = body ? JSON.parse(body) : {};
    readState();
    const location = await openFileLocation(currentTextFilePath(payload.fileName));
    sendJson(res, 200, { ok: true, ...location });
    return;
  }

  sendJson(res, 404, { error: "Not found" });
}

function createHttpServer() {
  return http.createServer(async (req, res) => {
    try {
      const { pathname } = new URL(req.url, `http://${req.headers.host || "localhost"}`);

      if (pathname.startsWith("/api/")) {
        await handleApi(req, res, pathname);
        return;
      }

      const filePath = safeStaticPath(pathname);
      if (!filePath || !fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) {
        res.writeHead(404, { "content-type": "text/plain; charset=utf-8" });
        res.end("Not found");
        return;
      }

      const ext = path.extname(filePath);
      res.writeHead(200, {
        "content-type": mimeTypes[ext] || "application/octet-stream",
        "cache-control": "no-store"
      });
      fs.createReadStream(filePath).pipe(res);
    } catch (error) {
      sendJson(res, 500, { error: error.message });
    }
  });
}

function flushOnExit() {
  try {
    writeAll(readState());
  } catch (error) {
    console.error(error);
  }
}

function startServer(options = {}) {
  const port = Number(options.port ?? PORT);
  const host = options.host;
  const server = createHttpServer();
  const serverStartedAt = Date.now();
  lastClientSeenAt = 0;
  readState();

  return new Promise((resolve, reject) => {
    const onError = error => {
      if (activeServer === server) activeServer = null;
      reject(error);
    };

    server.once("error", onError);
    server.listen(port, host, () => {
      server.off("error", onError);
      activeServer = server;

      const address = server.address();
      const actualPort = typeof address === "object" && address ? address.port : port;
      const urlHost = host && host !== "0.0.0.0" && host !== "::" ? host : "localhost";

      if (AUTO_EXIT_ON_IDLE) {
        if (idleTimer) clearInterval(idleTimer);
        idleTimer = setInterval(() => maybeExitWhenIdle(serverStartedAt), 5_000);
        idleTimer.unref();
      }

      resolve({
        server,
        port: actualPort,
        url: `http://${urlHost}:${actualPort}/`,
        exportFile: EXPORT_FILE,
        stateFile: STATE_FILE
      });
    });
  });
}

function stopServer(serverToStop = activeServer) {
  if (idleTimer) {
    clearInterval(idleTimer);
    idleTimer = null;
  }

  flushOnExit();

  if (!serverToStop) return Promise.resolve();

  return new Promise(resolve => {
    try {
      serverToStop.close(error => {
        if (error && error.code !== "ERR_SERVER_NOT_RUNNING") console.error(error);
        if (activeServer === serverToStop) activeServer = null;
        resolve();
      });
    } catch (error) {
      if (error.code !== "ERR_SERVER_NOT_RUNNING") console.error(error);
      if (activeServer === serverToStop) activeServer = null;
      resolve();
    }
  });
}

process.on("SIGINT", closeServerAndExit);

process.on("SIGTERM", closeServerAndExit);

if (require.main === module) {
  startServer({ port: PORT })
    .then(({ url }) => {
      console.log(`Draft Diff Editor running at ${url}`);
      console.log(`Companion text file: ${EXPORT_FILE}`);
    })
    .catch(error => {
      console.error(error);
      process.exit(1);
    });
}

module.exports = {
  DATA_DIR,
  EXPORT_FILE,
  SERVER_BUILD,
  flushOnExit,
  startServer,
  stopServer
};
