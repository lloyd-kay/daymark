# Daymark homepage design QA

## Scope and result

- selected background: `public/daymark-widget-art-4x3-background-2x.png` (2896 x 2172, 4,675,881 bytes)
- live wordmark font: `public/fonts/libre-bodoni-latin-400.woff2`
- live tagline font: `public/fonts/dm-sans-latin-variable.woff2`
- rollback artwork: `public/daymark-widget-art-4x3-readable.png`, `public/daymark-widget-art-4x3-readable-2x.png`, and `public/daymark-widget-art-4x3-textured.png` remain untouched
- desktop evidence: `qa-evidence/daymark-homepage/live-wordmark-desktop-chrome.png`
- mobile evidence: `qa-evidence/daymark-homepage/live-wordmark-mobile-floating-chrome.png` and `qa-evidence/daymark-homepage/live-wordmark-mobile-inline-chrome.png`
- reference comparison: `qa-evidence/daymark-homepage/live-wordmark-reference-comparison.png`
- browser record: `qa-evidence/daymark-homepage/chrome-live-wordmark-qa.json`
- P0-P2 findings: none after the live-type and responsive-scale pass

## Same-state visual comparison

The supplied pixelated widget screenshot and the corrected Chrome rendering were placed together in one comparison image. The paper grain, orange binding, folder colours, artwork crop, Cedar House framing, option order, blue section, controls, and selected state remain aligned with the approved source.

The raster background no longer contains the tiny `DAYMARK` or tagline pixels. Chrome now draws one live Libre Bodoni wordmark and one live DM Sans tagline over the same intrinsic 4:3 coordinate plane in each widget preview. At the 1303 x 1231 desktop viewport, that plane renders at 224 x 168 px; the wordmark is 140.0625 x 25.53125 px and the tagline is 139.9375 x 6.15625 px. The inline copy is unobstructed, while the floating copy remains naturally covered by the unchanged booking panel.

At 390 x 844, the cards stack in the approved order and the 4:3 planes fit by width. The complete wordmark remains visible in both cards, the tagline scales proportionally instead of being enlarged or clipped, the 205 px floating panel remains present, and `scrollWidth === clientWidth`.

## Required fidelity surfaces

- typography and copy: passed; both previews contain the exact live `DAYMARK` and `Book the right person. Keep every calendar private.` strings
- typography delivery: passed; Chrome observed both self-hosted WOFF2 files as loaded font resources
- spacing and layout: passed; the 170 px art cutout, desktop columns, mobile stacking, option order, and controls retain their existing geometry
- colours and visual tokens: passed; the cream paper, coral binding, sage, lilac, ochre, and sky folder palette remains intact
- image fidelity: passed; both previews load the text-free 2896 x 2172 sibling while all earlier artwork stays recoverable
- image delivery: passed; both decorative images remain lazy-loaded with asynchronous decoding
- crop quality: passed; desktop fills the cutout and mobile preserves the complete wordmark without horizontal overflow
- floating panel preservation: passed; the panel remains visible at 205 px wide and was not moved or hidden
- interaction: passed; initial pressed state is `[true, false]`, inline activation is `[false, true]`, the URL remains unchanged, and the unit regression records no fetch call
- console: passed; Chrome recorded zero warnings and zero errors
- publishing: not performed

## Verification

- focused red-green regression: passed; missing local font assets failed before implementation and all 5 focused widget tests passed afterward
- full unit suite: 21 files and 149 tests passed
- lint: passed with zero errors
- Vinext production build: passed across all five build stages
- rendered-route checks: 6 passed, 0 failed
- whitespace validation: `git diff --check` exited 0

final result: passed
