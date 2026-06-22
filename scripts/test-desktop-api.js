#!/usr/bin/env node
"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const preloadSource = fs.readFileSync(path.join(root, "desktop", "preload.js"), "utf8");
const mainSource = fs.readFileSync(path.join(root, "desktop", "main.js"), "utf8");
const appSource = fs.readFileSync(path.join(root, "public", "app.js"), "utf8");

assert.match(preloadSource, /openGeneratedReport:/, "preload should expose generated-report opening only");
assert.match(preloadSource, /showGeneratedReportInFolder:/, "preload should expose generated-report reveal only");
assert.doesNotMatch(preloadSource, /\bopenPath\s*:/, "preload should not expose a generic path opener");
assert.doesNotMatch(preloadSource, /\bshowItemInFolder\s*:/, "preload should not expose a generic folder revealer");

assert.match(mainSource, /resolveGeneratedReportPath/, "desktop opener should validate generated report paths");
assert.match(mainSource, /draft-diff:open-generated-report/, "main should register report-specific open IPC");
assert.match(mainSource, /draft-diff:show-generated-report-in-folder/, "main should register report-specific reveal IPC");
assert.doesNotMatch(mainSource, /draft-diff:open-path/, "main should not register generic open-path IPC");
assert.doesNotMatch(mainSource, /draft-diff:show-item-in-folder/, "main should not register generic folder IPC");

assert.match(appSource, /draftDiffDesktop\?\.openGeneratedReport/, "browser should call report-specific open API");
assert.match(appSource, /draftDiffDesktop\?\.showGeneratedReportInFolder/, "browser should call report-specific reveal API");
assert.doesNotMatch(appSource, /draftDiffDesktop\.(openPath|showItemInFolder)/, "browser should not call generic path APIs");

const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), "draft-diff-report-api-"));
try {
  process.env.DRAFT_DIFF_DATA_DIR = dataDir;
  const versionHistoryRoot = path.join(dataDir, "version-history-root");
  const summaryFolder = path.join(versionHistoryRoot, "version history summaries");
  fs.mkdirSync(summaryFolder, { recursive: true });
  fs.writeFileSync(
    path.join(dataDir, "version-history-folder.json"),
    `${JSON.stringify({ folderPath: versionHistoryRoot }, null, 2)}\n`
  );

  const { resolveGeneratedReportPath } = require("../server");
  const fullSummaryPath = path.join(summaryFolder, "desktop-api-test.version-history-summary.html");
  const cutSummaryPath = path.join(summaryFolder, "desktop-api-test.per-draft-cut-history.html");
  const wrongSuffixPath = path.join(summaryFolder, "desktop-api-test.html");
  const outsideSummaryPath = path.join(versionHistoryRoot, "outside.version-history-summary.html");
  fs.writeFileSync(fullSummaryPath, "<!doctype html><title>Full summary</title>");
  fs.writeFileSync(cutSummaryPath, "<!doctype html><title>Cut summary</title>");
  fs.writeFileSync(wrongSuffixPath, "<!doctype html><title>Wrong suffix</title>");
  fs.writeFileSync(outsideSummaryPath, "<!doctype html><title>Outside summary folder</title>");

  assert.equal(resolveGeneratedReportPath(fullSummaryPath), path.resolve(fullSummaryPath));
  assert.equal(resolveGeneratedReportPath(cutSummaryPath), path.resolve(cutSummaryPath));
  assert.throws(
    () => resolveGeneratedReportPath(wrongSuffixPath),
    /not an allowed generated report/
  );
  assert.throws(
    () => resolveGeneratedReportPath(outsideSummaryPath),
    /outside the version history summaries folder/
  );
} finally {
  fs.rmSync(dataDir, { recursive: true, force: true });
}

console.log("desktop API hardening tests passed");
