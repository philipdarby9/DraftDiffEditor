# Linux Build Notes

Build Linux packages from Linux or WSL when possible.

## Build Outputs

Install dependencies once:

```sh
npm install
```

Build the portable Linux archive:

```sh
npm run package:linux
```

Expected output:

```text
dist/draft-diff-editor-0.1.0.tar.gz
```

That archive can be extracted on Linux and launched by double-clicking `draft-diff-editor` inside the extracted folder, if the file manager allows executable files to run.

Build the double-clickable Debian/Ubuntu installer:

```sh
npm run package:linux:deb
```

Expected output:

```text
dist/draft-diff-editor_0.1.0_amd64.deb
```

On Ubuntu/Debian-style Linux, double-click the `.deb` file to install it, then launch Draft Diff Editor from the applications menu.

If the `.deb` build fails because `fpm` is missing, install the packaging dependency and rerun:

```sh
sudo apt update
sudo apt install -y ruby ruby-dev build-essential
sudo gem install --no-document fpm
npm run package:linux:deb
```

The AppImage target exists as `npm run package:linux:appimage`, but Windows hit a symlink permission error while building it. Prefer `.deb` first.

## Required Linux Verification

Before publishing a Linux build, verify the packaged app contains the Linux Electron dialogs used by text-file open/save, backup-folder selection, USB export, and USB import review. The desktop app should use IPC for text-file open/save, not the HTTP dialog route:

```sh
node -e "const asar=require('@electron/asar'); const server=asar.extractFile('dist/linux-unpacked/resources/app.asar','server.js').toString(); const app=asar.extractFile('dist/linux-unpacked/resources/app.asar','public/app.js').toString(); const main=asar.extractFile('dist/linux-unpacked/resources/app.asar','desktop/main.js').toString(); console.log({hasLinuxFileDialog:server.includes('chooseTextFileWithElectronDialog'),hasLinuxFolderDialog:server.includes('chooseFolderWithElectronDialog'),desktopOpenIpc:main.includes('openTextFileWithDesktopDialog'),rendererPrefersDesktopOpen:app.includes('window.draftDiffDesktop?.openTextFile'),backupFolderIpc:main.includes('draft-diff:activate-backup')&&main.includes('draft-diff:select-version-history-folder'),rendererBackupFallback:app.includes('draftDiffDesktop?.activateBackup')&&app.includes('draftDiffDesktop?.selectVersionHistoryFolder'),migrationSkipsLoss:server.includes('skipped: isLossError')&&server.includes('!error?.skipped'),hasUsbReviewLabel:server.includes('Not yet on this computer')});"
```

Expected output:

```text
{
  hasLinuxFileDialog: true,
  hasLinuxFolderDialog: true,
  desktopOpenIpc: true,
  rendererPrefersDesktopOpen: true,
  backupFolderIpc: true,
  rendererBackupFallback: true,
  migrationSkipsLoss: true,
  hasUsbReviewLabel: true
}
```

Verify the Debian package contains standard hicolor launcher icons. The Linux build uses `build/icons` rather than the root `icon.png`, because the source icon is 1254x1254 and some Linux launchers ignore nonstandard hicolor sizes:

```sh
dpkg-deb --contents dist/draft-diff-editor_0.1.0_amd64.deb | rg 'usr/share/icons/hicolor/.*/apps/draft-diff-editor.png|usr/share/applications/draft-diff-editor.desktop'
```

Expected icon sizes include at least `16x16`, `32x32`, `48x48`, `128x128`, `256x256`, `512x512`, and `1024x1024`.

Then smoke-test the installed app on Linux:

1. Open `File` -> `Open...` and confirm a native text-file picker opens. If the Linux desktop blocks the native picker, the app should fall back to the browser file picker instead of showing only `Open failed`.
2. Open `File` -> `Save as...` and confirm a native save-file picker opens.
3. Open `File` -> `Backup folder` and confirm a native folder picker opens.
4. Open `File` -> `Review USB import` and confirm a native folder picker opens.
5. Select a returned DraftDiff USB transfer folder whose destination story or backup folder does not yet exist on this computer. The review should say `Ready to import USB story`, and technical file details should say `Not yet on this computer`, not `Deleted on this computer`.

## Builder Workarounds Used On This Machine

In this sandbox, Electron Builder successfully creates `dist/linux-unpacked` quickly, but the `npm run package:linux` tarball path uses max-compression `7za -mx=9` and can take a very long time. For local test rebuilds, use the validated unpacked app and a fast gzip tarball:

```sh
npm exec electron-builder -- --linux dir --x64
tar -C dist -cf - linux-unpacked | gzip -1 > dist/draft-diff-editor-0.1.0.tar.gz
```

Validate the archive:

```sh
gzip -t dist/draft-diff-editor-0.1.0.tar.gz
tar -tzf dist/draft-diff-editor-0.1.0.tar.gz >/dev/null
```

For release builds, `npm run package:linux` is still acceptable if the extra compression time is worth the smaller archive.

The `.deb` target still uses `fpm` and xz compression and can take several minutes in this environment. Prefer the normal command so Electron Builder writes the desktop entry, hicolor icons, update metadata, and package scripts consistently:

```sh
npm run package:linux:deb
```

If the normal `.deb` build is impossible, stage `dist/linux-unpacked` under `/opt/draft-diff-editor`, add a desktop entry under `/usr/share/applications`, add all standard icons from `build/icons` under `/usr/share/icons/hicolor/<size>/apps`, and include `Installed-Size` in `DEBIAN/control` so Linux installers can display the package size:

```sh
installed_size=$(du -sk /tmp/dde-deb-root | awk '{print $1}')
printf '%s\n' \
  'Package: draft-diff-editor' \
  'Version: 0.1.0' \
  'Section: editors' \
  'Priority: optional' \
  'Architecture: amd64' \
  "Installed-Size: ${installed_size}" \
  'Maintainer: Philip Darby <draft-diff-editor@localhost>' \
  'Homepage: https://github.com/philipdarby9/DraftDiffEditor' \
  'Description: A local writing editor for managing drafts, notes, comparisons, and a companion text export.' \
  > /tmp/dde-deb-root/DEBIAN/control
```

Then build with:

```sh
dpkg-deb --root-owner-group -Znone --build /tmp/dde-deb-root dist/draft-diff-editor_0.1.0_amd64.deb
```

`-Znone` was used because compressed `dpkg-deb` also stalled in this sandbox. On a normal Linux machine, prefer `npm run package:linux` and `npm run package:linux:deb` first.

## Backup Folder Recovery Notes

When a backup folder is renamed or moved, selecting the renamed folder should reactivate backup and load matching histories for the current story. The app may still keep diagnostic inventory for previously opened stories, but the success status must not report a missing story unless there is a concrete problem with the current operation. If the selected folder already contains better sidecar JSON than an embedded project-state history, folder migration skips the lossy embedded write and preserves the existing sidecar.
