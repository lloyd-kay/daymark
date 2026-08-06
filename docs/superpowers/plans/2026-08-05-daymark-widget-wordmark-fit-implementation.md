# Daymark Widget Wordmark Fit Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the complete Daymark wordmark fit inside both homepage widget-preview artworks while preserving the floating booking panel, then close the outstanding keyboard QA in Chrome.

**Architecture:** Keep the existing `public/og.png` asset and `HostHero` structure. Add one shared artwork modifier to both previews and override only background sizing and positioning; preserve every panel and selection interaction. Treat Chrome visual, network, console, responsive, and real Tab traversal evidence as a separate reviewable QA task.

**Tech Stack:** React 19, TypeScript, CSS, Vitest with jsdom, vinext, Codex Chrome Browser.

## Global Constraints

- Both widget preview artwork elements contain all seven letters of `DAYMARK` at a legible scale before layering.
- The inline artwork shows the complete wordmark unobstructed.
- The floating booking panel remains present in its current position and naturally overlaps the corrected artwork without being hidden or moved.
- Use the existing `public/og.png`; do not introduce or redraw an image asset.
- Apply `background-size: auto 76%` and `background-position: 30% center` through one shared full-wordmark modifier class; at or below 520 px, override only the size to `auto 52%`.
- Desktop and mobile layouts keep their current dimensions, spacing, rounded artwork shape, and lack of horizontal overflow.
- The two widget choice buttons retain their local-only `aria-pressed` behaviour and make no network requests.
- Chrome must prove real forward-Tab traversal from the preceding `Start real booking` link to the floating choice button and then the inline choice button.
- Do not change authentication, booking, administrator, persistence, embed, or deployment behaviour.
- Do not deploy or publish.

---

### Task 1: Fit the Daymark artwork in both widget previews

**Files:**
- Modify: `tests/homepage-showcase.test.tsx`
- Modify: `app/home/WidgetOptionsShowcase.tsx:28-30`
- Modify: `app/globals.css:2548-2549`

**Interfaces:**
- Consumes: `HostHero({ inline?: boolean })` and the existing `.widget-host-art`, `.floating-panel`, and `.widget-choice-select` classes.
- Produces: the shared `.widget-host-art-full-wordmark` class on both artwork elements; no new public API.

- [x] **Step 1: Write the failing component regression test**

Add this test inside the existing `describe("WidgetOptionsShowcase", ...)` block:

```tsx
it("fits the full Daymark artwork in both previews without removing the floating panel", async () => {
  const container = await renderShowcase();
  const artwork = Array.from(container.querySelectorAll<HTMLElement>(".widget-host-art"));

  expect(artwork).toHaveLength(2);
  expect(artwork.every((element) => element.classList.contains("widget-host-art-full-wordmark"))).toBe(true);
  expect(container.querySelector(".widget-choice-floating .floating-panel")).not.toBeNull();
});
```

- [x] **Step 2: Run the focused test and verify RED**

Run:

```powershell
& '.\node_modules\.bin\vitest.cmd' run tests/homepage-showcase.test.tsx
```

Expected: the new test fails because the artwork elements do not yet contain `widget-host-art-full-wordmark`; the existing two tests pass.

- [x] **Step 3: Add the minimum shared modifier**

Change the `HostHero` artwork markup to:

```tsx
<div className="widget-host-art widget-host-art-full-wordmark" />
```

Immediately after the existing `.widget-host-art` rule, add:

```css
.widget-host-art-full-wordmark {
  background-size: auto 76%;
  background-position: 30% center;
}
```

Do not change `.floating-panel` or any selection logic.

- [x] **Step 4: Run focused and full unit verification**

Run:

```powershell
& '.\node_modules\.bin\vitest.cmd' run tests/homepage-showcase.test.tsx
npm.cmd run unit
```

Expected: focused file passes 3/3; the full unit suite passes 147/147.

- [x] **Step 5: Check the production diff and commit**

Run:

```powershell
git diff --check
git diff -- app/home/WidgetOptionsShowcase.tsx app/globals.css tests/homepage-showcase.test.tsx
git add -- app/home/WidgetOptionsShowcase.tsx app/globals.css tests/homepage-showcase.test.tsx
git commit -m "fix: fit Daymark wordmarks in widget previews"
```

Expected: only the test, one shared modifier class in the component, and the two CSS declarations change.

---

### Task 1A: Add the approved narrow-screen artwork fit

**Files:**
- Create: `tests/homepage-css.test.ts`
- Modify: `app/globals.css:2628-2635`

**Interfaces:**
- Consumes: Task 1's `.widget-host-art-full-wordmark` class and the existing `@media (max-width: 520px)` block.
- Produces: an `auto 52%` mobile-only size override; desktop remains `auto 76%` at `30% center`.

- [x] **Step 1: Write the failing stylesheet regression test**

Create `tests/homepage-css.test.ts`:

```ts
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const styles = readFileSync(new URL("../app/globals.css", import.meta.url), "utf8");

describe("homepage widget artwork CSS", () => {
  it("scales the full Daymark artwork down at the narrow breakpoint", () => {
    const breakpointStart = styles.indexOf("@media (max-width: 520px)");
    const breakpointEnd = styles.indexOf("\n}", breakpointStart) + 2;
    const narrowStyles = styles.slice(breakpointStart, breakpointEnd);

    expect(narrowStyles).toContain(".widget-host-art-full-wordmark { background-size: auto 52%; }");
  });
});
```

- [x] **Step 2: Run the focused test and verify RED**

Run:

```powershell
& '.\node_modules\.bin\vitest.cmd' run tests/homepage-css.test.ts
```

Expected: 1/1 fails because the 520 px media query does not yet include `background-size: auto 52%`.

- [x] **Step 3: Add the approved mobile override**

Inside the existing `@media (max-width: 520px)` block, add:

```css
.widget-host-art-full-wordmark { background-size: auto 52%; }
```

Do not change background position, artwork dimensions, or `.floating-panel`.

- [x] **Step 4: Run focused and full unit verification**

Run:

```powershell
& '.\node_modules\.bin\vitest.cmd' run tests/homepage-css.test.ts
npm.cmd run unit
```

Expected: focused test passes 1/1; full suite passes 22 files and 148/148 tests.

- [x] **Step 5: Check and commit the responsive amendment**

Run:

```powershell
git diff --check
git add -- tests/homepage-css.test.ts app/globals.css docs/superpowers/specs/2026-08-05-daymark-inline-wordmark-fit-design.md docs/superpowers/plans/2026-08-05-daymark-widget-wordmark-fit-implementation.md
git commit -m "fix: fit Daymark wordmarks on mobile"
```

---

### Task 2: Verify corrected previews and keyboard order in Chrome

**Files:**
- Create: `qa-evidence/daymark-homepage/wordmark-crop-user-report.png`
- Create: `qa-evidence/daymark-homepage/wordmark-fit-desktop-chrome.png`
- Create: `qa-evidence/daymark-homepage/wordmark-fit-desktop-1775x1234-chrome.png`
- Create: `qa-evidence/daymark-homepage/wordmark-fit-mobile-chrome.png`
- Create: `qa-evidence/daymark-homepage/wordmark-fit-mobile-inline-chrome.png`
- Create: `qa-evidence/daymark-homepage/keyboard-focus-floating-chrome.png`
- Create: `qa-evidence/daymark-homepage/keyboard-focus-inline-chrome.png`
- Create: `qa-evidence/daymark-homepage/chrome-wordmark-qa.json`
- Modify: `design-qa.md`

**Interfaces:**
- Consumes: the Task 1 `.widget-host-art-full-wordmark` implementation and the two existing `.widget-choice-select` buttons.
- Produces: portable Chrome evidence and a truthful `design-qa.md` final result.

- [x] **Step 1: Preserve the user's source screenshot**

Copy the exact source image without modifying it:

```powershell
Copy the supplied local reference image to `qa-evidence/daymark-homepage/wordmark-crop-user-report.png`.
```

Expected: the tracked copy exists and opens successfully.

- [x] **Step 2: Capture and compare desktop Chrome state**

Use only the explicitly approved Chrome Browser. Open `http://localhost:3000/#widget-options`, set a 1280 x 890 viewport, reload, and wait for `load`.

Record these computed values for both `.widget-host-art` elements:

```json
{
  "class": "widget-host-art widget-host-art-full-wordmark",
  "backgroundSize": "auto 76%",
  "backgroundPosition": "30% 50%"
}
```

Capture `wordmark-fit-desktop-chrome.png`. Open it in the same comparison input as `wordmark-crop-user-report.png`. Verify the smaller image in both previews, the complete unobstructed inline `DAYMARK`, the unchanged floating panel, and unclipped cards, controls, and copy.

- [x] **Step 3: Capture and compare mobile Chrome state**

Set a 390 x 844 viewport, reload, and capture `wordmark-fit-mobile-chrome.png` at the widget section. Record `scrollWidth === clientWidth`. Verify the cards stack floating then inline, both artwork slots retain their rounded silhouette, the inline wordmark is complete, and the floating panel remains present.

- [x] **Step 4: Prove sequential keyboard traversal in Chrome**

Return to 1280 x 890. Use the unique `.hero-secondary` link named `Start real booking` as the preceding focus point, then send a genuine forward `Tab` key event in Chrome.

Expected active element and state:

```json
{
  "tagName": "BUTTON",
  "name": "Always close, never in the way",
  "ariaPressed": "true",
  "focusVisible": true
}
```

Capture `keyboard-focus-floating-chrome.png`, send one more genuine forward `Tab`, and expect:

```json
{
  "tagName": "BUTTON",
  "name": "A booking section with presence",
  "ariaPressed": "false",
  "focusVisible": true
}
```

Capture `keyboard-focus-inline-chrome.png`. Do not use direct DOM `focus()` on either target button as traversal evidence.

- [x] **Step 5: Verify option behaviour, network boundary, and console**

Start Chrome network monitoring before reloading `/`, classify every initial request, then click inline and floating. Record methods, URLs, resource types, `aria-pressed` changes, and console warn/error entries in `chrome-wordmark-qa.json`.

Expected: zero booking, availability, employee, configuration, or mutation endpoint requests; inline changes states to floating `false` and inline `true`; floating restores `true` and `false`; console has zero warnings, errors, or hydration messages.

- [x] **Step 6: Update the design QA record**

Update `design-qa.md` with relative evidence paths, the desktop/mobile comparison, computed artwork values, sequential Chrome focus results, initial-load and interaction network results, and console results.

End with exactly:

```text
final result: passed
```

Use `passed` only if every visual and keyboard criterion succeeds. Otherwise end with `final result: blocked` and report the failing criterion.

- [x] **Step 7: Run final verification and commit QA evidence**

Run:

```powershell
npm.cmd run unit
npm.cmd run lint
$env:WRANGLER_LOG_PATH='.wrangler/wrangler.log'; & '.\node_modules\.bin\vinext.cmd' build
node --test tests/rendered-html.test.mjs
git diff --check
git status --short
```

Expected: 22 unit files and 148/148 tests pass; lint passes; the production build completes all five stages; rendered routes pass 6/6; diff check is clean.

Commit:

```powershell
git add -- design-qa.md qa-evidence/daymark-homepage
git commit -m "test: verify Daymark wordmark fit in Chrome"
```

Do not deploy.
