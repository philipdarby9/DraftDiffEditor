const path = require("node:path");
const { app, BrowserWindow, ipcMain, shell } = require("electron");

let mainWindow = null;
let serverApi = null;
let serverHandle = null;

const MIN_ZOOM_FACTOR = 0.5;
const MAX_ZOOM_FACTOR = 2;
const ZOOM_STEP = 0.1;

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
  return app.isPackaged
    ? path.join(process.resourcesPath, "icon.ico")
    : path.join(app.getAppPath(), "build", "icon.ico");
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
      sandbox: true
    }
  });

  mainWindow.removeMenu();
  mainWindow.once("ready-to-show", () => mainWindow.show());
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
