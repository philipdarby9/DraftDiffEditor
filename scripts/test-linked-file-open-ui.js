const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { app, BrowserWindow } = require("electron");

const fixtureDir = fs.mkdtempSync(path.join(os.tmpdir(), "draft-diff-linked-open-ui-"));
const historyDir = path.join(fixtureDir, "history");
const linkedTextPath = path.join(fixtureDir, "linked-story.txt");
const historyPath = path.join(historyDir, "json", "linked-story.version-history.json");
const format = {
  fontFamily: "Consolas",
  fontSize: "12",
  lineHeight: "1.62"
};
const olderText = "An earlier saved draft.";
const inAppText = "The current text held by the app.";
const externalText = "The text changed outside Draft Diff.";
const futureText = "A future-dated saved version.";

process.env.DRAFT_DIFF_DATA_DIR = fixtureDir;
process.env.DRAFT_DIFF_HOST = "127.0.0.1";

const StateCore = require("../public/state-core");
const server = require("../server");
const { startServer, stopServer, __test: serverTest } = server;

const initialState = StateCore.normalizeState({
  version: 1,
  storyId: "linked-open-story",
  formatDefaultVersion: 2,
  defaultFormat: format,
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-02T00:00:00.000Z",
  initialNotes: {
    id: "initial-notes",
    title: "Project notes",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    content: "",
    contentHtml: "",
    format,
    versionHistory: []
  },
  drafts: [{
    id: "linked-open-draft",
    title: "Draft 1",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-02T00:00:00.000Z",
    content: inAppText,
    contentHtml: `<p>${inAppText}</p>`,
    format,
    versionHistory: [{
      id: "linked-open-older-version",
      createdAt: "2026-01-01T00:00:00.000Z",
      title: "Draft 1",
      content: olderText,
      contentHtml: `<p>${olderText}</p>`,
      format
    }],
    notes: {
      id: "linked-open-notes",
      title: "Draft 1 Notes",
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
      content: "",
      contentHtml: "",
      format,
      versionHistory: []
    }
  }]
});

fs.mkdirSync(historyDir, { recursive: true });
serverTest.writeVersionHistoryFolderPath(historyDir);
serverTest.writeTextFileLink(linkedTextPath);
serverTest.writeAll(initialState, {
  filePath: linkedTextPath,
  fileName: path.basename(linkedTextPath),
  allowCreateLinkedTextFile: true
});

const otherTextPath = path.join(fixtureDir, "other-story.txt");
fs.writeFileSync(otherTextPath, StateCore.formatExport(initialState), "utf8");
const readOnlyPayload = server.openedTextFilePayload(otherTextPath);
assert.equal(readOnlyPayload.matchesLinkedTextFile, false);
assert.equal(
  JSON.parse(fs.readFileSync(path.join(fixtureDir, "text-file-link.json"), "utf8")).filePath,
  linkedTextPath,
  "reading a selected file must not activate it as the linked file"
);
assert.equal(server.openedTextFilePayload(linkedTextPath).matchesLinkedTextFile, true);

app.on("window-all-closed", () => {});

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function waitFor(window, expression, label, timeoutMs = 15_000) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    if (await window.webContents.executeJavaScript(`Boolean(${expression})`)) return;
    await delay(60);
  }
  throw new Error(`Timed out waiting for ${label}`);
}

function installLinkedFileWriteAudit() {
  const writes = [];
  const originalWriteFileSync = fs.writeFileSync;
  const originalRenameSync = fs.renameSync;
  const originalCopyFileSync = fs.copyFileSync;
  const isLinkedPath = value => (
    typeof value === "string"
    && path.resolve(value) === path.resolve(linkedTextPath)
  );

  fs.writeFileSync = function auditedWriteFileSync(filePath, ...args) {
    if (isLinkedPath(filePath)) {
      writes.push({
        operation: "writeFileSync",
        filePath,
        stack: new Error().stack
      });
    }
    return originalWriteFileSync.call(this, filePath, ...args);
  };
  fs.renameSync = function auditedRenameSync(sourcePath, targetPath) {
    if (isLinkedPath(targetPath)) {
      writes.push({
        operation: "renameSync",
        filePath: targetPath,
        stack: new Error().stack
      });
    }
    return originalRenameSync.call(this, sourcePath, targetPath);
  };
  fs.copyFileSync = function auditedCopyFileSync(sourcePath, targetPath, ...args) {
    if (isLinkedPath(targetPath)) {
      writes.push({
        operation: "copyFileSync",
        filePath: targetPath,
        stack: new Error().stack
      });
    }
    return originalCopyFileSync.call(this, sourcePath, targetPath, ...args);
  };

  return {
    writes,
    restore() {
      fs.writeFileSync = originalWriteFileSync;
      fs.renameSync = originalRenameSync;
      fs.copyFileSync = originalCopyFileSync;
    }
  };
}

async function run() {
  await app.whenReady();
  const started = await startServer({ port: 0, host: "127.0.0.1" });
  const window = new BrowserWindow({
    show: false,
    width: 1000,
    height: 760,
    webPreferences: {
      contextIsolation: true,
      sandbox: true
    }
  });

  try {
    await window.loadURL(started.url);
    await waitFor(
      window,
      `state?.drafts?.[0]?.content === ${JSON.stringify(inAppText)}`,
      "initial linked draft"
    );

    const futureDatedHistory = JSON.parse(fs.readFileSync(historyPath, "utf8"));
    futureDatedHistory.drafts[0].history.push({
      id: "linked-open-future-version",
      createdAt: "2099-01-01T00:00:00.000Z",
      title: "Draft 1",
      content: futureText,
      contentHtml: `<p>${futureText}</p>`,
      format
    });
    fs.writeFileSync(historyPath, `${JSON.stringify(futureDatedHistory, null, 2)}\n`, "utf8");

    const diskState = StateCore.normalizeState({
      ...initialState,
      updatedAt: "2026-01-03T00:00:00.000Z",
      drafts: [{
        ...initialState.drafts[0],
        updatedAt: "2026-01-03T00:00:00.000Z",
        content: externalText,
        contentHtml: `<p>${externalText}</p>`
      }]
    });
    const diskText = StateCore.formatExport(diskState);
    fs.writeFileSync(linkedTextPath, diskText, "utf8");
    const statBeforeOpen = fs.statSync(linkedTextPath, { bigint: true });
    const audit = installLinkedFileWriteAudit();

    try {
      await window.webContents.executeJavaScript(
        `(() => {
          queueSave(25);
          queuePageSave(draftContentKey(state.drafts[0].id), 25);
          return openRecentTextProject(${JSON.stringify(linkedTextPath)});
        })()`
      );
    } finally {
      audit.restore();
    }

    const renderedState = await window.webContents.executeJavaScript(`(() => {
      const draft = state.drafts[0];
      return {
        current: draft.content,
        history: draft.versionHistory.map(version => version.content),
        linkedPath: linkedTextPath
      };
    })()`);
    const statAfterOpen = fs.statSync(linkedTextPath, { bigint: true });
    const persistedHistory = JSON.parse(fs.readFileSync(historyPath, "utf8"));
    const persistedDraftHistory = persistedHistory.drafts[0].history
      .map(version => version.content);

    assert.deepEqual(
      audit.writes,
      [],
      "opening the currently linked file must not issue any write to that file"
    );
    assert.equal(
      fs.readFileSync(linkedTextPath, "utf8"),
      diskText,
      "opening the linked file must leave its external contents byte-for-byte unchanged"
    );
    assert.equal(
      statAfterOpen.mtimeNs,
      statBeforeOpen.mtimeNs,
      "opening the linked file must not replace or touch it"
    );
    assert.equal(renderedState.linkedPath, linkedTextPath);
    assert.equal(renderedState.current, externalText, "external text should become the current draft");
    assert.equal(renderedState.history.includes(olderText), true, "earlier history should remain");
    assert.equal(
      renderedState.history.includes(futureText),
      true,
      "future-dated history should remain without replacing the opened disk text"
    );
    assert.equal(
      renderedState.history.includes(inAppText),
      true,
      "the displaced in-app draft should be added to history"
    );
    assert.equal(
      renderedState.history.includes(externalText),
      true,
      "the newly imported external draft should be added to history"
    );
    assert.equal(
      persistedDraftHistory.includes(inAppText),
      true,
      "the displaced in-app draft should be persisted in the version-history sidecar"
    );
    assert.equal(
      persistedDraftHistory.includes(externalText),
      true,
      "the external draft should be persisted in the version-history sidecar"
    );
    assert.equal(
      serverTest.readState().drafts[0].content,
      externalText,
      "reloading persisted state must keep the explicitly opened disk text current"
    );

    console.log("linked-file open UI test passed");
  } finally {
    const stopping = stopServer(started.server, { flush: false });
    started.server.closeAllConnections?.();
    await stopping;
    window.destroy();
  }
}

run()
  .catch(error => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    fs.rmSync(fixtureDir, { recursive: true, force: true });
    app.exit(process.exitCode || 0);
  });
