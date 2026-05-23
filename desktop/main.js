const path = require("node:path");
const { app, BrowserWindow, Menu, ipcMain, shell } = require("electron");

let mainWindow = null;
let serverApi = null;
let serverHandle = null;
let allowWindowClose = false;

const MIN_ZOOM_FACTOR = 0.5;
const MAX_ZOOM_FACTOR = 2;
const ZOOM_STEP = 0.1;
const APP_USER_MODEL_ID = "com.philipdarby.draftdiffeditor";

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

function configureSpellChecker(session) {
  session.setSpellCheckerEnabled(true);
  const preferredLanguages = ["en-GB", "en-US"].filter(language => (
    session.availableSpellCheckerLanguages.includes(language)
  ));
  if (preferredLanguages.length && process.platform !== "darwin") {
    session.setSpellCheckerLanguages(preferredLanguages);
  }
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
    const hasSpellcheckAction = Boolean(params.spellcheckEnabled && params.misspelledWord);
    if (!params.isEditable && !params.selectionText && !hasSpellcheckAction) return;
    event.preventDefault();
    buildEditorContextMenu(browserWindow, params).popup({ window: browserWindow });
  });
}

function loadServerApi() {
  if (!serverApi) {
    if (app.isPackaged) {
      process.env.DRAFT_DIFF_DATA_DIR = path.join(app.getPath("userData"), "data");
    }

    serverApi = require("../server");
  }

  return serverApi;
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
      spellcheck: true
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
    const finishClose = () => {
      if (settled) return;
      settled = true;
      allowWindowClose = true;
      if (windowToClose && !windowToClose.isDestroyed()) windowToClose.close();
    };

    setTimeout(finishClose, 1500);
    windowToClose.webContents.executeJavaScript(
      "window.draftDiffPersistBeforeClose ? window.draftDiffPersistBeforeClose() : true",
      true
    ).then(finishClose, finishClose);
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

app.whenReady()
  .then(() => {
    ipcMain.handle("draft-diff:zoom", (_event, direction) => {
      setWindowZoom(direction);
    });
    ipcMain.handle("draft-diff:add-word-to-dictionary", (event, value) => {
      const word = String(value || "").trim();
      if (!word) return false;
      return event.sender.session.addWordToSpellCheckerDictionary(word);
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
  app.quit();
});

app.on("before-quit", () => {
  if (!serverApi) return;
  serverApi.flushOnExit();
  void serverApi.stopServer(serverHandle?.server);
});
