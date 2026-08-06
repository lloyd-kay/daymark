# Daymark Homepage Finishing Pass Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Finish the Daymark homepage with a styled, non-interactive custom-work prompt and seven days of stable, employee-specific demonstration availability.

**Architecture:** Keep production booking untouched and confine varied availability to `demoBookingTransport`. Generate seven consecutive London-current date keys, then derive deterministic slot selections from each employee/date pair. Extend the existing widget setup strip with semantic static copy and styles that reuse Daymark's paper-card visual system.

**Tech Stack:** React 19, TypeScript 5.9, Vitest 4 with jsdom, vinext/Vite, plain CSS.

## Global Constraints

- Preserve Daymark's existing paper-led visual language.
- Do not change real booking availability or staff workspace behaviour.
- Show exactly seven upcoming selectable demonstration dates.
- Return at least one slot for every demonstration employee and displayed date.
- Make demonstration times employee-specific, varied by day, deterministic, and stable across visits.
- Keep “For custom widgets or integrations, contact us.” informational and non-interactive until a destination exists.
- Preserve keyboard operation, focus treatment, responsive layout, and semantic controls.

## File map

- `lib/booking/transport.ts`: generate seven-day deterministic demonstration availability; leave `liveBookingTransport` unchanged.
- `tests/booking-transport.test.ts`: prove date coverage, stability, employee separation, and in-memory behaviour.
- `app/page.tsx`: add semantic widget setup/contact copy.
- `app/globals.css`: style the setup copy as a responsive editorial strip using existing tokens.
- `tests/homepage-showcase.test.tsx`: prove the custom-work prompt is visible, non-interactive, and retains the staff sign-in link.
- `tests/rendered-html.test.mjs`: prove the new copy survives the production server-rendering path.

---

### Task 1: Seven-day employee-specific demonstration availability

**Files:**
- Modify: `tests/booking-transport.test.ts:8-49`
- Modify: `lib/booking/transport.ts:79-127`

**Interfaces:**
- Consumes: `BookingTransport.loadSlots(employeeId: string, from: string)` and `BookableSlot`.
- Produces: `demoBookingTransport.loadSlots(employeeId, from): Promise<{ dateKeys: string[]; slots: BookableSlot[] }>` with seven consecutive date keys and at least two stable slots per key.

- [ ] **Step 1: Write the failing transport test**

Add this test inside `describe("demonstration booking transport", ...)`:

```ts
it("offers seven stable selectable days with employee-specific times", async () => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2030-03-10T12:00:00.000Z"));
  try {
    const maya = await demoBookingTransport.loadSlots("maya-chen", "2030-03-10");
    const mayaAgain = await demoBookingTransport.loadSlots("maya-chen", "2030-03-10");
    const theo = await demoBookingTransport.loadSlots("theo-brooks", "2030-03-10");

    expect(maya.dateKeys).toEqual([
      "2030-03-10", "2030-03-11", "2030-03-12", "2030-03-13",
      "2030-03-14", "2030-03-15", "2030-03-16",
    ]);
    expect(maya.dateKeys.every((dateKey) =>
      maya.slots.some((slot) => slot.dateKey === dateKey),
    )).toBe(true);
    expect(maya.slots).toEqual(mayaAgain.slots);
    expect(maya.slots.map((slot) => slot.startAt)).not.toEqual(
      theo.slots.map((slot) => slot.startAt),
    );
  } finally {
    vi.useRealTimers();
  }
});
```

- [ ] **Step 2: Run the focused test and verify the current one-day transport fails**

Run:

```powershell
npm run unit -- tests/booking-transport.test.ts
```

Expected: FAIL because `maya.dateKeys` contains only `2030-03-10` and Maya/Theo receive identical slots.

- [ ] **Step 3: Implement deterministic seven-day demo slots**

Replace the current demonstration `loadSlots` implementation and `demoSlotsFor` helper in `lib/booking/transport.ts`, and add these constants/helpers. Do not edit `liveBookingTransport`.

```ts
const DEMO_DATE_COUNT = 7;
const DEMO_SLOT_TIMES = [
  "08:30:00.000Z", "09:00:00.000Z", "09:30:00.000Z",
  "10:30:00.000Z", "11:00:00.000Z", "11:30:00.000Z",
  "13:00:00.000Z", "13:30:00.000Z", "14:30:00.000Z",
  "15:00:00.000Z", "15:30:00.000Z", "16:00:00.000Z",
] as const;

async loadSlots(employeeId) {
  const dateKeys = consecutiveDemoDateKeys(londonTodayKey(), DEMO_DATE_COUNT);
  return { dateKeys, slots: demoSlotsFor(employeeId, dateKeys) };
},

function consecutiveDemoDateKeys(startDateKey: string, count: number): string[] {
  const start = Date.parse(`${startDateKey}T12:00:00.000Z`);
  return Array.from({ length: count }, (_, index) =>
    new Date(start + index * 86_400_000).toISOString().slice(0, 10),
  );
}

function demoSlotsFor(employeeId: string, dateKeys: string[]): BookableSlot[] {
  return dateKeys.flatMap((dateKey) => {
    const seed = demoSeed(`${employeeId}:${dateKey}`);
    const slotCount = 2 + (seed % 3);
    const times = Array.from({ length: slotCount }, (_, index) =>
      DEMO_SLOT_TIMES[(seed + index * 5) % DEMO_SLOT_TIMES.length],
    ).sort();

    return times.map((time) => {
      const startAt = `${dateKey}T${time}`;
      const endAt = new Date(Date.parse(startAt) + 30 * 60 * 1000).toISOString();
      return { dateKey, startAt, endAt };
    });
  });
}

function demoSeed(value: string): number {
  return Array.from(value).reduce(
    (hash, character) => (hash * 31 + character.charCodeAt(0)) >>> 0,
    7,
  );
}
```

- [ ] **Step 4: Run the focused test and verify the seven-day behaviour passes**

```powershell
npm run unit -- tests/booking-transport.test.ts
```

Expected: all transport tests PASS; live transport tests remain unchanged.

- [ ] **Step 5: Commit the demonstration availability change**

```powershell
git add -- tests/booking-transport.test.ts lib/booking/transport.ts
git commit -m "feat: vary Daymark demo availability"
```

---

### Task 2: Editorial custom-widget setup note

**Files:**
- Modify: `tests/homepage-showcase.test.tsx:7-111`
- Modify: `tests/rendered-html.test.mjs:27-47`
- Modify: `app/page.tsx:72-79`
- Modify: `app/globals.css:2423,2491,2658-2681`

**Interfaces:**
- Consumes: existing `.widget-options`, `.widget-setup`, Daymark colour variables, and `/workspace/sign-in` route.
- Produces: `.widget-setup` containing an instruction paragraph and `.widget-contact-note`; the contact note contains no `a`, `button`, or focusable control.

- [ ] **Step 1: Write failing homepage tests for the static contact prompt**

Import the homepage in `tests/homepage-showcase.test.tsx`:

```ts
import Home from "../app/page";
```

Add this test after the `WidgetOptionsShowcase` tests:

```tsx
describe("homepage widget setup note", () => {
  it("presents custom work as information until a contact route exists", async () => {
    const container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    await act(async () => root?.render(createElement(Home)));

    const setup = container.querySelector<HTMLElement>(".widget-setup");
    const contact = container.querySelector<HTMLElement>(".widget-contact-note");

    expect(setup?.textContent).toContain("Use the embed position that suits your layout");
    expect(setup?.querySelector('a[href="/workspace/sign-in"]')).not.toBeNull();
    expect(contact?.textContent).toContain("For custom widgets or integrations, contact us.");
    expect(contact?.querySelector("a, button, [tabindex]")).toBeNull();
  });
});
```

Also add this assertion to the first test in `tests/rendered-html.test.mjs`:

```js
assert.match(html, /For custom widgets or integrations, contact us\./i);
```

- [ ] **Step 2: Run the focused component test and verify the prompt is absent**

```powershell
npm run unit -- tests/homepage-showcase.test.tsx
```

Expected: FAIL because `.widget-contact-note` does not exist.

- [ ] **Step 3: Add the semantic setup strip markup**

Replace the current single `<p className="widget-setup">` in `app/page.tsx` with:

```tsx
<div className="widget-setup">
  <p>
    Use the embed position that suits your layout, then{" "}
    <a href="/workspace/sign-in">sign in to the staff workspace</a> to set it up.
  </p>
  <p className="widget-contact-note">
    <span className="widget-contact-label">Custom fit</span>
    <span>For custom widgets or integrations, <strong>contact us.</strong></span>
  </p>
</div>
```

The `contact us` words remain plain strong text, not an inert link.

- [ ] **Step 4: Style the setup strip with the existing paper system**

Remove `.widget-setup` from the shared paragraph declaration at `app/globals.css:2491`, then replace the current one-line `.widget-setup` declaration at `app/globals.css:2658` with:

```css
.widget-setup {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(280px, 0.72fr);
  align-items: center;
  gap: 1rem clamp(1.5rem, 4vw, 4rem);
  margin-top: clamp(2.5rem, 6vw, 5rem);
  padding-top: 1rem;
  border-top: 1px solid var(--rule);
  color: var(--ink);
  font-size: 0.82rem;
  line-height: 1.55;
}

.widget-setup > p { margin: 0; }
.widget-setup a, .product-footer a { color: var(--ink); font-weight: 800; }

.widget-contact-note {
  display: grid;
  grid-template-columns: auto 1fr;
  align-items: center;
  gap: 0.8rem;
  padding: 0.8rem 1rem;
  border: 1px solid var(--ink);
  background: var(--paper-light);
  box-shadow: 4px 4px 0 var(--coral);
}

.widget-contact-label {
  padding: 0.38rem 0.52rem;
  background: var(--ochre);
  color: var(--ink);
  font-size: 0.56rem;
  font-weight: 850;
  letter-spacing: 0.12em;
  text-transform: uppercase;
}

.widget-contact-note strong { font-weight: 850; }
```

Add this rule inside the existing `@media (max-width: 720px)` block:

```css
.widget-setup { grid-template-columns: 1fr; align-items: start; }
```

- [ ] **Step 5: Run the focused homepage tests**

```powershell
npm run unit -- tests/homepage-showcase.test.tsx
```

Expected: all homepage showcase tests PASS, including the non-interactive contact assertion.

- [ ] **Step 6: Commit the widget setup strip**

```powershell
git add -- app/page.tsx app/globals.css tests/homepage-showcase.test.tsx tests/rendered-html.test.mjs
git commit -m "feat: finish Daymark homepage setup note"
```

---

### Task 3: Regression and visual verification

**Files:**
- Verify: `app/page.tsx`
- Verify: `app/globals.css`
- Verify: `lib/booking/transport.ts`
- Verify: `tests/booking-transport.test.ts`
- Verify: `tests/homepage-showcase.test.tsx`
- Verify: `tests/rendered-html.test.mjs`

**Interfaces:**
- Consumes: the two independently committed homepage changes.
- Produces: a clean, buildable homepage verified at desktop and mobile widths with no production booking changes.

- [ ] **Step 1: Run all unit tests**

```powershell
npm run unit
```

Expected: all Vitest suites PASS.

- [ ] **Step 2: Run lint**

```powershell
npm run lint
```

Expected: exit code 0 with no ESLint errors.

- [ ] **Step 3: Run the production build and server-rendered regression test**

```powershell
npm test
```

Expected: the vinext production build succeeds and every Node rendered-HTML test PASSES, including the custom-widget copy assertion.

- [ ] **Step 4: Inspect the local homepage at desktop width**

At `http://localhost:3000/#demo`, choose Maya and verify seven enabled dates, varied times across dates, a different pattern for Theo, and demonstration-only completion. At `http://localhost:3000/#widget-options`, verify the setup instruction and paper-style custom-fit note sit side by side, the note is non-interactive, and the widget cards remain uncrowded.

- [ ] **Step 5: Inspect the homepage at a 390-pixel mobile width**

Verify the setup copy stacks in reading order without horizontal scrolling, all seven date cards remain reachable, and no text or focus indicator is clipped.

- [ ] **Step 6: Confirm the final repository state**

```powershell
git status --short
git log -3 --oneline
```

Expected: the working tree is clean and the design, demonstration availability, and setup-note commits are present.
