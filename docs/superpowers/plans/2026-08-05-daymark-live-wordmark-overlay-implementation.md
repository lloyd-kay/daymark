# Daymark Live Wordmark Overlay Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the tiny raster lettering in both widget previews with crisp live text while preserving the approved textured artwork, crop, and panel geometry.

**Architecture:** Generate one text-free 4:3 sibling background, then combine that image and two decorative live text layers inside a shared intrinsic canvas in `HostHero`. CSS maps the canvas to the existing desktop cover and mobile contain geometry so the source-derived text coordinates stay aligned in both layouts.

**Tech Stack:** React 19, TypeScript, Vinext, CSS, self-hosted Google Font files, Vitest/jsdom, built-in ImageGen editor, Chrome browser QA.

## Global Constraints

- Keep `DAYMARK` and `Book the right person. Keep every calendar private.` verbatim.
- Preserve the current apparent text scale and position.
- Keep every existing Daymark artwork asset untouched for rollback.
- Preserve the 170 px cutout, 205 px floating panel, option order, choice behaviour, and booking behaviour.
- Preserve desktop cover and mobile contain composition.
- Do not deploy or publish.

---

### Task 1: Specify and generate the text-free background

**Files:**
- Create: `public/daymark-widget-art-4x3-background-2x.png`
- Test: `tests/homepage-showcase.test.tsx`

**Interfaces:**
- Consumes: `public/daymark-widget-art-4x3-readable-2x.png` as the sole edit target.
- Produces: `/daymark-widget-art-4x3-background-2x.png`, a 2896 x 2172 decorative background with the two text lines removed.

- [x] **Step 1: Add the failing asset and markup regression**

Require both previews to use `/daymark-widget-art-4x3-background-2x.png`, and require two `.widget-host-art-wordmark` and two `.widget-host-art-tagline` elements with exact text. Validate the new PNG signature, IHDR, exact 4:3 ratio, and minimum 2896 x 2172 dimensions.

- [x] **Step 2: Run the focused regression and verify red**

Run `npm.cmd run unit -- --run tests/homepage-showcase.test.tsx`.

Expected: the background/live-text test and background-asset test fail because neither exists yet; the remaining widget tests pass.

- [x] **Step 3: Generate the non-destructive edit**

Use the built-in image editor with the existing 2x asset as Image 1 and this prompt:

```text
Use case: precise-object-edit
Asset type: 4:3 textured background for a small website widget preview
Input image: Image 1 is the sole edit target
Primary request: Remove only the navy wordmark "DAYMARK" and the navy tagline "Book the right person. Keep every calendar private." Reconstruct seamless cream paper texture throughout the cleared area.
Composition: preserve the 4:3 framing and the exact position, size, crop, shape, and colour of every remaining element.
Materials/textures: preserve the prominent cream paper grain, orange binding and stitches, and the green, lilac, ochre, and blue textured folders.
Constraints: no text anywhere; change no object other than removing the two text lines; no new marks, shadows, borders, logos, or watermark.
```

If the built-in result is smaller than 2896 x 2172, export it to exactly 2896 x 2172 with high-quality Lanczos scaling. Save it as the new sibling path and do not overwrite any earlier asset.

- [x] **Step 4: Inspect and validate the background**

Open the original and edited assets at original detail. Reject the edit if text remains, the paper patch is visible, or any binding/folder detail moves. Confirm exact dimensions and 4:3 ratio.

### Task 2: Add the intrinsic canvas and live typography

**Files:**
- Modify: `app/layout.tsx`
- Modify: `app/home/WidgetOptionsShowcase.tsx`
- Modify: `app/globals.css`
- Test: `tests/homepage-showcase.test.tsx`

**Interfaces:**
- Consumes: `/daymark-widget-art-4x3-background-2x.png`.
- Produces: `.widget-host-art-canvas`, `.widget-host-art-wordmark`, and `.widget-host-art-tagline` in each preview.

- [x] **Step 1: Self-host Libre Bodoni and DM Sans**

Bundle the Latin Libre Bodoni and DM Sans font files under `public/fonts` and register them with `@font-face`. This replaces the original `next/font/google` plan because Chrome showed that the Vinext development font loader emitted the class name without the Libre Bodoni variable rule.

- [x] **Step 2: Add minimal live-text markup**

Inside the art cutout, add one intrinsic canvas containing the decorative background image, `DAYMARK`, and the exact tagline. Keep the image `alt=""`, `loading="lazy"`, and `decoding="async"`.

- [x] **Step 3: Map the intrinsic canvas to the current crop**

Give the canvas a 4:3 aspect ratio. Fill by height on desktop and by width below 520 px. Position live text using source-derived percentages, use Libre Bodoni for the wordmark and DM Sans for the tagline, and keep both lines solid navy and unwrapped.

- [x] **Step 4: Run the focused regression and verify green**

Run `npm.cmd run unit -- --run tests/homepage-showcase.test.tsx`.

Expected: all focused tests pass.

### Task 3: Visual QA and full verification

**Files:**
- Modify: `design-qa.md`
- Modify: `qa-evidence/daymark-homepage/README.md`
- Create: `qa-evidence/daymark-homepage/live-wordmark-desktop-chrome.png`
- Create: `qa-evidence/daymark-homepage/live-wordmark-mobile-floating-chrome.png`
- Create: `qa-evidence/daymark-homepage/live-wordmark-mobile-inline-chrome.png`
- Create: `qa-evidence/daymark-homepage/chrome-live-wordmark-qa.json`

**Interfaces:**
- Consumes: the implemented live wordmark preview at `http://localhost:3000/#widget-options`.
- Produces: same-state desktop/mobile Chrome evidence and a final QA record.

- [x] **Step 1: Compare desktop at the same state**

Capture the current reference and the live-text implementation at the 1303 x 1231 viewport. Confirm the same cutout, folder position, text position/scale, panel overlap, and option selection.

- [x] **Step 2: Verify both mobile cards**

At 390 x 844, capture the floating and inline cards. Confirm the wordmark remains complete, the panel remains 205 px wide, and there is no horizontal overflow.

- [x] **Step 3: Verify interaction and console state**

Toggle inline then restore floating. Require `[false, true]` then `[true, false]`, unchanged URL, and zero warnings/errors.

- [x] **Step 4: Run the full gate**

Run the full unit suite, lint, Vinext production build, `node --test tests/rendered-html.test.mjs`, and `git diff --check`.

Expected: all commands exit 0, all 21 unit files and 6 rendered-route checks pass, and the worktree is clean after commit.
