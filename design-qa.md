# Daymark homepage design QA

## Scope and result

- references: `qa-evidence/daymark-homepage/wordmark-crop-user-report.png`, `qa-evidence/daymark-homepage/widget-options-user-annotation.png`, and `qa-evidence/daymark-homepage/widget-options-recovered.html`
- current desktop implementation: `qa-evidence/daymark-homepage/wordmark-fit-desktop-chrome.png` and `qa-evidence/daymark-homepage/wordmark-fit-desktop-1775x1234-chrome.png`
- current mobile implementation: `qa-evidence/daymark-homepage/wordmark-fit-mobile-chrome.png` and `qa-evidence/daymark-homepage/wordmark-fit-mobile-inline-chrome.png`
- browser record: `qa-evidence/daymark-homepage/chrome-wordmark-qa.json`
- comparison state: floating option selected, inline option unselected, floating booking panel visible
- P0-P2 findings: none after the responsive wordmark correction

## Same-state visual comparison

The user's exact wordmark-crop report and the fresh desktop Chrome capture were opened together. Both widget cards retain the approved Cedar House compositions, option order, selected state, blue section, spacing, and controls. The shared artwork now uses `background-size: auto 76%` and `background-position: 30% 50%` on desktop. The inline preview displays the complete `DAYMARK` wordmark unobstructed, while the floating preview keeps the booking panel in its original size and position over the smaller artwork.

The 1775 x 1234 Chrome capture was also compared with the tracked 1775 x 1234 widget annotation. The richer recovered previews remain intentional; the wordmark fit is the only production visual change. Both cards remain unclipped and the page has no horizontal overflow.

At 390 x 844, both artwork elements use the approved narrow-screen size `auto 52%` while retaining the 30% horizontal position. The cards stack in the approved order, the complete inline `DAYMARK` wordmark remains visible, the rounded artwork slots are unchanged, the floating panel remains present, and `scrollWidth === clientWidth`.

## Required fidelity surfaces

- typography and copy: passed; hierarchy and approved copy remain complete and legible
- spacing and layout: passed; desktop columns and mobile stacking retain their existing geometry
- colours and visual tokens: passed; the Daymark paper colours, ink, blue field, and coral/sage accents are unchanged
- image fidelity: passed; both previews use the existing `og.png` artwork without redrawing or replacement
- floating panel preservation: passed; the panel remains visible at 205 px wide and was not moved or hidden

## Chrome interaction and accessibility evidence

Real forward-Tab traversal began at the hero `Start real booking` link, continued through the four person controls, then reached the floating and inline choice buttons sequentially. Direct DOM `focus()` was not used on either target.

- floating target: `BUTTON`, accessible name `Always close, never in the way`, `aria-pressed=true`, `:focus-visible=true`; evidence: `qa-evidence/daymark-homepage/keyboard-focus-floating-chrome.png`
- inline target after one more forward Tab: `BUTTON`, accessible name `A booking section with presence`, `aria-pressed=false`, `:focus-visible=true`; evidence: `qa-evidence/daymark-homepage/keyboard-focus-inline-chrome.png`
- option activation: inline changed states to floating `false` / inline `true`; floating restored floating `true` / inline `false`

## Chrome network and console evidence

Monitoring was enabled before a fresh reload. Chrome observed 129 GET requests for the document and local development assets, zero failed loads, zero Fetch/XHR requests, zero business endpoint requests, and zero mutation requests. Activating both widget choices produced zero request events. The initial load and both interactions produced zero console warnings, errors, assertions, exceptions, or hydration failures. The compact record is `qa-evidence/daymark-homepage/chrome-wordmark-qa.json`.

The earlier in-app-browser traversal limitation remains preserved in the historic evidence files, but Chrome completed the required real keyboard check and supersedes that tooling blocker.

final result: passed
