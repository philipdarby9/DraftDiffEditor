const params = new URLSearchParams(window.location.search);
const unitKey = params.get("unit") || params.get("key") || "";

const els = {
  kicker: document.querySelector("#panel-kicker"),
  status: document.querySelector("#panel-status"),
  pages: document.querySelector("#panel-pages")
};

const DEFAULT_FORMAT = {
  fontFamily: "Consolas",
  fontSize: "16",
  lineHeight: "1.62"
};

const FONT_FAMILY_OPTIONS = [
  "Consolas",
  "Segoe UI",
  "Arial",
  "Calibri",
  "Cambria",
  "Candara",
  "Constantia",
  "Corbel",
  "Georgia",
  "Garamond",
  "Book Antiqua",
  "Palatino Linotype",
  "Times New Roman",
  "Courier New",
  "Lucida Console",
  "Verdana",
  "Tahoma",
  "Trebuchet MS"
];

const FONT_SIZE_OPTIONS = ["12", "14", "16", "18", "20", "24", "28", "32"];
const LINE_HEIGHT_OPTIONS = ["1.2", "1.4", "1.62", "1.8", "2"];
const DETACHED_PANEL_CHANNEL = "draftDiff.detachedPanels";
const channel = "BroadcastChannel" in window ? new BroadcastChannel(DETACHED_PANEL_CHANNEL) : null;

const toolbarIcons = {
  format: '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M3 4.5h10M3 8h10M3 11.5h10"></path><path d="M5.5 3v3M10.5 6.5v3M7.5 10v3"></path></svg>',
  undo: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 14 5 10l4-4"></path><path d="M5 10h11a4 4 0 1 1 0 8h-1"></path></svg>',
  redo: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m15 14 4-4-4-4"></path><path d="M19 10H8a4 4 0 1 0 0 8h1"></path></svg>',
  bold: '<span class="fr-letter-icon bold" aria-hidden="true">B</span>',
  italic: '<span class="fr-letter-icon italic" aria-hidden="true">I</span>',
  underline: '<span class="fr-letter-icon underline" aria-hidden="true">U</span>',
  strike: '<span class="fr-letter-icon strike" aria-hidden="true">S</span>',
  unorderedList: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 6h11"></path><path d="M9 12h11"></path><path d="M9 18h11"></path><path d="M5 6v.01"></path><path d="M5 12v.01"></path><path d="M5 18v.01"></path></svg>',
  orderedList: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M11 6h9"></path><path d="M11 12h9"></path><path d="M12 18h8"></path><path d="M4 6h1v4"></path><path d="M4 10h2"></path><path d="M6 18H4c0-1.2 2-2.1 2-3.2 0-.7-.5-1.2-1.2-1.2-.5 0-.9.2-1.2.6"></path></svg>',
  outdent: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 6H9"></path><path d="M20 12h-7"></path><path d="M20 18H9"></path><path d="m8 8-4 4 4 4"></path></svg>',
  indent: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 6H9"></path><path d="M20 12h-7"></path><path d="M20 18H9"></path><path d="m4 8 4 4-4 4"></path></svg>',
  alignLeft: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 6h16"></path><path d="M4 12h10"></path><path d="M4 18h14"></path></svg>',
  alignCenter: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 6h16"></path><path d="M8 12h8"></path><path d="M6 18h12"></path></svg>',
  alignRight: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 6h16"></path><path d="M10 12h10"></path><path d="M6 18h14"></path></svg>',
  clear: '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M4.2 12.3h7.4"></path><path d="m5.3 8.8 3.9-4.2 2.2 2.1-3.9 4.2H5.3z"></path><path d="M4 13.1 12.5 3"></path></svg>'
};

let unit = null;
let saveTimer = null;
let isSaving = false;
let saveQueued = false;

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function textToHtml(value) {
  return escapeHtml(value).replace(/\n/g, "<br>");
}

function formatDate(iso) {
  const date = new Date(iso);
  if (Number.isNaN(date.valueOf())) return String(iso || "");
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(date);
}

function plainTextFromHtml(html) {
  const template = document.createElement("template");
  template.innerHTML = String(html || "");
  return template.content.textContent.replace(/\u00a0/g, " ").trimEnd();
}

function wordCountForText(text) {
  const matches = String(text || "").match(/[\p{L}\p{N}]+(?:['-][\p{L}\p{N}]+)*/gu);
  return matches ? matches.length : 0;
}

function pageWordCount(page) {
  return wordCountForText(page?.content || plainTextFromHtml(page?.contentHtml || ""));
}

function formatWordCount(count) {
  const value = Number(count) || 0;
  return `${value.toLocaleString()} ${value === 1 ? "word" : "words"}`;
}

function pageMetaHtml(page) {
  const created = formatDate(page.page.createdAt);
  const label = page.type === "draft" ? `Created: ${created}` : created;
  return `<span class="meta" title="Created ${escapeHtml(created)}">${escapeHtml(label)}</span>`;
}

function detachedDraftPage() {
  return unit?.pages?.find(page => page.type === "draft")?.page || null;
}

function notesHeaderStatsHtml() {
  const draftPage = detachedDraftPage();
  if (!draftPage) return "";

  const lastEdited = formatDate(draftPage.updatedAt || draftPage.createdAt);
  return `
    <div class="notes-heading-stats" aria-label="${escapeHtml(unit?.title || "Draft")} statistics">
      <span class="notes-heading-word-count" data-detached-draft-word-count>${formatWordCount(pageWordCount(draftPage))}</span>
      <span class="notes-heading-stat-divider" aria-hidden="true"></span>
      <span class="notes-heading-last-edited" data-detached-draft-last-edited>Last edited: ${escapeHtml(lastEdited)}</span>
    </div>
  `;
}

function updateDetachedNotesStats(lastEditedIso = null) {
  const draftEditor = els.pages.querySelector(".draft-detached-page [data-editor-key]");
  const wordCountEl = els.pages.querySelector("[data-detached-draft-word-count]");
  const lastEditedEl = els.pages.querySelector("[data-detached-draft-last-edited]");
  if (!draftEditor || !wordCountEl || !lastEditedEl) return;

  wordCountEl.textContent = formatWordCount(wordCountForText(editorPlainText(draftEditor)));
  const timestamp = lastEditedIso || detachedDraftPage()?.updatedAt || detachedDraftPage()?.createdAt;
  lastEditedEl.textContent = `Last edited: ${formatDate(timestamp)}`;
}

function setDetachedNotesCollapsed(section, isCollapsed) {
  const isExpanded = !isCollapsed;
  const heading = section?.querySelector("[data-detached-toggle-notes-heading]");
  const hint = section?.querySelector(".notes-collapse-hint");

  section?.classList.toggle("notes-collapsed", isCollapsed);
  heading?.setAttribute("aria-expanded", String(isExpanded));
  heading?.setAttribute("title", isCollapsed ? "Show notes" : "Collapse notes");
  if (hint) hint.textContent = isCollapsed ? "Click to expand" : "Click to collapse";
  updateDetachedNotesHeadingDensity(heading);
}

function updateDetachedNotesHeadingDensity(heading) {
  if (!heading) return;

  heading.classList.remove("notes-heading-hide-label", "notes-heading-is-tight");

  const main = heading.querySelector(".notes-heading-main");
  if (!main) return;

  const styles = window.getComputedStyle(heading);
  const gap = parseFloat(styles.columnGap || styles.gap) || 0;
  const horizontalPadding = (parseFloat(styles.paddingLeft) || 0) + (parseFloat(styles.paddingRight) || 0);
  const children = Array.from(heading.children);
  const requiredWidth = children.reduce((total, child) => total + child.scrollWidth, 0)
    + Math.max(0, children.length - 1) * gap;
  const availableWidth = heading.clientWidth - horizontalPadding;

  heading.classList.toggle("notes-heading-hide-label", requiredWidth > availableWidth);

  const mainIsClipped = main.scrollWidth > main.clientWidth + 1;
  heading.classList.toggle("notes-heading-is-tight", mainIsClipped);
}

function updateAllDetachedNotesHeadingDensity() {
  els.pages
    ?.querySelectorAll(".notes-toggle-heading")
    .forEach(updateDetachedNotesHeadingDensity);
}

function editorPlainText(editorEl) {
  const clone = editorEl.cloneNode(true);
  clone.querySelectorAll("br").forEach(br => br.replaceWith("\n"));
  clone.querySelectorAll("div,p,li").forEach(block => {
    if (block.nextSibling) block.append("\n");
  });
  return clone.textContent.replace(/\u00a0/g, " ").replace(/\n{3,}/g, "\n\n").trimEnd();
}

function normalizeFormat(format = {}) {
  return {
    fontFamily: FONT_FAMILY_OPTIONS.includes(format.fontFamily) ? format.fontFamily : DEFAULT_FORMAT.fontFamily,
    fontSize: FONT_SIZE_OPTIONS.includes(String(format.fontSize)) ? String(format.fontSize) : DEFAULT_FORMAT.fontSize,
    lineHeight: LINE_HEIGHT_OPTIONS.includes(String(format.lineHeight)) ? String(format.lineHeight) : DEFAULT_FORMAT.lineHeight
  };
}

function parseDetachedUnitKey(key) {
  if (key === "story") return { type: "story" };
  const match = /^draft:(.+)$/.exec(String(key || ""));
  if (!match) return null;
  return { type: "draft", draftId: match[1] };
}

function draftContentKey(draftId) {
  return `draft:${draftId}:content`;
}

function draftNotesKey(draftId) {
  return `draft:${draftId}:notes`;
}

function pageDescriptor(key, type, title, kicker, editableTitle, page) {
  return {
    key,
    type,
    title,
    kicker,
    editableTitle,
    page: {
      title: page.title,
      createdAt: page.createdAt,
      updatedAt: page.updatedAt,
      content: page.content || "",
      contentHtml: page.contentHtml || textToHtml(page.content || ""),
      format: normalizeFormat(page.format)
    }
  };
}

function unitFromState(state, key) {
  const parsed = parseDetachedUnitKey(key);
  if (!parsed) return null;

  if (parsed.type === "story") {
    return {
      key: "story",
      type: "story",
      title: "Project notes",
      pages: [pageDescriptor("story", "story", "Project notes", "Page", false, state.initialNotes)]
    };
  }

  const draft = state.drafts.find(item => item.id === parsed.draftId);
  if (!draft) return null;

  return {
    key,
    type: "draft",
    draftId: draft.id,
    title: draft.title,
    pages: [
      pageDescriptor(draftContentKey(draft.id), "draft", draft.title, "Draft", true, draft),
      pageDescriptor(draftNotesKey(draft.id), "notes", `${draft.title} notes`, "Notes", false, draft.notes)
    ]
  };
}

function setStatus(text) {
  const statusText = els.status.querySelector(".status-text");
  if (statusText) statusText.textContent = text;
  els.status.classList.toggle("is-saving", /saving|unsaved/i.test(text));
}

function optionHtml(values, currentValue) {
  return values
    .map(value => `<option value="${escapeHtml(value)}"${value === currentValue ? " selected" : ""}>${escapeHtml(value)}</option>`)
    .join("");
}

function formatPickerHtml(field, label, values, className, currentValue) {
  const selectedValue = currentValue || DEFAULT_FORMAT[field];
  const options = values.map(value => `
    <button
      class="fr-picker-option"
      type="button"
      role="option"
      data-format-option="${escapeHtml(value)}"
      aria-selected="${String(value === selectedValue)}"
    >${escapeHtml(value)}</button>
  `).join("");

  return `
    <div class="fr-picker ${className}" data-page-format-picker="${escapeHtml(field)}" data-value="${escapeHtml(selectedValue)}">
      <button
        class="fr-picker-button"
        type="button"
        data-format-toggle
        title="${escapeHtml(label)}"
        aria-label="${escapeHtml(label)}: ${escapeHtml(selectedValue)}"
        aria-haspopup="listbox"
        aria-expanded="false"
      >
        <span data-format-value>${escapeHtml(selectedValue)}</span>
      </button>
      <div class="fr-picker-menu" role="listbox" aria-label="${escapeHtml(label)}">
        ${options}
      </div>
    </div>
  `;
}

function formatRibbonHtml(page, format) {
  return `
    <div
      id="format-ribbon-${escapeHtml(page.key)}"
      class="editor-format-ribbon"
      data-toolbar-for="${escapeHtml(page.key)}"
      aria-label="${escapeHtml(page.title)} formatting"
      aria-hidden="true"
    >
      <div class="fr-group">
        ${formatPickerHtml("fontFamily", "Page font", FONT_FAMILY_OPTIONS, "family", format.fontFamily)}
        ${formatPickerHtml("fontSize", "Page font size", FONT_SIZE_OPTIONS, "size", format.fontSize)}
        ${formatPickerHtml("lineHeight", "Line spacing", LINE_HEIGHT_OPTIONS, "line-height", format.lineHeight)}
      </div>
      <div class="fr-group">
        <button class="fr-btn" type="button" data-command="undo" title="Undo" aria-label="Undo">${toolbarIcons.undo}</button>
        <button class="fr-btn" type="button" data-command="redo" title="Redo" aria-label="Redo">${toolbarIcons.redo}</button>
      </div>
      <div class="fr-group">
        <button class="fr-btn" type="button" data-command="bold" title="Bold" aria-label="Bold">${toolbarIcons.bold}</button>
        <button class="fr-btn" type="button" data-command="italic" title="Italic" aria-label="Italic">${toolbarIcons.italic}</button>
        <button class="fr-btn" type="button" data-command="underline" title="Underline" aria-label="Underline">${toolbarIcons.underline}</button>
        <button class="fr-btn" type="button" data-command="strikeThrough" title="Strikethrough" aria-label="Strikethrough">${toolbarIcons.strike}</button>
      </div>
      <div class="fr-group">
        <button class="fr-btn" type="button" data-command="insertUnorderedList" title="Bulleted list" aria-label="Bulleted list">${toolbarIcons.unorderedList}</button>
        <button class="fr-btn" type="button" data-command="insertOrderedList" title="Numbered list" aria-label="Numbered list">${toolbarIcons.orderedList}</button>
        <button class="fr-btn" type="button" data-command="outdent" title="Decrease indent" aria-label="Decrease indent">${toolbarIcons.outdent}</button>
        <button class="fr-btn" type="button" data-command="indent" title="Increase indent" aria-label="Increase indent">${toolbarIcons.indent}</button>
      </div>
      <div class="fr-group">
        <button class="fr-btn" type="button" data-command="justifyLeft" title="Align left" aria-label="Align left">${toolbarIcons.alignLeft}</button>
        <button class="fr-btn" type="button" data-command="justifyCenter" title="Align center" aria-label="Align center">${toolbarIcons.alignCenter}</button>
        <button class="fr-btn" type="button" data-command="justifyRight" title="Align right" aria-label="Align right">${toolbarIcons.alignRight}</button>
      </div>
      <div class="fr-group">
        <button class="fr-btn" type="button" data-command="removeFormat" title="Clear formatting" aria-label="Clear formatting">${toolbarIcons.clear}</button>
      </div>
    </div>
  `;
}

function pageSectionHtml(page) {
  const format = normalizeFormat(page.page.format);
  const meta = pageMetaHtml(page);
  const notesHeaderStats = page.type === "notes" ? notesHeaderStatsHtml() : "";
  const notesCaret = page.type === "notes"
    ? `
      <span class="notes-caret" aria-hidden="true">
        <svg viewBox="0 0 12 12">
          <path d="M3 7.5 6 4.5l3 3"></path>
        </svg>
      </span>
    `
    : "";
  const notesHint = page.type === "notes"
    ? '<span class="notes-collapse-hint">Click to collapse</span>'
    : "";
  const titleControl = page.editableTitle
    ? `<input class="draft-title-input" data-page-title="${escapeHtml(page.key)}" type="text" autocomplete="off" value="${escapeHtml(page.page.title || page.title)}" aria-label="Draft title">`
    : `<h2>${escapeHtml(page.title)}</h2>`;
  const headingClass = page.type === "notes" ? "panel-heading notes-toggle-heading" : "panel-heading";
  const ribbonId = `format-ribbon-${page.key}`;
  const headingAttributes = page.type === "notes"
    ? ' data-detached-toggle-notes-heading role="button" tabindex="0" aria-expanded="true" title="Collapse notes"'
    : "";

  return `
    <section class="detached-page-panel ${escapeHtml(page.type)}-detached-page" data-page-key="${escapeHtml(page.key)}">
      <div class="editor-ribbon-region" data-ribbon-region="${escapeHtml(page.key)}">
        <div class="${headingClass}"${headingAttributes}>
          ${page.type === "notes" ? `
            <div class="notes-heading-main">
              ${notesCaret}
              <span class="panel-kicker">Notes</span>
            </div>
            ${notesHint}
            <button
              class="panel-format-toggle"
              type="button"
              data-ribbon-toggle="${escapeHtml(page.key)}"
              aria-expanded="false"
              aria-controls="${escapeHtml(ribbonId)}"
              title="Formatting"
              aria-label="Show ${escapeHtml(page.title)} formatting"
            >${toolbarIcons.format}</button>
            ${notesHeaderStats}
          ` : `
            <div class="panel-title-row">
              ${titleControl}
            </div>
            <button
              class="panel-format-toggle"
              type="button"
              data-ribbon-toggle="${escapeHtml(page.key)}"
              aria-expanded="false"
              aria-controls="${escapeHtml(ribbonId)}"
              title="Formatting"
              aria-label="Show ${escapeHtml(page.title)} formatting"
            >${toolbarIcons.format}</button>
            ${meta}
          `}
        </div>
        ${formatRibbonHtml(page, format)}
      </div>
      <div
        class="rich-editor"
        contenteditable="true"
        role="textbox"
        aria-multiline="true"
        spellcheck="true"
        data-editor-key="${escapeHtml(page.key)}"
        data-empty="${page.type === "notes" ? "Draft notes..." : "Start writing..."}"
      ></div>
    </section>
  `;
}

function applyEditorFormat(editorEl, format) {
  const normalized = normalizeFormat(format);
  editorEl.style.fontFamily = normalized.fontFamily;
  editorEl.style.fontSize = `${normalized.fontSize}px`;
  editorEl.style.lineHeight = normalized.lineHeight;
}

function pageFormatFromSection(section) {
  const values = {};
  section?.querySelectorAll("[data-page-format-picker]").forEach(picker => {
    const field = picker.dataset.pageFormatPicker;
    if (field && picker.dataset.value) values[field] = picker.dataset.value;
  });
  return normalizeFormat(values);
}

function syncPickerValue(picker, value) {
  picker.dataset.value = value;
  const valueText = picker.querySelector("[data-format-value]");
  const toggle = picker.querySelector("[data-format-toggle]");
  if (valueText) valueText.textContent = value;
  if (toggle) toggle.setAttribute("aria-label", `${toggle.title}: ${value}`);
  picker.querySelectorAll("[data-format-option]").forEach(option => {
    option.setAttribute("aria-selected", String(option.dataset.formatOption === value));
  });
}

function setRibbonRegionOpen(region, open) {
  region.classList.toggle("ribbon-open", open);
  const toggle = region.querySelector("[data-ribbon-toggle]");
  const toolbar = region.querySelector(".editor-format-ribbon");
  if (toggle) toggle.setAttribute("aria-expanded", String(open));
  if (toolbar) toolbar.setAttribute("aria-hidden", String(!open));
}

function closeFormatPickers(exceptPicker = null) {
  els.pages.querySelectorAll(".fr-picker.is-open").forEach(picker => {
    if (picker === exceptPicker) return;
    picker.classList.remove("is-open");
    picker.querySelector("[data-format-toggle]")?.setAttribute("aria-expanded", "false");
    clearFormatPickerPosition(picker);
  });
}

function clearFormatPickerPosition(picker) {
  const menu = picker.querySelector(".fr-picker-menu");
  if (!menu) return;
  menu.style.removeProperty("left");
  menu.style.removeProperty("top");
  menu.style.removeProperty("min-width");
}

function positionFormatPickerMenu(picker) {
  const toggle = picker.querySelector("[data-format-toggle]");
  const menu = picker.querySelector(".fr-picker-menu");
  if (!toggle || !menu || !picker.classList.contains("is-open")) return;

  const viewportWidth = document.documentElement.clientWidth;
  const viewportHeight = document.documentElement.clientHeight;
  const margin = 6;
  const gap = 5;
  const toggleRect = toggle.getBoundingClientRect();

  menu.style.minWidth = `${Math.ceil(toggleRect.width)}px`;

  const menuRect = menu.getBoundingClientRect();
  const menuWidth = menuRect.width;
  const menuHeight = menuRect.height;
  const left = Math.max(margin, Math.min(toggleRect.left, viewportWidth - menuWidth - margin));
  const belowTop = toggleRect.bottom + gap;
  const aboveTop = toggleRect.top - menuHeight - gap;
  const top = belowTop + menuHeight <= viewportHeight - margin || aboveTop < margin
    ? Math.max(margin, Math.min(belowTop, viewportHeight - menuHeight - margin))
    : aboveTop;

  menu.style.left = `${Math.round(left)}px`;
  menu.style.top = `${Math.round(top)}px`;
}

function positionOpenFormatPickers() {
  els.pages.querySelectorAll(".fr-picker.is-open").forEach(positionFormatPickerMenu);
}

function toggleFormatPicker(toggle) {
  const picker = toggle.closest("[data-page-format-picker]");
  if (!picker) return;

  const shouldOpen = !picker.classList.contains("is-open");
  closeFormatPickers(picker);
  picker.classList.toggle("is-open", shouldOpen);
  toggle.setAttribute("aria-expanded", String(shouldOpen));

  if (!shouldOpen) clearFormatPickerPosition(picker);
  if (shouldOpen) positionFormatPickerMenu(picker);
}

function chooseFormatOption(option) {
  const picker = option.closest("[data-page-format-picker]");
  const section = option.closest("[data-page-key]");
  const editorEl = section?.querySelector("[data-editor-key]");
  if (!picker || !section || !editorEl) return;

  syncPickerValue(picker, option.dataset.formatOption);
  applyEditorFormat(editorEl, pageFormatFromSection(section));
  closeFormatPickers();
  queueSave();
}

function renderUnit(nextUnit) {
  if (!nextUnit?.pages?.length) return;

  unit = nextUnit;
  document.title = `${unit.title} - Draft Diff Editor`;
  els.kicker.textContent = unit.type === "draft" ? "Detached draft" : "Detached panel";
  els.pages.innerHTML = unit.pages.map(pageSectionHtml).join("");

  unit.pages.forEach(page => {
    const editorEl = els.pages.querySelector(`[data-editor-key="${CSS.escape(page.key)}"]`);
    if (!editorEl) return;
    editorEl.innerHTML = page.page.contentHtml || textToHtml(page.page.content || "");
    applyEditorFormat(editorEl, page.page.format);
  });

  window.requestAnimationFrame(updateAllDetachedNotesHeadingDensity);
  setStatus("Saved");
}

function postToMain(message) {
  channel?.postMessage({ source: "panel", key: unitKey, ...message });
}

function pagePayload(pageKey) {
  const section = els.pages.querySelector(`[data-page-key="${CSS.escape(pageKey)}"]`);
  const editorEl = section?.querySelector("[data-editor-key]");
  if (!section || !editorEl) return null;

  const format = {};
  section.querySelectorAll("[data-page-format-picker]").forEach(picker => {
    format[picker.dataset.pageFormatPicker] = picker.dataset.value;
  });

  return {
    key: pageKey,
    page: {
      title: section.querySelector("[data-page-title]")?.value || undefined,
      content: editorPlainText(editorEl),
      contentHtml: editorEl.innerHTML,
      format: normalizeFormat(format)
    }
  };
}

function unitPayload() {
  return {
    key: unitKey,
    pages: Array.from(els.pages.querySelectorAll("[data-page-key]"))
      .map(section => pagePayload(section.dataset.pageKey))
      .filter(Boolean)
  };
}

async function saveNow() {
  if (!unit) return;
  if (isSaving) {
    saveQueued = true;
    return;
  }

  window.clearTimeout(saveTimer);
  const nextUnit = unitPayload();
  postToMain({ type: "unit:update", unit: nextUnit });
  isSaving = true;
  setStatus("Saving...");

  try {
    const response = await fetch("/api/unit", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(nextUnit)
    });
    if (!response.ok) throw new Error("Save failed");
    isSaving = false;
    setStatus("Saved");
    if (saveQueued) {
      saveQueued = false;
      queueSave(0);
    }
  } catch (error) {
    console.error(error);
    isSaving = false;
    setStatus("Save failed");
  }
}

function queueSave(delay = 350) {
  setStatus("Unsaved changes");
  window.clearTimeout(saveTimer);
  saveTimer = window.setTimeout(saveNow, delay);
  postToMain({ type: "unit:update", unit: unitPayload() });
}

async function loadUnit() {
  if (!unitKey) {
    setStatus("Panel not found");
    return;
  }

  postToMain({ type: "unit:ready" });

  try {
    const response = await fetch("/api/state", { cache: "no-store" });
    if (!response.ok) throw new Error("Could not load state");
    const payload = await response.json();
    const nextUnit = unitFromState(payload.state, unitKey);
    if (!nextUnit) throw new Error("Panel not found");
    renderUnit(nextUnit);
  } catch (error) {
    console.error(error);
    setStatus("Panel not found");
  }
}

channel?.addEventListener("message", event => {
  const message = event.data || {};
  if (message.source !== "main") return;
  if (message.type !== "unit:state" || message.key !== unitKey) return;
  renderUnit(message.unit);
});

els.pages.addEventListener("input", event => {
  const titleInput = event.target.closest("[data-page-title]");
  if (titleInput && unit) {
    unit.title = titleInput.value || "Untitled draft";
  }
  if (event.target.closest("[data-editor-key]")?.closest(".draft-detached-page")) {
    updateDetachedNotesStats(new Date().toISOString());
  }
  queueSave();
});

els.pages.addEventListener("change", event => {
  const control = event.target.closest("[data-page-format]");
  if (!control) return;
  const section = control.closest("[data-page-key]");
  const editorEl = section?.querySelector("[data-editor-key]");
  if (editorEl) applyEditorFormat(editorEl, pagePayload(section.dataset.pageKey).page.format);
  queueSave();
});

els.pages.addEventListener("mousedown", event => {
  if (event.target.closest(".editor-format-ribbon button")) event.preventDefault();
});

els.pages.addEventListener("paste", event => {
  const editorEl = event.target.closest("[data-editor-key]");
  if (!editorEl) return;

  event.preventDefault();
  const html = event.clipboardData.getData("text/html");
  const text = event.clipboardData.getData("text/plain");
  document.execCommand("insertHTML", false, html || textToHtml(text));
  queueSave();
});

els.pages.addEventListener("click", event => {
  const notesHeading = event.target.closest("[data-detached-toggle-notes-heading]");
  if (notesHeading && !event.target.closest("button")) {
    const section = notesHeading.closest("[data-page-key]");
    setDetachedNotesCollapsed(section, !section.classList.contains("notes-collapsed"));
    return;
  }

  const ribbonToggle = event.target.closest("[data-ribbon-toggle]");
  if (ribbonToggle) {
    const region = ribbonToggle.closest(".editor-ribbon-region");
    if (region) setRibbonRegionOpen(region, !region.classList.contains("ribbon-open"));
    return;
  }

  const formatToggle = event.target.closest("[data-format-toggle]");
  if (formatToggle) {
    toggleFormatPicker(formatToggle);
    return;
  }

  const formatOption = event.target.closest("[data-format-option]");
  if (formatOption) {
    chooseFormatOption(formatOption);
    return;
  }

  const button = event.target.closest("[data-command]");
  if (!button) return;
  const section = button.closest("[data-page-key]");
  const editorEl = section?.querySelector("[data-editor-key]");
  if (!editorEl) return;
  editorEl.focus();
  document.execCommand(button.dataset.command, false, null);
  queueSave();
});

document.addEventListener("keydown", event => {
  if ((event.ctrlKey || event.metaKey) && !event.altKey && event.key.toLowerCase() === "s") {
    event.preventDefault();
    saveNow();
    return;
  }

  const notesHeading = event.target.closest?.("[data-detached-toggle-notes-heading]");
  if (notesHeading && (event.key === "Enter" || event.key === " ")) {
    event.preventDefault();
    const section = notesHeading.closest("[data-page-key]");
    setDetachedNotesCollapsed(section, !section.classList.contains("notes-collapsed"));
  }
});

document.addEventListener("click", event => {
  if (event.target instanceof Element && event.target.closest(".fr-picker")) return;
  closeFormatPickers();
});

document.addEventListener("scroll", positionOpenFormatPickers, true);
window.addEventListener("resize", () => {
  positionOpenFormatPickers();
  updateAllDetachedNotesHeadingDensity();
});

window.addEventListener("beforeunload", () => {
  if (unit) {
    const body = JSON.stringify(unitPayload());
    navigator.sendBeacon("/api/unit", new Blob([body], { type: "application/json" }));
  }
  postToMain({ type: "unit:closed" });
});

loadUnit();
