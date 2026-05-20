const path = require("node:path");
const { app, BrowserWindow, shell } = require("electron");

let mainWindow = null;
let serverApi = null;
let serverHandle = null;

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
    show: false,
    webPreferences: {
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

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith(serverHandle.url)) return { action: "allow" };
    shell.openExternal(url);
    return { action: "deny" };
  });

  await mainWindow.loadURL(serverHandle.url);
}

app.whenReady()
  .then(createWindow)
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
