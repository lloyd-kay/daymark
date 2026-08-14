# Compact widget and homepage preview redesign

**Date:** 2026-08-14

**Status:** Approved

**Pre-change restore point:** `restore-2026-08-14-before-compact-widget-rebuild` at `4155fe66c29dfb892bfb83b2f692f6f3aa5e11c9`

**Read-only visual reference:** `restore-2026-08-10-before-service-scope-builder` at `d41a95c511054c2d365f96b29f3049256a9d4862`

**Read-only cold data backup:** `C:\Users\Lloyd\Files\Daymark-restore-points\2026-08-10-before-service-scope-builder\.daymark`

## Summary

Daymark will correct four visual and presentation problems in the unified homepage setup builder:

1. restore the privacy message as a compact pinned side note instead of a full-width blue panel;
2. make the live Floating demonstration a genuinely compact corner widget throughout the booking journey, rather than the full Inline experience inside a closable overlay;
3. replace the small service-scope radio rows with illustrated choice cards in a section that is clearly separate from the Floating/Inline layout section; and
4. replace the sparse live host-page placeholder with a credible, fuller fictional website.

The homepage demonstration will no longer use smart-home, camera-installation, or alarm-installation examples. Cedar House will become a fictional design-and-garden studio offering **Interior consultation** and **Garden planning**. The two services still prove Daymark's universal qualification rule because different people are eligible to deliver each service.

The existing setup-profile codes, explicit page-to-service mapping, workspace defaults, qualification rules, booking privacy guarantees, and no-write demonstration behavior remain unchanged.

## Goals

- Make the live Floating and Inline presentations visually and structurally distinct.
- Keep the entire Floating journey compact for Service, Person, Date, Time, Details, and completion.
- Return the privacy message to the original pinned-post-it character and side placement at wide widths.
- Give Full catalogue and This page's service the same visual clarity as the illustrated layout choices.
- Preserve the approved Daymark background artwork inside the two static layout cards only.
- Make the selected scope and layout immediately visible in the live demonstration and setup summary.
- Improve the host-site preview without copying Happy Smart Homes or introducing smart-home content.
- Preserve one interactive booking-flow instance so layout-only changes retain progress.
- Keep the restore tags, cold backup, and `.daymark/` immutable.

## Non-goals

- Paid booking, checkout, receipt, or payment-provider integration.
- Inferring a service from a website URL, page title, product handle, or scraped page content.
- Changing setup-profile version 2 codes, checksums, deep links, import confirmation, or workspace preference persistence.
- Changing production workspace services or rewriting a user's existing `.daymark/` data.
- Redesigning the protected workspace Embed builder or the public production booking page.
- Adding external stock photography, remote image requests, or another runtime dependency.
- Replacing or editing the approved Daymark widget background artwork.
- Upgrading Vinext.

## Demonstration identity and sample data

The public homepage and its deterministic local demonstration use a neutral service business rather than the earlier smart-home example.

### Host business

The fictional host remains **Cedar House**, presented as a small design-and-garden studio. This keeps the established browser-frame identity while making the host content and booking services agree.

### Demonstration services

- **Interior consultation** — 90 minutes; available with Maya Chen or Jon Bell.
- **Garden planning** — 120 minutes; available with Theo Brooks or Priya Shah.

Employee titles and biographies use corresponding design, space-planning, garden, and planting language. The public demo keys, IDs, slugs, categories, error copy, tests, and homepage labels use neutral replacements such as `interior` and `garden`; the public homepage must not render `smart home`, `camera installation`, or `alarm installation`.

This rename is limited to the deterministic homepage demo dataset and the homepage UI. It does not rename real services stored in workspaces, alter migrations, or rewrite unrelated lower-level test fixtures that intentionally exercise generic service identifiers.

## Setup controls and visual hierarchy

The setup builder remains one coordinated experience, but it is divided into two numbered visual sections instead of putting a small scope fieldset immediately above a large layout fieldset.

### Section 1: Choose the customer journey

The section heading explains what the customer sees first. It contains two large illustrated cards with comparable dimensions and interaction treatment:

#### Full catalogue card

The illustration shows a compact Daymark flow with two service cards leading to a smaller row of qualified people. Its copy explains that customers choose from all available services before Daymark filters the team.

#### This page's service card

The illustration shows a host service page passing one visibly selected service into Daymark, followed directly by qualified people. Its copy explains that the website supplies an explicit service mapping and the customer skips the catalogue step.

The illustrations are local HTML/CSS compositions rather than external imagery. Meaning remains available in the card heading and description when decorative visuals are unavailable.

Both cards remain visible for comparison, expose one keyboard-operable selection control, use a written **Selected** state, and do not rely on colour alone. Their containing fieldset retains the semantic legend **What should customers see?**.

When This page's service is selected, the neutral sample-service selector appears inside the journey section beneath the two cards. It offers Interior consultation and Garden planning and is explicitly labelled as demonstration-only. It does not become a third top-level setup section and is not transferred in the setup code.

### Section 2: Choose the placement

A separate heading, explanatory paragraph, border/background treatment, and spacing break introduce **How should the widget appear?**. The existing restored Floating and Inline illustration cards remain the basis of this section.

- The Daymark background artwork stays inside both layout cards.
- Floating continues to show the compact mini panel plus corner launcher.
- Inline continues to show the embedded mini booking section and no launcher.
- Selection controls and the visible selected treatment stay accessible.

The two sections may share Daymark typography, border, shadow, and selection primitives, but their illustrations communicate different decisions: journey cards explain **what starts the booking**, while layout cards explain **where booking appears**.

## Improved live host website

The live preview remains a fictional host website rather than a Daymark marketing panel. It uses the existing browser frame but replaces the sparse diagonal background and three empty labels with a compact editorial Cedar House page:

- a clear studio name and navigation;
- a strong hero statement about considered indoor and outdoor spaces;
- a restrained CSS-built project/material collage;
- short Interior and Garden service summaries; and
- a small proof or availability strip that makes the page feel inhabited.

The composition uses Daymark's palette, type, thin rules, paper surfaces, and offset-shadow language while remaining visually distinct from the booking UI. It uses no smart-home references, no remote content, and no Daymark background-art image.

Inline booking sits as a deliberate section after the host introduction. Floating booking remains layered in the lower corner while enough host-page content remains visible to demonstrate that it does not take over the site.

## Live Floating presentation

Floating initially shows only the upgraded host page and one **Book an appointment** corner launcher. Activating it hides the launcher and opens a compact labelled booking panel in the same corner.

### Compact throughout

Every stage remains inside the compact treatment:

- Service uses a short stacked list of service cards.
- Person uses compact specialist cards.
- Date and Time use horizontally or vertically scrollable compact choices.
- Details uses a single-column form with touch-friendly controls.
- Confirmation stays inside the same panel.

The compact booking body targets roughly 360–420px at desktop widths. It may grow only enough to accommodate the attached privacy note and safe internal spacing; it must never become the full-width Inline surface. Height is capped inside the host frame and the booking body scrolls internally when necessary.

The same `BookingFlow` state and transport power both layouts. Floating uses presentation-scoped classes and responsive styles rather than a second booking implementation, so qualification filtering, validation, conflict recovery, accessibility, and no-write completion cannot drift from Inline.

### Opening, closing, and layout changes

- Opening moves focus to the labelled compact panel.
- The panel provides a clear close control.
- Escape closes it while open.
- Closing returns focus to the launcher when the launcher remains mounted.
- The launcher and open panel never appear simultaneously.
- Switching only placement preserves the current booking step and entered demonstration data.
- Switching scope or sample service resets the demo under the existing approved rules and exposes a closed Floating panel so the reset is visible.

At narrow widths, Floating remains a contained compact sheet within the preview. It may use nearly the available width, but it keeps the compact typography, one-column flow, internal close control, and distinction from the document-flow Inline section.

## Live Inline presentation

Inline continues to show the full booking flow as part of the host page with no Floating launcher, dialog role, overlay close control, or corner-panel treatment.

The flow retains the coral date rail, full stage headings, wider cards, and embedded-section composition. It should begin close enough to the improved host introduction that both the host website and booking section are visible without a large empty interval.

There remains exactly one mounted `DemoBookingFlow`. Presentation changes alter its visual container and scoped layout rules without remounting its booking state.

## Privacy side note

The current live-preview override that forces `.privacy-note` into the booking column and stretches it across the surface is removed.

At wide widths:

- Inline restores the original approximately 200–230px third-column post-it beside the workbench.
- Floating uses a narrower approximately 150–180px pinned side note visually attached to the compact panel rather than a full-width block.
- Both retain the blue paper, coral pin, dark border, offset shadow, slight rotation, **The quiet part** eyebrow, privacy title, short explanation, and three assurance rows.

The note must not cover service cards, people, dates, times, fields, validation, buttons, or the Floating close control. It is non-interactive and remains outside the booking focus order.

When the preview is too narrow for safe side placement, the note moves below the booking workbench as a compact card. Rotation and overlap are removed on phones, safe side margins are used, and no horizontal page scrolling is introduced.

## Component boundaries

### `HomepageSetupBuilder`

The builder continues to own one shared draft. Its homepage-only sample key becomes neutral:

```ts
type HomepageSetupDraft = {
  journey: "catalogue" | "page-service";
  demoService: "interior" | "garden";
  layout: "floating" | "inline";
};
```

It coordinates journey, sample service, placement, live preview, summary, app URI, and portable code. The sample service still has no effect on the transfer profile.

### Journey choice component

A focused journey-card component owns only the two visual scope cards and their selection controls. Decorative preview primitives may be shared between the two cards, but the component does not own setup state or booking state.

### Layout choice component

`WidgetOptionsShowcase` remains the illustrated Floating/Inline selector. The accepted artwork and static miniatures remain decorative and never contain the live `DemoBookingFlow`.

### Host preview component

The browser-frame primitive remains shared. The live host-page component is expanded into the richer Cedar House studio composition. The artwork-bearing hero remains exclusive to the static layout chooser.

### Live presentation component

`WidgetLivePreview` continues to own only Floating open/closed state, focus return, Escape handling, presentation labels, and layout-scoped classes. It keeps its child at one stable React position.

### Booking flow

The production booking state machine and transport contract remain unchanged. Compact behavior is scoped to the homepage Floating presentation through wrapper classes and, only if required for semantic labelling, a small presentation prop that does not fork booking logic.

## Accessibility and responsive behavior

- Journey and placement remain semantic fieldsets with clear legends.
- Each large card has a visible heading, description, selection action, and written selected state.
- Decorative miniatures use `aria-hidden` and do not duplicate interactive controls.
- Selection changes are announced through the existing polite status mechanism.
- Floating retains an accessible launcher name, open-state relationship, labelled panel, keyboard close control, Escape handling, and focus return.
- Inline does not use dialog semantics.
- Compact controls retain at least the existing touch-target intent and visible focus treatment.
- Internal Floating scrolling does not trap keyboard focus; all stages remain reachable.
- Reduced-motion preferences continue to suppress nonessential transition and reveal motion.
- At narrow widths the control-card grids stack, the host preview remains legible, the privacy note moves below content, and no horizontal overflow is introduced.

## Error handling and safe fallbacks

- If a decorative journey illustration or approved layout artwork fails, headings and descriptions still explain the choice.
- An invalid sample demo key is prevented by the shared TypeScript type and deterministic selector.
- Demonstration transport errors remain local and use the existing booking error presentation.
- No scope or layout interaction sends a network write or creates an appointment.
- Setup codes and app links continue deriving only from journey plus layout.
- A real page-specific widget still requires explicit administrator mapping; no host-page copy is parsed or inferred.

## Test strategy

### Test-first regressions

Before production edits, add failing assertions that prove:

- the journey control renders two illustrated cards in a section separate from the two layout cards;
- both journey illustrations communicate their distinct start states;
- the homepage demo renders Interior consultation and Garden planning and contains no smart-home, Camera installation, or Alarm installation copy;
- Floating opens a compact presentation class and never exposes the Inline presentation at the same time;
- Floating and Inline still share one stateful booking-flow instance across layout changes;
- the live host page contains the richer Cedar House structure and no Daymark artwork image; and
- presentation-scoped CSS restores a small side privacy note instead of the current full-width override.

Run the focused tests once before implementation and record their expected failure.

### Component and interaction coverage

- Full catalogue begins at Service and filters Interior and Garden to their qualified people.
- This page's service begins at Person with the selected neutral service fixed.
- Changing the sample service resets the flow and announces the new service.
- Changing only layout preserves the active step and entered data.
- Floating initially shows only the launcher; opening, closing, Escape, focus movement, and focus return work.
- Every compact Floating stage remains usable and no appointment/network mutation occurs.
- Inline has no launcher or overlay close control.
- Journey cards, layout cards, setup summary, app URI, and portable code remain synchronized.

### Visual, build, and packaged-runtime verification

- Compare the privacy-note and layout-card treatment with the immutable restore references.
- Inspect journey cards, section separation, improved host page, Floating closed/open, and Inline at desktop and narrow widths.
- Complete both neutral service journeys in Floating and Inline.
- Confirm the privacy note stays beside content where space permits and moves safely below at narrow widths.
- Confirm no clipping, unintended overlap, horizontal page scroll, or simultaneous Floating/Inline presentation.
- Confirm the browser console has no link, hydration, runtime, or accessibility errors and the demonstration performs no booking write.
- Run the complete unit-test, lint, rendered-HTML, production-build, desktop, Rust, migration, installer-contract, and packaged-runtime gates used by the branch.
- Rebuild and restart the packaged runtime on port 3000, then repeat browser verification against the packaged output.

## Acceptance criteria

1. The service-scope decision appears as two large illustrated cards in its own clearly separated section.
2. The Floating/Inline decision remains a separate illustrated section with the approved Daymark artwork intact.
3. The public homepage demonstration contains no smart-home, Camera installation, or Alarm installation wording.
4. Interior consultation and Garden planning demonstrate different qualified people and durations.
5. The live Cedar House preview resembles a credible design-and-garden website rather than an empty geometric placeholder.
6. Floating opens as a compact corner booking panel and remains compact through every booking stage.
7. Floating never displays the full Inline booking surface inside its overlay.
8. Inline remains a full embedded booking section and never shows a Floating launcher.
9. The privacy message is a small pinned side note in both desktop presentations, with a safe compact fallback below content at narrow widths.
10. No booking control is hidden, covered, clipped, or made unreachable by the compact panel or privacy note.
11. Scope/sample changes reset safely; layout-only changes preserve booking progress.
12. Setup codes, native links, transfer behavior, page-specific mapping, workspace defaults, and production booking logic remain unchanged.
13. The demonstration creates no appointment and sends no customer data.
14. `.daymark/`, all restore tags, and the cold backup remain untouched by implementation, testing, packaging, and commits.
