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
    assert.equal(afterView.drafts[0].notes.content, "Alpha notes from unit");
    assert.equal(afterView.drafts[1].content, "Beta");
    assert.equal(afterView.viewState.activeEditorKey, "draft:draft-a:notes");

    const exportResponse = await fetch(new URL("/api/export", baseUrl));
    assert.equal(exportResponse.status, 200);
    assert.match(await exportResponse.text(), /Alpha from unit/);

    const summaryFolder = path.join(dataDir, "version-history-folder");
    __test.writeVersionHistoryFolderPath(summaryFolder);
    const summaryResult = await writeFullVersionHistorySummaryReport(afterStoryHistory, {
      fileName: "server-page-unit-test.txt",
      filePath: path.join(dataDir, "server-page-unit-test.txt")
    });
    const summaryHtml = fs.readFileSync(summaryResult.reportPath, "utf8");
    assert.doesNotMatch(summaryHtml, /First saved version; no previous version to compare/u);
    assert.match(summaryHtml, /First saved version/u);
    assert.match(summaryHtml, /Baseline text; no changes to compare/u);
    assert.match(summaryHtml, /Original story/u);

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
