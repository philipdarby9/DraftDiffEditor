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
  const historyDir = path.join(dataDir, "history");
  const linkedPath = path.join(dataDir, "linked.txt");
  t.writeVersionHistoryFolderPath(historyDir);
  t.writeTextFileLink(linkedPath);

  const original = fixtureState("Alpha");
  t.writeAll(original, { filePath: linkedPath, fileName: "linked.txt" });
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

  console.log("persistence transaction tests passed");
} finally {
  fs.rmSync(dataDir, { recursive: true, force: true });
}
