#!/usr/bin/env node
"use strict";

const assert = require("node:assert");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const RichTextCore = require(path.join(root, "public", "rich-text-core.js"));

assert.equal(typeof RichTextCore.sanitizeRichHtml, "function", "rich-text core should export sanitizeRichHtml");
assert.equal(typeof RichTextCore.sanitizeRichHtmlFallback, "function", "rich-text core should export sanitizeRichHtmlFallback");
assert.equal(typeof RichTextCore.sanitizeStyleMarks, "function", "rich-text core should export sanitizeStyleMarks");
assert.equal(typeof RichTextCore.clipboardHtmlForInsertion, "function", "rich-text core should export clipboard insertion normalizer");
assert.equal(typeof RichTextCore.execRichTextCommand, "function", "rich-text core should export command helper");
assert.equal(typeof RichTextCore.insertClipboardHtml, "function", "rich-text core should export clipboard insertion helper");
assert.equal(typeof RichTextCore.insertPlainText, "function", "rich-text core should export plain-text insertion helper");
assert.equal(typeof RichTextCore.insertRichTextHtml, "function", "rich-text core should export rich HTML insertion helper");

function commandRecorder() {
  const calls = [];
  return {
    calls,
    document: {
      execCommand(command, showUi, value) {
        calls.push({ command, showUi, value });
        return true;
      }
    }
  };
}

assert.deepEqual(
  RichTextCore.sanitizeStyleMarks("font-weight: 700; font-style: italic; text-decoration: underline line-through;"),
  { bold: true, italic: true, underline: true, strike: true },
  "style mark detection should preserve supported rich-text marks"
);

assert.equal(
  RichTextCore.sanitizeRichHtmlFallback('<p onclick="x">Hello <strong>bold &amp; safe</strong><img src=x onerror=alert(1)></p><script>alert(1)</script>'),
  "<p>Hello <strong>bold &amp; safe</strong></p>alert(1)",
  "sanitizer should remove unsafe elements/attributes while preserving safe content"
);

assert.equal(
  RichTextCore.sanitizeRichHtmlFallback('<span style="font-weight: 700; font-style: italic; text-decoration: underline line-through">Marked</span>'),
  "<strong><em><u><s>Marked</s></u></em></strong>",
  "sanitizer should convert supported span styles to semantic tags"
);

assert.equal(
  RichTextCore.sanitizeRichHtmlFallback('<a href="javascript:alert(1)">Link</a><br><del>Gone</del>'),
  "Link<br><s>Gone</s>",
  "sanitizer should unwrap unsupported links and normalize deletions"
);

assert.equal(
  RichTextCore.sanitizeRichHtml('2 < 3 &amp; "ok"'),
  "2 &lt; 3 &amp; &quot;ok&quot;",
  "Node fallback should escape plain text and decode common entities once"
);

assert.equal(
  RichTextCore.clipboardHtmlForInsertion("<div>word</div>", "word"),
  "word",
  "single-line block clipboard fragments should paste inline"
);

assert.equal(
  RichTextCore.clipboardHtmlForInsertion("<p><strong>word</strong></p>", "word"),
  "<strong>word</strong>",
  "single-line block clipboard fragments should preserve inline marks"
);

assert.equal(
  RichTextCore.clipboardHtmlForInsertion("<p>one</p><p>two</p>", "one\ntwo"),
  "<p>one</p><p>two</p>",
  "multi-line block clipboard fragments should keep paragraph structure"
);

{
  let focused = false;
  const recorder = commandRecorder();
  assert.equal(
    RichTextCore.execRichTextCommand("bold", {
      document: recorder.document,
      editor: { focus: () => { focused = true; } }
    }),
    true,
    "command helper should return the execCommand result"
  );
  assert.equal(focused, true, "command helper should focus the supplied editor");
  assert.deepEqual(
    recorder.calls,
    [{ command: "bold", showUi: false, value: null }],
    "command helper should issue the requested rich-text command"
  );
}

{
  const recorder = commandRecorder();
  RichTextCore.insertPlainText("one\ttwo", { document: recorder.document });
  assert.deepEqual(
    recorder.calls,
    [{ command: "insertText", showUi: false, value: "one\ttwo" }],
    "plain-text helper should issue insertText with the supplied text"
  );
}

{
  const recorder = commandRecorder();
  RichTextCore.insertClipboardHtml(
    {
      getData(type) {
        return type === "text/html" ? '<p onclick="x">Hello <strong>bold</strong><img src=x></p>' : "plain";
      }
    },
    { document: recorder.document, textToHtml: value => `fallback:${value}` }
  );
  assert.deepEqual(
    recorder.calls,
    [{ command: "insertHTML", showUi: false, value: "Hello <strong>bold</strong>" }],
    "clipboard helper should sanitize and inline simple rich clipboard HTML before insertion"
  );
}

{
  const recorder = commandRecorder();
  RichTextCore.insertClipboardHtml(
    {
      getData(type) {
        return type === "text/html" ? "" : "one\ntwo";
      }
    },
    { document: recorder.document, textToHtml: value => `fallback:${value.replace(/\n/g, "<br>")}` }
  );
  assert.deepEqual(
    recorder.calls,
    [{ command: "insertHTML", showUi: false, value: "fallback:one<br>two" }],
    "clipboard helper should convert plain clipboard text when rich HTML is absent"
  );
}

console.log("rich-text-core tests passed");
