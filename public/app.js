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
  compareScope: document.querySelector("#compare-scope"),
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
    notes: {
      id: makeId("notes"),
      title: `Draft ${index} Notes`,
      createdAt,
      content: ""
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
      result.push({ type: "same", text: before[i].text });
      i += 1;
      j += 1;
    } else if (rows[i + 1][j] >= rows[i][j + 1]) {
      result.push({ type: "removed", text: before[i].text });
      i += 1;
    } else {
      result.push({ type: "added", text: after[j].text });
      j += 1;
    }
  }

  while (i < before.length) {
    result.push({ type: "removed", text: before[i].text });
    i += 1;
  }

  while (j < after.length) {
    result.push({ type: "added", text: after[j].text });
    j += 1;
  }

  return result;
}

function diffLines(beforeText, afterText) {
  const before = splitLines(beforeText).map(text => ({ key: text, text }));
  const after = splitLines(afterText).map(text => ({ key: text, text }));
  return diffSequence(before, after);
}

function tokenizeText(text) {
  const normalized = String(text || "").replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  const matches = normalized.match(/\n|[^\S\n]+|[\p{L}\p{N}]+|[^\s\p{L}\p{N}]/gu) || [];
  return matches.map(token => ({
    key: token,
    text: token,
    isWhitespace: /^\s+$/u.test(token)
  }));
}

function diffText(beforeText, afterText) {
  return diffSequence(tokenizeText(beforeText), tokenizeText(afterText));
}

function countMeaningfulChanges(parts) {
  let count = 0;
  let inChange = false;

  parts.forEach(part => {
    if (part.type === "same") {
      inChange = false;
      return;
    }

    if (!part.text.trim()) {
      return;
    }

    if (!inChange) {
      count += 1;
      inChange = true;
    }
  });

  return count;
}

function pairForDraft(draftIndex) {
  const draft = state.drafts[draftIndex];
  if (els.compareMode.value === "first") {
    return {
      before: state.drafts[0],
      after: draft,
      label: draftIndex === 0 ? "First draft" : `${draft.title} compared to ${state.drafts[0].title}`
    };
  }

  const previous = state.drafts[Math.max(0, draftIndex - 1)];
  return {
    before: previous,
    after: draft,
    label: draftIndex === 0 ? "First draft" : `${draft.title} compared to ${previous.title}`
  };
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

function renderEditor() {
  const draft = getSelectedDraft();
  selectedDraftId = draft.id;
  els.draftTitle.value = draft.title;
  els.draftContent.value = draft.content;
  els.draftNotes.value = draft.notes.content;
  els.initialNotes.value = state.initialNotes.content;
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

function markedLaterPageHtml(pair) {
  const diff = diffText(pair.before.content, pair.after.content);
  if (!diff.length) {
    return `<div class="compare-text empty-line">No draft text yet.</div>`;
  }

  const tokens = diff.map(part => {
    const className = part.type === "same" ? "compare-token" : `compare-token ${part.type}`;
    return `<span class="${className}">${escapeHtml(part.text)}</span>`;
  }).join("");

  return `<div class="compare-text">${tokens}</div>`;
}

function diffGroupHtml(pair) {
  const diff = diffText(pair.before.content, pair.after.content);
  const changedCount = countMeaningfulChanges(diff);

  return `
    <section class="compare-group">
      <div class="compare-title">
        <strong>${escapeHtml(pair.label)}</strong>
        <span>${changedCount} ${changedCount === 1 ? "change" : "changes"}</span>
      </div>
      <div class="compare-pages">
        <article class="compare-page">
          <div class="compare-page-heading">
            <span>Earlier draft</span>
            <strong>${escapeHtml(pair.before.title)}</strong>
          </div>
          <div class="compare-page-body">
            ${pageLinesHtml(pair.before.content)}
          </div>
        </article>
        <article class="compare-page later-page">
          <div class="compare-page-heading">
            <span>Later draft with changes</span>
            <strong>${escapeHtml(pair.after.title)}</strong>
          </div>
          <div class="compare-page-body">
            ${markedLaterPageHtml(pair)}
          </div>
        </article>
      </div>
    </section>
  `;
}

function renderDiff() {
  if (!showChanges) {
    els.diffOutput.innerHTML = "";
    els.compareSubtitle.textContent = "";
    return;
  }

  const selectedIndex = state.drafts.findIndex(draft => draft.id === selectedDraftId);
  const indexes = els.compareScope.value === "all"
    ? state.drafts.map((_, index) => index).filter(index => index > 0)
    : [selectedIndex > 0 ? selectedIndex : 1].filter(index => state.drafts[index]);

  els.compareSubtitle.textContent = els.compareMode.value === "first"
    ? "Later draft pages are marked against the first draft"
    : "Later draft pages are marked against the previous draft";

  els.diffOutput.innerHTML = indexes.length
    ? indexes.map(index => diffGroupHtml(pairForDraft(index))).join("")
    : `<p class="empty-state">Add Draft 2 to compare it with Draft 1.</p>`;
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
  renderChangesVisibility();
  renderDiff();
}

function syncFromInputs() {
  const draft = getSelectedDraft();
  draft.title = els.draftTitle.value || "Untitled draft";
  draft.content = els.draftContent.value;
  draft.notes.content = els.draftNotes.value;
  state.initialNotes.content = els.initialNotes.value;
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
  renderDraftTabs();
});

[els.draftTitle, els.draftContent, els.draftNotes].forEach(input => {
  input.addEventListener("focus", () => {
    activeArea = "draft";
    renderDraftTabs();
  });
});

[els.draftTitle, els.draftContent, els.draftNotes, els.initialNotes].forEach(input => {
  input.addEventListener("input", scheduleSave);
});

[els.compareMode, els.compareScope].forEach(input => {
  input.addEventListener("change", renderDiff);
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
