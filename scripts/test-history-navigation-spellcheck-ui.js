const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { app, BrowserWindow } = require("electron");

const fixtureDir = fs.mkdtempSync(path.join(os.tmpdir(), "draft-diff-history-navigation-ui-"));
const format = {
  fontFamily: "Consolas",
  fontSize: "12",
  lineHeight: "1.62"
};

const baseLines = Array.from(
  { length: 80 },
  (_, index) => `Shared history line ${index + 1} keeps the comparison body tall enough to scroll.`
);
const firstChangeLines = [...baseLines];
firstChangeLines[54] = "The first saved change appears well below the version header.";
firstChangeLines[64] = "A second saved change appears farther down the same version.";
const secondChangeLines = [...firstChangeLines];
secondChangeLines[69] = "The second saved change appears after the first one.";

function version(id, createdAt, lines) {
  const content = lines.join("\n");
  return {
    id,
    title: "History navigation test",
    createdAt,
    content,
    contentHtml: `<p>${content.replace(/\n/g, "</p><p>")}</p>`,
    format
  };
}

const versions = [
  version("history-navigation-v1", "2026-01-01T00:00:00.000Z", baseLines),
  version("history-navigation-v2", "2026-01-02T00:00:00.000Z", baseLines),
  version("history-navigation-v3", "2026-01-03T00:00:00.000Z", firstChangeLines),
  version("history-navigation-v4", "2026-01-04T00:00:00.000Z", secondChangeLines)
];
const latest = versions[versions.length - 1];

fs.writeFileSync(path.join(fixtureDir, "project.json"), `${JSON.stringify({
  version: 1,
  storyId: "history-navigation-story",
  formatDefaultVersion: 2,
  defaultFormat: format,
  createdAt: versions[0].createdAt,
  updatedAt: latest.createdAt,
  initialNotes: {
    id: "initial-notes",
    title: "Project notes",
    createdAt: versions[0].createdAt,
    updatedAt: versions[0].createdAt,
    content: "",
    contentHtml: "",
    format,
    versionHistory: []
  },
  drafts: [{
    id: "history-navigation-draft",
    title: "History navigation test",
    createdAt: versions[0].createdAt,
    updatedAt: latest.createdAt,
    content: latest.content,
    contentHtml: latest.contentHtml,
    format,
    versionHistory: versions,
    notes: {
      id: "history-navigation-notes",
      title: "History navigation test Notes",
      createdAt: versions[0].createdAt,
      updatedAt: versions[0].createdAt,
      content: "",
      contentHtml: "",
      format,
      versionHistory: []
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
    width: 1280,
    height: 900,
    webPreferences: {
      contextIsolation: true,
      sandbox: true
    }
  });

  try {
    await window.loadURL(started.url);
    await waitFor(
      window,
      'document.querySelector(`[data-version-history="draft:history-navigation-draft:content"]`)',
      "history button"
    );

    await window.webContents.executeJavaScript(`
      document.querySelector('[data-version-history="draft:history-navigation-draft:content"]').click()
    `);
    await waitFor(
      window,
      'document.querySelector(".history-virtual-strip")?.dataset.historyTotalPages === "4"',
      "history pages"
    );
    await waitFor(
      window,
      'historyVirtualState?.firstChangedPosition === 1 && document.querySelector(`[data-history-position="1"] [data-history-change-token="true"]`)',
      "first changed version"
    );

    const initialFocus = await window.webContents.executeJavaScript(`
      (() => {
        const page = document.querySelector('[data-history-position="1"]');
        const body = page?.querySelector(".compare-page-body");
        const token = page?.querySelector('[data-history-change-token="true"]');
        const bodyRect = body?.getBoundingClientRect();
        const tokenRect = token?.getBoundingClientRect();
        return {
          firstChangedPosition: historyVirtualState.firstChangedPosition,
          horizontalFocus: document.querySelector("#diff-output").scrollLeft > 0,
          bodyScrollTop: body?.scrollTop || 0,
          tokenOffsetFromBodyTop: tokenRect && bodyRect ? tokenRect.top - bodyRect.top : null
        };
      })()
    `);
    assert.equal(initialFocus.firstChangedPosition, 1);
    assert.equal(initialFocus.horizontalFocus, true);
    assert.ok(initialFocus.bodyScrollTop > 0, "the first changed version should scroll into its change");
    assert.ok(
      Math.abs(initialFocus.tokenOffsetFromBodyTop) < 14,
      `first change should be at the top of the version body, got ${initialFocus.tokenOffsetFromBodyTop}px`
    );

    const changeCounters = await window.webContents.executeJavaScript(`
      (() => {
        const page = document.querySelector('[data-history-position="1"]');
        return {
          added: page.querySelector('[data-history-change-type="added"]')?.innerText || "",
          removed: page.querySelector('[data-history-change-type="removed"]')?.innerText || "",
          addedButtons: page.querySelectorAll('[data-history-change-type="added"]').length,
          removedButtons: page.querySelectorAll('[data-history-change-type="removed"]').length
        };
      })()
    `);
    assert.equal(changeCounters.addedButtons, 1);
    assert.equal(changeCounters.removedButtons, 1);
    assert.match(changeCounters.added, /\+2\s+added/u);
    assert.match(changeCounters.removed, /-2\s+deleted/u);

    await window.webContents.executeJavaScript(`
      document.querySelector('[data-history-position="1"] [data-history-change-type="added"]').click()
    `);
    await waitFor(
      window,
      'document.querySelector(`[data-history-position="1"] .compare-target-highlight.added`)',
      "first added change from counter"
    );
    const firstAddedText = await window.webContents.executeJavaScript(
      'document.querySelector(`[data-history-position="1"] .compare-target-highlight.added`).innerText'
    );

    await window.webContents.executeJavaScript(`
      document.querySelector('[data-history-position="1"] [data-history-change-type="added"]').click()
    `);
    await waitFor(
      window,
      'document.querySelector(`[data-history-position="1"] .compare-target-highlight.added`)',
      "second added change from counter"
    );
    const secondAddedText = await window.webContents.executeJavaScript(
      'document.querySelector(`[data-history-position="1"] .compare-target-highlight.added`).innerText'
    );
    assert.notEqual(secondAddedText, firstAddedText);

    await window.webContents.executeJavaScript(`
      document.querySelector('[data-history-position="1"] [data-history-change-type="removed"]').click()
    `);
    await waitFor(
      window,
      'document.querySelector(`[data-history-position="1"] .compare-target-highlight.removed`)',
      "first deleted change from counter"
    );
    const firstRemovedText = await window.webContents.executeJavaScript(
      'document.querySelector(`[data-history-position="1"] .compare-target-highlight.removed`).innerText'
    );

    await window.webContents.executeJavaScript(`
      document.querySelector('[data-history-position="1"] [data-history-change-type="removed"]').click()
    `);
    await waitFor(
      window,
      'document.querySelector(`[data-history-position="1"] .compare-target-highlight.removed`)',
      "second deleted change from counter"
    );
    const secondRemovedText = await window.webContents.executeJavaScript(
      'document.querySelector(`[data-history-position="1"] .compare-target-highlight.removed`).innerText'
    );
    assert.notEqual(secondRemovedText, firstRemovedText);

    await window.webContents.executeJavaScript(`
      document.querySelector('[data-history-position="1"] [data-history-change-token="true"]').click()
    `);
    await waitFor(
      window,
      'document.querySelector(`[data-history-position="1"] .compare-target-highlight[data-history-change-token="true"]`)',
      "next highlighted change"
    );

    const nextFocus = await window.webContents.executeJavaScript(`
      (() => {
        const page = document.querySelector('[data-history-position="1"]');
        const body = page.querySelector(".compare-page-body");
        const token = page.querySelector('.compare-target-highlight[data-history-change-token="true"]');
        return {
          bodyScrollTop: body.scrollTop,
          tokenOffsetFromBodyTop: token.getBoundingClientRect().top - body.getBoundingClientRect().top,
          tokenIsNotFirst: token !== page.querySelector('[data-history-change-token="true"]')
        };
      })()
    `);
    assert.ok(nextFocus.bodyScrollTop > 0, "the next change should scroll its version body");
    assert.ok(Math.abs(nextFocus.tokenOffsetFromBodyTop) < 14);
    assert.equal(nextFocus.tokenIsNotFirst, true);

    await window.webContents.executeJavaScript(`
      (() => {
        const page = document.querySelector('[data-history-position="1"]');
        page.querySelectorAll('[data-history-change-token="true"]')[
          page.querySelectorAll('[data-history-change-token="true"]').length - 1
        ].click();
      })()
    `);
    await waitFor(
      window,
      'document.querySelector(`[data-history-position="2"] .compare-target-highlight[data-history-change-token="true"]`)',
      "next changed version"
    );

    await window.webContents.executeJavaScript(`
      (() => {
        versionHistoryDraftId = null;
        showChanges = false;
        renderChangesVisibility();
        const draft = state.drafts[0];
        draft.content = "Before the misspelled word\\n" + Array.from(
          { length: 70 },
          (_, index) => "Filler line " + (index + 1) + " keeps the editor scrollable."
        ).join("\\n");
        draft.contentHtml = textToHtml(draft.content);
        render();
      })()
    `);
    await waitFor(window, 'document.querySelector(`[data-editor-key="draft:history-navigation-draft:content"]`)', "editor");

    const spellcheckResult = await window.webContents.executeJavaScript(`
      (async () => {
        const editor = document.querySelector('[data-editor-key="draft:history-navigation-draft:content"]');
        const textNode = editor.firstChild?.firstChild || editor.firstChild;
        const word = "the";
        const start = textNode.nodeValue.indexOf(word);
        const range = document.createRange();
        range.setStart(textNode, start);
        range.setEnd(textNode, start + word.length);
        showSpellcheckMenu({
          word: "teh",
          range,
          editorEl: editor,
          suggestions: ["the"],
          misspelled: true,
          clientX: 40,
          clientY: 40
        });
        document.querySelector('[data-spellcheck-action="suggestion:0"]').click();
        await new Promise(resolve => setTimeout(resolve, 120));
        const selection = window.getSelection();
        const caret = selection?.rangeCount ? selection.getRangeAt(0) : null;
        return {
          text: editor.innerText,
          caretTextOffset: caret ? textOffsetForRangeBoundary(editor, caret.startContainer, caret.startOffset) : -1,
          expectedCaretTextOffset: "Before the".length,
          menuOpen: Boolean(document.querySelector(".spellcheck-menu"))
        };
      })()
    `);
    assert.match(spellcheckResult.text, /^Before the misspelled word/u);
    assert.equal(spellcheckResult.caretTextOffset, spellcheckResult.expectedCaretTextOffset);
    assert.equal(spellcheckResult.menuOpen, false);

    console.log("history navigation and spellcheck caret UI test passed");
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
