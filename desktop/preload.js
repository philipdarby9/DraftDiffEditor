const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("draftDiffDesktop", {
  zoomIn: () => ipcRenderer.invoke("draft-diff:zoom", "in"),
  zoomOut: () => ipcRenderer.invoke("draft-diff:zoom", "out")
});
