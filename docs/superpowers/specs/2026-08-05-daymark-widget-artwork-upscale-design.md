# Daymark widget artwork sharpness upscale

## Context

The two homepage widget previews use `public/daymark-widget-art-4x3-textured.png`, a 1448 x 1086 raster displayed inside artwork slots approximately 200 x 168 px on desktop. The composition, text scale, stronger paper texture, coloured folders, orange binding, and floating booking-panel overlap are approved. The remaining issue is that the `DAYMARK` wordmark and the tagline appear soft when the artwork is reduced inside the widget preview.

This is a sharpness problem, not a sizing request. The visible size and placement of both text lines must remain unchanged.

## Approaches considered

1. **High-fidelity raster upscale and edge reconstruction — selected.** Create a new sibling 4:3 asset from the approved artwork, preserving the composition while reconstructing cleaner letter edges and exporting a higher-density master.
2. **Enlarge the typography.** Rejected because it changes the approved composition and does not match the request.
3. **Zoom or filter the image in CSS.** Rejected because zooming crops the folders and a CSS sharpness filter cannot recover blurred letter shapes reliably.

## Chosen design

- Use the built-in image editor with `public/daymark-widget-art-4x3-textured.png` as the edit target.
- Preserve the exact apparent size, baseline, spacing, navy colour, and position of:
  - `DAYMARK`
  - `Book the right person. Keep every calendar private.`
- Reconstruct only typography edge clarity and fine contrast; do not add, remove, enlarge, shrink, or move any text.
- Preserve the cream paper texture, orange binding, stitch details, green/lilac/ochre/blue folders, rounded shapes, lighting, colour balance, 4:3 framing, and all negative space.
- Save the selected result non-destructively as `public/daymark-widget-art-4x3-readable-2x.png`. The existing approved and sharpened assets remain untouched for rollback.
- Target a true two-times-density 4:3 master. Accept only a result that is at least 2896 x 2172 pixels and visibly sharper at the actual widget display size; do not substitute a same-size, smaller, or compositionally altered output.
- Update both widget image elements to use the new sibling asset. Retain the current desktop `object-fit: cover` and mobile `object-fit: contain` rules.
- Do not change the artwork slot dimensions, crop behaviour, floating panel, widget copy, option selection, or any booking functionality.

## Acceptance criteria

- The wordmark and tagline occupy the same apparent bounding boxes as the approved current artwork, within a two-percent visual tolerance.
- Both text lines remain verbatim, with no changed, missing, or malformed characters.
- The selected asset has natural dimensions of at least 2896 x 2172 pixels; a 1448 x 1086 sharpened export does not satisfy the upscale requirement.
- Letter edges and fine strokes appear visibly crisper in a same-viewport comparison at 1280 x 890.
- The inline preview retains the complete unobstructed `DAYMARK` wordmark.
- The floating preview retains its existing 205 px booking panel in the same position and stacking order.
- Desktop and 390 x 844 mobile layouts retain their current dimensions, crop rules, rounded artwork silhouette, card order, and lack of horizontal overflow.
- The current textured asset remains in the repository as a recovery option.
- Both widget choice buttons retain their local-only `aria-pressed` behaviour.

## Testing and QA

Implementation follows a red-green cycle:

1. Update the focused component regression to require both widget image elements to reference the new readable asset and confirm it fails before the source change.
2. Generate the sibling high-fidelity asset with the built-in image editor and inspect it at original resolution for exact text, unchanged scale, and preserved composition.
3. Apply the new asset path and confirm the focused regression passes.
4. Run the full unit suite, lint, production build, rendered-route checks, and diff checks.
5. In Chrome, capture the widget section at 1280 x 890 and both cards at 390 x 844. Compare the approved source, user-reported browser state, and fresh implementation together at the same viewport and state.
6. Verify image natural dimensions, responsive fit, no horizontal overflow, unchanged floating-panel geometry, restored default selection, and zero console warnings or errors.

No typography enlargement, layout change, authentication change, booking change, embed change, administrator change, persistence change, or deployment is included.
