const path = require("node:path");
const fs = require("node:fs/promises");
const { app, BrowserWindow, Menu, ipcMain, shell } = require("electron");
const nspell = require("nspell");

let mainWindow = null;
let serverApi = null;
let serverHandle = null;
let allowWindowClose = false;
let gracefulQuitStarted = false;
let pendingCloseSummaryBody = "";
let spellCheckerPromise = null;
let customSpellings = new Set();
let spellcheckCache = new Map();

const MIN_ZOOM_FACTOR = 0.5;
const MAX_ZOOM_FACTOR = 2;
const ZOOM_STEP = 0.1;
const APP_USER_MODEL_ID = "com.philipdarby.draftdiffeditor";
const MAX_SPELLCHECK_CACHE_ENTRIES = 5000;
const DATA_DIR_ENV_VAR = "DRAFT_DIFF_DATA_DIR";
const DATA_DIR_ARG = "--data-dir";
const WINDOW_CLOSE_PERSIST_TIMEOUT_MS = 30 * 60_000;

if (process.platform === "win32") {
  app.setAppUserModelId(APP_USER_MODEL_ID);
}

function setWindowZoom(direction) {
  if (!mainWindow || mainWindow.isDestroyed()) return;

  if (direction === "reset") {
    mainWindow.webContents.setZoomFactor(1);
    return;
  }

  const step = direction === "out" ? -ZOOM_STEP : ZOOM_STEP;
  const currentZoom = mainWindow.webContents.getZoomFactor();
  const nextZoom = Math.min(
    MAX_ZOOM_FACTOR,
    Math.max(MIN_ZOOM_FACTOR, Number((currentZoom + step).toFixed(2)))
  );
  mainWindow.webContents.setZoomFactor(nextZoom);
}

function getIconPath() {
  const iconName = process.platform === "win32" ? "icon.ico" : "icon.png";
  return app.isPackaged
    ? path.join(process.resourcesPath, iconName)
    : path.join(app.getAppPath(), process.platform === "win32" ? "build" : "", iconName);
}

function unquotePath(value) {
  const trimmed = String(value || "").trim();
  if (trimmed.length >= 2 && (
    (trimmed.startsWith("\"") && trimmed.endsWith("\"")) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  )) {
    return trimmed.slice(1, -1).trim();
  }
  return trimmed;
}

function dataDirFromArgs(argv = process.argv) {
  for (let index = 0; index < argv.length; index += 1) {
    const value = String(argv[index] || "");
    if (value === DATA_DIR_ARG) return unquotePath(argv[index + 1]);
    if (value.startsWith(`${DATA_DIR_ARG}=`)) return unquotePath(value.slice(DATA_DIR_ARG.length + 1));
  }
  return "";
}

function resolveConfiguredDataDir() {
  const fromArg = dataDirFromArgs();
  if (fromArg) return path.resolve(fromArg);

  const fromEnv = unquotePath(process.env[DATA_DIR_ENV_VAR]);
  if (fromEnv) return path.resolve(fromEnv);

  return app.isPackaged ? path.join(app.getPath("userData"), "data") : "";
}

function resolveDesktopPath(value) {
  const filePath = String(value || "").trim();
  if (!filePath) throw new Error("Missing file path");
  return path.resolve(filePath);
}

async function openDesktopPath(value) {
  const filePath = resolveDesktopPath(value);
  const error = await shell.openPath(filePath);
  if (error) throw new Error(error);
  return { ok: true, filePath };
}

function showDesktopItemInFolder(value) {
  const filePath = resolveDesktopPath(value);
  shell.showItemInFolder(filePath);
  return { ok: true, filePath, directoryPath: path.dirname(filePath) };
}

function configureSpellChecker(session) {
  session.setSpellCheckerEnabled(false);
  const preferredLanguages = ["en-GB", "en-US"].filter(language => (
    session.availableSpellCheckerLanguages.includes(language)
  ));
  if (preferredLanguages.length && process.platform !== "darwin") {
    session.setSpellCheckerLanguages(preferredLanguages);
  }
}

function customSpellingsPath() {
  return path.join(app.getPath("userData"), "custom-spellings.json");
}

function normalizeSpellcheckWord(value) {
  return String(value || "")
    .trim()
    .replace(/^[^\p{L}\p{N}']+|[^\p{L}\p{N}']+$/gu, "");
}

function shouldSkipSpellcheck(word) {
  return (
    word.length < 2 ||
    /\d/.test(word) ||
    !/\p{L}/u.test(word) ||
    /^[A-Z]{2,}$/.test(word)
  );
}

async function loadCustomSpellings() {
  try {
    const raw = await fs.readFile(customSpellingsPath(), "utf8");
    const values = JSON.parse(raw);
    if (Array.isArray(values)) {
      customSpellings = new Set(values.map(normalizeSpellcheckWord).filter(Boolean));
    }
  } catch {
    customSpellings = new Set();
  }
}

async function saveCustomSpellings() {
  await fs.mkdir(path.dirname(customSpellingsPath()), { recursive: true });
  await fs.writeFile(
    customSpellingsPath(),
    `${JSON.stringify([...customSpellings].sort(), null, 2)}\n`
  );
}

async function getAppSpellChecker() {
  if (!spellCheckerPromise) {
    spellCheckerPromise = (async () => {
      const { default: dictionary } = await import("dictionary-en-gb");
      const checker = nspell(dictionary);
      await loadCustomSpellings();
      customSpellings.forEach(word => checker.add(word));
      return checker;
    })();
  }

  return spellCheckerPromise;
}

function rememberSpellcheckResult(cacheKey, value) {
  spellcheckCache.set(cacheKey, value);
  if (spellcheckCache.size > MAX_SPELLCHECK_CACHE_ENTRIES) {
    spellcheckCache.delete(spellcheckCache.keys().next().value);
  }
  return value;
}

async function checkSpellingWord(value, options = {}) {
  const word = normalizeSpellcheckWord(value);
  if (!word || shouldSkipSpellcheck(word)) {
    return { word, misspelled: false, suggestions: [] };
  }

  const cacheKey = word.toLocaleLowerCase();
  if (!options.includeSuggestions && spellcheckCache.has(cacheKey)) {
    const cached = spellcheckCache.get(cacheKey);
    return { word, misspelled: cached.misspelled, suggestions: [] };
  }

  const checker = await getAppSpellChecker();
  const misspelled = !checker.correct(word);
  const suggestions = misspelled && options.includeSuggestions
    ? checker.suggest(word).slice(0, 7)
    : [];

  if (!options.includeSuggestions) {
    rememberSpellcheckResult(cacheKey, { misspelled });
  }

  return { word, misspelled, suggestions };
}

function spellcheckLabel(text, word) {
  const safeWord = String(word || "").slice(0, 48);
  return safeWord ? `${text} "${safeWord}"` : text;
}

function buildEditorContextMenu(browserWindow, params) {
  const webContents = browserWindow.webContents;
  const template = [];
  const misspelledWord = String(params.misspelledWord || "");
  const suggestions = Array.isArray(params.dictionarySuggestions)
    ? params.dictionarySuggestions.slice(0, 6)
    : [];

  if (params.spellcheckEnabled && misspelledWord) {
    if (suggestions.length) {
      suggestions.forEach(suggestion => {
        template.push({
          label: suggestion,
          click: () => webContents.replaceMisspelling(suggestion)
        });
      });
    } else {
      template.push({ label: "No spelling suggestions", enabled: false });
    }

    template.push(
      { type: "separator" },
      {
        label: spellcheckLabel("Ignore", misspelledWord),
        click: () => webContents.replaceMisspelling(misspelledWord)
      },
      {
        label: spellcheckLabel("Add to dictionary", misspelledWord),
        click: () => {
          webContents.session.addWordToSpellCheckerDictionary(misspelledWord);
          webContents.replaceMisspelling(misspelledWord);
        }
      },
      { type: "separator" }
    );
  }

  if (!params.isEditable && params.selectionText) {
    template.push({ role: "copy", label: "Copy" }, { type: "separator" });
  }

  if (params.isEditable) {
    template.push(
      { role: "cut", label: "Cut" },
      { role: "copy", label: "Copy", enabled: Boolean(params.selectionText) },
      { role: "paste", label: "Paste" },
      { type: "separator" }
    );
  }

  template.push({ role: "selectAll", label: "Select all" });

  return Menu.buildFromTemplate(template);
}

function attachEditorContextMenu(browserWindow) {
  browserWindow.webContents.on("context-menu", (event, params) => {
    const isFormControl = params.formControlType && params.formControlType !== "none";
    if (params.isEditable && !isFormControl) return;

    const hasSpellcheckAction = Boolean(params.spellcheckEnabled && params.misspelledWord);
    if (!params.isEditable && !params.selectionText && !hasSpellcheckAction) return;
    event.preventDefault();
    buildEditorContextMenu(browserWindow, params).popup({ window: browserWindow });
  });
}

function loadServerApi() {
  if (!serverApi) {
    const dataDir = resolveConfiguredDataDir();
    if (dataDir) process.env[DATA_DIR_ENV_VAR] = dataDir;

    serverApi = require("../server");
  }

  return serverApi;
}

function closePayloadWithOptions(body, options = {}) {
  const text = String(body || "");
  try {
    const payload = JSON.parse(text || "{}");
    if (!payload || typeof payload !== "object" || Array.isArray(payload)) return text;
    return JSON.stringify({ ...payload, ...options });
  } catch {
    return text;
  }
}

async function createWindow() {
  const { startServer } = loadServerApi();
  serverHandle = await startServer({ port: 0, host: "127.0.0.1" });
  allowWindowClose = false;

  mainWindow = new BrowserWindow({
    width: 1320,
    height: 860,
    minWidth: 960,
    minHeight: 640,
    title: "Draft Diff Editor",
    backgroundColor: "#f6f2ea",
    icon: getIconPath(),
    show: false,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      spellcheck: false
    }
  });

  mainWindow.removeMenu();
  configureSpellChecker(mainWindow.webContents.session);
  attachEditorContextMenu(mainWindow);
  mainWindow.webContents.on("did-create-window", childWindow => {
    attachEditorContextMenu(childWindow);
  });
  mainWindow.once("ready-to-show", () => mainWindow.show());
  mainWindow.on("close", event => {
    if (allowWindowClose) return;

    event.preventDefault();
    const windowToClose = mainWindow;
    let settled = false;
    let closeFallback = null;
    const finishClose = () => {
      if (settled) return;
      settled = true;
      if (closeFallback) clearTimeout(closeFallback);
      allowWindowClose = true;
      if (windowToClose && !windowToClose.isDestroyed()) windowToClose.close();
    };
    const cancelClose = error => {
      if (settled) return;
      settled = true;
      if (closeFallback) clearTimeout(closeFallback);
      if (error) console.error(error);
      if (windowToClose && !windowToClose.isDestroyed()) {
        windowToClose.show();
        windowToClose.focus();
      }
    };

    closeFallback = setTimeout(finishClose, WINDOW_CLOSE_PERSIST_TIMEOUT_MS);
    closeFallback.unref?.();
    if (windowToClose && !windowToClose.isDestroyed()) windowToClose.hide();
    windowToClose.webContents.executeJavaScript(
      "window.draftDiffPersistBeforeClose ? window.draftDiffPersistBeforeClose() : true",
      true
    ).then(finishClose, cancelClose);
  });
  mainWindow.on("closed", () => {
    mainWindow = null;
  });

  mainWindow.webContents.on("before-input-event", (event, input) => {
    if (!input.control && !input.meta) return;
    if (input.alt) return;

    const key = String(input.key || "").toLowerCase();
    const zoomKeys = new Set(["+", "=", "add", "-", "_", "subtract", "0"]);
    if (!zoomKeys.has(key)) return;

    event.preventDefault();

    if (key === "0") {
      setWindowZoom("reset");
      return;
    }

    const direction = key === "-" || key === "_" || key === "subtract" ? -1 : 1;
    setWindowZoom(direction < 0 ? "out" : "in");
  });

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith(serverHandle.url)) return { action: "allow" };
    shell.openExternal(url);
    return { action: "deny" };
  });

  await mainWindow.loadURL(serverHandle.url);
}

async function quitAfterServerWork() {
  if (gracefulQuitStarted) return;
  gracefulQuitStarted = true;

  try {
    if (serverApi) {
      const closeSummaryBody = pendingCloseSummaryBody;
      pendingCloseSummaryBody = "";
      if (closeSummaryBody) {
        try {
          serverApi.writeBackupFromRequestBody(
            closePayloadWithOptions(closeSummaryBody, {
              waitForSummary: true,
              skipSummary: true,
              allowMissingVersionHistoryFolder: true,
              allowLinkedTextFileFailure: true
            })
          );
        } catch (error) {
          console.error(error);
        }
      } else {
        serverApi.flushOnExit();
      }
      await serverApi.waitForCutHistoryJobs?.(30 * 60_000);
      await serverApi.stopServer(serverHandle?.server, { flush: false });
    }
  } catch (error) {
    console.error(error);
  } finally {
    app.exit(0);
  }
}

app.whenReady()
  .then(() => {
    ipcMain.handle("draft-diff:zoom", (_event, direction) => {
      setWindowZoom(direction);
    });
    ipcMain.handle("draft-diff:hide-for-close", () => {
      if (mainWindow && !mainWindow.isDestroyed()) mainWindow.hide();
      return true;
    });
    ipcMain.handle("draft-diff:show-after-close-error", () => {
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.show();
        mainWindow.focus();
      }
      return true;
    });
    ipcMain.handle("draft-diff:save-state", (_event, body) => {
      const api = loadServerApi();
      return api.saveStateFromRequestBody(String(body || ""));
    });
    ipcMain.handle("draft-diff:backup-project", (_event, body) => {
      const api = loadServerApi();
      return api.backupProjectFromRequestBody(String(body || ""));
    });
    ipcMain.handle("draft-diff:version-history-summary-start", (_event, body) => {
      const api = loadServerApi();
      return api.startVersionHistorySummaryJobFromRequestBody(String(body || ""));
    });
    ipcMain.handle("draft-diff:version-history-summary-progress", (_event, jobId) => {
      const api = loadServerApi();
      return api.versionHistorySummaryJobProgress(String(jobId || ""));
    });
    ipcMain.handle("draft-diff:open-path", (_event, filePath) => openDesktopPath(filePath));
    ipcMain.handle("draft-diff:show-item-in-folder", (_event, filePath) => showDesktopItemInFolder(filePath));
    ipcMain.handle("draft-diff:open-text-file", () => {
      const api = loadServerApi();
      return api.openTextFileFromDialog();
    });
    ipcMain.handle("draft-diff:recent-text-files", () => {
      const api = loadServerApi();
      return api.recentTextFilesPayload();
    });
    ipcMain.handle("draft-diff:open-recent-text-file", (_event, body) => {
      const api = loadServerApi();
      return api.openRecentTextFileFromRequestBody(String(body || ""));
    });
    ipcMain.handle("draft-diff:persist-close", (_event, body) => {
      const api = loadServerApi();
      const closeBody = String(body || "");
      api.writeStateFromRequestBody(closeBody);
      pendingCloseSummaryBody = closeBody;
      return true;
    });
    ipcMain.handle("draft-diff:add-word-to-dictionary", (event, value) => {
      const word = normalizeSpellcheckWord(value);
      if (!word) return false;
      customSpellings.add(word);
      spellcheckCache.clear();
      event.sender.session.addWordToSpellCheckerDictionary(word);
      return getAppSpellChecker()
        .then(checker => {
          checker.add(word);
          return saveCustomSpellings();
        })
        .then(() => true);
    });
    ipcMain.handle("draft-diff:spellcheck-word", (_event, value) => {
      return checkSpellingWord(value, { includeSuggestions: true });
    });
    ipcMain.handle("draft-diff:spellcheck-words", async (_event, values) => {
      if (!Array.isArray(values) || !values.length) return [];
      const checker = await getAppSpellChecker();
      const misspelled = [];
      const seen = new Map();

      values.forEach(value => {
        const word = normalizeSpellcheckWord(value);
        const cacheKey = word.toLocaleLowerCase();
        if (!word || shouldSkipSpellcheck(word) || seen.has(cacheKey)) return;
        const cached = spellcheckCache.get(cacheKey);
        const isMisspelled = cached ? cached.misspelled : !checker.correct(word);
        if (!cached) rememberSpellcheckResult(cacheKey, { misspelled: isMisspelled });
        seen.set(cacheKey, { word, misspelled: isMisspelled });
      });

      seen.forEach(result => {
        if (result.misspelled) misspelled.push(result.word);
      });
      return misspelled;
    });
    return createWindow();
  })
  .catch(error => {
    console.error(error);
    app.quit();
  });

app.on("activate", () => {
  if (!mainWindow) {
    createWindow().catch(error => {
      console.error(error);
      app.quit();
    });
  }
});

app.on("window-all-closed", () => {
  void quitAfterServerWork();
});

app.on("before-quit", event => {
  if (gracefulQuitStarted) return;
  event.preventDefault();

  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.close();
    return;
  }

  void quitAfterServerWork();
});
