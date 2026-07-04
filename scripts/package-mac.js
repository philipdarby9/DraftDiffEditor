const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

const projectRoot = path.join(__dirname, "..");
const packageJson = require("../package.json");
const productName = packageJson.build?.productName || packageJson.name;
const version = packageJson.version;
const distDir = path.join(projectRoot, "dist");
const appPath = path.join(distDir, "mac", `${productName}.app`);
const dmgPath = path.join(distDir, `${productName}-${version}.dmg`);
const electronBuilder = path.join(
  projectRoot,
  "node_modules",
  ".bin",
  process.platform === "win32" ? "electron-builder.cmd" : "electron-builder"
);

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: projectRoot,
    stdio: "inherit",
    ...options
  });

  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status || 1);
}

if (process.platform !== "darwin") {
  throw new Error("package:mac must be run on macOS because it creates a DMG with hdiutil.");
}

run(electronBuilder, ["--mac", "zip", "--x64"]);

if (!fs.existsSync(appPath)) {
  throw new Error(`Packaged app not found at ${appPath}`);
}

const stagingDir = fs.mkdtempSync(path.join(os.tmpdir(), "draft-diff-editor-dmg-"));

try {
  fs.rmSync(dmgPath, { force: true });
  run("ditto", [appPath, path.join(stagingDir, `${productName}.app`)]);
  fs.symlinkSync("/Applications", path.join(stagingDir, "Applications"));
  run("hdiutil", [
    "create",
    "-volname",
    productName,
    "-srcfolder",
    stagingDir,
    "-format",
    "UDZO",
    dmgPath
  ]);
} finally {
  fs.rmSync(stagingDir, { recursive: true, force: true });
}
