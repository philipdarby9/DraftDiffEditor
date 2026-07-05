#!/usr/bin/env node
"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), "draft-diff-persist-"));
process.env.DRAFT_DIFF_DATA_DIR = dataDir;
process.env.DRAFT_DIFF_HOST = "127.0.0.1";

const StateCore = require("../public/state-core");
const server = require("../server");
const t = server.__test;

function fixtureState(content) {
  return StateCore.normalizeState({
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    initialNotes: {
      title: "Project notes",
      content: `Story ${content}`,
      contentHtml: `<p>Story ${content}</p>`,
      versionHistory: [
        {
          id: `story-${content}`,
          createdAt: "2026-01-01T00:00:00.000Z",
          title: "Project notes",
          content: `Story ${content}`,
          contentHtml: `<p>Story ${content}</p>`
        }
      ]
    },
    drafts: [
      {
        id: "draft-a",
        title: "Draft A",
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-01T00:00:00.000Z",
        content: content,
        contentHtml: `<p>${content}</p>`,
        versionHistory: [
          {
            id: `draft-${content}`,
            createdAt: "2026-01-01T00:00:00.000Z",
            title: "Draft A",
            content,
            contentHtml: `<p>${content}</p>`
          }
        ],
        notes: {
          title: "Draft A Notes",
          content: `${content} notes`,
          contentHtml: `<p>${content} notes</p>`
        }
      }
    ]
  });
}

function readText(filePath) {
  return fs.readFileSync(filePath, "utf8");
}

function snapshot(paths) {
  return Object.fromEntries(paths.map(filePath => [
    filePath,
    fs.existsSync(filePath) ? readText(filePath) : null
  ]));
}

function assertSnapshot(snapshotBefore) {
  Object.entries(snapshotBefore).forEach(([filePath, expected]) => {
    if (expected === null) {
      assert.equal(fs.existsSync(filePath), false, `${filePath} should not exist`);
      return;
    }
    assert.equal(readText(filePath), expected, `${filePath} should be restored`);
  });
}

function versionHistoryPath(historyDir) {
  const jsonDir = path.join(historyDir, "json");
  const files = fs.readdirSync(jsonDir).filter(file => file.endsWith(".version-history.json"));
  assert.equal(files.length, 1, "expected one version-history sidecar");
  return path.join(jsonDir, files[0]);
}

function writeInterruptedJournal(paths, snapshotBefore) {
  fs.rmSync(t.PERSISTENCE_TRANSACTION_DIR, { recursive: true, force: true });
  fs.mkdirSync(t.PERSISTENCE_TRANSACTION_DIR, { recursive: true });
  const writes = paths.map((filePath, index) => {
    const backupPath = path.join(t.PERSISTENCE_TRANSACTION_DIR, `before-${index}.txt`);
    fs.writeFileSync(backupPath, snapshotBefore[filePath], "utf8");
    return { filePath, existed: true, backupPath };
  });
  fs.writeFileSync(
    path.join(t.PERSISTENCE_TRANSACTION_DIR, "manifest.json"),
    `${JSON.stringify({ version: 1, createdAt: new Date().toISOString(), writes }, null, 2)}\n`,
    "utf8"
  );
}

try {
  const missingBackupParent = path.join(dataDir, "renamed-backup-parent");
  const missingBackupFolder = path.join(missingBackupParent, "backup-folder-before-rename");
  fs.mkdirSync(missingBackupParent, { recursive: true });
  assert.equal(
    t.existingFolderForDialog(missingBackupFolder),
    missingBackupParent,
    "folder dialogs should start from an existing parent when the saved backup folder was moved"
  );

  const historyDir = path.join(dataDir, "history");
  const linkedPath = path.join(dataDir, "linked.txt");
  t.writeVersionHistoryFolderPath(historyDir);
  t.writeTextFileLink(linkedPath);

  const original = fixtureState("Alpha");
  t.writeAll(original, { filePath: linkedPath, fileName: "linked.txt", allowCreateLinkedTextFile: true });
  const sidecarPath = versionHistoryPath(historyDir);
  const persistedPaths = [
    t.STATE_FILE,
    t.EXPORT_FILE,
    linkedPath,
    t.TEXT_FILE_STATES_FILE,
    sidecarPath
  ];
  const beforeFailedSave = snapshot(persistedPaths);

  assert.throws(
    () => t.writeAll(fixtureState("Beta"), {
      filePath: linkedPath,
      fileName: "linked.txt",
      testFailWritePath: sidecarPath
    }),
    /Injected transaction write failure/
  );
  assertSnapshot(beforeFailedSave);
  assert.equal(fs.existsSync(t.PERSISTENCE_TRANSACTION_DIR), false, "failed transaction journal should be removed after rollback");

  writeInterruptedJournal(persistedPaths, beforeFailedSave);
  persistedPaths.forEach(filePath => {
    fs.writeFileSync(filePath, `interrupted ${path.basename(filePath)}`, "utf8");
  });
  t.recoverPersistenceTransaction();
  assertSnapshot(beforeFailedSave);
  assert.equal(fs.existsSync(t.PERSISTENCE_TRANSACTION_DIR), false, "recovered transaction journal should be removed");

  const recoveredState = t.readState();
  assert.equal(recoveredState.drafts[0].content, "Alpha");
  assert.match(readText(t.EXPORT_FILE), /Alpha/);

  t.writeAll(fixtureState("Gamma"), {
    filePath: linkedPath,
    fileName: "linked.txt",
    allowLinkedTextFileFailure: true,
    testFailWritePath: linkedPath
  });
  assert.match(readText(t.STATE_FILE), /Gamma/, "project state should still save when linked text file is blocked");
  assert.match(readText(t.EXPORT_FILE), /Gamma/, "local companion export should still save when linked text file is blocked");
  assert.match(readText(sidecarPath), /Gamma/, "version history sidecar should still save when linked text file is blocked");
  assert.match(readText(linkedPath), /Alpha/, "blocked linked text file should be left untouched");

  const missingLinkedPath = path.join(dataDir, "renamed-parent", "moved-story.txt");
  t.writeTextFileLink(missingLinkedPath);
  const missingLinkedResult = server.saveStateFromRequestBody(JSON.stringify({
    state: fixtureState("Delta"),
    filePath: missingLinkedPath,
    fileName: "moved-story.txt"
  }));
  assert.equal(missingLinkedResult.linkedTextFileMissing, true, "missing linked text file should be reported");
  assert.equal(missingLinkedResult.linkedTextMissingPath, missingLinkedPath);
  assert.equal(
    fs.existsSync(path.dirname(missingLinkedPath)),
    false,
    "autosave should not recreate a renamed/missing linked story folder"
  );
  const missingLinkedSidecarPath = path.join(historyDir, "json", "moved-story.version-history.json");
  assert.match(readText(t.STATE_FILE), /Delta/, "project state should still save locally when linked file is missing");
  assert.match(readText(t.EXPORT_FILE), /Delta/, "local companion export should still save when linked file is missing");
  assert.match(readText(missingLinkedSidecarPath), /Delta/, "version history sidecar should still save when linked file is missing");

  const recentFiles = server.recentTextFilesPayload().files;
  const missingRecent = recentFiles.find(file => file.filePath === missingLinkedPath);
  assert.equal(Boolean(missingRecent), true, "missing linked story should remain visible in recent files");
  assert.equal(missingRecent.exists, false, "missing recent entry should be marked as missing");
  const missingRecentOpen = server.openRecentTextFileFromRequestBody(JSON.stringify({ filePath: missingLinkedPath }));
  assert.equal(missingRecentOpen.ok, false);
  assert.equal(missingRecentOpen.code, "LINKED_TEXT_FILE_MISSING");
  assert.equal(
    fs.existsSync(path.dirname(missingLinkedPath)),
    false,
    "opening a missing recent entry should not recreate its old folder"
  );

  const historyBackupsDir = path.join(historyDir, "version history JSON backups");
  const backupsBefore = fs.existsSync(historyBackupsDir) ? fs.readdirSync(historyBackupsDir).length : 0;
  t.writeTextFileLink(linkedPath);
  t.writeAll(fixtureState("Epsilon"), {
    filePath: linkedPath,
    fileName: "linked.txt"
  });
  const backupFiles = fs.existsSync(historyBackupsDir) ? fs.readdirSync(historyBackupsDir) : [];
  assert.equal(
    backupFiles.length > backupsBefore,
    true,
    "overwriting a version-history JSON should keep a permanent backup copy"
  );
  assert.equal(
    backupFiles.some(fileName => readText(path.join(historyBackupsDir, fileName)).includes("Gamma")),
    true,
    "version-history backup should contain the previous JSON contents"
  );

  assert.throws(
    () => t.writeAll(fixtureState("Zeta"), {
      filePath: linkedPath,
      fileName: "linked.txt",
      mergeExisting: false
    }),
    /Refusing to write version history because it would drop/,
    "version-history writes should fail if existing saved text would disappear"
  );
  assert.match(readText(path.join(historyDir, "json", "linked.version-history.json")), /Epsilon/);

  const linkedHistoryPath = path.join(historyDir, "json", "linked.version-history.json");
  fs.writeFileSync(linkedHistoryPath, `${JSON.stringify({
    version: 1,
    sourceFileName: "linked.txt",
    sourceFilePath: linkedPath,
    story: {
      title: "Project notes",
      history: []
    },
    drafts: [
      {
        id: "draft-a",
        index: 0,
        title: "Draft A",
        history: [
          { id: "empty-1", createdAt: "2026-01-01T00:00:00.000Z", title: "Draft A" },
          { id: "empty-2", createdAt: "2026-01-01T00:01:00.000Z", title: "Draft A" }
        ]
      }
    ]
  }, null, 2)}\n`, "utf8");
  assert.throws(
    () => t.writeAll(fixtureState("Epsilon"), {
      filePath: linkedPath,
      fileName: "linked.txt",
      mergeExisting: false
    }),
    /Refusing to write version history because it would reduce/,
    "version-history writes should fail if existing saved entry counts would shrink"
  );
  assert.match(readText(linkedHistoryPath), /empty-2/);

  fs.writeFileSync(linkedHistoryPath, `${JSON.stringify({
    version: 1,
    sourceFileName: "linked.txt",
    sourceFilePath: linkedPath,
    story: {
      title: "Project notes",
      history: []
    },
    drafts: [
      {
        id: "draft-a",
        index: 0,
        title: "Draft A",
        history: [
          {
            id: "same-text-1",
            createdAt: "2026-01-01T00:00:00.000Z",
            title: "Draft A",
            content: "Same saved text",
            contentHtml: "<p>Same saved text</p>"
          },
          {
            id: "same-text-2",
            createdAt: "2026-01-01T00:01:00.000Z",
            title: "Draft A",
            content: "Same saved text",
            contentHtml: "<p>Same saved text</p>"
          }
        ]
      }
    ]
  }, null, 2)}\n`, "utf8");
  t.writeAll(fixtureState("Theta"), {
    filePath: linkedPath,
    fileName: "linked.txt"
  });
  const sameTextAfterSave = JSON.parse(readText(linkedHistoryPath));
  const sameTextHistoryIds = sameTextAfterSave.drafts[0].history.map(version => version.id);
  assert.equal(
    sameTextHistoryIds.includes("same-text-1") && sameTextHistoryIds.includes("same-text-2"),
    true,
    "normal save should preserve separate saved versions even when their text is identical"
  );

  fs.writeFileSync(linkedHistoryPath, `${JSON.stringify({
    version: 1,
    sourceFileName: "linked.txt",
    sourceFilePath: linkedPath,
    story: {
      id: "letters-story",
      title: "Project notes",
      history: [{
        id: "letters-story-v1",
        createdAt: "2026-01-01T00:00:00.000Z",
        title: "Project notes",
        content: "Dear story notes",
        contentHtml: "<p>Dear story notes</p>"
      }]
    },
    drafts: [
      {
        id: "letters-draft-1",
        index: 0,
        title: "Draft A",
        history: [{
          id: "letters-draft-v1",
          createdAt: "2026-01-01T00:00:00.000Z",
          title: "Draft A",
          content: "Dear Mischa,",
          contentHtml: "<p>Dear Mischa,</p>"
        }],
        notes: {
          id: "letters-notes-1",
          title: "Draft A Notes",
          history: []
        }
      }
    ]
  }, null, 2)}\n`, "utf8");
  const contaminatedCachedState = StateCore.normalizeState({
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-02T00:00:00.000Z",
    initialNotes: {
      id: "initial-notes",
      title: "Project notes",
      content: "Dear story notes updated",
      contentHtml: "<p>Dear story notes updated</p>",
      versionHistory: [{
        id: "suicide-story-v1",
        createdAt: "2026-01-01T00:00:00.000Z",
        title: "Project notes",
        content: "William Roster story notes",
        contentHtml: "<p>William Roster story notes</p>"
      }]
    },
    drafts: [
      {
        id: "suicide-draft-1",
        title: "Draft A",
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-02T00:00:00.000Z",
        content: "Dear Mischa, updated",
        contentHtml: "<p>Dear Mischa, updated</p>",
        versionHistory: [{
          id: "suicide-draft-v1",
          createdAt: "2026-01-01T00:00:00.000Z",
          title: "Draft A",
          content: "William Roster draft text",
          contentHtml: "<p>William Roster draft text</p>"
        }],
        notes: {
          id: "suicide-notes-1",
          title: "Draft A Notes",
          content: "",
          contentHtml: "",
          versionHistory: [{
            id: "suicide-notes-v1",
            createdAt: "2026-01-01T00:00:00.000Z",
            title: "Draft A Notes",
            content: "William Roster notes",
            contentHtml: "<p>William Roster notes</p>"
          }]
        }
      }
    ]
  });
  t.writeAll(contaminatedCachedState, {
    filePath: linkedPath,
    fileName: "linked.txt",
    allowCreateLinkedTextFile: true
  });
  const cleanedAfterSave = JSON.parse(readText(linkedHistoryPath));
  assert.equal(
    JSON.stringify(cleanedAfterSave).includes("William Roster"),
    false,
    "existing sidecar saves should not import stale histories from another in-memory story"
  );
  assert.equal(
    cleanedAfterSave.drafts[0].id,
    "letters-draft-1",
    "existing sidecar draft IDs should remain authoritative when matching by title or index"
  );
  assert.equal(
    cleanedAfterSave.drafts[0].history.some(version => version.content === "Dear Mischa, updated"),
    true,
    "existing sidecar saves should still add the current target story text"
  );

  assert.throws(
    () => t.assertVersionHistoryMigrationSafe({
      errors: [{ code: "VERSION_HISTORY_COUNT_LOSS", error: "would shrink history" }]
    }),
    /migration was stopped/,
    "folder migration should stop if a sidecar write would shrink existing history"
  );
  assert.doesNotThrow(
    () => t.assertVersionHistoryMigrationSafe({
      errors: [{
        code: "VERSION_HISTORY_COUNT_LOSS",
        error: "would shrink history",
        skipped: true
      }]
    }),
    "folder migration should allow skipped embedded histories when existing sidecars preserve more history"
  );

  const carryStoryPath = path.join(dataDir, "carry-story.txt");
  const previousHistoryDir = path.join(dataDir, "previous-history");
  const nextHistoryDir = path.join(dataDir, "next-history");
  fs.mkdirSync(path.join(previousHistoryDir, "json"), { recursive: true });
  fs.mkdirSync(path.join(nextHistoryDir, "json"), { recursive: true });
  const fullCarryPayload = {
    version: 1,
    sourceFileName: "carry-story.txt",
    sourceFilePath: carryStoryPath,
    story: { title: "Project notes", history: [] },
    drafts: [
      {
        id: "draft-a",
        index: 0,
        title: "Draft A",
        history: [
          {
            id: "carry-1",
            createdAt: "2026-01-01T00:00:00.000Z",
            title: "Draft A",
            content: "Carry one",
            contentHtml: "<p>Carry one</p>"
          },
          {
            id: "carry-2",
            createdAt: "2026-01-01T00:01:00.000Z",
            title: "Draft A",
            content: "Carry two",
            contentHtml: "<p>Carry two</p>"
          }
        ]
      }
    ]
  };
  fs.writeFileSync(
    path.join(previousHistoryDir, "json", "carry-story.version-history.json"),
    `${JSON.stringify(fullCarryPayload, null, 2)}\n`,
    "utf8"
  );
  fs.writeFileSync(
    path.join(nextHistoryDir, "json", "carry-story.version-history.json"),
    `${JSON.stringify({
      ...fullCarryPayload,
      drafts: [{ ...fullCarryPayload.drafts[0], history: [fullCarryPayload.drafts[0].history[0]] }]
    }, null, 2)}\n`,
    "utf8"
  );
  const carriedHistoryFiles = t.carryVersionHistoryJsonFiles(previousHistoryDir, nextHistoryDir);
  t.assertCarriedVersionHistoryFilesSafe(carriedHistoryFiles);
  assert.equal(carriedHistoryFiles.replaced.length, 1, "larger previous sidecar should replace smaller target sidecar");
  assert.equal(
    fs.readdirSync(path.join(nextHistoryDir, "version history JSON backups")).length,
    1,
    "replaced sidecar should be backed up inside the new backup folder"
  );
  const carriedTargetPath = path.join(nextHistoryDir, "json", "carry-story.version-history.json");
  assert.match(readText(carriedTargetPath), /Carry two/, "carried full sidecar should be used in the new folder");
  t.writeVersionHistoryFolderPath(nextHistoryDir);
  t.writeTextFileLink(carryStoryPath);
  t.writeAll(fixtureState("Carry current"), {
    filePath: carryStoryPath,
    fileName: "carry-story.txt",
    allowCreateLinkedTextFile: true
  });
  assert.match(readText(carriedTargetPath), /Carry two/, "normal save after folder switch should preserve carried history");
  t.writeVersionHistoryFolderPath(historyDir);

  const conflictPreviousHistoryDir = path.join(dataDir, "conflict-previous-history");
  const conflictNextHistoryDir = path.join(dataDir, "conflict-next-history");
  fs.mkdirSync(path.join(conflictPreviousHistoryDir, "json"), { recursive: true });
  fs.mkdirSync(path.join(conflictNextHistoryDir, "json"), { recursive: true });
  fs.writeFileSync(
    path.join(conflictPreviousHistoryDir, "json", "carry-story.version-history.json"),
    `${JSON.stringify(fullCarryPayload, null, 2)}\n`,
    "utf8"
  );
  fs.writeFileSync(
    path.join(conflictNextHistoryDir, "json", "carry-story.version-history.json"),
    `${JSON.stringify({
      ...fullCarryPayload,
      drafts: [{
        ...fullCarryPayload.drafts[0],
        history: [{
          id: "target-only",
          createdAt: "2026-01-01T00:02:00.000Z",
          title: "Draft A",
          content: "Target only",
          contentHtml: "<p>Target only</p>"
        }]
      }]
    }, null, 2)}\n`,
    "utf8"
  );
  const conflictCarry = t.carryVersionHistoryJsonFiles(conflictPreviousHistoryDir, conflictNextHistoryDir);
  assert.equal(conflictCarry.conflicts.length, 1, "carry-forward should report conflicts when target text would be lost");
  assert.throws(
    () => t.assertCarriedVersionHistoryFilesSafe(conflictCarry),
    /could not be safely carried forward/,
    "folder selection should stop when carry-forward cannot preserve target text"
  );

  const inventoryStoryPath = path.join(dataDir, "inventory-story.txt");
  t.writeTextFileLink(inventoryStoryPath);
  t.writeAll(fixtureState("Inventory"), {
    filePath: inventoryStoryPath,
    fileName: "inventory-story.txt",
    allowCreateLinkedTextFile: true
  });

  let inventory = t.versionHistoryFolderCheck({
    filePath: inventoryStoryPath,
    fileName: "inventory-story.txt"
  }).folderInventory;
  assert.equal(
    inventory.expectedStories.some(story => story.fileName === "inventory-story.txt" && story.found),
    true,
    "folder inventory should check every known story, not only the active story"
  );
  assert.equal(
    inventory.expectedStories.some(story => story.fileName === "linked.txt" && story.found),
    true,
    "folder inventory should include other known story histories"
  );

  const corruptHistoryPath = path.join(historyDir, "json", "corrupt.version-history.json");
  fs.writeFileSync(corruptHistoryPath, "{ broken json", "utf8");
  inventory = t.versionHistoryFolderCheck({
    filePath: inventoryStoryPath,
    fileName: "inventory-story.txt"
  }).folderInventory;
  assert.equal(
    inventory.invalidJsonFiles.some(file => file.filePath === corruptHistoryPath),
    true,
    "folder inventory should report unreadable version-history JSON files"
  );

  const inventorySidecarPath = path.join(historyDir, "json", "inventory-story.version-history.json");
  fs.rmSync(inventorySidecarPath, { force: true });
  inventory = t.versionHistoryFolderCheck({
    filePath: inventoryStoryPath,
    fileName: "inventory-story.txt"
  }).folderInventory;
  assert.equal(
    inventory.missingStories.some(story => story.fileName === "inventory-story.txt"),
    true,
    "folder inventory should report missing JSON for every known story"
  );

  console.log("persistence transaction tests passed");
} finally {
  fs.rmSync(dataDir, { recursive: true, force: true });
}
