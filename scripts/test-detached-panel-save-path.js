#!/usr/bin/env node
"use strict";

const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const panelSource = fs.readFileSync(path.join(root, "public", "panel.js"), "utf8");
const panelHtml = fs.readFileSync(path.join(root, "public", "panel.html"), "utf8");
const indexHtml = fs.readFileSync(path.join(root, "public", "index.html"), "utf8");
const appSource = fs.readFileSync(path.join(root, "public", "app.js"), "utf8");
const toolbarCore = require(path.join(root, "public", "toolbar-core.js"));
const richTextCore = require(path.join(root, "public", "rich-text-core.js"));

const stateCoreIndex = panelHtml.indexOf("/state-core.js");
const toolbarCoreIndex = panelHtml.indexOf("/toolbar-core.js");
const richTextCoreIndex = panelHtml.indexOf("/rich-text-core.js");
const panelScriptIndex = panelHtml.indexOf("/panel.js");
assert.ok(stateCoreIndex >= 0, "detached panel should load shared state-core");
assert.ok(toolbarCoreIndex > stateCoreIndex, "detached panel should load shared toolbar-core after state-core");
assert.ok(richTextCoreIndex > toolbarCoreIndex, "detached panel should load shared rich-text-core after toolbar-core");
assert.ok(panelScriptIndex > stateCoreIndex, "detached panel should load state-core before panel.js");
assert.ok(panelScriptIndex > toolbarCoreIndex, "detached panel should load toolbar-core before panel.js");
assert.ok(panelScriptIndex > richTextCoreIndex, "detached panel should load rich-text-core before panel.js");

const indexStateCoreIndex = indexHtml.indexOf("/state-core.js");
const indexToolbarCoreIndex = indexHtml.indexOf("/toolbar-core.js");
const indexRichTextCoreIndex = indexHtml.indexOf("/rich-text-core.js");
const appScriptIndex = indexHtml.indexOf("/app.js");
assert.ok(indexStateCoreIndex >= 0, "main app should load shared state-core");
assert.ok(indexToolbarCoreIndex > indexStateCoreIndex, "main app should load shared toolbar-core after state-core");
assert.ok(indexRichTextCoreIndex > indexToolbarCoreIndex, "main app should load shared rich-text-core after toolbar-core");
assert.ok(appScriptIndex > indexToolbarCoreIndex, "main app should load toolbar-core before app.js");
assert.ok(appScriptIndex > indexRichTextCoreIndex, "main app should load rich-text-core before app.js");

assert.match(panelSource, /const StateCore = window\.DraftDiffStateCore/, "detached panel should consume shared state-core");
assert.match(panelSource, /const ToolbarCore = window\.DraftDiffToolbarCore/, "detached panel should consume shared toolbar-core");
assert.match(panelSource, /const RichTextCore = window\.DraftDiffRichTextCore/, "detached panel should consume shared rich-text-core");
assert.match(panelSource, /function normalizeFormat[\s\S]*?return StateCore\.normalizeFormat\(format\);[\s\S]*?\}/, "detached panel format normalization should use state-core");
assert.doesNotMatch(panelSource, /FONT_FAMILY_OPTIONS\.includes\(format\.fontFamily\)/, "detached panel should not duplicate format validation");
assert.match(panelSource, /const escapeHtml = StateCore\.escapeHtml/, "detached panel should use shared HTML escaping");
assert.match(panelSource, /const textToHtml = StateCore\.textToHtml/, "detached panel should use shared plain-text HTML formatting");
assert.match(panelSource, /const wordCountForText = StateCore\.wordCountForText/, "detached panel should use shared word counting");
assert.match(panelSource, /const toolbarIcons = ToolbarCore\.toolbarIcons/, "detached panel should use shared toolbar icons");
assert.match(panelSource, /const sanitizeRichHtml = RichTextCore\.sanitizeRichHtml/, "detached panel should use shared rich-text sanitizer");
assert.match(panelSource, /const execRichTextCommand = RichTextCore\.execRichTextCommand/, "detached panel should use shared rich-text command helper");
assert.match(panelSource, /const insertClipboardHtml = RichTextCore\.insertClipboardHtml/, "detached panel should use shared rich-text clipboard helper");
assert.doesNotMatch(panelSource, /function escapeHtml\(/, "detached panel should not duplicate HTML escaping");
assert.doesNotMatch(panelSource, /function textToHtml\(/, "detached panel should not duplicate plain-text HTML formatting");
assert.doesNotMatch(panelSource, /function wordCountForText\(/, "detached panel should not duplicate word counting");
assert.doesNotMatch(panelSource, /function sanitizeRichHtml\(/, "detached panel should not duplicate rich-text sanitizing");
assert.doesNotMatch(panelSource, /const toolbarIcons = \{/, "detached panel should not duplicate toolbar icons");
assert.match(appSource, /const ToolbarCore = window\.DraftDiffToolbarCore/, "main app should consume shared toolbar-core");
assert.match(appSource, /const toolbarIcons = ToolbarCore\.toolbarIcons/, "main app should use shared toolbar icons");
assert.doesNotMatch(appSource, /const toolbarIcons = \{/, "main app should not duplicate toolbar icons");
assert.match(appSource, /const RichTextCore = window\.DraftDiffRichTextCore/, "main app should consume shared rich-text-core");
assert.match(appSource, /const sanitizeRichHtml = RichTextCore\.sanitizeRichHtml/, "main app should use shared rich-text sanitizer");
assert.match(appSource, /const execRichTextCommand = RichTextCore\.execRichTextCommand/, "main app should use shared rich-text command helper");
assert.match(appSource, /const insertClipboardHtml = RichTextCore\.insertClipboardHtml/, "main app should use shared rich-text clipboard helper");
assert.match(appSource, /const insertPlainText = RichTextCore\.insertPlainText/, "main app should use shared rich-text plain-text insertion helper");
assert.doesNotMatch(appSource, /function sanitizeRichHtml\(/, "main app should not duplicate rich-text sanitizing");
["format", "undo", "redo", "bold", "italic", "underline", "strike", "unorderedList", "orderedList", "outdent", "indent", "alignLeft", "alignCenter", "alignRight", "clear", "history", "search", "detach"].forEach(icon => {
  assert.ok(toolbarCore.toolbarIcons[icon], `shared toolbar icon should include ${icon}`);
});
assert.equal(typeof richTextCore.sanitizeRichHtml, "function", "shared rich-text core should expose sanitizer");
assert.equal(typeof richTextCore.execRichTextCommand, "function", "shared rich-text core should expose command helper");
assert.equal(typeof richTextCore.insertClipboardHtml, "function", "shared rich-text core should expose clipboard helper");
assert.match(
  panelSource,
  /insertClipboardHtml\(event\.clipboardData,\s*\{\s*document,\s*textToHtml\s*\}\)/,
  "detached panel paste should use shared sanitized clipboard insertion"
);
assert.match(
  panelSource,
  /execRichTextCommand\(button\.dataset\.command,\s*\{\s*document,\s*editor: editorEl\s*\}\)/,
  "detached panel toolbar commands should use shared rich-text command helper"
);
assert.match(
  appSource,
  /insertClipboardHtml\(event\.clipboardData,\s*\{\s*document,\s*textToHtml\s*\}\)/,
  "main app paste should use shared sanitized clipboard insertion"
);
assert.match(
  appSource,
  /execRichTextCommand\(command,\s*\{\s*document,\s*editor: editorEl\s*\}\)/,
  "main app toolbar commands should use shared rich-text command helper"
);
assert.doesNotMatch(panelSource, /document\.execCommand/, "detached panel should not issue rich-text document commands directly");
assert.doesNotMatch(appSource, /document\.execCommand/, "main app should not issue rich-text document commands directly");

assert.match(panelSource, /fetch\("\/api\/page"/, "detached panel saves should PATCH /api/page");
assert.match(panelSource, /navigator\.sendBeacon\("\/api\/page"/, "detached close persistence should POST /api/page beacons");
assert.doesNotMatch(panelSource, /fetch\("\/api\/unit"/, "detached panel autosave should not PATCH whole units");
assert.doesNotMatch(panelSource, /sendBeacon\("\/api\/unit"/, "detached panel close persistence should not POST whole units");
assert.match(panelSource, /dirtyPageKeys/, "detached panel should track dirty page keys");

const formatStart = panelSource.indexOf("function chooseFormatOption");
const formatEnd = panelSource.indexOf("function renderUnit", formatStart);
assert.ok(formatStart >= 0 && formatEnd > formatStart, "detached format option handler should be present");
const formatSource = panelSource.slice(formatStart, formatEnd);
assert.match(
  formatSource,
  /queueSave\(350,\s*section\.dataset\.pageKey\s*\|\|\s*""\)/,
  "detached format option changes should queue a page-keyed save"
);
assert.doesNotMatch(
  formatSource,
  /queueSave\(\s*\)/,
  "detached format option changes should not fall back to saving every panel page"
);

const handleStart = appSource.indexOf("function handleDetachedUnitUpdate");
const handleEnd = appSource.indexOf("async function refreshDetachedUnitFromServer", handleStart);
assert.ok(handleStart >= 0 && handleEnd > handleStart, "main detached update handler should be present");
const handleSource = appSource.slice(handleStart, handleEnd);

assert.match(handleSource, /applyDetachedUnitSnapshotPageKeys/, "main detached mirror should collect updated page keys");
assert.match(handleSource, /queuePageSave\(pageKey, AUTOSAVE_DELAY_MS\)/, "main detached mirror should queue page saves");
assert.doesNotMatch(handleSource, /queueSave\(/, "main detached mirror should not queue a full project save");

console.log("detached panel save-path tests passed");
