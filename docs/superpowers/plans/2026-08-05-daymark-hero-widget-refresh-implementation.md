# Daymark Hero Colour and Widget Preview Refresh Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add tactile Daymark-coloured paper layers to the homepage hero and restore the previously approved, selectable floating and inline widget previews without changing live booking, authentication, or administrator behavior.

**Architecture:** Keep `app/page.tsx` as the server-rendered product homepage, add one focused client component for local-only widget-option selection, and scope all new styling beneath the existing product-home classes. The previews reproduce the recovered Cedar House composition as semantic HTML, use the existing `/og.png` asset for the miniature host-site artwork, and never call a booking or configuration API.

**Tech Stack:** React 19, TypeScript 5.9, Vinext 1, Vitest with jsdom, Node rendered-route tests, existing Daymark CSS tokens, and the in-app browser for Product Design QA.

## Global Constraints

- Preserve the current page structure, copy, routes, privacy promises, no-write demonstration, footer, authentication, booking behavior, and administrator tools.
- The homepage remains demonstration-only and performs no booking or availability network requests.
- `/book` remains the only standalone live booking page.
- Use `.superpowers/brainstorm/79-1785918956/content/widget-options.html` as the source of truth for the widget preview composition and copy.
- Keep the heading text “Scheduling without shared calendars.” in a readable three-line composition at wide widths.
- Use the existing `--coral`, `--sage`, `--lilac`, `--ochre`, `--sky`, `--ink`, and paper tokens; introduce no new palette or illustration language.
- Both widget options remain visible, use real `button` controls with `aria-pressed`, and change only local presentational state.
- Decorative preview content is `aria-hidden="true"`; meaningful option names, descriptions, and selection controls remain exposed.
- Introduce no new dependencies and no new route.
- Do not publish or deploy. The verified local result remains behind the existing explicit deployment-approval gate.
- A verified recovery snapshot exists at `outputs/backups/daymark-2026-08-05-133348` with baseline HEAD `c3ad6facee34dce79f814b199f5efe4a4a53d05e`.

---

## File Structure

- Create `app/home/WidgetOptionsShowcase.tsx`: client-only presentational selection state plus both Cedar House previews.
- Modify `app/page.tsx`: add the three hero paper-line spans and replace the simplified widget-card grid with `WidgetOptionsShowcase` while preserving surrounding copy and links.
- Modify `app/globals.css`: add product-scoped hero layers, widget-choice controls, miniature host-browser styling, selected/focus states, and responsive rules.
- Create `tests/homepage-showcase.test.tsx`: exercise option semantics, local selection, restored preview content, and the no-network boundary.
- Modify `tests/rendered-html.test.mjs`: assert the server-rendered hero structure, restored option copy, and absence of live-booking confirmation UI on `/`.
- Create `design-qa.md`: record reference, desktop/mobile browser checks, interaction checks, console result, issue disposition, and `final result: passed`.

---

### Task 1: Layer the Homepage Hero with Daymark Paper Colours

**Files:**
- Modify: `tests/rendered-html.test.mjs`
- Modify: `app/page.tsx:1-38`
- Modify: `app/globals.css:2404-2414,2450-2464`

**Interfaces:**
- Consumes: existing `h1#product-title`, Daymark colour variables in `app/globals.css`, and the current product hero layout.
- Produces: three `.product-title-line` wrappers with modifiers `title-line-coral`, `title-line-lilac`, and `title-line-sky`; each wrapper contains one `.product-title-paper` span.

- [ ] **Step 1: Write the failing rendered-route assertions**

Replace the two current homepage heading assertions in `tests/rendered-html.test.mjs` with assertions that keep the full accessible copy and require all three visual lines:

```js
  assert.match(html, /Scheduling without shared calendars\./i);
  assert.match(html, /product-title-line title-line-coral/);
  assert.match(html, /product-title-line title-line-lilac/);
  assert.match(html, /product-title-line title-line-sky/);
```

- [ ] **Step 2: Run the rendered-route test and confirm the new contract fails**

Run in PowerShell:

```powershell
$env:WRANGLER_LOG_PATH='.wrangler/wrangler.log'
& '.\node_modules\.bin\vinext.cmd' build
node --test tests/rendered-html.test.mjs
```

Expected: the homepage test fails because the three `product-title-line` classes are not yet in the rendered HTML.

- [ ] **Step 3: Add the exact three-line heading structure**

Replace the plain heading in `app/page.tsx` with:

```tsx
<h1 id="product-title" aria-label="Scheduling without shared calendars.">
  <span className="product-title-line title-line-coral" aria-hidden="true">
    <span className="product-title-paper">Scheduling</span>
  </span>
  <span className="product-title-line title-line-lilac" aria-hidden="true">
    <span className="product-title-paper">without shared</span>
  </span>
  <span className="product-title-line title-line-sky" aria-hidden="true">
    <span className="product-title-paper">calendars.</span>
  </span>
</h1>
```

The `aria-label` supplies the uninterrupted heading text; only the decorative line duplication is hidden.

- [ ] **Step 4: Add product-scoped paper-layer styling**

Replace the single `.product-hero h1` rule and add the following adjacent rules in `app/globals.css`:

```css
.product-hero h1 {
  max-width: 900px;
  display: grid;
  justify-items: start;
  gap: clamp(0.4rem, 0.8vw, 0.75rem);
  font-size: clamp(3.35rem, 7.3vw, 7.7rem);
  line-height: 0.88;
}

.product-hero h1 .product-title-line {
  position: relative;
  isolation: isolate;
  display: block;
  width: fit-content;
  margin: 0;
  color: var(--ink);
  font-style: normal;
}

.product-title-line:nth-child(2) { margin-left: clamp(0rem, 3.2vw, 3rem); }
.product-title-line:nth-child(3) { margin-left: clamp(0rem, 7.2vw, 6.2rem); }

.product-hero h1 .product-title-paper {
  position: relative;
  z-index: 2;
  display: block;
  margin: 0;
  padding: 0.03em 0.14em 0.1em;
  border: 1px solid var(--ink);
  background: var(--paper-light);
  color: var(--ink);
  box-shadow: 0.055em 0.06em 0 var(--ink);
  font-style: normal;
}

.product-title-line::before,
.product-title-line::after {
  content: "";
  position: absolute;
  z-index: 0;
  border: 1px solid var(--ink);
  pointer-events: none;
}

.product-title-line::before { inset: -0.08em -0.2em 0.08em 0.16em; transform: rotate(-0.8deg); }
.product-title-line::after { inset: 0.09em 0.14em -0.13em -0.16em; transform: rotate(0.65deg); }
.title-line-coral::before { background: var(--coral); }
.title-line-coral::after { background: var(--sage); }
.title-line-lilac::before { background: var(--lilac); }
.title-line-lilac::after { background: var(--ochre); }
.title-line-sky::before { background: var(--sky); }
.title-line-sky::after { background: var(--coral); }
```

Inside the existing `@media (max-width: 720px)` block, add:

```css
  .product-hero h1 {
    font-size: clamp(2.75rem, 13vw, 4.6rem);
    gap: 0.45rem;
  }

  .product-title-line:nth-child(2),
  .product-title-line:nth-child(3) { margin-left: 0; }

  .product-hero h1 .product-title-paper { padding-inline: 0.1em; }
```

- [ ] **Step 5: Run the focused and whitespace checks**

Run:

```powershell
$env:WRANGLER_LOG_PATH='.wrangler/wrangler.log'
& '.\node_modules\.bin\vinext.cmd' build
node --test tests/rendered-html.test.mjs
git diff --check
```

Expected: all rendered-route tests pass and `git diff --check` prints no errors.

- [ ] **Step 6: Commit the independently reviewable hero change**

```powershell
git add app/page.tsx app/globals.css tests/rendered-html.test.mjs
git commit -m "feat: add Daymark paper layers to homepage hero"
```

---

### Task 2: Restore Selectable Floating and Inline Widget Previews

**Files:**
- Create: `app/home/WidgetOptionsShowcase.tsx`
- Create: `tests/homepage-showcase.test.tsx`
- Modify: `app/page.tsx:1-94`
- Modify: `app/globals.css:2422-2464`
- Modify: `tests/rendered-html.test.mjs`

**Interfaces:**
- Consumes: no props and no application service; reads only bundled markup and `/og.png`.
- Produces: `export function WidgetOptionsShowcase(): React.JSX.Element` with local state type `"floating" | "inline"`.
- Produces: two `.widget-choice-select` buttons carrying `aria-pressed`, one for “Floating” and one for “Inline”.
- Produces: static `.floating-panel` and `.inline-panel` preview content inside `aria-hidden="true"` containers.

- [ ] **Step 1: Write the failing component test**

Create `tests/homepage-showcase.test.tsx` with this complete test harness:

```tsx
/** @vitest-environment jsdom */

import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { WidgetOptionsShowcase } from "../app/home/WidgetOptionsShowcase";

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

let root: Root | undefined;

beforeEach(() => {
  document.body.replaceChildren();
  vi.stubGlobal("fetch", vi.fn());
});

afterEach(async () => {
  if (root) await act(async () => root?.unmount());
  root = undefined;
  vi.unstubAllGlobals();
});

describe("WidgetOptionsShowcase", () => {
  it("restores both previews and changes only local accessible selection state", async () => {
    const container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    await act(async () => root?.render(createElement(WidgetOptionsShowcase)));

    expect(container.textContent).toContain("Always close, never in the way");
    expect(container.textContent).toContain("A booking section with presence");
    expect(container.querySelectorAll(".widget-host-browser")).toHaveLength(2);
    expect(container.textContent).toContain("Maya");
    expect(container.textContent).toContain("Theo");
    expect(container.textContent).toContain("Priya");
    expect(container.textContent).toContain("Jon");

    const controls = Array.from(container.querySelectorAll<HTMLButtonElement>(".widget-choice-select"));
    expect(controls).toHaveLength(2);
    expect(controls[0].getAttribute("aria-pressed")).toBe("true");
    expect(controls[1].getAttribute("aria-pressed")).toBe("false");

    await act(async () => controls[1].click());

    expect(controls[0].getAttribute("aria-pressed")).toBe("false");
    expect(controls[1].getAttribute("aria-pressed")).toBe("true");
    expect(fetch).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run the focused unit test and confirm it fails**

Run:

```powershell
npm.cmd run unit -- --run tests/homepage-showcase.test.tsx
```

Expected: Vitest fails because `app/home/WidgetOptionsShowcase.tsx` does not exist.

- [ ] **Step 3: Create the client-only selection component**

Create `app/home/WidgetOptionsShowcase.tsx` with:

```tsx
"use client";

import { useState, type ReactNode } from "react";

type WidgetPlacement = "floating" | "inline";

function HostBrowser({ children }: { children: ReactNode }) {
  return (
    <div className="widget-host-browser">
      <div className="widget-host-bar"><i /><i /><i /></div>
      <div className="widget-host-nav">
        <strong>CEDAR HOUSE</strong>
        <span className="widget-host-links"><i>ABOUT</i><i>SERVICES</i><i>JOURNAL</i></span>
      </div>
      {children}
    </div>
  );
}

function HostHero({ inline = false }: { inline?: boolean }) {
  return (
    <div className="widget-host-hero">
      <div>
        <span className="widget-host-kicker">Considered spaces</span>
        <strong>{inline ? <>Start with a<br />conversation.</> : <>Room to feel<br />at home.</>}</strong>
        <p>{inline ? "The booking experience becomes part of a dedicated contact or services page." : "A sample host website keeps its own visual identity while Daymark waits quietly in the corner."}</p>
      </div>
      <div className="widget-host-art" />
    </div>
  );
}

export function WidgetOptionsShowcase() {
  const [selected, setSelected] = useState<WidgetPlacement>("floating");

  return (
    <div className="widget-choice-grid" aria-label="Widget presentation options">
      <article className={`widget-choice widget-choice-floating${selected === "floating" ? " is-selected" : ""}`}>
        <div className="widget-host-page" aria-hidden="true">
          <HostBrowser>
            <HostHero />
            <div className="widget-host-strip" />
            <div className="floating-panel">
              <span className="widget-preview-eyebrow">DAYMARK · BOOKING</span>
              <strong>Who would you<br />like to meet?</strong>
              <div className="widget-person-row"><span className="active">Maya</span><span>Theo</span><span>Priya</span></div>
              <div className="widget-slot-row"><span>10:30</span><span>13:00</span><span>15:30</span></div>
            </div>
            <div className="widget-daymark-fab"><span>D</span>Book an appointment</div>
          </HostBrowser>
        </div>
        <div className="widget-choice-copy">
          <span className="widget-choice-label">Option A · Floating</span>
          <h3 id="floating-widget-title">Always close, never in the way</h3>
          <p id="floating-widget-description">A compact corner button opens the booking panel over any page. Best when booking should be available site-wide.</p>
          <button className="widget-choice-select" type="button" aria-pressed={selected === "floating"} aria-labelledby="floating-widget-title" aria-describedby="floating-widget-description" onClick={() => setSelected("floating")}>{selected === "floating" ? "Selected" : "Choose this layout"}</button>
        </div>
      </article>

      <article className={`widget-choice widget-choice-inline${selected === "inline" ? " is-selected" : ""}`}>
        <div className="widget-host-page" aria-hidden="true">
          <HostBrowser>
            <HostHero inline />
            <div className="inline-panel">
              <div className="inline-rail"><strong>DAYMARK</strong><span>01 / 03</span></div>
              <div className="inline-main">
                <div className="inline-head"><div><span className="widget-preview-eyebrow">BOOK THE RIGHT PERSON</span><strong>Choose your person.</strong></div><span>PERSON → DATE → TIME</span></div>
                <div className="inline-grid"><span>PLANNING<b>Maya</b></span><span>DESIGN<b>Theo</b></span><span>CARE<b>Priya</b></span><span>DETAILS<b>Jon</b></span></div>
              </div>
            </div>
          </HostBrowser>
        </div>
        <div className="widget-choice-copy">
          <span className="widget-choice-label">Option B · Inline</span>
          <h3 id="inline-widget-title">A booking section with presence</h3>
          <p id="inline-widget-description">The full panel sits inside a page and feels intentional. Best for a dedicated contact or “book now” section.</p>
          <button className="widget-choice-select" type="button" aria-pressed={selected === "inline"} aria-labelledby="inline-widget-title" aria-describedby="inline-widget-description" onClick={() => setSelected("inline")}>{selected === "inline" ? "Selected" : "Choose this layout"}</button>
        </div>
      </article>
    </div>
  );
}
```

The CSS for `.widget-host-art` must use the real existing asset with `background-image: url("/og.png")`, never a generated gradient or placeholder drawing.

- [ ] **Step 4: Wire the component into the server homepage**

In `app/page.tsx`, remove `ArrowUpRight` only if it is no longer used elsewhere, import the new component, and replace the existing `.widget-grid` block with:

```tsx
<WidgetOptionsShowcase />
```

Keep the existing `section#widget-options`, heading, explanatory paragraph, and `.widget-setup` staff-workspace link unchanged.

- [ ] **Step 5: Port the recovered preview styling into Daymark’s production selectors**

Replace `.widget-grid`, `.widget-card`, `.launcher-card`, `.panel-card`, `.launcher-preview`, and `.panel-preview` rules with this complete production block:

```css
.widget-choice-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: clamp(1.3rem, 3vw, 2.6rem);
  margin-top: clamp(2.2rem, 5vw, 4.5rem);
}

.widget-choice {
  --widget-choice-accent: var(--coral);
  position: relative;
  min-width: 0;
  border: 1px solid var(--ink);
  background: var(--paper-light);
  box-shadow: 7px 7px 0 var(--ink);
  transition: transform 160ms ease, outline-color 160ms ease;
}

.widget-choice-inline { --widget-choice-accent: var(--sage); }
.widget-choice.is-selected { outline: 5px solid var(--widget-choice-accent); outline-offset: 3px; transform: translateY(-4px); }
.widget-choice:has(.widget-choice-select:focus-visible) { outline: 4px solid var(--coral); outline-offset: 6px; }

.widget-host-page {
  min-height: 390px;
  padding: 18px;
  background: var(--paper-deep);
  overflow: hidden;
}

.widget-host-browser {
  position: relative;
  min-height: 352px;
  border: 1px solid var(--rule);
  border-radius: 13px;
  background: var(--paper-light);
  overflow: hidden;
}

.widget-host-bar {
  height: 25px;
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 0 10px;
  background: var(--ink);
}

.widget-host-bar i { width: 6px; height: 6px; border-radius: 50%; background: var(--paper-deep); opacity: 0.8; }
.widget-host-nav { display: flex; align-items: center; justify-content: space-between; padding: 17px 20px; color: var(--ink); font-size: 0.62rem; letter-spacing: 0.12em; }
.widget-host-nav strong { font-size: inherit; }
.widget-host-links { display: flex; gap: 13px; color: var(--ink-soft); font-size: 0.5rem; }
.widget-host-links i { font-style: normal; }

.widget-host-hero {
  display: grid;
  grid-template-columns: 1.1fr 0.9fr;
  gap: 16px;
  padding: 34px 20px 28px;
}

.widget-host-kicker { color: var(--coral); font-size: 0.5rem; font-weight: 850; letter-spacing: 0.16em; text-transform: uppercase; }
.widget-host-hero > div > strong { display: block; margin: 8px 0 9px; font-family: var(--font-display), Georgia, serif; font-size: clamp(1.45rem, 2.25vw, 2rem); font-weight: 520; line-height: 0.98; }
.widget-host-hero p { max-width: 210px; margin: 0; color: var(--ink-soft); font-size: 0.56rem; line-height: 1.55; }
.widget-host-art { min-height: 170px; border: 1px solid var(--rule); border-radius: 90px 90px 12px 12px; background: var(--paper-deep) url("/og.png") 72% center / cover no-repeat; }
.widget-host-strip { height: 42px; margin: 0 20px; border-top: 1px solid var(--rule); }

.floating-panel {
  position: absolute;
  right: 14px;
  bottom: 57px;
  width: 205px;
  padding: 14px;
  border: 1px solid var(--rule);
  border-radius: 13px;
  background: var(--paper-light);
  box-shadow: 0 12px 32px rgba(23, 39, 34, 0.18);
}

.widget-preview-eyebrow { color: var(--coral); font-size: 0.44rem; font-weight: 850; letter-spacing: 0.13em; }
.floating-panel > strong { display: block; margin: 6px 0 11px; font-family: var(--font-display), Georgia, serif; font-size: 1.25rem; font-weight: 520; line-height: 0.95; }
.widget-person-row, .widget-slot-row { display: flex; gap: 6px; }
.widget-person-row { margin-bottom: 9px; }
.widget-person-row span { flex: 1; padding: 7px 5px; border: 1px solid var(--rule); border-radius: 8px; color: var(--ink-soft); font-size: 0.44rem; text-align: center; }
.widget-person-row .active { border-color: var(--coral); background: #f7d9cf; color: var(--ink); }
.widget-slot-row span { flex: 1; padding: 6px 3px; border-radius: 6px; background: #dce7d5; font-size: 0.44rem; text-align: center; }

.widget-daymark-fab {
  position: absolute;
  right: 14px;
  bottom: 14px;
  display: flex;
  align-items: center;
  gap: 8px;
  border-radius: 999px;
  padding: 10px 14px 10px 10px;
  background: var(--ink);
  color: var(--paper-light);
  box-shadow: 0 7px 20px rgba(23, 39, 34, 0.28);
  font-size: 0.56rem;
  font-weight: 800;
}

.widget-daymark-fab > span { width: 20px; height: 20px; display: grid; place-items: center; border-radius: 50%; background: var(--coral); font-family: var(--font-display), Georgia, serif; font-size: 0.75rem; }

.inline-panel {
  display: grid;
  grid-template-columns: 70px 1fr;
  min-height: 140px;
  margin: 0 20px 20px;
  border: 1px solid var(--rule);
  border-radius: 12px;
  background: var(--paper-light);
  box-shadow: 0 8px 18px rgba(23, 39, 34, 0.08);
  overflow: hidden;
}

.inline-rail { display: flex; flex-direction: column; justify-content: space-between; padding: 13px 10px; background: var(--coral); color: var(--paper-light); }
.inline-rail strong { font-family: var(--font-display), Georgia, serif; font-size: 0.9rem; font-weight: 520; writing-mode: vertical-rl; transform: rotate(180deg); letter-spacing: 0.08em; }
.inline-rail span { font-size: 0.44rem; opacity: 0.85; }
.inline-main { min-width: 0; padding: 14px; }
.inline-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; }
.inline-head > div > strong { display: block; margin: 3px 0 10px; font-family: var(--font-display), Georgia, serif; font-size: 1.1rem; font-weight: 520; }
.inline-head > span { color: var(--lilac); font-size: 0.44rem; font-weight: 800; letter-spacing: 0.1em; white-space: nowrap; }
.inline-grid { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 6px; }
.inline-grid > span { min-height: 55px; padding: 7px; border-radius: 7px 7px 3px 3px; font-size: 0.44rem; }
.inline-grid > span:nth-child(1) { background: #dce7d5; }
.inline-grid > span:nth-child(2) { background: #e5dced; }
.inline-grid > span:nth-child(3) { background: #f2dfad; }
.inline-grid > span:nth-child(4) { background: #d9e9f1; }
.inline-grid b { display: block; margin-top: 6px; font-size: 0.58rem; }

.widget-choice-copy { position: relative; padding: clamp(1.3rem, 3vw, 2rem); }
.widget-choice-label { display: inline-flex; align-items: center; gap: 7px; margin-bottom: 0.8rem; color: var(--coral); font-size: 0.64rem; font-weight: 850; letter-spacing: 0.13em; text-transform: uppercase; }
.widget-choice-label::before { content: ""; width: 7px; height: 7px; border-radius: 50%; background: currentColor; }
.widget-choice-copy h3 { margin: 0; font-family: var(--font-display), Georgia, serif; font-size: clamp(1.55rem, 2.4vw, 2.25rem); font-weight: 520; letter-spacing: -0.04em; line-height: 1; }
.widget-choice-copy p { margin: 0.65rem 0 1.2rem; color: var(--ink-soft); font-size: 0.82rem; line-height: 1.55; }
.widget-choice-select { min-height: 44px; border: 1px solid var(--ink); padding: 0.65rem 0.9rem; background: transparent; color: var(--ink); cursor: pointer; font-size: 0.72rem; font-weight: 800; }
.widget-choice-select[aria-pressed="true"] { background: var(--ink); color: var(--paper-light); }

@media (max-width: 850px) {
  .widget-choice-grid { grid-template-columns: 1fr; }
}

@media (max-width: 520px) {
  .widget-host-page { min-height: 330px; padding: 10px; }
  .widget-host-browser { min-height: 310px; }
  .widget-host-links { display: none; }
  .floating-panel { width: min(205px, calc(100% - 28px)); }
  .inline-panel { grid-template-columns: 52px 1fr; margin-inline: 10px; }
  .inline-grid { grid-template-columns: repeat(2, 1fr); }
}
```

Remove every obsolete simplified-widget selector after confirming no remaining markup uses it.

- [ ] **Step 6: Update the server-rendered homepage contract**

In `tests/rendered-html.test.mjs`, replace `/Floating widget/i` and `/Inline panel/i` with:

```js
  assert.match(html, /Always close, never in the way/i);
  assert.match(html, /A booking section with presence/i);
  assert.match(html, /Cedar House/i);
  assert.match(html, /aria-pressed="true"/i);
  assert.doesNotMatch(html, /Confirm appointment/i);
```

- [ ] **Step 7: Run focused tests, lint, build, and rendered-route checks**

Run:

```powershell
npm.cmd run unit -- --run tests/homepage-showcase.test.tsx
npm.cmd run lint
$env:WRANGLER_LOG_PATH='.wrangler/wrangler.log'
& '.\node_modules\.bin\vinext.cmd' build
node --test tests/rendered-html.test.mjs
git diff --check
```

Expected: the component test, lint, all rendered-route tests, and production build pass; the no-network assertion remains green.

- [ ] **Step 8: Commit the independently reviewable widget restoration**

```powershell
git add app/home/WidgetOptionsShowcase.tsx app/page.tsx app/globals.css tests/homepage-showcase.test.tsx tests/rendered-html.test.mjs
git commit -m "feat: restore selectable Daymark widget previews"
```

---

### Task 3: Complete Integrated Browser and Product Design QA

**Files:**
- Modify: `app/globals.css` only for concrete P0–P2 visual corrections found during comparison
- Modify: `app/page.tsx` or `app/home/WidgetOptionsShowcase.tsx` only for concrete P0–P2 semantic or interaction corrections
- Create: `design-qa.md`

**Interfaces:**
- Consumes: the completed hero and widget implementation, both user annotation screenshots, and the recovered widget prototype.
- Produces: a browser-verified homepage at `/`, a working `/book` link, a working `/workspace/sign-in` link, and `design-qa.md` ending with the exact line `final result: passed`.

- [ ] **Step 1: Run the full automated regression suite before browser inspection**

Run:

```powershell
npm.cmd run unit
npm.cmd run lint
$env:WRANGLER_LOG_PATH='.wrangler/wrangler.log'
& '.\node_modules\.bin\vinext.cmd' build
node --test tests/rendered-html.test.mjs
git diff --check
```

Expected: every unit test, lint check, build, rendered-route test, and whitespace check passes.

- [ ] **Step 2: Capture the annotated desktop state in the in-app browser**

Use the existing in-app browser only. Set the viewport to `1775 × 1234`, open `/`, and capture:

- the full hero including eyebrow, all three coloured paper lines, summary, actions, and privacy stamp;
- the full `#widget-options` region with both Cedar House previews and setup link.

Compare the hero capture side by side with the user’s annotated hero image and compare the widget capture side by side with `.superpowers/brainstorm/79-1785918956/content/widget-options.html`. Verify no word is clipped, the title remains three lines, all five Daymark colours are visible, both preview browsers are fully framed, and selected state is unmistakable without overwhelming the original layout.

- [ ] **Step 3: Exercise desktop interactions and navigation**

With the same browser session:

- activate the inline option and confirm its `aria-pressed` value becomes `true` while floating becomes `false`;
- activate floating again and confirm the state reverses;
- keyboard-tab to both option controls and confirm the card-level focus outline is visible;
- open the staff setup link and confirm `/workspace/sign-in` renders, then return to `/`;
- open “Start real booking” and confirm `/book` renders, then return to `/`;
- confirm the homepage itself made no booking or availability request while the option controls were used;
- inspect the browser console and require zero new errors or hydration warnings.

- [ ] **Step 4: Capture and inspect the mobile state**

Set the in-app browser viewport to `390 × 844`, reload `/`, and capture the hero and widget section. Require:

- no horizontal page overflow;
- complete heading text with unclipped paper layers;
- a usable primary/secondary action layout;
- widget cards stacked in floating-then-inline order;
- legible miniature browser copy and visible 44px selection controls;
- two-column inline staff tabs at the narrow breakpoint;
- visible keyboard focus and selected state.

- [ ] **Step 5: Fix every P0, P1, and P2 mismatch and repeat both comparisons**

For each mismatch, make the smallest scoped change in the file named in this task, rerun `npm.cmd run unit -- --run tests/homepage-showcase.test.tsx`, recapture at the same viewport and state, and compare again. Do not accept clipped text, overflow, hidden focus, unreadable preview text, missing Daymark colours, broken links, console errors, or a widget composition that no longer matches the recovered prototype.

- [ ] **Step 6: Record the completed visual QA**

Create `design-qa.md` with this exact completed record after every statement has been observed in the browser session:

```markdown
# Daymark homepage design QA

- reference: user annotations for `h1#product-title` and `section#widget-options`; recovered `.superpowers/brainstorm/79-1785918956/content/widget-options.html`
- desktop viewport: 1775 × 1234 — passed; the hero is three unclipped paper lines and both Cedar House previews are fully framed
- mobile viewport: 390 × 844 — passed; the page has no horizontal overflow and the cards stack floating then inline
- widget selection: passed; each option toggles the two `aria-pressed` values without changing routes or stored data
- keyboard focus: passed; both 44px option controls and their card-level focus outlines are visible
- navigation links: passed; staff setup opens `/workspace/sign-in` and real booking opens `/book`
- network boundary: passed; selecting either homepage option makes no booking, availability, or configuration request
- browser console: passed; no errors or hydration warnings
- P0–P2 issues: none remaining

final result: passed
```

- [ ] **Step 7: Re-run the full release checks after the last visual correction**

Run:

```powershell
npm.cmd run unit
npm.cmd run lint
$env:WRANGLER_LOG_PATH='.wrangler/wrangler.log'
& '.\node_modules\.bin\vinext.cmd' build
node --test tests/rendered-html.test.mjs
git diff --check
git status --short
```

Expected: all checks pass; `git status --short` shows only the intended visual implementation and `design-qa.md` before commit.

- [ ] **Step 8: Commit the QA record and any final scoped corrections**

```powershell
git add app/page.tsx app/home/WidgetOptionsShowcase.tsx app/globals.css tests/homepage-showcase.test.tsx tests/rendered-html.test.mjs design-qa.md
git commit -m "test: verify Daymark homepage visual refresh"
```

---

## Plan Self-Review

- Spec coverage: hero palette, three-line structure, restored floating and inline previews, accessible selection, local-only state, setup link preservation, mobile stacking, no overflow, no-network behavior, browser comparison, and deployment exclusion each map to a task above.
- Placeholder scan: the plan contains no deferred implementation markers; component contracts, test content, selectors, copy, commands, viewports, and acceptance criteria are explicit.
- Type consistency: `WidgetPlacement`, `WidgetOptionsShowcase`, `.widget-choice-select`, and each hero modifier use the same names in implementation, tests, styles, and QA steps.

## Execution Choice

The user already selected **Subagent-Driven execution**. Implement this plan task-by-task with a fresh implementer and two-stage review gate per task, then complete a final whole-change review. Do not deploy.
