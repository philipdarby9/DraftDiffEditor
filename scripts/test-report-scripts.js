#!/usr/bin/env node
"use strict";

const assert = require("node:assert");
const { spawnSync } = require("node:child_process");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "draft-diff-report-scripts-"));

function runScript(scriptPath, ...args) {
  const result = spawnSync(process.execPath, [scriptPath, ...args], {
    cwd: root,
    encoding: "utf8"
  });

  assert.equal(
    result.status,
    0,
    `${scriptPath} failed${result.error ? `: ${result.error.message}` : ""}\nstdout:\n${result.stdout || ""}\nstderr:\n${result.stderr || ""}`
  );
  return result;
}

try {
  const historyPath = path.join(tmp, "fixture.version-history.json");
  const liveTextPath = path.join(tmp, "fixture.txt");
  const markdownPath = path.join(tmp, "fixture.version-history.md");
  const cutHistoryPath = path.join(tmp, "fixture.per-draft-cut-history.html");
  const firstSavedAt = "2026-06-07T10:00:00.000Z";
  const secondSavedAt = "2026-06-07T10:05:00.000Z";

  fs.writeFileSync(liveTextPath, [
    "Draft 1",
    "Created: Sunday, 7 June 2026 at 10:00",
    "Word count: 2",
    "",
    "One three",
    "",
    "---",
    "",
    "Draft 2",
    "Created: Sunday, 7 June 2026 at 10:10",
    "Word count: 2",
    "",
    "Second draft",
    ""
  ].join("\n"), "utf8");

  fs.writeFileSync(historyPath, `${JSON.stringify({
    sourceFileName: "fixture.txt",
    sourceFilePath: liveTextPath,
    projectCreatedAt: firstSavedAt,
    projectUpdatedAt: secondSavedAt,
    story: {
      id: "initial-notes",
      history: [
        {
          createdAt: firstSavedAt,
          title: "Project notes",
          content: "Notes start"
        }
      ]
    },
    drafts: [
      {
        id: "draft-1",
        index: 0,
        title: "Draft 1",
        createdAt: firstSavedAt,
        history: [
          {
            createdAt: firstSavedAt,
            title: "Draft 1",
            content: "One two three"
          },
          {
            createdAt: secondSavedAt,
            title: "Draft 1",
            content: "One three"
          }
        ]
      },
      {
        id: "draft-2",
        index: 1,
        title: "Draft 2",
        createdAt: secondSavedAt,
        history: [
          {
            createdAt: secondSavedAt,
            title: "Draft 2",
            content: "Second draft"
          }
        ]
      }
    ]
  }, null, 2)}\n`, "utf8");

  const historyResult = runScript(path.join("scripts", "build-history-summary.js"), historyPath, markdownPath);
  assert.match(historyResult.stdout, /Wrote/u);
  const markdown = fs.readFileSync(markdownPath, "utf8");
  assert.match(markdown, /fixture\.txt version history/u);
  assert.match(markdown, /Draft 1/u);
  assert.match(markdown, /One two three/u);

  const cutResult = runScript(
    path.join("scripts", "build-per-draft-cut-history.js"),
    historyPath,
    liveTextPath,
    cutHistoryPath
  );
  assert.match(cutResult.stdout, /cut entries: 1/u);
  const cutHistory = fs.readFileSync(cutHistoryPath, "utf8");
  assert.match(cutHistory, /fixture\.txt: per-draft cut history/u);
  assert.match(cutHistory, /<mark>two\s*<\/mark>/u);

  console.log("Report script CLI tests passed");
} finally {
  fs.rmSync(tmp, { recursive: true, force: true });
}
