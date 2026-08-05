# Daymark live wordmark overlay

## Context

The widget artwork is a valid 2896 x 2172 PNG, but Chrome ultimately paints it into an approximately 201 x 168 px slot at device pixel ratio 1. The embedded `DAYMARK` wordmark therefore becomes roughly 117 x 19 physical pixels and the embedded tagline roughly 106 x 5 pixels. Further source upscaling cannot add clarity after that final downscale.

The approved direction is to preserve the textured Daymark artwork while replacing only the embedded raster lettering with browser-rendered text at the same position and apparent size.

## Approaches considered

1. **Text-free background plus live text overlay — selected.** Remove only the wordmark and tagline from a non-destructive sibling background asset, then place exact live text over it on the same intrinsic 4:3 coordinate plane.
2. **Further 4x or 8x raster upscaling.** Rejected because the final 201 x 168 px browser output remains unchanged.
3. **Enlarge the embedded lettering or artwork slot.** Rejected for this pass because the user approved preserving the current composition and apparent scale.

## Chosen design

- Create `public/daymark-widget-art-4x3-background-2x.png` as a sibling of the current readable artwork.
- Remove only `DAYMARK` and `Book the right person. Keep every calendar private.` from the raster, reconstructing continuous cream paper texture beneath them.
- Preserve the orange binding, stitches, paper texture, four coloured folders, lighting, crop, and exact 4:3 dimensions.
- Keep all existing readable and textured artwork files untouched for rollback.
- Wrap the background and live text in one intrinsic 4:3 canvas. On desktop the canvas fills by height and clips horizontally, matching the current `cover` treatment. At 520 px and below it fills by width and centres vertically, matching the current `contain` treatment.
- Render `DAYMARK` with the freely available Libre Bodoni family at normal weight, solid navy, and source-derived placement.
- Render the tagline with the existing DM Sans family, solid navy, and source-derived placement.
- Keep both text strings verbatim and prevent wrapping.
- Keep the artwork cutout, 205 px floating panel, widget cards, selection behaviour, and all booking functionality unchanged.
- Treat both text layers as decorative because the surrounding mock host page is already hidden from assistive technology.

## Acceptance criteria

- Both widget previews use the new text-free 2896 x 2172 background asset.
- Each preview contains exactly one live `DAYMARK` wordmark and one exact live tagline.
- No raster copy of either text remains visibly underneath the live type.
- At the 1303 x 1231 Chrome desktop viewport, the wordmark remains in the approved location and apparent scale, the inline version is unobstructed, and the floating version remains behind the unchanged booking panel.
- At 390 x 844, the complete wordmark remains visible in both stacked cards with no horizontal overflow.
- Browser-rendered lettering is visibly cleaner than the supplied pixelated screenshot at the same widget size.
- Default and toggled `aria-pressed` states remain unchanged and produce no network request.
- Unit tests, lint, production build, rendered-route checks, and Chrome console checks pass.
- No deployment is performed.

