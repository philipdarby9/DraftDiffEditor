---
name: draft-diff-audit
description: Audit the Draft Diff Editor codebase without changing application code. Use when Codex is asked to review, audit, risk-assess, simplify, refactor-plan, de-duplicate, improve performance, improve local data safety, check Electron/local-server boundaries, or produce an evidence-backed AUDIT_REPORT.md for this private local-first writing app.
---

# Draft Diff Audit

## Purpose

Audit this private, non-commercial Draft Diff Editor app. Prioritize maintainability, refactoring leverage, runtime efficiency, and local data safety over SaaS/commercial readiness. Keep the audit read-only except for writing the requested report.

## App Context

- This is a local-first writing editor with a browser UI, a Node local HTTP server, and an Electron desktop shell.
- Runtime entry points are `server.js`, `public/index.html`, `public/app.js`, `public/panel.js`, `public/styles.css`, `desktop/main.js`, and `desktop/preload.js`.
- Packaged builds include `desktop/**/*`, `public/**/*`, `server.js`, and `package.json`. Treat root-level `app.js` as potentially stale unless an entry point or script proves it is used.
- Primary user data lives in JSON/text files under the configured data directory, linked text files, and backup/version-history folders.
- Security matters where it protects local files, shell/process calls, Electron IPC, the local server boundary, and accidental data exposure. Do not spend report space on irrelevant SaaS concerns such as multi-tenant auth, billing, production runbooks, SOC2, public API abuse, or cloud scaling unless the code actually introduces that surface.

## Ground Rules

- Do not fix, delete, refactor, or reformat app code during the audit.
- Prefer findings that change the maintainer's next action: data-loss risks, incorrect draft/history behavior, obvious performance bottlenecks, duplicated logic, dead runtime files, fragile UI state, and high-value simplifications.
- Back every finding with `file:line` evidence. If evidence is incomplete, put it in `NEEDS-HUMAN` or `Could Not Verify`.
- Verify whether a file is actually served, imported, packaged, or invoked before reporting defects in it.
- Mark non-applicable checks as non-applicable instead of lowering the score for them.
- Keep recommendations practical for a single-maintainer local app.

## Workflow

1. Inventory the repo: scripts, package/build config, Electron entry points, served public files, server endpoints, storage paths, backup/history paths, tests/smoke scripts, repo-local skills, and any existing `AUDIT_REPORT.md`.
2. Map critical flows: create/open/save text project, autosave, backup activation, version-history sidecars, summary generation, close/shutdown persistence, detached panels, spellcheck, search, and draft comparison rendering.
3. Run safe checks available locally: `npm run build` if present, syntax checks, existing smoke scripts, `npm audit --offline` if useful, and static searches with `rg`. Use dead-code or duplication tools only if already installed or available without network access.
4. Manually inspect the highest-risk paths from step 2, especially duplicated client/server diff/history logic and long synchronous file/render operations.
5. Write `AUDIT_REPORT.md` in the repo root unless the user asks for a different destination.

## Audit Focus

### Refactoring and Maintainability

- Find duplicated algorithms between `public/app.js`, `server.js`, scripts, and any stale root-level copies.
- Identify large functions or clusters that should become modules only when extraction would reduce real risk or repeated edits.
- Look for state normalization, draft/history parsing, diffing, summary generation, and file-path code that appears in more than one place.
- Flag dead files, stale build artifacts, unused endpoints, unreachable UI handlers, obsolete cache-busting strings, and temporary files that confuse future changes.
- For each refactor candidate, include the simplification, expected risk reduction, rough size, verification needed, and whether it can be staged safely.

### Efficiency

- Inspect render and input paths for full-app rerenders, repeated DOM scans, repeated tokenization/diffing, unbounded arrays/maps, and work repeated on every keystroke.
- Inspect server paths for synchronous filesystem work, repeated JSON parsing/stringifying, expensive history summaries, worker boundaries, cache keys, and missing cancellation/progress handling.
- Prioritize performance problems that affect large drafts, many drafts, long version histories, close-time persistence, startup, or summary generation.
- Avoid speculative micro-optimizations; require a plausible input size and call path.

### Local Data Safety

- Check atomic writes, backup ordering, version-history migration, linked-file writes, cache invalidation, crash/close paths, and handling of missing backup folders.
- Check that destructive or overwriting operations have a recoverable copy or clear fallback.
- Check path normalization and folder scoping where user-chosen paths, recent files, sidecars, summaries, and "open containing folder" actions interact.
- Treat accidental data loss or wrong-file writes as high severity even though the app is private.

### Electron and Local Server Boundary

- Confirm the server binds to localhost in desktop mode and understand any non-desktop mode exposure.
- Check Electron settings: context isolation, sandbox, node integration, preload API shape, IPC handlers, external URL handling, and local file/path operations.
- Check local HTTP endpoints for unwanted cross-origin write potential, request-size limits, static path traversal, unsafe error disclosure, and shell command construction.
- Do not require SaaS-style auth unless the server intentionally listens beyond localhost or exposes sensitive operations to other users.

### UX Correctness and Tests

- Identify fragile UI state around selection restore, undo/redo, draft tabs, display checkboxes, detached panels, comparison mode, and close/save status.
- Look for untested critical paths and suggest focused smoke tests around import/export, history sidecars, summary caching, and large-draft comparisons.
- Note where a bug needs browser or packaged Electron verification rather than static confidence.

## Report Format

Write:

```markdown
# Audit Report - Draft Diff Editor / <date> / <commit>
## Executive Summary
<five lines max: overall risk, highest-value fix, counts by severity, scope, key limitation>
## Fix First
<top five one-line findings with file:line>
## Findings
### <Focus Area>
| # | Finding | Evidence | Severity | Effort | Confidence |
## Refactor Plan
| Candidate | Why | Risk Reduced | Rough Size | Verification |
## Efficiency Wins
| Candidate | Trigger/Input Size | Expected Benefit | Risk | Verification |
## Looks Bad But Is Fine
<mandatory false-positive section>
## NEEDS-HUMAN
<yes/no questions for unverifiable intent>
## Could Not Verify
<tools/checks skipped, unavailable, blocked, or requiring browser/Electron packaging>
## Diff vs Previous Audit
<RESOLVED / STALE / NEW if a previous report exists; omit on first run>
```

Severity:
- Critical: likely irreversible data loss, arbitrary local file overwrite/read beyond user intent, or remote code execution.
- High: broken critical save/open/history path, serious Electron/local-server boundary issue, or severe large-document freeze.
- Medium: real correctness, maintainability, or performance risk that will slow future changes or affect realistic documents.
- Low: cleanup, clarity, or narrow edge case with modest product impact.
