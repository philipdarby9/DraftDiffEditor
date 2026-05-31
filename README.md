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

## Data Location

Draft Diff Editor stores the working project, companion text export, and linked-file cache in one data directory.

- When running the server from this repository, the default data directory is `data/`.
- In the packaged desktop app, the default data directory is the app's OS user data folder, under `data/`.
- To use another folder in any mode, set `DRAFT_DIFF_DATA_DIR` before launch.
- The desktop app also accepts `--data-dir`.

PowerShell example:

```powershell
$env:DRAFT_DIFF_DATA_DIR = "D:\Writing\Draft Diff Editor Data"
npm start
```

Packaged desktop shortcut example:

```text
"C:\Program Files\Draft Diff Editor\Draft Diff Editor.exe" --data-dir="D:\Writing\Draft Diff Editor Data"
```

Use `File` -> `Backup folder` to choose or create a shared backup/history folder. Version-history JSON sidecars are written under that folder's `json` subfolder, named like `draft-history.version-history.json`. When a text file is opened, the app looks for a matching sidecar by source path metadata or by filename, then merges those histories into the matching Project notes and draft pages.

Use `File` -> `Activate backup` to choose or create the same shared folder. When backup is active, closing the app or switching to another text file writes the latest companion text file under `original txt` and queues an HTML summary under `version history summaries`. The summary and in-app version history include red/green comparisons with adjacent autosave snapshots coalesced when they touch the same local word or phrase. Summary generation runs in the background and is skipped when the source history and current text have not changed; the skip metadata is kept separately under `version history summary cache`.

To move existing histories into the shared folder, open the project, choose `File` -> `Backup folder`, select or create the folder, and let the app save. Existing embedded histories are written into the matching sidecar file in `json`.

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
- Lets you choose whether 1, 2, 3, or 4 writing pages fit on screen at once, then drag the dividers between visible pages to fine-tune panel widths.
- Remembers display choices, page widths, pages-on-screen, note panel state, and comparison selections separately for each opened text file.
- Adds a blank draft with the `+` tab or a new draft copied from the selected draft.
- Shows a delete control on an empty draft tab only when the draft and its notes have no text.
- Gives each writing page a formatting ribbon that appears from the top border of that page.
- Stores page font settings separately for each story, draft, and notes page.
- Shows the active companion text file name in the title bar.
- Includes a `File` menu with `New`, `Open...`, `Open recent`, `Save as...`, `Activate backup`, and `Backup folder` for creating, importing, reopening recent files, saving renamed text-backed projects, choosing the shared history/backup folder, and enabling close-time backups.
- Lets you choose specific drafts to compare.
- Shows selected comparisons as a fixed-size horizontal strip of draft pages, with later drafts marking words, phrases, spaces, tabs, bold, and italic changes inline.
- Compares selected drafts either to the first selected draft or to the previous selected draft.
- Saves the working project to `project.json` in the configured data directory.
- Updates the companion document at `draft-history.txt` in the configured data directory on every save, on tab close, and when the server exits.
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
