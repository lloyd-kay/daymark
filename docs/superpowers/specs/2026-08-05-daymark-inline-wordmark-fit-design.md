# Daymark inline widget wordmark fit

## Context

The two homepage widget previews currently share one artwork rule: the 1200 x 630 Daymark social image is rendered with `background-size: cover` and a 72% horizontal position inside an artwork slot that is about 203 x 170 px on desktop. That wide-to-portrait crop necessarily removes the opening letters from `DAYMARK`.

The floating preview may remain obscured because its booking panel is intentionally layered over the host page. The fully visible inline preview must show the complete `DAYMARK` wordmark.

## Chosen design

Keep the existing artwork and change only the inline preview:

- Give the inline `HostHero` artwork an inline-specific modifier class.
- Preserve the floating artwork's current `cover` crop and positioning.
- Render the inline artwork smaller with `background-size: auto 76%` and `background-position: 30% center` while retaining the existing no-repeat paper background, border, and rounded silhouette.
- Do not introduce a new image, redraw the wordmark, alter the booking panels, or change selection behaviour.

This keeps the approved texture and coloured paper tabs while fitting the complete wordmark in both the desktop and narrow preview slots.

## Acceptance criteria

- In the inline widget preview, all seven letters of `DAYMARK` are visibly present and legible.
- The floating preview remains visually unchanged and may still be naturally obscured by its panel.
- Desktop and mobile layouts keep their current dimensions, spacing, rounded artwork shape, and lack of horizontal overflow.
- The two widget choice buttons retain their local-only `aria-pressed` behaviour and make no network requests.
- Chrome verifies real forward-Tab traversal through the floating and inline choice buttons, replacing the earlier in-app-browser keyboard limitation.
- Automated regression coverage distinguishes the inline artwork modifier from the unchanged floating artwork before the production change is made.

## Testing and QA

Implementation follows a red-green cycle:

1. Add a focused component test that expects only the inline artwork to carry the inline-fit modifier and confirm it fails.
2. Add the minimum component and CSS change and confirm the focused test passes.
3. Run the full unit, lint, production build, rendered-route, and diff checks.
4. In Chrome, compare the user's supplied screenshot with fresh desktop and mobile captures, verify the full inline wordmark, exercise both option states, inspect console/network activity, and complete the genuine sequential Tab-order check.

No authentication, booking, administrator, persistence, widget embed, or deployment behaviour changes.
