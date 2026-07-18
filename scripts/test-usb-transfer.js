const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), "draft-diff-usb-transfer-"));
process.env.DRAFT_DIFF_DATA_DIR = dataDir;
process.env.DRAFT_DIFF_HOST = "127.0.0.1";

const StateCore = require("../public/state-core");
const { __test } = require("../server");

function version(id, content, createdAt, title = "Draft") {
  return {
    id,
    title,
    createdAt,
    content,
    contentHtml: StateCore.textToHtml(content)
  };
}

function stateWithDrafts(drafts, projectNotes, projectVersions) {
  return StateCore.normalizeState({
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    initialNotes: {
      id: "initial-notes",
      title: "Project notes",
      content: projectNotes,
      contentHtml: StateCore.textToHtml(projectNotes),
      versionHistory: projectVersions
    },
    drafts: drafts.map((draft, index) => ({
      id: `draft-${index + 1}`,
      title: draft.title,
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: draft.updatedAt || "2026-01-01T00:00:00.000Z",
      content: draft.content,
      contentHtml: StateCore.textToHtml(draft.content),
      versionHistory: draft.versionHistory,
      notes: {
        id: `notes-${index + 1}`,
        title: `${draft.title} Notes`,
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: draft.notesUpdatedAt || draft.updatedAt || "2026-01-01T00:00:00.000Z",
        content: draft.notes || "",
        contentHtml: StateCore.textToHtml(draft.notes || ""),
        versionHistory: draft.notesVersionHistory
      }
    }))
  });
}

function writeVersionHistorySidecar(folderPath, fileName, state) {
  const jsonFolder = path.join(folderPath, "json");
  fs.mkdirSync(jsonFolder, { recursive: true });
  fs.writeFileSync(path.join(jsonFolder, "story.version-history.json"), `${JSON.stringify({
    version: 1,
    sourceFileName: fileName,
    sourceFilePath: path.join(folderPath, "..", fileName),
    updatedAt: "2026-01-02T00:00:00.000Z",
    story: {
      id: state.initialNotes.id,
      title: "Project notes",
      history: state.initialNotes.versionHistory
    },
    drafts: state.drafts.map((draft, index) => ({
      id: draft.id,
      index,
      title: draft.title,
      history: draft.versionHistory,
      notes: {
        id: draft.notes.id,
        title: draft.notes.title,
        createdAt: draft.notes.createdAt,
        history: draft.notes.versionHistory
      }
    }))
  }, null, 2)}\n`, "utf8");
}

function padDatePart(value, length = 2) {
  return String(value).padStart(length, "0");
}

function expectedLocalUsbTimestamp(date) {
  const offsetMinutes = -date.getTimezoneOffset();
  const offsetSign = offsetMinutes >= 0 ? "+" : "-";
  const absoluteOffsetMinutes = Math.abs(offsetMinutes);
  return [
    `${date.getFullYear()}-${padDatePart(date.getMonth() + 1)}-${padDatePart(date.getDate())}`,
    "T",
    `${padDatePart(date.getHours())}-${padDatePart(date.getMinutes())}-${padDatePart(date.getSeconds())}`,
    `-${padDatePart(date.getMilliseconds(), 3)}`,
    `${offsetSign}${padDatePart(Math.floor(absoluteOffsetMinutes / 60))}-${padDatePart(absoluteOffsetMinutes % 60)}`
  ].join("");
}

const localTimestampDate = new Date(2026, 6, 18, 17, 49, 52, 556);
assert.equal(
  __test.usbTransferTimestamp(localTimestampDate),
  expectedLocalUsbTimestamp(localTimestampDate),
  "USB transfer folders should use local time rather than UTC ISO time"
);
assert.doesNotMatch(__test.usbTransferTimestamp(localTimestampDate), /Z$/);

const sourceDir = path.join(dataDir, "source");
const usbRoot = path.join(dataDir, "usb");
const storyPath = path.join(sourceDir, "story.txt");
const backupFolder = path.join(sourceDir, "DraftDiff backup");
fs.mkdirSync(sourceDir, { recursive: true });
fs.mkdirSync(usbRoot, { recursive: true });

const baseState = stateWithDrafts([
  {
    title: "Draft 1",
    content: "Alpha opening",
    notes: "Base notes",
    versionHistory: [version("draft-1-v1", "Alpha opening", "2026-01-01T00:00:00.000Z")]
  },
  {
    title: "Draft 2",
    content: "Second base draft",
    notes: "Second notes",
    versionHistory: [version("draft-2-v1", "Second base draft", "2026-01-01T00:00:00.000Z")]
  },
  {
    title: "Draft 3",
    content: "Third base draft",
    notes: "Third notes",
    versionHistory: [version("draft-3-v1", "Third base draft", "2026-01-01T00:00:00.000Z")]
  }
], "Original plan", [
  version("story-v1", "Original plan", "2026-01-01T00:00:00.000Z")
]);

__test.writeTextFileLink(storyPath);
__test.writeVersionHistoryFolderPath(backupFolder);
const savedState = __test.writeAll(baseState, {
  filePath: storyPath,
  fileName: "story.txt",
  allowCreateLinkedTextFile: true
});
const unrelatedHistoryPath = path.join(backupFolder, "json", "other-story.version-history.json");
fs.mkdirSync(path.dirname(unrelatedHistoryPath), { recursive: true });
fs.writeFileSync(unrelatedHistoryPath, JSON.stringify({
  version: 1,
  sourceFileName: "other-story.txt",
  drafts: []
}, null, 2), "utf8");

const exported = __test.createUsbTransferPackage({
  state: savedState,
  filePath: storyPath,
  fileName: "story.txt"
}, usbRoot);
assert.equal(
  fs.existsSync(path.join(exported.backupFolderPath, "json", "other-story.version-history.json")),
  false,
  "USB package should not include unrelated story history sidecars"
);

const unchangedReview = __test.reviewUsbTransferFolder(exported.packageFolderPath);
assert.equal(unchangedReview.merge.status, "no-changes");
assert.equal(unchangedReview.merge.counts.usbOnly, 0);
assert.equal(unchangedReview.merge.counts.localOnly, 0);
assert.equal(unchangedReview.merge.counts.bothChanged, 0);

const newComputerPackagePath = path.join(dataDir, "new-computer-package");
fs.cpSync(exported.packageFolderPath, newComputerPackagePath, { recursive: true });
const newComputerManifestPath = path.join(newComputerPackagePath, path.basename(exported.manifestPath));
const newComputerManifest = JSON.parse(fs.readFileSync(newComputerManifestPath, "utf8"));
newComputerManifest.items = newComputerManifest.items.map(item => ({
  ...item,
  sourcePath: item.kind === "directory"
    ? path.join(dataDir, "new-computer", "DraftDiff backup")
    : path.join(dataDir, "new-computer", "story.txt")
}));
fs.writeFileSync(newComputerManifestPath, `${JSON.stringify(newComputerManifest, null, 2)}\n`, "utf8");
__test.writeTextFileLink(null);
__test.writeVersionHistoryFolderPath(null);
const newComputerReview = __test.reviewUsbTransferFolder(newComputerPackagePath);
assert.equal(newComputerReview.files.counts.localMissing > 0, true);
assert.equal(newComputerReview.files.counts.localDeleted, 0);
assert.equal(
  newComputerReview.files.localMissing.every(entry => entry.statusLabel === "Not yet on this computer"),
  true
);
__test.writeTextFileLink(storyPath);
__test.writeVersionHistoryFolderPath(backupFolder);

const localState = stateWithDrafts([
  {
    title: "Draft 1",
    content: "Alpha opening changed on A",
    notes: "Base notes",
    updatedAt: "2026-01-03T00:00:00.000Z",
    versionHistory: [
      version("draft-1-v1", "Alpha opening", "2026-01-01T00:00:00.000Z"),
      version("draft-1-local", "Alpha opening changed on A", "2026-01-03T00:00:00.000Z")
    ]
  },
  {
    title: "Draft 2",
    content: "Second base draft",
    notes: "Second notes",
    versionHistory: [version("draft-2-v1", "Second base draft", "2026-01-01T00:00:00.000Z")]
  },
  {
    title: "Draft 3",
    content: "Third base draft",
    notes: "Third notes",
    versionHistory: [version("draft-3-v1", "Third base draft", "2026-01-01T00:00:00.000Z")]
  },
  {
    title: "Draft 4",
    content: "Fourth draft on A",
    notes: "Local fourth notes",
    updatedAt: "2026-01-02T00:00:00.000Z",
    notesUpdatedAt: "2026-01-02T00:00:00.000Z",
    versionHistory: [
      version("draft-4-local", "Fourth draft on A", "2026-01-02T00:00:00.000Z", "Draft 4")
    ],
    notesVersionHistory: [
      version("notes-4-local", "Local fourth notes", "2026-01-02T00:00:00.000Z", "Draft 4 Notes")
    ]
  }
], "Original plan", [
  version("story-v1", "Original plan", "2026-01-01T00:00:00.000Z")
]);

__test.writeAll(localState, {
  filePath: storyPath,
  fileName: "story.txt"
});
fs.writeFileSync(unrelatedHistoryPath, "local unrelated history should survive import", "utf8");

const localOnlyReview = __test.reviewUsbTransferFolder(exported.packageFolderPath);
assert.equal(localOnlyReview.merge.status, "local-only");
assert.equal(localOnlyReview.merge.localOnly.some(entry => entry.type === "draft" && entry.number === 1), true);
assert.equal(localOnlyReview.merge.localOnly.some(entry => entry.type === "draft" && entry.number === 4), true);

const currentLinkedReview = __test.reviewUsbTransferFolder(newComputerPackagePath);
assert.equal(currentLinkedReview.merge.localStoryMissing, false);
assert.equal(currentLinkedReview.merge.status, "local-only");

const usbState = stateWithDrafts([
  {
    title: "Draft 1",
    content: "Alpha opening",
    notes: "Base notes",
    versionHistory: [version("draft-1-v1", "Alpha opening", "2026-01-01T00:00:00.000Z")]
  },
  {
    title: "Draft 2",
    content: "Second base draft",
    notes: "Second notes",
    versionHistory: [version("draft-2-v1", "Second base draft", "2026-01-01T00:00:00.000Z")]
  },
  {
    title: "Draft 3",
    content: "Third base draft",
    notes: "Third notes",
    versionHistory: [version("draft-3-v1", "Third base draft", "2026-01-01T00:00:00.000Z")]
  },
  {
    title: "Draft 4",
    content: "Fourth draft from USB",
    notes: "USB fourth notes",
    updatedAt: "2026-01-04T00:00:00.000Z",
    notesUpdatedAt: "2026-01-04T00:00:00.000Z",
    versionHistory: [
      version("draft-4-usb", "Fourth draft from USB", "2026-01-04T00:00:00.000Z", "Draft 4")
    ],
    notesVersionHistory: [
      version("notes-4-usb", "USB fourth notes", "2026-01-04T00:00:00.000Z", "Draft 4 Notes")
    ]
  }
], "Original plan with USB note", [
  version("story-v1", "Original plan", "2026-01-01T00:00:00.000Z"),
  version("story-usb", "Original plan with USB note", "2026-01-04T00:00:00.000Z")
]);

fs.writeFileSync(exported.storyTextPath, StateCore.formatExport(usbState), "utf8");
writeVersionHistorySidecar(exported.backupFolderPath, "story.txt", usbState);

const newComputerChangedPackagePath = path.join(dataDir, "new-computer-changed-package");
fs.cpSync(exported.packageFolderPath, newComputerChangedPackagePath, { recursive: true });
const newComputerChangedManifestPath = path.join(newComputerChangedPackagePath, path.basename(exported.manifestPath));
const newComputerChangedManifest = JSON.parse(fs.readFileSync(newComputerChangedManifestPath, "utf8"));
newComputerChangedManifest.items = newComputerChangedManifest.items.map(item => ({
  ...item,
  sourcePath: item.kind === "directory"
    ? path.join(dataDir, "new-computer-changed", "DraftDiff backup")
    : path.join(dataDir, "new-computer-changed", "story.txt")
}));
fs.writeFileSync(newComputerChangedManifestPath, `${JSON.stringify(newComputerChangedManifest, null, 2)}\n`, "utf8");
__test.writeTextFileLink(null);
__test.writeVersionHistoryFolderPath(null);
const newComputerChangedReview = __test.reviewUsbTransferFolder(newComputerChangedPackagePath);
assert.equal(newComputerChangedReview.merge.status, "usb-only");
assert.equal(newComputerChangedReview.merge.localStoryMissing, true);
assert.equal(newComputerChangedReview.merge.counts.localOnly, 0);
assert.equal(newComputerChangedReview.merge.counts.bothChanged, 0);
assert.equal(newComputerChangedReview.merge.usbOnly.some(entry => entry.type === "projectNotes"), true);
assert.equal(newComputerChangedReview.merge.usbOnly.some(entry => entry.type === "draft" && entry.number === 4), true);
assert.equal(newComputerChangedReview.merge.usbOnly.some(entry => entry.type === "draftNotes" && entry.number === 4), true);
assert.equal(newComputerChangedReview.files.counts.localMissing > 0, true);
assert.equal(newComputerChangedReview.files.counts.localDeleted, 0);
__test.writeTextFileLink(storyPath);
__test.writeVersionHistoryFolderPath(backupFolder);

const review = __test.reviewUsbTransferFolder(exported.packageFolderPath);

assert.equal(review.ok, true);
assert.equal(review.merge.status, "both-changed");
assert.equal(review.merge.usbOnly.some(entry => entry.type === "projectNotes"), true);
assert.equal(review.merge.localOnly.some(entry => entry.type === "draft" && entry.number === 1), true);
const projectNotesReview = review.merge.usbOnly.find(entry => entry.type === "projectNotes");
assert.equal(projectNotesReview.localCurrentAt, "2026-01-01T00:00:00.000Z");
assert.equal(projectNotesReview.usbCurrentAt, "2026-01-04T00:00:00.000Z");
const draftFourReview = review.merge.bothChanged.find(entry => entry.type === "draft" && entry.number === 4);
assert.equal(draftFourReview.currentSource, "usb");
assert.equal(draftFourReview.conflict, true);
assert.equal(draftFourReview.localCurrentAt, "2026-01-02T00:00:00.000Z");
assert.equal(draftFourReview.usbCurrentAt, "2026-01-04T00:00:00.000Z");
const draftFourNotesReview = review.merge.bothChanged.find(entry => entry.type === "draftNotes" && entry.number === 4);
assert.equal(draftFourNotesReview.currentSource, "usb");
assert.equal(draftFourNotesReview.conflict, true);
assert.equal(draftFourNotesReview.localCurrentAt, "2026-01-02T00:00:00.000Z");
assert.equal(draftFourNotesReview.usbCurrentAt, "2026-01-04T00:00:00.000Z");
assert.equal(review.files.counts.conflicts >= 1, true);
assert.equal(review.story.projectNotes.changed, true);
assert.equal(review.story.projectNotes.newVersions, 1);
assert.equal(review.story.addedDrafts.length, 1);
assert.equal(review.story.addedDrafts[0].number, 4);
assert.equal(review.story.addedDrafts[0].wordCount, 4);
assert.equal(review.story.addedDrafts[0].versionCount, 1);

const imported = __test.applyUsbTransferFolder(exported.packageFolderPath);
assert.equal(imported.ok, true);
assert.equal(imported.imported, true);
assert.equal(imported.filePath, storyPath);
assert.equal(imported.merge.currentFromLocal.includes(1), true);
assert.equal(imported.merge.currentFromUsb.includes(4), true);
assert.equal(imported.merge.localDraftsArchived.includes(4), true);
const importedText = fs.readFileSync(storyPath, "utf8");
assert.equal(importedText.includes("Alpha opening changed on A"), true);
assert.equal(importedText.includes("Fourth draft from USB"), true);
assert.equal(importedText.includes("Fourth draft on A"), false);
assert.equal(fs.existsSync(imported.backup.backupFolderPath), true);
assert.equal(
  fs.readFileSync(path.join(imported.backup.backupFolderPath, "current", "story-text", "story.txt"), "utf8")
    .includes("Alpha opening changed on A"),
  true
);
assert.equal(fs.existsSync(path.join(imported.backup.backupFolderPath, "current", "backup-folder")), true);
const mergedHistory = JSON.parse(fs.readFileSync(path.join(backupFolder, "json", "story.version-history.json"), "utf8"));
const draftFourHistory = mergedHistory.drafts.find(draft => draft.index === 3).history;
const draftFourNotesHistory = mergedHistory.drafts.find(draft => draft.index === 3).notes.history;
assert.deepEqual(
  draftFourHistory.map(entry => entry.content),
  ["Fourth draft on A", "Fourth draft from USB"],
  "local Draft 4 should be kept as an older saved version before the newer USB Draft 4"
);
assert.deepEqual(
  draftFourNotesHistory.map(entry => entry.content),
  ["Local fourth notes", "USB fourth notes"],
  "local Draft 4 notes should be kept as an older saved version before the newer USB Draft 4 notes"
);
assert.equal(
  fs.readFileSync(unrelatedHistoryPath, "utf8"),
  "local unrelated history should survive import",
  "import should not overwrite or delete unrelated shared-backup files"
);

const blockedRoot = path.join(dataDir, "blocked-destination");
fs.mkdirSync(blockedRoot, { recursive: true });
fs.chmodSync(blockedRoot, 0o500);
try {
  const blockedPackagePath = path.join(dataDir, "blocked-destination-package");
  fs.cpSync(exported.packageFolderPath, blockedPackagePath, { recursive: true });
  const blockedManifestPath = path.join(blockedPackagePath, path.basename(exported.manifestPath));
  const blockedManifest = JSON.parse(fs.readFileSync(blockedManifestPath, "utf8"));
  blockedManifest.items = blockedManifest.items.map(item => ({
    ...item,
    sourcePath: item.kind === "directory"
      ? path.join(blockedRoot, "DraftDiff backup")
      : path.join(blockedRoot, "story.txt")
  }));
  fs.writeFileSync(blockedManifestPath, `${JSON.stringify(blockedManifest, null, 2)}\n`, "utf8");

  __test.writeTextFileLink(null);
  __test.writeVersionHistoryFolderPath(null);
  const blockedImport = __test.applyUsbTransferFolder(blockedPackagePath);
  assert.equal(blockedImport.ok, true);
  if (blockedImport.importDestination.usedFallback) {
    assert.equal(blockedImport.filePath.includes("usb-transfer-imports"), true);
  }
  assert.equal(fs.existsSync(blockedImport.filePath), true);
  assert.equal(fs.existsSync(blockedImport.importDestination.backupFolderPath), true);
} finally {
  fs.chmodSync(blockedRoot, 0o700);
}

console.log("USB transfer review test passed");
