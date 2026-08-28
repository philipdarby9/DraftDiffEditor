const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { app, BrowserWindow } = require("electron");

const fixtureDir = fs.mkdtempSync(path.join(os.tmpdir(), "draft-diff-typing-performance-ui-"));
const format = {
  fontFamily: "Consolas",
  fontSize: "12",
  lineHeight: "1.62"
};

fs.writeFileSync(path.join(fixtureDir, "project.json"), `${JSON.stringify({
  version: 1,
  storyId: "typing-performance-story",
  formatDefaultVersion: 2,
  defaultFormat: format,
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
  initialNotes: {
    id: "initial-notes",
    title: "Project notes",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    content: "",
    contentHtml: "",
    format
  },
  drafts: [{
    id: "typing-performance-draft",
    title: "Large draft",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    content: "",
    contentHtml: "",
    format,
    notes: {
      id: "typing-performance-notes",
      title: "Large draft Notes",
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
      content: "",
      contentHtml: "",
      format
    }
  }]
}, null, 2)}\n`, "utf8");

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

async function run() {
  await app.whenReady();
  const started = await startServer({ port: 0, host: "127.0.0.1" });
  const window = new BrowserWindow({
    show: false,
    width: 1200,
    height: 800,
    webPreferences: {
      contextIsolation: true,
      sandbox: true
    }
  });

  try {
    await window.loadURL(started.url);
    await waitFor(window, "state?.drafts?.[0]?.id === 'typing-performance-draft'", "typing fixture");

    const result = await window.webContents.executeJavaScript(`
      (async () => {
        const draft = state.drafts[0];
        draft.content = "large document word ".repeat(50_000);
        draft.contentHtml = textToHtml(draft.content);
        displayedPageKeys = new Set([draftContentKey(draft.id)]);
        selectedDraftId = draft.id;
        activeEditorKey = draftContentKey(draft.id);
        render();
        await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));

        let editor = editorElementForKey(activeEditorKey);
        const initialEditorTag = editor.tagName;
        editor.focus();
        editor.setSelectionRange(editor.value.length, editor.value.length);
        editor.focus();
        recordPageUndoSnapshot(activeEditorKey);

        let inputDuration = null;
        let beforeInputAt = 0;
        const onBeforeInput = event => {
          if (event.target.closest?.("[data-editor-key]") === editor) beforeInputAt = performance.now();
        };
        const onInput = event => {
          if (event.target.closest?.("[data-editor-key]") !== editor || !beforeInputAt) return;
          inputDuration = performance.now() - beforeInputAt;
        };
        document.addEventListener("beforeinput", onBeforeInput, true);
        document.addEventListener("input", onInput);

        editor.dispatchEvent(new InputEvent("beforeinput", {
          bubbles: true,
          cancelable: true,
          inputType: "insertText",
          data: " typed"
        }));
        editor.value = editor.value + " typed";
        editor.setSelectionRange(editor.value.length, editor.value.length);
        editor.dispatchEvent(new InputEvent("input", {
          bubbles: true,
          inputType: "insertText",
          data: " typed"
        }));
        const immediate = {
          inputDuration,
          pendingSync: pendingEditorSyncKeys.has(activeEditorKey),
          stateStillBeforeInput: !draft.content.endsWith(" typed"),
          editorTag: editor.tagName
        };

        await new Promise(resolve => setTimeout(resolve, EDITOR_SYNC_DEBOUNCE_MS + 80));
        const synced = draft.content.endsWith(" typed");
        undoProjectChange();
        const undone = !state.drafts[0].content.endsWith(" typed")
          && !editorElementForKey(activeEditorKey).value.endsWith(" typed");

        editor = editorElementForKey(activeEditorKey);
        editor.focus();
        editor.setSelectionRange(0, 0);
        const beforeTab = editor.value;
        const tabEvent = new KeyboardEvent("keydown", {
          bubbles: true,
          cancelable: true,
          key: "Tab"
        });
        editor.dispatchEvent(tabEvent);
        const tabInserted = editor.value === "\\t" + beforeTab;

        undoProjectChange();
        editor = editorElementForKey(activeEditorKey);
        editor.focus();
        editor.setSelectionRange(0, 5);
        runEditorCommand(activeEditorKey, "bold");
        editor = editorElementForKey(activeEditorKey);
        const convertedToRich = editor.tagName === "DIV"
          && editor.getAttribute("contenteditable") === "true"
          && state.drafts[0].contentHtml.includes("<strong>");

        document.removeEventListener("beforeinput", onBeforeInput, true);
        document.removeEventListener("input", onInput);
        return { immediate, synced, undone, initialEditorTag, tabInserted, convertedToRich };
      })()
    `);

    assert.equal(result.immediate.pendingSync, true, "typing should queue, not synchronously flush, the large editor");
    assert.equal(result.immediate.stateStillBeforeInput, true, "the model may lag until the coalesced sync");
    assert.equal(result.synced, true, "the queued editor sync should update the model");
    assert.equal(result.undone, true, "undo should still restore the pre-typing content");
    assert.equal(result.initialEditorTag, "TEXTAREA", "large plain documents should use the textarea editor");
    assert.equal(result.immediate.editorTag, "TEXTAREA", "typing should stay in plain-text mode");
    assert.equal(result.tabInserted, true, "Tab should insert a literal tab in plain-text mode");
    assert.equal(result.convertedToRich, true, "rich formatting should promote the editor on demand");
    assert.ok(
      result.immediate.inputDuration === null || result.immediate.inputDuration < 50,
      `large-document input handler took ${result.immediate.inputDuration}ms`
    );

    console.log("large-document typing performance UI test passed");
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
