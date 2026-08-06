# Daymark booking reveal motion

**Date:** 2026-08-06  
**Status:** Approved for planning

## Outcome

Add a restrained reveal animation to the booking demonstration and booking flow so newly available dates, times, and selected date/time details do not appear abruptly. The motion must feel consistent with Daymark's tactile paper-card design without reducing responsiveness.

## Motion behaviour

Use a gentle staggered reveal:

- Date cards fade from transparent while rising approximately 6px into place.
- Available-time buttons use the same fade-and-rise treatment.
- The selected date and selected time in the booking summary slip fade in while moving approximately 5px from the right.
- Date cards and time buttons stagger by approximately 25–30ms so the sequence feels intentional but completes quickly.
- Individual animations last approximately 180–220ms and use a soft ease-out curve.

The layout must reach its final dimensions before animation begins. No height, width, margin, padding, box-shadow, filter, blur, or positioning property may be animated.

## Performance and accessibility

- Animate only `opacity` and `transform`, allowing browser compositing without layout recalculation.
- Use CSS animations rather than timers, requestAnimationFrame loops, or additional React state.
- Preserve all existing hover and focus behaviour.
- Keep the existing `prefers-reduced-motion: reduce` rule effective so reveals collapse to effectively no animation.
- Do not delay keyboard access or pointer interaction while the animation runs.
- Do not add loading waits; the current data and navigation timing remains unchanged.

## Scope

Apply the effect to both the public booking flow and the homepage demonstration because they share `BookingFlow` and the same style sheet. Do not animate the staff workspace, widget preview cards, confirmation screen, or unrelated homepage sections.

## Verification

- Add an automated style-contract test for the three reveal targets, the approved timing range, transform/opacity-only keyframes, and reduced-motion coverage.
- Run the focused motion test, full unit suite, lint, production build, and server-rendered tests.
- Inspect date, time, and summary-token reveals in the local browser at desktop and mobile widths.
- Confirm there is no document overflow, focus regression, console warning, or visible layout shift.
