#!/usr/bin/env node
"use strict";

const fs = require("node:fs");
const path = require("node:path");
const { diffText: diffReportTexts } = require("../public/diff-core");
const { wordCountForText } = require("../public/state-core");

function usage() {
  console.error("Usage: node scripts/build-per-draft-cut-history.js <version-history.json> <live-draft-diff.txt> <output.html>");
  process.exit(2);
}

const [jsonPathArg, liveTextPathArg, outputPathArg] = process.argv.slice(2);
if (!jsonPathArg || !liveTextPathArg || !outputPathArg) usage();

function readText(filePath) {
  return fs.readFileSync(filePath, "utf8").replace(/^\uFEFF/u, "").replace(/\r\n/g, "\n").replace(/\r/g, "\n");
}

function readJson(filePath) {
  return JSON.parse(readText(filePath));
}

function htmlEscape(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function normaliseText(value) {
  return String(value ?? "").replace(/\r\n/g, "\n").replace(/\r/g, "\n").trimEnd();
}

function historyArray(entry) {
  return Array.isArray(entry?.history)
    ? entry.history
    : Array.isArray(entry?.versionHistory)
      ? entry.versionHistory
      : [];
}

function parseLiveDrafts(text) {
  const sections = normaliseText(text).split(/\n---\n/u);
  const drafts = new Map();

  sections.forEach(section => {
    const lines = section.replace(/^\n+|\n+$/gu, "").split("\n");
    const title = lines[0] || "";
    if (!/^Draft \d+$/u.test(title)) return;

    const contentStart = lines.findIndex((line, index) => index > 0 && line === "");
    const content = contentStart >= 0 ? lines.slice(contentStart + 1).join("\n").trimEnd() : "";
    drafts.set(title, content === "[No text yet]" ? "" : content);
  });

  return drafts;
}

function versionLabel(index, total) {
  return index === total - 1 ? `Version ${index + 1} / latest` : `Version ${index + 1}`;
}

function formatDate(iso) {
  if (!iso) return "unknown time";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "Europe/London"
  }).format(date).replace(",", "");
}

function formatGeneratedDate(date) {
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "Europe/London"
  }).format(date).replace(",", "");
}

function wordCount(text) {
  return wordCountForText(String(text ?? ""));
}

function meaningfulRemovedPart(part) {
  return part?.type === "removed" && String(part.text || "").trim();
}

function rangeFromRemovedParts(parts) {
  const ranges = parts
    .map(part => ({
      start: part.beforeStart ?? part.start,
      end: part.beforeEnd ?? part.end
    }))
    .filter(range => Number.isFinite(range.start) && Number.isFinite(range.end));

  if (!ranges.length) return null;
  return {
    start: Math.min(...ranges.map(range => range.start)),
    end: Math.max(...ranges.map(range => range.end))
  };
}

function moveToWordBoundary(text, index, direction) {
  let current = Math.max(0, Math.min(text.length, index));
  if (direction < 0) {
    while (current > 0 && !/\s/u.test(text[current - 1])) current -= 1;
    return current;
  }
  while (current < text.length && !/\s/u.test(text[current])) current += 1;
  return current;
}

function boundedContextStart(text, cutStart, maxChars = 190) {
  const minStart = Math.max(0, cutStart - maxChars);
  const prefix = text.slice(minStart, cutStart);
  const boundaryMatch = [...prefix.matchAll(/(?:\n\s*\n|[.!?:;]\s+)/gu)].at(-1);

  if (boundaryMatch) {
    const candidate = minStart + boundaryMatch.index + boundaryMatch[0].length;
    if (candidate >= minStart && candidate < cutStart) return candidate;
  }

  return moveToWordBoundary(text, minStart, 1);
}

function boundedContextEnd(text, cutEnd, maxChars = 230) {
  const maxEnd = Math.min(text.length, cutEnd + maxChars);
  const suffix = text.slice(cutEnd, maxEnd);
  const boundaryMatch = suffix.match(/(?:\n\s*\n|[.!?:;]\s+)/u);

  if (boundaryMatch) {
    const candidate = cutEnd + boundaryMatch.index + boundaryMatch[0].length;
    if (candidate > cutEnd && candidate <= maxEnd) return candidate;
  }

  return moveToWordBoundary(text, maxEnd, -1);
}

function contextHtml(sourceText, range) {
  if (!range) return "";

  const text = normaliseText(sourceText);
  const start = Math.max(0, Math.min(text.length, range.start));
  const end = Math.max(start, Math.min(text.length, range.end));
  const contextStart = boundedContextStart(text, start);
  const contextEnd = boundedContextEnd(text, end);
  const prefix = text.slice(contextStart, start);
  const cut = text.slice(start, end);
  const suffix = text.slice(end, contextEnd);

  return [
    contextStart > 0 ? "..." : "",
    htmlEscape(prefix),
    `<mark>${htmlEscape(cut)}</mark>`,
    htmlEscape(suffix),
    contextEnd < text.length ? "..." : ""
  ].join("");
}

function segmentFromRemovedParts(sourceText, parts) {
  const range = rangeFromRemovedParts(parts);
  const raw = range
    ? normaliseText(sourceText).slice(range.start, range.end)
    : parts.map(part => part.text || "").join("");
  const text = raw.replace(/\s+/gu, " ").trim();
  if (!text) return null;

  const words = wordCount(text);
  if (!words) return null;

  const type = raw.includes("\n") || /[.!?:;]/u.test(raw) || words >= 18 ? "line/passage" : "within-line cut";
  return { type, text, words, context: contextHtml(sourceText, range) };
}

function cutSegments(beforeText, afterText) {
  const parts = diffReportTexts(normaliseText(beforeText), normaliseText(afterText));
  const segments = [];
  let current = [];

  const flush = () => {
    const segment = segmentFromRemovedParts(beforeText, current);
    current = [];
    if (segment) segments.push(segment);
  };

  parts.forEach(part => {
    if (part.type === "removed") {
      current.push(part);
      return;
    }
    if (current.length) flush();
  });

  if (current.length) flush();
  return segments;
}

function versionsForDraft(draft, currentText) {
  const history = historyArray(draft);
  const versions = history.map((entry, index) => ({
    label: versionLabel(index, history.length),
    createdAt: entry.createdAt || draft.updatedAt || draft.createdAt || null,
    content: normaliseText(entry.content || ""),
    source: "saved history"
  }));

  const normalisedCurrent = normaliseText(currentText);
  const latestSaved = versions.length ? versions[versions.length - 1].content : "";
  if (!versions.length || normalisedCurrent !== latestSaved) {
    versions.push({
      label: "Current live text",
      createdAt: null,
      content: normalisedCurrent,
      source: "live current text"
    });
  }

  return versions;
}

function draftAnchorId(title, index) {
  const slug = String(title || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/gu, "-")
    .replace(/^-+|-+$/gu, "");
  return slug || `draft-${index + 1}`;
}

function analyseDraft(draft, index, liveDrafts) {
  const title = draft?.title || `Draft ${index + 1}`;
  const history = historyArray(draft);
  const currentText = liveDrafts.get(title) ?? normaliseText(history.at(-1)?.content || "");
  const versions = versionsForDraft(draft, currentText);
  const transitions = [];

  for (let versionIndex = 0; versionIndex < versions.length - 1; versionIndex += 1) {
    const before = versions[versionIndex];
    const after = versions[versionIndex + 1];
    const cuts = cutSegments(before.content, after.content);
    if (!cuts.length) continue;
    transitions.push({ before, after, cuts });
  }

  const cutEntries = transitions.reduce((sum, transition) => sum + transition.cuts.length, 0);
  const cutWords = transitions.reduce(
    (sum, transition) => sum + transition.cuts.reduce((innerSum, cut) => innerSum + cut.words, 0),
    0
  );

  return {
    title,
    anchorId: draftAnchorId(title, index),
    currentText,
    currentWords: wordCount(currentText),
    historyCount: history.length,
    versions,
    transitions,
    cutEntries,
    cutWords
  };
}

function transitionHeading(transition, beforeIndex, totalVersions) {
  const beforePosition = beforeIndex + 1;
  const afterPosition = beforeIndex + 2;
  const beforeText = `${versionLabel(beforeIndex, totalVersions)} (${formatDate(transition.before.createdAt)})`;
  const afterText = `${versionLabel(afterPosition - 1, totalVersions)} (${formatDate(transition.after.createdAt)})`;
  return `${beforeText} -> ${afterText}`;
}

function htmlReport({ payload, jsonPath, liveTextPath, drafts }) {
  const generatedAt = new Date();
  const totalVersions = drafts.reduce((sum, draft) => sum + draft.versions.length, 0);
  const totalCutEntries = drafts.reduce((sum, draft) => sum + draft.cutEntries, 0);
  const totalCutWords = drafts.reduce((sum, draft) => sum + draft.cutWords, 0);
  const name = (payload.sourceFileName || path.basename(jsonPath)).replace(/\.version-history\.json$/u, "");

  const rows = drafts.map(draft => {
    const savedHistory = draft.historyCount
      ? `${draft.historyCount.toLocaleString("en-GB")} saved`
      : "current only";
    return `<tr><td><a href="#${htmlEscape(draft.anchorId)}">${htmlEscape(draft.title)}</a></td><td>${draft.versions.length.toLocaleString("en-GB")}</td><td>${draft.currentWords.toLocaleString("en-GB")}</td><td>${draft.cutEntries.toLocaleString("en-GB")}</td><td>${draft.cutWords.toLocaleString("en-GB")}</td><td>${htmlEscape(savedHistory)}</td></tr>`;
  }).join("\n");

  const contents = drafts
    .map(draft => `<a href="#${htmlEscape(draft.anchorId)}">${htmlEscape(draft.title)}</a>`)
    .join("");

  const sections = drafts.map(draft => {
    const transitions = draft.transitions.length
      ? draft.transitions.map(transition => {
        const beforeIndex = draft.versions.indexOf(transition.before);
        const cuts = transition.cuts.map((cut, index) => {
          const context = cut.context
            ? `<p class="context-label">Context in previous version</p><blockquote class="removed-context">${cut.context}</blockquote>`
            : `<blockquote>${htmlEscape(cut.text)}</blockquote>`;
          return `<div class="cut"><p class="meta">${index + 1}. ${htmlEscape(cut.type)}; ${cut.words.toLocaleString("en-GB")} ${cut.words === 1 ? "word" : "words"}</p>${context}</div>`;
        }).join("\n");
        return `<article class="transition"><h3>${htmlEscape(transitionHeading(transition, beforeIndex, draft.versions.length))}</h3>${cuts}</article>`;
      }).join("\n")
      : "<p>No cuts detected for this draft.</p>";

    return `<section id="${htmlEscape(draft.anchorId)}"><h2>${htmlEscape(draft.title)}</h2><p class="meta">${draft.versions.length.toLocaleString("en-GB")} saved/current versions checked. ${draft.cutEntries.toLocaleString("en-GB")} cut entries, ${draft.cutWords.toLocaleString("en-GB")} cut words.</p><details><summary>Current ${htmlEscape(draft.title)} text</summary><div class="text">${htmlEscape(draft.currentText)}</div></details>${transitions}</section>`;
  }).join("\n");

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>${htmlEscape(name)} per-draft cut history</title>
<style>
body{margin:0;background:#fbfbfa;color:#202020;font:16px/1.55 Georgia,'Times New Roman',serif}
main{max-width:1040px;margin:0 auto;padding:32px 28px 64px}
h1,h2,h3,summary,.meta,table{font-family:system-ui,-apple-system,Segoe UI,sans-serif}
h1{font-size:28px;margin:0 0 8px}
h2{border-top:1px solid #d8d8d8;margin-top:34px;padding-top:22px}
h3{font-size:16px;margin:18px 0 8px}
.meta{color:#666;font-size:13px}
.summary{display:grid;grid-template-columns:repeat(auto-fit,minmax(170px,1fr));gap:12px;margin:22px 0}
.stat{background:#fff;border:1px solid #d8d8d8;padding:12px}
.stat strong{display:block;font:700 20px/1.2 system-ui,-apple-system,Segoe UI,sans-serif}
.contents{display:flex;flex-wrap:wrap;gap:8px;margin:18px 0}
.contents a{border:1px solid #d8d8d8;background:#fff;color:#17456f;font:600 13px/1.2 system-ui,-apple-system,Segoe UI,sans-serif;padding:7px 10px;text-decoration:none}
.contents a:hover,.contents a:focus{background:#eef5fa;text-decoration:underline}
table{border-collapse:collapse;width:100%;font-size:14px;margin:18px 0}
th,td{border-bottom:1px solid #d8d8d8;padding:8px;text-align:left;vertical-align:top}
td a{color:#17456f;font-weight:600}
section{scroll-margin-top:18px}
details{background:#fff;border:1px solid #d8d8d8;margin:12px 0;padding:10px 14px}
summary{cursor:pointer;font-weight:700}
.text,blockquote{white-space:pre-wrap}
blockquote{background:#fff;border-left:4px solid #777;margin:6px 0 14px;padding:10px 14px}
.context-label{font:600 12px/1.2 system-ui,-apple-system,Segoe UI,sans-serif;color:#666;margin:0 0 4px}
.removed-context mark{background:#ffe1d6;color:#7f220f;padding:0 2px}
.transition{break-inside:avoid}
.cut{margin-left:8px}
@media print{body{background:#fff}details{border:0;padding:0}details:not([open])>:not(summary){display:block}summary{list-style:none}}
</style>
</head>
<body>
<main>
<h1>${htmlEscape(name)}: per-draft cut history</h1>
<p class="meta">Generated ${htmlEscape(formatGeneratedDate(generatedAt))}. Source JSON: ${htmlEscape(jsonPath)}. Live current text: ${htmlEscape(liveTextPath)}.</p>
<p>This report is grouped by the ${drafts.length.toLocaleString("en-GB")} drafts in the live current text file. Each section compares one saved/current version of that draft to the next version and records passages, plus smaller within-line cuts, that disappear at that point. It is based on saved version-history snapshots, so unsaved keystrokes between snapshots cannot be recovered.</p>
<div class="summary"><div class="stat"><strong>${drafts.length.toLocaleString("en-GB")}</strong> current drafts</div><div class="stat"><strong>${totalVersions.toLocaleString("en-GB")}</strong> versions checked</div><div class="stat"><strong>${totalCutEntries.toLocaleString("en-GB")}</strong> cut entries</div><div class="stat"><strong>${totalCutWords.toLocaleString("en-GB")}</strong> cut words</div></div>
<nav class="contents" aria-label="Draft contents">${contents}</nav>
<table><thead><tr><th>Draft</th><th>Versions checked</th><th>Current words</th><th>Cut entries</th><th>Cut words</th><th>Saved history</th></tr></thead><tbody>${rows}</tbody></table>
${sections}
</main>
</body>
</html>
`;
}

const jsonPath = path.resolve(jsonPathArg);
const liveTextPath = path.resolve(liveTextPathArg);
const outputPath = path.resolve(outputPathArg);
const payload = readJson(jsonPath);
const liveDrafts = parseLiveDrafts(readText(liveTextPath));
const drafts = (payload.drafts || [])
  .slice()
  .sort((left, right) => {
    const leftIndex = Number.isInteger(left?.index) ? left.index : 0;
    const rightIndex = Number.isInteger(right?.index) ? right.index : 0;
    return leftIndex - rightIndex;
  })
  .map((draft, index) => analyseDraft(draft, index, liveDrafts));

fs.mkdirSync(path.dirname(outputPath), { recursive: true });
fs.writeFileSync(outputPath, htmlReport({ payload, jsonPath, liveTextPath, drafts }), "utf8");

const totalVersions = drafts.reduce((sum, draft) => sum + draft.versions.length, 0);
const totalCutEntries = drafts.reduce((sum, draft) => sum + draft.cutEntries, 0);
const totalCutWords = drafts.reduce((sum, draft) => sum + draft.cutWords, 0);

console.log(`Wrote ${outputPath}`);
console.log(`Drafts: ${drafts.length}; versions checked: ${totalVersions}; cut entries: ${totalCutEntries}; cut words: ${totalCutWords}`);
drafts.forEach(draft => {
  console.log(`${draft.title}: ${draft.versions.length} versions, ${draft.cutEntries} cut entries, ${draft.cutWords} cut words`);
});
