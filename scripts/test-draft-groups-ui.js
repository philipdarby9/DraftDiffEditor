const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { app, BrowserWindow } = require("electron");

const workspace = path.resolve(__dirname, "..");
const fixtureDir = fs.mkdtempSync(path.join(os.tmpdir(), "draft-diff-draft-groups-ui-"));
const screenshotPath = path.join(workspace, ".codex-screens", "draft-groups-ui.png");
const zoomScreenshotPath = path.join(workspace, ".codex-screens", "draft-preview-zoom-ui.png");
const format = {
  fontFamily: "Consolas",
  fontSize: "12",
  lineHeight: "1.62"
};
const DRAFT_COUNT = 105;

function draft(index) {
  const number = index + 1;
  const createdAt = new Date(Date.UTC(2026, 0, number, 12)).toISOString();
  return {
    id: `draft-group-${number}`,
    title: `Draft ${number}`,
    createdAt,
    updatedAt: createdAt,
    content: `Text for Draft ${number}`,
    contentHtml: `<p>Text for Draft ${number}</p>`,
    format,
    notes: {
      id: `draft-group-notes-${number}`,
      title: `Draft ${number} Notes`,
      createdAt,
      updatedAt: createdAt,
      content: "",
      contentHtml: "",
      format
    }
  };
}

const fixture = {
  version: 1,
  storyId: "draft-groups-story",
  formatDefaultVersion: 2,
  defaultFormat: format,
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
  initialNotes: {
    id: "initial-notes",
    title: "Project notes",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    content: "",
    contentHtml: "",
    format
  },
  drafts: Array.from({ length: DRAFT_COUNT }, (_, index) => draft(index))
};

fs.writeFileSync(path.join(fixtureDir, "project.json"), `${JSON.stringify(fixture, null, 2)}\n`);
process.env.DRAFT_DIFF_DATA_DIR = fixtureDir;

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

async function run() {
  await app.whenReady();
  const started = await startServer({ port: 0, host: "127.0.0.1" });
  const window = new BrowserWindow({
    show: false,
    width: 1500,
    height: 960,
    webPreferences: {
      contextIsolation: true,
      sandbox: true
    }
  });

  try {
    await window.loadURL(started.url);
    await waitFor(window, "state?.drafts?.length === 105", "105-draft fixture");

    const boundaries = await window.webContents.executeJavaScript(`
      (() => {
        const allDrafts = state.drafts.slice();
        const result = {};
        [10, 11, 99, 100, 101].forEach(count => {
          state.drafts = allDrafts.slice(0, count);
          displayedPageKeys = new Set(state.drafts.map(draft => draftContentKey(draft.id)));
          selectedDraftId = state.drafts[0].id;
          activeArea = "draft";
          activeEditorKey = draftContentKey(selectedDraftId);
          renderDraftTabs();
          result[count] = {
            individualTabs: document.querySelectorAll("#draft-tabs > .draft-tab").length,
            groups: Array.from(
              document.querySelectorAll("#draft-tabs > .draft-tab-group-shell .draft-tab-range-toggle")
            ).map(label => label.innerText.trim()),
            toggleLayout: Array.from(
              document.querySelectorAll("#draft-tabs > .draft-tab-group-shell .draft-tab-range-toggle")
            ).map(toggle => ({
              width: toggle.getBoundingClientRect().width,
              rightInset: toggle.closest(".draft-group-tab").getBoundingClientRect().right
                - toggle.getBoundingClientRect().right,
              justification: getComputedStyle(toggle).justifyContent
            })),
            nestedGroups: (() => {
              const firstGroup = draftTopGroups()[0];
              if (!firstGroup) return 0;
              draftTabFilterOpen = firstGroup.key;
              renderDraftTabs();
              return document.querySelectorAll(
                "#draft-tabs > .draft-tab-group-menu > .draft-tab-group-choices > .draft-tab-nested-group"
              ).length;
            })()
          };
        });
        state.drafts = allDrafts;
        displayedPageKeys = new Set(state.drafts.map(draft => draftContentKey(draft.id)));
        selectedDraftId = state.drafts[0].id;
        activeEditorKey = draftContentKey(selectedDraftId);
        draftTabFilterOpen = null;
        renderDraftTabs();
        return result;
      })()
    `);

    assert.equal(boundaries[10].individualTabs, 10);
    assert.deepEqual(boundaries[10].groups, []);
    assert.deepEqual(boundaries[11].groups, ["1–10", "11"]);
    assert.equal(boundaries[11].toggleLayout[0].justification, "space-between");
    assert.equal(boundaries[11].toggleLayout[1].justification, "space-between");
    assert.equal(boundaries[11].toggleLayout[0].width, boundaries[11].toggleLayout[1].width);
    assert.equal(
      boundaries[11].toggleLayout[0].rightInset,
      boundaries[11].toggleLayout[1].rightInset
    );
    assert.equal(boundaries[11].nestedGroups, 0);
    assert.equal(boundaries[99].groups.length, 10);
    assert.equal(boundaries[99].groups.at(-1), "91–99");
    assert.deepEqual(boundaries[100].groups, ["1–100"]);
    assert.equal(boundaries[100].nestedGroups, 10);
    assert.deepEqual(boundaries[101].groups, ["1–100", "101"]);
    assert.equal(boundaries[101].nestedGroups, 10);

    const initial = await window.webContents.executeJavaScript(`
      (() => ({
        groups: Array.from(
          document.querySelectorAll("#draft-tabs > .draft-tab-group-shell .draft-tab-range-toggle")
        ).map(label => label.innerText.trim()),
        allDraftsChecked: document.querySelector("#all-drafts-toggle").checked,
        allDraftsLabel: document.querySelector("[data-all-drafts-toggle]").innerText.trim()
      }))()
    `);
    assert.deepEqual(initial.groups, ["1–100", "101–105"]);
    assert.equal(initial.allDraftsChecked, true);
    assert.match(initial.allDraftsLabel, /All drafts|AD/);

    const sharedMenuShape = await window.webContents.executeJavaScript(`
      (() => {
        const pageKey = draftContentKey(state.drafts[0].id);
        const entries = state.drafts.slice(0, 10).map((draft, index) => ({
          index,
          id: \`parity-version-\${index + 1}\`,
          version: {
            id: \`parity-version-\${index + 1}\`,
            title: draft.title,
            createdAt: draft.createdAt,
            content: draft.content,
            contentHtml: draft.contentHtml
          }
        }));
        historyVersionExclusions.set(pageKey, new Set());
        const sharedShape = html => {
          const holder = document.createElement("div");
          holder.innerHTML = html;
          const walk = node => ({
            tag: node.tagName,
            classes: Array.from(node.classList)
              .filter(name => name.startsWith("selection-menu"))
              .sort(),
            children: Array.from(node.children).map(walk)
          });
          return walk(holder.firstElementChild);
        };
        return {
          drafts: sharedShape(draftNestedGroupHtml(0, 10, 10)),
          versions: sharedShape(historyVersionGroupHtml(pageKey, entries, 10, 0, 10))
        };
      })()
    `);
    assert.deepEqual(sharedMenuShape.drafts, sharedMenuShape.versions);

    await window.webContents.executeJavaScript(`
      (() => {
        document.querySelector(
          '[data-draft-tab-filter-start="0"][data-draft-tab-filter-end="100"]'
        ).click();
      })()
    `);
    await waitFor(
      window,
      'document.querySelector(".draft-tab-group-menu")?.getAttribute("aria-label") === "Choose drafts 1 to 100"',
      "open draft group menu"
    );
    await window.webContents.executeJavaScript(`
      document.querySelector(
        '[data-draft-tab-filter-start="100"][data-draft-tab-filter-end="105"]'
      ).click()
    `);
    await waitFor(
      window,
      'document.querySelector(".draft-tab-group-menu")?.getAttribute("aria-label") === "Choose drafts 101 to 105"',
      "switch draft group menu"
    );
    assert.equal(
      await window.webContents.executeJavaScript(
        'document.querySelectorAll("#draft-tabs > .draft-tab-group-menu").length'
      ),
      1
    );
    await window.webContents.executeJavaScript(`
      document.querySelector(
        '[data-draft-tab-filter-start="0"][data-draft-tab-filter-end="100"]'
      ).click()
    `);
    await waitFor(
      window,
      'document.querySelector(".draft-tab-group-menu")?.getAttribute("aria-label") === "Choose drafts 1 to 100"',
      "return to first draft group menu"
    );
    await window.webContents.executeJavaScript(`
      (() => {
        const nested = document.querySelector(".draft-tab-nested-group");
        nested.open = true;
        nested.dispatchEvent(new Event("toggle"));
      })()
    `);
    await waitFor(window, 'document.querySelector(".draft-tab-nested-group")?.open', "open nested draft group");
    const openRangeLayout = await window.webContents.executeJavaScript(`
      (() => {
        const openRange = document.querySelector(".draft-tab-nested-group[open]");
        const nextRange = openRange?.nextElementSibling;
        const contents = openRange?.querySelector(":scope > .selection-menu-range-contents");
        const leaf = contents?.querySelector(".selection-menu-leaf");
        const rect = element => element ? {
          top: element.getBoundingClientRect().top,
          bottom: element.getBoundingClientRect().bottom,
          height: element.getBoundingClientRect().height
        } : null;
        return {
          range: rect(openRange),
          contents: rect(contents),
          leaf: rect(leaf),
          nextRange: rect(nextRange),
          piles: openRange?.parentElement?.querySelectorAll(":scope > .selection-menu-range .selection-menu-pile").length || 0,
          cards: contents?.querySelectorAll(":scope > .selection-menu-leaf").length || 0,
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
          menuDateStart: document.querySelector(".draft-tab-group-menu .selection-menu-header-dates")
            ?.dataset.selectionDateStart || "",
          menuDateEnd: document.querySelector(".draft-tab-group-menu .selection-menu-header-dates")
            ?.dataset.selectionDateEnd || "",
          rangeDateStart: openRange?.querySelector(":scope > summary .selection-menu-range-dates")
            ?.dataset.selectionDateStart || "",
          rangeDateEnd: openRange?.querySelector(":scope > summary .selection-menu-range-dates")
            ?.dataset.selectionDateEnd || "",
          firstCardTops: Array.from(contents?.querySelectorAll(":scope > .selection-menu-leaf") || [])
            .slice(0, 2)
            .map(card => card.getBoundingClientRect().top),
          choicesDisplay: openRange?.parentElement ? getComputedStyle(openRange.parentElement).display : "",
          contentsDisplay: contents ? getComputedStyle(contents).display : ""
        };
      })()
    `);
    assert.ok(openRangeLayout.nextRange.top >= openRangeLayout.range.bottom);
    assert.ok(openRangeLayout.contents.bottom <= openRangeLayout.range.bottom);
    assert.equal(openRangeLayout.piles, 10);
    assert.equal(openRangeLayout.cards, 10);
    assert.equal(openRangeLayout.zoomButtons, 10);
    assert.ok(openRangeLayout.addedTokens > 0);
    assert.ok(openRangeLayout.removedTokens > 0);
    assert.match(openRangeLayout.addedDecoration, /underline/);
    assert.match(openRangeLayout.removedDecoration, /line-through/);
    assert.equal(openRangeLayout.menuDateStart, fixture.drafts[0].createdAt);
    assert.equal(openRangeLayout.menuDateEnd, fixture.drafts[99].createdAt);
    assert.equal(openRangeLayout.rangeDateStart, fixture.drafts[0].createdAt);
    assert.equal(openRangeLayout.rangeDateEnd, fixture.drafts[9].createdAt);
    assert.equal(openRangeLayout.firstCardTops[0], openRangeLayout.firstCardTops[1]);
    assert.equal(openRangeLayout.choicesDisplay, "flex");
    assert.equal(openRangeLayout.contentsDisplay, "grid");
    const draftPreviewComparisonModes = await window.webContents.executeJavaScript(`
      (() => {
        const removedText = () => (
          document.querySelector(
            '[data-draft-tab-id="draft-group-3"] .compare-token.removed'
          )?.innerText || ""
        );
        const initialMode = document.querySelector("#compare-mode").value;
        const consecutiveRemoved = removedText();
        const select = document.querySelector("#compare-mode");
        select.value = "first";
        select.dispatchEvent(new Event("change", { bubbles: true }));
        const firstRemoved = removedText();
        select.value = "consecutive";
        select.dispatchEvent(new Event("change", { bubbles: true }));
        return {
          initialMode,
          consecutiveRemoved,
          firstRemoved,
          restoredMode: document.querySelector("#compare-mode").value
        };
      })()
    `);
    assert.equal(draftPreviewComparisonModes.initialMode, "consecutive");
    assert.match(draftPreviewComparisonModes.consecutiveRemoved, /2/);
    assert.match(draftPreviewComparisonModes.firstRemoved, /1/);
    assert.equal(draftPreviewComparisonModes.restoredMode, "consecutive");
    const preservedDraftMenuScroll = await window.webContents.executeJavaScript(`
      (() => {
        const choices = document.querySelector(".draft-tab-group-choices");
        choices.scrollTop = Math.min(520, choices.scrollHeight - choices.clientHeight);
        const before = choices.scrollTop;
        const checkbox = document.querySelector('[data-display-draft-id="draft-group-8"]');
        checkbox.checked = false;
        checkbox.dispatchEvent(new Event("change", { bubbles: true }));
        const renderedChoices = document.querySelector(".draft-tab-group-choices");
        return {
          before,
          after: renderedChoices.scrollTop,
          menuKey: renderedChoices.closest(".selection-menu-popover")?.dataset.selectionMenuKey || "",
          checked: document.querySelector('[data-display-draft-id="draft-group-8"]').checked
        };
      })()
    `);
    assert.ok(preservedDraftMenuScroll.before > 0);
    assert.equal(preservedDraftMenuScroll.after, preservedDraftMenuScroll.before);
    assert.equal(preservedDraftMenuScroll.menuKey, "draft:top:0:100");
    assert.equal(preservedDraftMenuScroll.checked, false);
    const zoomPositions = await window.webContents.executeJavaScript(`
      (() => {
        const selectionZoom = document.querySelector(".selection-menu-zoom");
        const usbZoom = document.createElement("button");
        usbZoom.className = "transfer-timeline-zoom";
        document.body.append(usbZoom);
        const result = {
          selectionLeft: getComputedStyle(selectionZoom).left,
          usbLeft: getComputedStyle(usbZoom).left
        };
        usbZoom.remove();
        return result;
      })()
    `);
    assert.equal(zoomPositions.selectionLeft, "6px");
    assert.equal(zoomPositions.usbLeft, "6px");
    await window.webContents.executeJavaScript(`
      document.querySelector('[data-selection-menu-zoom="draft:draft-group-2"]').click()
    `);
    await waitFor(window, '!document.querySelector("#transfer-page-zoom").hidden', "draft preview zoom");
    const draftZoom = await window.webContents.executeJavaScript(`
      ({
        title: document.querySelector("#transfer-page-zoom-title").innerText,
        text: document.querySelector("#transfer-page-zoom-paper").innerText,
        added: document.querySelectorAll("#transfer-page-zoom-paper .compare-token.added").length,
        removed: document.querySelectorAll("#transfer-page-zoom-paper .compare-token.removed").length,
        addedText: document.querySelector("#transfer-page-zoom-paper .compare-token.added")?.innerText || "",
        outsideUsbReview: !document.querySelector("#transfer-review-overlay").contains(
          document.querySelector("#transfer-page-zoom")
        )
      })
    `);
    assert.equal(draftZoom.title, "Draft 2");
    assert.match(draftZoom.text, /Text for Draft/);
    assert.match(draftZoom.addedText, /2/);
    assert.ok(draftZoom.added > 0);
    assert.ok(draftZoom.removed > 0);
    assert.equal(draftZoom.outsideUsbReview, true);
    window.show();
    window.focus();
    window.webContents.invalidate();
    await delay(200);
    fs.mkdirSync(path.dirname(zoomScreenshotPath), { recursive: true });
    fs.writeFileSync(zoomScreenshotPath, (await window.capturePage()).toPNG());
    await window.webContents.executeJavaScript(`
      document.querySelector("#transfer-page-zoom-close").click()
    `);
    await waitFor(window, 'document.querySelector("#transfer-page-zoom").hidden', "closed draft preview zoom");
    assert.equal(
      await window.webContents.executeJavaScript(
        'document.querySelectorAll(".draft-tab-nested-group[open] .draft-tab-menu-item").length'
      ),
      10
    );

    const selection = await window.webContents.executeJavaScript(`
      (() => {
        const firstGroupCheckbox = document.querySelector(
          '[data-display-draft-group-start="0"][data-display-draft-group-end="100"]'
        );
        firstGroupCheckbox.checked = false;
        firstGroupCheckbox.dispatchEvent(new Event("change", { bubbles: true }));
        return {
          displayed: selectedDraftDisplayCount(),
          allDraftsChecked: document.querySelector("#all-drafts-toggle").checked,
          allDraftsIndeterminate: document.querySelector("#all-drafts-toggle").indeterminate
        };
      })()
    `);
    assert.equal(selection.displayed, 5);
    assert.equal(selection.allDraftsChecked, false);
    assert.equal(selection.allDraftsIndeterminate, true);

    await window.webContents.executeJavaScript(`
      displayAllDrafts(true);
      draftTabFilterOpen = null;
      renderDraftTabs();
      document.querySelector(
        '[data-draft-tab-filter-start="0"][data-draft-tab-filter-end="100"]'
      ).click();
    `);
    await waitFor(window, 'Boolean(document.querySelector(".draft-tab-group-menu"))', "reopened draft group menu");
    await window.webContents.executeJavaScript(`
      (() => {
        const nested = document.querySelector(".draft-tab-nested-group");
        nested.open = true;
        nested.dispatchEvent(new Event("toggle"));
      })()
    `);
    window.show();
    window.focus();
    window.webContents.invalidate();
    await delay(300);
    fs.mkdirSync(path.dirname(screenshotPath), { recursive: true });
    fs.writeFileSync(screenshotPath, (await window.capturePage()).toPNG());

    console.log("Draft grouping UI test passed.");
    console.log(`Screenshots: ${screenshotPath}, ${zoomScreenshotPath}`);
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
