# Daymark homepage design QA

- reference: user annotations for `h1#product-title` and `section#widget-options`; recovered `.superpowers/brainstorm/79-1785918956/content/widget-options.html`
- desktop viewport: 1775 × 1234 — passed; the hero is three unclipped paper lines and both Cedar House previews are fully framed
- mobile viewport: 390 × 844 — passed; the page has no horizontal overflow and the cards stack floating then inline
- widget selection: passed; each option toggles the two `aria-pressed` values without changing routes or stored data
- keyboard focus: passed; both 44px option controls and their card-level focus outlines are visible
- navigation links: passed; staff setup opens `/workspace/sign-in` and real booking opens `/book`
- network boundary: passed; selecting either homepage option makes no booking, availability, or configuration request
- browser console: passed; no errors or hydration warnings
- P0–P2 issues: none remaining

## Comparison evidence

- source visual truth: `C:\Users\Lloyd\AppData\Local\Temp\codex-clipboard-4f28498d-c8e5-4288-b3a0-f364322d775d.png` (1731 × 909 px) and `C:\Users\Lloyd\Documents\Codex\2026-08-04\sites-plugin-sites-openai-bundled-create\.worktrees\daymark-calendar\.superpowers\brainstorm\79-1785918956\content\widget-options.html`
- desktop implementation: `C:\Users\Lloyd\Documents\Codex\2026-08-04\sites-plugin-sites-openai-bundled-create\.worktrees\daymark-calendar\.superpowers\sdd\2026-08-05-daymark-hero-widget-refresh-implementation\task-3-evidence\desktop-hero-1775x1234.png`, `desktop-widget-top-1775x1234.png`, and `desktop-widget-bottom-1775x1234.png`
- desktop state and density: `window.innerWidth × innerHeight` was 1775 × 1234 CSS px at device scale factor 1; viewport captures were 1760 × 1224 raster px after the in-app browser excluded its scrollbar/chrome area; the focused hero crop was 1440 × 867 px with no resampling
- mobile implementation: `C:\Users\Lloyd\Documents\Codex\2026-08-04\sites-plugin-sites-openai-bundled-create\.worktrees\daymark-calendar\.superpowers\sdd\2026-08-05-daymark-hero-widget-refresh-implementation\task-3-evidence\mobile-hero-390x844.png`, `mobile-widget-top-390x844.png`, `mobile-widget-inline-390x844.png`, and `mobile-widget-bottom-390x844.png`
- mobile state and density: `window.innerWidth × innerHeight` was 390 × 844 CSS px, `(max-width: 720px)` matched, and device scale factor was 1; the visible capture area was 375 × 812 raster px after the in-app browser excluded its scrollbar/chrome area; `scrollWidth` and `clientWidth` were both 375 px
- states compared: desktop floating selected, desktop inline selected, desktop focus on each option, mobile floating selected, and mobile inline selected with focus
- full-view comparison: the integrated hero comparison preserved the three-line paper composition, coral/sage/lilac/ochre/sky palette, summary, actions, and privacy stamp; the integrated widget comparison preserved both fully framed Cedar House floating and inline compositions, blue section treatment, option copy, and setup link
- focused comparison: the hero line crops confirmed complete words and all five colours; the widget viewport captures confirmed legible miniature browser copy, the floating overlay, inline rail, two-column narrow staff tabs, 44px controls, selected outlines, and card-level focus outlines

## Fidelity surfaces

- fonts and typography: passed; display and body hierarchy remain legible, all required copy is complete, and no heading or miniature browser text is truncated
- spacing and layout rhythm: passed; desktop previews are balanced in two columns, mobile previews stack in the required order, and actions and setup copy retain usable spacing
- colours and visual tokens: passed; the five requested Daymark paper colours, ink, paper, sky section, and coral/sage selection accents remain visible and coherent
- image and asset fidelity: passed; the hero treatment and the two coded Cedar House browser compositions match the approved refresh and recovered prototype without missing visible assets
- copy and content: passed; all approved hero, widget, option, setup, and navigation copy is present

## Findings and comparison history

- P0–P2 findings: none. The first valid same-state comparisons passed, so no production correction or before/after iteration was required.
- residual test gaps: none material. The in-app browser blocks direct `file://` rendering of the recovered HTML, so the integrated comparison used the exact inspected HTML/CSS plus the user annotation and live viewport captures; the controller completed the paired image judgment.

final result: passed
