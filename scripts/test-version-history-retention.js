#!/usr/bin/env node
"use strict";

const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), "draft-diff-retention-"));
process.env.DRAFT_DIFF_DATA_DIR = dataDir;
process.env.DRAFT_DIFF_HOST = "127.0.0.1";

const server = require("../server");
const t = server.__test;

function sha256(content) {
  return crypto.createHash("sha256").update(content).digest("hex");
}

function historyPayload(options = {}) {
  const {
    version = 1,
    storyId = "story-a",
    sourceFileName = "story-a.txt",
    sourceFilePath = path.join(dataDir, "stories", sourceFileName),
    updatedAt = "2026-07-31T12:00:00.000Z",
    projectUpdatedAt = updatedAt,
    entryId = "version-a",
    content = "Alpha"
  } = options;

  return {
    version,
    storyId,
    sourceFileName,
    sourceFilePath,
    updatedAt,
    projectUpdatedAt,
    story: {
      id: "initial-notes",
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
            id: entryId,
            createdAt: updatedAt,
            title: "Draft A",
            content,
            contentHtml: `<p>${content}</p>`
          }
        ],
        notes: {
          id: "notes-a",
          title: "Draft A Notes",
          history: []
        }
      }
    ]
  };
}

function backupFolder(rootFolderPath) {
  return path.join(rootFolderPath, "version history JSON backups");
}

function archiveFolder(rootFolderPath) {
  return path.join(rootFolderPath, "version history JSON archive");
}

function readyForManualDeletionFolder(rootFolderPath) {
  return path.join(archiveFolder(rootFolderPath), "Ready for manual deletion");
}

function readJsonFile(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function writeJsonFile(filePath, payload) {
  fs.writeFileSync(filePath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
}

function writeJsonBackup(rootFolderPath, fileName, payload, timestamp = payload.updatedAt) {
  const folderPath = backupFolder(rootFolderPath);
  fs.mkdirSync(folderPath, { recursive: true });
  const filePath = path.join(folderPath, fileName);
  const content = `${JSON.stringify(payload, null, 2)}\n`;
  fs.writeFileSync(filePath, content, "utf8");
  const time = new Date(timestamp);
  fs.utimesSync(filePath, time, time);
  return { filePath, content, hash: sha256(content) };
}

function writeRawBackup(rootFolderPath, fileName, content, timestamp = "2026-07-31T12:00:00.000Z") {
  const folderPath = backupFolder(rootFolderPath);
  fs.mkdirSync(folderPath, { recursive: true });
  const filePath = path.join(folderPath, fileName);
  fs.writeFileSync(filePath, content);
  const time = new Date(timestamp);
  fs.utimesSync(filePath, time, time);
  return { filePath, content: Buffer.from(content), hash: sha256(content) };
}

function snapshotDirectory(folderPath) {
  if (!fs.existsSync(folderPath)) return [];
  return fs.readdirSync(folderPath, { withFileTypes: true })
    .map(entry => {
      const filePath = path.join(folderPath, entry.name);
      return entry.isFile()
        ? [entry.name, fs.readFileSync(filePath).toString("base64")]
        : [entry.name, "<directory>"];
    })
    .sort(([left], [right]) => left.localeCompare(right));
}

function syntheticRecord(id, capturedAt, options = {}) {
  const capturedAtMs = Date.parse(capturedAt);
  const storyKey = options.storyKey || "story:synthetic-a";
  return {
    id,
    fileName: `${id}.version-history.json`,
    filePath: path.join(dataDir, "synthetic", `${id}.version-history.json`),
    size: options.size ?? 10,
    mtimeMs: capturedAtMs,
    capturedAtMs,
    rawHash: options.rawHash || `raw-${id}`,
    stableHash: options.stableHash || `stable-${id}`,
    storyKey,
    storyId: options.storyId || storyKey.replace(/^story:/u, ""),
    sourceFilePath: options.sourceFilePath || path.join(dataDir, "stories", `${storyKey}.txt`),
    sourceFileName: options.sourceFileName || `${storyKey.replace(/^[^:]+:/u, "")}.txt`,
    storyLabel: options.storyLabel || storyKey,
    protectedReason: options.protectedReason || ""
  };
}

function planFile(plan, id) {
  const file = plan.files.find(entry => entry.id === id || entry.fileName === id);
  assert.ok(file, `missing planned file ${id}`);
  return file;
}

function highByteLimits() {
  return {
    storyByteLimit: Number.MAX_SAFE_INTEGER,
    totalByteLimit: Number.MAX_SAFE_INTEGER
  };
}

function policy(overrides = {}) {
  return {
    newestCount: 0,
    dailyDays: 0,
    weeklyWeeks: 0,
    monthlyMonths: 0,
    safetyNewestCount: 0,
    ...highByteLimits(),
    ...overrides
  };
}

function assertAction(plan, id, action, reason = null) {
  const file = planFile(plan, id);
  assert.equal(file.action, action, `${id} should be ${action}`);
  if (reason !== null) assert.equal(file.reason, reason, `${id} should have reason ${reason}`);
}

let archiveFixtureSequence = 0;

function createCompletedArchiveRun(rootFolderPath, options = {}) {
  archiveFixtureSequence += 1;
  const runKey = options.runKey || `expiry-${archiveFixtureSequence}`;
  const fileCount = options.fileCount ?? 1;
  const written = Array.from({ length: fileCount }, (_unused, index) => {
    const capturedAt = new Date(
      Date.parse("2026-07-31T12:00:00.000Z") - ((archiveFixtureSequence + index) * 60_000)
    ).toISOString();
    return writeJsonBackup(
      rootFolderPath,
      `${runKey}-${index}.version-history.json`,
      historyPayload({
        storyId: `story-${runKey}`,
        sourceFileName: `${runKey}.txt`,
        sourceFilePath: path.join(dataDir, "stories", `${runKey}.txt`),
        entryId: `${runKey}-${index}`,
        content: `${runKey} archive content ${index}`,
        updatedAt: capturedAt
      }),
      capturedAt
    );
  });
  const plan = server.previewVersionHistoryBackupRetention({
    rootFolderPath,
    now: "2026-07-31T12:00:00.000Z",
    policy: policy()
  });
  assert.equal(plan.summary.archiveFileCount, fileCount);
  const result = server.archiveVersionHistoryBackupRetentionPlan(plan, {
    rootFolderPath
  });
  assert.equal(result.ok, true);
  assert.equal(result.status, "complete");
  assert.equal(result.archivedFileCount, fileCount);
  const manifest = readJsonFile(result.manifestPath);
  return {
    written,
    plan,
    result,
    manifest,
    folderPath: result.archiveFolderPath,
    folderName: path.basename(result.archiveFolderPath),
    manifestPath: result.manifestPath,
    planPath: result.planPath,
    journalPath: result.journalPath
  };
}

function runWithoutDeletePrimitives(operation, label = "retention moves") {
  const methods = ["unlinkSync", "rmSync", "rmdirSync"];
  const originals = new Map(methods.map(method => [method, fs[method]]));
  const calls = [];
  let result;
  let operationError = null;

  methods.forEach(method => {
    fs[method] = (...args) => {
      calls.push({
        method,
        filePath: path.resolve(String(args[0]))
      });
      const error = new Error(`Expiry move called fs.${method}.`);
      error.code = "VERSION_HISTORY_EXPIRY_DELETE_PRIMITIVE";
      throw error;
    };
  });

  try {
    result = operation();
  } catch (error) {
    operationError = error;
  } finally {
    originals.forEach((original, method) => {
      fs[method] = original;
    });
  }

  assert.deepEqual(
    calls,
    [],
    `${label} must not call a delete primitive`
  );
  if (operationError) throw operationError;
  return result;
}

try {
  assert.equal(typeof t.scanVersionHistoryBackupRetention, "function");
  assert.equal(typeof t.buildVersionHistoryBackupRetentionPlan, "function");
  assert.equal(typeof server.previewVersionHistoryBackupRetention, "function");
  assert.equal(typeof server.archiveVersionHistoryBackupRetentionPlan, "function");
  assert.equal(typeof server.previewVersionHistoryArchiveExpiry, "function");
  assert.equal(
    typeof server.moveExpiredVersionHistoryArchiveRunsToManualDeletion,
    "function"
  );
  assert.equal(
    typeof server.moveVersionHistoryRetentionArchivesFromPlanId,
    "function"
  );
  assert.equal(typeof server.versionHistoryArchiveReadyStatus, "function");

  const identityRoot = path.join(dataDir, "identity-root");
  const sameSizeA = writeJsonBackup(
    identityRoot,
    "same-size-a.version-history.json",
    historyPayload({ entryId: "same-size", content: "Alpha" }),
    "2026-07-31T11:00:00.000Z"
  );
  const sameSizeB = writeJsonBackup(
    identityRoot,
    "same-size-b.version-history.json",
    historyPayload({ entryId: "same-size", content: "Bravo" }),
    "2026-07-31T11:01:00.000Z"
  );
  assert.equal(
    Buffer.byteLength(sameSizeA.content),
    Buffer.byteLength(sameSizeB.content),
    "the equal-size fixture must exercise different bytes with the same byte count"
  );
  assert.notEqual(sameSizeA.hash, sameSizeB.hash);

  const exactCopyPath = path.join(
    backupFolder(identityRoot),
    "same-size-exact-copy.version-history.json"
  );
  fs.copyFileSync(sameSizeA.filePath, exactCopyPath);
  fs.utimesSync(
    exactCopyPath,
    new Date("2026-07-31T11:02:00.000Z"),
    new Date("2026-07-31T11:02:00.000Z")
  );

  const metadataPayload = historyPayload({
    entryId: "metadata-version",
    content: "Metadata",
    updatedAt: "2026-07-30T10:00:00.000Z"
  });
  metadataPayload.drafts[0].history[0].createdAt = "2026-07-29T08:00:00.000Z";
  const metadataChangedPayload = JSON.parse(JSON.stringify(metadataPayload));
  metadataChangedPayload.updatedAt = "2026-07-31T10:00:00.000Z";
  metadataChangedPayload.projectUpdatedAt = "2026-07-31T09:59:00.000Z";
  writeJsonBackup(
    identityRoot,
    "metadata-a.version-history.json",
    metadataPayload,
    "2026-07-31T10:00:00.000Z"
  );
  writeJsonBackup(
    identityRoot,
    "metadata-b.version-history.json",
    metadataChangedPayload,
    "2026-07-31T10:01:00.000Z"
  );

  const identityPayloadA = historyPayload({
    entryId: "identity-a",
    content: "Identity"
  });
  const identityPayloadB = JSON.parse(JSON.stringify(identityPayloadA));
  identityPayloadB.drafts[0].history[0].id = "identity-b";
  writeJsonBackup(
    identityRoot,
    "identity-a.version-history.json",
    identityPayloadA,
    "2026-07-31T09:00:00.000Z"
  );
  writeJsonBackup(
    identityRoot,
    "identity-b.version-history.json",
    identityPayloadB,
    "2026-07-31T09:01:00.000Z"
  );
  writeJsonBackup(
    identityRoot,
    "story.1999-01-01T00-00-00-000Z.abcdef.version-history.json",
    historyPayload({ entryId: "timestamp-in-source-name", content: "Timestamp name" }),
    "2026-07-31T08:00:00.000Z"
  );

  const scan = t.scanVersionHistoryBackupRetention({ rootFolderPath: identityRoot });
  const scannedByName = new Map(scan.records.map(record => [record.fileName, record]));
  const scannedSameSizeA = scannedByName.get("same-size-a.version-history.json");
  const scannedSameSizeB = scannedByName.get("same-size-b.version-history.json");
  const scannedExactCopy = scannedByName.get("same-size-exact-copy.version-history.json");
  assert.equal(scannedSameSizeA.size, scannedSameSizeB.size);
  assert.notEqual(
    scannedSameSizeA.rawHash,
    scannedSameSizeB.rawHash,
    "equal byte counts must not establish identity"
  );
  assert.notEqual(scannedSameSizeA.stableHash, scannedSameSizeB.stableHash);
  assert.equal(scannedSameSizeA.rawHash, scannedExactCopy.rawHash);
  assert.equal(scannedSameSizeA.stableHash, scannedExactCopy.stableHash);
  assert.equal(
    scannedByName.get("metadata-a.version-history.json").stableHash,
    scannedByName.get("metadata-b.version-history.json").stableHash,
    "volatile top-level timestamps should not make otherwise identical histories unique"
  );
  assert.notEqual(
    scannedByName.get("metadata-a.version-history.json").rawHash,
    scannedByName.get("metadata-b.version-history.json").rawHash
  );
  assert.notEqual(
    scannedByName.get("identity-a.version-history.json").stableHash,
    scannedByName.get("identity-b.version-history.json").stableHash,
    "saved version IDs are part of stable identity"
  );
  assert.equal(
    scannedByName.get(
      "story.1999-01-01T00-00-00-000Z.abcdef.version-history.json"
    ).capturedAtMs,
    Date.parse("2026-07-31T08:00:00.000Z"),
    "timestamps inside a source base name must not override the backup file mtime"
  );

  const identityPlan = t.buildVersionHistoryBackupRetentionPlan(scan.records, {
    now: "2026-07-31T12:00:00.000Z",
    policy: policy({ newestCount: 100 })
  });
  assert.equal(identityPlan.summary.sameSizeCandidateGroupCount > 0, true);
  assert.equal(identityPlan.summary.exactDuplicateFileCount, 1);
  assert.equal(identityPlan.summary.metadataOnlyDuplicateFileCount, 1);
  assertAction(identityPlan, "same-size-a.version-history.json", "archive", "exact-duplicate");
  assertAction(identityPlan, "same-size-exact-copy.version-history.json", "keep");
  assertAction(identityPlan, "same-size-b.version-history.json", "keep");
  assertAction(identityPlan, "metadata-a.version-history.json", "archive", "stable-content-duplicate");
  assertAction(identityPlan, "metadata-b.version-history.json", "keep");
  assertAction(identityPlan, "identity-a.version-history.json", "keep");
  assertAction(identityPlan, "identity-b.version-history.json", "keep");

  const groupingRoot = path.join(dataDir, "grouping-root");
  writeJsonBackup(groupingRoot, "story-id-a.version-history.json", historyPayload({
    storyId: "shared-story",
    sourceFileName: "before.txt",
    sourceFilePath: "C:\\Writing\\before.txt",
    entryId: "story-id-a"
  }));
  writeJsonBackup(groupingRoot, "story-id-b.version-history.json", historyPayload({
    storyId: "shared-story",
    sourceFileName: "after.txt",
    sourceFilePath: "D:\\Moved\\after.txt",
    entryId: "story-id-b"
  }));
  writeJsonBackup(groupingRoot, "path-a.version-history.json", historyPayload({
    storyId: "",
    sourceFileName: "path-a.txt",
    sourceFilePath: "C:\\Writing\\same-path.txt",
    entryId: "path-a"
  }));
  writeJsonBackup(groupingRoot, "path-b.version-history.json", historyPayload({
    storyId: "",
    sourceFileName: "path-b.txt",
    sourceFilePath: "C:\\Writing\\same-path.txt",
    entryId: "path-b"
  }));
  writeJsonBackup(groupingRoot, "name-a.version-history.json", historyPayload({
    storyId: "",
    sourceFileName: "Legacy.TXT",
    sourceFilePath: "",
    entryId: "name-a"
  }));
  writeJsonBackup(groupingRoot, "name-b.version-history.json", historyPayload({
    storyId: "",
    sourceFileName: "legacy.txt",
    sourceFilePath: "",
    entryId: "name-b"
  }));
  writeJsonBackup(groupingRoot, "other-story.version-history.json", historyPayload({
    storyId: "other-story",
    sourceFileName: "before.txt",
    sourceFilePath: "C:\\Writing\\before.txt",
    entryId: "other-story"
  }));
  writeJsonBackup(groupingRoot, "modern-path.version-history.json", historyPayload({
    storyId: "modern-story",
    sourceFileName: "modern.txt",
    sourceFilePath: "C:\\Writing\\modern.txt",
    entryId: "modern-path"
  }));
  writeJsonBackup(groupingRoot, "legacy-modern-path.version-history.json", historyPayload({
    storyId: "",
    sourceFileName: "modern.txt",
    sourceFilePath: "C:\\Writing\\modern.txt",
    entryId: "legacy-modern-path"
  }));
  const groupingScan = t.scanVersionHistoryBackupRetention({ rootFolderPath: groupingRoot });
  const groupingByName = new Map(groupingScan.records.map(record => [record.fileName, record]));
  assert.equal(
    groupingByName.get("story-id-a.version-history.json").storyKey,
    groupingByName.get("story-id-b.version-history.json").storyKey,
    "storyId should survive file renames and moves"
  );
  assert.equal(
    groupingByName.get("path-a.version-history.json").storyKey,
    groupingByName.get("path-b.version-history.json").storyKey,
    "source path should group legacy histories without story IDs"
  );
  assert.equal(
    groupingByName.get("name-a.version-history.json").storyKey,
    groupingByName.get("name-b.version-history.json").storyKey,
    "source name should group legacy histories without IDs or paths"
  );
  assert.notEqual(
    groupingByName.get("story-id-a.version-history.json").storyKey,
    groupingByName.get("path-a.version-history.json").storyKey
  );
  assert.notEqual(
    groupingByName.get("story-id-a.version-history.json").storyKey,
    groupingByName.get("other-story.version-history.json").storyKey,
    "different story IDs must remain separate even when source paths and names match"
  );
  assert.equal(
    groupingByName.get("modern-path.version-history.json").storyKey,
    groupingByName.get("legacy-modern-path.version-history.json").storyKey,
    "legacy records should join a unique embedded story ID at the same source path"
  );

  const fixedNow = "2026-07-31T12:00:00.000Z";
  const newestRecords = Array.from({ length: 6 }, (_unused, index) => syntheticRecord(
    `newest-${index}`,
    new Date(Date.parse(fixedNow) - (index * 60 * 60 * 1000)).toISOString()
  ));
  const newestPlan = t.buildVersionHistoryBackupRetentionPlan(newestRecords, {
    now: fixedNow,
    policy: policy({ newestCount: 5, safetyNewestCount: 2 })
  });
  newestRecords.slice(0, 5).forEach(record => assertAction(newestPlan, record.id, "keep"));
  assertAction(newestPlan, newestRecords[5].id, "archive", "outside-retention-window");

  const dailyRecords = Array.from({ length: 8 }, (_unused, index) => syntheticRecord(
    `daily-${index}`,
    new Date(Date.UTC(2026, 6, 31 - index, 10)).toISOString()
  ));
  const dailyPlan = t.buildVersionHistoryBackupRetentionPlan(dailyRecords, {
    now: fixedNow,
    policy: policy({ dailyDays: 7 })
  });
  dailyRecords.slice(0, 7).forEach(record => {
    assertAction(dailyPlan, record.id, "keep");
    assert.equal(planFile(dailyPlan, record.id).keepReasons.includes("daily"), true);
  });
  assertAction(dailyPlan, dailyRecords[7].id, "archive", "outside-retention-window");

  const weeklyRecords = Array.from({ length: 9 }, (_unused, index) => syntheticRecord(
    `weekly-${index}`,
    new Date(Date.UTC(2026, 6, 29 - (index * 7), 10)).toISOString()
  ));
  const weeklyPlan = t.buildVersionHistoryBackupRetentionPlan(weeklyRecords, {
    now: fixedNow,
    policy: policy({ weeklyWeeks: 8 })
  });
  weeklyRecords.slice(0, 8).forEach(record => {
    assertAction(weeklyPlan, record.id, "keep");
    assert.equal(planFile(weeklyPlan, record.id).keepReasons.includes("weekly"), true);
  });
  assertAction(weeklyPlan, weeklyRecords[8].id, "archive", "outside-retention-window");

  const monthlyRecords = Array.from({ length: 13 }, (_unused, index) => syntheticRecord(
    `monthly-${index}`,
    new Date(Date.UTC(2026, 6 - index, 15, 10)).toISOString()
  ));
  const monthlyPlan = t.buildVersionHistoryBackupRetentionPlan(monthlyRecords, {
    now: fixedNow,
    policy: policy({ monthlyMonths: 12 })
  });
  monthlyRecords.slice(0, 12).forEach(record => {
    assertAction(monthlyPlan, record.id, "keep");
    assert.equal(planFile(monthlyPlan, record.id).keepReasons.includes("monthly"), true);
  });
  assertAction(monthlyPlan, monthlyRecords[12].id, "archive", "outside-retention-window");

  const defaultPolicyPlan = t.buildVersionHistoryBackupRetentionPlan([], { now: fixedNow });
  assert.deepEqual(defaultPolicyPlan.policy, {
    newestCount: 5,
    dailyDays: 7,
    weeklyWeeks: 8,
    monthlyMonths: 12,
    safetyNewestCount: 2,
    storyByteLimit: 512 * 1024 * 1024,
    totalByteLimit: 2 * 1024 * 1024 * 1024
  });

  const newestMetadataPlan = t.buildVersionHistoryBackupRetentionPlan([
    syntheticRecord("metadata-old", "2026-07-30T12:00:00.000Z", {
      storyKey: "story:metadata",
      storyLabel: "Old name.txt",
      sourceFileName: "Old name.txt",
      sourceFilePath: "C:\\Writing\\Old name.txt"
    }),
    syntheticRecord("metadata-new", "2026-07-31T12:00:00.000Z", {
      storyKey: "story:metadata",
      storyLabel: "New name.txt",
      sourceFileName: "New name.txt",
      sourceFilePath: "D:\\Moved\\New name.txt"
    })
  ], {
    now: fixedNow,
    policy: policy({ newestCount: 2 })
  });
  assert.equal(newestMetadataPlan.stories[0].label, "New name.txt");
  assert.equal(newestMetadataPlan.stories[0].sourceFilePath, "D:\\Moved\\New name.txt");

  const capRecords = Array.from({ length: 4 }, (_unused, index) => syntheticRecord(
    `cap-${index}`,
    new Date(Date.parse(fixedNow) - (index * 60 * 60 * 1000)).toISOString(),
    { size: 30 }
  ));
  const capPlan = t.buildVersionHistoryBackupRetentionPlan(capRecords, {
    now: fixedNow,
    policy: policy({
      newestCount: 4,
      safetyNewestCount: 2,
      storyByteLimit: 40,
      totalByteLimit: 40
    })
  });
  assertAction(capPlan, "cap-0", "keep");
  assertAction(capPlan, "cap-1", "keep");
  assert.equal(planFile(capPlan, "cap-0").safetyProtected, true);
  assert.equal(planFile(capPlan, "cap-1").safetyProtected, true);
  assertAction(capPlan, "cap-2", "archive");
  assertAction(capPlan, "cap-3", "archive");
  assert.equal(capPlan.summary.capExceededUnavoidable, true);
  assert.equal(capPlan.warnings.some(warning => warning.type === "story-byte-limit"), true);
  assert.equal(capPlan.warnings.some(warning => warning.type === "total-byte-limit"), true);

  const globalCapRecords = [
    syntheticRecord("global-a-0", fixedNow, { storyKey: "story:global-a", size: 30 }),
    syntheticRecord("global-a-1", "2026-07-31T11:00:00.000Z", {
      storyKey: "story:global-a",
      size: 30
    }),
    syntheticRecord("global-b-0", fixedNow, { storyKey: "story:global-b", size: 30 }),
    syntheticRecord("global-b-1", "2026-07-31T11:00:00.000Z", {
      storyKey: "story:global-b",
      size: 30
    })
  ];
  const globalCapPlan = t.buildVersionHistoryBackupRetentionPlan(globalCapRecords, {
    now: fixedNow,
    policy: policy({
      newestCount: 2,
      safetyNewestCount: 2,
      totalByteLimit: 50
    })
  });
  globalCapRecords.forEach(record => {
    assertAction(globalCapPlan, record.id, "keep");
    assert.equal(planFile(globalCapPlan, record.id).safetyProtected, true);
  });
  assert.equal(
    globalCapPlan.warnings.some(warning => warning.type === "total-byte-limit"),
    true,
    "the total cap should become a soft warning when every story's newest two exceed it"
  );

  const protectedRoot = path.join(dataDir, "protected-root");
  writeRawBackup(
    protectedRoot,
    "malformed.version-history.json",
    Buffer.from('{"version":1,"drafts":\n', "utf8")
  );
  writeJsonBackup(protectedRoot, "future.version-history.json", historyPayload({
    version: 2,
    entryId: "future"
  }));
  writeRawBackup(
    protectedRoot,
    "wrong-shape.version-history.json",
    Buffer.from('{"version":1,"sourceFileName":"wrong-shape.txt","drafts":[]}\n', "utf8")
  );
  const pinnedPayload = historyPayload({ entryId: "pinned" });
  pinnedPayload.retention = { pinned: true };
  writeJsonBackup(protectedRoot, "pinned.version-history.json", pinnedPayload);
  const protectedScan = t.scanVersionHistoryBackupRetention({ rootFolderPath: protectedRoot });
  const protectedPlan = t.buildVersionHistoryBackupRetentionPlan(protectedScan.records, {
    now: fixedNow,
    policy: policy({ storyByteLimit: 0, totalByteLimit: 0 })
  });
  assertAction(protectedPlan, "malformed.version-history.json", "keep", "malformed");
  assertAction(protectedPlan, "wrong-shape.version-history.json", "keep", "malformed");
  assertAction(protectedPlan, "future.version-history.json", "keep", "future-schema");
  assertAction(protectedPlan, "pinned.version-history.json", "keep", "pinned");
  assert.equal(protectedPlan.summary.protectedFileCount, 4);
  assert.equal(protectedPlan.summary.malformedFileCount, 2);
  assert.equal(protectedPlan.summary.futureSchemaFileCount, 1);
  assert.equal(protectedPlan.summary.pinnedFileCount, 1);

  const previewRoot = path.join(dataDir, "preview-root");
  Array.from({ length: 6 }, (_unused, index) => writeJsonBackup(
    previewRoot,
    `preview-${index}.version-history.json`,
    historyPayload({
      entryId: `preview-${index}`,
      content: `Preview ${index}`,
      updatedAt: new Date(Date.parse(fixedNow) - (index * 60 * 60 * 1000)).toISOString()
    }),
    new Date(Date.parse(fixedNow) - (index * 60 * 60 * 1000)).toISOString()
  ));
  const previewBefore = snapshotDirectory(backupFolder(previewRoot));
  const preview = server.previewVersionHistoryBackupRetention({
    rootFolderPath: previewRoot,
    now: fixedNow,
    policy: policy({ newestCount: 1 })
  });
  assert.deepEqual(
    snapshotDirectory(backupFolder(previewRoot)),
    previewBefore,
    "preview must not alter active backups"
  );
  assert.equal(fs.existsSync(preview.archiveFolderPath), false);
  assert.equal(preview.summary.archiveFileCount, 5);

  const staleFile = preview.files.find(file => file.action === "archive");
  assert.ok(staleFile);
  const staleOriginal = fs.readFileSync(staleFile.filePath, "utf8");
  const staleChanged = staleOriginal.replaceAll("Preview", "Changed");
  assert.equal(Buffer.byteLength(staleChanged), Buffer.byteLength(staleOriginal));
  fs.writeFileSync(staleFile.filePath, staleChanged, "utf8");
  fs.utimesSync(staleFile.filePath, new Date(staleFile.mtimeMs), new Date(staleFile.mtimeMs));
  assert.equal(fs.statSync(staleFile.filePath).size, staleFile.size);
  assert.throws(
    () => server.archiveVersionHistoryBackupRetentionPlan(preview, {
      rootFolderPath: previewRoot
    }),
    error => error?.code === "VERSION_HISTORY_RETENTION_STALE",
    "same-size content changes after preview must invalidate archival"
  );
  assert.equal(fs.existsSync(preview.archiveFolderPath), false);
  assert.equal(snapshotDirectory(backupFolder(previewRoot)).length, previewBefore.length);

  const keeperRoot = path.join(dataDir, "keeper-stale-root");
  Array.from({ length: 3 }, (_unused, index) => writeJsonBackup(
    keeperRoot,
    `keeper-${index}.version-history.json`,
    historyPayload({
      entryId: `keeper-${index}`,
      content: `Keeper ${index}`,
      updatedAt: new Date(Date.parse(fixedNow) - (index * 60 * 60 * 1000)).toISOString()
    }),
    new Date(Date.parse(fixedNow) - (index * 60 * 60 * 1000)).toISOString()
  ));
  const keeperPlan = server.previewVersionHistoryBackupRetention({
    rootFolderPath: keeperRoot,
    now: fixedNow,
    policy: policy({ newestCount: 1, safetyNewestCount: 1 })
  });
  const newestKeeper = keeperPlan.files.find(file => file.action === "keep");
  assert.ok(newestKeeper);
  const keeperOriginal = fs.readFileSync(newestKeeper.filePath, "utf8");
  const keeperChanged = keeperOriginal.replaceAll("Keeper", "Broken");
  assert.equal(Buffer.byteLength(keeperChanged), Buffer.byteLength(keeperOriginal));
  fs.writeFileSync(newestKeeper.filePath, keeperChanged, "utf8");
  fs.utimesSync(
    newestKeeper.filePath,
    new Date(newestKeeper.mtimeMs),
    new Date(newestKeeper.mtimeMs)
  );
  assert.throws(
    () => server.archiveVersionHistoryBackupRetentionPlan(keeperPlan, {
      rootFolderPath: keeperRoot
    }),
    error => error?.code === "VERSION_HISTORY_RETENTION_STALE",
    "a same-size change to a planned keeper must stop archival before older backups move"
  );
  assert.equal(fs.existsSync(keeperPlan.archiveFolderPath), false);
  assert.equal(snapshotDirectory(backupFolder(keeperRoot)).length, 3);

  const archiveRoot = path.join(dataDir, "archive-root");
  const archiveFixtures = Array.from({ length: 6 }, (_unused, index) => writeJsonBackup(
    archiveRoot,
    `archive-${index}.version-history.json`,
    historyPayload({
      entryId: `archive-${index}`,
      content: `Archive ${index}`,
      updatedAt: new Date(Date.parse(fixedNow) - (index * 60 * 60 * 1000)).toISOString()
    }),
    new Date(Date.parse(fixedNow) - (index * 60 * 60 * 1000)).toISOString()
  ));
  const archivePlan = server.previewVersionHistoryBackupRetention({
    rootFolderPath: archiveRoot,
    now: fixedNow,
    policy: policy({ newestCount: 1 })
  });
  const expectedArchived = archivePlan.files.filter(file => file.action === "archive");
  const expectedKept = archivePlan.files.filter(file => file.action === "keep");
  const archiveResult = runWithoutDeletePrimitives(
    () => server.archiveVersionHistoryBackupRetentionPlan(archivePlan, {
      rootFolderPath: archiveRoot
    }),
    "moving backups into the retention archive"
  );
  assert.equal(archiveResult.ok, true);
  assert.equal(archiveResult.status, "complete");
  assert.equal(archiveResult.archivedFileCount, expectedArchived.length);
  assert.equal(archiveResult.failedFileCount, 0);
  assert.equal(fs.existsSync(archiveResult.planPath), true);
  assert.equal(fs.existsSync(archiveResult.journalPath), true);
  assert.equal(fs.existsSync(archiveResult.manifestPath), true);
  expectedArchived.forEach(file => {
    const archivedPath = path.join(archiveResult.archiveFolderPath, file.fileName);
    assert.equal(fs.existsSync(file.filePath), false);
    assert.equal(fs.existsSync(archivedPath), true);
    assert.equal(sha256(fs.readFileSync(archivedPath)), file.rawHash);
  });
  expectedKept.forEach(file => assert.equal(fs.existsSync(file.filePath), true));
  const manifest = JSON.parse(fs.readFileSync(archiveResult.manifestPath, "utf8"));
  assert.equal(manifest.version, 1);
  assert.equal(manifest.status, "complete");
  assert.equal(manifest.planId, archivePlan.planId);
  assert.equal(manifest.planFingerprint, archivePlan.fingerprint);
  assert.equal(manifest.archivePlanPath, archiveResult.planPath);
  assert.equal(manifest.archiveJournalPath, archiveResult.journalPath);
  assert.equal(manifest.files.length, expectedArchived.length);
  manifest.files.forEach(file => {
    assert.equal(file.status, "archived");
    assert.equal(file.size > 0, true);
    assert.match(file.rawHash, /^[a-f0-9]{64}$/u);
    assert.equal(sha256(fs.readFileSync(file.archivePath)), file.rawHash);
  });
  const journal = fs.readFileSync(archiveResult.journalPath, "utf8")
    .trim()
    .split(/\r?\n/u)
    .filter(Boolean)
    .map(line => JSON.parse(line));
  assert.equal(
    journal.filter(event => event.status === "move-verified").length,
    expectedArchived.length
  );
  assert.equal(
    journal.filter(event => event.status === "archived").length,
    expectedArchived.length
  );
  assert.equal(
    archiveResult.archivedBytes,
    expectedArchived.reduce((sum, file) => sum + file.size, 0)
  );
  assert.equal(
    archiveFixtures.some(file => fs.existsSync(file.filePath)),
    true,
    "at least the retained newest backup should remain active"
  );

  const collisionRoot = path.join(dataDir, "collision-root");
  Array.from({ length: 2 }, (_unused, index) => writeJsonBackup(
    collisionRoot,
    `collision-${index}.version-history.json`,
    historyPayload({
      entryId: `collision-${index}`,
      content: `Collision ${index}`,
      updatedAt: new Date(Date.parse(fixedNow) - (index * 60 * 60 * 1000)).toISOString()
    }),
    new Date(Date.parse(fixedNow) - (index * 60 * 60 * 1000)).toISOString()
  ));
  const collisionPlan = server.previewVersionHistoryBackupRetention({
    rootFolderPath: collisionRoot,
    now: fixedNow,
    policy: policy({ newestCount: 1 })
  });
  fs.mkdirSync(collisionPlan.archiveFolderPath, { recursive: true });
  const sentinelPath = path.join(collisionPlan.archiveFolderPath, "existing.txt");
  fs.writeFileSync(sentinelPath, "do not overwrite", "utf8");
  assert.throws(
    () => server.archiveVersionHistoryBackupRetentionPlan(collisionPlan, {
      rootFolderPath: collisionRoot
    }),
    error => error?.code === "VERSION_HISTORY_RETENTION_ARCHIVE_EXISTS"
  );
  assert.equal(fs.readFileSync(sentinelPath, "utf8"), "do not overwrite");
  assert.equal(
    snapshotDirectory(backupFolder(collisionRoot)).length,
    2,
    "a destination collision must leave every source backup active"
  );

  const dayMs = 24 * 60 * 60 * 1000;
  const emptyExpiryRoot = path.join(dataDir, "archive-expiry-empty-root");
  fs.mkdirSync(emptyExpiryRoot, { recursive: true });
  const emptyExpiryPreview = server.previewVersionHistoryArchiveExpiry({
    rootFolderPath: emptyExpiryRoot,
    now: fixedNow
  });
  assert.equal(emptyExpiryPreview.movableRunCount, 0);
  assert.equal(emptyExpiryPreview.movableBytes, 0);
  const emptyExpiryResult = runWithoutDeletePrimitives(
    () => server.moveExpiredVersionHistoryArchiveRunsToManualDeletion(
      emptyExpiryPreview,
      {
        rootFolderPath: emptyExpiryRoot,
        now: emptyExpiryPreview.generatedAt
      }
    )
  );
  assert.equal(emptyExpiryResult.status, "no-op");
  assert.equal(emptyExpiryResult.movedRunCount, 0);
  assert.equal(emptyExpiryResult.movedBytes, 0);
  assert.equal(fs.existsSync(archiveFolder(emptyExpiryRoot)), false);
  assert.deepEqual(
    server.versionHistoryArchiveReadyStatus({ rootFolderPath: emptyExpiryRoot }),
    {
      ready: false,
      unsafe: false,
      itemCount: 0,
      runCount: 0,
      bytes: 0,
      folderPath: readyForManualDeletionFolder(emptyExpiryRoot),
      runs: [],
      unrecognizedItemCount: 0,
      unsafeItemCount: 0
    }
  );

  const expiryPolicyRoot = path.join(dataDir, "archive-expiry-policy-root");
  const firstExpiryRun = createCompletedArchiveRun(expiryPolicyRoot, {
    runKey: "first-expiry-run",
    fileCount: 2
  });
  const firstRetention = firstExpiryRun.manifest.archiveRetention;
  assert.equal(firstRetention.version, 1);
  assert.equal(firstRetention.days, 90);
  assert.equal(firstRetention.firstCompletedRunName, firstExpiryRun.folderName);
  assert.equal(
    Date.parse(firstRetention.expiresAt)
      - Date.parse(firstExpiryRun.manifest.archiveCompletedAt),
    90 * dayMs,
    "the first completed archive run should receive exactly 90 days"
  );
  const policyStatePath = path.join(
    archiveFolder(expiryPolicyRoot),
    "retention-archive-policy.json"
  );
  assert.equal(fs.existsSync(policyStatePath), true);
  const firstPolicyState = readJsonFile(policyStatePath);
  assert.equal(firstPolicyState.version, 1);
  assert.equal(firstPolicyState.firstCompletedRunName, firstExpiryRun.folderName);
  assert.equal(firstPolicyState.firstCompletedPlanId, firstExpiryRun.plan.planId);

  const firstBeforeExpiry = server.previewVersionHistoryArchiveExpiry({
    rootFolderPath: expiryPolicyRoot,
    now: new Date(Date.parse(firstRetention.expiresAt) - 1).toISOString()
  });
  const firstBeforeRun = firstBeforeExpiry.runs.find(
    run => run.folderName === firstExpiryRun.folderName
  );
  assert.ok(firstBeforeRun);
  assert.equal(firstBeforeRun.retentionDays, 90);
  assert.equal(firstBeforeRun.expired, false);
  assert.equal(firstBeforeRun.movableToManualDeletion, false);
  assert.equal(firstBeforeExpiry.managedRunCount, 1);
  assert.equal(firstBeforeExpiry.retainedRunCount, 1);
  assert.equal(firstBeforeExpiry.movableRunCount, 0);
  assert.equal(firstBeforeExpiry.movableBytes, 0);

  const firstAtExpiry = server.previewVersionHistoryArchiveExpiry({
    rootFolderPath: expiryPolicyRoot,
    now: firstRetention.expiresAt
  });
  const firstAtExpiryRun = firstAtExpiry.runs.find(
    run => run.folderName === firstExpiryRun.folderName
  );
  assert.ok(firstAtExpiryRun);
  assert.equal(firstAtExpiryRun.expired, true);
  assert.equal(firstAtExpiryRun.movableToManualDeletion, true);
  assert.equal(firstAtExpiryRun.fileCount, 2);
  assert.equal(firstAtExpiryRun.bytes, firstExpiryRun.result.archivedBytes);
  assert.equal(firstAtExpiry.movableRunCount, 1);
  assert.equal(firstAtExpiry.movableBytes, firstExpiryRun.result.archivedBytes);

  const firstRunSnapshot = snapshotDirectory(firstExpiryRun.folderPath);
  const firstReadyFolder = readyForManualDeletionFolder(expiryPolicyRoot);
  const firstReadyRunPath = path.join(firstReadyFolder, firstExpiryRun.folderName);
  const originalRenameSync = fs.renameSync;
  const observedRunRenames = [];
  fs.renameSync = (sourcePath, destinationPath) => {
    if (path.resolve(sourcePath) === path.resolve(firstExpiryRun.folderPath)) {
      observedRunRenames.push([
        path.resolve(sourcePath),
        path.resolve(destinationPath)
      ]);
    }
    return originalRenameSync(sourcePath, destinationPath);
  };
  let firstMoveResult;
  try {
    firstMoveResult = runWithoutDeletePrimitives(
      () => server.moveExpiredVersionHistoryArchiveRunsToManualDeletion(
        firstAtExpiry,
        {
          rootFolderPath: expiryPolicyRoot,
          now: firstAtExpiry.generatedAt
        }
      )
    );
  } finally {
    fs.renameSync = originalRenameSync;
  }
  assert.equal(firstMoveResult.ok, true);
  assert.equal(firstMoveResult.status, "complete");
  assert.equal(firstMoveResult.movedRunCount, 1);
  assert.equal(firstMoveResult.movedBytes, firstExpiryRun.result.archivedBytes);
  assert.equal(firstMoveResult.failedRunCount, 0);
  assert.deepEqual(firstMoveResult.failures, []);
  assert.equal(firstMoveResult.readyForManualDeletionFolderPath, firstReadyFolder);
  assert.deepEqual(
    observedRunRenames,
    [[path.resolve(firstExpiryRun.folderPath), path.resolve(firstReadyRunPath)]],
    "the complete archive directory should move in one rename"
  );
  assert.equal(fs.existsSync(firstExpiryRun.folderPath), false);
  assert.equal(fs.existsSync(firstReadyRunPath), true);
  assert.deepEqual(snapshotDirectory(firstReadyRunPath), firstRunSnapshot);
  assert.equal(fs.existsSync(firstMoveResult.moveJournalPath), true);
  const firstMoveJournal = fs.readFileSync(firstMoveResult.moveJournalPath, "utf8")
    .trim()
    .split(/\r?\n/u)
    .filter(Boolean)
    .map(line => JSON.parse(line));
  assert.deepEqual(
    firstMoveJournal.map(entry => entry.status),
    [
      "move-plan-started",
      "moving-to-manual-deletion",
      "ready-for-manual-deletion"
    ]
  );
  assert.equal(firstMoveJournal[0].planId, firstAtExpiry.planId);
  assert.equal(firstMoveJournal[1].folderName, firstExpiryRun.folderName);
  assert.equal(firstMoveJournal[2].bytes, firstExpiryRun.result.archivedBytes);
  assert.equal(fs.existsSync(policyStatePath), true);
  assert.deepEqual(
    readJsonFile(policyStatePath),
    firstPolicyState,
    "moving the first run must retain the durable first-run policy record"
  );

  const readyStatus = server.versionHistoryArchiveReadyStatus({
    rootFolderPath: expiryPolicyRoot
  });
  assert.equal(readyStatus.ready, true);
  assert.equal(readyStatus.unsafe, false);
  assert.equal(readyStatus.itemCount, 1);
  assert.equal(readyStatus.runCount, 1);
  assert.equal(readyStatus.bytes, firstExpiryRun.result.archivedBytes);
  assert.equal(readyStatus.folderPath, firstReadyFolder);
  assert.deepEqual(readyStatus.runs, [{
    folderName: firstExpiryRun.folderName,
    folderPath: firstReadyRunPath,
    fileCount: 2,
    bytes: firstExpiryRun.result.archivedBytes
  }]);
  assert.equal(readyStatus.unrecognizedItemCount, 0);

  const previewAfterMove = server.previewVersionHistoryArchiveExpiry({
    rootFolderPath: expiryPolicyRoot,
    now: firstRetention.expiresAt
  });
  assert.equal(previewAfterMove.managedRunCount, 0);
  assert.equal(previewAfterMove.movableRunCount, 0);
  assert.equal(previewAfterMove.movableBytes, 0);
  assert.equal(previewAfterMove.readyForManualDeletionRunCount, 1);
  assert.equal(
    previewAfterMove.readyForManualDeletionBytes,
    firstExpiryRun.result.archivedBytes
  );

  const secondExpiryRun = createCompletedArchiveRun(expiryPolicyRoot, {
    runKey: "second-expiry-run"
  });
  const secondRetention = secondExpiryRun.manifest.archiveRetention;
  assert.equal(secondRetention.days, 30);
  assert.equal(secondRetention.firstCompletedRunName, firstExpiryRun.folderName);
  assert.equal(
    Date.parse(secondRetention.expiresAt)
      - Date.parse(secondExpiryRun.manifest.archiveCompletedAt),
    30 * dayMs,
    "a run created after the first run was queued must still receive only 30 days"
  );
  const secondBeforeExpiry = server.previewVersionHistoryArchiveExpiry({
    rootFolderPath: expiryPolicyRoot,
    now: new Date(Date.parse(secondRetention.expiresAt) - 1).toISOString()
  });
  assert.equal(secondBeforeExpiry.movableRunCount, 0);
  assert.equal(secondBeforeExpiry.runs[0].retentionDays, 30);
  assert.equal(secondBeforeExpiry.runs[0].movableToManualDeletion, false);
  const secondAtExpiry = server.previewVersionHistoryArchiveExpiry({
    rootFolderPath: expiryPolicyRoot,
    now: secondRetention.expiresAt
  });
  assert.equal(secondAtExpiry.movableRunCount, 1);
  assert.equal(secondAtExpiry.runs[0].movableToManualDeletion, true);
  assert.throws(
    () => runWithoutDeletePrimitives(
      () => server.moveExpiredVersionHistoryArchiveRunsToManualDeletion(
        secondAtExpiry,
        {
          rootFolderPath: expiryPolicyRoot,
          now: new Date(Date.parse(secondRetention.expiresAt) - 1).toISOString()
        }
      )
    ),
    error => error?.code === "VERSION_HISTORY_ARCHIVE_EXPIRY_STALE",
    "a clock rollback before the expiry boundary must stop the move"
  );
  assert.equal(fs.existsSync(secondExpiryRun.folderPath), true);

  const invalidArchiveRoot = path.join(dataDir, "invalid-archive-expiry-root");
  const malformedRun = createCompletedArchiveRun(invalidArchiveRoot, {
    runKey: "malformed-archive"
  });
  const partialRun = createCompletedArchiveRun(invalidArchiveRoot, {
    runKey: "partial-archive"
  });
  const incompleteRun = createCompletedArchiveRun(invalidArchiveRoot, {
    runKey: "incomplete-archive"
  });
  const futureRun = createCompletedArchiveRun(invalidArchiveRoot, {
    runKey: "future-archive"
  });
  const pinnedRun = createCompletedArchiveRun(invalidArchiveRoot, {
    runKey: "pinned-archive"
  });
  const unknownFileRun = createCompletedArchiveRun(invalidArchiveRoot, {
    runKey: "unknown-file-archive"
  });
  const nestedDirectoryRun = createCompletedArchiveRun(invalidArchiveRoot, {
    runKey: "nested-directory-archive"
  });
  const traversalRun = createCompletedArchiveRun(invalidArchiveRoot, {
    runKey: "traversal-archive"
  });
  const duplicateNameRun = createCompletedArchiveRun(invalidArchiveRoot, {
    runKey: "duplicate-name-archive"
  });
  const validFlatRun = createCompletedArchiveRun(invalidArchiveRoot, {
    runKey: "valid-flat-archive",
    fileCount: 2
  });
  const futureCompletionRun = createCompletedArchiveRun(invalidArchiveRoot, {
    runKey: "future-completion-archive"
  });
  const invalidRuns = [
    malformedRun,
    partialRun,
    incompleteRun,
    futureRun,
    futureCompletionRun,
    pinnedRun,
    unknownFileRun,
    nestedDirectoryRun,
    traversalRun,
    duplicateNameRun,
    validFlatRun
  ];
  const invalidPreviewNow = new Date(
    Math.max(...invalidRuns.map(run => Date.parse(run.manifest.archiveRetention.expiresAt))) + 1
  ).toISOString();

  fs.writeFileSync(malformedRun.manifestPath, '{"version":1,\n', "utf8");
  const partialManifest = readJsonFile(partialRun.manifestPath);
  partialManifest.status = "partial";
  writeJsonFile(partialRun.manifestPath, partialManifest);
  const incompleteManifest = readJsonFile(incompleteRun.manifestPath);
  incompleteManifest.status = "in-progress";
  writeJsonFile(incompleteRun.manifestPath, incompleteManifest);
  const futureManifest = readJsonFile(futureRun.manifestPath);
  futureManifest.version = 2;
  writeJsonFile(futureRun.manifestPath, futureManifest);
  const futureCompletionManifest = readJsonFile(futureCompletionRun.manifestPath);
  futureCompletionManifest.archiveCompletedAt = new Date(
    Date.parse(invalidPreviewNow) + dayMs
  ).toISOString();
  writeJsonFile(futureCompletionRun.manifestPath, futureCompletionManifest);
  fs.writeFileSync(path.join(pinnedRun.folderPath, ".pinned"), "keep\n", "utf8");
  fs.writeFileSync(
    path.join(unknownFileRun.folderPath, "unexpected.txt"),
    "not declared by the archive manifest\n",
    "utf8"
  );
  fs.mkdirSync(path.join(nestedDirectoryRun.folderPath, "nested"));
  const traversalManifest = readJsonFile(traversalRun.manifestPath);
  const traversalPlan = readJsonFile(traversalRun.planPath);
  traversalManifest.files[0].fileName = `..${path.sep}outside.version-history.json`;
  traversalPlan.files[0].fileName = `..${path.sep}outside.version-history.json`;
  writeJsonFile(traversalRun.manifestPath, traversalManifest);
  writeJsonFile(traversalRun.planPath, traversalPlan);
  const duplicateManifest = readJsonFile(duplicateNameRun.manifestPath);
  const duplicatePlan = readJsonFile(duplicateNameRun.planPath);
  duplicateManifest.files.push({ ...duplicateManifest.files[0] });
  duplicatePlan.files.push({ ...duplicatePlan.files[0] });
  writeJsonFile(duplicateNameRun.manifestPath, duplicateManifest);
  writeJsonFile(duplicateNameRun.planPath, duplicatePlan);

  let symlinkRun = null;
  let symlinkSkippedForPrivilege = false;
  const symlinkCandidate = createCompletedArchiveRun(invalidArchiveRoot, {
    runKey: "linked-archive"
  });
  try {
    fs.symlinkSync(
      symlinkCandidate.manifestPath,
      path.join(symlinkCandidate.folderPath, "linked-manifest.json"),
      "file"
    );
    symlinkRun = symlinkCandidate;
  } catch (error) {
    if (error?.code !== "EPERM" && error?.code !== "EACCES") throw error;
    symlinkSkippedForPrivilege = true;
    fs.rmSync(symlinkCandidate.folderPath, { recursive: true, force: true });
  }

  const invalidPreview = server.previewVersionHistoryArchiveExpiry({
    rootFolderPath: invalidArchiveRoot,
    now: invalidPreviewNow
  });
  const invalidByName = new Map(invalidPreview.runs.map(run => [run.folderName, run]));
  const assertProtectedArchive = (fixture, reason) => {
    const run = invalidByName.get(fixture.folderName);
    assert.ok(run, `missing managed archive run ${fixture.folderName}`);
    assert.equal(run.protected, true, `${fixture.folderName} should be protected`);
    assert.equal(
      run.movableToManualDeletion,
      false,
      `${fixture.folderName} must not be queued for manual deletion`
    );
    assert.equal(run.protectedReason, reason);
  };
  assertProtectedArchive(malformedRun, "malformed-or-unreadable");
  assertProtectedArchive(partialRun, "failed-or-partial");
  assertProtectedArchive(incompleteRun, "incomplete");
  assertProtectedArchive(futureRun, "unsupported-or-malformed-manifest");
  assertProtectedArchive(futureCompletionRun, "future-completion-time");
  assertProtectedArchive(pinnedRun, "pinned");
  assertProtectedArchive(unknownFileRun, "unknown-contents");
  assertProtectedArchive(nestedDirectoryRun, "unknown-or-linked-contents");
  assertProtectedArchive(traversalRun, "malformed-plan-files");
  assertProtectedArchive(duplicateNameRun, "malformed-plan-files");
  if (symlinkRun) {
    assertProtectedArchive(symlinkRun, "unknown-or-linked-contents");
  } else {
    assert.equal(symlinkSkippedForPrivilege, true);
  }
  const validPreviewRun = invalidByName.get(validFlatRun.folderName);
  assert.ok(validPreviewRun);
  assert.equal(validPreviewRun.protected, false);
  assert.equal(validPreviewRun.movableToManualDeletion, true);
  assert.equal(validPreviewRun.fileCount, 2);
  assert.equal(validPreviewRun.bytes, validFlatRun.result.archivedBytes);
  assert.equal(
    invalidPreview.managedRunCount,
    invalidRuns.length + (symlinkRun ? 1 : 0)
  );
  assert.equal(invalidPreview.movableRunCount, 1);
  assert.equal(invalidPreview.movableBytes, validFlatRun.result.archivedBytes);
  assert.equal(invalidPreview.pinnedRunCount, 1);
  assert.equal(
    invalidPreview.protectedRunCount,
    invalidRuns.length - 1 + (symlinkRun ? 1 : 0)
  );

  const completedOnlyMove = runWithoutDeletePrimitives(
    () => server.moveExpiredVersionHistoryArchiveRunsToManualDeletion(
      invalidPreview,
      {
        rootFolderPath: invalidArchiveRoot,
        now: invalidPreview.generatedAt
      }
    )
  );
  assert.equal(completedOnlyMove.ok, true);
  assert.equal(completedOnlyMove.movedRunCount, 1);
  assert.equal(completedOnlyMove.movedBytes, validFlatRun.result.archivedBytes);
  assert.equal(fs.existsSync(validFlatRun.folderPath), false);
  assert.equal(
    fs.existsSync(path.join(
      readyForManualDeletionFolder(invalidArchiveRoot),
      validFlatRun.folderName
    )),
    true
  );
  [
    malformedRun,
    partialRun,
    incompleteRun,
    futureRun,
    futureCompletionRun,
    pinnedRun,
    unknownFileRun,
    nestedDirectoryRun,
    traversalRun,
    duplicateNameRun,
    ...(symlinkRun ? [symlinkRun] : [])
  ].forEach(run => {
    assert.equal(
      fs.existsSync(run.folderPath),
      true,
      `protected archive ${run.folderName} must remain managed after the move`
    );
  });

  const malformedPolicyRoot = path.join(dataDir, "malformed-archive-policy-root");
  const malformedPolicyRun = createCompletedArchiveRun(malformedPolicyRoot, {
    runKey: "malformed-policy"
  });
  fs.writeFileSync(
    path.join(archiveFolder(malformedPolicyRoot), "retention-archive-policy.json"),
    '{"version":1,\n',
    "utf8"
  );
  const malformedPolicyPreview = server.previewVersionHistoryArchiveExpiry({
    rootFolderPath: malformedPolicyRoot,
    now: malformedPolicyRun.manifest.archiveRetention.expiresAt
  });
  assert.equal(malformedPolicyPreview.policyStateStatus, "malformed");
  assert.equal(malformedPolicyPreview.movableRunCount, 0);
  assert.equal(malformedPolicyPreview.protectedRunCount, 1);
  assert.equal(malformedPolicyPreview.runs[0].protectedReason, "malformed-policy-state");
  assert.equal(malformedPolicyPreview.runs[0].movableToManualDeletion, false);

  const tamperRoot = path.join(dataDir, "archive-expiry-tamper-root");
  const tamperRun = createCompletedArchiveRun(tamperRoot, {
    runKey: "same-size-tamper"
  });
  const tamperPreview = server.previewVersionHistoryArchiveExpiry({
    rootFolderPath: tamperRoot,
    now: tamperRun.manifest.archiveRetention.expiresAt
  });
  assert.equal(tamperPreview.movableRunCount, 1);
  const tamperFilePath = path.join(
    tamperRun.folderPath,
    tamperRun.manifest.files[0].fileName
  );
  const tamperStats = fs.statSync(tamperFilePath);
  const tamperOriginal = fs.readFileSync(tamperFilePath, "utf8");
  const tamperChanged = tamperOriginal.replace("archive content", "archive changed");
  assert.notEqual(tamperChanged, tamperOriginal);
  assert.equal(Buffer.byteLength(tamperChanged), Buffer.byteLength(tamperOriginal));
  fs.writeFileSync(tamperFilePath, tamperChanged, "utf8");
  fs.utimesSync(tamperFilePath, tamperStats.atime, tamperStats.mtime);
  assert.equal(fs.statSync(tamperFilePath).size, tamperStats.size);
  assert.throws(
    () => runWithoutDeletePrimitives(
      () => server.moveExpiredVersionHistoryArchiveRunsToManualDeletion(
        tamperPreview,
        {
          rootFolderPath: tamperRoot,
          now: tamperPreview.generatedAt
        }
      )
    ),
    error => error?.code === "VERSION_HISTORY_ARCHIVE_EXPIRY_STALE",
    "same-size, same-mtime archived content tampering must invalidate the move"
  );
  assert.equal(fs.existsSync(tamperRun.folderPath), true);
  assert.equal(
    fs.existsSync(path.join(
      readyForManualDeletionFolder(tamperRoot),
      tamperRun.folderName
    )),
    false
  );

  const addedFileRoot = path.join(dataDir, "archive-expiry-added-file-root");
  const addedFileRun = createCompletedArchiveRun(addedFileRoot, {
    runKey: "stale-added-file"
  });
  const addedFilePreview = server.previewVersionHistoryArchiveExpiry({
    rootFolderPath: addedFileRoot,
    now: addedFileRun.manifest.archiveRetention.expiresAt
  });
  const addedFilePath = path.join(addedFileRun.folderPath, "added-after-preview.txt");
  fs.writeFileSync(addedFilePath, "new file\n", "utf8");
  assert.throws(
    () => runWithoutDeletePrimitives(
      () => server.moveExpiredVersionHistoryArchiveRunsToManualDeletion(
        addedFilePreview,
        {
          rootFolderPath: addedFileRoot,
          now: addedFilePreview.generatedAt
        }
      )
    ),
    error => error?.code === "VERSION_HISTORY_ARCHIVE_EXPIRY_STALE",
    "adding a file after preview must invalidate the move"
  );
  assert.equal(fs.existsSync(addedFilePath), true);
  assert.equal(fs.existsSync(addedFileRun.folderPath), true);

  const changedPlanRoot = path.join(dataDir, "archive-expiry-changed-plan-root");
  const changedPlanRun = createCompletedArchiveRun(changedPlanRoot, {
    runKey: "changed-plan-root"
  });
  const changedPlanPreview = server.previewVersionHistoryArchiveExpiry({
    rootFolderPath: changedPlanRoot,
    now: changedPlanRun.manifest.archiveRetention.expiresAt
  });
  const outsidePlanRoot = path.join(dataDir, "outside-plan-archive-root");
  fs.mkdirSync(outsidePlanRoot, { recursive: true });
  assert.throws(
    () => runWithoutDeletePrimitives(
      () => server.moveExpiredVersionHistoryArchiveRunsToManualDeletion(
        {
          ...changedPlanPreview,
          archiveRootPath: outsidePlanRoot
        },
        {
          rootFolderPath: changedPlanRoot,
          now: changedPlanPreview.generatedAt
        }
      )
    ),
    error => error?.code === "VERSION_HISTORY_ARCHIVE_EXPIRY_OUTSIDE_ROOT",
    "a stored plan must not choose a different archive root"
  );
  assert.deepEqual(snapshotDirectory(outsidePlanRoot), []);
  assert.equal(fs.existsSync(changedPlanRun.folderPath), true);

  const collisionMoveRoot = path.join(dataDir, "archive-expiry-ready-collision-root");
  const collisionMoveRun = createCompletedArchiveRun(collisionMoveRoot, {
    runKey: "ready-collision"
  });
  const collisionReadyFolder = readyForManualDeletionFolder(collisionMoveRoot);
  const collisionReadyRun = path.join(collisionReadyFolder, collisionMoveRun.folderName);
  fs.mkdirSync(collisionReadyRun, { recursive: true });
  const collisionSentinel = path.join(collisionReadyRun, "sentinel.txt");
  fs.writeFileSync(collisionSentinel, "do not replace\n", "utf8");
  const collisionMovePreview = server.previewVersionHistoryArchiveExpiry({
    rootFolderPath: collisionMoveRoot,
    now: collisionMoveRun.manifest.archiveRetention.expiresAt
  });
  assert.equal(collisionMovePreview.movableRunCount, 1);
  assert.throws(
    () => runWithoutDeletePrimitives(
      () => server.moveExpiredVersionHistoryArchiveRunsToManualDeletion(
        collisionMovePreview,
        {
          rootFolderPath: collisionMoveRoot,
          now: collisionMovePreview.generatedAt
        }
      )
    ),
    error => error?.code === "VERSION_HISTORY_ARCHIVE_READY_COLLISION",
    "an existing manual-deletion destination must stop the move before rename"
  );
  assert.equal(fs.existsSync(collisionMoveRun.folderPath), true);
  assert.equal(fs.readFileSync(collisionSentinel, "utf8"), "do not replace\n");
  assert.deepEqual(snapshotDirectory(collisionReadyRun), [
    ["sentinel.txt", Buffer.from("do not replace\n").toString("base64")]
  ]);

  const unsafeQueueRoot = path.join(dataDir, "archive-expiry-unsafe-queue-root");
  const unsafeQueueRun = createCompletedArchiveRun(unsafeQueueRoot, {
    runKey: "unsafe-ready-link"
  });
  const unsafeQueueOutside = path.join(dataDir, "outside-ready-folder");
  fs.mkdirSync(unsafeQueueOutside, { recursive: true });
  const unsafeQueueSentinel = path.join(unsafeQueueOutside, "sentinel.txt");
  fs.writeFileSync(unsafeQueueSentinel, "outside remains unchanged\n", "utf8");
  const unsafeQueuePath = readyForManualDeletionFolder(unsafeQueueRoot);
  let unsafeQueueLinkCreated = false;
  try {
    fs.symlinkSync(
      unsafeQueueOutside,
      unsafeQueuePath,
      process.platform === "win32" ? "junction" : "dir"
    );
    unsafeQueueLinkCreated = true;
  } catch (error) {
    if (error?.code !== "EPERM" && error?.code !== "EACCES") throw error;
  }
  if (unsafeQueueLinkCreated) {
    const unsafeQueuePreview = server.previewVersionHistoryArchiveExpiry({
      rootFolderPath: unsafeQueueRoot,
      now: unsafeQueueRun.manifest.archiveRetention.expiresAt
    });
    assert.equal(unsafeQueuePreview.movableRunCount, 1);
    assert.equal(unsafeQueuePreview.readyForManualDeletion.unsafe, true);
    assert.throws(
      () => runWithoutDeletePrimitives(
        () => server.moveExpiredVersionHistoryArchiveRunsToManualDeletion(
          unsafeQueuePreview,
          {
            rootFolderPath: unsafeQueueRoot,
            now: unsafeQueuePreview.generatedAt
          }
        )
      ),
      error => error?.code === "VERSION_HISTORY_ARCHIVE_READY_FOLDER_UNSAFE",
      "a linked manual-deletion queue must never receive an archive run"
    );
    assert.equal(fs.existsSync(unsafeQueueRun.folderPath), true);
    assert.equal(
      fs.readFileSync(unsafeQueueSentinel, "utf8"),
      "outside remains unchanged\n"
    );
  }

  const danglingQueueRoot = path.join(dataDir, "archive-expiry-dangling-queue-root");
  fs.mkdirSync(archiveFolder(danglingQueueRoot), { recursive: true });
  const danglingQueuePath = readyForManualDeletionFolder(danglingQueueRoot);
  let danglingQueueLinkCreated = false;
  try {
    fs.symlinkSync(
      path.join(dataDir, "missing-ready-folder-target"),
      danglingQueuePath,
      process.platform === "win32" ? "junction" : "dir"
    );
    danglingQueueLinkCreated = true;
  } catch (error) {
    if (!["EPERM", "EACCES", "EINVAL"].includes(error?.code)) throw error;
  }
  if (danglingQueueLinkCreated) {
    const danglingQueueStatus = server.versionHistoryArchiveReadyStatus({
      rootFolderPath: danglingQueueRoot
    });
    assert.equal(danglingQueueStatus.ready, true);
    assert.equal(danglingQueueStatus.unsafe, true);
  }

  const exdevRoot = path.join(dataDir, "archive-expiry-exdev-root");
  const exdevRun = createCompletedArchiveRun(exdevRoot, {
    runKey: "cross-device-move"
  });
  const exdevPreview = server.previewVersionHistoryArchiveExpiry({
    rootFolderPath: exdevRoot,
    now: exdevRun.manifest.archiveRetention.expiresAt
  });
  const exdevDestination = path.join(
    readyForManualDeletionFolder(exdevRoot),
    exdevRun.folderName
  );
  const originalExdevRenameSync = fs.renameSync;
  const originalCopyFileSync = fs.copyFileSync;
  const exdevCopyCalls = [];
  let exdevRenameInjected = false;
  fs.renameSync = (sourcePath, destinationPath) => {
    if (
      path.resolve(sourcePath) === path.resolve(exdevRun.folderPath)
      && path.resolve(destinationPath) === path.resolve(exdevDestination)
    ) {
      exdevRenameInjected = true;
      const error = new Error("Cross-device rename blocked by the test.");
      error.code = "EXDEV";
      throw error;
    }
    return originalExdevRenameSync(sourcePath, destinationPath);
  };
  fs.copyFileSync = (...args) => {
    exdevCopyCalls.push(args.map(value => String(value)));
    const error = new Error("The move must not fall back to copying.");
    error.code = "VERSION_HISTORY_ARCHIVE_READY_COPY_FALLBACK";
    throw error;
  };
  let exdevResult;
  try {
    exdevResult = runWithoutDeletePrimitives(
      () => server.moveExpiredVersionHistoryArchiveRunsToManualDeletion(
        exdevPreview,
        {
          rootFolderPath: exdevRoot,
          now: exdevPreview.generatedAt
        }
      )
    );
  } finally {
    fs.renameSync = originalExdevRenameSync;
    fs.copyFileSync = originalCopyFileSync;
  }
  assert.equal(exdevRenameInjected, true);
  assert.deepEqual(exdevCopyCalls, []);
  assert.equal(exdevResult.ok, false);
  assert.equal(exdevResult.status, "partial");
  assert.equal(exdevResult.movedRunCount, 0);
  assert.equal(exdevResult.movedBytes, 0);
  assert.equal(exdevResult.failedRunCount, 1);
  assert.equal(exdevResult.failures[0].moved, false);
  assert.equal(fs.existsSync(exdevRun.folderPath), true);
  assert.equal(fs.existsSync(exdevDestination), false);

  const rootSwitchSource = path.join(dataDir, "archive-expiry-root-switch-source");
  const rootSwitchOther = path.join(dataDir, "archive-expiry-root-switch-other");
  fs.mkdirSync(rootSwitchOther, { recursive: true });
  const rootSwitchRun = createCompletedArchiveRun(rootSwitchSource, {
    runKey: "root-switch"
  });
  const rootSwitchPreview = server.previewVersionHistoryArchiveExpiry({
    rootFolderPath: rootSwitchSource,
    now: rootSwitchRun.manifest.archiveRetention.expiresAt
  });
  assert.throws(
    () => runWithoutDeletePrimitives(
      () => server.moveExpiredVersionHistoryArchiveRunsToManualDeletion(
        rootSwitchPreview,
        {
          rootFolderPath: rootSwitchOther,
          now: rootSwitchPreview.generatedAt
        }
      )
    ),
    error => error?.code === "VERSION_HISTORY_ARCHIVE_EXPIRY_ROOT_CHANGED",
    "switching the configured root after preview must block the move"
  );
  assert.equal(fs.existsSync(rootSwitchRun.folderPath), true);
  assert.equal(fs.existsSync(readyForManualDeletionFolder(rootSwitchOther)), false);

  const movedArchiveRoot = path.join(dataDir, "moved-archive-expiry-root");
  const movedArchiveRun = createCompletedArchiveRun(movedArchiveRoot, {
    runKey: "moved-outside-managed-root"
  });
  const movedFolderPath = path.join(movedArchiveRoot, "user-moved-archive");
  fs.renameSync(movedArchiveRun.folderPath, movedFolderPath);
  const movedArchivePreview = server.previewVersionHistoryArchiveExpiry({
    rootFolderPath: movedArchiveRoot,
    now: movedArchiveRun.manifest.archiveRetention.expiresAt
  });
  assert.equal(movedArchivePreview.managedRunCount, 0);
  assert.equal(movedArchivePreview.movableRunCount, 0);
  assert.equal(movedArchivePreview.movableBytes, 0);
  assert.equal(fs.existsSync(movedFolderPath), true);

  const lockedRoot = path.join(dataDir, "retention-root-lock-current");
  const blockedRoot = path.join(dataDir, "retention-root-lock-blocked");
  t.writeVersionHistoryFolderPath(lockedRoot);
  const rootLockJob = { id: "test-retention-root-lock", mutationRootKey: "" };
  t.acquireVersionHistoryRetentionMutation(rootLockJob, lockedRoot);
  try {
    assert.doesNotThrow(() => t.writeVersionHistoryFolderPath(lockedRoot));
    assert.throws(
      () => t.writeVersionHistoryFolderPath(blockedRoot),
      error => error?.code === "VERSION_HISTORY_RETENTION_BUSY",
      "the backup folder must not change during a retention mutation"
    );
    assert.throws(
      () => t.writeVersionHistoryFolderPath(null),
      error => error?.code === "VERSION_HISTORY_RETENTION_BUSY",
      "the backup folder must not be disabled during a retention mutation"
    );
    assert.equal(fs.existsSync(blockedRoot), false);
  } finally {
    t.releaseVersionHistoryRetentionMutation(rootLockJob);
  }
  assert.equal(t.writeVersionHistoryFolderPath(blockedRoot), path.resolve(blockedRoot));
} finally {
  fs.rmSync(dataDir, { recursive: true, force: true });
}

console.log("version-history retention tests passed");
