# Draft Diff Editor

A local-first rich text writing editor for tracking drafts, draft notes, and semantic changes between versions.

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
- Gives each writing page a hover ribbon for page font settings and inline formatting.
- Stores page font settings separately for each story, draft, and notes page.
- Lets you choose specific drafts to compare.
- Shows selected comparisons as a fixed-size horizontal strip of draft pages, with later drafts marking words, phrases, spaces, tabs, bold, and italic changes inline.
- Compares selected drafts either to the first selected draft or to the previous selected draft.
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
