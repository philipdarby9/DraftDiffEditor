const fs = require("node:fs");
const http = require("node:http");
const path = require("node:path");
const crypto = require("node:crypto");
const { spawn } = require("node:child_process");
const { URL } = require("node:url");
const { Worker } = require("node:worker_threads");

const ROOT = __dirname;
const PUBLIC_DIR = path.join(ROOT, "public");
const DATA_DIR = path.resolve(process.env.DRAFT_DIFF_DATA_DIR || path.join(ROOT, "data"));
const STATE_FILE = path.join(DATA_DIR, "project.json");
const EXPORT_FILE = path.join(DATA_DIR, "draft-history.txt");
const TEXT_FILE_LINK_FILE = path.join(DATA_DIR, "text-file-link.json");
const TEXT_FILE_STATES_FILE = path.join(DATA_DIR, "text-file-states.json");
const VERSION_HISTORY_FOLDER_FILE = path.join(DATA_DIR, "version-history-folder.json");
const BACKUP_FOLDER_FILE = path.join(DATA_DIR, "backup-folder.json");
const VERSION_HISTORY_FILE_SUFFIX = ".version-history.json";
const BACKUP_HISTORY_REPORT_SUFFIX = ".version-history.md";
const CUT_HISTORY_REPORT_SUFFIX = ".per-draft-cut-history.html";
const PORT = Number(process.env.PORT || 4173);
const PROJECT_NOTES_TITLE = "Project notes";
const FORMAT_DEFAULT_VERSION = 2;
const VIEW_STATE_VERSION = 2;
const LEGACY_DEFAULT_FONT_FAMILY = "Segoe UI";
const MIN_PAGE_PANE_PERCENT = 12;
const SERVER_BUILD = "server-per-draft-final-diffs-only-2026-05-31";
const AUTO_EXIT_ON_IDLE = process.env.DRAFT_DIFF_AUTO_EXIT === "1";
const CLIENT_IDLE_EXIT_MS = 5 * 60_000;
const STARTUP_IDLE_EXIT_MS = 120_000;

class BackupFolderMissingError extends Error {
  constructor(folderPath) {
    super(`Backup folder missing: ${folderPath}`);
    this.name = "BackupFolderMissingError";
    this.code = "BACKUP_FOLDER_MISSING";
    this.statusCode = 409;
    this.folderPath = folderPath;
  }
}

let lastClientSeenAt = 0;
let activeServer = null;
let idleTimer = null;
let processExitRequested = false;
const cutHistoryJobs = new Map();
const cutHistoryIdleWaiters = new Set();

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

function wordCountForText(text) {
  const matches = asText(text).match(/[\p{L}\p{N}]+(?:[\u0027\u2019/-][\p{L}\p{N}]+)*|\*+/gu);
  return matches ? matches.length : 0;
}

function pageBlock(title, createdAt, content, metadata = {}) {
  const body = asText(content).trimEnd();
  const lines = [
    title,
    `Created: ${formatDate(createdAt)}`
  ];
  if (metadata.updatedAt) lines.push(`Last edited: ${formatDate(metadata.updatedAt)}`);
  if (Number.isFinite(metadata.wordCount)) {
    lines.push(`Word count: ${Number(metadata.wordCount).toLocaleString("en-GB")}`);
  }
  lines.push("", body || "[No text yet]");
  return lines.join("\n");
}

function draftBlockMetadata(draft) {
  return {
    updatedAt: draft.updatedAt || draft.createdAt,
    wordCount: wordCountForText(draft.content)
  };
}

function projectNotesBlockMetadata(state) {
  return {
    updatedAt: state.initialNotes.updatedAt || state.initialNotes.createdAt
  };
}

function formatExport(state) {
  const pages = [
    pageBlock(
      PROJECT_NOTES_TITLE,
      state.initialNotes.createdAt,
      state.initialNotes.content,
      projectNotesBlockMetadata(state)
    )
  ];

  state.drafts.forEach((draft, index) => {
    const title = draft.title || `Draft ${index + 1}`;
    pages.push(pageBlock(title, draft.createdAt, draft.content, draftBlockMetadata(draft)));
    pages.push(pageBlock(`${title} Notes`, draft.notes.createdAt, draft.notes.content));
  });

  return `${pages.join("\n\n---\n\n")}\n`;
}

function ensureDataDir() {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

function directoryExists(folderPath) {
  if (!folderPath) return false;

  try {
    return fs.existsSync(folderPath) && fs.statSync(folderPath).isDirectory();
  } catch {
    return false;
  }
}

function readVersionHistoryFolderPath() {
  ensureDataDir();

  try {
    const parsed = JSON.parse(fs.readFileSync(VERSION_HISTORY_FOLDER_FILE, "utf8").replace(/^\uFEFF/, ""));
    const folderPath = asText(parsed?.folderPath).trim();
    if (folderPath) return path.resolve(folderPath);
  } catch {
    // Continue to the legacy backup-folder setting below.
  }

  try {
    const parsed = JSON.parse(fs.readFileSync(BACKUP_FOLDER_FILE, "utf8").replace(/^\uFEFF/, ""));
    const folderPath = asText(parsed?.folderPath).trim();
    return folderPath ? path.resolve(folderPath) : null;
  } catch {
    return null;
  }
}

function versionHistoryFolderMissing() {
  const folderPath = readVersionHistoryFolderPath();
  return Boolean(folderPath && !directoryExists(folderPath));
}

function existingVersionHistoryFolderPath() {
  const folderPath = readVersionHistoryFolderPath();
  return directoryExists(folderPath) ? folderPath : null;
}

function requireVersionHistoryFolderPath() {
  const folderPath = readVersionHistoryFolderPath();
  if (!folderPath) return null;
  if (!directoryExists(folderPath)) throw new BackupFolderMissingError(folderPath);
  return folderPath;
}

function writeVersionHistoryFolderPath(folderPath) {
  ensureDataDir();

  if (!folderPath) {
    try {
      fs.rmSync(VERSION_HISTORY_FOLDER_FILE, { force: true });
    } catch {}
    try {
      fs.rmSync(BACKUP_FOLDER_FILE, { force: true });
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

function readBackupFolderPath() {
  return readVersionHistoryFolderPath();
}

function writeBackupFolderPath(folderPath) {
  return writeVersionHistoryFolderPath(folderPath);
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

function safeBackupFileName(sourceName, fallbackName = "draft-history.txt") {
  const rawName = path.basename(asText(sourceName) || fallbackName);
  const fallback = path.basename(fallbackName);
  const cleaned = rawName
    .replace(/[<>:"/\\|?*\x00-\x1f]/g, "_")
    .replace(/^[.\s]+|[.\s]+$/g, "")
    .slice(0, 160);
  return cleaned || fallback;
}

function versionHistoryJsonFolderPath(options = {}) {
  const folderPath = options.requireExistingRoot
    ? requireVersionHistoryFolderPath()
    : existingVersionHistoryFolderPath();
  return folderPath ? path.join(folderPath, "json") : null;
}

function legacyVersionHistoryJsonFolderPath() {
  const folderPath = existingVersionHistoryFolderPath();
  return folderPath ? path.join(folderPath, "jsons") : null;
}

function originalTextBackupFolderPath() {
  const folderPath = requireVersionHistoryFolderPath();
  return folderPath ? path.join(folderPath, "original txt") : null;
}

function markdownHistoryBackupFolderPath() {
  const folderPath = requireVersionHistoryFolderPath();
  return folderPath ? path.join(folderPath, "version history md") : null;
}

function historySummaryBackupFolderPath() {
  const folderPath = requireVersionHistoryFolderPath();
  return folderPath ? path.join(folderPath, "version history summaries") : null;
}

function expectedVersionHistoryFilePath(options = {}) {
  const folderPath = versionHistoryJsonFolderPath({
    requireExistingRoot: Boolean(options.requireExistingRoot)
  });
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
  const rootFolderPath = existingVersionHistoryFolderPath();
  const jsonFolderPath = versionHistoryJsonFolderPath();
  if (!rootFolderPath || !jsonFolderPath) return null;

  const source = historySourceInfo(options);
  const expectedPath = expectedVersionHistoryFilePath(source);
  if (expectedPath && fs.existsSync(expectedPath)) return expectedPath;

  const searchFolders = [...new Set([
    jsonFolderPath,
    legacyVersionHistoryJsonFolderPath(),
    rootFolderPath
  ].filter(Boolean))];
  for (const folderPath of searchFolders) {
    try {
      const entries = fs.readdirSync(folderPath, { withFileTypes: true });
      for (const entry of entries) {
        if (!entry.isFile() || !entry.name.endsWith(VERSION_HISTORY_FILE_SUFFIX)) continue;
        const filePath = path.join(folderPath, entry.name);
        const payload = parseVersionHistoryFile(filePath);
        if (versionHistoryPayloadMatchesSource(payload, source)) return filePath;
      }
    } catch {
      // Missing folders are expected until the first save after folder selection.
    }
  }

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
  const folderPath = versionHistoryJsonFolderPath({ requireExistingRoot: true });
  if (!folderPath) return null;

  fs.mkdirSync(folderPath, { recursive: true });
  const filePath = expectedVersionHistoryFilePath({ ...options, requireExistingRoot: true });
  const stateToWrite = options.mergeExisting === false
    ? state
    : applyExternalVersionHistory(state, options).state;
  fs.writeFileSync(
    filePath,
    `${JSON.stringify(versionHistoryPayloadFromState(stateToWrite, options), null, 2)}\n`,
    "utf8"
  );
  return filePath;
}

function textForHistoryVersion(version) {
  return asText(version?.content) || htmlToText(version?.contentHtml || "");
}

function reportVersionSignature(version) {
  return JSON.stringify({
    title: asText(version?.title),
    content: textForHistoryVersion(version),
    format: normalizeFormat(version?.format || {})
  });
}

function historyWithCurrentVersion(page, fallbackTitle) {
  const history = normalizePageVersionHistory(page?.versionHistory, page, fallbackTitle);
  const current = pageVersionSnapshot(page, fallbackTitle, page.updatedAt || nowIso());
  if (
    versionHasMeaningfulContent(current) &&
    (!history.length || reportVersionSignature(history[history.length - 1]) !== reportVersionSignature(current))
  ) {
    history.push(current);
  }
  return history;
}

function reportInlineText(value) {
  return asText(value).replace(/\s+/g, " ").trim();
}

function reportTextBlock(value) {
  return asText(value).replace(/\s+$/u, "");
}

function truncateContext(value, side, limit = 180) {
  const text = asText(value).replace(/\s+/g, " ").trim();
  if (text.length <= limit) return text;
  return side === "before"
    ? `...${text.slice(text.length - limit).trimStart()}`
    : `${text.slice(0, limit).trimEnd()}...`;
}

function markdownInline(value) {
  return reportInlineText(value)
    .replace(/\\/g, "\\\\")
    .replace(/`/g, "\\`")
    .replace(/\*/g, "\\*")
    .replace(/_/g, "\\_")
    .replace(/\[/g, "\\[")
    .replace(/\]/g, "\\]");
}

function markdownHeadingText(value, fallback = "Untitled") {
  return reportInlineText(value || fallback).replace(/^#+\s*/u, "").trim() || fallback;
}

function markdownCodeFence(value) {
  const text = reportTextBlock(value);
  const longestFence = Math.max(2, ...(text.match(/`+/g) || []).map(match => match.length));
  const fence = "`".repeat(longestFence + 1);
  return `${fence}\n${text || "[No text yet]"}\n${fence}`;
}

function previousClauseBoundary(source, index) {
  const text = asText(source);
  for (let offset = Math.min(index, text.length) - 1; offset >= 0; offset -= 1) {
    if (/[.!?;:\n]/u.test(text[offset])) return offset + 1;
  }
  return 0;
}

function nextClauseBoundary(source, index) {
  const text = asText(source);
  for (let offset = Math.max(0, index); offset < text.length; offset += 1) {
    if (/[.!?;:\n]/u.test(text[offset])) return offset + 1;
  }
  return text.length;
}

function contextBeforeChange(source, start) {
  const text = asText(source);
  const boundary = previousClauseBoundary(text, start);
  let context = text.slice(boundary, start);
  if (!reportInlineText(context) && boundary > 0) {
    const previousBoundary = previousClauseBoundary(text, boundary - 1);
    context = text.slice(previousBoundary, boundary);
  }
  return truncateContext(context, "before");
}

function contextAfterChange(source, end) {
  const text = asText(source);
  const boundary = nextClauseBoundary(text, end);
  let context = text.slice(end, boundary);
  if (!reportInlineText(context) && boundary < text.length) {
    const nextBoundary = nextClauseBoundary(text, boundary + 1);
    context = text.slice(boundary, nextBoundary);
  }
  return truncateContext(context, "after");
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
    coalesced.push(...coalesceReplacementSubsegments(parts.slice(segmentStart, index)));
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
        beforeStart: before[i].beforeStart,
        beforeEnd: before[i].beforeEnd,
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
    beforeStart: removedPart.beforeStart,
    beforeEnd: removedPart.beforeEnd,
    afterIndex: addedPart.afterIndex
  };
}

function isMeaningfulCommonChangedRun(parts) {
  if (!parts.length) return false;
  return parts.filter(part => isDiffSequenceWordText(part.text)).length >= 1;
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
    while (index < parts.length && parts[index].type !== "same") {
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
        beforeStart: before[i].start,
        beforeEnd: before[i].end,
        afterIndex: after[j].index ?? j,
        afterStart: after[j].start,
        afterEnd: after[j].end
      });
      i += 1;
      j += 1;
    } else if (rows[i + 1][j] >= rows[i][j + 1]) {
      result.push({
        type: "removed",
        text: before[i].text,
        marks: before[i].marks || {},
        beforeIndex: before[i].index ?? i,
        beforeStart: before[i].start,
        beforeEnd: before[i].end
      });
      i += 1;
    } else {
      result.push({
        type: "added",
        text: after[j].text,
        marks: after[j].marks || {},
        afterIndex: after[j].index ?? j,
        afterStart: after[j].start,
        afterEnd: after[j].end
      });
      j += 1;
    }
  }

  while (i < before.length) {
    result.push({
      type: "removed",
      text: before[i].text,
      marks: before[i].marks || {},
      beforeIndex: before[i].index ?? i,
      beforeStart: before[i].start,
      beforeEnd: before[i].end
    });
    i += 1;
  }
  while (j < after.length) {
    result.push({
      type: "added",
      text: after[j].text,
      marks: after[j].marks || {},
      afterIndex: after[j].index ?? j,
      afterStart: after[j].start,
      afterEnd: after[j].end
    });
    j += 1;
  }

  return cleanupWeakReplacementAnchors(result);
}

function normalizeDiffSource(text) {
  return asText(text).replace(/\r\n/g, "\n").replace(/\r/g, "\n");
}

function tokenizeSegment(text, marks = {}) {
  const normalized = normalizeDiffSource(text);
  const tokenRegex = /\n|[^\S\n]+|[\p{L}\p{N}]+|[^\s\p{L}\p{N}]/gu;
  const semanticKey = marks.whitespace ? "" : `${marks.bold ? "b" : ""}${marks.italic ? "i" : ""}${marks.underline ? "u" : ""}${marks.strike ? "s" : ""}`;
  const tokens = [];
  let match = tokenRegex.exec(normalized);

  while (match) {
    const token = match[0];
    tokens.push({
      key: /^\s+$/u.test(token) ? token : `${token}|${semanticKey}`,
      text: token,
      marks: { ...marks },
      isWhitespace: /^\s+$/u.test(token),
      start: match.index,
      end: match.index + token.length
    });
    match = tokenRegex.exec(normalized);
  }

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

const DIFF_BOUNDARY_CONJUNCTIONS = new Set(["and", "but", "or", "so", "yet"]);
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
  return Boolean(normalizedLeft && normalizedRight && normalizedLeft === normalizedRight);
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
  const closingPunctuation = new Set([")", "]", "}", "\"", "'", "\u201d", "\u2019"]);

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
  const rows = Array.from({ length: beforeBlocks.length + 1 }, () => Array(afterBlocks.length + 1).fill(0));
  const similarities = Array.from({ length: beforeBlocks.length }, () => Array(afterBlocks.length).fill(0));

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
        candidates.push({ ...range, beforeStart: previousDiffExpansionStart(beforeBlocks, range.beforeStart, prevBeforeLimit) });
      }
      if (range.afterStart > prevAfterLimit) {
        candidates.push({ ...range, afterStart: previousDiffExpansionStart(afterBlocks, range.afterStart, prevAfterLimit) });
      }
      if (range.beforeEnd < nextBeforeLimit) {
        candidates.push({ ...range, beforeEnd: nextDiffExpansionEnd(beforeBlocks, range.beforeEnd, nextBeforeLimit) });
      }
      if (range.afterEnd < nextAfterLimit) {
        candidates.push({ ...range, afterEnd: nextDiffExpansionEnd(afterBlocks, range.afterEnd, nextAfterLimit) });
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
    beforeStart: type === "removed" ? token.start : undefined,
    beforeEnd: type === "removed" ? token.end : undefined,
    afterIndex: type === "added" ? token.index : undefined,
    afterStart: type === "added" ? token.start : undefined,
    afterEnd: type === "added" ? token.end : undefined
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

function diffReportTexts(beforeText, afterText) {
  const beforeBlocks = splitDiffBlocks(tokenizeSegment(beforeText));
  const afterBlocks = splitDiffBlocks(tokenizeSegment(afterText));
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

function diffPartRange(part, type) {
  const start = type === "added"
    ? part.afterStart ?? part.start
    : part.beforeStart ?? part.start;
  const end = type === "added"
    ? part.afterEnd ?? part.end
    : part.beforeEnd ?? part.end;
  return Number.isFinite(start) && Number.isFinite(end) ? { start, end } : null;
}

function makeChangeSegmentFromParts(sourceText, parts, type) {
  const ranges = parts.map(part => diffPartRange(part, type)).filter(Boolean);
  const text = parts.map(part => part.text || "").join("").replace(/\s+/g, " ").trim();
  if (!text || !ranges.length) return null;

  const start = Math.min(...ranges.map(range => range.start));
  const end = Math.max(...ranges.map(range => range.end));
  return {
    text,
    before: contextBeforeChange(sourceText, start),
    after: contextAfterChange(sourceText, end)
  };
}

function changeSegmentsFromDiff(parts, type, sourceText, limit) {
  const segments = [];
  let truncated = false;
  let count = 0;
  let current = [];

  const flush = () => {
    const segment = makeChangeSegmentFromParts(sourceText, current, type);
    current = [];
    if (!segment) return;

    count += 1;
    if (segments.length < limit) segments.push(segment);
    else truncated = true;
  };

  parts.forEach(part => {
    if (part.type === type) {
      current.push(part);
      return;
    }
    if (current.length) flush();
  });
  if (current.length) flush();

  return { segments, truncated, count };
}

function summarizeTextChanges(oldText, newText, limit = 200) {
  const oldSource = normalizeDiffSource(oldText);
  const newSource = normalizeDiffSource(newText);
  const parts = diffReportTexts(oldSource, newSource);
  const added = changeSegmentsFromDiff(parts, "added", newSource, limit);
  const removed = changeSegmentsFromDiff(parts, "removed", oldSource, limit);

  return {
    added: added.segments,
    removed: removed.segments,
    addedCount: added.count,
    removedCount: removed.count,
    addedTruncated: added.truncated,
    removedTruncated: removed.truncated
  };
}

function reportChangeLine(segment) {
  const before = markdownInline(segment.before);
  const changed = markdownInline(segment.text);
  const after = markdownInline(segment.after);
  return [
    before ? `*${before}*` : "",
    changed ? `**${changed}**` : "",
    after ? `*${after}*` : ""
  ].filter(Boolean).join(" ");
}

function appendChangeList(lines, title, segments, truncated, count = segments.length) {
  lines.push(`**${title}: ${count}**`);
  if (!count) {
    lines.push("");
    lines.push("None");
  } else {
    lines.push("");
    segments.forEach((segment, index) => {
      lines.push(`${index + 1}. ${reportChangeLine(segment)}`);
    });
    if (truncated) lines.push("");
    if (truncated) lines.push("Additional changes omitted from this summary.");
  }
  lines.push("");
}

function appendChangeSummary(lines, beforeText, afterText, title = "Changes from previous version", headingLevel = 4) {
  const changes = summarizeTextChanges(beforeText, afterText);
  lines.push(`${"#".repeat(headingLevel)} ${markdownHeadingText(title)}`);
  lines.push("");
  appendChangeList(lines, "Added", changes.added, changes.addedTruncated, changes.addedCount);
  appendChangeList(lines, "Removed", changes.removed, changes.removedTruncated, changes.removedCount);
}

function appendFullText(lines, text) {
  lines.push("#### Full text");
  lines.push("");
  lines.push(markdownCodeFence(text));
  lines.push("");
}

function appendPageHistoryReport(lines, sectionTitle, versionBaseLabel, history, options = {}) {
  lines.push(`## ${markdownHeadingText(sectionTitle)}`);
  if (options.actualTitle && options.actualTitle !== versionBaseLabel) {
    lines.push("");
    lines.push(`Title: ${markdownInline(options.actualTitle)}`);
  }
  lines.push("");

  history.forEach((version, index) => {
    const versionLabel = index === 0 ? versionBaseLabel : `${versionBaseLabel}.${index + 1}`;
    const text = textForHistoryVersion(version);
    lines.push(`### ${markdownHeadingText(versionLabel)}`);
    if (version.createdAt) lines.push(`Recorded: ${formatDate(version.createdAt)}`);
    lines.push("");
    if (index > 0 && options.includeChangeSummaries !== false) {
      appendChangeSummary(lines, textForHistoryVersion(history[index - 1]), text);
    }
    appendFullText(lines, text);
  });
}

function historyReportInputCharacters(state) {
  let total = 0;
  const addHistory = history => {
    if (!Array.isArray(history)) return;
    history.forEach(version => {
      total += textForHistoryVersion(version).length;
    });
  };

  total += asText(state?.initialNotes?.content).length;
  addHistory(state?.initialNotes?.versionHistory);
  (state?.drafts || []).forEach(draft => {
    total += asText(draft?.content).length;
    addHistory(draft?.versionHistory);
  });
  return total;
}

function shouldUseFastHistoryReport(state) {
  return historyReportInputCharacters(state) > 750_000;
}

function backupHistoryReport(state, options = {}) {
  const source = historySourceInfo(options);
  const includeChangeSummaries = options.includeChangeSummaries !== false;
  const lines = [
    `# ${markdownHeadingText(source.fileName)} version history`,
    "",
    `Generated: ${formatDate(nowIso())}`,
    ""
  ];
  if (!includeChangeSummaries) {
    lines.push("Change summaries omitted because this history is large. Full version texts are still included.");
    lines.push("");
  }

  const projectNotesHistory = historyWithCurrentVersion(state.initialNotes, PROJECT_NOTES_TITLE);
  appendPageHistoryReport(lines, PROJECT_NOTES_TITLE, PROJECT_NOTES_TITLE, projectNotesHistory, {
    includeChangeSummaries
  });

  let previousDraftFinalText = null;
  (state.drafts || []).forEach((draft, index) => {
    const draftNumber = index + 1;
    const draftLabel = `Draft ${draftNumber}`;
    const draftTitle = asText(draft.title).trim();
    const sectionTitle = draftTitle && draftTitle !== draftLabel
      ? `${draftLabel}: ${draftTitle}`
      : draftLabel;
    const history = historyWithCurrentVersion(draft, draftTitle || draftLabel);
    appendPageHistoryReport(lines, sectionTitle, draftLabel, history, {
      actualTitle: draftTitle,
      includeChangeSummaries
    });

    const finalText = textForHistoryVersion(history[history.length - 1]) || asText(draft.content);
    if (previousDraftFinalText !== null && includeChangeSummaries) {
      lines.push(`## Changes from final Draft ${draftNumber - 1} to final Draft ${draftNumber}`);
      lines.push("");
      appendChangeSummary(lines, previousDraftFinalText, finalText, "Draft-to-draft changes", 3);
    }
    previousDraftFinalText = finalText;
  });

  return `${lines.join("\n").replace(/\n{4,}/g, "\n\n\n")}\n`;
}

function cutReportVersionLabel(index, total) {
  return index === total - 1 ? `Version ${index + 1} / latest` : `Version ${index + 1}`;
}

function cutReportDate(iso) {
  return iso ? formatDate(iso) : "unknown time";
}

function draftAnchorId(title, index) {
  const slug = asText(title)
    .toLowerCase()
    .replace(/[^a-z0-9]+/gu, "-")
    .replace(/^-+|-+$/gu, "");
  return slug || `draft-${index + 1}`;
}

function removedPartRange(parts) {
  const ranges = parts
    .map(part => ({
      start: part.beforeStart ?? part.start,
      end: part.beforeEnd ?? part.end
    }))
    .filter(range => Number.isFinite(range.start) && Number.isFinite(range.end));

  if (!ranges.length) return null;
  return {
    start: Math.min(...ranges.map(range => range.start)),
    end: Math.max(...ranges.map(range => range.end))
  };
}

function moveCutContextToWordBoundary(text, index, direction) {
  let current = Math.max(0, Math.min(text.length, index));
  if (direction < 0) {
    while (current > 0 && !/\s/u.test(text[current - 1])) current -= 1;
    return current;
  }
  while (current < text.length && !/\s/u.test(text[current])) current += 1;
  return current;
}

function cutContextStart(text, cutStart, maxChars = 190) {
  const minStart = Math.max(0, cutStart - maxChars);
  const prefix = text.slice(minStart, cutStart);
  const matches = Array.from(prefix.matchAll(/(?:\n\s*\n|[.!?:;]\s+)/gu));
  const boundaryMatch = matches[matches.length - 1];

  if (boundaryMatch) {
    const candidate = minStart + boundaryMatch.index + boundaryMatch[0].length;
    if (candidate >= minStart && candidate < cutStart) return candidate;
  }

  return moveCutContextToWordBoundary(text, minStart, 1);
}

function cutContextEnd(text, cutEnd, maxChars = 230) {
  const maxEnd = Math.min(text.length, cutEnd + maxChars);
  const suffix = text.slice(cutEnd, maxEnd);
  const boundaryMatch = suffix.match(/(?:\n\s*\n|[.!?:;]\s+)/u);

  if (boundaryMatch) {
    const candidate = cutEnd + boundaryMatch.index + boundaryMatch[0].length;
    if (candidate > cutEnd && candidate <= maxEnd) return candidate;
  }

  return moveCutContextToWordBoundary(text, maxEnd, -1);
}

function cutContextHtml(sourceText, range) {
  if (!range) return "";

  const text = normalizeDiffSource(sourceText);
  const start = Math.max(0, Math.min(text.length, range.start));
  const end = Math.max(start, Math.min(text.length, range.end));
  const contextStart = cutContextStart(text, start);
  const contextEnd = cutContextEnd(text, end);
  const prefix = text.slice(contextStart, start);
  const cut = text.slice(start, end);
  const suffix = text.slice(end, contextEnd);

  return [
    contextStart > 0 ? "..." : "",
    escapeHtml(prefix),
    `<mark>${escapeHtml(cut)}</mark>`,
    escapeHtml(suffix),
    contextEnd < text.length ? "..." : ""
  ].join("");
}

function cutSegmentFromRemovedParts(sourceText, parts) {
  const range = removedPartRange(parts);
  const source = normalizeDiffSource(sourceText);
  const raw = range
    ? source.slice(range.start, range.end)
    : parts.map(part => part.text || "").join("");
  const text = raw.replace(/\s+/gu, " ").trim();
  if (!text) return null;

  const words = wordCountForText(text);
  if (!words) return null;

  const type = raw.includes("\n") || /[.!?:;]/u.test(raw) || words >= 18 ? "line/passage" : "within-line cut";
  return {
    type,
    text,
    words,
    context: cutContextHtml(source, range)
  };
}

function diffSideRangeFromPart(part, side) {
  const start = side === "after"
    ? part.afterStart
    : part.beforeStart;
  const end = side === "after"
    ? part.afterEnd
    : part.beforeEnd;
  return Number.isFinite(start) && Number.isFinite(end) ? { start, end } : null;
}

function diffChangedSideWindow(parts, side) {
  const changedIndexes = [];
  const ranges = [];

  parts.forEach((part, index) => {
    if (!isChangedDiffPart(part)) return;
    changedIndexes.push(index);
    const range = diffSideRangeFromPart(part, side);
    if (range) ranges.push(range);
  });

  if (!changedIndexes.length) return null;
  if (ranges.length) {
    return {
      start: Math.min(...ranges.map(range => range.start)),
      end: Math.max(...ranges.map(range => range.end))
    };
  }

  const firstChangedIndex = changedIndexes[0];
  const lastChangedIndex = changedIndexes[changedIndexes.length - 1];
  let beforeAnchor = null;
  let afterAnchor = null;

  for (let index = firstChangedIndex - 1; index >= 0; index -= 1) {
    const range = diffSideRangeFromPart(parts[index], side);
    if (range) {
      beforeAnchor = range.end;
      break;
    }
  }

  for (let index = lastChangedIndex + 1; index < parts.length; index += 1) {
    const range = diffSideRangeFromPart(parts[index], side);
    if (range) {
      afterAnchor = range.start;
      break;
    }
  }

  const anchor = Number.isFinite(beforeAnchor) ? beforeAnchor : (Number.isFinite(afterAnchor) ? afterAnchor : 0);
  return { start: anchor, end: anchor };
}

function diffTransitionInfo(before, after, beforeIndex) {
  const parts = diffReportTexts(before.content, after.content);
  if (!parts.some(isChangedDiffPart)) return null;

  return {
    before,
    after,
    beforeIndex,
    afterIndex: beforeIndex + 1,
    beforeWindow: diffChangedSideWindow(parts, "before"),
    afterWindow: diffChangedSideWindow(parts, "after")
  };
}

function rangeGap(left, right) {
  if (!left || !right) return Infinity;
  if (left.end < right.start) return right.start - left.end;
  if (right.end < left.start) return left.start - right.end;
  return 0;
}

function rangesTouchSamePhrase(sharedText, left, right) {
  const gap = rangeGap(left, right);
  if (!Number.isFinite(gap)) return false;
  if (gap <= 12) return true;
  if (gap > 120) return false;

  const betweenStart = Math.min(left.end, right.end);
  const betweenEnd = Math.max(left.start, right.start);
  const between = normalizeDiffSource(sharedText).slice(betweenStart, betweenEnd);
  return !/[.!?\n]/u.test(between);
}

function shouldMergeCutHistoryTransitions(previous, next, sharedText) {
  return rangesTouchSamePhrase(sharedText, previous.afterWindow, next.beforeWindow);
}

function cutSegmentsFromVersions(beforeText, afterText) {
  const beforeSource = normalizeDiffSource(beforeText);
  const afterSource = normalizeDiffSource(afterText);
  const parts = diffReportTexts(beforeSource, afterSource);
  const segments = [];
  let current = [];

  const flush = () => {
    const segment = cutSegmentFromRemovedParts(beforeSource, current);
    current = [];
    if (segment) segments.push(segment);
  };

  parts.forEach(part => {
    if (part.type === "removed") {
      current.push(part);
      return;
    }
    if (current.length) flush();
  });

  if (current.length) flush();
  return segments;
}

function coalescedCutHistoryTransitions(versions) {
  const transitions = [];
  let run = null;

  const flushRun = () => {
    if (!run) return;
    const cuts = cutSegmentsFromVersions(run.before.content, run.after.content);
    if (cuts.length) {
      transitions.push({
        before: run.before,
        after: run.after,
        beforeIndex: run.beforeIndex,
        afterIndex: run.afterIndex,
        coalescedVersionCount: run.afterIndex - run.beforeIndex,
        cuts
      });
    }
    run = null;
  };

  for (let versionIndex = 0; versionIndex < versions.length - 1; versionIndex += 1) {
    const info = diffTransitionInfo(versions[versionIndex], versions[versionIndex + 1], versionIndex);
    if (!info) continue;

    if (
      run &&
      run.afterIndex === info.beforeIndex &&
      shouldMergeCutHistoryTransitions(run.lastInfo, info, versions[info.beforeIndex].content)
    ) {
      run.after = info.after;
      run.afterIndex = info.afterIndex;
      run.lastInfo = info;
      continue;
    }

    flushRun();
    run = {
      before: info.before,
      after: info.after,
      beforeIndex: info.beforeIndex,
      afterIndex: info.afterIndex,
      lastInfo: info
    };
  }

  flushRun();
  return transitions;
}

function cutHistoryVersionsForDraft(draft, index) {
  const fallbackTitle = draft?.title || `Draft ${index + 1}`;
  return historyWithCurrentVersion(draft, fallbackTitle).map(version => ({
    createdAt: version.createdAt || draft?.updatedAt || draft?.createdAt || null,
    content: normalizeDiffSource(textForHistoryVersion(version))
  }));
}

function analyseDraftCutHistory(draft, index) {
  const title = draft?.title || `Draft ${index + 1}`;
  const versions = cutHistoryVersionsForDraft(draft, index);
  const currentText = versions.length ? versions[versions.length - 1].content : normalizeDiffSource(draft?.content || "");
  const transitions = coalescedCutHistoryTransitions(versions);

  const cutEntries = transitions.reduce((sum, transition) => sum + transition.cuts.length, 0);
  const cutWords = transitions.reduce(
    (sum, transition) => sum + transition.cuts.reduce((innerSum, cut) => innerSum + cut.words, 0),
    0
  );

  return {
    title,
    anchorId: draftAnchorId(title, index),
    currentText,
    currentWords: wordCountForText(currentText),
    historyCount: normalizePageVersionHistory(draft?.versionHistory, draft, title).length,
    versions,
    transitions,
    cutEntries,
    cutWords
  };
}

function cutTransitionHeading(transition, totalVersions) {
  const beforeText = `${cutReportVersionLabel(transition.beforeIndex, totalVersions)} (${cutReportDate(transition.before.createdAt)})`;
  const afterIndex = Number.isInteger(transition.afterIndex) ? transition.afterIndex : transition.beforeIndex + 1;
  const afterText = `${cutReportVersionLabel(afterIndex, totalVersions)} (${cutReportDate(transition.after.createdAt)})`;
  const autosaves = transition.coalescedVersionCount > 1
    ? `; ${transition.coalescedVersionCount.toLocaleString("en-GB")} autosave snapshots coalesced`
    : "";
  return `${beforeText} -> ${afterText}${autosaves}`;
}

function finalDraftDiffAnchorId(index) {
  return `final-draft-change-${index + 1}-${index + 2}`;
}

function finalDraftDiffWordStats(parts) {
  return parts.reduce((stats, part) => {
    if (part.type === "added" && isDiffSequenceWordText(part.text)) stats.addedWords += 1;
    if (part.type === "removed" && isDiffSequenceWordText(part.text)) stats.removedWords += 1;
    return stats;
  }, { addedWords: 0, removedWords: 0 });
}

function finalDraftDiffsForDrafts(drafts) {
  const comparisons = [];
  for (let index = 0; index < drafts.length - 1; index += 1) {
    const left = drafts[index];
    const right = drafts[index + 1];
    const parts = diffReportTexts(left.currentText, right.currentText);
    const stats = finalDraftDiffWordStats(parts);
    comparisons.push({
      ...stats,
      anchorId: finalDraftDiffAnchorId(index),
      changed: parts.some(part => part.type === "added" || part.type === "removed"),
      left,
      right,
      parts
    });
  }
  return comparisons;
}

function renderFinalDraftDiffPart(part) {
  const text = escapeHtml(part.text || "");
  if (!text) return "";
  if (part.type === "added") return `<span class="compare-token added">${text}</span>`;
  if (part.type === "removed") return `<span class="compare-token removed">${text}</span>`;
  return text;
}

function compactFinalDraftDiffParts(parts) {
  const compacted = [];
  parts.forEach(part => {
    const type = part.type === "added" || part.type === "removed" ? part.type : "same";
    const text = part.text || "";
    if (!text) return;

    const previous = compacted[compacted.length - 1];
    if (previous?.type === type) {
      previous.text += text;
      return;
    }
    compacted.push({ type, text });
  });
  return compacted;
}

function finalDraftDiffMetaText(change) {
  return change.changed
    ? `${change.addedWords.toLocaleString("en-GB")} added ${change.addedWords === 1 ? "word" : "words"}; ${change.removedWords.toLocaleString("en-GB")} removed ${change.removedWords === 1 ? "word" : "words"}.`
    : "No final-draft text changes detected.";
}

function finalDraftDiffBodyHtml(change) {
  return change.changed
    ? `<div class="final-draft-diff-text">${compactFinalDraftDiffParts(change.parts).map(renderFinalDraftDiffPart).join("")}</div>`
    : "<p>No final-draft text changes detected between these drafts.</p>";
}

function draftFinalComparisonHtml(draft, finalDraftDiff) {
  if (!finalDraftDiff) {
    return `<details><summary>Current ${escapeHtml(draft.title)} baseline text</summary><div class="text">${escapeHtml(draft.currentText)}</div></details>`;
  }

  return `<details><summary>Final changes from ${escapeHtml(finalDraftDiff.left.title)} to ${escapeHtml(finalDraftDiff.right.title)}</summary><p class="meta">${escapeHtml(finalDraftDiffMetaText(finalDraftDiff))}</p>${finalDraftDiffBodyHtml(finalDraftDiff)}</details>`;
}

function backupCutHistoryReport(state, options = {}) {
  const source = historySourceInfo(options);
  const sourceName = source.fileName || "draft-history.txt";
  const jsonPath = options.versionHistoryPath || "";
  const liveTextPath = source.filePath || "";
  const drafts = (state.drafts || []).map(analyseDraftCutHistory);
  const finalDraftDiffs = finalDraftDiffsForDrafts(drafts);
  const totalVersions = drafts.reduce((sum, draft) => sum + draft.versions.length, 0);
  const totalCutEntries = drafts.reduce((sum, draft) => sum + draft.cutEntries, 0);
  const totalCutWords = drafts.reduce((sum, draft) => sum + draft.cutWords, 0);
  const rows = drafts.map(draft => {
    const savedHistory = draft.historyCount
      ? `${draft.historyCount.toLocaleString("en-GB")} saved`
      : "current only";
    return `<tr><td><a href="#${escapeHtml(draft.anchorId)}">${escapeHtml(draft.title)}</a></td><td>${draft.versions.length.toLocaleString("en-GB")}</td><td>${draft.currentWords.toLocaleString("en-GB")}</td><td>${draft.cutEntries.toLocaleString("en-GB")}</td><td>${draft.cutWords.toLocaleString("en-GB")}</td><td>${escapeHtml(savedHistory)}</td></tr>`;
  }).join("\n");
  const contents = drafts
    .map(draft => `<a href="#${escapeHtml(draft.anchorId)}">${escapeHtml(draft.title)}</a>`);
  const contentsHtml = contents
    .join("");
  const sections = drafts.map((draft, index) => {
    const transitions = draft.transitions.length
      ? draft.transitions.map(transition => {
        const cuts = transition.cuts.map((cut, index) => {
          const context = cut.context
            ? `<p class="context-label">Context in previous version</p><blockquote class="removed-context">${cut.context}</blockquote>`
            : `<blockquote>${escapeHtml(cut.text)}</blockquote>`;
          return `<div class="cut"><p class="meta">${index + 1}. ${escapeHtml(cut.type)}; ${cut.words.toLocaleString("en-GB")} ${cut.words === 1 ? "word" : "words"}</p>${context}</div>`;
        }).join("\n");
        return `<article class="transition"><h3>${escapeHtml(cutTransitionHeading(transition, draft.versions.length))}</h3>${cuts}</article>`;
      }).join("\n")
      : "<p>No cuts detected for this draft.</p>";

    return `<section id="${escapeHtml(draft.anchorId)}"><h2>${escapeHtml(draft.title)}</h2><p class="meta">${draft.versions.length.toLocaleString("en-GB")} saved/current versions checked. ${draft.cutEntries.toLocaleString("en-GB")} cut entries, ${draft.cutWords.toLocaleString("en-GB")} cut words.</p>${draftFinalComparisonHtml(draft, finalDraftDiffs[index - 1] || null)}${transitions}</section>`;
  }).join("\n");

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>${escapeHtml(sourceName)} per-draft cut history</title>
<style>
body{margin:0;background:#fbfbfa;color:#202020;font:16px/1.55 Georgia,'Times New Roman',serif}
main{max-width:1040px;margin:0 auto;padding:32px 28px 64px}
h1,h2,h3,summary,.meta,table{font-family:system-ui,-apple-system,Segoe UI,sans-serif}
h1{font-size:28px;margin:0 0 8px}
h2{border-top:1px solid #d8d8d8;margin-top:34px;padding-top:22px}
h3{font-size:16px;margin:18px 0 8px}
.meta{color:#666;font-size:13px}
.summary{display:grid;grid-template-columns:repeat(auto-fit,minmax(170px,1fr));gap:12px;margin:22px 0}
.stat{background:#fff;border:1px solid #d8d8d8;padding:12px}
.stat strong{display:block;font:700 20px/1.2 system-ui,-apple-system,Segoe UI,sans-serif}
.contents{display:flex;flex-wrap:wrap;gap:8px;margin:18px 0}
.contents a{border:1px solid #d8d8d8;background:#fff;color:#17456f;font:600 13px/1.2 system-ui,-apple-system,Segoe UI,sans-serif;padding:7px 10px;text-decoration:none}
.contents a:hover,.contents a:focus{background:#eef5fa;text-decoration:underline}
.final-draft-links{display:flex;flex-wrap:wrap;gap:8px;margin:12px 0 18px}
.final-draft-links a{border:1px solid #d8d8d8;background:#fff;color:#17456f;font:600 13px/1.2 system-ui,-apple-system,Segoe UI,sans-serif;padding:7px 10px;text-decoration:none}
.final-draft-links a:hover,.final-draft-links a:focus{background:#eef5fa;text-decoration:underline}
.final-draft-diff{background:#fff;border:1px solid #d8d8d8;margin:14px 0;padding:12px 14px;break-inside:avoid}
.final-draft-diff-text{white-space:pre-wrap;font:15px/1.62 Georgia,'Times New Roman',serif}
.compare-token{border-radius:2px;padding:0 1px}
.compare-token.added{background:#dff5df;color:#17602b;text-decoration:none}
.compare-token.removed{background:#ffe1d6;color:#9b1c1c;text-decoration:line-through}
table{border-collapse:collapse;width:100%;font-size:14px;margin:18px 0}
th,td{border-bottom:1px solid #d8d8d8;padding:8px;text-align:left;vertical-align:top}
td a{color:#17456f;font-weight:600}
section{scroll-margin-top:18px}
details{background:#fff;border:1px solid #d8d8d8;margin:12px 0;padding:10px 14px}
summary{cursor:pointer;font-weight:700}
.text,blockquote{white-space:pre-wrap}
blockquote{background:#fff;border-left:4px solid #777;margin:6px 0 14px;padding:10px 14px}
.context-label{font:600 12px/1.2 system-ui,-apple-system,Segoe UI,sans-serif;color:#666;margin:0 0 4px}
.removed-context mark{background:#ffe1d6;color:#7f220f;padding:0 2px}
.transition{break-inside:avoid}
.cut{margin-left:8px}
@media print{body{background:#fff}details{border:0;padding:0}details:not([open])>:not(summary){display:block}summary{list-style:none}}
</style>
</head>
<body>
<main>
<h1>${escapeHtml(sourceName)}: per-draft cut history</h1>
<p class="meta">Generated ${escapeHtml(formatDate(nowIso()))}. Source JSON: ${escapeHtml(jsonPath)}. Live current text: ${escapeHtml(liveTextPath)}.</p>
<p>This report is grouped by the ${drafts.length.toLocaleString("en-GB")} drafts in the live current text file. Each draft section shows the final changes from the previous draft to that draft, then coalesces adjacent autosave snapshots that touch the same local word or phrase and records passages, plus smaller within-line cuts, that disappear across that change run. It is based on saved version-history snapshots, so unsaved keystrokes between snapshots cannot be recovered.</p>
<div class="summary"><div class="stat"><strong>${drafts.length.toLocaleString("en-GB")}</strong> current drafts</div><div class="stat"><strong>${finalDraftDiffs.length.toLocaleString("en-GB")}</strong> final comparisons</div><div class="stat"><strong>${totalVersions.toLocaleString("en-GB")}</strong> versions checked</div><div class="stat"><strong>${totalCutEntries.toLocaleString("en-GB")}</strong> cut entries</div><div class="stat"><strong>${totalCutWords.toLocaleString("en-GB")}</strong> cut words</div></div>
<nav class="contents" aria-label="Draft contents">${contentsHtml}</nav>
<table><thead><tr><th>Draft</th><th>Versions checked</th><th>Current words</th><th>Cut entries</th><th>Cut words</th><th>Saved history</th></tr></thead><tbody>${rows}</tbody></table>
${sections}
</main>
</body>
</html>
`;
}

function historyArrayFromPayloadEntry(entry) {
  return Array.isArray(entry?.history)
    ? entry.history
    : Array.isArray(entry?.versionHistory)
      ? entry.versionHistory
      : [];
}

function latestHistoryEntry(history) {
  return history.length ? history[history.length - 1] : {};
}

function parseLiveDraftContents(text) {
  const byTitle = new Map();
  const byIndex = [];
  normalizeDiffSource(text).split(/\n---\n/u).forEach(section => {
    const lines = section.replace(/^\n+|\n+$/gu, "").split("\n");
    const title = lines[0] || "";
    if (!lines.some(line => /^Word count:/u.test(line))) return;

    const contentStart = lines.findIndex((line, index) => index > 0 && line === "");
    const content = contentStart >= 0 ? lines.slice(contentStart + 1).join("\n").trimEnd() : "";
    const normalizedContent = content === "[No text yet]" ? "" : content;
    byTitle.set(title, normalizedContent);
    byIndex.push({ title, content: normalizedContent });
  });
  return { byTitle, byIndex };
}

function stateFromVersionHistoryPayload(payload, liveText = "") {
  const liveDrafts = parseLiveDraftContents(liveText);
  const storyHistory = historyArrayFromPayloadEntry(payload.story || payload.initialNotes);
  const latestStory = latestHistoryEntry(storyHistory);
  const createdAt = payload.projectCreatedAt || latestStory.createdAt || payload.updatedAt || nowIso();
  const updatedAt = payload.projectUpdatedAt || payload.updatedAt || latestStory.createdAt || createdAt;

  return {
    version: 1,
    createdAt,
    updatedAt,
    initialNotes: {
      id: payload.story?.id || "initial-notes",
      title: PROJECT_NOTES_TITLE,
      createdAt: latestStory.createdAt || createdAt,
      updatedAt: latestStory.createdAt || updatedAt,
      content: latestStory.content || "",
      contentHtml: latestStory.contentHtml || textToHtml(latestStory.content || ""),
      format: normalizeFormat(latestStory.format || {}),
      versionHistory: storyHistory
    },
    drafts: (payload.drafts || [])
      .slice()
      .sort((left, right) => {
        const leftIndex = Number.isInteger(left?.index) ? left.index : 0;
        const rightIndex = Number.isInteger(right?.index) ? right.index : 0;
        return leftIndex - rightIndex;
      })
      .map((draft, index) => {
        const history = historyArrayFromPayloadEntry(draft);
        const latest = latestHistoryEntry(history);
        const title = latest.title || draft?.title || `Draft ${index + 1}`;
        const content = liveDrafts.byTitle.get(title) ?? liveDrafts.byIndex[index]?.content ?? latest.content ?? "";
        return {
          id: draft?.id || `draft-${index + 1}`,
          title,
          createdAt: draft?.createdAt || latest.createdAt || createdAt,
          updatedAt: latest.createdAt || draft?.createdAt || updatedAt,
          content,
          contentHtml: latest.content === content ? latest.contentHtml || textToHtml(content) : textToHtml(content),
          format: normalizeFormat(latest.format || {}),
          versionHistory: history,
          notes: {
            id: `notes-${draft?.id || index + 1}`,
            title: `${title} Notes`,
            createdAt: draft?.createdAt || createdAt,
            updatedAt: draft?.createdAt || updatedAt,
            content: "",
            contentHtml: "",
            format: { ...DEFAULT_FORMAT }
          }
        };
      })
  };
}

function readFileHashInput(filePath) {
  return fs.existsSync(filePath) ? fs.readFileSync(filePath) : Buffer.alloc(0);
}

function stableHistoryForHash(history) {
  return (Array.isArray(history) ? history : []).map(entry => ({
    createdAt: asText(entry?.createdAt),
    title: asText(entry?.title),
    content: asText(entry?.content),
    contentHtml: asText(entry?.contentHtml),
    format: normalizeFormat(entry?.format || {})
  }));
}

function stableVersionHistoryPayloadForHash(payload) {
  if (!payload || typeof payload !== "object") return null;
  return {
    sourceFileName: asText(payload.sourceFileName),
    sourceFilePath: asText(payload.sourceFilePath),
    story: stableHistoryForHash(historyArrayFromPayloadEntry(payload.story || payload.initialNotes)),
    drafts: (payload.drafts || [])
      .slice()
      .sort((left, right) => {
        const leftIndex = Number.isInteger(left?.index) ? left.index : 0;
        const rightIndex = Number.isInteger(right?.index) ? right.index : 0;
        return leftIndex - rightIndex;
      })
      .map((draft, index) => ({
        index: Number.isInteger(draft?.index) ? draft.index : index,
        title: asText(draft?.title),
        createdAt: asText(draft?.createdAt),
        history: stableHistoryForHash(historyArrayFromPayloadEntry(draft))
      }))
  };
}

function cutHistoryInputHash({ versionHistoryPath, textFilePath, build = SERVER_BUILD }) {
  const hash = crypto.createHash("sha256");
  const payload = parseVersionHistoryFile(versionHistoryPath);
  const stablePayload = stableVersionHistoryPayloadForHash(payload);
  hash.update(String(build || ""));
  hash.update("\0");
  hash.update(stablePayload ? JSON.stringify(stablePayload) : readFileHashInput(versionHistoryPath));
  hash.update("\0");
  hash.update(readFileHashInput(textFilePath));
  return hash.digest("hex");
}

function cutHistoryCacheFolderPath(historyReportPath) {
  const resolvedReportPath = path.resolve(historyReportPath);
  const summariesFolder = path.dirname(resolvedReportPath);
  const backupRootFolder = path.dirname(summariesFolder);
  return path.join(backupRootFolder, "version history summary cache");
}

function cutHistoryMetadataPath(historyReportPath) {
  const resolvedReportPath = path.resolve(historyReportPath);
  return path.join(cutHistoryCacheFolderPath(resolvedReportPath), `${path.basename(resolvedReportPath)}.meta.json`);
}

function legacyCutHistoryMetadataPath(historyReportPath) {
  return `${historyReportPath}.meta.json`;
}

function removeLegacyCutHistoryMetadata(historyReportPath) {
  try {
    const legacyPath = path.resolve(legacyCutHistoryMetadataPath(historyReportPath));
    const currentPath = path.resolve(cutHistoryMetadataPath(historyReportPath));
    if (legacyPath !== currentPath) fs.rmSync(legacyPath, { force: true });
  } catch {}
}

function readCutHistoryMetadata(historyReportPath) {
  try {
    const parsed = JSON.parse(fs.readFileSync(cutHistoryMetadataPath(historyReportPath), "utf8").replace(/^\uFEFF/u, ""));
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function writeAtomicText(filePath, content, options = {}) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  const temporaryFolderPath = options.temporaryFolderPath
    ? path.resolve(options.temporaryFolderPath)
    : path.dirname(filePath);
  fs.mkdirSync(temporaryFolderPath, { recursive: true });
  const tmpPath = path.join(temporaryFolderPath, `${path.basename(filePath)}.${process.pid}.${Date.now()}.tmp`);
  fs.writeFileSync(tmpPath, content, "utf8");
  try {
    fs.renameSync(tmpPath, filePath);
  } catch (error) {
    if (error.code === "EPERM") {
      fs.writeFileSync(filePath, content, "utf8");
      try {
        fs.rmSync(tmpPath, { force: true });
      } catch {}
      return;
    }
    if (error.code !== "EEXIST") throw error;
    fs.rmSync(filePath, { force: true });
    fs.renameSync(tmpPath, filePath);
  }
}

function removeLegacyMarkdownHistoryReport(sourceFileName) {
  try {
    const legacyMarkdownPath = path.join(
      markdownHistoryBackupFolderPath(),
      `${safeHistoryBaseName(sourceFileName)}${BACKUP_HISTORY_REPORT_SUFFIX}`
    );
    fs.rmSync(legacyMarkdownPath, { force: true });
  } catch {}
}

function writeCutHistoryReportFromFiles(options = {}) {
  const versionHistoryPathValue = asText(options.versionHistoryPath);
  const textFilePathValue = asText(options.textFilePath);
  const historyReportPathValue = asText(options.historyReportPath);
  const build = asText(options.build) || SERVER_BUILD;
  if (!versionHistoryPathValue || !textFilePathValue || !historyReportPathValue) {
    throw new Error("Cut-history report paths are incomplete.");
  }
  const versionHistoryPath = path.resolve(versionHistoryPathValue);
  const textFilePath = path.resolve(textFilePathValue);
  const historyReportPath = path.resolve(historyReportPathValue);

  const inputHash = cutHistoryInputHash({ versionHistoryPath, textFilePath, build });
  removeLegacyCutHistoryMetadata(historyReportPath);
  const metadata = readCutHistoryMetadata(historyReportPath);
  if (
    metadata?.inputHash === inputHash &&
    metadata?.build === build &&
    fs.existsSync(historyReportPath)
  ) {
    return { skipped: true, historyReportPath };
  }

  const payload = parseVersionHistoryFile(versionHistoryPath);
  if (!payload) throw new Error(`Version history JSON could not be read: ${versionHistoryPath}`);
  const liveText = fs.readFileSync(textFilePath, "utf8").replace(/^\uFEFF/u, "");
  const state = stateFromVersionHistoryPayload(payload, liveText);
  const sourceFileName = payload.sourceFileName || options.sourceFileName || path.basename(textFilePath);
  const sourceFilePath = payload.sourceFilePath || options.sourceFilePath || textFilePath;
  const html = backupCutHistoryReport(state, {
    fileName: sourceFileName,
    filePath: sourceFilePath,
    versionHistoryPath
  });

  writeAtomicText(historyReportPath, html, {
    temporaryFolderPath: cutHistoryCacheFolderPath(historyReportPath)
  });
  writeAtomicText(cutHistoryMetadataPath(historyReportPath), `${JSON.stringify({
    inputHash,
    build,
    versionHistoryPath,
    textFilePath,
    historyReportPath,
    generatedAt: nowIso()
  }, null, 2)}\n`);
  removeLegacyMarkdownHistoryReport(sourceFileName);

  return { skipped: false, historyReportPath };
}

function cutHistoryWorkerSource() {
  return `
    const { parentPort, workerData } = require("node:worker_threads");
    Promise.resolve()
      .then(() => {
        const server = require(workerData.serverPath);
        return server.writeCutHistoryReportFromFiles(workerData);
      })
      .then(result => parentPort.postMessage({ ok: true, result }))
      .catch(error => {
        parentPort.postMessage({
          ok: false,
          error: error && error.stack ? error.stack : String(error)
        });
      });
  `;
}

function startCutHistoryWorker(jobKey, job) {
  const worker = new Worker(cutHistoryWorkerSource(), {
    eval: true,
    workerData: {
      ...job,
      build: SERVER_BUILD,
      serverPath: __filename
    }
  });
  const record = { worker, pending: null };
  cutHistoryJobs.set(jobKey, record);

  worker.on("message", message => {
    if (message?.ok === false) console.error(message.error);
  });
  worker.on("error", error => {
    console.error(error);
  });
  worker.on("exit", code => {
    if (code) console.error(`Cut-history summary worker exited with code ${code}.`);
    const current = cutHistoryJobs.get(jobKey);
    const pending = current?.pending || null;
    cutHistoryJobs.delete(jobKey);
    if (pending) {
      startCutHistoryWorker(jobKey, pending);
      return;
    }
    maybeExitAfterCutHistoryJobs();
  });
}

function resolveCutHistoryIdleWaiters() {
  if (cutHistoryJobs.size) return;
  cutHistoryIdleWaiters.forEach(resolve => resolve());
  cutHistoryIdleWaiters.clear();
}

function waitForCutHistoryJobs(timeoutMs = 0) {
  if (!cutHistoryJobs.size) return Promise.resolve();

  return new Promise(resolve => {
    let timer = null;
    const finish = () => {
      if (timer) clearTimeout(timer);
      cutHistoryIdleWaiters.delete(finish);
      resolve();
    };
    cutHistoryIdleWaiters.add(finish);
    if (timeoutMs > 0) {
      timer = setTimeout(finish, timeoutMs);
      timer.unref?.();
    }
  });
}

function queueCutHistoryReport(job) {
  const jobKey = path.resolve(job.historyReportPath);
  const existing = cutHistoryJobs.get(jobKey);
  if (existing) {
    existing.pending = job;
    return { queued: true, pending: true, historyReportPath: job.historyReportPath };
  }

  startCutHistoryWorker(jobKey, job);
  return { queued: true, pending: false, historyReportPath: job.historyReportPath };
}

function maybeExitAfterCutHistoryJobs() {
  if (cutHistoryJobs.size) return false;
  resolveCutHistoryIdleWaiters();
  if (!processExitRequested) return false;
  process.exit(0);
  return true;
}

function backupProjectFiles(state, options = {}) {
  const textFolderPath = originalTextBackupFolderPath();
  const summaryFolderPath = historySummaryBackupFolderPath();
  if (!textFolderPath || !summaryFolderPath) return null;

  fs.mkdirSync(textFolderPath, { recursive: true });
  fs.mkdirSync(summaryFolderPath, { recursive: true });
  const normalized = normalizeState(state);
  const source = historySourceInfo(options);
  const textFileName = safeBackupFileName(source.fileName, "draft-history.txt");
  const textFilePath = path.join(textFolderPath, textFileName);
  const historyReportPath = path.join(
    summaryFolderPath,
    `${safeHistoryBaseName(source.fileName)}${CUT_HISTORY_REPORT_SUFFIX}`
  );
  const versionHistoryPath = findVersionHistoryFilePath(options) || "";

  fs.writeFileSync(textFilePath, formatExport(normalized), "utf8");
  const historyReport = versionHistoryPath
    ? queueCutHistoryReport({
      versionHistoryPath,
      textFilePath,
      historyReportPath,
      sourceFileName: source.fileName,
      sourceFilePath: source.filePath
    })
    : null;

  return {
    textFolderPath,
    summaryFolderPath,
    textFilePath,
    historyReportPath,
    historyReport
  };
}

function writeAllWithBackup(state, options = {}) {
  const savedState = writeAll(state, options);
  return {
    state: savedState,
    backup: backupProjectFiles(savedState, options)
  };
}

function stateForStorage(state) {
  return existingVersionHistoryFolderPath() ? stateWithoutVersionHistory(state) : state;
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
  setTimeout(() => {
    if (!cutHistoryJobs.size) process.exit(0);
  }, 30 * 60_000).unref();
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
    activeServer.close(() => {
      if (!maybeExitAfterCutHistoryJobs()) windowlessExitFallback();
    });
    windowlessExitFallback();
    return;
  }

  if (!maybeExitAfterCutHistoryJobs()) windowlessExitFallback();
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
  const versionHistoryFolderPath = readVersionHistoryFolderPath();
  const missingBackupFolder = versionHistoryFolderMissing();
  return {
    exportPath: EXPORT_FILE,
    statePath: STATE_FILE,
    linkedTextPath,
    linkedTextFileName: linkedTextPath ? path.basename(linkedTextPath) : null,
    versionHistoryFolderPath,
    versionHistoryFolderMissing: missingBackupFolder,
    versionHistoryPath: findVersionHistoryFilePath({
      filePath: historySourcePath,
      fileName: options.fileName || (historySourcePath ? path.basename(historySourcePath) : "draft-history.txt")
    }),
    backupFolderPath: versionHistoryFolderPath,
    backupFolderMissing: missingBackupFolder
  };
}

function writeBackupFromRequestBody(body) {
  if (body) {
    const payload = parseStatePayload(body);
    return writeAllWithBackup(payload.state, {
      filePath: payload.filePath,
      fileName: payload.fileName
    });
  }

  return writeAllWithBackup(readState());
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

function windowsFolderDialogCommand(initialDirectory, description) {
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
    `$dialog.Description = ${powershellString(description)}`,
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
    return runPowerShell(windowsFolderDialogCommand(initialDirectory, "Select the backup and version history folder"));
  }

  throw new Error("Version history folder selection is only available in the desktop Windows dialog right now.");
}

async function chooseBackupFolder() {
  const initialDirectory = readVersionHistoryFolderPath() || existingDirectory(readTextFileLink() || EXPORT_FILE);

  if (process.platform === "win32") {
    return runPowerShell(windowsFolderDialogCommand(initialDirectory, "Select the backup and version history folder"));
  }

  throw new Error("Backup folder selection is only available in the desktop Windows dialog right now.");
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
    const result = writeBackupFromRequestBody(body);
    sendJson(res, 200, { ok: true, backup: result?.backup || null });
    return;
  }

  if (req.method === "POST" && pathname === "/api/backup/project") {
    markClientActive();
    const body = await readBody(req);
    const result = writeBackupFromRequestBody(body);
    sendJson(res, 200, { ok: true, backup: result?.backup || null });
    return;
  }

  if (req.method === "POST" && pathname === "/api/shutdown") {
    const body = await readBody(req);
    const result = writeBackupFromRequestBody(body);

    sendJson(res, 200, { ok: true, backup: result?.backup || null });
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

  if (req.method === "POST" && pathname === "/api/backup/activate") {
    markClientActive();
    const folderPath = await chooseBackupFolder();
    if (!folderPath) {
      sendJson(res, 200, { ok: false, cancelled: true });
      return;
    }

    const backupFolderPath = writeVersionHistoryFolderPath(folderPath);
    sendJson(res, 200, {
      ok: true,
      backupFolderPath,
      ...statePathPayload()
    });
    return;
  }

  if (req.method === "POST" && pathname === "/api/backup/deactivate") {
    markClientActive();
    writeVersionHistoryFolderPath(null);
    sendJson(res, 200, {
      ok: true,
      backupFolderPath: null,
      ...statePathPayload()
    });
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
      sendJson(res, error.statusCode || 500, {
        error: error.message,
        code: error.code || null,
        folderPath: error.folderPath || null
      });
    }
  });
}

function flushOnExit() {
  try {
    writeAllWithBackup(readState());
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

function stopServer(serverToStop = activeServer, options = {}) {
  if (idleTimer) {
    clearInterval(idleTimer);
    idleTimer = null;
  }

  if (options.flush !== false) flushOnExit();

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
  stopServer,
  waitForCutHistoryJobs,
  writeCutHistoryReportFromFiles
};
