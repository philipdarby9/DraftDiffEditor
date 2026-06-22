const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const DiffCore = require("../public/diff-core");
const diffCoreSource = fs.readFileSync(path.join(__dirname, "..", "public", "diff-core.js"), "utf8");

function changedText(parts, type) {
  return parts
    .filter(part => part.type === type)
    .map(part => part.text)
    .join("")
    .replace(/\s+/g, " ")
    .trim();
}

function joinedText(parts, type) {
  return parts
    .filter(part => part.type === type || part.type === "same")
    .map(part => part.text)
    .join("");
}

function token(key, text = key, marks = {}, index = 0) {
  return { key, text, marks, index };
}

function makeTempDir(prefix) {
  return fs.mkdtempSync(path.join(os.tmpdir(), prefix));
}

function removeTempDir(directoryPath) {
  if (!directoryPath || !directoryPath.startsWith(os.tmpdir())) return;
  fs.rmSync(directoryPath, { recursive: true, force: true });
}

async function testServerSummaryRender() {
  const dataDir = makeTempDir("draft-diff-test-data-");
  const backupDir = makeTempDir("draft-diff-test-backup-");
  const previousDataDir = process.env.DRAFT_DIFF_DATA_DIR;
  process.env.DRAFT_DIFF_DATA_DIR = dataDir;

  try {
    fs.writeFileSync(
      path.join(dataDir, "version-history-folder.json"),
      `${JSON.stringify({ folderPath: backupDir, updatedAt: "2026-06-07T00:00:00.000Z" }, null, 2)}\n`
    );

    const server = require("../server");
    const result = await server.writeFullVersionHistorySummaryReport({
      initialNotes: {
        id: "notes",
        title: "Project notes",
        content: "Project opening note.",
        contentHtml: "Project opening note.",
        versionHistory: [
          { id: "pn1", createdAt: "2026-01-01T00:00:00.000Z", content: "Project note.", contentHtml: "Project note." },
          { id: "pn2", createdAt: "2026-01-02T00:00:00.000Z", content: "Project opening note.", contentHtml: "Project opening note." }
        ]
      },
      drafts: [{
        id: "draft-1",
        title: "Draft One",
        content: "Alpha bright beta.",
        contentHtml: "Alpha bright beta.",
        notes: { id: "notes-1", title: "Draft One Notes", content: "", contentHtml: "" },
        versionHistory: [
          { id: "v1", createdAt: "2026-01-01T00:00:00.000Z", content: "Alpha beta.", contentHtml: "Alpha beta." },
          { id: "v2", createdAt: "2026-01-02T00:00:00.000Z", content: "Alpha bright beta.", contentHtml: "Alpha bright beta." }
        ]
      }]
    }, { fileName: "fixture.txt" });

    const html = fs.readFileSync(result.reportPath, "utf8");
    assert.equal(result.bytes > 0, true);
    assert.equal(html.includes("Draft One"), true);
    assert.equal(html.includes("bright"), true);
  } finally {
    if (previousDataDir === undefined) {
      delete process.env.DRAFT_DIFF_DATA_DIR;
    } else {
      process.env.DRAFT_DIFF_DATA_DIR = previousDataDir;
    }
    removeTempDir(dataDir);
    removeTempDir(backupDir);
  }
}

async function run() {
  {
    const parts = DiffCore.diffText("Alpha beta.", "Alpha beta.");
    assert.equal(parts.every(part => part.type === "same"), true);
    assert.equal(joinedText(parts, "added"), "Alpha beta.");
  }

  {
    const parts = DiffCore.diffText("Alpha beta.", "Alpha bright beta.");
    assert.equal(changedText(parts, "added"), "bright");
    assert.equal(changedText(parts, "removed"), "");
    assert.equal(joinedText(parts, "added"), "Alpha bright beta.");
    assert.equal(joinedText(parts, "removed"), "Alpha beta.");
  }

  {
    const parts = DiffCore.diffText("Alpha bright beta.", "Alpha beta.");
    assert.equal(changedText(parts, "added"), "");
    assert.equal(changedText(parts, "removed"), "bright");
    assert.equal(joinedText(parts, "added"), "Alpha beta.");
    assert.equal(joinedText(parts, "removed"), "Alpha bright beta.");
  }

  {
    const parts = DiffCore.diffText("One small step.", "One giant step.");
    assert.equal(changedText(parts, "removed"), "small");
    assert.equal(changedText(parts, "added"), "giant");
    const removed = parts.find(part => part.type === "removed" && part.text === "small");
    const added = parts.find(part => part.type === "added" && part.text === "giant");
    assert.deepEqual({ start: removed.beforeStart, end: removed.beforeEnd }, { start: 4, end: 9 });
    assert.deepEqual({ start: added.afterStart, end: added.afterEnd }, { start: 4, end: 9 });
  }

  {
    const parts = DiffCore.diffSequence(
      [token("Hello|b", "Hello", { bold: true })],
      [token("Hello|", "Hello", {})]
    );
    assert.equal(parts.some(part => part.type === "removed"), true);
    assert.equal(parts.some(part => part.type === "added"), true);
    assert.equal(parts.some(part => part.type === "same"), false);
  }

  {
    const before = Array.from({ length: 20 }, (_, index) => token(`before-${index}`, `b${index}`, {}, index));
    const after = Array.from({ length: 20 }, (_, index) => token(`after-${index}`, `a${index}`, {}, index));
    const parts = DiffCore.diffSequence(before, after);
    assert.equal(parts.filter(part => part.type === "removed").length, 20);
    assert.equal(parts.filter(part => part.type === "added").length, 20);
    assert.equal(parts.some(part => part.type === "same"), false);
  }

  {
    assert.doesNotMatch(
      diffCoreSource,
      /const\s+rows\s*=\s*Array\.from|const\s+similarities\s*=\s*Array\.from/,
      "diff core should not allocate full DP matrices for block or token alignment"
    );
    assert.doesNotMatch(
      diffCoreSource,
      /max(?:Changed)?TokenCells|exceedsCellLimit|diffCellCount/,
      "diff core should not enforce comparison-cell limits"
    );
  }

  {
    const before = [];
    const after = [];
    for (let index = 0; index < 180; index += 1) {
      const sharedKey = index % 15 === 0 ? `shared-${index}` : "";
      before.push(token(sharedKey || `before-${index}`, sharedKey || `b${index}`, {}, index));
      after.push(token(sharedKey || `after-${index}`, sharedKey || `a${index}`, {}, index));
    }
    const parts = DiffCore.diffSequence(before, after);
    assert.equal(joinedText(parts, "removed"), before.map(part => part.text).join(""));
    assert.equal(joinedText(parts, "added"), after.map(part => part.text).join(""));
    assert.equal(parts.filter(part => part.type === "same").length, 12);
  }

  {
    const before = "First sentence. Second sentence. Closing sentence.";
    const after = "First sentence. Second sentence with a useful insert. Closing sentence.";
    const parts = DiffCore.diffText(before, after);
    assert.equal(changedText(parts, "added"), "with a useful insert");
    assert.equal(joinedText(parts, "added"), after);
    assert.equal(joinedText(parts, "removed"), before);
  }

  await testServerSummaryRender();
}

run()
  .then(() => {
    console.log("diff-core tests passed");
  })
  .catch(error => {
    console.error(error && error.stack ? error.stack : error);
    process.exit(1);
  });
