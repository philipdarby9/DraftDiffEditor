# Windows Build Notes

Build Windows releases from Windows when possible.

## Prerequisites

- Windows
- Node.js 20 or newer
- npm

The Windows package uses `build/icon.ico` for the executable and installer icon. The Linux launcher icon set under `build/icons` is used only by the Linux package configuration and does not replace the Windows `.ico`.

## Build

```sh
npm ci
npm run test:server
npm run test:desktop
npm run package:win
```

Expected outputs include the NSIS installer and portable executable under `dist/`.

## Verify

Before publishing a Windows build, confirm the packaged app contains the backup-folder IPC fallback and the Windows native dialog routes:

```sh
node -e "const asar=require('@electron/asar'); const server=asar.extractFile('dist/win-unpacked/resources/app.asar','server.js').toString(); const main=asar.extractFile('dist/win-unpacked/resources/app.asar','desktop/main.js').toString(); const app=asar.extractFile('dist/win-unpacked/resources/app.asar','public/app.js').toString(); console.log({hasWindowsFolderDialog:server.includes('System.Windows.Forms.FolderBrowserDialog'),hasWindowsOpenDialog:server.includes('System.Windows.Forms.OpenFileDialog'),hasWindowsSaveDialog:server.includes('System.Windows.Forms.SaveFileDialog'),backupFolderIpc:main.includes('draft-diff:activate-backup')&&main.includes('draft-diff:select-version-history-folder'),rendererBackupFallback:app.includes('draftDiffDesktop?.activateBackup')&&app.includes('draftDiffDesktop?.selectVersionHistoryFolder')});"
```

Expected result:

```text
{
  hasWindowsFolderDialog: true,
  hasWindowsOpenDialog: true,
  hasWindowsSaveDialog: true,
  backupFolderIpc: true,
  rendererBackupFallback: true
}
```

Smoke-test:

1. Open `File` -> `Open...` and confirm a native text-file picker opens.
2. Open `File` -> `Save as...` and confirm a native save-file picker opens.
3. Open `File` -> `Backup folder` and confirm a folder picker opens.
4. Rename an active backup folder, relaunch the app, select the renamed folder, and confirm the current story history loads without a misleading missing-history warning.
