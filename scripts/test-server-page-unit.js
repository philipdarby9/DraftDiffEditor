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
    __test.writeVersionHistoryFolderPath(summaryFolder);

    const unchangedVersionState = StateCore.normalizeState({
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:03.000Z",
      initialNotes: {
        title: "Project notes",
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-01T00:00:03.000Z",
        content: "Story changed",
        contentHtml: "Story changed",
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
    assert.match(unchangedSummaryHtml, /1 unchanged version skipped/u);

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
    const periodOpeningTags = className => [...groupedSummaryHtml.matchAll(/<details\b[^>]*>/gu)]
      .map(match => match[0])
      .filter(tag => (tag.match(/\bclass="([^"]*)"/u)?.[1] || "").split(/\s+/u).includes(className));
    const periodRanges = tags => tags.map(tag => ({
      start: tag.match(/\bdata-version-period-start="([^"]+)"/u)?.[1],
      end: tag.match(/\bdata-version-period-end="([^"]+)"/u)?.[1]
    }));
    const expectedPeriodRanges = [
      { start: firstPeriodStart, end: firstPeriodEnd },
      { start: secondPeriodStart, end: secondPeriodEnd }
    ];
    const contentsPeriodTags = periodOpeningTags("contents-version-period");
    const bodyPeriodTags = periodOpeningTags("version-period");
    assert.equal(contentsPeriodTags.length, 2);
    assert.equal(bodyPeriodTags.length, 2);
    assert.deepEqual(periodRanges(contentsPeriodTags), expectedPeriodRanges);
    assert.deepEqual(periodRanges(bodyPeriodTags), expectedPeriodRanges);
    assert.equal(contentsPeriodTags.every(tag => /\bdata-collapsible\b/u.test(tag)), true);
    assert.equal(bodyPeriodTags.every(tag => /\bdata-collapsible\b/u.test(tag)), true);

    const firstContentsPeriodStart = groupedSummaryHtml.indexOf(contentsPeriodTags[0]);
    const secondContentsPeriodStart = groupedSummaryHtml.indexOf(contentsPeriodTags[1], firstContentsPeriodStart + 1);
    const firstBodyPeriodStart = groupedSummaryHtml.indexOf(bodyPeriodTags[0], secondContentsPeriodStart + 1);
    const secondBodyPeriodStart = groupedSummaryHtml.indexOf(bodyPeriodTags[1], firstBodyPeriodStart + 1);
    const firstContentsPeriodHtml = groupedSummaryHtml.slice(firstContentsPeriodStart, secondContentsPeriodStart);
    const secondContentsPeriodHtml = groupedSummaryHtml.slice(secondContentsPeriodStart, firstBodyPeriodStart);
    const firstBodyPeriodHtml = groupedSummaryHtml.slice(firstBodyPeriodStart, secondBodyPeriodStart);
    const secondBodyPeriodHtml = groupedSummaryHtml.slice(secondBodyPeriodStart);
    assert.match(firstContentsPeriodHtml, /href="#project-notes-version-1"/u);
    assert.match(firstContentsPeriodHtml, /href="#project-notes-version-2"/u);
    assert.doesNotMatch(firstContentsPeriodHtml, /href="#project-notes-version-3"/u);
    assert.match(secondContentsPeriodHtml, /href="#project-notes-version-3"/u);
    assert.match(secondContentsPeriodHtml, /href="#project-notes-version-4"/u);
    assert.match(firstBodyPeriodHtml, /<article id="project-notes-version-1" class="version-entry">/u);
    assert.match(firstBodyPeriodHtml, /<article id="project-notes-version-2" class="version-entry">/u);
    assert.doesNotMatch(firstBodyPeriodHtml, /<article id="project-notes-version-3" class="version-entry">/u);
    assert.match(secondBodyPeriodHtml, /<article id="project-notes-version-3" class="version-entry">/u);
    assert.match(secondBodyPeriodHtml, /<article id="project-notes-version-4" class="version-entry">/u);
    assert.match(firstBodyPeriodHtml, /class="version-period-title">[^<]+ to [^<]+<\/span>/u);
    assert.match(secondBodyPeriodHtml, /class="version-period-title">[^<]+ to [^<]+<\/span>/u);

    const summaryResult = await writeFullVersionHistorySummaryReport(afterNotesHistory, {
      fileName: "server-page-unit-test.txt",
      filePath: path.join(dataDir, "server-page-unit-test.txt")
    });
    const summaryHtml = fs.readFileSync(summaryResult.reportPath, "utf8");
    const htmlAttribute = (tag, name) => tag.match(new RegExp(`\\b${name}="([^"]*)"`, "u"))?.[1] || "";
    const htmlClassNames = tag => htmlAttribute(tag, "class").split(/\s+/u).filter(Boolean);
    const visibleText = html => html.replace(/<[^>]*>/gu, "").replace(/\s+/gu, " ").trim();

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
    assert.match(summaryHtml, /<details id="draft-changes" class="report-section" data-collapsible>/u);
    assert.match(summaryHtml, /<details id="draft-1-draft-a-title-only" class="history-page-section" data-collapsible>/u);

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
