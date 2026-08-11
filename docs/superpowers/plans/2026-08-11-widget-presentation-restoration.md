# Widget Presentation Restoration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restore the illustrated Floating and Inline choices, return their artwork to the chooser, and make the live demonstration show only the selected presentation.

**Architecture:** Keep HomepageSetupBuilder as the sole owner of journey, sample service, and layout. WidgetOptionsShowcase renders static comparison cards, WidgetPreviewChrome supplies shared Cedar House framing, and WidgetLivePreview owns only Floating open/closed state while retaining one stable DemoBookingFlow child. Layout changes alter visibility and CSS without changing the booking component's React identity.

**Tech Stack:** TypeScript 5.9, React 19, Vinext App Router, Vitest/jsdom, CSS, Wrangler packaged runtime, Windows PowerShell packaging checks.

## Global Constraints

- Work on `codex/homepage-setup-handoff`, starting from approved design commit `f51b1d1`.
- Treat `restore-2026-08-10-before-service-scope-builder` at `d41a95c511054c2d365f96b29f3049256a9d4862` as a read-only visual reference.
- Preserve `restore-2026-08-11-before-widget-visual-correction` at `d482c09cc2f2b3ba4e7147d06f657eb2cf58b301`.
- Never modify `C:/Users/Lloyd/Files/Daymark-restore-points/2026-08-10-before-service-scope-builder/.daymark`.
- Never manually edit, delete, stage, commit, or package `C:/Users/Lloyd/Files/Daymark/.daymark`. Normal migration writes made by the packaged runtime are permitted.
- Use `/daymark-widget-art-4x3-background-2x.png` only inside the two static choice cards.
- Keep exactly one interactive DemoBookingFlow. Static card miniatures remain decorative and inert.
- Floating starts closed. Its launcher and open overlay are never visible together. Inline never displays a launcher or dialog treatment.
- Preserve service scope, sample-service reset, qualification, duration, setup-code, native-link, transfer, import, Embed, and privacy behavior.
- Keep Vinext and pinned runtime dependencies unchanged.
- Follow red-green-refactor for each behavior change.
- Stage only explicit paths, inspect `git diff --check` and the staged diff before every commit, and leave `.daymark/` untracked.
- Update draft PR #3 only after review and verification. Do not merge, publish, release, or push an installer.

## File Structure

- Create `app/home/WidgetPreviewChrome.tsx`: shared browser frame, artwork choice hero, and artwork-free live backdrop.
- Modify `app/home/WidgetOptionsShowcase.tsx`: restored controlled two-card selector.
- Create `app/home/WidgetLivePreview.tsx`: one live booking flow presented as Floating or Inline.
- Modify `app/home/HomepageSetupBuilder.tsx`: wire chooser and preview to the existing shared draft.
- Modify `app/globals.css`: restore reference card styles and add exclusive live-mode rules.
- Modify `tests/homepage-showcase.test.tsx`: artwork placement and real-flow integration.
- Create `tests/widget-live-preview.test.tsx`: launcher, overlay, Escape, focus, Inline, and child identity.

---

## Task 1: Restore the illustrated chooser and separate its artwork

**Files:**

- Create: `app/home/WidgetPreviewChrome.tsx`
- Create: `app/home/WidgetLivePreview.tsx`
- Modify: `app/home/WidgetOptionsShowcase.tsx`
- Modify: `app/home/HomepageSetupBuilder.tsx`
- Modify: `app/globals.css:3230-3527`
- Modify: `tests/homepage-showcase.test.tsx`

**Interfaces:**

~~~ts
export type WidgetPlacement = "floating" | "inline";

export function WidgetOptionsShowcase(props: {
  selected: WidgetPlacement;
  onSelect: (placement: WidgetPlacement) => void;
}): JSX.Element;

export function WidgetLivePreview(props: {
  layout: WidgetPlacement;
  children: React.ReactNode;
}): JSX.Element;

export function WidgetHostBrowser(props: {
  children: React.ReactNode;
}): JSX.Element;

export function WidgetArtworkHero(props: {
  inline?: boolean;
}): JSX.Element;

export function WidgetNeutralHostPage(): JSX.Element;
~~~

- Consumes: current HomepageSetupDraft, chooseLayout, DemoBookingFlow, and local artwork.
- Produces: a controlled illustrated chooser and an artwork-free live shell.

- [ ] **Step 1: Add the failing artwork-placement regression**

Replace the one-artwork assertion in `tests/homepage-showcase.test.tsx` with:

~~~tsx
it("restores two illustrated layout choices and keeps artwork out of the live preview", async () => {
  const container = await renderBuilder();
  const choiceImages = container.querySelectorAll<HTMLImageElement>(
    '#widget-options .widget-choice img[src="/daymark-widget-art-4x3-background-2x.png"]',
  );
  const livePreview = container.querySelector<HTMLElement>(".widget-presentation");

  expect(container.querySelectorAll("#widget-options .widget-choice")).toHaveLength(2);
  expect(choiceImages).toHaveLength(2);
  expect(Array.from(choiceImages).every((image) => image.alt === "")).toBe(true);
  expect(container.querySelector(".widget-choice-floating .floating-panel")).not.toBeNull();
  expect(container.querySelector(".widget-choice-floating .widget-daymark-fab")).not.toBeNull();
  expect(container.querySelector(".widget-choice-inline .inline-panel")).not.toBeNull();
  expect(container.querySelector(".widget-choice-inline .widget-daymark-fab")).toBeNull();
  expect(livePreview?.querySelector(".widget-host-art")).toBeNull();
  expect(livePreview?.querySelector("img")).toBeNull();
  expect(container.querySelectorAll(".demo-booking-flow")).toHaveLength(1);
  expect(container.querySelectorAll(".widget-choice .demo-booking-flow")).toHaveLength(0);
});
~~~

Scope browser counts in the setup-region test:

~~~tsx
expect(container.querySelectorAll(
  "#widget-options .widget-choice .widget-host-browser",
)).toHaveLength(2);
expect(container.querySelectorAll(
  ".widget-presentation .widget-host-browser",
)).toHaveLength(1);
~~~

Add and use this layout helper instead of homepage-layout radio lookup:

~~~tsx
async function chooseLayoutCard(
  container: HTMLElement,
  layout: "floating" | "inline",
) {
  const button = container.querySelector<HTMLButtonElement>(
    ".widget-choice-" + layout + " .widget-choice-select",
  );
  expect(button).not.toBeNull();
  await act(async () => button?.click());
}
~~~

- [ ] **Step 2: Run the regression and confirm it fails**

~~~powershell
npm run unit -- tests/homepage-showcase.test.tsx
~~~

Expected: FAIL because no choice cards exist and the artwork is inside the live presentation.

- [ ] **Step 3: Extract shared host chrome**

Create WidgetPreviewChrome. Move the current HostBrowser markup into exported WidgetHostBrowser unchanged. Move current HostHero into exported WidgetArtworkHero unchanged, preserving the image source, exact crop, wordmark, tagline, loading, decoding, and empty alternative text.

Add the artwork-free live backdrop:

~~~tsx
export function WidgetNeutralHostPage() {
  return (
    <div className="widget-live-host-page" aria-hidden="true">
      <div className="widget-live-host-copy">
        <span className="widget-host-kicker">Considered spaces</span>
        <strong>Room to feel<br />at home.</strong>
        <p>A sample host page keeps its own identity while Daymark handles booking.</p>
      </div>
      <div className="widget-live-host-details">
        <span>INTERIORS</span>
        <span>PLANNING</span>
        <span>CARE</span>
      </div>
    </div>
  );
}
~~~

- [ ] **Step 4: Restore WidgetOptionsShowcase as the exact two-card selector**

Inspect the read-only source:

~~~powershell
git show restore-2026-08-10-before-service-scope-builder:app/home/WidgetOptionsShowcase.tsx
~~~

Restore both article bodies from that source. Floating must contain WidgetArtworkHero, widget-host-strip, floating-panel, people/slot rows, and decorative widget-daymark-fab. Inline must contain inline WidgetArtworkHero and inline-panel with rail, heading, and four-person grid. Import WidgetHostBrowser and WidgetArtworkHero from WidgetPreviewChrome.

Use this complete controlled component body after importing WidgetHostBrowser and WidgetArtworkHero:

~~~tsx
export function WidgetOptionsShowcase({
  selected,
  onSelect,
}: {
  selected: WidgetPlacement;
  onSelect: (placement: WidgetPlacement) => void;
}) {
  return (
    <div className="widget-choice-grid" aria-label="Widget presentation options">
      <article className={"widget-choice widget-choice-floating" + (
        selected === "floating" ? " is-selected" : ""
      )}>
        <div className="widget-host-page" aria-hidden="true">
          <WidgetHostBrowser>
            <WidgetArtworkHero />
            <div className="widget-host-strip" />
            <div className="floating-panel">
              <span className="widget-preview-eyebrow">DAYMARK · BOOKING</span>
              <strong>Who would you<br />like to meet?</strong>
              <div className="widget-person-row">
                <span className="active">Maya</span><span>Theo</span><span>Priya</span>
              </div>
              <div className="widget-slot-row">
                <span>10:30</span><span>13:00</span><span>15:30</span>
              </div>
            </div>
            <div className="widget-daymark-fab"><span>D</span>Book an appointment</div>
          </WidgetHostBrowser>
        </div>
        <div className="widget-choice-copy">
          <span className="widget-choice-label">Option A · Floating</span>
          <h3 id="floating-widget-title">Always close, never in the way</h3>
          <p id="floating-widget-description">
            A compact corner button opens the booking panel over any page.
            Best when booking should be available site-wide.
          </p>
          <button
            className="widget-choice-select"
            type="button"
            aria-pressed={selected === "floating"}
            aria-labelledby="floating-widget-title"
            aria-describedby="floating-widget-description"
            onClick={() => onSelect("floating")}
          >
            {selected === "floating" ? "Selected" : "Choose this layout"}
          </button>
        </div>
      </article>

      <article className={"widget-choice widget-choice-inline" + (
        selected === "inline" ? " is-selected" : ""
      )}>
        <div className="widget-host-page" aria-hidden="true">
          <WidgetHostBrowser>
            <WidgetArtworkHero inline />
            <div className="inline-panel">
              <div className="inline-rail"><strong>DAYMARK</strong><span>01 / 03</span></div>
              <div className="inline-main">
                <div className="inline-head">
                  <div>
                    <span className="widget-preview-eyebrow">BOOK THE RIGHT PERSON</span>
                    <strong>Choose your person.</strong>
                  </div>
                  <span>PERSON → DATE → TIME</span>
                </div>
                <div className="inline-grid">
                  <span>PLANNING<b>Maya</b></span>
                  <span>DESIGN<b>Theo</b></span>
                  <span>CARE<b>Priya</b></span>
                  <span>DETAILS<b>Jon</b></span>
                </div>
              </div>
            </div>
          </WidgetHostBrowser>
        </div>
        <div className="widget-choice-copy">
          <span className="widget-choice-label">Option B · Inline</span>
          <h3 id="inline-widget-title">A booking section with presence</h3>
          <p id="inline-widget-description">
            The full panel sits inside a page and feels intentional.
            Best for a dedicated contact or book-now section.
          </p>
          <button
            className="widget-choice-select"
            type="button"
            aria-pressed={selected === "inline"}
            aria-labelledby="inline-widget-title"
            aria-describedby="inline-widget-description"
            onClick={() => onSelect("inline")}
          >
            {selected === "inline" ? "Selected" : "Choose this layout"}
          </button>
        </div>
      </article>
    </div>
  );
}
~~~

No backup checkout or modification is allowed.

- [ ] **Step 5: Create the artwork-free live shell**

Create WidgetLivePreview. Floating is closed in this increment; Task 2 makes its launcher interactive.

~~~tsx
"use client";

import type { ReactNode } from "react";
import type { WidgetPlacement } from "./WidgetOptionsShowcase";
import { WidgetHostBrowser, WidgetNeutralHostPage } from "./WidgetPreviewChrome";

export function WidgetLivePreview({
  layout,
  children,
}: {
  layout: WidgetPlacement;
  children: ReactNode;
}) {
  const label = layout === "floating" ? "Floating widget" : "Inline widget";
  return (
    <div className="widget-presentation" data-layout={layout}>
      <p className="widget-presentation-label">
        <span>Live Cedar House preview</span>
        <strong>{label} selected</strong>
      </p>
      <WidgetHostBrowser>
        <WidgetNeutralHostPage />
        <div
          id="widget-live-booking"
          className="widget-live-surface"
          hidden={layout === "floating"}
        >
          {children}
        </div>
        {layout === "floating" ? (
          <div className="widget-daymark-fab widget-live-launcher" aria-hidden="true">
            <span>D</span> Book an appointment
          </div>
        ) : null}
      </WidgetHostBrowser>
    </div>
  );
}
~~~

- [ ] **Step 6: Wire chooser and preview to the existing draft**

Replace only the layout rows and current preview call:

~~~tsx
<fieldset className="homepage-option-group homepage-layout-options">
  <legend>How should the widget appear?</legend>
  <WidgetOptionsShowcase selected={draft.layout} onSelect={chooseLayout} />
</fieldset>

<WidgetLivePreview layout={draft.layout}>
  <DemoBookingFlow journey={draft.journey} demoService={draft.demoService} />
</WidgetLivePreview>
~~~

Do not alter INITIAL_DRAFT, setup-profile encoding, journey/sample handlers, or transfer markup.

- [ ] **Step 7: Restore reference card CSS and add neutral live styling**

Copy the complete checked-in selector block from `.widget-choice-grid` through `.widget-choice-select[aria-pressed="true"]` in the read-only tag. This includes widget-host-page, floating-panel, people/slot rows, inline-panel, inline-rail, inline-main, inline-head, and inline-grid. Keep wordmark/crop declarations exact.

Add:

~~~css
.homepage-scope-options { background: var(--paper-deep); }
.homepage-sample-options { background: #f8ded5; }
.homepage-layout-options {
  grid-column: 1 / -1;
  background: #dce7d5;
}
.homepage-layout-options .widget-choice-grid { margin-top: 0.35rem; }

.widget-live-host-page {
  min-height: clamp(420px, 48vw, 620px);
  display: grid;
  grid-template-columns: minmax(0, 0.8fr) minmax(220px, 1.2fr);
  align-items: start;
  gap: clamp(1.5rem, 5vw, 5rem);
  padding: clamp(2rem, 5vw, 4rem);
  background: linear-gradient(135deg, var(--paper-light) 0 62%, var(--paper-deep) 62% 100%);
}
.widget-live-host-copy > strong {
  display: block;
  margin: 0.55rem 0;
  font-family: var(--font-display), Georgia, serif;
  font-size: clamp(2rem, 4vw, 4rem);
  font-weight: 520;
  letter-spacing: -0.05em;
  line-height: 0.92;
}
.widget-live-host-copy p { max-width: 280px; color: var(--ink-soft); line-height: 1.55; }
.widget-live-host-details { display: grid; gap: 0.7rem; }
.widget-live-host-details span {
  min-height: 80px;
  display: grid;
  place-items: center;
  border: 1px solid var(--rule);
  background: var(--paper-light);
  color: var(--ink-soft);
  font-size: 0.58rem;
  font-weight: 850;
  letter-spacing: 0.12em;
}
.widget-live-surface[hidden] { display: none; }
~~~

At 850px stack widget-choice-grid. At 520px retain the reference host-art, floating-miniature, inline-miniature, and two-column inline-grid rules.

- [ ] **Step 8: Rerun focused gates and commit**

~~~powershell
npm run unit -- tests/homepage-showcase.test.tsx
npm run lint -- --quiet
git diff --check
~~~

Expected: PASS with two chooser images, no live image, and one DemoBookingFlow.

~~~powershell
git add -- app/home/WidgetPreviewChrome.tsx app/home/WidgetLivePreview.tsx app/home/WidgetOptionsShowcase.tsx app/home/HomepageSetupBuilder.tsx app/globals.css tests/homepage-showcase.test.tsx
git diff --cached --check
git diff --cached
git commit -m "Restore illustrated widget layout choices"
~~~

---

## Task 2: Make Floating and Inline mutually exclusive interactive presentations

**Files:**

- Create: `tests/widget-live-preview.test.tsx`
- Modify: `app/home/WidgetLivePreview.tsx`
- Modify: `app/globals.css:3458-3617`
- Modify: `tests/homepage-showcase.test.tsx`

**Interfaces:**

- Consumes: WidgetLivePreview from Task 1 and its stable DemoBookingFlow child.
- Produces: `#widget-live-booking`, `.widget-live-launcher`, `.widget-live-close`, and exclusive closed-Floating/open-Floating/Inline states.

- [ ] **Step 1: Write failing isolated interaction tests**

Create `tests/widget-live-preview.test.tsx` using the repository's React DOM/jsdom setup. Use this stateful harness:

~~~tsx
function StatefulProbe() {
  const [step, setStep] = useState(1);
  return (
    <button type="button" className="stateful-probe" onClick={() => setStep(2)}>
      Step {step}
    </button>
  );
}

function PreviewHarness() {
  const [layout, setLayout] = useState<WidgetPlacement>("floating");
  return (
    <>
      <button type="button" onClick={() => setLayout("floating")}>Use Floating</button>
      <button type="button" onClick={() => setLayout("inline")}>Use Inline</button>
      <WidgetLivePreview layout={layout}><StatefulProbe /></WidgetLivePreview>
    </>
  );
}
~~~

The first test asserts the exclusive Floating lifecycle:

~~~tsx
const surface = container.querySelector<HTMLElement>("#widget-live-booking")!;
const launcher = container.querySelector<HTMLButtonElement>(".widget-live-launcher")!;

expect(surface.hidden).toBe(true);
expect(launcher.hidden).toBe(false);
await click(launcher);
expect(surface.hidden).toBe(false);
expect(surface.getAttribute("role")).toBe("dialog");
expect(launcher.hidden).toBe(true);
expect(document.activeElement).toBe(container.querySelector(".widget-live-close"));

await keyDown(surface, "Escape");
expect(surface.hidden).toBe(true);
expect(launcher.hidden).toBe(false);
expect(document.activeElement).toBe(launcher);
~~~

The second test opens Floating, advances StatefulProbe to Step 2, switches Inline, then switches back to Floating and reopens. It must prove Step 2 survives; Inline has no launcher, close button, or dialog role; returning to Floating starts closed. Wrap events in act and unmount the root after each test.

- [ ] **Step 2: Run the isolated test and confirm it fails**

~~~powershell
npm run unit -- tests/widget-live-preview.test.tsx
~~~

Expected: FAIL because the launcher is decorative, cannot open the surface, and no close/Escape/focus behavior exists.

- [ ] **Step 3: Implement local open/close and focus state**

Import useEffect, useRef, and useState. Keep children at one unconditional DOM location.

~~~tsx
const [floatingOpen, setFloatingOpen] = useState(false);
const launcherRef = useRef<HTMLButtonElement>(null);
const closeRef = useRef<HTMLButtonElement>(null);
const restoreLauncherFocus = useRef(false);
const floating = layout === "floating";

useEffect(() => {
  if (!floating) setFloatingOpen(false);
}, [floating]);

useEffect(() => {
  if (!floating) return;
  if (floatingOpen) {
    closeRef.current?.focus();
  } else if (restoreLauncherFocus.current) {
    restoreLauncherFocus.current = false;
    launcherRef.current?.focus();
  }
}, [floating, floatingOpen]);

function openFloating() {
  restoreLauncherFocus.current = false;
  setFloatingOpen(true);
}

function closeFloating() {
  restoreLauncherFocus.current = true;
  setFloatingOpen(false);
}

const bookingVisible = !floating || floatingOpen;
~~~

Render the stable surface and exclusive launcher:

~~~tsx
<div
  id="widget-live-booking"
  className="widget-live-surface"
  hidden={!bookingVisible}
  role={floating ? "dialog" : undefined}
  aria-labelledby={floating ? "widget-live-dialog-title" : undefined}
  onKeyDown={(event) => {
    if (floating && floatingOpen && event.key === "Escape") {
      event.preventDefault();
      closeFloating();
    }
  }}
>
  {floating ? (
    <div className="widget-live-dialog-head">
      <strong id="widget-live-dialog-title">Book with Daymark</strong>
      <button
        ref={closeRef}
        className="widget-live-close"
        type="button"
        onClick={closeFloating}
      >
        Close booking
      </button>
    </div>
  ) : null}
  {children}
</div>

{floating ? (
  <button
    ref={launcherRef}
    className="widget-daymark-fab widget-live-launcher"
    type="button"
    aria-controls="widget-live-booking"
    aria-expanded={floatingOpen}
    hidden={floatingOpen}
    onClick={openFloating}
  >
    <span aria-hidden="true">D</span> Book an appointment
  </button>
) : null}
~~~

Do not add layout to DemoBookingFlow, its reset key, or a React key. Do not conditionally render children.

- [ ] **Step 4: Replace mixed live CSS with overlay/inline rules**

Keep current booking-studio sizing, but replace the negative-margin Floating surface and the narrow static fallback:

~~~css
.widget-presentation .widget-host-browser {
  min-height: clamp(560px, 62vw, 780px);
  border-color: var(--ink);
  background: var(--paper-light);
}
.widget-live-surface {
  z-index: 4;
  min-width: 0;
  border: 1px solid var(--ink);
  background: var(--paper-light);
}
.widget-presentation[data-layout="floating"] .widget-live-surface {
  position: absolute;
  inset: clamp(3.5rem, 7vw, 5.5rem) clamp(1rem, 4vw, 3.5rem) clamp(1rem, 4vw, 3rem);
  border-radius: 18px;
  box-shadow: 0 24px 60px rgba(23, 39, 34, 0.3);
  overflow: auto;
}
.widget-presentation[data-layout="inline"] .widget-live-surface {
  position: relative;
  margin: 0 clamp(0.8rem, 2.5vw, 2rem) clamp(1rem, 3vw, 2.5rem);
  box-shadow: 6px 6px 0 var(--ink);
}
.widget-live-dialog-head {
  position: sticky;
  top: 0;
  z-index: 6;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  padding: 0.8rem 1rem;
  border-bottom: 1px solid var(--rule);
  background: var(--paper-deep);
}
.widget-live-close {
  min-height: 40px;
  border: 1px solid var(--ink);
  padding: 0.55rem 0.75rem;
  background: var(--paper-light);
  color: var(--ink);
  cursor: pointer;
  font: inherit;
  font-size: 0.68rem;
  font-weight: 850;
}
.widget-live-close:focus-visible,
.widget-live-launcher:focus-visible {
  outline: 4px solid var(--coral);
  outline-offset: 3px;
}
.widget-live-launcher { border: 0; cursor: pointer; font: inherit; }
~~~

At 520px Floating remains a contained overlay sheet and Inline remains in document flow:

~~~css
.widget-presentation[data-layout="floating"] .widget-live-surface {
  inset: 3.25rem 0.5rem 0.5rem;
  width: auto;
  margin: 0;
  border-radius: 12px;
  overflow: auto;
}
.widget-presentation[data-layout="inline"] .widget-live-surface {
  width: auto;
  margin: 0 0.25rem 1rem;
  border-radius: 0;
  box-shadow: 4px 4px 0 var(--ink);
}
.widget-live-host-page {
  grid-template-columns: 1fr;
  min-height: 500px;
  padding: 1.25rem;
}
.widget-live-host-details { grid-template-columns: repeat(3, 1fr); }
~~~

Delete the existing mobile rule that moves widget-daymark-fab into normal document flow.

- [ ] **Step 5: Exercise the real booking flow only after opening it**

Update the homepage progress test:

~~~tsx
await clickButton(container, "Book an appointment", ".widget-live-launcher");
await clickButton(container, "Camera installation", ".service-choice-card");
expect(container.textContent).toContain("Who should deliver this service?");

await chooseLayoutCard(container, "inline");
expect(container.querySelector<HTMLElement>("#widget-live-booking")?.hidden).toBe(false);
expect(container.querySelector(".widget-live-launcher")).toBeNull();
expect(container.textContent).toContain("Maya Chen");
expect(container.textContent).toContain("Jon Bell");

await chooseLayoutCard(container, "floating");
expect(container.querySelector<HTMLElement>("#widget-live-booking")?.hidden).toBe(true);
await clickButton(container, "Book an appointment", ".widget-live-launcher");
expect(container.textContent).toContain("Who should deliver this service?");
expect(container.querySelectorAll(".demo-booking-flow")).toHaveLength(1);
~~~

After each Floating transition, assert that either launcher or surface is hidden. Retain scope/sample reset and all profile-code tests.

- [ ] **Step 6: Rerun focused and production gates**

~~~powershell
npm run unit -- tests/widget-live-preview.test.tsx tests/homepage-showcase.test.tsx tests/widget-integration.test.tsx tests/booking-flow.test.ts
npm run lint -- --quiet
npm test
git diff --check
~~~

Expected: PASS. Rendered HTML retains ordinary internal links and both homepage anchors.

- [ ] **Step 7: Commit the exclusive presentation**

~~~powershell
git add -- tests/widget-live-preview.test.tsx app/home/WidgetLivePreview.tsx app/globals.css tests/homepage-showcase.test.tsx
git diff --cached --check
git diff --cached
git commit -m "Separate floating and inline widget previews"
~~~

---

## Task 3: Review, visually verify, rebuild the packaged runtime, and update GitHub

**Files:**

- Modify only when fresh review or browser evidence demonstrates a defect: Task 1-2 files.
- Store transient screenshots only in ignored evidence locations.

**Interfaces:**

- Consumes: implementation commits, the approved spec, draft PR #3, and the runtime on 127.0.0.1:3000.
- Produces: reviewed commits, complete gate evidence, rebuilt healthy runtime, browser evidence, and an updated draft PR.

- [ ] **Step 1: Request implementation review**

Invoke `superpowers:requesting-code-review` for `f51b1d1..HEAD`. Review all twelve acceptance criteria, especially hidden focusability, child remounting, duplicate booking surfaces, narrow overlay behavior, and business-logic drift.

For every verified issue, write a failing regression first, apply the smallest fix, and rerun affected tests. Commit actual fixes as:

~~~powershell
git commit -m "Complete widget presentation restoration"
~~~

Do not create an empty commit.

- [ ] **Step 2: Run the complete repository matrix**

~~~powershell
npm run unit
npm run lint
npm test
npm --prefix desktop/daymark-control test -- --run
npm --prefix desktop/daymark-control run build
cargo test --manifest-path desktop/daymark-control/src-tauri/Cargo.toml
powershell.exe -NoProfile -ExecutionPolicy Bypass -File tests/windows/installer-contract.test.ps1
git diff --check
~~~

Expected: every command exits 0. Diagnose any failure before classifying it as unrelated.

- [ ] **Step 3: Rebuild and inspect the Windows runtime**

~~~powershell
npm run windows:stage
npm run windows:verify-runtime
npm run windows:test-staged-migration
~~~

Require the stage to include the updated production build and `0006_service_scope_widget_defaults.sql`, but no .daymark data, setup code, credential, log, or cold-backup content.

- [ ] **Step 4: Restart the packaged runtime on port 3000**

Send `stop` to the retained runtime terminal. If it no longer exists, inspect the port owner and stop it only after its command line proves it belongs to this Daymark workspace. Confirm port 3000 is free.

Start the staged runtime with the inherited protected setup-code environment, without printing it:

~~~powershell
& 'C:/Users/Lloyd/Files/Daymark/artifacts/windows-stage/node/node.exe' --import tsx 'C:/Users/Lloyd/Files/Daymark/artifacts/windows-stage/runtime/local/cli.ts' start --app-dir 'C:/Users/Lloyd/Files/Daymark/artifacts/windows-stage' --data-dir 'C:/Users/Lloyd/Files/Daymark/.daymark/data' --backup-dir 'C:/Users/Lloyd/Files/Daymark/.daymark/backups' --log-dir 'C:/Users/Lloyd/Files/Daymark/.daymark/logs' --host 127.0.0.1 --port 3000
~~~

Wait for:

~~~json
{"status":"ok","appVersion":"0.1.1","latestMigration":"0006_service_scope_widget_defaults.sql"}
~~~

- [ ] **Step 5: Browser-verify the chooser at desktop and narrow widths**

Read and invoke `browser:control-in-app-browser`. At `http://localhost:3000/#widget-options`, verify:

1. Floating and Inline each show a full illustrated card.
2. Both cards contain the original artwork with correct crop and wordmark placement.
3. Floating's miniature has a launcher composition; Inline's has an embedded section and no launcher.
4. Selected styling uses restored borders, offset shadow, accent, and visible Selected text.
5. Scope controls retain their styling and behavior.
6. Cards stack without clipping or horizontal overflow at narrow width.

- [ ] **Step 6: Browser-verify all live states**

At `http://localhost:3000/`, verify:

1. Floating closed shows a neutral Cedar House page and one launcher, with no booking surface or Daymark artwork.
2. Clicking the launcher hides it, opens one overlay, and focuses Close booking.
3. Escape closes the overlay and returns focus to the launcher.
4. Inline shows one embedded booking section with no launcher or overlay close control.
5. Select Camera, reach Person, switch Inline, then Floating and reopen; Camera, Person, Maya, and Jon remain.
6. Changing service scope or sample service still resets with the approved announcement and focus.
7. Desktop and narrow views contain the overlay, preserve focus rings, and avoid horizontal overflow.
8. Console/network inspection shows no link error, uncaught error, appointment creation, or unexpected mutation.

If visual evidence reveals a defect, add a regression where feasible, make the minimum correction, rerun relevant and full gates, rebuild/restart, and repeat the affected browser state.

- [ ] **Step 7: Audit protected data and restore points**

~~~powershell
git status --short
git diff --stat f51b1d1..HEAD
git diff --name-only --cached
git ls-files -- .daymark
git rev-parse "restore-2026-08-10-before-service-scope-builder^{}"
git rev-parse "restore-2026-08-11-before-widget-visual-correction^{}"
~~~

Require .daymark to remain untracked, the tags to resolve to the exact two hashes, no backup/artifact/log/secret/database to be staged, and only planned visual/test/docs paths to differ.

- [ ] **Step 8: Verify completion and update draft PR #3**

Invoke `superpowers:verification-before-completion` with fresh command and browser evidence. Push `codex/homepage-setup-handoff` and update draft PR #3 with restore points, behavior summary, full gates, runtime health, browser desktop/narrow/focus/console/network results, and confirmation that .daymark remains untracked.

Do not merge, publish an installer, create a release, or push generated runtime artifacts.
