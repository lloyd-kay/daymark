# Daymark homepage design QA

## Scope and result

- reference: `qa-evidence/daymark-homepage/hero-user-annotation.png`, `qa-evidence/daymark-homepage/widget-options-user-annotation.png`, and `qa-evidence/daymark-homepage/widget-options-recovered.html`
- desktop implementation: `qa-evidence/daymark-homepage/hero-implementation-desktop-1775x1234-normalized.png`, `qa-evidence/daymark-homepage/widget-options-implementation-top-desktop-1775x1234-normalized.png`, and `qa-evidence/daymark-homepage/widget-options-implementation-bottom-desktop-1775x1234-normalized.png`
- comparison viewport: 1775 x 1234 CSS px at device scale factor 1; the normalized reference and implementation rasters are 1280 x 890 px
- comparison state: desktop homepage, floating widget selected, inline widget unselected
- P0-P2 visual findings: none; no production-code correction was justified
- blocker: the fresh Codex in-app browser binding did not advance focus for a genuine forward Tab event, so sequential keyboard traversal to the floating and inline controls and the two required focus screenshots could not be produced

## Same-state visual comparison

The exact tracked widget annotation was opened in the same comparison input as both normalized live implementation captures. The source and implementation show the same desktop section state: blue widget-options field, floating option first and selected, inline option second and unselected, setup copy below, and the footer after the section. The implementation intentionally expands the two compact annotation previews into the fully framed Cedar House floating and inline compositions recovered in `widget-options-recovered.html`. The heading, two-column hierarchy, palette, option order, selected-state prominence, and setup-link placement remain faithful. The richer recovered previews are the requested implementation content, not visual drift.

The hero annotation and normalized hero implementation were also inspected at the same 1280 x 890 raster size. The three paper lines are complete, all five Daymark colours remain visible, and the summary, actions, and privacy treatment retain the approved hierarchy.

Focused region comparison was needed because the miniature preview copy and selection treatment are not reliably judged from the whole homepage. The top and bottom widget captures show both preview browser frames, the floating overlay, inline rail, 44px controls, selected outline, setup copy, and footer without crop or overflow.

## Required fidelity surfaces

- fonts and typography: passed; display and body hierarchy remain legible and required copy is complete
- spacing and layout rhythm: passed; the desktop two-column layout, card padding, preview framing, section gaps, and action spacing are coherent
- colours and visual tokens: passed; the five Daymark paper colours, ink, paper, blue section, and coral/sage accents remain present and balanced
- image and asset fidelity: passed; the coded Cedar House compositions preserve the recovered source direction without missing visible assets
- copy and content: passed; approved hero, widget, option, setup, and navigation copy is present

## Browser evidence

- initial load network: `qa-evidence/daymark-homepage/initial-load-network.json` records all 128 requests from a cursor taken after `Network.enable` and before reloading `/`, including URL, method, and resource type for every request through load
- initial load classification: zero Fetch/XHR/API or mutation requests; the only booking-keyword matches were two GET Script imports for local source modules
- option interactions: `qa-evidence/daymark-homepage/widget-option-network.json` records zero request events after inline and floating activation and the expected `aria-pressed` reversals
- console: `qa-evidence/daymark-homepage/browser-console-warn-error.json` records zero warn/error entries
- keyboard: `qa-evidence/daymark-homepage/keyboard-traversal.json` records that the preceding `Widget options` link remained the active, `:focus-visible` element before and after the genuine forward Tab event; `qa-evidence/daymark-homepage/keyboard-traversal-blocked.png` preserves the resulting viewport

## Keyboard blocker

A fresh IAB binding was created and the desktop viewport was applied. The preceding focusable `Widget options` link was active with accessible name `Widget options` and `:focus-visible=true`. `tab.cua.keypress({ keys: ["TAB"] })` and the documented DOM-CUA equivalent both returned normally but left the same link active. As a final documented path, `locator.press("Tab")` was sent from the preceding hero `Start real booking` link and then repeated from `locator(":focus")` 11 more times; every active-element record remained that same link with `:focus-visible=true`. The exact raw CDP `Input.dispatchKeyEvent` Tab sequence was also attempted; IAB explicitly rejected that command as unsupported and directed the run back to CUA. Direct DOM `focus()` and DOM-order inspection were not used as traversal evidence. Because the floating and inline controls were never reached sequentially, `keyboard-focus-floating.png` and `keyboard-focus-inline.png` were not fabricated.

final result: blocked
