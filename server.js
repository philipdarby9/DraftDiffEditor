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
const PORT = Number(process.env.PORT || 4173);
const PROJECT_NOTES_TITLE = "Project notes";
const FORMAT_DEFAULT_VERSION = 2;
const LEGACY_DEFAULT_FONT_FAMILY = "Segoe UI";
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

  return {
    version: 1,
    formatDefaultVersion: FORMAT_DEFAULT_VERSION,
    defaultFormat,
    createdAt,
    updatedAt: options.touch ? nowIso() : raw.updatedAt || createdAt,
    initialNotes: normalizePage(raw.initialNotes, {
      id: raw.initialNotes?.id || "initial-notes",
      title: raw.initialNotes?.title || PROJECT_NOTES_TITLE,
      createdAt: raw.initialNotes?.createdAt || createdAt,
      updatedAt: raw.initialNotes?.updatedAt || raw.initialNotes?.createdAt || createdAt,
      content: ""
    }, { upgradeLegacyDefaultFont, defaultFormat }),
    drafts: drafts.map((draft, index) => {
      const draftNumber = index + 1;
      const draftCreatedAt = draft?.createdAt || nowIso();
      const normalizedDraft = normalizePage(draft, {
        id: draft?.id || id("draft"),
        title: draft?.title || `Draft ${draftNumber}`,
        createdAt: draftCreatedAt,
        updatedAt: draft?.updatedAt || draftCreatedAt,
        content: ""
      }, { upgradeLegacyDefaultFont, defaultFormat });
      return {
        ...normalizedDraft,
        notes: normalizePage(draft?.notes, {
          id: draft?.notes?.id || id("notes"),
          title: draft?.notes?.title || `Draft ${draftNumber} Notes`,
          createdAt: draft?.notes?.createdAt || draftCreatedAt,
          updatedAt: draft?.notes?.updatedAt || draft?.notes?.createdAt || draftCreatedAt,
          content: ""
        }, { upgradeLegacyDefaultFont, defaultFormat })
      };
    })
  };
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

  return normalizeState(entry.state);
}

function writeTextFileState(filePath, state) {
  if (!filePath || !state) return;

  const resolvedPath = path.resolve(filePath);
  const states = readTextFileStates();
  states[textFileStateKey(resolvedPath)] = {
    filePath: resolvedPath,
    updatedAt: nowIso(),
    state: normalizeState(state)
  };
  writeTextFileStates(states);
}

function writeAll(state) {
  ensureDataDir();
  const normalized = normalizeState(state, { touch: true });
  const exportText = formatExport(normalized);
  fs.writeFileSync(STATE_FILE, `${JSON.stringify(normalized, null, 2)}\n`, "utf8");
  fs.writeFileSync(EXPORT_FILE, exportText, "utf8");

  const linkedTextPath = readTextFileLink();
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
    const normalized = normalizeState(parsed);
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
      fileName: payload.fileName
    };
  }

  return {
    state: payload,
    fileName: null
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
    const linkedTextPath = readTextFileLink();
    sendJson(res, 200, {
      state,
      exportPath: EXPORT_FILE,
      statePath: STATE_FILE,
      linkedTextPath,
      linkedTextFileName: linkedTextPath ? path.basename(linkedTextPath) : null
    });
    return;
  }

  if (req.method === "PUT" && pathname === "/api/state") {
    markClientActive();
    const body = await readBody(req);
    const payload = parseStatePayload(body);
    const state = writeAll(payload.state);
    const linkedTextPath = readTextFileLink();
    sendJson(res, 200, {
      ok: true,
      state,
      exportPath: EXPORT_FILE,
      statePath: STATE_FILE,
      linkedTextPath,
      linkedTextFileName: linkedTextPath ? path.basename(linkedTextPath) : null
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

  if (req.method === "POST" && pathname === "/api/close") {
    markClientActive();
    const body = await readBody(req);
    if (body) {
      const payload = parseStatePayload(body);
      writeAll(payload.state);
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
      writeAll(payload.state);
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
      storedState: readTextFileState(filePath)
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
    const state = writeAll(normalized);
    sendJson(res, 200, {
      ok: true,
      state,
      filePath,
      fileName: path.basename(filePath),
      exportPath: EXPORT_FILE,
      statePath: STATE_FILE
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
