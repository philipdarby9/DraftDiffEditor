(function initDraftDiffToolbarCore(root, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
    return;
  }
  root.DraftDiffToolbarCore = factory();
})(typeof globalThis !== "undefined" ? globalThis : this, function createDraftDiffToolbarCore() {
  const toolbarIcons = Object.freeze({
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
    clear: '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M4.2 12.3h7.4"></path><path d="m5.3 8.8 3.9-4.2 2.2 2.1-3.9 4.2H5.3z"></path><path d="M4 13.1 12.5 3"></path></svg>',
    format: '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M3 4.5h10M3 8h10M3 11.5h10"></path><path d="M5.5 3v3M10.5 6.5v3M7.5 10v3"></path></svg>',
    search: '<svg viewBox="0 0 16 16" aria-hidden="true"><circle cx="7" cy="7" r="4.2"></circle><path d="m10.2 10.2 3.1 3.1"></path></svg>',
    history: '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M8 3.2a4.8 4.8 0 1 1-4.3 2.7"></path><path d="M3.2 3.6v2.7h2.7"></path><path d="M8 5.2v3.1l2.1 1.2"></path></svg>',
    detach: '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M5.4 3.6H4.1c-.8 0-1.4.6-1.4 1.4v6.9c0 .8.6 1.4 1.4 1.4H11c.8 0 1.4-.6 1.4-1.4v-1.3"></path><path d="M8.2 3.4h4.4v4.4"></path><path d="M7.2 8.8 12.4 3.6"></path></svg>'
  });

  return Object.freeze({
    toolbarIcons
  });
});
