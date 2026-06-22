(function initDraftDiffStateCore(root, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
    return;
  }

  root.DraftDiffStateCore = factory();
})(typeof globalThis !== "undefined" ? globalThis : this, function createDraftDiffStateCore() {
  "use strict";

  const STORY_KEY = "story";
  const PROJECT_NOTES_TITLE = "Project notes";
  const FORMAT_DEFAULT_VERSION = 2;
  const VIEW_STATE_VERSION = 2;
  const MIN_PAGE_PANE_PERCENT = 12;
  const LEGACY_DEFAULT_FONT_FAMILY = "Segoe UI";

  const DEFAULT_FORMAT = Object.freeze({
    fontFamily: "Consolas",
    fontSize: "16",
    lineHeight: "1.62"
  });

  const FONT_FAMILY_OPTIONS = Object.freeze([
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
  ]);

  const FONT_SIZE_OPTIONS = Object.freeze(["12", "14", "16", "18", "20", "24", "28", "32"]);
  const LINE_HEIGHT_OPTIONS = Object.freeze(["1.2", "1.4", "1.62", "1.8", "2"]);

  const allowedFontFamilies = new Set(FONT_FAMILY_OPTIONS);
  const allowedFontSizes = new Set(FONT_SIZE_OPTIONS);
  const allowedLineHeights = new Set(LINE_HEIGHT_OPTIONS);

  function nowIso() {
    return new Date().toISOString();
  }

  function id(prefix) {
    return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  }

  function asText(value) {
    return typeof value === "string" ? value : "";
  }

  function escapeHtml(value) {
    return asText(value)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function textToHtml(value) {
    return escapeHtml(value).replace(/\n/g, "<br>");
  }

  function hasParagraphHtml(value) {
    return /<\s*p(?:\s|>|\/)/i.test(asText(value));
  }

  function decodeHtmlText(value) {
    return asText(value)
      .replace(/&nbsp;/g, " ")
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&quot;/g, '"')
      .replace(/&#039;/g, "'");
  }

  function htmlToText(value) {
    const source = asText(value);
    const blockTags = new Set(["div", "p", "li", "blockquote", "h1", "h2", "h3", "h4", "h5", "h6", "ul", "ol"]);
    const paragraphTags = new Set(["p", "blockquote"]);
    let output = "";
    let lastIndex = 0;

    const ensureTrailingNewlines = count => {
      if (!output) return;
      const trailing = output.match(/\n*$/u)?.[0].length || 0;
      if (trailing < count) output += "\n".repeat(count - trailing);
    };

    const appendDecodedSegment = (segment, hasAdjacentTag) => {
      let text = decodeHtmlText(segment);
      if (hasAdjacentTag && text.includes("\n")) {
        if (!text.trim()) return;
        text = text
          .replace(/^[ \t]*\n[ \t]*/u, "")
          .replace(/[ \t]*\n[ \t]*$/u, "");
      }

      output += text;
    };

    source.replace(/<[^>]*>/g, (tagText, offset) => {
      appendDecodedSegment(source.slice(lastIndex, offset), true);
      const tagMatch = /^<\s*\/?\s*([a-z0-9]+)/i.exec(tagText);
      const tagName = tagMatch?.[1]?.toLowerCase() || "";
      const isClosingTag = /^<\s*\//.test(tagText);

      if (tagName === "br") {
        output += "\n";
      } else if (paragraphTags.has(tagName)) {
        ensureTrailingNewlines(isClosingTag ? 2 : 1);
      } else if (blockTags.has(tagName)) {
        ensureTrailingNewlines(1);
      }

      lastIndex = offset + tagText.length;
      return tagText;
    });

    appendDecodedSegment(source.slice(lastIndex), lastIndex > 0);
    return output.trimEnd();
  }

  function lineBreakCount(value) {
    return (asText(value).match(/\n/g) || []).length;
  }

  function normalizeFormat(format = {}) {
    const fontFamily = allowedFontFamilies.has(format?.fontFamily)
      ? format.fontFamily
      : DEFAULT_FORMAT.fontFamily;
    const fontSize = allowedFontSizes.has(String(format?.fontSize))
      ? String(format.fontSize)
      : DEFAULT_FORMAT.fontSize;
    const lineHeight = allowedLineHeights.has(String(format?.lineHeight))
      ? String(format.lineHeight)
      : DEFAULT_FORMAT.lineHeight;
    return { fontFamily, fontSize, lineHeight };
  }

  function upgradeLegacyDefaultFormat(format = {}, shouldUpgrade = false) {
    const normalized = normalizeFormat(format);
    return shouldUpgrade && normalized.fontFamily === LEGACY_DEFAULT_FONT_FAMILY
      ? { ...normalized, fontFamily: DEFAULT_FORMAT.fontFamily }
      : normalized;
  }

  function currentDefaultFormat(state = null) {
    return normalizeFormat(state?.defaultFormat || DEFAULT_FORMAT);
  }

  function normalizePage(page, fallback, options = {}) {
    const providedContentHtml = asText(page?.contentHtml);
    const providedContent = asText(page?.content);
    const htmlContent = providedContentHtml ? htmlToText(providedContentHtml) : "";
    const shouldPreservePlainTextLines = providedContent &&
      !hasParagraphHtml(providedContentHtml) &&
      lineBreakCount(providedContent) > lineBreakCount(htmlContent);
    const content = shouldPreservePlainTextLines ? providedContent : htmlContent || providedContent;

    return {
      id: page?.id || fallback.id,
      title: page?.title || fallback.title,
      createdAt: page?.createdAt || fallback.createdAt,
      updatedAt: page?.updatedAt || fallback.updatedAt || page?.createdAt || fallback.createdAt,
      content,
      contentHtml: shouldPreservePlainTextLines ? textToHtml(content) : providedContentHtml || textToHtml(content),
      format: upgradeLegacyDefaultFormat(
        { ...normalizeFormat(options.defaultFormat || DEFAULT_FORMAT), ...(page?.format || {}) },
        options.upgradeLegacyDefaultFont
      )
    };
  }

  function pageVersionSnapshot(page, fallbackTitle, timestamp = nowIso()) {
    return {
      id: id("version"),
      createdAt: timestamp,
      title: page.title || fallbackTitle,
      content: page.content,
      contentHtml: page.contentHtml,
      format: normalizeFormat(page.format)
    };
  }

  function versionHasMeaningfulContent(version) {
    return Boolean((asText(version?.content) || htmlToText(version?.contentHtml || "")).trim());
  }

  function versionHistoryTime(version) {
    const time = Date.parse(version?.createdAt || "");
    return Number.isNaN(time) ? null : time;
  }

  function sortVersionHistoryByCreatedAt(history) {
    return (Array.isArray(history) ? history : []).slice().sort((left, right) => {
      const leftTime = versionHistoryTime(left);
      const rightTime = versionHistoryTime(right);
      if (leftTime === null || rightTime === null) return 0;
      return leftTime - rightTime;
    });
  }

  function historyOptionCallbacks(options = {}) {
    return {
      ensurePage: typeof options.ensurePage === "function" ? options.ensurePage : null,
      now: typeof options.now === "function" ? options.now : nowIso,
      sanitizeHtml: typeof options.sanitizeHtml === "function" ? options.sanitizeHtml : asText,
      textFromHtml: typeof options.textFromHtml === "function" ? options.textFromHtml : htmlToText
    };
  }

  function normalizePageVersionHistory(history, page, fallbackTitle, options = {}) {
    const callbacks = historyOptionCallbacks(options);
    const normalized = (Array.isArray(history) ? history : [])
      .filter(entry => entry && typeof entry === "object")
      .map(entry => {
        const contentHtml = typeof entry.contentHtml === "string"
          ? callbacks.sanitizeHtml(entry.contentHtml)
          : textToHtml(typeof entry.content === "string" ? entry.content : page.content || "");
        const content = typeof entry.content === "string"
          ? entry.content
          : callbacks.textFromHtml(contentHtml);
        return {
          id: asText(entry.id) || id("version"),
          createdAt: asText(entry.createdAt) || page.updatedAt || page.createdAt || callbacks.now(),
          title: asText(entry.title) || page.title || fallbackTitle,
          content,
          contentHtml,
          format: normalizeFormat({ ...page.format, ...(entry.format || {}) })
        };
      });

    while (normalized.length && !versionHasMeaningfulContent(normalized[0])) {
      normalized.shift();
    }

    if (!normalized.length) {
      const current = pageVersionSnapshot(page, fallbackTitle, page.updatedAt || callbacks.now());
      if (versionHasMeaningfulContent(current)) normalized.push(current);
    }

    return sortVersionHistoryByCreatedAt(normalized);
  }

  function normalizeDraftVersionHistory(history, draft) {
    return normalizePageVersionHistory(history, draft, draft?.title || "Untitled draft");
  }

  function ensurePageVersionHistory(page, fallbackTitle, options = {}) {
    if (!page) return [];

    const callbacks = historyOptionCallbacks(options);
    if (callbacks.ensurePage) callbacks.ensurePage(page);

    page.versionHistory = normalizePageVersionHistory(
      page.versionHistory,
      page,
      fallbackTitle,
      options
    );
    return page.versionHistory;
  }

  function ensureDraftVersionHistory(draft, options = {}) {
    return ensurePageVersionHistory(draft, draft?.title || "Untitled draft", options);
  }

  function ensureProjectNotesVersionHistory(state, options = {}) {
    return ensurePageVersionHistory(state?.initialNotes, PROJECT_NOTES_TITLE, options);
  }

  function pageVersionSignature(version) {
    return JSON.stringify({
      title: asText(version?.title),
      content: asText(version?.content),
      contentHtml: asText(version?.contentHtml),
      format: normalizeFormat(version?.format || {})
    });
  }

  function latestVersionHistoryEntry(history) {
    let latest = null;
    let latestTime = -Infinity;
    (Array.isArray(history) ? history : []).forEach(version => {
      const time = versionHistoryTime(version);
      if (time === null || time < latestTime) return;
      latest = version;
      latestTime = time;
    });
    return latest;
  }

  function currentPageHistorySnapshot(page, fallbackTitle, options = {}) {
    const callbacks = historyOptionCallbacks(options);
    if (callbacks.ensurePage) callbacks.ensurePage(page);
    return pageVersionSnapshot(page, fallbackTitle, page.updatedAt || page.createdAt || callbacks.now());
  }

  function addCurrentPageToHistoryIfMissing(history, page, fallbackTitle, options = {}) {
    const current = currentPageHistorySnapshot(page, fallbackTitle, options);
    if (!versionHasMeaningfulContent(current)) return history;

    const currentSignature = pageVersionSignature(current);
    if (history.some(version => pageVersionSignature(version) === currentSignature)) return history;
    return sortVersionHistoryByCreatedAt([...history, current]);
  }

  function applyVersionHistoryEntryToPage(page, version, fallbackTitle, options = {}) {
    if (!page || !version) return;

    const callbacks = historyOptionCallbacks(options);
    const contentHtml = typeof version.contentHtml === "string"
      ? callbacks.sanitizeHtml(version.contentHtml)
      : textToHtml(typeof version.content === "string" ? version.content : "");
    const content = typeof version.content === "string" ? version.content : callbacks.textFromHtml(contentHtml);
    page.title = version.title || page.title || fallbackTitle;
    page.content = content;
    page.contentHtml = contentHtml;
    page.format = normalizeFormat(version.format || page.format || {});
    page.updatedAt = version.createdAt || page.updatedAt || page.createdAt || callbacks.now();
  }

  function promotePageToNewestHistoryVersion(page, fallbackTitle, options = {}) {
    if (!page) return false;

    let history = ensurePageVersionHistory(page, fallbackTitle, options);
    const latest = latestVersionHistoryEntry(history);
    const latestTime = versionHistoryTime(latest);
    const currentTime = versionHistoryTime({ createdAt: page.updatedAt || page.createdAt });
    if (!latest || latestTime === null || (currentTime !== null && latestTime <= currentTime)) return false;

    const currentSignature = pageVersionSignature(currentPageHistorySnapshot(page, fallbackTitle, options));
    const latestSignature = pageVersionSignature(latest);
    if (currentSignature !== latestSignature) {
      history = addCurrentPageToHistoryIfMissing(history, page, fallbackTitle, options);
    }

    applyVersionHistoryEntryToPage(page, latest, fallbackTitle, options);
    page.versionHistory = history;
    return true;
  }

  function appendPageVersionIfChanged(page, fallbackTitle, options = {}) {
    if (!page) return false;

    const hadRecordedVersion = Array.isArray(page.versionHistory)
      && page.versionHistory.some(versionHasMeaningfulContent);
    const history = ensurePageVersionHistory(page, fallbackTitle, options);
    if (!hadRecordedVersion && history.length) return true;

    const current = currentPageHistorySnapshot(page, fallbackTitle, options);
    if (!history.length && !versionHasMeaningfulContent(current)) return false;

    const previous = history[history.length - 1];
    if (pageVersionSignature(previous) === pageVersionSignature(current)) return false;

    history.push(current);
    return true;
  }

  function normalizeIndexArray(values, maxLength) {
    return [...new Set((Array.isArray(values) ? values : [])
      .map(value => Number(value))
      .filter(value => Number.isInteger(value) && value >= 0 && value < maxLength))]
      .sort((a, b) => a - b);
  }

  function normalizeIdArray(values, validIds) {
    return [...new Set((Array.isArray(values) ? values : [])
      .map(value => asText(value))
      .filter(value => validIds.has(value)))];
  }

  function normalizeNotesPanePercents(values, maxLength) {
    const normalized = {};
    if (!values || typeof values !== "object" || Array.isArray(values)) return normalized;

    Object.entries(values).forEach(([index, value]) => {
      const numericIndex = Number(index);
      const numericValue = Number(value);
      if (
        Number.isInteger(numericIndex) &&
        numericIndex >= 0 &&
        numericIndex < maxLength &&
        Number.isFinite(numericValue)
      ) {
        normalized[numericIndex] = Math.min(90, Math.max(10, numericValue));
      }
    });
    return normalized;
  }

  function normalizePagePanePercents(values, drafts) {
    const normalized = {};
    if (!values || typeof values !== "object" || Array.isArray(values)) return normalized;

    const validKeys = new Set([
      STORY_KEY,
      ...drafts.map(draft => `draft:${draft.id}:content`)
    ]);
    Object.entries(values).forEach(([key, value]) => {
      const numericValue = Number(value);
      if (validKeys.has(key) && Number.isFinite(numericValue)) {
        normalized[key] = Math.min(1000, Math.max(MIN_PAGE_PANE_PERCENT, numericValue));
      }
    });
    return normalized;
  }

  function draftIndexById(drafts, draftId) {
    return drafts.findIndex(draft => draft.id === draftId);
  }

  function draftRefFromViewState(drafts, draftId, draftIndex) {
    const byIdIndex = draftIndexById(drafts, asText(draftId));
    const byIndex = Number(draftIndex);
    const normalizedIndex = byIdIndex >= 0
      ? byIdIndex
      : Number.isInteger(byIndex) && byIndex >= 0 && byIndex < drafts.length
        ? byIndex
        : 0;
    return {
      draft: drafts[normalizedIndex] || null,
      index: normalizedIndex
    };
  }

  function normalizeEditorSelection(selection) {
    if (!selection || typeof selection !== "object" || Array.isArray(selection)) return null;

    const normalized = {};
    ["startOffset", "endOffset", "startTextOffset", "endTextOffset", "scrollTop", "scrollLeft"].forEach(field => {
      const value = Number(selection[field]);
      if (Number.isFinite(value)) normalized[field] = Math.max(0, value);
    });

    ["startPath", "endPath"].forEach(field => {
      if (!Array.isArray(selection[field])) return;
      normalized[field] = selection[field]
        .map(value => Number(value))
        .filter(value => Number.isInteger(value) && value >= 0);
    });

    return Object.keys(normalized).length ? normalized : null;
  }

  function validEditorKeys(drafts) {
    return new Set([
      STORY_KEY,
      ...drafts.flatMap(draft => [
        `draft:${draft.id}:content`,
        `draft:${draft.id}:notes`
      ])
    ]);
  }

  function normalizeEditorSelections(selections, drafts) {
    const normalized = {};
    if (!selections || typeof selections !== "object" || Array.isArray(selections)) return normalized;

    const keys = validEditorKeys(drafts);
    Object.entries(selections).forEach(([key, selection]) => {
      if (!keys.has(key)) return;
      const normalizedSelection = normalizeEditorSelection(selection);
      if (normalizedSelection) normalized[key] = normalizedSelection;
    });
    return normalized;
  }

  function normalizeViewState(viewState, drafts) {
    if (!viewState || typeof viewState !== "object" || Array.isArray(viewState)) return null;

    const validDraftIds = new Set(drafts.map(draft => draft.id));
    const displayedDraftIndexes = normalizeIndexArray(viewState.displayedDraftIndexes, drafts.length);
    const displayedDraftIds = normalizeIdArray(viewState.displayedDraftIds, validDraftIds);
    displayedDraftIndexes.forEach(index => {
      const draftId = drafts[index]?.id;
      if (draftId && !displayedDraftIds.includes(draftId)) displayedDraftIds.push(draftId);
    });

    const collapsedNotesIndexes = normalizeIndexArray(viewState.collapsedNotesIndexes, drafts.length);
    const collapsedNotesIds = normalizeIdArray(viewState.collapsedNotesIds, validDraftIds);
    collapsedNotesIndexes.forEach(index => {
      const draftId = drafts[index]?.id;
      if (draftId && !collapsedNotesIds.includes(draftId)) collapsedNotesIds.push(draftId);
    });

    const selectedRef = draftRefFromViewState(drafts, viewState.selectedDraftId, viewState.selectedDraftIndex);
    const activeRef = draftRefFromViewState(
      drafts,
      viewState.activeDraftId || viewState.selectedDraftId,
      viewState.activeDraftIndex ?? viewState.selectedDraftIndex
    );
    const activeArea = viewState.activeArea === "draft" && activeRef.draft ? "draft" : "story";
    const activePageType = activeArea === "story" ? "story" : viewState.activePageType === "notes" ? "notes" : "content";
    const activeEditorKey = activeArea === "story"
      ? STORY_KEY
      : `draft:${activeRef.draft.id}:${activePageType === "notes" ? "notes" : "content"}`;
    const pagesOnScreen = Math.min(4, Math.max(1, Number(viewState.pagesOnScreen) || 2));

    return {
      version: VIEW_STATE_VERSION,
      updatedAt: viewState.updatedAt || nowIso(),
      hasStoredDisplaySelection: Boolean(viewState.hasStoredDisplaySelection),
      displayedStory: Boolean(viewState.displayedStory),
      displayedDraftIndexes,
      displayedDraftIds,
      collapsedNotesIndexes,
      collapsedNotesIds,
      notesPanePercents: normalizeNotesPanePercents(viewState.notesPanePercents, drafts.length),
      pagePanePercents: normalizePagePanePercents(viewState.pagePanePercents, drafts),
      pagesOnScreen,
      selectedDraftId: selectedRef.draft?.id || null,
      selectedDraftIndex: selectedRef.index,
      activeDraftId: activeRef.draft?.id || null,
      activeDraftIndex: activeRef.index,
      activePageType,
      activeEditorKey,
      editorSelections: normalizeEditorSelections(viewState.editorSelections, drafts),
      activeArea,
      showChanges: Boolean(viewState.showChanges),
      compareMode: viewState.compareMode === "consecutive" ? "consecutive" : "first"
    };
  }

  function createDraft(index, content = "") {
    const createdAt = nowIso();
    return {
      id: id("draft"),
      title: `Draft ${index}`,
      createdAt,
      updatedAt: createdAt,
      content,
      contentHtml: textToHtml(content),
      format: { ...DEFAULT_FORMAT },
      notes: {
        id: id("notes"),
        title: `Draft ${index} Notes`,
        createdAt,
        updatedAt: createdAt,
        content: "",
        contentHtml: "",
        format: { ...DEFAULT_FORMAT }
      }
    };
  }

  function defaultState() {
    const createdAt = nowIso();
    return {
      version: 1,
      formatDefaultVersion: FORMAT_DEFAULT_VERSION,
      defaultFormat: { ...DEFAULT_FORMAT },
      createdAt,
      updatedAt: createdAt,
      initialNotes: {
        id: "initial-notes",
        title: PROJECT_NOTES_TITLE,
        createdAt,
        updatedAt: createdAt,
        content: "",
        contentHtml: "",
        format: { ...DEFAULT_FORMAT }
      },
      drafts: [createDraft(1)]
    };
  }

  function normalizeState(input, options = {}) {
    const fallback = defaultState();
    const raw = input && typeof input === "object" ? input : fallback;
    const createdAt = raw.createdAt || fallback.createdAt;
    const drafts = Array.isArray(raw.drafts) && raw.drafts.length ? raw.drafts : fallback.drafts;
    const upgradeLegacyDefaultFont = raw.formatDefaultVersion !== FORMAT_DEFAULT_VERSION;
    const defaultFormat = upgradeLegacyDefaultFormat(currentDefaultFormat(raw), upgradeLegacyDefaultFont);
    const normalizedDrafts = drafts.map((draft, index) => {
      const draftNumber = index + 1;
      const draftCreatedAt = draft?.createdAt || nowIso();
      const normalizedDraft = normalizePage(draft, {
        id: draft?.id || id("draft"),
        title: draft?.title || `Draft ${draftNumber}`,
        createdAt: draftCreatedAt,
        updatedAt: draft?.updatedAt || draftCreatedAt,
        content: ""
      }, { upgradeLegacyDefaultFont, defaultFormat });
      const normalized = {
        ...normalizedDraft,
        notes: normalizePage(draft?.notes, {
          id: draft?.notes?.id || id("notes"),
          title: draft?.notes?.title || `Draft ${draftNumber} Notes`,
          createdAt: draft?.notes?.createdAt || draftCreatedAt,
          updatedAt: draft?.notes?.updatedAt || draft?.notes?.createdAt || draftCreatedAt,
          content: ""
        }, { upgradeLegacyDefaultFont, defaultFormat })
      };
      normalized.versionHistory = normalizeDraftVersionHistory(draft?.versionHistory, normalized);
      return normalized;
    });

    const initialNotes = normalizePage(raw.initialNotes, {
      id: raw.initialNotes?.id || "initial-notes",
      title: raw.initialNotes?.title || PROJECT_NOTES_TITLE,
      createdAt: raw.initialNotes?.createdAt || createdAt,
      updatedAt: raw.initialNotes?.updatedAt || raw.initialNotes?.createdAt || createdAt,
      content: ""
    }, { upgradeLegacyDefaultFont, defaultFormat });
    initialNotes.versionHistory = normalizePageVersionHistory(raw.initialNotes?.versionHistory, initialNotes, PROJECT_NOTES_TITLE);

    const normalized = {
      version: 1,
      formatDefaultVersion: FORMAT_DEFAULT_VERSION,
      defaultFormat,
      createdAt,
      updatedAt: options.touch ? nowIso() : raw.updatedAt || createdAt,
      initialNotes,
      drafts: normalizedDrafts
    };
    const viewState = normalizeViewState(raw.viewState, normalizedDrafts);
    if (viewState) normalized.viewState = viewState;
    return normalized;
  }

  function formatDate(iso) {
    const date = new Date(iso);
    if (Number.isNaN(date.valueOf())) return iso;
    return new Intl.DateTimeFormat("en-GB", {
      dateStyle: "full",
      timeStyle: "short"
    }).format(date);
  }

  function wordCountForText(text) {
    const matches = asText(text).match(/[\p{L}\p{N}]+(?:[\u0027\u2019/-][\p{L}\p{N}]+)*|\*+/gu);
    return matches ? matches.length : 0;
  }

  function pageBlock(title, createdAt, content, metadata = {}) {
    const body = asText(content).trimEnd();
    const lines = [
      title,
      `Created: ${formatDate(createdAt)}`
    ];
    if (metadata.updatedAt) lines.push(`Last edited: ${formatDate(metadata.updatedAt)}`);
    if (Number.isFinite(metadata.wordCount)) {
      lines.push(`Word count: ${Number(metadata.wordCount).toLocaleString("en-GB")}`);
    }
    lines.push("", body || "[No text yet]");
    return lines.join("\n");
  }

  function draftBlockMetadata(draft) {
    return {
      updatedAt: draft.updatedAt || draft.createdAt,
      wordCount: wordCountForText(draft.content)
    };
  }

  function projectNotesBlockMetadata(state) {
    return {
      updatedAt: state.initialNotes.updatedAt || state.initialNotes.createdAt
    };
  }

  function formatExport(state) {
    const pages = [
      pageBlock(
        PROJECT_NOTES_TITLE,
        state.initialNotes.createdAt,
        state.initialNotes.content,
        projectNotesBlockMetadata(state)
      )
    ];

    state.drafts.forEach((draft, index) => {
      const title = draft.title || `Draft ${index + 1}`;
      pages.push(pageBlock(title, draft.createdAt, draft.content, draftBlockMetadata(draft)));
      pages.push(pageBlock(`${title} Notes`, draft.notes.createdAt, draft.notes.content));
    });

    return `${pages.join("\n\n---\n\n")}\n`;
  }

  function stateWithoutVersionHistory(state) {
    if (!state) return state;
    const initialNotes = { ...(state.initialNotes || {}) };
    delete initialNotes.versionHistory;
    return {
      ...state,
      initialNotes,
      drafts: (state.drafts || []).map(draft => {
        const { versionHistory, ...rest } = draft;
        return rest;
      })
    };
  }

  function stateForStorage(state, options = {}) {
    return options.embedVersionHistory ? state : stateWithoutVersionHistory(state);
  }

  function serializeProjectState(state, options = {}) {
    if (!state) return "";
    return JSON.stringify(options.includeVersionHistory === false ? stateWithoutVersionHistory(state) : state);
  }

  function migrateLegacyDefaultFonts(state) {
    if (!state) return state;

    const shouldUpgrade = state.formatDefaultVersion !== FORMAT_DEFAULT_VERSION;
    state.defaultFormat = upgradeLegacyDefaultFormat(state.defaultFormat || DEFAULT_FORMAT, shouldUpgrade);
    if (!shouldUpgrade) return state;

    const upgradePage = page => {
      if (page) page.format = upgradeLegacyDefaultFormat(page.format, true);
    };

    upgradePage(state.initialNotes);
    state.drafts?.forEach(draft => {
      upgradePage(draft);
      upgradePage(draft.notes);
    });
    state.formatDefaultVersion = FORMAT_DEFAULT_VERSION;
    return state;
  }

  function projectStateFromSnapshot(snapshot) {
    return migrateLegacyDefaultFonts(JSON.parse(snapshot));
  }

  return {
    DEFAULT_FORMAT,
    FONT_FAMILY_OPTIONS,
    FONT_SIZE_OPTIONS,
    FORMAT_DEFAULT_VERSION,
    LEGACY_DEFAULT_FONT_FAMILY,
    LINE_HEIGHT_OPTIONS,
    MIN_PAGE_PANE_PERCENT,
    PROJECT_NOTES_TITLE,
    STORY_KEY,
    VIEW_STATE_VERSION,
    addCurrentPageToHistoryIfMissing,
    appendPageVersionIfChanged,
    applyVersionHistoryEntryToPage,
    asText,
    currentDefaultFormat,
    currentPageHistorySnapshot,
    defaultState,
    ensureDraftVersionHistory,
    ensurePageVersionHistory,
    ensureProjectNotesVersionHistory,
    escapeHtml,
    formatExport,
    hasParagraphHtml,
    htmlToText,
    latestVersionHistoryEntry,
    lineBreakCount,
    migrateLegacyDefaultFonts,
    normalizeFormat,
    normalizePage,
    normalizePageVersionHistory,
    normalizeState,
    pageVersionSignature,
    pageVersionSnapshot,
    promotePageToNewestHistoryVersion,
    projectStateFromSnapshot,
    serializeProjectState,
    sortVersionHistoryByCreatedAt,
    stateForStorage,
    stateWithoutVersionHistory,
    textToHtml,
    upgradeLegacyDefaultFormat,
    versionHistoryTime,
    versionHasMeaningfulContent,
    wordCountForText
  };
});
