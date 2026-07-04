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
node -e "const asar=require('@electron/asar'); const server=asar.extractFile('dist/linux-unpacked/resources/app.asar','server.js').toString(); const app=asar.extractFile('dist/linux-unpacked/resources/app.asar','public/app.js').toString(); const main=asar.extractFile('dist/linux-unpacked/resources/app.asar','desktop/main.js').toString(); console.log({hasLinuxFileDialog:server.includes('chooseTextFileWithElectronDialog'),hasLinuxFolderDialog:server.includes('chooseFolderWithElectronDialog'),desktopOpenIpc:main.includes('openTextFileWithDesktopDialog'),rendererPrefersDesktopOpen:app.includes('window.draftDiffDesktop?.openTextFile'),hasUsbReviewLabel:server.includes('Not yet on this computer')});"
```

Expected output:

```text
{
  hasLinuxFileDialog: true,
  hasLinuxFolderDialog: true,
  desktopOpenIpc: true,
  rendererPrefersDesktopOpen: true,
  hasUsbReviewLabel: true
}
```

Then smoke-test the installed app on Linux:

1. Open `File` -> `Open...` and confirm a native text-file picker opens. If the Linux desktop blocks the native picker, the app should fall back to the browser file picker instead of showing only `Open failed`.
2. Open `File` -> `Save as...` and confirm a native save-file picker opens.
3. Open `File` -> `Backup folder` and confirm a native folder picker opens.
4. Open `File` -> `Review USB import` and confirm a native folder picker opens.
5. Select a returned DraftDiff USB transfer folder whose destination story or backup folder does not yet exist on this computer. The review should say `Ready to import USB story`, and technical file details should say `Not yet on this computer`, not `Deleted on this computer`.

## Builder Workarounds Used On This Machine

In this sandbox, Electron Builder successfully created `dist/linux-unpacked`, but its final tar/deb packaging steps stalled. The release files were made from the validated unpacked app:

```sh
npm exec electron-builder -- --linux dir --x64
tar -C dist/linux-unpacked -czf dist/draft-diff-editor-0.1.0.tar.gz .
```

For the `.deb`, stage `dist/linux-unpacked` under `/opt/draft-diff-editor`, add a desktop entry under `/usr/share/applications`, add the icon under `/usr/share/icons/hicolor/512x512/apps`, and include `Installed-Size` in `DEBIAN/control` so Linux installers can display the package size:

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
