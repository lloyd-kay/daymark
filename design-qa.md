# Daymark guided booking-setup design QA

- Source visual truth: `qa-evidence/daymark-homepage/booking-setup-selector-user-reference.png`
- Desktop implementation: `qa-evidence/daymark-homepage/guided-booking-setup-desktop-chrome.png`
- Mobile implementation: `qa-evidence/daymark-homepage/guided-booking-setup-mobile-chrome.png`
- Interaction record: `qa-evidence/daymark-homepage/guided-booking-setup-qa.json`
- Route: `http://localhost:3000/`
- Browser: the user-selected Chrome session
- Runtime: rebuilt packaged Windows stage using disposable, ignored QA data, backup, and log directories under `artifacts/`

## Design decision

The supplied reference showed the two customer-journey cards and two widget-placement cards at the same time. The shared illustrated-card system was retained, but the four-way-looking surface was replaced with progressive disclosure:

1. “Where will customers start?” shows only the two starting-point cards.
2. After a choice, “How should booking open?” shows only the two opening-style cards.
3. Completed choices collapse into a compact progress summary with explicit Change controls.
4. The live demonstration and installation handoff appear only after both choices are made.

The demonstration-service switch now appears inside the live result. It is clearly labelled as preview-only and is not presented as a third setup decision.

## Source comparison

The source screenshot and fresh desktop capture were inspected together. The new version intentionally differs in information architecture while preserving the established Daymark visual language: paper panels, ink borders and shadows, coral step labels, editorial Fraunces headings, compact DM Sans guidance, and the same illustrated Cedar House previews.

The comparison confirms that the starting-point choices now have the same visual weight and preview anatomy as the placement choices without presenting all four options as one decision. The progress bar makes the two-step sequence visible before the first choice, and no default is presented as already confirmed.

## Responsive and accessibility QA

- Chrome was normalized to a 390 × 842 CSS-pixel viewport for the mobile check.
- Initial and second-step cards stack in one column with 0 px horizontal overflow.
- A native multi-line fieldset legend initially intersected the question border at mobile width. Both questions were changed to ordinary `section` regions labelled by real headings, then the mobile capture was repeated.
- The progress list exposes the current step with `aria-current="step"`.
- Both choice cards retain native button controls and `aria-pressed` state.
- Selecting an option or using either Change control moves keyboard focus to the newly revealed question or completed-result heading.
- Change controls restore the relevant question while temporarily hiding, not destroying, the completed live result.
- The preview-service choices remain native radio controls inside a labelled fieldset.

## Interaction and runtime checks

- Initial load contains two starting-point cards, no placement cards, no live booking flow, and no installation link.
- Selecting “On a specific service page” advances to the two opening-style cards and collapses step 1.
- Selecting “Booking section in the page” reveals the matching inline live demonstration and setup profile.
- Changing an already confirmed starting point keeps focus on the completed-result heading after the live demonstration resets.
- Switching the preview to Garden planning shows Theo Brooks and Priya Shah and removes Maya Chen and Jon Bell.
- Changing either completed choice returns to only that question; the other confirmed choice remains summarized.
- Desktop interaction monitoring recorded no console errors, uncaught errors, or unhandled rejections.
- The packaged `/api/health` endpoint reports `ok`, application version `0.1.1`, and migration `0006_service_scope_widget_defaults.sql`.
- Packaged-runtime QA used isolated state under ignored `artifacts/`; `.daymark/` was not used, edited, staged, or committed by this final verification pass.

## Findings

- No actionable P0, P1, or P2 visual, interaction, responsive, or accessibility findings remain.

final result: passed
