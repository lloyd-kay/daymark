# Daymark homepage design QA

## Scope and result

- selected artwork: `public/daymark-widget-art-4x3-readable-2x.png` (2896 x 2172)
- rollback artwork: `public/daymark-widget-art-4x3-textured.png` remains untouched
- desktop implementation: `qa-evidence/daymark-homepage/true-2x-widget-after-chrome.png` at 1303 x 1231
- mobile implementation: `qa-evidence/daymark-homepage/readable-widget-mobile-floating-chrome.png` and `qa-evidence/daymark-homepage/readable-widget-mobile-inline-chrome.png` at 390 x 844
- browser record: `qa-evidence/daymark-homepage/chrome-true-2x-widget-qa.json`
- comparison state: floating option selected, inline option unselected, floating booking panel visible
- P0-P2 findings: none after the typography-edge sharpness pass

## Same-state visual comparison

The earlier 1448 x 1086 implementation and the fresh 2896 x 2172 Chrome implementation were captured at the same viewport and placed side by side. The new sibling asset is a true two-times-density master while preserving the original text size, baseline, placement, Cedar House composition, rounded artwork cutout, widget option order, selected state, blue section, spacing, controls, and paper-based visual language. Neither text line was enlarged.

At 1280 x 890, both image elements use `object-fit: cover` inside 200 x 168 px artwork slots. The textured cream paper and coloured folder tabs fill the cutouts cleanly. The inline preview displays the complete `DAYMARK` name unobstructed. The floating preview keeps the 205 px booking panel in its original position over the artwork, as requested.

At 390 x 844, the cards stack in the approved order and both image elements switch to `object-fit: contain` inside 116 x 168 px slots. This keeps the complete inline `DAYMARK` name visible instead of clipping it on the narrower card. The floating panel remains present and usable, and `scrollWidth === clientWidth`.

## Required fidelity surfaces

- typography and copy: passed; hierarchy and approved copy remain complete and legible
- spacing and layout: passed; desktop columns and mobile stacking retain their existing geometry
- colours and visual tokens: passed; the stronger cream paper texture and all Daymark folder colours carry through accurately
- image fidelity: passed; both previews load the true 2896 x 2172 sibling at its natural dimensions, while the prior textured and sharpened masters remain recoverable
- typography scale and copy: passed; both text lines retain their approved apparent size and exact wording
- crop quality: passed; desktop fills the cutout, while mobile preserves the complete wordmark
- floating panel preservation: passed; the panel remains visible at 205 px wide and was not moved or hidden

## Chrome interaction and browser evidence

- default option state: floating `aria-pressed=true`, inline `aria-pressed=false`
- inline activation: floating changed to `false`, inline changed to `true`
- restored state: floating returned to `true`, inline returned to `false`
- observed page assets: `daymark-widget-art-4x3-readable-2x.png` was loaded once and referenced by both widget image elements
- console: Vite debug messages and the React development notice only; zero warnings or errors
- horizontal overflow: none at 1280 x 890 or 390 x 844

The earlier keyboard and network evidence remains valid in `qa-evidence/daymark-homepage/chrome-wordmark-qa.json`; this pass specifically verifies the genuine two-times pixel dimensions, unchanged apparent text size, responsive fit, preserved overlay, and unchanged choice interaction.

final result: passed
