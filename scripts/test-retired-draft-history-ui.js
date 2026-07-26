const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { app, BrowserWindow } = require("electron");

const workspace = path.resolve(__dirname, "..");
const fixtureDir = fs.mkdtempSync(path.join(os.tmpdir(), "draft-diff-retired-history-ui-"));
const historyDir = path.join(fixtureDir, "history");
const historyJsonDir = path.join(historyDir, "json");
const linkedTextPath = path.join(fixtureDir, "retired-ui.txt");
const historyPath = path.join(historyJsonDir, "retired-ui.version-history.json");
const screenshotPath = path.join(workspace, ".codex-screens", "retired-draft-history-ui.png");
const format = {
  fontFamily: "Consolas",
  fontSize: "12",
  lineHeight: "1.62"
};

const project = {
  version: 1,
  storyId: "retired-ui-story",
  formatDefaultVersion: 2,
  defaultFormat: format,
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-03T00:00:00.000Z",
  initialNotes: {
    id: "initial-notes",
    title: "Project notes",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    content: "",
    contentHtml: "",
    format
  },
  drafts: [
    {
      id: "retired-ui-draft-1",
      title: "Draft 1",
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-03T00:00:00.000Z",
      content: "Live Draft 1 text",
      contentHtml: "<p>Live Draft 1 text</p>",
      format,
      notes: {
        id: "retired-ui-notes-1",
        title: "Draft 1 Notes",
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-01T00:00:00.000Z",
        content: "",
        contentHtml: "",
        format
      }
    },
    {
      id: "retired-ui-draft-2",
      title: "Draft 2",
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-03T00:00:00.000Z",
      content: "",
      contentHtml: "",
      format,
      notes: {
        id: "retired-ui-notes-2",
        title: "Draft 2 Notes",
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-03T00:00:00.000Z",
        content: "",
        contentHtml: "",
        format
      }
    }
  ]
};

const sidecar = {
  version: 1,
  storyId: project.storyId,
  sourceFileName: path.basename(linkedTextPath),
  sourceFilePath: linkedTextPath,
  updatedAt: project.updatedAt,
  projectUpdatedAt: project.updatedAt,
  story: {
    id: "initial-notes",
    title: "Project notes",
    history: []
  },
  drafts: [
    {
      id: "retired-ui-draft-1",
      index: 0,
      title: "Draft 1",
      createdAt: "2026-01-01T00:00:00.000Z",
      history: [],
      notes: {
        id: "retired-ui-notes-1",
        title: "Draft 1 Notes",
        history: []
      }
    },
    {
      id: "retired-ui-draft-2",
      index: 1,
      title: "Draft 2",
      createdAt: "2026-01-01T00:00:00.000Z",
      history: [
        {
          id: "retired-ui-draft-2-original",
          createdAt: "2026-01-01T00:00:00.000Z",
          title: "Draft 2",
          content: "Original Draft 2 text kept in history",
          contentHtml: "<p>Original Draft 2 text kept in history</p>",
          format
        },
        {
          id: "retired-ui-draft-2-cleared",
          createdAt: "2026-01-03T00:00:00.000Z",
          title: "Draft 2",
          content: "",
          contentHtml: "",
          format
        }
      ],
      notes: {
        id: "retired-ui-notes-2",
        title: "Draft 2 Notes",
        history: [
          {
            id: "retired-ui-notes-2-original",
            createdAt: "2026-01-02T00:00:00.000Z",
            title: "Draft 2 Notes",
            content: "Original Draft 2 notes kept in history",
            contentHtml: "<p>Original Draft 2 notes kept in history</p>",
            format
          },
          {
            id: "retired-ui-notes-2-cleared",
            createdAt: "2026-01-03T00:00:00.000Z",
            title: "Draft 2 Notes",
            content: "",
            contentHtml: "",
            format
          }
        ]
      }
    }
  ]
};

fs.mkdirSync(historyJsonDir, { recursive: true });
fs.writeFileSync(path.join(fixtureDir, "project.json"), `${JSON.stringify(project, null, 2)}\n`);
fs.writeFileSync(path.join(fixtureDir, "version-history-folder.json"), `${JSON.stringify({ folderPath: historyDir }, null, 2)}\n`);
fs.writeFileSync(path.join(fixtureDir, "text-file-link.json"), `${JSON.stringify({ filePath: linkedTextPath }, null, 2)}\n`);
fs.writeFileSync(linkedTextPath, "Project notes\n\nDraft 1\nLive Draft 1 text\n", "utf8");
fs.writeFileSync(historyPath, `${JSON.stringify(sidecar, null, 2)}\n`);
process.env.DRAFT_DIFF_DATA_DIR = fixtureDir;

const { startServer, stopServer } = require("../server");
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

async function waitForStable(window, expression, label, timeoutMs = 15_000) {
  const startedAt = Date.now();
  let consecutiveMatches = 0;
  while (Date.now() - startedAt < timeoutMs) {
    const matches = await window.webContents.executeJavaScript(`Boolean(${expression})`);
    consecutiveMatches = matches ? consecutiveMatches + 1 : 0;
    if (consecutiveMatches >= 12) return;
    await delay(60);
  }
  throw new Error(`Timed out waiting for stable ${label}`);
}

async function run() {
  await app.whenReady();
  const started = await startServer({ port: 0, host: "127.0.0.1" });
  const window = new BrowserWindow({
    show: false,
    width: 1440,
    height: 960,
    webPreferences: {
      contextIsolation: true,
      sandbox: true
    }
  });

  try {
    await window.loadURL(started.url);
    await waitFor(
      window,
      'document.querySelector(\'[data-delete-draft-id="retired-ui-draft-2"]\')',
      "empty Draft 2 delete control"
    );

    await window.webContents.executeJavaScript(`
      (async () => {
        document.querySelector('[data-delete-draft-id="retired-ui-draft-2"]').click();
        await new Promise(resolve => setTimeout(resolve, 120));
        window.clearTimeout(saveTimer);
        saveTimer = null;
        await saveNow();
      })()
    `);
    await waitFor(window, "state.drafts.length === 1", "deleted live Draft 2");

    const afterDeletion = JSON.parse(fs.readFileSync(historyPath, "utf8"));
    const retiredDraft = afterDeletion.drafts.find(draft => draft.id === "retired-ui-draft-2");
    assert.equal(JSON.parse(fs.readFileSync(path.join(fixtureDir, "project.json"), "utf8")).drafts.length, 1);
    assert.equal(afterDeletion.drafts.length, 2);
    assert.equal(retiredDraft?.retired, true);
    assert.equal(
      retiredDraft?.history?.some(version => version.id === "retired-ui-draft-2-original"),
      true
    );
    assert.doesNotMatch(fs.readFileSync(linkedTextPath, "utf8"), /Original Draft 2 text kept in history/);

    const recreated = await window.webContents.executeJavaScript(`
      (async () => {
        document.querySelector("#new-draft-blank").click();
        const draft = state.drafts[state.drafts.length - 1];
        const pageKey = draftContentKey(draft.id);
        const editor = editorElementForKey(pageKey);
        const paragraphs = Array.from(
          { length: 35 },
          (_, index) => "New Draft 2 paragraph " + (index + 1) + " proves new versions append after retirement."
        );
        const text = paragraphs.join("\\n");
        editor.innerHTML = paragraphs.map(paragraph => "<p>" + paragraph + "</p>").join("");
        editor.dispatchEvent(new InputEvent("input", { bubbles: true, inputType: "insertText", data: text }));
        editor.scrollTop = Math.min(180, editor.scrollHeight - editor.clientHeight);
        const scrollTop = editor.scrollTop;
        await new Promise(resolve => setTimeout(resolve, 120));
        window.clearTimeout(saveTimer);
        saveTimer = null;
        await saveNow();
        return {
          id: draft.id,
          selectedDraftId,
          activeEditorKey,
          editorStillPresent: editorElementForKey(pageKey) === editor,
          scrollTop,
          savedScrollTop: editor.scrollTop,
          historyIds: state.drafts[1].versionHistory.map(version => version.id),
          notesHistoryIds: state.drafts[1].notes.versionHistory.map(version => version.id)
        };
      })()
    `);

    assert.equal(recreated.selectedDraftId, recreated.id);
    assert.equal(recreated.activeEditorKey, `draft:${recreated.id}:content`);
    assert.equal(recreated.editorStillPresent, true);
    assert.equal(recreated.savedScrollTop, recreated.scrollTop);
    assert.equal(recreated.historyIds.includes("retired-ui-draft-2-original"), true);
    assert.equal(recreated.notesHistoryIds.includes("retired-ui-notes-2-original"), true);

    const afterRecreation = JSON.parse(fs.readFileSync(historyPath, "utf8"));
    const liveRecreatedDraft = afterRecreation.drafts.find(draft => draft.id === recreated.id);
    assert.equal(afterRecreation.drafts.length, 2);
    assert.ok(liveRecreatedDraft);
    assert.equal(liveRecreatedDraft.retired, undefined);
    assert.equal(
      liveRecreatedDraft.history.some(version => version.id === "retired-ui-draft-2-original"),
      true
    );
    assert.equal(
      liveRecreatedDraft.history.some(version => /New Draft 2 paragraph/.test(version.content || "")),
      true
    );

    await window.webContents.executeJavaScript(`
      document.querySelector('[data-version-history="draft:${recreated.id}:content"]').click()
    `);
    await waitFor(
      window,
      "document.querySelector('.history-virtual-strip')?.dataset.historyTotalPages === String(state.drafts[1].versionHistory.length)",
      "recreated Draft 2 version history"
    );

    await window.webContents.executeJavaScript(`
      document.dispatchEvent(new KeyboardEvent("keydown", {
        key: "f",
        ctrlKey: true,
        bubbles: true
      }))
    `);
    await waitFor(window, '!document.querySelector("#search-popover").hidden', "history search");
    await window.webContents.executeJavaScript(`
      (() => {
        const input = document.querySelector("#search-input");
        input.value = "Original Draft 2 text kept in history";
        input.dispatchEvent(new Event("input", { bubbles: true }));
      })()
    `);
    await waitFor(
      window,
      '!document.querySelector("#search-summary").textContent.startsWith("No matches")',
      "retired Draft 2 text in recreated history"
    );
    await waitForStable(
      window,
      '!document.querySelector(".diff-loading") && document.querySelector(".history-virtual-strip")',
      "stable recreated Draft 2 history"
    );

    window.show();
    window.focus();
    window.webContents.invalidate();
    await delay(300);
    fs.mkdirSync(path.dirname(screenshotPath), { recursive: true });
    fs.writeFileSync(screenshotPath, (await window.capturePage()).toPNG());
    console.log("Retired draft-history UI test passed.");
    console.log(`Screenshot: ${screenshotPath}`);
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
