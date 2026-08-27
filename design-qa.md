# Daymark customer-journey selector design QA

- Source visual truth: `qa-evidence/daymark-homepage/booking-setup-selector-user-reference.png`
- Rendered implementation: `qa-evidence/daymark-homepage/booking-setup-selector-desktop-chrome.jpg`
- Responsive and interaction record: `qa-evidence/daymark-homepage/chrome-booking-setup-selector-qa.json`
- Route: `http://localhost:3000/`
- State: full catalogue journey selected; floating widget selected; selector and placement cards visible
- Browser: the user-selected Chrome session

## Capture normalization

- Source pixels: 1196 × 1304. The supplied screenshot is a desktop crop of the setup selector.
- Implementation pixels: 5351 × 2039.
- Implementation CSS viewport: 4300 × 1631 CSS px at `devicePixelRatio: 0.8`.
- Capture density: 1.25 image pixels per CSS pixel in both axes.
- The source is a tighter crop than the connected Chrome window. Comparison therefore uses the centred selector region and the shared desktop/two-column state rather than treating the surrounding canvas as a design difference.

## Full-view comparison evidence

The supplied source and the rendered implementation were opened together in one comparison input. The source establishes two things: the original customer-journey cards were visually lighter and more abstract, while the placement cards directly below them establish the desired large illustrated-card system. The implementation now gives both decisions the same browser-preview, editorial-card anatomy while retaining the pink journey section and green placement section.

No separate focused-region comparison was required. At the captured resolution, the card titles, option labels, preview stages, selected states, explanatory copy, and placement artwork all remain legible in the full-view comparison.

## Required fidelity surfaces

- Fonts and typography: the existing Fraunces display hierarchy and DM Sans UI copy are preserved. Journey titles now use the same scale, weight, line height, and editorial rhythm as placement titles.
- Spacing and layout rhythm: both decisions use matching two-column card grids, preview-to-copy proportions, borders, shadows, and selected-state outlines. The compact current-setup strip provides orientation without adding another large section.
- Colors and visual tokens: the established paper, ink, coral, sky, sage, and lilac palette remains intact. Journey and placement remain clearly separated by their existing semantic backgrounds.
- Image quality and asset fidelity: the existing Daymark/Cedar House artwork in the placement cards is unchanged and remains sharp. Journey previews use the existing browser chrome and real interface components rather than introducing a mismatched illustration style.
- Copy and content: the ambiguous customer-journey wording is replaced with direct outcomes: customers either choose a service or begin with the page service already selected. Each card includes a concrete “Best for” explanation.

## Comparison history

### Iteration 1

- Earlier finding: **P1 — customer-journey choices were materially less visual and less self-explanatory than the placement choices immediately beneath them.** The abstract boxes did not make the customer’s first screen obvious, and the two independent decisions were easy to conflate.
- Fixes made: rebuilt both journey previews inside the same Cedar House browser frame used by the widget cards; added explicit first-screen/result stages; rewrote the two decision headings; added “Best for” guidance; made each journey card one large selection target; added a live “Your current setup” summary.
- Post-fix evidence: `qa-evidence/daymark-homepage/booking-setup-selector-desktop-chrome.jpg` shows two equal illustrated journey cards followed by the matching two illustrated placement cards, with distinct step backgrounds and clear selection states.

### Iteration 2

- Review finding: **P1 — changing the page-service demonstration to Garden planning left its journey illustration on Interior consultation.** The selector and the live demonstration therefore disagreed.
- Fixes made: bound the page-service illustration to the same demonstration scenario as the live booking flow; added Garden planning/Theo/Priya regression coverage; included the “Best for” guidance in each card control's accessible description.
- Responsive evidence: Chrome was set to a 390 × 843 CSS-pixel viewport. Both card pairs and both summary rows stacked, horizontal overflow was 0 px, the complete card activated by pointer and Enter, and sequential Tab focus reached the native journey button with a visible card outline.

## Interaction and runtime checks

- Selecting “Start with this service selected” updated the journey state and revealed the demonstration-service selector.
- Changing that selector to “Garden planning” updated both the journey illustration and live demonstration to Theo and Priya.
- Selecting the inline layout updated the live summary to “This page's service · Inline section”.
- Selected controls reported `aria-pressed="true"`.
- At the 390 × 843 CSS-pixel viewport, the journey cards, placement cards, and current-setup rows stacked with 0 px horizontal overflow.
- Sequential keyboard traversal reached the journey control and displayed its card-level focus outline; Enter activated it.
- The packaged runtime health check passed on port 3000.
- Chrome console log check returned no errors or warnings.

## Findings

- No actionable P0, P1, or P2 findings remain.
- The wide desktop source comparison is supplemented by measured responsive Chrome evidence at a 390 px CSS viewport.

## Implementation checklist

- [x] Match journey-card anatomy to placement cards.
- [x] Explain each customer outcome in plain language.
- [x] Keep journey and placement visually distinct.
- [x] Show the combined current selection.
- [x] Preserve keyboard, focus, and pressed-state semantics.
- [x] Verify the packaged runtime and browser console.

final result: passed
