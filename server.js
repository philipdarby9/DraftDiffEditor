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
const STORY_REGISTRY_FILE = path.join(DATA_DIR, "story-registry.json");
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
const VERSION_HISTORY_SCHEMA_VERSION = 1;
const VERSION_HISTORY_RETENTION_POLICY = Object.freeze({
  newestCount: 5,
  dailyDays: 7,
  weeklyWeeks: 8,
  monthlyMonths: 12,
  safetyNewestCount: 2,
  storyByteLimit: 512 * 1024 * 1024,
  totalByteLimit: 2 * 1024 * 1024 * 1024
});
const VERSION_HISTORY_ARCHIVE_EXPIRY_POLICY = Object.freeze({
  firstRunDays: 90,
  standardRetentionDays: 30
});
const VERSION_HISTORY_ARCHIVE_POLICY_FILE = "retention-archive-policy.json";
const VERSION_HISTORY_ARCHIVE_MANIFEST_FILE = "retention-manifest.json";
const VERSION_HISTORY_ARCHIVE_PLAN_FILE = "retention-plan.json";
const VERSION_HISTORY_ARCHIVE_JOURNAL_FILE = "retention-journal.ndjson";
const VERSION_HISTORY_ARCHIVE_PIN_FILE = ".pinned";
const VERSION_HISTORY_ARCHIVE_READY_FOLDER = "Ready for manual deletion";
const VERSION_HISTORY_ARCHIVE_READY_JOURNAL_FILE = "retention-archive-manual-deletion-journal.ndjson";
const PORT = Number(process.env.PORT || 4173);
const HOST = process.env.DRAFT_DIFF_HOST || process.env.HOST || "127.0.0.1";
const ALLOW_REMOTE_API = process.env.DRAFT_DIFF_ALLOW_REMOTE === "1";
const STORY_KEY = "story";
const PROJECT_NOTES_TITLE = StateCore.PROJECT_NOTES_TITLE;
const FORMAT_DEFAULT_VERSION = StateCore.FORMAT_DEFAULT_VERSION;
const VIEW_STATE_VERSION = StateCore.VIEW_STATE_VERSION;
const LEGACY_DEFAULT_FONT_FAMILY = StateCore.LEGACY_DEFAULT_FONT_FAMILY;
const MIN_PAGE_PANE_PERCENT = StateCore.MIN_PAGE_PANE_PERCENT;
const SERVER_BUILD = "usb-baseline-review-2026-07-18";
const AUTO_EXIT_ON_IDLE = process.env.DRAFT_DIFF_AUTO_EXIT === "1";
const MAX_REQUEST_BODY_BYTES = 100 * 1024 * 1024;
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
const usbTransferReviewJobs = new Map();
const versionHistoryPathCache = new Map();
const versionHistoryRetentionJobs = new Map();
const versionHistoryRetentionPlans = new Map();
const versionHistoryArchiveExpiryPlans = new Map();
const versionHistoryRetentionMutationRoots = new Map();

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

function viewStateUpdatedAtMs(viewState) {
  const time = Date.parse(viewState?.updatedAt || "");
  return Number.isFinite(time) ? time : 0;
}

function newestViewState(left, right) {
  if (!left) return right || null;
  if (!right) return left;
  return viewStateUpdatedAtMs(right) > viewStateUpdatedAtMs(left) ? right : left;
}

function readStoredProjectStateForViewStateMerge() {
  try {
    if (!fs.existsSync(STATE_FILE)) return null;
    return parseJsonFile(STATE_FILE);
  } catch {
    return null;
  }
}

function projectViewStateMergeKey(projectState) {
  if (!projectState || typeof projectState !== "object" || Array.isArray(projectState)) return "";
  const parts = [
    asText(projectState.createdAt),
    asText(projectState.initialNotes?.id),
    asText(projectState.initialNotes?.createdAt),
    asText(projectState.drafts?.[0]?.id),
    asText(projectState.drafts?.[0]?.createdAt)
  ];
  return parts.some(Boolean) ? parts.join("|") : "";
}

function projectViewStateMergeEligible(left, right) {
  const leftKey = projectViewStateMergeKey(left);
  const rightKey = projectViewStateMergeKey(right);
  return Boolean(leftKey && rightKey && leftKey === rightKey);
}

function stateWithNewestStoredViewState(state) {
  if (!state || typeof state !== "object" || Array.isArray(state)) return state;
  const storedState = readStoredProjectStateForViewStateMerge();
  if (!projectViewStateMergeEligible(state, storedState)) return state;
  const viewState = newestViewState(state.viewState, storedState?.viewState);
  return viewState && viewState !== state.viewState ? { ...state, viewState } : state;
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

function fileExists(filePath) {
  if (!filePath) return false;

  try {
    return fs.existsSync(filePath) && fs.statSync(filePath).isFile();
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
  assertVersionHistoryRetentionRootChangeAllowed(folderPath);
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

function pathsReferToSameFile(left, right) {
  if (!left || !right) return false;

  try {
    const realpath = fs.realpathSync.native || fs.realpathSync;
    return sameHistoryPath(realpath(left), realpath(right));
  } catch {
    return sameHistoryPath(left, right);
  }
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
  const explicitRoot = normalizedRegistryPath(options.rootFolderPath);
  const folderPath = explicitRoot || (options.requireExistingRoot
    ? requireVersionHistoryFolderPath()
    : existingVersionHistoryFolderPath());
  return folderPath ? path.join(folderPath, "json") : null;
}

function legacyVersionHistoryJsonFolderPath(options = {}) {
  const folderPath = normalizedRegistryPath(options.rootFolderPath) || existingVersionHistoryFolderPath();
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
    requireExistingRoot: Boolean(options.requireExistingRoot),
    rootFolderPath: options.rootFolderPath
  });
  if (!folderPath) return null;
  const source = historySourceInfo(options);
  return path.join(folderPath, `${safeHistoryBaseName(source.fileName)}${VERSION_HISTORY_FILE_SUFFIX}`);
}

function parseVersionHistoryJson(content) {
  try {
    const parsed = JSON.parse(asText(content).replace(/^\uFEFF/, ""));
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function parseVersionHistoryFile(filePath) {
  try {
    return parseVersionHistoryJson(fs.readFileSync(filePath, "utf8"));
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
  const rootFolderPath = normalizedRegistryPath(options.rootFolderPath) || existingVersionHistoryFolderPath();
  const jsonFolderPath = versionHistoryJsonFolderPath({ rootFolderPath });
  if (!rootFolderPath || !jsonFolderPath) return null;

  const source = historySourceInfo(options);
  const expectedPath = expectedVersionHistoryFilePath({ ...source, rootFolderPath });
  if (expectedPath && fs.existsSync(expectedPath)) {
    rememberVersionHistoryFilePath(rootFolderPath, source, expectedPath);
    return expectedPath;
  }

  const cachedPath = cachedVersionHistoryFilePath(rootFolderPath, source);
  if (cachedPath) return cachedPath;

  const searchFolders = [...new Set([
    jsonFolderPath,
    legacyVersionHistoryJsonFolderPath({ rootFolderPath }),
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

function versionHistoryIdentityKey(version) {
  const createdAt = asText(version?.createdAt);
  const signature = versionHistorySignature(version);
  if (createdAt) return `created:${createdAt}\0${signature}`;

  const idValue = asText(version?.id);
  return idValue ? `id:${idValue}` : `signature:${signature}`;
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
  const seenKeys = new Set();

  const addEntries = entries => {
    entries.forEach(entry => {
      const key = versionHistoryIdentityKey(entry);
      if (seenKeys.has(key)) return;
      seenKeys.add(key);
      merged.push(entry);
    });
  };

  addEntries(existing);
  addEntries(normalizePageVersionHistory(incomingHistory, page, fallbackTitle));

  return normalizePageVersionHistory(merged, page, fallbackTitle);
}

function normalizeHistoryTitle(value) {
  return asText(value).trim().toLowerCase();
}

function draftNotesHistoryFromPayloadEntry(entry) {
  if (Array.isArray(entry?.notes?.history)) return entry.notes.history;
  if (Array.isArray(entry?.notes?.versionHistory)) return entry.notes.versionHistory;
  if (Array.isArray(entry?.notesHistory)) return entry.notesHistory;
  if (Array.isArray(entry?.draftNotesHistory)) return entry.draftNotesHistory;
  return null;
}

function versionHistoryEntryIsRetiredForDraft(entry, draft) {
  if (entry?.retired === true) return true;

  const previousCreatedAt = Date.parse(asText(entry?.createdAt));
  const incomingCreatedAt = Date.parse(asText(draft?.createdAt));
  if (
    !Number.isFinite(previousCreatedAt) ||
    !Number.isFinite(incomingCreatedAt) ||
    incomingCreatedAt <= previousCreatedAt
  ) {
    return false;
  }

  const history = historyArrayFromPayloadEntry(entry);
  const newest = latestVersionHistoryEntry(history);
  return Boolean(
    newest &&
    history.some(version => textForHistoryVersion(version).trim()) &&
    !textForHistoryVersion(newest).trim()
  );
}

function versionHistoryDraftPageKey(draft, index) {
  const idValue = asText(draft?.id || draft?.draftId);
  return idValue ? `draft-id:${idValue}` : `draft-index:${index}`;
}

function applyVersionHistoryPayloadToState(state, payload, options = {}) {
  if (!state || !payload || typeof payload !== "object") return false;
  if (options.adoptStoryId !== false && asText(payload.storyId)) state.storyId = asText(payload.storyId);

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
    if (options.promotePages !== false) {
      promotePageToNewestHistoryVersion(state.initialNotes, PROJECT_NOTES_TITLE);
    }
  }

  const incomingDrafts = Array.isArray(payload.drafts) ? payload.drafts : [];
  const byId = new Map();
  const byIndex = new Map();
  const titles = new Map();

  incomingDrafts.forEach((entry, index) => {
    const history = Array.isArray(entry?.history) ? entry.history : entry?.versionHistory;
    const notesHistory = draftNotesHistoryFromPayloadEntry(entry);
    if (!Array.isArray(history) && !Array.isArray(notesHistory)) return;

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
    const idMatchingDraft = byId.get(draft.id);
    const titleMatchingDraft = titleKey ? titles.get(titleKey) : null;
    const matchingDraft = idMatchingDraft
      || titleMatchingDraft
      || byIndex.get(index);
    const matchingDrafts = [matchingDraft];
    if (
      idMatchingDraft &&
      titleMatchingDraft &&
      titleMatchingDraft !== idMatchingDraft
    ) {
      matchingDrafts.push(titleMatchingDraft);
    }
    const matchingDraftId = asText(matchingDraft?.id || matchingDraft?.draftId);
    const matchingDraftIsRetired = versionHistoryEntryIsRetiredForDraft(matchingDraft, draft);
    const shouldAdoptMatchingDraftIds = !matchingDraftIsRetired || options.adoptRetiredDraftIds !== false;
    if (matchingDraftId && shouldAdoptMatchingDraftIds) draft.id = matchingDraftId;

    let mergedDraftHistory = false;
    let mergedNotesHistory = false;
    matchingDrafts.forEach(historyDraft => {
      const history = Array.isArray(historyDraft?.history)
        ? historyDraft.history
        : historyDraft?.versionHistory;
      if (Array.isArray(history)) {
        draft.versionHistory = mergePageVersionHistories(
          draft.versionHistory,
          history,
          draft,
          draft.title || "Untitled draft"
        );
        mergedDraftHistory = true;
      }

      const notesHistory = draftNotesHistoryFromPayloadEntry(historyDraft);
      if (draft.notes && Array.isArray(notesHistory)) {
        const notesTitle = draft.notes.title || `${draft.title || "Untitled draft"} Notes`;
        draft.notes.versionHistory = mergePageVersionHistories(
          draft.notes.versionHistory,
          notesHistory,
          draft.notes,
          notesTitle
        );
        mergedNotesHistory = true;
      }
    });

    const matchingNotesId = asText(matchingDraft?.notes?.id || matchingDraft?.notesId || matchingDraft?.draftNotesId);
    if (draft.notes && matchingNotesId && shouldAdoptMatchingDraftIds) draft.notes.id = matchingNotesId;
    if (options.promotePages !== false) {
      if (mergedDraftHistory) {
        promotePageToNewestHistoryVersion(draft, draft.title || "Untitled draft");
      }
      if (draft.notes && mergedNotesHistory) {
        const notesTitle = draft.notes.title || `${draft.title || "Untitled draft"} Notes`;
        promotePageToNewestHistoryVersion(draft.notes, notesTitle);
      }
    }
  });

  return true;
}

function stateWithVersionHistoriesCompatibleWithPayload(state, payload) {
  const normalized = normalizeState(state);
  if (!payload || typeof payload !== "object") return normalized;

  const storyId = asText(payload.story?.id);
  const stateStoryId = asText(normalized.initialNotes?.id);
  if (storyId && stateStoryId && storyId !== stateStoryId) {
    normalized.initialNotes.versionHistory = [];
  }

  const incomingDrafts = Array.isArray(payload.drafts) ? payload.drafts : [];
  const byId = new Map();
  const byIndex = new Map();
  const titles = new Map();
  incomingDrafts.forEach((entry, index) => {
    const idValue = asText(entry?.id || entry?.draftId);
    if (idValue) byId.set(idValue, entry);
    byIndex.set(Number.isInteger(entry?.index) ? entry.index : index, entry);
    const titleKey = normalizeHistoryTitle(entry?.title);
    if (!titleKey) return;
    if (titles.has(titleKey)) titles.set(titleKey, null);
    else titles.set(titleKey, entry);
  });

  normalized.drafts.forEach((draft, index) => {
    const draftId = asText(draft.id);
    const titleKey = normalizeHistoryTitle(draft.title);
    const matchingDraft = byId.get(draftId)
      || (titleKey ? titles.get(titleKey) : null)
      || byIndex.get(index);
    if (!matchingDraft) return;

    const matchingDraftId = asText(matchingDraft.id || matchingDraft.draftId);
    if (
      matchingDraftId &&
      draftId &&
      matchingDraftId !== draftId &&
      !versionHistoryEntryIsRetiredForDraft(matchingDraft, draft)
    ) {
      draft.versionHistory = [];
    }

    const matchingNotesId = asText(matchingDraft?.notes?.id || matchingDraft?.notesId || matchingDraft?.draftNotesId);
    const notesId = asText(draft.notes?.id);
    if (
      draft.notes &&
      matchingNotesId &&
      notesId &&
      matchingNotesId !== notesId &&
      !versionHistoryEntryIsRetiredForDraft(matchingDraft, draft)
    ) {
      draft.notes.versionHistory = [];
    }
  });

  return normalized;
}

function applyExternalVersionHistory(state, options = {}) {
  const normalized = normalizeState(state);
  const filePath = findVersionHistoryFilePath(options);
  if (!filePath || !fs.existsSync(filePath)) return { state: normalized, loaded: false, filePath: null };

  const payload = parseVersionHistoryFile(filePath);
  const mergedState = normalizeState(stateWithoutVersionHistory(normalized));
  const loaded = applyVersionHistoryPayloadToState(mergedState, payload, {
    promotePages: options.promotePages !== false
  });
  return { state: mergedState, loaded, filePath };
}

function versionHistoryPayloadPages(payload) {
  const pages = [];
  if (!payload || typeof payload !== "object") return pages;

  pages.push({
    key: "story",
    matchKey: "story",
    titleMatchKey: "story",
    label: PROJECT_NOTES_TITLE,
    entries: historyArrayFromPayloadEntry(payload.story || payload.initialNotes)
  });

  (Array.isArray(payload.drafts) ? payload.drafts : []).forEach((draft, fallbackIndex) => {
    const index = Number.isFinite(Number(draft?.index)) ? Number(draft.index) : fallbackIndex;
    const title = asText(draft?.title) || `Draft ${index + 1}`;
    const key = versionHistoryDraftPageKey(draft, index);
    pages.push({
      key,
      matchKey: `draft:${index}:${normalizeHistoryTitle(title)}`,
      titleMatchKey: `draft:${normalizeHistoryTitle(title)}`,
      label: title,
      entries: historyArrayFromPayloadEntry(draft)
    });
    pages.push({
      key: `${key}:notes`,
      matchKey: `draft-notes:${index}:${normalizeHistoryTitle(title)}`,
      titleMatchKey: `draft-notes:${normalizeHistoryTitle(title)}`,
      label: asText(draft?.notes?.title) || `${title} Notes`,
      entries: draftNotesHistoryFromPayloadEntry(draft) || []
    });
  });

  return pages;
}

function normalizedHistoryTextValue(value) {
  return asText(value).replace(/\r\n/g, "\n").replace(/\r/g, "\n").trim();
}

function incrementCount(map, key) {
  map.set(key, (map.get(key) || 0) + 1);
}

function decrementCount(map, key) {
  const count = map.get(key) || 0;
  if (count <= 0) return false;
  if (count === 1) map.delete(key);
  else map.set(key, count - 1);
  return true;
}

function setUniqueHistoryPageMatch(map, key, value) {
  if (!key) return;
  if (map.has(key)) map.set(key, null);
  else map.set(key, value);
}

function historyTextValues(entry) {
  return [
    ["content", normalizedHistoryTextValue(entry?.content ?? entry?.text)],
    ["contentHtml", normalizedHistoryTextValue(entry?.contentHtml ?? entry?.html)]
  ].filter(([, value]) => value);
}

function versionHistorySafetySignature(entry) {
  return versionHistorySignature({
    title: entry?.title,
    content: entry?.content ?? entry?.text,
    contentHtml: entry?.contentHtml ?? entry?.html,
    format: entry?.format
  });
}

function versionHistoryEntriesAfterAdjacentDeduplication(entries) {
  const deduped = [];
  let previousSignature = null;
  let previousEntryHasMeaningfulContent = false;

  sortVersionHistoryByCreatedAt(entries).forEach(entry => {
    const signature = versionHistorySafetySignature(entry);
    const entryHasMeaningfulContent = versionHasMeaningfulContent(entry);
    if (
      deduped.length
      && entryHasMeaningfulContent
      && previousEntryHasMeaningfulContent
      && signature === previousSignature
    ) return;
    deduped.push(entry);
    previousSignature = signature;
    previousEntryHasMeaningfulContent = entryHasMeaningfulContent;
  });

  return deduped;
}

function missingVersionHistoryTextEntries(previousPayload, nextPayload) {
  const nextPages = new Map();
  const nextPagesByMatchKey = new Map();
  const nextPagesByTitleMatchKey = new Map();
  versionHistoryPayloadPages(nextPayload).forEach(page => {
    const values = new Map();
    (page.entries || []).forEach(entry => {
      historyTextValues(entry).forEach(([kind, value]) => incrementCount(values, `${kind}\0${value}`));
    });
    nextPages.set(page.key, values);
    nextPagesByMatchKey.set(page.matchKey, values);
    setUniqueHistoryPageMatch(nextPagesByTitleMatchKey, page.titleMatchKey, values);
  });

  const missing = [];
  versionHistoryPayloadPages(previousPayload).forEach(page => {
    const nextValues = nextPages.get(page.key)
      || nextPagesByMatchKey.get(page.matchKey)
      || nextPagesByTitleMatchKey.get(page.titleMatchKey)
      || new Map();
    versionHistoryEntriesAfterAdjacentDeduplication(page.entries).forEach((entry, index) => {
      historyTextValues(entry).forEach(([kind, value]) => {
        if (decrementCount(nextValues, `${kind}\0${value}`)) return;
        missing.push({
          page: page.label,
          index,
          kind,
          title: asText(entry?.title),
          createdAt: asText(entry?.createdAt),
          characters: value.length
        });
      });
    });
  });
  return missing;
}

function versionHistoryEntryCountLosses(previousPayload, nextPayload) {
  const nextPages = new Map();
  const nextPagesByMatchKey = new Map();
  const nextPagesByTitleMatchKey = new Map();
  versionHistoryPayloadPages(nextPayload).forEach(page => {
    const count = Array.isArray(page.entries) ? page.entries.length : 0;
    nextPages.set(page.key, count);
    nextPagesByMatchKey.set(page.matchKey, count);
    setUniqueHistoryPageMatch(nextPagesByTitleMatchKey, page.titleMatchKey, count);
  });

  const losses = [];
  versionHistoryPayloadPages(previousPayload).forEach(page => {
    const previousCount = versionHistoryEntriesAfterAdjacentDeduplication(page.entries).length;
    if (!previousCount) return;
    const nextCount = nextPages.get(page.key)
      ?? nextPagesByMatchKey.get(page.matchKey)
      ?? nextPagesByTitleMatchKey.get(page.titleMatchKey)
      ?? 0;
    if (nextCount >= previousCount) return;
    losses.push({
      page: page.label,
      previousCount,
      nextCount
    });
  });
  return losses;
}

function assertVersionHistoryPreservesExistingText(previousPayload, nextPayload, filePath) {
  const missing = missingVersionHistoryTextEntries(previousPayload, nextPayload);
  if (missing.length) {
    const error = new Error(
      `Refusing to write version history because it would drop ${missing.length} existing saved history text entr${missing.length === 1 ? "y" : "ies"}.`
    );
    error.code = "VERSION_HISTORY_TEXT_LOSS";
    error.statusCode = 409;
    error.filePath = filePath;
    error.missingHistoryEntries = missing.slice(0, 20);
    throw error;
  }

  const countLosses = versionHistoryEntryCountLosses(previousPayload, nextPayload);
  if (!countLosses.length) return;

  const error = new Error(
    `Refusing to write version history because it would reduce ${countLosses.length} existing saved history page count${countLosses.length === 1 ? "" : "s"}.`
  );
  error.code = "VERSION_HISTORY_COUNT_LOSS";
  error.statusCode = 409;
  error.filePath = filePath;
  error.historyCountLosses = countLosses.slice(0, 20);
  throw error;
}

function versionHistoryPayloadEntryCount(payload) {
  return versionHistoryPayloadPages(payload).reduce(
    (total, page) => total + (Array.isArray(page.entries) ? page.entries.length : 0),
    0
  );
}

function versionHistoryJsonSearchFoldersForRoot(rootFolderPath) {
  if (!rootFolderPath) return [];
  const resolvedRoot = path.resolve(rootFolderPath);
  return [...new Set([
    path.join(resolvedRoot, "json"),
    path.join(resolvedRoot, "jsons"),
    resolvedRoot
  ])];
}

function versionHistoryJsonCandidate(filePath) {
  const payload = parseVersionHistoryFile(filePath);
  let stats = null;
  try {
    stats = fs.statSync(filePath);
  } catch {
    return null;
  }
  return {
    filePath,
    fileName: path.basename(filePath),
    payload,
    entryCount: payload ? versionHistoryPayloadEntryCount(payload) : -1,
    size: stats.size
  };
}

function betterVersionHistoryJsonCandidate(left, right) {
  if (!left) return right;
  if (!right) return left;
  if (right.entryCount !== left.entryCount) return right.entryCount > left.entryCount ? right : left;
  if (right.size !== left.size) return right.size > left.size ? right : left;
  return left;
}

function collectVersionHistoryJsonCandidates(rootFolderPath) {
  const byName = new Map();
  if (!rootFolderPath || !directoryExists(rootFolderPath)) return byName;

  versionHistoryJsonSearchFoldersForRoot(rootFolderPath).forEach(folderPath => {
    try {
      fs.readdirSync(folderPath, { withFileTypes: true }).forEach(entry => {
        if (!entry.isFile() || !entry.name.endsWith(VERSION_HISTORY_FILE_SUFFIX)) return;
        const candidate = versionHistoryJsonCandidate(path.join(folderPath, entry.name));
        if (!candidate) return;
        byName.set(entry.name, betterVersionHistoryJsonCandidate(byName.get(entry.name), candidate));
      });
    } catch {
      // Legacy folders are optional.
    }
  });

  return byName;
}

function carryVersionHistoryJsonFiles(previousRootFolderPath, nextRootFolderPath) {
  const previousRoot = previousRootFolderPath && directoryExists(previousRootFolderPath)
    ? path.resolve(previousRootFolderPath)
    : null;
  const nextRoot = nextRootFolderPath ? path.resolve(nextRootFolderPath) : null;
  if (!previousRoot || !nextRoot || sameHistoryPath(previousRoot, nextRoot)) {
    return { copied: [], replaced: [], skipped: [], conflicts: [] };
  }

  const candidates = collectVersionHistoryJsonCandidates(previousRoot);
  const targetFolderPath = path.join(nextRoot, "json");
  fs.mkdirSync(targetFolderPath, { recursive: true });

  const copied = [];
  const replaced = [];
  const skipped = [];
  const conflicts = [];

  candidates.forEach(candidate => {
    const targetPath = path.join(targetFolderPath, candidate.fileName);
    if (!fileExists(targetPath)) {
      fs.copyFileSync(candidate.filePath, targetPath);
      copied.push({ sourcePath: candidate.filePath, targetPath, entryCount: candidate.entryCount });
      return;
    }

    const existing = versionHistoryJsonCandidate(targetPath);
    if (!existing || existing.entryCount >= candidate.entryCount) {
      skipped.push({ sourcePath: candidate.filePath, targetPath, reason: "target-kept" });
      return;
    }

    try {
      assertVersionHistoryPreservesExistingText(existing.payload, candidate.payload, targetPath);
      const backupPath = backupExistingVersionHistoryJson(nextRoot, { fileName: candidate.fileName }, targetPath);
      fs.copyFileSync(candidate.filePath, targetPath);
      replaced.push({
        sourcePath: candidate.filePath,
        targetPath,
        backupPath,
        previousEntryCount: existing.entryCount,
        entryCount: candidate.entryCount
      });
    } catch (error) {
      conflicts.push({
        sourcePath: candidate.filePath,
        targetPath,
        error: error.message
      });
    }
  });

  return { copied, replaced, skipped, conflicts };
}

function assertCarriedVersionHistoryFilesSafe(carriedHistoryFiles) {
  const conflicts = carriedHistoryFiles?.conflicts || [];
  if (!conflicts.length) return;

  const error = new Error("Version-history folder selection was stopped because existing JSON files could not be safely carried forward.");
  error.code = "VERSION_HISTORY_CARRY_CONFLICT";
  error.statusCode = 409;
  error.historyCarryConflicts = conflicts;
  throw error;
}

function versionHistoryPayloadFromState(state, options = {}) {
  const source = historySourceInfo(options);
  const payload = {
    version: 1,
    storyId: state.storyId,
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
      history: draft.versionHistory || [],
      notes: {
        id: draft.notes?.id || null,
        title: draft.notes?.title || `${draft.title || `Draft ${index + 1}`} Notes`,
        createdAt: draft.notes?.createdAt || null,
        history: draft.notes?.versionHistory || []
      }
    }))
  };

  const previousPayload = options.previousPayload;
  if (!previousPayload || !Array.isArray(previousPayload.drafts)) return payload;

  previousPayload.drafts.forEach((previousDraft, previousIndex) => {
    const draftHistory = historyArrayFromPayloadEntry(previousDraft);
    const notesHistory = draftNotesHistoryFromPayloadEntry(previousDraft) || [];
    if (!draftHistory.length && !notesHistory.length) return;

    const previousId = asText(previousDraft?.id || previousDraft?.draftId);
    const previousTitle = normalizeHistoryTitle(previousDraft?.title);
    const previousDraftIndex = Number.isInteger(previousDraft?.index)
      ? previousDraft.index
      : previousIndex;
    const stillLive = payload.drafts.some((draft, draftIndex) => {
      const draftId = asText(draft?.id || draft?.draftId);
      if (previousId && draftId && previousId === draftId) return true;

      const draftTitle = normalizeHistoryTitle(draft?.title);
      if (previousTitle && draftTitle && previousTitle === draftTitle) return true;

      const normalizedDraftIndex = Number.isInteger(draft?.index) ? draft.index : draftIndex;
      return !previousId && !draftId && previousDraftIndex === normalizedDraftIndex;
    });
    if (stillLive) return;

    payload.drafts.push({
      ...previousDraft,
      index: previousDraftIndex,
      retired: true,
      retiredAt: asText(previousDraft?.retiredAt) || nowIso()
    });
  });

  return payload;
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
    notesPage.versionHistory = Array.isArray(previousDraft?.notes?.versionHistory)
      ? previousDraft.notes.versionHistory
      : [];

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
    storyId: previous?.storyId,
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

function matchingDraftHistoryPayloadEntry(historyPayload, index, title) {
  const drafts = Array.isArray(historyPayload?.drafts) ? historyPayload.drafts : [];
  const titleKey = normalizeHistoryTitle(title);
  return drafts.find(draft => Number(draft?.index) === index)
    || drafts.find(draft => normalizeHistoryTitle(draft?.title) === titleKey);
}

function versionCountForDraft(historyPayload, index, title) {
  const match = matchingDraftHistoryPayloadEntry(historyPayload, index, title);
  const history = Array.isArray(match?.history) ? match.history : match?.versionHistory;
  return Array.isArray(history) ? history.length : 0;
}

function versionCountForDraftNotes(historyPayload, index, title) {
  const match = matchingDraftHistoryPayloadEntry(historyPayload, index, title);
  const history = draftNotesHistoryFromPayloadEntry(match);
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
      versionCount: versionCountForDraft(historyPayload, index, draft.title),
      notesVersionCount: versionCountForDraftNotes(historyPayload, index, draft.title)
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
    const notesNewVersions = Math.max(0, Number(after.notesVersionCount || 0) - Number(before.notesVersionCount || 0));
    if (before.notesHash !== after.notesHash || before.notesWordCount !== after.notesWordCount || notesNewVersions > 0) {
      changedDraftNotes.push({
        number: after.number,
        title: `${after.title} Notes`,
        wordCount: after.notesWordCount,
        previousWordCount: before.notesWordCount,
        versionCount: after.notesVersionCount,
        previousVersionCount: before.notesVersionCount,
        newVersions: notesNewVersions
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

function versionHistoryJsonBackupFolderPath(rootFolderPath) {
  return rootFolderPath ? path.join(rootFolderPath, "version history JSON backups") : null;
}

function canonicalJsonText(value) {
  if (value === null) return "null";
  if (Array.isArray(value)) {
    return `[${value.map(entry => canonicalJsonText(entry) ?? "null").join(",")}]`;
  }
  if (typeof value === "object") {
    const entries = Object.keys(value)
      .sort()
      .map(key => {
        const encodedValue = canonicalJsonText(value[key]);
        return encodedValue === undefined ? null : `${JSON.stringify(key)}:${encodedValue}`;
      })
      .filter(Boolean);
    return `{${entries.join(",")}}`;
  }
  return JSON.stringify(value);
}

function versionHistoryPayloadWithoutVolatileMetadataHash(payload) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) return null;
  const stablePayload = Object.fromEntries(
    Object.entries(payload).filter(([key]) => key !== "updatedAt" && key !== "projectUpdatedAt")
  );
  return textHash(canonicalJsonText(stablePayload));
}

function stabilizeVersionHistoryPayloadMetadata(previousPayload, nextPayload) {
  const previousHash = versionHistoryPayloadWithoutVolatileMetadataHash(previousPayload);
  const nextHash = versionHistoryPayloadWithoutVolatileMetadataHash(nextPayload);
  if (!previousHash || !nextHash || previousHash !== nextHash) return;

  for (const key of ["updatedAt", "projectUpdatedAt"]) {
    if (Object.prototype.hasOwnProperty.call(previousPayload, key)) {
      nextPayload[key] = previousPayload[key];
    } else {
      delete nextPayload[key];
    }
  }
}

function fileContentHash(filePath) {
  const hash = crypto.createHash("sha256");
  const descriptor = fs.openSync(filePath, "r");
  const buffer = Buffer.allocUnsafe(1024 * 1024);
  try {
    let bytesRead = 0;
    do {
      bytesRead = fs.readSync(descriptor, buffer, 0, buffer.length, null);
      if (bytesRead) hash.update(buffer.subarray(0, bytesRead));
    } while (bytesRead);
  } finally {
    fs.closeSync(descriptor);
  }
  return hash.digest("hex");
}

function fileMatchesContentHash(filePath, expectedSize, expectedHash) {
  try {
    const stats = fs.statSync(filePath);
    return stats.isFile() && stats.size === expectedSize && fileContentHash(filePath) === expectedHash;
  } catch {
    return false;
  }
}

function identicalVersionHistoryBackupPath(backupFolderPath, filePath, fileSize, contentHash) {
  let entries = [];
  try {
    entries = fs.readdirSync(backupFolderPath, { withFileTypes: true });
  } catch {
    return null;
  }

  const sourcePath = path.resolve(filePath);
  const candidates = entries
    .filter(entry => (
      entry.isFile()
      && entry.name.endsWith(VERSION_HISTORY_FILE_SUFFIX)
    ))
    .sort((left, right) => right.name.localeCompare(left.name));

  for (const entry of candidates) {
    const candidatePath = path.join(backupFolderPath, entry.name);
    if (path.resolve(candidatePath) === sourcePath) continue;
    if (fileMatchesContentHash(candidatePath, fileSize, contentHash)) return candidatePath;
  }
  return null;
}

function backupExistingVersionHistoryJson(rootFolderPath, source, filePath, sourceContent) {
  if (!rootFolderPath || (sourceContent === undefined && !fileExists(filePath))) return null;

  const backupFolderPath = versionHistoryJsonBackupFolderPath(rootFolderPath);
  if (!backupFolderPath) return null;
  fs.mkdirSync(backupFolderPath, { recursive: true });

  const content = sourceContent === undefined
    ? fs.readFileSync(filePath)
    : Buffer.isBuffer(sourceContent)
      ? sourceContent
      : Buffer.from(String(sourceContent), "utf8");
  const fileSize = content.length;
  const contentHash = crypto.createHash("sha256").update(content).digest("hex");
  const baseName = safeHistoryBaseName(source.fileName);
  const backupPaths = [
    path.join(backupFolderPath, `${baseName}.${contentHash.slice(0, 32)}${VERSION_HISTORY_FILE_SUFFIX}`),
    path.join(backupFolderPath, `${baseName}.${contentHash}${VERSION_HISTORY_FILE_SUFFIX}`)
  ];

  for (const backupPath of backupPaths) {
    if (fileMatchesContentHash(backupPath, fileSize, contentHash)) return backupPath;
  }

  const identicalBackupPath = identicalVersionHistoryBackupPath(
    backupFolderPath,
    filePath,
    fileSize,
    contentHash
  );
  if (identicalBackupPath) return identicalBackupPath;

  for (const backupPath of backupPaths) {
    try {
      fs.writeFileSync(backupPath, content, { flag: "wx" });
      if (!fileMatchesContentHash(backupPath, fileSize, contentHash)) {
        const error = new Error(`Version-history backup verification failed for ${backupPath}`);
        error.code = "VERSION_HISTORY_BACKUP_VERIFICATION_FAILED";
        error.filePath = backupPath;
        throw error;
      }
      return backupPath;
    } catch (error) {
      if (error?.code !== "EEXIST") throw error;
      if (fileMatchesContentHash(backupPath, fileSize, contentHash)) return backupPath;
    }
  }

  const error = new Error(`Version-history backup hash collision for ${filePath}`);
  error.code = "VERSION_HISTORY_BACKUP_HASH_COLLISION";
  error.filePath = filePath;
  throw error;
}

function versionHistoryJsonArchiveFolderPath(rootFolderPath, runName = "") {
  if (!rootFolderPath) return null;
  const archiveRoot = path.join(rootFolderPath, "version history JSON archive");
  return runName ? path.join(archiveRoot, safeFolderName(runName, "retention")) : archiveRoot;
}

function normalizedRetentionSourcePath(value) {
  const normalized = asText(value).trim().replaceAll("\\", "/").replace(/\/+/gu, "/");
  return process.platform === "win32" ? normalized.toLowerCase() : normalized;
}

function versionHistoryRetentionStory(payload = {}, fallback = {}) {
  const storyId = asText(payload.storyId || fallback.storyId).trim();
  const sourceFilePath = asText(payload.sourceFilePath || fallback.sourceFilePath).trim();
  const sourceFileName = asText(payload.sourceFileName || fallback.sourceFileName).trim();
  if (storyId) {
    return {
      key: `story:${storyId}`,
      storyId,
      sourceFilePath,
      sourceFileName,
      label: sourceFileName || storyId
    };
  }

  const normalizedSourcePath = normalizedRetentionSourcePath(sourceFilePath);
  if (normalizedSourcePath) {
    return {
      key: `path:${normalizedSourcePath}`,
      storyId: "",
      sourceFilePath,
      sourceFileName,
      label: sourceFileName || path.basename(sourceFilePath)
    };
  }

  const normalizedSourceName = normalizedHistoryName(sourceFileName);
  if (normalizedSourceName) {
    return {
      key: `name:${normalizedSourceName}`,
      storyId: "",
      sourceFilePath: "",
      sourceFileName,
      label: sourceFileName
    };
  }

  const fallbackName = asText(fallback.fileName).trim();
  return {
    key: `unknown:${fallbackName || "version-history"}`,
    storyId: "",
    sourceFilePath: "",
    sourceFileName: "",
    label: fallbackName || "Unknown story"
  };
}

function retentionPolicy(options = {}) {
  const requested = options.policy || options;
  const nonNegativeInteger = (value, fallback) => {
    const number = Number(value);
    return Number.isFinite(number) && number >= 0 ? Math.floor(number) : fallback;
  };
  const nonNegativeBytes = (value, fallback) => {
    const number = Number(value);
    return Number.isFinite(number) && number >= 0 ? Math.floor(number) : fallback;
  };
  return {
    newestCount: nonNegativeInteger(requested.newestCount, VERSION_HISTORY_RETENTION_POLICY.newestCount),
    dailyDays: nonNegativeInteger(requested.dailyDays, VERSION_HISTORY_RETENTION_POLICY.dailyDays),
    weeklyWeeks: nonNegativeInteger(requested.weeklyWeeks, VERSION_HISTORY_RETENTION_POLICY.weeklyWeeks),
    monthlyMonths: nonNegativeInteger(requested.monthlyMonths, VERSION_HISTORY_RETENTION_POLICY.monthlyMonths),
    safetyNewestCount: nonNegativeInteger(
      requested.safetyNewestCount,
      VERSION_HISTORY_RETENTION_POLICY.safetyNewestCount
    ),
    storyByteLimit: nonNegativeBytes(
      requested.storyByteLimit,
      VERSION_HISTORY_RETENTION_POLICY.storyByteLimit
    ),
    totalByteLimit: nonNegativeBytes(
      requested.totalByteLimit,
      VERSION_HISTORY_RETENTION_POLICY.totalByteLimit
    )
  };
}

function retentionTimeMs(value, fallback = 0) {
  if (Number.isFinite(value)) return Number(value);
  const parsed = Date.parse(asText(value));
  return Number.isFinite(parsed) ? parsed : fallback;
}

function utcDayStart(timeMs) {
  const date = new Date(timeMs);
  return Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
}

function utcIsoWeekStart(timeMs) {
  const dayStart = utcDayStart(timeMs);
  const day = new Date(dayStart).getUTCDay();
  return dayStart - (((day + 6) % 7) * 24 * 60 * 60 * 1000);
}

function utcMonthIndex(timeMs) {
  const date = new Date(timeMs);
  return (date.getUTCFullYear() * 12) + date.getUTCMonth();
}

function retentionRecordNewestSort(left, right) {
  return right.capturedAtMs - left.capturedAtMs
    || right.mtimeMs - left.mtimeMs
    || right.fileName.localeCompare(left.fileName);
}

function retentionDuplicateStats(records, keyName) {
  const groups = new Map();
  records.forEach(record => {
    const key = asText(record[keyName]);
    if (!key) return;
    const group = groups.get(key) || [];
    group.push(record);
    groups.set(key, group);
  });

  const duplicates = [...groups.values()].filter(group => group.length > 1);
  return {
    groups: duplicates,
    groupCount: duplicates.length,
    fileCount: duplicates.reduce((sum, group) => sum + group.length - 1, 0),
    bytes: duplicates.reduce((sum, group) => {
      const sorted = group.slice().sort(retentionRecordNewestSort);
      return sum + sorted.slice(1).reduce((groupSum, record) => groupSum + record.size, 0);
    }, 0)
  };
}

function normalizedRetentionRecord(record, index) {
  const hasPayload = Boolean(
    record
    && Object.prototype.hasOwnProperty.call(record, "payload")
  );
  const payload = record?.payload && typeof record.payload === "object" ? record.payload : {};
  const payloadSchemaStatus = hasPayload ? versionHistoryPayloadSchemaStatus(record.payload) : "current";
  const story = record?.storyKey
    ? {
        key: record.storyKey,
        storyId: asText(record.storyId),
        sourceFilePath: asText(record.sourceFilePath),
        sourceFileName: asText(record.sourceFileName),
        label: asText(record.storyLabel || record.sourceFileName || record.storyId || record.storyKey)
      }
    : versionHistoryRetentionStory(payload, record);
  const capturedAtMs = retentionTimeMs(
    record?.capturedAtMs ?? record?.capturedAt,
    retentionTimeMs(record?.mtimeMs, 0)
  );
  const fileName = asText(record?.fileName || path.basename(asText(record?.filePath))).trim()
    || `version-history-${index + 1}.json`;
  const inferredPinned = Boolean(
    record?.pinned
    || (hasPayload && payloadSchemaStatus === "current" && versionHistoryPayloadPinned(payload, fileName))
  );
  const protectedReason = record?.protectedReason
    || (record?.malformed ? "malformed" : "")
    || (record?.futureSchema ? "future-schema" : "")
    || (payloadSchemaStatus === "malformed" ? "malformed" : "")
    || (payloadSchemaStatus === "future-schema" ? "future-schema" : "")
    || (inferredPinned ? "pinned" : "");
  const content = Buffer.isBuffer(record?.content)
    ? record.content
    : typeof record?.content === "string"
      ? Buffer.from(record.content, "utf8")
      : null;
  return {
    id: asText(record?.id) || `${fileName}\0${index}`,
    fileName,
    filePath: asText(record?.filePath),
    size: Math.max(0, Number(record?.size) || content?.length || 0),
    mtimeMs: Math.max(0, Number(record?.mtimeMs) || 0),
    capturedAtMs,
    capturedAt: new Date(capturedAtMs || 0).toISOString(),
    rawHash: asText(record?.rawHash) || (content
      ? crypto.createHash("sha256").update(content).digest("hex")
      : ""),
    stableHash: asText(record?.stableHash) || (
      hasPayload && payloadSchemaStatus === "current"
        ? versionHistoryPayloadWithoutVolatileMetadataHash(payload) || ""
        : ""
    ),
    storyKey: story.key,
    storyId: story.storyId,
    sourceFilePath: story.sourceFilePath,
    sourceFileName: story.sourceFileName,
    storyLabel: story.label,
    malformed: protectedReason === "malformed",
    futureSchema: protectedReason === "future-schema",
    pinned: protectedReason === "pinned",
    protectedReason
  };
}

function retentionKeepPriority(entry) {
  if (entry.keepReasons.includes("newest")) return 40;
  if (entry.keepReasons.includes("daily")) return 30;
  if (entry.keepReasons.includes("weekly")) return 20;
  if (entry.keepReasons.includes("monthly")) return 10;
  return 0;
}

function retentionCapEvictionSort(left, right) {
  return retentionKeepPriority(left) - retentionKeepPriority(right)
    || left.capturedAtMs - right.capturedAtMs
    || left.fileName.localeCompare(right.fileName);
}

function buildVersionHistoryBackupRetentionPlan(inputRecords, options = {}) {
  const policy = retentionPolicy(options);
  const nowMs = retentionTimeMs(options.now, Date.now());
  const records = (Array.isArray(inputRecords) ? inputRecords : [])
    .map(normalizedRetentionRecord);
  const decisions = new Map(records.map(record => [record.id, {
    ...record,
    action: "keep",
    reason: record.protectedReason || "retention",
    keepReasons: record.protectedReason ? [record.protectedReason] : [],
    safetyProtected: false
  }]));
  const storyGroups = new Map();
  records.forEach(record => {
    const group = storyGroups.get(record.storyKey) || [];
    group.push(record);
    storyGroups.set(record.storyKey, group);
  });

  const sameSizeGroups = new Map();
  records.forEach(record => {
    const group = sameSizeGroups.get(record.size) || [];
    group.push(record);
    sameSizeGroups.set(record.size, group);
  });
  const sameSizeCandidates = [...sameSizeGroups.values()].filter(group => group.length > 1);
  const exactStats = retentionDuplicateStats(records, "rawHash");
  const stableStats = retentionDuplicateStats(records, "stableHash");
  const stableContentDuplicateIds = new Set();
  const stableContentDuplicateGroupKeys = new Set();
  stableStats.groups.forEach(group => {
    const sorted = group.slice().sort(retentionRecordNewestSort);
    sorted.slice(1).forEach((record, index) => {
      const hasNewerExactCopy = sorted
        .slice(0, index + 1)
        .some(newer => newer.rawHash && newer.rawHash === record.rawHash);
      if (!hasNewerExactCopy) {
        stableContentDuplicateIds.add(record.id);
        stableContentDuplicateGroupKeys.add(record.stableHash);
      }
    });
  });

  const currentDayStart = utcDayStart(nowMs);
  const currentWeekStart = utcIsoWeekStart(nowMs);
  const currentMonth = utcMonthIndex(nowMs);
  storyGroups.forEach(group => {
    const sorted = group.slice().sort(retentionRecordNewestSort);
    const eligible = sorted.filter(record => !record.protectedReason);
    const stableGroups = new Map();
    eligible.forEach(record => {
      if (!record.stableHash) return;
      const stableGroup = stableGroups.get(record.stableHash) || [];
      stableGroup.push(record);
      stableGroups.set(record.stableHash, stableGroup);
    });
    stableGroups.forEach(stableGroup => {
      const duplicateSorted = stableGroup.slice().sort(retentionRecordNewestSort);
      duplicateSorted.slice(1).forEach((record, index) => {
        const decision = decisions.get(record.id);
        const hasNewerExactCopy = duplicateSorted
          .slice(0, index + 1)
          .some(newer => newer.rawHash && newer.rawHash === record.rawHash);
        decision.action = "archive";
        decision.reason = hasNewerExactCopy
          ? "exact-duplicate"
          : "stable-content-duplicate";
        decision.keepReasons = [];
      });
    });

    const retentionPool = eligible.filter(record => decisions.get(record.id).action !== "archive");
    retentionPool.slice(0, policy.safetyNewestCount).forEach(record => {
      const decision = decisions.get(record.id);
      decision.safetyProtected = true;
      decision.keepReasons.push("safety-newest");
    });
    retentionPool.slice(0, policy.newestCount).forEach(record => {
      decisions.get(record.id).keepReasons.push("newest");
    });

    const dailyStart = currentDayStart - (Math.max(0, policy.dailyDays - 1) * 24 * 60 * 60 * 1000);
    const dailyBuckets = new Set();
    retentionPool.forEach(record => {
      const bucket = utcDayStart(record.capturedAtMs);
      if (
        policy.dailyDays > 0
        && bucket >= dailyStart
        && bucket <= currentDayStart
        && !dailyBuckets.has(bucket)
      ) {
        dailyBuckets.add(bucket);
        decisions.get(record.id).keepReasons.push("daily");
      }
    });

    const weeklyStart = currentWeekStart - (Math.max(0, policy.weeklyWeeks - 1) * 7 * 24 * 60 * 60 * 1000);
    const weeklyBuckets = new Set();
    retentionPool.forEach(record => {
      const bucket = utcIsoWeekStart(record.capturedAtMs);
      if (
        policy.weeklyWeeks > 0
        && bucket >= weeklyStart
        && bucket <= currentWeekStart
        && !weeklyBuckets.has(bucket)
      ) {
        weeklyBuckets.add(bucket);
        decisions.get(record.id).keepReasons.push("weekly");
      }
    });

    const monthlyStart = currentMonth - Math.max(0, policy.monthlyMonths - 1);
    const monthlyBuckets = new Set();
    retentionPool.forEach(record => {
      const bucket = utcMonthIndex(record.capturedAtMs);
      if (
        policy.monthlyMonths > 0
        && bucket >= monthlyStart
        && bucket <= currentMonth
        && !monthlyBuckets.has(bucket)
      ) {
        monthlyBuckets.add(bucket);
        decisions.get(record.id).keepReasons.push("monthly");
      }
    });

    retentionPool.forEach(record => {
      const decision = decisions.get(record.id);
      decision.keepReasons = [...new Set(decision.keepReasons)];
      if (decision.protectedReason || decision.safetyProtected || decision.keepReasons.length) return;
      decision.action = "archive";
      decision.reason = "outside-retention-window";
    });
  });

  const capWarnings = [];
  storyGroups.forEach((group, storyKey) => {
    let activeBytes = group.reduce((sum, record) => {
      const decision = decisions.get(record.id);
      return sum + (decision.action === "keep" ? decision.size : 0);
    }, 0);
    const movable = group
      .map(record => decisions.get(record.id))
      .filter(entry => (
        entry.action === "keep"
        && !entry.protectedReason
        && !entry.safetyProtected
      ))
      .sort(retentionCapEvictionSort);
    while (activeBytes > policy.storyByteLimit && movable.length) {
      const entry = movable.shift();
      entry.action = "archive";
      entry.reason = "story-byte-limit";
      entry.keepReasons = [];
      activeBytes -= entry.size;
    }
    if (activeBytes > policy.storyByteLimit) {
      const story = group.slice().sort(retentionRecordNewestSort)[0];
      capWarnings.push({
        type: "story-byte-limit",
        storyKey,
        label: story?.storyLabel || storyKey,
        activeBytes,
        limitBytes: policy.storyByteLimit
      });
    }
  });

  let totalActiveBytes = [...decisions.values()].reduce(
    (sum, entry) => sum + (entry.action === "keep" ? entry.size : 0),
    0
  );
  const globallyMovable = [...decisions.values()]
    .filter(entry => (
      entry.action === "keep"
      && !entry.protectedReason
      && !entry.safetyProtected
    ))
    .sort(retentionCapEvictionSort);
  while (totalActiveBytes > policy.totalByteLimit && globallyMovable.length) {
    const entry = globallyMovable.shift();
    entry.action = "archive";
    entry.reason = "total-byte-limit";
    entry.keepReasons = [];
    totalActiveBytes -= entry.size;
  }
  if (totalActiveBytes > policy.totalByteLimit) {
    capWarnings.push({
      type: "total-byte-limit",
      activeBytes: totalActiveBytes,
      limitBytes: policy.totalByteLimit
    });
  }

  const files = [...decisions.values()]
    .map(entry => ({
      ...entry,
      keepReasons: [...new Set(entry.keepReasons)]
    }))
    .sort((left, right) => left.storyLabel.localeCompare(right.storyLabel)
      || retentionRecordNewestSort(left, right));
  const kept = files.filter(file => file.action === "keep");
  const archived = files.filter(file => file.action === "archive");
  const protectedFiles = files.filter(file => file.protectedReason);
  const stories = [...storyGroups.entries()]
    .map(([storyKey, group]) => {
      const storyFiles = group.map(record => decisions.get(record.id));
      const first = storyFiles.slice().sort(retentionRecordNewestSort)[0];
      return {
        storyKey,
        storyId: first?.storyId || "",
        sourceFileName: first?.sourceFileName || "",
        sourceFilePath: first?.sourceFilePath || "",
        label: first?.storyLabel || storyKey,
        scannedFileCount: storyFiles.length,
        scannedBytes: storyFiles.reduce((sum, file) => sum + file.size, 0),
        keepFileCount: storyFiles.filter(file => file.action === "keep").length,
        keepBytes: storyFiles.reduce(
          (sum, file) => sum + (file.action === "keep" ? file.size : 0),
          0
        ),
        archiveFileCount: storyFiles.filter(file => file.action === "archive").length,
        archiveBytes: storyFiles.reduce(
          (sum, file) => sum + (file.action === "archive" ? file.size : 0),
          0
        )
      };
    })
    .sort((left, right) => left.label.localeCompare(right.label));
  const planFingerprint = textHash(JSON.stringify({
    policy,
    files: files.map(file => [
      file.fileName,
      file.size,
      file.mtimeMs,
      file.rawHash,
      file.stableHash,
      file.action,
      file.reason
    ])
  }));

  return {
    planId: asText(options.planId),
    fingerprint: planFingerprint,
    generatedAt: new Date(nowMs).toISOString(),
    policy,
    summary: {
      scannedFileCount: files.length,
      scannedBytes: files.reduce((sum, file) => sum + file.size, 0),
      eligibleFileCount: files.length - protectedFiles.length,
      protectedFileCount: protectedFiles.length,
      protectedBytes: protectedFiles.reduce((sum, file) => sum + file.size, 0),
      malformedFileCount: files.filter(file => file.malformed).length,
      pinnedFileCount: files.filter(file => file.pinned).length,
      futureSchemaFileCount: files.filter(file => file.futureSchema).length,
      sourceChangedFileCount: files.filter(
        file => file.protectedReason === "source-changed-during-scan"
      ).length,
      sameSizeCandidateGroupCount: sameSizeCandidates.length,
      sameSizeCandidateFileCount: sameSizeCandidates.reduce((sum, group) => sum + group.length, 0),
      sameSizeCandidatePairCount: sameSizeCandidates.reduce(
        (sum, group) => sum + ((group.length * (group.length - 1)) / 2),
        0
      ),
      exactDuplicateGroupCount: exactStats.groupCount,
      exactDuplicateFileCount: exactStats.fileCount,
      exactDuplicateBytes: exactStats.bytes,
      stableContentDuplicateGroupCount: stableContentDuplicateGroupKeys.size,
      stableContentDuplicateFileCount: stableContentDuplicateIds.size,
      stableContentDuplicateBytes: files.reduce(
        (sum, file) => sum + (stableContentDuplicateIds.has(file.id) ? file.size : 0),
        0
      ),
      metadataOnlyDuplicateFileCount: stableContentDuplicateIds.size,
      keepFileCount: kept.length,
      keepBytes: kept.reduce((sum, file) => sum + file.size, 0),
      archiveFileCount: archived.length,
      archiveBytes: archived.reduce((sum, file) => sum + file.size, 0),
      activeFileCount: kept.length,
      activeBytes: kept.reduce((sum, file) => sum + file.size, 0),
      filesToArchiveCount: archived.length,
      bytesToArchive: archived.reduce((sum, file) => sum + file.size, 0),
      capExceededUnavoidable: capWarnings.length > 0
    },
    warnings: capWarnings,
    stories,
    files
  };
}

function versionHistoryBackupTimestampFromFileName(fileName) {
  const match = /\.(\d{4}-\d{2}-\d{2}T\d{2})-(\d{2})-(\d{2})-(\d{3})Z\.\d+\.version-history\.json$/u.exec(
    asText(fileName)
  );
  if (!match) return null;
  const value = `${match[1]}:${match[2]}:${match[3]}.${match[4]}Z`;
  const time = Date.parse(value);
  return Number.isFinite(time) ? time : null;
}

function directVersionHistoryBackupStats(backupFolderPath) {
  if (!backupFolderPath || !directoryExists(backupFolderPath)) return [];
  return fs.readdirSync(backupFolderPath, { withFileTypes: true })
    .filter(entry => entry.isFile() && entry.name.endsWith(VERSION_HISTORY_FILE_SUFFIX))
    .map(entry => {
      const filePath = path.join(backupFolderPath, entry.name);
      const stats = fs.statSync(filePath);
      return {
        fileName: entry.name,
        filePath,
        size: stats.size,
        mtimeMs: stats.mtimeMs
      };
    })
    .sort((left, right) => left.fileName.localeCompare(right.fileName));
}

function versionHistoryBackupDirectoryFingerprint(statsEntries) {
  return textHash(JSON.stringify((Array.isArray(statsEntries) ? statsEntries : [])
    .map(entry => [
      asText(entry.fileName),
      Math.max(0, Number(entry.size) || 0),
      Math.trunc(Math.max(0, Number(entry.mtimeMs) || 0))
    ])
    .sort((left, right) => left[0].localeCompare(right[0]))));
}

function versionHistoryPayloadSchemaStatus(payload) {
  if (!payload) return "malformed";
  if (
    !payload.story
    || typeof payload.story !== "object"
    || Array.isArray(payload.story)
    || !Array.isArray(payload.drafts)
  ) {
    return "malformed";
  }
  if (!Object.prototype.hasOwnProperty.call(payload, "version")) return "current";
  const schemaVersion = Number(payload.version);
  if (!Number.isInteger(schemaVersion) || schemaVersion < 0) return "malformed";
  return schemaVersion > VERSION_HISTORY_SCHEMA_VERSION ? "future-schema" : "current";
}

function versionHistoryPayloadPinned(payload, fileName = "") {
  return Boolean(
    payload?.pinned === true
    || payload?.retentionPinned === true
    || payload?.retention?.pinned === true
    || /\.pinned(?:\.|$)/iu.test(asText(fileName))
  );
}

function reconcileLegacyRetentionStoryIdentities(records) {
  const storyIdsBySourcePath = new Map();
  records.forEach(record => {
    if (
      !record.storyId
      || record.malformed
      || record.futureSchema
      || record.protectedReason === "source-changed-during-scan"
    ) {
      return;
    }
    const sourcePath = normalizedRetentionSourcePath(record.sourceFilePath);
    if (!sourcePath) return;
    const storyIds = storyIdsBySourcePath.get(sourcePath) || new Set();
    storyIds.add(record.storyId);
    storyIdsBySourcePath.set(sourcePath, storyIds);
  });

  records.forEach(record => {
    if (record.storyId || record.malformed || record.futureSchema) return;
    const sourcePath = normalizedRetentionSourcePath(record.sourceFilePath);
    const storyIds = sourcePath ? storyIdsBySourcePath.get(sourcePath) : null;
    if (!storyIds || storyIds.size !== 1) return;
    const [storyId] = storyIds;
    record.storyId = storyId;
    record.storyKey = `story:${storyId}`;
  });
  return records;
}

function scanVersionHistoryBackupRetention(options = {}, progress = () => {}) {
  const rootFolderPath = normalizedRegistryPath(options.rootFolderPath)
    || requireVersionHistoryFolderPath();
  if (!rootFolderPath) {
    throw new BackupFolderMissingError(readVersionHistoryFolderPath() || "No backup folder selected");
  }
  const backupFolderPath = versionHistoryJsonBackupFolderPath(rootFolderPath);
  const initialStats = directVersionHistoryBackupStats(backupFolderPath);
  const totalBytes = initialStats.reduce((sum, entry) => sum + entry.size, 0);
  let completedBytes = 0;
  const records = [];

  initialStats.forEach((entry, index) => {
    progress({
      step: `Checking ${entry.fileName}`,
      completed: index,
      total: initialStats.length,
      completedBytes,
      totalBytes
    });
    let content = null;
    let afterStats = null;
    let readError = null;
    try {
      content = fs.readFileSync(entry.filePath);
      afterStats = fs.statSync(entry.filePath);
    } catch (error) {
      readError = error;
    }

    const changedDuringScan = Boolean(
      afterStats
      && (
        afterStats.size !== entry.size
        || Math.trunc(afterStats.mtimeMs) !== Math.trunc(entry.mtimeMs)
      )
    );
    const payload = content ? parseVersionHistoryJson(content.toString("utf8")) : null;
    const schemaStatus = readError || changedDuringScan
      ? "malformed"
      : versionHistoryPayloadSchemaStatus(payload);
    const story = versionHistoryRetentionStory(payload || {}, entry);
    const rawHash = content
      ? crypto.createHash("sha256").update(content).digest("hex")
      : "";
    const stableHash = schemaStatus === "current"
      ? versionHistoryPayloadWithoutVolatileMetadataHash(payload)
      : null;
    const pinned = schemaStatus === "current" && versionHistoryPayloadPinned(payload, entry.fileName);
    const protectedReason = readError
      ? "malformed"
      : changedDuringScan
        ? "source-changed-during-scan"
        : schemaStatus === "future-schema"
          ? "future-schema"
          : schemaStatus === "malformed"
            ? "malformed"
            : pinned
              ? "pinned"
              : "";
    const capturedAtMs = versionHistoryBackupTimestampFromFileName(entry.fileName)
      ?? entry.mtimeMs;
    records.push({
      id: entry.fileName,
      ...entry,
      capturedAtMs,
      rawHash,
      stableHash,
      storyKey: story.key,
      storyId: story.storyId,
      sourceFilePath: story.sourceFilePath,
      sourceFileName: story.sourceFileName,
      storyLabel: story.label,
      malformed: protectedReason === "malformed",
      futureSchema: protectedReason === "future-schema",
      pinned: protectedReason === "pinned",
      protectedReason,
      error: readError?.message || ""
    });
    completedBytes += entry.size;
  });
  reconcileLegacyRetentionStoryIdentities(records);
  progress({
    step: "Applying retention policy",
    completed: initialStats.length,
    total: initialStats.length,
    completedBytes,
    totalBytes
  });

  return {
    rootFolderPath,
    backupFolderPath,
    directoryFingerprint: versionHistoryBackupDirectoryFingerprint(initialStats),
    records
  };
}

function retentionArchiveRunName(generatedAt, planId) {
  const timestamp = asText(generatedAt || nowIso()).replace(/[:.]/gu, "-");
  return `retention-${timestamp}-${safeFolderName(planId || "plan", "plan")}`;
}

function previewVersionHistoryBackupRetention(options = {}, progress = () => {}) {
  const planId = asText(options.planId) || id("retention-plan");
  const scan = scanVersionHistoryBackupRetention(options, progress);
  const plan = buildVersionHistoryBackupRetentionPlan(scan.records, {
    planId,
    now: options.now,
    policy: options.policy
  });
  const archiveFolderPath = options.archiveFolderPath
    ? path.resolve(options.archiveFolderPath)
    : versionHistoryJsonArchiveFolderPath(
        scan.rootFolderPath,
        retentionArchiveRunName(plan.generatedAt, planId)
      );
  return {
    ...plan,
    rootFolderPath: scan.rootFolderPath,
    backupFolderPath: scan.backupFolderPath,
    archiveFolderPath,
    directoryFingerprint: scan.directoryFingerprint
  };
}

function assertVersionHistoryRetentionPlanCurrent(plan) {
  if (!plan?.backupFolderPath || !plan?.directoryFingerprint) {
    const error = new Error("Version-history retention plan is incomplete.");
    error.code = "VERSION_HISTORY_RETENTION_INVALID_PLAN";
    error.statusCode = 400;
    throw error;
  }
  const currentStats = directVersionHistoryBackupStats(plan.backupFolderPath);
  const currentFingerprint = versionHistoryBackupDirectoryFingerprint(currentStats);
  if (currentFingerprint !== plan.directoryFingerprint) {
    const error = new Error("Version-history backups changed after the preview. Scan again before archiving.");
    error.code = "VERSION_HISTORY_RETENTION_STALE";
    error.statusCode = 409;
    error.expectedFingerprint = plan.directoryFingerprint;
    error.currentFingerprint = currentFingerprint;
    throw error;
  }
}

function retentionArchiveManifest(plan, entries, status, error = "", options = {}) {
  const archiveCompletedAt = status === "in-progress"
    ? null
    : asText(options.archiveCompletedAt) || nowIso();
  return {
    version: 1,
    status,
    planId: plan.planId,
    planFingerprint: plan.fingerprint,
    directoryFingerprint: plan.directoryFingerprint,
    generatedAt: plan.generatedAt,
    archiveStartedAt: entries.startedAt,
    archiveCompletedAt,
    archiveRetention: options.archiveRetention || null,
    rootFolderPath: plan.rootFolderPath,
    backupFolderPath: plan.backupFolderPath,
    archiveFolderPath: entries.archiveFolderPath || plan.archiveFolderPath,
    archivePlanPath: entries.planPath || null,
    archiveJournalPath: entries.journalPath || null,
    policy: plan.policy,
    error,
    files: entries.files
  };
}

function writeRetentionArchiveManifest(manifestPath, manifest, exclusive = false) {
  const content = `${JSON.stringify(manifest, null, 2)}\n`;
  if (exclusive) {
    fs.writeFileSync(manifestPath, content, { encoding: "utf8", flag: "wx" });
    return;
  }
  fs.writeFileSync(manifestPath, content, "utf8");
}

function appendRetentionArchiveJournal(journalPath, event) {
  fs.appendFileSync(journalPath, `${JSON.stringify(event)}\n`, "utf8");
}

function openRetentionArchiveReadyJournal(archiveRootPath) {
  const archiveRoot = path.resolve(archiveRootPath);
  const journalPath = path.join(
    archiveRoot,
    VERSION_HISTORY_ARCHIVE_READY_JOURNAL_FILE
  );
  const noFollow = Number(fs.constants.O_NOFOLLOW) || 0;
  const appendFlags = fs.constants.O_WRONLY | fs.constants.O_APPEND | noFollow;
  let descriptor = null;
  try {
    try {
      descriptor = fs.openSync(
        journalPath,
        appendFlags | fs.constants.O_CREAT | fs.constants.O_EXCL,
        0o600
      );
    } catch (error) {
      if (error?.code !== "EEXIST") throw error;
      const existing = fs.lstatSync(journalPath);
      if (!existing.isFile() || existing.isSymbolicLink() || existing.nlink !== 1) {
        throw new Error("The manual deletion journal is linked or is not a regular file.");
      }
      descriptor = fs.openSync(journalPath, appendFlags);
    }

    const pathStats = fs.lstatSync(journalPath);
    const descriptorStats = fs.fstatSync(descriptor);
    const archiveRootRealPath = fs.realpathSync(archiveRoot);
    const journalRealPath = fs.realpathSync(journalPath);
    if (
      !pathStats.isFile()
      || pathStats.isSymbolicLink()
      || pathStats.nlink !== 1
      || !descriptorStats.isFile()
      || descriptorStats.nlink !== 1
      || pathStats.dev !== descriptorStats.dev
      || pathStats.ino !== descriptorStats.ino
      || !sameHistoryPath(path.dirname(journalRealPath), archiveRootRealPath)
    ) {
      throw new Error("The manual deletion journal is linked or outside the managed archive root.");
    }
    return { descriptor, journalPath };
  } catch (cause) {
    if (descriptor !== null) {
      try {
        fs.closeSync(descriptor);
      } catch {}
    }
    const error = new Error("The manual deletion journal is unsafe or cannot be opened.");
    error.code = "VERSION_HISTORY_ARCHIVE_READY_JOURNAL_UNSAFE";
    error.statusCode = 409;
    error.filePath = journalPath;
    error.cause = cause;
    throw error;
  }
}

function appendRetentionArchiveReadyJournal(descriptor, event) {
  fs.writeSync(descriptor, `${JSON.stringify(event)}\n`, null, "utf8");
}

function archiveVersionHistoryBackupRetentionPlan(plan, options = {}, progress = () => {}) {
  if (!plan || typeof plan !== "object" || !plan.planId || !plan.fingerprint) {
    const error = new Error("Missing version-history retention plan.");
    error.code = "VERSION_HISTORY_RETENTION_INVALID_PLAN";
    error.statusCode = 400;
    throw error;
  }
  const configuredRootFolderPath = normalizedRegistryPath(options.rootFolderPath)
    || normalizedRegistryPath(readVersionHistoryFolderPath());
  if (
    !configuredRootFolderPath
    || !sameHistoryPath(configuredRootFolderPath, plan.rootFolderPath)
  ) {
    const error = new Error("The configured backup folder changed after the retention preview.");
    error.code = "VERSION_HISTORY_RETENTION_ROOT_CHANGED";
    error.statusCode = 409;
    error.folderPath = configuredRootFolderPath || null;
    throw error;
  }
  assertVersionHistoryRetentionPlanCurrent(plan);
  const planFiles = Array.isArray(plan.files) ? plan.files : [];
  const archiveFiles = (plan.files || []).filter(file => file.action === "archive");
  const verificationBytes = planFiles.reduce((sum, file) => sum + file.size, 0);
  const archiveBytes = archiveFiles.reduce((sum, file) => sum + file.size, 0);
  const totalWork = planFiles.length + archiveFiles.length;
  const totalBytes = verificationBytes + archiveBytes;
  const backupFolderPath = path.resolve(plan.backupFolderPath);
  const archiveFolderPath = path.resolve(options.archiveFolderPath || plan.archiveFolderPath);
  const archiveRootPath = path.dirname(archiveFolderPath);
  if (!pathIsInsideFolder(archiveFolderPath, path.dirname(backupFolderPath))) {
    const error = new Error("The retention archive folder is outside the configured backup root.");
    error.code = "VERSION_HISTORY_RETENTION_ARCHIVE_OUTSIDE_ROOT";
    error.statusCode = 400;
    throw error;
  }
  if (
    pathIsInsideFolder(archiveFolderPath, backupFolderPath)
    || pathIsInsideFolder(backupFolderPath, archiveFolderPath)
  ) {
    const error = new Error("The retention archive folder overlaps the active backup folder.");
    error.code = "VERSION_HISTORY_RETENTION_ARCHIVE_OVERLAP";
    error.statusCode = 400;
    throw error;
  }
  if (fs.existsSync(archiveFolderPath)) {
    const error = new Error("The retention archive folder already exists.");
    error.code = "VERSION_HISTORY_RETENTION_ARCHIVE_EXISTS";
    error.statusCode = 409;
    throw error;
  }
  assertManagedRetentionArchiveRoot(configuredRootFolderPath, archiveRootPath, {
    allowMissing: true
  });
  assertRetentionArchivePolicyStateUsable(archiveRootPath);
  if (!archiveFiles.length) {
    progress({
      step: "Nothing to archive",
      completed: 0,
      total: 0,
      completedBytes: 0,
      totalBytes: 0
    });
    return {
      ok: true,
      status: "no-op",
      planId: plan.planId,
      fingerprint: plan.fingerprint,
      archiveFolderPath,
      manifestPath: "",
      archivedFileCount: 0,
      archivedBytes: 0,
      failedFileCount: 0,
      failures: []
    };
  }

  let verifiedBytes = 0;
  planFiles.forEach((file, index) => {
    progress({
      step: `Verifying ${file.fileName}`,
      completed: index,
      total: totalWork,
      completedBytes: verifiedBytes,
      totalBytes
    });
    const sourcePath = path.resolve(file.filePath);
    if (
      path.dirname(sourcePath) !== backupFolderPath
      || path.basename(sourcePath) !== file.fileName
      || (
        file.rawHash
        && !fileMatchesContentHash(sourcePath, file.size, file.rawHash)
      )
    ) {
      const error = new Error(`Version-history backup changed before archival: ${file.fileName}`);
      error.code = "VERSION_HISTORY_RETENTION_STALE";
      error.statusCode = 409;
      error.filePath = sourcePath;
      throw error;
    }
    verifiedBytes += file.size;
  });

  fs.mkdirSync(archiveRootPath, { recursive: true });
  fs.mkdirSync(archiveFolderPath);
  const planPath = path.join(archiveFolderPath, "retention-plan.json");
  const journalPath = path.join(archiveFolderPath, "retention-journal.ndjson");
  const manifestPath = path.join(archiveFolderPath, "retention-manifest.json");
  const manifestState = {
    startedAt: nowIso(),
    archiveFolderPath,
    planPath,
    journalPath,
    files: archiveFiles.map(file => ({
      fileName: file.fileName,
      sourcePath: file.filePath,
      archivePath: path.join(archiveFolderPath, file.fileName),
      size: file.size,
      rawHash: file.rawHash,
      stableHash: file.stableHash,
      storyKey: file.storyKey,
      capturedAt: file.capturedAt,
      reason: file.reason,
      status: "pending",
      error: ""
    }))
  };
  writeRetentionArchiveManifest(
    planPath,
    retentionArchiveManifest(plan, manifestState, "in-progress"),
    true
  );
  fs.writeFileSync(journalPath, "", { encoding: "utf8", flag: "wx" });

  let completedBytes = verifiedBytes;
  for (let index = 0; index < manifestState.files.length; index += 1) {
    const entry = manifestState.files[index];
    let movedToArchive = false;
    progress({
      step: `Archiving ${entry.fileName}`,
      completed: planFiles.length + index,
      total: totalWork,
      completedBytes,
      totalBytes
    });
    try {
      fs.renameSync(entry.sourcePath, entry.archivePath);
      movedToArchive = true;
      if (!fileMatchesContentHash(entry.archivePath, entry.size, entry.rawHash)) {
        const error = new Error(`Archived move verification failed: ${entry.fileName}`);
        error.code = "VERSION_HISTORY_RETENTION_MOVE_VERIFICATION_FAILED";
        throw error;
      }
      appendRetentionArchiveJournal(journalPath, {
        at: nowIso(),
        status: "move-verified",
        fileName: entry.fileName,
        sourcePath: entry.sourcePath,
        archivePath: entry.archivePath,
        size: entry.size,
        rawHash: entry.rawHash
      });
      entry.status = "archived";
      completedBytes += entry.size;
      try {
        appendRetentionArchiveJournal(journalPath, {
          at: nowIso(),
          status: "archived",
          fileName: entry.fileName,
          sourcePath: entry.sourcePath,
          archivePath: entry.archivePath,
          size: entry.size,
          rawHash: entry.rawHash
        });
      } catch {}
    } catch (error) {
      if (
        movedToArchive
        && !fileExists(entry.sourcePath)
        && fileExists(entry.archivePath)
      ) {
        try {
          fs.renameSync(entry.archivePath, entry.sourcePath);
          movedToArchive = false;
        } catch (rollbackError) {
          error.message = `${error?.message || String(error)}; rollback failed: ${rollbackError?.message || String(rollbackError)}`;
        }
      }
      entry.status = "failed";
      entry.error = error?.message || String(error);
      try {
        appendRetentionArchiveJournal(journalPath, {
          at: nowIso(),
          status: "failed",
          fileName: entry.fileName,
          sourcePath: entry.sourcePath,
          archivePath: entry.archivePath,
          size: entry.size,
          rawHash: entry.rawHash,
          error: entry.error
        });
      } catch {}
    }
  }

  const archivedFiles = manifestState.files.filter(file => file.status === "archived");
  const failedFiles = manifestState.files.filter(file => file.status === "failed");
  const status = failedFiles.length ? "partial" : "complete";
  const archiveCompletedAt = nowIso();
  let archiveRetention = null;
  let archivePolicyWarning = "";
  if (status === "complete") {
    try {
      archiveRetention = retentionPolicyForCompletedArchiveRun(
        archiveRootPath,
        archiveFolderPath,
        plan.planId,
        archiveCompletedAt
      );
    } catch (error) {
      archivePolicyWarning = error?.message || String(error);
    }
  }
  writeRetentionArchiveManifest(
    manifestPath,
    retentionArchiveManifest(plan, manifestState, status, "", {
      archiveCompletedAt,
      archiveRetention
    }),
    true
  );
  if (status === "complete" && archiveRetention) {
    try {
      persistRetentionArchivePolicyState(archiveRootPath, archiveRetention);
    } catch (error) {
      archivePolicyWarning = error?.message || String(error);
    }
  }
  progress({
    step: failedFiles.length ? "Archive completed with errors" : "Archive complete",
    completed: totalWork,
    total: totalWork,
    completedBytes,
    totalBytes
  });
  return {
    ok: failedFiles.length === 0,
    status,
    planId: plan.planId,
    fingerprint: plan.fingerprint,
    archiveFolderPath,
    planPath,
    journalPath,
    manifestPath,
    archivedFileCount: archivedFiles.length,
    archivedBytes: archivedFiles.reduce((sum, file) => sum + file.size, 0),
    archiveRetention,
    warnings: archivePolicyWarning ? [{
      type: "archive-expiry-policy",
      message: archivePolicyWarning
    }] : [],
    failedFileCount: failedFiles.length,
    failures: failedFiles.map(file => ({
      fileName: file.fileName,
      sourcePath: file.sourcePath,
      archivePath: file.archivePath,
      error: file.error
    }))
  };
}

function retentionArchiveRunLooksManaged(folderName) {
  return (
    path.basename(asText(folderName)) === asText(folderName)
    && /^retention-\d{4}-\d{2}-\d{2}T/iu.test(asText(folderName))
  );
}

function retentionArchiveFileNameKey(fileName) {
  const value = asText(fileName);
  return process.platform === "win32" ? value.toLowerCase() : value;
}

function sameRetentionArchiveFileName(left, right) {
  return retentionArchiveFileNameKey(left) === retentionArchiveFileNameKey(right);
}

function retentionArchivePolicyStatePath(archiveRootPath) {
  return path.join(path.resolve(archiveRootPath), VERSION_HISTORY_ARCHIVE_POLICY_FILE);
}

function readRetentionArchivePolicyState(archiveRootPath) {
  const filePath = retentionArchivePolicyStatePath(archiveRootPath);
  try {
    const stats = fs.lstatSync(filePath);
    if (!stats.isFile() || stats.isSymbolicLink()) {
      return { status: "malformed", filePath, state: null };
    }
    const parsed = JSON.parse(fs.readFileSync(filePath, "utf8").replace(/^\uFEFF/u, ""));
    const firstCompletedAtMs = Date.parse(asText(parsed?.firstCompletedAt));
    if (
      parsed?.version !== 1
      || !retentionArchiveRunLooksManaged(parsed.firstCompletedRunName)
      || !Number.isFinite(firstCompletedAtMs)
    ) {
      return { status: "malformed", filePath, state: null };
    }
    return {
      status: "valid",
      filePath,
      state: {
        version: 1,
        firstCompletedRunName: parsed.firstCompletedRunName,
        firstCompletedAt: new Date(firstCompletedAtMs).toISOString(),
        firstCompletedPlanId: asText(parsed.firstCompletedPlanId),
        createdAt: asText(parsed.createdAt) || new Date(firstCompletedAtMs).toISOString()
      }
    };
  } catch (error) {
    if (error?.code === "ENOENT") return { status: "missing", filePath, state: null };
    return { status: "malformed", filePath, state: null };
  }
}

function assertManagedRetentionArchiveRoot(rootFolderPath, archiveRootPath, options = {}) {
  const rootFolder = path.resolve(rootFolderPath);
  const archiveRoot = path.resolve(archiveRootPath);
  if (!sameHistoryPath(path.dirname(archiveRoot), rootFolder)) {
    const error = new Error("The retention archive root is outside the configured backup folder.");
    error.code = "VERSION_HISTORY_ARCHIVE_EXPIRY_OUTSIDE_ROOT";
    error.statusCode = 409;
    throw error;
  }
  try {
    const stats = fs.lstatSync(archiveRoot);
    if (!stats.isDirectory() || stats.isSymbolicLink()) throw new Error("linked");
    const configuredRealPath = fs.realpathSync(rootFolder);
    const archiveRealPath = fs.realpathSync(archiveRoot);
    if (!sameHistoryPath(path.dirname(archiveRealPath), configuredRealPath)) throw new Error("outside");
  } catch (error) {
    if (error?.code === "ENOENT" && options.allowMissing) return archiveRoot;
    const unsafe = new Error("The retention archive root is linked, unreadable, or outside the configured backup folder.");
    unsafe.code = "VERSION_HISTORY_ARCHIVE_EXPIRY_OUTSIDE_ROOT";
    unsafe.statusCode = 409;
    throw unsafe;
  }
  return archiveRoot;
}

function requireManagedRetentionArchiveRoot(rootFolderPath, claimedArchiveRootPath, options = {}) {
  const expectedArchiveRootPath = path.resolve(
    versionHistoryJsonArchiveFolderPath(rootFolderPath)
  );
  if (!sameHistoryPath(claimedArchiveRootPath, expectedArchiveRootPath)) {
    const error = new Error("The retention archive path does not match the configured backup folder.");
    error.code = "VERSION_HISTORY_ARCHIVE_EXPIRY_OUTSIDE_ROOT";
    error.statusCode = 409;
    throw error;
  }
  return assertManagedRetentionArchiveRoot(rootFolderPath, expectedArchiveRootPath, options);
}

function versionHistoryArchiveReadyFolderPath(rootFolderPath) {
  const archiveRootPath = versionHistoryJsonArchiveFolderPath(rootFolderPath);
  return archiveRootPath
    ? path.join(archiveRootPath, VERSION_HISTORY_ARCHIVE_READY_FOLDER)
    : "";
}

function requireVersionHistoryArchiveReadyFolder(
  rootFolderPath,
  archiveRootPath,
  options = {}
) {
  const archiveRoot = requireManagedRetentionArchiveRoot(
    rootFolderPath,
    archiveRootPath,
    { allowMissing: !options.create }
  );
  const readyFolderPath = path.join(archiveRoot, VERSION_HISTORY_ARCHIVE_READY_FOLDER);
  if (path.dirname(readyFolderPath) !== archiveRoot) {
    const error = new Error("The manual deletion folder is outside the managed archive folder.");
    error.code = "VERSION_HISTORY_ARCHIVE_READY_FOLDER_UNSAFE";
    error.statusCode = 409;
    throw error;
  }

  let readyFolderStats;
  if (options.create) {
    try {
      fs.mkdirSync(readyFolderPath);
    } catch (error) {
      if (error?.code !== "EEXIST") throw error;
    }
  }

  try {
    readyFolderStats = fs.lstatSync(readyFolderPath);
    const archiveRootRealPath = fs.realpathSync(archiveRoot);
    const readyFolderRealPath = fs.realpathSync(readyFolderPath);
    if (
      !readyFolderStats.isDirectory()
      || readyFolderStats.isSymbolicLink()
      || !sameHistoryPath(path.dirname(readyFolderRealPath), archiveRootRealPath)
    ) {
      throw new Error("linked-or-outside");
    }
  } catch (cause) {
    if (cause?.code === "ENOENT" && !options.create && !readyFolderStats) {
      return readyFolderPath;
    }
    const error = new Error("The manual deletion folder is linked, unreadable, or outside the archive.");
    error.code = "VERSION_HISTORY_ARCHIVE_READY_FOLDER_UNSAFE";
    error.statusCode = 409;
    error.filePath = readyFolderPath;
    error.cause = cause;
    throw error;
  }
  return readyFolderPath;
}

function directVersionHistoryArchiveReadyRunStats(readyFolderPath, folderPath) {
  const readyFolderRealPath = fs.realpathSync(readyFolderPath);
  const folderStats = fs.lstatSync(folderPath);
  const folderRealPath = fs.realpathSync(folderPath);
  if (
    !folderStats.isDirectory()
    || folderStats.isSymbolicLink()
    || !sameHistoryPath(path.dirname(folderRealPath), readyFolderRealPath)
  ) {
    throw new Error("The queued archive run is linked or outside the manual deletion folder.");
  }

  const versionHistorySuffixKey = retentionArchiveFileNameKey(VERSION_HISTORY_FILE_SUFFIX);
  let fileCount = 0;
  let bytes = 0;
  let unsafeItemCount = 0;
  for (const entry of fs.readdirSync(folderPath, { withFileTypes: true })) {
    const filePath = path.join(folderPath, entry.name);
    try {
      const stats = fs.lstatSync(filePath);
      const fileRealPath = fs.realpathSync(filePath);
      if (
        !entry.isFile()
        || entry.isSymbolicLink()
        || !stats.isFile()
        || stats.isSymbolicLink()
        || stats.nlink !== 1
        || !sameHistoryPath(path.dirname(fileRealPath), folderRealPath)
      ) {
        unsafeItemCount += 1;
        continue;
      }
      if (retentionArchiveFileNameKey(entry.name).endsWith(versionHistorySuffixKey)) {
        fileCount += 1;
        bytes += stats.size;
      }
    } catch {
      unsafeItemCount += 1;
    }
  }
  return { fileCount, bytes, unsafeItemCount };
}

function versionHistoryArchiveReadyStatus(options = {}) {
  const rootFolderPath = normalizedRegistryPath(options.rootFolderPath)
    || normalizedRegistryPath(readVersionHistoryFolderPath());
  const emptyStatus = {
    ready: false,
    unsafe: false,
    itemCount: 0,
    runCount: 0,
    bytes: 0,
    folderPath: rootFolderPath ? versionHistoryArchiveReadyFolderPath(rootFolderPath) : "",
    runs: [],
    unrecognizedItemCount: 0,
    unsafeItemCount: 0
  };
  if (!rootFolderPath || !directoryExists(rootFolderPath)) return emptyStatus;

  const archiveRootPath = versionHistoryJsonArchiveFolderPath(rootFolderPath);
  let readyFolderPath;
  try {
    readyFolderPath = requireVersionHistoryArchiveReadyFolder(
      rootFolderPath,
      archiveRootPath
    );
  } catch (error) {
    return {
      ...emptyStatus,
      ready: true,
      unsafe: true,
      warning: error?.message || "The manual deletion folder needs review."
    };
  }
  try {
    fs.lstatSync(readyFolderPath);
  } catch (error) {
    if (error?.code === "ENOENT") return { ...emptyStatus, folderPath: readyFolderPath };
    return {
      ...emptyStatus,
      ready: true,
      unsafe: true,
      folderPath: readyFolderPath,
      warning: error?.message || "The manual deletion folder could not be checked."
    };
  }

  let entries;
  try {
    entries = fs.readdirSync(readyFolderPath, { withFileTypes: true });
  } catch (error) {
    return {
      ...emptyStatus,
      ready: true,
      unsafe: true,
      folderPath: readyFolderPath,
      warning: error?.message || "The manual deletion folder could not be read."
    };
  }

  const runs = [];
  for (const entry of entries) {
    if (
      !entry.isDirectory()
      || entry.isSymbolicLink()
      || !retentionArchiveRunLooksManaged(entry.name)
    ) {
      continue;
    }
    const folderPath = path.join(readyFolderPath, entry.name);
    let fileCount = 0;
    let bytes = 0;
    let unsafeItemCount = 0;
    try {
      ({ fileCount, bytes, unsafeItemCount } = directVersionHistoryArchiveReadyRunStats(
        readyFolderPath,
        folderPath
      ));
    } catch {
      unsafeItemCount += 1;
    }
    runs.push({
      folderName: entry.name,
      folderPath,
      fileCount,
      bytes,
      ...(unsafeItemCount > 0 ? { unsafeItemCount } : {})
    });
  }

  const unsafeRunItemCount = runs.reduce(
    (sum, run) => sum + (run.unsafeItemCount || 0),
    0
  );
  return {
    ready: entries.length > 0,
    unsafe: unsafeRunItemCount > 0,
    itemCount: entries.length,
    runCount: runs.length,
    bytes: runs.reduce((sum, run) => sum + run.bytes, 0),
    folderPath: readyFolderPath,
    runs,
    unrecognizedItemCount: Math.max(0, entries.length - runs.length),
    unsafeItemCount: unsafeRunItemCount,
    ...(unsafeRunItemCount > 0
      ? { warning: "Some queued archive contents could not be verified safely." }
      : {})
  };
}

function completedRetentionArchiveIdentities(archiveRootPath) {
  if (!directoryExists(archiveRootPath)) return [];
  const archiveRoot = path.resolve(archiveRootPath);
  return fs.readdirSync(archiveRoot, { withFileTypes: true })
    .filter(entry => entry.isDirectory() && !entry.isSymbolicLink() && retentionArchiveRunLooksManaged(entry.name))
    .map(entry => {
      const archiveFolderPath = path.join(archiveRoot, entry.name);
      const manifestPath = path.join(archiveFolderPath, VERSION_HISTORY_ARCHIVE_MANIFEST_FILE);
      try {
        const manifestStats = fs.lstatSync(manifestPath);
        if (!manifestStats.isFile() || manifestStats.isSymbolicLink()) return null;
        const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8").replace(/^\uFEFF/u, ""));
        const completedAtMs = Date.parse(asText(manifest?.archiveCompletedAt));
        if (
          manifest?.version !== 1
          || manifest?.status !== "complete"
          || !Number.isFinite(completedAtMs)
          || !sameHistoryPath(manifest.archiveFolderPath, archiveFolderPath)
        ) {
          return null;
        }
        return {
          folderName: entry.name,
          completedAt: new Date(completedAtMs).toISOString(),
          completedAtMs,
          planId: asText(manifest.planId)
        };
      } catch {
        return null;
      }
    })
    .filter(Boolean)
    .sort((left, right) => left.completedAtMs - right.completedAtMs
      || left.folderName.localeCompare(right.folderName));
}

function assertRetentionArchivePolicyStateUsable(archiveRootPath) {
  const policyState = readRetentionArchivePolicyState(archiveRootPath);
  if (policyState.status === "malformed") {
    const error = new Error("The retention archive policy record is malformed. Archive storage was not changed.");
    error.code = "VERSION_HISTORY_ARCHIVE_POLICY_MALFORMED";
    error.statusCode = 409;
    error.filePath = policyState.filePath;
    throw error;
  }
  return policyState;
}

function retentionPolicyForCompletedArchiveRun(
  archiveRootPath,
  archiveFolderPath,
  planId,
  archiveCompletedAt
) {
  const policyState = assertRetentionArchivePolicyStateUsable(archiveRootPath);
  const folderName = path.basename(path.resolve(archiveFolderPath));
  const completedAtMs = Date.parse(asText(archiveCompletedAt));
  const completedAt = new Date(completedAtMs).toISOString();
  let firstCompletedRunName = policyState.state?.firstCompletedRunName || "";
  let firstCompletedAt = policyState.state?.firstCompletedAt || "";
  let firstCompletedPlanId = policyState.state?.firstCompletedPlanId || "";
  if (!firstCompletedRunName) {
    const previousRuns = completedRetentionArchiveIdentities(archiveRootPath)
      .filter(run => run.folderName !== folderName);
    const firstRun = previousRuns[0] || {
      folderName,
      completedAt,
      planId: asText(planId)
    };
    firstCompletedRunName = firstRun.folderName;
    firstCompletedAt = firstRun.completedAt;
    firstCompletedPlanId = firstRun.planId;
  }
  const days = folderName === firstCompletedRunName
    ? VERSION_HISTORY_ARCHIVE_EXPIRY_POLICY.firstRunDays
    : VERSION_HISTORY_ARCHIVE_EXPIRY_POLICY.standardRetentionDays;
  return {
    version: 1,
    days,
    expiresAt: new Date(completedAtMs + (days * 24 * 60 * 60 * 1000)).toISOString(),
    firstCompletedRunName,
    firstCompletedAt,
    firstCompletedPlanId
  };
}

function persistRetentionArchivePolicyState(archiveRootPath, archiveRetention) {
  const current = assertRetentionArchivePolicyStateUsable(archiveRootPath);
  const desired = {
    version: 1,
    firstCompletedRunName: asText(archiveRetention?.firstCompletedRunName),
    firstCompletedAt: asText(archiveRetention?.firstCompletedAt),
    firstCompletedPlanId: asText(archiveRetention?.firstCompletedPlanId),
    createdAt: current.state?.createdAt || nowIso()
  };
  if (
    !retentionArchiveRunLooksManaged(desired.firstCompletedRunName)
    || !Number.isFinite(Date.parse(desired.firstCompletedAt))
  ) {
    const error = new Error("Cannot persist an incomplete retention archive policy record.");
    error.code = "VERSION_HISTORY_ARCHIVE_POLICY_INVALID";
    error.statusCode = 500;
    throw error;
  }
  if (current.status === "valid") {
    if (
      current.state.firstCompletedRunName !== desired.firstCompletedRunName
      || current.state.firstCompletedAt !== desired.firstCompletedAt
    ) {
      const error = new Error("The retention archive policy record conflicts with this archive run.");
      error.code = "VERSION_HISTORY_ARCHIVE_POLICY_CONFLICT";
      error.statusCode = 409;
      throw error;
    }
    return current.state;
  }
  const filePath = retentionArchivePolicyStatePath(archiveRootPath);
  try {
    fs.writeFileSync(filePath, `${JSON.stringify(desired, null, 2)}\n`, {
      encoding: "utf8",
      flag: "wx"
    });
  } catch (error) {
    if (error?.code !== "EEXIST") throw error;
    const raced = assertRetentionArchivePolicyStateUsable(archiveRootPath);
    if (
      raced.status !== "valid"
      || raced.state.firstCompletedRunName !== desired.firstCompletedRunName
      || raced.state.firstCompletedAt !== desired.firstCompletedAt
    ) {
      const conflict = new Error("The retention archive policy record changed unexpectedly.");
      conflict.code = "VERSION_HISTORY_ARCHIVE_POLICY_CONFLICT";
      conflict.statusCode = 409;
      throw conflict;
    }
    return raced.state;
  }
  return desired;
}

function retentionArchiveRunFingerprint(fileEntries) {
  return textHash(JSON.stringify(fileEntries
    .map(entry => [entry.fileName, entry.size, entry.mtimeMs, entry.rawHash])
    .sort((left, right) => left[0].localeCompare(right[0]))));
}

function retentionArchiveProtectedRun(folderName, archiveFolderPath, reason, details = {}) {
  return {
    folderName,
    archiveFolderPath,
    status: details.status || "protected",
    completedAt: details.completedAt || "",
    retentionDays: 0,
    expiresAt: "",
    fileCount: Math.max(0, Number(details.fileCount) || 0),
    bytes: Math.max(0, Number(details.bytes) || 0),
    pinned: Boolean(details.pinned),
    protected: true,
    expired: false,
    movableToManualDeletion: false,
    protectedReason: reason,
    directoryFingerprint: details.directoryFingerprint || "",
    expectedFiles: []
  };
}

function inspectVersionHistoryRetentionArchiveRun(
  archiveRootPath,
  rootFolderPath,
  folderName,
  progress = () => {}
) {
  const archiveRoot = path.resolve(archiveRootPath);
  const archiveFolderPath = path.join(archiveRoot, folderName);
  if (
    path.dirname(archiveFolderPath) !== archiveRoot
    || !retentionArchiveRunLooksManaged(folderName)
  ) {
    return retentionArchiveProtectedRun(
      folderName,
      archiveFolderPath,
      "outside-managed-archive-root"
    );
  }
  let folderStats;
  try {
    folderStats = fs.lstatSync(archiveFolderPath);
    const rootRealPath = fs.realpathSync(archiveRoot);
    const folderRealPath = fs.realpathSync(archiveFolderPath);
    if (
      !folderStats.isDirectory()
      || folderStats.isSymbolicLink()
      || !sameHistoryPath(path.dirname(folderRealPath), rootRealPath)
    ) {
      return retentionArchiveProtectedRun(
        folderName,
        archiveFolderPath,
        "linked-or-outside-managed-archive-root"
      );
    }
  } catch {
    return retentionArchiveProtectedRun(folderName, archiveFolderPath, "unreadable");
  }

  let entries;
  try {
    entries = fs.readdirSync(archiveFolderPath, { withFileTypes: true });
  } catch {
    return retentionArchiveProtectedRun(folderName, archiveFolderPath, "unreadable");
  }
  const nonFlatEntry = entries.find(entry => !entry.isFile() || entry.isSymbolicLink());
  if (nonFlatEntry) {
    return retentionArchiveProtectedRun(folderName, archiveFolderPath, "unknown-or-linked-contents");
  }
  const entryNames = new Set(entries.map(entry => retentionArchiveFileNameKey(entry.name)));
  if (entryNames.size !== entries.length) {
    return retentionArchiveProtectedRun(folderName, archiveFolderPath, "duplicate-file-names");
  }
  const pinMarkerPresent = entryNames.has(retentionArchiveFileNameKey(VERSION_HISTORY_ARCHIVE_PIN_FILE));
  const manifestPath = path.join(archiveFolderPath, VERSION_HISTORY_ARCHIVE_MANIFEST_FILE);
  const planPath = path.join(archiveFolderPath, VERSION_HISTORY_ARCHIVE_PLAN_FILE);
  const journalPath = path.join(archiveFolderPath, VERSION_HISTORY_ARCHIVE_JOURNAL_FILE);
  let manifest;
  let archivePlan;
  try {
    manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8").replace(/^\uFEFF/u, ""));
    archivePlan = JSON.parse(fs.readFileSync(planPath, "utf8").replace(/^\uFEFF/u, ""));
    fs.accessSync(journalPath, fs.constants.R_OK);
    if (pinMarkerPresent) fs.accessSync(path.join(archiveFolderPath, VERSION_HISTORY_ARCHIVE_PIN_FILE), fs.constants.R_OK);
  } catch {
    return retentionArchiveProtectedRun(folderName, archiveFolderPath, "malformed-or-unreadable", {
      pinned: pinMarkerPresent
    });
  }
  const manifestPinned = Boolean(
    manifest?.pinned === true
    || manifest?.retentionPinned === true
    || manifest?.archiveRetention?.pinned === true
  );
  const pinned = pinMarkerPresent || manifestPinned;
  const completedAtMs = Date.parse(asText(manifest?.archiveCompletedAt));
  const baseDetails = {
    status: asText(manifest?.status) || "malformed",
    completedAt: Number.isFinite(completedAtMs) ? new Date(completedAtMs).toISOString() : "",
    pinned
  };
  if (manifest?.version !== 1 || archivePlan?.version !== 1) {
    return retentionArchiveProtectedRun(folderName, archiveFolderPath, "unsupported-or-malformed-manifest", baseDetails);
  }
  if (manifest.status !== "complete") {
    const reason = manifest.status === "partial" || manifest.status === "failed"
      ? "failed-or-partial"
      : "incomplete";
    return retentionArchiveProtectedRun(folderName, archiveFolderPath, reason, baseDetails);
  }
  if (
    !Number.isFinite(completedAtMs)
    || archivePlan.status !== "in-progress"
    || !asText(manifest.planId)
    || manifest.planId !== archivePlan.planId
    || manifest.planFingerprint !== archivePlan.planFingerprint
    || manifest.directoryFingerprint !== archivePlan.directoryFingerprint
    || !sameHistoryPath(manifest.archiveFolderPath, archiveFolderPath)
    || !sameHistoryPath(archivePlan.archiveFolderPath, archiveFolderPath)
    || !sameHistoryPath(manifest.rootFolderPath, rootFolderPath)
    || !sameHistoryPath(archivePlan.rootFolderPath, rootFolderPath)
    || !sameHistoryPath(manifest.backupFolderPath, versionHistoryJsonBackupFolderPath(rootFolderPath))
    || !sameHistoryPath(archivePlan.backupFolderPath, versionHistoryJsonBackupFolderPath(rootFolderPath))
    || !sameHistoryPath(manifest.archivePlanPath, planPath)
    || !sameHistoryPath(archivePlan.archivePlanPath, planPath)
    || !sameHistoryPath(manifest.archiveJournalPath, journalPath)
    || !sameHistoryPath(archivePlan.archiveJournalPath, journalPath)
  ) {
    return retentionArchiveProtectedRun(folderName, archiveFolderPath, "changed-or-outside-root", baseDetails);
  }
  const manifestFiles = Array.isArray(manifest.files) ? manifest.files : [];
  const planFiles = Array.isArray(archivePlan.files) ? archivePlan.files : [];
  if (!manifestFiles.length || manifestFiles.length !== planFiles.length) {
    return retentionArchiveProtectedRun(folderName, archiveFolderPath, "incomplete-manifest", baseDetails);
  }
  const planFilesByName = new Map();
  for (const file of planFiles) {
    const fileName = asText(file?.fileName);
    const fileNameKey = retentionArchiveFileNameKey(fileName);
    if (
      path.basename(fileName) !== fileName
      || !fileName
      || planFilesByName.has(fileNameKey)
      || file.status !== "pending"
      || !sameHistoryPath(file.archivePath, path.join(archiveFolderPath, fileName))
      || !sameHistoryPath(
        path.dirname(path.resolve(asText(file.sourcePath))),
        versionHistoryJsonBackupFolderPath(rootFolderPath)
      )
      || !sameRetentionArchiveFileName(path.basename(path.resolve(asText(file.sourcePath))), fileName)
      || !/^[a-f0-9]{64}$/iu.test(asText(file.rawHash))
      || !Number.isSafeInteger(file.size)
      || file.size < 0
    ) {
      return retentionArchiveProtectedRun(folderName, archiveFolderPath, "malformed-plan-files", baseDetails);
    }
    planFilesByName.set(fileNameKey, file);
  }
  const dataFileNames = new Set();
  for (const file of manifestFiles) {
    const fileName = asText(file?.fileName);
    const fileNameKey = retentionArchiveFileNameKey(fileName);
    const planned = planFilesByName.get(fileNameKey);
    if (
      path.basename(fileName) !== fileName
      || !fileName
      || dataFileNames.has(fileNameKey)
      || file.status !== "archived"
      || !planned
      || !sameHistoryPath(file.archivePath, path.join(archiveFolderPath, fileName))
      || !sameHistoryPath(
        path.dirname(path.resolve(asText(file.sourcePath))),
        versionHistoryJsonBackupFolderPath(rootFolderPath)
      )
      || !sameRetentionArchiveFileName(path.basename(path.resolve(asText(file.sourcePath))), fileName)
      || file.rawHash !== planned.rawHash
      || file.size !== planned.size
      || !/^[a-f0-9]{64}$/iu.test(asText(file.rawHash))
      || !Number.isSafeInteger(file.size)
      || file.size < 0
    ) {
      return retentionArchiveProtectedRun(folderName, archiveFolderPath, "malformed-manifest-files", baseDetails);
    }
    dataFileNames.add(fileNameKey);
  }
  const reservedNames = new Set([
    VERSION_HISTORY_ARCHIVE_MANIFEST_FILE,
    VERSION_HISTORY_ARCHIVE_PLAN_FILE,
    VERSION_HISTORY_ARCHIVE_JOURNAL_FILE,
    VERSION_HISTORY_ARCHIVE_PIN_FILE
  ].map(retentionArchiveFileNameKey));
  if ([...dataFileNames].some(fileNameKey => reservedNames.has(fileNameKey))) {
    return retentionArchiveProtectedRun(folderName, archiveFolderPath, "reserved-file-name", baseDetails);
  }
  const expectedFileNames = [
    VERSION_HISTORY_ARCHIVE_MANIFEST_FILE,
    VERSION_HISTORY_ARCHIVE_PLAN_FILE,
    VERSION_HISTORY_ARCHIVE_JOURNAL_FILE,
    ...manifestFiles.map(file => file.fileName)
  ];
  if (pinMarkerPresent) expectedFileNames.push(VERSION_HISTORY_ARCHIVE_PIN_FILE);
  const expectedNames = new Set(expectedFileNames.map(retentionArchiveFileNameKey));
  if (
    expectedNames.size !== entryNames.size
    || [...entryNames].some(fileNameKey => !expectedNames.has(fileNameKey))
  ) {
    return retentionArchiveProtectedRun(folderName, archiveFolderPath, "unknown-contents", baseDetails);
  }

  const expectedFiles = [];
  try {
    for (const fileName of expectedFileNames.slice().sort()) {
      const filePath = path.join(archiveFolderPath, fileName);
      const stats = fs.lstatSync(filePath);
      if (
        !stats.isFile()
        || stats.isSymbolicLink()
        || stats.nlink !== 1
        || path.dirname(filePath) !== archiveFolderPath
      ) {
        throw new Error("Archive entry is not a direct regular file.");
      }
      const rawHash = sha256File(filePath);
      const manifestEntry = manifestFiles.find(file => file.fileName === fileName);
      if (
        manifestEntry
        && (stats.size !== manifestEntry.size || rawHash !== manifestEntry.rawHash)
      ) {
        throw new Error("Archived content does not match its manifest.");
      }
      expectedFiles.push({
        fileName,
        size: stats.size,
        mtimeMs: Math.trunc(stats.mtimeMs),
        rawHash
      });
      progress({
        step: `Checking archived file ${fileName}`,
        completedBytes: stats.size
      });
    }
  } catch {
    return retentionArchiveProtectedRun(folderName, archiveFolderPath, "changed-or-unreadable-contents", baseDetails);
  }
  const directoryFingerprint = retentionArchiveRunFingerprint(expectedFiles);
  const bytes = manifestFiles.reduce((sum, file) => sum + file.size, 0);
  return {
    folderName,
    archiveFolderPath,
    status: "complete",
    planId: manifest.planId,
    completedAt: new Date(completedAtMs).toISOString(),
    completedAtMs,
    retentionDays: 0,
    expiresAt: "",
    fileCount: manifestFiles.length,
    bytes,
    pinned,
    protected: pinned,
    expired: false,
    movableToManualDeletion: false,
    protectedReason: pinned ? "pinned" : "",
    directoryFingerprint,
    expectedFiles,
    declaredRetention: manifest.archiveRetention || null
  };
}

function versionHistoryRetentionArchiveRootFingerprint(archiveRootPath, runs, policyState) {
  if (!directoryExists(archiveRootPath)) return textHash("[]");
  const runFingerprints = new Map(runs.map(run => [run.folderName, run.directoryFingerprint || ""]));
  const entries = fs.readdirSync(archiveRootPath, { withFileTypes: true }).map(entry => {
    const entryPath = path.join(archiveRootPath, entry.name);
    let stats;
    try {
      stats = fs.lstatSync(entryPath);
    } catch {
      return [entry.name, "unreadable"];
    }
    const type = stats.isSymbolicLink()
      ? "link"
      : stats.isDirectory()
        ? "directory"
        : stats.isFile()
          ? "file"
          : "other";
    let contentHash = "";
    if (entry.name === VERSION_HISTORY_ARCHIVE_POLICY_FILE && stats.isFile() && !stats.isSymbolicLink()) {
      try {
        contentHash = sha256File(entryPath);
      } catch {
        contentHash = "unreadable";
      }
    }
    return [
      entry.name,
      type,
      stats.size,
      Math.trunc(stats.mtimeMs),
      runFingerprints.get(entry.name) || contentHash
    ];
  });
  entries.push(["policy-status", policyState.status]);
  return textHash(JSON.stringify(entries.sort((left, right) => left[0].localeCompare(right[0]))));
}

function scanVersionHistoryRetentionArchives(options = {}, progress = () => {}) {
  const rootFolderPath = normalizedRegistryPath(options.rootFolderPath)
    || requireVersionHistoryFolderPath();
  if (!rootFolderPath) {
    throw new BackupFolderMissingError(readVersionHistoryFolderPath() || "No backup folder selected");
  }
  const archiveRootPath = versionHistoryJsonArchiveFolderPath(rootFolderPath);
  assertManagedRetentionArchiveRoot(rootFolderPath, archiveRootPath, { allowMissing: true });
  const policyState = readRetentionArchivePolicyState(archiveRootPath);
  const names = directoryExists(archiveRootPath)
    ? fs.readdirSync(archiveRootPath, { withFileTypes: true })
      .filter(entry => retentionArchiveRunLooksManaged(entry.name))
      .map(entry => entry.name)
      .sort()
    : [];
  let completedBytes = 0;
  const runs = names.map((folderName, index) => {
    progress({
      step: `Checking archive ${folderName}`,
      completed: index,
      total: names.length,
      completedBytes,
      totalBytes: 0
    });
    const run = inspectVersionHistoryRetentionArchiveRun(
      archiveRootPath,
      rootFolderPath,
      folderName,
      value => {
        completedBytes += Math.max(0, Number(value?.completedBytes) || 0);
      }
    );
    return run;
  });
  const validCompleted = runs
    .filter(run => run.status === "complete" && run.directoryFingerprint)
    .sort((left, right) => left.completedAtMs - right.completedAtMs
      || left.folderName.localeCompare(right.folderName));
  const derivedFirstRun = policyState.status === "valid"
    ? {
        folderName: policyState.state.firstCompletedRunName,
        completedAt: policyState.state.firstCompletedAt,
        planId: policyState.state.firstCompletedPlanId
      }
    : validCompleted[0]
      ? {
          folderName: validCompleted[0].folderName,
          completedAt: validCompleted[0].completedAt,
          planId: validCompleted[0].planId
        }
      : null;
  const nowMs = retentionTimeMs(options.now, Date.now());
  runs.forEach(run => {
    if (run.status !== "complete" || !run.directoryFingerprint) return;
    if (policyState.status === "malformed") {
      run.protected = true;
      run.protectedReason = "malformed-policy-state";
      return;
    }
    if (run.completedAtMs > nowMs) {
      run.protected = true;
      run.protectedReason = "future-completion-time";
      return;
    }
    const expectedDays = run.folderName === derivedFirstRun?.folderName
      ? VERSION_HISTORY_ARCHIVE_EXPIRY_POLICY.firstRunDays
      : VERSION_HISTORY_ARCHIVE_EXPIRY_POLICY.standardRetentionDays;
    const declared = run.declaredRetention;
    if (declared != null) {
      const declaredDays = Number(declared?.days);
      const declaredExpiresAtMs = Date.parse(asText(declared?.expiresAt));
      const expectedExpiresAtMs = run.completedAtMs + (expectedDays * 24 * 60 * 60 * 1000);
      if (
        declared?.version !== 1
        || declaredDays !== expectedDays
        || !Number.isFinite(declaredExpiresAtMs)
        || declaredExpiresAtMs !== expectedExpiresAtMs
        || asText(declared.firstCompletedRunName) !== asText(derivedFirstRun?.folderName)
        || asText(declared.firstCompletedAt) !== asText(derivedFirstRun?.completedAt)
        || asText(declared.firstCompletedPlanId) !== asText(derivedFirstRun?.planId)
      ) {
        run.protected = true;
        run.protectedReason = "changed-retention-metadata";
        return;
      }
    }
    run.retentionDays = expectedDays;
    run.expiresAt = new Date(
      run.completedAtMs + (expectedDays * 24 * 60 * 60 * 1000)
    ).toISOString();
    run.expired = nowMs >= Date.parse(run.expiresAt);
    run.movableToManualDeletion = run.expired && !run.pinned && !run.protectedReason;
    run.protected = Boolean(run.pinned || run.protectedReason);
  });
  const archiveRootFingerprint = versionHistoryRetentionArchiveRootFingerprint(
    archiveRootPath,
    runs,
    policyState
  );
  return {
    rootFolderPath,
    archiveRootPath,
    archiveRootFingerprint,
    policyStateStatus: policyState.status,
    policyStatePath: policyState.filePath,
    firstCompletedRunName: derivedFirstRun?.folderName || "",
    firstCompletedAt: derivedFirstRun?.completedAt || "",
    firstCompletedPlanId: derivedFirstRun?.planId || "",
    runs
  };
}

function previewVersionHistoryRetentionArchiveExpiry(options = {}, progress = () => {}) {
  const planId = asText(options.planId) || id("archive-expiry-plan");
  const scan = scanVersionHistoryRetentionArchives(options, progress);
  const readyForManualDeletion = versionHistoryArchiveReadyStatus({
    rootFolderPath: scan.rootFolderPath
  });
  const runs = scan.runs.map(run => ({ ...run }));
  const movableRuns = runs.filter(run => run.movableToManualDeletion);
  const protectedRuns = runs.filter(run => run.protected);
  const completedRuns = runs.filter(run => run.status === "complete");
  const retainedRuns = runs.filter(run => !run.movableToManualDeletion);
  const fingerprint = textHash(JSON.stringify({
    archiveRootFingerprint: scan.archiveRootFingerprint,
    firstCompletedRunName: scan.firstCompletedRunName,
    runs: runs.map(run => [
      run.folderName,
      run.directoryFingerprint,
      run.movableToManualDeletion,
      run.protectedReason
    ])
  }));
  progress({
    step: "Archive expiry preview complete",
    completed: runs.length,
    total: runs.length,
    completedBytes: runs.reduce((sum, run) => sum + run.bytes, 0),
    totalBytes: runs.reduce((sum, run) => sum + run.bytes, 0)
  });
  const summary = {
    managedRunCount: runs.length,
    runCount: runs.length,
    completedRunCount: completedRuns.length,
    retainedRunCount: retainedRuns.length,
    pinnedRunCount: runs.filter(run => run.pinned).length,
    protectedRunCount: protectedRuns.length,
    expiredRunCount: movableRuns.length,
    expiredBytes: movableRuns.reduce((sum, run) => sum + run.bytes, 0),
    movableRunCount: movableRuns.length,
    movableBytes: movableRuns.reduce((sum, run) => sum + run.bytes, 0),
    firstRunRetentionDays: VERSION_HISTORY_ARCHIVE_EXPIRY_POLICY.firstRunDays,
    standardRetentionDays: VERSION_HISTORY_ARCHIVE_EXPIRY_POLICY.standardRetentionDays,
    readyForManualDeletionRunCount: readyForManualDeletion.runCount,
    readyForManualDeletionBytes: readyForManualDeletion.bytes
  };
  return {
    ok: true,
    planId,
    fingerprint,
    generatedAt: new Date(retentionTimeMs(options.now, Date.now())).toISOString(),
    rootFolderPath: scan.rootFolderPath,
    archiveRootPath: scan.archiveRootPath,
    archiveRootFingerprint: scan.archiveRootFingerprint,
    policyStateStatus: scan.policyStateStatus,
    policyStatePath: scan.policyStatePath,
    firstCompletedRunName: scan.firstCompletedRunName,
    firstCompletedAt: scan.firstCompletedAt,
    firstCompletedPlanId: scan.firstCompletedPlanId,
    policy: {
      firstRunRetentionDays: VERSION_HISTORY_ARCHIVE_EXPIRY_POLICY.firstRunDays,
      standardRetentionDays: VERSION_HISTORY_ARCHIVE_EXPIRY_POLICY.standardRetentionDays
    },
    readyForManualDeletion,
    ...summary,
    summary,
    runs
  };
}

function previewVersionHistoryArchiveExpiry(options = {}, progress = () => {}) {
  return previewVersionHistoryRetentionArchiveExpiry(options, progress);
}

function assertVersionHistoryArchiveExpiryPlanCurrent(plan, options = {}, progress = () => {}) {
  if (!plan?.planId || !plan?.fingerprint || !plan?.archiveRootFingerprint) {
    const error = new Error("Archive expiry plan is incomplete.");
    error.code = "VERSION_HISTORY_ARCHIVE_EXPIRY_INVALID_PLAN";
    error.statusCode = 400;
    throw error;
  }
  const current = scanVersionHistoryRetentionArchives({
    rootFolderPath: plan.rootFolderPath,
    now: options.now
  }, progress);
  if (current.archiveRootFingerprint !== plan.archiveRootFingerprint) {
    const error = new Error("Retention archives changed after the preview. Scan again before moving.");
    error.code = "VERSION_HISTORY_ARCHIVE_EXPIRY_STALE";
    error.statusCode = 409;
    error.expectedFingerprint = plan.archiveRootFingerprint;
    error.currentFingerprint = current.archiveRootFingerprint;
    throw error;
  }
  const currentByName = new Map(current.runs.map(run => [run.folderName, run]));
  const candidates = (Array.isArray(plan.runs) ? plan.runs : [])
    .filter(run => run.movableToManualDeletion);
  for (const planned of candidates) {
    const currentRun = currentByName.get(planned.folderName);
    if (
      !currentRun
      || !currentRun.movableToManualDeletion
      || currentRun.directoryFingerprint !== planned.directoryFingerprint
    ) {
      const error = new Error(`Retention archive changed after the preview: ${planned.folderName}`);
      error.code = "VERSION_HISTORY_ARCHIVE_EXPIRY_STALE";
      error.statusCode = 409;
      throw error;
    }
  }
  return { current, candidates: candidates.map(run => currentByName.get(run.folderName)) };
}

function assertVersionHistoryArchiveRunReadyForMove(archiveRootPath, run) {
  const archiveRoot = path.resolve(archiveRootPath);
  const archiveFolderPath = path.join(archiveRoot, run.folderName);
  if (
    path.dirname(archiveFolderPath) !== archiveRoot
    || !sameHistoryPath(archiveFolderPath, run.archiveFolderPath)
  ) {
    const error = new Error(`Archive run is outside the managed archive root: ${run.folderName}`);
    error.code = "VERSION_HISTORY_ARCHIVE_EXPIRY_OUTSIDE_ROOT";
    error.statusCode = 400;
    throw error;
  }

  const folderStats = fs.lstatSync(archiveFolderPath);
  const rootRealPath = fs.realpathSync(archiveRoot);
  const folderRealPath = fs.realpathSync(archiveFolderPath);
  const currentEntries = fs.readdirSync(archiveFolderPath, { withFileTypes: true });
  const expectedNames = new Set(
    run.expectedFiles.map(file => retentionArchiveFileNameKey(file.fileName))
  );
  if (
    !folderStats.isDirectory()
    || folderStats.isSymbolicLink()
    || !sameHistoryPath(path.dirname(folderRealPath), rootRealPath)
    || currentEntries.length !== expectedNames.size
    || currentEntries.some(entry => (
      !entry.isFile()
      || entry.isSymbolicLink()
      || !expectedNames.has(retentionArchiveFileNameKey(entry.name))
    ))
  ) {
    const error = new Error(`Archive run inventory changed before moving: ${run.folderName}`);
    error.code = "VERSION_HISTORY_ARCHIVE_EXPIRY_STALE";
    error.statusCode = 409;
    throw error;
  }

  for (const file of run.expectedFiles) {
    const filePath = path.join(archiveFolderPath, file.fileName);
    const stats = fs.lstatSync(filePath);
    if (
      path.dirname(filePath) !== archiveFolderPath
      || !stats.isFile()
      || stats.isSymbolicLink()
      || stats.nlink !== 1
      || stats.size !== file.size
      || Math.trunc(stats.mtimeMs) !== file.mtimeMs
      || sha256File(filePath) !== file.rawHash
    ) {
      const error = new Error(`Archive run changed before moving: ${run.folderName}`);
      error.code = "VERSION_HISTORY_ARCHIVE_EXPIRY_STALE";
      error.statusCode = 409;
      throw error;
    }
  }
  return archiveFolderPath;
}

function assertVersionHistoryArchiveReadyDestinationAvailable(
  rootFolderPath,
  archiveRootPath,
  readyFolderPath,
  run
) {
  const archiveRoot = requireManagedRetentionArchiveRoot(rootFolderPath, archiveRootPath);
  const readyFolder = requireVersionHistoryArchiveReadyFolder(
    rootFolderPath,
    archiveRoot,
    { create: true }
  );
  const folderName = asText(run?.folderName);
  const destinationFolderPath = path.join(readyFolder, folderName);
  if (
    !sameHistoryPath(readyFolder, readyFolderPath)
    || path.dirname(readyFolder) !== archiveRoot
    || !retentionArchiveRunLooksManaged(folderName)
    || path.basename(folderName) !== folderName
    || path.dirname(destinationFolderPath) !== readyFolder
  ) {
    const error = new Error("A manual deletion destination is outside the managed archive folder.");
    error.code = "VERSION_HISTORY_ARCHIVE_EXPIRY_OUTSIDE_ROOT";
    error.statusCode = 409;
    throw error;
  }

  try {
    fs.lstatSync(destinationFolderPath);
    const error = new Error(`Manual-deletion destination already exists: ${folderName}`);
    error.code = "VERSION_HISTORY_ARCHIVE_READY_COLLISION";
    error.statusCode = 409;
    throw error;
  } catch (error) {
    if (error?.code !== "ENOENT") throw error;
  }
  return destinationFolderPath;
}

function assertVersionHistoryArchiveRenameBoundaryCurrent(
  rootFolderPath,
  archiveRootPath,
  readyFolderPath,
  run
) {
  const archiveRoot = requireManagedRetentionArchiveRoot(rootFolderPath, archiveRootPath);
  const readyFolder = requireVersionHistoryArchiveReadyFolder(
    rootFolderPath,
    archiveRoot
  );
  const sourceFolderPath = path.join(archiveRoot, run.folderName);
  const destinationFolderPath = path.join(readyFolder, run.folderName);
  const sourceStats = fs.lstatSync(sourceFolderPath);
  const archiveRootRealPath = fs.realpathSync(archiveRoot);
  const sourceRealPath = fs.realpathSync(sourceFolderPath);
  if (
    !sameHistoryPath(readyFolder, readyFolderPath)
    || path.dirname(sourceFolderPath) !== archiveRoot
    || path.dirname(destinationFolderPath) !== readyFolder
    || !sourceStats.isDirectory()
    || sourceStats.isSymbolicLink()
    || !sameHistoryPath(path.dirname(sourceRealPath), archiveRootRealPath)
  ) {
    const error = new Error(`Archive move boundary changed: ${run.folderName}`);
    error.code = "VERSION_HISTORY_ARCHIVE_EXPIRY_STALE";
    error.statusCode = 409;
    throw error;
  }
  try {
    fs.lstatSync(destinationFolderPath);
    const error = new Error(`Manual-deletion destination already exists: ${run.folderName}`);
    error.code = "VERSION_HISTORY_ARCHIVE_READY_COLLISION";
    error.statusCode = 409;
    throw error;
  } catch (error) {
    if (error?.code !== "ENOENT") throw error;
  }
  return { sourceFolderPath, destinationFolderPath };
}

function assertVersionHistoryArchiveRunMoved(readyFolderPath, destinationFolderPath) {
  const readyFolder = path.resolve(readyFolderPath);
  const destinationFolder = path.resolve(destinationFolderPath);
  try {
    const stats = fs.lstatSync(destinationFolder);
    const readyFolderRealPath = fs.realpathSync(readyFolder);
    const destinationRealPath = fs.realpathSync(destinationFolder);
    if (
      path.dirname(destinationFolder) !== readyFolder
      || !retentionArchiveRunLooksManaged(path.basename(destinationFolder))
      || !stats.isDirectory()
      || stats.isSymbolicLink()
      || !sameHistoryPath(path.dirname(destinationRealPath), readyFolderRealPath)
    ) {
      throw new Error("unsafe-destination");
    }
  } catch (cause) {
    const error = new Error("The archive run moved, but its manual deletion destination could not be verified.");
    error.code = "VERSION_HISTORY_ARCHIVE_READY_MOVE_UNVERIFIED";
    error.statusCode = 409;
    error.cause = cause;
    throw error;
  }
  return destinationFolder;
}

function moveVersionHistoryRetentionArchiveExpiryPlan(plan, options = {}, progress = () => {}) {
  const configuredRootFolderPath = normalizedRegistryPath(options.rootFolderPath)
    || normalizedRegistryPath(readVersionHistoryFolderPath());
  if (
    !configuredRootFolderPath
    || !sameHistoryPath(configuredRootFolderPath, plan?.rootFolderPath)
  ) {
    const error = new Error("The configured backup folder changed after the archive expiry preview.");
    error.code = "VERSION_HISTORY_ARCHIVE_EXPIRY_ROOT_CHANGED";
    error.statusCode = 409;
    throw error;
  }
  const archiveRootPath = requireManagedRetentionArchiveRoot(
    configuredRootFolderPath,
    plan.archiveRootPath,
    { allowMissing: true }
  );
  const { current, candidates } = assertVersionHistoryArchiveExpiryPlanCurrent(
    plan,
    options,
    progress
  );
  requireManagedRetentionArchiveRoot(
    configuredRootFolderPath,
    current.archiveRootPath,
    { allowMissing: candidates.length === 0 }
  );
  if (!candidates.length) {
    return {
      ok: true,
      status: "no-op",
      planId: plan.planId,
      movedRunCount: 0,
      movedBytes: 0,
      readyForManualDeletion: versionHistoryArchiveReadyStatus({
        rootFolderPath: configuredRootFolderPath
      }),
      failedRunCount: 0,
      failures: []
    };
  }
  const readyFolderPath = requireVersionHistoryArchiveReadyFolder(
    configuredRootFolderPath,
    archiveRootPath,
    { create: true }
  );
  const plannedDestinations = new Map(candidates.map(run => [
    run.folderName,
    assertVersionHistoryArchiveReadyDestinationAvailable(
      configuredRootFolderPath,
      archiveRootPath,
      readyFolderPath,
      run
    )
  ]));
  persistRetentionArchivePolicyState(archiveRootPath, {
    firstCompletedRunName: plan.firstCompletedRunName,
    firstCompletedAt: plan.firstCompletedAt,
    firstCompletedPlanId: plan.firstCompletedPlanId
  });
  const moveJournal = openRetentionArchiveReadyJournal(archiveRootPath);
  const moveJournalPath = moveJournal.journalPath;
  const totalBytes = candidates.reduce((sum, entry) => sum + entry.bytes, 0);
  let movedBytes = 0;
  let movedRunCount = 0;
  const failures = [];
  try {
    appendRetentionArchiveReadyJournal(moveJournal.descriptor, {
      at: nowIso(),
      status: "move-plan-started",
      planId: plan.planId,
      planFingerprint: plan.fingerprint,
      readyFolderPath,
      runs: candidates.map(run => ({
        folderName: run.folderName,
        directoryFingerprint: run.directoryFingerprint,
        bytes: run.bytes
      }))
    });

    candidates.forEach((run, index) => {
      progress({
        step: `Moving expired archive ${run.folderName}`,
        completed: index,
        total: candidates.length,
        completedBytes: movedBytes,
        totalBytes
      });
      let sourceFolderPath = path.join(archiveRootPath, run.folderName);
      let destinationFolderPath = plannedDestinations.get(run.folderName)
        || path.join(readyFolderPath, run.folderName);
      let moved = false;
      try {
        // Recheck the complete run immediately before moving it. Earlier runs may
        // take long enough for OneDrive or another process to change a later run.
        sourceFolderPath = assertVersionHistoryArchiveRunReadyForMove(
          archiveRootPath,
          run
        );
        destinationFolderPath = assertVersionHistoryArchiveReadyDestinationAvailable(
          configuredRootFolderPath,
          archiveRootPath,
          readyFolderPath,
          run
        );
        appendRetentionArchiveReadyJournal(moveJournal.descriptor, {
          at: nowIso(),
          status: "moving-to-manual-deletion",
          planId: plan.planId,
          folderName: run.folderName,
          sourceFolderPath,
          destinationFolderPath,
          directoryFingerprint: run.directoryFingerprint,
          bytes: run.bytes
        });
        // Keep the final boundary check adjacent to the rename. This operation
        // intentionally has no copy-and-delete fallback.
        ({
          sourceFolderPath,
          destinationFolderPath
        } = assertVersionHistoryArchiveRenameBoundaryCurrent(
          configuredRootFolderPath,
          archiveRootPath,
          readyFolderPath,
          run
        ));
        fs.renameSync(sourceFolderPath, destinationFolderPath);
        moved = true;
        movedRunCount += 1;
        movedBytes += run.bytes;
        assertVersionHistoryArchiveRunMoved(readyFolderPath, destinationFolderPath);
        try {
          appendRetentionArchiveReadyJournal(moveJournal.descriptor, {
            at: nowIso(),
            status: "ready-for-manual-deletion",
            planId: plan.planId,
            folderName: run.folderName,
            sourceFolderPath,
            destinationFolderPath,
            directoryFingerprint: run.directoryFingerprint,
            bytes: run.bytes
          });
        } catch {}
      } catch (error) {
        failures.push({
          folderName: run.folderName,
          sourceFolderPath,
          destinationFolderPath,
          moved,
          error: error?.message || String(error)
        });
        try {
          appendRetentionArchiveReadyJournal(moveJournal.descriptor, {
            at: nowIso(),
            status: "move-failed",
            planId: plan.planId,
            folderName: run.folderName,
            sourceFolderPath,
            destinationFolderPath,
            moved,
            directoryFingerprint: run.directoryFingerprint,
            error: error?.message || String(error)
          });
        } catch {}
      }
    });
    progress({
      step: failures.length
        ? "Manual-deletion preparation completed with errors"
        : "Expired archives are ready for manual deletion",
      completed: candidates.length,
      total: candidates.length,
      completedBytes: movedBytes,
      totalBytes
    });
    return {
      ok: failures.length === 0,
      status: failures.length ? "partial" : "complete",
      planId: plan.planId,
      movedRunCount,
      movedBytes,
      readyForManualDeletionFolderPath: readyFolderPath,
      readyForManualDeletion: versionHistoryArchiveReadyStatus({
        rootFolderPath: configuredRootFolderPath
      }),
      moveJournalPath,
      failedRunCount: failures.length,
      failures
    };
  } finally {
    try {
      fs.closeSync(moveJournal.descriptor);
    } catch {}
  }
}

function moveExpiredVersionHistoryArchiveRunsToManualDeletion(
  plan,
  options = {},
  progress = () => {}
) {
  return moveVersionHistoryRetentionArchiveExpiryPlan(plan, options, progress);
}

function versionHistoryTransactionWrite(state, options = {}) {
  const rootFolderPath = normalizedRegistryPath(options.rootFolderPath) || requireVersionHistoryFolderPath();
  const folderPath = rootFolderPath ? path.join(rootFolderPath, "json") : null;
  if (!folderPath) return null;

  fs.mkdirSync(folderPath, { recursive: true });
  const source = historySourceInfo(options);
  const expectedFilePath = expectedVersionHistoryFilePath({ ...options, requireExistingRoot: true, rootFolderPath });
  const existingHistoryPath = findVersionHistoryFilePath(options);
  const filePath = existingHistoryPath || expectedFilePath;
  const existingPayload = existingHistoryPath && fileExists(existingHistoryPath)
    ? parseVersionHistoryFile(existingHistoryPath)
    : null;
  const sourceState = existingPayload
    ? stateWithVersionHistoriesCompatibleWithPayload(state, existingPayload)
    : normalizeState(state);
  if (existingPayload && options.mergeExisting !== false) {
    applyVersionHistoryPayloadToState(sourceState, existingPayload, {
      adoptStoryId: false,
      adoptRetiredDraftIds: false,
      promotePages: false
    });
  }
  const stateToWrite = normalizeState(sourceState);
  const nextPayload = versionHistoryPayloadFromState(stateToWrite, {
    ...options,
    previousPayload: existingPayload
  });
  if (existingPayload) {
    assertVersionHistoryPreservesExistingText(existingPayload, nextPayload, existingHistoryPath);
  }
  const previousBuffer = fileExists(filePath) ? fs.readFileSync(filePath) : null;
  const previousContent = previousBuffer === null ? null : previousBuffer.toString("utf8");
  const previousFilePayload = previousContent === null ? null : parseVersionHistoryJson(previousContent);
  if (previousFilePayload) stabilizeVersionHistoryPayloadMetadata(previousFilePayload, nextPayload);
  const content = `${JSON.stringify(nextPayload, null, 2)}\n`;
  if (previousContent !== null && previousContent !== content) {
    backupExistingVersionHistoryJson(rootFolderPath, source, filePath, previousBuffer);
  }
  return {
    filePath,
    content,
    state: stateToWrite,
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
    total += asText(draft?.notes?.content).length;
    addHistory(draft?.notes?.versionHistory);
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

    if (draft.notes) {
      const notesTitle = draft.notes.title || `${draftTitle || draftLabel} Notes`;
      const notesHistory = historyWithCurrentVersion(draft.notes, notesTitle);
      appendPageHistoryReport(lines, `${sectionTitle} Notes`, `${draftLabel} Notes`, notesHistory, {
        actualTitle: notesTitle,
        includeChangeSummaries
      });
    }

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
    if (draft.notes) {
      const notesTitle = draft.notes.title || `${title} Notes`;
      pages.push({
        key: draft.notes.id || `draft-${index + 1}-notes`,
        title: notesTitle,
        type: "Draft notes",
        anchor: `draft-${index + 1}-${summaryAnchor(title)}-notes`,
        page: draft.notes
      });
    }
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

const VERSION_SUMMARY_PERIOD_MS = 12 * 60 * 60 * 1000;

function versionSummaryPeriodGroups(entries) {
  const groups = [];

  (Array.isArray(entries) ? entries : []).forEach((entry, index) => {
    const createdAt = asText(entry?.version?.createdAt);
    const timestamp = new Date(createdAt).valueOf();
    let group = groups[groups.length - 1];
    const startsNewGroup = !group
      || !Number.isFinite(timestamp)
      || !Number.isFinite(group.firstTimestamp)
      || timestamp < group.firstTimestamp
      || timestamp - group.firstTimestamp > VERSION_SUMMARY_PERIOD_MS;

    if (startsNewGroup) {
      group = {
        firstTimestamp: timestamp,
        firstIso: createdAt,
        lastIso: createdAt,
        entries: []
      };
      groups.push(group);
    }

    group.entries.push({ entry, index });
    group.lastIso = createdAt;
  });

  return groups;
}

function versionSummaryPeriodVersionLabel(period) {
  const firstEntry = period?.entries?.[0];
  const lastEntry = period?.entries?.[period.entries.length - 1];
  const firstVersion = Number.isInteger(firstEntry?.index) ? firstEntry.index + 1 : 1;
  const lastVersion = Number.isInteger(lastEntry?.index) ? lastEntry.index + 1 : firstVersion;
  return `Versions ${firstVersion} - ${lastVersion}`;
}

function versionSummaryPeriodDateLabel(period) {
  const first = formatDate(period.firstIso);
  const last = formatDate(period.lastIso);
  return first === last ? first : `${first} to ${last}`;
}

function fullSummaryDraftChangeHtml(left, right, index) {
  const anchor = `draft-change-${index + 1}-${index + 2}`;
  const numberedTitle = `Draft ${index + 1} to Draft ${index + 2}`;
  const title = left.title === `Draft ${index + 1}` && right.title === `Draft ${index + 2}`
    ? numberedTitle
    : `${numberedTitle}: ${left.title} to ${right.title}`;
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
    html: `
      <details id="${escapeHtml(anchor)}" class="draft-change" data-collapsible>
        <summary class="draft-change-summary">
          <span class="draft-change-title">${escapeHtml(title)}</span>
          <span class="meta">${escapeHtml(meta)}</span>
        </summary>
        <div class="draft-change-content">${body}</div>
      </details>
    `
  };
}

function fullSummaryDraftBaselineHtml(draft) {
  const anchor = "draft-change-1-baseline";
  const title = `${draft.title} baseline`;
  const text = escapeHtml(draft.currentText || "");
  const body = text
    ? `<div class="final-draft-diff-text">${text}</div>`
    : "<p>No text in the first draft.</p>";
  return {
    anchor,
    title,
    html: `
      <details id="${anchor}" class="draft-change" data-collapsible>
        <summary class="draft-change-summary">
          <span class="draft-change-title">${escapeHtml(title)}</span>
          <span class="meta">First draft baseline; no earlier draft to compare.</span>
        </summary>
        <div class="draft-change-content">${body}</div>
      </details>
    `
  };
}

function contentsCountText(count, singular, plural = `${singular}s`) {
  return `${count.toLocaleString("en-GB")} ${count === 1 ? singular : plural}`;
}

function nestedSummaryActionsHtml(label, nestedCount) {
  if (nestedCount < 2) return "";
  return `
    <span class="nested-actions" role="group" aria-label="${escapeHtml(`${label} controls`)}">
      <button class="nested-action" type="button" data-nested-action="expand">Expand all</button>
      <button class="nested-action" type="button" data-nested-action="collapse">Collapse all</button>
    </span>
  `;
}

function versionSummaryPageMetaHtml(page) {
  const firstVersion = page.versions[0];
  const lastVersion = page.versions[page.versions.length - 1];
  const createdAt = asText(page.page?.createdAt) || asText(firstVersion?.createdAt);
  const parts = [escapeHtml(page.type)];

  if (createdAt) {
    parts.push(`Created <time datetime="${escapeHtml(createdAt)}">${escapeHtml(formatDate(createdAt))}</time>`);
  }
  if (firstVersion?.createdAt && lastVersion?.createdAt) {
    parts.push(
      `Version dates <time datetime="${escapeHtml(firstVersion.createdAt)}">${escapeHtml(formatDate(firstVersion.createdAt))}</time>`
      + ` to <time datetime="${escapeHtml(lastVersion.createdAt)}">${escapeHtml(formatDate(lastVersion.createdAt))}</time>`
    );
  }
  parts.push(
    `${page.reportVersions.length.toLocaleString("en-GB")} text-changing `
    + `${page.reportVersions.length === 1 ? "version" : "versions"} shown`
  );

  return parts.join(' <span class="meta-separator" aria-hidden="true">&middot;</span> ');
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
  const pages = versionSummaryPages(state).map(page => {
    const reportVersions = textSignificantVersionEntries(page.versions);
    return {
      ...page,
      reportVersions,
      reportVersionPeriods: versionSummaryPeriodGroups(reportVersions)
    };
  });
  const draftAnalyses = (state.drafts || []).map(analyseDraftCutHistory);
  const totalVersions = pages.reduce((sum, page) => sum + page.versions.length, 0);
  const totalReportVersions = pages.reduce((sum, page) => sum + page.reportVersions.length, 0);
  const totalSkippedVersions = totalVersions - totalReportVersions;
  const totalVersionChangeDiffs = pages.reduce((sum, page) => sum + Math.max(page.reportVersions.length - 1, 0), 0);
  const totalChanges = draftAnalyses.length;
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

  const draftChanges = [];
  if (draftAnalyses.length) {
    await tick(`Rendering ${draftAnalyses[0].title} baseline`);
    draftChanges.push(fullSummaryDraftBaselineHtml(draftAnalyses[0]));
    completed += 1;
  }
  for (let index = 0; index < draftAnalyses.length - 1; index += 1) {
    await tick(`Comparing ${draftAnalyses[index].title} to ${draftAnalyses[index + 1].title}`);
    draftChanges.push(fullSummaryDraftChangeHtml(draftAnalyses[index], draftAnalyses[index + 1], index));
    completed += 1;
  }

  const draftChangeLinksHtml = draftChanges.length
    ? `<ul>${draftChanges.map(change => `<li><a href="#${escapeHtml(change.anchor)}">${escapeHtml(change.title)}</a></li>`).join("")}</ul>`
    : '<p class="contents-empty">No draft-to-draft changes.</p>';
  const versionPageLinksHtml = pages.map(page => {
    const versionLinksHtml = page.reportVersionPeriods.length
      ? `<ul class="contents-version-periods">${page.reportVersionPeriods.map(period => `
          <li>
            <details
              class="contents-group contents-version-period"
              data-version-period-start="${escapeHtml(period.firstIso)}"
              data-version-period-end="${escapeHtml(period.lastIso)}"
              data-collapsible
            >
              <summary>
                <span class="contents-period-label">
                  <span>${escapeHtml(versionSummaryPeriodVersionLabel(period))}</span>
                  <span class="meta-separator" aria-hidden="true">&middot;</span>
                  <span class="contents-period-dates">${escapeHtml(versionSummaryPeriodDateLabel(period))}</span>
                </span>
                <span class="contents-count">${escapeHtml(contentsCountText(period.entries.length, "version"))}</span>
              </summary>
              <ul>${period.entries.map(({ entry, index }) => `<li><a href="#${escapeHtml(`${page.anchor}-version-${index + 1}`)}">${escapeHtml(versionHeadingLabel(index, page.reportVersions.length))} (${escapeHtml(formatDate(entry.version.createdAt))})</a></li>`).join("")}</ul>
            </details>
          </li>
        `).join("")}</ul>`
      : '<p class="contents-empty">No text-changing versions.</p>';
    return `
      <li>
        <details
          class="contents-group"
          data-collapsible
          ${page.reportVersionPeriods.length > 1 ? "data-nested-container" : ""}
        >
          <summary${page.reportVersionPeriods.length > 1 ? ' class="contents-summary-with-actions"' : ""}>
            <a href="#${escapeHtml(page.anchor)}">${escapeHtml(page.title)}</a>
            <span class="contents-count">${escapeHtml(contentsCountText(page.reportVersions.length, "version"))}</span>
            ${nestedSummaryActionsHtml(`${page.title} contents`, page.reportVersionPeriods.length)}
          </summary>
          ${versionLinksHtml}
        </details>
      </li>
    `;
  }).join("");
  const contentsHtml = `
    <ul class="contents-list">
      <li>
        <details class="contents-group" data-collapsible>
          <summary><a href="#draft-changes">Draft changes</a><span class="contents-count">${escapeHtml(contentsCountText(draftChanges.length, "comparison"))}</span></summary>
          ${draftChangeLinksHtml}
        </details>
      </li>
      <li>
        <details
          class="contents-group"
          data-collapsible
          ${pages.length > 1 ? "data-nested-container" : ""}
        >
          <summary${pages.length > 1 ? ' class="contents-summary-with-actions"' : ""}>
            <a href="#version-history">Version history</a>
            <span class="contents-count">${escapeHtml(contentsCountText(pages.length, "page"))}</span>
            ${nestedSummaryActionsHtml("Version history contents", pages.length)}
          </summary>
          <ul>${versionPageLinksHtml}</ul>
        </details>
      </li>
    </ul>
  `;

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
        <details id="${escapeHtml(`${page.anchor}-version-${index + 1}`)}" class="version-entry" data-collapsible>
          <summary class="version-heading">
            <span class="version-entry-title">${escapeHtml(versionHeadingLabel(index, page.reportVersions.length))}</span>
            <span class="meta"><time datetime="${escapeHtml(version.createdAt)}">${escapeHtml(formatDate(version.createdAt))}</time> · ${versionWordCount(version).toLocaleString("en-GB")} ${versionWordCount(version) === 1 ? "word" : "words"}</span>
          </summary>
          <div class="version-entry-content">
            ${changeHtml}
          </div>
        </details>
      `);
      completed += 1;
    }

    const versionPeriodsHtml = page.reportVersionPeriods.map(period => `
      <details
        class="version-period"
        data-version-period-start="${escapeHtml(period.firstIso)}"
        data-version-period-end="${escapeHtml(period.lastIso)}"
        data-collapsible
        ${period.entries.length > 1 ? "data-nested-container" : ""}
      >
        <summary>
          <span class="version-period-label">
            <span class="version-period-title">${escapeHtml(versionSummaryPeriodVersionLabel(period))}</span>
            <span class="version-period-dates">${escapeHtml(versionSummaryPeriodDateLabel(period))}</span>
          </span>
          <span class="version-period-count">${escapeHtml(contentsCountText(period.entries.length, "version"))}</span>
          ${nestedSummaryActionsHtml(versionSummaryPeriodVersionLabel(period), period.entries.length)}
        </summary>
        ${period.entries.map(({ index }) => versionArticles[index]).join("\n")}
      </details>
    `).join("\n");

    const originalVersionCount = page.versions.length;
    const skippedVersionCount = originalVersionCount - page.reportVersions.length;
    const skippedVersionMetaHtml = skippedVersionCount
      ? `<p class="meta">${skippedVersionCount.toLocaleString("en-GB")} unchanged ${skippedVersionCount === 1 ? "version" : "versions"} skipped.</p>`
      : "";

    versionSections.push(`
      <details
        id="${escapeHtml(page.anchor)}"
        class="history-page-section"
        data-collapsible
        ${page.reportVersions.length > 1 ? "data-nested-container" : ""}
      >
        <summary>
          <span class="section-title">${escapeHtml(page.title)}</span>
          <span class="section-summary-meta">${versionSummaryPageMetaHtml(page)}</span>
          ${nestedSummaryActionsHtml(`${page.title} version history`, page.reportVersions.length)}
        </summary>
        ${skippedVersionMetaHtml}
        ${versionPeriodsHtml}
      </details>
    `);
  }

  completed = totalSteps;
  await tick("Writing HTML file");
  const generatedAt = nowIso();
  const currentDraftCount = (state.drafts || []).length;

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(sourceName)} version history summary</title>
<style>
:root{color-scheme:light;--bg:oklch(96.4% 0.014 80);--surface:oklch(99.2% 0.006 80);--surface-alt:oklch(97.6% 0.013 80);--surface-sunk:oklch(95.2% 0.014 80);--fg:oklch(22% 0.018 60);--fg-muted:oklch(47% 0.013 60);--fg-subtle:oklch(52% 0.011 60);--border:oklch(88.5% 0.012 80);--border-strong:oklch(75% 0.014 70);--hover:oklch(93.5% 0.014 80);--selected:oklch(91% 0.022 80);--accent:oklch(48% 0.13 252);--accent-deep:oklch(40% 0.14 252);--accent-soft:oklch(94% 0.042 252);--accent-fg:oklch(99% 0.005 252);--focus-ring:oklch(60% 0.16 252 / 0.45);--diff-add:oklch(42% 0.15 148);--diff-add-bg:oklch(95% 0.05 148);--diff-del:oklch(52% 0.18 22);--diff-del-bg:oklch(96.5% 0.05 22);--font-ui:Charter,"Bitstream Charter","Iowan Old Style",Georgia,serif;--font-title:"Fraunces",Charter,"Bitstream Charter","Iowan Old Style",Georgia,serif;--r-sm:4px;--r:6px}
*,*::before,*::after{box-sizing:border-box}
html{scrollbar-color:oklch(62% 0.055 68) var(--surface-sunk)}
body{margin:0;background:var(--bg);color:var(--fg);font:14px/1.5 var(--font-ui);-webkit-font-smoothing:antialiased;text-rendering:optimizeLegibility}
main{width:min(100%,1020px);margin:0 auto;padding:24px 24px 56px}
a{color:var(--accent-deep);text-decoration:none}
a:hover{text-decoration:underline}
button{font:inherit}
button:focus-visible,a:focus-visible,summary:focus-visible{outline:2px solid var(--focus-ring);outline-offset:1px}
::selection{background:oklch(78% 0.12 252 / 0.35)}
.report-header{min-width:0;display:flex;align-items:flex-end;justify-content:space-between;gap:18px;padding-bottom:14px;border-bottom:1px solid var(--border)}
.report-heading{min-width:0}
.report-kicker{margin:0 0 3px;color:var(--fg-subtle);font-size:10.5px;font-weight:700;letter-spacing:0;text-transform:uppercase}
h1{min-width:0;margin:0;font-family:var(--font-title);font-size:23px;font-weight:600;letter-spacing:0;line-height:1.18;overflow-wrap:anywhere}
.report-meta{min-width:0;max-width:48%;margin:0;color:var(--fg-subtle);font-size:11.5px;font-variant-numeric:tabular-nums;line-height:1.45;text-align:right;overflow-wrap:anywhere}
.report-meta span{display:block}
h2{margin:24px 0 10px;padding-top:18px;border-top:1px solid var(--border);font-family:var(--font-title);font-size:18px;font-weight:600;letter-spacing:0;line-height:1.2}
h3{margin:0;font-family:var(--font-title);font-size:15px;font-weight:600;letter-spacing:0;line-height:1.25}
h4{margin:0 0 5px;color:var(--fg-subtle);font-size:10.5px;font-weight:700;letter-spacing:0;text-transform:uppercase}
.meta{margin:3px 0 9px;color:var(--fg-subtle);font-size:11.5px;font-variant-numeric:tabular-nums;line-height:1.4}
.summary-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));margin:14px 0 16px;overflow:hidden;border:1px solid var(--border);border-radius:var(--r);background:var(--surface)}
.summary-stat{min-width:0;display:flex;align-items:baseline;gap:7px;padding:9px 11px;color:var(--fg-muted);font-size:11.5px;line-height:1.3}
.summary-stat:not(:last-child){border-right:1px solid var(--border)}
.summary-stat dt{min-width:0}
.summary-stat dd{order:-1;flex:0 0 auto;margin:0;color:var(--fg);font-family:var(--font-title);font-size:18px;font-weight:600;line-height:1;font-variant-numeric:tabular-nums}
.contents-page{margin:0 0 22px;padding:11px 13px 12px;border:1px solid var(--border);border-radius:var(--r);background:var(--surface)}
.contents-header{display:flex;align-items:center;justify-content:space-between;gap:12px;padding-bottom:8px;border-bottom:1px solid var(--border)}
.contents-page h2{margin:0;padding:0;border:0;font-family:var(--font-title);font-size:14px;font-weight:600;letter-spacing:0}
.summary-actions{display:inline-flex;align-items:center}
.summary-button{min-height:28px;margin:0;padding:0 9px;border:1px solid var(--border-strong);border-radius:0;background:var(--surface);color:var(--fg);cursor:pointer;font-size:11.5px;font-weight:600;line-height:1;white-space:nowrap}
.summary-button:first-child{border-radius:var(--r-sm) 0 0 var(--r-sm)}
.summary-button:last-child{margin-left:-1px;border-radius:0 var(--r-sm) var(--r-sm) 0}
.summary-button:hover{position:relative;background:var(--hover);border-color:var(--accent)}
.nested-actions{display:inline-flex;align-items:center;justify-self:end;white-space:nowrap}
.nested-action{min-height:24px;margin:0;padding:2px 6px;border:0;background:transparent;color:var(--accent-deep);cursor:pointer;font-size:10.5px;font-weight:650;line-height:1}
.nested-action+.nested-action{border-left:1px solid var(--border)}
.nested-action:hover{background:var(--hover);text-decoration:underline}
.contents-page ul{margin:6px 0 0;padding:0;list-style:none}
.contents-page li{margin:1px 0}
.contents-group{margin:2px 0}
details[data-collapsible]>summary{list-style:none}
details[data-collapsible]>summary::-webkit-details-marker{display:none}
details[data-collapsible]>summary::before{content:"";width:6px;height:6px;border-right:1.5px solid var(--fg-muted);border-bottom:1.5px solid var(--fg-muted);transform:translateY(-1px) rotate(45deg);transition:transform 120ms ease}
details[data-collapsible][open]>summary::before{transform:translateY(1px) rotate(225deg)}
.contents-group>summary{min-width:0;display:grid;grid-template-columns:8px minmax(0,1fr) auto;align-items:center;gap:7px;min-height:27px;padding:3px 6px;border-radius:var(--r-sm);cursor:pointer;font-size:12.5px;font-weight:650}
.contents-group>summary.contents-summary-with-actions{grid-template-columns:8px minmax(0,1fr) auto auto}
.contents-summary-with-actions>.nested-actions{grid-column:4}
.contents-group>summary:hover{background:var(--hover)}
.contents-group>summary>a,.contents-group>summary>span:not(.contents-count){min-width:0;overflow-wrap:anywhere}
.contents-period-label{display:flex;flex-wrap:wrap;align-items:baseline;gap:0 4px}
.contents-period-dates{color:var(--fg-subtle);font-weight:400}
.contents-count{color:var(--fg-subtle);font-size:10.5px;font-weight:400;font-variant-numeric:tabular-nums;white-space:nowrap}
.contents-group>ul{margin-left:10px;padding-left:11px;border-left:1px solid var(--border)}
.contents-empty{margin:6px 0 2px 21px;color:var(--fg-muted);font-size:11.5px}
.report-section{margin:24px 0 0;border-top:1px solid var(--border)}
.report-section>summary,.history-page-section>summary{min-width:0;display:grid;grid-template-columns:8px minmax(0,1fr) auto;align-items:center;gap:2px 9px;cursor:pointer}
.report-section>summary{padding:10px 4px}
.report-section>summary:hover,.history-page-section>summary:hover,.version-period>summary:hover{background:var(--hover)}
.report-section>summary::before,.history-page-section>summary::before{grid-row:1 / span 2}
.section-title{grid-column:2;min-width:0;font-family:var(--font-title);font-size:18px;font-weight:600;letter-spacing:0;line-height:1.2;overflow-wrap:anywhere}
.section-summary-meta{grid-column:2;min-width:0;color:var(--fg-subtle);font-size:11px;font-variant-numeric:tabular-nums;line-height:1.35;overflow-wrap:anywhere}
.report-section>summary>.nested-actions,.history-page-section>summary>.nested-actions{grid-column:3;grid-row:1 / span 2}
.draft-change{margin:8px 0;overflow:hidden;border:1px solid var(--border);border-radius:var(--r-sm);background:var(--surface)}
.draft-change:target{scroll-margin-top:12px;background:var(--accent-soft);box-shadow:inset 3px 0 var(--accent)}
.draft-change>summary{min-width:0;display:grid;grid-template-columns:8px minmax(0,1fr) auto;align-items:baseline;gap:8px;min-height:38px;padding:7px 13px;cursor:pointer}
.draft-change>summary:hover{background:var(--hover)}
.draft-change[open]>summary{border-bottom:1px solid var(--border);background:var(--surface-alt)}
.draft-change>summary::before{align-self:center}
.draft-change-title{min-width:0;font-family:var(--font-title);font-size:14px;font-weight:600;line-height:1.3;overflow-wrap:anywhere}
.draft-change>summary .meta{min-width:0;margin:0;text-align:right}
.draft-change-content{padding:11px 14px 13px}
.draft-change-content>p{margin:0}
#version-history>h2{margin-bottom:9px}
.history-page-section{margin:8px 0;overflow:hidden;border:1px solid var(--border);border-radius:var(--r);background:var(--surface)}
.history-page-section>summary{padding:9px 11px;background:var(--surface-alt)}
.history-page-section .section-title{font-size:15.5px}
.history-page-section>.meta{margin:0;padding:7px 12px;border-top:1px solid var(--border)}
.version-period{margin:0;border-top:1px solid var(--border)}
.version-period>summary{min-width:0;display:grid;grid-template-columns:8px minmax(0,1fr) auto auto;align-items:center;gap:8px;min-height:38px;padding:7px 12px;cursor:pointer;background:var(--surface)}
.version-period[open]>summary{border-bottom:1px solid var(--border);background:var(--surface-alt)}
.version-period-label{min-width:0}
.version-period-title{min-width:0;font-size:12.5px;font-weight:650;line-height:1.35;overflow-wrap:anywhere}
.version-period-dates{display:block;color:var(--fg-subtle);font-size:10.5px;font-variant-numeric:tabular-nums;line-height:1.35;overflow-wrap:anywhere}
.version-period-count{color:var(--fg-subtle);font-size:10.5px;font-variant-numeric:tabular-nums;white-space:nowrap}
.version-period>summary>.nested-actions{grid-column:4}
.version-entry{margin:0;background:var(--surface);scroll-margin-top:12px}
.version-entry+.version-entry{border-top:1px solid var(--border)}
.version-entry>summary.version-heading{min-width:0;display:grid;grid-template-columns:8px minmax(0,1fr) auto;align-items:baseline;gap:8px;min-height:36px;padding:7px 14px;cursor:pointer;background:var(--surface)}
.version-entry>summary.version-heading:hover{background:var(--hover)}
.version-entry[open]>summary.version-heading{border-bottom:1px solid var(--border);background:var(--surface-alt)}
.version-entry:target>summary.version-heading{background:var(--accent-soft);box-shadow:inset 3px 0 var(--accent)}
.version-entry>summary.version-heading::before{align-self:center}
.version-entry-title{min-width:0;font-family:var(--font-title);font-size:14px;font-weight:600;line-height:1.3;overflow-wrap:anywhere}
.version-heading .meta{min-width:0;margin:0;text-align:right;white-space:nowrap}
.version-entry-content{padding:11px 14px 13px}
.version-change{margin:0}
.version-change>.meta{margin:0 0 8px}
.final-draft-diff-text,.version-change-diff{white-space:pre-wrap;color:var(--fg);font:15px/1.62 var(--font-ui);overflow-wrap:anywhere}
.compare-token{border-radius:2px;padding:0 2px;text-decoration-thickness:1.6px;text-underline-offset:2px}
.compare-token.added{background:var(--diff-add-bg);color:var(--diff-add);text-decoration:underline}
.compare-token.removed{background:var(--diff-del-bg);color:var(--diff-del);text-decoration:line-through}
@media(max-width:720px){main{padding:16px 14px 42px}.report-header{display:grid;gap:7px}.report-meta{max-width:none;text-align:left}.summary-grid{grid-template-columns:repeat(2,minmax(0,1fr))}.summary-stat:nth-child(2n){border-right:0}.summary-stat:nth-child(-n+2){border-bottom:1px solid var(--border)}.draft-change>summary,.version-entry>summary.version-heading{grid-template-columns:8px minmax(0,1fr)}.draft-change>summary .meta,.version-heading .meta{grid-column:2;margin-top:2px;text-align:left;white-space:normal}}
@media(max-width:560px){.contents-header{align-items:flex-start;flex-direction:column}.contents-group>summary.contents-summary-with-actions{grid-template-columns:8px minmax(0,1fr) auto}.contents-summary-with-actions>.nested-actions{grid-column:2 / -1;justify-self:end}.report-section>summary,.history-page-section>summary,.version-period>summary{grid-template-columns:8px minmax(0,1fr)}.report-section>summary>.nested-actions,.history-page-section>summary>.nested-actions{grid-column:2;grid-row:3;justify-self:end}.version-period-count,.version-period>summary>.nested-actions{grid-column:2}.version-period>summary>.nested-actions{justify-self:end}}
@media(max-width:440px){h1{font-size:21px}.summary-grid{grid-template-columns:1fr}.summary-stat{border-right:0!important;border-bottom:1px solid var(--border)}.summary-stat:last-child{border-bottom:0}.contents-group>ul{margin-left:6px;padding-left:8px}.history-page-section>summary,.version-period>summary{padding-left:9px;padding-right:9px}.version-period>summary{grid-template-columns:8px minmax(0,1fr)}.version-period-count{grid-column:2}.final-draft-diff-text,.version-change-diff{font-size:14.5px}}
@media print{body{background:#fff;color:#111;font-size:11pt}main{width:auto;max-width:none;padding:0}.summary-actions,.nested-actions{display:none}.report-header,.summary-grid,.contents-page,.report-section,.history-page-section,.version-period,.draft-change,.version-entry{background:#fff;box-shadow:none}.draft-change,.version-entry{break-inside:auto}details[data-collapsible]:not([open])>:not(summary){display:block}details[data-collapsible]>summary{list-style:none}details[data-collapsible]>summary::before{display:none}a{color:inherit;text-decoration:none}}
</style>
</head>
<body>
<main>
<header class="report-header">
  <div class="report-heading">
    <p class="report-kicker">Draft Diff Editor · Version history</p>
    <h1>${escapeHtml(sourceName)}</h1>
  </div>
  <p class="report-meta">
    <span>Generated <time datetime="${escapeHtml(generatedAt)}">${escapeHtml(formatDate(generatedAt))}</time></span>
    <span>Source text: ${escapeHtml(source.filePath || "companion draft-history.txt")}</span>
  </p>
</header>
<dl class="summary-grid" aria-label="Report summary">
  <div class="summary-stat"><dt>Current ${currentDraftCount === 1 ? "draft" : "drafts"}</dt><dd>${currentDraftCount.toLocaleString("en-GB")}</dd></div>
  <div class="summary-stat"><dt>Text-changing ${totalReportVersions === 1 ? "version" : "versions"} shown</dt><dd>${totalReportVersions.toLocaleString("en-GB")}</dd></div>
  <div class="summary-stat"><dt>Unchanged ${totalSkippedVersions === 1 ? "version" : "versions"} skipped</dt><dd>${totalSkippedVersions.toLocaleString("en-GB")}</dd></div>
  <div class="summary-stat"><dt>Draft-change ${totalChanges === 1 ? "section" : "sections"}</dt><dd>${totalChanges.toLocaleString("en-GB")}</dd></div>
</dl>
<nav class="contents-page" aria-label="Contents">
<div class="contents-header">
  <h2>Contents</h2>
  <div class="summary-actions" role="group" aria-label="Summary controls">
    <button class="summary-button" type="button" data-summary-action="expand">Expand all</button>
    <button class="summary-button" type="button" data-summary-action="collapse">Collapse all</button>
  </div>
</div>
${contentsHtml}
</nav>
<details
  id="draft-changes"
  class="report-section"
  data-collapsible
  ${draftChanges.length > 1 ? "data-nested-container" : ""}
>
<summary>
  <span class="section-title">Draft changes</span>
  <span class="section-summary-meta">${draftChanges.length.toLocaleString("en-GB")} ${draftChanges.length === 1 ? "comparison" : "comparisons"}</span>
  ${nestedSummaryActionsHtml("Draft changes", draftChanges.length)}
</summary>
${draftChanges.length ? draftChanges.map(change => change.html).join("\n") : "<p>No draft-to-draft changes to show.</p>"}
</details>
<section id="version-history">
<h2>Version history</h2>
${versionSections.join("\n")}
</section>
</main>
<script>
(function () {
  function allCollapsibleDetails() {
    return Array.prototype.slice.call(document.querySelectorAll("details[data-collapsible]"));
  }

  function targetForHash(hash) {
    if (!hash || hash.charAt(0) !== "#") return null;
    var id = hash.slice(1);
    try {
      id = decodeURIComponent(id);
    } catch (error) {}
    return document.getElementById(id);
  }

  function openDetailsForTarget(target) {
    var node = target;
    while (node) {
      if (node.tagName === "DETAILS") node.open = true;
      node = node.parentElement;
    }
  }

  function revealHashTarget(hash) {
    var target = targetForHash(hash);
    if (!target) return;
    openDetailsForTarget(target);
    window.setTimeout(function () {
      target.scrollIntoView({ block: "start" });
    }, 0);
  }

  document.addEventListener("click", function (event) {
    var nestedActionButton = event.target.closest("[data-nested-action]");
    if (nestedActionButton) {
      event.preventDefault();
      event.stopPropagation();
      var nestedContainer = nestedActionButton.closest("[data-nested-container]");
      if (!nestedContainer) return;
      var shouldExpandNested = nestedActionButton.getAttribute("data-nested-action") === "expand";
      if (shouldExpandNested) nestedContainer.open = true;
      Array.prototype.slice.call(
        nestedContainer.querySelectorAll("details[data-collapsible]")
      ).forEach(function (details) {
        details.open = shouldExpandNested;
      });
      return;
    }

    var actionButton = event.target.closest("[data-summary-action]");
    if (actionButton) {
      var shouldOpen = actionButton.getAttribute("data-summary-action") === "expand";
      allCollapsibleDetails().forEach(function (details) {
        details.open = shouldOpen;
      });
      return;
    }

    var link = event.target.closest('a[href^="#"]');
    if (!link) return;
    var target = targetForHash(link.getAttribute("href"));
    if (!target) return;
    openDetailsForTarget(target);
  });

  window.addEventListener("hashchange", function () {
    revealHashTarget(window.location.hash);
  });
  revealHashTarget(window.location.hash);
})();
</script>
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

function versionHistoryRetentionJobSnapshot(job) {
  if (!job) return null;
  const elapsedMs = Date.now() - new Date(job.startedAt).getTime();
  return {
    id: job.id,
    operation: job.operation,
    planId: job.planId,
    ok: job.status !== "failed" && job.result?.ok !== false,
    status: job.status,
    step: job.step,
    completed: job.completed,
    total: job.total,
    completedBytes: job.completedBytes,
    totalBytes: job.totalBytes,
    startedAt: job.startedAt,
    updatedAt: job.updatedAt,
    elapsedMs,
    result: job.result || null,
    error: job.error || "",
    errorCode: job.errorCode || ""
  };
}

function updateVersionHistoryRetentionJob(job, patch = {}) {
  Object.assign(job, patch, { updatedAt: nowIso() });
}

function scheduleVersionHistoryRetentionJobCleanup(job) {
  if (job.cleanupTimer) return;
  job.cleanupTimer = setTimeout(() => {
    versionHistoryRetentionJobs.delete(job.id);
  }, 60 * 60_000);
  job.cleanupTimer.unref?.();
}

function completeVersionHistoryRetentionJob(job, patch = {}) {
  updateVersionHistoryRetentionJob(job, patch);
  scheduleVersionHistoryRetentionJobCleanup(job);
}

function storeVersionHistoryRetentionPlan(plan) {
  const record = {
    plan,
    inUse: false,
    used: false,
    createdAt: nowIso(),
    cleanupTimer: null
  };
  record.cleanupTimer = setTimeout(() => {
    const current = versionHistoryRetentionPlans.get(plan.planId);
    if (current === record && !current.inUse) versionHistoryRetentionPlans.delete(plan.planId);
  }, 2 * 60 * 60_000);
  record.cleanupTimer.unref?.();
  versionHistoryRetentionPlans.set(plan.planId, record);
  return record;
}

function storeVersionHistoryArchiveExpiryPlan(plan) {
  const record = {
    plan,
    inUse: false,
    used: false,
    createdAt: nowIso(),
    cleanupTimer: null
  };
  record.cleanupTimer = setTimeout(() => {
    const current = versionHistoryArchiveExpiryPlans.get(plan.planId);
    if (current === record && !current.inUse) versionHistoryArchiveExpiryPlans.delete(plan.planId);
  }, 2 * 60 * 60_000);
  record.cleanupTimer.unref?.();
  versionHistoryArchiveExpiryPlans.set(plan.planId, record);
  return record;
}

function versionHistoryRetentionMutationRootKey(rootFolderPath) {
  const resolved = path.resolve(rootFolderPath);
  return process.platform === "win32" ? resolved.toLowerCase() : resolved;
}

function activeVersionHistoryRetentionMutationJobId() {
  return versionHistoryRetentionMutationRoots.values().next().value || "";
}

function assertVersionHistoryRetentionMutationIdle() {
  const activeJobId = activeVersionHistoryRetentionMutationJobId();
  if (!activeJobId) return;
  const error = new Error("Backup storage cannot be changed while a storage operation is running.");
  error.code = "VERSION_HISTORY_RETENTION_BUSY";
  error.statusCode = 409;
  error.activeJobId = activeJobId;
  throw error;
}

function assertVersionHistoryRetentionRootChangeAllowed(folderPath) {
  const currentRootFolderPath = normalizedRegistryPath(readVersionHistoryFolderPath());
  const nextRootFolderPath = normalizedRegistryPath(folderPath);
  if (
    (!currentRootFolderPath && !nextRootFolderPath)
    || sameHistoryPath(currentRootFolderPath, nextRootFolderPath)
  ) {
    return;
  }
  assertVersionHistoryRetentionMutationIdle();
}

function acquireVersionHistoryRetentionMutation(job, rootFolderPath) {
  const rootKey = versionHistoryRetentionMutationRootKey(rootFolderPath);
  const activeJobId = versionHistoryRetentionMutationRoots.get(rootKey);
  if (activeJobId) {
    const error = new Error("Another version-history storage operation is already running for this backup folder.");
    error.code = "VERSION_HISTORY_RETENTION_BUSY";
    error.statusCode = 409;
    error.activeJobId = activeJobId;
    throw error;
  }
  versionHistoryRetentionMutationRoots.set(rootKey, job.id);
  job.mutationRootKey = rootKey;
}

function releaseVersionHistoryRetentionMutation(job) {
  const rootKey = job?.mutationRootKey;
  if (!rootKey) return;
  if (versionHistoryRetentionMutationRoots.get(rootKey) === job.id) {
    versionHistoryRetentionMutationRoots.delete(rootKey);
  }
  job.mutationRootKey = "";
}

function versionHistoryRetentionWorkerSource() {
  return `
    const { parentPort, workerData } = require("node:worker_threads");
    Promise.resolve()
      .then(() => {
        const server = require(workerData.serverPath);
        const progress = value => parentPort.postMessage({ type: "progress", progress: value });
        if (workerData.operation === "preview") {
          return server.previewVersionHistoryBackupRetention(workerData.options, progress);
        }
        if (workerData.operation === "archive") {
          return server.archiveVersionHistoryBackupRetentionPlan(
            workerData.plan,
            workerData.options,
            progress
          );
        }
        if (workerData.operation === "archive-expiry-preview") {
          return server.previewVersionHistoryArchiveExpiry(workerData.options, progress);
        }
        if (workerData.operation === "archive-expiry-move") {
          return server.moveExpiredVersionHistoryArchiveRunsToManualDeletion(
            workerData.plan,
            workerData.options,
            progress
          );
        }
        throw new Error("Unknown version-history retention worker operation.");
      })
      .then(result => parentPort.postMessage({ type: "complete", result }))
      .catch(error => {
        parentPort.postMessage({
          type: "error",
          error: error && error.stack ? error.stack : String(error),
          message: error && error.message ? error.message : String(error),
          code: error && error.code ? error.code : "",
          statusCode: error && error.statusCode ? error.statusCode : 500
        });
      });
  `;
}

function startVersionHistoryRetentionWorker(job, workerData) {
  const worker = new Worker(versionHistoryRetentionWorkerSource(), {
    eval: true,
    workerData: {
      serverPath: __filename,
      ...workerData
    }
  });
  job.worker = worker;
  worker.on("message", message => {
    if (message?.type === "progress") {
      const progress = message.progress || {};
      updateVersionHistoryRetentionJob(job, {
        status: "running",
        step: progress.step || job.step,
        completed: Number.isFinite(progress.completed) ? progress.completed : job.completed,
        total: Number.isFinite(progress.total) ? progress.total : job.total,
        completedBytes: Number.isFinite(progress.completedBytes)
          ? progress.completedBytes
          : job.completedBytes,
        totalBytes: Number.isFinite(progress.totalBytes) ? progress.totalBytes : job.totalBytes
      });
      return;
    }
    if (message?.type === "complete") {
      if (job.operation === "preview") storeVersionHistoryRetentionPlan(message.result);
      if (job.operation === "archive-expiry-preview") {
        storeVersionHistoryArchiveExpiryPlan(message.result);
      }
      const planRecord = job.operation === "archive-expiry-move"
        ? versionHistoryArchiveExpiryPlans.get(job.planId)
        : versionHistoryRetentionPlans.get(job.planId);
      if (job.operation === "archive" && planRecord) {
        planRecord.inUse = false;
        planRecord.used = true;
      }
      if (job.operation === "archive-expiry-move" && planRecord) {
        planRecord.inUse = false;
        planRecord.used = true;
      }
      const partialMutation = (
        job.operation === "archive"
        || job.operation === "archive-expiry-move"
      ) && message.result?.ok === false;
      releaseVersionHistoryRetentionMutation(job);
      completeVersionHistoryRetentionJob(job, {
        status: partialMutation ? "failed" : "complete",
        step: partialMutation ? "Completed with errors" : "Complete",
        completed: job.total || 1,
        completedBytes: job.totalBytes || job.completedBytes,
        result: message.result || null,
        error: partialMutation
          ? job.operation === "archive-expiry-move"
            ? `${Number(message.result?.failedRunCount || 0).toLocaleString("en-GB")} expired archive run${Number(message.result?.failedRunCount || 0) === 1 ? "" : "s"} could not be prepared for manual deletion.`
            : `${Number(message.result?.failedFileCount || 0).toLocaleString("en-GB")} backup file${Number(message.result?.failedFileCount || 0) === 1 ? "" : "s"} could not be archived.`
          : "",
        errorCode: partialMutation
          ? job.operation === "archive-expiry-move"
            ? "VERSION_HISTORY_ARCHIVE_EXPIRY_PARTIAL"
            : "VERSION_HISTORY_RETENTION_PARTIAL"
          : ""
      });
      return;
    }
    if (message?.type === "error") {
      const planRecord = job.operation === "archive-expiry-move"
        ? versionHistoryArchiveExpiryPlans.get(job.planId)
        : versionHistoryRetentionPlans.get(job.planId);
      if (job.operation === "archive" && planRecord) {
        planRecord.inUse = false;
        planRecord.used = true;
      }
      if (job.operation === "archive-expiry-move" && planRecord) {
        planRecord.inUse = false;
        planRecord.used = true;
      }
      releaseVersionHistoryRetentionMutation(job);
      completeVersionHistoryRetentionJob(job, {
        status: "failed",
        step: "Failed",
        error: message.message || message.error || "Retention worker failed",
        errorCode: message.code || ""
      });
    }
  });
  worker.on("error", error => {
    const planRecord = job.operation === "archive-expiry-move"
      ? versionHistoryArchiveExpiryPlans.get(job.planId)
      : versionHistoryRetentionPlans.get(job.planId);
    if (job.operation === "archive" && planRecord) {
      planRecord.inUse = false;
      planRecord.used = true;
    }
    if (job.operation === "archive-expiry-move" && planRecord) {
      planRecord.inUse = false;
      planRecord.used = true;
    }
    releaseVersionHistoryRetentionMutation(job);
    completeVersionHistoryRetentionJob(job, {
      status: "failed",
      step: "Failed",
      error: error?.message || String(error),
      errorCode: error?.code || ""
    });
  });
  worker.on("exit", code => {
    if (code && job.status !== "failed" && job.status !== "complete") {
      const planRecord = job.operation === "archive-expiry-move"
        ? versionHistoryArchiveExpiryPlans.get(job.planId)
        : versionHistoryRetentionPlans.get(job.planId);
      if (job.operation === "archive" && planRecord) {
        planRecord.inUse = false;
        planRecord.used = true;
      }
      if (job.operation === "archive-expiry-move" && planRecord) {
        planRecord.inUse = false;
        planRecord.used = true;
      }
      releaseVersionHistoryRetentionMutation(job);
      completeVersionHistoryRetentionJob(job, {
        status: "failed",
        step: "Failed",
        error: `Retention worker exited with code ${code}.`,
        errorCode: "VERSION_HISTORY_RETENTION_WORKER_EXIT"
      });
    }
    if (job.status === "complete" || job.status === "failed") {
      releaseVersionHistoryRetentionMutation(job);
      scheduleVersionHistoryRetentionJobCleanup(job);
    }
  });
}

function newVersionHistoryRetentionJob(operation, planId) {
  const job = {
    id: id(`retention-${operation}`),
    operation,
    planId,
    status: "queued",
    step: "Queued",
    completed: 0,
    total: 1,
    completedBytes: 0,
    totalBytes: 0,
    startedAt: nowIso(),
    updatedAt: nowIso(),
    result: null,
    error: "",
    errorCode: ""
  };
  versionHistoryRetentionJobs.set(job.id, job);
  return job;
}

function startVersionHistoryBackupRetentionPreview(options = {}) {
  const rootFolderPath = normalizedRegistryPath(options.rootFolderPath)
    || requireVersionHistoryFolderPath();
  if (!rootFolderPath) {
    throw new BackupFolderMissingError(readVersionHistoryFolderPath() || "No backup folder selected");
  }
  const planId = id("retention-plan");
  const job = newVersionHistoryRetentionJob("preview", planId);
  startVersionHistoryRetentionWorker(job, {
    operation: "preview",
    options: {
      rootFolderPath,
      planId,
      now: options.now,
      policy: options.policy
    }
  });
  return {
    ok: true,
    jobId: job.id,
    planId,
    progress: versionHistoryRetentionJobSnapshot(job)
  };
}

function archiveVersionHistoryBackupsFromPlanId(planId, options = {}) {
  const normalizedPlanId = asText(planId).trim();
  const planRecord = versionHistoryRetentionPlans.get(normalizedPlanId);
  if (!planRecord) {
    const error = new Error("Version-history retention plan not found or expired.");
    error.code = "VERSION_HISTORY_RETENTION_PLAN_NOT_FOUND";
    error.statusCode = 404;
    throw error;
  }
  if (planRecord.inUse || planRecord.used) {
    const error = new Error("Version-history retention plan has already been used.");
    error.code = "VERSION_HISTORY_RETENTION_PLAN_USED";
    error.statusCode = 409;
    throw error;
  }
  planRecord.inUse = true;
  const job = newVersionHistoryRetentionJob("archive", normalizedPlanId);
  try {
    acquireVersionHistoryRetentionMutation(job, planRecord.plan.rootFolderPath);
    startVersionHistoryRetentionWorker(job, {
      operation: "archive",
      plan: planRecord.plan,
      options
    });
  } catch (error) {
    planRecord.inUse = false;
    releaseVersionHistoryRetentionMutation(job);
    versionHistoryRetentionJobs.delete(job.id);
    throw error;
  }
  return {
    ok: true,
    jobId: job.id,
    planId: normalizedPlanId,
    progress: versionHistoryRetentionJobSnapshot(job)
  };
}

function startVersionHistoryArchiveExpiryPreview(options = {}) {
  const rootFolderPath = normalizedRegistryPath(options.rootFolderPath)
    || requireVersionHistoryFolderPath();
  if (!rootFolderPath) {
    throw new BackupFolderMissingError(readVersionHistoryFolderPath() || "No backup folder selected");
  }
  const planId = id("archive-expiry-plan");
  const job = newVersionHistoryRetentionJob("archive-expiry-preview", planId);
  startVersionHistoryRetentionWorker(job, {
    operation: "archive-expiry-preview",
    options: {
      rootFolderPath,
      planId,
      now: options.now
    }
  });
  return {
    ok: true,
    jobId: job.id,
    planId,
    progress: versionHistoryRetentionJobSnapshot(job)
  };
}

function moveVersionHistoryRetentionArchivesFromPlanId(planId, options = {}) {
  const normalizedPlanId = asText(planId).trim();
  const planRecord = versionHistoryArchiveExpiryPlans.get(normalizedPlanId);
  if (!planRecord) {
    const error = new Error("Archive expiry plan not found or expired.");
    error.code = "VERSION_HISTORY_ARCHIVE_EXPIRY_PLAN_NOT_FOUND";
    error.statusCode = 404;
    throw error;
  }
  if (planRecord.inUse || planRecord.used) {
    const error = new Error("Archive expiry plan has already been used.");
    error.code = "VERSION_HISTORY_ARCHIVE_EXPIRY_PLAN_USED";
    error.statusCode = 409;
    throw error;
  }
  planRecord.inUse = true;
  const job = newVersionHistoryRetentionJob("archive-expiry-move", normalizedPlanId);
  try {
    acquireVersionHistoryRetentionMutation(job, planRecord.plan.rootFolderPath);
    startVersionHistoryRetentionWorker(job, {
      operation: "archive-expiry-move",
      plan: planRecord.plan,
      options
    });
  } catch (error) {
    planRecord.inUse = false;
    releaseVersionHistoryRetentionMutation(job);
    versionHistoryRetentionJobs.delete(job.id);
    throw error;
  }
  return {
    ok: true,
    jobId: job.id,
    planId: normalizedPlanId,
    progress: versionHistoryRetentionJobSnapshot(job)
  };
}

function versionHistoryBackupRetentionJobProgress(jobId) {
  const job = versionHistoryRetentionJobs.get(asText(jobId));
  return job
    ? { ok: true, progress: versionHistoryRetentionJobSnapshot(job) }
    : { ok: false, error: "Version-history retention job not found" };
}

function versionHistoryRetentionPlanForId(planId) {
  return versionHistoryRetentionPlans.get(asText(planId))?.plan || null;
}

function versionHistoryArchiveExpiryPlanForId(planId) {
  return versionHistoryArchiveExpiryPlans.get(asText(planId))?.plan || null;
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
        const notesHistory = draftNotesHistoryFromPayloadEntry(draft) || [];
        const latestNotes = latestHistoryEntry(notesHistory);
        const notesTitle = latestNotes.title || draft?.notes?.title || `${title} Notes`;
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
            id: draft?.notes?.id || `notes-${draft?.id || index + 1}`,
            title: notesTitle,
            createdAt: draft?.notes?.createdAt || latestNotes.createdAt || draft?.createdAt || createdAt,
            updatedAt: latestNotes.createdAt || draft?.notes?.createdAt || draft?.createdAt || updatedAt,
            content: latestNotes.content || "",
            contentHtml: latestNotes.contentHtml || textToHtml(latestNotes.content || ""),
            format: normalizeFormat(latestNotes.format || {}),
            versionHistory: notesHistory
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
        history: stableHistoryForHash(historyArrayFromPayloadEntry(draft)),
        notes: {
          title: asText(draft?.notes?.title),
          createdAt: asText(draft?.notes?.createdAt),
          history: stableHistoryForHash(draftNotesHistoryFromPayloadEntry(draft) || [])
        }
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

  if (
    options.preserveFileIdentity
    || isOneDrivePath(filePath)
    || (options.temporaryFolderPath && isOneDrivePath(options.temporaryFolderPath))
  ) {
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
        writeAtomicText(filePath, backupText, {
          temporaryFolderPath: PERSISTENCE_TRANSACTION_DIR,
          preserveFileIdentity: Boolean(entry.preserveFileIdentity)
        });
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
      preserveFileIdentity: Boolean(write.preserveFileIdentity),
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
        backupPath,
        preserveFileIdentity: Boolean(write.preserveFileIdentity)
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
          temporaryFolderPath: write.temporaryFolderPath,
          preserveFileIdentity: write.preserveFileIdentity
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
    const isLossError = (
      error.code === "VERSION_HISTORY_TEXT_LOSS" ||
      error.code === "VERSION_HISTORY_COUNT_LOSS"
    );
    errors.push({
      filePath: options.filePath || null,
      fileName: options.fileName || null,
      error: error.message,
      code: error.code || null,
      skipped: isLossError,
      missingHistoryEntries: error.missingHistoryEntries || null,
      historyCountLosses: error.historyCountLosses || null
    });
  }

  return { migrated, errors };
}

function versionHistoryMigrationHasLossError(migration) {
  return Boolean((migration?.errors || []).some(error =>
    !error?.skipped && (
      error?.code === "VERSION_HISTORY_TEXT_LOSS" ||
      error?.code === "VERSION_HISTORY_COUNT_LOSS"
    )
  ));
}

function assertVersionHistoryMigrationSafe(migration) {
  if (!versionHistoryMigrationHasLossError(migration)) return;

  const error = new Error("Version-history folder migration was stopped because it would drop existing saved history.");
  error.code = "VERSION_HISTORY_MIGRATION_LOSS";
  error.statusCode = 409;
  error.migrationErrors = migration.errors;
  throw error;
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

function linkedTextFileMissing(filePath = readTextFileLink()) {
  return Boolean(filePath && !fileExists(filePath));
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

function readStoryRegistry() {
  ensureDataDir();
  try {
    const parsed = parseJsonFile(STORY_REGISTRY_FILE);
    if (parsed?.version === 1 && parsed.stories && typeof parsed.stories === "object") return parsed;
  } catch {}
  return { version: 1, stories: {} };
}

function normalizedRegistryPath(value) {
  const filePath = asText(value).trim();
  return filePath ? path.resolve(filePath) : "";
}

function storyRegistryEntry(state, options = {}) {
  const normalized = normalizeState(state);
  const storyId = asText(normalized.storyId);
  if (!storyId) return null;
  const filePath = normalizedRegistryPath(options.filePath);
  const fileName = asText(options.fileName).trim() || (filePath ? path.basename(filePath) : "draft-history.txt");
  const backupFolderPath = normalizedRegistryPath(options.backupFolderPath);
  return {
    storyId,
    filePath,
    fileName,
    backupFolderPath,
    versionHistoryPath: backupFolderPath
      ? path.join(backupFolderPath, "json", `${safeHistoryBaseName(fileName)}${VERSION_HISTORY_FILE_SUFFIX}`)
      : "",
    title: fileName.replace(/\.txt$/iu, ""),
    status: "active",
    missingSince: null,
    retiredAt: null,
    updatedAt: nowIso()
  };
}

function storyRegistryTransactionWrite(state, options = {}) {
  const entry = storyRegistryEntry(state, options);
  if (!entry || !entry.filePath) return null;
  const registry = readStoryRegistry();
  Object.entries(registry.stories).forEach(([registeredId, registered]) => {
    if (
      registeredId !== entry.storyId
      && registered?.filePath
      && textFileStateKey(registered.filePath) === textFileStateKey(entry.filePath)
    ) delete registry.stories[registeredId];
  });
  const previous = registry.stories[entry.storyId] || {};
  registry.stories[entry.storyId] = {
    ...previous,
    ...entry,
    firstRegisteredAt: previous.firstRegisteredAt || entry.updatedAt,
    lastOpenedAt: options.opened ? entry.updatedAt : previous.lastOpenedAt || entry.updatedAt
  };
  return {
    filePath: STORY_REGISTRY_FILE,
    content: `${JSON.stringify(registry, null, 2)}\n`
  };
}

function registeredStoryById(storyId) {
  const idValue = asText(storyId);
  return idValue ? readStoryRegistry().stories[idValue] || null : null;
}

function registeredStoriesByFileName(fileName) {
  const normalizedName = normalizedTransferFileName(fileName);
  if (!normalizedName) return [];
  return Object.values(readStoryRegistry().stories)
    .filter(entry => normalizedTransferFileName(entry?.fileName) === normalizedName);
}

function registeredStoryForManifest(manifest) {
  if (manifest?._skipRegistryMatch) return null;
  const storyId = asText(manifest?.storyId);
  if (storyId) {
    const exact = registeredStoryById(storyId);
    if (exact) return exact;
  }
  if (storyId) {
    const nameMatches = registeredStoriesByFileName(manifest?.source?.fileName);
    return nameMatches.length === 1 ? {
      ...nameMatches[0],
      retiredNameMatch: nameMatches[0]?.status === "retired",
      legacyIdentityMatch: true
    } : null;
  }
  const matches = registeredStoriesByFileName(manifest?.source?.fileName)
    .filter(entry => entry?.status !== "retired");
  return matches.length === 1 ? { ...matches[0], legacyIdentityMatch: Boolean(storyId) } : null;
}

function updateRegisteredStoryStatus({ storyId = "", filePath = "", status }) {
  if (!["missing", "retired"].includes(status)) throw new Error("Invalid story registry status.");
  const registry = readStoryRegistry();
  const targetKey = filePath ? textFileStateKey(filePath) : "";
  const match = Object.entries(registry.stories).find(([id, entry]) => (
    (storyId && id === storyId)
    || (targetKey && entry?.filePath && textFileStateKey(entry.filePath) === targetKey)
  ));
  if (!match) return null;
  const [id, entry] = match;
  const changedAt = nowIso();
  registry.stories[id] = {
    ...entry,
    status,
    updatedAt: changedAt,
    missingSince: entry.missingSince || changedAt,
    retiredAt: status === "retired" ? changedAt : null
  };
  writeAtomicText(STORY_REGISTRY_FILE, `${JSON.stringify(registry, null, 2)}\n`);
  return registry.stories[id];
}

function readTextFileState(filePath) {
  if (!filePath) return null;
  const entry = readTextFileStates()[textFileStateKey(filePath)];
  if (!entry?.state) return null;

  return applyExternalVersionHistory(entry.state, { filePath }).state;
}

function readStoredTextFileState(filePath) {
  if (!filePath) return null;
  const entry = readTextFileStates()[textFileStateKey(filePath)];
  return entry?.state ? normalizeState(entry.state) : null;
}

function recentTextFiles(limit = 12) {
  const files = new Map();
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
  const writes = [write];
  const registryWrite = storyRegistryTransactionWrite(state, {
    filePath,
    fileName: path.basename(filePath),
    backupFolderPath: existingVersionHistoryFolderPath(),
    opened: true
  });
  if (registryWrite) writes.push(registryWrite);
  writeTransactionalTextFiles(writes, options);
}

function textFileStateTransactionWrite(filePath, state) {
  if (!filePath || !state) return null;

  const resolvedPath = path.resolve(filePath);
  const normalized = normalizeState(state);
  const states = readTextFileStates();
  Object.entries(states).forEach(([key, entry]) => {
    if (
      key !== textFileStateKey(resolvedPath)
      && asText(entry?.state?.storyId)
      && asText(entry.state.storyId) === asText(normalized.storyId)
    ) delete states[key];
  });
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
  const normalized = normalizeState(stateWithNewestStoredViewState(state), { touch: Boolean(options.touch) });
  const writes = [
    {
      filePath: STATE_FILE,
      content: `${JSON.stringify(stateForStorage(normalized, {
        embedVersionHistory: Boolean(options.embedVersionHistory)
      }), null, 2)}\n`
    }
  ];

  const linkedTextPath = readTextFileLink();
  if (linkedTextPath) {
    const cacheWrite = textFileStateTransactionWrite(linkedTextPath, normalized);
    if (cacheWrite) writes.push(cacheWrite);
    const registryWrite = storyRegistryTransactionWrite(normalized, {
      filePath: linkedTextPath,
      fileName: path.basename(linkedTextPath),
      backupFolderPath: existingVersionHistoryFolderPath()
    });
    if (registryWrite) writes.push(registryWrite);
  }

  writeTransactionalTextFiles(writes, options);
  return normalized;
}

function writeAll(state, options = {}) {
  ensureDataDir();
  recoverPersistenceTransaction();
  let normalized = normalizeState(stateWithNewestStoredViewState(state), { touch: true });
  const linkedTextPath = readTextFileLink();
  const skipLinkedTextFileWrite = Boolean(options.skipLinkedTextFileWrite);
  const missingLinkedTextFile = !options.allowCreateLinkedTextFile && linkedTextFileMissing(linkedTextPath);
  const versionHistoryWrites = [];

  if (!options.skipVersionHistory) {
    try {
      const versionHistoryWrite = versionHistoryTransactionWrite(normalized, {
        filePath: options.filePath || linkedTextPath || (options.fileName ? "" : EXPORT_FILE),
        fileName: options.fileName,
        mergeExisting: options.mergeExisting
      });
      if (versionHistoryWrite) {
        normalized = versionHistoryWrite.state || normalized;
        versionHistoryWrite.preserveFileIdentity = Boolean(options.preserveExternalFileIdentity);
        versionHistoryWrites.push(versionHistoryWrite);
      }
    } catch (error) {
      if (!options.allowMissingVersionHistoryFolder || !isBackupFolderMissingError(error)) throw error;
    }
  }

  const exportText = formatExport(normalized);
  const coreWrites = [{
    filePath: STATE_FILE,
    content: `${JSON.stringify(stateForStorage(normalized, {
      embedVersionHistory: Boolean(options.embedVersionHistory)
    }), null, 2)}\n`
  }];
  if (!(skipLinkedTextFileWrite && pathsReferToSameFile(EXPORT_FILE, linkedTextPath))) {
    coreWrites.push({
      filePath: EXPORT_FILE,
      content: exportText
    });
  }
  const linkedWrites = [];

  if (linkedTextPath) {
    if (!skipLinkedTextFileWrite && !missingLinkedTextFile) {
      linkedWrites.push({
        filePath: linkedTextPath,
        content: exportText,
        preserveFileIdentity: Boolean(options.preserveExternalFileIdentity)
      });
    }
    const cacheWrite = textFileStateTransactionWrite(linkedTextPath, normalized);
    if (cacheWrite) linkedWrites.push(cacheWrite);
  }

  const allWrites = [...coreWrites, ...linkedWrites, ...versionHistoryWrites];
  const registryWrite = storyRegistryTransactionWrite(normalized, {
    filePath: options.filePath || linkedTextPath || "",
    fileName: options.fileName,
    backupFolderPath: existingVersionHistoryFolderPath()
  });
  if (registryWrite) allWrites.push(registryWrite);
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

function padDatePart(value, length = 2) {
  return String(value).padStart(length, "0");
}

function localTimezoneOffset(date) {
  const offsetMinutes = -date.getTimezoneOffset();
  const sign = offsetMinutes >= 0 ? "+" : "-";
  const absoluteMinutes = Math.abs(offsetMinutes);
  return `${sign}${padDatePart(Math.floor(absoluteMinutes / 60))}-${padDatePart(absoluteMinutes % 60)}`;
}

function usbTransferTimestamp(date = new Date()) {
  return [
    `${date.getFullYear()}-${padDatePart(date.getMonth() + 1)}-${padDatePart(date.getDate())}`,
    "T",
    `${padDatePart(date.getHours())}-${padDatePart(date.getMinutes())}-${padDatePart(date.getSeconds())}`,
    `-${padDatePart(date.getMilliseconds(), 3)}`,
    localTimezoneOffset(date)
  ].join("");
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

function transferSourcePathIsNative(value) {
  const sourcePath = asText(value).trim();
  if (!sourcePath) return false;
  const windowsAbsolute = /^[a-z]:[\\/]/iu.test(sourcePath) || /^\\\\/u.test(sourcePath);
  if (process.platform === "win32") return windowsAbsolute;
  return !windowsAbsolute && path.posix.isAbsolute(sourcePath);
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

  const manifestStoryId = asText(manifest?.storyId);
  if (manifestStoryId) {
    const linkedState = readStoredTextFileState(linkedTextPath);
    if (asText(linkedState?.storyId) !== manifestStoryId) return "";
  } else if (registeredStoriesByFileName(manifest?.source?.fileName).length > 1) {
    return "";
  }

  const expectedNames = transferStoryFileNames(item, manifest);
  const linkedName = normalizedTransferFileName(path.basename(linkedTextPath));
  if (expectedNames.size && !expectedNames.has(linkedName)) return "";

  return path.resolve(linkedTextPath);
}

function localSourcePathForTransferItem(item, manifest) {
  const sourcePath = item?.sourcePath ? path.resolve(item.sourcePath) : "";
  const registeredStory = registeredStoryForManifest(manifest);

  if (item?.role === "storyText") {
    if (registeredStory?.filePath) return path.resolve(registeredStory.filePath);
    if (sourcePath && fileSnapshot(sourcePath).exists) return sourcePath;
    return currentLinkedStoryPathForTransfer(item, manifest) || sourcePath;
  }

  if (item?.role === "backupFolder") {
    if (registeredStory?.backupFolderPath) return path.resolve(registeredStory.backupFolderPath);
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

function existingUsbTransferManifest(packageFolderPath) {
  const manifestPath = path.join(packageFolderPath, USB_TRANSFER_MANIFEST_FILE);
  if (!fileExists(manifestPath)) return null;

  try {
    const manifest = parseJsonFile(manifestPath);
    return manifest?.version === 1 && Array.isArray(manifest.items) ? manifest : null;
  } catch {
    return null;
  }
}

function previousTransferItem(previousManifest, item) {
  return previousManifest?.items?.find(previous => (
    previous?.id === item.id && previous?.role === item.role && previous?.kind === item.kind
  )) || null;
}

function createUsbTransferPackage(payload, destinationRootPath, options = {}) {
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
  const packageFolderPath = options.packageFolderPath
    ? path.resolve(options.packageFolderPath)
    : path.join(destinationRoot, usbTransferPackageFolderName(sourceInfo.fileName));
  const existingManifest = options.resetBaseline
    ? null
    : existingUsbTransferManifest(packageFolderPath)
      || latestUsbTransferManifest(destinationRoot, sourceInfo.fileName)?.manifest
      || null;
  const previousManifest = existingManifest && (
    (existingManifest.storyId && existingManifest.storyId === normalized.storyId)
    || (!existingManifest.storyId && existingManifest?.source?.fileName === sourceInfo.fileName)
  ) ? existingManifest : null;

  assertTransferDestinationSafe(packageFolderPath, [backupFolderPath]);
  fs.mkdirSync(packageFolderPath, { recursive: true });

  const items = [];
  const storyPackagePath = portablePath(USB_TRANSFER_FILES_DIR, "story", path.basename(storyTextPath));
  const packageStoryTextPath = pathFromPortable(packageFolderPath, storyPackagePath);
  writeAtomicText(packageStoryTextPath, formatExport(normalized));
  const storyItem = {
    id: "story-text",
    role: "storyText",
    kind: "file",
    label: path.basename(storyTextPath),
    sourcePath: path.resolve(storyTextPath),
    packagePath: storyPackagePath,
    baseline: fileSnapshot(storyTextPath)
  };
  storyItem.baseline = previousTransferItem(previousManifest, storyItem)?.baseline || storyItem.baseline;
  items.push(storyItem);

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
      const backupItem = {
        id: "backup-folder",
        role: "backupFolder",
        kind: "directory",
        label: path.basename(backupFolderPath),
        sourcePath: path.resolve(backupFolderPath),
        packagePath: backupPackagePath,
        managedRelativePaths,
        baseline: subsetDirectorySnapshot(backupFolderPath, managedRelativePaths)
      };
      backupItem.baseline = previousTransferItem(previousManifest, backupItem)?.baseline || backupItem.baseline;
      items.push(backupItem);
    }
  }

  const createdAt = nowIso();
  const manifest = {
    version: 1,
    storyId: normalized.storyId,
    createdAt,
    baselineCreatedAt: previousManifest?.baselineCreatedAt || previousManifest?.createdAt || createdAt,
    appBuild: SERVER_BUILD,
    computerName: os.hostname(),
    source: {
      fileName: sourceInfo.fileName,
      filePath: storyTextPath ? path.resolve(storyTextPath) : null,
      backupFolderPath: backupFolderPath ? path.resolve(backupFolderPath) : null
    },
    items,
    baselineState: previousManifest?.baselineState || normalizeState(normalized),
    storySummary: previousManifest?.storySummary || storySummaryFromState(normalized, {
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
  return latestUsbTransferManifest(folderPath)?.manifestPath || null;
}

function usbTransferManifestCandidates(folderPath, sourceFileName = "") {
  const root = path.resolve(folderPath);
  const manifestPaths = [path.join(root, USB_TRANSFER_MANIFEST_FILE)];

  try {
    fs.readdirSync(root, { withFileTypes: true }).forEach(entry => {
      if (entry.isDirectory()) manifestPaths.push(path.join(root, entry.name, USB_TRANSFER_MANIFEST_FILE));
    });
  } catch {
    return [];
  }

  const expectedFileName = asText(sourceFileName);
  const candidates = manifestPaths.flatMap(manifestPath => {
    if (!fileExists(manifestPath)) return [];
    try {
      const manifest = parseJsonFile(manifestPath);
      if (manifest?.version !== 1 || !Array.isArray(manifest.items)) return [];
      if (expectedFileName && manifest?.source?.fileName !== expectedFileName) return [];
      const createdTime = Date.parse(manifest.createdAt || "");
      const modifiedTime = fs.statSync(manifestPath).mtimeMs;
      return [{
        manifestPath,
        manifest,
        time: Number.isNaN(createdTime) ? modifiedTime : createdTime
      }];
    } catch {
      return [];
    }
  });

  candidates.sort((left, right) => right.time - left.time || right.manifestPath.localeCompare(left.manifestPath));
  return candidates;
}

function latestUsbTransferManifest(folderPath, sourceFileName = "") {
  return usbTransferManifestCandidates(folderPath, sourceFileName)[0] || null;
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

function reviewUsbTransferFolder(folderPath, options = {}) {
  const reportProgress = typeof options === "function"
    ? options
    : typeof options?.progress === "function" ? options.progress : () => {};
  const progress = update => reportProgress({
    completed: Number(update.completed) || 0,
    total: Math.max(Number(update.total) || 1, 1),
    indeterminate: Boolean(update.indeterminate),
    step: asText(update.step) || "Working..."
  });

  progress({
    step: "Reading transfer manifest",
    completed: 0,
    total: 1,
    indeterminate: true
  });
  const { manifestPath, packageFolderPath, manifest } = readUsbTransferManifest(folderPath);
  const total = Math.max(1, manifest.items.length + 3);
  progress({
    step: "Checking transfer contents",
    completed: 0,
    total,
    indeterminate: false
  });

  const entries = [];
  manifest.items.forEach((item, index) => {
    const label = item.role === "storyText"
      ? "story file"
      : item.role === "backupFolder"
        ? "backup folder"
        : asText(item.label) || "transfer item";
    progress({
      step: `Checking ${label}`,
      completed: index,
      total,
      indeterminate: true
    });
    entries.push(...(
      item.kind === "directory"
        ? compareTransferDirectoryItem(item, packageFolderPath, manifest)
        : compareTransferFileItem(item, packageFolderPath, manifest)
    ));
    progress({
      step: `Checked ${label}`,
      completed: index + 1,
      total,
      indeterminate: false
    });
  });

  const storyItem = manifest.items.find(item => item.role === "storyText");
  const backupItem = manifest.items.find(item => item.role === "backupFolder");
  progress({
    step: "Comparing story history",
    completed: manifest.items.length,
    total,
    indeterminate: true
  });
  const usbStorySummary = storyItem
    ? storySummaryFromTransferFiles(
        pathFromPortable(packageFolderPath, storyItem.packagePath),
        backupItem ? pathFromPortable(packageFolderPath, backupItem.packagePath) : ""
      )
    : null;

  progress({
    step: "Preparing import review",
    completed: manifest.items.length + 1,
    total,
    indeterminate: true
  });
  const review = {
    ok: true,
    manifestPath,
    packageFolderPath,
    manifest,
    files: summarizeTransferFileEntries(entries),
    story: compareStorySummaries(manifest.storySummary, usbStorySummary),
    targetStory: (() => {
      const registered = registeredStoryForManifest(manifest);
      return registered ? {
        registered: true,
        storyId: registered.storyId,
        filePath: registered.filePath,
        fileName: registered.fileName,
        exists: fileExists(registered.filePath),
        status: registered.status || (fileExists(registered.filePath) ? "active" : "missing"),
        identityDecision: registered.status === "retired" ? {
          required: true,
          type: registered.retiredNameMatch ? "retired-name-match" : "restore-retired-id",
          incomingStoryId: asText(manifest.storyId),
          registeredStoryId: registered.storyId,
          previousFilePath: registered.filePath,
          fileName: registered.fileName
        } : null
      } : {
        registered: false,
        storyId: asText(manifest.storyId),
        fileName: asText(manifest?.source?.fileName),
        exists: false
      };
    })()
  };
  review.merge = createUsbTransferMergeReview(review);
  progress({
    step: "Review complete",
    completed: total,
    total,
    indeterminate: false
  });
  return review;
}

function usbTransferReviewJobSnapshot(job) {
  if (!job) return null;
  const elapsedMs = Date.now() - new Date(job.startedAt).getTime();
  return {
    id: job.id,
    ok: job.status !== "failed",
    status: job.status,
    step: job.step,
    completed: job.completed,
    total: job.total,
    indeterminate: Boolean(job.indeterminate),
    startedAt: job.startedAt,
    updatedAt: job.updatedAt,
    elapsedMs,
    result: job.result || null,
    error: job.error || ""
  };
}

function updateUsbTransferReviewJob(job, patch = {}) {
  Object.assign(job, patch, { updatedAt: nowIso() });
}

function scheduleUsbTransferReviewJobCleanup(job) {
  if (job.cleanupTimer) return;
  job.cleanupTimer = setTimeout(() => {
    usbTransferReviewJobs.delete(job.id);
  }, 60 * 60_000);
  job.cleanupTimer.unref?.();
}

function completeUsbTransferReviewJob(job, patch = {}) {
  updateUsbTransferReviewJob(job, patch);
  scheduleUsbTransferReviewJobCleanup(job);
}

function usbTransferReviewWorkerSource() {
  return `
    const { parentPort, workerData } = require("node:worker_threads");
    Promise.resolve()
      .then(() => {
        const server = require(workerData.serverPath);
        return server.reviewUsbTransferFolder(
          workerData.folderPath,
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

function startUsbTransferReviewWorker(job, folderPath) {
  const worker = new Worker(usbTransferReviewWorkerSource(), {
    eval: true,
    workerData: {
      serverPath: __filename,
      folderPath: path.resolve(folderPath)
    }
  });
  job.worker = worker;

  worker.on("message", message => {
    if (message?.type === "progress") {
      const progress = message.progress || {};
      updateUsbTransferReviewJob(job, {
        status: "running",
        step: progress.step || job.step,
        completed: Number.isFinite(progress.completed) ? progress.completed : job.completed,
        total: Number.isFinite(progress.total) ? progress.total : job.total,
        indeterminate: Boolean(progress.indeterminate)
      });
      return;
    }

    if (message?.type === "complete") {
      completeUsbTransferReviewJob(job, {
        status: "complete",
        step: "Review complete",
        completed: job.total || 1,
        indeterminate: false,
        result: message.result || null
      });
      return;
    }

    if (message?.type === "error") {
      completeUsbTransferReviewJob(job, {
        status: "failed",
        step: "Failed",
        indeterminate: false,
        error: message.error || "USB review worker failed"
      });
    }
  });

  worker.on("error", error => {
    completeUsbTransferReviewJob(job, {
      status: "failed",
      step: "Failed",
      indeterminate: false,
      error: error?.stack || error?.message || String(error)
    });
  });

  worker.on("exit", code => {
    if (code && job.status !== "failed" && job.status !== "complete") {
      completeUsbTransferReviewJob(job, {
        status: "failed",
        step: "Failed",
        indeterminate: false,
        error: `USB review worker exited with code ${code}.`
      });
      return;
    }

    if (job.status === "complete" || job.status === "failed") scheduleUsbTransferReviewJobCleanup(job);
  });
}

function startUsbTransferReviewJobFromFolder(folderPath) {
  const { manifest } = readUsbTransferManifest(folderPath);
  const job = {
    id: id("usb-review"),
    status: "queued",
    step: "Preparing USB review",
    completed: 0,
    total: Math.max(1, manifest.items.length + 3),
    indeterminate: true,
    startedAt: nowIso(),
    updatedAt: nowIso(),
    result: null,
    error: ""
  };
  usbTransferReviewJobs.set(job.id, job);

  try {
    startUsbTransferReviewWorker(job, folderPath);
  } catch (error) {
    completeUsbTransferReviewJob(job, {
      status: "failed",
      step: "Failed",
      indeterminate: false,
      error: error?.message || String(error)
    });
  }

  return {
    ok: true,
    jobId: job.id,
    progress: usbTransferReviewJobSnapshot(job)
  };
}

function usbTransferReviewJobProgress(jobId) {
  const job = usbTransferReviewJobs.get(asText(jobId));
  return job
    ? { ok: true, progress: usbTransferReviewJobSnapshot(job) }
    : { ok: false, error: "USB review job not found" };
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
  const withHistory = stateWithVersionHistoryPayload(parsed, fileName, transferBackupPackagePath(review));
  if (asText(review.manifest?.storyId)) withHistory.storyId = asText(review.manifest.storyId);
  return normalizeState(withHistory);
}

function localTransferState(review, baselineState = null) {
  const storyItem = transferStoryItem(review);
  const backupItem = transferBackupItem(review);
  const storyPath = storyItem ? localSourcePathForTransferItem(storyItem, review.manifest) : "";
  const fileName = storyPath ? path.basename(storyPath) : review.manifest?.source?.fileName || "draft-history.txt";
  const currentSnapshot = storyPath ? fileSnapshot(storyPath) : { exists: false };
  if (storyPath && !currentSnapshot.exists) return baselineState ? normalizeState(baselineState) : null;
  if (!storyPath) return null;

  try {
    const registeredStory = registeredStoryForManifest(review.manifest);
    const storedState = readStoredTextFileState(storyPath) || baselineState;
    const parsed = stateFromExportText(fs.readFileSync(storyPath, "utf8"), storedState, {
      changedAt: fileMtimeIso(storyPath)
    });
    const backupPath = registeredStory?.backupFolderPath
      || (backupItem ? localSourcePathForTransferItem(backupItem, review.manifest) : "")
      || existingVersionHistoryFolderPath();
    const withHistory = stateWithVersionHistoryPayload(parsed, fileName, backupPath);
    if (asText(review.manifest?.storyId)) withHistory.storyId = asText(review.manifest.storyId);
    return normalizeState(withHistory);
  } catch {
    return readStoredTextFileState(storyPath) || baselineState || null;
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
  const signatureIndexes = new Map();

  histories.flat().forEach(entry => {
    if (!entry || typeof entry !== "object") return;
    const idValue = asText(entry.id);
    const signature = versionHistorySignature(entry);
    if (idValue && seenIds.has(idValue)) return;
    if (signatureIndexes.has(signature)) {
      const existingIndex = signatureIndexes.get(signature);
      const existingTime = versionHistoryTime(merged[existingIndex]);
      const incomingTime = versionHistoryTime(entry);
      if (incomingTime !== null && (existingTime === null || incomingTime > existingTime)) {
        merged[existingIndex] = entry;
        if (idValue) seenIds.add(idValue);
      }
      return;
    }
    if (idValue) seenIds.add(idValue);
    signatureIndexes.set(signature, merged.length);
    merged.push(entry);
  });

  return sortVersionHistoryByCreatedAt(merged);
}

function historyWithCurrentPage(page, fallbackTitle) {
  if (!page) return [];
  const normalized = normalizePageVersionHistory(page.versionHistory, page, fallbackTitle);
  return addCurrentPageToHistoryIfMissing(normalized, page, fallbackTitle);
}

function chooseNewerPageSource(localPage, usbPage, fallbackTitle) {
  if (localPage && !usbPage) return "local";
  if (!localPage && usbPage) return "usb";
  if (!localPage && !usbPage) return "";

  const localTime = pageCurrentTime(localPage, fallbackTitle);
  const usbTime = pageCurrentTime(usbPage, fallbackTitle);
  if (usbTime !== null && localTime !== null) return usbTime > localTime ? "usb" : "local";
  if (usbTime !== null) return "usb";
  return "local";
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

  return chooseNewerPageSource(localPage, usbPage, fallbackTitle);
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
  promotePageToNewestHistoryVersion(normalizedPage, fallbackTitle);

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

function mergeDraftAtIndex(baseDraft, localDraft, usbDraft, index, summary, options = {}) {
  if (!baseDraft && !localDraft && !usbDraft) return null;

  const fallbackTitle = localDraft?.title || usbDraft?.title || baseDraft?.title || `Draft ${index + 1}`;
  const mergedDraft = mergeVersionedPage(baseDraft, localDraft, usbDraft, fallbackTitle, options);
  if (!mergedDraft?.page) return null;

  const draft = mergedDraft.page;
  draft.id = localDraft?.id || baseDraft?.id || usbDraft?.id || draft.id || id("draft");
  const notesTitle = `${draft.title || fallbackTitle} Notes`;
  const mergedNotes = mergeVersionedPage(
    baseDraft?.notes,
    localDraft?.notes,
    usbDraft?.notes,
    notesTitle,
    {
      ...options,
      fixedId: localDraft?.notes?.id || baseDraft?.notes?.id || usbDraft?.notes?.id || id("notes")
    }
  );
  draft.notes = mergedNotes?.page || {
    id: localDraft?.notes?.id || baseDraft?.notes?.id || usbDraft?.notes?.id || id("notes"),
    title: notesTitle,
    createdAt: draft.createdAt,
    updatedAt: draft.updatedAt,
    content: "",
    contentHtml: "",
    format: { ...normalizeFormat(draft.format || {}) }
  };
  draft.notes.title = notesTitle;

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

function mergeUsbTransferStates(baselineState, localState, usbState, options = {}) {
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
    { ...options, fixedId: "initial-notes" }
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
      summary,
      options
    );
    if (draft) drafts.push(draft);
  }

  const merged = normalizeState({
    version: 1,
    storyId: usb?.storyId || local?.storyId || base?.storyId || source.storyId,
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
  const localState = localTransferState(review, null);
  const usbState = transferPackageState(review, null);
  return mergeUsbTransferStates(null, localState, usbState);
}

function pageReviewSignature(page, fallbackTitle) {
  if (!page) return "";

  return JSON.stringify({
    current: pageCurrentSignature(page, fallbackTitle),
    history: [...new Set(historyWithCurrentPage(page, fallbackTitle)
      .map(version => versionHistorySignature(version)))]
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

function pageSavedVersionsBySignature(page, fallbackTitle) {
  const versions = new Map();
  historyWithCurrentPage(page, fallbackTitle).forEach(version => {
    const signature = normalizedHistoryTextValue(textForHistoryVersion(version));
    if (!signature) return;
    const existing = versions.get(signature);
    if (!existing) {
      versions.set(signature, version);
      return;
    }
    const existingTime = versionHistoryTime(existing);
    const incomingTime = versionHistoryTime(version);
    if (incomingTime !== null && (existingTime === null || incomingTime > existingTime)) {
      versions.set(signature, version);
    }
  });
  return versions;
}

function uniqueSavedVersionDetails(versions, otherVersions) {
  return [...versions.entries()]
    .filter(([signature]) => !otherVersions.has(signature))
    .map(([, version]) => ({
      savedAt: asText(version?.createdAt),
      wordCount: wordCountForText(textForHistoryVersion(version))
    }))
    .sort((left, right) => String(left.savedAt).localeCompare(String(right.savedAt)));
}

function pageReviewTimeline(localVersions, usbVersions) {
  const versions = new Map();
  const addVersions = (sourceVersions, source) => {
    sourceVersions.forEach((version, signature) => {
      const existing = versions.get(signature);
      const savedAt = asText(version?.createdAt);
      if (!existing) {
        versions.set(signature, {
          content: textForHistoryVersion(version),
          savedAt,
          sources: new Set([source])
        });
        return;
      }
      existing.sources.add(source);
      if (savedAt && (!existing.savedAt || savedAt > existing.savedAt)) existing.savedAt = savedAt;
    });
  };

  addVersions(localVersions, "local");
  addVersions(usbVersions, "usb");

  return [...versions.values()]
    .sort((left, right) => String(left.savedAt).localeCompare(String(right.savedAt)))
    .map((version, index) => ({
      version: index + 1,
      content: version.content,
      savedAt: version.savedAt,
      source: version.sources.size > 1 ? "both" : [...version.sources][0]
    }));
}

function pageLatestSavedAt(page, fallbackTitle) {
  const times = historyWithCurrentPage(page, fallbackTitle)
    .map(version => versionHistoryTime(version))
    .filter(time => time !== null);
  return times.length ? new Date(Math.max(...times)).toISOString() : "";
}

function createDirectMergeReviewEntry(type, number, localPage, usbPage, fallbackTitle) {
  const localVersions = pageSavedVersionsBySignature(localPage, fallbackTitle);
  const usbVersions = pageSavedVersionsBySignature(usbPage, fallbackTitle);
  const localUniqueVersionDetails = uniqueSavedVersionDetails(localVersions, usbVersions);
  const usbUniqueVersionDetails = uniqueSavedVersionDetails(usbVersions, localVersions);
  const localOnlyVersions = localUniqueVersionDetails.length;
  const usbOnlyVersions = usbUniqueVersionDetails.length;
  const currentTextMatches = Boolean(
    localPage
    && usbPage
    && normalizedHistoryTextValue(pagePlainText(localPage)) === normalizedHistoryTextValue(pagePlainText(usbPage))
  );
  if (!localOnlyVersions && !usbOnlyVersions) return null;

  const localCurrentAt = pageCurrentIso(localPage, fallbackTitle);
  const usbCurrentAt = pageCurrentIso(usbPage, fallbackTitle);
  const localLatestAt = pageLatestSavedAt(localPage, fallbackTitle);
  const usbLatestAt = pageLatestSavedAt(usbPage, fallbackTitle);
  const currentSource = chooseNewerPageSource(localPage, usbPage, fallbackTitle);

  return {
    type,
    number,
    title: fallbackTitle,
    localChanged: localOnlyVersions > 0,
    usbChanged: usbOnlyVersions > 0,
    bothChanged: localOnlyVersions > 0 && usbOnlyVersions > 0,
    conflict: localOnlyVersions > 0 && usbOnlyVersions > 0,
    currentSource,
    localCurrentAt,
    usbCurrentAt,
    localLatestAt,
    usbLatestAt,
    localUniqueVersions: localOnlyVersions,
    usbUniqueVersions: usbOnlyVersions,
    localUniqueVersionDetails,
    usbUniqueVersionDetails,
    localVersionCount: localVersions.size,
    usbVersionCount: usbVersions.size,
    timeline: pageReviewTimeline(localVersions, usbVersions),
    currentTextMatches,
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
  try {
    const storyItem = transferStoryItem(review);
    const localStoryPath = storyItem ? localSourcePathForTransferItem(storyItem, review.manifest) : "";
    const localStoryMissing = review.targetStory
      ? !review.targetStory.exists
      : Boolean(localStoryPath && !fileSnapshot(localStoryPath).exists);
    const local = localTransferState(review, null);
    const usb = transferPackageState(review, null);
    const entries = [];
    const projectNotesEntry = createDirectMergeReviewEntry(
      "projectNotes",
      null,
      local?.initialNotes,
      usb.initialNotes,
      PROJECT_NOTES_TITLE
    );
    if (projectNotesEntry) entries.push(projectNotesEntry);

    const maxDrafts = Math.max(
      local?.drafts?.length || 0,
      usb.drafts?.length || 0
    );
    for (let index = 0; index < maxDrafts; index += 1) {
      const localDraft = local?.drafts?.[index] || null;
      const usbDraft = usb.drafts?.[index] || null;
      const title = localDraft?.title || usbDraft?.title || `Draft ${index + 1}`;
      const draftEntry = createDirectMergeReviewEntry(
        "draft",
        index + 1,
        localDraft,
        usbDraft,
        title
      );
      if (draftEntry) entries.push(draftEntry);

      const notesEntry = createDirectMergeReviewEntry(
        "draftNotes",
        index + 1,
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
  const registeredStory = registeredStoryForManifest(review.manifest);
  const fileName = asText(review.manifest?.source?.fileName).trim()
    || asText(storyItem?.label).trim()
    || (transferSourcePathIsNative(storyItem?.sourcePath) ? path.basename(storyItem.sourcePath) : "")
    || "draft-history.txt";
  const fallbackRoot = usbImportFallbackRoot(fileName);
  const fallbackStoryPath = path.join(fallbackRoot, fileName);
  const fallbackBackupPath = path.join(fallbackRoot, "DraftDiff backup");
  const preferredStoryPath = registeredStory?.filePath
    || (storyItem && transferSourcePathIsNative(storyItem.sourcePath)
      ? localSourcePathForTransferItem(storyItem, review.manifest)
      : currentLinkedStoryPathForTransfer(storyItem, review.manifest));
  const preferredBackupPath = registeredStory?.backupFolderPath
    || (backupItem && transferSourcePathIsNative(backupItem.sourcePath)
      ? localSourcePathForTransferItem(backupItem, review.manifest)
      : existingVersionHistoryFolderPath() || "");
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
    preferredBackupPath,
    storyId: asText(review.manifest?.storyId),
    registered: Boolean(registeredStory)
  };
}

function writeRegisteredStoryTarget(state, destination) {
  const normalized = normalizeState(state, { touch: true });
  const writes = [{
    filePath: destination.storyPath,
    content: formatExport(normalized),
    preserveFileIdentity: true
  }];
  const cacheWrite = textFileStateTransactionWrite(destination.storyPath, normalized);
  if (cacheWrite) writes.push(cacheWrite);

  const historyWrite = versionHistoryTransactionWrite(normalized, {
    filePath: destination.storyPath,
    fileName: destination.fileName,
    rootFolderPath: destination.backupFolderPath,
    mergeExisting: true
  });
  if (historyWrite) {
    historyWrite.preserveFileIdentity = true;
    writes.push(historyWrite);
  }

  const registryWrite = storyRegistryTransactionWrite(normalized, {
    filePath: destination.storyPath,
    fileName: destination.fileName,
    backupFolderPath: destination.backupFolderPath
  });
  if (registryWrite) writes.push(registryWrite);
  writeTransactionalTextFiles(writes);
  return normalized;
}

function applyUsbTransferFolder(folderPath, options = {}) {
  assertVersionHistoryRetentionMutationIdle();
  const review = reviewUsbTransferFolder(folderPath);
  const identityDecision = review.targetStory?.identityDecision;
  if (identityDecision?.required && !["restore", "new"].includes(options.identityResolution)) {
    throw new Error("This import requires a restore-or-new-story decision.");
  }
  if (identityDecision && options.identityResolution === "new") {
    review.manifest = {
      ...review.manifest,
      storyId: StateCore.defaultState().storyId,
      _skipRegistryMatch: true
    };
    review.targetStory = {
      registered: false,
      storyId: review.manifest.storyId,
      fileName: asText(review.manifest?.source?.fileName),
      exists: false
    };
    review.merge = createUsbTransferMergeReview(review);
  }
  validateTransferPackageItems(review.manifest, review.packageFolderPath);
  const backup = createUsbTransferImportBackup(review);

  const { state: mergedState, summary: mergeSummary } = mergeUsbTransferPackage(review);
  if (identityDecision && options.identityResolution === "restore") {
    mergedState.storyId = identityDecision.registeredStoryId;
  }
  const destination = usbImportDestinationPaths(review);
  const storyPath = destination.storyPath;
  const importedBackupFolderPath = destination.backupFolderPath;
  const fileName = destination.fileName;
  const currentLinkedPath = readTextFileLink();
  const backgroundImport = Boolean(
    destination.registered
    && currentLinkedPath
    && textFileStateKey(currentLinkedPath) !== textFileStateKey(storyPath)
  );
  let savedState;
  if (backgroundImport) {
    savedState = writeRegisteredStoryTarget(mergedState, destination);
  } else {
    if (storyPath) writeTextFileLink(storyPath);
    if (importedBackupFolderPath) writeVersionHistoryFolderPath(importedBackupFolderPath);
    savedState = writeAll(mergedState, {
      filePath: storyPath,
      fileName,
      allowLinkedTextFileFailure: true,
      allowCreateLinkedTextFile: true,
      preserveExternalFileIdentity: true
    });
  }
  return {
    ok: true,
    imported: true,
    backup,
    merge: mergeSummary,
    packageFolderPath: review.packageFolderPath,
    filePath: storyPath,
    fileName,
    importDestination: destination,
    backgroundImport,
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

async function startUsbTransferReviewFromRequestBody() {
  const folderPath = await chooseUsbTransferFolder("Select the returned DraftDiff USB transfer folder");
  if (!folderPath) return { ok: false, cancelled: true };
  return startUsbTransferReviewJobFromFolder(folderPath);
}

function importUsbTransferFromRequestBody(body) {
  const payload = body ? JSON.parse(body) : {};
  const folderPath = asText(payload.packageFolderPath);
  if (!folderPath) {
    throw new Error("Missing USB transfer package folder.");
  }
  return applyUsbTransferFolder(folderPath, {
    identityResolution: asText(payload.identityResolution)
  });
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

  const normalized = applyExternalVersionHistory(parsed, {
    filePath: readTextFileLink() || EXPORT_FILE,
    promotePages: false
  }).state;
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

function requestBodyTooLargeError(maxBytes) {
  const error = new Error(`Request body is too large. Maximum size is ${maxBytes} bytes.`);
  error.code = "REQUEST_BODY_TOO_LARGE";
  error.statusCode = 413;
  error.maxBytes = maxBytes;
  return error;
}

function readBody(req, options = {}) {
  const requestedLimit = Number(options.maxBytes);
  const maxBytes = Number.isFinite(requestedLimit) && requestedLimit > 0
    ? requestedLimit
    : MAX_REQUEST_BODY_BYTES;

  return new Promise((resolve, reject) => {
    let body = "";
    let bodyBytes = 0;
    let settled = false;
    const rejectOnce = error => {
      if (settled) return;
      settled = true;
      reject(error);
    };

    req.setEncoding("utf8");
    req.on("data", chunk => {
      if (settled) return;

      bodyBytes += Buffer.byteLength(chunk, "utf8");
      if (bodyBytes > maxBytes) {
        body = "";
        rejectOnce(requestBodyTooLargeError(maxBytes));
        return;
      }

      body += chunk;
    });
    req.on("end", () => {
      if (settled) return;
      settled = true;
      resolve(body);
    });
    req.on("aborted", () => {
      const error = new Error("Request aborted.");
      error.code = "REQUEST_ABORTED";
      rejectOnce(error);
    });
    req.on("error", rejectOnce);
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
      allowLinkedTextFileFailure: Boolean(payload.allowLinkedTextFileFailure),
      skipLinkedTextFileWrite: Boolean(payload.skipLinkedTextFileWrite),
      keepCurrentPages: Boolean(payload.keepCurrentPages)
    };
  }

  return {
    state: payload,
    filePath: "",
    fileName: null,
    waitForSummary: false,
    skipSummary: false,
    allowMissingVersionHistoryFolder: false,
    allowLinkedTextFileFailure: false,
    skipLinkedTextFileWrite: false,
    keepCurrentPages: false
  };
}

function statePathPayload(options = {}) {
  const linkedTextPath = readTextFileLink();
  const historySourcePath = options.filePath || linkedTextPath || (options.fileName ? "" : EXPORT_FILE);
  const versionHistoryFolderPath = readVersionHistoryFolderPath();
  const missingBackupFolder = versionHistoryFolderMissing();
  const missingLinkedTextFile = linkedTextFileMissing(linkedTextPath);
  return {
    exportPath: EXPORT_FILE,
    statePath: STATE_FILE,
    linkedTextPath,
    linkedTextFileName: linkedTextPath ? path.basename(linkedTextPath) : null,
    linkedTextFileMissing: missingLinkedTextFile,
    linkedTextMissingPath: missingLinkedTextFile ? linkedTextPath : null,
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
      allowLinkedTextFileFailure: Boolean(payload.allowLinkedTextFileFailure),
      skipLinkedTextFileWrite: Boolean(payload.skipLinkedTextFileWrite)
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
      embedVersionHistory: true,
      skipLinkedTextFileWrite: Boolean(payload.skipLinkedTextFileWrite)
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
    allowLinkedTextFileFailure: true,
    skipLinkedTextFileWrite: Boolean(payload.skipLinkedTextFileWrite)
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
  const linkedTextPath = readTextFileLink();
  const text = fs.readFileSync(resolvedPath, "utf8");
  return {
    ok: true,
    filePath: resolvedPath,
    fileName,
    text,
    matchesLinkedTextFile: pathsReferToSameFile(resolvedPath, linkedTextPath),
    storedState: readTextFileState(resolvedPath),
    ...statePathPayload({ filePath: resolvedPath, fileName })
  };
}

function activateTextFileLinkFromRequestBody(body) {
  const payload = body ? JSON.parse(body) : {};
  const filePath = asText(payload.filePath);
  if (!filePath) throw new Error("Missing text file path.");

  const resolvedPath = path.resolve(filePath);
  if (!fileExists(resolvedPath)) {
    const error = new Error("Text file no longer exists.");
    error.code = "LINKED_TEXT_FILE_MISSING";
    error.statusCode = 404;
    throw error;
  }

  writeTextFileLink(resolvedPath);
  return {
    ok: true,
    filePath: resolvedPath,
    fileName: path.basename(resolvedPath),
    ...statePathPayload({
      filePath: resolvedPath,
      fileName: path.basename(resolvedPath)
    })
  };
}

async function openTextFileFromDialog() {
  const filePath = await chooseTextFileToOpen();
  return filePath
    ? openedTextFilePayload(filePath)
    : { ok: false, cancelled: true };
}

async function activateBackupFolderFromDialog() {
  const folderPath = await chooseBackupFolder();
  return activateBackupFolderPath(folderPath);
}

function activateBackupFolderPath(folderPath) {
  if (!folderPath) return { ok: false, cancelled: true };
  const backupFolderPath = writeVersionHistoryFolderPath(folderPath);
  return {
    ok: true,
    backupFolderPath,
    ...statePathPayload()
  };
}

function deactivateBackupFolder() {
  writeVersionHistoryFolderPath(null);
  return {
    ok: true,
    backupFolderPath: null,
    ...statePathPayload()
  };
}

async function selectVersionHistoryFolderFromRequestBody(body) {
  const folderPath = await chooseVersionHistoryFolder();
  return selectVersionHistoryFolderPathFromRequestBody(folderPath, body);
}

function selectVersionHistoryFolderPathFromRequestBody(folderPath, body) {
  const requestPayload = body ? JSON.parse(body) : {};
  const payload = body
    ? parseStatePayload(body)
    : { state: readState(), filePath: "", fileName: null };
  const recoverMissingFolder = Boolean(requestPayload.recoverMissingFolder);
  if (!folderPath) return { ok: false, cancelled: true };
  assertVersionHistoryRetentionRootChangeAllowed(folderPath);

  const previousVersionHistoryFolderPath = existingVersionHistoryFolderPath();
  const carriedHistoryFiles = carryVersionHistoryJsonFiles(previousVersionHistoryFolderPath, folderPath);
  assertCarriedVersionHistoryFilesSafe(carriedHistoryFiles);
  const versionHistoryFolderPath = writeVersionHistoryFolderPath(folderPath);
  const filePath = payload.filePath || readTextFileLink() || (payload.fileName ? "" : EXPORT_FILE);
  const migration = recoverMissingFolder
    ? { migrated: [], migratedCount: 0, errors: [] }
    : migrateEmbeddedVersionHistoriesToFolder(payload.state, {
        filePath,
        fileName: payload.fileName
      });
  assertVersionHistoryMigrationSafe(migration);
  const result = applyExternalVersionHistory(payload.state, {
    filePath,
    fileName: payload.fileName
  });
  const state = recoverMissingFolder
    ? writeProjectStateOnly(result.state, { embedVersionHistory: !result.loaded })
    : writeAll(result.state, {
        filePath,
        fileName: payload.fileName
      });
  return {
    ok: true,
    state,
    loaded: result.loaded,
    versionHistoryFolderPath,
    recoverMissingFolder,
    folderCheck: versionHistoryFolderCheck({ filePath, fileName: payload.fileName }),
    carriedHistoryFiles,
    migratedCount: migration.migratedCount,
    migrationErrors: migration.errors,
    ...statePathPayload({ filePath, fileName: payload.fileName })
  };
}

function saveTextFileToPath(filePath, body) {
  const payload = parseStatePayload(body);
  const normalized = normalizeState(payload.state, { touch: true });
  const resolvedPath = path.resolve(filePath);
  writeTextFileLink(resolvedPath);
  const state = writeAll(normalized, {
    filePath: resolvedPath,
    fileName: path.basename(resolvedPath),
    allowCreateLinkedTextFile: true
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
    if (!fileExists(resolvedPath)) {
      return {
        ok: false,
        error: "Recent file no longer exists",
        code: "LINKED_TEXT_FILE_MISSING",
        filePath: resolvedPath,
        status: 404
      };
    }
  } catch {
    return {
      ok: false,
      error: "Recent file no longer exists",
      code: "LINKED_TEXT_FILE_MISSING",
      filePath: resolvedPath,
      status: 404
    };
  }

  return openedTextFilePayload(resolvedPath);
}

function backupProjectFromRequestBody(body) {
  const result = writeBackupFromRequestBody(body);
  return { ok: true, backup: result?.backup || null };
}

function versionHistorySourceKey(source) {
  const filePath = asText(source?.filePath).trim();
  if (filePath) return `path:${textFileStateKey(filePath)}`;
  return `name:${normalizedHistoryName(source?.fileName)}`;
}

function knownVersionHistorySources(options = {}) {
  const sources = new Map();
  const addSource = source => {
    const filePath = asText(source?.filePath).trim();
    const fileName = asText(source?.fileName).trim() || (filePath ? path.basename(filePath) : "");
    if (!filePath && !fileName) return;
    const normalized = {
      filePath: filePath ? path.resolve(filePath) : "",
      fileName: fileName || "draft-history.txt"
    };
    sources.set(versionHistorySourceKey(normalized), normalized);
  };

  addSource(historySourceInfo(options));
  addSource({ filePath: readTextFileLink() || "", fileName: "" });
  Object.values(readTextFileStates()).forEach(entry => {
    addSource({
      filePath: entry?.filePath || "",
      fileName: entry?.filePath ? path.basename(entry.filePath) : ""
    });
  });

  return Array.from(sources.values())
    .filter(source => normalizedHistoryName(source.fileName))
    .sort((left, right) => normalizedHistoryName(left.fileName).localeCompare(normalizedHistoryName(right.fileName)));
}

function versionHistorySearchFolders(rootFolderPath) {
  if (!rootFolderPath) return [];
  return [...new Set([
    path.join(rootFolderPath, "json"),
    path.join(rootFolderPath, "jsons"),
    rootFolderPath
  ].map(folderPath => path.resolve(folderPath)))];
}

function scanVersionHistoryFolderJsonFiles(rootFolderPath) {
  const files = [];
  versionHistorySearchFolders(rootFolderPath).forEach(folderPath => {
    try {
      const entries = fs.readdirSync(folderPath, { withFileTypes: true });
      entries.forEach(entry => {
        if (!entry.isFile() || !entry.name.endsWith(VERSION_HISTORY_FILE_SUFFIX)) return;
        const filePath = path.join(folderPath, entry.name);
        const payload = parseVersionHistoryFile(filePath);
        files.push({
          filePath,
          folderPath,
          fileName: entry.name,
          valid: Boolean(payload),
          sourceFileName: payload?.sourceFileName || "",
          sourceFilePath: payload?.sourceFilePath || "",
          payload
        });
      });
    } catch {
      // Missing legacy folders are normal.
    }
  });
  return files.sort((left, right) => left.filePath.localeCompare(right.filePath));
}

function versionHistoryFolderInventoryCheck(rootFolderPath, options = {}) {
  const sources = knownVersionHistorySources(options);
  const files = scanVersionHistoryFolderJsonFiles(rootFolderPath);
  const matchedFilePaths = new Set();
  const expectedStories = sources.map(source => {
    const match = files.find(file => (
      file.valid
      && !matchedFilePaths.has(file.filePath)
      && versionHistoryPayloadMatchesSource(file.payload, source)
    ));
    if (match) matchedFilePaths.add(match.filePath);
    return {
      fileName: source.fileName,
      filePath: source.filePath,
      found: Boolean(match),
      versionHistoryPath: match?.filePath || "",
      expectedFileName: `${safeHistoryBaseName(source.fileName)}${VERSION_HISTORY_FILE_SUFFIX}`
    };
  });

  const invalidJsonFiles = files
    .filter(file => !file.valid)
    .map(file => ({
      filePath: file.filePath,
      fileName: file.fileName
    }));
  const extraJsonFiles = files
    .filter(file => file.valid && !matchedFilePaths.has(file.filePath))
    .map(file => ({
      filePath: file.filePath,
      fileName: file.fileName,
      sourceFileName: file.sourceFileName,
      sourceFilePath: file.sourceFilePath
    }));
  const readableJsonFiles = files
    .filter(file => file.valid)
    .map(file => ({
      filePath: file.filePath,
      fileName: file.fileName,
      sourceFileName: file.sourceFileName,
      sourceFilePath: file.sourceFilePath,
      matchedKnownStory: matchedFilePaths.has(file.filePath)
    }));

  const missingStories = expectedStories.filter(story => !story.found);
  return {
    checkedAt: nowIso(),
    rootFolderPath,
    searchFolders: versionHistorySearchFolders(rootFolderPath),
    knownStoryCount: expectedStories.length,
    versionHistoryJsonCount: files.length,
    readableJsonCount: readableJsonFiles.length,
    invalidJsonCount: invalidJsonFiles.length,
    missingKnownStoryCount: missingStories.length,
    extraJsonCount: extraJsonFiles.length,
    expectedStories,
    missingStories,
    readableJsonFiles,
    invalidJsonFiles,
    extraJsonFiles
  };
}

function versionHistoryFolderCheck(options = {}) {
  const rootFolderPath = existingVersionHistoryFolderPath();
  const source = historySourceInfo(options);
  const baseName = safeHistoryBaseName(source.fileName);
  const textFileName = safeBackupFileName(source.fileName, "draft-history.txt");
  const versionHistoryPath = findVersionHistoryFilePath(options);
  const expectedVersionHistoryPath = expectedVersionHistoryFilePath(options);
  const originalTextPath = rootFolderPath ? path.join(rootFolderPath, "original txt", textFileName) : "";
  const summaryPath = rootFolderPath
    ? path.join(rootFolderPath, "version history summaries", `${baseName}${CUT_HISTORY_REPORT_SUFFIX}`)
    : "";
  const fullSummaryPath = rootFolderPath
    ? path.join(rootFolderPath, "version history summaries", `${baseName}${FULL_VERSION_HISTORY_REPORT_SUFFIX}`)
    : "";

  return {
    rootFolderPath,
    sourceFileName: source.fileName,
    sourceFilePath: source.filePath,
    versionHistoryPath,
    expectedVersionHistoryPath,
    versionHistoryJsonExists: Boolean(versionHistoryPath && fileExists(versionHistoryPath)),
    originalTextPath,
    originalTextExists: Boolean(originalTextPath && fileExists(originalTextPath)),
    summaryPath,
    summaryExists: Boolean(summaryPath && fileExists(summaryPath)),
    fullSummaryPath,
    fullSummaryExists: Boolean(fullSummaryPath && fileExists(fullSummaryPath)),
    folderInventory: versionHistoryFolderInventoryCheck(rootFolderPath, options)
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

function existingFolderForDialog(preferredPath, fallbackPath = readTextFileLink() || EXPORT_FILE) {
  const candidates = [preferredPath, fallbackPath, EXPORT_FILE, DATA_DIR].filter(Boolean);

  for (const candidate of candidates) {
    let currentPath = path.resolve(candidate);
    if (fileExists(currentPath)) currentPath = path.dirname(currentPath);

    while (currentPath && currentPath !== path.dirname(currentPath)) {
      if (directoryExists(currentPath)) return currentPath;
      currentPath = path.dirname(currentPath);
    }

    if (directoryExists(currentPath)) return currentPath;
  }

  return DATA_DIR;
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
  const initialDirectory = existingFolderForDialog(readVersionHistoryFolderPath());
  return chooseFolderWithNativeDialog(initialDirectory, "Select the backup and version history folder");
}

async function chooseBackupFolder() {
  const initialDirectory = existingFolderForDialog(readVersionHistoryFolderPath());
  return chooseFolderWithNativeDialog(initialDirectory, "Select the backup and version history folder");
}

function nearestExistingDirectory(directoryPath, fallbackPath = DATA_DIR) {
  let currentPath = path.resolve(directoryPath || fallbackPath);

  while (currentPath) {
    if (directoryExists(currentPath)) return currentPath;

    const parentPath = path.dirname(currentPath);
    if (parentPath === currentPath) break;
    currentPath = parentPath;
  }

  return path.resolve(fallbackPath);
}

function openFileLocationCommand(filePath, platform = process.platform) {
  const targetPath = path.resolve(asText(filePath) || DATA_DIR);
  let isFile = false;
  let isDirectory = false;

  try {
    if (fs.existsSync(targetPath)) {
      const stats = fs.statSync(targetPath);
      isFile = stats.isFile();
      isDirectory = stats.isDirectory();
    }
  } catch {}

  const directoryPath = isFile
    ? path.dirname(targetPath)
    : isDirectory
      ? targetPath
      : nearestExistingDirectory(path.dirname(targetPath));

  let command = "";
  let args = [];

  if (platform === "win32") {
    command = "explorer.exe";
    args = isFile ? ["/select,", targetPath] : [directoryPath];
  } else if (platform === "darwin") {
    command = "open";
    args = isFile ? ["-R", targetPath] : [directoryPath];
  } else {
    command = "xdg-open";
    args = [directoryPath];
  }

  return { filePath: targetPath, directoryPath, command, args };
}

function openFileLocation(filePath) {
  ensureDataDir();
  const location = openFileLocationCommand(filePath);

  return new Promise((resolve, reject) => {
    const child = spawn(location.command, location.args, {
      detached: true,
      stdio: "ignore"
    });

    child.once("error", reject);
    child.once("spawn", () => {
      child.unref();
      resolve(location);
    });
  });
}

async function openVersionHistoryArchiveReadyFolder(options = {}) {
  const rootFolderPath = normalizedRegistryPath(readVersionHistoryFolderPath());
  if (!rootFolderPath || !directoryExists(rootFolderPath)) {
    const error = new Error("No backup folder is currently available.");
    error.code = "VERSION_HISTORY_FOLDER_MISSING";
    error.statusCode = 404;
    throw error;
  }
  const archiveRootPath = versionHistoryJsonArchiveFolderPath(rootFolderPath);
  const readyFolderPath = requireVersionHistoryArchiveReadyFolder(
    rootFolderPath,
    archiveRootPath
  );
  let readyFolderRealPath;
  try {
    const archiveRoot = requireManagedRetentionArchiveRoot(rootFolderPath, archiveRootPath);
    const readyFolderStats = fs.lstatSync(readyFolderPath);
    const archiveRootRealPath = fs.realpathSync(archiveRoot);
    readyFolderRealPath = fs.realpathSync(readyFolderPath);
    if (
      !readyFolderStats.isDirectory()
      || readyFolderStats.isSymbolicLink()
      || !sameHistoryPath(path.dirname(readyFolderRealPath), archiveRootRealPath)
    ) {
      throw new Error("linked-or-outside");
    }
  } catch (cause) {
    if (cause?.code !== "ENOENT") {
      const error = new Error("The manual deletion folder is unsafe or cannot be opened.");
      error.code = "VERSION_HISTORY_ARCHIVE_READY_FOLDER_UNSAFE";
      error.statusCode = 409;
      error.cause = cause;
      throw error;
    }
    const error = new Error("There are no archive runs waiting for manual deletion.");
    error.code = "VERSION_HISTORY_ARCHIVE_READY_FOLDER_MISSING";
    error.statusCode = 404;
    throw error;
  }
  const openLocation = typeof options.openFileLocation === "function"
    ? options.openFileLocation
    : openFileLocation;
  const location = await openLocation(readyFolderRealPath);
  return {
    ok: true,
    ...location,
    readyForManualDeletion: versionHistoryArchiveReadyStatus({ rootFolderPath })
  };
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

  if (req.method === "POST" && pathname === "/api/version-history-backups/retention/start") {
    markClientActive();
    sendJson(res, 200, startVersionHistoryBackupRetentionPreview());
    return;
  }

  if (req.method === "GET" && pathname === "/api/version-history-backups/retention/progress") {
    markClientActive();
    const jobId = new URL(req.url, `http://${req.headers.host || "localhost"}`).searchParams.get("id") || "";
    const payload = versionHistoryBackupRetentionJobProgress(jobId);
    sendJson(res, payload.ok ? 200 : 404, payload);
    return;
  }

  if (req.method === "POST" && pathname === "/api/version-history-backups/retention/archive") {
    markClientActive();
    const body = await readBody(req);
    const payload = body ? JSON.parse(body) : {};
    sendJson(res, 200, archiveVersionHistoryBackupsFromPlanId(payload.planId));
    return;
  }

  if (req.method === "POST" && pathname === "/api/version-history-backups/archive-expiry/start") {
    markClientActive();
    sendJson(res, 200, startVersionHistoryArchiveExpiryPreview());
    return;
  }

  if (req.method === "GET" && pathname === "/api/version-history-backups/archive-expiry/progress") {
    markClientActive();
    const jobId = new URL(req.url, `http://${req.headers.host || "localhost"}`).searchParams.get("id") || "";
    const payload = versionHistoryBackupRetentionJobProgress(jobId);
    sendJson(res, payload.ok ? 200 : 404, payload);
    return;
  }

  if (
    req.method === "POST"
    && pathname === "/api/version-history-backups/archive-expiry/move-to-manual-deletion"
  ) {
    markClientActive();
    const body = await readBody(req);
    const payload = body ? JSON.parse(body) : {};
    sendJson(res, 200, moveVersionHistoryRetentionArchivesFromPlanId(payload.planId));
    return;
  }

  if (
    req.method === "POST"
    && pathname === "/api/version-history-backups/manual-deletion/open"
  ) {
    markClientActive();
    sendJson(res, 200, await openVersionHistoryArchiveReadyFolder());
    return;
  }

  if (req.method === "GET" && pathname === "/api/state") {
    markClientActive();
    const state = readState();
    sendJson(res, 200, {
      state,
      projectRecovery: readProjectRecoveryNotice(),
      readyForManualDeletion: versionHistoryArchiveReadyStatus(),
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
      allowLinkedTextFileFailure: true,
      skipLinkedTextFileWrite: Boolean(payload.skipLinkedTextFileWrite)
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
    sendJson(res, 200, await activateBackupFolderFromDialog());
    return;
  }

  if (req.method === "POST" && pathname === "/api/backup/deactivate") {
    markClientActive();
    sendJson(res, 200, deactivateBackupFolder());
    return;
  }

  if (req.method === "POST" && pathname === "/api/version-history/apply") {
    markClientActive();
    const body = await readBody(req);
    const payload = parseStatePayload(body);
    const result = applyExternalVersionHistory(payload.state, {
      filePath: payload.filePath,
      fileName: payload.fileName,
      promotePages: !payload.keepCurrentPages
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
    sendJson(res, 200, await selectVersionHistoryFolderFromRequestBody(body));
    return;
  }

  if (req.method === "POST" && pathname === "/api/open-text-file") {
    markClientActive();
    const filePath = await chooseTextFileToOpen();
    if (!filePath) {
      sendJson(res, 200, { ok: false, cancelled: true });
      return;
    }

    sendJson(res, 200, openedTextFilePayload(filePath));
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
    const payload = openRecentTextFileFromRequestBody(body);
    sendJson(res, payload.ok === false ? payload.status || 404 : 200, payload);
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

  if (req.method === "POST" && pathname === "/api/text-file-link/activate") {
    markClientActive();
    const body = await readBody(req);
    sendJson(res, 200, activateTextFileLinkFromRequestBody(body));
    return;
  }

  if (req.method === "POST" && pathname === "/api/story-registry/status") {
    markClientActive();
    const body = await readBody(req);
    const payload = body ? JSON.parse(body) : {};
    const story = updateRegisteredStoryStatus({
      storyId: asText(payload.storyId),
      filePath: asText(payload.filePath),
      status: asText(payload.status)
    });
    sendJson(res, 200, { ok: true, story });
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

  if (req.method === "POST" && pathname === "/api/usb-transfer/review/start") {
    markClientActive();
    const result = await startUsbTransferReviewFromRequestBody();
    sendJson(res, 200, result);
    return;
  }

  if (req.method === "GET" && pathname === "/api/usb-transfer/review/progress") {
    markClientActive();
    const jobId = new URL(req.url, `http://${req.headers.host || "localhost"}`).searchParams.get("id") || "";
    const payload = usbTransferReviewJobProgress(jobId);
    sendJson(res, payload.ok ? 200 : 404, payload);
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
        folderPath: error.folderPath || null,
        migrationErrors: error.migrationErrors || null,
        missingHistoryEntries: error.missingHistoryEntries || null,
        historyCountLosses: error.historyCountLosses || null,
        historyCarryConflicts: error.historyCarryConflicts || null
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
  previewVersionHistoryBackupRetention,
  archiveVersionHistoryBackupRetentionPlan,
  startVersionHistoryBackupRetentionPreview,
  archiveVersionHistoryBackupsFromPlanId,
  previewVersionHistoryArchiveExpiry,
  moveExpiredVersionHistoryArchiveRunsToManualDeletion,
  startVersionHistoryArchiveExpiryPreview,
  moveVersionHistoryRetentionArchivesFromPlanId,
  versionHistoryArchiveReadyStatus,
  openVersionHistoryArchiveReadyFolder,
  versionHistoryBackupRetentionJobProgress,
  writeFullVersionHistorySummaryReport,
  resolveGeneratedReportPath,
  parseStatePayload,
  openedTextFilePayload,
  activateTextFileLinkFromRequestBody,
  saveTextFileToPath,
  openTextFileFromDialog,
  activateBackupFolderFromDialog,
  activateBackupFolderPath,
  deactivateBackupFolder,
  selectVersionHistoryFolderFromRequestBody,
  selectVersionHistoryFolderPathFromRequestBody,
  recentTextFilesPayload,
  openRecentTextFileFromRequestBody,
  exportUsbTransferFromRequestBody,
  reviewUsbTransferFromRequestBody,
  startUsbTransferReviewFromRequestBody,
  usbTransferReviewJobProgress,
  reviewUsbTransferFolder,
  importUsbTransferFromRequestBody,
  writeBackupFromRequestBody,
  saveStateFromRequestBody,
  writeStateFromRequestBody,
  writeCutHistoryReportFromFiles,
  __test: {
    STATE_FILE,
    EXPORT_FILE,
    MAX_REQUEST_BODY_BYTES,
    readBody,
    TEXT_FILE_STATES_FILE,
    PERSISTENCE_TRANSACTION_DIR,
    readState,
    recoverPersistenceTransaction,
    writeAll,
    writeTextFileLink,
    writeVersionHistoryFolderPath,
    acquireVersionHistoryRetentionMutation,
    releaseVersionHistoryRetentionMutation,
    versionHistoryFolderCheck,
    existingFolderForDialog,
    nearestExistingDirectory,
    openFileLocationCommand,
    carryVersionHistoryJsonFiles,
    assertCarriedVersionHistoryFilesSafe,
    backupExistingVersionHistoryJson,
    versionHistoryPayloadWithoutVolatileMetadataHash,
    scanVersionHistoryBackupRetention,
    buildVersionHistoryBackupRetentionPlan,
    archiveVersionHistoryBackupRetentionPlan,
    versionHistoryRetentionPlanForId,
    readRetentionArchivePolicyState,
    retentionPolicyForCompletedArchiveRun,
    persistRetentionArchivePolicyState,
    inspectVersionHistoryRetentionArchiveRun,
    scanVersionHistoryRetentionArchives,
    previewVersionHistoryArchiveExpiry,
    moveExpiredVersionHistoryArchiveRunsToManualDeletion,
    versionHistoryArchiveReadyStatus,
    versionHistoryArchiveReadyFolderPath,
    requireVersionHistoryArchiveReadyFolder,
    openVersionHistoryArchiveReadyFolder,
    versionHistoryArchiveExpiryPlanForId,
    migrateEmbeddedVersionHistoriesToFolder,
    assertVersionHistoryMigrationSafe,
    macOpenFileDialogScript,
    macSaveFileDialogScript,
    macFolderDialogScript,
    usbTransferTimestamp,
    createUsbTransferPackage,
    reviewUsbTransferFolder,
    startUsbTransferReviewJobFromFolder,
    usbTransferReviewJobProgress,
    applyUsbTransferFolder,
    updateRegisteredStoryStatus,
    storySummaryFromTransferFiles,
    mergePageVersionHistories
  }
};
