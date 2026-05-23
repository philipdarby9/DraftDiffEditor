---
name: draft-diff-importer
description: Convert messy story or poem draft documents, working notes, revision notes, and pasted draft histories into Draft Diff Editor companion text files. Use when Codex needs to copy an original writing document, read and classify drafts versus notes, order drafts as Draft 1, Draft 2, Draft 3, etc., attach draft-specific notes, put uncertain notes in Project notes, and save an importable `.txt` file for this Draft Diff Editor app.
---

# Draft Diff Importer

## Goal

Convert an unstructured writing document into the Draft Diff Editor companion text format:

```text
Created: <date>
Project notes

<general notes>

---

Created: <date>
Draft 1

<earliest draft text>

---

Created: <date>
Draft 1 Notes

<notes for Draft 1>
```

Continue with `Draft 2`, `Draft 2 Notes`, etc. The app imports this text through `File > Open...`.

## Workflow

1. Create a local conversion folder under the app workspace:
   `draft-diff-imports/<source-stem>-<YYYYMMDD-HHMMSS>/`.
2. Copy the original source document into that folder before changing anything. If the user pasted text instead of providing a file, save the pasted source as `source.txt` in that folder.
3. Read the whole source closely enough to identify all candidate drafts, note blocks, dates, labels, and ordering signals.
4. Build a `sections.json` file in the conversion folder with this shape:

```json
{
  "created_at": "2026-05-22T16:00:00+01:00",
  "project_notes": "general notes and uncertain material",
  "drafts": [
    {
      "title": "Draft 1",
      "content": "earliest draft text",
      "notes": "notes belonging to Draft 1"
    }
  ]
}
```

5. Run `scripts/build_draftdiff_text.py` to create the import file:

```powershell
python skills\draft-diff-importer\scripts\build_draftdiff_text.py draft-diff-imports\<folder>\sections.json draft-diff-imports\<folder>\<source-stem>-draft-diff.txt
```

6. Tell the user the output file path and any ordering/classification uncertainties.

## Classification Rules

- Preserve the user's creative text. Do not rewrite, polish, summarize, or normalize dialect, spelling, punctuation, line breaks, or paragraphing except for removing structural wrapper lines.
- Treat sustained prose paragraphs or poem stanzas as draft text when they appear to be a full attempt at the piece.
- Treat bullets, headings, TODOs, revision plans, meta-commentary, analysis, prompts, critique, and "maybe/try/cut/change" material as notes.
- Treat general notes near the top of the document as Project notes unless they clearly belong to a specific draft.
- Treat notes between `Draft 2` and `Draft 3` as `Draft 2 Notes`. In general, notes below a draft belong to that draft until the next draft begins.
- If a prose fragment below a draft is noticeably shorter than the draft above it and looks like a scrapped or alternative fragment, put it in that draft's notes panel rather than making it a new draft.
- When note ownership is unclear, put the material in Project notes.
- If the source uses isolated asterisk lines or a draft between two asterisk markers, treat the wrapped block as a strong draft candidate and remove only the wrapper markers from the imported draft text. Preserve asterisks that are part of the poem or story itself.

## Draft Ordering

- Draft Diff Editor should normally receive drafts from earliest to latest: `Draft 1` is the earliest version and the highest draft number is the latest.
- Prefer explicit source labels and dates over heuristics. Labels such as `Draft 1`, `Draft 2`, dated headings, `latest`, `final`, `new version`, or `old version` should control ordering when they are clear.
- If the document says the most recent drafts are at the top, reverse that stack so the latest draft becomes the highest-numbered draft in the output.
- If there are no labels, assume drafts progress down the page.
- Override simple top-to-bottom order when the evidence is obvious: for example, a polished, much longer, more complete draft at the top and rougher shorter attempts below may mean the document is reverse chronological.
- When the ordering decision is uncertain, choose the most defensible order, keep all text, and mention the uncertainty in the final response.

## App Format Requirements

- Use exactly one block per Project notes page, draft page, and draft-notes page.
- Separate blocks with a blank line, `---`, and another blank line.
- Each block must start with `Created: <date>`, then the page title on the next line, then one blank line, then the body.
- Use page titles `Project notes`, `Draft 1`, `Draft 1 Notes`, `Draft 2`, `Draft 2 Notes`, etc.
- Do not allow the exact separator pattern inside page content. If the source contains a standalone `---` scene break surrounded by blank lines, convert that internal scene break to another visible marker such as `- - -` before running the helper.
- Empty pages should contain `[No text yet]`; the app imports that as blank.

## Quality Check

Before finishing:

- Confirm the output has one Project notes block and a notes block for every draft.
- Confirm `Draft N Notes` follows `Draft N`.
- Confirm no draft text was accidentally placed in Project notes due to uncertainty unless it is genuinely a fragment or scrapped passage.
- Confirm the original source copy, `sections.json`, and final import `.txt` are in the conversion folder.
