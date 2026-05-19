const fs = require("node:fs");
const http = require("node:http");
const path = require("node:path");
const { URL } = require("node:url");

const ROOT = __dirname;
const PUBLIC_DIR = path.join(ROOT, "public");
const DATA_DIR = path.join(ROOT, "data");
const STATE_FILE = path.join(DATA_DIR, "project.json");
const EXPORT_FILE = path.join(DATA_DIR, "draft-history.txt");
const PORT = Number(process.env.PORT || 4173);
const PROJECT_NOTES_TITLE = "Project notes";

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
  fontFamily: "Segoe UI",
  fontSize: "16"
};

const allowedFontFamilies = new Set([
  "Segoe UI",
  "Arial",
  "Calibri",
  "Georgia",
  "Times New Roman",
  "Courier New"
]);

const allowedFontSizes = new Set(["12", "14", "16", "18", "20", "24", "28", "32"]);

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

function htmlToText(value) {
  return asText(value)
    .replace(/<\s*br\s*\/?>/gi, "\n")
    .replace(/<\/\s*(div|p|li|blockquote|h[1-6])\s*>/gi, "\n")
    .replace(/<[^>]*>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/\n{3,}/g, "\n\n")
    .trimEnd();
}

function normalizeFormat(format) {
  const fontFamily = allowedFontFamilies.has(format?.fontFamily)
    ? format.fontFamily
    : DEFAULT_FORMAT.fontFamily;
  const fontSize = allowedFontSizes.has(String(format?.fontSize))
    ? String(format.fontSize)
    : DEFAULT_FORMAT.fontSize;
  return { fontFamily, fontSize };
}

function normalizePage(page, fallback) {
  const content = asText(page?.content) || htmlToText(page?.contentHtml);
  return {
    id: page?.id || fallback.id,
    title: page?.title || fallback.title,
    createdAt: page?.createdAt || fallback.createdAt,
    content,
    contentHtml: asText(page?.contentHtml) || textToHtml(content),
    format: normalizeFormat(page?.format)
  };
}

function createDraft(index, content = "") {
  const createdAt = nowIso();
  return {
    id: id("draft"),
    title: `Draft ${index}`,
    createdAt,
    content,
    contentHtml: textToHtml(content),
    format: { ...DEFAULT_FORMAT },
    notes: {
      id: id("notes"),
      title: `Draft ${index} Notes`,
      createdAt,
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
    createdAt,
    updatedAt: createdAt,
    initialNotes: {
      id: "initial-notes",
      title: PROJECT_NOTES_TITLE,
      createdAt,
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

  return {
    version: 1,
    createdAt,
    updatedAt: options.touch ? nowIso() : raw.updatedAt || createdAt,
    initialNotes: normalizePage(raw.initialNotes, {
      id: raw.initialNotes?.id || "initial-notes",
      title: raw.initialNotes?.title || PROJECT_NOTES_TITLE,
      createdAt: raw.initialNotes?.createdAt || createdAt,
      content: ""
    }),
    drafts: drafts.map((draft, index) => {
      const draftNumber = index + 1;
      const draftCreatedAt = draft?.createdAt || nowIso();
      const normalizedDraft = normalizePage(draft, {
        id: draft?.id || id("draft"),
        title: draft?.title || `Draft ${draftNumber}`,
        createdAt: draftCreatedAt,
        content: ""
      });
      return {
        ...normalizedDraft,
        notes: normalizePage(draft?.notes, {
          id: draft?.notes?.id || id("notes"),
          title: draft?.notes?.title || `Draft ${draftNumber} Notes`,
          createdAt: draft?.notes?.createdAt || draftCreatedAt,
          content: ""
        })
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

function writeAll(state) {
  ensureDataDir();
  const normalized = normalizeState(state, { touch: true });
  fs.writeFileSync(STATE_FILE, `${JSON.stringify(normalized, null, 2)}\n`, "utf8");
  fs.writeFileSync(EXPORT_FILE, formatExport(normalized), "utf8");
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

async function handleApi(req, res, pathname) {
  if (req.method === "GET" && pathname === "/api/state") {
    const state = readState();
    sendJson(res, 200, {
      state,
      exportPath: EXPORT_FILE,
      statePath: STATE_FILE
    });
    return;
  }

  if (req.method === "PUT" && pathname === "/api/state") {
    const body = await readBody(req);
    const nextState = JSON.parse(body || "{}");
    const state = writeAll(nextState);
    sendJson(res, 200, {
      ok: true,
      state,
      exportPath: EXPORT_FILE,
      statePath: STATE_FILE
    });
    return;
  }

  if (req.method === "POST" && pathname === "/api/close") {
    const body = await readBody(req);
    if (body) {
      writeAll(JSON.parse(body));
    } else {
      writeAll(readState());
    }
    sendJson(res, 200, { ok: true });
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

  sendJson(res, 404, { error: "Not found" });
}

const server = http.createServer(async (req, res) => {
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
      "content-type": mimeTypes[ext] || "application/octet-stream"
    });
    fs.createReadStream(filePath).pipe(res);
  } catch (error) {
    sendJson(res, 500, { error: error.message });
  }
});

function flushOnExit() {
  try {
    writeAll(readState());
  } catch (error) {
    console.error(error);
  }
}

process.on("SIGINT", () => {
  flushOnExit();
  process.exit(0);
});

process.on("SIGTERM", () => {
  flushOnExit();
  process.exit(0);
});

readState();
server.listen(PORT, () => {
  console.log(`Draft Diff Editor running at http://localhost:${PORT}`);
  console.log(`Companion text file: ${EXPORT_FILE}`);
});
