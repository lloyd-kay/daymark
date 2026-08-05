# Daymark widget wordmark fit

## Context

The two homepage widget previews currently share one artwork rule: the 1200 x 630 Daymark social image is rendered with `background-size: cover` and a 72% horizontal position inside an artwork slot that is about 203 x 170 px on desktop. That wide-to-portrait crop necessarily removes the opening letters from `DAYMARK`.

Both previews should use a smaller artwork treatment so the complete `DAYMARK` wordmark exists within each artwork slot. The floating booking panel remains intentionally layered over its host page and may still overlap part of that corrected artwork; it must not be hidden, removed, or repositioned.

## Chosen design

Keep the existing artwork and correct both previews:

- Give both `HostHero` artwork elements a shared full-wordmark modifier class.
- Render both artworks smaller with `background-size: auto 76%` and `background-position: 30% center` while retaining the existing no-repeat paper background, border, and rounded silhouette.
- Preserve the floating booking panel's existing size, position, stacking, content, and interaction-free preview role.
- Do not introduce a new image, redraw the wordmark, alter the booking panels, or change selection behaviour.

This keeps the approved texture and coloured paper tabs while fitting the complete underlying wordmark in both desktop and narrow preview slots. The inline version stays fully visible; the floating version remains naturally overlapped by its panel.

## Acceptance criteria

- Both widget preview artwork elements contain all seven letters of `DAYMARK` at a legible scale before layering.
- The inline artwork shows the complete wordmark unobstructed.
- The floating booking panel remains present in its current position and naturally overlaps the corrected artwork without being hidden or moved.
- Desktop and mobile layouts keep their current dimensions, spacing, rounded artwork shape, and lack of horizontal overflow.
- The two widget choice buttons retain their local-only `aria-pressed` behaviour and make no network requests.
- Chrome verifies real forward-Tab traversal through the floating and inline choice buttons, replacing the earlier in-app-browser keyboard limitation.
- Automated regression coverage requires both artwork elements to use the shared full-wordmark modifier and confirms the floating booking panel remains present before the production change is made.

## Testing and QA

Implementation follows a red-green cycle:

1. Add a focused component test that expects both artwork elements to carry the full-wordmark modifier and the floating booking panel to remain present, then confirm the new modifier assertion fails.
2. Add the minimum component and CSS change and confirm the focused test passes.
3. Run the full unit, lint, production build, rendered-route, and diff checks.
4. In Chrome, compare the user's supplied screenshot with fresh desktop and mobile captures, verify the smaller full-wordmark treatment in both previews and the unchanged floating panel, exercise both option states, inspect console/network activity, and complete the genuine sequential Tab-order check.

No authentication, booking, administrator, persistence, widget embed, or deployment behaviour changes.
