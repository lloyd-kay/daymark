# Inline Widget Privacy Note Design

## Goal

Make the privacy message in Daymark's inline embed resemble the compact pinned post-it used in the interactive demonstration. The change is for local testing before it is accepted for release.

## Scope

- Change only the inline embedded booking surface.
- Leave the homepage demonstration and floating booking widget unchanged.
- Preserve all booking behaviour, keyboard access, focus order, and form controls.

## Layout

At widths where the booking controls and note fit safely, the embedded booking surface uses three visual columns:

1. the coral Daymark date rail;
2. the booking workbench;
3. a 200–230px privacy post-it on the right.

The note keeps the blue paper, coral pin, slight rotation, dark border, and offset shadow from the demonstration. A small negative horizontal margin lets it overlap the unused cream gutter, combining the side placement of option A with the wider proportions of option B.

The note must not cover employee cards, date choices, time choices, contact fields, validation messages, or buttons. It remains non-interactive and outside the booking workbench's focus order.

## Responsive Behaviour

- Use the side post-it only when the embed is wide enough to preserve readable booking controls.
- At narrower widths, move the note below the booking workbench as a compact card.
- On phones, remove rotation and overlap, use safe side margins, and allow the note to use the available width.
- The widget must not introduce horizontal scrolling.

## Implementation Boundary

The change should be achievable through embedded-surface layout styles in `app/globals.css`. No booking data, API, authentication, persistence, or widget-loader behaviour should change.

## Verification

- Add a rendered-layout regression assertion before changing production styles.
- Confirm the assertion fails because the inline embed lacks the compact side-note treatment.
- Confirm it passes after the style change.
- Run the existing site tests and production build.
- Inspect the local inline embed at desktop and narrow widths.
- Verify every booking control remains visible and operable.
