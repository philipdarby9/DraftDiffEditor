const assert = require("node:assert/strict");
const fs = require("node:fs");
const http = require("node:http");
const os = require("node:os");
const path = require("node:path");

const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), "draft-diff-server-"));
process.env.DRAFT_DIFF_DATA_DIR = dataDir;
process.env.DRAFT_DIFF_HOST = "127.0.0.1";

const StateCore = require("../public/state-core");
const {
  startServer,
  stopServer,
  writeFullVersionHistorySummaryReport,
  __test
} = require("../server");

{
  const page = {
    title: "Merge duplicate cleanup",
    content: "Alpha",
    contentHtml: "Alpha",
    format: StateCore.DEFAULT_FORMAT,
    updatedAt: "2026-01-01T00:00:10.000Z",
    versionHistory: []
  };
  const version = (id, createdAt, content) => ({
    id,
    createdAt,
    title: page.title,
    content,
    contentHtml: content,
    format: StateCore.DEFAULT_FORMAT
  });
  const merged = __test.mergePageVersionHistories(
    [
      version("v1", "2026-01-01T00:00:00.000Z", "Alpha"),
      version("v2", "2026-01-01T00:00:05.000Z", "Alpha beta"),
      version("v3", "2026-01-01T00:00:10.000Z", "Alpha")
    ],
    [
      version("v1-copy", "2026-01-01T00:00:02.500Z", "Alpha"),
      version("v2-copy", "2026-01-01T00:00:07.500Z", "Alpha beta")
    ],
    page,
    page.title
  );
  assert.deepEqual(merged.map(entry => entry.id), ["v1", "v2", "v3"]);
}

assert.deepEqual(__test.macOpenFileDialogScript(), [
  "on run argv",
  "set initialPath to item 1 of argv",
  "set promptText to item 2 of argv",
  "set initialFolder to POSIX file initialPath as alias",
  "set selectedFile to choose file with prompt promptText default location initialFolder",
  "return POSIX path of selectedFile",
  "end run"
]);

assert.deepEqual(__test.macSaveFileDialogScript(), [
  "on run argv",
  "set initialPath to item 1 of argv",
  "set initialName to item 2 of argv",
  "set promptText to item 3 of argv",
  "set initialFolder to POSIX file initialPath as alias",
  "set selectedFile to choose file name with prompt promptText default name initialName default location initialFolder",
  "return POSIX path of selectedFile",
  "end run"
]);

assert.deepEqual(__test.macFolderDialogScript(), [
  "on run argv",
  "set initialPath to item 1 of argv",
  "set promptText to item 2 of argv",
  "set initialFolder to POSIX file initialPath as alias",
  "set selectedFolder to choose folder with prompt promptText default location initialFolder",
  "return POSIX path of selectedFolder",
  "end run"
]);

const spacedFolderPath = path.join(dataDir, "folder with spaces");
const spacedFilePath = path.join(spacedFolderPath, "draft file.txt");
fs.mkdirSync(spacedFolderPath, { recursive: true });
fs.writeFileSync(spacedFilePath, "Draft text", "utf8");

assert.deepEqual(__test.openFileLocationCommand(spacedFilePath, "win32"), {
  filePath: spacedFilePath,
  directoryPath: spacedFolderPath,
  command: "explorer.exe",
  args: ["/select,", spacedFilePath]
});

assert.deepEqual(__test.openFileLocationCommand(path.join(spacedFolderPath, "missing.txt"), "win32"), {
  filePath: path.join(spacedFolderPath, "missing.txt"),
  directoryPath: spacedFolderPath,
  command: "explorer.exe",
  args: [spacedFolderPath]
});

async function readJson(response) {
  const text = await response.text();
  return text ? JSON.parse(text) : null;
}

function requestWithHost(port, pathname, host) {
  return new Promise((resolve, reject) => {
    const request = http.request({
      hostname: "127.0.0.1",
      port,
      path: pathname,
      method: "GET",
      headers: { host }
    }, response => {
      let body = "";
      response.setEncoding("utf8");
      response.on("data", chunk => {
        body += chunk;
      });
      response.on("end", () => {
        resolve({ statusCode: response.statusCode, body });
      });
    });

    request.on("error", reject);
    request.end();
  });
}

async function api(baseUrl, pathname, options = {}, expectedStatus = 200) {
  const response = await fetch(new URL(pathname, baseUrl), {
    ...options,
    headers: {
      "content-type": "application/json",
      ...(options.headers || {})
    }
  });
  const payload = await readJson(response);
  assert.equal(
    response.status,
    expectedStatus,
    `${options.method || "GET"} ${pathname}: ${JSON.stringify(payload)}`
  );
  return payload;
}

async function waitForRetentionJob(baseUrl, jobId) {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    const payload = await api(
      baseUrl,
      `/api/version-history-backups/retention/progress?id=${encodeURIComponent(jobId)}`
    );
    const status = payload?.progress?.status;
    if (status === "complete" || status === "failed") return payload.progress;
    await new Promise(resolve => setTimeout(resolve, 20));
  }
  throw new Error(`Timed out waiting for retention job ${jobId}`);
}

function htmlAttribute(tag, name) {
  return tag.match(new RegExp(`\\b${name}="([^"]*)"`, "u"))?.[1] || "";
}

function htmlClassNames(tag) {
  return htmlAttribute(tag, "class").split(/\s+/u).filter(Boolean);
}

function visibleText(html) {
  return html.replace(/<[^>]*>/gu, "").replace(/\s+/gu, " ").trim();
}

function parseDetailsNodes(html) {
  const nodes = [];
  const stack = [];
  for (const match of html.matchAll(/<\/?details\b[^>]*>/gu)) {
    if (match[0].startsWith("</")) {
      const node = stack.pop();
      assert.ok(node, "details closing tag should have a matching opening tag");
      node.closingStart = match.index;
      node.closingEnd = match.index + match[0].length;
      continue;
    }
    const parent = stack[stack.length - 1] || null;
    const node = {
      tag: match[0],
      openingStart: match.index,
      openingEnd: match.index + match[0].length,
      closingStart: null,
      closingEnd: null,
      parent,
      children: []
    };
    if (parent) parent.children.push(node);
    nodes.push(node);
    stack.push(node);
  }
  assert.equal(stack.length, 0, "all details elements should be closed");
  return nodes;
}

function detailsSummaryHtml(html, node) {
  const summary = html.slice(node.openingEnd, node.closingStart).trimStart().match(
    /^<summary\b[^>]*>[\s\S]*?<\/summary>/u
  )?.[0];
  assert.ok(summary, `${htmlAttribute(node.tag, "id") || htmlAttribute(node.tag, "class")} should have a summary`);
  return summary;
}

function assertNestedActions(html, node, label) {
  assert.match(node.tag, /\bdata-nested-container\b/u, `${label} should scope its nested actions`);
  const summary = detailsSummaryHtml(html, node);
  const buttons = [...summary.matchAll(/<button\b([^>]*)>([\s\S]*?)<\/button>/gu)]
    .filter(match => htmlAttribute(match[1], "data-nested-action"));
  assert.deepEqual(
    buttons.map(match => ({
      action: htmlAttribute(match[1], "data-nested-action"),
      name: htmlAttribute(match[1], "aria-label") || visibleText(match[2])
    })),
    [
      { action: "expand", name: "Expand all" },
      { action: "collapse", name: "Collapse all" }
    ],
    `${label} should provide scoped Expand all and Collapse all actions`
  );
}

function fixtureState() {
  return StateCore.normalizeState({
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    initialNotes: {
      title: "Project notes",
      content: "Original story",
      contentHtml: "Original story"
    },
    drafts: [
      {
        id: "draft-a",
        title: "Draft A",
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-01T00:00:00.000Z",
        content: "Alpha",
        contentHtml: "Alpha",
        notes: {
          title: "Draft A Notes",
          content: "Alpha notes",
          contentHtml: "Alpha notes"
        }
      },
      {
        id: "draft-b",
        title: "Draft B",
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-01T00:00:00.000Z",
        content: "Beta",
        contentHtml: "Beta",
        notes: {
          title: "Draft B Notes",
          content: "Beta notes",
          contentHtml: "Beta notes"
        }
      }
    ]
  });
}

async function run() {
  let server;
  try {
    const corruptProjectPath = path.join(dataDir, "project.json");
    fs.writeFileSync(corruptProjectPath, "{ broken json", "utf8");

    const started = await startServer({ port: 0, host: "127.0.0.1" });
    server = started.server;
    const baseUrl = started.url;

    const indexResponse = await fetch(baseUrl);
    assert.equal(indexResponse.status, 200);
    const indexHtml = await indexResponse.text();
    assert.match(indexHtml, /state-core\.js/);
    assert.match(indexHtml, /app\.js/);

    const badHostResponse = await requestWithHost(started.port, "/api/state", "example.test");
    assert.equal(badHostResponse.statusCode, 403);

    const recoveredPayload = await api(baseUrl, "/api/state");
    assert.equal(recoveredPayload.projectRecovery.type, "corrupt-project-json");
    assert.equal(recoveredPayload.projectRecovery.statePath, corruptProjectPath);
    assert.match(recoveredPayload.projectRecovery.backupPath, /project\.json\.broken-\d+$/);
    assert.equal(fs.readFileSync(recoveredPayload.projectRecovery.backupPath, "utf8"), "{ broken json");

    await api(baseUrl, "/api/project-recovery/ack", { method: "POST" });
    const acknowledgedPayload = await api(baseUrl, "/api/state");
    assert.equal(acknowledgedPayload.projectRecovery, null);

    await api(baseUrl, "/api/state", {
      method: "PUT",
      body: JSON.stringify({ state: fixtureState(), fileName: "server-page-unit-test.txt" })
    });

    const pageResult = await api(baseUrl, "/api/page", {
      method: "PATCH",
      body: JSON.stringify({
        key: "draft:draft-a:content",
        page: {
          title: "Draft A renamed",
          content: "Alpha revised",
          contentHtml: "<p>Alpha revised</p>",
          format: { fontSize: "20" },
          versionHistory: [
            {
              id: "history-original",
              createdAt: "2026-01-01T00:00:00.000Z",
              title: "Draft A",
              content: "Alpha",
              contentHtml: "Alpha",
              format: { fontSize: "16" }
            },
            {
              id: "history-restored",
              createdAt: "2026-01-01T00:00:01.000Z",
              title: "Draft A renamed",
              content: "Alpha revised",
              contentHtml: "<p>Alpha revised</p>",
              format: { fontSize: "20" }
            }
          ]
        }
      })
    });

    assert.equal(pageResult.page.title, "Draft A renamed");
    assert.equal(pageResult.page.content, "Alpha revised");
    assert.equal(pageResult.page.format.fontSize, "20");

    const afterPage = (await api(baseUrl, "/api/state")).state;
    assert.equal(afterPage.drafts[0].title, "Draft A renamed");
    assert.equal(afterPage.drafts[0].notes.title, "Draft A renamed Notes");
    assert.equal(afterPage.drafts[0].notes.content, "Alpha notes");
    assert.equal(afterPage.drafts[1].content, "Beta");
    assert.equal(afterPage.drafts[0].versionHistory.some(version => version.content === "Alpha"), true);
    assert.equal(afterPage.drafts[0].versionHistory.some(version => version.id === "history-restored"), true);
    assert.equal(afterPage.drafts[0].versionHistory.some(version => version.content === "Alpha revised"), true);

    const unitResult = await api(baseUrl, "/api/unit", {
      method: "PATCH",
      body: JSON.stringify({
        key: "draft:draft-a",
        pages: [
          {
            key: "draft:draft-a:content",
            page: {
              content: "Alpha from unit",
              contentHtml: "Alpha from unit"
            }
          },
          {
            key: "draft:draft-a:notes",
            page: {
              content: "Alpha notes from unit",
              contentHtml: "Alpha notes from unit"
            }
          },
          {
            key: "draft:draft-b:content",
            page: {
              content: "Should not apply",
              contentHtml: "Should not apply"
            }
          }
        ]
      })
    });

    assert.equal(unitResult.unit.pages.length, 2);

    const afterUnit = (await api(baseUrl, "/api/state")).state;
    assert.equal(afterUnit.drafts[0].content, "Alpha from unit");
    assert.equal(afterUnit.drafts[0].notes.content, "Alpha notes from unit");
    assert.equal(afterUnit.drafts[1].content, "Beta");

    const titleOnlyResult = await api(baseUrl, "/api/page", {
      method: "PATCH",
      body: JSON.stringify({
        key: "draft:draft-a:content",
        page: {
          title: "Draft A title only"
        }
      })
    });
    assert.equal(titleOnlyResult.page.title, "Draft A title only");

    const afterTitleOnly = (await api(baseUrl, "/api/state")).state;
    assert.equal(afterTitleOnly.drafts[0].title, "Draft A title only");
    assert.equal(afterTitleOnly.drafts[0].content, "Alpha from unit");
    assert.equal(afterTitleOnly.drafts[0].notes.title, "Draft A title only Notes");
    assert.equal(afterTitleOnly.drafts[0].notes.content, "Alpha notes from unit");
    assert.equal(afterTitleOnly.drafts[1].content, "Beta");

    const storyHistoryResult = await api(baseUrl, "/api/page", {
      method: "PATCH",
      body: JSON.stringify({
        key: StateCore.STORY_KEY,
        page: {
          content: "Project notes revised",
          contentHtml: "<p>Project notes revised</p>",
          versionHistory: [
            {
              id: "story-history-original",
              createdAt: "2026-01-01T00:00:00.000Z",
              title: "Project notes",
              content: "Original story",
              contentHtml: "Original story"
            },
            {
              id: "story-history-revised",
              createdAt: "2026-01-01T00:00:01.000Z",
              title: "Project notes",
              content: "Project notes revised",
              contentHtml: "<p>Project notes revised</p>"
            }
          ]
        }
      })
    });
    assert.equal(storyHistoryResult.page.content, "Project notes revised");

    const afterStoryHistory = (await api(baseUrl, "/api/state")).state;
    assert.equal(afterStoryHistory.initialNotes.content, "Project notes revised");
    assert.equal(afterStoryHistory.initialNotes.versionHistory.some(version => version.content === "Original story"), true);
    assert.equal(afterStoryHistory.initialNotes.versionHistory.some(version => version.content === "Project notes revised"), true);

    const notesHistoryResult = await api(baseUrl, "/api/page", {
      method: "PATCH",
      body: JSON.stringify({
        key: "draft:draft-a:notes",
        page: {
          content: "Alpha notes revised",
          contentHtml: "<p>Alpha notes revised</p>",
          versionHistory: [
            {
              id: "notes-history-original",
              createdAt: "2026-01-01T00:00:00.000Z",
              title: "Draft A title only Notes",
              content: "Alpha notes from unit",
              contentHtml: "Alpha notes from unit"
            },
            {
              id: "notes-history-revised",
              createdAt: "2026-01-01T00:00:01.000Z",
              title: "Draft A title only Notes",
              content: "Alpha notes revised",
              contentHtml: "<p>Alpha notes revised</p>"
            }
          ]
        }
      })
    });
    assert.equal(notesHistoryResult.page.content, "Alpha notes revised");

    const afterNotesHistory = (await api(baseUrl, "/api/state")).state;
    assert.equal(afterNotesHistory.drafts[0].notes.content, "Alpha notes revised");
    assert.equal(afterNotesHistory.drafts[0].notes.versionHistory.some(version => version.content === "Alpha notes from unit"), true);
    assert.equal(afterNotesHistory.drafts[0].notes.versionHistory.some(version => version.content === "Alpha notes revised"), true);

    const viewResult = await api(baseUrl, "/api/view-state", {
      method: "POST",
      body: JSON.stringify({
        viewState: {
          displayedStory: false,
          displayedDraftIds: ["draft-a"],
          selectedDraftId: "draft-a",
          activeArea: "draft",
          activeDraftId: "draft-a",
          activePageType: "notes",
          pagesOnScreen: 3
        }
      })
    });
    assert.equal(viewResult.viewState.activeEditorKey, "draft:draft-a:notes");
    assert.deepEqual(viewResult.viewState.displayedDraftIds, ["draft-a"]);
    assert.equal(viewResult.viewState.pagesOnScreen, 3);

    const afterView = (await api(baseUrl, "/api/state")).state;
    assert.equal(afterView.drafts[0].content, "Alpha from unit");
    assert.equal(afterView.drafts[0].notes.content, "Alpha notes revised");
    assert.equal(afterView.drafts[1].content, "Beta");
    assert.equal(afterView.viewState.activeEditorKey, "draft:draft-a:notes");

    const newerViewStateResult = await api(baseUrl, "/api/view-state", {
      method: "POST",
      body: JSON.stringify({
        viewState: {
          updatedAt: "2099-02-01T00:00:00.000Z",
          displayedStory: false,
          displayedDraftIds: ["draft-b"],
          selectedDraftId: "draft-b",
          activeArea: "draft",
          activeDraftId: "draft-b",
          activePageType: "content",
          pagesOnScreen: 1,
          pagePanePercents: {
            "draft:draft-b:content": 72
          }
        }
      })
    });
    assert.equal(newerViewStateResult.viewState.selectedDraftId, "draft-b");
    assert.equal(newerViewStateResult.viewState.pagePanePercents["draft:draft-b:content"], 72);

    const staleFullSaveState = {
      ...(await api(baseUrl, "/api/state")).state,
      viewState: {
        updatedAt: "2026-01-01T00:00:00.000Z",
        displayedStory: false,
        displayedDraftIds: ["draft-a"],
        selectedDraftId: "draft-a",
        activeArea: "draft",
        activeDraftId: "draft-a",
        activePageType: "notes",
        pagesOnScreen: 3,
        pagePanePercents: {
          "draft:draft-a:content": 44
        }
      }
    };
    const staleSaveResult = await api(baseUrl, "/api/state", {
      method: "PUT",
      body: JSON.stringify({ state: staleFullSaveState, fileName: "server-page-unit-test.txt" })
    });
    assert.equal(staleSaveResult.state.viewState.selectedDraftId, "draft-b");
    assert.equal(staleSaveResult.state.viewState.pagePanePercents["draft:draft-b:content"], 72);

    const freshFullSaveState = {
      ...staleSaveResult.state,
      viewState: {
        updatedAt: "2100-03-01T00:00:00.000Z",
        displayedStory: false,
        displayedDraftIds: ["draft-a"],
        selectedDraftId: "draft-a",
        activeArea: "draft",
        activeDraftId: "draft-a",
        activePageType: "content",
        pagesOnScreen: 2,
        pagePanePercents: {
          "draft:draft-a:content": 61
        }
      }
    };
    const freshSaveResult = await api(baseUrl, "/api/state", {
      method: "PUT",
      body: JSON.stringify({ state: freshFullSaveState, fileName: "server-page-unit-test.txt" })
    });
    assert.equal(freshSaveResult.state.viewState.selectedDraftId, "draft-a");
    assert.equal(freshSaveResult.state.viewState.pagePanePercents["draft:draft-a:content"], 61);

    const exportResponse = await fetch(new URL("/api/export", baseUrl));
    assert.equal(exportResponse.status, 200);
    assert.match(await exportResponse.text(), /Alpha from unit/);

    const summaryFolder = path.join(dataDir, "version-history-folder");
    fs.mkdirSync(summaryFolder, { recursive: true });
    __test.writeVersionHistoryFolderPath(summaryFolder);
    const readyFolder = path.join(
      summaryFolder,
      "version history JSON archive",
      "Ready for manual deletion"
    );
    const queuedRunFolder = path.join(
      readyFolder,
      "retention-2026-07-31T12-00-00-000Z-test-ready-run"
    );
    fs.mkdirSync(queuedRunFolder, { recursive: true });
    fs.writeFileSync(
      path.join(queuedRunFolder, "queued.version-history.json"),
      "{\"queued\":true}\n",
      "utf8"
    );
    const stateWithReadyArchive = await api(baseUrl, "/api/state");
    assert.equal(stateWithReadyArchive.readyForManualDeletion.ready, true);
    assert.equal(stateWithReadyArchive.readyForManualDeletion.itemCount, 1);
    assert.equal(stateWithReadyArchive.readyForManualDeletion.runCount, 1);
    assert.equal(
      stateWithReadyArchive.readyForManualDeletion.folderPath,
      readyFolder
    );

    let openedReadyFolder = "";
    await __test.openVersionHistoryArchiveReadyFolder({
      openFileLocation: async folderPath => {
        openedReadyFolder = folderPath;
        return { filePath: folderPath, directoryPath: folderPath };
      }
    });
    assert.equal(path.resolve(openedReadyFolder), path.resolve(readyFolder));
    await api(
      baseUrl,
      "/api/version-history-backups/archive-expiry/delete",
      { method: "POST", body: "{}" },
      404
    );
    await api(
      baseUrl,
      "/api/version-history-backups/archive-expiry/move-to-manual-deletion",
      { method: "POST", body: "{}" },
      404
    );
    const expiryPreviewStart = await api(
      baseUrl,
      "/api/version-history-backups/archive-expiry/start",
      { method: "POST" }
    );
    const expiryPreviewProgress = await waitForRetentionJob(
      baseUrl,
      expiryPreviewStart.jobId
    );
    assert.equal(expiryPreviewProgress.status, "complete");
    assert.equal(expiryPreviewProgress.result.movableRunCount, 0);
    const expiryMoveStart = await api(
      baseUrl,
      "/api/version-history-backups/archive-expiry/move-to-manual-deletion",
      {
        method: "POST",
        body: JSON.stringify({ planId: expiryPreviewStart.planId })
      }
    );
    const expiryMoveProgress = await waitForRetentionJob(
      baseUrl,
      expiryMoveStart.jobId
    );
    assert.equal(expiryMoveProgress.status, "complete");
    assert.equal(expiryMoveProgress.operation, "archive-expiry-move");
    assert.equal(expiryMoveProgress.result.status, "no-op");
    assert.equal(expiryMoveProgress.result.movedRunCount, 0);

    const unchangedVersionState = StateCore.normalizeState({
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:04.000Z",
      initialNotes: {
        title: "Project notes",
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-01T00:00:04.000Z",
        content: "Story changed",
        contentHtml: "Story changed",
        format: { fontSize: "22" },
        versionHistory: [
          {
            id: "story-v1",
            createdAt: "2026-01-01T00:00:00.000Z",
            title: "Project notes",
            content: "Opening",
            contentHtml: "Opening"
          },
          {
            id: "story-v2-format-only",
            createdAt: "2026-01-01T00:00:01.000Z",
            title: "Project notes",
            content: "Opening",
            contentHtml: "<strong>Opening</strong>",
            format: { fontSize: "20" }
          },
          {
            id: "story-v3",
            createdAt: "2026-01-01T00:00:02.000Z",
            title: "Project notes",
            content: "Story changed",
            contentHtml: "Story changed"
          },
          {
            id: "story-v4-format-only",
            createdAt: "2026-01-01T00:00:03.000Z",
            title: "Project notes",
            content: "Story changed",
            contentHtml: "<em>Story changed</em>",
            format: { fontSize: "22" }
          }
        ]
      },
      drafts: []
    });
    const unchangedSummaryResult = await writeFullVersionHistorySummaryReport(unchangedVersionState, {
      fileName: "skip-unchanged-summary.txt",
      filePath: path.join(dataDir, "skip-unchanged-summary.txt")
    });
    const unchangedSummaryHtml = fs.readFileSync(unchangedSummaryResult.reportPath, "utf8");
    assert.doesNotMatch(unchangedSummaryHtml, /No text changes from the previous version/u);
    assert.match(unchangedSummaryHtml, /Version 2 \/ current/u);
    assert.doesNotMatch(unchangedSummaryHtml, /Version 3/u);
    assert.match(unchangedSummaryHtml, /2 unchanged versions skipped/u);
    const unchangedHistoryPage = parseDetailsNodes(unchangedSummaryHtml)
      .find(node => htmlAttribute(node.tag, "id") === "project-notes");
    assert.ok(unchangedHistoryPage, "unchanged-version report should contain Project notes");
    assert.deepEqual(
      [...detailsSummaryHtml(unchangedSummaryHtml, unchangedHistoryPage)
        .matchAll(/<time\b[^>]*\bdatetime="([^"]+)"/gu)]
        .map(match => match[1]),
      [
        "2026-01-01T00:00:00.000Z",
        "2026-01-01T00:00:00.000Z",
        "2026-01-01T00:00:03.000Z"
      ],
      "page date range should use the actual first and last versions, including unchanged versions"
    );

    const firstPeriodStart = "2026-01-01T00:00:00.000Z";
    const firstPeriodEnd = "2026-01-01T12:00:00.000Z";
    const secondPeriodStart = "2026-01-01T12:00:01.000Z";
    const secondPeriodEnd = "2026-01-01T23:00:00.000Z";
    const groupedVersionState = StateCore.normalizeState({
      createdAt: firstPeriodStart,
      updatedAt: secondPeriodEnd,
      initialNotes: {
        title: "Project notes",
        createdAt: firstPeriodStart,
        updatedAt: secondPeriodEnd,
        content: "Fourth grouped version",
        contentHtml: "Fourth grouped version",
        versionHistory: [
          {
            id: "grouped-version-1",
            createdAt: firstPeriodStart,
            title: "Project notes",
            content: "First grouped version",
            contentHtml: "First grouped version"
          },
          {
            id: "grouped-version-2",
            createdAt: firstPeriodEnd,
            title: "Project notes",
            content: "Second grouped version",
            contentHtml: "Second grouped version"
          },
          {
            id: "grouped-version-3",
            createdAt: secondPeriodStart,
            title: "Project notes",
            content: "Third grouped version",
            contentHtml: "Third grouped version"
          },
          {
            id: "grouped-version-4",
            createdAt: secondPeriodEnd,
            title: "Project notes",
            content: "Fourth grouped version",
            contentHtml: "Fourth grouped version"
          }
        ]
      },
      drafts: []
    });
    const groupedSummaryResult = await writeFullVersionHistorySummaryReport(groupedVersionState, {
      fileName: "grouped-summary.txt",
      filePath: path.join(dataDir, "grouped-summary.txt")
    });
    const groupedSummaryHtml = fs.readFileSync(groupedSummaryResult.reportPath, "utf8");
    const detailsClassNames = tag => (tag.match(/\bclass="([^"]*)"/u)?.[1] || "").split(/\s+/u).filter(Boolean);
    const detailsNodes = parseDetailsNodes(groupedSummaryHtml);
    const detailsNodesWithClass = className => detailsNodes.filter(node => detailsClassNames(node.tag).includes(className));
    const periodRanges = nodes => nodes.map(node => ({
      start: node.tag.match(/\bdata-version-period-start="([^"]+)"/u)?.[1],
      end: node.tag.match(/\bdata-version-period-end="([^"]+)"/u)?.[1]
    }));
    const expectedPeriodRanges = [
      { start: firstPeriodStart, end: firstPeriodEnd },
      { start: secondPeriodStart, end: secondPeriodEnd }
    ];
    const contentsPeriodNodes = detailsNodesWithClass("contents-version-period");
    const bodyPeriodNodes = detailsNodesWithClass("version-period");
    const versionEntryNodes = detailsNodesWithClass("version-entry");
    assert.equal(contentsPeriodNodes.length, 2);
    assert.equal(bodyPeriodNodes.length, 2);
    assert.equal(versionEntryNodes.length, 4);
    assert.deepEqual(periodRanges(contentsPeriodNodes), expectedPeriodRanges);
    assert.deepEqual(periodRanges(bodyPeriodNodes), expectedPeriodRanges);
    assert.equal(contentsPeriodNodes.every(node => /\bdata-collapsible\b/u.test(node.tag)), true);
    assert.equal(bodyPeriodNodes.every(node => /\bdata-collapsible\b/u.test(node.tag)), true);
    assert.equal(versionEntryNodes.every(node => /\bdata-collapsible\b/u.test(node.tag)), true);
    assert.deepEqual(
      versionEntryNodes.map(node => node.tag.match(/\bid="([^"]+)"/u)?.[1]),
      [
        "project-notes-version-1",
        "project-notes-version-2",
        "project-notes-version-3",
        "project-notes-version-4"
      ]
    );
    assert.equal(
      versionEntryNodes.every(node => /^<summary\b/u.test(groupedSummaryHtml.slice(node.openingEnd).trimStart())),
      true
    );
    assert.equal(
      versionEntryNodes.every(node => !/\bopen(?:\s|>)/u.test(node.tag)),
      true,
      "opening a period should reveal individually closed version dropdowns"
    );
    assert.deepEqual(
      bodyPeriodNodes.map(period => period.children
        .filter(node => detailsClassNames(node.tag).includes("version-entry"))
        .map(node => node.tag.match(/\bid="([^"]+)"/u)?.[1])),
      [
        ["project-notes-version-1", "project-notes-version-2"],
        ["project-notes-version-3", "project-notes-version-4"]
      ]
    );

    const firstContentsPeriodStart = groupedSummaryHtml.indexOf(contentsPeriodNodes[0].tag);
    const secondContentsPeriodStart = groupedSummaryHtml.indexOf(contentsPeriodNodes[1].tag, firstContentsPeriodStart + 1);
    const firstBodyPeriodStart = groupedSummaryHtml.indexOf(bodyPeriodNodes[0].tag, secondContentsPeriodStart + 1);
    const secondBodyPeriodStart = groupedSummaryHtml.indexOf(bodyPeriodNodes[1].tag, firstBodyPeriodStart + 1);
    const firstContentsPeriodHtml = groupedSummaryHtml.slice(firstContentsPeriodStart, secondContentsPeriodStart);
    const secondContentsPeriodHtml = groupedSummaryHtml.slice(secondContentsPeriodStart, firstBodyPeriodStart);
    const firstBodyPeriodHtml = groupedSummaryHtml.slice(firstBodyPeriodStart, secondBodyPeriodStart);
    const secondBodyPeriodHtml = groupedSummaryHtml.slice(secondBodyPeriodStart);
    assert.match(firstContentsPeriodHtml, /href="#project-notes-version-1"/u);
    assert.match(firstContentsPeriodHtml, /href="#project-notes-version-2"/u);
    assert.doesNotMatch(firstContentsPeriodHtml, /href="#project-notes-version-3"/u);
    assert.match(secondContentsPeriodHtml, /href="#project-notes-version-3"/u);
    assert.match(secondContentsPeriodHtml, /href="#project-notes-version-4"/u);
    assert.match(firstBodyPeriodHtml, /class="version-period-title">Versions 1 - 2<\/span>/u);
    assert.match(secondBodyPeriodHtml, /class="version-period-title">Versions 3 - 4<\/span>/u);
    assert.match(firstBodyPeriodHtml, /class="version-period-dates">[^<]+ to [^<]+<\/span>/u);
    assert.match(secondBodyPeriodHtml, /class="version-period-dates">[^<]+ to [^<]+<\/span>/u);
    assert.match(
      visibleText(detailsSummaryHtml(groupedSummaryHtml, contentsPeriodNodes[0])),
      /^Versions 1 - 2\b.*\bto\b/u
    );
    assert.match(
      visibleText(detailsSummaryHtml(groupedSummaryHtml, contentsPeriodNodes[1])),
      /^Versions 3 - 4\b.*\bto\b/u
    );
    assert.match(
      visibleText(detailsSummaryHtml(groupedSummaryHtml, bodyPeriodNodes[0])),
      /^Versions 1 - 2\b.*\bto\b/u
    );
    assert.match(
      visibleText(detailsSummaryHtml(groupedSummaryHtml, bodyPeriodNodes[1])),
      /^Versions 3 - 4\b.*\bto\b/u
    );

    const groupedHistoryPage = detailsNodesWithClass("history-page-section")[0];
    assert.ok(groupedHistoryPage, "grouped history should have a page dropdown");
    assertNestedActions(groupedSummaryHtml, groupedHistoryPage, "history page with multiple periods");
    const contentsGroups = detailsNodesWithClass("contents-group");
    const contentsVersionHistory = contentsGroups.find(node => (
      /^Version history\b/u.test(visibleText(detailsSummaryHtml(groupedSummaryHtml, node)))
    ));
    const contentsProjectNotes = contentsGroups.find(node => (
      /^Project notes\b/u.test(visibleText(detailsSummaryHtml(groupedSummaryHtml, node)))
    ));
    assert.ok(contentsVersionHistory, "Contents should contain a Version history dropdown");
    assert.ok(contentsProjectNotes, "Contents should contain a Project notes dropdown");
    assertNestedActions(groupedSummaryHtml, contentsVersionHistory, "Contents Version history");
    assertNestedActions(groupedSummaryHtml, contentsProjectNotes, "Contents page with multiple periods");
    bodyPeriodNodes.forEach((period, index) => {
      assertNestedActions(groupedSummaryHtml, period, `version period ${index + 1} with multiple versions`);
    });

    const summaryResult = await writeFullVersionHistorySummaryReport(afterNotesHistory, {
      fileName: "server-page-unit-test.txt",
      filePath: path.join(dataDir, "server-page-unit-test.txt")
    });
    const summaryHtml = fs.readFileSync(summaryResult.reportPath, "utf8");

    const viewportMeta = [...summaryHtml.matchAll(/<meta\b[^>]*>/gu)]
      .map(match => match[0])
      .find(tag => htmlAttribute(tag, "name") === "viewport");
    assert.ok(viewportMeta, "summary should declare a responsive viewport");
    assert.equal(htmlAttribute(viewportMeta, "content"), "width=device-width, initial-scale=1");

    const reportHeader = [...summaryHtml.matchAll(/<header\b[^>]*>[\s\S]*?<\/header>/gu)]
      .map(match => match[0])
      .find(header => htmlClassNames(header).includes("report-header"));
    assert.ok(reportHeader, "summary should have a report header");
    assert.equal((summaryHtml.match(/<h1\b[^>]*>/gu) || []).length, 1, "summary should have one h1");
    assert.equal((reportHeader.match(/<h1\b[^>]*>/gu) || []).length, 1, "the h1 should be in the report header");

    const summaryGrid = [...summaryHtml.matchAll(/<dl\b[^>]*>[\s\S]*?<\/dl>/gu)]
      .map(match => match[0])
      .find(list => htmlClassNames(list).includes("summary-grid"));
    assert.ok(summaryGrid, "report statistics should use a summary definition list");
    assert.equal((summaryGrid.match(/<dt\b[^>]*>[\s\S]*?<\/dt>/gu) || []).length, 4);
    assert.equal((summaryGrid.match(/<dd\b[^>]*>[\s\S]*?<\/dd>/gu) || []).length, 4);
    assert.equal(
      (summaryGrid.match(/<dt\b[^>]*>[\s\S]*?<\/dt>\s*<dd\b[^>]*>[\s\S]*?<\/dd>/gu) || []).length,
      4,
      "summary definition terms and values should remain paired"
    );

    const contentsNav = [...summaryHtml.matchAll(/<nav\b[^>]*>[\s\S]*?<\/nav>/gu)]
      .map(match => match[0])
      .find(nav => htmlAttribute(nav, "aria-label") === "Contents");
    assert.ok(contentsNav, "summary contents should be a labelled navigation region");
    assert.match(contentsNav, /<h2\b[^>]*>\s*Contents\s*<\/h2>/u);

    const summaryControls = contentsNav.match(
      /<div\b(?=[^>]*\brole="group")(?=[^>]*\baria-label="Summary controls")[^>]*>([\s\S]*?)<\/div>/u
    );
    assert.ok(summaryControls, "summary actions should be an accessible control group");
    const actionButtons = [...summaryControls[1].matchAll(/<button\b([^>]*)>([\s\S]*?)<\/button>/gu)];
    assert.equal(actionButtons.length, 2);
    [
      { action: "expand", name: "Expand all" },
      { action: "collapse", name: "Collapse all" }
    ].forEach(expected => {
      const button = actionButtons.find(match => htmlAttribute(match[1], "data-summary-action") === expected.action);
      assert.ok(button, `summary should retain its ${expected.action} action`);
      assert.equal(htmlAttribute(button[1], "type"), "button");
      assert.equal(htmlAttribute(button[1], "aria-label") || visibleText(button[2]), expected.name);
    });

    assert.doesNotMatch(summaryHtml, /First saved version; no previous version to compare/u);
    assert.match(summaryHtml, /First saved version/u);
    assert.match(summaryHtml, /Baseline text; no changes to compare/u);
    assert.match(summaryHtml, /Original story/u);
    assert.match(summaryHtml, /Draft A title only Notes/u);
    assert.equal(
      summaryHtml.indexOf("Draft A title only Notes") > summaryHtml.indexOf("Draft A title only"),
      true
    );
    assert.match(summaryHtml, /Alpha notes<span class="compare-token added"> from unit<\/span>/u);
    assert.doesNotMatch(summaryHtml, /<ol[>\s]/u);
    assert.match(summaryHtml, /<ul class="contents-list">/u);
    assert.match(summaryHtml, /data-summary-action="expand"/u);
    assert.match(summaryHtml, /data-summary-action="collapse"/u);
    assert.match(summaryHtml, /href="#draft-change-1-2"[^>]*>Draft 1 to Draft 2/u);
    assert.match(summaryHtml, /href="#draft-change-1-baseline"[^>]*>[^<]+ baseline/u);
    assert.match(summaryHtml, /First draft baseline; no earlier draft to compare\./u);
    assert.match(
      summaryHtml,
      /<details\b(?=[^>]*\bid="draft-changes")(?=[^>]*\bclass="report-section")(?=[^>]*\bdata-collapsible)(?=[^>]*\bdata-nested-container)[^>]*>/u
    );
    assert.match(
      summaryHtml,
      /<details\b(?=[^>]*\bid="draft-1-draft-a-title-only")(?=[^>]*\bclass="history-page-section")(?=[^>]*\bdata-collapsible)(?=[^>]*\bdata-nested-container)[^>]*>/u
    );

    const summaryDetailsNodes = parseDetailsNodes(summaryHtml);
    const draftChangesNode = summaryDetailsNodes.find(node => htmlAttribute(node.tag, "id") === "draft-changes");
    assert.ok(draftChangesNode, "Draft changes should be a dropdown");
    const draftChangeNodes = draftChangesNode.children.filter(node => htmlClassNames(node.tag).includes("draft-change"));
    assert.deepEqual(
      draftChangeNodes.map(node => htmlAttribute(node.tag, "id")),
      ["draft-change-1-baseline", "draft-change-1-2"],
      "Draft changes should reveal one selectable dropdown per comparison"
    );
    assert.equal(
      draftChangeNodes.every(node => /\bdata-collapsible\b/u.test(node.tag) && !/\bopen(?:\s|>)/u.test(node.tag)),
      true
    );
    assertNestedActions(summaryHtml, draftChangesNode, "Draft changes with multiple comparisons");

    const pageMetadataExpectations = [
      {
        id: "draft-1-draft-a-title-only",
        createdAt: afterNotesHistory.drafts[0].createdAt
      },
      {
        id: "draft-1-draft-a-title-only-notes",
        createdAt: afterNotesHistory.drafts[0].notes.createdAt
      }
    ];
    pageMetadataExpectations.forEach(expected => {
      const pageNode = summaryDetailsNodes.find(node => htmlAttribute(node.tag, "id") === expected.id);
      assert.ok(pageNode, `${expected.id} should have a version-history panel`);
      const pageSummary = detailsSummaryHtml(summaryHtml, pageNode);
      const pageSummaryText = visibleText(pageSummary);
      const summaryDates = [...pageSummary.matchAll(/<time\b[^>]*\bdatetime="([^"]+)"[^>]*>/gu)]
        .map(match => match[1]);
      const versionDates = summaryDetailsNodes
        .filter(node => htmlClassNames(node.tag).includes("version-entry"))
        .filter(node => {
          for (let parent = node.parent; parent; parent = parent.parent) {
            if (parent === pageNode) return true;
          }
          return false;
        })
        .map(node => detailsSummaryHtml(summaryHtml, node).match(/<time\b[^>]*\bdatetime="([^"]+)"/u)?.[1])
        .filter(Boolean);
      assert.ok(versionDates.length, `${expected.id} should contain dated versions`);
      assert.match(pageSummaryText, /\bCreated\b/u);
      assert.match(pageSummaryText, /\bVersion dates\b[\s\S]*\bto\b/u);
      assert.deepEqual(
        summaryDates.slice(0, 3),
        [expected.createdAt, versionDates[0], versionDates[versionDates.length - 1]],
        `${expected.id} should show its creation date and first-to-last version dates`
      );
    });
    assert.match(
      summaryHtml,
      /\.closest\((?:"|')\[data-nested-container\](?:"|')\)/u,
      "nested actions should resolve their nearest parent dropdown"
    );

    const cleanupHistoryRoot = path.join(dataDir, "cleanup-history");
    const cleanupLinkedPath = path.join(dataDir, "cleanup-source.txt");
    const cleanupHistoryPath = path.join(
      cleanupHistoryRoot,
      "jsons",
      "cleanup-source.version-history.json"
    );
    fs.mkdirSync(path.dirname(cleanupHistoryPath), { recursive: true });
    fs.writeFileSync(cleanupLinkedPath, "Alpha", "utf8");
    __test.writeVersionHistoryFolderPath(cleanupHistoryRoot);
    __test.writeTextFileLink(cleanupLinkedPath);
    fs.writeFileSync(
      path.join(dataDir, "project.json"),
      `${JSON.stringify(StateCore.stateForStorage(fixtureState()), null, 2)}\n`,
      "utf8"
    );
    fs.writeFileSync(
      cleanupHistoryPath,
      `${JSON.stringify({
        version: 1,
        sourceFileName: "cleanup-source.txt",
        sourceFilePath: cleanupLinkedPath,
        story: { title: "Project notes", history: [] },
        drafts: [{
          id: "draft-a",
          index: 0,
          title: "Draft A",
          history: [
            {
              id: "cleanup-1",
              createdAt: "2026-01-01T00:00:00.000Z",
              title: "Draft A",
              content: "Alpha",
              contentHtml: "Alpha"
            },
            {
              id: "cleanup-2",
              createdAt: "2026-01-01T00:00:02.500Z",
              title: "Draft A",
              content: "Alpha",
              contentHtml: "Alpha"
            }
          ]
        }]
      }, null, 2)}\n`,
      "utf8"
    );

    await api(baseUrl, "/api/page", {
      method: "PATCH",
      body: JSON.stringify({
        key: "draft:draft-a:content",
        page: { content: "Alpha", contentHtml: "Alpha" }
      })
    });
    const cleanedHistory = JSON.parse(fs.readFileSync(cleanupHistoryPath, "utf8"));
    assert.equal(
      cleanedHistory.drafts[0].history.filter(version => version.content === "Alpha").length,
      1,
      "saving a project with an existing sidecar should persist duplicate cleanup"
    );

    await api(baseUrl, "/api/page", {
      method: "PATCH",
      body: JSON.stringify({
        key: "draft:missing:content",
        page: { content: "Missing", contentHtml: "Missing" }
      })
    }, 404);
  } finally {
    await stopServer(server, { flush: false });
    fs.rmSync(dataDir, { recursive: true, force: true });
  }
}

run()
  .then(() => console.log("server page/unit tests passed"))
  .catch(error => {
    console.error(error);
    process.exitCode = 1;
  });
