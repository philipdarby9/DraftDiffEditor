#!/usr/bin/env node
"use strict";

const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const appSource = fs.readFileSync(path.join(root, "public", "app.js"), "utf8");

function sourceBetween(startNeedle, endNeedle) {
  const start = appSource.indexOf(startNeedle);
  assert.ok(start >= 0, `missing start marker: ${startNeedle}`);
  const end = appSource.indexOf(endNeedle, start + startNeedle.length);
  assert.ok(end > start, `missing end marker after: ${startNeedle}`);
  return appSource.slice(start, end);
}

function countOccurrences(source, pattern) {
  return [...source.matchAll(pattern)].length;
}

assert.doesNotMatch(appSource, /DIFF_MAX_(ALIGN_BLOCK|RANGE_TOKEN)_CELLS/, "browser diff rendering should not enforce comparison-cell limits");
assert.doesNotMatch(appSource, /alignDiffLimitReason|diffRangeLimitReason|comparison cells; limit|too large to diff|Detailed comparison skipped/, "browser diff rendering should not skip detail because of size limits");

const viewSync = sourceBetween("function syncViewStateFromDom", "function scheduleSearchRefresh");
assert.match(viewSync, /saveCurrentEditorViewState\(\)/, "view-only sync should preserve current editor selection");
assert.match(viewSync, /saveVisibleEditorScrollPositions\(\)/, "view-only sync should preserve visible editor scroll");
assert.doesNotMatch(viewSync, /querySelectorAll\("\[data-title-draft-id\]"\)/, "view-only sync should not scan draft titles");
assert.doesNotMatch(viewSync, /querySelectorAll\("\[data-editor-key\]"\)/, "view-only sync should not scan editor content");
assert.doesNotMatch(viewSync, /syncRichPage\(/, "view-only sync should not sync rich page content");

const currentViewState = sourceBetween("function saveCurrentViewState", "async function saveViewStateNow");
assert.match(currentViewState, /options\.syncDom !== false/, "view-state saving should allow layout-only updates without DOM sync");
assert.match(currentViewState, /saveCurrentEditorViewState\(\)/, "normal view-state saving should preserve editor selection");
assert.match(currentViewState, /saveVisibleEditorScrollPositions\(\)/, "normal view-state saving should preserve editor scroll");

const layoutViewState = sourceBetween("function saveLayoutViewState", "function getSelectedDraft");
assert.match(layoutViewState, /saveCurrentViewState\(\{ syncDom: false \}\)/, "layout-only view-state updates should skip editor DOM sync");
assert.doesNotMatch(layoutViewState, /saveCurrentEditorViewState\(\)/, "layout-only view-state updates should not sync current editor selection");
assert.doesNotMatch(layoutViewState, /saveVisibleEditorScrollPositions\(\)/, "layout-only view-state updates should not sync visible editor scroll");

const displaySelectionSource = sourceBetween("function ensureDisplaySelection", "function displayPage");
assert.match(displaySelectionSource, /saveLayoutViewState\(\)/, "display selection cleanup should use a single layout-only view-state update");
assert.doesNotMatch(displaySelectionSource, /saveCurrentViewState\(\)/, "display selection cleanup should not scan editor DOM directly");
assert.doesNotMatch(displaySelectionSource, /save(DisplaySelection|CollapsedNotes|NotesPanePercents|PagePanePercents)\(\)/, "display selection cleanup should not fan out through repeated view-state wrappers");

const notePaneSource = sourceBetween("function setNotesPanePercent", "function isPageEmpty");
assert.match(notePaneSource, /saveNotesPanePercents\(\)/, "note pane resizing should still update layout view state");
assert.doesNotMatch(notePaneSource, /saveCurrentViewState\(\)/, "note pane resizing should not scan editor DOM on each pane mutation");

const pagePaneSource = sourceBetween("function resetPagePanePercents", "function setPagesOnScreen");
assert.match(pagePaneSource, /savePagePanePercents\(\)/, "page pane resets should still update layout view state");
assert.doesNotMatch(pagePaneSource, /saveCurrentViewState\(\)/, "page pane resets should not scan editor DOM directly");

const pagesOnScreenSource = sourceBetween("function setPagesOnScreen", "function syncPanelDragMenu");
assert.match(pagesOnScreenSource, /persistViewStateChange\(500\)/, "page-count layout changes should persist through /api/view-state");
assert.doesNotMatch(pagesOnScreenSource, /syncFromInputs\(\)/, "page-count layout changes should not sync all page inputs");
assert.doesNotMatch(pagesOnScreenSource, /scheduleSave\(/, "page-count layout changes should not schedule full project saves");

const searchScopeVisibleSource = sourceBetween("function ensureSearchScopeVisible", "function textSegmentsForEditor");
assert.match(searchScopeVisibleSource, /persistViewStateChange\(0\)/, "search visibility changes should persist through /api/view-state");
assert.doesNotMatch(searchScopeVisibleSource, /syncFromInputs\(\)/, "search visibility changes should not sync all page inputs");
assert.doesNotMatch(searchScopeVisibleSource, /scheduleSave\(/, "search visibility changes should not schedule full project saves");

const activePageSource = sourceBetween("function setActiveFromPageKey", "function focusPageEditor");
assert.match(activePageSource, /persistViewStateChange\(0\)/, "active-page focus changes should persist through /api/view-state");
assert.doesNotMatch(activePageSource, /syncFromInputs\(\)/, "active-page focus changes should not sync all page inputs");
assert.doesNotMatch(activePageSource, /scheduleSave\(/, "active-page focus changes should not schedule full project saves");

const focusInSource = sourceBetween("els.pageCanvas.addEventListener(\"focusin\"", "els.pageCanvas.addEventListener(\"focusout\"");
assert.match(focusInSource, /persistViewStateChange\(0\)/, "title focus changes should persist through /api/view-state");
assert.doesNotMatch(focusInSource, /syncFromInputs\(\)/, "title focus changes should not sync all page inputs");
assert.doesNotMatch(focusInSource, /scheduleSave\(/, "title focus changes should not schedule full project saves");

const pageSync = sourceBetween("function syncPageFromDom", "function syncViewStateFromDom");
assert.match(pageSync, /syncViewStateFromDom\(\)/, "page sync should preserve view state");
assert.match(pageSync, /querySelector\(`\[data-title-draft-id="\$\{cssEscape\(parsed\.draftId\)\}"\]`\)/, "page sync should target one draft title input");
assert.match(pageSync, /editorElementForKey\(pageKey\)/, "page sync should target one editor");
assert.doesNotMatch(pageSync, /querySelectorAll\("\[data-title-draft-id\]"\)/, "page sync should not scan all draft titles");
assert.doesNotMatch(pageSync, /querySelectorAll\("\[data-editor-key\]"\)/, "page sync should not scan all editor content");

const unitSync = sourceBetween("function syncDetachedUnitFromDom", "function scheduleSearchRefresh");
assert.match(unitSync, /syncPageFromDom\(STORY_KEY\)/, "detached story sync should target Project notes");
assert.match(unitSync, /syncPageFromDom\(draftContentKey\(parsed\.draftId\)\)/, "detached draft sync should target draft text");
assert.match(unitSync, /syncPageFromDom\(draftNotesKey\(parsed\.draftId\)\)/, "detached draft sync should target draft notes");
assert.doesNotMatch(unitSync, /syncFromInputs\(\)/, "detached unit sync should not scan all page inputs");

[
  ["selectDraft", "function selectDraft(draftId)", "function selectDraftInChanges"],
  ["selectDraftInChanges", "function selectDraftInChanges(draftId)", "function addDraft"],
  ["toggleNotes", "function toggleNotes(draftId)", "function deleteDraft"],
  ["story focus", "els.storyTab.addEventListener", "els.storyDisplayToggle.addEventListener"],
  ["story display", "els.storyDisplayToggle.addEventListener", "els.allDraftsTab.addEventListener"],
  ["all-drafts tab", "els.allDraftsTab.addEventListener", "els.allDraftsToggle.addEventListener"],
  ["all-drafts toggle", "els.allDraftsToggle.addEventListener", "els.draftTabs.addEventListener(\"click\""],
  ["draft display checkbox", "els.draftTabs.addEventListener(\"change\"", "els.tabStrip?.addEventListener"],
  ["changes toggle", "els.toggleChanges.addEventListener", "els.searchInput?.addEventListener"]
].forEach(([label, start, end]) => {
  const snippet = sourceBetween(start, end);
  assert.match(snippet, /syncViewStateFromDom\(\)/, `${label} should use view-state-only DOM sync`);
  assert.doesNotMatch(snippet, /syncFromInputs\(\)/, `${label} should not scan all page inputs`);
});

const compareModeSource = sourceBetween("els.compareMode.addEventListener", "els.diffOutput.addEventListener(\"dblclick\"");
assert.match(compareModeSource, /persistViewStateChange\(0\)/, "compare mode changes should persist through /api/view-state");
assert.doesNotMatch(compareModeSource, /saveCurrentViewState\(\)/, "compare mode changes should not only update local view state");

const changesToggleSource = sourceBetween("els.toggleChanges.addEventListener", "els.searchInput?.addEventListener");
assert.match(changesToggleSource, /persistViewStateChange\(0\)/, "changes-panel toggles should persist through /api/view-state");
assert.doesNotMatch(changesToggleSource, /saveCurrentViewState\(\)/, "changes-panel toggles should not only update local view state");

[
  ["undo page history", "function undoProjectChange()", "  if (isDraftStructureHistoryEntry(previousEntry))"],
  ["redo page history", "function redoProjectChange()", "  if (isDraftStructureHistoryEntry(nextEntry))"],
  ["draft version history", "function openDraftVersionHistoryForDraft(draftId)", "function openProjectNotesVersionHistory"],
  ["Project notes version history", "function openProjectNotesVersionHistory()", "function openDraftVersionHistoryForPage"],
  ["draft version restore", "function restoreDraftVersion(draftId, versionId)", "function restoreProjectNotesVersion"],
  ["Project notes version restore", "function restoreProjectNotesVersion(versionId)", "function clearDraftVersionTimer"],
  ["detach unit", "function detachUnit(key)", "function handleDetachedUnitUpdate"]
].forEach(([label, start, end]) => {
  const snippet = sourceBetween(start, end);
  assert.match(snippet, /sync(PageFromDom|DetachedUnitFromDom)\(/, `${label} should sync only the target page or unit`);
  assert.doesNotMatch(snippet, /syncFromInputs\(\)/, `${label} should not scan all page inputs`);
});

[
  ["undo compact draft structure", "  if (isDraftStructureHistoryEntry(previousEntry))", "  if (isProjectFormatHistoryEntry(previousEntry))"],
  ["redo compact draft structure", "  if (isDraftStructureHistoryEntry(nextEntry))", "  if (isProjectFormatHistoryEntry(nextEntry))"],
  ["undo compact project format", "  if (isProjectFormatHistoryEntry(previousEntry))", "  syncFromInputs();\n  undoStack.pop();\n  const previousSnapshot"],
  ["redo compact project format", "  if (isProjectFormatHistoryEntry(nextEntry))", "  syncFromInputs();\n  redoStack.pop();\n  const nextSnapshot"]
].forEach(([label, start, end]) => {
  const snippet = sourceBetween(start, end);
  assert.match(snippet, /syncFromInputs\(\)/, `${label} should sync inputs before compact structural undo`);
  assert.doesNotMatch(snippet, /serializeProjectState\(state,\s*\{ includeVersionHistory: false \}\)/, `${label} should not serialize full project snapshots`);
});

[
  ["undo full history", "  syncFromInputs();\n  undoStack.pop();\n  const previousSnapshot", "function redoProjectChange()"],
  ["redo full history", "  syncFromInputs();\n  redoStack.pop();\n  const nextSnapshot", "function editableHistoryTarget"],
  ["addDraft", "function addDraft(copyFromSelected)", "function toolbarFormatValues"],
  ["deleteDraft", "function deleteDraft(draftId)", "function resizeNotesPane"],
  ["saveNow", "async function saveNow()", "async function loadState()"]
].forEach(([label, start, end]) => {
  const snippet = sourceBetween(start, end);
  assert.match(snippet, /syncFromInputs\(\)/, `${label} should still perform full input sync`);
});

const openSearchSource = sourceBetween("function openSearch(options = {})", "function closeSearch");
assert.match(
  openSearchSource,
  /if \(options\.pageKey\) {\s*syncPageFromDom\(options\.pageKey\);\s*} else {\s*syncFromInputs\(\);\s*}/,
  "openSearch should sync one page for page-scoped search and full inputs for global search"
);

const allowedSyncFromInputsRanges = [
  ["syncFromInputs definition", "function syncFromInputs()", "function syncPageFromDom"],
  ["undo compact draft structure", "  if (isDraftStructureHistoryEntry(previousEntry))", "  if (isProjectFormatHistoryEntry(previousEntry))"],
  ["undo compact project format", "  if (isProjectFormatHistoryEntry(previousEntry))", "  syncFromInputs();\n  undoStack.pop();\n  const previousSnapshot"],
  ["undo full history", "  syncFromInputs();\n  undoStack.pop();\n  const previousSnapshot", "function redoProjectChange()"],
  ["redo compact draft structure", "  if (isDraftStructureHistoryEntry(nextEntry))", "  if (isProjectFormatHistoryEntry(nextEntry))"],
  ["redo compact project format", "  if (isProjectFormatHistoryEntry(nextEntry))", "  syncFromInputs();\n  redoStack.pop();\n  const nextSnapshot"],
  ["redo full history", "  syncFromInputs();\n  redoStack.pop();\n  const nextSnapshot", "function editableHistoryTarget"],
  ["global search", "function openSearch(options = {})", "function closeSearch"],
  ["scheduleSave full save helper", "function scheduleSave(options = {})", "function schedulePageSave"],
  ["save as text", "async function saveAsTextProject", "async function newTextProject"],
  ["prepare project open", "async function prepareCurrentProjectForOpen", "async function applyOpenedTextFilePayload"],
  ["select version-history folder", "async function selectVersionHistoryFolder", "async function toggleBackup"],
  ["close payload", "function prepareClosePayload", "async function writeProjectBackupNow"],
  ["version-history summary generation", "async function generateVersionHistorySummary", "async function closeApp"],
  ["saveNow full save", "async function saveNow", "async function loadState"],
  ["addDraft structural edit", "function addDraft(copyFromSelected)", "function toolbarFormatValues"],
  ["universal format structural edit", "function applyUniversalFormat", "function runEditorCommand"],
  ["deleteDraft structural edit", "function deleteDraft(draftId)", "function resizeNotesPane"]
];
const allowedSyncFromInputsCount = allowedSyncFromInputsRanges.reduce(
  (sum, [, start, end]) => sum + countOccurrences(sourceBetween(start, end), /syncFromInputs\(\)/g),
  0
);
assert.strictEqual(
  countOccurrences(appSource, /syncFromInputs\(\)/g),
  allowedSyncFromInputsCount,
  "every syncFromInputs call should be accounted for as global, structural, or full-save behavior"
);

const addDraftSource = sourceBetween("function addDraft(copyFromSelected)", "function toolbarFormatValues");
assert.match(addDraftSource, /recordDraftStructureUndoSnapshot\(\[draft\.id\]\)/, "addDraft should record compact draft-structure undo");
assert.doesNotMatch(addDraftSource, /recordUndoSnapshot\(\)/, "addDraft should not record full project undo snapshots");

const universalFormatSource = sourceBetween("function applyUniversalFormat", "function runEditorCommand");
assert.match(universalFormatSource, /recordProjectFormatUndoSnapshot\(\)/, "universal format should record compact format undo");
assert.doesNotMatch(universalFormatSource, /recordUndoSnapshot\(\)/, "universal format should not record full project undo snapshots");

const deleteDraftSource = sourceBetween("function deleteDraft(draftId)", "function resizeNotesPane");
assert.match(deleteDraftSource, /recordDraftStructureUndoSnapshot\(\[draftId\]\)/, "deleteDraft should record compact draft-structure undo");
assert.doesNotMatch(deleteDraftSource, /recordUndoSnapshot\(\)/, "deleteDraft should not record full project undo snapshots");

const allowedScheduleSaveRanges = [
  ["restore full history snapshot", "function restoreHistorySnapshot(snapshot)", "function pageEntriesForProjectState"],
  ["restore targeted full history snapshot", "function restoreHistorySnapshotWithTarget", "function pageHistoryEntryForTarget"],
  ["restore compact draft structure", "function restoreDraftStructureHistoryEntryWithTarget", "function applyProjectFormatHistoryEntry"],
  ["restore compact project format", "function restoreProjectFormatHistoryEntryWithTarget", "function undoProjectChange"],
  ["spellcheck no-page fallback", "function replaceSpellcheckWord", "function menuButtonHtml"],
  ["scheduleSave helper definition", "function scheduleSave(options = {})", "function schedulePageSave"],
  ["schedulePageSave no-page fallback", "function schedulePageSave(pageKey, options = {})", "function resetViewStateForProject"],
  ["addDraft structural save", "function addDraft(copyFromSelected)", "function toolbarFormatValues"],
  ["universal format structural save", "function applyUniversalFormat", "function runEditorCommand"],
  ["deleteDraft structural save", "function deleteDraft(draftId)", "function resizeNotesPane"],
  ["title input no-page fallback", "els.pageCanvas.addEventListener(\"input\"", "els.pageCanvas.addEventListener(\"keyup\""]
];
const allowedScheduleSaveCount = allowedScheduleSaveRanges.reduce(
  (sum, [, start, end]) => sum + countOccurrences(sourceBetween(start, end), /scheduleSave\(/g),
  0
);
assert.strictEqual(
  countOccurrences(appSource, /scheduleSave\(/g),
  allowedScheduleSaveCount,
  "every scheduleSave call should be accounted for as structural, full-history, helper, or fallback behavior"
);

console.log("app save-path source tests passed");
