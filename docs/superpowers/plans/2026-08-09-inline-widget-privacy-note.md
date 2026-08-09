# Inline Widget Privacy Note Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give only the inline embed a compact, wide, slightly overlapping privacy post-it at safe widths while preserving every booking control and stacking safely on narrow screens.

**Architecture:** Keep the change within the embedded booking surface's CSS. A focused Node contract test reads the production stylesheet and locks the wide three-column and narrow stacked states before the stylesheet is changed.

**Tech Stack:** Vinext, React, CSS Grid, Node.js built-in test runner.

## Global Constraints

- Change only the inline embedded booking surface.
- Leave the homepage demonstration and floating booking widget unchanged.
- Preserve booking behaviour, keyboard access, focus order, and all form controls.
- The note may overlap unused cream gutter only; it must never cover interactive content.
- The widget must not introduce horizontal scrolling.
- Verified pre-change backup: `outputs/backups/daymark-2026-08-09-115027`, HEAD `a545838e9b8fdad93696ea50baa14c5d777a6646`.

---

### Task 1: Lock the responsive inline-note layout contract

**Files:**
- Create: `tests/inline-widget-layout.test.mjs`
- Modify: `app/globals.css:923-980`

**Interfaces:**
- Consumes: existing `.embed-shell .booking-studio.is-embedded` and `.privacy-note` elements.
- Produces: a three-column embedded layout above 760px and a stacked embedded layout at or below 760px.

- [ ] **Step 1: Write the failing stylesheet contract test**

```js
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const cssUrl = new URL("../app/globals.css", import.meta.url);

test("keeps the inline privacy note in a compact right-side column", async () => {
  const css = await readFile(cssUrl, "utf8");

  assert.match(
    css,
    /\.embed-shell \.booking-studio\.is-embedded\s*\{[\s\S]*?display:\s*grid;[\s\S]*?grid-template-columns:\s*82px minmax\(0, 1fr\) minmax\(200px, 230px\);/,
  );
  assert.match(
    css,
    /\.embed-shell \.booking-studio\.is-embedded \.privacy-note\s*\{[\s\S]*?grid-column:\s*3;[\s\S]*?grid-row:\s*1;[\s\S]*?margin:[^;]*-12px;[\s\S]*?transform:\s*rotate\(1\.2deg\);/,
  );
});

test("stacks the inline privacy note below controls on narrow screens", async () => {
  const css = await readFile(cssUrl, "utf8");

  assert.match(
    css,
    /@media \(max-width:\s*760px\)[\s\S]*?\.embed-shell \.booking-studio\.is-embedded\s*\{[\s\S]*?display:\s*block;[\s\S]*?\.embed-shell \.booking-studio\.is-embedded \.privacy-note\s*\{[\s\S]*?margin:\s*0 18px 24px;[\s\S]*?transform:\s*none;/,
  );
});
```

- [ ] **Step 2: Run the test and verify the expected failure**

Run: `node --test tests/inline-widget-layout.test.mjs`

Expected: FAIL because the current embedded surface has two columns and places the privacy note across the second row.

- [ ] **Step 3: Implement the minimal wide and narrow embedded layouts**

Update the embedded rules in `app/globals.css` to use:

```css
.embed-shell .booking-studio.is-embedded {
  width: 100%;
  max-width: none;
  min-height: 0;
  display: grid;
  margin: 0;
  grid-template-columns: 82px minmax(0, 1fr) minmax(200px, 230px);
  box-shadow: 5px 5px 0 var(--ink);
}

.embed-shell .booking-studio.is-embedded .privacy-note {
  grid-column: 3;
  grid-row: 1;
  align-self: start;
  width: auto;
  margin: clamp(2.75rem, 5vw, 4.5rem) 18px 2rem -12px;
  transform: rotate(1.2deg);
}
```

Inside the existing `@media (max-width: 760px)` embedded block, add `display: block` to `.booking-studio.is-embedded` and add `transform: none` to its `.privacy-note`. Keep the existing `margin: 0 18px 24px` so the note becomes a compact, safe block below the workbench.

- [ ] **Step 4: Run the focused and existing tests**

Run: `node --test tests/inline-widget-layout.test.mjs`

Expected: PASS, 2 tests.

Run: `npm test -- --run`

Expected: PASS, including the rendered homepage, embed security, and booking-route assertions.

- [ ] **Step 5: Commit the local-test implementation**

```bash
git add tests/inline-widget-layout.test.mjs app/globals.css
git commit -m "Refine inline widget privacy note layout"
```

### Task 2: Validate the local visual and interaction boundary

**Files:**
- Verify: `app/globals.css`
- Verify: `public/daymark-widget.js`

**Interfaces:**
- Consumes: the local `/embed?workspace=yawway&employee=all` page and existing widget resize messaging.
- Produces: evidence that the layout is compact at desktop width and stacked without obstruction at narrow width.

- [ ] **Step 1: Run the production build**

Run: `npm run build`

Expected: build completes with `/embed` and public booking routes present.

- [ ] **Step 2: Inspect the local inline embed at desktop width**

Open `/embed?workspace=yawway&employee=all` in the existing local preview. Confirm the blue note is 200–230px wide, slightly tilted, shifted 12px into unused cream space, and aligned on the right without covering employee cards.

- [ ] **Step 3: Inspect the local inline embed at narrow width**

Resize below 760px. Confirm the booking surface becomes a single stacked flow, the note appears after the workbench with 18px side margins, no control is covered, and no horizontal scrollbar appears.

- [ ] **Step 4: Exercise the booking controls**

Choose an employee, date, and time. Confirm each state remains visible and operable, the note never captures focus, and the embed resizes to include all content.

- [ ] **Step 5: Record the checkpoint**

Run: `git status --short`

Expected: clean working tree after the implementation commit. Keep the change local until the user approves the preview for release.
