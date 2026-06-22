# Next Session Handoff - Draft Diff Editor

Repo: `C:\Users\phili\OneDrive\Documents\DraftDiffEditor`

Start by reading `AUDIT_REPORT.md`. Treat it as the source of truth for the audit, current remediation status, and the per-finding `Done` / `Partial` / `Open` table. Continue the audit/refactor work from that report, not from memory.

## Current Direction

The app is private/local, not commercial. Prioritize runtime efficiency, maintainability, data safety, and reducing duplicated logic.

Recent completed slices:

- Local server hardening and static path containment.
- Atomic write coverage for core project/export/linked-text/cache/sidecar writes.
- Version-history sidecar path cache.
- Full version-history summary generation moved to a worker.
- Shared `public/diff-core.js` used by browser/server with focused tests.
- Shared `public/state-core.js` used by browser/server with focused tests.
- Report utility scripts now use real server/shared-core exports instead of `vm.runInNewContext`, with fixture CLI coverage in `scripts/test-report-scripts.js`.
- Browser diff rendering/caching/comparison-cell guard improvements.
- Main editor content autosave moved to debounced `/api/page` saves.
- Page-local undo now stores compact page snapshots for typing, paste, Tab, spellcheck replacement, page formatting, and rich-text commands.
- View-only interactions now persist via `/api/view-state` instead of full project/export saves.
- Server route regression coverage added in `scripts/test-server-page-unit.js`.
- Draft title edits now use page-level undo snapshots and debounced `/api/page` title patches, with title-only route regression coverage.
- Stale root-level `app.js` removed after launcher/package/static-serving checks confirmed `public/app.js` is the runtime script.
- Draft and Project notes version-restore actions now use page-level undo snapshots and narrow `/api/page` saves with opt-in `versionHistory` merge support on the server.
- Detached panel autosave now tracks dirty page keys and persists changed pages through `/api/page`; the main-window detached mirror queues page saves for changed detached page keys instead of a full project save.
- Electron generated-report open/reveal actions now use report-specific preload methods, and the main process validates report paths before calling `shell.openPath` / `shell.showItemInFolder`.
- Corrupt `project.json` recovery now records and surfaces the broken-file backup path through `/api/state` and the browser status area, then acknowledges the notice after display.
- Detached panel format-picker changes now queue page-keyed `/api/page` saves instead of falling back to saving every page in the detached unit.
- Detached panels now load `public/state-core.js` and use the shared format constants/`normalizeFormat`, reducing format duplication with the main app/server.
- Detached panels now also use shared `state-core` escaping, text-to-HTML, and word-count helpers; DOM-specific HTML-to-text remains local.
- Main editor and detached panels now share `public/toolbar-core.js` for rich-text toolbar icon markup, with source regression coverage preventing duplicated icon maps.
- Main editor and detached panels now share `public/rich-text-core.js` for rich-text sanitizing, clipboard insertion, and command execution; detached paste sanitizes rich clipboard HTML before insertion, and `npm run test:rich-text` covers the sanitizer and command helpers.
- Main-window view-only interactions now use `syncViewStateFromDom` instead of broad `syncFromInputs` scans before draft selection, display toggles, notes collapse, and compare-panel toggles; `npm run test:app-save` guards these save paths.
- Opening draft or Project notes version history now uses `syncPageFromDom` to sync only the target page/title before flushing version history instead of scanning every visible editor/title; `npm run test:app-save` also guards these targeted history-open paths.
- Restoring draft or Project notes versions now also uses `syncPageFromDom` before preserving the current page in version history, avoiding broad visible editor/title scans on page-local restore flows.
- Compact page undo/redo now peeks at page-history entries and uses `syncPageFromDom`, while full-project history snapshots still use `syncFromInputs`; `npm run test:app-save` guards both branches.
- Opening detached story/draft panels now uses `syncDetachedUnitFromDom` to sync only the target story page or draft content/notes pages before snapshotting the detached unit.
- Page-scoped search now uses `syncPageFromDom` while global search keeps full `syncFromInputs`; `npm run test:app-save` guards both branches.
- Compare mode changes and show/hide changes toggles now persist through `/api/view-state`; `npm run test:app-save` guards those view-state paths.
- Note-pane and page-pane layout mutations now use layout-only view-state updates so resize steps do not re-sync editor selection/scroll DOM; `npm run test:app-save` guards this helper and the resize paths.
- Finding #13 is complete: page count, search visibility, active page focus, and title-focus view changes now persist through view-state paths, and `npm run test:app-save` allowlists all remaining `syncFromInputs()` and `scheduleSave()` call sites as global, structural, full-history, full-save/file-level, helper, or no-page fallback behavior.
- Finding #4 is complete: full project saves now use a journaled persistence transaction across project/export/linked-text/cache/version-history sidecar writes, with rollback on write errors and startup/read recovery for interrupted commit journals. `npm run test:server` now also runs `scripts/test-persistence-transaction.js`.
- Finding #9 is complete: detached autosave/close persistence and format changes save page deltas through `/api/page`, the main detached mirror queues page saves, and detached panel format/text helpers, toolbar icons, rich-text sanitizing, clipboard insertion, and rich-text command execution are shared through the core modules.
- Finding #12 is complete: shared diff block alignment, token alignment, and identical-token restoration now use rolling-row, divide-and-conquer LCS instead of full `before x after` DP matrices, with source and reconstruction regressions in `scripts/test-diff-core.js`.
- Finding #14 is complete: page edits, draft titles, version restores, draft add/delete, and universal formatting now use compact page, draft-structure, or project-format undo entries instead of routine full project JSON snapshots.

## Open Work From Report

Use the `Current finding status` table in `AUDIT_REPORT.md`. As of this handoff:

- Open: none.
- Partial: none.
- Done: findings `#1`, `#2`, `#3`, `#4`, `#5`, `#6`, `#7`, `#8`, `#9`, `#10`, `#11`, `#12`, `#13`, `#14`, `#15`, `#16`.

Recommended next slice: choose one small, verifiable item from the report. Good candidates are:

- Add browser runtime coverage for rich-HTML compare rendering and scroll anchors.

## Important Caveats

- Do not revert unrelated local user files:
  - `documents to process (untracked)/suicide time travel-draft-diff.txt`
  - `to do.txt`
- `public/app.js` is large and fragile. Keep edits narrow.
- `public/state-core.js` is UMD-style and must keep working in browser and Node.
- `public/index.html` must load diff/state core before `app.js`.
- Do not remove browser DOM helpers such as `sanitizeRichHtml` or `plainTextFromHtml`; `state-core` relies on callback injection for browser behavior.
- Use `apply_patch` for manual edits.
- Add or extend focused tests for any behavior change.

## Validation Baseline

Run the relevant subset while working, and before finishing run:

```powershell
node --check public\state-core.js
node --check public\diff-core.js
node --check public\toolbar-core.js
node --check public\rich-text-core.js
node --check public\app.js
node --check server.js
node --check public\panel.js
node --check desktop\main.js
node --check desktop\preload.js
node --check scripts\test-app-save-paths.js
node --check scripts\test-detached-panel-save-path.js
node --check scripts\test-persistence-transaction.js
node --check scripts\test-rich-text-core.js
npm run test:detached
npm run test:state
npm run test:diff
npm run test:rich-text
npm run test:app-save
npm run test:server
npm run test:desktop
node scripts\test-report-scripts.js
npm audit --offline --omit=dev
```

## Required Finish Step

Before ending the next session, update `AUDIT_REPORT.md`:

- Add completed work to `Applied after this audit`.
- Update `Remaining high-value work` if priorities changed.
- Update the `Current finding status` table for any finding that moved between `Open`, `Partial`, and `Done`.
- Record any validation that passed or could not be run.
