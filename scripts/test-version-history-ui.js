const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { app, BrowserWindow } = require("electron");

const workspace = path.resolve(__dirname, "..");
const fixtureDir = fs.mkdtempSync(path.join(os.tmpdir(), "draft-diff-history-ui-"));
const screenshotPath = path.join(workspace, ".codex-screens", "version-history-ui.png");
const scrollbarScreenshotPath = path.join(workspace, ".codex-screens", "version-history-scrollbar-ui.png");
const format = {
  fontFamily: "Consolas",
  fontSize: "12",
  lineHeight: "1.62"
};
const VERSION_COUNT = 268;
const sharedBody = Array.from(
  { length: 120 },
  (_, index) => `Paragraph ${index + 1} carries enough shared draft text to exercise the full history comparison renderer.`
).join(" ");

function version(index) {
  const number = index + 1;
  const special = index === 6 || index === 219 ? " flatulent" : "";
  const content = `Saved version ${number}${special}. This is the text for history page ${number}. ${sharedBody}`;
  return {
    id: `ui-version-${number}`,
    title: "History search test",
    createdAt: new Date(Date.UTC(2026, 0, number, 12)).toISOString(),
    content,
    contentHtml: `<p>${content}</p>`,
    format
  };
}

const versions = Array.from({ length: VERSION_COUNT }, (_, index) => version(index));
const latest = versions[versions.length - 1];
const fixture = {
  version: 1,
  formatDefaultVersion: 2,
  defaultFormat: format,
  createdAt: versions[0].createdAt,
  updatedAt: latest.createdAt,
  initialNotes: {
    id: "initial-notes",
    title: "Project notes",
    createdAt: versions[0].createdAt,
    updatedAt: versions[0].createdAt,
    content: "",
    contentHtml: "",
    format,
    versionHistory: []
  },
  drafts: [{
    id: "history-ui-draft",
    title: "History search test",
    createdAt: versions[0].createdAt,
    updatedAt: latest.createdAt,
    content: latest.content,
    contentHtml: latest.contentHtml,
    format,
    versionHistory: versions,
    notes: {
      id: "history-ui-notes",
      title: "History search test Notes",
      createdAt: versions[0].createdAt,
      updatedAt: versions[0].createdAt,
      content: "",
      contentHtml: "",
      format,
      versionHistory: []
    }
  }]
};

fs.writeFileSync(path.join(fixtureDir, "project.json"), JSON.stringify(fixture, null, 2));
process.env.DRAFT_DIFF_DATA_DIR = fixtureDir;

const { startServer, stopServer } = require("../server");
app.on("window-all-closed", () => {});

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function waitFor(window, expression, label, timeoutMs = 10_000) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    if (await window.webContents.executeJavaScript(`Boolean(${expression})`)) return;
    await delay(60);
  }
  throw new Error(`Timed out waiting for ${label}`);
}

async function activeSearchVersionId(window) {
  return window.webContents.executeJavaScript(`
    (() => {
      const highlight = CSS.highlights?.get("draft-diff-search-active");
      const range = highlight ? Array.from(highlight)[0] : null;
      const element = range
        ? (range.startContainer.nodeType === Node.ELEMENT_NODE
          ? range.startContainer
          : range.startContainer.parentElement)
        : null;
      return element?.closest("[data-compare-page-id]")?.dataset.comparePageId || "";
    })()
  `);
}

async function run() {
  await app.whenReady();
  const started = await startServer({ port: 0, host: "127.0.0.1" });
  const window = new BrowserWindow({
    show: false,
    width: 1440,
    height: 960,
    webPreferences: {
      contextIsolation: true,
      sandbox: true
    }
  });

  try {
    await window.loadURL(started.url);
    await waitFor(
      window,
      'document.querySelector(\'[data-version-history="draft:history-ui-draft:content"]\')',
      "draft history button"
    );
    await window.webContents.executeJavaScript(`
      document.querySelector('[data-version-history="draft:history-ui-draft:content"]').click()
    `);
    await waitFor(
      window,
      `document.querySelector(".history-virtual-strip")?.dataset.historyTotalPages === "${VERSION_COUNT}"`,
      `virtualized ${VERSION_COUNT}-version history`,
      30_000
    );

    const initial = await window.webContents.executeJavaScript(`
      ({
        pages: document.querySelectorAll(".version-history-strip .version-page").length,
        totalPages: Number(document.querySelector(".history-virtual-strip")?.dataset.historyTotalPages),
        filterText: document.querySelector(".history-version-filter")?.innerText || "",
        versionGroupLabels: Array.from(
          document.querySelectorAll("[data-history-version-filter-toggle]")
        ).map(button => button.innerText.trim()),
        hasAllVersions: Boolean(document.querySelector("[data-history-version-all]")),
        allVersionsText: document.querySelector("[data-history-version-all-label]")?.innerText.trim(),
        filterInHeader: document.querySelector(".compare-bar")?.contains(
          document.querySelector("#history-version-filter")
        ),
        scrolls: document.querySelector("#diff-output").scrollWidth > document.querySelector("#diff-output").clientWidth,
        scrollbarHeight: getComputedStyle(document.querySelector("#diff-output"), "::-webkit-scrollbar").height
      })
    `);
    assert.ok(initial.pages > 0 && initial.pages <= 20);
    assert.equal(initial.totalPages, VERSION_COUNT);
    assert.match(initial.filterText, /268 of 268/);
    assert.deepEqual(initial.versionGroupLabels, ["1–100", "101–200", "201–268"]);
    assert.equal(initial.hasAllVersions, true);
    assert.equal(initial.allVersionsText, "All versions");
    assert.equal(initial.filterInHeader, true);
    assert.equal(initial.scrolls, true);
    assert.equal(initial.scrollbarHeight, "10px");
    assert.deepEqual(
      await window.webContents.executeJavaScript(`
        [
          largestHistoryVersionGroupSize(9),
          largestHistoryVersionGroupSize(100),
          largestHistoryVersionGroupSize(101),
          largestHistoryVersionGroupSize(1000),
          largestHistoryVersionGroupSize(1001)
        ]
      `),
      [10, 100, 100, 1000, 1000]
    );

    const compactAllVersions = await window.webContents.executeJavaScript(`
      (() => {
        const filter = document.querySelector("#history-version-filter");
        filter.style.flex = "0 0 380px";
        updateAllVersionsLabelDensity();
        const result = {
          compact: document.querySelector(".history-version-tabs-panel").classList.contains("compact-all-versions"),
          text: document.querySelector("[data-history-version-all-label]").innerText.trim()
        };
        filter.style.removeProperty("flex");
        updateAllVersionsLabelDensity();
        return result;
      })()
    `);
    assert.equal(compactAllVersions.compact, true);
    assert.equal(compactAllVersions.text, "AV");

    await window.webContents.executeJavaScript(`
      (() => {
        const output = document.querySelector("#diff-output");
        output.scrollLeft = (50 * output.clientWidth) / historyVirtualState.visiblePages;
      })()
    `);
    await waitFor(
      window,
      'Boolean(document.querySelector(\'[data-history-position="50"]\')) && !historyVirtualScrollSuppressed && historyVirtualScrollFrame === null',
      "stable middle virtual history window"
    );
    const stableVerticalScroll = await window.webContents.executeJavaScript(`
      new Promise(resolve => {
        const output = document.querySelector("#diff-output");
        const page = document.querySelector('[data-history-position="50"]');
        const body = page.querySelector(".compare-page-body");
        const targetScrollTop = Math.min(420, body.scrollHeight - body.clientHeight);
        body.scrollTop = targetScrollTop;
        const header = page.querySelector(".title-row").textContent;
        let replacements = 0;
        const observer = new MutationObserver(records => {
          replacements += records.filter(record => record.type === "childList").length;
        });
        observer.observe(output, { childList: true, subtree: true });
        output.dispatchEvent(new Event("scroll"));

        let frames = 0;
        const check = () => {
          frames += 1;
          if (frames < 8) {
            requestAnimationFrame(check);
            return;
          }
          observer.disconnect();
          const currentPage = document.querySelector('[data-history-position="50"]');
          resolve({
            samePage: currentPage === page,
            scrollTop: currentPage?.querySelector(".compare-page-body")?.scrollTop || 0,
            targetScrollTop,
            sameHeader: currentPage?.querySelector(".title-row")?.textContent === header,
            replacements
          });
        };
        requestAnimationFrame(check);
      })
    `);
    assert.equal(stableVerticalScroll.samePage, true);
    assert.equal(stableVerticalScroll.scrollTop, stableVerticalScroll.targetScrollTop);
    assert.equal(stableVerticalScroll.sameHeader, true);
    assert.equal(stableVerticalScroll.replacements, 0);

    await window.webContents.executeJavaScript(`
      (() => {
        const output = document.querySelector("#diff-output");
        output.scrollLeft = (55 * output.clientWidth) / historyVirtualState.visiblePages;
      })()
    `);
    await waitFor(
      window,
      'document.querySelector(".history-virtual-strip")?.dataset.historyWindowStart === "50"',
      "next stable virtual history window"
    );
    assert.equal(
      await window.webContents.executeJavaScript(
        'document.querySelector(\'[data-history-position="50"] .compare-page-body\').scrollTop'
      ),
      stableVerticalScroll.targetScrollTop
    );

    await window.webContents.executeJavaScript(`
      (() => {
        const output = document.querySelector("#diff-output");
        output.scrollLeft = output.scrollWidth;
      })()
    `);
    await waitFor(
      window,
      'Boolean(document.querySelector(\'[data-history-position="267"]\'))',
      "last virtual history page"
    );
    assert.ok(
      await window.webContents.executeJavaScript(
        'document.querySelectorAll(".version-history-strip .version-page").length <= 20'
      )
    );

    await window.webContents.executeJavaScript(`
      document.dispatchEvent(new KeyboardEvent("keydown", {
        key: "f",
        ctrlKey: true,
        bubbles: true
      }))
    `);
    await waitFor(window, '!document.querySelector("#search-popover").hidden', "search popover");
    await window.webContents.executeJavaScript(`
      (() => {
        const input = document.querySelector("#search-input");
        input.value = "flatulent";
        input.dispatchEvent(new Event("input", { bubbles: true }));
      })()
    `);
    await waitFor(
      window,
      '!document.querySelector("#search-summary").textContent.startsWith("No matches")',
      "history search matches"
    );

    const firstActiveVersion = await activeSearchVersionId(window);
    assert.equal(firstActiveVersion, "ui-version-7");
    await window.webContents.executeJavaScript(`
      document.querySelector("#search-input").dispatchEvent(new KeyboardEvent("keydown", {
        key: "Enter",
        bubbles: true
      }))
    `);
    await waitFor(
      window,
      'Boolean(document.querySelector(\'[data-history-position="219"]\'))',
      "next off-screen history search result"
    );
    const nextActiveVersion = await activeSearchVersionId(window);
    assert.equal(nextActiveVersion, "ui-version-220");
    assert.notEqual(nextActiveVersion, firstActiveVersion);

    await window.webContents.executeJavaScript(`
      document.querySelector(
        '[data-history-version-filter-start="0"][data-history-version-filter-end="100"]'
      ).click()
    `);
    await waitFor(window, 'Boolean(document.querySelector(".history-version-menu"))', "version chooser");
    const topGroups = await window.webContents.executeJavaScript(`
      document.querySelectorAll(
        ".history-version-choices > .history-version-group"
      ).length
    `);
    assert.equal(topGroups, 10);

    const chooserScroll = await window.webContents.executeJavaScript(`
      (() => {
        const choices = document.querySelector(".history-version-choices");
        choices.scrollTop = 0;
        const before = choices.scrollTop;
        document.querySelector(".history-version-menu").dispatchEvent(new WheelEvent("wheel", {
          deltaY: 640,
          bubbles: true,
          cancelable: true
        }));
        return {
          before,
          after: choices.scrollTop,
          clientHeight: choices.clientHeight,
          scrollHeight: choices.scrollHeight,
          scrollbarWidth: getComputedStyle(choices, "::-webkit-scrollbar").width,
          focusable: choices.tabIndex
        };
      })()
    `);
    if (chooserScroll.scrollHeight > chooserScroll.clientHeight) {
      assert.ok(chooserScroll.after > chooserScroll.before);
    } else {
      assert.equal(chooserScroll.after, chooserScroll.before);
    }
    assert.equal(chooserScroll.scrollbarWidth, "14px");
    assert.equal(chooserScroll.focusable, 0);

    await window.webContents.executeJavaScript(`
      (() => {
        const group = document.querySelector(
          '[data-history-version-group-start="0"][data-history-version-group-end="100"]'
        );
        group.checked = false;
        group.dispatchEvent(new Event("change", { bubbles: true }));
      })()
    `);
    await waitFor(
      window,
      'document.querySelector(".history-virtual-strip")?.dataset.historyTotalPages === "168"',
      "excluded hundred-version pile",
      30_000
    );
    assert.match(
      await window.webContents.executeJavaScript(
        'document.querySelector(".history-version-total").innerText'
      ),
      /168 of 268/
    );

    await window.webContents.executeJavaScript(`
      document.querySelector(
        '[data-history-version-filter-start="200"][data-history-version-filter-end="268"]'
      ).click()
    `);
    await waitFor(
      window,
      'document.querySelector(".history-version-menu")?.getAttribute("aria-label") === "Choose versions 201 to 268"',
      "last version group chooser"
    );
    await window.webContents.executeJavaScript(`
      (() => {
        const group = document.querySelector(
          '[data-history-version-group-start="210"][data-history-version-group-end="220"]'
        ).closest("details");
        group.open = true;
        group.dispatchEvent(new Event("toggle"));
      })()
    `);
    await waitFor(
      window,
      'Boolean(document.querySelector(\'[data-history-version-index="219"]\'))',
      "lazy version cards"
    );
    await window.webContents.executeJavaScript(`
      (() => {
        const choices = document.querySelector(".history-version-choices");
        choices.scrollTop = Math.min(640, choices.scrollHeight - choices.clientHeight);
        window.__versionChooserScrollBefore = choices.scrollTop;
        window.__versionChooserMenuKeyBefore =
          choices.closest(".selection-menu-popover")?.dataset.selectionMenuKey || "";
        const version = document.querySelector('[data-history-version-index="219"]');
        version.checked = false;
        version.dispatchEvent(new Event("change", { bubbles: true }));
      })()
    `);
    const preservedVersionMenuScroll = await window.webContents.executeJavaScript(`
      (() => {
        const choices = document.querySelector(".history-version-choices");
        return {
          before: window.__versionChooserScrollBefore,
          after: choices.scrollTop,
          beforeMenuKey: window.__versionChooserMenuKeyBefore,
          menuKey: choices.closest(".selection-menu-popover")?.dataset.selectionMenuKey || "",
          checked: document.querySelector('[data-history-version-index="219"]').checked
        };
      })()
    `);
    assert.ok(preservedVersionMenuScroll.before > 0);
    assert.equal(preservedVersionMenuScroll.after, preservedVersionMenuScroll.before);
    assert.match(preservedVersionMenuScroll.menuKey, /:top:200:268$/);
    assert.equal(preservedVersionMenuScroll.menuKey, preservedVersionMenuScroll.beforeMenuKey);
    assert.equal(preservedVersionMenuScroll.checked, false);
    await waitFor(
      window,
      'document.querySelector(".history-virtual-strip")?.dataset.historyTotalPages === "167"',
      "excluded individual version"
    );
    await waitFor(
      window,
      'document.querySelector("#search-summary").textContent.startsWith("No matches")',
      "search refresh after exclusion"
    );
    await delay(800);
    await waitFor(
      window,
      `!document.querySelector(".diff-loading") &&
        document.querySelector(".history-virtual-strip")?.dataset.historyTotalPages === "167" &&
        document.querySelector("#search-summary").textContent.startsWith("No matches")`,
      "final filtered history render"
    );
    assert.ok(
      await window.webContents.executeJavaScript(
        'document.querySelectorAll(".version-history-strip .version-page").length <= 20'
      )
    );

    await window.webContents.executeJavaScript(`
      (() => {
        const range = document.querySelector(".history-version-menu .selection-menu-range");
        historyVersionExpandedGroups.add(range.dataset.historyVersionGroupKey);
        renderHistoryVersionFilter();
      })()
    `);
    await waitFor(
      window,
      'document.querySelector(".history-version-menu .selection-menu-range")?.open',
      "open shared version leaf menu"
    );
    const versionMenuLayout = await window.webContents.executeJavaScript(`
      (() => {
        const menu = document.querySelector(".history-version-menu");
        const openRange = menu?.querySelector(".selection-menu-range[open]");
        const contents = openRange?.querySelector(":scope > .selection-menu-range-contents");
        const cards = Array.from(contents?.querySelectorAll(":scope > .selection-menu-leaf") || []);
        const choices = menu?.querySelector(".selection-menu-choices");
        if (choices) choices.scrollTop = 0;
        return {
          piles: menu?.querySelectorAll(".selection-menu-pile").length || 0,
          cards: cards.length,
          zoomButtons: contents?.querySelectorAll(":scope > .selection-menu-leaf > .selection-menu-zoom").length || 0,
          addedTokens: contents?.querySelectorAll(".compare-token.added").length || 0,
          removedTokens: contents?.querySelectorAll(".compare-token.removed").length || 0,
          addedDecoration: (() => {
            const token = contents?.querySelector(".compare-token.added");
            return token ? getComputedStyle(token).textDecorationLine : "";
          })(),
          removedDecoration: (() => {
            const token = contents?.querySelector(".compare-token.removed");
            return token ? getComputedStyle(token).textDecorationLine : "";
          })(),
          menuDateStart: menu?.querySelector(".selection-menu-header-dates")
            ?.dataset.selectionDateStart || "",
          menuDateEnd: menu?.querySelector(".selection-menu-header-dates")
            ?.dataset.selectionDateEnd || "",
          rangeDateStart: openRange?.querySelector(":scope > summary .selection-menu-range-dates")
            ?.dataset.selectionDateStart || "",
          rangeDateEnd: openRange?.querySelector(":scope > summary .selection-menu-range-dates")
            ?.dataset.selectionDateEnd || "",
          firstCardTops: cards.slice(0, 2).map(card => card.getBoundingClientRect().top),
          choicesDisplay: choices ? getComputedStyle(choices).display : "",
          contentsDisplay: contents ? getComputedStyle(contents).display : ""
        };
      })()
    `);
    assert.equal(versionMenuLayout.piles, 7);
    assert.equal(versionMenuLayout.cards, 10);
    assert.equal(versionMenuLayout.zoomButtons, 10);
    assert.ok(versionMenuLayout.addedTokens > 0);
    assert.ok(versionMenuLayout.removedTokens > 0);
    assert.match(versionMenuLayout.addedDecoration, /underline/);
    assert.match(versionMenuLayout.removedDecoration, /line-through/);
    assert.equal(versionMenuLayout.menuDateStart, versions[200].createdAt);
    assert.equal(versionMenuLayout.menuDateEnd, versions[267].createdAt);
    assert.equal(versionMenuLayout.rangeDateStart, versions[200].createdAt);
    assert.equal(versionMenuLayout.rangeDateEnd, versions[209].createdAt);
    assert.equal(versionMenuLayout.firstCardTops[0], versionMenuLayout.firstCardTops[1]);
    assert.equal(versionMenuLayout.choicesDisplay, "flex");
    assert.equal(versionMenuLayout.contentsDisplay, "grid");
    await window.webContents.executeJavaScript(`
      document.querySelector(
        ".history-version-menu .selection-menu-range[open] .selection-menu-zoom"
      ).click()
    `);
    await waitFor(window, '!document.querySelector("#transfer-page-zoom").hidden', "version preview zoom");
    const versionZoom = await window.webContents.executeJavaScript(`
      ({
        title: document.querySelector("#transfer-page-zoom-title").innerText,
        text: document.querySelector("#transfer-page-zoom-paper").innerText,
        added: document.querySelectorAll("#transfer-page-zoom-paper .compare-token.added").length,
        removed: document.querySelectorAll("#transfer-page-zoom-paper .compare-token.removed").length,
        addedText: document.querySelector("#transfer-page-zoom-paper .compare-token.added")?.innerText || ""
      })
    `);
    assert.match(versionZoom.title, /201/);
    assert.match(versionZoom.text, /Saved version/);
    assert.match(versionZoom.addedText, /201/);
    assert.ok(versionZoom.added > 0);
    assert.ok(versionZoom.removed > 0);
    await window.webContents.executeJavaScript(`
      document.querySelector("#transfer-page-zoom-close").click()
    `);
    await waitFor(window, 'document.querySelector("#transfer-page-zoom").hidden', "closed version preview zoom");
    fs.mkdirSync(path.dirname(screenshotPath), { recursive: true });
    fs.writeFileSync(screenshotPath, (await window.capturePage()).toPNG());
    await window.webContents.executeJavaScript(`
      document.querySelector(
        '[data-history-version-filter-start="200"][data-history-version-filter-end="268"]'
      ).click()
    `);
    await waitFor(window, '!document.querySelector(".history-version-menu")', "closed version chooser");
    await window.webContents.executeJavaScript(`
      document.querySelector("#search-close").click()
    `);
    fs.writeFileSync(scrollbarScreenshotPath, (await window.capturePage()).toPNG());
    console.log("Version-history UI test passed.");
    console.log(`Screenshots: ${screenshotPath}, ${scrollbarScreenshotPath}`);
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
  .finally(async () => {
    fs.rmSync(fixtureDir, { recursive: true, force: true });
    app.exit(process.exitCode || 0);
  });
