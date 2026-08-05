# Daymark hero colour and widget-preview refresh

**Date:** 2026-08-05  
**Status:** Approved design direction

## Goal

Make the existing Daymark product homepage more colourful without redesigning the surrounding experience. The hero heading will use the app's established paper palette, and the widget-options section will restore the richer floating and inline previews previously approved in the visual companion.

## Scope and preservation

- Preserve the current page structure, copy, routes, navigation, privacy promises, no-write demonstration, footer, authentication, booking behavior, and administrator tools.
- Change only the hero-heading treatment and the presentation inside `#widget-options`, plus the minimum responsive styles and tests needed for those elements.
- The homepage remains demonstration-only and performs no booking or availability network requests.
- `/book` remains the only standalone live booking page.

## Hero treatment

- Keep the heading text: “Scheduling without shared calendars.”
- Break it into the same readable three-line composition at wide widths.
- Place each line on a layered paper highlight using Daymark's existing coral, sage, lilac, ochre, and blue palette.
- Use dark ink text, thin editorial rules, slight paper offsets, and restrained shadows so the treatment feels tactile rather than like generic coloured pills.
- Preserve the existing eyebrow, summary, privacy stamp, and primary/secondary actions.
- On narrow screens, the highlights stack cleanly, do not clip the words, and retain strong contrast and focus visibility.

## Widget-options restoration

Use the recovered original prototype at `.superpowers/brainstorm/79-1785918956/content/widget-options.html` as the source of truth.

### Floating option

- Show a miniature “Cedar House” host website.
- Place the Daymark launcher in the lower-right corner with its booking panel open above it.
- The panel shows a person choice and discrete example times, with no real customer data and no API calls.
- Copy: “Always close, never in the way,” explaining that the launcher suits site-wide booking access.

### Inline option

- Show the same miniature host website with a Daymark booking panel embedded in the page.
- Restore the coral vertical Daymark rail, progress label, and four colour-coded staff tabs for Maya, Theo, Priya, and Jon.
- Copy: “A booking section with presence,” explaining that this mode suits a dedicated contact or booking section.

### Interaction

- Both previews remain visible side by side on wide screens and stack on small screens.
- Each option is a real accessible selection control with `aria-pressed`; choosing one updates the selected paper outline locally.
- Selection is presentational only: it stores no data, calls no API, and does not change the administrator's actual embed configuration.
- The existing staff-workspace setup link remains below the previews.

## Assets and visual language

- Reuse the existing Daymark palette, typography, borders, shadows, and `/og.png` artwork where a real image is useful inside the miniature host-site previews.
- Do not introduce a new illustration style, icon family, gradient substitute, or unrelated homepage section.
- Keep all app-specific text as live HTML for accessibility and responsiveness.

## Accessibility and responsive behavior

- Maintain semantic heading order and the current labelled `#widget-options` region.
- Hero highlights must meet WCAG AA contrast and cannot hide or crop text at supported breakpoints.
- Widget choices must work with keyboard activation and expose a visible focus state and selected state.
- Decorative preview content is hidden from assistive technology; meaningful option names and descriptions remain readable.
- At mobile widths, preview cards stack, miniature browser content remains legible, and no horizontal page overflow is introduced.

## Verification

- Add focused component/rendered tests for hero line structure, both restored option names, accessible selection behavior, and the no-network boundary.
- Run the full unit suite, lint, production build, rendered-route checks, and `git diff --check`.
- Use the in-app browser at the annotated desktop viewport and a mobile viewport to inspect the hero and widget section, test option selection and links, and check the console.
- Complete Product Design visual QA against the two browser annotations and the recovered original widget prototype; fix all P0–P2 differences before handoff.

## Out of scope

- Changing live booking, staff authentication, administrator permissions, widget embed protocol, or stored configuration.
- Reworking the privacy, demonstration, or footer sections.
- Deploying or publishing a Sites version without the existing explicit approval gate.
