const els = {
  saveStatus: document.querySelector("#save-status"),
  storyTab: document.querySelector("#story-tab"),
  draftTabs: document.querySelector("#draft-tabs"),
  draftTitle: document.querySelector("#draft-title"),
  draftContent: document.querySelector("#draft-content"),
  draftNotes: document.querySelector("#draft-notes"),
  draftNotesTitle: document.querySelector("#draft-notes-title"),
  draftCreated: document.querySelector("#draft-created"),
  notesCreated: document.querySelector("#notes-created"),
  initialNotes: document.querySelector("#initial-notes"),
  initialCreated: document.querySelector("#initial-created"),
  newDraftCopy: document.querySelector("#new-draft-copy"),
  newDraftBlank: document.querySelector("#new-draft-blank"),
  toggleChanges: document.querySelector("#toggle-changes"),
  compareMode: document.querySelector("#compare-mode"),
  compareSelector: document.querySelector("#compare-selector"),
  compareSubtitle: document.querySelector("#compare-subtitle"),
  diffOutput: document.querySelector("#diff-output"),
  editorSurface: document.querySelector("#editor-surface"),
  changesPanel: document.querySelector("#changes-panel"),
  draftStack: document.querySelector("#draft-stack"),
  notesResizer: document.querySelector("#notes-resizer")
};

let state = null;
let selectedDraftId = null;
let activeArea = "draft";
let saveTimer = null;
let isSaving = false;
let showChanges = false;
let exportPath = "";
let draftPanePercent = Number(window.localStorage.getItem("draftPanePercent") || 62);
let compareSelectedIds = new Set();
let activeEditorId = "draft-content";

const DEFAULT_FORMAT = {
  fontFamily: "Segoe UI",
  fontSize: "16"
};

const allowedFontFamilies = new Set([
  "Segoe UI",
  "Arial",
  "Calibri",
  "Georgia",
  "Times New Roman",
  "Courier New"
]);

const allowedFontSizes = new Set(["12", "14", "16", "18", "20", "24", "28", "32"]);

const richEditors = [
  { id: "initial-notes", el: els.initialNotes, getPage: () => state.initialNotes },
  { id: "draft-content", el: els.draftContent, getPage: () => getSelectedDraft() },
  { id: "draft-notes", el: els.draftNotes, getPage: () => getSelectedDraft().notes }
];

function nowIso() {
  return new Date().toISOString();
}

function makeId(prefix) {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function formatDate(iso) {
  const date = new Date(iso);
  if (Number.isNaN(date.valueOf())) return iso;
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(date);
}

function getSelectedDraft() {
  return state.drafts.find(draft => draft.id === selectedDraftId) || state.drafts[0];
}

function createDraft(copyFrom) {
  const index = state.drafts.length + 1;
  const createdAt = nowIso();
  return {
    id: makeId("draft"),
    title: `Draft ${index}`,
    createdAt,
    content: copyFrom?.content || "",
    contentHtml: copyFrom?.contentHtml || textToHtml(copyFrom?.content || ""),
    format: copyFrom?.format ? { ...normalizeFormat(copyFrom.format) } : { ...DEFAULT_FORMAT },
    notes: {
      id: makeId("notes"),
      title: `Draft ${index} Notes`,
      createdAt,
      content: "",
      contentHtml: "",
      format: { ...DEFAULT_FORMAT }
    }
  };
}

function setStatus(text) {
  els.saveStatus.textContent = exportPath ? `${text} - ${exportPath}` : text;
}

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

function normalizeFormat(format = {}) {
  const fontFamily = allowedFontFamilies.has(format.fontFamily)
    ? format.fontFamily
    : DEFAULT_FORMAT.fontFamily;
  const fontSize = allowedFontSizes.has(String(format.fontSize))
    ? String(format.fontSize)
    : DEFAULT_FORMAT.fontSize;
  return { fontFamily, fontSize };
}

function ensurePageFields(page) {
  page.content = typeof page.content === "string" ? page.content : "";
  page.contentHtml = typeof page.contentHtml === "string" ? page.contentHtml : textToHtml(page.content);
  if (!page.content && page.contentHtml) page.content = plainTextFromHtml(page.contentHtml);
  page.format = normalizeFormat(page.format);
  return page;
}

function fontStyle(format) {
  const normalized = normalizeFormat(format);
  return `font-family: ${normalized.fontFamily}; font-size: ${normalized.fontSize}px;`;
}

function editorRecordById(editorId) {
  return richEditors.find(editor => editor.id === editorId);
}

function pageForEditorId(editorId) {
  return editorRecordById(editorId)?.getPage();
}

function toolbarForEditor(editorId) {
  return document.querySelector(`[data-toolbar-for="${editorId}"]`);
}

function sanitizeStyleMarks(styleValue = "") {
  const style = styleValue.toLowerCase();
  return {
    bold: /font-weight\s*:\s*(bold|[6-9]00)/.test(style),
    italic: /font-style\s*:\s*italic/.test(style),
    underline: /text-decoration[^;]*underline/.test(style),
    strike: /text-decoration[^;]*(line-through|strike)/.test(style)
  };
}

function wrapSemanticHtml(html, marks) {
  let output = html;
  if (marks.strike) output = `<s>${output}</s>`;
  if (marks.underline) output = `<u>${output}</u>`;
  if (marks.italic) output = `<em>${output}</em>`;
  if (marks.bold) output = `<strong>${output}</strong>`;
  return output;
}

function sanitizeRichHtml(html) {
  const template = document.createElement("template");
  template.innerHTML = String(html || "");
  const blockTags = new Set(["div", "p", "blockquote", "ul", "ol", "li"]);

  const sanitizeNode = node => {
    if (node.nodeType === Node.TEXT_NODE) return escapeHtml(node.nodeValue);
    if (node.nodeType !== Node.ELEMENT_NODE) return "";

    const tag = node.tagName.toLowerCase();
    if (tag === "br") return "<br>";

    const inner = Array.from(node.childNodes).map(sanitizeNode).join("");
    if (tag === "b" || tag === "strong") return `<strong>${inner}</strong>`;
    if (tag === "i" || tag === "em") return `<em>${inner}</em>`;
    if (tag === "u") return `<u>${inner}</u>`;
    if (tag === "s" || tag === "strike" || tag === "del") return `<s>${inner}</s>`;
    if (tag === "span") return wrapSemanticHtml(inner, sanitizeStyleMarks(node.getAttribute("style") || ""));
    if (blockTags.has(tag)) return `<${tag}>${inner}</${tag}>`;
    return inner;
  };

  return Array.from(template.content.childNodes).map(sanitizeNode).join("");
}

function plainTextFromHtml(html) {
  const template = document.createElement("template");
  template.innerHTML = sanitizeRichHtml(html);
  return plainTextFromNode(template.content).trimEnd();
}

function plainTextFromNode(root) {
  let output = "";
  const blockTags = new Set(["div", "p", "blockquote", "li", "ul", "ol"]);

  const walk = node => {
    if (node.nodeType === Node.TEXT_NODE) {
      output += node.nodeValue.replace(/\u00a0/g, " ");
      return;
    }

    if (node.nodeType !== Node.ELEMENT_NODE && node.nodeType !== Node.DOCUMENT_FRAGMENT_NODE) return;

    const tag = node.nodeType === Node.ELEMENT_NODE ? node.tagName.toLowerCase() : "";
    if (tag === "br") {
      output += "\n";
      return;
    }

    Array.from(node.childNodes).forEach(walk);
    if (blockTags.has(tag) && output && !output.endsWith("\n")) output += "\n";
  };

  walk(root);
  return output.replace(/\n{3,}/g, "\n\n");
}

function editorPlainText(editorEl) {
  return plainTextFromNode(editorEl).trimEnd();
}

function setEditorHtml(editorEl, html) {
  const sanitized = sanitizeRichHtml(html);
  if (editorEl.innerHTML !== sanitized) editorEl.innerHTML = sanitized;
}

function applyEditorFormat(editorEl, format) {
  const normalized = normalizeFormat(format);
  editorEl.style.fontFamily = normalized.fontFamily;
  editorEl.style.fontSize = `${normalized.fontSize}px`;
}

function syncToolbarValues(editorId) {
  const page = ensurePageFields(pageForEditorId(editorId));
  const toolbar = toolbarForEditor(editorId);
  if (!toolbar) return;

  toolbar.querySelectorAll("[data-page-format]").forEach(control => {
    const field = control.dataset.pageFormat;
    control.value = page.format[field];
  });
}

function syncRichPage(page, editorEl) {
  ensurePageFields(page);
  page.contentHtml = sanitizeRichHtml(editorEl.innerHTML);
  page.content = editorPlainText(editorEl);
  page.format = normalizeFormat(page.format);
}

function splitLines(text) {
  if (!text) return [];
  return text.replace(/\r\n/g, "\n").replace(/\r/g, "\n").split("\n");
}

function diffSequence(before, after) {
  const rows = Array.from({ length: before.length + 1 }, () => Array(after.length + 1).fill(0));

  for (let i = before.length - 1; i >= 0; i -= 1) {
    for (let j = after.length - 1; j >= 0; j -= 1) {
      rows[i][j] = before[i].key === after[j].key
        ? rows[i + 1][j + 1] + 1
        : Math.max(rows[i + 1][j], rows[i][j + 1]);
    }
  }

  const result = [];
  let i = 0;
  let j = 0;

  while (i < before.length && j < after.length) {
    if (before[i].key === after[j].key) {
      result.push({ type: "same", text: before[i].text, marks: after[j].marks || before[i].marks || {} });
      i += 1;
      j += 1;
    } else if (rows[i + 1][j] >= rows[i][j + 1]) {
      result.push({ type: "removed", text: before[i].text, marks: before[i].marks || {} });
      i += 1;
    } else {
      result.push({ type: "added", text: after[j].text, marks: after[j].marks || {} });
      j += 1;
    }
  }

  while (i < before.length) {
    result.push({ type: "removed", text: before[i].text, marks: before[i].marks || {} });
    i += 1;
  }

  while (j < after.length) {
    result.push({ type: "added", text: after[j].text, marks: after[j].marks || {} });
    j += 1;
  }

  return result;
}

function diffLines(beforeText, afterText) {
  const before = splitLines(beforeText).map(text => ({ key: text, text }));
  const after = splitLines(afterText).map(text => ({ key: text, text }));
  return diffSequence(before, after);
}

function tokenizeSegment(text, marks = {}) {
  const normalized = String(text || "").replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  const matches = normalized.match(/\n|[^\S\n]+|[\p{L}\p{N}]+|[^\s\p{L}\p{N}]/gu) || [];
  const semanticKey = marks.whitespace ? "" : `${marks.bold ? "b" : ""}${marks.italic ? "i" : ""}${marks.underline ? "u" : ""}${marks.strike ? "s" : ""}`;
  return matches.map(token => ({
    key: /^\s+$/u.test(token) ? token : `${token}|${semanticKey}`,
    text: token,
    marks: { ...marks },
    isWhitespace: /^\s+$/u.test(token)
  }));
}

function semanticTokensFromHtml(html) {
  const template = document.createElement("template");
  template.innerHTML = sanitizeRichHtml(html);
  const tokens = [];
  const blockTags = new Set(["div", "p", "blockquote", "li", "ul", "ol"]);

  const addNewline = marks => {
    if (tokens.length && tokens[tokens.length - 1].text !== "\n") {
      tokens.push(...tokenizeSegment("\n", marks));
    }
  };

  const walk = (node, marks = {}) => {
    if (node.nodeType === Node.TEXT_NODE) {
      tokens.push(...tokenizeSegment(node.nodeValue.replace(/\u00a0/g, " "), marks));
      return;
    }

    if (node.nodeType !== Node.ELEMENT_NODE && node.nodeType !== Node.DOCUMENT_FRAGMENT_NODE) return;

    const tag = node.nodeType === Node.ELEMENT_NODE ? node.tagName.toLowerCase() : "";
    if (tag === "br") {
      addNewline(marks);
      return;
    }

    const nextMarks = {
      bold: marks.bold || tag === "b" || tag === "strong",
      italic: marks.italic || tag === "i" || tag === "em",
      underline: marks.underline || tag === "u",
      strike: marks.strike || tag === "s" || tag === "strike" || tag === "del"
    };

    Array.from(node.childNodes).forEach(child => walk(child, nextMarks));
    if (blockTags.has(tag)) addNewline(marks);
  };

  walk(template.content);
  while (tokens.length && tokens[tokens.length - 1].text === "\n") tokens.pop();
  return tokens;
}

function diffRichPages(beforePage, afterPage) {
  ensurePageFields(beforePage);
  ensurePageFields(afterPage);
  return diffSequence(
    semanticTokensFromHtml(beforePage.contentHtml),
    semanticTokensFromHtml(afterPage.contentHtml)
  );
}

function countMeaningfulChanges(parts) {
  let count = 0;
  let inChange = false;

  parts.forEach(part => {
    if (part.type === "same") {
      inChange = false;
      return;
    }

    if (!inChange) {
      count += 1;
      inChange = true;
    }
  });

  return count;
}

function pairForIndexes(beforeIndex, afterIndex) {
  const previous = state.drafts[beforeIndex];
  const draft = state.drafts[afterIndex];
  return {
    before: previous,
    after: draft,
    label: `${draft.title} compared to ${previous.title}`
  };
}

function draftIndexForId(draftId) {
  return state.drafts.findIndex(draft => draft.id === draftId);
}

function resetCompareSelection() {
  compareSelectedIds = new Set(state.drafts.map(draft => draft.id));
}

function pruneCompareSelection() {
  const draftIds = new Set(state.drafts.map(draft => draft.id));
  compareSelectedIds = new Set([...compareSelectedIds].filter(id => draftIds.has(id)));
}

function renderDraftTabs() {
  els.storyTab.classList.toggle("active", activeArea === "story");
  els.draftTabs.innerHTML = state.drafts.map(draft => {
    const active = draft.id === selectedDraftId && activeArea !== "story" ? " active" : "";
    return `
      <button class="page-tab draft-tab${active}" type="button" data-draft-id="${draft.id}">
        <span>${escapeHtml(draft.title)}</span>
      </button>
    `;
  }).join("");
}

function renderCompareSelector() {
  pruneCompareSelection();

  if (!state.drafts.length) {
    els.compareSelector.innerHTML = `<p class="compare-selector-empty">No drafts yet.</p>`;
    return;
  }

  els.compareSelector.innerHTML = state.drafts.map(draft => {
    const checked = compareSelectedIds.has(draft.id) ? " checked" : "";
    return `
      <label class="compare-choice">
        <input type="checkbox" data-compare-draft-id="${draft.id}" aria-label="Compare ${escapeHtml(draft.title)}"${checked}>
        <span>${escapeHtml(draft.title)}</span>
      </label>
    `;
  }).join("");
}

function renderEditor() {
  ensurePageFields(state.initialNotes);
  const draft = getSelectedDraft();
  ensurePageFields(draft);
  ensurePageFields(draft.notes);
  selectedDraftId = draft.id;
  els.draftTitle.value = draft.title;
  setEditorHtml(els.draftContent, draft.contentHtml);
  setEditorHtml(els.draftNotes, draft.notes.contentHtml);
  setEditorHtml(els.initialNotes, state.initialNotes.contentHtml);
  applyEditorFormat(els.draftContent, draft.format);
  applyEditorFormat(els.draftNotes, draft.notes.format);
  applyEditorFormat(els.initialNotes, state.initialNotes.format);
  richEditors.forEach(editor => syncToolbarValues(editor.id));
  els.draftNotesTitle.textContent = `${draft.title} notes`;
  els.draftCreated.textContent = `Created ${formatDate(draft.createdAt)}`;
  els.notesCreated.textContent = `Created ${formatDate(draft.notes.createdAt)}`;
  els.initialCreated.textContent = `Created ${formatDate(state.initialNotes.createdAt)}`;
}

function pageLinesHtml(text) {
  const lines = splitLines(text);
  if (!lines.length) {
    return `<p class="compare-line empty-line">No draft text yet.</p>`;
  }

  return lines
    .map(line => `<p class="compare-line">${escapeHtml(line || " ")}</p>`)
    .join("");
}

function richPageHtml(page) {
  ensurePageFields(page);
  if (!page.content.trim()) {
    return `<p class="compare-line empty-line">No draft text yet.</p>`;
  }
  return sanitizeRichHtml(page.contentHtml);
}

function semanticClasses(marks = {}) {
  return [
    marks.bold ? "semantic-bold" : "",
    marks.italic ? "semantic-italic" : "",
    marks.underline ? "semantic-underline" : "",
    marks.strike ? "semantic-strike" : ""
  ].filter(Boolean).join(" ");
}

function visibleChangedWhitespace(text) {
  return text
    .replace(/ /g, "·")
    .replace(/\t/g, "⇥")
    .replace(/\n/g, "↵\n");
}

function renderDiffToken(part) {
  const classes = ["compare-token"];
  if (part.type !== "same") classes.push(part.type);
  const semanticClassName = semanticClasses(part.marks);
  if (semanticClassName) classes.push(semanticClassName);
  const text = part.type === "same" ? part.text : visibleChangedWhitespace(part.text);
  return `<span class="${classes.join(" ")}">${escapeHtml(text)}</span>`;
}

function baseComparePageHtml(draft, subtitle = "Earlier draft") {
  ensurePageFields(draft);
  return `
    <article class="compare-page">
      <div class="compare-page-heading">
        <span>${escapeHtml(subtitle)}</span>
        <strong>${escapeHtml(draft.title)}</strong>
      </div>
      <div class="compare-page-body" style="${fontStyle(draft.format)}">
        <div class="compare-rich-content">${richPageHtml(draft)}</div>
      </div>
    </article>
  `;
}

function markedLaterPageHtml(pair) {
  const diff = diffRichPages(pair.before, pair.after);
  if (!diff.length) {
    return `<div class="compare-text empty-line">No draft text yet.</div>`;
  }

  const tokens = diff.map(renderDiffToken).join("");
  return `<div class="compare-text">${tokens}</div>`;
}

function markedComparePageHtml(pair) {
  const diff = diffRichPages(pair.before, pair.after);
  const changedCount = countMeaningfulChanges(diff);

  return `
    <article class="compare-page later-page">
      <div class="compare-page-heading">
        <span>Compared page</span>
        <strong>${escapeHtml(pair.after.title)}</strong>
      </div>
      <div class="compare-page-subhead">
        <span>${escapeHtml(pair.label)}</span>
        <span>${changedCount} ${changedCount === 1 ? "change" : "changes"}</span>
      </div>
      <div class="compare-page-body" style="${fontStyle(pair.after.format)}">
        ${markedLaterPageHtml(pair)}
      </div>
    </article>
  `;
}

function selectedCompareIndexes() {
  return [...compareSelectedIds]
    .map(draftIndexForId)
    .filter(index => index >= 0)
    .sort((a, b) => a - b);
}

function beforeIndexForSelectedDraft(indexes, position) {
  return els.compareMode.value === "first" ? indexes[0] : indexes[position - 1];
}

function renderComparisonStrip(indexes) {
  const pages = [];

  pages.push(baseComparePageHtml(state.drafts[indexes[0]], "Selected baseline"));

  indexes.slice(1).forEach((draftIndex, offset) => {
    const beforeIndex = beforeIndexForSelectedDraft(indexes, offset + 1);
    const pair = pairForIndexes(beforeIndex, draftIndex);
    pages.push(markedComparePageHtml(pair));
  });

  return `<div class="compare-strip">${pages.join("")}</div>`;
}

function renderDiff() {
  if (!showChanges) {
    els.diffOutput.innerHTML = "";
    els.compareSubtitle.textContent = "";
    return;
  }

  renderCompareSelector();
  const indexes = selectedCompareIndexes();

  els.compareSubtitle.textContent = els.compareMode.value === "first"
    ? "Selected draft pages are marked against the first selected draft"
    : "Selected draft pages are marked against the previous selected draft";

  els.diffOutput.innerHTML = indexes.length
    ? renderComparisonStrip(indexes)
    : `<p class="empty-state">No draft pages selected.</p>`;
}

function renderChangesVisibility() {
  els.editorSurface.classList.toggle("compare-open", showChanges);
  els.changesPanel.hidden = !showChanges;
  els.toggleChanges.setAttribute("aria-pressed", String(showChanges));
  els.toggleChanges.textContent = showChanges ? "Hide changes" : "Show changes";
}

function render() {
  renderDraftTabs();
  renderEditor();
  renderCompareSelector();
  renderChangesVisibility();
  renderDiff();
}

function syncFromInputs() {
  const draft = getSelectedDraft();
  draft.title = els.draftTitle.value || "Untitled draft";
  syncRichPage(draft, els.draftContent);
  syncRichPage(draft.notes, els.draftNotes);
  syncRichPage(state.initialNotes, els.initialNotes);
}

function scheduleSave() {
  syncFromInputs();
  renderDraftTabs();
  els.draftNotesTitle.textContent = `${getSelectedDraft().title} notes`;
  renderDiff();
  setStatus(isSaving ? "Saving..." : "Unsaved changes");
  window.clearTimeout(saveTimer);
  saveTimer = window.setTimeout(saveNow, 450);
}

async function saveNow() {
  if (!state) return;
  syncFromInputs();
  isSaving = true;
  setStatus("Saving...");

  const response = await fetch("/api/state", {
    method: "PUT",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(state)
  });

  if (!response.ok) {
    setStatus("Save failed");
    isSaving = false;
    return;
  }

  const payload = await response.json();
  state = payload.state;
  exportPath = payload.exportPath || exportPath;
  isSaving = false;
  setStatus(`Saved ${formatDate(state.updatedAt)}`);
  renderDraftTabs();
}

async function loadState() {
  const response = await fetch("/api/state");
  const payload = await response.json();
  state = payload.state;
  exportPath = payload.exportPath || "";
  selectedDraftId = state.drafts[0]?.id;
  resetCompareSelection();
  setDraftPanePercent(draftPanePercent);
  setStatus("Saved");
  render();
}

function selectDraft(draftId) {
  syncFromInputs();
  selectedDraftId = draftId;
  activeArea = "draft";
  render();
  scheduleSave();
  els.draftContent.focus();
}

function addDraft(copyFromSelected) {
  syncFromInputs();
  const draft = createDraft(copyFromSelected ? getSelectedDraft() : null);
  state.drafts.push(draft);
  compareSelectedIds.add(draft.id);
  selectedDraftId = draft.id;
  activeArea = "draft";
  render();
  scheduleSave();
  els.draftContent.focus();
}

function setDraftPanePercent(value) {
  draftPanePercent = Math.min(78, Math.max(28, Number(value) || 62));
  els.draftStack.style.setProperty("--draft-pane-height", `${draftPanePercent}%`);
  window.localStorage.setItem("draftPanePercent", String(draftPanePercent));
}

function resizeDraftStack(clientY) {
  const rect = els.draftStack.getBoundingClientRect();
  const minPixels = 150;
  const maxPixels = Math.max(minPixels, rect.height - 125);
  const draftPixels = Math.min(maxPixels, Math.max(minPixels, clientY - rect.top));
  setDraftPanePercent((draftPixels / rect.height) * 100);
}

function setActiveEditor(editorId) {
  activeEditorId = editorId;
}

function applyPageFormat(editorId, field, value) {
  const page = ensurePageFields(pageForEditorId(editorId));
  page.format[field] = value;
  page.format = normalizeFormat(page.format);
  const editor = editorRecordById(editorId);
  applyEditorFormat(editor.el, page.format);
  syncToolbarValues(editorId);
  scheduleSave();
}

function runEditorCommand(editorId, command) {
  const editor = editorRecordById(editorId);
  if (!editor) return;
  setActiveEditor(editorId);
  editor.el.focus();
  document.execCommand(command, false, null);
  scheduleSave();
}

els.storyTab.addEventListener("click", () => {
  activeArea = "story";
  renderDraftTabs();
  els.initialNotes.focus();
});

els.draftTabs.addEventListener("click", event => {
  const button = event.target.closest("[data-draft-id]");
  if (!button) return;
  selectDraft(button.dataset.draftId);
});

els.newDraftBlank.addEventListener("click", () => addDraft(false));
els.newDraftCopy.addEventListener("click", () => addDraft(true));

els.initialNotes.addEventListener("focus", () => {
  activeArea = "story";
  setActiveEditor("initial-notes");
  renderDraftTabs();
});

[
  { el: els.draftContent, id: "draft-content" },
  { el: els.draftNotes, id: "draft-notes" }
].forEach(({ el, id }) => {
  el.addEventListener("focus", () => {
    activeArea = "draft";
    setActiveEditor(id);
    renderDraftTabs();
  });
});

els.draftTitle.addEventListener("focus", () => {
  activeArea = "draft";
  setActiveEditor("draft-content");
  renderDraftTabs();
});

richEditors.forEach(({ el, id }) => {
  el.addEventListener("focus", () => {
    setActiveEditor(id);
  });
});

richEditors.forEach(({ el, id }) => {
  el.addEventListener("input", scheduleSave);
  el.addEventListener("keydown", event => {
    if (event.key !== "Tab") return;
    event.preventDefault();
    setActiveEditor(id);
    document.execCommand("insertText", false, "\t");
    scheduleSave();
  });
  el.addEventListener("paste", event => {
    event.preventDefault();
    setActiveEditor(id);
    const html = event.clipboardData.getData("text/html");
    const text = event.clipboardData.getData("text/plain");
    document.execCommand("insertHTML", false, html ? sanitizeRichHtml(html) : textToHtml(text));
    scheduleSave();
  });
});

els.draftTitle.addEventListener("input", scheduleSave);

document.querySelectorAll(".editor-format-ribbon").forEach(toolbar => {
  toolbar.addEventListener("mousedown", event => {
    if (event.target.closest("button")) event.preventDefault();
  });

  toolbar.addEventListener("click", event => {
    const button = event.target.closest("[data-command]");
    if (!button) return;
    runEditorCommand(toolbar.dataset.toolbarFor || activeEditorId, button.dataset.command);
  });

  toolbar.addEventListener("change", event => {
    const control = event.target.closest("[data-page-format]");
    if (!control) return;
    applyPageFormat(toolbar.dataset.toolbarFor || activeEditorId, control.dataset.pageFormat, control.value);
  });
});

els.compareMode.addEventListener("change", renderDiff);

els.compareSelector.addEventListener("change", event => {
  const checkbox = event.target.closest("[data-compare-draft-id]");
  if (!checkbox) return;

  if (checkbox.checked) {
    compareSelectedIds.add(checkbox.dataset.compareDraftId);
  } else {
    compareSelectedIds.delete(checkbox.dataset.compareDraftId);
  }

  renderDiff();
});

els.toggleChanges.addEventListener("click", () => {
  showChanges = !showChanges;
  renderChangesVisibility();
  renderDiff();
});

els.notesResizer.addEventListener("pointerdown", event => {
  event.preventDefault();
  els.draftStack.classList.add("is-resizing");

  const onMove = moveEvent => resizeDraftStack(moveEvent.clientY);
  const onUp = () => {
    els.draftStack.classList.remove("is-resizing");
    window.removeEventListener("pointermove", onMove);
    window.removeEventListener("pointerup", onUp);
  };

  window.addEventListener("pointermove", onMove);
  window.addEventListener("pointerup", onUp);
});

els.notesResizer.addEventListener("keydown", event => {
  if (event.key === "ArrowUp") {
    event.preventDefault();
    setDraftPanePercent(draftPanePercent - 4);
  }

  if (event.key === "ArrowDown") {
    event.preventDefault();
    setDraftPanePercent(draftPanePercent + 4);
  }
});

window.addEventListener("beforeunload", () => {
  if (!state) return;
  syncFromInputs();
  const blob = new Blob([JSON.stringify(state)], { type: "application/json" });
  navigator.sendBeacon("/api/close", blob);
});

loadState().catch(error => {
  console.error(error);
  setStatus("Could not load project");
});
