# macOS Build Notes

Build macOS releases from the latest branch that includes the native macOS picker fixes. The fixes are in `server.js`: `Open...` and `Save as...` must route through `chooseTextFileWithNativeDialog`, and `Backup folder`, `Activate backup`, and USB transfer folder selection must route through `chooseFolderWithNativeDialog`. These helpers use `osascript` on macOS.

## Prerequisites

- macOS
- Node.js 20 or newer
- npm
- Xcode command line tools, including `hdiutil`, `ditto`, and `zipinfo`

The current mac build script creates an x64 app. It is unsigned unless a Developer ID signing setup is added separately.

## Build

```sh
git checkout codex/usb-conflict-merge-review
git pull
npm ci
npm run test:server
npm run test:desktop
npm run package:mac
```

Expected outputs:

```text
dist/Draft Diff Editor-0.1.0.dmg
dist/Draft Diff Editor-0.1.0-mac.zip
dist/Draft Diff Editor-0.1.0-mac.zip.blockmap
```

`npm run package:mac` builds the portable ZIP with Electron Builder, then creates the installer DMG with macOS `hdiutil`. This avoids the Electron Builder DMG helper issue seen on this Mac, where the downloaded `dmgbuild` binary required a missing `/usr/local/opt/gettext/lib/libintl.8.dylib`.

## Verify

```sh
hdiutil verify "dist/Draft Diff Editor-0.1.0.dmg"
zipinfo -t "dist/Draft Diff Editor-0.1.0-mac.zip"
```

Optional DMG mount check:

```sh
mountpoint=$(mktemp -d)
hdiutil attach -nobrowse -readonly -mountpoint "$mountpoint" "dist/Draft Diff Editor-0.1.0.dmg"
find "$mountpoint" -maxdepth 1 -print
hdiutil detach "$mountpoint"
```

The mounted DMG should contain:

```text
Draft Diff Editor.app
Applications
```

To confirm the packaged app contains the mac picker fixes:

```sh
node -e "const asar=require('@electron/asar'); const text=asar.extractFile('dist/mac/Draft Diff Editor.app/Contents/Resources/app.asar','server.js').toString(); console.log({hasMacFolderDialog:text.includes('choose folder with prompt promptText default location initialFolder'),hasMacOpenDialog:text.includes('choose file with prompt promptText default location initialFolder'),hasMacSaveDialog:text.includes('choose file name with prompt promptText default name initialName default location initialFolder'),hasOldBackupError:text.includes('Backup folder selection is only available in the desktop Windows dialog right now.')});"
```

Expected result:

```text
{
  hasMacFolderDialog: true,
  hasMacOpenDialog: true,
  hasMacSaveDialog: true,
  hasOldBackupError: false
}
```

## Manual DMG Fallback

If the ZIP build succeeds but the DMG step needs to be rerun manually:

```sh
staging=$(mktemp -d)
ditto "dist/mac/Draft Diff Editor.app" "$staging/Draft Diff Editor.app"
ln -s /Applications "$staging/Applications"
rm -f "dist/Draft Diff Editor-0.1.0.dmg"
hdiutil create -volname "Draft Diff Editor" -srcfolder "$staging" -format UDZO "dist/Draft Diff Editor-0.1.0.dmg"
```

## Signing Note

Unsigned builds may trigger Gatekeeper warnings. For public distribution, sign with a Developer ID Application certificate and notarize the final DMG.
