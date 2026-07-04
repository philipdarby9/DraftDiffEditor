const fs = require("node:fs");
const http = require("node:http");
const os = require("node:os");
const path = require("node:path");
const crypto = require("node:crypto");
const { spawn } = require("node:child_process");
const { URL } = require("node:url");
const { Worker } = require("node:worker_threads");
const DiffCore = require("./public/diff-core");
const StateCore = require("./public/state-core");

const ROOT = __dirname;
const PUBLIC_DIR = path.join(ROOT, "public");
const DATA_DIR = path.resolve(process.env.DRAFT_DIFF_DATA_DIR || path.join(ROOT, "data"));
const STATE_FILE = path.join(DATA_DIR, "project.json");
const EXPORT_FILE = path.join(DATA_DIR, "draft-history.txt");
const TEXT_FILE_LINK_FILE = path.join(DATA_DIR, "text-file-link.json");
const TEXT_FILE_STATES_FILE = path.join(DATA_DIR, "text-file-states.json");
const PROJECT_RECOVERY_FILE = path.join(DATA_DIR, "project-recovery.json");
const PERSISTENCE_TRANSACTION_DIR = path.join(DATA_DIR, ".save-transaction");
const PERSISTENCE_TRANSACTION_MANIFEST = path.join(PERSISTENCE_TRANSACTION_DIR, "manifest.json");
const VERSION_HISTORY_FOLDER_FILE = path.join(DATA_DIR, "version-history-folder.json");
const BACKUP_FOLDER_FILE = path.join(DATA_DIR, "backup-folder.json");
const VERSION_HISTORY_FILE_SUFFIX = ".version-history.json";
const BACKUP_HISTORY_REPORT_SUFFIX = ".version-history.md";
const CUT_HISTORY_REPORT_SUFFIX = ".per-draft-cut-history.html";
const FULL_VERSION_HISTORY_REPORT_SUFFIX = ".version-history-summary.html";
const USB_TRANSFER_MANIFEST_FILE = "draftdiff-transfer-manifest.json";
const USB_TRANSFER_FILES_DIR = "draftdiff-transfer-files";
const PORT = Number(process.env.PORT || 4173);
const HOST = process.env.DRAFT_DIFF_HOST || process.env.HOST || "127.0.0.1";
const ALLOW_REMOTE_API = process.env.DRAFT_DIFF_ALLOW_REMOTE === "1";
const STORY_KEY = "story";
const PROJECT_NOTES_TITLE = StateCore.PROJECT_NOTES_TITLE;
const FORMAT_DEFAULT_VERSION = StateCore.FORMAT_DEFAULT_VERSION;
const VIEW_STATE_VERSION = StateCore.VIEW_STATE_VERSION;
const LEGACY_DEFAULT_FONT_FAMILY = StateCore.LEGACY_DEFAULT_FONT_FAMILY;
const MIN_PAGE_PANE_PERCENT = StateCore.MIN_PAGE_PANE_PERCENT;
const SERVER_BUILD = "server-promote-newer-history-2026-06-07";
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

function isBackupFolderMissingError(error) {
  return error?.code === "BACKUP_FOLDER_MISSING" || error instanceof BackupFolderMissingError;
}

let lastClientSeenAt = 0;
let activeServer = null;
let idleTimer = null;
let processExitRequested = false;
const cutHistoryJobs = new Map();
const cutHistoryIdleWaiters = new Set();
const versionSummaryJobs = new Map();
const versionHistoryPathCache = new Map();

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

function yieldToEventLoop() {
  return new Promise(resolve => setImmediate(resolve));
}

function id(prefix) {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function asText(value) {
  return typeof value === "string" ? value : "";
}

const DEFAULT_FORMAT = StateCore.DEFAULT_FORMAT;

function escapeHtml(value) {
  return asText(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function textToHtml(value) {
  return StateCore.textToHtml(value);
}

function hasParagraphHtml(value) {
  return StateCore.hasParagraphHtml(value);
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
  return StateCore.htmlToText(value);
}

function lineBreakCount(value) {
  return StateCore.lineBreakCount(value);
}

function normalizeFormat(format) {
  return StateCore.normalizeFormat(format);
}

function upgradeLegacyDefaultFormat(format, shouldUpgrade) {
  return StateCore.upgradeLegacyDefaultFormat(format, shouldUpgrade);
}

function currentDefaultFormat(state) {
  return StateCore.currentDefaultFormat(state);
}

function normalizePage(page, fallback, options = {}) {
  return StateCore.normalizePage(page, fallback, options);
}

function pageVersionSnapshot(page, fallbackTitle, timestamp = nowIso()) {
  return StateCore.pageVersionSnapshot(page, fallbackTitle, timestamp);
}

function versionHasMeaningfulContent(version) {
  return StateCore.versionHasMeaningfulContent(version);
}

function normalizePageVersionHistory(history, page, fallbackTitle) {
  return StateCore.normalizePageVersionHistory(history, page, fallbackTitle);
}

function normalizeDraftVersionHistory(history, draft) {
  return normalizePageVersionHistory(history, draft, draft?.title || "Untitled draft");
}

function defaultState() {
  return StateCore.defaultState();
}

function normalizeState(input, options = {}) {
  return StateCore.normalizeState(input, options);
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
  return StateCore.wordCountForText(text);
}

function formatExport(state) {
  return StateCore.formatExport(state);
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
  writeAtomicText(
    VERSION_HISTORY_FOLDER_FILE,
    `${JSON.stringify({ folderPath: resolvedPath, updatedAt: nowIso() }, null, 2)}\n`
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

function pathIsInsideFolder(filePath, folderPath) {
  if (!filePath || !folderPath) return false;
  const relative = path.relative(path.resolve(folderPath), path.resolve(filePath));
  return relative === "" || (Boolean(relative) && !relative.startsWith("..") && !path.isAbsolute(relative));
}

function versionHistoryCacheKey(rootFolderPath, source) {
  const sourcePath = source.filePath ? path.resolve(source.filePath) : "";
  const normalizedSourcePath = process.platform === "win32" ? sourcePath.toLowerCase() : sourcePath;
  return JSON.stringify([
    path.resolve(rootFolderPath),
    normalizedSourcePath,
    normalizedHistoryName(source.fileName)
  ]);
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

function safeFolderName(sourceName, fallbackName = "draft-history") {
  const rawName = asText(sourceName) || fallbackName;
  const cleaned = rawName
    .replace(/[<>:"/\\|?*\x00-\x1f]/g, "_")
    .replace(/^[.\s]+|[.\s]+$/g, "")
    .slice(0, 120);
  return cleaned || fallbackName;
}

function portablePath(...parts) {
  return parts
    .flatMap(part => asText(part).split(/[\\/]+/u))
    .filter(Boolean)
    .join("/");
}

function pathFromPortable(rootFolderPath, portableRelativePath) {
  const parts = asText(portableRelativePath).split(/[\\/]+/u).filter(Boolean);
  return path.join(rootFolderPath, ...parts);
}

function sha256File(filePath) {
  return crypto.createHash("sha256").update(fs.readFileSync(filePath)).digest("hex");
}

function fileSnapshot(filePath) {
  const resolvedPath = filePath ? path.resolve(filePath) : "";
  if (!resolvedPath) return { exists: false };

  try {
    const stats = fs.statSync(resolvedPath);
    if (!stats.isFile()) {
      return {
        exists: false,
        path: resolvedPath,
        type: stats.isDirectory() ? "directory" : "other"
      };
    }

    return {
      exists: true,
      path: resolvedPath,
      size: stats.size,
      mtimeMs: Math.round(stats.mtimeMs),
      sha256: sha256File(resolvedPath)
    };
  } catch {
    return {
      exists: false,
      path: resolvedPath
    };
  }
}

function walkDirectoryFiles(folderPath, rootFolderPath = folderPath, files = []) {
  const entries = fs.readdirSync(folderPath, { withFileTypes: true })
    .sort((left, right) => left.name.localeCompare(right.name));

  entries.forEach(entry => {
    const filePath = path.join(folderPath, entry.name);
    if (entry.isDirectory()) {
      walkDirectoryFiles(filePath, rootFolderPath, files);
      return;
    }
    if (!entry.isFile()) return;

    files.push({
      relativePath: portablePath(path.relative(rootFolderPath, filePath)),
      snapshot: fileSnapshot(filePath)
    });
  });

  return files;
}

function directorySnapshot(folderPath) {
  const resolvedPath = folderPath ? path.resolve(folderPath) : "";
  if (!resolvedPath || !directoryExists(resolvedPath)) {
    return {
      exists: false,
      path: resolvedPath,
      files: []
    };
  }

  return {
    exists: true,
    path: resolvedPath,
    files: walkDirectoryFiles(resolvedPath).map(file => ({
      relativePath: file.relativePath,
      size: file.snapshot.size,
      mtimeMs: file.snapshot.mtimeMs,
      sha256: file.snapshot.sha256
    }))
  };
}

function snapshotByRelativePath(directory) {
  const map = new Map();
  (directory?.files || []).forEach(file => {
    map.set(portablePath(file.relativePath), file);
  });
  return map;
}

function fileSnapshotChanged(baseline, current) {
  const baseExists = Boolean(baseline?.exists);
  const currentExists = Boolean(current?.exists);
  if (baseExists !== currentExists) return true;
  if (!baseExists && !currentExists) return false;
  return asText(baseline?.sha256) !== asText(current?.sha256);
}

function sameSnapshotContent(left, right) {
  return Boolean(left?.exists && right?.exists && asText(left.sha256) && left.sha256 === right.sha256);
}

function transferChangeStatus(baseline, usb, local, options = {}) {
  const baselineExists = Boolean(baseline?.exists);
  const usbExists = Boolean(usb?.exists);
  const localExists = Boolean(local?.exists);
  const localRootExists = options.localRootExists !== false;

  if (!baselineExists) {
    if (usbExists && !localExists) return "usb-added";
    if (!usbExists && localExists) return "local-added";
    if (!usbExists && !localExists) return "unchanged";
    return sameSnapshotContent(usb, local) ? "already-matching" : "conflict";
  }

  const usbChanged = fileSnapshotChanged(baseline, usb);
  const localChanged = fileSnapshotChanged(baseline, local);

  if (!usbChanged && !localChanged) return "unchanged";
  if (usbChanged && !localChanged) return usb?.exists ? "safe-update" : "usb-deleted";
  if (!usbChanged && localChanged) return local?.exists ? "local-only-change" : localRootExists ? "local-deleted" : "local-missing";
  if (!localExists && !localRootExists && usbExists) return "local-missing";
  if (sameSnapshotContent(usb, local)) return "already-matching";
  return "conflict";
}

function transferStatusLabel(status) {
  return {
    "usb-added": "Added on USB",
    "local-added": "Added on this computer",
    "safe-update": "Safe update",
    "usb-deleted": "Deleted on USB",
    "local-only-change": "Changed on this computer",
    "local-deleted": "Deleted on this computer",
    "local-missing": "Not yet on this computer",
    "already-matching": "Already matching",
    conflict: "Conflict",
    unchanged: "Unchanged"
  }[status] || status;
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

function resolveGeneratedReportPath(value) {
  const requestedPath = asText(value).trim();
  if (!requestedPath) throw new Error("Missing report path");

  const reportPath = path.resolve(requestedPath);
  const summaryFolderPath = historySummaryBackupFolderPath();
  if (!summaryFolderPath) {
    throw new BackupFolderMissingError(readVersionHistoryFolderPath() || "No backup folder selected");
  }
  if (!pathIsInsideFolder(reportPath, summaryFolderPath)) {
    throw new Error("Report path is outside the version history summaries folder.");
  }

  const reportName = path.basename(reportPath);
  if (
    !reportName.endsWith(CUT_HISTORY_REPORT_SUFFIX) &&
    !reportName.endsWith(FULL_VERSION_HISTORY_REPORT_SUFFIX)
  ) {
    throw new Error("Report path is not an allowed generated report.");
  }

  let stats;
  try {
    stats = fs.statSync(reportPath);
  } catch (error) {
    if (error?.code === "ENOENT") throw new Error("Report file does not exist.");
    throw error;
  }
  if (!stats.isFile()) throw new Error("Report path is not a file.");

  return reportPath;
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

function rememberVersionHistoryFilePath(rootFolderPath, source, filePath) {
  if (!rootFolderPath || !source || !filePath) return;
  versionHistoryPathCache.set(versionHistoryCacheKey(rootFolderPath, source), path.resolve(filePath));
}

function cachedVersionHistoryFilePath(rootFolderPath, source) {
  if (!rootFolderPath || !source) return null;
  const cacheKey = versionHistoryCacheKey(rootFolderPath, source);
  const cachedPath = versionHistoryPathCache.get(cacheKey);
  if (!cachedPath) return null;

  if (fs.existsSync(cachedPath) && versionHistoryPayloadMatchesSource(parseVersionHistoryFile(cachedPath), source)) {
    return cachedPath;
  }

  versionHistoryPathCache.delete(cacheKey);
  return null;
}

function findVersionHistoryFilePath(options = {}) {
  const rootFolderPath = existingVersionHistoryFolderPath();
  const jsonFolderPath = versionHistoryJsonFolderPath();
  if (!rootFolderPath || !jsonFolderPath) return null;

  const source = historySourceInfo(options);
  const expectedPath = expectedVersionHistoryFilePath(source);
  if (expectedPath && fs.existsSync(expectedPath)) {
    rememberVersionHistoryFilePath(rootFolderPath, source, expectedPath);
    return expectedPath;
  }

  const cachedPath = cachedVersionHistoryFilePath(rootFolderPath, source);
  if (cachedPath) return cachedPath;

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
        if (versionHistoryPayloadMatchesSource(payload, source)) {
          rememberVersionHistoryFilePath(rootFolderPath, source, filePath);
          return filePath;
        }
      }
    } catch {
      // Missing folders are expected until the first save after folder selection.
    }
  }

  return expectedPath;
}

function versionHistorySignature(version) {
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

function applyVersionHistoryEntryToPage(page, version, fallbackTitle) {
  return StateCore.applyVersionHistoryEntryToPage(page, version, fallbackTitle);
}

function currentPageHistorySnapshot(page, fallbackTitle) {
  return StateCore.currentPageHistorySnapshot(page, fallbackTitle);
}

function addCurrentPageToHistoryIfMissing(history, page, fallbackTitle) {
  return StateCore.addCurrentPageToHistoryIfMissing(history, page, fallbackTitle);
}

function promotePageToNewestHistoryVersion(page, fallbackTitle) {
  return StateCore.promotePageToNewestHistoryVersion(page, fallbackTitle);
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

  return sortVersionHistoryByCreatedAt(merged);
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
    promotePageToNewestHistoryVersion(state.initialNotes, PROJECT_NOTES_TITLE);
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
    promotePageToNewestHistoryVersion(draft, draft.title || "Untitled draft");
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

function textHash(value) {
  return crypto.createHash("sha256").update(asText(value), "utf8").digest("hex");
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

function parseExportDate(value, fallback = nowIso()) {
  const raw = asText(value).trim();
  if (!raw) return fallback;

  const direct = new Date(raw);
  if (!Number.isNaN(direct.valueOf())) return direct.toISOString();

  const englishDate = raw.match(/^(?:[A-Za-z]+,\s*)?(\d{1,2})\s+([A-Za-z]+)\s+(\d{4})(?:\s+at|,)?\s+(\d{1,2}):(\d{2})/u);
  if (englishDate) {
    const [, day, monthName, year, hour, minute] = englishDate;
    const month = monthIndexes.get(monthName.toLowerCase());
    if (month !== undefined) {
      const parsed = new Date(Number(year), month, Number(day), Number(hour), Number(minute));
      if (!Number.isNaN(parsed.valueOf())) return parsed.toISOString();
    }
  }

  return fallback;
}

function parseExportTextBlock(block) {
  const lines = asText(block).replace(/\r\n/g, "\n").replace(/\r/g, "\n").split("\n");
  const firstLineCreatedMatch = /^Created:\s*(.*)$/i.exec(lines[0] || "");
  const title = (firstLineCreatedMatch ? lines[1] : lines[0] || "").trim();
  const createdLineIndex = firstLineCreatedMatch ? 0 : 1;
  const createdMatch = firstLineCreatedMatch || /^Created:\s*(.*)$/i.exec(lines[createdLineIndex] || "");
  if (!title || !createdMatch) return null;

  let bodyStart = createdLineIndex + 1;
  let updatedAt = "";
  for (; bodyStart < lines.length; bodyStart += 1) {
    const line = lines[bodyStart] || "";
    if (line === "") {
      bodyStart += 1;
      break;
    }
    const lastEditedMatch = /^Last edited:\s*(.*)$/i.exec(line);
    if (lastEditedMatch) {
      updatedAt = parseExportDate(lastEditedMatch[1], "");
      continue;
    }
    if (/^Word count:\s*/i.test(line)) continue;
    break;
  }

  const content = lines.slice(bodyStart).join("\n").replace(/\n+$/gu, "");
  return {
    title,
    createdAt: parseExportDate(createdMatch[1]),
    updatedAt,
    content: content === "[No text yet]" ? "" : content
  };
}

function parseExportTextPages(text) {
  return asText(text)
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .split(/\n{2}[ \t]*---[ \t]*\n{2}/gu)
    .map(block => parseExportTextBlock(block.replace(/^\n+|\n+$/gu, "")))
    .filter(Boolean);
}

function draftPagesFromExportText(text) {
  const pages = parseExportTextPages(text);
  const storyIndex = pages.findIndex(page => {
    const title = page.title.toLowerCase();
    return title === "project notes" || title === "story notes";
  });
  const projectNotes = pages[storyIndex >= 0 ? storyIndex : 0] || {
    title: PROJECT_NOTES_TITLE,
    content: ""
  };
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

    drafts.push({
      title: draftBlock.title || `Draft ${drafts.length + 1}`,
      content: draftBlock.content || "",
      notesTitle: notesBlock?.title || `${draftBlock.title || `Draft ${drafts.length + 1}`} Notes`,
      notesContent: notesBlock?.content || ""
    });
  }

  return {
    projectNotes,
    drafts
  };
}

function fileMtimeIso(filePath) {
  try {
    return fs.statSync(filePath).mtime.toISOString();
  } catch {
    return nowIso();
  }
}

function pagePlainText(page) {
  return asText(page?.content) || htmlToText(page?.contentHtml || "");
}

function pageFromTransferBlock(block, fallbackTitle, previousPage = null, options = {}) {
  const title = block?.title || fallbackTitle;
  const content = asText(block?.content);
  const importedCreatedAt = block?.createdAt || nowIso();
  const previousContent = previousPage ? pagePlainText(previousPage) : null;
  const contentChanged = Boolean(previousPage) && previousContent !== content;
  const importedUpdatedAt = block?.updatedAt || "";
  const changedAt = options.changedAt || importedUpdatedAt || nowIso();
  const createdAt = previousPage?.createdAt || importedCreatedAt;
  const updatedAt = contentChanged
    ? importedUpdatedAt || changedAt
    : previousPage?.updatedAt || importedUpdatedAt || importedCreatedAt || createdAt;

  return {
    id: previousPage?.id || id("page"),
    title,
    createdAt,
    updatedAt,
    content,
    contentHtml: textToHtml(content),
    format: previousPage?.format ? { ...normalizeFormat(previousPage.format) } : { ...DEFAULT_FORMAT }
  };
}

function stateFromExportText(text, previousState = null, options = {}) {
  const pages = parseExportTextPages(text);
  if (!pages.length) throw new Error("This file is empty.");

  const previous = previousState ? normalizeState(previousState) : null;
  const storyIndex = pages.findIndex(page => {
    const title = page.title.toLowerCase();
    return title === "project notes" || title === "story notes";
  });
  const storyBlock = pages[storyIndex >= 0 ? storyIndex : 0];
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
    const previousDraft = previous?.drafts?.[draftNumber - 1] || null;
    const draftPage = pageFromTransferBlock(draftBlock, `Draft ${draftNumber}`, previousDraft, options);
    const notesPage = pageFromTransferBlock(notesBlock, `${draftPage.title} Notes`, previousDraft?.notes, options);
    notesPage.id = previousDraft?.notes?.id || id("notes");
    notesPage.title = `${draftPage.title} Notes`;

    drafts.push({
      ...draftPage,
      id: previousDraft?.id || id("draft"),
      versionHistory: Array.isArray(previousDraft?.versionHistory) ? previousDraft.versionHistory : [],
      notes: notesPage
    });
  }

  const initialNotes = {
    ...pageFromTransferBlock(storyBlock, PROJECT_NOTES_TITLE, previous?.initialNotes, options),
    id: "initial-notes",
    title: PROJECT_NOTES_TITLE,
    versionHistory: Array.isArray(previous?.initialNotes?.versionHistory)
      ? previous.initialNotes.versionHistory
      : []
  };

  return normalizeState({
    version: 1,
    formatDefaultVersion: FORMAT_DEFAULT_VERSION,
    defaultFormat: currentDefaultFormat(previous),
    createdAt: previous?.createdAt || storyBlock.createdAt || nowIso(),
    updatedAt: nowIso(),
    viewState: previous?.viewState || null,
    initialNotes,
    drafts: drafts.length ? drafts : [StateCore.defaultState().drafts[0]]
  });
}

function findVersionHistoryPayloadForText(fileName, backupFolderPath) {
  if (!backupFolderPath || !directoryExists(backupFolderPath)) return null;

  const source = {
    fileName: fileName || "draft-history.txt",
    filePath: null
  };
  const candidateFolders = [
    path.join(backupFolderPath, "json"),
    path.join(backupFolderPath, "jsons"),
    backupFolderPath
  ];

  const expectedFileName = `${safeHistoryBaseName(source.fileName)}${VERSION_HISTORY_FILE_SUFFIX}`;
  for (const folderPath of candidateFolders) {
    const expectedPath = path.join(folderPath, expectedFileName);
    if (!fs.existsSync(expectedPath)) continue;
    const payload = parseVersionHistoryFile(expectedPath);
    if (payload) return payload;
  }

  for (const folderPath of candidateFolders) {
    try {
      const entries = fs.readdirSync(folderPath, { withFileTypes: true });
      for (const entry of entries) {
        if (!entry.isFile() || !entry.name.endsWith(VERSION_HISTORY_FILE_SUFFIX)) continue;
        const payload = parseVersionHistoryFile(path.join(folderPath, entry.name));
        if (versionHistoryPayloadMatchesSource(payload, source)) return payload;
      }
    } catch {
      // Missing folders are normal when no backup folder has been used yet.
    }
  }

  return null;
}

function versionCountForDraft(historyPayload, index, title) {
  const drafts = Array.isArray(historyPayload?.drafts) ? historyPayload.drafts : [];
  const titleKey = normalizeHistoryTitle(title);
  const match = drafts.find(draft => Number(draft?.index) === index)
    || drafts.find(draft => normalizeHistoryTitle(draft?.title) === titleKey);
  const history = Array.isArray(match?.history) ? match.history : match?.versionHistory;
  return Array.isArray(history) ? history.length : 0;
}

function storySummaryFromPages(pages, historyPayload = null) {
  const projectNotesContent = pages.projectNotes?.content || "";
  const projectNotesHistory = Array.isArray(historyPayload?.story?.history)
    ? historyPayload.story.history
    : Array.isArray(historyPayload?.initialNotes)
      ? historyPayload.initialNotes
      : [];

  return {
    projectNotes: {
      title: PROJECT_NOTES_TITLE,
      wordCount: wordCountForText(projectNotesContent),
      contentHash: textHash(projectNotesContent),
      versionCount: projectNotesHistory.length
    },
    draftCount: pages.drafts.length,
    drafts: pages.drafts.map((draft, index) => ({
      number: index + 1,
      title: draft.title || `Draft ${index + 1}`,
      wordCount: wordCountForText(draft.content),
      contentHash: textHash(draft.content),
      notesWordCount: wordCountForText(draft.notesContent),
      notesHash: textHash(draft.notesContent),
      versionCount: versionCountForDraft(historyPayload, index, draft.title)
    }))
  };
}

function storySummaryFromState(state, options = {}) {
  const normalized = normalizeState(state);
  const pages = {
    projectNotes: {
      title: PROJECT_NOTES_TITLE,
      content: normalized.initialNotes?.content || htmlToText(normalized.initialNotes?.contentHtml || "")
    },
    drafts: (normalized.drafts || []).map((draft, index) => ({
      title: draft.title || `Draft ${index + 1}`,
      content: draft.content || htmlToText(draft.contentHtml || ""),
      notesTitle: draft.notes?.title || `${draft.title || `Draft ${index + 1}`} Notes`,
      notesContent: draft.notes?.content || htmlToText(draft.notes?.contentHtml || "")
    }))
  };
  return storySummaryFromPages(pages, versionHistoryPayloadFromState(normalized, options));
}

function storySummaryFromTransferFiles(textFilePath, backupFolderPath) {
  const text = fs.existsSync(textFilePath) ? fs.readFileSync(textFilePath, "utf8") : "";
  const fileName = path.basename(textFilePath || "draft-history.txt");
  const pages = draftPagesFromExportText(text);
  return storySummaryFromPages(pages, findVersionHistoryPayloadForText(fileName, backupFolderPath));
}

function compareStorySummaries(baseline, usb) {
  const baselineDrafts = new Map((baseline?.drafts || []).map(draft => [draft.number, draft]));
  const usbDrafts = new Map((usb?.drafts || []).map(draft => [draft.number, draft]));
  const draftNumbers = [...new Set([...baselineDrafts.keys(), ...usbDrafts.keys()])].sort((left, right) => left - right);

  const addedDrafts = [];
  const removedDrafts = [];
  const changedDrafts = [];
  const changedDraftNotes = [];

  draftNumbers.forEach(number => {
    const before = baselineDrafts.get(number);
    const after = usbDrafts.get(number);
    if (!before && after) {
      addedDrafts.push(after);
      return;
    }
    if (before && !after) {
      removedDrafts.push(before);
      return;
    }
    if (!before || !after) return;

    const newVersions = Math.max(0, Number(after.versionCount || 0) - Number(before.versionCount || 0));
    if (
      before.contentHash !== after.contentHash ||
      before.wordCount !== after.wordCount ||
      newVersions > 0
    ) {
      changedDrafts.push({
        ...after,
        previousWordCount: before.wordCount,
        previousVersionCount: before.versionCount,
        newVersions
      });
    }
    if (before.notesHash !== after.notesHash || before.notesWordCount !== after.notesWordCount) {
      changedDraftNotes.push({
        number: after.number,
        title: `${after.title} Notes`,
        wordCount: after.notesWordCount,
        previousWordCount: before.notesWordCount
      });
    }
  });

  const beforeProject = baseline?.projectNotes || { wordCount: 0, contentHash: "", versionCount: 0 };
  const afterProject = usb?.projectNotes || { wordCount: 0, contentHash: "", versionCount: 0 };
  const projectNewVersions = Math.max(0, Number(afterProject.versionCount || 0) - Number(beforeProject.versionCount || 0));

  return {
    baseline,
    usb,
    projectNotes: {
      wordCount: afterProject.wordCount,
      previousWordCount: beforeProject.wordCount,
      versionCount: afterProject.versionCount,
      previousVersionCount: beforeProject.versionCount,
      newVersions: projectNewVersions,
      changed: beforeProject.contentHash !== afterProject.contentHash
        || beforeProject.wordCount !== afterProject.wordCount
        || projectNewVersions > 0
    },
    addedDrafts,
    removedDrafts,
    changedDrafts,
    changedDraftNotes
  };
}

function stateWithoutVersionHistory(state) {
  return StateCore.stateWithoutVersionHistory(state);
}

function persistVersionHistory(state, options = {}) {
  const write = versionHistoryTransactionWrite(state, options);
  if (!write) return null;
  writeTransactionalTextFiles([write], options);
  return write.filePath;
}

function versionHistoryTransactionWrite(state, options = {}) {
  const rootFolderPath = requireVersionHistoryFolderPath();
  const folderPath = rootFolderPath ? path.join(rootFolderPath, "json") : null;
  if (!folderPath) return null;

  fs.mkdirSync(folderPath, { recursive: true });
  const filePath = expectedVersionHistoryFilePath({ ...options, requireExistingRoot: true });
  const source = historySourceInfo(options);
  const stateToWrite = options.mergeExisting === false
    ? state
    : applyExternalVersionHistory(state, options).state;
  return {
    filePath,
    content: `${JSON.stringify(versionHistoryPayloadFromState(stateToWrite, options), null, 2)}\n`,
    onCommit: () => rememberVersionHistoryFilePath(rootFolderPath, source, filePath)
  };
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
  promotePageToNewestHistoryVersion(page, fallbackTitle);
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

function normalizeDiffSource(text) {
  return DiffCore.normalizeDiffSource(text);
}

function diffReportTexts(beforeText, afterText) {
  return DiffCore.diffText(beforeText, afterText);
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
    if (!DiffCore.isChangedDiffPart(part)) return;
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
  if (!parts.some(DiffCore.isChangedDiffPart)) return null;

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
    if (part.type === "added" && DiffCore.isDiffSequenceWordText(part.text)) stats.addedWords += 1;
    if (part.type === "removed" && DiffCore.isDiffSequenceWordText(part.text)) stats.removedWords += 1;
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

function summaryAnchor(value, fallback = "section") {
  const base = asText(value)
    .toLocaleLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return base || fallback;
}

function versionWordCount(version) {
  return wordCountForText(textForHistoryVersion(version));
}

function versionHeadingLabel(index, total) {
  return index === total - 1 ? `Version ${index + 1} / current` : `Version ${index + 1}`;
}

function versionBaselineHtml(version) {
  const text = escapeHtml(textForHistoryVersion(version));
  const body = text
    ? `<div class="version-change-diff">${text}</div>`
    : "<p>No text in this version.</p>";
  return `<div class="version-change"><h4>First saved version</h4><p class="meta">Baseline text; no changes to compare.</p>${body}</div>`;
}

function fullVersionSummaryReportPath(options = {}) {
  const summaryFolderPath = historySummaryBackupFolderPath();
  if (!summaryFolderPath) return null;
  const source = historySourceInfo(options);
  return path.join(
    summaryFolderPath,
    `${safeHistoryBaseName(source.fileName)}${FULL_VERSION_HISTORY_REPORT_SUFFIX}`
  );
}

function normalizeReportFileNamePart(value) {
  const text = asText(value);
  return process.platform === "win32" ? text.toLowerCase() : text;
}

function isDuplicateFullVersionHistoryReportName(name, targetName) {
  const parsed = path.parse(name);
  const targetStem = normalizeReportFileNamePart(path.parse(targetName).name);
  const stem = normalizeReportFileNamePart(parsed.name);
  const extension = normalizeReportFileNamePart(parsed.ext);
  if (extension !== ".html" || !targetStem || stem === targetStem) return false;
  if (stem === `copy of ${targetStem}`) return true;
  if (!stem.startsWith(targetStem)) return false;

  const suffix = stem.slice(targetStem.length);
  return /^\s\(\d+\)$/.test(suffix)
    || /^ - copy(?: \(\d+\))?$/.test(suffix)
    || /^ copy(?: \(\d+\))?$/.test(suffix)
    || /^[-_. ]\d{8,14}$/.test(suffix)
    || /^[-_. ]\d{4}-\d{2}-\d{2}(?:[-_. t]\d{2}[-_.:]?\d{2}(?:[-_.:]?\d{2})?)?$/.test(suffix);
}

function removeDuplicateFullVersionHistoryReports(reportPath) {
  const folderPath = path.dirname(reportPath);
  const targetName = path.basename(reportPath);
  const isTargetName = name => process.platform === "win32"
    ? name.toLowerCase() === targetName.toLowerCase()
    : name === targetName;

  let removed = 0;
  try {
    for (const name of fs.readdirSync(folderPath)) {
      if (isTargetName(name) || !isDuplicateFullVersionHistoryReportName(name, targetName)) continue;
      const duplicatePath = path.join(folderPath, name);
      try {
        if (!fs.statSync(duplicatePath).isFile()) continue;
        fs.rmSync(duplicatePath, { force: true });
        removed += 1;
      } catch {}
    }
  } catch {}
  return removed;
}

function versionSummaryPages(state) {
  const pages = [{
    key: STORY_KEY,
    title: PROJECT_NOTES_TITLE,
    type: "Project notes",
    anchor: "project-notes",
    page: state.initialNotes
  }];

  (state.drafts || []).forEach((draft, index) => {
    const title = draft.title || `Draft ${index + 1}`;
    pages.push({
      key: draft.id || `draft-${index + 1}`,
      title,
      type: "Draft",
      anchor: `draft-${index + 1}-${summaryAnchor(title)}`,
      page: draft
    });
  });

  return pages.map(page => ({
    ...page,
    versions: historyWithCurrentVersion(page.page, page.title)
  }));
}

function reportTextForVersion(version) {
  return normalizeDiffSource(textForHistoryVersion(version));
}

function textSignificantVersionEntries(versions) {
  const entries = [];
  let previousReportText = null;

  (Array.isArray(versions) ? versions : []).forEach(version => {
    const reportText = reportTextForVersion(version);
    if (entries.length && reportText === previousReportText) return;

    const previousEntry = entries[entries.length - 1] || null;
    entries.push({
      version,
      previousVersion: previousEntry?.version || null
    });
    previousReportText = reportText;
  });

  return entries;
}

function fullSummaryDraftChangeHtml(left, right, index) {
  const anchor = `draft-change-${index + 1}-${index + 2}`;
  const title = `${left.title} to ${right.title}`;
  const parts = diffReportTexts(left.currentText, right.currentText);
  const stats = finalDraftDiffWordStats(parts);
  const changed = parts.some(part => part.type === "added" || part.type === "removed");
  const body = changed
    ? `<div class="final-draft-diff-text">${compactFinalDraftDiffParts(parts).map(renderFinalDraftDiffPart).join("")}</div>`
    : "<p>No final-draft text changes detected.</p>";
  const meta = changed
    ? `${stats.addedWords.toLocaleString("en-GB")} added ${stats.addedWords === 1 ? "word" : "words"}; ${stats.removedWords.toLocaleString("en-GB")} removed ${stats.removedWords === 1 ? "word" : "words"}.`
    : "No final-draft text changes detected.";

  return {
    anchor,
    title,
    html: `<article id="${escapeHtml(anchor)}" class="draft-change"><h3>${escapeHtml(title)}</h3><p class="meta">${escapeHtml(meta)}</p>${body}</article>`
  };
}

function versionChangeDiffHtml(previousVersion, version) {
  if (!previousVersion) {
    return versionBaselineHtml(version);
  }

  const beforeText = textForHistoryVersion(previousVersion);
  const afterText = textForHistoryVersion(version);
  const parts = diffReportTexts(beforeText, afterText);
  const stats = finalDraftDiffWordStats(parts);
  const changed = parts.some(part => part.type === "added" || part.type === "removed");
  const meta = changed
    ? `${stats.addedWords.toLocaleString("en-GB")} added ${stats.addedWords === 1 ? "word" : "words"}; ${stats.removedWords.toLocaleString("en-GB")} removed ${stats.removedWords === 1 ? "word" : "words"}.`
    : "No text changes from the previous version.";
  const body = changed
    ? `<div class="version-change-diff">${compactFinalDraftDiffParts(parts).map(renderFinalDraftDiffPart).join("")}</div>`
    : "<p>No text changes from the previous version.</p>";

  return `<div class="version-change"><h4>Changes from previous version</h4><p class="meta">${escapeHtml(meta)}</p>${body}</div>`;
}

async function fullVersionHistorySummaryHtml(state, options = {}, progress = () => {}) {
  const source = historySourceInfo(options);
  const sourceName = source.fileName || "draft-history.txt";
  const pages = versionSummaryPages(state).map(page => ({
    ...page,
    reportVersions: textSignificantVersionEntries(page.versions)
  }));
  const draftAnalyses = (state.drafts || []).map(analyseDraftCutHistory);
  const totalVersions = pages.reduce((sum, page) => sum + page.versions.length, 0);
  const totalReportVersions = pages.reduce((sum, page) => sum + page.reportVersions.length, 0);
  const totalSkippedVersions = totalVersions - totalReportVersions;
  const totalVersionChangeDiffs = pages.reduce((sum, page) => sum + Math.max(page.reportVersions.length - 1, 0), 0);
  const totalChanges = Math.max(draftAnalyses.length - 1, 0);
  const totalSteps = Math.max(totalReportVersions + totalVersionChangeDiffs + totalChanges + 2, 1);
  let completed = 0;

  const tick = async step => {
    progress({
      step,
      completed: Math.min(completed, totalSteps),
      total: totalSteps
    });
    await yieldToEventLoop();
  };

  await tick("Preparing contents");

  const contentsHtml = [
    '<li><a href="#draft-changes">Draft changes</a></li>',
    '<li><a href="#version-history">Version history</a><ol>',
    ...pages.map(page => `<li><a href="#${escapeHtml(page.anchor)}">${escapeHtml(page.title)}</a><ol>${page.reportVersions.map((entry, index) => `<li><a href="#${escapeHtml(`${page.anchor}-version-${index + 1}`)}">${escapeHtml(versionHeadingLabel(index, page.reportVersions.length))} (${escapeHtml(formatDate(entry.version.createdAt))})</a></li>`).join("")}</ol></li>`),
    "</ol></li>"
  ].join("");

  const draftChanges = [];
  for (let index = 0; index < draftAnalyses.length - 1; index += 1) {
    await tick(`Comparing ${draftAnalyses[index].title} to ${draftAnalyses[index + 1].title}`);
    draftChanges.push(fullSummaryDraftChangeHtml(draftAnalyses[index], draftAnalyses[index + 1], index));
    completed += 1;
  }

  const versionSections = [];
  for (const page of pages) {
    const versionArticles = [];
    for (let index = 0; index < page.reportVersions.length; index += 1) {
      const entry = page.reportVersions[index];
      const version = entry.version;
      let changeHtml = "";
      if (entry.previousVersion) {
        await tick(`Comparing ${page.title}: ${versionHeadingLabel(index - 1, page.reportVersions.length)} to ${versionHeadingLabel(index, page.reportVersions.length)}`);
        changeHtml = versionChangeDiffHtml(entry.previousVersion, version);
        completed += 1;
      } else {
        changeHtml = versionChangeDiffHtml(null, version);
      }
      await tick(`Rendering ${page.title}: ${versionHeadingLabel(index, page.reportVersions.length)}`);
      versionArticles.push(`
        <article id="${escapeHtml(`${page.anchor}-version-${index + 1}`)}" class="version-entry">
          <header class="version-heading">
            <h3>${escapeHtml(versionHeadingLabel(index, page.reportVersions.length))}</h3>
            <p class="meta">${escapeHtml(formatDate(version.createdAt))} · ${versionWordCount(version).toLocaleString("en-GB")} ${versionWordCount(version) === 1 ? "word" : "words"}</p>
          </header>
          ${changeHtml}
        </article>
      `);
      completed += 1;
    }

    const originalVersionCount = page.versions.length;
    const skippedVersionCount = originalVersionCount - page.reportVersions.length;
    const skippedVersionMetaHtml = skippedVersionCount
      ? `<p class="meta">${skippedVersionCount.toLocaleString("en-GB")} unchanged ${skippedVersionCount === 1 ? "version" : "versions"} skipped.</p>`
      : "";

    versionSections.push(`
      <section id="${escapeHtml(page.anchor)}" class="history-page-section">
        <h2>${escapeHtml(page.title)}</h2>
        <p class="meta">${escapeHtml(page.type)} · ${page.reportVersions.length.toLocaleString("en-GB")} text-changing ${page.reportVersions.length === 1 ? "version" : "versions"} shown</p>
        ${skippedVersionMetaHtml}
        ${versionArticles.join("\n")}
      </section>
    `);
  }

  completed = totalSteps;
  await tick("Writing HTML file");

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>${escapeHtml(sourceName)} version history summary</title>
<style>
body{margin:0;background:#f8f7f4;color:#24211d;font:16px/1.55 Georgia,'Times New Roman',serif}
main{max-width:1100px;margin:0 auto;padding:34px 30px 72px}
h1,h2,h3,h4,.meta,.contents-page,.draft-change{font-family:system-ui,-apple-system,Segoe UI,sans-serif}
h1{font-size:30px;line-height:1.2;margin:0 0 8px}
h2{border-top:1px solid #d8d3ca;margin:36px 0 12px;padding-top:24px;font-size:22px}
h3{font-size:17px;margin:0}
h4{font-size:14px;margin:16px 0 8px;color:#403b34}
.meta{color:#6d675e;font-size:13px;margin:4px 0 12px}
.contents-page{background:#fff;border:1px solid #d8d3ca;padding:18px 22px;margin:24px 0}
.contents-page ol{margin:8px 0 0 22px;padding:0}
.contents-page a{color:#17456f;text-decoration:none}
.contents-page a:hover,.contents-page a:focus{text-decoration:underline}
.summary-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:12px;margin:22px 0}
.summary-stat{background:#fff;border:1px solid #d8d3ca;padding:12px}
.summary-stat strong{display:block;font:700 20px/1.2 system-ui,-apple-system,Segoe UI,sans-serif}
.draft-change,.version-entry{background:#fff;border:1px solid #d8d3ca;margin:14px 0;padding:14px 16px;break-inside:avoid}
.final-draft-diff-text,.version-change-diff{white-space:pre-wrap;font:15px/1.62 Georgia,'Times New Roman',serif}
.version-change{border-bottom:1px solid #ece7dd;margin:0 0 14px;padding:0 0 12px}
.compare-token{border-radius:2px;padding:0 1px}
.compare-token.added{background:#dff5df;color:#17602b;text-decoration:none}
.compare-token.removed{background:#ffe1d6;color:#9b1c1c;text-decoration:line-through}
.version-heading{border-bottom:1px solid #ece7dd;margin-bottom:12px;padding-bottom:8px}
@media print{body{background:#fff}.contents-page,.draft-change,.version-entry{break-inside:avoid}}
</style>
</head>
<body>
<main>
<h1>${escapeHtml(sourceName)} version history summary</h1>
<p class="meta">Generated ${escapeHtml(formatDate(nowIso()))}. Source text: ${escapeHtml(source.filePath || "companion draft-history.txt")}.</p>
<div class="summary-grid">
  <div class="summary-stat"><strong>${(state.drafts || []).length.toLocaleString("en-GB")}</strong> current drafts</div>
  <div class="summary-stat"><strong>${totalReportVersions.toLocaleString("en-GB")}</strong> text-changing versions shown</div>
  <div class="summary-stat"><strong>${totalSkippedVersions.toLocaleString("en-GB")}</strong> unchanged versions skipped</div>
  <div class="summary-stat"><strong>${totalChanges.toLocaleString("en-GB")}</strong> draft-change sections</div>
</div>
<nav class="contents-page" aria-label="Contents">
<h2>Contents</h2>
<ol>${contentsHtml}</ol>
</nav>
<section id="draft-changes">
<h2>Draft changes</h2>
${draftChanges.length ? draftChanges.map(change => change.html).join("\n") : "<p>No draft-to-draft changes to show.</p>"}
</section>
<section id="version-history">
<h2>Version history</h2>
${versionSections.join("\n")}
</section>
</main>
</body>
</html>
`;
}

async function writeFullVersionHistorySummaryReport(state, options = {}, progress = () => {}) {
  const reportPath = fullVersionSummaryReportPath(options);
  if (!reportPath) throw new BackupFolderMissingError(readVersionHistoryFolderPath() || "No backup folder selected");

  fs.mkdirSync(path.dirname(reportPath), { recursive: true });
  const html = await fullVersionHistorySummaryHtml(state, options, progress);
  const removedDuplicateReports = removeDuplicateFullVersionHistoryReports(reportPath);
  writeAtomicText(reportPath, html, {
    temporaryFolderPath: cutHistoryCacheFolderPath(reportPath)
  });

  return {
    reportPath,
    bytes: Buffer.byteLength(html),
    removedDuplicateReports
  };
}

function versionSummaryJobSnapshot(job) {
  if (!job) return null;
  const elapsedMs = Date.now() - new Date(job.startedAt).getTime();
  return {
    id: job.id,
    ok: job.status !== "failed",
    status: job.status,
    step: job.step,
    completed: job.completed,
    total: job.total,
    startedAt: job.startedAt,
    updatedAt: job.updatedAt,
    elapsedMs,
    result: job.result || null,
    error: job.error || ""
  };
}

function updateVersionSummaryJob(job, patch = {}) {
  Object.assign(job, patch, { updatedAt: nowIso() });
}

function scheduleVersionSummaryJobCleanup(job) {
  if (job.cleanupTimer) return;
  job.cleanupTimer = setTimeout(() => {
    versionSummaryJobs.delete(job.id);
  }, 60 * 60_000);
  job.cleanupTimer.unref?.();
}

function completeVersionSummaryJob(job, patch = {}) {
  updateVersionSummaryJob(job, patch);
  scheduleVersionSummaryJobCleanup(job);
}

function versionSummaryWorkerSource() {
  return `
    const { parentPort, workerData } = require("node:worker_threads");
    Promise.resolve()
      .then(() => {
        const server = require(workerData.serverPath);
        return server.writeFullVersionHistorySummaryReport(
          workerData.state,
          workerData.options,
          progress => parentPort.postMessage({ type: "progress", progress })
        );
      })
      .then(result => parentPort.postMessage({ type: "complete", result }))
      .catch(error => {
        parentPort.postMessage({
          type: "error",
          error: error && error.stack ? error.stack : String(error)
        });
      });
  `;
}

function startVersionSummaryWorker(job, state, options = {}, backup = null) {
  const worker = new Worker(versionSummaryWorkerSource(), {
    eval: true,
    workerData: {
      serverPath: __filename,
      state,
      options
    }
  });
  job.worker = worker;

  worker.on("message", message => {
    if (message?.type === "progress") {
      const progress = message.progress || {};
      updateVersionSummaryJob(job, {
        status: "running",
        step: progress.step || job.step,
        completed: Number.isFinite(progress.completed) ? progress.completed : job.completed,
        total: Number.isFinite(progress.total) ? progress.total : job.total
      });
      return;
    }

    if (message?.type === "complete") {
      completeVersionSummaryJob(job, {
        status: "complete",
        step: "Complete",
        completed: job.total || 1,
        result: {
          ...(message.result || {}),
          backup: backup || null
        }
      });
      return;
    }

    if (message?.type === "error") {
      completeVersionSummaryJob(job, {
        status: "failed",
        step: "Failed",
        error: message.error || "Summary worker failed"
      });
    }
  });

  worker.on("error", error => {
    completeVersionSummaryJob(job, {
      status: "failed",
      step: "Failed",
      error: error?.stack || error?.message || String(error)
    });
  });

  worker.on("exit", code => {
    if (code && job.status !== "failed" && job.status !== "complete") {
      completeVersionSummaryJob(job, {
        status: "failed",
        step: "Failed",
        error: `Summary worker exited with code ${code}.`
      });
      return;
    }

    if (job.status === "complete" || job.status === "failed") scheduleVersionSummaryJobCleanup(job);
  });
}

function runVersionSummaryJob(job, body) {
  try {
    updateVersionSummaryJob(job, {
      status: "running",
      step: "Saving current project",
      completed: 0,
      total: 1
    });

    const payload = parseStatePayload(body);
    const savedState = writeAll(payload.state, {
      filePath: payload.filePath,
      fileName: payload.fileName,
      allowLinkedTextFileFailure: true
    });
    const backup = backupProjectFiles(savedState, {
      filePath: payload.filePath,
      fileName: payload.fileName,
      skipSummary: true
    });
    const summaryState = applyExternalVersionHistory(savedState, {
      filePath: payload.filePath,
      fileName: payload.fileName
    }).state;

    startVersionSummaryWorker(
      job,
      summaryState,
      {
        filePath: payload.filePath,
        fileName: payload.fileName
      },
      backup || null
    );
  } catch (error) {
    completeVersionSummaryJob(job, {
      status: "failed",
      step: "Failed",
      error: error?.message || String(error)
    });
  }
}

function startVersionHistorySummaryJobFromRequestBody(body) {
  const job = {
    id: id("summary"),
    status: "queued",
    step: "Queued",
    completed: 0,
    total: 1,
    startedAt: nowIso(),
    updatedAt: nowIso(),
    result: null,
    error: ""
  };
  versionSummaryJobs.set(job.id, job);

  void runVersionSummaryJob(job, body);
  return {
    ok: true,
    jobId: job.id,
    progress: versionSummaryJobSnapshot(job)
  };
}

function versionHistorySummaryJobProgress(jobId) {
  const job = versionSummaryJobs.get(asText(jobId));
  return job
    ? { ok: true, progress: versionSummaryJobSnapshot(job) }
    : { ok: false, error: "Summary job not found" };
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
<div class="summary"><div class="stat"><strong>${drafts.length.toLocaleString("en-GB")}</strong> current drafts</div><div class="stat"><strong>${finalDraftDiffs.length.toLocaleString("en-GB")}</strong> final comparisons</div><div class="stat"><strong>${totalVersions.toLocaleString("en-GB")}</strong> versions listed</div><div class="stat"><strong>${totalCutEntries.toLocaleString("en-GB")}</strong> cut entries found</div><div class="stat"><strong>${totalCutWords.toLocaleString("en-GB")}</strong> cut words found</div></div>
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

function isOneDrivePath(filePath) {
  if (process.platform !== "win32") return false;

  const resolvedPath = path.resolve(filePath).toLowerCase();
  const roots = [
    process.env.OneDrive,
    process.env.OneDriveCommercial,
    process.env.OneDriveConsumer
  ]
    .filter(Boolean)
    .map(root => path.resolve(root).toLowerCase());

  return roots.some(root => resolvedPath === root || resolvedPath.startsWith(`${root}${path.sep}`));
}

function writeAtomicText(filePath, content, options = {}) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });

  if (isOneDrivePath(filePath) || (options.temporaryFolderPath && isOneDrivePath(options.temporaryFolderPath))) {
    fs.writeFileSync(filePath, content, "utf8");
    return;
  }

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

let recoveringPersistenceTransaction = false;

function readPersistenceTransactionManifest() {
  try {
    const parsed = JSON.parse(fs.readFileSync(PERSISTENCE_TRANSACTION_MANIFEST, "utf8").replace(/^\uFEFF/u, ""));
    return parsed && typeof parsed === "object" && Array.isArray(parsed.writes) ? parsed : null;
  } catch {
    return null;
  }
}

function removePersistenceTransactionJournal() {
  try {
    fs.rmSync(PERSISTENCE_TRANSACTION_DIR, { recursive: true, force: true });
  } catch {}
}

function rollbackPersistenceTransaction(manifest) {
  const writes = Array.isArray(manifest?.writes) ? manifest.writes : [];
  const errors = [];

  writes.slice().reverse().forEach(entry => {
    const filePath = asText(entry?.filePath);
    if (!filePath) return;

    try {
      if (entry.existed) {
        if (!entry.backupPath) throw new Error("Missing transaction backup path.");
        const backupText = fs.readFileSync(entry.backupPath, "utf8");
        writeAtomicText(filePath, backupText, { temporaryFolderPath: PERSISTENCE_TRANSACTION_DIR });
      } else {
        fs.rmSync(filePath, { force: true });
      }
    } catch (error) {
      errors.push({ filePath, error });
    }
  });

  if (errors.length) {
    const error = new Error(`Persistence transaction rollback failed for ${errors.length} file${errors.length === 1 ? "" : "s"}.`);
    error.code = "PERSISTENCE_ROLLBACK_FAILED";
    error.rollbackErrors = errors;
    throw error;
  }
}

function recoverPersistenceTransaction() {
  ensureDataDir();
  if (recoveringPersistenceTransaction) return;

  const manifest = readPersistenceTransactionManifest();
  if (!manifest) {
    if (fs.existsSync(PERSISTENCE_TRANSACTION_DIR)) removePersistenceTransactionJournal();
    return;
  }

  recoveringPersistenceTransaction = true;
  try {
    rollbackPersistenceTransaction(manifest);
    removePersistenceTransactionJournal();
  } finally {
    recoveringPersistenceTransaction = false;
  }
}

function normalizeTransactionWrites(writes = []) {
  const byPath = new Map();

  writes.filter(Boolean).forEach(write => {
    if (!write.filePath) return;
    const filePath = path.resolve(write.filePath);
    const content = String(write.content ?? "");
    const existing = byPath.get(filePath);

    if (existing) {
      if (existing.content !== content) {
        throw new Error(`Conflicting transaction writes for ${filePath}`);
      }
      if (typeof write.onCommit === "function") existing.onCommit.push(write.onCommit);
      return;
    }

    byPath.set(filePath, {
      filePath,
      content,
      temporaryFolderPath: write.temporaryFolderPath,
      onCommit: typeof write.onCommit === "function" ? [write.onCommit] : []
    });
  });

  return Array.from(byPath.values());
}

function preparePersistenceTransactionJournal(writes) {
  removePersistenceTransactionJournal();
  fs.mkdirSync(PERSISTENCE_TRANSACTION_DIR, { recursive: true });

  const manifest = {
    version: 1,
    createdAt: nowIso(),
    writes: writes.map((write, index) => {
      const existed = fs.existsSync(write.filePath);
      const backupPath = existed
        ? path.join(PERSISTENCE_TRANSACTION_DIR, `before-${index}.txt`)
        : "";
      if (existed) fs.copyFileSync(write.filePath, backupPath);
      return {
        filePath: write.filePath,
        existed,
        backupPath
      };
    })
  };

  writeAtomicText(PERSISTENCE_TRANSACTION_MANIFEST, `${JSON.stringify(manifest, null, 2)}\n`, {
    temporaryFolderPath: PERSISTENCE_TRANSACTION_DIR
  });
  return manifest;
}

function shouldFailTransactionWrite(write, options = {}) {
  const failPath = asText(options.testFailWritePath);
  return Boolean(failPath && path.resolve(failPath) === path.resolve(write.filePath));
}

function transactionWriteFailure(write) {
  const error = new Error(`Injected transaction write failure for ${write.filePath}`);
  error.code = "ETEST_TRANSACTION_WRITE";
  error.filePath = write.filePath;
  return error;
}

function writeTransactionalTextFiles(writes = [], options = {}) {
  const normalizedWrites = normalizeTransactionWrites(writes);
  if (!normalizedWrites.length) return;

  recoverPersistenceTransaction();
  const manifest = preparePersistenceTransactionJournal(normalizedWrites);

  try {
    for (const write of normalizedWrites) {
      if (shouldFailTransactionWrite(write, options)) throw transactionWriteFailure(write);
      try {
        writeAtomicText(write.filePath, write.content, {
          temporaryFolderPath: write.temporaryFolderPath
        });
      } catch (error) {
        error.filePath = error.filePath || write.filePath;
        throw error;
      }
    }

    normalizedWrites.forEach(write => {
      write.onCommit.forEach(callback => callback());
    });
    removePersistenceTransactionJournal();
  } catch (error) {
    try {
      rollbackPersistenceTransaction(manifest);
      removePersistenceTransactionJournal();
    } catch (rollbackError) {
      error.rollbackError = rollbackError;
    }
    throw error;
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

  writeAtomicText(textFilePath, formatExport(normalized));
  const historyReport = (() => {
    if (options.skipSummary) return null;
    if (!versionHistoryPath) return null;
    const job = {
      versionHistoryPath,
      textFilePath,
      historyReportPath,
      sourceFileName: source.fileName,
      sourceFilePath: source.filePath
    };
    return options.waitForSummary
      ? writeCutHistoryReportFromFiles(job)
      : queueCutHistoryReport(job);
  })();

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

function stateForStorage(state, options = {}) {
  if (options.embedVersionHistory) return state;
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
  writeAtomicText(TEXT_FILE_LINK_FILE, `${JSON.stringify({ filePath: resolvedPath }, null, 2)}\n`);
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
  writeAtomicText(TEXT_FILE_STATES_FILE, `${JSON.stringify(states, null, 2)}\n`);
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

function writeTextFileState(filePath, state, options = {}) {
  const write = textFileStateTransactionWrite(filePath, state);
  if (!write) return;
  writeTransactionalTextFiles([write], options);
}

function textFileStateTransactionWrite(filePath, state) {
  if (!filePath || !state) return null;

  const resolvedPath = path.resolve(filePath);
  const normalized = normalizeState(state);
  const states = readTextFileStates();
  states[textFileStateKey(resolvedPath)] = {
    filePath: resolvedPath,
    updatedAt: nowIso(),
    state: stateForStorage(normalized)
  };
  return {
    filePath: TEXT_FILE_STATES_FILE,
    content: `${JSON.stringify(states, null, 2)}\n`
  };
}

function writeProjectStateOnly(state, options = {}) {
  ensureDataDir();
  recoverPersistenceTransaction();
  const normalized = normalizeState(state, { touch: Boolean(options.touch) });
  const writes = [
    {
      filePath: STATE_FILE,
      content: `${JSON.stringify(stateForStorage(normalized), null, 2)}\n`
    }
  ];

  const linkedTextPath = readTextFileLink();
  if (linkedTextPath) {
    const cacheWrite = textFileStateTransactionWrite(linkedTextPath, normalized);
    if (cacheWrite) writes.push(cacheWrite);
  }

  writeTransactionalTextFiles(writes, options);
  return normalized;
}

function writeAll(state, options = {}) {
  ensureDataDir();
  recoverPersistenceTransaction();
  const normalized = normalizeState(state, { touch: true });
  const exportText = formatExport(normalized);
  const linkedTextPath = readTextFileLink();
  const coreWrites = [
    {
      filePath: STATE_FILE,
      content: `${JSON.stringify(stateForStorage(normalized, {
        embedVersionHistory: Boolean(options.embedVersionHistory)
      }), null, 2)}\n`
    },
    {
      filePath: EXPORT_FILE,
      content: exportText
    }
  ];
  const linkedWrites = [];

  if (linkedTextPath) {
    linkedWrites.push({
      filePath: linkedTextPath,
      content: exportText
    });
    const cacheWrite = textFileStateTransactionWrite(linkedTextPath, normalized);
    if (cacheWrite) linkedWrites.push(cacheWrite);
  }

  const versionHistoryWrites = [];

  if (!options.skipVersionHistory) {
    try {
      const versionHistoryWrite = versionHistoryTransactionWrite(normalized, {
        filePath: options.filePath || linkedTextPath || (options.fileName ? "" : EXPORT_FILE),
        fileName: options.fileName
      });
      if (versionHistoryWrite) versionHistoryWrites.push(versionHistoryWrite);
    } catch (error) {
      if (!options.allowMissingVersionHistoryFolder || !isBackupFolderMissingError(error)) throw error;
    }
  }

  const allWrites = [...coreWrites, ...linkedWrites, ...versionHistoryWrites];
  try {
    writeTransactionalTextFiles(allWrites, options);
  } catch (error) {
    const failedPath = error.filePath ? path.resolve(error.filePath) : "";
    const linkedFailurePaths = new Set([
      linkedTextPath ? path.resolve(linkedTextPath) : "",
      path.resolve(TEXT_FILE_STATES_FILE)
    ].filter(Boolean));
    if (!options.allowLinkedTextFileFailure || !linkedFailurePaths.has(failedPath)) {
      if (linkedTextPath && failedPath === path.resolve(linkedTextPath)) {
        throw new Error(`Linked text file write failed: ${linkedTextPath} (${error.code || error.message})`);
      }
      throw error;
    }

    console.error(`Linked text file write skipped during close: ${linkedTextPath} (${error.code || error.message})`);
    writeTransactionalTextFiles([...coreWrites, ...versionHistoryWrites], options);
  }

  return normalized;
}

function usbTransferTimestamp(date = new Date()) {
  return date.toISOString().replace(/[:.]/g, "-");
}

function usbTransferPackageFolderName(sourceName) {
  return `${safeFolderName(safeHistoryBaseName(sourceName), "draft-history")}-draftdiff-transfer-${usbTransferTimestamp()}`;
}

function copyFileToPackage(sourcePath, packagePath) {
  fs.mkdirSync(path.dirname(packagePath), { recursive: true });
  fs.copyFileSync(sourcePath, packagePath);
}

function copyDirectoryToPackage(sourcePath, packagePath) {
  fs.rmSync(packagePath, { recursive: true, force: true });
  fs.mkdirSync(path.dirname(packagePath), { recursive: true });
  fs.cpSync(sourcePath, packagePath, { recursive: true });
}

function copyDirectorySubsetToPackage(sourcePath, packagePath, relativePaths = []) {
  fs.rmSync(packagePath, { recursive: true, force: true });
  fs.mkdirSync(packagePath, { recursive: true });

  relativePaths.forEach(relativePath => {
    const sourceFilePath = pathFromPortable(sourcePath, relativePath);
    if (!fs.existsSync(sourceFilePath) || !fs.statSync(sourceFilePath).isFile()) return;
    copyFileToPackage(sourceFilePath, pathFromPortable(packagePath, relativePath));
  });
}

function subsetDirectorySnapshot(folderPath, relativePaths = []) {
  const resolvedPath = folderPath ? path.resolve(folderPath) : "";
  const files = [...new Set(relativePaths.map(relativePath => portablePath(relativePath)).filter(Boolean))]
    .sort((left, right) => left.localeCompare(right))
    .map(relativePath => ({
      relativePath,
      snapshot: fileSnapshot(pathFromPortable(resolvedPath, relativePath))
    }))
    .filter(file => file.snapshot.exists)
    .map(file => ({
      relativePath: file.relativePath,
      size: file.snapshot.size,
      mtimeMs: file.snapshot.mtimeMs,
      sha256: file.snapshot.sha256
    }));

  return {
    exists: Boolean(resolvedPath && directoryExists(resolvedPath)),
    path: resolvedPath,
    files
  };
}

function addRelativePathIfFile(paths, rootFolderPath, filePath) {
  if (!rootFolderPath || !filePath) return;
  const resolvedRoot = path.resolve(rootFolderPath);
  const resolvedFile = path.resolve(filePath);
  if (!pathIsInsideFolder(resolvedFile, resolvedRoot)) return;

  try {
    if (!fs.statSync(resolvedFile).isFile()) return;
  } catch {
    return;
  }

  paths.add(portablePath(path.relative(resolvedRoot, resolvedFile)));
}

function relevantBackupRelativePaths(backupFolderPath, source) {
  const paths = new Set();
  if (!backupFolderPath || !directoryExists(backupFolderPath)) return [];

  const baseName = safeHistoryBaseName(source.fileName);
  const textFileName = safeBackupFileName(source.fileName, "draft-history.txt");
  [
    path.join(backupFolderPath, "original txt", textFileName),
    path.join(backupFolderPath, "version history md", `${baseName}${BACKUP_HISTORY_REPORT_SUFFIX}`),
    path.join(backupFolderPath, "version history summaries", `${baseName}${CUT_HISTORY_REPORT_SUFFIX}`),
    path.join(backupFolderPath, "version history summaries", `${baseName}${FULL_VERSION_HISTORY_REPORT_SUFFIX}`),
    path.join(backupFolderPath, "version history summary cache", `${baseName}${CUT_HISTORY_REPORT_SUFFIX}.meta.json`),
    path.join(backupFolderPath, "version history summary cache", `${baseName}${FULL_VERSION_HISTORY_REPORT_SUFFIX}.meta.json`),
    path.join(backupFolderPath, "json", `${baseName}${VERSION_HISTORY_FILE_SUFFIX}`),
    path.join(backupFolderPath, "jsons", `${baseName}${VERSION_HISTORY_FILE_SUFFIX}`),
    path.join(backupFolderPath, `${baseName}${VERSION_HISTORY_FILE_SUFFIX}`)
  ].forEach(filePath => addRelativePathIfFile(paths, backupFolderPath, filePath));

  addRelativePathIfFile(paths, backupFolderPath, findVersionHistoryFilePath({
    filePath: source.filePath,
    fileName: source.fileName
  }));

  return Array.from(paths).sort((left, right) => left.localeCompare(right));
}

function assertTransferDestinationSafe(packageFolderPath, sourcePaths) {
  const packagePath = path.resolve(packageFolderPath);
  sourcePaths.filter(Boolean).forEach(sourcePath => {
    const resolvedSource = path.resolve(sourcePath);
    if (directoryExists(resolvedSource) && pathIsInsideFolder(packagePath, resolvedSource)) {
      throw new Error(`Transfer package cannot be created inside copied folder: ${resolvedSource}`);
    }
  });
}

function transferItemDisplayPath(item, relativePath = "") {
  if (!relativePath) return item.sourcePath || item.label || item.id;
  return item.kind === "directory"
    ? path.join(item.sourcePath || item.label || item.id, ...asText(relativePath).split(/[\\/]+/u).filter(Boolean))
    : item.sourcePath || item.label || item.id;
}

function normalizedTransferFileName(value) {
  return asText(value).trim().toLowerCase();
}

function transferStoryFileNames(item, manifest) {
  return new Set([
    manifest?.source?.fileName,
    item?.label,
    item?.sourcePath ? path.basename(item.sourcePath) : ""
  ].map(normalizedTransferFileName).filter(Boolean));
}

function currentLinkedStoryPathForTransfer(item, manifest) {
  const linkedTextPath = readTextFileLink();
  if (!linkedTextPath || !fileSnapshot(linkedTextPath).exists) return "";

  const expectedNames = transferStoryFileNames(item, manifest);
  const linkedName = normalizedTransferFileName(path.basename(linkedTextPath));
  if (expectedNames.size && !expectedNames.has(linkedName)) return "";

  return path.resolve(linkedTextPath);
}

function localSourcePathForTransferItem(item, manifest) {
  const sourcePath = item?.sourcePath ? path.resolve(item.sourcePath) : "";

  if (item?.role === "storyText") {
    if (sourcePath && fileSnapshot(sourcePath).exists) return sourcePath;
    return currentLinkedStoryPathForTransfer(item, manifest) || sourcePath;
  }

  if (item?.role === "backupFolder") {
    if (sourcePath && directoryExists(sourcePath)) return sourcePath;
    return existingVersionHistoryFolderPath() || sourcePath;
  }

  return sourcePath;
}

function compareTransferFileEntry(item, relativePath, baseline, usb, local, options = {}) {
  const status = transferChangeStatus(baseline, usb, local, options);
  return {
    itemId: item.id,
    role: item.role,
    kind: item.kind,
    relativePath: relativePath || "",
    displayPath: transferItemDisplayPath(item, relativePath),
    status,
    statusLabel: transferStatusLabel(status),
    baseline: baseline || { exists: false },
    usb: usb || { exists: false },
    local: local || { exists: false }
  };
}

function compareTransferFileItem(item, packageFolderPath, manifest) {
  const usbPath = pathFromPortable(packageFolderPath, item.packagePath);
  const localSourcePath = localSourcePathForTransferItem(item, manifest);
  const localRootExists = fs.existsSync(localSourcePath);
  return [compareTransferFileEntry(
    item,
    "",
    item.baseline,
    fileSnapshot(usbPath),
    fileSnapshot(localSourcePath),
    { localRootExists }
  )];
}

function compareTransferDirectoryItem(item, packageFolderPath, manifest) {
  const usbPath = pathFromPortable(packageFolderPath, item.packagePath);
  const localSourcePath = localSourcePathForTransferItem(item, manifest);
  const localRootExists = directoryExists(localSourcePath);
  const baselineMap = snapshotByRelativePath(item.baseline);
  const usbMap = snapshotByRelativePath(directorySnapshot(usbPath));
  const localSnapshot = Array.isArray(item.managedRelativePaths)
    ? subsetDirectorySnapshot(localSourcePath, item.managedRelativePaths)
    : directorySnapshot(localSourcePath);
  const localMap = snapshotByRelativePath(localSnapshot);
  const relativePaths = [...new Set([
    ...baselineMap.keys(),
    ...usbMap.keys(),
    ...localMap.keys(),
    ...(item.managedRelativePaths || []).map(relativePath => portablePath(relativePath))
  ])].sort((left, right) => left.localeCompare(right));

  return relativePaths.map(relativePath => compareTransferFileEntry(
    item,
    relativePath,
    baselineMap.get(relativePath),
    usbMap.get(relativePath),
    localMap.get(relativePath),
    { localRootExists }
  ));
}

function summarizeTransferFileEntries(entries) {
  const groups = {
    usbAdded: [],
    localAdded: [],
    safeUpdates: [],
    localOnlyChanges: [],
    conflicts: [],
    alreadyMatching: [],
    usbDeleted: [],
    localDeleted: [],
    localMissing: [],
    unchanged: []
  };

  entries.forEach(entry => {
    if (entry.status === "usb-added") groups.usbAdded.push(entry);
    else if (entry.status === "local-added") groups.localAdded.push(entry);
    else if (entry.status === "safe-update") groups.safeUpdates.push(entry);
    else if (entry.status === "local-only-change") groups.localOnlyChanges.push(entry);
    else if (entry.status === "conflict") groups.conflicts.push(entry);
    else if (entry.status === "already-matching") groups.alreadyMatching.push(entry);
    else if (entry.status === "usb-deleted") groups.usbDeleted.push(entry);
    else if (entry.status === "local-deleted") groups.localDeleted.push(entry);
    else if (entry.status === "local-missing") groups.localMissing.push(entry);
    else groups.unchanged.push(entry);
  });

  return {
    counts: Object.fromEntries(Object.entries(groups).map(([key, values]) => [key, values.length])),
    ...groups
  };
}

function createUsbTransferPackage(payload, destinationRootPath) {
  const destinationRoot = path.resolve(destinationRootPath);
  if (!directoryExists(destinationRoot)) fs.mkdirSync(destinationRoot, { recursive: true });

  const sourceInfo = historySourceInfo({
    filePath: payload.filePath,
    fileName: payload.fileName
  });
  const normalized = writeAll(payload.state || readState(), {
    filePath: sourceInfo.filePath,
    fileName: sourceInfo.fileName,
    allowLinkedTextFileFailure: true
  });
  const linkedTextPath = readTextFileLink();
  const storyTextPath = sourceInfo.filePath || linkedTextPath || EXPORT_FILE;
  const backupFolderPath = existingVersionHistoryFolderPath();
  const packageFolderPath = path.join(destinationRoot, usbTransferPackageFolderName(sourceInfo.fileName));

  assertTransferDestinationSafe(packageFolderPath, [backupFolderPath]);
  fs.mkdirSync(packageFolderPath, { recursive: true });

  const items = [];
  const storyPackagePath = portablePath(USB_TRANSFER_FILES_DIR, "story", path.basename(storyTextPath));
  const packageStoryTextPath = pathFromPortable(packageFolderPath, storyPackagePath);
  writeAtomicText(packageStoryTextPath, formatExport(normalized));
  items.push({
    id: "story-text",
    role: "storyText",
    kind: "file",
    label: path.basename(storyTextPath),
    sourcePath: path.resolve(storyTextPath),
    packagePath: storyPackagePath,
    baseline: fileSnapshot(storyTextPath)
  });

  let backupPackagePath = "";
  if (backupFolderPath) {
    const managedRelativePaths = relevantBackupRelativePaths(backupFolderPath, {
      filePath: storyTextPath,
      fileName: sourceInfo.fileName
    });
    if (managedRelativePaths.length) {
      backupPackagePath = portablePath(USB_TRANSFER_FILES_DIR, "backup");
      copyDirectorySubsetToPackage(
        backupFolderPath,
        pathFromPortable(packageFolderPath, backupPackagePath),
        managedRelativePaths
      );
      items.push({
        id: "backup-folder",
        role: "backupFolder",
        kind: "directory",
        label: path.basename(backupFolderPath),
        sourcePath: path.resolve(backupFolderPath),
        packagePath: backupPackagePath,
        managedRelativePaths,
        baseline: subsetDirectorySnapshot(backupFolderPath, managedRelativePaths)
      });
    }
  }

  const manifest = {
    version: 1,
    createdAt: nowIso(),
    appBuild: SERVER_BUILD,
    computerName: os.hostname(),
    source: {
      fileName: sourceInfo.fileName,
      filePath: storyTextPath ? path.resolve(storyTextPath) : null,
      backupFolderPath: backupFolderPath ? path.resolve(backupFolderPath) : null
    },
    items,
    baselineState: normalizeState(normalized),
    storySummary: storySummaryFromState(normalized, {
      filePath: storyTextPath,
      fileName: sourceInfo.fileName
    })
  };

  const manifestPath = path.join(packageFolderPath, USB_TRANSFER_MANIFEST_FILE);
  writeAtomicText(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);

  return {
    ok: true,
    packageFolderPath,
    manifestPath,
    manifest,
    storyTextPath: pathFromPortable(packageFolderPath, storyPackagePath),
    backupFolderPath: backupPackagePath ? pathFromPortable(packageFolderPath, backupPackagePath) : null
  };
}

function findUsbTransferManifestPath(folderPath) {
  const root = path.resolve(folderPath);
  const direct = path.join(root, USB_TRANSFER_MANIFEST_FILE);
  if (fs.existsSync(direct)) return direct;

  try {
    const entries = fs.readdirSync(root, { withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      const candidate = path.join(root, entry.name, USB_TRANSFER_MANIFEST_FILE);
      if (fs.existsSync(candidate)) return candidate;
    }
  } catch {
    // The caller will report the missing manifest below.
  }

  return null;
}

function readUsbTransferManifest(folderPath) {
  const manifestPath = findUsbTransferManifestPath(folderPath);
  if (!manifestPath) throw new Error("No DraftDiff transfer manifest was found in that folder.");
  const parsed = parseJsonFile(manifestPath);
  if (!parsed || parsed.version !== 1 || !Array.isArray(parsed.items)) {
    throw new Error("DraftDiff transfer manifest is invalid.");
  }
  return {
    manifestPath,
    packageFolderPath: path.dirname(manifestPath),
    manifest: parsed
  };
}

function reviewUsbTransferFolder(folderPath) {
  const { manifestPath, packageFolderPath, manifest } = readUsbTransferManifest(folderPath);
  const entries = manifest.items.flatMap(item => (
    item.kind === "directory"
      ? compareTransferDirectoryItem(item, packageFolderPath, manifest)
      : compareTransferFileItem(item, packageFolderPath, manifest)
  ));

  const storyItem = manifest.items.find(item => item.role === "storyText");
  const backupItem = manifest.items.find(item => item.role === "backupFolder");
  const usbStorySummary = storyItem
    ? storySummaryFromTransferFiles(
        pathFromPortable(packageFolderPath, storyItem.packagePath),
        backupItem ? pathFromPortable(packageFolderPath, backupItem.packagePath) : ""
      )
    : null;

  const review = {
    ok: true,
    manifestPath,
    packageFolderPath,
    manifest,
    files: summarizeTransferFileEntries(entries),
    story: compareStorySummaries(manifest.storySummary, usbStorySummary)
  };
  review.merge = createUsbTransferMergeReview(review);
  return review;
}

function importBackupRootForManifest(manifest) {
  const sourceName = manifest?.source?.fileName || "draft-history";
  const primaryRoot = path.join(
    DATA_DIR,
    "usb-transfer-import-backups",
    `${safeFolderName(safeHistoryBaseName(sourceName), "draft-history")}-${usbTransferTimestamp()}`
  );
  const primaryInsideSource = (manifest.items || []).some(item => (
    item.kind === "directory" && item.sourcePath && pathIsInsideFolder(primaryRoot, item.sourcePath)
  ));

  if (!primaryInsideSource) return primaryRoot;

  return path.join(
    os.tmpdir(),
    "draftdiff-import-backups",
    `${safeFolderName(safeHistoryBaseName(sourceName), "draft-history")}-${usbTransferTimestamp()}`
  );
}

function backupCurrentTransferItem(item, backupRootPath, manifest) {
  const sourcePath = localSourcePathForTransferItem(item, manifest);
  const targetPath = path.join(backupRootPath, "current", safeFolderName(item.id || item.role || "item"));
  const snapshot = item.kind === "directory" && Array.isArray(item.managedRelativePaths)
    ? subsetDirectorySnapshot(sourcePath, item.managedRelativePaths)
    : item.kind === "directory"
      ? directorySnapshot(sourcePath)
      : fileSnapshot(sourcePath);

  if (item.kind === "directory") {
    if (directoryExists(sourcePath)) {
      if (Array.isArray(item.managedRelativePaths)) {
        copyDirectorySubsetToPackage(sourcePath, targetPath, item.managedRelativePaths);
      } else {
        copyDirectoryToPackage(sourcePath, targetPath);
      }
    }
  } else if (snapshot.exists) {
    copyFileToPackage(sourcePath, path.join(targetPath, path.basename(sourcePath)));
  }

  return {
    itemId: item.id,
    role: item.role,
    kind: item.kind,
    sourcePath,
    backupPath: snapshot.exists || snapshot.files?.length ? targetPath : "",
    snapshot
  };
}

function createUsbTransferImportBackup(review) {
  const backupRootPath = importBackupRootForManifest(review.manifest);
  fs.mkdirSync(backupRootPath, { recursive: true });
  const items = review.manifest.items.map(item => backupCurrentTransferItem(item, backupRootPath, review.manifest));
  writeAtomicText(path.join(backupRootPath, "transfer-manifest.json"), `${JSON.stringify(review.manifest, null, 2)}\n`);
  writeAtomicText(path.join(backupRootPath, "import-review.json"), `${JSON.stringify({
    createdAt: nowIso(),
    packageFolderPath: review.packageFolderPath,
    files: review.files,
    story: review.story,
    items
  }, null, 2)}\n`);

  return {
    backupFolderPath: backupRootPath,
    items
  };
}

function validateTransferPackageItems(manifest, packageFolderPath) {
  (manifest.items || []).forEach(item => {
    const packagePath = pathFromPortable(packageFolderPath, item.packagePath);
    if (item.kind === "directory") {
      if (!directoryExists(packagePath)) throw new Error(`Transfer package folder is missing: ${item.packagePath}`);
      return;
    }

    const snapshot = fileSnapshot(packagePath);
    if (!snapshot.exists) throw new Error(`Transfer package file is missing: ${item.packagePath}`);
  });
}

function applyTransferItem(item, packageFolderPath, manifest) {
  const sourcePath = localSourcePathForTransferItem(item, manifest);
  const packagePath = pathFromPortable(packageFolderPath, item.packagePath);
  if (!sourcePath) throw new Error(`Transfer item has no source path: ${item.id || item.role || "item"}`);

  if (item.kind === "directory") {
    if (Array.isArray(item.managedRelativePaths)) {
      fs.mkdirSync(sourcePath, { recursive: true });
      item.managedRelativePaths.forEach(relativePath => {
        const packageFilePath = pathFromPortable(packagePath, relativePath);
        const sourceFilePath = pathFromPortable(sourcePath, relativePath);
        if (fs.existsSync(packageFilePath) && fs.statSync(packageFilePath).isFile()) {
          copyFileToPackage(packageFilePath, sourceFilePath);
        } else {
          fs.rmSync(sourceFilePath, { force: true });
        }
      });
      return;
    }

    fs.rmSync(sourcePath, { recursive: true, force: true });
    fs.mkdirSync(path.dirname(sourcePath), { recursive: true });
    fs.cpSync(packagePath, sourcePath, { recursive: true });
    return;
  }

  copyFileToPackage(packagePath, sourcePath);
}

function transferStoryItem(review) {
  return review.manifest.items.find(item => item.role === "storyText") || null;
}

function transferBackupItem(review) {
  return review.manifest.items.find(item => item.role === "backupFolder") || null;
}

function transferStoryPackagePath(review) {
  const storyItem = transferStoryItem(review);
  return storyItem ? pathFromPortable(review.packageFolderPath, storyItem.packagePath) : "";
}

function transferBackupPackagePath(review) {
  const backupItem = transferBackupItem(review);
  return backupItem ? pathFromPortable(review.packageFolderPath, backupItem.packagePath) : "";
}

function baselineStateFromManifest(manifest) {
  if (!manifest?.baselineState) return null;

  try {
    return normalizeState(manifest.baselineState);
  } catch {
    return null;
  }
}

function stateWithVersionHistoryPayload(state, fileName, backupFolderPath) {
  const normalized = normalizeState(state);
  const payload = findVersionHistoryPayloadForText(fileName, backupFolderPath);
  if (payload) applyVersionHistoryPayloadToState(normalized, payload);
  return normalizeState(normalized);
}

function transferPackageState(review, baselineState = null) {
  const storyPath = transferStoryPackagePath(review);
  if (!storyPath || !fs.existsSync(storyPath)) throw new Error("Transfer package story file is missing.");

  const fileName = review.manifest?.source?.fileName || path.basename(storyPath);
  const parsed = stateFromExportText(fs.readFileSync(storyPath, "utf8"), baselineState);
  return stateWithVersionHistoryPayload(parsed, fileName, transferBackupPackagePath(review));
}

function localTransferState(review, baselineState = null) {
  const storyItem = transferStoryItem(review);
  const backupItem = transferBackupItem(review);
  const storyPath = storyItem ? localSourcePathForTransferItem(storyItem, review.manifest) : "";
  const fileName = storyPath ? path.basename(storyPath) : review.manifest?.source?.fileName || "draft-history.txt";
  const currentState = readState();
  const currentSnapshot = storyPath ? fileSnapshot(storyPath) : { exists: false };
  const storyFileChanged = storyPath && currentSnapshot.exists && fileSnapshotChanged(storyItem?.baseline, currentSnapshot);

  if (storyPath && !currentSnapshot.exists && baselineState) return normalizeState(baselineState);
  if (!storyFileChanged) return currentState;

  try {
    const parsed = stateFromExportText(fs.readFileSync(storyPath, "utf8"), currentState, {
      changedAt: fileMtimeIso(storyPath)
    });
    const backupPath = backupItem ? localSourcePathForTransferItem(backupItem, review.manifest) : existingVersionHistoryFolderPath();
    return stateWithVersionHistoryPayload(parsed, fileName, backupPath || existingVersionHistoryFolderPath());
  } catch {
    return currentState;
  }
}

function pageCurrentSignature(page, fallbackTitle) {
  if (!page) return "";
  return versionHistorySignature(currentPageHistorySnapshot(page, fallbackTitle));
}

function pageChangedFromBase(basePage, page, fallbackTitle) {
  if (!basePage && !page) return false;
  if (!basePage || !page) return true;
  return pageCurrentSignature(basePage, fallbackTitle) !== pageCurrentSignature(page, fallbackTitle);
}

function pageCurrentTime(page, fallbackTitle) {
  if (!page) return null;

  const currentSignature = pageCurrentSignature(page, fallbackTitle);
  const times = [
    Date.parse(page.updatedAt || ""),
    Date.parse(page.createdAt || "")
  ].filter(time => !Number.isNaN(time));

  (Array.isArray(page.versionHistory) ? page.versionHistory : []).forEach(version => {
    if (versionHistorySignature(version) !== currentSignature) return;
    const time = versionHistoryTime(version);
    if (time !== null) times.push(time);
  });

  return times.length ? Math.max(...times) : null;
}

function pageCurrentIso(page, fallbackTitle) {
  const time = pageCurrentTime(page, fallbackTitle);
  return time === null ? "" : new Date(time).toISOString();
}

function clonePage(page) {
  return page ? JSON.parse(JSON.stringify(page)) : null;
}

function earliestIsoDate(...values) {
  const times = values
    .map(value => Date.parse(value || ""))
    .filter(time => !Number.isNaN(time));
  return times.length ? new Date(Math.min(...times)).toISOString() : nowIso();
}

function mergeHistoryEntries(histories) {
  const merged = [];
  const seenIds = new Set();
  const seenSignatures = new Set();

  histories.flat().forEach(entry => {
    if (!entry || typeof entry !== "object") return;
    const idValue = asText(entry.id);
    const signature = versionHistorySignature(entry);
    if (idValue && seenIds.has(idValue)) return;
    if (seenSignatures.has(signature)) return;
    if (idValue) seenIds.add(idValue);
    seenSignatures.add(signature);
    merged.push(entry);
  });

  return sortVersionHistoryByCreatedAt(merged);
}

function historyWithCurrentPage(page, fallbackTitle) {
  if (!page) return [];
  const normalized = normalizePageVersionHistory(page.versionHistory, page, fallbackTitle);
  return addCurrentPageToHistoryIfMissing(normalized, page, fallbackTitle);
}

function chooseMergedPageSource(basePage, localPage, usbPage, fallbackTitle) {
  if (localPage && !usbPage) return "local";
  if (!localPage && usbPage) return "usb";
  if (!localPage && !usbPage) return "";

  const localChanged = pageChangedFromBase(basePage, localPage, fallbackTitle);
  const usbChanged = pageChangedFromBase(basePage, usbPage, fallbackTitle);
  if (usbChanged && !localChanged) return "usb";
  if (localChanged && !usbChanged) return "local";
  if (!localChanged && !usbChanged) return "local";

  const localTime = pageCurrentTime(localPage, fallbackTitle);
  const usbTime = pageCurrentTime(usbPage, fallbackTitle);
  if (usbTime !== null && localTime !== null) return usbTime > localTime ? "usb" : "local";
  if (usbTime !== null) return "usb";
  return "local";
}

function mergeVersionedPage(basePage, localPage, usbPage, fallbackTitle, options = {}) {
  const source = chooseMergedPageSource(basePage, localPage, usbPage, fallbackTitle);
  const chosen = source === "usb" ? usbPage : localPage || usbPage || basePage;
  if (!chosen) return null;

  const page = clonePage(chosen);
  const identityPage = localPage || basePage || usbPage || chosen;
  page.id = options.fixedId || identityPage.id || chosen.id || id("page");
  page.createdAt = earliestIsoDate(localPage?.createdAt, usbPage?.createdAt, basePage?.createdAt, chosen.createdAt);
  page.updatedAt = chosen.updatedAt || chosen.createdAt || nowIso();
  page.versionHistory = mergeHistoryEntries([
    historyWithCurrentPage(basePage, fallbackTitle),
    historyWithCurrentPage(localPage, fallbackTitle),
    historyWithCurrentPage(usbPage, fallbackTitle),
    historyWithCurrentPage(chosen, fallbackTitle)
  ]);

  const normalizedPage = normalizePage(page, {
    id: page.id,
    title: fallbackTitle,
    createdAt: page.createdAt,
    updatedAt: page.updatedAt,
    content: ""
  });
  normalizedPage.versionHistory = page.versionHistory;

  return {
    page: normalizedPage,
    source
  };
}

function mergePlainPage(basePage, localPage, usbPage, fallbackTitle, options = {}) {
  const source = chooseMergedPageSource(basePage, localPage, usbPage, fallbackTitle);
  const chosen = source === "usb" ? usbPage : localPage || usbPage || basePage;
  if (!chosen) return null;

  const page = clonePage(chosen);
  const identityPage = localPage || basePage || usbPage || chosen;
  page.id = options.fixedId || identityPage.id || chosen.id || id("page");
  page.createdAt = earliestIsoDate(localPage?.createdAt, usbPage?.createdAt, basePage?.createdAt, chosen.createdAt);
  page.updatedAt = chosen.updatedAt || chosen.createdAt || nowIso();
  return normalizePage(page, {
    id: page.id,
    title: fallbackTitle,
    createdAt: page.createdAt,
    updatedAt: page.updatedAt,
    content: ""
  });
}

function mergeDraftAtIndex(baseDraft, localDraft, usbDraft, index, summary) {
  if (!baseDraft && !localDraft && !usbDraft) return null;

  const fallbackTitle = localDraft?.title || usbDraft?.title || baseDraft?.title || `Draft ${index + 1}`;
  const mergedDraft = mergeVersionedPage(baseDraft, localDraft, usbDraft, fallbackTitle);
  if (!mergedDraft?.page) return null;

  const draft = mergedDraft.page;
  draft.id = localDraft?.id || baseDraft?.id || usbDraft?.id || draft.id || id("draft");
  draft.notes = mergePlainPage(
    baseDraft?.notes,
    localDraft?.notes,
    usbDraft?.notes,
    `${draft.title || fallbackTitle} Notes`,
    { fixedId: localDraft?.notes?.id || baseDraft?.notes?.id || usbDraft?.notes?.id || id("notes") }
  ) || {
    id: localDraft?.notes?.id || baseDraft?.notes?.id || usbDraft?.notes?.id || id("notes"),
    title: `${draft.title || fallbackTitle} Notes`,
    createdAt: draft.createdAt,
    updatedAt: draft.updatedAt,
    content: "",
    contentHtml: "",
    format: { ...normalizeFormat(draft.format || {}) }
  };
  draft.notes.title = `${draft.title || fallbackTitle} Notes`;

  if (mergedDraft.source === "usb") summary.currentFromUsb.push(index + 1);
  if (mergedDraft.source === "local") summary.currentFromLocal.push(index + 1);
  if (!localDraft && usbDraft) summary.addedFromUsb.push(index + 1);
  if (localDraft && !usbDraft && !baseDraft) summary.addedFromLocal.push(index + 1);

  const localChanged = pageChangedFromBase(baseDraft, localDraft, fallbackTitle);
  const usbChanged = pageChangedFromBase(baseDraft, usbDraft, fallbackTitle);
  if (localDraft && usbDraft && localChanged && usbChanged && pageCurrentSignature(localDraft, fallbackTitle) !== pageCurrentSignature(usbDraft, fallbackTitle)) {
    summary.conflictedDrafts.push(index + 1);
    if (mergedDraft.source === "usb") summary.localDraftsArchived.push(index + 1);
    if (mergedDraft.source === "local") summary.usbDraftsArchived.push(index + 1);
  }

  return draft;
}

function mergeUsbTransferStates(baselineState, localState, usbState) {
  const base = baselineState ? normalizeState(baselineState) : null;
  const local = localState ? normalizeState(localState) : null;
  const usb = usbState ? normalizeState(usbState) : null;
  const source = local || usb || base || defaultState();
  const summary = {
    currentFromUsb: [],
    currentFromLocal: [],
    addedFromUsb: [],
    addedFromLocal: [],
    conflictedDrafts: [],
    localDraftsArchived: [],
    usbDraftsArchived: []
  };

  const projectNotes = mergeVersionedPage(
    base?.initialNotes,
    local?.initialNotes,
    usb?.initialNotes,
    PROJECT_NOTES_TITLE,
    { fixedId: "initial-notes" }
  );
  if (projectNotes?.source === "usb") summary.projectNotesCurrent = "usb";
  if (projectNotes?.source === "local") summary.projectNotesCurrent = "local";

  const maxDrafts = Math.max(
    base?.drafts?.length || 0,
    local?.drafts?.length || 0,
    usb?.drafts?.length || 0
  );
  const drafts = [];
  for (let index = 0; index < maxDrafts; index += 1) {
    const draft = mergeDraftAtIndex(
      base?.drafts?.[index] || null,
      local?.drafts?.[index] || null,
      usb?.drafts?.[index] || null,
      index,
      summary
    );
    if (draft) drafts.push(draft);
  }

  const merged = normalizeState({
    version: 1,
    formatDefaultVersion: FORMAT_DEFAULT_VERSION,
    defaultFormat: currentDefaultFormat(source),
    createdAt: source.createdAt || nowIso(),
    updatedAt: nowIso(),
    viewState: local?.viewState || source.viewState || null,
    initialNotes: projectNotes?.page || source.initialNotes || defaultState().initialNotes,
    drafts: drafts.length ? drafts : source.drafts
  });

  return { state: merged, summary };
}

function mergeUsbTransferPackage(review) {
  const baselineState = baselineStateFromManifest(review.manifest);
  const localState = localTransferState(review, baselineState);
  const usbState = transferPackageState(review, baselineState);
  return mergeUsbTransferStates(baselineState, localState, usbState);
}

function pageReviewSignature(page, fallbackTitle) {
  if (!page) return "";

  return JSON.stringify({
    current: pageCurrentSignature(page, fallbackTitle),
    history: historyWithCurrentPage(page, fallbackTitle)
      .map(version => versionHistorySignature(version))
      .sort((left, right) => left.localeCompare(right))
  });
}

function pageChangedFromBaseForReview(basePage, page, fallbackTitle) {
  if (!basePage && !page) return false;
  if (!basePage || !page) return true;
  return pageReviewSignature(basePage, fallbackTitle) !== pageReviewSignature(page, fallbackTitle);
}

function pageReviewWordCount(page) {
  return wordCountForText(pagePlainText(page));
}

function createMergeReviewEntry(type, number, basePage, localPage, usbPage, fallbackTitle) {
  const localChanged = pageChangedFromBaseForReview(basePage, localPage, fallbackTitle);
  const usbChanged = pageChangedFromBaseForReview(basePage, usbPage, fallbackTitle);
  if (!localChanged && !usbChanged) return null;

  const localCurrentSignature = pageCurrentSignature(localPage, fallbackTitle);
  const usbCurrentSignature = pageCurrentSignature(usbPage, fallbackTitle);
  const currentSource = chooseMergedPageSource(basePage, localPage, usbPage, fallbackTitle);
  const bothChanged = localChanged && usbChanged;
  const baseCurrentAt = pageCurrentIso(basePage, fallbackTitle);
  const localCurrentAt = pageCurrentIso(localPage, fallbackTitle);
  const usbCurrentAt = pageCurrentIso(usbPage, fallbackTitle);

  return {
    type,
    number,
    title: fallbackTitle,
    localChanged,
    usbChanged,
    bothChanged,
    conflict: bothChanged && Boolean(localCurrentSignature && usbCurrentSignature && localCurrentSignature !== usbCurrentSignature),
    currentSource,
    baseCurrentAt,
    localCurrentAt,
    usbCurrentAt,
    baseWordCount: pageReviewWordCount(basePage),
    localWordCount: pageReviewWordCount(localPage),
    usbWordCount: pageReviewWordCount(usbPage)
  };
}

function createUsbTransferMergeReview(review) {
  const empty = {
    status: "unknown",
    counts: {
      usbOnly: 0,
      localOnly: 0,
      bothChanged: 0,
      conflicts: 0,
      unchanged: 0
    },
    usbOnly: [],
    localOnly: [],
    bothChanged: []
  };
  const baselineState = baselineStateFromManifest(review.manifest);
  if (!baselineState) {
    return {
      ...empty,
      reason: "This transfer package was created before story-level merge review was available."
    };
  }

  try {
    const base = normalizeState(baselineState);
    const storyItem = transferStoryItem(review);
    const localStoryPath = storyItem ? localSourcePathForTransferItem(storyItem, review.manifest) : "";
    const localStoryMissing = Boolean(localStoryPath && !fileSnapshot(localStoryPath).exists);
    const local = localTransferState(review, base);
    const usb = transferPackageState(review, base);
    const entries = [];
    const projectNotesEntry = createMergeReviewEntry(
      "projectNotes",
      null,
      base.initialNotes,
      local.initialNotes,
      usb.initialNotes,
      PROJECT_NOTES_TITLE
    );
    if (projectNotesEntry) entries.push(projectNotesEntry);

    const maxDrafts = Math.max(
      base.drafts?.length || 0,
      local.drafts?.length || 0,
      usb.drafts?.length || 0
    );
    for (let index = 0; index < maxDrafts; index += 1) {
      const baseDraft = base.drafts?.[index] || null;
      const localDraft = local.drafts?.[index] || null;
      const usbDraft = usb.drafts?.[index] || null;
      const title = localDraft?.title || usbDraft?.title || baseDraft?.title || `Draft ${index + 1}`;
      const draftEntry = createMergeReviewEntry(
        "draft",
        index + 1,
        baseDraft,
        localDraft,
        usbDraft,
        title
      );
      if (draftEntry) entries.push(draftEntry);

      const notesEntry = createMergeReviewEntry(
        "draftNotes",
        index + 1,
        baseDraft?.notes,
        localDraft?.notes,
        usbDraft?.notes,
        `${title} Notes`
      );
      if (notesEntry) entries.push(notesEntry);
    }

    const usbOnly = entries.filter(entry => entry.usbChanged && !entry.localChanged);
    const localOnly = entries.filter(entry => entry.localChanged && !entry.usbChanged);
    const bothChanged = entries.filter(entry => entry.localChanged && entry.usbChanged);
    const usbChangedCount = usbOnly.length + bothChanged.length;
    const localChangedCount = localOnly.length + bothChanged.length;
    const status = !usbChangedCount && !localChangedCount
      ? "no-changes"
      : usbChangedCount && !localChangedCount
        ? "usb-only"
        : localChangedCount && !usbChangedCount
          ? "local-only"
          : "both-changed";

    return {
      status,
      localStoryMissing,
      counts: {
        usbOnly: usbOnly.length,
        localOnly: localOnly.length,
        bothChanged: bothChanged.length,
        conflicts: bothChanged.filter(entry => entry.conflict).length,
        unchanged: Math.max(0, (maxDrafts * 2) + 1 - entries.length)
      },
      usbOnly,
      localOnly,
      bothChanged
    };
  } catch (error) {
    return {
      ...empty,
      reason: error?.message || "Story-level merge review could not be prepared."
    };
  }
}

function canPrepareWritableDirectory(folderPath) {
  if (!folderPath) return false;

  try {
    fs.mkdirSync(folderPath, { recursive: true });
    fs.accessSync(folderPath, fs.constants.W_OK);
    return true;
  } catch {
    return false;
  }
}

function canPrepareWritableFile(filePath) {
  if (!filePath) return false;

  try {
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    if (fs.existsSync(filePath)) fs.accessSync(filePath, fs.constants.W_OK);
    else fs.accessSync(path.dirname(filePath), fs.constants.W_OK);
    return true;
  } catch {
    return false;
  }
}

function usbImportFallbackRoot(fileName) {
  return path.join(
    DATA_DIR,
    "usb-transfer-imports",
    `${safeFolderName(safeHistoryBaseName(fileName || "draft-history.txt"), "draft-history")}-${usbTransferTimestamp()}`
  );
}

function usbImportDestinationPaths(review) {
  const storyItem = transferStoryItem(review);
  const backupItem = transferBackupItem(review);
  const fileName = storyItem?.sourcePath
    ? path.basename(storyItem.sourcePath)
    : review.manifest?.source?.fileName || "draft-history.txt";
  const fallbackRoot = usbImportFallbackRoot(fileName);
  const fallbackStoryPath = path.join(fallbackRoot, fileName);
  const fallbackBackupPath = path.join(fallbackRoot, "DraftDiff backup");
  const preferredStoryPath = storyItem ? localSourcePathForTransferItem(storyItem, review.manifest) : "";
  const preferredBackupPath = backupItem ? localSourcePathForTransferItem(backupItem, review.manifest) : "";
  const storyPath = canPrepareWritableFile(preferredStoryPath)
    ? preferredStoryPath
    : fallbackStoryPath;
  const backupFolderPath = preferredBackupPath && canPrepareWritableDirectory(preferredBackupPath)
    ? preferredBackupPath
    : fallbackBackupPath;

  canPrepareWritableFile(storyPath);
  canPrepareWritableDirectory(backupFolderPath);

  return {
    fileName: path.basename(storyPath),
    storyPath,
    backupFolderPath,
    usedFallback: storyPath !== preferredStoryPath || backupFolderPath !== preferredBackupPath,
    preferredStoryPath,
    preferredBackupPath
  };
}

function applyUsbTransferFolder(folderPath) {
  const review = reviewUsbTransferFolder(folderPath);
  validateTransferPackageItems(review.manifest, review.packageFolderPath);
  const backup = createUsbTransferImportBackup(review);

  const { state: mergedState, summary: mergeSummary } = mergeUsbTransferPackage(review);
  const destination = usbImportDestinationPaths(review);
  const storyPath = destination.storyPath;
  const importedBackupFolderPath = destination.backupFolderPath;
  if (storyPath) writeTextFileLink(storyPath);
  if (importedBackupFolderPath) writeVersionHistoryFolderPath(importedBackupFolderPath);

  const fileName = destination.fileName;
  const savedState = writeAll(mergedState, {
    filePath: storyPath,
    fileName,
    allowLinkedTextFileFailure: true
  });
  return {
    ok: true,
    imported: true,
    backup,
    merge: mergeSummary,
    packageFolderPath: review.packageFolderPath,
    filePath: storyPath,
    fileName,
    importDestination: destination,
    text: formatExport(savedState),
    ...statePathPayload({ filePath: storyPath, fileName })
  };
}

async function chooseUsbTransferFolder(description) {
  const initialDirectory = existingDirectory(readTextFileLink() || EXPORT_FILE);
  return chooseFolderWithNativeDialog(initialDirectory, description);
}

async function exportUsbTransferFromRequestBody(body) {
  const payload = parseStatePayload(body);
  const folderPath = await chooseUsbTransferFolder("Select the USB drive or transfer folder");
  if (!folderPath) return { ok: false, cancelled: true };
  return createUsbTransferPackage(payload, folderPath);
}

async function reviewUsbTransferFromRequestBody() {
  const folderPath = await chooseUsbTransferFolder("Select the returned DraftDiff USB transfer folder");
  if (!folderPath) return { ok: false, cancelled: true };
  return reviewUsbTransferFolder(folderPath);
}

function importUsbTransferFromRequestBody(body) {
  const payload = body ? JSON.parse(body) : {};
  const folderPath = asText(payload.packageFolderPath);
  if (!folderPath) {
    throw new Error("Missing USB transfer package folder.");
  }
  return applyUsbTransferFolder(folderPath);
}

function projectRecoveryNotice(error, backupPath) {
  return {
    type: "corrupt-project-json",
    statePath: STATE_FILE,
    backupPath,
    recoveredAt: nowIso(),
    error: error?.message || String(error || "Project JSON could not be read.")
  };
}

function writeProjectRecoveryNotice(notice) {
  try {
    ensureDataDir();
    writeAtomicText(PROJECT_RECOVERY_FILE, `${JSON.stringify(notice, null, 2)}\n`);
  } catch (error) {
    console.error(error);
  }
}

function readProjectRecoveryNotice() {
  try {
    const parsed = JSON.parse(fs.readFileSync(PROJECT_RECOVERY_FILE, "utf8").replace(/^\uFEFF/, ""));
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function clearProjectRecoveryNotice() {
  try {
    fs.rmSync(PROJECT_RECOVERY_FILE, { force: true });
  } catch {}
}

function recoverCorruptProjectState(error) {
  const backup = `${STATE_FILE}.broken-${Date.now()}`;
  fs.copyFileSync(STATE_FILE, backup);
  writeProjectRecoveryNotice(projectRecoveryNotice(error, backup));
  return writeAll(defaultState());
}

function readState() {
  ensureDataDir();
  recoverPersistenceTransaction();
  if (!fs.existsSync(STATE_FILE)) {
    return writeAll(defaultState());
  }

  let parsed;
  try {
    parsed = JSON.parse(fs.readFileSync(STATE_FILE, "utf8").replace(/^\uFEFF/, ""));
  } catch (error) {
    return recoverCorruptProjectState(error);
  }

  const normalized = applyExternalVersionHistory(parsed, { filePath: readTextFileLink() || EXPORT_FILE }).state;
  writeTransactionalTextFiles([{
    filePath: EXPORT_FILE,
    content: formatExport(normalized)
  }]);
  return normalized;
}

function sendJson(res, statusCode, payload) {
  const body = JSON.stringify(payload);
  res.writeHead(statusCode, {
    "content-type": "application/json; charset=utf-8",
    "content-length": Buffer.byteLength(body)
  });
  res.end(body);
}

function hostNameFromHeader(value) {
  const text = asText(value).trim();
  if (!text) return "";

  try {
    return new URL(`http://${text}`).hostname.replace(/^\[|\]$/g, "").toLowerCase();
  } catch {
    return text.replace(/:\d+$/u, "").replace(/^\[|\]$/g, "").toLowerCase();
  }
}

function isLoopbackHost(value) {
  const host = hostNameFromHeader(value).replace(/\.$/u, "");
  return host === "localhost" || host === "127.0.0.1" || host === "::1";
}

function requestHostAllowed(req) {
  if (ALLOW_REMOTE_API) return true;
  return isLoopbackHost(req.headers.host);
}

function requestOriginAllowed(req) {
  if (ALLOW_REMOTE_API) return true;
  const origin = asText(req.headers.origin).trim();
  if (!origin) return true;

  try {
    return isLoopbackHost(new URL(origin).host);
  } catch {
    return false;
  }
}

function apiRequestAllowed(req) {
  return requestHostAllowed(req) && requestOriginAllowed(req);
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
  const relativePath = path.relative(PUBLIC_DIR, filePath);
  return relativePath && !relativePath.startsWith("..") && !path.isAbsolute(relativePath)
    ? filePath
    : null;
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
      fileName: payload.fileName,
      waitForSummary: Boolean(payload.waitForSummary),
      skipSummary: Boolean(payload.skipSummary),
      allowMissingVersionHistoryFolder: Boolean(payload.allowMissingVersionHistoryFolder),
      allowLinkedTextFileFailure: Boolean(payload.allowLinkedTextFileFailure)
    };
  }

  return {
    state: payload,
    filePath: "",
    fileName: null,
    waitForSummary: false,
    skipSummary: false,
    allowMissingVersionHistoryFolder: false,
    allowLinkedTextFileFailure: false
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
      fileName: payload.fileName,
      waitForSummary: payload.waitForSummary,
      skipSummary: payload.skipSummary,
      allowMissingVersionHistoryFolder: Boolean(payload.allowMissingVersionHistoryFolder),
      allowLinkedTextFileFailure: Boolean(payload.allowLinkedTextFileFailure)
    });
  }

  return writeAllWithBackup(readState());
}

function writeStateFromRequestBody(body) {
  if (body) {
    const payload = parseStatePayload(body);
    return writeAll(payload.state, {
      filePath: payload.filePath,
      fileName: payload.fileName,
      allowMissingVersionHistoryFolder: true,
      allowLinkedTextFileFailure: true,
      skipVersionHistory: true,
      embedVersionHistory: true
    });
  }

  return writeAll(readState(), {
    allowMissingVersionHistoryFolder: true,
    allowLinkedTextFileFailure: true,
    skipVersionHistory: true,
    embedVersionHistory: true
  });
}

function saveStateFromRequestBody(body) {
  const payload = parseStatePayload(body);
  const state = writeAll(payload.state, {
    filePath: payload.filePath,
    fileName: payload.fileName,
    allowLinkedTextFileFailure: true
  });
  return {
    ok: true,
    state,
    ...statePathPayload({
      filePath: payload.filePath,
      fileName: payload.fileName
    })
  };
}

function openedTextFilePayload(filePath) {
  const resolvedPath = path.resolve(filePath);
  const fileName = path.basename(resolvedPath);
  writeTextFileLink(resolvedPath);
  return {
    ok: true,
    filePath: resolvedPath,
    fileName,
    text: fs.readFileSync(resolvedPath, "utf8"),
    storedState: readTextFileState(resolvedPath),
    ...statePathPayload({ filePath: resolvedPath, fileName })
  };
}

async function openTextFileFromDialog() {
  const filePath = await chooseTextFileToOpen();
  return filePath
    ? openedTextFilePayload(filePath)
    : { ok: false, cancelled: true };
}

function saveTextFileToPath(filePath, body) {
  const payload = parseStatePayload(body);
  const normalized = normalizeState(payload.state, { touch: true });
  const resolvedPath = path.resolve(filePath);
  writeTextFileLink(resolvedPath);
  const state = writeAll(normalized, {
    filePath: resolvedPath,
    fileName: path.basename(resolvedPath)
  });
  return {
    ok: true,
    state,
    filePath: resolvedPath,
    fileName: path.basename(resolvedPath),
    ...statePathPayload({ filePath: resolvedPath, fileName: path.basename(resolvedPath) })
  };
}

function recentTextFilesPayload() {
  return {
    ok: true,
    files: recentTextFiles()
  };
}

function openRecentTextFileFromRequestBody(body) {
  const payload = body ? JSON.parse(body) : {};
  const filePath = asText(payload.filePath);

  if (!filePath || !isRecentTextFile(filePath)) {
    return { ok: false, error: "Recent file not found", status: 404 };
  }

  const resolvedPath = path.resolve(filePath);
  try {
    if (!fs.existsSync(resolvedPath) || !fs.statSync(resolvedPath).isFile()) {
      return { ok: false, error: "Recent file no longer exists", status: 404 };
    }
  } catch {
    return { ok: false, error: "Recent file no longer exists", status: 404 };
  }

  return openedTextFilePayload(resolvedPath);
}

function backupProjectFromRequestBody(body) {
  const result = writeBackupFromRequestBody(body);
  return { ok: true, backup: result?.backup || null };
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
  if (Array.isArray(payload.versionHistory)) {
    page.versionHistory = mergePageVersionHistories(
      page.versionHistory,
      payload.versionHistory,
      page,
      parsed.type === "story" ? PROJECT_NOTES_TITLE : page.title || "Untitled draft"
    );
  }
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

function runOsascript(scriptLines, args = []) {
  return new Promise((resolve, reject) => {
    const commandArgs = scriptLines.flatMap(line => ["-e", line]).concat(args);
    const child = spawn("osascript", commandArgs);

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
        return;
      }

      const message = stderr.trim();
      if (/user canceled/i.test(message) || /-128/.test(message)) {
        resolve("");
        return;
      }

      reject(new Error(message || `osascript exited with code ${code}.`));
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

function macOpenFileDialogScript() {
  return [
    "on run argv",
    "set initialPath to item 1 of argv",
    "set promptText to item 2 of argv",
    "set initialFolder to POSIX file initialPath as alias",
    "set selectedFile to choose file with prompt promptText default location initialFolder",
    "return POSIX path of selectedFile",
    "end run"
  ];
}

function macSaveFileDialogScript() {
  return [
    "on run argv",
    "set initialPath to item 1 of argv",
    "set initialName to item 2 of argv",
    "set promptText to item 3 of argv",
    "set initialFolder to POSIX file initialPath as alias",
    "set selectedFile to choose file name with prompt promptText default name initialName default location initialFolder",
    "return POSIX path of selectedFile",
    "end run"
  ];
}

async function chooseTextFileWithElectronDialog(dialogType, initialDirectory, initialFileName = "") {
  if (!process.versions?.electron) return null;

  let electron = null;
  try {
    electron = require("electron");
  } catch {
    return null;
  }

  if (dialogType === "save") {
    if (!electron?.dialog?.showSaveDialog) return null;
    const result = await electron.dialog.showSaveDialog({
      title: "Save text file",
      defaultPath: path.join(initialDirectory, initialFileName || "draft-history.txt"),
      filters: [
        { name: "Text files", extensions: ["txt"] },
        { name: "All files", extensions: ["*"] }
      ]
    });
    if (result.canceled) return "";
    return result.filePath || "";
  }

  if (!electron?.dialog?.showOpenDialog) return null;
  const result = await electron.dialog.showOpenDialog({
    title: "Open text file",
    defaultPath: initialDirectory,
    filters: [
      { name: "Text files", extensions: ["txt"] },
      { name: "All files", extensions: ["*"] }
    ],
    properties: ["openFile"]
  });

  if (result.canceled) return "";
  return result.filePaths?.[0] || "";
}

async function chooseTextFileWithNativeDialog(dialogType, initialDirectory, initialFileName = "") {
  if (process.platform === "win32") {
    return runPowerShell(windowsFileDialogCommand(dialogType, initialDirectory, initialFileName));
  }

  if (process.platform === "darwin") {
    return dialogType === "save"
      ? runOsascript(macSaveFileDialogScript(), [initialDirectory, initialFileName, "Save text file"])
      : runOsascript(macOpenFileDialogScript(), [initialDirectory, "Open text file"]);
  }

  if (process.platform === "linux") {
    const selectedFile = await chooseTextFileWithElectronDialog(dialogType, initialDirectory, initialFileName);
    if (selectedFile !== null) return selectedFile;
  }

  throw new Error("Text file selection is only available in the desktop app on Windows and macOS right now.");
}

async function chooseTextFileToOpen() {
  const initialDirectory = existingDirectory(readTextFileLink() || EXPORT_FILE);
  return chooseTextFileWithNativeDialog("open", initialDirectory);
}

async function chooseTextFileToSave(suggestedName) {
  const linkedPath = readTextFileLink();
  const initialDirectory = existingDirectory(linkedPath || EXPORT_FILE);
  const initialFileName = path.basename(linkedPath || suggestedName || EXPORT_FILE);
  return chooseTextFileWithNativeDialog("save", initialDirectory, initialFileName);
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

function macFolderDialogScript() {
  return [
    "on run argv",
    "set initialPath to item 1 of argv",
    "set promptText to item 2 of argv",
    "set initialFolder to POSIX file initialPath as alias",
    "set selectedFolder to choose folder with prompt promptText default location initialFolder",
    "return POSIX path of selectedFolder",
    "end run"
  ];
}

async function chooseFolderWithElectronDialog(initialDirectory, description) {
  if (!process.versions?.electron) return null;

  let electron = null;
  try {
    electron = require("electron");
  } catch {
    return null;
  }

  if (!electron?.dialog?.showOpenDialog) return null;
  const result = await electron.dialog.showOpenDialog({
    title: description || "Select folder",
    defaultPath: initialDirectory,
    properties: ["openDirectory", "createDirectory"]
  });

  if (result.canceled) return "";
  return result.filePaths?.[0] || "";
}

async function chooseFolderWithNativeDialog(initialDirectory, description) {
  if (process.platform === "win32") {
    return runPowerShell(windowsFolderDialogCommand(initialDirectory, description));
  }

  if (process.platform === "darwin") {
    return runOsascript(macFolderDialogScript(), [initialDirectory, description]);
  }

  if (process.platform === "linux") {
    const selectedFolder = await chooseFolderWithElectronDialog(initialDirectory, description);
    if (selectedFolder !== null) return selectedFolder;
  }

  throw new Error("Folder selection is only available in the desktop app on Windows and macOS right now.");
}

async function chooseVersionHistoryFolder() {
  const initialDirectory = readVersionHistoryFolderPath() || existingDirectory(readTextFileLink() || EXPORT_FILE);
  return chooseFolderWithNativeDialog(initialDirectory, "Select the backup and version history folder");
}

async function chooseBackupFolder() {
  const initialDirectory = readVersionHistoryFolderPath() || existingDirectory(readTextFileLink() || EXPORT_FILE);
  return chooseFolderWithNativeDialog(initialDirectory, "Select the backup and version history folder");
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

  if (req.method === "POST" && pathname === "/api/version-history-summary/start") {
    markClientActive();
    const body = await readBody(req);
    sendJson(res, 200, startVersionHistorySummaryJobFromRequestBody(body));
    return;
  }

  if (req.method === "GET" && pathname === "/api/version-history-summary/progress") {
    markClientActive();
    const jobId = new URL(req.url, `http://${req.headers.host || "localhost"}`).searchParams.get("id") || "";
    const payload = versionHistorySummaryJobProgress(jobId);
    sendJson(res, payload.ok ? 200 : 404, payload);
    return;
  }

  if (req.method === "GET" && pathname === "/api/state") {
    markClientActive();
    const state = readState();
    sendJson(res, 200, {
      state,
      projectRecovery: readProjectRecoveryNotice(),
      ...statePathPayload()
    });
    return;
  }

  if (req.method === "POST" && pathname === "/api/project-recovery/ack") {
    markClientActive();
    clearProjectRecoveryNotice();
    sendJson(res, 200, { ok: true });
    return;
  }

  if (req.method === "PUT" && pathname === "/api/state") {
    markClientActive();
    const body = await readBody(req);
    const payload = parseStatePayload(body);
    const state = writeAll(payload.state, {
      filePath: payload.filePath,
      fileName: payload.fileName,
      allowLinkedTextFileFailure: true
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

    const savedState = writeAll(state, {
      allowLinkedTextFileFailure: true
    });
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

    const savedState = writeAll(state, {
      allowLinkedTextFileFailure: true
    });
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
    const filePath = await chooseTextFileToSave(payload.fileName);
    if (!filePath) {
      sendJson(res, 200, { ok: false, cancelled: true });
      return;
    }

    sendJson(res, 200, saveTextFileToPath(filePath, body));
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

  if (req.method === "POST" && pathname === "/api/usb-transfer/export") {
    markClientActive();
    const body = await readBody(req);
    const result = await exportUsbTransferFromRequestBody(body);
    sendJson(res, 200, result);
    return;
  }

  if (req.method === "POST" && pathname === "/api/usb-transfer/review") {
    markClientActive();
    const result = await reviewUsbTransferFromRequestBody();
    sendJson(res, 200, result);
    return;
  }

  if (req.method === "POST" && pathname === "/api/usb-transfer/import") {
    markClientActive();
    const body = await readBody(req);
    const result = importUsbTransferFromRequestBody(body);
    sendJson(res, 200, result);
    return;
  }

  sendJson(res, 404, { error: "Not found" });
}

function createHttpServer() {
  return http.createServer(async (req, res) => {
    try {
      const { pathname } = new URL(req.url, `http://${req.headers.host || "localhost"}`);

      if (pathname.startsWith("/api/")) {
        if (!apiRequestAllowed(req)) {
          sendJson(res, 403, { error: "Forbidden" });
          return;
        }
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
    writeAllWithBackup(readState(), { skipSummary: true });
  } catch (error) {
    console.error(error);
  }
}

function startServer(options = {}) {
  const port = Number(options.port ?? PORT);
  const host = options.host ?? HOST;
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
  startServer({ port: PORT, host: HOST })
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
  backupHistoryReport,
  flushOnExit,
  shouldUseFastHistoryReport,
  startServer,
  stopServer,
  waitForCutHistoryJobs,
  backupProjectFromRequestBody,
  startVersionHistorySummaryJobFromRequestBody,
  versionHistorySummaryJobProgress,
  writeFullVersionHistorySummaryReport,
  resolveGeneratedReportPath,
  parseStatePayload,
  openedTextFilePayload,
  saveTextFileToPath,
  openTextFileFromDialog,
  recentTextFilesPayload,
  openRecentTextFileFromRequestBody,
  exportUsbTransferFromRequestBody,
  reviewUsbTransferFromRequestBody,
  importUsbTransferFromRequestBody,
  writeBackupFromRequestBody,
  saveStateFromRequestBody,
  writeStateFromRequestBody,
  writeCutHistoryReportFromFiles,
  __test: {
    STATE_FILE,
    EXPORT_FILE,
    TEXT_FILE_STATES_FILE,
    PERSISTENCE_TRANSACTION_DIR,
    readState,
    recoverPersistenceTransaction,
    writeAll,
    writeTextFileLink,
    writeVersionHistoryFolderPath,
    macOpenFileDialogScript,
    macSaveFileDialogScript,
    macFolderDialogScript,
    createUsbTransferPackage,
    reviewUsbTransferFolder,
    applyUsbTransferFolder,
    storySummaryFromTransferFiles
  }
};
