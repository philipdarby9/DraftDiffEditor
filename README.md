# Draft Diff Editor

A local-first writing editor for tracking drafts, draft notes, and line-by-line changes between versions.

## Run

```sh
npm start
```

Then open `http://localhost:4173`.

## What It Does

- Keeps initial notes, drafts, and notes for each draft.
- Opens as a Notepad-style editor with a ribbon, horizontal draft tabs, Story Notes on the left, and the selected draft plus draft notes on the right.
- Adds a blank draft with the `+` tab or a new draft copied from the selected draft.
- Lets the draft notes panel be resized with the divider between the draft and notes.
- Shows comparisons as side-by-side draft pages, with the later draft page marking individual word and phrase changes inline.
- Compares either every draft to the first draft or each draft to the previous draft.
- Saves the working project to `data/project.json`.
- Updates the companion document at `data/draft-history.txt` on every save, on tab close, and when the server exits.

The companion text document is ordered as:

```text
Story Notes
Draft 1
Draft 1 Notes
Draft 2
Draft 2 Notes
...
```

Each page begins with the date and time that page or draft was created.
