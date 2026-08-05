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
- `qa-evidence/daymark-homepage/chrome-wordmark-qa.json` - final Chrome visual metrics, keyboard states, network boundary, console result, and option states
- `qa-evidence/daymark-homepage/wordmark-crop-user-report.png` - exact user report that showed the cropped wordmark
- `qa-evidence/daymark-homepage/wordmark-fit-desktop-chrome.png` - final 1280 x 890 desktop widget comparison
- `qa-evidence/daymark-homepage/wordmark-fit-desktop-1775x1234-chrome.png` - final viewport-matched desktop widget comparison
- `qa-evidence/daymark-homepage/wordmark-fit-mobile-chrome.png` - final 390 x 844 floating-card view
- `qa-evidence/daymark-homepage/wordmark-fit-mobile-inline-chrome.png` - final 390 x 844 inline-card view with complete wordmark
- `qa-evidence/daymark-homepage/keyboard-focus-floating-chrome.png` - genuine Chrome forward-Tab focus on the floating choice
- `qa-evidence/daymark-homepage/keyboard-focus-inline-chrome.png` - the next genuine Chrome forward-Tab focus on the inline choice

The older `keyboard-traversal.json` and `keyboard-traversal-blocked.png` remain as historical evidence of the in-app-browser limitation. The final Chrome run supersedes that tooling blocker without using direct DOM focus on either target.
