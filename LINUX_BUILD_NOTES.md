# Linux Build Notes

Current branch: `linux-build`

The Windows machine can build the portable Linux archive:

```sh
npm run package:linux
```

Verified output on Windows:

```text
dist/draft-diff-editor-0.1.0.tar.gz
```

That archive can be extracted on Linux and launched by double-clicking `draft-diff-editor` inside the extracted folder, if the file manager allows executable files to run.

## Next Linux Step

Build the double-clickable Debian/Ubuntu installer from Linux or WSL:

```sh
git checkout linux-build
npm install
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
