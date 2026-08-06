# Daymark homepage finishing pass

**Date:** 2026-08-06  
**Status:** Approved for planning

## Outcome

Complete the public homepage by extending the widget setup note and making the booking demonstration feel meaningfully populated. The work must preserve Daymark's existing paper-led visual language and must not change real booking availability or staff workspace behaviour.

## Widget setup note

Keep the existing instruction and staff sign-in link:

> Use the embed position that suits your layout, then sign in to the staff workspace to set it up.

Add this companion message:

> For custom widgets or integrations, contact us.

The contact message is informational for now. It must not be rendered as a link, button, or other interactive control until a destination exists.

Present the companion message as a small editorial tag beside the existing setup instruction. It should reuse the site's established ink, cream, coral, blue, and paper-card vocabulary, with restrained borders and offset-shadow details rather than introducing a generic call-to-action pattern. On narrower screens, the instruction and tag should stack cleanly in reading order.

## Demonstration availability

The demonstration will expose seven upcoming selectable dates rather than only the current date. Every employee must have at least one available time on each displayed date. Each of the four demonstration employees will have a distinct, varied selection of appointment times, and those times may also vary from day to day.

The schedule should appear random to a visitor but be generated deterministically from the employee and date. This keeps the demonstration stable across repeated visits, prevents hydration or testing instability, and still communicates that each employee manages separate availability.

The existing two-week explanatory copy remains accurate because all seven dates fall within that window. Real booking data continues to come from the production transport and is unaffected.

## Interaction and accessibility

- Continue using the existing employee, date, and time selection flow.
- Keep all seven demonstration dates selectable by returning at least one slot for each employee and date.
- Preserve keyboard operation, focus treatment, and semantic button/link behaviour.
- Do not make the deferred contact prompt focusable or visually imply that it is clickable.
- Keep the layout responsive and prevent the added note from crowding the widget cards.

## Verification

- Add transport-level tests proving that the demonstration returns seven dates and employee-specific stable times.
- Add homepage coverage for the custom-widget/integration message and its non-interactive presentation.
- Keep the existing end-to-end demonstration test passing through employee, date, time, and confirmation.
- Run the focused test suites, the full test suite, and the production build.
- Inspect the affected homepage sections at desktop and mobile widths in the local browser.

## Out of scope

- Building a contact page, form, email destination, or custom-integration workflow.
- Changing genuine employee availability, administrator permissions, booking persistence, or staff authentication.
- Redesigning any page after the homepage.
