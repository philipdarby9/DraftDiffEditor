(function initDraftDiffRichTextCore(root, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
    return;
  }
  root.DraftDiffRichTextCore = factory();
})(typeof globalThis !== "undefined" ? globalThis : this, function createDraftDiffRichTextCore() {
  "use strict";

  const TEXT_NODE = 3;
  const ELEMENT_NODE = 1;
  const BLOCK_TAGS = new Set(["div", "p", "blockquote", "ul", "ol", "li"]);
  const SIMPLE_INLINE_CLIPBOARD_BLOCK_TAGS = new Set(["div", "p", "blockquote", "li"]);
  const INLINE_BREAK_TAG_PATTERN = /<(?:br|div|p|blockquote|ul|ol|li)\b/i;

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

  function defaultTextToHtml(value) {
    return escapeHtml(value).replace(/\n/g, "<br>");
  }

  function decodeHtmlText(value) {
    return asText(value)
      .replace(/&#x([0-9a-f]+);/gi, (_match, hex) => {
        const codePoint = Number.parseInt(hex, 16);
        return Number.isFinite(codePoint) ? String.fromCodePoint(codePoint) : "";
      })
      .replace(/&#(\d+);/g, (_match, decimal) => {
        const codePoint = Number.parseInt(decimal, 10);
        return Number.isFinite(codePoint) ? String.fromCodePoint(codePoint) : "";
      })
      .replace(/&nbsp;/g, " ")
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&quot;/g, '"')
      .replace(/&#039;/g, "'");
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

  function markTags(marks) {
    const tags = [];
    if (marks.bold) tags.push("strong");
    if (marks.italic) tags.push("em");
    if (marks.underline) tags.push("u");
    if (marks.strike) tags.push("s");
    return tags;
  }

  function wrapSemanticHtml(html, marks) {
    return markTags(marks).reduceRight((output, tag) => `<${tag}>${output}</${tag}>`, html);
  }

  function sanitizeRichHtmlWithTemplate(html, template) {
    template.innerHTML = String(html || "");

    const sanitizeNode = node => {
      if (node.nodeType === TEXT_NODE) return escapeHtml(node.nodeValue);
      if (node.nodeType !== ELEMENT_NODE) return "";

      const tag = node.tagName.toLowerCase();
      if (tag === "br") return "<br>";

      const inner = Array.from(node.childNodes).map(sanitizeNode).join("");
      if (tag === "b" || tag === "strong") return `<strong>${inner}</strong>`;
      if (tag === "i" || tag === "em") return `<em>${inner}</em>`;
      if (tag === "u") return `<u>${inner}</u>`;
      if (tag === "s" || tag === "strike" || tag === "del") return `<s>${inner}</s>`;
      if (tag === "span") return wrapSemanticHtml(inner, sanitizeStyleMarks(node.getAttribute("style") || ""));
      if (BLOCK_TAGS.has(tag)) return `<${tag}>${inner}</${tag}>`;
      return inner;
    };

    return Array.from(template.content.childNodes).map(sanitizeNode).join("");
  }

  function tagAttributeValue(attributes, name) {
    const pattern = new RegExp(`\\b${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s"'>]+))`, "i");
    const match = pattern.exec(attributes || "");
    return decodeHtmlText(match?.[1] ?? match?.[2] ?? match?.[3] ?? "");
  }

  function outputTagsForOpeningTag(tag, attributes) {
    if (tag === "b" || tag === "strong") return ["strong"];
    if (tag === "i" || tag === "em") return ["em"];
    if (tag === "u") return ["u"];
    if (tag === "s" || tag === "strike" || tag === "del") return ["s"];
    if (tag === "span") return markTags(sanitizeStyleMarks(tagAttributeValue(attributes, "style")));
    if (BLOCK_TAGS.has(tag)) return [tag];
    return [];
  }

  function closeStackEntry(entry) {
    return entry.outputTags.slice().reverse().map(tag => `</${tag}>`).join("");
  }

  function sanitizeRichHtmlFallback(html) {
    const source = String(html || "");
    const stack = [];
    let output = "";
    let lastIndex = 0;

    source.replace(/<[^>]*>/g, (tagText, offset) => {
      output += escapeHtml(decodeHtmlText(source.slice(lastIndex, offset)));
      lastIndex = offset + tagText.length;

      if (/^<!--/.test(tagText) || /^<\s*!/u.test(tagText)) return tagText;

      const tagMatch = /^<\s*(\/)?\s*([a-z0-9]+)([^>]*)>/i.exec(tagText);
      if (!tagMatch) {
        output += escapeHtml(tagText);
        return tagText;
      }

      const isClosingTag = Boolean(tagMatch[1]);
      const tag = tagMatch[2].toLowerCase();
      const attributes = tagMatch[3] || "";

      if (tag === "br" && !isClosingTag) {
        output += "<br>";
        return tagText;
      }

      if (isClosingTag) {
        const matchIndex = stack.map(entry => entry.sourceTag).lastIndexOf(tag);
        if (matchIndex >= 0) {
          while (stack.length > matchIndex) output += closeStackEntry(stack.pop());
        }
        return tagText;
      }

      const outputTags = outputTagsForOpeningTag(tag, attributes);
      if (!outputTags.length) return tagText;
      output += outputTags.map(outputTag => `<${outputTag}>`).join("");
      stack.push({ sourceTag: tag, outputTags });
      return tagText;
    });

    output += escapeHtml(decodeHtmlText(source.slice(lastIndex)));
    while (stack.length) output += closeStackEntry(stack.pop());
    return output;
  }

  function sanitizeRichHtml(html, options = {}) {
    const template = typeof options.createTemplate === "function"
      ? options.createTemplate()
      : (options.document || (typeof document !== "undefined" ? document : null))?.createElement?.("template");
    return template ? sanitizeRichHtmlWithTemplate(html, template) : sanitizeRichHtmlFallback(html);
  }

  function hasLineBreak(value) {
    return /[\r\n]/.test(asText(value));
  }

  function unwrapSingleSimpleClipboardBlockWithTemplate(html, template) {
    template.innerHTML = String(html || "");
    const nodes = Array.from(template.content.childNodes)
      .filter(node => node.nodeType !== TEXT_NODE || node.nodeValue.trim());
    if (nodes.length !== 1) return html;

    const [node] = nodes;
    if (node.nodeType !== ELEMENT_NODE) return html;
    const tag = node.tagName.toLowerCase();
    if (!SIMPLE_INLINE_CLIPBOARD_BLOCK_TAGS.has(tag)) return html;

    const inner = node.innerHTML;
    return INLINE_BREAK_TAG_PATTERN.test(inner) ? html : inner;
  }

  function unwrapSingleSimpleClipboardBlockFallback(html) {
    const trimmed = String(html || "").trim();
    const match = /^<(div|p|blockquote|li)>([\s\S]*)<\/\1>$/i.exec(trimmed);
    if (!match) return html;
    return INLINE_BREAK_TAG_PATTERN.test(match[2]) ? html : match[2];
  }

  function clipboardHtmlForInsertion(html, text = "", options = {}) {
    const sanitized = sanitizeRichHtml(html, options);
    if (hasLineBreak(text)) return sanitized;

    const template = typeof options.createTemplate === "function"
      ? options.createTemplate()
      : (options.document || (typeof document !== "undefined" ? document : null))?.createElement?.("template");
    return template
      ? unwrapSingleSimpleClipboardBlockWithTemplate(sanitized, template)
      : unwrapSingleSimpleClipboardBlockFallback(sanitized);
  }

  function documentFromOptions(options = {}) {
    return options.document || (typeof document !== "undefined" ? document : null);
  }

  function focusEditor(options = {}) {
    const editor = options.editor || options.editorEl;
    if (editor && typeof editor.focus === "function") editor.focus();
  }

  function execDocumentCommand(command, value = null, options = {}) {
    const commandName = asText(command);
    if (!commandName) return false;
    const doc = documentFromOptions(options);
    if (!doc || typeof doc.execCommand !== "function") return false;
    return doc.execCommand(commandName, false, value);
  }

  function execRichTextCommand(command, options = {}) {
    focusEditor(options);
    return execDocumentCommand(command, null, options);
  }

  function insertPlainText(text, options = {}) {
    focusEditor(options);
    return execDocumentCommand("insertText", asText(text), options);
  }

  function insertRichTextHtml(html, options = {}) {
    focusEditor(options);
    return execDocumentCommand("insertHTML", sanitizeRichHtml(html, options), options);
  }

  function clipboardText(clipboardData, type) {
    return typeof clipboardData?.getData === "function" ? clipboardData.getData(type) : "";
  }

  function insertClipboardHtml(clipboardData, options = {}) {
    const html = clipboardText(clipboardData, "text/html");
    const text = clipboardText(clipboardData, "text/plain");
    const textToHtml = typeof options.textToHtml === "function" ? options.textToHtml : defaultTextToHtml;
    return insertRichTextHtml(html ? clipboardHtmlForInsertion(html, text, options) : textToHtml(text), options);
  }

  return Object.freeze({
    clipboardHtmlForInsertion,
    execRichTextCommand,
    insertClipboardHtml,
    insertPlainText,
    insertRichTextHtml,
    sanitizeRichHtml,
    sanitizeRichHtmlFallback,
    sanitizeStyleMarks
  });
});
