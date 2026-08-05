# Daymark homepage QA evidence

All paths below are relative to the project root and are intended to remain portable with the commit.

## Visual sources

- `qa-evidence/daymark-homepage/hero-user-annotation.png` - exact extracted user annotation, 1280 x 890 px
- `qa-evidence/daymark-homepage/widget-options-user-annotation.png` - exact extracted user annotation used as the rendered widget source, 1280 x 890 px
- `qa-evidence/daymark-homepage/widget-options-recovered.html` - recovered widget reference HTML

## Normalized live implementation

- `qa-evidence/daymark-homepage/hero-implementation-desktop-1775x1234-normalized.png` - desktop hero at the normalized 1280 x 890 comparison size
- `qa-evidence/daymark-homepage/widget-options-implementation-top-desktop-1775x1234-normalized.png` - desktop widget section top at the normalized 1280 x 890 comparison size
- `qa-evidence/daymark-homepage/widget-options-implementation-bottom-desktop-1775x1234-normalized.png` - desktop widget section bottom at the normalized 1280 x 890 comparison size

## Live browser records

- `qa-evidence/daymark-homepage/initial-load-network.json` - every reload request with URL, method, and type, plus endpoint classification
- `qa-evidence/daymark-homepage/widget-option-network.json` - inline/floating states and request events after each activation
- `qa-evidence/daymark-homepage/browser-console-warn-error.json` - warn/error console record
- `qa-evidence/daymark-homepage/keyboard-traversal.json` - genuine Tab attempt and unchanged active element
- `qa-evidence/daymark-homepage/keyboard-traversal-blocked.png` - accepted viewport captured after the failed traversal attempt

The requested `keyboard-focus-floating.png` and `keyboard-focus-inline.png` are intentionally absent. The in-app browser did not advance focus from the preceding link, and direct DOM focus would not be valid evidence.
