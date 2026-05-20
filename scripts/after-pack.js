const fs = require("node:fs");
const path = require("node:path");
const { execFileSync } = require("node:child_process");

function editResources(executablePath, iconPath) {
  const rceditPath = path.join(__dirname, "..", "node_modules", "electron-winstaller", "vendor", "rcedit.exe");

  if (!fs.existsSync(rceditPath)) {
    throw new Error(`rcedit.exe not found at ${rceditPath}`);
  }

  execFileSync(rceditPath, [executablePath, "--set-icon", iconPath], {
    stdio: "ignore"
  });
}

exports.default = async function afterPack(context) {
  if (process.env.DRAFT_DIFF_SKIP_EXE_ICON === "1") return;
  if (context.electronPlatformName !== "win32") return;

  const iconPath = path.join(context.packager.projectDir, "build", "icon.ico");
  const executablePath = path.join(context.appOutDir, `${context.packager.appInfo.productFilename}.exe`);
  await editResources(executablePath, iconPath);
};
