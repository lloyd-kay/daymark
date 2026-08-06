# Daymark Booking Reveal Motion Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a fast, staggered reveal to booking dates, available times, and newly selected date/time summary details without introducing layout work or interaction delay.

**Architecture:** Keep the feature CSS-only so the existing React booking state and data timing remain unchanged. Apply short `opacity` and `transform` keyframes directly to elements that already mount when a date, time list, or summary value appears. Use `backwards` fill mode for staggered initial states while allowing existing hover transforms to take control after the reveal completes.

**Tech Stack:** React 19, TypeScript 5.9, plain CSS animations, Vitest 4.

## Global Constraints

- Animate only `opacity` and `transform`.
- Use CSS animations without timers, requestAnimationFrame loops, or additional React state.
- Date cards and time buttons rise approximately 6px and complete in 180–220ms.
- Selected date/time summary details move approximately 5px from the right.
- Stagger date cards and time buttons by approximately 25–30ms.
- Preserve existing hover, focus, keyboard, and pointer behaviour.
- Remove animation duration and delay under `prefers-reduced-motion: reduce`.
- Do not animate the staff workspace, widget previews, confirmation screen, or unrelated homepage sections.

## File map

- Create `tests/booking-motion.test.ts`: enforce the approved selectors, keyframes, stagger, compositor-only properties, and reduced-motion contract.
- Modify `app/globals.css`: add the two reveal animations, child staggering, and reduced-motion delay override.

---

### Task 1: Booking reveal motion contract and CSS implementation

**Files:**
- Create: `tests/booking-motion.test.ts`
- Modify: `app/globals.css:591-677,1082-1094`

**Interfaces:**
- Consumes: existing `.date-card`, `.time-tabs button`, `.selection-slip > span`, and the global reduced-motion media query.
- Produces: `booking-card-reveal` and `booking-token-reveal` keyframes plus 28ms child staggering.

- [ ] **Step 1: Write the failing style-contract test**

Create `tests/booking-motion.test.ts` with:

```ts
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const stylesheet = readFileSync(resolve(process.cwd(), "app/globals.css"), "utf8");

describe("booking reveal motion", () => {
  it("reveals date cards, time buttons, and summary tokens with compositor-only keyframes", () => {
    expect(stylesheet).toMatch(
      /\.date-card,\s*\.time-tabs button\s*\{[^}]*animation:\s*booking-card-reveal 210ms cubic-bezier\(0\.22, 1, 0\.36, 1\) backwards;/s,
    );
    expect(stylesheet).toMatch(
      /\.selection-slip > span\s*\{[^}]*animation:\s*booking-token-reveal 180ms cubic-bezier\(0\.22, 1, 0\.36, 1\) backwards;/s,
    );
    expect(stylesheet).toMatch(
      /@keyframes booking-card-reveal\s*\{\s*from\s*\{\s*opacity:\s*0;\s*transform:\s*translateY\(6px\);\s*}\s*to\s*\{\s*opacity:\s*1;\s*transform:\s*translateY\(0\);\s*}\s*}/s,
    );
    expect(stylesheet).toMatch(
      /@keyframes booking-token-reveal\s*\{\s*from\s*\{\s*opacity:\s*0;\s*transform:\s*translateX\(5px\);\s*}\s*to\s*\{\s*opacity:\s*1;\s*transform:\s*translateX\(0\);\s*}\s*}/s,
    );

    const keyframes = stylesheet.match(
      /@keyframes booking-(?:card|token)-reveal\s*\{[\s\S]*?\n}/g,
    )?.join("\n") ?? "";
    expect(keyframes).not.toMatch(/\b(?:height|width|margin|padding|filter|box-shadow|top|right|bottom|left):/);
  });

  it("stagger reveals briefly and removes duration and delay for reduced motion", () => {
    expect(stylesheet).toMatch(
      /\.date-card:nth-child\(2\),\s*\.time-tabs button:nth-child\(2\)\s*\{\s*animation-delay:\s*28ms;\s*}/s,
    );
    expect(stylesheet).toMatch(
      /\.date-card:nth-child\(7\),\s*\.time-tabs button:nth-child\(7\)\s*\{\s*animation-delay:\s*168ms;\s*}/s,
    );
    expect(stylesheet).toMatch(
      /@media \(prefers-reduced-motion: reduce\)[\s\S]*animation-duration:\s*0\.01ms !important;[\s\S]*animation-delay:\s*0ms !important;/s,
    );
  });
});
```

- [ ] **Step 2: Run the focused test and verify the motion contract is absent**

```powershell
npm run unit -- tests/booking-motion.test.ts
```

Expected: FAIL because neither reveal animation nor the stagger rules exist.

- [ ] **Step 3: Add the reveal animations and stagger rules**

Add the shared animation assignment immediately after `.date-strip` and before the existing `.date-card` declaration:

```css
.date-card,
.time-tabs button {
  animation: booking-card-reveal 210ms cubic-bezier(0.22, 1, 0.36, 1) backwards;
}

.date-card:nth-child(2),
.time-tabs button:nth-child(2) { animation-delay: 28ms; }
.date-card:nth-child(3),
.time-tabs button:nth-child(3) { animation-delay: 56ms; }
.date-card:nth-child(4),
.time-tabs button:nth-child(4) { animation-delay: 84ms; }
.date-card:nth-child(5),
.time-tabs button:nth-child(5) { animation-delay: 112ms; }
.date-card:nth-child(6),
.time-tabs button:nth-child(6) { animation-delay: 140ms; }
.date-card:nth-child(7),
.time-tabs button:nth-child(7) { animation-delay: 168ms; }

@keyframes booking-card-reveal {
  from {
    opacity: 0;
    transform: translateY(6px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}
```

Extend the existing `.selection-slip > span` declaration with the animation, then add its keyframes after the selection-slip styles:

```css
.selection-slip > span {
  padding-left: 12px;
  border-left: 1px solid var(--rule);
  font-weight: 700;
  animation: booking-token-reveal 180ms cubic-bezier(0.22, 1, 0.36, 1) backwards;
}

@keyframes booking-token-reveal {
  from {
    opacity: 0;
    transform: translateX(5px);
  }
  to {
    opacity: 1;
    transform: translateX(0);
  }
}
```

Add the delay override to the existing universal reduced-motion declaration:

```css
*,
*::before,
*::after {
  animation-duration: 0.01ms !important;
  animation-delay: 0ms !important;
  animation-iteration-count: 1 !important;
  transition-duration: 0.01ms !important;
}
```

- [ ] **Step 4: Run the focused test and verify the CSS contract passes**

```powershell
npm run unit -- tests/booking-motion.test.ts
```

Expected: both booking-motion tests PASS.

- [ ] **Step 5: Commit the reveal motion**

```powershell
git add -- app/globals.css tests/booking-motion.test.ts
git commit -m "feat: gently reveal booking choices"
```

---

### Task 2: Regression and visual verification

**Files:**
- Verify: `app/globals.css`
- Verify: `tests/booking-motion.test.ts`
- Verify: `app/booking/BookingFlow.tsx`

**Interfaces:**
- Consumes: the committed CSS-only reveal motion.
- Produces: evidence that the animations are responsive, accessible, and regression-free.

- [ ] **Step 1: Run all unit tests and lint**

```powershell
npm run unit
npm run lint
```

Expected: all Vitest suites PASS and ESLint exits with code 0.

- [ ] **Step 2: Run the Windows-compatible production verification**

```powershell
$env:WRANGLER_LOG_PATH='.wrangler/wrangler.log'
npx vinext build
node --test tests/rendered-html.test.mjs
```

Expected: the production build succeeds and all rendered-HTML tests PASS.

- [ ] **Step 3: Inspect desktop motion in the local browser**

At `http://localhost:3000/#demo`, choose an employee, then a date. Verify date cards and time buttons fade/rise in sequence, the selected date/time summary values enter from the right, hover movement still works after reveal, and controls remain immediately clickable.

- [ ] **Step 4: Inspect mobile and reduced-motion behaviour**

At a 390-pixel viewport, verify the horizontal date strip remains responsive with no document overflow. Emulate reduced motion and confirm animation duration is effectively zero and delay is zero while all seven date controls remain usable.

- [ ] **Step 5: Check browser health and repository state**

Confirm no console errors or warnings, reset the temporary viewport override, and run:

```powershell
git diff --check
git status --short
git log -4 --oneline
```

Expected: no whitespace errors, a clean working tree, and the reveal-motion commit at the branch tip.
