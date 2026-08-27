# Compact Widget and Homepage Preview Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild the homepage setup experience so journey choices are illustrated and separate, the Cedar House host feels credible, Floating stays compact throughout booking, and the privacy message returns to a small pinned side note.

**Architecture:** Keep `HomepageSetupBuilder` as the sole owner of journey, sample-service, and placement state and keep one stable `DemoBookingFlow` child. Add a focused `ServiceScopeShowcase` for the two journey cards, expand the artwork-free Cedar House host primitive, and apply compact versus inline layout only through presentation-scoped classes around the existing booking state machine. Rename only the deterministic public homepage demo data; setup profiles, workspace persistence, production services, and booking APIs remain unchanged.

**Tech Stack:** TypeScript 5.9, React 19, Vinext App Router, Vitest/jsdom, CSS Grid/Flexbox, Node.js tests, Wrangler packaged runtime, Windows PowerShell packaging checks.

## Global Constraints

- Work on `codex/homepage-setup-handoff`, starting implementation after approved design commit `344ceab`.
- Preserve `restore-2026-08-14-before-compact-widget-rebuild` at `4155fe66c29dfb892bfb83b2f692f6f3aa5e11c9` locally and on GitHub.
- Treat `restore-2026-08-10-before-service-scope-builder` at `d41a95c511054c2d365f96b29f3049256a9d4862` and `restore-2026-08-11-before-widget-visual-correction` at `d482c09cc2f2b3ba4e7147d06f657eb2cf58b301` as immutable references.
- Never modify `C:/Users/Lloyd/Files/Daymark-restore-points/2026-08-10-before-service-scope-builder/.daymark`.
- Never manually edit, delete, stage, commit, or package `C:/Users/Lloyd/Files/Daymark/.daymark`. Normal writes made by the packaged runtime through its existing data paths are permitted.
- The public homepage and deterministic demo must render **Interior consultation** and **Garden planning**, never smart-home, Camera installation, or Alarm installation copy.
- Interior consultation remains 90 minutes with Maya Chen and Jon Bell; Garden planning remains 120 minutes with Theo Brooks and Priya Shah.
- Do not rename or rewrite real workspace services, migrations, production booking APIs, or unrelated service fixtures.
- Use `/daymark-widget-art-4x3-background-2x.png` only in the two static Floating/Inline layout cards. Do not add remote images or another image dependency.
- Keep exactly one interactive `DemoBookingFlow`; decorative journey/layout miniatures remain inert.
- Floating starts closed, stays compact through every stage, and never appears with its launcher at the same time. Inline never displays a launcher, dialog header, or compact overlay treatment.
- Keep the privacy note beside booking controls at safe desktop widths and move it below controls without rotation or overlap at narrow widths.
- Preserve setup-profile codes, native links, explicit page-to-service mapping, workspace defaults, qualification filtering, booking validation, and no-write demonstration behavior.
- Keep Vinext and all pinned runtime dependencies unchanged.
- Follow red-green-refactor for every behavior change.
- Stage only explicit paths, inspect `git diff --check` and the staged diff before every commit, and leave `.daymark/` untracked.
- Update draft PR #3 after complete verification. Do not merge, publish an installer, create a release, or push generated runtime artifacts.

## File Structure

- Create `app/home/ServiceScopeShowcase.tsx`: semantic, illustrated Full catalogue and This page's service selector plus the conditional neutral sample-service controls.
- Modify `lib/booking/demo.ts`: neutral deterministic homepage services, specialists, IDs, slugs, eligibility, and safe error wording.
- Modify `app/demo/DemoBookingFlow.tsx`: neutral default sample key while retaining the existing booking flow and reset behavior.
- Modify `app/home/HomepageSetupBuilder.tsx`: use the journey showcase, retain shared draft ownership, and wrap layout choices in a clearly separate placement section.
- Modify `app/home/WidgetPreviewChrome.tsx`: preserve chooser artwork primitives and replace the sparse live host placeholder with the richer Cedar House studio page.
- Modify `app/home/WidgetLivePreview.tsx`: expose explicit compact/inline surface classes without changing the child's React identity or Floating focus behavior.
- Modify `app/globals.css`: journey-card illustrations, section hierarchy, richer host page, compact Floating flow, full Inline flow, side privacy notes, and responsive fallbacks.
- Modify `tests/booking-transport.test.ts`: neutral deterministic dataset, eligibility, duration, no-write, and error contracts.
- Modify `tests/homepage-showcase.test.tsx`: illustrated journey hierarchy, neutral homepage copy, selected-state synchronization, richer host, and integrated layout behavior.
- Modify `tests/widget-live-preview.test.tsx`: compact/inline class exclusivity, focus behavior, child identity, and stylesheet layout contracts.
- Modify `docs/superpowers/specs/2026-08-14-compact-widget-homepage-redesign-design.md`: mark the user-reviewed design Approved.

---

### Task 1: Replace the smart-home homepage demonstration with neutral services

**Files:**

- Modify: `lib/booking/demo.ts`
- Modify: `app/demo/DemoBookingFlow.tsx`
- Modify: `app/home/HomepageSetupBuilder.tsx`
- Modify: `tests/booking-transport.test.ts`
- Modify: `tests/homepage-showcase.test.tsx`
- Modify: `tests/widget-live-preview.test.tsx`

**Interfaces:**

```ts
export type DemoServiceKey = "interior" | "garden";

export function demoScenario(serviceKey: DemoServiceKey): {
  service: PublicService;
  employees: PublicEmployee[];
};
```

- Consumes: the existing deterministic `BookingTransport`, `BookingFlow`, and shared homepage draft.
- Produces: neutral demo keys and data used by later journey-card and host-preview tasks.

- [ ] **Step 1: Write the failing neutral-data regressions**

Replace only the demonstration-data expectations at the top of `tests/booking-transport.test.ts` with:

```ts
it.each([
  ["interior", "Interior consultation", 90, ["Maya Chen", "Jon Bell"]],
  ["garden", "Garden planning", 120, ["Theo Brooks", "Priya Shah"]],
] as const)("selects the canonical %s demonstration scenario", (
  key,
  serviceName,
  durationMinutes,
  employeeNames,
) => {
  const scenario = demoScenario(key);

  expect(scenario.service).toMatchObject({ name: serviceName, durationMinutes });
  expect(scenario.employees.map((employee) => employee.publicName)).toEqual(employeeNames);
});

it("offers the exact neutral catalogue and service-qualified specialists", async () => {
  expect(DEMO_SERVICES.map(({ id, durationMinutes }) => ({ id, durationMinutes }))).toEqual([
    { id: "service-demo-interior-consultation", durationMinutes: 90 },
    { id: "service-demo-garden-planning", durationMinutes: 120 },
  ]);
  expect((await demoBookingTransport.loadEmployees("service-demo-interior-consultation"))
    .map((employee) => employee.publicName)).toEqual(["Maya Chen", "Jon Bell"]);
  expect((await demoBookingTransport.loadEmployees("service-demo-garden-planning"))
    .map((employee) => employee.publicName)).toEqual(["Theo Brooks", "Priya Shah"]);
});
```

Update the demonstration-only table rows and local constants in that describe block to use:

```ts
["service-demo-interior-consultation", "maya-chen", "Interior consultation", 90]
["service-demo-garden-planning", "theo-brooks", "Garden planning", 120]
```

Add this regression to `tests/homepage-showcase.test.tsx`:

```tsx
it("uses a neutral public demonstration without smart-home installation copy", async () => {
  const container = await renderBuilder();
  const text = container.textContent ?? "";

  expect(text).toContain("Interior consultation");
  expect(text).toContain("Garden planning");
  expect(text).not.toMatch(/smart home|camera installation|alarm installation/i);
});
```

- [ ] **Step 2: Run the focused tests and verify they fail for the old dataset**

Run:

```powershell
npm run unit -- tests/booking-transport.test.ts tests/homepage-showcase.test.tsx tests/widget-live-preview.test.tsx
```

Expected: FAIL because `DemoServiceKey`, service names/IDs, homepage defaults, reset keys, and assertions still use `camera` and `alarm`.

- [ ] **Step 3: Replace the deterministic demonstration data**

Change the demonstration constants in `lib/booking/demo.ts` to:

```ts
export type DemoServiceKey = "interior" | "garden";

export const DEMO_SERVICES: PublicService[] = [
  {
    id: "service-demo-interior-consultation",
    slug: "interior-consultation",
    name: "Interior consultation",
    category: "Design consultation",
    description: "Plan a thoughtful room with a Cedar House specialist.",
    durationMinutes: 90,
  },
  {
    id: "service-demo-garden-planning",
    slug: "garden-planning",
    name: "Garden planning",
    category: "Outdoor spaces",
    description: "Shape a practical planting and layout plan for your garden.",
    durationMinutes: 120,
  },
];

export const DEMO_EMPLOYEES: PublicEmployee[] = [
  { id: "maya-chen", publicName: "Maya Chen", title: "Interior designer", bio: "Calm, practical room planning with a material-led approach.", accent: "coral" },
  { id: "theo-brooks", publicName: "Theo Brooks", title: "Garden designer", bio: "Outdoor layouts designed around daily life and the seasons.", accent: "sage" },
  { id: "priya-shah", publicName: "Priya Shah", title: "Planting specialist", bio: "Resilient planting plans with texture, colour, and year-round interest.", accent: "lilac" },
  { id: "jon-bell", publicName: "Jon Bell", title: "Space planning consultant", bio: "Clear room layouts and a friendly, practical design walkthrough.", accent: "ochre" },
];

const ELIGIBLE_EMPLOYEE_IDS: Record<string, readonly string[]> = {
  "service-demo-interior-consultation": ["maya-chen", "jon-bell"],
  "service-demo-garden-planning": ["theo-brooks", "priya-shah"],
};

const DEMO_SERVICE_IDS: Record<DemoServiceKey, string> = {
  interior: "service-demo-interior-consultation",
  garden: "service-demo-garden-planning",
};
```

Change the ineligible-person error in `requireEligibleEmployee` to `"That specialist is not available for this service."`.

- [ ] **Step 4: Update homepage defaults, labels, reset keys, and assertions**

Use `DemoServiceKey` from `lib/booking/demo.ts` in `HomepageSetupBuilder`, set `INITIAL_DRAFT.demoService` to `"interior"`, and replace the two sample choices with:

```tsx
<SetupOption
  checked={draft.demoService === "interior"}
  description="90 minutes · Maya and Jon"
  name="homepage-demo-service"
  onChange={() => chooseDemoService("interior")}
  title="Interior consultation"
  value="interior"
/>
<SetupOption
  checked={draft.demoService === "garden"}
  description="120 minutes · Theo and Priya"
  name="homepage-demo-service"
  onChange={() => chooseDemoService("garden")}
  title="Garden planning"
  value="garden"
/>
```

Set the default in `DemoBookingFlow` to `"interior"`. Replace demonstration-only `camera`/`alarm` reset keys and public-copy assertions in `tests/homepage-showcase.test.tsx` and `tests/widget-live-preview.test.tsx` with `interior`/`garden` and the exact names above. Do not change live-transport, repository, workspace, migration, import, or API fixtures outside the deterministic homepage-demo describe blocks.

- [ ] **Step 5: Run the neutral-data regressions and public-copy scan**

Run:

```powershell
npm run unit -- tests/booking-transport.test.ts tests/homepage-showcase.test.tsx tests/widget-live-preview.test.tsx
rg -n -i "smart home|camera installation|alarm installation" app/home app/demo lib/booking/demo.ts
```

Expected: tests PASS and the ripgrep command returns no matches in the public homepage/demo paths.

- [ ] **Step 6: Commit the neutral demonstration**

```powershell
git add -- lib/booking/demo.ts app/demo/DemoBookingFlow.tsx app/home/HomepageSetupBuilder.tsx tests/booking-transport.test.ts tests/homepage-showcase.test.tsx tests/widget-live-preview.test.tsx
git diff --cached --check
git diff --cached
git commit -m "Replace smart-home homepage demo services"
```

---

### Task 2: Build illustrated journey cards and separate the setup decisions

**Files:**

- Create: `app/home/ServiceScopeShowcase.tsx`
- Modify: `app/home/HomepageSetupBuilder.tsx`
- Modify: `app/globals.css`
- Modify: `tests/homepage-showcase.test.tsx`

**Interfaces:**

```ts
export function ServiceScopeShowcase(props: {
  journey: SetupJourney;
  demoService: DemoServiceKey;
  onJourneyChange: (journey: SetupJourney) => void;
  onDemoServiceChange: (service: DemoServiceKey) => void;
}): JSX.Element;
```

- Consumes: `SetupJourney`, the Task 1 neutral `DemoServiceKey`, and callbacks owned by `HomepageSetupBuilder`.
- Produces: one semantic journey fieldset with two illustrated cards and a conditional sample selector; later tasks leave this state boundary intact.

- [ ] **Step 1: Write the failing hierarchy and illustration regression**

Add this test to `tests/homepage-showcase.test.tsx`:

```tsx
it("separates two illustrated journey choices from two illustrated placement choices", async () => {
  const container = await renderBuilder();
  const journey = container.querySelector<HTMLElement>(".homepage-journey-section");
  const placement = container.querySelector<HTMLElement>(".homepage-placement-section");

  expect(journey).not.toBeNull();
  expect(placement).not.toBeNull();
  expect(journey?.querySelectorAll(".journey-choice")).toHaveLength(2);
  expect(journey?.querySelectorAll(".journey-choice-preview")).toHaveLength(2);
  expect(journey?.querySelector(".journey-preview-catalogue")).not.toBeNull();
  expect(journey?.querySelector(".journey-preview-page-service")).not.toBeNull();
  expect(placement?.querySelectorAll(".widget-choice")).toHaveLength(2);
  expect(journey?.contains(placement as Node)).toBe(false);
  expect(journey?.compareDocumentPosition(placement as Node) & Node.DOCUMENT_POSITION_FOLLOWING)
    .toBeTruthy();
});
```

Replace journey selection calls in existing tests with this helper:

```tsx
async function chooseJourneyCard(
  container: HTMLElement,
  journey: "catalogue" | "page-service",
) {
  const button = container.querySelector<HTMLButtonElement>(
    `.journey-choice-${journey} .journey-choice-select`,
  );
  expect(button).not.toBeNull();
  await act(async () => button?.click());
}
```

Keep `chooseRadio` only for `homepage-demo-service`.

- [ ] **Step 2: Run the focused test and verify the missing component failure**

Run:

```powershell
npm run unit -- tests/homepage-showcase.test.tsx
```

Expected: FAIL because the journey and placement section classes, visual cards, and selection buttons do not exist.

- [ ] **Step 3: Create the controlled journey showcase**

Create `app/home/ServiceScopeShowcase.tsx` with this structure and exact public labels:

```tsx
"use client";

import type { ReactNode } from "react";
import type { DemoServiceKey } from "../../lib/booking/demo";
import type { SetupJourney } from "../../lib/setup-profile";

export function ServiceScopeShowcase({
  journey,
  demoService,
  onJourneyChange,
  onDemoServiceChange,
}: {
  journey: SetupJourney;
  demoService: DemoServiceKey;
  onJourneyChange: (journey: SetupJourney) => void;
  onDemoServiceChange: (service: DemoServiceKey) => void;
}) {
  return (
    <fieldset className="homepage-decision-section homepage-journey-section">
      <legend><span>01 · Customer journey</span><strong>What should customers see?</strong></legend>
      <p className="homepage-decision-intro">
        Choose whether booking begins with your complete catalogue or one service supplied by the current page.
      </p>
      <div className="journey-choice-grid">
        <JourneyChoice
          description="Customers choose a service first; Daymark then shows only people qualified to deliver it."
          journey="catalogue"
          selected={journey === "catalogue"}
          title="Show all services"
          onSelect={onJourneyChange}
        ><CatalogueJourneyPreview /></JourneyChoice>
        <JourneyChoice
          description="The page supplies one mapped service, so customers begin with the people qualified for it."
          journey="page-service"
          selected={journey === "page-service"}
          title="Use this page's service"
          onSelect={onJourneyChange}
        ><PageServiceJourneyPreview /></JourneyChoice>
      </div>
      {journey === "page-service" ? (
        <fieldset className="homepage-sample-options">
          <legend>Service used in this demonstration</legend>
          <p>Sample only. An administrator maps the real workspace service in Daymark.</p>
          <SampleServiceOption checked={demoService === "interior"} description="90 minutes · Maya and Jon" label="Interior consultation" onChange={() => onDemoServiceChange("interior")} value="interior" />
          <SampleServiceOption checked={demoService === "garden"} description="120 minutes · Theo and Priya" label="Garden planning" onChange={() => onDemoServiceChange("garden")} value="garden" />
        </fieldset>
      ) : null}
    </fieldset>
  );
}
```

Implement `JourneyChoice` with the following controlled markup:

```tsx
function JourneyChoice({
  children,
  description,
  journey,
  onSelect,
  selected,
  title,
}: {
  children: ReactNode;
  description: string;
  journey: SetupJourney;
  onSelect: (journey: SetupJourney) => void;
  selected: boolean;
  title: string;
}) {
  const titleId = `journey-${journey}-title`;
  const descriptionId = `journey-${journey}-description`;
  return (
    <article className={`journey-choice journey-choice-${journey}${selected ? " is-selected" : ""}`}>
      {children}
      <div className="journey-choice-copy">
        <h4 id={titleId}>{title}</h4>
        <p id={descriptionId}>{description}</p>
        <button
          className="journey-choice-select"
          type="button"
          aria-pressed={selected}
          aria-labelledby={titleId}
          aria-describedby={descriptionId}
          onClick={() => onSelect(journey)}
        >
          {selected ? "Selected" : "Choose this journey"}
        </button>
      </div>
    </article>
  );
}
```

Implement the decorative preview functions with this exact semantic boundary:

```tsx
function CatalogueJourneyPreview() {
  return (
    <div className="journey-choice-preview journey-preview-catalogue" aria-hidden="true">
      <span className="journey-preview-label">FULL CATALOGUE</span>
      <div className="journey-preview-services"><i>Interior consultation</i><i>Garden planning</i></div>
      <span className="journey-preview-arrow">↓</span>
      <div className="journey-preview-people"><i>Maya</i><i>Jon</i><i>Theo</i><i>Priya</i></div>
    </div>
  );
}

function PageServiceJourneyPreview() {
  return (
    <div className="journey-choice-preview journey-preview-page-service" aria-hidden="true">
      <span className="journey-preview-label">SERVICE PAGE</span>
      <div className="journey-preview-page"><i>Interior consultation</i><b>SELECTED</b></div>
      <span className="journey-preview-arrow">↓</span>
      <div className="journey-preview-people"><i>Maya</i><i>Jon</i></div>
    </div>
  );
}
```

Implement the sample selector with:

```tsx
function SampleServiceOption({
  checked,
  description,
  label,
  onChange,
  value,
}: {
  checked: boolean;
  description: string;
  label: string;
  onChange: () => void;
  value: DemoServiceKey;
}) {
  const id = `homepage-demo-service-${value}`;
  return (
    <label className={`homepage-option${checked ? " is-selected" : ""}`} htmlFor={id}>
      <input id={id} type="radio" name="homepage-demo-service" value={value} checked={checked} onChange={onChange} />
      <span>
        <span className="homepage-option-title"><strong>{label}</strong><em>{checked ? "Selected" : "Choose"}</em></span>
        <small>{description}</small>
      </span>
    </label>
  );
}
```

- [ ] **Step 4: Wire the two separate setup sections**

Import `ServiceScopeShowcase` in `HomepageSetupBuilder` and replace the old scope and conditional sample fieldsets with:

```tsx
<ServiceScopeShowcase
  journey={draft.journey}
  demoService={draft.demoService}
  onJourneyChange={chooseJourney}
  onDemoServiceChange={chooseDemoService}
/>

<fieldset className="homepage-decision-section homepage-placement-section">
  <legend><span>02 · Placement</span><strong>How should the widget appear?</strong></legend>
  <p className="homepage-decision-intro">
    Choose a compact corner launcher or a full booking section built into the page.
  </p>
  <WidgetOptionsShowcase selected={draft.layout} onSelect={chooseLayout} />
</fieldset>
```

Remove the private `SetupOption` function from `HomepageSetupBuilder`; the new component owns all homepage journey/sample option markup.

- [ ] **Step 5: Add the Daymark-styled section and journey-card CSS**

Replace the old `.homepage-option-group`, `.homepage-scope-options`, and `.homepage-layout-options` rules with these structural rules, then add card-specific preview styling using the existing palette variables:

```css
.homepage-decision-section {
  min-width: 0;
  grid-column: 1 / -1;
  margin: 0;
  padding: clamp(1rem, 2.5vw, 2rem);
  border: 1px solid var(--ink);
  background: var(--paper-deep);
}

.homepage-decision-section + .homepage-decision-section {
  margin-top: clamp(1.5rem, 4vw, 3.5rem);
}

.homepage-journey-section { background: #f7d9cf; }
.homepage-placement-section { background: #dce7d5; }

.homepage-decision-section > legend {
  max-width: calc(100% - 1rem);
  padding: 0 0.6rem;
}

.homepage-decision-section > legend span,
.homepage-decision-section > legend strong { display: block; }
.homepage-decision-section > legend span { color: var(--coral); font-size: 0.6rem; font-weight: 850; letter-spacing: 0.13em; text-transform: uppercase; }
.homepage-decision-section > legend strong { margin-top: 0.3rem; font-family: var(--font-display), Georgia, serif; font-size: clamp(1.8rem, 3vw, 3rem); font-weight: 520; line-height: 0.95; }
.homepage-decision-intro { max-width: 620px; margin: 0 0 1.4rem; color: var(--ink-soft); line-height: 1.55; }

.journey-choice-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: clamp(1rem, 2.5vw, 2rem); }
.journey-choice { position: relative; min-width: 0; border: 1px solid var(--ink); background: var(--paper-light); box-shadow: 6px 6px 0 var(--ink); }
.journey-choice.is-selected { outline: 5px solid var(--coral); outline-offset: 3px; transform: translateY(-3px); }
.journey-choice-preview { min-height: 230px; padding: 1.2rem; border-bottom: 1px solid var(--ink); background: var(--paper-deep); }
.journey-preview-page-service { background: var(--sky); }
.journey-preview-label { font-size: 0.55rem; font-weight: 850; letter-spacing: 0.13em; }
.journey-preview-services { display: grid; grid-template-columns: repeat(2, 1fr); gap: 0.65rem; margin-top: 1.1rem; }
.journey-preview-services i, .journey-preview-page { min-height: 72px; display: flex; align-items: center; justify-content: space-between; padding: 0.85rem; border: 1px solid var(--ink); background: var(--paper-light); font-style: normal; }
.journey-preview-arrow { display: block; margin: 0.65rem 0; text-align: center; }
.journey-preview-people { display: flex; justify-content: center; gap: 0.5rem; }
.journey-preview-people i { min-width: 54px; padding: 0.55rem; border: 1px solid var(--ink); border-radius: 999px; background: var(--sage); font-size: 0.6rem; font-style: normal; text-align: center; }
.journey-preview-page b { color: var(--coral); font-size: 0.55rem; letter-spacing: 0.08em; }
.journey-choice-copy { padding: clamp(1rem, 2.5vw, 1.7rem); }
.journey-choice-copy h4 { margin: 0; font-family: var(--font-display), Georgia, serif; font-size: clamp(1.45rem, 2.4vw, 2.2rem); font-weight: 520; line-height: 1; }
.journey-choice-copy p { color: var(--ink-soft); line-height: 1.5; }
.journey-choice-select { min-height: 44px; border: 1px solid var(--ink); padding: 0.65rem 0.9rem; background: transparent; color: var(--ink); cursor: pointer; font: inherit; font-size: 0.72rem; font-weight: 800; }
.journey-choice-select[aria-pressed="true"] { background: var(--ink); color: var(--paper-light); }
.homepage-sample-options { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 0.75rem; margin: 1.5rem 0 0; padding: 1rem; border: 1px dashed var(--ink); background: var(--paper-light); }
.homepage-sample-options > legend, .homepage-sample-options > p { grid-column: 1 / -1; }
```

At `max-width: 850px`, stack `.journey-choice-grid`; at `max-width: 520px`, make `.journey-preview-services` and `.homepage-sample-options` one column. Retain existing visible focus outlines and add `.journey-choice:has(.journey-choice-select:focus-visible)` using the current coral outline pattern.

- [ ] **Step 6: Run the integrated builder tests and commit**

Run:

```powershell
npm run unit -- tests/homepage-showcase.test.tsx tests/widget-live-preview.test.tsx
npm run lint -- --quiet
```

Expected: PASS. Then:

```powershell
git add -- app/home/ServiceScopeShowcase.tsx app/home/HomepageSetupBuilder.tsx app/globals.css tests/homepage-showcase.test.tsx
git diff --cached --check
git diff --cached
git commit -m "Illustrate homepage booking journey choices"
```

---

### Task 3: Replace the sparse live backdrop with a credible Cedar House page

**Files:**

- Modify: `app/home/WidgetPreviewChrome.tsx`
- Modify: `app/home/WidgetLivePreview.tsx`
- Modify: `app/globals.css`
- Modify: `tests/homepage-showcase.test.tsx`

**Interfaces:**

```ts
export function CedarHouseHostPage(): JSX.Element;
```

- Consumes: `WidgetHostBrowser` and the neutral service names from Task 1.
- Produces: an artwork-free editorial host page used by both live presentations.

- [ ] **Step 1: Write the failing richer-host regression**

Add to `tests/homepage-showcase.test.tsx`:

```tsx
it("renders a fuller artwork-free Cedar House studio behind the live booking surface", async () => {
  const container = await renderBuilder();
  const live = container.querySelector<HTMLElement>(".widget-presentation");
  const host = live?.querySelector<HTMLElement>(".widget-live-host-page");

  expect(host?.querySelector(".widget-live-host-hero")).not.toBeNull();
  expect(host?.querySelector(".widget-live-host-collage")).not.toBeNull();
  expect(host?.querySelectorAll(".widget-live-host-service")).toHaveLength(2);
  expect(host?.querySelector(".widget-live-host-proof")).not.toBeNull();
  expect(host?.textContent).toContain("Interior consultation");
  expect(host?.textContent).toContain("Garden planning");
  expect(live?.querySelector(".widget-host-art")).toBeNull();
  expect(live?.querySelector("img")).toBeNull();
});
```

- [ ] **Step 2: Run the focused test and verify the sparse-host failure**

Run:

```powershell
npm run unit -- tests/homepage-showcase.test.tsx
```

Expected: FAIL because the current host has only one copy block and three empty category boxes.

- [ ] **Step 3: Build the richer artwork-free host primitive**

Replace `WidgetNeutralHostPage` with this `CedarHouseHostPage` structure in `WidgetPreviewChrome.tsx`:

```tsx
export function CedarHouseHostPage() {
  return (
    <div className="widget-live-host-page" aria-hidden="true">
      <section className="widget-live-host-hero">
        <div className="widget-live-host-copy">
          <span className="widget-host-kicker">Interiors · Gardens · London</span>
          <strong>Spaces with room<br />to grow.</strong>
          <p>Thoughtful plans for the rooms you live in and the outdoor spaces around them.</p>
          <span className="widget-live-host-link">EXPLORE THE STUDIO →</span>
        </div>
        <div className="widget-live-host-collage">
          <i className="widget-live-swatch widget-live-swatch-coral" />
          <i className="widget-live-swatch widget-live-swatch-sage" />
          <i className="widget-live-swatch widget-live-swatch-paper" />
          <span><small>PROJECT 07</small><b>Inside<br />and out</b></span>
        </div>
      </section>
      <div className="widget-live-host-services">
        <article className="widget-live-host-service"><span>01</span><strong>Interior consultation</strong><small>Room flow, materials, and a practical next step.</small></article>
        <article className="widget-live-host-service"><span>02</span><strong>Garden planning</strong><small>Layout and planting shaped around how you live.</small></article>
      </div>
      <div className="widget-live-host-proof"><span>Independent studio</span><span>London & remote</span><span>New projects · Autumn 2026</span></div>
    </div>
  );
}
```

Import and render `CedarHouseHostPage` from `WidgetLivePreview`. Keep `WidgetArtworkHero` unchanged and exclusive to the static chooser.

- [ ] **Step 4: Style the editorial host without external imagery**

Replace the old `.widget-live-host-page`, copy, details, and detail-span rules with:

```css
.widget-live-host-page { min-height: clamp(410px, 44vw, 560px); padding: clamp(1.5rem, 4vw, 3.5rem); background: var(--paper-light); }
.widget-live-host-hero { display: grid; grid-template-columns: minmax(0, 0.82fr) minmax(300px, 1.18fr); gap: clamp(1.5rem, 5vw, 5rem); align-items: center; }
.widget-live-host-copy > strong { display: block; margin: 0.65rem 0; font-family: var(--font-display), Georgia, serif; font-size: clamp(2.2rem, 4.5vw, 4.7rem); font-weight: 520; letter-spacing: -0.055em; line-height: 0.9; }
.widget-live-host-copy p { max-width: 310px; color: var(--ink-soft); line-height: 1.55; }
.widget-live-host-link { display: inline-block; margin-top: 1rem; border-bottom: 1px solid var(--ink); padding-bottom: 0.25rem; font-size: 0.58rem; font-weight: 850; letter-spacing: 0.1em; }
.widget-live-host-collage { position: relative; min-height: 250px; display: grid; grid-template-columns: 0.75fr 1.25fr; grid-template-rows: 1fr 0.8fr; border: 1px solid var(--ink); background: var(--paper-deep); box-shadow: 7px 7px 0 var(--ink); overflow: hidden; }
.widget-live-swatch { display: block; border-right: 1px solid var(--ink); border-bottom: 1px solid var(--ink); }
.widget-live-swatch-coral { background: var(--coral); }
.widget-live-swatch-sage { background: var(--sage); }
.widget-live-swatch-paper { background: linear-gradient(135deg, var(--paper-light) 0 50%, var(--ochre) 50%); }
.widget-live-host-collage > span { display: flex; flex-direction: column; justify-content: flex-end; padding: 1rem; background: var(--sky); }
.widget-live-host-collage b { margin-top: 0.4rem; font-family: var(--font-display), Georgia, serif; font-size: 1.8rem; font-weight: 520; line-height: 0.9; }
.widget-live-host-services { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); margin-top: clamp(1.4rem, 3vw, 2.4rem); border-block: 1px solid var(--rule); }
.widget-live-host-service { display: grid; grid-template-columns: auto minmax(0, 1fr); gap: 0.35rem 0.9rem; padding: 1rem 0; }
.widget-live-host-service + .widget-live-host-service { border-left: 1px solid var(--rule); padding-left: 1.2rem; }
.widget-live-host-service span { grid-row: 1 / span 2; color: var(--coral); font-size: 0.55rem; font-weight: 850; }
.widget-live-host-service strong { font-family: var(--font-display), Georgia, serif; font-size: 1.2rem; font-weight: 520; }
.widget-live-host-service small { color: var(--ink-soft); line-height: 1.4; }
.widget-live-host-proof { display: flex; flex-wrap: wrap; justify-content: space-between; gap: 0.6rem 1.2rem; padding-top: 1rem; color: var(--ink-soft); font-size: 0.52rem; font-weight: 800; letter-spacing: 0.1em; text-transform: uppercase; }
```

Stack the hero and service cards below 760px. Keep the collage at least 190px tall, and keep the host page free of `<img>` and `.widget-host-art`.

- [ ] **Step 5: Run host and artwork tests and commit**

Run:

```powershell
npm run unit -- tests/homepage-showcase.test.tsx
npm run lint -- --quiet
```

Expected: PASS. Then:

```powershell
git add -- app/home/WidgetPreviewChrome.tsx app/home/WidgetLivePreview.tsx app/globals.css tests/homepage-showcase.test.tsx
git diff --cached --check
git diff --cached
git commit -m "Improve the Cedar House live preview"
```

---

### Task 4: Make Floating genuinely compact and restore both privacy side notes

**Files:**

- Modify: `app/home/WidgetLivePreview.tsx`
- Modify: `app/globals.css`
- Modify: `tests/widget-live-preview.test.tsx`
- Modify: `tests/homepage-showcase.test.tsx`

**Interfaces:**

```ts
export function WidgetLivePreview(props: {
  layout: WidgetPlacement;
  resetKey: string;
  children: React.ReactNode;
}): JSX.Element;
```

- Consumes: the stable child and Floating state/focus behavior already in `WidgetLivePreview`.
- Produces: mutually exclusive `.widget-live-surface-compact` and `.widget-live-surface-inline` classes plus scoped layouts for the unchanged `BookingFlow` DOM.

- [ ] **Step 1: Write failing surface-class and privacy-layout contracts**

In `tests/widget-live-preview.test.tsx`, assert the class in the existing open/Inline transitions:

```tsx
expect(surface?.classList.contains("widget-live-surface-compact")).toBe(true);
expect(surface?.classList.contains("widget-live-surface-inline")).toBe(false);
```

After switching to Inline:

```tsx
expect(inlineSurface?.classList.contains("widget-live-surface-inline")).toBe(true);
expect(inlineSurface?.classList.contains("widget-live-surface-compact")).toBe(false);
```

Add this stylesheet contract test:

```tsx
it("keeps Floating compact and restores desktop privacy side columns", () => {
  const css = readFileSync(resolve(process.cwd(), "app/globals.css"), "utf8");

  expect(css).toMatch(/\.widget-live-surface-compact\s*\{[^}]*right:[^;]+;[^}]*bottom:[^;]+;[^}]*width:\s*min\(600px,[^;]+;[^}]*max-height:/s);
  expect(css).toMatch(/\.widget-live-surface-compact \.booking-studio\s*\{[^}]*grid-template-columns:\s*52px minmax\(0, 1fr\) minmax\(150px, 178px\);/s);
  expect(css).toMatch(/\.widget-live-surface-compact \.privacy-note\s*\{[^}]*grid-column:\s*3;[^}]*width:\s*auto;[^}]*transform:\s*rotate\(1\.2deg\);/s);
  expect(css).toMatch(/\.widget-live-surface-inline \.booking-studio\s*\{[^}]*grid-template-columns:\s*88px minmax\(0, 1fr\) minmax\(200px, 230px\);/s);
  expect(css).toMatch(/\.widget-live-surface-inline \.privacy-note\s*\{[^}]*grid-column:\s*3;[^}]*transform:\s*rotate\(1\.2deg\);/s);
  expect(css).not.toMatch(/\.widget-live-surface \.privacy-note\s*\{[^}]*grid-column:\s*2;[^}]*width:\s*auto;[^}]*transform:\s*none;/s);
});
```

Add a responsive assertion for an `@media (max-width: 980px)` block that changes both booking grids to `64px minmax(0, 1fr)`, places both notes in grid column 2, and sets `transform: none`.

- [ ] **Step 2: Run the focused tests and verify the old full-overlay failure**

Run:

```powershell
npm run unit -- tests/widget-live-preview.test.tsx tests/homepage-showcase.test.tsx
```

Expected: FAIL because there are no explicit compact/inline classes, Floating uses a large inset overlay, Inline has only two columns, and the shared privacy override stretches the note across column 2.

- [ ] **Step 3: Expose mutually exclusive presentation classes without moving the child**

Change the booking surface class in `WidgetLivePreview` to:

```tsx
className={`widget-live-surface ${floating ? "widget-live-surface-compact" : "widget-live-surface-inline"}`}
```

Keep `{children}` at its current stable position after the conditional dialog header. Do not key, clone, duplicate, or conditionally mount the child. Keep the current launcher, Close booking, document Escape listener, reset-key opening, and focus-return code.

- [ ] **Step 4: Replace the shared full-size live booking override with scoped layouts**

Keep shared reset rules minimal:

```css
.widget-live-surface { z-index: 4; min-width: 0; border: 1px solid var(--ink); background: var(--paper-light); }
.widget-live-surface[hidden] { display: none; }
.widget-live-surface .booking-studio { width: 100%; max-width: none; min-height: 0; margin: 0; border: 0; box-shadow: none; }
.widget-live-surface .booking-workbench { min-width: 0; }
```

Replace the old Floating inset overlay with:

```css
.widget-live-surface-compact {
  position: absolute;
  right: clamp(0.75rem, 2vw, 1.5rem);
  bottom: clamp(3.8rem, 7vw, 5rem);
  width: min(600px, calc(100% - 2rem));
  max-height: calc(100% - 6rem);
  display: grid;
  grid-template-rows: auto minmax(0, 1fr);
  border-radius: 18px;
  box-shadow: 0 24px 60px rgba(23, 39, 34, 0.3);
  overflow: hidden;
}

.widget-live-surface-compact .demo-booking-flow { min-height: 0; overflow: auto; overscroll-behavior: contain; }
.widget-live-surface-compact .booking-studio { display: grid; grid-template-columns: 52px minmax(0, 1fr) minmax(150px, 178px); }
.widget-live-surface-compact .daymark-rail { padding: 14px 6px; }
.widget-live-surface-compact .daymark-rail strong { margin-top: 18px; font-size: 2.6rem; }
.widget-live-surface-compact .rail-month { font-size: 0.9rem; }
.widget-live-surface-compact .rail-line { min-height: 44px; margin: 12px 0; }
.widget-live-surface-compact .booking-workbench { padding: 1rem; }
.widget-live-surface-compact .booking-toolbar { display: block; padding-bottom: 0.8rem; }
.widget-live-surface-compact .booking-toolbar h2 { font-size: 1.55rem; }
.widget-live-surface-compact .step-track { justify-content: space-between; margin-top: 0.75rem; gap: 3px; }
.widget-live-surface-compact .step-track li { font-size: 0.42rem; }
.widget-live-surface-compact .step-track li > span { width: 19px; height: 19px; }
.widget-live-surface-compact .stage-title { margin-top: 1rem; }
.widget-live-surface-compact .stage-title h3 { font-size: 1.7rem; }
.widget-live-surface-compact .service-choice-list, .widget-live-surface-compact .people-list, .widget-live-surface-compact .details-form { grid-template-columns: 1fr; gap: 0.65rem; }
.widget-live-surface-compact .service-choice-card, .widget-live-surface-compact .person-tab { min-height: 92px; padding: 0.8rem; }
.widget-live-surface-compact .date-strip { display: flex; overflow-x: auto; padding-bottom: 0.5rem; }
.widget-live-surface-compact .date-card { min-width: 70px; }
.widget-live-surface-compact .time-tabs { grid-template-columns: repeat(2, minmax(0, 1fr)); }
.widget-live-surface-compact .form-wide, .widget-live-surface-compact .confirm-button { grid-column: auto; }
.widget-live-surface-compact .privacy-note { grid-column: 3; grid-row: 1; align-self: start; width: auto; margin: 1rem 10px 1rem -8px; padding: 18px 14px; box-shadow: 5px 5px 0 var(--ink); transform: rotate(1.2deg); }
.widget-live-surface-compact .privacy-note h3 { font-size: 1.35rem; }
.widget-live-surface-compact .privacy-note > p:not(.eyebrow) { font-size: 0.66rem; line-height: 1.4; }
.widget-live-surface-compact .privacy-note ul { gap: 6px; margin-top: 12px; padding-top: 10px; }
.widget-live-surface-compact .privacy-note li { font-size: 0.58rem; }
```

Replace the old Inline surface with:

```css
.widget-live-surface-inline { position: relative; margin: 0 clamp(0.8rem, 2.5vw, 2rem) clamp(1rem, 3vw, 2.5rem); box-shadow: 6px 6px 0 var(--ink); }
.widget-live-surface-inline .booking-studio { display: grid; grid-template-columns: 88px minmax(0, 1fr) minmax(200px, 230px); }
.widget-live-surface-inline .booking-workbench { padding: clamp(1.15rem, 3vw, 2.5rem); }
.widget-live-surface-inline .privacy-note { grid-column: 3; grid-row: 1; align-self: start; width: auto; margin: clamp(2rem, 4vw, 3.5rem) 16px 2rem -12px; padding: 24px 18px 20px; transform: rotate(1.2deg); }
.widget-live-surface-inline .privacy-note h3 { font-size: 1.55rem; }
```

Delete the shared rule that currently sets `.widget-live-surface .privacy-note` to column 2, full width, and `transform: none`.

- [ ] **Step 5: Add safe responsive fallbacks**

Place this after the desktop live-preview rules:

```css
@media (max-width: 980px) {
  .widget-live-surface-compact { width: min(430px, calc(100% - 1.5rem)); }
  .widget-live-surface-compact .booking-studio,
  .widget-live-surface-inline .booking-studio { grid-template-columns: 64px minmax(0, 1fr); }
  .widget-live-surface-compact .privacy-note,
  .widget-live-surface-inline .privacy-note { grid-column: 2; grid-row: 2; width: auto; margin: 0 1rem 1.2rem; transform: none; }
}

@media (max-width: 620px) {
  .widget-live-surface-compact { right: 0.5rem; bottom: 4rem; width: calc(100% - 1rem); max-height: calc(100% - 5rem); border-radius: 14px; }
  .widget-live-surface-compact .booking-studio,
  .widget-live-surface-inline .booking-studio { display: block; }
  .widget-live-surface-compact .daymark-rail,
  .widget-live-surface-inline .daymark-rail { min-height: 68px; display: grid; grid-template-columns: auto auto 1fr auto; padding: 10px 12px; }
  .widget-live-surface-compact .privacy-note,
  .widget-live-surface-inline .privacy-note { margin: 0.5rem 0.8rem 1rem; }
  .widget-live-surface-inline { margin-inline: 0.45rem; }
}
```

Retain the existing `[hidden]`, focus-visible, Escape, close, and launcher rules. Ensure later mobile rules do not reintroduce the old full-width note or Floating inset overlay.

- [ ] **Step 6: Prove compact/inline exclusivity and preserved progress**

Update the integrated layout test in `tests/homepage-showcase.test.tsx` to select `Interior consultation`, reach Person, switch to Inline, switch back to Floating, reopen, and assert:

```tsx
expect(container.querySelectorAll(".demo-booking-flow")).toHaveLength(1);
expect(container.querySelector(".widget-live-surface-compact")).not.toBeNull();
expect(container.querySelector(".widget-live-surface-inline")).toBeNull();
expect(container.textContent).toContain("Who should deliver this service?");
expect(container.textContent).toContain("Maya Chen");
expect(container.textContent).toContain("Jon Bell");
```

The existing launcher/close/Escape/focus/reset tests remain and must pass unchanged apart from neutral keys and explicit class assertions.

- [ ] **Step 7: Run focused and booking regressions, then commit**

Run:

```powershell
npm run unit -- tests/widget-live-preview.test.tsx tests/homepage-showcase.test.tsx tests/booking-flow.test.ts tests/booking-transport.test.ts
npm run lint -- --quiet
```

Expected: PASS. Then:

```powershell
git add -- app/home/WidgetLivePreview.tsx app/globals.css tests/widget-live-preview.test.tsx tests/homepage-showcase.test.tsx
git diff --cached --check
git diff --cached
git commit -m "Make the floating booking preview compact"
```

---

### Task 5: Review, verify, rebuild the packaged runtime, and update GitHub

**Files:**

- Modify for verified defects only: files changed in Tasks 1–4 and their focused tests.
- Verify: `docs/superpowers/specs/2026-08-14-compact-widget-homepage-redesign-design.md`
- Verify: `docs/superpowers/plans/2026-08-14-compact-widget-homepage-redesign.md`
- Keep transient screenshots in ignored evidence locations only.

**Interfaces:**

- Consumes: the four implementation commits, approved spec, restore tags, draft PR #3, and the managed runtime on `127.0.0.1:3000`.
- Produces: reviewed code, complete test/build evidence, a rebuilt healthy packaged runtime, browser verification, and an updated GitHub branch/PR.

- [ ] **Step 1: Request implementation review**

Read and invoke `superpowers:requesting-code-review` for `344ceab..HEAD`. Review all fourteen acceptance criteria with special attention to duplicate booking flows, child remounting, compact-panel clipping, privacy-note overlap, narrow-width overflow, focus return, hidden launcher behavior, smart-home copy leakage, setup-code drift, and unexpected network writes.

For each verified defect, first add the smallest failing regression to the focused test file, then correct the implementation and rerun that test. Stage only the explicit fix paths and commit actual fixes as:

```powershell
git commit -m "Complete compact homepage booking redesign"
```

Do not create an empty commit.

- [ ] **Step 2: Run the complete repository matrix**

```powershell
npm run unit
npm run lint
npm test
node --test tests/inline-widget-layout.test.mjs
npm --prefix desktop/daymark-control test -- --run
npm --prefix desktop/daymark-control run build
cargo test --manifest-path desktop/daymark-control/src-tauri/Cargo.toml
powershell.exe -NoProfile -ExecutionPolicy Bypass -File tests/windows/installer-contract.test.ps1
git diff --check
```

Expected: every command exits 0. Diagnose every failure before classifying it as unrelated.

- [ ] **Step 3: Rebuild and inspect the staged Windows runtime**

```powershell
npm run windows:stage
npm run windows:verify-runtime
npm run windows:test-staged-migration
```

Require the staged payload to contain the new production build and `0006_service_scope_widget_defaults.sql`, and to contain no `.daymark`, setup code, credential, database, backup, log, cold-backup, or screenshot payload.

- [ ] **Step 4: Restart the exact packaged runtime on port 3000**

Send `stop` to retained runtime session `79600` if it still owns the process. If the session is gone, inspect the listener and process command line, and stop it only after proving it belongs to this Daymark workspace. Confirm `127.0.0.1:3000` is free.

Start the staged runtime with the inherited protected setup-code environment without printing it:

```powershell
& 'C:/Users/Lloyd/Files/Daymark/artifacts/windows-stage/node/node.exe' --import tsx 'C:/Users/Lloyd/Files/Daymark/artifacts/windows-stage/runtime/local/cli.ts' start --app-dir 'C:/Users/Lloyd/Files/Daymark/artifacts/windows-stage' --data-dir 'C:/Users/Lloyd/Files/Daymark/.daymark/data' --backup-dir 'C:/Users/Lloyd/Files/Daymark/.daymark/backups' --log-dir 'C:/Users/Lloyd/Files/Daymark/.daymark/logs' --host 127.0.0.1 --port 3000
```

Wait for `http://127.0.0.1:3000/api/health` to return exactly:

```json
{"status":"ok","appVersion":"0.1.1","latestMigration":"0006_service_scope_widget_defaults.sql"}
```

- [ ] **Step 5: Browser-verify the two setup decisions**

Read and invoke `browser:control-in-app-browser`. At `http://localhost:3000/#widget-options`, verify at desktop and narrow widths:

1. Full catalogue and This page's service are two large illustrated cards.
2. Their illustrations show different start states and contain neutral Interior/Garden language.
3. The journey section is clearly separated by heading, background, border, and spacing from the Floating/Inline section.
4. The restored Floating/Inline cards retain the approved Daymark image, crop, wordmark, miniature, and selected treatment.
5. Choosing This page's service reveals only the neutral sample selector inside the journey section.
6. Selected journey and placement remain visible in card text and the setup summary.
7. No smart-home, Camera installation, or Alarm installation text appears on the homepage.

- [ ] **Step 6: Browser-verify the improved host and every live presentation state**

At `http://localhost:3000/`, verify:

1. The Cedar House page has the editorial hero, CSS collage, two services, and proof strip with no Daymark background artwork.
2. Floating closed shows one launcher and no booking surface.
3. Floating open is a corner panel, remains visibly compact, hides the launcher, and focuses Close booking.
4. Complete Service, Person, Date, Time, Details, and no-write confirmation inside the compact panel; internal scrolling exposes every control.
5. The Floating privacy note is a small pinned side note at wide width and never covers the close control or booking controls.
6. Escape closes Floating and returns focus to the launcher after focus moves within and outside the panel.
7. Inline shows the full embedded booking section, no launcher, no close header, and a 200–230px pinned privacy note beside the workbench.
8. Switching Floating → Inline → Floating preserves the current booking stage and entered demonstration values.
9. Changing journey or neutral sample service resets and exposes the new first step with the existing polite announcement.
10. At narrow width both notes move below content without rotation, all controls remain reachable, and there is no horizontal page overflow.
11. Browser console and network inspection show no link error, hydration error, uncaught exception, appointment write, or unexpected mutation.

Record screenshots of journey cards, Floating open, Inline, and the narrow responsive state in an ignored evidence location. If visual evidence demonstrates a defect, add a focused regression, make the smallest correction, rerun affected/full gates, rebuild/restart, and repeat the affected browser state.

- [ ] **Step 7: Audit protected data, restore points, and commit scope**

```powershell
git status --short
git diff --stat 344ceab..HEAD
git diff --name-only --cached
git ls-files -- .daymark
git rev-parse "restore-2026-08-10-before-service-scope-builder^{}"
git rev-parse "restore-2026-08-11-before-widget-visual-correction^{}"
git rev-parse "restore-2026-08-14-before-compact-widget-rebuild^{}"
```

Require `.daymark/` to remain untracked; the three tags to resolve to `d41a95c511054c2d365f96b29f3049256a9d4862`, `d482c09cc2f2b3ba4e7147d06f657eb2cf58b301`, and `4155fe66c29dfb892bfb83b2f692f6f3aa5e11c9`; no backup/artifact/log/secret/database/screenshot to be staged; and only planned source/test/docs paths to differ.

- [ ] **Step 8: Verify completion and update draft PR #3**

Read and invoke `superpowers:verification-before-completion` using fresh command, health, and browser evidence. Then read and invoke `github:yeet` because the user explicitly requested that GitHub remain updated.

Push `codex/homepage-setup-handoff` and update draft PR #3 with:

- the new restore tag and immutable reference hashes;
- neutral demonstration services and eligibility mapping;
- illustrated journey/placement separation;
- compact Floating versus full Inline behavior;
- restored privacy-note behavior at desktop/narrow widths;
- full repository/staged-runtime gate results;
- packaged health response and browser evidence; and
- confirmation that `.daymark/` and the cold backup were never staged or manually modified.

Do not merge the PR, publish an installer, create a release, or push `artifacts/`.

## Self-Review Record

- **Specification coverage:** Tasks 1–4 cover neutral demo identity, illustrated scope cards, section separation, richer host content, compact Floating, full Inline, side privacy notes, accessibility, responsiveness, and shared-state preservation. Task 5 covers review, full gates, staged runtime, browser evidence, restore/data audit, and GitHub update.
- **Scope boundary:** No task changes setup-profile encoding, import mapping, persistence, migrations, production workspace data, booking API contracts, or the protected Embed builder.
- **Type consistency:** `DemoServiceKey` is defined once in `lib/booking/demo.ts` as `"interior" | "garden"` and consumed by `DemoBookingFlow`, `HomepageSetupBuilder`, and `ServiceScopeShowcase`. `SetupJourney` and `WidgetPlacement` retain their existing definitions.
- **State consistency:** `HomepageSetupBuilder` owns the one draft; `WidgetLivePreview` owns only open/closed presentation state; `DemoBookingFlow` remains one stable child.
- **No-placeholder scan:** Every task names exact files, assertions, commands, class names, copy, interfaces, implementation structure, expected failures, pass conditions, and commit scope.
