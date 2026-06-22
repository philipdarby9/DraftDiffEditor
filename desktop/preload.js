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
  hideForClose: () => ipcRenderer.invoke("draft-diff:hide-for-close"),
  showAfterCloseError: () => ipcRenderer.invoke("draft-diff:show-after-close-error"),
  saveState: body => ipcRenderer.invoke("draft-diff:save-state", String(body || "")),
  backupProject: body => ipcRenderer.invoke("draft-diff:backup-project", String(body || "")),
  startVersionHistorySummary: body => ipcRenderer.invoke("draft-diff:version-history-summary-start", String(body || "")),
  versionHistorySummaryProgress: jobId => ipcRenderer.invoke("draft-diff:version-history-summary-progress", String(jobId || "")),
  openGeneratedReport: reportPath => ipcRenderer.invoke("draft-diff:open-generated-report", String(reportPath || "")),
  showGeneratedReportInFolder: reportPath => ipcRenderer.invoke("draft-diff:show-generated-report-in-folder", String(reportPath || "")),
  openTextFile: () => ipcRenderer.invoke("draft-diff:open-text-file"),
  recentTextFiles: () => ipcRenderer.invoke("draft-diff:recent-text-files"),
  openRecentTextFile: body => ipcRenderer.invoke("draft-diff:open-recent-text-file", String(body || "")),
  persistClose: body => ipcRenderer.invoke("draft-diff:persist-close", String(body || "")),
  checkSpelling: word => ipcRenderer.invoke("draft-diff:spellcheck-word", String(word || "")),
  isWordMisspelled: word => ipcRenderer.invoke("draft-diff:spellcheck-word", String(word || ""))
    .then(result => Boolean(result?.misspelled)),
  getWordSuggestions: word => ipcRenderer.invoke("draft-diff:spellcheck-word", String(word || ""))
    .then(result => Array.isArray(result?.suggestions) ? result.suggestions : []),
  addWordToDictionary: word => ipcRenderer.invoke("draft-diff:add-word-to-dictionary", String(word || ""))
});
