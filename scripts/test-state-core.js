const assert = require("node:assert/strict");
const StateCore = require("../public/state-core");

function run() {
  {
    assert.deepEqual(StateCore.normalizeFormat({
      fontFamily: "Papyrus",
      fontSize: 99,
      lineHeight: "7"
    }), StateCore.DEFAULT_FORMAT);

    assert.deepEqual(StateCore.upgradeLegacyDefaultFormat({
      fontFamily: "Segoe UI",
      fontSize: "18",
      lineHeight: "1.8"
    }, true), {
      fontFamily: "Consolas",
      fontSize: "18",
      lineHeight: "1.8"
    });
  }

  {
    const normalized = StateCore.normalizeState({
      formatDefaultVersion: 1,
      defaultFormat: { fontFamily: "Segoe UI", fontSize: "16", lineHeight: "1.62" },
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-03T00:00:00.000Z",
      initialNotes: {
        content: "Line one\nLine two",
        contentHtml: "Line one<br>Line two",
        versionHistory: [
          { createdAt: "2026-01-02T00:00:00.000Z", content: "Later note" },
          { createdAt: "2026-01-01T00:00:00.000Z", content: "" }
        ]
      },
      drafts: [{
        id: "draft-a",
        title: "Draft A",
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-03T00:00:00.000Z",
        content: "Alpha\nBeta",
        contentHtml: "Alpha<br>Beta",
        format: { fontFamily: "Segoe UI", fontSize: "20", lineHeight: "1.8" },
        notes: {
          content: "Note",
          contentHtml: "Note"
        },
        versionHistory: [
          { createdAt: "2026-01-03T00:00:00.000Z", content: "Alpha\nBeta" },
          { createdAt: "2026-01-01T00:00:00.000Z", content: "Alpha" }
        ]
      }],
      viewState: {
        displayedDraftIndexes: [0, 99],
        collapsedNotesIndexes: [0],
        selectedDraftId: "draft-a",
        activeArea: "draft",
        activeDraftId: "draft-a",
        activePageType: "notes",
        pagesOnScreen: 12,
        pagePanePercents: { "draft:draft-a:content": 4, "draft:missing:content": 50 }
      }
    });

    assert.equal(normalized.formatDefaultVersion, StateCore.FORMAT_DEFAULT_VERSION);
    assert.equal(normalized.defaultFormat.fontFamily, StateCore.DEFAULT_FORMAT.fontFamily);
    assert.equal(normalized.drafts[0].format.fontFamily, StateCore.DEFAULT_FORMAT.fontFamily);
    assert.equal(normalized.drafts[0].content, "Alpha\nBeta");
    assert.equal(normalized.drafts[0].versionHistory[0].content, "Alpha");
    assert.equal(normalized.drafts[0].versionHistory[1].content, "Alpha\nBeta");
    assert.equal(normalized.initialNotes.versionHistory.some(version => version.content === "Later note"), true);
    assert.equal(normalized.viewState.pagesOnScreen, 4);
    assert.equal(normalized.viewState.activeEditorKey, "draft:draft-a:notes");
    assert.equal(normalized.viewState.pagePanePercents["draft:draft-a:content"], StateCore.MIN_PAGE_PANE_PERCENT);
  }

  {
    const normalized = StateCore.normalizeState({
      createdAt: "2026-01-01T00:00:00.000Z",
      initialNotes: { content: "Project notes" },
      drafts: [{
        id: "draft-b",
        title: "Draft B",
        createdAt: "2026-01-02T00:00:00.000Z",
        content: "One two three.",
        notes: { content: "Private note" },
        versionHistory: [{ content: "One two." }]
      }]
    });

    const storage = StateCore.stateForStorage(normalized);
    assert.equal(storage.drafts[0].versionHistory, undefined);
    assert.equal(storage.initialNotes.versionHistory, undefined);

    const snapshot = StateCore.serializeProjectState(normalized, { includeVersionHistory: false });
    assert.equal(JSON.parse(snapshot).drafts[0].versionHistory, undefined);

    const exportText = StateCore.formatExport(normalized);
    assert.equal(exportText.includes("Project notes"), true);
    assert.equal(exportText.includes("Draft B"), true);
    assert.equal(exportText.includes("Word count: 3"), true);
    assert.equal(exportText.endsWith("\n"), true);
  }

  {
    const page = {
      title: "Draft C",
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
      content: "Alpha",
      contentHtml: "Alpha",
      format: StateCore.DEFAULT_FORMAT,
      versionHistory: []
    };

    assert.equal(StateCore.appendPageVersionIfChanged(page, "Draft C"), true);
    assert.equal(page.versionHistory.length, 1);
    assert.equal(StateCore.appendPageVersionIfChanged(page, "Draft C"), false);
    assert.equal(page.versionHistory.length, 1);

    page.content = "Alpha beta";
    page.contentHtml = "Alpha beta";
    page.updatedAt = "2026-01-02T00:00:00.000Z";
    assert.equal(StateCore.appendPageVersionIfChanged(page, "Draft C"), true);
    assert.equal(page.versionHistory.length, 2);
    assert.equal(page.versionHistory[1].content, "Alpha beta");
  }

  {
    const page = {
      title: "Draft D",
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-02T00:00:00.000Z",
      content: "Middle",
      contentHtml: "Middle",
      format: StateCore.DEFAULT_FORMAT,
      versionHistory: [
        { createdAt: "2026-01-01T00:00:00.000Z", title: "Draft D", content: "Old", contentHtml: "Old" },
        { createdAt: "2026-01-03T00:00:00.000Z", title: "Draft D", content: "New", contentHtml: "New" }
      ]
    };

    assert.equal(StateCore.promotePageToNewestHistoryVersion(page, "Draft D"), true);
    assert.equal(page.content, "New");
    assert.equal(page.updatedAt, "2026-01-03T00:00:00.000Z");
    assert.equal(page.versionHistory.some(version => version.content === "Middle"), true);
  }

  {
    const page = {
      title: "",
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
      content: "",
      contentHtml: "",
      format: StateCore.DEFAULT_FORMAT
    };

    StateCore.applyVersionHistoryEntryToPage(page, {
      createdAt: "2026-01-04T00:00:00.000Z",
      contentHtml: "<p>bad</p>",
      format: { fontSize: "18" }
    }, "Fallback", {
      sanitizeHtml: html => html.replace("bad", "good"),
      textFromHtml: html => `plain:${html}`
    });

    assert.equal(page.title, "Fallback");
    assert.equal(page.contentHtml, "<p>good</p>");
    assert.equal(page.content, "plain:<p>good</p>");
    assert.equal(page.format.fontSize, "18");
  }
}

run();
console.log("state-core tests passed");
