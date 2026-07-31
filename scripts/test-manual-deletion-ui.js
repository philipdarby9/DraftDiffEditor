const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { app, BrowserWindow } = require("electron");

const workspace = path.resolve(__dirname, "..");
const fixtureDir = fs.mkdtempSync(path.join(os.tmpdir(), "draft-diff-manual-deletion-ui-"));
const backupRoot = path.join(fixtureDir, "backup-root");
const readyFolder = path.join(
  backupRoot,
  "version history JSON archive",
  "Ready for manual deletion"
);
const readyRunFolder = path.join(
  readyFolder,
  "retention-2026-06-01T10-00-00-000Z-ui-test"
);
const desktopScreenshotPath = path.join(
  workspace,
  ".codex-screens",
  "manual-deletion-reminder.png"
);
const narrowScreenshotPath = path.join(
  workspace,
  ".codex-screens",
  "manual-deletion-manager-narrow.png"
);

fs.mkdirSync(readyRunFolder, { recursive: true });
fs.writeFileSync(
  path.join(readyRunFolder, "queued.version-history.json"),
  `${JSON.stringify({ queued: true, content: "Archived version history" }, null, 2)}\n`,
  "utf8"
);
fs.writeFileSync(
  path.join(fixtureDir, "version-history-folder.json"),
  `${JSON.stringify({ folderPath: backupRoot }, null, 2)}\n`,
  "utf8"
);
process.env.DRAFT_DIFF_DATA_DIR = fixtureDir;
process.env.DRAFT_DIFF_HOST = "127.0.0.1";

const { startServer, stopServer } = require("../server");
app.on("window-all-closed", () => {});

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function waitFor(window, expression, label, timeoutMs = 15_000) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    if (await window.webContents.executeJavaScript(`Boolean(${expression})`)) return;
    await delay(60);
  }
  throw new Error(`Timed out waiting for ${label}`);
}

async function capture(window, filePath) {
  window.show();
  window.focus();
  window.webContents.invalidate();
  await delay(250);
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, (await window.capturePage()).toPNG());
}

async function run() {
  await app.whenReady();
  const started = await startServer({ port: 0, host: "127.0.0.1" });
  const window = new BrowserWindow({
    show: false,
    width: 960,
    height: 720,
    webPreferences: {
      contextIsolation: true,
      sandbox: true
    }
  });

  try {
    await window.loadURL(started.url);
    await waitFor(
      window,
      '!document.querySelector("#manual-deletion-reminder")?.hidden',
      "startup manual-deletion reminder"
    );
    await waitFor(
      window,
      'document.activeElement?.id === "manual-deletion-reminder-open"',
      "startup reminder focus"
    );

    const reminder = await window.webContents.executeJavaScript(`
      (() => {
        const overlay = document.querySelector("#manual-deletion-reminder");
        const panel = document.querySelector("#manual-deletion-reminder-panel");
        const rect = panel.getBoundingClientRect();
        return {
          title: document.querySelector("#manual-deletion-reminder-title").textContent.trim(),
          summary: document.querySelector("#manual-deletion-reminder-summary").textContent.trim(),
          folderPath: document.querySelector("#manual-deletion-reminder-path").textContent.trim(),
          openText: document.querySelector("#manual-deletion-reminder-open").textContent.trim(),
          laterText: document.querySelector("#manual-deletion-reminder-later").textContent.trim(),
          activeId: document.activeElement?.id || "",
          insideViewport: rect.left >= 0
            && rect.top >= 0
            && rect.right <= innerWidth
            && rect.bottom <= innerHeight,
          overlayHidden: overlay.hidden,
          oldDeleteButtonPresent: Boolean(document.querySelector("#backup-storage-expiry-delete"))
        };
      })()
    `);
    assert.equal(reminder.title, "Archived backups need your attention");
    assert.match(reminder.summary, /1 item/u);
    assert.match(reminder.summary, /1 run/u);
    assert.equal(path.resolve(reminder.folderPath), path.resolve(readyFolder));
    assert.equal(reminder.openText, "Open folder");
    assert.equal(reminder.laterText, "Remind me later");
    assert.equal(reminder.activeId, "manual-deletion-reminder-open");
    assert.equal(reminder.insideViewport, true);
    assert.equal(reminder.overlayHidden, false);
    assert.equal(reminder.oldDeleteButtonPresent, false);
    await capture(window, desktopScreenshotPath);

    await window.webContents.executeJavaScript(`
      document.querySelector("#manual-deletion-reminder-later").click()
    `);
    await waitFor(
      window,
      'document.querySelector("#manual-deletion-reminder")?.hidden',
      "session reminder dismissal"
    );
    const sessionDismissal = await window.webContents.executeJavaScript(`
      (() => {
        showManualDeletionReminder(backupStorageManualDeletion);
        return {
          hidden: document.querySelector("#manual-deletion-reminder").hidden,
          dismissed: manualDeletionReminderDismissed
        };
      })()
    `);
    assert.deepEqual(sessionDismissal, { hidden: true, dismissed: true });

    await window.webContents.executeJavaScript(`
      (() => {
        const originalFetch = window.fetch.bind(window);
        window.__manualDeletionOpenRequests = [];
        window.fetch = (input, options = {}) => {
          if (String(input) === "/api/version-history-backups/manual-deletion/open") {
            window.__manualDeletionOpenRequests.push({
              method: options.method || "GET",
              hasBody: options.body !== undefined
            });
            return Promise.resolve(new Response(
              JSON.stringify({ ok: true }),
              { status: 200, headers: { "content-type": "application/json" } }
            ));
          }
          return originalFetch(input, options);
        };
        openBackupStorageManager();
      })()
    `);
    await waitFor(
      window,
      '!backupStorageBusy'
        + ' && !document.querySelector("#backup-storage-expiry-preview")?.hidden'
        + ' && !document.querySelector("#backup-storage-manual-deletion")?.hidden',
      "manual-deletion queue in backup storage manager",
      30_000
    );

    const manager = await window.webContents.executeJavaScript(`
      (() => {
        const panel = document.querySelector("#backup-storage-panel");
        const queue = document.querySelector("#backup-storage-manual-deletion");
        const queuePath = document.querySelector("#backup-storage-manual-deletion-path");
        const open = document.querySelector("#backup-storage-manual-deletion-open");
        const prepare = document.querySelector("#backup-storage-expiry-prepare");
        const panelRect = panel.getBoundingClientRect();
        const queueRect = queue.getBoundingClientRect();
        const openRect = open.getBoundingClientRect();
        const pathRect = queuePath.getBoundingClientRect();
        return {
          queueSummary: document.querySelector("#backup-storage-manual-deletion-summary").textContent.trim(),
          queuePath: queuePath.textContent.trim(),
          openText: open.textContent.trim(),
          prepareText: prepare.textContent.trim(),
          prepareClass: prepare.className,
          panelInsideViewport: panelRect.left >= 0
            && panelRect.top >= 0
            && panelRect.right <= innerWidth
            && panelRect.bottom <= innerHeight,
          queueInsidePanel: queueRect.left >= panelRect.left
            && queueRect.right <= panelRect.right
            && queueRect.top >= panelRect.top
            && queueRect.bottom <= panelRect.bottom,
          openDoesNotOverlapPath: openRect.left >= pathRect.right
            || openRect.top >= pathRect.bottom
            || openRect.bottom <= pathRect.top,
          horizontalOverflow: document.documentElement.scrollWidth > innerWidth + 1
        };
      })()
    `);
    assert.match(manager.queueSummary, /1 item/u);
    assert.match(manager.queueSummary, /1 run/u);
    assert.equal(path.resolve(manager.queuePath), path.resolve(readyFolder));
    assert.equal(manager.openText, "Open folder");
    assert.equal(manager.prepareText, "Prepare for manual deletion");
    assert.match(manager.prepareClass, /backup-storage-prepare/u);
    assert.doesNotMatch(manager.prepareClass, /danger/u);
    assert.equal(manager.panelInsideViewport, true);
    assert.equal(manager.queueInsidePanel, true);
    assert.equal(manager.openDoesNotOverlapPath, true);
    assert.equal(manager.horizontalOverflow, false);

    await window.webContents.executeJavaScript(`
      document.querySelector("#backup-storage-manual-deletion-open").click()
    `);
    await waitFor(
      window,
      'window.__manualDeletionOpenRequests.length === 1',
      "server-scoped Open folder request"
    );
    assert.deepEqual(
      await window.webContents.executeJavaScript("window.__manualDeletionOpenRequests[0]"),
      { method: "POST", hasBody: false }
    );

    window.setSize(720, 760);
    await delay(180);
    const narrow = await window.webContents.executeJavaScript(`
      (() => {
        const panel = document.querySelector("#backup-storage-panel").getBoundingClientRect();
        const queue = document.querySelector("#backup-storage-manual-deletion").getBoundingClientRect();
        const open = document.querySelector("#backup-storage-manual-deletion-open").getBoundingClientRect();
        return {
          panelInsideViewport: panel.left >= 0
            && panel.top >= 0
            && panel.right <= innerWidth
            && panel.bottom <= innerHeight,
          openInsideQueue: open.left >= queue.left
            && open.right <= queue.right
            && open.top >= queue.top
            && open.bottom <= queue.bottom,
          horizontalOverflow: document.documentElement.scrollWidth > innerWidth + 1
        };
      })()
    `);
    assert.deepEqual(narrow, {
      panelInsideViewport: true,
      openInsideQueue: true,
      horizontalOverflow: false
    });
    await window.webContents.executeJavaScript(`
      document.querySelector("#backup-storage-manual-deletion").scrollIntoView({
        block: "center"
      })
    `);
    await delay(120);
    await capture(window, narrowScreenshotPath);

    console.log("manual-deletion UI test passed");
    console.log(`Screenshots: ${desktopScreenshotPath}, ${narrowScreenshotPath}`);
  } finally {
    const stopping = stopServer(started.server, { flush: false });
    started.server.closeAllConnections?.();
    await stopping;
    window.destroy();
  }
}

run()
  .catch(error => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => {
    fs.rmSync(fixtureDir, { recursive: true, force: true });
    app.exit(process.exitCode || 0);
  });
