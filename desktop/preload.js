const { contextBridge, ipcRenderer, webFrame } = require("electron");

function installSpellCheckProvider() {
  try {
    webFrame.setSpellCheckProvider("en-GB", {
      spellCheck(words, callback) {
        ipcRenderer.invoke("draft-diff:spellcheck-words", words)
          .then(misspelledWords => {
            callback(Array.isArray(misspelledWords) ? misspelledWords : []);
          })
          .catch(() => callback([]));
      }
    });
  } catch {}
}

installSpellCheckProvider();

contextBridge.exposeInMainWorld("draftDiffDesktop", {
  zoomIn: () => ipcRenderer.invoke("draft-diff:zoom", "in"),
  zoomOut: () => ipcRenderer.invoke("draft-diff:zoom", "out"),
  checkSpelling: word => ipcRenderer.invoke("draft-diff:spellcheck-word", String(word || "")),
  isWordMisspelled: word => ipcRenderer.invoke("draft-diff:spellcheck-word", String(word || ""))
    .then(result => Boolean(result?.misspelled)),
  getWordSuggestions: word => ipcRenderer.invoke("draft-diff:spellcheck-word", String(word || ""))
    .then(result => Array.isArray(result?.suggestions) ? result.suggestions : []),
  addWordToDictionary: word => ipcRenderer.invoke("draft-diff:add-word-to-dictionary", String(word || ""))
});
