const { contextBridge, ipcRenderer, webFrame } = require("electron");

contextBridge.exposeInMainWorld("draftDiffDesktop", {
  zoomIn: () => ipcRenderer.invoke("draft-diff:zoom", "in"),
  zoomOut: () => ipcRenderer.invoke("draft-diff:zoom", "out"),
  isWordMisspelled: word => webFrame.isWordMisspelled(String(word || "")),
  getWordSuggestions: word => webFrame.getWordSuggestions(String(word || "")),
  addWordToDictionary: word => ipcRenderer.invoke("draft-diff:add-word-to-dictionary", String(word || ""))
});
