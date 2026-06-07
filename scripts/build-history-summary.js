#!/usr/bin/env node
"use strict";

const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

function usage() {
  console.error("Usage: node scripts/build-history-summary.js <version-history.json> <output.md>");
  process.exit(2);
}

const [jsonPathArg, outputPathArg] = process.argv.slice(2);
if (!jsonPathArg || !outputPathArg) usage();

const root = path.resolve(__dirname, "..");
const serverPath = path.join(root, "server.js");
const serverCode = `${fs.readFileSync(serverPath, "utf8")}

module.exports.__historySummaryInternals = {
  backupHistoryReport,
  shouldUseFastHistoryReport
};
`;

const sandboxModule = { exports: {} };
const sandbox = {
  require,
  module: sandboxModule,
  exports: sandboxModule.exports,
  __dirname: root,
  __filename: serverPath,
  process,
  console,
  Buffer,
  URL,
  setTimeout,
  clearTimeout,
  setInterval,
  clearInterval
};

vm.runInNewContext(serverCode, sandbox, { filename: serverPath });

const {
  backupHistoryReport,
  shouldUseFastHistoryReport
} = sandboxModule.exports.__historySummaryInternals;

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8").replace(/^\uFEFF/u, ""));
}

function historyArray(entry) {
  return Array.isArray(entry?.history)
    ? entry.history
    : Array.isArray(entry?.versionHistory)
      ? entry.versionHistory
      : [];
}

function lastHistoryEntry(history) {
  return history.length ? history[history.length - 1] : {};
}

function currentPageFromHistory(entry, fallbackTitle, fallbackId) {
  const history = historyArray(entry);
  const latest = lastHistoryEntry(history);
  return {
    id: entry?.id || fallbackId,
    title: latest.title || entry?.title || fallbackTitle,
    createdAt: entry?.createdAt || latest.createdAt || null,
    updatedAt: latest.createdAt || entry?.createdAt || null,
    content: latest.content || "",
    contentHtml: latest.contentHtml || "",
    format: latest.format || {},
    versionHistory: history
  };
}

function stateFromPayload(payload) {
  const storyHistory = historyArray(payload.story || payload.initialNotes);
  const latestStory = lastHistoryEntry(storyHistory);

  return {
    version: 1,
    createdAt: payload.projectCreatedAt || latestStory.createdAt || payload.updatedAt || null,
    updatedAt: payload.projectUpdatedAt || payload.updatedAt || null,
    initialNotes: {
      id: payload.story?.id || "initial-notes",
      title: "Project notes",
      createdAt: latestStory.createdAt || payload.projectCreatedAt || null,
      updatedAt: latestStory.createdAt || payload.projectUpdatedAt || payload.updatedAt || null,
      content: latestStory.content || "",
      contentHtml: latestStory.contentHtml || "",
      format: latestStory.format || {},
      versionHistory: storyHistory
    },
    drafts: (payload.drafts || [])
      .slice()
      .sort((left, right) => {
        const leftIndex = Number.isInteger(left?.index) ? left.index : 0;
        const rightIndex = Number.isInteger(right?.index) ? right.index : 0;
        return leftIndex - rightIndex;
      })
      .map((draft, index) => currentPageFromHistory(
        draft,
        draft?.title || `Draft ${index + 1}`,
        draft?.id || `draft-${index + 1}`
      ))
  };
}

const jsonPath = path.resolve(jsonPathArg);
const outputPath = path.resolve(outputPathArg);
const payload = readJson(jsonPath);
const state = stateFromPayload(payload);
const includeChangeSummaries = !shouldUseFastHistoryReport(state);
const markdown = backupHistoryReport(state, {
  fileName: payload.sourceFileName || path.basename(jsonPath).replace(/\.version-history\.json$/u, ".txt"),
  filePath: payload.sourceFilePath || "",
  includeChangeSummaries
});

fs.mkdirSync(path.dirname(outputPath), { recursive: true });
fs.writeFileSync(outputPath, markdown, "utf8");

const draftCount = state.drafts.length;
const projectHistoryCount = historyArray(payload.story || payload.initialNotes).length;
const historyCount = state.drafts.reduce((sum, draft) => sum + historyArray(draft).length, projectHistoryCount);
console.log(`Wrote ${outputPath}`);
console.log(`Project pages: 1; drafts: ${draftCount}; history entries: ${historyCount}`);
if (!includeChangeSummaries) {
  console.log("Change summaries were omitted because the history is large.");
}
