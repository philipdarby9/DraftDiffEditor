# Draft Diff Editor

A local-first rich text writing editor for tracking drafts, draft notes, and semantic changes between versions.

## Run

```sh
npm start
```

Then open `http://localhost:4173`.

For the desktop shell:

```sh
npm run desktop
```

To create a Windows build:

```sh
npm run package:win
```

To create a Linux build:

```sh
npm run package:linux
```

This creates `dist/draft-diff-editor-0.1.0.tar.gz`. Extract the archive on Linux and run `draft-diff-editor`.

To create a double-clickable Debian/Ubuntu installer:

```sh
npm run package:linux:deb
```

This creates `dist/draft-diff-editor_0.1.0_amd64.deb`, which can be opened from the Linux file manager to install the app. Build this package from Linux/WSL; on Windows, Electron Builder needs the Linux `fpm` packaging tool and may fail with `spawn fpm ENOENT`.

An AppImage target is also available:

```sh
npm run package:linux:appimage
```

On Windows, AppImage packaging may require symlink privileges. If Windows reports that a required privilege is not held by the client, build the AppImage from Linux/WSL or enable Windows Developer Mode and rerun the command.

## What It Does

- Keeps initial notes, drafts, and notes for each draft.
- Opens as a Notepad-style editor with a ribbon, horizontal draft tabs, and a left-to-right page canvas.
- Lets you show or hide Project notes and draft stacks from the tab checkboxes.
- Shows each selected draft with its notes as an adjustable panel underneath.
- Lets you choose whether 1, 2, 3, or 4 writing pages fit on screen at once.
- Remembers display choices, pages-on-screen, note panel state, and comparison selections separately for each opened text file.
- Adds a blank draft with the `+` tab or a new draft copied from the selected draft.
- Shows a delete control on an empty draft tab only when the draft and its notes have no text.
- Gives each writing page a formatting ribbon that appears from the top border of that page.
- Stores page font settings separately for each story, draft, and notes page.
- Shows the active companion text file name in the title bar.
- Includes a `File` menu with `New`, `Open...`, and `Save as...` for creating, importing, and saving renamed text-backed projects.
- Lets you choose specific drafts to compare.
- Shows selected comparisons as a fixed-size horizontal strip of draft pages, with later drafts marking words, phrases, spaces, tabs, bold, and italic changes inline.
- Compares selected drafts either to the first selected draft or to the previous selected draft.
- Saves the working project to `data/project.json`.
- Updates the companion document at `data/draft-history.txt` on every save, on tab close, and when the server exits.
- When the browser supports writable file handles, a text file created or opened from the `File` menu is kept in sync on every save as well.

The companion text document is ordered as:

```text
Project notes
Draft 1
Draft 1 Notes
Draft 2
Draft 2 Notes
...
```

Each page begins with the date and time that page or draft was created.
