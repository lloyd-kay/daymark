# Widget presentation restoration and live-preview separation

**Date:** 2026-08-11  
**Status:** Approved
**Read-only visual reference:** `restore-2026-08-10-before-service-scope-builder` at `d41a95c511054c2d365f96b29f3049256a9d4862`  
**Pre-correction restore point:** `restore-2026-08-11-before-widget-visual-correction` at `d482c09cc2f2b3ba4e7147d06f657eb2cf58b301`  
**Read-only cold data backup:** `C:\Users\Lloyd\Files\Daymark-restore-points\2026-08-10-before-service-scope-builder\.daymark`

## Summary

Daymark will restore the original illustrated Floating and Inline layout cards to the homepage setup controls. The Daymark background artwork and the visual examples of each layout belong inside those choice cards, not inside the interactive live demonstration.

The live demonstration will render only the selected presentation:

- **Floating** starts as a closed corner launcher on a neutral Cedar House host page. Selecting the launcher opens the booking flow as an overlay and hides the launcher until the overlay closes.
- **Inline** embeds the booking flow as a section of the host page and never displays the floating launcher.

The current full-catalogue/page-specific service behavior, setup codes, native links, transfer flow, qualification rules, and booking-demo state remain unchanged.

## Goals

- Restore the visual meaning of the Floating and Inline choices using the approved pre-builder artwork and composition.
- Return `/daymark-widget-art-4x3-background-2x.png` to both illustrated layout cards.
- Remove the misplaced Daymark artwork from the live demonstration.
- Prevent a floating launcher and an inline-looking booking surface from appearing at the same time.
- Make the live demonstration accurately show the selected layout while preserving the selected service journey.
- Preserve booking progress when the user changes only the layout.
- Keep the restored reference tag, the new pre-correction tag, and the cold backup immutable.

## Non-goals

- Changing full-catalogue or page-specific service behavior.
- Changing setup-profile formats, checksums, native deep links, import review, or workspace defaults.
- Changing qualification, duration, sample people, booking steps, or appointment privacy behavior.
- Modifying the Daymark widget that customers embed on production websites.
- Replacing or redesigning the restored background artwork.
- Upgrading Vinext or any packaged-runtime dependency.
- Editing, staging, packaging, or committing `.daymark/` or either restore source.

## Layout-selection experience

The **How should the widget appear?** control remains part of the unified setup builder, but its two plain radio rows are replaced by the restored illustrated cards.

### Floating choice card

The card uses the original Cedar House browser frame, Daymark background artwork, compact floating booking panel, and corner launcher. Its copy explains that the launcher keeps booking available site-wide without occupying page space.

### Inline choice card

The card uses the original Cedar House browser frame, Daymark background artwork, and booking section embedded within the page. It has no corner launcher. Its copy explains that the full booking experience becomes part of a dedicated page section.

### Selection behavior

- Both cards remain visible so the user can compare the layouts before choosing.
- Each card has one clear selection control and a visible **Selected** state.
- The enclosing fieldset and legend continue to expose the two choices as one semantic group.
- Selection is conveyed through text, border/shadow treatment, and control state rather than colour alone.
- Choosing a card updates the shared `HomepageSetupDraft.layout`, setup summary, app link, and portable code exactly as it does now.
- The service-scope controls stay compact and retain their present position and behavior.

## Live demonstration

The live demonstration is separate from the static choice illustrations. It uses a neutral Cedar House host-page frame with no Daymark background-art image.

### Floating mode

Floating mode initially displays the host page and one **Book an appointment** launcher in the lower corner. The booking flow is mounted but hidden, so its internal state can survive presentation changes.

Activating the launcher:

1. hides the launcher;
2. reveals the booking flow in a bordered, shadowed overlay above the host page;
3. moves focus into the overlay; and
4. leaves all booking behavior inside the existing `DemoBookingFlow`.

The overlay has a labelled close control. Activating that control or pressing Escape hides the booking surface and returns focus to the launcher. The launcher and open overlay are never visible simultaneously.

At narrow widths the overlay becomes a contained full-width sheet within the preview rather than an embedded inline section.

### Inline mode

Inline mode displays the same booking flow as a deliberate section in the host page's document flow. It has no floating launcher, floating overlay treatment, or overlay close control.

### Switching layouts

There is exactly one mounted `DemoBookingFlow` instance. Changing only `layout` changes the presentation wrapper without remounting that flow, so the current step and entered demonstration data remain intact.

Switching to Floating closes its presentation by default and exposes the launcher. Opening it reveals the preserved booking step. Switching to Inline immediately exposes that same preserved step in the embedded section.

Changing service scope or the sample page-specific service continues to reset the demonstration according to the existing approved behavior. If Floating is closed when that reset is requested, the overlay opens so the reset heading is visible before focus and the polite announcement are applied. Initial Floating presentation and layout-only switches still start closed.

## Component boundaries

### `HomepageSetupBuilder`

`HomepageSetupBuilder` continues to own the single shared draft:

```ts
type HomepageSetupDraft = {
  journey: "catalogue" | "page-service";
  demoService: "camera" | "alarm";
  layout: "floating" | "inline";
};
```

It passes `layout` and `chooseLayout` to the illustrated chooser, and passes `layout`, the existing reset identity, and the existing `DemoBookingFlow` to the live presentation. The reset identity only tells a closed Floating presentation to expose the already-approved reset; no second journey, service, or layout state is introduced.

### Illustrated chooser

`WidgetOptionsShowcase` returns to its focused purpose as the two-card layout selector. Its markup and styling are restored from the read-only reference and adapted only where necessary to fit the current semantic fieldset and shared state API.

The static miniature panels are decorative explanations. They never contain the interactive `DemoBookingFlow` and never create a second live booking experience.

### Live presentation

A separate live-presentation component owns only Floating open/closed UI state, focus return, Escape handling, and presentation classes. It responds to reset-identity changes by exposing a closed Floating overlay, but it does not own journey, service, booking progress, setup code, or transfer state.

The `DemoBookingFlow` remains at one stable React position inside this component. CSS and accessibility attributes expose it as a floating overlay or inline section without changing its component identity.

### Shared host primitives

Small browser-frame primitives may be shared between the chooser and live presentation. The artwork-bearing hero is used only by the chooser. The live preview uses its own neutral host content so the Daymark image cannot drift back into the demonstration.

## Accessibility and interaction details

- The layout chooser retains a semantic legend and two keyboard-operable choices.
- The selected layout is written visibly and announced through the existing polite layout status.
- The floating launcher has an accessible name and exposes whether its panel is open.
- The floating overlay has a programmatic label, a keyboard-operable close control, and document-level Escape support while open, even if focus has moved outside it.
- Opening the overlay moves focus into it; closing returns focus to the launcher when the launcher still exists.
- A hidden floating booking surface is not reachable by keyboard or exposed as active content to assistive technology; an explicit launcher `[hidden]` rule prevents its generic flex styling from overriding the browser's hidden behavior.
- Inline mode does not use dialog semantics because it is part of the page.
- Focus outlines, reduced-motion behavior, and responsive stacking follow Daymark's existing global patterns.

## Failure handling

- The restored artwork remains a local decorative asset with empty alternative text; useful layout meaning remains available in card headings and descriptions if the image does not load.
- Presentation state is local and cannot create an appointment or send a request.
- An unexpected layout value is prevented by the existing `WidgetPlacement` type and setup-profile decoder.
- Scope/service resets continue to use the existing polite announcement and safe local reset behavior.

## Test strategy

### Regression and component tests

- Prove the layout fieldset renders two illustrated choice cards with distinct Floating and Inline examples.
- Prove each choice card contains the restored local background artwork and the live demonstration contains none.
- Prove Floating initially shows one launcher while the booking surface is hidden.
- Prove activating the launcher hides it and exposes one floating overlay containing the booking flow.
- Prove closing the overlay or pressing Escape hides it and returns focus to the launcher.
- Prove Inline exposes the booking flow in an inline section with no launcher or floating overlay.
- Prove the page never exposes a launcher and an inline booking surface simultaneously.
- Prove there is exactly one interactive `DemoBookingFlow` instance.
- Prove changing only layout preserves the current booking step and entered demonstration data.
- Retain the existing tests proving scope/service changes reset the booking flow and setup summary/code values follow the shared draft.

### Visual and runtime verification

- Compare the restored cards against the read-only reference at desktop and narrow widths.
- Verify the artwork appears only in both layout cards and keeps its intended crop.
- Exercise Floating closed, Floating open, and Inline states in the browser.
- Confirm selected-card styling, overlay layering, scroll containment, focus movement, Escape behavior, and responsive layout.
- Confirm the browser console has no errors and the demonstration creates no appointment/network mutation.
- Run the complete unit, lint, rendered-HTML, production-build, desktop, Rust, migration, installer-contract, and packaged-runtime gates already used by this branch.
- Rebuild and restart the packaged runtime on port 3000 before final browser verification.

## Acceptance criteria

1. The layout control shows two Daymark-styled illustrated cards rather than plain radio rows.
2. Both cards restore the original background artwork and a recognizable example of their layout.
3. The live demonstration contains no `daymark-widget-art-4x3-background-2x.png` image.
4. Floating starts with only the corner launcher visible.
5. Opening Floating shows the booking flow as an overlay and hides the launcher.
6. Closing Floating restores the launcher and hides the overlay.
7. Inline shows the booking flow as an embedded section and never shows the launcher.
8. The live demonstration never presents Floating and Inline treatments simultaneously.
9. Layout changes preserve the booking step and entered demonstration data.
10. Service scope, sample service, setup codes, native links, transfer behavior, and qualification logic remain unchanged.
11. The corrected design works at desktop and narrow viewport sizes with keyboard and screen-reader semantics intact.
12. `.daymark/`, both restore tags, and the cold backup remain untouched by implementation and packaging.
